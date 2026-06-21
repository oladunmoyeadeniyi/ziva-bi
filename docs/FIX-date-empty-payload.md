# CC Brief — Fix Date Fields: Exclude Empty Dates from PATCH Payload

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## ROOT CAUSE

The browser renders `<input type="date">` with a placeholder date display
(e.g. 01/01/2024) even when the value is empty string "". When the user clicks
"Save changes" without touching the date fields, the browser sends those
placeholder values to the API, causing a 422 validation error.

The console confirms the modal opens with `valid_from: ""` and `valid_to: ""`
but the PATCH request still sends date values.

---

## FIX — Frontend only

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

Find `handleEditValueSave`. In the `JSON.stringify(...)` body of the PATCH request,
replace the current object with one that only includes date fields if they are
non-empty strings:

```typescript
const patchBody: Record<string, unknown> = {
  name: editValueModal.name,
  description: editValueModal.description || null,
  is_active: editValueModal.is_active,
};

if (editValueModal.valid_from && editValueModal.valid_from.trim() !== "") {
  patchBody.valid_from = editValueModal.valid_from;
}
if (editValueModal.valid_to && editValueModal.valid_to.trim() !== "") {
  patchBody.valid_to = editValueModal.valid_to;
}

// Then use patchBody in the fetch:
body: JSON.stringify(patchBody),
```

This ensures empty date fields are never sent to the backend.

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: dimension edit modal — exclude empty date fields from PATCH payload`
