# Milestone 8 — Intelligent Expense Form Engine (Foundation)
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## What This Milestone Delivers

M8 gives Tenant Admins the tools to configure exactly how their employees fill in expense lines — from zero GL involvement to full manual GL coding. It introduces:

1. **Dimension setup** — admin defines the company's financial dimensions
2. **Chart of Accounts (CoA) upload** — admin uploads GL accounts with dimension mappings
3. **Category/GL hierarchy builder** — admin builds a tree that filters GL accounts on the expense form
4. **Coding level config** — admin picks how much GL responsibility employees carry
5. **Dynamic template generation** — CoA upload template is generated based on the company's configured dimensions

The expense form itself (employee-facing dynamic behaviour) is M9. M8 is purely admin configuration and data foundation.

---

## Background & Design Decisions

### The core problem M8 solves
Currently the expense form has 3 fixed GL coding modes. These are too rigid. Different companies need different levels of employee involvement in GL coding — from "employee fills nothing GL-related" to "employee selects GL directly". M8 replaces the fixed modes with a flexible, configurable system.

### Key design decisions
- **Dimensions are variable per company.** There is no fixed list. A company defines their own dimensions (e.g. Cost Center, IO, Project Code, Brand, Channel). There is no upper limit on number of dimensions.
- **Location is NOT a dimension.** It is a simple descriptor field on the expense line. Admins can toggle it on/off separately in form config.
- **CoA template is dynamically generated** per company — standard columns + one column per configured dimension. No two companies get the same template.
- **Upload formats supported:** .xlsx and .csv only. PDF/TXT deferred to AI Engine milestone.
- **Category → Subcategory → GL accounts is one-to-many.** A subcategory can map to multiple GL accounts. The employee picks the final GL from a filtered shortlist.

---

## Coding Levels

Replace the existing `gl_coding_mode` enum with a `coding_level` integer (0–4):

| Level | Name | What employee sees | GL assignment |
|---|---|---|---|
| 0 | Finance codes everything | No GL fields at all | Finance assigns GL during review |
| 1 | Category only | Category + Subcategory dropdowns only | GL auto-assigned from mapping (hidden from employee) |
| 2 | Category + GL confirmation | Category + Subcategory + suggested GL (read-only, can flag) | GL pre-filled from mapping, employee can flag if wrong |
| 3 | Guided GL selection | Category + Subcategory + filtered GL dropdown | Employee picks final GL from narrowed list |
| 4 | Full GL coding | GL account field directly | Employee types or searches GL manually |

All levels: AI suggestion layer (M9) will pre-fill based on learned patterns.

---

## Database Changes

### New Tables

#### `tenant_dimensions`
Stores the dimensions a tenant has configured.

```sql
CREATE TABLE tenant_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,           -- e.g. "Cost Center", "IO", "Brand"
    code VARCHAR(50) NOT NULL,            -- e.g. "cost_center", "io", "brand"
    is_required BOOLEAN DEFAULT false,    -- required on ALL expense lines by default
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, code)
);
```

#### `dimension_values`
Master data list for each dimension.

```sql
CREATE TABLE dimension_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    dimension_id UUID NOT NULL REFERENCES tenant_dimensions(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,           -- e.g. "NG_FI"
    name VARCHAR(255) NOT NULL,           -- e.g. "Nigeria Finance"
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, dimension_id, code)
);
```

#### `chart_of_accounts`
The company's GL accounts.

```sql
CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gl_number VARCHAR(50) NOT NULL,
    gl_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('PL', 'BS')),  -- P&L or Balance Sheet
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, gl_number)
);
```

#### `gl_dimension_requirements`
Per GL account, per dimension — is this dimension required, optional, or N/A?

```sql
CREATE TABLE gl_dimension_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gl_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
    dimension_id UUID NOT NULL REFERENCES tenant_dimensions(id) ON DELETE CASCADE,
    requirement VARCHAR(20) NOT NULL CHECK (requirement IN ('required', 'optional', 'na')),
    UNIQUE(gl_id, dimension_id)
);
```

#### `expense_categories`
Two-level hierarchy: category → subcategory.

```sql
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES expense_categories(id) ON DELETE CASCADE,  -- NULL = top-level category
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, parent_id, code)
);
```

#### `category_gl_mappings`
Maps a subcategory to one or more GL accounts.

```sql
CREATE TABLE category_gl_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
    gl_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,     -- pre-select this GL when subcategory is chosen (AI can override)
    UNIQUE(category_id, gl_id)
);
```

### Changes to Existing Tables

