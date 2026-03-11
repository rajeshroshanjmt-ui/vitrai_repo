import os
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Tenant, User

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
        raise HTTPException(status_code=401, detail="Invalid credentials")

    tenant = db.get(Tenant, payload.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = (
        db.query(User)
        .filter(User.tenant_id == payload.tenant_id, func.lower(User.email) == email)
        .one_or_none()
    )
    if user is None or user.password_hash is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

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
