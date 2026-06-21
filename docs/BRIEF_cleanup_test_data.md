Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Clean up 3a acceptance-test data from the live Red Bull tenant

**Context:** The 3a acceptance tests (BRIEF_expense_gl_3a.md) ran real HTTP/ASGI requests against the LIVE Red Bull tenant (`bd2c8a25-7467-494a-96fa-30f40b5b5d19`) instead of an isolated test tenant, creating 28 real expense_reports rows (EXP-2026-0001 through 0028) and 6 real journal_entries (JE-2027-000001 through 000006) as test pollution. Confirmed via docs/diagnosis_tenant_data.md. Delete all of it for a clean slate. Then (separate section below) establish a dedicated test tenant for future script/acceptance tests.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- Re-confirm the exact list of expense_reports rows for tenant bd2c8a25-... (report_number, id, status) — should be exactly the 28 from the diagnosis (EXP-2026-0001 to 0028). Report if the count differs from 28 (i.e. if more were created since the diagnosis).
- Re-confirm the exact list of journal_entries with source='expense' and source_reference matching one of those report_numbers for this tenant — should be the 6 (JE-2027-000001 to 000006). Report if it differs.
- Check for ANY other rows referencing these expense_reports or journal_entries that would need cascade cleanup: expense_lines (cascade via FK), expense_approvals (cascade via FK), expense_report_snapshots (cascade via FK), expense_documents (cascade via FK), journal_lines (cascade via FK on journal_entry_id), audit_log entries referencing these report_ids/report_numbers (will NOT cascade — report separately, do not delete audit log, just note it references deleted records).
- Confirm none of these 6 journal entries have been reversed/referenced elsewhere, and confirm deleting them won't violate any FK from another table (e.g. nothing else points TO these journal_entries).
Report the exact final row counts/ids before deleting anything.

---

## Cleanup
1. Delete the 6 journal_entries for this tenant with source='expense' and source_reference in the 28 report_numbers (cascade deletes their journal_lines via ondelete=CASCADE — confirm this in the model before relying on it; if not CASCADE, delete journal_lines explicitly first).
2. Delete the 28 expense_reports for this tenant (report_number EXP-2026-0001 through 0028) — confirm expense_lines, expense_approvals, expense_report_snapshots, expense_documents cascade-delete via their FK ondelete settings (report earlier). If any do NOT cascade, delete explicitly in the right order first.
3. Do NOT touch: any other tenant's data, the posting_roles catalogue, account mappings, bank accounts, GL accounts, dimensions, period state, OR any expense report numbered outside 0001–0028 that may have been created since (re-verify count in STEP 0 — if there are now MORE than 28, list the extras and ask before deleting them, don't assume they're also test data).
4. Leave the audit_log entries as-is (historical record of what happened) — note in the summary that they'll reference now-deleted report_ids, which is acceptable for an audit trail.
5. After cleanup, the report_number sequence: confirm whether new expense reports will start again at EXP-2026-0001 (if numbering is derived from a COUNT/MAX query) or continue from 0029 (if from a separate sequence). State which, and whether that's a problem (a gap or a restart). No need to fix the sequence — just report the behavior.

---

## Establish a dedicated TEST TENANT for future script/acceptance tests (standing infrastructure)
Going forward, ALL acceptance/script tests that perform real writes must run against a dedicated test tenant, never live Red Bull.
- Create (or confirm if one already exists from earlier "open period" testing — the GL re-test session mentioned testing via Jan 2027 against the real tenant too, so check if a separate test tenant already exists anywhere) ONE reusable test tenant (e.g. name "Ziva BI — Test Tenant", clearly marked, environment can stay whatever the schema supports, but name/slug must be unmistakably a test fixture).
- Document its tenant_id somewhere durable test scripts can reference (e.g. a constant in a shared test-utils file, or `docs/TEST_TENANT.md`) so future briefs/scripts use it instead of hardcoding or guessing Red Bull's id.
- This test tenant needs minimal setup to be useful for GL/expense tests going forward: state what minimal setup it has (or needs) — e.g. at least one mapped employee_payable role + one BS GL + an open period — note as a follow-up if not done now (don't over-build this in the same brief; just create the tenant + a short note of what it still needs).

---

## Files CC may modify
- None (this is data cleanup) — OR a new `docs/TEST_TENANT.md` noting the test tenant id, and any shared test-utils constant if trivial to add (state if added).

Do NOT: touch any model/router/migration code. Do NOT delete anything outside the exact verified scope. Do NOT touch other tenants.

---

## House rules
- STEP 0 counts must be re-verified (not assumed from the old diagnosis) before deleting.
- Only delete the confirmed 28 reports + 6 journals (+ cascades). If counts differ from the diagnosis, stop and report before deleting the unexpected extra rows.
- No code changes — pure data cleanup + (optionally) a new test tenant + a doc noting it.

---

## Acceptance / test steps (state pass/fail each)
1. Re-verified count before delete matches diagnosis (28 reports, 6 journals) — or differences reported and confirmed before proceeding.
2. After cleanup: 0 expense_reports for Red Bull tenant; 0 journal_entries with source='expense' for Red Bull tenant.
3. Cascades confirmed clean (0 orphaned expense_lines/approvals/snapshots/documents/journal_lines referencing the deleted parents).
4. Other tenants/data completely untouched.
5. Report_number sequence behavior after cleanup stated.
6. Test tenant created/confirmed + documented (or stated as already existing).

---

## Completion summary required
State: the re-verified counts before delete; exactly what was deleted; cascade confirmation; report_number sequence behavior post-cleanup; the test tenant's id + name + what minimal setup it has/needs; where it's documented. Report acceptance pass/fail.
