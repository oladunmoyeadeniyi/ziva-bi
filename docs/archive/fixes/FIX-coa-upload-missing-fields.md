# CC Brief — CoA Upload: Fix Missing Fields + Add Group Account Columns

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any other upload logic
4. List every file changed in your completion summary

---

## CONTEXT

The CoA upload template has these columns (confirmed from file inspection):
GL Number* | GL Name* | Account Type* | Is Active | GL Group | GL Subgroup |
GL Sub-subgroup | FS Head | FS Note | TB Mapping | Account Classification |
Category | Subcategory | Is Default GL for Subcategory | [dimension columns...]

After upload, GL Sub-subgroup, FS Head, and TB Mapping are not populating
in the database even though the template has data for them.

Also, Group Account Number and Group Account Name are not in the template
and need to be added.

---

## CHANGE 1 — Backend: fix upload parser for missing fields

**File:** `backend/app/routers/config.py`

Find the CoA upload endpoint (`POST /api/config/coa/upload` or
`POST /api/config/coa/replace-all`). Find the section where it reads
column values from each row.

### 1a. Verify these column lookups exist and are correct

The parser must look up these headers (case-insensitive, asterisks stripped):

```python
gl_sub_subgroup_col = col("gl sub-subgroup") or col("gl sub subgroup")
fs_head_col = col("fs head")
fs_note_col = col("fs note")
tb_mapping_col = col("tb mapping")
group_account_number_col = col("group account number")
group_account_name_col = col("group account name")
```

If any of these lookups are missing, add them.

### 1b. Verify these values are saved to the database

When creating or updating a GL account record, confirm these fields are set:

```python
gl_account.gl_sub_subgroup = get(gl_sub_subgroup_col) or None
gl_account.fs_head = get(fs_head_col) or None
gl_account.fs_note = get(fs_note_col) or None
gl_account.tb_mapping = get(tb_mapping_col) or None
gl_account.group_account_number = get(group_account_number_col) or None
gl_account.group_account_name = get(group_account_name_col) or None
```

If any are missing from the save logic, add them.

### 1c. Check the GLAccount model

Verify that `gl_sub_subgroup`, `fs_head`, `fs_note`, `tb_mapping`,
`group_account_number`, and `group_account_name` columns exist on the
GLAccount model. If `group_account_number` or `group_account_name` are
missing, create an Alembic migration to add them as nullable String columns.

---

## CHANGE 2 — Backend: add Group Account columns to CoA template download

**File:** `backend/app/routers/config.py`

Find the CoA template download endpoint. In Sheet 1 (GL Accounts), add two
new columns after TB Mapping and before Account Classification:

- **Group Account Number** — optional, free text
- **Group Account Name** — optional, free text

Add them to the headers list, set appropriate column widths (width: 22 each),
add instruction row text:
- Group Account Number: "Optional — parent group GL number"
- Group Account Name: "Optional — parent group GL name"

---

## CHANGE 3 — Frontend: show GL Sub-subgroup, FS Head, TB Mapping in Edit GL modal

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

The Edit GL Account modal currently shows GL Sub-subgroup, FS Head, TB Mapping
fields but they may not be pre-populated from the API response.

Verify that the GL account API response includes these fields:
`gl_sub_subgroup`, `fs_head`, `fs_note`, `tb_mapping`,
`group_account_number`, `group_account_name`

If any are missing from the response, they need to be added to the backend
response schema (see Change 1c).

Also add Group Account Number and Group Account Name fields to the Edit GL
Account modal under the GL HIERARCHY section, after GL Sub-subgroup:

```tsx
{/* GROUP REPORTING */}
<div className="mt-4">
  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
    Group Reporting (Optional)
  </h4>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        Group Account Number
      </label>
      <input
        type="text"
        value={editForm.group_account_number ?? ""}
        onChange={e => setEditForm(prev => ({ ...prev, group_account_number: e.target.value }))}
        placeholder="Optional"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        Group Account Name
      </label>
      <input
        type="text"
        value={editForm.group_account_name ?? ""}
        onChange={e => setEditForm(prev => ({ ...prev, group_account_name: e.target.value }))}
        placeholder="Optional"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>
</div>
```

---

## WATCH ITEMS
- Do NOT change `config.py` database name — must stay `ziva_dev`
- Do NOT rewrite CORS in `main.py` — must keep `http://localhost:3000`
- Do NOT change any other upload logic
- If new DB columns are needed, create an Alembic migration

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `backend/app/models/` — only if adding new columns to GLAccount model
3. `backend/app/schemas/config.py` — only if adding fields to GL account response schema
4. `backend/alembic/versions/` — only if a new migration is needed
5. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`fix: coa upload — parse gl_sub_subgroup/fs_head/tb_mapping; add group account columns`
