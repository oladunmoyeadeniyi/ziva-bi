"""
ZivaBI — GL read endpoints (GL Engine #2).

Prefix:  /api/gl
Tags:    gl

Endpoints:
    GET /api/gl/trial-balance
        ?date_from=YYYY-MM-DD  &date_to=YYYY-MM-DD  &include_zero=false
        Returns per-account debit/credit/balance totals for POSTED entries,
        plus grand totals and an is_balanced integrity flag.

    GET /api/gl/accounts/{gl_account_id}/ledger
        ?date_from=YYYY-MM-DD  &date_to=YYYY-MM-DD
        &dimension_id=UUID  &dimension_value_id=UUID
        Returns opening balance, ordered ledger lines with running balance,
        and closing balance. Supports optional JSONB dimension filter.

Guard:
    require_auth + must-have-tenant check (_require_gl_user).
    Fine-grained "finance roles only" RBAC is future. For now any authenticated
    business user in the tenant can read GL data. Super admin impersonating also works
    (their tenant_id is the impersonated tenant's ID).
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.schemas.gl import AccountLedgerResponse, TrialBalanceResponse
from app.services.gl_reporting import account_ledger, trial_balance

router = APIRouter(prefix="/api/gl", tags=["gl"])


# ── Guard ─────────────────────────────────────────────────────────────────────

def _require_gl_user(current_user: CurrentUser) -> uuid.UUID:
    """
    Return the caller's tenant_id, or raise 403 if not in a tenant context.

    Any authenticated business user may read GL data. RBAC-gating to finance
    roles is a future enhancement.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="GL reports require a business account with a tenant context.",
        )
    return current_user.tenant_id


# ── Trial balance ─────────────────────────────────────────────────────────────

@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    date_from: Optional[date] = Query(None, description="Inclusive start date (YYYY-MM-DD)."),
    date_to: Optional[date] = Query(None, description="Inclusive end date (YYYY-MM-DD)."),
    include_zero: bool = Query(
        False,
        description="Include active accounts with zero activity in the date range.",
    ),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TrialBalanceResponse:
    """
    Compute the trial balance from POSTED journal lines.

    Returns per-account debit/credit totals and a net balance (debit − credit).
    Grand totals include an `is_balanced` flag — should always be True if the
    posting service enforced balance, but surfaced here as an integrity check.

    DRAFT and REVERSED entries are excluded.
    """
    tenant_id = _require_gl_user(current_user)
    return await trial_balance(
        db,
        tenant_id,
        date_from=date_from,
        date_to=date_to,
        include_zero=include_zero,
    )


# ── Account ledger ────────────────────────────────────────────────────────────

@router.get("/accounts/{gl_account_id}/ledger", response_model=AccountLedgerResponse)
async def get_account_ledger(
    gl_account_id: uuid.UUID,
    date_from: Optional[date] = Query(None, description="Start of period (inclusive)."),
    date_to: Optional[date] = Query(None, description="End of period (inclusive)."),
    dimension_id: Optional[uuid.UUID] = Query(
        None,
        description="Filter lines by this dimension (paired with dimension_value_id).",
    ),
    dimension_value_id: Optional[uuid.UUID] = Query(
        None,
        description="Filter lines to those with this dimension value.",
    ),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> AccountLedgerResponse:
    """
    Retrieve a per-account ledger for the given GL account.

    Returns:
      - Account header (gl_number, gl_name, account_type).
      - Opening balance: sum of debit−credit for POSTED lines before date_from
        (0 if no date_from supplied).
      - Lines in [date_from, date_to], ordered by entry_date then reference_number,
        each with a running_balance.
      - Closing balance = opening + Σ(debit−credit) for all returned lines.

    To filter by dimension: supply both `dimension_id` and `dimension_value_id`.
    Uses PostgreSQL JSONB @> containment — only lines whose dimensions column
    contains the specified pair are returned.

    Returns 404 if the account does not exist or belongs to a different tenant.
    """
    tenant_id = _require_gl_user(current_user)

    dim_filter: Optional[dict[str, str]] = None
    if dimension_id is not None and dimension_value_id is not None:
        dim_filter = {str(dimension_id): str(dimension_value_id)}
    elif (dimension_id is None) != (dimension_value_id is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide both dimension_id and dimension_value_id, or neither.",
        )

    result = await account_ledger(
        db,
        tenant_id,
        gl_account_id,
        date_from=date_from,
        date_to=date_to,
        dimension_filter=dim_filter,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"GL account {gl_account_id} not found or does not belong to this tenant.",
        )
    return result
