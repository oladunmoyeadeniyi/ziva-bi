"""Add lead_status and implementation_notes to tenants.

Revision ID: j1k2l3m4n5o6
Revises: i2j3k4l5m6n7
Create Date: 2026-07-11

Why this exists:
    Three-Mode Architecture — Signup creates lifecycle_status='trial' tenants.
    The SA portal "Trials & signups" page lets consultants track and manage
    these inbound leads before activating implementation.

    lead_status tracks the consultant's outreach progress:
      new         — just signed up, not yet contacted
      contacted   — consultant has reached out
      qualified   — confirmed as a real prospect (worth activating)
      disqualified — not a fit, will not be activated

    implementation_notes is a free-text consultant scratchpad — call notes,
    company background, ERP they're currently using, etc. Never visible to
    the trial tenant user.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "j1k2l3m4n5o6"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add lead_status (VARCHAR 30, NOT NULL DEFAULT 'new') and
    implementation_notes (TEXT, nullable) to the tenants table.
    Both columns are harmless on existing rows — non-trial tenants
    will just have lead_status='new' and NULL notes forever.
    """
    op.add_column(
        "tenants",
        sa.Column(
            "lead_status",
            sa.String(30),
            nullable=False,
            server_default="new",
        ),
    )
    op.add_column(
        "tenants",
        sa.Column("implementation_notes", sa.Text, nullable=True),
    )
    # Index for the trials page filter query
    op.create_index(
        "ix_tenants_lead_status",
        "tenants",
        ["lead_status"],
    )


def downgrade() -> None:
    """Drop index and columns."""
    op.drop_index("ix_tenants_lead_status", table_name="tenants")
    op.drop_column("tenants", "implementation_notes")
    op.drop_column("tenants", "lead_status")
