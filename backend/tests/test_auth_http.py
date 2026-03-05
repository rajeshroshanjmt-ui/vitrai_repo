import unittest
import warnings
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth


class FakeQuery:
    def __init__(self, db):
        self.db = db
        self.criteria = ()

    def filter(self, *criteria):
        self.criteria = criteria
        return self

    def one_or_none(self):
        tenant_id = None
        email = None
        email_case_insensitive = False
        for criterion in self.criteria:
            left = getattr(criterion, "left", None)
            right = getattr(criterion, "right", None)
            key = getattr(left, "key", None)
            value = getattr(right, "value", None)
            if key == "tenant_id":
                tenant_id = value
            if key == "email":
                email = value
            if getattr(left, "name", None) == "lower":
                clauses = list(getattr(left, "clauses", []))
                clause_key = getattr(clauses[0], "key", None) if clauses else None
                if clause_key == "email":
                    email = value
                    email_case_insensitive = True

        self.db.last_query_email = email
        if email_case_insensitive and isinstance(email, str):
            for (stored_tenant_id, stored_email), user in self.db.users.items():
                if stored_tenant_id == tenant_id and isinstance(stored_email, str) and stored_email.lower() == email.lower():
                    return user
            return None
        return self.db.users.get((tenant_id, email))


class FakeDB:
    def __init__(self):
        self.tenants = {}
        self.users = {}
        self.last_query_email = None

    def get(self, model, key):
        if model is auth.Tenant:
            return self.tenants.get(key)
        return None

    def add(self, obj):
        if isinstance(obj, auth.Tenant):
            self.tenants[obj.id] = obj
        if isinstance(obj, auth.User):
            self.users[(obj.tenant_id, obj.email)] = obj

    def query(self, _model):
        return FakeQuery(self)

    def commit(self):
        return None


class AuthHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Keep local unittest output clean on Python 3.14+.
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        self.db = FakeDB()
        app = FastAPI()
        app.include_router(auth.router, prefix="/auth")

        def override_get_db():
            yield self.db

        app.dependency_overrides[auth.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_token_then_me_round_trip(self):
        tenant_id = str(uuid4())
        token_response = self.client.post(
            "/auth/token",
            json={"email": "USER@Example.com", "tenant_id": tenant_id, "role": "editor"},
        )
        self.assertEqual(token_response.status_code, 200)
        token_payload = token_response.json()
        self.assertEqual(token_payload["token_type"], "bearer")
        self.assertEqual(self.db.last_query_email, "user@example.com")

        access_token = token_payload["access_token"]
        me_response = self.client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        self.assertEqual(me_response.status_code, 200)
        me_payload = me_response.json()
        self.assertEqual(me_payload["email"], "user@example.com")
        self.assertEqual(me_payload["tenant_id"], tenant_id)
        self.assertEqual(me_payload["role"], "editor")
        self.assertTrue(me_payload["user_id"])

    def test_me_missing_token_returns_401(self):
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Missing auth token")

    def test_token_rejects_unsupported_role(self):
        response = self.client.post(
            "/auth/token",
            json={"email": "user@example.com", "tenant_id": str(uuid4()), "role": "owner"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Unsupported role")


if __name__ == "__main__":
    unittest.main()
