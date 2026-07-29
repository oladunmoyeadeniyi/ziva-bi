# Fix: Dimension Values Batch Upload — Silent Failure

## Problem
On the Dimensions page (`/dashboard/business/settings/dimensions`), the "Upload"
button on any dimension (confirmed on "Real internal order") opens the file picker
correctly. When the user selects a valid Excel file (.xlsx) and confirms, the dialog
closes and the user is returned to the page — but nothing happens. No loading
indicator, no success message, no error message, no data populates. "View values"
shows empty. The upload silently fails with zero feedback.

## Root cause to investigate
1. The file input `onChange` handler may not be calling the upload API at all
2. OR the API call is firing but failing (auth error, wrong endpoint, bad payload)
   with no error surfaced to the user
3. OR the API call succeeds but the response is not being handled (no state refresh,
   no toast, no error display)

## What to fix

### 1. Wire up the upload correctly
Ensure the file input `onChange` handler:
- Reads the selected file
- Calls the correct backend endpoint (likely `POST /api/config/dimensions/{dimension_id}/values/upload`
  or similar — check existing routes)
- Sends the file as `multipart/form-data`
- Includes the auth token in the request header

### 2. Add proper feedback
After the upload API call:
- **Loading state**: show a spinner or disable the Upload button with "Uploading..."
  text while the request is in flight
- **Success**: show a toast/notification with import summary —
  e.g. "Imported 12 values, Skipped 0, Errors: 0"
- **Error**: show a clear error message — e.g. "Upload failed: Invalid file format"
  or the actual API error message. Do NOT use browser `alert()` — use the existing
  in-app toast/notification pattern.
- After success: refresh the dimension values list so newly uploaded values appear
  immediately without requiring a manual page reload

### 3. Backend: ensure upload endpoint exists and works
- Verify the upload endpoint exists and accepts `.xlsx` files
- It should parse the file using the same column structure as the download template:
  `Code *` | `Name *` | `Description`
- Return a JSON response with: `{ imported: N, skipped: N, errors: [] }`
- If the endpoint doesn't exist, create it

### 4. Template column alignment
The download template has columns: `Code *`, `Name *`, `Description`
Ensure the upload parser reads exactly these columns (asterisks are display-only,
strip them when reading headers).

## Files CC may modify
- The Dimensions page frontend component (likely under `frontend/app/dashboard/business/settings/dimensions/`)
- Any shared upload utility/hook if one exists
- Backend dimension routes file (likely `backend/app/routers/` — the file handling
  dimension config/values)
- Backend schemas if a new upload endpoint needs a new schema

CC must NOT modify any other files. CC must list every file changed in its
completion summary.

## Acceptance criteria
- User selects a valid .xlsx file → upload fires immediately
- Loading indicator shown during upload
- On success: toast shows import summary, values appear in "View values" list
- On error: clear in-app error message shown (no browser alert())
- Invalid file (wrong columns, wrong format) returns a clear error message
- Re-uploading does not duplicate existing values (upsert by Code, or skip duplicates)

## Watch items
- Do NOT change `config.py` database name — must stay `ziva_dev`
- Do NOT rewrite CORS in `main.py` — must keep `http://localhost:3000`
- Do NOT make unsolicited UI changes to any other page
