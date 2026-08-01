"""Pydantic schemas for IxE — Inter-Company Eliminations.

Request/response models for group management, IC account mapping,
auto-matching, and elimination journal posting.

All UUIDs are serialised as strings in JSON responses.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


# ── Consolidation Group ───────────────────────────────────────────────────────

class ConsolidationGroupCreate(BaseModel):
    """Payload to create a new consolidation group.

    Args:
        name: Human-readable group name (unique per parent tenant).
        currency: ISO 4217 presentation currency (default NGN).
        ic_match_tolerance: Max tolerance for auto-matching (default 0).
    """

    name: str = Field(..., max_length=120)
    description: str | None = None
    currency: str = Field("NGN", max_length=3, min_length=3)
    ic_match_tolerance: Decimal = Field(Decimal("0"), ge=0)


class ConsolidationGroupUpdate(BaseModel):
    name: str | None = Field(None, max_length=120)
    description: str | None = None
    currency: str | None = Field(None, max_length=3, min_length=3)
    ic_match_tolerance: Decimal | None = Field(None, ge=0)
    is_active: bool | None = None


class ConsolidationGroupResponse(BaseModel):
    id: uuid.UUID
    parent_tenant_id: uuid.UUID
    name: str
    description: str | None
    currency: str
    ic_match_tolerance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


# ── Consolidation Members ─────────────────────────────────────────────────────

class ConsolidationMemberCreate(BaseModel):
    """Add a member entity to a group.

    Args:
        member_tenant_id: The subsidiary's tenant ID.
        ownership_pct: % owned by parent (0–100). Phase 1 requires 100.
        joined_at: Inclusion date (defaults to today).
    """

    member_tenant_id: uuid.UUID
    ownership_pct: Decimal = Field(Decimal("100.00"), ge=0, le=100)
    joined_at: date | None = None


class ConsolidationMemberResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    member_tenant_id: uuid.UUID
    ownership_pct: Decimal
    joined_at: date
    left_at: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── IC Account Mapping ────────────────────────────────────────────────────────

class IcAccountMappingCreate(BaseModel):
    """Tag a GL account with an intercompany role.

    Args:
        ic_role: One of RECEIVABLE | PAYABLE | REVENUE | EXPENSE | LOAN_ASSET | LOAN_LIABILITY.
        counterparty_tenant_id: Pin to a specific counterparty (null = any member).
    """

    gl_account_id: uuid.UUID
    ic_role: Literal["RECEIVABLE", "PAYABLE", "REVENUE", "EXPENSE", "LOAN_ASSET", "LOAN_LIABILITY"]
    counterparty_tenant_id: uuid.UUID | None = None


class IcAccountMappingResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    member_tenant_id: uuid.UUID
    gl_account_id: uuid.UUID
    ic_role: str
    counterparty_tenant_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── IC Matches ────────────────────────────────────────────────────────────────

class IcMatchConfirm(BaseModel):
    """Confirm or dispute a proposed IC match."""

    action: Literal["CONFIRM", "DISPUTE"]
    disputed_reason: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def reason_required_if_disputed(self) -> "IcMatchConfirm":
        if self.action == "DISPUTE" and not self.disputed_reason:
            raise ValueError("disputed_reason is required when action=DISPUTE")
        return self


class IcMatchResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    period_id: uuid.UUID
    debit_tenant_id: uuid.UUID
    debit_journal_line_id: uuid.UUID
    credit_tenant_id: uuid.UUID
    credit_journal_line_id: uuid.UUID
    matched_amount: Decimal
    status: str
    match_type: str
    matched_at: datetime
    confirmed_at: datetime | None
    confirmed_by: uuid.UUID | None
    disputed_reason: str | None

    model_config = {"from_attributes": True}


# ── Elimination Journals ──────────────────────────────────────────────────────

class EliminationLineIn(BaseModel):
    """A single line inside a manual elimination journal.

    Args:
        ic_match_id: Optional — links to the IC match that drove this line.
        debit / credit: Exactly one should be non-zero.
    """

    ic_match_id: uuid.UUID | None = None
    member_tenant_id: uuid.UUID
    gl_account_id: uuid.UUID
    debit: Decimal = Field(Decimal("0"), ge=0)
    credit: Decimal = Field(Decimal("0"), ge=0)
    narrative: str | None = None

    @model_validator(mode="after")
    def one_side_nonzero(self) -> "EliminationLineIn":
        if self.debit == 0 and self.credit == 0:
            raise ValueError("Each line must have a non-zero debit or credit")
        if self.debit > 0 and self.credit > 0:
            raise ValueError("A line cannot have both debit and credit")
        return self


class EliminationJournalCreate(BaseModel):
    """Post a new elimination journal.

    Args:
        period_id: The accounting period being eliminated.
        description: Free-text description.
        lines: Two or more lines; must balance (Σ debit = Σ credit).
    """

    period_id: uuid.UUID
    description: str = Field(..., max_length=500)
    lines: list[EliminationLineIn] = Field(..., min_length=2)

    @model_validator(mode="after")
    def must_balance(self) -> "EliminationJournalCreate":
        total_dr = sum(line.debit for line in self.lines)
        total_cr = sum(line.credit for line in self.lines)
        if total_dr != total_cr:
            raise ValueError(f"Journal does not balance: Σ debit={total_dr}, Σ credit={total_cr}")
        return self


class EliminationLineResponse(BaseModel):
    id: uuid.UUID
    elimination_journal_id: uuid.UUID
    ic_match_id: uuid.UUID | None
    member_tenant_id: uuid.UUID
    gl_account_id: uuid.UUID
    debit: Decimal
    credit: Decimal
    narrative: str | None

    model_config = {"from_attributes": True}


class EliminationJournalResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    period_id: uuid.UUID
    reference: str
    description: str
    total_dr: Decimal
    total_cr: Decimal
    status: str
    reversed_by: uuid.UUID | None
    posted_at: datetime
    posted_by: uuid.UUID
    lines: list[EliminationLineResponse]

    model_config = {"from_attributes": True}


# ── Consolidated Trial Balance ────────────────────────────────────────────────

class ConsolidatedTrialBalanceLine(BaseModel):
    """A single account row in the consolidated trial balance.

    Args:
        account_code: GL account code.
        account_name: GL account name.
        entity_balances: Dict mapping member_tenant_id → {debit, credit}.
        eliminations: Net elimination amount (negative = reversed).
        consolidated_debit: Sum after eliminations.
        consolidated_credit: Sum after eliminations.
    """

    account_code: str
    account_name: str
    entity_balances: dict[str, dict[str, Decimal]]
    eliminations_dr: Decimal
    eliminations_cr: Decimal
    consolidated_debit: Decimal
    consolidated_credit: Decimal


class ConsolidatedTrialBalanceResponse(BaseModel):
    group_id: uuid.UUID
    period_id: uuid.UUID
    currency: str
    lines: list[ConsolidatedTrialBalanceLine]
    total_debit: Decimal
    total_credit: Decimal
    ic_difference: Decimal  # Abs diff between matched IC positions (should be 0 after eliminations)
