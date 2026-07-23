"""Add password_reset_tokens table (P2 — email/forgot-password flow).

Revision ID: w5x6y7z8a9b0
Revises: v4w5x6y7z8a9

Rewritten to use IF NOT EXISTS throughout so the migration is idempotent.
The original version had `index=True` on the user_id column inside
create_table, which causes Alembic to create ix_password_reset_tokens_user_id
as part of the table DDL; the subsequent explicit op.create_index then fails
with DuplicateTableError on a retry (e.g. a second deploy after a partial
first run).  Using raw SQL avoids this problem entirely.
"""

from __future__ import annotations

import sqlalchemy as sa

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

    Uses IF NOT EXISTS on every DDL statement so the migration is safe to
    re-run if a previous deploy was interrupted after partial execution.
    """
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id          UUID PRIMARY KEY,
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash  VARCHAR(64) NOT NULL UNIQUE,
            expires_at  TIMESTAMPTZ NOT NULL,
            used_at     TIMESTAMPTZ,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))

    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id "
        "ON password_reset_tokens (user_id)"
    ))

    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash "
        "ON password_reset_tokens (token_hash)"
    ))


def downgrade() -> None:
    """Drop the table — data loss is expected and acceptable on downgrade."""
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS password_reset_tokens"))
