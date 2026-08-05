"""Store Issuance & Returns router — /api/stores.

What this module does:
  Provides endpoints for the internal stores (consumables) module.
  The store keeper records all issuances and returns directly — no employee self-service.

  GET  /api/stores/items              — list inventory items marked as store items
  PATCH /api/stores/items/{id}/config — mark item as store item; set min stock + reorder qty
  GET  /api/stores/issues             — list recent issues (tenant-scoped)
  POST /api/stores/issues             — record a new issue (posts OUT stock movement)
  POST /api/stores/issues/{id}/return — record a return against a specific issue
  POST /api/stores/returns            — record a freestanding return (no original issue ref)
  GET  /api/stores/returns            — list all returns
  GET  /api/stores/analytics          — per-item usage analytics

How it connects:
  All stock movements are posted to stock_movements (inventory module) so current_stock
  on inventory_items stays accurate. We use movement_type="OUT" for issues and "IN" for returns.

Security:
  Requires authenticated user (get_current_user). All queries are scoped to tenant_id.
"""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth

from app.schemas.stores import (
    StoreAnalyticsItem,
    StoreIssueCreate,
    StoreIssueRead,
    StoreItemConfig,
    StoreReturnCreate,
    StoreReturnRead,
)

router = APIRouter(prefix="/api/stores", tags=["stores"])


# ── List store items ──────────────────────────────────────────────────────────

