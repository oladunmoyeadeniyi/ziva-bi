# MASTER CONTEXT — Ziva BI

> Single source of truth. If anything in other docs conflicts with this, **this wins**.
> Last updated: May 2026 (Milestone 2 — Auth & User Management complete)

---

## 1. Owner

- **Name:** Adeniyi Oladunmoye
- **Role:** Chief Accountant, Red Bull Nigeria (transitioning to Controller)
- **Background:** B.Sc Accounting (2015), ICAN Chartered Accountant (2019), 2 yrs at EY
- **Location:** Lagos, Nigeria → relocating to UK Q4 2026 (dependent visa via wife)
- **Family:** Wife + son Nathan (born Mar 2025)
- **Tech level:** Excel/Power Query expert, learning Python (Coursera, ~2hrs/wk). Not a developer.

## 2. Product Vision

Build **Ziva BI** — an intelligent finance and operations automation platform that serves both **individuals and businesses**.

Tagline: *Zero manual work. 100% automation. Intelligent decision-making.*

### Target users

- **Individuals** — personal finance tracking, income/expense management, personal tax prep, bank transaction tracking, personal budgeting, document/receipt management.
- **Businesses (SMB to Enterprise)** — full multi-tenant ERP-style finance/operations platform.

### Tiered platform model

Think Mint (individual) vs Xero (business) — same parent product, two distinct experiences:

| Tier | Audience | Modules available |
|---|---|---|
| **Personal** | Individuals | Expense tracking, Income tracking, Personal Tax, Bank Reconciliation (personal), Budget Engine (personal), Document Vault |
| **Business** | Companies of all sizes | All Personal modules + AP, AR, Payroll, Inventory, Fixed Assets, Multi-tenant Workflow Approvals, Vendor/Customer Portals, ICE, Audit & Compliance, AI Engine |

Same codebase, same database, account-type flag distinguishes experience. Individuals don't see multi-tenant approval routing; businesses do.

## 3. Build Strategy

- **Solo founder, no budget for developers, no co-founder.**
- **Approach:** AI-directed development. Claude Code writes 100% of code. Adeniyi directs using domain expertise and tests.
- **MVP scope:** Start with shared foundation (auth, accounts, dashboards), then build Expense Management — usable by both individuals and businesses from day one. Other modules layer in over time.
- **All previous ChatGPT NestJS/TypeScript code is DISCARDED. Starting fresh.**

## 4. Tech Stack (FINAL — do not deviate without discussion)

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + React + TailwindCSS + ShadCN UI |
| Backend | Python 3.14 + FastAPI |
| Database | PostgreSQL (Render managed) |
| Auth | JWT (access + refresh tokens) |
| File Storage | Cloudflare R2 |
| Deployment | Render (GitHub → Render pipeline, no local dev server beyond initial testing) |
| PWA | Enabled (mobile-first for individuals) |
| Repo structure | **Monorepo** — single repo with `/frontend` and `/backend` folders |

## 5. Architecture Principles

- **Account-type aware:** Two account types — `individual` and `business`. UX, available modules, and workflow complexity adapt to type.
- **Multi-tenant for business:** Hybrid model — shared codebase, isolated tenant data. Every business table has `tenant_id`. Individual accounts have `user_id` only.
- **Modular:** Each module deployable/activatable independently per account.
- **Universal Workflow Engine (business only):** Draft → Submitted → LM Review → GM Approved → Finance Reviewed → Finance Approved → Posted → Paid → Closed → Archived. Individual accounts use simplified single-user flow.
- **Double-Entry Accounting Engine:** Auto-determines DR/CR from GL metadata. Applies dimensions, tax, FX, accruals. Works for both account types.
- **AI/OCR Layer:** Line-item extraction from invoices/receipts/bank statements. GL prediction. Duplicate detection. Auto-matching against PO/budget (business) or personal categories (individual). Target: 98%+ accuracy.
- **Tenant configurability (business):** Chart of accounts, dimensions, tax rules, approval workflows, budgets, expense caps, FX sources, inventory valuation, branding, document layouts. Individual accounts get sensible defaults.

