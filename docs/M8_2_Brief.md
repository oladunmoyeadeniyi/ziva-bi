# Milestone 8.2 — Implementation Portal Redesign
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## CRITICAL INSTRUCTIONS FOR CLAUDE CODE

Before writing a single line of code:
1. Read docs/MASTER_CONTEXT.md fully
2. This brief contains the complete spec — do not guess, do not invent, do not shortcut
3. Match the approved wireframe exactly — sidebar structure, tab layouts, card styles, table designs, upload zones, locked field styles
4. Every component must be production-grade — fully commented, properly typed, performant
5. Do not touch any existing expense form code (M9) — this milestone is admin/config only
6. Test every page locally before committing

---

## WHAT THIS MILESTONE DELIVERS

M8.2 redesigns the Tenant Portal admin experience from a flat "Settings" page into a properly structured Implementation Portal. It introduces the three-tier role system, a guided setup dashboard, and all missing configuration pages.

After M8.2, a Ziva BI consultant can onboard a new tenant end-to-end using the portal.

---

## PART 1 — SIDEBAR RESTRUCTURE

### Current structure (replace entirely)
The current sidebar has: Settings (Approval Matrix, Expense Config, Master Data), Team. This is wrong and must be replaced.

### New sidebar structure

```
COMMON DATA
  - Setup dashboard          /dashboard/business/setup
  - Organisation             /dashboard/business/setup/organisation
  - Module activation        /dashboard/business/setup/modules
  - Chart of accounts        /dashboard/business/settings/chart-of-accounts  (existing, keep)
  - Dimensions               /dashboard/business/settings/dimensions          (existing, keep)
  - Employees                /dashboard/business/settings/employees           (existing, keep)
  - Currencies & FX          /dashboard/business/setup/currencies
  - Tax & statutory          /dashboard/business/setup/tax

WORKFLOW & ACCESS
  - Roles & permissions      /dashboard/business/setup/roles
  - Approval workflows       /dashboard/business/settings/approval-matrix     (existing, rename label)
  - Document rules           /dashboard/business/setup/documents
  - Team                     /dashboard/business/settings/team                (existing, keep)

MODULE SETUP
  (Only show modules that are activated for this tenant)
  - Expense                  /dashboard/business/settings/expense-config      (existing, keep)
  - Accounts payable         /dashboard/business/setup/modules/ap
  - Accounts receivable      /dashboard/business/setup/modules/ar
  - Bank reconciliation      /dashboard/business/setup/modules/bank
  - Payroll                  /dashboard/business/setup/modules/payroll
  - Inventory                /dashboard/business/setup/modules/inventory
  - Fixed assets             /dashboard/business/setup/modules/fixed-assets
  - Tax engine               /dashboard/business/setup/modules/tax-engine
  - Budget                   /dashboard/business/setup/modules/budget
  - Vendor portal            /dashboard/business/setup/modules/vendor-portal
  - Customer portal          /dashboard/business/setup/modules/customer-portal
  - Warehouse / 3PL          /dashboard/business/setup/modules/warehouse
  - POSM                     /dashboard/business/setup/modules/posm

GO-LIVE
  - Readiness & go-live      /dashboard/business/setup/go-live
```

### Sidebar rules
- Section group labels are non-clickable dividers (uppercase, muted, small)
- Active item has white background + subtle border
- Module Setup items only render if that module is activated in tenant config
- If no modules are activated yet, show "Activate modules first" placeholder in Module Setup group
- Sidebar scrolls independently if content overflows

---

## PART 2 — ROLE TIER SYSTEM

### DB changes

```sql
-- Add consultant role to existing roles enum/table
-- Add implementation_locked boolean to key config tables

ALTER TABLE tenant_expense_config ADD COLUMN locked_by_implementation BOOLEAN DEFAULT false;
ALTER TABLE tenant_dimensions ADD COLUMN locked_by_implementation BOOLEAN DEFAULT false;
ALTER TABLE chart_of_accounts ADD COLUMN locked_by_implementation BOOLEAN DEFAULT false;

-- New table: implementation_locks
-- Tracks which sections are locked and by whom
CREATE TABLE implementation_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    section VARCHAR(100) NOT NULL,  -- e.g. 'organisation', 'coa', 'dimensions'
    locked_at TIMESTAMPTZ DEFAULT now(),
    locked_by UUID REFERENCES users(id),
    notes TEXT
);
```

