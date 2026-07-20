# Ziva BI — Platform Evaluation
**Date:** 2026-07-20  
**Prepared by:** Cowork (against live codebase + git log + PROJECT_STATE.md)  
**Purpose:** Authoritative state-of-platform report. Reviewed by CC before use. Supersedes any prior milestone summaries.

---

## 1. EXECUTIVE SUMMARY

Ziva BI has a **production-grade, enterprise-quality foundation**. The core finance automation stack — multi-tenant infrastructure, expense management (end-to-end), the GL engine, approval workflows, people management, and the full implementation/SA portal — is working and well-tested. That is roughly **40% of the full product vision by feature weight**.

What this means practically:

- A small-to-medium company could use Ziva BI **today** for expense management with full GL coding and audit trail — it is commercially usable.
- A finance team using Full ERP mode has a real, live accounting system: CoA → expense → approve → GL post → trial balance.
- The platform is **not yet deployed on Render** (still localhost). Production deployment is the single highest-priority action before any commercial conversation.

The remaining 60% is the transaction modules (AP, AR, Bank Recon, Payroll, Budget, Inventory, Fixed Assets) and supporting infrastructure (Financial Statements UI, OCR, full email, billing). These are **independent and can be built in sequence**. No architectural rework is needed — the foundation handles them cleanly.

**Overall completion: ~40% of full product vision. ~85% of MVP-for-first-customer.**

---

## 2. WHAT WE'VE BUILT

### 2.1 Platform Infrastructure (95% complete)

The hardest part of any SaaS product is the platform plumbing. This is done.

| Component | Status | Notes |
|---|---|---|
| Multi-tenant architecture | ✅ Done | Full data isolation via tenant_id on every table; test + live environments per tenant |
| JWT auth (access + refresh) | ✅ Done | Token rotation, replay detection, session tracking |
| 2FA (TOTP) | ✅ Done | Enroll/verify/disable; sessions list with per-session revoke |
| Role-based access (3 tiers) | ✅ Done | Consultant > Power Admin > Functional Admin; role_tier enforcement partial (JWT + column exist; full gate sweep not done) |
| Test-first tenant lifecycle | ✅ Done | Signup creates test; live born only via SA promotion. Bidirectional promotion engine handles first + repeat promotions |
| SA Portal — tenant lifecycle | ✅ Done | List/detail/lifecycle transitions/suspend/reactivate/enter tenant |
| SA Portal — impersonation (tenant-level) | ✅ Done | Implementation + support modes; sidebar hides workspace in these modes |
| SA Portal — user impersonation | ✅ Done | Sub = target user_id; ImpersonationUserBanner; 2 entry points; audit log |
| SA Portal — create company | ✅ Done | Direct SA tenant creation, auto-generated temp password, must_change_password flow |
| SA Portal — nuke tenant | ✅ Done | Hard-delete both test+live pair; lifecycle guard; confirm param |
| SA Portal — trials & signups | ✅ Done | Lead management queue; lead_status tabs; inline notes; one-click activation |
| SA Portal — consultant config panel | ✅ Done | Set posting mode + module licenses per tenant |
| Three-mode architecture (Lite/Connected/Full ERP) | ✅ Done | posting_mode on org_config; mode-aware sidebar, pages, setup sequence, expense config |
| Demo seed script | ✅ Done | Idempotent seeder; realistic org, roles, CoA, employees, expense reports |
| Force-change-password on first login | ✅ Done | must_change_password flag; un-skippable change-password page |
| Document security | ✅ Done | Magic bytes, ZIP-structure validation, SHA-256 dedup, WebP/PDF compression, 15-yr retention, access log, 15-min signed URLs, deletion guard |
| Branding (CSS variable injection) | ✅ Done | --ziva-primary and sidebar vars from org config; Button primary variant uses them |
| Mode-aware implementation portal | ✅ Done | Sidebar + pages + expense config fully respond to posting_mode |
| Email / SMTP | ⚠️ Stubbed | Invitations and notifications only print to stdout unless SMTP env vars configured |
| SA Portal — billing, team, audit, support, settings | ⚠️ Frontend stubs only | No backend wired |
| Production deployment (Render) | ❌ Not done | Code is ready; never deployed; still localhost only |
| Self-service trial provisioning | ❌ Not started | Tenants created manually by SA team only |

