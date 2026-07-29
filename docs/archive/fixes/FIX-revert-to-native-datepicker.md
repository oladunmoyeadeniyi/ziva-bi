# CC Brief — Revert to Native Date Picker (onBlur instead of onChange)

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Run `npm run type-check` before committing — zero errors required
3. List every file changed in your completion summary

---

## CONTEXT

react-datepicker was installed but the UI is not preferred. Revert to native
<input type="date"> but fix the auto-fire bug by using onBlur instead of onChange.
onBlur only fires when the user leaves the field, not on render.

---

## CHANGE 1 — Remove react-datepicker

- Remove `import DatePicker from "react-datepicker";`
- Remove `import "react-datepicker/dist/react-datepicker.css";`
- Replace ALL DatePicker components with <input type="date"> (see Change 2 below)

---

## CHANGE 2 — Replace DatePicker with native date inputs using onBlur

Keep toInputDate and fromInputDate helpers — they are needed.

### Edit modal — Valid From:
```tsx
<input
  type="date"
  defaultValue={toInputDate(editValueModal.valid_from)}
  onBlur={e => {
    if (e.target.value) {
      setEditValueModal(prev =>
        prev ? { ...prev, valid_from: fromInputDate(e.target.value) } : null
      );
    }
  }}
  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

### Edit modal — Valid To:
```tsx
<input
  type="date"
  defaultValue={toInputDate(editValueModal.valid_to)}
  onBlur={e => {
    if (e.target.value) {
      setEditValueModal(prev =>
        prev ? { ...prev, valid_to: fromInputDate(e.target.value) } : null
      );
    }
  }}
  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

### Add value form — Valid From:
```tsx
<input
  type="date"
  defaultValue={toInputDate(addValueValidFrom)}
  onBlur={e => {
    if (e.target.value) setAddValueValidFrom(fromInputDate(e.target.value));
  }}
  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
/>
```

### Add value form — Valid To:
```tsx
<input
  type="date"
  defaultValue={toInputDate(addValueValidTo)}
  onBlur={e => {
    if (e.target.value) setAddValueValidTo(fromInputDate(e.target.value));
  }}
  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
/>
```

Note: Use `defaultValue` (not `value`) so the input is uncontrolled —
this prevents React from re-rendering and triggering the auto-fire bug.

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: revert to native date picker with onBlur to prevent auto-fire bug`
