# Milestone 9 — Intelligent Expense Form (Employee-Facing)
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## What This Milestone Delivers

M9 makes the employee expense form intelligent. It connects everything configured in M8
(coding levels, CoA, dimensions, category/GL hierarchy) to the actual expense submission
experience. The form adapts based on the tenant's configured coding level, guides the
employee through GL selection via a popup flow, enforces dimension rules per GL, supports
split lines, and includes basic AI suggestions based on past patterns.

---

## Background & Design Decisions

### Core UX principle
The form must be **thin, clean, and guided**. Employees are not accountants. The system
should do the thinking — the employee just clicks through a structured flow and fills in
amounts and descriptions.

### Line completion model
- Lines are not locked — employees can add multiple lines freely
- Incomplete lines show a subtle red/amber border
- Submission is blocked until ALL lines are complete (all required fields filled +
  support document attached per line)
- A line is "complete" when: GL selected, all required dimensions filled, amount entered,
  description entered, invoice date entered, support document attached

### GL selection model
- All coding levels use the same popup flow — the popup just shows different steps
  depending on the level
- Group/subgroup/category path is stored per line but NOT shown on the form surface —
  keeps the form thin
- Approvers can expand to see the path; Finance sees and can edit everything

---

## Coding Level Behaviour

### Level 0 — Finance codes everything
- Employee sees: Description, Amount, Invoice Date, Invoice No, Dimensions (if any
  are marked required for all GLs), Support Document
- No GL field, no category field
- Finance assigns GL during review

### Level 1 — Category only
- Employee sees: "+ Add Expense Item" button → popup shows category/subcategory cards
- GL is auto-assigned from the mapping (the default GL for that subcategory)
- Employee never sees the GL number
- If subcategory has no default GL mapped: show warning to admin in config, block
  submission with message "Contact your Finance team — this category has no GL mapped"

### Level 2 — Category + GL confirmation
- Same popup flow as Level 1
- After subcategory selected: popup shows the suggested GL (number + name) as read-only
- Employee sees a "Flag as incorrect" button — clicking it adds a flag comment field
- GL is stored; Finance can see the flag and override during review

### Level 3 — Guided GL selection
- Full popup flow: Group/Category → Subgroup/Subcategory → filtered GL list
- Employee picks the final GL from the filtered list
- This is the Red Bull model

### Level 4 — Full GL coding
- Popup opens to a searchable GL list (no category filtering)
- Employee types GL number or name to search
- Selects from results

### Option C — Both category and GL group paths available
- Popup Step 1 shows two tabs: "By Category" and "By GL Group"
- Employee picks their preferred path
- Both paths lead to the same final GL selection step
- Company configures which paths are available (one or both) in Expense Config

---

## Popup Flow — Detailed Spec

### Trigger
Employee clicks **"+ Add Expense Item"** button on the expense form.

### Popup structure
Full-screen overlay on mobile, centered modal (600px wide) on desktop.
Header shows: "What did you spend on?" with a back button (←) and close (×).

### Step 1 — Top-level group or category
- Display as large clickable cards in a grid (2 columns mobile, 3 columns desktop)
- Each card: icon (auto-assigned by category name) + name
- If Option C (both paths): show two tabs at top — "By Category" | "By GL Group"
- Clicking a card → transitions to Step 2 (slide animation)

### Step 2 — Subgroup or subcategory
- Same card layout as Step 1
- Breadcrumb at top shows: "Marketing ›" (clickable to go back)
- Clicking a card → transitions to Step 3

### Step 3 — GL Account selection
- List view (not cards) — more items expected here
- Each row: GL Number (bold) + GL Name + optional description
- Search bar at top to filter the list
- Clicking a row → selects it, popup closes, line appears on form
- For Level 1: this step is skipped (GL auto-assigned)
- For Level 4: Step 1 and 2 are skipped, goes straight to searchable full GL list

### After popup closes
- New line appears on the expense form
- Line shows: GL Number + GL Name (compact, not editable by employee)
- Remaining fields appear for employee to fill: Amount, Invoice Date, Invoice No,
  Description, Dimensions, Support Document
- Line has amber border until all required fields are complete
- Once complete: border turns green with a subtle ✓ indicator

