import ast
import json
import logging
import os
import time
import uuid
from threading import Thread
from datetime import datetime, timezone
from typing import Any

import redis
import requests
from fastapi import FastAPI, HTTPException
from langgraph.graph import StateGraph
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import create_engine, text

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("langgraph-worker")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://admin:password@postgres:5432/ai_platform",
)
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
EXECUTION_QUEUE = os.getenv("EXECUTION_QUEUE", "execution_queue")
INGEST_QUEUE = os.getenv("INGEST_QUEUE", "ingest_queue")
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "llama3.2")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
# some Ollama releases expose the HTTP API under /api while newer versions use /v1
# allow overriding via an environment variable so the code is forward/backwards compatible.
# generic helpers for provider URLs ------------------------------------------------

def detect_api_prefix(
    base_url: str, *,
    env_override: str | None = None,
    candidates: list[str] | None = None,
    probe_path: str = "/models",
) -> str:
    """Return the API prefix to use for a service with a varying URL scheme.

    The function checks the following in order:

    1. ``env_override`` value if provided and non-empty.
    2. Each string in ``candidates`` (default ["/v1", "/api"]) by performing
       a ``GET`` request against ``base_url + prefix + probe_path``.  The first
       prefix returning HTTP 200 is chosen.
    3. If none succeeded or an error occurred, ``/v1`` is returned as the
       modern default (used by Ollama 0.6.0+).

    ``base_url`` should include scheme and host (e.g. ``http://ollama:11434``).
    ``probe_path`` is appended after the prefix when probing; ``/models`` works
    for Ollama but callers may override it.
    """
    if env_override:
        return env_override.rstrip("/")

    if candidates is None:
        candidates = ["/v1", "/api"]

    base = base_url.rstrip("/")
    for cand in candidates:
        try:
            url = f"{base}{cand.rstrip('/')}{probe_path}"
            resp = requests.get(url, timeout=2)
            if resp.status_code == 200:
                logger.info("auto-detected API prefix %s for %s", cand, base_url)
                return cand
        except Exception:
            continue

    logger.warning("could not auto-detect API prefix for %s, defaulting to /v1", base_url)
    return "/v1"


def make_api_url(base_url: str, prefix: str, endpoint: str) -> str:
    """Build a full URL for a given ``endpoint`` under ``base_url`` and
    ``prefix``.

    ``endpoint`` may start with or without a leading ``/``; the function
    normalizes accordingly.  ``prefix`` should also begin with a slash (e.g.
    ``/api`` or ``/v1``).
    """
    base = base_url.rstrip("/")
    pre = prefix.rstrip("/")
    return f"{base}{pre}/{endpoint.lstrip('/') }"
# -----------------------------------------------------------------------------


# Ollama-specific configuration ------------------------------------------------
OLLAMA_API_PREFIX = detect_api_prefix(
    OLLAMA_BASE_URL,
    env_override=os.getenv("OLLAMA_API_PREFIX", ""),
)

def ollama_url(endpoint: str) -> str:
    """Convenience wrapper for calls against the Ollama service."""
    return make_api_url(OLLAMA_BASE_URL, OLLAMA_API_PREFIX, endpoint)

RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "4"))
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "ollama")

# OpenAI configuration; base_url allows proxying or alternative endpoints
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "").strip()  # optional; uses OpenAI default if empty

# Anthropic configuration
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

# Azure OpenAI configuration
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview").strip()
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()
MAX_JOB_RETRIES = int(os.getenv("MAX_JOB_RETRIES", "2"))
EXECUTION_DLQ = os.getenv("EXECUTION_DLQ", "execution_dlq")
INGESTION_DLQ = os.getenv("INGESTION_DLQ", "ingestion_dlq")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
qdrant = QdrantClient(url=QDRANT_URL)
# initialize OpenAI client with optional custom base URL (for proxies or alternative endpoints)
openai_client = (
    OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    if OPENAI_API_KEY
    else None
)
app = FastAPI(title="LangGraph Worker", version="1.0.0")


