"""Account Determination Layer — posting_roles catalogue + tenant_account_mappings

Revision ID: b8c9d0e1f2g3
Revises: a7b8c9d0e1f2
Create Date: 2026-06-19

Creates two tables and seeds the posting_roles catalogue:

  posting_roles           — system-level catalogue (seeded here, extensible)
  tenant_account_mappings — per-tenant role → GL account mapping (unique per tenant+role)

expected_account_type values:
  "BS" = Balance Sheet (SOFP / SOFP)  → accepted DB values: BS, SOFP
  "PL" = P&L / Income Statement (SOCI) → accepted DB values: PL, SOCI
  NULL  = either type accepted

expected_nature: NULL for all v1 roles — account_classification is unpopulated in
current CoA data; classification-level validation is deferred.

Role → expected_account_type mapping (accounting rationale):
  Control accounts (payables, receivables):        BS  — balance-sheet control
  Tax accounts (VAT, WHT, PAYE):                   BS  — current liabilities/assets
  Cash / bank:                                     BS  — current assets
  Fixed assets (CWIP, accumulated depreciation):   BS  — non-current assets
  Depreciation expense / disposal P&L:             PL  — income statement charges
  Inventory (stock, GRNI):                         BS  — current assets
  COGS:                                            PL  — income statement cost
  FX gains/losses:                                 PL  — other income/expense
  Retained earnings / current-year earnings:       BS  — equity
  Suspense / rounding:                             NULL — may be BS or PL

statutory_deductions: one combined role for pension/NHF/NSITF in v1.
Per-levy splits are FUTURE when sub-deduction lines are needed.
"""

from alembic import op
import sqlalchemy as sa

revision = "b8c9d0e1f2g3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None

# ── Posting-role seed data ────────────────────────────────────────────────────

POSTING_ROLES = [
    # ── Control accounts ────────────────────────────────────────────────────
    {
        "role_key": "employee_payable",
        "label": "Employee Payable (control)",
        "group": "control",
        "expected_account_type": "BS",
        "is_control_account": True,
        "description": "Aggregates amounts owed to employees (expense retirement, payroll). BS liability.",
    },
    {
        "role_key": "accounts_payable",
        "label": "Accounts Payable (control)",
        "group": "control",
        "expected_account_type": "BS",
        "is_control_account": True,
        "description": "AP sub-ledger control account for vendor invoices. BS liability.",
    },
    {
        "role_key": "accounts_receivable",
        "label": "Accounts Receivable (control)",
        "group": "control",
        "expected_account_type": "BS",
        "is_control_account": True,
        "description": "AR sub-ledger control account for customer invoices. BS asset.",
    },
    {
        "role_key": "intercompany_payable",
        "label": "Intercompany Payable",
        "group": "control",
        "expected_account_type": "BS",
        "is_control_account": True,
        "description": "Amounts owed to related entities. BS liability.",
    },
    {
        "role_key": "intercompany_receivable",
        "label": "Intercompany Receivable",
        "group": "control",
        "expected_account_type": "BS",
        "is_control_account": True,
        "description": "Amounts due from related entities. BS asset.",
    },
    # ── Tax accounts ─────────────────────────────────────────────────────────
    {
        "role_key": "output_vat",
        "label": "Output VAT",
        "group": "tax",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "VAT collected on sales; remitted to FIRS. BS liability.",
    },
    {
        "role_key": "input_vat",
        "label": "Input VAT",
        "group": "tax",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "VAT paid on qualifying purchases; recoverable. BS asset.",
    },
    {
        "role_key": "wht_payable",
        "label": "Withholding Tax Payable",
        "group": "tax",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "WHT deducted from vendor/supplier payments; remittable to FIRS. BS liability.",
    },
    {
        "role_key": "wht_receivable",
        "label": "Withholding Tax Receivable",
        "group": "tax",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "WHT certificates received from customers; offset against tax liability. BS asset.",
    },
    {
        "role_key": "paye_payable",
        "label": "PAYE Payable",
        "group": "tax",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "PAYE deducted from employees' salaries; remittable to LIRS/FIRS. BS liability.",
    },
    {
        "role_key": "statutory_deductions",
        "label": "Statutory Deductions Payable (Pension / NHF / NSITF)",
        "group": "tax",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": (
            "Combined statutory payroll deductions payable (Pension, NHF, NSITF). "
            "v1: single account; per-levy split is FUTURE."
        ),
    },
    # ── Cash / bank ───────────────────────────────────────────────────────────
    {
        "role_key": "default_bank",
        "label": "Default Bank Account",
        "group": "cash_bank",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Primary operating bank account used when no specific bank is specified.",
    },
    {
        "role_key": "cash",
        "label": "Cash in Hand / Petty Cash",
        "group": "cash_bank",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Physical cash / petty cash float. BS current asset.",
    },
    {
        "role_key": "bdc_clearing",
        "label": "BDC Clearing Account",
        "group": "cash_bank",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Bureau de Change FX purchase clearing; settles to the bank account. BS.",
    },
    # ── Fixed assets / CAPEX ──────────────────────────────────────────────────
    {
        "role_key": "asset_clearing_cwip",
        "label": "Capital Work in Progress (CWIP)",
        "group": "fixed_assets",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Assets under construction/acquisition before transfer to fixed-asset accounts. BS.",
    },
    {
        "role_key": "accumulated_depreciation",
        "label": "Accumulated Depreciation",
        "group": "fixed_assets",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Contra asset: cumulative depreciation against tangible fixed assets. BS.",
    },
    {
        "role_key": "depreciation_expense",
        "label": "Depreciation Expense",
        "group": "fixed_assets",
        "expected_account_type": "PL",
        "is_control_account": False,
        "description": "Period depreciation charge posted to the income statement. PL.",
    },
    {
        "role_key": "asset_disposal",
        "label": "Asset Disposal / P&L on Disposal",
        "group": "fixed_assets",
        "expected_account_type": "PL",
        "is_control_account": False,
        "description": "Gain or loss on disposal of fixed assets. PL.",
    },
    # ── Inventory ─────────────────────────────────────────────────────────────
    {
        "role_key": "inventory_control",
        "label": "Inventory Control",
        "group": "inventory",
        "expected_account_type": "BS",
        "is_control_account": True,
        "description": "Inventory / stock sub-ledger control account. BS current asset.",
    },
    {
        "role_key": "grni",
        "label": "Goods Received Not Invoiced (GRNI)",
        "group": "inventory",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Accrual for goods received but not yet invoiced. BS current liability.",
    },
    {
        "role_key": "cogs",
        "label": "Cost of Goods Sold",
        "group": "inventory",
        "expected_account_type": "PL",
        "is_control_account": False,
        "description": "Cost of inventory sold / consumed. PL expense.",
    },
    # ── FX ────────────────────────────────────────────────────────────────────
    {
        "role_key": "fx_unrealised_gain_loss",
        "label": "FX Unrealised Gain / Loss",
        "group": "fx",
        "expected_account_type": "PL",
        "is_control_account": False,
        "description": "Unrealised FX movement on open monetary items at period end. PL.",
    },
    {
        "role_key": "fx_realised_gain_loss",
        "label": "FX Realised Gain / Loss",
        "group": "fx",
        "expected_account_type": "PL",
        "is_control_account": False,
        "description": "Realised FX gain or loss on settlement of foreign-currency transactions. PL.",
    },
    # ── Period-end ────────────────────────────────────────────────────────────
    {
        "role_key": "retained_earnings",
        "label": "Retained Earnings",
        "group": "period_end",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Accumulated retained earnings / accumulated deficit. BS equity.",
    },
    {
        "role_key": "current_year_earnings",
        "label": "Current Year Earnings",
        "group": "period_end",
        "expected_account_type": "BS",
        "is_control_account": False,
        "description": "Net profit/loss for the current fiscal year before year-end close. BS equity.",
    },
    # ── Suspense ──────────────────────────────────────────────────────────────
    {
        "role_key": "general_suspense",
        "label": "General Suspense",
        "group": "suspense",
        "expected_account_type": None,
        "is_control_account": False,
        "description": "Temporary holding account for unclassified postings pending investigation.",
    },
    {
        "role_key": "rounding_difference",
        "label": "Rounding Difference",
        "group": "suspense",
        "expected_account_type": None,
        "is_control_account": False,
        "description": "Absorbs sub-cent rounding differences to keep journals balanced.",
    },
]


