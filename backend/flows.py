import json
import logging
import os
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Annotated, Any
from uuid import uuid4

import redis
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import AuditLog, ExecutionLog, Flow, FlowVersion, IngestionJob, Tenant, User, UserPreference

router = APIRouter()
logger = logging.getLogger(__name__)

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    decode_responses=True,
)

EXECUTION_QUEUE = os.getenv("EXECUTION_QUEUE", "execution_queue")
INGEST_QUEUE = os.getenv("INGEST_QUEUE", "ingest_queue")
EXECUTION_DLQ = os.getenv("EXECUTION_DLQ", "execution_dlq")
INGESTION_DLQ = os.getenv("INGESTION_DLQ", "ingestion_dlq")
PLAN_LIMIT = int(os.getenv("TENANT_TOKEN_PLAN_LIMIT", "200000"))
BLOCKING_INGEST_STATUSES = {"queued", "processing", "retrying"}
USAGE_DAILY_DAYS = int(os.getenv("USAGE_DAILY_DAYS", "7"))
SUPPORTED_USAGE_WINDOWS = {7, 30}
SLO_EXECUTE_P95_MS = int(os.getenv("SLO_EXECUTE_P95_MS", "300"))
TOOL_STATE_PREF_KEY = "tool_states"
DEFAULT_TOOL_STATES = {
    "calculator": True,
    "sql_tool": True,
    "retriever": True,
    "http_fetch": False,
}


class FlowCreateRequest(BaseModel):
    name: str
    json_definition: dict[str, Any] = Field(default_factory=dict)


class FlowDraftRequest(BaseModel):
    json_definition: dict[str, Any]


class FlowPublishRequest(BaseModel):
    version: int | None = None


class ExecuteRequest(BaseModel):
    input: dict[str, Any]
    enable_tools: bool = True
    wait_for_ingestion: bool = True
    llm_provider: str | None = None
    llm_model: str | None = None


class DocumentChunk(BaseModel):
    text: str
    source: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestRequest(BaseModel):
    documents: list[DocumentChunk]


class DLQReplayRequest(BaseModel):
    redis_index: int = Field(ge=0)
    keep_in_dlq: bool = False
    target_queue: str | None = None


class ToolStateUpdateRequest(BaseModel):
    states: dict[str, bool] = Field(default_factory=dict)


DLQ_QUEUE_MAP = {
    "execution": EXECUTION_DLQ,
    "ingestion": INGESTION_DLQ,
}
PRIMARY_QUEUE_MAP = {
    "execution": EXECUTION_QUEUE,
    "ingestion": INGEST_QUEUE,
}


def _ensure_tenant(db: Session, tenant_id: str) -> None:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        db.add(Tenant(id=tenant_id, name=f"tenant-{tenant_id[:8]}"))
        db.flush()


def _require_tenant_flow(db: Session, tenant_id: str, flow_id: str) -> Flow:
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.tenant_id == tenant_id).one_or_none()
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


def _monthly_tokens(db: Session, tenant_id: str) -> int:
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = (
        db.query(func.coalesce(func.sum(ExecutionLog.tokens_used), 0))
        .join(FlowVersion, FlowVersion.id == ExecutionLog.flow_version_id)
        .join(Flow, Flow.id == FlowVersion.flow_id)
        .filter(Flow.tenant_id == tenant_id, ExecutionLog.created_at >= month_start)
        .scalar()
    )
    return int(total or 0)


def _resolve_dlq(dlq_type: str) -> tuple[str, str]:
    dlq_name = DLQ_QUEUE_MAP.get(dlq_type)
    primary_queue = PRIMARY_QUEUE_MAP.get(dlq_type)
    if not dlq_name or not primary_queue:
        raise HTTPException(status_code=400, detail="Unsupported dlq type")
    return dlq_name, primary_queue


