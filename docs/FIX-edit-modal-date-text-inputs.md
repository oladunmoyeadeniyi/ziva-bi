# CC Brief — Restore Date Fields to Edit Value Modal (Plain Text Inputs)

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT use <input type="date"> — use <input type="text"> only
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## CONTEXT

Date fields were removed from the Edit value modal to fix a browser bug where
<input type="date"> auto-fires onChange with a placeholder value on render,
causing unwanted data to be sent to the backend.

They must now be restored using plain <input type="text"> inputs which do NOT
have this problem.

---

## CHANGE 1 — Add valid_from and valid_to back to editValueModal state type

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

Find the editValueModal state type. Add the two date fields back:

```typescript
const [editValueModal, setEditValueModal] = useState<{
  id: string;
  code: string;
  name: string;
  description: string;
  valid_from: string;  // DD/MM/YYYY or empty string
  valid_to: string;    // DD/MM/YYYY or empty string
  is_active: boolean;
} | null>(null);
```

---

## CHANGE 2 — Pass date fields when opening the modal

Find the Edit button onClick in renderValuesTable where setEditValueModal is called.
Add valid_from and valid_to — pre-populate from existing row data so the user
can see and edit the current values:

```typescript
setEditValueModal({
  id: v.id,
  code: v.code,
  name: v.name,
  description: v.description ?? "",
  valid_from: v.valid_from ?? "",   // pre-populate if exists
  valid_to: v.valid_to ?? "",       // pre-populate if exists
  is_active: v.is_active,
})
```

---

## CHANGE 3 — Add date fields back to the Edit modal JSX

Find the Edit modal JSX (the fixed inset-0 z-50 modal). After the Description
field and before the Is Active checkbox, add a 2-column grid with plain text inputs:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid From <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
    </label>
    <input
      type="text"
      value={editValueModal.valid_from}
      onChange={e => setEditValueModal(prev =>
        prev ? { ...prev, valid_from: e.target.value } : null
      )}
      placeholder="e.g. 01/01/2025"
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
  <div>
    <label className="text-xs font-medium text-gray-600 block mb-1">
      Valid To <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
    </label>
    <input
      type="text"
      value={editValueModal.valid_to}
      onChange={e => setEditValueModal(prev =>
        prev ? { ...prev, valid_to: e.target.value } : null
      )}
      placeholder="e.g. 31/12/2025"
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>
```

---

## CHANGE 4 — Include date fields in the PATCH payload conditionally

Find handleEditValueSave. Update patchBody to include dates only when non-empty:

```typescript
const patchBody: Record<string, unknown> = {
  name: editValueModal.name,
  description: editValueModal.description || null,
  is_active: editValueModal.is_active,
};
if (editValueModal.valid_from.trim()) {
  patchBody.valid_from = editValueModal.valid_from.trim();
}
if (editValueModal.valid_to.trim()) {
  patchBody.valid_to = editValueModal.valid_to.trim();
}
```

---

## WATCH ITEMS
- Do NOT use <input type="date"> anywhere — plain text only
- Do NOT touch the backend
- Do NOT change any other part of the page
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`feat: restore date fields to edit modal as plain text inputs`
