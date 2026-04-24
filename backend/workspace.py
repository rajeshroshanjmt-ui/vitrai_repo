from typing import Annotated
from uuid import uuid4
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles, require_permission, _write_audit_log
from database import get_db
from models import TenantResource, User, UserPreference

router = APIRouter()
logger = logging.getLogger(__name__)


class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    organizationId: str
    userCount: int
    isOrgDefault: bool = False
    createdDate: str | None = None
    updatedDate: str | None = None

    class Config:
        from_attributes = True


class WorkspacesListResponse(BaseModel):
    data: list[WorkspaceResponse]
    total: int


@router.get("/workspaces")
def list_workspaces(
    user: Annotated[dict, Depends(require_permission("workspaces:manage"))],
    db: Session = Depends(get_db)
) -> WorkspacesListResponse:
    """List all workspaces in the organization."""
    tenant_id = user.get("tenant_id")

    # Query TenantResource for workspace resources
    resources = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .all()
    )

    # Query user count once (not per workspace)
    user_count = db.query(User).filter(User.tenant_id == tenant_id).count()

    workspaces = []
    for resource in resources:
        payload = resource.payload or {}

        workspaces.append(
            WorkspaceResponse(
                id=resource.id,
                name=resource.name,
                description=payload.get("description"),
                organizationId=tenant_id,
                userCount=user_count,
                isOrgDefault=payload.get("isOrgDefault", False),
                createdDate=resource.created_at.isoformat() if resource.created_at else None,
                updatedDate=resource.updated_at.isoformat() if resource.updated_at else None
            )
        )

    return WorkspacesListResponse(data=workspaces, total=len(workspaces))


@router.post("/workspaces", response_model=WorkspaceResponse)
def create_workspace(
    payload: WorkspaceCreate,
    user: Annotated[dict, Depends(require_permission("workspaces:manage"))],
    db: Session = Depends(get_db)
) -> WorkspaceResponse:
    """Create a new workspace."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    workspace_id = str(uuid4())
    workspace_resource = TenantResource(
        id=workspace_id,
        tenant_id=tenant_id,
        resource_type="workspace",
        name=payload.name,
        payload={
            "description": payload.description,
            "isOrgDefault": False
        },
        created_by=actor_user_id,
        updated_by=actor_user_id
    )
    db.add(workspace_resource)

    logger.info(f"Workspace created: workspace_id={workspace_id}, name={payload.name}, tenant_id={tenant_id}, actor={actor_email}")

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "workspace.created", "workspace",
        resource_id=workspace_id, details={"name": payload.name}
    )
    db.commit()

    user_count = db.query(User).filter(User.tenant_id == tenant_id).count()

    return WorkspaceResponse(
        id=workspace_id,
        name=payload.name,
        description=payload.description,
        organizationId=tenant_id,
        userCount=user_count,
        isOrgDefault=False,
        createdDate=workspace_resource.created_at.isoformat() if workspace_resource.created_at else None,
        updatedDate=workspace_resource.updated_at.isoformat() if workspace_resource.updated_at else None
    )


@router.put("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    user: Annotated[dict, Depends(require_permission("workspaces:manage"))],
    db: Session = Depends(get_db)
) -> WorkspaceResponse:
    """Update a workspace."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    workspace_resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == workspace_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .one_or_none()
    )

    if workspace_resource is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Update fields
    if payload.name:
        workspace_resource.name = payload.name
    if payload.description is not None:
        workspace_resource.payload["description"] = payload.description

    workspace_resource.updated_by = actor_user_id
    db.commit()

    logger.info(f"Workspace updated: workspace_id={workspace_id}, name={payload.name}, tenant_id={tenant_id}, actor={actor_email}")

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "workspace.updated", "workspace",
        resource_id=workspace_id, details={"name": payload.name}
    )

    user_count = db.query(User).filter(User.tenant_id == tenant_id).count()

    return WorkspaceResponse(
        id=workspace_resource.id,
        name=workspace_resource.name,
        description=workspace_resource.payload.get("description"),
        organizationId=tenant_id,
        userCount=user_count,
        isOrgDefault=workspace_resource.payload.get("isOrgDefault", False),
        createdDate=workspace_resource.created_at.isoformat() if workspace_resource.created_at else None,
        updatedDate=workspace_resource.updated_at.isoformat() if workspace_resource.updated_at else None
    )


