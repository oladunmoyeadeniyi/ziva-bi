# Brief 1 — Period engine backend core (M8.3)

**Milestone:** M8.3 Period Management — Brief 1 of 4
**Scope:** Backend only. No frontend in this brief (the Period Management page UI lands in Brief 4; fiscal-year settings UI already exists from the restructure).
**Depends on:** the Organisation/Tax restructure (done). Replaces the old `FiscalPeriod` model.

---

## STEP 0 — Read before changing anything (mandatory)

Do not edit from assumption. Open and read these in full, then report the exact files + line ranges you intend to change BEFORE editing:

- `backend/app/routers/setup.py` — specifically the two old period endpoints `get_fiscal_periods` (~line 962) and `generate_fiscal_periods` (~line 991), and the imports of `FiscalPeriod` / `FiscalPeriodResponse`.
- The model file defining `FiscalPeriod` (find it under `backend/app/models/`).
- `backend/app/schemas/setup.py` — `FiscalPeriodResponse`, `GeneratePeriodsRequest`.
- `backend/app/models/` — the `TenantOrgConfig` model, to read `fiscal_year_start_month`, `fiscal_year_start_day`, `period_closing_frequency`, and `date_of_registration`.
- How other routers register in `main.py` (so the new period logic is reachable).

If anything below conflicts with the real code, STOP and report it — do not silently work around it.

---

## Context — what this engine is

This replaces the old 3-status period stub (`open | current | closed`) with the real period state machine agreed for M8.3. Key principles (do not deviate):

- Periods are **monthly** by default, fiscal year configurable per tenant (defaults Jan–Dec) via existing org-config fields.
- Periods run **independently** — only *closing* is sequential. Multiple periods can be open/active at once.
- **Exactly one** period is `OPEN` at a time under normal flow: the calendar-current month. Past months are in some close state; future months are `FUTURE` (locked).
- This brief builds the **calendar + state machine + the postability check**. It does NOT build: grace overrides (Brief 2), close checklist (Brief 3), year-end roll-forward / audit (Brief 4). Where those hook in, leave a clearly-marked extension point (a function stub or comment), but no logic.

---

## The period states (status enum)

Replace the old `open|current|closed` with:

- `FUTURE` — month hasn't started yet. **No posting allowed.** (Brief 2 adds the logged-exception path; here it's a hard block.)
- `OPEN` — the calendar-current month. Posting allowed.
- `SOFT_CLOSED` — month has ended (we're past it) but not yet hard-closed. Posting still allowed **for now** (Brief 2's grace table will govern who/what; in this brief, SOFT_CLOSED simply allows posting). Auto-entered when the next month begins.
- `OVERDUE` — informational sub-state of soft-closed: grace expired without hard close. (Brief 2 computes grace; in this brief, treat OVERDUE as a flag the model can hold but nothing auto-sets it yet — leave the column + a TODO.)
- `HARD_CLOSED` — manually closed. No posting. (Brief 3 adds the checklist gate before this is allowed; here, hard-close is a direct action.)

Store status as a string/enum column. Document the values in a module-level comment.

---

## Data model (new)

Create a new period model — suggested name `AccountingPeriod` (do NOT reuse the `FiscalPeriod` class name; we are replacing it). Fields:

- `id` (uuid pk)
- `tenant_id` (fk, indexed)
- `fiscal_year` (string label, e.g. "FY2026")
- `period_no` (int, 1–12 for monthly; ordinal within the fiscal year)
- `period_name` (string, e.g. "January 2026")
- `start_date` (date)
- `end_date` (date)
- `status` (string enum per above; default `FUTURE`)
- `hard_closed_at` (datetime, nullable)
- `hard_closed_by` (uuid, nullable)
- placeholder nullable columns for later briefs (add now to avoid migration churn): `soft_closed_at` (datetime, nullable), `grace_expires_at` (datetime, nullable — Brief 2 fills), `reopened_count` (int default 0 — Brief 4/reopen flow).
- unique constraint on (`tenant_id`, `fiscal_year`, `period_no`).

Alembic migration: drop the old `FiscalPeriod` table (or rename/replace cleanly — your call, but no orphaned table left), create the new one. The old table holds only test data; no backfill required. Migration must be reversible.

---

## Endpoints (replace the old two)

Base path `/api/setup/periods` (note: distinct from the page route; this is the API). Replace the old `/fiscal-periods` endpoints entirely.

