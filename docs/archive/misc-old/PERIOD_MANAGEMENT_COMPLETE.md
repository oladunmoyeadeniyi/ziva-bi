# Ziva BI — Period Management: Complete Design & Implementation State
*Written June 28 2026. Share this in any new chat to get full context on Period Management.*

---

## 1. WHAT IT IS

Period Management is the fiscal calendar and period-close workflow for Ziva BI. It controls:
- When the system's accounting periods are (months/quarters per fiscal year)
- What status each period is in (open, soft-closed, hard-closed, etc.)
- Who can post transactions into which periods
- The year-end close process (two-stage: management close → statutory/permanent lock)
- Grace windows for posting after soft-close
- A configurable close checklist with SOD (Segregation of Duties) enforcement

It is modelled after SAP FI, Oracle, and Microsoft Dynamics period management — enterprise-grade, not a simplified approximation.

---

## 2. BACKEND — FULLY BUILT

### Location
`backend/app/routers/setup.py` — all endpoints
`backend/app/models/setup.py` — all models
`backend/app/services/periods.py` — `is_date_postable` function

### Tables (7)

**`accounting_periods`** — core state machine
- `fiscal_year` (str label e.g. "FY2026"), `period_no` (1-based int), `period_name`
- `start_date`, `end_date`
- `status`: FUTURE | OPEN | SOFT_CLOSED | OVERDUE | HARD_CLOSED
- `soft_closed_at`, `grace_expires_at`, `hard_closed_at`, `hard_closed_by`
- `reopened_count`
- UQ: (tenant_id, fiscal_year, period_no)

**`period_grace_overrides`** — configurable posting windows after soft-close
- `module`, `applies_to_type` (all|role|user), `applies_to_role`/`user_id`
- `period_type` (regular|year_end), `grace_value` INT, `grace_unit` (calendar|workdays)
- One default row per tenant cannot be deleted

**`future_posting_exceptions`** — explicit grants for posting into FUTURE periods
- `created_by`, `target_date`, `module`, `reason`

**`close_checklist`** — tenant-defined items required before hard-close
- `label`, `applies_to` (every_close|year_end_only), `sort_order`, `is_active`
- Soft-deleted (is_active=False) so completion history survives edits

**`period_checklist_items`** — per-period sign-off records
- `period_id`, `checklist_item_id` FK→close_checklist NO CASCADE
- `item_label_snapshot` (captures label at time of completion)
- `prepared_by`, `approved_by`
- `status`: PENDING | PREPARED | APPROVED
- SOD: `approved_by ≠ prepared_by` enforced server-side (with consultant override — see Section 5)

**`fiscal_year_states`** — year-level two-stage close tracking
- `fiscal_year`, `status`: OPEN | AUDIT_PENDING | AUDIT_OVERDUE | STATUTORY_CLOSED
- `management_closed_at`, `audit_grace_months` INT DEFAULT 3
- `audit_grace_expires_at`, `retained_earnings_rolled` BOOL
- UQ: (tenant_id, fiscal_year)

**`period_audit_logs`** — append-only trail
- `fiscal_year`, `period_id` UUID NULL, `action` (REOPEN|MANAGEMENT_CLOSE|STATUTORY_CLOSE|CONSULTANT_OVERRIDE)
- `actor_id`, `detail` TEXT

### Endpoints (18)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /periods/generate | **DEPRECATED** — kept silently, auto-generation now handles this |
| GET | /periods | List all periods. Side effect: auto-soft-closes any OPEN period whose end_date has passed |
| GET | /periods/check | Single-date postability check (?date=YYYY-MM-DD). Calls is_date_postable directly |
| POST | /periods/{id}/soft-close | Manually soft-close an OPEN period. No UI button yet (auto-soft-close only) |
| POST | /periods/{id}/hard-close | Hard-close. Guards: (1) sequential — earlier period not yet HARD_CLOSED blocks; (2) checklist_complete() check |
| POST | /periods/{id}/reopen | Consultant-only. Increments reopened_count, writes PeriodAuditLog REOPEN row. Refused if year STATUTORY_CLOSED |
| POST | /periods/management-close | Stage 1 year-end. Requires Dec HARD_CLOSED. Creates/updates FiscalYearState → AUDIT_PENDING |
| POST | /periods/statutory-close | Stage 2 permanent lock → STATUTORY_CLOSED. is_date_postable blocks all dates in that FY unconditionally forever |
| GET | /periods/year-state | Returns FiscalYearState for a FY; auto-seeds an OPEN state if none exists |
| PATCH | /periods/year-state/{fy} | Update audit_grace_months override for a specific FY. No UI yet |
| GET | /periods/audit-log | Returns period_audit_logs rows, filterable. No UI viewer yet |
| GET/POST/PATCH/DELETE | /periods/checklist | CRUD for close checklist template items. DELETE = soft-delete (is_active=False) |
| GET | /periods/{id}/checklist | Per-period checklist state (pending/prepared/approved per item) |
| POST | /periods/{id}/checklist/{item_id}/prepare | Mark item prepared |
| POST | /periods/{id}/checklist/{item_id}/approve | Mark item approved. SOD enforced server-side |
| GET/PATCH | /periods/grace | Grace override CRUD |
| GET/PATCH | /periods/journal-block | Manual-journal block toggle (default ON) |
| DELETE | /periods/fiscal-year/{fiscal_year} | **REMOVED** — see design decision below |

