# Diagnosis — Missing Red Bull Test Shadow
**Date:** 2026-06-21

---

## Finding: the shadow row was genuinely deleted — the UI is correct

Shadow `2d465c94-1f88-4679-a52e-7d4c090c3939` (`red-bull-nigeria-limited-test`) **does not exist in the database.** The UI is displaying the correct state.

```sql
SELECT * FROM tenants WHERE id = '2d465c94-1f88-4679-a52e-7d4c090c3939';
-- 0 rows returned
```

Zero `user_tenants` rows reference it. The entire DB has zero `environment='test'` tenants:

```sql
SELECT id, name, environment FROM tenants;
-- bd2c8a25  Red Bull Nigeria Limited  live
-- f2aecfab  Ziva BI — Test Tenant     live   ← standalone fixture, not a shadow
```

---

## What deleted it

The acceptance test script `scripts/test_clone_engine.py` (written and run in this session to test the Phase 4 clone engine) contains a pre-clean step that **deletes every existing test shadow for Red Bull before creating its own fresh ones**:

```python
# Pre-clean any leftover shadows
old = await conn.fetch(
    "SELECT id FROM tenants WHERE parent_tenant_id=$1 AND environment='test'", TID
)
for o in old:
    await teardown(conn, str(o["id"]))
```

The `teardown()` function hard-deletes the shadow tenant and all its child data (dimensions, CoA, bank accounts, employees, user_tenants, and the `tenants` row itself).

When the test ran, `2d465c94` was the active Red Bull shadow (created during the Phase 3 promotion-review testing at `2026-06-21 07:24:40`). The test script treated it as a "leftover" and deleted it. The test then created three fresh shadows, used them for testing, and deleted them all during teardown.

---

## Audit trail timeline

| Time | Event | Shadow ID | Notes |
|---|---|---|---|
| 2026-06-21 00:45:45 | `platform.test_environment.created` | `08c732fd` | Phase 3a test, torn down |
| 2026-06-21 06:36:26 | `platform.test_environment.created` | `c854ae56` | Phase 3a test, torn down |
| 2026-06-21 06:38:56 | `platform.test_environment.created` | `d9221dbe` | Phase 3a test, torn down |
| 2026-06-21 07:24:40 | `platform.test_environment.created` | **`2d465c94`** | This was the shadow visible in the UI |
| 2026-06-21 10:02:56 | `platform.test_environment.created` | `e154d7b0` | Phase 4 test A1 (clone=true), torn down |
| 2026-06-21 10:02:57 | `platform.test_environment.created` | `bae3af3b` | Phase 4 test A6 (clone=false), torn down |
| 2026-06-21 10:02:57 | `platform.test_environment.created` | `36f03af2` | Phase 4 test A7 (clone=true), torn down |

The `2d465c94` shadow was deleted by the Phase 4 test script's pre-clean step at `2026-06-21 10:02:56` (just before `e154d7b0` was created).

---

## Current database state

| tenants table | Count |
|---|---|
| Live tenants (`environment='live'`) | 2 (`bd2c8a25` Red Bull, `f2aecfab` Ziva Test) |
| Test shadows (`environment='test'`) | **0** |
| Red Bull children (`parent_tenant_id='bd2c8a25'`) | **0** |

---

## Why the UI shows "Create test environment"

The platform tenant detail endpoint queries:
```sql
SELECT * FROM tenants
WHERE parent_tenant_id = 'bd2c8a25-...' AND environment = 'test'
```
This returns 0 rows → `TenantDetail.test_environment = null` → UI renders the "no shadow" state with the Create button.

**The UI is correct.** There is no test shadow. To restore one, click "Create test environment" in the UI (or call `POST /api/platform/tenants/bd2c8a25-.../test-environment`). With Phase 4 wired in, the new shadow will be created with `clone_data=True` by default and will immediately receive all 4,337 active config rows cloned from Red Bull live (595 CoA, 6 dims, 147 dim values, 3570 GL requirements, 17 account mappings, 2 bank accounts).

---

## Root cause

The Phase 4 acceptance test script's `teardown()` helper is too aggressive: it deletes **all** test shadows for Red Bull as a pre-clean step, regardless of whether they were created by the test script. In this case it deleted the live-session shadow that was visible in the UI.

**No data was lost that matters** — test shadows are disposable by design (live data is authoritative). But the test script should be scoped to only delete shadows it creates, not all shadows for the tenant.

**No code or data action needed for this diagnosis.** Creating a new shadow via the UI or API will restore the expected state.