### Role detection
- JWT must include role tier: 'consultant' | 'power_admin' | 'functional_admin'
- Consultant role assigned only via Super Admin (or seed data for now)
- Add `role_tier` field to users table and JWT payload
- Frontend reads role_tier from auth context

### Implementation Mode banner
When role_tier === 'consultant', show a banner at the top of every admin page:

```
[shield icon] Implementation mode — you have full override access. All changes are logged.
```

- Banner: amber background, full width, 36px height, sits below topbar
- Non-dismissable
- Not shown to Power Admin or Functional Admin

### Locked field component
Create a reusable `<LockedField>` component:
- Shows a dashed border box with lock icon
- Text: "Locked by implementation. Contact your Ziva BI consultant to modify."
- Used wherever a field is implementation-locked for non-consultant users
- Consultant users see the field as editable (no lock shown)

### Consultant override
When consultant views a locked field:
- Field is editable (no lock shown)
- On save: log the override to an audit trail table
- Show a small "Override" badge next to the saved value

---

## PART 3 — SETUP DASHBOARD

**Route:** `/dashboard/business/setup`
**Sidebar label:** Setup dashboard

### Layout
Full-width page. No card wrapper needed — content fills the page.

### Implementation mode alert (consultant only)
```
[info icon] Implementation mode — you have full override access. Changes are logged against your consultant account.
```

### Progress bar
- Label: "Setup completeness" (left) + "X of 12 sections complete" (right)
- Progress bar: 6px height, green fill, rounded
- Percentage calculated from completed sections / total sections

### Checklist grid
`grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))` — responsive grid

Each card:
- Icon (Tabler outline, 20px)
- Status dot (green = complete, amber = in progress, grey = locked)
- Title
- Subtitle (e.g. "847 GL accounts loaded" or "Requires dimensions first")
- Clickable — navigates to that section
- Locked cards: greyed out, cursor not-allowed, not clickable

**Cards in order:**
1. Organisation — prerequisite for nothing — unlocked by default
2. Module activation — prerequisite for Module Setup — unlocked by default
3. Chart of accounts — prerequisite for Dimensions, Module Setup — unlocked by default
4. Dimensions — prerequisite for Employees — unlocked after Organisation
5. Employees — prerequisite for Workflows — unlocked after Dimensions (or if dimensions = not applicable)
6. Currencies & FX — unlocked after Organisation
7. Tax & statutory — unlocked after Organisation
8. Roles & permissions — unlocked after Employees
9. Approval workflows — unlocked after Roles & permissions
10. Document rules — unlocked after Organisation
11. Module setup — unlocked after CoA + Dimensions complete
12. Go-live — unlocked when ALL blocking sections complete

### Completion logic (backend)
```
GET /api/setup/progress
Returns: {
  sections: [
    { key: 'organisation', label: 'Organisation', status: 'complete'|'in_progress'|'locked'|'not_started', subtitle: string, route: string },
    ...
  ],
  total: 12,
  completed: N,
  percentage: N
}
```

Backend calculates completion based on:
- organisation: tenant has legal_name, functional_currency, fiscal_year_start set
- modules: at least 1 module activated
- coa: at least 1 GL account exists
- dimensions: dimensions configured OR explicitly marked as not_applicable
- employees: at least 1 employee uploaded
- currencies: functional currency set (from org) — auto-complete if org is done
- tax: at least 1 tax rule configured
- roles: at least 1 Power Admin assigned
- workflows: at least 1 workflow configured for at least 1 module
- documents: marked complete by consultant (manual confirm)
- module_setup: each activated module has been visited and saved
- golive: all blocking sections complete

### Hint text
Below grid: "Click any section to jump to it. Locked sections unlock automatically when prerequisites are met."

---

## PART 4 — ORGANISATION PAGE

**Route:** `/dashboard/business/setup/organisation`

### 4 tabs: Identity | Structure | Branding | Fiscal year

#### Tab 1 — Identity
Fields (all editable by consultant, Power Admin can edit unlocked fields):
- Legal name (required)
- RC number / company registration number
- Industry (dropdown: FMCG/Consumer Goods, Manufacturing, Logistics/3PL, Professional Services, Healthcare, Telecommunications, Banking/Finance, NGO/Public Sector, Technology, Construction/Engineering, Hospitality, Multinational, Other)
- Functional currency (dropdown from currencies list)
- Reporting currency (optional — for group companies)
- Country / jurisdiction (dropdown)
- Group structure (dropdown: Standalone, Subsidiary, Parent/Holding, Branch)
- Parent company name (shown only if Subsidiary or Branch selected)
- Tax identification number (TIN)
- VAT registration number (optional)

