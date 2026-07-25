"""
ZivaBI — Bank Reconciliation ORM models (M11c).

Tables:
    bank_statements       — Header for one imported bank statement.
    bank_statement_lines  — Individual transactions from the bank's statement.
    bank_recon_matches    — Junction: links statement lines to GL journal lines
                            (Full ERP), posting batches (Connected), or manual
                            notes (Lite).

Three-mode behaviour:
    Lite        — import CSV statement, match lines manually by description/amount.
                  match_type = 'manual'; no FK to journal_lines or posting_batches.
    Connected   — match statement lines to posting_batches awaiting ERP sync.
                  match_type = 'posting_batch'; matched_posting_batch_id populated.
    Full ERP    — match statement lines to journal_lines tagged with bank_account_id.
                  match_type = 'journal_line'; matched_journal_line_id populated.

Status lifecycle:
    BankStatement:     DRAFT → IN_PROGRESS → RECONCILED
    BankStatementLine: UNMATCHED → MATCHED | PARTIAL | EXCLUDED

Design notes:
- statement_ref is unique per tenant: "STMT-{YYYY}-{NNN}" — auto-assigned.
- bank_statement_lines.match_status is denormalised for query speed (avoids JOIN
  on every statement-list render); updated atomically by the match engine.
- bank_recon_matches.matched_amount enables partial matching (statement line may
  be split across multiple GL lines, e.g. a bulk payment covering several invoices).
- posting_batches FK is SET NULL on delete so batches may be cleaned up without
  blocking recon history.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BankStatement(Base):
    """
    Header for one imported bank statement.

    Lifecycle:
        DRAFT       — created, no lines yet (or lines being uploaded)
        IN_PROGRESS — lines present, reconciliation under way
        RECONCILED  — all lines MATCHED or EXCLUDED; balance check passes

    Attributes:
        opening_balance / closing_balance — from the bank's own statement header.
        period_start    — first transaction date; optional (some statements omit it).
        currency        — ISO 4217, must match bank_account.currency.
    """

    __tablename__ = "bank_statements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bank_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bank_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    statement_ref: Mapped[str] = mapped_column(String(30), nullable=False)
    statement_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    opening_balance: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0")
    )
    closing_balance: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0")
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # status: DRAFT | IN_PROGRESS | RECONCILED
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    lines: Mapped[list["BankStatementLine"]] = relationship(
        "BankStatementLine",
        back_populates="statement",
        cascade="all, delete-orphan",
        order_by="BankStatementLine.line_number",
    )

    __table_args__ = (
        # statement_ref unique per tenant, e.g. "STMT-2026-001"
        __import__("sqlalchemy").UniqueConstraint(
            "tenant_id", "statement_ref", name="uq_stmt_tenant_ref"
        ),
    )


class BankStatementLine(Base):
    """
    One transaction line from the bank's statement.

    debit/credit are from the BANK's perspective:
        credit = money coming into the account (e.g. customer receipt)
        debit  = money leaving the account (e.g. payment to vendor)
    Exactly one of debit/credit is > 0; the other is 0.

    match_status is a denormalised cache:
        UNMATCHED — not yet matched to any GL / batch entry
        MATCHED   — fully matched (matched_amount == debit or credit)
        PARTIAL   — partially matched (some bank_recon_matches exist but total < line amount)
        EXCLUDED  — deliberately excluded (bank charge already posted, etc.)
    """

    __tablename__ = "bank_statement_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    statement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bank_statements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    value_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Bank's perspective: credit = inflow, debit = outflow
    debit: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0")
    )
    credit: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0")
    )
    running_balance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), nullable=True
    )

    # match_status: UNMATCHED | MATCHED | PARTIAL | EXCLUDED
    match_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="UNMATCHED"
    )

    statement: Mapped["BankStatement"] = relationship(
        "BankStatement", back_populates="lines"
    )
    matches: Mapped[list["BankReconMatch"]] = relationship(
        "BankReconMatch",
        back_populates="statement_line",
        cascade="all, delete-orphan",
    )


class BankReconMatch(Base):
    """
    Links one bank statement line to a GL journal line, posting batch, or manual note.

    match_type discriminator:
        'journal_line'   — Full ERP mode: matched to a journal_lines row
                           matched_journal_line_id is populated
        'posting_batch'  — Connected mode: matched to a posting_batches row
                           matched_posting_batch_id is populated
        'manual'         — Lite mode (or any mode): free-text note only
                           neither FK is populated; notes explains the match

    matched_amount enables partial matching:
        One statement line may be split across N GL lines (e.g. bulk payment).
        Sum of matched_amount across all matches for a line = line's debit or credit
        when fully matched. The engine updates BankStatementLine.match_status to
        PARTIAL while sum < full amount, MATCHED when sum == full amount.

    Notes:
        The engine does NOT enforce a unique constraint on matched_journal_line_id
        because in rare cases a GL line legitimately covers two statement lines
        (e.g. an error correction with two offsetting entries). App logic handles
        this via the notes field.
    """

    __tablename__ = "bank_recon_matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    statement_line_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bank_statement_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 'journal_line' | 'posting_batch' | 'manual'
    match_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Full ERP — FK to journal_lines
    matched_journal_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal_lines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Connected mode — FK to posting_batches
    matched_posting_batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("posting_batches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    matched_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0")
    )
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    matched_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    statement_line: Mapped["BankStatementLine"] = relationship(
        "BankStatementLine", back_populates="matches"
    )
