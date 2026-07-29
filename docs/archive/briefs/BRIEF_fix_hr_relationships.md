Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Fix: missing relationship() declarations break Employees + Cost Centers (500s)

**Problem (pre-existing, NOT currency-related):** `hr.py` uses `selectinload(Employee.cost_center)`, `selectinload(CostCenterConfig.head_employee)`, etc., but the `Employee` and `CostCenterConfig` models declare only FK columns (cost_center_id, line_manager_id, head_employee_id, head_user_id, cost_center_id) — no `relationship()` objects. `selectinload` needs relationship descriptors → AttributeError → 500. Add the missing relationships. Python-only, no migration.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/master_data.py` — the `Employee` model (~320) and `CostCenterConfig` model (~453): the exact FK columns present (cost_center_id → dimension_values.id, line_manager_id → employees.id; head_employee_id → employees.id, head_user_id → users.id, cost_center_id → dimension_values.id). Report the related target models: DimensionValue, Employee (self), User — confirm their class names + tablenames + PKs so the relationship() targets + foreign_keys are correct.
- `backend/app/routers/hr.py` — lines ~265–266 (employees selectinload) and ~738–740 (cost-centers selectinload): the EXACT relationship attribute names expected (cost_center, line_manager, head_employee, head_user, cost_center). The relationship() names you add MUST match what selectinload references.
- Check for any existing relationships on these models to avoid duplicates / back_populates conflicts.
- Note: line_manager is a SELF-referential FK on Employee (employees.id → employees.id) — needs remote_side. cost_center on both points to DimensionValue.
Report findings before editing.

---

## Fix (master_data.py only)
Add the missing `relationship()` declarations so the names match hr.py's selectinload calls. Use explicit `foreign_keys=` where ambiguous (especially Employee.line_manager self-ref and any model with multiple FKs to the same target).

**Employee:**
- `cost_center` → DimensionValue (via cost_center_id). 
- `line_manager` → Employee (self-referential via line_manager_id; use remote_side on the Employee PK).

**CostCenterConfig:**
- `cost_center` → DimensionValue (via cost_center_id).
- `head_employee` → Employee (via head_employee_id).
- `head_user` → User (via head_user_id).

Guidelines:
- These are read-only convenience relationships for eager-loading; `back_populates` is optional. If you add back_populates, add the matching side; otherwise use `viewonly=True` or simply omit back_populates (a one-directional relationship is fine). State your choice.
- Set `lazy="select"` (default) — selectinload overrides per-query anyway.
- Specify `foreign_keys=[...]` explicitly for every relationship to avoid ambiguity (Employee has two FKs to employees-ish/dimension; be explicit).
- Do NOT change the FK columns themselves or any table structure — no migration.

---

## Files CC may modify
- `backend/app/models/master_data.py` — add the 5 relationships (2 on Employee, 3 on CostCenterConfig).
- ONLY if strictly needed to resolve a back_populates: the related model — but prefer one-directional/viewonly to avoid touching others. State if you had to.

Do NOT: change FK columns, add a migration, touch hr.py logic (the selectinload calls are correct — they just need the relationships to exist), touch currency/GL/other code, `config.py`, CORS.

---

## House rules
- No migration (Python model-only fix).
- Relationship names EXACTLY match hr.py's selectinload references.
- Backend imports cleanly; uvicorn reloads without error.
- Explicit foreign_keys to avoid ambiguity; remote_side for the self-ref.

---

## Acceptance / test steps (state pass/fail each)
1. Backend imports without error (python -c import app.main or uvicorn reload clean).
2. GET /api/hr/employees?active_only=false → 200 (was 500); returns employees (empty list fine).
3. GET /api/hr/employees?search=x&limit=20 → 200.
4. GET /api/hr/cost-centers → 200 (was 500).
5. Employees + Cost Centers pages load without "Failed to fetch".
6. No migration created.

---

## Completion summary required
List every file changed. State: the exact relationships added (target model + foreign_keys + remote_side where used); whether back_populates/viewonly was used and why; confirm hr.py untouched; confirm no migration; confirm the 4 endpoints now return 200; confirm backend imports clean. Report acceptance pass/fail.
