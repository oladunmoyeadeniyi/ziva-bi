"""
ZivaBI — CoA / Dimensions promotion engine (Phase 3a).

Implements repeatable test→live promotion for:
    TenantDimension          (natural key: dimension.code)
    ChartOfAccount           (natural key: gl_number)
    DimensionValue           (natural key: dimension.code + value.code)
    GLDimensionRequirement   (natural key: gl_number + dimension.code, FK-only)
    TenantAccountMapping     (natural key: role_key)

Two-step flow:
    compute_promotion_diff  — read-only; returns a PromotionDiff + an in-memory id-map
                              used internally for dependent entities.
    apply_promotion         — recomputes the diff fresh (never trusts client data),
                              filters to accepted_item_ids, applies in dependency order,
                              then returns a PromotionApplyResult.

Dependency order (enforced in both steps):
    1. TenantDimension         (no upstream deps)
    2. ChartOfAccount          (no upstream deps)
    3. DimensionValue          (needs dim id-map; two-pass for cascade_value_id)
    4. GLDimensionRequirement  (needs dim + coa id-maps)
    5. TenantAccountMapping    (needs coa id-map)

All-or-nothing: runs inside the caller's DB transaction (the router's get_db
dependency commits on success, rolls back on any exception).

Matching strategy: natural keys, in-memory id-map per call — no persistent UUID
mapping table (confirmed reliable via docs/diagnosis_promotion_schema.md).
"""

import uuid
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_mapping import TenantAccountMapping
from app.models.master_data import (
    ChartOfAccount,
    DimensionValue,
    GLDimensionRequirement,
    TenantDimension,
)
from app.schemas.platform import (
    PromotionApplyRequest,
    PromotionApplyResult,
    PromotionDiff,
    PromotionDiffItem,
)

UUID = uuid.UUID


# ── Internal data structures ──────────────────────────────────────────────────

@dataclass
class _IdMap:
    """
    In-memory test→live UUID mapping accumulated during one promotion call.

    For EXISTING live rows (UPDATE/UNCHANGED): test_id → live_id.
    For new test rows (CREATE before apply): test_id → None (no live id yet).
    During apply, None entries are replaced with the newly generated live UUIDs
    as rows are created, making the map usable for downstream entities in the
    same apply call.
    """
    dim:    dict[UUID, Optional[UUID]] = field(default_factory=dict)
    coa:    dict[UUID, Optional[UUID]] = field(default_factory=dict)
    dimval: dict[UUID, Optional[UUID]] = field(default_factory=dict)


# ── Field lists ───────────────────────────────────────────────────────────────

_COA_FIELDS = [
    "gl_name", "account_type", "gl_group", "gl_subgroup", "gl_sub_subgroup",
    "fs_head", "fs_note", "tb_mapping", "group_account_number", "group_account_name",
    "account_classification", "is_foreign_currency", "foreign_currency_code",
    "revalue_at_period_end", "locked_by_implementation",
]

_DIM_FIELDS = [
    "name", "is_required", "sort_order", "accepted_value_types",
    "locked_by_implementation", "value_source", "dimension_sources",
    "display_name", "description", "icon",
]

_DIMVAL_FIELDS = [
    # cascade_dimension_id / cascade_value_id handled separately (UUID remapping)
    "name", "sort_order", "value_type", "valid_from", "valid_to",
]

_REQ_FIELDS = ["requirement"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _v(val: Any) -> Any:
    """Serialise a field value to a JSON-safe representation for diff display."""
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, UUID):
        return str(val)
    return val


def _fields_dict(obj: Any, fields: list[str]) -> dict:
    """Extract a subset of an ORM object's fields as a serialisable dict."""
    return {f: _v(getattr(obj, f, None)) for f in fields}


def _fields_differ(a: Any, b: Any, fields: list[str]) -> tuple[bool, list[str]]:
    """Return (differs, changed_field_names) comparing two ORM objects on given fields."""
    changed = [f for f in fields if getattr(a, f, None) != getattr(b, f, None)]
    return bool(changed), changed


# ── Per-entity diff helpers ───────────────────────────────────────────────────

