# Diagnosis — Currency Consolidation Break
**Date:** 2026-06-20  
**Triggered by:** Migration `f2g3h4i5j6k7` created but NOT applied to DB before uvicorn reloaded the new model code.

---

## (1) Uvicorn Status

**Port 8000 is LISTENING** (`TCP 127.0.0.1:8000 LISTENING`).  
Three Python processes are running (PIDs 18424, 8204, 8936 — one is the watcher, two are workers).

**Last log file:** `backend/uvicorn_err.txt` — shows startup on port 8001 on 2026-06-16.  
**Main log file:** `backend/uvicorn_out.txt` — last entry is 2026-06-17 00:03:38. No new entries after that, meaning either:
- The log is redirected to a different file/stdout from the terminal where it's running, OR  
- The process was restarted and is logging to the console only.

**Did uvicorn restart after the migration?**  
YES. Uvicorn runs with `--reload`. When `backend/app/models/setup.py` was updated on 2026-06-20 (adding `enabled_currencies` to `TenantOrgConfig`, removing three columns from `TenantFxConfig`), uvicorn auto-reloaded. The new model code is now live.

**Startup errors on reload:** None on import. The error manifests only at request time when SQLAlchemy tries to execute a SELECT that includes `tenant_org_config.enabled_currencies`.

---

## (2) Actual Error / Traceback

**Every endpoint that queries `TenantOrgConfig` returns HTTP 500.**  
SQLAlchemy generates a SELECT listing all mapped columns. Because `enabled_currencies` is in the model but NOT in the database, PostgreSQL rejects the query.

**Exact PostgreSQL error (reproduced directly):**
```
sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError
asyncpg.exceptions.UndefinedColumnError:
  column tenant_org_config.enabled_currencies does not exist

SQL: SELECT tenant_org_config.id, tenant_org_config.tenant_id, ...,
     tenant_org_config.enabled_currencies, ... FROM tenant_org_config
     WHERE tenant_org_config.tenant_id = $1::UUID
```

**SQLAlchemy also tries to SELECT `default_audit_grace_months`** in the same query — that column IS present in DB (added by earlier migration `w3x4y5z6a7b8`), so it does not cause an additional error.

**Endpoint results with a valid token:**

| Endpoint | HTTP Status | Error |
|---|---|---|
| `GET /api/setup/currencies` | **500** | UndefinedColumnError: enabled_currencies |
| `GET /api/setup/org` | **500** | UndefinedColumnError: enabled_currencies |
| `GET /api/setup/bank-accounts` | **500** | UndefinedColumnError: enabled_currencies |
| `GET /api/hr/employees` | **500** | UndefinedColumnError: enabled_currencies |
| `GET /api/setup/progress` | **500** | UndefinedColumnError: enabled_currencies |
| `GET /api/config/cost-centers` | 404 | Route not found (unrelated) |
| `POST /api/auth/login` | 401 | Bad credentials (server is alive) |

The auth endpoints (login, signup) are unaffected because they don't query `TenantOrgConfig` on every call — but the post-login redirect to the dashboard will immediately fail on `progress` / `org` / `currencies`.

---

## (3) Alembic Current vs Head — DB Columns vs Model

### Alembic revision state

| Item | Revision |
|---|---|
| **DB current** | `e1f2g3h4i5j6` (bank_accounts migration, 2026-06-19) |
| **Head** | `f2g3h4i5j6k7` (currency single source of truth, 2026-06-20) |
| **Gap** | **1 unapplied migration** — `f2g3h4i5j6k7` has never been run |

### tenant_org_config: DB columns vs model

| Column | In DB | In Model | Match? |
|---|---|---|---|
| id | ✅ | ✅ | ✓ |
| tenant_id | ✅ | ✅ | ✓ |
| legal_name | ✅ | ✅ | ✓ |
| functional_currency | ✅ | ✅ | ✓ |
| reporting_currency | ✅ | ✅ | ✓ |
| **enabled_currencies** | ❌ **MISSING** | ✅ mapped_column(JSONB) | **MISMATCH → 500** |
| block_journal_into_open_prior | ✅ | ✅ | ✓ |
| default_audit_grace_months | ✅ | ✅ | ✓ |
| org_structure *(old column)* | ✅ in DB | ❌ removed from model | benign (SQLAlchemy ignores extra DB cols) |
| period_frequency *(old column)* | ✅ in DB | ❌ not in model | benign |

**Root cause: `enabled_currencies` is mapped in the ORM model but the column doesn't exist in the database yet because migration `f2g3h4i5j6k7` has not been run.**

### tenant_fx_config: DB columns vs model

