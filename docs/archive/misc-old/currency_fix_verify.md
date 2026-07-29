# Currency Fix — Verification Results
**Date:** 2026-06-20  
**Migration:** `f2g3h4i5j6k7` — currency single source of truth

---

## 1. Alembic current

```
f2g3h4i5j6k7 (head)
```

**DB is at head. No gap.**

---

## 2. HTTP status — three endpoints

| Endpoint | Status | Body (abbreviated) |
|---|---|---|
| `GET /api/setup/currencies` | **200** | `{"functional_currency":"NGN","enabled_currencies":["EUR","NGN"],"reporting_currency":"EUR","fx_rates":null,"revaluation_rules":null}` |
| `GET /api/setup/org` | **200** | includes `"functional_currency":"NGN"`, `"reporting_currency":"EUR"` |
| `GET /api/setup/bank-accounts` | **200** | returns NGN account (Standard Charter Bank) |

All three were 500 before the migration was applied. All three are 200 now.

---

## 3. Red Bull — tenant_org_config after migration

| Field | Value |
|---|---|
| `functional_currency` | `NGN` |
| `reporting_currency` | `EUR` (synced from `tenant_fx_config.reporting_currency` by migration step 2) |
| `enabled_currencies` | `["EUR", "NGN"]` (backfilled by migration step 3) |

USD is not present — it was never stored in any currency table for this tenant and was not added during this migration. It can be added via the Currencies & FX tab.

---

## 4. Dropped columns — tenant_fx_config

Remaining columns after migration:

```
id, tenant_id, fx_rates, revaluation_rules, updated_at
```

| Column | Status |
|---|---|
| `functional_currency` | **DROPPED** — confirmed absent |
| `additional_currencies` | **DROPPED** — confirmed absent |
| `reporting_currency` | **DROPPED** — confirmed absent |

`tenant_fx_config` now holds only FX mechanics (`fx_rates`, `revaluation_rules`). No currency-list data remains there.