---

### 2.2 Finance Infrastructure (90% complete)

Everything a finance team needs to run a GL — except the formatted output (Financial Statements).

| Component | Status | Notes |
|---|---|---|
| Chart of Accounts (IFRS-aligned, full hierarchy) | ✅ Done | SOCI/SOFP types; FS Head/Note, TB mapping, GL grouping; bulk upload; Replace-All + Remap; CoA remap (retire codes in live mode) |
| Default CoA templates | ✅ Done | 3 templates: FMCG (94 accounts), Professional Services (76), Generic (57); smart re-download pre-fills from existing CoA |
| Dimensions (cascading, bulk upload) | ✅ Done | Value types, cascade logic, period activation |
| Account Mapping (posting roles → GL) | ✅ Done | Posting role catalogue; per-tenant GL mapping; control-account overrides |
| Bank Accounts register | ✅ Done | Currency, default-per-currency rule, GL must be BS/SOFP |
| Accounting Periods (full lifecycle) | ✅ Done | Generate, open, soft-close, hard-close, statutory close; grace windows; future-posting exceptions; close checklist with SOD; year-end audit log; auto-generation on org save + last hard-close |
| Currencies & FX | ✅ UI done / ⚠️ JSONB backend | 4-tab UI complete; backend is JSONB in org_config + fx_config (not dedicated tables). BDC register is UI only — no table. Open decision: stay JSONB or migrate to dedicated tables. |
| Tax & Statutory | ✅ Done | VAT, WHT, PAYE, other; JSONB per tenant |
| GL Posting Engine | ✅ Done | Synchronous at final approval; journal_entries/journal_lines; immutable once posted; reversing entries for corrections; mode-aware (Lite=skip, Connected=posting batch, Full ERP=GL) |
| Trial Balance + Account Ledger | ✅ Done | Query builders with date range + dimension filters; API endpoints exist |
| Financial Statements UI (P&L, BS, Cash Flow) | ❌ Not started | Backend data is there (GL + TB + Ledger APIs); zero formatted output pages |
| Manual Journal Entry UI | ❌ Not started | Tables exist; no router endpoints or frontend pages |
| Posting Batches (Connected mode) | ✅ Done | CRUD + export + mark-synced endpoints; posting_batches table |

---

### 2.3 Expense Management (90% complete)

The most mature module. End-to-end and working.

| Component | Status | Notes |
|---|---|---|
| Multi-line expense reports (DRAFT → SUBMITTED) | ✅ Done | |
| 5 GL coding levels (0-4) | ✅ Done | Employee-facing GL picker, category selection, dimension fields |
| AI GL suggestions | ✅ Done | 80%+ auto-fill, 40-79% suggestion pill |
| Split lines | ✅ Done | Parent = total; splits subdivide; progress bar; per-split GL + dimensions |
| Supporting documents | ✅ Done | Per-line and per-report; Supabase Storage; security hardening applied |
| GL popup picker (hierarchy) | ✅ Done | Group → Subgroup → GL; search tab |
| Expense categories + GL mappings | ✅ Done | Two-level tree; default GL per subcategory |
| Number formatting (unified) | ✅ Done | formatMoney/fmtCommaInput/stripCommas from utils.ts; no local duplicates |
| Split-line GL posting | ⚠️ Known issue | Split parent containers skipped at posting (gl_id=NULL on parent); workaround: uncoded check blocks submit. Needs fix before full-ERP mode is reliable with splits |
| Snapshots missing M9 fields | ⚠️ Known issue | snapshot_data doesn't include gl_id, dimension_values, split data — historical snapshots incomplete |
| OCR & Receipt Scanning | ❌ Not started | |

---

### 2.4 Approval Workflow (95% complete)

Highly sophisticated. Multi-level, designation-based, with advisory steps, finance chains, and full audit.

