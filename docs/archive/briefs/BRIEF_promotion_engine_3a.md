Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Phase 3a: CoA/Dimensions promotion engine (diff + apply, backend only)

**Context:** Extends the existing test→live promote feature (Phase 1+2 done: org_config/tax/fx promote via simple field copy). This phase adds promotion for Chart of Accounts, Dimensions, Dimension Values, GL Dimension Requirements, and Account Mappings — multi-row, FK-laden data requiring natural-key matching (no UUID remapping table; confirmed reliable via docs/diagnosis_promotion_schema.md). Unlike Phase 2, this is NOT a blind copy — it's a two-step **diff (preview) → apply (accept selected changes)** flow, because changes can include deactivations that must be reviewed before hitting live. Periods are explicitly OUT of scope (handled via existing org_config promotion + "Generate periods" — no new logic needed).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/master_data.py` — exact current `ChartOfAccount`, `TenantDimension`, `DimensionValue` definitions (confirm against docs/diagnosis_promotion_schema.md — re-verify nothing changed since that report).
- `backend/app/models/account_mapping.py` — `GLDimensionRequirement` (full columns — NOT fully shown in the diagnosis excerpt, read it directly), `TenantAccountMapping`.
- `backend/app/routers/tenant.py` — the existing `promote()` function in full: guard conditions, request/response schema (`PromoteRequest{sections}`, `PromoteResponse{promoted,deferred,message}`), `_DEFERRED_SECTIONS`, and exactly how it identifies the live tenant from the test tenant's `parent_tenant_id`. This new engine must follow the same calling convention/guard pattern (caller must be authenticated as the TEST tenant; verify this matches Phase 2's proxy pattern too).
- `backend/app/routers/platform.py` — the two Phase 2 proxy endpoints (`test-environment`, `promote`) added last brief, to confirm the calling pattern this new feature should match (Super Admin calls via platform proxy, inlining tenant-router logic).
- Confirm `DimensionValue.cascade_value_id` exact column (mentioned in diagnosis as the one self-referential FK) — read the exact field name/type/FK target.
Report findings before editing.

---

## Design (follow exactly; this is the agreed algorithm)

### Matching strategy
**Natural keys, in-memory mapping per promotion run — no persistent ID-mapping table.**
- ChartOfAccount: match on `(tenant_id, gl_number)` among ACTIVE test rows (per the partial-unique-index semantics — only active rows are unique, so only active test rows are eligible to match/promote).
- TenantDimension: match on `(tenant_id, code)` among active test rows.
- DimensionValue: match on `(tenant_id, dimension_id[resolved], code)` among active test rows.
- GLDimensionRequirement: resolved via the already-mapped gl_id + dimension_id (no independent natural key of its own — depends on CoA+Dimension promotion having run first in this same call).
- TenantAccountMapping: match on `(tenant_id, role_key)`; resolve `gl_account_id` via the CoA gl_number map.

### Two-step flow: PREVIEW (diff) then APPLY

**Step 1 — `compute_promotion_diff(db, test_tenant_id, live_tenant_id) -> PromotionDiff` (read-only, no writes)**
For each of the 5 entities (TenantDimension, ChartOfAccount, DimensionValue, GLDimensionRequirement, TenantAccountMapping), in that dependency order, compute:
- **CREATE**: active test rows with no matching live row (by natural key) → would be newly created in live.
- **UPDATE**: active test rows matching an existing live row where any promotable field differs → show field-level before/after.
- **DEACTIVATE**: live rows that are active, whose natural key corresponds to a test row that is now INACTIVE (or whose test row was deleted entirely — treat "no longer present as active in test" as deactivate-candidate) → would be deactivated in live.
- **UNCHANGED**: matched rows with no field differences — do not include in the diff output (no review needed).
Build the in-memory test_id→live_id map AS PART OF computing the diff (needed to resolve dependent entities like DimensionValue→TenantDimension, GLDimensionRequirement→both, TenantAccountMapping→CoA) — this map is internal to the function call, not persisted.
Return a structured diff: for each entity type, lists of CREATE/UPDATE/DEACTIVATE items, each with a stable item identifier (e.g. natural key string) the frontend can reference when accepting/rejecting, plus the relevant before/after field values for display.

