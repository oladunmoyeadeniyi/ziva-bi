"""
ZivaBI — expense management ORM models (Milestones 3–4).

Tables:
    expense_reports   parent-level expense retirement submission per employee
    expense_lines     individual expense entries within a report

Business-tier only. Both tables require tenant_id.
report_number is auto-generated on creation as EXP-{YEAR}-{SEQUENCE:04d}.
total_amount is recalculated on every line add/delete.

M4 additions to expense_reports:
    current_approval_level  — tracks which approval level is currently active
    rejection_comment       — stores the rejector's comment when status = REJECTED
Status enum extended: DRAFT | SUBMITTED | PENDING_APPROVAL | APPROVED | REJECTED
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DATE, NUMERIC, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExpenseReport(Base):
    """
    Parent-level expense retirement submission.

    One report per employee submission containing one or more expense lines.
    Status flow for M3: DRAFT → SUBMITTED (no approvals yet).
    total_amount mirrors the sum of all line amounts and is updated by the router
    whenever lines are added or removed.
    """

    __tablename__ = "expense_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    employee_function: Mapped[str | None] = mapped_column(String(255), nullable=True)
    report_date: Mapped[date] = mapped_column(DATE, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    total_amount: Mapped[Decimal] = mapped_column(
        NUMERIC(15, 2), nullable=False, default=Decimal("0.00")
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_approval_level: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    rejection_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    lines: Mapped[list["ExpenseLine"]] = relationship(
        "ExpenseLine",
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="ExpenseLine.line_number",
    )


class ExpenseLine(Base):
    """
    Single expense entry within a report.

    line_number is assigned as max(existing) + 1 within the report.
    gl_account and description are required; all dimension fields are optional.
    amount is stored in NGN (no FX in M3).
    """

    __tablename__ = "expense_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    pl_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gl_account: Mapped[str] = mapped_column(String(255), nullable=False)
    io_dimension: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost_center: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(DATE, nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(NUMERIC(15, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    report: Mapped["ExpenseReport"] = relationship("ExpenseReport", back_populates="lines")
