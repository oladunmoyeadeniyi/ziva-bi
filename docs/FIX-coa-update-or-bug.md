# CC Brief — Fix CoA Upload UPDATE Path: or-based Assignment Bug

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change any other logic
3. List every file changed in your completion summary

---

## ROOT CAUSE

In the CoA upload UPDATE path, fields are assigned like:
```python
gl_obj.fs_head = s1get(fs_head_col) or gl_obj.fs_head
```

If s1get() returns an empty string "" (falsy), `or` falls through to the
old value. Since the DB was reset, old value is None, so "" or None = None.
Fields stay empty even though the template has data.

The same bug affects: gl_sub_subgroup, fs_head, fs_note, tb_mapping.

---

## FIX

**File:** `backend/app/routers/config.py`

In the CoA upload endpoint UPDATE path, replace the or-based assignments
for these four fields with explicit None checks:

```python
_sub = s1get(gl_sub_subgroup_col)
gl_obj.gl_sub_subgroup = _sub if _sub is not None else gl_obj.gl_sub_subgroup

_fsh = s1get(fs_head_col)
gl_obj.fs_head = _fsh if _fsh is not None else gl_obj.fs_head

_fsn = s1get(fs_note_col)
gl_obj.fs_note = _fsn if _fsn is not None else gl_obj.fs_note

_tbm = s1get(tb_mapping_col)
gl_obj.tb_mapping = _tbm if _tbm is not None else gl_obj.tb_mapping
```

Also remove the debug print line: `print("CoA upload headers:", s1h)`

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`fix: coa upload UPDATE path — replace or-based with explicit None check for sub-subgroup/fs/tb fields`