class JobProcessingError(RuntimeError):
    def __init__(self, message: str, elapsed_ms: int = 0):
        super().__init__(message)
        self.elapsed_ms = elapsed_ms


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []

    chunks: list[str] = []
    cursor = 0
    step = max(1, chunk_size - overlap)
    while cursor < len(cleaned):
        chunks.append(cleaned[cursor : cursor + chunk_size])
        cursor += step
    return chunks


def ollama_embedding(text_value: str) -> list[float]:
    response = requests.post(
        ollama_url("embeddings"),
        json={"model": OLLAMA_EMBED_MODEL, "prompt": text_value},
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    vector = data.get("embedding")
    if not vector:
        raise RuntimeError("Embedding response did not include vector")
    return vector


def ensure_collection(collection_name: str, vector_size: int) -> None:
    exists = qdrant.collection_exists(collection_name=collection_name)
    if exists:
        return

    qdrant.create_collection(
        collection_name=collection_name,
        vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
    )


def collection_for_tenant(tenant_id: str) -> str:
    return f"tenant_{tenant_id.replace('-', '_')}"


def ingest_documents(tenant_id: str, flow_id: str, documents: list[dict[str, Any]]) -> int:
    logger.info("Starting ingestion", extra={"tenant_id": tenant_id, "docs": len(documents)})
    collection_name = collection_for_tenant(tenant_id)

    points: list[qmodels.PointStruct] = []
    embedding_size: int | None = None

    for item in documents:
        source = item.get("source") or "unknown"
        metadata = item.get("metadata") or {}
        for chunk_index, chunk in enumerate(chunk_text(item.get("text", ""))):
            vector = ollama_embedding(chunk)
            embedding_size = embedding_size or len(vector)
            points.append(
                qmodels.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "tenant_id": tenant_id,
                        "flow_id": flow_id,
                        "source": source,
                        "chunk_index": chunk_index,
                        "text": chunk,
                        "metadata": metadata,
                    },
                )
            )

    if not points:
        logger.warning("No ingestable chunks", extra={"tenant_id": tenant_id, "flow_id": flow_id})
        return 0

    ensure_collection(collection_name, embedding_size or len(points[0].vector))
    qdrant.upsert(collection_name=collection_name, points=points)
    logger.info("Ingestion complete", extra={"tenant_id": tenant_id, "points": len(points)})
    return len(points)


def retrieve_context(tenant_id: str, question: str) -> str:
    collection_name = collection_for_tenant(tenant_id)
    if not qdrant.collection_exists(collection_name=collection_name):
        return ""

    vector = ollama_embedding(question)
    hits = qdrant.search(
        collection_name=collection_name,
        query_vector=vector,
        limit=RETRIEVAL_TOP_K,
        with_payload=True,
    )
    chunks = [hit.payload.get("text", "") for hit in hits if hit.payload]
    return "\n\n".join(filter(None, chunks))


def safe_calculate(expression: str) -> str:
    allowed_nodes = {
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Constant,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.Mod,
        ast.USub,
        ast.UAdd,
        ast.FloorDiv,
    }

    tree = ast.parse(expression, mode="eval")
    for node in ast.walk(tree):
        if type(node) not in allowed_nodes:
            raise ValueError("Unsupported expression")

    result = eval(compile(tree, "<expr>", "eval"), {"__builtins__": {}}, {})
    return str(result)


