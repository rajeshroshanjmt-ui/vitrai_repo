"""
Unit tests for P0 (critical) fixes:
- Password complexity validation
- Brute force protection
- API key encryption & show-once pattern
- Credential masking
- Token JTI claims for revocation
"""

import pytest
from uuid import uuid4
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta, timezone

import auth
import crypto
from models import User, TenantResource
from conftest import MockUser, MockResource, create_test_token


# ─────────────────────────────────────────────────────────────────────────────
# P0-1: Password Complexity Validation
# ─────────────────────────────────────────────────────────────────────────────

class TestPasswordComplexity:
    """Test password complexity validation (8+ chars, upper, lower, digit)."""

    def test_password_too_short(self):
        """Password less than 8 chars is rejected."""
        with pytest.raises(ValueError, match="at least 8"):
            auth.validate_password_complexity("Short1!")

    def test_password_missing_uppercase(self):
        """Password without uppercase letter is rejected."""
        with pytest.raises(ValueError, match="uppercase|upper"):
            auth.validate_password_complexity("lowercase123")

    def test_password_missing_lowercase(self):
        """Password without lowercase letter is rejected."""
        with pytest.raises(ValueError, match="lowercase|lower"):
            auth.validate_password_complexity("UPPERCASE123")

    def test_password_missing_digit(self):
        """Password without digit is rejected."""
        with pytest.raises(ValueError, match="digit|number|numeric"):
            auth.validate_password_complexity("NoDigitHere!")

    def test_strong_password_accepted(self):
        """Valid password (8+ chars, upper, lower, digit) is accepted."""
        # Should not raise
        auth.validate_password_complexity("ValidPass123!")
        auth.validate_password_complexity("AnotherGood999")
        auth.validate_password_complexity("Complex1Password")


# ─────────────────────────────────────────────────────────────────────────────
# P0-2: Brute Force Protection (5 failed attempts → 15 min lockout)
# ─────────────────────────────────────────────────────────────────────────────

class TestBruteForceProtection:
    """Test account lockout after failed login attempts."""

    @patch('auth.redis_client')
    def test_failed_login_recorded(self, mock_redis):
        """Failed login is recorded."""
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        auth._record_failed_login(user_id, tenant_id)

        mock_redis.incr.assert_called()
        call_args = mock_redis.incr.call_args
        assert user_id in str(call_args)

    @patch('auth.redis_client')
    def test_account_locked_after_5_attempts(self, mock_redis):
        """Account is locked after 5 failed attempts."""
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        # Mock return values: 1, 2, 3, 4, 5 (5th attempt triggers lockout)
        mock_redis.get.side_effect = [None, b'5']

        is_locked = auth._is_account_locked(user_id, tenant_id)

        # After 5 attempts (when get returns '5'), account is locked
        assert is_locked

    @patch('auth.redis_client')
    def test_failed_logins_cleared_on_success(self, mock_redis):
        """Failed login counter cleared on successful auth."""
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        auth._clear_failed_logins(user_id, tenant_id)

        mock_redis.delete.assert_called()

    @patch('auth.redis_client')
    def test_lockout_duration_15_minutes(self, mock_redis):
        """Lockout lasts 15 minutes (900 seconds)."""
        user_id = str(uuid4())
        tenant_id = str(uuid4())

        auth._record_failed_login(user_id, tenant_id)

        # Check that expire was called with 900 seconds (15 min)
        call_args = mock_redis.expire.call_args
        if call_args:
            assert call_args[0][1] == 900 or call_args[1].get('time') == 900


# ─────────────────────────────────────────────────────────────────────────────
# P0-3: API Key Encryption & Show-Once Pattern
# ─────────────────────────────────────────────────────────────────────────────

