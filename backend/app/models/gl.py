"""
ZivaBI — General Ledger ORM models (GL Engine #1).

Tables:
    journal_entries   — GL journal header: date, description, source, status.
    journal_lines     — Double-entry lines: GL account, debit/credit, dimensions.
    posting_batches   — Connected-Mode export queue: approved transaction journals
                        serialised to JSONB, awaiting download/sync to external ERP.

Design notes:
- Tenant-scoped via tenant_id FK, following the same pattern as all other modules.
- Dimensions per line are stored as JSONB: {str(dimension_id): str(dimension_value_id)}.
- environment column is NOT included — test/live isolation is enforced by tenant_id.
- Reversal fields are schema-ready but reversal logic is a later brief.
- reference_number is unique per tenant (e.g. "JE-2026-000001").
- status: 'DRAFT' | 'POSTED' | 'REVERSED'. POSTED entries are immutable.
- The service flushes only; the router-level get_db() commits on success.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    DateTime,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JournalEntry(Base):
    """GL journal header. Once POSTED, immutable — corrections via reversing entries."""

    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reference_number: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="POSTED")

    reverses_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True,
    )
    reversed_by_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    lines: Mapped[list["JournalLine"]] = relationship(
        "JournalLine", back_populates="entry",
        cascade="all, delete-orphan", order_by="JournalLine.line_number",
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "reference_number", name="uq_je_tenant_ref"),
        Index("ix_je_tenant_date", "tenant_id", "entry_date"),
    )


class JournalLine(Base):
    """
    One DR/CR line within a JournalEntry.

    Invariants (application-layer):
      - Exactly one of debit/credit > 0.
      - Across all lines: Σ debit == Σ credit.
    """

    __tablename__ = "journal_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    gl_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id"),  # no CASCADE — preserve lines even if GL archived
        nullable=False, index=True,
    )
    debit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    dimensions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Optional bank account tag for reconciliation. SET NULL on delete.
    bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bank_accounts.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")


class PostingBatch(Base):
    """
    Connected-Mode export queue for approved transactions.

    When tenant_org_config.posting_mode = 'connected', approved transactions are
    serialised to JSONB here instead of being posted to journal_entries.
    The finance team downloads/syncs batches to their external ERP.

    Status lifecycle: pending -> exported -> synced.

    batch_ref format: "BATCH-{YYYY}-{MM}-{NNN}"
    """

    __tablename__ = "posting_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    batch_ref: Mapped[str] = mapped_column(String(50), nullable=False)
    module: Mapped[str] = mapped_column(String(30), nullable=False, default="expense")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    transactions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    exported_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_posting_batches_tenant_status", "tenant_id", "status"),
        Index("ix_posting_batches_tenant_module", "tenant_id", "module"),
    )
