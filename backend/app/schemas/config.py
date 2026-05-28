"""
ZivaBI — M8 Pydantic schemas for the master data configuration API.

Used by the /api/config/ router for dimensions, dimension values, chart of accounts,
GL dimension requirements, category GL mappings, and expense form config.
"""

import re
import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator


# ── Dimensions ────────────────────────────────────────────────────────────────

def _generate_code(name: str) -> str:
    """Convert a display name to a lowercase, underscore-separated code."""
    code = re.sub(r"[^a-z0-9]+", "_", name.strip().lower())
    return code.strip("_") or "dimension"


class DimensionCreate(BaseModel):
    """Payload to create a new tenant dimension."""

    name: str
    code: str | None = None  # auto-generated from name if not provided
    is_required: bool = False
    accepted_value_types: str | None = None  # comma-separated type tags
    value_source: Optional[str] = "manual"
    dimension_sources: Optional[list] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Dimension name is required.")
        return v

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9_]+", v):
            raise ValueError("Code must contain only lowercase letters, numbers, and underscores.")
        return v


class DimensionUpdate(BaseModel):
    """Payload for updating a dimension (PATCH semantics)."""

    name: str | None = None
    code: str | None = None
    is_required: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    accepted_value_types: str | None = None
    value_source: Optional[str] = None
    dimension_sources: Optional[list] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9_]+", v):
            raise ValueError("Code must contain only lowercase letters, numbers, and underscores.")
        return v


class DimensionReorder(BaseModel):
    """Payload to update a dimension's sort_order."""

    sort_order: int


class DimensionResponse(BaseModel):
    """A tenant dimension as returned in API responses."""

    id: str
    tenant_id: str
    name: str
    code: str
    is_required: bool
    is_active: bool
    sort_order: int
    created_at: datetime
    accepted_value_types: str | None = None
    value_source: Optional[str] = "manual"
    dimension_sources: Optional[list] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, d: object) -> "DimensionResponse":
        from app.models.master_data import TenantDimension
        dim: TenantDimension = d  # type: ignore[assignment]
        return cls(
            id=str(dim.id),
            tenant_id=str(dim.tenant_id),
            name=dim.name,
            code=dim.code,
            is_required=dim.is_required,
            is_active=dim.is_active,
            sort_order=dim.sort_order,
            created_at=dim.created_at,
            accepted_value_types=dim.accepted_value_types,
            value_source=dim.value_source,
            dimension_sources=dim.dimension_sources,
            display_name=dim.display_name,
            description=dim.description,
            icon=dim.icon,
        )


# ── Dimension Values ──────────────────────────────────────────────────────────

class DimensionValueCreate(BaseModel):
    """Payload to create a single dimension value."""

    code: str
    name: str
    sort_order: int = 0
    value_type: str | None = None
    cascade_dimension_id: uuid.UUID | None = None
    cascade_value_id: uuid.UUID | None = None
    valid_from: date | None = None
    valid_to: date | None = None

    @field_validator("code", "name")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field is required.")
        return v


class DimensionValueUpdate(BaseModel):
    """Payload for updating a dimension value (PATCH semantics)."""

    code: str | None = None
    name: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    value_type: str | None = None
    cascade_dimension_id: uuid.UUID | None = None
    cascade_value_id: uuid.UUID | None = None
    valid_from: date | None = None
    valid_to: date | None = None


class DimensionValueResponse(BaseModel):
    """A single dimension value as returned in API responses."""

    id: str
    tenant_id: str
    dimension_id: str
    code: str
    name: str
    is_active: bool
    sort_order: int
    created_at: datetime
    value_type: str | None = None
    cascade_dimension_id: str | None = None
    cascade_value_id: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, v: object) -> "DimensionValueResponse":
        from app.models.master_data import DimensionValue
        dv: DimensionValue = v  # type: ignore[assignment]
        return cls(
            id=str(dv.id),
            tenant_id=str(dv.tenant_id),
            dimension_id=str(dv.dimension_id),
            code=dv.code,
            name=dv.name,
            is_active=dv.is_active,
            sort_order=dv.sort_order,
            created_at=dv.created_at,
            value_type=dv.value_type,
            cascade_dimension_id=str(dv.cascade_dimension_id) if dv.cascade_dimension_id else None,
            cascade_value_id=str(dv.cascade_value_id) if dv.cascade_value_id else None,
            valid_from=dv.valid_from,
            valid_to=dv.valid_to,
        )


class UploadResult(BaseModel):
    """Standard result returned by bulk upload endpoints."""

    imported: int
    updated: int = 0
    skipped: int
    errors: list[dict]  # [{row: int, reason: str}]


