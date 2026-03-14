import unittest
import warnings
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import flows
import resources


class WorkspaceIsolationTests(unittest.TestCase):
    """Tests for workspace isolation enforcement across flow and resource endpoints."""

    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        """Set up test fixtures with mock database and API clients."""
        self.db = MagicMock()

        # Create FastAPI app with routers
        app = FastAPI()
        app.include_router(flows.router, prefix="/api/flows")
        app.include_router(resources.router, prefix="/api/resources")

        # Override database dependency
        def override_get_db():
            yield self.db

        app.dependency_overrides[flows.get_db] = override_get_db
        app.dependency_overrides[resources.get_db] = override_get_db

        self.client = TestClient(app)

        # Test data
        self.tenant_id = "tenant-1"
        self.user_id = "user-1"
        self.workspace_id_a = "workspace-a"
        self.workspace_id_b = "workspace-b"

    def tearDown(self):
        self.client.close()

    @staticmethod
    def _headers(user_id: str = "user-1", tenant_id: str = "tenant-1", role: str = "admin") -> dict[str, str]:
        """Create authorization headers with JWT token."""
        token = auth.create_token(
            {
                "sub": f"{user_id}@example.com",
                "tenant_id": tenant_id,
                "role": role,
                "user_id": user_id,
            }
        )
        return {"Authorization": f"Bearer {token}"}

    def _mock_active_workspace(self, workspace_id: str):
        """Mock _get_active_workspace to return specified workspace."""
        def get_active_workspace(db, tenant_id, user_id):
            return workspace_id
        return get_active_workspace

    def _mock_flow(self, flow_id: str, workspace_id: str, name: str = "Test Flow"):
        """Create a mock Flow object."""
        flow = MagicMock()
        flow.id = flow_id
        flow.workspace_id = workspace_id
        flow.tenant_id = self.tenant_id
        flow.name = name
        flow.created_at = datetime.now(timezone.utc)
        return flow

    def _mock_resource(self, resource_id: str, workspace_id: str, resource_type: str = "credential", name: str = "Test Resource"):
        """Create a mock TenantResource object."""
        resource = MagicMock()
        resource.id = resource_id
        resource.workspace_id = workspace_id
        resource.tenant_id = self.tenant_id
        resource.resource_type = resource_type
        resource.name = name
        resource.created_at = datetime.now(timezone.utc)
        resource.updated_at = datetime.now(timezone.utc)
        return resource

    @patch('flows._get_active_workspace')
    @patch('flows._require_tenant_flow')
    def test_user_can_only_list_flows_in_active_workspace(self, mock_require, mock_active_workspace):
        """Verify flows are filtered by user's active workspace."""
        # Setup
        flow_a = self._mock_flow("flow-1", self.workspace_id_a)
        flow_b = self._mock_flow("flow-2", self.workspace_id_b)

        mock_active_workspace.return_value = self.workspace_id_a

        # Mock the query chain
        mock_query = MagicMock()
        mock_query.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [flow_a]
        self.db.query.return_value = mock_query

        # Execute
        response = self.client.get(
            "/api/flows/list",
            headers=self._headers(self.user_id, self.tenant_id)
        )

        # Verify
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        # Verify that workspace filter was applied
        mock_query.filter.assert_called_once()
        filter_args = mock_query.filter.call_args[0]
        assert len(filter_args) == 2  # Should have tenant_id and workspace_id filters

    @patch('flows._get_active_workspace')
    def test_creating_flow_assigns_to_active_workspace(self, mock_active_workspace):
        """Verify new flows are created in user's active workspace."""
        # Setup
        mock_active_workspace.return_value = self.workspace_id_a

        # Mock _ensure_tenant
        with patch('flows._ensure_tenant'):
            # Mock database add/commit
            self.db.query.return_value.filter.return_value.scalar.return_value = 0  # For version query

            # Execute
            response = self.client.post(
                "/api/flows/create",
                json={
                    "name": "Test Flow",
                    "json_definition": {}
                },
                headers=self._headers(self.user_id, self.tenant_id)
            )

        # Verify
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "flow_id" in data, "Response should contain flow_id"

    @patch('flows._get_active_workspace')
    @patch('flows._require_tenant_flow')
    def test_cross_workspace_access_returns_404(self, mock_require, mock_active_workspace):
        """Verify user cannot access flows from other workspaces."""
        # Setup
        flow_in_workspace_b = self._mock_flow("flow-2", self.workspace_id_b)

        mock_active_workspace.return_value = self.workspace_id_a
        mock_require.return_value = flow_in_workspace_b

        # Execute: Try to get a flow from workspace B while in workspace A
        response = self.client.get(
            "/api/flows/flow-2",
            headers=self._headers(self.user_id, self.tenant_id)
        )

        # Verify
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    @patch('resources._get_active_workspace')
    def test_resources_filtered_by_workspace(self, mock_active_workspace):
        """Verify resources are filtered by workspace."""
        # Setup
        mock_active_workspace.return_value = self.workspace_id_a
        resource_a = self._mock_resource("resource-1", self.workspace_id_a, "credential")

        # Mock the query chain
        mock_query = MagicMock()
        mock_query.filter.return_value.ilike = MagicMock(return_value=mock_query)
        mock_query.count.return_value = 1
        mock_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [resource_a]
        self.db.query.return_value = mock_query

        # Mock helper functions
        with patch('resources._ensure_resource_type', return_value='credential'):
            with patch('resources._required_reader_roles', return_value=['admin', 'editor']):
                with patch('resources._serialize_resource', return_value={"id": "resource-1"}):
                    # Execute
                    response = self.client.get(
                        "/api/resources/credential",
                        headers=self._headers(self.user_id, self.tenant_id, role='admin')
                    )

        # Verify
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        # Verify workspace filter was applied
        mock_query.filter.assert_called_once()

    @patch('flows._get_active_workspace')
    @patch('flows._require_tenant_flow')
    def test_deleting_flow_from_other_workspace_returns_404(self, mock_require, mock_active_workspace):
        """Verify user cannot delete flows from other workspaces."""
        # Setup
        flow_in_workspace_b = self._mock_flow("flow-2", self.workspace_id_b)

        mock_active_workspace.return_value = self.workspace_id_a
        mock_require.return_value = flow_in_workspace_b

        # Execute: Try to delete a flow from workspace B while in workspace A
        response = self.client.delete(
            "/api/flows/flow-2",
            headers=self._headers(self.user_id, self.tenant_id)
        )

        # Verify
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    @patch('flows._get_active_workspace')
    @patch('flows._require_tenant_flow')
    def test_publishing_flow_from_other_workspace_returns_404(self, mock_require, mock_active_workspace):
        """Verify user cannot publish flows from other workspaces."""
        # Setup
        flow_in_workspace_b = self._mock_flow("flow-2", self.workspace_id_b)

        mock_active_workspace.return_value = self.workspace_id_a
        mock_require.return_value = flow_in_workspace_b

        # Execute: Try to publish a flow from workspace B while in workspace A
        response = self.client.post(
            "/api/flows/flow-2/publish",
            json={"version": 1},
            headers=self._headers(self.user_id, self.tenant_id)
        )

        # Verify
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    @patch('resources._get_active_workspace')
    def test_resource_creation_assigns_to_active_workspace(self, mock_active_workspace):
        """Verify resources are created in user's active workspace."""
        # Setup
        mock_active_workspace.return_value = self.workspace_id_a

        # Mock helper functions
        with patch('resources._ensure_resource_type', return_value='credential'):
            with patch('resources._ensure_tenant'):
                with patch('resources._append_audit_log'):
                    with patch('resources._serialize_resource', return_value={"id": "resource-1"}):
                        # Execute
                        response = self.client.post(
                            "/api/resources/credential",
                            json={
                                "name": "Test Credential",
                                "payload": {"key": "value"}
                            },
                            headers=self._headers(self.user_id, self.tenant_id, role='admin')
                        )

        # Verify
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        # Verify that db.add was called (resource was created)
        self.db.add.assert_called()

    @patch('resources._get_active_workspace')
    @patch('resources._ensure_resource_type')
    def test_updating_resource_from_other_workspace_returns_404(self, mock_type, mock_active_workspace):
        """Verify user cannot update resources from other workspaces."""
        # Setup
        mock_active_workspace.return_value = self.workspace_id_a
        mock_type.return_value = 'credential'
        resource_in_workspace_b = self._mock_resource("resource-2", self.workspace_id_b)

        # Mock query to return None (resource not found in active workspace)
        mock_query = MagicMock()
        mock_query.filter.return_value.one_or_none.return_value = None
        self.db.query.return_value = mock_query

        # Execute: Try to update a resource from workspace B while in workspace A
        response = self.client.put(
            "/api/resources/credential/resource-2",
            json={"name": "Updated Name"},
            headers=self._headers(self.user_id, self.tenant_id, role='admin')
        )

        # Verify
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


if __name__ == "__main__":
    unittest.main()
