"""API key authentication middleware."""
import logging
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from database import SessionLocal
from models import TenantResource

logger = logging.getLogger(__name__)


async def _validate_api_key(key: str, db: Session) -> dict | None:
    """
    Validate API key and return user context if valid.

    Returns:
        Dict with tenant_id and user_id if valid, None otherwise.
    """
    try:
        # Query TenantResource for API key
        from sqlalchemy import func, text

        resource = (
            db.query(TenantResource)
            .filter(
                TenantResource.resource_type == "api_key",
                func.jsonb_extract_path_text(TenantResource.payload, "apiKey") == key,
            )
            .first()
        )

        if resource:
            return {
                "tenant_id": resource.tenant_id,
                "user_id": resource.created_by,
                "api_key_id": resource.id,
            }

        return None

    except Exception as e:
        logger.error(f"Error validating API key: {str(e)}")
        return None


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Middleware to validate API keys for protected endpoints."""

    # Endpoints that require API key authentication
    PROTECTED_PREFIXES = [
        "/api/v1/prediction/",
        "/api/v1/internal-prediction/",
        "/api/v1/webhook/",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Validate API key if request is to protected endpoint."""
        path = request.url.path

        # Check if this is a protected endpoint
        is_protected = any(path.startswith(prefix) for prefix in self.PROTECTED_PREFIXES)

        if is_protected:
            # Try to get API key from multiple sources
            api_key = (
                request.headers.get("x-api-key")
                or request.headers.get("authorization", "").replace("Bearer ", "")
                or request.query_params.get("apiKey")
            )

            if not api_key:
                return JSONResponse(
                    {"error": "API key required", "detail": "Missing x-api-key header or apiKey query parameter"},
                    status_code=401,
                )

            # Validate API key
            db = SessionLocal()
            try:
                user_ctx = await _validate_api_key(api_key, db)

                if not user_ctx:
                    return JSONResponse(
                        {"error": "Invalid API key", "detail": "The provided API key is invalid or has been revoked"},
                        status_code=401,
                    )

                # Attach user context to request for use in route handlers
                request.state.user = user_ctx
                request.state.auth_method = "api_key"

            finally:
                db.close()

        # Continue to next middleware/route handler
        response = await call_next(request)
        return response
