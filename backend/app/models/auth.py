"""
ZivaBI — authentication and user management ORM models.

Tables (in dependency order, matching the Alembic migration):
    tenants           company records
    users             global user identity (one row per person)
    user_tenants      user ↔ tenant membership; holds password hash
    roles             system and tenant-defined roles
    permissions       canonical permission codes  (e.g. finance.post.erp)
    role_permissions  role ↔ permission joins
    user_roles        role assignments per user_tenant
    sessions          login sessions (device, IP, expiry)
    refresh_tokens    hashed refresh tokens with rotation support
    audit_logs        immutable auth event log

Individual accounts:  tenant_id IS NULL on user_tenants
Business accounts:    tenant_id references a tenants row
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from app.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class AccountType(str, enum.Enum):
    individual = "individual"
    business = "business"


# ── Models ────────────────────────────────────────────────────────────────────

class Tenant(Base):
    """
    Company record. Every business user_tenant row references one of these.

    Environment model (M9.0, direction flipped by M9.0.1): a tenant pair is
    linked via parent_tenant_id. The environment column ("live" | "test")
    drives routing. Switching environments reissues the JWT to point at the
    target tenant's id.

    Since M9.0.1: signup creates ONLY a test tenant (parent_tenant_id=NULL).
    Live is born second, only via super-admin promotion, with
    live.parent_tenant_id pointing back at the test tenant it came from --
    the inverse of the original M9.0 live-first/clone design, where
    parent_tenant_id lived on the test row instead. See
    docs/BRIEF_M9_0_1_test_first_environment_flow.md. Tenants created before
    this change (e.g. the original Red Bull pair) may still have the old
    direction until retrofitted -- see backend/scripts/retrofit_*_test_first.py.
    """

    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)  # ISO 3166-1 alpha-2
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # M8.2 fixes: tracks setup state flags
    dimensions_not_applicable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    documents_setup_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    module_setup_visited: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # M9.0: environment architecture
    # "live" | "test" — a test tenant and its live counterpart are a linked pair.
    environment: Mapped[str] = mapped_column(
        String(20), nullable=False, default="live", server_default="live"
    )
    # M9.0.1: set on the LIVE tenant, pointing back at the test tenant it was
    # promoted from. NULL on test tenants (every signup creates a parentless
    # test tenant; live doesn't exist until promotion). Pre-M9.0.1 tenants may
    # still have this set the old way (on the test row, pointing at live) until
    # retrofitted.
    parent_tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # "trial" | "in_implementation" | "live" | "suspended" — used by M9.1 owner portal.
    lifecycle_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="in_implementation", server_default="in_implementation"
    )
    # Days to retain test transactional data (null = use system default of 90).
    test_data_retention_days: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    # M9.1: saved before suspension so reactivate can restore the prior status.
    pre_suspension_status: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    # Phase 4: schema-readiness for future email suppression in test environments.
    # When True (default for test tenants), outbound notification emails should be
    # suppressed. Wiring into the SMTP sender is a separate follow-up change.
    suppress_outbound_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    # Trial lead tracking — Three-Mode Architecture (2026-07-11).
    # lead_status: consultant's outreach progress for trial tenants.
    #   new | contacted | qualified | disqualified
    # Harmless on non-trial tenants (stays 'new' forever).
    lead_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="new", server_default="new", index=True
    )
    # Consultant scratchpad — call notes, ERP background, etc. Never shown to tenant.
    implementation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user_tenants: Mapped[list["UserTenant"]] = relationship(
        "UserTenant", back_populates="tenant"
    )
    roles: Mapped[list["Role"]] = relationship("Role", back_populates="tenant")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="tenant")


class User(Base):
    """
    Global user identity — one row per person across all tenants.

    account_type drives the UX and module set shown after login.
    is_super_admin gates the global Super Admin portal.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Profile fields — editable by the user via PATCH /api/users/me
    employee_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # TOTP 2FA — secret stored as base32; encryption-at-rest is future hardening.
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user_tenants: Mapped[list["UserTenant"]] = relationship(
        "UserTenant", back_populates="user", passive_deletes=True
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="user")


