# CC Brief — Period Management: Delete Fiscal Year

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## CONTEXT

Once a fiscal year is generated, regeneration is blocked. A "Delete fiscal
year" button is needed so a user can redo a misconfigured generation —
but ONLY before any period has been closed.

---

## CHANGE 1 — Backend: DELETE fiscal year endpoint

**File:** `backend/app/routers/setup.py`

Add a new endpoint:

```python
@router.delete("/periods/fiscal-year/{fiscal_year}")
async def delete_fiscal_year(
    fiscal_year: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = _require_tenant(current_user)
    _require_tenant_admin(current_user)

    # Block if any period is in a closed state
    closed = await db.execute(
        select(AccountingPeriod).where(
            AccountingPeriod.tenant_id == tenant_id,
            AccountingPeriod.fiscal_year == fiscal_year,
            AccountingPeriod.status.in_(
                ["SOFT_CLOSED", "OVERDUE", "HARD_CLOSED"]
            ),
        )
    )
    if closed.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a fiscal year with closed periods."
        )

    # Delete all periods for this fiscal year
    await db.execute(
        delete(AccountingPeriod).where(
            AccountingPeriod.tenant_id == tenant_id,
            AccountingPeriod.fiscal_year == fiscal_year,
        )
    )

    # Delete FiscalYearState if exists
    await db.execute(
        delete(FiscalYearState).where(
            FiscalYearState.tenant_id == tenant_id,
            FiscalYearState.fiscal_year == fiscal_year,
        )
    )

    await db.commit()
    return {"deleted": fiscal_year}
```

---

## CHANGE 2 — Frontend: Delete fiscal year button

**File:** `frontend/src/app/dashboard/business/setup/periods/page.tsx`

On the period grid for the selected fiscal year, add a
"Delete fiscal year" button with these rules:

1. Only render if ALL periods in the selected FY have status
   "OPEN" or "FUTURE" — if any period is "SOFT_CLOSED",
   "OVERDUE", or "HARD_CLOSED", do not render the button at all.

2. On click, show a window.confirm:
   "Delete all periods for {fyLabel}? This cannot be undone."

3. On confirm, call DELETE /api/setup/periods/fiscal-year/{fiscal_year}

4. On success, refresh the period grid (re-fetch periods list)

Style the button as a destructive/red outlined button, smaller than
the main action buttons.

---

## Allowed files:
1. `backend/app/routers/setup.py`
2. `frontend/src/app/dashboard/business/setup/periods/page.tsx`

## Commit message:
`feat: period management — delete fiscal year button (only when no closed periods)`
