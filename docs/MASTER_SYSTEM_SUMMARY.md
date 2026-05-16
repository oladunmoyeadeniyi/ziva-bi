# MASTER SYSTEM SUMMARY — Ziva BI

> Architecture overview. The "how it's built" reference.
> If anything here conflicts with `MASTER_CONTEXT.md` or `MASTER_INSTRUCTION.md`, those win.
> Last updated: May 2026

---

## 1. Product Vision (recap)

Ziva BI is an intelligent, end-to-end finance and operations automation platform serving **both individuals and businesses**.

**Mission:** *Zero manual work. 100% automation. Intelligent decision-making.*

**Two tiers:**
- **Personal** — individuals managing their own finances
- **Business** — companies of every size and industry, local or multinational

Both tiers share core infrastructure (auth, accounting engine, AI/OCR, document storage); each gets its own UX and module set.

Core capabilities across both tiers:
- AI/OCR automation
- Smart accounting engine (double-entry where applicable)
- Finance-grade validations
- Real-time dashboards and tracking
- Role-based access control (Business tier)
- Audit-ready transparency

---

## 2. Multi-Tenant Architecture (Business tier)

**Model:** Hybrid — shared codebase, isolated tenant data.

### Rules
- All tenants run on the same backend deployment.
- Every business-tier table has `tenant_id` (or links via a foreign key chain to a `tenant_id`).
- Data isolation enforced at the database query layer — every query is automatically scoped to the current tenant.
- Super Admin sees and manages all tenants and all individual accounts.
- Tenant Admin sees and configures only their own tenant.

