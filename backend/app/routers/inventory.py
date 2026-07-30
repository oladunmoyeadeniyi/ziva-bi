"""
Inventory & Warehouse router — M17 / M17b.

Routes:
    GET    /api/inventory/categories              — list categories
    POST   /api/inventory/categories              — create category
    PATCH  /api/inventory/categories/{id}         — update category

    GET    /api/inventory/locations               — list locations
    POST   /api/inventory/locations               — create location
    PATCH  /api/inventory/locations/{id}          — update location

    GET    /api/inventory/items                   — list items
    POST   /api/inventory/items                   — create item (FIFO / WACC / STANDARD)
    GET    /api/inventory/items/{id}              — item detail
    PATCH  /api/inventory/items/{id}              — update item master data
    GET    /api/inventory/items/{id}/cost-layers  — FIFO cost layers for an item

    GET    /api/inventory/movements               — list movements
    POST   /api/inventory/movements               — record movement (costing-method-aware)
    GET    /api/inventory/valuation               — stock valuation report

Costing methods — all three are fully implemented:

  WACC (Weighted Average Cost / Moving Average Cost):
    RECEIPT — MAC = (old_qty × old_mac + receipt_qty × cost) / (old_qty + receipt_qty)
    ISSUE   — COGS at current MAC

  FIFO (First In, First Out):
    RECEIPT — creates an InventoryCostLayer row for the lot
    ISSUE   — consumes layers oldest-first (by received_date then id);
              COGS = sum(consumed_qty × layer_unit_cost)

  STANDARD (Standard Costing):
    RECEIPT — inventory valued at standard_cost; actual purchase cost passed via unit_cost body
              field is used solely to compute Purchase Price Variance (PPV);
              Full ERP: PPV journal posted to gl_ppv_id if configured
    ISSUE   — COGS always at standard_cost, independent of actual receipt cost

Three-mode COGS / posting behaviour on ISSUE:
    Full ERP  → DR COGS / CR Inventory GL (via post_journal service)
    Connected → PostingBatch created for export to external ERP
    Lite      → quantity updates only; no GL posting

Standard costing PPV on RECEIPT (Full ERP only):
    Unfavorable (actual > standard): DR PPV / CR Inventory
    Favorable   (actual < standard): DR Inventory / CR PPV
"""

