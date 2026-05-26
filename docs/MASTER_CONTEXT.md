# MASTER CONTEXT — Ziva BI
> Single source of truth. If anything conflicts with this, **this wins**.
> Last updated: May 2026 — full rewrite by Claude (planning assistant)

---

## 1. PRODUCT VISION

Ziva BI is an intelligent, fully automated, end-to-end business operations platform for companies of every size and industry. It is a world-class, enterprise-grade SaaS product — not a demo, not a prototype.

**Mission:** Zero manual work. 100% automation. Intelligent decision-making.

**Core principles (non-negotiable):**
- Production-grade code at all times — clean, commented, scalable, modular
- Multi-tenant with full data isolation between tenants
- Every feature configurable per tenant — no hardcoded rules
- AI and OCR everywhere — baked in, not bolted on
- Performance is a feature — fast UI, optimised queries, cached where appropriate
- Drag-and-drop support everywhere files or items are moved
- PWA-enabled frontend — installable as mobile shortcut

---

## 2. TECH STACK

- **Frontend:** Next.js 15, React, TailwindCSS
- **Backend:** Python / FastAPI
- **Database:** PostgreSQL (local: `ziva_dev`)
- **File storage:** Supabase Storage
- **Auth:** JWT (access + refresh tokens)
- **Local dev:** Backend on localhost:8000, Frontend on localhost:3000
- **GitHub:** github.com/oladunmoyeadeniyi/ziva-bi
- **Deployment:** Render (when ready — not yet)

---

## 3. PORTAL ARCHITECTURE

Ziva BI has **two portals**, not one:

### 3.1 Super Admin Portal
- Used exclusively by the Ziva BI internal team
- Provisions tenants, controls module licensing, monitors usage, manages billing
- Completely separate from tenant portal
- **Not yet built**

### 3.2 Tenant Portal (one portal, three role tiers)

This is the main portal. It serves both implementation consultants and the company's own staff. Role tier determines what each person sees and can do.

#### Role Tier 1 — Consultant (Ziva BI implementation team)
- Assigned by Super Admin only
- Full access to everything in the tenant
- Can override any configuration
- Can lock/unlock sections for lower tiers
- Can impersonate any user for testing
- Every action logged against consultant account
- Sees "Implementation mode" banner
- Locked settings show lock icon + "Contact your Ziva BI consultant to modify"

#### Role Tier 2 — Power Admin (e.g. Finance Director / CFO)
- Assigned by Consultant
- Full access to all config within their tenant
- Cannot override implementation-locked settings
- Can delegate specific config rights to Functional Admins

#### Role Tier 3 — Functional Admin (e.g. HR Manager, Procurement)
- Assigned by Power Admin
- Access only to what Power Admin has delegated
- e.g. HR can manage employees but cannot touch CoA or dimensions

**Key rule:** Consultant > Power Admin > Functional Admin. Consultants can always override anything.

---

## 4. IMPLEMENTATION SETUP SEQUENCE

When a new tenant is onboarded, the consultant follows this exact sequence. Sections are locked in the UI until prerequisites are met:

1. Organisation — identity, structure (org tree + cost centers), branding, fiscal year
2. Module activation — activate/deactivate modules from full list
3. Chart of Accounts — upload via dynamic template (SOCI/SOFP, FS mappings, dimensions)
4. Dimensions — optional; define dimensions, value types, upload master data
5. Employees — upload template (pre-populated with cost centers); line managers assigned here
6. Currencies & FX — rate sources, realized/unrealized rules, revaluation
7. Tax & Statutory — VAT, WHT, PAYE, non-resident rules
8. Roles & Permissions — permission matrix, user assignments
9. Approval Workflows — per module, drag-and-drop builder
10. Document Rules — required documents per module/transaction type
11. Module Setup — one section per activated module
12. Readiness & Go-live — checklist, mark tenant live

---

## 5. COMPLETED MILESTONES

### M1 — Foundation
Database setup, project structure, base models, multi-tenant architecture.

### M2 — Authentication
JWT auth, login, signup, refresh tokens, invite flow, has_non_admin_role flag in JWT.

### M3 — Business Expense Retirement
Multi-line expense form, draft/submit flow, auto-save with PATCH (not duplicate POST).

### M4 — Approval Workflow
LM to Finance approval chain, approve/reject/refer actions, approval matrix config.

