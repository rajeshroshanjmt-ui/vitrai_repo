import unittest
from uuid import uuid4

from fastapi import HTTPException
from jose import jwt

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

        self.db.last_query_tenant_id = tenant_id
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
        self.last_query_tenant_id = None
        self.last_query_email = None
        self.committed = False

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
        self.committed = True


class AuthTests(unittest.TestCase):
    def test_secret_policy_rejects_weak_secret_in_production(self):
        with self.assertRaises(RuntimeError):
            auth._ensure_secure_jwt_secret("change-me", "production")

    def test_secret_policy_allows_strong_secret_in_production(self):
        auth._ensure_secure_jwt_secret("strong-secret-with-32-bytes-value", "production")

    def test_decode_token_rejects_missing_required_claims(self):
        token = jwt.encode({"sub": "user@example.com"}, auth.SECRET, algorithm=auth.ALGORITHM)

        with self.assertRaises(HTTPException) as error:
            auth.decode_token(token)

        self.assertEqual(error.exception.status_code, 401)

    def test_issue_token_normalizes_email_and_claims(self):
        db = FakeDB()
        tenant_id = str(uuid4())
        payload = auth.TokenRequest(email="User@Example.COM", tenant_id=tenant_id, role="viewer")

        response = auth.issue_token(payload, db)
        claims = auth.decode_token(response.access_token)

        self.assertEqual(db.last_query_email, "user@example.com")
        self.assertEqual(claims["sub"], "user@example.com")
        self.assertEqual(claims["tenant_id"], tenant_id)
        self.assertEqual(claims["role"], "viewer")
        self.assertTrue(db.committed)

    def test_issue_token_updates_existing_user_case_insensitively(self):
        db = FakeDB()
        tenant_id = str(uuid4())
        existing_user = auth.User(
            id=str(uuid4()),
            tenant_id=tenant_id,
            email="Existing@Example.com",
            role="viewer",
        )
        db.users[(tenant_id, existing_user.email)] = existing_user

        payload = auth.TokenRequest(email="Existing@Example.COM", tenant_id=tenant_id, role="admin")
        response = auth.issue_token(payload, db)
        claims = auth.decode_token(response.access_token)

        self.assertEqual(existing_user.role, "admin")
        self.assertEqual(db.last_query_email, "existing@example.com")
        self.assertEqual(claims["sub"], "existing@example.com")
        self.assertEqual(claims["role"], "admin")


if __name__ == "__main__":
    unittest.main()
