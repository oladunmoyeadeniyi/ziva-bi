# CC Brief — Debug CoA Upload: Print Row Values

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change any other logic

---

## TASK

In `backend/app/routers/config.py`, find the CoA upload UPDATE path.
Add this single print line immediately before the gl_sub_subgroup assignment:

```python
if s1get(gl_number_col) in ("400000", "400001"):
    print(f"ROW DEBUG: gl={s1get(gl_number_col)} sub={s1get(gl_sub_subgroup_col)} fsh={s1get(fs_head_col)} tbm={s1get(tb_mapping_col)}")
```

Do not change anything else.

---

## Allowed files:
1. `backend/app/routers/config.py`
