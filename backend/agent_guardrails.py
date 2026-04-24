"""Agent action guardrails and safety evaluation endpoints.

Enforces policies for:
- Tool usage restrictions (allowed tools, protected paths)
- Credential and secret protection (no .pem, .key, .env files)
- Infrastructure protection (nginx, postgres configuration)
- Risk assessment (low, medium, high, critical)
- Action evaluation and approval workflow
"""
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
from models import AuditLog
from utils import parse_iso_datetime

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_TOOLS = {"file_read", "file_write", "git", "test_runner", "docker_build"}
RISK_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}
LOCAL_WRITE_ROOTS = {"backend", "frontend", "langgraph", "scripts", "README.md"}
PROTECTED_INFRA_ROOTS = {"nginx", "postgres"}
PROTECTED_FILES = {"docker-compose.yml"}
CI_WORKFLOW_PREFIX = ".github/workflows/"
SECRET_FILE_REGEX = re.compile(r"(^|/)\.env($|\.|/)|(^|/).*\.pem($|/)|(^|/).*\.key($|/)|(^|/)id_rsa($|/)")
UNSAFE_PROMPT_MARKERS = {
    "rm -rf",
    "drop table",
    "drop database",
    "bypass auth",
    "disable security",
    "exfiltrate",
    "format c:",
}
PROTECTED_VCS_BRANCHES = {"main", "master"}
AGENT_ACTION_STATUS_MAP = {
    "planned": "agent_task_planned",
    "running": "agent_task_running",
    "completed": "agent_task_completed",
    "failed": "agent_task_failed",
    "policy_approved": "agent_task_policy_approved",
    "policy_rejected": "agent_task_policy_rejected",
}
MAX_AGENT_ESTIMATED_TOKENS = int(os.getenv("MAX_AGENT_ESTIMATED_TOKENS", "120000"))
MAX_AGENT_EXPECTED_DURATION_MS = int(os.getenv("MAX_AGENT_EXPECTED_DURATION_MS", "120000"))
MAX_AGENT_EXPECTED_FILES_CHANGED = int(os.getenv("MAX_AGENT_EXPECTED_FILES_CHANGED", "40"))
MAX_AGENT_TOTAL_CHANGED_BYTES = int(os.getenv("MAX_AGENT_TOTAL_CHANGED_BYTES", "5242880"))
MAX_AGENT_CONCURRENT_RUNNING_TASKS = int(os.getenv("MAX_AGENT_CONCURRENT_RUNNING_TASKS", "5"))
MAX_AGENT_RUNTIME_TOKENS_USED = int(
    os.getenv("MAX_AGENT_RUNTIME_TOKENS_USED", str(MAX_AGENT_ESTIMATED_TOKENS))
)
MAX_AGENT_RUNTIME_DURATION_MS = int(
    os.getenv("MAX_AGENT_RUNTIME_DURATION_MS", str(MAX_AGENT_EXPECTED_DURATION_MS))
)
MAX_AGENT_RUNTIME_FILES_CHANGED = int(
    os.getenv("MAX_AGENT_RUNTIME_FILES_CHANGED", str(MAX_AGENT_EXPECTED_FILES_CHANGED))
)
MAX_AGENT_EVALUATIONS_PER_MINUTE = int(os.getenv("MAX_AGENT_EVALUATIONS_PER_MINUTE", "60"))


class AgentTaskRequest(BaseModel):
    task_description: str
    requested_paths: list[str] = Field(default_factory=list)
    requested_tools: list[str] = Field(default_factory=list)
    risk_level: Literal["low", "medium", "high", "critical"] | None = None
    estimated_tokens: int | None = Field(default=None, ge=0)
    expected_duration_ms: int | None = Field(default=None, ge=0)
    expected_files_changed: int | None = Field(default=None, ge=0)
    expected_total_changed_bytes: int | None = Field(default=None, ge=0)
    requires_write: bool = True
    allow_protected_changes: bool = False
    approval_confirmed: bool = False


