"""m8_1_advanced_coa_dimensions_employees

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-05-24

Milestone 8.1: Advanced CoA, Dimensions & Employee Foundation.

New columns on existing tables:
    tenant_dimensions:
        accepted_value_types  TEXT nullable — comma-separated accepted value_type strings

    dimension_values:
        value_type            VARCHAR(100) nullable — free-text type tag for filtering
        cascade_dimension_id  UUID FK → tenant_dimensions(id) SET NULL nullable
        cascade_value_id      UUID FK → dimension_values(id) SET NULL nullable
        valid_from            DATE nullable — value is active from this date
        valid_to              DATE nullable — value is active until this date

    chart_of_accounts:
        gl_group              VARCHAR(100) nullable — top-level GL hierarchy grouping
        gl_subgroup           VARCHAR(100) nullable — second level grouping
        gl_sub_subgroup       VARCHAR(100) nullable — third level grouping
        fs_head               VARCHAR(100) nullable — financial statement head line
        fs_note               VARCHAR(100) nullable — financial statement note reference
        tb_mapping            VARCHAR(100) nullable — trial balance grouping
        group_account_number  VARCHAR(50)  nullable — parent group GL number
        group_account_name    VARCHAR(255) nullable — parent group GL name

New tables:
    employees               — employee master data
    employee_code_history   — tracks code changes
    employee_transfers      — tracks cost center transfers
    cost_center_config      — cost center head assignment
    finance_review_config   — finance reviewer configuration
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tenant_dimensions: accepted_value_types ───────────────────────────────
    op.add_column("tenant_dimensions", sa.Column("accepted_value_types", sa.Text, nullable=True))

    # ── dimension_values: M8.1 fields ─────────────────────────────────────────
    op.add_column("dimension_values", sa.Column("value_type", sa.String(100), nullable=True))
    op.add_column(
        "dimension_values",
        sa.Column(
            "cascade_dimension_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenant_dimensions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "dimension_values",
        sa.Column(
            "cascade_value_id",
            UUID(as_uuid=True),
            sa.ForeignKey("dimension_values.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("dimension_values", sa.Column("valid_from", sa.Date, nullable=True))
    op.add_column("dimension_values", sa.Column("valid_to", sa.Date, nullable=True))

    # ── chart_of_accounts: M8.1 hierarchy + FS + group fields ─────────────────
    op.add_column("chart_of_accounts", sa.Column("gl_group", sa.String(100), nullable=True))
    op.add_column("chart_of_accounts", sa.Column("gl_subgroup", sa.String(100), nullable=True))
    op.add_column("chart_of_accounts", sa.Column("gl_sub_subgroup", sa.String(100), nullable=True))
    op.add_column("chart_of_accounts", sa.Column("fs_head", sa.String(100), nullable=True))
    op.add_column("chart_of_accounts", sa.Column("fs_note", sa.String(100), nullable=True))
    op.add_column("chart_of_accounts", sa.Column("tb_mapping", sa.String(100), nullable=True))
    op.add_column("chart_of_accounts", sa.Column("group_account_number", sa.String(50), nullable=True))
    op.add_column("chart_of_accounts", sa.Column("group_account_name", sa.String(255), nullable=True))

    # ── employees ─────────────────────────────────────────────────────────────
    op.create_table(
        "employees",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_code", sa.String(100), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("other_name", sa.String(100), nullable=True),
        sa.Column("preferred_name", sa.String(100), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("cost_center_id", UUID(as_uuid=True), sa.ForeignKey("dimension_values.id", ondelete="SET NULL"), nullable=True),
        sa.Column("line_manager_id", UUID(as_uuid=True), nullable=True),  # self-ref added below
        sa.Column("resumption_date", sa.Date, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("employee_code_auto_generated", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "employee_code", name="uq_employee_code_per_tenant"),
        sa.UniqueConstraint("tenant_id", "email", name="uq_employee_email_per_tenant"),
    )
    op.create_index("ix_employees_tenant_id", "employees", ["tenant_id"])
    # Self-referential FK added after table creation
    op.create_foreign_key(
        "fk_employees_line_manager",
        "employees", "employees",
        ["line_manager_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── employee_code_history ─────────────────────────────────────────────────
    op.create_table(
        "employee_code_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("old_code", sa.String(100), nullable=True),
        sa.Column("new_code", sa.String(100), nullable=False),
        sa.Column("change_type", sa.String(20), nullable=True),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("changed_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_employee_code_history_employee_id", "employee_code_history", ["employee_id"])

    # ── employee_transfers ────────────────────────────────────────────────────
    op.create_table(
        "employee_transfers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_cost_center_id", UUID(as_uuid=True), sa.ForeignKey("dimension_values.id", ondelete="SET NULL"), nullable=True),
        sa.Column("to_cost_center_id", UUID(as_uuid=True), sa.ForeignKey("dimension_values.id", ondelete="SET NULL"), nullable=True),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("transferred_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_employee_transfers_employee_id", "employee_transfers", ["employee_id"])

    # ── cost_center_config ────────────────────────────────────────────────────
    op.create_table(
        "cost_center_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cost_center_id", UUID(as_uuid=True), sa.ForeignKey("dimension_values.id", ondelete="CASCADE"), nullable=False),
        sa.Column("head_employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("head_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "cost_center_id", name="uq_cost_center_config_per_tenant"),
    )

    # ── finance_review_config ─────────────────────────────────────────────────
    op.create_table(
        "finance_review_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("reviewer_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("review_level", sa.Integer, nullable=False, server_default="1"),
        sa.Column("cost_center_id", UUID(as_uuid=True), sa.ForeignKey("dimension_values.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_finance_review_config_tenant_id", "finance_review_config", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("finance_review_config")
    op.drop_table("cost_center_config")
    op.drop_table("employee_transfers")
    op.drop_table("employee_code_history")
    op.drop_foreign_key_constraint("fk_employees_line_manager", "employees")
    op.drop_table("employees")

    for col in ["group_account_name", "group_account_number", "tb_mapping",
                "fs_note", "fs_head", "gl_sub_subgroup", "gl_subgroup", "gl_group"]:
        op.drop_column("chart_of_accounts", col)

    for col in ["valid_to", "valid_from", "cascade_value_id", "cascade_dimension_id", "value_type"]:
        op.drop_column("dimension_values", col)

    op.drop_column("tenant_dimensions", "accepted_value_types")
