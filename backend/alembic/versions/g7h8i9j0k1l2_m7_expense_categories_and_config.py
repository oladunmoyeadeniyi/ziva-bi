"""m7_expense_categories_and_config

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-22

Creates two new tables for M7 — Expense Categories & GL Coding Mode:
  - expense_categories:      tenant-scoped category/subcategory tree with optional GL suggestion
  - tenant_expense_config:   per-tenant GL coding mode and form behaviour flags

Modifies expense_lines:
  - adds category_id (FK → expense_categories, nullable)
  - adds subcategory_id (FK → expense_categories, nullable)
  - makes gl_account nullable so Finance-mode reports can omit GL at submission time
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── expense_categories ──────────────────────────────────────────────────
    # Must be created before expense_lines FK columns are added.
    op.create_table(
        "expense_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=True),
        sa.Column(
            "parent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("expense_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("gl_account_suggestion", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_expense_categories_tenant_id", "expense_categories", ["tenant_id"])
    op.create_index("ix_expense_categories_parent_id", "expense_categories", ["parent_id"])

    # Two partial unique indexes handle the NULL parent_id case correctly.
    # Standard UNIQUE on (tenant_id, name, parent_id) would allow duplicate top-level
    # categories because PostgreSQL treats NULL != NULL in unique checks.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_expense_categories_top_level
            ON expense_categories (tenant_id, name)
            WHERE parent_id IS NULL AND is_active = true
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_expense_categories_sub_level
            ON expense_categories (tenant_id, name, parent_id)
            WHERE parent_id IS NOT NULL AND is_active = true
        """
    )

    # ── tenant_expense_config ───────────────────────────────────────────────
    op.create_table(
        "tenant_expense_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("gl_coding_mode", sa.String(50), nullable=False, server_default="employee"),
        sa.Column("require_category", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("require_subcategory", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("allow_free_text_description", sa.Boolean, nullable=False, server_default="true"),
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
    )
    op.create_index(
        "ix_tenant_expense_config_tenant_id", "tenant_expense_config", ["tenant_id"]
    )

    # ── expense_lines additions ─────────────────────────────────────────────
    op.add_column(
        "expense_lines",
        sa.Column(
            "category_id",
            UUID(as_uuid=True),
            sa.ForeignKey("expense_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "expense_lines",
        sa.Column(
            "subcategory_id",
            UUID(as_uuid=True),
            sa.ForeignKey("expense_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    # Make gl_account nullable: Finance-mode tenants leave it blank at submission;
    # Finance team fills it in during the review/approval step.
    op.alter_column("expense_lines", "gl_account", nullable=True)


def downgrade() -> None:
    op.alter_column("expense_lines", "gl_account", nullable=False)
    op.drop_column("expense_lines", "subcategory_id")
    op.drop_column("expense_lines", "category_id")

    op.drop_index("ix_tenant_expense_config_tenant_id", table_name="tenant_expense_config")
    op.drop_table("tenant_expense_config")

    op.execute("DROP INDEX IF EXISTS uq_expense_categories_sub_level")
    op.execute("DROP INDEX IF EXISTS uq_expense_categories_top_level")
    op.drop_index("ix_expense_categories_parent_id", table_name="expense_categories")
    op.drop_index("ix_expense_categories_tenant_id", table_name="expense_categories")
    op.drop_table("expense_categories")
