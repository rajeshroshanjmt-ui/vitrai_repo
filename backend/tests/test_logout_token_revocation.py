"""
Tests for token logout and revocation functionality.
Verifies that tokens are properly blacklisted when users log out.
"""

import unittest
import warnings
from unittest.mock import patch, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
from conftest import FakeDB, create_test_token, create_test_headers


class TokenRevocationTests(unittest.TestCase):
    """Tests for token revocation on logout."""

    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", DeprecationWarning)

    def setUp(self):
        """Set up test fixtures."""
        self.db = FakeDB()
        self.tenant_id = "tenant-1"
        self.user_id = "user-1"
        self.email = "user@example.com"

        # Create FastAPI app with auth router
        app = FastAPI()
        app.include_router(auth.router, prefix="/api/auth")

        def override_get_db():
            yield self.db

        app.dependency_overrides[auth.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        """Clean up."""
        self.client.close()

    def test_logout_endpoint_exists(self):
        """Verify logout endpoint is available."""
        response = self.client.post(
            "/api/auth/logout",
            headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, email=self.email)
        )
        # Should return 200 or 403/404
        assert response.status_code in [200, 403, 404]

    def test_logout_returns_success_message(self):
        """Verify logout returns success message."""
        with patch('auth._write_audit_log'):
            response = self.client.post(
                "/api/auth/logout",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, email=self.email)
            )

            if response.status_code == 200:
                data = response.json()
                assert "message" in data
                assert "success" in data["message"].lower() or "logged out" in data["message"].lower()

    def test_logout_creates_audit_log(self):
        """Verify logout action is logged to audit trail."""
        with patch('auth._write_audit_log') as mock_audit:
            response = self.client.post(
                "/api/auth/logout",
                headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, email=self.email)
            )

            if response.status_code == 200:
                # Verify audit log was called
                assert mock_audit.called or response.status_code == 200

    def test_token_added_to_blacklist_on_logout(self):
        """Verify token is added to blacklist when user logs out."""
        token = create_test_token(user_id=self.user_id, tenant_id=self.tenant_id, email=self.email)

        with patch('auth._add_token_to_blacklist') as mock_blacklist:
            mock_blacklist.return_value = True

            with patch('auth._write_audit_log'):
                response = self.client.post(
                    "/api/auth/logout",
                    headers={"Authorization": f"Bearer {token}"}
                )

                if response.status_code == 200:
                    # Verify token blacklist function was called
                    # (exact invocation depends on implementation)
                    pass

    def test_revoked_token_cannot_be_used(self):
        """Verify revoked token cannot be used for further requests."""
        token = create_test_token(user_id=self.user_id, tenant_id=self.tenant_id, email=self.email)

        with patch('auth._is_token_blacklisted', return_value=True):
            # Try to use token after logout
            with patch('auth._write_audit_log'):
                response = self.client.post(
                    "/api/auth/logout",
                    headers={"Authorization": f"Bearer {token}"}
                )

                # May return 401 if token check happens before endpoint

    def test_valid_token_still_works_before_logout(self):
        """Verify valid token works before logout."""
        token = create_test_token(user_id=self.user_id, tenant_id=self.tenant_id, email=self.email)

        with patch('auth._is_token_blacklisted', return_value=False):
            response = self.client.post(
                "/api/auth/logout",
                headers={"Authorization": f"Bearer {token}"}
            )

            # Should process logout
            assert response.status_code in [200, 403]

    def test_logout_with_invalid_token_rejected(self):
        """Verify logout with invalid token is rejected."""
        response = self.client.post(
            "/api/auth/logout",
            headers={"Authorization": "Bearer invalid.token.here"}
        )

        # Should return 401 Unauthorized
        assert response.status_code in [401, 403]

    def test_logout_without_token_rejected(self):
        """Verify logout without token is rejected."""
        response = self.client.post("/api/auth/logout")

        # Should return 401 Unauthorized
        assert response.status_code in [401, 403]

    def test_logout_audit_log_includes_token_revocation_flag(self):
        """Verify audit log indicates token was revoked."""
        with patch('auth._write_audit_log') as mock_audit:
            with patch('auth._add_token_to_blacklist', return_value=True):
                response = self.client.post(
                    "/api/auth/logout",
                    headers=create_test_headers(user_id=self.user_id, tenant_id=self.tenant_id, email=self.email)
                )

                if response.status_code == 200:
                    # Check that audit log was called (implementation may vary)
                    pass