class AgentTaskDecision(BaseModel):
    task_id: str
    allowed: bool
    risk_level: Literal["low", "medium", "high", "critical"]
    requires_approval: bool
    tenant_id: str | None = None
    normalized_paths: list[str] = Field(default_factory=list)
    requested_tools: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class AgentTaskReportRequest(BaseModel):
    task_id: str
    status: Literal["planned", "running", "completed", "failed"]
    files_changed: list[str] = Field(default_factory=list)
    changed_bytes: int = Field(default=0, ge=0)
    execution_duration_ms: int = Field(default=0, ge=0)
    tokens_used: int = Field(default=0, ge=0)
    branch_name: str | None = None
    pr_url: str | None = None
    error_summary: str | None = None


def _normalize_project_path(raw_path: str) -> str:
    normalized = raw_path.strip().replace("\\", "/")
    if not normalized:
        raise ValueError("Path cannot be empty")
    if normalized.startswith(("/", "~")) or ":" in normalized:
        raise ValueError("Absolute paths are not allowed")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    candidate = PurePosixPath(normalized)
    if ".." in candidate.parts:
        raise ValueError("Parent path traversal is not allowed")
    return candidate.as_posix()


def _is_secret_path(path: str) -> bool:
    lower = path.lower()
    if "/secrets/" in f"/{lower}/":
        return True
    return bool(SECRET_FILE_REGEX.search(lower))


def _is_protected_path(path: str) -> bool:
    if path in PROTECTED_FILES:
        return True
    if path.startswith(CI_WORKFLOW_PREFIX):
        return True
    return any(path == root or path.startswith(f"{root}/") for root in PROTECTED_INFRA_ROOTS)


def _is_local_project_path(path: str) -> bool:
    if path == "README.md":
        return True
    return any(path == root or path.startswith(f"{root}/") for root in LOCAL_WRITE_ROOTS)


def _validate_paths(paths: list[str], allow_protected_changes: bool) -> tuple[list[str], list[str]]:
    normalized_paths: list[str] = []
    reasons: list[str] = []
    seen: set[str] = set()

    for raw in paths:
        try:
            normalized = _normalize_project_path(raw)
        except ValueError as exc:
            reasons.append(f"Invalid path `{raw}`: {exc}")
            continue

        if normalized in seen:
            continue
        seen.add(normalized)
        normalized_paths.append(normalized)

        if _is_secret_path(normalized):
            reasons.append(f"Path `{normalized}` targets a secrets file")

        if not _is_local_project_path(normalized) and not _is_protected_path(normalized):
            reasons.append(f"Path `{normalized}` is outside allowed project roots")
            continue

        if _is_protected_path(normalized) and not allow_protected_changes:
            reasons.append(f"Path `{normalized}` requires allow_protected_changes=true")

    return normalized_paths, reasons


def _infer_risk_level(task_description: str, normalized_paths: list[str]) -> Literal["low", "medium", "high", "critical"]:
    desc = task_description.lower()

    if any(path.endswith("postgres/init.sql") or path.startswith("postgres/") for path in normalized_paths):
        return "critical"
    if any(path.endswith("database.py") for path in normalized_paths):
        return "critical"
    if any(path.endswith("auth.py") for path in normalized_paths):
        return "high"
    if any(path.startswith("backend/") for path in normalized_paths):
        return "medium"
    if any(path.startswith("frontend/") for path in normalized_paths):
        return "low"
    if "auth" in desc:
        return "high"
    return "medium" if normalized_paths else "low"


def _merge_risk_levels(
    inferred: Literal["low", "medium", "high", "critical"],
    requested: Literal["low", "medium", "high", "critical"] | None,
) -> Literal["low", "medium", "high", "critical"]:
    if requested is None:
        return inferred
    return requested if RISK_ORDER[requested] >= RISK_ORDER[inferred] else inferred


