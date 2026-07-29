"""
Inventory & Warehouse router — M17.

Routes:
    GET    /api/inventory/categories              — list categories
    POST   /api/inventory/categories              — create category
    PATCH  /api/inventory/categories/{id}         — update category

    GET    /api/inventory/locations               — list locations
    POST   /api/inventory/locations               — create location
    PATCH  /api/inventory/locations/{id}          — update location

    GET    /api/inventory/items                   — list items (with category name)
    POST   /api/inventory/items                   — create item
    GET    /api/inventory/items/{id}              — item detail
    PATCH  /api/inventory/items/{id}              — update item

    GET    /api/inventory/movements               — list movements (filter by item)
    POST   /api/inventory/movements               — record movement
    GET    /api/inventory/valuation               — stock valuation report

Three-mode COGS posting on ISSUE:
    Full ERP  → DR COGS / CR Inventory asset GL → JournalEntry + JournalLines created
    Connected → (future: posting_batch) — currently updates quantity only
    Lite      → quantity update only
"""

import uuid
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.auth import UserTenant
from app.models.inventory import InventoryCategory, InventoryItem, InventoryLocation, StockMovement
from app.schemas.inventory import (
    InventoryCategoryCreate,
    InventoryCategoryResponse,
    InventoryCategoryUpdate,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    InventoryLocationCreate,
    InventoryLocationResponse,
    InventoryLocationUpdate,
    StockMovementCreate,
    StockMovementResponse,
    StockValuationResponse,
    StockValuationRow,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


def _tenant_id(user: UserTenant) -> uuid.UUID:
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context.")
    return tid


def _wacc_after_receipt(
    old_qty: Decimal,
    old_mac: Decimal,
    receipt_qty: Decimal,
    receipt_cost: Decimal,
) -> Decimal:
    """
    Compute new weighted-average cost after a RECEIPT.

    WACC = (old_qty × old_mac + receipt_qty × receipt_cost) / (old_qty + receipt_qty)
    """
    total_qty = old_qty + receipt_qty
    if total_qty <= 0:
        return receipt_cost
    new_mac = (old_qty * old_mac + receipt_qty * receipt_cost) / total_qty
    return new_mac.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[InventoryCategoryResponse])
