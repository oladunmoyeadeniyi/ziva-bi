# CC Brief — CoA Template: Remove Sheet 2 + Dimension Template: Add Date & Status Columns

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section at the bottom
3. Do NOT touch any file not in that list
4. Do NOT improve anything not mentioned in this brief
5. At the end, list every file you changed

---

## CONTEXT

Two unrelated template changes, both in `backend/app/routers/config.py`.

---

## CHANGE 1 — Remove Sheet 2 (Dimensions) from CoA template

### Where
Find the CoA template download endpoint:
`GET /api/config/coa/template` (or similar — check the actual route decorator)

### What to do
The template currently generates a two-sheet Excel workbook:
- Sheet 1: "GL Accounts"
- Sheet 2: "Dimensions" (lists configured dimensions for reference)

**Remove Sheet 2 entirely.** The CoA template should be a single-sheet workbook
containing only the "GL Accounts" sheet.

Remove:
- Any code that creates the second worksheet (`wb.create_sheet(...)` for Dimensions)
- Any code that writes headers or data to Sheet 2
- Any code that adds data validation referencing Sheet 2 values

Do NOT change anything about Sheet 1 (GL Accounts) — headers, columns, column
widths, data validation, freeze panes, example rows, instruction rows, protection
— leave all of that exactly as-is.

---

## CHANGE 2 — Add Valid From, Valid To, Is Active columns to Dimension Values templates

### Where
Two endpoints to update:
1. Per-dimension template: `GET /api/config/dimensions/{dimension_id}/values/template`
2. Universal template: `GET /api/config/dimensions/template/universal`

Both currently generate a template with these columns:
```
Dimension | Code * | Name * | Description
```

### What to add
Add three new columns at the end, after Description:

```
Dimension | Code * | Name * | Description | Valid From (dd/mm/yyyy) | Valid To (dd/mm/yyyy) | Is Active
```

**Column specs:**
- `Valid From (dd/mm/yyyy)` — optional date field, format hint in header. Width: 22
- `Valid To (dd/mm/yyyy)` — optional date field, format hint in header. Width: 22
- `Is Active` — optional Yes/No field. Width: 12

**Instruction row (row 2) for new columns:**
- Valid From: "e.g. 01/01/2025 (optional)"
- Valid To: "e.g. 31/12/2025 (optional)"
- Is Active: "Yes or No (default: Yes)"

**Example row (row 3) for new columns:**
- Valid From: "01/01/2025"
- Valid To: (leave blank)
- Is Active: "Yes"

Apply these same additions to BOTH the per-dimension template endpoint AND the
universal template endpoint. Both must have identical column structure.

### Also update the upload parser to read these new columns

In the upload endpoints, the `_parse_upload` helper already reads headers and rows.
The upload_dimension_values endpoint and upload_universal_dimension_values endpoint
both already have `valid_from`, `valid_to`, and `is_active` column handling via
`col("valid from (dd/mm/yyyy)")` or similar.

**Verify** the following column name lookups exist in both upload endpoints and
add them if missing:

```python
from_col = col("valid from (dd/mm/yyyy)") or col("valid from")
to_col = col("valid to (dd/mm/yyyy)") or col("valid to")
active_col = col("is active")
```

If these already exist, no change needed to the upload logic.

---

## WATCH ITEMS
- Do NOT change `config.py` database name — must stay `ziva_dev`
- Do NOT rewrite CORS in `main.py` — must keep `http://localhost:3000`
- Do NOT change Sheet 1 of the CoA template
- Do NOT change any upload parsing logic beyond what is specified above

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`feat: coa template remove sheet 2; dimension template add valid-from/to/is-active columns`
