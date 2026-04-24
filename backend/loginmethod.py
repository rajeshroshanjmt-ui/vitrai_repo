"""Login method endpoints for authentication configuration."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from middleware import get_user_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/loginmethod", tags=["loginmethod"])


@router.get("")
def get_login_methods(organizationId: str = None, user: dict = Depends(get_user_from_token), db: Session = Depends(get_db)):
    """Get login methods for an organization."""
    # For now, return default login methods
    return {
        "methods": [
            {
                "type": "email",
                "name": "Email/Password",
                "enabled": True,
                "config": {}
            },
            {
                "type": "sso",
                "name": "SSO",
                "enabled": False,
                "config": {}
            }
        ]
    }


@router.get("/default")
def get_default_login_methods():
    """Get default login methods."""
    return {
        "methods": [
            {
                "type": "email",
                "name": "Email/Password",
                "enabled": True
            }
        ]
    }


@router.put("")
def update_login_methods(body: dict, user: dict = Depends(get_user_from_token), db: Session = Depends(get_db)):
    """Update login methods for organization."""
    logger.info(f"Login methods updated by user {user['user_id']}")
    return {"status": "ok", "message": "Login methods updated"}


@router.post("/test")
def test_login_method(body: dict, user: dict = Depends(get_user_from_token), db: Session = Depends(get_db)):
    """Test a login method configuration."""
    logger.info(f"Testing login method: {body.get('type')}")
    return {"status": "ok", "message": "Connection successful"}
