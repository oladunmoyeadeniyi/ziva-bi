"""Profile backend: TOTP 2FA columns on users

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
Create Date: 2026-06-18

Additive, fully reversible. Adds two columns to the users table:

  totp_secret   — String(64), nullable. Base32 TOTP secret, set during enroll,
                  cleared on disable. Encryption-at-rest is future hardening.
  totp_enabled  — Boolean, default false. Set to true only after verify confirms
                  the user has successfully scanned and entered a valid code.

No data tables or session tables are modified.
"""

from alembic import op
import sqlalchemy as sa

revision = "z6a7b8c9d0e1"
down_revision = "y5z6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.String(64), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "totp_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
