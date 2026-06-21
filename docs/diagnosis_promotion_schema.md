# Diagnosis — Schema for Phase 3 Repeatable CoA / Dimensions / Periods Promotion
**Date:** 2026-06-21  
**Purpose:** Drive design of repeatable test→live promotion for Chart of Accounts, Dimensions, GL Dimension Requirements, and Periods. Report only — no code changes.

---

## 1. Chart of Accounts (`ChartOfAccount`, `master_data.py:153`)

### Full column list

```python
class ChartOfAccount(Base):
    __tablename__ = "chart_of_accounts"

    id: Mapped[uuid.UUID]           # PK, UUID, primary key
    tenant_id: Mapped[uuid.UUID]    # FK tenants.id CASCADE, indexed
    gl_number: Mapped[str]          # VARCHAR(50), NOT NULL
    gl_name: Mapped[str]            # VARCHAR(255), NOT NULL
    account_type: Mapped[str]       # VARCHAR(20), NOT NULL — 'PL' | 'BS' | 'SOCI' | 'SOFP'
    is_active: Mapped[bool]         # NOT NULL, default True

    # M8.1: GL hierarchy
    gl_group: Mapped[Optional[str]]         # VARCHAR(100)
    gl_subgroup: Mapped[Optional[str]]      # VARCHAR(100)
    gl_sub_subgroup: Mapped[Optional[str]]  # VARCHAR(100)

    # M8.1: Financial statement mappings
    fs_head: Mapped[Optional[str]]          # VARCHAR(100)
    fs_note: Mapped[Optional[str]]          # VARCHAR(100)
    tb_mapping: Mapped[Optional[str]]       # VARCHAR(100)

    # M8.1: Group reporting
    group_account_number: Mapped[Optional[str]]  # VARCHAR(50)
    group_account_name: Mapped[Optional[str]]    # VARCHAR(255)

    # M8.3: Classification + FX
    account_classification: Mapped[Optional[str]]   # VARCHAR(100)
    is_foreign_currency: Mapped[bool]               # nullable=True, default False
    foreign_currency_code: Mapped[Optional[str]]    # VARCHAR(10)
    revalue_at_period_end: Mapped[bool]             # nullable=True, default False

    # M8.2: implementation lock
    locked_by_implementation: Mapped[bool]  # NOT NULL, default False

    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]              # onupdate=func.now()
```

**No self-referential FK. No `parent_account_id`. Flat table.**  
Hierarchy is stored entirely as free-text string columns (`gl_group`, `gl_subgroup`, `gl_sub_subgroup`), not as a tree FK. No parent-child ID relationship to worry about during promotion.

### Unique constraint on `gl_number`

**DB-level unique index exists — conditional (partial):**

```sql
CREATE UNIQUE INDEX uq_chart_of_accounts_gl_number
  ON public.chart_of_accounts USING btree (tenant_id, gl_number)
  WHERE (is_active = true)
```

This is a **partial unique index** — uniqueness only applies to **active** accounts.  
**Implication:** Two accounts with the same `gl_number` can coexist in the same tenant if one is `is_active=False`. A deactivated account does NOT block creating a new active account with the same `gl_number`. This is the designed behaviour (it allows GL renumbering/reuse after deactivation).

**The ORM model does not declare this constraint** — no `UniqueConstraint` or `__table_args__` in `ChartOfAccount`. It exists only in the DB migration.

### Could duplicate `gl_number` exist among active accounts?

No active-to-active duplicate is possible: the partial unique index prevents it at the DB layer. However, there is **no application-level guard** in the router before insert — the DB constraint is the only protection. An INSERT race or bulk-upload error could only fail at the DB level (IntegrityError on the unique index).

### Fields that must carry over during promotion

All non-ID, non-audit columns: `gl_number`, `gl_name`, `account_type`, `is_active`, `gl_group`, `gl_subgroup`, `gl_sub_subgroup`, `fs_head`, `fs_note`, `tb_mapping`, `group_account_number`, `group_account_name`, `account_classification`, `is_foreign_currency`, `foreign_currency_code`, `revalue_at_period_end`, `locked_by_implementation`.