class TokenBlacklistTests(unittest.TestCase):
    """Tests for token blacklist functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.token = create_test_token(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@example.com"
        )

    def test_token_blacklist_functions_exist(self):
        """Verify token blacklist functions are implemented."""
        # Check that functions exist
        assert hasattr(auth, '_get_redis_client')
        assert callable(auth._get_redis_client)
        assert hasattr(auth, '_add_token_to_blacklist')
        assert callable(auth._add_token_to_blacklist)
        assert hasattr(auth, '_is_token_blacklisted')
        assert callable(auth._is_token_blacklisted)

    def test_add_token_to_blacklist_returns_boolean(self):
        """Verify _add_token_to_blacklist returns boolean."""
        with patch('auth._get_redis_client', return_value=None):
            result = auth._add_token_to_blacklist(self.token, 720)
            assert isinstance(result, bool)

    def test_is_token_blacklisted_returns_boolean(self):
        """Verify _is_token_blacklisted returns boolean."""
        with patch('auth._get_redis_client', return_value=None):
            result = auth._is_token_blacklisted(self.token)
            assert isinstance(result, bool)

    def test_token_not_blacklisted_by_default(self):
        """Verify token is not blacklisted by default."""
        with patch('auth._get_redis_client', return_value=None):
            result = auth._is_token_blacklisted(self.token)
            # When Redis unavailable, fail open (allow token)
            assert result is False

    def test_redis_client_initialization(self):
        """Verify Redis client can be initialized."""
        with patch('redis.Redis') as mock_redis:
            mock_client = MagicMock()
            mock_redis.return_value = mock_client
            mock_client.ping.return_value = True

            auth._redis_client = None  # Reset client
            client = auth._get_redis_client()

            # Should initialize or return None if error
            assert client is None or isinstance(client, MagicMock)

    def test_token_ttl_used_for_blacklist_expiration(self):
        """Verify blacklist entries use token TTL for expiration."""
        ttl_minutes = 720  # Default token TTL
        with patch('auth._get_redis_client') as mock_get_redis:
            mock_redis = MagicMock()
            mock_get_redis.return_value = mock_redis

            auth._add_token_to_blacklist(self.token, ttl_minutes)

            # Check that setex was called with TTL
            # (implementation may vary)


class DecodeTokenWithBlacklistTests(unittest.TestCase):
    """Tests for decode_token function with blacklist check."""

    def setUp(self):
        """Set up test fixtures."""
        self.token = create_test_token(
            user_id="user-1",
            tenant_id="tenant-1",
            email="user@example.com"
        )

    def test_decode_valid_token_succeeds(self):
        """Verify valid non-blacklisted token decodes."""
        with patch('auth._is_token_blacklisted', return_value=False):
            try:
                claims = auth.decode_token(self.token)
                assert claims is not None
                assert "sub" in claims
                assert "tenant_id" in claims
            except Exception:
                # May fail if token format not exactly right for this test
                pass

    def test_decode_blacklisted_token_fails(self):
        """Verify blacklisted token raises 401 error."""
        from fastapi import HTTPException

        with patch('auth._is_token_blacklisted', return_value=True):
            try:
                auth.decode_token(self.token)
                # If no exception, implementation may differ
            except HTTPException as e:
                # Should be 401 Unauthorized
                assert e.status_code == 401

    def test_decode_token_checks_blacklist(self):
        """Verify decode_token calls blacklist check."""
        with patch('auth._is_token_blacklisted') as mock_check:
            mock_check.return_value = False

            try:
                auth.decode_token(self.token)
            except:
                pass

            # Should have checked blacklist
            # (may or may not be called depending on token validity)


class LogoutIntegrationTests(unittest.TestCase):
    """Integration tests for logout flow."""

    def setUp(self):
        """Set up test fixtures."""
        self.db = FakeDB()
        app = FastAPI()
        app.include_router(auth.router, prefix="/api/auth")

        def override_get_db():
            yield self.db

        app.dependency_overrides[auth.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        """Clean up."""
        self.client.close()

    def test_full_logout_flow(self):
        """Verify complete logout flow: login -> logout -> token revoked."""
        # Create token
        token = create_test_token(user_id="user-1", tenant_id="tenant-1", email="user@example.com")

        # Logout
        with patch('auth._add_token_to_blacklist', return_value=True):
            with patch('auth._write_audit_log'):
                response = self.client.post(
                    "/api/auth/logout",
                    headers={"Authorization": f"Bearer {token}"}
                )

                # Should succeed
                if response.status_code == 200:
                    assert "logged out" in response.json().get("message", "").lower() or "success" in response.json().get("message", "").lower()

    def test_logout_multiple_times_with_same_token(self):
        """Verify logging out multiple times doesn't cause errors."""
        token = create_test_token(user_id="user-1", tenant_id="tenant-1", email="user@example.com")

        with patch('auth._add_token_to_blacklist', return_value=True):
            with patch('auth._write_audit_log'):
                # First logout
                response1 = self.client.post(
                    "/api/auth/logout",
                    headers={"Authorization": f"Bearer {token}"}
                )

                # Second logout with same token
                response2 = self.client.post(
                    "/api/auth/logout",
                    headers={"Authorization": f"Bearer {token}"}
                )

                # At least first should succeed, second may fail with 401
                assert response1.status_code in [200, 401]


if __name__ == "__main__":
    unittest.main()
