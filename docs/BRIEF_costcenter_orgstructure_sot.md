Read docs/ZIVA_BI_ROADMAP.md, docs/MASTER_CONTEXT.md, and docs/TEST_TENANT.md first, then follow this brief.

# BRIEF — Cost Centers: Make org_structure the Single Source of Truth (Retire dimension_values for cost_center)

## Context

Investigation during shadow setup found a structural mismatch: cost centers actually live in `org_structure` nodes (`node_type='COST_CENTER'`) — confirmed working, 15 real Red Bull cost centers cloned correctly (Administration, Finance N22341FI, HR, IT, Legal, Marketing, Operations, Media Network, Culture, Field Marketing x2, Sports, Sales Off Premise, Sales On Premise). But several things built across earlier briefs (the employee bulk-upload Cost Center Code dropdown, the `/api/hr/cost-centers/options` endpoint, the bulk-upload row validation) read from `dimension_values` for a `cost_center` dimension instead — which has 0 rows on this tenant and is structurally the wrong table.

Adeniyi's decision: **org_structure IS the cost center source of truth, permanently.** `dimension_values` for cost_center type is to be retired/unused going forward. Every place that reads, validates, or displays cost centers must point at `org_structure`, not `dimension_values`. This is the same "one authoritative source per fact" principle already applied to currency config — apply it here too.

## STEP 0 — Map the full blast radius before changing anything

This is critical — multiple things were built across at least 3 prior briefs assuming `dimension_values` was the cost center source. Find every single one before touching code:

1. **Find every backend endpoint that currently queries `dimension_values` filtered to a cost-center-type dimension.** This includes at minimum (confirm exact locations, there may be more):
   - `GET /api/hr/cost-centers/options` (built in the employee cost-center brief)
   - The bulk employee template generator's Cost Center Code column dropdown source (`download_employee_template` in `hr.py`)
   - The bulk employee upload row validator (`upload_employees` in `hr.py`) — confirm exactly how it currently validates/resolves a cost center code on each row
   - Any Add/Edit/Invite/Transfer employee modal's cost-center field data source on the frontend (check what endpoint each currently calls)
   - `CostCenterConfig` and `set_cost_center_head` / `transfer_employee` — confirm exactly what these currently validate the cost center ID against (per the earlier brief, these were "tightened to verify the DimValue belongs to the cost_center dimension" — this logic needs to change to validate against org_structure nodes instead)
2. **Find the actual `org_structure` model and the cost-center-relevant fields on it** (node_type, code, name, parent_id, id). Confirm the exact field names and how `GET /api/config/dimensions/{id}/inline-values` (found during shadow setup) currently queries it, since that endpoint already works correctly — reuse its query pattern rather than inventing a new one.
3. **Confirm whether `CostCenterConfig.cost_center_id` (the FK used for head-of-cost-center assignment) currently points at a `dimension_values.id` or could/should point at an `org_structure.id` instead.** This is likely the most disruptive change — report exactly what type this FK is today and what changing it would require (migration, data backfill, or if the tenant has zero CostCenterConfig rows today, a clean swap is possible with no backfill needed — check and report which is true).
4. Report the full list of every affected file/endpoint/frontend component before writing any fix code.

## Part A — Backend: redirect cost-center reads to org_structure

- Update `GET /api/hr/cost-centers/options` (or replace it) to query `org_structure` nodes (`node_type='COST_CENTER'`) for the tenant instead of `dimension_values`. Return `id`, `code`, `name` — same response shape as before so frontend consumers don't need to change their parsing, only their understanding of what `id` now refers to.
- Update `download_employee_template`'s Cost Center Code column dropdown source to pull from `org_structure` instead of `dimension_values`.
- Update `upload_employees`' row-level cost center resolution to look up the entered code against `org_structure` nodes instead of `dimension_values`. Keep the existing reject-on-unrecognized-code row error behavior, just pointed at the correct table.
- Update `CostCenterConfig.cost_center_id`, `transfer_employee`, and `set_cost_center_head` validation to check against `org_structure` instead of `dimension_values`. If this requires a model/FK type change, handle it per STEP 0 point 3's findings (clean swap if no existing data, migration + backfill if data exists — report which path was taken).