import uuid
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func as sqlfunc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth, require_module
from app.models.auth import UserTenant
from app.models.inventory import (
    InventoryCategory,
    InventoryCostLayer,
    InventoryItem,
    InventoryLocation,
    StockMovement,
)
from app.schemas.inventory import (
    InventoryCategoryCreate,
    InventoryCategoryResponse,
    InventoryCategoryUpdate,
    InventoryCostLayerResponse,
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

router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"],
    dependencies=[Depends(require_module("inventory"))],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tenant_id(user: UserTenant) -> uuid.UUID:
    """Extract tenant_id from the authenticated user context."""
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
    Compute the new weighted-average cost after a RECEIPT.

    WACC = (old_qty × old_mac + receipt_qty × receipt_cost) / (old_qty + receipt_qty)

    Args:
        old_qty:      Current stock quantity before this receipt.
        old_mac:      Current moving average cost before this receipt.
        receipt_qty:  Quantity received.
        receipt_cost: Per-unit cost of the incoming goods.

    Returns:
        New MAC rounded to 4 decimal places.
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
        select(InventoryCategory).where(
            InventoryCategory.id == category_id,
            InventoryCategory.tenant_id == tenant_id,
        )
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
            select(InventoryLocation).where(
                InventoryLocation.id == body.parent_id,
                InventoryLocation.tenant_id == tenant_id,
            )
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
        select(InventoryLocation).where(
            InventoryLocation.id == location_id,
            InventoryLocation.tenant_id == tenant_id,
        )
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
    """
    Create a new inventory item (SKU).

    All three valuation methods are supported: FIFO, WACC, STANDARD.
    For STANDARD items, standard_cost should reflect the budgeted cost per unit.
    """
    tenant_id = _tenant_id(current_user)

    # For STANDARD items, initialise moving_average_cost to standard_cost.
    # For WACC/FIFO, it starts at 0 and updates on first RECEIPT.
    initial_mac = body.standard_cost if body.valuation_method == "STANDARD" else Decimal("0")

    item = InventoryItem(
        tenant_id=tenant_id,
        moving_average_cost=initial_mac,
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


@router.get("/items/{item_id}/cost-layers", response_model=List[InventoryCostLayerResponse])
async def list_cost_layers(
    item_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    open_only: bool = Query(False, description="Return only layers with quantity_remaining > 0"),
) -> List[InventoryCostLayerResponse]:
    """
    Return FIFO cost layers for an item (oldest first).

    Useful for inspecting the lot structure of FIFO-method items:
    which receipt batches are still on hand, at what cost, and how much
    of each batch has already been consumed.

    Returns an empty list for WACC and STANDARD items (no layers are created
    for those methods).
    """
    tenant_id = _tenant_id(current_user)
    q = select(InventoryCostLayer).where(
        InventoryCostLayer.item_id == item_id,
        InventoryCostLayer.tenant_id == tenant_id,
    )
    if open_only:
        q = q.where(InventoryCostLayer.quantity_remaining > 0)
    q = q.order_by(InventoryCostLayer.received_date, InventoryCostLayer.id)
    result = await db.execute(q)
    return [InventoryCostLayerResponse.model_validate(layer) for layer in result.scalars().all()]


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
    Record a stock movement and update item balance.

    Costing logic depends on the item's valuation_method:

    WACC:
      RECEIPT — MAC updated; total_cost = qty × actual_cost
      ISSUE   — unit_cost = MAC; total_cost = qty × MAC

    FIFO:
      RECEIPT — cost layer created; total_cost = qty × actual_cost
      ISSUE   — layers consumed oldest-first; total_cost = Σ(consumed × layer_cost)

    STANDARD:
      RECEIPT — total_cost = qty × standard_cost (inventory at standard);
                body.unit_cost = actual purchase price (for PPV computation);
                PPV journal posted in Full ERP mode if gl_ppv_id configured
      ISSUE   — unit_cost = standard_cost; total_cost = qty × standard_cost

    GL posting on ISSUE (Full ERP): DR COGS / CR Inventory via post_journal().
    GL posting on ISSUE (Connected): PostingBatch created for external ERP export.
    """
    from app.models.setup import TenantOrgConfig

    tenant_id = _tenant_id(current_user)

    # Load item
    item_result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == body.item_id,
            InventoryItem.tenant_id == tenant_id,
        )
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
    if not item.is_active:
        raise HTTPException(status_code=400, detail="Cannot record movement for an inactive item.")

    mvt = body.movement_type
    qty = body.quantity
    actual_unit_cost = body.unit_cost  # actual purchase cost (relevant for FIFO/WACC RECEIPT and STANDARD PPV)
    method = item.valuation_method

    old_qty = item.current_quantity
    old_mac = item.moving_average_cost
    new_mac = old_mac
    total_cost = Decimal("0")
    unit_cost = actual_unit_cost  # may be overridden below per method
    new_qty = old_qty

    # ── Compute new quantity, unit_cost, total_cost, and new_mac ──────────────
    if mvt == "RECEIPT":
        new_qty = old_qty + qty

        if method == "WACC":
            if actual_unit_cost > 0:
                new_mac = _wacc_after_receipt(old_qty, old_mac, qty, actual_unit_cost)
            total_cost = qty * actual_unit_cost

        elif method == "FIFO":
            # Inventory valued at actual cost per lot; no MAC update (layers track cost)
            total_cost = qty * actual_unit_cost
            # new_mac unchanged — FIFO items do not use MAC for costing

        elif method == "STANDARD":
            # Standard costing: inventory at standard_cost; actual purchase price is used
            # only to compute Purchase Price Variance (PPV).  A missing or zero unit_cost
            # would produce a fabricated favorable PPV equal to the entire standard value
            # of the receipt — a financially incorrect GL entry.  Reject early.
            if actual_unit_cost <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Standard-costed items require the actual purchase cost (unit_cost) "
                        "on a RECEIPT movement so the system can compute Purchase Price Variance (PPV). "
                        "Please enter the actual unit cost paid to the supplier."
                    ),
                )
            # Inventory always valued at standard cost regardless of actual purchase price
            std = item.standard_cost
            unit_cost = std          # store standard cost on movement
            total_cost = qty * std
            new_mac = std            # keep MAC = standard for consistency

    elif mvt == "ISSUE":
        if old_qty < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock: {old_qty} {item.unit_of_measure} available, {qty} requested.",
            )
        new_qty = old_qty - qty

        if method == "WACC":
            # Issue at current MAC; body.unit_cost override allowed for corrections
            effective = old_mac if actual_unit_cost == 0 else actual_unit_cost
            unit_cost = effective
            total_cost = qty * effective

        elif method == "FIFO":
            # Consume cost layers oldest-first, with row-level lock
            layers_result = await db.execute(
                select(InventoryCostLayer)
                .where(
                    InventoryCostLayer.tenant_id == tenant_id,
                    InventoryCostLayer.item_id == item.id,
                    InventoryCostLayer.quantity_remaining > 0,
                )
                .order_by(InventoryCostLayer.received_date, InventoryCostLayer.id)
                .with_for_update()
            )
            layers = layers_result.scalars().all()

            remaining = qty
            cogs = Decimal("0")
            for layer in layers:
                if remaining <= 0:
                    break
                consume = min(layer.quantity_remaining, remaining)
                cogs += consume * layer.unit_cost
                layer.quantity_remaining -= consume
                remaining -= consume

            if remaining > Decimal("0"):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Insufficient FIFO cost layers. "
                        "Stock quantity and cost layers are inconsistent — contact support."
                    ),
                )
            total_cost = cogs
            # Weighted average of consumed lots (stored on movement for reporting)
            unit_cost = (cogs / qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        elif method == "STANDARD":
            # COGS always at standard cost
            std = item.standard_cost
            unit_cost = std
            total_cost = qty * std

    elif mvt == "ADJUSTMENT":
        new_qty = old_qty - qty
        if new_qty < 0:
            raise HTTPException(status_code=400, detail="Adjustment would result in negative stock.")
        total_cost = Decimal("0")
        unit_cost = Decimal("0")

    else:  # TRANSFER
        new_qty = old_qty  # no net change at tenant level
        total_cost = Decimal("0")
        unit_cost = Decimal("0")

    # ── Write the movement record ──────────────────────────────────────────────
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

    # ── FIFO RECEIPT: create cost layer ───────────────────────────────────────
    if mvt == "RECEIPT" and method == "FIFO" and actual_unit_cost > 0:
        # Flush to obtain movement.id before creating the layer FK
        await db.flush()
        layer = InventoryCostLayer(
            tenant_id=tenant_id,
            item_id=item.id,
            receipt_movement_id=movement.id,
            received_date=body.movement_date,
            unit_cost=actual_unit_cost,
            quantity_received=qty,
            quantity_remaining=qty,
        )
        db.add(layer)

    # ── GL posting (ISSUE) and Standard PPV (RECEIPT) ─────────────────────────
    if mvt in ("ISSUE", "RECEIPT"):
        mode_result = await db.execute(
            select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
        )
        posting_mode = mode_result.scalar_one_or_none() or "lite"

        # ISSUE: COGS journal (all methods)
        if mvt == "ISSUE" and total_cost > 0 and item.gl_cogs_id and item.gl_inventory_id:
            from app.services.gl_posting import post_journal
            from app.schemas.gl import JournalLineInput

            cogs_lines = [
                JournalLineInput(
                    gl_account_id=item.gl_cogs_id,
                    debit=total_cost,
                    credit=Decimal("0"),
                    description=f"COGS — {item.name} × {qty} {item.unit_of_measure} [{method}]",
                ),
                JournalLineInput(
                    gl_account_id=item.gl_inventory_id,
                    debit=Decimal("0"),
                    credit=total_cost,
                    description=f"Inventory — {item.name} [{method}]",
                ),
            ]

            if posting_mode == "full_erp":
                entry = await post_journal(
                    db, tenant_id,
                    entry_date=body.movement_date,
                    description=f"COGS — {item.name} × {qty} {item.unit_of_measure}",
                    source="inventory",
                    source_reference=body.reference or f"STK-ISSUE-{item.item_code}",
                    lines=cogs_lines,
                    created_by=current_user.user_id,
                    module="inventory",
                )
                movement.journal_entry_id = entry.id

            elif posting_mode == "connected":
                from app.models.gl import PostingBatch
                batch = PostingBatch(
                    tenant_id=tenant_id,
                    module="inventory",
                    batch_ref=f"INV-ISSUE-{item.item_code}-{body.movement_date.strftime('%Y%m%d')}",
                    status="pending",
                    transactions={
                        "movement_id": str(movement.id) if movement.id else None,
                        "item_code": item.item_code,
                        "item_name": item.name,
                        "movement_type": mvt,
                        "movement_date": str(body.movement_date),
                        "quantity": str(qty),
                        "unit_cost": str(unit_cost),
                        "total_cost": str(total_cost),
                        "valuation_method": method,
                        "gl_cogs_id": str(item.gl_cogs_id),
                        "gl_inventory_id": str(item.gl_inventory_id),
                    },
                )
                db.add(batch)

        # STANDARD RECEIPT: Purchase Price Variance journal
        if mvt == "RECEIPT" and method == "STANDARD" and posting_mode == "full_erp":
            std = item.standard_cost
            variance = (actual_unit_cost - std) * qty  # positive = unfavorable
            if variance != Decimal("0") and item.gl_ppv_id and item.gl_inventory_id:
                from app.services.gl_posting import post_journal
                from app.schemas.gl import JournalLineInput

                abs_var = abs(variance)
                if variance > 0:
                    # Unfavorable: actual > standard → DR PPV / CR Inventory
                    ppv_lines = [
                        JournalLineInput(
                            gl_account_id=item.gl_ppv_id,
                            debit=abs_var,
                            credit=Decimal("0"),
                            description=f"PPV unfavorable — {item.name} (actual {actual_unit_cost} vs std {std})",
                        ),
                        JournalLineInput(
                            gl_account_id=item.gl_inventory_id,
                            debit=Decimal("0"),
                            credit=abs_var,
                            description=f"Inventory PPV offset — {item.name}",
                        ),
                    ]
                else:
                    # Favorable: actual < standard → DR Inventory / CR PPV
                    ppv_lines = [
                        JournalLineInput(
                            gl_account_id=item.gl_inventory_id,
                            debit=abs_var,
                            credit=Decimal("0"),
                            description=f"Inventory favorable PPV — {item.name}",
                        ),
                        JournalLineInput(
                            gl_account_id=item.gl_ppv_id,
                            debit=Decimal("0"),
                            credit=abs_var,
                            description=f"PPV favorable — {item.name} (actual {actual_unit_cost} vs std {std})",
                        ),
                    ]

                ppv_entry = await post_journal(
                    db, tenant_id,
                    entry_date=body.movement_date,
                    description=f"PPV — {item.name} × {qty} {item.unit_of_measure}",
                    source="inventory",
                    source_reference=body.reference or f"PPV-{item.item_code}-{body.movement_date.strftime('%Y%m%d')}",
                    lines=ppv_lines,
                    created_by=current_user.user_id,
                    module="inventory",
                )
                movement.journal_entry_id = ppv_entry.id

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

    Unit cost and total value are computed per costing method:
      WACC     — unit_cost = moving_average_cost; total = qty × MAC
      FIFO     — unit_cost = sum(layer_remaining × layer_cost) / total_remaining_qty;
                 total = sum of all open layer values
      STANDARD — unit_cost = standard_cost; total = qty × standard_cost

    as_at is a label for the report date; the balances reflect the current
    stored state (not a historical point-in-time replay of the ledger).
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

    # ── Pre-fetch FIFO layer totals in one query ───────────────────────────────
    fifo_ids = [it.id for it in items if it.valuation_method == "FIFO"]
    fifo_values: dict[uuid.UUID, Decimal] = {}  # item_id → total remaining layer value
    if fifo_ids:
        layer_result = await db.execute(
            select(
                InventoryCostLayer.item_id,
                sqlfunc.sum(
                    InventoryCostLayer.quantity_remaining * InventoryCostLayer.unit_cost
                ).label("layer_value"),
            )
            .where(
                InventoryCostLayer.tenant_id == tenant_id,
                InventoryCostLayer.item_id.in_(fifo_ids),
                InventoryCostLayer.quantity_remaining > 0,
            )
            .group_by(InventoryCostLayer.item_id)
        )
        for row in layer_result.fetchall():
            fifo_values[row.item_id] = Decimal(str(row.layer_value)) if row.layer_value else Decimal("0")

    rows = []
    total_value = Decimal("0")

    for item in items:
        method = item.valuation_method

        if method == "STANDARD":
            unit_cost = item.standard_cost
            item_value = (item.current_quantity * unit_cost).quantize(Decimal("0.01"))

        elif method == "FIFO":
            fifo_total = fifo_values.get(item.id, Decimal("0"))
            item_value = fifo_total.quantize(Decimal("0.01"))
            unit_cost = (
                (fifo_total / item.current_quantity).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                if item.current_quantity > 0
                else Decimal("0")
            )

        else:  # WACC
            unit_cost = item.moving_average_cost
            item_value = (item.current_quantity * unit_cost).quantize(Decimal("0.01"))

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
            valuation_method=method,
            current_quantity=item.current_quantity,
            unit_cost=unit_cost,
            total_value=item_value,
            reorder_point=item.reorder_point,
            below_reorder=below_reorder,
        ))

    return StockValuationResponse(
        as_at=report_date,
        rows=rows,
        total_inventory_value=total_value,
    )
