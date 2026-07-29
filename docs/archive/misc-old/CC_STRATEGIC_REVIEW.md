# CC Strategic Review Request — Milestone Roadmap Evaluation

**Date:** 2026-07-20
**From:** Cowork
**To:** CC (Claude Code)

This is NOT a /review-commit request. No code to commit.

You are being asked to evaluate whether the proposed Ziva BI milestone roadmap is correctly ordered, comprehensive, and realistic — and to flag anything that is misplaced, missing, or structurally wrong. Read this entire document before responding.

---

## 1. PRODUCT CONTEXT

Ziva BI is a multi-tenant SaaS finance automation platform. Stack: Next.js 15 / FastAPI / PostgreSQL / Supabase Storage. Deployed via Render (not yet deployed to production — this is the first live deployment).

### Three-mode architecture (core invariant)
Every transaction module must support three posting modes from its first commit. The mode is set per tenant in the SA Portal; tenants never change it.

| Mode | Behaviour |
|---|---|
| **Lite** | Workflow + approve + CSV export only. No GL coding. No internal GL. |
| **Connected** | Full GL coding + dimensions in Ziva BI. Posts to external ERP via `posting_batches` export queue. |
| **Full ERP** | Full GL coding. Posts to internal `journal_entries`. Financial statements generated in-app. |

The user experience is identical across modes. The difference is only in the posting service layer (`expense_posting.py` is the reference pattern).

---

## 2. WHAT HAS ALREADY BEEN BUILT (COMPLETED)

All of the following is done, committed, and on `main`:

**Platform Infrastructure (95% complete)**
- Foundation: Next.js + FastAPI + PostgreSQL monorepo, multi-tenant, Alembic migrations (74 files)
- Auth: JWT (access + refresh), signup, login, roles, invite flow, force-change-password on first login
- User sessions + 2FA (TOTP enroll/verify/disable; session list + revoke)
- User Profile management

**Finance Infrastructure (90% complete)**
- Chart of Accounts (IFRS types, full hierarchy, bulk upload, 3 default templates: FMCG 94 accts, Professional Services 76 accts, Generic 57 accts)
- Dimensions (tenant-configured analytical axes)
- Accounting Periods Engine (generate, grace, close checklist, soft/hard close, year-end, statutory close)
- Currencies & FX (4-tab UI + JSONB backend per tenant)
- Tax & Statutory (VAT/WHT/PAYE/other, JSONB per tenant)
- GL Posting Engine (journal_entries, journal_lines, immutable once posted, reversing entries)
- Trial Balance + Account Ledger (query builders + API endpoints — NO frontend pages yet)
- Account Mapping & Bank Accounts (posting roles → GL catalogue + per-tenant mapping)

**Expense Management (90% complete)**
- Intelligent Expense Form: GL picker hierarchy, dimensions, split lines, AI suggestions
- Coding levels 0–4 (none → full GL)
- Multi-line reports, DRAFT → SUBMITTED → APPROVED flow
- Supporting Documents (Supabase Storage, magic bytes validation, SHA-256 dedup, 15-yr retention)
- Expense Categories + GL Coding Mode Config

**Approval Workflow (95% complete)**
- Designation-based approval policy (ceiling + thresholds on designation, not role_id)
- Finance chain reads FinanceReviewStep records (step-builder output)
- Multi-level approval matrix, advisory steps, selective-tree routing, open step types, function_code per step
- Approval Enhancements: refer-back, audit trail, immutable snapshots, separation-of-duties
- Finance Review Workflow: step builder UI, drag-drop ordering, function-scoped chains
- System Function Mapping: maps business functions to org nodes

**People / HR (70% complete)**
- Org Structure (departments, cost centres, levels)
- Role Hierarchy v2: 3-col PA/FA/UA, area + sub_area disambiguation, occupant avatars, zoom/fullscreen
- Employee management (profiles, transfers, position assignment via approval_roles)
- Employee-User link (employees.user_id FK; cascade deactivate/reactivate)

**Super Admin (SA) Portal (40% complete)**
- Tenant lifecycle: list/detail/lifecycle/suspend/enter/promote
- Consultant config panel: posting mode + module licensing per tenant
- Trials & Signups lead management page
- Create Company (direct SA tenant creation + temp password)
- Nuke Tenant (hard-delete both test+live pair)
- User Impersonation (sub=target user_id; ImpersonationUserBanner; 2 entry points; audit log)
- **Not built:** Billing, SA team management, SA audit logs, SA settings

