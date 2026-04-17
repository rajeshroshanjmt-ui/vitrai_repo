"""
Encryption utilities for sensitive resource payloads (credentials, API keys).

Uses AES-256-GCM (authenticated encryption) with a per-encryption random nonce.
The master key is derived from the PAYLOAD_ENCRYPTION_KEY environment variable.

Envelope format stored in the JSONB `payload` column:
{
    "_enc": true,                      # marker so we know to decrypt
    "ciphertext": "<base64>",          # GCM ciphertext
    "nonce":      "<base64>",          # 12-byte random nonce (unique per encryption)
    "tag":        "<base64>",          # 16-byte GCM authentication tag
}

The original plaintext payload fields sit alongside _enc-marked wrapper only
when decrypted at runtime — they are never persisted in cleartext.

Key configuration
-----------------
Set PAYLOAD_ENCRYPTION_KEY to a URL-safe base64-encoded 32-byte key:

    python -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"

If the env var is absent the module falls back to a dev-only stub key and
emits a warning. In production (APP_ENV not in dev/test) startup raises if
the key is missing or too short.
"""

import base64
import json
import logging
import os
import secrets
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

_APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
_LOCAL_ENVS = {"dev", "development", "local", "test", "testing", "ci"}

_DEV_STUB_KEY = b"\x00" * 32  # Only used in dev/test — rejected in prod

_ENC_MARKER = "_enc"
_NONCE_BYTES = 12   # 96-bit nonce — recommended for AES-GCM


def _load_master_key() -> bytes:
    raw = os.getenv("PAYLOAD_ENCRYPTION_KEY", "")
    if not raw:
        if _APP_ENV not in _LOCAL_ENVS:
            raise RuntimeError(
                "PAYLOAD_ENCRYPTION_KEY must be set in production. "
                "Generate one with: python -c \"import secrets, base64; "
                "print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())\""
            )
        logger.warning(
            "PAYLOAD_ENCRYPTION_KEY not set — using insecure stub key (dev/test only). "
            "Credentials are NOT protected at rest."
        )
        return _DEV_STUB_KEY

    try:
        key = base64.urlsafe_b64decode(raw + "==")  # pad for safety
    except Exception as exc:
        raise RuntimeError(f"PAYLOAD_ENCRYPTION_KEY is not valid base64: {exc}") from exc

    if len(key) != 32:
        raise RuntimeError(
            f"PAYLOAD_ENCRYPTION_KEY must decode to exactly 32 bytes (got {len(key)}). "
            "Re-generate with: python -c \"import secrets, base64; "
            "print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())\""
        )
    return key


# Module-level key — loaded once at import time so startup fails fast on misconfiguration.
_MASTER_KEY: bytes = _load_master_key()


def encrypt_payload(plaintext_payload: dict[str, Any]) -> dict[str, Any]:
    """Encrypt a dict payload, returning an envelope dict safe to store in JSONB.

    The returned dict contains only the _enc marker and opaque ciphertext fields —
    no plaintext values persist in the database.
    """
    aesgcm = AESGCM(_MASTER_KEY)
    nonce = secrets.token_bytes(_NONCE_BYTES)
    data = json.dumps(plaintext_payload, separators=(",", ":")).encode("utf-8")
    # AESGCM.encrypt returns ciphertext || tag (tag is last 16 bytes)
    ct_with_tag = aesgcm.encrypt(nonce, data, None)

    return {
        _ENC_MARKER: True,
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ct_with_tag).decode("ascii"),
    }


def decrypt_payload(envelope: dict[str, Any]) -> dict[str, Any]:
    """Decrypt an envelope previously produced by encrypt_payload.

    Raises ValueError if the envelope is malformed or authentication fails
    (indicating tampering or key mismatch).
    """
    if not envelope.get(_ENC_MARKER):
        # Already plaintext — return as-is (handles legacy records before encryption)
        return envelope

    try:
        nonce = base64.b64decode(envelope["nonce"])
        ct_with_tag = base64.b64decode(envelope["ciphertext"])
    except (KeyError, Exception) as exc:
        raise ValueError(f"Malformed encryption envelope: {exc}") from exc

    aesgcm = AESGCM(_MASTER_KEY)
    try:
        plaintext = aesgcm.decrypt(nonce, ct_with_tag, None)
    except Exception as exc:
        raise ValueError(
            "Decryption failed — payload may have been tampered with or the encryption key has changed."
        ) from exc

    return json.loads(plaintext.decode("utf-8"))


def is_encrypted(payload: dict[str, Any]) -> bool:
    """Return True if payload is an encryption envelope."""
    return bool(payload.get(_ENC_MARKER))


def hash_api_key(raw_key: str) -> str:
    """Return a stable hex digest of an API key for indexed lookup.

    Uses BLAKE2b-256 (fast, cryptographically strong, no length-extension attacks).
    Do NOT use this for password storage — use bcrypt for passwords.
    """
    import hashlib
    return hashlib.blake2b(raw_key.encode("utf-8"), digest_size=32).hexdigest()


def generate_api_key(prefix: str = "vtrai") -> tuple[str, str, str]:
    """Generate a new API key.

    Returns:
        (raw_key, key_hash, key_prefix) where:
          - raw_key    is shown to the user exactly once
          - key_hash   is stored in the database for lookup
          - key_prefix is the first 8 chars (safe for UI display)
    """
    token = secrets.token_urlsafe(32)
    raw_key = f"{prefix}_{token}"
    return raw_key, hash_api_key(raw_key), raw_key[:len(prefix) + 9]  # prefix + "_" + 8 chars
