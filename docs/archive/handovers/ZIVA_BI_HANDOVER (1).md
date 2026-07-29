# ZIVA BI — HANDOVER NOTE
_Last updated: 17 June 2026 (session: M8.3 complete + roadmap + Phase 1a)_

## IMMEDIATE NEXT STEP
Design **M9.0 — Environment architecture** (shadow-tenant model). Architecture decided (see ROADMAP); 4 open design questions remain before briefing. Do that first next session.

Also pending your manual confirmation: after Phase 1a, **log out and back in** as adeniyi.oladunmoye@redbull.com, then test **Request reopen** on a hard-closed period — confirms the consultant role_tier chain works end to end.

## THIS SESSION'S PROGRESS
- **M8.3 Period Management** — complete (see below).
- **ROADMAP created** (`ZIVA_BI_ROADMAP.md`) — the authoritative build sequence/spine. Read it. Locked scope: Nigeria-first; reporting v1 = export + ERP integration; owner portal required before selling; v1 = robust Expense + Tax on a shared core; every module standalone-sellable.
- **Expense module north star corrected**: it's a configurable digital replication of the Red Bull expense retirement process (real Excel template is the reference), with email+Excel intake as its front door (post-v1).
- **OCR/AI engine** = core, required for v1. **Mobile+desktop equal** = global principle; existing screens need responsive retrofit in v1.
- **Phase 1a (role_tier wiring) — DONE & committed.** `_require_admin` now tier-aware (consultant/power_admin pass; functional_admin excluded; is_tenant_admin kept, NOT retired; is_super_admin untouched). Repeatable tier-setter: `python scripts/set_role_tier.py <email> <tier>` (from backend/). Your redbull account set to consultant. **Requires log-out/in for the JWT to carry it.**
- **M9 milestone fully designed** (see ROADMAP): owner portal, two onboarding paths (consultant-led + self-service trial), 4 lifecycle states, shadow-tenant environment architecture, 5-brief order (M9.0→9.4).

## ___ (rest of M8.3 detail below) ___


## Where we are

**M8.3 Period Management — COMPLETE and committed.** Built across 5 briefs (0, 0b, 1, 2, 3, 4), all landed, all acceptance tests passed, walked through in the UI.

### What M8.3 delivered
- **Period engine** (`AccountingPeriod` model, replaced old `FiscalPeriod`): state machine FUTURE → OPEN → SOFT_CLOSED → OVERDUE → HARD_CLOSED. Periods run independently; only *closing* is sequential. Auto-soft-close on read (no scheduler yet). Registration-date floor enforced. Reusable `is_date_postable(tenant_id, target_date, db, user_id?, module?)` in `services/periods.py` — the keystone future posting engines (expense/AP/payroll) will call. NOT yet wired into expense flow (deliberate, later brief).
- **Grace overrides** (`PeriodGraceOverride`): tenant default (3 workdays, regular, all) + override rows by module (default/expense/manual_journal/future_exception) / applies_to (all/role/user) / period_type / grace value+unit (per-row workdays or calendar_days). Workday math = weekends-only (no holiday calendar yet; `# FUTURE` comment left).
- **Manual-journal block** (`block_journal_into_open_prior` column on TenantOrgConfig, default ON): blocks manual journals into a period while an earlier period isn't hard-closed.
- **Future-dated exception** (`FuturePostingException`): FUTURE periods hard-blocked by default; permitted roles (consultant or a `future_exception` grace row) can post a logged future-dated exception.
- **Close checklist** (`CloseChecklistItem` template + `PeriodChecklistCompletion`): tenant items tagged every_close / year_end_only (year-end = period_no 12). Preparer ≠ approver enforced server-side. Gates hard-close (empty checklist ⇒ hard-close allowed). History preserved via `item_label_snapshot` + no-cascade FK; items soft-deleted (is_active).
- **Year-end two-stage** (`FiscalYearState`): Management close (Dec hard-closed → state AUDIT_PENDING; roll-forward is a STUB — no GL postings, `# M8.x` marker; new year runs normally) → audit grace (3 months default, per-tenant; AUDIT_OVERDUE flag on expiry, visual only) → Statutory close (gate OPEN this brief; real audit artifacts = M8.4 stub; sets STATUTORY_CLOSED = permanent lock; `is_date_postable` refuses any date in a statutory-closed year; reopen refused).
- **Reopen** (`PeriodAuditLog`): consultant-only, increments reopened_count, now writes audit-log row with reason; refused if year statutory-closed.
- **Period Management page** at `/dashboard/business/setup/periods` — 3 tabs (Fiscal year & periods / Grace overrides / Close checklist). Sidebar link added under FINANCIALS.

