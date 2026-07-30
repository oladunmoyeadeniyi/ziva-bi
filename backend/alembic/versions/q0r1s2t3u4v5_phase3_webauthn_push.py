"""Phase 3 — WebAuthn credentials and Push subscriptions.

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Create Date: 2026-07-30

Adds two tables that form the Phase 3 PWA auth infrastructure:

    user_credentials      — WebAuthn passkey/biometric credential store
                            One row per registered device per user.
                            sign_count is a monotonically-increasing counter
                            used to detect credential cloning (replay attacks).

    push_subscriptions    — VAPID Web Push endpoint registry
                            One row per browser/app subscription per user.
                            Stores the W3C Push API objects needed to send
                            encrypted push messages via pywebpush.

Both tables CASCADE DELETE when the parent user is removed so that orphaned
credentials and stale push endpoints are automatically cleaned up.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "q0r1s2t3u4v5"
down_revision = "p9q0r1s2t3u4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── user_credentials ──────────────────────────────────────────────────────
    # Stores WebAuthn public-key credentials registered by the user.
    # credential_id is the base64url-encoded credential ID returned by the
    # authenticator during registration; it is used to look up the credential
    # during authentication. public_key stores the COSE-encoded public key bytes.
    op.create_table(
        "user_credentials",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("credential_id", sa.Text, nullable=False, unique=True),
        sa.Column("public_key", sa.LargeBinary, nullable=False),
        sa.Column("sign_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("device_name", sa.Text, nullable=True),   # user-visible label, e.g. "iPhone 15 Pro"
        sa.Column("aaguid", sa.Text, nullable=True),         # authenticator type identifier
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_credentials_user_id", "user_credentials", ["user_id"])

    # ── push_subscriptions ────────────────────────────────────────────────────
    # Stores W3C Push API subscription objects for VAPID-encrypted push messages.
    # endpoint is the unique browser-issued URL; p256dh and auth are the
    # encryption keys required by the Web Push Protocol (RFC 8291).
    # app_name scopes the subscription to a specific PWA (e.g. 'ziva-expense')
    # so the push service can fan out to the correct app only.
    # UNIQUE(user_id, endpoint) prevents duplicate registrations for the same
    # browser tab / device; ON CONFLICT DO UPDATE lets the frontend re-subscribe
    # without accumulating stale rows.
    op.create_table(
        "push_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.Text, nullable=False),
        sa.Column("p256dh", sa.Text, nullable=False),
        sa.Column("auth", sa.Text, nullable=False),
        sa.Column("app_name", sa.Text, nullable=False),   # 'ziva-expense' | 'ziva-approve' | 'ziva-procure' | 'ziva-insights'
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "endpoint", name="uq_push_subscriptions_user_endpoint"),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    op.create_index("ix_push_subscriptions_user_app", "push_subscriptions", ["user_id", "app_name"])


def downgrade() -> None:
    op.drop_table("push_subscriptions")
    op.drop_table("user_credentials")
