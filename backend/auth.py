import os
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from database import get_db
from models import Tenant, User, AuditLog

router = APIRouter()
security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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


def decode_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    missing_claims = [claim for claim in REQUIRED_TOKEN_CLAIMS if claim not in claims]
    if missing_claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
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
    allowed = set(roles)

    def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
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
    payload: dict[str, any],
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
