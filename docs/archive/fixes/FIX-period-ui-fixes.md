# CC Brief — Period Management: Stub First Year + Year Name Format Dropdown

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## CHANGE 1 — Backend: stub first fiscal year

**File:** `backend/app/routers/setup.py`

Find the date-level check in `generate_periods`:
```python
if fy_start < date_of_registration:
    raise HTTPException(422, "Fiscal year FY{year} starts on...")
```

Replace with:
```python
if fy_start < org.date_of_registration:
    if start_year == org.date_of_registration.year:
        fy_start = org.date_of_registration
    else:
        raise HTTPException(
            status_code=422,
            detail=f"Fiscal year FY{start_year} starts before the "
                   f"organisation's date of registration "
                   f"({org.date_of_registration.strftime('%d/%m/%Y')})."
        )
```

FY2021 for a company registered 25/08/2021 now generates periods from
25/08/2021 to 31/12/2021 (stub year). FY2022+ generates normally.

---

## CHANGE 2 — Frontend: Year name format dropdown with live preview

**File:** `frontend/src/app/dashboard/business/setup/periods/page.tsx`

Find the "Year name format" free-text input field. Replace it with:

### 2a. Define format options

```typescript
const YEAR_FORMAT_OPTIONS = [
  { label: "FY2025", value: "FY{year}" },
  { label: "2025/2026", value: "{year}/{nextyear}" },
  { label: "2025-2026", value: "{year}-{nextyear}" },
  { label: "2025", value: "{year}" },
  { label: "Apr 2025 – Mar 2026", value: "MMM {year} – MMM {nextyear}" },
];
```

### 2b. Add a preview helper

```typescript
const previewYearFormat = (fmt: string): string => {
  const y = new Date().getFullYear();
  return fmt
    .replace("{year}", String(y))
    .replace("{nextyear}", String(y + 1))
    .replace(/MMM/g, new Date(y, 0).toLocaleString("en", { month: "short" }));
};
```

### 2c. Replace the input with a select + preview line

```tsx
<div>
  <label className="...existing label classes...">
    Year name format
  </label>
  <select
    value={fiscalForm.fiscal_year_name_format ?? "FY{year}"}
    onChange={e => setFiscalForm(prev => ({
      ...prev,
      fiscal_year_name_format: e.target.value
    }))}
    className="...existing input classes..."
  >
    {YEAR_FORMAT_OPTIONS.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
  <p className="text-xs text-gray-500 mt-1">
    Preview: {previewYearFormat(
      fiscalForm.fiscal_year_name_format ?? "FY{year}"
    )}
  </p>
</div>
```

---

## Allowed files:
1. `backend/app/routers/setup.py`
2. `frontend/src/app/dashboard/business/setup/periods/page.tsx`

## Commit message:
`fix: period generation stub first year; year name format dropdown with preview`
