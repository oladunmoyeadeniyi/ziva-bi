# M8.2 — Fixes & Enhancements
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## CRITICAL INSTRUCTIONS — READ BEFORE TOUCHING ANY CODE

1. Read docs/MASTER_CONTEXT.md fully before starting
2. This brief is the result of thorough testing and design review. Follow it exactly.
3. Every fix is described precisely. Do not interpret loosely. Do not add unrequested features.
4. Do not touch any expense form code (M9). Do not touch approval workflow code. Do not touch team management code.
5. Test every change locally before committing.
6. When in doubt about a design decision, follow the wireframe description in this brief exactly.

---

## SECTION 1 — SIDEBAR RESTRUCTURE (BREAKING CHANGE)

The current sidebar structure is wrong. Replace it entirely.

### New sidebar structure (exact order, exact labels)

```
COMMON DATA                    ← section label (non-clickable)
  Setup dashboard              → /dashboard/business/setup
  Organisation                 → /dashboard/business/setup/organisation
  Module activation            → /dashboard/business/setup/modules

FINANCIALS                     ← section label (non-clickable)
  Dimensions                   → /dashboard/business/settings/dimensions
  Chart of accounts            → /dashboard/business/settings/chart-of-accounts
  Expense categories           → /dashboard/business/settings/expense-categories
  Currencies & FX              → /dashboard/business/setup/currencies
  Tax & statutory              → /dashboard/business/setup/tax

PEOPLE                         ← section label (non-clickable)
  Employees                    → /dashboard/business/settings/employees
  Cost centers                 → /dashboard/business/settings/cost-centers

WORKFLOW & ACCESS              ← section label (non-clickable)
  Roles & permissions          → /dashboard/business/setup/roles
  Approval workflows           → /dashboard/business/settings/approval-matrix
  Document rules               → /dashboard/business/setup/documents
  Team                         → /dashboard/business/settings/team

MODULE SETUP                   ← section label (non-clickable)
  (dynamically rendered — only show modules that are active in tenant_modules)
  If no modules active: show muted text "Activate modules first"
  Each active module links to: /dashboard/business/setup/modules/{module_key}

GO-LIVE                        ← section label (non-clickable)
  Readiness & go-live          → /dashboard/business/setup/go-live
```

### Sidebar rules
- Section labels: uppercase, 10px, muted color, non-clickable, padding 8px 14px
- Active nav item: white background, 0.5px border, font-weight 500
- Each nav item has a Tabler outline icon (not emoji, not filled icons)
- Sidebar scrolls independently

### Icon assignments
- Setup dashboard: ti-layout-dashboard
- Organisation: ti-building
- Module activation: ti-puzzle
- Dimensions: ti-vector
- Chart of accounts: ti-file-spreadsheet
- Expense categories: ti-sitemap
- Currencies & FX: ti-currency-dollar
- Tax & statutory: ti-receipt-tax
- Employees: ti-users
- Cost centers: ti-building-community
- Roles & permissions: ti-key
- Approval workflows: ti-git-merge
- Document rules: ti-file-check
- Team: ti-user-plus
- Readiness & go-live: ti-rocket
- Module icons: expense=ti-receipt, ap=ti-invoice, ar=ti-credit-card, payroll=ti-wallet, inventory=ti-package, fixed-assets=ti-chart-pie, posm=ti-tags, vendor-portal=ti-truck, customer-portal=ti-user-check, warehouse=ti-building-warehouse, bank=ti-building-bank, budget=ti-chart-bar, tax-engine=ti-calculator, reporting=ti-chart-dots

---

## SECTION 2 — SETUP DASHBOARD FIXES

**Route:** `/dashboard/business/setup`

### Fix 1 — Replace emoji icons with Tabler outline icons
Every checklist card must use a Tabler outline icon (ti-*), not emoji. Use the icon assignments from Section 1.

### Fix 2 — Fix completion logic
The backend endpoint `GET /api/setup/progress` must calculate section status correctly:

