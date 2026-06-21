"""
ZivaBI — user management Pydantic schemas (Milestone 5 + profile backend).

Covers: profile updates, password changes, tenant user management, invitations,
active-session listing/revocation, and TOTP 2FA enrollment/verify/disable.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


# ── Profile ───────────────────────────────────────────────────────────────────

class ProfileUpdateRequest(BaseModel):
    """Payload for PATCH /api/users/me — update own profile fields."""

    full_name: str | None = None
    employee_code: str | None = None
    department: str | None = None
    job_title: str | None = None
    phone: str | None = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("Full name must be at least 2 characters.")
        return v


class PasswordChangeRequest(BaseModel):
    """Payload for PATCH /api/users/me/password."""

    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters.")
        return v


# ── Tenant User Management ────────────────────────────────────────────────────

class TenantUserDetail(BaseModel):
    """Full user record returned by GET /api/tenant/users."""

    id: str
    full_name: str
    email: str
    employee_code: str | None
    department: str | None
    job_title: str | None
    phone: str | None
    roles: list[str]
    is_active: bool
    created_at: datetime


class RoleAssignRequest(BaseModel):
    """Payload for PATCH /api/tenant/users/{user_id}/roles."""

    roles: list[str]

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[str]) -> list[str]:
        allowed = {"employee", "line_manager", "finance_reviewer", "finance_manager",
                   "finance_poster", "gm", "tenant_admin", "approver", "internal_auditor"}
        invalid = set(v) - allowed
        if invalid:
            raise ValueError(f"Unknown roles: {', '.join(invalid)}")
        return v


# ── Invitations ───────────────────────────────────────────────────────────────

class InvitationCreate(BaseModel):
    """Payload for POST /api/tenant/invitations."""

    email: str
    role: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"employee", "line_manager", "finance_reviewer", "finance_manager",
                   "gm", "tenant_admin", "approver"}
        if v not in allowed:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(sorted(allowed))}")
        return v


class InvitationResponse(BaseModel):
    """One invitation row as returned by GET /api/tenant/invitations."""

    id: str
    email: str
    role: str
    status: str
    invited_by_name: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime
    accept_url: str | None = None


class InvitationValidateResponse(BaseModel):
    """Returned by the public GET /api/invitations/validate/{token} endpoint."""

    email: str
    tenant_name: str
    role: str
    invited_by_name: str


# ── Sessions ──────────────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    """One active session row returned by GET /api/users/me/sessions."""

    id: str
    device: str          # parsed browser/OS label, or raw user-agent
    ip_address: str | None
    created_at: datetime
    expires_at: datetime
    is_current: bool     # True when this session matches the caller's JWT session_id


class RevokeCountResponse(BaseModel):
    """Returned by POST /api/users/me/sessions/revoke-others."""

    revoked: int
    message: str


# ── TOTP 2FA ──────────────────────────────────────────────────────────────────

class TotpEnrollResponse(BaseModel):
    """Returned by POST /api/users/me/2fa/enroll."""

    secret: str   # base32 TOTP secret (for manual entry if QR scan fails)
    uri: str      # otpauth:// provisioning URI — frontend renders the QR from this


class TotpCodeRequest(BaseModel):
    """Body for /api/users/me/2fa/verify and /api/users/me/2fa/disable."""

    code: str


class TotpStatusResponse(BaseModel):
    """Returned after verify or disable."""

    totp_enabled: bool
    message: str


class InvitationAcceptRequest(BaseModel):
    """Payload for POST /api/invitations/accept/{token}."""

    full_name: str
    password: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v
