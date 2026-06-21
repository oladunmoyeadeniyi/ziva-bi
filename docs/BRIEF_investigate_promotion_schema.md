Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Investigate schema for Phase 3 (repeatable CoA/dimensions/periods promotion). Report only, no changes.

**Purpose:** Designing repeatable test→live promotion of Chart of Accounts, Dimensions (+ values), Dimension Requirements, and Periods/Fiscal Year config. This requires matching a test-tenant row to its already-promoted live-tenant counterpart across multiple promotions (not a one-time clone — the client reconfigures test repeatedly and re-promotes). Need to know whether natural/business keys are reliably unique per tenant before designing the matching strategy. Investigate and report. Do NOT change any code.

---

## Investigate and report (no code changes)

### 1. Chart of Accounts (`ChartOfAccount` model, likely master_data.py)
- Full column list with types.
- Is there a UNIQUE constraint (DB-level) on `(tenant_id, gl_number)`? Report the exact constraint or confirm none exists.
- Could two active accounts in the same tenant ever share a `gl_number` today (check for any code path that allows this, even if unlikely)?
- Every column that would need to carry over (gl_number, gl_name, account_type, account_classification, is_active, parent/hierarchy fields if any).
- Any self-referential or other FK on this table (e.g. parent_account_id)?

### 2. Dimensions + Dimension Values (`TenantDimension`, `DimensionValue` or equivalent)
- Full column lists.
- Is there a UNIQUE constraint on dimension `code` per tenant? On dimension VALUE `code` per (tenant, dimension)?
- Relationship between TenantDimension and DimensionValue (FK direction, cascade rules).
- Any hierarchy (parent dimension value) — self-referential FK?
- `valid_from`/`valid_to` fields mentioned in memory — report exact fields, since the standing date-floor rule applies to any promoted dates too.

### 3. GL Dimension Requirements (`GLDimensionRequirement` or equivalent — links dimensions to GL roles/accounts as required/optional)
- Full columns, FKs (to PostingRole? to ChartOfAccount? to TenantDimension?).
- Is there a natural key here, or is it purely FK-based (meaning it can ONLY be matched via already-resolved CoA/Dimension mappings, not independently)?

### 4. Periods / Fiscal Year config (`AccountingPeriod`, `FiscalYearState`, or equivalent from periods.py / setup.py)
- Full columns.
- Is there a natural key (e.g. tenant + period start/end date, or period_number + year)? Or is this tenant-level singleton config (e.g. period_frequency, fiscal_year_start_month) rather than multi-row data?
- Confirm: does promoting "periods" mean copying period STRUCTURE/CONFIG (e.g. monthly, Jan-Dec) rather than actual period STATUS rows (open/closed) — since status is operational, not configuration? Report what fields exist so we can separate config-to-promote from state-that-shouldn't-promote.

### 5. Account Mapping / Posting Roles (relevant since CoA promotion affects these)
- Does `TenantAccountMapping` (role_key → gl_account_id) need to be promoted too, or is this out of scope for Phase 3 (state your read — it references gl_account_id, so if CoA is promoted with new IDs, any test-tenant mappings would need the same remapping treatment)? Just report the dependency, don't design yet.

### 6. Existing promote() code patterns
- Re-confirm exactly how `promote()` (tenant.py) currently copies org_config/tax/fx — does it do a simple field-by-field copy (no ID remapping needed since those are singleton tenant-level configs, not multi-row FK-laden data)? Confirm this contrast against CoA/dimensions (multi-row, FK-laden) so the design difference is clear.
- Is there any existing ID-mapping table or pattern anywhere in the codebase (any precedent for "external_id" or "source_id" tracking)? Report if anything like this exists, even in an unrelated module.

### 7. Tenant scoping confirmation
- Confirm every table above is strictly tenant_id-scoped (no shared/global rows that both test and live tenants point to) — important for confirming a clean per-tenant copy is even the right mental model.

---

## Output
Write full findings to `docs/diagnosis_promotion_schema.md`. Quote exact model code for each table (column lists, constraints) rather than summarizing. This will directly drive a design for repeatable promotion — precision matters.
