"""
ZivaBI — M8 master data configuration router.

Registered at prefix /api/config.

Endpoints:
  Dimensions:
    GET    /api/config/dimensions                      List tenant dimensions
    POST   /api/config/dimensions                      Create dimension
    PATCH  /api/config/dimensions/{id}                 Update dimension
    DELETE /api/config/dimensions/{id}                 Soft delete (is_active=false)
    POST   /api/config/dimensions/{id}/reorder         Update sort_order

  Dimension Values:
    GET    /api/config/dimensions/{id}/values          List values for a dimension
    POST   /api/config/dimensions/{id}/values          Add single value
    PATCH  /api/config/dimensions/{id}/values/{vid}    Update value
    DELETE /api/config/dimensions/{id}/values/{vid}    Soft delete
    POST   /api/config/dimensions/{id}/values/upload   Bulk upload (xlsx/csv)

  Chart of Accounts:
    GET    /api/config/coa                             List GL accounts (paginated, searchable)
    POST   /api/config/coa                             Create single GL account
    PATCH  /api/config/coa/{id}                        Update GL account
    DELETE /api/config/coa/{id}                        Soft delete
    GET    /api/config/coa/template                    Download dynamically generated xlsx template
    POST   /api/config/coa/upload                      Bulk upload (xlsx/csv)
    PATCH  /api/config/coa/{id}/dimensions             Set dimension requirements for a GL account

  Expense Categories:
    GET    /api/config/categories                      List full category tree with GL mappings
    POST   /api/config/categories                      Create category or subcategory
    PATCH  /api/config/categories/{id}                 Update
    DELETE /api/config/categories/{id}                 Soft delete (cascades to subcategories)
    POST   /api/config/categories/{id}/gl-mappings     Add GL account to subcategory
    DELETE /api/config/categories/{id}/gl-mappings/{gl_id}  Remove GL mapping
    PATCH  /api/config/categories/{id}/gl-mappings/{gl_id}  Set/unset as default

  GL Search (M9):
    GET    /api/config/gl/search?q=...&limit=20        Search GL accounts with dimension requirements

All endpoints are tenant-scoped and require authentication.
Admin-only operations require is_tenant_admin or is_super_admin.
"""

import csv
import io
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.expenses import ExpenseCategory
from app.models.master_data import (
    CategoryGLMapping,
    ChartOfAccount,
    DimensionValue,
    GLDimensionRequirement,
    TenantDimension,
)
from app.schemas.config import (
    CategoryCreate,
    CategoryGLMappingCreate,
    CategoryGLMappingResponse,
    CategoryUpdate,
    CategoryWithMappingsResponse,
    CoACreate,
    CoADimensionsUpdate,
    CoAListItem,
    CoAResponse,
    CoAUpdate,
    DimensionCreate,
    DimensionReorder,
    DimensionResponse,
    DimensionUpdate,
    DimensionValueCreate,
    DimensionValueResponse,
    DimensionValueUpdate,
    GLSearchResult,
    UploadResult,
    _generate_code,
)

router = APIRouter(prefix="/api/config", tags=["config"])


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
            detail="Only Tenant Admins can modify configuration.",
        )