```python
# organisation: complete if tenant_org_config has legal_name AND functional_currency set
# modules: complete if at least 1 module is active in tenant_modules
# dimensions: complete if dimensions marked not_applicable OR all configured dimensions have at least 1 value uploaded; in_progress if dimensions exist but some have 0 values
# coa: complete if chart_of_accounts table has at least 1 active GL for this tenant
# employees: complete if employees table has at least 1 active employee for this tenant
# currencies: complete if functional_currency is set in tenant_org_config (auto-completes with org)
# tax: complete if tenant_tax_config has at least one rule configured
# roles: complete if at least 1 user with role_tier='power_admin' exists for this tenant
# workflows: complete if at least 1 approval workflow is configured
# documents: complete if manually marked complete by consultant (new boolean field: documents_setup_complete on tenants table)
# module_setup: in_progress if any modules active; complete if all active modules have been visited and saved (track via new module_setup_visited JSONB field on tenants table)
# golive: locked until all blocking sections complete
```

### Fix 3 — Correct locked/unlocked logic
Sections unlock in this exact sequence:
- Organisation: always unlocked
- Module activation: always unlocked
- Dimensions: unlocked after Organisation is complete
- Chart of accounts: unlocked after Dimensions is complete (or dimensions marked not_applicable)
- Employees: unlocked after Chart of accounts is complete
- Currencies & FX: unlocked after Organisation is complete
- Tax & statutory: unlocked after Organisation is complete
- Roles & permissions: unlocked after Employees is complete
- Approval workflows: unlocked after Roles & permissions is complete
- Document rules: unlocked after Module activation is complete
- Module setup: unlocked after Chart of accounts AND Dimensions are complete
- Go-live: unlocked when ALL blocking sections are complete

Locked cards: greyed out (opacity 0.5), cursor not-allowed, subtitle shows "Requires X first"
Completed cards: green border (0.5px solid var(--color-border-success))
In-progress cards: amber dot indicator

### Fix 4 — Implementation mode banner
Show a banner between the topbar and the page content when user has role_tier='consultant':
- Background: var(--color-background-warning)
- Border bottom: 0.5px solid var(--color-border-warning)
- Height: 36px, padding 0 16px
- Content: shield-check icon + "Implementation mode — you have full override access. All changes are logged against your consultant account."
- Font size: 11px, color: var(--color-text-warning)
- NOT shown to power_admin or functional_admin users

---

## SECTION 3 — ORGANISATION PAGE FIXES

**Route:** `/dashboard/business/setup/organisation`

### 3.1 — Identity tab — add missing fields

The current Identity tab is missing many fields. Restructure it into 3 sections with these exact fields:

**Section: Legal & registration**
- Legal name * (text input)
- RC / Company registration number (text input)
- Date of registration (date input)
- Business commencement date (date input)
- Company type (dropdown: Private Limited (Ltd), Public Limited (PLC), Partnership, Sole Trader, NGO / Non-profit, Government / Public sector, Other)
- Industry (dropdown: FMCG / Consumer goods, Manufacturing, Logistics / 3PL, Professional services, Healthcare, Telecommunications, Banking & finance, Technology, Construction & engineering, Hospitality, Retail, Multinational, Other)
- Tax identification number / TIN (text input)
- VAT registration number (text input, optional label)

**Section: Contact & address**
- Registered address (text input, full address)
- Operating address (text input, optional — if different from registered)
- Company phone (text input)
- Company email (text input)
- Website (text input, optional)
- External auditor name (text input, optional)

**Section: Group & currency**
- Group structure (dropdown: Standalone, Subsidiary, Parent / Holding company, Branch)
- Parent company name (text input — only visible when Subsidiary or Branch is selected)
- Functional currency * (text input — pre-filled from tenant record, read-only)
- Reporting currency (text input, optional — for group companies)
- Authorised share capital (number input, optional — for financial statement disclosures)