**NOT carried over:** `id` (regenerated per-tenant), `tenant_id` (set to live tenant), `created_at`/`updated_at` (server-generated).

### Natural key for promotion matching

**`(tenant_id, gl_number)` is the natural key — uniquely identifies an active GL account per tenant.**  
Promotion strategy: `gl_number` is the match key. For each test-tenant active account, look up the live-tenant account by `gl_number` → update if found, insert if not.

---

## 2. Dimensions (`TenantDimension`, `master_data.py:32`) and Dimension Values (`DimensionValue`, `master_data.py:88`)

### TenantDimension — full column list

```python
class TenantDimension(Base):
    __tablename__ = "tenant_dimensions"

    id: Mapped[uuid.UUID]            # PK
    tenant_id: Mapped[uuid.UUID]     # FK tenants.id CASCADE, indexed
    name: Mapped[str]                # VARCHAR(100), NOT NULL
    code: Mapped[str]                # VARCHAR(50), NOT NULL
    is_required: Mapped[bool]        # NOT NULL, default False
    is_active: Mapped[bool]          # NOT NULL, default True
    sort_order: Mapped[int]          # NOT NULL, default 0
    accepted_value_types: Mapped[Optional[str]]        # VARCHAR(500) — comma-separated
    locked_by_implementation: Mapped[bool]             # NOT NULL, default False
    value_source: Mapped[Optional[str]]                # VARCHAR(50), default "manual"
    dimension_sources: Mapped[Optional[list]]          # JSONB
    display_name: Mapped[Optional[str]]                # VARCHAR(255)
    description: Mapped[Optional[str]]                 # VARCHAR(500)
    icon: Mapped[Optional[str]]                        # VARCHAR(50)
    created_at: Mapped[datetime]
```

**Unique constraint on `code` — partial, active-only:**

```sql
CREATE UNIQUE INDEX uq_tenant_dimensions_code
  ON public.tenant_dimensions USING btree (tenant_id, code)
  WHERE (is_active = true)
```

Same pattern as CoA: uniqueness applies only among active dimensions. An inactive dimension does not block creating a new one with the same `code`.

**No `__table_args__` in the ORM model** — constraint exists only in the DB migration.

**Natural key:** `(tenant_id, dimension.code)` among active dimensions.  
**Docstring says:** *"code is auto-generated from name (lowercase, underscores) and must be unique per tenant."*

### DimensionValue — full column list

```python
class DimensionValue(Base):
    __tablename__ = "dimension_values"

    id: Mapped[uuid.UUID]             # PK
    tenant_id: Mapped[uuid.UUID]      # FK tenants.id CASCADE, indexed
    dimension_id: Mapped[uuid.UUID]   # FK tenant_dimensions.id CASCADE, indexed
    code: Mapped[str]                 # VARCHAR(100), NOT NULL
    name: Mapped[str]                 # VARCHAR(255), NOT NULL
    is_active: Mapped[bool]           # NOT NULL, default True
    sort_order: Mapped[int]           # NOT NULL, default 0
    created_at: Mapped[datetime]
    value_type: Mapped[Optional[str]] # VARCHAR(100) — free-text category
    # M8.1: cascading auto-fill
    cascade_dimension_id: Mapped[Optional[uuid.UUID]]  # FK tenant_dimensions.id SET NULL
    cascade_value_id: Mapped[Optional[uuid.UUID]]      # FK dimension_values.id SET NULL — SELF-REF
    # M8.1: date-range activation
    valid_from: Mapped[Optional[date]]
    valid_to: Mapped[Optional[date]]
```

**Self-referential FK: `cascade_value_id` → `dimension_values.id` SET NULL.**  
This is the key complication for promotion: a value can reference another value (in the same or different dimension) for the cascading auto-fill feature. During promotion, if the referenced `cascade_value_id` belongs to the test tenant, it must be remapped to the corresponding live-tenant value.

**Unique constraint on value `code` — partial, active-only:**

```sql
CREATE UNIQUE INDEX uq_dimension_values_code
  ON public.dimension_values USING btree (tenant_id, dimension_id, code)
  WHERE (is_active = true)
```