**Step 2 — `apply_promotion(db, test_tenant_id, live_tenant_id, accepted_item_ids) -> PromotionApplyResult` (writes)**
- Recompute the diff fresh (do NOT trust a diff passed from the client — recompute server-side to avoid stale/tampered data, then filter to only the items whose identifier is in `accepted_item_ids`).
- Apply in the same dependency order: TenantDimension → ChartOfAccount → DimensionValue (two-pass: insert/update all with `cascade_value_id=NULL` first using the id-map being built, THEN a second pass to set `cascade_value_id` on rows that need it, using the now-complete id-map) → GLDimensionRequirement → TenantAccountMapping.
- CREATE → insert new live row (fresh id), record test_id→live_id mapping for use by dependent steps in the SAME apply call.
- UPDATE → update the matched live row's fields in place (live row keeps its own id).
- DEACTIVATE → set `is_active=False` on the live row (never hard-delete).
- All-or-nothing: wrap in the existing transaction (the router's get_db commit/rollback pattern) — if anything fails partway, full rollback.
- Return a summary: counts created/updated/deactivated per entity type, plus enough detail for an audit log entry.
- Audit log: one entry per apply call (e.g. `"platform.promotion.config_applied"`) with tenant_id, counts per entity, accepted_item_ids count.

### Guard / calling convention
Match the existing pattern: only reachable via the Super Admin platform proxy (extend the Phase 2 proxy endpoints or add two new ones — `POST /api/platform/tenants/{id}/promotion/diff` and `POST /api/platform/tenants/{id}/promotion/apply` — your call on whether to extend existing or add new, state which and why), guarded `is_super_admin`, operating on a tenant that has a test shadow (`environment="live"` with a resolvable test child).

---

## Files CC may modify
- NEW `backend/app/services/promotion_engine.py` (recommended — keeps this substantial logic out of routers, matches the pattern of gl_posting.py/account_determination.py being separate services).
- `backend/app/routers/platform.py` — new proxy endpoint(s) for diff/apply (or extend existing promote proxy — state choice).
- `backend/app/schemas/` — new schemas for PromotionDiff, PromotionApplyResult, the per-item diff entry shape.

Do NOT: touch the existing org_config/tax/fx promote logic (Phase 2, working), CoA/Dimension CRUD routers themselves, GL posting, account determination resolver, periods logic. No frontend in this brief (3b). No migration expected (no schema change — confirm).

---

## House rules
- Diff is read-only; apply recomputes server-side from accepted_item_ids (never trusts client-supplied diff data).
- Dependency order respected; two-pass for cascade_value_id.
- Only ACTIVE test rows are CREATE/UPDATE candidates; DEACTIVATE only ever sets is_active=False, never deletes.
- All-or-nothing per apply call.
- Periods untouched/out of scope.
- Audit log entry on every apply.

---

## Acceptance / test steps (state pass/fail each — use the dedicated Ziva BI Test Tenant's own test shadow if one can be created, or clearly state how you isolated this test from any real tenant data)
1. Diff on a live tenant with NO existing CoA/dimensions, test tenant with several active accounts/dimensions/values → all show as CREATE; correct dependency order in output.
2. Apply that diff (accept all) → live now has matching rows; re-running diff afterward shows UNCHANGED (no diff) for those items.
3. Modify a field on a test CoA row (e.g. gl_name) → diff shows UPDATE with correct before/after; apply updates only that field on the matched live row (same live id preserved).
4. Deactivate a test CoA row → diff shows DEACTIVATE for the corresponding live row; apply sets is_active=False on live (not deleted).
5. Partial accept: diff returns 5 changes, apply called with only 2 accepted_item_ids → only those 2 applied; the other 3 untouched and still appear in the next diff.
6. DimensionValue with a cascade_value_id reference: diff + apply correctly creates both values and wires the cascade reference (2-pass verified — no FK violation).
7. TenantAccountMapping correctly resolves to the NEW live gl_account_id after CoA promotion (not the test tenant's id).
8. Apply failure mid-way (simulate, e.g. invalid data) → full rollback, nothing partially applied.
9. Non-super-admin → 403.
10. Backend imports clean; no migration.

---

## Completion summary required
List every file created/changed. State: exact endpoint routes added; the diff item identifier scheme; how the in-memory id-map works across the 5 entity types within one apply call; the 2-pass cascade_value_id handling; confirm recompute-on-apply (not trusting client diff); confirm all-or-nothing; confirm periods untouched. Report acceptance pass/fail with specifics (actual before/after values from a real test run).
