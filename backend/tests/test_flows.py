import json
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

try:
    import redis  # noqa: F401
except ModuleNotFoundError:
    class _ResponseError(Exception):
        pass

    class _RedisClientStub:
        def __init__(self, *args, **kwargs):
            pass

    class _RedisModuleStub:
        class exceptions:
            ResponseError = _ResponseError

        Redis = _RedisClientStub

    sys.modules["redis"] = _RedisModuleStub()

import flows


class FakeRedis:
    def __init__(self):
        self.queues = {}

    def lrange(self, queue_name, start, end):
        queue = self.queues.get(queue_name, [])
        if not queue:
            return []
        if end < 0:
            end = len(queue) - 1
        return queue[start : end + 1]

    def lindex(self, queue_name, index):
        queue = self.queues.get(queue_name, [])
        if index < 0 or index >= len(queue):
            return None
        return queue[index]

    def rpush(self, queue_name, value):
        self.queues.setdefault(queue_name, []).append(value)
        return len(self.queues[queue_name])

    def llen(self, queue_name):
        return len(self.queues.get(queue_name, []))

    def lset(self, queue_name, index, value):
        queue = self.queues.get(queue_name, [])
        if index < 0 or index >= len(queue):
            raise flows.redis.exceptions.ResponseError("index out of range")
        queue[index] = value
        return True

    def lrem(self, queue_name, count, value):
        queue = self.queues.get(queue_name, [])
        removed = 0
        if count < 0:
            return 0
        i = 0
        while i < len(queue) and (count == 0 or removed < count):
            if queue[i] == value:
                queue.pop(i)
                removed += 1
            else:
                i += 1
        return removed


class FakeDB:
    def __init__(self):
        self.added = []
        self.commits = 0

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1


class FakeQuery:
    def __init__(self, result):
        self.result = result

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self.result


class FakeExecuteDB:
    def __init__(self, published=None, latest_ingestion=None):
        self.published = published
        self.latest_ingestion = latest_ingestion
        self.added = []
        self.commits = 0

    def query(self, model):
        if model is flows.FlowVersion:
            return FakeQuery(self.published)
        if model is flows.IngestionJob:
            return FakeQuery(self.latest_ingestion)
        raise AssertionError(f"Unexpected model query: {model}")

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
        if model is not flows.AuditLog:
            raise AssertionError(f"Unexpected model query: {model}")
        return self.query_obj


class FakeTenantFlowQuery:
    def __init__(self, result):
        self.result = result
        self.filters = []

    def filter(self, *criteria):
        self.filters.append(criteria)
        return self

    def one_or_none(self):
        return self.result


class FakeTenantFlowDB:
    def __init__(self, result):
        self.query_obj = FakeTenantFlowQuery(result)

    def query(self, model):
        if model is not flows.Flow:
            raise AssertionError(f"Unexpected model query: {model}")
        return self.query_obj


