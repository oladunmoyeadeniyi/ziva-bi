# MASTER SYSTEM SUMMARY — PRAD

> Architecture overview — the "how it's built" reference.
> If anything here conflicts with `MASTER_CONTEXT.md`, that document wins.
> For current schema/endpoint/feature facts, see `PROJECT_STATE.md`.
> **Last updated: 2026-07-29** (all TIER 2–4 milestones committed `9ffd9e0`; M17b FIFO/Standard costing pending CC commit — migration `l0m1n2o3p4q5`)

---

## 1. Product Vision

PRAD is an intelligent, multi-tenant, end-to-end finance automation SaaS platform for businesses of every size. The platform is live on Render; the product is functionally complete for a first customer.

**Mission:** Zero manual work. 100% automation. Intelligent decision-making.

**Core invariants (locked — do not change without explicit decision):**
- Production-grade code at all times — no shortcuts, no "TODO: fix later"
- Every table has `tenant_id`; data isolation is enforced at the DB query layer
- Three-mode architecture: Lite / Connected / Full ERP — every module supports all three from day one
- AI and OCR are core, not optional
- Everything configurable per tenant — no hardcoded rules
- Cowork writes code; Claude Code reviews, commits, pushes, and runs migrations

---

## 2. Tech Stack (current, as of 2026-07-29)

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TailwindCSS v4 + ShadCN UI |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL (Render managed) via async SQLAlchemy + Alembic |
| Auth | JWT (access + refresh tokens) + TOTP 2FA + session tracking |
| File Storage | Supabase Storage (current) → Cloudflare R2 (planned migration at >5 tenants or >5 GB) |
| AI / OCR | Anthropic claude-haiku-4-5-20251001 via Vision API |
| Email | Resend (via httpx REST; falls back to console log when key is unset) |
| Deployment | Render — backend Dockerised FastAPI + frontend Next.js Web Service + managed PostgreSQL |
| CI/CD | GitHub → Render auto-deploy (main branch) |
| PWA | Enabled — installable on mobile |

---

## 3. Multi-Tenant Architecture

**Model:** Shared codebase, isolated tenant data. Every business-tier table carries `tenant_id`. Data isolation is enforced at the query layer — every query is automatically scoped.

### Environment model (test-first, since M9.0.1)
- **Signup** creates ONLY a test tenant (`environment="test"`, `parent_tenant_id=NULL`, `lifecycle_status="in_implementation"`). No clone at signup.
- **Live tenant** is born second, via explicit SA-portal promotion. `live.parent_tenant_id = test.id` (live points at the test it came from).
- Test environment stays active permanently after go-live — never archived.

### Three-mode architecture (sealed invariant)

| Mode | GL posting | Use case |
|---|---|---|
| **Lite** | None — workflow only, CSV/XLSX export | Simple companies with an external accounting system |
| **Connected** | Export queue (`posting_batches` table) → external ERP | GL coding in Ziva, posts to SAP/Oracle/etc. |
| **Full ERP** | In-app double-entry (`journal_entries`) | Full GL + financial statements in PRAD |

`posting_mode` lives on `tenant_org_config`. Set by consultant in SA portal — tenants never see or change it. Every module must support all three modes from first commit.

### Role tiers

| Tier | Role | Access |
|---|---|---|
| 1 | Consultant (SA team) | Full access + implementation lock controls |
| 2 | Power Admin (CFO/Finance Director) | Full tenant config; cannot override consultant-locked sections |
| 3 | Functional Admin (HR Manager, etc.) | Only what Power Admin delegates |

---

## 4. Accounting Engine

All financial modules post via double-entry. The posting path is:

