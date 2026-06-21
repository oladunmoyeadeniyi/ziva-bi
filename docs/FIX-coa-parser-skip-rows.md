# CC Brief — Fix CoA Upload: Remove Hardcoded Row Skip

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change any other logic
3. List every file changed in your completion summary

---

## ROOT CAUSE

In `backend/app/routers/config.py`, the `_load_sheet` function at line ~1922:

```python
data_rows = all_rows[3:]
```

This hardcodes skipping rows 2 and 3, assuming they are always the
example and instruction rows from the template. But if the user fills
in the template and removes those rows (or never had them), real data
in rows 2 and 3 gets silently skipped.

---

## FIX

**File:** `backend/app/routers/config.py`

Find the `_load_sheet` function (around line 1909). Replace the hardcoded
`data_rows = all_rows[3:]` with smart detection:

```python
headers_row = all_rows[0]

# Detect where real data starts.
# The Ziva template has row 2 = example, row 3 = instructions.
# But user-supplied files may have real data from row 2.
# Heuristic: if row 2's first cell looks like a real GL number
# (numeric or short alphanumeric, not a long instruction string),
# treat row 2 as real data. Otherwise skip rows 2 and 3.

def _looks_like_data_row(row: list[str]) -> bool:
    first = row[0].strip() if row else ""
    # Real GL numbers are typically short (<=20 chars) and don't contain spaces or long phrases
    return bool(first) and len(first) <= 20 and " " not in first[:10]

if len(all_rows) > 1 and _looks_like_data_row(all_rows[1]):
    # Row 2 looks like real data — use all rows from row 2
    data_rows = all_rows[1:]
elif len(all_rows) > 3:
    # Row 2 looks like an example, row 3 like instructions — skip both
    data_rows = all_rows[3:]
else:
    data_rows = all_rows[1:]

return [h.strip() for h in headers_row], data_rows
```

Also update the `start=4` label in the main loop to `start=2` so row
numbers in error messages are correct regardless of which path is taken:

```python
for i, row in enumerate(sheet1_rows, start=2):
```

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`fix: coa upload — detect data start row dynamically instead of hardcoding skip rows 2-3`
