Two bugs to fix:

1. CORS ERROR
The backend is blocking requests from http://localhost:3000.
Error: "No 'Access-Control-Allow-Origin' header is present"
Fix: Add http://localhost:3000 to the ALLOWED_ORIGINS in the CORS 
configuration in main.py

2. LINES ENDPOINT 404
After saving a draft report, the frontend tries to POST lines to:
/api/expenses/reports/{report_id}/lines
This is returning 404. Check that this route is correctly registered 
under the /api/expenses prefix in main.py and that it matches exactly.

Fix both, test locally: create report, add lines, save draft, submit.
Confirm it works before committing.