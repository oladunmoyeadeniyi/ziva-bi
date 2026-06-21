"""
ZivaBI — Bank Account register model.

Replaces the removed default_bank/cash posting roles with a proper per-tenant
master-data register of bank and cash accounts (multiple per currency).

Design decisions:
- currency stored as ISO 4217 3-letter code (e.g. "NGN", "USD") — consistent with
  TenantFxConfig which stores currencies as codes, not FK rows.
- gl_account_id links to a Balance Sheet GL; multiple accounts may share one GL
  (no uniqueness constraint on gl_account_id).
- is_default: at most one True per (tenant_id, currency), enforced in app logic
  (setting new default unsets the previous). No partial unique index — app logic
  is simpler and sufficient for v1.
- bank_account_id on JournalLine (in gl.py) is nullable; tagging is for future
  reconciliation tooling — it does NOT change posting behaviour.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BankAccount(Base):
    """
    One tenant bank or cash account entry.

    May share a GL account with other bank accounts (e.g. all USD accounts post
    to the same "Bank — USD" GL, distinguished by bank_account_id on lines).
    """

    __tablename__ = "bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_number: Mapped[str] = mapped_column(String(100), nullable=False)

    # ISO 4217 currency code (e.g. "NGN", "USD") — stored as code, not FK.
    currency: Mapped[str] = mapped_column(String(3), nullable=False, index=True)

    # The GL this account posts to (must be BS / SOFP). Multiple accounts may share a GL.
    gl_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id"),  # no CASCADE — preserve account if GL archived
        nullable=False,
        index=True,
    )

    # Only one is_default per (tenant_id, currency) — enforced in application logic.
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
