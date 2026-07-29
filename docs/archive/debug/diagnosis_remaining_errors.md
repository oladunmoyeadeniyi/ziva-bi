# Diagnosis — Remaining "Failed to fetch" Errors
**Date:** 2026-06-20  
**Pages:** Employees (`/dashboard/business/settings/employees`) and Cost Centers (`/dashboard/business/settings/cost-centers`)  
**Not related to the currency migration.**

---

## Routes each page calls

### Employees page

| Call | Route | HTTP Status |
|---|---|---|
| On load (employees list) | `GET /api/hr/employees?active_only=false` | **500** |
| On load (cost center dropdown) | `GET /api/config/dimensions` | 200 ✓ |
| On modal search | `GET /api/hr/employees?search={q}&limit=20` | **500** |
| Template download | `GET /api/hr/employees/template` | not tested |

`apiFetch` calls at `employees/page.tsx:139–140` (the two parallel on-load fetches).

### Cost-centers page

| Call | Route | HTTP Status |
|---|---|---|
| On load | `GET /api/hr/cost-centers` | **500** |
| Modal employee search | `GET /api/hr/employees?search={q}&limit=20` | **500** (same underlying bug) |

`fetch()` call at `cost-centers/page.tsx:48`.

---

## Exact errors

### `GET /api/hr/employees` — both variants

```
AttributeError: type object 'Employee' has no attribute 'cost_center'.
Did you mean: 'cost_center_id'?
```

**File:** `backend/app/routers/hr.py`, line **265**

```python
q = (
    select(Employee)
    .where(Employee.tenant_id == tenant_id)
    .options(
        selectinload(Employee.cost_center),    # ← line 265 — relationship doesn't exist
        selectinload(Employee.line_manager),   # ← line 266 — also missing
    )
    ...
)
```

### `GET /api/hr/cost-centers`

```
AttributeError: type object 'CostCenterConfig' has no attribute 'cost_center'.
Did you mean: 'cost_center_id'?
```

**File:** `backend/app/routers/hr.py`, line **738**

```python
result = await db.execute(
    select(CostCenterConfig)
    .where(CostCenterConfig.tenant_id == tenant_id)
    .options(
        selectinload(CostCenterConfig.cost_center),    # ← line 738 — missing
        selectinload(CostCenterConfig.head_employee),  # ← line 739 — missing
        selectinload(CostCenterConfig.head_user),      # ← line 740 — missing
    )
    ...
)
```

---

## Root cause

Both routers use SQLAlchemy `selectinload()` to eager-load relationships, but neither the `Employee` model nor the `CostCenterConfig` model declares any `relationship()` objects — only FK columns.

**`Employee` model** (`backend/app/models/master_data.py:320`):

```python
# What exists (FK columns only):
cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(
    UUID(as_uuid=True), ForeignKey("dimension_values.id", ...), nullable=True
)
line_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
    UUID(as_uuid=True), ForeignKey("employees.id", ...), nullable=True
)
# What is MISSING: relationship() declarations for cost_center and line_manager
```

**`CostCenterConfig` model** (`backend/app/models/master_data.py:453`):

```python
# What exists (FK columns only):
cost_center_id:    Mapped[uuid.UUID]           → ForeignKey("dimension_values.id")
head_employee_id:  Mapped[Optional[uuid.UUID]] → ForeignKey("employees.id")
head_user_id:      Mapped[Optional[uuid.UUID]] → ForeignKey("users.id")
# What is MISSING: relationship() declarations for cost_center, head_employee, head_user
```

The FK columns were defined but the corresponding `relationship()` attributes — which `selectinload()` requires — were never added. `selectinload(Model.attr)` needs `attr` to be a SQLAlchemy relationship descriptor, not a plain column.

This bug predates the currency consolidation work and is unaffected by migration `f2g3h4i5j6k7`.

---

## Summary

| Page | Route that fails | HTTP | Error type | Location |
|---|---|---|---|---|
| Employees | `GET /api/hr/employees?active_only=false` | 500 | `AttributeError: Employee has no attribute 'cost_center'` | `hr.py:265` |
| Employees | `GET /api/hr/employees?search=...` | 500 | same | `hr.py:265` |
| Cost Centers | `GET /api/hr/cost-centers` | 500 | `AttributeError: CostCenterConfig has no attribute 'cost_center'` | `hr.py:738` |

**Fix needed:** Add `relationship()` declarations to `Employee` (for `cost_center` → `DimensionValue`, `line_manager` → self) and `CostCenterConfig` (for `cost_center` → `DimensionValue`, `head_employee` → `Employee`, `head_user` → `User`) in `master_data.py`. No migration required — this is a Python-only model fix.
