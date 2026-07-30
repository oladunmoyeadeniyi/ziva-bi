"""
Fixed Assets router — M18.

Routes:
    GET    /api/assets/categories          — list categories
    POST   /api/assets/categories          — create category
    GET    /api/assets                     — list assets
    POST   /api/assets                     — create asset (generates schedule)
    GET    /api/assets/{id}                — asset detail
    GET    /api/assets/{id}/schedule       — depreciation schedule
    POST   /api/assets/{id}/run-dep        — run/post one month's depreciation
    POST   /api/assets/{id}/dispose        — record disposal
    GET    /api/assets/register            — full asset register report
"""

import uuid
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth, require_module
from app.models.auth import UserTenant
from app.models.fixed_assets import Asset, AssetCategory, AssetDepreciationSchedule, AssetDisposal
from app.schemas.fixed_assets import (
    AssetCategoryCreate,
    AssetCategoryResponse,
    AssetCreate,
    AssetResponse,
    DepreciationScheduleResponse,
    DisposalCreate,
    DisposalResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/assets",
    tags=["Fixed Assets"],
    dependencies=[Depends(require_module("fixed_assets"))],
)


def _tenant_id(user: UserTenant) -> uuid.UUID:
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context.")
    return tid


async def _next_asset_code(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    result = await db.execute(
        select(func.count(Asset.id)).where(Asset.tenant_id == tenant_id)
    )
    n = result.scalar_one() or 0
    return f"FA-{n + 1:04d}"


def _monthly_depreciation_sl(cost: Decimal, residual: Decimal, life_months: int) -> Decimal:
    """Straight-line monthly depreciation amount."""
    if life_months <= 0:
        return Decimal("0")
    return ((cost - residual) / Decimal(str(life_months))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _monthly_depreciation_rb(book_value: Decimal, cost: Decimal, residual: Decimal, life_months: int) -> Decimal:
    """Reducing balance monthly depreciation amount."""
    if life_months <= 0 or cost <= residual:
        return Decimal("0")
    # Monthly rate = 1 - (residual/cost)^(1/life_months)
    ratio = float(residual / cost) if cost > 0 else 0
    monthly_rate = 1 - ratio ** (1 / life_months)
    dep = book_value * Decimal(str(monthly_rate))
    return dep.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _generate_schedule(asset: Asset) -> list[dict]:
    """Pre-compute the full depreciation schedule for an asset."""
    schedule = []
    book_value = asset.acquisition_cost
    acc_dep = Decimal("0")
    dep_date = asset.acquisition_date.replace(day=1)

    for month in range(asset.useful_life_months):
        if book_value <= asset.residual_value:
            break
        if asset.depreciation_method == "SL":
            dep = _monthly_depreciation_sl(asset.acquisition_cost, asset.residual_value, asset.useful_life_months)
        else:
            dep = _monthly_depreciation_rb(book_value, asset.acquisition_cost, asset.residual_value, asset.useful_life_months)

        # Don't depreciate below residual
        dep = min(dep, book_value - asset.residual_value)
        acc_dep += dep
        book_value -= dep

        schedule.append({
            "schedule_date": dep_date,
            "depreciation_amount": dep,
            "accumulated_depreciation": acc_dep,
            "book_value_after": book_value,
        })

        # Next month
        if dep_date.month == 12:
            dep_date = dep_date.replace(year=dep_date.year + 1, month=1)
        else:
            dep_date = dep_date.replace(month=dep_date.month + 1)

    return schedule


# ── Asset Categories ──────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[AssetCategoryResponse])
async def list_asset_categories(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[AssetCategoryResponse]:
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(AssetCategory).where(AssetCategory.tenant_id == tenant_id).order_by(AssetCategory.name)
    )
    return [AssetCategoryResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/categories", response_model=AssetCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_asset_category(
    body: AssetCategoryCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> AssetCategoryResponse:
    tenant_id = _tenant_id(current_user)
    cat = AssetCategory(tenant_id=tenant_id, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return AssetCategoryResponse.model_validate(cat)


# ── Assets ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AssetResponse])
async def list_assets(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[uuid.UUID] = Query(None),
) -> list[AssetResponse]:
    tenant_id = _tenant_id(current_user)
    q = select(Asset).where(Asset.tenant_id == tenant_id)
    if status_filter:
        q = q.where(Asset.status == status_filter.upper())
    if category_id:
        q = q.where(Asset.category_id == category_id)
    q = q.order_by(Asset.asset_code)
    result = await db.execute(q.options(selectinload(Asset.category)))
    assets = result.scalars().all()
    return [
        AssetResponse(**{k: getattr(a, k) for k in AssetResponse.model_fields if hasattr(a, k)},
                      category_name=a.category.name if a.category else None)
        for a in assets
    ]


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(
    body: AssetCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> AssetResponse:
    """
    Create an asset and pre-generate its full depreciation schedule.
    """
    tenant_id = _tenant_id(current_user)
    asset_code = await _next_asset_code(db, tenant_id)

    # Get category defaults
    cat = await db.get(AssetCategory, body.category_id)
    if not cat or cat.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Asset category not found.")

    useful_life = body.useful_life_months or cat.useful_life_months
    dep_method = body.depreciation_method or cat.depreciation_method
    residual_pct = body.residual_pct if body.residual_pct is not None else cat.residual_pct
    residual_value = (body.acquisition_cost * residual_pct).quantize(Decimal("0.01"))

    asset = Asset(
        tenant_id=tenant_id,
        category_id=body.category_id,
        asset_code=asset_code,
        name=body.name,
        description=body.description,
        serial_number=body.serial_number,
        location=body.location,
        acquisition_date=body.acquisition_date,
        acquisition_cost=body.acquisition_cost,
        useful_life_months=useful_life,
        depreciation_method=dep_method,
        residual_value=residual_value,
        accumulated_depreciation=Decimal("0"),
        current_book_value=body.acquisition_cost,
        status="ACTIVE",
        currency=body.currency,
        vendor_id=body.vendor_id,
        ap_invoice_id=body.ap_invoice_id,
        department_id=body.department_id,
        created_by_id=current_user.user_id,
    )
    db.add(asset)
    await db.flush()

    # Generate depreciation schedule
    schedule = _generate_schedule(asset)
    for row in schedule:
        db.add(AssetDepreciationSchedule(
            asset_id=asset.id,
            tenant_id=tenant_id,
            schedule_date=row["schedule_date"],
            depreciation_amount=row["depreciation_amount"],
            accumulated_depreciation=row["accumulated_depreciation"],
            book_value_after=row["book_value_after"],
        ))

    await db.commit()
    await db.refresh(asset)
    return AssetResponse(**{k: getattr(asset, k) for k in AssetResponse.model_fields if hasattr(asset, k)},
                         category_name=cat.name)


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> AssetResponse:
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.tenant_id == tenant_id)
        .options(selectinload(Asset.category))
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return AssetResponse(**{k: getattr(asset, k) for k in AssetResponse.model_fields if hasattr(asset, k)},
                         category_name=asset.category.name if asset.category else None)


@router.get("/{asset_id}/schedule", response_model=list[DepreciationScheduleResponse])
async def get_depreciation_schedule(
    asset_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[DepreciationScheduleResponse]:
    """Get the pre-generated depreciation schedule for an asset."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(AssetDepreciationSchedule)
        .where(AssetDepreciationSchedule.asset_id == asset_id, AssetDepreciationSchedule.tenant_id == tenant_id)
        .order_by(AssetDepreciationSchedule.schedule_date)
    )
    return [DepreciationScheduleResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/{asset_id}/run-dep", response_model=DepreciationScheduleResponse)
async def run_monthly_depreciation(
    asset_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    dep_date: Optional[date] = Query(None),
) -> DepreciationScheduleResponse:
    """
    Post depreciation for one month.
    Uses the pre-generated schedule row for dep_date (defaults to current month).
    Full ERP: creates GL journal. Connected: creates posting_batch. Lite: updates book value.
    """
    from app.models.setup import TenantOrgConfig

    tenant_id = _tenant_id(current_user)
    period_date = dep_date or date.today().replace(day=1)

    # Get asset
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.tenant_id == tenant_id)
        .options(selectinload(Asset.category))
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    if asset.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Asset is {asset.status}, not ACTIVE.")

    # Get schedule row
    sched_result = await db.execute(
        select(AssetDepreciationSchedule).where(
            AssetDepreciationSchedule.asset_id == asset_id,
            AssetDepreciationSchedule.schedule_date == period_date.replace(day=1),
        )
    )
    sched = sched_result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail=f"No depreciation schedule for {period_date}.")
    if sched.is_posted:
        raise HTTPException(status_code=400, detail="This period has already been posted.")

    # Get posting mode
    mode_result = await db.execute(
        select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    posting_mode = mode_result.scalar_one_or_none() or "lite"

    cat = asset.category
    if cat and posting_mode in ("full_erp", "connected"):
        gl_dep = cat.gl_dep_expense_id
        gl_acc = cat.gl_accumulated_dep_id
        if gl_dep and gl_acc:
            from app.services.gl_posting import post_journal
            from app.schemas.gl import JournalLineInput
            dep_lines = [
                JournalLineInput(
                    gl_account_id=gl_dep,
                    debit=sched.depreciation_amount,
                    credit=Decimal("0"),
                    description=f"Dep expense — {asset.name}",
                ),
                JournalLineInput(
                    gl_account_id=gl_acc,
                    debit=Decimal("0"),
                    credit=sched.depreciation_amount,
                    description=f"Acc dep — {asset.name}",
                ),
            ]
            if posting_mode == "full_erp":
                entry = await post_journal(
                    db,
                    tenant_id,
                    entry_date=period_date,
                    description=f"Depreciation — {asset.name} ({period_date.strftime('%b %Y')})",
                    source="fixed_assets",
                    source_reference=f"DEP-{asset.asset_code}-{period_date.strftime('%Y%m')}",
                    lines=dep_lines,
                    created_by=current_user.user_id,
                    module="fixed_assets",
                )
                sched.journal_entry_id = entry.id
            else:  # connected — queue for external ERP export
                from app.models.gl import PostingBatch
                from sqlalchemy import func as sqlfunc
                batch_count_res = await db.execute(
                    select(sqlfunc.count(PostingBatch.id)).where(
                        PostingBatch.tenant_id == tenant_id,
                        PostingBatch.module == "fixed_assets",
                    )
                )
                batch_count = batch_count_res.scalar_one()
                batch = PostingBatch(
                    tenant_id=tenant_id,
                    batch_ref=f"BATCH-DEP-{period_date.strftime('%Y%m')}-{batch_count + 1:03d}",
                    module="fixed_assets",
                    status="pending",
                    transactions=[{
                        "entry_date": period_date.isoformat(),
                        "description": f"Depreciation — {asset.name} ({period_date.strftime('%b %Y')})",
                        "source_module": "fixed_assets",
                        "source_id": str(asset.id),
                        "lines": [
                            {"gl_account_id": str(gl_dep), "debit": float(sched.depreciation_amount), "credit": 0.0, "description": f"Dep expense — {asset.name}"},
                            {"gl_account_id": str(gl_acc), "debit": 0.0, "credit": float(sched.depreciation_amount), "description": f"Acc dep — {asset.name}"},
                        ],
                    }],
                )
                db.add(batch)

    # Mark posted and update asset book value
    sched.is_posted = True
    sched.posted_at = datetime.now(timezone.utc)
    asset.accumulated_depreciation = sched.accumulated_depreciation
    asset.current_book_value = sched.book_value_after
    if asset.current_book_value <= asset.residual_value:
        asset.status = "FULLY_DEPRECIATED"

    await db.commit()
    await db.refresh(sched)
    return DepreciationScheduleResponse.model_validate(sched)


@router.post("/{asset_id}/dispose", response_model=DisposalResponse)
async def dispose_asset(
    asset_id: uuid.UUID,
    body: DisposalCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> DisposalResponse:
    """Record an asset disposal (sale, write-off, donation, scrapped)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.tenant_id == tenant_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    if asset.status not in ("ACTIVE", "IMPAIRED"):
        raise HTTPException(status_code=400, detail=f"Cannot dispose an asset with status {asset.status}.")

    gain_loss = body.disposal_proceeds - asset.current_book_value
    disposal = AssetDisposal(
        asset_id=asset.id,
        tenant_id=tenant_id,
        disposal_date=body.disposal_date,
        disposal_type=body.disposal_type,
        disposal_proceeds=body.disposal_proceeds,
        book_value_at_disposal=asset.current_book_value,
        gain_loss=gain_loss,
        notes=body.notes,
        disposed_by_id=current_user.user_id,
    )
    db.add(disposal)
    asset.status = "DISPOSED"

    await db.commit()
    await db.refresh(disposal)
    return DisposalResponse.model_validate(disposal)
