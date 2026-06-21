# CC Brief — Fix Dimensions Page: Initial Load Missing loadDimValues

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. Run `npm run type-check` before committing — zero errors required

---

## ROOT CAUSE

Around line 261-266, on initial mount with a `dim` URL param present,
only `loadInlineValues(initialDimParam)` is called — `loadDimValues`
is never called. The Master data/values table relies on `dimValues`
state, which stays empty until the user manually changes the dimension
dropdown (which calls both functions). This causes a blank list on
refresh until the user navigates away and back.

---

## FIX

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### Step 1 — Add the missing call

At the initial-load block (around line 261-266):
```typescript
if (initialDimParam) {
  loadInlineValues(initialDimParam);
  loadDimValues(initialDimParam);
  if (initialSubTabParam) {
    setValuesSubTab(initialSubTabParam);
  }
}
```

### Step 2 — Check accessToken timing

Check whether this code block runs before `accessToken` is available
(i.e. if accessToken loads asynchronously after mount via some auth
context/hook). Both `loadInlineValues` and `loadDimValues` have an
internal guard `if (!accessToken) return;` — if accessToken isn't
ready yet when this code runs, both calls silently no-op.

If this is the case, move this initial-load logic into a useEffect
that depends on `[accessToken]`, guarded with a ref so it only runs
once:

```typescript
const didInitialLoad = useRef(false);

useEffect(() => {
  if (didInitialLoad.current) return;
  if (!accessToken) return;
  if (initialDimParam) {
    loadInlineValues(initialDimParam);
    loadDimValues(initialDimParam);
    if (initialSubTabParam) {
      setValuesSubTab(initialSubTabParam);
    }
  }
  didInitialLoad.current = true;
}, [accessToken]);
```

Show me what you find regarding accessToken timing and which fix
(simple addition vs useEffect wrapper) is applied.

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: dimensions page — load dimValues on initial mount, handle accessToken timing`