Uniqueness is `(tenant_id, dimension_id, code)` among active values. The dimension_id in this index is the test-tenant's dimension_id — meaning promotion must first resolve the live dimension_id before matching values.

**Natural key for promotion matching:**  
`(tenant_id, dimension.code, value.code)` — the composite (dimension code, value code) pair uniquely identifies a value across tenants after dimension IDs are remapped.

**`valid_from` / `valid_to` fields:**  
Date-range activation. These store absolute dates (not relative). When promoting, these should be copied verbatim — there is no "floor date" currently enforced at the model layer. If a test value was valid_to in the past, it would be promoted as inactive by effective date, which may or may not be intentional. **Design note: promotion should probably warn if valid_to < today.**

**Relationship to TenantDimension:**  
`DimensionValue.dimension_id` → `TenantDimension.id` CASCADE. Deleting a dimension cascades to delete all its values. `TenantDimension.values` relationship: `cascade="all, delete-orphan"`.

**Hierarchy:** No parent-child tree between dimension values. The self-ref (`cascade_value_id`) is for auto-fill cascading, not a hierarchy. Dimension values are flat.

---

## 3. GL Dimension Requirements (`GLDimensionRequirement`, `master_data.py:236`)

### Full column list

```python
class GLDimensionRequirement(Base):
    __tablename__ = "gl_dimension_requirements"

    id: Mapped[uuid.UUID]             # PK
    tenant_id: Mapped[uuid.UUID]      # FK tenants.id CASCADE, indexed
    gl_id: Mapped[uuid.UUID]          # FK chart_of_accounts.id CASCADE, indexed
    dimension_id: Mapped[uuid.UUID]   # FK tenant_dimensions.id CASCADE, indexed
    requirement: Mapped[str]          # VARCHAR(20) — 'required' | 'optional' | 'na'
```

**Unique constraint:**

```sql
CREATE UNIQUE INDEX uq_gl_dimension_req
  ON public.gl_dimension_requirements USING btree (gl_id, dimension_id)
```

Note: this unique index is on `(gl_id, dimension_id)` — **not scoped by tenant_id**. Since `gl_id` → `chart_of_accounts.id` is globally unique (UUID PK), this effectively scopes by tenant. But it means the constraint does not include `tenant_id` explicitly.

### Natural key

**Purely FK-based.** There is no business-level natural key independent of the resolved GL and Dimension IDs. The natural key is `(tenant's gl_number, tenant's dimension.code, requirement)` — but you must first resolve `gl_number` → live `gl_id` and `dimension.code` → live `dimension_id` before matching.

**Can only be promoted AFTER both CoA and Dimensions are promoted** — this is a dependent/leaf table in the promotion order.

### FKs

- `gl_id` → `chart_of_accounts.id` CASCADE (if GL deleted, requirement deleted)
- `dimension_id` → `tenant_dimensions.id` CASCADE (if dimension deleted, requirement deleted)
- `tenant_id` → `tenants.id` CASCADE

**No FK to `posting_roles`** — GLDimensionRequirements link GL accounts to Dimensions, not to posting roles.

---

## 4. Periods / Fiscal Year Config

### `AccountingPeriod` (`setup.py:369`)

```python
class AccountingPeriod(Base):
    __tablename__ = "accounting_periods"

    id: Mapped[uuid.UUID]
    tenant_id: Mapped[uuid.UUID]           # FK tenants.id CASCADE
    fiscal_year: Mapped[str]               # VARCHAR(20) — e.g. "FY2026"
    period_no: Mapped[int]                 # 1-based (1–12 for monthly)
    period_name: Mapped[str]               # VARCHAR(50) — e.g. "January 2026"
    start_date: Mapped[date]               # accounting start date
    end_date: Mapped[date]                 # accounting end date
    status: Mapped[str]                    # 'FUTURE' | 'OPEN' | 'SOFT_CLOSED' | 'OVERDUE' | 'HARD_CLOSED'
    hard_closed_at: Mapped[Optional[datetime]]
    hard_closed_by: Mapped[Optional[uuid.UUID]]
    soft_closed_at: Mapped[Optional[datetime]]
    grace_expires_at: Mapped[Optional[datetime]]
    reopened_count: Mapped[int]            # default 0
    created_at: Mapped[datetime]

    __table_args__ = (
        UniqueConstraint("tenant_id", "fiscal_year", "period_no",
                         name="uq_accounting_periods_tenant_year_no"),
    )
```

