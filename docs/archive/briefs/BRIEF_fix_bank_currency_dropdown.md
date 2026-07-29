Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Fix: Bank accounts currency dropdown shows only NGN (use full enabled-currency set)

**Problem:** On `/dashboard/business/setup/bank-accounts`, the currency dropdown only lists NGN (the functional currency). Red Bull also has USD + EUR (in additional_currencies). The dropdown must show the tenant's FULL enabled currency set — the same source/selector used by the Currencies & FX tab.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/dashboard/business/setup/bank-accounts/page.tsx` — how it currently builds the currency options (it likely reads only functional_currency from GET /api/setup/currencies, missing additional_currencies).
- `frontend/src/app/dashboard/business/setup/currencies/page.tsx` (the Currencies & FX tab) — how IT builds its currency list/selector (functional_currency + additional_currencies, and any shared currency library/component or constant it uses). Report the exact source + any reusable component.
- The backend `GET /api/setup/currencies` response shape — confirm it returns functional_currency + additional_currencies (JSONB list). Report the exact fields.
Report findings before editing.

---

## Fix
1. In the bank-accounts form, build the currency dropdown from the tenant's FULL enabled set = functional_currency + every code in additional_currencies (deduplicated, functional first or sorted — state choice). Not just functional.
2. If the Currencies & FX tab uses a shared currency selector component or a currency library/constant (names, symbols), REUSE the same thing here for consistency (labels like "USD — US Dollar"). If it's inline, extract a tiny shared helper or replicate the exact same list source — state what you did. Prefer reuse over duplication.
3. Keep everything else on the page unchanged (GL picker, default handling, list).

Edge: if only one currency is enabled, the dropdown shows just that — fine. If additional_currencies is empty/missing, fall back to functional only without erroring.

---

## Files CC may modify
- `frontend/src/app/dashboard/business/setup/bank-accounts/page.tsx`
- Optionally a small shared currency helper/component in `frontend/src/` if it removes duplication between Currencies & FX and bank-accounts — state if added.

Do NOT: touch backend, the currencies setup page's own behaviour, other pages, `config.py`, CORS.

---

## House rules
- `npm run type-check` = 0 errors.
- Dropdown reflects the tenant's full enabled currencies (functional + additional).
- Reuse the Currencies & FX source/selector; avoid duplicating a currency list.

---

## Acceptance / test steps (state pass/fail each)
1. With Red Bull having NGN (functional) + USD + EUR enabled, the bank-accounts currency dropdown lists all three.
2. Creating a USD bank account works; it appears under a USD group in the list.
3. Labels/format match the Currencies & FX tab.
4. type-check 0.

---

## Completion summary required
State: the exact source the Currencies & FX tab uses for its currency list; what the bank-accounts page used before (why only NGN showed); how you built the full set now; whether you extracted/reused a shared helper or component; confirm USD/EUR now selectable; confirm no backend touched; type-check result. Report acceptance pass/fail.
