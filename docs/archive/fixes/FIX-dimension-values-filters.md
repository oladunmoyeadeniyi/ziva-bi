# CC Brief — Dimension Values: Status Filter, Validity Filter, Active/Inactive Grouping

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section at the bottom
3. Do NOT touch any file not in that list
4. Do NOT improve anything not mentioned in this brief
5. At the end, list every file you changed

---

## CONTEXT

On the Dimensions page, Master data / values tab, the manual codes values table
currently has a search bar and collapse toggle. This brief adds:

1. **Status filter** — All / Active / Inactive dropdown
2. **Validity filter** — All / Valid this year / No expiry dropdown
3. **Active/Inactive split** — two collapsible sections instead of one flat table,
   Active expanded by default, Inactive collapsed by default

---

## CHANGE — Frontend only

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### 1. Add filter state variables

```typescript
const [valuesStatusFilter, setValuesStatusFilter] = useState<"all" | "active" | "inactive">("all");
const [valuesValidityFilter, setValuesValidityFilter] = useState<"all" | "this_year" | "no_expiry">("all");
const [activeGroupCollapsed, setActiveGroupCollapsed] = useState(false);
const [inactiveGroupCollapsed, setInactiveGroupCollapsed] = useState(true);
```

### 2. Update filteredValues computation

Replace existing filteredValues with:

```typescript
const currentYear = new Date().getFullYear();

const filteredValues = (dimValues[selectedDimForValues] ?? []).filter(v => {
  if (valuesSearch) {
    const q = valuesSearch.toLowerCase();
    if (!v.code.toLowerCase().includes(q) && !v.name.toLowerCase().includes(q)) return false;
  }
  if (valuesStatusFilter === "active" && !v.is_active) return false;
  if (valuesStatusFilter === "inactive" && v.is_active) return false;
  if (valuesValidityFilter === "this_year") {
    const fromOk = !v.valid_from || parseInt(v.valid_from.split("/")[2]) <= currentYear;
    const toOk = !v.valid_to || parseInt(v.valid_to.split("/")[2]) >= currentYear;
    if (!fromOk || !toOk) return false;
  }
  if (valuesValidityFilter === "no_expiry") {
    if (v.valid_to) return false;
  }
  return true;
});

const activeValues = filteredValues.filter(v => v.is_active);
const inactiveValues = filteredValues.filter(v => !v.is_active);
```

### 3. Replace filter bar

Replace existing search + count + collapse row with:

```tsx
<div className="flex items-center gap-2 mb-3 flex-wrap">
  <input
    type="text"
    value={valuesSearch}
    onChange={e => setValuesSearch(e.target.value)}
    placeholder="Search by code or name…"
    className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  <select
    value={valuesStatusFilter}
    onChange={e => setValuesStatusFilter(e.target.value as "all" | "active" | "inactive")}
    className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none bg-white"
  >
    <option value="all">All statuses</option>
    <option value="active">Active only</option>
    <option value="inactive">Inactive only</option>
  </select>
  <select
    value={valuesValidityFilter}
    onChange={e => setValuesValidityFilter(e.target.value as "all" | "this_year" | "no_expiry")}
    className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none bg-white"
  >
    <option value="all">All validity</option>
    <option value="this_year">Valid in {new Date().getFullYear()}</option>
    <option value="no_expiry">No expiry</option>
  </select>
  <span className="text-xs text-gray-400">{filteredValues.length} values</span>
</div>
```

### 4. Extract renderValuesTable helper

Add this function inside the component (before the return statement):

