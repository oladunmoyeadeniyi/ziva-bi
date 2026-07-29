# CC Brief — Dimensions: Fix Date Clear + URL State Persistence

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## ISSUE 1 — PATCH not firing on Save changes

The terminal shows no PATCH request when Save changes is clicked in the
Edit value modal. The handler is not reaching the fetch call.

### Fix

In `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`,
find `handleEditValueSave`. Add a console.log at the very start:
```typescript
console.log("handleEditValueSave fired", editValueModal);
```

Then check: is the Save button wired to `handleEditValueSave`? Find the
Save button in the Edit modal JSX and confirm its onClick calls
`handleEditValueSave`. If it is calling a different function or if
`editValueModal` is null when Save is clicked, fix it.

Also confirm the PATCH URL is correct:
```
PATCH /api/config/dimensions/{dimension_id}/values/{value_id}
```

Where `dimension_id` is `selectedDimForValues` and `value_id` is
`editValueModal.id`. Log both values.

After confirming and fixing the handler, ensure the PATCH body always
includes valid_from and valid_to as null when empty:
```typescript
patchBody.valid_from = editValueModal.valid_from.trim() || null;
patchBody.valid_to = editValueModal.valid_to.trim() || null;
```

After a successful PATCH, re-fetch the dimension values list to update
the UI, then close the modal.

---

## ISSUE 2 — URL state persistence on refresh

When the user refreshes the browser, the page resets to the default
state (Dimension setup tab, first dimension selected). The URL should
reflect the current state so refresh restores position.

### Fix

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

Use `useSearchParams` and `useRouter` from Next.js to sync state to URL.

#### Read initial state from URL on mount

```typescript
import { useSearchParams, useRouter } from "next/navigation";

const searchParams = useSearchParams();
const router = useRouter();
```

On mount, read these params and set initial state:
- `tab` → "setup" or "values" (controls which sub-tab is active)
- `dim` → dimension ID (controls which dimension is selected in values tab)

```typescript
useEffect(() => {
  const tab = searchParams.get("tab");
  const dim = searchParams.get("dim");
  if (tab === "values") {
    setActiveTab("values");  // or whatever the tab state variable is called
  }
  if (dim) {
    setSelectedDimForValues(dim);
  }
}, []);
```

#### Update URL when state changes

When user switches to values tab or selects a dimension, update the URL:

```typescript
const updateUrl = (tab: string, dimId?: string) => {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (dimId) params.set("dim", dimId);
  router.replace(`?${params.toString()}`, { scroll: false });
};
```

Call `updateUrl` whenever:
- User clicks "Master data / values" tab → `updateUrl("values", selectedDimForValues)`
- User selects a different dimension → `updateUrl("values", newDimId)`
- User clicks "Dimension setup" tab → `updateUrl("setup")`

---

## WATCH ITEMS
- Do NOT change any backend logic
- Do NOT change upload or template logic
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: dimensions — patch not firing on save, url state persistence on refresh`
