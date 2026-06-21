Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# BRIEF — CoA Code Retirement & Remap (replaces "Replace All") + Go-Live Gating for Employee Hard-Delete

## Context

Today, CoA's "Replace All" wipes and reimports the entire chart fresh. This is fine pre-go-live but dangerous post-go-live: once a journal line posts to an account, that account cannot be deleted without orphaning or corrupting historical postings.

Adeniyi's decision: replace "Replace All" with a proper **code retirement & remap** workflow — old code(s) frozen (never deleted), many-to-one remap to a new or existing code, full audit trail, historical reporting preserved.

Separately: Employee hard-delete (built in the previous brief) must be gated by go-live status — true delete only allowed pre-go-live; post-go-live, deactivate only, regardless of whether the employee has any references.

## Decisions already locked (do not re-litigate)

1. **Remap is many-to-one**: multiple old codes → one new code. The new code can be an entirely new account created inline, or an existing live account.
2. **"Replace All" button is renamed/repurposed to "Remap."** It is no longer a destructive wipe-and-reimport. Plain "add a new GL code" (no retirement involved) stays exactly as it works today — that's normal CoA maintenance, not part of this feature.
3. **One combined screen**: select old code(s) to retire → define or pick the new code → confirm. Single action.
4. **Bulk remap via downloadable template**: a batch-upload template for many:1 remaps in one file, same general pattern as the employee bulk template (download → fill → upload → validate → apply).
5. **Type/normal-balance consistency is BLOCKED, not warned.** If old codes being merged into one new code have inconsistent account type or normal balance among themselves, OR the chosen new code's type/normal balance conflicts with the old codes', reject the remap with a clear error. This applies to both the single-screen flow and the bulk template flow. (Flagged to Adeniyi as overridable later if it proves too rigid — do not silently relax it without asking.)
5b. STEP 0 must determine an additional consistency question and report back before implementing the block: should the retired codes among themselves also need to match the *statement taxonomy role* (the ~24 flat posting-role catalogue, e.g. BS/PL → group → subgroup → role), not just type/normal balance? Check `backend/app/models/` for how account-to-role mapping works today and report whether merging two codes with different posting roles is even possible/safe given the account-determination layer. If STEP 0 finds this is a real risk, extend the block to cover it; if not, state why not.
6. **Historical journals never move.** A journal posted to old code 5010 keeps pointing at 5010 forever. 5010 itself becomes frozen (`status = retired` or equivalent — confirm/match whatever status field pattern already exists on the CoA model in STEP 0).
7. **Reporting must support both views on demand**: filter/download GL data consolidated under the NEW code (rolls up all old codes that fed into it), AND filter/download by a specific OLD code in isolation (e.g. "show me everything that was posted to 5010 before it was retired").
8. **Posting pickers vs. reporting pickers — retired codes are scoped differently**:
   - Any UI/endpoint where a NEW transaction/journal line is created (journal entry, expense GL coding, any "create posting" context) — retired codes must NEVER appear, no toggle, no exception.
   - Reporting/analysis contexts (trial balance, GL drill-down, the old-vs-new filter in point 7) — retired codes ARE selectable, scoped to these historical/reporting views only.
   - STEP 0 must enumerate every place a GL/account code dropdown currently appears (across journal entry, expense coding, reports, anywhere else found) and classify each as "posting" or "reporting" before implementation, so retired-code visibility is set correctly per location. Report this list.
9. **Employee hard-delete is now go-live gated**: true row-delete (not deactivate) is only allowed while the tenant has NOT gone live. Once live, delete always means deactivate — regardless of whether that specific employee has any references anywhere. This applies even to an employee created accidentally an hour ago, post-go-live: deactivate only, never hard-delete. Pre-go-live, hard-delete remains allowed as currently built.

## STEP 0 — Investigate first, report findings before changing anything