| Component | Status | Notes |
|---|---|---|
| Multi-level approval (1-3 levels) | ✅ Done | |
| Org-tree routing | ✅ Done | Routes up the org tree automatically |
| Selective-tree routing | ✅ Done | designation-based; configured per policy |
| Designation-based approval policies | ✅ Done | ceiling_designation, finance designations, threshold per designation; fully replaces old role_id approach |
| Advisory steps | ✅ Done | is_advisory; non-blocking; all-advisory guard at submit |
| Finance Review chain | ✅ Done | Reads FinanceReviewStep records ordered by level; designation-keyed; was dead code until this session |
| Refer-back (lower level or requestor) | ✅ Done | |
| Audit trail | ✅ Done | Immutable audit log; snapshot at submission |
| Approval matrix UI | ✅ Done | Full rebuild; threshold + step builder; finance chain builder |
| Policy API | ✅ Done | Create/read/update/delete policies; finance steps bulk-replace |

---

### 2.5 People / HR (70% complete)

Foundation is solid; full HR module (leave, benefits, payroll) is not started.

| Component | Status | Notes |
|---|---|---|
| Employee master data | ✅ Done | Bulk upload; code history; transfers; cost_center_id → org_structure |
| Role Hierarchy (3-col, drag-drop) | ✅ Done | PA/FA/UA columns; area/sub-area disambiguation; occupant avatars; zoom/fullscreen; localStorage |
| Employee-User link | ✅ Done | employees.user_id FK; cascade deactivate/reactivate/delete; user_type (employee/external) |
| Employee Position Assignments | ✅ Done | Positions = approval_roles; employee_position_assignments FKs approval_roles |
| Finance Review Workflow | ✅ Done | Step builder; function-scoped chains; drag-drop ordering |
| System Function Mapping | ✅ Done | Maps business functions (finance/hr/procurement/etc.) to org nodes |
| Self-onboarding (employee) | ✅ Done | Token flow; public /onboard/[token] page. ⚠️ Invite link prints to stdout |
| Cost center heads | ✅ Done | |
| Leave management | ❌ Not started | |
| Payroll | ❌ Not started | |
| Benefits / HR module | ❌ Not started | |

---

### 2.6 Super Admin Portal Backend (40% complete)

Tenant management is done. The commercial-facing side (billing, subscriptions) is shells only.

| Component | Status | Notes |
|---|---|---|
| Tenant lifecycle | ✅ Done | |
| Impersonation | ✅ Done | Both levels |
| Trials & signups | ✅ Done | |
| Consultant config | ✅ Done | |
| Billing & subscription management | ❌ Frontend stub only | Needed before charging customers |
| Team management (SA team) | ❌ Frontend stub only | |
| Audit log viewer (SA-wide) | ❌ Frontend stub only | |
| Support tools | ❌ Frontend stub only | |
| Settings | ❌ Frontend stub only | |

---

### 2.7 Transaction Modules — Not Started (0%)

| Module | Status |
|---|---|
| Accounts Payable (P2P: vendor invoices, payment runs) | ❌ 0% |
| Accounts Receivable (O2C: customer invoices, receipts) | ❌ 0% |
| Bank Reconciliation | ❌ 0% |
| Budget & Planning | ❌ 0% |
| Tax Engine (transaction-level: VAT on invoices, WHT, PAYE payroll) | ❌ 0% |
| Inventory & Warehouse | ❌ 0% |
| Fixed Assets | ❌ 0% |

---

## 3. COMPLETION PERCENTAGE

### By feature weight (full product = 100%)

| Domain | Weight | Built | Points |
|---|---|---|---|
| Platform Infrastructure | 15% | 90% | 13.5 |
| Finance Infrastructure | 15% | 85% | 12.75 |
| Expense Management | 10% | 90% | 9.0 |
| Approval Workflow | 8% | 95% | 7.6 |
| People / HR Foundation | 5% | 70% | 3.5 |
| Reporting / Financial Statements | 6% | 10% | 0.6 |
| SA Portal (full — incl. billing) | 4% | 40% | 1.6 |
| Accounts Payable | 12% | 0% | 0 |
| Accounts Receivable | 8% | 0% | 0 |
| Bank Reconciliation | 5% | 0% | 0 |
| Budget & Planning | 5% | 0% | 0 |
| Tax Engine (transaction-level) | 3% | 0% | 0 |
| Payroll & HR (full) | 7% | 5% | 0.35 |
| Inventory & Warehouse | 5% | 0% | 0 |
| Fixed Assets | 4% | 0% | 0 |
| OCR & AI | 5% | 0% | 0 |
| **TOTAL** | **100%** | — | **~49 / 100 ≈ 40%** |

