# MASTER INSTRUCTION DOCUMENT — Ziva BI

> The rulebook. Every Claude Code session must follow these.
> If anything conflicts with `MASTER_CONTEXT.md`, that one wins (it's the deepest source of truth).
> Last updated: May 2026

---

## 1. NON-NEGOTIABLE GLOBAL RULES

### 1.1 World-class engineering only

- Production-grade code, never demo code.
- Best practices, industry-standard architecture, clean code.
- Scalable, modular, secure by default.
- No shortcuts. No half-done features. No "TODO: fix later" littered through the codebase.

### 1.2 Mandatory commenting and documentation

**Every file must be readable by a future developer (or Adeniyi) who has zero context.**

Required per file:
- **File header comment** — what this file does, why it exists, how it fits into the system
- **Function/class docstrings** — purpose, parameters, return values, example usage
- **Inline comments** — explain *why* a decision was made, not just *what* the code does
- **Edge cases noted** — anywhere logic handles unusual inputs, document why

Required per module/folder:
- **README.md** — module overview, how to run it, how it connects to other modules
- **API docs** — auto-generated from FastAPI (no excuse to skip)

Required per architectural decision:
- **ADR (Architecture Decision Record)** — short markdown file in `/docs/adr/` explaining why we chose X over Y

### 1.3 Multi-tenancy with full isolation (Business tier)

- Every business-tier table has `tenant_id`.
- No tenant can ever see another tenant's data — enforced at database query level, not just UI.
- Super Admin sees all tenants and all individual accounts.
- Tenant Admin configures only their tenant.
- RBAC is per tenant, configurable.

### 1.4 Account-type awareness (Individual vs Business)

- Two top-level account types: `individual` and `business`.
- UX, available modules, and workflow complexity adapt to type.
- Individuals: simplified single-user flows, mobile-first, no approval routing.
- Businesses: full multi-tenant ERP-style flows with approvals, RBAC, configurations.
- Shared code where possible; divergent UX where needed.

### 1.5 Modular architecture

- Each module is a standalone unit — independently deployable, configurable, testable.
- Modules talk to each other through well-defined interfaces, not direct database calls.
- Adding a new module should not require changes across the whole codebase.
- Modules can be toggled on/off per tenant.

### 1.6 Configurability per tenant (Business tier)

Tenant Admin must be able to configure (without code changes):
- Chart of accounts
- Dimensions (Real IO, Statistical IO, Cost Center, Material IO, Location — naming customisable)
- Form field labels (e.g. rename "P&L Line" to tenant's internal name)
- Approval hierarchies (single or multi-level)
- Tax rules (VAT, WHT, reverse VAT, jurisdiction-based)
- FX rules and rate sources
- Currency settings
- Advance limits per employee/category
- Budget controls
- Role permissions
- Vendor categories
- Inventory costing method
- Credit terms for customers
- OCR usage toggle
- AI auto-categorisation toggle (super admin → tenant → user level cascade)
- Branding and theme
- Document layouts

Individual accounts get sensible defaults but can override common settings (currency, tax jurisdiction).

### 1.7 AI and OCR everywhere

The AI/OCR layer is core, not optional:
- **Receipt/invoice OCR** — line-by-line extraction
- **Tax intelligence** — detect taxable vs non-taxable lines, WHT base, VAT applicability
- **Multi-line invoice handling** — split by line, map to GL/dimensions
- **GL prediction** — based on vendor, description, history
- **Dimension prediction** — Real IO, Stat IO, Cost Center, Material IO
- **Vendor category prediction**
- **Tax category prediction**
- **PO ↔ invoice matching**
- **Bank statement parsing** — multi-line descriptions, multi-page, multi-currency
- **Duplicate invoice detection** — across time, across files
- **Anomaly detection** — unusual amounts, suspicious patterns

Target: <2% error rate. Continuous learning from Finance corrections.

### 1.8 Drag-and-drop everywhere it makes sense

- Uploading receipts, invoices, bank statements
- Rearranging documents to expense lines
- Moving debit/credit adjustments in tax computation
- Dragging budget lines between allowed/disallowed
- Dragging documents into audit folders
- POSM/asset assignment
- Vendor onboarding documents
- Reordering approval flow steps

### 1.9 Build to test from UI

Every role/portal must be testable end-to-end via UI from early milestones:
- Super Admin
- Tenant Admin
- Individual user
- Business employee (requestor, approver, finance, etc.)
- Vendor (via portal)
- Customer (via portal)
- Warehouse/3PL operator
- Auditor

Even before a portal is "complete," Adeniyi should be able to log in as that role and see something.

---

## 2. CLAUDE CODE — HOW TO WORK

### 2.1 Be a Senior PM, not a passive coder

- Actively propose architecture, UX, workflow.
- Recommend the best option when there are tradeoffs.
- Push back when Adeniyi asks for something that conflicts with best practices — explain why and propose alternative.
- Anticipate problems before they happen.

### 2.2 Confirm before coding for major decisions

Before implementing anything that affects architecture, data model, or user flow:
- Summarise the requirement back to Adeniyi
- Propose the approach
- Wait for approval
- Then proceed

Small implementation details don't need confirmation. Use judgement.

### 2.3 Work in milestones, not chunks

We deliver **vertical feature slices** (usable, demoable, deployable), not horizontal layers.

Each milestone:
- Has a clear "done" definition agreed before starting
- Is committed and pushed to GitHub when complete
- Is deployed to Render
- Is tested by Adeniyi before next milestone begins
- Updates `MASTER_CONTEXT.md` with what was built

Claude Code proposes the next milestone; Adeniyi approves before work starts.

### 2.4 Deployment is Render-first

- No local development beyond what's needed for initial scaffolding and quick iteration.
- Every milestone ends with a Render deployment that works.
- Dockerfiles must be Render-optimised.
- GitHub → Render auto-deploy pipeline must always work.
- Environment variables managed via Render dashboard, never hardcoded.
- Secrets never committed to GitHub.

### 2.5 PWA-enabled, mobile-first frontend

- Next.js 14 with App Router
- Installable as mobile shortcut (PWA manifest, service worker)
- Fully responsive — mobile-first design for individuals
- ShadCN UI + TailwindCSS for consistent, modern look

### 2.6 Code quality standards

- **Linting + formatting** — ESLint + Prettier (frontend), Ruff + Black (backend). Pre-commit hooks enforce these.
- **Type safety** — TypeScript (frontend), Python type hints + Pydantic (backend). Strict mode where possible.
- **Tests** — every module ships with at least basic tests. Critical paths (auth, financial calculations, multi-tenancy isolation) require thorough tests.
- **Error handling** — never swallow errors silently. Log meaningfully. Return clear error messages to the user.
- **Logging** — structured logs (JSON in production). No `print` statements in production code.
- **Database migrations** — use Alembic. Every schema change is a migration. Never edit the DB directly.
- **Security** — input validation everywhere, parameterised queries (never raw SQL with user input), JWT properly signed and rotated, passwords hashed (bcrypt/argon2), HTTPS only in production.

### 2.7 Git discipline

- One milestone = at least one well-described commit
- Commit messages follow conventional commits format (e.g. `feat:`, `fix:`, `docs:`, `refactor:`)
- Push to GitHub after every milestone, not just at the end of a session
- Use feature branches for anything risky; merge to main when stable

---

## 3. MODULE REQUIREMENTS (SUMMARY)

> Each module has (or will have) its own PRD with full detail. This section is the high-level summary so Claude Code knows what's coming. Module PRDs in `/docs/` override this section.

### 3.1 Personal Expense Tracking (Individual tier)
- Simple expense entry — date, amount, category, description, receipt upload
- OCR auto-fills from receipt photo
- Categories user-configurable
- Monthly/yearly views, charts, totals
- Export to CSV/PDF
- Mobile-first UX

### 3.2 Personal Income Tracking (Individual tier)
- Income sources (salary, freelance, investments, etc.)
- Recurring income support
- Multi-currency
- Linked to tax module for year-end prep

### 3.3 Personal Tax Prep (Individual tier)
- Jurisdiction-aware (start with UK and Nigeria; add others over time)
- Pulls income + deductible expenses automatically
- Generates summary for filing
- Stores supporting documents

### 3.4 Personal Bank Reconciliation (Individual tier)
- Upload bank statement (PDF, Excel, image)
- Auto-categorise transactions
- Flag duplicates, anomalies
- Reconcile against logged expenses/income

### 3.5 Personal Budget Engine (Individual tier)
- Set monthly/annual budgets per category
- Track actual vs budget
- Alerts when approaching limits

### 3.6 Document Vault (Individual tier)
- Upload, tag, search any document
- Auto-extract metadata via AI
- Organise by year, category, tag

### 3.7 Expense Management (Business tier)
- Multi-line expense retirement
- Mobile + desktop entry (paginated form on mobile)
- OCR + AI auto-fill from receipts
- Dimensions (Real IO, Stat IO, Cost Center, Material IO, Location)
- Duplicate invoice detection
- Per-category monthly spend caps
- Line-level rejection — rejected lines don't post to GL
- Employee dispute mechanism for rejections
- Auto-archive if no employee action after configurable days
- Refund logic — route to AR or payroll deduction (configurable)
- Travel advance retirement with FX tracking, unspent cash refund
- Auto-mapping to budget (BP/FRE/SRE versions)
- Reminders — unsubmitted drafts, advances due for retirement
- Configurable GL posting rules
- Full audit trail

### 3.8 Accounts Payable (Business tier)
- All vendor types: professional services, event agency, clearing agent, 3PL, non-resident, rent/lease, insurance, generic, one-off, etc.
- Workflow varies by vendor type
- PO logic with thresholds; retainer vendors bypass thresholds
- Vendor invoice → PO matching
- WHT rules — vendor-category-based and invoice-line-based
- VAT rules — reverse VAT, self-account VAT
- Advance payments with WHT adjustment on final invoice
- Clearing agent special postings — GIT, prepayment clearing, VAT input extraction, FX rate logic (tenant chooses invoice date vs approval date)
- Automatic accruals — event agency expected cost, clearing agent expected cost
- Multi-currency, multi-level approval

### 3.9 Accounts Receivable (Business tier)
- Sales order: DPS → DPM → Sales Specialist flow
- Credit limit check; cash customer balance check
- Warehouse/3PL auto-receives delivery instruction
- Delivery confirmation drives invoice recognition
- Return workflow with approval
- Real IO + Material IO on revenue and COGS
- Auto stock reduction
- Customer portal: order tracking, statement, auto reconciliation emails
- Service companies (no inventory) also supported

### 3.10 Vendor Portal
- Onboarding via secure link, expires after 30 days
- Form online or PDF upload
- KYC documents
- Operation + GM + Finance approval chain
- Master data updates via controlled workflow
- Vendor can submit invoices, view status, view payments, upload PODs

### 3.11 Customer Portal
- Track orders, deliveries
- Submit return requests
- View statement
- Auto monthly reconciliation email
- See credit limit and balance

### 3.12 Warehouse & 3PL Portal
- Inbound shipments
- Damaged goods tracking (multiple categories)
- POSM issuance/return workflows
- Stock per location
- Valuation methods: standard cost, weighted average, FIFO
- Expiry tracking
- Auto FX conversion on inbound invoices
- Month-end unrealised exchange gain/loss
- PPV posting for standard cost
- Delivery confirmation triggers AR events

### 3.13 Bank Reconciliation (Business tier)
- Upload statements in any format
- Parser handles multi-line descriptions, many pages
- Auto-categorisation
- Auto-matching: customer receipts, vendor payments, payroll, bank charges
- Manual adjustments
- Cleaned Excel output
- Multi-bank, multi-currency
- Outstanding items tracking
- Auto bank reconciliation statement
- Auto journal posting
- Fraud detection suggestions

### 3.14 Payroll (Business tier)
- In-house calculation or consultant comparison
- Configurable statutory rules
- Allowable/disallowable categories
- Accrual postings
- Duplicate payment prevention
- Net-to-pay extraction
- Employee payslip portal
- Outsourced staff (vendor billing of aggregate salaries)
- Leave management (apply, approve, track)
- Tenant configurability of earnings, deductions, tax tables, pension %, statutory formulas

### 3.15 Tax Engine (Business tier)
- Corporate tax computation automated
- Allowable/disallowable expenses (drag-and-drop)
- Configurable per jurisdiction
- Capital allowance rules
- Auto depreciation feed from Fixed Assets module
- Tax loss carried forward
- Deferred tax
- Education tax, police levy, other industry levies
- Effective tax rate tracking
- Journal posting templates
- Multi-year comparison
- Full audit trail

### 3.16 Budget Engine (Business tier)
- Upload via Excel/TXT/PDF
- Cross-check GL and IO existence; prompt for mapping if missing
- Versions: BP → FRE → SRE; system uses latest for comparisons
- Budget owner view: vs actual, project-level, marketing IO breakdown
- Intelligence reporting via scheduled emails

---

## 4. WORKING WITH ADENIYI

### 4.1 Communication style
- Direct, concise, honest. No fluff.
- Push back when something is wrong or risky — don't just agree.
- Explain code as you write it.
- Use plain English wherever possible; explain technical terms when introducing them.

### 4.2 Pacing
- One milestone at a time. Don't sprint ahead.
- Pause if Adeniyi seems confused or hasn't responded — ask if everything is clear.
- Adeniyi has a young son (Nathan) — sessions may pause unexpectedly. Always commit current state when pausing.

### 4.3 Context preservation
- Update `MASTER_CONTEXT.md` after each major milestone.
- All decisions, deviations, and learnings go in there.
- For new chat sessions, the user will paste the Master Context — recognise it and pick up immediately.

### 4.4 What Adeniyi expects
- A working, deployable, world-class product.
- Code so well-commented that any future developer can pick it up.
- Honest assessments — including when something is going badly or taking longer than expected.
- A partner, not a tool.

---

## 5. WHAT NOT TO DO

- ❌ Don't write code without confirmation when the decision is architectural.
- ❌ Don't skip comments or documentation.
- ❌ Don't introduce dependencies casually — every package added is a maintenance burden.
- ❌ Don't hardcode secrets, URLs, or environment-specific values.
- ❌ Don't deviate from the tech stack without discussion.
- ❌ Don't reuse the old NestJS/TypeScript code or its patterns — start fresh.
- ❌ Don't pretend to know something you don't — say "I'm not sure" and propose how to find out.
- ❌ Don't ship a milestone without committing and pushing to GitHub.

---

*End of Master Instruction Document. Treat this as the law of the project.*
