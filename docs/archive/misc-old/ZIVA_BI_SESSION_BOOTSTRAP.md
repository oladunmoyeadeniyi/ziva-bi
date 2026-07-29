# ZIVA BI — SESSION BOOTSTRAP (paste this as the first message in the new chat)

This document is a complete handover from a prior Claude session — covering BOTH this most recent session AND a summarized digest of everything built before it. Read it fully before doing anything. It is written so you (the new Claude instance) can act immediately without Adeniyi repeating himself. A separate, longer chronological working log also exists at `docs/ZIVA_BI_HANDOVER.md` in the repo (367 lines as of writing) — that one is the original append-only source Section 5a below was digested from; consult it directly only if you need verbatim detail on something Section 5a summarizes.

---

## 1. CURRENT ENVIRONMENT STATE

- **OS:** Windows 10, PowerShell.
- **Project root:** `C:\Users\Adeniyi Oladunmoye\Projects\ziva-bi` — the username has a space, ALWAYS quote this path.
- **Backend:** Python/FastAPI, async SQLAlchemy + asyncpg. Venv is `.venv` (dot-prefixed). Activate: `.\.venv\Scripts\Activate.ps1`. Run: `uvicorn app.main:app --reload --port 8000` (if `uvicorn` isn't on PATH inside the venv, use `python -m uvicorn app.main:app --reload --port 8000`). Runs on `localhost:8000`.
- **`--reload` is unreliable** — after any migration or model change, manually restart uvicorn if behavior seems stale.
- **Frontend:** Next.js 15, React, TailwindCSS. Run: `npm run dev` from `frontend/`. Runs on `localhost:3000`.
- **Database:** PostgreSQL, DB name `ziva_dev` — must stay this exact name. CC sometimes overwrites the default DB name in `config.py` when editing — check after any backend change.
- **CORS:** `http://localhost:3000` must be hardcoded in `main.py`'s allowed origins — CC sometimes breaks this too. Check after backend changes.
- **Alembic:** needs `DATABASE_URL` set in the shell manually (not auto-read like the app):
  ```powershell
  $env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').ToString().Split('=',2)[1]
  alembic upgrade head
  ```
  **CRITICAL LESSON FROM THIS SESSION:** a migration that adds/drops columns MUST be applied (`alembic upgrade head`) — writing the migration file is NOT enough. If uvicorn's `--reload` picks up a model change before the migration runs, every endpoint touching that table 500s with `UndefinedColumnError`. Always verify `alembic current` equals head after CC writes a migration, and confirm the app endpoints return 200 before moving on.
- **pip installs:** use `pip install <pkg> --break-system-packages` if needed in any sandbox context.
- **Known minor open issues (not urgent, logged for awareness):**
  - Phase 4's acceptance test script (`test_clone_engine.py`) has an overly-broad `teardown()` that deletes ALL test shadows for a tenant, not just ones it created — already caused one accidental deletion of a real test shadow (no data lost, shadows are disposable, but worth tightening).
  - `suppress_outbound_email` field exists on the Tenant model (default True) but is NOT yet wired into the two real SMTP send call sites (`_smtp_send` in `approvals.py`, `_send_invitation_email` in `tenant.py`). Must be wired before connecting real SMTP in production — currently safe because dev has no SMTP configured (console-log fallback).
  - No UI yet for the `clone_data` toggle on "Create test environment" (backend supports it, defaults to `True`).

---

## 2. PROJECT OVERVIEW

**Ziva BI** is an enterprise-grade multi-tenant SaaS finance automation platform Adeniyi is building to compete with Sage X3 and Oracle. It serves both individual and business account types from one codebase (business tier is what's been built so far).

**Adeniyi Oladunmoye** — Chartered Accountant (ICAN, 2019), graduated Osun State University 2015 (Accounting, 2:1). Worked at Ernst & Young ~2 years. Currently **Chief Accountant at Red Bull Nigeria Limited**, transitioning to **Controller**. His Sage X3 experience at Red Bull directly shapes product/architecture decisions (he frequently compares Ziva's design choices to how Sage X3 or Oracle handle the same problem). Non-technical — does not write code. Plans UK relocation in Q4 2026.

**His broader personal goals** (for context on tone/register, not to be injected into unrelated technical answers): building Ziva BI toward financial independence/early retirement, remote work in foreign currency, raising his son Nathan to be multilingual/musical/sporty/spiritually grounded, improving public speaking and retentive memory, general self-improvement and discipline.

**Stack:**
- Frontend: Next.js 15, React, TailwindCSS
- Backend: Python/FastAPI, async SQLAlchemy + asyncpg
- Database: PostgreSQL (`ziva_dev`)
- File storage: Supabase Storage (bucket: `documents`)
- Auth: JWT
- Repo: `github.com/oladunmoyeadeniyi/ziva-bi` (branch: main)
- Supabase project: `https://qoshtcbdrudbxwrxlfgx.supabase.co`
- Deployment to Render is deferred (cost-pending) — not live yet, dev-only.

---

## 3. WORKFLOW RULES — NON-NEGOTIABLE

**The division of labor:** Claude (me) is the architect — reads real code, designs, writes detailed markdown briefs. **Claude Code (CC)**, running in Adeniyi's terminal, is the SOLE executor — implements, tests, reports back. Claude never writes code directly into the repo; everything goes through a brief.

**The loop:**
1. Claude writes a brief as a markdown file, saved to `/mnt/user-data/outputs/` and presented via `present_files`.
2. Adeniyi copies it to `docs/` in the repo.
3. Adeniyi sends CC a ONE-LINE command: `Read docs/BRIEF_xyz.md and follow it`.
4. CC executes, runs acceptance tests, and outputs a completion summary in the terminal.
5. Adeniyi pastes/uploads CC's output (often as a screenshot, since CC's terminal output sometimes garbles when copy-pasted into the chat — treat garbled completion summaries as legible-enough to extract pass/fail counts and key facts, don't ask Adeniyi to retype).
6. Claude reviews, confirms acceptance pass/fail, **logs the result into `docs/ZIVA_BI_HANDOVER.md`** (the long-form running log — append to the relevant section, don't rewrite the whole file), and tells Adeniyi the next action in plain, short language.

**Every brief MUST have:**
- A header line: `Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.`
- **STEP 0**: CC must read the ACTUAL current code/files first and report findings BEFORE making any change. No guesswork — if a brief assumes something about existing code, CC verifies it first.
- An explicit list of files CC is allowed to modify, and a "Do NOT touch" list.
- Numbered, concrete acceptance/test steps (state pass/fail for each).
- A "Completion summary required" section specifying exactly what CC must report back (so the report is verifiable, not just "done").

**CC terminal constraints:**
- Long instructions cannot be pasted directly into the CC terminal — if a needed instruction is long, ask Adeniyi to have CC WRITE results to a file in `docs/` (e.g. `docs/diagnosis_x.md`) which Adeniyi then uploads, rather than printing to terminal.
- Keep messages TO CC short — one line where possible; split into multiple short messages if needed.

**Communication style with Adeniyi (strict, repeatedly enforced this session):**
- **Very short messages. No unsolicited explanation.** Deliver: (a) the exact one-line text to send CC, (b) specific bullet actions for Adeniyi, (c) specific next steps. No preamble, no recaps unless asked.
- Use `ask_user_input_v0` for any design decision with discrete options BEFORE writing a brief — don't guess at product/UX choices.
- Investigate before designing: when a feature touches existing code/data whose actual shape is uncertain, write a READ-ONLY "investigate and report" brief first (STEP-0-only, no changes), get the report, THEN design. This was used repeatedly and successfully this session (currency split, promotion schema, clone schema) — don't skip this step for anything non-trivial.
- When something looks broken, get the ACTUAL error (status code, traceback, browser console/network tab) before proposing a fix. This session repeatedly caught CC guessing/theorizing (e.g., "stale CORS preflight cache") instead of finding the real cause (an unhandled 500 with `await db.refresh()` missing) — don't accept a theory without verification.

---

## 4. PORTAL AND ROLE ARCHITECTURE (locked decisions)

- **Three role tiers** (tenant-level, NOT platform-level): **Consultant** (Ziva's own implementation team; granted via super-admin only; full override) > **Power Admin** (client's FD/CFO; e.g. Adeniyi as Controller) > **Functional Admin** (HR/Procurement — scoped to their delegated area).
- **"Consultant" is a PLATFORM/super-admin capability, not a tenant role_tier** — resolved/clarified this session. Ziva staff configure client tenants by "entering" them via the Super Admin platform UI, not by being a tenant user with a consultant role.
- **`is_super_admin`** — Ziva's own platform owner/staff flag, separate from tenant role tiers entirely.
- **Two portals:**
  - **Platform/Owner portal** (`/platform/...`) — Super Admin only. Tenant list, tenant detail (enter/lifecycle/suspend/test-environment/promote), team & delegation, trials, billing, support, audit log.
  - **Business/Staff portal** (`/dashboard/business/...`) — tenant users. Setup/config nav only visible to admin tiers (power_admin or super_admin via impersonation — NOT plain `is_tenant_admin`, which was stripped of config access this session's predecessor work).
- **Tenant lifecycle states:** `trial` | `in_implementation` | `live` | `suspended`. Entering a tenant as Super Admin grants different access by lifecycle: `trial`/`in_implementation` → full edit ("implementation" mode); `live` → read-only/"support" mode by default (can still get full edit on that tenant's TEST shadow).
- **Tenant `environment` field:** `live` | `test`. A `test` tenant has `parent_tenant_id` pointing to its live parent. `switch-environment` lets a tenant user swap live↔test (reissues JWT).
- **Go-live (`POST /api/setup/go-live`)** now correctly transitions BOTH `tenant.is_active=True` AND `tenant.lifecycle_status="live"` atomically (this was a bug, fixed this session — see Section 7, Phase 1).

---

## 5. IMPLEMENTATION SETUP SEQUENCE (dependency order, as enforced by the Setup Dashboard)

The Setup Dashboard (`/dashboard/business/setup`) shows 12 sections with a completeness percentage; sections lock until prerequisites are met:

```
Organisation (REQUIRED, no prereq)
  → Module activation (REQUIRED, no prereq)
  → Dimensions (locked until Organisation complete)
  → Chart of Accounts (locked until Dimensions complete)
  → Currencies & FX (locked until Organisation complete)
  → Tax & statutory (locked until Organisation complete)
  → Employees (locked until Chart of Accounts complete)
  → Roles & permissions (locked until Employees complete)
  → Approval workflows (locked until Roles complete)
  → Document rules (locked until Module activation complete)
  → Module setup (locked until CoA AND Dimensions complete)
  → Go-live (locked until all blocking/required items complete)
```

**What "complete" means per section (exact checks, from `backend/app/routers/setup.py:350-584`):**
| Section | Completion check |
|---|---|
| Organisation | `tenant_org_config.legal_name` AND `.functional_currency` both non-null |
| Module activation | ≥1 `tenant_modules` row with `is_active=True` |
| Dimensions | `tenant_dimensions` row count > 0 (or tenant flagged not-applicable) |
| Chart of Accounts | `chart_of_accounts` row count > 0 |
| Employees | `employees` row count > 0 |
| Currencies & FX | `tenant_org_config.functional_currency` non-null |
| Tax & statutory | ≥1 of vat/wht/paye config set |
| Roles & permissions | ≥1 `user_tenants` row with `role_tier='power_admin'` |
| Approval workflows | ≥1 row in `approval_matrix` |
| Module setup | `tenant_expense_config` row exists |
| Document rules | `tenants.documents_setup_complete` flag |
| Go-live | composite of all required items |

**Lock check runs BEFORE complete check** — a section can have real underlying data and still show "locked" if an upstream prerequisite is incomplete. (This bit us this session — see Section 9.)

---

## 5a. PRIOR SESSIONS (before this chat) — what was already built, summarized from `docs/ZIVA_BI_HANDOVER.md`

This chat's work (Sections 7-11) builds on top of substantial prior work. Read this subsection so you don't re-discover or re-ask about things that already exist.

**M8.3 Period Management — COMPLETE (built across 5 prior briefs, all tested):**
- `AccountingPeriod` model (replaced old `FiscalPeriod`): state machine `FUTURE → OPEN → SOFT_CLOSED → OVERDUE → HARD_CLOSED`. Periods run independently; only CLOSING is sequential. Auto-soft-close on read (no scheduler). Registration-date floor enforced (no date anywhere in the system may be earlier than `tenant_org_config.date_of_registration` — a hard, app-wide floor every future milestone with date inputs inherits).
- `is_date_postable(tenant_id, target_date, db, user_id=, module=)` in `services/periods.py` — the reusable gate every posting engine calls (GL posting, and this session's expense→GL, already call it).
- Grace overrides (`PeriodGraceOverride`): tenant default (3 workdays) + per-module/per-role/per-user override rows. Workday math = weekends-only (no holiday calendar yet).
- Manual-journal block (`block_journal_into_open_prior` on `TenantOrgConfig`, default ON): blocks manual journals into a period while an earlier period isn't hard-closed.
- Future-dated exception (`FuturePostingException`): FUTURE periods hard-blocked by default; consultant or a granted role can post a logged future-dated exception.
- Close checklist (`CloseChecklistItem` + `PeriodChecklistCompletion`): preparer ≠ approver enforced server-side; gates hard-close.
- Year-end two-stage (`FiscalYearState`): Management close (Dec hard-closed → `AUDIT_PENDING`; retained-earnings roll-forward is currently a STATE-ONLY STUB, no actual GL postings — needs the GL engine, which now exists, so this stub is ready to be made real) → 3-month audit grace (`AUDIT_OVERDUE` flag on expiry, visual only) → Statutory close (`STATUTORY_CLOSED` = permanent lock; `is_date_postable` refuses any date in a statutory-closed year; reopen refused).
- Reopen (`PeriodAuditLog`): consultant-only, logged with reason.
- UI: `/dashboard/business/setup/periods`, 3 tabs (Fiscal year & periods / Grace overrides / Close checklist).
- **Open backlog from this milestone (briefed but not confirmed run — check status if relevant):** combine Organisation's two Save buttons into one; move fiscal-year definition fields from Period Management to Organisation; year-name-format preset dropdown; grace-override default-row edit control; consultant self-approve checklist override for solo testing.
- **Future milestone logged:** "Checklist v2" — replace free-text checklist items with system-wired reconciliations (each item links to a module + control GL, e.g. bank rec → bank GL) — depends on sub-ledger modules (now further along thanks to this session's GL/bank-account work) — revisit.
- **NOT yet tested end-to-end:** the full checklist prepare→approve→close loop, and the year-end strip (needs reaching a hard-closed December in real data).

**M9 — Owner/Platform Portal (mostly built prior to this chat, this chat's Section 7 work extends it):**
- `Tenant` model gained `environment`, `parent_tenant_id`, `lifecycle_status`, `test_data_retention_days` (M9.0, prior to this chat — this chat's Phases 1-4 completed what M9.0 left unfinished/unsurfaced).
- Owner portal UI at `/platform` — shell with section nav (Overview/Tenants/Team/Trials/Billing/Support/Audit). Overview = real metrics from tenant list. Tenants = real list+detail. Team/Trials/Billing = honest "coming soon" placeholders (these are M9.1b "delegated owner-staff access" and M9.4 "signup/trial provisioning" — both DESIGNED, NOT built).
- Super Admin account creation is via `backend/scripts/create_super_admin.py <email> <password>` — NOT signup (signup wrongly creates a tenant). Existing owner account: `admin@zivafinance.com`.
- `POST /platform/tenants/{id}/enter` mints an impersonation token; two modes by lifecycle (implementation=full edit, support=read-only on live, full edit available on that tenant's test shadow) — `block_if_readonly_impersonation` enforces this.
- Staff portal: ONE adaptive permission-driven portal design (NOT separate portals per role) — approved as a wireframe, NOT yet built. Waits on a real RBAC engine (also not built). "Finance" would just be a user with more granted permissions, not a separate app. Modules a user lacks access to are HIDDEN entirely (not greyed out). Builds AFTER GL/Expense are real (they now are — this is closer to being unblocked) alongside RBAC.
- Header overhaul: one shared `AppHeader` component, context-aware. DONE.
- Profile page redesign + sessions/2FA backend: DONE (`GET/DELETE /me/sessions`, `POST /me/sessions/revoke-others`, `pyotp`-based 2FA enroll/verify/disable). `totp_secret` at-rest encryption flagged as future hardening, not done.

**Account Determination Layer — original design rationale (prior to this chat; this chat's Section 7 describes the REDESIGNED catalogue that superseded this):**
- The very first catalogue (27 roles, 8 flat groups) used `expected_account_type` validation mapped against Red Bull's actual CoA, which uses IFRS statement names **`SOFP`/`SOCI`** (not generic `BS`/`PL`) — the determination validation handles this by mapping BS→{BS,SOFP}, PL→{PL,SOCI}. **Important standing fact: `account_classification` is entirely NULL on all 595 of Red Bull's uploaded CoA accounts** (never classified on upload) — this field is supposed to drive Tax Engine/AP/AR/Payroll/Fixed Assets/Reporting/FX per the original model comment, but is unpopulated. **Logged as a needed future feature: the CoA upload/template flow likely needs a classification step.** This is still true after this chat's catalogue redesign — not resolved, just not blocking yet because nature/classification validation is currently skipped wherever it would apply.
- The catalogue was redesigned (this chat, Section 7) into a statement→group→subgroup taxonomy, FX/per-class-fixed-asset roles removed, several roles added/changed — the OLD flat 8-group/27-role version described in this subsection is SUPERSEDED. Don't reference the old groups (Marketing & Advertising, Indirect/Overhead, etc. as PL groups) — current state per Section 7.

**Default-CoA feature (logged, NOT built, prior to this chat):** a system-default CoA template, platform-managed by Ziva Super Admin, with 3 adoption paths at tenant setup: (1) adopt Ziva's default, (2) upload own CoA Excel/CSV, (3) build from scratch (current behavior, only path that exists today). Separate milestone, sits in master data/setup, build after GL (GL now exists, so this is closer to ready).

**Roadmap spine (unchanged across all sessions):** Phase 1 (foundation: role wiring ✓, owner portal mostly ✓) → Phase 2 (GL/posting engine + OCR/AI engine — **GL is now built this chat**; OCR/AI engine for receipt capture is flagged elsewhere as core/required-for-v1 but NOT built, NOT touched this chat) → Phase 3 (make Expense + Tax real on the GL — **expense is now real this chat**; Tax not yet wired to GL) → Reporting (export + ERP integration is the locked v1 scope, not built) → Staff portal + RBAC → ship v1.

**Locked product-scope decisions from prior sessions (still in force):**
- Nigeria-first.
- v1 reporting = export + ERP integration (not built yet).
- Owner portal required before selling (mostly built).
- v1 = robust Expense + Tax on a shared core (Expense's GL wiring is now real; Tax module itself not yet built/wired).
- Every module must be standalone-sellable.
- The Expense module's north star: a configurable digital replication of Red Bull's actual expense retirement process (a real Excel template was the original reference), with email+Excel intake as a POST-v1 front door (not built).
- OCR/AI engine = core, required for v1, NOT built yet.
- Mobile+desktop must be equally good — a global principle; most existing screens still need a responsive retrofit for v1 (not done).

**Role-tier wiring (Phase 1a, prior to this chat):** `_require_admin` is tier-aware (consultant/power_admin pass, functional_admin excluded, `is_tenant_admin` kept but doesn't grant config access — see this chat's Section 4). Repeatable tier-setter script: `python scripts/set_role_tier.py <email> <tier>` (run from `backend/`). Adeniyi's own Red Bull account (`adeniyi.oladunmoye@redbull.com`) is set to `consultant` tier. **Role-tier changes require the user to log out and back in for the JWT to pick it up** — this bit Adeniyi before, worth remembering if a role change doesn't seem to take effect.

---

## 6. REPO FILE STRUCTURE — KEY FILES AND PURPOSE

**Backend (`backend/app/`):**
- `models/gl.py` — `JournalEntry`, `JournalLine` (the GL engine core).
- `services/gl_posting.py` — `post_journal(db, tenant_id, *, entry_date, description, source, source_reference, lines, created_by, module=, status=)` — the SOLE posting entry point every module must call. `PostingError` exception.
- `services/gl_reporting.py` — `trial_balance()`, `account_ledger()` (read-only reporting).
- `services/periods.py` — `is_date_postable(tenant_id, target_date, db, user_id=, module=)` — the period-gate every posting call goes through.
- `services/account_determination.py` — `resolve_account(db, tenant_id, role_key)` → GL account UUID or raises `AccountMappingError`. The role→GL resolver.
- `services/expense_posting.py` — `post_expense_to_gl(db, tenant_id, report, created_by)` — wires expense approval to GL posting.
- `services/promotion_engine.py` — Phase 3a: test→live diff/apply engine for CoA/Dimensions/etc (repeatable, natural-key matched).
- `services/tenant_clone.py` — Phase 4: live→test clone-on-create engine (one-directional, one-time per creation). Contains `_ORG_COPY_FIELDS` (29 fields, shared with `promote()`).
- `models/account_mapping.py` — `PostingRole` (the system catalogue, role_key PK), `TenantAccountMapping` (tenant's role→GL bindings), `TenantPostingRoleSettings` (per-tenant control-account override + relevance/hide flags — both COSMETIC, never gate posting).
- `models/bank_account.py` — `BankAccount` (multi-account-per-currency register).
- `models/expenses.py` — `ExpenseReport`, `ExpenseLine` (has both legacy `gl_account` string AND structured `gl_id` FK — use `gl_id`), `TenantExpenseConfig`, `ExpenseCategory`, `ExpenseReportSnapshot`.
- `models/approvals.py` — `ApprovalMatrix` (one per tenant, levels 1-3, role labels, amount thresholds), `ExpenseApproval` (per report×level).
- `models/master_data.py` — `ChartOfAccount`, `Employee` (has `cost_center_id`→DimensionValue, `line_manager_id`→self), `CostCenterConfig` (`cost_center_id`→DimensionValue, `head_employee_id`→Employee, `head_user_id`→Users — global, no remap needed), `TenantDimension`, `DimensionValue` (has self-ref `cascade_value_id`), `GLDimensionRequirement`.
- `models/setup.py` — `TenantOrgConfig` (SOLE source of truth for `functional_currency` + `enabled_currencies` JSONB — see Section 9), `TenantFxConfig` (ONLY `fx_rates` + `revaluation_rules` now), `AccountingPeriod`, `FiscalYearState`.
- `routers/hr.py` — employees + cost-centers endpoints (`/api/hr/employees`, `/api/hr/cost-centers`).
- `routers/approvals.py` — the approval workflow; final approval (`report.status = "APPROVED"`) happens at the single `else:` branch around line 977 — this is the ONLY place that status is set (verified by grep), refer-back never independently finalizes.
- `routers/account_mapping.py` — `/api/setup/account-mapping` (GET /roles, PUT/{role_key}, DELETE, PUT/{role_key}/control, PUT/{role_key}/relevance).
- `routers/bank_accounts.py` — `/api/setup/bank-accounts` CRUD.
- `routers/tenant.py` — `create_test_environment`, `switch_environment`, `promote` (test→live config-only: org_config/tax/fx).
- `routers/platform.py` — Super Admin endpoints: tenant list/detail/lifecycle/suspend, `enter_tenant`, plus 2 proxy endpoints added this session for `test-environment` and `promote` (Super Admin can't call tenant-router endpoints directly — no tenant context — so these proxies inline the same logic), plus `promotion/diff` and `promotion/apply` proxies for Phase 3a/3b.
- `models/__init__.py` — all models must be registered here.

**Frontend (`frontend/src/`):**
- `lib/currencies.ts` — shared `ISO_CURRENCIES` array + `getCurrencyLabel(code)` helper (extracted this session to kill duplication).
- `app/dashboard/business/setup/account-mapping/page.tsx` — nested collapsible BS/PL→group→subgroup→role mapping UI.
- `app/dashboard/business/setup/bank-accounts/page.tsx` — bank account register UI.
- `app/dashboard/business/setup/page.tsx` — the Setup Dashboard (12-section grid).
- `app/dashboard/business/settings/employees/page.tsx` — employees (4 tabs: Add employees / Employee list / Transfers & changes / Code config). **THIS IS WHAT WE WERE ABOUT TO WORK ON** — see Section 11.
- `app/dashboard/business/settings/cost-centers/page.tsx` — cost center head assignment.
- `app/platform/tenants/[id]/page.tsx` — Super Admin tenant detail (enter/lifecycle/suspend/test-environment/promote/promotion-review, all built this session).
- `components/PromotionReviewDialog.tsx` — Phase 3b diff review modal (CREATE green/UPDATE amber/DEACTIVATE red, collapsible by entity type).

**Docs (`docs/` in the repo):**
- `MASTER_CONTEXT.md`, `ZIVA_BI_ROADMAP.md` — read by every brief's header line.
- `ZIVA_BI_HANDOVER.md` — the long-form chronological working log Claude maintains across sessions (NOT this document — that one is denser/older-format).
- `TEST_TENANT.md` — documents the dedicated test tenant (see Section 9).

---

## 7. FULL MILESTONE STATUS

### ✅ COMPLETE (this session and just prior)

**GL Engine (posting core):**
- Journal model + central posting service (`post_journal`) — header+balanced lines, immutable once POSTED, dimensions per line (JSONB), reversal fields schema-ready (logic not built).
- Trial balance + account ledger reporting (`gl_reporting.py`).
- Re-verified against a real OPEN period (Jan 2027 via M8.3 grace window) — confirmed trustworthy, not just unit-tested.

**Account Determination Layer:**
- `PostingRole` catalogue (statement→group→subgroup→role taxonomy), `TenantAccountMapping`, `TenantPostingRoleSettings` (control override + relevance, both per-tenant, both cosmetic-only for relevance).
- Catalogue cleaned: removed `default_bank`/`cash` (now Bank Accounts register), added `goods_in_transit`. ~24 roles, all genuinely system-determined (the design test applied: "does the system post here without a human choosing the account?").
- Account Mapping UI: nested collapsible, z-index bug fixed, control toggle (super-admin only).
- **Determination principle locked:** roles are ONLY for postings the SYSTEM generates automatically. User-picked-per-line GLs are NOT roles. Revenue/returns will be CATEGORY-KEYED determination (not flat roles) — logged for the future AR/Sales module, NOT built yet (see Section 10).

**Bank Accounts Register:**
- Multi-account-per-currency, GL may be shared or unique per tenant's choice, default-per-currency enforced in app logic, `bank_account_id` tag added to `JournalLine` for future per-account reconciliation (reconciliation tooling itself NOT built — future module).
- Fixed: currency dropdown only showed NGN (root cause was the currency split — see below). Fixed: PUT/update threw "Failed to fetch" (root cause: `MissingGreenlet` from reading an expired `updated_at` after an UPDATE with no RETURNING clause — fixed with `await db.refresh(acct)`; ALSO fixed: the 500 reached the browser without CORS headers because temp debug middleware sat outside CORSMiddleware, masquerading as a CORS error — removing the temp middleware fixed both).

**Currency Single-Source-of-Truth (data-integrity fix):**
- `tenant_org_config` is now the SOLE source for `functional_currency` + `enabled_currencies` (JSONB list of ISO codes). `tenant_fx_config` stripped to ONLY `fx_rates` + `revaluation_rules`. Migration merged 4 previously-disagreeing sources so no tenant lost a currency.
- **Standing principle Adeniyi stated explicitly and repeatedly: "One source of truth for any and all things in the system."** Apply this test to every future design decision.

**HR Relationships Bug (pre-existing, unrelated to currency work):**
- `Employee.cost_center`, `Employee.line_manager`, `CostCenterConfig.cost_center/head_employee/head_user` — these `relationship()` declarations were missing (only FK columns existed), causing `selectinload()` 500s on Employees/Cost-Centers pages. Fixed, Python-only, no migration.

**Expense → GL Posting (3a) — THE CORE MILESTONE:**
- `post_expense_to_gl()` fires on final approval (the single confirmed `else:` branch in `approvals.py`), BEFORE `report.status="APPROVED"` is set (so a posting failure never even transiently marks approved).
- Validates: every line has `gl_id` (else blocks — 422, no silent skip); Σ line amounts == `report.total_amount` (clear pre-check before post_journal's generic balance error); resolves `employee_payable` via determination layer (unmapped → blocks).
- Builds: Dr each expense line's GL+dimensions / Cr `employee_payable`. Posts via `post_journal` (`source="expense"`, `source_reference=report_number`, `module="expense"`).
- Split-line parents excluded (only leaf lines post — avoids double-counting).
- Same-transaction safety: `get_db()` rolls back on any exception — posting failure fully reverts the approval too. No partial state ever.
- New `EXPENSE_GL_POSTED` audit log entry carries the journal reference.
- **No WHT in this version** (deliberate — WHT-at-payment is the locked design for later AP work, not expense).
- **Known follow-up, not done:** journal_reference not yet surfaced on `ExpenseReportResponse` (needs a schema/migration change, deferred).

**Tenant Implementation→Live Promotion (4-phase feature, fully built):**
- **Phase 1:** `go-live` now atomically sets BOTH `is_active=True` and `lifecycle_status="live"` (previously only set `is_active`, leaving lifecycle stuck — a real bug). Unified audit event `"platform.lifecycle.updated"` with `via: "go_live"` metadata.
- **Phase 2:** Super Admin UI surfacing the previously-buttonless `create-test-environment` and `promote` (org_config/tax/fx only) endpoints. Two thin proxy endpoints added on `platform.py` (Super Admin's platform session has no tenant context, so existing tenant-router guards can't be satisfied directly — proxies inline the same logic rather than crafting fake `CurrentUser` objects). Per-section checkboxes (org_config/tax/fx) kept granular rather than one "promote all" button.
- **Phase 3a:** Backend diff+apply engine for CoA/Dimensions/DimensionValues/GLDimensionRequirement/TenantAccountMapping promotion (test→live, REPEATABLE — Adeniyi's explicit requirement: "promotion can't be one-time... test environment is to configure and/or reconfigure... promote configurations and/or master data update to live once tested and satisfied"). Natural-key matching (NOT a persistent ID-map table): CoA by `gl_number`, dimensions by `code`, dim values by `(dim_code, val_code)`, account mappings by `role_key`. Two-pass insert for `DimensionValue.cascade_value_id` (self-referential FK). `apply_promotion` RECOMPUTES the diff server-side from `accepted_item_ids` — never trusts a client-supplied diff. All-or-nothing per apply call.
- **Phase 3b:** Review UI (`PromotionReviewDialog.tsx`) — grouped by entity type, collapsible, CREATE green/UPDATE amber-with-field-diff/DEACTIVATE red, per-item + per-section + global accept, sends an explicit `Set` of accepted IDs (never a blind "accept all" flag).
- **Phase 4:** Clone-on-create engine (`tenant_clone.py`) — when creating a NEW test shadow, clone live's CURRENT state into it by default (`clone_data: bool = True` param; toggle exists in the API, NOT yet in the UI). One-directional, one-time-per-creation (not repeatable like 3a — there's nothing to diff since test starts empty). 9-step dependency chain: TenantDimension → ChartOfAccount → DimensionValue (2-pass) → GLDimensionRequirement → TenantAccountMapping → BankAccount → Employee (2-pass, self-ref `line_manager_id`) → CostCenterConfig (`head_user_id` copied VERBATIM — Users are global, already mirrored, zero remap) → FinanceReviewConfig. Real verified run: **4,337 rows cloned from live Red Bull → test shadow in ~2 seconds.**
  - **Follow-up fix needed and DONE:** initial clone only copied master-data tables, not the setup-completion GATE tables (`tenant_org_config`, `tenant_modules`, `approval_matrix`) — so a perfectly-cloned shadow showed "0 of 12 sections complete" even with 4,337 real rows present (lock-check runs before complete-check; `org_complete=False` cascades to lock 8+ sections). Fixed: added Steps 10-12 to clone the 3 gate tables too. Now a fresh clone shows the TRUE state — currently 5/12 (42%) for Red Bull, and every remaining gap maps to a REAL gap on live itself (0 employees, no tax config, no expense config, no document rules) — not a cloning artifact.

**Test Data Hygiene (process fix):**
- 3a's acceptance tests had run directly against LIVE Red Bull (creating 28 real expense reports + 6 real posted journals as pollution). Cleaned up (verified: 0 expense_reports, 0 journal_entries left on Red Bull after cleanup, cascades clean, audit log preserved as historical record, other tenants untouched).
- **Standing rule now in force:** ALL future acceptance/script tests that perform real writes MUST use the dedicated test tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` ("Ziva BI — Test Tenant"), documented in `docs/TEST_TENANT.md`. This is a Ziva-INTERNAL engineering fixture, distinct from per-CLIENT test shadows (Red Bull's own `environment=test` shadow under Phase 1-4 above) — they serve different audiences and Adeniyi explicitly confirmed both should coexist.

### 🟡 IN PROGRESS (where we stopped — see Section 11 for exact next step)

**Employee management improvements** — Adeniyi gave detailed feedback after a live walkthrough attempt (see Section 8 for the full decision list). We had JUST started this when the chat hit Claude's 100-file upload limit. No brief has been written yet. This is the very next thing to do.

### ⬜ NOT YET DONE / EXPLICITLY DEFERRED

- **Live walkthrough of expense→GL** (submit real expense, approve through every level, confirm journal posts) — this was the ORIGINAL goal that triggered the whole promotion/clone architecture work. Still pending — blocked on having employees + cost centers + approval matrix properly set up (which is what Section 11's brief will enable).
- **Revenue/returns category-keyed determination** for the future AR/Sales module (logged, not built — needs price lists/customer categories/sales types which don't exist yet).
- **Period rows are explicitly NOT cloned/promoted** (deliberate, simplest-correct design: org_config carries the structure, live just re-runs the existing "Generate periods" action — no new remap logic needed).
- `suppress_outbound_email` wiring into the 2 real SMTP call sites (see Section 1).
- Clone-toggle UI + email-suppression-toggle UI (backend-ready, no frontend yet).
- Scoping Phase 4's test teardown to not delete other shadows.

---

## 8. EVERY PRODUCT/ACCOUNTING DESIGN DECISION MADE THIS SESSION (locked, with rationale; what was ruled out)

1. **Account determination roles = system-posted only.** Test: "does the system post here without a human choosing the account?" Ruled OUT: treating revenue as a flat role (it's category-keyed, belongs in AR/Sales, not here).
2. **Bank accounts ≠ determination roles.** Removed `default_bank`/`cash` from the role catalogue; built a proper multi-account-per-currency register instead. Each journal line can tag a specific `bank_account_id` so reconciliation works per-account even when multiple accounts share one GL (Adeniyi: "...each bank account nested inside the GL can be spooled and reconciled... set the particular bank account the money was credited or debited"). GL may be shared OR unique per bank account — tenant's choice, not enforced either way.
3. **Per-tenant role relevance = hide/show only, COSMETIC, never gates posting.** Ruled OUT: free add/remove of catalogue roles by Super Admin (too risky — module code relies on role_key existing). Chosen instead: a stable system catalogue + per-tenant `is_relevant` override.
4. **Single source of truth — Adeniyi's standing principle, stated explicitly, applies everywhere going forward:** "I think it is also better... ensure we only have one source of truth for any and all things in the system so that we avoid issues during deployment and when the system is live for active use." Applied this session to currency (functional_currency/enabled_currencies — `tenant_org_config` is sole source). Apply this test to every future schema/feature decision.
5. **Expense posting: synchronous, same-transaction.** Adeniyi confirmed explicitly after Claude explained the tradeoff: "Yes — same transaction, approval fails if posting fails." Ruled OUT: decoupled/async posting (risk of an approved report with no GL entry — "a reconciliation nightmare").
6. **Block posting if any expense line lacks gl_id.** Adeniyi: "Block: raise an error, approval fails until Finance completes GL coding." Ruled OUT: silently skipping uncoded lines, or posting to a suspense/clearing account for them.
7. **No WHT in expense→GL** (current design — WHT-at-payment is the locked AP-module design, separate, not built here).
8. **Periods are NOT promoted/cloned as rows.** Org_config (already promoted/cloned) carries the structure; live re-runs the existing "Generate periods" action. Ruled OUT: building FK-remap logic for period rows (genuinely the hardest case, deliberately avoided by reusing existing simpler machinery).
9. **Test→live promotion (Phase 3) is REPEATABLE, not one-time.** Adeniyi was explicit and detailed: "Promotion can't be a one-time promotion because the test environment is to configure and/or reconfigure the system and test use cases... before it is promoted to live... It is not meant to transfer test transactions from test to live. It is just to promote configurations and/or reconfigurations and master data... once it is tested and satisfied." This single statement drove the entire diff/apply (not simple-clone) design of Phase 3a.
10. **Matching strategy for promotion = natural keys, NOT a persistent ID-mapping table.** Confirmed safe via direct schema investigation (gl_number, dimension codes, etc. are reliably unique per tenant via partial-unique indexes on active rows).
11. **Promotion requires a review/diff screen before any write — never a blind "promote" button** for CoA/Dimensions (unlike the simpler org/tax/fx promote, which IS a blind copy). Adeniyi: "I would expect a confirmation page... where the current state of live and the new update... will be side by side and individually can be accepted/confirmed... and accept all button for all to be confirmed." Deactivations in test DO propagate to live on next promotion, but only via this reviewed path, never silently.
12. **Deactivation propagates on promotion** (if deactivated in test, next promote deactivates in live too) — but ONLY through the reviewed diff, per #11.
13. **Two distinct "test tenant" concepts coexist, deliberately:** (a) Ziva-internal engineering/QA fixture (the standalone "Ziva BI — Test Tenant") for CC's own script tests — never client-facing; (b) per-CLIENT implementation/rehearsal shadow (Red Bull's own `environment=test` tenant via `parent_tenant_id`) — for the CLIENT's own implementation team to rehearse. Adeniyi confirmed explicitly both should exist for different audiences.
14. **Clone-on-create defaults to ON, with an opt-out toggle.** Adeniyi: "let there be a toggle button to disable/enable snapshot/clone on click of create test environment. Let snapshot/clone be as default." (UI toggle not yet built — backend param exists.)
15. **Clone scope = EVERYTHING, not just accounting config.** Adeniyi explicitly expanded scope beyond CoA/dimensions to include Bank Accounts, Employees, Cost Centers ("Everything including bank accounts, employees, cost centers too") — this is why Phase 4 became a 9-step engine instead of reusing Phase 3a's 5 entities directly.
16. **`FinanceReviewConfig` included in the clone** (Adeniyi: "Include FinanceReviewConfig in Phase 4, one more simple step").
17. **Real-email-in-test risk:** suppress outbound emails by default in test environments, with a toggle to allow real sending, available ONLY within the test environment context. (Schema-ready field added; wiring into actual send sites is still pending — see Section 1.)
18. **All acceptance/script tests with real writes go to the dedicated test tenant, never live Red Bull** — established as a hard standing rule after 3a's tests polluted live data (28 expense reports + 6 journals, since cleaned up).

---

## 9. CURRENT TESTING STATUS

**Fully tested and verified (via CC's scripted acceptance tests, with specific results, NOT just "passed"):**
- GL posting core: 10/11 + 5/6 against a real OPEN period (the 2 "skips" were a data-seeding gap in dimension values, not a code failure — code paths proven elsewhere).
- Account determination layer: 7/7.
- Account mapping UI rework: 7/7.
- Catalogue cleanup + relevance: 6/6.
- Bank accounts register: 7/7. Bank currency dropdown fix: 4/4. Bank PUT 500 fix: 7/8 (1 untested-but-implied-pass).
- Currency single-source-of-truth: 7/7.
- HR relationships fix: 5/5.
- Expense→GL posting (3a): **22/22**, with real journal numbers verified (JE-2027-000005, JE-2027-000006, etc., debit=credit balanced, multi-line, split-line exclusion confirmed, refer-back-never-finalizes confirmed).
- Test data cleanup: 6/6.
- Phase 1 (go-live↔lifecycle): 6/6.
- Phase 2 (promotion UI): 6/6.
- Phase 3a (diff+apply engine): **36/36** — including verified 2-pass cascade resolution and confirmed server-side recompute (never trusts client diff).
- Phase 3b (review UI): 8/8.
- Phase 4 (clone engine): **24/24**, real run = 4,337 rows cloned in ~2s.
- Clone completeness fix: 21/21, real run = org_config(1)+modules(3)+approval_matrix(1) = 4,342 total rows; fresh clone now shows 5/12 (42%) matching live's TRUE state exactly.

**NOT yet tested (pending, this is literally the next milestone):**
- The full live UI walkthrough: submit a real expense as an employee → approve through every level as the right approvers → confirm it lands APPROVED with a real GL journal, visible via Trial Balance. This requires employees/cost-centers/approval-matrix to be properly set up first (blocked on Section 11's work).

---

## 10. ITEMS LOGGED FOR FUTURE MILESTONES (with context, not yet briefed)

- **AR/Sales module — revenue + returns category-keyed determination.** Revenue is NEVER manually keyed; on invoice approval the system auto-posts revenue by category (export/domestic/IC/etc.) via a `(tenant, determination_type, category_value) → GL` rule, driven by price lists/customer categories/sales types — none of which exist yet. Customer returns post similarly to a category-driven returns GL (distinct from revenue). COGS/inventory/damages post via the inventory module (also not built).
- **UI Polish milestone (standing, batch-only — never fix page-by-page):** URL state persistence (tab/filter survives refresh) — pattern proven (seed from `useSearchParams` at mount, `router.replace` on change), needs applying consistently across all pages as one batched milestone.
- **Dimension value active-years** (deferred until after period management's year-end-close trigger exists) and **yearly recurring IO template system** (e.g. "MKT" auto-generating MKT_2024, MKT_2025...) — both designed at a high level previously, not built, both depend on the period year-open/year-close event.
- **Reconciliation tooling** for bank accounts — the `bank_account_id` tag on journal lines is ready for this, but the actual reconciliation UI/workflow is a future module.
- **Bank charges / discount_allowed / discount_received / wht_expense / vat_irrecoverable** roles — explicitly deferred until the AP/AR/bank modules that would auto-post them actually exist.

---

## 11. IMMEDIATE NEXT STEPS (exact order)

**This is exactly where we stopped.** Adeniyi did a live walkthrough attempt and gave this feedback (his exact points):

> "Since we have the organisation structure set up under 'organisation', we need to ensure the cost centres in 'organisation' are properly wired up here [employees]. There should not be the ability to create a new cost centre outside the ones in the organisation structure.
> In the bulk employee template, I believe it is best that the cost centre column have a dropdown option of the cost centre codes from the organisation. It shouldn't be a free text input.
> Likewise, the cost centre input field in the 'Send self-onboarding invite' form.
> Additionally, I think the batch-up template should also include a column for head of cost centre with just a dropdown option to indicate the head, and if it's blank, then it means not head.
> Also, I don't think it is necessary for the cost centre tab under people in the left sidebar to be a standalone... unless you believe it is needed with good reason.
> Also note that similar to CoA, the bulk-uploaded employee should [be] deletable, replaceable with updated master data or updatable with additional data and filterable and sortable with different criteria."

**Decisions already locked in discussion (don't re-ask):**
- Cost Centers page STAYS standalone (for head-overview/assignment) **AND** a head-of-cost-center column is ALSO added to the bulk employee template as a convenience. Both, not either/or.
- The bulk template's cost-center dropdown must be backed by SERVER-SIDE VALIDATION on upload (reject/flag unrecognized codes) — not just an Excel convenience dropdown with no enforcement.

**What still needs deciding/designing (not yet done):**
- How the "head of cost center" column in the bulk upload resolves — Claude flagged this needs a second pass (can't mark someone head before they're created), needs confirming with Adeniyi whether that's the intended behavior.
- Exact scope of "deletable/replaceable/updatable/filterable/sortable" for bulk-uploaded employees — needs the actual current Employee List tab code reviewed before scoping a brief (was about to ask Adeniyi to upload it when the file limit hit).

**Exact next action for the new Claude session:**
1. Ask Adeniyi to upload `backend/app/routers/hr.py` (the employees + cost-centers endpoints, including the bulk upload/template/self-onboarding logic) and the employees frontend page (`frontend/src/app/dashboard/business/settings/employees/page.tsx` or wherever it actually lives — confirm path).
2. Read both files, do NOT guess at the current implementation.
3. Confirm the head-of-cost-center two-pass question with Adeniyi via `ask_user_input_v0` if still ambiguous.
4. Write ONE comprehensive brief (or split if STEP 0 reveals more complexity than expected) covering: (a) cost-center fields in self-onboarding form + bulk template become dropdowns sourced from real Organisation dimension values, with server-side validation on upload; (b) head-of-cost-center column in bulk template, two-pass resolution; (c) Employee List tab gains delete/replace/update/filter/sort, matching the CoA page's existing UX pattern (look at the CoA page for the pattern to match).
5. After that lands: set up Red Bull's real employees + cost centers + approval matrix (on the test shadow, which is now fully cloned per Phase 4) for the genuine live walkthrough.
6. Then: submit a real expense, approve it through every level, confirm GL posting — closing the loop that started this entire promotion/clone architecture detour.

---

## 12. NATHAN'S DEVELOPMENT PLAN

Not discussed in this session at all. If it comes up, Claude's memory system (separate from this document) already holds the full context: Nathan born 31/03/2025, daily-plan system (ask day type: crèche/WFH/weekend/holiday → deliver activities/games/food/learning/language/music/sport/faith/character), multilingual (English/Yoruba/French/Mandarin) + guitar + basketball goals, currently SMA Gold 3 formula + multigrain pap (since month 6), fully walking, no allergies, family relocating to UK in 2026. No need to repeat this in a fresh chat unless Adeniyi raises it — memory carries it automatically.

---

## 13. KEY REMINDERS — things Adeniyi corrected Claude on this session; do not repeat these mistakes

1. **Don't accept a vague error theory without proof.** Multiple times this session Claude/CC proposed plausible-sounding causes ("stale CORS preflight cache", "restart the dev server") that turned out wrong. The fix every time was getting the ACTUAL browser DevTools Network tab status code or the actual server traceback. When something is broken, ask for the real evidence before proposing a fix.
2. **Don't assume — investigate first when touching existing/uncertain code.** Adeniyi pushed back implicitly by asking good clarifying questions every time Claude designed before checking; the pattern that worked was: write a read-only "investigate and report" brief, get real findings, THEN design. Do this for any non-trivial feature touching existing data/code.
3. **Keep messages short.** Adeniyi's explicit standing instruction (also in his saved preferences): very short messages, no preamble, no recaps, exact CC text + bullet actions + next steps only.
4. **One source of truth, always.** Adeniyi raised this as a CRITICAL go-live principle unprompted, after spotting a real currency-data split. Apply this lens proactively to any new schema/feature design — ask "could this fact end up stored in two places?" before building.
5. **CC's terminal output frequently arrives garbled/truncated** when pasted into chat (column borders broken, words run together, occasionally a session-limit interruption mid-summary). This is normal — extract pass/fail counts and key facts from what's legible; don't ask Adeniyi to retype CC's output cleanly.
6. **Long CC instructions don't fit in the terminal.** When an instruction is long, have CC WRITE findings to a `docs/*.md` file instead of printing to terminal, and have Adeniyi upload that file.
7. **Test tenant discipline matters and was violated once already** (3a's tests hit live Red Bull, requiring cleanup). Every future brief involving real-write tests must explicitly specify the test tenant ID `f2aecfab-025f-410f-a7f6-df923172c8a1`.
8. **Don't conflate the two "test tenant" concepts** (Ziva-internal engineering fixture vs. per-client implementation shadow) — Adeniyi caught Claude/CC doing exactly this once; keep them clearly separate in any future discussion.
9. **Always confirm a migration was actually APPLIED, not just written** — this caused a full afternoon of cascading 500s earlier in this session (model had a column, DB didn't, until `alembic upgrade head` actually ran).
10. **Adeniyi reads the UI carefully and notices real discrepancies** (e.g., "the test shadow doesn't have current live data," "I see the same expense list for two employees," "I don't see where to toggle off the clone") — when he flags something, investigate it as a real signal, not user confusion, until proven otherwise. Every such flag this session turned out to be a genuine gap or bug.
