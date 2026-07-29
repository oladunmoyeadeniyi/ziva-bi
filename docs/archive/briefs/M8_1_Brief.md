# Milestone 8.1 — Advanced CoA, Dimensions & Employee Foundation
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## What This Milestone Delivers

M8.1 deepens the foundation laid in M8. It rebuilds the CoA template to full
enterprise spec, adds advanced dimension configuration (value types, cascading logic,
period activation), introduces bulk actions across all master data, and builds the
Employee master data module. It also adds Cost Center head configuration and Finance
review assignment.

After M8.1, M9 can be fully tested with real data.

---

## Part 1 — CoA Template Full Rebuild

### Current problem
The current CoA template is basic. It does not reflect the full GL structure, financial
statement mappings, or category/subcategory hierarchy. It also does not include
dimension columns dynamically based on tenant configuration.

### New template spec

The template is a dynamically generated .xlsx file. It is generated at download time
based on the tenant's configured dimensions. No two tenants get the same template.

#### Sheet 1 — GL Accounts (main sheet)

Columns in order:

**GL Identity**
- GL Number* — unique identifier (e.g. 733060)
- GL Name* — full descriptive name
- Account Type* — dropdown: SOCI / SOFP
  - SOCI = Statement of Comprehensive Income (P&L items)
  - SOFP = Statement of Financial Position (Balance Sheet items)
- Is Active — dropdown: Yes / No (default Yes)

**GL Hierarchy**
- GL Group — top-level grouping (e.g. PL3 - Marketing)
- GL Subgroup — second level (e.g. Sponsoring)
- GL Sub-subgroup — third level (optional, e.g. Sport Events)

**Financial Statement Mappings**
- FS Head — the line on the face of the financial statement (e.g. Revenue, Operating Expenses)
- FS Note — the note number/name in the financial statement notes (e.g. Note 5 - Staff Costs)
- TB Mapping — the Trial Balance grouping this GL rolls up to (e.g. OPEX, CAPEX, Revenue)

**Group Reporting**
- Group Account Number — the parent group's equivalent GL number (for subsidiaries reporting to a group)
- Group Account Name — the parent group's GL name

**Category Mapping**
- Category — maps this GL to a top-level expense category (e.g. Travel Cost)
- Subcategory — maps this GL to a subcategory (e.g. Hotel)
- Is Default GL for Subcategory — dropdown: Yes / No
  (if Yes, this GL is pre-selected when the subcategory is chosen by an employee)

**Dimension Requirements**
- One column per active tenant dimension, dynamically generated
- Column header = dimension name (e.g. "Cost Center", "Real/Statistical Order")
- Dropdown values per cell: Required / Optional / N/A
- Empty cell treated as Optional on import

#### Sheet 2 — Dimensions Setup

This sheet allows the company to upload or update their dimension master data
(values list) alongside the CoA in one file.

Columns:
- Dimension Name* — must match an existing configured dimension name exactly
- Value Code* — unique code for the value (e.g. NG_FI)
- Value Name* — display name (e.g. Nigeria Finance)
- Value Type — the type of this value (e.g. Cost Center, Trading Partner, Real Order,
  Statistical Order) — used for per-GL type filtering
- Valid From — date from which this value is active (optional)
- Valid To — date until which this value is active (optional, leave blank = always active)
- Is Active — dropdown: Yes / No

#### Sheet 3 — Instructions

- Row-by-row explanation of every column
- Required vs optional clearly marked
- Example rows pre-filled with realistic sample data (Red Bull style)
- Colour coding: required columns = light blue header, optional = light grey header
- Notes on SOCI vs SOFP, dimension types, group mapping, and category mapping

### Template generation rules
- Sheet 2 dimension columns are generated dynamically — only active dimensions appear
- Dropdown validation applied to: Account Type, Is Active, dimension requirement columns,
  Is Default GL, Value Type
- Template filename: `{tenant_name}_CoA_Template_{date}.xlsx`

