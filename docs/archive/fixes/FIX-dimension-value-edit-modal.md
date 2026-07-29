# CC Brief — Dimension Values: Edit Modal + Add Form Date Fields

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section at the bottom
3. Do NOT touch any file not in that list
4. Do NOT improve anything not mentioned in this brief
5. At the end, list every file you changed

---

## CONTEXT

Two related changes to the Dimension Values UI on the Master data / values tab
(`/dashboard/business/settings/dimensions`, Master data / values tab):

1. The **+ Add value** inline form currently has only Code, Name, Description.
   It needs Valid From, Valid To, and Is Active fields added.

2. Each value row has Deactivate and Delete actions but NO Edit action.
   A per-row **Edit modal** is needed to update Name, Description, Valid From,
   Valid To, and Is Active on any existing value.

---

## CHANGE 1 — Backend: `backend/app/routers/config.py`

### 1a. Verify PATCH /api/config/dimensions/{dimension_id}/values/{value_id} exists

Find the endpoint for editing a single dimension value. It should accept:
```json
{
  "name": "string (optional)",
  "description": "string or null (optional)",
  "valid_from": "DD/MM/YYYY string or null (optional)",
  "valid_to": "DD/MM/YYYY string or null (optional)",
  "is_active": "boolean (optional)"
}
```

If it doesn't exist, create it:

```python
@router.patch("/dimensions/{dimension_id}/values/{value_id}")
async def update_dimension_value(
    dimension_id: uuid.UUID,
    value_id: uuid.UUID,
    payload: dict,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)
    result = await db.execute(
        select(DimensionValue).where(
            DimensionValue.id == value_id,
            DimensionValue.dimension_id == dimension_id,
            DimensionValue.tenant_id == tenant_id,
        )
    )
    val = result.scalar_one_or_none()
    if not val:
        raise HTTPException(status_code=404, detail="Value not found.")

    if "name" in payload and payload["name"]:
        val.name = payload["name"].strip()
    if "description" in payload:
        val.description = payload["description"]
    if "is_active" in payload:
        val.is_active = bool(payload["is_active"])

    # Parse valid_from and valid_to from DD/MM/YYYY string
    from datetime import datetime as _dt
    for field in ("valid_from", "valid_to"):
        if field in payload:
            raw = payload[field]
            if raw is None or raw == "":
                setattr(val, field, None)
            else:
                try:
                    setattr(val, field, _dt.strptime(raw.strip(), "%d/%m/%Y").date())
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid date format for {field}. Use DD/MM/YYYY."
                    )

    await db.flush()
    return {"id": str(val.id), "code": val.code, "name": val.name,
            "description": val.description, "is_active": val.is_active,
            "valid_from": val.valid_from.strftime("%d/%m/%Y") if val.valid_from else None,
            "valid_to": val.valid_to.strftime("%d/%m/%Y") if val.valid_to else None}
```

Note: If `valid_from` and `valid_to` columns don't yet exist on the DimensionValue
model/table, CC must check the model and add an Alembic migration to add them as
nullable Date columns before proceeding.

---

## CHANGE 2 — Frontend: `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

### 2a. Update the DimensionValue type

Find the TypeScript interface/type for dimension values. Add the new fields:

```typescript
interface DimensionValue {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  valid_from?: string | null;  // DD/MM/YYYY
  valid_to?: string | null;    // DD/MM/YYYY
}
```

### 2b. Update the "+ Add value" inline form

Find the inline form that appears when `addValueDimId === dim.id` or similar.
It currently has: Code *, Name *, Description (optional).

Add three new fields below Description:

```tsx
{/* Valid From */}
<div className="col-span-1">
  <label className="text-xs font-medium text-gray-600 block mb-1">
    Valid From <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
  </label>
  <input
    type="text"
    value={addValueForm.valid_from ?? ""}
    onChange={e => setAddValueForm(prev => ({ ...prev, valid_from: e.target.value }))}
    placeholder="e.g. 01/01/2025"
    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>

{/* Valid To */}
<div className="col-span-1">
  <label className="text-xs font-medium text-gray-600 block mb-1">
    Valid To <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
  </label>
  <input
    type="text"
    value={addValueForm.valid_to ?? ""}
    onChange={e => setAddValueForm(prev => ({ ...prev, valid_to: e.target.value }))}
    placeholder="e.g. 31/12/2025"
    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>

{/* Is Active */}
<div className="col-span-1 flex items-center gap-2 pt-4">
  <input
    type="checkbox"
    id="add-value-is-active"
    checked={addValueForm.is_active ?? true}
    onChange={e => setAddValueForm(prev => ({ ...prev, is_active: e.target.checked }))}
    className="w-3.5 h-3.5 accent-blue-600"
  />
  <label htmlFor="add-value-is-active" className="text-xs font-medium text-gray-600">
    Active
  </label>
</div>
```

Update the add value form state to include these fields:
```typescript
// Wherever addValueForm state is defined, add:
valid_from: "",
valid_to: "",
is_active: true,
```

