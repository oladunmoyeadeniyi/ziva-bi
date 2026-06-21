# CC Brief — Fix Date Parsing: Backend Flexible Format + Frontend Clear Pre-population

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change anything else
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## PROBLEM

The Edit value modal is failing with "invalid character in year" because:
1. Dates stored in the DB may be in various formats (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
2. The backend only accepts DD/MM/YYYY and rejects everything else
3. Pre-populating the modal with existing date values causes format mismatch errors

---

## CHANGE 1 — Backend: flexible date parser

**File:** `backend/app/routers/config.py`

Find the PATCH endpoint for dimension values:
`PATCH /dimensions/{dimension_id}/values/{value_id}`

Replace the current date parsing logic for `valid_from` and `valid_to` with this
flexible parser that accepts multiple formats:

```python
from datetime import datetime as _dt

def parse_date(raw: str):
    if not raw or not raw.strip():
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return _dt.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    raise HTTPException(
        status_code=400,
        detail=f"Invalid date format: '{raw}'. Use DD/MM/YYYY."
    )
```

Apply `parse_date()` to both `valid_from` and `valid_to` in the payload handling.

Always return dates as DD/MM/YYYY strings in the response:
```python
"valid_from": val.valid_from.strftime("%d/%m/%Y") if val.valid_from else None,
"valid_to": val.valid_to.strftime("%d/%m/%Y") if val.valid_to else None,
```

---

## CHANGE 2 — Frontend: do not pre-populate date fields in Edit modal

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

Find where `setEditValueModal` is called when the Edit button is clicked.
Change `valid_from` and `valid_to` to always open as empty strings:

```typescript
setEditValueModal({
  id: v.id,
  code: v.code,
  name: v.name,
  description: v.description ?? "",
  valid_from: "",   // always blank — user sets if they want to change
  valid_to: "",     // always blank — user sets if they want to change
  is_active: v.is_active,
})
```

This avoids format mismatch from existing data. If the user leaves dates blank,
the backend skips updating them (no change to existing DB values).

Also update the backend PATCH handler to skip updating a date field if the value
is null/empty (do not overwrite existing date with null unless explicitly cleared):

```python
if "valid_from" in payload and payload["valid_from"] is not None and payload["valid_from"] != "":
    val.valid_from = parse_date(payload["valid_from"])
if "valid_to" in payload and payload["valid_to"] is not None and payload["valid_to"] != "":
    val.valid_to = parse_date(payload["valid_to"])
```

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`fix: dimension date parsing — flexible format backend, clear pre-population in edit modal`