---

## Expense Line — Field Spec

Each line contains these fields in order:

| Field | Required | Notes |
|---|---|---|
| GL Account | Yes | Set via popup, not directly editable by employee |
| Amount (NGN) | Yes | Numeric, 2 decimal places |
| Invoice Date | Yes | Date picker |
| Invoice No | Yes | Text |
| Description | Yes | Text, max 255 chars |
| Dimensions | Varies | Rendered dynamically based on GL's dimension requirements |
| Support Document | Yes | File upload per line (existing functionality) |
| Split | No | Button to split this line — see Split Lines section |

### Dimension fields on the line
- Rendered dynamically after GL is selected
- Only show dimensions marked "required" or "optional" for the selected GL
- Required dimensions: red asterisk, blocks submission if empty
- Optional dimensions: shown but not blocking
- N/A dimensions: not shown at all
- Each dimension field is a dropdown populated from that dimension's active values
- If the GL has a dimension type restriction (e.g. Dim 2 only accepts Trading Partner
  codes for this GL): filter the dropdown to only show values of that type

### Location field
- Shown/hidden based on tenant's `show_location` config
- Required/optional based on tenant's `require_location` config
- Simple text input (not a dimension)

---

## Split Lines

### What it is
One invoice amount split across multiple GLs and/or dimensions, without creating
separate unrelated lines. All split lines share the same Invoice No and Support Document.

### UX flow
1. Employee fills a line normally (GL, Amount, Invoice Date, Invoice No, Description,
   Support Doc)
2. A **"Split"** button appears on the completed line
3. Clicking "Split" → opens a split panel below the line (not a new popup)
4. Split panel shows:
   - Original line summarised at top (GL, total amount)
   - "Add split" button → triggers the same popup flow to pick a GL for the split
   - Each split row: GL + Amount field
   - Running total shown: "₦300,000 of ₦425,000 allocated"
   - Warning if split amounts don't add up to original: "₦125,000 unallocated"
   - Split rows inherit Invoice No and Support Doc from parent line automatically
5. Employee can add as many split rows as needed
6. When all amount is allocated: split panel shows green "Fully allocated ✓"

### Visual representation on form
- Parent line shown normally
- Split rows shown as indented sub-lines beneath parent with a "↳" indicator
- Parent line amount updates to show: "₦425,000 (split into 3)"
- Each split row shows its own GL and allocated amount
- Dimensions filled separately per split row (since different GLs may need different dims)

### Validation
- Total of all split rows must equal parent line amount before submission
- Each split row must have GL + Amount + all required dimensions for that GL
- Support document is shared — only needs to be uploaded once on parent line

---

## AI Suggestion Layer (Basic)

### What it does
After the employee selects a GL via the popup, the system checks past expense lines
submitted by this employee for the same GL and pre-fills:
- Description (most recently used)
- Dimensions (most commonly used values for this GL by this employee)

### How it works
- On GL selection: call `GET /api/expenses/suggestions?gl_id={id}&user_id={id}`
- Backend queries last 10 approved expense lines for this employee + this GL
- Returns most frequent values for each dimension + most recent description
- Frontend pre-fills these as suggestions (shown in a lighter colour/italic)
- Employee can accept (click to confirm) or ignore (just type over it)

### Suggestion confidence
- If a value appears in 80%+ of past lines: pre-fill automatically
- If between 40–79%: show as suggestion pill below the field ("Last used: NG_FI")
- Below 40%: no suggestion shown

### Scope
- Suggestions are per employee + per GL only (not tenant-wide in M9)
- Tenant-wide pattern learning deferred to AI Engine milestone

---

## Backend Changes

### New/modified endpoints

```
GET  /api/config/categories/tree          — full category+GL tree for popup (tenant-scoped)
GET  /api/config/gl/search                — search GL accounts (for Level 4 direct search)
GET  /api/expenses/suggestions            — AI suggestions per employee + GL
```

