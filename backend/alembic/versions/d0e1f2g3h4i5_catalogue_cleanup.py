"""Catalogue cleanup: remove bank/cash roles, add goods_in_transit, add is_relevant

Revision ID: d0e1f2g3h4i5
Revises: c9d0e1f2g3h4
Create Date: 2026-06-19

Changes:
1. Add is_relevant column to tenant_posting_role_settings
   (NULL = default relevant; False = tenant has hidden; True = explicit relevant).
   COSMETIC ONLY — does not affect resolve_account() or posting behaviour.

2. Remove default_bank + cash from posting_roles.
   Rationale: bank/cash accounts move to a dedicated Bank Accounts register
   (multiple per currency, future brief). They are accounts, not determination roles.
   Cleanup:
     tenant_account_mappings: 1 default_bank row + 1 cash row deleted (2 total)
     tenant_posting_role_settings: 1 default_bank row deleted (1 total)

3. Add goods_in_transit (BS / current_assets / inventory, display_order=65).
   is_control_account=False: goods-in-transit is a transient clearing/adjustment
   account, not a sub-ledger control account with a customer/vendor sub-ledger behind it.

Downgrade:
  - Drop is_relevant column.
  - Delete goods_in_transit from posting_roles.
  - Restore default_bank + cash (mapping rows already deleted — not restored).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

revision = "d0e1f2g3h4i5"
down_revision = "c9d0e1f2g3h4"
branch_labels = None
depends_on = None

REMOVED_KEYS = ["default_bank", "cash"]

GOODS_IN_TRANSIT = {
    "role_key": "goods_in_transit",
    "label": "Goods in Transit",
    "statement": "BS",
    "group": "current_assets",
    "subgroup": "inventory",
    "display_order": 65,
    "expected_account_type": "BS",
    "is_control_account": False,
    "description": (
        "Inventory in transit — goods shipped but not yet received at the destination. "
        "is_control_account=False: transient clearing account, not a sub-ledger control."
    ),
}


def upgrade() -> None:
    # ── 1. Add is_relevant to tenant_posting_role_settings ───────────────────
    op.add_column(
        "tenant_posting_role_settings",
        sa.Column("is_relevant", sa.Boolean(), nullable=True),
    )

    # ── 2. Clean up mapping/settings rows for removed roles ──────────────────
    # (Report: 2 mapping rows + 1 settings row — all deleted here.)
    keys_list = ", ".join(f"'{k}'" for k in REMOVED_KEYS)
    op.execute(f"DELETE FROM tenant_account_mappings WHERE role_key IN ({keys_list})")
    op.execute(f"DELETE FROM tenant_posting_role_settings WHERE role_key IN ({keys_list})")

    # ── 3. Remove default_bank + cash from posting_roles ─────────────────────
    op.execute(f"DELETE FROM posting_roles WHERE role_key IN ({keys_list})")

    # ── 4. Insert goods_in_transit ────────────────────────────────────────────
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
    r = GOODS_IN_TRANSIT
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


def downgrade() -> None:
    # Remove is_relevant column
    op.drop_column("tenant_posting_role_settings", "is_relevant")

    # Remove goods_in_transit
    op.execute("DELETE FROM posting_roles WHERE role_key = 'goods_in_transit'")

    # Restore default_bank + cash (mapping rows are not restored — already deleted)
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
    op.bulk_insert(roles_t, [
        {
            "role_key": "cash", "label": "Cash in Hand / Petty Cash",
            "statement": "BS", "group": "current_assets", "subgroup": "cash_bank",
            "display_order": 10, "expected_account_type": "BS",
            "expected_nature": None, "is_control_account": False,
            "description": "Physical cash / petty cash float.",
        },
        {
            "role_key": "default_bank", "label": "Default Bank Account",
            "statement": "BS", "group": "current_assets", "subgroup": "cash_bank",
            "display_order": 20, "expected_account_type": "BS",
            "expected_nature": None, "is_control_account": False,
            "description": "Primary operating bank account.",
        },
    ])
