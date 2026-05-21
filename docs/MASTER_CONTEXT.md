# MASTER CONTEXT — Ziva BI

> Single source of truth. If anything in other docs conflicts with this, **this wins**.
> Last updated: May 2026 (Approval Workflow Enhancements — refer back, audit trail, snapshots, separation of duties, full email coverage)

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
- **PostgreSQL 17** installed locally; server runs on port 5432
- Local dev database: `ziva_dev` (user: `postgres`, password: `postgres`)
- `backend/.env` configured with `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ziva_dev`
- Backend started with: `cd backend && .venv\Scripts\uvicorn.exe app.main:app --reload --port 8000`
- Frontend started with: `cd frontend && npm run dev`
- CORS: `localhost:3000` and `localhost:3001` hardcoded in `main.py` — always allowed regardless of ALLOWED_ORIGINS env var

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

### ✅ Completed — Foundation
- Dev environment fully set up (see Section 8)
- Claude Code installed, CLAUDE.md initialised
- Tech stack confirmed (Next.js + FastAPI + PostgreSQL + Render)
- Product vision finalised (Individuals + Businesses, tiered)
- 3 master docs in clean markdown: `MASTER_CONTEXT.md`, `MASTER_INSTRUCTION.md`, `MASTER_SYSTEM_SUMMARY.md`

### ✅ Completed — Milestone 1 (May 2026)
- Monorepo scaffold: Next.js 15 frontend + FastAPI backend
- Backend: `main.py`, `config.py` (pydantic-settings), `database.py` (async SQLAlchemy), `alembic/`
- Frontend: App Router layout, placeholder landing page, ShadCN + Tailwind configured
- Dockerfiles for both services (Render-optimised)
- `render.yaml` — infra-as-code: 2 web services + managed PostgreSQL
- Repo pushed to GitHub (`oladunmoyeadeniyi/ziva-bi`, branch: `main`)

### ✅ Completed — Milestone 2 (May 2026)
- **Auth & User Management** — signup, login, token refresh, logout
- Business signup creates tenant + Tenant Admin; individual signup has tenant_id = NULL
- JWT access tokens (30 min) + rotating refresh tokens (7 days), replay-attack protection
- Account lockout after 5 failed attempts (15-min lockout); bcrypt password hashing
- System roles seeded on startup (super_admin, tenant_admin, employee, approver, finance_*, etc.)
- DB models: tenants, users, user_tenants, roles, permissions, role_permissions, user_roles, sessions, refresh_tokens, audit_logs
- Alembic migration: revision `72a96af108c3`
- Frontend: two-step signup, login, dashboard auth guard, AuthContext (refresh token in localStorage)
- Dashboards route by account_type → `/dashboard/personal` or `/dashboard/business`
- Endpoints: POST /api/auth/signup, /login, /refresh-token, /logout; GET /api/users/me, /api/users/tenant

### ✅ Completed — Milestone 3 (May 2026)
- **Business Expense Retirement Submission** — multi-line expense report with GL coding
- DB models: expense_reports, expense_lines (both tenant-scoped)
- Alembic migration: revision `87e40b59d47f`
- Status flow: DRAFT → SUBMITTED
- Report numbering: `EXP-{YEAR}-{SEQUENCE:04d}` per tenant/year
- API: POST/GET/PATCH /api/expenses/reports, POST/DELETE lines
- Frontend: expense list page (tab filters), new report form, read-only detail view
- Sidebar: Expenses nav item added

### ✅ Completed — Milestone 4 (May 2026)
- **Approval Workflow** — configurable multi-level expense approval chain
- DB: approval_matrix (per-tenant), expense_approvals (per report × level)
- expense_reports extended: `current_approval_level`, `rejection_comment`
- Status flow: DRAFT → PENDING_APPROVAL → APPROVED | REJECTED
- Alembic migrations: `f1e2d3c4b5a6` (approval tables), `a2b3c4d5e6f7` (unique constraint on report+level)
- `is_tenant_admin` embedded in JWT
- API: POST/GET /api/approvals/matrix, POST /api/approvals/reports/{id}/submit, GET /api/approvals/queue, GET /api/approvals/rejected, GET /api/approvals/reports/{id}, POST /api/approvals/{id}/approve, POST /api/approvals/{id}/reject
- Frontend: Approvals queue page, Approval Matrix settings page (admin only)
- Sidebar: Approvals nav with pending-count badge, Settings nav (admin only)
- Expense list: 5-tab filter (All / Drafts / In Review / Approved / Rejected) + status badges
- Expense detail: approval chain progress display + live approve/reject action panel
- SMTP email on rejection (console fallback when not configured)

### ✅ Completed — Approval Workflow Enhancements (May 2026)
All built on top of Milestone 4. Alembic migrations applied: `c3d4e5f6a7b8` and `d4e5f6a7b8c9`.

