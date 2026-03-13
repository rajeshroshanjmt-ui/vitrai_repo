import os

import redis
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from agent_guardrails import router as agent_router
from auth import router as auth_router
from flows import router as flow_router
from platform_compat import router as platform_compat_router
from resources import router as resources_router
from users import router as users_router
from files import router as files_router
from workspace import router as workspace_router
from database import Base, engine

app = FastAPI(title="Vetrai Backend", version="1.0.0")
readiness_redis = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    decode_responses=True,
)

# CORS configuration: restrict to specific origins
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
if APP_ENV in {"dev", "development", "local", "test", "testing"}:
    allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost", "http://127.0.0.1"]
else:
    allowed_origins = [os.getenv("FRONTEND_ORIGIN", "https://app.vetrai.tech")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_email_ci ON users(tenant_id, lower(email))"))
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_resource_type_created_at "
                "ON audit_logs(tenant_id, resource_type, created_at DESC)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_resource_type_action_created_at "
                "ON audit_logs(tenant_id, resource_type, action, created_at DESC)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_resource_type_resource_id_created_at "
                "ON audit_logs(tenant_id, resource_type, resource_id, created_at DESC)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_tenant_resources_tenant_type_updated_at "
                "ON tenant_resources(tenant_id, resource_type, updated_at DESC)"
            )
        )


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, tags=["users"])
app.include_router(files_router, tags=["files"])
app.include_router(workspace_router, tags=["workspace"])
app.include_router(flow_router, prefix="/flows", tags=["flows"])
app.include_router(agent_router, prefix="/agent", tags=["agent"])
app.include_router(resources_router, prefix="/resources", tags=["resources"])
app.include_router(platform_compat_router, tags=["platform-compat"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready() -> dict:
    checks: dict[str, str] = {"database": "unknown", "redis": "unknown"}
    status = "ok"

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        status = "degraded"

    try:
        readiness_redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
        status = "degraded"

    payload = {"status": status, "checks": checks}
    if status != "ok":
        raise HTTPException(status_code=503, detail=payload)
    return payload
