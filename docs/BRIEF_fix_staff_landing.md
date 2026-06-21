Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Fix: plain staff land on a clean page (not the 403 setup dashboard)

**Scope:** Frontend routing only. Small.
**Context:** After M9.3c, plain tenant staff (no power_admin, not super admin) lose config access. But they currently get routed to `/dashboard/business/setup`, which now 403s with "Admin access required" and an empty nav — a broken experience. Land them somewhere clean instead.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- The post-login routing (login page + `/dashboard/page.tsx` dispatcher) — where business users get sent. Currently business → `/dashboard/business/setup` (the 403 page for staff) or `/dashboard/business`.
- `frontend/src/app/dashboard/business/layout.tsx` — the `isAdmin` gate (now `is_super_admin || impersonation || role_tier === "power_admin"`), and what operational nav (Overview, Expenses, Approvals) renders for non-admins.
- `frontend/src/app/dashboard/business/page.tsx` or the Overview page — does it load for a plain staff user without admin, or does it also error?
Report findings before editing.

---

## CHANGES

### 1. Route business users to a non-admin-safe landing
- After login (and the /dashboard dispatcher), a business user who is NOT admin (not super_admin, not power_admin) should land on a page that does NOT require admin — e.g. `/dashboard/business` (Overview) rather than `/dashboard/business/setup`.
- Admins (super_admin / power_admin / impersonating) can still go to setup as before.
- State the exact landing you chose for non-admin staff and confirm it loads without a 403.

### 2. Ensure the staff landing page itself doesn't error
- Confirm the chosen landing (Overview/dashboard home) renders for a plain staff user. If it calls an admin-only endpoint and errors, make it degrade gracefully: show a simple, friendly placeholder for now — e.g. a card saying "Your workspace is being set up. Operational tools will appear here." — instead of a red error.
- Keep this minimal. The full staff portal is a future milestone; this is just a clean, non-erroring placeholder.

### 3. Don't show setup nav to staff (confirm M9.3c held)
- Verify the setup nav group stays hidden for non-admins (M9.3c did this). If any admin-only data fetch in the layout throws for staff and breaks the page, guard it so the layout renders cleanly for staff.

---

## Files CC may modify
- The login page / `/dashboard/page.tsx` dispatcher (non-admin landing).
- `frontend/src/app/dashboard/business/page.tsx` (or Overview) — graceful placeholder if it errors for staff.
- `frontend/src/app/dashboard/business/layout.tsx` — only if an admin-only fetch breaks the layout for staff.

Do NOT: touch backend, config endpoints, the setup pages, `config.py`, CORS. Don't build the staff portal — just a clean landing.

---

## House rules
- `npm run type-check` = 0 errors.
- A plain staff user must see NO red error page and NO setup nav — just a clean, simple landing.
- Admin/impersonation flows unchanged.

---

## Acceptance / test steps (state pass/fail each)
1. Log in as adeniyi.oladunmoye@redbull.com (plain staff) → lands on a clean page (Overview/placeholder), NO "Admin access required" error, NO setup nav.
2. Operational nav (Overview, Expenses, Approvals) still visible if those are meant for staff.
3. Super admin still lands on /platform; entering a tenant still reaches setup fine.
4. power_admin (if set) still reaches setup.
5. type-check 0 errors.

---

## Completion summary required
List every file changed. State: the landing page chosen for non-admin staff; what placeholder (if any) you added; confirm no red error for staff; confirm admin/impersonation routing unchanged; confirm no backend touched.