```typescript
const renderValuesTable = (values: DimensionValue[]) => (
  <table className="w-full text-xs">
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className="w-8 px-3 py-2">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 accent-blue-600"
            checked={values.length > 0 && values.every(v => selectedValueIds.has(v.id))}
            onChange={e => {
              setSelectedValueIds(prev => {
                const next = new Set(prev);
                if (e.target.checked) values.forEach(v => next.add(v.id));
                else values.forEach(v => next.delete(v.id));
                return next;
              });
            }}
          />
        </th>
        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Code</th>
        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Name</th>
        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Valid From</th>
        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Valid To</th>
        <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {values.map(v => (
        <tr key={v.id} className="hover:bg-gray-50">
          <td className="px-3 py-2">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-blue-600"
              checked={selectedValueIds.has(v.id)}
              onChange={e => {
                setSelectedValueIds(prev => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(v.id);
                  else next.delete(v.id);
                  return next;
                });
              }}
            />
          </td>
          <td className="px-3 py-2 font-mono text-gray-700">{v.code}</td>
          <td className="px-3 py-2 text-gray-800">{v.name}</td>
          <td className="px-3 py-2 text-gray-500 text-[11px]">{v.valid_from ?? "—"}</td>
          <td className="px-3 py-2 text-gray-500 text-[11px]">{v.valid_to ?? "—"}</td>
          <td className="px-3 py-2">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditValueModal({
                  id: v.id,
                  code: v.code,
                  name: v.name,
                  description: v.description ?? "",
                  valid_from: v.valid_from ?? "",
                  valid_to: v.valid_to ?? "",
                  is_active: v.is_active,
                })}
                className="text-[11px] text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleToggleValue(v.id)}
                className="text-[11px] text-gray-500 hover:text-gray-800"
              >
                {v.is_active ? "Deactivate" : "Reactivate"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmModal({
                  type: "delete",
                  ids: [v.id],
                  label: `Delete "${v.code} — ${v.name}"? This cannot be undone.`
                })}
                className="text-[11px] text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
```

### 5. Replace existing flat table block with two collapsible group sections

Remove the old `{!valuesCollapsed && ...}` table block entirely.
Replace with:

```tsx
{/* ACTIVE GROUP */}
<div className="mb-3">
  <button
    type="button"
    onClick={() => setActiveGroupCollapsed(prev => !prev)}
    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 mb-1"
  >
    <span className="text-xs font-semibold text-gray-700 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
      Active
      <span className="font-normal text-gray-400">({activeValues.length})</span>
    </span>
    <span className="text-xs text-gray-400">{activeGroupCollapsed ? "▼ Expand" : "▲ Collapse"}</span>
  </button>
  {!activeGroupCollapsed && (
    activeValues.length === 0 ? (
      <p className="text-xs text-gray-400 italic px-3 py-3">No active values match your filters.</p>
    ) : (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {renderValuesTable(activeValues)}
      </div>
    )
  )}
</div>

{/* INACTIVE GROUP — only shown if there are inactive values matching filters */}
{inactiveValues.length > 0 && (
  <div>
    <button
      type="button"
      onClick={() => setInactiveGroupCollapsed(prev => !prev)}
      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 mb-1"
    >
      <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
        Inactive
        <span className="font-normal text-gray-400">({inactiveValues.length})</span>
      </span>
      <span className="text-xs text-gray-400">{inactiveGroupCollapsed ? "▼ Expand" : "▲ Collapse"}</span>
    </button>
    {!inactiveGroupCollapsed && (
      <div className="border border-gray-200 rounded-lg overflow-hidden opacity-75">
        {renderValuesTable(inactiveValues)}
      </div>
    )}
  </div>
)}
```

### 6. Reset all filters when dimension changes

In the dimension dropdown onChange handler, add these resets alongside the existing ones:

```typescript
setValuesStatusFilter("all");
setValuesValidityFilter("all");
setValuesSearch("");
setSelectedValueIds(new Set());
setActiveGroupCollapsed(false);
setInactiveGroupCollapsed(true);
```

### 7. Remove the old valuesCollapsed state and its toggle

Since collapse is now handled per-group, remove:
- `valuesCollapsed` state variable
- Any toggle button that referenced it

---

## WATCH ITEMS
- Do NOT touch the backend
- Do NOT change any other page or component
- Do NOT use browser alert() or confirm()
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`feat: dimension values — status filter, validity filter, active/inactive collapsible groups`