| Column | In DB | In Model | Match? |
|---|---|---|---|
| id | ✅ | ✅ | ✓ |
| tenant_id | ✅ | ✅ | ✓ |
| **functional_currency** | ✅ still in DB | ❌ removed from model | benign (SQLAlchemy ignores extra DB cols) |
| **reporting_currency** | ✅ still in DB | ❌ removed from model | benign |
| **additional_currencies** | ✅ still in DB | ❌ removed from model | benign |
| fx_rates | ✅ | ✅ | ✓ |
| revaluation_rules | ✅ | ✅ | ✓ |

The fx_config side causes no immediate error — SQLAlchemy simply won't include the orphaned columns in its SELECTs. They'll be dropped when the migration is applied.

---

## (4) Grep — Remaining Code References to Dropped tenant_fx_config Columns

**Search: `additional_currencies` anywhere in `backend/app/`:**
```
No matches found
```
✅ CLEAN — no code reads `additional_currencies` from `tenant_fx_config`.

**Search: `fx.functional_currency`, `fx.reporting_currency` in `frontend/src/`:**
```
No matches found
```
✅ CLEAN.

**Legitimate remaining references to `functional_currency` / `reporting_currency` in backend/app:**
All hits are on `TenantOrgConfig` columns or Pydantic schemas — correct and expected:
- `app/models/setup.py:292–293` — `TenantOrgConfig.functional_currency`, `TenantOrgConfig.reporting_currency` (correct)
- `app/routers/auth.py:249,252` — seeds `TenantOrgConfig.functional_currency` at signup (correct)
- `app/routers/setup.py:248–253` — `_get_or_create_org` seeds functional_currency (correct)
- `app/routers/setup.py:309–310` — `_org_to_response` reads from org (correct)
- `app/routers/setup.py:389,432,550,615` — reads `org.functional_currency` for progress/lock checks (correct)
- `app/routers/setup.py:2632,2634` — `get_currencies` returns from org_config (correct)
- `app/routers/setup.py:2661–2662` — `patch_currencies` routes `reporting_currency` to org_config (correct)
- `app/routers/tenant.py:322` — promote copies `enabled_currencies` + `reporting_currency` from org (correct)
- `app/schemas/setup.py:63,114–115` — OrgConfigUpdate / OrgConfigResponse fields (correct)
- `app/schemas/setup.py:462,475,477` — FxConfigUpdate / FxConfigResponse fields (correct)

**No stray reads of the dropped fx_config columns anywhere in application code.**

---

## (5) Red Bull actual DB state — tenant_org_config.enabled_currencies + functional_currency

**As of 2026-06-20, before the migration is applied:**

| Field | Source table | Value |
|---|---|---|
| `functional_currency` | `tenant_org_config` | **NGN** |
| `reporting_currency` | `tenant_org_config` | **NULL** |
| `enabled_currencies` | `tenant_org_config` | **column does not exist yet** |
| `functional_currency` | `tenant_fx_config` | NULL |
| `reporting_currency` | `tenant_fx_config` | **EUR** |
| `additional_currencies` | `tenant_fx_config` | **null** (never populated) |
| `currency` (distinct) | `bank_accounts` | **["NGN"]** |

**Simulated backfill result** (what `f2g3h4i5j6k7` WILL write when applied):

```json
enabled_currencies = ["EUR", "NGN"]
```

Sources merged:
- NGN → from `org.functional_currency`
- EUR → from `fx.reporting_currency`
- Additional currencies → null (nothing to merge)
- Bank accounts → NGN (already covered)
- **USD is not present in any currency store** — it was never configured for this tenant

Note: The original bug report ("USD missing from bank dropdown") reflects USD having been expected but never actually saved to any currency table. After migration, enabled_currencies will show `["EUR", "NGN"]`. To get USD in the list, it must be explicitly added via the Currencies & FX tab after the migration is applied.

---

## Root Cause Summary

```
Model updated (enabled_currencies added)  ──→  uvicorn --reload fires
                                                       │
                                         New code running in memory
                                                       │
                                  SQLAlchemy SELECT includes enabled_currencies
                                                       │
                             DB column does not exist (migration not run)
                                                       │
                                         asyncpg UndefinedColumnError
                                                       │
                              HTTP 500 on every request touching TenantOrgConfig
```

## Fix

Run the migration:
```bash
cd backend
alembic upgrade head
```

This will:
1. Add `enabled_currencies JSONB` to `tenant_org_config`
2. Sync `reporting_currency` from fx_config → org_config where org is null (Red Bull gets EUR)
3. Backfill `enabled_currencies` for all tenants (Red Bull gets `["EUR", "NGN"]`)
4. Drop `functional_currency`, `additional_currencies`, `reporting_currency` from `tenant_fx_config`

After the migration, restart uvicorn (or let `--reload` pick it up) and all 500s will be resolved.
