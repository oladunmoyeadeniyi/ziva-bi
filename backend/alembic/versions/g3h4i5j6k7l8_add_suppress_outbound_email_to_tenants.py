"""add suppress_outbound_email to tenants

Revision ID: g3h4i5j6k7l8
Revises: f2g3h4i5j6k7
Create Date: 2026-06-21

Adds suppress_outbound_email (BOOLEAN NOT NULL DEFAULT true) to the tenants table.

Schema-readiness for Phase 4 email suppression in test environments.
When True (the default), notification emails should be suppressed for that tenant.
Wiring into the SMTP sender is a follow-up change once the feature is fully designed.

Default is True so that all existing tenants — including test shadows created before
this migration — have the flag set to the safe value (suppress by default).
Callers can set it to False for live tenants where emails should flow normally.
"""

from alembic import op
import sqlalchemy as sa

revision = "g3h4i5j6k7l8"
down_revision = "f2g3h4i5j6k7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "suppress_outbound_email",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "suppress_outbound_email")