1. **Expense approval** → `expense_posting.py` → Full ERP: DR expense / CR AP control; Connected: PostingBatch; Lite: no GL
2. **AP invoice approval** → `ap_posting.py` → DR expense lines / CR AP; Full ERP GL journal
3. **AP payment** → DR AP / CR bank GL
4. **AR invoice approval** → `ar_posting.py` → DR AR control / CR revenue GL
5. **AR receipt** → DR bank / CR AR control
6. **GRN confirm (M11b)** → `po_posting.py` → DR expense GL / CR GRNI accrual
7. **GRNI clearance on invoice approval** → DR GRNI / CR AP
8. **Payroll posting** → DR payroll expense / CR payroll payable, deductions, bank
9. **Fixed asset depreciation** → DR dep expense / CR accum dep
10. **Inventory COGS on ISSUE** → DR COGS / CR inventory GL (WACC cost)

All GL journals: immutable once posted; corrections via reversing entries; always balances (DR = CR verified before save); synchronous in the same DB transaction as the approval (GL failure rolls back the approval).

---

## 5. Module Status (as of 2026-07-29)

> All modules marked ✅ are live in the codebase. Migrations e3f4g5h6i7j8 → k9l0m1n2o3p4 (M16, SA-B, M19, M15, M18, M17, M20) committed in `9ffd9e0`. M17b FIFO/Standard costing migration `l0m1n2o3p4q5` pending CC commit.

| # | Module | Code | Status | Mode |
|---|---|---|---|---|
| 1 | Expense Management | `expense` | ✅ Built (M3–M9) | All |
| 2 | Accounts Payable + PO + Bank Recon | `ap` / `bank_recon` | ✅ Built (M11/M11b/M11c, 2026-07-25) | All |
| 3 | Accounts Receivable | `ar` | ✅ Built (M14, 2026-07-28) | All |
| 4 | OCR & Receipt Scanning | (AI layer) | ✅ Built (M10, 2026-07-25) | All |
| 5 | Financial Statements (P&L + BS + CF) | (Full ERP) | ✅ Built (Q1a/Q1b, 2026-07-24/27) | Full ERP |
| 6 | Budget & Planning | `budget` | ✅ Built (M16, 2026-07-28) | All |
| 7 | SA Billing & Subscriptions | (SA only) | ✅ Built (SA-B, 2026-07-28) | SA |
| 8 | Tax Engine (transaction level) | `tax_engine` | ✅ Built (M19, 2026-07-28) | All |
| 9 | Payroll & HR | `payroll` | ✅ Built (M15, 2026-07-28) | All |
| 10 | Fixed Assets | `fixed_assets` | ✅ Built (M18, 2026-07-28) | All |
| 11 | Inventory & Warehouse | `inventory` | ✅ Built (M17, 2026-07-28) | All |
| 12 | AI Intelligence Layer | (Full ERP gate) | ✅ Built (M20, 2026-07-28) | Full ERP |
| 13 | Vendor Portal | `vendor_portal` | ⏳ Not yet built | All |
| 14 | Customer Portal | `customer_portal` | ⏳ Not yet built | All |
| 15 | POSM Management | `posm` | ⏳ Not yet built | All |
| 16 | Inter-Company Eliminations (IxE) | (Full ERP) | ⏳ Not yet built — PRD: `docs/IxE_PRD.md` | Full ERP |
| 17 | Reporting & Analytics | `reporting` | ⏳ Not yet built as standalone module | All |

---

## 6. Database Schema Overview

> For authoritative column-level detail, see `docs/PROJECT_STATE.md`. This section lists tables grouped by domain.

### Core / Auth
`tenants`, `users`, `user_tenants`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `refresh_tokens`, `audit_logs`, `impersonation_sessions`, `platform_config`, `password_reset_tokens`

### Setup / Config
`tenant_org_config`, `tenant_modules`, `tenant_tax_config`, `tenant_fx_config`, `org_structure`, `employee_onboarding_tokens`, `implementation_locks`, `document_rules`, `system_function_mappings`

### Accounting Periods
`accounting_periods`, `period_grace_overrides`, `future_posting_exceptions`, `close_checklist_items`, `period_checklist_completions`, `fiscal_year_states`, `period_audit_logs`

