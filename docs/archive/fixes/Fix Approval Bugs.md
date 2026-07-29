Three bugs to fix in the approval workflow:

BUG 1 — Approve button fails with "Failed to fetch"
The POST /api/approvals/{approval_id}/approve endpoint is 
failing from the frontend. Debug and fix. Check CORS, check 
the endpoint is correctly registered, check the approval_id 
being sent is correct. Test approve and reject both work.

BUG 2 — Resubmission should reuse original approvers
Current behaviour: when a rejected report is resubmitted, 
the employee is forced to select approvers again.
Correct behaviour:
- When resubmitting a rejected report, skip the approver 
  selection modal entirely
- Reuse the same approvers from the original submission
- Delete the old expense_approval records and recreate them 
  with the same approver_ids but reset to PENDING
- Only show approver selection for brand new submissions 
  (first time a report is ever submitted)
- How to detect resubmission: check if expense_approvals 
  records already exist for this report_id

BUG 3 — Rejected report visibility
Current behaviour: rejected report may not be visible to 
all relevant parties.
Correct behaviour:
- A REJECTED report must be visible to:
  1. The requestor (employee who created it)
  2. All approvers assigned to that report at any level
- On the approvals queue page, show REJECTED reports to 
  all assigned approvers so they have visibility
- Add a "Rejected" tab or filter on the approvals queue page
  alongside the existing pending queue

Test all three fixes locally before committing.
Commit: "fix: approval bugs - fetch error, resubmission flow, 
rejected visibility"
Push to GitHub.