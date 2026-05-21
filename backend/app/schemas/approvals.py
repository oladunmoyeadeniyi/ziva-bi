"""
ZivaBI — approval workflow Pydantic schemas (Milestones 4–5).

Request/response shapes for the approvals router.
Covers: approval matrix configuration, report submission with approver selection,
approver queue, approve/reject/refer-back actions, audit trail, and snapshots.
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
    rejection_comment: str | None = None


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
    visible_to_requestor: bool
    response_comment: str | None
    actioned_at: datetime | None
    created_at: datetime


# ── Approve / Reject ──────────────────────────────────────────────────────────

class ApproveRequest(BaseModel):
    """Optional comment and response when approving."""

    comment: str | None = None
    # Response sent back to the referring approver when approving after a refer-back
    response_comment: str | None = None


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


# ── Refer Back ────────────────────────────────────────────────────────────────

class ReferBackRequest(BaseModel):
    """
    Payload for the refer-back action.

    target_type = "requestor": sends the report back to the employee for revision.
      The resubmission will resume from the referring approver's level.
    target_type = "approver": activates one or more lower approval levels for consultation.
      target_levels (list) allows referring to multiple levels simultaneously — they are
      visited sequentially in ascending order. After all complete, control returns to the
      referring level.
    visible_to_requestor: when true and target_type = "requestor", the requestor can see
      the referral comment. When false, they see "Pending internal review".
    comment is always required.
    """

    target_type: str
    target_levels: list[int] | None = None
    visible_to_requestor: bool = False
    comment: str

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: str) -> str:
        if v not in ("approver", "requestor"):
            raise ValueError('target_type must be "approver" or "requestor".')
        return v

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment is required.")
        return v


# ── Audit Trail ───────────────────────────────────────────────────────────────

class AuditLogEntry(BaseModel):
    """One audit log entry for the expense report timeline."""

    id: str
    event_type: str
    user_id: str | None
    actor_name: str
    log_metadata: dict
    created_at: datetime


# ── Snapshot ─────────────────────────────────────────────────────────────────

class SnapshotResponse(BaseModel):
    """A submitted expense report snapshot at a specific version."""

    id: str
    report_id: str
    version: int
    submitted_at: datetime
    snapshot_data: dict
    created_at: datetime


# ── Tenant User (for approver dropdowns) ─────────────────────────────────────

class TenantUserResponse(BaseModel):
    """Minimal user record returned for approver selection dropdowns."""

    id: str
    full_name: str
    email: str
