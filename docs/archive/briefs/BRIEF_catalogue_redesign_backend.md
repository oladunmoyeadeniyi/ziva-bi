Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Posting-role catalogue redesign: statement taxonomy + per-tenant control override (backend)

**Scope:** Backend only. Restructure the posting-role catalogue into a 2-level financial-statement taxonomy (statement → sub-group → role), let Super Admin override control-account status per tenant, remove FX + per-class Fixed-Asset roles (handled in their own module configs), add missing roles, and reseed. UI rework is the NEXT brief. No expense wiring yet.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/account_mapping.py` — current PostingRole (role_key PK, label, group, expected_account_type, expected_nature, is_control_account, description) + TenantAccountMapping.
- The seed migration `backend/alembic/versions/b8c9d0e1f2g3_account_determination.py` — how roles were seeded (so the reseed/migration follows the same approach).
- `backend/app/routers/account_mapping.py` — GET /roles response (must now expose the taxonomy + effective control flag) + PUT/DELETE.
- `backend/app/services/account_determination.py` — resolver (unaffected by taxonomy, but confirm it only needs role_key).
- Confirm any module code references the FX/FA role_keys being removed (search fx_unrealised_gain_loss, fx_realised_gain_loss, accumulated_depreciation, depreciation_expense, asset_clearing_cwip, asset_disposal). If referenced anywhere, report it (we must not break a caller). Expense isn't wired yet so likely none.
Report findings before editing.

---

## Build

### A. PostingRole taxonomy fields
Extend PostingRole:
- `statement` (String) — 'PL' or 'BS' (the financial statement the role belongs to).
- `group` (KEEP/repurpose as the sub-category, e.g. 'current_assets', 'current_liabilities', 'revenue', 'cost_of_sales', 'taxes', etc.) — the statement-level grouping.
- `subgroup` (String, nullable) — finer collapsible sub-grouping (e.g. 'inventory', 'prepayments', 'accruals_provisions', 'ppe', 'intangibles', 'capex', 'receivables', 'payables', 'cash_bank', 'tax', 'equity', 'suspense'). 
- `display_order` (Integer) — to order roles within a subgroup sensibly.
- KEEP: role_key, label, expected_account_type, expected_nature, is_control_account (this becomes the CATALOGUE DEFAULT), description.

So the hierarchy for the UI is: statement (PL/BS) → group → subgroup → roles.

### B. Per-tenant control-account override
Add to TenantAccountMapping (or a small separate per-tenant role-settings table — choose; state choice):
- `is_control_account_override` (Boolean, nullable) — when NULL, use the catalogue default (PostingRole.is_control_account); when set, it overrides for that tenant.
- The GET /roles response should return the EFFECTIVE control flag (override if set, else catalogue default) plus the catalogue default, so the UI can show + toggle it.
- NOTE: a mapping row may not exist yet for an unmapped role, but the Super Admin may still want to toggle control status. RECOMMEND a separate tiny table `tenant_posting_role_settings` (tenant_id, role_key, is_control_account_override) so control-toggle is independent of whether a GL is mapped. State your choice + why.

### C. Endpoint additions
- GET /api/setup/account-mapping/roles — return roles with: statement, group, subgroup, display_order, label, expected_account_type, is_control_account (catalogue default), is_control_account_effective (after override), description, and current mapping (gl_account_id/number/name if mapped). Group/order so the UI can render nested collapsible sections.
- New: `PUT /api/setup/account-mapping/{role_key}/control` body { is_control_account: bool | null } — set/clear the per-tenant control override (super-admin/consultant only — state guard; this is a Super-Admin-level capability per decision, so gate to is_super_admin/impersonating, NOT plain power_admin, unless you justify otherwise).
- PUT/DELETE mapping endpoints unchanged.

### D. Reseed the catalogue (migration)
Replace the role set. Final catalogue:

REMOVE: fx_unrealised_gain_loss, fx_realised_gain_loss, accumulated_depreciation, depreciation_expense, asset_clearing_cwip, asset_disposal. (Handle the migration safely — if any tenant_account_mappings rows reference these, delete those mapping rows in the migration too, and report. Likely none exist yet.)

ADD: intercompany_loan, accruals, prepayments, provisions.
CHANGE: grni → is_control_account = true.

Assign every remaining + new role a statement / group / subgroup / display_order / expected_account_type / is_control_account default. Suggested taxonomy (use accounting judgment; state final mapping):
- **BS · Current Assets:** cash (cash_bank), default_bank (cash_bank), accounts_receivable [control] (receivables), intercompany_receivable [control] (receivables), inventory_control [control] (inventory), grni [control] (inventory or clearing), prepayments (prepayments), input_vat (tax), wht_receivable (tax), bdc_clearing (suspense/clearing).
- **BS · Current Liabilities:** accounts_payable [control] (payables), intercompany_payable [control] (payables), employee_payable [control] (payables), accruals (accruals_provisions), provisions (accruals_provisions), output_vat (tax), wht_payable (tax), paye_payable (tax), statutory_deductions (tax).
- **BS · Non-Current Liabilities:** intercompany_loan [control] (loans).
- **BS · Equity:** retained_earnings (equity), current_year_earnings (equity).
- **BS · Suspense/Clearing:** general_suspense, rounding_difference. (Group these under a clearing subgroup; statement BS.)
- **PL:** cogs (Cost of Sales). (Most other PL roles like depreciation moved out with FA; keep the catalogue lean — add PL roles as modules need them.)

(If a role doesn't cleanly fit, place it sensibly and note it. The point: statement→group→subgroup must be coherent.)

Migration additive/reversible where possible; the reseed replaces catalogue rows (downgrade restores prior seed — or state that downgrade reverts to the previous catalogue).

---

## Files CC may modify/create
- `backend/app/models/account_mapping.py` — taxonomy fields + (chosen) control-override storage.
- `backend/alembic/versions/<new>` — schema changes + reseed.
- `backend/app/routers/account_mapping.py` — GET response shape + new control endpoint.
- `backend/app/schemas/account_mapping.py` — updated response/request models.
- `backend/app/services/account_determination.py` — only if it references removed roles (shouldn't).

Do NOT: touch gl/posting/CoA/period logic, the Currencies & FX config (FX stays there), the frontend (UI rework is next brief), `config.py`/`ziva_dev`, CORS.

---

## House rules
- Migration up/down clean; reseed atomic.
- Removed roles: their mapping rows cleaned up safely; report if any existed.
- resolve_account still works for remaining roles.
- Control-override gated to Super Admin level; default still from catalogue.

---

## Acceptance / test steps (state pass/fail each — via script)
1. GET /roles returns roles with statement/group/subgroup/display_order; FX + per-class FA roles GONE; intercompany_loan/accruals/prepayments/provisions PRESENT; grni is_control_account true.
2. Roles are coherently grouped (no orphan/uncategorised role).
3. PUT /{role_key}/control sets a per-tenant override; GET shows is_control_account_effective reflecting it; clearing (null) reverts to catalogue default.
4. resolve_account still resolves a mapped role; unmapped still errors.
5. No stray mappings to removed roles remain.
6. Migration up/down clean.

---

## Completion summary required
List every file changed. State: whether any module referenced the removed FX/FA roles; the final statement/group/subgroup/expected_account_type/control-default mapping for ALL roles; where the per-tenant control override is stored + why; the guard on the control endpoint; whether removed-role mappings existed + how cleaned; confirm migration clean; confirm FX/FA configs + frontend untouched. Report acceptance pass/fail.
