Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Account Determination Layer: posting-role catalogue + tenant mapping + validation

**Scope:** Backend only. Build the per-tenant "account determination" layer so modules post to a ROLE (e.g. "employee_payable") and the system resolves it to that tenant's actual GL account — works for any CoA (adopted default / uploaded / built). Includes: a system role catalogue, tenant role→GL mappings, validation (role↔account-type fit), and a resolver the posting flow uses. No UI in this brief (setup UI is next). No expense wiring yet.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/master_data.py` — ChartOfAccount: `account_type` ('PL'/'BS'), `account_classification` (String, drives modules), `gl_group`/`gl_subgroup`, is_active, tenant_id, gl_number, gl_name. **Report the ACTUAL distinct values of `account_classification` present in the DB** (run a query) so role-validation maps to real values — do NOT guess. Also report whether any normal-balance/asset/liability/equity/income/expense field exists; if only account_type + classification, validation uses those.
- `backend/app/models/setup.py` + `backend/app/routers/setup.py` — the setup router prefix, the admin guard (`_require_admin` / consultant / super-admin pattern), tenant scoping, how config tables are modelled + migrated.
- `backend/app/services/gl_posting.py` — where account resolution would plug in (the posting service validates gl_account_id; the determination layer is a SEPARATE resolver modules call to GET the gl_account_id before calling post_journal — confirm this separation).
- `backend/app/models/auth.py` — Tenant; how platform/system-level (non-tenant) reference data is stored if any (the role catalogue is system-level).
Report findings (esp. real account_classification values) before editing.

---

## Build

### A. System role catalogue (platform-level, seeded)
A catalogue of posting roles, system-defined (not per tenant), extensible. Model `PostingRole` (or seed data + a constant) — RECOMMEND a DB table `posting_roles` seeded via migration so it's queryable + extensible, each row:
- `role_key` (unique, e.g. "employee_payable") 
- `label` (e.g. "Employee Payable (control)")
- `group` (e.g. "control", "tax", "cash_bank", "fixed_assets", "inventory", "fx", "period_end", "suspense")
- `expected_account_type` ('BS' | 'PL' | null=either)
- `expected_nature` (optional finer hint mapped to account_classification values you found — e.g. "liability", "expense"; nullable if classification can't be reliably constrained)
- `is_control_account` (bool — e.g. employee_payable, AP, AR, IC are control accounts)
- `description`

Seed the full catalogue (extensible later):
- Control: employee_payable, accounts_payable, accounts_receivable, intercompany_payable, intercompany_receivable
- Tax: output_vat, input_vat, wht_payable, wht_receivable, paye_payable, statutory_deductions (pension/NHF/NSITF can be one or split — state choice)
- Cash/bank: default_bank, cash, bdc_clearing
- Fixed assets/CAPEX: asset_clearing_cwip, accumulated_depreciation, depreciation_expense, asset_disposal
- Inventory: inventory_control, grni, cogs
- FX: fx_unrealised_gain_loss, fx_realised_gain_loss
- Period-end: retained_earnings, current_year_earnings
- Suspense: general_suspense, rounding_difference

Set expected_account_type per role (e.g. depreciation_expense + cogs = 'PL'; the control/payable/bank/asset = 'BS'; fx gain/loss = 'PL'; retained/current-year earnings = 'BS'). Use your accounting judgment; state the mapping in the summary.

### B. Tenant mapping
Model `TenantAccountMapping` — `tenant_account_mappings`:
- id, tenant_id (FK, indexed), role_key (FK→posting_roles.role_key), gl_account_id (FK→chart_of_accounts.id), 
- unique (tenant_id, role_key) — one GL per role per tenant (single mapping for v1; per-expense-type / per-dimension overrides are FUTURE — note it).
- created_by, timestamps.
Migration additive + reversible.

### C. Endpoints (in setup router area, e.g. `backend/app/routers/account_mapping.py`, prefix `/api/setup/account-mapping`)
Guard: same admin/consultant/super-admin pattern as other setup config (state which).
1. `GET /api/setup/account-mapping/roles` — list the catalogue (optionally grouped) with each role's current tenant mapping (gl_account_id + gl_number/name if mapped, else null). This drives the future setup UI.
2. `PUT /api/setup/account-mapping/{role_key}` — body { gl_account_id }. Validates (see D) then upserts the tenant mapping.
3. `DELETE /api/setup/account-mapping/{role_key}` — remove a mapping.

### D. Validation (on PUT)
- gl_account_id must exist, be active, belong to this tenant → else 422.
- If the role has `expected_account_type`, the chosen GL's account_type must match → else 422 with a clear message ("Employee Payable must map to a Balance Sheet account").
- If `expected_nature` is set AND the CoA's account_classification reliably supports it, validate that too; if classification values are too freeform to validate safely, validate account_type only and note this. State what you did.

### E. Resolver service (`backend/app/services/account_determination.py`)
- `async def resolve_account(db, tenant_id, role_key) -> uuid.UUID` — returns the mapped gl_account_id, or raises a clear error `AccountMappingError(role_key)` ("Posting role 'employee_payable' is not mapped for this tenant. Configure it in Account Mapping.") if missing/inactive. This is what modules (expense in 3a) call BEFORE building journal lines. Posting is BLOCKED if a needed role is unmapped (per decision).
- Optional helper `resolve_many(db, tenant_id, role_keys)` returning a dict, raising if any missing (collect all missing in the message).

### F. No UI, no expense wiring
This brief is catalogue + mapping + validation + resolver. The setup UI and expense→GL (3a) are later briefs.

---

## Files CC may modify/create
- `backend/app/models/account_mapping.py` (NEW — PostingRole + TenantAccountMapping) — or place models near setup; state where.
- `backend/app/services/account_determination.py` (NEW — resolver + AccountMappingError)
- `backend/app/routers/account_mapping.py` (NEW) — register in main.py.
- `backend/app/schemas/account_mapping.py` (NEW)
- `backend/alembic/versions/<new>` (NEW — tables + seed the posting_roles catalogue)
- register models for metadata.

Do NOT: touch gl.py models, gl_posting.py, existing CoA/period logic, frontend, `config.py`/`ziva_dev`, CORS.

---

## House rules
- Migration up/down clean; seed catalogue in the migration (or a seed script — state which).
- Validation blocks bad mappings with clear 422s.
- Resolver raises a clear, actionable error when a role is unmapped.
- Real account_classification values used (from STEP 0), not guessed.

---

## Acceptance / test steps (state pass/fail each — via script)
1. Catalogue seeded — GET roles returns the full set, grouped, with expected_account_type.
2. PUT a valid mapping (e.g. employee_payable → a BS liability GL) succeeds; GET shows it mapped.
3. PUT employee_payable → a PL account → 422 (account-type mismatch).
4. PUT with another tenant's / inactive / nonexistent GL → 422.
5. resolve_account returns the gl_account_id for a mapped role.
6. resolve_account for an UNmapped role → AccountMappingError with a clear message.
7. Migration up/down clean.

---

## Completion summary required
List every file created/changed. State: where the role catalogue lives + how seeded; the full role→expected_account_type mapping you set; whether expected_nature/classification validation was feasible (and what you validated); the guard used on endpoints; how resolve_account errors when unmapped; confirm single-mapping-per-role (overrides future); confirm migration clean; confirm no gl/posting/CoA logic touched. Report acceptance pass/fail for all 7.
