"""
Payroll & HR router — M15.

Routes:
    Salary structures:
        GET    /api/payroll/salary-structures                — list (filtered by employee)
        POST   /api/payroll/salary-structures                — create new structure
        GET    /api/payroll/salary-structures/{id}           — get one
        DELETE /api/payroll/salary-structures/{id}           — deactivate

    Payroll runs:
        GET    /api/payroll/runs                             — list runs
        POST   /api/payroll/runs                             — create DRAFT run (auto-computes lines)
        GET    /api/payroll/runs/{id}                        — run detail with lines
        POST   /api/payroll/runs/{id}/approve                — DRAFT → APPROVED (+ GL posting)
        POST   /api/payroll/runs/{id}/pay                    — APPROVED → PAID
        POST   /api/payroll/runs/{id}/cancel                 — cancel DRAFT

    Payslips:
        GET    /api/payroll/payslips                         — list (filtered by employee/run)
        GET    /api/payroll/payslips/{id}                    — get one

    Leave types:
        GET    /api/payroll/leave-types                      — list
        POST   /api/payroll/leave-types                      — create

    Leave requests:
        GET    /api/payroll/leave-requests                   — list
        POST   /api/payroll/leave-requests                   — submit request
        POST   /api/payroll/leave-requests/{id}/approve      — approve
        POST   /api/payroll/leave-requests/{id}/reject       — reject

    Leave balances:
        GET    /api/payroll/leave-balances/{employee_id}     — get balances for employee
"""

import csv
import io
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_auth, require_module
from app.models.auth import UserTenant
from app.models.master_data import Employee
from app.models.payroll import (
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    Payslip,
    PayrollLine,
    PayrollRun,
    SalaryStructure,
)
from app.schemas.payroll import (
    LeaveBalanceResponse,
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveTypeCreate,
    LeaveTypeResponse,
    PayrollLineResponse,
    PayrollRunCreate,
    PayrollRunResponse,
    SalaryStructureCreate,
    SalaryStructureResponse,
)
from app.services.tax_compute_service import compute_paye

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/payroll",
    tags=["Payroll & HR"],
    dependencies=[Depends(require_module("payroll"))],
)


def _tenant_id(user: UserTenant) -> uuid.UUID:
    tid = getattr(user, "tenant_id", None)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context.")
    return tid


