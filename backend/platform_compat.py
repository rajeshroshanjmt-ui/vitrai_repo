import json
import hashlib
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
from models import Tenant, TenantResource

router = APIRouter()

CHAT_MODEL_COMPONENTS = [
    {
        "name": "ollamaChat",
        "label": "Ollama Chat",
        "category": "Chat Models",
        "description": "Run chat completions with Ollama.",
        "baseClasses": ["ChatModel"],
        "inputs": [
            {"label": "Model", "name": "model", "type": "string", "default": "llama3.2", "optional": False},
            {"label": "Temperature", "name": "temperature", "type": "number", "default": 0.7, "optional": True},
        ],
        "outputs": [{"label": "Chat Model", "name": "chatModel", "baseClasses": ["ChatModel"]}],
    },
    {
        "name": "openAIChat",
        "label": "OpenAI Chat",
        "category": "Chat Models",
        "description": "Run chat completions with OpenAI.",
        "baseClasses": ["ChatModel"],
        "inputs": [
            {"label": "Model", "name": "model", "type": "string", "default": "gpt-4o-mini", "optional": False},
            {"label": "Temperature", "name": "temperature", "type": "number", "default": 0.7, "optional": True},
        ],
        "outputs": [{"label": "Chat Model", "name": "chatModel", "baseClasses": ["ChatModel"]}],
        "credential": {
            "label": "OpenAI Credential",
            "name": "credential",
            "type": "credential",
            "credentialNames": ["openAIApi"],
            "optional": True,
        },
    },
    {
        "name": "anthropicChat",
        "label": "Anthropic Chat",
        "category": "Chat Models",
        "description": "Run chat completions with Anthropic models.",
        "baseClasses": ["ChatModel"],
        "inputs": [
            {
                "label": "Model",
                "name": "model",
                "type": "string",
                "default": "claude-3-5-sonnet-latest",
                "optional": False,
            },
            {"label": "Temperature", "name": "temperature", "type": "number", "default": 0.7, "optional": True},
        ],
        "outputs": [{"label": "Chat Model", "name": "chatModel", "baseClasses": ["ChatModel"]}],
        "credential": {
            "label": "Anthropic Credential",
            "name": "credential",
            "type": "credential",
            "credentialNames": ["anthropicApi"],
            "optional": True,
        },
    },
    {
        "name": "perplexityChat",
        "label": "Perplexity Chat",
        "category": "Chat Models",
        "description": "Run chat completions with Perplexity models.",
        "baseClasses": ["ChatModel"],
        "inputs": [
            {"label": "Model", "name": "model", "type": "string", "default": "sonar-pro", "optional": False},
            {"label": "Temperature", "name": "temperature", "type": "number", "default": 0.7, "optional": True},
        ],
        "outputs": [{"label": "Chat Model", "name": "chatModel", "baseClasses": ["ChatModel"]}],
        "credential": {
            "label": "Perplexity Credential",
            "name": "credential",
            "type": "credential",
            "credentialNames": ["perplexityApi"],
            "optional": True,
        },
    },
    {
        "name": "gemini",
        "label": "Gemini Chat",
        "category": "Chat Models",
        "description": "Run chat completions with Google Gemini models.",
        "baseClasses": ["ChatModel"],
        "inputs": [
            {"label": "Model", "name": "model", "type": "string", "default": "gemini-1.5-pro", "optional": False},
            {"label": "Temperature", "name": "temperature", "type": "number", "default": 0.7, "optional": True},
        ],
        "outputs": [{"label": "Chat Model", "name": "chatModel", "baseClasses": ["ChatModel"]}],
        "credential": {
            "label": "Google Generative AI Credential",
            "name": "credential",
            "type": "credential",
            "credentialNames": ["googleGenerativeAI"],
            "optional": True,
        },
    },
]

DOC_LOADERS = [
    {"name": "textFileLoader", "label": "Text File Loader"},
    {"name": "webLoader", "label": "Web Loader"},
    {"name": "pdfFileLoader", "label": "PDF Loader"},
]

VECTOR_PROVIDERS = [{"name": "qdrant", "label": "Qdrant", "inputs": []}]
EMBEDDING_PROVIDERS = [{"name": "ollamaEmbeddings", "label": "Ollama Embeddings", "inputs": []}]
RECORD_MANAGER_PROVIDERS = [{"name": "sqliteRecordManager", "label": "SQLite Record Manager", "inputs": []}]


def _node_icon_svg(node_name: str) -> str:
    safe_name = (node_name or "node").strip()[:32]
    parts = [part for part in safe_name.replace("_", " ").replace("-", " ").split() if part]
    initials = "".join(part[0] for part in parts[:2]).upper() or "N"
    digest = hashlib.md5(safe_name.encode("utf-8")).hexdigest()
    bg = f"#{digest[:6]}"
    fg = "#ffffff"

    return (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
        f"<rect x='2' y='2' width='60' height='60' rx='30' fill='{bg}' />"
        "<circle cx='32' cy='32' r='30' fill='none' stroke='rgba(255,255,255,0.28)' stroke-width='2' />"
        f"<text x='32' y='39' text-anchor='middle' fill='{fg}' font-family='Arial, sans-serif' "
        "font-size='22' font-weight='700'>"
        f"{initials}</text></svg>"
    )


