from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import require_roles, _write_audit_log
from database import get_db
from models import User, Tenant

router = APIRouter()


class UserInviteRequest(BaseModel):
    email: EmailStr
    role: str = "viewer"


class UserUpdateRequest(BaseModel):
    role: str


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    status: str  # active or pending
    last_login: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


class UsersListResponse(BaseModel):
    data: list[UserResponse]
    total: int


@router.get("/users", response_model=UsersListResponse)
def list_users(
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> UsersListResponse:
    """List all users in the tenant. Requires admin role."""
    tenant_id = user.get("tenant_id")

    users = db.query(User).filter(User.tenant_id == tenant_id).offset(skip).limit(limit).all()
    total = db.query(User).filter(User.tenant_id == tenant_id).count()

    user_responses = []
    for u in users:
        # Status is "active" if password_hash exists, "pending" if invited but no password
        status = "active" if u.password_hash else "pending"
        last_login_str = u.last_login.isoformat() if u.last_login else None
        created_at_str = u.created_at.isoformat() if u.created_at else None

        user_responses.append(
            UserResponse(
                id=u.id,
                email=u.email,
                role=u.role,
                status=status,
                last_login=last_login_str,
                created_at=created_at_str
            )
        )

    return UsersListResponse(data=user_responses, total=total)


@router.post("/users/invite", response_model=UserResponse)
def invite_user(
    payload: UserInviteRequest,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> UserResponse:
    """Invite a new user to the tenant. Requires admin role."""
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
        password_hash=None,  # Invited users have no password yet
        role=payload.role
    )
    db.add(new_user)

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "user.invited", "user",
        resource_id=new_user.id, details={"invited_email": email, "invited_role": payload.role}
    )
    db.commit()

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        status="pending",
        last_login=None,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None
    )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> UserResponse:
    """Update a user's role. Requires admin role."""
    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Fetch user
    target_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = target_user.role
    target_user.role = payload.role
    db.commit()

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "user.role_changed", "user",
        resource_id=user_id, details={"old_role": old_role, "new_role": payload.role}
    )

    status = "active" if target_user.password_hash else "pending"
    last_login_str = target_user.last_login.isoformat() if target_user.last_login else None
    created_at_str = target_user.created_at.isoformat() if target_user.created_at else None

    return UserResponse(
        id=target_user.id,
        email=target_user.email,
        role=target_user.role,
        status=status,
        last_login=last_login_str,
        created_at=created_at_str
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> dict:
    """Delete a user. Requires admin role. Cannot delete self or last admin."""
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

    # TODO: Send invitation email via email service
    # send_invitation_email(target_user.email, tenant_id, target_user.id)

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
    """Get workspaces assigned to a user. Stub returning empty for now."""
    tenant_id = user.get("tenant_id")

    # Fetch user to verify it exists
    target_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # TODO: Implement workspace assignment when workspace model is created
    return {"data": []}
