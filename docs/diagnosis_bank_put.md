# Diagnosis — Bank Accounts PUT 500 on Update
**Date:** 2026-06-20

---

## Root cause

```
sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called;
can't call await_only() here.
```

**File:** `backend/app/routers/bank_accounts.py`, line 140 (`_to_response`)  
**Triggered by:** `updated_at=acct.updated_at`

### Sequence

1. `PUT /api/setup/bank-accounts/{id}` is called; handler loads `acct` from DB.
2. Handler modifies a field (e.g., `acct.currency = 'EUR'` when it was `'USD'`).
3. `await db.flush()` runs, emitting:
   ```sql
   UPDATE bank_accounts SET currency=$1, updated_at=now() WHERE id=$2
   ```
   **No `RETURNING` clause.** SQLAlchemy marks `acct.updated_at` as *expired*
   (it knows the DB value changed via `onupdate=func.now()` but doesn't know the new value).
4. `_to_response(acct, gl)` accesses `acct.updated_at`.
5. SQLAlchemy tries to **synchronously lazy-load** the expired attribute by issuing
   `SELECT bank_accounts.* WHERE id=$1`.
6. Inside an async context (asyncpg), the synchronous DB call raises
   `MissingGreenlet` → FastAPI catches it → **HTTP 500**.
7. FastAPI's error middleware runs **inside** `_BankRequestLogger`, so the CORS
   headers that `CORSMiddleware` would normally add are never set → the browser sees
   a CORS-less 500 → reports it as `TypeError: Failed to fetch`.

---

## Why some updates appeared to succeed

Our server-side tests and some browser clicks sent values **identical to what was already in the DB**.
SQLAlchemy detects no dirty attributes → generates no UPDATE → `updated_at` is never expired →
no lazy-load → 200.

The crash only fires when **any field value actually changes**:
- Changing `currency` from `USD` → `EUR` ✓ (reproduces 500)
- Changing any of `bank_name`, `account_name`, `account_number`, `is_active` → same crash

---

## Why POST (Create) is unaffected

For INSERT, SQLAlchemy automatically appends `RETURNING id, created_at, updated_at` to get
back server-generated values. After the INSERT flush, `acct.updated_at` is populated directly
— no lazy-load needed. This is PostgreSQL/SQLAlchemy's implicit-RETURNING path for INSERTs.

For UPDATE, SQLAlchemy does **not** add `RETURNING` by default. The `onupdate=func.now()`
column is included in the SET clause but the new value is never fetched back — hence the expiry.

---

## Reproduction (ASGI)

```python
# PUT with a real field change → 500
r = await c.put(
    '/api/setup/bank-accounts/58cd583d-ab51-4c4b-bde8-3599d1a1ae8a',
    headers={...},
    content=json.dumps({
        'bank_name': 'Standard Chartered Bank',
        'currency': 'EUR',       # changed from USD in DB → UPDATE fires → crash
        'gl_account_id': '...',
        'is_default': True,
    })
)
assert r.status_code == 500   # ← confirmed
```

```python
# PUT with no real field change → 200 (UPDATE never runs)
r = await c.put(..., content=json.dumps({'currency': 'USD', ...}))  # same as DB
assert r.status_code == 200   # ← confirmed
```

---

## Exact exception traceback (abbreviated)

```
File "bank_accounts.py", line 257, in update_bank_account
    resp = _to_response(acct, gl)
File "bank_accounts.py", line 140, in _to_response
    updated_at=acct.updated_at,
File "sqlalchemy/orm/attributes.py", line 569, in __get__
    return self.impl.get(state, dict_)
File "sqlalchemy/orm/attributes.py", line 1096, in get
    value = self._fire_loader_callables(state, key, passive)
...
File "sqlalchemy/util/_concurrency_py3k.py", line 123, in await_only
    raise exc.MissingGreenlet(...)
sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called;
can't call await_only() here.
```

---

## Fix

Add `await db.refresh(acct)` after `await db.flush()` in `update_bank_account`.
This re-fetches the row asynchronously, populating `updated_at` with the
server-generated value before `_to_response` accesses it.

```python
# bank_accounts.py — update_bank_account handler
await db.flush()
await db.refresh(acct)          # ← add this line

gl_res = await db.execute(...)
gl    = gl_res.scalar_one()
return _to_response(acct, gl)
```

The same fix should be applied to `create_bank_account` (POST) as a precaution,
even though INSERT uses RETURNING — explicit `refresh` is safer and future-proof.

---

## Affected files

- `backend/app/routers/bank_accounts.py` — `update_bank_account` (line ~247)
- Same pattern exists in the `delete_bank_account` handler via `acct.is_active`
  (soft-delete path), though it does not call `_to_response` so the crash hasn't
  surfaced there yet.

---

## Temporary logging added (remove after fix is applied)

- `backend/app/routers/bank_accounts.py` — `_dbg` logger + `[PUT_BANK]` / `[BANK_REQ]` entries writing to `backend/put_debug.log`
- `backend/app/main.py` — `_BankRequestLogger` middleware (logs all bank-accounts requests)

Both are marked `# TEMPORARY` in the code and should be removed once the `await db.refresh(acct)` fix is committed.