Save button: "Save & mark complete" | "Save draft"

#### Tab 2 — Structure
Shows the org hierarchy as a tree view.

**Tree node types:**
- Legal entity (building icon)
- Division / Business unit (folders icon)
- Department (folders icon)
- Cost center (folder icon) — shows cost center code as green badge

**Actions:**
- "+ Add node" button — modal with: Node type, Name, Code, Parent node, Cost center code (if applicable)
- "Download template" — .xlsx with columns: Node Type*, Name*, Code*, Parent Code, Cost Center Code
- "Upload structure" — accepts .xlsx or .csv

**Locked note (post go-live):**
"Structure is locked after go-live. Contact your Ziva BI consultant to restructure."

#### Tab 3 — Branding
- Company logo upload (drag-drop zone, accepts PNG/SVG/JPG, max 2MB)
- Primary colour (colour picker + hex input)
- Button style (dropdown: Rounded, Square)
- Preview panel showing how logo + colour looks in the app header

#### Tab 4 — Fiscal year
- Fiscal year start (month + day selector)
- Fiscal year end (auto-calculated, read-only)
- Current fiscal year (e.g. FY2026)
- Period closing frequency (dropdown: Monthly, Quarterly, Annual)
- Periods table: Period name | Opens | Closes | Status (Open/Closed)
- "Generate periods" button — auto-generates monthly periods for current fiscal year

---

## PART 5 — MODULE ACTIVATION PAGE

**Route:** `/dashboard/business/setup/modules`

### Layout
Alert box: "Activate the modules your organisation will use. Only activated modules appear in the Module Setup section. You can activate additional modules at any time."

Module grid: `repeat(auto-fit, minmax(150px, 1fr))`

Each module card:
- Tabler icon (20px)
- Module name
- Status: "Active" (green) | "Inactive" (muted)
- Clicking toggles active/inactive
- Active card: green border + green background
- Inactive card: muted opacity

**Modules (14 total):**
Expense Management, Accounts Payable, Accounts Receivable, Payroll & HR, Inventory Management, Fixed Assets, POSM Management, Vendor Portal, Customer Portal, Warehouse/3PL Portal, Bank Reconciliation, Budget Engine, Tax Engine, Reporting & Analytics

### Backend
```
GET  /api/setup/modules          — get current module activation state
PATCH /api/setup/modules         — update module activation
Body: { modules: { expense: true, ap: true, ar: false, ... } }
```

Store in a new `tenant_modules` table:
```sql
CREATE TABLE tenant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_key VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    activated_at TIMESTAMPTZ,
    activated_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, module_key)
);
```

---

## PART 6 — CURRENCIES & FX PAGE

**Route:** `/dashboard/business/setup/currencies`

### Tabs: Currencies | FX rates | Revaluation rules

#### Tab 1 — Currencies
- Functional currency: shown as read-only (set in Organisation > Identity)
- Reporting currency: editable dropdown
- Additional currencies table: Code | Name | Symbol | Status | Actions
- "+ Add currency" button
- Each row: Edit, Deactivate

#### Tab 2 — FX rates
- FX rate source (per currency pair): Manual | CBN daily | XE.com | Monthly fixed rate
- Rate entry table: Currency pair | Rate | Source | Effective date | Updated by
- "Update rates" button — manual entry modal
- Note: automated rate feeds from CBN/XE are planned for future milestone

#### Tab 3 — Revaluation rules
- Realized gain/loss GL account (dropdown from CoA)
- Unrealized gain/loss GL account (dropdown from CoA)
- Month-end revaluation: toggle on/off
- Revaluation date: last day of period | specific date
- FX application rule per transaction type (dropdown: Invoice date | Approval date | Payment date)

### Backend
```
GET  /api/setup/currencies
PATCH /api/setup/currencies
GET  /api/setup/fx-rates
PATCH /api/setup/fx-rates
GET  /api/setup/revaluation
PATCH /api/setup/revaluation
```

---

## PART 7 — TAX & STATUTORY PAGE

**Route:** `/dashboard/business/setup/tax`

### Tabs: VAT | WHT | PAYE | Other statutory