All fields save to `tenant_org_config` table. On save, check if required fields are filled and update setup progress accordingly.

### 3.2 — Structure tab — fix broken buttons

The Add node, Download template, and Upload structure buttons are currently dead. Fix them:

**Add node button:**
Opens a modal with fields:
- Node type (dropdown: Legal entity, Division / Business unit, Department, Cost center)
- Name (text input, required)
- Code (text input, required — unique per tenant)
- Parent node (dropdown — searchable, lists all existing nodes)
- Cost center code (text input — only shown when Node type = Cost center; must match an existing dimension value code if Cost Center dimension exists)

On save: store in new `org_structure` table:
```sql
CREATE TABLE org_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES org_structure(id),
    node_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    cost_center_code VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, code)
);
```

**Download template button:**
Generates and downloads a .xlsx file with columns:
Node Type* | Name* | Code* | Parent Code | Cost Center Code | Description
Include an Instructions row (row 2) and an example row (row 3).
Node Type dropdown validation: Legal entity, Division, Department, Cost center.

**Upload structure button:**
- Accepts .xlsx or .csv
- Validates: Node Type is valid, Name and Code are present, Parent Code exists if provided
- Upserts: updates existing nodes by code, creates new ones
- Returns: { imported: N, updated: N, errors: [{row, reason}] }

**Tree view:**
After upload or manual add, render the org structure as a tree:
- Each node shows: icon (based on node_type) + name + code badge
- Legal entity: ti-building icon
- Division/Business unit: ti-folders icon
- Department: ti-folders icon (slightly different color)
- Cost center: ti-folder icon + green badge with cost center code
- Indentation per level (16px per level)
- Expand/collapse per node

### 3.3 — Fiscal year tab — fix persistence and add periods table

**Problem:** Fields are not saving. Fix the save endpoint to persist to `tenant_org_config`.

**Add fields:**
- Fiscal year start month (dropdown: January through December)
- Fiscal year start day (number input, default 1)
- Fiscal year end (read-only, auto-calculated from start)
- Current fiscal year label (text input — e.g. "FY2026" or "2025/2026")
- Fiscal year name format (dropdown: FY{YYYY}, {YYYY}/{YYYY+1}, {Mon YYYY} — {Mon YYYY})
- Period closing frequency (dropdown: Monthly, Quarterly, Annual)
- Note below the frequency dropdown: "Period closing frequency controls when periods are formally closed for accounting purposes. It does not restrict report generation — reports can be generated for any date range at any time."

**Generate periods button:**
- Label: "Generate periods for {current_fiscal_year}"
- On click: auto-generate period records in new `fiscal_periods` table:
```sql
CREATE TABLE fiscal_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year VARCHAR(20) NOT NULL,
    period_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'current', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, fiscal_year, period_name)
);
```
- Monthly frequency = 12 periods; Quarterly = 4; Annual = 1
- Current period = the period containing today's date (status = 'current')

**Periods table:**
Show generated periods in a table: Period name | Opens | Closes | Status (Open/Current/Closed)
Status badge colors: Open = green, Current = blue, Closed = grey

### 3.4 — Profile dropdown fix

The profile dropdown in the top-right corner shows stale data. Fix it:
- Company name shown must match `tenant_org_config.legal_name` (not the old tenant signup name)
- Add a close/dismiss button (×) to the profile dropdown — currently there is none, forcing users to use the browser back button
- The dropdown should close when clicking outside it (click-away listener)

---

## SECTION 4 — MODULE ACTIVATION PAGE REDESIGN

**Route:** `/dashboard/business/setup/modules`

### Layout: Split panel

**Left panel (40% width):**
Two groups of module cards:

**Group 1 — "Your subscribed modules"** (section heading)
Show only modules where `tenant_modules.is_licensed = true`
Each card: Tabler icon (24px) + module name + status (Active/Inactive)
Active card: green border + green background tint
Inactive card: normal border, muted
Clicking a card: highlights it and shows detail in right panel. Does NOT toggle activation — activation happens in right panel.

