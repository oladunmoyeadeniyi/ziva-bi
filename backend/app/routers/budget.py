"""
Budget & Planning router — M16.

Endpoints:
    GET    /api/budgets                       — list budget periods
    POST   /api/budgets                       — create a new budget period
    GET    /api/budgets/{id}                  — get budget period with lines
    PUT    /api/budgets/{id}                  — update period metadata (DRAFT only)
    DELETE /api/budgets/{id}                  — delete period (DRAFT only)
    POST   /api/budgets/{id}/activate         — DRAFT → ACTIVE
    POST   /api/budgets/{id}/lock             — ACTIVE → LOCKED

    Budget lines (within a period):
    POST   /api/budgets/{id}/lines            — add/replace lines (upsert)
    PUT    /api/budgets/{id}/lines/{line_id}  — update a single line
    DELETE /api/budgets/{id}/lines/{line_id}  — delete a line (period must not be LOCKED)

    Variance report:
    GET    /api/budgets/{id}/variance         — compute variance vs actuals
"""

import uuid
import logging
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.auth import UserTenant
from app.models.budget import BudgetLine, BudgetPeriod
from app.models.master_data import ChartOfAccount
from app.schemas.budget import (
    BudgetLineIn,
    BudgetLineOut,
    BudgetPeriodCreate,
    BudgetPeriodListItem,
    BudgetPeriodResponse,
    BudgetPeriodUpdate,
    BudgetVarianceResponse,
)
from app.services.budget_service import compute_variance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/budgets", tags=["Budget & Planning"])


# ── Auth helper ───────────────────────────────────────────────────────────────

def _tenant_id(user: UserTenant) -> uuid.UUID:
    """Return tenant_id or raise 400 if user has no tenant context."""
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tenant context.")
    return tid


# ── GL enrichment helper ──────────────────────────────────────────────────────

async def _enrich_line(line: BudgetLine, db: AsyncSession) -> BudgetLineOut:
    """Attach gl_code + gl_name to a BudgetLine for API responses."""
    gl_code: Optional[str] = None
    gl_name: Optional[str] = None
    if line.gl_account_id:
        acc = await db.get(ChartOfAccount, line.gl_account_id)
        if acc:
            gl_code = acc.account_code
            gl_name = acc.account_name
    return BudgetLineOut(
        id=line.id,
        budget_period_id=line.budget_period_id,
        gl_account_id=line.gl_account_id,
        gl_code=gl_code,
        gl_name=gl_name,
        department_id=line.department_id,
        department_name=None,
        description=line.description,
        annual_amount=line.annual_amount,
        monthly_allocations=line.monthly_allocations,
        notes=line.notes,
        created_at=line.created_at,
        updated_at=line.updated_at,
    )


# ── List budget periods ────────────────────────────────────────────────────────

@router.get("", response_model=list[BudgetPeriodListItem])
async def list_budget_periods(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    fiscal_year: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
) -> list[BudgetPeriodListItem]:
    """
    List budget periods for the current tenant.

    Args:
        fiscal_year:   Filter by year.
        status_filter: Filter by DRAFT | ACTIVE | LOCKED.
    """
    tenant_id = _tenant_id(current_user)
    q = select(BudgetPeriod).where(BudgetPeriod.tenant_id == tenant_id)
    if fiscal_year:
        q = q.where(BudgetPeriod.fiscal_year == fiscal_year)
    if status_filter:
        q = q.where(BudgetPeriod.status == status_filter.upper())
    q = q.order_by(BudgetPeriod.fiscal_year.desc(), BudgetPeriod.period_start.desc())

    result = await db.execute(q.options(selectinload(BudgetPeriod.lines)))
    periods = result.scalars().all()

    items = []
    for p in periods:
        total = sum(ln.annual_amount for ln in p.lines)
        items.append(
            BudgetPeriodListItem(
                id=p.id,
                name=p.name,
                fiscal_year=p.fiscal_year,
                period_start=p.period_start,
                period_end=p.period_end,
                status=p.status,
                line_count=len(p.lines),
                total_budget=total,
                created_at=p.created_at,
            )
        )
    return items


