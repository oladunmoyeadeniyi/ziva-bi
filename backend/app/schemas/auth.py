"""
ZivaBI — auth Pydantic schemas.

Request and response shapes for the auth and users routers.
Validation is enforced here at the API boundary — nothing downstream
should receive unvalidated data.
"""

import re
import uuid
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

# ── Requests ──────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    """
    Unified signup payload for both individual and business accounts.

    For business accounts, company_name and company_country are required.
    The model_validator enforces this cross-field rule.
    """

    account_type: Literal["individual", "business"]
    email: str
    password: str
    full_name: str
    company_name: str | None = None
    company_country: str | None = None  # ISO 3166-1 alpha-2, e.g. "NG", "GB"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v

    @field_validator("company_country")
    @classmethod
    def validate_country(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().upper()
        if len(v) != 2 or not v.isalpha():
            raise ValueError("Country must be a 2-letter ISO code (e.g. NG, GB, US).")
        return v

    @model_validator(mode="after")
    def business_fields_required(self) -> "SignupRequest":
        """Company name and country are mandatory for business accounts."""
        if self.account_type == "business":
            if not self.company_name or not self.company_name.strip():
                raise ValueError("Company name is required for business accounts.")
            if not self.company_country:
                raise ValueError("Company country is required for business accounts.")
        return self


class LoginRequest(BaseModel):
    """Email + password login payload."""

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class RefreshTokenRequest(BaseModel):
    """Refresh token rotation request."""

    refresh_token: str


class LogoutRequest(BaseModel):
    """Logout request — revokes the provided refresh token."""

    refresh_token: str


# ── Responses ─────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """User profile returned after login, signup, or GET /users/me."""

    id: str
    email: str
    full_name: str
    account_type: str
    tenant_id: str | None
    is_super_admin: bool
    is_tenant_admin: bool = False
    has_non_admin_role: bool = False
    # M8.2: implementation portal role tier
    role_tier: str | None = None
    # Extended profile fields (null until the user fills them in)
    employee_code: str | None = None
    department: str | None = None
    job_title: str | None = None
    phone: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_pair(
        cls,
        user: object,
        tenant_id: uuid.UUID | None,
        *,
        is_tenant_admin: bool = False,
        has_non_admin_role: bool = False,
        role_tier: str | None = None,
    ) -> "UserResponse":
        """Build response from a User ORM object + optional tenant_id and role flags."""
        return cls(
            id=str(user.id),  # type: ignore[attr-defined]
            email=user.email,  # type: ignore[attr-defined]
            full_name=user.full_name,  # type: ignore[attr-defined]
            account_type=user.account_type.value,  # type: ignore[attr-defined]
            tenant_id=str(tenant_id) if tenant_id else None,
            is_super_admin=user.is_super_admin,  # type: ignore[attr-defined]
            is_tenant_admin=is_tenant_admin,
            has_non_admin_role=has_non_admin_role,
            role_tier=role_tier,
            employee_code=getattr(user, "employee_code", None),
            department=getattr(user, "department", None),
            job_title=getattr(user, "job_title", None),
            phone=getattr(user, "phone", None),
        )


class AuthResponse(BaseModel):
    """
    Returned on successful signup, login, or token refresh.

    access_token:  short-lived JWT (30 min by default) — include as
                   "Authorization: Bearer <token>" on every API request.
    refresh_token: long-lived opaque token (7 days by default) — store
                   securely and use only to rotate the access token.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse | None = None  # None on token refresh (user unchanged)


class MessageResponse(BaseModel):
    """Generic success confirmation."""

    message: str
