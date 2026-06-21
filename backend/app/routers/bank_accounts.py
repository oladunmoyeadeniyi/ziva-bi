"""
ZivaBI — Bank Accounts register router.

Prefix:  /api/setup/bank-accounts
Tags:    bank-accounts

Endpoints:
    GET    /api/setup/bank-accounts         List all tenant bank accounts.
    POST   /api/setup/bank-accounts         Create a bank account.
    PUT    /api/setup/bank-accounts/{id}    Update a bank account.
    DELETE /api/setup/bank-accounts/{id}    Delete (hard if unreferenced, soft if referenced).

Guard: same admin pattern as other setup config (_require_admin + _require_tenant).

GL BS validation: the linked GL must have account_type in {BS, SOFP}.
Default handling: setting is_default=True unsets all other defaults for the same
  (tenant_id, currency) — enforced in app logic.
Delete strategy: hard-delete if no journal_lines reference this account;
  soft-delete (is_active=False) if journal lines reference it.

Currency reference: ISO 3-letter code stored as string — consistent with
  TenantFxConfig which also stores currencies as codes, not FK rows.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth, block_if_readonly_impersonation
from app.models.bank_account import BankAccount
from app.models.gl import JournalLine
from app.models.master_data import ChartOfAccount
from app.schemas.bank_account import BankAccountCreate, BankAccountResponse, BankAccountUpdate

router = APIRouter(prefix="/api/setup/bank-accounts", tags=["bank-accounts"])

# BS-equivalent account types (DB may use SOFP or BS)
_BS_TYPES = frozenset({"BS", "SOFP"})


# ── Guards ────────────────────────────────────────────────────────────────────

def _require_admin(current_user: CurrentUser) -> None:
    if not current_user.is_super_admin and current_user.role_tier != "power_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Admin access required.")
    block_if_readonly_impersonation(current_user)


def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Tenant context required.")
    return current_user.tenant_id


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_gl_or_422(
    gl_account_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ChartOfAccount:
    """Fetch + validate GL exists, belongs to tenant, is active, and is a BS account."""
    gl_res = await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.id == gl_account_id)
    )
    gl = gl_res.scalar_one_or_none()
    if gl is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"GL account {gl_account_id} does not exist.")
    if gl.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="GL account belongs to a different tenant.")
    if not gl.is_active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"GL account {gl.gl_number} is inactive.")
    if gl.account_type not in _BS_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Bank accounts must link to a Balance Sheet / SOFP GL account. "
                f"'{gl.gl_number}' ({gl.gl_name}) has type '{gl.account_type}'."
            ),
        )
    return gl


async def _unset_defaults(
    tenant_id: uuid.UUID,
    currency: str,
    exclude_id: Optional[uuid.UUID],
    db: AsyncSession,
) -> None:
    """Unset is_default for all bank accounts of this currency (excluding the one being set)."""
    q = select(BankAccount).where(
        BankAccount.tenant_id == tenant_id,
        BankAccount.currency == currency,
        BankAccount.is_default.is_(True),
    )
    if exclude_id:
        q = q.where(BankAccount.id != exclude_id)
    res = await db.execute(q)
    for acct in res.scalars().all():
        acct.is_default = False


def _to_response(acct: BankAccount, gl: ChartOfAccount) -> BankAccountResponse:
    return BankAccountResponse(
        id=str(acct.id),
        bank_name=acct.bank_name,
        account_name=acct.account_name,
        account_number=acct.account_number,
        currency=acct.currency,
        gl_account_id=str(acct.gl_account_id),
        gl_number=gl.gl_number,
        gl_name=gl.gl_name,
        gl_account_type=gl.account_type,
        is_default=acct.is_default,
        is_active=acct.is_active,
        created_at=acct.created_at,
        updated_at=acct.updated_at,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[BankAccountResponse])
async def list_bank_accounts(
    active_only: bool = False,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[BankAccountResponse]:
    """List all tenant bank accounts with GL detail. Ordered currency → bank_name."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    q = select(BankAccount, ChartOfAccount).join(
        ChartOfAccount, BankAccount.gl_account_id == ChartOfAccount.id
    ).where(BankAccount.tenant_id == tenant_id)
    if active_only:
        q = q.where(BankAccount.is_active.is_(True))
    q = q.order_by(BankAccount.currency, BankAccount.bank_name)

    rows = (await db.execute(q)).all()
    return [_to_response(acct, gl) for acct, gl in rows]


