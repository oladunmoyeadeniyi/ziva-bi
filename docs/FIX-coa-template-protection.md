# CC Brief — Fix CoA Template: Sheet Protection Not Unlocking Data Rows

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change any other logic
3. List every file changed in your completion summary

---

## ROOT CAUSE

The current code loops over rows 5-10000 setting Protection(locked=False)
on empty cells. openpyxl only persists protection settings on cells that
have been explicitly given content or a style — empty cells are ignored.
So rows 5+ remain locked when sheet protection is enabled.

---

## FIX

**File:** `backend/app/routers/config.py`

Find the CoA template sheet protection block. Replace it entirely with:

```python
from openpyxl.styles import Protection

# Lock rows 1-4 (header, example, instructions, marker)
for row_num in range(1, 5):
    for col_num in range(1, len(all_cols) + 2):
        ws1.cell(row=row_num, column=col_num).protection = Protection(locked=True)

# Anchor unlock: write locked=False to row 5 for all columns.
# This forces openpyxl to register the unlocked xf style in the workbook.
# Excel then applies this style to all subsequent empty cells in the column.
for col_num in range(1, len(all_cols) + 2):
    ws1.cell(row=5, column=col_num).protection = Protection(locked=False)

# Enable sheet protection
ws1.protection.sheet = True
ws1.protection.password = "ziva"
ws1.protection.selectLockedCells = False
ws1.protection.selectUnlockedCells = False
```

Do NOT loop over rows 6-10000 — only row 5 is needed as the anchor.

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`fix: coa template protection — anchor unlock at row 5 so data rows are editable`