class UserTenant(Base):
    """
    Maps a user to a tenant (or marks them as an individual if tenant_id is NULL).

    Stores the password hash here so the same person can have different
    credentials per company (multi-tenant login, later milestone).

    Unique constraint strategy:
      - (user_id, tenant_id) unique where tenant_id IS NOT NULL  → standard constraint
      - (user_id) unique where tenant_id IS NULL                 → partial index
      This prevents both duplicate business memberships and duplicate individual accounts.
    """

    __tablename__ = "user_tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # 'employee' = internal staff onboarded via the employee module
    # 'external' = externally invited user (auditor, consultant, etc.)
    user_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="employee")
    # M8.2: implementation portal role tier — 'consultant' | 'power_admin' | 'functional_admin'
    role_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        # Prevents the same user from joining the same tenant twice
        UniqueConstraint("user_id", "tenant_id", name="uq_user_tenants_user_tenant"),
        # Prevents an individual from having two identity rows (NULL != NULL in PG, so a partial index is needed)
        Index(
            "ix_user_tenants_individual_unique",
            "user_id",
            unique=True,
            postgresql_where=text("tenant_id IS NULL"),
        ),
    )

    user: Mapped["User"] = relationship("User", back_populates="user_tenants")
    tenant: Mapped["Tenant | None"] = relationship("Tenant", back_populates="user_tenants")
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="user_tenant")
    user_roles: Mapped[list["UserRole"]] = relationship(
        "UserRole", back_populates="user_tenant"
    )


class Role(Base):
    """
    System or tenant-defined role.

    System roles (is_system=True, tenant_id=NULL) are seeded at startup and
    cannot be deleted. Tenant Admins can create custom roles for their tenant.
    """

    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("name", "tenant_id", name="uq_roles_name_tenant"),
    )

    tenant: Mapped["Tenant | None"] = relationship("Tenant", back_populates="roles")
    role_permissions: Mapped[list["RolePermission"]] = relationship(
        "RolePermission", back_populates="role"
    )
    user_roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="role")


class Permission(Base):
    """
    Canonical permission codes (e.g. finance.post.erp).

    These are seeded at startup — the set of available permissions is defined
    in code, not by users. Tenant Admins assign permissions to roles.
    """

    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    role_permissions: Mapped[list["RolePermission"]] = relationship(
        "RolePermission", back_populates="permission"
    )


class RolePermission(Base):
    """Join table: which permissions belong to which role."""

    __tablename__ = "role_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permissions"),
    )

    role: Mapped["Role"] = relationship("Role", back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(
        "Permission", back_populates="role_permissions"
    )


class UserRole(Base):
    """Role assigned to a user within a specific tenant context."""

    __tablename__ = "user_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    assigned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user_tenant: Mapped["UserTenant"] = relationship(
        "UserTenant", back_populates="user_roles"
    )
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles")


class Session(Base):
    """
    A login session. Created on successful login, ended on logout or expiry.

    Tracks device and IP for audit purposes. The refresh token linked to
    this session drives session lifetime — when the refresh token expires,
    the session is effectively over.
    """

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45), nullable=True  # 45 chars covers IPv6
    )
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user_tenant: Mapped["UserTenant"] = relationship(
        "UserTenant", back_populates="sessions"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="session"
    )


class RefreshToken(Base):
    """
    Hashed refresh tokens linked to sessions.

    Token rotation: on each refresh call the old token is marked used and
    replaced_by points to the new one. If a used token is presented again,
    all sessions for that user are revoked (replay-attack protection).

    The raw token is NEVER stored — only the SHA-256 hex hash.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False  # SHA-256 hex = 64 chars
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("refresh_tokens.id"), nullable=True
    )
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped["Session"] = relationship("Session", back_populates="refresh_tokens")


class AuditLog(Base):
    """
    Immutable auth event log. Append-only — never update or delete rows.

    user_id and tenant_id are stored as nullable FKs with SET NULL on delete,
    so the audit trail survives even if the user or tenant is removed.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    log_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user: Mapped["User | None"] = relationship("User", back_populates="audit_logs")
    tenant: Mapped["Tenant | None"] = relationship("Tenant", back_populates="audit_logs")


# ── M9.3b: User-level impersonation audit log ─────────────────────────────────

class ImpersonationSession(Base):
    """
    Append-only audit record for every user-level impersonation session.

    Created when a super admin enters a specific user's identity via
    POST /api/platform/tenants/{tenant_id}/users/{user_id}/impersonate.
    ended_at is set when POST /api/platform/impersonation/{session_id}/end
    is called. No deletes or updates are permitted — enforce via service layer.

    impersonator_role distinguishes the platform owner ("super_admin_owner")
    from ordinary super admins ("super_admin") so the audit log is self-
    contained without having to re-derive the distinction from settings.
    """

    __tablename__ = "impersonation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    impersonator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    impersonator_role: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "super_admin_owner" | "super_admin"
    target_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    target_tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    environment: Mapped[str] = mapped_column(String(10), nullable=False)   # "live" | "test"
    entry_point: Mapped[str] = mapped_column(String(30), nullable=False)   # "user_list" | "employee_list"
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
