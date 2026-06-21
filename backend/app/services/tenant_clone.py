"""
ZivaBI — Live→test tenant clone engine (Phase 4).

Copies all active configuration and master data from a live tenant into a
freshly-created empty test shadow. Called from create_test_environment AFTER
the existing UserTenant mirroring step.

Dependency order (mirrors docs/diagnosis_clone_schema.md §4):
  Step 0  UserTenant mirroring  ← already done by the caller before this function
  Step 1  TenantDimension
  Step 2  ChartOfAccount
  Step 3  DimensionValue        ← 2-pass: cascade_value_id
  Step 4  GLDimensionRequirement
  Step 5  TenantAccountMapping
  Step 6  BankAccount
  Step 7  Employee              ← 2-pass: line_manager_id
  Step 8  CostCenterConfig
  Step 9  FinanceReviewConfig

Key design decisions vs Phase 3a's promotion_engine.py:
  - One-directional (live→test only), one-time (test starts empty — no diff needed).
  - Simpler INSERT-only paths: no UPDATE, no DEACTIVATE, no partial-accept logic.
  - Adds 4 entities not in Phase 3a (BankAccount, Employee, CostCenterConfig,
    FinanceReviewConfig) plus the existing 5 (Dim, CoA, DimVal, GLReq, AccMap).
  - id-map extended with 'emp' sub-map for Employee line_manager_id back-fill.
  - head_user_id / reviewer_user_id copied verbatim (global users table — no remap).
  - created_by set NULL on cloned BankAccount rows (audit field, not operational).

All writes land in the caller's DB session (commit/rollback owned by the router's
get_db dependency — all-or-nothing).
"""

import uuid
from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_mapping import TenantAccountMapping
from app.models.bank_account import BankAccount
from app.models.master_data import (
    ChartOfAccount,
    CostCenterConfig,
    DimensionValue,
    Employee,
    FinanceReviewConfig,
    GLDimensionRequirement,
    TenantDimension,
)

# ── Shared field list for TenantOrgConfig copies ──────────────────────────────
# Used by Step 10 below AND imported by tenant.py's promote() so both stay
# in sync from a single source of truth. Update here when the model gains columns.
_ORG_COPY_FIELDS: list[str] = [
    "legal_name", "rc_number", "date_of_registration", "commencement_date",
    "company_type", "industry", "tin", "vat_reg_number", "country",
    "registered_address", "operating_address", "company_phone", "company_email",
    "website", "external_auditor", "group_structure", "parent_company_name",
    "functional_currency", "reporting_currency", "enabled_currencies",
    "authorised_share_capital",
    "fiscal_year_start_month", "fiscal_year_start_day", "fiscal_year_name_format",
    "period_closing_frequency", "branding", "org_configuration",
    "block_journal_into_open_prior", "default_audit_grace_months",
]


# ── Internal data structures ──────────────────────────────────────────────────

@dataclass
class _CloneIdMap:
    """
    In-memory live→test UUID mapping built incrementally across clone steps.

    Each sub-map is keyed by the LIVE UUID and holds the corresponding TEST UUID
    generated when the test row was inserted.  Built strictly in dependency order
    so downstream steps can always look up resolved test IDs.
    """
    dim:    dict[UUID, UUID] = field(default_factory=dict)  # live_dim_id    → test_dim_id
    coa:    dict[UUID, UUID] = field(default_factory=dict)  # live_gl_id     → test_gl_id
    dimval: dict[UUID, UUID] = field(default_factory=dict)  # live_val_id    → test_val_id
    emp:    dict[UUID, UUID] = field(default_factory=dict)  # live_emp_id    → test_emp_id


@dataclass
class CloneResult:
    """Counts of rows cloned per entity type, returned for audit/logging."""
    # Steps 1-9 (master data)
    dimensions:            int = 0
    coa:                   int = 0
    dimension_values:      int = 0
    gl_requirements:       int = 0
    account_mappings:      int = 0
    bank_accounts:         int = 0
    employees:             int = 0
    cost_center_configs:   int = 0
    finance_review_configs: int = 0
    # Steps 10-12 (setup completion gates)
    org_config:      int = 0   # 1 if a tenant_org_config row was cloned, else 0
    modules:         int = 0   # count of tenant_modules rows cloned
    approval_matrix: int = 0   # 1 if an approval_matrix row was cloned, else 0

    @property
    def total(self) -> int:
        return (self.dimensions + self.coa + self.dimension_values +
                self.gl_requirements + self.account_mappings + self.bank_accounts +
                self.employees + self.cost_center_configs + self.finance_review_configs +
                self.org_config + self.modules + self.approval_matrix)

    def to_dict(self) -> dict:
        return {
            "dimensions":             self.dimensions,
            "coa":                    self.coa,
            "dimension_values":       self.dimension_values,
            "gl_requirements":        self.gl_requirements,
            "account_mappings":       self.account_mappings,
            "bank_accounts":          self.bank_accounts,
            "employees":              self.employees,
            "cost_center_configs":    self.cost_center_configs,
            "finance_review_configs": self.finance_review_configs,
            "org_config":             self.org_config,
            "modules":                self.modules,
            "approval_matrix":        self.approval_matrix,
            "total":                  self.total,
        }


