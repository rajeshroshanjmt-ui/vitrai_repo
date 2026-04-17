from typing import Annotated
from uuid import uuid4
import csv
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

import os
from auth import require_roles, require_permission, _write_audit_log, create_reset_token
from email_service import send_invitation_email
from database import get_db
from models import User, Tenant

router = APIRouter()


class UserInviteRequest(BaseModel):
    email: EmailStr
    role: str = "viewer"
    full_name: str | None = None


class UserUpdateRequest(BaseModel):
    role: str
    full_name: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    role: str
    is_active: bool = True
    status: str  # active, pending, or deactivated
    last_login: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


class UsersListResponse(BaseModel):
    data: list[UserResponse]
    total: int


@router.get("/users", response_model=UsersListResponse)
def list_users(
    user: Annotated[dict, Depends(require_permission("users:manage"))],
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> UsersListResponse:
    """List all users in the tenant. Requires users:manage permission."""
    tenant_id = user.get("tenant_id")

    users = db.query(User).filter(User.tenant_id == tenant_id).offset(skip).limit(limit).all()
    total = db.query(User).filter(User.tenant_id == tenant_id).count()

    user_responses = []
    for u in users:
        # Status: "pending" if never set a password, "deactivated" if disabled, else "active"
        if not u.password_hash:
            status = "pending"
        elif not getattr(u, "is_active", True):
            status = "deactivated"
        else:
            status = "active"
        last_login_str = u.last_login.isoformat() if u.last_login else None
        created_at_str = u.created_at.isoformat() if u.created_at else None

        user_responses.append(
            UserResponse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=getattr(u, "is_active", True),
                status=status,
                last_login=last_login_str,
                created_at=created_at_str
            )
        )

    return UsersListResponse(data=user_responses, total=total)


