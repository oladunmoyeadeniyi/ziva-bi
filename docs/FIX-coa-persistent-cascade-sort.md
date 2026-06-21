# CC Brief — CoA: Persistent Multi-Column Cascade Sorting + Cascading Filters on Accounts Tab

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any upload logic or backend
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CONTEXT

Two features needed across CoA tabs:
1. Multi-column cascade sorting, persistent in localStorage, on both
   Accounts tab and FS Mappings tab
2. Cascading filters on the Accounts tab

---

## CHANGE 1 — Shared sort state type and localStorage persistence

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

### 1a. Define sort type

```typescript
type SortEntry = { col: string; dir: "asc" | "desc" };
```

### 1b. Sort state with localStorage persistence

Use a helper to load/save sort state. Key by tab so Accounts and
FS Mappings have independent sort preferences:

```typescript
const SORT_STORAGE_KEY_ACCOUNTS = "ziva_coa_accounts_sort";
const SORT_STORAGE_KEY_FS = "ziva_coa_fs_sort";

const loadSort = (key: string): SortEntry[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveSort = (key: string, sort: SortEntry[]) => {
  try { localStorage.setItem(key, JSON.stringify(sort)); } catch {}
};

const [accountsSort, setAccountsSort] = useState<SortEntry[]>(
  () => loadSort(SORT_STORAGE_KEY_ACCOUNTS)
);
const [fsMappingsSort, setFsMappingsSort] = useState<SortEntry[]>(
  () => loadSort(SORT_STORAGE_KEY_FS)
);
```

### 1c. Persist on change

```typescript
useEffect(() => {
  saveSort(SORT_STORAGE_KEY_ACCOUNTS, accountsSort);
}, [accountsSort]);

useEffect(() => {
  saveSort(SORT_STORAGE_KEY_FS, fsMappingsSort);
}, [fsMappingsSort]);
```

### 1d. Toggle sort handler (shared)

```typescript
const toggleSort = (
  sort: SortEntry[],
  setSort: (s: SortEntry[]) => void,
  col: string
) => {
  const existing = sort.find(s => s.col === col);
  if (!existing) {
    // Not sorted — add as ascending with next priority
    setSort([...sort, { col, dir: "asc" }]);
  } else if (existing.dir === "asc") {
    // Ascending → descending
    setSort(sort.map(s => s.col === col ? { ...s, dir: "desc" } : s));
  } else {
    // Descending → remove from sort
    setSort(sort.filter(s => s.col !== col));
  }
};
```

### 1e. Apply multi-column sort to a list

```typescript
const applySort = <T extends Record<string, unknown>>(
  list: T[],
  sort: SortEntry[]
): T[] => {
  if (!sort.length) return list;
  return [...list].sort((a, b) => {
    for (const { col, dir } of sort) {
      const aVal = String(a[col] ?? "");
      const bVal = String(b[col] ?? "");
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
};
```

### 1f. Sort indicator component

```typescript
const SortIndicator = ({
  col,
  sort,
}: {
  col: string;
  sort: SortEntry[];
}) => {
  const entry = sort.find(s => s.col === col);
  if (!entry) return null;
  const priority = sort.indexOf(entry) + 1;
  return (
    <span style={{ fontSize: 10, marginLeft: 4, color: "var(--color-text-secondary)" }}>
      {entry.dir === "asc" ? "↑" : "↓"}
      {sort.length > 1 && (
        <sup style={{ fontSize: 9 }}>{priority}</sup>
      )}
    </span>
  );
};
```

---

## CHANGE 2 — Accounts tab: apply cascade sort + cascading filters

### 2a. Cascading filters

Replace current static filter options with cascading derived options:

```typescript
// Account Type is independent — options always from full list
const accountTypeOptions = useMemo(() =>
  Array.from(new Set(accounts.map(a => a.account_type).filter(Boolean))).sort()
, [accounts]);

// After Account Type filter
const afterTypeFilter = accounts.filter(a =>
  !filterType || a.account_type === filterType
);

// GL Group options from after-type subset
const groupOptions = useMemo(() =>
  Array.from(new Set(afterTypeFilter.map(a => a.gl_group).filter(Boolean))).sort()
, [afterTypeFilter]);

// After GL Group filter
const afterGroupFilter = afterTypeFilter.filter(a =>
  !filterGroup || a.gl_group === filterGroup
);

// Classification options from after-group subset
const classificationOptions = useMemo(() =>
  Array.from(new Set(afterGroupFilter.map(a => a.account_classification).filter(Boolean))).sort()
, [afterGroupFilter]);

// Final filtered list (apply remaining filters + status)
const filteredAccounts = afterGroupFilter.filter(a => {
  if (filterGL && !a.gl_number.includes(filterGL)) return false;
  if (filterName && !a.gl_name.toLowerCase().includes(filterName.toLowerCase())) return false;
  if (filterClassification && a.account_classification !== filterClassification) return false;
  if (filterStatus === "active" && !a.is_active) return false;
  if (filterStatus === "inactive" && a.is_active) return false;
  return true;
});
```

Reset downstream filters when upstream changes:
```typescript
// When Account Type changes
const handleTypeChange = (val: string) => {
  setFilterType(val);
  setFilterGroup("");
  setFilterClassification("");
};

// When GL Group changes
const handleGroupChange = (val: string) => {
  setFilterGroup(val);
  setFilterClassification("");
};
```

### 2b. Apply sort to accounts

```typescript
const sortedAccounts = applySort(
  filteredAccounts as Record<string, unknown>[],
  accountsSort
) as GLAccount[];
```

Use `sortedAccounts` in the accounts table render instead of `filteredAccounts`.

### 2c. Clickable column headers on Accounts table

Make GL Number, GL Name, GL Group, Account Type, Classification, Status
headers clickable:

```tsx
<th onClick={() => toggleSort(accountsSort, setAccountsSort, "gl_number")}
    className="cursor-pointer select-none hover:text-gray-700 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
  GL Number <SortIndicator col="gl_number" sort={accountsSort} />
</th>
```

Apply same pattern for: gl_name, gl_group, account_type, account_classification, is_active.

### 2d. Clear sorting button on Accounts tab

Add a "Clear sorting" button that only appears when accountsSort.length > 0:

```tsx
{accountsSort.length > 0 && (
  <button
    type="button"
    onClick={() => setAccountsSort([])}
    className="text-xs text-gray-500 hover:text-gray-700 underline"
  >
    Clear sorting
  </button>
)}
```

---

## CHANGE 3 — FS Mappings tab: upgrade to cascade sort

### 3a. Replace existing single-column sort with cascade sort

Remove the old `fsSortCol` and `fsSortDir` state. Use `fsMappingsSort`
(SortEntry[]) from Change 1 instead.

### 3b. Apply sort

```typescript
const sortedFsMappings = applySort(
  filteredFsMappings.map(a => ({
    ...a,
    // Unmapped accounts always sort to bottom
    _unmapped: a.fs_head ? "0" : "1",
  })),
  [{ col: "_unmapped", dir: "asc" }, ...fsMappingsSort]
) as typeof filteredFsMappings;
```

### 3c. Clickable headers

Apply same clickable header pattern for: gl_number, gl_name, fs_head,
fs_note, tb_mapping.

### 3d. Clear sorting button

Add same "Clear sorting" button when fsMappingsSort.length > 0.

---

## WATCH ITEMS
- Do NOT use sessionStorage — must use localStorage for persistence
- Do NOT change the Account groups tab
- Do NOT touch the backend
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`feat: coa — persistent multi-column cascade sort + cascading filters on accounts and fs mappings tabs`
