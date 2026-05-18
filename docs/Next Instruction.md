Stop. Do not proceed with what you proposed.

The Expense Management PRD was not in docs/ yet — I am providing the 
scope now directly. Ignore the individual expense tracker you outlined. 
That is a different feature for a later milestone.

Milestone 3 is specifically: Business Expense Retirement Submission — 
a structured form used by company employees to retire business expenses 
with full GL coding, modelled on a real enterprise expense form.

Here is the exact specification. Build this instead:

We are building Milestone 3 of Ziva BI: Business Expense Retirement submission.

Read MASTER_CONTEXT.md and EXPENSE_MANAGEMENT_PRD.md in the docs/ folder before writing any code.

---

CONTEXT:
- Stack: Next.js 15 (App Router) + FastAPI + PostgreSQL + SQLAlchemy async
- Auth is complete (Milestone 2). Use the existing auth pattern.
- All business tables need tenant_id. Users are already linked to tenants.
- Currency: NGN only for M3. No FX.
- No approvals in M3. Status flow: DRAFT → SUBMITTED only.

---

WHAT TO BUILD:

## 1. DATABASE — Backend

Create a new Alembic migration with these tables:

### expense_reports
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- report_number (VARCHAR) — auto-generated: format EXP-{YEAR}-{SEQUENCE}, e.g. EXP-2026-0001
- employee_id (UUID, FK → users)
- employee_code (VARCHAR) — stored at submission time
- employee_function (VARCHAR) — stored at submission time
- report_date (DATE)
- status (VARCHAR) — DRAFT | SUBMITTED
- currency (VARCHAR, default NGN)
- total_amount (NUMERIC 15,2)
- submitted_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### expense_lines
- id (UUID, PK)
- report_id (UUID, FK → expense_reports, CASCADE DELETE)
- line_number (INTEGER) — 1, 2, 3...
- pl_group (VARCHAR, nullable) — e.g. PL4
- gl_account (VARCHAR) — e.g. "733060 - Hotel Expenses"
- io_dimension (VARCHAR, nullable) — Real & Stat IO (employee's personal IO)
- cost_center (VARCHAR, nullable) — Cost Center / Trading Partner
- location (VARCHAR, nullable)
- invoice_date (DATE, nullable)
- invoice_number (VARCHAR, nullable)
- description (VARCHAR) — required
- amount (NUMERIC 15,2) — required
- created_at (TIMESTAMP)

---

## 2. BACKEND — FastAPI

Create: backend/app/routers/expenses.py

All routes require auth (use existing get_current_user dependency).
All queries must filter by tenant_id from the current user's tenant.

### Endpoints:

POST /api/expenses/reports
- Create a new DRAFT expense report
- Auto-generate report_number
- Body: { report_date, employee_function }
- Returns: full report object

GET /api/expenses/reports
- List reports for current tenant
- Query params: status (optional filter), employee_id (optional filter)
- Returns: array of reports with line count and total

GET /api/expenses/reports/{report_id}
- Get single report with all lines
- Returns: report + lines array

POST /api/expenses/reports/{report_id}/lines
- Add a line to a DRAFT report
- Body: { pl_group, gl_account, io_dimension, cost_center, location, invoice_date, invoice_number, description, amount }
- Recalculates report total_amount
- Returns: updated report with lines

DELETE /api/expenses/reports/{report_id}/lines/{line_id}
- Remove a line from a DRAFT report
- Recalculates total_amount

PATCH /api/expenses/reports/{report_id}
- Update report header fields (only if DRAFT)
- Body: any subset of { report_date, employee_function }

POST /api/expenses/reports/{report_id}/submit
- Changes status from DRAFT → SUBMITTED
- Sets submitted_at = now()
- Validates: must have at least 1 line, description required on all lines
- Returns: updated report

Register the router in main.py with prefix /api/expenses.

---

## 3. FRONTEND — Next.js

### Pages to create:

#### /dashboard/business/expenses
- List all expense reports for the tenant
- Show: Report Number, Employee Name, Date, Status (badge), Total Amount, Actions
- Status badges: DRAFT (grey), SUBMITTED (blue)
- Button: "New Expense Retirement"
- Finance role sees all reports; Employee role sees only their own

#### /dashboard/business/expenses/new
- Two-section layout:

**Section 1 — Report Header**
Fields:
- Employee Name (read from auth — display only)
- Employee Code (read from user profile — display only)
- Employee Function (text input)
- Report Date (date picker, default today)

**Section 2 — Expense Lines**
A table where user adds lines one at a time.
Each line has:
- GL Account (text input — free text for M3, dropdown in M5)
- P/L Group (text input, optional)
- IO / Dimension (text input, optional)
- Cost Center (text input, optional)
- Location (text input, optional)
- Invoice Date (date picker, optional)
- Invoice No. (text input, optional)
- Description (text input, required)
- Amount NGN (number input, required)

Below the table: running total displayed as "GRAND TOTAL: ₦ X,XXX,XXX.XX"

Buttons:
- "Add Line" — adds a blank row
- "Remove" on each row — deletes that line
- "Save Draft" — saves without submitting
- "Submit for Approval" — submits (confirms with a dialog: "Once submitted, this report cannot be edited. Proceed?")

#### /dashboard/business/expenses/{report_id}
- Read-only view of a submitted report
- Show all header fields and lines in a clean table
- Show status badge and submitted timestamp
- Match the layout of the Red Bull Excel form as closely as possible in spirit (clean table, totals at bottom, signature section placeholder showing "Pending Line Manager Approval")

---

## 4. NAVIGATION

Add "Expenses" to the business dashboard sidebar, linking to /dashboard/business/expenses.

---

## PATTERNS TO FOLLOW:
- Follow the exact same auth patterns from Milestone 2
- Use existing ShadCN components (Table, Button, Badge, Input, Dialog)
- All monetary amounts: store as NUMERIC, display with ₦ prefix and comma formatting
- Dates: store as DATE, display as DD/MM/YYYY
- Error states: show toast notifications for API errors
- Loading states: show skeletons on list pages

---

## AFTER BUILDING:
1. Run the Alembic migration
2. Test: create a report, add lines, submit it, view it in the list
3. Commit with message: "feat: Milestone 3 - Business expense retirement submission"
4. Push to GitHub (oladunmoyeadeniyi/ziva-bi, branch main)
5. Confirm push succeeded

Report back when done or if you hit blockers.