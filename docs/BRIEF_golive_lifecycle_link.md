Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Phase 1: Link go-live to lifecycle_status

**Problem (confirmed via docs/diagnosis_tenant_lifecycle.md):** `POST /api/setup/go-live` sets `tenant.is_active = True` but never updates `lifecycle_status`. These are two unlinked actions — after a tenant "goes live" via the UI button, `lifecycle_status` stays at `"trial"`/`"in_implementation"`, so the Super Admin "enter tenant" mode logic still treats it as in-implementation (full edit access) rather than live (read-only/support mode). Fix: going live must also transition `lifecycle_status` to `"live"`.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/routers/setup.py` — the full `mark_go_live` function (~line 2994): every check it does (blocking sections, is_super_admin guard), and exactly where `tenant.is_active = True` is set.
- `backend/app/routers/platform.py` — `_VALID_LIFECYCLE` frozenset, and the `PATCH /api/platform/tenants/{id}/lifecycle` endpoint (the existing manual transition) — confirm its exact logic so go-live can reuse the same transition path/audit logging pattern rather than duplicating it.
- `backend/app/routers/platform.py` — `enter_tenant` mode-determination logic (the lifecycle → mode matrix) to confirm what changes in behavior once lifecycle becomes "live" (Super Admin entry becomes read-only/support by default, full edit only via explicit test-environment request).
- `frontend/src/app/dashboard/business/setup/go-live/page.tsx` — the current UI flow and what it tells the user after go-live succeeds.
- Confirm whether any audit log event already exists for lifecycle transitions (e.g. "platform.lifecycle.updated") so the go-live transition logs consistently with the manual one.
Report findings before editing.

---

## Fix

### Backend: `mark_go_live` (setup.py)
After the existing blocking-sections check passes and `tenant.is_active = True` is set, ALSO set `tenant.lifecycle_status = "live"` in the same transaction/commit. Use the same audit-logging pattern as the manual lifecycle PATCH endpoint (consistent event name/metadata) so both paths produce a coherent audit trail — e.g. log something like `"platform.lifecycle.updated"` (or a distinct `"tenant.go_live"` event if that's clearer — your call, state which and why) with old_status/new_status and a note that it was triggered via go-live rather than manual override.

Do NOT touch the existing blocking-sections validation logic — only add the lifecycle_status update + audit log call after the existing checks pass.

### Confirm downstream effect
After this fix, once a tenant goes live:
- Super Admin entering the tenant should now get `mode="support"` (read-only) by default, per the existing `enter_tenant` logic — confirm this happens correctly with a real test (no enter_tenant code changes needed if the logic already correctly branches on lifecycle_status — just verify).
- If the tenant has a test shadow, Super Admin can still request `environment="test"` to get full edit access there — confirm this still works post-go-live.

### Frontend (minor, only if needed)
If the go-live success message/UI currently implies "the tenant is now live" without it being functionally true, no copy change is needed once the backend fix lands (it'll now be true). Only touch the frontend if STEP 0 reveals something genuinely broken in the flow — state if no frontend change was needed.

---

## Files CC may modify
- `backend/app/routers/setup.py` — `mark_go_live` function only.
- Frontend — only if STEP 0 reveals a real issue; state if untouched.

Do NOT: touch the blocking-sections checklist logic, the PATCH lifecycle endpoint, enter_tenant mode logic, create-test-environment, promote, suspend/reactivate. No migration (no schema change, just an additional field update in existing logic).

---

## House rules
- One transaction: is_active=True AND lifecycle_status="live" set together, or neither (existing rollback-on-exception behavior applies).
- Audit log entry produced, consistent with the existing lifecycle-change pattern.
- No change to the blocking/checklist validation that already gates go-live.

---

## Acceptance / test steps (state pass/fail each)
1. On a tenant with all blocking sections complete, call go-live → tenant.is_active=True AND tenant.lifecycle_status="live" (both, verified in DB).
2. Audit log shows the transition with old_status/new_status.
3. After go-live, Super Admin "Enter tenant" on this tenant → mode="support" (read-only) by default (re-verify against enter_tenant logic — should already work, confirm with a real call).
4. If a test shadow exists for this tenant, Super Admin can still enter with environment="test" → mode="implementation" (full edit) — unaffected.
5. Blocking-sections-incomplete case still correctly blocks go-live (regression check — lifecycle_status untouched if blocked).
6. No migration created; backend imports clean.

---

## Completion summary required
List every file changed. State: exact placement of the lifecycle_status update; the audit event name/metadata used and why; confirmation of the downstream mode-switch behavior (with actual test result); confirmation the blocking-checklist logic is untouched; whether frontend needed any change. Report acceptance pass/fail.
