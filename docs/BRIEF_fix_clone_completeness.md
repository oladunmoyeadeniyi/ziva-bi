Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Fix: clone engine must also copy setup-completion gate tables (Steps 10-12)

**Root cause (confirmed via docs/diagnosis_clone_completeness.md):** Phase 4's clone engine (tenant_clone.py, Steps 1-9) copies master-data tables correctly (verified: 6 dimensions, 595 CoA, 147 dim values, 3570 GL requirements, 17 account mappings, 2 bank accounts all present in the cloned shadow). But it does NOT copy `tenant_org_config`, `tenant_modules`, or `approval_matrix` — and the Setup dashboard's completion logic checks these FIRST as cascade-gates (org_complete=False locks Dimensions/CoA/Currencies/Tax/Employees/Roles/Workflows/Module-setup regardless of whether their underlying data exists). Result: a fully-cloned shadow shows "0 of 12 sections complete — 0%" even though 4,337 real rows were cloned. Fix: extend the clone engine with 3 more steps.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/services/tenant_clone.py` — the existing 9-step clone engine, especially the `_CloneIdMap` structure and how each step is sequenced, so the new steps follow the same pattern.
- `backend/app/routers/tenant.py` — the existing `promote()` function's `tenant_org_config` copy logic (Phase 2) — this should be REUSED (called or factored into a shared helper), not rewritten, per the diagnosis's recommendation. Report exactly what fields it copies.
- `backend/app/models/setup.py` (or wherever `TenantModule`/`tenant_modules` and `ApprovalMatrix`/`approval_matrix` live) — full column lists for both. Confirm `ApprovalMatrix` is the same model documented earlier (`level1_role`, `level2_role`, `level3_role`, `amount_threshold_l2/l3` — no FK to other promoted entities, confirm this is still true).
- `backend/app/models/setup.py` — `TenantModule` (or equivalent "module activation" table): columns, whether `module_key`/`is_active` is all there is, any FK dependency on anything else.
- Confirm none of these 3 new tables have FK dependencies on the 9 already-cloned entities (the diagnosis states they don't — re-verify).
Report findings before editing.

---

## Fix

### Add Steps 10-12 to `clone_tenant_data` in `tenant_clone.py`, after the existing Step 9:

**Step 10 — `tenant_org_config`:** Copy live's org_config row into the test tenant (new row, test tenant_id). Reuse the field-copying logic from Phase 2's `promote()` org_config section if it can be called/imported directly; otherwise factor the field list into a small shared helper both can call (your call which is cleaner — state choice). This single step is the most important — it unlocks the cascade for Dimensions/CoA/Currencies/Tax/Employees/Roles/Workflows/Module-setup sections (their data already exists from Steps 1-9; this step makes them VISIBLE as complete).

**Step 11 — `tenant_modules`:** Copy all `is_active=True` rows from live to test (new rows, test tenant_id, same module_key/is_active values).

**Step 12 — `approval_matrix`:** Copy live's approval_matrix row (if one exists — it's one-per-tenant) into test (new row, test tenant_id, same levels/role labels/thresholds). If live has no approval_matrix row, skip silently (nothing to clone — note this in the result, don't error).

None of these 3 steps need the `_CloneIdMap` (no FK remapping required — they're either singleton config or independent rows with no references to the other cloned entities, confirm this holds during STEP 0).

### Update CloneResult / response
Include counts for these 3 new steps in whatever summary structure `clone_tenant_data` already returns (the diagnosis mentions a result with per-table counts — extend it, don't replace it).

---

## Files CC may modify
- `backend/app/services/tenant_clone.py` — add Steps 10-12.
- `backend/app/routers/tenant.py` — ONLY if factoring out a shared org_config-copy helper that both `promote()` and the clone engine call (state if done, and confirm `promote()`'s existing behavior is unchanged).

Do NOT: touch Steps 1-9, Phase 3a's promotion_engine.py, the Setup dashboard's completion-check logic itself (that logic is correct — the fix is making the clone produce the data it expects, not changing what it expects). No migration (no schema change).

---

## House rules
- Steps 10-12 run inside the same all-or-nothing transaction as Steps 1-9 (clone failure still rolls back everything).
- Reuse Phase 2's org_config copy logic rather than duplicating field lists.
- Skip approval_matrix silently if live has none (don't error the whole clone over an optional table).
- No change to existing Steps 1-9 behavior.

---

## Acceptance / test steps (state pass/fail each)
1. Create a fresh test shadow for Red Bull (clone_data=True) → tenant_org_config row now exists in test, matching live's functional_currency/legal_name/etc.
2. tenant_modules rows cloned (count matches live's active count).
3. approval_matrix cloned if live has one (Red Bull may or may not — report which).
4. Setup dashboard for the new shadow: Organisation shows COMPLETE (not "Not configured"); Dimensions and Chart of Accounts show COMPLETE (not locked) — re-run the actual progress check and report the new section count (e.g. "X of 12 complete" — should be higher than 0, exact number depends on what live Red Bull itself has complete, per the diagnosis's note that live isn't 12/12 either).
5. Steps 1-9 unaffected (re-verify row counts still match: 595 CoA, 6 dims, etc.).
6. clone_data=False still produces a fully empty shadow (regression check — Steps 10-12 also skipped in this path).
7. Backend imports clean; no migration.

---

## Completion summary required
List every file changed. State: whether org_config copy logic was reused/shared or duplicated (and why); the new step count results from a real test run; the new "X of 12 sections complete" number for a freshly cloned shadow with an explanation of which sections remain incomplete and why (tying back to what's incomplete on live itself, per the diagnosis); confirm Steps 1-9 unaffected; confirm clone_data=False path unaffected. Report acceptance pass/fail.
