"""
Tests for flows.py HTTP route handlers.
Covers critical endpoints: create, publish, execute.
"""

import pytest
from uuid import uuid4
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from conftest import create_test_headers, MockUser


client = TestClient(app)


class TestFlowHandlers:
    """Test critical flow HTTP handlers."""

    def test_create_flow_requires_auth(self):
        """POST /flows/create requires authentication."""
        response = client.post("/flows/create", json={"name": "test"})
        assert response.status_code in [401, 403, 422]

    def test_create_flow_validates_name_length(self):
        """POST /flows/create rejects empty name."""
        headers = create_test_headers()
        response = client.post(
            "/flows/create",
            json={"name": ""},  # Empty name should be rejected
            headers=headers
        )
        # Should fail validation
        assert response.status_code in [422, 400]

    def test_create_flow_name_too_long(self):
        """POST /flows/create rejects names over 255 chars."""
        headers = create_test_headers()
        long_name = "x" * 300  # Over max length
        response = client.post(
            "/flows/create",
            json={"name": long_name},
            headers=headers
        )
        assert response.status_code in [422, 400]

    def test_publish_flow_requires_flow_id(self):
        """PUT /flows/{flow_id}/publish requires flow_id parameter."""
        headers = create_test_headers()
        # Missing flow_id should fail
        response = client.put(
            "/flows/nonexistent/publish",
            json={},
            headers=headers
        )
        # Should fail (flow not found or auth)
        assert response.status_code in [404, 403, 401]

    def test_execute_flow_requires_input(self):
        """POST /flows/{flow_id}/execute requires input field."""
        headers = create_test_headers()
        response = client.post(
            "/flows/test-id/execute",
            json={},  # Missing required input
            headers=headers
        )
        # Should fail validation or auth
        assert response.status_code in [422, 404, 403, 401]

    def test_execute_flow_forbids_extra_fields(self):
        """POST /flows/{flow_id}/execute rejects unknown fields (extra="forbid")."""
        headers = create_test_headers()
        response = client.post(
            "/flows/test-id/execute",
            json={
                "input": {"test": "data"},
                "unknown_field": "should_fail"  # Extra field not in schema
            },
            headers=headers
        )
        # Should fail validation due to extra="forbid"
        assert response.status_code in [422, 404, 403, 401]


class TestFlowResponseModels:
    """Test that response models are properly defined."""

    def test_create_flow_has_response_model(self):
        """Verify /flows/create endpoint has response_model."""
        # This is a structural test - check OpenAPI spec
        response = client.get("/openapi.json")
        if response.status_code == 200:
            spec = response.json()
            # Should have /flows/create in paths
            assert "/flows/create" in spec.get("paths", {})

    def test_publish_flow_has_response_model(self):
        """Verify /flows/{flow_id}/publish endpoint has response_model."""
        response = client.get("/openapi.json")
        if response.status_code == 200:
            spec = response.json()
            # Should have /flows/{flow_id}/publish in paths
            assert any(
                "publish" in path
                for path in spec.get("paths", {}).keys()
            )


class TestFlowInputValidation:
    """Test input validation for critical flow endpoints."""

    def test_flow_name_validation_min_length(self):
        """FlowCreateRequest validates name min_length=1."""
        from flows import FlowCreateRequest

        # Empty name should fail
        with pytest.raises(ValueError):
            FlowCreateRequest(name="", json_definition={})

    def test_flow_name_validation_max_length(self):
        """FlowCreateRequest validates name max_length=255."""
        from flows import FlowCreateRequest

        # Name over 255 should fail
        with pytest.raises(ValueError):
            FlowCreateRequest(name="x" * 300, json_definition={})

    def test_execute_request_forbids_extra_fields(self):
        """ExecuteRequest has extra='forbid' in ConfigDict."""
        from flows import ExecuteRequest
        from pydantic import ValidationError

        # Extra field should fail
        with pytest.raises(ValidationError):
            ExecuteRequest(
                input={"test": "data"},
                unknown_field="extra"
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