### `is_date_postable` (in `services/periods.py`)
The single function ALL posting paths call before allowing a posting. Decision tree in order:

1. `target_date < org.date_of_registration` → **BLOCKED**: "Date is before the organisation's date of registration"
2. No AccountingPeriod found for date → **BLOCKED**: "No accounting period defined for this date"
3. Period's FiscalYearState.status == STATUTORY_CLOSED → **BLOCKED**: "Fiscal year permanently closed"
   - Side effect: if period end_date has passed and status == OPEN → auto-transition to SOFT_CLOSED + compute grace_expires_at + db.commit()
4. period.status == FUTURE → check FuturePostingException (tenant + date + module match) → ALLOWED if found, BLOCKED if not
5. period.status == HARD_CLOSED → **BLOCKED**: "Period is hard-closed"
6. period.status == OPEN → **ALLOWED** (proceed to step 7)
7. period.status in (SOFT_CLOSED, OVERDUE) → find best grace row (most specific: user > role > all, module-specific > any):
   - Grace row found: compute expiry. If now > expiry → **BLOCKED**: "Grace period expired". If now ≤ expiry → **ALLOWED**
   - No grace row found → always **ALLOWED** while SOFT_CLOSED (no grace = unlimited)
8. If module == "journal" AND org.block_journal_into_open_prior == True: if any earlier period not HARD_CLOSED → **BLOCKED**: "Cannot post manual journal while earlier period not hard-closed"
9. → **ALLOWED**

**Note on write side effects in a check function:** `is_date_postable` can `db.commit()` in two places (OPEN→SOFT_CLOSED transition and SOFT_CLOSED→OVERDUE transition). This was an intentional design decision pending a scheduled job — calling it from a GET endpoint (like `/periods/check`) can trigger these transitions as a side effect.

---

## 3. FRONTEND — SUBSTANTIALLY BUILT

### Location
`frontend/src/app/dashboard/business/setup/periods/page.tsx`
Route: `/dashboard/business/setup/periods`

### Tab 1 — Fiscal year & periods
- **Fiscal year settings form**: `first_fiscal_year_end` date picker (see Section 4), year name format dropdown (format codes), period closing frequency — load/save via GET/PATCH /api/setup/org
- **Period grid**: FY selector → shows all periods for selected FY. Each row: period name, status badge (colour-coded), grace countdown if soft-closed, Hard close button (earliest non-hard-closed only, sequential enforcement), Request reopen button (consultant-only, hidden/disabled for non-consultants)
- **Year-end strip**: shows FiscalYearState. Stage 1 "Management close" button (enabled when Dec HARD_CLOSED). When AUDIT_PENDING: amber panel with management-close date, grace window countdown. When audit grace expired: AUDIT_OVERDUE flag. Stage 2 "Statutory close (permanent)" button with explicit permanent-lock warning. M8.4 note: "Audit artifacts & CFO sign-off — coming in M8.4"

### Tab 2 — Grace overrides
- Table from GET /periods/grace: Module | Applies to | Period type | Grace value | Unit
- Add/delete rows. Default row: structural fields locked, value/unit editable (**PENDING FIX — see Section 5**)
- Manual-journal block toggle (GET/PATCH /periods/journal-block), default ON, with explanation

### Tab 3 — Close checklist
- Template CRUD: list items with label, applies_to (every_close/year_end_only), active toggle, sort order. Add/edit/soft-delete.
- Per-period sign-off: period selector → GET /periods/{id}/checklist → shows each applicable item with status (pending/prepared/approved) + Prepare/Approve buttons
- SOD note in UI
- **PENDING FIX: consultant self-approval** — see Section 5

---

## 4. DESIGN DECISIONS — ALL LOCKED

