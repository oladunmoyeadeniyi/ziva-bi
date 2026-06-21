Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — M9.3b: Enter-tenant UX + impersonation banner (frontend)

**Milestone:** M9 — M9.3 (Brief B of 2: frontend)
**Scope:** Frontend only. "Enter tenant" buttons on the platform tenant detail, the impersonation session swap, and a persistent banner while impersonating, with an "Exit" back to /platform.
**Depends on:** M9.3a backend (`POST /api/platform/tenants/{id}/enter` returns an impersonation access_token + mode + environment + tenant_name).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- `frontend/src/contexts/AuthContext.tsx` — `accessToken` (memory), `user` (localStorage), `saveSession`, `clearSession`, restore-on-mount logic.
- `frontend/src/app/platform/tenants/[id]/page.tsx` — tenant detail (where Enter buttons go).
- `frontend/src/app/dashboard/business/layout.tsx` — where the impersonation banner shows; how header/user menu render.
- `frontend/src/lib/api.ts` — `apiFetch`.
Report findings before editing.

---

## Concept
A super admin clicks "Enter tenant" on the platform detail page. The app calls `/enter`, receives an impersonation token, swaps it into the active session, and navigates into that tenant's dashboard. A banner stays visible the whole time ("Viewing TENANT — [Implementation / Support read-only] · environment"). "Exit" returns the super admin to `/platform` and restores their own platform session.

**Critical constraint:** the impersonation token has NO refresh token. Swapping it must NOT wipe the super admin's own refresh token (in localStorage), because they need to return to /platform afterward. So: preserve the super admin's own session, layer the impersonation token on top, and restore on exit.

---

## CHANGES

### 1. AuthContext — impersonation support
Add impersonation state without destroying the base session:
- New state: `impersonation: { token, mode, environment, tenantId, tenantName } | null`.
- `enterTenant(tenantId, environment?)`: calls `POST /api/platform/tenants/{tenantId}/enter` (with the super admin's current accessToken), stores the returned token + metadata in `impersonation` state, and ALSO mirror it to sessionStorage (so a refresh inside the tenant doesn't lose it — sessionStorage, not localStorage, so it's tab-scoped and transient). Do NOT touch the stored refresh token or USER_KEY.
- `exitImpersonation()`: clears `impersonation` state + sessionStorage key, returns control to the base platform session (the super admin's own accessToken in memory / restore via refresh token). Navigate to `/platform`.
- Expose a derived `effectiveToken` = `impersonation?.token ?? accessToken`. **All tenant-scoped pages should use this token.** The simplest way: keep `accessToken` as the base, but have apiFetch callers use `effectiveToken` when impersonating. Decide the cleanest approach (e.g. expose `effectiveToken` from useAuth and update the dashboard pages to use it) — state what you did. Avoid a huge refactor: if most pages read `accessToken`, consider having the context return `effectiveToken` AS `accessToken` while impersonating, so existing pages "just work." State your choice and its tradeoff.
- On mount/restore: if the impersonation sessionStorage key exists, rehydrate `impersonation` state (so a page refresh inside a tenant keeps the session).

### 2. Platform detail — "Enter tenant" buttons
On `platform/tenants/[id]/page.tsx`, add an "Enter tenant" action section:
- If lifecycle is trial/in_implementation: one button **"Enter tenant (configure)"** → `enterTenant(id)` → on success navigate to `/dashboard/business/setup` (or the business dashboard root).
- If lifecycle is live: two buttons — **"Enter live (read-only)"** → `enterTenant(id, "live")`, and (only if a test environment exists) **"Enter test (edit)"** → `enterTenant(id, "test")`.
- If suspended: no enter buttons (show why).
- Surface errors inline (reuse the existing actionMsg pattern).

### 3. Impersonation banner (in business layout)
In `dashboard/business/layout.tsx`, when `impersonation` is active, show a persistent top banner (sticky, distinct color — amber for support/read-only, blue for implementation/edit):
- Text: `Viewing {tenantName} — {mode === "support" ? "Support · read-only (live)" : "Implementation · edit"}{environment === "test" ? " · TEST" : ""}`.
- An **"Exit to platform"** button on the banner → `exitImpersonation()`.
- The banner must be obvious and always visible while impersonating, so the super admin never forgets they're acting inside someone else's tenant.

### 4. Read-only affordance (light touch)
- When `impersonation.mode === "support"` (read-only live), it's fine that backend blocks writes (M9.3a). Optionally disable obvious "Save"/submit buttons or show a small "read-only" hint — but do NOT attempt to gate every control (backend enforces). Keep this light; state what you did.

---

## Files CC may modify
- `frontend/src/contexts/AuthContext.tsx` — impersonation state + enter/exit + effectiveToken.
- `frontend/src/app/platform/tenants/[id]/page.tsx` — enter buttons.
- `frontend/src/app/dashboard/business/layout.tsx` — banner + exit.
- `frontend/src/lib/api.ts` — only if needed for token plumbing (avoid if possible).

Do NOT: touch backend, the ~30 data pages individually (rely on effectiveToken-as-accessToken), `config.py`, CORS. No localStorage for the impersonation token (sessionStorage only).

---

## House rules
- `npm run type-check` = 0 errors.
- Entering a tenant must NOT log the super admin out or wipe their refresh token.
- Exiting must cleanly return to /platform as the super admin.
- Banner always visible while impersonating.

---

## Acceptance / test steps (state pass/fail each)
1. As super admin, open a trial/in_implementation tenant → "Enter tenant (configure)" → lands in that tenant's dashboard; banner shows Implementation · edit; config pages load that tenant's data.
2. A config edit (e.g. save Organisation) succeeds in implementation mode.
3. Exit to platform → back at /platform as super admin, no re-login needed.
4. Enter a LIVE tenant read-only → banner shows Support · read-only (live); viewing works; a save attempt is rejected by backend (403 surfaced) — confirm the banner/read-only hint is clear.
5. Enter a live tenant's TEST env (if shadow exists) → banner shows TEST; edits succeed.
6. Refresh the browser while impersonating → session persists (sessionStorage rehydrate), banner still shows.
7. type-check 0 errors.

---

## Completion summary required
List every file changed. State: how effectiveToken was wired (and whether existing pages needed changes); how the super admin's base session is preserved during impersonation; how refresh-while-impersonating is handled; what read-only affordance you added; confirm no backend touched; confirm exit restores the platform session cleanly. Report acceptance pass/fail.