def run_tools(input_payload: dict[str, Any], tool_states: dict[str, bool] | None = None) -> str:
    states = tool_states or {}
    calculator_enabled = bool(states.get("calculator", True))
    sql_tool_enabled = bool(states.get("sql_tool", False))
    http_fetch_enabled = bool(states.get("http_fetch", False))
    tool_name = (input_payload.get("tool") or "").lower()

    if tool_name == "calculator" and calculator_enabled:
        expr = input_payload.get("expression") or input_payload.get("question", "")
        return f"calculator={safe_calculate(expr)}"

    if tool_name == "sql_tool" and sql_tool_enabled:
        query = input_payload.get("query", "").strip()
        if not query:
            return "sql_tool_error=No query provided"
        try:
            engine = create_engine(DATABASE_URL)
            with engine.connect() as conn:
                result = conn.execute(text(query))
                rows = result.fetchall()
                if not rows:
                    return "sql_result=No rows returned"
                return f"sql_result={json.dumps([dict(row._mapping) for row in rows[:10]])}"
        except Exception as e:
            logger.error(f"sql_tool error: {e}")
            return f"sql_tool_error={str(e)[:200]}"

    if tool_name == "http_fetch" and http_fetch_enabled:
        url = input_payload.get("url", "").strip()
        method = (input_payload.get("method") or "GET").upper()
        if not url:
            return "http_fetch_error=No URL provided"
        try:
            if method == "GET":
                resp = requests.get(url, timeout=10)
            elif method == "POST":
                resp = requests.post(url, json=input_payload.get("data", {}), timeout=10)
            else:
                return f"http_fetch_error=Unsupported HTTP method: {method}"
            resp.raise_for_status()
            return f"http_fetch_status={resp.status_code},content={resp.text[:500]}"
        except Exception as e:
            logger.error(f"http_fetch error: {e}")
            return f"http_fetch_error={str(e)[:200]}"

    q = str(input_payload.get("question", "")).strip()
    if q.startswith("calc:") and calculator_enabled:
        return f"calculator={safe_calculate(q.replace('calc:', '', 1).strip())}"

    if "current time" in q.lower() or "time now" in q.lower():
        return f"utc_time={datetime.now(timezone.utc).isoformat()}"

    return ""


def build_prompt(question: str, context: str, tool_output: str, system_prompt: str = "") -> str:
    system_section = f"System Instruction:\n{system_prompt}\n\n" if system_prompt else ""
    return (
        f"{system_section}"
        "Use the retrieved context when relevant. If context is empty, answer from base model knowledge.\n\n"
        f"Context:\n{context or 'No context retrieved.'}\n\n"
        f"Tool Output:\n{tool_output or 'No tool used.'}\n\n"
        f"Question:\n{question}\n"
    )


def _first_non_empty_string(*values: Any) -> str | None:
    for value in values:
        if value is None:
            continue
        text_value = str(value).strip()
        if text_value:
            return text_value
    return None


