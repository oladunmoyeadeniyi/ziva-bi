Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Staff/Employee portal shell + home dashboard

**Scope:** Frontend only. Build the durable STAFF (operational) portal shell + a real home dashboard, per the approved wireframe. Real content from what exists (expenses, approvals). Module grid is a structure that future modules plug into — NO fake/locked modules. Admin setup experience stays as-is.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/dashboard/business/layout.tsx` — the shared shell: AppHeader, ImpersonationBanner, the staff nav block (Overview/Expenses/Approvals, ~non-admin section) vs the admin setup nav (gated by `isAdmin`). Note `pendingCount` (approvals badge), `MODULE_ICONS`/`MODULE_ROUTES` maps.
- `frontend/src/app/dashboard/business/page.tsx` — current staff home (shortcut cards) + admin redirect logic.
- `frontend/src/app/dashboard/business/expenses/page.tsx` — the reports list + status tabs (for what counts/data exist).
- `frontend/src/app/dashboard/business/approvals/page.tsx` — the approvals queue (for pending count / items).
- `backend/app/routers/expenses.py` — what list/summary data is available (e.g. GET /api/expenses/reports returns reports with status; is there any summary endpoint? if not, we compute counts client-side from the list).
- `frontend/src/contexts/AuthContext.tsx` — user fields, impersonation.
Report findings before editing.

---

## Design (build to the approved staff-portal wireframe)
The staff portal = operational workspace. Distinct from the admin setup nav (which stays).

### A. Shell (layout.tsx — staff side only; do NOT change admin setup nav)
Keep the existing structure but make the STAFF nav the proper operational shell:
- WORKSPACE group: **Home** (the new dashboard, exact `/dashboard/business`), **Expenses**, **Approvals** (with the existing pending badge — but only show Approvals if the user actually has approvals; for now keep it shown, badge from /api/approvals/queue; full "only approvers" gating comes with RBAC — add a `// RBAC: gate Approvals to approvers` marker).
- A MY MODULES group: render from a **single source of truth** (reuse/extend the MODULE_ICONS map) listing operational modules the user can reach. For now, the only real operational module surface is Expenses (and Approvals). Do NOT list modules that don't have a working staff-facing page. Add a `// RBAC + modules: populate from granted modules once available` marker so it's clear this is the plug-in point.
- Keep AppHeader + ImpersonationBanner exactly as-is.
- The admin setup nav (COMMON DATA / FINANCIALS / etc.) stays exactly as it is, still gated by `isAdmin`. Do not merge or break it.

### B. Home dashboard (page.tsx — non-admin/staff branch)
Replace the plain shortcut cards (non-admin branch) with the approved home layout:
- **Greeting** — "Welcome, {first name}" + a short sub line (role/department if available, else generic).
- **Metric cards** — computed from REAL data: fetch the user's expense reports (GET /api/expenses/reports) and derive: My drafts, In review (SUBMITTED+PENDING_APPROVAL), Approved. If the user is an approver, also show "To approve" from /api/approvals/queue length. Only show cards we have real numbers for.
- **My tasks** — a short list built from real state: e.g. "{n} reports awaiting your approval" (if approver), "You have {n} draft(s) to submit". Each links to the relevant page. If nothing, show a friendly empty line.
- **My modules** — the module grid: cards for the operational surfaces that exist (Expenses; Approvals if approver). Each is a real link. NO locked/greyed/fake modules. This is the structure future modules slot into.
- Keep it clean, existing design language, responsive enough not to break narrow.

Admin users (super_admin / power_admin / impersonating) keep their current behaviour (redirect to setup if incomplete, or the admin overview) — do NOT change the admin branch.

---

## Files CC may modify
- `frontend/src/app/dashboard/business/layout.tsx` — staff WORKSPACE/MY MODULES nav only (leave admin nav + header + banner intact).
- `frontend/src/app/dashboard/business/page.tsx` — staff/non-admin branch → the new home dashboard (leave admin branch intact).
- Optional small components in `frontend/src/components/` for the home (MetricCard, TaskItem) — state if added.

Do NOT: touch backend, admin setup pages/nav, AppHeader, ImpersonationBanner logic, `config.py`, CORS. No fake modules. No new backend endpoints (compute from existing list endpoints).

---

## House rules
- `npm run type-check` = 0 errors.
- Every card/link resolves to a real page. No dead or placeholder-fake module tiles.
- Admin experience unchanged.
- Mark the RBAC/module plug-in points with `// RBAC:` comments so the future work is obvious.

---

## Acceptance / test steps (state pass/fail each)
1. Plain staff (adeniyi@redbull) lands on `/dashboard/business` → sees the new home: greeting, metric cards (from real expense data — zeros are fine), My tasks, My modules (Expenses; Approvals if approver). No admin nav.
2. Metric numbers match reality (e.g. with 0 reports, all show 0; create a draft → My drafts shows 1).
3. Nav: Home/Expenses/Approvals work; no fake module links.
4. Admin/super-admin/impersonation experience unchanged (setup nav + redirects still work).
5. type-check 0 errors.

---

## Completion summary required
List every file changed. State: what the staff home now shows and where each metric/number comes from; how Approvals visibility is handled now + where the RBAC marker is; confirm no fake modules; confirm admin nav/experience untouched; confirm no backend touched. Report acceptance pass/fail.
