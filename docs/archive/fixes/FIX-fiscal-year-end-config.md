# CC Brief — Fiscal Year End Configuration + Year Name Format Codes

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## CONTEXT

Replace the current fiscal_year_start_month + fiscal_year_start_day
fields with a single "First fiscal year end" full date field in the
Organisation form. The system derives everything else automatically.

Also update the Year name format options in Period Management to use
format code strings instead of rendered example labels.

---

## CHANGE 1 — Backend: add first_fiscal_year_end to TenantOrgConfig

**File:** `backend/app/models/setup.py`

Add to TenantOrgConfig model:
```python
first_fiscal_year_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
```

Keep `fiscal_year_start_month`, `fiscal_year_start_day` as they are —
they will now be derived and written automatically when
first_fiscal_year_end is saved (see Change 2).

---

## CHANGE 2 — Backend: derive fiscal year config from first_fiscal_year_end

**File:** `backend/app/routers/setup.py`

Find the PATCH /api/setup/org endpoint. When `first_fiscal_year_end`
is included in the payload:

```python
if "first_fiscal_year_end" in payload:
    fye = payload["first_fiscal_year_end"]  # date object
    if fye:
        # Persist the raw first fiscal year end date
        org.first_fiscal_year_end = fye
        # Derive recurring fiscal year end month + day
        org.fiscal_year_start_month = (fye.month % 12) + 1
        org.fiscal_year_start_day = 1
        # fiscal_year_end_month/day for reference
        # (store these too if they exist as columns, else derive on read)
```

Also add a validation: `first_fiscal_year_end` must fall within 1 year
of the earlier of `date_of_registration` or `commencement_date`:

```python
anchor = min(
    org.date_of_registration or date.max,
    org.commencement_date or date.max
)
if anchor == date.max:
    raise HTTPException(400,
        "Set registration or commencement date before fiscal year end.")
max_fy_end = date(anchor.year + 1, anchor.month, anchor.day) - timedelta(days=1)
if not (anchor <= first_fiscal_year_end <= max_fy_end):
    raise HTTPException(400,
        f"First fiscal year end must be between "
        f"{anchor.strftime('%d/%m/%Y')} and "
        f"{max_fy_end.strftime('%d/%m/%Y')}.")
```

---

## CHANGE 3 — Backend: update _generate_periods_for_year to use first_fiscal_year_end

**File:** `backend/app/routers/setup.py`

Update `_generate_periods_for_year` to determine the first fiscal year's
start date using the anchor date (earlier of registration/commencement):

```python
anchor = None
if org.date_of_registration and org.commencement_date:
    anchor = min(org.date_of_registration, org.commencement_date)
elif org.date_of_registration:
    anchor = org.date_of_registration
elif org.commencement_date:
    anchor = org.commencement_date

# For the first fiscal year only, start from anchor date
if org.first_fiscal_year_end and year == org.first_fiscal_year_end.year:
    fy_start = anchor
else:
    # Subsequent years start from fiscal_year_start_month/day
    fy_start = date(year, org.fiscal_year_start_month or 1, 1)
```

---

## CHANGE 4 — Backend: add migration

Create an Alembic migration to add `first_fiscal_year_end` column
(nullable Date) to `tenant_org_config`.

---

## CHANGE 5 — Frontend: replace start month/day with first fiscal year end

**File:** `frontend/src/app/dashboard/business/setup/organisation/page.tsx`

Find the fiscal year settings section. Replace the
`fiscal_year_start_month` and `fiscal_year_start_day` input fields
with a single date picker for `first_fiscal_year_end`:

```tsx
<div>
  <label className="...">First fiscal year end *</label>
  <input
    type="date"
    value={toInputDate(orgForm.first_fiscal_year_end ?? "")}
    min={toInputDate(anchorDate)}
    max={toInputDate(maxFyEndDate)}
    onBlur={e => {
      if (e.target.value) {
        setOrgForm(prev => ({
          ...prev,
          first_fiscal_year_end: fromInputDate(e.target.value)
        }));
      }
    }}
    className="...existing input classes..."
  />
  <p className="text-xs text-gray-500 mt-1">
    The last day of your first accounting year. Must be within one year
    of your {earlierLabel} date ({anchorDateFormatted}).
  </p>
</div>
```

Where:
- `anchorDate` = earlier of `date_of_registration` or `commencement_date`
- `maxFyEndDate` = anchorDate + 1 year - 1 day
- `earlierLabel` = "registration" or "commencement" depending on which is earlier
- Use `toInputDate`/`fromInputDate` helpers (onBlur pattern, not onChange)

Remove `fiscal_year_start_month` and `fiscal_year_start_day` fields
from the Organisation form entirely.

---

## CHANGE 6 — Frontend: update Year name format to format codes

**File:** `frontend/src/app/dashboard/business/setup/periods/page.tsx`

Replace the current YEAR_FORMAT_OPTIONS with format code strings:

```typescript
const YEAR_FORMAT_OPTIONS = [
  { label: "YYYY", value: "YYYY", description: "e.g. 2025" },
  { label: "FYYYYY", value: "FYYYYY", description: "e.g. FY2025" },
  { label: "YYYY/YYYY", value: "YYYY/YYYY", description: "e.g. 2025/2026" },
  { label: "YYYY-YYYY", value: "YYYY-YYYY", description: "e.g. 2025-2026" },
  { label: "MMM YYYY - MMM YYYY", value: "MMM YYYY - MMM YYYY",
    description: "e.g. Jan 2025 - Dec 2025" },
];
```

Update `previewYearFormat` to handle the new format codes:

```typescript
const previewYearFormat = (fmt: string): string => {
  const y = new Date().getFullYear();
  const nextY = y + 1;
  const startMonth = new Date(y,
    (org?.fiscal_year_start_month ?? 1) - 1, 1)
    .toLocaleString("en", { month: "short" });
  const endMonth = new Date(y,
    (org?.fiscal_year_start_month ?? 1) - 2, 1)
    .toLocaleString("en", { month: "short" });

  return fmt
    .replace("FYYYYY", `FY${y}`)
    .replace("MMM YYYY - MMM YYYY", `${startMonth} ${y} - ${endMonth} ${nextY}`)
    .replace("YYYY/YYYY", `${y}/${nextY}`)
    .replace("YYYY-YYYY", `${y}-${nextY}`)
    .replace("YYYY", `${y}`);
};
```

Update the select options to show both the format code AND description:
```tsx
{YEAR_FORMAT_OPTIONS.map(opt => (
  <option key={opt.value} value={opt.value}>
    {opt.label} — {opt.description}
  </option>
))}
```

Also update `_build_fy_label` in the backend to handle the new format
codes (YYYY, FYYYYY, YYYY/YYYY, YYYY-YYYY, MMM YYYY - MMM YYYY).

---

## WATCH ITEMS
- Keep fiscal_year_start_month/fiscal_year_start_day columns in the DB
  — they are still used internally by _generate_periods_for_year
- The date input must use onBlur not onChange (standing rule)
- The min/max attributes on the date input enforce the valid range
  directly in the browser — no need for additional JS validation
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `backend/app/models/setup.py`
2. `backend/app/routers/setup.py`
3. `backend/alembic/versions/` (new migration file)
4. `frontend/src/app/dashboard/business/setup/organisation/page.tsx`
5. `frontend/src/app/dashboard/business/setup/periods/page.tsx`

## Commit message:
`feat: fiscal year end date config; year name format codes with live preview`
