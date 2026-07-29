Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — M9.1: Owner portal backend (tenant lifecycle + super-admin APIs)

**Milestone:** M9 Platform/Owner Portal — M9.1
**Scope:** Backend only. Super-admin-only tenant management: list, detail, lifecycle transitions, suspend/reactivate.
**Depends on:** M9.0 (lifecycle_status column already on Tenant). Delegation (assigned-staff) is M9.1b — NOT this brief.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact files + line ranges BEFORE editing:
- `backend/app/models/auth.py` — `Tenant` (now has `environment`, `parent_tenant_id`, `lifecycle_status`, `test_data_retention_days`), `User.is_super_admin`, `UserTenant`.
- `backend/app/middleware/auth.py` — `CurrentUser`, `require_auth`.
- `backend/app/routers/` — list all routers; **check whether any super-admin-only routes already exist** (search for `is_super_admin`). Report what you find.
- `backend/main.py` — how routers register.
If anything conflicts, STOP and report.

---

## Context
The owner portal lets Ziva BI (super admin) manage all tenants across the platform. This brief is the backend: a super-admin-guarded router for listing/viewing tenants and driving their lifecycle. UI is a later brief.

**Lifecycle states (on Tenant.lifecycle_status):** `trial` | `in_implementation` | `live` | `suspended`.

**Suspension:** a suspended tenant's users cannot log in. Suspend is reversible from any state (reactivating returns the tenant to its prior state).

---

## CHANGES

### 1. Super-admin guard
- Add a reusable guard `require_super_admin(current_user)` (in a shared location, e.g. middleware/auth.py or a deps module) → raises 403 unless `current_user.is_super_admin`. State where you put it.

### 2. Track prior state for suspend/reactivate
- Add column `pre_suspension_status` (String, nullable) to Tenant — stores the lifecycle_status the tenant had before suspension, so reactivate restores it. Migration additive + reversible.

### 3. Owner router — `/api/platform/*` (super-admin only)
New router (suggest `routers/platform.py`), all endpoints guarded by `require_super_admin`:

- `GET /api/platform/tenants` — list ALL tenants (across all super-admin scope). Filters: `?environment=live|test`, `?lifecycle_status=...`, `?search=` (name/slug). For each: id, name, slug, environment, parent_tenant_id, lifecycle_status, is_active, user count, created_at. Exclude or clearly flag test shadows (they have parent_tenant_id) so the list isn't cluttered — default to showing LIVE tenants, with a filter to include test. State your default.

- `GET /api/platform/tenants/{tenant_id}` — detail: the tenant's fields + its users (name, email, role_tier, is_active), its modules (active count), its test environment (if any), config-completeness summary if cheap to compute (else omit).

- `PATCH /api/platform/tenants/{tenant_id}/lifecycle` — body `{ status: trial|in_implementation|live|suspended }`. Validates the value. Sets lifecycle_status. Disallow directly setting `suspended` here (use the suspend endpoint) — return 400 directing to /suspend. Log to AuditLog.

- `POST /api/platform/tenants/{tenant_id}/suspend` — sets `pre_suspension_status = current lifecycle_status`, `lifecycle_status = suspended`, and blocks login (see #4). Idempotent (already suspended → 409 or no-op, state which). Log.

- `POST /api/platform/tenants/{tenant_id}/reactivate` — restores `lifecycle_status = pre_suspension_status` (or `in_implementation` if null), clears `pre_suspension_status`. Log.

### 4. Enforce suspension at login
- In `login` (routers/auth.py): if the resolved tenant's `lifecycle_status == "suspended"`, reject with 403 "This account is suspended. Contact support." (Individual accounts with no tenant are unaffected.)
- Also block `switch-environment` and `refresh-token` into a suspended tenant.

---

## Files CC may modify
- `backend/app/models/auth.py` — `pre_suspension_status` column.
- `backend/alembic/versions/<new>` — additive, reversible.
- `backend/app/middleware/auth.py` (or a deps module) — `require_super_admin`.
- `backend/app/routers/platform.py` (NEW) — the owner endpoints.
- `backend/app/routers/auth.py` — suspension check at login/refresh/switch.
- `backend/main.py` — register the platform router.
- `backend/app/schemas/` — platform request/response schemas.

Do NOT: touch tenant-scoped data tables, the ~30 data models, `config.py`/`ziva_dev`, CORS, the frontend, or M9.0/Brief 1–4 logic beyond the login suspension check. Do NOT build delegation/assigned-staff (M9.1b).

---

## House rules
- Migration upgrade/downgrade clean. Set `$env:DATABASE_URL` before alembic. Manual uvicorn restart.
- Every platform endpoint guarded by `require_super_admin` — a non-super-admin gets 403.
- Smallest correct change.

---

## Acceptance / test steps (state pass/fail each)
1. Migration clean; downgrade reverts; `pre_suspension_status` exists.
2. `GET /api/platform/tenants` as super-admin → returns tenants (live by default); filters work; non-super-admin → 403.
3. `GET /api/platform/tenants/{id}` → returns detail with users + modules.
4. `PATCH .../lifecycle` to `live` → updates; attempting to set `suspended` here → 400.
5. `POST .../suspend` → status becomes suspended, pre_suspension_status saved; that tenant's user can no longer log in (403 at login).
6. `POST .../reactivate` → restores prior status; login works again.
7. switch-environment / refresh into a suspended tenant → blocked.

---

## Completion summary required
List every file changed. State: where `require_super_admin` lives; default list scope (live-only vs all) and how test shadows are handled; suspend idempotency choice; confirm suspension blocks login + refresh + switch; confirm no data tables or delegation built; confirm M9.0/Brief 1–4 logic untouched.
