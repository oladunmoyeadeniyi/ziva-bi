"""Reporting & Analytics ORM models.

Currently contains a single table:
  saved_reports — user-saved report definitions that can be re-run on demand.

Pre-built report execution (expense summary, AR aging, etc.) is stateless and
requires no DB tables — the router queries the relevant source tables directly.

Table: saved_reports
Migration: v5w6x7y8z9a0_reporting
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class SavedReport(Base):
    """A user-saved report definition.

    Stores the report type + filter parameters so the user can re-run it
    without re-specifying all parameters. Execution is always fresh (no
    cached results are stored here).

    Attributes:
        tenant_id:    Scopes the report to a single tenant.
        name:         User-provided label shown in the report list.
        description:  Optional longer explanation of what this report covers.
        report_type:  Slug matching a built-in report type.
        module:       Which functional module this report belongs to.
        filters:      JSONB blob of filter parameters (date range, etc.).
        is_shared:    If True, all admin users in the tenant can see and run it.
        created_by:   User who created this definition.
        last_run_at:  Timestamp of the last execution (updated on each run).
    """

    __tablename__ = "saved_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_type: Mapped[str] = mapped_column(String(60), nullable=False)
    module: Mapped[str] = mapped_column(String(40), nullable=False)
    filters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_shared: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    last_run_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
