# CC Brief — Fix: Dimension Values List — Search, Actions, Bulk Select, Collapse

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section at the bottom
3. Do NOT touch any file not in that list
4. Do NOT improve anything not mentioned in this brief
5. At the end, list every file you changed

---

## CONTEXT

The Master data / values tab on the Dimensions page
(`/dashboard/business/settings/dimensions`) shows a flat list of dimension
values (CODE | NAME) with no actions, no search, no bulk selection, and no
way to collapse the list. With 122+ records loaded, this is unusable.

The following must be added to the values table:

1. **Search/filter** — filter values by code or name as user types
2. **Checkbox column** — select individual rows; select-all checkbox in header
3. **Actions column** — per-row Edit, Deactivate/Reactivate, Delete
4. **Bulk action bar** — appears when 1+ rows selected: Deactivate, Reactivate, Delete all selected
5. **Collapse toggle** — ability to collapse/expand the values list panel
6. **Status display** — show whether a value is Active or Inactive
7. **Confirmation modal** — for destructive actions (delete, bulk delete) — use UI modal, NOT browser confirm()

---

## CHANGE 1 — Backend: `backend/app/routers/config.py`

### 1a. Verify these endpoints exist. If any are missing, create them.

```
PATCH  /api/config/dimensions/{dimension_id}/values/{value_id}         — edit name/description
PATCH  /api/config/dimensions/{dimension_id}/values/{value_id}/toggle  — activate/deactivate
DELETE /api/config/dimensions/{dimension_id}/values/{value_id}         — hard delete single
POST   /api/config/dimensions/{dimension_id}/values/bulk-deactivate    — body: { ids: [int] }
POST   /api/config/dimensions/{dimension_id}/values/bulk-reactivate    — body: { ids: [int] }
POST   /api/config/dimensions/{dimension_id}/values/bulk-delete        — body: { ids: [int] }
```

### 1b. If GET /api/config/dimensions/{dimension_id}/values does not return `is_active` field, add it to the response schema.

The values list response must include at minimum:
```json
{
  "id": 1,
  "code": "NG_AEKHALAMA",
  "name": "Khalamanja",
  "description": null,
  "is_active": true
}
```

### 1c. Bulk endpoints implementation pattern

```python
@router.post("/dimensions/{dimension_id}/values/bulk-deactivate")
async def bulk_deactivate_values(
    dimension_id: int,
    payload: dict,  # { "ids": [int] }
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.tenant_id
    ids = payload.get("ids", [])
    await db.execute(
        update(DimensionValue)
        .where(
            DimensionValue.id.in_(ids),
            DimensionValue.dimension_id == dimension_id,
            DimensionValue.tenant_id == tenant_id,
        )
        .values(is_active=False)
    )
    await db.commit()
    return {"updated": len(ids)}
```

Apply same pattern for bulk-reactivate (is_active=True) and bulk-delete
(use delete() instead of update()).

---

## CHANGE 2 — Frontend: Dimensions page

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### 2a. Add state variables

Add these alongside existing state:

```typescript
const [valuesSearch, setValuesSearch] = useState("");
const [selectedValueIds, setSelectedValueIds] = useState<Set<number>>(new Set());
const [valuesCollapsed, setValuesCollapsed] = useState(false);
const [confirmModal, setConfirmModal] = useState<{
  type: "delete" | "bulk-delete" | "deactivate" | "bulk-deactivate" | "bulk-reactivate";
  ids: number[];
  label: string;
} | null>(null);
const [actionLoading, setActionLoading] = useState(false);
```

### 2b. Computed filtered values

```typescript
const filteredValues = (dimensionValues ?? []).filter(v => {
  if (!valuesSearch) return true;
  const q = valuesSearch.toLowerCase();
  return v.code.toLowerCase().includes(q) || v.name.toLowerCase().includes(q);
});
```

### 2c. Replace the existing bare values table with the full enhanced version

The values section should render as follows (replace whatever currently exists):