### Upload processing
On upload, process all sheets in order:
1. Sheet 2 first — upsert dimension values (so they exist before GL references them)
2. Sheet 1 — upsert GL accounts and all mappings

Upload returns a detailed result:
```json
{
  "sheet1": { "imported": N, "updated": N, "skipped": N, "errors": [{row, reason}] },
  "sheet2": { "imported": N, "updated": N, "skipped": N, "errors": [{row, reason}] }
}
```

Duplicate GL number = update existing record (not create new).
Invalid dimension name in Sheet 2 = skip row, add to errors.

---

## Part 2 — Advanced Dimension Configuration

### 2a — Dimension Value Types

Each dimension value can have a `value_type` (e.g. "cost_center", "trading_partner",
"real_order", "statistical_order", "employee_code").

**DB change:**
```sql
ALTER TABLE dimension_values ADD COLUMN value_type VARCHAR(100);
```

**UI change — Dimension Values page:**
- Add "Value Type" column to the values table
- Add "Value Type" field to add/edit value form
- Value type is a free-text field (companies define their own types)
- On the Dimensions setup page: add a "Accepted Value Types" field per dimension
  (multi-select from existing value types used in that dimension's values)

**Behaviour on expense form (M9 integration):**
- When a GL is selected, check if any dimension has a type restriction for that GL
- Filter that dimension's dropdown to only show values matching the accepted type(s)
  for this GL's dimension requirement
- Example: GL 733060 requires Dim 2 (IO) as type "statistical_order" only →
  dropdown shows only values where value_type = "statistical_order"

### 2b — Cascading Dimension Logic

Some dimension values are dependent on another dimension's selection.

**Example:** Statistical IO values each belong to a specific Cost Center. When an
employee selects a Statistical IO, the Cost Center should auto-fill.

**DB change:**
```sql
ALTER TABLE dimension_values ADD COLUMN cascade_dimension_id UUID 
    REFERENCES tenant_dimensions(id);
ALTER TABLE dimension_values ADD COLUMN cascade_value_id UUID 
    REFERENCES dimension_values(id);
```

Each dimension value can optionally point to another dimension + value that should
be auto-filled when this value is selected.

**UI change — Dimension Values page:**
- Add "Auto-fills" field to add/edit value form
- Dropdown: select a dimension → then select a value from that dimension
- Shows as: "When selected → auto-fill Cost Center = NG_FI"

**Behaviour on expense form:**
- When employee selects a dimension value that has a cascade rule:
  auto-fill the target dimension with the cascade value
- Auto-filled fields show a lock icon 🔒 and are read-only
- Employee can override by clicking the lock icon (with a confirmation)

### 2c — Period/Financial Year Activation

Dimension values can be restricted to specific financial year(s) or date ranges.

Already handled by `valid_from` and `valid_to` columns in Sheet 2 upload.

**DB change (already exists from M8 — just ensure these columns are present):**
```sql
ALTER TABLE dimension_values ADD COLUMN valid_from DATE;
ALTER TABLE dimension_values ADD COLUMN valid_to DATE;
```

**Behaviour:**
- On expense form: only show dimension values where today falls within valid_from
  and valid_to range (or where both are null = always active)
- On dimension values admin page: show validity dates per value
- Add validity columns to the add/edit form

---

## Part 3 — Bulk Actions for All Master Data

Apply to: CoA page, Dimension Values page, Expense Categories page,
and Employee page (Part 4).

### UI changes

**Row selection:**
- Add checkbox column as first column on all master data tables
- Header checkbox = select all on current page
- "Select all N records" link appears when page-level select is checked
  (e.g. "All 20 on this page selected — Select all 847 records")

**Bulk action toolbar:**
- Appears above the table when any rows are selected
- Shows: "N selected" + action buttons:
  - Deactivate Selected
  - Activate Selected
  - Delete Selected (with confirmation modal — "This cannot be undone")

**CoA-specific additional actions:**
- "Replace All" button (separate from bulk select — always visible):
  - Opens a confirmation modal: "This will deactivate all existing GL accounts and
    import the new file. Existing expense lines will not be affected. Continue?"
  - On confirm: deactivates all existing CoA records, then processes the upload
- "Merge Upload" (default upload behaviour — existing records updated, new ones added,
  nothing deleted)

**Confirmation modal for Delete Selected:**
- Shows count: "You are about to permanently delete 47 records."
- For CoA: warns if any GL accounts have been used on existing expense lines
  (those cannot be deleted — only deactivated)
- Require typing "DELETE" to confirm bulk delete

---

## Part 4 — Employee Master Data

### New DB table: `employees`

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_code VARCHAR(100),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    other_name VARCHAR(100),
    preferred_name VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    cost_center_id UUID REFERENCES dimension_values(id),  -- links to a cost center dimension value
    line_manager_id UUID REFERENCES employees(id),
    resumption_date DATE,
    is_active BOOLEAN DEFAULT true,
    employee_code_auto_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, employee_code),
    UNIQUE(tenant_id, email)
);
```

### New DB table: `employee_code_history`
Tracks retrospective and progressive code changes.

```sql
CREATE TABLE employee_code_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    old_code VARCHAR(100),
    new_code VARCHAR(100) NOT NULL,
    change_type VARCHAR(20) CHECK (change_type IN ('retrospective', 'progressive')),
    effective_date DATE NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);
