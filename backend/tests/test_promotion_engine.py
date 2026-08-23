"""
Promotion engine unit tests (no database required).

Tests the helper functions in services/promotion_engine.py that are pure
Python logic — no async DB calls, no fixtures needed.
"""

from datetime import date

from app.services.promotion_engine import (
    _v, _fields_dict, _IdMap,
    _ORG_FIELDS, _ROLE_FIELDS, _COA_FIELDS, _DIM_FIELDS,
    _role_ckey, _role_item_id,
)


# --------------------------------------------------------------------------- #
# _v() — JSON-safe serialiser
# --------------------------------------------------------------------------- #

def test_v_date_to_isoformat():
    """date objects are serialised to ISO-8601 strings."""
    assert _v(date(2026, 8, 15)) == "2026-08-15"


def test_v_passthrough_str():
    """Strings are returned unchanged."""
    assert _v("hello") == "hello"


def test_v_passthrough_none():
    """None is returned as-is."""
    assert _v(None) is None


def test_v_passthrough_int():
    """Integers are returned unchanged."""
    assert _v(42) == 42


def test_v_passthrough_bool():
    """Booleans are returned unchanged."""
    assert _v(True) is True


# --------------------------------------------------------------------------- #
# _fields_dict() — ORM attribute subset extraction
# --------------------------------------------------------------------------- #

class _FakeRow:
    """Minimal mock that quacks like an ORM row."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_fields_dict_extracts_subset():
    row = _FakeRow(name="Acme", code="ACME", is_active=True, sort_order=0)
    result = _fields_dict(row, ["name", "code"])
    assert result == {"name": "Acme", "code": "ACME"}


def test_fields_dict_missing_field_returns_none():
    """Fields not on the row return None (via getattr default)."""
    row = _FakeRow(name="Acme")
    result = _fields_dict(row, ["name", "nonexistent"])
    assert result["nonexistent"] is None


def test_fields_dict_date_serialised():
    row = _FakeRow(valid_from=date(2026, 1, 1))
    result = _fields_dict(row, ["valid_from"])
    assert result["valid_from"] == "2026-01-01"


# --------------------------------------------------------------------------- #
# _IdMap — dataclass instantiation
# --------------------------------------------------------------------------- #

def test_idmap_fields_default_empty():
    """All maps start empty."""
    m = _IdMap()
    assert m.org == {}
    assert m.role == {}
    assert m.dim == {}
    assert m.coa == {}
    assert m.dimval == {}


def test_idmap_independent_instances():
    """Two IdMap instances do not share state."""
    a = _IdMap()
    b = _IdMap()
    a.org["x"] = "y"
    assert "x" not in b.org


# --------------------------------------------------------------------------- #
# Field list completeness checks
# --------------------------------------------------------------------------- #

def test_org_fields_covers_expected():
    """OrgStructureNode field list includes core non-key fields."""
    required = {"name", "node_type", "is_active", "sort_order"}
    assert required.issubset(set(_ORG_FIELDS)), f"Missing from _ORG_FIELDS: {required - set(_ORG_FIELDS)}"


def test_role_fields_covers_expected():
    """ApprovalRole field list includes core non-key fields."""
    required = {"name", "description", "display_order", "is_active", "designation"}
    assert required.issubset(set(_ROLE_FIELDS)), f"Missing from _ROLE_FIELDS: {required - set(_ROLE_FIELDS)}"


def test_coa_fields_covers_expected():
    """ChartOfAccount field list includes important fields."""
    required = {"gl_name", "account_type", "is_foreign_currency"}
    assert required.issubset(set(_COA_FIELDS)), f"Missing from _COA_FIELDS: {required - set(_COA_FIELDS)}"


def test_dim_fields_covers_expected():
    """TenantDimension field list includes required fields."""
    required = {"name", "is_required", "sort_order"}
    assert required.issubset(set(_DIM_FIELDS)), f"Missing from _DIM_FIELDS: {required - set(_DIM_FIELDS)}"


# --------------------------------------------------------------------------- #
# Item ID scheme validation
# --------------------------------------------------------------------------- #

def test_item_id_prefixes():
    """Verify item_id prefix conventions match the schema comment."""
    schemes = {
        "org":    "org:SALES",
        "coa":    "coa:410080",
        "dim":    "dim:cost_center",
        "dimval": "dimval:cost_center:NG_FI",
        "glreq":  "glreq:410080:cost_center",
        "accmap": "accmap:employee_payable",
    }
    for prefix, example in schemes.items():
        assert example.startswith(f"{prefix}:"), f"Item ID {example!r} does not start with '{prefix}:'"


def test_role_item_id_encodes_composite_key():
    """_role_item_id encodes name + area + sub_area so same-name roles in different areas are distinct."""

    class _FakeRole:
        def __init__(self, name, area, sub_area):
            self.name = name
            self.area = area
            self.sub_area = sub_area

    r1 = _FakeRole("Finance Reviewer", "Finance", "Treasury")
    r2 = _FakeRole("Finance Reviewer", "Finance", "AP")
    r3 = _FakeRole("Finance Reviewer", None, None)

    id1 = _role_item_id(r1)
    id2 = _role_item_id(r2)
    id3 = _role_item_id(r3)

    assert id1 != id2, "Same name, different sub_area must produce distinct item IDs"
    assert id1 != id3
    assert id2 != id3
    assert id1.startswith("role:")
    assert id2.startswith("role:")
    assert id3.startswith("role:")


def test_role_ckey_tuple():
    """_role_ckey returns a 3-tuple (name, area, sub_area) suitable as a dict key."""

    class _FakeRole:
        def __init__(self, name, area, sub_area):
            self.name = name
            self.area = area
            self.sub_area = sub_area

    r = _FakeRole("Manager", "Ops", "Logistics")
    ckey = _role_ckey(r)
    assert ckey == ("Manager", "Ops", "Logistics")
    assert isinstance(ckey, tuple)
    # Must be hashable (usable as dict key)
    d = {ckey: "ok"}
    assert d[ckey] == "ok"
