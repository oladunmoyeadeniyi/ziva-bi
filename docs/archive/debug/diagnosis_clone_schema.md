# Diagnosis — Bank Accounts / Employees / Cost Centers Schema for Phase 4 Clone
**Date:** 2026-06-21  
**Purpose:** Drive design of live→test clone-on-create for BankAccount, Employee, CostCenterConfig — plus confirm the full dependency ordering for Phase 4.

---

## 1. BankAccount (`bank_account.py`)

### Full column list

```python
class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id:             Mapped[uuid.UUID]           # PK
    tenant_id:      Mapped[uuid.UUID]           # FK tenants.id CASCADE, indexed
    bank_name:      Mapped[str]                 # VARCHAR(255), NOT NULL
    account_name:   Mapped[str]                 # VARCHAR(255), NOT NULL
    account_number: Mapped[str]                 # VARCHAR(100), NOT NULL
    currency:       Mapped[str]                 # VARCHAR(3), NOT NULL — ISO code, NOT a FK
    gl_account_id:  Mapped[uuid.UUID]           # FK chart_of_accounts.id, NO CASCADE
    is_default:     Mapped[bool]                # NOT NULL, default False
    is_active:      Mapped[bool]                # NOT NULL, default True
    created_by:     Mapped[Optional[uuid.UUID]] # FK users.id SET NULL (nullable)
    created_at:     Mapped[datetime]
    updated_at:     Mapped[datetime]             # onupdate=func.now()
```

### FK dependencies

From the DB (`information_schema`):

| Column | References | Delete rule |
|---|---|---|
| `tenant_id` | `tenants.id` | CASCADE |
| `gl_account_id` | `chart_of_accounts.id` | **NO ACTION** |
| `created_by` | `users.id` | SET NULL |

