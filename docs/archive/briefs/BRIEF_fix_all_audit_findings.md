Read docs/ZIVA_BI_ROADMAP.md, docs/MASTER_CONTEXT.md, docs/TEST_TENANT.md, and docs/PROJECT_STATE.md first, then follow this brief.

# BRIEF — Fix All Audit Findings (#001–#008) Before Expense Walkthrough

## Context

A full codebase audit identified 9 findings. #009 (stale MASTER_CONTEXT paths) was already resolved. This brief fixes the remaining 8. All fixes must be complete before the expense submit → approve → GL walkthrough begins. This brief is fix-only — no new features, no scope creep.

---

## #001 — Critical: split-parent double-count blocks all split-line GL posting

**Evidence:** `_recalculate_total` in `expense_posting.py` includes both split-parent lines and their children when summing, so the pre-flight balance check always fails for any report with split lines. No split-line expense report can ever post to GL in the current code.

**Fix:** In `_recalculate_total`, exclude split-parent lines (lines where `is_split_parent=True` or equivalent flag) from the total — sum only leaf lines (non-parent lines). The parent exists only as a UI grouping container; the children carry the actual amounts. Confirm the pre-flight check passes for a split-line report after the fix.

---

## #002 — High: block_if_readonly_impersonation missing from ~36 write endpoints

**Evidence:** `block_if_readonly_impersonation()` is only called in 4 of ~40 write endpoints. Support-mode / read-only impersonation can currently write to a live tenant on any unguarded endpoint — accidental or malicious writes with no audit attribution.

**Fix:** 
- Audit every write endpoint (POST/PUT/PATCH/DELETE) across all routers. Any that modifies data and does not already call `block_if_readonly_impersonation()` must have it added.
- Report exactly how many endpoints were missing the guard and how many now have it.
- Do NOT add it to genuinely read-only endpoints (GET) — only write paths.

---

## #003 — High: _write_snapshot omits all M9 fields — audit trail structurally incomplete

**Evidence:** `_write_snapshot` (the function that writes the immutable submission snapshot for an expense report) does not capture M9 fields: `gl_account_id`, `dimension_values`, split flags. The immutable snapshot is supposed to be the legal record of what was submitted for audit purposes — missing GL coding and dimensions makes it structurally incomplete and legally unreliable.

**Fix:** Update `_write_snapshot` to capture all M9 report fields at snapshot time, including: `gl_account_id` per line, `dimension_values` per line, `is_split_parent`, `split_parent_id`, and any other M9-era fields on expense lines not currently in the snapshot. The snapshot must be a complete, self-contained record of the report as submitted — if the GL mapping or dimensions change later (e.g. account is remapped/retired), the snapshot still shows what was coded at submission time.

---

## #004 — Critical: Alembic tracking 18 migrations behind head

**Evidence:** `alembic_version` is currently `i5j6k7l8m9n0`; head is `z6a7b8c9d0e1`. All 52 tables exist in the actual DB schema (applied outside Alembic tracking), but `alembic upgrade head` would fail on any environment because the tracking is wrong. First real deployment will fail immediately.

**Fix:**
- Confirm all 52 tables genuinely exist in `ziva_dev` right now (query `information_schema.tables` — report the count).
- Run `alembic stamp z6a7b8c9d0e1` to bring the tracking in line with the actual schema.
- Confirm `alembic current` now reports the correct head.
- Confirm `alembic upgrade head` reports "Already at head" with no pending migrations.
- This must be a careful, verified step — do NOT run `alembic upgrade head` before stamping; run stamp first, then verify.

---

## #005 — Medium: COUNT-based report number sequence allows race-condition duplicates

**Evidence:** Report numbers are generated using a COUNT of existing reports for the tenant, creating duplicates under concurrent submissions. A GL collision on duplicate report numbers causes a 500 on the approver's final approval.

**Fix:** Replace COUNT-based sequence with a proper sequence mechanism — either a PostgreSQL `SEQUENCE` per tenant (most correct) or a `SELECT ... FOR UPDATE` lock on a sequence counter table. Whichever approach matches the existing pattern in the codebase (check if any other entity already uses a sequence — if so, match it; if not, use `SELECT max(sequence_number) FROM expense_reports WHERE tenant_id = ? FOR UPDATE` as the minimal safe fix). Report the chosen approach.

---

## #006 — Medium: GL posting uses report_date as entry date — closed-period dates cause unrecoverable 422

**Evidence:** `expense_posting.py` uses `report.report_date` as the journal entry date. If the report's date falls in a closed or soft-closed period, final approval fails with an unrecoverable 422 — the submitter cannot fix it because the report is already submitted and the date field is locked. This is a silent trap.