**Group 2 — "Available to add"** (section heading)
Show modules where `tenant_modules.is_licensed = false`
Each card: dashed border, opacity 0.6, cursor pointer
Clicking shows detail in right panel with "not subscribed" message

**Right panel (60% width):**
Shows detail for selected module. Default state: "Select a module to see details" with ti-cursor-text icon.

When a module is selected, show:
- Module icon (24px) + module name (14px, font-weight 500) + one-line description
- "Key features" section: bullet list of what the module does (use the list from MASTER_CONTEXT.md Section 6)
- "What you'll configure" section: bullet list of setup items required
- "Dependencies" note: what must be set up first
- For subscribed modules: "Activate" / "Deactivate" toggle button at bottom
- For non-subscribed modules: amber alert box — "This module is not included in your current subscription. Contact your Ziva BI consultant or account manager to add it." No activate button.

### Backend: tenant_modules table
Add `is_licensed` boolean column:
```sql
ALTER TABLE tenant_modules ADD COLUMN is_licensed BOOLEAN DEFAULT false;
```
Seed all 14 modules as `is_licensed = true` for the test tenant (Red Bull Nigeria) for now.
`is_active` can only be set to true if `is_licensed = true` — enforce this in the API (return 403 if attempting to activate unlicensed module).

### Module detail content
Use this exact content per module:

**Expense Management**
Description: End-to-end employee expense retirement with multi-level approvals and AI-powered GL coding.
Features: Multi-line expense submission, GL coding with dimension mapping, Approval matrix (LM → Finance), AI-powered GL suggestions, Receipt OCR auto-fill (coming soon), Split lines per invoice, Budget checking (coming soon)
Configure: GL coding level, Expense categories, Approval matrix, Expense limits per category
Dependencies: Requires Chart of Accounts and Dimensions.

**Accounts Payable**
Description: Full vendor invoice processing with WHT, VAT, PO matching and multi-level payment approvals.
Features: Vendor onboarding workflow, PO and non-PO invoice processing, WHT and VAT computation, Multi-level payment approvals, Advance payment tracking, Clearing agent processing
Configure: Vendor categories, WHT rules, VAT rules, PO thresholds, Payment terms
Dependencies: Requires Chart of Accounts and Dimensions.

**Accounts Receivable**
Description: Customer order management, invoicing, credit control and collections.
Features: Customer onboarding, Sales order processing, Credit limit enforcement, Delivery confirmation, Returns workflow, Customer portal access
Configure: Customer categories, Credit rules, Payment terms, Pricing rules
Dependencies: Requires Chart of Accounts.

**Payroll & HR**
Description: Full payroll computation with statutory deductions, leave management and employee payslip portal.
Features: Payroll calculation engine, PAYE and statutory deductions, Leave management, Employee payslip portal, Payroll comparison engine, Outsourced staff billing
Configure: Earnings and deductions, PAYE tables, Pension rules, Leave types
Dependencies: Requires Employees module.

**Inventory Management**
Description: Multi-warehouse stock tracking with costing methods and FIFO/FEFO rotation.
Features: Multi-warehouse tracking, FIFO/FEFO stock rotation, Standard and weighted average costing, Expiry date tracking, Stock count workflows, Damaged goods handling
Configure: Warehouses and locations, Costing method, Stock categories
Dependencies: None.

**Fixed Assets**
Description: Asset register, automated depreciation, disposal workflow and capital work in progress.
Features: Asset register import, Multi-class depreciation rules, Automated depreciation engine, Disposal and transfer workflow, Capital work in progress tracking
Configure: Asset classes, Depreciation methods, Useful lives
Dependencies: Requires Chart of Accounts.

**POSM Management**
Description: Track point-of-sale materials from procurement through issuance to return.
Features: POSM catalogue management, Issuance to outlets and staff, Return tracking and reconciliation, Stock position by location
Configure: POSM categories, Issuance rules, Return policy
Dependencies: None.

