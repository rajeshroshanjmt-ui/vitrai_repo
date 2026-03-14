from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import require_roles, require_permission
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

SECURITY_RESOURCE_TYPES = {"credential", "api_key"}


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
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        db.add(Tenant(id=tenant_id, name=f"tenant-{tenant_id[:8]}"))
        db.flush()


def _serialize_resource(resource: TenantResource) -> dict[str, Any]:
    return {
        "resource_id": resource.id,
        "resource_type": resource.resource_type,
        "name": resource.name,
        "payload": resource.payload or {},
        "created_by": resource.created_by,
        "updated_by": resource.updated_by,
        "created_at": resource.created_at.isoformat() if resource.created_at else None,
        "updated_at": resource.updated_at.isoformat() if resource.updated_at else None,
    }


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
        details={"name": resource.name, "payload": resource.payload},
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
    resource = TenantResource(
        id=str(uuid4()),
        tenant_id=user["tenant_id"],
        resource_type=normalized_type,
        name=body.name.strip(),
        payload=body.payload,
        created_by=user.get("user_id"),
        updated_by=user.get("user_id"),
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(resource)
    _append_audit_log(db, user, f"resource_create:{normalized_type}", resource)
    db.commit()
    return _serialize_resource(resource)


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
        resource.payload = body.payload

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
