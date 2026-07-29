Read `docs/TENANT_ENVIRONMENT_FLOW.md`, `docs/MASTER_CONTEXT.md`, and `docs/PROJECT_STATE.md` first, then follow this brief.

# Brief — M9.0.1: Test-first environment flow (reconciliation + retrofit)

**Milestone:** M9 Platform/Owner Portal — amendment to M9.0 (shadow-tenant model)
**Scope:** Backend flow inversion (signup, promotion, go-live) + one-time data retrofit of the Red Bull demo tenant. No changes to the ~30 tenant-scoped data tables.
**Supersedes:** the "live first, test cloned from it" flow described in `BRIEF_M9_0_environment_architecture.md`. That brief's schema (Tenant.environment / parent_tenant_id / lifecycle_status) stays — only the *direction* of creation and promotion changes.

---

## STEP 0 — Read before changing anything (mandatory)

Confirmed current behavior (investigated 2026-06-28, do not re-derive — verify still true, then proceed):

- `backend/app/routers/auth.py` `signup()` (~213–320): business signup creates exactly one Tenant row. `environment` and `lifecycle_status` are never set explicitly → fall to column defaults `"live"` and `"in_implementation"` respectively (`backend/app/models/auth.py` lines 77–90). No test shadow is created at signup.
- `backend/app/routers/tenant.py` `create_test_environment()` (151–262): requires caller already on a **live** tenant (409 otherwise). Creates the test row with `parent_tenant_id = live.id`, mirrors all UserTenant rows, clones live data via `tenant_clone.clone_tenant_data` by default. Direction is live→test only.
- `backend/app/routers/tenant.py` `promote()` (274–405): requires `test_tenant.parent_tenant_id` already set (400 otherwise) — **assumes live already exists**. Only copies `org_config` / `tax` / `fx`. Never creates a Tenant row.
- `backend/app/routers/platform.py` `platform_promotion_diff()` / `platform_promotion_apply()` (791–850+), backed by `app/services/promotion_engine.py`: super-admin only. Guard `_require_live_with_shadow` (~line 760s) 404s if no test shadow exists for the given live `tenant_id` — **also assumes live already exists**, and the path param IS the live tenant's id. Handles CoA / Dimensions / DimensionValues / GLDimensionRequirements / AccountMappings via natural-key diff+apply (the part that needs FK remapping).
- `backend/app/routers/setup.py` `mark_go_live()` (~3305): flips `is_active=True`, `lifecycle_status="live"` on the tenant the caller is **already on**. Does not create a row.
- `backend/app/routers/platform.py` `list_tenants()` (~215–280): default filter is purely `Tenant.environment == "live"` (the docstring's mention of `parent_tenant_id IS NULL` is stale and does not match the actual query — no code change needed here, but fix the docstring while touching this file).
- `_require_live_with_shadow`-style lookups only go one direction today: "find test shadow for this live id" (`Tenant.environment=="test", Tenant.parent_tenant_id==live.id`). There is **no existing lookup** for the new direction needed ("find the live tenant born from this test id" → `Tenant.environment=="live", Tenant.parent_tenant_id==test.id`). This must be added.

If anything above no longer matches the real code, STOP and report before changing anything.

---

## Architecture (locked — do not deviate)

> When a new tenant is created or signs up, only a test/shadow environment is provisioned by default. No live environment exists until the tenant explicitly promotes their validated configuration. Live environment is born from a promotion event, never created empty. A live tenant with no configuration is therefore impossible by design.

Schema is unchanged (`environment`, `parent_tenant_id`, `lifecycle_status` on `tenants`). Only the direction flips:
- **Old:** live created first (parent_tenant_id always null on live); test created second, `test.parent_tenant_id = live.id`.
- **New:** test created first (`parent_tenant_id` null — nothing to point to yet); live created second, **`live.parent_tenant_id = test.id`**.

`parent_tenant_id` keeps its generic meaning ("the tenant this one was derived from") — no column/FK changes needed, just new application logic for the reversed lookup direction.

---

## Decisions locked this session (answer every "what should X do" question against this table — do not re-litigate)

| Question | Decision |
|---|---|
| Test env after go-live | Stays active permanently as an ongoing sandbox. Never archived or deleted. Promotion remains repeatable post-go-live (per `TENANT_ENVIRONMENT_FLOW.md` §3). |
| User access when live is born | Auto-grant: mirror every UserTenant row from the test tenant onto the new live tenant (same pattern `create_test_environment` already uses, just reversed direction). Adding/removing live users after that point is ordinary tenant user management (M5) — no special-case needed. |
| Canonical "birth live" mechanism | **Merge into one engine.** Extend `promotion_engine.py` / the platform diff-review-apply flow (`platform_promotion_diff` + `platform_promotion_apply`) to be the single mechanism that (a) computes the full diff across **all** sections — org_config, tax, fx, periods, CoA, dimensions, approval workflows, document rules, module settings, roles/permissions — and (b) on apply, creates the live Tenant row if it doesn't exist yet, then writes everything in one transaction. The simpler `tenant.py` `/promote` endpoint (org_config/tax/fx only) becomes redundant once this lands — deprecate it (leave in place but unused, or remove; state which). |
| Who can trigger it | **Super-admin only** — consistent with today's `go-live` endpoint already being super-admin gated. Consultants/tenant admins can request go-live (UI action) but a Ziva super admin (or the same automated path `mark_go_live` uses, now extended) executes it. |
| Existing Red Bull tenant | **Data-preserving retrofit** (not grandfather, not destructive rebuild). Red Bull is an internal demo/test tenant, not a real customer — see retrofit plan below. The currently-live tenant's data must not be lost. |

---

## CHANGES

### 1. Signup (`backend/app/routers/auth.py`, `signup()`)
For `account_type == "business"`: create the Tenant with `environment="test"` explicitly (not the `"live"` default), `parent_tenant_id=None`, `lifecycle_status="in_implementation"`. Do **not** call the clone engine — there is nothing to clone from. This tenant IS the company's data from day one. Individual-account signup is unaffected (no tenant created either way).

### 2. New lookup helper (wherever `_require_live_with_shadow` lives, likely `platform.py` or a shared tenant-lookup module)
Add `_require_test_tenant(tenant_id)` style helper: given a test tenant id, optionally find its live counterpart via `Tenant.environment=="live", Tenant.parent_tenant_id==test_tenant_id` (returns `None` if not yet promoted — that's the expected/normal pre-go-live state, not an error).

### 3. Promotion engine (`backend/app/services/promotion_engine.py` + `platform_promotion_diff`/`platform_promotion_apply` in `platform.py`)
- `compute_promotion_diff(db, test_id, live_id)`: when no live tenant exists yet for this test tenant, treat the diff as "everything in test is a CREATE" — every CoA account, dimension, org_config row, etc. is a create-diff item, not an update. Extend the sections it diffs to cover org_config / tax / fx / periods / approval workflows / document rules / module settings / roles & permissions (currently CoA/Dimensions/DimensionValues/GLDimensionRequirements/AccountMappings only — read the current section list before extending).
- `apply_promotion(...)`: if no live tenant exists for this test tenant, **create it first** inside the same transaction (`Tenant(environment="live", parent_tenant_id=test_tenant.id, lifecycle_status="live", name=<strip " (Test)" suffix or similar>, country=test.country, ...)`), then apply every accepted diff item against the new live tenant's id, then mirror every UserTenant row from test → new live (auto-grant, per decision table above), then set `tenant.lifecycle_status="live"` (this folds in what `mark_go_live` does today — decide whether `mark_go_live` becomes a thin wrapper around this or is retired; state which).
- Never copy: transaction data (expense reports, journal entries, GL postings), audit logs, employee submission/approval history (per `TENANT_ENVIRONMENT_FLOW.md` §3 — unchanged).
- Promotion stays repeatable after this first call — re-running diff/apply on an already-live pair must continue to behave exactly as it does today (UPDATE/DEACTIVATE diffs against the existing live tenant). Only the **first-ever** promotion for a given test tenant takes the new "create live" branch.

### 4. Endpoint surface
- Decide and state: does `POST /api/tenant/promote` (simple, consultant-level) get removed, or kept as a deprecated no-op pointing callers at the platform engine? Recommended: keep the route but have it return 410 Gone with a message pointing at the new flow, so nothing 404s unexpectedly if the frontend hasn't been updated yet.
- `mark_go_live` (`setup.py`): once a tenant's live counterpart already exists (post-first-promotion), this can stay as the simple `is_active`/`lifecycle_status` flip it is today. Confirm it isn't reachable in a state where live doesn't exist yet (i.e. gate it, or fold it into the new apply path per point 3).

### 5. Frontend
- Environment toggle: only render once a live counterpart exists for the user's test tenant (i.e. `parent_tenant_id`-style lookup from the test side resolves to something, or the JWT/CurrentUser exposes a `has_live_counterpart` flag — state which approach). Before that, there is nothing to toggle to.
- Promotion review UI (`PromotionReviewDialog.tsx`): when running the very first promotion for a tenant, every item will show as CREATE (none as UPDATE/DEACTIVATE) — confirm the empty-live-state renders sanely (no "already up to date" false negative, no crash on a null live tenant id before creation).
- Go-live entry point: copy/labels should reflect "this creates your live environment" framing for first-time promotion, distinct from "this updates your live environment" framing for repeat promotions. State where this distinction is surfaced.

---

## Red Bull retrofit (one-time, data-preserving)

Red Bull is Adeniyi's internal demo/build-verification tenant, not a real customer. Goal: end state has **only a test environment** holding all of Red Bull's current real data, with **no live tenant** — so Adeniyi can manually exercise the new promotion-creates-live flow on it for real, later, as the first live test of the new mechanism.

**Before touching anything:** read the actual current Red Bull tenant rows (id, name, slug, environment, parent_tenant_id, lifecycle_status, is_active, created_at for both the current live tenant and its test shadow) via a read-only query against the real DB (Render-hosted — this session's local `.env` only points at `localhost`, so this must be run from somewhere with real `DATABASE_URL` access, e.g. CC with the production env var, or a one-off Render shell). Do not assume IDs — confirm them.

Steps (run inside a single DB transaction, with a pg_dump/backup taken immediately before, on the real environment that has DB access):

1. Identify the current live Red Bull tenant (`environment="live"`, the one holding the real configured/uploaded data) — call its id `RB_LIVE`.
2. Identify its current test shadow (`environment="test"`, `parent_tenant_id=RB_LIVE`) — call its id `RB_TEST_OLD`.
3. Confirm `RB_TEST_OLD` holds no data that doesn't also exist on `RB_LIVE` (it should be a pure clone per the existing `create_test_environment` behavior — verify, don't assume, since manual test-only edits may have been made on it since cloning).
4. Re-point every `UserTenant` row currently on `RB_TEST_OLD` — delete them (they're redundant mirrors of the `RB_LIVE` UserTenant rows that will remain).
5. Delete the `RB_TEST_OLD` tenant row.
6. Update the `RB_LIVE` row in place — same row, same id, same data, only flip: `environment: "live" → "test"`, `parent_tenant_id: NULL` (unchanged, already null), `lifecycle_status → "in_implementation"` (or whatever the pre-go-live status should read as — confirm against the lifecycle table above). **Do not delete or recreate this row** — every other table's `tenant_id` foreign keys point at this id; relabeling in place is what avoids data loss.
7. Result: Red Bull now has exactly one tenant row, flagged `environment="test"`, holding 100% of its existing data, no live counterpart. This matches the new model's "only test exists until promoted" state exactly.
8. Any currently-active sessions/JWTs pointing at `RB_LIVE`'s id will keep working — same tenant id, the JWT's `environment` claim will now read "test" on next reissue (login or switch-environment call). Flag this to Adeniyi rather than silently absorbing it: existing logged-in sessions may show stale "live" framing in the UI until they re-auth.
9. When Adeniyi is ready, he triggers the new promotion-creates-live flow (point 3 above) on this tenant manually, as the first real exercise of the new mechanism, with his actual data.

---

## Files likely touched

- `backend/app/routers/auth.py` — signup.
- `backend/app/routers/tenant.py` — deprecate or remove the simple `/promote`; `create_test_environment` unaffected (still valid for a *live* tenant wanting a fresh sandbox later).
- `backend/app/routers/platform.py` — promotion diff/apply, docstring fix on `list_tenants`, new reverse lookup helper.
- `backend/app/services/promotion_engine.py` — extend sections, add live-tenant-creation branch.
- `backend/app/routers/setup.py` — `mark_go_live` — confirm/adjust its relationship to the new apply path.
- `frontend/...` — environment toggle visibility, `PromotionReviewDialog.tsx` first-run framing, go-live entry point copy.
- One-off retrofit script/SQL for Red Bull (not part of the app — run once, against the real DB, then discarded; do not leave it as a reusable migration since it's tenant-specific surgery).

## Do NOT
- Add an environment column to any of the ~30 tenant-scoped data tables.
- Copy transaction data, audit logs, or submission/approval history in any promotion path.
- Touch `RB_LIVE`'s row id, or any table's existing `tenant_id` foreign keys, during the retrofit — relabel in place only.
- Run the Red Bull retrofit without a fresh backup immediately before.

---

## Acceptance / test steps (state pass/fail each)

1. New business signup creates exactly one tenant: `environment="test"`, `parent_tenant_id=NULL`, `lifecycle_status="in_implementation"`. No clone runs. No live tenant exists anywhere for it.
2. Environment toggle does not render for a tenant with no live counterpart.
3. First-ever promotion on that test tenant creates a new live Tenant row (`environment="live"`, `parent_tenant_id=<test id>`), copies every in-scope section, mirrors all UserTenant rows, sets `lifecycle_status="live"`.
4. Toggle now renders; switch-environment works both directions; JWT environment claim correct each way.
5. Running promotion again afterward (a config change in test) diffs correctly as UPDATE against the now-existing live tenant — not treated as a second creation.
6. Transactional data never appears in any diff/apply payload.
7. Red Bull retrofit: tenant row count for Red Bull goes from 2 → 1; all pre-existing data (CoA, dimensions, org config, periods, any transactions) still queries correctly under the same tenant id; no orphaned UserTenant rows; backup exists and is verified restorable before the transaction is committed.

## Completion summary required

List every file changed. State: whether `/api/tenant/promote` was removed or deprecated-410'd; whether `mark_go_live` was retired or kept as a wrapper; exact before/after tenant row counts and ids for the Red Bull retrofit; confirm no data table gained an environment column; confirm transactional/audit data was never copied; confirm a backup was taken and verified before the Red Bull retrofit ran.