async def _diff_dimensions(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    id_map: _IdMap,
) -> list[PromotionDiffItem]:
    """Compute diff for TenantDimension rows."""
    test_rows = (await db.execute(
        select(TenantDimension)
        .where(TenantDimension.tenant_id == test_id, TenantDimension.is_active.is_(True))
    )).scalars().all()

    live_rows = (await db.execute(
        select(TenantDimension).where(TenantDimension.tenant_id == live_id)
    )).scalars().all()

    live_by_code: dict[str, TenantDimension] = {r.code: r for r in live_rows}
    test_codes = {r.code for r in test_rows}
    items: list[PromotionDiffItem] = []

    for t in test_rows:
        item_id = f"dim:{t.code}"
        live = live_by_code.get(t.code)
        if live is None:
            id_map.dim[t.id] = None
            items.append(PromotionDiffItem(
                item_id=item_id, entity="dimension", action="create",
                natural_key=t.code, label=t.display_name or t.name,
                before={}, after=_fields_dict(t, _DIM_FIELDS), changed_fields=[],
            ))
        else:
            id_map.dim[t.id] = live.id
            differs, changed = _fields_differ(t, live, _DIM_FIELDS)
            if differs:
                items.append(PromotionDiffItem(
                    item_id=item_id, entity="dimension", action="update",
                    natural_key=t.code, label=t.display_name or t.name,
                    before=_fields_dict(live, _DIM_FIELDS),
                    after=_fields_dict(t, _DIM_FIELDS), changed_fields=changed,
                ))
            else:
                id_map.dim[t.id] = live.id  # unchanged — still register in map

    # DEACTIVATE: live active rows whose code no longer exists as active in test
    for live in live_rows:
        if live.is_active and live.code not in test_codes:
            items.append(PromotionDiffItem(
                item_id=f"dim:{live.code}", entity="dimension", action="deactivate",
                natural_key=live.code, label=live.display_name or live.name,
                before=_fields_dict(live, _DIM_FIELDS), after={}, changed_fields=[],
            ))

    return items


async def _diff_coa(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    id_map: _IdMap,
) -> list[PromotionDiffItem]:
    """Compute diff for ChartOfAccount rows."""
    test_rows = (await db.execute(
        select(ChartOfAccount)
        .where(ChartOfAccount.tenant_id == test_id, ChartOfAccount.is_active.is_(True))
    )).scalars().all()

    live_rows = (await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.tenant_id == live_id)
    )).scalars().all()

    live_by_num: dict[str, ChartOfAccount] = {r.gl_number: r for r in live_rows}
    test_nums = {r.gl_number for r in test_rows}
    items: list[PromotionDiffItem] = []

    for t in test_rows:
        item_id = f"coa:{t.gl_number}"
        live = live_by_num.get(t.gl_number)
        if live is None:
            id_map.coa[t.id] = None
            items.append(PromotionDiffItem(
                item_id=item_id, entity="coa", action="create",
                natural_key=t.gl_number,
                label=f"{t.gl_number} — {t.gl_name}",
                before={}, after={"gl_number": t.gl_number, **_fields_dict(t, _COA_FIELDS)},
                changed_fields=[],
            ))
        else:
            id_map.coa[t.id] = live.id
            differs, changed = _fields_differ(t, live, _COA_FIELDS)
            if differs:
                items.append(PromotionDiffItem(
                    item_id=item_id, entity="coa", action="update",
                    natural_key=t.gl_number,
                    label=f"{t.gl_number} — {t.gl_name}",
                    before={"gl_number": live.gl_number, **_fields_dict(live, _COA_FIELDS)},
                    after={"gl_number": t.gl_number, **_fields_dict(t, _COA_FIELDS)},
                    changed_fields=changed,
                ))

    for live in live_rows:
        if live.is_active and live.gl_number not in test_nums:
            items.append(PromotionDiffItem(
                item_id=f"coa:{live.gl_number}", entity="coa", action="deactivate",
                natural_key=live.gl_number,
                label=f"{live.gl_number} — {live.gl_name}",
                before={"gl_number": live.gl_number, **_fields_dict(live, _COA_FIELDS)},
                after={}, changed_fields=[],
            ))

    return items


