I am testing locally only. Do not reference Render deployment in any 
instructions until I say I am ready.

Fix this bug first: When I try to save a draft or submit on 
/dashboard/business/expenses/new, I get "Failed to fetch".

Debug steps:
1. Check that the expenses router is registered in main.py with the 
   correct prefix /api/expenses
2. Check that NEXT_PUBLIC_API_URL in the frontend .env.local is pointing 
   to http://localhost:8000
3. Check that the POST /api/expenses/reports endpoint is actually running 
   — test it directly with curl or the FastAPI docs at 
   http://localhost:8000/docs
4. Fix whatever is causing the failed fetch and confirm it works locally.

After fixing, also note: dropdowns for GL Account, P/L Group, IO/Dimension, 
and Cost Center are planned for M5. Free text is correct for M3. No change 
needed there.

Report back with what the root cause was.