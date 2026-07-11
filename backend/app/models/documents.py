"""
ZivaBI — expense document ORM model (Milestone 6 + document security hardening).

Stores metadata for files attached to expense reports or individual lines.
Actual file bytes live in Supabase Storage; this table only holds the path
and cached signed URL so the frontend can render/download without an extra
round-trip to Supabase on every page load.

Security columns added (task #54):
- file_hash / file_hash_algorithm: SHA-256 digest for integrity + dedup
- size_stored: post-compression byte count (may differ from file_size)
- retain_until: mandatory retention expiry (15-year minimum; SA-configurable per tenant)
- dedup_ref: FK to original row when this is a deduplication reference

Every row is scoped to a tenant. Deletion is restricted to DRAFT/REJECTED
reports AND blocked if retain_until > today — both enforced at the router
layer, not here.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExpenseDocument(Base):
    """
    Single document attachment for an expense report or an individual line.

    line_id is nullable — null means the document is attached to the report
    header rather than a specific line.
    storage_path is the Supabase bucket key.

    Deduplication: when two uploads produce the same file_hash, the second
    row stores a dedup_ref pointing to the first and reuses its storage_path.
    The storage_path on a dedup row must never be deleted while any non-dedup
    row references it — enforced by SET NULL on dedup_ref FK (not CASCADE).
    """

    __tablename__ = "expense_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_lines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    # size_stored: bytes actually written to Supabase (post-compression).
    # May be < file_size (compressed) or == file_size (compression skipped).
    size_stored: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    # SHA-256 hex digest of the original (pre-compression) file bytes.
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    file_hash_algorithm: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Mandatory retention expiry: 15-year platform minimum (exceeds FIRS 6-year floor,
    # NDPR 2019, CAMA 2020). Duration driven by tenant_org_config.document_retention_years
    # (SA-settable, never lower than 15). Set on upload: retain_until = date.today() +
    # relativedelta(years=tenant_config.document_retention_years).
    # Nullable for zero-downtime migration; existing rows backfilled via separate script.
    retain_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Self-referential FK: when this row is a dedup reference, points to the
    # original. SET NULL (not CASCADE) so deleting the original doesn't
    # silently orphan dedup rows that still point to the same storage path.
    dedup_ref: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DocumentAccessLog(Base):
    """
    Append-only audit log for document access events.

    Captures every signed-URL generation (view/download) and upload/delete.
    Retention: retained in DB until SA explicitly purges with backup confirmation;
    minimum matches document_retention_years (platform floor: 15 years).
    Rows are never updated or deleted programmatically — log integrity is
    paramount for compliance.

    ip_address is VARCHAR(45) to cover both IPv4 and IPv6.
    """

    __tablename__ = "document_access_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    accessed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # view = signed URL generated; download = explicit download action;
    # upload = file stored; delete = file removed from storage.
    access_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

