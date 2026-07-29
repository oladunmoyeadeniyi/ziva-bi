CORS is broken again after the latest changes.
Error: requests from http://localhost:3000 to http://localhost:8000 
are being blocked with "No Access-Control-Allow-Origin header".

This was fixed before by hardcoding localhost:3000 in the CORS 
origins list in main.py. That fix has been lost or overwritten.

Fix:
1. Open backend/app/main.py
2. Find the CORS middleware configuration
3. Make sure http://localhost:3000 is hardcoded in the origins 
   list and NOT dependent on the ALLOWED_ORIGINS env var alone
4. Pattern that worked before:
   _cors_origins = list(dict.fromkeys(
     ["http://localhost:3000", "http://localhost:3001"] 
     + settings.allowed_origins
   ))
5. Save, restart backend, confirm CORS errors are gone

Do not change anything else. Just fix CORS.