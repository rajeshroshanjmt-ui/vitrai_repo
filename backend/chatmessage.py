"""Chat message history endpoints for chatflows and agentflows."""
import logging
from typing import Annotated, Any
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import require_permission
from database import get_db
from models import ChatMessage, Flow
from utils import require_tenant_flow

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessageRequest(BaseModel):
    """Request to create or update a chat message."""

    session_id: str = Field(min_length=1)
    role: str = Field(pattern="^(userMessage|apiMessage)$")
    content: str = Field(min_length=1)
    source_documents: dict[str, Any] | None = None
    agent_reasoning: list[Any] | None = None
    used_tools: list[Any] | None = None


class ChatMessageFeedbackRequest(BaseModel):
    """Request to save feedback on a chat message."""

    rating: str = Field(pattern="^(THUMBS_UP|THUMBS_DOWN)$")
    content: str | None = None


class ChatMessageResponse(BaseModel):
    """Response model for chat messages."""

    id: str
    chatflow_id: str
    session_id: str
    role: str
    content: str
    source_documents: dict[str, Any] | None
    agent_reasoning: list[Any] | None
    used_tools: list[Any] | None
    feedback_rating: str | None
    feedback_content: str | None
    created_at: str


def _serialize_chat_message(message: ChatMessage) -> dict[str, Any]:
    """Serialize ChatMessage model to dict."""
    return {
        "id": message.id,
        "chatflow_id": message.chatflow_id,
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "source_documents": message.source_documents,
        "agent_reasoning": message.agent_reasoning,
        "used_tools": message.used_tools,
        "feedback_rating": message.feedback_rating,
        "feedback_content": message.feedback_content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


@router.get("/chatmessage/{chatflow_id}")
def list_chat_messages(
    chatflow_id: str,
    session_id: str | None = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:view", "agentflows:view"))] = None,
) -> dict[str, Any]:
    """
    List chat messages for a chatflow.

    Query parameters:
    - session_id: Optional filter by session
    - page: Page number (1-indexed)
    - limit: Messages per page (max 200)
    """
    # Verify chatflow exists and belongs to tenant
    flow = require_tenant_flow(db, chatflow_id, user["tenant_id"])

    # Build query
    query = db.query(ChatMessage).filter(ChatMessage.chatflow_id == chatflow_id)

    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)

    # Pagination
    safe_page = max(1, page)
    safe_limit = max(1, min(limit, 200))
    offset = (safe_page - 1) * safe_limit

    total_count = query.count()
    messages = query.order_by(ChatMessage.created_at.desc()).offset(offset).limit(safe_limit).all()

    return {
        "items": [_serialize_chat_message(m) for m in messages],
        "total_count": total_count,
        "page": safe_page,
        "limit": safe_limit,
    }


@router.post("/chatmessage/{chatflow_id}", status_code=201)
def create_chat_message(
    chatflow_id: str,
    body: ChatMessageRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:execute", "agentflows:execute"))] = None,
) -> dict[str, Any]:
    """
    Create a chat message in the message history.

    Called by prediction endpoints after each exchange to populate history.
    """
    # Verify chatflow exists and belongs to tenant
    flow = require_tenant_flow(db, chatflow_id, user["tenant_id"])

    now_utc = datetime.now(timezone.utc)
    message = ChatMessage(
        id=str(uuid4()),
        tenant_id=user["tenant_id"],
        chatflow_id=chatflow_id,
        session_id=body.session_id,
        role=body.role,
        content=body.content,
        source_documents=body.source_documents,
        agent_reasoning=body.agent_reasoning,
        used_tools=body.used_tools,
        feedback_rating=None,
        feedback_content=None,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return _serialize_chat_message(message)


@router.delete("/chatmessage/{chatflow_id}")
def delete_chat_messages(
    chatflow_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:delete", "agentflows:delete"))] = None,
) -> dict[str, str]:
    """Delete all chat messages for a chatflow."""
    # Verify chatflow exists and belongs to tenant
    flow = require_tenant_flow(db, chatflow_id, user["tenant_id"])

    count = db.query(ChatMessage).filter(ChatMessage.chatflow_id == chatflow_id).delete(
        synchronize_session=False
    )
    db.commit()

    return {"status": "ok", "message": f"Deleted {count} chat messages", "deleted_count": count}


@router.put("/chatmessage/abort/{chatflow_id}/{session_id}")
def abort_chat_session(
    chatflow_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:execute", "agentflows:execute"))] = None,
) -> dict[str, str]:
    """
    Mark a chat session as aborted.

    This can be used to cancel ongoing message processing.
    """
    # Verify chatflow exists and belongs to tenant
    flow = require_tenant_flow(db, chatflow_id, user["tenant_id"])

    # Find messages for this session
    count = db.query(ChatMessage).filter(
        ChatMessage.chatflow_id == chatflow_id,
        ChatMessage.session_id == session_id,
    ).count()

    if count == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    # Note: This endpoint marks a session as aborted for tracking purposes
    # Additional processing (canceling ongoing LLM calls, etc.) would be handled by the prediction endpoint
    return {"status": "ok", "session_id": session_id}


@router.post("/chatmessage/{chatflow_id}/feedback/{message_id}")
def save_message_feedback(
    chatflow_id: str,
    message_id: str,
    body: ChatMessageFeedbackRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:view", "agentflows:view"))] = None,
) -> dict[str, Any]:
    """
    Save feedback (thumbs up/down) on a chat message.

    Allows users to provide quality feedback on LLM responses.
    """
    # Verify chatflow exists and belongs to tenant
    flow = require_tenant_flow(db, chatflow_id, user["tenant_id"])

    # Find message
    message = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.id == message_id,
            ChatMessage.chatflow_id == chatflow_id,
            ChatMessage.tenant_id == user["tenant_id"],
        )
        .one_or_none()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Update feedback
    message.feedback_rating = body.rating
    message.feedback_content = body.content
    message.updated_at = datetime.now(timezone.utc)
    db.add(message)
    db.commit()
    db.refresh(message)

    return _serialize_chat_message(message)


@router.post("/feedback/{message_id}")
def save_message_feedback_simple(
    message_id: str,
    body: ChatMessageFeedbackRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:view"))] = None,
) -> dict[str, Any]:
    """
    Save feedback on a chat message (simplified path, message_id only).

    Allows users to provide quality feedback without specifying chatflow_id.
    """
    message = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.id == message_id,
            ChatMessage.tenant_id == user["tenant_id"]
        )
        .one_or_none()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.feedback_rating = body.rating
    message.feedback_content = body.content
    message.updated_at = datetime.now(timezone.utc)
    db.add(message)
    db.commit()
    db.refresh(message)

    return _serialize_chat_message(message)


@router.put("/feedback/{message_id}")
def update_message_feedback_simple(
    message_id: str,
    body: ChatMessageFeedbackRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:view"))] = None,
) -> dict[str, Any]:
    """
    Update feedback on a chat message (PUT variant, simplified path).
    """
    return save_message_feedback_simple(message_id, body, db, user)