#### `tenant_expense_config`
- Remove `gl_coding_mode` VARCHAR column
- Add `coding_level` INTEGER NOT NULL DEFAULT 0
- Add `show_location` BOOLEAN DEFAULT true
- Add `require_location` BOOLEAN DEFAULT false

### Alembic Migration
Single migration covering all of the above. Label: `m8_intelligent_form_foundation`

---

## Backend — New API Endpoints

All endpoints are tenant-scoped. All require authentication. Admin-only endpoints require `is_tenant_admin` or `has_non_admin_role` with finance_manager role.

### Dimensions

```
GET    /api/config/dimensions                  — list tenant dimensions
POST   /api/config/dimensions                  — create dimension
PATCH  /api/config/dimensions/{id}             — update dimension
DELETE /api/config/dimensions/{id}             — soft delete (set is_active=false)
POST   /api/config/dimensions/{id}/reorder     — update sort_order
```

### Dimension Values (Master Data)

```
GET    /api/config/dimensions/{id}/values      — list values for a dimension
POST   /api/config/dimensions/{id}/values      — add single value
PATCH  /api/config/dimensions/{id}/values/{vid} — update value
DELETE /api/config/dimensions/{id}/values/{vid} — soft delete
POST   /api/config/dimensions/{id}/values/upload — bulk upload via xlsx/csv
```

Upload endpoint:
- Accepts .xlsx or .csv
- Expected columns: `code` (required), `name` (required), `sort_order` (optional)
- Returns: `{ imported: N, skipped: N, errors: [{row, reason}] }`
- Skips duplicates (by code), does not overwrite existing

### Chart of Accounts

```
GET    /api/config/coa                         — list GL accounts (paginated, searchable)
POST   /api/config/coa                         — create single GL account
PATCH  /api/config/coa/{id}                    — update GL account
DELETE /api/config/coa/{id}                    — soft delete
POST   /api/config/coa/upload                  — bulk upload via xlsx/csv
GET    /api/config/coa/template                — download dynamically generated template
PATCH  /api/config/coa/{id}/dimensions         — set dimension requirements for a GL account
```

Upload endpoint:
- Accepts .xlsx or .csv
- Validates GL number uniqueness per tenant
- Validates account_type is 'PL' or 'BS'
- For each dimension column in the file: validates value is 'required', 'optional', or 'na'
- Returns: `{ imported: N, updated: N, skipped: N, errors: [{row, reason}] }`

Template endpoint:
- Generates .xlsx file dynamically
- Standard columns: GL Number*, GL Name*, Account Type* (P&L/BS), Description
- One additional column per active tenant dimension (with dropdown: required/optional/na)
- Row 1: Column headers (bold, blue background)
- Row 2: Description/instruction row (italic, grey)
- Row 3: Example row (pre-filled with realistic sample data)
- Dropdowns via Excel data validation
- Required columns marked with asterisk in header
- Returns file as download

### Expense Categories

```
GET    /api/config/categories                  — list full category tree
POST   /api/config/categories                  — create category or subcategory
PATCH  /api/config/categories/{id}             — update
DELETE /api/config/categories/{id}             — soft delete (cascades to subcategories)
POST   /api/config/categories/{id}/gl-mappings — add GL account to subcategory
DELETE /api/config/categories/{id}/gl-mappings/{gl_id} — remove GL mapping
PATCH  /api/config/categories/{id}/gl-mappings/{gl_id} — set/unset as default
```

### Expense Config (extend existing)

```
GET    /api/config/expense-config              — get current config (already exists)
PATCH  /api/config/expense-config              — update config (extend to include coding_level, show_location, require_location)
```

---

## Frontend — Admin Pages

All pages live under `/dashboard/business/settings/`

### 1. Dimensions Page
**Route:** `/dashboard/business/settings/dimensions`
**Sidebar label:** Master Data → Dimensions

UI:
- Table listing active dimensions with columns: Name, Code, Required by default, Active, Actions
- "Add Dimension" button → inline form or modal: Name (text), Code (auto-generated from name, editable), Required by default (toggle)
- Drag-to-reorder rows (updates sort_order)
- Edit and soft-delete actions per row
- "Manage Values →" link per dimension (goes to dimension values page)

### 2. Dimension Values Page
**Route:** `/dashboard/business/settings/dimensions/{id}/values`

UI:
- Breadcrumb: Settings > Dimensions > {Dimension Name}
- Table listing values: Code, Name, Active, Actions
- "Add Value" button → inline row or modal
- "Upload Values" button → file upload modal (.xlsx or .csv)
  - Shows upload result: X imported, X skipped, X errors
  - Error rows listed with row number and reason