def _remove_redis_entry_by_index(queue_name: str, redis_index: int) -> None:
    marker = f"__dlq_delete__:{uuid4()}"
    try:
        redis_client.lset(queue_name, redis_index, marker)
    except redis.exceptions.ResponseError as exc:
        raise HTTPException(status_code=409, detail="DLQ entry index no longer valid") from exc
    redis_client.lrem(queue_name, 1, marker)


def _append_audit_log(
    db: Session,
    user: dict,
    action: str,
    resource_type: str,
    resource_id: str | None,
    details: dict[str, Any],
) -> None:
    entry = AuditLog(
        id=str(uuid4()),
        tenant_id=user.get("tenant_id"),
        actor_user_id=user.get("user_id"),
        actor_email=user.get("sub"),
        actor_role=user.get("role"),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )
    db.add(entry)
    db.commit()


def _ensure_tenant_user(db: Session, user: dict) -> None:
    tenant_id = user.get("tenant_id")
    user_id = user.get("user_id")
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_row = db.get(User, user_id)
    if user_row is None:
        db.add(
            User(
                id=user_id,
                tenant_id=tenant_id,
                email=(user.get("sub") or f"user-{user_id}@tenant.local"),
                role=(user.get("role") or "viewer"),
            )
        )
        db.flush()
        return

    if user_row.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Invalid tenant scope")


def _normalize_tool_states(states: dict[str, Any] | None) -> dict[str, bool]:
    normalized = dict(DEFAULT_TOOL_STATES)
    if not isinstance(states, dict):
        return normalized
    for tool_id in DEFAULT_TOOL_STATES:
        if tool_id in states:
            normalized[tool_id] = bool(states[tool_id])
    return normalized


def _get_user_tool_states(db: Session, tenant_id: str, user_id: str) -> dict[str, Any]:
    preference = (
        db.query(UserPreference)
        .filter(
            UserPreference.tenant_id == tenant_id,
            UserPreference.user_id == user_id,
            UserPreference.pref_key == TOOL_STATE_PREF_KEY,
        )
        .one_or_none()
    )
    if preference is None:
        return {"states": dict(DEFAULT_TOOL_STATES), "updated_at": None}
    return {
        "states": _normalize_tool_states(preference.pref_value),
        "updated_at": preference.updated_at.isoformat() if preference.updated_at else None,
    }


def _persist_user_tool_states(
    db: Session,
    tenant_id: str,
    user_id: str,
    states: dict[str, Any],
) -> dict[str, Any]:
    normalized = _normalize_tool_states(states)
    now_utc = datetime.now(timezone.utc)
    preference = (
        db.query(UserPreference)
        .filter(
            UserPreference.tenant_id == tenant_id,
            UserPreference.user_id == user_id,
            UserPreference.pref_key == TOOL_STATE_PREF_KEY,
        )
        .one_or_none()
    )
    if preference is None:
        preference = UserPreference(
            id=str(uuid4()),
            tenant_id=tenant_id,
            user_id=user_id,
            pref_key=TOOL_STATE_PREF_KEY,
            pref_value=normalized,
            updated_at=now_utc,
        )
        db.add(preference)
    else:
        preference.pref_value = normalized
        preference.updated_at = now_utc
    db.commit()
    return {
        "states": normalized,
        "updated_at": preference.updated_at.isoformat() if preference.updated_at else None,
    }


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be ISO-8601 datetime (example: 2026-02-19T00:00:00Z)",
        ) from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _compute_percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = ceil((percentile / 100.0) * len(sorted_values)) - 1
    index = max(0, min(index, len(sorted_values) - 1))
    return float(sorted_values[index])


def _build_latency_snapshot(values_ms: list[int]) -> dict[str, Any]:
    samples = [float(value) for value in values_ms if value and value > 0]
    if not samples:
        return {
            "avg": 0.0,
            "p50": 0.0,
            "p95": 0.0,
            "max": 0.0,
            "sample_count": 0,
        }
    return {
        "avg": round(sum(samples) / len(samples), 2),
        "p50": round(_compute_percentile(samples, 50), 2),
        "p95": round(_compute_percentile(samples, 95), 2),
        "max": round(max(samples), 2),
        "sample_count": len(samples),
    }