async def _diff_dimension_values(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    id_map: _IdMap,
) -> list[PromotionDiffItem]:
    """
    Compute diff for DimensionValue rows.

    Requires id_map.dim to already be populated (dimensions processed first).
    cascade_value_id is represented as a natural-key string in before/after
    (e.g. "cost_center:NG_FI") to be human-readable.
    """
    # Load test dim values with their dimension codes
    test_dims = (await db.execute(
        select(TenantDimension).where(TenantDimension.tenant_id == test_id)
    )).scalars().all()
    test_dim_by_id: dict[UUID, TenantDimension] = {d.id: d for d in test_dims}

    live_dims = (await db.execute(
        select(TenantDimension).where(TenantDimension.tenant_id == live_id)
    )).scalars().all()
    live_dim_by_id: dict[UUID, TenantDimension] = {d.id: d for d in live_dims}
    live_dim_by_code: dict[str, TenantDimension] = {d.code: d for d in live_dims}

    test_vals = (await db.execute(
        select(DimensionValue)
        .where(DimensionValue.tenant_id == test_id, DimensionValue.is_active.is_(True))
    )).scalars().all()
    # Also need inactive test values to resolve cascade_value_id references
    test_vals_all = (await db.execute(
        select(DimensionValue).where(DimensionValue.tenant_id == test_id)
    )).scalars().all()
    test_val_by_id: dict[UUID, DimensionValue] = {v.id: v for v in test_vals_all}

    live_vals = (await db.execute(
        select(DimensionValue).where(DimensionValue.tenant_id == live_id)
    )).scalars().all()
    # Key: (live_dim_id, val_code)
    live_val_by_key: dict[tuple[UUID, str], DimensionValue] = {
        (v.dimension_id, v.code): v for v in live_vals
    }
    live_val_by_id: dict[UUID, DimensionValue] = {v.id: v for v in live_vals}

    # Track which (dim_code, val_code) pairs are active in test
    test_val_natural_keys: set[tuple[str, str]] = set()
    for v in test_vals:
        dim = test_dim_by_id.get(v.dimension_id)
        if dim:
            test_val_natural_keys.add((dim.code, v.code))

    def _cascade_val_key(val: DimensionValue) -> Optional[str]:
        """Represent cascade_value_id as 'dim_code:val_code' or None."""
        if val.cascade_value_id is None:
            return None
        ref = test_val_by_id.get(val.cascade_value_id) or live_val_by_id.get(val.cascade_value_id)
        if ref is None:
            return None
        ref_dim_id = ref.dimension_id
        ref_dim = test_dim_by_id.get(ref_dim_id) or live_dim_by_id.get(ref_dim_id)
        if ref_dim is None:
            return None
        return f"{ref_dim.code}:{ref.code}"

    def _val_fields_dict(v: DimensionValue) -> dict:
        d = _fields_dict(v, _DIMVAL_FIELDS)
        # Represent cascade FKs as natural keys
        if v.cascade_dimension_id:
            cd = test_dim_by_id.get(v.cascade_dimension_id) or live_dim_by_id.get(v.cascade_dimension_id)
            d["cascade_dimension"] = cd.code if cd else str(v.cascade_dimension_id)
        else:
            d["cascade_dimension"] = None
        d["cascade_value"] = _cascade_val_key(v)
        return d

    items: list[PromotionDiffItem] = []

    for t in test_vals:
        dim = test_dim_by_id.get(t.dimension_id)
        if dim is None:
            continue
        live_dim = live_dim_by_code.get(dim.code)
        if live_dim is None:
            # Dimension hasn't been promoted yet — dimval is also a CREATE
            live_dim_id_for_lookup = None
        else:
            live_dim_id_for_lookup = live_dim.id

        item_id = f"dimval:{dim.code}:{t.code}"
        natural_key = f"{dim.code}:{t.code}"
        label = f"{dim.code}:{t.code} — {t.name}"

        live = live_val_by_key.get((live_dim_id_for_lookup, t.code)) if live_dim_id_for_lookup else None

        if live is None:
            id_map.dimval[t.id] = None
            items.append(PromotionDiffItem(
                item_id=item_id, entity="dimension_value", action="create",
                natural_key=natural_key, label=label,
                before={}, after=_val_fields_dict(t), changed_fields=[],
            ))
        else:
            id_map.dimval[t.id] = live.id
            diff_fields = _DIMVAL_FIELDS + ["cascade_dimension", "cascade_value"]
            test_d = _val_fields_dict(t)
            live_d = _val_fields_dict(live)
            changed = [f for f in diff_fields if test_d.get(f) != live_d.get(f)]
            if changed:
                items.append(PromotionDiffItem(
                    item_id=item_id, entity="dimension_value", action="update",
                    natural_key=natural_key, label=label,
                    before=live_d, after=test_d, changed_fields=changed,
                ))

    # DEACTIVATE
    for live in live_vals:
        if not live.is_active:
            continue
        live_dim = live_dim_by_id.get(live.dimension_id)
        if live_dim and (live_dim.code, live.code) not in test_val_natural_keys:
            items.append(PromotionDiffItem(
                item_id=f"dimval:{live_dim.code}:{live.code}",
                entity="dimension_value", action="deactivate",
                natural_key=f"{live_dim.code}:{live.code}",
                label=f"{live_dim.code}:{live.code} — {live.name}",
                before=_val_fields_dict(live), after={}, changed_fields=[],
            ))

    return items


