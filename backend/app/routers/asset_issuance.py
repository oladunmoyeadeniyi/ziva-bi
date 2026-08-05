"""Router — Asset Issuance & Tracking.

Manages physical custody of assets (laptops → staff, POSM coolers → outlets, etc.)
and maintenance cost records.

Endpoints:

  Asset issuances:
    GET  /api/assets/issuances              — all active + recent issuances for tenant
    POST /api/assets/issuances              — issue an asset
    GET  /api/assets/issuances/{id}         — issuance detail
    PUT  /api/assets/issuances/{id}/return  — record a return
    GET  /api/assets/{asset_id}/issuances   — full issuance history for one asset

  Asset maintenance costs:
    GET  /api/assets/maintenance            — all maintenance records for tenant
    POST /api/assets/maintenance            — record a maintenance cost
    GET  /api/assets/{asset_id}/maintenance — maintenance history for one asset

All endpoints require tenant authentication. No module licensing guard needed —
this is a natural extension of the Fixed Assets module which is always available
in Full ERP mode and as a standalone tracker in Lite/Connected.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.asset_issuance import AssetIssuance, AssetMaintenanceCost
from app.models.fixed_assets import Asset
from app.models.master_data import Employee
from app.schemas.asset_issuance import (
    AssetIssuanceCreate,
    AssetIssuanceRead,
    AssetIssuanceReturn,
    AssetMaintenanceCostCreate,
    AssetMaintenanceCostRead,
)

router = APIRouter(prefix="/api/assets", tags=["asset-issuance"])


def _tenant(cu: CurrentUser) -> uuid.UUID:
    if cu.tenant_id is None:
        raise HTTPException(400, detail="No tenant context.")
    return cu.tenant_id


async def _get_asset(db: AsyncSession, asset_id: uuid.UUID, tenant_id: uuid.UUID) -> Asset:
    asset = (await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, detail="Asset not found.")
    return asset


# ── Asset Issuances ────────────────────────────────────────────────────────────

@router.get("/issuances", response_model=list[AssetIssuanceRead])
async def list_issuances(
    status: Optional[str] = None,
    employee_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[AssetIssuanceRead]:
    """List all asset issuances for the tenant, optionally filtered by status or employee."""
    tenant_id = _tenant(current_user)
    q = (
        select(AssetIssuance, Asset.name.label("asset_name"), Asset.code.label("asset_code"),
               Employee.first_name.label("emp_first"), Employee.last_name.label("emp_last"))
        .join(Asset, AssetIssuance.asset_id == Asset.id)
        .outerjoin(Employee, AssetIssuance.employee_id == Employee.id)
        .where(AssetIssuance.tenant_id == tenant_id)
    )
    if status:
        q = q.where(AssetIssuance.status == status.upper())
    if employee_id:
        q = q.where(AssetIssuance.employee_id == employee_id)
    q = q.order_by(AssetIssuance.issue_date.desc())
    rows = (await db.execute(q)).all()
    return [
        AssetIssuanceRead(
            **{c.name: getattr(r.AssetIssuance, c.name) for c in AssetIssuance.__table__.columns},
            asset_name=r.asset_name,
            asset_code=r.asset_code,
            employee_name=f"{r.emp_first} {r.emp_last}".strip() if r.emp_first else None,
        )
        for r in rows
    ]


@router.post("/issuances", response_model=AssetIssuanceRead, status_code=201)
async def issue_asset(
    payload: AssetIssuanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> AssetIssuanceRead:
    """Issue an asset to a staff member or location.

    If the asset currently has an ACTIVE issuance, it is automatically set to
    TRANSFERRED before the new issuance is created.
    """
    tenant_id = _tenant(current_user)
    await _get_asset(db, payload.asset_id, tenant_id)

    # Close any existing ACTIVE issuance for this asset
    existing = (await db.execute(
        select(AssetIssuance).where(
            AssetIssuance.asset_id == payload.asset_id,
            AssetIssuance.tenant_id == tenant_id,
            AssetIssuance.status == "ACTIVE",
        )
    )).scalar_one_or_none()
    if existing:
        existing.status = "TRANSFERRED"
        existing.updated_at = datetime.now(timezone.utc)

    issuance = AssetIssuance(
        tenant_id=tenant_id,
        asset_id=payload.asset_id,
        employee_id=payload.employee_id,
        location_name=payload.location_name,
        issue_date=payload.issue_date,
        expected_return_date=payload.expected_return_date,
        condition_at_issue=payload.condition_at_issue,
        notes=payload.notes,
        issued_by=current_user.user_id,
        status="ACTIVE",
    )
    db.add(issuance)
    await db.commit()
    await db.refresh(issuance)

    # Resolve display fields
    emp_name = None
    if issuance.employee_id:
        emp = (await db.execute(select(Employee).where(Employee.id == issuance.employee_id))).scalar_one_or_none()
        if emp:
            emp_name = f"{emp.first_name} {emp.last_name}".strip()
    asset = await _get_asset(db, issuance.asset_id, tenant_id)
    return AssetIssuanceRead(
        **{c.name: getattr(issuance, c.name) for c in AssetIssuance.__table__.columns},
        asset_name=asset.name,
        asset_code=asset.code,
        employee_name=emp_name,
    )


@router.get("/issuances/{issuance_id}", response_model=AssetIssuanceRead)
async def get_issuance(
    issuance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> AssetIssuanceRead:
    tenant_id = _tenant(current_user)
    row = (await db.execute(
        select(AssetIssuance, Asset.name.label("an"), Asset.code.label("ac"),
               Employee.first_name.label("ef"), Employee.last_name.label("el"))
        .join(Asset, AssetIssuance.asset_id == Asset.id)
        .outerjoin(Employee, AssetIssuance.employee_id == Employee.id)
        .where(AssetIssuance.id == issuance_id, AssetIssuance.tenant_id == tenant_id)
    )).first()
    if not row:
        raise HTTPException(404, detail="Issuance not found.")
    return AssetIssuanceRead(
        **{c.name: getattr(row.AssetIssuance, c.name) for c in AssetIssuance.__table__.columns},
        asset_name=row.an, asset_code=row.ac,
        employee_name=f"{row.ef} {row.el}".strip() if row.ef else None,
    )


@router.put("/issuances/{issuance_id}/return", response_model=AssetIssuanceRead)
async def return_asset(
    issuance_id: uuid.UUID,
    payload: AssetIssuanceReturn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> AssetIssuanceRead:
    """Record the return of an issued asset."""
    tenant_id = _tenant(current_user)
    issuance = (await db.execute(
        select(AssetIssuance).where(
            AssetIssuance.id == issuance_id,
            AssetIssuance.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if not issuance:
        raise HTTPException(404, detail="Issuance not found.")
    if issuance.status != "ACTIVE":
        raise HTTPException(400, detail="Only ACTIVE issuances can be returned.")

    issuance.status = "RETURNED"
    issuance.returned_at = payload.returned_at
    issuance.condition_at_return = payload.condition_at_return
    if payload.notes:
        issuance.notes = (issuance.notes or "") + f"\nReturn note: {payload.notes}"
    issuance.returned_by = current_user.user_id
    issuance.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(issuance)

    asset = await _get_asset(db, issuance.asset_id, tenant_id)
    return AssetIssuanceRead(
        **{c.name: getattr(issuance, c.name) for c in AssetIssuance.__table__.columns},
        asset_name=asset.name, asset_code=asset.code,
    )


@router.get("/{asset_id}/issuances", response_model=list[AssetIssuanceRead])
async def asset_issuance_history(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[AssetIssuanceRead]:
    """Full issuance history for a specific asset."""
    tenant_id = _tenant(current_user)
    await _get_asset(db, asset_id, tenant_id)
    rows = (await db.execute(
        select(AssetIssuance, Employee.first_name.label("ef"), Employee.last_name.label("el"))
        .outerjoin(Employee, AssetIssuance.employee_id == Employee.id)
        .where(AssetIssuance.asset_id == asset_id, AssetIssuance.tenant_id == tenant_id)
        .order_by(AssetIssuance.issue_date.desc())
    )).all()
    return [
        AssetIssuanceRead(
            **{c.name: getattr(r.AssetIssuance, c.name) for c in AssetIssuance.__table__.columns},
            employee_name=f"{r.ef} {r.el}".strip() if r.ef else None,
        )
        for r in rows
    ]


# ── Asset Maintenance Costs ────────────────────────────────────────────────────

@router.get("/maintenance", response_model=list[AssetMaintenanceCostRead])
async def list_maintenance_costs(
    asset_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[AssetMaintenanceCostRead]:
    """List all maintenance cost records for the tenant."""
    tenant_id = _tenant(current_user)
    q = (
        select(AssetMaintenanceCost, Asset.name.label("asset_name"))
        .join(Asset, AssetMaintenanceCost.asset_id == Asset.id)
        .where(AssetMaintenanceCost.tenant_id == tenant_id)
    )
    if asset_id:
        q = q.where(AssetMaintenanceCost.asset_id == asset_id)
    q = q.order_by(AssetMaintenanceCost.maintenance_date.desc())
    rows = (await db.execute(q)).all()
    return [
        AssetMaintenanceCostRead(
            **{c.name: getattr(r.AssetMaintenanceCost, c.name) for c in AssetMaintenanceCost.__table__.columns},
            asset_name=r.asset_name,
        )
        for r in rows
    ]


@router.post("/maintenance", response_model=AssetMaintenanceCostRead, status_code=201)
async def record_maintenance_cost(
    payload: AssetMaintenanceCostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> AssetMaintenanceCostRead:
    """Record a maintenance or repair cost for an asset."""
    tenant_id = _tenant(current_user)
    asset = await _get_asset(db, payload.asset_id, tenant_id)

    record = AssetMaintenanceCost(
        tenant_id=tenant_id,
        asset_id=payload.asset_id,
        maintenance_date=payload.maintenance_date,
        description=payload.description,
        cost=payload.cost,
        currency_code=payload.currency_code,
        maintenance_type=payload.maintenance_type,
        vendor_name=payload.vendor_name,
        reference=payload.reference,
        gl_account_id=payload.gl_account_id,
        recorded_by=current_user.user_id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return AssetMaintenanceCostRead(
        **{c.name: getattr(record, c.name) for c in AssetMaintenanceCost.__table__.columns},
        asset_name=asset.name,
    )


@router.get("/{asset_id}/maintenance", response_model=list[AssetMaintenanceCostRead])
async def asset_maintenance_history(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[AssetMaintenanceCostRead]:
    """Full maintenance cost history for a specific asset."""
    tenant_id = _tenant(current_user)
    asset = await _get_asset(db, asset_id, tenant_id)
    rows = (await db.execute(
        select(AssetMaintenanceCost)
        .where(AssetMaintenanceCost.asset_id == asset_id, AssetMaintenanceCost.tenant_id == tenant_id)
        .order_by(AssetMaintenanceCost.maintenance_date.desc())
    )).scalars().all()
    return [
        AssetMaintenanceCostRead(
            **{c.name: getattr(r, c.name) for c in AssetMaintenanceCost.__table__.columns},
            asset_name=asset.name,
        )
        for r in rows
    ]
