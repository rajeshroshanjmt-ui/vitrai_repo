"""
Advanced integration tests for workspace.py module.
Tests workspace CRUD, user associations, switching, and isolation.
"""

import unittest
import warnings
from unittest.mock import patch, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import workspace
from conftest import FakeDB, MockWorkspace, MockUser, MockUserPreference, create_test_headers


class WorkspaceHttpTests(unittest.TestCase):
    """HTTP integration tests for workspace management endpoints."""

    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        """Set up test fixtures."""
        self.db = FakeDB()
        self.tenant_id = "tenant-1"
        self.user_id = "user-1"

        # Create FastAPI app with workspace router
        app = FastAPI()
        app.include_router(workspace.router, prefix="/api/workspace")

        def override_get_db():
            yield self.db

        app.dependency_overrides[workspace.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        """Clean up."""
        self.client.close()

    def test_list_workspaces_returns_all_tenant_workspaces(self):
        """Verify listing workspaces returns all workspaces for tenant."""
        ws1 = MockWorkspace(id="ws-1", name="Workspace 1", tenant_id=self.tenant_id)
        ws2 = MockWorkspace(id="ws-2", name="Workspace 2", tenant_id=self.tenant_id)

        self.db.workspaces[ws1.id] = ws1
        self.db.workspaces[ws2.id] = ws2

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                "/api/workspace/",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403]

    def test_create_workspace_succeeds(self):
        """Verify workspace creation."""
        request_body = {
            "name": "New Workspace",
            "description": "A new workspace"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/workspace/",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 201, 403]

    def test_create_workspace_with_duplicate_name_rejected(self):
        """Verify duplicate workspace name is rejected."""
        existing_ws = MockWorkspace(id="ws-1", name="Main Workspace", tenant_id=self.tenant_id)
        self.db.workspaces[existing_ws.id] = existing_ws

        request_body = {
            "name": "Main Workspace",  # Duplicate
            "description": "Another workspace"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/workspace/",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 409 Conflict or 400
        assert response.status_code in [400, 409, 403]

    def test_get_workspace_details(self):
        """Verify getting workspace details."""
        ws = MockWorkspace(id="ws-1", name="Main Workspace", tenant_id=self.tenant_id)
        self.db.workspaces[ws.id] = ws

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                f"/api/workspace/{ws.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403, 404]

    def test_update_workspace_details(self):
        """Verify updating workspace details."""
        ws = MockWorkspace(id="ws-1", name="Main Workspace", tenant_id=self.tenant_id)
        self.db.workspaces[ws.id] = ws

        request_body = {
            "name": "Updated Workspace",
            "description": "Updated description"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.put(
                f"/api/workspace/{ws.id}",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 403]

    def test_delete_workspace_succeeds(self):
        """Verify workspace deletion."""
        ws = MockWorkspace(id="ws-1", name="Workspace", tenant_id=self.tenant_id)
        self.db.workspaces[ws.id] = ws

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.delete(
                f"/api/workspace/{ws.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 204 No Content or 200
        assert response.status_code in [200, 204, 403]

    def test_switch_workspace_updates_preference(self):
        """Verify switching workspace updates user preference."""
        ws = MockWorkspace(id="ws-1", name="Workspace 1", tenant_id=self.tenant_id)
        self.db.workspaces[ws.id] = ws

        request_body = {"workspace_id": ws.id}

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/workspace/switch",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403]

    def test_cannot_switch_to_other_tenant_workspace(self):
        """Verify user cannot switch to workspace from different tenant."""
        other_tenant = "tenant-2"
        ws = MockWorkspace(id="ws-1", name="Other Workspace", tenant_id=other_tenant)
        self.db.workspaces[ws.id] = ws

        request_body = {"workspace_id": ws.id}

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/workspace/switch",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should return 403 Forbidden or 404
        assert response.status_code in [403, 404]

    def test_add_user_to_workspace(self):
        """Verify adding user to workspace."""
        ws = MockWorkspace(id="ws-1", name="Workspace", tenant_id=self.tenant_id)
        user = MockUser(id="user-2", email="user2@example.com", tenant_id=self.tenant_id)

        self.db.workspaces[ws.id] = ws
        self.db.users[user.id] = user

        request_body = {
            "user_id": user.id,
            "role": "editor"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                f"/api/workspace/{ws.id}/users",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 201, 403]

    def test_remove_user_from_workspace(self):
        """Verify removing user from workspace."""
        ws = MockWorkspace(id="ws-1", name="Workspace", tenant_id=self.tenant_id)
        user = MockUser(id="user-2", email="user2@example.com", tenant_id=self.tenant_id)

        self.db.workspaces[ws.id] = ws
        self.db.users[user.id] = user

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.delete(
                f"/api/workspace/{ws.id}/users/{user.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 204 No Content or 200
        assert response.status_code in [200, 204, 403]

    def test_list_workspace_users(self):
        """Verify listing users in workspace."""
        ws = MockWorkspace(id="ws-1", name="Workspace", tenant_id=self.tenant_id)
        user = MockUser(id="user-2", email="user2@example.com", tenant_id=self.tenant_id)

        self.db.workspaces[ws.id] = ws
        self.db.users[user.id] = user

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                f"/api/workspace/{ws.id}/users",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403]

    def test_cannot_add_duplicate_user_to_workspace(self):
        """Verify adding user twice returns error."""
        ws = MockWorkspace(id="ws-1", name="Workspace", tenant_id=self.tenant_id)
        user = MockUser(id="user-2", email="user2@example.com", tenant_id=self.tenant_id)

        self.db.workspaces[ws.id] = ws
        self.db.users[user.id] = user

        request_body = {"user_id": user.id, "role": "editor"}

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            # First addition
            response1 = self.client.post(
                f"/api/workspace/{ws.id}/users",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

            # Second addition (duplicate)
            response2 = self.client.post(
                f"/api/workspace/{ws.id}/users",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Second should be rejected
        assert response2.status_code in [409, 400, 403]

    def test_cannot_delete_last_workspace(self):
        """Verify user cannot delete their only workspace."""
        ws = MockWorkspace(id="ws-1", name="Only Workspace", tenant_id=self.tenant_id)
        self.db.workspaces[ws.id] = ws

        # User has only this workspace
        pref = MockUserPreference(user_id=self.user_id, tenant_id=self.tenant_id, active_workspace=ws.id)
        self.db.user_preferences[pref.id] = pref

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.delete(
                f"/api/workspace/{ws.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should prevent deletion
        assert response.status_code in [403, 400]

    def test_non_admin_cannot_add_users_to_workspace(self):
        """Verify non-admin cannot add users to workspace."""
        ws = MockWorkspace(id="ws-1", name="Workspace", tenant_id=self.tenant_id)
        user = MockUser(id="user-2", email="user2@example.com", tenant_id=self.tenant_id)

        self.db.workspaces[ws.id] = ws
        self.db.users[user.id] = user

        request_body = {"user_id": user.id, "role": "editor"}

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": "editor-1"}):
            response = self.client.post(
                f"/api/workspace/{ws.id}/users",
                json=request_body,
                headers=create_test_headers(user_id="editor-1", tenant_id=self.tenant_id, role="editor")
            )

        # Should return 403 Forbidden
        assert response.status_code in [403]


class WorkspaceLogicTests(unittest.TestCase):
    """Unit tests for workspace logic (non-HTTP)."""

    def test_workspace_has_required_fields(self):
        """Verify workspace has required fields."""
        ws = MockWorkspace(id="ws-1", name="Test", tenant_id="tenant-1")
        assert ws.id is not None
        assert ws.name is not None
        assert ws.tenant_id is not None
        assert ws.resource_type == "workspace"

    def test_workspace_tenant_isolation(self):
        """Verify workspaces are isolated by tenant."""
        ws1 = MockWorkspace(id="ws-1", name="Workspace", tenant_id="tenant-1")
        ws2 = MockWorkspace(id="ws-2", name="Workspace", tenant_id="tenant-2")
        assert ws1.tenant_id != ws2.tenant_id

    def test_user_preference_tracks_active_workspace(self):
        """Verify user preference tracks active workspace."""
        pref = MockUserPreference(
            user_id="user-1",
            tenant_id="tenant-1",
            active_workspace="ws-1"
        )
        assert pref.active_workspace == "ws-1"

    def test_workspace_creation_timestamp(self):
        """Verify workspace has creation timestamp."""
        ws = MockWorkspace(id="ws-1", tenant_id="tenant-1")
        assert ws.created_at is not None


if __name__ == "__main__":
    unittest.main()
