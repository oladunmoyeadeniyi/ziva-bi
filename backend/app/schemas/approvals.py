"""
ZivaBI — approval workflow Pydantic schemas (Milestones 4–5 + Approval Engine).

Request/response shapes for the approvals router.
Covers: approval roles, approval policies, role thresholds, delegations,
approval matrix configuration, report submission, approver queue,
approve/reject/refer-back actions, audit trail, and snapshots.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator


# ── Approval Roles ────────────────────────────────────────────────────────────

class ApprovalRoleCreate(BaseModel):
    """Create a new approver role."""
    name: str
    description: str | None = None
    display_order: int = 0
    parent_role_id: uuid.UUID | None = None
    cost_center_id: uuid.UUID | None = None
    entity_node_id: uuid.UUID | None = None
    max_occupants: int | None = None  # None=unlimited, 1=solo, N=capped
    designation: str | None = None  # head_of_department | head_of_entity | None


class ApprovalRoleUpdate(BaseModel):
    """Partial update for an approver role."""
    name: str | None = None
    description: str | None = None
    display_order: int | None = None
    is_active: bool | None = None
    parent_role_id: uuid.UUID | None = None
    cost_center_id: uuid.UUID | None = None
    entity_node_id: uuid.UUID | None = None
    max_occupants: int | None = None
    designation: str | None = None


class ApprovalRoleResponse(BaseModel):
    """Approver role as returned from the API."""
    id: str
    name: str
    description: str | None
    display_order: int
    is_active: bool
    parent_role_id: str | None = None
    cost_center_id: str | None = None
    cost_center_name: str | None = None
    entity_node_id: str | None = None
    entity_code: str | None = None
    entity_name: str | None = None
    max_occupants: int | None = None
    designation: str | None = None

    @classmethod
    def from_orm(cls, r: object) -> "ApprovalRoleResponse":
        from app.models.approvals import ApprovalRole
        assert isinstance(r, ApprovalRole)
        cc_name = None
        if hasattr(r, "cost_center") and r.cost_center:
            cc_name = r.cost_center.name
        return cls(
            id=str(r.id),
            name=r.name,
            description=r.description,
            display_order=r.display_order,
            is_active=r.is_active,
            parent_role_id=str(r.parent_role_id) if r.parent_role_id else None,
            cost_center_id=str(r.cost_center_id) if r.cost_center_id else None,
            cost_center_name=cc_name,
            entity_node_id=str(r.entity_node_id) if r.entity_node_id else None,
            entity_code=r.entity_node.entity_code if (hasattr(r, "entity_node") and r.entity_node) else None,
            entity_name=r.entity_node.name if (hasattr(r, "entity_node") and r.entity_node) else None,
            max_occupants=r.max_occupants,
            designation=r.designation if hasattr(r, "designation") else None,
        )


class RoleBulkUploadResult(BaseModel):
    """Result from the bulk role upload endpoint."""
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[dict] = []


class EntityOption(BaseModel):
    """Lightweight entity node returned for role form dropdowns."""
    id: str
    name: str
    code: str
    entity_code: str | None = None


# ── Approval Policy ───────────────────────────────────────────────────────────

class ApprovalRoleThresholdIn(BaseModel):
    """One role threshold within a policy upsert payload."""
    approval_role_id: str
    max_amount: Decimal | None = None  # None = no limit / ceiling role


class ApprovalPolicyCreate(BaseModel):
    """Create or replace the approval policy for a module."""
    module: str
    routing_mode: str = "org_tree"  # org_tree | requestor_selects | direct_to_hod
    ceiling_role_id: str | None = None
    vacant_seat_behavior: str = "skip"  # skip | hold | escalate_to_fallback
    fallback_approver_id: str | None = None
    requires_finance_review: bool = True
    finance_levels: int = 0
    finance_l1_role_id: str | None = None
    finance_l2_role_id: str | None = None
    finance_l3_role_id: str | None = None
    finance_amount_threshold_l2: Decimal | None = None
    finance_amount_threshold_l3: Decimal | None = None
    thresholds: list[ApprovalRoleThresholdIn] = []

    @field_validator("routing_mode")
    @classmethod
    def validate_routing_mode(cls, v: str) -> str:
        if v not in ("org_tree", "requestor_selects", "direct_to_hod"):
            raise ValueError("routing_mode must be org_tree, requestor_selects, or direct_to_hod.")
        return v

    @field_validator("vacant_seat_behavior")
    @classmethod
    def validate_vacant(cls, v: str) -> str:
        if v not in ("skip", "hold", "escalate_to_fallback"):
            raise ValueError("vacant_seat_behavior must be skip, hold, or escalate_to_fallback.")
        return v

    @field_validator("finance_levels")
    @classmethod
    def validate_finance_levels(cls, v: int) -> int:
        if v not in (0, 1, 2, 3):
            raise ValueError("finance_levels must be 0, 1, 2, or 3.")
        return v


class ApprovalPolicyUpdate(BaseModel):
    """Partial update for an approval policy."""
    routing_mode: str | None = None
    ceiling_role_id: str | None = None
    vacant_seat_behavior: str | None = None
    fallback_approver_id: str | None = None
    requires_finance_review: bool | None = None
    finance_levels: int | None = None
    finance_l1_role_id: str | None = None
    finance_l2_role_id: str | None = None
    finance_l3_role_id: str | None = None
    finance_amount_threshold_l2: Decimal | None = None
    finance_amount_threshold_l3: Decimal | None = None
    is_active: bool | None = None
    thresholds: list[ApprovalRoleThresholdIn] | None = None  # None = don't touch thresholds


class ApprovalRoleThresholdResponse(BaseModel):
    """One threshold row as returned by the API."""
    id: str
    approval_role_id: str
    role_name: str
    max_amount: Decimal | None

    @classmethod
    def from_orm(cls, t: object) -> "ApprovalRoleThresholdResponse":
        from app.models.approvals import ApprovalRoleThreshold
        assert isinstance(t, ApprovalRoleThreshold)
        return cls(
            id=str(t.id),
            approval_role_id=str(t.approval_role_id),
            role_name=t.role.name if t.role else "",
            max_amount=t.max_amount,
        )


class ApprovalPolicyResponse(BaseModel):
    """Approval policy as returned by the API."""
    id: str
    tenant_id: str
    module: str
    routing_mode: str
    ceiling_role_id: str | None
    ceiling_role_name: str | None
    vacant_seat_behavior: str
    fallback_approver_id: str | None
    requires_finance_review: bool
    finance_levels: int
    finance_l1_role_id: str | None
    finance_l2_role_id: str | None
    finance_l3_role_id: str | None
    finance_amount_threshold_l2: Decimal | None
    finance_amount_threshold_l3: Decimal | None
    is_active: bool
    thresholds: list[ApprovalRoleThresholdResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, p: object) -> "ApprovalPolicyResponse":
        from app.models.approvals import ApprovalPolicy
        assert isinstance(p, ApprovalPolicy)
        return cls(
            id=str(p.id),
            tenant_id=str(p.tenant_id),
            module=p.module,
            routing_mode=p.routing_mode,
            ceiling_role_id=str(p.ceiling_role_id) if p.ceiling_role_id else None,
            ceiling_role_name=p.ceiling_role.name if p.ceiling_role else None,
            vacant_seat_behavior=p.vacant_seat_behavior,
            fallback_approver_id=str(p.fallback_approver_id) if p.fallback_approver_id else None,
            requires_finance_review=p.requires_finance_review,
            finance_levels=p.finance_levels,
            finance_l1_role_id=str(p.finance_l1_role_id) if p.finance_l1_role_id else None,
            finance_l2_role_id=str(p.finance_l2_role_id) if p.finance_l2_role_id else None,
            finance_l3_role_id=str(p.finance_l3_role_id) if p.finance_l3_role_id else None,
            finance_amount_threshold_l2=p.finance_amount_threshold_l2,
            finance_amount_threshold_l3=p.finance_amount_threshold_l3,
            is_active=p.is_active,
            thresholds=[ApprovalRoleThresholdResponse.from_orm(t) for t in (p.thresholds or [])],
            created_at=p.created_at,
            updated_at=p.updated_at,
        )


# ── Approval Chain Preview ────────────────────────────────────────────────────

class ChainPreviewStep(BaseModel):
    """One step in the computed chain preview returned to the submission form."""
    level: int
    name: str
    email: str
    role_label: str
    chain_type: str  # "management" | "finance"
    is_delegated: bool
    error: str | None = None


# ── Approval Delegation ───────────────────────────────────────────────────────

class ApprovalDelegationCreate(BaseModel):
    """Create a new approval delegation."""
    delegate_id: str
    start_date: date
    end_date: date | None = None
    reason: str | None = None

    @field_validator("delegate_id")
    @classmethod
    def validate_delegate(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("delegate_id must be a valid UUID.")
        return v


class ApprovalDelegationUpdate(BaseModel):
    """Update or revoke a delegation."""
    end_date: date | None = None
    is_active: bool | None = None
    reason: str | None = None


class ApprovalDelegationResponse(BaseModel):
    """Delegation record as returned by the API."""
    id: str
    delegator_id: str
    delegator_name: str
    delegate_id: str
    delegate_name: str
    start_date: date
    end_date: date | None
    is_active: bool
    reason: str | None
    created_at: datetime

    @classmethod
    def from_orm(cls, d: object, delegator_name: str, delegate_name: str) -> "ApprovalDelegationResponse":
        from app.models.approvals import ApprovalDelegation
        assert isinstance(d, ApprovalDelegation)
        return cls(
            id=str(d.id),
            delegator_id=str(d.delegator_id),
            delegator_name=delegator_name,
            delegate_id=str(d.delegate_id),
            delegate_name=delegate_name,
            start_date=d.start_date,
            end_date=d.end_date,
            is_active=d.is_active,
            reason=d.reason,
            created_at=d.created_at,
        )


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
    Payload for the expense submit endpoint.

    With ApprovalPolicy (routing engine):
      - org_tree / direct_to_hod: no fields needed — system auto-routes.
      - requestor_selects: provide selected_approver_id (must be above in hierarchy).

    Legacy (no policy configured, fallback to ApprovalMatrix):
      - Provide level1_approver_id (and level2/3 as applicable).

    For resubmissions, all fields are optional — the backend reuses previous approver IDs.
    """

    # New routing engine field
    selected_approver_id: uuid.UUID | None = None

    # Legacy matrix fields (kept for backward compat)
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
