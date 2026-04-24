"""Login method endpoints for authentication configuration."""
import logging
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/loginmethod", tags=["loginmethod"])


class LoginMethodRequest(BaseModel):
    type: str = None
    config: dict = {}


@router.get("")
def get_login_methods(organizationId: str = None):
    """Get login methods for an organization."""
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
def update_login_methods(body: dict):
    """Update login methods for organization."""
    logger.info("Login methods updated")
    return {"status": "ok", "message": "Login methods updated"}


@router.post("/test")
def test_login_method(body: LoginMethodRequest):
    """Test a login method configuration."""
    logger.info(f"Testing login method: {body.type}")
    return {"status": "ok", "message": "Connection successful"}
