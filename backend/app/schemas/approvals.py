"""
ZivaBI — approval workflow Pydantic schemas (Milestone 4).

Request/response shapes for the approvals router.
Covers: approval matrix configuration, report submission with approver selection,
approver queue, and approve/reject actions.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator


# ── Approval Matrix ───────────────────────────────────────────────────────────

class ApprovalMatrixCreate(BaseModel):
    """Payload to create or update a tenant's approval matrix."""

    levels: int
    level1_role: str
    level2_role: str | None = None
    level3_role: str | None = None
    amount_threshold_l2: Decimal | None = None
    amount_threshold_l3: Decimal | None = None

    @field_validator("levels")
    @classmethod
    def validate_levels(cls, v: int) -> int:
        if v not in (1, 2, 3):
            raise ValueError("Levels must be 1, 2, or 3.")
        return v

    @field_validator("level1_role")
    @classmethod
    def validate_l1_role(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Level 1 role label is required.")
        return v


class ApprovalMatrixResponse(BaseModel):
    """Tenant's approval matrix as returned by the API."""

    id: str
    tenant_id: str
    levels: int
    level1_role: str
    level2_role: str | None
    level3_role: str | None
    amount_threshold_l2: Decimal | None
    amount_threshold_l3: Decimal | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, m: Any) -> "ApprovalMatrixResponse":
        """Build from an ApprovalMatrix ORM instance."""
        return cls(
            id=str(m.id),
            tenant_id=str(m.tenant_id),
            levels=m.levels,
            level1_role=m.level1_role,
            level2_role=m.level2_role,
            level3_role=m.level3_role,
            amount_threshold_l2=m.amount_threshold_l2,
            amount_threshold_l3=m.amount_threshold_l3,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


# ── Submit with Approvers ─────────────────────────────────────────────────────

class SubmitWithApproversRequest(BaseModel):
    """
    Payload for the M4 submit endpoint.

    For first-time submissions, level1_approver_id is required (and level 2/3 when
    applicable based on matrix config and amount thresholds).

    For resubmissions (when expense_approvals records already exist for the report),
    all fields are optional — the backend reuses the approver IDs from the previous
    submission automatically.
    """

    level1_approver_id: uuid.UUID | None = None
    level2_approver_id: uuid.UUID | None = None
    level3_approver_id: uuid.UUID | None = None


# ── Approval Queue ────────────────────────────────────────────────────────────

class ApprovalQueueItem(BaseModel):
    """One row in the approver's pending-action queue or rejected history."""

    approval_id: str
    report_id: str
    report_number: str
    employee_name: str
    report_date: date
    total_amount: Decimal
    level: int
    level_label: str
    created_at: datetime
    rejection_comment: str | None = None  # populated for rejected items (Bug 3)


# ── Approval Record ───────────────────────────────────────────────────────────

class ApprovalRecordResponse(BaseModel):
    """One expense_approval row as returned in the report detail."""

    id: str
    level: int
    level_label: str
    approver_id: str
    approver_name: str
    status: str
    comment: str | None
    actioned_at: datetime | None
    created_at: datetime


# ── Approve / Reject ──────────────────────────────────────────────────────────

class ApproveRequest(BaseModel):
    """Optional comment when approving."""

    comment: str | None = None


class RejectRequest(BaseModel):
    """Rejection comment is mandatory."""

    comment: str

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Rejection comment is required.")
        return v


# ── Tenant User (for approver dropdowns) ─────────────────────────────────────

class TenantUserResponse(BaseModel):
    """Minimal user record returned for approver selection dropdowns."""

    id: str
    full_name: str
    email: str