**Natural key: `(tenant_id, fiscal_year, period_no)` — explicit UNIQUE constraint in both ORM and DB.**

### `FiscalYearState` (`setup.py:577`)

```python
class FiscalYearState(Base):
    __tablename__ = "fiscal_year_states"

    id: Mapped[uuid.UUID]
    tenant_id: Mapped[uuid.UUID]
    fiscal_year: Mapped[str]                # VARCHAR(20) — e.g. "FY2026"
    status: Mapped[str]                     # 'OPEN' | 'AUDIT_PENDING' | 'AUDIT_OVERDUE' | 'STATUTORY_CLOSED'
    management_closed_at: Mapped[Optional[datetime]]
    management_closed_by: Mapped[Optional[uuid.UUID]]
    audit_grace_months: Mapped[int]         # default 3
    audit_grace_expires_at: Mapped[Optional[datetime]]
    statutory_closed_at: Mapped[Optional[datetime]]
    statutory_closed_by: Mapped[Optional[uuid.UUID]]
    retained_earnings_rolled: Mapped[bool]  # default False
    created_at: Mapped[datetime]

    __table_args__ = (
        UniqueConstraint("tenant_id", "fiscal_year",
                         name="uq_fiscal_year_states_tenant_year"),
    )
```

**Natural key: `(tenant_id, fiscal_year)` — explicit UNIQUE constraint.**

### What "promoting periods" means — config vs. state

**`AccountingPeriod` is both config AND state.** The config-like fields (what to promote):
- `fiscal_year`, `period_no`, `period_name`, `start_date`, `end_date`

The operational-state fields (must NOT be promoted — they belong to the live tenant):
- `status`, `hard_closed_at`, `hard_closed_by`, `soft_closed_at`, `grace_expires_at`, `reopened_count`

**Promoting "period structure"** means creating the period rows (`fiscal_year`, `period_no`, `period_name`, `start_date`, `end_date`) on the live tenant if they don't already exist, with `status="FUTURE"` — NOT copying the test tenant's period statuses.

**`FiscalYearState` is purely operational state.** It tracks the year-end close lifecycle of a live accounting year. There is nothing to "promote" from test to live — the live tenant will build its own FiscalYearState as it actually closes years. Promoting a STATUTORY_CLOSED fiscal year state from test would be dangerous.

**`TenantOrgConfig` already holds the period structure config** (what would drive period generation):
- `fiscal_year_start_month`, `fiscal_year_start_day`, `fiscal_year_name_format`, `period_closing_frequency`

These are already in the `org_config` section that Phase 2 promote supports. The actual `accounting_periods` rows are generated by `POST /api/setup/periods/generate` — this endpoint reads `TenantOrgConfig` to know the structure. So promoting org_config promotes the period *structure parameters*, and the live tenant can regenerate its periods from those parameters.

**Summary: promoting "periods" (Phase 3) realistically means:**  
Option A — Promote `accounting_periods` rows (structure only: year/period_no/name/dates) with `status=FUTURE`, skipping all state. Useful if the test tenant has defined custom period names.  
Option B — Rely on `org_config` already being promoted, then let the live consultant run "Generate periods" — since period generation is deterministic from the org config parameters. No ID remapping needed since `AccountingPeriod` has no FK to CoA or Dimensions.

---

## 5. Account Mapping / Posting Roles — Dependency on CoA Promotion

### `TenantAccountMapping`

```python
class TenantAccountMapping(Base):
    __tablename__ = "tenant_account_mappings"

    id: Mapped[uuid.UUID]
    tenant_id: Mapped[uuid.UUID]       # FK tenants.id CASCADE
    role_key: Mapped[str]              # FK posting_roles.role_key CASCADE
    gl_account_id: Mapped[uuid.UUID]   # FK chart_of_accounts.id (no cascade)
    created_by: Mapped[Optional[uuid.UUID]]
    created_at, updated_at

    __table_args__ = (UniqueConstraint("tenant_id", "role_key", name="uq_tam_tenant_role"),)
```

