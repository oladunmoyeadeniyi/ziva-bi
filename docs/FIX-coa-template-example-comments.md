# CC Brief — CoA Template: Replace Example Row with Cell Comments

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any other template or upload logic
4. List every file changed in your completion summary

---

## CONTEXT

The CoA template currently has:
- Row 1: Headers
- Row 2: Example data row (e.g. GL 733060) ← REMOVE THIS
- Row 3: Instructions
- Row 4: Marker "→ Enter your GL accounts from row 5 onwards"
- Row 5+: Data

Problem: Row 2 example data is being imported as a real GL account.

Fix: Remove row 2 entirely. Add examples as Excel cell comments on the
header row cells instead. Update the template structure and parser.

New structure:
- Row 1: Headers (with cell comments showing examples)
- Row 2: Instructions
- Row 3: Marker "→ Enter your GL accounts from row 4 onwards"
- Row 4+: Data

---

## CHANGE 1 — Backend: update CoA template generation

**File:** `backend/app/routers/config.py`

Find the CoA template download endpoint.

### 1a. Remove the example data row (row 2)

Remove all code that writes example data to row 2 of the GL Accounts sheet.
This includes any `_write_row(ws1, 2, ...)` or `ws1.cell(row=2, ...)` calls
that write example GL account data.

### 1b. Add Excel cell comments to header row

After writing the header row, add cell comments to each header cell
showing an example value. Use openpyxl's Comment:

```python
from openpyxl.comments import Comment

examples = {
    "GL Number*": "e.g. 400000",
    "GL Name*": "e.g. Sales domestic",
    "Account Type*": "e.g. PL or BS",
    "Is Active": "e.g. Yes",
    "GL Group": "e.g. PL2",
    "GL Subgroup": "e.g. N.S.V",
    "GL Sub-subgroup": "e.g. GSV",
    "FS Head": "e.g. Revenue",
    "FS Note": "e.g. Note 1 - Revenue",
    "TB Mapping": "e.g. Domestic sales",
    "Group Account Number": "e.g. 4000",
    "Group Account Name": "e.g. Net Revenue",
    "Account Classification": "e.g. Revenue",
}

for col_idx, (header, instruction) in enumerate(all_cols, 1):
    cell = ws1.cell(row=1, column=col_idx)
    example = examples.get(header.replace("*", "").strip(), "")
    if example:
        comment = Comment(example, "Ziva BI")
        comment.width = 200
        comment.height = 60
        cell.comment = comment
```

### 1c. Move instructions from row 3 to row 2

The instructions row (currently row 3) must move to row 2:
- Change any `ws1.cell(row=3, ...)` instruction writes to `ws1.cell(row=2, ...)`

### 1d. Move marker from row 4 to row 3

The marker row "→ Enter your GL accounts from row 5 onwards" must move to row 3
and update text to "→ Enter your GL accounts from row 4 onwards":
- Change marker to row 3
- Update marker text to reflect row 4 as data start

### 1e. Update freeze panes

Change `ws1.freeze_panes = "A5"` (or whatever it currently is) to `"A4"`
so rows 1-3 are frozen.

### 1f. Update amber fill to cover rows 1-3 only

The amber reference fill loop currently covers rows 1-4. Change to rows 1-3.

---

## CHANGE 2 — Backend: update parser to start from row 4

**File:** `backend/app/routers/config.py`

Find `_load_sheet` function. Update the heuristic or hardcoded skip:

Change:
```python
data_rows = all_rows[4:]  # skip header, example, instructions, marker
```

To:
```python
data_rows = all_rows[3:]  # skip header, instructions, marker (no example row)
```

Also update the enumerate start label:
```python
for i, row in enumerate(sheet1_rows, start=4):
```

---

## WATCH ITEMS
- Do NOT change any other sheet or upload logic
- Do NOT change the Dimension values template
- The instruction row text should remain the same — just moved from row 3 to row 2

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`feat: coa template — remove example row, add cell comments, data starts row 4`
