Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# BRIEF — Employee Cost-Center Wiring + Employee List Upgrade

## Context

Adeniyi's exact feedback after a live walkthrough:

> Since we have the organisation structure set up under 'organisation', we need to ensure the cost centres in 'organisation' are properly wired up here [employees]. There should not be the ability to create a new cost centre outside the ones in the organisation structure.
> In the bulk employee template, I believe it is best that the cost centre column have a dropdown option of the cost centre codes from the organisation. It shouldn't be a free text input.
> Likewise, the cost centre input field in the 'Send self-onboarding invite' form.
> Additionally, I think the batch-up template should also include a column for head of cost centre with just a dropdown option to indicate the head, and if it's blank, then it means not head.
> Also, I don't think it is necessary for the cost centre tab under people in the left sidebar to be a standalone... unless you believe it is needed with good reason.
> Also note that similar to CoA, the bulk-uploaded employee should be deletable, replaceable with updated master data or updatable with additional data and filterable and sortable with different criteria.

## Decisions already locked (do not re-litigate)

1. **Cost Centers page stays standalone** (for head-overview/assignment) **AND** a head-of-cost-center column is ALSO added to the bulk employee template as a convenience. Both, not either/or.
2. **Bulk template cost-center dropdown must have server-side validation on upload** — not just an Excel convenience dropdown with no enforcement. (The current upload handler already rejects unrecognized cost center codes with a row error — keep and confirm this behavior, don't weaken it.)
3. **Head-of-cost-center two-pass resolution**: create/update all employees in pass 1 (as today), then apply head flags in pass 2 — same pattern the upload handler already uses for Line Manager Email resolution. If an employee row in the same file is marked head before they exist yet, resolve it in pass 2 once they're created. If the head reference can't be resolved at all (typo'd email, not in file or DB), log a row error — do not silently drop it.

## STEP 0 — Investigate first, report findings before changing anything

Read the actual code/data and report back in your completion summary before writing any new code:

1. **Confirm the Organisation/Dimension structure for Cost Center.** `backend/app/models/master_data.py` has `TenantDimension` and `DimensionValue`. Find the actual `TenantDimension` row(s) that represent "Cost Center" for a tenant (likely a dimension with a specific `dimension_type` or `code` flag, e.g. `is_cost_center` or similar — check the model). Confirm: how does the system currently know which `TenantDimension` IS the cost center dimension, as opposed to any other dimension (e.g. Intercompany, Region)? Report the exact field/flag.
2. **Confirm the `/api/config/dimensions` endpoint** (called by the frontend today) — does it return all dimensions for the tenant, or can it filter to just one type? Check `backend/app/routers/` for the config/dimensions router.
3. **Confirm the Chart of Accounts (CoA) page's filter/sort/delete/replace pattern** — find the actual CoA frontend file (likely under `frontend/src/app/dashboard/business/settings/` or `setup/chart-of-accounts/`) and report: how does it implement delete, replace-via-reupload, update, filter by column, and sort by column? This pattern must be matched on the Employee List tab, not reinvented.
4. **Confirm `CostCenterConfig` model usage** — `backend/app/models/master_data.py` has `CostCenterConfig` with `head_employee_id` / `head_user_id`, already used by `GET/PUT /api/hr/cost-centers`. Confirm whether the upload's "head of cost center" column should write into this exact table (it should, unless STEP 0 finds a reason not to — report if so).
5. Report all findings before proceeding to implementation.

## Part A — Cost center becomes a real dropdown everywhere (not free text)

**Backend:**
- Add a `GET /api/hr/cost-centers/options` (or extend existing `GET /api/hr/cost-centers`) endpoint that returns ONLY the dimension values belonging to the confirmed Cost Center dimension (from STEP 0 finding #1) for the current tenant — `id`, `code`, `name`. This is the single source of truth every cost-center dropdown in this feature will call. Guard: `require_auth` + `_require_tenant`.
- Do NOT let any endpoint accept an arbitrary `DimensionValue.id` as a cost center without checking it belongs to the Cost Center dimension specifically (today's `transfer_employee` and `set_cost_center_head` just check `DimensionValue.tenant_id` — tighten this to also check dimension type, per STEP 0 finding #1).

**Frontend — replace these free-text/improvised fields with a real `<select>` sourced from the new endpoint:**
- Add Employee modal (`showAdd`) — currently has **no cost center field at all**. Add one.
- Invite modal (`showInvite`) — currently "Cost center ID" free text. Replace with dropdown.
- Transfer modal (`transferEmpId`) — currently "Cost center UUID" free text. Replace with dropdown.
- Employee list filter (`filterCostCenter`) — currently reconstructed by scanning loaded employees (hack). Replace with the real dropdown from the new endpoint, fetched once on page load alongside employees.

## Part B — Bulk template: cost center dropdown + head-of-cost-center column

**Backend (`download_employee_template`):**
- Add a new "Head of Cost Center (Y/N)" or similar boolean-style column to the template. Blank = not head (per Adeniyi's instruction).
- Use openpyxl data validation (`from openpyxl.worksheet.datavalidation import DataValidation`) to add an actual in-Excel dropdown list for the "Cost Center Code" column, sourced from the tenant's real cost center dimension values fetched in this endpoint. Do the same Y/N-or-blank style validation for the new head column if practical; if a full dropdown list is awkward for a boolean column, a typed instruction + validated blank/Y is acceptable — use judgment, but the Cost Center Code column dropdown is mandatory.
- Keep the existing "Instructions" sheet pattern — add a row describing the new column.

**Backend (`upload_employees`):**
- Parse the new head column.
- Keep existing pass-1 logic (create/update employees) unchanged in structure.
- Add a pass-2 step (alongside the existing line-manager-email pass-2 resolution) that, for any row with the head flag set, upserts a `CostCenterConfig` row (`head_employee_id` = the resolved employee for that row, `cost_center_id` = the row's resolved cost center). If a row has the head flag set but no cost center on that row, log a row error ("Cannot set head without a Cost Center Code"). If two rows in the same file both claim head for the same cost center, last-row-wins is acceptable — note this in the completion summary rather than over-engineering conflict resolution.
- Keep the existing reject-on-unrecognized-cost-center-code row error behavior exactly as is.

## Part C — Employee List: delete / replace / update / filter / sort, matching CoA pattern

Apply whatever pattern STEP 0 finding #3 reports from the CoA page, adapted to employees:
- **Delete**: the existing soft-delete (`DELETE /api/hr/employees/{id}` → deactivate) already exists and is wired to "Deactivate" in the row actions — confirm this satisfies "deletable" or whether Adeniyi's CoA pattern implies something more (hard delete option, bulk delete). If CoA supports bulk delete and employees currently only support bulk activate/deactivate, add bulk delete alongside, using the same confirm-modal pattern already in this file (`bulkAction`).
- **Replace via re-upload**: the existing `/employees/upload` already upserts by email (duplicate email = update). Confirm this matches CoA's "replace" semantics; if CoA's replace pattern works differently (e.g. explicit "replace all" vs. upsert), flag the difference rather than guessing, and implement to match CoA's actual UX.
- **Update**: add inline or modal-based edit of an employee's core fields beyond what `Code` and `Transfer` modals already cover (e.g. name, phone, preferred name) if CoA's row actions include a general "Edit" — match it.
- **Filter**: cost center filter already exists (Part A upgrades it to a real dropdown) — add filter by status (active/inactive) if CoA's filter bar has an equivalent and employees doesn't.
- **Sort**: add column-header sort (at minimum: Name, Code, Cost Center, Status) matching CoA's sort interaction (click header to toggle asc/desc, visual indicator).

## Part D — Cost Centers sidebar tab

No change — Adeniyi confirmed it stays standalone. Do not touch navigation for this.

## Files CC is allowed to modify

- `backend/app/routers/hr.py`
- `backend/app/schemas/hr.py` (if new fields/response shapes needed)
- `backend/app/models/master_data.py` — ONLY if STEP 0 reveals a missing flag/field needed to identify the Cost Center dimension (report and confirm with Adeniyi before altering if this requires a migration)
- `frontend/src/app/dashboard/business/settings/employees/page.tsx` (confirm exact path in STEP 0 if different)
- Any migration file needed for new/changed columns (e.g. if `CostCenterConfig` needs no change, say so explicitly)

## Do NOT touch

- Cost Centers standalone page/sidebar entry
- Line manager resolution logic (already correct, do not refactor)
- GL/posting engine, periods, approval matrix — unrelated to this brief
- Any file outside the list above without flagging it first

## Acceptance tests (state pass/fail for each)

1. STEP 0 findings reported in full before any code change.
2. Add Employee modal has a working cost-center dropdown; selecting a value and submitting creates the employee with the correct `cost_center_id`.
3. Invite modal cost-center field is a dropdown, not free text; submitting works end to end.
4. Transfer modal cost-center field is a dropdown, not free text; transfer works end to end.
5. Employee list cost-center filter is sourced from the real dimension endpoint, not reconstructed from loaded employees; filtering returns correct results.
6. Downloaded template has an in-Excel dropdown on the Cost Center Code column listing real tenant cost center codes.
7. Downloaded template has the new head-of-cost-center column, documented in the Instructions sheet.
8. Upload a file with: (a) a row marked head whose cost center exists and is valid → `CostCenterConfig` correctly upserted; (b) a row marked head with no cost center on that row → row error logged, employee still created/updated; (c) an unrecognized cost center code → existing reject behavior unchanged.
9. Upload a file where the head is a brand-new employee in the SAME file (two-pass resolution) → head correctly resolved after both employees are created.
10. Employee List delete/replace/update/filter/sort all confirmed working and matching CoA's actual pattern (not a guessed pattern) — CC must explicitly state in the completion summary how each maps to what CoA does.
11. No regression: existing single Add Employee, existing Transfer, existing Code Update, existing bulk activate/deactivate, existing search all still work.
12. All real-write tests run against test tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` ("Ziva BI — Test Tenant") — NEVER live Red Bull.
13. `alembic current` confirmed equal to head if any migration was written, before declaring done.
14. CORS (`http://localhost:3000` hardcoded) and DB name (`ziva_dev`) in `config.py` unchanged — confirm explicitly.

## Completion summary must include

- STEP 0 findings (verbatim, not paraphrased away)
- Exact list of every file changed
- Pass/fail for every acceptance test above
- Any place where CoA's actual pattern differed from what this brief assumed, and how you resolved it
