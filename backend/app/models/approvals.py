"""
ZivaBI — approval workflow ORM models (Milestones 4–5).

Tables:
    approval_matrix    One row per tenant; configures the number of approval levels
                       and which role label each level carries.
    expense_approvals  One row per (report × level); tracks each approver's action
                       on an expense report.

Status flow: PENDING → APPROVED | REJECTED | REFERRED_BACK

M5 additions to expense_approvals:
    visible_to_requestor — whether the referral comment is visible to the requestor
    response_comment     — referred approver's reply back to the referring approver
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, NUMERIC, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ApprovalMatrix(Base):
    """
    Approval configuration for one tenant.

    Defines how many sequential approval levels are required and the role label
    displayed to employees at each level. Level 2 and 3 are optional.
    amount_threshold_l2/l3 allow skipping a level when the report total is below
    the threshold; None means the level is always required.

    UNIQUE on tenant_id — one row per tenant, upserted on save.
    """

    __tablename__ = "approval_matrix"

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
    levels: Mapped[int] = mapped_column(Integer, nullable=False)
    level1_role: Mapped[str] = mapped_column(String(100), nullable=False)
    level2_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    level3_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount_threshold_l2: Mapped[Decimal | None] = mapped_column(
        NUMERIC(15, 2), nullable=True
    )
    amount_threshold_l3: Mapped[Decimal | None] = mapped_column(
        NUMERIC(15, 2), nullable=True
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


class ExpenseApproval(Base):
    """
    One approval record per (expense report × level).

    Created at submit time for each applicable approval level. The status
    starts as PENDING. The queue query activates only the record whose level
    matches expense_reports.current_approval_level, enforcing sequential approval.

    approver_id: the specific user selected by the employee at submission time.
    comment:     required on rejection; optional on approval.
    actioned_at: set when the approver takes action (approve/reject).
    """

    __tablename__ = "expense_approvals"

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
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    # For REFERRED_BACK records: whether the requestor can see the referral comment
    visible_to_requestor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Referred approver's reply back to the referring approver (set when they approve back up)
    response_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    actioned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
