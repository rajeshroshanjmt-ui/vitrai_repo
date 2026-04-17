from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import require_roles, require_permission, _get_active_workspace
from crypto import decrypt_payload, encrypt_payload, generate_api_key, hash_api_key, is_encrypted
from database import get_db
from models import AuditLog, Tenant, TenantResource

router = APIRouter()

ALLOWED_RESOURCE_TYPES = {
    "agentflow",
    "assistant",
    "api_key",
    "credential",
    "dataset",
    "document_store",
    "evaluation",
    "evaluator",
    "marketplace",
    "tool",
    "variable",
}

# These types contain secrets — payloads are encrypted at rest and masked in responses.
SECURITY_RESOURCE_TYPES = {"credential", "api_key"}

# Fields within a security payload that must be masked in API responses.
# Values are replaced with "****" except the last 4 characters (where length ≥ 8).
_SENSITIVE_FIELD_NAMES = {
    "api_key", "apiKey", "secret", "token", "password", "private_key",
    "client_secret", "access_token", "refresh_token", "key",
}


class ResourceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    payload: dict[str, Any] = Field(default_factory=dict)


class ResourceUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    payload: dict[str, Any] | None = None


def _ensure_resource_type(resource_type: str) -> str:
    normalized = resource_type.strip().lower()
    if normalized not in ALLOWED_RESOURCE_TYPES:
        supported = ", ".join(sorted(ALLOWED_RESOURCE_TYPES))
        raise HTTPException(status_code=400, detail=f"Unsupported resource type `{resource_type}`. Allowed: {supported}")
    return normalized


def _ensure_tenant(db: Session, tenant_id: str) -> None:
    """Verify the tenant exists. Raises 400 if it does not.

    Previously this silently auto-created tenants, which bypassed all
    onboarding flows and allowed arbitrary tenant IDs to be injected.
    """
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=400,
            detail=f"Tenant '{tenant_id}' does not exist. Resources can only be created for existing tenants.",
        )