- Edit and soft-delete per row

### 3. Chart of Accounts Page
**Route:** `/dashboard/business/settings/chart-of-accounts`
**Sidebar label:** Master Data → Chart of Accounts

UI:
- Search bar (search by GL number or name)
- Table: GL Number, GL Name, Account Type, Active, Actions
- "Add GL Account" button → modal: GL Number, GL Name, Account Type (P&L / Balance Sheet), Description
- "Upload CoA" button → file upload modal
  - Accepts .xlsx or .csv
  - Shows upload result summary + error list
- "Download Template" button → triggers GET /api/config/coa/template → downloads .xlsx
- Per row: Edit button, "Set Dimensions →" button
- "Set Dimensions" opens a modal showing all tenant dimensions with a dropdown per dimension (Required / Optional / N/A)

### 4. Expense Categories Page
**Route:** `/dashboard/business/settings/expense-categories`
**Sidebar label:** Master Data → Expense Categories

UI:
- Two-panel layout:
  - Left panel: list of top-level categories with expand/collapse
  - Right panel: subcategories for selected category + their GL mappings
- "Add Category" button (top level)
- Per category: "Add Subcategory" button, Edit, Delete
- Per subcategory: GL mappings list (GL number + name), "Add GL Account" button (searches CoA), remove button per mapping, star icon to set default GL
- Empty state if no CoA uploaded: "Upload your Chart of Accounts first before mapping GL accounts"

### 5. Expense Config Page (extend existing)
**Route:** `/dashboard/business/settings/expense-config`

Add to existing page:
- **Coding Level** section (replaces GL Coding Mode radio buttons):
  - 5 options displayed as cards (not radio buttons) — each card shows level number, name, and a one-line description of what the employee sees
  - Currently selected card highlighted in blue
- **Form Fields** section:
  - Show Location field: toggle (default: on)
  - Require Location: toggle (only enabled if Show Location is on)

### Sidebar Updates
Under Settings, add **Master Data** as a collapsible group containing:
- Dimensions
- Chart of Accounts  
- Expense Categories

---

## Seed Data

On new tenant creation, seed the following default expense categories (top-level only, no subcategories — admin adds subcategories):

- Travel Cost
- Entertainment
- Staff Cost
- Car Cost
- Insurance
- Consulting
- Other Indirect Costs

These are deletable/editable. They exist purely as a starting point for companies that don't want to build from scratch.

---

## Validation Rules

### Dimension codes
- Lowercase, alphanumeric + underscores only
- Auto-generated from name (e.g. "Cost Center" → "cost_center")
- Must be unique per tenant

### GL Numbers
- Alphanumeric only
- Must be unique per tenant
- Max 50 characters

### CoA upload
- GL Number and GL Name are required on every row
- Account Type must be exactly "PL" or "BS" (case-insensitive, normalize on import)
- Dimension columns: value must be "required", "optional", or "na" (case-insensitive)
- Empty dimension cell = treated as "optional"
- Duplicate GL number in file: skip second occurrence, count as skipped
- Duplicate GL number already in DB: update existing record (not create new)

### Category GL mappings
- Only one mapping per category can be `is_default = true`
- Can only map to GL accounts that exist in the tenant's CoA
- Cannot map to inactive GL accounts

---

## What M8 Does NOT Include

- Employee-facing dynamic form (that is M9)
- AI suggestion layer (that is M9)
- Location field changes on expense lines (M9 reads the config set in M8)
- Any changes to the approval workflow
- PDF/TXT upload for master data (deferred to AI Engine milestone)

---

## Definition of Done

- [ ] All DB migrations applied cleanly to `ziva_dev`
- [ ] All API endpoints working and returning correct data
- [ ] Dimensions: create, edit, reorder, soft delete working
- [ ] Dimension values: manual add, bulk upload (.xlsx and .csv), soft delete working
- [ ] CoA: manual add, bulk upload, template download working
- [ ] Template download generates correct columns based on tenant's configured dimensions
- [ ] GL dimension requirements: set per GL account working
- [ ] Expense categories: two-level hierarchy build working
- [ ] Category GL mappings: add, remove, set default working
- [ ] Expense config: coding level and location toggles saving correctly
- [ ] Sidebar updated with Master Data group
- [ ] Seed data applied on new tenant creation
- [ ] All pages tested locally by Adeniyi

## Commit Message
```
feat: M8 - intelligent form foundation (dimensions, CoA, categories, coding levels)
```

Then push to GitHub and update `docs/MASTER_CONTEXT.md`.

---

*End of M8 Brief. Written May 2026.*
