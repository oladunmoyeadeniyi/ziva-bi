# Brief 4 — Year-end two-stage close + audit grace (Part A) + Period Management page UI (Part B)

**Milestone:** M8.3 Period Management — Brief 4 of 4 (final)
**Scope:** Part A backend, Part B frontend. Run as two sequenced passes in this one brief — finish and type-check Part A before starting Part B.
**Depends on:** Briefs 1–3. Fills the last `# BRIEF-4: audit log on reopen` hook and builds the page that surfaces the whole engine.

---

# PART A — Backend: year-end two-stage close + audit grace + reopen audit log

## STEP 0 — Read before changing anything (mandatory)

Read and report exact files + line ranges BEFORE editing:
- `backend/app/routers/setup.py` — `hard_close_period`, `reopen_period` (the `# BRIEF-4: audit log on reopen` hook), the `/periods` group.
- `backend/app/models/setup.py` — `AccountingPeriod` (note: year-end period = `period_no == 12` for monthly, per Brief 3), `PeriodGraceOverride` (has a `period_type` of `year_end` — reuse for audit-grace config), `TenantOrgConfig`.
- `backend/app/services/periods.py` — `is_date_postable`, `apply_auto_soft_close`, `checklist_complete`.

If anything conflicts, STOP and report.

## Context — the two-stage year-end

Closing December (period_no 12) is NOT the same as permanently locking the year. Two stages:

1. **Management close** — December hard-closes → P&L rolls to retained earnings, B/S carries forward → the **fiscal year** enters status `AUDIT_PENDING`. The new fiscal year opens and runs normally. The year is NOT permanently locked yet.
2. **Statutory close** — audit concludes (the real audit artifacts — audited TB, signed AFS, CFO sign-off — are **M8.4, NOT this brief**). This brief only exposes the trigger that *will* permanently lock the year. Calling it sets the fiscal year to `STATUTORY_CLOSED` (permanent).

Between the two: an **audit grace window** (default 3 *months*, per-tenant configurable — distinct from month-end grace which is in days). When it expires without statutory close → the year flags `AUDIT_OVERDUE` (visual only — nothing is blocked; the new year keeps running).

## Model (NEW) — `FiscalYearState`
Tracks year-level status (period statuses already exist; this is the *year* wrapper).
- `id`, `tenant_id` (fk CASCADE, indexed)
- `fiscal_year` (string, e.g. "FY2026") — unique per tenant
- `status` (string enum): `OPEN` | `AUDIT_PENDING` | `AUDIT_OVERDUE` | `STATUTORY_CLOSED`
- `management_closed_at` (datetime, nullable) / `management_closed_by` (uuid, nullable)
- `audit_grace_months` (int, default 3) — per-tenant default can be set; per-year override stored here
- `audit_grace_expires_at` (datetime, nullable) — computed at management close
- `statutory_closed_at` (datetime, nullable) / `statutory_closed_by` (uuid, nullable)
- `retained_earnings_rolled` (bool, default False) — guard against double roll-forward
- `created_at`
- unique on (`tenant_id`, `fiscal_year`)

Optionally add `default_audit_grace_months` to `TenantOrgConfig` (default 3) so a tenant sets it once; per-year `audit_grace_months` seeds from it. State your choice.

## Model (NEW) — `PeriodAuditLog`
General audit trail for period actions (reopen, management close, statutory close). This satisfies the `# BRIEF-4: audit log on reopen` hook AND year-end events.
- `id`, `tenant_id` (fk CASCADE, indexed)
- `fiscal_year` (string, nullable) / `period_id` (uuid, nullable) — one or both
- `action` (string): e.g. `REOPEN` | `MANAGEMENT_CLOSE` | `STATUTORY_CLOSE` | `HARD_CLOSE`
- `actor_id` (uuid) — who did it
- `detail` (text, nullable) — e.g. reason for reopen
- `created_at`

## Endpoints (under `/api/setup/periods`)

1. `POST /api/setup/periods/management-close` — body `{ fiscal_year_label }`.
   - Precondition: December (period_no 12) of that FY must be hard-closed (i.e. its period is HARD_CLOSED). If not → 409 "December must be hard-closed before management close."
   - Roll-forward: this brief does the *state* transition + records intent. **Actual GL roll-forward postings** depend on a posting engine that doesn't exist yet — so for now: set `retained_earnings_rolled = True`, write a `PeriodAuditLog` MANAGEMENT_CLOSE entry, and leave a clearly-marked `# M8.x: post retained-earnings roll-forward journal here` stub. Do NOT fake journal entries.
   - Set `FiscalYearState.status = AUDIT_PENDING`, `management_closed_at/by`, compute `audit_grace_expires_at = management_closed_at + audit_grace_months`.
   - Idempotent: if already AUDIT_PENDING or STATUTORY_CLOSED → 409.