**Three-Mode Architecture (done)**
- `posting_mode` column on `tenant_org_config`
- `posting_batches` table with all required columns
- `expense_posting.py` routes by mode (Lite: skip; Connected: posting_batch; Full ERP: journal_entries)
- Mode-aware sidebar, implementation portal, ModeNotAvailable component on 5 pages

**Demo / Seed**
- `seed_demo_tenant.py` — idempotent; org, roles, CoA, employees, reports
- Shadow Test Environment clone engine (13-step; on-demand use only after go-live)
- Test-first environment flow inversion + unified promotion engine

**UI Polish**
- Shared Button/PageContainer/PageHeading components (41 files standardised)
- Date-input, tab-state, modal backdrops, Banner component, loading skeletons
- Number formatting consolidated (formatMoney/fmtCommaInput/stripCommas in utils.ts)
- Branding / CSS variable injection (--ziva-primary, sidebar vars; Button uses them)

**NOT YET BUILT (entire transaction modules beyond Expenses):**
- Accounts Payable, Bank Reconciliation, Accounts Receivable
- Manual Journal Entry UI, Financial Statements UI
- OCR / Receipt Scanning
- Budget & Planning, Tax Engine (transaction level), Payroll & HR
- Fixed Assets, Inventory, AI Intelligence Layer

---

## 3. THE PROPOSED ROADMAP (under review)

### TIER 0 — Production Gates *(do before anything else)*

| # | Milestone | Rationale |
|---|---|---|
| P1 | Production Deployment on Render (backend + frontend + DB + domain) | Nothing is sellable on localhost |
| P2 | Email / SMTP (Resend or SendGrid) — invite, password-reset, notifications | All email currently prints to stdout |
| P3 | Schema drift audit (`alembic check`) + `go-live.tsx.bak` git-rm | Prevent migration disaster on live DB |

### TIER 1 — Quick Wins *(backend exists; UI only, ~2 weeks)*

| # | Milestone | Mode scope |
|---|---|---|
| Q1 | Financial Statements UI (P&L, Balance Sheet, Cash Flow output pages) | Full ERP only |
| Q2 | Manual Journal Entry UI (post adjustments, accruals, corrections) | Full ERP only (optional in Connected) |
| Q3 | Snapshot M9 field fix (include gl_id, dimension_values, split_lines in snapshot_data) | All modes |
| Q4 | Split-line GL posting fix (split-parent containers currently skipped at posting) | Connected + Full ERP |

### TIER 2 — Module Expansion *(~2–3 months)*

| # | Milestone | Mode scope |
|---|---|---|
| M10 | OCR & Receipt Scanning (Anthropic Vision API) | All modes — mode-agnostic |
| M11 | Accounts Payable (P2P: vendor invoices, 3-way match, payment runs, AP aging) | L: workflow + CSV / C: + posting_batches / E: + GL posting + AP ledger |
| M11b | Bank Reconciliation (statement import, matching, recon reporting) | L: manual match / C: match to posting_batches / E: match to GL + clearing journal |
| M14 | Accounts Receivable (O2C: customer invoices, receipts, AR aging) | L: workflow + CSV / C: + posting_batches / E: + GL posting + AR ledger |
| SA-B | SA Portal — Billing & Subscription backend (pricing plans, subscription tracking, payment) | SA portal only — mode-agnostic |

### TIER 3 — Strategic Expansion *(~3–6 months)*

| # | Milestone | Mode scope |
|---|---|---|
| M16 | Budget & Planning (budget entry, budget vs actuals, variance alerts) | L: budget vs CSV / C: budget vs posting_batches / E: budget vs GL actuals |
| M19 | Tax Engine — transaction level (VAT on AP invoices, WHT on vendor payments, PAYE) | L: calc + CSV / C: + amounts in posting_batches / E: + auto-post tax journals |
| M15 | Payroll & HR (salary, deductions, payslips, leave management) | L: payroll run + manual pay / C: + posting_batches / E: + salary journal entry |
| ICE | Inter-Company Eliminations (group consolidation, elimination journals) | Full ERP only |

