Four fixes needed after M7 testing:

FIX 1 — Duplicate expense from auto-save + manual save
Auto-save is creating a new report instead of updating 
the existing one when "Save Draft" is clicked.
Fix:
- On the new expense page, auto-save should create the 
  report once and store the report ID in state
- All subsequent saves (auto or manual) must PATCH the 
  existing report using that stored ID
- "Save Draft" button must check if a report ID already 
  exists in state — if yes, PATCH; if no, POST
- Test: create new expense, wait for auto-save, click 
  "Save Draft" — only ONE report should appear in the list

FIX 2 — Hide P/L Group when category mode is active
When gl_coding_mode is 'finance' or 'category_mapped':
- Hide the P/L Group field on expense lines entirely
- P/L Group is only relevant in 'employee' mode where 
  the employee is doing their own GL coding
- In category_mapped mode, P/L Group can be derived 
  from the GL account suggestion — no need for employee 
  to fill it

FIX 3 — Duplicate Team tab in sidebar
The "Team" link appears twice in the Settings sidebar.
Remove the duplicate. Only one "Team" link should appear.

FIX 4 — Tenant Admin account is config-only
The Tenant Admin role should be purely for configuration.
Enforce these rules:
- Tenant Admin users should NOT appear in approver 
  selection dropdowns on expense submission
- Tenant Admin users should NOT be able to submit 
  expense reports (hide the "+ New Expense Retirement" 
  button and block the API if they try)
- Tenant Admin dashboard should show only config modules:
  Approval Matrix, Expense Config, Master Data, Team
  — not operational modules like Expenses and Approvals
- If a user has BOTH Tenant Admin AND another role 
  (e.g. Finance Manager), treat them as that other role 
  for operational purposes — only show admin UI if they 
  are EXCLUSIVELY Tenant Admin

Test all four fixes locally before committing.
Commit: "fix: M7 bugs - duplicate save, PL group, 
team tab, tenant admin config-only"
Push to GitHub.