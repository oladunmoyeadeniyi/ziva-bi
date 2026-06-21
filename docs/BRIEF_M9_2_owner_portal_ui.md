Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — M9.2: Owner portal UI (functional, unstyled)

**Milestone:** M9 Platform/Owner Portal — M9.2
**Scope:** Frontend only. The `/platform` owner-portal screens: tenant list, tenant detail, lifecycle + suspend/reactivate actions.
**Depends on:** M9.1 backend (`/api/platform/*` endpoints exist).

> **STYLING: clean and consistent now, full polish later.** Build this with the app's existing design language — same cards, buttons, tables, typography, and spacing as the other setup pages (reference the Tax/Organisation/Period Management pages). It must look professional and consistent immediately, NOT bare HTML. What's deferred to the later UI phase is *pixel-level polish and full mobile-responsive design* — not basic good looks. Reuse existing components so it matches the rest of the app out of the box.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- `frontend/src/contexts/AuthContext.tsx` — `useAuth()` exposes `user.is_super_admin`, `accessToken`.
- `frontend/src/lib/api.ts` — `apiFetch(path, { token })`.
- `frontend/src/app/dashboard/business/layout.tsx` — reference for layout/NavLink patterns (do NOT edit; reference only).
- The app's route structure under `frontend/src/app/` — to place `/platform` correctly.
If anything conflicts, STOP and report.

---

## Backend endpoints available (from M9.1)
- `GET /api/platform/tenants?environment=live|test|all&lifecycle_status=&search=`
- `GET /api/platform/tenants/{tenant_id}`
- `PATCH /api/platform/tenants/{tenant_id}/lifecycle` body `{ status }`
- `POST /api/platform/tenants/{tenant_id}/suspend`
- `POST /api/platform/tenants/{tenant_id}/reactivate`
All require super-admin (the JWT already carries `is_super_admin`).

---

## CHANGES

### 1. Route + access guard
- New area at `frontend/src/app/platform/` with its own minimal `layout.tsx` (NOT the business/tenant layout — no tenant sidebar).
- Guard: if `!user.is_super_admin`, redirect to `/dashboard` (or show "Not authorized"). Only super admins see `/platform`.
- The layout: simple header ("Ziva BI — Platform") + a logout/back control. Minimal.

### 2. Tenant list page — `/platform` (or `/platform/tenants`)
- On mount, `GET /api/platform/tenants` (default live). 
- Plain table: Name, Slug, Environment, Lifecycle status, Users (count), Created. Each row links to detail.
- Simple controls above the table: a search box (passes `?search=`), a lifecycle_status filter dropdown, and an environment filter (live/test/all). Re-fetch on change.
- No styling beyond a readable table.

### 3. Tenant detail page — `/platform/tenants/[id]`
- `GET /api/platform/tenants/{id}`.
- Show: tenant fields (name, slug, environment, lifecycle_status, created), its users (name, email, role_tier, active), module count, test env (if any).
- **Actions (buttons):**
  - **Lifecycle dropdown + Set** → `PATCH .../lifecycle` (values: trial / in_implementation / live; NOT suspended — that's the suspend button). Refresh on success. Surface the 400 if they pick suspended.
  - **Suspend** button (if not suspended) → `POST .../suspend`, confirm first ("This blocks all users from logging in. Continue?"). Refresh.
  - **Reactivate** button (if suspended) → `POST .../reactivate`. Refresh.
- Surface API errors inline (the apiFetch throws — catch and show the message).

### 4. Optional entry point
- If trivial: add a small "Platform" link somewhere visible ONLY to super admins (e.g. the user dropdown in the business header). If it complicates things, skip — super admins can navigate to `/platform` directly. State what you did.

---

## Files CC may modify
- `frontend/src/app/platform/layout.tsx` (NEW)
- `frontend/src/app/platform/page.tsx` (NEW — tenant list)
- `frontend/src/app/platform/tenants/[id]/page.tsx` (NEW — detail)
- Optionally `frontend/src/app/dashboard/business/layout.tsx` (ONLY if adding the super-admin-only Platform link, point 4)

Do NOT: touch backend, other pages, tenant data flows, `config.py`, CORS. Do NOT invest in styling.

---

## House rules
- `npm run type-check` = 0 errors before commit.
- No browser storage beyond what AuthContext already uses.
- Clean and consistent with the existing app design (reuse components, match the setup pages). Professional-looking now; full responsive polish is the later phase.

---

## Acceptance / test steps (state pass/fail each)
1. As super admin, `/platform` loads and lists tenants; non-super-admin is redirected/blocked.
2. Search + filters re-fetch and narrow the list.
3. Clicking a tenant opens its detail with users + modules.
4. Lifecycle dropdown sets trial/in_implementation/live; choosing suspended via dropdown is rejected (400 surfaced).
5. Suspend (with confirm) → tenant shows suspended; its users blocked at login (verify by trying to log in as a user of that tenant in another window).
6. Reactivate → tenant restored; login works again.
7. type-check 0 errors.

---

## Completion summary required
List every file changed. State: where the access guard lives and how non-super-admins are handled; whether you added the Platform entry link (point 4) and where; confirm no backend touched; confirm the UI reuses the existing design language and looks consistent with the setup pages. Report acceptance pass/fail.
