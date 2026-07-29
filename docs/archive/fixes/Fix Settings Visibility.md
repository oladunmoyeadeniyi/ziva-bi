Bug: The Settings link is not showing in the business sidebar.
It was built to show only for Tenant Admin role but is not visible.

Fix:
1. Check why Settings is hidden for the current user
2. For now, make Settings visible to ALL business users 
   (we will add role restrictions in a later milestone)
3. The Settings page is at /dashboard/business/settings/approval-matrix
4. Confirm the page loads and the approval matrix form works

Also fix this: The dashboard still says "Milestone 3 — Expense 
Retirement is now active." Update it to reflect Milestone 4 
is now active with Approvals.

Test locally and push.