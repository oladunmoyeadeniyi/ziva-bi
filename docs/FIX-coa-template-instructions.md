# CC Brief — CoA Template: Update Instructions Sheet

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change any other template logic
3. List every file changed in your completion summary

---

## CONTEXT

The CoA template Instructions sheet needs updating to reflect:
1. Sheet 2 (Dimensions Setup) no longer exists in the CoA template
2. GL Number example should use 400000 not 733060
3. Locked rows description should be accurate

---

## CHANGE — Backend: update Instructions sheet content

**File:** `backend/app/routers/config.py`

Find the CoA template download endpoint where the Instructions sheet
(ws3) is built. Update the instruction_rows list as follows:

### 1. Update GL Number description
Change:
```python
["GL Number", "Yes", "Unique identifier for this GL account (e.g. 733060). Max 50 chars."],
```
To:
```python
["GL Number", "Yes", "Unique identifier for this GL account (e.g. 400000). Max 50 chars."],
```

### 2. Remove the Sheet 2 section entirely
Remove these rows from instruction_rows:
```python
["--- DIMENSIONS SETUP (Sheet 2) ---", "", ""],
["Dimension Name", "Yes", "Must exactly match one of your configured dimension names."],
["Value Code", "Yes", "Unique code for this dimension value..."],
["Value Name", "Yes", "Display name shown in dropdowns..."],
["Value Type", "No", "Free-text type tag..."],
["Valid From", "No", "Date from which this value is active..."],
["Valid To", "No", "Date until which this value is active..."],
["Is Active", "No", "Yes or No. Defaults to Yes."],
```

### 3. Update the NOTES section
Find and update these two notes:

Change the "Sheet 2 is processed first" note:
```python
["Sheet 2 is processed first", "", "Dimension values in Sheet 2 are imported before GL accounts..."],
```
Remove this row entirely.

Change the "Locked rows" note:
```python
["Locked rows", "", "Rows 1-3 (header, instructions, marker) are protected. Enter your data from row 4 onwards."],
```
Keep this as-is — it is already correct.

### 4. Update the "Duplicate GL numbers" note
Keep as-is — still accurate.

### 5. Update the "Required columns marked *" note  
Keep as-is — still accurate.

---

## Allowed files:
1. `backend/app/routers/config.py`

## Commit message:
`fix: coa template instructions — remove sheet 2 section, update gl number example`