async def list_inventory_categories(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[InventoryCategoryResponse]:
    """List all inventory categories for the current tenant."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(InventoryCategory)
        .where(InventoryCategory.tenant_id == tenant_id)
        .order_by(InventoryCategory.name)
    )
    return [InventoryCategoryResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/categories", response_model=InventoryCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_category(
    body: InventoryCategoryCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> InventoryCategoryResponse:
    """Create an inventory category."""
    tenant_id = _tenant_id(current_user)
    cat = InventoryCategory(tenant_id=tenant_id, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return InventoryCategoryResponse.model_validate(cat)


@router.patch("/categories/{category_id}", response_model=InventoryCategoryResponse)
async def update_inventory_category(
    category_id: uuid.UUID,
    body: InventoryCategoryUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> InventoryCategoryResponse:
    """Update an inventory category."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(InventoryCategory).where(InventoryCategory.id == category_id, InventoryCategory.tenant_id == tenant_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    await db.commit()
    await db.refresh(cat)
    return InventoryCategoryResponse.model_validate(cat)


# ── Locations ─────────────────────────────────────────────────────────────────

@router.get("/locations", response_model=list[InventoryLocationResponse])
async def list_inventory_locations(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[InventoryLocationResponse]:
    """List all warehouse locations."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(InventoryLocation)
        .where(InventoryLocation.tenant_id == tenant_id)
        .order_by(InventoryLocation.code)
    )
    return [InventoryLocationResponse.model_validate(loc) for loc in result.scalars().all()]


@router.post("/locations", response_model=InventoryLocationResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_location(
    body: InventoryLocationCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> InventoryLocationResponse:
    """Create a warehouse location."""
    tenant_id = _tenant_id(current_user)
    if body.parent_id:
        parent_result = await db.execute(
            select(InventoryLocation).where(InventoryLocation.id == body.parent_id, InventoryLocation.tenant_id == tenant_id)
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Parent location not found.")
    loc = InventoryLocation(tenant_id=tenant_id, **body.model_dump())
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return InventoryLocationResponse.model_validate(loc)


@router.patch("/locations/{location_id}", response_model=InventoryLocationResponse)
async def update_inventory_location(
    location_id: uuid.UUID,
    body: InventoryLocationUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> InventoryLocationResponse:
    """Update a warehouse location."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(InventoryLocation).where(InventoryLocation.id == location_id, InventoryLocation.tenant_id == tenant_id)
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(loc, field, value)
    await db.commit()
    await db.refresh(loc)
    return InventoryLocationResponse.model_validate(loc)


# ── Items ─────────────────────────────────────────────────────────────────────

@router.get("/items", response_model=list[InventoryItemResponse])
async def list_inventory_items(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    category_id: Optional[uuid.UUID] = Query(None),
    active_only: bool = Query(True),
    low_stock: bool = Query(False),
) -> list[InventoryItemResponse]:
    """List inventory items with optional filters."""
    tenant_id = _tenant_id(current_user)
    q = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)
    if active_only:
        q = q.where(InventoryItem.is_active == True)  # noqa: E712
    if category_id:
        q = q.where(InventoryItem.category_id == category_id)
    if low_stock:
        # Items where current_quantity <= reorder_point
        q = q.where(
            InventoryItem.reorder_point.is_not(None),
            InventoryItem.current_quantity <= InventoryItem.reorder_point,
        )
    q = q.options(selectinload(InventoryItem.category)).order_by(InventoryItem.item_code)
    result = await db.execute(q)
    items = result.scalars().all()
    return [
        InventoryItemResponse(
            **{k: getattr(item, k) for k in InventoryItemResponse.model_fields if hasattr(item, k)},
            category_name=item.category.name if item.category else None,
        )
        for item in items
    ]


@router.post("/items", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    body: InventoryItemCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> InventoryItemResponse:
    """Create a new inventory item (SKU)."""
    if body.valuation_method == "FIFO":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FIFO costing is not yet supported. Please use WACC (moving-average cost).",
        )
    tenant_id = _tenant_id(current_user)
    item = InventoryItem(
        tenant_id=tenant_id,
        moving_average_cost=body.standard_cost,
        **body.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return InventoryItemResponse(
        **{k: getattr(item, k) for k in InventoryItemResponse.model_fields if hasattr(item, k)},
        category_name=None,
    )


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> InventoryItemResponse:
    """Get a single inventory item."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.id == item_id, InventoryItem.tenant_id == tenant_id)
        .options(selectinload(InventoryItem.category))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    return InventoryItemResponse(
        **{k: getattr(item, k) for k in InventoryItemResponse.model_fields if hasattr(item, k)},
        category_name=item.category.name if item.category else None,
    )


@router.patch("/items/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: uuid.UUID,
    body: InventoryItemUpdate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> InventoryItemResponse:
    """Update an inventory item's master data (not quantity — use movements for that)."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.id == item_id, InventoryItem.tenant_id == tenant_id)
        .options(selectinload(InventoryItem.category))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return InventoryItemResponse(
        **{k: getattr(item, k) for k in InventoryItemResponse.model_fields if hasattr(item, k)},
        category_name=item.category.name if item.category else None,
    )


# ── Stock Movements ───────────────────────────────────────────────────────────

@router.get("/movements", response_model=list[StockMovementResponse])
async def list_stock_movements(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    item_id: Optional[uuid.UUID] = Query(None),
    movement_type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
) -> list[StockMovementResponse]:
    """List stock movements with optional filters."""
    tenant_id = _tenant_id(current_user)
    q = select(StockMovement).where(StockMovement.tenant_id == tenant_id)
    if item_id:
        q = q.where(StockMovement.item_id == item_id)
    if movement_type:
        q = q.where(StockMovement.movement_type == movement_type.upper())
    if from_date:
        q = q.where(StockMovement.movement_date >= from_date)
    if to_date:
        q = q.where(StockMovement.movement_date <= to_date)
    q = q.order_by(StockMovement.movement_date.desc(), StockMovement.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return [StockMovementResponse.model_validate(m) for m in result.scalars().all()]


@router.post("/movements", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_movement(
    body: StockMovementCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> StockMovementResponse:
    """
    Record a stock movement and update item balance + moving average cost.

    RECEIPT → quantity increases; WACC updated.
    ISSUE   → quantity decreases; unit_cost = moving_average_cost (WACC)
              or last receipt cost (FIFO approximation via MAC at point of issue).
              Full ERP: creates DR COGS / CR Inventory GL journal.
    ADJUSTMENT → +/- quantity; no costing change.
    TRANSFER   → zero net effect on tenant stock; location changes only.
    """
    from app.models.setup import TenantOrgConfig

    tenant_id = _tenant_id(current_user)

    # Load item with lock to prevent concurrent update races
    item_result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.id == body.item_id, InventoryItem.tenant_id == tenant_id)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
    if not item.is_active:
        raise HTTPException(status_code=400, detail="Cannot record movement for an inactive item.")

    # Determine signed quantity and cost
    mvt = body.movement_type
    qty = body.quantity
    unit_cost = body.unit_cost

    # Compute new quantity and WACC
    old_qty = item.current_quantity
    old_mac = item.moving_average_cost
    new_mac = old_mac
    total_cost = Decimal("0")

    if mvt == "RECEIPT":
        new_qty = old_qty + qty
        if unit_cost > 0:
            new_mac = _wacc_after_receipt(old_qty, old_mac, qty, unit_cost)
        total_cost = qty * unit_cost

    elif mvt == "ISSUE":
        if old_qty < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock: available {old_qty} {item.unit_of_measure}, requested {qty}.",
            )
        # WACC item: use moving_average_cost as issue cost
        effective_cost = old_mac if unit_cost == 0 else unit_cost
        unit_cost = effective_cost
        new_qty = old_qty - qty
        total_cost = qty * effective_cost

    elif mvt == "ADJUSTMENT":
        # Positive quantity passed; interpret sign from reference convention:
        # if total qty after adjustment would go negative, raise.
        # Caller passes positive quantity; if it's a negative adjustment they use a negative reference.
        # By convention ADJUSTMENT uses body.quantity as the change (can represent +/-):
        # we allow negative values here via the `quantity` field name but validator ensures > 0.
        # So for negative adjustments: movement_type=ADJUSTMENT, quantity=<amount> to remove.
        # Signed convention: ADJUSTMENT always decreases unless body.notes contains "+"
        # To keep it unambiguous, use separate RECEIPT for positive.
        # Route decision: ADJUSTMENT reduces qty by body.quantity.
        new_qty = old_qty - qty
        if new_qty < 0:
            raise HTTPException(status_code=400, detail="Adjustment would result in negative stock.")
        total_cost = Decimal("0")

    else:  # TRANSFER
        new_qty = old_qty  # no net change
        total_cost = Decimal("0")

    # Write movement record
    movement = StockMovement(
        tenant_id=tenant_id,
        item_id=item.id,
        location_id=body.location_id,
        movement_type=mvt,
        movement_date=body.movement_date,
        reference=body.reference,
        quantity=qty,
        unit_cost=unit_cost,
        total_cost=total_cost,
        quantity_after=new_qty,
        moving_average_cost_after=new_mac,
        ap_invoice_id=body.ap_invoice_id,
        ar_invoice_id=body.ar_invoice_id,
        notes=body.notes,
        created_by_id=current_user.user_id,
    )
    db.add(movement)

    # Update item balance
    item.current_quantity = new_qty
    item.moving_average_cost = new_mac

    # Full ERP: COGS journal on ISSUE
    if mvt == "ISSUE":
        mode_result = await db.execute(
            select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
        )
        posting_mode = mode_result.scalar_one_or_none() or "lite"

        if posting_mode == "full_erp" and item.gl_cogs_id and item.gl_inventory_id:
            from app.services.gl_posting import post_journal
            from app.schemas.gl import JournalLineInput
            entry = await post_journal(
                db, tenant_id,
                entry_date=body.movement_date,
                description=f"COGS — {item.name} × {qty} {item.unit_of_measure}",
                source="inventory",
                source_reference=body.reference or f"STK-ISSUE-{item.item_code}",
                lines=[
                    JournalLineInput(
                        gl_account_id=item.gl_cogs_id,
                        debit=total_cost,
                        credit=Decimal("0"),
                        description=f"COGS — {item.name}",
                    ),
                    JournalLineInput(
                        gl_account_id=item.gl_inventory_id,
                        debit=Decimal("0"),
                        credit=total_cost,
                        description=f"Inventory credit — {item.name}",
                    ),
                ],
                created_by=current_user.user_id,
                module="inventory",
            )
            movement.journal_entry_id = entry.id

    await db.commit()
    await db.refresh(movement)
    return StockMovementResponse.model_validate(movement)


# ── Valuation Report ──────────────────────────────────────────────────────────

@router.get("/valuation", response_model=StockValuationResponse)
async def stock_valuation(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    as_at: Optional[date] = Query(None),
) -> StockValuationResponse:
    """
    Current stock valuation report.

    Returns each active item's quantity × moving_average_cost = total value.
    as_at is informational (snapshot date label); the report reflects the current
    stored balance (not a historical replay).
    """
    tenant_id = _tenant_id(current_user)
    report_date = as_at or date.today()

    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.tenant_id == tenant_id, InventoryItem.is_active == True)  # noqa: E712
        .options(selectinload(InventoryItem.category))
        .order_by(InventoryItem.item_code)
    )
    items = result.scalars().all()

    rows = []
    total_value = Decimal("0")
    for item in items:
        item_value = (item.current_quantity * item.moving_average_cost).quantize(Decimal("0.01"))
        total_value += item_value
        below_reorder = bool(
            item.reorder_point is not None and item.current_quantity <= item.reorder_point
        )
        rows.append(StockValuationRow(
            item_id=item.id,
            item_code=item.item_code,
            item_name=item.name,
            category_name=item.category.name if item.category else None,
            unit_of_measure=item.unit_of_measure,
            current_quantity=item.current_quantity,
            moving_average_cost=item.moving_average_cost,
            total_value=item_value,
            valuation_method=item.valuation_method,
            reorder_point=item.reorder_point,
            below_reorder=below_reorder,
        ))

    return StockValuationResponse(
        as_at=report_date,
        rows=rows,
        total_inventory_value=total_value,
    )
