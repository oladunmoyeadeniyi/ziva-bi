Read docs/ZIVA_BI_ROADMAP.md, docs/MASTER_CONTEXT.md, and docs/TEST_TENANT.md first, then follow this brief.

# BRIEF — Fix Resumption Date Parser + Clean Re-upload of Red Bull Employees

## Context

A real Red Bull employee bulk upload (40 employees) was attempted on test shadow `e8a2fd8c-5466-4618-bb37-97681a8bfb05`. Result: "40 imported · 0 updated · 40 errors · 9 head-of-cost-center assignments set." Every error was identical: `Invalid Resumption Date: '2024-01-04 00:00:00'`.

**Root cause (confirmed by inspecting the actual uploaded file):** the Resumption Date column (J) contains real Excel `datetime` cell values (e.g. `datetime(2024,1,4)` with number format `mm-dd-yy`), NOT the text `dd/mm/yyyy` string the template header requests. Excel auto-converted the typed dates into datetime objects. The upload parser only handles a text `dd/mm/yyyy` string and fails on actual datetime cells. The cost center codes (column H, org_structure codes like N22341AD, N22341SR) all parsed correctly — the org_structure cost-center fix works. Only the date column failed, identically across all 40 rows.

Adeniyi's decisions:
1. **Parser fix — accept BOTH** a real Excel datetime cell value AND a text `dd/mm/yyyy` string. A genuine datetime is more reliable than text (no dd/mm vs mm/dd ambiguity), so it must be accepted, not rejected. Normalize whatever Excel provides into the stored date.
2. **Delete the partial rows first, then clean re-upload** — no lingering half-imported records, no upsert ambiguity.

## STEP 0 — Confirm actual state before changing anything

1. **Query the actual employee count on shadow `e8a2fd8c-...` right now.** The "40 imported · 40 errors" message is ambiguous — did 40 rows actually get created (with null/missing resumption dates), or were they rejected? Report the exact count of employee rows currently on the shadow tenant, and whether their `resumption_date` (or equivalent field) is null/populated. This determines what "delete the partial rows" actually means.
2. **Find the actual resumption date parsing code** in `upload_employees` (`hr.py`) — report the exact current logic: what does it call to parse column J, what formats does it accept today, and exactly where/why a datetime value fails.
3. **Confirm the stored field type** for resumption date on the Employee model (is it a `Date`, `DateTime`, string?). The fix must normalize to whatever the model stores.
4. **Confirm the standing date-floor rule applies here**: per `docs/MASTER_CONTEXT.md`, no date may be earlier than `tenant_org_config.date_of_registration`. The resumption date parser should also enforce this floor (reject a resumption date earlier than the registration date with a clear row error). Confirm whether this check already exists in the upload path or needs adding. Report what Red Bull's `date_of_registration` actually is on the shadow, so we know whether the 2024-01-04 dates in the file are even valid against the floor.
5. Report all findings before writing fix code.

## Part A — Fix the resumption date parser

- Update the resumption date parsing in `upload_employees` to accept:
  - A real Excel datetime/date cell value (openpyxl will hand it over as a Python `datetime`/`date` object) → use it directly, normalized to the model's stored type.
  - A text string in `dd/mm/yyyy` format → parse as before.
  - (Optional, use judgment) a text string in obvious ISO `yyyy-mm-dd` format → accept too, since it's unambiguous. If you add this, note it in the summary.
- Reject genuinely unparseable values with the existing clear row-error pattern.
- Enforce the date floor (per STEP 0 point 4): a resumption date earlier than `tenant_org_config.date_of_registration` gets a clear row error naming the floor. Confirm with the actual Red Bull registration date whether the 2024-01-04 dates pass or fail this — if they FAIL (i.e. Red Bull's registration date is after 2024-01-04), STOP and report this to Adeniyi before re-uploading, because then the data itself is wrong, not just the parser.
- Also handle blank resumption date gracefully if the field is optional (confirm from the model whether it's nullable) — blank should not error if the column is optional.

## Part B — Delete the partial rows

- Based on STEP 0 point 1's actual count: delete the employee rows created by the failed upload on shadow `e8a2fd8c-...`. These were created today in the failed batch — safe to hard-delete on a test shadow (not deactivate), since this is test data being cleaned for a fresh import, not live employee records.
- Also clean up any `CostCenterConfig` head-assignment rows created by the partial upload (the "9 head-of-cost-center assignments" mentioned), so the re-upload starts from a truly clean state.
- Confirm zero employees and zero related head-assignment rows remain on the shadow before re-upload.

## Part C — Clean re-upload

- Re-upload the same corrected file (Adeniyi will re-provide it, or confirm the existing file at the known path can be reused — the file data is fine, it's the parser that was broken, so the SAME file should now import cleanly once Part A is done).
- Confirm result: 40 imported, 0 errors, resumption dates correctly populated, cost centers correctly assigned, head-of-cost-center assignments correctly set.
- Report the final clean import summary.

## Files CC is allowed to modify

- `backend/app/routers/hr.py` (resumption date parsing in `upload_employees` only)
- No model or migration changes expected — flag if STEP 0 reveals one is genuinely needed

## Do NOT touch

- The org_structure cost-center logic (just fixed and working — do not refactor)
- Cost center dropdown / template generation (working correctly)
- Live Red Bull tenant
- Anything outside the list above without flagging it first

## Acceptance tests (state pass/fail for each)

1. STEP 0 reported in full, including actual current employee count on the shadow, the stored date field type, and Red Bull's actual `date_of_registration`.
2. Parser accepts a real Excel datetime cell → date stored correctly.
3. Parser accepts a text `dd/mm/yyyy` string → date stored correctly.
4. Parser rejects a genuinely unparseable value with a clear row error.
5. Date floor enforced: a resumption date before `date_of_registration` errors clearly. (And: confirmed whether the file's 2024-01-04 dates pass or fail this floor — if they fail, brief stopped and reported per Part A.)
6. Partial rows from the failed upload deleted; zero employees and zero stale head-assignments remain before re-upload.
7. Clean re-upload: 40 imported, 0 errors, dates populated, cost centers assigned, head assignments set.
8. All work on shadow `e8a2fd8c-5466-4618-bb37-97681a8bfb05` only — confirmed against `docs/TEST_TENANT.md` fresh, never live Red Bull.
9. CORS/DB config unchanged — confirm explicitly.

## Completion summary must include

- STEP 0 findings verbatim (actual employee count, date field type, Red Bull registration date, current parser logic)
- Exact list of every file changed
- Pass/fail for every acceptance test
- The final clean re-upload result summary (imported/updated/errors/head-assignments)
- Explicit confirmation of whether the 2024-01-04 dates passed the date floor, or whether the brief had to stop and flag a data problem
