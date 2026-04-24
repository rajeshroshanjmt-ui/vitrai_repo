import logging
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import require_roles, require_permission, _write_audit_log
from database import get_db
from models import Permission, Role, RolePermission
from utils import build_permission_responses

router = APIRouter()
logger = logging.getLogger(__name__)


class PermissionCreateRequest(BaseModel):
    name: str
    resource: str
    action: str
    description: str | None = None


class PermissionResponse(BaseModel):
    id: str
    name: str
    resource: str
    action: str
    description: str | None = None

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_custom: bool
    is_system: bool
    permissions: list[PermissionResponse] = []

    class Config:
        from_attributes = True


class RoleCreateRequest(BaseModel):
    name: str
    description: str | None = None


class RoleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class RolePermissionAssignRequest(BaseModel):
    permission_ids: list[str]


# ============ Permissions Endpoints ============

@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> list[PermissionResponse]:
    """List all available permissions. Requires admin role."""
    permissions = db.query(Permission).all()
    return permissions


@router.post("/permissions", response_model=PermissionResponse, status_code=201)
def create_permission(
    payload: PermissionCreateRequest,
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> PermissionResponse:
    """Create a new permission. Requires admin role."""
    # Check if permission already exists
    existing = db.query(Permission).filter(Permission.name == payload.name).one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Permission already exists")

    permission = Permission(
        id=str(uuid4()),
        name=payload.name,
        resource=payload.resource,
        action=payload.action,
        description=payload.description
    )
    db.add(permission)
    db.commit()

    return permission


# ============ Roles Endpoints ============

@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> list[RoleResponse]:
    """List all roles in the tenant. Requires admin role."""
    tenant_id = user.get("tenant_id")
    roles = db.query(Role).filter(Role.tenant_id == tenant_id).options(joinedload(Role.role_permissions)).all()

    role_responses = [
        RoleResponse(
            id=role.id,
            name=role.name,
            description=role.description,
            is_custom=role.is_custom,
            is_system=role.is_system,
            permissions=build_permission_responses(role)
        )
        for role in roles
    ]

    return role_responses


@router.get("/roles/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: str,
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> RoleResponse:
    """Get a specific role with permissions. Requires admin role."""
    tenant_id = user.get("tenant_id")

    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        is_custom=role.is_custom,
        is_system=role.is_system,
        permissions=build_permission_responses(role)
    )


@router.post("/roles", response_model=RoleResponse)
def create_role(
    payload: RoleCreateRequest,
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> RoleResponse:
    """Create a new custom role. Requires admin role."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Check if role name already exists
    existing = db.query(Role).filter(
        Role.tenant_id == tenant_id,
        func.lower(Role.name) == func.lower(payload.name)
    ).one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")

    role = Role(
        id=str(uuid4()),
        tenant_id=tenant_id,
        name=payload.name,
        description=payload.description,
        is_custom=True,
        is_system=False
    )
    db.add(role)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "role.created", "role",
        resource_id=role.id, details={"role_name": payload.name}
    )
    db.commit()

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        is_custom=role.is_custom,
        is_system=role.is_system,
        permissions=[]
    )


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: str,
    payload: RoleUpdateRequest,
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> RoleResponse:
    """Update a role. Requires admin role."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot modify system roles")

    old_name = role.name
    if payload.name:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description

    db.commit()

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "role.updated", "role",
        resource_id=role.id, details={"old_name": old_name, "new_name": role.name}
    )

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        is_custom=role.is_custom,
        is_system=role.is_system,
        permissions=build_permission_responses(role)
    )


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> dict:
    """Delete a custom role. Requires admin role. Cannot delete system roles."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system roles")

    db.delete(role)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "role.deleted", "role",
        resource_id=role.id, details={"role_name": role.name}
    )
    db.commit()

    return {"status": "ok", "message": "Role deleted"}


# ============ Role Permission Assignment ============

@router.post("/roles/{role_id}/permissions")
def assign_permissions(
    role_id: str,
    payload: RolePermissionAssignRequest,
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> dict:
    """Assign permissions to a role. Requires admin role."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Clear existing permissions
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()

    # Add new permissions
    for permission_id in payload.permission_ids:
        permission = db.query(Permission).filter(Permission.id == permission_id).one_or_none()
        if not permission:
            raise HTTPException(status_code=404, detail=f"Permission {permission_id} not found")

        role_permission = RolePermission(
            id=str(uuid4()),
            role_id=role_id,
            permission_id=permission_id
        )
        db.add(role_permission)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "role.permissions_updated", "role",
        resource_id=role.id, details={"permission_count": len(payload.permission_ids)}
    )
    db.commit()

    return {"status": "ok", "message": f"Assigned {len(payload.permission_ids)} permissions"}


@router.get("/roles/{role_id}/permissions", response_model=list[PermissionResponse])
def get_role_permissions(
    role_id: str,
    user: Annotated[dict, Depends(require_permission("admin:manage"))],
    db: Session = Depends(get_db)
) -> list[PermissionResponse]:
    """Get all permissions assigned to a role. Requires admin role."""
    tenant_id = user.get("tenant_id")

    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant_id).one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return build_permission_responses(role)
