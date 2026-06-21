# CC Brief — Fix Date Field Clearing in Edit Value Modal

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. Run `npm run type-check` before committing — zero errors required

---

## ROOT CAUSE

The Valid From / Valid To inputs use `defaultValue` with `onBlur`. The
onBlur handler only updates state when `e.target.value` is non-empty:

```typescript
onBlur={e => {
  if (e.target.value) {
    setEditValueModal(prev => ({ ...prev, valid_from: fromInputDate(e.target.value) }));
  }
}}
```

When the user clears the field, `e.target.value` is `""`, so the guard
blocks the update — state keeps the OLD value. This is why PATCH BODY
still shows the old date even after clearing in the UI.

---

## FIX

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

First show me `fromInputDate`'s current implementation.

Then remove the `if (e.target.value)` guard in both onBlur handlers
(Valid From and Valid To, in the Edit modal) so state always updates,
even to empty string:

```typescript
onBlur={e => {
  setEditValueModal(prev =>
    prev ? { ...prev, valid_from: fromInputDate(e.target.value) } : null
  );
}}
```

Ensure `fromInputDate` returns `""` when given an empty string input
(not throwing or returning the old value). If it doesn't handle empty
string, fix it to return `""` immediately when input is empty.

Apply the same fix to the Valid To onBlur handler.

Also apply the same fix to the Add value form's Valid From / Valid To
onBlur handlers if they have the same guard pattern.

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: dimension value date fields — allow clearing via onBlur (remove empty-value guard)`