### TIER 4 — Long-term / Specialist

| # | Milestone | Notes |
|---|---|---|
| M18 | Fixed Assets (asset register, depreciation schedules, disposal) | L: register only / C: + depreciation posting_batches / E: + depreciation journals |
| M17 | Inventory & Warehouse (stock, COGS, warehouse locations) | L: stock tracking / C: + COGS posting_batches / E: + COGS journal entries |
| M20 | AI Intelligence Layer (auto-categorisation, anomaly detection, forecasting) | All modes — trains on whichever transaction data exists |
| Perf | Performance & Security Audit (Redis caching, N+1 query sweep, pen test) | Before scale |
| FX | Currencies & FX dedicated tables decision (JSONB vs normalised tables) | Revisit when volume demands it |

---

## 4. SPECIFIC QUESTIONS FOR CC

Please read `CLAUDE.md` (the milestone table section and the TIER 0-4 pending section), `docs/MASTER_CONTEXT.md` (§3, §3b, §4, §5), and `docs/ZIVA_BI_EVALUATION_2026_07_20.md` before answering.

1. **Tier ordering:** Is TIER 0 → TIER 1 → TIER 2 → TIER 3 → TIER 4 the right sequence? Should any milestone be moved to an earlier or later tier? Specifically: should SA-B (billing) be moved earlier, given it's needed to charge customers? Should M10 (OCR) be earlier or later than AP?

2. **Missing milestones:** Is there anything critical to a working finance SaaS that is absent from this entire roadmap? Consider: data exports/reports for Lite-mode customers (CSV/Excel report exports), notifications/webhooks, multi-currency transaction support at the AP/AR level, a public-facing API, customer self-service portal, audit trail export, permission/role enforcement completeness (`role_tier` enforcement is still partial per §11 of MASTER_CONTEXT.md).

3. **Misplaced milestones:** Is anything in the wrong tier — either too early (depends on something not yet built) or too late (a blocker for earlier milestones)?

4. **Three-mode completeness:** For each TIER 2–3 module (AP, Bank Recon, AR, Budget, Payroll, Tax), is the Lite / Connected / Full ERP breakdown correct and complete? Are there mode behaviours that have been mischaracterised?

5. **Quick Wins validity:** Are Q1 (Financial Statements UI) and Q2 (Manual Journal UI) truly frontend-only? Specifically: do the existing Trial Balance and Account Ledger endpoints return data in a format that can be directly rendered as P&L / Balance Sheet / Cash Flow, or will new backend query logic be needed first?

6. **Snapshot fix scope:** Q3 says the snapshot fix is "all modes" but expense snapshots are currently structured around expense lines. Does a snapshot fix have migration implications (ALTER TABLE) or is it purely a change to the serialisation function?

7. **SA Portal billing (SA-B):** Is the current plan (billing backend in TIER 2) the right time, or should a simpler "flag this tenant as paid" tracking be built earlier (TIER 1) and proper payment integration deferred?

8. **Overall assessment:** Given the current codebase (265 commits, ~40% of full product, ~85% of MVP), is this roadmap a realistic path to first revenue, or are there structural issues that would block onboarding a first paying customer even after TIER 0 is complete?

---

## 5. EXPECTED OUTPUT FORMAT

Please respond in `docs/CC_RESULT.md` with:

```
# CC Strategic Review Result

## Verdict: [APPROVED / APPROVED WITH CHANGES / REJECTED]

## Tier ordering: [OK / Issues found]
[Your analysis]

## Missing milestones
[List anything absent, or state "None found"]

## Misplaced milestones
[List anything in wrong tier, with suggested correction, or state "None found"]

## Three-mode correctness
[Any corrections per module]

## Quick Wins validity (Q1/Q2)
[Backend-ready or needs more work first?]

## Snapshot fix scope (Q3)
[Migration needed or serialisation-only?]

## SA-B billing timing
[Keep in TIER 2 or move?]

## Overall assessment
[Can first customer be onboarded after TIER 0 alone? What is the minimum viable scope?]

## Recommended changes to CLAUDE.md
[List specific table edits, if any — otherwise state "None"]
```

If the verdict is APPROVED WITH CHANGES or REJECTED, be specific about what needs to change and why. Cowork will action your recommendations before proceeding.