**`gl_account_id` → `chart_of_accounts.id` with NO CASCADE (no ondelete specified).**  
The FK exists but deletion of a CoA row does not cascade to account mappings (the FK would block the deletion instead).

### Dependency on CoA promotion

`TenantAccountMapping.gl_account_id` is a UUID that points to a specific `chart_of_accounts.id` row in the tenant's CoA. Since the live tenant's CoA rows will have **different UUIDs** from the test tenant's CoA rows (even for the same `gl_number`), any test-tenant account mapping pointing to a test CoA row would have an **invalid `gl_account_id`** in the live tenant after CoA promotion.

**The `TenantAccountMapping` must therefore also be re-promoted whenever CoA is promoted**, using `gl_number` as the match key to resolve the correct live `gl_account_id`.

Natural key for matching: `(tenant_id, role_key)` — unique per tenant per role. Match on `role_key`, then look up the live CoA by `gl_number` to get the correct live `gl_account_id`.

**`PostingRole` (`posting_roles` table) is a GLOBAL catalogue, not tenant-scoped.** It uses `role_key` (string) as a PK — no UUIDs. This makes it safe to reference across tenants by key.

---

## 6. How the existing `promote()` copies org_config / tax / fx

### Pattern: singleton tenant-level JSONB blobs — no ID remapping needed

```python
# org_config: one TenantOrgConfig row per tenant
# tax:        one TenantTaxConfig row per tenant
# fx:         one TenantFxConfig row per tenant

# For each section, promote() does:
if live_cfg:
    for f in _ORG_COPY_FIELDS:
        setattr(live_cfg, f, getattr(test_cfg, f))   # field-by-field overwrite
else:
    new_cfg = TenantOrgConfig(tenant_id=live_tenant_id)  # fresh row for live
    for f in _ORG_COPY_FIELDS:
        setattr(new_cfg, f, getattr(test_cfg, f))
    db.add(new_cfg)
```

**Why no ID remapping is needed for singleton blobs:**
- `TenantOrgConfig`, `TenantTaxConfig`, `TenantFxConfig` are all single-row-per-tenant.
- Their data is JSONB or scalar fields — they do NOT contain UUIDs that reference rows in other tables (exception: `enabled_currencies` is a string list, not UUIDs; `reporting_currency` is a string).
- The `functional_currency` field is a string code, not a UUID. Completely safe to copy verbatim.
- `branding` is a JSONB blob of visual config — no UUIDs inside.

**This is the key architectural contrast with CoA / Dimensions:**

| Data type | Rows | IDs in data | Copy strategy |
|---|---|---|---|
| `TenantOrgConfig` | 1 per tenant | No foreign UUIDs in fields | Field-by-field copy ✓ |
| `TenantTaxConfig` | 1 per tenant | No foreign UUIDs in fields | Field-by-field copy ✓ |
| `TenantFxConfig` | 1 per tenant | No foreign UUIDs in fields | Field-by-field copy ✓ |
| `ChartOfAccount` | Many per tenant | No FK into other tenant tables | Natural key (`gl_number`) match ✓ |
| `TenantDimension` | Many per tenant | No FK into other tenant tables | Natural key (`code`) match ✓ |
| `DimensionValue` | Many per dimension | Self-ref `cascade_value_id` (same tenant) | Natural key match + self-ref remapping |
| `GLDimensionRequirement` | Many per GL×dim | `gl_id` + `dimension_id` (must be remapped) | Dependent on CoA+Dim promotion |
| `TenantAccountMapping` | 1 per role per tenant | `gl_account_id` (must be remapped) | Natural key (`role_key`) + CoA remapping |

### Existing ID-mapping table or pattern

**None exists anywhere in the codebase.** The only near-equivalent is `JournalEntry.source_reference` (a free-text string linking a journal back to its source document number). There is no "external_id", "source_id", "origin_id", "promoted_from", or any cross-tenant ID mapping table.

