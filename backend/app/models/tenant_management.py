"""
ZivaBI — tenant management ORM models (Milestone 5).

Tables:
    tenant_invitations  One row per outstanding invitation sent by a Tenant Admin.
                        Tracks the invite token, target email, role, and lifecycle status.

Invitation flow:
    Tenant Admin POSTs to /api/tenant/invitations → creates PENDING row, sends email.
    Recipient opens the accept link, validates the token, creates their account →
    invitation moves to ACCEPTED.
    Invitations not accepted within 48 hours have status EXPIRED (checked at validate time).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TenantInvitation(Base):
    """
    A pending or completed invitation for a new user to join a tenant.

    token is a cryptographically random URL-safe string used in the accept link.
    It is stored in plain text (it is not a secret credential — knowledge of the
    token grants the right to create a new account, not to access existing data).
    expires_at is set to 48 hours from creation; the validate endpoint enforces this.
    """

    __tablename__ = "tenant_invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