def _collect_usage_metrics(
    db: Session,
    tenant_id: str,
    now_utc: datetime | None = None,
    trend_days: int | None = None,
) -> dict[str, Any]:
    snapshot_time = now_utc or datetime.now(timezone.utc)
    month_start = snapshot_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day_start = snapshot_time.replace(hour=0, minute=0, second=0, microsecond=0)
    resolved_trend_days = max(1, trend_days if trend_days is not None else USAGE_DAILY_DAYS)

    total_flows = (
        db.query(func.count())
        .select_from(Flow)
        .filter(Flow.tenant_id == tenant_id)
        .scalar()
    )
    published_flows = (
        db.query(func.count(func.distinct(FlowVersion.flow_id)))
        .select_from(FlowVersion)
        .join(Flow, Flow.id == FlowVersion.flow_id)
        .filter(Flow.tenant_id == tenant_id, FlowVersion.is_published.is_(True))
        .scalar()
    )
    executions_today = (
        db.query(func.count())
        .select_from(ExecutionLog)
        .join(FlowVersion, FlowVersion.id == ExecutionLog.flow_version_id)
        .join(Flow, Flow.id == FlowVersion.flow_id)
        .filter(Flow.tenant_id == tenant_id, ExecutionLog.created_at >= day_start)
        .scalar()
    )
    monthly_tokens_used = (
        db.query(func.coalesce(func.sum(ExecutionLog.tokens_used), 0))
        .select_from(ExecutionLog)
        .join(FlowVersion, FlowVersion.id == ExecutionLog.flow_version_id)
        .join(Flow, Flow.id == FlowVersion.flow_id)
        .filter(Flow.tenant_id == tenant_id, ExecutionLog.created_at >= month_start)
        .scalar()
    )

    daily_usage: list[dict[str, Any]] = []
    window_latency_samples: list[int] = []
    for offset in range(resolved_trend_days - 1, -1, -1):
        bucket_start = day_start - timedelta(days=offset)
        bucket_end = bucket_start + timedelta(days=1)
        bucket_tokens = (
            db.query(func.coalesce(func.sum(ExecutionLog.tokens_used), 0))
            .select_from(ExecutionLog)
            .join(FlowVersion, FlowVersion.id == ExecutionLog.flow_version_id)
            .join(Flow, Flow.id == FlowVersion.flow_id)
            .filter(
                Flow.tenant_id == tenant_id,
                ExecutionLog.created_at >= bucket_start,
                ExecutionLog.created_at < bucket_end,
            )
            .scalar()
        )
        bucket_executions = (
            db.query(func.count())
            .select_from(ExecutionLog)
            .join(FlowVersion, FlowVersion.id == ExecutionLog.flow_version_id)
            .join(Flow, Flow.id == FlowVersion.flow_id)
            .filter(
                Flow.tenant_id == tenant_id,
                ExecutionLog.created_at >= bucket_start,
                ExecutionLog.created_at < bucket_end,
            )
            .scalar()
        )
        bucket_latency_rows = (
            db.query(ExecutionLog.execution_time_ms)
            .select_from(ExecutionLog)
            .join(FlowVersion, FlowVersion.id == ExecutionLog.flow_version_id)
            .join(Flow, Flow.id == FlowVersion.flow_id)
            .filter(
                Flow.tenant_id == tenant_id,
                ExecutionLog.created_at >= bucket_start,
                ExecutionLog.created_at < bucket_end,
                ExecutionLog.execution_time_ms > 0,
            )
            .all()
        )
        bucket_latency_samples = [int(row[0]) for row in bucket_latency_rows if row[0]]
        window_latency_samples.extend(bucket_latency_samples)
        bucket_latency = _build_latency_snapshot(bucket_latency_samples)
        daily_usage.append(
            {
                "date": bucket_start.date().isoformat(),
                "tokens_used": int(bucket_tokens or 0),
                "executions": int(bucket_executions or 0),
                "avg_latency_ms": bucket_latency["avg"],
                "p95_latency_ms": bucket_latency["p95"],
                "latency_sample_count": bucket_latency["sample_count"],
            }
        )
    daily_tokens = [
        {"date": row["date"], "tokens_used": row["tokens_used"]}
        for row in daily_usage
    ]
    latency_ms = _build_latency_snapshot(window_latency_samples)

    return {
        "total_flows": int(total_flows or 0),
        "published_flows": int(published_flows or 0),
        "executions_today": int(executions_today or 0),
        "monthly_tokens_used": int(monthly_tokens_used or 0),
        "daily_usage": daily_usage,
        "daily_tokens": daily_tokens,
        "latency_ms": latency_ms,
    }


