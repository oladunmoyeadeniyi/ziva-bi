# CC Brief — CoA FS Mappings: Cascading Filters

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any other tab or upload logic
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CONTEXT

The FS Mappings tab has four filters: Account Type, FS Head, FS Note,
TB Mapping. Currently each filter's options are derived from ALL data,
not from the currently filtered subset. They must cascade — each filter's
options narrow based on what the upstream filters have already selected.

---

## CHANGE — Frontend: cascading filter options

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

Find the FS Mappings tab filter logic. Replace the static options
derivation with cascading derived options:

```typescript
// Step 1 — filter by Account Type
const afterTypeFilter = fsMappings.filter(a =>
  !filterAccountType || a.account_type === filterAccountType
);

// Step 2 — FS Head options derived from step 1
const fsHeadOptions = useMemo(() =>
  Array.from(new Set(afterTypeFilter.map(a => a.fs_head).filter(Boolean))).sort()
, [afterTypeFilter]);

// Step 3 — filter by FS Head
const afterFsHeadFilter = afterTypeFilter.filter(a =>
  !filterFsHead || a.fs_head === filterFsHead
);

// Step 4 — FS Note options derived from step 3
const fsNoteOptions = useMemo(() =>
  Array.from(new Set(afterFsHeadFilter.map(a => a.fs_note).filter(Boolean))).sort()
, [afterFsHeadFilter]);

// Step 5 — filter by FS Note
const afterFsNoteFilter = afterFsHeadFilter.filter(a =>
  !filterFsNote || a.fs_note === filterFsNote
);

// Step 6 — TB Mapping options derived from step 5
const tbMappingOptions = useMemo(() =>
  Array.from(new Set(afterFsNoteFilter.map(a => a.tb_mapping).filter(Boolean))).sort()
, [afterFsNoteFilter]);

// Step 7 — final filtered + sorted list
const sortedFsMappings = [...afterFsNoteFilter.filter(a =>
  !filterTbMapping || a.tb_mapping === filterTbMapping
)].sort((a, b) => {
  if (!a.fs_head && b.fs_head) return 1;
  if (a.fs_head && !b.fs_head) return -1;
  const aVal = (a as Record<string, string>)[fsSortCol] ?? "";
  const bVal = (b as Record<string, string>)[fsSortCol] ?? "";
  const cmp = aVal.localeCompare(bVal);
  return fsSortDir === "asc" ? cmp : -cmp;
});
```

### Reset downstream filters when upstream changes

When Account Type changes → reset filterFsHead, filterFsNote, filterTbMapping
When FS Head changes → reset filterFsNote, filterTbMapping
When FS Note changes → reset filterTbMapping

```typescript
const handleTypeChange = (val: string) => {
  setFilterAccountType(val);
  setFilterFsHead("");
  setFilterFsNote("");
  setFilterTbMapping("");
};

const handleFsHeadChange = (val: string) => {
  setFilterFsHead(val);
  setFilterFsNote("");
  setFilterTbMapping("");
};

const handleFsNoteChange = (val: string) => {
  setFilterFsNote(val);
  setFilterTbMapping("");
};
```

Wire these handlers to the respective dropdowns onChange.

---

## WATCH ITEMS
- Do NOT change the Accounts tab filters
- Do NOT change the Account groups tab
- Do NOT touch the backend
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`feat: coa fs mappings — cascading filters (type → fs head → fs note → tb mapping)`
