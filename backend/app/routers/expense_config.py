"""
ZivaBI — M7 expense configuration and category management router.

Registered at prefix /api/expense-config.

Endpoints:
    GET    /api/expense-config                           Get tenant's GL coding config (or defaults)
    POST   /api/expense-config                           Create or update config (Tenant Admin only)
    GET    /api/expense-config/categories                List active categories (hierarchical)
    POST   /api/expense-config/categories               Create category or subcategory (Tenant Admin only)
    PATCH  /api/expense-config/categories/{id}          Update category (Tenant Admin only)
    DELETE /api/expense-config/categories/{id}          Soft-delete category + subcategories (Admin only)
    GET    /api/expense-config/form-config              Combined config + categories for expense form
    POST   /api/expense-config/reports/{report_id}/gl-codes  Finance GL coding batch update

The form-config endpoint is what the expense submission form calls on page load.
It returns everything the form needs in one round-trip: GL coding mode, category
flags, and the full active category tree for dropdowns.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import Role, UserRole, UserTenant
from app.models.expenses import (
    ExpenseCategory,
    ExpenseLine,
    ExpenseReport,
    TenantExpenseConfig,
)
from app.schemas.expense_config import (
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCategoryUpdate,
    FinanceGLCodesRequest,
    FormConfigResponse,
    TenantExpenseConfigCreate,
    TenantExpenseConfigResponse,
    TenantExpenseConfigUpdate,
    _coding_level_to_gl_mode,
)

router = APIRouter(prefix="/api/expense-config", tags=["expense-config"])

# ── Default config returned when no row exists for the tenant ─────────────────
_DEFAULTS = TenantExpenseConfigResponse(
    coding_level=0,
    require_category=False,
    require_subcategory=False,
    allow_free_text_description=True,
    show_location=True,
    require_location=False,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    """Raise 403 if user has no tenant (individual account)."""
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Expense configuration is a business-tier feature.",
        )
    return current_user.tenant_id


def _require_admin(current_user: CurrentUser) -> None:
    """Raise 403 if user is not a Tenant Admin or Super Admin."""
    if not current_user.is_tenant_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Tenant Admins can modify expense configuration.",
        )


async def _get_config(tenant_id: uuid.UUID, db: AsyncSession) -> TenantExpenseConfig | None:
    """Fetch the tenant's expense config row, or None if none exists."""
    result = await db.execute(
        select(TenantExpenseConfig).where(TenantExpenseConfig.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def _get_active_categories(
    tenant_id: uuid.UUID, db: AsyncSession
) -> list[ExpenseCategory]:
    """
    Return all active top-level categories for the tenant with subcategories
    eagerly loaded.  Ordered by sort_order, then name.
    """
    result = await db.execute(
        select(ExpenseCategory)
        .where(
            ExpenseCategory.tenant_id == tenant_id,
            ExpenseCategory.is_active == True,  # noqa: E712
            ExpenseCategory.parent_id.is_(None),
        )
        .options(selectinload(ExpenseCategory.subcategories))
        .order_by(ExpenseCategory.sort_order, ExpenseCategory.name)
    )
    return list(result.scalars().all())


async def _has_finance_role(
    user: CurrentUser, tenant_id: uuid.UUID, db: AsyncSession
) -> bool:
    """Return True if the user holds any Finance role within the tenant."""
    finance_roles = {"finance_reviewer", "finance_poster", "finance_manager"}
    result = await db.execute(
        select(Role.name)
        .join(UserRole, Role.id == UserRole.role_id)
        .join(UserTenant, UserRole.user_tenant_id == UserTenant.id)
        .where(
            UserTenant.user_id == user.user_id,
            UserTenant.tenant_id == tenant_id,
            Role.name.in_(finance_roles),
        )
    )
    return result.scalar_one_or_none() is not None


# ── Config endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=TenantExpenseConfigResponse)
async def get_expense_config(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantExpenseConfigResponse:
    """
    Return the current tenant's expense configuration.

    If the tenant has not yet saved a config, returns hard-coded defaults
    (gl_coding_mode='employee', all flags false/true) so pre-M7 tenants
    continue to behave identically without any migration step.
    """
    tenant_id = _require_tenant(current_user)
    config = await _get_config(tenant_id, db)
    if config is None:
        return _DEFAULTS
    return TenantExpenseConfigResponse.model_validate(config)


async def _upsert_config(
    data: TenantExpenseConfigUpdate,
    tenant_id: "uuid.UUID",
    db: AsyncSession,
) -> TenantExpenseConfig:
    """Shared upsert logic used by both POST and PATCH endpoints."""
    config = await _get_config(tenant_id, db)
    if config is None:
        config = TenantExpenseConfig(
            tenant_id=tenant_id,
            coding_level=0,
            require_category=False,
            require_subcategory=False,
            allow_free_text_description=True,
            show_location=True,
            require_location=False,
        )
        db.add(config)

    if data.coding_level is not None:
        config.coding_level = data.coding_level
    if data.require_category is not None:
        config.require_category = data.require_category
        if not data.require_category:
            config.require_subcategory = False
    if data.require_subcategory is not None:
        config.require_subcategory = data.require_subcategory
    if data.allow_free_text_description is not None:
        config.allow_free_text_description = data.allow_free_text_description
    if data.show_location is not None:
        config.show_location = data.show_location
        if not data.show_location:
            config.require_location = False
    if data.require_location is not None:
        config.require_location = data.require_location

    await db.flush()
    await db.refresh(config)
    return config


@router.post("", response_model=TenantExpenseConfigResponse)
async def upsert_expense_config_post(
    data: TenantExpenseConfigUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantExpenseConfigResponse:
    """Create or update the tenant's expense configuration (POST, kept for backward compat)."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    config = await _upsert_config(data, tenant_id, db)
    return TenantExpenseConfigResponse.model_validate(config)


@router.patch("", response_model=TenantExpenseConfigResponse)
async def upsert_expense_config(
    data: TenantExpenseConfigUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TenantExpenseConfigResponse:
    """
    Update the tenant's expense configuration (PATCH semantics).

    All fields optional — only provided fields are updated.
    Only Tenant Admins may call this.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    config = await _upsert_config(data, tenant_id, db)
    return TenantExpenseConfigResponse.model_validate(config)


# ── Category endpoints ────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[ExpenseCategoryResponse])
async def list_categories(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ExpenseCategoryResponse]:
    """
    Return all active categories for the tenant in hierarchical order.

    Top-level categories include their active subcategories embedded.
    Subcategory-only rows are not returned at the top level; they appear
    under their parent's `subcategories` list.
    """
    tenant_id = _require_tenant(current_user)
    top_level = await _get_active_categories(tenant_id, db)
    return [ExpenseCategoryResponse.from_orm(c, c.subcategories) for c in top_level]


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ExpenseCategoryCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseCategoryResponse:
    """
    Create a top-level category (parent_id=None) or a subcategory (parent_id set).

    Validates that the parent exists and belongs to the same tenant.
    Tenant Admin only.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    if data.parent_id is not None:
        parent_result = await db.execute(
            select(ExpenseCategory).where(
                ExpenseCategory.id == data.parent_id,
                ExpenseCategory.tenant_id == tenant_id,
                ExpenseCategory.is_active == True,  # noqa: E712
            )
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent category not found or inactive.",
            )
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only one level of subcategories is supported.",
            )

    cat = ExpenseCategory(
        tenant_id=tenant_id,
        name=data.name,
        code=data.code,
        parent_id=data.parent_id,
        sort_order=data.sort_order,
    )
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return ExpenseCategoryResponse.from_orm(cat)


@router.patch("/categories/{category_id}", response_model=ExpenseCategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    data: ExpenseCategoryUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseCategoryResponse:
    """Update name, code, GL suggestion, or sort order of an existing category. Admin only."""
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(ExpenseCategory).where(
            ExpenseCategory.id == category_id,
            ExpenseCategory.tenant_id == tenant_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cat, field, value)

    await db.flush()
    await db.refresh(cat)
    return ExpenseCategoryResponse.from_orm(cat)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_category(
    category_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft-delete a category (sets is_active=False).

    Also deactivates all subcategories of the category so orphaned subcategories
    do not appear in the form dropdowns. Admin only.
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    result = await db.execute(
        select(ExpenseCategory)
        .where(
            ExpenseCategory.id == category_id,
            ExpenseCategory.tenant_id == tenant_id,
        )
        .options(selectinload(ExpenseCategory.subcategories))
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    cat.is_active = False
    for sub in cat.subcategories:
        sub.is_active = False

    await db.flush()


# ── Form config (used by expense form on load) ────────────────────────────────

@router.get("/form-config", response_model=FormConfigResponse)
async def get_form_config(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> FormConfigResponse:
    """
    Combined endpoint for the expense submission form.

    Returns GL coding mode, category requirement flags, and the full active
    category tree (with subcategories embedded) in one payload so the form
    can render itself without additional round-trips.

    Returns defaults when the tenant has no saved config.
    """
    tenant_id = _require_tenant(current_user)

    config = await _get_config(tenant_id, db)
    if config is None:
        lvl = 0
        req_cat = False
        req_sub = False
        allow_free = True
        show_loc = True
        req_loc = False
    else:
        lvl = config.coding_level
        req_cat = config.require_category
        req_sub = config.require_subcategory
        allow_free = config.allow_free_text_description
        show_loc = config.show_location
        req_loc = config.require_location

    top_level = await _get_active_categories(tenant_id, db)
    categories = [ExpenseCategoryResponse.from_orm(c, c.subcategories) for c in top_level]

    return FormConfigResponse(
        gl_coding_mode=_coding_level_to_gl_mode(lvl),
        coding_level=lvl,
        require_category=req_cat,
        require_subcategory=req_sub,
        allow_free_text_description=allow_free,
        show_location=show_loc,
        require_location=req_loc,
        categories=categories,
    )


# ── Finance GL coding batch update ────────────────────────────────────────────

@router.post("/reports/{report_id}/gl-codes", status_code=status.HTTP_204_NO_CONTENT)
async def save_finance_gl_codes(
    report_id: uuid.UUID,
    data: FinanceGLCodesRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Batch-update GL account and P/L group on expense lines (Finance role only).

    Called from the approval detail page when a Finance approver fills in GL codes
    before clicking Approve. The report must be in PENDING_APPROVAL status.
    Only gl_account and pl_group are updated; other line fields are unchanged.

    Restricted to users with a finance_reviewer, finance_poster, or finance_manager
    role within the tenant.
    """
    tenant_id = _require_tenant(current_user)

    if not await _has_finance_role(current_user, tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance role users can update GL codes on submitted reports.",
        )

    report_result = await db.execute(
        select(ExpenseReport).where(
            ExpenseReport.id == report_id,
            ExpenseReport.tenant_id == tenant_id,
        )
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if report.status != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="GL codes can only be updated on reports in PENDING_APPROVAL status.",
        )

    for item in data.lines:
        line_result = await db.execute(
            select(ExpenseLine).where(
                ExpenseLine.id == item.line_id,
                ExpenseLine.report_id == report_id,
            )
        )
        line = line_result.scalar_one_or_none()
        if not line:
            continue  # silently skip unknown line IDs

        if item.gl_account is not None:
            line.gl_account = item.gl_account.strip() or None
        if item.pl_group is not None:
            line.pl_group = item.pl_group.strip() or None

    await db.flush()
