"""m8_2_fixes_org_modules_dims_employees

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-05-25

M8.2 Fixes & Enhancements migration.

New tables:
    org_structure                  — hierarchical org nodes (legal entities, divisions, depts, cost centers)
    fiscal_periods                 — auto-generated fiscal periods per tenant
    employee_onboarding_tokens     — secure self-onboarding links for new hires

New columns on tenants:
    dimensions_not_applicable      BOOLEAN DEFAULT false
    documents_setup_complete       BOOLEAN DEFAULT false
    module_setup_visited           JSONB (tracks which module setup pages have been saved)

New columns on tenant_modules:
    is_licensed                    BOOLEAN DEFAULT false

New columns on tenant_org_config:
    date_of_registration           DATE
    commencement_date              DATE
    company_type                   VARCHAR(100)
    registered_address             TEXT
    operating_address              TEXT
    company_phone                  VARCHAR(50)
    company_email                  VARCHAR(255)
    website                        VARCHAR(500)
    external_auditor               VARCHAR(255)
    authorised_share_capital       NUMERIC(20,2)
    fiscal_year_start_day          INTEGER
    fiscal_year_name_format        VARCHAR(50)
    period_closing_frequency       VARCHAR(20)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


# revision identifiers, used by Alembic
revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── New table: org_structure ──────────────────────────────────────────────
    op.create_table(
        "org_structure",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("org_structure.id"), nullable=True),
        sa.Column("node_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("cost_center_code", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("tenant_id", "code", name="uq_org_structure_tenant_code"),
    )
    op.create_index("ix_org_structure_tenant_id", "org_structure", ["tenant_id"])

    # ── New table: fiscal_periods ─────────────────────────────────────────────
    op.create_table(
        "fiscal_periods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_year", sa.String(20), nullable=False),
        sa.Column("period_name", sa.String(50), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("tenant_id", "fiscal_year", "period_name", name="uq_fiscal_periods_tenant_year_period"),
    )
    op.create_index("ix_fiscal_periods_tenant_id", "fiscal_periods", ["tenant_id"])

    # ── New table: employee_onboarding_tokens ─────────────────────────────────
    op.create_table(
        "employee_onboarding_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(255), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_employee_onboarding_tokens_token", "employee_onboarding_tokens", ["token"])
    op.create_index("ix_employee_onboarding_tokens_tenant_id", "employee_onboarding_tokens", ["tenant_id"])

    # ── New columns on tenants ────────────────────────────────────────────────
    op.add_column("tenants", sa.Column("dimensions_not_applicable", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("tenants", sa.Column("documents_setup_complete", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("tenants", sa.Column("module_setup_visited", JSONB, nullable=True))

    # ── New column on tenant_modules ──────────────────────────────────────────
    op.add_column("tenant_modules", sa.Column("is_licensed", sa.Boolean, nullable=False, server_default="false"))

    # ── New columns on tenant_org_config ─────────────────────────────────────
    # Note: fiscal_year_start_day, period_frequency, org_structure already added in k1l2m3n4o5p6
    op.add_column("tenant_org_config", sa.Column("date_of_registration", sa.Date, nullable=True))
    op.add_column("tenant_org_config", sa.Column("commencement_date", sa.Date, nullable=True))
    op.add_column("tenant_org_config", sa.Column("company_type", sa.String(100), nullable=True))
    op.add_column("tenant_org_config", sa.Column("registered_address", sa.Text, nullable=True))
    op.add_column("tenant_org_config", sa.Column("operating_address", sa.Text, nullable=True))
    op.add_column("tenant_org_config", sa.Column("company_phone", sa.String(50), nullable=True))
    op.add_column("tenant_org_config", sa.Column("company_email", sa.String(255), nullable=True))
    op.add_column("tenant_org_config", sa.Column("website", sa.String(500), nullable=True))
    op.add_column("tenant_org_config", sa.Column("external_auditor", sa.String(255), nullable=True))
    op.add_column("tenant_org_config", sa.Column("authorised_share_capital", sa.Numeric(20, 2), nullable=True))
    op.add_column("tenant_org_config", sa.Column("fiscal_year_name_format", sa.String(50), nullable=True))
    op.add_column("tenant_org_config", sa.Column("period_closing_frequency", sa.String(20), nullable=True))


def downgrade() -> None:
    # Remove tenant_org_config columns (only the ones added in this migration)
    for col in [
        "date_of_registration", "commencement_date", "company_type",
        "registered_address", "operating_address", "company_phone",
        "company_email", "website", "external_auditor",
        "authorised_share_capital", "fiscal_year_name_format",
        "period_closing_frequency",
    ]:
        op.drop_column("tenant_org_config", col)

    # Remove tenant_modules column
    op.drop_column("tenant_modules", "is_licensed")

    # Remove tenants columns
    op.drop_column("tenants", "module_setup_visited")
    op.drop_column("tenants", "documents_setup_complete")
    op.drop_column("tenants", "dimensions_not_applicable")

    # Drop tables
    op.drop_index("ix_employee_onboarding_tokens_tenant_id", "employee_onboarding_tokens")
    op.drop_index("ix_employee_onboarding_tokens_token", "employee_onboarding_tokens")
    op.drop_table("employee_onboarding_tokens")

    op.drop_index("ix_fiscal_periods_tenant_id", "fiscal_periods")
    op.drop_table("fiscal_periods")

    op.drop_index("ix_org_structure_tenant_id", "org_structure")
    op.drop_table("org_structure")
