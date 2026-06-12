M4 Cleanup — Refer Back Enhancements + Audit Trail

CONTEXT:
- Stack: Next.js 15 + FastAPI + PostgreSQL
- audit_logs table exists with columns: id, event_type, user_id, 
  tenant_id, ip_address, user_agent, log_metadata (JSONB), created_at
- All approval actions currently do NOT write to audit_logs — fix this

---

## 1. AUDIT TRAIL — Backend

Every approval action must write to audit_logs.
Use log_metadata JSONB to store full detail.

Write an audit log entry for each of these events:

EXPENSE_SUBMITTED
- log_metadata: { report_id, report_number, total_amount, 
  employee_id, approver_ids }

EXPENSE_APPROVED (per level)
- log_metadata: { report_id, report_number, level, 
  approver_id, comment, total_amount }

EXPENSE_REJECTED
- log_metadata: { report_id, report_number, level, 
  approver_id, comment, total_amount, rejected_at_level }

EXPENSE_REFERRED_BACK
- log_metadata: { report_id, report_number, level, 
  referring_approver_id, target_type, target_levels, 
  comment, visible_to_requestor, total_amount }

EXPENSE_RESUBMITTED
- log_metadata: { report_id, report_number, total_amount, 
  resumed_from_level }

Write audit entries in the approve, reject, refer-back, 
and submit endpoints in routers/approvals.py.

---

## 2. REFER BACK ENHANCEMENTS — Backend

### 2a. Multi-level refer back
Update POST /api/approvals/{approval_id}/refer-back
Change target_level (INTEGER) to target_levels (LIST of INTEGER)
So a Level 3 approver can refer back to both Level 1 and Level 2 
simultaneously if needed.
Create a referred approval record for each target level.

### 2b. Requestor visibility toggle
Add visible_to_requestor (BOOLEAN, default false) to the 
refer-back request body.
- If true: requestor can see the referral comment in their 
  expense detail view
- If false: referral is internal only, requestor sees 
  "Pending internal review" instead of the actual comment

Add visible_to_requestor column to expense_approvals table 
(BOOLEAN, default false).

### 2c. Referred approver response
When a lower approver receives a referred approval:
- They see the referral comment from the higher approver
- They have a response text field before they approve back up
- Add response_comment (TEXT, nullable) to expense_approvals table
- When referred approver approves back up, their response_comment 
  is saved and visible to the referring approver

Update POST /api/approvals/{approval_id}/approve to accept 
optional { response_comment } in body.

---

## 3. FRONTEND UPDATES

### 3a. Refer Back modal updates
- Change "Select level" single dropdown to multi-select checkboxes
  showing all levels below current
- Add toggle: "Visible to requestor" (default OFF)
  with label: "Allow requestor to see this query"
- Keep comment field (required)

### 3b. Referred approver view
When an approver opens a report that was referred to them:
- Show a highlighted panel: "Referred to you by [Name] - Level X"
- Show the referral comment
- Add a "Response" text field above the Approve button
- Label: "Your response (will be sent back to referring approver)"
- Response is optional for approval, but show it prominently

### 3c. Requestor view of referrals
In expense detail view for the requestor:
- If visible_to_requestor = true: show referral comment in 
  amber panel "Query from approver: {comment}"
- If visible_to_requestor = false: show "Pending internal review"
  in a neutral grey panel

### 3d. Audit trail viewer
Page: /dashboard/business/expenses/{report_id}/audit
- Show full chronological timeline of all events for this report
- Each entry shows: timestamp, event type, who did it, comment/detail
- Visual timeline style (vertical line with dots)
- Event type labels:
  Submitted | Approved (L1) | Approved (L2) | Approved (L3) | 
  Rejected | Referred Back | Resubmitted
- Add "View Audit Trail" link on expense detail page
- Only visible to Finance role and Tenant Admin

---

## 4. NAVIGATION
No new nav items needed.

---

