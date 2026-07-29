# CC Brief — CoA: Dynamic Group Filter, FS Mappings Filters/Sort, Account Classification Filter

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any upload logic or backend schemas
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CHANGE 1 — Accounts tab: dynamic GL Group filter dropdown

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

Find the GL Group filter on the Accounts tab. It currently uses hardcoded
options. Replace with a dynamic dropdown populated from distinct `gl_group`
values in the loaded `accounts` state:

```typescript
const groupOptions = useMemo(() => {
  const groups = new Set<string>();
  accounts.forEach(a => { if (a.gl_group) groups.add(a.gl_group); });
  return Array.from(groups).sort();
}, [accounts]);
```

Replace the hardcoded `<select>` or filter options with:
```tsx
<select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
  className="...existing classes...">
  <option value="">All groups</option>
  {groupOptions.map(g => (
    <option key={g} value={g}>{g}</option>
  ))}
</select>
```

---

## CHANGE 2 — FS Mappings tab: add FS Note + TB Mapping filters + column sorting

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

### 2a. Add two more filter dropdowns to the FS mappings filter bar

Add dynamic dropdowns for FS Note and TB Mapping, populated from distinct
values in the loaded fsMappings data:

```typescript
const fsNoteOptions = useMemo(() => {
  const vals = new Set<string>();
  fsMappings.forEach(a => { if (a.fs_note) vals.add(a.fs_note); });
  return Array.from(vals).sort();
}, [fsMappings]);

const tbMappingOptions = useMemo(() => {
  const vals = new Set<string>();
  fsMappings.forEach(a => { if (a.tb_mapping) vals.add(a.tb_mapping); });
  return Array.from(vals).sort();
}, [fsMappings]);
```

Add state:
```typescript
const [filterFsNote, setFilterFsNote] = useState("");
const [filterTbMapping, setFilterTbMapping] = useState("");
```

Add to filter bar:
```tsx
<select value={filterFsNote} onChange={e => setFilterFsNote(e.target.value)}>
  <option value="">All FS Notes</option>
  {fsNoteOptions.map(n => <option key={n} value={n}>{n}</option>)}
</select>

<select value={filterTbMapping} onChange={e => setFilterTbMapping(e.target.value)}>
  <option value="">All TB Mappings</option>
  {tbMappingOptions.map(t => <option key={t} value={t}>{t}</option>)}
</select>
```

Apply to the filtered fsMappings list:
```typescript
const filteredFsMappings = fsMappings.filter(a => {
  if (filterAccountType && a.account_type !== filterAccountType) return false;
  if (filterFsHead && a.fs_head !== filterFsHead) return false;
  if (filterFsNote && a.fs_note !== filterFsNote) return false;
  if (filterTbMapping && a.tb_mapping !== filterTbMapping) return false;
  return true;
});
```

### 2b. Add column sorting to FS Mappings table

Add sort state:
```typescript
const [fsSortCol, setFsSortCol] = useState<string>("gl_number");
const [fsSortDir, setFsSortDir] = useState<"asc" | "desc">("asc");

const toggleFsSort = (col: string) => {
  if (fsSortCol === col) setFsSortDir(d => d === "asc" ? "desc" : "asc");
  else { setFsSortCol(col); setFsSortDir("asc"); }
};
```

Sort the filtered list:
```typescript
const sortedFsMappings = [...filteredFsMappings].sort((a, b) => {
  const aVal = (a as Record<string, string>)[fsSortCol] ?? "";
  const bVal = (b as Record<string, string>)[fsSortCol] ?? "";
  // Unmapped (no fs_head) always goes to bottom regardless of sort direction
  if (!a.fs_head && b.fs_head) return 1;
  if (a.fs_head && !b.fs_head) return -1;
  const cmp = aVal.localeCompare(bVal);
  return fsSortDir === "asc" ? cmp : -cmp;
});
```

Update table headers to be clickable sort triggers:
```tsx
{[
  { key: "gl_number", label: "GL Number" },
  { key: "gl_name", label: "GL Name" },
  { key: "fs_head", label: "FS Head" },
  { key: "fs_note", label: "FS Note" },
  { key: "tb_mapping", label: "TB Mapping" },
].map(col => (
  <th key={col.key}
    onClick={() => toggleFsSort(col.key)}
    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none">
    {col.label}
    {fsSortCol === col.key && (
      <i className={`ti ${fsSortDir === "asc" ? "ti-sort-ascending" : "ti-sort-descending"} ml-1`}
         style={{ fontSize: 11 }} />
    )}
  </th>
))}
```

---

## CHANGE 3 — Account Classification dropdown: filter by Account Type

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

Find the Account Classification dropdown in the Edit GL Account modal.
It currently shows all classifications regardless of Account Type.

Define classification options per type:
```typescript
const PL_CLASSIFICATIONS = [
  "Revenue",
  "Cost of sales",
  "Gross profit",
  "Operating expense",
  "EBITDA",
  "Depreciation & amortisation",
  "EBIT",
  "Finance income",
  "Finance cost",
  "Tax expense",
  "Other comprehensive income",
];

const BS_CLASSIFICATIONS = [
  "Non-current asset",
  "Current asset",
  "Cash & cash equivalent",
  "Non-current liability",
  "Current liability",
  "Equity",
  "Retained earnings",
];
```

In the modal, replace the static classification list with a dynamic one
based on the current `editAccountType` (or equivalent state):

```tsx
const classificationOptions =
  editAccountType === "SOCI" ? PL_CLASSIFICATIONS :
  editAccountType === "SOFP" ? BS_CLASSIFICATIONS :
  [...PL_CLASSIFICATIONS, ...BS_CLASSIFICATIONS];

<select value={editClassification} onChange={...}>
  <option value="">— Select classification —</option>
  {classificationOptions.map(c => (
    <option key={c} value={c}>{c}</option>
  ))}
</select>
```

When Account Type changes in the modal, reset the classification to ""
if the current classification is not valid for the new type.

---

## WATCH ITEMS
- Do NOT change any upload logic
- Do NOT change the Account groups tab
- Do NOT touch the backend
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`feat: coa — dynamic group filter, fs mappings filters+sort, classification filtered by account type`
