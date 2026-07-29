# CC Brief — Period Management: Replace Manual Generation with Auto-Generation

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## CONTEXT

Manual period generation (a "Generate periods" button + fiscal year input)
is not standard ERP practice and introduces user error. SAP, Oracle, and
Microsoft Dynamics derive the fiscal calendar automatically from org config
and auto-generate periods at the right time.

Replace the manual approach with automatic generation in two triggers:

TRIGGER 1 — On fiscal year settings save:
When the tenant saves fiscal year settings (fiscal_year_start_month,
fiscal_year_start_day, period_closing_frequency) via PATCH /api/setup/org,
automatically generate periods for the current fiscal year if they don't
already exist.

TRIGGER 2 — On last period hard-close:
When the last period of a fiscal year is hard-closed, automatically
generate all periods for the next fiscal year.

---

## CHANGE 1 — Backend: auto-generate on fiscal year settings save

**File:** `backend/app/routers/setup.py`

Find the PATCH /api/setup/org endpoint (or equivalent fiscal year settings
save endpoint). After successfully saving fiscal year settings, call the
period generation logic for the current fiscal year:

```python
from datetime import date

# After saving org config successfully:
current_year = date.today().year

# Check if periods already exist for current year
existing = await db.execute(
    select(AccountingPeriod).where(
        AccountingPeriod.tenant_id == tenant_id,
        AccountingPeriod.fiscal_year.contains(str(current_year)),
    ).limit(1)
)
if not existing.scalar_one_or_none():
    # Auto-generate current fiscal year periods
    await _generate_periods_for_year(db, tenant_id, current_year, org_config)
```

Extract the period generation logic from `generate_periods` into a reusable
internal function `_generate_periods_for_year(db, tenant_id, year, org_config)`
that both the auto-trigger and the existing endpoint can call.

---

## CHANGE 2 — Backend: auto-generate next year on last period hard-close

**File:** `backend/app/routers/setup.py`

Find the POST /periods/{id}/hard-close endpoint. After successfully
hard-closing a period, check if it was the last period of its fiscal year:

```python
# After hard-close committed:
# Check if all periods in this fiscal year are now HARD_CLOSED
all_periods = await db.execute(
    select(AccountingPeriod).where(
        AccountingPeriod.tenant_id == tenant_id,
        AccountingPeriod.fiscal_year == period.fiscal_year,
    )
)
periods = all_periods.scalars().all()
if all(p.status == "HARD_CLOSED" for p in periods):
    # This was the last period — auto-generate next fiscal year
    # Extract year from fiscal_year label
    next_year = period.fiscal_year_int + 1  # use whatever int year field exists
    # Only generate if not already exists and not a future year beyond current+1
    await _generate_periods_for_year(db, tenant_id, next_year, org_config)
```

---

## CHANGE 3 — Frontend: remove manual generation UI

**File:** `frontend/src/app/dashboard/business/setup/periods/page.tsx`

Remove the following from the Fiscal year & periods tab:
- The "Generate periods" button
- The fiscal year label input field (fyLabel state + input)
- The fiscal year selector dropdown used for manual generation
- The "Fiscal year label sent to API" hidden field (already hidden but
  remove the state and logic entirely)
- The "Delete fiscal year" button added in the previous commit
  (no longer needed — auto-generation means no manual mistakes to undo)
- Any state variables, handlers, or useEffects used exclusively by
  the manual generation flow (fyLabel, generating, generateError etc.)

Keep:
- The period grid (showing existing periods for the selected FY)
- The FY selector on the period grid (for navigating between years)
- All close/reopen/checklist functionality
- The fiscal year settings form (start month, start day, frequency,
  year name format) — saving this form is now what triggers generation

Add a subtle info note below the fiscal year settings save button:
"Saving these settings will automatically generate periods for the
current fiscal year if not already created."

---

## WATCH ITEMS
- The _generate_periods_for_year function must respect ALL existing
  validations: registration date floor, stub first year logic, no
  future years beyond current year + 1 (next year only, on last-period
  hard-close trigger)
- Do NOT remove the GET /periods/generate endpoint yet — deprecate it
  silently (keep it but add a comment "deprecated: auto-generation
  now handles this") in case it's called elsewhere
- Do NOT touch any close/reopen/checklist logic
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `backend/app/routers/setup.py`
2. `frontend/src/app/dashboard/business/setup/periods/page.tsx`

## Commit message:
`feat: period management — replace manual generation with auto-generation on settings save and last-period hard-close`
