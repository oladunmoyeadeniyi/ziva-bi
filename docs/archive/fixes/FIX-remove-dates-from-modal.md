# CC Brief — Remove Date Fields from Edit Value Modal

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## ROOT CAUSE

The browser `<input type="date">` fires onChange with its displayed placeholder
value (e.g. "01/01/2024") even when the user never touches it — just by rendering.
This populates valid_from and valid_to in state, which then get sent to the backend.

## FIX

Remove valid_from and valid_to fields entirely from the Edit value modal.
Dates can be set via the upload template instead.

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### 1. Remove from editValueModal state type
Remove `valid_from` and `valid_to` from the editValueModal state interface/type.

### 2. Remove from setEditValueModal call
Remove `valid_from` and `valid_to` from the object passed to setEditValueModal
when the Edit button is clicked.

### 3. Remove from Edit modal JSX
Remove the entire Valid From and Valid To input fields from the Edit modal JSX.
Keep: Name, Description, Is Active only.

### 4. Remove from patchBody in handleEditValueSave
Ensure patchBody does NOT include valid_from or valid_to at all.

### 5. Remove the toInputDate and fromInputDate helper functions
if they are no longer used anywhere else in the file, remove them.
If they are used elsewhere, keep them.

### 6. Remove debug console.log lines
Remove any console.log lines added for debugging (PATCH body, v.valid_from, etc.)

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: remove date fields from edit modal — browser input fires onChange on render`