class FlowsTests(unittest.TestCase):
    def setUp(self):
        self.fake_redis = FakeRedis()
        self.redis_patch = patch.object(flows, "redis_client", self.fake_redis)
        self.redis_patch.start()

    def tearDown(self):
        self.redis_patch.stop()

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

    def test_resolve_dlq_rejects_unknown_type(self):
        with self.assertRaises(HTTPException) as error:
            flows._resolve_dlq("unknown")
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "Unsupported dlq type")

    def test_parse_iso_datetime_accepts_z_suffix(self):
        parsed = flows._parse_iso_datetime("2026-02-19T00:00:00Z", "created_from")
        self.assertIsNotNone(parsed.tzinfo)
        self.assertEqual(parsed.isoformat(), "2026-02-19T00:00:00+00:00")

    def test_parse_iso_datetime_rejects_invalid_value(self):
        with self.assertRaises(HTTPException) as error:
            flows._parse_iso_datetime("not-a-date", "created_to")
        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("created_to must be ISO-8601 datetime", error.exception.detail)

    def test_require_tenant_flow_scopes_query_by_flow_and_tenant(self):
        expected_flow = SimpleNamespace(id="flow-tenant-1", tenant_id="tenant-1")
        db = FakeTenantFlowDB(result=expected_flow)

        result = flows._require_tenant_flow(db, "tenant-1", "flow-tenant-1")

        self.assertIs(result, expected_flow)
        triplets = self._criterion_triplets(db.query_obj.filters)
        self.assertIn(("id", "eq", "flow-tenant-1"), triplets)
        self.assertIn(("tenant_id", "eq", "tenant-1"), triplets)

    def test_require_tenant_flow_returns_404_for_cross_tenant_lookup(self):
        db = FakeTenantFlowDB(result=None)

        with self.assertRaises(HTTPException) as error:
            flows._require_tenant_flow(db, "tenant-2", "flow-tenant-1")

        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(error.exception.detail, "Flow not found")

    def test_remove_redis_entry_by_index_removes_item(self):
        self.fake_redis.queues[flows.EXECUTION_DLQ] = ["a", "b", "c"]
        flows._remove_redis_entry_by_index(flows.EXECUTION_DLQ, 1)
        self.assertEqual(self.fake_redis.queues[flows.EXECUTION_DLQ], ["a", "c"])

    def test_remove_redis_entry_by_index_invalid_index_returns_409(self):
        self.fake_redis.queues[flows.EXECUTION_DLQ] = ["only-item"]
        with self.assertRaises(HTTPException) as error:
            flows._remove_redis_entry_by_index(flows.EXECUTION_DLQ, 3)
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(error.exception.detail, "DLQ entry index no longer valid")

    def test_replay_dlq_job_requeues_payload_and_clears_dlq_entry(self):
        payload = {
            "job_type": "execute_flow",
            "source_queue": flows.EXECUTION_QUEUE,
            "retry_count": 2,
            "failed_at": "2026-02-19T00:00:00+00:00",
            "last_error": "boom",
            "last_retry_at": "2026-02-19T00:01:00+00:00",
            "execution_log_id": "log-1",
        }
        self.fake_redis.queues[flows.EXECUTION_DLQ] = [json.dumps(payload)]
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com", "role": "admin"}

        result = flows.replay_dlq_job(
            dlq_type="execution",
            body=flows.DLQReplayRequest(redis_index=0, keep_in_dlq=False),
            db=db,
            user=user,
        )

        self.assertEqual(result["status"], "replayed")
        self.assertTrue(result["removed_from_dlq"])
        self.assertEqual(self.fake_redis.queues[flows.EXECUTION_DLQ], [])
        replayed_raw = self.fake_redis.queues[flows.EXECUTION_QUEUE][0]
        replayed = json.loads(replayed_raw)
        self.assertEqual(replayed["retry_count"], 0)
        self.assertNotIn("failed_at", replayed)
        self.assertNotIn("source_queue", replayed)
        self.assertNotIn("last_error", replayed)
        self.assertNotIn("last_retry_at", replayed)
        self.assertIn("replayed_at", replayed)
        self.assertEqual(db.commits, 1)

    def test_replay_dlq_job_rejects_invalid_target_queue(self):
        self.fake_redis.queues[flows.EXECUTION_DLQ] = [json.dumps({"job_type": "execute_flow"})]
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com", "role": "admin"}

        with self.assertRaises(HTTPException) as error:
            flows.replay_dlq_job(
                dlq_type="execution",
                body=flows.DLQReplayRequest(redis_index=0, target_queue="bad_queue"),
                db=db,
                user=user,
            )

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "Invalid target queue for replay")

    def test_replay_dlq_job_keep_in_dlq_true_keeps_source_entry(self):
        payload = {
            "job_type": "ingest_docs",
            "source_queue": flows.INGEST_QUEUE,
            "retry_count": 1,
            "failed_at": "2026-02-19T00:00:00+00:00",
            "flow_id": "flow-8",
        }
        original_raw = json.dumps(payload)
        self.fake_redis.queues[flows.INGESTION_DLQ] = [original_raw]
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com", "role": "admin"}

        result = flows.replay_dlq_job(
            dlq_type="ingestion",
            body=flows.DLQReplayRequest(redis_index=0, keep_in_dlq=True),
            db=db,
            user=user,
        )

        self.assertEqual(result["status"], "replayed")
        self.assertFalse(result["removed_from_dlq"])
        self.assertEqual(self.fake_redis.queues[flows.INGESTION_DLQ], [original_raw])
        self.assertEqual(len(self.fake_redis.queues[flows.INGEST_QUEUE]), 1)
        replayed = json.loads(self.fake_redis.queues[flows.INGEST_QUEUE][0])
        self.assertEqual(replayed["job_type"], "ingest_docs")
        self.assertEqual(replayed["retry_count"], 0)
        self.assertIn("replayed_at", replayed)

    def test_replay_dlq_job_rejects_invalid_json_payload(self):
        self.fake_redis.queues[flows.INGESTION_DLQ] = ["{invalid-json"]
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com", "role": "admin"}

        with self.assertRaises(HTTPException) as error:
            flows.replay_dlq_job(
                dlq_type="ingestion",
                body=flows.DLQReplayRequest(redis_index=0),
                db=db,
                user=user,
            )

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "DLQ entry has invalid JSON payload")

    def test_replay_dlq_job_returns_404_when_entry_missing(self):
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com", "role": "admin"}

        with self.assertRaises(HTTPException) as error:
            flows.replay_dlq_job(
                dlq_type="execution",
                body=flows.DLQReplayRequest(redis_index=0),
                db=db,
                user=user,
            )

        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(error.exception.detail, "DLQ entry not found")

    def test_execute_flow_rejects_when_plan_limit_exceeded(self):
        flow_id = "flow-1"
        published = SimpleNamespace(id="fv-1")
        db = FakeExecuteDB(published=published)
        body = flows.ExecuteRequest(input={"question": "q"}, enable_tools=True, wait_for_ingestion=True)
        user = {"tenant_id": "tenant-1", "role": "viewer"}

        with (
            patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)),
            patch.object(flows, "_monthly_tokens", return_value=flows.PLAN_LIMIT),
        ):
            with self.assertRaises(HTTPException) as error:
                flows.execute_flow(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 402)
        self.assertEqual(error.exception.detail, "Plan limit exceeded")
        self.assertEqual(self.fake_redis.queues.get(flows.EXECUTION_QUEUE, []), [])

    def test_execute_flow_blocks_while_ingestion_in_progress(self):
        flow_id = "flow-2"
        published = SimpleNamespace(id="fv-2")
        latest_ingestion = SimpleNamespace(id="ing-1", status="processing")
        db = FakeExecuteDB(published=published, latest_ingestion=latest_ingestion)
        body = flows.ExecuteRequest(input={"question": "q"}, enable_tools=True, wait_for_ingestion=True)
        user = {"tenant_id": "tenant-1", "role": "viewer"}

        with (
            patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)),
            patch.object(flows, "_monthly_tokens", return_value=0),
        ):
            with self.assertRaises(HTTPException) as error:
                flows.execute_flow(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(error.exception.detail["ingestion_job_id"], "ing-1")
        self.assertEqual(error.exception.detail["status"], "processing")
        self.assertEqual(self.fake_redis.queues.get(flows.EXECUTION_QUEUE, []), [])
        self.assertEqual(db.added, [])

    def test_execute_flow_queues_job_when_checks_pass(self):
        flow_id = "flow-3"
        published = SimpleNamespace(id="fv-3")
        db = FakeExecuteDB(published=published, latest_ingestion=None)
        body = flows.ExecuteRequest(input={"question": "q"}, enable_tools=False, wait_for_ingestion=True)
        user = {"tenant_id": "tenant-1", "role": "viewer"}

        with (
            patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)),
            patch.object(flows, "_monthly_tokens", return_value=10),
        ):
            result = flows.execute_flow(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(result["status"], "queued")
        self.assertEqual(len(db.added), 1)
        self.assertEqual(db.commits, 1)
        self.assertEqual(len(self.fake_redis.queues.get(flows.EXECUTION_QUEUE, [])), 1)
        queued = json.loads(self.fake_redis.queues[flows.EXECUTION_QUEUE][0])
        self.assertEqual(queued["job_type"], "execute_flow")
        self.assertEqual(queued["flow_version_id"], "fv-3")
        self.assertEqual(queued["tenant_id"], "tenant-1")
        self.assertEqual(queued["enable_tools"], False)
        self.assertIsNone(queued["llm_provider"])
        self.assertIsNone(queued["llm_model"])

    def test_execute_flow_queues_job_with_requested_llm_selection(self):
        flow_id = "flow-llm"
        published = SimpleNamespace(id="fv-llm")
        db = FakeExecuteDB(published=published, latest_ingestion=None)
        body = flows.ExecuteRequest(
            input={"question": "q"},
            enable_tools=True,
            wait_for_ingestion=True,
            llm_provider="openai",
            llm_model="gpt-4o-mini",
        )
        user = {"tenant_id": "tenant-1", "role": "viewer"}

        with (
            patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)),
            patch.object(flows, "_monthly_tokens", return_value=5),
        ):
            result = flows.execute_flow(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(result["status"], "queued")
        self.assertEqual(len(self.fake_redis.queues.get(flows.EXECUTION_QUEUE, [])), 1)
        queued = json.loads(self.fake_redis.queues[flows.EXECUTION_QUEUE][0])
        self.assertEqual(queued["llm_provider"], "openai")
        self.assertEqual(queued["llm_model"], "gpt-4o-mini")

    def test_execute_flow_rejects_when_no_published_version(self):
        flow_id = "flow-4"
        db = FakeExecuteDB(published=None, latest_ingestion=None)
        body = flows.ExecuteRequest(input={"question": "q"}, enable_tools=True, wait_for_ingestion=True)
        user = {"tenant_id": "tenant-1", "role": "viewer"}

        with patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)):
            with self.assertRaises(HTTPException) as error:
                flows.execute_flow(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "No published version")
        self.assertEqual(self.fake_redis.queues.get(flows.EXECUTION_QUEUE, []), [])
        self.assertEqual(db.added, [])

    def test_execute_flow_bypasses_ingestion_gate_when_wait_disabled(self):
        flow_id = "flow-5"
        published = SimpleNamespace(id="fv-5")
        latest_ingestion = SimpleNamespace(id="ing-2", status="processing")
        db = FakeExecuteDB(published=published, latest_ingestion=latest_ingestion)
        body = flows.ExecuteRequest(input={"question": "q"}, enable_tools=True, wait_for_ingestion=False)
        user = {"tenant_id": "tenant-1", "role": "viewer"}

        with (
            patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)),
            patch.object(flows, "_monthly_tokens", return_value=1),
        ):
            result = flows.execute_flow(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(result["status"], "queued")
        self.assertEqual(len(db.added), 1)
        self.assertEqual(db.commits, 1)
        self.assertEqual(len(self.fake_redis.queues.get(flows.EXECUTION_QUEUE, [])), 1)
        queued = json.loads(self.fake_redis.queues[flows.EXECUTION_QUEUE][0])
        self.assertEqual(queued["flow_version_id"], "fv-5")
        self.assertEqual(queued["tenant_id"], "tenant-1")

    def test_ingest_documents_rejects_empty_documents(self):
        flow_id = "flow-6"
        db = FakeDB()
        body = flows.IngestRequest(documents=[])
        user = {"tenant_id": "tenant-1", "role": "editor"}

        with patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)):
            with self.assertRaises(HTTPException) as error:
                flows.ingest_documents(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "No documents provided")
        self.assertEqual(self.fake_redis.queues.get(flows.INGEST_QUEUE, []), [])
        self.assertEqual(db.commits, 0)

    def test_ingest_documents_queues_job_when_valid(self):
        flow_id = "flow-7"
        db = FakeDB()
        body = flows.IngestRequest(
            documents=[
                flows.DocumentChunk(
                    text="Refund policy text",
                    source="kb",
                    metadata={"doc_id": "d1"},
                )
            ]
        )
        user = {"tenant_id": "tenant-1", "role": "editor"}

        with patch.object(flows, "_require_tenant_flow", return_value=SimpleNamespace(id=flow_id)):
            result = flows.ingest_documents(flow_id=flow_id, body=body, db=db, user=user)

        self.assertEqual(result["status"], "queued")
        self.assertEqual(result["documents"], 1)
        self.assertTrue(result["ingestion_job_id"])
        self.assertEqual(db.commits, 1)
        self.assertEqual(len(self.fake_redis.queues.get(flows.INGEST_QUEUE, [])), 1)
        queued = json.loads(self.fake_redis.queues[flows.INGEST_QUEUE][0])
        self.assertEqual(queued["job_type"], "ingest_docs")
        self.assertEqual(queued["tenant_id"], "tenant-1")
        self.assertEqual(queued["flow_id"], flow_id)
        self.assertEqual(queued["ingestion_job_id"], result["ingestion_job_id"])
        self.assertEqual(len(queued["documents"]), 1)
        self.assertEqual(queued["documents"][0]["text"], "Refund policy text")

    def test_get_dlq_job_returns_parse_error_for_invalid_json(self):
        self.fake_redis.queues[flows.EXECUTION_DLQ] = ["{invalid-json"]
        user = {"tenant_id": "tenant-1", "role": "admin"}

        result = flows.get_dlq_job(dlq_type="execution", redis_index=0, user=user)

        self.assertEqual(result["dlq_type"], "execution")
        self.assertEqual(result["redis_index"], 0)
        self.assertTrue(result["parse_error"])
        self.assertIsNone(result["job"])
        self.assertEqual(result["raw"], "{invalid-json")

    def test_get_dlq_job_returns_404_when_missing(self):
        user = {"tenant_id": "tenant-1", "role": "admin"}
        with self.assertRaises(HTTPException) as error:
            flows.get_dlq_job(dlq_type="execution", redis_index=0, user=user)
        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(error.exception.detail, "DLQ entry not found")

    def test_delete_dlq_job_returns_404_when_missing(self):
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com", "role": "admin"}
        with self.assertRaises(HTTPException) as error:
            flows.delete_dlq_job(dlq_type="execution", redis_index=0, db=db, user=user)
        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(error.exception.detail, "DLQ entry not found")

    def test_delete_dlq_job_deletes_entry_when_present(self):
        self.fake_redis.queues[flows.EXECUTION_DLQ] = [json.dumps({"job_type": "execute_flow", "id": "x"})]
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "user_id": "user-1", "sub": "admin@example.com", "role": "admin"}

        result = flows.delete_dlq_job(dlq_type="execution", redis_index=0, db=db, user=user)

        self.assertEqual(result["status"], "deleted")
        self.assertEqual(result["dlq_type"], "execution")
        self.assertEqual(result["redis_index"], 0)
        self.assertEqual(self.fake_redis.queues[flows.EXECUTION_DLQ], [])
        self.assertEqual(db.commits, 1)

    def test_list_dlq_jobs_shapes_parsed_and_unparsed_entries(self):
        self.fake_redis.queues[flows.EXECUTION_DLQ] = [
            json.dumps({"job_type": "execute_flow", "id": "ok-1"}),
            "{invalid-json",
        ]
        user = {"tenant_id": "tenant-1", "role": "admin"}

        result = flows.list_dlq_jobs(dlq_type="execution", limit=50, user=user)

        self.assertEqual(result["dlq_type"], "execution")
        self.assertEqual(result["queue"], flows.EXECUTION_DLQ)
        self.assertEqual(result["count"], 2)
        self.assertEqual(len(result["jobs"]), 2)
        self.assertEqual(result["jobs"][0]["redis_index"], 0)
        self.assertFalse(result["jobs"][0]["parse_error"])
        self.assertIsNone(result["jobs"][0]["raw"])
        self.assertEqual(result["jobs"][0]["job"]["id"], "ok-1")
        self.assertEqual(result["jobs"][1]["redis_index"], 1)
        self.assertTrue(result["jobs"][1]["parse_error"])
        self.assertEqual(result["jobs"][1]["raw"], "{invalid-json")
        self.assertIsNone(result["jobs"][1]["job"])

    def test_list_dlq_jobs_caps_limit_at_200(self):
        self.fake_redis.queues[flows.INGESTION_DLQ] = [
            json.dumps({"job_type": "ingest_docs", "id": f"id-{i}"}) for i in range(205)
        ]
        user = {"tenant_id": "tenant-1", "role": "admin"}

        result = flows.list_dlq_jobs(dlq_type="ingestion", limit=999, user=user)

        self.assertEqual(result["count"], 200)
        self.assertEqual(len(result["jobs"]), 200)
        self.assertEqual(result["jobs"][0]["redis_index"], 0)
        self.assertEqual(result["jobs"][199]["redis_index"], 199)
        self.assertEqual(result["jobs"][199]["job"]["id"], "id-199")

    def test_get_audit_logs_clamps_limit_offset_and_shapes_response(self):
        now = flows.datetime.now(flows.timezone.utc)
        rows = [
            SimpleNamespace(
                id="a1",
                tenant_id="tenant-1",
                actor_user_id="u1",
                actor_email="admin@example.com",
                actor_role="admin",
                action="dlq_replay",
                resource_type="redis_dlq_entry",
                resource_id="execution_dlq:0",
                details={"k": 1},
                created_at=now,
            ),
            SimpleNamespace(
                id="a2",
                tenant_id="tenant-1",
                actor_user_id="u2",
                actor_email="editor@example.com",
                actor_role="editor",
                action="dlq_delete",
                resource_type="redis_dlq_entry",
                resource_id="execution_dlq:1",
                details={"k": 2},
                created_at=now,
            ),
        ]
        db = FakeAuditDB(rows)
        user = {"tenant_id": "tenant-1", "role": "admin"}

        result = flows.get_audit_logs(limit=0, offset=-50, db=db, user=user)

        self.assertEqual(result["limit"], 1)
        self.assertEqual(result["offset"], 0)
        self.assertEqual(result["total_count"], 2)
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["audit_log_id"], "a1")
        self.assertTrue(result["items"][0]["created_at"].endswith("+00:00"))
        self.assertEqual(db.query_obj.limit_value, 1)
        self.assertEqual(db.query_obj.offset_value, 0)

    def test_get_audit_logs_applies_action_email_and_datetime_filters(self):
        now = flows.datetime.now(flows.timezone.utc)
        rows = [
            SimpleNamespace(
                id="a3",
                tenant_id="tenant-1",
                actor_user_id="u3",
                actor_email="admin@example.com",
                actor_role="admin",
                action="dlq_replay",
                resource_type="redis_dlq_entry",
                resource_id="execution_dlq:2",
                details={"k": 3},
                created_at=now,
            )
        ]
        db = FakeAuditDB(rows)
        user = {"tenant_id": "tenant-1", "role": "admin"}
        from_dt = flows.datetime(2026, 2, 19, 0, 0, tzinfo=flows.timezone.utc)
        to_dt = flows.datetime(2026, 2, 20, 0, 0, tzinfo=flows.timezone.utc)

        with patch.object(flows, "_parse_iso_datetime", side_effect=[from_dt, to_dt]) as parse_mock:
            result = flows.get_audit_logs(
                limit=10,
                offset=0,
                action="dlq_replay",
                actor_email=" admin@example.com ",
                created_from="2026-02-19T00:00:00Z",
                created_to="2026-02-20T00:00:00Z",
                db=db,
                user=user,
            )

        parse_mock.assert_any_call("2026-02-19T00:00:00Z", "created_from")
        parse_mock.assert_any_call("2026-02-20T00:00:00Z", "created_to")
        self.assertEqual(parse_mock.call_count, 2)

        triplets = self._criterion_triplets(db.query_obj.filters)
        self.assertIn(("tenant_id", "eq", "tenant-1"), triplets)
        self.assertIn(("action", "eq", "dlq_replay"), triplets)
        self.assertIn(("actor_email", "eq", "admin@example.com"), triplets)
        self.assertIn(("created_at", "ge", from_dt), triplets)
        self.assertIn(("created_at", "le", to_dt), triplets)
        self.assertEqual(result["total_count"], 1)
        self.assertEqual(len(result["items"]), 1)

    def test_get_usage_returns_snapshot_payload(self):
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "role": "viewer"}
        usage_stub = {
            "total_flows": 3,
            "published_flows": 2,
            "executions_today": 5,
            "monthly_tokens_used": max(1, flows.PLAN_LIMIT // 2),
            "daily_usage": [{"date": "2026-02-19", "tokens_used": 400, "executions": 2}],
            "daily_tokens": [{"date": "2026-02-19", "tokens_used": 400}],
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
            patch.object(flows, "_collect_queue_depth", return_value=queue_stub) as queue_mock,
        ):
            result = flows.get_usage(db=db, user=user)

        usage_mock.assert_called_once_with(db, "tenant-1", trend_days=max(1, flows.USAGE_DAILY_DAYS))
        queue_mock.assert_called_once()
        self.assertEqual(result["tenant_id"], "tenant-1")
        self.assertEqual(result["total_flows"], 3)
        self.assertEqual(result["published_flows"], 2)
        self.assertEqual(result["executions_today"], 5)
        self.assertEqual(result["monthly_tokens_used"], usage_stub["monthly_tokens_used"])
        self.assertEqual(result["monthly_quota"], flows.PLAN_LIMIT)
        self.assertEqual(result["monthly_usage_percent"], 50)
        self.assertEqual(result["window_days"], max(1, flows.USAGE_DAILY_DAYS))
        self.assertEqual(result["daily_usage"], usage_stub["daily_usage"])
        self.assertEqual(result["daily_tokens"], usage_stub["daily_tokens"])
        self.assertEqual(result["queue_depth"], queue_stub)
        self.assertIsNotNone(result["generated_at"])

    def test_get_usage_accepts_supported_days_override(self):
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "role": "viewer"}
        usage_stub = {
            "total_flows": 1,
            "published_flows": 1,
            "executions_today": 1,
            "monthly_tokens_used": 1000,
            "daily_usage": [{"date": "2026-02-19", "tokens_used": 100, "executions": 1}],
            "daily_tokens": [{"date": "2026-02-19", "tokens_used": 100}],
        }
        queue_stub = {
            "execution_queue": 0,
            "ingestion_queue": 0,
            "execution_dlq": 0,
            "ingestion_dlq": 0,
            "total": 0,
        }

        with (
            patch.object(flows, "_collect_usage_metrics", return_value=usage_stub) as usage_mock,
            patch.object(flows, "_collect_queue_depth", return_value=queue_stub),
        ):
            result = flows.get_usage(days=30, db=db, user=user)

        usage_mock.assert_called_once_with(db, "tenant-1", trend_days=30)
        self.assertEqual(result["window_days"], 30)
        self.assertEqual(result["daily_usage"], usage_stub["daily_usage"])

    def test_get_usage_rejects_unsupported_days_override(self):
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "role": "viewer"}

        with self.assertRaises(HTTPException) as error:
            flows.get_usage(days=14, db=db, user=user)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "days must be one of: 7, 30")

    def test_get_usage_handles_zero_plan_limit(self):
        db = FakeDB()
        user = {"tenant_id": "tenant-1", "role": "viewer"}
        usage_stub = {
            "total_flows": 0,
            "published_flows": 0,
            "executions_today": 0,
            "monthly_tokens_used": 100,
            "daily_usage": [],
            "daily_tokens": [],
        }

        with (
            patch.object(flows, "_collect_usage_metrics", return_value=usage_stub),
            patch.object(
                flows,
                "_collect_queue_depth",
                return_value={
                    "execution_queue": 0,
                    "ingestion_queue": 0,
                    "execution_dlq": 0,
                    "ingestion_dlq": 0,
                    "total": 0,
                },
            ),
            patch.object(flows, "PLAN_LIMIT", 0),
        ):
            result = flows.get_usage(db=db, user=user)

        self.assertEqual(result["monthly_quota"], 0)
        self.assertEqual(result["monthly_usage_percent"], 0)

    def test_normalize_tool_states_returns_defaults_for_invalid_input(self):
        normalized = flows._normalize_tool_states(None)

        self.assertEqual(normalized, flows.DEFAULT_TOOL_STATES)

    def test_normalize_tool_states_ignores_unknown_keys(self):
        normalized = flows._normalize_tool_states(
            {
                "calculator": False,
                "sql_tool": False,
                "unknown": True,
            }
        )

        self.assertFalse(normalized["calculator"])
        self.assertFalse(normalized["sql_tool"])
        self.assertTrue(normalized["retriever"])
        self.assertFalse(normalized["http_fetch"])
        self.assertNotIn("unknown", normalized)


if __name__ == "__main__":
    unittest.main()
