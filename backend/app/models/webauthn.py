"""
PRAD — WebAuthn credential and Push subscription ORM models.

Tables:
    user_credentials    — passkey / biometric credential store; one row per
                          registered device per user. sign_count guards against
                          credential cloning (monotonic counter per RFC 8809).

    push_subscriptions  — VAPID Web Push endpoint registry; one row per
                          browser subscription per user per PWA app.

Both tables CASCADE DELETE from users — orphaned rows are impossible.

Why here (not in auth.py):
    auth.py already covers 10 models and is approaching the practical readability
    limit for a single file. WebAuthn and Push are Phase 3 infrastructure, not
    core auth primitives (no JWTs, no roles, no sessions), so they live separately.
    main.py and models/__init__.py import both files so everything is in scope.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserCredential(Base):
    """
    A WebAuthn passkey / biometric credential registered by a user.

    One row is created for each device the user enrolls (e.g. iPhone Touch ID,
    laptop Windows Hello, YubiKey). A user can have multiple credentials.

    credential_id   base64url-encoded credential ID returned by
                    navigator.credentials.create(); used as the lookup key
                    during authentication (passed in allowCredentials).

    public_key      COSE-encoded public key bytes stored as-is from the
                    attestation response. py_webauthn verifies signatures
                    against this value during authentication.

    sign_count      Monotonically increasing use counter maintained by the
                    authenticator. PRAD checks that each authentication
                    presents a count strictly greater than the stored value.
                    A lower or equal count indicates a cloned credential and
                    triggers revocation of all active sessions.

    device_name     User-supplied label (e.g. "iPhone 15 Pro", "Work laptop").
                    Displayed on the Manage Devices screen so users can
                    identify and remove individual credentials.

    aaguid          Authenticator AAGUID — identifies the authenticator model
                    (Touch ID, Face ID, YubiKey 5 series, etc.). Not used for
                    security decisions; stored for audit/analytics.

    Example usage:
        cred = UserCredential(
            user_id=user.id,
            credential_id="<base64url>",
            public_key=b"<COSE bytes>",
            sign_count=0,
            device_name="iPhone 15 Pro",
        )
    """

    __tablename__ = "user_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    credential_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    public_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    device_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    aaguid: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_user_credentials_user_id", "user_id"),
    )


class PushSubscription(Base):
    """
    A Web Push subscription for one user on one PWA app.

    Created when the browser calls pushManager.subscribe() and the frontend
    POSTs the resulting PushSubscriptionJSON to POST /api/push/subscribe.

    endpoint    Browser-issued push service URL. Unique per browser session.
                Used as the target URL by pywebpush when sending a message.

    p256dh      ECDH public key (base64url) used to encrypt the push payload.

    auth        Authentication secret (base64url) — part of the Web Push
                encryption scheme (RFC 8291 §3.4).

    app_name    Which PWA app the subscription belongs to:
                'ziva-expense' | 'ziva-approve' | 'ziva-procure' | 'ziva-insights'
                push_service.send_push() filters by (user_id, app_name) so that
                approval notifications go to Ziva Approve, not Ziva Expense.

    UNIQUE(user_id, endpoint): prevents duplicate rows for the same browser tab.
    The push router uses INSERT ... ON CONFLICT DO UPDATE so re-subscribing
    after a browser update refreshes p256dh/auth without creating duplicates.

    Example usage:
        sub = PushSubscription(
            user_id=user.id,
            endpoint="https://fcm.googleapis.com/...",
            p256dh="<base64url>",
            auth="<base64url>",
            app_name="ziva-approve",
        )
    """

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    app_name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("user_id", "endpoint", name="uq_push_subscriptions_user_endpoint"),
        Index("ix_push_subscriptions_user_id", "user_id"),
        Index("ix_push_subscriptions_user_app", "user_id", "app_name"),
    )
