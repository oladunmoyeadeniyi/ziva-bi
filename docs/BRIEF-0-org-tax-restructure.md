# BRIEF 0 — Organisation & Tax restructuring (pre-M8.3)

## Purpose
Prepare the ground for M8.3 Period Management by removing two sections out of the
Organisation page's **Configuration** tab and relocating them:

1. **Fiscal year settings** → leave the Organisation page entirely. They will become
   the first section of the new **Period Management** page (built in a later brief —
   NOT in this brief). For now, just remove them cleanly from Organisation.
2. **Tax applicability** (the "which taxes apply to this tenant" checklist) → move into
   the existing **Tax & statutory** page as a new **first tab**, which gates the other
   tabs (VAT / WHT / PAYE / Other statutory).

After this brief, the Organisation **Configuration** tab is **flattened** — no sub-tabs.
Only **Financial features** and **Governance** content remain, shown stacked on one page.

This brief is **frontend + light backend wiring only**. No new DB tables. No period engine.
No new Period Management page yet. Do not build any of M8.3 here.

---

## STEP 0 — Read before changing anything (mandatory)
Do NOT edit from assumption. First open and read these files in full, and report back
the exact file paths and the line ranges you intend to change BEFORE editing:

- `frontend/src/app/dashboard/business/setup/organisation/page.tsx` (Configuration tab lives here)
- The Tax & statutory page (route `/dashboard/business/setup/tax`) — find its actual file
  under `frontend/src/app/dashboard/business/setup/` and read it fully.
- The sidebar / navigation component that renders the "FINANCIALS" group (Dimensions,
  Chart of accounts, Currencies & FX, Tax & statutory). Find it, read it. Do NOT add a
  Period Management nav item in this brief.
- Backend `setup.py` router + `setup.py` schema + `TenantOrgConfig` model — to understand
  how `org_configuration` (incl. `tax_items`, `is_tax_haven`) and the fiscal_year_* fields
  are currently saved, before moving where they're edited in the UI.

If anything below conflicts with what the real code shows, STOP and report the conflict —
do not silently work around it.

---

## ALLOWED FILES (you may modify ONLY these)
- `frontend/src/app/dashboard/business/setup/organisation/page.tsx`
- The Tax & statutory page file (the real one you locate at route `/dashboard/business/setup/tax`)
- Backend: ONLY if a save endpoint must accept tax_items / is_tax_haven from the Tax &
  statutory page instead of (or in addition to) the Organisation page. If a backend change
  is needed, list it explicitly in your plan in STEP 0 and keep it minimal. Do NOT rename
  `ziva_dev`, do NOT touch CORS in `main.py`.

If you believe any other file must change, STOP and ask first.

---

## CHANGE 1 — Flatten the Organisation Configuration tab
In `organisation/page.tsx`:

- The Configuration tab currently has a sub-tab bar with 4 sub-tabs:
  `fiscal | features | tax | governance` (type `ConfigSubTab`).
- **Remove the `fiscal` and `tax` sub-tabs entirely** from this page (their content moves
  per Change 2 and Change 3 — for `fiscal`, the content is simply deleted here since it
  will be rebuilt on the Period Management page later; for `tax`, the content moves to the
  Tax & statutory page per Change 3).
- **Remove the sub-tab bar.** The remaining two sections — **Financial features** and
  **Governance** — should now render **stacked vertically on one page** (features on top,
  a divider, then governance), no tabs.
- Remove now-unused state/type: the `ConfigSubTab` type, `configTab` / `setConfigTab`
  state, and the sub-tab button row. Keep `config` / `setConfig` and the features +
  governance JSX and their Save buttons working exactly as before.
- The fiscal-year-related fields on the `OrgConfig` interface (`fiscal_year_start_month`,
  `fiscal_year_start_day`, `fiscal_year_name_format`, `period_closing_frequency`) and the
  `FiscalPeriod` interface, the periods table, `generatePeriods`, `genLabel`, the
  `/api/setup/fiscal-periods` calls — REMOVE their UI from this page. Leave the backend
  fields/endpoints intact (Period Management will use them later); we are only removing the
  Organisation-page UI that edits them. If removing the UI leaves dead imports/state, clean
  them up.

Do NOT touch the Identity, Structure, or Branding tabs.

---

## CHANGE 2 — Do NOT build Period Management here
Just confirm in your summary that fiscal-year UI was removed from Organisation and that the
underlying backend fields/endpoints were left intact for the future Period Management page.
No new page, no new route, no new nav item in this brief.

---

## CHANGE 3 — Tax applicability becomes the gating first tab on Tax & statutory
On the Tax & statutory page (route `/dashboard/business/setup/tax`):

Current tabs (from live screenshot): **VAT · WHT · PAYE · Other statutory**.

- Add a NEW first tab: **"Applicability"** (label it "Tax applicability" if it fits).
  Make it the default selected tab.
- Move the tax-applicability UI **out of** Organisation/Configuration's `tax` sub-tab and
  **into** this new Applicability tab. That UI includes: the zero-tax/tax-haven checkbox
  (`is_tax_haven`), the country-based collapsible tax groups, the per-tax checkboxes, and
  the "Add a custom tax" control. Reuse the existing logic/state — move it, don't rewrite
  it from scratch. Flag any helper it depends on (`getTaxGroupsForItems`, `TAX_PROFILES`,
  `makeTax`, `collapsedTaxGroups`, etc.) and move/import those cleanly rather than
  duplicating.
- **Gating behaviour:** the VAT / WHT / PAYE / Other statutory tabs should only be
  selectable/visible when the corresponding tax is marked applicable on the Applicability
  tab. Specifically:
  - VAT tab visible only if a VAT-type tax is checked applicable.
  - WHT tab visible only if a WHT-type tax is checked applicable.
  - PAYE tab visible only if a PAYE/employment-type tax is checked applicable.
  - "Other statutory" tab: visible if any other applicable tax exists (or always — your call,
    but state which you chose and why in the summary).
  - If you cannot cleanly map a tax_item to a tab, do NOT guess — note it in the summary and
    default that tab to visible, so nothing is hidden incorrectly.
- Saving applicability must persist the same way it did from Organisation (same
  `org_configuration.tax_items` / `is_tax_haven` shape). Verify the save round-trips by
  reading the backend save path in STEP 0. If the Organisation page was the only place that
  saved these, wire the save here instead.

---

## CONSTRAINTS / HOUSE RULES
- `npm run type-check` must show **zero errors** before any commit.
- DB name stays `ziva_dev` in `config.py`. CORS stays hardcoded `http://localhost:3000` in
  `main.py`. Do not change either.
- Do not make unrequested UI changes to Identity/Structure/Branding or to the existing
  VAT/WHT/PAYE/Other tab internals (only their visibility gating changes).
- Reuse components/helpers; do not duplicate. Flag any shared helper you move.
- In your completion summary, **list every file changed** and, for each, the specific
  sections changed.

## Acceptance test (state pass/fail for each)
1. Organisation → Configuration tab shows NO sub-tabs; Financial features and Governance
   render stacked, both save correctly.
2. Organisation → Configuration has NO fiscal year section and NO tax applicability section.
3. Tax & statutory → first tab is Applicability; tax-haven, country groups, checkboxes, and
   custom-tax all work and save.
4. VAT/WHT/PAYE/Other tabs appear only when their tax is marked applicable; toggling
   applicability shows/hides them correctly.
5. `npm run type-check` = 0 errors.