@router.post("/users/invite", response_model=UserResponse)
def invite_user(
    payload: UserInviteRequest,
    user: Annotated[dict, Depends(require_permission("users:manage"))],
    db: Session = Depends(get_db)
) -> UserResponse:
    """Invite a new user to the tenant. Requires users:manage permission."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    email = payload.email.lower()

    # Check if user already exists
    existing_user = (
        db.query(User)
        .filter(User.tenant_id == tenant_id, func.lower(User.email) == email)
        .one_or_none()
    )
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="User already exists")

    # Create new user without password (invited state)
    new_user = User(
        id=str(uuid4()),
        tenant_id=tenant_id,
        email=email,
        full_name=payload.full_name,
        password_hash=None,  # Invited users have no password yet
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # Flush to get the user ID

    # Generate invitation token (valid for 1 hour)
    invitation_token = create_reset_token(new_user.id)

    # Write audit log (never include secrets in details)
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "user.invited", "user",
        resource_id=new_user.id, details={"invited_email": email, "invited_role": payload.role}
    )
    db.commit()

    # Send invitation email with password setup link
    base_url = os.getenv("VETRAI_BASE_URL", "http://localhost:3000")
    setup_url = f"{base_url}/reset-password?token={invitation_token}&email={email}"
    display_name = payload.full_name or email
    send_invitation_email(email, display_name, setup_url)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=True,
        status="pending",
        last_login=None,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None
    )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    user: Annotated[dict, Depends(require_permission("users:manage"))],
    db: Session = Depends(get_db)
) -> UserResponse:
    """Update a user's role. Requires users:manage permission."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Fetch user
    target_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = target_user.role
    audit_details: dict = {}

    if payload.role != old_role:
        target_user.role = payload.role
        audit_details["old_role"] = old_role
        audit_details["new_role"] = payload.role

    if payload.full_name is not None:
        target_user.full_name = payload.full_name

    if payload.is_active is not None:
        old_active = getattr(target_user, "is_active", True)
        target_user.is_active = payload.is_active
        audit_details["is_active"] = payload.is_active
        if not payload.is_active and old_active:
            audit_details["action_detail"] = "user_deactivated"

    db.commit()

    if audit_details:
        _write_audit_log(
            db, tenant_id, actor_user_id, actor_email, "user.updated", "user",
            resource_id=user_id, details=audit_details
        )

    if not target_user.password_hash:
        status = "pending"
    elif not getattr(target_user, "is_active", True):
        status = "deactivated"
    else:
        status = "active"

    last_login_str = target_user.last_login.isoformat() if target_user.last_login else None
    created_at_str = target_user.created_at.isoformat() if target_user.created_at else None

    return UserResponse(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_user.role,
        is_active=getattr(target_user, "is_active", True),
        status=status,
        last_login=last_login_str,
        created_at=created_at_str
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    user: Annotated[dict, Depends(require_permission("users:manage"))],
    db: Session = Depends(get_db)
) -> dict:
    """Delete a user. Requires users:manage permission. Cannot delete self or last admin."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Cannot delete self
    if user_id == actor_user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Fetch user
    target_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if this is the last admin (block deletion to prevent lockout)
    if target_user.role == "admin":
        admin_count = db.query(User).filter(User.tenant_id == tenant_id, User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin user")

    db.delete(target_user)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "user.deleted", "user",
        resource_id=user_id, details={"deleted_email": target_user.email}
    )
    db.commit()

    return {"status": "ok", "message": "User deleted"}


@router.post("/users/{user_id}/resend-invitation")
def resend_invitation(
    user_id: str,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> dict:
    """Resend invitation email to pending user."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Fetch user
    target_user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == tenant_id
    ).one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if user is in pending state (no password)
    if target_user.password_hash:
        raise HTTPException(status_code=400, detail="User already activated")

    # Generate invitation token (valid for 1 hour)
    invitation_token = create_reset_token(target_user.id)

    # Send invitation email with password setup link
    base_url = os.getenv("VETRAI_BASE_URL", "http://localhost:3000")
    setup_url = f"{base_url}/reset-password?token={invitation_token}&email={target_user.email}"
    display_name = getattr(target_user, "full_name", None) or target_user.email
    send_invitation_email(target_user.email, display_name, setup_url)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email,
        "user.invitation_resent", "user",
        resource_id=user_id,
        details={"email": target_user.email}
    )
    db.commit()

    return {"status": "ok", "message": f"Invitation resent to {target_user.email}"}


@router.get("/users/{user_id}/workspaces")
def get_user_workspaces(
    user_id: str,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> dict:
    """Get workspaces assigned to a user."""
    from models import UserPreference, TenantResource

    tenant_id = user.get("tenant_id")

    # Fetch user to verify it exists
    target_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Get workspace preferences for the user (pref_key = workspace_role_{workspace_id})
    workspace_prefs = db.query(UserPreference).filter(
        UserPreference.tenant_id == tenant_id,
        UserPreference.user_id == user_id,
        UserPreference.pref_key.like("workspace_role_%")
    ).all()

    # Get workspace details
    workspaces = []
    for pref in workspace_prefs:
        workspace_id = pref.pref_key.replace("workspace_role_", "")
        workspace = db.query(TenantResource).filter(
            TenantResource.id == workspace_id,
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "workspace"
        ).one_or_none()

        if workspace:
            workspaces.append({
                "id": workspace.id,
                "name": workspace.name,
                "role": pref.pref_value.get("role", "member") if pref.pref_value else "member"
            })

    return {"data": workspaces}


@router.get("/users/export/csv")
def export_users_csv(
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
):
    """Export all users as CSV file. Requires admin role."""
    tenant_id = user.get("tenant_id")

    users = db.query(User).filter(User.tenant_id == tenant_id).all()

    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['Email', 'Role', 'Status', 'Last Login', 'Created Date'])

    for u in users:
        status = "active" if u.password_hash else "pending"
        last_login = u.last_login.isoformat() if u.last_login else "Never"
        created_at = u.created_at.isoformat() if u.created_at else ""

        writer.writerow([u.email, u.role, status, last_login, created_at])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"}
    )
