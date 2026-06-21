# Ziva BI — Dedicated Test Tenant

All acceptance tests and script-based integration tests that perform real DB writes
**must** use this tenant, never the live Red Bull tenant.

---

## Tenant details

| Field | Value |
|---|---|
| `tenant_id` | `f2aecfab-025f-410f-a7f6-df923172c8a1` |
| `name` | Ziva BI — Test Tenant |
| `slug` | ziva-test-tenant |
| `country` | NG |
| `environment` | live |
| `lifecycle_status` | in_implementation |
| `created_at` | 2026-06-20 |

## How to reference in scripts

```python
TEST_TENANT_ID = "f2aecfab-025f-410f-a7f6-df923172c8a1"
```

Import from a shared constant rather than copy-pasting — add to
`backend/scripts/test_utils.py` (create it) when the next test brief is written.

---

## What this tenant still needs (follow-up)

The tenant row exists but the following are NOT yet configured. Set them up
before running GL/expense acceptance tests against this tenant:

| Requirement | Why needed | Status |
|---|---|---|
| At least one open accounting period | `post_journal` checks `is_date_postable` | ❌ Not yet |
| `employee_payable` account mapping | Required for expense GL posting | ❌ Not yet |
| At least one SOCI/PL GL account with no required dimensions | For expense debit lines in tests | ❌ Not yet |
| `chart_of_accounts` rows | All GL posting validation checks the tenant's CoA | ❌ Not yet |
| `approval_matrix` row | Required for expense submit/approve flow | ❌ Not yet |
| At least one non-admin user in `user_tenants` | To act as expense submitter | ❌ Not yet |
| At least one admin user in `user_tenants` | To act as approver | ❌ Not yet |

Until this setup is complete, tests can be run against the live Red Bull tenant
ONLY for pure read operations (no writes). Writes must go to this test tenant
once the above are configured.

---

## Why a dedicated test tenant matters

The 3a GL posting acceptance tests ran against the live Red Bull tenant
(`bd2c8a25-7467-494a-96fa-30f40b5b5d19`) and created 28 expense_reports and
6 journal_entries that had to be manually cleaned up. See:
- `docs/diagnosis_tenant_data.md` — investigation
- `docs/BRIEF_cleanup_test_data.md` — cleanup brief
