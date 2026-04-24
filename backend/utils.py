"""Shared utility functions for backend modules."""

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import Flow


def parse_iso_datetime(value: str, field_name: str = "datetime") -> datetime:
    """Parse ISO-8601 datetime string, handling Z suffix and ensuring UTC timezone."""
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be ISO-8601 datetime (example: 2026-02-19T00:00:00Z)",
        ) from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def build_permission_responses(role: Any) -> list[Any]:
    """Build list of PermissionResponse objects from role's role_permissions."""
    from permissions import PermissionResponse

    return [
        PermissionResponse(
            id=rp.permission.id,
            name=rp.permission.name,
            resource=rp.permission.resource,
            action=rp.permission.action,
            description=rp.permission.description
        )
        for rp in role.role_permissions
    ]


def require_tenant_flow(db: Session, flow_id: str, tenant_id: str) -> Flow:
    """
    Verify that a flow exists and belongs to the specified tenant.

    Raises HTTPException(404) if flow not found or tenant mismatch.
    """
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.tenant_id == tenant_id).one_or_none()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    return flow