# ── Create budget period ───────────────────────────────────────────────────────

@router.post("", response_model=BudgetPeriodResponse, status_code=status.HTTP_201_CREATED)
async def create_budget_period(
    body: BudgetPeriodCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> BudgetPeriodResponse:
    """
    Create a new budget period in DRAFT status.
    Optionally include initial lines in the request body.
    """
    tenant_id = _tenant_id(current_user)

    period = BudgetPeriod(
        tenant_id=tenant_id,
        name=body.name,
        fiscal_year=body.fiscal_year,
        period_start=body.period_start,
        period_end=body.period_end,
        status="DRAFT",
        description=body.description,
        created_by_id=current_user.user_id,
    )
    db.add(period)
    await db.flush()

    # Create initial lines if provided
    for line_in in (body.lines or []):
        line = BudgetLine(
            budget_period_id=period.id,
            tenant_id=tenant_id,
            gl_account_id=line_in.gl_account_id,
            department_id=line_in.department_id,
            description=line_in.description,
            annual_amount=line_in.annual_amount,
            monthly_allocations={k: str(v) for k, v in line_in.monthly_allocations.items()} if line_in.monthly_allocations else None,
            notes=line_in.notes,
        )
        db.add(line)

    await db.commit()
    await db.refresh(period)

    # Reload with lines
    result = await db.execute(
        select(BudgetPeriod)
        .where(BudgetPeriod.id == period.id)
        .options(selectinload(BudgetPeriod.lines))
    )
    period = result.scalar_one()
    enriched_lines = [await _enrich_line(ln, db) for ln in period.lines]

    return BudgetPeriodResponse(
        id=period.id,
        name=period.name,
        fiscal_year=period.fiscal_year,
        period_start=period.period_start,
        period_end=period.period_end,
        status=period.status,
        description=period.description,
        created_by_id=period.created_by_id,
        approved_by_id=period.approved_by_id,
        approved_at=period.approved_at,
        created_at=period.created_at,
        updated_at=period.updated_at,
        lines=enriched_lines,
    )


# ── Get budget period ──────────────────────────────────────────────────────────

@router.get("/{period_id}", response_model=BudgetPeriodResponse)
async def get_budget_period(
    period_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> BudgetPeriodResponse:
    """Get a budget period by ID including all lines."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetPeriod)
        .where(BudgetPeriod.id == period_id, BudgetPeriod.tenant_id == tenant_id)
        .options(selectinload(BudgetPeriod.lines))
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found.")

    enriched_lines = [await _enrich_line(ln, db) for ln in period.lines]
    return BudgetPeriodResponse(
        id=period.id,
        name=period.name,
        fiscal_year=period.fiscal_year,
        period_start=period.period_start,
        period_end=period.period_end,
        status=period.status,
        description=period.description,
        created_by_id=period.created_by_id,
        approved_by_id=period.approved_by_id,
        approved_at=period.approved_at,
        created_at=period.created_at,
        updated_at=period.updated_at,
        lines=enriched_lines,
    )


# ── Update period metadata ────────────────────────────────────────────────────

@router.put("/{period_id}", response_model=BudgetPeriodResponse)
async def update_budget_period(
    period_id: uuid.UUID,
    body: BudgetPeriodUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> BudgetPeriodResponse:
    """Update budget period name / description / dates. Only DRAFT periods can be changed."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetPeriod)
        .where(BudgetPeriod.id == period_id, BudgetPeriod.tenant_id == tenant_id)
        .options(selectinload(BudgetPeriod.lines))
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found.")
    if period.status == "LOCKED":
        raise HTTPException(status_code=400, detail="Cannot edit a LOCKED budget period.")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(period, field, val)

    await db.commit()
    await db.refresh(period)

    enriched_lines = [await _enrich_line(ln, db) for ln in period.lines]
    return BudgetPeriodResponse(
        id=period.id,
        name=period.name,
        fiscal_year=period.fiscal_year,
        period_start=period.period_start,
        period_end=period.period_end,
        status=period.status,
        description=period.description,
        created_by_id=period.created_by_id,
        approved_by_id=period.approved_by_id,
        approved_at=period.approved_at,
        created_at=period.created_at,
        updated_at=period.updated_at,
        lines=enriched_lines,
    )


# ── Delete period ─────────────────────────────────────────────────────────────

@router.delete("/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_period(
    period_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a budget period. Only DRAFT periods can be deleted."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetPeriod).where(
            BudgetPeriod.id == period_id, BudgetPeriod.tenant_id == tenant_id
        )
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found.")
    if period.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT budget periods can be deleted.")
    await db.delete(period)
    await db.commit()


# ── Activate / Lock ───────────────────────────────────────────────────────────

@router.post("/{period_id}/activate", response_model=BudgetPeriodResponse)
async def activate_budget_period(
    period_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> BudgetPeriodResponse:
    """Transition a DRAFT budget period to ACTIVE."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetPeriod)
        .where(BudgetPeriod.id == period_id, BudgetPeriod.tenant_id == tenant_id)
        .options(selectinload(BudgetPeriod.lines))
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found.")
    if period.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot activate a {period.status} period.")
    if not period.lines:
        raise HTTPException(status_code=400, detail="Budget period has no lines. Add at least one line before activating.")

    period.status = "ACTIVE"
    period.approved_by_id = current_user.user_id
    from datetime import datetime, timezone
    period.approved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(period)

    enriched_lines = [await _enrich_line(ln, db) for ln in period.lines]
    return BudgetPeriodResponse(
        id=period.id, name=period.name, fiscal_year=period.fiscal_year,
        period_start=period.period_start, period_end=period.period_end,
        status=period.status, description=period.description,
        created_by_id=period.created_by_id, approved_by_id=period.approved_by_id,
        approved_at=period.approved_at, created_at=period.created_at,
        updated_at=period.updated_at, lines=enriched_lines,
    )


@router.post("/{period_id}/lock", response_model=BudgetPeriodResponse)
async def lock_budget_period(
    period_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> BudgetPeriodResponse:
    """Transition an ACTIVE budget period to LOCKED (read-only)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetPeriod)
        .where(BudgetPeriod.id == period_id, BudgetPeriod.tenant_id == tenant_id)
        .options(selectinload(BudgetPeriod.lines))
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found.")
    if period.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Cannot lock a {period.status} period.")

    period.status = "LOCKED"
    await db.commit()
    await db.refresh(period)

    enriched_lines = [await _enrich_line(ln, db) for ln in period.lines]
    return BudgetPeriodResponse(
        id=period.id, name=period.name, fiscal_year=period.fiscal_year,
        period_start=period.period_start, period_end=period.period_end,
        status=period.status, description=period.description,
        created_by_id=period.created_by_id, approved_by_id=period.approved_by_id,
        approved_at=period.approved_at, created_at=period.created_at,
        updated_at=period.updated_at, lines=enriched_lines,
    )


# ── Budget Lines ──────────────────────────────────────────────────────────────

@router.post("/{period_id}/lines", response_model=list[BudgetLineOut], status_code=status.HTTP_201_CREATED)
async def upsert_budget_lines(
    period_id: uuid.UUID,
    lines_in: list[BudgetLineIn],
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[BudgetLineOut]:
    """
    Add or update budget lines for a period.
    Sends a list of lines; existing lines with matching (gl_account_id, department_id) are updated.
    New combinations are inserted.  Period must not be LOCKED.
    """
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetPeriod)
        .where(BudgetPeriod.id == period_id, BudgetPeriod.tenant_id == tenant_id)
        .options(selectinload(BudgetPeriod.lines))
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found.")
    if period.status == "LOCKED":
        raise HTTPException(status_code=400, detail="Cannot modify lines of a LOCKED budget period.")

    # Build lookup of existing lines
    existing: dict[tuple, BudgetLine] = {
        (str(ln.gl_account_id), str(ln.department_id)): ln
        for ln in period.lines
    }

    new_lines = []
    for line_in in lines_in:
        key = (str(line_in.gl_account_id), str(line_in.department_id))
        if key in existing:
            ln = existing[key]
            ln.description = line_in.description
            ln.annual_amount = line_in.annual_amount
            ln.monthly_allocations = {k: str(v) for k, v in line_in.monthly_allocations.items()} if line_in.monthly_allocations else None
            ln.notes = line_in.notes
            new_lines.append(ln)
        else:
            ln = BudgetLine(
                budget_period_id=period_id,
                tenant_id=tenant_id,
                gl_account_id=line_in.gl_account_id,
                department_id=line_in.department_id,
                description=line_in.description,
                annual_amount=line_in.annual_amount,
                monthly_allocations={k: str(v) for k, v in line_in.monthly_allocations.items()} if line_in.monthly_allocations else None,
                notes=line_in.notes,
            )
            db.add(ln)
            new_lines.append(ln)

    await db.commit()
    return [await _enrich_line(ln, db) for ln in new_lines]


@router.put("/{period_id}/lines/{line_id}", response_model=BudgetLineOut)
async def update_budget_line(
    period_id: uuid.UUID,
    line_id: uuid.UUID,
    body: BudgetLineIn,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> BudgetLineOut:
    """Update a single budget line. Period must not be LOCKED."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetLine).where(
            BudgetLine.id == line_id,
            BudgetLine.budget_period_id == period_id,
            BudgetLine.tenant_id == tenant_id,
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Budget line not found.")

    # Check period not locked
    period = await db.get(BudgetPeriod, period_id)
    if period and period.status == "LOCKED":
        raise HTTPException(status_code=400, detail="Cannot modify lines of a LOCKED budget period.")

    line.description = body.description
    line.annual_amount = body.annual_amount
    line.monthly_allocations = {k: str(v) for k, v in body.monthly_allocations.items()} if body.monthly_allocations else None
    line.notes = body.notes
    await db.commit()
    return await _enrich_line(line, db)


@router.delete("/{period_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_line(
    period_id: uuid.UUID,
    line_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a budget line. Period must not be LOCKED."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(BudgetLine).where(
            BudgetLine.id == line_id,
            BudgetLine.budget_period_id == period_id,
            BudgetLine.tenant_id == tenant_id,
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Budget line not found.")
    period = await db.get(BudgetPeriod, period_id)
    if period and period.status == "LOCKED":
        raise HTTPException(status_code=400, detail="Cannot delete lines from a LOCKED budget period.")
    await db.delete(line)
    await db.commit()


# ── Variance Report ───────────────────────────────────────────────────────────

@router.get("/{period_id}/variance", response_model=BudgetVarianceResponse)
async def get_variance_report(
    period_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    as_at_date: Optional[date] = Query(None),
) -> BudgetVarianceResponse:
    """
    Compute budget vs actuals variance for a period.

    Args:
        as_at_date: Cut-off date for actuals (defaults to today).

    Returns:
        BudgetVarianceResponse with per-line rows and grand totals.
    """
    from datetime import datetime, timezone
    from app.models.setup import TenantOrgConfig

    tenant_id = _tenant_id(current_user)
    as_at = as_at_date or date.today()

    result = await db.execute(
        select(BudgetPeriod)
        .where(BudgetPeriod.id == period_id, BudgetPeriod.tenant_id == tenant_id)
        .options(selectinload(BudgetPeriod.lines))
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found.")

    # Get posting mode
    mode_result = await db.execute(
        select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    posting_mode = mode_result.scalar_one_or_none() or "full_erp"

    return await compute_variance(db, period, as_at, posting_mode)