async def _diff_gl_requirements(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    id_map: _IdMap,
) -> list[PromotionDiffItem]:
    """
    Compute diff for GLDimensionRequirement rows.

    Requires id_map.coa and id_map.dim to be populated.
    Natural key: (gl_number, dim_code).
    """
    test_reqs = (await db.execute(
        select(GLDimensionRequirement, ChartOfAccount, TenantDimension)
        .join(ChartOfAccount, GLDimensionRequirement.gl_id == ChartOfAccount.id)
        .join(TenantDimension, GLDimensionRequirement.dimension_id == TenantDimension.id)
        .where(GLDimensionRequirement.tenant_id == test_id)
    )).all()

    live_reqs = (await db.execute(
        select(GLDimensionRequirement, ChartOfAccount, TenantDimension)
        .join(ChartOfAccount, GLDimensionRequirement.gl_id == ChartOfAccount.id)
        .join(TenantDimension, GLDimensionRequirement.dimension_id == TenantDimension.id)
        .where(GLDimensionRequirement.tenant_id == live_id)
    )).all()

    # Key: (gl_number, dim_code) → (req_row, gl, dim)
    live_by_key: dict[tuple[str, str], tuple[GLDimensionRequirement, ChartOfAccount, TenantDimension]] = {
        (gl.gl_number, dim.code): (req, gl, dim)
        for req, gl, dim in live_reqs
    }
    test_keys: set[tuple[str, str]] = {(gl.gl_number, dim.code) for _, gl, dim in test_reqs}

    items: list[PromotionDiffItem] = []

    for t_req, t_gl, t_dim in test_reqs:
        nk = f"{t_gl.gl_number}:{t_dim.code}"
        item_id = f"glreq:{t_gl.gl_number}:{t_dim.code}"
        label = f"GL {t_gl.gl_number} / dim {t_dim.code}"
        live_entry = live_by_key.get((t_gl.gl_number, t_dim.code))
        if live_entry is None:
            items.append(PromotionDiffItem(
                item_id=item_id, entity="gl_requirement", action="create",
                natural_key=nk, label=label,
                before={}, after={"requirement": t_req.requirement}, changed_fields=[],
            ))
        else:
            l_req, _, _ = live_entry
            if t_req.requirement != l_req.requirement:
                items.append(PromotionDiffItem(
                    item_id=item_id, entity="gl_requirement", action="update",
                    natural_key=nk, label=label,
                    before={"requirement": l_req.requirement},
                    after={"requirement": t_req.requirement},
                    changed_fields=["requirement"],
                ))

    # DEACTIVATE for GLDimRequirements means DELETE (they have no is_active flag).
    # For now, we skip "removed" requirements — removing a requirement from test
    # means it was intentionally removed. Promote won't delete live requirements
    # (too risky; consultant should manually remove if needed).

    return items


async def _diff_account_mappings(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    id_map: _IdMap,
) -> list[PromotionDiffItem]:
    """
    Compute diff for TenantAccountMapping rows.

    Match on role_key; resolve gl_account_id via CoA natural key (gl_number).
    """
    test_maps = (await db.execute(
        select(TenantAccountMapping, ChartOfAccount)
        .join(ChartOfAccount, TenantAccountMapping.gl_account_id == ChartOfAccount.id)
        .where(TenantAccountMapping.tenant_id == test_id)
    )).all()

    live_maps = (await db.execute(
        select(TenantAccountMapping, ChartOfAccount)
        .join(ChartOfAccount, TenantAccountMapping.gl_account_id == ChartOfAccount.id)
        .where(TenantAccountMapping.tenant_id == live_id)
    )).all()

    live_by_role: dict[str, tuple[TenantAccountMapping, ChartOfAccount]] = {
        m.role_key: (m, gl) for m, gl in live_maps
    }
    items: list[PromotionDiffItem] = []

    for t_map, t_gl in test_maps:
        item_id = f"accmap:{t_map.role_key}"
        label = f"{t_map.role_key} → {t_gl.gl_number} {t_gl.gl_name}"
        live_entry = live_by_role.get(t_map.role_key)
        if live_entry is None:
            items.append(PromotionDiffItem(
                item_id=item_id, entity="account_mapping", action="create",
                natural_key=t_map.role_key, label=label,
                before={},
                after={"role_key": t_map.role_key, "gl_number": t_gl.gl_number, "gl_name": t_gl.gl_name},
                changed_fields=[],
            ))
        else:
            l_map, l_gl = live_entry
            if t_gl.gl_number != l_gl.gl_number:
                items.append(PromotionDiffItem(
                    item_id=item_id, entity="account_mapping", action="update",
                    natural_key=t_map.role_key, label=label,
                    before={"role_key": l_map.role_key, "gl_number": l_gl.gl_number, "gl_name": l_gl.gl_name},
                    after={"role_key": t_map.role_key, "gl_number": t_gl.gl_number, "gl_name": t_gl.gl_name},
                    changed_fields=["gl_number"],
                ))

    return items