### Fiscal year defined by year-end, not start
- Organisations define their fiscal year by when it ENDS ("year ending 31 December")
- Start is always derived: month after year-end, day 1
- `fiscal_year_start_month` and `fiscal_year_start_day` remain in DB as derived fields — never directly entered by users
- **`first_fiscal_year_end`** (new column on `tenant_org_config`, committed `17491da`):
  - Full date picker in Organisation form (day + month + year)
  - Valid range: earlier of `date_of_registration` OR `commencement_date` (the "anchor") up to anchor + 1 year - 1 day
  - Backend derives `fiscal_year_start_month` = (fye.month % 12) + 1 and `fiscal_year_start_day` = 1
  - `_generate_periods_for_year` uses anchor date as `fy_start` for the year containing `first_fiscal_year_end`
  - **⚠️ NOT YET TESTED** — committed but not tested in the browser

### Stub first fiscal year
- If FY start date < anchor date → use anchor date as `fy_start` (not a rejection)
- `fy_end` always derived from fiscal year config (day before next FY starts), NEVER `fy_start + 12 months`
- Example: registered 25/08/2021, Jan-Dec fiscal year → FY2021 = 25/08/2021 to 31/12/2021

### Auto-generation (replaced manual generation entirely)
- **Trigger 1**: saving fiscal year settings → auto-generates current year's periods if not already existing
- **Trigger 2**: hard-closing last period of a year → auto-generates next year's periods
- Manual "Generate periods" button removed from UI
- `_generate_periods_for_year(db, tenant_id, year, org)` shared internal helper
- Deprecated `POST /api/setup/periods/generate` endpoint kept silently (not removed)
- Quarterly period generation: silently returns `[]` for non-monthly frequency — **known gap**

### Regeneration permanently blocked
- ANY existing period for a fiscal year blocks regeneration (any status)
- Was previously only HARD_CLOSED — now any period
- 409: "Fiscal year already generated"

### No delete fiscal year
- Removed entirely — not standard accounting practice
- Would cause audit issues (deletes audit trail)
- SAP/Oracle/Dynamics do not allow fiscal year deletion
- Correct remedy for misconfiguration: Consultant-assisted remediation

### Fiscal year bounded
- Cannot generate periods before the company's registration year
- Cannot generate periods beyond current calendar year
- Both enforced in backend + frontend bounded select

### Period statuses and close rules
- Open → Soft-closed → Hard-closed (three-stage)
- Soft-closed: blocks routine postings, allows audit/adjustment journals from authorized users
- Hard-closed: fully locked, requires formal reopen
- Sequential closing enforced: cannot close February until January is closed
- Year-end close = special event (not just "closing December"):
  - Stage 1 (Management close): triggers `FiscalYearState` → AUDIT_PENDING; `retained_earnings_rolled` stub (real roll-forward = M8.x marker, no GL postings yet)
  - Stage 2 (Statutory close): permanent lock; `is_date_postable` refuses all dates in that FY unconditionally forever

### Reopening a closed period
- Consultant-only
- Writes PeriodAuditLog REOPEN row with reason
- Refused if FiscalYearState = STATUTORY_CLOSED (permanent)

### Year name format — format codes
- `YYYY` → e.g. 2026
- `FYYYYY` → e.g. FY2026
- `YYYY/YYYY` → e.g. 2026/2027
- `YYYY-YYYY` → e.g. 2026-2027
- `MMM YYYY - MMM YYYY` → e.g. Jan 2026 - Dec 2026
- Live preview shown below dropdown
- `_build_fy_label` in backend mirrors frontend's `previewYearFormat`
- `FYYYYY` processed before `YYYY` to avoid substring collision
- Legacy `{year}`, `{nextyear}`, `MMM` codes still work for existing tenants

### Registration date floor (app-wide, not just Period Management)
No date anywhere in the system may be earlier than `tenant_org_config.date_of_registration`. If a business restructures, the original earliest registration date remains the floor — restructuring never moves it forward. Applied in `is_date_postable` step 1.

---

## 5. PENDING FIXES (not yet implemented)

### Fix 1 — Grace overrides: default row edit control
**What's broken:** The default grace override row has no edit control in the UI. Users can add/delete rows but cannot edit the default row's grace value or unit.

**What's needed:**
- The default row's structural fields stay locked (module, applies-to, period type cannot change)
- Add an inline edit control for `grace_value` (number input) and `grace_unit` (calendar/workdays dropdown) on the default row
- Save via PATCH /api/setup/periods/grace/{id}
- The PATCH endpoint already exists in the backend — this is frontend-only

