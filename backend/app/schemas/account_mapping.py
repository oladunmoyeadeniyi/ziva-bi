"""
ZivaBI — Account Determination Pydantic schemas (updated for catalogue redesign).
"""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class PostingRoleResponse(BaseModel):
    """
    One row from the posting_roles catalogue, enriched with the current
    tenant mapping and effective control-account flag.

    Taxonomy fields (statement → group → subgroup) drive the UI's nested layout.
    is_control_account        — catalogue default.
    is_control_account_override — None when no per-tenant override exists.
    is_control_account_effective — resolved value (override if set, else default).
    """

    role_key: str
    label: str
    statement: str                    # 'BS' | 'PL'
    group: str                        # statement-level grouping
    subgroup: Optional[str] = None    # finer collapsible grouping
    display_order: int
    expected_account_type: Optional[str]    # "BS" | "PL" | None
    is_control_account: bool                # catalogue default
    is_control_account_override: Optional[bool] = None  # None = no override set
    is_control_account_effective: bool      # resolved: override if set, else default
    # Relevance — cosmetic only; does NOT affect resolve_account/posting behaviour.
    is_relevant_override: Optional[bool] = None  # None = no override; False = hidden
    is_relevant_effective: bool = True     # False only when explicitly hidden (override=False)
    description: Optional[str] = None
    # Current tenant mapping — null when not yet configured
    gl_account_id: Optional[str] = None
    gl_number: Optional[str] = None
    gl_name: Optional[str] = None
    gl_account_type: Optional[str] = None


class AccountMappingUpsertRequest(BaseModel):
    """Body for PUT /api/setup/account-mapping/{role_key}."""

    gl_account_id: UUID


class AccountMappingResponse(BaseModel):
    """Returned after a successful PUT."""

    role_key: str
    gl_account_id: str
    gl_number: str
    gl_name: str
    account_type: str


class ControlOverrideRequest(BaseModel):
    """
    Body for PUT /api/setup/account-mapping/{role_key}/control.

    is_control_account: True / False → set override.
                        None          → clear override (revert to catalogue default).
    """

    is_control_account: Optional[bool]


class RelevanceRequest(BaseModel):
    """
    Body for PUT /api/setup/account-mapping/{role_key}/relevance.

    is_relevant: False → hide this role from the setup UI for this tenant.
                 True  → explicitly mark as relevant.
                 None  → clear override (revert to default: relevant).

    IMPORTANT: relevance is cosmetic setup-UX only. It does NOT block
    resolve_account() or posting. A module that posts to a role will still
    resolve it even when is_relevant_effective is False.
    """

    is_relevant: Optional[bool]
