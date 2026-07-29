Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Owner portal #2: Tenants section refinement

**Scope:** Frontend only. Refine the Tenants list + detail to match the approved wireframe and ensure all actions are clean and consistent. Builds on Brief #1 (tenant list now at `/platform/tenants`).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/platform/tenants/page.tsx` — the moved tenant list (search/filters/table).
- `frontend/src/app/platform/tenants/[id]/page.tsx` — detail: tenant fields, users, lifecycle set, suspend/reactivate, Enter buttons.
- `backend/app/routers/platform.py` — confirm fields available on list + detail (plan, MRR are NOT available — don't show them).
Report findings before editing.

---

## Refinements (match wireframe, keep all existing behaviour working)

### Tenant list (`/platform/tenants`)
- Keep search + lifecycle filter + environment filter.
- Table columns: Name (link), Slug, Country, Environment (badge), Lifecycle (badge), Users, Created. (No "Plan" column — no billing data yet.)
- Add a small **count + state summary** above or below the table (e.g. "11 live · 6 in implementation · 5 trial"), computed from the loaded rows. Real only.
- Each row: clicking name → detail (existing). Optionally add an inline "Enter" affordance per row — OPTIONAL, only if clean; the detail page already has Enter. State if you added it.
- Clean, consistent with the app design language.

### Tenant detail (`/platform/tenants/[id]`)
Confirm/refine these sections render cleanly (most already exist):
- **Header:** name, slug, environment + lifecycle badges.
- **Tenant details:** ID, country, users, active modules, parent tenant, pre-suspension status, created, updated.
- **Enter tenant** actions (existing): implementation (configure) for trial/in_impl; live read-only + test edit for live; nothing for suspended. Keep working.
- **Actions:** lifecycle set (trial/in_impl/live; suspend via its own button), suspend/reactivate. Keep working.
- **Users** table: name, email, role_tier, active.
- **Test environment** card if a shadow exists (existing).
- Ensure back-link goes to `/platform/tenants`.
- Tidy spacing/headings so it reads as one coherent page, not stacked mismatched cards.

No new backend. No fake fields (no plan/MRR/billing). Just polish + consistency + the count summary.

---

## Files CC may modify
- `frontend/src/app/platform/tenants/page.tsx`
- `frontend/src/app/platform/tenants/[id]/page.tsx`

Do NOT: touch backend, other platform sections, AppHeader, `config.py`, CORS. No fake data.

---

## House rules
- `npm run type-check` = 0 errors.
- All existing actions (enter, lifecycle, suspend, reactivate) keep working.
- Real data only.

---

## Acceptance / test steps (state pass/fail each)
1. `/platform/tenants` — list works; state-count summary reflects real rows; filters/search work.
2. Detail page reads as one coherent page; all sections present; back-link → /platform/tenants.
3. Enter / lifecycle / suspend / reactivate all still work.
4. type-check 0.

---

## Completion summary required
List every file changed. State: what you added (count summary, optional inline Enter); confirm all actions still work; confirm no fake fields; confirm no backend touched. Report acceptance pass/fail.
