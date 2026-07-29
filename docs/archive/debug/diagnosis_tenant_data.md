# Diagnosis — 28 Expense Reports on "Red Bull Nigeria Limited"
**Date:** 2026-06-20

---

## 1. All tenants with "Red Bull" in the name

| Field | Value |
|---|---|
| `id` | `bd2c8a25-7467-494a-96fa-30f40b5b5d19` |
| `name` | Red Bull Nigeria Limited |
| `slug` | red-bull-nigeria-limited |
| `is_active` | true |
| `environment` | live |
| `lifecycle_status` | in_implementation |
| `parent_tenant_id` | null |
| `created_at` | 2026-06-13 10:09:29 UTC |

**There is exactly ONE Red Bull tenant in the database.** No test/live pair, no duplicate, no old tenant from a previous session. Single row.

---

## 2. Which tenant_id the Super Admin is currently viewing

From the audit log:

```
platform.tenant.entered
  tenant_id  = bd2c8a25-7467-494a-96fa-30f40b5b5d19
  at         = 2026-06-20 19:47:03 UTC
  meta       = {"environment": "live", "impersonator_id": "7d9a7dab-...",
                "target_lifecycle": "in_implementation"}
```

Super admin `7d9a7dab-5b8f-43ac-8d16-18e6bbe9feeb` (`admin@zivafinance.com`) entered tenant `bd2c8a25-...` at 19:47 UTC. The most recent `login.success` at 20:02 UTC also records `tenant_id = bd2c8a25-...`, confirming this is the currently active session.

**The Super Admin is viewing tenant `bd2c8a25-7467-494a-96fa-30f40b5b5d19` — the only Red Bull tenant.**

---

## 3. expense_reports rows by tenant_id

```sql
SELECT tenant_id, COUNT(*), MIN(report_number), MAX(report_number),
       MIN(created_at), MAX(created_at)
FROM expense_reports
GROUP BY tenant_id;
```

| `tenant_id` | `count` | `first` | `last` | `oldest` | `newest` |
|---|---|---|---|---|---|
| `bd2c8a25-7467-494a-96fa-30f40b5b5d19` | **28** | EXP-2026-0001 | EXP-2026-0028 | 2026-06-20 19:21 UTC | 2026-06-20 19:33 UTC |

All 28 rows belong to the single Red Bull tenant. No other tenant_id appears in expense_reports.

---

## 4. Are these the same tenant currently being viewed?

**Yes — same tenant_id.** There is no discrepancy between the tenant the UI is showing and the tenant that owns the 28 expense reports. Both are `bd2c8a25-7467-494a-96fa-30f40b5b5d19`.

---

## 5. Origin of the 28 reports — what they are

These are **not historical data or data from a previous session.** All 28 were created **today (2026-06-20) between 19:21 and 19:33 UTC** — entirely within the current development session — by the acceptance test scripts run during the implementation of BRIEF_expense_gl_3a (Expense → GL posting).

| Report range | Created at | Created by | Origin |
|---|---|---|---|
| EXP-0001 – 0004 | 19:21:31 UTC | `adeniyi.oladunmoye@redbull.com` | First ASGI test run (test_gl3a.py iteration 1) |
| EXP-0005 – 0006 | 19:22 – 19:23 UTC | `adeniyi.oladunmoye@redbull.com` | Diagnostic Python -c scripts during debugging |
| EXP-0007 – 0011 | 19:27 – 19:28 UTC | `adeniyi.oladunmoye@redbull.com` | Second ASGI test run |
| EXP-0012 – 0015 | 19:29 UTC | `adeniyi.oladunmoye@redbull.com` | Third test run (date switched to 2027-01-15 for open period) |
| EXP-0016 – 0020 | 19:32 UTC | `adeniyi.oladunmoye@redbull.com` | Fourth test run |
| EXP-0021 – 0028 | 19:33 UTC | `adeniyi.oladunmoye@redbull.com` | Fifth and sixth test runs |

The test scripts submitted real expense reports to the live tenant via the FastAPI ASGI stack (not mock data — they hit real endpoints with real DB commits). The employee `adeniyi.oladunmoye@redbull.com` was used as the submitter in all acceptance tests.

### Statuses breakdown

| Status | Count | Explanation |
|---|---|---|
| APPROVED | 5 | EXP-0013, 0014, 0017, 0018, 0026, 0027 — fully approved + GL posted during testing |
| PENDING_APPROVAL | 10 | Submitted but approval not completed (test ran only some approval steps) |
| REJECTED | 1 | EXP-0001 — was rejected in a manual browser test |
| DRAFT | 12 | Created but not submitted in partial test runs |

### Journal entries created

As a side-effect of the approved reports, 6 journal entries were posted:
```
JE-2027-000001  EXP-2026-0013  debit=1000  credit=1000  status=POSTED
JE-2027-000002  EXP-2026-0014  debit=600   credit=600   status=POSTED
JE-2027-000003  EXP-2026-0017  debit=1000  credit=1000  status=POSTED
JE-2027-000004  EXP-2026-0018  debit=600   credit=600   status=POSTED
JE-2027-000005  EXP-2026-0026  debit=1000  credit=1000  status=POSTED
JE-2027-000006  EXP-2026-0027  debit=600   credit=600   status=POSTED
```

---

## Summary

| Question | Answer |
|---|---|
| How many Red Bull tenants exist? | **1** — `bd2c8a25-7467-494a-96fa-30f40b5b5d19` |
| Which tenant is the Super Admin viewing? | The same one — `bd2c8a25-...` |
| Which tenant owns the 28 reports? | The same one — `bd2c8a25-...` |
| Are they the same? | **Yes — identical tenant_id** |
| Are the reports "old test data"? | No — created **today (2026-06-20) between 19:21–19:33 UTC** by the GL posting acceptance test scripts |
| Is there a test vs. live split? | No — `parent_tenant_id` is null; `environment = live`; this is the only tenant |

**Conclusion:** The 28 expense reports are acceptance test artefacts created today in this session against the live tenant. They are not from a previous session and there is no phantom or duplicate tenant. The UI is showing exactly what is in the database.
