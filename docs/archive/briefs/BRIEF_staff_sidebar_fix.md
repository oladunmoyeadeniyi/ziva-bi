Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Staff portal: render the left sidebar shell (match the approved layout)

**Problem:** The staff home content was built (metric cards, My tasks, My modules) but the staff has **NO LEFT SIDEBAR NAV** — the left area is empty. The approved layout has a persistent left nav rail. Fix the shell so staff get the proper sidebar, matching the wireframe.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/dashboard/business/layout.tsx` — find why the staff sees no sidebar. Specifically: the staff nav block is gated by `!isExclusivelyAdmin` (~line with `{!isExclusivelyAdmin && (`). Check what `isExclusivelyAdmin` evaluates to for a plain staff user (user.is_tenant_admin && !user.has_non_admin_role). For adeniyi@redbull (is_tenant_admin possibly true, has_non_admin_role possibly false), this may be TRUE → which HIDES the staff nav. That's the bug.
- Confirm: with consultant tier stripped and tenant_admin no longer granting config, what are this user's actual flags (is_tenant_admin, has_non_admin_role)? The staff nav must show for normal staff.
- `frontend/src/app/dashboard/business/page.tsx` — the staff home (already built: greeting, metrics, tasks, modules).
Report findings (especially the flag values and why the sidebar is empty) before editing.

---

## Target layout (match this exactly)
A persistent two-pane layout for staff:

**Left sidebar (always visible for staff, ~240px):**
- A WORKSPACE section label.
- Nav items: **Home** (`/dashboard/business`, exact, house icon), **Expenses** (`/dashboard/business/expenses`, receipt icon), **Approvals** (`/dashboard/business/approvals`, checks icon, with the pending-count badge).
- These must render for a normal staff user. Do NOT hide them behind `isExclusivelyAdmin` or any admin gate.
- (Admin users additionally see the setup sections below, as today — unchanged.)

**Main content (right):** the home dashboard already built (greeting, metric cards, My tasks, My modules). This stays.

**Header + impersonation banner:** unchanged (AppHeader, ImpersonationBanner).

The result should look like the approved wireframe: left nav rail + content area, NOT centered content with an empty left gutter.

---

## CHANGES
1. **Fix the staff nav visibility.** The staff WORKSPACE nav (Home/Expenses/Approvals) must always render for any authenticated business user (staff AND admin). Remove/adjust the `!isExclusivelyAdmin` gate that is currently hiding it. Determine the correct condition: staff nav = always shown for business users; admin setup nav = shown only when `isAdmin`. State the exact condition you used.
2. **Ensure the sidebar container renders** even when the user is non-admin (right now if the only nav was admin-gated, the `<nav>` may be effectively empty/collapsed). The nav element must show the WORKSPACE group for staff.
3. **Add a "Home" item** if missing, pointing to `/dashboard/business` (exact match) with a house icon, above Expenses/Approvals.
4. Keep the home dashboard content exactly as built. This brief is about the SHELL/sidebar, not the content.
5. Confirm spacing/alignment: content sits to the right of the sidebar (not centered across the full width with an empty left gutter).

---

## Files CC may modify
- `frontend/src/app/dashboard/business/layout.tsx` — staff nav visibility + ensure sidebar renders for staff.
- (Only if needed) `frontend/src/app/dashboard/business/page.tsx` — container width/margins so content aligns beside the sidebar, not centered with a gap.

Do NOT: touch backend, admin setup nav items, AppHeader, ImpersonationBanner, other pages, `config.py`, CORS.

---

## House rules
- `npm run type-check` = 0 errors.
- A plain staff user MUST see the left sidebar with Home/Expenses/Approvals.
- Admin users keep their full setup nav (unchanged).
- No empty left gutter.

---

## Acceptance / test steps (state pass/fail each)
1. Log in as adeniyi@redbull (plain staff) → left sidebar visible with WORKSPACE: Home, Expenses, Approvals (badge if pending). Content sits beside it, no empty gutter.
2. Each nav item navigates correctly; active item highlighted.
3. Admin/super-admin still see the full setup nav below WORKSPACE (unchanged).
4. type-check 0 errors.

---

## Completion summary required
List every file changed. State: the flag values that caused the empty sidebar; the exact condition now used for staff nav vs admin nav; confirm staff see Home/Expenses/Approvals; confirm admin nav unchanged; confirm no backend touched. Report acceptance pass/fail.