**Bug fixes:**
- Submit endpoint bug: new expense form (`new/page.tsx`) was calling the old M3 submit endpoint (→ SUBMITTED). Fixed to call the M4 approval submit endpoint (→ PENDING_APPROVAL) with the approver selection modal.
- Sidebar badge: pending count badge was only refreshing on token change. Fixed by adding `pathname` to the `useEffect` dependency — badge now refreshes on every navigation and after every approve/reject action.
- CORS: `localhost:3000` and `localhost:3001` hardcoded in `main.py` — not dependent on `ALLOWED_ORIGINS` env var.

**Refer Back action** (new):
- `POST /api/approvals/{id}/refer-back` with `target_type: "approver" | "requestor"`
- `target_type = "requestor"` → report becomes `REFERRED_TO_REQUESTOR`; resubmit resumes from the referring level (not Level 1)
- `target_type = "approver"` → activates one or more lower levels for consultation (`target_levels: list[int]`); levels visited sequentially in ascending order; after all complete, control returns to the referring level
- `visible_to_requestor` bool: controls whether the requestor can see the referral comment or only sees "Pending internal review"
- `response_comment` on approve: referred approver can send a reply back to the referring approver
- New report status: `REFERRED_TO_REQUESTOR`; new approval record status: `REFERRED_BACK`
- `expense_reports.status` widened to VARCHAR(30) to fit `REFERRED_TO_REQUESTOR`

**Smart rejection resume:**
- `expense_reports.rejected_at_level` (INTEGER): tracks which level rejected/referred-back-to-requestor
- On resubmit, approval chain resumes from `rejected_at_level` — already-approved lower levels are preserved and not re-reviewed
- `expense_reports.referred_back_from_level` (INTEGER): tracks the higher level to return to during approver-to-approver refer-back
- `expense_reports.referred_back_levels` (JSONB): queue of additional levels to visit in multi-level refer-back

**Audit trail:**
- Every approval action writes an immutable entry to `audit_logs` with full JSONB metadata
- Event types: `EXPENSE_SUBMITTED`, `EXPENSE_APPROVED`, `EXPENSE_REJECTED`, `EXPENSE_REFERRED_BACK`, `EXPENSE_RESUBMITTED`
- `GET /api/approvals/reports/{id}/audit-log` — chronological event trail (tenant admin / super admin only)
- Frontend: `/dashboard/business/expenses/{id}/audit` — vertical timeline page with event type, actor, timestamp, comments; "View Audit Trail" link on detail page (admin only)

**Expense snapshots:**
- New table: `expense_report_snapshots` — immutable JSONB copy of all lines + header at each submission
- Version increments per resubmission (1, 2, 3…)
- `GET /api/approvals/reports/{id}/snapshot/{version}` — returns the snapshot
- Snapshot version included in audit log entries for `EXPENSE_SUBMITTED` and `EXPENSE_RESUBMITTED`
- Frontend: `/dashboard/business/expenses/{id}/snapshot/{version}` — snapshot viewer with full line detail; "View snapshot" links on the audit trail page

**Separation of duties:**
- Backend: submit validates no `approver_id == employee_id` at any level (HTTP 400 if violated)
- Frontend: approver dropdowns filter out the currently logged-in user entirely

**Full email coverage** (all fall back to console log when SMTP not configured):
- Approver notified when report enters their queue (on submit / resubmit)
- Approver notified when referred to by a higher-level approver
- Requestor notified when report is fully approved
- Requestor notified when referred back with `visible_to_requestor = true`
- Requestor notified on rejection (existing from M4)

**New DB columns (applied via migrations):**
- `expense_approvals.visible_to_requestor` BOOLEAN DEFAULT false
- `expense_approvals.response_comment` TEXT nullable
- `expense_reports.rejected_at_level` INTEGER nullable
- `expense_reports.referred_back_from_level` INTEGER nullable
- `expense_reports.referred_back_levels` JSONB nullable
- `expense_reports.status` widened from VARCHAR(20) → VARCHAR(30)

**Frontend additions:**
- Status badges updated: REFERRED_BACK and REFERRED_TO_REQUESTOR shown in amber throughout
- Refer Back modal: multi-select checkboxes for target levels + `visible_to_requestor` toggle + required comment
- Referred approver context panel: shows who referred and the comment
- Response field: referred approver enters a reply before approving back up
- Requestor view: inline query banners while report is PENDING_APPROVAL (shows comment if visible, else greyed-out "Pending internal review")
- Expense list: Rejected tab includes REFERRED_TO_REQUESTOR; Edit action shown for both
- Approvals queue page: unchanged (existing PENDING detection works correctly for refer-back flows)

### ⏳ Next — Milestone 5
- Individual can log a personal expense (simplest possible expense entry, saved to DB, listed on dashboard)

### Module PRDs still to rewrite (do each just before building that module)
- Accounts Payable (PDF exists — rewrite to markdown before building AP)
- Accounts Receivable (PDF exists — same)
- Expense Management (PDF exists — same)
- Bank Reconciliation, Payroll, Vendor Onboarding, AI Engine, Audit & Compliance

---

*End of Master Context. Last updated: May 2026 (Approval Workflow Enhancements complete).*
