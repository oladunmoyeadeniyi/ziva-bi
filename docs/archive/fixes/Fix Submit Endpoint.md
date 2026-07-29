Bug: Expenses are staying in SUBMITTED status instead of moving 
to PENDING_APPROVAL after the M4/M5 changes.

The old POST /api/expenses/reports/{report_id}/submit endpoint 
is still being called by the frontend instead of the new 
POST /api/approvals/reports/{report_id}/submit endpoint.

Fix:
1. Check the frontend expense edit page - find where "Submit 
   for Approval" calls the backend
2. Update it to call POST /api/approvals/reports/{report_id}/submit
   instead of POST /api/expenses/reports/{report_id}/submit
3. The new endpoint handles approver selection and routes through 
   the approval matrix
4. Test: submit an expense, confirm it moves to PENDING_APPROVAL 
   and appears in the approvals queue

Do not change anything else.