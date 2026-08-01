"""Consolidation models — IxE (Inter-Company Eliminations).

Supports group consolidation in Full ERP mode only. Parent tenant
creates a ConsolidationGroup, adds member tenants, tags IC GL accounts,
runs auto-matching, and posts elimination journals.

Tables:
  consolidation_groups          — named consolidation perimeter
  consolidation_members         — entities + ownership % in a group
  ic_account_mappings           — GL accounts tagged with IC roles
  ic_matches                    — confirmed/proposed IC offsets
  elimination_journals          — immutable group-level elimination entries
  elimination_journal_lines     — lines within elimination entries

Relations (all read via lazy="selectin" to avoid N+1):
  ConsolidationGroup.members → ConsolidationMember
  ConsolidationGroup.elimination_journals → EliminationJournal
  EliminationJournal.lines → EliminationJournalLine
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, ForeignKey, Numeric,
    String, Text, TIMESTAMP, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class ConsolidationGroup(Base):
    """A named group of tenants for group consolidation.

    Created by the parent (holding) tenant. Only tenants whose posting_mode
    is FULL_ERP may participate as members.

    Args:
        parent_tenant_id: The holding company's tenant ID.
        name: Human-readable group name (unique per parent).
        currency: Presentation/consolidation currency (ISO 3166 alpha-3).
        ic_match_tolerance: Max difference (in currency units) still treated as a match.
    """

    __tablename__ = "consolidation_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="NGN")
    ic_match_tolerance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    members: Mapped[list["ConsolidationMember"]] = relationship("ConsolidationMember", back_populates="group", lazy="selectin")
    ic_account_mappings: Mapped[list["IcAccountMapping"]] = relationship("IcAccountMapping", back_populates="group", lazy="selectin")
    elimination_journals: Mapped[list["EliminationJournal"]] = relationship("EliminationJournal", back_populates="group", lazy="selectin")
    ic_matches: Mapped[list["IcMatch"]] = relationship("IcMatch", back_populates="group", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("parent_tenant_id", "name", name="uq_consolidation_groups_parent_name"),
    )


class ConsolidationMember(Base):
    """A single entity's membership in a consolidation group.

    ownership_pct drives minority interest calculations (Phase 2).
    In Phase 1, only 100% subsidiaries are supported.

    Args:
        group_id: Parent group.
        member_tenant_id: The subsidiary's tenant ID.
        ownership_pct: Percentage owned by the parent (0–100.00).
        joined_at: Date entity first included in group.
        left_at: Date entity removed (null = still active).
    """

    __tablename__ = "consolidation_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    member_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    ownership_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default="100.00")
    joined_at: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    left_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    group: Mapped["ConsolidationGroup"] = relationship("ConsolidationGroup", back_populates="members")

    __table_args__ = (
        UniqueConstraint("group_id", "member_tenant_id", name="uq_consolidation_members_group_tenant"),
    )


class IcAccountMapping(Base):
    """Tags a GL account with an intercompany role for auto-matching.

    Example: Account 1300 "Intercompany Receivables" tagged RECEIVABLE
    against counterparty_tenant_id 'subsidiary-B'. The system then looks
    for a corresponding PAYABLE entry in subsidiary-B's ledger.

    Args:
        ic_role: One of RECEIVABLE | PAYABLE | REVENUE | EXPENSE | LOAN_ASSET | LOAN_LIABILITY.
        counterparty_tenant_id: The entity this account transacts with (null = any member).
    """

    __tablename__ = "ic_account_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False)
    member_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    gl_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="CASCADE"), nullable=False)
    ic_role: Mapped[str] = mapped_column(String(20), nullable=False)
    counterparty_tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    group: Mapped["ConsolidationGroup"] = relationship("ConsolidationGroup", back_populates="ic_account_mappings")

    __table_args__ = (
        UniqueConstraint("group_id", "member_tenant_id", "gl_account_id", name="uq_ic_account_mappings"),
        CheckConstraint(
            "ic_role IN ('RECEIVABLE','PAYABLE','REVENUE','EXPENSE','LOAN_ASSET','LOAN_LIABILITY')",
            name="chk_ic_role",
        ),
    )


class IcMatch(Base):
    """A matched pair of intercompany journal lines across two member entities.

    The auto-matcher pairs IC-tagged lines (debit in entity A, credit in B)
    within the same period and within tolerance. The group controller then
    confirms or disputes each match before posting an EliminationJournal.

    Args:
        status: PROPOSED (auto-match) → CONFIRMED → or DISPUTED.
        match_type: AUTO (engine) or MANUAL (controller).
    """

    __tablename__ = "ic_matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False)
    period_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounting_periods.id"), nullable=False)
    debit_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    debit_journal_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_lines.id"), nullable=False)
    credit_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    credit_journal_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_lines.id"), nullable=False)
    matched_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="PROPOSED")
    match_type: Mapped[str] = mapped_column(String(10), nullable=False, server_default="AUTO")
    matched_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    disputed_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    group: Mapped["ConsolidationGroup"] = relationship("ConsolidationGroup", back_populates="ic_matches")

    __table_args__ = (
        CheckConstraint("debit_tenant_id <> credit_tenant_id", name="chk_ic_matches_different_tenants"),
        CheckConstraint("status IN ('PROPOSED','CONFIRMED','DISPUTED')", name="chk_ic_match_status"),
        CheckConstraint("match_type IN ('AUTO','MANUAL')", name="chk_ic_match_type"),
    )


class EliminationJournal(Base):
    """An immutable elimination entry posted at group level.

    Once posted, lines cannot be edited. Reversal creates a new
    EliminationJournal with reversed_by pointing to this one and
    this one's status set to REVERSED.

    Args:
        reference: Unique ref (e.g. "ELIM-2026-001").
        total_dr / total_cr: Must balance; enforced in the service layer.
    """

    __tablename__ = "elimination_journals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False)
    period_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounting_periods.id"), nullable=False)
    reference: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    total_dr: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total_cr: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="POSTED")
    reversed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("elimination_journals.id"), nullable=True)
    posted_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    posted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    group: Mapped["ConsolidationGroup"] = relationship("ConsolidationGroup", back_populates="elimination_journals")
    lines: Mapped[list["EliminationJournalLine"]] = relationship("EliminationJournalLine", back_populates="journal", lazy="selectin")

    __table_args__ = (
        CheckConstraint("status IN ('POSTED','REVERSED')", name="chk_elimination_journal_status"),
    )


class EliminationJournalLine(Base):
    """A single debit or credit line inside an EliminationJournal.

    Args:
        ic_match_id: Optional — links line back to the IC match that drove it.
        debit / credit: Exactly one is non-zero per line (enforced by service).
    """

    __tablename__ = "elimination_journal_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    elimination_journal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("elimination_journals.id", ondelete="CASCADE"), nullable=False, index=True)
    ic_match_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ic_matches.id"), nullable=True)
    member_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    gl_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"), nullable=False)
    debit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, server_default="0")
    credit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, server_default="0")
    narrative: Mapped[str | None] = mapped_column(Text, nullable=True)

    journal: Mapped["EliminationJournal"] = relationship("EliminationJournal", back_populates="lines")
