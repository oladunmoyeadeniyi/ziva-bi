Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — GL Engine #2: trial balance + account ledger (read endpoints)

**Scope:** Backend only. Read-side of the GL: compute account balances on demand by summing POSTED journal lines, and expose a trial balance + a per-account ledger. No running balances (compute on demand). POSTED entries only. No UI in this brief.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/gl.py` — JournalEntry (status, entry_date, tenant_id) + JournalLine (gl_account_id, debit, credit, dimensions JSONB, journal_entry_id).
- `backend/app/models/master_data.py` — ChartOfAccount (gl_number, gl_name, account_type 'PL'/'BS', is_active, tenant_id). The TB lists accounts from here.
- `backend/app/services/gl_posting.py` — confirm posted entries have status "POSTED" and posted_at.
- `backend/app/routers/setup.py` or wherever financial read endpoints live — the router/auth pattern (_require_admin etc.), how tenant_id is scoped, response patterns.
- `backend/app/middleware/auth.py` — CurrentUser, require_auth.
Report findings before editing.

---

## Build

### A. Service (new file `backend/app/services/gl_reporting.py`)
Pure read/compute functions, POSTED entries only, tenant-scoped:

1. **trial_balance(db, tenant_id, *, date_from=None, date_to=None)** → list of per-account rows:
   - gl_number, gl_name, account_type, total_debit, total_credit, balance (debit_total − credit_total; positive = net debit, negative = net credit), 
   - Only accounts that have at least one posted line in range OR all active accounts (include zero-activity accounts? RECOMMEND: include only accounts with activity in range by default, but accept an `include_zero` flag to list all active accounts. State choice.)
   - Also return grand totals: sum_debit, sum_credit, and an `is_balanced` flag (sum_debit == sum_credit to 2dp) — should always be true if posting enforced balance, but surface it as a integrity check.
   - date_from/date_to filter on JournalEntry.entry_date (inclusive). If both None → all time.

2. **account_ledger(db, tenant_id, gl_account_id, *, date_from=None, date_to=None, dimension_filter=None)** → 
   - Account header (gl_number, gl_name, account_type).
   - Opening balance: sum of debits−credits for posted lines with entry_date < date_from (0 if no date_from).
   - Lines: each posted line hitting this account, ordered by entry_date then reference_number: entry_date, reference_number, journal description, line description, debit, credit, dimensions, and a running_balance (opening + cumulative debit−credit down the list).
   - Closing balance = opening + Σ(debit−credit) in range.
   - dimension_filter optional: {tenant_dimension_id: dimension_value_id} → only lines whose dimensions JSONB contains that pair (use JSONB @> containment). State how you query it.

Money as Decimal/Numeric(18,2) throughout; never float.

### B. Endpoints (new router `backend/app/routers/gl.py`, prefix `/api/gl`)
Guard: authenticated tenant users (require_auth). (Fine-grained "finance only" RBAC is future — for now any authenticated business user in the tenant; super admin impersonating works too. State the guard used.)

1. `GET /api/gl/trial-balance?date_from=&date_to=&include_zero=` → the trial_balance result (rows + grand totals + is_balanced).
2. `GET /api/gl/accounts/{gl_account_id}/ledger?date_from=&date_to=&dimension_id=&dimension_value_id=` → account_ledger result. Validate the account exists + belongs to tenant (404 otherwise).

Schemas in `backend/app/schemas/gl.py` (extend the existing file): TrialBalanceRow, TrialBalanceResponse, LedgerLine, AccountLedgerResponse.

Register the router in the app (wherever routers are included). State where.

### C. No UI, no writes
Read-only. No new tables, no migration. No changes to the posting service or models (read them only).

---

## Files CC may modify/create
- `backend/app/services/gl_reporting.py` (NEW)
- `backend/app/routers/gl.py` (NEW)
- `backend/app/schemas/gl.py` (extend)
- wherever routers are registered (include gl router).

Do NOT: touch gl.py models, gl_posting.py, CoA/period logic, frontend, `config.py`/`ziva_dev`, CORS. No migration. No running-balance storage.

---

## House rules
- POSTED entries only (ignore DRAFT/REVERSED appropriately — state how REVERSED is treated; recommend: exclude REVERSED entries and their reversing pairs net to zero naturally — for now just include POSTED, exclude DRAFT and REVERSED).
- Decimal money, 2dp. Tenant-scoped every query.
- trial_balance grand totals must balance (surface is_balanced).

---

## Acceptance / test steps (state pass/fail each — via script/pytest using entries posted by Brief 1's service)
1. Post a few balanced entries (via post_journal), then GET trial-balance → rows show correct per-account debit/credit/balance; grand totals balance (is_balanced true).
2. date_from/date_to filters the TB correctly.
3. account ledger for an account → opening balance, lines with correct running_balance, closing balance correct.
4. dimension_filter narrows ledger lines to matching dimension pair.
5. DRAFT entries excluded from both TB and ledger.
6. Nonexistent/other-tenant account → 404.

---

## Completion summary required
List every file created/changed. State: the guard used on the endpoints; include_zero default choice; how REVERSED entries are treated; how dimension_filter queries JSONB; confirm POSTED-only; confirm Decimal money; confirm no migration/model/posting changes; where the router is registered. Report acceptance pass/fail.
