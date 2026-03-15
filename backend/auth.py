import os
import json
import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import uuid4

import httpx
import redis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from database import get_db
from models import Tenant, User, AuditLog, UserPreference

router = APIRouter()
security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)

SECRET = os.getenv("JWT_SECRET", "change-me")
APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", os.getenv("ENV", "development"))).strip().lower()
ALGORITHM = "HS256"
ALLOWED_ROLES = {"admin", "editor", "viewer"}
REQUIRED_TOKEN_CLAIMS = {"sub", "tenant_id", "role", "user_id"}
LOCAL_ENV_NAMES = {"dev", "development", "local", "test", "testing", "ci"}
WEAK_JWT_SECRETS = {"", "change-me", "change-me-in-production", "replace-with-strong-secret"}
MIN_JWT_SECRET_LENGTH = 16


def _ensure_secure_jwt_secret(secret: str, app_env: str) -> None:
    if app_env in LOCAL_ENV_NAMES:
        return
    normalized = secret.strip()
    if normalized in WEAK_JWT_SECRETS or len(normalized) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError("JWT_SECRET must be a strong non-default value outside dev/test environments")


def _load_token_ttl_minutes() -> int:
    raw_value = os.getenv("JWT_TTL_MINUTES", "720")
    try:
        ttl = int(raw_value)
    except ValueError:
        return 720
    return max(ttl, 1)


TOKEN_TTL_MINUTES = _load_token_ttl_minutes()
_ensure_secure_jwt_secret(SECRET, APP_ENV)

# Token blacklist configuration
TOKEN_BLACKLIST_PREFIX = "token_blacklist:"
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Initialize Redis client for token blacklist
_redis_client = None

def _get_redis_client() -> redis.Redis:
    """Get or create Redis client for token blacklist."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30
            )
            # Test connection
            _redis_client.ping()
            logger.info(f"Redis token blacklist connected: {REDIS_HOST}:{REDIS_PORT}")
        except Exception as e:
            logger.warning(f"Redis connection failed for token blacklist: {e}. Logout will not revoke tokens.")
            _redis_client = None
    return _redis_client

def _add_token_to_blacklist(token: str, ttl_minutes: int) -> bool:
    """Add JWT token to blacklist (revoke it). Returns True if successful."""
    try:
        client = _get_redis_client()
        if not client:
            logger.warning("Redis unavailable: token not added to blacklist")
            return False

        # Use token JTI (unique identifier) as key
        # If no JTI in token, use token hash as key
        try:
            claims = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
            token_id = claims.get("jti", token[:16])
        except:
            token_id = token[:16]

        key = f"{TOKEN_BLACKLIST_PREFIX}{token_id}"
        ttl_seconds = ttl_minutes * 60

        # Set in Redis with expiration
        client.setex(key, ttl_seconds, "revoked")
        logger.info(f"Token added to blacklist: {token_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to add token to blacklist: {e}")
        return False

def _is_token_blacklisted(token: str) -> bool:
    """Check if token is in blacklist (revoked). Returns True if revoked."""
    try:
        client = _get_redis_client()
        if not client:
            # If Redis unavailable, allow token (fail open for availability)
            return False

        # Get token ID
        try:
            claims = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
            token_id = claims.get("jti", token[:16])
        except:
            token_id = token[:16]

        key = f"{TOKEN_BLACKLIST_PREFIX}{token_id}"
        return client.exists(key) > 0
    except Exception as e:
        logger.error(f"Failed to check token blacklist: {e}")
        # If error checking blacklist, allow token (fail open)
        return False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_id: str
    role: str = "viewer"


class TokenRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_id: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginActivityRequest(BaseModel):
    startDate: str | None = None
    endDate: str | None = None
    action: str | None = None
    email: str | None = None


class LoginActivityItem(BaseModel):
    id: str
    actorEmail: str | None
    actorRole: str | None
    action: str
    createdAt: str
    details: dict | None = None


class LoginActivityResponse(BaseModel):
    data: list[LoginActivityItem]
    total: int


def create_token(payload: dict) -> str:
    body = payload.copy()
    body["exp"] = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES)
    return jwt.encode(body, SECRET, algorithm=ALGORITHM)


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty")
    hashed = pwd_context.hash(password)
    if not hashed:
        raise ValueError("Password hashing failed - no hash returned")
    return hashed


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _get_active_workspace(db: Session, tenant_id: str, user_id: str) -> str | None:
    """Get the user's active workspace ID. Returns None if no workspace is set."""
    pref = (
        db.query(UserPreference)
        .filter(
            UserPreference.tenant_id == tenant_id,
            UserPreference.user_id == user_id,
            UserPreference.pref_key == "active_workspace",
        )
        .one_or_none()
    )
    if pref and pref.pref_value:
        return pref.pref_value.get("workspace_id")
    return None


