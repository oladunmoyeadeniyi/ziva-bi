Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Fix: super-admin routing + remove personal dashboard

**Scope:** Frontend routing + remove the individual/personal dashboard path. Small.
**Context:** Super admins (Ziva owners) are landing on tenant/personal dashboards they shouldn't see. And the personal-finance dashboard (individual account path) is out of scope and should be removed.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- Login redirect logic — where, after login, the app decides where to send the user (likely the login page component or AuthContext). Find how it routes individual vs business accounts today.
- `frontend/src/app/dashboard/personal/` — the personal dashboard (Image: "Welcome / Your personal finance dashboard", Expense Tracking / Income Tracking "Coming soon").
- How `account_type` ("individual" | "business") and `is_super_admin` drive routing.
- The signup page — does it offer an "individual" account option?
Report what you find before editing.

---

## CHANGES

### A. Super-admin lands on /platform
- After login (and on session restore), if `user.is_super_admin` is true → route to `/platform`, NOT `/dashboard/*`.
- A super admin should never auto-land on a tenant or personal dashboard. The "Back to dashboard" link in the platform header (if it points to `/dashboard`) should, for a super admin, either go to `/platform` or be removed — state what you did.

### B. Remove the personal / individual dashboard path
- Remove the personal dashboard at `frontend/src/app/dashboard/personal/` (the individual-user experience). Out of scope for now.
- Remove routing that sends users there. If any login/signup flow routed "individual" accounts to it, redirect those to a safe place (the business dashboard if they have a tenant, else login) — state how you handled individual accounts with no destination.
- If the signup page offers an "individual" account type, **hide/remove the individual option** so new individual accounts can't be created (business/tenant only for now). Keep the backend untouched — this is a frontend removal only. State what you changed.
- Do NOT delete backend individual-account logic (that's a larger change); just remove the frontend dashboard + entry points. Note any individual-account backend that's now orphaned for a future cleanup.

---

## Files CC may modify
- The login page / AuthContext routing logic (super-admin → /platform).
- `frontend/src/app/dashboard/personal/` (remove).
- The signup page (remove individual option) — frontend only.
- The platform layout's "Back to dashboard" link if it misroutes super admins.

Do NOT: touch backend auth/models, the platform APIs, tenant data, the business dashboard, `config.py`, or CORS.

---

## House rules
- `npm run type-check` = 0 errors.
- Don't break business-account login (still routes to the business dashboard).
- Super admin must reach /platform cleanly and not see tenant/personal dashboards.

---

## Acceptance / test steps (state pass/fail each)
1. Log in as super admin (admin@zivafinance.com) → lands on /platform automatically.
2. Super admin cannot reach the personal dashboard (route removed) and the platform "Back to dashboard" doesn't dump them on a tenant/personal page.
3. Business-account login still works → business dashboard.
4. Signup no longer offers an individual account option (if it did).
5. type-check 0 errors.

---

## Completion summary required
List every file changed. State: how super-admin routing now works; what happened to individual-account routing/signup; confirm the personal dashboard is removed; note any orphaned individual-account backend left for future cleanup; confirm business login unaffected and no backend touched.
