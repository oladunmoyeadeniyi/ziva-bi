"""Router — Reporting & Analytics.

Registered at prefix /api/reporting.

Endpoints:
  GET  /api/reporting/dashboard               — KPI summary for the analytics dashboard
  GET  /api/reporting/run/{report_type}       — run a built-in report (query params as filters)
  POST /api/reporting/run                     — run a report with a JSON body (filters as JSONB)
  GET  /api/reporting/saved                   — list saved report definitions for this tenant
  POST /api/reporting/saved                   — save a report definition
  GET  /api/reporting/saved/{id}              — get saved report + re-run it
  DELETE /api/reporting/saved/{id}            — delete a saved report definition

Access: any authenticated user with a tenant context.
        Shared reports are visible to all admin users; private reports to creator only.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.reporting import SavedReport
from app.schemas.reporting import (
    ReportRunRequest,
    ReportRunResponse,
    SavedReportCreate,
    SavedReportRead,
    VALID_REPORT_TYPES,
    VALID_MODULES,
)
from app.services.reporting_service import get_dashboard_kpis, run_report, RUN_REGISTRY

router = APIRouter(prefix="/api/reporting", tags=["reporting"])


def _tenant(current_user: CurrentUser) -> uuid.UUID:
    if current_user.tenant_id is None:
        raise HTTPException(status_code=400, detail="No tenant context.")
    return current_user.tenant_id


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def analytics_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> dict:
    """Return a KPI snapshot for the analytics dashboard.

    Mode-aware: Lite mode omits GL-sourced figures.

    Returns:
        Dict with expenses, ar, ap, payroll, budget sections.
    """
    tenant_id = _tenant(current_user)
    # Fetch posting mode from setup config
    try:
        from app.models.setup import TenantModuleConfig
        from sqlalchemy import select as _sel
        row = (await db.execute(
            _sel(TenantModuleConfig).where(TenantModuleConfig.tenant_id == tenant_id)
        )).scalar_one_or_none()
        posting_mode = row.posting_mode if row else "lite"
    except Exception:
        posting_mode = "lite"

    kpis = await get_dashboard_kpis(db, tenant_id, posting_mode)
    return {"posting_mode": posting_mode, "kpis": kpis}


# ── Built-in report runner ─────────────────────────────────────────────────────

@router.post("/run", response_model=ReportRunResponse)
async def run_report_endpoint(
    payload: ReportRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ReportRunResponse:
    """Run a built-in report with JSON body filters.

    Args:
        payload: report_type (str) + filters (dict).

    Returns:
        ReportRunResponse with rows.

    Raises:
        422: Unknown report_type.
    """
    tenant_id = _tenant(current_user)
    if payload.report_type not in RUN_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown report type '{payload.report_type}'. Valid: {sorted(RUN_REGISTRY)}",
        )
    try:
        rows = await run_report(db, tenant_id, payload.report_type, payload.filters)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ReportRunResponse(
        report_type=payload.report_type,
        filters=payload.filters,
        row_count=len(rows),
        rows=rows,
    )


@router.get("/run/{report_type}", response_model=ReportRunResponse)
async def run_report_get(
    report_type: str,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    as_of: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ReportRunResponse:
    """Run a built-in report via GET with query-param filters.

    Handy for quick embedding or sharing links.
    """
    tenant_id = _tenant(current_user)
    if report_type not in RUN_REGISTRY:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown report type '{report_type}'. Valid: {sorted(RUN_REGISTRY)}",
        )
    filters: dict = {}
    if date_from:
        filters["date_from"] = date_from
    if date_to:
        filters["date_to"] = date_to
    if as_of:
        filters["as_of"] = as_of
    if status:
        filters["status"] = status

    try:
        rows = await run_report(db, tenant_id, report_type, filters)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ReportRunResponse(
        report_type=report_type,
        filters=filters,
        row_count=len(rows),
        rows=rows,
    )


# ── Saved reports ──────────────────────────────────────────────────────────────

@router.get("/saved", response_model=list[SavedReportRead])
async def list_saved_reports(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[SavedReport]:
    """List saved report definitions visible to the current user.

    Returns own reports + reports marked is_shared=True.
    """
    tenant_id = _tenant(current_user)
    stmt = select(SavedReport).where(
        SavedReport.tenant_id == tenant_id,
        (SavedReport.is_shared == True) | (SavedReport.created_by == current_user.user_id),  # noqa: E712
    ).order_by(SavedReport.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/saved", response_model=SavedReportRead, status_code=201)
async def create_saved_report(
    payload: SavedReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> SavedReport:
    """Save a report definition for later re-use.

    Args:
        payload: name, report_type, module, filters, is_shared.

    Returns:
        The persisted SavedReport row.

    Raises:
        422: Invalid report_type or module.
    """
    tenant_id = _tenant(current_user)
    if payload.report_type not in VALID_REPORT_TYPES:
        raise HTTPException(422, detail=f"Invalid report_type: {payload.report_type!r}")
    if payload.module not in VALID_MODULES:
        raise HTTPException(422, detail=f"Invalid module: {payload.module!r}")

    row = SavedReport(
        tenant_id=tenant_id,
        name=payload.name,
        description=payload.description,
        report_type=payload.report_type,
        module=payload.module,
        filters=payload.filters,
        is_shared=payload.is_shared,
        created_by=current_user.user_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/saved/{report_id}", response_model=ReportRunResponse)
async def get_and_run_saved_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ReportRunResponse:
    """Fetch a saved report definition and execute it, returning fresh data.

    Also updates last_run_at on the saved report row.

    Args:
        report_id: UUID of the saved report.

    Returns:
        ReportRunResponse with fresh row data.

    Raises:
        404: Report not found or not accessible.
    """
    tenant_id = _tenant(current_user)
    stmt = select(SavedReport).where(
        SavedReport.id == report_id,
        SavedReport.tenant_id == tenant_id,
        (SavedReport.is_shared == True) | (SavedReport.created_by == current_user.user_id),  # noqa: E712
    )
    report = (await db.execute(stmt)).scalar_one_or_none()
    if report is None:
        raise HTTPException(404, detail="Saved report not found.")

    if report.report_type not in RUN_REGISTRY:
        raise HTTPException(422, detail=f"Report type {report.report_type!r} is no longer available.")

    try:
        rows = await run_report(db, tenant_id, report.report_type, report.filters)
    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc

    # Update last_run_at
    report.last_run_at = datetime.now(timezone.utc)
    await db.commit()

    return ReportRunResponse(
        report_type=report.report_type,
        filters=report.filters,
        row_count=len(rows),
        rows=rows,
    )


@router.delete("/saved/{report_id}", status_code=204)
async def delete_saved_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> None:
    """Delete a saved report definition.

    Only the creator can delete their own report (shared or not).
    Power admins can delete any report in their tenant.

    Args:
        report_id: UUID of the saved report.

    Raises:
        404: Not found.
        403: Not the owner and not a power admin.
    """
    tenant_id = _tenant(current_user)
    stmt = select(SavedReport).where(
        SavedReport.id == report_id,
        SavedReport.tenant_id == tenant_id,
    )
    report = (await db.execute(stmt)).scalar_one_or_none()
    if report is None:
        raise HTTPException(404, detail="Saved report not found.")

    is_owner = report.created_by == current_user.user_id
    is_power = current_user.role_tier == "power_admin" or current_user.is_super_admin
    if not is_owner and not is_power:
        raise HTTPException(403, detail="Only the report owner or a power admin can delete this report.")

    await db.delete(report)
    await db.commit()
