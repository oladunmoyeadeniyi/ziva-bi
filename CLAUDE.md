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

### Rules
- **Cowork never commits directly** — it only writes code and PENDING_COMMIT.md
- **CC never writes feature code** — it only reviews, checks, and commits
- If CC flags a problem, Cowork fixes it; CC re-reviews on the next `/review-commit`
- `docs/PENDING_COMMIT.md` is deleted by CC after a successful commit (it is stale once pushed)


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

> **Authoritative as of 2026-07-20.** Reconciled against live codebase, git log (265 commits), and `docs/ZIVA_BI_EVALUATION_2026_07_20.md`. Full narrative detail: `docs/MASTER_CONTEXT.md` §5. Update this table AND §5 of MASTER_CONTEXT.md every time a milestone ships.
>
> **Overall completion: ~40% of full product vision. ~85% of MVP-for-first-customer.**

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

---

### ⏳ PENDING (in priority order — do not reorder without discussion)

> **Three-mode build rule (non-negotiable):** Every transaction module must support all three modes from the first commit. This is a core architectural invariant (see §3b). Design the module for all three before writing a single line. The mode is set by the consultant per tenant — Cowork never hardcodes mode-specific forks in feature code; routing lives in the service layer only.
>
> Mode abbreviations used below: **L** = Lite (workflow only, no GL), **C** = Connected (GL coding → posting_batches → external ERP), **E** = Full ERP (GL coding → journal_entries → in-app statements).

#### TIER 0 — Production Gates (must complete before first customer)

| # | Milestone | Notes |
|---|---|---|
| P1 | **Production Deployment on Render** (backend + frontend + env vars + domain) | #1 priority. Nothing is sellable while the product lives on localhost |
| P2 | **Email / SMTP** (Resend or SendGrid integration; replace stdout stub) | Invitations, password resets, notifications — all broken without this |
| P3 | **Schema drift audit + cleanup** (`alembic check` unconfirmed drift; `go-live.tsx.bak` git rm) | Must verify before live data hits Render |

#### TIER 1 — Quick Wins (backend exists; UI only)

| # | Milestone | Mode scope | Notes |
|---|---|---|---|
| Q1 | **Financial Statements UI** (P&L, Balance Sheet, Cash Flow output pages) | **E only** — show `ModeNotAvailable` for L/C | GL engine posts the data; just need formatted output. Every finance team needs this |
| Q2 | **Manual Journal Entry UI** (post adjustments, accruals, corrections) | **E only** — show `ModeNotAvailable` for L; optional in C | Tables + GL engine exist; just need endpoints + frontend |
| Q3 | **Snapshot M9 field fix** (include gl_id, dimension_values, split_lines in snapshot_data) | All modes | Existing snapshots are incomplete; new ones should be full |
| Q4 | **Split-line GL posting fix** (split-parent containers currently skipped at posting) | **C + E** | Needed before Full ERP mode is fully reliable |

#### TIER 2 — Module Expansion (~2–3 months)

| # | Milestone | Mode scope | Notes |
|---|---|---|---|
| M10 | **OCR & Receipt Scanning** (Anthropic Vision API) | **All modes** — mode-agnostic | Extracts amounts/dates from receipts; works same regardless of posting mode |
| M11 | **Accounts Payable** (P2P: vendor invoices, 3-way match, payment runs, AP aging) | **L**: vendor bill workflow + CSV export. **C**: + GL coding + posting_batches. **E**: + GL posting + AP ledger | Most critical missing module; daily pain for every finance team |
| M11b | **Bank Reconciliation** | **L**: statement import + manual match. **C**: match to posting batches + export recon entries. **E**: match to GL bank account + clearing journal | Flows directly from AP; cannot operate AP cleanly without bank recon |
| M14 | **Accounts Receivable** (O2C: customer invoices, receipts, AR aging) | **L**: invoice workflow + CSV export. **C**: + GL coding + posting_batches. **E**: + GL posting + AR ledger | Revenue-side; needed for companies that issue invoices |
| SA-B | **SA Portal — Billing & Subscription backend** (pricing plans, subscription tracking, payment integration) | SA portal only — mode-agnostic | Needed to charge customers |

#### TIER 3 — Strategic Expansion (~3–6 months)

| # | Milestone | Mode scope | Notes |
|---|---|---|---|
| M16 | **Budget & Planning** (budget entry, budget vs. actuals reporting, variance alerts) | **L**: budget vs CSV exports. **C**: budget vs posting batch values. **E**: budget vs GL actuals | High retention driver; CFOs need this |
| M19 | **Tax Engine — transaction level** (VAT on AP invoices, WHT on vendor payments, PAYE payroll tax) | **L**: tax calcs on invoices, CSV output. **C**: + VAT/WHT in posting_batches. **E**: + auto-post tax journals (VAT payable, WHT payable, PAYE payable) | Nigerian compliance requirement for most customers |
| M15 | **Payroll & HR** (salary, deductions, payslips, leave management) | **L**: payroll run + manual pay. **C**: payroll run + posting_batches. **E**: payroll run + salary journal entry | Complex; major competitive moat; builds on People module foundation |
| ICE | **Inter-Company Eliminations** (group consolidation, elimination journals) | **E only** | PRD exists: `docs/ICE_PRD.md` |

#### TIER 4 — Long-term / Specialist

| # | Milestone | Mode scope | Notes |
|---|---|---|---|
| M18 | **Fixed Assets** (asset register, depreciation schedules, disposal) | **L**: asset register only. **C**: + posting_batches for depreciation. **E**: + depreciation journal entries | Capital-intensive companies |
| M17 | **Inventory & Warehouse** (stock management, COGS, warehouse locations) | **L**: stock tracking only. **C**: + COGS posting batch. **E**: + COGS journal entries | Narrows vs. broadens market; build last |
| M20 | **AI Intelligence Layer** (auto-categorization, anomaly detection, cash flow forecasting) | **All modes** — trains on whichever transaction data exists | Built on top of accumulated transaction history; ~98%+ accuracy target |
| Perf | **Performance & Security Audit** (Redis caching, N+1 query sweep, pen test) | — | Before scale |
| FX | **Currencies & FX dedicated tables decision** (JSONB vs. tenant_currencies/tenant_fx_rates) | — | Revisit when BDC register volume or reporting complexity demands it |

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
