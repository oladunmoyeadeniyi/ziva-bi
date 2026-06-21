# CC Brief — CoA Template: Lock Rows + Heuristic Data Start Detection

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any other logic
4. List every file changed in your completion summary

---

## CONTEXT

Users can accidentally delete the example and instruction rows from the
CoA template, causing the upload parser to misread their data.

Two-layer fix:
1. Lock rows 1-4 in the template (header, example, instructions, marker)
   so they cannot be deleted or edited
2. Add heuristic detection in the parser as a fallback — if rows 2-4
   look like example/instruction rows, skip them; if they look like
   real data, start from row 2

---

## CHANGE 1 — Template: lock rows + add marker row

**File:** `backend/app/routers/config.py`

Find the CoA template download endpoint. After writing the header,
example, and instruction rows, add a visual marker row and apply
sheet protection:

### 1a. Add marker row (row 4)

```python
from openpyxl.styles import Font, PatternFill, Alignment

marker_font = Font(name="Arial", bold=True, size=10, color="1E3A5F", italic=True)
marker_fill = PatternFill("solid", fgColor="E8F0FE")

marker_cell = ws.cell(row=4, column=1, value="→ Enter your GL accounts from row 5 onwards")
marker_cell.font = marker_font
marker_cell.fill = marker_fill
marker_cell.alignment = Alignment(horizontal="left")

for col_num in range(2, len(all_cols) + 1):
    ws.cell(row=4, column=col_num).fill = marker_fill
```

### 1b. Lock rows 1-4, unlock rows 5+

```python
from openpyxl.styles import Protection

ws.protection.sheet = True
ws.protection.password = "ziva"
ws.protection.selectLockedCells = False
ws.protection.selectUnlockedCells = False

for row_num in range(5, 10001):
    for col_num in range(1, len(all_cols) + 1):
        ws.cell(row=row_num, column=col_num).protection = Protection(locked=False)
```

---

## CHANGE 2 — Parser: heuristic data start detection

**File:** `backend/app/routers/config.py`

Find `_load_sheet` function. Replace:

```python
data_rows = all_rows[3:]
```

With smart detection:

```python
headers_row = all_rows[0]

def _is_real_data_row(row: list[str]) -> bool:
    """A real GL data row has a short non-empty first cell (GL number)
    with no spaces and no long instruction-like text."""
    first = (row[0] or "").strip()
    return (
        bool(first)
        and len(first) <= 20
        and not any(c in first for c in [" ", "→", "Enter", "Unique"])
    )

# Try to detect where real data starts
# Standard template: row2=example, row3=instructions, row4=marker, data from row5
# User-modified: may have data starting earlier
if len(all_rows) >= 5 and not _is_real_data_row(all_rows[1]):
    # Rows 2-4 look like example/instructions/marker — data starts at row 5
    data_rows = all_rows[4:]
elif len(all_rows) >= 4 and not _is_real_data_row(all_rows[1]):
    # Rows 2-3 look like example/instructions — data starts at row 4
    data_rows = all_rows[3:]
elif len(all_rows) >= 2 and _is_real_data_row(all_rows[1]):
    # Row 2 looks like real data — start from row 2
    data_rows = all_rows[1:]
else:
    data_rows = all_rows[1:]

return [h.strip() for h in headers_row], data_rows
```

Also update the enumerate start label to match:
```python
for i, row in enumerate(sheet1_rows, start=2):
```

---

## WATCH ITEMS
- Do NOT change `config.py` database name — must stay `ziva_dev`
- Do NOT rewrite CORS in `main.py` — must keep `http://localhost:3000`
- Do NOT change any other template or upload logic

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`feat: coa template — lock rows 1-4, add marker row, heuristic data start detection in parser`
