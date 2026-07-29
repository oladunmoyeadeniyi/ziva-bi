# CC Brief — Fix Period Generation: Stub First Year End Date

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any other period generation logic
4. List every file changed in your completion summary

---

## BUG

When a stub first fiscal year is generated (registration date mid-year),
the system correctly uses the registration date as fy_start, but it then
generates 12 months forward from that date — extending into the NEXT
fiscal year. This is wrong.

The stub year must end on the LAST DAY of that fiscal year, regardless
of when fy_start is. The fiscal year end is determined by the tenant's
fiscal_year_start_month and fiscal_year_start_day — it is always the
day before the next fiscal year begins.

---

## FIX

**File:** `backend/app/routers/setup.py`

Find `generate_periods`. Read how `fy_end` (or equivalent) is currently
computed. Show me that line first.

The correct formula for fy_end regardless of fiscal year configuration:

```python
from datetime import date
from dateutil.relativedelta import relativedelta

# Next fiscal year start = fiscal_year_start of (start_year + 1)
next_fy_start = date(
    start_year + 1,
    org.fiscal_year_start_month or 1,
    org.fiscal_year_start_day or 1
)

# Fiscal year end = one day before next FY starts
fy_end = next_fy_start - relativedelta(days=1)
```

This works for all cases:
- Standard Jan-Dec: next FY starts 01/01/2022 → fy_end = 31/12/2021
- Apr-Mar fiscal year: next FY starts 01/04/2022 → fy_end = 31/03/2022
- Any other: correctly derived from tenant config

fy_start for stub year = org.date_of_registration (already correct)
fy_end = always computed as above (fix this)

The periods generated between fy_start and fy_end will naturally be
fewer than 12 for a stub year — that is correct and expected.

---

## Allowed files:
1. `backend/app/routers/setup.py`

## Commit message:
`fix: period generation stub year — end date derived from fiscal year config, not 12 months forward`