@router.get("/items")
async def list_store_items(
    search: Optional[str] = None,
    below_min: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Return all inventory items flagged as store items, with current stock."""
    q = text("""
        SELECT
            ii.id,
            ii.item_name,
            ii.item_code,
            ii.unit_of_measure,
            ii.current_stock,
            ii.is_store_item,
            ii.minimum_stock_level,
            ii.reorder_quantity
        FROM inventory_items ii
        WHERE ii.tenant_id = :tid
          AND ii.is_store_item = true
          AND (:search IS NULL OR ii.item_name ILIKE :search OR ii.item_code ILIKE :search)
          AND (:below_min = false OR (ii.minimum_stock_level IS NOT NULL AND ii.current_stock < ii.minimum_stock_level))
        ORDER BY ii.item_name
    """)
    rows = (await db.execute(q, {
        "tid": current_user.tenant_id,
        "search": f"%{search}%" if search else None,
        "below_min": below_min,
    })).mappings().all()
    return [dict(r) for r in rows]


# ── Configure a store item ────────────────────────────────────────────────────

@router.patch("/items/{item_id}/config")
async def configure_store_item(
    item_id: str,
    body: StoreItemConfig,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Mark an inventory item as a store item and set min stock / reorder qty."""
    result = await db.execute(
        text("SELECT id FROM inventory_items WHERE id = :id AND tenant_id = :tid"),
        {"id": item_id, "tid": current_user.tenant_id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Inventory item not found")

    await db.execute(
        text("""
            UPDATE inventory_items
            SET is_store_item = :is_store, minimum_stock_level = :min_stock, reorder_quantity = :reorder_qty
            WHERE id = :id AND tenant_id = :tid
        """),
        {
            "id": item_id,
            "tid": current_user.tenant_id,
            "is_store": body.is_store_item,
            "min_stock": body.minimum_stock_level,
            "reorder_qty": body.reorder_quantity,
        },
    )
    await db.commit()
    return {"ok": True}


# ── List issues ───────────────────────────────────────────────────────────────

@router.get("/issues")
async def list_issues(
    item_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """List store issues with optional filters."""
    q = text("""
        SELECT
            si.id, si.inventory_item_id, si.employee_id,
            si.department, si.location_name,
            si.quantity_issued, si.unit_of_measure, si.issue_date,
            si.purpose, si.reference, si.notes, si.created_at,
            ii.item_name, ii.item_code,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name
        FROM store_issues si
        JOIN inventory_items ii ON ii.id = si.inventory_item_id
        LEFT JOIN employees e ON e.id = si.employee_id
        WHERE si.tenant_id = :tid
          AND (:item_id IS NULL OR si.inventory_item_id = :item_id)
          AND (:emp_id IS NULL OR si.employee_id = :emp_id)
          AND (:from_date IS NULL OR si.issue_date >= :from_date)
          AND (:to_date IS NULL OR si.issue_date <= :to_date)
        ORDER BY si.issue_date DESC, si.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    rows = (await db.execute(q, {
        "tid": current_user.tenant_id,
        "item_id": item_id,
        "emp_id": employee_id,
        "from_date": from_date,
        "to_date": to_date,
        "limit": limit,
        "offset": offset,
    })).mappings().all()
    return [dict(r) for r in rows]


# ── Record an issue ───────────────────────────────────────────────────────────

@router.post("/issues", status_code=201)
async def create_issue(
    body: StoreIssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Record issuance of a consumable item; posts an OUT stock movement."""
    # Validate item exists and is a store item
    item_row = (await db.execute(
        text("SELECT id, item_name, unit_of_measure, current_stock FROM inventory_items WHERE id = :id AND tenant_id = :tid"),
        {"id": body.inventory_item_id, "tid": current_user.tenant_id},
    )).mappings().first()
    if not item_row:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    if float(item_row["current_stock"]) < float(body.quantity_issued):
        raise HTTPException(status_code=422, detail=f"Insufficient stock. Available: {item_row['current_stock']}")

    issue_id = str(uuid.uuid4())
    movement_id = str(uuid.uuid4())
    now = datetime.utcnow()
    uom = body.unit_of_measure or item_row["unit_of_measure"]

    # Post OUT movement to stock_movements
    await db.execute(text("""
        INSERT INTO stock_movements
          (id, tenant_id, inventory_item_id, movement_type, quantity, movement_date,
           source_type, source_id, notes, created_by, created_at)
        VALUES
          (:mvt_id, :tid, :item_id, 'OUT', :qty, :mvt_date,
           'store_issue', :issue_id, :notes, :user_id, :now)
    """), {
        "mvt_id": movement_id,
        "tid": current_user.tenant_id,
        "item_id": body.inventory_item_id,
        "qty": float(body.quantity_issued),
        "mvt_date": body.issue_date,
        "issue_id": issue_id,
        "notes": f"Store issue — {body.purpose or ''}".strip(" —"),
        "user_id": current_user.user_id,
        "now": now,
    })

    # Update current_stock
    await db.execute(text("""
        UPDATE inventory_items SET current_stock = current_stock - :qty WHERE id = :id AND tenant_id = :tid
    """), {"qty": float(body.quantity_issued), "id": body.inventory_item_id, "tid": current_user.tenant_id})

    # Insert issue record
    await db.execute(text("""
        INSERT INTO store_issues
          (id, tenant_id, inventory_item_id, employee_id, department, location_name,
           quantity_issued, unit_of_measure, issue_date, purpose, reference, notes,
           issued_by, stock_movement_id, created_at)
        VALUES
          (:id, :tid, :item_id, :emp_id, :dept, :loc,
           :qty, :uom, :issue_date, :purpose, :ref, :notes,
           :issued_by, :mvt_id, :now)
    """), {
        "id": issue_id, "tid": current_user.tenant_id, "item_id": body.inventory_item_id,
        "emp_id": body.employee_id, "dept": body.department, "loc": body.location_name,
        "qty": float(body.quantity_issued), "uom": uom,
        "issue_date": body.issue_date, "purpose": body.purpose, "ref": body.reference,
        "notes": body.notes, "issued_by": current_user.user_id,
        "mvt_id": movement_id, "now": now,
    })
    await db.commit()
    return {"id": issue_id, "stock_movement_id": movement_id}


# ── Record a return ───────────────────────────────────────────────────────────

async def _do_return(
    body: StoreReturnCreate,
    db: AsyncSession,
    current_user: CurrentUser,
) -> dict:
    """Shared logic for recording a store return."""
    item_row = (await db.execute(
        text("SELECT id, unit_of_measure FROM inventory_items WHERE id = :id AND tenant_id = :tid"),
        {"id": body.inventory_item_id, "tid": current_user.tenant_id},
    )).mappings().first()
    if not item_row:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    return_id = str(uuid.uuid4())
    movement_id = str(uuid.uuid4())
    now = datetime.utcnow()

    # Post IN movement
    await db.execute(text("""
        INSERT INTO stock_movements
          (id, tenant_id, inventory_item_id, movement_type, quantity, movement_date,
           source_type, source_id, notes, created_by, created_at)
        VALUES
          (:mvt_id, :tid, :item_id, 'IN', :qty, :ret_date,
           'store_return', :ret_id, :notes, :user_id, :now)
    """), {
        "mvt_id": movement_id, "tid": current_user.tenant_id,
        "item_id": body.inventory_item_id, "qty": float(body.quantity_returned),
        "ret_date": body.return_date, "ret_id": return_id,
        "notes": f"Store return — {body.condition}", "user_id": current_user.user_id, "now": now,
    })

    # Update current_stock
    await db.execute(text("""
        UPDATE inventory_items SET current_stock = current_stock + :qty WHERE id = :id AND tenant_id = :tid
    """), {"qty": float(body.quantity_returned), "id": body.inventory_item_id, "tid": current_user.tenant_id})

    await db.execute(text("""
        INSERT INTO store_returns
          (id, tenant_id, store_issue_id, inventory_item_id, employee_id,
           quantity_returned, return_date, condition, notes, received_by,
           stock_movement_id, created_at)
        VALUES
          (:id, :tid, :issue_id, :item_id, :emp_id,
           :qty, :ret_date, :condition, :notes, :recv_by,
           :mvt_id, :now)
    """), {
        "id": return_id, "tid": current_user.tenant_id,
        "issue_id": body.store_issue_id, "item_id": body.inventory_item_id,
        "emp_id": body.employee_id, "qty": float(body.quantity_returned),
        "ret_date": body.return_date, "condition": body.condition,
        "notes": body.notes, "recv_by": current_user.user_id,
        "mvt_id": movement_id, "now": now,
    })
    await db.commit()
    return {"id": return_id, "stock_movement_id": movement_id}


@router.post("/issues/{issue_id}/return", status_code=201)
async def return_against_issue(
    issue_id: str,
    body: StoreReturnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Record a return referencing a specific original issue."""
    body.store_issue_id = issue_id
    return await _do_return(body, db, current_user)


@router.post("/returns", status_code=201)
async def create_return(
    body: StoreReturnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Record a freestanding return without referencing an original issue."""
    return await _do_return(body, db, current_user)


@router.get("/returns")
async def list_returns(
    item_id: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """List store returns."""
    q = text("""
        SELECT
            sr.id, sr.inventory_item_id, sr.store_issue_id, sr.employee_id,
            sr.quantity_returned, sr.return_date, sr.condition, sr.notes, sr.created_at,
            ii.item_name, ii.item_code,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name
        FROM store_returns sr
        JOIN inventory_items ii ON ii.id = sr.inventory_item_id
        LEFT JOIN employees e ON e.id = sr.employee_id
        WHERE sr.tenant_id = :tid
          AND (:item_id IS NULL OR sr.inventory_item_id = :item_id)
        ORDER BY sr.return_date DESC, sr.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    rows = (await db.execute(q, {
        "tid": current_user.tenant_id, "item_id": item_id,
        "limit": limit, "offset": offset,
    })).mappings().all()
    return [dict(r) for r in rows]


# ── Usage analytics ───────────────────────────────────────────────────────────

@router.get("/analytics")
async def store_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
):
    """Per-item usage analytics for all store items.

    Returns avg daily/monthly consumption (90-day window), current stock,
    days of stock remaining, and reorder flags.
    """
    now = datetime.utcnow().date()
    d30_ago = now - timedelta(days=30)
    d90_ago = now - timedelta(days=90)

    q = text("""
        WITH issues_30d AS (
            SELECT inventory_item_id, COALESCE(SUM(quantity_issued), 0) AS qty_30d
            FROM store_issues
            WHERE tenant_id = :tid AND issue_date >= :d30
            GROUP BY inventory_item_id
        ),
        issues_90d AS (
            SELECT inventory_item_id,
                   COALESCE(SUM(quantity_issued), 0) AS qty_90d,
                   MAX(issue_date) AS last_issue
            FROM store_issues
            WHERE tenant_id = :tid AND issue_date >= :d90
            GROUP BY inventory_item_id
        ),
        returns_latest AS (
            SELECT inventory_item_id, MAX(return_date) AS last_return
            FROM store_returns
            WHERE tenant_id = :tid
            GROUP BY inventory_item_id
        )
        SELECT
            ii.id AS inventory_item_id,
            ii.item_name,
            ii.item_code,
            ii.unit_of_measure,
            ii.current_stock,
            ii.minimum_stock_level,
            ii.reorder_quantity,
            COALESCE(i30.qty_30d, 0) AS total_issued_30d,
            COALESCE(i90.qty_90d, 0) AS total_issued_90d,
            COALESCE(i90.qty_90d, 0) / 90.0 AS avg_daily_usage,
            COALESCE(i90.qty_90d, 0) / 3.0 AS avg_monthly_usage,
            i90.last_issue AS last_issue_date,
            rl.last_return AS last_return_date
        FROM inventory_items ii
        LEFT JOIN issues_30d i30 ON i30.inventory_item_id = ii.id
        LEFT JOIN issues_90d i90 ON i90.inventory_item_id = ii.id
        LEFT JOIN returns_latest rl ON rl.inventory_item_id = ii.id
        WHERE ii.tenant_id = :tid AND ii.is_store_item = true
        ORDER BY ii.item_name
    """)
    rows = (await db.execute(q, {"tid": current_user.tenant_id, "d30": d30_ago, "d90": d90_ago})).mappings().all()

    result = []
    for r in rows:
        avg_daily = float(r["avg_daily_usage"] or 0)
        current = float(r["current_stock"] or 0)
        days_remaining = round(current / avg_daily, 1) if avg_daily > 0 else None
        min_stock = r["minimum_stock_level"]
        below_min = (min_stock is not None and current < min_stock)
        reorder_rec = below_min or (days_remaining is not None and days_remaining < 14)
        result.append({
            "inventory_item_id": r["inventory_item_id"],
            "item_name": r["item_name"],
            "item_code": r["item_code"],
            "unit_of_measure": r["unit_of_measure"],
            "current_stock": current,
            "minimum_stock_level": min_stock,
            "reorder_quantity": r["reorder_quantity"],
            "total_issued_30d": float(r["total_issued_30d"]),
            "total_issued_90d": float(r["total_issued_90d"]),
            "avg_daily_usage": round(avg_daily, 4),
            "avg_monthly_usage": round(float(r["avg_monthly_usage"] or 0), 2),
            "days_of_stock_remaining": days_remaining,
            "below_minimum": below_min,
            "reorder_recommended": reorder_rec,
            "last_issue_date": r["last_issue_date"],
            "last_return_date": r["last_return_date"],
        })
    return result