```

### New DB table: `employee_transfers`
Tracks cost center transfers.

```sql
CREATE TABLE employee_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    from_cost_center_id UUID REFERENCES dimension_values(id),
    to_cost_center_id UUID REFERENCES dimension_values(id),
    effective_date DATE NOT NULL,
    notes TEXT,
    transferred_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Employee Code Configuration

On tenant setup (add to Expense Config or new HR Config page):
- Auto-generate employee codes: toggle Yes/No
- If Yes: define prefix and number format (e.g. "EMP-" + 5 digits = EMP-00001)
- If No: employee codes are uploaded manually

### Employee Upload Template

Downloadable .xlsx template with columns:

**Required:**
- First Name*, Last Name*, Email*

**Optional:**
- Other Name, Preferred Name, Employee Code (required if auto-generate is off),
  Cost Center Code (must match a dimension value code), Line Manager Email,
  Resumption Date (dd/mm/yyyy), Phone

**Instructions sheet** included (same style as CoA template).

### API Endpoints

```
GET    /api/hr/employees                    — list employees (paginated, searchable)
POST   /api/hr/employees                    — create single employee
PATCH  /api/hr/employees/{id}              — update employee
DELETE /api/hr/employees/{id}              — soft delete (deactivate)
POST   /api/hr/employees/upload            — bulk upload via xlsx/csv
GET    /api/hr/employees/template          — download template
POST   /api/hr/employees/{id}/transfer     — transfer to new cost center
POST   /api/hr/employees/{id}/update-code  — update employee code (retrospective/progressive)
GET    /api/hr/employees/{id}/history      — view code change + transfer history
```

### Employee Admin Page

**Route:** `/dashboard/business/settings/employees`
**Sidebar:** Master Data → Employees

UI:
- Table: Employee Code, Name, Email, Cost Center, Line Manager, Status, Actions
- Search by name, code, or email
- Filter by cost center, active/inactive
- Bulk actions (same as Part 3)
- "Add Employee" button → modal with full form
- "Upload Employees" button → file upload modal
- "Download Template" button
- Per row: Edit, Transfer, View History, Deactivate

**Transfer modal:**
- Select new cost center (dropdown from dimension values)
- Effective date
- Notes field
- Option: keep same employee code or assign new code

**Code Update modal:**
- New code field
- Change type: Retrospective / Progressive
- Effective date
- Notes

**History drawer:**
- Shows timeline of all code changes and cost center transfers for the employee

### Employee as Dimension Value

Employee codes are a dimension value type. After uploading employees:
- Employee codes automatically become available as dimension values of
  type "employee_code" in whichever dimension the company has configured
  for employee codes