def _normalize_provider(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    aliases = {
        "ollama": "ollama",
        "ollamachat": "ollama",
        "openai": "openai",
        "chatopenai": "openai",
        "openaichat": "openai",
        "anthropic": "anthropic",
        "anthropicchat": "anthropic",
        "chatanthropic": "anthropic",
        "azure": "azure_openai",
        "azureopenai": "azure_openai",
        "azure_openai": "azure_openai",
        "azureopenaichat": "azure_openai",
    }
    return aliases.get(normalized, normalized)


def resolve_llm_selection(job: dict[str, Any], input_payload: dict[str, Any], runtime_config: dict[str, Any] | None = None) -> tuple[str, str]:
    runtime = runtime_config or {}
    requested_provider = _first_non_empty_string(
        job.get("llm_provider"),
        input_payload.get("llmProvider"),
        input_payload.get("llm_provider"),
        input_payload.get("provider"),
        runtime.get("default_provider"),
    )
    default_provider = _normalize_provider(DEFAULT_LLM_PROVIDER) or "ollama"
    provider = _normalize_provider(requested_provider) or default_provider
    if provider not in {"ollama", "openai", "anthropic", "azure_openai"}:
        logger.warning("Unsupported llm provider requested, using default", extra={"provider": provider})
        provider = default_provider

    requested_model = _first_non_empty_string(
        job.get("llm_model"),
        input_payload.get("llmModel"),
        input_payload.get("llm_model"),
        input_payload.get("model"),
        runtime.get("default_model"),
    )
    fallback_model_map = {
        "openai": OPENAI_MODEL,
        "anthropic": ANTHROPIC_MODEL,
        "azure_openai": AZURE_OPENAI_DEPLOYMENT or OPENAI_MODEL,
        "ollama": OLLAMA_LLM_MODEL,
    }
    fallback_model = fallback_model_map.get(provider, OLLAMA_LLM_MODEL)
    model = requested_model or fallback_model
    return provider, model


def invoke_llm(prompt: str, provider: str, model: str) -> tuple[str, int]:
    provider_name = _normalize_provider(provider) or "ollama"
    if provider_name == "openai":
        if openai_client is None:
            raise RuntimeError("OPENAI_API_KEY is required when llm_provider is openai")
        response = openai_client.chat.completions.create(
            model=model or OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = response.choices[0].message.content or ""
        total_tokens = int(response.usage.total_tokens if response.usage else 0)
        return answer, total_tokens

    if provider_name == "anthropic":
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is required when llm_provider is anthropic")
        response = requests.post(
            f"{ANTHROPIC_BASE_URL}/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model or ANTHROPIC_MODEL,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        content_blocks = data.get("content") or []
        answer = ""
        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                answer += str(block.get("text") or "")
        usage = data.get("usage") or {}
        total_tokens = int(usage.get("input_tokens", 0)) + int(usage.get("output_tokens", 0))
        return answer, total_tokens

    if provider_name == "azure_openai":
        if not AZURE_OPENAI_API_KEY or not AZURE_OPENAI_ENDPOINT:
            raise RuntimeError("AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required when llm_provider is azure_openai")
        deployment = model or AZURE_OPENAI_DEPLOYMENT
        if not deployment:
            raise RuntimeError("AZURE_OPENAI_DEPLOYMENT (or llm_model) is required when llm_provider is azure_openai")
        base = AZURE_OPENAI_ENDPOINT.rstrip("/")
        url = f"{base}/openai/deployments/{deployment}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
        response = requests.post(
            url,
            headers={"api-key": AZURE_OPENAI_API_KEY, "content-type": "application/json"},
            json={"messages": [{"role": "user", "content": prompt}]},
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        choices = data.get("choices") or []
        answer = ""
        if choices and isinstance(choices[0], dict):
            answer = str(((choices[0].get("message") or {}).get("content")) or "")
        usage = data.get("usage") or {}
        total_tokens = int(usage.get("total_tokens", 0))
        return answer, total_tokens

    if provider_name != "ollama":
        raise RuntimeError(f"Unsupported llm provider: {provider_name}")

    # Ollama 0.6.0+ uses OpenAI-compatible /v1/chat/completions endpoint
    response = requests.post(
        ollama_url("chat/completions"),
        json={
            "model": model or OLLAMA_LLM_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    answer = ""
    if choices and isinstance(choices[0], dict):
        answer = str(((choices[0].get("message") or {}).get("content")) or "")
    # Usage tokens from OpenAI-compatible response
    usage = data.get("usage") or {}
    total_tokens = int(usage.get("total_tokens", 0))
    return answer, total_tokens


def estimate_tokens(*parts: str) -> int:
    return sum(len(part.split()) for part in parts if part)


def load_flow_definition(flow_version_id: str | None) -> dict[str, Any]:
    if not flow_version_id:
        return {}
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT json_definition FROM flow_versions WHERE id = :id"),
            {"id": flow_version_id},
        ).mappings().first()
    definition = row.get("json_definition") if row else {}
    return definition if isinstance(definition, dict) else {}


def infer_runtime_config(flow_definition: dict[str, Any]) -> dict[str, Any]:
    nodes = flow_definition.get("nodes") if isinstance(flow_definition, dict) else []
    runtime = {
        "enable_retrieval": True,
        "system_prompt": "",
        "default_provider": None,
        "default_model": None,
    }
    if not isinstance(nodes, list):
        return runtime

    for node in nodes:
        if isinstance(node, str):
            node_name = node.lower()
            node_inputs = {}
        elif isinstance(node, dict):
            node_data = node.get("data") if isinstance(node.get("data"), dict) else {}
            node_name = str(node_data.get("name") or node.get("name") or "").lower()
            node_inputs = node_data.get("inputs") if isinstance(node_data.get("inputs"), dict) else {}
        else:
            continue

        if "retriever" in node_name or "documentstore" in node_name or "vectorstore" in node_name or node_name == "rag":
            runtime["enable_retrieval"] = True

        if not runtime["system_prompt"]:
            runtime["system_prompt"] = str(node_inputs.get("systemPrompt") or node_inputs.get("prompt") or "").strip()

        provider_hints = [
            ("ollama", {"ollamachat", "ollamallm", "ollama"}),
            ("openai", {"openaichat", "chatopenai", "openai"}),
            ("anthropic", {"anthropic", "anthropicchat", "chatanthropic"}),
            ("azure_openai", {"azureopenai", "azureopenaichat", "azurechatopenai"}),
        ]
        for provider, aliases in provider_hints:
            if any(alias in node_name for alias in aliases):
                runtime["default_provider"] = provider
                model_hint = str(node_inputs.get("model") or node_inputs.get("modelName") or "").strip()
                if model_hint:
                    runtime["default_model"] = model_hint

    return runtime


def mark_execution(
    execution_log_id: str,
    status: str,
    elapsed_ms: int,
    tokens_used: int,
    response_text: str | None = None,
    error_message: str | None = None,
) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE execution_logs
                SET status = :status,
                    execution_time_ms = :execution_time_ms,
                    tokens_used = :tokens_used,
                    response_text = :response_text,
                    error_message = :error_message
                WHERE id = :id
                """
            ),
            {
                "id": execution_log_id,
                "status": status,
                "execution_time_ms": elapsed_ms,
                "tokens_used": tokens_used,
                "response_text": response_text,
                "error_message": error_message,
            },
        )


def mark_ingestion_processing(ingestion_job_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE ingestion_jobs
                SET status = 'processing',
                    error_message = NULL,
                    updated_at = NOW()
                WHERE id = :id
                """
            ),
            {"id": ingestion_job_id},
        )


def mark_ingestion_completed(ingestion_job_id: str, chunks_count: int) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE ingestion_jobs
                SET status = 'completed',
                    chunks_count = :chunks_count,
                    error_message = NULL,
                    updated_at = NOW()
                WHERE id = :id
                """
            ),
            {"id": ingestion_job_id, "chunks_count": chunks_count},
        )


def mark_ingestion_retrying(ingestion_job_id: str, error_message: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE ingestion_jobs
                SET status = 'retrying',
                    error_message = :error_message,
                    updated_at = NOW()
                WHERE id = :id
                """
            ),
            {"id": ingestion_job_id, "error_message": error_message},
        )


def mark_ingestion_failed(ingestion_job_id: str, error_message: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE ingestion_jobs
                SET status = 'failed',
                    error_message = :error_message,
                    updated_at = NOW()
                WHERE id = :id
                """
            ),
            {"id": ingestion_job_id, "error_message": error_message},
        )


def process_execution(job: dict[str, Any]) -> None:
    execution_log_id = job["execution_log_id"]
    tenant_id = job["tenant_id"]
    input_payload = job.get("input") or {}
    question = str(input_payload.get("question") or input_payload)
    runtime_config = infer_runtime_config(job.get("flow_definition") or load_flow_definition(job.get("flow_version_id")))
    llm_provider, llm_model = resolve_llm_selection(job, input_payload, runtime_config=runtime_config)
    tool_states = job.get("tool_states") if isinstance(job.get("tool_states"), dict) else {}

    start = time.perf_counter()
    mark_execution(
        execution_log_id=execution_log_id,
        status="running",
        elapsed_ms=0,
        tokens_used=0,
    )
    try:
        result = graph.invoke(
            {
                "tenant_id": tenant_id,
                "question": question,
                "input": input_payload,
                "enable_tools": job.get("enable_tools", True),
                "tool_states": tool_states,
                "enable_retrieval": runtime_config.get("enable_retrieval", False),
                "system_prompt": runtime_config.get("system_prompt", ""),
                "llm_provider": llm_provider,
                "llm_model": llm_model,
            }
        )
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        raise JobProcessingError(str(exc), elapsed_ms=elapsed_ms) from exc

    response_text = str(result.get("response", ""))
    tokens_used = int(result.get("tokens_used", 0))
    if tokens_used <= 0:
        tokens_used = estimate_tokens(question, response_text)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    mark_execution(
        execution_log_id=execution_log_id,
        status="completed",
        elapsed_ms=elapsed_ms,
        tokens_used=tokens_used,
        response_text=response_text,
    )


def process_ingestion(job: dict[str, Any]) -> None:
    tenant_id = job["tenant_id"]
    flow_id = job["flow_id"]
    docs = job.get("documents") or []
    ingestion_job_id = job.get("ingestion_job_id")

    if ingestion_job_id:
        mark_ingestion_processing(str(ingestion_job_id))
    chunks = ingest_documents(tenant_id=tenant_id, flow_id=flow_id, documents=docs)
    if ingestion_job_id:
        mark_ingestion_completed(str(ingestion_job_id), chunks_count=chunks)


def is_execution_job(queue_name: str, job: dict[str, Any]) -> bool:
    return queue_name == EXECUTION_QUEUE or job.get("job_type") == "execute_flow"


def is_ingestion_job(queue_name: str, job: dict[str, Any]) -> bool:
    return queue_name == INGEST_QUEUE or job.get("job_type") == "ingest_docs"


def get_retry_count(job: dict[str, Any]) -> int:
    try:
        return int(job.get("retry_count", 0))
    except Exception:
        return 0


def requeue_job(queue_name: str, job: dict[str, Any], error_message: str, retry_count: int) -> None:
    next_job = dict(job)
    next_job["retry_count"] = retry_count + 1
    next_job["last_error"] = error_message
    next_job["last_retry_at"] = datetime.now(timezone.utc).isoformat()
    redis_client.rpush(queue_name, json.dumps(next_job))


def push_to_dlq(queue_name: str, job: dict[str, Any], error_message: str) -> None:
    dlq_name = EXECUTION_DLQ if is_execution_job(queue_name, job) else INGESTION_DLQ
    dead_job = dict(job)
    dead_job["last_error"] = error_message
    dead_job["failed_at"] = datetime.now(timezone.utc).isoformat()
    dead_job["source_queue"] = queue_name
    redis_client.rpush(dlq_name, json.dumps(dead_job))


def handle_processing_failure(queue_name: str, job: dict[str, Any], error_message: str, elapsed_ms: int = 0) -> None:
    retry_count = get_retry_count(job)
    should_retry = retry_count < MAX_JOB_RETRIES

    if is_execution_job(queue_name, job):
        execution_log_id = job.get("execution_log_id")
        if execution_log_id:
            try:
                mark_execution(
                    execution_log_id=execution_log_id,
                    status="retrying" if should_retry else "failed",
                    elapsed_ms=elapsed_ms,
                    tokens_used=0,
                    error_message=error_message,
                )
            except Exception:
                logger.exception(
                    "Failed to update execution log after job failure",
                    extra={"execution_log_id": execution_log_id},
                )
    elif is_ingestion_job(queue_name, job):
        ingestion_job_id = job.get("ingestion_job_id")
        if ingestion_job_id:
            try:
                if should_retry:
                    mark_ingestion_retrying(str(ingestion_job_id), error_message=error_message)
                else:
                    mark_ingestion_failed(str(ingestion_job_id), error_message=error_message)
            except Exception:
                logger.exception(
                    "Failed to update ingestion job after job failure",
                    extra={"ingestion_job_id": ingestion_job_id},
                )

    if should_retry:
        requeue_job(queue_name=queue_name, job=job, error_message=error_message, retry_count=retry_count)
        logger.warning(
            "Job failed and requeued",
            extra={"queue": queue_name, "retry_count": retry_count + 1, "error": error_message},
        )
        return

    push_to_dlq(queue_name=queue_name, job=job, error_message=error_message)
    logger.error(
        "Job moved to dead-letter queue",
        extra={"queue": queue_name, "max_retries": MAX_JOB_RETRIES, "error": error_message},
    )


def rag_node(state: dict[str, Any]) -> dict[str, Any]:
    input_payload = state.get("input") or {}
    tenant_id = str(state.get("tenant_id", ""))
    question = str(state.get("question") or input_payload.get("question") or "")
    tool_states = state.get("tool_states") if isinstance(state.get("tool_states"), dict) else {}
    retrieval_enabled = bool(state.get("enable_retrieval", True)) and bool(tool_states.get("retriever", True))
    context = retrieve_context(tenant_id, question) if retrieval_enabled and tenant_id and question else ""
    return {
        "tenant_id": tenant_id,
        "question": question,
        "input": input_payload,
        "enable_tools": bool(state.get("enable_tools", True)),
        "tool_states": tool_states,
        "enable_retrieval": retrieval_enabled,
        "system_prompt": str(state.get("system_prompt") or ""),
        "llm_provider": str(state.get("llm_provider") or ""),
        "llm_model": str(state.get("llm_model") or ""),
        "context": context,
    }


def agent_node(state: dict[str, Any]) -> dict[str, Any]:
    input_payload = state.get("input") or {}
    question = str(state.get("question") or input_payload.get("question") or "")
    tool_states = state.get("tool_states") if isinstance(state.get("tool_states"), dict) else {}
    tool_output = run_tools(input_payload, tool_states=tool_states) if state.get("enable_tools", True) else ""
    prompt = build_prompt(
        question=question,
        context=str(state.get("context", "")),
        tool_output=tool_output,
        system_prompt=str(state.get("system_prompt") or ""),
    )
    llm_provider = str(state.get("llm_provider") or "ollama")
    llm_model = str(state.get("llm_model") or "")
    response_text, tokens_used = invoke_llm(prompt, provider=llm_provider, model=llm_model)
    if tokens_used <= 0:
        tokens_used = estimate_tokens(prompt, response_text)
    return {"response": response_text, "tokens_used": tokens_used}


def build_graph():
    builder = StateGraph(dict)
    builder.add_node("rag", rag_node)
    builder.add_node("agent", agent_node)
    builder.set_entry_point("rag")
    builder.add_edge("rag", "agent")
    builder.set_finish_point("agent")
    return builder.compile()


graph = build_graph()


def worker_loop() -> None:
    logger.info("Worker started")
    while True:
        message = redis_client.blpop([EXECUTION_QUEUE, INGEST_QUEUE], timeout=5)
        if not message:
            continue

        queue_name, raw_job = message
        try:
            job = json.loads(raw_job)
        except Exception:
            logger.exception("Invalid queue payload", extra={"queue": queue_name, "payload": raw_job})
            redis_client.rpush(
                EXECUTION_DLQ if queue_name == EXECUTION_QUEUE else INGESTION_DLQ,
                json.dumps(
                    {
                        "source_queue": queue_name,
                        "payload": raw_job,
                        "last_error": "Invalid JSON payload",
                        "failed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ),
            )
            continue

        try:
            if is_execution_job(queue_name, job):
                process_execution(job)
            elif is_ingestion_job(queue_name, job):
                process_ingestion(job)
            else:
                logger.warning("Unknown job", extra={"queue": queue_name, "job": job})
        except Exception as exc:
            elapsed_ms = exc.elapsed_ms if isinstance(exc, JobProcessingError) else 0
            error_message = str(exc)
            logger.exception("Failed to process queue payload", extra={"queue": queue_name, "job": job})
            try:
                handle_processing_failure(
                    queue_name=queue_name,
                    job=job,
                    error_message=error_message,
                    elapsed_ms=elapsed_ms,
                )
            except Exception:
                logger.exception("Retry/DLQ handling failed", extra={"queue": queue_name, "job": job})


@app.on_event("startup")
def startup_worker() -> None:
    thread = Thread(target=worker_loop, daemon=True)
    thread.start()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready() -> dict[str, Any]:
    checks: dict[str, str] = {
        "database": "unknown",
        "redis": "unknown",
        "qdrant": "unknown",
        "ollama": "unknown",
    }
    status = "ok"

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        status = "degraded"

    try:
        redis_client.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
        status = "degraded"

    try:
        qdrant_resp = requests.get(f"{QDRANT_URL.rstrip('/')}/collections", timeout=5)
        qdrant_resp.raise_for_status()
        checks["qdrant"] = "ok"
    except Exception:
        checks["qdrant"] = "error"
        status = "degraded"

    try:
        ollama_resp = requests.get(ollama_url("models"), timeout=5)
        ollama_resp.raise_for_status()
        checks["ollama"] = "ok"
    except Exception:
        checks["ollama"] = "error"
        status = "degraded"

    payload = {"status": status, "checks": checks}
    if status != "ok":
        raise HTTPException(status_code=503, detail=payload)
    return payload
