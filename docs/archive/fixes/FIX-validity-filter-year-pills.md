# CC Brief — Validity Filter: Dynamic Year Pills + Fix Date Display Format

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT touch the backend
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CONTEXT

Two related fixes on the Dimensions Master data / values tab:

1. The validity filter dropdown must be replaced with dynamic year pill buttons
   derived from the actual valid_from/valid_to data of the loaded values.

2. Dates in the values table are displaying as YYYY-MM-DD (e.g. 2024-01-01)
   instead of DD/MM/YYYY (e.g. 01/01/2024). The backend returns dates in
   YYYY-MM-DD format — they must be converted for display.

---

## CHANGE 1 — Replace validity filter dropdown with dynamic year pills

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### 1a. Update valuesValidityFilter state type

Change from:
```typescript
const [valuesValidityFilter, setValuesValidityFilter] = useState<"all" | "this_year" | "no_expiry">("all");
```

To:
```typescript
const [valuesValidityFilter, setValuesValidityFilter] = useState<"all" | "no_expiry" | number>("all");
```

### 1b. Compute available years from loaded values

Add this computed value alongside filteredValues (after dimValues is defined):

```typescript
const availableYears: number[] = (() => {
  const allValues = dimValues[selectedDimForValues] ?? [];
  const yearSet = new Set<number>();
  for (const v of allValues) {
    // Parse YYYY-MM-DD or DD/MM/YYYY
    const parseYear = (dateStr: string | null | undefined): number | null => {
      if (!dateStr) return null;
      if (dateStr.includes("-")) {
        // YYYY-MM-DD
        const y = parseInt(dateStr.split("-")[0]);
        return isNaN(y) ? null : y;
      }
      // DD/MM/YYYY
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const y = parseInt(parts[2]);
        return isNaN(y) ? null : y;
      }
      return null;
    };
    const fromYear = parseYear(v.valid_from);
    const toYear = parseYear(v.valid_to);
    if (fromYear) yearSet.add(fromYear);
    if (toYear) yearSet.add(toYear);
  }
  return Array.from(yearSet).sort((a, b) => a - b);
})();
```

### 1c. Update filteredValues to handle number year filter

Replace the `valuesValidityFilter === "this_year"` block with:

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
  // Value is valid in selected year if:
  // - from is null OR from year <= selected year
  // AND - to is null OR to year >= selected year
  const fromOk = fromYear === null || fromYear <= year;
  const toOk = toYear === null || toYear >= year;
  if (!fromOk || !toOk) return false;
}
```

Remove the old `valuesValidityFilter === "this_year"` block entirely.

### 1d. Replace the validity filter dropdown with year pills

Find the `<select>` for validity filter in the filter bar. Replace it entirely with:

```tsx
{/* Validity filter — pill buttons */}
<div className="flex items-center gap-1 flex-wrap">
  <button
    type="button"
    onClick={() => setValuesValidityFilter("all")}
    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
      valuesValidityFilter === "all"
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
    }`}
  >
    All
  </button>
  <button
    type="button"
    onClick={() => setValuesValidityFilter("no_expiry")}
    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
      valuesValidityFilter === "no_expiry"
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
    }`}
  >
    No expiry
  </button>
  {availableYears.map(year => (
    <button
      key={year}
      type="button"
      onClick={() => setValuesValidityFilter(year)}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        valuesValidityFilter === year
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
      }`}
    >
      {year}
    </button>
  ))}
</div>
```

### 1e. Reset validity filter on dimension change

In the dimension dropdown onChange handler, change:
```typescript
setValuesValidityFilter("all");
```
(This should already be "all" — just confirm it resets correctly since the type changed.)

---

## CHANGE 2 — Fix date display in values table (YYYY-MM-DD → DD/MM/YYYY)

The backend returns dates as `2024-01-01`. They must display as `01/01/2024`.

### 2a. Add a display helper

Add this helper alongside toInputDate and fromInputDate:

```typescript
const formatDateDisplay = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  // Already DD/MM/YYYY
  if (dateStr.includes("/")) return dateStr;
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
};
```

### 2b. Use the helper in renderValuesTable

Find the Valid From and Valid To cells in renderValuesTable:
```tsx
<td className="px-3 py-2 text-gray-500 text-[11px]">{v.valid_from ?? "—"}</td>
<td className="px-3 py-2 text-gray-500 text-[11px]">{v.valid_to ?? "—"}</td>
```

Replace with:
```tsx
<td className="px-3 py-2 text-gray-500 text-[11px]">{formatDateDisplay(v.valid_from)}</td>
<td className="px-3 py-2 text-gray-500 text-[11px]">{formatDateDisplay(v.valid_to)}</td>
```

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`feat: dimension validity filter — dynamic year pills; fix date display DD/MM/YYYY`