```tsx
{/* Search bar + collapse toggle */}
<div className="flex items-center gap-2 mb-3">
  <input
    type="text"
    value={valuesSearch}
    onChange={e => setValuesSearch(e.target.value)}
    placeholder="Search by code or name…"
    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  <span className="text-xs text-gray-400">{filteredValues.length} values</span>
  <button
    type="button"
    onClick={() => setValuesCollapsed(prev => !prev)}
    className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border border-gray-200 rounded"
  >
    {valuesCollapsed ? "▼ Expand" : "▲ Collapse"}
  </button>
</div>

{/* Bulk action bar — only visible when rows selected */}
{selectedValueIds.size > 0 && (
  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
    <span className="text-xs font-medium text-blue-700">
      {selectedValueIds.size} selected
    </span>
    <button
      type="button"
      onClick={() => setConfirmModal({
        type: "bulk-deactivate",
        ids: Array.from(selectedValueIds),
        label: `Deactivate ${selectedValueIds.size} value(s)?`
      })}
      className="text-xs px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
    >
      Deactivate
    </button>
    <button
      type="button"
      onClick={() => setConfirmModal({
        type: "bulk-reactivate",
        ids: Array.from(selectedValueIds),
        label: `Reactivate ${selectedValueIds.size} value(s)?`
      })}
      className="text-xs px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
    >
      Reactivate
    </button>
    <button
      type="button"
      onClick={() => setConfirmModal({
        type: "bulk-delete",
        ids: Array.from(selectedValueIds),
        label: `Permanently delete ${selectedValueIds.size} value(s)? This cannot be undone.`
      })}
      className="text-xs px-3 py-1 rounded border border-red-300 bg-white text-red-600 hover:bg-red-50"
    >
      Delete
    </button>
    <button
      type="button"
      onClick={() => setSelectedValueIds(new Set())}
      className="ml-auto text-xs text-gray-400 hover:text-gray-600"
    >
      Clear selection
    </button>
  </div>
)}

{/* Values table */}
{!valuesCollapsed && (
  <div className="border border-gray-200 rounded-lg overflow-hidden">
    <table className="w-full text-xs">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="w-8 px-3 py-2">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-blue-600"
              checked={
                filteredValues.length > 0 &&
                filteredValues.every(v => selectedValueIds.has(v.id))
              }
              onChange={e => {
                if (e.target.checked) {
                  setSelectedValueIds(new Set(filteredValues.map(v => v.id)));
                } else {
                  setSelectedValueIds(new Set());
                }
              }}
            />
          </th>
          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">
            Code
          </th>
          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">
            Name
          </th>
          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">
            Status
          </th>
          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {filteredValues.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
              {valuesSearch ? "No values match your search." : "No values yet."}
            </td>
          </tr>
        ) : (
          filteredValues.map(v => (
            <tr
              key={v.id}
              className={`hover:bg-gray-50 ${!v.is_active ? "opacity-50" : ""}`}
            >
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
              <td className="px-3 py-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  v.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {v.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleValue(v.id, v.is_active)}
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
          ))
        )}
      </tbody>
    </table>
  </div>
)}
```

### 2d. Add action handler functions

```typescript
const handleToggleValue = async (valueId: number, currentlyActive: boolean) => {
  if (!accessToken) return;
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(
      `${BASE}/api/config/dimensions/${activeDimensionId}/values/${valueId}/toggle`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) throw new Error("Failed to toggle value");
    await loadDimensionValues(activeDimensionId);
  } catch (err) {
    console.error(err);
  }
};

const handleConfirmAction = async () => {
  if (!confirmModal || !accessToken) return;
  setActionLoading(true);
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const { type, ids } = confirmModal;

    if (type === "delete") {
      await fetch(
        `${BASE}/api/config/dimensions/${activeDimensionId}/values/${ids[0]}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } else if (type === "bulk-delete") {
      await fetch(
        `${BASE}/api/config/dimensions/${activeDimensionId}/values/bulk-delete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        }
      );
    } else if (type === "bulk-deactivate") {
      await fetch(
        `${BASE}/api/config/dimensions/${activeDimensionId}/values/bulk-deactivate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        }
      );
    } else if (type === "bulk-reactivate") {
      await fetch(
        `${BASE}/api/config/dimensions/${activeDimensionId}/values/bulk-reactivate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        }
      );
    }

    setSelectedValueIds(new Set());
    await loadDimensionValues(activeDimensionId);
  } catch (err) {
    console.error(err);
  } finally {
    setActionLoading(false);
    setConfirmModal(null);
  }
};
```

Note: `activeDimensionId` is the ID of whichever dimension is currently selected
in the dropdown. Use whatever variable currently tracks this in the component.

### 2e. Add confirmation modal JSX

Add this just before the closing root `</div>`:

```tsx
{confirmModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div
      className="absolute inset-0 bg-black/40"
      onClick={() => !actionLoading && setConfirmModal(null)}
    />
    <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Confirm action</h2>
      <p className="text-sm text-gray-600 mb-5">{confirmModal.label}</p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setConfirmModal(null)}
          disabled={actionLoading}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirmAction}
          disabled={actionLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
        >
          {actionLoading ? "Processing…" : "Confirm"}
        </button>
      </div>
    </div>
  </div>
)}
```

---

## WATCH ITEMS
- Do NOT change `config.py` database name — must stay `ziva_dev`
- Do NOT rewrite CORS in `main.py` — must keep `http://localhost:3000`
- Do NOT make any unsolicited UI changes to any other part of the page
- Do NOT use browser `alert()` or `confirm()` anywhere — always use the UI modal

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`feat: dimension values list — search, checkbox select, bulk actions, deactivate, delete, collapse`
