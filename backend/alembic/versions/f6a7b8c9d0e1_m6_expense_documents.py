"""m6_expense_documents

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-21

Creates the expense_documents table for M6 supporting document attachments.
Files are stored in Supabase Storage; this table holds metadata + the bucket path.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expense_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_id", UUID(as_uuid=True), sa.ForeignKey("expense_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_id", UUID(as_uuid=True), sa.ForeignKey("expense_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("storage_path", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_expense_documents_tenant_id", "expense_documents", ["tenant_id"])
    op.create_index("ix_expense_documents_report_id", "expense_documents", ["report_id"])
    op.create_index("ix_expense_documents_line_id", "expense_documents", ["line_id"])


def downgrade() -> None:
    op.drop_index("ix_expense_documents_line_id", table_name="expense_documents")
    op.drop_index("ix_expense_documents_report_id", table_name="expense_documents")
    op.drop_index("ix_expense_documents_tenant_id", table_name="expense_documents")
    op.drop_table("expense_documents")