def upgrade() -> None:
    # ── posting_roles ─────────────────────────────────────────────────────────
    op.create_table(
        "posting_roles",
        sa.Column("role_key", sa.String(60), primary_key=True),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("group", sa.String(50), nullable=False),
        sa.Column("expected_account_type", sa.String(10), nullable=True),
        sa.Column("expected_nature", sa.String(100), nullable=True),
        sa.Column("is_control_account", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_posting_roles_group", "posting_roles", ["group"])

    # ── Seed the catalogue ────────────────────────────────────────────────────
    posting_roles_t = sa.table(
        "posting_roles",
        sa.column("role_key", sa.String),
        sa.column("label", sa.String),
        sa.column("group", sa.String),
        sa.column("expected_account_type", sa.String),
        sa.column("expected_nature", sa.String),
        sa.column("is_control_account", sa.Boolean),
        sa.column("description", sa.Text),
    )
    op.bulk_insert(
        posting_roles_t,
        [
            {
                "role_key": r["role_key"],
                "label": r["label"],
                "group": r["group"],
                "expected_account_type": r.get("expected_account_type"),
                "expected_nature": None,  # not populated in v1
                "is_control_account": r.get("is_control_account", False),
                "description": r.get("description"),
            }
            for r in POSTING_ROLES
        ],
    )

    # ── tenant_account_mappings ───────────────────────────────────────────────
    op.create_table(
        "tenant_account_mappings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role_key",
            sa.String(60),
            sa.ForeignKey("posting_roles.role_key", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "gl_account_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chart_of_accounts.id"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("tenant_id", "role_key", name="uq_tam_tenant_role"),
    )
    op.create_index("ix_tam_tenant_id", "tenant_account_mappings", ["tenant_id"])
    op.create_index("ix_tam_gl_account_id", "tenant_account_mappings", ["gl_account_id"])


def downgrade() -> None:
    op.drop_index("ix_tam_gl_account_id", table_name="tenant_account_mappings")
    op.drop_index("ix_tam_tenant_id", table_name="tenant_account_mappings")
    op.drop_table("tenant_account_mappings")

    op.drop_index("ix_posting_roles_group", table_name="posting_roles")
    op.drop_table("posting_roles")
