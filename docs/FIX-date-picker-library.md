# CC Brief — Add Calendar Date Picker to Edit Modal & Add Value Form

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## CONTEXT

Date fields in the Edit value modal and Add value form are plain text inputs.
Users want a calendar popup picker. We cannot use <input type="date"> because
the browser auto-fires onChange with a placeholder value on render, corrupting
state. Instead, use the `react-datepicker` library which only fires onChange
on explicit user selection.

---

## STEP 1 — Install react-datepicker

Run in the frontend directory:
```
npm install react-datepicker
npm install --save-dev @types/react-datepicker
```

---

## STEP 2 — Import in the dimensions page

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

Add at the top of the file:
```typescript
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
```

---

## STEP 3 — Add date parse/format helpers

Add these two helpers alongside the existing `formatDateDisplay` helper:

```typescript
// Parse DD/MM/YYYY string → Date object (for react-datepicker value prop)
const parseDateForPicker = (ddmmyyyy: string): Date | null => {
  if (!ddmmyyyy || !ddmmyyyy.trim()) return null;
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return isNaN(date.getTime()) ? null : date;
};

// Format Date object → DD/MM/YYYY string (for state storage)
const formatDateForState = (date: Date | null): string => {
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
};
```

---

## STEP 4 — Replace date inputs in the Edit value modal

Find the Valid From and Valid To `<input type="text">` fields in the Edit modal JSX.
Replace both with DatePicker components:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid From <span className="text-gray-400 font-normal">(optional)</span>
    </label>
    <DatePicker
      selected={parseDateForPicker(editValueModal.valid_from)}
      onChange={(date: Date | null) =>
        setEditValueModal(prev =>
          prev ? { ...prev, valid_from: formatDateForState(date) } : null
        )
      }
      dateFormat="dd/MM/yyyy"
      placeholderText="e.g. 01/01/2025"
      isClearable
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid To <span className="text-gray-400 font-normal">(optional)</span>
    </label>
    <DatePicker
      selected={parseDateForPicker(editValueModal.valid_to)}
      onChange={(date: Date | null) =>
        setEditValueModal(prev =>
          prev ? { ...prev, valid_to: formatDateForState(date) } : null
        )
      }
      dateFormat="dd/MM/yyyy"
      placeholderText="e.g. 31/12/2025"
      isClearable
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>
```

---

## STEP 5 — Replace date inputs in the Add value inline form

Find the Valid From and Valid To `<input type="text">` fields in the Add value
inline form. Replace both with DatePicker components:

```tsx
<div className="grid grid-cols-2 gap-2 mb-2">
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid From <span className="text-gray-400 font-normal">(optional)</span>
    </label>
    <DatePicker
      selected={parseDateForPicker(addValueValidFrom)}
      onChange={(date: Date | null) => setAddValueValidFrom(formatDateForState(date))}
      dateFormat="dd/MM/yyyy"
      placeholderText="e.g. 01/01/2025"
      isClearable
      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </div>
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid To <span className="text-gray-400 font-normal">(optional)</span>
    </label>
    <DatePicker
      selected={parseDateForPicker(addValueValidTo)}
      onChange={(date: Date | null) => setAddValueValidTo(formatDateForState(date))}
      dateFormat="dd/MM/yyyy"
      placeholderText="e.g. 31/12/2025"
      isClearable
      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </div>
</div>
```

---

## STEP 6 — Remove toInputDate and fromInputDate helpers

These were used for `<input type="date">` conversion and are no longer needed.
Remove them IF they are not used anywhere else in the file.
If they are still referenced elsewhere, keep them.

---

## WATCH ITEMS
- Do NOT use `<input type="date">` — use DatePicker only
- Do NOT touch the backend
- Do NOT change any other part of the page
- Run `npm run type-check` before committing — zero errors required
- The state always stores dates as DD/MM/YYYY strings — DatePicker only converts
  for display/selection purposes

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`
2. `frontend/package.json` (npm install will update this)
3. `frontend/package-lock.json` (npm install will update this)

## Commit message:
`feat: add react-datepicker calendar to dimension value date fields`