## 6. Modules

### Available to Individuals
- Personal Expense Tracking
- Personal Income Tracking
- Personal Tax Prep (jurisdiction-aware)
- Bank Reconciliation (personal)
- Personal Budget Engine
- Document Vault (receipts, statements, tax docs)

### Available to Businesses (in addition to all Personal modules)
- Expense Management (with approvals)
- Accounts Payable
- Accounts Receivable
- Bank Reconciliation (business)
- Tax Engine (corporate)
- Budget Engine (corporate)
- Inventory
- Fixed Assets
- Warehouse/3PL Portal
- POSM
- Payroll & HR
- Vendor Portal
- Customer Portal
- Workflow Approvals Engine
- Tenant Admin
- Audit & Compliance
- Inter-Company Eliminations (ICE)
- AI Engine

### Shared Infrastructure
- Super Admin (manages all accounts across both tiers)
- Authentication & User Management
- Notifications
- Document storage

## 7. Build Approach — Milestone-Based (NOT chunk-based)

We work in **vertical feature slices**, not horizontal layers. Each milestone is a usable, demoable piece of the product.

Claude Code proposes the order; Adeniyi reviews and approves. Suggested first milestones:

1. **Foundation deployed:** Empty Next.js + FastAPI app deployed to Render, connected to PostgreSQL, basic health check works.
2. **User can sign up + log in:** Both account types (individual / business) selectable at signup.
3. **Individual can log a personal expense:** Simplest possible expense entry, saved to DB, listed on dashboard.
4. **Business can create a tenant + invite first user:** Multi-tenant scaffolding working.
5. **Business employee can submit an expense retirement:** Mirrors Adeniyi's Red Bull workflow.
6. **Approval workflow works end-to-end:** Submitted → manager approves → finance reviews → posted.
7. **OCR reads a receipt:** AI layer kicks in for first time.
8. **...subsequent milestones decided as we go.**

Each milestone:
- Has a clear "done" definition
- Gets committed and pushed to GitHub
- Gets deployed to Render
- Is tested by Adeniyi before next one begins

## 8. Development Environment (already set up)

- Windows 10 personal laptop (not work)
- Git 2.54.0, GitHub CLI 2.92.0 (authenticated as `oladunmoyeadeniyi`)
- Node.js 24.15.0, npm 11.12.1
- Python 3.14.5 (on PATH)
- VS Code
- Claude Code 2.1.143
- PowerShell execution policy: RemoteSigned (current user)
- Project root: `C:\Users\oladu\Projects\ziva-bi`
- Docs folder: `C:\Users\oladu\Projects\ziva-bi\docs`

## 9. GitHub

- Username: `oladunmoyeadeniyi`
- Email: `oladunmoyeadeniyi@yahoo.com`
- Authenticated locally via GitHub CLI, HTTPS protocol
- Repo for this project: **TBD — to be created during Milestone 1 as monorepo**

## 10. Working Rules with Adeniyi

- Be direct, concise, honest. No fluff.
- Explain code as you write it — Adeniyi is learning alongside production.
- Always commit + push to GitHub after each milestone so work survives chat limits.
- Update this Master Context at the end of every major working session.
- For new chats: paste this doc and say "Continue from here."
- When in doubt about architecture, ask before coding.

## 11. Domain Knowledge from Adeniyi's Red Bull experience (feeds Business Expense module)

