"""
app/constants/modules.py
========================
Single source of truth for all Ziva BI module definitions.

Every router, schema, migration, or frontend API that references module keys or
labels must import from here. Do NOT define module lists elsewhere in the codebase.

Usage
-----
    from app.constants.modules import MODULE_CATALOGUE, MODULE_KEY_TO_LABEL

    # Iterate all modules:
    for m in MODULE_CATALOGUE:
        print(m["key"], m["label"])

    # Look up a label:
    label = MODULE_KEY_TO_LABEL.get("expense", "Unknown")
"""

MODULE_CATALOGUE: list[dict[str, str]] = [
    {"key": "expense",          "label": "Expense Management"},
    {"key": "ap",               "label": "Accounts Payable (P2P)"},
    {"key": "ar",               "label": "Accounts Receivable (O2C)"},
    {"key": "payroll",          "label": "Payroll & HR"},
    {"key": "bank_recon",       "label": "Bank Reconciliation"},
    {"key": "budget",           "label": "Budget & Planning"},
    {"key": "tax_engine",       "label": "Tax & Compliance"},
    {"key": "inventory",        "label": "Inventory & Warehouse"},
    {"key": "fixed_assets",     "label": "Fixed Assets"},
    {"key": "posm",             "label": "POSM Management"},
    {"key": "vendor_portal",    "label": "Vendor Portal"},
    {"key": "customer_portal",  "label": "Customer Portal"},
    {"key": "warehouse",        "label": "Warehouse / 3PL Portal"},
    {"key": "reporting",        "label": "Reporting & Analytics"},
]

MODULE_KEY_TO_LABEL: dict[str, str] = {m["key"]: m["label"] for m in MODULE_CATALOGUE}

VALID_MODULE_KEYS: frozenset[str] = frozenset(m["key"] for m in MODULE_CATALOGUE)
