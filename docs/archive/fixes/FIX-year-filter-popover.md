# CC Brief — Year Filter: Popover + Fix No-Expiry Exclusion + Restore Edit Modal Dates

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT touch the backend
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CHANGE 1 — Replace inline year pills with a popover

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### 1a. Add popover open state

```typescript
const [yearFilterOpen, setYearFilterOpen] = useState(false);
```

### 1b. Replace the inline year pills block in the filter bar

Remove ALL the individual year pill buttons and the "All" / "No expiry" pills.
Replace with this compact layout:

```tsx
{/* Validity filter controls */}
<div className="flex items-center gap-1.5 relative">
  {/* All button */}
  <button
    type="button"
    onClick={() => { setValuesValidityFilter("all"); setYearFilterOpen(false); }}
    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
      valuesValidityFilter === "all"
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
    }`}
  >
    All
  </button>

  {/* No expiry button */}
  <button
    type="button"
    onClick={() => { setValuesValidityFilter("no_expiry"); setYearFilterOpen(false); }}
    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
      valuesValidityFilter === "no_expiry"
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
    }`}
  >
    No expiry
  </button>

  {/* Year filter button + popover */}
  <div className="relative">
    <button
      type="button"
      onClick={() => setYearFilterOpen(prev => !prev)}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors flex items-center gap-1 ${
        typeof valuesValidityFilter === "number"
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
      }`}
    >
      {typeof valuesValidityFilter === "number" ? (
        <>
          {valuesValidityFilter}
          <span
            className="ml-1 hover:text-blue-200"
            onClick={e => {
              e.stopPropagation();
              setValuesValidityFilter("all");
              setYearFilterOpen(false);
            }}
          >
            ✕
          </span>
        </>
      ) : (
        <>Filter by year ▾</>
      )}
    </button>

    {yearFilterOpen && availableYears.length > 0 && (
      <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px]">
        {availableYears.map(year => (
          <button
            key={year}
            type="button"
            onClick={() => {
              setValuesValidityFilter(year);
              setYearFilterOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 ${
              valuesValidityFilter === year ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"
            }`}
          >
            {year}
          </button>
        ))}
      </div>
    )}
  </div>

  {/* Close popover when clicking outside */}
  {yearFilterOpen && (
    <div
      className="fixed inset-0 z-20"
      onClick={() => setYearFilterOpen(false)}
    />
  )}
</div>
```

### 1c. Reset yearFilterOpen on dimension change

In the dimension dropdown onChange handler, add:
```typescript
setYearFilterOpen(false);
```

---

## CHANGE 2 — Fix no-expiry exclusion when year is selected

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

Find the year filter block in filteredValues:

```typescript
if (typeof valuesValidityFilter === "number") {
  const year = valuesValidityFilter;
  ...
  const fromOk = fromYear === null || fromYear <= year;
  const toOk = toYear === null || toYear >= year;
  if (!fromOk || !toOk) return false;
}
```

Replace with:

```typescript
if (typeof valuesValidityFilter === "number") {
  const year = valuesValidityFilter;
  const parseYear = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    if (dateStr.includes("-")) return parseInt(dateStr.split("-")[0]);
    const parts = dateStr.split("/");
    return parts.length === 3 ? parseInt(parts[2]) : null;
  };
  const fromYear = parseYear(v.valid_from);
  const toYear = parseYear(v.valid_to);
  // Exclude values with no dates at all (unlimited/no-expiry)
  if (fromYear === null && toYear === null) return false;
  // from year must be <= selected year (or null = open-ended start)
  const fromOk = fromYear === null || fromYear <= year;
  // to year must be >= selected year (or null = open-ended end, but
  // we already excluded fully null above)
  const toOk = toYear === null || toYear >= year;
  if (!fromOk || !toOk) return false;
}
```

---

## CHANGE 3 — Restore date fields in Edit modal as plain text inputs

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### 3a. Add valid_from and valid_to back to editValueModal state type

```typescript
const [editValueModal, setEditValueModal] = useState<{
  id: string;
  code: string;
  name: string;
  description: string;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
} | null>(null);
```

### 3b. Pass date fields when opening modal

In renderValuesTable Edit button onClick:
```typescript
setEditValueModal({
  id: v.id,
  code: v.code,
  name: v.name,
  description: v.description ?? "",
  valid_from: v.valid_from ? formatDateDisplay(v.valid_from) : "",
  valid_to: v.valid_to ? formatDateDisplay(v.valid_to) : "",
  is_active: v.is_active,
})
```

### 3c. Add date fields to Edit modal JSX

After the Description field and before the Is Active checkbox, add:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid From <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
    </label>
    <input
      type="text"
      value={editValueModal.valid_from}
      onChange={e => setEditValueModal(prev =>
        prev ? { ...prev, valid_from: e.target.value } : null
      )}
      placeholder="e.g. 01/01/2025"
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid To <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
    </label>
    <input
      type="text"
      value={editValueModal.valid_to}
      onChange={e => setEditValueModal(prev =>
        prev ? { ...prev, valid_to: e.target.value } : null
      )}
      placeholder="e.g. 31/12/2025"
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>
```

### 3d. Include dates in PATCH payload conditionally

In handleEditValueSave, update patchBody:

```typescript
const patchBody: Record<string, unknown> = {
  name: editValueModal.name,
  description: editValueModal.description || null,
  is_active: editValueModal.is_active,
};
if (editValueModal.valid_from.trim()) {
  patchBody.valid_from = editValueModal.valid_from.trim();
}
if (editValueModal.valid_to.trim()) {
  patchBody.valid_to = editValueModal.valid_to.trim();
}
```

---

## WATCH ITEMS
- Do NOT use `<input type="date">` anywhere — plain text only for date fields
- Do NOT touch the backend
- Do NOT change any other part of the page
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`feat: year filter popover, fix no-expiry exclusion, restore edit modal date fields`