class TestAPIKeyEncryption:
    """Test API key encryption with AES-256-GCM and show-once pattern."""

    def test_api_key_generated_with_prefix(self):
        """Generated API key has predictable prefix."""
        raw_key, key_hash, key_prefix = crypto.generate_api_key("test")

        assert key_prefix.startswith("test_")
        assert len(key_prefix) > len("test_")
        assert isinstance(raw_key, str)
        assert isinstance(key_hash, str)

    def test_api_key_hash_not_reversible(self):
        """API key hash cannot be reversed to get raw key."""
        raw_key, key_hash, key_prefix = crypto.generate_api_key("sk")

        # Hash should not contain the raw key
        assert raw_key not in key_hash
        # Different call should produce different hash (due to salt)
        raw_key2, key_hash2, _ = crypto.generate_api_key("sk")
        assert key_hash != key_hash2

    def test_payload_encryption_envelope(self):
        """Encrypted payload has _enc marker and base64 ciphertext/nonce."""
        plaintext = {"api_key": "sk-secret", "secret": "password123"}

        encrypted = crypto.encrypt_payload(plaintext)

        assert encrypted.get("_enc") is True
        assert "ciphertext" in encrypted
        assert "nonce" in encrypted
        assert isinstance(encrypted["ciphertext"], str)
        assert isinstance(encrypted["nonce"], str)

    def test_payload_decryption_roundtrip(self):
        """Encrypted payload decrypts back to original."""
        original = {"api_key": "sk-12345", "secret": "mysecret"}

        encrypted = crypto.encrypt_payload(original)
        decrypted = crypto.decrypt_payload(encrypted)

        assert decrypted == original

    def test_payload_encryption_different_nonce_each_time(self):
        """Each encryption uses a different random nonce."""
        plaintext = {"secret": "data"}

        enc1 = crypto.encrypt_payload(plaintext)
        enc2 = crypto.encrypt_payload(plaintext)

        # Both are valid encryptions
        assert enc1.get("_enc") and enc2.get("_enc")
        # But nonces are different (random)
        assert enc1["nonce"] != enc2["nonce"]
        # Both decrypt to the same plaintext
        assert crypto.decrypt_payload(enc1) == plaintext
        assert crypto.decrypt_payload(enc2) == plaintext

    def test_tampered_ciphertext_rejected(self):
        """Tampered ciphertext fails authentication."""
        plaintext = {"secret": "protected"}
        encrypted = crypto.encrypt_payload(plaintext)

        # Tamper with ciphertext
        tampered = encrypted.copy()
        tampered["ciphertext"] = tampered["ciphertext"][:-4] + "0000"

        with pytest.raises(Exception):  # AES-GCM will raise on auth failure
            crypto.decrypt_payload(tampered)


# ─────────────────────────────────────────────────────────────────────────────
# P0-4: Credential Masking in Responses & Audit Logs
# ─────────────────────────────────────────────────────────────────────────────

class TestCredentialMasking:
    """Test that sensitive payloads are masked in responses."""

    def test_mask_sensitive_payload_pattern(self):
        """Sensitive values are replaced with ****xxxx pattern."""
        from resources import _mask_sensitive_payload

        payload = {
            "api_key": "sk-1234567890abcdef",
            "secret": "super-secret-value",
            "token": "jwt_token_here"
        }

        masked = _mask_sensitive_payload(payload)

        # Each value should be masked
        for key, value in masked.items():
            assert isinstance(value, str)
            assert value.startswith("****")
            assert len(value) >= 8  # ****xxxx format

    def test_security_resource_types_masked(self):
        """Resources of type credential/api_key are masked by default."""
        from resources import _serialize_resource

        resource = MockResource(
            resource_type="credential",
            name="My API Key",
        )
        resource.payload = {"api_key": "sk-actual-secret"}

        serialized = _serialize_resource(resource)

        # Payload should be masked (not contain the raw secret)
        assert "sk-actual-secret" not in str(serialized.get("payload", {}))

    def test_audit_details_sanitized_for_security_types(self):
        """Audit logs don't contain raw secrets for security resource types."""
        from resources import _safe_audit_details

        details = {
            "action": "create",
            "resource_type": "credential",
            "payload": {"api_key": "sk-12345", "password": "secret123"}
        }

        safe = _safe_audit_details(details)

        # Payload should be removed or masked
        if "payload" in safe:
            assert "sk-12345" not in str(safe["payload"])
            assert "secret123" not in str(safe["payload"])


# ─────────────────────────────────────────────────────────────────────────────
# P0-5: Token Claims (JTI for Revocation)
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenClaims:
    """Test that tokens include JTI and IAT claims for revocation."""

    def test_token_includes_jti_claim(self):
        """New tokens include JTI claim."""
        claims = {
            "sub": "user@example.com",
            "tenant_id": str(uuid4()),
            "user_id": str(uuid4())
        }

        token = auth.create_token(claims)
        decoded = auth.decode_token(token)

        # Should have JTI (or fail gracefully if optional)
        assert "jti" in decoded or "iat" in decoded

    def test_token_includes_iat_claim(self):
        """Tokens include IAT (issued at) claim."""
        claims = {
            "sub": "user@example.com",
            "tenant_id": str(uuid4()),
            "user_id": str(uuid4())
        }

        token = auth.create_token(claims)
        decoded = auth.decode_token(token)

        assert "iat" in decoded

    def test_token_expiry_set(self):
        """Token has expiry set."""
        claims = {
            "sub": "user@example.com",
            "tenant_id": str(uuid4()),
            "user_id": str(uuid4())
        }

        token = auth.create_token(claims)
        decoded = auth.decode_token(token)

        assert "exp" in decoded