async def _next_run_ref(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Generate PAY-{YYYY}-{NNN:03d} reference."""
    year = date.today().year
    result = await db.execute(
        select(func.count(PayrollRun.id)).where(
            PayrollRun.tenant_id == tenant_id
        )
    )
    n = result.scalar_one() or 0
    return f"PAY-{year}-{n + 1:03d}"


async def _next_payslip_ref(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    result = await db.execute(
        select(func.count(Payslip.id)).where(Payslip.tenant_id == tenant_id)
    )
    n = result.scalar_one() or 0
    return f"SLIP-{date.today().year}-{n + 1:05d}"


# ── Salary Structures ──────────────────────────────────────────────────────────

@router.get("/salary-structures", response_model=list[SalaryStructureResponse])
async def list_salary_structures(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    employee_id: Optional[uuid.UUID] = Query(None),
) -> list[SalaryStructureResponse]:
    """List active salary structures."""
    tenant_id = _tenant_id(current_user)
    q = select(SalaryStructure).where(
        SalaryStructure.tenant_id == tenant_id,
        SalaryStructure.is_active.is_(True),
    )
    if employee_id:
        q = q.where(SalaryStructure.employee_id == employee_id)
    q = q.order_by(SalaryStructure.effective_date.desc())
    result = await db.execute(q)
    structs = result.scalars().all()
    return [SalaryStructureResponse.model_validate(s) for s in structs]


@router.post("/salary-structures", response_model=SalaryStructureResponse, status_code=status.HTTP_201_CREATED)
async def create_salary_structure(
    body: SalaryStructureCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> SalaryStructureResponse:
    """Create a new salary structure for an employee."""
    tenant_id = _tenant_id(current_user)

    # Compute gross
    other_total = sum(Decimal(str(a.get("amount", 0))) for a in (body.other_allowances or []))
    gross = body.basic + body.housing + body.transport + body.meal_allowance + other_total

    struct = SalaryStructure(
        tenant_id=tenant_id,
        employee_id=body.employee_id,
        effective_date=body.effective_date,
        basic=body.basic,
        housing=body.housing,
        transport=body.transport,
        meal_allowance=body.meal_allowance,
        other_allowances=body.other_allowances,
        gross_pay=gross,
        currency=body.currency,
        gl_salary_expense_id=body.gl_salary_expense_id,
        is_active=True,
        created_by_id=current_user.user_id,
    )
    db.add(struct)
    await db.commit()
    await db.refresh(struct)
    return SalaryStructureResponse.model_validate(struct)


# ── Payroll Runs ───────────────────────────────────────────────────────────────

@router.get("/runs", response_model=list[PayrollRunResponse])
async def list_payroll_runs(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
) -> list[PayrollRunResponse]:
    """List payroll runs."""
    tenant_id = _tenant_id(current_user)
    q = select(PayrollRun).where(PayrollRun.tenant_id == tenant_id)
    if status_filter:
        q = q.where(PayrollRun.status == status_filter.upper())
    q = q.order_by(PayrollRun.period_start.desc())
    result = await db.execute(q)
    runs = result.scalars().all()
    return [PayrollRunResponse.model_validate(r) for r in runs]


@router.post("/runs", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED)
async def create_payroll_run(
    body: PayrollRunCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> PayrollRunResponse:
    """
    Create a payroll run and auto-compute lines for all active employees.
    Uses the most recent effective salary structure per employee.
    PAYE and pension are computed via tax_compute_service.
    """
    from app.models.setup import TenantTaxConfig

    tenant_id = _tenant_id(current_user)
    reference = await _next_run_ref(db, tenant_id)

    # Get PAYE config
    tax_cfg_result = await db.execute(
        select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
    )
    tax_cfg = tax_cfg_result.scalar_one_or_none()
    paye_config = tax_cfg.paye_config if tax_cfg else None

    # Get active employees with salary structures
    emp_result = await db.execute(
        select(Employee).where(Employee.tenant_id == tenant_id, Employee.is_active.is_(True))
    )
    employees = emp_result.scalars().all()

    run = PayrollRun(
        tenant_id=tenant_id,
        reference=reference,
        run_date=body.run_date,
        period_start=body.period_start,
        period_end=body.period_end,
        status="DRAFT",
        notes=body.notes,
        created_by_id=current_user.user_id,
    )
    db.add(run)
    await db.flush()

    total_gross = Decimal("0")
    total_paye_sum = Decimal("0")
    total_pension_emp = Decimal("0")
    total_pension_emplr = Decimal("0")
    total_net = Decimal("0")

    for emp in employees:
        # Get latest active salary structure
        struct_result = await db.execute(
            select(SalaryStructure).where(
                SalaryStructure.employee_id == emp.id,
                SalaryStructure.is_active.is_(True),
                SalaryStructure.effective_date <= body.period_end,
            ).order_by(SalaryStructure.effective_date.desc()).limit(1)
        )
        struct = struct_result.scalar_one_or_none()
        if not struct:
            continue

        gross = struct.gross_pay
        tax_result = compute_paye(gross, paye_config)
        paye = tax_result["paye_monthly"]
        emp_pension = tax_result["employee_pension"]
        emplr_pension = tax_result["employer_pension"]
        total_deductions = paye + emp_pension
        net = gross - total_deductions

        line = PayrollLine(
            run_id=run.id,
            tenant_id=tenant_id,
            employee_id=emp.id,
            salary_structure_id=struct.id,
            basic=struct.basic,
            housing=struct.housing,
            transport=struct.transport,
            other_allowances=struct.other_allowances,
            gross_pay=gross,
            paye=paye,
            pension_employee=emp_pension,
            pension_employer=emplr_pension,
            health_insurance=Decimal("0"),
            other_deductions=None,
            total_deductions=total_deductions,
            net_pay=net,
            payment_status="PENDING",
        )
        db.add(line)

        total_gross += gross
        total_paye_sum += paye
        total_pension_emp += emp_pension
        total_pension_emplr += emplr_pension
        total_net += net

    run.total_gross = total_gross
    run.total_paye = total_paye_sum
    run.total_pension_employee = total_pension_emp
    run.total_pension_employer = total_pension_emplr
    run.total_net = total_net

    await db.commit()
    await db.refresh(run)
    return PayrollRunResponse.model_validate(run)


@router.get("/runs/{run_id}", response_model=PayrollRunResponse)
async def get_payroll_run(
    run_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> PayrollRunResponse:
    """Get a payroll run by ID."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(PayrollRun).where(PayrollRun.id == run_id, PayrollRun.tenant_id == tenant_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    return PayrollRunResponse.model_validate(run)


@router.get("/runs/{run_id}/lines", response_model=list[PayrollLineResponse])
async def get_payroll_lines(
    run_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[PayrollLineResponse]:
    """Get payroll lines for a run."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(PayrollLine).where(
            PayrollLine.run_id == run_id,
            PayrollLine.tenant_id == tenant_id,
        )
    )
    lines = result.scalars().all()
    return [PayrollLineResponse.model_validate(ln) for ln in lines]


@router.post("/runs/{run_id}/approve", response_model=PayrollRunResponse)
async def approve_payroll_run(
    run_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> PayrollRunResponse:
    """
    Approve a payroll run.  Triggers GL posting based on tenant posting_mode.
    Full ERP: posts salary journal (DR salary expense / CR salaries payable).
    Connected: creates posting_batch.
    Lite: status change only.
    """
    from app.models.setup import TenantOrgConfig

    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(PayrollRun).where(PayrollRun.id == run_id, PayrollRun.tenant_id == tenant_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    if run.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot approve a {run.status} run.")

    # Get posting mode
    mode_result = await db.execute(
        select(TenantOrgConfig.posting_mode).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    posting_mode = mode_result.scalar_one_or_none() or "lite"
    run.posting_mode = posting_mode

    # GL posting — Full ERP posts via post_journal(); Connected creates a posting_batch
    if posting_mode in ("full_erp", "connected"):
        from app.models.account_mapping import TenantAccountMapping
        mapping_result = await db.execute(
            select(TenantAccountMapping).where(
                TenantAccountMapping.tenant_id == tenant_id,
                TenantAccountMapping.role_key.in_(["salary_expense", "salaries_payable"])
            )
        )
        mappings = {m.role_key: m.gl_account_id for m in mapping_result.scalars().all()}
        salary_gl = mappings.get("salary_expense")
        payable_gl = mappings.get("salaries_payable")

        if salary_gl and payable_gl:
            from app.services.gl_posting import post_journal
            from app.schemas.gl import JournalLineInput
            pay_lines = [
                JournalLineInput(
                    gl_account_id=salary_gl,
                    debit=run.total_gross,
                    credit=Decimal("0"),
                    description="Gross salary expense",
                ),
                JournalLineInput(
                    gl_account_id=payable_gl,
                    debit=Decimal("0"),
                    credit=run.total_net,
                    description="Net salaries payable",
                ),
            ]
            if posting_mode == "full_erp":
                entry = await post_journal(
                    db,
                    tenant_id,
                    entry_date=run.run_date,
                    description=f"Payroll — {run.reference} ({run.period_start} to {run.period_end})",
                    source="payroll",
                    source_reference=run.reference,
                    lines=pay_lines,
                    created_by=current_user.user_id,
                    module="payroll",
                )
                run.journal_entry_id = entry.id
            else:  # connected — queue for external ERP export
                from app.models.gl import PostingBatch
                batch = PostingBatch(
                    tenant_id=tenant_id,
                    batch_ref=f"BATCH-PAY-{run.run_date.strftime('%Y%m')}-{run.reference}",
                    module="payroll",
                    status="pending",
                    transactions=[{
                        "entry_date": run.run_date.isoformat(),
                        "description": f"Payroll — {run.reference} ({run.period_start} to {run.period_end})",
                        "source_module": "payroll",
                        "source_id": str(run.id),
                        "lines": [
                            {"gl_account_id": str(salary_gl), "debit": float(run.total_gross), "credit": 0.0, "description": "Gross salary expense"},
                            {"gl_account_id": str(payable_gl), "debit": 0.0, "credit": float(run.total_net), "description": "Net salaries payable"},
                        ],
                    }],
                )
                db.add(batch)
                await db.flush()
                run.posting_batch_id = batch.id

    run.status = "APPROVED"
    run.approved_by_id = current_user.user_id
    run.approved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(run)
    return PayrollRunResponse.model_validate(run)


@router.post("/runs/{run_id}/pay", response_model=PayrollRunResponse)
async def mark_payroll_paid(
    run_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> PayrollRunResponse:
    """Mark an APPROVED payroll run as PAID and issue payslips."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(PayrollRun)
        .where(PayrollRun.id == run_id, PayrollRun.tenant_id == tenant_id)
        .options(selectinload(PayrollRun.lines))
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    if run.status != "APPROVED":
        raise HTTPException(status_code=400, detail=f"Cannot pay a {run.status} run.")

    # Issue payslips
    for line in run.lines:
        ref = await _next_payslip_ref(db, tenant_id)
        slip = Payslip(
            run_id=run.id,
            payroll_line_id=line.id,
            tenant_id=tenant_id,
            employee_id=line.employee_id,
            reference=ref,
            payslip_date=run.run_date,
            period_start=run.period_start,
            period_end=run.period_end,
            gross_pay=line.gross_pay,
            total_deductions=line.total_deductions,
            net_pay=line.net_pay,
        )
        db.add(slip)
        line.payment_status = "PAID"

    run.status = "PAID"
    run.paid_by_id = current_user.user_id
    run.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(run)
    return PayrollRunResponse.model_validate(run)


# ── Leave Types ────────────────────────────────────────────────────────────────

@router.get("/leave-types", response_model=list[LeaveTypeResponse])
async def list_leave_types(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> list[LeaveTypeResponse]:
    """List leave types."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(LeaveType).where(LeaveType.tenant_id == tenant_id, LeaveType.is_active.is_(True))
        .order_by(LeaveType.name)
    )
    return [LeaveTypeResponse.model_validate(lt) for lt in result.scalars().all()]


@router.post("/leave-types", response_model=LeaveTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_type(
    body: LeaveTypeCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> LeaveTypeResponse:
    """Create a leave type."""
    tenant_id = _tenant_id(current_user)
    lt = LeaveType(tenant_id=tenant_id, **body.model_dump())
    db.add(lt)
    await db.commit()
    await db.refresh(lt)
    return LeaveTypeResponse.model_validate(lt)


# ── Leave Requests ─────────────────────────────────────────────────────────────

@router.get("/leave-requests", response_model=list[LeaveRequestResponse])
async def list_leave_requests(
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    employee_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
) -> list[LeaveRequestResponse]:
    """List leave requests."""
    tenant_id = _tenant_id(current_user)
    q = select(LeaveRequest).where(LeaveRequest.tenant_id == tenant_id)
    if employee_id:
        q = q.where(LeaveRequest.employee_id == employee_id)
    if status_filter:
        q = q.where(LeaveRequest.status == status_filter.upper())
    q = q.order_by(LeaveRequest.created_at.desc())
    result = await db.execute(q)
    requests = result.scalars().all()
    return [LeaveRequestResponse.model_validate(r) for r in requests]


@router.post("/leave-requests", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    body: LeaveRequestCreate,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> LeaveRequestResponse:
    """Submit a leave request."""
    tenant_id = _tenant_id(current_user)
    req = LeaveRequest(tenant_id=tenant_id, status="PENDING", **body.model_dump())
    db.add(req)

    # Update balance pending
    bal_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.tenant_id == tenant_id,
            LeaveBalance.employee_id == body.employee_id,
            LeaveBalance.leave_type_id == body.leave_type_id,
            LeaveBalance.year == body.start_date.year,
        )
    )
    bal = bal_result.scalar_one_or_none()
    if bal:
        bal.pending = bal.pending + body.days_requested
        bal.remaining = bal.allocated + bal.carried_forward - bal.taken - bal.pending

    await db.commit()
    await db.refresh(req)
    return LeaveRequestResponse.model_validate(req)


@router.post("/leave-requests/{req_id}/approve", response_model=LeaveRequestResponse)
async def approve_leave_request(
    req_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
) -> LeaveRequestResponse:
    """Approve a leave request."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(LeaveRequest).where(LeaveRequest.id == req_id, LeaveRequest.tenant_id == tenant_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve a {req.status} request.")

    req.status = "APPROVED"
    req.approved_by_id = current_user.user_id
    req.approved_at = datetime.now(timezone.utc)

    # Update balance: move from pending to taken
    bal_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.tenant_id == tenant_id,
            LeaveBalance.employee_id == req.employee_id,
            LeaveBalance.leave_type_id == req.leave_type_id,
            LeaveBalance.year == req.start_date.year,
        )
    )
    bal = bal_result.scalar_one_or_none()
    if bal:
        bal.taken = bal.taken + req.days_requested
        bal.pending = max(Decimal("0"), bal.pending - req.days_requested)
        bal.remaining = bal.allocated + bal.carried_forward - bal.taken - bal.pending

    await db.commit()
    await db.refresh(req)
    return LeaveRequestResponse.model_validate(req)


