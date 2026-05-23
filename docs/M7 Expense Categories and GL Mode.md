Milestone 7 — Expense Categories & GL Coding Mode Config

CONTEXT:
- M1-M6 complete
- This milestone makes the expense form configurable per tenant
- Two major features:
  1. Tenant configures how GL coding works on expense forms
  2. Tenant creates expense categories and subcategories

STANDING REQUIREMENTS:
- All pages fully mobile responsive
- Tenant-scoped: each tenant sees only their own data
- Existing expense records must not break
- If tenant has no config: form behaves as it does today

---

## 1. DATABASE — New migration

### tenant_expense_config
Stores per-tenant expense form configuration.
- id (UUID, PK)
- tenant_id (UUID, FK → tenants, UNIQUE)
- gl_coding_mode (VARCHAR, default 'employee')
  Values:
  - 'employee' — employee selects GL account themselves
  - 'finance' — employee never sees GL fields; Finance 
    team handles GL coding during review/posting
  - 'category_mapped' — employee selects expense category; 
    system suggests GL based on category mapping
- require_category (BOOLEAN, default false)
  — whether expense category selection is required
- require_subcategory (BOOLEAN, default false)
- allow_free_text_description (BOOLEAN, default true)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### expense_categories
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- name (VARCHAR) — e.g. "Travel", "Fuel", "Hotel"
- code (VARCHAR, nullable) — optional short code
- parent_id (UUID, FK → expense_categories, nullable)
  — null = top-level category; set = subcategory
- gl_account_suggestion (VARCHAR, nullable)
  — suggested GL code when this category is selected
  (used in category_mapped mode)
- is_active (BOOLEAN, default true)
- sort_order (INTEGER, default 0)
- created_at (TIMESTAMP)
- UNIQUE constraint on (tenant_id, name, parent_id)

### Update expense_lines table:
Add columns:
- category_id (UUID, FK → expense_categories, nullable)
- subcategory_id (UUID, FK → expense_categories, nullable)

---

## 2. BACKEND

Create: backend/app/routers/expense_config.py

### Tenant Expense Config
GET /api/expense-config
- Get current tenant's expense config
- If no config exists, return defaults:
  { gl_coding_mode: 'employee', require_category: false,
    require_subcategory: false, 
    allow_free_text_description: true }

POST /api/expense-config
- Create or update tenant expense config
- Tenant Admin only
- Body: { gl_coding_mode, require_category, 
  require_subcategory, allow_free_text_description }

### Expense Categories
GET /api/expense-config/categories
- List all active categories for tenant
- Returns hierarchical structure:
  [ { id, name, code, subcategories: [...] } ]
- Top-level only (parent_id = null) with nested subcategories

POST /api/expense-config/categories
- Create category or subcategory
- Body: { name, code, parent_id, gl_account_suggestion, 
  sort_order }
- Tenant Admin only

PATCH /api/expense-config/categories/{id}
- Update category
- Tenant Admin only

DELETE /api/expense-config/categories/{id}
- Soft delete (is_active = false)
- Also deactivates all subcategories
- Tenant Admin only

### Public endpoint (for expense form)
GET /api/expense-config/form-config
- Returns everything the expense form needs:
  {
    gl_coding_mode,
    require_category,
    require_subcategory,
    allow_free_text_description,
    categories: [ { id, name, subcategories: [...] } ]
  }
- Used by frontend to render the correct form fields

Register router in main.py with prefix /api/expense-config

---

## 3. FRONTEND

### Settings — Expense Form Config
Page: /dashboard/business/settings/expense-config
Add "Expense Config" under Settings in sidebar 
(Tenant Admin only)

Section 1 — GL Coding Mode:
Three radio options with clear descriptions:

○ Employee codes GL
  "Employees select GL accounts when submitting expenses.
   Requires Chart of Accounts to be configured."

○ Finance codes GL (recommended for most companies)
  "Employees do not see GL fields. Finance team assigns 
   GL codes during review and posting."