**Vendor Portal**
Description: Secure online vendor onboarding, KYC document submission and invoice tracking.
Features: Secure onboarding link (expires 30 days), Online KYC form and document upload, Vendor invoice submission, Invoice and payment status tracking, Banking change verification workflow
Configure: KYC requirements, Onboarding workflow, Vendor categories
Dependencies: Requires Accounts Payable.

**Customer Portal**
Description: Self-service portal for customers to track orders, deliveries and account statements.
Features: Order tracking, Delivery status updates, Account statement view, Return request submission, Automated monthly reconciliation email
Configure: Portal access rules, Statement settings, Notification preferences
Dependencies: Requires Accounts Receivable.

**Warehouse / 3PL Portal**
Description: Inbound shipment receiving, stock management and delivery confirmation for warehouse or 3PL partners.
Features: Inbound shipment receiving, Damaged and missing goods tracking, POSM issuance and return, Stock valuation by location, Delivery confirmation triggering AR events
Configure: Warehouse locations, Stock rules, Damage categories
Dependencies: Requires Inventory Management.

**Bank Reconciliation**
Description: Upload bank statements in any format and auto-match transactions to the GL.
Features: Multi-format statement upload (PDF, Excel, CSV), Auto-matching engine (exact and fuzzy), Exception queue management, Auto-post reconciling journals, Multi-bank and multi-currency support, Fraud detection suggestions
Configure: Bank accounts, Matching rules, Journal templates
Dependencies: Requires Chart of Accounts.

**Budget Engine**
Description: Upload and manage budget versions (BP/FRE/SRE) with real-time actuals comparison.
Features: Budget upload via Excel/CSV, Multiple versions (BP, FRE, SRE), Budget vs actual dashboards, Budget owner intelligence alerts, Real-time budget impact checks in AP and Expenses
Configure: Budget versions, Budget owners, GL/dimension mapping
Dependencies: Requires Chart of Accounts and Dimensions.

**Tax Engine**
Description: Corporate tax computation with capital allowances, deferred tax and multi-year tracking.
Features: Corporate tax computation, Education tax and industry levies, Capital allowance calculation, Allowable and disallowable expense classification, Deferred tax computation, Multi-year tracking and comparison
Configure: Tax rules per jurisdiction, Capital allowance classes, Disallowable expense categories
Dependencies: Requires Chart of Accounts.

**Reporting & Analytics**
Description: Real-time financial and operational dashboards with scheduled report delivery.
Features: Financial statements (P&L, Balance Sheet, Cash Flow), Operational dashboards per module, Scheduled report emails, Custom report builder, Export to Excel and PDF
Configure: Report schedules, Dashboard layout, Distribution lists
Dependencies: Requires Chart of Accounts.

---

## SECTION 5 — DIMENSIONS PAGE FIXES

**Route:** `/dashboard/business/settings/dimensions`

### 5.1 — Add "Not using dimensions?" tab

The page must have 3 tabs:
1. Dimension setup (existing, keep)
2. Master data / values (existing, keep)
3. Not using dimensions? (NEW)

**Tab 3 — Not using dimensions?**
Content: centered layout with:
- ti-circle-off icon (28px, muted)
- Heading: "This company does not use analytical dimensions"
- Body text: "Dimension fields will be hidden on all expense forms, AP invoices, and other transaction entries. The CoA template will not include dimension columns. You can enable dimensions at any time."
- Button: "Confirm — no dimensions"
- On confirm: set `tenant_dimensions.not_applicable = true` on a new boolean field on the tenants table, mark dimensions section as complete in setup progress, redirect to Chart of Accounts

### 5.2 — Add "Download template" button to dimension values page

**Route:** `/dashboard/business/settings/dimensions/{id}/values`

Currently only has "Upload .xlsx/.csv" button. Add a "Download template" button beside it.

Template generates a .xlsx file with columns:
code* | name* | value_type | valid_from | valid_to | sort_order
Include instructions row and example row.
Filename: `{dimension_name}_values_template.xlsx`

