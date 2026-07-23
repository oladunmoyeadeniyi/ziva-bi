"""Add password_reset_tokens table (P2 — email/forgot-password flow).

Revision ID: w5x6y7z8a9b0
Revises: v4w5x6y7z8a9
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "w5x6y7z8a9b0"
down_revision = "v4w5x6y7z8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create password_reset_tokens.

    token_hash stores the SHA-256 hex digest of the raw token sent to the user
    so a DB breach cannot be used to hijack ongoing resets.

    One active token per user — enforced in application code (old tokens are
    invalidated before inserting a new one).
    """
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_password_reset_tokens_token_hash",
        "password_reset_tokens",
        ["token_hash"],
    )
    op.create_index(
        "ix_password_reset_tokens_user_id",
        "password_reset_tokens",
        ["user_id"],
    )


def downgrade() -> None:
    """Drop the table — data loss is expected and acceptable on downgrade."""
    op.drop_index("ix_password_reset_tokens_token_hash", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
