# CC Brief — Debug PATCH 422 on Dimension Value Update

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. List every file changed in your completion summary

---

## PROBLEM

Frontend sends: `{"name":"Admin General","description":null,"is_active":true}`
Backend returns: 422 Unprocessable Content

The date fields are NOT in the payload — so the issue is elsewhere.
Need to see the exact FastAPI validation error.

---

## FIX

**File:** `backend/app/routers/config.py`

Find the PATCH endpoint for `/dimensions/{dimension_id}/values/{value_id}`.

Add `Request` to FastAPI imports at the top of the file:
```python
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
```

Add `request: Request` as a parameter to the endpoint function.

Add this as the very first line inside the function body:
```python
print("PATCH value body:", await request.json())
```

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`debug: print PATCH dimension value body to find 422 cause`