### 5.3 — Real and Statistical orders as separate sub-panels

When a dimension has multiple value types (e.g. IO dimension with Real Order and Statistical Order), show them as two separate sub-panels within the dimension card:

Left sub-panel: "Real orders" + count badge + sample values (first 3, truncated)
Right sub-panel: "Statistical orders" + count badge + sample values

This is display only — the underlying data model doesn't change.

### 5.4 — Setup sequence enforcement

Add an info alert at the top of the Dimensions page:
"Configure dimensions before uploading your Chart of Accounts. The CoA template will include one column per dimension configured here."

Add an info alert at the top of the Chart of Accounts page:
"Your CoA template is generated based on your configured dimensions. Complete dimension setup first for the correct template format."

---

## SECTION 6 — CHART OF ACCOUNTS FIXES

**Route:** `/dashboard/business/settings/chart-of-accounts`

### 6.1 — Fix Download Template endpoint

The `GET /api/config/coa/template` endpoint is broken. Fix it.

The generated template must be a 3-sheet .xlsx:

**Sheet 1 — GL Accounts** (columns in this exact order):
GL Number* | GL Name* | Account Type* | GL Group | GL Subgroup | GL Sub-subgroup | FS Head | FS Note | TB Mapping | Group Account Number | Group Account Name | Category | Subcategory | Is Default GL for Subcategory | [one column per active tenant dimension, header = dimension name, dropdown: Required/Optional/N/A]

Account Type dropdown: SOCI (Statement of Comprehensive Income), SOFP (Statement of Financial Position)
Is Default GL dropdown: Yes, No
Dimension columns: dropdown validation Required/Optional/N/A
Required columns marked with * in header (bold, blue background)
Optional columns: normal header (grey background)
Row 1: headers
Row 2: instructions (italic, grey text)
Row 3: example row with realistic data

**Sheet 2 — Dimensions Setup** (columns):
Dimension Name* | Value Code* | Value Name* | Value Type | Valid From (dd/mm/yyyy) | Valid To (dd/mm/yyyy) | Is Active (Yes/No)
Pre-populate Dimension Name column with a dropdown containing all active dimension names for this tenant.
Row 1: headers, Row 2: instructions, Row 3: example row

**Sheet 3 — Instructions**
Full explanation of every column, what SOCI/SOFP means, how dimensions work, how to handle group accounts, how to set up category mappings. Keep it clear and plain — this is read by finance teams, not developers.

Filename: `{tenant_name}_CoA_Template_{YYYY-MM-DD}.xlsx`

### 6.2 — Fix Edit/Add GL account modal

Currently only shows 3 fields. The modal must show ALL fields:

**Section: GL Identity**
- GL Number (text, required — readonly on edit)
- GL Name (text, required)
- Account Type (dropdown: SOCI — Statement of Comprehensive Income, SOFP — Statement of Financial Position)
- Is Active (toggle)

**Section: GL Hierarchy**
- GL Group (text input)
- GL Subgroup (text input)
- GL Sub-subgroup (text input)

**Section: Financial statement mappings**
- FS Head (text input — e.g. "Marketing expenses")
- FS Note (text input — e.g. "Note 8 — Operating expenses")
- TB Mapping (text input — e.g. "OPEX")

**Section: Group reporting (optional)**
- Group Account Number (text input)
- Group Account Name (text input)

**Section: Category mapping (optional)**
- Category (dropdown — from expense_categories top-level)
- Subcategory (dropdown — filtered by selected category)
- Is Default GL for this subcategory (toggle)

**Section: Dimension requirements**
For each active tenant dimension, show:
- Dimension name label
- Requirement dropdown (Required / Optional / N/A)
If no dimensions configured or dimensions marked not_applicable: hide this section entirely.

### 6.3 — Fix "Failed to fetch" background error

Identify and fix the API call that is failing silently on page load. Likely a permissions or endpoint mismatch issue. The page should load without any error banner when the backend is running.