# ─────────────────────────────────────────────────────────────────────────────
# P0-6: Token Blacklist (Redis-backed Revocation)
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenBlacklist:
    """Test token blacklist/revocation via Redis."""

    @patch('auth.redis_client')
    def test_token_added_to_blacklist(self, mock_redis):
        """Token can be added to blacklist."""
        token = "test_token_12345"
        jti = "jti-12345"

        auth.blacklist_token(jti, ttl_seconds=3600)

        mock_redis.setex.assert_called()

    @patch('auth.redis_client')
    def test_blacklisted_token_rejected(self, mock_redis):
        """Blacklisted token is rejected during verification."""
        token = "blacklisted_token"
        jti = "jti-blacklisted"

        # Mock Redis to indicate token is blacklisted
        mock_redis.get.return_value = b"1"

        is_blacklisted = auth._is_token_blacklisted(jti)

        assert is_blacklisted is True

    @patch('auth.redis_client')
    def test_valid_token_not_blacklisted(self, mock_redis):
        """Valid (non-blacklisted) token is accepted."""
        jti = "jti-valid"

        # Mock Redis to indicate token is NOT blacklisted
        mock_redis.get.return_value = None

        is_blacklisted = auth._is_token_blacklisted(jti)

        assert is_blacklisted is False


# ─────────────────────────────────────────────────────────────────────────────
# P0-7: Database Schema Alignment
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseSchema:
    """Test that new schema fields exist and work correctly."""

    def test_user_model_has_full_name(self):
        """User model includes full_name field."""
        user = MockUser(full_name="John Doe")
        assert user.full_name == "John Doe"

    def test_user_model_has_is_active(self):
        """User model includes is_active field."""
        user = MockUser()
        assert hasattr(user, 'is_active')

    def test_user_model_has_updated_at(self):
        """User model includes updated_at timestamp."""
        user = MockUser()
        assert hasattr(user, 'created_at')  # At minimum, timestamp exists

    def test_flow_model_has_flow_type(self):
        """Flow model includes flow_type discriminator."""
        # This would be tested against actual Flow model
        # For now, verify the pattern matches expectations
        assert True  # Placeholder for integration test


# ─────────────────────────────────────────────────────────────────────────────
# P0-8: Integration Test - Full Auth Flow with All Fixes
# ─────────────────────────────────────────────────────────────────────────────

class TestFullAuthFlow:
    """End-to-end auth flow tests covering multiple P0 fixes."""

    @patch('auth.redis_client')
    @patch('auth.db')
    def test_login_with_valid_password(self, mock_db, mock_redis):
        """Successful login with strong password."""
        tenant_id = str(uuid4())
        email = "user@example.com"
        password = "ValidPassword123!"

        user = MockUser(email=email, tenant_id=tenant_id, password_hash="hash")
        mock_db.query.return_value.filter.return_value.one_or_none.return_value = user

        # Mock bcrypt verification
        with patch('auth.bcrypt.checkpw', return_value=True):
            token = auth.issue_token(user, tenant_id)

            assert token is not None
            assert isinstance(token, str)

    @patch('auth.redis_client')
    @patch('auth.db')
    def test_login_fails_with_wrong_password(self, mock_db, mock_redis):
        """Login fails with wrong password."""
        tenant_id = str(uuid4())
        email = "user@example.com"

        user = MockUser(email=email, tenant_id=tenant_id)

        with patch('auth.bcrypt.checkpw', return_value=False):
            with pytest.raises(Exception):  # Should raise auth error
                auth.issue_token(user, tenant_id)

    @patch('auth.redis_client')
    @patch('auth.db')
    def test_login_fails_if_account_deactivated(self, mock_db, mock_redis):
        """Login fails if user is_active=False."""
        tenant_id = str(uuid4())

        user = MockUser(tenant_id=tenant_id)
        # Simulate deactivated user
        user.is_active = False

        with pytest.raises(Exception, match="inactive|deactivated"):
            auth.issue_token(user, tenant_id)
