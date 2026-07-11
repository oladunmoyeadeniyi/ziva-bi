"""Document security hardening — expense_documents columns + document_access_log.

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
Create Date: 2026-07-11

Why this exists:
    Task #54 — Document Security Hardening per BRIEF_document_storage_security.md.

    Adds to expense_documents:
    - file_hash (VARCHAR 64, nullable): SHA-256 hex digest of original file bytes.
      Nullable so existing rows survive migration without a full-table backfill.
    - file_hash_algorithm (VARCHAR 10, nullable): algorithm label ('sha256').
    - size_stored (INTEGER, nullable): bytes written to Supabase post-compression.
      May differ from file_size once the compression pipeline (task #55) runs.
    - retain_until (DATE, nullable): mandatory retention expiry. Minimum 15 years
      per Ziva BI policy (exceeds FIRS 6-year floor, NDPR 2019, and CAMA 2020).
      Per-tenant duration driven by tenant_org_config.document_retention_years (SA-set).
      Nullable for zero-downtime migration; set on all new uploads from task #55 onward.
      Existing rows left null — a one-off backfill script can be run separately if legal require it.
    - dedup_ref (UUID, nullable, FK → expense_documents.id SET NULL): when a new
      upload's hash matches an existing document in the same tenant, we store a
      reference rather than upload a duplicate blob. SET NULL (not CASCADE) is
      deliberate: deleting an original document must never cascade-null storage_path
      on the surviving dedup rows that still point at the same Supabase key.

    Composite partial index on (tenant_id, file_hash) WHERE file_hash IS NOT NULL:
    optimises the dedup lookup query (WHERE tenant_id = X AND file_hash = Y) while
    keeping index size small — pre-migration rows with NULL hash are excluded.

    Creates document_access_log:
    Append-only audit table for all document access events (view/download/upload/
    delete). Retained in DB indefinitely (purge is gated by the backup confirmation
    flow; minimum 15 years aligns with document_retention_years floor).
    CASCADE on document_id: if a document is hard-deleted its access log is
    irrelevant — the financial audit trail lives in audit_logs / journal_entries.
    SET NULL on accessed_by: user deletions must not destroy compliance log rows.

Security classification: TIER 3 — schema change on financial document table.
Needs human sign-off before touching a production DB with real documents.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ── Revision IDs ────────────────────────────────────────────────────────────
revision = "k2l3m4n5o6p7"
down_revision = "j1k2l3m4n5o6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add document security columns + create document_access_log table."""

    # ── expense_documents: security columns ───────────────────────────────────
    op.add_column(
        "expense_documents",
        sa.Column("file_hash", sa.String(64), nullable=True),
    )
    op.add_column(
        "expense_documents",
        sa.Column("file_hash_algorithm", sa.String(10), nullable=True),
    )
    op.add_column(
        "expense_documents",
        sa.Column("size_stored", sa.Integer(), nullable=True),
    )
    op.add_column(
        "expense_documents",
        sa.Column("retain_until", sa.Date(), nullable=True),
    )
    # dedup_ref: add column first, then FK separately (Alembic convention).
    op.add_column(
        "expense_documents",
        sa.Column("dedup_ref", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_expense_documents_dedup_ref",
        "expense_documents",   # source table
        "expense_documents",   # referent table (self-referential)
        ["dedup_ref"],
        ["id"],
        ondelete="SET NULL",   # NOT CASCADE — see module docstring
    )
    # Partial composite index: fast dedup lookup, excludes pre-migration NULLs.
    op.create_index(
        "ix_expense_documents_tenant_file_hash",
        "expense_documents",
        ["tenant_id", "file_hash"],
        postgresql_where=sa.text("file_hash IS NOT NULL"),
    )

    # ── tenant_org_config: document retention duration (SA-configurable) ───────
    # 15 years is the platform minimum; SA can raise it per tenant (never lower it).
    # Used in task #55 upload handler: retain_until = today + relativedelta(years=N).
    op.add_column(
        "tenant_org_config",
        sa.Column(
            "document_retention_years",
            sa.Integer(),
            nullable=False,
            server_default="15",
        ),
    )

    # ── document_access_log: create table ────────────────────────────────────
    op.create_table(
        "document_access_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "accessed_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "accessed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        # view | download | upload | delete
        sa.Column("access_type", sa.String(20), nullable=False),
        # VARCHAR(45) covers both IPv4 (15 chars) and IPv6 (39 chars).
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["expense_documents.id"],
            ondelete="CASCADE",
            name="fk_access_log_document_id",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
            name="fk_access_log_tenant_id",
        ),
        sa.ForeignKeyConstraint(
            ["accessed_by"],
            ["users.id"],
            ondelete="SET NULL",   # user deletion must not destroy log rows
            name="fk_access_log_accessed_by",
        ),
    )
    # Three targeted indexes for the common query patterns:
    # - "show me all accesses for document X" (audit / compliance view)
    # - "show me all doc accesses for tenant Y" (tenant admin audit)
    # - "show me accesses in date range Z" (periodic compliance report)
    op.create_index(
        "ix_document_access_log_document_id",
        "document_access_log",
        ["document_id"],
    )
    op.create_index(
        "ix_document_access_log_tenant_id",
        "document_access_log",
        ["tenant_id"],
    )
    op.create_index(
        "ix_document_access_log_accessed_at",
        "document_access_log",
        ["accessed_at"],
    )


def downgrade() -> None:
    """Remove document_access_log table and document security columns."""
    # Drop table first (no dependents).
    op.drop_index("ix_document_access_log_accessed_at", table_name="document_access_log")
    op.drop_index("ix_document_access_log_tenant_id", table_name="document_access_log")
    op.drop_index("ix_document_access_log_document_id", table_name="document_access_log")
    op.drop_table("document_access_log")

    # Drop tenant_org_config addition.
    op.drop_column("tenant_org_config", "document_retention_years")

    # Drop expense_documents additions (FK and index before columns).
    op.drop_index("ix_expense_documents_tenant_file_hash", table_name="expense_documents")
    op.drop_constraint("fk_expense_documents_dedup_ref", "expense_documents", type_="foreignkey")
    op.drop_column("expense_documents", "dedup_ref")
    op.drop_column("expense_documents", "retain_until")
    op.drop_column("expense_documents", "size_stored")
    op.drop_column("expense_documents", "file_hash_algorithm")
    op.drop_column("expense_documents", "file_hash")