---

## SECTION 7 — EMPLOYEES PAGE REDESIGN

**Route:** `/dashboard/business/settings/employees`

### 7.1 — Fix "Failed to fetch" error

Same as CoA — identify and fix the failing API call on page load.

### 7.2 — Add 3 onboarding method tabs

Redesign the employees page to have 4 tabs:

**Tab 1 — Add employees** (NEW — replaces the simple empty state)

Show 3 method cards in a grid (3 columns):

**Card 1 — Bulk upload**
- ti-upload icon (22px)
- Title: "Bulk upload"
- Description: "Download the template, fill all employee records, upload back. Best for initial mass onboarding."
- Two buttons: "Download template" + "Upload file"
- Below the cards: show the template columns as tags (see below)

**Card 2 — HR manual entry**
- ti-user-plus icon (22px)
- Title: "HR manual entry"
- Description: "HR fills in all details directly in the portal. Good for single new hires where HR has all the information."
- Button: "Add employee" → opens full employee form modal

**Card 3 — Self-onboarding link**
- ti-link icon (22px)
- Title: "Self-onboarding link"
- Description: "HR creates a basic record. System sends a secure link to the new hire. They fill their own details. HR reviews and approves. Record activates from the resumption date."
- Button: "Send invite" → opens invite modal (First name, Last name, Email, Cost center, Start date)

**Template columns section** (below the 3 cards):
Show all columns as info-colored tags:
Required (*): First name, Last name, Email
Optional: Employee code, Cost center code, Line manager email, Other name, Preferred name, Phone, Start date, Date of birth, Gender, NIN (National Identification Number), Bank name, Bank account number, BVN (Bank Verification Number), Emergency contact name, Emergency contact phone, Residential address

**Tab 2 — Employee list** (existing functionality, keep)
Add filter by: Cost center, Status (Active/Pending/Inactive)
Show columns: Employee code | Full name | Cost center | Line manager | Start date | Status | Actions
Actions per row: Edit, Transfer, View history, Deactivate

**Tab 3 — Transfers & changes** (existing functionality, keep)
Add "New transfer" and "Change line manager" buttons.

**Tab 4 — Code config** (existing functionality, keep)

### 7.3 — Self-onboarding backend

When "Send invite" is triggered:
1. Create employee record with status = 'pending_self_onboarding'
2. Generate a secure token (UUID, expires 30 days)
3. Store token in new `employee_onboarding_tokens` table:
```sql
CREATE TABLE employee_onboarding_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```
4. Send email to new hire with onboarding link (for now: just log the link to console — email integration comes later)
5. Frontend route for new hire: `/onboard/{token}` — shows a form for them to fill their details

The new hire onboarding form (`/onboard/{token}`) collects:
- Personal: Other name, Preferred name, Date of birth, Gender, Phone, Residential address, NIN
- Emergency contact: Name, Relationship, Phone
- Financial: Bank name, Account number, Account name, BVN
- Documents: Upload passport photo, means of ID (optional at this stage)

On submit: updates the employee record, sets status = 'pending_hr_approval'
HR sees "Pending approval" badge on employee list — can Approve (activates from start date) or Reject with comment.

---

## SECTION 8 — ALEMBIC MIGRATION

Single migration covering all new tables and columns:
- `org_structure` table
- `fiscal_periods` table
- `employee_onboarding_tokens` table
- `dimensions_not_applicable` boolean on tenants table
- `documents_setup_complete` boolean on tenants table
- `module_setup_visited` JSONB on tenants table
- `is_licensed` boolean on tenant_modules table
- `role_tier` column on user_tenants table (if not already added in M8.2)
- `legal_name`, `rc_number`, `date_of_registration`, `commencement_date`, `company_type`, `industry`, `tin`, `vat_number`, `registered_address`, `operating_address`, `company_phone`, `company_email`, `website`, `external_auditor`, `group_structure`, `parent_company_name`, `reporting_currency`, `authorised_share_capital`, `fiscal_year_start_month`, `fiscal_year_start_day`, `fiscal_year_name_format`, `period_closing_frequency`, `branding` JSONB — all on `tenant_org_config` table

