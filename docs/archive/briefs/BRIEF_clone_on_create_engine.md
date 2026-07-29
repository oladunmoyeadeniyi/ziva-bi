Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Phase 4: Clone-on-create engine for test environments (backend)

**Context:** `create_test_environment` currently mirrors only `UserTenant` rows — new test shadows start with zero config even when live has real data (confirmed: Red Bull live has 595 CoA accounts, 6 dimensions, etc.; its test shadow had 0/12 setup sections). Per docs/diagnosis_clone_schema.md, build a clone engine that copies live's current configuration into a NEW test shadow at creation time. One-directional (live→test), one-time (at creation only — this is NOT the repeatable diff/promote from Phase 3a, which still handles test→live afterward), no merge/diff needed since test starts empty.

**Default behavior:** clone ON by default; the caller can pass `clone_data=False` to create an empty shadow instead (UI toggle comes in a follow-up brief — this brief accepts the parameter and implements both paths).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/routers/tenant.py` — the full `create_test_environment` function as it exists today (the UserTenant mirroring logic, response shape, guards). This is what you're extending.
- `backend/app/services/promotion_engine.py` (Phase 3a) — the natural-key matching helpers, id-map pattern, and the 5-entity logic (TenantDimension, ChartOfAccount, DimensionValue 2-pass, GLDimensionRequirement, TenantAccountMapping) you'll REUSE (adapted for one-directional clone rather than diff/apply — confirm whether the existing functions can be called in a "no diff, just create everything" mode, or whether dedicated clone functions are cleaner — your call, state which and why).
- `backend/app/models/bank_account.py`, `backend/app/models/master_data.py` (Employee, CostCenterConfig), and locate `FinanceReviewConfig` — re-confirm exact columns against docs/diagnosis_clone_schema.md (re-verify, don't just trust the old report).
- Confirm where outbound email-sending logic currently lives (if any exists yet — search for any email/notification service). Report whether real email-sending is implemented at all today; if not, the "suppress emails in test" requirement may be a no-op for now (state clearly — don't build suppression logic for a sending mechanism that doesn't exist yet, just note it as a flag/field ready for when it does).
Report findings before editing.

---

## Build

### Clone engine (extend `promotion_engine.py` or new `backend/app/services/tenant_clone.py` — state choice)

`clone_tenant_data(db, live_tenant_id, test_tenant_id) -> CloneResult`, called from inside `create_test_environment` AFTER the existing UserTenant mirroring (Step 0 is already done — this runs as Steps 1-9).

Implement in this exact order (per the confirmed dependency chain):
1. **TenantDimension** → clone all active live rows into test (natural key: `code`; skip if a test row with that code already exists — shouldn't happen on fresh creation, but be defensive).
2. **ChartOfAccount** → clone all active live rows (natural key: `gl_number`).
3. **DimensionValue** — two-pass: Pass 1 insert all active live rows with `cascade_value_id=NULL` (remap `dimension_id` via the Step-1 id-map); Pass 2 back-fill `cascade_value_id` using the now-complete dimval id-map (built keyed by `(dim_code, val_code)`).
4. **GLDimensionRequirement** → clone using Step 2 (gl) + Step 1 (dimension) id-maps.
5. **TenantAccountMapping** → clone using Step 2 (gl) id-map (natural key: `role_key`).
6. **BankAccount** → clone all active live rows; remap `gl_account_id` via Step 2's id-map; set `created_by=NULL`.
7. **Employee** — two-pass: Pass 1 insert all active live rows with `line_manager_id=NULL` (remap `cost_center_id` via Step 3's dimval id-map); build an employee id-map keyed by `email`. Pass 2 back-fill `line_manager_id` using that id-map.
8. **CostCenterConfig** → clone using Step 3 (cost_center_id) + Step 7 (head_employee_id) id-maps; copy `head_user_id` VERBATIM (no remap — global users table, already mirrored).
9. **FinanceReviewConfig** → clone using Step 3 (cost_center_id) id-map; copy `reviewer_user_id` VERBATIM (global, no remap).

Each step only clones rows where `is_active=True` (or the equivalent active flag) on the live side. Use a single tenant-scoped id-map object carrying all sub-maps (dim, coa, dimval, employee) built incrementally across steps, same pattern as Phase 3a's `_IdMap`.

**Explicitly EXCLUDED:** EmployeeCodeHistory, EmployeeTransfer (operational history, never cloned), any expense/journal/transactional data (never cloned — config/master-data only, per the standing project principle).

### Wire into `create_test_environment`
Add a `clone_data: bool = True` parameter (request body field) to the endpoint. If `True` (default), call `clone_tenant_data` after the existing UserTenant mirroring, inside the same transaction (all-or-nothing — if the clone fails partway, the entire test-environment creation rolls back, including the UserTenant mirroring). If `False`, skip cloning — existing empty-shadow behavior.

Update the Phase 2 platform proxy endpoint (`POST /api/platform/tenants/{id}/test-environment`) to accept/pass through the same `clone_data` parameter (default True).

### Email suppression flag
Per STEP 0 findings: if no real email-sending exists yet, just add a `suppress_outbound_email: bool` field to the Tenant model (default True, only meaningful for `environment="test"` tenants) as schema-readiness — do NOT build suppression logic for a non-existent sender. If email-sending DOES already exist somewhere, report it and flag (don't wire suppression into it in this brief — that's a separate scoped change once you report what exists).

---

## Files CC may modify
- `backend/app/routers/tenant.py` — `create_test_environment`, add `clone_data` param + call the clone engine.
- `backend/app/routers/platform.py` — pass-through `clone_data` param on the proxy endpoint.
- NEW or extended service file for the clone engine (state which).
- `backend/app/models/tenant.py` (or wherever Tenant model lives) — add `suppress_outbound_email` column (migration required this time — new column).
- New migration for the `suppress_outbound_email` column only.

Do NOT: touch Phase 3a's diff/apply logic (reuse helpers, don't modify behavior), expense/GL/transactional logic, EmployeeCodeHistory/EmployeeTransfer tables, Phase 3b UI. The UI toggle for clone_data and the email-toggle UI are a FOLLOW-UP brief — not in scope here (backend-ready only).

---

## House rules
- All-or-nothing: clone failure rolls back the entire test-environment creation.
- Only active live rows cloned; two-pass for DimensionValue.cascade_value_id AND Employee.line_manager_id.
- head_user_id / reviewer_user_id copied verbatim (no remap).
- created_by set NULL on cloned BankAccount rows.
- No transactional/historical data ever cloned.
- Migration only for the new suppress_outbound_email column.

---

## Acceptance / test steps (state pass/fail each — use the dedicated Ziva BI Test Tenant or a disposable test scenario, NOT live Red Bull, per the standing test-isolation rule)
1. Create a test environment with clone_data=True (default) on a tenant with real CoA/dimensions/employees/cost centers/bank accounts → test shadow ends up with matching active rows across all 9 steps.
2. DimensionValue cascade_value_id correctly wired in test (2-pass verified, no FK violation).
3. Employee line_manager_id correctly wired in test (2-pass verified).
4. CostCenterConfig.head_user_id in test matches live's value exactly (no remap, verified).
5. BankAccount.gl_account_id in test points to the TEST tenant's corresponding CoA row (remapped correctly, not the live id).
6. clone_data=False → test shadow created empty (existing behavior preserved, regression check).
7. Inactive live rows (e.g. a deactivated CoA account) are NOT cloned.
8. Clone failure simulated mid-way → entire test-environment creation rolls back (no orphaned shadow, no partial UserTenant mirroring left behind).
9. EmployeeCodeHistory/EmployeeTransfer NOT cloned (confirm test tenant has zero rows in these tables).
10. Migration clean; backend imports clean.

---

## Completion summary required
List every file created/changed. State: where the clone engine lives and whether it reuses or duplicates 3a's matching helpers (and why); the exact id-map structure across all steps; confirmation of both two-pass entities; confirmation head_user_id/reviewer_user_id verbatim copy; confirmation of all-or-nothing rollback; the suppress_outbound_email finding (does real email-sending exist yet) and what was added; confirm EmployeeCodeHistory/EmployeeTransfer excluded. Report acceptance pass/fail with real counts from a test run (e.g. "595 CoA rows cloned, verified active-only").