def evaluate_agent_task_policy(user: dict, body: AgentTaskRequest) -> AgentTaskDecision:
    reasons: list[str] = []
    task_text = body.task_description.strip()

    if not task_text or len(task_text.split()) < 4:
        reasons.append("Task description is too vague; provide a specific engineering instruction")

    lowered = task_text.lower()
    if any(marker in lowered for marker in UNSAFE_PROMPT_MARKERS):
        reasons.append("Task contains unsafe instruction markers")

    requested_tools = sorted(set(tool.strip() for tool in body.requested_tools if tool.strip()))
    unsupported_tools = [tool for tool in requested_tools if tool not in ALLOWED_TOOLS]
    if unsupported_tools:
        reasons.append(f"Unsupported tools requested: {', '.join(unsupported_tools)}")

    normalized_paths, path_reasons = _validate_paths(body.requested_paths, body.allow_protected_changes)
    reasons.extend(path_reasons)

    if body.requires_write and not normalized_paths:
        reasons.append("Write tasks must declare at least one impacted file path")
    if body.requires_write and body.expected_files_changed == 0:
        reasons.append("expected_files_changed must be > 0 for write tasks")

    if body.estimated_tokens is not None and body.estimated_tokens > MAX_AGENT_ESTIMATED_TOKENS:
        reasons.append(
            f"estimated_tokens exceeds budget ({body.estimated_tokens} > {MAX_AGENT_ESTIMATED_TOKENS})"
        )
    if body.expected_duration_ms is not None and body.expected_duration_ms > MAX_AGENT_EXPECTED_DURATION_MS:
        reasons.append(
            f"expected_duration_ms exceeds budget ({body.expected_duration_ms} > {MAX_AGENT_EXPECTED_DURATION_MS})"
        )
    if body.expected_files_changed is not None and body.expected_files_changed > MAX_AGENT_EXPECTED_FILES_CHANGED:
        reasons.append(
            f"expected_files_changed exceeds budget ({body.expected_files_changed} > {MAX_AGENT_EXPECTED_FILES_CHANGED})"
        )
    if (
        body.expected_total_changed_bytes is not None
        and body.expected_total_changed_bytes > MAX_AGENT_TOTAL_CHANGED_BYTES
    ):
        reasons.append(
            "expected_total_changed_bytes exceeds budget "
            f"({body.expected_total_changed_bytes} > {MAX_AGENT_TOTAL_CHANGED_BYTES})"
        )

    inferred_risk = _infer_risk_level(task_text, normalized_paths)
    risk_level = _merge_risk_levels(inferred_risk, body.risk_level)
    requires_approval = risk_level in {"high", "critical"}
    if requires_approval and not body.approval_confirmed:
        reasons.append("High/Critical risk task requires explicit approval_confirmed=true")

    if user.get("role") not in {"admin", "editor"}:
        reasons.append("Only admin/editor roles can execute Codex tasks")

    return AgentTaskDecision(
        task_id=str(uuid4()),
        allowed=len(reasons) == 0,
        risk_level=risk_level,
        requires_approval=requires_approval,
        tenant_id=user.get("tenant_id"),
        normalized_paths=normalized_paths,
        requested_tools=requested_tools,
        reasons=reasons,
    )


def _append_agent_audit(
    db: Session,
    user: dict,
    action: str,
    task_id: str,
    details: dict,
) -> None:
    entry = AuditLog(
        id=str(uuid4()),
        tenant_id=user.get("tenant_id"),
        actor_user_id=user.get("user_id"),
        actor_email=user.get("sub"),
        actor_role=user.get("role"),
        action=action,
        resource_type="codex_task",
        resource_id=task_id,
        details=details,
    )
    db.add(entry)
    db.commit()


