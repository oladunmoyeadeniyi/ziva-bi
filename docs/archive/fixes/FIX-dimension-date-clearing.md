# CC Brief — Fix Dimension Value Date Clearing

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change any other logic
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## ROOT CAUSE

In the Edit value modal, the PATCH payload only includes valid_from and
valid_to when they are non-empty. When a user clears a date field and
saves, nothing is sent for that field, so the backend keeps the existing
date. The fix is to always include valid_from and valid_to in the payload
— sending null explicitly when the field is empty.

---

## CHANGE 1 — Frontend: always send valid_from and valid_to in PATCH payload

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

Find `handleEditValueSave`. Find where patchBody is built. Replace the
conditional date inclusion:

Current (broken):
```typescript
if (editValueModal.valid_from.trim()) {
  patchBody.valid_from = editValueModal.valid_from.trim();
}
if (editValueModal.valid_to.trim()) {
  patchBody.valid_to = editValueModal.valid_to.trim();
}
```

Replace with:
```typescript
patchBody.valid_from = editValueModal.valid_from.trim() || null;
patchBody.valid_to = editValueModal.valid_to.trim() || null;
```

This sends null explicitly when the field is empty, telling the backend
to clear the date.

---

## CHANGE 2 — Backend: accept null for valid_from and valid_to in PATCH

**File:** `backend/app/routers/config.py`

Find the PATCH endpoint for dimension values
(`PATCH /dimensions/{dimension_id}/values/{value_id}`).

Find where valid_from and valid_to are updated from the payload. The
current logic likely skips null values. Change it to explicitly set
null when the value is null:

```python
if "valid_from" in payload:
    value_obj.valid_from = payload["valid_from"]  # can be null
if "valid_to" in payload:
    value_obj.valid_to = payload["valid_to"]  # can be null
```

This means if the frontend sends `{"valid_from": null}`, the backend
sets valid_from to NULL in the database.

---

## WATCH ITEMS
- Do NOT change any other field update logic
- Do NOT change the backend date parsing for non-null values
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`
2. `backend/app/routers/config.py`

## Commit message:
`fix: dimension value edit — send null to clear valid_from/valid_to dates`