**Verdict: ~40% of the full product vision is complete.**

### Commercial readiness by use case

| Use Case | Readiness | Blocker |
|---|---|---|
| Expense management SaaS (workflow only) | **90%** | Need production deployment + email |
| Expense management with Full GL coding | **85%** | Need production deployment + email + split-line posting fix |
| Full ERP for small companies | **55%** | Need AP, AR, Financial Statements |
| Full ERP for mid-size companies | **40%** | All of the above + bank recon + payroll |

---

## 4. THREE-MODE BUILD IMPLICATIONS

Every transaction module must be designed for all three modes from the first commit. This is a non-negotiable architectural invariant established in §3b of MASTER_CONTEXT.md. Mode determines only where transactions land at the end — the user experience and GL coding interface are identical across modes.

### What "mode-aware" means in practice for each pending module

| Module | Lite (L) | Connected (C) | Full ERP (E) |
|---|---|---|---|
| **Financial Statements UI** | `ModeNotAvailable` page — no GL data | `ModeNotAvailable` — GL is in external ERP | P&L, Balance Sheet, Cash Flow from `journal_entries` |
| **Manual Journal Entry UI** | `ModeNotAvailable` | Optional (pre-export adjustments) | Required — daily accountant tool |
| **Accounts Payable** | Vendor bill submit → approve → CSV export (no GL) | + GL coding → `posting_batches` → external ERP | + GL posting → `journal_entries` + AP ledger |
| **Bank Reconciliation** | Statement import + manual match | Match to posting batches + export recon entry | Match to GL bank account + clearing journal |
| **Accounts Receivable** | Customer invoice submit → approve → CSV export | + GL coding → `posting_batches` | + GL posting → AR ledger |
| **Budget & Planning** | Budget vs CSV export values | Budget vs posting batch amounts | Budget vs GL actuals from `journal_entries` |
| **Tax Engine (transaction)** | Tax calc on invoice, CSV output only | + VAT/WHT amounts in posting_batches | + Auto-post VAT payable / WHT payable journals |
| **Payroll** | Payroll run + manual bank transfer | Payroll run + posting_batches for salary | Payroll run + salary journal entry |
| **Fixed Assets** | Asset register only | + depreciation posting_batches | + depreciation journal entries |
| **Inventory** | Stock tracking only | + COGS posting_batches | + COGS journal entries |
| **OCR, AI Layer** | Mode-agnostic | Mode-agnostic | Mode-agnostic |
| **ICE** | N/A | N/A | Full ERP only |

### Build sequence rule for each module

When starting any TIER 2+ module:
1. Design the data model and workflow to be mode-agnostic at the transaction level
2. The **posting service** is the only place mode branching happens (same pattern as `expense_posting.py`)
3. Add a `ModeNotAvailable` guard on pages that only apply to specific modes (same as CoA/Dimensions/Tax pages)
4. The **SA portal consultant config** already controls mode per tenant — no new mode-selection UI needed

---

## 5. PRODUCTION BLOCKERS (must fix before first customer)

These are non-negotiable before any commercial conversation:

1. **Production deployment on Render** — the product is not live anywhere. Zero revenue, zero users, zero proof. This is #1.
2. **SMTP email** — invitations print to stdout. Tenant admins cannot invite employees without email.
3. **Schema drift audit** — CC flagged during task #52 that `alembic check` may show ORM/migration drift. Must verify before Render deploy (a bad migration on a live DB is catastrophic).
4. **alembic upgrade head on Render** — migration `s1t2u3v4w5x6` must run on production when deployed.
5. **`go-live/page.tsx.bak` cleanup** — accidentally committed stale backup file; needs `git rm`.
6. **Split-line GL posting bug** — split-parent containers skipped; uncoded lines block posting but the UX is confusing. Fix before marketing Full ERP.

---

## 6. UPDATED PRIORITY ROADMAP

Ordered by: commercial impact × build speed × strategic position.

### TIER 0 — Production (immediate, ~1 week)
These are gates. Nothing else matters until these are done.

| # | What | Why |
|---|---|---|
| P1 | Render deployment + domain + env vars | App must be live before any customer conversation |
| P2 | SMTP email (Resend or SendGrid) | Invitations, notifications, password resets — broken without this |
| P3 | Schema drift audit + `go-live.tsx.bak` cleanup | Must be clean before live data hits Render |

