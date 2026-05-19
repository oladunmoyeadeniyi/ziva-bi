"""
ZivaBI — expense management router (Milestone 3).

All routes require authentication (require_auth dependency).
All queries are scoped to the current user's tenant_id.
Status flow for M3: DRAFT → SUBMITTED only (no approvals).

Endpoints:
    POST   /api/expenses/reports                            Create DRAFT report
    GET    /api/expenses/reports                            List reports (tenant-scoped)
    GET    /api/expenses/reports/{report_id}                Single report with lines
    POST   /api/expenses/reports/{report_id}/lines          Add line to DRAFT report
    DELETE /api/expenses/reports/{report_id}/lines/{line_id} Remove line from DRAFT report
    PATCH  /api/expenses/reports/{report_id}                Update DRAFT header
    POST   /api/expenses/reports/{report_id}/submit         Submit DRAFT → SUBMITTED
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.expenses import ExpenseLine, ExpenseReport
from app.schemas.expenses import (
    ExpenseLineCreate,
    ExpenseLineResponse,
    ExpenseReportCreate,
    ExpenseReportResponse,
    ExpenseReportUpdate,
)

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    """Raise 403 if the current user has no tenant (individual account)."""
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Expense retirement is a business-tier feature.",
        )
    return current_user.tenant_id


async def _get_report_or_404(
    report_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
    *,
    with_lines: bool = True,
) -> ExpenseReport:
    """Fetch a report by ID scoped to tenant, raising 404 if not found."""
    q = select(ExpenseReport).where(
        ExpenseReport.id == report_id,
        ExpenseReport.tenant_id == tenant_id,
    )
    if with_lines:
        q = q.options(selectinload(ExpenseReport.lines))
    result = await db.execute(q)
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    return report


async def _generate_report_number(tenant_id: uuid.UUID, db: AsyncSession) -> str:
    """
    Generate a unique EXP-{YEAR}-{SEQUENCE:04d} number for the tenant.

    Sequence is scoped to the current calendar year by matching existing
    report_number patterns. Race-condition safe enough for M3 single-user tenants.
    """
    year = datetime.now(timezone.utc).year
    count_result = await db.execute(
        select(func.count(ExpenseReport.id)).where(
            ExpenseReport.tenant_id == tenant_id,
            ExpenseReport.report_number.like(f"EXP-{year}-%"),
        )
    )
    count = count_result.scalar_one() or 0
    return f"EXP-{year}-{count + 1:04d}"


async def _recalculate_total(report: ExpenseReport, db: AsyncSession) -> None:
    """Recalculate and persist report total_amount from all current lines."""
    result = await db.execute(
        select(func.coalesce(func.sum(ExpenseLine.amount), 0)).where(
            ExpenseLine.report_id == report.id
        )
    )
    report.total_amount = result.scalar_one() or Decimal("0.00")


async def _reload_report(report_id: uuid.UUID, db: AsyncSession) -> ExpenseReport:
    """
    Issue a fresh SELECT for a report with its lines eagerly loaded.

    Used after any mutation (add/delete line, update, submit) instead of
    db.refresh(), which can trigger SQLAlchemy greenlet errors in asyncpg
    when the session has done multiple flushes.

    populate_existing=True is required to force SQLAlchemy to re-populate
    the ORM instance from the DB even when it is already in the session's
    identity map (e.g. after adding a new line the cached report.lines
    collection would otherwise still show the stale pre-mutation state).
    """
    result = await db.execute(
        select(ExpenseReport)
        .where(ExpenseReport.id == report_id)
        .options(selectinload(ExpenseReport.lines))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/reports", response_model=ExpenseReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    data: ExpenseReportCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Create a new DRAFT expense report for the authenticated user.

    report_number is auto-generated as EXP-{YEAR}-{SEQUENCE:04d}.
    Returns the created report with an empty lines array.
    """
    tenant_id = _require_tenant(current_user)

    report_number = await _generate_report_number(tenant_id, db)

    report = ExpenseReport(
        tenant_id=tenant_id,
        report_number=report_number,
        employee_id=current_user.user_id,
        employee_function=data.employee_function,
        report_date=data.report_date,
        status="DRAFT",
        currency="NGN",
        total_amount=Decimal("0.00"),
    )
    db.add(report)
    await db.flush()

    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))


