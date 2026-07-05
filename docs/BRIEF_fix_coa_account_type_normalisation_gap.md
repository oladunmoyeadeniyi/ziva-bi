# CC Brief — Fix CoA account_type normalisation gap (Remap inline-create path)

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in "Allowed files" at the bottom
3. Do NOT touch any file not in that list
4. Do NOT improve anything not mentioned in this brief
5. At the end, list every file you changed and paste the verification query result (Step 4)

---

## CONTEXT — what "Verify CoA PL/BS filter" turned up

`chart_of_accounts.account_type` has two historical label schemes: legacy
`SOCI`/`SOFP` and current `PL`/`BS`. Three creation paths exist:

- `CoACreate` / `CoAUpdate` (Add/Edit GL modal) — has a `field_validator` that
  maps `PL→SOCI`, `BS→SOFP` before storing. Always stores `SOCI`/`SOFP`.
- Bulk upload template import (`app/routers/config.py` sheet-1 import) — maps
  `PL/P&L→SOCI`, `BS/B&S→SOFP` before storing. Always stores `SOCI`/`SOFP`.
- **`InlineNewAccountFields` (Remap codes → "Create new" inline account) —
  has NO validator.** The frontend's Remap modal (`remapNewType`, typed
  `"PL" | "BS"`, default `"PL"`) submits the raw value, and
  `POST /api/config/coa/remap` stores `account_type=naf.account_type` as-is
  (`app/routers/config.py` ~line 2618). **This is the only path that writes
  literal `"PL"`/`"BS"` into the DB instead of `"SOCI"`/`"SOFP"`.**

Most read paths tolerate this because they normalise on read
(`normaliseAccountType()` on the frontend; `_ACCEPTED_TYPES` in
`account_mapping.py`; `_norm()` helpers in the remap/bulk-remap consistency
checks). Two places do NOT normalise and are confirmed broken or latent:

1. **Confirmed live bug** — Chart of Accounts page, Dimension Matrix tab
   (`chart-of-accounts/page.tsx` ~line 814):
   `(dimMatrix?.accounts ?? []).filter(a => !dimFilterType || a.account_type === dimFilterType)`
   — raw comparison against hardcoded `value="SOCI"` / `value="SOFP"` dropdown
   options (~line 2172-2174). Any GL account created via Remap's inline-new-account
   path (`account_type` literally `"PL"`/`"BS"`) silently disappears from this
   tab's filtered view, even though it displays correctly everywhere else on
   the page (which uses `normaliseAccountType()`).

2. **Confirmed latent defect** — `GET /coa/fs-mappings`'s optional
   `account_type` query param (`app/routers/config.py` ~line 1789-1790) does
   `ChartOfAccount.account_type == account_type` with no normalisation. Not
   currently exploited (the frontend never passes this param — it filters
   client-side instead), but broken for any future/direct caller.

Remap is gated to `tenant.lifecycle_status == "live"` only — so if this has
fired already, it happened on a live (real) tenant, not a test/implementation
one. Step 4 below checks whether it actually has.

Benchmark note: SAP/Oracle/Dynamics/Sage X3 all enforce a single canonical
stored value for a financial-statement classification field precisely so
every filter/report agrees — they don't accept-and-normalise-on-read across
the whole app. This brief closes the one gap that let a second representation
leak into storage, rather than adding a fourth place that has to remember to
normalise.

---

## CHANGE 1 — close the root cause: `app/schemas/config.py`

Add a `field_validator` to `InlineNewAccountFields.account_type`, identical
in behaviour to `CoACreate.validate_account_type`:

```python
@field_validator("account_type")
@classmethod
def validate_account_type(cls, v: str) -> str:
    v = v.strip().upper()
    mapping = {"PL": "SOCI", "BS": "SOFP"}
    v = mapping.get(v, v)
    if v not in ("SOCI", "SOFP"):
        raise ValueError("Account Type must be 'SOCI' or 'SOFP'.")
    return v
```

(Add the `field_validator` import to this class if not already imported in
the file — check the existing import line `CoACreate` uses.)

---

## CHANGE 2 — fix the live bug: `chart-of-accounts/page.tsx`

### 2a. Dimension Matrix filter predicate (~line 814)

Replace:
```typescript
(dimMatrix?.accounts ?? []).filter(a => !dimFilterType || a.account_type === dimFilterType)
```
With:
```typescript
(dimMatrix?.accounts ?? []).filter(a => !dimFilterType || normaliseAccountType(a.account_type) === dimFilterType)
```

### 2b. Dimension Matrix filter dropdown values (~line 2172-2174)

Replace:
```tsx
<option value="">All types</option>
<option value="SOCI">PL</option>
<option value="SOFP">BS</option>
```
With:
```tsx
<option value="">All types</option>
<option value="PL">PL</option>
<option value="BS">BS</option>
```

(This matches `normaliseAccountType`'s output values — `"PL"`/`"BS"` — used
in step 2a, and matches the labelling convention already used by the main
Accounts tab's `filterType` dropdown.)

---

## CHANGE 3 — fix the latent defect: `app/routers/config.py`

In `get_fs_mappings` (~line 1789-1790), replace:
```python
if account_type:
    q = q.where(ChartOfAccount.account_type == account_type)
```
With the same normalisation already used in `list_coa` (~line 1740-1757) —
reuse that logic rather than duplicating it differently. If `list_coa`'s
normalisation block isn't already a standalone helper, extract it into one
(e.g. `_account_type_filter_clause(account_type: str)`) and call it from both
`list_coa` and `get_fs_mappings`. Do not change `list_coa`'s behaviour.

---

## CHANGE 4 — verify, and check for existing bad data

Before committing, run this read-only check against the dev/local DB (or ask
me to run it against prod read-replica if you don't have prod access — do
**not** run it against prod directly):

```sql
SELECT tenant_id, gl_number, gl_name, account_type
FROM chart_of_accounts
WHERE account_type IN ('PL', 'BS');
```

If this returns zero rows: nothing to backfill, note that in your report.

If it returns rows: these are accounts already mis-stored via the Remap
inline-create path before this fix. Do NOT auto-correct them — report the
exact list (tenant_id, gl_number, gl_name, account_type) back to me instead.
Since some of these may be on a `lifecycle_status == "live"` tenant, I want
to decide the backfill myself rather than have it run unattended.

---

## NOTES FOR CC

- Do not touch `CoACreate`, `CoAUpdate`, or the bulk-upload import logic —
  those already normalise correctly and are out of scope.
- Do not touch `account_mapping.py` — its `_ACCEPTED_TYPES` handling is
  already correct.
- Do not touch the main Accounts tab's `filterType` or FS Mappings tab's
  `fsTypeFilter` — both already use `normaliseAccountType()` correctly.
- This is a backend + frontend fix, not a migration. No Alembic migration is
  needed unless Step 4 finds bad rows and I ask you to backfill them in a
  follow-up brief.

---

## Files you are allowed to change:
1. `backend/app/schemas/config.py`
2. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`
3. `backend/app/routers/config.py`
4. `docs/BRIEF_fix_coa_account_type_normalisation_gap.md` (this file — no edits needed unless you hit a mismatch, see below)

## If anything doesn't match
If `InlineNewAccountFields`, the Remap modal's `remapNewType` state, or the
Dimension Matrix filter look different from what's described above when you
check them, stop and report back rather than guessing.

## Commit message:
`fix: CoA — normalise account_type on Remap inline-create, fix Dimension Matrix type filter, fix fs-mappings filter`
