"""ConsultantLock ORM model — per-section configuration locks.

A PRAD consultant entering a tenant in implementation mode can lock any
setup section. Locked sections are read-only for power_admin and
functional_admin users — they see the data but cannot modify it.

Table: consultant_locks
Migration: u4v5w6x7y8z9_consultant_locks

Usage:
    # Check whether a section is locked
    lock = await db.execute(
        select(ConsultantLock).where(
            ConsultantLock.tenant_id == tenant_id,
            ConsultantLock.section_key == "chart_of_accounts",
            ConsultantLock.is_locked.is_(True),
        )
    )
    is_locked = lock.scalar_one_or_none() is not None
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, TIMESTAMP, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


# Canonical set of section keys. Application layer validates against this;
# the DB has a UNIQUE(tenant_id, section_key) but no CHECK on the key value
# so new sections can be added without a migration.
VALID_SECTION_KEYS: frozenset[str] = frozenset([
    "organisation",
    "module_activation",
    "chart_of_accounts",
    "dimensions",
    "employees",
    "currencies",
    "tax",
    "roles",
    "approval_workflows",
    "account_mapping",
    "bank_accounts",
    "periods",
    "document_rules",
    "expense_config",
    "posm_config",
    "vendor_portal_config",
    "customer_portal_config",
])


class ConsultantLock(Base):
    """A per-section configuration lock set by a PRAD consultant.

    One row per (tenant_id, section_key) pair — updated in-place when the
    consultant toggles the lock. The row is never deleted so the audit trail
    (locked_by, locked_at, unlocked_at) is preserved.

    Attributes:
        tenant_id:     Tenant this lock applies to.
        section_key:   Which setup section is locked (see VALID_SECTION_KEYS).
        is_locked:     True = currently locked; False = consultant unlocked it.
        lock_note:     Optional message explaining why the section is locked.
        locked_by:     SA user who last set the lock.
        locked_at:     When the lock was last set.
        unlocked_at:   When the lock was last cleared.
    """

    __tablename__ = "consultant_locks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_key: Mapped[str] = mapped_column(String(50), nullable=False)
    is_locked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    lock_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    locked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    locked_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    unlocked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "section_key", name="uq_consultant_locks_tenant_section"
        ),
    )
