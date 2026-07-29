Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Owner portal #1: shell + section nav + Overview dashboard

**Scope:** Frontend only. Add a left section-nav to the `/platform` area (7 sections), build the Overview dashboard with REAL metrics, and move the tenant list to `/platform/tenants`. Other 5 sections are routed but built as placeholders in a LATER brief — for now just nav links that point to routes (Brief #3 fills placeholders; Brief #2 refines Tenants).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/platform/layout.tsx` — currently just AppHeader + `<main>`, no nav. This is where the left section-nav goes.
- `frontend/src/app/platform/page.tsx` — currently the tenant LIST at `/platform`. Will move to `/platform/tenants`; `/platform` becomes Overview.
- `frontend/src/app/platform/tenants/[id]/page.tsx` — tenant detail (unchanged, but confirm its "back to /platform" links still make sense once list moves to /platform/tenants — update those back-links to /platform/tenants).
- `backend/app/routers/platform.py` — `GET /api/platform/tenants` returns list with lifecycle_status, environment, user_count, created_at. This is the data source for Overview metrics. Note there is NO dedicated metrics endpoint — Overview computes counts from the tenants list (fetch with environment=all to count everything). Confirm.
- `frontend/src/lib/api.ts`, `AuthContext` (accessToken).
Report findings before editing.

---

## Target structure
`/platform` becomes a shell: **left section nav + content**. Header (AppHeader context="platform") stays on top.

### LEFT SECTION NAV (~190px) — 7 items, with icons:
1. Overview → `/platform` (exact) — `ti-layout-dashboard`
2. Tenants → `/platform/tenants` — `ti-building`
3. Team & delegation → `/platform/team` — `ti-users-group`
4. Trials & signups → `/platform/trials` — `ti-rocket`
5. Billing → `/platform/billing` — `ti-credit-card`
6. Support → `/platform/support` — `ti-lifebuoy`
7. Audit log → `/platform/audit` — `ti-history`
Active item highlighted. A small "SYSTEM" group at the bottom with "Platform settings" (→ `/platform/settings`, can be a placeholder route) is optional — include only if trivial.

Routes 3–7 (+settings) don't have pages yet — that's fine; they'll 404 until Brief #3. Add the nav links now; do NOT build those pages in this brief. (If Next.js shows an error for missing routes on click, create minimal stub `page.tsx` files that just render "Coming soon" so nav doesn't break — state if you did this.)

### OVERVIEW PAGE (`/platform` → new `page.tsx`)
Build the Overview dashboard with REAL data computed from `GET /api/platform/tenants?environment=all`:
- **Metric cards:** Total tenants, Live (lifecycle_status=live), In implementation, Trials (lifecycle_status=trial), Suspended. (MRR/revenue — OMIT, no billing data yet, or show "—". Do not fake.)
- **Needs attention** (cheap, real): a small list derived from the tenant data — e.g. tenants in `trial` (could be expiring — label "trial"), tenants `suspended`. Keep it to what we can truly derive; if nothing useful, show "Nothing needs attention."
- **Recent activity:** if there's a cheap audit source, use it; otherwise OMIT this block for now (don't fake). State your choice.
- Clean cards, existing design language.

### MOVE TENANT LIST
- Move the current `/platform/page.tsx` (tenant list) content to `/platform/tenants/page.tsx`. Keep it working exactly as now (search/filters/table/links). Update its internal links and the detail page's back-links to `/platform/tenants`.
- `/platform/page.tsx` is now the Overview.

---

## Files CC may modify
- `frontend/src/app/platform/layout.tsx` — add left section nav.
- `frontend/src/app/platform/page.tsx` — becomes Overview.
- `frontend/src/app/platform/tenants/page.tsx` (NEW) — the moved tenant list.
- `frontend/src/app/platform/tenants/[id]/page.tsx` — update back-links to /platform/tenants.
- Optional minimal stub `page.tsx` for /platform/team, /trials, /billing, /support, /audit, /settings ("Coming soon") ONLY to prevent broken nav — state if added.

Do NOT: touch backend, the business dashboard, AppHeader internals, `config.py`, CORS. No fake metrics — compute from real tenant data or omit.

---

## House rules
- `npm run type-check` = 0 errors.
- Overview metrics are REAL (computed from the tenants list). No invented numbers.
- Nav works; active state correct; no broken links (stubs if needed).
- Tenant list still fully works at its new route.

---

## Acceptance / test steps (state pass/fail each)
1. `/platform` shows the Overview with a left nav (7 sections) and real metric cards (counts match actual tenants).
2. Clicking Tenants → `/platform/tenants` shows the list (search/filters/table work, detail links work, back-links return to /platform/tenants).
3. Clicking Team/Trials/Billing/Support/Audit → navigates without a hard crash (stub "coming soon" or placeholder is fine).
4. Active nav item highlights correctly.
5. type-check 0 errors.

---

## Completion summary required
List every file changed/created. State: where Overview metrics come from (confirm real, computed from tenants list); whether you added stub pages for the unbuilt sections; whether Recent activity was included or omitted and why; confirm tenant list works at /platform/tenants with correct back-links; confirm no backend touched. Report acceptance pass/fail.