**Fix:** Two parts:
1. At **submission time** (not approval time), validate that `report_date` falls in an open period. Reject submission with a clear, actionable error if it doesn't (e.g. "Report date 15 Jan 2026 falls in a closed period. Please update the date before submitting."). This gives the submitter a chance to fix it before the report is locked.
2. At **GL posting time** (approval), keep the period check as a final guard, but return a clear error that explains what happened and what the reviewer can do (e.g. "Cannot post: report date is in a closed period. A consultant can reopen the period or the report must be recalled and corrected."). The 422 is acceptable as a last-line defense; the unrecoverable part is unacceptable — there must be a path forward explained in the error.

---

## #007 — Low: debug print() statements expose sensitive data in server stdout

**Evidence:** `config.py` (3 places) and `hr.py` (2 places) contain `print()` statements. At least one in `hr.py` exposes invite URLs and employee email addresses in server stdout — a data leak in production environments where stdout is logged.

**Fix:** Remove all debug `print()` statements from production code paths. Replace with `logger.info()` / `logger.debug()` calls where the information is genuinely useful for debugging, using the existing logger already in scope in these files. For sensitive data (invite URLs, email addresses), use `logger.debug()` only (not `logger.info()`), so they're suppressible in production by setting the log level appropriately.

---

## #008 — Low: POST /api/tenant/purge-test-data returns 200 OK for a no-op stub

**Evidence:** The endpoint exists, accepts requests, and returns HTTP 200 OK — but does nothing. Any caller (script, admin, future test harness) that calls this expecting data to be purged will silently get no purge while believing it succeeded.

**Fix:** Two options — pick the one that matches the project's current approach:
- If this endpoint is not yet ready to be implemented: change the response to HTTP 501 Not Implemented with a clear message ("This endpoint is not yet implemented. Test data must be purged manually."). A lying 200 is worse than an honest 501.
- If you can implement it safely now (it should hard-delete test-shadow-only data for the current tenant, gated by `environment='test'` to prevent accidental live-tenant purge): implement it. Guard strictly: reject if `tenant.environment != 'test'`. Report which path you took.

---

## Acceptance tests (state pass/fail for each)

1. **#001**: Create a test expense report WITH split lines on the shadow tenant. Submit and approve it. Confirm GL posting succeeds (no pre-flight balance failure). Confirm a non-split report also still posts correctly (no regression).
2. **#002**: Every write endpoint (POST/PUT/PATCH/DELETE) now calls `block_if_readonly_impersonation()`. Report count of endpoints that previously lacked it and now have it. Confirm a read-only impersonation attempt to a write endpoint returns the correct rejection.
3. **#003**: Submit a test M9 expense report (with GL coding and dimensions). Confirm the snapshot in the DB contains `gl_account_id`, `dimension_values`, split flags per line — verified by direct DB query, not by describing the code.
4. **#004**: `alembic current` = head (`z6a7b8c9d0e1`). `alembic upgrade head` = "Already at head." All 52 tables confirmed present. No data was lost.
5. **#005**: Concurrent report submission no longer risks duplicates — confirm the sequence mechanism is safe under concurrency (describe the mechanism and why it's race-safe).
6. **#006**: Submitting a report with a date in a closed period (e.g. March 2026) is rejected at submission time with a clear, actionable error. Submitting with a June 2026 date succeeds.
7. **#007**: No `print()` statements remain in `config.py` or `hr.py` (or anywhere in production code paths). Grep confirms this.
8. **#008**: `POST /api/tenant/purge-test-data` no longer returns 200 OK silently. Either returns 501 with a clear message, or is genuinely implemented with the `environment='test'` guard.
9. All tests on shadow `e8a2fd8c-5466-4618-bb37-97681a8bfb05` only (read from `docs/TEST_TENANT.md` fresh). Never live Red Bull.
10. All changes committed, pushed, commit hash reported.
11. `docs/PROJECT_STATE.md` Known Issues Register updated: #001–#008 removed (resolved), #009 already removed. Register should be empty or contain only genuinely new findings discovered during this brief.

## Files CC is allowed to modify

- `backend/app/routers/` — all router files (for #002 guard additions, #008 purge endpoint)
- `backend/app/services/expense_posting.py` — for #001 and #006
- `backend/app/services/` — snapshot service for #003, sequence fix for #005
- `backend/app/core/config.py` — for #007 print removal
- `backend/app/routers/hr.py` — for #007 print removal
- New Alembic migration if #005's sequence fix requires a new table/sequence object — flag if so
- `docs/PROJECT_STATE.md` — update Known Issues Register

## Do NOT touch
- Org structure, cost-center, CoA, employee bulk upload, clone engine — already correct, do not refactor
- Any frontend file unless a fix genuinely requires a frontend change (flag and justify before touching)
- Live Red Bull tenant

## Completion summary must include
- Pass/fail for every acceptance test
- Count of write endpoints that received the `block_if_readonly_impersonation` guard (#002)
- Which approach was taken for #005 (sequence mechanism chosen) and #008 (501 vs implemented)
- DB query result confirming 52 tables and alembic at head (#004)
- Confirmation PROJECT_STATE.md Known Issues Register is clean (or lists any NEW findings discovered during this brief)
- Commit hash