Update the handleAddValue (or equivalent) function to include these fields in the
POST request body:
```typescript
body: {
  code: addValueForm.code.trim(),
  name: addValueForm.name.trim(),
  description: addValueForm.description?.trim() || null,
  valid_from: addValueForm.valid_from?.trim() || null,
  valid_to: addValueForm.valid_to?.trim() || null,
  is_active: addValueForm.is_active ?? true,
}
```

After successful add, reset these new fields in the form reset:
```typescript
valid_from: "",
valid_to: "",
is_active: true,
```

### 2c. Add Edit action and Edit modal

#### Per-row Edit button

In the Actions column of the values table, add an "Edit" button before "Deactivate":

```tsx
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
```

#### Edit modal state

Add to component state:
```typescript
const [editValueModal, setEditValueModal] = useState<{
  id: string;
  code: string;
  name: string;
  description: string;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
} | null>(null);
const [editValueSaving, setEditValueSaving] = useState(false);
const [editValueError, setEditValueError] = useState<string | null>(null);
```

#### handleEditValueSave function

```typescript
const handleEditValueSave = async () => {
  if (!editValueModal || !accessToken || !selectedDimForValues) return;
  setEditValueSaving(true);
  setEditValueError(null);
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(
      `${BASE}/api/config/dimensions/${selectedDimForValues}/values/${editValueModal.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editValueModal.name,
          description: editValueModal.description || null,
          valid_from: editValueModal.valid_from || null,
          valid_to: editValueModal.valid_to || null,
          is_active: editValueModal.is_active,
        }),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail ?? "Save failed");
    }
    await loadDimValues(selectedDimForValues);
    setEditValueModal(null);
  } catch (err) {
    setEditValueError(err instanceof Error ? err.message : "Save failed.");
  } finally {
    setEditValueSaving(false);
  }
};
```

#### Edit modal JSX

Add this modal just before the existing confirmation modal JSX:

```tsx
{editValueModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div
      className="absolute inset-0 bg-black/40"
      onClick={() => !editValueSaving && setEditValueModal(null)}
    />
    <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">
        Edit value — <span className="font-mono text-gray-600">{editValueModal.code}</span>
      </h2>
      <p className="text-xs text-gray-400 mb-4">Code cannot be changed after creation.</p>

      <div className="space-y-3">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Name *</label>
          <input
            type="text"
            value={editValueModal.name}
            onChange={e => setEditValueModal(prev => prev ? { ...prev, name: e.target.value } : null)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={editValueModal.description}
            onChange={e => setEditValueModal(prev => prev ? { ...prev, description: e.target.value } : null)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Valid From / Valid To */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Valid From <span className="text-gray-400 font-normal">(dd/mm/yyyy)</span>
            </label>
            <input
              type="text"
              value={editValueModal.valid_from}
              onChange={e => setEditValueModal(prev => prev ? { ...prev, valid_from: e.target.value } : null)}
              placeholder="e.g. 01/01/2025"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Valid To <span className="text-gray-400 font-normal">(dd/mm/yyyy)</span>
            </label>
            <input
              type="text"
              value={editValueModal.valid_to}
              onChange={e => setEditValueModal(prev => prev ? { ...prev, valid_to: e.target.value } : null)}
              placeholder="e.g. 31/12/2025"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Is Active */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edit-value-is-active"
            checked={editValueModal.is_active}
            onChange={e => setEditValueModal(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
            className="w-3.5 h-3.5 accent-blue-600"
          />
          <label htmlFor="edit-value-is-active" className="text-xs font-medium text-gray-700">
            Active
          </label>
        </div>

        {editValueError && (
          <p className="text-xs text-red-600">{editValueError}</p>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-5">
        <button
          type="button"
          onClick={() => setEditValueModal(null)}
          disabled={editValueSaving}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleEditValueSave}
          disabled={editValueSaving || !editValueModal.name.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
        >
          {editValueSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  </div>
)}
```

### 2d. Show Valid From / Valid To in the values table (optional columns)

In the values table, add two columns between Name and Status:

```tsx
<th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Valid From</th>
<th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Valid To</th>
```

And in each row:
```tsx
<td className="px-3 py-2 text-gray-500 text-[11px]">{v.valid_from ?? "—"}</td>
<td className="px-3 py-2 text-gray-500 text-[11px]">{v.valid_to ?? "—"}</td>
```

---

## WATCH ITEMS
- Do NOT change `config.py` database name — must stay `ziva_dev`
- Do NOT rewrite CORS in `main.py` — must keep `http://localhost:3000`
- Do NOT make any unsolicited UI changes elsewhere
- Do NOT use browser `alert()` or `confirm()` — always use UI modals
- If `valid_from`/`valid_to` columns don't exist on `DimensionValue` model,
  create an Alembic migration before writing any backend logic

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `backend/app/models/` — only if adding `valid_from`/`valid_to` to DimensionValue model
3. `backend/alembic/versions/` — only if a new migration is needed for the above
4. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`feat: dimension values — edit modal with date fields, add form date fields, valid-from/to table columns`