# ── Step 1: TenantDimension ───────────────────────────────────────────────────

async def _clone_dimensions(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """Clone all active TenantDimension rows from live → test."""
    live_rows = (await db.execute(
        select(TenantDimension)
        .where(TenantDimension.tenant_id == live_id, TenantDimension.is_active.is_(True))
    )).scalars().all()

    for live in live_rows:
        test = TenantDimension(
            tenant_id=test_id,
            name=live.name,
            code=live.code,
            is_required=live.is_required,
            is_active=True,
            sort_order=live.sort_order,
            accepted_value_types=live.accepted_value_types,
            locked_by_implementation=live.locked_by_implementation,
            value_source=live.value_source,
            dimension_sources=live.dimension_sources,
            display_name=live.display_name,
            description=live.description,
            icon=live.icon,
        )
        db.add(test)
        await db.flush()
        id_map.dim[live.id] = test.id
        result.dimensions += 1


# ── Step 2: ChartOfAccount ────────────────────────────────────────────────────

async def _clone_coa(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """Clone all active ChartOfAccount rows from live → test."""
    live_rows = (await db.execute(
        select(ChartOfAccount)
        .where(ChartOfAccount.tenant_id == live_id, ChartOfAccount.is_active.is_(True))
    )).scalars().all()

    for live in live_rows:
        test = ChartOfAccount(
            tenant_id=test_id,
            gl_number=live.gl_number,
            gl_name=live.gl_name,
            account_type=live.account_type,
            is_active=True,
            gl_group=live.gl_group,
            gl_subgroup=live.gl_subgroup,
            gl_sub_subgroup=live.gl_sub_subgroup,
            fs_head=live.fs_head,
            fs_note=live.fs_note,
            tb_mapping=live.tb_mapping,
            group_account_number=live.group_account_number,
            group_account_name=live.group_account_name,
            account_classification=live.account_classification,
            is_foreign_currency=live.is_foreign_currency,
            foreign_currency_code=live.foreign_currency_code,
            revalue_at_period_end=live.revalue_at_period_end,
            locked_by_implementation=live.locked_by_implementation,
        )
        db.add(test)
        await db.flush()
        id_map.coa[live.id] = test.id
        result.coa += 1


# ── Step 3: DimensionValue (two-pass) ────────────────────────────────────────

async def _clone_dimension_values(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """
    Clone all active DimensionValue rows from live → test.

    Two-pass to handle the self-referential cascade_value_id FK:
    Pass 1 — insert all rows with cascade_value_id=None.
    Pass 2 — back-fill cascade_value_id using the now-complete dimval id-map.

    cascade_dimension_id (FK to TenantDimension) is remapped in Pass 1 using
    id_map.dim which is already complete by this point.
    """
    live_rows = (await db.execute(
        select(DimensionValue)
        .where(DimensionValue.tenant_id == live_id, DimensionValue.is_active.is_(True))
    )).scalars().all()

    # Pass 1: insert all, cascade_value_id=None
    # live_val_id → test DimensionValue object (needed for pass 2)
    test_objects: dict[UUID, DimensionValue] = {}

    for live in live_rows:
        test_dim_id = id_map.dim.get(live.dimension_id)
        if test_dim_id is None:
            # Parent dimension was not cloned (inactive or missing) — skip
            continue
        # Remap cascade_dimension_id if set
        test_cascade_dim_id: Optional[UUID] = None
        if live.cascade_dimension_id:
            test_cascade_dim_id = id_map.dim.get(live.cascade_dimension_id)

        test = DimensionValue(
            tenant_id=test_id,
            dimension_id=test_dim_id,
            code=live.code,
            name=live.name,
            is_active=True,
            sort_order=live.sort_order,
            value_type=live.value_type,
            cascade_dimension_id=test_cascade_dim_id,
            cascade_value_id=None,           # filled in pass 2
            valid_from=live.valid_from,
            valid_to=live.valid_to,
        )
        db.add(test)
        await db.flush()
        id_map.dimval[live.id] = test.id
        test_objects[live.id] = test
        result.dimension_values += 1

    # Pass 2: back-fill cascade_value_id
    for live in live_rows:
        if live.cascade_value_id and live.id in test_objects:
            test_cascade_val_id = id_map.dimval.get(live.cascade_value_id)
            if test_cascade_val_id:
                test_objects[live.id].cascade_value_id = test_cascade_val_id


# ── Step 4: GLDimensionRequirement ───────────────────────────────────────────

async def _clone_gl_requirements(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """Clone GLDimensionRequirement rows; remap gl_id and dimension_id."""
    live_rows = (await db.execute(
        select(GLDimensionRequirement)
        .where(GLDimensionRequirement.tenant_id == live_id)
    )).scalars().all()

    for live in live_rows:
        test_gl_id  = id_map.coa.get(live.gl_id)
        test_dim_id = id_map.dim.get(live.dimension_id)
        if test_gl_id is None or test_dim_id is None:
            continue  # parent not cloned (inactive)
        db.add(GLDimensionRequirement(
            tenant_id=test_id,
            gl_id=test_gl_id,
            dimension_id=test_dim_id,
            requirement=live.requirement,
        ))
        result.gl_requirements += 1

    await db.flush()


# ── Step 5: TenantAccountMapping ─────────────────────────────────────────────

async def _clone_account_mappings(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """Clone TenantAccountMapping rows; remap gl_account_id."""
    live_rows = (await db.execute(
        select(TenantAccountMapping)
        .where(TenantAccountMapping.tenant_id == live_id)
    )).scalars().all()

    for live in live_rows:
        test_gl_id = id_map.coa.get(live.gl_account_id)
        if test_gl_id is None:
            continue
        db.add(TenantAccountMapping(
            tenant_id=test_id,
            role_key=live.role_key,
            gl_account_id=test_gl_id,
            created_by=None,  # audit field — not meaningful in test clone
        ))
        result.account_mappings += 1

    await db.flush()


# ── Step 6: BankAccount ───────────────────────────────────────────────────────

async def _clone_bank_accounts(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """
    Clone active BankAccount rows; remap gl_account_id; set created_by=None.

    currency is a plain VARCHAR(3) string — copied verbatim, no FK remap needed.
    """
    live_rows = (await db.execute(
        select(BankAccount)
        .where(BankAccount.tenant_id == live_id, BankAccount.is_active.is_(True))
    )).scalars().all()

    for live in live_rows:
        test_gl_id = id_map.coa.get(live.gl_account_id)
        if test_gl_id is None:
            continue  # linked GL was inactive — skip
        db.add(BankAccount(
            tenant_id=test_id,
            bank_name=live.bank_name,
            account_name=live.account_name,
            account_number=live.account_number,
            currency=live.currency,      # plain string, no remap
            gl_account_id=test_gl_id,
            is_default=live.is_default,
            is_active=True,
            created_by=None,             # audit field — do not copy
        ))
        result.bank_accounts += 1

    await db.flush()


# ── Step 7: Employee (two-pass) ───────────────────────────────────────────────

async def _clone_employees(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """
    Clone active Employee rows from live → test.

    Two-pass for line_manager_id (self-referential FK, same pattern as
    DimensionValue.cascade_value_id):
    Pass 1 — insert all rows with line_manager_id=None; build emp id-map keyed
             by (live_emp.id → test_emp.id) and also reverse-keyed by email for
             line-manager look-ups.
    Pass 2 — back-fill line_manager_id using the now-complete emp id-map.

    cost_center_id → DimensionValue — remapped via id_map.dimval.
    No FK to users on Employee (confirmed) — no user id remap needed.
    """
    live_rows = (await db.execute(
        select(Employee)
        .where(Employee.tenant_id == live_id, Employee.is_active.is_(True))
    )).scalars().all()

    # Pass 1: insert all, line_manager_id=None
    test_objects: dict[UUID, Employee] = {}  # live_emp_id → test Employee object

    for live in live_rows:
        test_cc_id: Optional[UUID] = None
        if live.cost_center_id:
            test_cc_id = id_map.dimval.get(live.cost_center_id)
            # If cost_center was inactive/not cloned → cost_center_id stays None

        test = Employee(
            tenant_id=test_id,
            employee_code=live.employee_code,
            first_name=live.first_name,
            last_name=live.last_name,
            other_name=live.other_name,
            preferred_name=live.preferred_name,
            email=live.email,
            phone=live.phone,
            cost_center_id=test_cc_id,
            line_manager_id=None,            # filled in pass 2
            resumption_date=live.resumption_date,
            is_active=True,
            employee_code_auto_generated=live.employee_code_auto_generated,
        )
        db.add(test)
        await db.flush()
        id_map.emp[live.id] = test.id
        test_objects[live.id] = test
        result.employees += 1

    # Pass 2: back-fill line_manager_id
    for live in live_rows:
        if live.line_manager_id and live.id in test_objects:
            test_manager_id = id_map.emp.get(live.line_manager_id)
            if test_manager_id:
                test_objects[live.id].line_manager_id = test_manager_id

    await db.flush()


# ── Step 8: CostCenterConfig ──────────────────────────────────────────────────

async def _clone_cost_center_configs(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """
    Clone CostCenterConfig rows.

    cost_center_id → DimValue (remap via id_map.dimval).
    head_employee_id → Employee (remap via id_map.emp).
    head_user_id → users.id — VERBATIM (global users table, no remap).
    """
    live_rows = (await db.execute(
        select(CostCenterConfig)
        .where(CostCenterConfig.tenant_id == live_id)
    )).scalars().all()

    for live in live_rows:
        test_cc_id = id_map.dimval.get(live.cost_center_id)
        if test_cc_id is None:
            continue  # cost center dimension value not cloned

        test_emp_id: Optional[UUID] = None
        if live.head_employee_id:
            test_emp_id = id_map.emp.get(live.head_employee_id)

        db.add(CostCenterConfig(
            tenant_id=test_id,
            cost_center_id=test_cc_id,
            head_employee_id=test_emp_id,
            head_user_id=live.head_user_id,    # verbatim — global users.id
        ))
        result.cost_center_configs += 1

    await db.flush()


# ── Step 9: FinanceReviewConfig ───────────────────────────────────────────────

async def _clone_finance_review_configs(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    id_map: _CloneIdMap,
    result: CloneResult,
) -> None:
    """
    Clone FinanceReviewConfig rows.

    reviewer_user_id → users.id — VERBATIM (global users table, no remap).
    cost_center_id   → DimValue  — remap via id_map.dimval (nullable).
    """
    live_rows = (await db.execute(
        select(FinanceReviewConfig)
        .where(FinanceReviewConfig.tenant_id == live_id)
    )).scalars().all()

    for live in live_rows:
        test_cc_id: Optional[UUID] = None
        if live.cost_center_id:
            test_cc_id = id_map.dimval.get(live.cost_center_id)
            # If not remapped (inactive cost center), cost_center_id becomes NULL

        db.add(FinanceReviewConfig(
            tenant_id=test_id,
            module=live.module,
            reviewer_user_id=live.reviewer_user_id,   # verbatim — global users.id
            review_level=live.review_level,
            cost_center_id=test_cc_id,
        ))
        result.finance_review_configs += 1

    await db.flush()


# ── Step 10: TenantOrgConfig ─────────────────────────────────────────────────

async def _clone_org_config(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    result: CloneResult,
) -> None:
    """
    Clone the live tenant's TenantOrgConfig row into the test shadow.

    This single step is the most impactful of the three new steps: its absence
    caused org_complete=False which cascade-locked Dimensions, CoA, Currencies,
    Tax, Employees, Roles, Workflows, and Module-setup despite their data being
    present. With this row in the test tenant, the Setup dashboard unlocks correctly.

    Uses _ORG_COPY_FIELDS (defined at module level, shared with promote() in
    tenant.py) so field lists stay in sync from one source of truth.

    No FK to any entity cloned in Steps 1-9 — can run in any order.
    """
    from app.models.setup import TenantOrgConfig

    live_cfg = (await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == live_id)
    )).scalar_one_or_none()

    if live_cfg:
        test_cfg = TenantOrgConfig(tenant_id=test_id)
        for f in _ORG_COPY_FIELDS:
            setattr(test_cfg, f, getattr(live_cfg, f))
        db.add(test_cfg)
        await db.flush()
        result.org_config = 1


# ── Step 11: TenantModule ─────────────────────────────────────────────────────

async def _clone_modules(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    result: CloneResult,
) -> None:
    """
    Clone all active TenantModule rows from live → test.

    Copies module_key, is_active, is_licensed (so the test shadow mirrors the
    live activation state). activated_by set NULL (audit field — the user who
    activated the module in live is not meaningful in the test context).
    activated_at copied verbatim.

    No FK to any entity cloned in Steps 1-9. UNIQUE on (tenant_id, module_key).
    """
    from app.models.setup import TenantModule

    live_rows = (await db.execute(
        select(TenantModule)
        .where(TenantModule.tenant_id == live_id, TenantModule.is_active.is_(True))
    )).scalars().all()

    for live in live_rows:
        db.add(TenantModule(
            tenant_id=test_id,
            module_key=live.module_key,
            is_active=live.is_active,
            is_licensed=live.is_licensed,
            activated_at=live.activated_at,
            activated_by=None,          # audit field — not meaningful in test clone
        ))
        result.modules += 1

    await db.flush()


# ── Step 12: ApprovalMatrix ───────────────────────────────────────────────────

async def _clone_approval_matrix(
    db: AsyncSession,
    live_id: UUID,
    test_id: UUID,
    result: CloneResult,
) -> None:
    """
    Clone the live tenant's ApprovalMatrix row (if one exists) into the test shadow.

    ApprovalMatrix is one-per-tenant (UNIQUE on tenant_id). If live has no row,
    skip silently — don't error the clone over an optional config table.

    No FK to any entity cloned in Steps 1-9.
    """
    from app.models.approvals import ApprovalMatrix

    live_row = (await db.execute(
        select(ApprovalMatrix).where(ApprovalMatrix.tenant_id == live_id)
    )).scalar_one_or_none()

    if live_row:
        db.add(ApprovalMatrix(
            tenant_id=test_id,
            levels=live_row.levels,
            level1_role=live_row.level1_role,
            level2_role=live_row.level2_role,
            level3_role=live_row.level3_role,
            amount_threshold_l2=live_row.amount_threshold_l2,
            amount_threshold_l3=live_row.amount_threshold_l3,
        ))
        await db.flush()
        result.approval_matrix = 1


# ── Public entry point ────────────────────────────────────────────────────────

async def clone_tenant_data(
    db: AsyncSession,
    live_tenant_id: UUID,
    test_tenant_id: UUID,
) -> CloneResult:
    """
    Copy all active configuration + master-data from the live tenant into the
    (already created, empty) test shadow tenant.

    Runs inside the caller's DB transaction (get_db commits on success, rolls
    back on any exception — all-or-nothing).

    Assumes Step 0 (UserTenant mirroring) has already been completed by the
    caller.  Steps run in strict dependency order:
        1.  TenantDimension
        2.  ChartOfAccount
        3.  DimensionValue         (2-pass: cascade_value_id)
        4.  GLDimensionRequirement
        5.  TenantAccountMapping
        6.  BankAccount
        7.  Employee               (2-pass: line_manager_id)
        8.  CostCenterConfig
        9.  FinanceReviewConfig
        10. TenantOrgConfig        ← setup completeness gate (unlocks cascade)
        11. TenantModule           ← setup completeness gate (modules_complete)
        12. ApprovalMatrix         ← setup completeness gate (workflows_complete)

    Steps 10-12 have no FK dependencies on Steps 1-9 (confirmed — only tenant_id
    foreign key) so their placement at the end is safe.

    Explicitly excluded (operational/historical, never cloned):
        EmployeeCodeHistory, EmployeeTransfer, any expense/journal/transactional data.

    Returns a CloneResult with per-entity counts for audit logging.
    """
    id_map = _CloneIdMap()
    result = CloneResult()

    # Steps 1-9: master data (FK-dependent, must stay in this order)
    await _clone_dimensions(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_coa(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_dimension_values(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_gl_requirements(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_account_mappings(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_bank_accounts(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_employees(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_cost_center_configs(db, live_tenant_id, test_tenant_id, id_map, result)
    await _clone_finance_review_configs(db, live_tenant_id, test_tenant_id, id_map, result)

    # Steps 10-12: setup completion gate tables (no FK deps on Steps 1-9)
    await _clone_org_config(db, live_tenant_id, test_tenant_id, result)
    await _clone_modules(db, live_tenant_id, test_tenant_id, result)
    await _clone_approval_matrix(db, live_tenant_id, test_tenant_id, result)

    return result