# ── Public: compute diff (read-only) ──────────────────────────────────────────

async def compute_promotion_diff(
    db: AsyncSession,
    test_tenant_id: UUID,
    live_tenant_id: UUID,
) -> tuple[PromotionDiff, _IdMap]:
    """
    Read-only diff of all promotable entities between test and live tenants.

    Returns (PromotionDiff, id_map) where id_map holds test→live UUID mappings
    for existing rows. CREATE cases have test_id→None (live id not yet assigned).

    The id_map is consumed internally by apply_promotion; callers that only need
    the diff for display can ignore it.
    """
    id_map = _IdMap()

    dims   = await _diff_dimensions(db, test_tenant_id, live_tenant_id, id_map)
    coa    = await _diff_coa(db, test_tenant_id, live_tenant_id, id_map)
    dvals  = await _diff_dimension_values(db, test_tenant_id, live_tenant_id, id_map)
    reqs   = await _diff_gl_requirements(db, test_tenant_id, live_tenant_id, id_map)
    maps   = await _diff_account_mappings(db, test_tenant_id, live_tenant_id, id_map)

    total = sum(len(x) for x in [dims, coa, dvals, reqs, maps])
    return (
        PromotionDiff(
            dimensions=dims, coa=coa, dimension_values=dvals,
            gl_requirements=reqs, account_mappings=maps,
            total_changes=total,
        ),
        id_map,
    )


# ── Apply helpers ─────────────────────────────────────────────────────────────

async def _apply_dimensions(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    accepted: set[str],
    id_map: _IdMap,
    counts: dict,
) -> None:
    """Apply accepted dimension changes, updating id_map with new live UUIDs."""
    test_rows = (await db.execute(
        select(TenantDimension).where(TenantDimension.tenant_id == test_id)
    )).scalars().all()
    live_rows = (await db.execute(
        select(TenantDimension).where(TenantDimension.tenant_id == live_id)
    )).scalars().all()

    live_by_code: dict[str, TenantDimension] = {r.code: r for r in live_rows}
    test_by_code: dict[str, TenantDimension] = {r.code: r for r in test_rows if r.is_active}
    live_active_codes = {r.code for r in live_rows if r.is_active}

    for t in test_rows:
        if not t.is_active:
            continue
        item_id = f"dim:{t.code}"
        if item_id not in accepted:
            # Not accepted — still register existing mapping in id_map
            live = live_by_code.get(t.code)
            if live:
                id_map.dim[t.id] = live.id
            continue

        live = live_by_code.get(t.code)
        if live is None:
            new_row = TenantDimension(tenant_id=live_id)
            for f in _DIM_FIELDS:
                setattr(new_row, f, getattr(t, f))
            new_row.code = t.code
            db.add(new_row)
            await db.flush()
            id_map.dim[t.id] = new_row.id
            counts["dimension"]["created"] += 1
        else:
            id_map.dim[t.id] = live.id
            for f in _DIM_FIELDS:
                setattr(live, f, getattr(t, f))
            counts["dimension"]["updated"] += 1

    # Deactivations
    for live in live_rows:
        if not live.is_active:
            continue
        item_id = f"dim:{live.code}"
        if item_id in accepted and live.code not in test_by_code:
            live.is_active = False
            counts["dimension"]["deactivated"] += 1

    # Register non-accepted existing dims in id_map (needed by dependent entities)
    for t in test_rows:
        if t.id not in id_map.dim:
            live = live_by_code.get(t.code)
            if live:
                id_map.dim[t.id] = live.id