def decode_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    missing_claims = [claim for claim in REQUIRED_TOKEN_CLAIMS if claim not in claims]
    if missing_claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Check if token has been revoked (blacklisted)
    if _is_token_blacklisted(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    return claims


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing auth token")
    return decode_token(credentials.credentials)


def _write_audit_log(
    db: Session,
    tenant_id: str,
    actor_user_id: str | None,
    actor_email: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict | None = None
) -> AuditLog:
    """Write an audit log entry."""
    audit_log = AuditLog(
        id=str(uuid4()),
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        actor_email=actor_email,
        actor_role=None,  # Will be fetched if needed
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {}
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def require_roles(*roles: str):
    """Legacy role-based access control (admin/editor/viewer).

    For fine-grained permission checks, use require_permission() instead.
    """
    allowed = set(roles)

    def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return dependency


def require_permission(*permission_strings: str):
    """Fine-grained permission-based access control.

    Checks against Role/RolePermission tables for actual permissions.
    Falls back to simple role checks for backward compatibility.

    Example:
        @router.get("/users")
        def list_users(user: Annotated[dict, Depends(require_permission("users:view"))]):
            ...
    """
    allowed_perms = set(permission_strings)

    def dependency(user: Annotated[dict, Depends(get_current_user)], db: Session = Depends(get_db)) -> dict:
        from models import User, Role, Permission, RolePermission

        tenant_id = user.get("tenant_id")
        user_id = user.get("user_id")

        # Fetch the user
        db_user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).one_or_none()
        if db_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        # Try to find custom role first
        role = db.query(Role).filter(Role.id == db_user.role, Role.tenant_id == tenant_id).one_or_none()

        if role:
            # User has a custom role - check fine-grained permissions
            role_permissions = db.query(Permission).join(
                RolePermission, RolePermission.permission_id == Permission.id
            ).filter(RolePermission.role_id == role.id).all()

            user_permissions = {p.name for p in role_permissions}

            # Check if user has any of the required permissions
            if not user_permissions.intersection(allowed_perms):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        else:
            # Fall back to simple role checks for system roles
            system_role = db_user.role
            if system_role == "admin":
                # Admin has all permissions
                pass
            elif system_role == "editor":
                # Editor can do write operations, deny admin-only operations
                admin_perms = {"users:manage", "workspace:delete", "workspace:unlink-user", "sso:manage"}
                if allowed_perms.intersection(admin_perms):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
            elif system_role == "viewer":
                # Viewer only has read permissions
                if not all(":view" in perm for perm in allowed_perms):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
            else:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown role")

        return user

    return dependency


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Unsupported role")
    email = payload.email.lower()

    # Validate password length (bcrypt has a 72-byte limit)
    if len(payload.password.encode('utf-8')) > 72:
        raise HTTPException(status_code=400, detail="Password is too long (max 72 bytes)")

    tenant = db.get(Tenant, payload.tenant_id)
    if tenant is None:
        tenant = Tenant(id=payload.tenant_id, name=f"tenant-{payload.tenant_id[:8]}")
        db.add(tenant)

    user = (
        db.query(User)
        .filter(User.tenant_id == payload.tenant_id, func.lower(User.email) == email)
        .one_or_none()
    )
    if user is not None:
        raise HTTPException(status_code=400, detail="User already exists")

    try:
        password_hash = hash_password(payload.password)
    except Exception as hash_error:
        raise HTTPException(status_code=500, detail=f"Password hashing failed: {str(hash_error)}")

    if not password_hash:
        raise HTTPException(status_code=500, detail="Password hash is empty")

    user = User(id=str(uuid4()), tenant_id=payload.tenant_id, email=email, password_hash=password_hash, role=payload.role)
    db.add(user)
    db.commit()

    token = create_token(
        {
            "sub": email,
            "tenant_id": payload.tenant_id,
            "role": payload.role,
            "user_id": user.id,
        }
    )
    return TokenResponse(access_token=token)


@router.post("/token", response_model=TokenResponse)
def issue_token(payload: TokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower()

    # Validate password length (bcrypt has a 72-byte limit)
    if len(payload.password.encode('utf-8')) > 72:
        # Log failed login attempt
        _write_audit_log(db, payload.tenant_id, None, None, "login_failed", "auth", details={"reason": "invalid_password"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    tenant = db.get(Tenant, payload.tenant_id)
    if tenant is None:
        _write_audit_log(db, payload.tenant_id, None, None, "login_failed", "auth", details={"reason": "tenant_not_found"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = (
        db.query(User)
        .filter(User.tenant_id == payload.tenant_id, func.lower(User.email) == email)
        .one_or_none()
    )
    if user is None or user.password_hash is None:
        _write_audit_log(db, payload.tenant_id, None, email, "login_failed", "auth", details={"reason": "user_not_found"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        _write_audit_log(db, payload.tenant_id, user.id, email, "login_failed", "auth", details={"reason": "invalid_password"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Log successful login and update last_login
    _write_audit_log(db, payload.tenant_id, user.id, email, "login", "auth")
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_token(
        {
            "sub": email,
            "tenant_id": payload.tenant_id,
            "role": user.role,
            "user_id": user.id,
        }
    )
    return TokenResponse(access_token=token)


@router.get("/me")
def me(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return {
        "email": user.get("sub"),
        "tenant_id": user.get("tenant_id"),
        "role": user.get("role"),
        "user_id": user.get("user_id"),
    }


@router.post("/logout")
def logout(
    user: Annotated[dict, Depends(get_current_user)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Session = Depends(get_db)
) -> dict:
    """Logout endpoint. Revokes token and logs the logout action for audit."""
    tenant_id = user.get("tenant_id")
    user_id = user.get("user_id")
    email = user.get("sub")

    # Revoke the token by adding it to the blacklist
    if credentials and credentials.credentials:
        token_added = _add_token_to_blacklist(credentials.credentials, TOKEN_TTL_MINUTES)
        if not token_added:
            logger.warning(f"Failed to revoke token for user {email} in tenant {tenant_id}")

    # Log the logout action for audit trail
    _write_audit_log(db, tenant_id, user_id, email, "logout", "auth", details={"token_revoked": True})

    return {"message": "Logged out successfully. Token has been revoked."}


def _get_permissions_for_role(role: str) -> list:
    """Return permission list based on user role."""
    all_permissions = [
        'chatflows:view', 'chatflows:create', 'chatflows:edit', 'chatflows:delete',
        'chatflows:export', 'chatflows:import', 'chatflows:duplicate', 'chatflows:config',
        'agentflows:view', 'agentflows:create', 'agentflows:edit', 'agentflows:delete',
        'executions:view',
        'assistants:view', 'assistants:create', 'assistants:edit', 'assistants:delete',
        'templates:marketplace', 'templates:custom', 'templates:custom-share', 'templates:flowexport',
        'tools:view', 'tools:create', 'tools:edit', 'tools:delete',
        'credentials:view', 'credentials:create', 'credentials:edit', 'credentials:share', 'credentials:delete',
        'variables:view', 'variables:create', 'variables:update', 'variables:delete',
        'apikeys:view', 'apikeys:create', 'apikeys:update', 'apikeys:delete',
        'documentStores:view', 'documentStores:create', 'documentStores:edit', 'documentStores:delete',
        'datasets:view', 'datasets:create', 'datasets:update', 'datasets:delete',
        'evaluators:view', 'evaluators:create', 'evaluators:update', 'evaluators:delete',
        'evaluations:view', 'evaluations:create', 'evaluations:update', 'evaluations:delete',
        'logs:view',
        'users:manage',
        'workspace:view', 'workspace:create', 'workspace:update', 'workspace:delete',
        'workspace:add-user', 'workspace:unlink-user', 'workspace:export', 'workspace:import'
    ]

    if role == 'admin':
        return all_permissions
    elif role == 'editor':
        # Remove user/workspace admin permissions
        excluded = {'users:manage', 'workspace:delete', 'workspace:unlink-user'}
        return [p for p in all_permissions if p not in excluded]
    else:  # viewer
        # Only view permissions
        return [p for p in all_permissions if ':view' in p or p == 'logs:view']


@router.get("/permissions")
def get_permissions(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Return permissions and features based on user role."""
    role = user.get("role", "viewer")
    permissions = _get_permissions_for_role(role)

    features = {
        'feat:datasets': True,
        'feat:evaluators': True,
        'feat:evaluations': True,
        'feat:logs': True,
        'feat:files': True,
        'feat:account': True,
        'feat:sso-config': True,
        'feat:roles': role == 'admin',
        'feat:users': role == 'admin',
        'feat:workspaces': role in ('admin', 'editor'),
        'feat:login-activity': role == 'admin'
    }

    return {
        "permissions": permissions,
        "features": features
    }


@router.post("/audit/login-activity", response_model=LoginActivityResponse)
def get_login_activity(
    payload: LoginActivityRequest,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> LoginActivityResponse:
    """Get login activity audit logs for the tenant."""
    tenant_id = user.get("tenant_id")

    # Build query filters
    filters = [
        AuditLog.tenant_id == tenant_id,
        AuditLog.action.in_(["login", "login_failed"])
    ]

    # Optional date range filter
    if payload.startDate:
        from datetime import datetime as dt
        start = dt.fromisoformat(payload.startDate.replace('Z', '+00:00'))
        filters.append(AuditLog.created_at >= start)

    if payload.endDate:
        from datetime import datetime as dt
        end = dt.fromisoformat(payload.endDate.replace('Z', '+00:00'))
        filters.append(AuditLog.created_at <= end)

    # Optional action filter
    if payload.action:
        filters.append(AuditLog.action == payload.action)

    # Optional email filter
    if payload.email:
        filters.append(AuditLog.actor_email.ilike(f"%{payload.email}%"))

    # Query audit logs
    logs = db.query(AuditLog).filter(and_(*filters)).order_by(AuditLog.created_at.desc()).all()

    items = [
        LoginActivityItem(
            id=log.id,
            actorEmail=log.actor_email,
            actorRole=log.actor_role,
            action=log.action,
            createdAt=log.created_at.isoformat() if log.created_at else None,
            details=log.details
        )
        for log in logs
    ]

    return LoginActivityResponse(data=items, total=len(items))


# SSO Configuration Endpoints
class SSOConfigRequest(BaseModel):
    provider: str  # azure, google, github, auth0
    clientId: str
    clientSecret: str
    tenantUrl: str | None = None  # For Azure/OAuth2
    enabled: bool = True


class SSOConfigResponse(BaseModel):
    id: str
    provider: str
    clientId: str
    tenantUrl: str | None = None
    enabled: bool
    createdAt: str | None = None
    updatedAt: str | None = None


@router.get("/sso-config")
def get_sso_config(
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> dict:
    """Get SSO configuration for the tenant."""
    from models import TenantResource

    tenant_id = user.get("tenant_id")

    # Query for SSO config in TenantResource
    sso_resources = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "sso_config"
        )
        .all()
    )

    configs = []
    for resource in sso_resources:
        payload = resource.payload or {}
        configs.append({
            "id": resource.id,
            "provider": payload.get("provider", ""),
            "clientId": payload.get("clientId", ""),
            "tenantUrl": payload.get("tenantUrl"),
            "enabled": payload.get("enabled", False),
            "createdAt": resource.created_at.isoformat() if resource.created_at else None,
            "updatedAt": resource.updated_at.isoformat() if resource.updated_at else None,
        })

    return {"data": configs}


@router.put("/sso-config/{provider}")
def update_sso_config(
    provider: str,
    payload: SSOConfigRequest,
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> SSOConfigResponse:
    """Update SSO configuration for a provider."""
    from models import TenantResource

    tenant_id = user.get("tenant_id")
    actor_user_id = user.get("user_id")
    actor_email = user.get("sub")

    # Find existing config
    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == "sso_config",
            TenantResource.name == provider
        )
        .one_or_none()
    )

    if resource is None:
        # Create new
        resource = TenantResource(
            id=str(uuid4()),
            tenant_id=tenant_id,
            resource_type="sso_config",
            name=provider,
            payload={
                "provider": provider,
                "clientId": payload.clientId,
                "clientSecret": payload.clientSecret,
                "tenantUrl": payload.tenantUrl,
                "enabled": payload.enabled
            },
            created_by=actor_user_id,
            updated_by=actor_user_id
        )
        db.add(resource)
    else:
        # Update existing
        resource.payload = {
            "provider": provider,
            "clientId": payload.clientId,
            "clientSecret": payload.clientSecret,
            "tenantUrl": payload.tenantUrl,
            "enabled": payload.enabled
        }
        resource.updated_by = actor_user_id

    # Write audit log
    _write_audit_log(
        db, tenant_id, actor_user_id, actor_email, "sso_config.updated", "auth",
        resource_id=resource.id, details={"provider": provider, "enabled": payload.enabled}
    )

    db.commit()

    return SSOConfigResponse(
        id=resource.id,
        provider=provider,
        clientId=payload.clientId,
        tenantUrl=payload.tenantUrl,
        enabled=payload.enabled,
        createdAt=resource.created_at.isoformat() if resource.created_at else None,
        updatedAt=resource.updated_at.isoformat() if resource.updated_at else None,
    )


@router.post("/sso-config/{provider}/test")
def test_sso_config(
    provider: str,
    payload: dict[str, Any],
    user: Annotated[dict, Depends(require_roles("admin"))],
    db: Session = Depends(get_db)
) -> dict:
    """Test SSO configuration by validating OIDC discovery endpoint."""
    import httpx

    tenant_url = payload.get("tenantUrl", "")
    if not tenant_url:
        return {"valid": False, "error": "tenantUrl is required"}

    try:
        # Try to fetch OIDC discovery endpoint
        discovery_url = f"{tenant_url}/.well-known/openid-configuration"
        response = httpx.get(discovery_url, timeout=10.0)
        response.raise_for_status()

        # If successful, config is valid
        return {"valid": True, "message": "SSO configuration is valid"}
    except Exception as e:
        return {"valid": False, "error": f"Failed to validate SSO config: {str(e)}"}


# Password Reset Endpoints
class PasswordResetRequestPayload(BaseModel):
    email: EmailStr
    tenant_id: str


class PasswordResetConfirmPayload(BaseModel):
    token: str
    new_password: str


RESET_TOKEN_TTL_MINUTES = 60  # Password reset tokens valid for 1 hour


def create_reset_token(user_id: str) -> str:
    """Create a short-lived JWT token for password reset."""
    body = {
        "sub": user_id,
        "type": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
    }
    return jwt.encode(body, SECRET, algorithm=ALGORITHM)


def decode_reset_token(token: str) -> dict | None:
    """Decode and validate a password reset token."""
    try:
        claims = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        if claims.get("type") != "password_reset":
            return None
        return claims
    except JWTError:
        return None


@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequestPayload,
    db: Session = Depends(get_db)
) -> dict:
    """Request a password reset token. Send token to user via email."""
    email = payload.email.lower()

    tenant = db.get(Tenant, payload.tenant_id)
    if tenant is None:
        # Don't reveal if tenant exists
        return {"message": "If the email is associated with an account, a reset token has been sent"}

    user = (
        db.query(User)
        .filter(User.tenant_id == payload.tenant_id, func.lower(User.email) == email)
        .one_or_none()
    )

    if user is None:
        # Don't reveal if user exists
        _write_audit_log(db, payload.tenant_id, None, email, "password_reset_failed", "auth",
                         details={"reason": "user_not_found"})
        return {"message": "If the email is associated with an account, a reset token has been sent"}

    # Generate reset token
    reset_token = create_reset_token(user.id)

    # Log the reset request
    _write_audit_log(db, payload.tenant_id, user.id, email, "password_reset_requested", "auth")

    # Send password reset email
    from email_service import send_password_reset_email
    send_password_reset_email(email, reset_token)

    # Always return the same response to not leak user existence
    return {"message": "If the email is associated with an account, a reset token has been sent"}


@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirmPayload,
    db: Session = Depends(get_db)
) -> TokenResponse:
    """Confirm password reset with the reset token and new password."""
    # Validate reset token
    claims = decode_reset_token(payload.token)
    if claims is None:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid reset token")

    # Validate password length
    if len(payload.new_password.encode('utf-8')) > 72:
        raise HTTPException(status_code=400, detail="Password is too long (max 72 bytes)")

    # Get user and update password
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid reset token")

    try:
        user.password_hash = hash_password(payload.new_password)
    except Exception as hash_error:
        raise HTTPException(status_code=500, detail=f"Password update failed: {str(hash_error)}")

    db.commit()

    # Log successful password reset
    _write_audit_log(db, user.tenant_id, user.id, user.email, "password_reset_completed", "auth")

    # Return a new auth token so user is logged in after reset
    token = create_token({
        "sub": user.email,
        "tenant_id": user.tenant_id,
        "role": user.role,
        "user_id": user.id,
    })

    return TokenResponse(access_token=token)


# OAuth/SSO Callback Handlers
def _parse_id_token(id_token: str) -> dict | None:
    """Parse and decode JWT ID token without signature verification (for now)."""
    try:
        # ID tokens are in the format: header.payload.signature
        parts = id_token.split('.')
        if len(parts) != 3:
            return None

        # Decode the payload (second part)
        payload = parts[1]
        # Add padding if needed
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding

        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception as e:
        logger.error(f"Failed to parse ID token: {str(e)}")
        return None


def _exchange_oauth_code(code: str, sso_config: dict, redirect_uri: str) -> dict | None:
    """Exchange OAuth authorization code for ID token via OIDC token endpoint."""
    try:
        provider = sso_config.get("provider", "").lower()
        client_id = sso_config.get("clientId")
        client_secret = sso_config.get("clientSecret")
        tenant_url = sso_config.get("tenantUrl")

        if not all([client_id, client_secret, tenant_url]):
            logger.error("Incomplete SSO configuration")
            return None

        # Determine token endpoint based on provider
        token_endpoint = None
        if provider in ["azure", "entra"]:
            token_endpoint = f"{tenant_url}/oauth2/v2.0/token"
        elif provider == "google":
            token_endpoint = "https://oauth2.googleapis.com/token"
        elif provider == "github":
            token_endpoint = "https://github.com/login/oauth/access_token"
        elif provider == "auth0":
            token_endpoint = f"{tenant_url}/oauth/token"
        else:
            # Generic OIDC - try discovery endpoint
            token_endpoint = f"{tenant_url}/oauth/token"

        # Exchange code for token
        token_response = httpx.post(
            token_endpoint,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=10.0
        )

        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            return None

        token_data = token_response.json()
        return token_data
    except Exception as e:
        logger.error(f"OAuth token exchange failed: {str(e)}")
        return None


@router.get("/callback")
def oauth_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db)
):
    """OAuth callback endpoint - called by provider after user authentication."""
    from models import TenantResource

    # Get frontend redirect URL
    frontend_url = os.getenv("VETRAI_BASE_URL", "http://localhost:3000")

    # Handle errors from provider
    if error:
        error_description = f"OAuth error: {error}"
        logger.warning(error_description)
        return RedirectResponse(url=f"{frontend_url}/login?error={error}")

    if not code:
        logger.warning("OAuth callback received without authorization code")
        return RedirectResponse(url=f"{frontend_url}/login?error=no_code")

    # Note: In production, validate state parameter for CSRF protection
    # For now, we accept any valid code (state validation would require session storage)

    try:
        # Determine tenant from state or use default tenant (for multi-tenant, state would include tenant_id)
        # For now, we'll need the tenant_id to be provided or stored with the state
        # Default to first tenant for simplicity - in production, state would encode tenant_id
        tenant = db.query(Tenant).first()
        if not tenant:
            logger.error("No tenant found for OAuth callback")
            return RedirectResponse(url=f"{frontend_url}/login?error=no_tenant")

        # Find enabled SSO config for this tenant
        sso_configs = (
            db.query(TenantResource)
            .filter(
                TenantResource.tenant_id == tenant.id,
                TenantResource.resource_type == "sso_config"
            )
            .all()
        )

        if not sso_configs:
            logger.error(f"No SSO config found for tenant {tenant.id}")
            return RedirectResponse(url=f"{frontend_url}/login?error=no_sso_config")

        # Find enabled config
        enabled_config = None
        for config in sso_configs:
            if config.payload and config.payload.get("enabled"):
                enabled_config = config
                break

        if not enabled_config:
            logger.error(f"No enabled SSO config for tenant {tenant.id}")
            return RedirectResponse(url=f"{frontend_url}/login?error=sso_disabled")

        # Exchange code for ID token
        redirect_uri = f"{os.getenv('VETRAI_BASE_URL', 'http://localhost:8000')}/api/auth/callback"
        token_response = _exchange_oauth_code(code, enabled_config.payload, redirect_uri)

        if not token_response:
            logger.error("Failed to exchange OAuth code")
            return RedirectResponse(url=f"{frontend_url}/login?error=token_exchange_failed")

        # Parse ID token
        id_token = token_response.get("id_token")
        if not id_token:
            # Some providers return token_type=Bearer without id_token, try access_token for user info
            logger.warning("No id_token in response, attempting alternative flow")
            # In production, could call user info endpoint here
            return RedirectResponse(url=f"{frontend_url}/login?error=no_id_token")

        id_token_claims = _parse_id_token(id_token)
        if not id_token_claims:
            logger.error("Failed to parse ID token claims")
            return RedirectResponse(url=f"{frontend_url}/login?error=invalid_id_token")

        # Extract user information from ID token
        email = id_token_claims.get("email") or id_token_claims.get("upn") or id_token_claims.get("preferred_username")
        given_name = id_token_claims.get("given_name", "")
        family_name = id_token_claims.get("family_name", "")

        if not email:
            logger.error("No email found in ID token claims")
            return RedirectResponse(url=f"{frontend_url}/login?error=no_email")

        # Ensure tenant exists
        if not tenant:
            tenant = Tenant(id=str(uuid4()), name=f"Tenant-{str(uuid4())[:8]}")
            db.add(tenant)
            db.commit()

        # Find or create user
        user = db.query(User).filter(
            User.email == email,
            User.tenant_id == tenant.id
        ).one_or_none()

        if user is None:
            # Create new user from OAuth claims
            user = User(
                id=str(uuid4()),
                tenant_id=tenant.id,
                email=email,
                full_name=f"{given_name} {family_name}".strip() or email,
                role="editor",  # Default role for OAuth users
                password_hash=None,  # OAuth users don't have password
                is_verified=True,  # OAuth users are pre-verified by provider
            )
            db.add(user)
            db.flush()

            # Log user creation
            _write_audit_log(db, tenant.id, user.id, email, "user_created_oauth", "auth", details={"provider": enabled_config.payload.get("provider")})
        else:
            # Update existing user with latest info from OAuth
            user.full_name = f"{given_name} {family_name}".strip() or user.full_name
            user.is_verified = True
            db.add(user)
            db.flush()

        db.commit()

        # Create JWT token for frontend
        jwt_token = create_token({
            "sub": user.email,
            "tenant_id": user.tenant_id,
            "role": user.role,
            "user_id": user.id,
        })

        # Log successful OAuth login
        _write_audit_log(db, tenant.id, user.id, email, "oauth_login", "auth", details={"provider": enabled_config.payload.get("provider")})

        # Redirect to frontend SSO success page with token
        return RedirectResponse(url=f"{frontend_url}/sso-success?token={jwt_token}")

    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}", exc_info=True)
        return RedirectResponse(url=f"{frontend_url}/login?error=callback_error")


@router.post("/sso-success")
def sso_success_handler(
    token: str,
    db: Session = Depends(get_db)
) -> dict:
    """Validate OAuth token and return user information to frontend."""
    try:
        # Decode and validate JWT token
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])

        user_id = payload.get("user_id")
        tenant_id = payload.get("tenant_id")
        email = payload.get("sub")

        if not all([user_id, tenant_id, email]):
            raise HTTPException(status_code=401, detail="Invalid token claims")

        # Verify user exists
        user = db.query(User).filter(
            User.id == user_id,
            User.tenant_id == tenant_id,
            User.email == email
        ).one_or_none()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # Return user data (similar to login endpoint)
        return {
            "status": 200,
            "data": {
                "user_id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "tenant_id": user.tenant_id,
                "access_token": token,
            }
        }

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"SSO success handler error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
