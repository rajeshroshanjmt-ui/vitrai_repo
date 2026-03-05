import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

import agent_guardrails as guardrails


class FakeDB:
    def __init__(self):
        self.added = []
        self.commits = 0

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1


class FakeAuditQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.offset_value = 0
        self.limit_value = None
        self.order_by_args = ()

    def filter(self, *criteria):
        self.filters.append(criteria)
        return self

    def count(self):
        return len(self.rows)

    def order_by(self, *args):
        self.order_by_args = args
        return self

    def offset(self, value):
        self.offset_value = value
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def all(self):
        start = max(0, self.offset_value)
        if self.limit_value is None:
            return self.rows[start:]
        end = start + max(0, self.limit_value)
        return self.rows[start:end]


class FakeAuditDB:
    def __init__(self, rows):
        self.query_obj = FakeAuditQuery(rows)

    def query(self, model):
        if model is not guardrails.AuditLog:
            raise AssertionError(f"Unexpected model query: {model}")
        return self.query_obj


class AgentGuardrailsTests(unittest.TestCase):
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

    def test_evaluate_allows_low_risk_frontend_task(self):
        user = {"role": "editor", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Update frontend layout spacing and button styles safely",
            requested_paths=["frontend/src/App.jsx", "frontend/src/styles.css"],
            requested_tools=["file_read", "file_write", "test_runner"],
            risk_level="low",
            requires_write=True,
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.risk_level, "low")
        self.assertFalse(decision.requires_approval)
        self.assertEqual(
            decision.requested_tools,
            ["file_read", "file_write", "test_runner"],
        )

    def test_evaluate_rejects_unsupported_tools(self):
        user = {"role": "admin", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Run an unsafe tool operation",
            requested_paths=["frontend/src/App.jsx"],
            requested_tools=["file_read", "network_call"],
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertFalse(decision.allowed)
        self.assertIn("Unsupported tools requested: network_call", decision.reasons)

    def test_evaluate_rejects_secret_path(self):
        user = {"role": "admin", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Read secrets file directly in task",
            requested_paths=[".env"],
            requested_tools=["file_read"],
            requires_write=False,
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertFalse(decision.allowed)
        self.assertTrue(any("targets a secrets file" in reason for reason in decision.reasons))

    def test_evaluate_rejects_ci_change_without_flag(self):
        user = {"role": "admin", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Update CI workflow",
            requested_paths=[".github/workflows/fast-check.yml"],
            requested_tools=["file_write"],
            requires_write=True,
            allow_protected_changes=False,
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertFalse(decision.allowed)
        self.assertTrue(any("allow_protected_changes=true" in reason for reason in decision.reasons))

    def test_evaluate_high_risk_requires_explicit_approval(self):
        user = {"role": "admin", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Adjust auth validation for role handling",
            requested_paths=["backend/auth.py"],
            requested_tools=["file_read", "file_write"],
            requires_write=True,
            approval_confirmed=False,
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertEqual(decision.risk_level, "high")
        self.assertTrue(decision.requires_approval)
        self.assertFalse(decision.allowed)
        self.assertTrue(any("approval_confirmed=true" in reason for reason in decision.reasons))

    def test_evaluate_high_risk_allows_with_explicit_approval(self):
        user = {"role": "admin", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Adjust auth validation for role handling safely",
            requested_paths=["backend/auth.py"],
            requested_tools=["file_read", "file_write", "test_runner"],
            requires_write=True,
            approval_confirmed=True,
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.risk_level, "high")
        self.assertTrue(decision.requires_approval)

    def test_evaluate_rejects_when_budget_exceeded(self):
        user = {"role": "editor", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Implement multi-file backend refactor with broad impact",
            requested_paths=["backend/agent_guardrails.py"],
            requested_tools=["file_read", "file_write", "test_runner"],
            estimated_tokens=guardrails.MAX_AGENT_ESTIMATED_TOKENS + 1,
            expected_duration_ms=guardrails.MAX_AGENT_EXPECTED_DURATION_MS + 1,
            expected_files_changed=guardrails.MAX_AGENT_EXPECTED_FILES_CHANGED + 1,
            expected_total_changed_bytes=guardrails.MAX_AGENT_TOTAL_CHANGED_BYTES + 1,
            requires_write=True,
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertFalse(decision.allowed)
        self.assertTrue(any("estimated_tokens exceeds budget" in reason for reason in decision.reasons))
        self.assertTrue(any("expected_duration_ms exceeds budget" in reason for reason in decision.reasons))
        self.assertTrue(any("expected_files_changed exceeds budget" in reason for reason in decision.reasons))
        self.assertTrue(any("expected_total_changed_bytes exceeds budget" in reason for reason in decision.reasons))

    def test_evaluate_allows_when_budget_within_limits(self):
        user = {"role": "editor", "tenant_id": "tenant-1"}
        body = guardrails.AgentTaskRequest(
            task_description="Apply scoped frontend styling updates with tests",
            requested_paths=["frontend/src/styles.css"],
            requested_tools=["file_read", "file_write", "test_runner"],
            estimated_tokens=max(1, guardrails.MAX_AGENT_ESTIMATED_TOKENS - 1000),
            expected_duration_ms=max(1, guardrails.MAX_AGENT_EXPECTED_DURATION_MS - 1000),
            expected_files_changed=max(1, guardrails.MAX_AGENT_EXPECTED_FILES_CHANGED - 1),
            expected_total_changed_bytes=max(1, guardrails.MAX_AGENT_TOTAL_CHANGED_BYTES - 1024),
            requires_write=True,
        )

        decision = guardrails.evaluate_agent_task_policy(user, body)

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.reasons, [])

    def test_report_rejects_invalid_changed_path(self):
        db = FakeDB()
        user = {"role": "admin", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-1",
            status="failed",
            files_changed=["../outside.py"],
            execution_duration_ms=10,
            tokens_used=100,
            error_summary="invalid path",
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)

    def test_evaluate_rejects_when_running_task_limit_reached(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskRequest(
            task_description="Update frontend styles and run quick checks safely",
            requested_paths=["frontend/src/styles.css"],
            requested_tools=["file_read", "file_write", "test_runner"],
            requires_write=True,
        )

        with (
            patch.object(guardrails, "_count_recent_policy_evaluations", return_value=0),
            patch.object(
                guardrails,
                "_count_running_tasks",
                return_value=guardrails.MAX_AGENT_CONCURRENT_RUNNING_TASKS,
            ),
        ):
            decision = guardrails.evaluate_task(body=body, db=db, user=user)

        self.assertFalse(decision.allowed)
        self.assertTrue(any("Concurrent running task limit reached" in reason for reason in decision.reasons))

    def test_evaluate_rejects_when_policy_evaluation_rate_limit_reached(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskRequest(
            task_description="Update frontend styles and run quick checks safely",
            requested_paths=["frontend/src/styles.css"],
            requested_tools=["file_read", "file_write", "test_runner"],
            requires_write=True,
            expected_files_changed=1,
        )

        with (
            patch.object(
                guardrails,
                "_count_recent_policy_evaluations",
                return_value=guardrails.MAX_AGENT_EVALUATIONS_PER_MINUTE,
            ),
            patch.object(guardrails, "_count_running_tasks", return_value=0),
        ):
            decision = guardrails.evaluate_task(body=body, db=db, user=user)

        self.assertFalse(decision.allowed)
        self.assertTrue(any("Policy evaluation rate limit reached" in reason for reason in decision.reasons))

    def test_report_rejects_when_changed_bytes_budget_exceeded(self):
        db = FakeDB()
        user = {"role": "admin", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-bytes-1",
            status="completed",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=guardrails.MAX_AGENT_TOTAL_CHANGED_BYTES + 1,
            execution_duration_ms=10,
            tokens_used=10,
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("changed_bytes exceeds budget", error.exception.detail)

    def test_report_rejects_when_runtime_files_changed_budget_exceeded(self):
        db = FakeDB()
        user = {"role": "admin", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com"}
        files_changed = [f"frontend/src/file-{idx}.css" for idx in range(guardrails.MAX_AGENT_RUNTIME_FILES_CHANGED + 1)]
        body = guardrails.AgentTaskReportRequest(
            task_id="task-files-1",
            status="running",
            files_changed=files_changed,
            changed_bytes=512,
            execution_duration_ms=10,
            tokens_used=10,
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("files_changed exceeds runtime budget", error.exception.detail)

    def test_get_agent_task_config_exposes_limits_and_tools(self):
        user = {"role": "editor", "tenant_id": "tenant-1"}

        result = guardrails.get_agent_task_config(user=user)

        self.assertEqual(result["tenant_id"], "tenant-1")
        self.assertEqual(result["role"], "editor")
        self.assertIn("file_read", result["allowed_tools"])
        self.assertEqual(
            result["limits"]["max_runtime_files_changed"],
            guardrails.MAX_AGENT_RUNTIME_FILES_CHANGED,
        )

    def test_report_rejects_when_tokens_used_budget_exceeded(self):
        db = FakeDB()
        user = {"role": "admin", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-tokens-1",
            status="running",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=512,
            execution_duration_ms=10,
            tokens_used=guardrails.MAX_AGENT_RUNTIME_TOKENS_USED + 1,
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("tokens_used exceeds runtime budget", error.exception.detail)

    def test_report_rejects_when_runtime_duration_budget_exceeded(self):
        db = FakeDB()
        user = {"role": "admin", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-duration-1",
            status="running",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=512,
            execution_duration_ms=guardrails.MAX_AGENT_RUNTIME_DURATION_MS + 1,
            tokens_used=200,
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("execution_duration_ms exceeds runtime budget", error.exception.detail)

    def test_report_rejects_completed_write_task_without_branch_name(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-completed-1",
            status="completed",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=1024,
            execution_duration_ms=100,
            tokens_used=500,
            pr_url="https://example/pr/1",
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("must include branch_name", error.exception.detail)

    def test_report_rejects_completed_write_task_on_main_branch(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-completed-2",
            status="completed",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=1024,
            execution_duration_ms=100,
            tokens_used=500,
            branch_name="main",
            pr_url="https://example/pr/2",
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("Direct pushes", error.exception.detail)

    def test_report_rejects_completed_write_task_without_pr_url(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-completed-3",
            status="completed",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=1024,
            execution_duration_ms=100,
            tokens_used=500,
            branch_name="feature/agent-guardrails",
        )

        with self.assertRaises(HTTPException) as error:
            guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("must include pr_url", error.exception.detail)

    def test_report_rejects_running_when_concurrent_limit_reached(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-running-1",
            status="running",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=1024,
            execution_duration_ms=25,
            tokens_used=400,
        )

        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None),
            patch.object(
                guardrails,
                "_count_running_tasks",
                return_value=guardrails.MAX_AGENT_CONCURRENT_RUNNING_TASKS,
            ),
        ):
            with self.assertRaises(HTTPException) as error:
                guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("Concurrent running task limit reached", error.exception.detail)

    def test_report_rejects_when_policy_not_approved(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-running-policy-missing",
            status="running",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=1024,
            execution_duration_ms=25,
            tokens_used=400,
        )

        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None),
            patch.object(guardrails, "_count_running_tasks", return_value=0),
            patch.object(guardrails, "_get_task_policy_action", return_value=None),
        ):
            with self.assertRaises(HTTPException) as error:
                guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("no approved policy record", error.exception.detail)

    def test_report_rejects_when_policy_rejected(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-running-policy-rejected",
            status="running",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=1024,
            execution_duration_ms=25,
            tokens_used=400,
        )

        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None),
            patch.object(guardrails, "_count_running_tasks", return_value=0),
            patch.object(guardrails, "_get_task_policy_action", return_value="agent_task_policy_rejected"),
        ):
            with self.assertRaises(HTTPException) as error:
                guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("policy is rejected", error.exception.detail)

    def test_report_allows_running_update_for_already_running_task(self):
        db = FakeDB()
        user = {"role": "editor", "tenant_id": "tenant-1", "user_id": "user-1", "sub": "editor@example.com"}
        body = guardrails.AgentTaskReportRequest(
            task_id="task-running-2",
            status="running",
            files_changed=["backend/agent_guardrails.py"],
            changed_bytes=2048,
            execution_duration_ms=40,
            tokens_used=600,
        )

        with (
            patch.object(guardrails, "_get_latest_task_action", return_value="agent_task_running"),
            patch.object(
                guardrails,
                "_count_running_tasks",
                return_value=guardrails.MAX_AGENT_CONCURRENT_RUNNING_TASKS,
            ),
            patch.object(guardrails, "_get_task_policy_action", return_value="agent_task_policy_approved"),
        ):
            result = guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(result["task_id"], "task-running-2")
        self.assertEqual(result["status"], "running")
        self.assertEqual(result["files_changed_count"], 1)
        self.assertEqual(db.commits, 1)
        self.assertEqual(len(db.added), 1)

    def test_report_logs_audit_entry_for_completed_task(self):
        db = FakeDB()
        user = {
            "role": "editor",
            "tenant_id": "tenant-1",
            "user_id": "user-1",
            "sub": "editor@example.com",
        }
        body = guardrails.AgentTaskReportRequest(
            task_id="task-2",
            status="completed",
            files_changed=["backend/agent_guardrails.py", "backend/main.py"],
            execution_duration_ms=932,
            tokens_used=1450,
            branch_name="feature/agent-guardrails",
            pr_url="https://example/pr/123",
        )

        with (
            patch.object(guardrails, "_get_latest_task_action", return_value=None),
            patch.object(guardrails, "_get_task_policy_action", return_value="agent_task_policy_approved"),
        ):
            result = guardrails.report_task_execution(body=body, db=db, user=user)

        self.assertEqual(result["task_id"], "task-2")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["files_changed_count"], 2)
        self.assertEqual(result["execution_duration_ms"], 932)
        self.assertEqual(result["tokens_used"], 1450)
        self.assertEqual(db.commits, 1)
        self.assertEqual(len(db.added), 1)

    def test_get_agent_task_audit_clamps_limit_offset_and_shapes_response(self):
        now = guardrails.datetime.now(guardrails.timezone.utc)
        rows = [
            SimpleNamespace(
                id="a1",
                tenant_id="tenant-1",
                actor_user_id="u1",
                actor_email="admin@example.com",
                actor_role="admin",
                action="agent_task_completed",
                resource_type="codex_task",
                resource_id="task-1",
                details={"tokens_used": 100},
                created_at=now,
            ),
            SimpleNamespace(
                id="a2",
                tenant_id="tenant-1",
                actor_user_id="u2",
                actor_email="editor@example.com",
                actor_role="editor",
                action="agent_task_failed",
                resource_type="codex_task",
                resource_id="task-2",
                details={"error_summary": "failed"},
                created_at=now,
            ),
        ]
        db = FakeAuditDB(rows)
        user = {"role": "admin", "tenant_id": "tenant-1"}

        result = guardrails.get_agent_task_audit(limit=0, offset=-2, db=db, user=user)

        self.assertEqual(result["limit"], 1)
        self.assertEqual(result["offset"], 0)
        self.assertEqual(result["total_count"], 2)
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["audit_log_id"], "a1")
        self.assertEqual(result["items"][0]["task_id"], "task-1")
        self.assertEqual(result["items"][0]["status"], "completed")
        self.assertEqual(db.query_obj.limit_value, 1)
        self.assertEqual(db.query_obj.offset_value, 0)

        triplets = self._criterion_triplets(db.query_obj.filters)
        self.assertIn(("tenant_id", "eq", "tenant-1"), triplets)
        self.assertIn(("resource_type", "eq", "codex_task"), triplets)

    def test_get_agent_task_audit_applies_filters(self):
        now = guardrails.datetime.now(guardrails.timezone.utc)
        rows = [
            SimpleNamespace(
                id="a3",
                tenant_id="tenant-1",
                actor_user_id="u1",
                actor_email="admin@example.com",
                actor_role="admin",
                action="agent_task_completed",
                resource_type="codex_task",
                resource_id="task-3",
                details={"tokens_used": 200},
                created_at=now,
            )
        ]
        db = FakeAuditDB(rows)
        user = {"role": "admin", "tenant_id": "tenant-1"}
        from_dt = guardrails.datetime(2026, 2, 19, 0, 0, tzinfo=guardrails.timezone.utc)
        to_dt = guardrails.datetime(2026, 2, 20, 0, 0, tzinfo=guardrails.timezone.utc)

        with patch.object(guardrails, "_parse_iso_datetime", side_effect=[from_dt, to_dt]) as parse_mock:
            result = guardrails.get_agent_task_audit(
                action="agent_task_completed",
                status="completed",
                actor_email=" admin@example.com ",
                task_id=" task-3 ",
                created_from="2026-02-19T00:00:00Z",
                created_to="2026-02-20T00:00:00Z",
                db=db,
                user=user,
            )

        parse_mock.assert_any_call("2026-02-19T00:00:00Z", "created_from")
        parse_mock.assert_any_call("2026-02-20T00:00:00Z", "created_to")
        self.assertEqual(parse_mock.call_count, 2)

        triplets = self._criterion_triplets(db.query_obj.filters)
        self.assertIn(("action", "eq", "agent_task_completed"), triplets)
        self.assertIn(("actor_email", "eq", "admin@example.com"), triplets)
        self.assertIn(("resource_id", "eq", "task-3"), triplets)
        self.assertIn(("created_at", "ge", from_dt), triplets)
        self.assertIn(("created_at", "le", to_dt), triplets)
        self.assertEqual(result["total_count"], 1)
        self.assertEqual(len(result["items"]), 1)

    def test_get_agent_task_audit_rejects_invalid_status_filter(self):
        db = FakeAuditDB([])
        user = {"role": "admin", "tenant_id": "tenant-1"}

        with self.assertRaises(HTTPException) as error:
            guardrails.get_agent_task_audit(status="invalid_status", db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("Unsupported status filter", error.exception.detail)


if __name__ == "__main__":
    unittest.main()