- **`currency`** is a plain `VARCHAR(3)` string, **not a FK** to any currency table. Safe to copy verbatim.
- **`gl_account_id` → `chart_of_accounts.id` with NO CASCADE** — the FK will block deletion of a CoA row that is still referenced by a bank account. When cloning live→test, `gl_account_id` must be remapped from the live CoA UUID to the corresponding test CoA UUID (resolved via `gl_number` natural key, exactly as Phase 3a's id-map).
- **`created_by` → `users.id` SET NULL** — safe to set to `NULL` during clone (no remapping needed; `created_by` is audit-trail, not operational data).

### Unique constraint / natural key

**No DB-level unique constraint on `bank_accounts`** beyond the primary key:

```
bank_accounts_pkey          UNIQUE (id)
ix_bank_accounts_currency   INDEX (currency)       ← non-unique
ix_bank_accounts_gl_account_id INDEX (gl_account_id) ← non-unique
ix_bank_accounts_tenant_id  INDEX (tenant_id)       ← non-unique
```

The application enforces `is_default` uniqueness per `(tenant_id, currency)` via app logic, but this is NOT a DB constraint.

**Natural key for cloning:** No single column or combination is DB-enforced as unique. For clone purposes, `(account_number, currency)` is the most stable business identifier — a bank account number is globally unique to the account and combined with currency distinguishes multi-currency accounts at the same bank. However, since there's no constraint, duplicate account_numbers across different banks are theoretically possible. Use `(bank_name, account_number, currency)` as the composite natural key for idempotent clone logic, or simply always re-clone all active bank accounts from live to test on each test-environment refresh (no diff needed since test starts empty).

---

## 2. Employee (`master_data.py:320`)

### Full column list

```python
class Employee(Base):
    __tablename__ = "employees"

    id:                         Mapped[uuid.UUID]           # PK
    tenant_id:                  Mapped[uuid.UUID]           # FK tenants.id CASCADE, indexed
    employee_code:              Mapped[Optional[str]]       # VARCHAR(100), NULLABLE
    first_name:                 Mapped[str]                 # VARCHAR(100), NOT NULL
    last_name:                  Mapped[str]                 # VARCHAR(100), NOT NULL
    other_name:                 Mapped[Optional[str]]       # VARCHAR(100)
    preferred_name:             Mapped[Optional[str]]       # VARCHAR(100)
    email:                      Mapped[str]                 # VARCHAR(255), NOT NULL
    phone:                      Mapped[Optional[str]]       # VARCHAR(50)
    cost_center_id:             Mapped[Optional[uuid.UUID]] # FK dimension_values.id SET NULL
    line_manager_id:            Mapped[Optional[uuid.UUID]] # FK employees.id SET NULL — SELF-REF
    resumption_date:            Mapped[Optional[date]]      # Date
    is_active:                  Mapped[bool]                # NOT NULL, default True
    employee_code_auto_generated: Mapped[bool]              # NOT NULL, default False
    created_at:                 Mapped[datetime]
    updated_at:                 Mapped[datetime]             # onupdate=func.now()
```

### FK dependencies (from DB)

| Column | References | Delete rule |
|---|---|---|
| `tenant_id` | `tenants.id` | CASCADE |
| `cost_center_id` | `dimension_values.id` | **SET NULL** |
| `line_manager_id` | `employees.id` | **SET NULL** — self-referential |

**No FK to `users` on the Employee model.** Confirmed both from the model definition and from `information_schema` FK query. Employee master data is purely HR data and exists entirely independently of login accounts.

### Critical: Employee does NOT link to `users`

The `employees` table has **zero FK references to `users.id`**. An employee record (name, email, cost center, manager chain) is not linked to a Ziva BI login account. The `head_user_id` FK exists on `CostCenterConfig` (not on `Employee`). Employee master data can be cloned without any awareness of the `users` table.

### Unique constraints (from DB)

```
uq_employee_code_per_tenant   UNIQUE (tenant_id, employee_code)
uq_employee_email_per_tenant  UNIQUE (tenant_id, email)
```

Both are **full (non-partial) unique indexes**. However, `employee_code` is **nullable** — in PostgreSQL, a full unique index on a nullable column allows multiple NULLs (NULLs are never equal), so multiple employees can have `employee_code = NULL` without violating the constraint. The `email` column is NOT NULL and truly unique per tenant.

**Natural key for cloning: `email`** — NOT NULL, unique per tenant, stable business identifier. When cloning live→test, use `email` to match an employee in the test tenant to its live counterpart (for idempotent re-clones).

### Potential issue: `email` in test tenant

Employees have **real personal email addresses**. If the test tenant ever triggers any notification/email logic (e.g. expense approval emails, onboarding invites) referencing `employees.email`, real employees would receive test emails. **Flag for Phase 4 design:** the clone-on-create logic should clone `email` verbatim but the system should either (a) suppress all outbound emails in the test environment, or (b) prefix test emails (e.g. `test-{email}`) if email suppression is not implemented globally. No code change required now — just a noted risk.

### line_manager_id — self-referential, nullable

Confirmed: `line_manager_id` FK has `ondelete="SET NULL"` and the column is `nullable=True`. This is the exact same pattern as `DimensionValue.cascade_value_id`. **Two-pass cloning is required:**

- Pass 1: clone all Employee rows with `line_manager_id=NULL` regardless of actual value.
- Pass 2: after all test employee IDs are generated, back-fill `line_manager_id` using the `email`-based id-map (live_employee_id → test_employee_id).

---

## 3. CostCenterConfig (`master_data.py:466`)

### Full column list

```python
class CostCenterConfig(Base):
    __tablename__ = "cost_center_config"

    id:              Mapped[uuid.UUID]           # PK
    tenant_id:       Mapped[uuid.UUID]           # FK tenants.id CASCADE
    cost_center_id:  Mapped[uuid.UUID]           # FK dimension_values.id CASCADE, NOT NULL
    head_employee_id: Mapped[Optional[uuid.UUID]]# FK employees.id SET NULL, NULLABLE
    head_user_id:    Mapped[Optional[uuid.UUID]] # FK users.id SET NULL, NULLABLE
    created_at:      Mapped[datetime]
    updated_at:      Mapped[datetime]             # onupdate=func.now()
```

### FK dependencies (from DB)

| Column | References | Delete rule |
|---|---|---|
| `tenant_id` | `tenants.id` | CASCADE |
| `cost_center_id` | `dimension_values.id` | **CASCADE** — NOT NULL |
| `head_employee_id` | `employees.id` | SET NULL |
| `head_user_id` | `users.id` | SET NULL |

### head_user_id vs head_employee_id — purpose

- **`head_employee_id`** → `employees.id`: the **employee master data record** of the cost center head (HR data).
- **`head_user_id`** → `users.id`: the **Ziva BI login account** of the cost center head. This is used to grant the person approval-routing authority and portal access in their capacity as cost center head. `User` is a **global table** (not tenant-scoped), and the same `user_id` is valid in both the live tenant and the test shadow tenant. After `create_test_environment` mirrors `UserTenant` rows, both tenants share the same `user_id` values — so `head_user_id` can be copied verbatim during clone with no remapping.

### Unique constraint

```
uq_cost_center_config_per_tenant   UNIQUE (tenant_id, cost_center_id)
```

**One CostCenterConfig row per cost center per tenant.** Cardinality is 1:1 with DimensionValue within a tenant.

### Natural key for cloning

`cost_center_id` (UUID) is the FK to `dimension_values.id`. Since UUIDs differ between live and test tenants, the natural key for clone matching is the **dimension value's natural key**: `(dimension.code, value.code)` — resolved via the DimensionValue id-map built during Phase 3a/4 cloning. In practice: for each live `CostCenterConfig` row, find the test-tenant `dimension_values.id` that corresponds to the same `(dim.code, val.code)` pair, then create the config row with `cost_center_id = test_dim_value_id`.

### head_employee_id — nullable, CostCenterConfig creation order

`head_employee_id` is **nullable** (`ForeignKey(..., ondelete="SET NULL")`). CostCenterConfig **can** therefore be created before employees are cloned, with `head_employee_id=NULL`, then back-filled once the employee id-map is available. However, since employees must already be cloned for other reasons (and cloning is done in a single transaction), the simplest approach is to process CostCenterConfig **strictly after** all Employee rows are created — no need for a separate back-fill pass for `head_employee_id` (it can be resolved in one pass using the employee email→id-map).

---

## 4. Dependency chain for Phase 4 (complete, confirmed)

```
Step 0:  UserTenant mirroring  ← already done by create_test_environment
                                  (user_id values are globally valid in test context)

Step 1:  TenantDimension       ← no upstream deps; natural key: code

Step 2:  ChartOfAccount        ← no upstream deps (independent of dims);
                                  natural key: gl_number

Step 3:  DimensionValue        ← needs Step 1 (dimension_id);
          PASS 1: insert all with cascade_value_id=NULL, cascade_dimension_id remapped
          PASS 2: back-fill cascade_value_id using dimval id-map
          natural key: (dim.code, val.code)

Step 4:  GLDimensionRequirement ← needs Step 1 (dimension_id) + Step 2 (gl_id)
                                  natural key: (gl_number, dim.code)

Step 5:  TenantAccountMapping  ← needs Step 2 (gl_account_id)
                                  natural key: role_key

Step 6:  BankAccount           ← needs Step 2 (gl_account_id, remapped by gl_number)
                                  created_by: set NULL (no remapping)
                                  natural key: (bank_name, account_number, currency)

Step 7:  Employee              ← needs Step 3 (cost_center_id, remapped by dim+val code)
          PASS 1: insert all with line_manager_id=NULL
          PASS 2: back-fill line_manager_id using employee email→id map
          natural key: email

Step 8:  CostCenterConfig      ← needs Step 3 (cost_center_id) + Step 7 (head_employee_id)
                                  head_user_id: copy verbatim (global user IDs, no remap)
                                  natural key: (dim.code, val.code) of the cost center dim value
```

### Can CostCenterConfig be created before all Employees?

Yes (all fields nullable except `cost_center_id`), but the preferred approach is to create it **after** all employees are cloned (Step 8 after Step 7) so `head_employee_id` can be set in a single pass using the employee id-map rather than requiring a separate back-fill.

---

## 5. The `users` / `user_id` question

**Employee has NO link to `users` whatsoever.** Employee master data is purely HR configuration (name, code, cost center, manager chain) and does not require a Ziva BI login account.

**`create_test_environment` already mirrors all `UserTenant` rows** (lines 222–235 of `tenant.py`):
```python
live_uts_res = await db.execute(
    select(UserTenant).where(UserTenant.tenant_id == tenant_id)
)
live_uts = live_uts_res.scalars().all()
for live_ut in live_uts:
    db.add(UserTenant(
        user_id=live_ut.user_id,
        tenant_id=test_tenant.id,
        ...
    ))
```

**DB confirms:** Live user_tenants = 2 rows; Shadow user_tenants = 2 rows (both user IDs mirrored).

**Order implication:** User mirroring happens at Step 0 (inside `create_test_environment`), before any master-data clone runs. By the time Step 8 (CostCenterConfig) executes, the test-tenant `user_tenants` rows already exist. `head_user_id` in CostCenterConfig references `users.id` (the global `users` table, not `user_tenants`) — the same `user_id` UUID is valid everywhere, so copying `head_user_id` verbatim from live to test requires **no remapping whatsoever**.

---

## 6. line_manager_id self-referential FK — two-pass confirmation

- **Column:** `line_manager_id: Mapped[Optional[uuid.UUID]]` with `ForeignKey("employees.id", ondelete="SET NULL")`, `nullable=True`
- **Exact same pattern** as `DimensionValue.cascade_value_id` (which the Phase 3a engine handles with two passes).
- **Two-pass is required:** If employee A is the manager of employee B, and both are cloned, then when inserting employee B with `line_manager_id = live_A_id`, the FK would fail unless test-tenant employee A has already been inserted. Since insertion order cannot be guaranteed for arbitrarily deep manager chains, the only safe approach is:
  1. Pass 1: insert all employees with `line_manager_id = NULL`
  2. Pass 2: iterate all employees that had a non-NULL `line_manager_id` in live and update the test row's `line_manager_id = id_map[live_manager_id]` using the built employee id-map keyed by `email`.

---

## 7. Summary table — new entities

| Entity | Natural key | FK deps | Two-pass? | Copy users.id? |
|---|---|---|---|---|
| `BankAccount` | `(bank_name, account_number, currency)` — no DB constraint | `gl_account_id` → CoA (remap by gl_number) | No | `created_by`: set NULL |
| `Employee` | `email` (unique per tenant, NOT NULL) | `cost_center_id` → DimValue (remap), `line_manager_id` → self (remap) | **Yes** (self-ref) | No FK to users |
| `CostCenterConfig` | `(dim.code, val.code)` of the cost_center DimValue | `cost_center_id` → DimValue (remap), `head_employee_id` → Employee (remap by email) | No | `head_user_id`: copy verbatim |

### Additional related tables (not in scope for clone but worth noting)

- `EmployeeCodeHistory` (`employee_id` → employees.id CASCADE): history rows, not config. Should **NOT** be cloned — they are operational history from the live tenant, not configuration.
- `EmployeeTransfer` (`employee_id` → employees.id CASCADE): same — operational history, not config.
- `FinanceReviewConfig` (`reviewer_user_id` → users.id CASCADE, NOT NULL): links a user to a module/cost_center review slot. `reviewer_user_id` copies verbatim (global user IDs). `cost_center_id` → DimValue (remap). Could be included in Phase 4 clone — **not in scope for this brief but worth adding to the Phase 4 design as a simple step after CostCenterConfig**.
