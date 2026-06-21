Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — GL Engine #1: journal model + central posting service

**Scope:** Backend only. Build the general-ledger journal data model (header + balanced lines, dimensions per line) and ONE central posting service that every future module calls. This is the financial core. No UI in this brief. No module wiring yet (expense wiring is a later brief).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/master_data.py` — `ChartOfAccount` (gl_number, gl_name, account_type 'PL'/'BS', is_active, tenant_id), `TenantDimension`, `DimensionValue`, `GLDimensionRequirement` (per GL: requirement 'required'/'optional'/'na' per dimension). Journal lines reference ChartOfAccount.id and DimensionValue.id.
- `backend/app/services/periods.py` — `is_date_postable(target_date, tenant_id, db, module=...) -> tuple[bool, str]` (confirm exact signature + params). Posting MUST call this before writing.
- `backend/app/models/auth.py` — Tenant, User (for created_by, tenant scoping pattern).
- How other models declare tenant_id FK + Base + migrations (follow the same patterns).
- `backend/app/database.py` (get_db / AsyncSession), an existing service for style reference.
Report findings (exact is_date_postable signature, ChartOfAccount PK type) before editing.

---

## Build

### A. Data model (new file `backend/app/models/gl.py`)
Two tables, tenant-scoped (tenant_id FK, indexed), following existing model patterns:

**JournalEntry (header)** — `journal_entries`:
- id (uuid pk), tenant_id (FK), 
- entry_date (Date) — the accounting/posting date,
- description (String),
- source (String) — e.g. "manual", "expense", "ap", "fx", "year_end" (free string for now; the calling module sets it),
- source_reference (String, nullable) — e.g. the expense report number or document id,
- reference_number (String) — system-generated human journal number, unique per tenant (e.g. "JE-2026-000123"); state how you generate it (per-tenant sequence or count-based).
- status (String) — 'DRAFT' or 'POSTED' or 'REVERSED' (immutable once POSTED; corrections via reversing entries only — reversal flow is a LATER brief, but include the status enum + a nullable `reversed_by_entry_id` / `reverses_entry_id` self-FK pair now so the schema is ready).
- environment (String) if tenants carry environment (live/test) — match how other tenant-scoped financial tables handle it; if not applicable, skip. State choice.
- created_by (FK user, nullable), created_at, posted_at (nullable).

**JournalLine** — `journal_lines`:
- id (uuid pk), tenant_id (FK), journal_entry_id (FK → journal_entries, ondelete CASCADE, indexed),
- gl_account_id (FK → chart_of_accounts.id),
- debit (Numeric(18,2), default 0), credit (Numeric(18,2), default 0) — exactly one side non-zero per line; both zero invalid,
- description (String, nullable) — optional line narration,
- line_number (Integer) — ordering within the entry,
- dimensions — store per-line dimension values. Use a JSONB column `dimensions` mapping {tenant_dimension_id: dimension_value_id} OR a child table `journal_line_dimensions`. RECOMMEND JSONB for v1 simplicity (queryable, flexible) unless you see a strong reason for a child table — state your choice + reasoning.
- relationship back to JournalEntry.

Add a migration (additive, reversible). Set $env:DATABASE_URL before alembic.

### B. Central posting service (new file `backend/app/services/gl_posting.py`)
One function the whole app uses to post journals. Signature roughly:
```
async def post_journal(
    db, tenant_id, *, entry_date, description, source, source_reference=None,
    lines: list[JournalLineInput], created_by=None, environment=None,
    module="manual",   # passed to is_date_postable
    status="POSTED",   # allow creating DRAFT vs POSTED
) -> JournalEntry
```
Where `JournalLineInput` is a small dataclass/pydantic: gl_account_id, debit, credit, description?, dimensions?.

The service MUST enforce, in order, raising a clear domain error (define a `PostingError` exception) on any failure:
1. **At least 2 lines.**
2. **Each line:** exactly one of debit/credit > 0, the other 0; no negative amounts.
3. **Balance:** Σ debits == Σ credits (to 2 dp). Reject if not balanced.
4. **Accounts valid:** every gl_account_id exists, is_active, belongs to this tenant.
5. **Dimensions valid:** any provided dimension_value_id exists + belongs to tenant; and satisfy GLDimensionRequirement — if a GL marks a dimension 'required', that dimension MUST be present on the line; 'na' must be absent; 'optional' either. (If this is heavy, implement required-check now and note optional/na refinement — but attempt full.)
6. **Date postable:** call `is_date_postable(entry_date, tenant_id, db, module=module)`; if False, raise PostingError with the returned reason.
7. Only after all checks pass: create the JournalEntry (generate reference_number) + lines; set status; set posted_at if POSTED. Return the entry.

Posting is transactional — if any check fails, nothing is written (let the caller's db transaction roll back; don't commit inside the service — flush only, matching the app's pattern). State how the app commits (router-level) so this fits.

Provide a `PostingError` with a machine code + message so callers/UI can surface it.

### C. No router/UI, no module wiring
This brief is the model + service only. A minimal internal test path is fine (a pytest or a scripted check), but no API endpoint and no expense wiring yet.

---

## Files CC may modify/create
- `backend/app/models/gl.py` (NEW)
- `backend/app/services/gl_posting.py` (NEW)
- `backend/app/schemas/gl.py` (NEW — JournalLineInput, any DTOs)
- `backend/alembic/versions/<new>` (NEW migration)
- Register the new models wherever models are imported for metadata (state where).

Do NOT: touch existing CoA/periods/dimensions logic, routers, frontend, `config.py`/`ziva_dev`, CORS. Don't build the reversal flow or manual JE UI (schema-ready only). Don't wire expense.

---

## House rules
- Migration upgrade/downgrade clean. Manual uvicorn restart.
- Service commits nothing itself (flush; router commits) — match existing pattern; state it.
- Numeric(18,2) for money. No floats for amounts.
- Clear PostingError on every validation failure.

---

## Acceptance / test steps (state pass/fail each — via a script or pytest)
1. A balanced 2-line entry (debit 1000 / credit 1000) on an OPEN period date posts successfully; reference_number generated; status POSTED; posted_at set.
2. Unbalanced entry (debit 1000 / credit 900) → PostingError, nothing written.
3. Line with both debit and credit > 0, or both 0, or negative → PostingError.
4. Inactive / other-tenant / nonexistent gl_account_id → PostingError.
5. Missing a 'required' dimension for that GL → PostingError; providing it → posts.
6. Date in a HARD_CLOSED period (or before registration date) → PostingError with is_date_postable's reason.
7. status="DRAFT" creates a DRAFT entry (no posted_at), skipping/holding the date-postable hard-block as appropriate — state how DRAFT vs POSTED differ re: is_date_postable (recommend: DRAFT allowed even if not currently postable; POSTED must pass).
8. Migration up/down clean.

---

## Completion summary required
List every file created/changed. State: the exact is_date_postable signature used; reference_number generation approach; dimensions storage choice (JSONB vs child table) + why; how DRAFT vs POSTED handle date-postability; how the service fits the commit pattern (flush vs commit); where models are registered for metadata; confirm migration clean; confirm no frontend/CoA/period logic touched. Report acceptance pass/fail for all 8.
