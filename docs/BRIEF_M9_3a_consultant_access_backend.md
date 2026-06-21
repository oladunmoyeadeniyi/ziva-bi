Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — M9.3a: Consultant access into tenants (backend)

**Milestone:** M9 — M9.3 (Brief A of 2: backend mechanism + permission enforcement + consultant cleanup)
**Scope:** Backend only. How a super admin enters a tenant and what they can do, by lifecycle + environment. Plus strip the misplaced consultant role_tier from tenant users.
**Depends on:** M9.0 (environment), M9.1 (platform endpoints).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- `backend/app/middleware/auth.py` — `CurrentUser` (has tenant_id, is_super_admin, environment, role_tier), `require_auth`, `require_super_admin`.
- `backend/app/routers/auth.py` — `_build_access_token`, `switch_environment` (the cross-context token-mint pattern to follow), suspension checks.
- `backend/app/routers/platform.py` — owner endpoints, `_sa` guard, AuditLog `_log` helper.
- `backend/app/core/security.py` — JWT payload shape.
- `backend/app/routers/setup.py` — `_require_admin` (the config-write guard most setup endpoints use). This is the chokepoint where "live = read-only for impersonating super admin" must be enforced.
- How `role_tier == "consultant"` is currently used anywhere (reopen, _require_admin tiers, etc.) — list every site.
Report findings before editing.

---

## Concept (locked design)
A super admin (Ziva consultant) operates INTO a tenant in two modes, by the tenant's lifecycle_status + the active environment:

- **Implementation mode** — tenant is `trial` or `in_implementation`: super admin has FULL config + edit access. (This is where setup happens — consultant configures the tenant.)
- **Support mode** — tenant is `live`: super admin is VIEW-ONLY on the LIVE environment (see what any member sees, for support/review). On the tenant's TEST environment, super admin may ACT (full edit) — so they can configure/test fixes.

Tenant staff are NOT consultants. Strip the `consultant` role_tier from tenant users.

---

## CHANGES

### 1. "Enter tenant" — mint an impersonation token
New endpoint `POST /api/platform/tenants/{tenant_id}/enter` (super-admin only):
- Resolve the target tenant. Determine the **mode**:
  - lifecycle in {trial, in_implementation} → `impersonation_mode = "implementation"` (full edit), environment = the tenant's own environment.
  - lifecycle == live → `impersonation_mode = "support"`, default environment = "live" (read-only). Accept optional body `{ environment: "live" | "test" }` — if "test" and a test shadow exists, target the shadow with full edit; if "live", read-only.
  - lifecycle == suspended → 409 "Cannot enter a suspended tenant."
- The super admin has NO UserTenant on the target tenant. Mint a token that carries the target `tenant_id` directly (not via a UserTenant lookup) PLUS new claims:
  - `impersonator_id` = the super admin's user_id (so we always know who is acting)
  - `impersonation_mode` = "implementation" | "support"
  - keep `is_super_admin = true`, set `environment` appropriately.
  - For `user_tenant_id`: the super admin has none on this tenant — use a sentinel/null-safe approach. State how you handled it (e.g. allow user_tenant_id to be the super admin's own, but tenant_id points at the target; or a dedicated impersonation marker). The key invariant: tenant-scoped queries resolve to the TARGET tenant_id.
- Log an AuditLog `platform.tenant.entered` with mode + environment.
- Return an AuthResponse-shaped token (frontend swaps it, like switch-environment).

### 2. Add impersonation fields to CurrentUser + JWT
- Add to JWT payload + `CurrentUser`: `impersonator_id: uuid|None` and `impersonation_mode: str|None` ("implementation"|"support"|None).
- Populate in `require_auth`. Document in security.py docstring.

### 3. Enforce read-only in support mode on live
- Add a guard helper `block_if_readonly_impersonation(current_user)` → raises 403 if `impersonation_mode == "support"` AND `environment == "live"`. Message: "Read-only support session — editing/posting is disabled on the live environment."
- Call it in the WRITE paths that matter: `_require_admin` is the main config-write chokepoint in setup.py — add the read-only check there (so all config edits are blocked). Also add to the period close/hard-close/reopen endpoints and any obvious posting/mutation endpoint in setup.py. List exactly where you added it.
- Reads (GET) are unaffected — support mode can view everything.
- In implementation mode, or support+test, the guard does nothing (full edit allowed).

### 4. Strip consultant role_tier from tenant users
- Provide a one-line script/command to set `role_tier = NULL` for any tenant user currently set to "consultant" (specifically adeniyi.oladunmoye@redbull.com). 
- Update `_require_admin` in setup.py: since consultant is no longer a tenant tier, remove "consultant" from the tenant-side `_ADMIN_TIERS` admit set (keep power_admin). A super admin entering in implementation mode passes via `is_super_admin`, NOT via a tenant consultant tier. Verify the reopen endpoint (was consultant-only) now keys off `is_super_admin` or impersonation_mode=implementation instead of tenant role_tier — state how you rewired it.
- Net effect: tenant staff (Adeniyi) lose config access; super admin gains it through impersonation.

---

## Files CC may modify
- `backend/app/middleware/auth.py` — impersonation fields on CurrentUser, `block_if_readonly_impersonation`.
- `backend/app/core/security.py` — payload docstring.
- `backend/app/routers/auth.py` — `_build_access_token` impersonation claims (or a dedicated mint helper).
- `backend/app/routers/platform.py` — the `/enter` endpoint.
- `backend/app/routers/setup.py` — read-only guard in `_require_admin` + write/close/reopen endpoints; remove consultant from tenant `_ADMIN_TIERS`; rewire reopen.
- `backend/scripts/` — the strip-consultant-tier command (or document a SQL one-liner).
- `backend/app/schemas/` — request/response for `/enter`.

Do NOT: touch the ~30 data tables, `config.py`/`ziva_dev`, CORS, the frontend (that's M9.3b), or transactional logic beyond adding the read-only guard.

---

## House rules
- No migration expected (no new columns — impersonation lives only in the JWT). If you think one is needed, STOP and explain.
- After changes, manual uvicorn restart. Set `$env:DATABASE_URL` if running alembic for any reason.
- Reads must never be blocked by the read-only guard — only writes/mutations.

---

## Acceptance / test steps (state pass/fail each)
1. `POST /platform/tenants/{id}/enter` as super admin on an in_implementation tenant → returns a token with impersonation_mode=implementation, tenant_id=target; tenant-scoped GET returns that tenant's data.
2. With that implementation token, a config write (e.g. PATCH org) → succeeds (full edit).
3. Enter a LIVE tenant (support mode, live) → GETs work (can view); a config write → 403 read-only.
4. Enter a live tenant with `{environment:"test"}` (shadow exists) → writes succeed on test.
5. Enter a suspended tenant → 409.
6. After stripping consultant tier: adeniyi.oladunmoye@redbull.com logging in normally (NOT impersonated) can no longer pass `_require_admin` for config (unless they hold tenant_admin/power_admin) — state the resulting access. Reopen now works for super-admin-in-implementation, not tenant consultant.
7. Audit log records each enter with mode + environment + impersonator.

---

## Completion summary required
List every file changed. State: how you handled user_tenant_id for an impersonating super admin with no UserTenant on the target; exactly which endpoints got the read-only guard; how reopen was rewired off the consultant tenant tier; the command to strip consultant tier; confirm no migration; confirm reads are never blocked; confirm M9.0/M9.1/Phase-1a otherwise intact.