1. `POST /api/setup/periods/generate` — body: `{ fiscal_year_label: str }`.
   - Reads `fiscal_year_start_month/day` and `period_closing_frequency` from org config (monthly only for now; if frequency is quarterly/annual, return 422 "Only monthly periods supported in M8.3" — we'll extend later).
   - Generates the 12 monthly periods for that fiscal year.
   - **Registration-date floor:** no period may start before `tenant_org_config.date_of_registration`. If the fiscal year would begin before it, clamp or reject (reject with a clear 422 is cleaner — state which you did).
   - On generate, set initial statuses **by today's date**: months entirely in the past → `SOFT_CLOSED`; the month containing today → `OPEN`; months entirely in the future → `FUTURE`. (Past months are soft-closed, not hard-closed, because hard-close is a deliberate human action.)
   - Idempotent: regenerating the same fiscal_year replaces its periods (delete + recreate) but must NOT wipe `hard_closed_at` history if a period was already hard-closed — if any period in that FY is HARD_CLOSED, refuse to regenerate and return 409. State this guard in your summary.

2. `GET /api/setup/periods?fiscal_year=FY2026` — list periods for a tenant (optionally filtered by FY), ordered by start_date. Returns the new status + close metadata.

3. `POST /api/setup/periods/{period_id}/soft-close` — manual soft-close (normally automatic, but expose it). Sets `SOFT_CLOSED`, `soft_closed_at`.

4. `POST /api/setup/periods/{period_id}/hard-close` — sets `HARD_CLOSED`, `hard_closed_at`, `hard_closed_by`.
   - **Sequential-close enforcement:** refuse (409) if any earlier period (lower period_no, same or earlier FY) is not yet `HARD_CLOSED`. Message: "Earlier periods must be hard-closed first."
   - Leave a clearly-marked extension point where Brief 3's checklist gate will be checked before allowing hard-close. No checklist logic here.

5. `POST /api/setup/periods/{period_id}/reopen` — sets a hard-closed period back to `SOFT_CLOSED`, increments `reopened_count`.
   - Restrict to consultant role (`current_user.role_tier == "consultant"`) — return 403 otherwise.
   - Leave an extension point for the audit-trail log entry (Brief 4 / audit). For now just perform the status change + count.

---

## The postability check (the important reusable bit)

Create a single reusable function — suggested `async def is_date_postable(tenant_id, target_date, db) -> tuple[bool, str]` (returns allowed + reason). Logic for THIS brief:

- Find the period containing `target_date` for the tenant.
- No period exists → not postable ("No accounting period defined for this date.").
- `FUTURE` → not postable ("Period has not started yet."). *(Brief 2 adds the logged-exception override.)*
- `HARD_CLOSED` → not postable ("Period is hard-closed.").
- `OPEN` or `SOFT_CLOSED` → postable. *(Brief 2 will refine SOFT_CLOSED via the grace table.)*
- Also enforce the **registration-date floor**: any date before `date_of_registration` → not postable, regardless of period.

This function is what future posting engines (expense, AP, payroll) will call. It must live somewhere importable (e.g. a `services/periods.py` or similar), NOT buried in the router. Expose a thin endpoint too for testing: `GET /api/setup/periods/check?date=YYYY-MM-DD` → `{ postable: bool, reason: str }`.

**This brief does NOT wire `is_date_postable` into the expense flow.** It only builds and exposes it. Wiring into expense posting is a later, separate brief.

---

## Auto-soft-close behaviour

When periods are listed or checked, the engine should reflect that a month which has ended but is still `OPEN` ought to be `SOFT_CLOSED`. For this brief, implement auto-soft-close as a **computed transition on read/generate** (when today has moved past a period's end_date and it's still OPEN, transition it to SOFT_CLOSED and persist). Do NOT build a scheduler/cron — that's infrastructure we don't have yet. A comment noting "future: move to scheduled job" is enough.

---

## Files CC may modify

- `backend/app/models/<period model file>` — replace `FiscalPeriod` with `AccountingPeriod`.
- `backend/alembic/versions/<new migration>` — drop old, create new.
- `backend/app/schemas/setup.py` — replace `FiscalPeriodResponse` with new period response schema; add check/generate request/response schemas.
- `backend/app/routers/setup.py` — replace the two old period endpoints with the new ones above.
- `backend/app/services/periods.py` (NEW) — the `is_date_postable` + transition helpers.
- Possibly `main.py` only if a new router needs registering (prefer keeping these under the existing setup router).

Do NOT touch: `config.py` (DB name `ziva_dev`), CORS in `main.py`, the expense flow, the frontend.

---

## House rules

- Backend must start clean; run the app and hit each endpoint once.
- Migration: `alembic upgrade head` clean, and `downgrade` works.
- Expect to manually restart uvicorn after the migration (reload is unreliable in this env).
- No frontend changes in this brief.

---

## Acceptance / test steps (state pass/fail each)

1. Migration runs clean; old `FiscalPeriod` table gone, new `AccountingPeriod` table exists; downgrade reverts.
2. `POST /api/setup/periods/generate {"fiscal_year_label":"FY2026"}` creates 12 monthly periods, correctly dated, with statuses set by today (past=SOFT_CLOSED, current month=OPEN, future=FUTURE).
3. Generating a fiscal year that would start before `date_of_registration` is rejected/clamped (state which).
4. `GET /api/setup/periods?fiscal_year=FY2026` returns them ordered, with new statuses.
5. `hard-close` on the earliest soft-closed period succeeds; hard-closing a later one while an earlier is still open is refused (409).
6. `reopen` works only for consultant role (403 otherwise); increments reopened_count.
7. `GET /api/setup/periods/check?date=...`:
   - a date in the current (OPEN) month → postable
   - a date in a FUTURE month → not postable ("not started")
   - a date in a HARD_CLOSED month → not postable
   - a date before `date_of_registration` → not postable
8. Regenerating a FY with a hard-closed period in it is refused (409).

---

## Completion summary required

List every file changed. State: how you handled the registration-date-floor on generate (clamp vs reject); confirm the old `FiscalPeriod` is fully gone with nothing else referencing it; confirm `is_date_postable` lives in a service module, not the router; list the marked extension points you left for Briefs 2/3/4 (grace, checklist gate, audit log) so the next briefs can find them.