### Chart of Accounts / Dimensions
`chart_of_accounts`, `tenant_dimensions`, `dimension_values`, `gl_dimension_requirements`, `gl_code_remaps`

### People / HR
`employees`, `employee_code_history`, `employee_transfers`, `employee_position_assignments`, `approval_roles`, `cost_center_config`, `finance_review_config`, `finance_review_steps`

### Expenses
`expense_reports`, `expense_lines`, `expense_report_snapshots`, `tenant_expense_config`, `expense_categories`, `category_gl_mappings`, `expense_documents`, `document_access_log`

### Approvals
`approval_policies`, `approval_role_thresholds`, `expense_approvals`

### GL
`journal_entries`, `journal_lines`, `posting_batches`, `posting_roles`, `tenant_account_mappings`, `tenant_posting_role_settings`, `bank_accounts`

### Accounts Payable + PO
`vendors`, `ap_invoices`, `ap_invoice_lines`, `ap_approvals`, `ap_invoice_snapshots`, `purchase_orders`, `purchase_order_lines`, `po_approvals`, `po_snapshots`, `goods_receipt_notes`, `grn_lines`, `ap_invoice_po_matches`, `po_tolerance_config`

### Bank Reconciliation
`bank_statements`, `bank_statement_lines`, `bank_recon_matches`

### Accounts Receivable
`customers`, `ar_invoices`, `ar_invoice_lines`, `ar_approvals`, `ar_invoice_snapshots`

### Budget & Planning
`budget_periods`, `budget_lines`

### Billing (SA)
`pricing_plans`, `tenant_subscriptions`, `billing_events`

### Tax Engine (transaction level)
`tax_returns`, `wht_certificates`

### Payroll & HR
`salary_structures`, `payroll_runs`, `payroll_lines`, `payslips`, `leave_types`, `leave_requests`, `leave_balances`

### Fixed Assets
`asset_categories`, `assets`, `asset_depreciation_schedules`, `asset_disposals`

### Inventory & Warehouse
`inventory_categories`, `inventory_locations`, `inventory_items`, `stock_movements`

### AI / OCR
`ai_predictions`, `ai_learning_overrides`, `ai_insights`

### CoA Templates (system-wide, no tenant_id)
`coa_templates`, `coa_template_accounts`

---

## 7. API Router Map

| Prefix | Module | File |
|---|---|---|
| `/api/auth/*` | Auth | `routers/auth.py` |
| `/api/users/*` | Profile, 2FA, sessions | `routers/users.py` |
| `/api/tenant/*` | Tenant user management | `routers/tenant.py` |
| `/api/invitations/*` | Public invite flow | `routers/invitations.py` |
| `/api/expenses/*` | Expense reports | `routers/expenses.py` |
| `/api/approvals/*` | Approval matrix + chain | `routers/approvals.py` |
| `/api/documents/*` | File upload/storage | `routers/documents.py` |
| `/api/config/*` | CoA, dimensions, categories | `routers/config.py` |
| `/api/expense-config/*` | Expense form config | `routers/expense_config.py` |
| `/api/setup/*` | Org, periods, modules, currencies, tax | `routers/setup.py` |
| `/api/hr/*` | Employees, positions, leave | `routers/hr.py` |
| `/api/gl/*` | Trial balance, ledger, journals, financial statements | `routers/gl.py` |
| `/api/account-mapping/*` | Posting roles → GL | `routers/account_mapping.py` |
| `/api/bank-accounts/*` | Bank account register | `routers/bank_accounts.py` |
| `/api/posting-batches/*` | Connected-mode export queue | `routers/posting_batches.py` |
| `/api/ap/*` | Accounts Payable | `routers/ap.py` |
| `/api/po/*` | Purchase Orders + GRN + 3-way match | `routers/po.py` |
| `/api/bank-recon/*` | Bank Reconciliation | `routers/bank_recon.py` |
| `/api/ar/*` | Accounts Receivable | `routers/ar.py` |
| `/api/budgets/*` | Budget & Planning | `routers/budget.py` |
| `/api/sa/billing/*` | SA Billing & Subscriptions | `routers/billing.py` |
| `/api/tax/*` | Tax Engine (transaction) | `routers/tax_engine.py` |
| `/api/payroll/*` | Payroll & HR | `routers/payroll.py` |
| `/api/assets/*` | Fixed Assets | `routers/fixed_assets.py` |
| `/api/inventory/*` | Inventory & Warehouse | `routers/inventory.py` |
| `/api/ai/*` | OCR, AI insights, anomaly detection | `routers/ai.py` |
| `/api/platform/*` | Super Admin portal | `routers/platform.py` |
| `/api/app-config` | Dynamic app name (no auth) | `routers/app_config.py` |