### Expense line model changes
Add to `expense_lines` table:
```sql
ALTER TABLE expense_lines ADD COLUMN category_id UUID REFERENCES expense_categories(id);
ALTER TABLE expense_lines ADD COLUMN gl_id UUID REFERENCES chart_of_accounts(id);
ALTER TABLE expense_lines ADD COLUMN dimension_values JSONB;  -- {dimension_id: value_id}
ALTER TABLE expense_lines ADD COLUMN is_split_parent BOOLEAN DEFAULT false;
ALTER TABLE expense_lines ADD COLUMN split_parent_id UUID REFERENCES expense_lines(id);
ALTER TABLE expense_lines ADD COLUMN flag_incorrect BOOLEAN DEFAULT false;
ALTER TABLE expense_lines ADD COLUMN flag_comment TEXT;
```

### Alembic migration
Label: `m9_intelligent_expense_form`

### Line completion check
Backend validates on submit:
- All lines: GL assigned (except Level 0), amount > 0, invoice date, invoice no,
  description, all required dimensions filled
- All lines: at least one support document attached
- All split lines: amounts sum to parent amount
- Returns field-level errors if validation fails (not just a generic 400)

---

## Frontend Changes

### New expense page (`new/page.tsx`) — full redesign

**Header section** (unchanged fields):
- Employee Name, Employee Code, Report Date, Employee Function

**Expense Lines section:**
- Empty state: clean illustration + "No expense items yet" message
- **"+ Add Expense Item"** button — prominent, blue, centered when empty;
  moves to top-right of lines table once lines exist
- Lines render as a clean card list (not a wide table) — each line is a card
- Card shows: GL number + name (top), amount (top right), status indicator
  (amber border = incomplete, green border = complete)
- Expand/collapse each card to see/fill the detail fields
- Cards are expanded by default when first added

**GL Popup component** (`ExpenseItemPicker.tsx`):
- Full reusable component
- Handles all coding levels
- Manages step state (step 1/2/3), back navigation, search
- Returns selected GL + category path to parent

**Split panel component** (`SplitLinePanel.tsx`):
- Rendered inline below parent card
- Manages split rows state
- Shows allocation progress bar

**Submit button:**
- Shows count of incomplete lines: "3 lines — 1 incomplete"
- Disabled with tooltip if any lines incomplete or documents missing

### Edit expense page (`edit/page.tsx`)
- Same redesign as new page
- Finance role: GL field becomes editable dropdown (bypasses popup)
- Approver role: all fields read-only, can expand to see group/subgroup path

### Approver view
- Expense detail page shows each line with group → subgroup → GL path visible
- Compact by default, expandable

---

## Performance Requirements

These are mandatory — not optional:

**Backend:**
- Category tree endpoint: cache per tenant (invalidate on category/GL config change)
- Suggestions endpoint: respond in < 200ms (index on user_id + gl_id in expense_lines)
- Line validation: single DB round-trip (not per-line queries)

**Frontend:**
- Popup renders instantly — category tree loaded once on page load, not on popup open
- No full page reload on line add/save — all state managed in React
- Debounce GL search input (300ms)
- Lazy load split panel (don't render until "Split" is clicked)

---

## Definition of Done

- [ ] All 5 coding levels working correctly on the expense form
- [ ] GL popup flow working: group → subgroup → GL selection
- [ ] Both "By Category" and "By GL Group" paths working in popup
- [ ] Dimension fields render dynamically per selected GL
- [ ] Dimension type filtering working (only show valid value types per GL)
- [ ] Incomplete line shows amber border; complete line shows green
- [ ] Submit blocked until all lines complete + all documents attached
- [ ] Split lines working: add splits, allocation tracker, shared invoice/doc
- [ ] AI suggestions working: pre-fill on GL selection based on past patterns
- [ ] Location field respects show/require config
- [ ] Finance can edit GL directly (bypasses popup)
- [ ] Approver sees group/subgroup/GL path on detail view
- [ ] Alembic migration applied cleanly
- [ ] All tested locally by Adeniyi across at least 2 coding levels
- [ ] Performance: popup opens instantly, suggestions load < 200ms

## Commit Message
```
feat: M9 - intelligent expense form (GL picker, dynamic dimensions, split lines, AI suggestions)
```

Then push to GitHub and update `docs/MASTER_CONTEXT.md`.

---

*End of M9 Brief. Written May 2026.*