def _count_running_tasks(db: Session, tenant_id: str) -> int:
    terminal_actions = {"agent_task_completed", "agent_task_failed"}
    tracking_actions = {"agent_task_running", *terminal_actions}

    latest_by_task = (
        db.query(
            AuditLog.resource_id.label("task_id"),
            func.max(AuditLog.created_at).label("latest_created_at"),
        )
        .filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource_type == "codex_task",
            AuditLog.action.in_(tracking_actions),
        )
        .group_by(AuditLog.resource_id)
        .subquery()
    )

    running_count = (
        db.query(func.count())
        .select_from(AuditLog)
        .join(
            latest_by_task,
            and_(
                AuditLog.resource_id == latest_by_task.c.task_id,
                AuditLog.created_at == latest_by_task.c.latest_created_at,
            ),
        )
        .filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource_type == "codex_task",
            AuditLog.action == "agent_task_running",
        )
        .scalar()
    )
    return int(running_count or 0)


def _get_latest_task_action(db: Session, tenant_id: str, task_id: str) -> str | None:
    row = (
        db.query(AuditLog.action)
        .filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource_type == "codex_task",
            AuditLog.resource_id == task_id,
        )
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    return row[0] if row else None


def _get_task_policy_action(db: Session, tenant_id: str, task_id: str) -> str | None:
    row = (
        db.query(AuditLog.action)
        .filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource_type == "codex_task",
            AuditLog.resource_id == task_id,
            AuditLog.action.in_({"agent_task_policy_approved", "agent_task_policy_rejected"}),
        )
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    return row[0] if row else None


def _count_recent_policy_evaluations(db: Session, tenant_id: str) -> int:
    window_start = datetime.now(timezone.utc) - timedelta(minutes=1)
    query = (
        db.query(AuditLog)
        .filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource_type == "codex_task",
            AuditLog.created_at >= window_start,
            AuditLog.action.in_({"agent_task_policy_approved", "agent_task_policy_rejected"}),
        )
    )
    return int(query.count() or 0)


