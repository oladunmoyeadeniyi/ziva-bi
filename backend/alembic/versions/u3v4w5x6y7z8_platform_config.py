"""Add platform_config table — single source of truth for platform-level settings.

Revision ID: u3v4w5x6y7z8
Revises: t2u3v4w5x6y7
Create Date: 2026-07-21

Key/value store for platform-wide settings editable by super-admins via the
SA Portal → Platform Settings page.  No tenant scoping — these values apply
globally across the entire installation.

Initial seed:
    app_name = 'Ziva BI'   — displayed on login pages, emails, sidebar, and
                             document headers.  Update from SA Portal to rename
                             the product without any code deployment.

Down: drops the table entirely (data is lost; re-seeding happens on next upgrade).
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "u3v4w5x6y7z8"
down_revision = "t2u3v4w5x6y7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create platform_config and seed initial values."""
    op.create_table(
        "platform_config",
        sa.Column("key", sa.String(100), primary_key=True, comment="Config key (e.g. 'app_name')"),
        sa.Column("value", sa.Text(), nullable=False, comment="Config value"),
        sa.Column("description", sa.Text(), nullable=True, comment="Human-readable description of this setting"),
        sa.Column(
            "updated_by",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="Super admin who last updated this setting",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="When this setting was last updated",
        ),
    )

    # Seed initial values
    op.execute(
        """
        INSERT INTO platform_config (key, value, description) VALUES
        (
            'app_name',
            'Ziva BI',
            'The application name displayed throughout the platform — on login pages, emails, sidebar, and document headers. Change this from the SA Portal to rename the product instantly with no code deployment.'
        )
        """
    )


def downgrade() -> None:
    """Drop platform_config (data is not preserved)."""
    op.drop_table("platform_config")
