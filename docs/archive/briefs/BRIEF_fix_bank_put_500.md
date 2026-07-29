Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Fix bank-accounts PUT 500 (MissingGreenlet on updated_at) + cleanup

**Root cause (confirmed via traceback):** In `update_bank_account`, after the UPDATE flush, SQLAlchemy expires `acct.updated_at` (UPDATE has no RETURNING). `_to_response` then reads `acct.updated_at`, triggering a synchronous lazy-load inside the async context → `sqlalchemy.exc.MissingGreenlet` → 500. The 500 reached the browser without CORS headers (temp logging middleware sat outside CORSMiddleware) → appeared as "Failed to fetch / CORS". Create (POST) is unaffected because INSERT uses RETURNING.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/routers/bank_accounts.py` — the PUT handler `update_bank_account` (the flush + `_to_response` call, ~line 257) and `_to_response` (~line 140, reads acct.updated_at). Confirm where the flush happens and whether any `db.refresh` is already called. Also check the POST/create handler for comparison (it works — confirm why, RETURNING).
- Confirm there's any TEMPORARY debug middleware/logging added during diagnosis (e.g. `_BankRequestLogger`, put_debug.log writes). Report every temp artifact added for debugging so it can be removed.
- `backend/app/main.py` — the middleware order, specifically CORSMiddleware: confirm it's registered and where, relative to any other middleware. Report the order. (Goal: ensure error responses still get CORS headers.)
Report findings before editing.

---

## Fix

### 1. The actual bug (primary)
In `update_bank_account`, after `await db.flush()` and before building the response, refresh the instance so expired attributes (updated_at) are populated asynchronously:
```python
await db.flush()
await db.refresh(acct)
```
Place it so `acct.updated_at` (and any other expired column) is loaded before `_to_response(acct, gl)` reads it. Verify `_to_response` no longer triggers a lazy-load. (If there are other endpoints in this router with the same flush→read-updated_at pattern, e.g. a default-toggle or the create path's response, apply the same guard where an UPDATE—not insert—precedes reading server-side timestamps. State which you touched.)

Alternative considered (state if you prefer it): expire_on_commit / eager attribute; but `await db.refresh(acct)` is the clean, explicit fix — use it unless you justify otherwise.

### 2. Remove ALL temporary debugging artifacts
Remove every temporary thing added during diagnosis: `_BankRequestLogger` (or any temp middleware), put_debug.log writes, any added print/logging that was only for this investigation. Return the code to clean state + just the fix. List each artifact removed.

### 3. Ensure error responses carry CORS headers (hardening)
The 500 reached the browser without CORS headers, masking the real error as "CORS". Ensure CORSMiddleware is positioned so that even error/500 responses get the Access-Control-Allow-Origin header (CORSMiddleware should be the OUTERMOST relevant middleware so it wraps responses including errors). If any custom middleware was sitting outside CORS and swallowing/short-circuiting, fix the order. Do NOT broaden CORS origins — keep the existing hardcoded http://localhost:3000 allow-list; only fix ORDER so errors are wrapped. Confirm a deliberately-triggered 500 now returns with CORS headers present. (If middleware order is already correct and the only reason headers were missing was the temp middleware — which is now removed — state that and confirm no further change needed.)

---

## Files CC may modify
- `backend/app/routers/bank_accounts.py` — add `await db.refresh(acct)`; remove temp logging.
- `backend/app/main.py` — ONLY if middleware order needs fixing for CORS-on-error; remove any temp middleware. Keep allowed origins unchanged (http://localhost:3000 hardcoded).
- Delete any temp log file artifacts (put_debug.log) if created in the repo.

Do NOT: change the BankAccount model/schema, the validation logic, currency/GL logic, `config.py`/`ziva_dev`, or broaden CORS origins. No migration.

---

## House rules
- `await db.refresh(acct)` (or justified equivalent) fixes the PUT; no lazy-load in async context.
- ALL temporary debug artifacts removed; code back to clean + fix only.
- CORS allow-list unchanged (localhost:3000); only order fixed so errors carry headers.
- Backend imports clean; uvicorn reloads without error.

---

## Acceptance / test steps (state pass/fail each)
1. PUT /api/setup/bank-accounts/{id} changing currency (a real change) → 200 (was 500); response includes updated_at.
2. PUT with is_default=true correctly unsets other defaults for that currency AND returns 200.
3. PUT with no actual changes → still 200 (regression check).
4. POST (create) still 200 (unchanged).
5. From the browser: editing the account currency + clicking Update succeeds (no "Failed to fetch"); the row updates in the list.
6. A deliberately-triggered backend error returns WITH CORS headers present (or: confirm temp middleware was the only cause and order is already correct).
7. All temp debug artifacts removed (grep for _BankRequestLogger / put_debug — none remain).
8. Backend imports clean; no migration.

---

## Completion summary required
List every file changed. State: exactly where db.refresh was added + that _to_response no longer lazy-loads; every temporary debug artifact removed; the CORS finding (was order wrong, or was it only the temp middleware) and what you did; confirm allow-list unchanged; confirm PUT now 200 from browser; confirm create still works; confirm no model/schema/migration changes. Report acceptance pass/fail.
