# CC Brief — Fix Date Conversion in Dimension Value Edit Modal

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## PROBLEM

The date picker shows `12/31/2024` which is MM/DD/YYYY (US format), not DD/MM/YYYY.
This means `fromInputDate` is swapping day and month incorrectly.
The backend expects DD/MM/YYYY and is rejecting the dates with "invalid character in year".

---

## FIX

Find the `toInputDate` and `fromInputDate` helper functions in the component and
replace them with these exact implementations:

```typescript
// Convert DD/MM/YYYY → YYYY-MM-DD for <input type="date"> value prop
const toInputDate = (ddmmyyyy: string): string => {
  if (!ddmmyyyy) return "";
  const [d, m, y] = ddmmyyyy.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

// Convert YYYY-MM-DD from <input type="date"> → DD/MM/YYYY for state/API
const fromInputDate = (yyyymmdd: string): string => {
  if (!yyyymmdd) return "";
  const [y, m, d] = yyyymmdd.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};
```

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: dimension date helpers — correct DD/MM/YYYY conversion for date picker`
