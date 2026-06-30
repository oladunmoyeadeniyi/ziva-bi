"""
ZivaBI — security utilities.

Handles password hashing (bcrypt) and JWT token creation/verification.
Refresh tokens are cryptographically random strings stored as SHA-256 hashes
in the refresh_tokens table — the raw token is sent to the client, never stored.

JWT access token payload:
    {
        "sub":               str(user_id),
        "user_tenant_id":    str(user_tenant_id),
        "account_type":      "individual" | "business",
        "tenant_id":         str(tenant_id) | None,
        "session_id":        str(session_id),
        "is_super_admin":    bool,
        "environment":       "live" | "test",        # M9.0: active tenant environment
        "impersonator_id":         str(user_id) | None,    # M9.3a: super admin who entered tenant
        "impersonation_mode":      "implementation" | "support" | None,  # M9.3a
        "is_user_impersonation":   bool,                # M9.3b: True when acting as a specific user
        "impersonation_session_id": str(uuid) | None,  # M9.3b: ImpersonationSession.id
        "type":              "access",
        "iat":               issued-at timestamp,
        "exp":               expiry timestamp
    }

Why bcrypt directly instead of passlib?
    passlib 1.7.4 is incompatible with bcrypt >= 4.0 (breaking API change in bcrypt).
    Using bcrypt 5.x directly sidesteps that issue cleanly.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a plain-text password with bcrypt (cost factor 12)."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT access tokens ─────────────────────────────────────────────────────────

def create_access_token(payload: dict) -> str:
    """
    Sign and return a JWT access token.

    payload must contain: sub, user_tenant_id, account_type, session_id.
    Expiry is added automatically from settings.access_token_expire_minutes.
    """
    data = payload.copy()
    data["type"] = "access"
    data["iat"] = datetime.now(timezone.utc)
    data["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(data, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.

    Raises jose.JWTError if the token is expired, tampered with, or the wrong type.
    The caller (require_auth dependency) converts JWTError into a 401 response.
    """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != "access":
        raise JWTError("Not an access token")
    return payload


# ── Refresh tokens ────────────────────────────────────────────────────────────

def generate_refresh_token() -> tuple[str, str]:
    """
    Generate a secure refresh token pair.

    Returns (raw_token, token_hash):
      - raw_token:  sent to the client (never stored in DB)
      - token_hash: SHA-256 hex digest stored in the refresh_tokens table
    """
    raw = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash


def hash_refresh_token(raw: str) -> str:
    """SHA-256 hash a raw refresh token for DB lookup."""
    return hashlib.sha256(raw.encode()).hexdigest()
