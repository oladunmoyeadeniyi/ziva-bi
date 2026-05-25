"""
ZivaBI — expense management ORM models (Milestones 3–9).

Tables:
    expense_reports          parent-level expense retirement submission per employee
    expense_lines            individual expense entries within a report
    expense_report_snapshots immutable submission snapshots (M5)
    tenant_expense_config    per-tenant coding level and form flags (M7–M8)
    expense_categories       tenant-scoped category/subcategory tree (M7–M8)

Business-tier only. All tables require tenant_id.
report_number is auto-generated on creation as EXP-{YEAR}-{SEQUENCE:04d}.
total_amount is recalculated on every line add/delete.

M4 additions to expense_reports:
    current_approval_level  — tracks which approval level is currently active
    rejection_comment       — stores the rejector's comment when status = REJECTED
Status enum extended: DRAFT | SUBMITTED | PENDING_APPROVAL | APPROVED | REJECTED

M5 additions to expense_reports:
    rejected_at_level        — level that rejected or referred-back-to-requestor;
                               on resubmit, approval chain resumes from this level
                               (skipping re-approval of already-approved lower levels)
    referred_back_from_level — set during refer-back-to-approver flow; tracks the
                               higher level to return to once the lower approver acts
Status enum extended: + REFERRED_TO_REQUESTOR

M7 additions to expense_lines:
    category_id    — FK → expense_categories (nullable); set when require_category is ON
    subcategory_id — FK → expense_categories (nullable); set when require_subcategory is ON
    gl_account     — now nullable; Finance-mode tenants omit GL at submission time

M9 additions to expense_lines:
    gl_id            — FK → chart_of_accounts; structured CoA reference (nullable)
    dimension_values — JSONB {dimension_id_str: value_id_str}; per-line dim selections
    is_split_parent  — true once this line has been split into sub-lines
    split_parent_id  — FK → expense_lines; set on split sub-lines to point to parent
    flag_incorrect   — Level-2 coding: employee flags the auto-assigned GL as wrong
    flag_comment     — employee explanation for the flag
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DATE, NUMERIC, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

# M9: chart_of_accounts is imported lazily to avoid circular imports at module load.
# The FK is declared as a string; SQLAlchemy resolves it at mapping time.

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
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")
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
    # Level that rejected/referred-back-to-requestor; resubmit resumes from here
    rejected_at_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Set during refer-back-to-approver: the higher level to return to once lower approver acts
    referred_back_from_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Queue of additional levels to visit in multi-level refer-back (JSON array of ints)
    referred_back_levels: Mapped[list | None] = mapped_column(JSONB, nullable=True)
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
    # Nullable since M7: Finance-mode tenants leave GL blank; Finance team codes GL during approval
    gl_account: Mapped[str | None] = mapped_column(String(255), nullable=True)
    io_dimension: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost_center: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(DATE, nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(NUMERIC(15, 2), nullable=False)
    # M7: category selection (Finance-mode and category_mapped mode)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    subcategory_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    # M9: structured GL reference from the M8 Chart of Accounts
    gl_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # M9: JSONB map {dimension_id_str: value_id_str} for dynamic dimension fields
    dimension_values: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # M9: split-line tracking — parent/child relationship for split expense items
    is_split_parent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    split_parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_lines.id", ondelete="SET NULL"),
        nullable=True,
    )
    # M9: Level-2 coding — employee can flag auto-assigned GL as incorrect
    flag_incorrect: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    flag_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    report: Mapped["ExpenseReport"] = relationship("ExpenseReport", back_populates="lines")


class TenantExpenseConfig(Base):
    """
    Per-tenant configuration for the expense submission form (M7–M8).

    At most one row per tenant (enforced by UNIQUE on tenant_id).
    If no row exists, all endpoints return hard-coded defaults so existing
    tenants continue to behave exactly as before M7 (coding_level=0, no categories).

    coding_level (M8):
        0 — Finance codes everything (no GL fields visible to employee)
        1 — Category only (employee picks category/subcategory; GL auto-assigned)
        2 — Category + GL confirmation (employee can see and flag the suggested GL)
        3 — Guided GL selection (employee picks GL from a filtered shortlist)
        4 — Full GL coding (employee types or searches GL directly)

    show_location / require_location (M8): control the location field on expense lines.
    """

    __tablename__ = "tenant_expense_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    coding_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    require_category: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    require_subcategory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allow_free_text_description: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    show_location: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    require_location: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # M8.2: consultant can lock this config from Power Admin modification
    locked_by_implementation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ExpenseCategory(Base):
    """
    Tenant-scoped expense category (or subcategory), M7–M8.

    Tree structure: parent_id = NULL means top-level category; parent_id set means subcategory.
    Only one level of nesting is supported.

    M8: GL account mappings moved from gl_account_suggestion (string) to the
    category_gl_mappings table (one-to-many, with is_default flag).
    code is now VARCHAR(100) and required (NOT NULL after M8 migration).

    Deactivation is soft (is_active = false) and cascades to subcategories in the router.
    """

    __tablename__ = "expense_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    subcategories: Mapped[list["ExpenseCategory"]] = relationship(
        "ExpenseCategory",
        primaryjoin="ExpenseCategory.id == foreign(ExpenseCategory.parent_id)",
        back_populates="parent",
        lazy="select",
    )
    parent: Mapped["ExpenseCategory | None"] = relationship(
        "ExpenseCategory",
        primaryjoin="foreign(ExpenseCategory.parent_id) == ExpenseCategory.id",
        back_populates="subcategories",
        remote_side="ExpenseCategory.id",
    )


class ExpenseReportSnapshot(Base):
    """
    Immutable point-in-time copy of an expense report at each submission.

    Captures the full line-item detail + header at the moment of submission so
    that if the employee edits lines between a rejection and resubmission, every
    version is preserved. version increments with each resubmission (1, 2, 3…).
    snapshot_data is a JSONB blob containing all header fields and expense lines.
    """

    __tablename__ = "expense_report_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