### M5 — Tenant User Management
Invite users, assign roles, deactivate users, team management page.

### M6 — Supporting Documents
File upload per expense line and per report, Supabase Storage integration.

### M7 — Expense Categories & GL Coding Mode
Three GL coding modes. All M7 bugs fixed:
- Duplicate save fixed (PATCH after first POST)
- Save Draft stays on page, redirects to edit page after first save (so attachments work)
- P/L Group hidden in finance/category_mapped modes
- Duplicate Team tab removed
- Tenant Admin is config-only (cannot submit expenses, not in approver dropdowns)

### M8 — Intelligent Expense Form Foundation
- 5 new DB tables: tenant_dimensions, dimension_values, chart_of_accounts, gl_dimension_requirements, expense_categories, category_gl_mappings
- coding_level (int 0-4) replaces gl_coding_mode enum
- show_location and require_location added to tenant_expense_config
- Admin pages: Dimensions, Chart of Accounts, Expense Categories, Expense Config
- 5 coding level cards in Expense Config

### M8.1 — Advanced CoA, Dimensions & Employee Foundation
- CoA template rebuilt: 3-sheet xlsx (GL Accounts + Dimensions Setup + Instructions)
- SOCI/SOFP account types (IFRS-aligned)
- FS Head, FS Note, TB Mapping, Group Account mapping columns
- GL Grouping, Subgroup, Sub-subgroup hierarchy
- Category/subcategory mapping per GL (one-to-many)
- Dynamic dimension columns per tenant in template
- Dimension value types (value_type column)
- Cascading dimension logic (cascade_dimension_id, cascade_value_id)
- Period activation (valid_from, valid_to on dimension values)
- Bulk actions across all master data (select, deactivate, delete, Replace All)
- Employee master data: employees, employee_code_history, employee_transfers tables
- Employee upload template (dynamically generated)
- Employee transfers and code change history
- Employee codes auto-sync as dimension values
- Cost center head config and Finance review config tables
- New admin pages: Employees, Cost Centers, Finance Review

### M9 — Intelligent Expense Form (Employee-facing)
- All 5 coding levels working on expense form
- GL popup flow: group to subgroup to GL selection (popup modal)
- Both "By Category" and "By GL Group" paths in popup
- Dimension fields render dynamically per selected GL
- When line has splits: GL and dimensions hidden on parent, live on each split row
- Dimension type filtering (only valid types per GL shown)
- Cascading dimension auto-fill with lock icon
- Incomplete line: amber border; complete line: green border
- Submit blocked until all lines complete + all documents attached
- Split lines: parent = total amount; splits subdivide it with progress bar
- AI suggestions with confidence thresholds (80%+ auto-fill, 40-79% suggestion pill)
- Drag-and-drop upload zones on line cards and report documents section
- Collapsed line shows compact summary: GL chip, amount, dimension pills, doc indicator

### M9 Bug Fixes (Rounds 1-3) — complete
- Dimension values bulk upload fixed
- Compact line cards
- Split button in line header beside amount
- Split logic corrected (subdivides parent total)
- Upload state fixed
- GL selector slim outlined style
- Collapsed line summary
- Drag-drop upload zones

---

## 6. MODULE LIST (ALL 14)

1. Expense Management (built M3-M9)
2. Accounts Payable
3. Accounts Receivable
4. Payroll & HR
5. Inventory Management
6. Fixed Assets
7. POSM Management
8. Vendor Portal
9. Customer Portal
10. Warehouse / 3PL Portal
11. Bank Reconciliation
12. Budget Engine
13. Tax Engine
14. Reporting & Analytics

---

## 7. KEY DATABASE TABLES

### Core
- tenants, users (email, full_name, first_name, account_type, is_active, is_super_admin), user_roles

### Org & Config
- tenant_expense_config (coding_level, show_location, require_location)
- cost_center_config (cost center head assignments)
- finance_review_config (reviewer chain per module)

### CoA & Dimensions
- chart_of_accounts (gl_number, gl_name, account_type SOCI/SOFP, gl_group, gl_subgroup, gl_sub_subgroup, fs_head, fs_note, tb_mapping, group_account_number, group_account_name, is_active)
- tenant_dimensions (name, code, is_required, is_active, sort_order)
- dimension_values (code, name, value_type, cascade_dimension_id, cascade_value_id, valid_from, valid_to, is_active)
- gl_dimension_requirements (gl_id, dimension_id, requirement: required/optional/na)
- expense_categories (parent_id null for top-level, two-level hierarchy)
- category_gl_mappings (category_id, gl_id, is_default)

