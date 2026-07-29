# CC Brief — Fix CoA Upload UPDATE: s1get never returns None

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change any other logic
3. List every file changed in your completion summary

---

## ROOT CAUSE

`s1get()` always returns a string — either the cell value or `""` (empty string).
It NEVER returns None. So this pattern is broken:

```python
_sub = s1get(gl_sub_subgroup_col)
gl_obj.gl_sub_subgroup = _sub if _sub is not None else gl_obj.gl_sub_subgroup
```

`_sub is not None` is always True, so gl_obj.gl_sub_subgroup is always set
to whatever s1get returns — including `""` when the column is empty.
This overwrites existing data with empty string.

---

## FIX

**File:** `backend/app/routers/config.py`

In the UPDATE path (around lines 2143–2157), replace ALL field assignments
with this consistent pattern — only overwrite if the new value is non-empty:

```python
gl_obj.gl_group = s1get(gl_group_col) or gl_obj.gl_group
gl_obj.gl_subgroup = s1get(gl_subgroup_col) or gl_obj.gl_subgroup
gl_obj.gl_sub_subgroup = s1get(gl_sub_subgroup_col) or gl_obj.gl_sub_subgroup
gl_obj.fs_head = s1get(fs_head_col) or gl_obj.fs_head
gl_obj.fs_note = s1get(fs_note_col) or gl_obj.fs_note
gl_obj.tb_mapping = s1get(tb_mapping_col) or gl_obj.tb_mapping
gl_obj.group_account_number = s1get(group_acct_num_col) or gl_obj.group_account_number
gl_obj.group_account_name = s1get(group_acct_name_col) or gl_obj.group_account_name
```

This means: if the uploaded file has a value → use it. If empty → keep existing DB value.

Also remove the intermediate `_sub`, `_fsh`, `_fsn`, `_tbm` variables that
were introduced by the previous fix attempt — they are no longer needed.

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`fix: coa upload UPDATE — use or-pattern not None-check since s1get never returns None`
