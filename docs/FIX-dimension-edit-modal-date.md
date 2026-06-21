# CC Brief — Fix Edit Value Modal: Date Picker + Error Display

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT touch any file not in that list
4. Do NOT improve anything not mentioned in this brief
5. At the end, list every file you changed

---

## PROBLEM

On the Dimensions page Master data / values tab, the Edit value modal has two bugs:

1. **Error display shows "[object Object],[object Object]"** — the API validation
   error is an array of objects, not a plain string. It's being rendered directly
   without converting to text.

2. **Date fields reject input** — the plain text inputs expect DD/MM/YYYY but the
   user types naturally and it fails backend validation. Replace with native HTML
   date pickers which are easier to use and format-safe.

---

## CHANGE 1 — Fix error display

In `handleEditValueSave`, find where `setEditValueError` is called after a failed
API response. Change it to always produce a plain string:

```typescript
const data = await res.json().catch(() => ({}));
// data.detail may be a string OR an array of FastAPI validation error objects
let errMsg = "Save failed";
if (typeof data.detail === "string") {
  errMsg = data.detail;
} else if (Array.isArray(data.detail)) {
  errMsg = data.detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join("; ");
} else if (data.detail) {
  errMsg = JSON.stringify(data.detail);
}
throw new Error(errMsg);
```

---

## CHANGE 2 — Replace text date inputs with native date pickers

Add these two helper functions inside the component (before the return statement):

```typescript
// Convert DD/MM/YYYY → YYYY-MM-DD for <input type="date"> value prop
const toInputDate = (ddmmyyyy: string): string => {
  if (!ddmmyyyy) return "";
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  return y && m && d ? `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}` : "";
};

// Convert YYYY-MM-DD from <input type="date"> → DD/MM/YYYY for state/API
const fromInputDate = (yyyymmdd: string): string => {
  if (!yyyymmdd) return "";
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}/${m}/${y}`;
};
```

### In the Edit value modal

Replace both Valid From and Valid To `<input type="text">` fields with:

```tsx
{/* Valid From */}
<div>
  <label className="text-xs font-medium text-gray-600 block mb-1">
    Valid From <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  <input
    type="date"
    value={toInputDate(editValueModal.valid_from)}
    onChange={e => setEditValueModal(prev =>
      prev ? { ...prev, valid_from: fromInputDate(e.target.value) } : null
    )}
    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>

{/* Valid To */}
<div>
  <label className="text-xs font-medium text-gray-600 block mb-1">
    Valid To <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  <input
    type="date"
    value={toInputDate(editValueModal.valid_to)}
    onChange={e => setEditValueModal(prev =>
      prev ? { ...prev, valid_to: fromInputDate(e.target.value) } : null
    )}
    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>
```

### In the Add value inline form

Replace both Valid From and Valid To `<input type="text">` fields with:

```tsx
{/* Valid From */}
<input
  type="date"
  value={toInputDate(addValueForm.valid_from ?? "")}
  onChange={e => setAddValueForm(prev => ({ ...prev, valid_from: fromInputDate(e.target.value) }))}
  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
/>

{/* Valid To */}
<input
  type="date"
  value={toInputDate(addValueForm.valid_to ?? "")}
  onChange={e => setAddValueForm(prev => ({ ...prev, valid_to: fromInputDate(e.target.value) }))}
  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

---

## WATCH ITEMS
- Do NOT touch the backend
- Do NOT change any other field or modal
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: dimension edit modal — native date picker, fix error display stringify`
