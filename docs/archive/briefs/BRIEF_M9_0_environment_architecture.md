Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — M9.0: Environment architecture (shadow-tenant model)

**Milestone:** M9 Platform/Owner Portal — M9.0 (foundation, built first)
**Scope:** Backend only. Makes tenants environment-aware (live + test) via the shadow-tenant approach, adds environment switching, promotion, and retention scaffolding.
**Depends on:** existing auth/tenant system. Touches the `tenants` table + token minting only — NOT the ~30 tenant-scoped tables (they isolate automatically).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- `backend/app/models/auth.py` — the `Tenant` model (all columns), `UserTenant`.
- `backend/app/routers/auth.py` — `_build_token_payload` (~134), `signup` (~207), `login` (~341): how the JWT is minted and how `tenant_id` flows in.
- `backend/app/core/security.py` — `create_access_token`, `decode_access_token`, JWT payload shape.
- `backend/app/middleware/auth.py` — `CurrentUser`, `require_auth`.
If anything conflicts with the real code, STOP and report.

---

## Architecture (locked decisions — do not deviate)
- A **test environment is a linked shadow tenant.** No environment column on the 30 data tables.
- Env lives in the **JWT + session**; switching reissues the token.
- Test env created **on demand**.
- Promote test→live copies **config only, selectable**.
- `POST /switch-environment` mints a fresh token pointed at the target tenant_id.

---

## CHANGES

### 1. Tenant model — add environment fields
On the `Tenant` model (`models/auth.py`):
- `environment` (String, default `"live"`, NOT NULL) — values: `live` | `test`.
- `parent_tenant_id` (uuid FK → tenants.id, nullable) — set on a test tenant, points to its live parent. Null for live tenants.
- `lifecycle_status` (String, default `"trial"`, NOT NULL) — values: `trial` | `in_implementation` | `live` | `suspended`. (M9.1 uses this; add the column now.)
- Add index on `parent_tenant_id`.
Migration: additive, reversible. Existing tenants default to `environment="live"`, `lifecycle_status` — set existing real tenants to a sensible default (state which; suggest `in_implementation` for existing, since they're mid-build, or `live` — your call, state it).

### 2. Create-test-environment endpoint
`POST /api/tenant/create-test-environment` (admin/consultant only):
- Caller's current tenant must be a LIVE tenant (environment="live"); else 409.
- If a test shadow already exists for this live tenant (a tenant with parent_tenant_id = this tenant), return it (idempotent) — don't create duplicates.
- Else create a new Tenant row: `environment="test"`, `parent_tenant_id=<live tenant id>`, copy name (suffix " (Test)"), unique slug, `lifecycle_status` mirrors parent or "trial" (state choice).
- Grant the SAME users access to the test tenant: for each UserTenant of the live tenant, create a matching UserTenant for the test tenant (same role, role_tier, is_active). So users can switch in.
- Return the test tenant summary.

### 3. Switch-environment endpoint
`POST /api/auth/switch-environment` body `{ target: "live" | "test" }`:
- Resolve the counterpart tenant: if currently live and target test → the shadow (parent_tenant_id = current); if currently test and target live → the parent.
- Verify the caller has a UserTenant on the target tenant (else 403).
- Mint a FRESH access token via the existing token builder, pointed at the target tenant's UserTenant (so `tenant_id`, `user_tenant_id` reflect the target), and add an `environment` claim.
- Return the new token (same shape as login's AuthResponse). Also issue a fresh refresh token consistent with how login does it.

### 4. JWT carries environment
- Add `"environment"` to the JWT payload in `_build_token_payload` (read from the active tenant's `environment`, default "live").
- Add `environment: str = "live"` to `CurrentUser` and populate it from the payload in `require_auth`.
- Document the new claim in security.py's payload docstring.

### 5. Promote test → live (config-only, selectable)
`POST /api/tenant/promote` body `{ sections: [...] }` (consultant only):
- Caller must be on a TEST tenant; resolve its live parent.
- `sections` is a whitelist of config domains to copy: e.g. `chart_of_accounts`, `dimensions`, `tax`, `periods`, `org_config`, `fx`. (Implement the copy for these config tables only — NEVER transactional tables like expenses/journals.)
- For each requested section, copy rows from the test tenant_id to the live tenant_id (upsert semantics — replace live config with test config for that section). Be careful with FK references that point within the same tenant (e.g. a GL referencing a dimension) — copy in dependency order and remap ids if needed. If a section's safe copy isn't trivial, implement the straightforward ones (org_config, tax, fx, periods settings) and STOP + flag the complex ones (CoA/dimensions with internal refs) rather than risk corrupting live. State exactly which sections you implemented vs deferred.
- Write a record of the promotion (reuse an audit log table if one fits, else note it).

### 6. Retention scaffolding (not full purge)
- Add a `test_data_retention_days` (int, nullable) column to the test Tenant (or a small config) — default e.g. 90.
- Do NOT build the scheduled purge job (no scheduler yet). Add a `# FUTURE: scheduled purge of test transactional data older than retention` marker and a manual endpoint stub `POST /api/tenant/purge-test-data` that is a no-op/marked TODO. State this clearly.

---

## Files CC may modify
- `backend/app/models/auth.py` — Tenant columns.
- `backend/alembic/versions/<new>` — additive migration, reversible.
- `backend/app/routers/auth.py` — switch-environment; token payload env claim.
- `backend/app/routers/` — a new tenant router (or extend setup) for create-test-environment, promote, purge stub. State where you put them.
- `backend/app/core/security.py` — payload docstring (env claim).
- `backend/app/middleware/auth.py` — CurrentUser.environment.
- `backend/app/schemas/` — request/response schemas for the new endpoints.

Do NOT: add an environment column to any of the ~30 tenant-scoped data tables; touch `config.py`/`ziva_dev`; touch CORS; touch the frontend; copy transactional data in promote.

---

## House rules
- Migration upgrade/downgrade clean. Set `$env:DATABASE_URL` before alembic (from .env). Manual uvicorn restart after migrating.
- Keep existing login/signup working unchanged except the added env claim.
- Smallest correct change. No refactor of tenant-scoping.

---

## Acceptance / test steps (state pass/fail each)
1. Migration clean; downgrade reverts; existing tenants get environment="live" + a lifecycle_status.
2. create-test-environment on a live tenant → creates a shadow tenant (environment=test, parent set), grants same users access, idempotent on re-call.
3. switch-environment test↔live → returns a fresh token whose tenant_id is the target; JWT carries environment claim; CurrentUser.environment reflects it.
4. A user with no access to the target → switch returns 403.
5. After switching to test, normal tenant-scoped reads (e.g. GET periods) return the TEST tenant's data, isolated from live — confirm no bleed.
6. promote (a safe section like org_config or tax) from test → live copies config to the live tenant; transactional tables untouched. Deferred complex sections flagged.
7. purge-test-data stub exists and is a documented no-op.

---

## Completion summary required
List every file changed. State: default lifecycle_status given to existing tenants; where you put the new endpoints (which router); which promote sections you implemented vs deferred and why; confirm NO environment column was added to any data table; confirm transactional data is never copied in promote; confirm existing login/signup still works with the added env claim; confirm Brief 1–4 / Phase 1a logic untouched.
