# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Core Documents (read these first, every session)

| Document | Purpose |
|---|---|
| `docs/MASTER_CONTEXT.md` | Single source of truth — owner, vision, stack, status. **Wins all conflicts.** |
| `docs/MASTER_INSTRUCTION.md` | The rulebook — coding standards, workflow, what not to do |
| `docs/MASTER_SYSTEM_SUMMARY.md` | Architecture reference — modules, deployment, DB design |

Always read all three before coding anything. Update `MASTER_CONTEXT.md` after every completed milestone.

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

> Full detail and dates for every row below: `docs/MASTER_CONTEXT.md` §5 (completed) and §9/§10 (pending, in recommended order). Reconciled 2026-06-29 — this table previously omitted ~10 shipped milestones. Update this table (and §5 of MASTER_CONTEXT.md) every time a milestone ships — do not let it drift again.

| # | Milestone | Status |
|---|---|---|
| M1 | Foundation deployed (Next.js + FastAPI + PostgreSQL on Render) | ✅ Done |
| M2 | Auth & User Management (signup, login, JWT, roles) | ✅ Done |
| M3 | Business Expense Submission (multi-line reports, DRAFT→SUBMITTED) | ✅ Done |
| M4 | Approval Workflow (matrix, multi-level approve/reject) | ✅ Done |
| M4+ | Approval Enhancements (refer-back, audit trail, snapshots, separation of duties) | ✅ Done |
| M5 | Tenant User Management (invite, roles, deactivate) | ✅ Done |
| M6 | Supporting Documents (file upload per expense line, Supabase Storage) | ✅ Done |
| M7 | Expense Categories & GL Coding Mode Config | ✅ Done |
| M8 | Intelligent Expense Form Foundation (dimensions, CoA, coding levels 0–4) | ✅ Done |
| M8.1 | Advanced CoA, Dimensions & Employee Foundation | ✅ Done |
| M9 | Intelligent Expense Form (GL picker, dimensions, split lines, AI suggestions) | ✅ Done |
| M8.2 | Implementation Portal (setup dashboard, org, modules, dimensions, CoA, employees) | ✅ Done |
| — | M8.2 Post-release fixes (login/auth, currency auto-detect, signup polish, org structure edit/delete) | ✅ Done |
| M8.3 | Accounting Periods Engine (generation, grace, close checklist, soft/hard close, year-end audit, statutory close) | ✅ Done |
| — | Period Management Enhancements + Hardening (auto-generation, FY name formats, duplicate-FY fix, stub-year fix) | ✅ Done |
| — | Currencies & FX (4-tab UI + backend; JSONB-based, not dedicated tables — see MASTER_CONTEXT §5) | ✅ Done |
| M8.4 | Tax & Statutory (VAT/WHT/PAYE/other, JSONB backend) | ✅ Done |
| — | GL Posting Engine & Reporting (journal entries, trial balance, account ledger) | ✅ Done |
| — | Account Mapping & Bank Accounts (posting roles → GL, bank account register) | ✅ Done |
| M9.0 | Shadow Test Environment — live-first clone model (superseded by M9.0.1, kept for on-demand use) | ✅ Done |
| M9.1 | Super Admin Portal — tenant lifecycle slice (list/detail/lifecycle/suspend/enter/promote) | ✅ Done |
| — | User Profile, Sessions & 2FA | ✅ Done |
| M9.0.1 | Test-first tenant environment flow inversion + unified promotion engine | ✅ Done |
| — | Resolve `organisation/page.tsx` working-tree diff | ⏳ Pending |
| — | Organisation tab restructuring | ⏳ Pending |
| — | Verify CoA PL/BS filter | ⏳ Pending |
| — | UI Polish Milestone (global overhaul — do not fix UI piecemeal before this) | ⏳ Pending |
| — | Confirm Currencies & FX / BDC completeness (dedicated tables vs. JSONB) | ⏳ Pending |
| — | Super Admin Portal backend completion (Billing, Trials, Team, Audit, Support, Settings) | ⏳ Pending |
| M11 | Accounts Payable | ⏳ Pending |
| M13 | Bank Reconciliation | ⏳ Pending |
| M14 | Accounts Receivable | ⏳ Pending |
| M16 | Budget Engine | ⏳ Pending |
| M19 | Tax Engine | ⏳ Pending |
| M10 | OCR & Receipt Scanning (Anthropic Vision API) | ⏳ Pending |
| M15 | Payroll & HR | ⏳ Pending |
| M17 | Inventory & Warehouse | ⏳ Pending |
| M18 | Fixed Assets | ⏳ Pending |
| M20 | AI Intelligence Layer (98%+ accuracy target) | ⏳ Pending |

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