### Tenant configurability
- Chart of Accounts (uploadable Excel/PDF/TXT)
- Dimensions: Real IO, Stat IO, Cost Center, Material IO, Location
- Number of required dimensions per GL
- Tax rules: WHT, VAT, reverse VAT, custom tax
- Vendor KYC requirements
- Approval workflows (multi-level, variable per module)
- Budget uploads (BP, FRE, SRE, with version history)
- Expense limits and caps per employee/category
- FX rate sources (manual, CBN, ECB, custom feeds)
- Inventory valuation method (standard cost, weighted avg, FIFO, actual landed)
- Accrual system behaviour
- Modules to activate/deactivate
- Branding and theme colours
- Document layouts and invoice templates
- Custom field labels (e.g. rename "P&L Line" to tenant's internal terminology)

### Individual accounts
- No `tenant_id` — scoped by `user_id` only
- Sensible defaults for currency, tax jurisdiction, categories
- User can override common settings

---

## 3. Platform Architecture

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **TailwindCSS** + **ShadCN UI** — enterprise-grade components
- **PWA-enabled** — installable on mobile as a shortcut
- **Mobile-responsive** — mobile-first for individual tier
- TypeScript with strict mode
- State: React Server Components where possible, client state minimal

### Backend
- **Python 3.14**
- **FastAPI** — high performance, auto-generated OpenAPI docs
- **SQLAlchemy** + **Alembic** for ORM and migrations
- **Pydantic** for validation and type safety
- Modular architecture — one folder per module
- Structured logging (JSON in production)
- Comprehensive error handling and validation at every layer
- **JWT authentication** (access + refresh tokens)
- **RBAC engine** for permissions (Business tier)
- **Universal Workflow Engine** (Business tier)

### Database
- **PostgreSQL** (Render managed)
- Migrations only via Alembic — never edit DB directly
- Indexed on `tenant_id`, `user_id`, and common query fields
- Foreign key constraints enforced

### File Storage
- **Cloudflare R2** (S3-compatible)
- All user uploads (receipts, invoices, KYC docs, statements) go here
- Signed URLs for access; never expose direct file paths

### AI/OCR Layer
- Reads invoices, receipts, bank statements, PODs, KYC documents
- Line-by-line extraction
- Vendor-based learning (per tenant)
- Confidence scoring on every prediction
- Multi-document recognition
- Auto-prediction: GL, dimensions, tax categories, vendor categories
- Auto-matching: against POs, budgets, vendor rules
- Continuous learning from Finance corrections
- **Target accuracy: 98%+**

---

## 4. Universal Workflow Engine

Every business-tier module that needs approvals uses the same engine.

### States
`Draft` → `Submitted` → `LM Reviewed` → `GM Approved` → `Finance Reviewed` → `Finance Approved` → `Posted` → `Paid` → `Closed` → `Archived`

Not every module uses every state — tenants can configure which states apply per workflow.

### Actions
- Approve
- Reject
- Request Info
- Split line (where line-level approval is enabled)
- Add attachments
- Override (configurable, audit-logged)
- Auto-return after timeout (configurable)

### Configurability
- Tenant Admin defines who approves at each state
- Single or multi-level approval per module
- Workflow steps can be reordered or skipped per module
- Notifications fire on state transitions
- Full audit trail of every state change

---

## 5. Accounting Engine (Double-Entry)

The system posts journal entries automatically based on GL metadata and tenant configuration.

For every accounting event:
- Auto-determines debit/credit from GL metadata
- Applies the dimension set required for that GL
- Applies tax rules (WHT, VAT, reverse VAT) where applicable
- Applies FX conversion (using tenant's configured rate source)
- Creates reversing entries for accruals
- Supports manual override (if enabled per tenant)
- Maintains full audit trail — who posted, when, what changed
- Always balances (DR = CR) before saving

Individual accounts use simplified single-entry tracking (income/expense categories) but can opt into double-entry if they understand it.

---

## 6. Modules — Build Tier Summary

(Full requirements live in each module's PRD in `/docs/`. This is the architectural summary.)

### Available to Both Tiers (Individual and Business)
- Authentication & User Management
- Document Vault (uploads, tagging, search)
- Bank Reconciliation (simplified for individuals, full for business)
- Budget Engine (personal budgets / corporate budgets)
- Personal/Corporate Tax Prep

### Individual-Only
- Personal Expense Tracking
- Personal Income Tracking

### Business-Only
- Expense Management (with multi-level approvals)
- Accounts Payable
- Accounts Receivable
- Vendor Onboarding
- Vendor Portal
- Customer Portal
- Warehouse / 3PL Portal
- Inventory Management
- POSM Management
- Fixed Assets
- Payroll & HR
- Workflow Approvals Engine
- Tenant Admin
- Inter-Company Eliminations (ICE)
- Audit & Compliance

### Cross-Cutting Infrastructure
- Super Admin (manages all accounts)
- AI/OCR Engine
- Notifications
- Reporting & Analytics

---

## 7. Deployment Strategy

### Environments
- **Development & Testing:** Render
- **Production:** Render to start. Can migrate to AWS/GCP/Azure once scale requires it.

### Architecture
- **Frontend:** Next.js built and served via Render's Web Service
- **Backend:** Dockerised FastAPI service on Render
- **Database:** Render managed PostgreSQL
- **File Storage:** Cloudflare R2
- **CI/CD:** GitHub → Render auto-deploy pipeline

### Environment management
- All secrets and environment-specific values in Render dashboard
- Nothing sensitive committed to GitHub
- Separate environments for dev, staging, production (over time)

---

## 8. Repository Structure

**Monorepo** — single GitHub repo containing both frontend and backend.

```
ziva-bi/
├── frontend/              # Next.js app
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── backend/               # FastAPI app
│   ├── app/
│   │   ├── modules/       # one folder per module
│   │   ├── core/          # shared config, security, db
│   │   ├── workflow/      # universal workflow engine
│   │   ├── accounting/    # double-entry engine
│   │   ├── ai/            # AI/OCR layer
│   │   └── main.py
│   ├── alembic/           # migrations
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── docs/                  # PRDs, ADRs, master docs
│   └── adr/               # architecture decision records
├── .github/               # workflows, issue templates
├── README.md
└── CLAUDE.md              # Claude Code project memory
```

Repo name: **ziva-bi** (single repo, monorepo)
GitHub user: `oladunmoyeadeniyi`

---

## 9. Build Plan — Milestone-Based

We work in vertical feature slices, not horizontal layers. Each milestone is usable, demoable, deployable.

### Phase 1 — Foundation
- **Milestone 1:** Empty monorepo deployed to Render. Frontend serves a placeholder page; backend serves `/health`. PostgreSQL connected. GitHub auto-deploy working.
- **Milestone 2:** User can sign up and log in. Both account types (Individual / Business) selectable. JWT working.
- **Milestone 3:** Individual user can log a personal expense. Saves to DB, shows on dashboard. Mobile-friendly.

### Phase 2 — Business core
- **Milestone 4:** Business account can create a tenant, invite first user. Multi-tenant data isolation enforced.
- **Milestone 5:** RBAC working — roles and permissions configurable per tenant.
- **Milestone 6:** Business employee can submit an expense retirement (mirrors Adeniyi's Red Bull workflow).
- **Milestone 7:** Approval workflow end-to-end. Submitted → LM Approves → Finance Reviews → Posted.

### Phase 3 — Intelligence and modules
- **Milestone 8:** OCR reads a receipt and auto-fills an expense.
- **Milestone 9+:** AP, AR, Bank Recon, Payroll, etc. — priority order decided as we go.

### Phase 4 — Portals and advanced
- Vendor Portal
- Customer Portal
- Warehouse / 3PL Portal
- Super Admin Dashboard
- Budget & Financial Analytics
- Audit & Compliance
- ICE

### Phase 5 — AI deepening
- GL prediction
- Vendor category classification
- AR/AP anomaly detection
- Bank statement enrichment
- Risk scoring

Milestones get refined and reordered as we learn. Claude Code proposes the next; Adeniyi approves.

---

## 10. Quality Standards (cross-reference)

See `MASTER_INSTRUCTION.md` Section 2.6 for full code quality rules. In brief:
- Linting + formatting enforced (Ruff/Black for Python, ESLint/Prettier for TS)
- Type safety required (TypeScript strict, Python type hints, Pydantic)
- Tests for every module, thorough for critical paths
- Migrations via Alembic, never direct DB edits
- Security: parameterised queries, hashed passwords, JWT properly handled, HTTPS only
- Mandatory commenting on every file and function

---

*End of Master System Summary. Update when architecture meaningfully changes.*
