Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Account Mapping UI rework: nested collapsible taxonomy + control toggle + dropdown fix

**Scope:** Frontend only. Rework the existing account-mapping page to the new statement→group→subgroup taxonomy with collapsible sections, add the per-tenant control-account toggle (super admin only), and fix the GL picker dropdown that renders behind the next card (z-index). Wires to the redesigned backend already built.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/dashboard/business/setup/account-mapping/page.tsx` — current page (flat groups, inline GLPicker, progress, per-row save). Report the GLPicker + how the dropdown is positioned (the z-index bug: dropdown hides under the next card — likely needs a higher z-index and/or the parent card needs `overflow-visible`, or the dropdown should render with position handling that escapes clipping).
- `backend/app/routers/account_mapping.py` GET /roles — confirm it now returns: statement, group, subgroup, display_order, label, expected_account_type, is_control_account, is_control_account_override, is_control_account_effective, description, gl_account_id/number/name. Report the exact shape.
- The control endpoint: PUT /api/setup/account-mapping/{role_key}/control body { is_control_account: bool | null } (null clears override). And confirm it's super-admin-gated server-side.
- `frontend/src/contexts/AuthContext.tsx` — how to tell if current user is super admin (is_super_admin, including impersonating) so the control toggle is shown only to them.
Report findings before editing.

---

## Build

### A. Nested collapsible layout
Replace the flat group list with a 2-level (really 3-level) nested structure driven by the API fields:
- **Statement level:** two top sections — "Balance Sheet" (BS) and "Profit & Loss" (PL). Collapsible.
- **Group level:** within each statement, collapsible groups using readable labels mapped from the `group` key (e.g. current_assets → "Current Assets", current_liabilities → "Current Liabilities", non_current_liabilities → "Non-Current Liabilities", equity → "Equity", suspense → "Suspense & Clearing", cost_of_sales → "Cost of Sales", etc.). Provide a key→label map; fall back to a title-cased key if unmapped.
- **Subgroup level:** within a group, optionally a lighter sub-heading from `subgroup` (e.g. receivables → "Receivables", payables → "Payables", accruals_provisions → "Accruals & Provisions", inventory → "Inventory", tax → "Tax", cash_bank → "Cash & Bank", equity, suspense). If subgroup is null, list roles directly.
- Order roles by `display_order` within each subgroup/group.
- Each statement/group shows a small "X of Y mapped" count for its scope. Keep the overall "X of N mapped" progress at the top.
- Default expand state: expand groups that have unmapped roles (so attention is drawn), or expand all — state your choice; make it not feel collapsed-and-hidden.

### B. Role row (per role)
- Label + expected-type hint ("Balance Sheet"/"Income statement"/"Either" from expected_account_type) + a **control tag** when is_control_account_effective is true.
- The searchable GL picker (keep the existing combobox behaviour: type to filter number/name, account-type pre-filter BS→{BS,SOFP}/PL→{PL,SOCI} with "show all", select → PUT, clear → DELETE). Mapped/unmapped visual state. Inline API validation errors.
- **Control toggle** (only rendered if current user is_super_admin): a small switch/checkbox "Control account". 
  - Reflects is_control_account_effective. 
  - Changing it calls PUT /{role_key}/control with the new bool. 
  - Provide a way to clear the override back to catalogue default (e.g. a tiny "reset to default" link shown when an override is set, i.e. is_control_account_override !== null) → PUT with { is_control_account: null }.
  - After change, refresh the role (or list) so effective flag + tag update.
- Non-super-admins: see the control tag (read-only) but NOT the toggle.

### C. Fix the dropdown z-index bug
The GL picker dropdown currently renders behind the following card. Fix so the open dropdown sits above sibling cards/sections:
- Likely: raise the dropdown's z-index AND ensure no ancestor clips it (`overflow-hidden`/`overflow-auto` on a parent card will clip an absolutely-positioned dropdown). Options: make the dropdown container `z-50` (or higher) and ensure the role-row/card uses `overflow-visible`; or render the dropdown in a portal; or use a popover that escapes clipping. Choose the simplest robust fix and state it. Verify an open dropdown near the bottom of a group overlaps the next group cleanly.

Keep existing setup-page design language. Responsive enough not to break narrow.

---

## Files CC may modify
- `frontend/src/app/dashboard/business/setup/account-mapping/page.tsx` (rework)
- Optional: extract the GLPicker / a CollapsibleSection / ControlToggle into `frontend/src/components/` if it keeps the page clean — state if added.

Do NOT: touch backend, other setup pages, AppHeader, `config.py`, CORS.

---

## House rules
- `npm run type-check` = 0 errors.
- Nested collapsible by statement→group→subgroup, readable labels, ordered by display_order.
- Control toggle only for super admins; reset-to-default available when an override exists; non-super-admins see the tag read-only.
- Dropdown no longer hides under the next card.
- All actions wired to real endpoints; inline validation surfaced.

---

## Acceptance / test steps (state pass/fail each)
1. Page renders Balance Sheet + P&L sections, each with collapsible groups and subgroups; readable labels; roles ordered.
2. Per-scope and overall "X of Y mapped" counts correct.
3. GL picker dropdown opens ABOVE the following card (z-index fixed), including near a section boundary.
4. Mapping/unmapping works (PUT/DELETE); account-type mismatch surfaced inline.
5. As super admin: control toggle shows, flips is_control_account_effective via PUT /control; reset-to-default clears override; tag updates.
6. As a non-super-admin (e.g. power_admin): control tag shows read-only, no toggle.
7. type-check 0 errors.

---

## Completion summary required
List every file changed/created. State: the group/subgroup key→label maps used; default expand behaviour; the z-index fix approach (and that you verified overlap near a boundary); how super-admin gating of the toggle is determined client-side; how reset-to-default works; confirm all wired to real endpoints; confirm no backend touched. Report acceptance pass/fail.
