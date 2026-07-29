# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Core Documents (read these first, every session)

| Document | Purpose |
|---|---|
| `docs/MASTER_CONTEXT.md` | Single source of truth — owner, vision, stack, status. **Wins all conflicts.** |
| `docs/MASTER_INSTRUCTION.md` | The rulebook — coding standards, workflow, what not to do |
| `docs/MASTER_SYSTEM_SUMMARY.md` | Architecture reference — modules, deployment, DB design |

Always read all three before coding anything. Update `MASTER_CONTEXT.md` after every completed milestone.

## Cowork ↔ Claude Code Workflow

Ziva BI uses two AI agents with distinct roles:

| Agent | Role |
|---|---|
| **Cowork** (desktop) | Writes all code, creates migrations, builds frontend components |
| **Claude Code (CC)** | Reviews Cowork's output, runs checks, commits and pushes to GitHub |

### How to trigger a CC review + commit

After Cowork finishes a task it writes `docs/PENDING_COMMIT.md` with the intent,
changed files, what to verify, and the suggested commit message.

In your CC terminal, type:
```
/review-commit
```

CC will read `docs/PENDING_COMMIT.md`, read every changed file, run `py_compile`
and `tsc --noEmit`, verify the code matches the stated intent, then commit and push
— or report what is wrong without committing.

**After every successful commit, CC must also run:**
```bash
cd backend && alembic upgrade head
```
This applies migration changes to the local database. CC should run this unconditionally
after every commit — even if no migration files were changed (it is idempotent). Log the
output (including "Already up to date" confirmation) in `docs/CC_RESULT.md`.

### Rules
- **Cowork never commits directly** — it only writes code and PENDING_COMMIT.md
- **CC never writes feature code** — it only reviews, checks, and commits
- If CC flags a problem, Cowork fixes it; CC re-reviews on the next `/review-commit`
- `docs/PENDING_COMMIT.md` is deleted by CC after a successful commit (it is stale once pushed)
- **After every successful commit:** run `alembic upgrade head` and log the result

### CC Autonomy Rule — CRITICAL
**CC must never pause mid-task to ask the user yes/no questions or confirmation prompts.**
The user cannot stay at the keyboard during a review. CC must:
- Make all judgment calls itself
- Use `--yes` / `-y` on any tool that prompts for confirmation
- If a genuine blocker is encountered (e.g. compile error CC cannot fix itself), log it clearly in `docs/CC_RESULT.md` and stop — do NOT wait for input
- Write a complete `docs/CC_RESULT.md` at the end of every run whether the commit passed or failed
- The user's only interaction is typing `/review-commit` and reading CC_RESULT.md when done


## Repository Structure

```
ziva-bi/                       ← monorepo root
├── frontend/                  ← Next.js 15 (App Router) + TailwindCSS + ShadCN UI
│   ├── src/app/               ← pages and layouts (App Router)
│   ├── src/components/        ← shared UI components
│   ├── src/lib/               ← utility functions
│   ├── Dockerfile             ← multi-stage build for Render
│   └── .env.example           ← required env vars for local dev
├── backend/                   ← Python 3.12 + FastAPI
│   ├── app/
│   │   ├── main.py            ← FastAPI app, middleware, router registration
│   │   ├── config.py          ← pydantic-settings — all env var config
│   │   ├── database.py        ← async SQLAlchemy engine + session factory
│   │   ├── middleware/        ← custom middleware (auth, logging, tenant scoping)
│   │   ├── models/            ← SQLAlchemy ORM models (one file per module)
│   │   ├── routers/           ← FastAPI routers (one file per module)
│   │   └── schemas/           ← Pydantic request/response schemas
│   ├── alembic/               ← database migrations
│   ├── Dockerfile             ← Render-optimised container
│   ├── requirements.txt       ← Python dependencies
│   └── .env.example           ← required env vars for local dev
├── docs/                      ← PRDs, ADRs, master documents (markdown only)
│   └── adr/                   ← Architecture Decision Records
├── render.yaml                ← Render deployment config (infra-as-code)
├── .gitignore
└── CLAUDE.md                  ← this file
```

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 + React 19 + TailwindCSS v4 + ShadCN UI |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL (Render managed) via SQLAlchemy async + Alembic |
| Auth | JWT (access + refresh tokens) |
| File Storage | Supabase Storage (bucket: `documents`, private). Config via `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET`. |
| Deployment | Render (GitHub → auto-deploy pipeline) |
| PWA | Enabled (mobile-first for individuals) |

## Build & Run Commands

