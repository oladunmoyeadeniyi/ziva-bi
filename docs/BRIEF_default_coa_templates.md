Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Default CoA Templates: industry starter charts + adoption + smart re-download

**Scope:** Backend + frontend. Let a tenant with zero GL accounts adopt a pre-built Chart of Accounts (3 starter templates: FMCG/Consumer goods, Professional services, Generic/Other) instead of building one from scratch or uploading blind. Adopted accounts are ordinary, fully-editable tenant rows from the moment they land — no locking. Also fixes `download_coa_template()` so a tenant who already has accounts (whether adopted or hand-built) gets a pre-filled download instead of a blank one, which is what makes bulk dimension-requirement mapping and regrouping usable after adoption.

All design decisions below were made in a review doc with Adeniyi (`docs/DEFAULT_COA_TEMPLATES_DRAFT.md`) — read it in full as part of Step 0. It contains the literal, approved seed data (full GL lists for all 3 templates) and the reasoning for every architectural call in this brief. Treat it as the source of truth for *what* to build; this brief is the source of truth for *how*.

---

## STEP 0 — Read before changing anything (mandatory)

Read and report exact current state before editing anything:

- `docs/DEFAULT_COA_TEMPLATES_DRAFT.md` — full doc. Sections 2/3/4 contain the 3 templates' literal GL rows (markdown tables) — this is the seed data for the new migration, verbatim, not to be re-derived or re-typed from memory. Section 1 has the 8 architecture decisions (storage shape, adoption mechanism, anti-leakage design, posting-role coverage, classification additions). Section 5 covers the `download_coa_template()` change. Section 6 documents a classification-column correction already applied to the tables (the Classification column you'll read in Sections 2-4 is already fixed to match the real frontend constants — confirm this yourself per the next bullet, don't take it on faith). Section 8 has one still-open, non-blocking question (item 5) — read it, but do not let it block this brief.
- `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx` lines ~120-142 — confirm the exact current contents of `PL_CLASSIFICATIONS` and `BS_CLASSIFICATIONS`. Every `account_classification` value used in the Section 2/3/4 tables must already be a member of one of these two lists, EXCEPT the 3 new values from decision 8 ("Revenue — service fees", "Contract asset — unbilled revenue", "Contract liability — deferred revenue") which you are adding in this brief. If you find any seed-data classification value that is neither an existing list member nor one of those 3 new values, STOP and report it — do not silently substitute something.
- `backend/app/models/master_data.py` — full `ChartOfAccount` model (fields, types, nullability) and `GLDimensionRequirement` model. This is the template for the new `CoaTemplateAccount` model's column shape.
- `backend/app/routers/config.py` — `download_coa_template()` (~line 1402: confirm exact current Sheet 1 column set/order, confirm rows 4+ are currently always blank), `upload_coa()` (~line 2066: confirm upsert-by-gl_number logic, confirm blank-cell-preserves-existing-value behavior for most columns, confirm dimension columns default a blank cell to "optional" unconditionally — these are why the prefill must cover full rows, not just code+name), `create_coa`/`update_coa`/`delete_coa` (~1973-2065: confirm unrestricted, no `locked_by_implementation` enforcement anywhere), the `_require_tenant`/`_require_admin` guard pattern used throughout this router, and the router prefix (`/api/config`, line 111).
- `backend/app/services/tenant_clone.py` `_clone_coa()` (~line 173) — read its signature and body. Confirm it takes an explicit `live_id`/`test_id` tenant pair and clones live→test rows. Do **not** reuse or call this function for template adoption — it's the wrong shape (built for tenant-to-tenant cloning, not system-template-to-tenant). Write a new, separate function instead (see Build B).
- `backend/app/models/setup.py` line ~278 — confirm `TenantOrgConfig.industry` (table `tenant_org_config`) is the field holding the tenant's industry, set during org setup.
- `frontend/src/app/dashboard/business/setup/organisation/page.tsx` ~line 123 — confirm the exact `INDUSTRIES` list and spelling (e.g. "FMCG / Consumer goods", "Professional services") — the new `coa_templates.industry` values must match these strings exactly, character for character, so a lookup/suggestion match works.
- `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx` — the empty-state block (~lines 1773-1777, `{accounts.length === 0 ? ... }`), the function that loads/sets the accounts list (`setAccounts`, ~line 398) so you can reuse it after adoption, an existing modal pattern in this same file (e.g. the Add GL / Edit GL / dimension-requirements modals) to match styling, and `handleUploadFile` (~line 592) for how this file already calls mutating CoA endpoints.
- `backend/alembic/versions/` — confirm the current single head revision (was `k7l8m9n0o1p2` — "harden accounting_periods uniqueness to start_date" — as of this brief's writing; CONFIRM it is still the actual current head before chaining your migration off it; if something has landed since, chain off whatever the real current head is).

Report all of the above before writing any code.

---

## Build

### A. Migration — `coa_templates` + `coa_template_accounts`, seeded

Two new tables, additive, reversible:

**`coa_templates`**: `id` (uuid pk), `industry` (string, nullable — exact match against the frontend `INDUSTRIES` list for the two industry-specific templates; `NULL` for the Generic/Other fallback), `name`, `description`, `created_at`. No `tenant_id` — this is system-wide reference data, the same way `posting_roles` isn't owned by any tenant.

**`coa_template_accounts`**: `id` (uuid pk), `template_id` (FK → `coa_templates.id`, `ondelete="CASCADE"`, indexed), `gl_number`, `gl_name`, `account_type` ('BS'/'PL'), `gl_group`, `gl_subgroup` (nullable, leave null — the draft tables don't define this level), `gl_sub_subgroup` (nullable, leave null), `fs_head`/`fs_note`/`tb_mapping` (nullable, leave null), `account_classification`, `is_foreign_currency` (bool, default false), `foreign_currency_code` (nullable string), `revalue_at_period_end` (bool, default false), `sort_order` (int). No `tenant_id` — same reasoning.

**Seed exactly 3 templates, one row in `coa_templates` each, from `docs/DEFAULT_COA_TEMPLATES_DRAFT.md`:**
1. FMCG / Consumer Goods — `industry` = the exact `INDUSTRIES` string for FMCG (confirmed in Step 0). Rows from Section 2's table.
2. Professional Services — `industry` = the exact `INDUSTRIES` string for Professional services (confirmed in Step 0). Rows from Section 3's table.
3. Generic / Other — `industry` = `NULL` (fallback for the other 11 industries — no exact match by design). Rows from Section 4's table.

**Parsing each markdown table row** (`| GL # | GL Name | Type | Classification | Group |`) into a `coa_template_accounts` row:
- `gl_number` ← GL # column, as-is.
- `gl_name` ← GL Name column, as-is.
- `account_type` ← Type column: `SOFP` → `'BS'`, `SOCI` → `'PL'`.
- `account_classification` ← Classification column, as-is (already verified against the real `PL_CLASSIFICATIONS`/`BS_CLASSIFICATIONS` lists per Step 0 — these should all match without substitution).
- `gl_group` ← Group column, but **strip any trailing italic annotation** starting at `" *("` before storing — e.g. `"Non-current assets *(→ asset_clearing_cwip)*"` stores `gl_group = "Non-current assets"`. Those parenthetical notes are review/traceability annotations (posting-role hints, "(contra)", FX notes), not literal field data.
- **Exception to the strip rule — foreign currency rows:** where the stripped annotation reads `"FX: <CODE>, revalue at period end"` or `"FX: <CODE>"` (only the "Bank — Domiciliary Account (USD)" rows have this, one per template that includes it), set `is_foreign_currency = true`, `foreign_currency_code = "<CODE>"`, and `revalue_at_period_end = true` only if "revalue at period end" is present in that same annotation. This is real data the templates are carrying, not a note to discard.
- `sort_order` ← the row's 0-based position within its template's table, in the order given in the doc (this is already the correct FS-bucket-then-numeric display order).

Do not add, drop, reorder, or "improve" any row beyond what's in the doc. If you find what looks like an error in the seed data, stop and report it rather than fixing it silently.

Chain the migration after the confirmed current head (Step 0).

### B. `_adopt_coa_template()` service + endpoints (in `backend/app/routers/config.py`, same module as the other CoA endpoints — keep it co-located, no new router file)

**`async def _adopt_coa_template(db, tenant_id: UUID, template_id: UUID) -> int`:**
- Reads only `coa_template_accounts WHERE template_id = :template_id` — there is no tenant column to filter by on the source side, so there is no source-tenant input to get wrong.
- For each row, creates a new `ChartOfAccount` with `tenant_id` = the `tenant_id` argument (always the server-derived authenticated tenant — never accept a tenant field in any request body in this brief), copying `gl_number`/`gl_name`/`account_type`/`gl_group`/`account_classification`/`is_foreign_currency`/`foreign_currency_code`/`revalue_at_period_end`, `is_active=True`, `locked_by_implementation=False` (decision: fully editable from the moment it lands — no locking).
- Returns the count of accounts created.
- Wrap in one transaction — all-or-nothing.

**`POST /api/config/coa/adopt-template`** — body `{template_id: UUID}`. Guard: same as `create_coa`/`upload_coa` (confirmed in Step 0). Gate: if the tenant already has **any** `chart_of_accounts` row (active or not), return 409 with a clear message ("Chart of Accounts already has accounts — template adoption is only available before any GL account exists."). On success, call `_adopt_coa_template` and return `{template_name: str, accounts_created: int}`.

**`GET /api/config/coa/templates`** — list the 3 templates: `id`, `industry`, `name`, `description`, `account_count`. Also look up the current tenant's `TenantOrgConfig.industry` and include `suggested_template_id` (the template whose `industry` exactly matches; if none, the Generic/Other template's id) so the frontend can pre-highlight a choice. Same auth guard as other CoA reads — state which.

Add corresponding Pydantic schemas in `backend/app/schemas/config.py`, matching the existing naming style (e.g. `CoaTemplateListItem`, `CoaTemplateAdoptRequest`, `CoaTemplateAdoptResult`).

### C. `download_coa_template()` prefill (config.py, ~line 1402)

Current behavior (confirm in Step 0): Sheet 1 rows 4+ are always blank, regardless of the tenant's existing data.

New behavior: if the tenant has **one or more** existing `chart_of_accounts` rows, write one row per account (ordered by `gl_number`) into Sheet 1, filling every column currently on that sheet (the exact current set confirmed in Step 0 — GL Number, GL Name, Account Type, Group/Subgroup/Sub-subgroup, FS Head/Note, TB Mapping, Classification, Category/Subcategory, etc. — use whatever is actually there today, don't invent or drop columns) plus each dimension-requirement column set to that account's current requirement (`GLDimensionRequirement.requirement`), defaulting to "Optional" only where no requirement row exists yet for that gl/dimension pair — same default the upload side already applies. Tenants with zero accounts get exactly today's blank template, unchanged.

This is a one-function change. No new endpoint, no frontend change — the existing "Download Template" button already calls this endpoint, and the behavior change is transparent to it.

### D. Frontend (`chart-of-accounts/page.tsx`)

**Empty-state CTA** (the `accounts.length === 0` block, ~lines 1773-1777, confirm exact current lines in Step 0): keep the existing blank-template messaging, and add a clearly primary CTA — "Use a default template" or similar, matching this file's existing button styling. On click: call `GET /api/config/coa/templates`, show the 3 options (name + description), pre-highlight `suggested_template_id` if present. RECOMMEND reusing this file's existing modal pattern (Add GL / Edit GL / dimension-requirement modals already use one — match it) rather than inline cards; state your choice. On confirm: call `POST /api/config/coa/adopt-template`, then re-run the existing accounts-fetch function (confirmed in Step 0, ~line 398) so the table populates and the empty state disappears on its own (no manual state patching needed).

**Classification constants** (~lines 120-142, confirm exact current lines in Step 0): add exactly 3 new values — `"Revenue — service fees"` to `PL_CLASSIFICATIONS`, `"Contract asset — unbilled revenue"` and `"Contract liability — deferred revenue"` to `BS_CLASSIFICATIONS`. Do **not** add a 4th `"Other income"` value — that is a separate, still-open, non-blocking question with Adeniyi (Section 8, item 5 of the draft doc). Only add it if that doc shows it confirmed by the time you read it; otherwise leave it out.

---

## Files CC may modify/create

- `backend/alembic/versions/<new>.py` (NEW — tables + seed)
- `backend/app/models/master_data.py` (NEW: `CoaTemplate`, `CoaTemplateAccount` models; register for metadata same way `ChartOfAccount` etc. already are)
- `backend/app/schemas/config.py` (NEW schemas, additive only)
- `backend/app/routers/config.py` (NEW: `_adopt_coa_template`, `POST /coa/adopt-template`, `GET /coa/templates`; MODIFIED: `download_coa_template` prefill logic only)
- `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx` (empty-state CTA + new modal + classification constants — additive)

Do NOT touch: `tenant_clone.py`, `gl_posting.py`, `account_mapping.py`/`account_determination.py`, period engine, any other setup page, `main.py` (no new router file, so no registration change needed — confirm this holds), CORS.

---

## House rules

- No `tenant_id` accepted from any request body anywhere in this brief's new code — always derived from the authenticated session, same pattern as every other CoA endpoint.
- `coa_templates` / `coa_template_accounts` carry no `tenant_id` column at all, by design — this is what makes cross-tenant leakage structurally impossible, not just policy-enforced.
- Seed data copied verbatim from `docs/DEFAULT_COA_TEMPLATES_DRAFT.md` Sections 2/3/4 — no re-deriving, inventing, or dropping rows. If something looks wrong, report it, don't fix it silently.
- Every `account_classification` value in the seed data must be a real member of `PL_CLASSIFICATIONS`/`BS_CLASSIFICATIONS` after the 3 additions — verified in Step 0, re-verify after seeding (e.g. a quick distinct-values check against the two lists).
- `locked_by_implementation = False` on every adopted row — no locking post-adoption.
- Migration up/down clean.
- `npm run type-check` = 0 errors on the frontend change.

---

## Acceptance / test steps (state pass/fail each — via script)

1. Migration up/down clean. `coa_templates` has exactly 3 rows. `coa_template_accounts` row counts match the draft doc's table row counts per template — state the counts found vs. expected.
2. `GET /api/config/coa/templates` returns all 3 with correct `account_count` and a sensible `suggested_template_id` for at least one test tenant with a matching industry set.
3. `POST /api/config/coa/adopt-template` on a tenant with zero CoA rows creates exactly N accounts (N = that template's `account_count`), all `tenant_id`-scoped to that tenant only, `locked_by_implementation=false`, `is_active=true`.
4. Same call on a tenant that already has ≥1 CoA row → 409, zero rows created.
5. An adopted account can still be edited via `PATCH /coa/{gl_id}` and the tenant can still add a brand-new account via `POST /coa` afterward (confirms decisions 1-2 from the draft doc hold after adoption, no regression).
6. `download_coa_template` for a tenant with existing accounts returns Sheet 1 pre-filled with those accounts' current data including dimension requirements; for a tenant with zero accounts, returns today's blank template, byte-for-byte unchanged in structure.
7. Re-uploading a downloaded, unedited pre-filled template via `upload_coa` is a no-op — no duplicate rows, no value changes (confirms upsert-by-GL-Number + blank-preserves-value logic still holds with the new prefill).
8. Frontend: empty-state CTA shows only when `accounts.length === 0`; choosing a template and confirming populates the table and the CTA disappears; classification dropdowns include the 3 new values.
9. `npm run type-check` → 0 errors.

---

## Completion summary required

List every file created/changed. State: the exact migration revision id and the head it chained off (old → new); seed row counts per template (found vs. expected from the doc); confirmation that no `account_classification` value needed substitution; confirmation that no `tenant_id` leakage path exists and how that's structurally guaranteed; the guard used on the two new endpoints; the modal-vs-inline choice for the template picker and why; whether the 4th "Other income" classification value was added (and why/why not, based on what the draft doc showed at the time); whether `main.py` needed any change (expected: no). Report acceptance pass/fail for all 9 steps.
