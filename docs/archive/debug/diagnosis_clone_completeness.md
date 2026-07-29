# Diagnosis — Cloned Test Shadow Shows 0% Setup Completion
**Date:** 2026-06-21

---

## What the setup dashboard actually checks (per `GET /api/setup/progress`)

Each section's "complete" status is evaluated by a specific query or flag. Source: `backend/app/routers/setup.py:350–584`.

| Section | Completion check | Data source |
|---|---|---|
| **Organisation** | `org.legal_name AND org.functional_currency` both non-null | `tenant_org_config` row |
| **Module activation** | At least 1 `tenant_modules` row with `is_active=True` | `tenant_modules` |
| **Dimensions** | Row count > 0 OR `tenant.dimensions_not_applicable=True` | `tenant_dimensions` |
| **Chart of Accounts** | Row count > 0 | `chart_of_accounts` |
| **Employees** | Row count > 0 | `employees` |
| **Currencies & FX** | `org.functional_currency` non-null | `tenant_org_config` |
| **Tax & statutory** | At least one of `vat_config`/`wht_config`/`paye_config` set | `tenant_tax_config` |
| **Roles & permissions** | At least 1 `user_tenants` row with `role_tier='power_admin'` | `user_tenants` |
| **Approval workflows** | At least 1 row in `approval_matrix` | `approval_matrix` |
| **Module setup** | `tenant_expense_config` row exists | `tenant_expense_config` |
| **Document rules** | `tenant.documents_setup_complete=True` flag | `tenants.documents_setup_complete` |
| **Go-live** | All blocking items complete | composite |

**Critical: if Organisation is not complete, a cascade lock propagates:**
```python
dims_locked        = not org_complete          # Dimensions locked
coa_locked         = not (dims_complete) or dims_locked   # CoA locked
employees_locked   = not coa_complete or coa_locked
roles_locked       = not employees_complete or employees_locked
workflows_locked   = not roles_complete or roles_locked
tax_locked         = not org_complete
module_setup_locked = not (coa_complete and dims_complete)
```

The `_s()` helper evaluates `locked` BEFORE `complete`:
```python
if locked:   st = "locked"
elif complete: st = "complete"
else:        st = "not_started"
```
So a section can have data (`dim_count = 6 → complete=True`) but show as "locked" because its upstream dependency failed.

---

## What the clone engine copies vs. what completeness checks need

Tested on a fresh Red Bull test shadow. Counts from `diag_clone_completeness.py`.

### CLONED — data rows are present in shadow

| Table | Shadow count | Completeness check? |
|---|---|---|
| `tenant_dimensions` | **6** | Partial — drives `dim_count > 0` → `dims_complete=True` but **`dims_locked=True` overrides** |
| `chart_of_accounts` | **595** | Partial — drives `coa_count > 0` → `coa_complete=True` but **`coa_locked=True` overrides** |
| `dimension_values` | **147** | Not a completeness check |
| `gl_dimension_requirements` | **3,570** | Not a completeness check |
| `tenant_account_mappings` | **17** | Not a completeness check |
| `bank_accounts` | **2** | Not a completeness check |
| `employees` | 0 (none in live) | `employees_complete=False` (0 employees in live Red Bull) |
| `cost_center_config` | 0 (none in live) | Not a completeness check |
| `finance_review_config` | 0 (none in live) | Not a completeness check |

### NOT CLONED — these are what the completeness checks actually gate on

| Table | Shadow state | What it drives | Effect |
|---|---|---|---|
| `tenant_org_config` | **MISSING** | `org_complete = False` | **Root cause: cascade-locks ALL downstream sections** |
| `tenant_modules` | **0 active rows** | `modules_complete = False` | Module activation shows "not started" |
| `tenant_tax_config` | **MISSING** | `tax_complete = False` | Tax shows "not started" (locked by org) |
| `approval_matrix` | **0 rows** | `workflows_complete = False` | Workflows locked (downstream of org) |
| `tenant_expense_config` | **MISSING** | `module_setup_complete = False` | Module setup "not started" (locked by org+CoA) |