---

## 8. Repository Structure (current)

```
ziva-bi/
├── frontend/
│   ├── src/
│   │   ├── app/                    — Next.js 15 App Router pages
│   │   │   ├── auth/               — login, signup, forgot-password, reset-password, change-password
│   │   │   ├── onboard/[token]/    — public employee self-onboarding
│   │   │   ├── platform/           — Super Admin portal
│   │   │   └── dashboard/business/ — Tenant portal (setup + transactional modules)
│   │   │       ├── setup/          — Org, modules, CoA, dimensions, currencies, tax, roles, periods
│   │   │       ├── expenses/       — Expense retirement module
│   │   │       ├── approvals/      — Approval queue
│   │   │       ├── ap/             — Accounts Payable (invoices, vendors, POs, GRNs, aging)
│   │   │       ├── ar/             — Accounts Receivable (invoices, customers, aging)
│   │   │       ├── bank-recon/     — Bank Reconciliation
│   │   │       ├── accounting/     — Manual journal entry, financial statements
│   │   │       ├── payroll/        — Payroll runs, salary structures, leave
│   │   │       ├── inventory/      — Items, locations, movements, valuation
│   │   │       ├── assets/         — Fixed asset register, categories
│   │   │       ├── tax/            — Tax returns, VAT summary, WHT certificates
│   │   │       ├── budget/         — Budget periods and lines
│   │   │       └── ai-insights/    — AI insight browser, anomaly scan
│   │   ├── components/             — Shared UI (Button, PageContainer, PageHeading, Banner, OcrScanModal, etc.)
│   │   ├── contexts/               — AuthContext, AppConfigContext
│   │   └── lib/                    — api.ts, utils.ts, modules.ts
│   ├── Dockerfile                  — multi-stage Alpine build (libc6-compat included)
│   └── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py                 — FastAPI app, CORS, router registration (27 routers)
│   │   ├── config.py               — pydantic-settings (DATABASE_URL, RESEND_API_KEY, Supabase, Anthropic)
│   │   ├── database.py             — async SQLAlchemy engine + AsyncSession
│   │   ├── middleware/auth.py      — require_auth, require_super_admin, impersonation guard
│   │   ├── models/                 — ORM models (one file per domain group)
│   │   ├── routers/                — FastAPI routers (27 files)
│   │   ├── schemas/                — Pydantic schemas (one file per router)
│   │   ├── services/               — Business logic + posting engines
│   │   └── constants/modules.py   — _ALL_MODULES single source of truth
│   ├── alembic/versions/           — 65+ migration files; single-head chain at k9l0m1n2o3p4
│   ├── scripts/                    — seed_demo_tenant.py + cleanup scripts
│   ├── requirements.txt
│   └── .env.example
├── docs/                           — Master docs + active PRDs + cc_results archive
│   ├── MASTER_CONTEXT.md          — Single source of truth (wins all conflicts)
│   ├── MASTER_INSTRUCTION.md      — Coding standards + workflow rulebook
│   ├── MASTER_SYSTEM_SUMMARY.md   — This file
│   ├── PROJECT_STATE.md           — Live codebase snapshot (updated after every CC commit)
│   ├── PENDING_COMMIT.md          — Active commit spec for CC (deleted by CC after commit)
│   ├── CC_RESULT.md               — Latest CC review result
│   ├── ICE_PRD.md                 — Inter-Company Eliminations PRD (not yet built)
│   ├── AUTH_USER_MANAGEMENT_PRD.md
│   ├── Audit_Compliance_Module_PRD.md
│   ├── Vendor_Portal_PRD.md / Vendor_Onboarding_Module_PRD.md / Vendor_Master_Data_Change_Module_PRD.md
│   ├── Expense_Management_Module_PRD.md / M6 Supporting Documents.md
│   ├── RECREATE_ENV_FILES.md      — Ops runbook for env var recovery
│   ├── ZIVA_BI_EVALUATION_2026_07_20.md — Platform evaluation snapshot
│   ├── cc_results/                — Archived CC review results (timestamped)
│   ├── RB/                        — Excel upload templates (CoA, employees, dimensions, etc.)
│   └── archive/                   — Stale working docs (BRIEFs, FIX notes, diagnoses — do not reference)
├── render.yaml                    — Render deployment config (infra-as-code)
├── CLAUDE.md                      — Project instructions for Cowork + CC agents
└── .gitignore
```

