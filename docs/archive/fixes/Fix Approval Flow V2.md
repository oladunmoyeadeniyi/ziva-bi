Two fixes plus one new feature for the approval workflow.

FIX 1 — Sidebar pending badge shows wrong count
The red badge on "Approvals" in the sidebar is not reflecting 
the correct number of reports pending the current user's action.
Fix:
- The badge should fetch count from GET /api/approvals/queue
- Count only reports where current user is the active approver 
  at the current approval level and status is PENDING
- If count is 0, hide the badge entirely
- Refresh the count every time the user navigates or approves/rejects

FIX 2 — Rejection should resume from rejected level
Current behaviour: any rejection sends report back to Level 1.
Correct behaviour:
- Track which level rejected the report
- When requestor resubmits, skip all levels below the rejection 
  level and resume from the exact level that rejected it
- Example: Level 2 rejects → resubmit goes straight to Level 2 
  approver, Level 1 is shown as already approved (keep original 
  approval record intact)
- Store rejected_at_level (INTEGER) on expense_reports table
- On resubmit: recreate only the approval records from 
  rejected_at_level onwards, preserve approved levels below

NEW FEATURE — Refer Back action
Add a third action for approvers alongside Approve and Reject.

Backend:
POST /api/approvals/{approval_id}/refer-back
Body: { target_type: "approver" | "requestor", 
        target_level: INTEGER (if target_type is approver),
        comment: STRING (required) }
- Sets current approval status = REFERRED_BACK
- If target_type = "requestor":
  - Sets report status = REFERRED_TO_REQUESTOR
  - Requestor sees it like a soft rejection with a note
  - When requestor resubmits, it goes back to the referring 
    approver directly (not Level 1)
- If target_type = "approver":
  - Activates the target level approver to review
  - Target approver sees it in their queue with the referring 
    approver's comment
  - Target approver can: Approve (sends back up to referring 
    approver) or Reject (sends back to requestor as DRAFT)
  - When target approver approves, it returns to the referring 
    approver's queue to continue their review

Add REFERRED_BACK and REFERRED_TO_REQUESTOR to status enums.

Frontend:
- Add "Refer Back" button (amber/orange) alongside Approve 
  and Reject on the approval action panel
- Clicking opens a modal:
  - Radio: "Refer to lower approver" | "Refer to requestor"
  - If lower approver: dropdown to select which level (only 
    levels below current)
  - Comment field (required)
  - Confirm button
- Update approval chain display to show REFERRED_BACK status 
  in amber
- Update expense status badges to include REFERRED_BACK 
  and REFERRED_TO_REQUESTOR

Update status badges colours:
- DRAFT — grey
- PENDING_APPROVAL — yellow
- APPROVED — green  
- REJECTED — red
- REFERRED_BACK — amber/orange
- REFERRED_TO_REQUESTOR — amber/orange

Run Alembic migration for any new columns.
Test full flow locally:
1. Submit report
2. Level 1 approves
3. Level 2 refers back to Level 1 with comment
4. Level 1 reviews and approves back up to Level 2
5. Level 2 approves
6. Level 3 refers back to requestor with comment
7. Requestor resubmits, goes straight to Level 3
8. Level 3 approves — report fully APPROVED
9. Verify badge count updates correctly throughout

Commit: "feat: refer back action, smart rejection resume, 
badge count fix"
Push to GitHub.