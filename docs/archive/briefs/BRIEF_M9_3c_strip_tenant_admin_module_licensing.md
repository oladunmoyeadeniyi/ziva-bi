Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — M9.3c: Strip tenant_admin config access + consultant module licensing

**Milestone:** M9 — M9.3 follow-up (c)
**Scope:** Backend (one guard change) + frontend (module licensing controls for impersonating super admin).
**Depends on:** M9.3a/b.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- `backend/app/routers/setup.py` — `_require_admin` (~194, `_ADMIN_TIERS` ~191); `patch_module_license` (~2544, super-admin-only); `get_modules`/`patch_modules` (~2458/2484); `is_licensed` logic.
- `frontend/src/app/dashboard/business/setup/modules/page.tsx` — the license/subscription block (~451–473, the "contact your consultant" message), the activate/deactivate toggle (~303–314), how `is_licensed`/`is_active` render.
- How the frontend knows it's impersonating: `useAuth()` now exposes `impersonation` and `user.is_super_admin`.
Report findings before editing.

---

## Context — two issues
1. **Tenant staff still have config access.** `_require_admin` passes for `is_tenant_admin`, so Adeniyi@redbull still reaches all setup pages. Per design: until role-based access (RBAC) exists, tenant staff get NO config access — configuration is done by the consultant (super admin via impersonation). So `is_tenant_admin` must no longer grant config admin.
2. **Consultant can't license modules.** The modules page tells the consultant "contact your Ziva BI consultant" when a module isn't licensed — but the super admin IS the consultant. They need controls to set `is_licensed` (subscribe/unsubscribe the tenant to a module) directly. The backend endpoint already exists and is super-admin-only.

---

## CHANGES

### 1. Backend — remove is_tenant_admin from config admin gate
In `_require_admin` (setup.py):
- Remove `is_tenant_admin` from the pass conditions. New gate passes ONLY for: `is_super_admin` OR `role_tier in _ADMIN_TIERS` (currently just `power_admin`).
- Keep the `block_if_readonly_impersonation` call.
- Net effect: a plain tenant user (tenant_admin but no power_admin tier) can no longer reach config endpoints. Super admin (incl. impersonation in implementation mode) and power_admin still can.
- ⚠️ This is intentional and broad. In your completion summary, LIST which categories of endpoints this affects (all `_require_admin`-gated config) and confirm operational/read endpoints (expenses, period grid GETs, approvals) are NOT behind `_require_admin` and remain reachable by appropriately-roled users.
- Do NOT remove `is_tenant_admin` from the codebase or JWT — just stop using it as a config-admin pass in `_require_admin`. It may be reintroduced via RBAC later.

### 2. Frontend — hide tenant config nav from non-admins (light)
- The setup pages will now 403 for plain tenant staff. To avoid confusing dead links, in the business layout/sidebar: if the user is NOT (super_admin via impersonation, or power_admin), hide or disable the COMMON DATA / FINANCIALS setup nav items (Organisation, Module activation, Dimensions, CoA, Period management, Tax, etc.). Keep operational items (Overview, Expenses, Approvals) visible.
- Keep this light and reversible — a simple role check around the setup nav group. State exactly what you gated. (If determining "power_admin" client-side is awkward, gate on `impersonation?.mode === "implementation" || user.is_super_admin || user.role_tier === "power_admin"`.)

### 3. Frontend — consultant module licensing controls
On the modules page, when the current session is a super admin (impersonating in implementation mode — `user?.is_super_admin` true):
- Where an unlicensed module currently shows "This module is not included in your current subscription. Contact your Ziva BI consultant…", REPLACE that (for super admin only) with a control: a **"Add to subscription"** (set `is_licensed=true`) button. For a licensed module, show **"Remove from subscription"** (set `is_licensed=false`).
- Wire these to the existing `PATCH /api/setup/modules/license` endpoint (confirm the exact path/payload from `patch_module_license` — read it; it may be `/modules/{key}/license` or similar). State the real path.
- After a license change, refresh the module list so activate/deactivate availability updates.
- For non-super-admin users, keep the existing tenant-facing message (they genuinely must contact the consultant).
- The activate/deactivate (`is_active`) toggle stays as-is for licensed modules.

---

## Files CC may modify
- `backend/app/routers/setup.py` — `_require_admin` only.
- `frontend/src/app/dashboard/business/setup/modules/page.tsx` — licensing controls.
- `frontend/src/app/dashboard/business/layout.tsx` — gate setup nav group by role.

Do NOT: touch the JWT/middleware, other backend endpoints, data tables, `config.py`, CORS. No migration.

---

## House rules
- `npm run type-check` = 0 errors.
- Don't break super-admin/impersonation config access (must still work in implementation mode).
- Reads/operational endpoints stay reachable.

---

## Acceptance / test steps (state pass/fail each)
1. Log in as adeniyi.oladunmoye@redbull.com (plain staff, no power_admin) → setup/config pages 403 or are hidden from nav; Overview/Expenses still visible.
2. Enter Red Bull as super admin (implementation mode) → all config pages work; module activation page loads.
3. On modules page as super admin: an unlicensed module shows "Add to subscription" → clicking sets is_licensed=true → module becomes activatable.
4. Licensed module shows "Remove from subscription" → works.
5. As a plain tenant user (if one could reach it), the licensing buttons do NOT appear (they see the contact-consultant message).
6. power_admin user (if set) can still reach config (regression check).
7. type-check 0 errors.

---

## Completion summary required
List every file changed. State: confirm `is_tenant_admin` no longer passes `_require_admin` and what now does; which setup nav items were gated and on what condition; the exact license endpoint path/payload used; confirm operational/read endpoints unaffected; confirm super-admin impersonation config still works; confirm no migration. Report acceptance pass/fail.