## AFTER BUILDING:
1. Run Alembic migration for new columns:
   - expense_approvals.visible_to_requestor (BOOLEAN)
   - expense_approvals.response_comment (TEXT)
2. Test full flow:
   - Submit expense
   - L1 approves
   - L2 refers back to L1 with visible_to_requestor = true
   - Check requestor sees the query
   - L1 responds and approves back up
   - L2 sees response, approves
   - L3 approves
   - View audit trail — all 6 events should appear
3. Commit: "feat: refer back enhancements and audit trail"
4. Push to GitHub
4b. Test email notifications:
   - Submit expense — check approver gets email (or console log)
   - Approve fully — check requestor gets approval email
   - Refer back with visible = true — check requestor gets query email
   - Refer back to lower approver — check lower approver gets email
   
## 5. SEPARATION OF DUTIES

Backend validation — enforce on submit:
- When POST /api/approvals/reports/{report_id}/submit is called,
  validate that none of the selected approver_ids match the 
  employee_id of the report
- If any approver is the same person as the requestor, return 
  400 error: "An expense approver cannot be the same person 
  as the requestor"
- Apply this check at every level

Frontend:
- When building the approver selection dropdowns, exclude the 
  currently logged-in user from the dropdown list entirely
- So the requestor cannot even select themselves accidentally

---

## 6. EXPENSE SNAPSHOT ON SUBMISSION

When an expense report is submitted, save a snapshot of the 
expense lines at that moment.

Add new table: expense_report_snapshots
- id (UUID, PK)
- report_id (UUID, FK → expense_reports)
- tenant_id (UUID, FK → tenants)
- snapshot_data (JSONB) — full copy of all lines + header 
  fields + total at time of submission
- submitted_at (TIMESTAMP)
- version (INTEGER) — increments on each resubmission (1, 2, 3...)
- created_at (TIMESTAMP)

Backend:
- On every submission (new or resubmission), write a snapshot 
  record before changing report status
- Store: report_number, employee_id, report_date, total_amount, 
  all expense lines with all fields, list of approver_ids

This means if an expense is rejected and the employee changes 
the lines before resubmitting, you have a full record of every 
version that was ever submitted.

Add snapshot version to audit log entries:
- Include snapshot_version in log_metadata for 
  EXPENSE_SUBMITTED and EXPENSE_RESUBMITTED events

Frontend:
- On the audit trail page, show snapshot version number 
  next to each submission event
- Add "View snapshot" link that shows the exact lines 
  that were submitted at that version

---

## 7. EMAIL NOTIFICATIONS — Full Coverage

Currently email only fires on rejection. Extend to cover:

APPROVER NOTIFICATION — when report enters their queue:
Subject: "Action Required: Expense Report {report_number} 
awaiting your approval"
Body: 
  "{employee_name} has submitted expense report {report_number} 
   dated {report_date} for ₦{total_amount} requiring your 
   approval as {role_label}.
   
   Please log in to Ziva BI to review and action."

APPROVER NOTIFICATION — when referred back to them:
Subject: "Referred to you: Expense Report {report_number}"
Body:
  "Expense report {report_number} has been referred to you 
   by {referring_approver_name} for review.
   
   Query: {referral_comment}
   
   Please log in to Ziva BI to respond."

REQUESTOR NOTIFICATION — when fully approved:
Subject: "Approved: Expense Report {report_number}"
Body:
  "Your expense report {report_number} dated {report_date} 
   for ₦{total_amount} has been fully approved.
   
   Please log in to Ziva BI to view the approved report."

REQUESTOR NOTIFICATION — when referred back with 
visible_to_requestor = true:
Subject: "Query on Expense Report {report_number}"
Body:
  "There is a query on your expense report {report_number}.
   
   Query: {referral_comment}
   
   Please log in to Ziva BI to view the details."

All emails: if SMTP not configured, log to console.
Reuse the existing SMTP config pattern from rejection emails.