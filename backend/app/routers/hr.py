"""
ZivaBI — M8.1 / M8.2 HR module router.

Registered at prefix /api/hr.

Endpoints:
  Employees:
    GET    /api/hr/employees                         List employees (paginated, searchable)
    POST   /api/hr/employees                         Create single employee
    PATCH  /api/hr/employees/{id}                    Update employee
    DELETE /api/hr/employees/{id}                    Soft delete (deactivate)
    POST   /api/hr/employees/upload                  Bulk upload via xlsx/csv
    GET    /api/hr/employees/template                Download employee upload template
    POST   /api/hr/employees/{id}/transfer           Transfer to new cost center
    POST   /api/hr/employees/{id}/update-code        Update employee code (retro/progressive)
    GET    /api/hr/employees/{id}/history            View code change + transfer history
    POST   /api/hr/employees/invite                  Send self-onboarding invite (M8.2)
    POST   /api/hr/employees/{id}/approve-onboarding Approve HR self-onboarding (M8.2)
    POST   /api/hr/employees/{id}/reject-onboarding  Reject HR self-onboarding with comment (M8.2)

  Cost Center Config:
    GET    /api/hr/cost-centers                      List cost centers with head assignments
    PUT    /api/hr/cost-centers/{id}/head            Set or update cost center head

  Finance Review Config:
    GET    /api/hr/finance-review                    List finance reviewers by module
    POST   /api/hr/finance-review                    Add a reviewer
    PATCH  /api/hr/finance-review/{id}               Update reviewer level/scope
    DELETE /api/hr/finance-review/{id}               Remove reviewer

Public (no auth required):
  GET    /onboard/{token}                            Validate token and return employee stub
  POST   /onboard/{token}                            New hire submits self-onboarding form

All authenticated endpoints are tenant-scoped and require authentication.
Admin-only operations require is_tenant_admin or is_super_admin.
"""

import csv
import io
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.master_data import (
    CostCenterConfig,
    DimensionValue,
    Employee,
    EmployeeCodeHistory,
    EmployeeTransfer,
    FinanceReviewConfig,
    TenantDimension,
)
from app.models.setup import EmployeeOnboardingToken
from app.models.auth import Tenant
from app.schemas.setup import EmployeeInviteCreate, SelfOnboardingSubmit, SelfOnboardingTokenResponse
from app.schemas.hr import (
    CodeUpdateRequest,
    CodeHistoryResponse,
    CostCenterConfigResponse,
    CostCenterHeadUpdate,
    EmployeeCreate,
    EmployeeHistoryResponse,
    EmployeeListItem,
    EmployeeResponse,
    EmployeeUpdate,
    EmployeeUploadResult,
    FinanceReviewConfigResponse,
    FinanceReviewerCreate,
    FinanceReviewerUpdate,
    TransferCreate,
    TransferResponse,
)

router = APIRouter(prefix="/api/hr", tags=["hr"])


# ── Shared helpers ────────────────────────────────────────────────────────────

def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature is only available on business accounts.",
        )
    return current_user.tenant_id


def _require_admin(current_user: CurrentUser) -> None:
    if not current_user.is_tenant_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Tenant Admins can perform this action.",
        )