async def _parse_upload(file: UploadFile) -> tuple[list[str], list[list[str]]]:
    """
    Parse an uploaded CSV or XLSX file into (headers, data_rows).

    Returns headers as a list of strings and rows as lists of strings.
    Raises HTTPException for unsupported formats.
    """
    content = await file.read()
    fname = (file.filename or "").lower()

    if fname.endswith(".csv"):
        text = content.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        all_rows = list(reader)
        if not all_rows:
            return [], []
        return [h.strip() for h in all_rows[0]], [
            [cell.strip() for cell in row] for row in all_rows[1:]
        ]

    elif fname.endswith(".xlsx"):
        try:
            import openpyxl
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="openpyxl is not installed. Run: pip install openpyxl",
            ) from exc
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
        ws = wb.active
        rows: list[list[str]] = []
        for row in ws.iter_rows(values_only=True):
            rows.append([str(cell).strip() if cell is not None else "" for cell in row])
        if not rows:
            return [], []
        return rows[0], rows[1:]

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv and .xlsx files are supported.",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# DIMENSIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dimensions", response_model=list[DimensionResponse])
async def list_dimensions(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[DimensionResponse]:
    """List all dimensions for the tenant, ordered by sort_order then name."""
    tenant_id = _require_tenant(current_user)
    result = await db.execute(
        select(TenantDimension)
        .where(TenantDimension.tenant_id == tenant_id)
        .order_by(TenantDimension.sort_order, TenantDimension.name)
    )
    return [DimensionResponse.from_orm(d) for d in result.scalars().all()]


@router.post("/dimensions", response_model=DimensionResponse, status_code=status.HTTP_201_CREATED)
async def create_dimension(
    data: DimensionCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DimensionResponse:
    """Create a new dimension for the tenant. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    code = data.code or _generate_code(data.name)

    # Check uniqueness
    existing = await db.execute(
        select(TenantDimension).where(
            TenantDimension.tenant_id == tenant_id,
            TenantDimension.code == code,
            TenantDimension.is_active == True,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A dimension with code '{code}' already exists.",
        )

    dim = TenantDimension(
        tenant_id=tenant_id,
        name=data.name,
        code=code,
        is_required=data.is_required,
    )
    db.add(dim)
    await db.flush()
    await db.refresh(dim)
    return DimensionResponse.from_orm(dim)


@router.patch("/dimensions/{dimension_id}", response_model=DimensionResponse)
async def update_dimension(
    dimension_id: uuid.UUID,
    data: DimensionUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DimensionResponse:
    """Update a dimension (PATCH semantics). Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(TenantDimension).where(
            TenantDimension.id == dimension_id,
            TenantDimension.tenant_id == tenant_id,
        )
    )
    dim = result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dimension not found.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dim, field, value)

    await db.flush()
    await db.refresh(dim)
    return DimensionResponse.from_orm(dim)


@router.delete("/dimensions/{dimension_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dimension(
    dimension_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a dimension (set is_active=false). Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(TenantDimension).where(
            TenantDimension.id == dimension_id,
            TenantDimension.tenant_id == tenant_id,
        )
    )
    dim = result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dimension not found.")

    dim.is_active = False
    await db.flush()