- **Expense Retirement flow:** Employee fills Excel template → manager approval(s) via email → forward to Finance with supports → Finance saves in structured folders → manually reviews → emails queries → compiles summary schedule → line manager approves → bank upload.
- **Folder convention:** `Employee Expense Retirement / [Year] / [Month] / [Employee Name] / 01, 02, 03...`
- **File naming:** `[Surname] [APPROVAL STATUS] [POSTING STATUS] P[Month#]-[Sequence]-[Year]` — e.g. `Adeniyi APPROVED PENDING P01-01-26`
- **Approval status values:** `APPROVED` | `NO_APPROVAL`
- **Posting status values:** `PENDING` | `POSTED`
- **ERP:** Sage X3 (Excel import supported)
- **Pain points:** Power Query crashing at scale; manual invoice verification; manual duplicate detection; email-based query tracking
- **Vendor Payment process:** Similar template to expense retirement, but includes PO process at initiation. (Will be P2P/AP module.)

## 12. Other Goals (context — not for Claude Code to act on)

- Secure remote work paying foreign currency before UK move
- Raise Nathan to be smart, multilingual, multi-talented, spiritual
- Increase general knowledge, public speaking, discipline
- Live a healthy life

## 13. Current Status — Where We Are

### ✅ Completed
- Dev environment fully set up
- Claude Code installed, CLAUDE.md initialised
- Tech stack confirmed (Next.js + FastAPI + PostgreSQL + Render)
- Product vision finalised (Individuals + Businesses, tiered)
- Build approach: milestones, not chunks
- 3 master docs rewritten in clean markdown:
  - `MASTER_CONTEXT.md` (this file)
  - `MASTER_INSTRUCTION.md`
  - `MASTER_SYSTEM_SUMMARY.md`
- **MILESTONE 1 COMPLETE (May 2026):**
  - Monorepo scaffold: Next.js 15 frontend + FastAPI backend
  - Backend: `main.py` (FastAPI app + /api/health), `config.py` (pydantic-settings), `database.py` (async SQLAlchemy + session factory), `alembic/` (migration tooling ready)
  - Frontend: App Router layout, placeholder landing page, ShadCN + Tailwind configured
  - Dockerfiles for both services (Render-optimised)
  - `render.yaml` — full infra-as-code: 2 web services + managed PostgreSQL
  - `.gitignore`, `.env.example` for both services
  - `README.md` at root
  - All PDF PRDs removed from `docs/`; markdown versions remain
  - First commit pushed to GitHub (`oladunmoyeadeniyi/ziva-bi`, branch: `main`)

### ✅ Completed — Milestone 2 (May 2026)
- **Auth & User Management** — full signup, login, token refresh, logout
- Business signup creates a company (tenant) with name + country; user becomes Tenant Admin
- Individual signup creates a single-user account (tenant_id = NULL)
- JWT access tokens (30 min) + rotating refresh tokens (7 days), replay-attack protection
- Account lockout after 5 failed attempts (15-min lockout)
- Argon2-compatible bcrypt password hashing (bcrypt 5.x direct, no passlib)
- System roles seeded on startup (super_admin, tenant_admin, employee, etc.)
- DB models: tenants, users, user_tenants, roles, permissions, role_permissions, user_roles, sessions, refresh_tokens, audit_logs
- Alembic migration for all auth tables
- Seed script: Super Admin + test tenant + individual test user
- Frontend: two-step signup page, login page, dashboard layout with auth guard
- Dashboards route by account_type → /dashboard/personal or /dashboard/business
- AuthContext handles session persistence (refresh token in localStorage, access token in memory)
- All endpoints: POST /api/auth/signup, /api/auth/login, /api/auth/refresh-token, /api/auth/logout, GET /api/users/me

### ⏳ Next — Milestone 3
- Individual can log a personal expense (simplest possible expense entry, saved to DB, listed on dashboard)

### Module PRDs still to rewrite (do each just before building that module)
- Accounts Payable (PDF exists — rewrite to markdown before building AP)
- Accounts Receivable (PDF exists — same)
- Expense Management (PDF exists — same)
- Bank Reconciliation, Payroll, Vendor Onboarding, AI Engine, Audit & Compliance

---

*End of Master Context. Update after every major session.*
