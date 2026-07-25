"""M10 — AI Engine: OCR receipt scanning infrastructure.

Revision ID: b0c1d2e3f4g5
Revises: a9b0c1d2e3f4
Create Date: 2026-07-25

Changes:
    1. tenant_expense_config — add ocr_enabled BOOL NOT NULL DEFAULT TRUE
    2. New table: ai_predictions   — audit trail for every AI action (AI Engine PRD §12)
    3. New table: ai_learning_overrides — stores finance override decisions for M20 learning loop

These tables are the AI Engine foundation. M10 populates ai_predictions on every OCR call.
M20 will populate ai_learning_overrides and build the learning feedback loop on top.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b0c1d2e3f4g5"
down_revision: str = "a9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. tenant_expense_config: add ocr_enabled ─────────────────────────────
    op.add_column(
        "tenant_expense_config",
        sa.Column("ocr_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    # ── 2. ai_predictions ─────────────────────────────────────────────────────
    op.create_table(
        "ai_predictions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # Type of AI action: 'ocr', 'classify', 'duplicate', 'fraud', etc.
        sa.Column("prediction_type", sa.Text(), nullable=False),
        # FK to expense_documents if the prediction was triggered by a document.
        # Nullable: some predictions don't link to a stored document.
        sa.Column(
            "source_document_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("expense_documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # SHA-256 hash of the input (image bytes) for dedup/replay protection.
        sa.Column("input_hash", sa.Text(), nullable=True),
        # Model identifier, e.g. "claude-haiku-4-5-20251001"
        sa.Column("ocr_model", sa.Text(), nullable=True),
        # Full structured prediction result as JSONB.
        sa.Column("prediction_json", sa.JSON(), nullable=False),
        # Overall confidence float 0.0000–1.0000 (NULL when not applicable).
        sa.Column("confidence_overall", sa.Numeric(5, 4), nullable=True),
        # NULL = user has not acted; True = accepted as-is; False = overridden.
        sa.Column("accepted", sa.Boolean(), nullable=True),
        # Processing time in milliseconds (informational).
        sa.Column("processing_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── 3. ai_learning_overrides ──────────────────────────────────────────────
    op.create_table(
        "ai_learning_overrides",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "prediction_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("ai_predictions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Which field was overridden (e.g. "total_amount", "gl_account_id").
        sa.Column("field_name", sa.Text(), nullable=False),
        # The AI's original suggestion for this field.
        sa.Column("original_value", sa.JSON(), nullable=True),
        # What the user actually chose.
        sa.Column("override_value", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("ai_learning_overrides")
    op.drop_table("ai_predictions")
    op.drop_column("tenant_expense_config", "ocr_enabled")
