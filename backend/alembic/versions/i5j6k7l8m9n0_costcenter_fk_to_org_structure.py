"""costcenter_fk_to_org_structure

Revision ID: i5j6k7l8m9n0
Revises: h4i5j6k7l8m9
Create Date: 2026-06-22

BRIEF: BRIEF_costcenter_orgstructure_sot.md

Makes org_structure the single source of truth for cost centers.
Previously, 5 columns on 4 tables FK-referenced dimension_values.id for cost
center storage. Cost centers are managed in org_structure (node_type='Cost center'),
so this migration re-points those FK constraints to org_structure.id instead.

Tables affected (all had 0 rows — clean swap, no data migration needed):
  employees.cost_center_id
  employee_transfers.from_cost_center_id
  employee_transfers.to_cost_center_id
  cost_center_config.cost_center_id
  finance_review_config.cost_center_id
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "i5j6k7l8m9n0"
down_revision = "h4i5j6k7l8m9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── employees.cost_center_id ──────────────────────────────────────────────
    op.drop_constraint(
        "employees_cost_center_id_fkey", "employees", type_="foreignkey"
    )
    op.create_foreign_key(
        "employees_cost_center_id_fkey",
        "employees", "org_structure",
        ["cost_center_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── employee_transfers.from_cost_center_id ────────────────────────────────
    op.drop_constraint(
        "employee_transfers_from_cost_center_id_fkey", "employee_transfers", type_="foreignkey"
    )
    op.create_foreign_key(
        "employee_transfers_from_cost_center_id_fkey",
        "employee_transfers", "org_structure",
        ["from_cost_center_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── employee_transfers.to_cost_center_id ──────────────────────────────────
    op.drop_constraint(
        "employee_transfers_to_cost_center_id_fkey", "employee_transfers", type_="foreignkey"
    )
    op.create_foreign_key(
        "employee_transfers_to_cost_center_id_fkey",
        "employee_transfers", "org_structure",
        ["to_cost_center_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── cost_center_config.cost_center_id ─────────────────────────────────────
    op.drop_constraint(
        "cost_center_config_cost_center_id_fkey", "cost_center_config", type_="foreignkey"
    )
    op.create_foreign_key(
        "cost_center_config_cost_center_id_fkey",
        "cost_center_config", "org_structure",
        ["cost_center_id"], ["id"],
        ondelete="CASCADE",
    )

    # ── finance_review_config.cost_center_id ──────────────────────────────────
    op.drop_constraint(
        "finance_review_config_cost_center_id_fkey", "finance_review_config", type_="foreignkey"
    )
    op.create_foreign_key(
        "finance_review_config_cost_center_id_fkey",
        "finance_review_config", "org_structure",
        ["cost_center_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Reverse: re-point all FKs back to dimension_values.id
    op.drop_constraint(
        "finance_review_config_cost_center_id_fkey", "finance_review_config", type_="foreignkey"
    )
    op.create_foreign_key(
        "finance_review_config_cost_center_id_fkey",
        "finance_review_config", "dimension_values",
        ["cost_center_id"], ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint(
        "cost_center_config_cost_center_id_fkey", "cost_center_config", type_="foreignkey"
    )
    op.create_foreign_key(
        "cost_center_config_cost_center_id_fkey",
        "cost_center_config", "dimension_values",
        ["cost_center_id"], ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "employee_transfers_to_cost_center_id_fkey", "employee_transfers", type_="foreignkey"
    )
    op.create_foreign_key(
        "employee_transfers_to_cost_center_id_fkey",
        "employee_transfers", "dimension_values",
        ["to_cost_center_id"], ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint(
        "employee_transfers_from_cost_center_id_fkey", "employee_transfers", type_="foreignkey"
    )
    op.create_foreign_key(
        "employee_transfers_from_cost_center_id_fkey",
        "employee_transfers", "dimension_values",
        ["from_cost_center_id"], ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint(
        "employees_cost_center_id_fkey", "employees", type_="foreignkey"
    )
    op.create_foreign_key(
        "employees_cost_center_id_fkey",
        "employees", "dimension_values",
        ["cost_center_id"], ["id"],
        ondelete="SET NULL",
    )
