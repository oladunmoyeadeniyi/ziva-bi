Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# BRIEF — Investigation Only: Why does the test tenant have an empty Organisation Structure?

## Context

Test tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` ("Ziva BI — Test Tenant") currently shows "No org structure yet" on the Organisation → Structure page, while live Red Bull Nigeria Limited has a full org tree (GMBH → Red Bull Nigeria Limited → Administration/Finance/HR/IT/Legal/Marketing → Brand Marketing, etc.) — confirmed by screenshot. Org structure existed on live BEFORE this test tenant was created.

A clone-on-create engine was previously built (Phase 4) that is supposed to copy live tenant data — including org structure/dimensions — into a new test shadow at creation time, with `clone_data=True` as the default. This brief is to find out why this specific test tenant doesn't have that data. **This is investigation only. Do not modify any code, data, or run any clone/create operation. Do not fix anything yet.**

## What to investigate and report

1. **When was this specific test tenant (`f2aecfab-025f-410f-a7f6-df923172c8a1`) created?** Check its `created_at` timestamp directly in the database.
2. **When was the Phase 4 clone-on-create engine actually deployed/merged?** Check git log / commit history for the clone engine files (`backend/app/services/` — whichever file implements the 9-step clone, per `promotion_engine.py`-adjacent work) to find the commit date.
3. **Compare the two timestamps.** Does the test tenant's `created_at` predate the clone engine's existence? If yes — this is simply an old empty shadow created before cloning was possible, not a bug. State this clearly if so.
4. **If the test tenant was created AFTER the clone engine existed**, investigate why org structure specifically wasn't cloned:
   - Was `clone_data=False` passed at creation time for this tenant? Check whatever record exists of how/when this tenant was created (logs, audit trail, or the creation request itself if recoverable).
   - If `clone_data=True` was used, did the clone run fail partway? Check for any error logs from the clone process around the creation timestamp.
   - Specifically check: did `TenantDimension` and `DimensionValue` rows (org structure / cost centers) get cloned for THIS test tenant at all, or is the entire org structure missing, or just partially missing? Query directly: count `TenantDimension` and `DimensionValue` rows for this test tenant vs. count for live Red Bull Nigeria Limited, broken down by type if possible.
   - Check whether OTHER data that the clone engine is supposed to copy (CoA, employees, bank accounts) actually DID make it into this test tenant. If CoA/employees ARE present but org structure/dimensions specifically are NOT, that narrows the bug to one specific step of the 9-step clone. If NOTHING was cloned at all, that points to `clone_data=False` having been used, or the whole clone step failing/being skipped entirely.
5. Report exact row counts, exact timestamps, and exact findings — no guessing, no "likely" — only what the database and logs actually show.

## Do NOT

- Do not create a new test tenant.
- Do not re-run any clone operation.
- Do not modify any existing data.
- Do not write any fix code in this brief — that will be a separate follow-up brief once the cause is confirmed.

## Completion summary must include

- Test tenant `created_at` timestamp
- Clone engine deployment date (commit reference)
- Whether test tenant predates clone engine — yes/no, with evidence
- If it postdates the clone engine: exact row counts for TenantDimension/DimensionValue/CoA/Employees/BankAccounts on the test tenant vs. live, and any error logs found
- A clear, evidence-based conclusion: "predates the engine" OR "clone_data=False was used" OR "clone ran but this specific step failed" OR "cause unclear, here's what we know and don't know"