# ── Chart of Accounts ─────────────────────────────────────────────────────────

class CoACreate(BaseModel):
    """Payload to create a single GL account."""

    gl_number: str
    gl_name: str
    account_type: str  # 'SOCI' or 'SOFP' (also accepts legacy 'PL'/'BS')
    gl_group: str | None = None
    gl_subgroup: str | None = None
    gl_sub_subgroup: str | None = None
    fs_head: str | None = None
    fs_note: str | None = None
    tb_mapping: str | None = None
    group_account_number: str | None = None
    group_account_name: str | None = None

    @field_validator("gl_number")
    @classmethod
    def validate_gl_number(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("GL Number is required.")
        if len(v) > 50:
            raise ValueError("GL Number must be at most 50 characters.")
        return v

    @field_validator("gl_name")
    @classmethod
    def validate_gl_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("GL Name is required.")
        return v

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        v = v.strip().upper()
        # Accept both new (SOCI/SOFP) and legacy (PL/BS) labels
        mapping = {"PL": "SOCI", "BS": "SOFP"}
        v = mapping.get(v, v)
        if v not in ("SOCI", "SOFP"):
            raise ValueError("Account Type must be 'SOCI' or 'SOFP'.")
        return v


class CoAUpdate(BaseModel):
    """Payload for updating a GL account (PATCH semantics)."""

    gl_number: str | None = None
    gl_name: str | None = None
    account_type: str | None = None
    is_active: bool | None = None
    gl_group: str | None = None
    gl_subgroup: str | None = None
    gl_sub_subgroup: str | None = None
    fs_head: str | None = None
    fs_note: str | None = None
    tb_mapping: str | None = None
    group_account_number: str | None = None
    group_account_name: str | None = None

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip().upper()
            mapping = {"PL": "SOCI", "BS": "SOFP"}
            v = mapping.get(v, v)
            if v not in ("SOCI", "SOFP"):
                raise ValueError("Account Type must be 'SOCI' or 'SOFP'.")
        return v


class GLDimensionRequirementItem(BaseModel):
    """Single dimension requirement for a GL account."""

    dimension_id: uuid.UUID
    requirement: str  # 'required', 'optional', 'na'

    @field_validator("requirement")
    @classmethod
    def validate_requirement(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("required", "optional", "na"):
            raise ValueError("Requirement must be 'required', 'optional', or 'na'.")
        return v


class CoADimensionsUpdate(BaseModel):
    """Payload to set dimension requirements for a GL account."""

    requirements: list[GLDimensionRequirementItem]


class CoAResponse(BaseModel):
    """A GL account as returned in API responses."""

    id: str
    tenant_id: str
    gl_number: str
    gl_name: str
    account_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    dimension_requirements: list[dict] = []  # [{dimension_id, dimension_name, requirement}]
    gl_group: str | None = None
    gl_subgroup: str | None = None
    gl_sub_subgroup: str | None = None
    fs_head: str | None = None
    fs_note: str | None = None
    tb_mapping: str | None = None
    group_account_number: str | None = None
    group_account_name: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, gl: object, requirements: list | None = None) -> "CoAResponse":
        from app.models.master_data import ChartOfAccount
        g: ChartOfAccount = gl  # type: ignore[assignment]
        reqs = []
        for req in (requirements or []):
            reqs.append({
                "dimension_id": str(req.dimension_id),
                "dimension_name": req.dimension.name if hasattr(req, "dimension") and req.dimension else None,
                "requirement": req.requirement,
            })
        return cls(
            id=str(g.id),
            tenant_id=str(g.tenant_id),
            gl_number=g.gl_number,
            gl_name=g.gl_name,
            account_type=g.account_type,
            is_active=g.is_active,
            created_at=g.created_at,
            updated_at=g.updated_at,
            dimension_requirements=reqs,
            gl_group=g.gl_group,
            gl_subgroup=g.gl_subgroup,
            gl_sub_subgroup=g.gl_sub_subgroup,
            fs_head=g.fs_head,
            fs_note=g.fs_note,
            tb_mapping=g.tb_mapping,
            group_account_number=g.group_account_number,
            group_account_name=g.group_account_name,
        )


class CoAListItem(BaseModel):
    """Lightweight GL account used in list/search responses (no dimension requirements)."""

    id: str
    gl_number: str
    gl_name: str
    account_type: str
    is_active: bool
    gl_group: str | None = None
    gl_subgroup: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, gl: object) -> "CoAListItem":
        from app.models.master_data import ChartOfAccount
        g: ChartOfAccount = gl  # type: ignore[assignment]
        return cls(
            id=str(g.id),
            gl_number=g.gl_number,
            gl_name=g.gl_name,
            account_type=g.account_type,
            is_active=g.is_active,
            gl_group=g.gl_group,
            gl_subgroup=g.gl_subgroup,
        )


