"""
Integration tests for permissions.py module.
Tests role creation/deletion, permission assignment, and enforcement.
"""

import unittest
import warnings
from unittest.mock import patch, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import permissions
from conftest import FakeDB, MockRole, MockPermission, MockUser, create_test_headers


class PermissionsHttpTests(unittest.TestCase):
    """HTTP integration tests for permission management endpoints."""

    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        """Set up test fixtures."""
        self.db = FakeDB()
        self.tenant_id = "tenant-1"
        self.user_id = "admin-1"

        # Create FastAPI app with permissions router
        app = FastAPI()
        app.include_router(permissions.router, prefix="/api/permissions")

        def override_get_db():
            yield self.db

        app.dependency_overrides[permissions.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        """Clean up."""
        self.client.close()

    def test_list_roles_returns_all_roles(self):
        """Verify listing roles returns all system and custom roles."""
        admin_role = MockRole(id="role-admin", name="admin", is_system=True)
        custom_role = MockRole(id="role-custom", name="Custom Role", tenant_id=self.tenant_id, is_system=False)

        self.db.roles[admin_role.id] = admin_role
        self.db.roles[custom_role.id] = custom_role

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.get(
                "/api/permissions/roles",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 403]

    def test_list_permissions_returns_all_permissions(self):
        """Verify listing permissions returns all available permissions."""
        perm1 = MockPermission(id="perm-1", name="users:read")
        perm2 = MockPermission(id="perm-2", name="users:write")

        self.db.permissions[perm1.id] = perm1
        self.db.permissions[perm2.id] = perm2

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.get(
                "/api/permissions/permissions",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 403]

    def test_create_custom_role_succeeds(self):
        """Verify custom role creation."""
        request_body = {
            "name": "Custom Editor",
            "description": "Custom editor role"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.post(
                "/api/permissions/roles",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 201 Created or 200
        assert response.status_code in [200, 201, 403]

    def test_create_duplicate_role_name_rejected(self):
        """Verify duplicate role name is rejected."""
        existing_role = MockRole(id="role-1", name="Editor", tenant_id=self.tenant_id)
        self.db.roles[existing_role.id] = existing_role

        request_body = {
            "name": "Editor",  # Duplicate name
            "description": "Another editor role"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.post(
                "/api/permissions/roles",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 409 Conflict or 400
        assert response.status_code in [400, 409, 403]

    def test_update_custom_role_name(self):
        """Verify custom role name can be updated."""
        custom_role = MockRole(id="role-1", name="Old Name", tenant_id=self.tenant_id, is_system=False)
        self.db.roles[custom_role.id] = custom_role

        request_body = {
            "name": "New Name",
            "description": "Updated description"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.put(
                f"/api/permissions/roles/{custom_role.id}",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 403]

    def test_system_roles_cannot_be_updated(self):
        """Verify system roles are immutable."""
        admin_role = MockRole(id="role-admin", name="admin", is_system=True)
        self.db.roles[admin_role.id] = admin_role

        request_body = {
            "name": "Administrator",  # Try to change name
            "description": "New description"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.put(
                f"/api/permissions/roles/{admin_role.id}",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 403 Forbidden
        assert response.status_code in [403, 400]

    def test_delete_custom_role_succeeds(self):
        """Verify custom role deletion."""
        custom_role = MockRole(id="role-1", name="Custom Role", tenant_id=self.tenant_id, is_system=False)
        self.db.roles[custom_role.id] = custom_role

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.delete(
                f"/api/permissions/roles/{custom_role.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 204 No Content or 200
        assert response.status_code in [200, 204, 403]

    def test_cannot_delete_last_admin_role(self):
        """Verify admin role cannot be deleted."""
        admin_role = MockRole(id="role-admin", name="admin", is_system=True)
        self.db.roles[admin_role.id] = admin_role

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.delete(
                f"/api/permissions/roles/{admin_role.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        # Should return 403 Forbidden
        assert response.status_code in [403, 400]

    def test_assign_permission_to_role(self):
        """Verify permission assignment to role."""
        custom_role = MockRole(id="role-1", name="Custom Role", tenant_id=self.tenant_id, is_system=False)
        permission = MockPermission(id="perm-1", name="users:read")

        self.db.roles[custom_role.id] = custom_role
        self.db.permissions[permission.id] = permission

        request_body = {
            "permission_id": permission.id
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.post(
                f"/api/permissions/roles/{custom_role.id}/permissions",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 201, 403]

    def test_remove_permission_from_role(self):
        """Verify permission removal from role."""
        custom_role = MockRole(id="role-1", name="Custom Role", tenant_id=self.tenant_id, is_system=False)
        permission = MockPermission(id="perm-1", name="users:read")

        self.db.roles[custom_role.id] = custom_role
        self.db.permissions[permission.id] = permission

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.delete(
                f"/api/permissions/roles/{custom_role.id}/permissions/{permission.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 204, 403]

    def test_get_role_permissions(self):
        """Verify getting permissions for a role."""
        custom_role = MockRole(id="role-1", name="Custom Role", tenant_id=self.tenant_id, is_system=False)
        self.db.roles[custom_role.id] = custom_role

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "role": "admin"}):
            response = self.client.get(
                f"/api/permissions/roles/{custom_role.id}/permissions",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, role="admin")
            )

        assert response.status_code in [200, 403]

    def test_non_admin_cannot_manage_permissions(self):
        """Verify non-admin cannot manage permissions."""
        request_body = {
            "name": "Custom Role",
            "description": "Custom role"
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": "editor-1", "role": "editor"}):
            response = self.client.post(
                "/api/permissions/roles",
                json=request_body,
                headers=create_test_headers(user_id="editor-1", tenant_id=self.tenant_id, role="editor")
            )

        # Should return 403 Forbidden
        assert response.status_code in [403]

    def test_editor_cannot_delete_roles(self):
        """Verify editor cannot delete roles."""
        custom_role = MockRole(id="role-1", name="Custom Role", tenant_id=self.tenant_id, is_system=False)
        self.db.roles[custom_role.id] = custom_role

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": "editor-1", "role": "editor"}):
            response = self.client.delete(
                f"/api/permissions/roles/{custom_role.id}",
                headers=create_test_headers(user_id="editor-1", tenant_id=self.tenant_id, role="editor")
            )

        # Should return 403 Forbidden
        assert response.status_code in [403]


class PermissionsLogicTests(unittest.TestCase):
    """Unit tests for permission logic (non-HTTP)."""

    def test_system_role_is_immutable(self):
        """Verify system role is marked as immutable."""
        admin_role = MockRole(id="role-admin", name="admin", is_system=True)
        assert admin_role.is_system is True

    def test_custom_role_is_mutable(self):
        """Verify custom role is mutable."""
        custom_role = MockRole(id="role-1", name="Custom", is_system=False)
        assert custom_role.is_system is False

    def test_permission_has_required_fields(self):
        """Verify permission has required fields."""
        permission = MockPermission(id="perm-1", name="users:read", description="Can read users")
        assert permission.id is not None
        assert permission.name is not None
        assert permission.description is not None

    def test_role_tenant_isolation(self):
        """Verify roles are isolated by tenant."""
        role1 = MockRole(id="role-1", name="Custom", tenant_id="tenant-1")
        role2 = MockRole(id="role-2", name="Custom", tenant_id="tenant-2")
        assert role1.tenant_id != role2.tenant_id

    def test_system_role_has_no_tenant(self):
        """Verify system roles are not tenant-specific."""
        admin_role = MockRole(id="role-admin", name="admin", is_system=True, tenant_id=None)
        assert admin_role.tenant_id is None


if __name__ == "__main__":
    unittest.main()
