Bug: The /dashboard/business/expenses/new page shows "Cannot reach 
backend server" error banner on page load, even when the backend is 
running and healthy. The banner never clears.

Fix:
1. Find what API call is being made on page load in the new expense page
2. The error banner should only show when the user actually clicks 
   "Save Draft" or "Submit for Approval" and the call fails
3. Remove any auto-fetch on page load that triggers this banner
4. Test locally: open the page, banner should not appear. Fill form, click Save Draft, it should save successfully.
5. Don't allow draft to be created once there is an error.