def _mask_sensitive_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of payload with secret field values replaced by '****...xxxx'.

    Only the last 4 characters are shown when the value is long enough to be a
    real secret (≥ 8 chars). This lets support staff identify key prefixes
    without exposing the full secret.
    """
    masked: dict[str, Any] = {}
    for k, v in payload.items():
        if k in _SENSITIVE_FIELD_NAMES and isinstance(v, str):
            if len(v) >= 8:
                masked[k] = f"****{v[-4:]}"
            else:
                masked[k] = "****"
        else:
            masked[k] = v
    return masked


def _serialize_resource(resource: TenantResource, *, reveal_secrets: bool = False) -> dict[str, Any]:
    """Serialise a resource for an API response.

    For SECURITY_RESOURCE_TYPES the payload is always masked unless
    `reveal_secrets=True` is explicitly requested (e.g., at execution time —
    never in a list/get endpoint).
    """
    payload = resource.payload or {}
    if not reveal_secrets and resource.resource_type in SECURITY_RESOURCE_TYPES:
        payload = _mask_sensitive_payload(payload)
    return {
        "resource_id": resource.id,
        "resource_type": resource.resource_type,
        "name": resource.name,
        "payload": payload,
        "created_by": resource.created_by,
        "updated_by": resource.updated_by,
        "created_at": resource.created_at.isoformat() if resource.created_at else None,
        "updated_at": resource.updated_at.isoformat() if resource.updated_at else None,
    }


def _safe_audit_details(resource: TenantResource) -> dict[str, Any]:
    """Build audit log details without logging raw secret values."""
    details: dict[str, Any] = {"name": resource.name}
    if resource.resource_type in SECURITY_RESOURCE_TYPES:
        # Record only non-sensitive metadata — never the payload itself
        details["resource_type"] = resource.resource_type
        details["has_payload"] = bool(resource.payload)
    else:
        details["payload"] = resource.payload
    return details


def _append_audit_log(
    db: Session,
    user: dict,
    action: str,
    resource: TenantResource,
) -> None:
    entry = AuditLog(
        id=str(uuid4()),
        tenant_id=user.get("tenant_id"),
        actor_user_id=user.get("user_id"),
        actor_email=user.get("sub"),
        actor_role=user.get("role"),
        action=action,
        resource_type=f"resource:{resource.resource_type}",
        resource_id=resource.id,
        details=_safe_audit_details(resource),
    )
    db.add(entry)


def _required_reader_roles(resource_type: str) -> tuple[str, ...]:
    if resource_type in SECURITY_RESOURCE_TYPES:
        return ("admin", "editor")
    return ("admin", "editor", "viewer")


@router.get("/{resource_type}")
def list_resources(
    resource_type: str,
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:view"))] = None,
) -> dict[str, Any]:
    normalized_type = _ensure_resource_type(resource_type)

    if user.get("role") not in _required_reader_roles(normalized_type):
        raise HTTPException(status_code=403, detail="Insufficient role")

    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    query = db.query(TenantResource).filter(
        TenantResource.tenant_id == user["tenant_id"],
        TenantResource.resource_type == normalized_type,
    )

    if q:
        query = query.filter(TenantResource.name.ilike(f"%{q.strip()}%"))

    total_count = query.count()
    rows = query.order_by(TenantResource.updated_at.desc()).offset(safe_offset).limit(safe_limit).all()
    return {
        "items": [_serialize_resource(row) for row in rows],
        "total_count": total_count,
        "limit": safe_limit,
        "offset": safe_offset,
    }


@router.get("/{resource_type}/{resource_id}")
def get_resource(
    resource_type: str,
    resource_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:view"))] = None,
) -> dict[str, Any]:
    normalized_type = _ensure_resource_type(resource_type)

    if user.get("role") not in _required_reader_roles(normalized_type):
        raise HTTPException(status_code=403, detail="Insufficient role")

    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == resource_id,
            TenantResource.tenant_id == user["tenant_id"],
            TenantResource.resource_type == normalized_type,
        )
        .one_or_none()
    )
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")

    return _serialize_resource(resource)


@router.post("/{resource_type}")
def create_resource(
    resource_type: str,
    body: ResourceCreateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:create"))] = None,
) -> dict[str, Any]:
    normalized_type = _ensure_resource_type(resource_type)
    _ensure_tenant(db, user["tenant_id"])

    now_utc = datetime.now(timezone.utc)

    # For api_key resources: auto-generate the key (caller must not supply their own raw key)
    raw_api_key: str | None = None
    payload = body.payload
    if normalized_type == "api_key":
        raw_api_key, key_hash, key_prefix = generate_api_key()
        # Store only the hash + prefix — never the raw key
        payload = {**payload, "key_hash": key_hash, "key_prefix": key_prefix}

    # Encrypt payload for security-sensitive resource types
    stored_payload = encrypt_payload(payload) if normalized_type in SECURITY_RESOURCE_TYPES else payload

    resource = TenantResource(
        id=str(uuid4()),
        tenant_id=user["tenant_id"],
        resource_type=normalized_type,
        name=body.name.strip(),
        payload=stored_payload,
        created_by=user.get("user_id"),
        updated_by=user.get("user_id"),
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(resource)
    _append_audit_log(db, user, f"resource_create:{normalized_type}", resource)
    db.commit()

    response = _serialize_resource(resource)
    # For api_key: include the raw key ONCE in the creation response only
    if raw_api_key is not None:
        response["raw_api_key"] = raw_api_key
        response["_raw_key_notice"] = "This is the only time the raw API key is shown. Store it securely."
    return response


@router.put("/{resource_type}/{resource_id}")
def update_resource(
    resource_type: str,
    resource_id: str,
    body: ResourceUpdateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:edit"))] = None,
) -> dict[str, Any]:
    normalized_type = _ensure_resource_type(resource_type)
    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == resource_id,
            TenantResource.tenant_id == user["tenant_id"],
            TenantResource.resource_type == normalized_type,
        )
        .one_or_none()
    )
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")

    if body.name is not None:
        resource.name = body.name.strip()
    if body.payload is not None:
        # api_key raw values cannot be updated via this endpoint — rotate instead
        if normalized_type == "api_key" and "key_hash" not in body.payload:
            raise HTTPException(
                status_code=400,
                detail="API key values cannot be updated directly. Delete this key and create a new one to rotate.",
            )
        stored_payload = (
            encrypt_payload(body.payload) if normalized_type in SECURITY_RESOURCE_TYPES else body.payload
        )
        resource.payload = stored_payload

    resource.updated_by = user.get("user_id")
    resource.updated_at = datetime.now(timezone.utc)
    _append_audit_log(db, user, f"resource_update:{normalized_type}", resource)
    db.commit()
    return _serialize_resource(resource)


@router.delete("/{resource_type}/{resource_id}")
def delete_resource(
    resource_type: str,
    resource_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:delete"))] = None,
) -> dict[str, Any]:
    normalized_type = _ensure_resource_type(resource_type)
    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == resource_id,
            TenantResource.tenant_id == user["tenant_id"],
            TenantResource.resource_type == normalized_type,
        )
        .one_or_none()
    )
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")

    _append_audit_log(db, user, f"resource_delete:{normalized_type}", resource)
    db.delete(resource)
    db.commit()
    return {
        "status": "deleted",
        "resource_id": resource_id,
        "resource_type": normalized_type,
    }


# ---------------------------------------------------------------------------
# Internal helper — used by the execution engine, NOT exposed as an HTTP route
# ---------------------------------------------------------------------------

def get_decrypted_payload(db: Session, tenant_id: str, resource_id: str, resource_type: str) -> dict[str, Any]:
    """Retrieve and decrypt a security-sensitive resource payload for internal use.

    This is intentionally NOT a FastAPI route. Call it from the execution worker
    or platform_compat logic where the credential is actually needed.
    Never return the result of this function directly in an HTTP response.
    """
    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == resource_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == resource_type,
        )
        .one_or_none()
    )
    if resource is None:
        raise ValueError(f"Resource {resource_id} of type {resource_type} not found for tenant {tenant_id}")

    payload = resource.payload or {}
    if is_encrypted(payload):
        return decrypt_payload(payload)
    return payload
