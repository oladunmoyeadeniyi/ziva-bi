# CC Brief — Debug CoA Upload Parser: Find Why Fields Not Saving

## CRITICAL INSTRUCTIONS
1. Do NOT change any logic yet — this is diagnosis only
2. Read the exact code and report back
3. List nothing as changed — no changes should be made

---

## TASK

In `backend/app/routers/config.py`, find the CoA upload endpoint
(`POST /api/config/coa/replace-all` or similar).

Read the full upload parser section and answer these exact questions:

1. What is the exact header string the parser looks for when finding the
   "GL Sub-subgroup" column? Show the exact col() lookup line.

2. What is the exact header string the parser looks for when finding the
   "FS Head" column? Show the exact col() lookup line.

3. What is the exact header string the parser looks for when finding the
   "TB Mapping" column? Show the exact col() lookup line.

4. When a GL account row is being saved (INSERT or UPDATE), show the exact
   lines where gl_sub_subgroup, fs_head, and tb_mapping are assigned to
   the model object.

5. Print the actual template headers from the uploaded file by adding
   this temporary debug line immediately after headers are parsed:
   print("CoA upload headers:", headers_lower)
   Then I will re-upload the file and paste what prints in the terminal.

Do not change any other logic.