**Implication:** Phase 3 will need to either:
- Build an in-memory mapping during the promotion transaction (test_id → live_id for GL accounts and dimensions), or
- Add a lightweight persistence layer (e.g., a `test_to_live_id_map` table) for multi-step promotion where the mapping needs to survive across requests.
- Use natural keys exclusively (gl_number, dimension.code, dimension_value.code) to avoid needing to persist UUID mappings at all.

---

## 7. Tenant Scoping Confirmation

Every table investigated is strictly tenant-scoped:

| Table | Scoped by |
|---|---|
| `chart_of_accounts` | `tenant_id` (indexed, FK CASCADE) |
| `tenant_dimensions` | `tenant_id` (indexed, FK CASCADE) |
| `dimension_values` | `tenant_id` (indexed, FK CASCADE) |
| `gl_dimension_requirements` | `tenant_id` (indexed, FK CASCADE) |
| `accounting_periods` | `tenant_id` (indexed, FK CASCADE) |
| `fiscal_year_states` | `tenant_id` (indexed, FK CASCADE) |
| `tenant_account_mappings` | `tenant_id` (indexed, FK CASCADE) |

**`posting_roles` is the ONLY global (non-tenant-scoped) table** — it is the system-level catalogue of posting role keys (e.g. `"employee_payable"`, `"output_vat"`). Both test and live tenants reference the same global `posting_roles.role_key`. This is by design and is not a problem for promotion — the role keys are stable string identifiers, not UUIDs.

---

## Summary — Natural Keys Available per Table

| Table | Natural key for promotion matching | DB-level unique constraint |
|---|---|---|
| `chart_of_accounts` | `(tenant_id, gl_number)` active only | Partial UNIQUE index (active only) |
| `tenant_dimensions` | `(tenant_id, code)` active only | Partial UNIQUE index (active only) |
| `dimension_values` | `(tenant_id, dimension_id, code)` active only → needs dimension mapped first | Partial UNIQUE index (active only) |
| `gl_dimension_requirements` | FK-only — natural key is `(gl_number, dimension.code)` → needs both mapped | Full UNIQUE on `(gl_id, dimension_id)` |
| `accounting_periods` | `(tenant_id, fiscal_year, period_no)` | Full UNIQUE constraint (ORM + DB) |
| `fiscal_year_states` | `(tenant_id, fiscal_year)` — but should NOT be promoted (operational) | Full UNIQUE constraint (ORM + DB) |
| `tenant_account_mappings` | `(tenant_id, role_key)` | Full UNIQUE constraint (ORM + DB) |

## Key Design Constraints for Phase 3

1. **Partial unique indexes on `is_active=true`:** A deactivated account with the same `gl_number` can coexist with a new active one. Promotion must match on `gl_number` among ACTIVE test rows only.

2. **No existing UUID mapping infrastructure.** Phase 3 must build its own in-memory mapping (test_id → live_id) during the promotion transaction, or rely entirely on natural keys to avoid UUID dependency.

3. **Required promotion order** (dependency graph):
   - Step 1: `TenantDimension` (natural key: `code`)
   - Step 2: `ChartOfAccount` (natural key: `gl_number`) — independent of dimensions
   - Step 3: `DimensionValue` (natural key: `dimension.code + value.code`; needs step 1 to resolve `dimension_id`; self-ref `cascade_value_id` may need a second pass)
   - Step 4: `GLDimensionRequirement` (needs steps 1+2 to resolve `gl_id`+`dimension_id`)
   - Step 5: `TenantAccountMapping` (needs step 2 to resolve `gl_account_id`)

4. **`DimensionValue.cascade_value_id` self-reference** is the only true circular FK challenge. Values can reference other values in the same tenant. A two-pass approach (insert all values first with `cascade_value_id=NULL`, then update cascade references) is likely needed to avoid FK violations during insertion.

5. **Periods: promote structure, not state.** `accounting_periods` rows with `status=FUTURE` should be the copy target. `fiscal_year_states` should NOT be promoted. Since `org_config` (already in Phase 2) carries the period generation parameters, an alternative is to just re-run the period-generation endpoint on the live tenant after org_config is promoted.
