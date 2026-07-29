Two fixes needed:

FIX 1 — Add Supabase credentials to .env
Add these lines to backend/.env:
SUPABASE_URL=https://qoshtcbdrudbxwrxlfgx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvc2h0Y2JkcnVkYnh3cnhsZmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3MTE3NiwiZXhwIjoyMDk0OTQ3MTc2fQ.GE_iuKNMRKvUb9QK6LgSNqznHmKpF6uD57uhTHesZ4M
SUPABASE_BUCKET=documents

Then restart the backend and confirm file upload works.

FIX 2 — Auto-save on expense form
Current behaviour: user must click "Save Draft" before 
document attachment buttons appear.
Required behaviour: auto-save in the background.

Implement auto-save on /dashboard/business/expenses/new 
and /dashboard/business/expenses/{id}/edit:

- When the user fills in the report date AND adds at least 
  one line with a description and amount, auto-save the 
  report in the background
- Auto-save triggers:
  - When user finishes typing in any field (onBlur)
  - When a line is added or removed
- Show a subtle save indicator top-right of the form:
  - Saving... (grey, while in progress)
  - Saved ✓ (green, on success)
  - Not saved (red, on error)
- Do NOT show a toast or redirect on auto-save
- Do NOT disable the form during auto-save
- The "Save Draft" button can remain for manual save
- Once the report has been auto-saved (has an ID), 
  show document attachment buttons immediately on 
  each line without requiring page reload or navigation
- For new reports: first auto-save creates the report 
  and gets back the report_id, subsequent auto-saves 
  use PATCH to update
- For edit page: already has report_id, auto-save 
  uses PATCH directly

Test:
1. Open new expense form
2. Fill header fields and add one line
3. Confirm "Saved ✓" appears without clicking anything
4. Confirm attachment button appears on the line
5. Attach a file — confirm it uploads successfully
6. Confirm file appears in the list