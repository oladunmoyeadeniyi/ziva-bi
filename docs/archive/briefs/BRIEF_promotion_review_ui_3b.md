Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Phase 3b: CoA/Dimensions promotion review UI

**Context:** Phase 3a built the backend diff/apply engine (`POST /api/platform/tenants/{id}/promotion/diff` and `.../promotion/apply`, both Super Admin only, super-admin-gated, requiring a test shadow). This phase builds the review screen: fetch the diff, render it grouped by entity type with collapsible sections, color-coded by change type (CREATE green / UPDATE amber with field-level before-after / DEACTIVATE red), let the admin accept individual items or all, then call apply with the accepted item ids.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/schemas/platform.py` — exact shape of `PromotionDiffItem`, `PromotionDiff`, `PromotionApplyRequest`, `PromotionApplyResult` (field names, types) so the frontend types match exactly.
- `backend/app/routers/platform.py` — the two new endpoints' exact request/response handling, and the diff item_id scheme confirmed: `coa:{gl_number}`, `dim:{code}`, `dimval:{dim_code}:{val_code}`, `glreq:{gl_number}:{dim_code}`, `accmap:{role_key}`.
- `frontend/src/app/platform/tenants/[id]/page.tsx` — the Phase 2 "Promote configuration" section (org/tax/fx) added last brief — confirm its current layout/style so this new CoA/Dimensions promotion UI sits consistently (likely as an additional action in the same Test Environment area, or a separate "Promote Master Data" sub-flow — your call on placement, state why).
- Confirm whether the existing Phase 2 promote dialog component can be extended/reused, or whether this needs its own component given the much richer diff content (recommend a NEW dedicated component given the complexity — state your choice).
Report findings before editing.

---

## Build

### Entry point
On the tenant detail page, where the test shadow + Phase 2 promote section already exists, add a new action: "Review & promote master data" (or similar) — distinct from the existing simple org/tax/fx promote button. Only visible when a test shadow exists (same gating as Phase 2).

### Diff review screen (new component, e.g. `PromotionReviewDialog` or a dedicated route — your call, state which; a modal/dialog is likely fine given Phase 2's pattern, but if the diff is large a dedicated page may render better — decide based on what STEP 0 reveals about expected diff size, default to dialog unless you have a clear reason not to)
On open: call `POST .../promotion/diff`, show a loading state, then render:
- **Grouped by entity type, collapsible sections**, in this order: Dimensions, Chart of Accounts, Dimension Values, GL Dimension Requirements, Account Mappings. Each section header shows counts (e.g. "Chart of Accounts — 3 to create, 1 to update, 1 to deactivate").
- Within each section, list items color-coded:
  - **CREATE** (green): show the new item's key fields (e.g. gl_number + gl_name for CoA).
  - **UPDATE** (amber): show field-level before → after for every field that differs (e.g. "gl_name: 'Bank Charges' → 'Bank Charges (NGN)'"). Only show fields that actually changed, not the full row.
  - **DEACTIVATE** (red): show the item being deactivated, with a clear "this account will be deactivated in live" note.
- Each item has its own checkbox (default: checked/accepted), so the admin can deselect individual items.
- Section-level "select all / deselect all" control. Page-level "Accept all" button. Empty state if a section has zero changes (hide the section or show "No changes").
- A live/test tenant name header so it's unambiguous which promotion this is.
- Footer: count of accepted items, "Cancel" and "Promote N accepted changes" buttons.

### On confirm
Call `POST .../promotion/apply` with the accepted item ids (collected from checked items across all sections). Show the result (`PromotionApplyResult` — counts created/updated/deactivated per entity) as a success summary. Handle errors clearly (e.g. if apply fails, show the error, don't silently close).

### Empty diff case
If the diff returns zero changes across all sections, show a clear "Live is already up to date with test" message instead of an empty review screen.

---

## Files CC may modify
- `frontend/src/app/platform/tenants/[id]/page.tsx` — entry point/trigger.
- NEW component file(s) for the review dialog/page — state exact path(s).
- Shared types file if one exists for platform API types — extend with the new schemas; otherwise inline types matching the backend schemas exactly.

Do NOT: touch the backend (Phase 3a is done and tested), the Phase 2 org/tax/fx promote flow (leave it as-is, this is additive), CoA/Dimension CRUD pages elsewhere in the app.

---

## House rules
- Diff is fetched fresh on every open (no caching across sessions).
- Default: all items checked/accepted; admin can deselect.
- Color coding: CREATE green, UPDATE amber w/ field-level diff, DEACTIVATE red.
- Grouped by entity type, collapsible, in the stated order.
- Apply only sends the ACTUALLY accepted item ids — confirm the frontend doesn't just send "all" blindly even when "accept all" was clicked (it should still send the explicit list, since the backend recomputes anyway, but be precise about what's sent).
- type-check 0 errors.

---

## Acceptance / test steps (state pass/fail each)
1. Opening the review on a tenant with various CREATE/UPDATE/DEACTIVATE changes renders all three categories correctly grouped and color-coded.
2. UPDATE items show only the changed fields, before → after.
3. Deselecting individual items + confirming → apply called with only the remaining accepted ids; verify via the apply result that exactly those were applied.
4. "Accept all" → all items sent; apply result matches full diff counts.
5. Empty diff → clear "already up to date" message, no broken empty sections.
6. Apply error handled gracefully (shown to user, dialog stays open).
7. Entry point only visible when a test shadow exists; gating consistent with Phase 2.
8. type-check 0 errors.

---

## Completion summary required
List every file created/changed. State: where the entry point was placed and why; dialog vs page choice and why; the exact accepted-ids collection logic; confirm field-level diff rendering for UPDATE items; confirm empty-diff handling; confirm error handling on apply. Report acceptance pass/fail.