#### Tab 1 — VAT
- VAT registered: toggle
- Standard VAT rate: % input
- VAT GL account (dropdown from CoA)
- Input VAT GL account (dropdown from CoA)
- Reverse VAT: toggle (for applicable vendors)
- Self-account VAT: toggle
- VAT categories table: Category name | Rate % | Applies to | Effective from | Status

#### Tab 2 — WHT
- WHT categories table: Vendor category | Rate % | GL account | Applies to | Effective from
- "+ Add WHT rule" button
- Non-resident WHT rate: separate % input
- WHT GL account (dropdown from CoA)

#### Tab 3 — PAYE
- PAYE tables: Income band | Rate % | Effective from
- Employee pension rate: % input
- Employer pension rate: % input
- Pension GL accounts (employee + employer)
- NHF rate: % input (if applicable)
- NSITF rate: % input (if applicable)

#### Tab 4 — Other statutory
- Free-form table: Levy name | Rate | Base | GL account | Effective from
- Examples: Education tax, Police levy, NITDA levy, etc.

### Backend
```
GET  /api/setup/tax
PATCH /api/setup/tax
```
Store in `tenant_tax_config` table (JSON columns per tax type for flexibility).

---

## PART 8 — ROLES & PERMISSIONS PAGE

**Route:** `/dashboard/business/setup/roles`

### Tabs: Role tiers | Permission matrix | User assignments

#### Tab 1 — Role tiers
Table showing the three tiers (read-only structure, consultant-locked):

| Role tier | Who holds it | Granted by | Override power |
|---|---|---|---|
| Consultant (amber badge) | Ziva BI implementation team | Super admin only | Full — can override everything |
| Power Admin (blue badge) | Finance Director / CFO | Consultant | Within unlocked sections only |
| Functional Admin (green badge) | HR, Procurement, etc. | Power Admin | Within delegated scope only |

Locked note: "Role tier structure is defined by Ziva BI. Contact your consultant to modify."

#### Tab 2 — Permission matrix
Grid showing: Rows = modules/sections, Columns = role tiers
Each cell: Full access | Read only | No access | Delegatable
Consultant column always shows "Full access" (read-only)
Power Admin and Functional Admin columns are configurable by consultant

#### Tab 3 — User assignments
Table: Name | Email | Role tier | Modules access | Status | Actions
"+ Assign user" button — modal to assign role tier to an existing team member
"Invite new user" button — links to Team page

### Backend
```
GET  /api/setup/roles/matrix
PATCH /api/setup/roles/matrix
GET  /api/setup/roles/assignments
POST /api/setup/roles/assignments
PATCH /api/setup/roles/assignments/{id}
```

---

## PART 9 — DOCUMENT RULES PAGE

**Route:** `/dashboard/business/setup/documents`

### Layout
Per-module document requirements. Tabs = one per activated module.

Each tab shows a table:
Transaction type | Document name | Required/Optional | Expiry tracked | OCR extraction | Max size | Allowed formats | Actions

