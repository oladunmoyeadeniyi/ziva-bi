Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Bank Accounts register (backend + setup UI) + journal-line bank tagging

**Scope:** A master-data register of bank/cash accounts (multiple per currency), each linked to a GL (shared or unique) with a default-per-currency flag. Plus a nullable `bank_account_id` tag on journal lines so transactions can be reconciled/reported per individual bank account even when GLs are shared. Replaces the removed default_bank/cash roles. Reconciliation tooling itself is a LATER module — this is the register + tagging readiness.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- The **currency model**: where tenant currencies live (search for currency tables/models — the Currencies & FX setup page implies a model; report the table name, PK type, and how a tenant's enabled currencies are represented). Bank accounts FK or reference currency by this.
- `backend/app/models/master_data.py` — ChartOfAccount (gl_number, gl_name, account_type, is_active, tenant_id) — bank accounts link to a GL here.
- `backend/app/models/gl.py` — JournalLine (add nullable bank_account_id). Confirm structure.
- `backend/app/services/gl_posting.py` + `backend/app/schemas/gl.py` — JournalLineInput; add optional bank_account_id passthrough.
- `backend/app/routers/setup.py` — admin guard pattern + how setup config tables/endpoints are structured; the FINANCIALS nav.
- A reference setup model+router+migration for style (e.g. dimensions or cost centers).
Report findings (esp. the currency model) before editing.

---

## Build

### A. BankAccount model (new — `backend/app/models/bank_account.py` or near setup; state where)
`bank_accounts`, tenant-scoped:
- id (uuid pk), tenant_id (FK, indexed),
- bank_name (String), account_name (String), account_number (String),
- currency reference (FK or code — match how currencies are modelled; state choice),
- gl_account_id (FK → chart_of_accounts.id) — the GL this account posts to (may be shared across bank accounts OR unique; do NOT enforce uniqueness — multiple bank accounts may share a GL),
- is_default (Boolean) — default account for its currency,
- is_active (Boolean, default true),
- created_by, timestamps.
Constraint: at most ONE is_default = true per (tenant_id, currency). Enforce in app logic (setting a new default unsets the previous) and/or a partial unique index — state how.
Validation note: the linked GL should be a Balance Sheet account (account_type in {BS, SOFP}); validate on create/update (warn/block — block, consistent with mapping validation).

Migration additive + reversible.

### B. Journal line bank tagging
- Add nullable `bank_account_id` (FK → bank_accounts.id, ondelete SET NULL, indexed) to JournalLine in `gl.py`. Migration additive.
- Extend `JournalLineInput` (schemas/gl.py) with optional `bank_account_id`.
- In `gl_posting.py` post_journal: if a line has bank_account_id, validate it exists + belongs to tenant + is active, then persist it on the line. Optional/nullable — lines without it are unaffected. (No other posting behaviour changes.)
- Purpose: per-account reconciliation/reporting later. State that this is just capture; rec tooling is a future module.

### C. Endpoints (`backend/app/routers/bank_accounts.py`, prefix `/api/setup/bank-accounts`)
Guard: same admin pattern as other setup (_require_admin + _require_tenant). 
- GET `/api/setup/bank-accounts` — list tenant's bank accounts (with gl_number/gl_name, currency, is_default, is_active).
- POST `/api/setup/bank-accounts` — create (validate GL is BS + belongs to tenant; if is_default, unset others for that currency).
- PUT `/api/setup/bank-accounts/{id}` — update (same validations; default handling).
- DELETE `/api/setup/bank-accounts/{id}` — soft-delete (set is_active=false) if referenced by any journal line; hard-delete only if unreferenced. State which you did.
Register router in main.py.

### D. Setup UI (`/dashboard/business/setup/bank-accounts`)
- Add to FINANCIALS nav (near Currencies & FX / Chart of accounts).
- Group the list **by currency** (NGN, USD, EUR…), showing each account: bank name, account name/number, mapped GL (gl_number — gl_name), a default badge, active toggle.
- Add/Edit form: bank name, account name, account number, currency (from tenant currencies), GL picker (searchable, filtered to BS/SOFP accounts — reuse the combobox approach from account-mapping; multiple accounts may share a GL so do NOT prevent reuse), is_default checkbox.
- Show clearly which is the default per currency; setting a new default unsets the old.
- Consistent with existing setup pages; admin-gated by the setup layout.

---

## Files CC may modify/create
- `backend/app/models/bank_account.py` (NEW) + register for metadata.
- `backend/app/models/gl.py` — add bank_account_id to JournalLine.
- `backend/app/services/gl_posting.py` + `backend/app/schemas/gl.py` — optional bank_account_id on a line.
- `backend/app/routers/bank_accounts.py` (NEW) + register in main.py.
- `backend/app/schemas/bank_account.py` (NEW).
- `backend/alembic/versions/<new>` (bank_accounts table + journal_lines.bank_account_id).
- `frontend/src/app/dashboard/business/setup/bank-accounts/page.tsx` (NEW).
- `frontend/src/app/dashboard/business/layout.tsx` — FINANCIALS nav link.

Do NOT: touch the account-mapping catalogue, period/CoA logic, `config.py`/`ziva_dev`, CORS. Don't build reconciliation tooling. Don't change existing posting behaviour beyond the optional bank tag.

---

## House rules
- Migrations up/down clean (two additive changes: table + column). Manual uvicorn restart.
- One default per currency enforced. GL must be BS/SOFP. Multiple accounts may share a GL.
- bank_account_id on lines is optional; existing posting unaffected.
- type-check 0 (frontend).

---

## Acceptance / test steps (state pass/fail each)
1. Create 5 NGN + 3 USD + 1 EUR bank accounts (script or UI); list groups them by currency.
2. Setting a second NGN account as default unsets the first; only one default per currency.
3. GL validation: linking a non-BS (SOCI) account → blocked.
4. Two bank accounts sharing one GL is allowed.
5. post_journal with a line carrying bank_account_id persists it; an invalid/other-tenant bank_account_id → PostingError; lines without it still post.
6. UI: add/edit/list/default/active all work; GL picker searchable + BS-filtered.
7. Migrations up/down clean; frontend type-check 0.

---

## Completion summary required
List every file created/changed. State: the currency model used + how bank accounts reference it; how one-default-per-currency is enforced; GL BS-validation; delete strategy (soft vs hard); how bank_account_id was added to lines + validated in post_journal (confirm existing posting unaffected); confirm reconciliation tooling deferred; migrations clean; type-check 0. Report acceptance pass/fail.