@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(
    data: BankAccountCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> BankAccountResponse:
    """Create a bank account. GL must be BS/SOFP. If is_default, unsets previous default."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    gl = await _get_gl_or_422(data.gl_account_id, tenant_id, db)

    if data.is_default:
        await _unset_defaults(tenant_id, data.currency, None, db)

    acct = BankAccount(
        tenant_id=tenant_id,
        bank_name=data.bank_name.strip(),
        account_name=data.account_name.strip(),
        account_number=data.account_number.strip(),
        currency=data.currency,
        gl_account_id=data.gl_account_id,
        is_default=data.is_default,
        is_active=True,
        created_by=current_user.user_id,
    )
    db.add(acct)
    await db.flush()
    return _to_response(acct, gl)


@router.put("/{acct_id}", response_model=BankAccountResponse)
async def update_bank_account(
    acct_id: uuid.UUID,
    data: BankAccountUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> BankAccountResponse:
    """Update a bank account. Validates GL on change; handles default unset."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    acct_res = await db.execute(
        select(BankAccount).where(BankAccount.id == acct_id,
                                  BankAccount.tenant_id == tenant_id)
    )
    acct = acct_res.scalar_one_or_none()
    if acct is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Bank account not found.")

    if data.bank_name is not None:
        acct.bank_name = data.bank_name.strip()
    if data.account_name is not None:
        acct.account_name = data.account_name.strip()
    if data.account_number is not None:
        acct.account_number = data.account_number.strip()
    if data.currency is not None:
        acct.currency = data.currency
    if data.is_active is not None:
        acct.is_active = data.is_active
    if data.gl_account_id is not None:
        await _get_gl_or_422(data.gl_account_id, tenant_id, db)
        acct.gl_account_id = data.gl_account_id
    if data.is_default is True:
        await _unset_defaults(tenant_id, acct.currency, acct_id, db)
        acct.is_default = True
    elif data.is_default is False:
        acct.is_default = False

    await db.flush()
    # Refresh the instance so server-side columns (updated_at set by onupdate=func.now()
    # in the UPDATE) are re-loaded asynchronously before _to_response reads them.
    # Without this, accessing acct.updated_at triggers a synchronous lazy-load inside
    # the async context, raising sqlalchemy.exc.MissingGreenlet.
    await db.refresh(acct)

    # Re-fetch GL for response
    gl_res = await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.id == acct.gl_account_id)
    )
    gl = gl_res.scalar_one()
    return _to_response(acct, gl)


@router.delete("/{acct_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_account(
    acct_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a bank account.

    Hard-delete if no journal lines reference this account.
    Soft-delete (is_active=False) if any journal lines reference it
    (to preserve the audit trail — lines would lose the bank_account_id via SET NULL
    on hard-delete, which loses reconciliation context).
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    acct_res = await db.execute(
        select(BankAccount).where(BankAccount.id == acct_id,
                                  BankAccount.tenant_id == tenant_id)
    )
    acct = acct_res.scalar_one_or_none()
    if acct is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Bank account not found.")

    # Check for referencing journal lines
    ref_res = await db.execute(
        select(JournalLine.id).where(
            JournalLine.bank_account_id == acct_id
        ).limit(1)
    )
    is_referenced = ref_res.scalar_one_or_none() is not None

    if is_referenced:
        acct.is_active = False
    else:
        await db.delete(acct)

    await db.flush()