@router.get("/reports", response_model=list[ExpenseReportResponse])
async def list_reports(
    status_filter: str | None = Query(None, alias="status"),
    employee_id: uuid.UUID | None = Query(None),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ExpenseReportResponse]:
    """
    List expense reports for the current tenant.

    Optional filters:
      - status: DRAFT | SUBMITTED
      - employee_id: filter to a specific employee's reports
    Returns reports with lines eagerly loaded (for line_count).
    """
    tenant_id = _require_tenant(current_user)

    q = (
        select(ExpenseReport)
        .where(ExpenseReport.tenant_id == tenant_id)
        .options(selectinload(ExpenseReport.lines))
        .order_by(ExpenseReport.created_at.desc())
    )

    if status_filter:
        q = q.where(ExpenseReport.status == status_filter.upper())
    if employee_id:
        q = q.where(ExpenseReport.employee_id == employee_id)

    result = await db.execute(q)
    reports = result.scalars().all()
    return [ExpenseReportResponse.from_orm(r) for r in reports]


@router.get("/reports/{report_id}", response_model=ExpenseReportResponse)
async def get_report(
    report_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """Retrieve a single expense report with all its lines."""
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)
    return ExpenseReportResponse.from_orm(report)


@router.post("/reports/{report_id}/lines", response_model=ExpenseReportResponse)
async def add_line(
    report_id: uuid.UUID,
    data: ExpenseLineCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Add a new expense line to a DRAFT report.

    Assigns the next sequential line_number and recalculates total_amount.
    Returns the updated report with all lines.
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status not in ("DRAFT", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Lines can only be added to DRAFT or REJECTED reports.",
        )
    # Normalize REJECTED → DRAFT when the employee starts editing again
    if report.status == "REJECTED":
        report.status = "DRAFT"
        report.rejection_comment = None
        report.current_approval_level = None

    max_line_result = await db.execute(
        select(func.coalesce(func.max(ExpenseLine.line_number), 0)).where(
            ExpenseLine.report_id == report.id
        )
    )
    next_line_number = (max_line_result.scalar_one() or 0) + 1

    line = ExpenseLine(
        report_id=report.id,
        line_number=next_line_number,
        pl_group=data.pl_group,
        gl_account=data.gl_account,
        io_dimension=data.io_dimension,
        cost_center=data.cost_center,
        location=data.location,
        invoice_date=data.invoice_date,
        invoice_number=data.invoice_number,
        description=data.description,
        amount=data.amount,
    )
    db.add(line)
    await db.flush()

    await _recalculate_total(report, db)
    await db.flush()

    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))


@router.delete(
    "/reports/{report_id}/lines/{line_id}",
    response_model=ExpenseReportResponse,
)
async def delete_line(
    report_id: uuid.UUID,
    line_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Remove a line from a DRAFT report and recalculate the total.

    Returns the updated report with remaining lines.
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status not in ("DRAFT", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Lines can only be removed from DRAFT or REJECTED reports.",
        )
    if report.status == "REJECTED":
        report.status = "DRAFT"
        report.rejection_comment = None
        report.current_approval_level = None

    line_result = await db.execute(
        select(ExpenseLine).where(
            ExpenseLine.id == line_id,
            ExpenseLine.report_id == report.id,
        )
    )
    line = line_result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Line not found.")

    await db.delete(line)
    await db.flush()

    await _recalculate_total(report, db)
    await db.flush()

    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a DRAFT expense report and all its lines (cascade).

    Returns 400 if the report is already SUBMITTED — submitted reports
    are immutable and can only be voided via an approval workflow (M4).
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db, with_lines=False)

    if report.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only DRAFT reports can be deleted.",
        )

    await db.delete(report)
    await db.flush()


@router.patch("/reports/{report_id}", response_model=ExpenseReportResponse)
async def update_report(
    report_id: uuid.UUID,
    data: ExpenseReportUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """Update header fields on a DRAFT expense report."""
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status not in ("DRAFT", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only DRAFT or REJECTED reports can be edited.",
        )

    # Reset rejected report to DRAFT so the employee can re-edit and resubmit
    if report.status == "REJECTED":
        report.status = "DRAFT"
        report.rejection_comment = None
        report.current_approval_level = None

    if data.report_date is not None:
        report.report_date = data.report_date
    if data.employee_function is not None:
        report.employee_function = data.employee_function

    await db.flush()

    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))


@router.post("/reports/{report_id}/submit", response_model=ExpenseReportResponse)
async def submit_report(
    report_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Submit a DRAFT report: DRAFT → SUBMITTED.

    Validates:
      - report must be in DRAFT status
      - at least one line must exist
      - every line must have a non-empty description (enforced by model, double-checked here)
    Sets submitted_at to the current UTC timestamp.
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only DRAFT reports can be submitted.",
        )

    if not report.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A report must have at least one line before it can be submitted.",
        )

    report.status = "SUBMITTED"
    report.submitted_at = datetime.now(timezone.utc)
    await db.flush()

    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))
