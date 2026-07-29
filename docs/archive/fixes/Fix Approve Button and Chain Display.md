Two fixes needed:

FIX 1 — Approve button still failing
The approve button shows "Cannot reach the server" even though 
the backend is running fine.
Debug:
1. Open browser DevTools Network tab, click Approve, check 
   the exact URL being called and the response
2. The issue is likely the approval_id being passed is wrong 
   or undefined
3. Check how pendingApproval is being fetched and passed to 
   the approve/reject call
4. Fix so Approve and Reject buttons call the correct endpoint
   with the correct approval_id

FIX 2 — Approval chain display is repetitive
Current: shows 6 cards (appears to duplicate each level)
Correct: show exactly one card per configured approval level
- 3 levels = 3 cards in a clean horizontal row
- Each card shows: Level label, Approver name, Status 
  (Pending / Approved / Rejected), comment if rejected, 
  timestamp if actioned
- Use a progress-style layout: 
  Level 1 → Level 2 → Level 3
- Highlight the current active level
- Completed levels show green, rejected shows red, 
  pending shows grey

Test both fixes locally before committing.