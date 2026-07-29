Two fixes needed for the expense module:

1. DELETE DRAFT
Add a Delete button on the expense list for DRAFT reports only.
- Backend: DELETE /api/expenses/reports/{report_id} 
  Only allowed if status = DRAFT. Returns 400 if SUBMITTED.
- Frontend: Add "Delete" action on list page for DRAFT rows only.
  Show confirm dialog: "Delete this draft? This cannot be undone."

2. EDIT DRAFT
When a user clicks "View" on a DRAFT report, it should open in 
edit mode, not read-only mode.
- The edit page should be the same form as /new but pre-populated 
  with existing header fields and lines
- User can add lines, remove lines, edit header fields
- "Save Draft" updates the existing report
- "Submit for Approval" submits it
- Route: /dashboard/business/expenses/{report_id}/edit
- The list page "View" link for DRAFT reports should go to the 
  edit route, not the read-only view

Test locally before committing.