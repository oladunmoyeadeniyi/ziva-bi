# Ziva BI — Test Shadow Tenant

All acceptance tests and script-based integration tests that perform real DB writes
**must** use this tenant. Never write to the live Red Bull tenant.

---

## Active test shadow

| Field | Value |
|---|---|
| `tenant_id` | `e8a2fd8c-5466-4618-bb37-97681a8bfb05` |
| `name` | Red Bull Nigeria Limited (Test) |
| `environment` | `test` |
| `parent_tenant_id` | `bd2c8a25-7467-494a-96fa-30f40b5b5d19` (live Red Bull) |
| `lifecycle_status` | `in_implementation` |
| `created_at` | 2026-06-21 |

This is a **proper test shadow** created via the Phase 4 clone-on-create engine
(`POST /api/platform/tenants/{live_id}/test-environment` with `clone_data=true`).
It is a complete, faithful clone of live Red Bull Nigeria Limited at creation time.

## What is cloned (all 4,359 rows)

| Table | Count | Notes |
|---|---|---|
| `tenant_dimensions` | 6 | All 6 active dimensions (cost_center, material, stat/real orders, customer_order, trading_partner) |
| `dimension_values` | 147 | All active dim values; FKs re-pointed to shadow's own dim IDs |
| `chart_of_accounts` | 595 | All active GL accounts; GL numbers intact |
| `gl_dimension_requirements` | 3,570 | GL→dim requirements; FKs re-pointed |
| `tenant_account_mappings` | 17 | Posting role → GL mappings; FKs re-pointed |
| `bank_accounts` | 2 | Standard Charter (NGN) + Standard Chartered (USD); GL FKs re-pointed |
| `employees` | 0 | Live Red Bull has no employees yet |
| `org_structure` | 17 | Full tree: Red Bull GMBH → Red Bull Nigeria Limited → Admin/Finance/HR/IT/Legal/Marketing/Operations/Sales and sub-nodes |
| `tenant_org_config` | 1 | legal_name, functional_currency (NGN), enabled_currencies, org settings |
| `tenant_modules` | 3 | expense, ap, ar |
| `approval_matrix` | 1 | Approval workflow config |

## How to reference in scripts

```python
TEST_TID = "e8a2fd8c-5466-4618-bb37-97681a8bfb05"
```

## Lifecycle status note

The shadow starts as `lifecycle_status = "in_implementation"` regardless of the
live parent's status. This is intentional — the shadow has master data but no
transactions, so treating it as live would enable the wrong lifecycle gates
(e.g. Replace All would be blocked, Remap wouldn't be, etc.).

## To re-create the shadow fresh

```bash
POST /api/platform/tenants/bd2c8a25-7467-494a-96fa-30f40b5b5d19/test-environment
  ?clone_data=true
```

The endpoint is idempotent — if a shadow already exists, it returns it unchanged.
To get a fresh clone, first delete the existing shadow rows manually, then call
the endpoint again.

---

## Retired tenant (deleted 2026-06-21)

`f2aecfab-025f-410f-a7f6-df923172c8a1` — "Ziva BI — Test Tenant"

This was a standalone live tenant (`environment="live"`, no parent) created through
the normal signup path, not a test shadow. It had no real data — only 2 dimension
values and 1 accounting period seeded by acceptance test scripts. It has been
permanently hard-deleted. Any script referencing this UUID must be updated to use
the new shadow UUID above.

---

## Why a dedicated test shadow matters

The 3a GL posting acceptance tests ran against live Red Bull
(`bd2c8a25-7467-494a-96fa-30f40b5b5d19`) and created 28 expense_reports and
6 journal_entries that had to be manually cleaned up. See:
- `docs/diagnosis_tenant_data.md` — investigation
- `docs/BRIEF_cleanup_test_data.md` — cleanup brief

With a proper cloned shadow, tests run against realistic master data (real CoA,
real org structure, real dimensions) without risk of polluting live.
