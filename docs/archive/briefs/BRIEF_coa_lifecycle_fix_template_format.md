Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# BRIEF — Fix-Up: CoA Lifecycle Gating, Template Format Standard, Cost Center Dropdown

## Context

Inspection of the actual generated files (not the completion summary) found three problems from the last two briefs that must be corrected:

1. **CoA gating is backwards.** Previous brief deprecated "Replace All" entirely (returns 410 Gone) and made "Remap" available unconditionally. The correct behavior, confirmed by Adeniyi: **Replace All is only available while `lifecycle_status == "in_implementation"`. Remap is only available once `lifecycle_status == "live"`.** These are mutually exclusive by tenant state — never both available, never both unavailable. No grace window once live — Replace All becomes unavailable the moment status leaves `in_implementation`, permanently, regardless of whether any transactions exist yet on day 1 of going live.

2. **Employee bulk template — Cost Center Code column (H) has NO data validation/dropdown.** This was reported PASS in the last completion summary; it is not true on inspection of the actual downloaded file. Confirmed by directly opening `employee_template__1_.xlsx`: column H has zero `data_validations` entries. Only column K (Head of Cost Center Y/N) has one.

3. **Template format standard not applied — on both the employee template and the CoA remap template.** Both currently put example/instructional text inline in row 2 of the data sheet (e.g. Employees!A2 = "e.g. Adeniyi", Remap!A2 = "Must exactly match an active..."). This is wrong for two reasons: (a) it sits inside the data grid where a user typing real data on the natural next row will overwrite it silently, (b) per standing format rule, examples belong in a cell comment on the header, not typed into a data row.

**Standing rule going forward (apply to these two templates now, and to all future bulk templates):**
- Example/sample values go in a **cell comment** attached to the relevant header cell — never typed inline into a data row.
- The Instructions sheet must explicitly state which row real data starts on (e.g. "Enter your data starting at row 2").
- Where practical, also add a visual highlight/note on the data sheet itself indicating the data start row (e.g. cell fill on the data-start row's row-number area, or a short note cell — use judgment on what's clean, report what you chose).

## STEP 0 — Confirm current state before changing anything

1. Open the actual current `download_employee_template` endpoint code and confirm: does column H (Cost Center Code) generation code currently attempt a data validation at all, or was it never added? Report exact finding — this determines if it's a bug fix or a missing feature.
2. Open the actual current CoA remap template generation endpoint and Replace All / Remap backend logic. Confirm current gating (or lack of it) on both endpoints.
3. Confirm the exact `lifecycle_status` field and its values (already known from previous STEP 0: `Tenant.lifecycle_status` — `"trial" | "in_implementation" | "live" | "suspended"` in `auth.py:88`) — re-confirm this hasn't changed.
4. Report all findings before proceeding.

## Part A — CoA lifecycle gating fix

**Backend:**
- `POST /api/config/coa/replace-all`: restore as a working endpoint (undo the 410 Gone deprecation). Add a guard: only allowed when `tenant.lifecycle_status == "in_implementation"`. Any other status → reject with a clear error (e.g. 403) explaining Replace All is only available during implementation; use Remap instead once live.
- `POST /api/config/coa/remap` and `POST /api/config/coa/remap-bulk`: add a guard so these are only allowed when `tenant.lifecycle_status == "live"`. Any other status (including `in_implementation`) → reject with a clear error explaining Remap is only available once the tenant is live; use Replace All during implementation.
- `GET /api/config/coa/remap-template` (the downloadable bulk remap template): should still be downloadable regardless of status if useful for prep, but report your judgment — if Adeniyi would rather it also be gated to `live` only, flag this in the completion summary rather than guessing silently.

**Frontend (CoA page):**
- Show "Replace All" button only when `lifecycle_status == "in_implementation"`.
- Show "Remap codes" button only when `lifecycle_status == "live"`.
- Never show both, never show neither (one of the two should always be visible, matching current tenant state) — unless tenant status is `trial` or `suspended`, in which case report what you think is sensible (e.g. neither button, since no real CoA work should happen yet) rather than guessing without flagging it.

## Part B — Employee template: fix Cost Center Code dropdown

