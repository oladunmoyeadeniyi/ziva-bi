# CC Brief — CoA Template: Remove Protection, Fix Group Account Visibility, Fix Parser

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any other logic
4. List every file changed in your completion summary

---

## CHANGE 1 — Remove sheet protection entirely from CoA template

**File:** `backend/app/routers/config.py`

Find the CoA template download endpoint. Remove ALL of the following:
- Any `ws1.protection.*` assignments
- Any loop that sets `Protection(locked=True)` or `Protection(locked=False)`
- Any import of `Protection` used only for sheet protection
- The `_protect_sheet` function call if it still exists for ws1

Instead, style rows 1-4 with a light amber/yellow fill to visually indicate
they are reference rows, and add a comment on cell A4:

```python
from openpyxl.styles import PatternFill, Font

ref_fill = PatternFill("solid", fgColor="FFF3CD")  # amber warning colour

for row_num in range(1, 5):
    for col_num in range(1, len(all_cols) + 2):
        cell = ws1.cell(row=row_num, column=col_num)
        if cell.fill.fgColor.rgb == "00000000" or not cell.fill.patternType:
            cell.fill = ref_fill  # only apply if no existing fill
```

Do NOT apply any sheet protection. The workbook must be fully editable.

---

## CHANGE 2 — Remove isSubsidiary gate from Group Account columns in frontend

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

Find the column selector modal. Locate the condition that gates the
"Group Account Number" and "Group Account Name" checkboxes behind
`isSubsidiary`. Remove that condition so the checkboxes always render.

The checkboxes should always be visible regardless of company structure.

---

## CHANGE 3 — Add debug print to confirm parser row detection

**File:** `backend/app/routers/config.py`

In `_load_sheet`, add a single print after data_rows is determined:
```python
print(f"_load_sheet: total rows={len(all_rows)}, data rows={len(data_rows)}, first data row gl={data_rows[0][0] if data_rows else 'EMPTY'}")
```

This will confirm the heuristic is picking the correct start row.

---

## WATCH ITEMS
- Do NOT add any sheet protection
- Do NOT change any upload parsing logic beyond the debug print
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`fix: coa template — remove sheet protection, always show group account cols, add parser debug`
