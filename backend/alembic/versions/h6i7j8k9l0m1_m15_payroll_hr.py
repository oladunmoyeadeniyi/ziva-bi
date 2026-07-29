"""m15_payroll_hr

Revision ID: h6i7j8k9l0m1
Revises: g5h6i7j8k9l0
Create Date: 2026-07-28 13:30:00.000000

M15 — Payroll & HR.

Creates:
  salary_structures   — per-employee component breakdown (effective-dated)
  payroll_runs        — a payroll processing run (monthly batch)
  payroll_lines       — one line per employee per run (gross/net/deductions)
  payslips            — payslip records issued to employees
  leave_types         — leave categories per tenant (Annual, Sick, Maternity, etc.)
  leave_requests      — individual leave applications
  leave_balances      — per-employee per-year balance tracking

Three-mode:
  Lite     — payroll run + manual payment + CSV export
  Connected — + posting_batches for salary GL
  Full ERP  — + salary journal entry (DR salary expense / CR bank)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "h6i7j8k9l0m1"
down_revision = "g5h6i7j8k9l0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── salary_structures ─────────────────────────────────────────────────
    op.create_table(
        "salary_structures",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("basic", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("housing", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("transport", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("meal_allowance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("other_allowances", JSONB, nullable=True),    # [{"name": "Airtime", "amount": 5000}]
        sa.Column("gross_pay", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("gl_salary_expense_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_salary_structures_employee", "salary_structures", ["employee_id"])
    op.create_index("ix_salary_structures_tenant", "salary_structures", ["tenant_id"])

    # ── payroll_runs ──────────────────────────────────────────────────────
    op.create_table(
        "payroll_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference", sa.String(30), nullable=False),   # PAY-2025-001
        sa.Column("run_date", sa.Date, nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("total_gross", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_paye", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_pension_employee", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_pension_employer", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_net", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("posting_mode", sa.String(20), nullable=True),
        sa.Column("journal_entry_id", UUID(as_uuid=True), sa.ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("posting_batch_id", UUID(as_uuid=True), sa.ForeignKey("posting_batches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("paid_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('DRAFT','APPROVED','PAID','CANCELLED')", name="ck_payroll_run_status"),
        sa.UniqueConstraint("tenant_id", "reference", name="uq_payroll_run_reference"),
    )
    op.create_index("ix_payroll_runs_tenant_id", "payroll_runs", ["tenant_id"])
    op.create_index("ix_payroll_runs_period", "payroll_runs", ["tenant_id", "period_start"])

    # ── payroll_lines ─────────────────────────────────────────────────────
    op.create_table(
        "payroll_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("salary_structure_id", UUID(as_uuid=True), sa.ForeignKey("salary_structures.id", ondelete="SET NULL"), nullable=True),
        sa.Column("basic", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("housing", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("transport", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("other_allowances", JSONB, nullable=True),
        sa.Column("gross_pay", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("paye", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("pension_employee", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("pension_employer", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("health_insurance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("other_deductions", JSONB, nullable=True),
        sa.Column("total_deductions", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("net_pay", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("payment_status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("payment_reference", sa.String(100), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("payment_status IN ('PENDING','PAID','HELD')", name="ck_payroll_line_payment_status"),
    )
    op.create_index("ix_payroll_lines_run_id", "payroll_lines", ["run_id"])
    op.create_index("ix_payroll_lines_employee_id", "payroll_lines", ["employee_id"])

    # ── payslips ──────────────────────────────────────────────────────────
    op.create_table(
        "payslips",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payroll_line_id", UUID(as_uuid=True), sa.ForeignKey("payroll_lines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("reference", sa.String(50), nullable=False),
        sa.Column("payslip_date", sa.Date, nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("gross_pay", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_deductions", sa.Numeric(18, 2), nullable=False),
        sa.Column("net_pay", sa.Numeric(18, 2), nullable=False),
        sa.Column("issued_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "reference", name="uq_payslip_reference"),
    )
    op.create_index("ix_payslips_employee_id", "payslips", ["employee_id"])
    op.create_index("ix_payslips_run_id", "payslips", ["run_id"])

    # ── leave_types ───────────────────────────────────────────────────────
    op.create_table(
        "leave_types",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("days_per_year", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("carry_forward", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("max_carry_forward_days", sa.Numeric(5, 1), nullable=True),
        sa.Column("requires_approval", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_paid", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "code", name="uq_leave_type_code"),
    )
    op.create_index("ix_leave_types_tenant_id", "leave_types", ["tenant_id"])

    # ── leave_requests ────────────────────────────────────────────────────
    op.create_table(
        "leave_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", UUID(as_uuid=True), sa.ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("days_requested", sa.Numeric(5, 1), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("approved_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('PENDING','APPROVED','REJECTED','CANCELLED')", name="ck_leave_request_status"),
    )
    op.create_index("ix_leave_requests_employee_id", "leave_requests", ["employee_id"])
    op.create_index("ix_leave_requests_tenant_id", "leave_requests", ["tenant_id"])

    # ── leave_balances ────────────────────────────────────────────────────
    op.create_table(
        "leave_balances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", UUID(as_uuid=True), sa.ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("allocated", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("taken", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("pending", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("carried_forward", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("remaining", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "employee_id", "leave_type_id", "year", name="uq_leave_balance"),
    )
    op.create_index("ix_leave_balances_employee_id", "leave_balances", ["employee_id"])


def downgrade() -> None:
    op.drop_table("leave_balances")
    op.drop_table("leave_requests")
    op.drop_table("leave_types")
    op.drop_table("payslips")
    op.drop_table("payroll_lines")
    op.drop_table("payroll_runs")
    op.drop_table("salary_structures")