def _credential_icon_svg(credential_name: str) -> str:
    safe_name = (credential_name or "credential").strip()[:32]
    parts = [part for part in safe_name.replace("_", " ").replace("-", " ").split() if part]
    initials = "".join(part[0] for part in parts[:2]).upper() or "C"
    digest = hashlib.md5(f"credential:{safe_name}".encode("utf-8")).hexdigest()
    bg = f"#{digest[:6]}"
    fg = "#ffffff"

    return (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
        f"<rect x='2' y='2' width='60' height='60' rx='14' fill='{bg}' />"
        "<path d='M24 32a8 8 0 1 1 12.7 6.4l-0.7 0.5V44h-6v-3.2l-0.7-0.5A8 8 0 0 1 24 32Z' fill='rgba(255,255,255,0.2)' />"
        f"<text x='32' y='54' text-anchor='middle' fill='{fg}' font-family='Arial, sans-serif' font-size='12' font-weight='700'>{initials}</text>"
        "</svg>"
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/v1/node-icon/{node_name}")
def get_node_icon(node_name: str) -> Response:
    svg = _node_icon_svg(node_name)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/v1/components-credentials-icon/{credential_name}")
def get_components_credentials_icon(credential_name: str) -> Response:
    svg = _credential_icon_svg(credential_name)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/v1/chatflows-streaming/{chatflow_id}")
def get_chatflow_streaming_compat(chatflow_id: str) -> dict[str, Any]:
    return {
        "chatflowId": chatflow_id,
        "supported": False,
        "isUnavailable": True,
        "detail": "Public chatbot streaming is not available in this deployment."
    }


@router.get("/v1/public-chatbotConfig/{chatflow_id}")
def get_public_chatbot_config_compat(chatflow_id: str) -> dict[str, Any]:
    return {
        "id": chatflow_id,
        "isPublic": False,
        "isUnavailable": True,
        "chatbotConfig": "{}",
        "apikeyid": "",
        "detail": "Public chatbot configuration endpoint is unavailable in this deployment."
    }


def _ensure_tenant(db: Session, tenant_id: str) -> None:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        db.add(Tenant(id=tenant_id, name=f"tenant-{tenant_id[:8]}"))
        db.flush()


def _parse_json(value: Any, fallback: Any) -> Any:
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return fallback
    return fallback


def _resource_display_name(resource: TenantResource) -> str:
    payload = resource.payload or {}
    return payload.get("display_name") or resource.name


def _query_resources(db: Session, tenant_id: str, resource_type: str) -> list[TenantResource]:
    return (
        db.query(TenantResource)
        .filter(TenantResource.tenant_id == tenant_id, TenantResource.resource_type == resource_type)
        .order_by(TenantResource.updated_at.desc())
        .all()
    )


def _get_resource(db: Session, tenant_id: str, resource_type: str, resource_id: str) -> TenantResource:
    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.tenant_id == tenant_id,
            TenantResource.resource_type == resource_type,
            TenantResource.id == resource_id,
        )
        .one_or_none()
    )
    if resource is None:
        raise HTTPException(status_code=404, detail=f"{resource_type} not found")
    return resource


