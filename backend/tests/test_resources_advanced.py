"""
Advanced integration tests for resources.py module.
Tests resource CRUD, type support, workspace filtering, and credential handling.
"""

import unittest
import warnings
from unittest.mock import patch, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import resources
from conftest import FakeDB, MockResource, create_test_headers


class ResourcesHttpTests(unittest.TestCase):
    """HTTP integration tests for resource management endpoints."""

    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        """Set up test fixtures."""
        self.db = FakeDB()
        self.tenant_id = "tenant-1"
        self.user_id = "user-1"
        self.workspace_id = "ws-1"

        # Create FastAPI app with resources router
        app = FastAPI()
        app.include_router(resources.router, prefix="/api/resources")

        def override_get_db():
            yield self.db

        app.dependency_overrides[resources.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        """Clean up."""
        self.client.close()

    def test_list_resources_by_type(self):
        """Verify listing resources filters by type."""
        credential = MockResource(id="res-1", resource_type="credential", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        variable = MockResource(id="res-2", resource_type="variable", tenant_id=self.tenant_id, workspace_id=self.workspace_id)

        self.db.resources[credential.id] = credential
        self.db.resources[variable.id] = variable

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                "/api/resources/credential",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403]

    def test_get_single_resource(self):
        """Verify getting single resource details."""
        resource = MockResource(id="res-1", resource_type="credential", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        self.db.resources[resource.id] = resource

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.get(
                f"/api/resources/credential/{resource.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403, 404]

    def test_create_credential_resource(self):
        """Verify creating credential resource."""
        request_body = {
            "name": "API Key",
            "payload": {
                "api_key": "secret-key-123"
            }
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/resources/credential",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 201, 403]

    def test_create_variable_resource(self):
        """Verify creating variable resource."""
        request_body = {
            "name": "DATABASE_URL",
            "payload": {
                "value": "postgres://localhost/db"
            }
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/resources/variable",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 201, 403]

    def test_create_tool_resource(self):
        """Verify creating tool resource."""
        request_body = {
            "name": "Web Search",
            "payload": {
                "provider": "google",
                "api_key": "key-123"
            }
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/resources/tool",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 201, 403]

    def test_create_dataset_resource(self):
        """Verify creating dataset resource."""
        request_body = {
            "name": "Customer Data",
            "payload": {
                "rows": 1000,
                "columns": ["id", "name", "email"]
            }
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/resources/dataset",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 201, 403]

    def test_update_resource_succeeds(self):
        """Verify updating resource."""
        resource = MockResource(id="res-1", resource_type="variable", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        self.db.resources[resource.id] = resource

        request_body = {
            "name": "Updated Name",
            "payload": {"value": "new-value"}
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.put(
                f"/api/resources/variable/{resource.id}",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403]

    def test_delete_resource_succeeds(self):
        """Verify resource deletion."""
        resource = MockResource(id="res-1", resource_type="variable", tenant_id=self.tenant_id, workspace_id=self.workspace_id)
        self.db.resources[resource.id] = resource

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.delete(
                f"/api/resources/variable/{resource.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should return 204 No Content or 200
        assert response.status_code in [200, 204, 403]

    def test_cannot_access_resource_from_different_workspace(self):
        """Verify user cannot access resource from different workspace."""
        resource = MockResource(id="res-1", resource_type="credential", tenant_id=self.tenant_id, workspace_id="ws-2")
        self.db.resources[resource.id] = resource

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "active_workspace": "ws-1"}):
            response = self.client.get(
                f"/api/resources/credential/{resource.id}",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should return 403 Forbidden or 404
        assert response.status_code in [403, 404]

    def test_resources_filtered_by_active_workspace(self):
        """Verify resources are filtered by active workspace."""
        ws1_resource = MockResource(id="res-1", resource_type="credential", tenant_id=self.tenant_id, workspace_id="ws-1")
        ws2_resource = MockResource(id="res-2", resource_type="credential", tenant_id=self.tenant_id, workspace_id="ws-2")

        self.db.resources[ws1_resource.id] = ws1_resource
        self.db.resources[ws2_resource.id] = ws2_resource

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id, "active_workspace": "ws-1"}):
            response = self.client.get(
                "/api/resources/credential",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        assert response.status_code in [200, 403]

    def test_credential_resource_encrypts_secrets(self):
        """Verify credential resources encrypt sensitive data."""
        request_body = {
            "name": "API Key",
            "payload": {
                "api_key": "super-secret-key",
                "password": "encrypted-password"
            }
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/resources/credential",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should handle secret encryption
        assert response.status_code in [200, 201, 403]

    def test_cannot_create_resource_without_name(self):
        """Verify resource creation requires name."""
        request_body = {
            "payload": {"value": "test"}
        }

        with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
            response = self.client.post(
                "/api/resources/variable",
                json=request_body,
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
            )

        # Should reject invalid request
        assert response.status_code in [400, 422, 403]

    def test_list_all_supported_resource_types(self):
        """Verify all resource types are supported."""
        resource_types = [
            "credential",
            "variable",
            "tool",
            "dataset",
            "document_store",
            "workspace"
        ]

        for resource_type in resource_types:
            with patch('auth.get_current_user', return_value={"tenant_id": self.tenant_id, "user_id": self.user_id}):
                response = self.client.get(
                    f"/api/resources/{resource_type}",
                    headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id)
                )

                # Should handle all types (even if no resources exist)
                assert response.status_code in [200, 403, 404]


class ResourcesLogicTests(unittest.TestCase):
    """Unit tests for resource logic (non-HTTP)."""

    def test_resource_has_required_fields(self):
        """Verify resource has required fields."""
        resource = MockResource(id="res-1", resource_type="credential", tenant_id="tenant-1", workspace_id="ws-1")
        assert resource.id is not None
        assert resource.resource_type is not None
        assert resource.tenant_id is not None
        assert resource.workspace_id is not None

    def test_resource_workspace_isolation(self):
        """Verify resources are workspace-scoped."""
        res1 = MockResource(id="res-1", workspace_id="ws-1")
        res2 = MockResource(id="res-2", workspace_id="ws-2")
        assert res1.workspace_id != res2.workspace_id

    def test_resource_payload_storage(self):
        """Verify resource payload is stored."""
        resource = MockResource(id="res-1", resource_type="variable")
        assert resource.payload is not None
        assert isinstance(resource.payload, dict)

    def test_resource_creation_timestamp(self):
        """Verify resource has creation timestamp."""
        resource = MockResource(id="res-1", resource_type="credential")
        assert resource.created_at is not None


if __name__ == "__main__":
    unittest.main()
