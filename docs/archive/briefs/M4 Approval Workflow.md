Milestone 4 — Approval Workflow

STANDING REQUIREMENTS (apply to every page):
- All pages must be fully mobile responsive
- Use Tailwind responsive classes (sm:, md:, lg:)
- Tables must scroll horizontally on mobile or collapse to card layout
- Buttons and touch targets minimum 44px height on mobile

---

CONTEXT:
- M3 is complete. Expense reports have status DRAFT | SUBMITTED.
- M4 adds the approval chain: SUBMITTED → PENDING_APPROVAL → 
  APPROVED | REJECTED
- Each tenant configures their own approval matrix (levels + roles)
- Employee selects specific approver(s) when submitting
- Rejection returns report to DRAFT with comment
- Email notification sent to employee on rejection

---

## 1. DATABASE — New migration

### approval_matrix
Stores each tenant's approval configuration.
- id (UUID, PK)
- tenant_id (UUID, FK → tenants, UNIQUE) 
- levels (INTEGER) — 1, 2, or 3
- level1_role (VARCHAR) — e.g. "line_manager"
- level2_role (VARCHAR, nullable)
- level3_role (VARCHAR, nullable)
- amount_threshold_l2 (NUMERIC 15,2, nullable) — if set, level 2 
  only triggered when report total exceeds this amount
- amount_threshold_l3 (NUMERIC 15,2, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### expense_approvals
Stores each approval action on a report.
- id (UUID, PK)
- report_id (UUID, FK → expense_reports)
- tenant_id (UUID, FK → tenants)
- level (INTEGER) — 1, 2, or 3
- approver_id (UUID, FK → users) — selected by employee
- status (VARCHAR) — PENDING | APPROVED | REJECTED
- comment (TEXT, nullable)
- actioned_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)

### Update expense_reports table:
Add columns:
- current_approval_level (INTEGER, nullable)
- rejection_comment (TEXT, nullable)

Update status enum to include:
DRAFT | SUBMITTED | PENDING_APPROVAL | APPROVED | REJECTED

---

## 2. BACKEND

### Approval Matrix Setup
POST /api/approvals/matrix
- Tenant Admin only
- Create or update tenant's approval matrix
- Body: { levels, level1_role, level2_role, level3_role, 
  amount_threshold_l2, amount_threshold_l3 }

GET /api/approvals/matrix
- Get current tenant's approval matrix

### Approval Workflow
POST /api/approvals/reports/{report_id}/submit
- Replaces the old /submit endpoint
- Employee selects approvers: { level1_approver_id, 
  level2_approver_id (if applicable), level3_approver_id 
  (if applicable) }
- Validates approver IDs belong to same tenant
- Creates expense_approval records for each level (status=PENDING 
  for level 1, rest created but only activated in sequence)
- Sets report status = PENDING_APPROVAL, 
  current_approval_level = 1

GET /api/approvals/queue
- Returns all reports pending the current user's approval
- Filter: expense_approvals where approver_id = current user 
  AND status = PENDING AND report's current_approval_level = 
  this approval's level

POST /api/approvals/{approval_id}/approve
- Approver approves
- Sets this approval status = APPROVED, actioned_at = now()
- Check if more levels exist:
  - If yes: increment report current_approval_level, 
    activate next level approval
  - If no more levels: set report status = APPROVED
- Returns updated report

POST /api/approvals/{approval_id}/reject
- Body: { comment } — required
- Sets approval status = REJECTED, comment saved
- Sets report status = REJECTED, rejection_comment = comment
- Resets report to DRAFT so employee can fix and resubmit
- Sends rejection email to report employee (see email section)
- Returns updated report

### Email Notification
Send email to employee when their report is rejected.
Use Python's smtplib or fastapi-mail.
For M4, use a simple SMTP config via environment variables:
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, 
  SMTP_FROM_EMAIL
If env vars not set, log the email to console instead 
(so it works locally without email config).

Email content:
Subject: "Expense Report {report_number} Rejected"
Body: 
  "Your expense report {report_number} dated {report_date} 
   for ₦{total_amount} has been rejected.
   
   Reason: {rejection_comment}
   
   Please log in to Ziva BI to review and resubmit."

---

## 3. FRONTEND

### Tenant Approval Matrix Setup
Page: /dashboard/business/settings/approval-matrix
- Only visible to Tenant Admin role
- Form to configure:
  - Number of approval levels (1, 2, 3) — radio buttons
  - Level 1 approver role label (text input, e.g. "Line Manager")
  - Level 2 approver role label (nullable)
  - Level 3 approver role label (nullable)
  - Amount threshold for L2 (optional)
  - Amount threshold for L3 (optional)
- Save button
- Add "Settings" to business sidebar (visible to Tenant Admin only)

### Update Expense Submission Flow
Update /dashboard/business/expenses/{report_id}/edit

When user clicks "Submit for Approval":
1. First check if tenant has approval matrix configured
   - If not: show message "Your company has not configured an 
     approval matrix. Contact your administrator."
2. If matrix exists, show approver selection modal:
   - Dropdown to select Level 1 approver (labelled with 
     tenant's configured role name e.g. "Line Manager")
   - Dropdown to select Level 2 approver (if configured)
   - Dropdown to select Level 3 approver (if configured)
   - Dropdowns show all users in the same tenant
   - Confirm button
3. On confirm: call new submit endpoint with approver selections

### Update Expense Status Badges
Add new badge styles:
- PENDING_APPROVAL — yellow/amber
- APPROVED — green
- REJECTED — red

### Approver Queue Page
Page: /dashboard/business/approvals
- Shows all reports pending the current user's approval
- Columns: Report No., Employee Name, Date, Total Amount, 
  Level, Actions
- "Review" button opens the report detail view
- On detail view, add approve/reject panel at bottom:
  - "Approve" button (green)
  - "Reject" button (red) — opens comment input before confirming
  - Comment field (required for rejection, optional for approval)
- Add "Approvals" to business sidebar 
  (show badge count of pending approvals)

### Update Expense Detail View
For REJECTED reports:
- Show red banner: "This report was rejected: {rejection_comment}"
- Show "Edit & Resubmit" button which takes to edit page

For APPROVED reports:
- Show green banner: "This report has been approved"

---

## 4. NAVIGATION UPDATES
- Add "Approvals" to sidebar with pending count badge
- Add "Settings" to sidebar (Tenant Admin only)

---

## AFTER BUILDING:
1. Run Alembic migration
2. Seed approval matrix for test tenant:
   3 levels, labels: "Line Manager", "Finance Manager", "GM"
   No amount thresholds
3. Test full flow locally:
   - Configure matrix as Tenant Admin
   - Submit report, select approvers
   - Login as approver, approve at level 1
   - Confirm moves to level 2
   - Reject at level 2 with comment
   - Confirm employee report returns to DRAFT
   - Confirm rejection email logged to console
4. Commit: "feat: Milestone 4 - Approval workflow"
5. Push to GitHub
6. Confirm push succeeded