### Backend (local dev)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                               # fill in DATABASE_URL etc.
uvicorn app.main:app --reload --port 8000
```

### Frontend (local dev)
```bash
cd frontend
cp .env.example .env.local                         # set NEXT_PUBLIC_API_URL
npm install
npm run dev
```

### Database migrations
```bash
cd backend
alembic revision --autogenerate -m "description"  # generate a new migration
alembic upgrade head                               # apply all pending migrations
```

### Type-checking & linting
```bash
# Frontend
npm run type-check
npm run lint

# Backend (install ruff and mypy via pip if needed)
ruff check app/
```

## Coding Standards (non-negotiable)

1. **Every Python file needs a module-level docstring** explaining what it does, why it exists, and how it connects to the rest of the system.
2. **Every function/class needs a docstring** — purpose, parameters, return value, example if non-obvious.
3. **Type hints everywhere** — TypeScript strict mode on frontend; Pydantic + Python type hints on backend.
4. **No secrets in code** — all config comes from environment variables via `app/config.py`.
5. **Migrations via Alembic only** — never edit the database directly.
6. **Every milestone ends with a commit + push** — work that isn't on GitHub doesn't exist.

## Milestone Status

> **Authoritative as of 2026-07-24.** Reconciled against live codebase and git log (270+ commits). Full narrative detail: `docs/MASTER_CONTEXT.md` §5. Update this table AND §5 of MASTER_CONTEXT.md every time a milestone ships.
>
> **Overall completion: ~45% of full product vision. ~98% of MVP-for-first-customer (all TIER 0 + TIER 1 done; product is live on Render).**

### ✅ COMPLETED (ordered chronologically)

| # | Milestone | Commit / Notes |
|---|---|---|
| M1 | Foundation (Next.js + FastAPI + PostgreSQL, monorepo structure) | Initial |
| M2 | Auth & User Management (signup, login, JWT, roles, invite flow) | |
| M3 | Business Expense Submission (multi-line reports, DRAFT→SUBMITTED) | |
| M4 | Approval Workflow (matrix, multi-level approve/reject) | |
| M4+ | Approval Enhancements (refer-back, audit trail, immutable snapshots, SOD) | |
| M5 | Tenant User Management (invite, roles, deactivate) | |
| M6 | Supporting Documents (file upload per line + report, Supabase Storage) | |
| M7 | Expense Categories & GL Coding Mode Config | |
| M8 | Intelligent Expense Form Foundation (dimensions, CoA, coding levels 0–4) | |
| M8.1 | Advanced CoA, Dimensions & Employee Foundation (IFRS types, cascades, bulk upload) | |
| M9 | Intelligent Expense Form (GL picker + hierarchy, dimensions, split lines, AI suggestions) | |
| M8.2 | Implementation Portal (setup dashboard, org, modules, CoA, employees, self-onboarding) | |
| — | M8.2 Post-release fixes (login/auth, currency auto-detect, signup polish, org structure edit/delete) | |
| M8.3 | Accounting Periods Engine (generate, grace, close checklist, soft/hard close, year-end, statutory close) | |
| — | Period Management Enhancements + Hardening (auto-generation, FY name formats, duplicate-FY fix, stub-year fix) | `b3e70e3` |
| — | Currencies & FX (4-tab UI + JSONB backend; decision on dedicated tables still open) | |
| M8.4 | Tax & Statutory (VAT/WHT/PAYE/other, JSONB per tenant) | |
| — | GL Posting Engine (journal entries/lines, immutable once posted, reversing entries) | |
| — | Trial Balance + Account Ledger (query builders + API endpoints) | |
| — | Account Mapping & Bank Accounts (posting roles → GL catalogue + per-tenant mapping) | |
| M9.0 | Shadow Test Environment clone engine (13-step; on-demand use only after M9.0.1) | |
| M9.1 | Super Admin Portal — tenant lifecycle (list/detail/lifecycle/suspend/enter/promote) | |
| — | User Profile, Sessions & 2FA (TOTP enroll/verify/disable; session list + revoke) | |
| M9.0.1 | Test-first environment flow inversion + unified promotion engine | `b3e70e3` |
| — | Default CoA templates (3 templates: FMCG 94, Prof Svc 76, Generic 57 accounts; smart re-download) | `7965f33` |
| — | UI Polish Phase 1 (shared Button/PageContainer/PageHeading components, 41 files) | `0d55ea8` |
| — | UI Polish Phase 2 (date-input, tab-state, modal backdrops, Banner component, loading skeletons) | `300b22d` |
| M9.3b | User Impersonation (sub=target user_id; ImpersonationUserBanner; 2 entry points; audit log) | `1a60a1c` |
| — | Role Hierarchy v2 (3-col PA/FA/UA; area+sub_area disambiguation; occupant avatars; zoom/fullscreen) | `3d2cf71`–`68608fd` |
| — | Finance Review Workflow (step builder UI; drag-drop ordering; function-scoped chains) | `6cbbf09`–`57e05a8` |
| — | System Function Mapping (maps business functions to org nodes; drives finance review scoping) | `290945a`–`7aa91bc` |
| — | People Module v1 → Positions merged into Approval Roles (single-source-of-truth; code + grade on roles) | `a2c0b35`–`1ddeaba` |
| — | Employee-User Link (employees.user_id FK; cascade deactivate/reactivate; user_type badge) | `6458fcd`, `a656f65` |
| — | Three-Mode Architecture (Lite/Connected/Full ERP; posting_batches; mode-aware portal/sidebar/pages) | `f24c2fe`, `63f61fe` |
| — | SA Portal — Consultant Config Panel (posting mode + module licensing per tenant) | `803618e` |
| — | SA Portal — Trials & Signups lead management page | `8dc89be` |
| — | SA Portal — Create Company (direct SA tenant creation + auto-generated temp password) | `336e7b4` |
| — | SA Portal — Nuke Tenant (hard-delete both test+live pair; lifecycle guard) | `946aa16`, `c6d05ee` |
| — | Document Security Hardening (magic bytes, ZIP validation, SHA-256 dedup, compression, 15-yr retention, access log) | Tasks #53–#55 |
| — | Demo Seed Script (`seed_demo_tenant.py` — idempotent; org, roles, CoA, employees, reports) | `ceb2862` |
| — | Designation-based Approval Policy (ceiling + thresholds + finance chain by designation, not role_id) | `a227417` |
| — | Finance Chain reads FinanceReviewStep (was dead code; now correctly routes via step-builder output) | `a227417` |
| — | Approval Matrix — Advisory Steps (is_advisory; non-blocking advance; all-advisory guard) | `fac40a9` |
| — | Approval Matrix — Selective-tree routing + open step types + function_code per step | `c27adcd` |
| — | Number formatting consolidated (formatMoney/fmtCommaInput/stripCommas in utils.ts; all local duplicates removed) | `a227417` |
| — | Branding / CSS variable injection (--ziva-primary, sidebar vars; Button uses them) | `c27adcd` |
| — | Force-change-password on first login (must_change_password flag; un-skippable page) | `7989709` |
| — | Mode-aware implementation portal (sidebar, pages, expense config fully respond to posting_mode) | `63f61fe` |
| — | Snapshot M9 field fix (gl_id, dimension_values, split_lines already in `_write_snapshot()`; verified by CC 2026-07-21) | `cc881f4` |
| P3 | Schema drift audit + cleanup (`alembic check` drift fixed; `go-live.tsx.bak` git rm; migration t2u3v4w5x6y7) | `b3e70e3` |
| P2 | Email / SMTP — Resend integration; invitations, approvals, password-reset, onboarding, live-promotion | `a5172a0` |
| P6 | `role_tier` enforcement sweep — power_admin cannot call SA-only endpoints (audit; no code changes needed) | `a5172a0` |
| P4 | Lite-mode CSV + Excel export of approved expense reports | `ccfa149` |
| P5 | Production DB backup policy — Render 3-day PITR confirmed active | (config, no commit) |
| SA-B-lite | SA Portal — manual paid/plan flag (`plan` + `paid_since` on tenant; editable from SA tenant detail) | `2eabb2a` |
| Q4 | Split-line GL posting fix (split-parent containers correctly skipped; frontend validates split children) | `20aa73e` |
| Q2 | Manual Journal Entry — list + new entry form; `POST /api/gl/journal-entries`; sidebar Accounting section | `c5ca38c` |
| Q1a | Financial Statements UI — P&L + Balance Sheet (fs_head/fs_note grouping; Full ERP only) | `467b254` |
| P1 | Production Deployment on Render — frontend Docker fix (`libc6-compat` on Alpine; live 2026-07-24) | `775e873` |
| M14 | Accounts Receivable (customers, AR invoices, payment recording, AR aging; migration `d2e3f4g5h6i7`) | (pending CC commit) |
| M16 | Budget & Planning (budget_periods, budget_lines, variance engine, frontend; migration `e3f4g5h6i7j8`) | (pending CC commit) |
| SA-B | SA Portal — Billing & Subscription (pricing_plans, tenant_subscriptions, billing_events, SA API; migration `f4g5h6i7j8k9`) | (pending CC commit) |
| M19 | Tax Engine — transaction level (VAT/WHT/PAYE compute service, tax_returns, wht_certificates; migration `g5h6i7j8k9l0`) | (pending CC commit) |
| M15 | Payroll & HR (salary_structures, payroll_runs, payroll_lines, payslips, leave_types, leave_requests, leave_balances; migration `h6i7j8k9l0m1`) | (pending CC commit) |
| M18 | Fixed Assets (asset_categories, assets, asset_depreciation_schedules, asset_disposals; SL+RB depreciation; migration `i7j8k9l0m1n2`) | (pending CC commit) |
| M17 | Inventory & Warehouse (inventory_categories, inventory_locations, inventory_items, stock_movements; FIFO/WACC; COGS GL posting; migration `j8k9l0m1n2o3`) | (pending CC commit) |
| M20 | AI Intelligence Layer (ai_insights table, anomaly detection, spending pattern analysis, cash flow forecast, GL auto-classify; extended /api/ai router; migration `k9l0m1n2o3p4`) | (pending CC commit) |

---

### ⏳ PENDING (in priority order — do not reorder without discussion)

> **Three-mode build rule (non-negotiable):** Every transaction module must support all three modes from the first commit. This is a core architectural invariant (see §3b). Design the module for all three before writing a single line. The mode is set by the consultant per tenant — Cowork never hardcodes mode-specific forks in feature code; routing lives in the service layer only.
>
> Mode abbreviations used below: **L** = Lite (workflow only, no GL), **C** = Connected (GL coding → posting_batches → external ERP), **E** = Full ERP (GL coding → journal_entries → in-app statements).

#### TIER 2 — Module Expansion — ⏳ CODE COMPLETE, PENDING CC COMMIT

| # | Milestone | Mode scope | Notes |
|---|---|---|---|
| Q1b | **Cash Flow Statement** ✅ | **E only** | Shipped — indirect-method cash flow query + UI |
| M11 | **Accounts Payable** ✅ | **L/C/E** | Shipped — vendors, invoices, 3-way match, AP aging |
| M11b | **Bank Reconciliation** ✅ | **L/C/E** | Shipped — CSV import, auto-match, recon matches |
| M10 | **OCR & Receipt Scanning** ✅ | **All modes** | Shipped — Anthropic Vision API + learning overrides |
| M14 | **Accounts Receivable** ⏳ | **L/C/E** | Code complete — pending CC commit |
| SA-B | **SA Portal — Billing & Subscriptions** ⏳ | SA only | Code complete — pending CC commit |

#### TIER 3 — Strategic Expansion — ⏳ CODE COMPLETE, PENDING CC COMMIT

| # | Milestone | Mode scope | Notes |
|---|---|---|---|
| M16 | **Budget & Planning** ⏳ | **L/C/E** | Code complete — pending CC commit |
| M19 | **Tax Engine — transaction level** ⏳ | **L/C/E** | Code complete — pending CC commit |
| M15 | **Payroll & HR** ⏳ | **L/C/E** | Code complete — pending CC commit |
| ICE | **Inter-Company Eliminations** (group consolidation, elimination journals) | **E only** | PRD exists: `docs/ICE_PRD.md` — NOT YET BUILT |

#### TIER 4 — Long-term / Specialist — ⏳ CODE COMPLETE, PENDING CC COMMIT

| # | Milestone | Mode scope | Notes |
|---|---|---|---|
| M18 | **Fixed Assets** ⏳ | **L/C/E** | Code complete — pending CC commit |
| M17 | **Inventory & Warehouse** ⏳ | **L/C/E** | Code complete — pending CC commit |
| M20 | **AI Intelligence Layer** ⏳ | **All modes** | Code complete — pending CC commit |
| Perf | **Performance & Security Audit** (Redis caching, N+1 query sweep, pen test) | — | Before scale — NOT YET BUILT |
| FX | **Currencies & FX dedicated tables decision** (JSONB vs. tenant_currencies/tenant_fx_rates) | — | Revisit when BDC register volume or reporting complexity demands it — NOT YET BUILT |

## Module PRDs

Read the corresponding PRD before building any module:

| Module | PRD File |
|---|---|
| Authentication & User Management | `docs/AUTH_USER_MANAGEMENT_PRD.md` |
| Tenant Admin Portal | `docs/TENANT_ADMIN_PORTAL_PRD.md` |
| Inter-Company Eliminations (ICE) | `docs/ICE_PRD.md` |
| Supporting Documents (M6) | `docs/M6 Supporting Documents.md` |
| Accounts Payable | *(rewrite PDF → markdown when building this module)* |
| Accounts Receivable | *(rewrite PDF → markdown when building this module)* |
| Expense Management | *(rewrite PDF → markdown when building this module)* |
| All other modules | *(rewrite PRD just before building that module)* |
