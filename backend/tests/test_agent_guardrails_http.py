import unittest
import warnings
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import agent_guardrails as guardrails
import auth


class FakeDB:
    def __init__(self, audit_rows=None):
        self.added = []
        self.commits = 0
        self.audit_rows = list(audit_rows or [])
        self.query_obj = None

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1

    def query(self, model):
        if model is not guardrails.AuditLog:
            raise AssertionError(f"Unexpected DB query model: {model}")
        self.query_obj = FakeAuditQuery(self.audit_rows)
        return self.query_obj


class FakeAuditQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.offset_value = 0
        self.limit_value = None

    def filter(self, *criteria):
        self.filters.append(criteria)
        return self

    def count(self):
        return len(self._filtered_rows())

    def order_by(self, *_args):
        return self

    def offset(self, value):
        self.offset_value = value
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def all(self):
        rows = self._filtered_rows()
        start = max(0, self.offset_value)
        if self.limit_value is None:
            return rows[start:]
        end = start + max(0, self.limit_value)
        return rows[start:end]

    def _filtered_rows(self):
        filtered = list(self.rows)
        for criteria in self.filters:
            for criterion in criteria:
                left = getattr(criterion, "left", None)
                right = getattr(criterion, "right", None)
                key = getattr(left, "key", None)
                if key is None:
                    continue
                value = getattr(right, "value", None)
                operator = getattr(getattr(criterion, "operator", None), "__name__", "")
                if operator == "eq":
                    filtered = [row for row in filtered if getattr(row, key, None) == value]
                elif operator == "ge":
                    filtered = [row for row in filtered if getattr(row, key, None) >= value]
                elif operator == "le":
                    filtered = [row for row in filtered if getattr(row, key, None) <= value]
        return filtered


class AgentGuardrailsHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Keep local unittest output clean on Python 3.14+.
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        self.db = FakeDB()
        app = FastAPI()
        app.include_router(guardrails.router, prefix="/agent")

        def override_get_db():
            yield self.db

        app.dependency_overrides[guardrails.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    @staticmethod
    def _criterion_triplets(filters):
        triplets = []
        for criteria in filters:
            for criterion in criteria:
                left = getattr(criterion, "left", None)
                right = getattr(criterion, "right", None)
                key = getattr(left, "key", None)
                value = getattr(right, "value", None)
                operator = getattr(getattr(criterion, "operator", None), "__name__", "")
                if key is not None:
                    triplets.append((key, operator, value))
        return triplets

    @staticmethod
    def _headers(role: str, tenant_id: str = "tenant-1", user_id: str = "user-1") -> dict:
        token = auth.create_token(
            {
                "sub": f"{role}@example.com",
                "tenant_id": tenant_id,
                "role": role,
                "user_id": user_id,
            }
        )
        return {"Authorization": f"Bearer {token}"}

    def test_evaluate_rejects_when_concurrent_limit_reached_http(self):
        body = {
            "task_description": "Update frontend styles and run unit tests safely",
            "requested_paths": ["frontend/src/styles.css"],
            "requested_tools": ["file_read", "file_write", "test_runner"],
            "requires_write": True,
            "expected_files_changed": 1,
        }

        with (
            patch.object(guardrails, "_count_recent_policy_evaluations", return_value=0),
            patch.object(
                guardrails,
                "_count_running_tasks",
                return_value=guardrails.MAX_AGENT_CONCURRENT_RUNNING_TASKS,
            ),
        ):
            response = self.client.post(
                "/agent/tasks/evaluate",
                json=body,
                headers=self._headers("editor"),
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["allowed"])
        self.assertTrue(
            any("Concurrent running task limit reached" in reason for reason in payload["reasons"])
        )
        self.assertEqual(self.db.commits, 1)
        self.assertEqual(len(self.db.added), 1)

    def test_evaluate_audit_details_include_runtime_budget_limits_http(self):
        body = {
            "task_description": "Apply scoped frontend style cleanup and run tests",
            "requested_paths": ["frontend/src/styles.css"],
            "requested_tools": ["file_read", "file_write", "test_runner"],
            "requires_write": True,
            "expected_files_changed": 1,
        }

        with (
            patch.object(guardrails, "_count_recent_policy_evaluations", return_value=0),
            patch.object(guardrails, "_count_running_tasks", return_value=0),
        ):
            response = self.client.post(
                "/agent/tasks/evaluate",
                json=body,
                headers=self._headers("editor"),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.db.commits, 1)
        self.assertEqual(len(self.db.added), 1)
        audit_entry = self.db.added[0]
        budget_limits = audit_entry.details.get("budget_limits", {})
        self.assertEqual(
            budget_limits.get("max_runtime_tokens_used"),
            guardrails.MAX_AGENT_RUNTIME_TOKENS_USED,
        )
        self.assertEqual(
            budget_limits.get("max_runtime_duration_ms"),
            guardrails.MAX_AGENT_RUNTIME_DURATION_MS,
        )
        self.assertEqual(
            budget_limits.get("max_evaluations_per_minute"),
            guardrails.MAX_AGENT_EVALUATIONS_PER_MINUTE,
        )
        self.assertEqual(audit_entry.details.get("policy_evaluations_last_minute"), 0)

    def test_evaluate_rejects_when_policy_rate_limit_reached_http(self):
        body = {
            "task_description": "Apply scoped frontend style cleanup and run tests",
            "requested_paths": ["frontend/src/styles.css"],
            "requested_tools": ["file_read", "file_write", "test_runner"],
            "requires_write": True,
            "expected_files_changed": 1,
        }

        with (
            patch.object(
                guardrails,
                "_count_recent_policy_evaluations",
                return_value=guardrails.MAX_AGENT_EVALUATIONS_PER_MINUTE,
            ),
            patch.object(guardrails, "_count_running_tasks", return_value=0),
        ):
            response = self.client.post(
                "/agent/tasks/evaluate",
                json=body,
                headers=self._headers("editor"),
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["allowed"])
        self.assertTrue(
            any("Policy evaluation rate limit reached" in reason for reason in payload["reasons"])
        )

    def test_evaluate_rejects_viewer_role_http(self):
        response = self.client.post(
            "/agent/tasks/evaluate",
            json={
                "task_description": "Update frontend styles with scoped changes only",
                "requested_paths": ["frontend/src/styles.css"],
                "requested_tools": ["file_read", "file_write"],
                "requires_write": True,
                "expected_files_changed": 1,
            },
            headers=self._headers("viewer"),
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Insufficient role")

    def test_config_returns_limits_and_allowed_tools_http(self):
        response = self.client.get(
            "/agent/tasks/config",
            headers=self._headers("editor"),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["tenant_id"], "tenant-1")
        self.assertIn("file_read", payload["allowed_tools"])
        self.assertEqual(
            payload["limits"]["max_runtime_files_changed"],
            guardrails.MAX_AGENT_RUNTIME_FILES_CHANGED,
        )

    def test_config_rejects_viewer_role_http(self):
        response = self.client.get(
            "/agent/tasks/config",
            headers=self._headers("viewer"),
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Insufficient role")

    def test_report_rejects_changed_bytes_budget_http(self):
        response = self.client.post(
            "/agent/tasks/report",
            json={
                "task_id": "task-bytes-http-1",
                "status": "completed",
                "files_changed": ["backend/agent_guardrails.py"],
                "changed_bytes": guardrails.MAX_AGENT_TOTAL_CHANGED_BYTES + 1,
                "execution_duration_ms": 250,
                "tokens_used": 1200,
                "branch_name": "feature/agent-guardrails",
                "pr_url": "https://example.com/pr/10",
            },
            headers=self._headers("admin"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("changed_bytes exceeds budget", response.json()["detail"])

    def test_report_rejects_runtime_files_changed_budget_http(self):
        response = self.client.post(
            "/agent/tasks/report",
            json={
                "task_id": "task-files-http-1",
                "status": "running",
                "files_changed": [
                    f"frontend/src/file-{idx}.css"
                    for idx in range(guardrails.MAX_AGENT_RUNTIME_FILES_CHANGED + 1)
                ],
                "changed_bytes": 512,
                "execution_duration_ms": 50,
                "tokens_used": 100,
            },
            headers=self._headers("admin"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("files_changed exceeds runtime budget", response.json()["detail"])

    def test_report_rejects_tokens_used_budget_http(self):
        response = self.client.post(
            "/agent/tasks/report",
            json={
                "task_id": "task-tokens-http-1",
                "status": "running",
                "files_changed": ["backend/agent_guardrails.py"],
                "changed_bytes": 512,
                "execution_duration_ms": 50,
                "tokens_used": guardrails.MAX_AGENT_RUNTIME_TOKENS_USED + 1,
            },
            headers=self._headers("admin"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("tokens_used exceeds runtime budget", response.json()["detail"])

    def test_report_rejects_runtime_duration_budget_http(self):
        response = self.client.post(
            "/agent/tasks/report",
            json={
                "task_id": "task-duration-http-1",
                "status": "running",
                "files_changed": ["backend/agent_guardrails.py"],
                "changed_bytes": 512,
                "execution_duration_ms": guardrails.MAX_AGENT_RUNTIME_DURATION_MS + 1,
                "tokens_used": 100,
            },
            headers=self._headers("admin"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("execution_duration_ms exceeds runtime budget", response.json()["detail"])

    def test_report_running_returns_409_on_concurrent_limit_http(self):
        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None),
            patch.object(
                guardrails,
                "_count_running_tasks",
                return_value=guardrails.MAX_AGENT_CONCURRENT_RUNNING_TASKS,
            ),
        ):
            response = self.client.post(
                "/agent/tasks/report",
                json={
                    "task_id": "task-running-http-1",
                    "status": "running",
                    "files_changed": ["backend/agent_guardrails.py"],
                    "changed_bytes": 1024,
                    "execution_duration_ms": 80,
                    "tokens_used": 300,
                },
                headers=self._headers("editor"),
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("Concurrent running task limit reached", response.json()["detail"])

    def test_report_rejects_when_policy_not_approved_http(self):
        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None),
            patch.object(guardrails, "_count_running_tasks", return_value=0),
            patch.object(guardrails, "_get_task_policy_action", return_value=None),
        ):
            response = self.client.post(
                "/agent/tasks/report",
                json={
                    "task_id": "task-running-http-policy-missing",
                    "status": "running",
                    "files_changed": ["backend/agent_guardrails.py"],
                    "changed_bytes": 512,
                    "execution_duration_ms": 50,
                    "tokens_used": 120,
                },
                headers=self._headers("editor"),
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("no approved policy record", response.json()["detail"])

    def test_report_rejects_when_policy_rejected_http(self):
        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None),
            patch.object(guardrails, "_count_running_tasks", return_value=0),
            patch.object(guardrails, "_get_task_policy_action", return_value="agent_task_policy_rejected"),
        ):
            response = self.client.post(
                "/agent/tasks/report",
                json={
                    "task_id": "task-running-http-policy-rejected",
                    "status": "running",
                    "files_changed": ["backend/agent_guardrails.py"],
                    "changed_bytes": 512,
                    "execution_duration_ms": 50,
                    "tokens_used": 120,
                },
                headers=self._headers("editor"),
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("policy is rejected", response.json()["detail"])

    def test_report_running_uses_tenant_context_for_tracking_http(self):
        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None) as latest_mock,
            patch.object(guardrails, "_count_running_tasks", return_value=0) as count_mock,
            patch.object(guardrails, "_get_task_policy_action", return_value="agent_task_policy_approved") as policy_mock,
        ):
            response = self.client.post(
                "/agent/tasks/report",
                json={
                    "task_id": "task-running-http-tenant",
                    "status": "running",
                    "files_changed": ["backend/agent_guardrails.py"],
                    "changed_bytes": 256,
                    "execution_duration_ms": 50,
                    "tokens_used": 120,
                },
                headers=self._headers("editor", tenant_id="tenant-9", user_id="user-9"),
            )

        self.assertEqual(response.status_code, 200)
        latest_mock.assert_called_once_with(self.db, "tenant-9", "task-running-http-tenant")
        count_mock.assert_called_once_with(self.db, "tenant-9")
        policy_mock.assert_called_once_with(self.db, "tenant-9", "task-running-http-tenant")

    def test_report_completed_write_requires_branch_name_http(self):
        response = self.client.post(
            "/agent/tasks/report",
            json={
                "task_id": "task-completed-http-1",
                "status": "completed",
                "files_changed": ["backend/agent_guardrails.py"],
                "changed_bytes": 1024,
                "execution_duration_ms": 80,
                "tokens_used": 300,
                "pr_url": "https://example.com/pr/11",
            },
            headers=self._headers("editor"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("must include branch_name", response.json()["detail"])

    def test_audit_rejects_viewer_role_http(self):
        response = self.client.get(
            "/agent/tasks/audit",
            headers=self._headers("viewer"),
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Insufficient role")

    def test_audit_rejects_invalid_status_http(self):
        response = self.client.get(
            "/agent/tasks/audit?status=bad_status",
            headers=self._headers("admin"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported status filter", response.json()["detail"])

    def test_audit_clamps_limit_and_offset_http(self):
        now = datetime.now(timezone.utc)
        self.db.audit_rows = [
            SimpleNamespace(
                id="a-1",
                tenant_id="tenant-1",
                actor_user_id="u-1",
                actor_email="admin@example.com",
                actor_role="admin",
                action="agent_task_completed",
                resource_type="codex_task",
                resource_id="task-1",
                details={"tokens_used": 10},
                created_at=now,
            ),
            SimpleNamespace(
                id="a-2",
                tenant_id="tenant-1",
                actor_user_id="u-2",
                actor_email="editor@example.com",
                actor_role="editor",
                action="agent_task_failed",
                resource_type="codex_task",
                resource_id="task-2",
                details={"error_summary": "boom"},
                created_at=now,
            ),
        ]

        response = self.client.get(
            "/agent/tasks/audit?limit=0&offset=-3",
            headers=self._headers("editor"),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["limit"], 1)
        self.assertEqual(payload["offset"], 0)
        self.assertEqual(payload["total_count"], 2)
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["task_id"], "task-1")
        self.assertEqual(self.db.query_obj.limit_value, 1)
        self.assertEqual(self.db.query_obj.offset_value, 0)

    def test_audit_applies_filters_http(self):
        now = datetime.now(timezone.utc)
        self.db.audit_rows = [
            SimpleNamespace(
                id="a-3",
                tenant_id="tenant-1",
                actor_user_id="u-3",
                actor_email="admin@example.com",
                actor_role="admin",
                action="agent_task_completed",
                resource_type="codex_task",
                resource_id="task-3",
                details={"tokens_used": 20},
                created_at=now,
            )
        ]
        from_dt = datetime(2026, 2, 19, 0, 0, tzinfo=timezone.utc)
        to_dt = datetime(2026, 2, 20, 0, 0, tzinfo=timezone.utc)

        with patch.object(guardrails, "_parse_iso_datetime", side_effect=[from_dt, to_dt]) as parse_mock:
            response = self.client.get(
                "/agent/tasks/audit"
                "?action=agent_task_completed"
                "&status=completed"
                "&actor_email=admin@example.com"
                "&task_id=task-3"
                "&created_from=2026-02-19T00:00:00Z"
                "&created_to=2026-02-20T00:00:00Z",
                headers=self._headers("admin"),
            )

        self.assertEqual(response.status_code, 200)
        parse_mock.assert_any_call("2026-02-19T00:00:00Z", "created_from")
        parse_mock.assert_any_call("2026-02-20T00:00:00Z", "created_to")
        self.assertEqual(parse_mock.call_count, 2)

        triplets = self._criterion_triplets(self.db.query_obj.filters)
        self.assertIn(("tenant_id", "eq", "tenant-1"), triplets)
        self.assertIn(("resource_type", "eq", "codex_task"), triplets)
        self.assertIn(("action", "eq", "agent_task_completed"), triplets)
        self.assertIn(("actor_email", "eq", "admin@example.com"), triplets)
        self.assertIn(("resource_id", "eq", "task-3"), triplets)
        self.assertIn(("created_at", "ge", from_dt), triplets)
        self.assertIn(("created_at", "le", to_dt), triplets)

    def test_audit_is_tenant_scoped_http(self):
        now = datetime.now(timezone.utc)
        self.db.audit_rows = [
            SimpleNamespace(
                id="a-tenant-1",
                tenant_id="tenant-1",
                actor_user_id="u-1",
                actor_email="editor@example.com",
                actor_role="editor",
                action="agent_task_completed",
                resource_type="codex_task",
                resource_id="task-tenant-1",
                details={},
                created_at=now,
            ),
            SimpleNamespace(
                id="a-tenant-2",
                tenant_id="tenant-2",
                actor_user_id="u-2",
                actor_email="admin@example.com",
                actor_role="admin",
                action="agent_task_completed",
                resource_type="codex_task",
                resource_id="task-tenant-2",
                details={},
                created_at=now,
            ),
        ]

        response = self.client.get(
            "/agent/tasks/audit",
            headers=self._headers("editor", tenant_id="tenant-1"),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total_count"], 1)
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["tenant_id"], "tenant-1")
        self.assertEqual(payload["items"][0]["task_id"], "task-tenant-1")


if __name__ == "__main__":
    unittest.main()