1. **Find the actual "go-live" signal for a tenant.** Check `tenant_org_config` and related models — is there an existing `is_live` / `go_live_date` / similar field? If not, report this clearly; this brief assumes such a field needs to exist (see Part C) — confirm whether it already does or must be added.
2. **Find the actual CoA model** (`backend/app/models/master_data.py` or wherever the GL account table lives). Report: existing status field(s) (active/inactive?), account type field, normal balance field, any existing posting-role/statement-taxonomy linkage.
3. **Find the actual `/api/config/coa/replace-all` endpoint and frontend "Replace All" button/modal.** Report exactly what it does today, file and line references.
4. **Enumerate every GL/account code dropdown or picker in the codebase** (journal entry if it exists yet, expense GL coding, any report filters, anywhere else). Classify each as "posting" (creates new transactions) or "reporting" (read-only/analysis). Report the full list before writing code.
5. **Check whether any journal-posting engine exists yet beyond the expense flow** (per `docs/MASTER_CONTEXT.md` — GL/posting engine and expense→GL 3a are live; confirm if there's anything else that posts to GL codes that would need the retired-code exclusion applied).
6. Report all findings before proceeding to implementation.

## Part A — Code retirement model

**Backend:**
- Add a `gl_code_remap` (or similarly named — match existing naming conventions found in STEP 0) table: `id`, `tenant_id`, `old_account_id` (FK), `new_account_id` (FK), `remapped_by`, `remapped_at`, optional `reason`/`note`. One row per old→new pair (supports many:1 naturally — multiple rows can share the same `new_account_id`).
- Add/confirm a status field on the GL account model to mark an account `retired` (do not delete the row). Confirm exact existing pattern in STEP 0 rather than inventing a new one if one already exists (e.g. if CoA already has `is_active`, reuse/extend it rather than adding a parallel field).
- Retired accounts are excluded from posting pickers (point 8 above) but remain in the database and in reporting pickers.

## Part B — Remap action (single-screen + bulk template)

**Single-screen remap:**
- Backend endpoint (e.g. `POST /api/config/coa/remap`): accepts list of old account IDs + new account ID (new account either pre-existing or created inline in the same call). Validates type/normal-balance consistency per point 5 (and 5b if STEP 0 confirms it applies) — reject with clear error listing the conflicting codes if inconsistent. On success: creates `gl_code_remap` rows, marks old accounts retired, audit-logs the action (match existing audit log pattern, e.g. similar to `EXPENSE_GL_POSTED`).
- Frontend: replace "Replace All" button/modal with "Remap" — select old code(s) (multi-select), then either pick an existing code or fill inline new-code fields, confirm, see validation errors inline if blocked.

**Bulk remap template:**
- Downloadable template (old code, old code, ... → new code columns, or one row per old→new pair with a shared new-code grouping key — use judgment on the cleanest structure, but report the chosen structure in the completion summary).
- Upload endpoint validates same consistency rules per row group, applies same retirement + audit logging, returns row-level errors for any failed group (mirror the employee bulk upload's row-error pattern for consistency).

## Part C — Go-live gate for employee hard-delete

- If STEP 0 finds no existing `is_live`/`go_live_date` field on `tenant_org_config`, add one (`go_live_date: date | null`, null = not yet live). Do NOT auto-populate it — this is a manual flag Adeniyi/Controller sets when the tenant genuinely goes live. Add wherever tenant org config is currently editable (or note if no UI exists yet and a backend-only field is acceptable for now — confirm with Adeniyi if so).
- Update the employee hard-delete logic (built in the previous employee brief) to check this flag: if `go_live_date` is set (tenant is live), hard-delete is blocked entirely — delete always routes to deactivate, full stop, no reference-count exception.
- If `go_live_date` is null (pre-go-live), keep existing hard-delete behavior as already built.

## Files CC is allowed to modify

- `backend/app/routers/` — the CoA config router and `hr.py` (for the go-live gate only, Part C)
- `backend/app/models/master_data.py` (new `gl_code_remap` table/model, status field if needed, `go_live_date` field if needed)
- `backend/app/schemas/` — relevant CoA and tenant config schemas
- New Alembic migration for the new table/fields
- Frontend CoA page (path to be confirmed in STEP 0)
- Tenant org config frontend, ONLY if STEP 0 finds an existing settings UI to extend — do not build a new settings page from scratch without confirming with Adeniyi first

## Do NOT touch

- Employee bulk upload/cost-center work from the previous brief (already shipped, do not refactor)
- GL/posting engine, expense→GL 3a flow logic itself (only the picker/dropdown exclusion of retired codes, not the posting logic)
- Dimensions module
- Anything outside the list above without flagging it first

## Acceptance tests (state pass/fail for each)

1. STEP 0 findings reported in full before any code change, including the full posting-vs-reporting picker enumeration.
2. Old "Replace All" wipe-and-reimport behavior is gone; "Remap" exists in its place.
3. Single-screen remap: select 2+ old codes with matching type/normal balance, pick existing new code → succeeds, old codes marked retired, `gl_code_remap` rows created, audit log entry created.
4. Single-screen remap: select 2+ old codes with matching type/normal balance, create brand-new code inline → succeeds.
5. Single-screen remap: select old codes with MISMATCHED type/normal balance → blocked with clear error naming the conflicting codes.
6. Bulk remap template: download, fill valid many:1 remaps, upload → all applied correctly, audit logged.
7. Bulk remap template: include one row group with inconsistent types → that group rejected with row-level error, valid groups in the same file still applied.
8. Journal/expense GL coding picker: retired codes do NOT appear, confirmed against every location enumerated in STEP 0 point 4.
9. Reporting/trial-balance/drill-down picker: retired codes DO appear, clearly marked retired.
10. Report or download filtered by NEW code shows consolidated historical data from all old codes that fed into it.
11. Report or download filtered by a specific OLD code shows only that code's pre-retirement history, isolated.
12. A journal previously posted to an old code, before that code was retired, is unchanged and still reportable exactly as before.
13. Employee hard-delete: with `go_live_date` null, hard-delete still works exactly as previously built (no regression).
14. Employee hard-delete: with `go_live_date` set, attempting hard-delete on ANY employee (even one with zero references) results in deactivate instead — confirmed via direct test setting the flag on the test tenant.
15. All tests run against test tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` — never live Red Bull.
16. `alembic current` confirmed equal to head after migration.
17. CORS (`http://localhost:3000` hardcoded) and DB name (`ziva_dev`) in `config.py` unchanged — confirm explicitly.

## Completion summary must include

- STEP 0 findings verbatim, including the full picker enumeration table (location → posting/reporting → retired-code visibility applied)
- Exact list of every file changed
- Pass/fail for every acceptance test above
- The bulk remap template's chosen column structure, explained
- Confirmation of whether `go_live_date` already existed or was newly added, and where (if anywhere) it's currently settable from the UI