@router.get("/tasks/config")
def get_agent_task_config(
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict:
    return {
        "tenant_id": user.get("tenant_id"),
        "role": user.get("role"),
        "allowed_tools": sorted(ALLOWED_TOOLS),
        "risk_levels": ["low", "medium", "high", "critical"],
        "limits": {
            "max_estimated_tokens": MAX_AGENT_ESTIMATED_TOKENS,
            "max_expected_duration_ms": MAX_AGENT_EXPECTED_DURATION_MS,
            "max_expected_files_changed": MAX_AGENT_EXPECTED_FILES_CHANGED,
            "max_expected_total_changed_bytes": MAX_AGENT_TOTAL_CHANGED_BYTES,
            "max_concurrent_running_tasks": MAX_AGENT_CONCURRENT_RUNNING_TASKS,
            "max_runtime_tokens_used": MAX_AGENT_RUNTIME_TOKENS_USED,
            "max_runtime_duration_ms": MAX_AGENT_RUNTIME_DURATION_MS,
            "max_runtime_files_changed": MAX_AGENT_RUNTIME_FILES_CHANGED,
            "max_evaluations_per_minute": MAX_AGENT_EVALUATIONS_PER_MINUTE,
        },
    }


@router.get("/tasks/audit")
def get_agent_task_audit(
    limit: int = 50,
    offset: int = 0,
    action: str | None = None,
    status: str | None = None,
    actor_email: str | None = None,
    task_id: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict:
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    query = db.query(AuditLog).filter(
        AuditLog.tenant_id == user["tenant_id"],
        AuditLog.resource_type == "codex_task",
    )

    if action:
        query = query.filter(AuditLog.action == action.strip())

    if status:
        mapped_action = AGENT_ACTION_STATUS_MAP.get(status.strip())
        if mapped_action is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported status filter `{status}`. Allowed: {', '.join(AGENT_ACTION_STATUS_MAP.keys())}",
            )
        query = query.filter(AuditLog.action == mapped_action)

    if actor_email:
        query = query.filter(AuditLog.actor_email == actor_email.strip())

    if task_id:
        query = query.filter(AuditLog.resource_id == task_id.strip())

    if created_from:
        from_dt = parse_iso_datetime(created_from, "created_from")
        query = query.filter(AuditLog.created_at >= from_dt)

    if created_to:
        to_dt = parse_iso_datetime(created_to, "created_to")
        query = query.filter(AuditLog.created_at <= to_dt)

    total_count = query.count()
    rows = query.order_by(AuditLog.created_at.desc()).offset(safe_offset).limit(safe_limit).all()

    return {
        "items": [
            {
                "audit_log_id": row.id,
                "task_id": row.resource_id,
                "tenant_id": row.tenant_id,
                "actor_user_id": row.actor_user_id,
                "actor_email": row.actor_email,
                "actor_role": row.actor_role,
                "action": row.action,
                "status": row.action.replace("agent_task_", "", 1) if row.action.startswith("agent_task_") else row.action,
                "details": row.details,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        "total_count": total_count,
        "limit": safe_limit,
        "offset": safe_offset,
    }


@router.post("/tasks/evaluate", response_model=AgentTaskDecision)
def evaluate_task(
    body: AgentTaskRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> AgentTaskDecision:
    decision = evaluate_agent_task_policy(user, body)
    recent_policy_eval_count = _count_recent_policy_evaluations(db, user["tenant_id"])
    if recent_policy_eval_count >= MAX_AGENT_EVALUATIONS_PER_MINUTE:
        decision.allowed = False
        decision.reasons.append(
            "Policy evaluation rate limit reached "
            f"({recent_policy_eval_count}/{MAX_AGENT_EVALUATIONS_PER_MINUTE} per minute)"
        )

    running_count = _count_running_tasks(db, user["tenant_id"])
    if running_count >= MAX_AGENT_CONCURRENT_RUNNING_TASKS:
        decision.allowed = False
        decision.reasons.append(
            f"Concurrent running task limit reached ({running_count}/{MAX_AGENT_CONCURRENT_RUNNING_TASKS})"
        )

    try:
        _append_agent_audit(
            db=db,
            user=user,
            action="agent_task_policy_approved" if decision.allowed else "agent_task_policy_rejected",
            task_id=decision.task_id,
            details={
                "allowed": decision.allowed,
                "risk_level": decision.risk_level,
                "requires_approval": decision.requires_approval,
                "requested_tools": decision.requested_tools,
                "requested_paths": body.requested_paths,
                "normalized_paths": decision.normalized_paths,
                "estimated_tokens": body.estimated_tokens,
                "expected_duration_ms": body.expected_duration_ms,
                "expected_files_changed": body.expected_files_changed,
                "expected_total_changed_bytes": body.expected_total_changed_bytes,
                "budget_limits": {
                    "max_estimated_tokens": MAX_AGENT_ESTIMATED_TOKENS,
                    "max_expected_duration_ms": MAX_AGENT_EXPECTED_DURATION_MS,
                    "max_expected_files_changed": MAX_AGENT_EXPECTED_FILES_CHANGED,
                    "max_expected_total_changed_bytes": MAX_AGENT_TOTAL_CHANGED_BYTES,
                    "max_concurrent_running_tasks": MAX_AGENT_CONCURRENT_RUNNING_TASKS,
                    "max_runtime_tokens_used": MAX_AGENT_RUNTIME_TOKENS_USED,
                    "max_runtime_duration_ms": MAX_AGENT_RUNTIME_DURATION_MS,
                    "max_runtime_files_changed": MAX_AGENT_RUNTIME_FILES_CHANGED,
                    "max_evaluations_per_minute": MAX_AGENT_EVALUATIONS_PER_MINUTE,
                },
                "policy_evaluations_last_minute": recent_policy_eval_count,
                "running_tasks_current": running_count,
                "reasons": decision.reasons,
            },
        )
    except Exception:
        logger.exception("Failed to persist agent policy audit record")

    return decision


@router.post("/tasks/report")
def report_task_execution(
    body: AgentTaskReportRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict:
    normalized_paths, path_reasons = _validate_paths(body.files_changed, allow_protected_changes=True)
    if path_reasons:
        raise HTTPException(status_code=400, detail={"message": "Invalid files_changed list", "reasons": path_reasons})
    if len(normalized_paths) > MAX_AGENT_RUNTIME_FILES_CHANGED:
        raise HTTPException(
            status_code=400,
            detail=(
                "files_changed exceeds runtime budget "
                f"({len(normalized_paths)} > {MAX_AGENT_RUNTIME_FILES_CHANGED})"
            ),
        )
    if body.changed_bytes > MAX_AGENT_TOTAL_CHANGED_BYTES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"changed_bytes exceeds budget ({body.changed_bytes} > {MAX_AGENT_TOTAL_CHANGED_BYTES})"
            ),
        )
    if body.tokens_used > MAX_AGENT_RUNTIME_TOKENS_USED:
        raise HTTPException(
            status_code=400,
            detail=(
                f"tokens_used exceeds runtime budget ({body.tokens_used} > {MAX_AGENT_RUNTIME_TOKENS_USED})"
            ),
        )
    if body.execution_duration_ms > MAX_AGENT_RUNTIME_DURATION_MS:
        raise HTTPException(
            status_code=400,
            detail=(
                "execution_duration_ms exceeds runtime budget "
                f"({body.execution_duration_ms} > {MAX_AGENT_RUNTIME_DURATION_MS})"
            ),
        )
    if body.status == "completed" and normalized_paths:
        normalized_branch = (body.branch_name or "").strip()
        normalized_pr_url = (body.pr_url or "").strip()
        if not normalized_branch:
            raise HTTPException(
                status_code=400,
                detail="completed write tasks must include branch_name",
            )
        if normalized_branch.lower() in PROTECTED_VCS_BRANCHES:
            raise HTTPException(
                status_code=400,
                detail=f"Direct pushes to `{normalized_branch}` are not allowed; use a feature branch",
            )
        if not normalized_pr_url:
            raise HTTPException(
                status_code=400,
                detail="completed write tasks must include pr_url",
            )

    latest_action = _get_latest_task_action(db, user["tenant_id"], body.task_id)
    if body.status == "running":
        running_count = _count_running_tasks(db, user["tenant_id"])
        if latest_action != "agent_task_running" and running_count >= MAX_AGENT_CONCURRENT_RUNNING_TASKS:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Concurrent running task limit reached ({running_count}/{MAX_AGENT_CONCURRENT_RUNNING_TASKS})"
                ),
            )

    policy_action = _get_task_policy_action(db, user["tenant_id"], body.task_id)
    if policy_action != "agent_task_policy_approved":
        if policy_action == "agent_task_policy_rejected":
            raise HTTPException(
                status_code=409,
                detail="Task policy is rejected; execution reporting is blocked",
            )
        raise HTTPException(
            status_code=409,
            detail="Task has no approved policy record; run /agent/tasks/evaluate first",
        )

    completed_at = datetime.now(timezone.utc).isoformat() if body.status in {"completed", "failed"} else None
    details = {
        "status": body.status,
        "policy_action": policy_action,
        "files_changed": normalized_paths,
        "changed_bytes": body.changed_bytes,
        "execution_duration_ms": body.execution_duration_ms,
        "tokens_used": body.tokens_used,
        "branch_name": body.branch_name,
        "pr_url": body.pr_url,
        "error_summary": body.error_summary,
        "completed_at": completed_at,
    }

    try:
        _append_agent_audit(
            db=db,
            user=user,
            action=f"agent_task_{body.status}",
            task_id=body.task_id,
            details=details,
        )
    except Exception:
        logger.exception("Failed to persist agent execution audit record")
        raise HTTPException(status_code=500, detail="Failed to persist execution audit record")

    return {
        "task_id": body.task_id,
        "status": body.status,
        "tenant_id": user.get("tenant_id"),
        "files_changed_count": len(normalized_paths),
        "execution_duration_ms": body.execution_duration_ms,
        "tokens_used": body.tokens_used,
    }
