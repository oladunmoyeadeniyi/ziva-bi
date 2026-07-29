# Bank Accounts PUT — Full 500 Traceback
**Date:** 2026-06-20  
**Reproduced via:** ASGI in-process test (`raise_app_exceptions=True`)

---

## Exact request reproduced

```
PUT /api/setup/bank-accounts/58cd583d-ab51-4c4b-bde8-3599d1a1ae8a
Content-Type: application/json

{
  "bank_name":      "Standard Chartered Bank",
  "account_name":   "Red Bull Nigeria Limited - USD",
  "account_number": "000666234",
  "currency":       "EUR",       ← changed from USD (account's current DB value)
  "gl_account_id":  "c1a5bddb-526d-460e-8ef6-6f70d5fbc3f5",
  "is_default":     true         ← "Default for currency" checked
}
```

---

## SQL emitted (in order)

```sql
-- 1. Load the account
SELECT bank_accounts.id, ..., bank_accounts.updated_at
FROM bank_accounts
WHERE bank_accounts.id = '58cd583d-...' AND bank_accounts.tenant_id = 'bd2c8a25-...'

-- 2. UPDATE fires because currency changed USD → EUR
--    NOTE: no RETURNING clause — SQLAlchemy marks updated_at as EXPIRED after this
UPDATE bank_accounts
SET currency='EUR', updated_at=now()
WHERE bank_accounts.id = '58cd583d-...'

-- 3. GL validation
SELECT chart_of_accounts.* FROM chart_of_accounts WHERE id = 'c1a5bddb-...'

-- 4. _unset_defaults: find other EUR defaults to unset
SELECT bank_accounts.* FROM bank_accounts
WHERE tenant_id='bd2c8a25-...' AND currency='EUR' AND is_default IS true
  AND id != '58cd583d-...'

-- 5. GL re-fetch for response (cached)
SELECT chart_of_accounts.* FROM chart_of_accounts WHERE id = 'c1a5bddb-...'

-- 6. ← CRASH HERE: synchronous lazy-load of expired updated_at attribute
SELECT bank_accounts.updated_at AS bank_accounts_updated_at
FROM bank_accounts WHERE bank_accounts.id = '58cd583d-...'
-- asyncpg raises MissingGreenlet because this is sync I/O inside an async context
```

---

## Full traceback

```
Traceback (most recent call last):

  File "app/routers/bank_accounts.py", line 257, in update_bank_account
    resp = _to_response(acct, gl)

  File "app/routers/bank_accounts.py", line 140, in _to_response
    updated_at=acct.updated_at,
               ^^^^^^^^^^^^^^^

  File "sqlalchemy/orm/attributes.py", line 569, in __get__
    return self.impl.get(state, dict_)

  File "sqlalchemy/orm/attributes.py", line 1096, in get
    value = self._fire_loader_callables(state, key, passive)

  File "sqlalchemy/orm/attributes.py", line 1126, in _fire_loader_callables
    return state._load_expired(state, passive)

  File "sqlalchemy/orm/state.py", line 828, in _load_expired
    self.manager.expired_attribute_loader(self, toload, passive)

  File "sqlalchemy/orm/loading.py", line 1674, in load_scalar_attributes
    result = load_on_ident(session, ...)

  File "sqlalchemy/orm/loading.py", line 510, in load_on_ident
    return load_on_pk_identity(session, ...)

  File "sqlalchemy/orm/loading.py", line 695, in load_on_pk_identity
    session.execute(q, ...)

  File "sqlalchemy/orm/session.py", line 2372, in execute
    return self._execute_internal(...)

  File "sqlalchemy/orm/context.py", line 306, in orm_execute_statement
    result = conn.execute(statement, ...)

  File "sqlalchemy/engine/base.py", line 1969, in _exec_single_context
    self.dialect.do_execute(cursor, str_statement, effective_parameters, context)

  File "sqlalchemy/dialects/postgresql/asyncpg.py", line 585, in execute
    self._adapt_connection.await_(
        self._prepare_and_execute(operation, parameters)
    )

  File "sqlalchemy/util/_concurrency_py3k.py", line 123, in await_only
    raise exc.MissingGreenlet(...)

sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called;
can't call await_only() here.
Was IO attempted in an unexpected place?
(https://sqlalche.me/e/20/xd2s)
```

---

## Mechanism

| Step | What happens |
|---|---|
| `UPDATE ... SET currency='EUR', updated_at=now()` | SQLAlchemy emits the UPDATE. No `RETURNING` clause. |
| After flush | SQLAlchemy marks `acct.updated_at` **expired** — it knows the DB value changed but doesn't know the new one. |
| `_to_response(acct, gl)` → `acct.updated_at` | ORM detects the attribute is expired; attempts synchronous refresh via `SELECT bank_accounts.updated_at WHERE id=...` |
| asyncpg inside async handler | Synchronous `session.execute()` call crosses into asyncpg; raises `MissingGreenlet`. |
| FastAPI catches unhandled exception | Returns 500. Exception surfaces **inside** `_BankRequestLogger` (our temp middleware), which sits outside `CORSMiddleware` — so CORS headers are never added to the 500 response. |
| Browser receives 500 without `Access-Control-Allow-Origin` | Browser treats it as a network-level failure → `TypeError: Failed to fetch`. |

---

## Why only when a field actually changes

SQLAlchemy only emits an UPDATE when at least one attribute is dirty. If the PUT body contains values identical to what's in the DB (no real changes), no UPDATE is generated, `updated_at` is never expired, the lazy-load is never triggered, and the handler returns 200. The crash only fires when the user makes a genuine edit — e.g., changing the currency dropdown.

## Why POST (Create) is not affected

`INSERT` with PostgreSQL implicitly adds `RETURNING id, created_at, updated_at`, so SQLAlchemy gets the server-generated timestamps back immediately after the insert flush. `UPDATE` does not use `RETURNING` by default, so the timestamps are not refreshed after the flush.

---

## Fix (one line — not applied yet)

```python
# bank_accounts.py — update_bank_account, after await db.flush()
await db.flush()
await db.refresh(acct)   # ← re-fetches row async; updated_at is populated before _to_response
```
