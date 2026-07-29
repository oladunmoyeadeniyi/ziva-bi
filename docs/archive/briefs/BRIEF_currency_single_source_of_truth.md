Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Currency single source of truth: consolidate to tenant_org_config

**Principle:** ONE source of truth for currency. `tenant_org_config` becomes the authoritative store for **functional currency + enabled (additional) currencies**. `tenant_fx_config` keeps ONLY FX-specific data (rates, per-category revaluation GLs) — it must NOT store the currency list or functional currency anymore. Every screen reads currencies from the one source. Existing split/duplicated data is migrated so it's consistent. This prevents production bugs from disagreeing sources (e.g. the bank dropdown missing USD).

---

## STEP 0 — Read before changing anything (mandatory) — REPORT, do not edit yet
Investigate and report fully BEFORE any change:
- The `tenant_org_config` model + table: every currency-related field (functional_currency, any currency list?). Report fields + current Red Bull values.
- The `tenant_fx_config` model + table: functional_currency, reporting_currency, additional_currencies, rates, any per-category revaluation GL config. Report fields + current Red Bull values.
- Any OTHER place currencies are stored/derived (e.g. a transactions/currencies table, expense currency, bank account currency). List them all.
- Every backend endpoint that READS or WRITES functional currency / enabled currencies (search: functional_currency, additional_currencies, reporting_currency, /api/setup/currencies, /api/setup/org). List each + which table it touches.
- Every frontend page that reads/writes currencies (Org/Organisation tab, Currencies & FX tab, bank-accounts, expense forms, anywhere a currency dropdown appears). List each + its data source.
- The exact discrepancy for Red Bull: what functional currency + which additional currencies each table currently holds (this is why USD is missing from the bank dropdown).
**Report all of the above before editing. If the right consolidation differs from this brief's assumptions once you see the data, say so and propose the correct plan.**

---

## TARGET (after consolidation)
- `tenant_org_config` holds: `functional_currency` (single code) + `enabled_currencies` (the full list of currencies the tenant transacts in, INCLUDING the functional one — or functional + additional; choose a clear representation and state it). This is THE source.
- `tenant_fx_config` holds: ONLY FX mechanics — exchange rates, reporting_currency (if distinct from functional, but it should reference the org source for validation), per-category revaluation GL config. It must NOT be the place the currency LIST is read from. If reporting_currency is genuinely an FX concept, keep it here but ensure it's validated against the org-config enabled set.
- One canonical read API for "this tenant's currencies" that every screen uses (e.g. GET /api/setup/currencies returns functional + enabled, sourced from tenant_org_config). State the final endpoint contract.

---

## CHANGES
1. **Schema:** ensure tenant_org_config has functional_currency + enabled_currencies (add enabled_currencies if missing; JSONB list of codes). Migration additive.
2. **Migrate data:** backfill tenant_org_config.enabled_currencies for existing tenants by MERGING whatever currencies currently exist across tenant_fx_config (additional_currencies, reporting), bank_accounts.currency in use, and functional — so no tenant loses a currency. For Red Bull specifically, ensure NGN + USD + EUR all end up in the org-config enabled list (report the before/after). 
3. **Reads:** point every currency read (the canonical endpoint + any page-specific fetch) at tenant_org_config. The bank-accounts dropdown, Currencies & FX tab, expense forms — all read the one source.
4. **Writes:** the Organisation/Org setup tab is where functional + enabled currencies are MANAGED (added/removed). The Currencies & FX tab stops owning the currency LIST — it manages rates/revaluation GLs against the enabled set from org config. (If the Currencies & FX tab currently lets you add currencies, move that to Org config OR have it write through to the org-config source — state your approach; the key rule: one writer of truth.)
5. **Deprecate the duplicate:** stop reading functional currency / currency list from tenant_fx_config. If tenant_fx_config.functional_currency / additional_currencies columns become redundant, either drop them (migration) or clearly mark them deprecated and stop all reads/writes — state which (prefer dropping if nothing else needs them, but only after backfill is verified).
6. Update the earlier bank-accounts multi-source workaround to simply read the one canonical source now.

---

## Files CC may modify
- Models: tenant_org_config, tenant_fx_config (currency fields).
- Migration(s): add enabled_currencies, backfill, optionally drop redundant fx columns.
- Routers: the currencies endpoint(s), org endpoint, anything reading currency.
- Frontend: bank-accounts page (read canonical source), Currencies & FX page, Organisation page, the shared currencies helper — all to one source.

Do NOT: touch GL/posting, account-mapping, period logic beyond currency reads, `config.py`/`ziva_dev`, CORS. Don't break expense/bank currency usage — they must read the consolidated source.

---

## House rules
- ONE source of truth (tenant_org_config) for functional + enabled currencies. No screen reads the currency LIST from anywhere else.
- No tenant loses a currency in migration (merge before switching the source).
- Migrations up/down clean. type-check 0.
- After this, adding a currency in ONE place reflects everywhere.

---

## Acceptance / test steps (state pass/fail each)
1. Report: the before-state of currencies across all tables for Red Bull (proving the split).
2. After migration: tenant_org_config.enabled_currencies for Red Bull contains NGN + USD + EUR (all that existed anywhere).
3. Bank-accounts currency dropdown shows NGN + USD + EUR (sourced from org config).
4. Currencies & FX tab shows the same set, sourced from org config; managing rates still works.
5. Adding/removing a currency in the designated place reflects on the bank dropdown + FX tab + expense forms (one source).
6. No read of the currency list from tenant_fx_config remains (grep clean); redundant fx columns dropped or marked deprecated with no live reads.
7. Migrations up/down clean; type-check 0.

---

## Completion summary required
List every file changed. State: the full STEP 0 findings (all currency stores + readers/writers + Red Bull's before-state); the final representation in tenant_org_config; how data was merged/backfilled (Red Bull before/after); what happened to tenant_fx_config's currency fields (dropped vs deprecated); the canonical read endpoint contract; confirmation that NO screen reads the currency list from anywhere but the one source; migrations clean; type-check 0. Report acceptance pass/fail.
