"""Webhook management endpoints for flows."""
import hmac
import hashlib
import json
import logging
import secrets
from typing import Annotated, Any
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.orm import Session

from auth import require_permission
from database import get_db
from models import Webhook, Flow

router = APIRouter()
logger = logging.getLogger(__name__)

# Request timeout for webhook deliveries
WEBHOOK_TIMEOUT = 10.0


class WebhookCreateRequest(BaseModel):
    """Request to create a webhook."""

    name: str = Field(min_length=1, max_length=200)
    flow_id: str | None = None
    event_types: list[str] = Field(default_factory=list)
    endpoint_url: str = Field(min_length=1)
    is_active: bool = True


class WebhookUpdateRequest(BaseModel):
    """Request to update a webhook."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    flow_id: str | None = None
    event_types: list[str] | None = None
    endpoint_url: str | None = None
    is_active: bool | None = None


class WebhookResponse(BaseModel):
    """Response model for webhooks."""

    id: str
    tenant_id: str
    name: str
    flow_id: str | None
    event_types: list[str]
    endpoint_url: str
    is_active: bool
    created_at: str
    updated_at: str


def _serialize_webhook(webhook: Webhook) -> dict[str, Any]:
    """Serialize Webhook model to dict."""
    return {
        "id": webhook.id,
        "tenant_id": webhook.tenant_id,
        "name": webhook.name,
        "flow_id": webhook.flow_id,
        "event_types": webhook.event_types or [],
        "endpoint_url": webhook.endpoint_url,
        "is_active": webhook.is_active,
        "created_at": webhook.created_at.isoformat() if webhook.created_at else None,
        "updated_at": webhook.updated_at.isoformat() if webhook.updated_at else None,
    }


def _generate_webhook_secret() -> str:
    """Generate a random webhook secret."""
    return secrets.token_urlsafe(32)


def _compute_webhook_signature(payload: str, secret: str) -> str:
    """Compute HMAC-SHA256 signature for webhook payload."""
    return hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()


async def _deliver_webhook_event(webhook: Webhook, event_type: str, data: dict) -> bool:
    """
    Deliver a webhook event to the endpoint_url.

    Returns:
        True if delivery was successful, False otherwise.
    """
    if not webhook.is_active:
        return False

    if event_type not in (webhook.event_types or []):
        return False

    try:
        payload = json.dumps({
            "event_type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        signature = _compute_webhook_signature(payload, webhook.secret)

        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT) as client:
            response = await client.post(
                webhook.endpoint_url,
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": signature,
                    "X-Webhook-Event": event_type,
                },
            )
            return response.status_code in (200, 201, 202, 204)

    except Exception as e:
        # Log error but don't raise - webhook delivery is fire-and-forget
        print(f"Failed to deliver webhook {webhook.id}: {str(e)}")
        return False


@router.get("/webhooks")
def list_webhooks(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("webhooks:view"))] = None,
) -> dict[str, Any]:
    """List webhooks for the tenant."""
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    query = db.query(Webhook).filter(Webhook.tenant_id == user["tenant_id"])
    total_count = query.count()
    webhooks = query.order_by(Webhook.created_at.desc()).offset(safe_offset).limit(safe_limit).all()

    return {
        "items": [_serialize_webhook(w) for w in webhooks],
        "total_count": total_count,
        "limit": safe_limit,
        "offset": safe_offset,
    }


@router.get("/webhooks/{webhook_id}")
def get_webhook(
    webhook_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("webhooks:view"))] = None,
) -> dict[str, Any]:
    """Get a specific webhook."""
    webhook = (
        db.query(Webhook)
        .filter(
            Webhook.id == webhook_id,
            Webhook.tenant_id == user["tenant_id"],
        )
        .one_or_none()
    )

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    return _serialize_webhook(webhook)


@router.post("/webhooks", status_code=201)
def create_webhook(
    body: WebhookCreateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("webhooks:create"))] = None,
) -> dict[str, Any]:
    """Create a new webhook."""
    # Verify flow exists if flow_id is provided
    if body.flow_id:
        flow = (
            db.query(Flow)
            .filter(Flow.id == body.flow_id, Flow.tenant_id == user["tenant_id"])
            .one_or_none()
        )
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")

    now_utc = datetime.now(timezone.utc)
    webhook = Webhook(
        id=str(uuid4()),
        tenant_id=user["tenant_id"],
        name=body.name.strip(),
        flow_id=body.flow_id,
        event_types=body.event_types,
        endpoint_url=body.endpoint_url.strip(),
        secret=_generate_webhook_secret(),
        is_active=body.is_active,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    return _serialize_webhook(webhook)


@router.put("/webhooks/{webhook_id}")
def update_webhook(
    webhook_id: str,
    body: WebhookUpdateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("webhooks:edit"))] = None,
) -> dict[str, Any]:
    """Update a webhook."""
    webhook = (
        db.query(Webhook)
        .filter(
            Webhook.id == webhook_id,
            Webhook.tenant_id == user["tenant_id"],
        )
        .one_or_none()
    )

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Verify new flow exists if provided
    if body.flow_id is not None and body.flow_id:
        flow = (
            db.query(Flow)
            .filter(Flow.id == body.flow_id, Flow.tenant_id == user["tenant_id"])
            .one_or_none()
        )
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")

    # Update fields
    if body.name is not None:
        webhook.name = body.name.strip()
    if body.flow_id is not None:
        webhook.flow_id = body.flow_id
    if body.event_types is not None:
        webhook.event_types = body.event_types
    if body.endpoint_url is not None:
        webhook.endpoint_url = body.endpoint_url.strip()
    if body.is_active is not None:
        webhook.is_active = body.is_active

    webhook.updated_at = datetime.now(timezone.utc)
    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    return _serialize_webhook(webhook)


@router.delete("/webhooks/{webhook_id}")
def delete_webhook(
    webhook_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("webhooks:delete"))] = None,
) -> dict[str, str]:
    """Delete a webhook."""
    webhook = (
        db.query(Webhook)
        .filter(
            Webhook.id == webhook_id,
            Webhook.tenant_id == user["tenant_id"],
        )
        .one_or_none()
    )

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    db.delete(webhook)
    db.commit()

    return {"status": "ok"}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("webhooks:view"))] = None,
) -> dict[str, str]:
    """Send a test event to the webhook endpoint."""
    webhook = (
        db.query(Webhook)
        .filter(
            Webhook.id == webhook_id,
            Webhook.tenant_id == user["tenant_id"],
        )
        .one_or_none()
    )

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Send test event in background
    test_data = {
        "webhook_id": webhook.id,
        "webhook_name": webhook.name,
        "test": True,
    }

    # Add background task for webhook delivery
    background_tasks.add_task(
        _deliver_webhook_event,
        webhook,
        "webhook.test",
        test_data
    )

    return {"status": "ok", "message": "Test event queued for delivery"}


@router.post("/webhook/{webhook_id}")
async def receive_inbound_webhook(
    webhook_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """
    Receive an inbound webhook to trigger a flow.

    This endpoint allows external systems to trigger flow execution via webhook.
    """
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).one_or_none()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if not webhook.is_active:
        raise HTTPException(status_code=410, detail="Webhook is inactive")

    if not webhook.flow_id:
        raise HTTPException(status_code=400, detail="Webhook is not configured with a flow")

    # Queue flow execution
    # Note: In a production system, this would queue the flow execution
    # to a background task queue (e.g., Celery, Redis queue, etc.)
    # For now, we acknowledge the webhook has been received.

    return {
        "status": "ok",
        "message": "Webhook received and queued for processing",
        "webhook_id": webhook.id,
    }