@router.post("/leave-requests/{req_id}/reject", response_model=LeaveRequestResponse)
async def reject_leave_request(
    req_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    reason: Optional[str] = Query(None),
) -> LeaveRequestResponse:
    """Reject a leave request."""
    tenant_id = _tenant_id(current_user)
    result = await db.execute(
        select(LeaveRequest).where(LeaveRequest.id == req_id, LeaveRequest.tenant_id == tenant_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    req.status = "REJECTED"
    req.rejection_reason = reason

    # Release pending balance
    bal_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.tenant_id == tenant_id,
            LeaveBalance.employee_id == req.employee_id,
            LeaveBalance.leave_type_id == req.leave_type_id,
            LeaveBalance.year == req.start_date.year,
        )
    )
    bal = bal_result.scalar_one_or_none()
    if bal:
        bal.pending = max(Decimal("0"), bal.pending - req.days_requested)
        bal.remaining = bal.allocated + bal.carried_forward - bal.taken - bal.pending

    await db.commit()
    await db.refresh(req)
    return LeaveRequestResponse.model_validate(req)


# ── Leave Balances ─────────────────────────────────────────────────────────────

@router.get("/leave-balances/{employee_id}", response_model=list[LeaveBalanceResponse])
async def get_leave_balances(
    employee_id: uuid.UUID,
    current_user: Annotated[UserTenant, Depends(require_auth)],
    db: AsyncSession = Depends(get_db),
    year: Optional[int] = Query(None),
) -> list[LeaveBalanceResponse]:
    """Get leave balances for an employee."""
    tenant_id = _tenant_id(current_user)
    q = select(LeaveBalance).where(
        LeaveBalance.tenant_id == tenant_id,
        LeaveBalance.employee_id == employee_id,
    )
    if year:
        q = q.where(LeaveBalance.year == year)
    result = await db.execute(q)
    balances = result.scalars().all()
    return [LeaveBalanceResponse.model_validate(b) for b in balances]