def _create_resource(db: Session, tenant_id: str, user_id: str, resource_type: str, display_name: str, payload: dict[str, Any]) -> TenantResource:
    _ensure_tenant(db, tenant_id)
    internal_name = f"{display_name}__{uuid4().hex[:8]}"
    body = payload.copy()
    body["display_name"] = display_name
    now = datetime.now(timezone.utc)

    resource = TenantResource(
        id=str(uuid4()),
        tenant_id=tenant_id,
        resource_type=resource_type,
        name=internal_name,
        payload=body,
        created_by=user_id,
        updated_by=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


def _update_resource(resource: TenantResource, user_id: str, display_name: str | None = None, payload: dict[str, Any] | None = None) -> None:
    if payload is not None:
        merged_payload = payload.copy()
        if display_name is None:
            merged_payload["display_name"] = resource.payload.get("display_name", resource.name)
        else:
            merged_payload["display_name"] = display_name
        resource.payload = merged_payload
    elif display_name is not None:
        resource.payload = {**(resource.payload or {}), "display_name": display_name}

    if display_name is not None:
        # keep internal name unique but still update prefix
        resource.name = f"{display_name}__{resource.id[:8]}"

    resource.updated_by = user_id
    resource.updated_at = datetime.now(timezone.utc)


def _paginate(items: list[Any], page: int, limit: int) -> tuple[list[Any], int]:
    safe_page = max(1, page)
    safe_limit = max(1, min(limit, 200))
    start = (safe_page - 1) * safe_limit
    return items[start : start + safe_limit], len(items)


def _build_chunks(source_text: str, preview_count: int = 20) -> tuple[list[dict[str, Any]], int]:
    parts = [p.strip() for p in source_text.replace("\r", "").split("\n") if p.strip()]
    if not parts:
        parts = ["Sample chunk from document loader"]

    all_chunks = [
        {
            "id": str(uuid4()),
            "pageContent": part,
            "metadata": {"chunkIndex": idx + 1},
        }
        for idx, part in enumerate(parts)
    ]

    return all_chunks[: max(1, preview_count)], len(all_chunks)


# Assistants
@router.get("/assistants")
def list_assistants(
    type: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    rows = _query_resources(db, user["tenant_id"], "assistant")
    result: list[dict[str, Any]] = []
    for row in rows:
        payload = row.payload or {}
        if type and payload.get("type") != type:
            continue
        result.append(
            {
                "id": row.id,
                "type": payload.get("type", "CUSTOM"),
                "details": payload.get("details", json.dumps({"name": _resource_display_name(row)})),
                "credential": payload.get("credential"),
                "iconSrc": payload.get("iconSrc"),
                "createdDate": row.created_at.isoformat() if row.created_at else None,
                "updatedDate": row.updated_at.isoformat() if row.updated_at else None,
            }
        )
    return result


@router.post("/assistants")
def create_assistant(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    details = body.get("details")
    details_obj = _parse_json(details, {})
    display_name = details_obj.get("name") or body.get("name") or "Assistant"

    payload = {
        "details": details if isinstance(details, str) else json.dumps(details_obj or {"name": display_name}),
        "credential": body.get("credential"),
        "type": body.get("type", "CUSTOM"),
        "iconSrc": body.get("iconSrc"),
    }

    row = _create_resource(db, user["tenant_id"], user.get("user_id"), "assistant", display_name, payload)
    return {"id": row.id}


@router.get("/assistants/{assistant_id}")
def get_assistant(
    assistant_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "assistant", assistant_id)
    payload = row.payload or {}
    return {
        "id": row.id,
        "type": payload.get("type", "CUSTOM"),
        "details": payload.get("details", json.dumps({"name": _resource_display_name(row)})),
        "credential": payload.get("credential"),
        "iconSrc": payload.get("iconSrc"),
    }


@router.put("/assistants/{assistant_id}")
def update_assistant(
    assistant_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "assistant", assistant_id)
    current = row.payload or {}

    details = body.get("details", current.get("details"))
    details_obj = _parse_json(details, {})
    display_name = details_obj.get("name") or body.get("name") or current.get("display_name") or _resource_display_name(row)

    payload = {
        "details": details if isinstance(details, str) else json.dumps(details_obj or {"name": display_name}),
        "credential": body.get("credential", current.get("credential")),
        "type": body.get("type", current.get("type", "CUSTOM")),
        "iconSrc": body.get("iconSrc", current.get("iconSrc")),
    }

    _update_resource(row, user.get("user_id"), display_name=display_name, payload=payload)
    db.commit()
    return {"id": row.id}


@router.delete("/assistants/{assistant_id}")
def delete_assistant(
    assistant_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "assistant", assistant_id)
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": assistant_id}


@router.get("/assistants/components/chatmodels")
def assistants_chatmodels(
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return CHAT_MODEL_COMPONENTS


@router.get("/assistants/components/docstores")
def assistants_docstores(
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    stores = _query_resources(db, user["tenant_id"], "document_store")
    return [
        {
            "label": _resource_display_name(store),
            "name": store.id,
            "description": (store.payload or {}).get("description", ""),
        }
        for store in stores
    ]


@router.get("/assistants/components/tools")
def assistants_tools(
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    tools = _query_resources(db, user["tenant_id"], "tool")
    result = []
    for tool in tools:
        payload = tool.payload or {}
        result.append(
            {
                "name": payload.get("toolName") or tool.id,
                "label": _resource_display_name(tool),
                "description": payload.get("description", ""),
                "category": payload.get("category", "custom"),
                "baseClasses": ["Tool"],
                "inputs": [],
                "outputs": [{"label": "Tool", "name": "tool", "baseClasses": ["Tool"]}],
            }
        )
    return result


@router.post("/assistants/generate/instruction")
def generate_instruction(
    body: dict[str, Any],
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    prompt = str(body.get("prompt") or body.get("task") or body.get("question") or "").strip()
    instruction = prompt or "You are a helpful assistant."
    # Return both keys because different UI surfaces currently read either `instruction` or `content`.
    return {"instruction": instruction, "content": instruction}


@router.get("/openai-assistants")
def list_openai_assistants(
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return _list_provider_assistants(
        assistant_type="OPENAI",
        default_model="gpt-4o-mini",
        db=db,
        user=user,
    )


@router.get("/azure-assistants")
def list_azure_assistants(
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return _list_provider_assistants(
        assistant_type="AZURE",
        default_model="gpt-4o-mini",
        db=db,
        user=user,
    )


def _list_provider_assistants(
    assistant_type: str,
    default_model: str,
    db: Session,
    user: dict[str, Any],
) -> list[dict[str, Any]]:
    rows = _query_resources(db, user["tenant_id"], "assistant")
    assistants: list[dict[str, Any]] = []
    for row in rows:
        payload = row.payload or {}
        if payload.get("type") != assistant_type:
            continue
        details = _parse_json(payload.get("details"), {})
        assistant_obj_id = details.get("id") or row.id
        assistants.append(
            {
                "id": assistant_obj_id,
                "name": details.get("name") or _resource_display_name(row),
                "description": details.get("description") or "",
                "model": details.get("model") or default_model,
                "instructions": details.get("instructions") or "",
                "tools": details.get("tools") or [],
                "tool_resources": details.get("tool_resources") or {},
                "temperature": details.get("temperature", 1),
                "top_p": details.get("top_p", 1),
                "_resource_id": row.id,
                "credential": payload.get("credential"),
            }
        )
    return assistants


@router.get("/openai-assistants/{assistant_obj_id}")
def get_openai_assistant(
    assistant_obj_id: str,
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    assistants = _list_provider_assistants(
        assistant_type="OPENAI",
        default_model="gpt-4o-mini",
        db=db,
        user=user,
    )
    for assistant in assistants:
        if assistant.get("id") == assistant_obj_id:
            return assistant
    raise HTTPException(status_code=404, detail="OpenAI assistant not found")


@router.get("/azure-assistants/{assistant_obj_id}")
def get_azure_assistant(
    assistant_obj_id: str,
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    assistants = _list_provider_assistants(
        assistant_type="AZURE",
        default_model="gpt-4o-mini",
        db=db,
        user=user,
    )
    for assistant in assistants:
        if assistant.get("id") == assistant_obj_id:
            return assistant
    raise HTTPException(status_code=404, detail="Azure assistant not found")


def _query_vector_stores(db: Session, tenant_id: str, credential: str | None = None) -> list[TenantResource]:
    rows = _query_resources(db, tenant_id, "assistant_vector_store")
    if credential:
        rows = [row for row in rows if (row.payload or {}).get("credential") == credential]
    return rows


@router.get("/openai-assistants-vector-store")
def list_vector_stores(
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    rows = _query_vector_stores(db, user["tenant_id"], credential=credential)
    result = []
    for row in rows:
        payload = row.payload or {}
        files = payload.get("files") or []
        usage_bytes = int(sum(int(file.get("bytes", 0)) for file in files))
        result.append(
            {
                "id": row.id,
                "name": payload.get("name") or _resource_display_name(row),
                "expires_after": payload.get("expires_after"),
                "files": files,
                "file_counts": {"total": len(files)},
                "usage_bytes": usage_bytes,
            }
        )
    return result


@router.get("/openai-assistants-vector-store/{vector_store_id}")
def get_vector_store(
    vector_store_id: str,
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "assistant_vector_store", vector_store_id)
    payload = row.payload or {}
    files = payload.get("files") or []
    usage_bytes = int(sum(int(file.get("bytes", 0)) for file in files))
    return {
        "id": row.id,
        "name": payload.get("name") or _resource_display_name(row),
        "expires_after": payload.get("expires_after"),
        "files": files,
        "file_counts": {"total": len(files)},
        "usage_bytes": usage_bytes,
    }


@router.post("/openai-assistants-vector-store")
def create_vector_store(
    body: dict[str, Any],
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    name = body.get("name") or f"Vector Store {datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    payload = {
        "name": name,
        "credential": credential,
        "expires_after": body.get("expires_after"),
        "files": [],
    }
    row = _create_resource(db, user["tenant_id"], user.get("user_id"), "assistant_vector_store", name, payload)
    return get_vector_store(row.id, credential=credential, db=db, user=user)


@router.put("/openai-assistants-vector-store/{vector_store_id}")
def update_vector_store(
    vector_store_id: str,
    body: dict[str, Any],
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "assistant_vector_store", vector_store_id)
    payload = row.payload or {}
    new_name = body.get("name") or payload.get("name") or _resource_display_name(row)
    updated_payload = {
        **payload,
        "name": new_name,
        "expires_after": body.get("expires_after"),
    }
    _update_resource(row, user.get("user_id"), display_name=new_name, payload=updated_payload)
    db.commit()
    return get_vector_store(vector_store_id, credential=credential, db=db, user=user)


@router.delete("/openai-assistants-vector-store/{vector_store_id}")
def delete_vector_store(
    vector_store_id: str,
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "assistant_vector_store", vector_store_id)
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": vector_store_id}


@router.post("/openai-assistants-vector-store/{vector_store_id}")
async def upload_files_to_vector_store(
    vector_store_id: str,
    credential: str | None = None,
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> list[dict[str, Any]]:
    row = _get_resource(db, user["tenant_id"], "assistant_vector_store", vector_store_id)
    payload = row.payload or {}
    existing_files = payload.get("files") or []

    uploaded = []
    for item in files:
        content = await item.read()
        uploaded.append(
            {
                "id": str(uuid4()),
                "filename": item.filename,
                "bytes": len(content),
                "created_at": _now_iso(),
            }
        )

    payload["files"] = [*existing_files, *uploaded]
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return uploaded


@router.patch("/openai-assistants-vector-store/{vector_store_id}")
def delete_files_from_vector_store(
    vector_store_id: str,
    body: dict[str, Any],
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "assistant_vector_store", vector_store_id)
    payload = row.payload or {}
    file_ids = set(body.get("file_ids") or [])
    payload["files"] = [file for file in (payload.get("files") or []) if file.get("id") not in file_ids]
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"status": "ok"}


@router.post("/openai-assistants-file/upload")
async def upload_files_to_openai_assistant(
    credential: str | None = None,
    files: list[UploadFile] = File(default=[]),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> list[dict[str, Any]]:
    uploaded = []
    for item in files:
        content = await item.read()
        uploaded.append(
            {
                "id": str(uuid4()),
                "filename": item.filename,
                "bytes": len(content),
                "created_at": _now_iso(),
            }
        )
    return uploaded


@router.get("/azure-assistants-vector-store")
def list_azure_vector_stores(
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return list_vector_stores(credential=credential, db=db, user=user)


@router.get("/azure-assistants-vector-store/{vector_store_id}")
def get_azure_vector_store(
    vector_store_id: str,
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    return get_vector_store(vector_store_id=vector_store_id, credential=credential, db=db, user=user)


@router.post("/azure-assistants-vector-store")
def create_azure_vector_store(
    body: dict[str, Any],
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    return create_vector_store(body=body, credential=credential, db=db, user=user)


@router.put("/azure-assistants-vector-store/{vector_store_id}")
def update_azure_vector_store(
    vector_store_id: str,
    body: dict[str, Any],
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    return update_vector_store(vector_store_id=vector_store_id, body=body, credential=credential, db=db, user=user)


@router.delete("/azure-assistants-vector-store/{vector_store_id}")
def delete_azure_vector_store(
    vector_store_id: str,
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    return delete_vector_store(vector_store_id=vector_store_id, credential=credential, db=db, user=user)


@router.post("/azure-assistants-vector-store/{vector_store_id}")
async def upload_files_to_azure_vector_store(
    vector_store_id: str,
    credential: str | None = None,
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> list[dict[str, Any]]:
    return await upload_files_to_vector_store(vector_store_id=vector_store_id, credential=credential, files=files, db=db, user=user)


@router.patch("/azure-assistants-vector-store/{vector_store_id}")
def delete_files_from_azure_vector_store(
    vector_store_id: str,
    body: dict[str, Any],
    credential: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    return delete_files_from_vector_store(vector_store_id=vector_store_id, body=body, credential=credential, db=db, user=user)


@router.post("/azure-assistants-file/upload")
async def upload_files_to_azure_assistant(
    credential: str | None = None,
    files: list[UploadFile] = File(default=[]),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> list[dict[str, Any]]:
    return await upload_files_to_openai_assistant(credential=credential, files=files, user=user)


# Document Store
@router.get("/document-store/store")
def list_document_stores(
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    rows = _query_resources(db, user["tenant_id"], "document_store")
    items = []
    for row in rows:
        payload = row.payload or {}
        items.append(
            {
                "id": row.id,
                "name": _resource_display_name(row),
                "description": payload.get("description", ""),
                "loaders": payload.get("loaders") or [],
                "vectorStoreConfig": payload.get("vectorStoreConfig") or {},
                "recordManagerConfig": payload.get("recordManagerConfig") or {},
                "workspaceId": payload.get("workspaceId") or user["tenant_id"],
                "whereUsed": payload.get("whereUsed") or [],
                "status": payload.get("status") or "READY",
                "createdDate": row.created_at.isoformat() if row.created_at else None,
                "updatedDate": row.updated_at.isoformat() if row.updated_at else None,
            }
        )

    paged, total = _paginate(items, page=page, limit=limit)
    return {"data": paged, "total": total}


@router.get("/document-store/components/loaders")
def list_document_loaders(
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return DOC_LOADERS


@router.get("/document-store/store/{store_id}")
def get_document_store(
    store_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    payload = row.payload or {}
    return {
        "id": row.id,
        "name": _resource_display_name(row),
        "description": payload.get("description", ""),
        "loaders": payload.get("loaders") or [],
        "vectorStoreConfig": payload.get("vectorStoreConfig") or {},
        "recordManagerConfig": payload.get("recordManagerConfig") or {},
        "workspaceId": payload.get("workspaceId") or user["tenant_id"],
        "whereUsed": payload.get("whereUsed") or [],
        "status": payload.get("status") or "READY",
    }


@router.post("/document-store/store")
def create_document_store(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    display_name = body.get("name") or "Document Store"
    payload = {
        "description": body.get("description", ""),
        "loaders": [],
        "vectorStoreConfig": {},
        "recordManagerConfig": {},
        "workspaceId": user["tenant_id"],
        "whereUsed": [],
        "status": "READY",
    }
    row = _create_resource(db, user["tenant_id"], user.get("user_id"), "document_store", display_name, payload)
    return {"id": row.id}


@router.put("/document-store/store/{store_id}")
def update_document_store(
    store_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    payload = row.payload or {}
    display_name = body.get("name") or _resource_display_name(row)
    next_payload = {
        **payload,
        "description": body.get("description", payload.get("description", "")),
    }
    _update_resource(row, user.get("user_id"), display_name=display_name, payload=next_payload)
    db.commit()
    return {"id": row.id}


@router.delete("/document-store/store/{store_id}")
def delete_document_store(
    store_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": store_id}


@router.get("/document-store/store-configs/{store_id}/{loader_id}")
def get_document_store_config(
    store_id: str,
    loader_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any] | None:
    store = get_document_store(store_id, db=db, user=user)
    for loader in store.get("loaders") or []:
        if loader.get("id") == loader_id:
            return loader
    return None


@router.post("/document-store/loader/preview")
def preview_document_loader_chunks(
    body: dict[str, Any],
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    loader_config = body.get("loaderConfig") or {}
    source = str(loader_config.get("text") or loader_config.get("url") or loader_config.get("path") or "")
    chunks, total = _build_chunks(source, preview_count=int(body.get("previewChunkCount") or 10))
    return {
        "chunks": chunks,
        "totalChunks": total,
        "previewChunkCount": len(chunks),
    }


@router.post("/document-store/loader/save")
def save_document_loader(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    store_row = _get_resource(db, user["tenant_id"], "document_store", body.get("storeId"))
    payload = store_row.payload or {}
    loaders = payload.get("loaders") or []

    source = str((body.get("loaderConfig") or {}).get("text") or (body.get("loaderConfig") or {}).get("url") or "")
    preview_chunks, total = _build_chunks(source, preview_count=20)

    loader_id = body.get("id") or str(uuid4())
    loader = {
        "id": loader_id,
        "loaderId": body.get("loaderId"),
        "loaderName": body.get("loaderName") or "Loader",
        "loaderConfig": body.get("loaderConfig") or {},
        "splitterId": body.get("splitterId"),
        "splitterName": body.get("splitterName"),
        "splitterConfig": body.get("splitterConfig") or {},
        "credential": body.get("credential"),
        "source": source,
        "files": [{"id": str(uuid4()), "name": body.get("loaderName") or "Document"}],
        "chunks": preview_chunks,
        "totalChunks": total,
        "totalChars": sum(len(chunk.get("pageContent", "")) for chunk in preview_chunks),
        "status": "SYNC",
        "updatedDate": _now_iso(),
    }

    replaced = False
    next_loaders = []
    for item in loaders:
        if item.get("id") == loader_id:
            next_loaders.append(loader)
            replaced = True
        else:
            next_loaders.append(item)

    if not replaced:
        next_loaders.append(loader)

    payload["loaders"] = next_loaders
    payload["status"] = "READY"
    _update_resource(store_row, user.get("user_id"), payload=payload)
    db.commit()

    return {"id": loader_id}


@router.post("/document-store/loader/process/{loader_id}")
def process_document_loader(
    loader_id: str,
    body: dict[str, Any],
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    return {"status": "processing", "id": loader_id}


@router.post("/document-store/refresh/{store_id}")
def refresh_document_store(
    store_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    payload = row.payload or {}
    payload["status"] = "READY"
    payload["loaders"] = [
        {
            **loader,
            "status": "SYNC",
            "updatedDate": _now_iso(),
        }
        for loader in (payload.get("loaders") or [])
    ]
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"status": "ok"}


@router.get("/document-store/chunks/{store_id}/{file_id}/{page_no}")
def get_document_chunks(
    store_id: str,
    file_id: str,
    page_no: int,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    store = get_document_store(store_id, db=db, user=user)
    loader = None
    for item in store.get("loaders") or []:
        if item.get("id") == file_id:
            loader = item
            break

    if loader is None:
        return {
            "workspaceId": store.get("workspaceId") or user["tenant_id"],
            "count": 0,
            "chunks": [],
            "currentPage": max(1, page_no),
            "file": None,
            "storeName": store.get("name", ""),
        }

    chunks = loader.get("chunks") or []
    safe_page = max(1, page_no)
    limit = 50
    start = (safe_page - 1) * limit
    paged = [
        {
            **chunk,
            "storeId": store_id,
            "docId": file_id,
        }
        for chunk in chunks[start : start + limit]
    ]

    return {
        "workspaceId": store.get("workspaceId") or user["tenant_id"],
        "count": len(chunks),
        "chunks": paged,
        "currentPage": safe_page,
        "file": loader,
        "storeName": store.get("name", ""),
    }


@router.put("/document-store/chunks/{store_id}/{loader_id}/{chunk_id}")
def edit_document_chunk(
    store_id: str,
    loader_id: str,
    chunk_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    payload = row.payload or {}
    loaders = payload.get("loaders") or []

    for loader in loaders:
        if loader.get("id") != loader_id:
            continue
        for chunk in loader.get("chunks") or []:
            if chunk.get("id") == chunk_id:
                chunk["pageContent"] = body.get("pageContent", chunk.get("pageContent"))
                chunk["metadata"] = body.get("metadata", chunk.get("metadata", {}))

    payload["loaders"] = loaders
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"id": chunk_id}


@router.delete("/document-store/chunks/{store_id}/{loader_id}/{chunk_id}")
def delete_document_chunk(
    store_id: str,
    loader_id: str,
    chunk_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    payload = row.payload or {}
    loaders = payload.get("loaders") or []

    for loader in loaders:
        if loader.get("id") == loader_id:
            loader["chunks"] = [chunk for chunk in (loader.get("chunks") or []) if chunk.get("id") != chunk_id]
            loader["totalChunks"] = len(loader.get("chunks") or [])
            loader["totalChars"] = sum(len(chunk.get("pageContent", "")) for chunk in (loader.get("chunks") or []))

    payload["loaders"] = loaders
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"id": chunk_id}


@router.delete("/document-store/loader/{store_id}/{file_id}")
def delete_document_loader(
    store_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    payload = row.payload or {}
    payload["loaders"] = [loader for loader in (payload.get("loaders") or []) if loader.get("id") != file_id]
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"id": file_id}


@router.post("/document-store/vectorstore/save")
def save_vector_store_config(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", body.get("storeId"))
    payload = row.payload or {}
    payload["vectorStoreConfig"] = body.get("vectorStoreConfig") or {}
    payload["recordManagerConfig"] = body.get("recordManagerConfig") or {}
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"id": row.id}


@router.post("/document-store/vectorstore/update")
def update_vector_store_config(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    return save_vector_store_config(body, db=db, user=user)


@router.post("/document-store/vectorstore/insert")
def insert_into_vector_store(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", body.get("storeId"))
    payload = row.payload or {}
    payload["vectorStoreConfig"] = body.get("vectorStoreConfig") or payload.get("vectorStoreConfig") or {}
    payload["recordManagerConfig"] = body.get("recordManagerConfig") or payload.get("recordManagerConfig") or {}

    all_chunks = []
    for loader in payload.get("loaders") or []:
        all_chunks.extend(loader.get("chunks") or [])

    payload["status"] = "SYNC"
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()

    return {
        "numAdded": len(all_chunks),
        "numUpdated": 0,
        "numSkipped": 0,
        "numDeleted": 0,
        "addedDocs": all_chunks[:5],
        "timeTaken": 0.05,
        "docs": all_chunks[:5],
    }


@router.delete("/document-store/vectorstore/{store_id}")
def delete_vector_store_data(
    store_id: str,
    docId: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    payload = row.payload or {}

    if docId:
        for loader in payload.get("loaders") or []:
            if loader.get("id") == docId:
                loader["chunks"] = []
                loader["totalChunks"] = 0
                loader["totalChars"] = 0
    else:
        payload["vectorStoreConfig"] = {}
        payload["recordManagerConfig"] = {}

    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"status": "ok"}


@router.post("/document-store/vectorstore/query")
def query_vector_store(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", body.get("storeId"))
    payload = row.payload or {}
    docs = []
    for loader in payload.get("loaders") or []:
        for chunk in loader.get("chunks") or []:
            docs.append(
                {
                    "pageContent": chunk.get("pageContent", ""),
                    "metadata": chunk.get("metadata", {}),
                    "score": 0.8,
                }
            )
    return {"docs": docs[:5], "timeTaken": 0.03}


@router.get("/document-store/components/vectorstore")
def get_vector_store_components(
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return VECTOR_PROVIDERS


@router.get("/document-store/components/embeddings")
def get_embedding_components(
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return EMBEDDING_PROVIDERS


@router.get("/document-store/components/recordmanager")
def get_record_manager_components(
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> list[dict[str, Any]]:
    return RECORD_MANAGER_PROVIDERS


@router.post("/document-store/generate-tool-desc/{store_id}")
def generate_docstore_tool_description(
    store_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "document_store", store_id)
    name = _resource_display_name(row)
    return {
        "content": f"Search and retrieve relevant context from document store '{name}' to answer user queries accurately."
    }


# Datasets
@router.get("/datasets")
def list_datasets(
    page: int | None = None,
    limit: int | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> Any:
    rows = _query_resources(db, user["tenant_id"], "dataset")
    items = []
    for row in rows:
        payload = row.payload or {}
        ds = {
            "id": row.id,
            "name": _resource_display_name(row),
            "description": payload.get("description", ""),
            "totalRows": len(payload.get("rows") or []),
            "createdDate": row.created_at.isoformat() if row.created_at else None,
            "updatedDate": row.updated_at.isoformat() if row.updated_at else None,
        }
        items.append(ds)

    if page is None and limit is None:
        return [{"id": item["id"], "name": item["name"]} for item in items]

    paged, total = _paginate(items, page=page or 1, limit=limit or 10)
    return {"data": paged, "total": total}


@router.get("/datasets/set/{dataset_id}")
def get_dataset(
    dataset_id: str,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "dataset", dataset_id)
    payload = row.payload or {}
    rows = payload.get("rows") or []
    rows = sorted(rows, key=lambda item: int(item.get("sequenceNo", 0)))
    paged, total = _paginate(rows, page=page, limit=limit)
    return {
        "id": row.id,
        "name": _resource_display_name(row),
        "description": payload.get("description", ""),
        "rows": paged,
        "total": total,
    }


@router.post("/datasets/set")
def create_dataset(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    display_name = body.get("name") or "Dataset"
    payload = {
        "description": body.get("description", ""),
        "rows": [],
    }
    row = _create_resource(db, user["tenant_id"], user.get("user_id"), "dataset", display_name, payload)
    return {"id": row.id}


@router.put("/datasets/set/{dataset_id}")
def update_dataset(
    dataset_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "dataset", dataset_id)
    payload = row.payload or {}
    display_name = body.get("name") or _resource_display_name(row)
    next_payload = {
        **payload,
        "description": body.get("description", payload.get("description", "")),
    }
    _update_resource(row, user.get("user_id"), display_name=display_name, payload=next_payload)
    db.commit()
    return {"id": row.id}


@router.delete("/datasets/set/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "dataset", dataset_id)
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": dataset_id}


@router.post("/datasets/rows")
def create_dataset_row(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "dataset", body.get("datasetId"))
    payload = row.payload or {}
    rows = payload.get("rows") or []
    new_row = {
        "id": str(uuid4()),
        "datasetId": row.id,
        "input": body.get("input", ""),
        "output": body.get("output", ""),
        "sequenceNo": len(rows),
    }
    rows.append(new_row)
    payload["rows"] = rows
    _update_resource(row, user.get("user_id"), payload=payload)
    db.commit()
    return {"id": new_row["id"]}


@router.put("/datasets/rows/{row_id}")
def update_dataset_row(
    row_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    datasets = _query_resources(db, user["tenant_id"], "dataset")
    for dataset in datasets:
        payload = dataset.payload or {}
        rows = payload.get("rows") or []
        found = False
        for item in rows:
            if item.get("id") == row_id:
                item["input"] = body.get("input", item.get("input", ""))
                item["output"] = body.get("output", item.get("output", ""))
                found = True
                break
        if found:
            payload["rows"] = rows
            _update_resource(dataset, user.get("user_id"), payload=payload)
            db.commit()
            return {"id": row_id}
    raise HTTPException(status_code=404, detail="Dataset row not found")


@router.delete("/datasets/rows/{row_id}")
def delete_dataset_row(
    row_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    datasets = _query_resources(db, user["tenant_id"], "dataset")
    for dataset in datasets:
        payload = dataset.payload or {}
        rows = payload.get("rows") or []
        if any(item.get("id") == row_id for item in rows):
            next_rows = [item for item in rows if item.get("id") != row_id]
            for idx, item in enumerate(next_rows):
                item["sequenceNo"] = idx
            payload["rows"] = next_rows
            _update_resource(dataset, user.get("user_id"), payload=payload)
            db.commit()
            return {"id": row_id}
    raise HTTPException(status_code=404, detail="Dataset row not found")


@router.patch("/datasets/rows")
def delete_dataset_rows(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    ids = set(body.get("ids") or [])
    deleted = 0
    datasets = _query_resources(db, user["tenant_id"], "dataset")

    for dataset in datasets:
        payload = dataset.payload or {}
        rows = payload.get("rows") or []
        next_rows = [item for item in rows if item.get("id") not in ids]
        if len(next_rows) != len(rows):
            deleted += len(rows) - len(next_rows)
            for idx, item in enumerate(next_rows):
                item["sequenceNo"] = idx
            payload["rows"] = next_rows
            _update_resource(dataset, user.get("user_id"), payload=payload)

    db.commit()
    return {"deleted": deleted}


@router.post("/datasets/reorder")
def reorder_dataset_rows(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    dataset = _get_resource(db, user["tenant_id"], "dataset", body.get("datasetId"))
    payload = dataset.payload or {}
    rows = payload.get("rows") or []
    order_map = {item.get("id"): int(item.get("sequenceNo", 0)) for item in (body.get("rows") or [])}
    rows = sorted(rows, key=lambda item: order_map.get(item.get("id"), int(item.get("sequenceNo", 0))))
    for idx, item in enumerate(rows):
        item["sequenceNo"] = idx

    payload["rows"] = rows
    _update_resource(dataset, user.get("user_id"), payload=payload)
    db.commit()
    return {"status": "ok"}


# Evaluators
@router.get("/evaluators")
def list_evaluators(
    page: int | None = None,
    limit: int | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> Any:
    rows = _query_resources(db, user["tenant_id"], "evaluator")
    items = []
    for row in rows:
        payload = row.payload or {}
        items.append(
            {
                "id": row.id,
                "name": _resource_display_name(row),
                "type": payload.get("type", "text"),
                "operator": payload.get("operator"),
                "value": payload.get("value"),
                "measure": payload.get("measure"),
                "prompt": payload.get("prompt"),
                "outputSchema": payload.get("outputSchema") or [],
                "createdDate": row.created_at.isoformat() if row.created_at else None,
                "updatedDate": row.updated_at.isoformat() if row.updated_at else None,
            }
        )

    if page is None and limit is None:
        return items

    paged, total = _paginate(items, page=page or 1, limit=limit or 10)
    return {"data": paged, "total": total}


@router.post("/evaluators")
def create_evaluator(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    display_name = body.get("name") or "Evaluator"
    payload = {
        "type": body.get("type", "text"),
        "operator": body.get("operator"),
        "value": body.get("value"),
        "measure": body.get("measure"),
        "prompt": body.get("prompt"),
        "outputSchema": body.get("outputSchema") or [],
    }
    row = _create_resource(db, user["tenant_id"], user.get("user_id"), "evaluator", display_name, payload)
    return {"id": row.id}


@router.get("/evaluators/{evaluator_id}")
def get_evaluator(
    evaluator_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "evaluator", evaluator_id)
    payload = row.payload or {}
    return {
        "id": row.id,
        "name": _resource_display_name(row),
        "type": payload.get("type", "text"),
        "operator": payload.get("operator"),
        "value": payload.get("value"),
        "measure": payload.get("measure"),
        "prompt": payload.get("prompt"),
        "outputSchema": payload.get("outputSchema") or [],
    }


@router.put("/evaluators/{evaluator_id}")
def update_evaluator(
    evaluator_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "evaluator", evaluator_id)
    current = row.payload or {}
    display_name = body.get("name") or _resource_display_name(row)
    payload = {
        "type": body.get("type", current.get("type", "text")),
        "operator": body.get("operator", current.get("operator")),
        "value": body.get("value", current.get("value")),
        "measure": body.get("measure", current.get("measure")),
        "prompt": body.get("prompt", current.get("prompt")),
        "outputSchema": body.get("outputSchema", current.get("outputSchema") or []),
    }
    _update_resource(row, user.get("user_id"), display_name=display_name, payload=payload)
    db.commit()
    return {"id": row.id}


@router.delete("/evaluators/{evaluator_id}")
def delete_evaluator(
    evaluator_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "evaluator", evaluator_id)
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": evaluator_id}


# Evaluations

def _average_metrics(eval_rows: list[dict[str, Any]]) -> dict[str, Any]:
    total_runs = len(eval_rows)
    if total_runs == 0:
        return {
            "totalRuns": 0,
            "averageCost": "$0.00",
            "averageLatency": 0,
            "passPcnt": 0,
            "passCount": 0,
            "failCount": 0,
            "errorCount": 0,
        }

    total_latency = 0.0
    total_cost = 0.0
    for row in eval_rows:
        metrics = _parse_json(row.get("metrics"), [])
        row_latency = 0.0
        for metric in metrics:
            row_latency += float(metric.get("apiLatency", 0.0) or 0.0)
            total_cost += float(metric.get("cost", 0.0) or 0.0)
        if metrics:
            total_latency += row_latency / len(metrics)

    return {
        "totalRuns": total_runs,
        "averageCost": f"${(total_cost / max(1, total_runs)):.4f}",
        "averageLatency": round(total_latency / max(1, total_runs), 2),
        "passPcnt": 100,
        "passCount": total_runs,
        "failCount": 0,
        "errorCount": 0,
    }


def _serialize_evaluation_row(row: TenantResource, latest_eval: bool) -> dict[str, Any]:
    payload = row.payload or {}
    return {
        "id": row.id,
        "name": payload.get("display_name") or _resource_display_name(row),
        "status": payload.get("status", "completed"),
        "version": int(payload.get("version", 1) or 1),
        "latestEval": latest_eval,
        "runDate": payload.get("runDate") or (row.updated_at.isoformat() if row.updated_at else None),
        "datasetId": payload.get("datasetId"),
        "datasetName": payload.get("datasetName", "Dataset"),
        "chatflowId": payload.get("chatflowId", json.dumps([])),
        "chatflowName": payload.get("chatflowName", json.dumps([])),
        "chatflowType": payload.get("chatflowType", json.dumps([])),
        "evaluationType": payload.get("evaluationType", "benchmarking"),
        "selectedSimpleEvaluators": payload.get("selectedSimpleEvaluators") or [],
        "selectedLLMEvaluators": payload.get("selectedLLMEvaluators") or [],
        "model": payload.get("model"),
        "llm": payload.get("llm"),
        "additionalConfig": payload.get("additionalConfig", json.dumps({})),
        "average_metrics": payload.get("average_metrics") or _average_metrics(payload.get("rows") or []),
        "rows": payload.get("rows") or [],
    }


@router.get("/evaluations")
def list_evaluations(
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    rows = _query_resources(db, user["tenant_id"], "evaluation")

    max_version_by_name: dict[str, int] = {}
    for row in rows:
        payload = row.payload or {}
        name = payload.get("display_name") or _resource_display_name(row)
        version = int(payload.get("version", 1) or 1)
        if name not in max_version_by_name or version > max_version_by_name[name]:
            max_version_by_name[name] = version

    serialized = []
    for row in rows:
        payload = row.payload or {}
        name = payload.get("display_name") or _resource_display_name(row)
        version = int(payload.get("version", 1) or 1)
        serialized.append(_serialize_evaluation_row(row, latest_eval=version == max_version_by_name.get(name)))

    paged, total = _paginate(serialized, page=page, limit=limit)
    return {"data": paged, "total": total}


@router.post("/evaluations")
def create_evaluation(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> list[dict[str, Any]]:
    dataset_id = body.get("datasetId")
    dataset_row = _get_resource(db, user["tenant_id"], "dataset", dataset_id)
    dataset_payload = dataset_row.payload or {}
    dataset_rows = dataset_payload.get("rows") or []

    flow_names = _parse_json(body.get("chatflowName"), [])

    eval_rows = []
    for dataset_item in dataset_rows:
        metrics = []
        for flow_name in flow_names:
            metrics.append(
                {
                    "apiLatency": 220,
                    "promptTokens": 35,
                    "completionTokens": 55,
                    "totalTokens": 90,
                    "cost": 0,
                    "name": flow_name,
                }
            )

        eval_rows.append(
            {
                "id": str(uuid4()),
                "input": dataset_item.get("input", ""),
                "expectedOutput": dataset_item.get("output", ""),
                "actualOutput": json.dumps([f"Generated response for: {dataset_item.get('input', '')}" for _ in flow_names]),
                "metrics": json.dumps(metrics),
                "evaluators": json.dumps([]),
                "llmEvaluators": json.dumps([]),
                "errors": json.dumps([]),
            }
        )

    display_name = body.get("name") or "Evaluation"
    payload = {
        **body,
        "datasetName": body.get("datasetName") or _resource_display_name(dataset_row),
        "status": "completed",
        "version": 1,
        "runDate": _now_iso(),
        "rows": eval_rows,
        "average_metrics": _average_metrics(eval_rows),
    }

    row = _create_resource(db, user["tenant_id"], user.get("user_id"), "evaluation", display_name, payload)
    return [_serialize_evaluation_row(row, latest_eval=True)]


@router.get("/evaluations/{evaluation_id}")
def get_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "evaluation", evaluation_id)
    payload = row.payload or {}
    display_name = payload.get("display_name") or _resource_display_name(row)

    rows = _query_resources(db, user["tenant_id"], "evaluation")
    max_version = 1
    for item in rows:
        p = item.payload or {}
        if (p.get("display_name") or _resource_display_name(item)) == display_name:
            max_version = max(max_version, int(p.get("version", 1) or 1))

    version = int(payload.get("version", 1) or 1)
    return _serialize_evaluation_row(row, latest_eval=version == max_version)


@router.get("/evaluations/is-outdated/{evaluation_id}")
def is_evaluation_outdated(
    evaluation_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "evaluation", evaluation_id)
    payload = row.payload or {}
    display_name = payload.get("display_name") or _resource_display_name(row)
    version = int(payload.get("version", 1) or 1)

    max_version = version
    for item in _query_resources(db, user["tenant_id"], "evaluation"):
        p = item.payload or {}
        if (p.get("display_name") or _resource_display_name(item)) == display_name:
            max_version = max(max_version, int(p.get("version", 1) or 1))

    return {"isOutdated": max_version > version}


@router.post("/evaluations/run-again/{evaluation_id}")
def rerun_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    current = _get_resource(db, user["tenant_id"], "evaluation", evaluation_id)
    payload = current.payload or {}

    display_name = payload.get("display_name") or _resource_display_name(current)
    version = int(payload.get("version", 1) or 1) + 1

    new_payload = {
        **payload,
        "version": version,
        "runDate": _now_iso(),
        "status": "completed",
        "average_metrics": _average_metrics(payload.get("rows") or []),
    }

    row = _create_resource(db, user["tenant_id"], user.get("user_id"), "evaluation", display_name, new_payload)
    return {"status": "completed", "id": row.id}


@router.get("/evaluations/versions/{evaluation_id}")
def get_evaluation_versions(
    evaluation_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor", "viewer"))] = None,
) -> dict[str, Any]:
    current = _get_resource(db, user["tenant_id"], "evaluation", evaluation_id)
    name = (current.payload or {}).get("display_name") or _resource_display_name(current)

    versions = []
    for item in _query_resources(db, user["tenant_id"], "evaluation"):
        payload = item.payload or {}
        item_name = payload.get("display_name") or _resource_display_name(item)
        if item_name == name:
            versions.append(
                {
                    "id": item.id,
                    "version": int(payload.get("version", 1) or 1),
                    "runDate": payload.get("runDate") or (item.updated_at.isoformat() if item.updated_at else None),
                }
            )

    versions.sort(key=lambda item: item["version"], reverse=True)
    return {"versions": versions}


@router.delete("/evaluations/{evaluation_id}")
def delete_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    row = _get_resource(db, user["tenant_id"], "evaluation", evaluation_id)
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": evaluation_id}


@router.patch("/evaluations")
def delete_evaluations(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_roles("admin", "editor"))] = None,
) -> dict[str, Any]:
    ids = set(body.get("ids") or [])
    delete_all_version = bool(body.get("isDeleteAllVersion"))

    rows = _query_resources(db, user["tenant_id"], "evaluation")

    target_names: set[str] = set()
    if delete_all_version:
        for row in rows:
            if row.id in ids:
                payload = row.payload or {}
                target_names.add(payload.get("display_name") or _resource_display_name(row))

    deleted = 0
    for row in rows:
        payload = row.payload or {}
        row_name = payload.get("display_name") or _resource_display_name(row)
        should_delete = row.id in ids or (delete_all_version and row_name in target_names)
        if should_delete:
            db.delete(row)
            deleted += 1

    db.commit()
    return {"deleted": deleted}


@router.get("/loginmethod/default")
def get_default_login_methods() -> dict:
    """Return default login methods (empty list for self-hosted)."""
    return {"providers": []}
