"""harden accounting_periods uniqueness to start_date, not fiscal_year label

Revision ID: k7l8m9n0o1p2
Revises: j6k7l8m9n0o1
Create Date: 2026-06-28

The previous unique constraint was (tenant_id, fiscal_year, period_no).
fiscal_year is a *formatted display label* derived from fiscal_year_name_format
+ fiscal_year_start_month (see _build_fy_label in routers/setup.py). Changing
either setting after periods already exist produces a new label string that
does not collide with the old one under that constraint -- which let the
auto-generation triggers (PATCH /api/setup/org and hard-close roll-forward)
silently create a second, fully duplicate set of periods for the same months
under the new label.

start_date is the one identity a period actually has that never changes once
generated. Constraining on (tenant_id, start_date) makes duplicate periods for
the same date range impossible at the database level, independent of any
label/format/start-month change, present or future.

IMPORTANT: run `python -m scripts.cleanup_duplicate_periods --apply` BEFORE
this migration if any tenant currently has duplicate period sets -- this
upgrade will fail with an IntegrityError otherwise.
"""

from alembic import op

revision = "k7l8m9n0o1p2"
down_revision = "j6k7l8m9n0o1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_accounting_periods_tenant_year_no",
        "accounting_periods",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_accounting_periods_tenant_start_date",
        "accounting_periods",
        ["tenant_id", "start_date"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_accounting_periods_tenant_start_date",
        "accounting_periods",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_accounting_periods_tenant_year_no",
        "accounting_periods",
        ["tenant_id", "fiscal_year", "period_no"],
    )
