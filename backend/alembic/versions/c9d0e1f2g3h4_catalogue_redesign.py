"""Catalogue redesign: taxonomy fields + control override + reseed

Revision ID: c9d0e1f2g3h4
Revises: b8c9d0e1f2g3
Create Date: 2026-06-19

Schema changes:
1. Add columns to posting_roles: statement (String5), subgroup (String60), display_order (Int).
2. Create tenant_posting_role_settings (per-tenant control-account override).

Catalogue reseed:
- REMOVED: fx_unrealised_gain_loss, fx_realised_gain_loss, accumulated_depreciation,
  depreciation_expense, asset_clearing_cwip, asset_disposal (moved to module configs).
- ADDED: intercompany_loan, accruals, prepayments, provisions.
- CHANGED: grni → is_control_account = true.
- ALL roles assigned statement / subgroup / display_order.

Removed-role cleanup: any tenant_account_mappings rows for the 6 removed roles
are deleted before removing the role_keys. (At migration time, likely 0 rows exist
since the expense/FX/FA modules aren't wired yet — reported in completion summary.)

Downgrade: drop new table + columns, restore previous catalogue.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

revision = "c9d0e1f2g3h4"
down_revision = "b8c9d0e1f2g3"
branch_labels = None
depends_on = None

# ── Role keys to remove ────────────────────────────────────────────────────────
REMOVED_ROLE_KEYS = [
    "fx_unrealised_gain_loss", "fx_realised_gain_loss",
    "accumulated_depreciation", "depreciation_expense",
    "asset_clearing_cwip", "asset_disposal",
]

# ── New catalogue (25 roles) ───────────────────────────────────────────────────
# statement / group / subgroup / display_order / expected_account_type / is_control / label / desc

NEW_CATALOGUE = [
    # ── BS · Current Assets ──────────────────────────────────────────────────
    {
        "role_key": "cash",
        "label": "Cash in Hand / Petty Cash",
        "statement": "BS", "group": "current_assets", "subgroup": "cash_bank",
        "display_order": 10, "expected_account_type": "BS", "is_control_account": False,
        "description": "Physical cash / petty cash float.",
    },
    {
        "role_key": "default_bank",
        "label": "Default Bank Account",
        "statement": "BS", "group": "current_assets", "subgroup": "cash_bank",
        "display_order": 20, "expected_account_type": "BS", "is_control_account": False,
        "description": "Primary operating bank account.",
    },
    {
        "role_key": "bdc_clearing",
        "label": "BDC Clearing Account",
        "statement": "BS", "group": "current_assets", "subgroup": "clearing",
        "display_order": 30, "expected_account_type": "BS", "is_control_account": False,
        "description": "Bureau de Change FX purchase clearing.",
    },
    {
        "role_key": "accounts_receivable",
        "label": "Accounts Receivable (control)",
        "statement": "BS", "group": "current_assets", "subgroup": "receivables",
        "display_order": 40, "expected_account_type": "BS", "is_control_account": True,
        "description": "AR sub-ledger control account for customer invoices.",
    },
    {
        "role_key": "intercompany_receivable",
        "label": "Intercompany Receivable",
        "statement": "BS", "group": "current_assets", "subgroup": "receivables",
        "display_order": 50, "expected_account_type": "BS", "is_control_account": True,
        "description": "Amounts due from related entities.",
    },
    {
        "role_key": "inventory_control",
        "label": "Inventory Control",
        "statement": "BS", "group": "current_assets", "subgroup": "inventory",
        "display_order": 60, "expected_account_type": "BS", "is_control_account": True,
        "description": "Inventory / stock sub-ledger control account.",
    },
    {
        "role_key": "grni",
        "label": "Goods Received Not Invoiced (GRNI)",
        "statement": "BS", "group": "current_assets", "subgroup": "inventory",
        "display_order": 70, "expected_account_type": "BS", "is_control_account": True,
        "description": "Accrual for goods received but not yet invoiced.",
    },
    {
        "role_key": "prepayments",
        "label": "Prepayments",
        "statement": "BS", "group": "current_assets", "subgroup": "prepayments",
        "display_order": 80, "expected_account_type": "BS", "is_control_account": False,
        "description": "Amounts paid in advance for expenses not yet incurred.",
    },
    {
        "role_key": "input_vat",
        "label": "Input VAT",
        "statement": "BS", "group": "current_assets", "subgroup": "tax",
        "display_order": 90, "expected_account_type": "BS", "is_control_account": False,
        "description": "VAT paid on qualifying purchases; recoverable.",
    },
    {
        "role_key": "wht_receivable",
        "label": "Withholding Tax Receivable",
        "statement": "BS", "group": "current_assets", "subgroup": "tax",
        "display_order": 100, "expected_account_type": "BS", "is_control_account": False,
        "description": "WHT certificates received from customers.",
    },
    # ── BS · Current Liabilities ─────────────────────────────────────────────
    {
        "role_key": "accounts_payable",
        "label": "Accounts Payable (control)",
        "statement": "BS", "group": "current_liabilities", "subgroup": "payables",
        "display_order": 110, "expected_account_type": "BS", "is_control_account": True,
        "description": "AP sub-ledger control account for vendor invoices.",
    },
    {
        "role_key": "intercompany_payable",
        "label": "Intercompany Payable",
        "statement": "BS", "group": "current_liabilities", "subgroup": "payables",
        "display_order": 120, "expected_account_type": "BS", "is_control_account": True,
        "description": "Amounts owed to related entities.",
    },
    {
        "role_key": "employee_payable",
        "label": "Employee Payable (control)",
        "statement": "BS", "group": "current_liabilities", "subgroup": "payables",
        "display_order": 130, "expected_account_type": "BS", "is_control_account": True,
        "description": "Amounts owed to employees (expense retirement, payroll).",
    },
    {
        "role_key": "accruals",
        "label": "Accruals",
        "statement": "BS", "group": "current_liabilities", "subgroup": "accruals_provisions",
        "display_order": 140, "expected_account_type": "BS", "is_control_account": False,
        "description": "Expenses incurred but not yet invoiced / paid.",
    },
    {
        "role_key": "provisions",
        "label": "Provisions",
        "statement": "BS", "group": "current_liabilities", "subgroup": "accruals_provisions",
        "display_order": 150, "expected_account_type": "BS", "is_control_account": False,
        "description": "Provisions for probable future obligations (warranties, restructuring, etc.).",
    },
    {
        "role_key": "output_vat",
        "label": "Output VAT",
        "statement": "BS", "group": "current_liabilities", "subgroup": "tax",
        "display_order": 160, "expected_account_type": "BS", "is_control_account": False,
        "description": "VAT collected on sales; remitted to FIRS.",
    },
    {
        "role_key": "wht_payable",
        "label": "Withholding Tax Payable",
        "statement": "BS", "group": "current_liabilities", "subgroup": "tax",
        "display_order": 170, "expected_account_type": "BS", "is_control_account": False,
        "description": "WHT deducted from vendor payments; remittable to FIRS.",
    },
    {
        "role_key": "paye_payable",
        "label": "PAYE Payable",
        "statement": "BS", "group": "current_liabilities", "subgroup": "tax",
        "display_order": 180, "expected_account_type": "BS", "is_control_account": False,
        "description": "PAYE deducted from salaries; remittable to LIRS/FIRS.",
    },
    {
        "role_key": "statutory_deductions",
        "label": "Statutory Deductions Payable (Pension / NHF / NSITF)",
        "statement": "BS", "group": "current_liabilities", "subgroup": "tax",
        "display_order": 190, "expected_account_type": "BS", "is_control_account": False,
        "description": "Combined statutory payroll deductions. Per-levy split is FUTURE.",
    },
    # ── BS · Non-Current Liabilities ─────────────────────────────────────────
    {
        "role_key": "intercompany_loan",
        "label": "Intercompany Loan Payable",
        "statement": "BS", "group": "non_current_liabilities", "subgroup": "loans",
        "display_order": 200, "expected_account_type": "BS", "is_control_account": True,
        "description": "Long-term loans from related entities.",
    },
    # ── BS · Equity ──────────────────────────────────────────────────────────
    {
        "role_key": "retained_earnings",
        "label": "Retained Earnings",
        "statement": "BS", "group": "equity", "subgroup": "equity",
        "display_order": 210, "expected_account_type": "BS", "is_control_account": False,
        "description": "Accumulated retained earnings / accumulated deficit.",
    },
    {
        "role_key": "current_year_earnings",
        "label": "Current Year Earnings",
        "statement": "BS", "group": "equity", "subgroup": "equity",
        "display_order": 220, "expected_account_type": "BS", "is_control_account": False,
        "description": "Net profit/loss for the current fiscal year before year-end close.",
    },
    # ── BS · Suspense / Clearing ─────────────────────────────────────────────
    {
        "role_key": "general_suspense",
        "label": "General Suspense",
        "statement": "BS", "group": "suspense", "subgroup": "suspense",
        "display_order": 230, "expected_account_type": None, "is_control_account": False,
        "description": "Temporary holding account for unclassified postings.",
    },
    {
        "role_key": "rounding_difference",
        "label": "Rounding Difference",
        "statement": "BS", "group": "suspense", "subgroup": "suspense",
        "display_order": 240, "expected_account_type": None, "is_control_account": False,
        "description": "Absorbs sub-cent rounding differences to keep journals balanced.",
    },
    # ── PL · Cost of Sales ───────────────────────────────────────────────────
    {
        "role_key": "cogs",
        "label": "Cost of Goods Sold",
        "statement": "PL", "group": "cost_of_sales", "subgroup": "cost_of_sales",
        "display_order": 250, "expected_account_type": "PL", "is_control_account": False,
        "description": "Cost of inventory sold / consumed. PL expense.",
    },
]


# ── Previous catalogue (for downgrade) ───────────────────────────────────────
# Restoring the exact 27 roles from b8c9d0e1f2g3 with old group field.
OLD_CATALOGUE = [
    {"role_key": "employee_payable", "label": "Employee Payable (control)",
     "group": "control", "expected_account_type": "BS", "is_control_account": True,
     "description": "Aggregates amounts owed to employees. BS liability."},
    {"role_key": "accounts_payable", "label": "Accounts Payable (control)",
     "group": "control", "expected_account_type": "BS", "is_control_account": True,
     "description": "AP sub-ledger control account for vendor invoices. BS liability."},
    {"role_key": "accounts_receivable", "label": "Accounts Receivable (control)",
     "group": "control", "expected_account_type": "BS", "is_control_account": True,
     "description": "AR sub-ledger control account for customer invoices. BS asset."},
    {"role_key": "intercompany_payable", "label": "Intercompany Payable",
     "group": "control", "expected_account_type": "BS", "is_control_account": True,
     "description": "Amounts owed to related entities. BS liability."},
    {"role_key": "intercompany_receivable", "label": "Intercompany Receivable",
     "group": "control", "expected_account_type": "BS", "is_control_account": True,
     "description": "Amounts due from related entities. BS asset."},
    {"role_key": "output_vat", "label": "Output VAT",
     "group": "tax", "expected_account_type": "BS", "is_control_account": False,
     "description": "VAT collected on sales; remitted to FIRS. BS liability."},
    {"role_key": "input_vat", "label": "Input VAT",
     "group": "tax", "expected_account_type": "BS", "is_control_account": False,
     "description": "VAT paid on qualifying purchases; recoverable. BS asset."},
    {"role_key": "wht_payable", "label": "Withholding Tax Payable",
     "group": "tax", "expected_account_type": "BS", "is_control_account": False,
     "description": "WHT deducted from vendor/supplier payments; remittable to FIRS."},
    {"role_key": "wht_receivable", "label": "Withholding Tax Receivable",
     "group": "tax", "expected_account_type": "BS", "is_control_account": False,
     "description": "WHT certificates received from customers."},
    {"role_key": "paye_payable", "label": "PAYE Payable",
     "group": "tax", "expected_account_type": "BS", "is_control_account": False,
     "description": "PAYE deducted from employees salaries; remittable."},
    {"role_key": "statutory_deductions",
     "label": "Statutory Deductions Payable (Pension / NHF / NSITF)",
     "group": "tax", "expected_account_type": "BS", "is_control_account": False,
     "description": "Combined statutory payroll deductions payable."},
    {"role_key": "default_bank", "label": "Default Bank Account",
     "group": "cash_bank", "expected_account_type": "BS", "is_control_account": False,
     "description": "Primary operating bank account."},
    {"role_key": "cash", "label": "Cash in Hand / Petty Cash",
     "group": "cash_bank", "expected_account_type": "BS", "is_control_account": False,
     "description": "Physical cash / petty cash float."},
    {"role_key": "bdc_clearing", "label": "BDC Clearing Account",
     "group": "cash_bank", "expected_account_type": "BS", "is_control_account": False,
     "description": "Bureau de Change FX purchase clearing."},
    {"role_key": "asset_clearing_cwip", "label": "Capital Work in Progress (CWIP)",
     "group": "fixed_assets", "expected_account_type": "BS", "is_control_account": False,
     "description": "Assets under construction/acquisition."},
    {"role_key": "accumulated_depreciation", "label": "Accumulated Depreciation",
     "group": "fixed_assets", "expected_account_type": "BS", "is_control_account": False,
     "description": "Contra asset: cumulative depreciation."},
    {"role_key": "depreciation_expense", "label": "Depreciation Expense",
     "group": "fixed_assets", "expected_account_type": "PL", "is_control_account": False,
     "description": "Period depreciation charge."},
    {"role_key": "asset_disposal", "label": "Asset Disposal / P&L on Disposal",
     "group": "fixed_assets", "expected_account_type": "PL", "is_control_account": False,
     "description": "Gain or loss on disposal of fixed assets."},
    {"role_key": "inventory_control", "label": "Inventory Control",
     "group": "inventory", "expected_account_type": "BS", "is_control_account": True,
     "description": "Inventory / stock sub-ledger control account."},
    {"role_key": "grni", "label": "Goods Received Not Invoiced (GRNI)",
     "group": "inventory", "expected_account_type": "BS", "is_control_account": False,
     "description": "Accrual for goods received but not yet invoiced."},
    {"role_key": "cogs", "label": "Cost of Goods Sold",
     "group": "inventory", "expected_account_type": "PL", "is_control_account": False,
     "description": "Cost of inventory sold / consumed."},
    {"role_key": "fx_unrealised_gain_loss", "label": "FX Unrealised Gain / Loss",
     "group": "fx", "expected_account_type": "PL", "is_control_account": False,
     "description": "Unrealised FX movement on open monetary items at period end."},
    {"role_key": "fx_realised_gain_loss", "label": "FX Realised Gain / Loss",
     "group": "fx", "expected_account_type": "PL", "is_control_account": False,
     "description": "Realised FX gain or loss on settlement."},
    {"role_key": "retained_earnings", "label": "Retained Earnings",
     "group": "period_end", "expected_account_type": "BS", "is_control_account": False,
     "description": "Accumulated retained earnings / accumulated deficit."},
    {"role_key": "current_year_earnings", "label": "Current Year Earnings",
     "group": "period_end", "expected_account_type": "BS", "is_control_account": False,
     "description": "Net profit/loss for the current fiscal year."},
    {"role_key": "general_suspense", "label": "General Suspense",
     "group": "suspense", "expected_account_type": None, "is_control_account": False,
     "description": "Temporary holding account for unclassified postings."},
    {"role_key": "rounding_difference", "label": "Rounding Difference",
     "group": "suspense", "expected_account_type": None, "is_control_account": False,
     "description": "Absorbs sub-cent rounding differences."},
]


def upgrade() -> None:
    # ── 1. Add new columns to posting_roles ──────────────────────────────────
    op.add_column("posting_roles", sa.Column("statement", sa.String(5), nullable=True))
    op.add_column("posting_roles", sa.Column("subgroup", sa.String(60), nullable=True))
    op.add_column("posting_roles", sa.Column("display_order", sa.Integer(), nullable=True,
                                             server_default="0"))

    # ── 2. Create tenant_posting_role_settings ────────────────────────────────
    op.create_table(
        "tenant_posting_role_settings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_key", sa.String(60),
                  sa.ForeignKey("posting_roles.role_key", ondelete="CASCADE"), nullable=False),
        sa.Column("is_control_account_override", sa.Boolean(), nullable=True),
        sa.UniqueConstraint("tenant_id", "role_key", name="uq_tprs_tenant_role"),
    )
    op.create_index("ix_tprs_tenant_id", "tenant_posting_role_settings", ["tenant_id"])

    # ── 3. Clean up mapping rows for removed roles (likely 0 at this point) ──
    for key in REMOVED_ROLE_KEYS:
        op.execute(
            f"DELETE FROM tenant_account_mappings WHERE role_key = '{key}'"
        )

    # ── 4. Remove old roles ───────────────────────────────────────────────────
    keys_list = ", ".join(f"'{k}'" for k in REMOVED_ROLE_KEYS)
    op.execute(f"DELETE FROM posting_roles WHERE role_key IN ({keys_list})")

    # ── 5. Insert new/changed roles (upsert via INSERT ... ON CONFLICT) ───────
    roles_t = sa.table(
        "posting_roles",
        sa.column("role_key", sa.String),
        sa.column("label", sa.String),
        sa.column("statement", sa.String),
        sa.column("group", sa.String),
        sa.column("subgroup", sa.String),
        sa.column("display_order", sa.Integer),
        sa.column("expected_account_type", sa.String),
        sa.column("expected_nature", sa.String),
        sa.column("is_control_account", sa.Boolean),
        sa.column("description", sa.Text),
    )

    for r in NEW_CATALOGUE:
        op.execute(
            pg_insert(roles_t).values(
                role_key=r["role_key"], label=r["label"],
                statement=r["statement"], group=r["group"],
                subgroup=r.get("subgroup"), display_order=r["display_order"],
                expected_account_type=r.get("expected_account_type"),
                expected_nature=None, is_control_account=r["is_control_account"],
                description=r.get("description"),
            ).on_conflict_do_update(
                index_elements=["role_key"],
                set_={
                    "label": r["label"], "statement": r["statement"],
                    "group": r["group"], "subgroup": r.get("subgroup"),
                    "display_order": r["display_order"],
                    "expected_account_type": r.get("expected_account_type"),
                    "is_control_account": r["is_control_account"],
                    "description": r.get("description"),
                },
            )
        )

    # ── 6. Make statement NOT NULL after populating all rows ──────────────────
    op.alter_column("posting_roles", "statement", nullable=False)
    op.alter_column("posting_roles", "display_order", nullable=False, server_default=None)
    op.create_index("ix_posting_roles_statement", "posting_roles", ["statement"])


def downgrade() -> None:
    # Remove settings table
    op.drop_index("ix_tprs_tenant_id", table_name="tenant_posting_role_settings")
    op.drop_table("tenant_posting_role_settings")

    # Drop new columns
    op.drop_index("ix_posting_roles_statement", table_name="posting_roles")
    op.drop_column("posting_roles", "display_order")
    op.drop_column("posting_roles", "subgroup")
    op.drop_column("posting_roles", "statement")

    # Restore old catalogue: delete all current rows, reinsert old set
    op.execute("DELETE FROM tenant_account_mappings")
    op.execute("DELETE FROM posting_roles")

    roles_t = sa.table(
        "posting_roles",
        sa.column("role_key", sa.String),
        sa.column("label", sa.String),
        sa.column("group", sa.String),
        sa.column("expected_account_type", sa.String),
        sa.column("expected_nature", sa.String),
        sa.column("is_control_account", sa.Boolean),
        sa.column("description", sa.Text),
    )
    op.bulk_insert(roles_t, [
        {"role_key": r["role_key"], "label": r["label"], "group": r["group"],
         "expected_account_type": r.get("expected_account_type"),
         "expected_nature": None, "is_control_account": r["is_control_account"],
         "description": r.get("description")}
        for r in OLD_CATALOGUE
    ])