- In `download_employee_template`, add actual openpyxl data validation (`DataValidation`, type="list") on the Cost Center Code column (H), sourced from the tenant's real cost center dimension values (same source already used for `GET /api/hr/cost-centers/options`, built in the earlier employee brief). Confirm in your completion summary that this is now genuinely present by re-inspecting the generated file's `data_validations` after the fix (not just describing the code change).

## Part C — Template format standard: apply to both templates

**Employee template (`download_employee_template`):**
- Remove the inline example text currently in row 2 of the Employees sheet (e.g. "e.g. Adeniyi", "e.g. Oladunmoye", "e.g. adeniyi@company.com", etc.).
- Add that same example text as a **cell comment** on each respective header cell in row 1 instead.
- Data now starts at row 2 (since row 2 is no longer occupied by examples) — update the Instructions sheet to state this explicitly, and add a clear note on the Employees sheet itself (e.g. a short instructional cell or highlighted row 2 placeholder) confirming "Enter data starting here."
- Re-check: the existing Head of Cost Center dropdown validation range was `K4:K10004` — this was previously offset to account for the row-2-example/row-3-sample-row layout. Adjust the range to match the new data-start row.

**CoA remap template (the remap-template endpoint):**
- Same treatment: remove inline example text from Remap!A2/B2/C2, move to header cell comments instead.
- Update Instructions sheet to state data starts at row 2.
- Confirm the "Active GL Accounts (Reference)" sheet is untouched (it's reference data, not a data-entry row, so it's fine as-is) — just confirm this explicitly rather than assuming.

## Files CC is allowed to modify

- `backend/app/routers/config.py` (CoA endpoints, remap/replace-all gating, remap template generation)
- `backend/app/routers/hr.py` (employee template generation only — `download_employee_template`)
- `frontend/src/app/dashboard/.../chart-of-accounts/page.tsx` (button visibility per lifecycle_status — confirm exact path in STEP 0 if different from what was used in the prior brief)
- No model or migration changes expected for this brief — if STEP 0 finds one is genuinely needed, flag it and confirm with Adeniyi before adding

## Do NOT touch

- Employee bulk upload row-parsing logic itself (only the template generation/format)
- GL/posting engine
- Anything outside the list above without flagging it first

## Acceptance tests (state pass/fail for each, and confirm by actually re-inspecting the generated files, not just describing the code)

1. STEP 0 findings reported in full before any code change.
2. Set test tenant to `lifecycle_status == "in_implementation"`: Replace All button visible and working; Remap button NOT visible; calling remap endpoint directly returns the gating error.
3. Set test tenant to `lifecycle_status == "live"`: Remap button visible and working; Replace All button NOT visible; calling replace-all endpoint directly returns the gating error.
4. Download employee template fresh, open it, confirm via inspection (not description) that column H (Cost Center Code) has a working list data validation populated with real tenant cost center codes.
5. Download employee template fresh, confirm row 2 no longer contains inline example text; confirm header cells in row 1 have comments containing the example text instead; confirm Instructions sheet states data starts at row 2; confirm Head of Cost Center column validation range is correctly adjusted to the new layout.
6. Download CoA remap template fresh, confirm row 2 no longer contains inline example text; confirm header cells have comments instead; confirm Instructions sheet states data starts at row 2.
7. Re-test a full employee bulk upload end to end with the corrected template (real cost center code picked from the new dropdown) — confirm upload still succeeds, no regression from the row-shift.
8. Re-test a full CoA bulk remap with the corrected template — confirm upload still succeeds, no regression from the row-shift, AND confirm it's correctly blocked when tenant is `in_implementation` (per test 2) and works when `live` (per test 3).
9. All tests run against test tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` — never live Red Bull.
10. CORS/DB config unchanged — confirm explicitly.

## Completion summary must include

- STEP 0 findings verbatim
- Exact list of every file changed
- Pass/fail for every acceptance test above, with explicit confirmation that download-and-reinspect was actually performed for tests 4, 5, 6 (not just "should work")
- Your judgment call on whether the remap-template download itself should also be lifecycle-gated, clearly flagged as a judgment call, not silently decided
- Your judgment call on Replace All / Remap button visibility when tenant status is `trial` or `suspended`, clearly flagged