## Part B — Frontend: confirm no changes needed, or make them

- The Add/Edit/Invite/Transfer modals' cost-center dropdowns already call `GET /api/hr/cost-centers/options` (per the original employee brief) — if Part A keeps this endpoint's URL and response shape the same, frontend should need NO changes. Confirm this is true by re-testing the dropdowns after the backend fix, rather than assuming.
- If the response shape must change for any reason, update the frontend accordingly and flag exactly why in the completion summary.

## Part C — Clean up: is dimension_values cost_center data now fully unused?

- Confirm there is no remaining code path reading `dimension_values` for cost-center purposes anywhere in the codebase after Parts A and B (grep for it, report what's left if anything, explain why if something legitimately still needs to reference it).
- Do NOT delete the `cost_center` `TenantDimension`/`dimension_values` rows themselves in this brief — just stop reading from them. Deletion of unused data is a separate decision Adeniyi can make later; this brief is about correctness of the live code path, not data cleanup.

## Files CC is allowed to modify

- `backend/app/routers/hr.py` (cost-center options endpoint, template generator, upload validator, transfer/head-assignment validation)
- `backend/app/models/master_data.py` — ONLY if `CostCenterConfig.cost_center_id`'s FK target needs to change (per STEP 0 point 3) — report before making a breaking schema change if any existing data would be affected
- New Alembic migration if a schema change is needed
- `frontend/src/app/dashboard/business/settings/employees/page.tsx` — only if Part B finds a genuine need

## Do NOT touch

- `org_structure` model/endpoints themselves (already correct, do not refactor)
- Any other dimension type (material, statistical orders, customer_order, trading_partner) — this brief is scoped to cost_center only
- GL/posting engine
- Anything outside the list above without flagging it first

## Acceptance tests (state pass/fail for each)

1. STEP 0 full blast-radius list reported before any code change.
2. `GET /api/hr/cost-centers/options` now returns the 15 real org_structure cost centers (Administration, Finance, HR, IT, Legal, Marketing, Operations, Media Network, Culture, Field Marketing x2, Sports, Sales Off Premise, Sales On Premise) on the shadow tenant.
3. Downloaded employee bulk template's Cost Center Code column dropdown now lists these same 15 real codes (verified by re-downloading and inspecting the actual file, not just describing the code).
4. Bulk upload: a row with a valid org_structure cost center code (e.g. `N22341FI` for Finance) resolves correctly and assigns the right cost center — verified end to end on the shadow tenant.
5. Bulk upload: a row with an invalid/unrecognized code still produces a clear row error.
6. Add Employee / Invite / Transfer modal dropdowns all show the same 15 real cost centers, confirmed by re-testing in the running app (or detailed enough report that Adeniyi can confirm via screenshot).
7. Set-cost-center-head / CostCenterConfig validated against org_structure, confirmed working for at least one test assignment.
8. No remaining live code path reads `dimension_values` for cost-center purposes (Part C grep confirms this, or explains any legitimate exception).
9. All work performed against test shadow `e8a2fd8c-5466-4618-bb37-97681a8bfb05` only — never live Red Bull. Confirm this UUID against `docs/TEST_TENANT.md` fresh, do not rely on memory of it.
10. `alembic current` confirmed equal to head if any migration was written.
11. CORS/DB config unchanged — confirm explicitly.

## Completion summary must include

- STEP 0 findings verbatim — the full list of every affected location
- Exact list of every file changed
- Pass/fail for every acceptance test above
- Whether `CostCenterConfig.cost_center_id`'s FK type needed to change, and how that was handled (clean swap vs. migration+backfill)
- Confirmation of whether any frontend changes were needed beyond the backend fix