- No manual re-entry needed — the employee upload feeds the dimension values

This is configured on the Dimensions page: mark a dimension as
"Source: Employee Codes" → values auto-sync from the employees table.

---

## Part 5 — Cost Center Head & Finance Config

### New DB table: `cost_center_config`

```sql
CREATE TABLE cost_center_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cost_center_id UUID NOT NULL REFERENCES dimension_values(id) ON DELETE CASCADE,
    head_employee_id UUID REFERENCES employees(id),
    head_user_id UUID REFERENCES users(id),  -- if head has a Ziva BI account
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, cost_center_id)
);
```

### New DB table: `finance_review_config`

```sql
CREATE TABLE finance_review_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL CHECK (module IN ('expense_retirement', 'accounts_payable')),
    reviewer_user_id UUID NOT NULL REFERENCES users(id),
    review_level INTEGER NOT NULL DEFAULT 1,
    cost_center_id UUID REFERENCES dimension_values(id),  -- NULL = applies to all cost centers
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Cost Center Config Page

**Route:** `/dashboard/business/settings/cost-centers`
**Sidebar:** Master Data → Cost Centers

UI:
- Table: Cost Center Code, Cost Center Name, Head (employee name), Actions
- "Set Head" button per row → modal to search and assign an employee as head
- Head assignment links to both the employee record and their Ziva BI user account
  (if they have one)

### Finance Review Config Page

**Route:** `/dashboard/business/settings/finance-review`
**Sidebar:** Settings → Finance Review

UI:
- Tabs: Expense Retirement | Accounts Payable (AP tab greyed out — coming soon)
- Table showing configured reviewers: Name, Role, Review Level, Applies To
- "Add Reviewer" button → modal:
  - Select user (from team members)
  - Review level (1, 2, 3...)
  - Applies to: All cost centers / Specific cost center
- Drag to reorder review levels
- Remove reviewer button per row

---

## Alembic Migration

Single migration covering all new tables and column additions.
Label: `m8_1_advanced_coa_dimensions_employees`

---

## Sidebar Updates

Add to Master Data group:
- Employees (new)
- Cost Centers (new)

Add to Settings group:
- Finance Review (new)

---

## Performance Requirements

- Employee list: paginated (50 per page), indexed on tenant_id + email + employee_code
- CoA upload: process in batches of 500 rows — return progress for large files
- Dimension values cascade lookup: cached per tenant session
- Template generation: < 3 seconds for tenants with up to 500 GL accounts

---

## Definition of Done

- [ ] CoA template rebuilt with all columns (Sheet 1 + Sheet 2 + Instructions)
- [ ] Template dynamically includes dimension columns based on tenant config
- [ ] Template download generates correct file and is downloadable
- [ ] CoA upload processes both sheets correctly
- [ ] Upload returns detailed per-sheet result with row-level errors
- [ ] Dimension value types: add/edit working, filtering on expense form working
- [ ] Cascading dimension logic: auto-fill working on expense form
- [ ] Period activation: valid_from/valid_to respected on expense form dropdowns
- [ ] Bulk actions working on CoA, Dimension Values, Expense Categories pages
- [ ] Replace All CoA working with correct warning
- [ ] Employee table created and migration applied
- [ ] Employee upload template downloadable
- [ ] Employee upload working (xlsx and csv)
- [ ] Employee transfer working with history
- [ ] Employee code update (retrospective/progressive) working
- [ ] Employee codes auto-sync as dimension values
- [ ] Cost center head assignment working
- [ ] Finance review config working for expense retirement module
- [ ] All new sidebar links working
- [ ] Tested locally by Adeniyi

## Commit Message
```
feat: M8.1 - advanced CoA template, dimension types, cascading, bulk actions, employee master, cost center config
```

Then push to GitHub and update `docs/MASTER_CONTEXT.md`.

---

*End of M8.1 Brief. Written May 2026.*