@router.post("/dimensions/{dimension_id}/reorder", response_model=DimensionResponse)
async def reorder_dimension(
    dimension_id: uuid.UUID,
    data: DimensionReorder,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DimensionResponse:
    """Update the sort_order of a dimension. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(TenantDimension).where(
            TenantDimension.id == dimension_id,
            TenantDimension.tenant_id == tenant_id,
        )
    )
    dim = result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dimension not found.")

    dim.sort_order = data.sort_order
    await db.flush()
    await db.refresh(dim)
    return DimensionResponse.from_orm(dim)


# ═══════════════════════════════════════════════════════════════════════════════
# DIMENSION VALUES
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_dimension_or_404(
    dimension_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> TenantDimension:
    result = await db.execute(
        select(TenantDimension).where(
            TenantDimension.id == dimension_id,
            TenantDimension.tenant_id == tenant_id,
        )
    )
    dim = result.scalar_one_or_none()
    if not dim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dimension not found.")
    return dim


@router.get("/dimensions/{dimension_id}/values", response_model=list[DimensionValueResponse])
async def list_dimension_values(
    dimension_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[DimensionValueResponse]:
    """List all values for a dimension, ordered by sort_order then code."""
    tenant_id = _require_tenant(current_user)
    await _get_dimension_or_404(dimension_id, tenant_id, db)

    result = await db.execute(
        select(DimensionValue)
        .where(
            DimensionValue.dimension_id == dimension_id,
            DimensionValue.tenant_id == tenant_id,
        )
        .order_by(DimensionValue.sort_order, DimensionValue.code)
    )
    return [DimensionValueResponse.from_orm(v) for v in result.scalars().all()]


@router.post(
    "/dimensions/{dimension_id}/values",
    response_model=DimensionValueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dimension_value(
    dimension_id: uuid.UUID,
    data: DimensionValueCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DimensionValueResponse:
    """Add a single value to a dimension. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    dim = await _get_dimension_or_404(dimension_id, tenant_id, db)

    existing = await db.execute(
        select(DimensionValue).where(
            DimensionValue.dimension_id == dimension_id,
            DimensionValue.tenant_id == tenant_id,
            DimensionValue.code == data.code,
            DimensionValue.is_active == True,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A value with code '{data.code}' already exists for this dimension.",
        )

    val = DimensionValue(
        tenant_id=tenant_id,
        dimension_id=dim.id,
        code=data.code,
        name=data.name,
        sort_order=data.sort_order,
    )
    db.add(val)
    await db.flush()
    await db.refresh(val)
    return DimensionValueResponse.from_orm(val)


@router.patch(
    "/dimensions/{dimension_id}/values/{value_id}",
    response_model=DimensionValueResponse,
)
async def update_dimension_value(
    dimension_id: uuid.UUID,
    value_id: uuid.UUID,
    data: DimensionValueUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DimensionValueResponse:
    """Update a dimension value (PATCH semantics). Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(DimensionValue).where(
            DimensionValue.id == value_id,
            DimensionValue.dimension_id == dimension_id,
            DimensionValue.tenant_id == tenant_id,
        )
    )
    val = result.scalar_one_or_none()
    if not val:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Value not found.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(val, field, value)

    await db.flush()
    await db.refresh(val)
    return DimensionValueResponse.from_orm(val)


@router.delete(
    "/dimensions/{dimension_id}/values/{value_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_dimension_value(
    dimension_id: uuid.UUID,
    value_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a dimension value. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(DimensionValue).where(
            DimensionValue.id == value_id,
            DimensionValue.dimension_id == dimension_id,
            DimensionValue.tenant_id == tenant_id,
        )
    )
    val = result.scalar_one_or_none()
    if not val:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Value not found.")

    val.is_active = False
    await db.flush()


@router.post(
    "/dimensions/{dimension_id}/values/upload",
    response_model=UploadResult,
)
async def upload_dimension_values(
    dimension_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UploadResult:
    """
    Bulk upload dimension values from .xlsx or .csv file.

    Expected columns: code (required), name (required), sort_order (optional).
    Skips duplicates by code (does not overwrite existing active values).
    Returns import summary: imported, skipped, errors.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    dim = await _get_dimension_or_404(dimension_id, tenant_id, db)

    headers, rows = await _parse_upload(file)
    headers_lower = [h.lower() for h in headers]

    def col(name: str) -> Optional[int]:
        try:
            return headers_lower.index(name)
        except ValueError:
            return None

    code_col = col("code")
    name_col = col("name")
    order_col = col("sort_order")

    if code_col is None or name_col is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have 'code' and 'name' columns.",
        )

    imported = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(rows, start=2):
        if not any(cell.strip() for cell in row):
            continue  # skip empty rows

        def get(idx: Optional[int]) -> str:
            if idx is None or idx >= len(row):
                return ""
            return row[idx].strip()

        code = get(code_col)
        name = get(name_col)
        sort_str = get(order_col)

        if not code:
            errors.append({"row": i, "reason": "Missing code."})
            continue
        if not name:
            errors.append({"row": i, "reason": "Missing name."})
            continue

        sort_order = 0
        if sort_str:
            try:
                sort_order = int(sort_str)
            except ValueError:
                errors.append({"row": i, "reason": f"Invalid sort_order: '{sort_str}'."})
                continue

        # Check for existing active value with same code
        existing = await db.execute(
            select(DimensionValue).where(
                DimensionValue.dimension_id == dim.id,
                DimensionValue.tenant_id == tenant_id,
                DimensionValue.code == code,
                DimensionValue.is_active == True,  # noqa: E712
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        db.add(DimensionValue(
            tenant_id=tenant_id,
            dimension_id=dim.id,
            code=code,
            name=name,
            sort_order=sort_order,
        ))
        imported += 1

    await db.flush()
    return UploadResult(imported=imported, skipped=skipped, errors=errors)


# ═══════════════════════════════════════════════════════════════════════════════
# CHART OF ACCOUNTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/coa/template")
async def download_coa_template(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Generate and download a CoA upload template (.xlsx).

    Standard columns: GL Number*, GL Name*, Account Type*, Description
    + one column per active tenant dimension with dropdown: required/optional/na.
    Row 1: bold blue headers. Row 2: grey instruction row. Row 3: example data.
    """
    tenant_id = _require_tenant(current_user)

    # Fetch active dimensions for extra columns
    dim_result = await db.execute(
        select(TenantDimension)
        .where(TenantDimension.tenant_id == tenant_id, TenantDimension.is_active == True)  # noqa: E712
        .order_by(TenantDimension.sort_order, TenantDimension.name)
    )
    dimensions = list(dim_result.scalars().all())

    try:
        import openpyxl
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
        from openpyxl.worksheet.datavalidation import DataValidation
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openpyxl is not installed. Run: pip install openpyxl",
        ) from exc

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CoA Upload"

    std_headers = ["GL Number*", "GL Name*", "Account Type*", "Description"]
    dim_headers = [f"{d.name}" for d in dimensions]
    all_headers = std_headers + dim_headers

    std_instructions = [
        "e.g. 670010",
        "e.g. Travel Expenses",
        "Enter P&L or B/S",
        "Optional description",
    ]
    dim_instructions = ["required / optional / na"] * len(dim_headers)
    all_instructions = std_instructions + dim_instructions

    std_example = ["670010", "Travel Expenses", "PL", ""]
    dim_example = ["optional"] * len(dim_headers)
    all_example = std_example + dim_example

    header_fill = PatternFill("solid", fgColor="2563EB")
    instruction_fill = PatternFill("solid", fgColor="F3F4F6")
    header_font = Font(bold=True, color="FFFFFF")
    instruction_font = Font(italic=True, color="6B7280")

    for col_idx, header in enumerate(all_headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
        ws.column_dimensions[get_column_letter(col_idx)].width = max(18, len(header) + 4)

    for col_idx, instruction in enumerate(all_instructions, 1):
        cell = ws.cell(row=2, column=col_idx, value=instruction)
        cell.fill = instruction_fill
        cell.font = instruction_font

    for col_idx, example in enumerate(all_example, 1):
        ws.cell(row=3, column=col_idx, value=example)

    # Account Type dropdown (column 3)
    dv_type = DataValidation(type="list", formula1='"PL,BS"', allow_blank=False, showDropDown=False)
    ws.add_data_validation(dv_type)
    dv_type.sqref = "C3:C10000"

    # Dimension dropdowns
    for i in range(len(dim_headers)):
        col_letter = get_column_letter(len(std_headers) + i + 1)
        dv = DataValidation(
            type="list",
            formula1='"required,optional,na"',
            allow_blank=True,
            showDropDown=False,
        )
        ws.add_data_validation(dv)
        dv.sqref = f"{col_letter}3:{col_letter}10000"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=coa_template.xlsx"},
    )


@router.get("/coa", response_model=list[CoAListItem])
async def list_coa(
    search: str = Query(default="", description="Search GL number or name"),
    active_only: bool = Query(default=True),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[CoAListItem]:
    """List GL accounts for the tenant. Searchable by GL number or name."""
    tenant_id = _require_tenant(current_user)

    q = select(ChartOfAccount).where(ChartOfAccount.tenant_id == tenant_id)
    if active_only:
        q = q.where(ChartOfAccount.is_active == True)  # noqa: E712
    if search.strip():
        term = f"%{search.strip()}%"
        q = q.where(
            ChartOfAccount.gl_number.ilike(term) | ChartOfAccount.gl_name.ilike(term)
        )
    q = q.order_by(ChartOfAccount.gl_number)

    result = await db.execute(q)
    return [CoAListItem.from_orm(g) for g in result.scalars().all()]


@router.post("/coa", response_model=CoAListItem, status_code=status.HTTP_201_CREATED)
async def create_coa(
    data: CoACreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CoAListItem:
    """Create a single GL account. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    existing = await db.execute(
        select(ChartOfAccount).where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.gl_number == data.gl_number,
            ChartOfAccount.is_active == True,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GL account '{data.gl_number}' already exists.",
        )

    gl = ChartOfAccount(
        tenant_id=tenant_id,
        gl_number=data.gl_number,
        gl_name=data.gl_name,
        account_type=data.account_type,
    )
    db.add(gl)
    await db.flush()
    await db.refresh(gl)
    return CoAListItem.from_orm(gl)


@router.patch("/coa/{gl_id}", response_model=CoAListItem)
async def update_coa(
    gl_id: uuid.UUID,
    data: CoAUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CoAListItem:
    """Update a GL account (PATCH semantics). Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(ChartOfAccount).where(
            ChartOfAccount.id == gl_id,
            ChartOfAccount.tenant_id == tenant_id,
        )
    )
    gl = result.scalar_one_or_none()
    if not gl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GL account not found.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(gl, field, value)

    await db.flush()
    await db.refresh(gl)
    return CoAListItem.from_orm(gl)


@router.delete("/coa/{gl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coa(
    gl_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a GL account. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(ChartOfAccount).where(
            ChartOfAccount.id == gl_id,
            ChartOfAccount.tenant_id == tenant_id,
        )
    )
    gl = result.scalar_one_or_none()
    if not gl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GL account not found.")

    gl.is_active = False
    await db.flush()


@router.post("/coa/upload", response_model=UploadResult)
async def upload_coa(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UploadResult:
    """
    Bulk upload Chart of Accounts from .xlsx or .csv.

    Standard columns: GL Number*, GL Name*, Account Type*, Description
    Additional dimension columns: value must be 'required', 'optional', or 'na' (case-insensitive).
    Duplicate GL numbers in the file: first occurrence wins; subsequent rows skipped.
    Duplicate GL numbers already in DB: updates existing record.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    headers, rows = await _parse_upload(file)
    if not headers:
        return UploadResult(imported=0, skipped=0, errors=[{"row": 0, "reason": "Empty file."}])

    headers_lower = [h.lower().strip("*").strip() for h in headers]

    def col(name: str) -> Optional[int]:
        try:
            return headers_lower.index(name)
        except ValueError:
            return None

    gl_number_col = col("gl number")
    gl_name_col = col("gl name")
    account_type_col = col("account type")

    if gl_number_col is None or gl_name_col is None or account_type_col is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have 'GL Number', 'GL Name', and 'Account Type' columns.",
        )

    # Fetch active dimensions for dimension columns
    dim_result = await db.execute(
        select(TenantDimension)
        .where(TenantDimension.tenant_id == tenant_id, TenantDimension.is_active == True)  # noqa: E712
    )
    dimensions = list(dim_result.scalars().all())

    # Map dimension name → (dimension_id, column_index)
    dim_cols: list[tuple[uuid.UUID, int]] = []
    for dim in dimensions:
        idx = col(dim.name.lower())
        if idx is not None:
            dim_cols.append((dim.id, idx))

    imported = 0
    updated = 0
    skipped = 0
    errors: list[dict] = []
    seen_gl_numbers: set[str] = set()

    VALID_REQUIREMENTS = {"required", "optional", "na"}

    for i, row in enumerate(rows, start=2):
        if not any(cell.strip() for cell in row):
            continue

        def get(idx: Optional[int]) -> str:
            if idx is None or idx >= len(row):
                return ""
            return row[idx].strip()

        gl_number = get(gl_number_col)
        gl_name = get(gl_name_col)
        account_type_raw = get(account_type_col)

        if not gl_number:
            errors.append({"row": i, "reason": "Missing GL Number."})
            continue
        if not gl_name:
            errors.append({"row": i, "reason": "Missing GL Name."})
            continue

        account_type = account_type_raw.upper()
        if account_type not in ("PL", "BS", "P&L", "B/S"):
            errors.append({"row": i, "reason": f"Invalid Account Type: '{account_type_raw}'. Use P&L or B/S."})
            continue
        if account_type == "P&L":
            account_type = "PL"
        elif account_type == "B/S":
            account_type = "BS"

        if gl_number in seen_gl_numbers:
            skipped += 1
            continue
        seen_gl_numbers.add(gl_number)

        # Check existing record in DB (active)
        existing_result = await db.execute(
            select(ChartOfAccount).where(
                ChartOfAccount.tenant_id == tenant_id,
                ChartOfAccount.gl_number == gl_number,
            )
        )
        existing_gl = existing_result.scalar_one_or_none()

        if existing_gl:
            existing_gl.gl_name = gl_name
            existing_gl.account_type = account_type
            existing_gl.is_active = True
            gl_obj = existing_gl
            updated += 1
        else:
            gl_obj = ChartOfAccount(
                tenant_id=tenant_id,
                gl_number=gl_number,
                gl_name=gl_name,
                account_type=account_type,
            )
            db.add(gl_obj)
            imported += 1

        await db.flush()
        await db.refresh(gl_obj)

        # Handle dimension requirement columns
        row_errors: list[str] = []
        for dim_id, col_idx in dim_cols:
            req_raw = get(col_idx)
            req = req_raw.lower() if req_raw else "optional"
            if not req:
                req = "optional"
            if req not in VALID_REQUIREMENTS:
                row_errors.append(f"Invalid requirement for dimension col {col_idx + 1}: '{req_raw}'.")
                continue

            # Upsert requirement
            req_result = await db.execute(
                select(GLDimensionRequirement).where(
                    GLDimensionRequirement.gl_id == gl_obj.id,
                    GLDimensionRequirement.dimension_id == dim_id,
                )
            )
            req_row = req_result.scalar_one_or_none()
            if req_row:
                req_row.requirement = req
            else:
                db.add(GLDimensionRequirement(
                    tenant_id=tenant_id,
                    gl_id=gl_obj.id,
                    dimension_id=dim_id,
                    requirement=req,
                ))

        if row_errors:
            errors.append({"row": i, "reason": "; ".join(row_errors)})

    await db.flush()
    return UploadResult(imported=imported, updated=updated, skipped=skipped, errors=errors)


@router.patch("/coa/{gl_id}/dimensions", response_model=CoAResponse)
async def set_gl_dimensions(
    gl_id: uuid.UUID,
    data: CoADimensionsUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CoAResponse:
    """
    Set dimension requirements for a GL account.

    Replaces all existing requirements for this GL account with the provided list.
    Admin only.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(ChartOfAccount)
        .where(ChartOfAccount.id == gl_id, ChartOfAccount.tenant_id == tenant_id)
        .options(selectinload(ChartOfAccount.dimension_requirements).selectinload(GLDimensionRequirement.dimension))
    )
    gl = result.scalar_one_or_none()
    if not gl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GL account not found.")

    # Delete existing requirements
    await db.execute(
        delete(GLDimensionRequirement).where(GLDimensionRequirement.gl_id == gl_id)
    )
    await db.flush()

    for req_item in data.requirements:
        db.add(GLDimensionRequirement(
            tenant_id=tenant_id,
            gl_id=gl_id,
            dimension_id=req_item.dimension_id,
            requirement=req_item.requirement,
        ))

    await db.flush()

    # Reload with fresh requirements
    result2 = await db.execute(
        select(ChartOfAccount)
        .where(ChartOfAccount.id == gl_id)
        .options(selectinload(ChartOfAccount.dimension_requirements).selectinload(GLDimensionRequirement.dimension))
    )
    gl2 = result2.scalar_one()
    return CoAResponse.from_orm(gl2, gl2.dimension_requirements)


# ═══════════════════════════════════════════════════════════════════════════════
# EXPENSE CATEGORIES (M8 config router — with GL mappings)
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_category_or_404(
    category_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> ExpenseCategory:
    result = await db.execute(
        select(ExpenseCategory).where(
            ExpenseCategory.id == category_id,
            ExpenseCategory.tenant_id == tenant_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return cat


async def _load_category_tree(tenant_id: uuid.UUID, db: AsyncSession) -> list[CategoryWithMappingsResponse]:
    """Load all active top-level categories with subcategories and GL mappings."""
    top_result = await db.execute(
        select(ExpenseCategory)
        .where(
            ExpenseCategory.tenant_id == tenant_id,
            ExpenseCategory.is_active == True,  # noqa: E712
            ExpenseCategory.parent_id.is_(None),
        )
        .order_by(ExpenseCategory.sort_order, ExpenseCategory.name)
    )
    top_cats = list(top_result.scalars().all())

    items = []
    for cat in top_cats:
        # Load subcategories
        sub_result = await db.execute(
            select(ExpenseCategory)
            .where(
                ExpenseCategory.tenant_id == tenant_id,
                ExpenseCategory.parent_id == cat.id,
                ExpenseCategory.is_active == True,  # noqa: E712
            )
            .order_by(ExpenseCategory.sort_order, ExpenseCategory.name)
        )
        subcats = list(sub_result.scalars().all())

        # Load GL mappings for subcategories
        enriched_subs = []
        for sub in subcats:
            mapping_result = await db.execute(
                select(CategoryGLMapping)
                .where(CategoryGLMapping.category_id == sub.id)
                .options(selectinload(CategoryGLMapping.gl_account))
            )
            mappings = list(mapping_result.scalars().all())
            enriched_subs.append(CategoryWithMappingsResponse.from_orm(sub, mappings=mappings))

        items.append(CategoryWithMappingsResponse(
            id=str(cat.id),
            tenant_id=str(cat.tenant_id),
            name=cat.name,
            code=cat.code,
            parent_id=None,
            is_active=cat.is_active,
            sort_order=cat.sort_order,
            created_at=cat.created_at,
            subcategories=enriched_subs,
        ))

    return items


@router.get("/categories", response_model=list[CategoryWithMappingsResponse])
async def list_categories(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[CategoryWithMappingsResponse]:
    """List full category tree with subcategories and GL mappings."""
    tenant_id = _require_tenant(current_user)
    return await _load_category_tree(tenant_id, db)


@router.post("/categories", response_model=CategoryWithMappingsResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CategoryWithMappingsResponse:
    """Create a top-level category or subcategory. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    code = data.code or _generate_code(data.name)

    if data.parent_id is not None:
        parent = await _get_category_or_404(data.parent_id, tenant_id, db)
        if not parent.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent category is inactive.")
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only one level of subcategories is supported.",
            )

    cat = ExpenseCategory(
        tenant_id=tenant_id,
        name=data.name,
        code=code,
        parent_id=data.parent_id,
        sort_order=data.sort_order,
    )
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return CategoryWithMappingsResponse.from_orm(cat)


@router.patch("/categories/{category_id}", response_model=CategoryWithMappingsResponse)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CategoryWithMappingsResponse:
    """Update a category (PATCH semantics). Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    cat = await _get_category_or_404(category_id, tenant_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cat, field, value)

    await db.flush()
    await db.refresh(cat)
    return CategoryWithMappingsResponse.from_orm(cat)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a category and all its subcategories. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    cat = await _get_category_or_404(category_id, tenant_id, db)

    cat.is_active = False

    # Cascade to subcategories
    sub_result = await db.execute(
        select(ExpenseCategory).where(
            ExpenseCategory.parent_id == category_id,
            ExpenseCategory.tenant_id == tenant_id,
        )
    )
    for sub in sub_result.scalars().all():
        sub.is_active = False

    await db.flush()


# ── Category GL Mappings ──────────────────────────────────────────────────────

@router.post(
    "/categories/{category_id}/gl-mappings",
    response_model=CategoryGLMappingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_gl_mapping(
    category_id: uuid.UUID,
    data: CategoryGLMappingCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CategoryGLMappingResponse:
    """
    Add a GL account mapping to a subcategory. Admin only.

    Only active GL accounts from the tenant's CoA can be mapped.
    If is_default=True, clears any existing default mapping for this category first.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    cat = await _get_category_or_404(category_id, tenant_id, db)

    # Verify GL account exists and is active in this tenant's CoA
    gl_result = await db.execute(
        select(ChartOfAccount).where(
            ChartOfAccount.id == data.gl_id,
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.is_active == True,  # noqa: E712
        )
    )
    gl = gl_result.scalar_one_or_none()
    if not gl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GL account not found or inactive. Upload your Chart of Accounts first.",
        )

    # Check not already mapped
    existing = await db.execute(
        select(CategoryGLMapping).where(
            CategoryGLMapping.category_id == category_id,
            CategoryGLMapping.gl_id == data.gl_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This GL account is already mapped to this category.",
        )

    # If setting as default, clear existing default
    if data.is_default:
        existing_defaults_result = await db.execute(
            select(CategoryGLMapping).where(
                CategoryGLMapping.category_id == category_id,
                CategoryGLMapping.is_default == True,  # noqa: E712
            )
        )
        for m in existing_defaults_result.scalars().all():
            m.is_default = False

    mapping = CategoryGLMapping(
        tenant_id=tenant_id,
        category_id=category_id,
        gl_id=data.gl_id,
        is_default=data.is_default,
    )
    db.add(mapping)
    await db.flush()
    await db.refresh(mapping)

    # Load gl_account for response
    mapping_result = await db.execute(
        select(CategoryGLMapping)
        .where(CategoryGLMapping.id == mapping.id)
        .options(selectinload(CategoryGLMapping.gl_account))
    )
    mapping_loaded = mapping_result.scalar_one()
    return CategoryGLMappingResponse.from_orm(mapping_loaded)


@router.delete(
    "/categories/{category_id}/gl-mappings/{gl_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_gl_mapping(
    category_id: uuid.UUID,
    gl_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a GL account mapping from a category. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(CategoryGLMapping).where(
            CategoryGLMapping.category_id == category_id,
            CategoryGLMapping.gl_id == gl_id,
            CategoryGLMapping.tenant_id == tenant_id,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GL mapping not found.")

    await db.delete(mapping)
    await db.flush()


# ═══════════════════════════════════════════════════════════════════════════════
# GL SEARCH (M9 — expense form Level 3/4 GL picker)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/gl/search", response_model=list[GLSearchResult])
async def search_gl_accounts(
    q: str = Query(default="", description="Search term matched against GL number or name"),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[GLSearchResult]:
    """
    Search active GL accounts by number or name for the expense form GL picker.

    Returns accounts with their per-dimension requirements so the form can render
    the correct dimension dropdowns immediately after GL selection.
    Tenant-scoped; available to all authenticated business users (not admin-only).
    """
    tenant_id = _require_tenant(current_user)

    query = (
        select(ChartOfAccount)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.is_active == True,  # noqa: E712
        )
        .options(selectinload(ChartOfAccount.dimension_requirements))
        .order_by(ChartOfAccount.gl_number)
        .limit(limit)
    )

    if q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            ChartOfAccount.gl_number.ilike(term) | ChartOfAccount.gl_name.ilike(term)
        )

    result = await db.execute(query)
    return [GLSearchResult.from_orm(g) for g in result.scalars().all()]


@router.patch(
    "/categories/{category_id}/gl-mappings/{gl_id}",
    response_model=CategoryGLMappingResponse,
)
async def update_gl_mapping(
    category_id: uuid.UUID,
    gl_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CategoryGLMappingResponse:
    """
    Toggle is_default on a GL mapping.

    If setting this mapping as default, clears any existing default first.
    Admin only.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(CategoryGLMapping)
        .where(
            CategoryGLMapping.category_id == category_id,
            CategoryGLMapping.gl_id == gl_id,
            CategoryGLMapping.tenant_id == tenant_id,
        )
        .options(selectinload(CategoryGLMapping.gl_account))
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GL mapping not found.")

    if not mapping.is_default:
        # Clear existing defaults
        defaults_result = await db.execute(
            select(CategoryGLMapping).where(
                CategoryGLMapping.category_id == category_id,
                CategoryGLMapping.is_default == True,  # noqa: E712
            )
        )
        for m in defaults_result.scalars().all():
            m.is_default = False
        mapping.is_default = True
    else:
        mapping.is_default = False

    await db.flush()
    return CategoryGLMappingResponse.from_orm(mapping)