async def _apply_coa(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    accepted: set[str],
    id_map: _IdMap,
    counts: dict,
) -> None:
    """Apply accepted CoA changes, updating id_map.coa with new live UUIDs."""
    test_rows = (await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.tenant_id == test_id)
    )).scalars().all()
    live_rows = (await db.execute(
        select(ChartOfAccount).where(ChartOfAccount.tenant_id == live_id)
    )).scalars().all()

    live_by_num: dict[str, ChartOfAccount] = {r.gl_number: r for r in live_rows}
    test_active_nums = {r.gl_number for r in test_rows if r.is_active}

    for t in test_rows:
        if not t.is_active:
            continue
        item_id = f"coa:{t.gl_number}"
        live = live_by_num.get(t.gl_number)
        if item_id not in accepted:
            if live:
                id_map.coa[t.id] = live.id
            continue

        if live is None:
            new_row = ChartOfAccount(tenant_id=live_id, gl_number=t.gl_number)
            for f in _COA_FIELDS:
                setattr(new_row, f, getattr(t, f))
            new_row.is_active = True
            db.add(new_row)
            await db.flush()
            id_map.coa[t.id] = new_row.id
            counts["coa"]["created"] += 1
        else:
            id_map.coa[t.id] = live.id
            for f in _COA_FIELDS:
                setattr(live, f, getattr(t, f))
            counts["coa"]["updated"] += 1

    for live in live_rows:
        if not live.is_active:
            continue
        item_id = f"coa:{live.gl_number}"
        if item_id in accepted and live.gl_number not in test_active_nums:
            live.is_active = False
            counts["coa"]["deactivated"] += 1

    # Register non-accepted existing CoA in id_map
    for t in test_rows:
        if t.id not in id_map.coa:
            live = live_by_num.get(t.gl_number)
            if live:
                id_map.coa[t.id] = live.id


async def _apply_dimension_values(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    accepted: set[str],
    id_map: _IdMap,
    counts: dict,
) -> None:
    """
    Apply accepted DimensionValue changes.

    Two-pass:
      Pass 1 — insert/update all accepted rows with cascade_value_id=None (avoids FK
               ordering issues since the referenced value may not exist yet).
      Pass 2 — once all values are created and dimval id_map is complete, back-fill
               cascade_value_id on rows that have it.
    """
    test_dims = (await db.execute(
        select(TenantDimension).where(TenantDimension.tenant_id == test_id)
    )).scalars().all()
    test_dim_by_id: dict[UUID, TenantDimension] = {d.id: d for d in test_dims}

    live_dims = (await db.execute(
        select(TenantDimension).where(TenantDimension.tenant_id == live_id)
    )).scalars().all()
    live_dim_by_code: dict[str, TenantDimension] = {d.code: d for d in live_dims}
    live_dim_by_id: dict[UUID, TenantDimension] = {d.id: d for d in live_dims}

    test_vals = (await db.execute(
        select(DimensionValue).where(DimensionValue.tenant_id == test_id)
    )).scalars().all()
    test_val_all_by_id: dict[UUID, DimensionValue] = {v.id: v for v in test_vals}

    live_vals = (await db.execute(
        select(DimensionValue).where(DimensionValue.tenant_id == live_id)
    )).scalars().all()
    live_val_by_key: dict[tuple[UUID, str], DimensionValue] = {
        (v.dimension_id, v.code): v for v in live_vals
    }
    live_val_by_id: dict[UUID, DimensionValue] = {v.id: v for v in live_vals}

    test_active_keys: set[tuple[str, str]] = set()

    # ── Pass 1: insert/update without cascade_value_id ────────────────────────
    # rows_needing_cascade: list of (new_live_row, test_val)
    rows_needing_cascade: list[tuple[DimensionValue, DimensionValue]] = []

    for t in test_vals:
        if not t.is_active:
            continue
        dim = test_dim_by_id.get(t.dimension_id)
        if dim is None:
            continue
        test_active_keys.add((dim.code, t.code))

        live_dim = live_dim_by_code.get(dim.code)
        item_id = f"dimval:{dim.code}:{t.code}"

        # Resolve live dimension id (may have been just created → in id_map)
        live_dim_id = id_map.dim.get(t.dimension_id) or (live_dim.id if live_dim else None)
        if live_dim_id is None:
            # Dimension doesn't exist in live and wasn't promoted in this call
            if item_id in accepted:
                # Skip — can't create without parent dimension
                counts["dimension_value"]["skipped"] = counts["dimension_value"].get("skipped", 0) + 1
            continue

        live = live_val_by_key.get((live_dim_id, t.code))

        if item_id not in accepted:
            if live:
                id_map.dimval[t.id] = live.id
            continue

        if live is None:
            new_row = DimensionValue(
                tenant_id=live_id,
                dimension_id=live_dim_id,
                code=t.code,
                cascade_value_id=None,  # set in pass 2
                cascade_dimension_id=id_map.dim.get(t.cascade_dimension_id) if t.cascade_dimension_id else None,
            )
            for f in _DIMVAL_FIELDS:
                setattr(new_row, f, getattr(t, f))
            new_row.is_active = True
            db.add(new_row)
            await db.flush()
            id_map.dimval[t.id] = new_row.id
            if t.cascade_value_id:
                rows_needing_cascade.append((new_row, t))
            counts["dimension_value"]["created"] += 1
        else:
            id_map.dimval[t.id] = live.id
            for f in _DIMVAL_FIELDS:
                setattr(live, f, getattr(t, f))
            live.cascade_dimension_id = id_map.dim.get(t.cascade_dimension_id) if t.cascade_dimension_id else None
            # cascade_value_id set in pass 2
            if t.cascade_value_id:
                rows_needing_cascade.append((live, t))
            counts["dimension_value"]["updated"] += 1

    # Deactivations
    for live_v in live_vals:
        if not live_v.is_active:
            continue
        live_vd = live_dim_by_id.get(live_v.dimension_id)
        if live_vd and (live_vd.code, live_v.code) not in test_active_keys:
            item_id = f"dimval:{live_vd.code}:{live_v.code}"
            if item_id in accepted:
                live_v.is_active = False
                counts["dimension_value"]["deactivated"] += 1

    # Register non-accepted existing vals in id_map
    for t in test_vals:
        if t.id not in id_map.dimval:
            dim = test_dim_by_id.get(t.dimension_id)
            if dim is None:
                continue
            live_dim = live_dim_by_code.get(dim.code)
            if live_dim is None:
                continue
            live_v = live_val_by_key.get((live_dim.id, t.code))
            if live_v:
                id_map.dimval[t.id] = live_v.id

    # ── Pass 2: back-fill cascade_value_id ────────────────────────────────────
    for live_row, test_val in rows_needing_cascade:
        if test_val.cascade_value_id:
            live_cascade_id = id_map.dimval.get(test_val.cascade_value_id)
            if live_cascade_id:
                live_row.cascade_value_id = live_cascade_id