async def _get_employee_or_404(
    employee_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> Employee:
    result = await db.execute(
        select(Employee)
        .where(Employee.id == employee_id, Employee.tenant_id == tenant_id)
        .options(
            selectinload(Employee.cost_center),
            selectinload(Employee.line_manager),
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return emp


async def _next_employee_code(tenant_id: uuid.UUID, db: AsyncSession) -> str:
    """
    Generate the next auto employee code for the tenant.

    Uses prefix EMP- with 5-digit zero-padded sequence based on existing count.
    Prefix/format customisation is out of scope for M8.1 — placeholder pattern.
    """
    result = await db.execute(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.employee_code.isnot(None),
            Employee.employee_code_auto_generated == True,  # noqa: E712
        )
    )
    count = len(result.scalars().all())
    return f"EMP-{count + 1:05d}"


# ═══════════════════════════════════════════════════════════════════════════════
# EMPLOYEES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/employees/template")
async def download_employee_template(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Download the employee bulk upload template (.xlsx)."""
    _require_tenant(current_user)

    try:
        import openpyxl
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openpyxl is not installed.",
        ) from exc

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Employees"
    ws.freeze_panes = "A2"

    req_fill = PatternFill("solid", fgColor="DBEAFE")
    opt_fill = PatternFill("solid", fgColor="F3F4F6")
    hdr_font = Font(bold=True, size=10)
    instr_font = Font(italic=True, color="6B7280", size=9)

    headers = [
        ("First Name*", True), ("Last Name*", True), ("Email*", True),
        ("Other Name", False), ("Preferred Name", False),
        ("Employee Code", False), ("Phone", False),
        ("Cost Center Code", False), ("Line Manager Email", False),
        ("Resumption Date (dd/mm/yyyy)", False),
    ]
    instructions = [
        "e.g. Adeniyi", "e.g. Oladunmoye", "e.g. adeniyi@company.com",
        "Middle or other name", "Display name",
        "Leave blank if auto-generate is on",
        "e.g. +234-801-234-5678",
        "Must match a dimension value code",
        "Must match an existing employee email",
        "e.g. 01/01/2024",
    ]
    example = [
        "Adeniyi", "Oladunmoye", "adeniyi@company.com",
        "", "Ade", "EMP-00001", "+234-801-234-5678",
        "NG_FI", "manager@company.com", "01/01/2024",
    ]

    for ci, (h, is_req) in enumerate(headers, 1):
        cell = ws.cell(row=1, column=ci, value=h)
        cell.fill = req_fill if is_req else opt_fill
        cell.font = hdr_font
        cell.alignment = Alignment(horizontal="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(ci)].width = max(18, len(h) + 2)
    ws.row_dimensions[1].height = 30

    for ci, instr in enumerate(instructions, 1):
        cell = ws.cell(row=2, column=ci, value=instr)
        cell.font = instr_font
        cell.fill = opt_fill

    for ci, val in enumerate(example, 1):
        ws.cell(row=3, column=ci, value=val)

    # Sheet 2 — Instructions
    ws2 = wb.create_sheet("Instructions")
    rows = [
        ["COLUMN", "REQUIRED", "DESCRIPTION"],
        ["First Name", "Yes", "Employee's first name."],
        ["Last Name", "Yes", "Employee's last name."],
        ["Email", "Yes", "Employee's work email. Must be unique per company."],
        ["Other Name", "No", "Middle name or other name."],
        ["Preferred Name", "No", "Name to display on expense forms (defaults to First Name)."],
        ["Employee Code", "No", "Required if auto-generate is turned off in HR settings."],
        ["Phone", "No", "Phone number including country code."],
        ["Cost Center Code", "No", "Must exactly match a dimension value code in your configured Cost Center dimension."],
        ["Line Manager Email", "No", "Must match the email of an existing employee in this upload or already in the system."],
        ["Resumption Date", "No", "Date the employee joined. Format: dd/mm/yyyy."],
    ]
    ws2.column_dimensions["A"].width = 22
    ws2.column_dimensions["B"].width = 12
    ws2.column_dimensions["C"].width = 70
    for ri, row_vals in enumerate(rows, 1):
        for ci, val in enumerate(row_vals, 1):
            cell = ws2.cell(row=ri, column=ci, value=val)
            if ri == 1:
                cell.font = Font(bold=True)
                cell.fill = req_fill

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=employee_template.xlsx"},
    )


@router.get("/employees", response_model=list[EmployeeListItem])
async def list_employees(
    search: str = Query(default="", description="Search name, email, or employee code"),
    cost_center_id: Optional[uuid.UUID] = Query(default=None),
    active_only: bool = Query(default=True),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[EmployeeListItem]:
    """List employees for the tenant (paginated, searchable)."""
    tenant_id = _require_tenant(current_user)

    q = (
        select(Employee)
        .where(Employee.tenant_id == tenant_id)
        .options(
            selectinload(Employee.cost_center),
            selectinload(Employee.line_manager),
        )
        .order_by(Employee.last_name, Employee.first_name)
        .limit(limit)
        .offset(offset)
    )
    if active_only:
        q = q.where(Employee.is_active == True)  # noqa: E712
    if cost_center_id:
        q = q.where(Employee.cost_center_id == cost_center_id)
    if search.strip():
        term = f"%{search.strip()}%"
        q = q.where(
            Employee.first_name.ilike(term)
            | Employee.last_name.ilike(term)
            | Employee.email.ilike(term)
            | Employee.employee_code.ilike(term)
        )

    result = await db.execute(q)
    return [EmployeeListItem.from_orm(e) for e in result.scalars().all()]


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    """Create a single employee. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    # Check email uniqueness
    existing_email = await db.execute(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.email == data.email,
        )
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An employee with email '{data.email}' already exists.",
        )

    employee_code = data.employee_code
    auto_generated = False
    if not employee_code:
        employee_code = await _next_employee_code(tenant_id, db)
        auto_generated = True

    emp = Employee(
        tenant_id=tenant_id,
        first_name=data.first_name,
        last_name=data.last_name,
        other_name=data.other_name,
        preferred_name=data.preferred_name,
        email=data.email,
        phone=data.phone,
        employee_code=employee_code,
        employee_code_auto_generated=auto_generated,
        cost_center_id=data.cost_center_id,
        line_manager_id=data.line_manager_id,
        resumption_date=data.resumption_date,
    )
    db.add(emp)
    await db.flush()
    await db.refresh(emp)

    # Record initial code in history
    db.add(EmployeeCodeHistory(
        tenant_id=tenant_id,
        employee_id=emp.id,
        old_code=None,
        new_code=employee_code,
        change_type="progressive",
        effective_date=data.resumption_date or __import__("datetime").date.today(),
        changed_by=current_user.id,
    ))
    await db.flush()

    return await _get_employee_or_404(emp.id, tenant_id, db)  # type: ignore[return-value]


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: uuid.UUID,
    data: EmployeeUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    """Update an employee (PATCH semantics). Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    emp = await _get_employee_or_404(employee_id, tenant_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(emp, field, value)

    await db.flush()
    return await _get_employee_or_404(employee_id, tenant_id, db)  # type: ignore[return-value]


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete (deactivate) an employee. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    emp = await _get_employee_or_404(employee_id, tenant_id, db)
    emp.is_active = False
    await db.flush()


@router.post("/employees/{employee_id}/transfer", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def transfer_employee(
    employee_id: uuid.UUID,
    data: TransferCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TransferResponse:
    """Transfer an employee to a new cost center. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    emp = await _get_employee_or_404(employee_id, tenant_id, db)

    # Verify target cost center belongs to this tenant
    cc_result = await db.execute(
        select(DimensionValue).where(
            DimensionValue.id == data.to_cost_center_id,
            DimensionValue.tenant_id == tenant_id,
        )
    )
    if not cc_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cost center not found.")

    transfer = EmployeeTransfer(
        tenant_id=tenant_id,
        employee_id=employee_id,
        from_cost_center_id=emp.cost_center_id,
        to_cost_center_id=data.to_cost_center_id,
        effective_date=data.effective_date,
        notes=data.notes,
        transferred_by=current_user.id,
    )
    db.add(transfer)

    emp.cost_center_id = data.to_cost_center_id
    await db.flush()
    await db.refresh(transfer)

    result = await db.execute(
        select(EmployeeTransfer)
        .where(EmployeeTransfer.id == transfer.id)
        .options(
            selectinload(EmployeeTransfer.from_cost_center),
            selectinload(EmployeeTransfer.to_cost_center),
        )
    )
    return TransferResponse.from_orm(result.scalar_one())


@router.post("/employees/{employee_id}/update-code", response_model=EmployeeResponse)
async def update_employee_code(
    employee_id: uuid.UUID,
    data: CodeUpdateRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    """Update employee code (retrospective or progressive). Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    emp = await _get_employee_or_404(employee_id, tenant_id, db)

    # Check uniqueness of new code
    existing = await db.execute(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.employee_code == data.new_code,
            Employee.id != employee_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee code '{data.new_code}' is already in use.",
        )

    db.add(EmployeeCodeHistory(
        tenant_id=tenant_id,
        employee_id=employee_id,
        old_code=emp.employee_code,
        new_code=data.new_code,
        change_type=data.change_type,
        effective_date=data.effective_date,
        changed_by=current_user.id,
        notes=data.notes,
    ))
    emp.employee_code = data.new_code
    emp.employee_code_auto_generated = False
    await db.flush()

    return await _get_employee_or_404(employee_id, tenant_id, db)  # type: ignore[return-value]


@router.get("/employees/{employee_id}/history", response_model=EmployeeHistoryResponse)
async def get_employee_history(
    employee_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> EmployeeHistoryResponse:
    """Get the code change and transfer history for an employee."""
    tenant_id = _require_tenant(current_user)
    await _get_employee_or_404(employee_id, tenant_id, db)

    code_result = await db.execute(
        select(EmployeeCodeHistory)
        .where(EmployeeCodeHistory.employee_id == employee_id)
        .order_by(EmployeeCodeHistory.effective_date.desc(), EmployeeCodeHistory.changed_at.desc())
    )
    transfers_result = await db.execute(
        select(EmployeeTransfer)
        .where(EmployeeTransfer.employee_id == employee_id)
        .options(
            selectinload(EmployeeTransfer.from_cost_center),
            selectinload(EmployeeTransfer.to_cost_center),
        )
        .order_by(EmployeeTransfer.effective_date.desc())
    )

    return EmployeeHistoryResponse(
        code_history=[CodeHistoryResponse.from_orm(r) for r in code_result.scalars().all()],
        transfers=[TransferResponse.from_orm(t) for t in transfers_result.scalars().all()],
    )


@router.post("/employees/upload", response_model=EmployeeUploadResult)
async def upload_employees(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> EmployeeUploadResult:
    """
    Bulk upload employees from .xlsx or .csv.

    Required columns: First Name, Last Name, Email.
    Optional: Other Name, Preferred Name, Employee Code, Phone,
              Cost Center Code, Line Manager Email, Resumption Date.
    Duplicate email = update existing record.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    content = await file.read()
    fname = (file.filename or "").lower()

    headers: list[str] = []
    rows: list[list[str]] = []

    if fname.endswith(".xlsx"):
        try:
            import openpyxl
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="openpyxl not installed.") from exc
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
        ws = wb.active
        all_rows: list[list[str]] = []
        for row in ws.iter_rows(values_only=True):
            all_rows.append([str(c).strip() if c is not None else "" for c in row])
        if all_rows:
            headers = all_rows[0]
            # Skip instruction rows (template has example row 2 + instruction row 3)
            rows = all_rows[3:]
    elif fname.endswith(".csv"):
        text = content.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        all_rows_csv = list(reader)
        if all_rows_csv:
            headers = [h.strip() for h in all_rows_csv[0]]
            rows = [[c.strip() for c in r] for r in all_rows_csv[1:]]
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported.")

    h = [hdr.lower().strip("*").strip() for hdr in headers]

    def col(name: str) -> Optional[int]:
        try:
            return h.index(name)
        except ValueError:
            return None

    fn_col = col("first name")
    ln_col = col("last name")
    em_col = col("email")
    on_col = col("other name")
    pn_col = col("preferred name")
    code_col = col("employee code")
    ph_col = col("phone")
    cc_col = col("cost center code")
    mgr_col = col("line manager email")
    res_col = col("resumption date (dd/mm/yyyy)") or col("resumption date")

    if fn_col is None or ln_col is None or em_col is None:
        raise HTTPException(
            status_code=400,
            detail="File must have 'First Name', 'Last Name', and 'Email' columns.",
        )

    # Load all cost center dimension values for lookup
    cc_result = await db.execute(
        select(DimensionValue).where(DimensionValue.tenant_id == tenant_id)
    )
    cc_by_code = {dv.code.lower(): dv for dv in cc_result.scalars().all()}

    imported = 0
    updated = 0
    errors: list[dict] = []
    email_to_emp: dict[str, Employee] = {}  # track newly created employees for mgr lookup

    from datetime import datetime as _dt3

    for i, row in enumerate(rows, start=4):
        if not any((c or "").strip() for c in row):
            continue

        def get(idx: Optional[int]) -> str:
            if idx is None or idx >= len(row):
                return ""
            return (row[idx] or "").strip()

        first_name = get(fn_col)
        last_name = get(ln_col)
        email = get(em_col)

        if not first_name:
            errors.append({"row": i, "reason": "Missing First Name."})
            continue
        if not last_name:
            errors.append({"row": i, "reason": "Missing Last Name."})
            continue
        if not email:
            errors.append({"row": i, "reason": "Missing Email."})
            continue

        other_name = get(on_col) or None
        preferred_name = get(pn_col) or None
        employee_code = get(code_col) or None
        phone = get(ph_col) or None
        cc_code = get(cc_col)
        mgr_email = get(mgr_col)
        res_str = get(res_col)

        cost_center_id = None
        if cc_code:
            dv = cc_by_code.get(cc_code.lower())
            if not dv:
                errors.append({"row": i, "reason": f"Cost center code '{cc_code}' not found."})
            else:
                cost_center_id = dv.id

        resumption_date = None
        if res_str:
            for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
                try:
                    resumption_date = _dt3.strptime(res_str, fmt).date()
                    break
                except ValueError:
                    continue
            else:
                errors.append({"row": i, "reason": f"Invalid Resumption Date: '{res_str}'."})

        # Upsert by email
        existing_result = await db.execute(
            select(Employee).where(
                Employee.tenant_id == tenant_id,
                Employee.email == email,
            )
        )
        emp_obj = existing_result.scalar_one_or_none()
        if emp_obj:
            emp_obj.first_name = first_name
            emp_obj.last_name = last_name
            emp_obj.other_name = other_name
            emp_obj.preferred_name = preferred_name
            emp_obj.phone = phone
            if cost_center_id:
                emp_obj.cost_center_id = cost_center_id
            if resumption_date:
                emp_obj.resumption_date = resumption_date
            updated += 1
        else:
            auto_generated = False
            if not employee_code:
                employee_code = await _next_employee_code(tenant_id, db)
                auto_generated = True
            emp_obj = Employee(
                tenant_id=tenant_id,
                first_name=first_name,
                last_name=last_name,
                other_name=other_name,
                preferred_name=preferred_name,
                email=email,
                phone=phone,
                employee_code=employee_code,
                employee_code_auto_generated=auto_generated,
                cost_center_id=cost_center_id,
                resumption_date=resumption_date,
            )
            db.add(emp_obj)
            imported += 1

        await db.flush()
        await db.refresh(emp_obj)
        email_to_emp[email.lower()] = emp_obj

    # Second pass — resolve line manager emails
    for i, row in enumerate(rows, start=4):
        if not any((c or "").strip() for c in row):
            continue

        def get2(idx: Optional[int]) -> str:
            if idx is None or idx >= len(row):
                return ""
            return (row[idx] or "").strip()

        email = get2(em_col)
        mgr_email = get2(mgr_col)
        if not email or not mgr_email:
            continue

        emp_obj = email_to_emp.get(email.lower())
        mgr_obj = email_to_emp.get(mgr_email.lower())
        if not mgr_obj:
            # Check DB
            mgr_result = await db.execute(
                select(Employee).where(
                    Employee.tenant_id == tenant_id,
                    Employee.email == mgr_email,
                )
            )
            mgr_obj = mgr_result.scalar_one_or_none()
        if mgr_obj and emp_obj:
            emp_obj.line_manager_id = mgr_obj.id
        elif emp_obj:
            errors.append({"row": i, "reason": f"Line manager '{mgr_email}' not found."})

    await db.flush()
    skipped = max(0, len([r for r in rows if any((c or "").strip() for c in r)]) - imported - updated)
    return EmployeeUploadResult(imported=imported, updated=updated, skipped=skipped, errors=errors)


# ═══════════════════════════════════════════════════════════════════════════════
# COST CENTER CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/cost-centers", response_model=list[CostCenterConfigResponse])
async def list_cost_center_configs(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[CostCenterConfigResponse]:
    """List all cost center head assignments for the tenant."""
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(CostCenterConfig)
        .where(CostCenterConfig.tenant_id == tenant_id)
        .options(
            selectinload(CostCenterConfig.cost_center),
            selectinload(CostCenterConfig.head_employee),
            selectinload(CostCenterConfig.head_user),
        )
        .order_by(CostCenterConfig.created_at)
    )
    return [CostCenterConfigResponse.from_orm(c) for c in result.scalars().all()]


@router.put("/cost-centers/{cost_center_id}/head", response_model=CostCenterConfigResponse)
async def set_cost_center_head(
    cost_center_id: uuid.UUID,
    data: CostCenterHeadUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CostCenterConfigResponse:
    """Set or update the head of a cost center. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    # Verify cost center belongs to tenant
    cc_result = await db.execute(
        select(DimensionValue).where(
            DimensionValue.id == cost_center_id,
            DimensionValue.tenant_id == tenant_id,
        )
    )
    if not cc_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cost center not found.")

    cfg_result = await db.execute(
        select(CostCenterConfig).where(
            CostCenterConfig.cost_center_id == cost_center_id,
            CostCenterConfig.tenant_id == tenant_id,
        )
    )
    cfg = cfg_result.scalar_one_or_none()
    if cfg:
        cfg.head_employee_id = data.head_employee_id
        cfg.head_user_id = data.head_user_id
    else:
        cfg = CostCenterConfig(
            tenant_id=tenant_id,
            cost_center_id=cost_center_id,
            head_employee_id=data.head_employee_id,
            head_user_id=data.head_user_id,
        )
        db.add(cfg)

    await db.flush()
    await db.refresh(cfg)

    result2 = await db.execute(
        select(CostCenterConfig)
        .where(CostCenterConfig.id == cfg.id)
        .options(
            selectinload(CostCenterConfig.cost_center),
            selectinload(CostCenterConfig.head_employee),
            selectinload(CostCenterConfig.head_user),
        )
    )
    return CostCenterConfigResponse.from_orm(result2.scalar_one())


# ═══════════════════════════════════════════════════════════════════════════════
# FINANCE REVIEW CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/finance-review", response_model=list[FinanceReviewConfigResponse])
async def list_finance_reviewers(
    module: str = Query(default="expense_retirement"),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[FinanceReviewConfigResponse]:
    """List finance reviewers for a module, ordered by review level."""
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(FinanceReviewConfig)
        .where(
            FinanceReviewConfig.tenant_id == tenant_id,
            FinanceReviewConfig.module == module,
        )
        .options(
            selectinload(FinanceReviewConfig.reviewer),
            selectinload(FinanceReviewConfig.cost_center),
        )
        .order_by(FinanceReviewConfig.review_level, FinanceReviewConfig.created_at)
    )
    return [FinanceReviewConfigResponse.from_orm(r) for r in result.scalars().all()]


@router.post("/finance-review", response_model=FinanceReviewConfigResponse, status_code=status.HTTP_201_CREATED)
async def add_finance_reviewer(
    data: FinanceReviewerCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> FinanceReviewConfigResponse:
    """Add a finance reviewer. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    cfg = FinanceReviewConfig(
        tenant_id=tenant_id,
        module=data.module,
        reviewer_user_id=data.reviewer_user_id,
        review_level=data.review_level,
        cost_center_id=data.cost_center_id,
    )
    db.add(cfg)
    await db.flush()
    await db.refresh(cfg)

    result = await db.execute(
        select(FinanceReviewConfig)
        .where(FinanceReviewConfig.id == cfg.id)
        .options(
            selectinload(FinanceReviewConfig.reviewer),
            selectinload(FinanceReviewConfig.cost_center),
        )
    )
    return FinanceReviewConfigResponse.from_orm(result.scalar_one())


@router.patch("/finance-review/{reviewer_id}", response_model=FinanceReviewConfigResponse)
async def update_finance_reviewer(
    reviewer_id: uuid.UUID,
    data: FinanceReviewerUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> FinanceReviewConfigResponse:
    """Update a reviewer's level or scope. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(FinanceReviewConfig).where(
            FinanceReviewConfig.id == reviewer_id,
            FinanceReviewConfig.tenant_id == tenant_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reviewer config not found.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cfg, field, value)
    await db.flush()

    result2 = await db.execute(
        select(FinanceReviewConfig)
        .where(FinanceReviewConfig.id == reviewer_id)
        .options(
            selectinload(FinanceReviewConfig.reviewer),
            selectinload(FinanceReviewConfig.cost_center),
        )
    )
    return FinanceReviewConfigResponse.from_orm(result2.scalar_one())


@router.delete("/finance-review/{reviewer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_finance_reviewer(
    reviewer_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a finance reviewer. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(FinanceReviewConfig).where(
            FinanceReviewConfig.id == reviewer_id,
            FinanceReviewConfig.tenant_id == tenant_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reviewer config not found.")

    await db.delete(cfg)
    await db.flush()


# ── Employee Self-onboarding (M8.2) ──────────────────────────────────────────

@router.post("/employees/invite", status_code=201)
async def send_employee_invite(
    data: EmployeeInviteCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    HR creates a basic employee record and sends a self-onboarding invite.

    Creates employee with status='pending_self_onboarding', generates a
    30-day secure token, and logs the onboarding link (email TBD).
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    emp = Employee(
        tenant_id=tenant_id,
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        cost_center_id=data.cost_center_id,
        resumption_date=data.start_date,
        is_active=False,
    )
    db.add(emp)
    await db.flush()

    token_value = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    token = EmployeeOnboardingToken(
        tenant_id=tenant_id,
        employee_id=emp.id,
        token=token_value,
        expires_at=expires_at,
    )
    db.add(token)
    await db.commit()

    # Log link to console — email integration in a future milestone
    onboarding_link = f"/onboard/{token_value}"
    print(f"[ONBOARDING] Invite for {data.email}: {onboarding_link}")

    return {
        "message": "Invite created successfully.",
        "employee_id": str(emp.id),
        "onboarding_link": onboarding_link,
    }


@router.post("/employees/{employee_id}/approve-onboarding", status_code=200)
async def approve_employee_onboarding(
    employee_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """HR approves a self-onboarding submission. Activates the employee from their start date."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    emp.is_active = True
    await db.commit()
    return {"message": "Employee onboarding approved. Account is now active."}


@router.post("/employees/{employee_id}/reject-onboarding", status_code=200)
async def reject_employee_onboarding(
    employee_id: uuid.UUID,
    comment: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """HR rejects self-onboarding with a comment. Employee stays in pending state."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    # Log rejection comment — store in employee notes in future
    print(f"[ONBOARDING] Rejected employee {employee_id}: {comment}")
    return {"message": "Onboarding rejected.", "comment": comment}
