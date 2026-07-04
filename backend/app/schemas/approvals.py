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


class ApprovalRoleUpdate(BaseModel):
    """Partial update for an approver role."""
    name: str | None = None
    description: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


class ApprovalRoleResponse(BaseModel):
    """Approver role as returned from the API."""
    id: str
    name: str
    description: str | None
    display_order: int
    is_active: bool

    @classmethod
    def from_orm(cls, r: object) -> "ApprovalRoleResponse":
        from app.models.approvals import ApprovalRole
        assert isinstance(r, ApprovalRole)
        return cls(
            id=str(r.id),
            name=r.name,
            description=r.description,
            display_order=r.display_order,
            is_active=r.is_active,
        )


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
    end_date: date | No