### Employees
- employees (employee_code, first_name, last_name, email, cost_center_id, line_manager_id, resumption_date, is_active)
- employee_code_history (old_code, new_code, change_type: retrospective/progressive, effective_date)
- employee_transfers (from_cost_center_id, to_cost_center_id, effective_date)

### Expenses
- expense_reports (header fields)
- expense_lines (gl_id, category_id, dimension_values JSONB, amount, is_split_parent, split_parent_id, flag_incorrect, flag_comment)
- expense_documents (report-level and line-level attachments)

---

## 8. API STRUCTURE

All endpoints tenant-scoped via JWT. Base: /api/

- /auth/* — login, signup, refresh, invite, invite accept
- /api/config/dimensions — CRUD dimensions
- /api/config/dimensions/{id}/values — CRUD + upload values
- /api/config/coa — CRUD + upload + template download
- /api/config/categories — category tree CRUD
- /api/config/expense-config — coding level + form config
- /api/config/cost-centers — cost center head assignments
- /api/config/finance-review — reviewer config
- /api/hr/employees — CRUD + upload + template
- /api/hr/employees/{id}/transfer — cost center transfer
- /api/hr/employees/{id}/update-code — code change
- /api/hr/employees/{id}/history — history
- /api/expenses/reports — CRUD expense reports
- /api/expenses/reports/{id}/lines — CRUD lines
- /api/expenses/reports/{id}/submit — submit for approval
- /api/expenses/suggestions — AI suggestions per employee + GL
- /api/config/gl/search — GL search for Level 4
- /api/documents/reports/{id}/upload — file upload
- /api/approvals — list, approve, reject, refer
- /api/users/me, /api/users/tenant — user management

---

## 9. CODING STANDARDS (NON-NEGOTIABLE)

### Backend
- Every file fully commented: purpose, each function, inputs/outputs, edge cases
- All foreign keys indexed
- Paginate every list endpoint (default 50 per page)
- Never SELECT * — specify columns needed
- Cache tenant config — read constantly, changes rarely
- Single DB round-trip for validation where possible
- Return field-level errors, not generic 400s

### Frontend
- No full page reload on data changes
- Debounce all search inputs (300ms)
- Lazy load heavy components
- Comma-format ALL amount fields everywhere in the app
- Drag-and-drop upload zones on all file upload areas
- Amount inputs: type="text" inputMode="decimal" with fmtCommaInput/stripCommas helpers

### Performance targets
- CoA template generation: under 3 seconds
- Suggestions endpoint: under 200ms
- GL popup category tree: loaded once on page load
- Dimension cascade lookup: cached per tenant session

---

### M8.2 — Implementation Portal Redesign ✅ COMPLETE
- Sidebar: 6-group structure (COMMON DATA | FINANCIALS | PEOPLE | WORKFLOW & ACCESS | MODULE SETUP | GO-LIVE), Tabler outline icons throughout
- Implementation Mode banner for consultant role_tier (amber, 36px, non-dismissable)
- Setup dashboard: progress bar, checklist cards with Tabler icons, correct locked/unlocked sequence per brief, green/amber/grey states
- Organisation page: all identity fields (Legal & registration, Contact & address, Group & currency), Structure tree CRUD + template download + upload, Fiscal year with period generation
- Module activation: split-panel (40/60), subscribed vs available groups, full MODULE_DETAILS per module, is_licensed enforcement (403 on unlicensed activate)
- Dimensions: 3-tab layout (Dimension setup, Master data/values, Not using dimensions?), sequence alert, not-applicable endpoint (POST /api/setup/dimensions/not-applicable)
- Dimension values: Download template button added beside Upload
- CoA: expanded Add/Edit modals (all fields: hierarchy, FS mappings, group reporting), sequence note alert
- Employees: 4-tab layout (Add employees, Employee list, Transfers & changes, Code config), 3 onboarding method cards (bulk upload, HR manual, self-onboarding invite)
- Self-onboarding: public /onboard/[token] page, invite modal, backend token flow
- api.ts: Omit<RequestInit, 'body'> fix for proper object body passing
- Alembic migration l2m3n4o5p6q7: org_structure, fiscal_periods, employee_onboarding_tokens + new columns on tenants + tenant_org_config + tenant_modules

### Login & Auth Fix ✅ COMPLETE (uncommitted — pending push)
Surgical fix applied in May 2026 session to resolve login redirect and welcome message issues:
- **`first_name` column added to users table** — Alembic migration `m3n4o5p6q7r8` (backfills from first word of full_name for existing rows)
- **Backend model** (`app/models/auth.py`): `first_name: Mapped[str | None]` added to User
- **Backend router** (`app/routers/auth.py`): auto-extracts `first_name` from full_name on signup
- **Backend schema** (`app/schemas/auth.py`): `first_name` returned in UserResponse (falls back to `full_name.split(" ")[0]` for existing users without the column)
- **Frontend AuthContext** (`src/contexts/AuthContext.tsx`): `first_name?: string | null` added to AuthUser interface
- **Login page** (`src/app/auth/login/page.tsx`): redirects to `/dashboard/business/setup` after login (was `/dashboard`)
- **Business dashboard** (`src/app/dashboard/business/page.tsx`): uses `user?.first_name` for welcome greeting (fallback to split); removed defunct "Tenant Admin" module card
- **api.ts**: body serialization fix — pre-stringified string bodies passed through without double-encoding

## 10. NEXT MILESTONE — M9 (already complete — see above)

Redesign the Tenant Portal to properly implement the Implementation Portal flow.

### What changes
1. Settings section restructured into: Common Data | Workflow & Access | Module Setup | Go-live
2. Setup Dashboard with progress tracker and locked/unlocked checklist cards
3. Implementation Mode banner for Consultant role
4. Locked settings: visual lock icon + "Contact your Ziva BI consultant to modify"
5. Org Structure page: tree view, upload, cost center mapping
6. Fiscal Year & Periods page
7. Currencies & FX page
8. Tax & Statutory page
9. Document Rules page
10. All Module Setup pages (one per activated module — 14 total)
11. Readiness & Go-live page with blocking/non-blocking checklist
12. Role tier system (Consultant / Power Admin / Functional Admin)

### Wireframe decisions (approved — CC must match exactly)
- Sidebar groups: Common Data | Workflow & Access | Module Setup | Go-live
- Dimensions screen: 3 tabs (Dimension setup / Master data values / Not using dimensions?)
- Organisation screen: 4 tabs (Identity / Structure / Branding / Fiscal year)
- Employees screen: 4 tabs (Employee list / Upload & template / Transfers & changes / Code config)
- Real orders and Statistical orders shown as SEPARATE sub-panels within IO dimension card
- "Not using dimensions?" tab for companies that don't use analytical dimensions
- Line manager assigned in employee upload — NOT in org structure
- All 14 module setup items in sidebar (only activated ones visible)
- Setup dashboard shows checklist cards with locked/unlocked state and progress bar
- Locked cards show greyed state with "Requires X first" message
- Go-live page shows blocking vs non-blocking items; "Mark live" button disabled until blocking items complete

---

## 11. FUTURE MILESTONES

- M10 — OCR & Receipt Scanning (Anthropic Vision API)
- M11 — Accounts Payable
- M12 — Super Admin Portal
- M13 — Bank Reconciliation
- M14 — Accounts Receivable
- M15 — Payroll & HR
- M16 — Budget Engine
- M17 — Inventory & Warehouse
- M18 — Fixed Assets
- M19 — Tax Engine
- M20 — AI Intelligence Layer (98%+ accuracy target)
- UI Polish Milestone — global UI overhaul (do not fix UI piecemeal before this)

---

## 12. KNOWN ISSUES / TECH DEBT

- **Login fix uncommitted** — changes to auth.py, routers/auth.py, schemas/auth.py, login/page.tsx, AuthContext.tsx, api.ts, and migration m3n4o5p6q7r8 are staged but not yet committed or pushed to GitHub
- **Migration m3n4o5p6q7r8 not applied to production** — must run `alembic upgrade head` on Render after pushing
- "Invalid or expired token" errors on some admin pages — restart backend + re-login (likely stale JWT without new fields; fixed once migration runs and users re-login)
- UI polish deferred to dedicated milestone — do not fix piecemeal

---

*End of Master Context. Last updated: May 2026.*
