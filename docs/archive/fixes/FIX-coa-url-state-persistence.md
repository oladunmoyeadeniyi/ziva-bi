# CC Brief — CoA Page: URL State Persistence for Tab on Refresh

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any tab content, filters, or upload logic
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CONTEXT

The CoA page has a `coaTab` state ("accounts" | "groups" | "fs_mappings" |
"dimensions") that resets to "accounts" on every browser refresh, losing
the user's position. The Dimensions page already solved this exact problem
using `useSearchParams` + `router.replace` to sync state to the URL. Apply
the same pattern here.

---

## CHANGE — Sync coaTab to URL, restore on mount

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

### Step 1 — Import navigation hooks

```typescript
import { useSearchParams, useRouter } from "next/navigation";
```

### Step 2 — Read initial tab from URL at component init

Find where `coaTab` state is declared:
```typescript
const [coaTab, setCoaTab] = useState<CoATab>("accounts");
```

Replace with URL-seeded initialization:
```typescript
const searchParams = useSearchParams();
const router = useRouter();

const initialTabParam = (searchParams.get("tab") as CoATab) || "accounts";
const [coaTab, setCoaTab] = useState<CoATab>(initialTabParam);
```

### Step 3 — Update URL whenever coaTab changes

Add a helper and wire it to every place that currently calls `setCoaTab`:

```typescript
const updateCoaTabUrl = (tab: CoATab) => {
  const params = new URLSearchParams();
  params.set("tab", tab);
  router.replace(`?${params.toString()}`, { scroll: false });
};
```

Find the sub-tab button row (Accounts / Account groups / FS mappings /
Dimensions). Update each button's onClick from:
```tsx
onClick={() => setCoaTab(t.key)}
```
To:
```tsx
onClick={() => { setCoaTab(t.key); updateCoaTabUrl(t.key); }}
```

Also find any OTHER place in the file that calls `setCoaTab(...)` directly
(for example, when clicking a GL number in the Account groups tree to
navigate to the Accounts tab, or similar cross-tab navigation). Update
each of those calls to also call `updateCoaTabUrl` with the same value,
so the URL always matches the active tab regardless of how it changed.

### Step 4 — Confirm no infinite loop

Since `coaTab` is now seeded once from `searchParams` at mount (not in a
useEffect watching searchParams), there is no risk of a render loop from
`router.replace`. Do not wrap the initial read in a useEffect — keep it
as a plain const computed once during render, exactly like the existing
working pattern in `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`
(see `initialTabParam` there for reference).

---

## WATCH ITEMS
- Do NOT change any tab's content or behaviour
- Do NOT change filters, sorting, or upload logic
- Do NOT touch the backend
- Mirror the exact working pattern already proven on the Dimensions page —
  do not invent a new approach
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`fix: coa page — persist active tab in URL so refresh restores position`
