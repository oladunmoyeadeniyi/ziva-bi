"""m8_intelligent_form_foundation

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-05-23

Milestone 8: Intelligent Expense Form Foundation.

New tables:
    tenant_dimensions          — financial dimensions per tenant
    dimension_values           — master data values for each dimension
    chart_of_accounts          — GL accounts (P&L and Balance Sheet)
    gl_dimension_requirements  — per GL account, per dimension: required/optional/na
    category_gl_mappings       — maps a subcategory to one or more GL accounts

Modified tables:
    tenant_expense_config:
        - remove gl_coding_mode VARCHAR
        - add coding_level INTEGER NOT NULL DEFAULT 0
        - add show_location BOOLEAN DEFAULT true
        - add require_location BOOLEAN DEFAULT false
    expense_categories:
        - widen code column VARCHAR(50) → VARCHAR(100)
        - fill missing codes from name
        - make code NOT NULL
        - drop name-based unique indexes
        - add code-based unique indexes per level
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. tenant_dimensions ────────────────────────────────────────────────────
    op.create_table(
        "tenant_dimensions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("is_required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_tenant_dimensions_tenant_id", "tenant_dimensions", ["tenant_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_tenant_dimensions_code
            ON tenant_dimensions (tenant_id, code)
            WHERE is_active = true
        """
    )

    # ── 2. dimension_values ─────────────────────────────────────────────────────
    op.create_table(
        "dimension_values",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dimension_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenant_dimensions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_dimension_values_tenant_id", "dimension_values", ["tenant_id"])
    op.create_index("ix_dimension_values_dimension_id", "dimension_values", ["dimension_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_dimension_values_code
            ON dimension_values (tenant_id, dimension_id, code)
            WHERE is_active = true
        """
    )

    # ── 3. chart_of_accounts ────────────────────────────────────────────────────
    op.create_table(
        "chart_of_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("gl_number", sa.String(50), nullable=False),
        sa.Column("gl_name", sa.String(255), nullable=False),
        sa.Column("account_type", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
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
    op.create_index("ix_chart_of_accounts_tenant_id", "chart_of_accounts", ["tenant_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_chart_of_accounts_gl_number
            ON chart_of_accounts (tenant_id, gl_number)
            WHERE is_active = true
        """
    )

    # ── 4. gl_dimension_requirements ───────────────────────────────────────────
    op.create_table(
        "gl_dimension_requirements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "gl_id",
            UUID(as_uuid=True),
            sa.ForeignKey("chart_of_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dimension_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenant_dimensions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requirement", sa.String(20), nullable=False),
        sa.UniqueConstraint("gl_id", "dimension_id", name="uq_gl_dimension_req"),
    )
    op.create_index("ix_gl_dimension_req_tenant_id", "gl_dimension_requirements", ["tenant_id"])
    op.create_index("ix_gl_dimension_req_gl_id", "gl_dimension_requirements", ["gl_id"])
    op.create_index("ix_gl_dimension_req_dim_id", "gl_dimension_requirements", ["dimension_id"])

    # ── 5. category_gl_mappings ─────────────────────────────────────────────────
    op.create_table(
        "category_gl_mappings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            UUID(as_uuid=True),
            sa.ForeignKey("expense_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "gl_id",
            UUID(as_uuid=True),
            sa.ForeignKey("chart_of_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.UniqueConstraint("category_id", "gl_id", name="uq_category_gl_mapping"),
    )
    op.create_index("ix_category_gl_mappings_tenant_id", "category_gl_mappings", ["tenant_id"])
    op.create_index("ix_category_gl_mappings_category_id", "category_gl_mappings", ["category_id"])
    op.create_index("ix_category_gl_mappings_gl_id", "category_gl_mappings", ["gl_id"])

    # ── 6. tenant_expense_config changes ────────────────────────────────────────
    # Remove gl_coding_mode, add coding_level / show_location / require_location
    op.drop_column("tenant_expense_config", "gl_coding_mode")
    op.add_column(
        "tenant_expense_config",
        sa.Column("coding_level", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column(
        "tenant_expense_config",
        sa.Column("show_location", sa.Boolean, nullable=False, server_default="true"),
    )
    op.add_column(
        "tenant_expense_config",
        sa.Column("require_location", sa.Boolean, nullable=False, server_default="false"),
    )

    # ── 7. expense_categories: widen code, fill nulls, make NOT NULL ────────────
    # Widen from VARCHAR(50) to VARCHAR(100) first (safe, no lock on most PG versions)
    op.alter_column("expense_categories", "code", type_=sa.String(100), nullable=True)

    # Generate codes for rows that have none (lowercase, underscores from name)
    op.execute(
        """
        UPDATE expense_categories
           SET code = lower(regexp_replace(trim(name), '[^a-z0-9]+', '_', 'gi'))
         WHERE code IS NULL OR code = ''
        """
    )
    # Handle duplicate codes within same scope by appending row number
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   code,
                   row_number() OVER (PARTITION BY tenant_id, parent_id, code ORDER BY created_at) AS rn
              FROM expense_categories
        )
        UPDATE expense_categories ec
           SET code = r.code || '_' || r.rn
          FROM ranked r
         WHERE ec.id = r.id
           AND r.rn > 1
        """
    )

    op.alter_column("expense_categories", "code", nullable=False)

    # Drop old name-based unique indexes
    op.execute("DROP INDEX IF EXISTS uq_expense_categories_top_level")
    op.execute("DROP INDEX IF EXISTS uq_expense_categories_sub_level")

    # Add code-based unique indexes (active rows only, handling NULL parent_id correctly)
    op.execute(
        """
        CREATE UNIQUE INDEX uq_expense_categories_code_top
            ON expense_categories (tenant_id, code)
            WHERE parent_id IS NULL AND is_active = true
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_expense_categories_code_sub
            ON expense_categories (tenant_id, parent_id, code)
            WHERE parent_id IS NOT NULL AND is_active = true
        """
    )


def downgrade() -> None:
    # expense_categories: revert code changes
    op.execute("DROP INDEX IF EXISTS uq_expense_categories_code_sub")
    op.execute("DROP INDEX IF EXISTS uq_expense_categories_code_top")
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
    op.alter_column("expense_categories", "code", type_=sa.String(50), nullable=True)

    # tenant_expense_config: revert
    op.drop_column("tenant_expense_config", "require_location")
    op.drop_column("tenant_expense_config", "show_location")
    op.drop_column("tenant_expense_config", "coding_level")
    op.add_column(
        "tenant_expense_config",
        sa.Column("gl_coding_mode", sa.String(50), nullable=False, server_default="employee"),
    )

    # Drop M8 tables
    op.drop_index("ix_category_gl_mappings_gl_id", table_name="category_gl_mappings")
    op.drop_index("ix_category_gl_mappings_category_id", table_name="category_gl_mappings")
    op.drop_index("ix_category_gl_mappings_tenant_id", table_name="category_gl_mappings")
    op.drop_table("category_gl_mappings")

    op.drop_index("ix_gl_dimension_req_dim_id", table_name="gl_dimension_requirements")
    op.drop_index("ix_gl_dimension_req_gl_id", table_name="gl_dimension_requirements")
    op.drop_index("ix_gl_dimension_req_tenant_id", table_name="gl_dimension_requirements")
    op.drop_table("gl_dimension_requirements")

    op.execute("DROP INDEX IF EXISTS uq_chart_of_accounts_gl_number")
    op.drop_index("ix_chart_of_accounts_tenant_id", table_name="chart_of_accounts")
    op.drop_table("chart_of_accounts")

    op.execute("DROP INDEX IF EXISTS uq_dimension_values_code")
    op.drop_index("ix_dimension_values_dimension_id", table_name="dimension_values")
    op.drop_index("ix_dimension_values_tenant_id", table_name="dimension_values")
    op.drop_table("dimension_values")

    op.execute("DROP INDEX IF EXISTS uq_tenant_dimensions_code")
    op.drop_index("ix_tenant_dimensions_tenant_id", table_name="tenant_dimensions")
    op.drop_table("tenant_dimensions")