# ── Category GL Mappings ──────────────────────────────────────────────────────

class CategoryGLMappingCreate(BaseModel):
    """Payload to add a GL account mapping to a subcategory."""

    gl_id: uuid.UUID
    is_default: bool = False


class CategoryGLMappingResponse(BaseModel):
    """A category-GL mapping as returned in API responses."""

    id: str
    gl_id: str
    gl_number: str
    gl_name: str
    is_default: bool

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, mapping: object) -> "CategoryGLMappingResponse":
        from app.models.master_data import CategoryGLMapping
        m: CategoryGLMapping = mapping  # type: ignore[assignment]
        return cls(
            id=str(m.id),
            gl_id=str(m.gl_id),
            gl_number=m.gl_account.gl_number if m.gl_account else "",
            gl_name=m.gl_account.gl_name if m.gl_account else "",
            is_default=m.is_default,
        )


# ── M8 Category Response (with GL mappings) ───────────────────────────────────

class CategoryWithMappingsResponse(BaseModel):
    """Category as returned by the M8 config/categories endpoint, including GL mappings."""

    id: str
    tenant_id: str
    name: str
    code: str | None
    parent_id: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
    gl_mappings: list[CategoryGLMappingResponse] = []
    subcategories: list["CategoryWithMappingsResponse"] = []

    @classmethod
    def from_orm(
        cls,
        cat: object,
        subcats: list | None = None,
        mappings: list | None = None,
    ) -> "CategoryWithMappingsResponse":
        from app.models.expenses import ExpenseCategory
        c: ExpenseCategory = cat  # type: ignore[assignment]
        return cls(
            id=str(c.id),
            tenant_id=str(c.tenant_id),
            name=c.name,
            code=c.code,
            parent_id=str(c.parent_id) if c.parent_id else None,
            is_active=c.is_active,
            sort_order=c.sort_order,
            created_at=c.created_at,
            gl_mappings=[CategoryGLMappingResponse.from_orm(m) for m in (mappings or [])],
            subcategories=[
                CategoryWithMappingsResponse.from_orm(s)
                for s in (subcats or [])
                if s.is_active
            ],
        )


class CategoryCreate(BaseModel):
    """Payload for creating a category or subcategory in the M8 config router."""

    name: str
    code: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int = 0

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name is required.")
        return v


class CategoryUpdate(BaseModel):
    """Payload for updating a category (PATCH semantics)."""

    name: str | None = None
    code: str | None = None
    sort_order: int | None = None


# ── M9: GL search result (used by expense form Level 4 GL picker) ─────────────

class GLSearchResult(BaseModel):
    """
    A single GL account as returned by the GL search endpoint.

    Includes dimension requirements so the expense form can immediately render
    the correct dimension dropdowns once the employee selects a GL.
    """

    gl_id: str
    gl_number: str
    gl_name: str
    account_type: str
    dimension_requirements: list[dict]  # [{dimension_id, requirement}]

    @classmethod
    def from_orm(cls, gl: object) -> "GLSearchResult":
        """Build from a ChartOfAccount ORM instance with eagerly loaded dimension_requirements."""
        from app.models.master_data import ChartOfAccount
        g: ChartOfAccount = gl  # type: ignore[assignment]
        return cls(
            gl_id=str(g.id),
            gl_number=g.gl_number,
            gl_name=g.gl_name,
            account_type=g.account_type,
            dimension_requirements=[
                {"dimension_id": str(req.dimension_id), "requirement": req.requirement}
                for req in (g.dimension_requirements or [])
            ],
        )


# ── M8.1: Bulk Actions ────────────────────────────────────────────────────────

class BulkActionRequest(BaseModel):
    """Payload for bulk activate / deactivate / delete on master data tables."""

    ids: list[uuid.UUID]
    action: str  # 'activate', 'deactivate', 'delete'

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("activate", "deactivate", "delete"):
            raise ValueError("Action must be 'activate', 'deactivate', or 'delete'.")
        return v

    @field_validator("ids")
    @classmethod
    def validate_ids(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one ID is required.")
        return v


class BulkActionResult(BaseModel):
    """Result returned by bulk action endpoints."""

    action: str
    affected: int
    skipped: int = 0
    errors: list[dict] = []
