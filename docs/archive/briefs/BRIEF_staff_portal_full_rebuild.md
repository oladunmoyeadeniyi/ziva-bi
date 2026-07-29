Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Staff portal: full rebuild to match the approved wireframe

**Problem:** The staff portal is missing most of the approved design. Current state: no left sidebar, no role pill, generic subline, no notification bell, no ACCOUNT nav group. Rebuild the staff shell + home to MATCH THE APPROVED WIREFRAME exactly. Use only real data — no fake numbers, no fake modules.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/dashboard/business/layout.tsx` — the shell. Find: the staff nav gate (`!isExclusivelyAdmin` — this is HIDING the staff sidebar; that's a bug), the `isAdmin` admin-nav gate, AppHeader, ImpersonationBanner, NavLink/SectionLabel components, pendingCount (approvals badge).
- `frontend/src/app/dashboard/business/page.tsx` — staff home (greeting, metrics, tasks, modules already built) + admin branch.
- `frontend/src/contexts/AuthContext.tsx` — `user` fields actually available: full_name, first_name, email, role_tier, department, job_title, employee_code, is_super_admin, is_tenant_admin, has_non_admin_role, tenant_id; impersonation.
- `frontend/src/app/dashboard/business/approvals/page.tsx` — the queue (for "is this user an approver" + pending count).
- Report the user's actual flag values for adeniyi@redbull (why the sidebar is hidden).

---

## Approved wireframe — build EXACTLY this

### Layout: persistent left sidebar (~200px) + main content. Header + impersonation banner stay on top.

### LEFT SIDEBAR (always visible for any business user — staff AND admin)
- **WORKSPACE** group label, then:
  - **Home** → `/dashboard/business` (exact), house icon.
  - **Expenses** → `/dashboard/business/expenses`, receipt icon.
  - **Approvals** → `/dashboard/business/approvals`, checks icon, with pending-count badge. `// RBAC: gate to approvers later`.
- **ACCOUNT** group label, then:
  - **Profile** → `/dashboard/profile`, user icon.
- (Admin users ALSO see the existing setup sections — COMMON DATA / FINANCIALS / etc. — below WORKSPACE, gated by `isAdmin`, UNCHANGED.)
- The staff WORKSPACE + ACCOUNT groups must NOT be hidden by `isExclusivelyAdmin` or any admin gate. Fix that gate so staff always see them. State the corrected condition.

### MAIN CONTENT (home dashboard)
Top row:
- **Greeting** left: "Welcome, {first name}".
- **Context subline** under greeting: build from REAL fields — if `department` exists show it (e.g. "{department}"); if `job_title` exists append it; if neither, show "Your workspace". Do NOT invent cost center / "Sales · Lagos" if not on the record.
- **Top-right of the content header:** a **role pill** showing the user's role in plain words (e.g. role_tier or "Staff" if none / "Power admin" / "Super admin") AND a **notification bell** with a count. The count = number of pending approvals for this user (from /api/approvals/queue) for now; if zero, show the bell with no badge. `// notifications: real notification feed is future; count derives from approvals for now`.

Then:
- **Metric cards** (from REAL expense data via GET /api/expenses/reports): My drafts (DRAFT), In review (SUBMITTED+PENDING_APPROVAL), Approved (APPROVED). Plus **To approve** (approvals queue length) ONLY if the user has any approvals (is an approver). Zeros are fine.
- **My tasks**: real, derived — e.g. "{n} report(s) awaiting your approval" (if approver), "You have {n} draft(s) to submit". If none → "No pending tasks. You're all caught up."
- **My modules**: cards for operational surfaces that EXIST and the user can reach — Expense retirement (→ expenses), Approvals (→ approvals, if approver). NO fake/locked/Finance modules. `// modules: populate from granted modules once RBAC + module access exist`.

Match the wireframe's clean structure and the app's existing design language. Responsive enough not to break narrow.

Admin/super-admin/impersonation branch: unchanged (their redirect-to-setup / admin overview stays).

---

## Files CC may modify
- `frontend/src/app/dashboard/business/layout.tsx` — fix staff nav gate; add WORKSPACE + ACCOUNT groups; keep admin nav + header + banner intact.
- `frontend/src/app/dashboard/business/page.tsx` — staff home: greeting, context subline, role pill + notification bell, metrics, tasks, modules.
- Optional small components in `frontend/src/components/` (MetricCard, RolePill) — state if added.

Do NOT: touch backend, admin setup nav/pages, AppHeader, ImpersonationBanner, `config.py`, CORS. No fake data, no fake modules, no invented context fields.

---

## House rules
- `npm run type-check` = 0 errors.
- Staff MUST see the left sidebar (WORKSPACE + ACCOUNT). No empty gutter.
- Every number is real (from expenses/approvals). Every link resolves. No fake modules.
- Admin experience unchanged.

---

## Acceptance / test steps (state pass/fail each)
1. adeniyi@redbull (staff) → left sidebar shows WORKSPACE (Home, Expenses, Approvals+badge) + ACCOUNT (Profile). No empty gutter.
2. Home shows greeting + real context subline + role pill + notification bell (count from approvals or none).
3. Metric cards reflect real expense counts; create a draft → My drafts increments.
4. My tasks + My modules show only real items; no fake/locked modules.
5. Admin/super-admin/impersonation unchanged.
6. type-check 0 errors.

---

## Completion summary required
List every file changed. State: the flag values that hid the sidebar + the corrected gate; how the context subline is derived; what the role pill shows; where the notification count comes from; confirm all metrics/links real; confirm no fake modules; confirm admin unchanged + no backend touched. Report acceptance pass/fail.