---

## Simulated progress result for cloned shadow

```
Organisation:          status=not_started  complete=False   ← no org_config row
Module activation:     status=not_started  complete=False   ← no tenant_modules rows
Dimensions:            status=LOCKED       complete=True  (dim_count=6)
Chart of accounts:     status=LOCKED       complete=True  (coa_count=595)
Employees:             status=LOCKED       complete=False
Tax & statutory:       status=LOCKED       complete=False
Roles & permissions:   status=LOCKED       complete=False
Approval workflows:    status=LOCKED       complete=False
Module setup:          status=not_started  complete=False

Sections complete: 0 / 12  →  0%
```

---

## Why the cards show "6 configured" / "595 loaded" but status is locked

The subtitle text is populated from row counts (which ARE correct from the clone):
```python
# Dimensions subtitle:
f"{dim_count} dimension(s) configured" if dims_complete else "Not configured"
# → "6 dimension(s) configured" because dim_count=6 → dims_complete=True

# CoA subtitle:
f"{coa_count:,} GL accounts loaded" if coa_complete else "..."
# → "595 GL accounts loaded" because coa_count=595 → coa_complete=True
```

But the STATUS is `"locked"` (not `"complete"`) because `dims_locked=True` and `coa_locked=True` — both caused by `org_complete=False`. The lock check runs before the complete check. So the setup dashboard correctly shows the data is there but the section is locked pending Organisation setup.

---

## Root cause

The Phase 4 clone engine (Step 1–9) copies **master data and configuration tables** (dimensions, CoA, dim values, GL requirements, account mappings, bank accounts, employees, cost centers, finance review config).

It does **not** clone the **setup completion gate tables**:

1. **`tenant_org_config`** — the single most important gap. Its absence sets `org_complete=False`, which cascade-locks Dimensions, CoA, Currencies, Tax, Employees, Roles, Workflows, and Module setup simultaneously. This is why the dashboard shows 0% even though 4,337 data rows were cloned.

2. **`tenant_modules`** — no module activation flags copied; "Module activation" shows not_started.

3. **`tenant_tax_config`** — tax rules not copied (though live Red Bull also has `has_config=False` for tax, so this section would be incomplete on the live tenant too).

4. **`approval_matrix`** — workflow matrix not copied.

5. **`tenant_expense_config`** — expense coding level config not copied.

---

## Live tenant context (for comparison)

The live Red Bull tenant itself also has some incomplete sections:
- `tenant_tax_config`: exists but `has_config=False` → tax_complete=False
- `user_tenants.role_tier='power_admin'`: 0 power admins → roles_complete=False
- `tenant_expense_config`: MISSING on live too → module_setup_complete=False

So even a perfect clone would not make all 12 sections complete — some sections were already incomplete on the live side.

---

## What needs to be added to the clone engine (not fixing now — diagnosis only)

To make the completeness checks recognize cloned data, the clone engine needs to also copy:

| Priority | Table | Why |
|---|---|---|
| **Critical** | `tenant_org_config` | Unlocks the cascade — fixes 8+ sections instantly |
| High | `tenant_modules` | Enables "Module activation" to show complete |
| Medium | `approval_matrix` | Enables "Approval workflows" |
| Low | `tenant_tax_config` | Only if live has tax configured (Red Bull doesn't currently) |
| Low | `tenant_expense_config` | Enables "Module setup" |

`tenant_org_config` is already handled by the Phase 2 promote engine (org_config section). The simplest fix for Phase 4 is to call the same copy logic for `tenant_org_config`, `tenant_modules`, and `approval_matrix` after the existing 9 clone steps. These tables have no FK dependencies on the cloned entities (they're singleton or simple tenant-scoped config), so they can be appended as Steps 10–12 without changing the existing order.