async def _apply_gl_requirements(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    accepted: set[str],
    id_map: _IdMap,
    counts: dict,
) -> None:
    """Apply accepted GLDimensionRequirement changes."""
    test_reqs = (await db.execute(
        select(GLDimensionRequirement, ChartOfAccount, TenantDimension)
        .join(ChartOfAccount, GLDimensionRequirement.gl_id == ChartOfAccount.id)
        .join(TenantDimension, GLDimensionRequirement.dimension_id == TenantDimension.id)
        .where(GLDimensionRequirement.tenant_id == test_id)
    )).all()

    live_reqs = (await db.execute(
        select(GLDimensionRequirement, ChartOfAccount, TenantDimension)
        .join(ChartOfAccount, GLDimensionRequirement.gl_id == ChartOfAccount.id)
        .join(TenantDimension, GLDimensionRequirement.dimension_id == TenantDimension.id)
        .where(GLDimensionRequirement.tenant_id == live_id)
    )).all()

    live_by_key: dict[tuple[str, str], GLDimensionRequirement] = {
        (gl.gl_number, dim.code): req for req, gl, dim in live_reqs
    }

    for t_req, t_gl, t_dim in test_reqs:
        item_id = f"glreq:{t_gl.gl_number}:{t_dim.code}"
        if item_id not in accepted:
            continue

        live_gl_id   = id_map.coa.get(t_gl.id)
        live_dim_id  = id_map.dim.get(t_dim.id)
        if live_gl_id is None or live_dim_id is None:
            continue  # dependency not promoted

        live = live_by_key.get((t_gl.gl_number, t_dim.code))
        if live is None:
            new_row = GLDimensionRequirement(
                tenant_id=live_id,
                gl_id=live_gl_id,
                dimension_id=live_dim_id,
                requirement=t_req.requirement,
            )
            db.add(new_row)
            counts["gl_requirement"]["created"] += 1
        else:
            live.requirement = t_req.requirement
            counts["gl_requirement"]["updated"] += 1