---

## 9. Deployment (live on Render as of 2026-07-24)

| Component | Provider | Config |
|---|---|---|
| Backend | Render Web Service (Docker) | `backend/Dockerfile` |
| Frontend | Render Web Service (Docker) | `frontend/Dockerfile` |
| Database | Render managed PostgreSQL | 3-day PITR backup active |
| File storage | Supabase Storage | Bucket: `documents` (private) |
| Email | Resend | `RESEND_API_KEY` env var |
| AI/OCR | Anthropic Vision API | `ANTHROPIC_API_KEY` env var |

**GitHub → Render auto-deploy** is active on `main` branch. Both frontend and backend build automatically on push.

**Migration procedure (post-commit):**
```bash
cd backend && alembic upgrade head
```
CC runs this unconditionally after every successful commit.

---

## 10. Coding Standards Summary

> Full rules in `MASTER_INSTRUCTION.md`. Key non-negotiables:

- Every Python file: module-level docstring + function docstrings + type hints
- Every TypeScript file: typed props/state, no `any` without justification
- All migrations via Alembic — never edit DB directly
- `chart_of_accounts` (not `gl_accounts`) is the canonical FK target for all GL references
- `posting_mode` from `TenantOrgConfig` drives three-mode routing — never hardcode mode-specific forks in feature code
- All AI errors mapped to generic HTTP 503 — tenant must never see "Anthropic" or model names
- No secrets in code — all config via `app/config.py` from env vars
- Every milestone ends with PENDING_COMMIT.md → CC review → commit + push → alembic upgrade head

---

## 11. Key Architecture Decisions (ADRs)

| Decision | Outcome | Reference |
|---|---|---|
| Test-first environment model | Signup creates test tenant only; live born via SA promotion | MASTER_CONTEXT.md §5 M9.0.1 |
| Posting mode = tenant setting, not code fork | `tenant_org_config.posting_mode` drives routing in service layer | §3b |
| Cost centers in `org_structure`, NOT `dimension_values` | Prevents data duplication; single source of truth | MASTER_CONTEXT.md §7 |
| Currency in `tenant_org_config`, NOT `tenant_fx_config` | `tenant_fx_config` holds FX mechanics only | MASTER_CONTEXT.md §12 |
| App name in `platform_config` table | Live rename without redeploy; 5-min cache | MASTER_CONTEXT.md §5 |
| WACC costing for inventory | `moving_average_cost` updated on every RECEIPT | inventory.py |
| AI security — no vendor names in errors | `AiIntelligenceError` wrapper → generic 503 | ai_intelligence.py |
| Supabase Storage now, R2 later | Migrate when >5 tenants or >5 GB stored | MASTER_CONTEXT.md §7 |

---

*End of Master System Summary. Last updated: 2026-07-29.*