○ Category-mapped GL
  "Employees select an expense category. The system 
   suggests a GL account based on category mapping.
   Finance can override."

Section 2 — Expense Categories:
Toggle: "Require expense category" (on/off)
Toggle: "Require subcategory" (on/off, only shown if 
  category is required)

Section 3 — Category Management:
(shown when require_category is ON)

Tree view of categories:
▼ Travel
  ├── Domestic Travel
  └── International Travel
▼ Accommodation
  ├── Hotel
  └── Guest House
▼ Meals & Entertainment
▼ Fuel & Lubricants
▼ Office Supplies

Actions per category:
- "+ Add Subcategory" inline
- Edit name/code/GL suggestion
- Deactivate

Button: "+ Add Category" at top level

Each category row (in category_mapped mode) shows:
- GL Account Suggestion field (text input)

### Update Expense Form
Both /new and /{id}/edit pages:

On page load, fetch GET /api/expense-config/form-config

Based on gl_coding_mode:

MODE: 'employee' (current behaviour)
- Show GL Account, P/L Group, IO/Dimension, 
  Cost Center fields as today
- No category fields

MODE: 'finance'
- HIDE GL Account, P/L Group fields entirely
- Show Category dropdown (if require_category = true)
- Show Subcategory dropdown (if require_subcategory = true)
- Keep Description, Amount, Invoice fields as normal
- Show subtle note: "GL coding will be assigned by Finance"

MODE: 'category_mapped'
- Show Category dropdown first
- Show Subcategory dropdown (if configured)
- Show GL Account field (pre-filled with suggestion 
  from category, but editable)
- Show P/L Group field

Category dropdown:
- Searchable dropdown
- Options from form-config categories
- When category selected with subcategories available,
  show subcategory dropdown

### Update Expense Detail View
Show category and subcategory if set:
- Add "Category" and "Subcategory" columns to lines table
- In 'finance' mode, show GL fields as empty/pending 
  with label "Pending GL coding by Finance"

### Update Approvals View
For 'finance' mode:
- Finance approver sees an additional "GL Coding" 
  section on the expense detail
- Per line: GL Account input, P/L Group input
- Finance can fill in GL codes before approving
- These fields are editable only for Finance role

---

## 4. SEED DATA
Add sample categories for test tenant:

Top-level categories:
- Travel (code: TRV, gl_suggestion: 670010)
  - Domestic Travel
  - International Travel
- Accommodation (code: ACC, gl_suggestion: 733060)
  - Hotel
  - Guest House
- Meals & Entertainment (code: MEA, gl_suggestion: 733500)
  - Business Meals
  - Client Entertainment
- Fuel & Lubricants (code: FUE, gl_suggestion: 720000)
- Office Supplies (code: OFF, gl_suggestion: 760020)
- Staff Costs (code: STF, gl_suggestion: 500000)

---

## 5. SETTINGS NAVIGATION
Add to Settings sidebar:
- Approval Matrix (existing)
- Expense Config (new) ← add here
- Master Data (placeholder for M8)
- Team (existing)

---

## AFTER BUILDING:
1. Run Alembic migration
2. Run seed for test categories
3. Test all three GL coding modes:

   Test A — Finance mode:
   - Go to Settings → Expense Config
   - Set mode to "Finance codes GL"
   - Enable require_category
   - Open new expense form
   - Confirm GL fields hidden, category dropdown shows
   - Submit expense
   - Login as Finance approver
   - Confirm GL coding section visible on approval page

   Test B — Category-mapped mode:
   - Set mode to "Category-mapped GL"
   - Open expense form
   - Select "Accommodation → Hotel"
   - Confirm GL Account auto-fills with 733060
   - Confirm it's editable

   Test C — Employee mode (default):
   - Set mode back to "Employee codes GL"
   - Confirm form looks exactly as before

4. Commit: "feat: Milestone 7 - Expense categories and GL 
   coding mode config"
5. Push to GitHub