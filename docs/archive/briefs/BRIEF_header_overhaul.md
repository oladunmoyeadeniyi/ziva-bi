Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Header overhaul: one coherent header system

**Scope:** Frontend only. Replace the inconsistent, duplicated headers across platform / business / impersonation with one coherent, correctly-linked header. No fake data.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/platform/layout.tsx` — platform header (lines ~46–73: "Ziva BI — Platform", email, Home, Sign out).
- `frontend/src/app/dashboard/business/layout.tsx` — business header (~272–335: ZivaBI label, user dropdown with full_name/companyName, Profile, Platform link, Sign out) + ImpersonationBanner (~76–118).
- `frontend/src/contexts/AuthContext.tsx` — `user` fields (full_name, email, is_super_admin, role_tier), `impersonation`, `logout`, `exitImpersonation`.
- The `Icon` component used in business layout.
Report findings before editing.

---

## Problems to fix
1. Two unrelated header implementations (platform vs business) with duplicated logout/profile logic.
2. Business header shows `full_name — companyName`; for a super admin impersonating, the tenant/company context and the impersonation state are shown in two disconnected places (banner + header).
3. Platform header has a redundant "Home" link (the nav already covers it) and a bare email.
4. Inconsistent sign-out handling.

---

## Target design (build exactly)
A single shared header component `frontend/src/components/AppHeader.tsx` used by BOTH layouts, that adapts by context:

**Always (left):** "ZivaBI" wordmark. If platform context, append a muted "· Platform" tag.

**Right — a single user menu button** showing:
- The user's `full_name`.
- A context line under/after it:
  - Platform (super admin, not impersonating): `Platform owner`.
  - Business, normal tenant user: the `companyName` (existing fetch).
  - Business, super admin impersonating: `Viewing {tenantName}` (from `impersonation.tenantName`).
- Chevron. Clicking opens ONE dropdown.

**Dropdown items (deduplicated, context-aware):**
- `Profile` → `/dashboard/profile` (only when NOT impersonating and not pure platform context; hide for super-admin-with-no-tenant on /platform).
- `Platform` → `/platform` (only if `user.is_super_admin` AND currently in a business/dashboard context, i.e. not already on platform).
- `Exit to platform` → calls `exitImpersonation()` then routes `/platform` (only while impersonating).
- `Sign out` → `logout()` then `/`.
No duplicate Home link. No bare email line in the header bar (email can show as a muted line inside the dropdown header).

**Impersonation banner stays** (separate, above the header) — but the header's context line must agree with it (both say the tenant being viewed). Do not duplicate the "Exit" action confusingly: keep "Exit to platform" on the banner AND in the dropdown is fine, but they must call the same handler.

---

## CHANGES
1. Create `frontend/src/components/AppHeader.tsx` — props: `{ context: "platform" | "business" }`. Internally reads `useAuth()` for user/impersonation/logout/exitImpersonation. Renders the wordmark + single adaptive user menu per the design above. Reuse the existing `Icon` component.
2. `platform/layout.tsx` — replace its inline `<header>` with `<AppHeader context="platform" />`. Remove the duplicated email/Home/Sign-out markup.
3. `dashboard/business/layout.tsx` — replace its inline `<header>` (the ~272–335 block) with `<AppHeader context="business" />`. Keep the ImpersonationBanner above it. Remove the now-duplicated dropdown markup, `showUserMenu`/`menuRef`/`handleLogout` if fully moved into AppHeader (or keep them only if still needed elsewhere — state which).
4. Ensure the company-name fetch (currently in business layout) moves into or is passed to AppHeader so the context line works, without duplicating the fetch.

---

## Files CC may modify
- `frontend/src/components/AppHeader.tsx` (NEW)
- `frontend/src/app/platform/layout.tsx`
- `frontend/src/app/dashboard/business/layout.tsx`

Do NOT: touch backend, other pages, the ImpersonationBanner's core logic (only ensure consistency), `config.py`, CORS. No fake data.

---

## House rules
- `npm run type-check` = 0 errors.
- One header component, no duplicated logout/profile/menu logic across layouts.
- Every link must resolve to a real route. No dead links.

---

## Acceptance / test steps (state pass/fail each)
1. Platform (/platform) as super admin: header shows "ZivaBI · Platform", user menu shows full_name + "Platform owner"; dropdown has Sign out (no Profile, no redundant Home), no email in the bar.
2. Business as a normal tenant user: header shows full_name + companyName; dropdown has Profile + Sign out; no Platform link.
3. Super admin impersonating a tenant: banner + header agree (both name the tenant); header context line shows "Viewing {tenant}"; dropdown has "Exit to platform" + Sign out; Exit returns to /platform.
4. Super admin in a business context (not impersonating, if reachable): dropdown shows Platform link.
5. No duplicated menus or dead links anywhere; type-check 0.

---

## Completion summary required
List every file changed. State: what moved into AppHeader; what duplicated code was removed from each layout; how the context line is derived per case; confirm no dead links; confirm impersonation banner + header agree; confirm no backend touched.