Label: `m8_2_fixes_org_modules_dims_employees`

---

## SECTION 9 — NEW API ENDPOINTS

```
GET  /api/setup/progress                    — setup completeness (fixed logic)
GET  /api/setup/organisation                — get org config
POST /api/setup/organisation                — save org config
GET  /api/setup/org-structure               — get org tree
POST /api/setup/org-structure               — add node
PATCH /api/setup/org-structure/{id}         — update node
DELETE /api/setup/org-structure/{id}        — remove node
GET  /api/setup/org-structure/template      — download template
POST /api/setup/org-structure/upload        — upload structure
GET  /api/setup/fiscal-periods              — get periods
POST /api/setup/fiscal-periods/generate     — generate periods for fiscal year
GET  /api/setup/modules                     — get module activation state (existing, add is_licensed)
PATCH /api/setup/modules                    — update activation (enforce is_licensed check)
POST /api/hr/employees/invite               — send self-onboarding invite
GET  /onboard/{token}                       — validate token, return employee stub
POST /onboard/{token}                       — submit self-onboarding form
POST /api/hr/employees/{id}/approve-onboarding — HR approves self-onboarding
POST /api/hr/employees/{id}/reject-onboarding  — HR rejects with comment
GET  /api/config/dimensions/{id}/values/template — dimension values template download (FIXED)
```

---

## SECTION 10 — PERFORMANCE REQUIREMENTS

- Setup progress endpoint: cache per tenant, max 300ms, invalidate on any config change
- Org structure tree: load full tree in single query using recursive CTE, not N+1
- CoA template generation: stream the file — do not load all GL accounts into memory at once
- Module activation page: load module list from tenant_modules in single query, not per-module

---

## SECTION 11 — DO NOT TOUCH

These files/pages must not be modified:
- All expense form pages (new, edit, list, detail)
- All approval pages
- Existing dimension values upload logic (only add download template)
- Existing CoA upload logic (only fix download template and edit modal)
- M9 components: ExpenseItemPicker, SplitLinePanel
- Auth middleware

---

## DEFINITION OF DONE

- [ ] Sidebar restructured with new groups (Common Data, Financials, People, Workflow & Access, Module Setup, Go-live)
- [ ] All sidebar icons are Tabler outline icons (no emoji)
- [ ] Setup dashboard: correct icons, correct completion logic, correct locked/unlocked states
- [ ] Implementation mode banner shows for consultant role
- [ ] Organisation Identity tab: all fields present, saves correctly, persists on navigation
- [ ] Organisation Structure tab: Add node works, Download template works, Upload works, tree renders
- [ ] Organisation Fiscal year tab: saves correctly, Generate periods works, periods table renders
- [ ] Profile dropdown: shows correct company name, has close button, closes on click-away
- [ ] Module activation: split panel layout, subscribed vs available groups, detail panel per module, licensing enforcement
- [ ] Dimensions: "Not using dimensions?" tab works, CoA sequence note present
- [ ] Dimension values page: Download template button added and working
- [ ] CoA template download: fixed, generates 3-sheet xlsx with all columns
- [ ] CoA edit/add modal: all fields present and saving
- [ ] Employees: 3 onboarding method tabs, bulk upload template columns shown, self-onboarding flow working
- [ ] All "Failed to fetch" errors resolved
- [ ] Alembic migration applied cleanly
- [ ] No regressions on existing pages
- [ ] All tested locally by Adeniyi

## Commit Message
```
fix: M8.2 enhancements - sidebar restructure, org fields, module split panel, dims flow, CoA template, employee onboarding
```

Push to GitHub and update docs/MASTER_CONTEXT.md.

---

*End of M8.2 Fixes & Enhancements Brief. Written May 2026.*