async def _apply_account_mappings(
    db: AsyncSession,
    test_id: UUID,
    live_id: UUID,
    accepted: set[str],
    id_map: _IdMap,
    counts: dict,
) -> None:
    """Apply accepted TenantAccountMapping changes."""
    test_maps = (await db.execute(
        select(TenantAccountMapping, ChartOfAccount)
        .join(ChartOfAccount, TenantAccountMapping.gl_account_id == ChartOfAccount.id)
        .where(TenantAccountMapping.tenant_id == test_id)
    )).all()

    live_maps = (await db.execute(
        select(TenantAccountMapping).where(TenantAccountMapping.tenant_id == live_id)
    )).scalars().all()

    live_by_role: dict[str, TenantAccountMapping] = {m.role_key: m for m in live_maps}

    for t_map, t_gl in test_maps:
        item_id = f"accmap:{t_map.role_key}"
        if item_id not in accepted:
            continue

        live_gl_id = id_map.coa.get(t_gl.id)
        if live_gl_id is None:
            # CoA row wasn't promoted — try to find by gl_number directly in live
            live_gl_res = await db.execute(
                select(ChartOfAccount).where(
                    ChartOfAccount.tenant_id == live_id,
                    ChartOfAccount.gl_number == t_gl.gl_number,
                    ChartOfAccount.is_active.is_(True),
                )
            )
            live_gl = live_gl_res.scalar_one_or_none()
            if live_gl is None:
                continue
            live_gl_id = live_gl.id

        live = live_by_role.get(t_map.role_key)
        if live is None:
            new_row = TenantAccountMapping(
                tenant_id=live_id,
                role_key=t_map.role_key,
                gl_account_id=live_gl_id,
            )
            db.add(new_row)
            counts["account_mapping"]["created"] += 1
        else:
            live.gl_account_id = live_gl_id
            counts["account_mapping"]["updated"] += 1


# ── Public: apply promotion (writes) ─────────────────────────────────────────

async def apply_promotion(
    db: AsyncSession,
    test_tenant_id: UUID,
    live_tenant_id: UUID,
    request: PromotionApplyRequest,
) -> PromotionApplyResult:
    """
    Apply a selection of promotion diff items to the live tenant.

    Recomputes the diff fresh (never trusts client-supplied diff data), then
    applies only the items whose item_id is in request.accepted_item_ids.

    Dependency order: dimension → coa → dimension_value (2-pass) → gl_requirement
    → account_mapping.

    All changes land in the caller's DB transaction; get_db() commits on success.

    Returns a PromotionApplyResult with counts per entity type.
    """
    accepted: set[str] = set(request.accepted_item_ids)
    id_map = _IdMap()

    # Counts per entity: "created" / "updated" / "deactivated"
    from collections import defaultdict
    counts: dict = defaultdict(lambda: defaultdict(int))

    # 1. Dimensions
    await _apply_dimensions(db, test_tenant_id, live_tenant_id, accepted, id_map, counts)

    # 2. CoA
    await _apply_coa(db, test_tenant_id, live_tenant_id, accepted, id_map, counts)

    # 3. DimensionValues (2-pass inside helper)
    await _apply_dimension_values(db, test_tenant_id, live_tenant_id, accepted, id_map, counts)

    # 4. GL Dimension Requirements
    await _apply_gl_requirements(db, test_tenant_id, live_tenant_id, accepted, id_map, counts)

    # 5. Account Mappings
    await _apply_account_mappings(db, test_tenant_id, live_tenant_id, accepted, id_map, counts)

    await db.flush()

    total = sum(
        v
        for entity_counts in counts.values()
        for k, v in entity_counts.items()
        if k in ("created", "updated", "deactivated")
    )

    parts: list[str] = []
    for entity, ec in sorted(counts.items()):
        c, u, d = ec.get("created", 0), ec.get("updated", 0), ec.get("deactivated", 0)
        if c or u or d:
            parts.append(f"{entity}: +{c} ~{u} -{d}")

    return PromotionApplyResult(
        created={e: c["created"] for e, c in counts.items() if c.get("created")},
        updated={e: c["updated"] for e, c in counts.items() if c.get("updated")},
        deactivated={e: c["deactivated"] for e, c in counts.items() if c.get("deactivated")},
        total_applied=total,
        message=f"Applied {total} change(s). {'; '.join(parts) or 'No changes.'}",
    )