2. `POST /api/setup/periods/statutory-close` — body `{ fiscal_year_label }`.
   - Precondition: year must be AUDIT_PENDING or AUDIT_OVERDUE. → else 409.
   - **This brief: gate is open** (no audit-artifact check — that's M8.4). Leave a marked `# M8.4: require audited TB + signed AFS + CFO sign-off before allowing statutory close` stub.
   - Set `status = STATUTORY_CLOSED`, `statutory_closed_at/by`. Write PeriodAuditLog STATUTORY_CLOSE.
   - **Permanent lock:** once STATUTORY_CLOSED, all periods in that FY are hard-locked — `is_date_postable` must refuse any date in a statutory-closed year (add this check), and reopen of those periods is refused.

3. `GET /api/setup/periods/year-state?fiscal_year=FY2026` — return the FiscalYearState (seed an OPEN row if none). Used by the UI.

4. `PATCH /api/setup/periods/year-state/{fiscal_year}` — set `audit_grace_months` (consultant/admin). Recompute `audit_grace_expires_at` if already management-closed.

5. `GET /api/setup/periods/audit-log?fiscal_year=&period_id=` — list audit-log entries (filterable). Used by the UI reopen/close history.

## Audit-grace overdue transition
Like auto-soft-close: on read of year-state (or period list), if `status == AUDIT_PENDING` and `now > audit_grace_expires_at` → set `AUDIT_OVERDUE` and persist. Visual only — does NOT block the new year or any posting. Add a `# FUTURE: scheduled job` comment.

## Fill the reopen audit hook
In `reopen_period`, at the `# BRIEF-4: audit log on reopen` stub: write a `PeriodAuditLog` row (action REOPEN, actor = current_user, detail = reason if the endpoint takes one — add an optional `reason` to the reopen body). Keep the consultant-only restriction and `reopened_count++` from Brief 1. Also: refuse reopen (409) if the period's fiscal year is STATUTORY_CLOSED.

## Part A files
- `models/setup.py` — `FiscalYearState`, `PeriodAuditLog`; optional `default_audit_grace_months` on TenantOrgConfig.
- `alembic/versions/<new>` — additive, reversible.
- `schemas/setup.py` — year-state, audit-log, management/statutory-close request/response schemas; add optional `reason` to reopen.
- `services/periods.py` — audit-grace-expiry compute + overdue transition; statutory-closed check inside `is_date_postable`.
- `routers/setup.py` — 5 new endpoints; fill reopen hook; statutory-lock in reopen.

## Part A acceptance (state pass/fail)
1. Migration clean; both tables exist; downgrade reverts.
2. management-close before Dec hard-closed → 409. After Dec hard-closed → year goes AUDIT_PENDING, grace expiry = +3 months, MANAGEMENT_CLOSE logged, retained_earnings_rolled True, roll-forward stub present (no fake journals).
3. New fiscal year can still generate + run while prior is AUDIT_PENDING (not blocked).
4. audit-grace overdue: simulate now > expiry → year flips AUDIT_OVERDUE; posting into the NEW year still works (visual only).
5. statutory-close from AUDIT_PENDING → STATUTORY_CLOSED, logged. Gate-open confirmed, M8.4 stub present.
6. After statutory close: `is_date_postable` for any date in that FY → not postable; reopen of its periods → 409.
7. reopen now writes a PeriodAuditLog REOPEN row with reason; still consultant-only.

**Finish Part A, type-check/test, THEN start Part B.**

---

# PART B — Frontend: the Period Management page + sidebar link

## STEP 0 (frontend)
Read for styling/pattern reference (do not edit unless listed):
- `frontend/src/app/dashboard/business/setup/tax/page.tsx` — copy its tab pattern, `apiFetch` usage, card/section styling, save-button style. Match this page's look exactly.
- `frontend/src/app/dashboard/business/layout.tsx` — the FINANCIALS `NavLink` group (add the Period Management link here).

## Create the page — `frontend/src/app/dashboard/business/setup/periods/page.tsx` (NEW)
Route `/dashboard/business/setup/periods`. Title "Period management", subtitle "Fiscal year, periods, grace controls, and close.".

Tabs (match Tax page tab style):

### Tab 1 — Fiscal year & periods (default)
- **Fiscal year settings** section: start month, start day, year name format, period closing frequency. Load/save via `GET`/`PATCH /api/setup/org` (the four `FiscalYearUpdate` fields ONLY — do NOT send `org_configuration` from this page). Show the registration-date floor note (read `date_of_registration` from org).
- **Generate periods**: input for FY label + button → `POST /api/setup/periods/generate`. Handle the 422 (reg-date floor) and 409 (hard-closed exists) with clear inline messages.
- **Period grid**: `GET /api/setup/periods?fiscal_year=`. One row per period: name, status badge (FUTURE/OPEN/SOFT_CLOSED/OVERDUE/HARD_CLOSED — distinct colors), grace countdown if soft-closed, and an action: Hard close (only on the earliest non-hard-closed; disabled otherwise with tooltip "close earlier periods first"); Request reopen (on hard-closed; consultant-only — hide/disable for non-consultant). Hard-close calls the endpoint; surface the checklist-incomplete 409 message inline.
- **Year-end strip** (when the FY's Dec is in play): show FiscalYearState (`GET /periods/year-state`). Two-stage: "Management close" button (enabled when Dec hard-closed), then an "Audit pending" panel with the grace countdown + AUDIT_OVERDUE flag if expired, then "Statutory close (permanent)" button. Make clear statutory close is permanent. Audit-artifact UI is M8.4 — show a muted "Audit artifacts & CFO sign-off — coming in M8.4" note next to the statutory button.

### Tab 2 — Grace overrides
- Table from `GET /periods/grace`: Module / Applies to / Period type / Grace + Unit. Add/edit/delete rows (POST/PATCH/DELETE). The default row's structural fields locked (only value/unit editable); no delete on default. "Applies to" supports All / Role / specific User.
- The manual-journal block toggle (`GET`/`PATCH /periods/journal-block`) shown here with its default-on state and a one-line explanation.

### Tab 3 — Close checklist
- Template CRUD from `GET /periods/checklist`: list items with label, applies_to (every_close / year_end_only), active toggle, sort. Add/edit/soft-delete.
- (Per-period prepare/approve happens contextually — for this brief, expose a simple per-period checklist view reachable from a period row, or a sub-section that takes a selected period and shows its applicable items with Prepare/Approve buttons calling the Brief 3 endpoints. Keep it functional, not fancy.)

## Sidebar link
In `layout.tsx`, FINANCIALS group: add `NavLink` after "Chart of accounts" → label "Period management", icon `calendar`, href `/dashboard/business/setup/periods`. Always visible.

## Part B files
- `frontend/src/app/dashboard/business/setup/periods/page.tsx` (NEW)
- `frontend/src/app/dashboard/business/layout.tsx` (one NavLink added)

## House rules
- `npm run type-check` = 0 errors before commit.
- Match the Tax page's visual language — do not invent a new style.
- No browser storage. Use React state.
- Don't touch other pages, Brief 1–3 backend logic, `config.py`, or CORS.

## Part B acceptance (state pass/fail)
1. Sidebar shows Period management under FINANCIALS; routes correctly.
2. Fiscal settings load/save; reg-date note shows; saving does NOT wipe org_configuration (page doesn't send it).
3. Generate periods works; 422/409 surfaced clearly.
4. Period grid shows correct status badges; Hard close gated to earliest + checklist 409 surfaced; reopen consultant-only.
5. Year-end strip: management close enabled only when Dec hard-closed; audit-pending + grace countdown; statutory close marked permanent; M8.4 note shown.
6. Grace tab: rows CRUD; default row protected; journal-block toggle works.
7. Checklist tab: template CRUD; per-period prepare/approve enforces preparer≠approver (409 surfaced).
8. type-check 0 errors.

---

## Completion summary required (whole brief)
List every file changed across both parts. State: column-vs-config choice for audit-grace default; confirm roll-forward + M8.4 gates are stubs, not faked; confirm statutory-closed permanently blocks posting + reopen; confirm the reopen audit log now writes a row; confirm Part B matches the Tax page styling and the page doesn't send org_configuration; confirm all Brief 1–3 logic untouched. Report Part A and Part B acceptance separately.
