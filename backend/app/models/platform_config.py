"""
Platform-level configuration model.

Stores key/value pairs that apply globally across the entire Ziva BI
installation — not scoped to any tenant.  Editable only by super-admins via
the SA Portal → Platform Settings page.

Current keys:
    app_name    — The product name shown on login pages, emails, sidebar, and
                  document headers.  Changing this here renames the product
                  everywhere with no code deployment needed.

Adding a new setting:
    1. Add a migration that INSERTs the new key into platform_config.
    2. Expose it via GET /api/app-config (public) if needed by unauthenticated
       pages, or via GET /api/platform/config (SA only) for internal settings.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PlatformConfig(Base):
    """
    Single-row-per-key store for platform-wide configuration.

    Primary key is the key string itself (e.g. 'app_name') — no surrogate
    ID needed since keys are human-defined and stable.

    Example usage:
        row = await db.get(PlatformConfig, "app_name")
        print(row.value)   # → "Ziva BI"
    """

    __tablename__ = "platform_config"

    key: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
        comment="Config key (e.g. 'app_name')",
    )
    value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Config value",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Human-readable description of this setting",
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Super admin who last updated this setting",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="When this setting was last updated",
    )