"+ Add document rule" button per tab — modal:
- Transaction type (dropdown from module's transaction types)
- Document name (text)
- Required / Optional (toggle)
- Track expiry date (toggle)
- OCR extraction template (dropdown: Invoice standard, Receipt standard, Custom, None)
- Max file size (MB)
- Allowed formats (multi-select: PDF, JPG, PNG, XLSX, CSV)
- Number of files allowed (number input, 0 = unlimited)

### Backend
```sql
CREATE TABLE document_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    is_required BOOLEAN DEFAULT true,
    track_expiry BOOLEAN DEFAULT false,
    ocr_template VARCHAR(50),
    max_size_mb INTEGER DEFAULT 10,
    allowed_formats TEXT[],
    max_files INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

```
GET  /api/setup/documents?module=expense
POST /api/setup/documents
PATCH /api/setup/documents/{id}
DELETE /api/setup/documents/{id}
```

---

## PART 10 — MODULE SETUP STUB PAGES

For each module NOT yet built, create a clean stub page at the routes listed in Part 1.

Each stub page shows:
- Module name as heading
- "This module is activated and awaiting configuration" message
- A list of what will be configurable here (placeholder text based on module)
- "Configuration coming soon" badge
- No broken links, no errors

This ensures the sidebar links all work without errors, and consultants can see what's coming.

**Do NOT build real configuration for these modules** — they are stubs only:
AP, AR, Bank Reconciliation, Payroll, Inventory, Fixed Assets, Tax Engine, Budget, Vendor Portal, Customer Portal, Warehouse/3PL, POSM

---

## PART 11 — READINESS & GO-LIVE PAGE

**Route:** `/dashboard/business/setup/go-live`

### Layout
Heading: "Readiness checklist"
Subheading: "Complete all blocking items before marking this tenant as live."

### Checklist table
| Section | Status | Blocking? | Action |
|---|---|---|---|
| Organisation | Complete (green) | Yes | — |
| Module activation | Complete (green) | Yes | — |
| Chart of accounts | Complete (green) | Yes | — |
| Dimensions | Partial (amber) | Yes | Go to section → |
| Employees | Not started (grey) | Yes | Go to section → |
| Currencies & FX | Complete (green) | No | — |
| Tax & statutory | Not started (grey) | Yes | Go to section → |
| Roles & permissions | Not started (grey) | Yes | Go to section → |
| Approval workflows | Partial (amber) | Yes | Go to section → |
| Document rules | Not started (grey) | No | — |
| Module setup | Partial (amber) | No | Go to section → |

### Go-live button
- Disabled with tooltip when any blocking items are incomplete
- Tooltip: "X blocking items still incomplete"
- When all blocking items complete: button enables
- Button text: "Mark tenant as live"
- On click: confirmation modal — "This will activate the tenant for all users. Are you sure?"
- On confirm: sets tenant status to 'live', sends welcome email to Power Admin

### Backend
```
GET  /api/setup/progress     — returns section statuses (already defined in Part 3)
POST /api/setup/go-live      — marks tenant as live (consultant only)
```

---

## PART 12 — EXISTING PAGES TO KEEP (NO CHANGES)

These pages exist and work. Do NOT touch them:
- /dashboard/business/settings/chart-of-accounts
- /dashboard/business/settings/dimensions (and values sub-pages)
- /dashboard/business/settings/employees
- /dashboard/business/settings/cost-centers
- /dashboard/business/settings/finance-review
- /dashboard/business/settings/expense-config
- /dashboard/business/settings/expense-categories
- /dashboard/business/settings/approval-matrix
- /dashboard/business/settings/team
- All expense form pages (new, edit, list, detail)
- All approval pages

Only change: update sidebar nav labels and groupings to point to these existing routes correctly.

---

## PART 13 — BACKEND MIGRATION

Single Alembic migration covering:
- `implementation_locks` table
- `locked_by_implementation` column on tenant_dimensions, chart_of_accounts, tenant_expense_config
- `role_tier` column on users table
- `tenant_modules` table
- `document_rules` table
- `tenant_tax_config` table (JSONB columns: vat_config, wht_config, paye_config, other_statutory)
- `tenant_fx_config` table (functional_currency, reporting_currency, fx_source, revaluation_rules JSONB)
- `tenant_org_config` table (legal_name, rc_number, industry, country, group_structure, tin, fiscal_year_start, branding JSONB)

Label: `m8_2_implementation_portal`

---

## PART 14 — PERFORMANCE REQUIREMENTS

- Setup dashboard progress endpoint: < 300ms (cached per tenant, invalidated on config change)
- All config GET endpoints: < 200ms
- Module activation save: < 500ms
- Sidebar module list: derived from tenant_modules cache — no DB query on every render

---

## DEFINITION OF DONE

- [ ] New sidebar structure implemented and working
- [ ] Role tier system: consultant badge, implementation mode banner, locked field component
- [ ] Setup dashboard: progress bar, checklist cards, locked/unlocked states, navigation
- [ ] Organisation page: all 4 tabs working (Identity, Structure, Branding, Fiscal year)
- [ ] Org structure: tree view, add node, upload, cost center codes
- [ ] Module activation: grid with toggle, saves to tenant_modules
- [ ] Currencies & FX: all 3 tabs
- [ ] Tax & statutory: all 4 tabs
- [ ] Roles & permissions: all 3 tabs
- [ ] Document rules: per-module tabs, add/edit/delete rules
- [ ] All module setup stub pages render without errors
- [ ] Readiness & go-live: checklist, blocking/non-blocking, go-live button
- [ ] Alembic migration applied cleanly
- [ ] All existing pages still work (no regressions)
- [ ] Tested locally by Adeniyi
- [ ] MASTER_CONTEXT.md updated

## Commit Message
```
feat: M8.2 - implementation portal (setup dashboard, org, modules, FX, tax, roles, doc rules, go-live)
```

Push to GitHub after commit.

---

*End of M8.2 Brief. Written May 2026.*