@router.delete("/workspaces/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    user: Annotated[dict, Depends(require_permission("workspaces:manage"))],
    db: Session = Depends(get_db)
) -> dict:
    """Delete a workspace."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    workspace_resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == workspace_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .one_or_none()
    )

    if workspace_resource is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Cannot delete if it's the only workspace (prevent lockout)
    workspace_count = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .count()
    )
    if workspace_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only workspace")

    db.delete(workspace_resource)

    logger.info(f"Workspace deleted: workspace_id={workspace_id}, name={workspace_resource.name}, tenant_id={tenant_id}, actor={actor_email}")

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "workspace.deleted", "workspace",
        resource_id=workspace_id, details={"name": workspace_resource.name}
    )
    db.commit()

    return {"status": "ok", "message": "Workspace deleted"}


@router.post("/switch")
def switch_workspace(
    id: str,
    user: Annotated[dict, Depends(get_current_user)],
    db: Session = Depends(get_db)
) -> dict:
    """Switch the user's active workspace."""
    workspace_id = id
    tenant_id = user.get("tenant_id")
    user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Verify workspace belongs to tenant
    workspace_resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == workspace_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .one_or_none()
    )

    if workspace_resource is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Update user preference for active workspace
    pref = (
        db.query(UserPreference)
        .filter(
            UserPreference.tenant_id == tenant_id,
            UserPreference.user_id == user_id,
            UserPreference.pref_key == "active_workspace"
        )
        .one_or_none()
    )

    if pref is None:
        pref = UserPreference(
            id=str(uuid4()),
            tenant_id=tenant_id,
            user_id=user_id,
            pref_key="active_workspace",
            pref_value={"workspace_id": workspace_id}
        )
        db.add(pref)
    else:
        pref.pref_value = {"workspace_id": workspace_id}

    # Write audit log
    _write_audit_log(
        db, tenant_id, user_id, actor_email, "workspace.switched", "workspace",
        resource_id=workspace_id, details={"workspace_name": workspace_resource.name}
    )
    db.commit()

    # Return user context with updated workspace
    return {
        "status": "ok",
        "activeWorkspaceId": workspace_id,
        "activeWorkspace": workspace_resource.name
    }


@router.post("/workspaces/{workspace_id}/users")
def link_user_to_workspace(
    workspace_id: str,
    user_id: str,
    user: Annotated[dict, Depends(require_permission("workspaces:manage"))],
    db: Session = Depends(get_db)
) -> dict:
    """Link a user to a workspace."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Verify workspace exists
    workspace_resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == workspace_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .one_or_none()
    )
    if workspace_resource is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Verify user exists
    target_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if user is already linked to this workspace
    workspace_pref_key = f"workspace_role_{workspace_id}"
    existing_pref = db.query(UserPreference).filter(
        UserPreference.tenant_id == tenant_id,
        UserPreference.user_id == user_id,
        UserPreference.pref_key == workspace_pref_key
    ).one_or_none()

    if existing_pref:
        raise HTTPException(status_code=409, detail="User is already linked to this workspace")

    # Store workspace-user association in UserPreference
    pref = UserPreference(
        id=str(uuid4()),
        tenant_id=tenant_id,
        user_id=user_id,
        pref_key=workspace_pref_key,
        pref_value={"workspace_id": workspace_id, "role": "member"}
    )
    db.add(pref)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "workspace_user.added", "workspace",
        resource_id=workspace_id, details={"user_id": user_id, "user_email": target_user.email}
    )
    db.commit()

    return {"status": "ok", "message": "User linked to workspace"}


@router.delete("/workspaces/{workspace_id}/users/{user_id}")
def unlink_user_from_workspace(
    workspace_id: str,
    user_id: str,
    user: Annotated[dict, Depends(require_permission("workspaces:manage"))],
    db: Session = Depends(get_db)
) -> dict:
    """Remove a user from a workspace."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Verify workspace exists
    workspace_resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == workspace_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .one_or_none()
    )
    if workspace_resource is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Find and delete the preference linking user to workspace
    pref = (
        db.query(UserPreference)
        .filter(
            UserPreference.tenant_id == tenant_id,
            UserPreference.user_id == user_id,
            UserPreference.pref_key == f"workspace_role_{workspace_id}"
        )
        .one_or_none()
    )

    if pref:
        db.delete(pref)

    # Fetch user for audit log
    target_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "workspace_user.removed", "workspace",
        resource_id=workspace_id, details={"user_id": user_id, "user_email": target_user.email if target_user else None}
    )
    db.commit()

    return {"status": "ok", "message": "User removed from workspace"}


@router.get("/workspaces/{workspace_id}/users")
def list_workspace_users(
    workspace_id: str,
    user: Annotated[dict, Depends(require_permission("workspaces:view"))],
    db: Session = Depends(get_db)
) -> dict:
    """List users in a workspace."""
    tenant_id = user.get("tenant_id")

    # Verify workspace exists
    workspace_resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == workspace_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        )
        .one_or_none()
    )
    if workspace_resource is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Get users linked to this workspace via UserPreference
    workspace_pref_key = f"workspace_role_{workspace_id}"

    workspace_users = db.query(User).join(
        UserPreference,
        (UserPreference.user_id == User.id) &
        (UserPreference.tenant_id == tenant_id) &
        (UserPreference.pref_key == workspace_pref_key)
    ).all()

    user_list = [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "status": "active" if u.password_hash else "pending"
        }
        for u in workspace_users
    ]

    return {"data": user_list, "total": len(user_list)}
