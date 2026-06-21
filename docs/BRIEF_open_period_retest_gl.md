Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Open a period + re-test GL engine end-to-end (POSTED data)

**Goal:** Get the test tenant into a state with at least one OPEN accounting period, then re-run the GL Brief 1 + Brief 2 acceptance scripts so POSTED posting + trial balance + ledger are verified against real posted data (previously they ran as DRAFT because the FY was statutory-closed).

**Important:** Use the PROPER reopen/open path — do NOT bypass sequential-closing, statutory locks, or the registration-date floor. We must not corrupt the period state built in M8.3.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report BEFORE acting:
- `backend/app/services/periods.py` — how a period's status is set; the reopen function/rules (statuses: OPEN → SOFT_CLOSED → HARD_CLOSED → statutory; reopen path + who can; audit trail).
- `backend/app/models/setup.py` — AccountingPeriod (statuses, fields, fiscal year).
- The current period state for the test tenant (Red Bull NG, tenant id bd2c8a25-7467-494a-96fa-30f40b5b5d19): list each period + status for the relevant FY. Report which are closed/statutory and why there's no OPEN period.
Report findings (current period statuses + the legitimate reopen mechanism) before acting.

---

## ACTION
1. Using the existing, legitimate reopen/open mechanism (consultant/super-admin reopen with audit trail — the same one M8.3 exposes), bring at least one period (ideally the current/most-recent FY's months, or at minimum one month containing a usable posting date) to **OPEN** status for the test tenant. Respect sequential rules — reopen in the correct order. Record the audit trail as the normal flow does.
   - Do NOT hack the status column directly if a proper service/endpoint exists — use it. Only fall back to a documented direct update if there is genuinely no reopen path, and state clearly if so.
2. Confirm there is now an OPEN period and identify a concrete OPEN posting date.

## RE-TEST
3. Re-run `backend/scripts/test_gl_posting.py` (Brief 1) — now test 1 (balanced POSTED entry), test 5 (required-dim POSTED), etc. should run as real POSTED entries, not DRAFT. Report the full pass/skip/fail table.
4. Re-run `backend/scripts/test_gl_reporting.py` (Brief 2) — now trial balance + ledger run against real POSTED entries: TB rows + grand totals balance (is_balanced true), ledger opening/running/closing correct, dimension filter, DRAFT-excluded. Report the full pass/skip/fail table.
5. If any test still skips, state exactly why (e.g. no active DimensionValue for a required dimension) and whether it's a data gap vs a code issue.
6. Clean up test journal entries created by the scripts if they persist (the scripts rollback by design — confirm no stray POSTED test entries are left in the tenant; if any were committed, remove them and say how).

---

## Files CC may modify
- None ideally beyond running scripts. If a small fix to a test script is needed to exercise the OPEN period (e.g. pick the OPEN date), that's allowed — state it.
- Period status changes go through the legitimate service/endpoint, recorded in audit.

Do NOT: change GL models, posting service, reporting service, or period RULES. Do NOT bypass closing/statutory/registration-floor guards. No frontend.

---

## House rules
- Use the proper reopen path; preserve audit trail; respect sequential order.
- Leave no stray committed test journals in the tenant.
- Report real, complete pass/skip/fail tables for both scripts.

---

## Completion summary required
State: the current period statuses found + why no OPEN period existed; the exact mechanism used to open a period (service/endpoint name) + that audit was recorded; the OPEN posting date used; the FULL re-run results for both GL scripts (every test, pass/skip/fail, with reasons for any remaining skip); confirmation that no stray POSTED test data remains; confirm no rules/guards bypassed and no GL/period logic changed.