### Tax/Org restructure (pre-M8.3, also complete)
- Configuration tab flattened (fiscal + tax sub-tabs removed). Tax applicability moved to Tax & statutory as gating first tab. Verified: org_configuration merge doesn't wipe toggles; tax-tab gating works.

---

## OPEN BACKLOG (written into brief: `BRIEF_uipolish_fiscalmove_consultant_override.md`)

**UI Polish + fixes (items 1–5, briefed, ready to run):**
1. Organisation → Configuration: one combined Save button (top + bottom) instead of two section saves.
2. Move fiscal-year definition (start month/day, format, closing frequency) FROM Period Management TO Organisation (Identity tab). Period Management keeps year selector + generate + grid + year-end only. Start-only; end derived.
3. Year name format → preset DROPDOWN (lives in Organisation with the fiscal fields). Presets: `FY{YYYY}`, `{YYYY}FY`, `{YYYY}/{YYYY+1}`, `FY{YYYY}/{YY+1}`, `{YYYY}`, `FY{YY}`. Generation uses chosen format for naming.
4. Grace overrides: add edit control for the default row's grace value/unit (currently no control).
5. Consultant override role may self-approve checklist items during implementation, logged as a consultant override in PeriodAuditLog. Non-consultant preparer≠approver stays absolute. (This unblocks solo testing of the checklist close loop.)

**Future milestone — Checklist v2 (system-wired close items):**
- Replace free-text checklist items with system-wired reconciliations: each item links to a module + control GL (bank rec → bank GL; AP sub-ledger → AP control; AR; fixed assets; inventory; POSM; etc.), reviewed and signed off by responsible officers. Depends on those sub-ledger modules existing. Revisit after they're built. (Adeniyi's point: free-text is a weak control; real close items must be system-verifiable, not typed-and-ticked.)

**Deferred / dependent on later work:**
- Retained-earnings roll-forward actual GL postings (currently a state-only stub) — needs a GL posting engine.
- M8.4 Audit & Statutory Compliance — audited TB upload, balance validation, audit adjustment journals, signed AFS upload, CFO sign-off; this fills the statutory-close gate stub.
- Wire `is_date_postable` into the expense posting flow (and future AP/payroll).
- Holiday calendar for workday grace math.
- Auto-soft-close / audit-overdue currently compute on read; move to a scheduled job eventually.

---

## TESTING STATUS
- Period engine, grace, journal-block, future-exception, year-end states: all passed CC's API acceptance tests (Briefs 1–4).
- UI walk-through (FY2024): generated 12 periods, all SOFT_CLOSED; sequential-close gate confirmed (only earliest period's Hard close active); checklist gate confirmed (hard-close blocked with "Close checklist incomplete" banner).
- NOT yet tested end-to-end: full checklist prepare→approve→close loop (blocked by solo login + preparer≠approver; item 5 fixes this) and the year-end strip (requires reaching a hard-closed December). Plan: test properly once item 5 lands and/or system is further built.

## ENVIRONMENT NOTES
- Backend venv is `.venv` (dot). Activate: `.\.venv\Scripts\Activate.ps1`.
- `uvicorn` only on PATH inside the venv. If not, `python -m uvicorn app.main:app --reload --port 8000`.
- Alembic needs `DATABASE_URL` in the shell env (not auto-read like the app). Set it before migrating:
  `$env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').ToString().Split('=',2)[1]`
  then `alembic upgrade head`.
- DB stays `ziva_dev`; CORS stays hardcoded `http://localhost:3000`. CC sometimes overwrites both — catch each time.
- `--reload` is unreliable; manual restart after migrations.
- Registration date for current test tenant (Red Bull): 2021-08-25 (the app-wide date floor).
