Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# BRIEF — Commit Clone Engine, Verify It, Create the Real Test Shadow, Retire f2aecfab

## Context

Investigation confirmed: the Phase 4 clone-on-create engine (`backend/app/services/tenant_clone.py`) was built but **never committed to git** — it exists only as an uncommitted local file. The current test tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` is NOT a cloned shadow — it's a standalone tenant (`environment="live"`, `parent_tenant_id=NULL`) created through the normal signup path, which is why it has no org structure, no real cost centers, and only 2 dimension values left over from test-script residue.

Adeniyi's decision: **no split source of truth for any tenant, ever.** Every time "Create test environment" is clicked, the resulting tenant must be a complete, faithful clone of its live parent — org structure, CoA, dimensions, employees, bank accounts, mappings, config, modules, approval matrix — all of it, every time, automatically. Once a real shadow exists and is verified, `f2aecfab` will be deleted entirely.

This brief has four sequential parts. Do not skip ahead — each part gates the next.

## Part A — Commit the clone engine (do this first, today, before anything else)

1. Run `git status` and `git diff` to see everything currently uncommitted in the repo, not just the clone engine file — report the full list. There may be other uncommitted work from the same session that would also be lost.
2. Review `backend/app/services/tenant_clone.py` for obvious issues (syntax errors, unfinished TODOs, hardcoded values that shouldn't be) before committing — report anything concerning.
3. Commit all legitimate uncommitted work, including the clone engine, with clear commit message(s). If there is uncommitted work that looks experimental/broken/abandoned, do NOT commit it blindly — report it separately and ask before committing anything you're unsure about.
4. Push to `main` per existing workflow.
5. Confirm `git log` now shows the clone engine committed, with commit hash.

## Part B — Verify the clone engine is actually complete

Before trusting it to create the real shadow, read the actual code in `tenant_clone.py` and confirm, line by line, that it genuinely covers ALL of the following for the source live tenant (report PASS/FAIL per item, not a general assurance):

1. `tenant_dimensions` (all rows, all dimension types — not just cost center)
2. `dimension_values` (all rows, correctly re-parented to the new tenant's cloned dimensions, not pointing at the old tenant's dimension IDs)
3. `chart_of_accounts` (all 595+ accounts, with `is_active`/`is_retired` status preserved as-is, GL codes intact)
4. `employees` (if any exist on the source — confirm whether live Red Bull currently has 0 employees as the previous investigation found, and whether the clone logic handles an empty employees table gracefully)
5. `bank_accounts` (all rows, multi-currency fields intact)
6. `gl_dimension_requirements`
7. `tenant_account_mappings` (posting role → account mappings)
8. `tenant_org_config` (functional currency, enabled currencies, date_of_registration, lifecycle_status — confirm what lifecycle_status the clone sets on the NEW shadow specifically; it should almost certainly start as `in_implementation` regardless of the parent's status, since transactions are not being cloned — flag this explicitly and recommend if it doesn't already do this)
9. `tenant_modules`
10. `approval_matrix`
11. Foreign key re-pointing: confirm every cloned row that references another cloned row (e.g. a dimension_value referencing its tenant_dimension, an account_mapping referencing a chart_of_accounts row) is correctly re-pointed to the NEW tenant's cloned IDs, not left pointing at the original live tenant's IDs. This is the most likely place for a subtle bug — check carefully.
12. Confirm what is deliberately NOT cloned (transactions/journal entries, expense submissions, audit logs) and confirm this is intentional per the original Phase 4 design intent (a shadow should have structure/master data but no live transaction history).

Report each item's status. If any item is missing or broken, fix it now, as part of this brief, before proceeding to Part C — do not create the real shadow on a clone engine known to be incomplete.

## Part C — Create the real test shadow

1. Once Part B is fully PASS, call the actual `POST /api/platform/.../test-environment` endpoint (confirm exact path in code) against live Red Bull Nigeria Limited to create a proper shadow tenant.
2. Verify the new shadow tenant has `environment="test"` and `parent_tenant_id` correctly set to live Red Bull's tenant ID.
3. Run the same row-count comparison the investigation brief used (tenant_dimensions, dimension_values, chart_of_accounts, employees, bank_accounts, gl_dimension_requirements, tenant_account_mappings, tenant_org_config, tenant_modules, approval_matrix) — compare new shadow vs. live Red Bull. Counts should match exactly (or be deliberately 0 where live is genuinely 0, e.g. employees).
4. Spot-check in the actual UI (or report enough detail that Adeniyi can spot-check): does the new shadow's Organisation → Structure page show the full org tree, matching live? Does Chart of Accounts show all accounts? This must be confirmed, not assumed.
5. Confirm the new shadow's `lifecycle_status` (per Part B point 8) and report what it is.
6. Document the new shadow tenant's UUID clearly in the completion summary and propose an update to `docs/TEST_TENANT.md` (do not edit the doc yet — propose the replacement content, Adeniyi will confirm before it's finalized as the new standing reference).

## Part D — Retire f2aecfab (only after Adeniyi confirms Part C is verified)

**Do NOT do this part automatically.** Stop after Part C and report findings. Adeniyi will explicitly confirm the new shadow is good before deletion happens. Once confirmed in a future message:
- Delete tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` entirely (hard delete — this was never a real client, it's safe to remove completely, not deactivate).
- Confirm no other tenant or code references this UUID before deleting (search codebase for the literal UUID string to be safe).
- Confirm deletion succeeded.

## Files CC is allowed to modify

- `backend/app/services/tenant_clone.py` (fix any gaps found in Part B)
- Any other file already uncommitted per Part A's `git status` findings (review and commit, or flag and ask)
- `docs/TEST_TENANT.md` — propose new content only, do not finalize without confirmation

## Do NOT touch

- Live Red Bull Nigeria Limited's actual data (read-only source for cloning, never written to)
- Any other tenant
- Anything outside the scope above without flagging it first

## Acceptance tests (state pass/fail for each)

1. `git status` clean after Part A; clone engine and any other legitimate uncommitted work confirmed committed and pushed.
2. Part B per-item PASS/FAIL table fully reported; any gaps found were fixed before proceeding.
3. New test shadow created with correct `environment="test"` and `parent_tenant_id` linkage.
4. Row-count comparison: new shadow matches live Red Bull across all 10 tables (or documented intentional exceptions, e.g. employees=0).
5. Org structure visually/structurally confirmed present on the new shadow (not just row counts — confirm the tree is actually navigable/correct).
6. New shadow's `lifecycle_status` reported and reasoned about (should very likely be `in_implementation`, not inherited as `live`).
7. New shadow UUID documented; proposed `TEST_TENANT.md` content provided for Adeniyi's review.
8. f2aecfab NOT deleted yet — explicitly confirmed left alone pending Adeniyi's go-ahead.

## Completion summary must include

- Part A: full list of what was committed, with commit hash(es)
- Part B: full per-item PASS/FAIL table, and details of any fixes made
- Part C: row-count comparison table, lifecycle_status finding, new shadow UUID
- Explicit statement that Part D (deletion) was NOT performed and is awaiting Adeniyi's confirmation