### TIER 1 — Quick wins: high value, backend already exists (~2 weeks)
| # | What | Why |
|---|---|---|
| Q1 | Financial Statements UI (P&L, Balance Sheet, Cash Flow) | Every finance team needs this; GL engine already posts the data; just need the output pages |
| Q2 | Manual Journal Entry UI | Accountants need to post adjustments; tables + GL engine already there |
| Q3 | Snapshot M9 fields fix | Current snapshots are incomplete (missing gl_id, dimension_values, splits) |

### TIER 2 — Module expansion (~2-3 months)
| # | What | Why |
|---|---|---|
| M10 | OCR & Receipt Scanning | Biggest differentiator for expense management; Anthropic Vision API; fastest reduction in admin time |
| M11 | Accounts Payable (P2P) | Most critical missing module; high daily pain for any finance team; needed for "full ERP" claim |
| M11b | Bank Reconciliation | Flows directly from AP; cannot run AP without reconciling bank |
| M14 | Accounts Receivable (O2C) | Revenue-side; needed for companies that invoice clients |
| SA-B | SA Portal billing / subscription | Needed to charge customers and track plan tiers |

### TIER 3 — Strategic expansion (~3-6 months)
| # | What | Why |
|---|---|---|
| M16 | Budget & Planning | CFOs need budgets vs actuals reporting; high retention driver |
| M19 | Tax Engine (transaction-level) | VAT on AP invoices, WHT on vendor payments; needed for Nigerian compliance |
| M15 | Payroll & HR | Complex; but a major competitive moat if done well |
| ICE | Inter-Company Eliminations | Group companies; PRD already exists (`docs/ICE_PRD.md`) |

### TIER 4 — Long-term / specialist
| # | What | Why |
|---|---|---|
| M18 | Fixed Assets | Needed for capital-intensive companies |
| M17 | Inventory & Warehouse | Complex; narrows market fit vs. broadening it |
| M20 | AI Intelligence Layer | Auto-categorization, anomaly detection, forecasting — built on top of transaction history |
| Perf | Performance & Security Audit | Redis caching, N+1 query sweep, pen test — before scale |
| Cloud | Cloudflare R2 migration (from Supabase Storage) | Cost reduction + zero egress fees when storage > 5 GB |

---

## 7. OPEN DECISIONS

These are unresolved architectural questions that must be decided before building anything that depends on them:

| Decision | Options | Recommendation |
|---|---|---|
| Currencies & FX: JSONB vs dedicated tables | Stay JSONB (current) vs. migrate to `tenant_currencies`/`tenant_fx_rates`/`tenant_bdc_entries` | Stay JSONB for now; revisit only if BDC register volume is large or multi-currency transaction reporting needs row-level querying. Not blocking any current build. |
| role_tier enforcement sweep | Partial (current) vs. full enforcement across all endpoints | Do this sweep before first customer — a power_admin must not be able to call SA-only endpoints |
| Snapshot M9 fields | Existing snapshots are incomplete | Fix the snapshot serializer to include gl_id, dimension_values, split_lines. Old snapshots stay incomplete (historical); new ones will be complete |

---

## 8. TECHNICAL HEALTH

The codebase is in good shape overall. Specific items to watch:

- **265 commits** since project start — consistent, well-documented git history
- **72 Alembic migrations** — single-head chain; each migration is named and purposeful
- **74 backend files** across 17 routers + services + models
- **49 frontend pages** across business, setup, platform, and auth flows
- **0 TypeScript errors** (last `tsc --noEmit`)
- **0 Python compile errors** (last `py_compile` sweep)
- Known unconfirmed suspicion: `alembic check` may show ORM/migration drift (flagged by CC during task #52). Investigate before Render deploy.
- `go-live/page.tsx.bak` accidentally committed — needs `git rm`.
- Separation-of-duties flag (`is_restricted_impersonation`) is wired but no actual field masking done (payroll not built yet — that's fine).

---

*This document is for planning and communication. Treat it as the reference going forward, not CLAUDE.md (CLAUDE.md is the living file — it will be updated to match this evaluation via PENDING_COMMIT.md).*
