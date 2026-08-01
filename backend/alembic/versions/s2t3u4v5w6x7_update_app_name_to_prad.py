"""Data migration — update platform_config app_name from 'Ziva BI' to 'PRAD'.

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-08-01

The platform_config table was originally seeded with app_name = 'Ziva BI'
in migration u3v4w5x6y7z8 (2026-07-21). The product was rebranded to PRAD
before first customer launch. This migration corrects the seeded value in
the production database so the frontend displays 'PRAD' in the browser tab,
login page, sidebar, and emails without requiring a manual SA Portal edit.

Idempotent: only updates the row if the value is still 'Ziva BI'. Rows
already set to any other value (e.g. manually changed via SA Portal) are
left untouched.

Down: restores the old value ('Ziva BI') for rollback safety. Re-running
the SA Portal rename after downgrade will update it again.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "s2t3u4v5w6x7"
down_revision = "r1s2t3u4v5w6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Update app_name from 'Ziva BI' to 'PRAD'."""
    op.execute(
        """
        UPDATE platform_config
        SET value = 'PRAD'
        WHERE key = 'app_name'
          AND value = 'Ziva BI'
        """
    )


def downgrade() -> None:
    """Revert app_name back to 'Ziva BI'."""
    op.execute(
        """
        UPDATE platform_config
        SET value = 'Ziva BI'
        WHERE key = 'app_name'
          AND value = 'PRAD'
        """
    )