### Fix 2 — Close checklist: consultant self-approval
**What's broken:** SOD rule is currently absolute — same user cannot prepare AND approve a checklist item. This blocks solo testing during implementation.

**What's needed:**
- Consultants can self-approve (prepare + approve as the same person)
- When a consultant self-approves, log it as a CONSULTANT_OVERRIDE action in PeriodAuditLog (already has this action type)
- For all non-consultant users, preparer ≠ approver remains absolute and enforced server-side
- The UI should show a visual indicator when consultant override is used (e.g. a small "Consultant override" badge on approved items)
- Backend change needed: in the approve endpoint, check if current_user is a consultant; if yes, skip the SOD check and write the override log

### Fix 3 — Missing UI for existing backend endpoints
These backend endpoints are built but have no frontend UI yet:
- **Manual soft-close button** — POST /periods/{id}/soft-close has no button (auto-soft-close by date is the only mechanism)
- **Future posting exceptions** — POST endpoint exists but no UI to create them
- **Grace row editing** — PATCH /periods/grace/{id} exists but not wired to any edit control (related to Fix 1)
- **Audit grace months per-year** — PATCH /periods/year-state/{fy} exists but no UI
- **Audit log viewer** — GET /periods/audit-log exists but no viewer tab in the frontend

---

## 6. FUTURE MILESTONE — Checklist v2 (system-wired items)

Not yet designed or briefed. The current checklist is free-text (finance team types their own items). A future version will replace this with system-wired reconciliations:
- Each checklist item links to a module + control GL account
- Examples: bank reconciliation → bank GL; AP sub-ledger → AP control GL; AR reconciliation; fixed assets register; inventory count; POSM
- Each item reviewed and signed off by a designated responsible officer
- The system validates that the linked GL is reconciled before allowing sign-off
- This is a significant milestone in its own right — scope it properly before building

---

## 7. RETAINED EARNINGS ROLL-FORWARD — STUB STATUS

The `retained_earnings_rolled` bool on `FiscalYearState` is set to True when management-close fires, but **no actual GL postings are made**. The real retained earnings roll-forward (P&L accounts zero out into retained earnings, B/S accounts carry forward) requires the GL posting engine to exist. It is marked with a `# M8.x` comment in the code. This will be implemented when the GL posting engine (currently being built via the expense flow) is sufficiently mature to handle year-end journal entries.

---

## 8. RELATIONSHIP TO OTHER FEATURES

### CoA (Chart of Accounts)
`is_date_postable` is called before any GL posting. The CoA provides the retained earnings GL account for the year-end roll-forward (when that's implemented).

### Dimension value active-years (deferred)
The plan to replace `valid_from`/`valid_to` date ranges on dimension values with discrete active years (e.g. active in 2024, inactive 2025-2026, active again in 2027) was deferred specifically to wait for Period Management's year-end permanent lock. Now that `STATUTORY_CLOSED` exists as the trigger condition, this feature can be revisited. The active-years feature should check whether a year is STATUTORY_CLOSED before allowing changes to that year's active-years list.

### Yearly recurring IO template system (deferred)
Also deferred to wait for Period Management. Finance team defines a base IO template (e.g. "Marketing Campaign", code `MKT`); the system auto-generates year-specific instances (`MKT_2024`, `MKT_2025`) triggered by the year-open event (which now exists: the auto-generation trigger on last-period hard-close). Design not yet finalized.

### Expense flow
`is_date_postable` is already called at two points in the expense flow:
- At expense submit (module="expense") — records the date check result
- At final approval → GL posting (inside `post_expense_to_gl`) — blocks the posting if the date is not postable

### Configuration Promotion Pipeline
Period configuration (fiscal year settings, periods, grace overrides, checklist template) should be part of what gets promoted from test → live when a tenant goes live. This is not yet implemented in the promotion engine.

---

## 9. RECENT COMMITS AFFECTING PERIOD MANAGEMENT

- `384fd0e` — Generation bounded to registration year → current year (frontend select + backend validation)
- `75315cb` — Stub first fiscal year (`fy_start` = anchor date); correct `fy_end` derivation from fiscal year config (not `fy_start + 12 months`); regeneration blocked by any existing period (not just HARD_CLOSED)
- `17491da` — Auto-generation (remove manual generate button; `_generate_periods_for_year` helper; Trigger 1 on org save; Trigger 2 on last-period hard-close); year name format codes (`YYYY`, `FYYYYY`, etc.); `first_fiscal_year_end` field in Organisation form + new DB column + Alembic migration
- `cc881f4` — Codebase audit fixes including closed-period date trap in expense flow

---
*End of document.*
