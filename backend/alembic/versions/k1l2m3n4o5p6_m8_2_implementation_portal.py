"""m8_2_implementation_portal

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-05-25

Milestone 8.2: Implementation Portal Redesign.

New columns on existing tables:
    user_tenants:
        role_tier                 VARCHAR(50) nullable — 'consultant' | 'power_admin' | 'functional_admin'

    tenant_dimensions:
        locked_by_implementation  BOOLEAN NOT NULL default false

    chart_of_accounts:
        locked_by_implementation  BOOLEAN NOT NULL default false

    tenant_expense_config:
        locked_by_implementation  BOOLEAN NOT NULL default false

New tables:
    implementation_locks  — consultant-locked sections per tenant
    tenant_modules        — activated modules per tenant
    document_rules        — required documents per module/transaction type
    tenant_tax_config     — tax configuration (VAT, WHT, PAYE, other statutory)
    tenant_fx_config      — FX rates and revaluation configuration
    tenant_org_config     — organisation identity, structure, branding, fiscal year
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── user_tenants: role_tier ────────────────────────────────────────────────
    op.add_column(
        "user_tenants",
        sa.Column("role_tier", sa.String(50), nullable=True),
    )

    # ── tenant_dimensions: locked_by_implementation ───────────────────────────
    op.add_column(
        "tenant_dimensions",
        sa.Column(
            "locked_by_implementation",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
    )

    # ── chart_of_accounts: locked_by_implementation ───────────────────────────
    op.add_column(
        "chart_of_accounts",
        sa.Column(
            "locked_by_implementation",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
    )

    # ── tenant_expense_config: locked_by_implementation ──────────────────────
    op.add_column(
        "tenant_expense_config",
        sa.Column(
            "locked_by_implementation",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
    )

    # ── implementation_locks ──────────────────────────────────────────────────
    op.create_table(
        "implementation_locks",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section", sa.String(100), nullable=False),
        sa.Column(
            "locked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.Column(
            "locked_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_implementation_locks_tenant_id", "implementation_locks", ["tenant_id"]
    )

    # ── tenant_modules ────────────────────────────────────────────────────────
    op.create_table(
        "tenant_modules",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("module_key", sa.String(50), nullable=False),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="false"
        ),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "activated_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "tenant_id", "module_key", name="uq_tenant_modules_tenant_module"
        ),
    )
    op.create_index(
        "ix_tenant_modules_tenant_id", "tenant_modules", ["tenant_id"]
    )

    # ── document_rules ────────────────────────────────────────────────────────
    op.create_table(
        "document_rules",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("transaction_type", sa.String(100), nullable=False),
        sa.Column("document_name", sa.String(255), nullable=False),
        sa.Column(
            "is_required", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column(
            "track_expiry", sa.Boolean, nullable=False, server_default="false"
        ),
        sa.Column("ocr_template", sa.String(50), nullable=True),
        sa.Column(
            "max_size_mb", sa.Integer, nullable=False, server_default="10"
        ),
        sa.Column(
            "allowed_formats",
            ARRAY(sa.Text),
            nullable=True,
        ),
        sa.Column(
            "max_files", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_document_rules_tenant_id", "document_rules", ["tenant_id"]
    )

    # ── tenant_tax_config ─────────────────────────────────────────────────────
    op.create_table(
        "tenant_tax_config",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("vat_config", JSONB, nullable=True),
        sa.Column("wht_config", JSONB, nullable=True),
        sa.Column("paye_config", JSONB, nullable=True),
        sa.Column("other_statutory", JSONB, nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_tenant_tax_config_tenant_id", "tenant_tax_config", ["tenant_id"]
    )

    # ── tenant_fx_config ──────────────────────────────────────────────────────
    op.create_table(
        "tenant_fx_config",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("functional_currency", sa.String(3), nullable=True),
        sa.Column("reporting_currency", sa.String(3), nullable=True),
        sa.Column("additional_currencies", JSONB, nullable=True),
        sa.Column("fx_rates", JSONB, nullable=True),
        sa.Column("revaluation_rules", JSONB, nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_tenant_fx_config_tenant_id", "tenant_fx_config", ["tenant_id"]
    )

    # ── tenant_org_config ─────────────────────────────────────────────────────
    op.create_table(
        "tenant_org_config",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("legal_name", sa.String(255), nullable=True),
        sa.Column("rc_number", sa.String(100), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("group_structure", sa.String(50), nullable=True),
        sa.Column("parent_company_name", sa.String(255), nullable=True),
        sa.Column("tin", sa.String(100), nullable=True),
        sa.Column("vat_reg_number", sa.String(100), nullable=True),
        sa.Column("functional_currency", sa.String(3), nullable=True),
        sa.Column("reporting_currency", sa.String(3), nullable=True),
        sa.Column("fiscal_year_start_month", sa.Integer, nullable=True),
        sa.Column("fiscal_year_start_day", sa.Integer, nullable=True),
        sa.Column("period_frequency", sa.String(20), nullable=True),
        sa.Column("org_structure", JSONB, nullable=True),
        sa.Column("branding", JSONB, nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_tenant_org_config_tenant_id", "tenant_org_config", ["tenant_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_tenant_org_config_tenant_id", table_name="tenant_org_config")
    op.drop_table("tenant_org_config")

    op.drop_index("ix_tenant_fx_config_tenant_id", table_name="tenant_fx_config")
    op.drop_table("tenant_fx_config")

    op.drop_index("ix_tenant_tax_config_tenant_id", table_name="tenant_tax_config")
    op.drop_table("tenant_tax_config")

    op.drop_index("ix_document_rules_tenant_id", table_name="document_rules")
    op.drop_table("document_rules")

    op.drop_index("ix_tenant_modules_tenant_id", table_name="tenant_modules")
    op.drop_table("tenant_modules")

    op.drop_index(
        "ix_implementation_locks_tenant_id", table_name="implementation_locks"
    )
    op.drop_table("implementation_locks")

    op.drop_column("tenant_expense_config", "locked_by_implementation")
    op.drop_column("chart_of_accounts", "locked_by_implementation")
    op.drop_column("tenant_dimensions", "locked_by_implementation")
    op.drop_column("user_tenants", "role_tier")