def _resolve_usage_window(days: int | None) -> int:
    if days is None:
        return max(1, USAGE_DAILY_DAYS)
    if days not in SUPPORTED_USAGE_WINDOWS:
        supported = ", ".join(str(item) for item in sorted(SUPPORTED_USAGE_WINDOWS))
        raise HTTPException(status_code=400, detail=f"days must be one of: {supported}")
    return int(days)


def _collect_queue_depth() -> dict[str, int]:
    try:
        execution_queue = int(redis_client.llen(EXECUTION_QUEUE))
        ingestion_queue = int(redis_client.llen(INGEST_QUEUE))
        execution_dlq = int(redis_client.llen(EXECUTION_DLQ))
        ingestion_dlq = int(redis_client.llen(INGESTION_DLQ))
    except Exception:
        return {
            "execution_queue": 0,
            "ingestion_queue": 0,
            "execution_dlq": 0,
            "ingestion_dlq": 0,
            "total": 0,
        }

    return {
        "execution_queue": execution_queue,
        "ingestion_queue": ingestion_queue,
        "execution_dlq": execution_dlq,
        "ingestion_dlq": ingestion_dlq,
        "total": execution_queue + ingestion_queue + execution_dlq + ingestion_dlq,
    }


@router.post("/create")
def create_flow(
    body: FlowCreateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    tenant_id = user["tenant_id"]
    _ensure_tenant(db, tenant_id)

    flow = Flow(id=str(uuid4()), tenant_id=tenant_id, name=body.name)
    db.add(flow)

    version = FlowVersion(
        id=str(uuid4()),
        flow_id=flow.id,
        version=1,
        json_definition=body.json_definition,
        is_published=False,
    )
    db.add(version)
    db.commit()
    return {"flow_id": flow.id, "draft_version_id": version.id, "version": 1}


@router.put("/{flow_id}/draft")
def save_draft(
    flow_id: str,
    body: FlowDraftRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    flow = _require_tenant_flow(db, user["tenant_id"], flow_id)
    current_max = (
        db.query(func.coalesce(func.max(FlowVersion.version), 0))
        .filter(FlowVersion.flow_id == flow.id)
        .scalar()
    )
    next_version = int(current_max) + 1

    version = FlowVersion(
        id=str(uuid4()),
        flow_id=flow.id,
        version=next_version,
        json_definition=body.json_definition,
        is_published=False,
    )
    db.add(version)
    db.commit()
    return {"flow_id": flow.id, "draft_version_id": version.id, "version": next_version}


@router.post("/{flow_id}/publish")
def publish_flow(
    flow_id: str,
    body: FlowPublishRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    flow = _require_tenant_flow(db, user["tenant_id"], flow_id)
    query = db.query(FlowVersion).filter(FlowVersion.flow_id == flow.id)

    if body.version is None:
        target = query.order_by(FlowVersion.version.desc()).first()
    else:
        target = query.filter(FlowVersion.version == body.version).one_or_none()

    if target is None:
        raise HTTPException(status_code=404, detail="Version not found")

    query.update({FlowVersion.is_published: False})
    target.is_published = True
    db.commit()

    return {"flow_id": flow.id, "published_version": target.version, "flow_version_id": target.id}


@router.post("/{flow_id}/execute")
def execute_flow(
    flow_id: str,
    body: ExecuteRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    flow = _require_tenant_flow(db, user["tenant_id"], flow_id)
    published = (
        db.query(FlowVersion)
        .filter(FlowVersion.flow_id == flow.id, FlowVersion.is_published.is_(True))
        .order_by(FlowVersion.version.desc())
        .first()
    )
    if published is None:
        raise HTTPException(status_code=400, detail="No published version")

    tenant_tokens = _monthly_tokens(db, user["tenant_id"])
    if tenant_tokens >= PLAN_LIMIT:
        raise HTTPException(status_code=402, detail="Plan limit exceeded")

    if body.wait_for_ingestion:
        latest_ingestion = (
            db.query(IngestionJob)
            .filter(
                IngestionJob.tenant_id == user["tenant_id"],
                IngestionJob.flow_id == flow.id,
            )
            .order_by(IngestionJob.created_at.desc())
            .first()
        )
        if latest_ingestion and latest_ingestion.status in BLOCKING_INGEST_STATUSES:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Document ingestion is still in progress",
                    "ingestion_job_id": latest_ingestion.id,
                    "status": latest_ingestion.status,
                },
            )

    execution = ExecutionLog(
        id=str(uuid4()),
        flow_version_id=published.id,
        status="queued",
        tokens_used=0,
        execution_time_ms=0,
    )
    db.add(execution)
    db.commit()

    job = {
        "job_type": "execute_flow",
        "execution_log_id": execution.id,
        "flow_version_id": published.id,
        "tenant_id": user["tenant_id"],
        "input": body.input,
        "enable_tools": body.enable_tools,
        "llm_provider": body.llm_provider,
        "llm_model": body.llm_model,
    }
    redis_client.rpush(EXECUTION_QUEUE, json.dumps(job))

    return {"execution_log_id": execution.id, "status": "queued"}


@router.post("/{flow_id}/documents")
def ingest_documents(
    flow_id: str,
    body: IngestRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    _require_tenant_flow(db, user["tenant_id"], flow_id)

    if not body.documents:
        raise HTTPException(status_code=400, detail="No documents provided")

    ingestion = IngestionJob(
        id=str(uuid4()),
        tenant_id=user["tenant_id"],
        flow_id=flow_id,
        status="queued",
        documents_count=len(body.documents),
        chunks_count=0,
    )
    db.add(ingestion)
    db.commit()

    job = {
        "job_type": "ingest_docs",
        "tenant_id": user["tenant_id"],
        "flow_id": flow_id,
        "ingestion_job_id": ingestion.id,
        "documents": [doc.model_dump() for doc in body.documents],
    }
    redis_client.rpush(INGEST_QUEUE, json.dumps(job))

    return {
        "status": "queued",
        "documents": len(body.documents),
        "ingestion_job_id": ingestion.id,
    }


@router.get("/{flow_id}/ingestions")
def get_ingestions(
    flow_id: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    flow = _require_tenant_flow(db, user["tenant_id"], flow_id)

    rows = (
        db.query(IngestionJob)
        .filter(IngestionJob.tenant_id == user["tenant_id"], IngestionJob.flow_id == flow.id)
        .order_by(IngestionJob.created_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )

    return [
        {
            "ingestion_job_id": row.id,
            "status": row.status,
            "documents_count": row.documents_count,
            "chunks_count": row.chunks_count,
            "error_message": row.error_message,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
        for row in rows
    ]


@router.get("/logs")
def get_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    rows = (
        db.query(ExecutionLog, FlowVersion, Flow)
        .join(FlowVersion, FlowVersion.id == ExecutionLog.flow_version_id)
        .join(Flow, Flow.id == FlowVersion.flow_id)
        .filter(Flow.tenant_id == user["tenant_id"])
        .order_by(ExecutionLog.created_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )

    return [
        {
            "execution_log_id": log.id,
            "flow_id": flow.id,
            "flow_version": version.version,
            "status": log.status,
            "tokens_used": log.tokens_used,
            "execution_time_ms": log.execution_time_ms,
            "response_text": log.response_text,
            "error_message": log.error_message,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for (log, version, flow) in rows
    ]


@router.get("/list")
def list_flows(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    safe_limit = max(1, min(limit, 200))
    flows = (
        db.query(Flow)
        .filter(Flow.tenant_id == user["tenant_id"])
        .order_by(Flow.created_at.desc())
        .limit(safe_limit)
        .all()
    )

    items: list[dict[str, Any]] = []
    for flow in flows:
        latest_version = (
            db.query(FlowVersion)
            .filter(FlowVersion.flow_id == flow.id)
            .order_by(FlowVersion.version.desc())
            .first()
        )
        published = (
            db.query(FlowVersion)
            .filter(FlowVersion.flow_id == flow.id, FlowVersion.is_published.is_(True))
            .order_by(FlowVersion.version.desc())
            .first()
        )
        items.append(
            {
                "flow_id": flow.id,
                "name": flow.name,
                "latest_version": latest_version.version if latest_version else None,
                "published_version": published.version if published else None,
                "latest_definition": latest_version.json_definition if latest_version else {},
                "created_at": flow.created_at.isoformat() if flow.created_at else None,
            }
        )

    return {"items": items, "count": len(items)}


@router.get("/usage")
def get_usage(
    days: int | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    window_days = _resolve_usage_window(days)
    usage = _collect_usage_metrics(db, user["tenant_id"], trend_days=window_days)
    queue_depth = _collect_queue_depth()
    daily_usage = usage.get("daily_usage")
    if daily_usage is None:
        daily_usage = [
            {
                "date": row.get("date"),
                "tokens_used": int(row.get("tokens_used", 0)),
                "executions": int(row.get("executions", 0)),
            }
            for row in usage.get("daily_tokens", [])
        ]
    daily_tokens = usage.get("daily_tokens")
    if daily_tokens is None:
        daily_tokens = [
            {"date": row.get("date"), "tokens_used": int(row.get("tokens_used", 0))}
            for row in daily_usage
        ]
    latency_metrics = usage.get("latency_ms")
    if not isinstance(latency_metrics, dict):
        latency_metrics = {}
    usage_latency = {
        "avg": float(latency_metrics.get("avg", 0.0) or 0.0),
        "p50": float(latency_metrics.get("p50", 0.0) or 0.0),
        "p95": float(latency_metrics.get("p95", 0.0) or 0.0),
        "max": float(latency_metrics.get("max", 0.0) or 0.0),
        "sample_count": int(latency_metrics.get("sample_count", 0) or 0),
    }
    usage_percent = (
        min(100, round((usage["monthly_tokens_used"] / PLAN_LIMIT) * 100))
        if PLAN_LIMIT > 0
        else 0
    )
    return {
        "tenant_id": user["tenant_id"],
        "total_flows": usage["total_flows"],
        "published_flows": usage["published_flows"],
        "executions_today": usage["executions_today"],
        "monthly_tokens_used": usage["monthly_tokens_used"],
        "monthly_quota": PLAN_LIMIT,
        "monthly_usage_percent": usage_percent,
        "window_days": window_days,
        "daily_usage": daily_usage,
        "daily_tokens": daily_tokens,
        "latency_ms": usage_latency,
        "slo_targets": {
            "execute_p95_ms": SLO_EXECUTE_P95_MS,
        },
        "queue_depth": queue_depth,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/tools/state")
def get_tool_state(
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    data = _get_user_tool_states(db, user["tenant_id"], user["user_id"])
    return {
        "tenant_id": user["tenant_id"],
        "user_id": user["user_id"],
        "states": data["states"],
        "updated_at": data["updated_at"],
    }


@router.put("/tools/state")
def update_tool_state(
    body: ToolStateUpdateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    _ensure_tenant(db, user["tenant_id"])
    _ensure_tenant_user(db, user)
    data = _persist_user_tool_states(db, user["tenant_id"], user["user_id"], body.states)
    return {
        "tenant_id": user["tenant_id"],
        "user_id": user["user_id"],
        "states": data["states"],
        "updated_at": data["updated_at"],
    }


@router.get("/{flow_id}")
def get_flow(
    flow_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    flow = _require_tenant_flow(db, user["tenant_id"], flow_id)
    latest_version = (
        db.query(FlowVersion)
        .filter(FlowVersion.flow_id == flow.id)
        .order_by(FlowVersion.version.desc())
        .first()
    )
    published = (
        db.query(FlowVersion)
        .filter(FlowVersion.flow_id == flow.id, FlowVersion.is_published.is_(True))
        .order_by(FlowVersion.version.desc())
        .first()
    )
    return {
        "flow_id": flow.id,
        "name": flow.name,
        "latest_version": latest_version.version if latest_version else None,
        "published_version": published.version if published else None,
        "json_definition": latest_version.json_definition if latest_version else {},
        "created_at": flow.created_at.isoformat() if flow.created_at else None,
    }


@router.delete("/{flow_id}")
def delete_flow(
    flow_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    flow = _require_tenant_flow(db, user["tenant_id"], flow_id)

    version_ids = [item.id for item in db.query(FlowVersion.id).filter(FlowVersion.flow_id == flow.id).all()]
    if version_ids:
        db.query(ExecutionLog).filter(ExecutionLog.flow_version_id.in_(version_ids)).delete(synchronize_session=False)
        db.query(FlowVersion).filter(FlowVersion.id.in_(version_ids)).delete(synchronize_session=False)

    db.query(IngestionJob).filter(IngestionJob.tenant_id == user["tenant_id"], IngestionJob.flow_id == flow.id).delete(
        synchronize_session=False
    )
    db.delete(flow)
    db.commit()
    return {"status": "deleted", "flow_id": flow_id}


@router.get("/dlq/{dlq_type}")
def list_dlq_jobs(
    dlq_type: str,
    limit: int = 50,
    user: Annotated[dict, Depends(require_roles("admin"))] = None,
) -> dict[str, Any]:
    dlq_name, _ = _resolve_dlq(dlq_type)
    items = redis_client.lrange(dlq_name, 0, max(0, min(limit, 200)) - 1)

    jobs: list[dict[str, Any]] = []
    for index, raw in enumerate(items):
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = None

        jobs.append(
            {
                "redis_index": index,
                "raw": raw if parsed is None else None,
                "job": parsed,
                "parse_error": parsed is None,
            }
        )

    return {"dlq_type": dlq_type, "queue": dlq_name, "count": len(jobs), "jobs": jobs}


@router.post("/dlq/{dlq_type}/replay")
def replay_dlq_job(
    dlq_type: str,
    body: DLQReplayRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin"))] = None,
) -> dict[str, Any]:
    dlq_name, default_target_queue = _resolve_dlq(dlq_type)
    raw = redis_client.lindex(dlq_name, body.redis_index)
    if raw is None:
        raise HTTPException(status_code=404, detail="DLQ entry not found")

    try:
        job = json.loads(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="DLQ entry has invalid JSON payload") from exc

    target_queue = body.target_queue or job.get("source_queue") or default_target_queue
    if target_queue not in {EXECUTION_QUEUE, INGEST_QUEUE}:
        raise HTTPException(status_code=400, detail="Invalid target queue for replay")

    replay_job = dict(job)
    for key in ("failed_at", "source_queue", "last_error", "last_retry_at"):
        replay_job.pop(key, None)
    replay_job["retry_count"] = 0
    replay_job["replayed_at"] = datetime.now(timezone.utc).isoformat()

    if not body.keep_in_dlq:
        _remove_redis_entry_by_index(dlq_name, body.redis_index)

    redis_client.rpush(target_queue, json.dumps(replay_job))

    try:
        _append_audit_log(
            db=db,
            user=user,
            action="dlq_replay",
            resource_type="redis_dlq_entry",
            resource_id=f"{dlq_name}:{body.redis_index}",
            details={
                "dlq_type": dlq_type,
                "source_queue": dlq_name,
                "target_queue": target_queue,
                "removed_from_dlq": not body.keep_in_dlq,
                "requested_target_queue": body.target_queue,
            },
        )
    except Exception:
        logger.exception("Failed to persist audit log for DLQ replay")

    return {
        "status": "replayed",
        "dlq_type": dlq_type,
        "source_queue": dlq_name,
        "target_queue": target_queue,
        "removed_from_dlq": not body.keep_in_dlq,
        "replayed_job": replay_job,
    }


@router.get("/dlq/{dlq_type}/{redis_index}")
def get_dlq_job(
    dlq_type: str,
    redis_index: int,
    user: Annotated[dict, Depends(require_roles("admin"))] = None,
) -> dict[str, Any]:
    if redis_index < 0:
        raise HTTPException(status_code=400, detail="redis_index must be non-negative")

    dlq_name, _ = _resolve_dlq(dlq_type)
    raw = redis_client.lindex(dlq_name, redis_index)
    if raw is None:
        raise HTTPException(status_code=404, detail="DLQ entry not found")

    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = None

    return {
        "dlq_type": dlq_type,
        "queue": dlq_name,
        "redis_index": redis_index,
        "raw": raw if parsed is None else None,
        "job": parsed,
        "parse_error": parsed is None,
    }


@router.delete("/dlq/{dlq_type}/{redis_index}")
def delete_dlq_job(
    dlq_type: str,
    redis_index: int,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin"))] = None,
) -> dict[str, Any]:
    if redis_index < 0:
        raise HTTPException(status_code=400, detail="redis_index must be non-negative")

    dlq_name, _ = _resolve_dlq(dlq_type)
    raw = redis_client.lindex(dlq_name, redis_index)
    if raw is None:
        raise HTTPException(status_code=404, detail="DLQ entry not found")

    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = None

    _remove_redis_entry_by_index(dlq_name, redis_index)

    try:
        _append_audit_log(
            db=db,
            user=user,
            action="dlq_delete",
            resource_type="redis_dlq_entry",
            resource_id=f"{dlq_name}:{redis_index}",
            details={
                "dlq_type": dlq_type,
                "source_queue": dlq_name,
                "deleted_index": redis_index,
                "entry_preview": parsed if parsed is not None else {"raw": raw},
            },
        )
    except Exception:
        logger.exception("Failed to persist audit log for DLQ delete")

    return {
        "status": "deleted",
        "dlq_type": dlq_type,
        "queue": dlq_name,
        "redis_index": redis_index,
    }


@router.get("/audit")
def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    action: str | None = None,
    actor_email: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin"))] = None,
) -> dict[str, Any]:
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    query = db.query(AuditLog).filter(AuditLog.tenant_id == user["tenant_id"])
    if action:
        query = query.filter(AuditLog.action == action)
    if actor_email:
        query = query.filter(AuditLog.actor_email == actor_email.strip())
    if created_from:
        from_dt = _parse_iso_datetime(created_from, "created_from")
        query = query.filter(AuditLog.created_at >= from_dt)
    if created_to:
        to_dt = _parse_iso_datetime(created_to, "created_to")
        query = query.filter(AuditLog.created_at <= to_dt)

    total_count = query.count()
    rows = query.order_by(AuditLog.created_at.desc()).offset(safe_offset).limit(safe_limit).all()

    return {
        "items": [
            {
                "audit_log_id": row.id,
                "tenant_id": row.tenant_id,
                "actor_user_id": row.actor_user_id,
                "actor_email": row.actor_email,
                "actor_role": row.actor_role,
                "action": row.action,
                "resource_type": row.resource_type,
                "resource_id": row.resource_id,
                "details": row.details,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        "total_count": total_count,
        "limit": safe_limit,
        "offset": safe_offset,
    }
