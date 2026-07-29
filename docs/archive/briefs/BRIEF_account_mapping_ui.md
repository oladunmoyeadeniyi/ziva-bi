Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Account Mapping setup UI

**Scope:** Frontend only. Build the setup page where an admin maps each system posting role to the tenant's GL account, using the determination-layer endpoints already built. Grouped by category, searchable GL picker per role (tenant may have 100s of accounts), mapped/unmapped state + progress count. Consistent with existing setup pages.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/routers/account_mapping.py` — confirm endpoint shapes: GET /api/setup/account-mapping/roles (returns catalogue + each role's current mapping: role_key, label, group, expected_account_type, is_control_account, mapped gl_account_id + gl_number/gl_name if mapped), PUT /api/setup/account-mapping/{role_key} { gl_account_id }, DELETE /api/setup/account-mapping/{role_key}. Report exact response fields.
- How to fetch the tenant's CoA accounts for the picker (the existing Chart of Accounts endpoint — find it; returns gl_number, gl_name, account_type, is_active). Report the endpoint.
- An existing setup page for design language reference — e.g. `frontend/src/app/dashboard/business/setup/modules/page.tsx` or the periods/tax setup page. Match its card/table/button styles.
- `frontend/src/app/dashboard/business/layout.tsx` — the setup nav (COMMON DATA / FINANCIALS sections) so the new page gets a nav link in a sensible place (FINANCIALS, near Chart of accounts). 
- `frontend/src/lib/api.ts`, AuthContext (accessToken, impersonation).
Report findings before editing.

---

## Build

### Page: `/dashboard/business/setup/account-mapping` (new)
Add to the FINANCIALS section of the setup sidebar, near Chart of accounts (label e.g. "Account mapping" / "GL determination").

**Header:** title + one-line description ("Map each posting role to a GL account so transactions post correctly."). A **progress indicator**: "X of N roles mapped" (N from the catalogue, e.g. 27) with a small bar; highlight that control accounts / required roles are mapped.

**Grouped list (8 groups):** render roles grouped by `group` (control, tax, cash_bank, fixed_assets, inventory, fx, period_end, suspense) with a readable group heading. Within each group, each role is a row:
- Role label + a small tag if `is_control_account`.
- Expected type hint (e.g. "Balance Sheet" / "Income statement" / "Either") from expected_account_type (BS→"Balance Sheet", PL→"Income statement", null→"Either").
- A **searchable GL picker** (combobox): type to filter the tenant's accounts by gl_number or gl_name; show "gl_number — gl_name". Selecting one calls PUT; a clear/unmap action calls DELETE. Show the currently mapped account.
- Mapped vs unmapped visual state (e.g. unmapped = subtle amber/empty; mapped = normal). Surface validation errors from the API inline (e.g. account-type mismatch → show the message).

**Picker requirement:** the tenant may have hundreds of accounts (Red Bull has ~595) — DO NOT render a giant native <select> of all accounts. Use a searchable/filterable combobox (filter client-side on the fetched CoA list, or debounce). State your approach.

**Save model:** per-row immediate save on selection (PUT) with a small saved/error indicator, OR a batch save — RECOMMEND per-row immediate save (simpler, matches the determination endpoints). State choice.

**Account-type filtering (nice-to-have):** when picking for a role with expected_account_type BS, you may pre-filter the picker to BS/SOFP accounts (and PL→PL/SOCI) to reduce mismatches — but still allow viewing all if needed. The backend validates regardless. State if you did this. NOTE the tenant's account_type values may be 'SOFP'/'SOCI' (IFRS) as well as 'BS'/'PL' — treat SOFP as BS and SOCI as PL in any client-side filtering.

Consistent spacing, cards, buttons with existing setup pages. Responsive enough not to break narrow.

---

## Files CC may modify/create
- `frontend/src/app/dashboard/business/setup/account-mapping/page.tsx` (NEW)
- `frontend/src/app/dashboard/business/layout.tsx` — add the nav link in FINANCIALS.
- Optional small component for the searchable combobox in `frontend/src/components/` — state if added.

Do NOT: touch backend, other setup pages, AppHeader, `config.py`, CORS.

---

## House rules
- `npm run type-check` = 0 errors.
- No giant native select of all accounts — searchable picker.
- All actions wired to the real endpoints; inline validation errors surfaced.
- Matches existing setup-page design language.
- Page is admin-guarded by the existing setup layout (super admin / power_admin / impersonating) — confirm it sits under that gate.

---

## Acceptance / test steps (state pass/fail each)
1. Page loads under FINANCIALS nav; shows 8 groups with all roles; progress "X of N mapped".
2. Searchable picker filters Red Bull's accounts by number/name; selecting maps the role (PUT), row shows mapped.
3. Mapping employee_payable to an Income-statement (SOCI) account → API 422 surfaced inline; mapping to a SOFP account succeeds.
4. Unmap (DELETE) clears the row; progress count updates.
5. Reload persists mappings.
6. type-check 0 errors.

---

## Completion summary required
List every file created/changed. State: the CoA endpoint used for the picker; per-row vs batch save choice; the combobox approach (how you avoided a giant select); whether you pre-filtered by account type (incl. SOFP/SOCI handling); confirm progress count + grouped layout; confirm admin-gated; confirm no backend touched. Report acceptance pass/fail.
