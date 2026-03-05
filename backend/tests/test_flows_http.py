import unittest
import warnings
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import flows


class FakeDB:
    pass


class FlowsHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Keep local unittest output clean on Python 3.14+.
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        self.db = FakeDB()
        app = FastAPI()
        app.include_router(flows.router, prefix="/api/flows")

        def override_get_db():
            yield self.db

        app.dependency_overrides[flows.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    @staticmethod
    def _headers(role: str, tenant_id: str = "tenant-usage-1") -> dict[str, str]:
        token = auth.create_token(
            {
                "sub": f"{role}@example.com",
                "tenant_id": tenant_id,
                "role": role,
                "user_id": f"user-{role}",
            }
        )
        return {"Authorization": f"Bearer {token}"}

    def test_usage_returns_snapshot_payload(self):
        usage_stub = {
            "total_flows": 4,
            "published_flows": 3,
            "executions_today": 7,
            "monthly_tokens_used": 2400,
            "daily_usage": [
                {"date": "2026-02-18", "tokens_used": 800, "executions": 2},
                {"date": "2026-02-19", "tokens_used": 1600, "executions": 5},
            ],
            "daily_tokens": [
                {"date": "2026-02-18", "tokens_used": 800},
                {"date": "2026-02-19", "tokens_used": 1600},
            ],
        }
        queue_stub = {
            "execution_queue": 1,
            "ingestion_queue": 2,
            "execution_dlq": 0,
            "ingestion_dlq": 1,
            "total": 4,
        }

        with (
            patch.object(flows, "_collect_usage_metrics", return_value=usage_stub) as usage_mock,
            patch.object(flows, "_collect_queue_depth", return_value=queue_stub),
        ):
            response = self.client.get(
                "/api/flows/usage",
                headers=self._headers("viewer", tenant_id="tenant-http-1"),
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        usage_mock.assert_called_once_with(
            self.db,
            "tenant-http-1",
            trend_days=max(1, flows.USAGE_DAILY_DAYS),
        )
        self.assertEqual(payload["tenant_id"], "tenant-http-1")
        self.assertEqual(payload["window_days"], max(1, flows.USAGE_DAILY_DAYS))
        self.assertEqual(payload["daily_usage"], usage_stub["daily_usage"])
        self.assertEqual(payload["queue_depth"], queue_stub)

    def test_usage_accepts_supported_days_query(self):
        usage_stub = {
            "total_flows": 1,
            "published_flows": 1,
            "executions_today": 1,
            "monthly_tokens_used": 500,
            "daily_usage": [{"date": "2026-02-19", "tokens_used": 500, "executions": 1}],
            "daily_tokens": [{"date": "2026-02-19", "tokens_used": 500}],
        }

        with (
            patch.object(flows, "_collect_usage_metrics", return_value=usage_stub) as usage_mock,
            patch.object(flows, "_collect_queue_depth", return_value={"total": 0}),
        ):
            response = self.client.get(
                "/api/flows/usage?days=30",
                headers=self._headers("editor", tenant_id="tenant-http-2"),
            )

        self.assertEqual(response.status_code, 200)
        usage_mock.assert_called_once_with(self.db, "tenant-http-2", trend_days=30)
        self.assertEqual(response.json()["window_days"], 30)

    def test_usage_rejects_unsupported_days_query(self):
        response = self.client.get(
            "/api/flows/usage?days=14",
            headers=self._headers("admin"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "days must be one of: 7, 30")

    def test_usage_requires_authentication(self):
        response = self.client.get("/api/flows/usage")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Missing auth token")

    def test_get_tool_state_returns_tenant_scoped_payload(self):
        tool_state_stub = {
            "states": {
                "calculator": True,
                "sql_tool": False,
                "retriever": True,
                "http_fetch": False,
            },
            "updated_at": "2026-02-19T12:00:00+00:00",
        }
        with patch.object(flows, "_get_user_tool_states", return_value=tool_state_stub) as state_mock:
            response = self.client.get(
                "/api/flows/tools/state",
                headers=self._headers("viewer", tenant_id="tenant-http-tools"),
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        state_mock.assert_called_once_with(self.db, "tenant-http-tools", "user-viewer")
        self.assertEqual(payload["tenant_id"], "tenant-http-tools")
        self.assertEqual(payload["user_id"], "user-viewer")
        self.assertEqual(payload["states"], tool_state_stub["states"])
        self.assertEqual(payload["updated_at"], tool_state_stub["updated_at"])

    def test_update_tool_state_persists_tenant_scoped_payload(self):
        request_body = {"states": {"calculator": False, "http_fetch": True}}
        tool_state_stub = {
            "states": {
                "calculator": False,
                "sql_tool": True,
                "retriever": True,
                "http_fetch": True,
            },
            "updated_at": "2026-02-19T12:15:00+00:00",
        }

        with (
            patch.object(flows, "_ensure_tenant") as ensure_tenant_mock,
            patch.object(flows, "_ensure_tenant_user") as ensure_user_mock,
            patch.object(flows, "_persist_user_tool_states", return_value=tool_state_stub) as persist_mock,
        ):
            response = self.client.put(
                "/api/flows/tools/state",
                json=request_body,
                headers=self._headers("editor", tenant_id="tenant-http-tools-2"),
            )

        self.assertEqual(response.status_code, 200)
        ensure_tenant_mock.assert_called_once_with(self.db, "tenant-http-tools-2")
        ensure_user_mock.assert_called_once()
        persist_mock.assert_called_once_with(
            self.db,
            "tenant-http-tools-2",
            "user-editor",
            request_body["states"],
        )
        payload = response.json()
        self.assertEqual(payload["tenant_id"], "tenant-http-tools-2")
        self.assertEqual(payload["user_id"], "user-editor")
        self.assertEqual(payload["states"], tool_state_stub["states"])

    def test_tools_state_requires_authentication(self):
        response = self.client.get("/api/flows/tools/state")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Missing auth token")


if __name__ == "__main__":
    unittest.main()
