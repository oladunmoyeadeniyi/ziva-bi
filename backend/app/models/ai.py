"""
PRAD — AI Engine ORM models (M10+).

Defines the ai_predictions and ai_learning_overrides tables that form the
audit and learning backbone for the AI Engine Module (AI_Engine_Module_PRD.md).

ai_predictions:
    One row per AI API call. Every call to /api/ai/ocr (and future /api/ai/classify,
    /api/ai/detect-duplicate, etc.) writes a prediction row so the full AI decision
    history is auditable by Finance and auditors.

ai_learning_overrides:
    Populated when a Finance reviewer overrides an AI suggestion via POST /api/ai/override.
    M20 will read these rows to fine-tune tenant-specific prediction behaviour.
    The table is created in M10 as a stub; it starts receiving data immediately
    whenever any user overrides an OCR-extracted field.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AIPrediction(Base):
    """
    Audit record for a single AI Engine prediction call.

    One row is inserted for every successful call to any /api/ai/* endpoint.
    The prediction_type field discriminates between OCR, classify, duplicate,
    fraud, etc. so a single table covers the whole AI Engine feature surface.

    Parameters
    ----------
    id : UUID PK
    tenant_id : FK → tenants (CASCADE delete — purged with tenant)
    user_id : FK → users (SET NULL on user delete — prediction survives)
    prediction_type : str — 'ocr' | 'classify' | 'duplicate' | 'fraud' | etc.
    source_document_id : optional FK → expense_documents
    input_hash : SHA-256 of the raw input bytes (for dedup detection)
    ocr_model : model identifier, e.g. 'claude-haiku-4-5-20251001'
    prediction_json : full JSON result from the AI service
    confidence_overall : aggregate confidence float (0.0–1.0)
    accepted : None = not yet acted on; True = accepted; False = overridden
    processing_ms : wall-clock latency of the AI call in milliseconds
    created_at : auto-set to now()

    Relationships
    -------------
    overrides → list[AILearningOverride] — all field-level overrides for this prediction
    """

    __tablename__ = "ai_predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    prediction_type: Mapped[str] = mapped_column(Text, nullable=False)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expense_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    input_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    prediction_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence_overall: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4), nullable=True
    )
    accepted: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    processing_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    overrides: Mapped[list["AILearningOverride"]] = relationship(
        "AILearningOverride", back_populates="prediction", cascade="all, delete-orphan"
    )


class AILearningOverride(Base):
    """
    Records a Finance reviewer's correction of an AI field prediction.

    Created via POST /api/ai/override when a user accepts a different value
    than what the AI suggested. These rows are the training signal for M20's
    learning loop: once enough overrides accumulate, the tenant-specific model
    can be fine-tuned to reduce the override rate.

    Parameters
    ----------
    id : UUID PK
    prediction_id : FK → ai_predictions (CASCADE delete)
    tenant_id : FK → tenants (CASCADE delete)
    user_id : FK → users (SET NULL on delete)
    field_name : which field was overridden (e.g. 'total_amount', 'description')
    original_value : JSONB — what the AI suggested
    override_value : JSONB — what the user chose instead
    created_at : auto-set to now()

    Relationships
    -------------
    prediction → AIPrediction — the prediction this override corrects
    """

    __tablename__ = "ai_learning_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    prediction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_predictions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    field_name: Mapped[str] = mapped_column(Text, nullable=False)
    original_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    override_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    prediction: Mapped["AIPrediction"] = relationship(
        "AIPrediction", back_populates="overrides"
    )


class AiInsight(Base):
    """
    A structured AI-generated insight for a tenant.

    M20 generates these via three analyses:
      ANOMALY            — statistical outliers in expenses, AP invoices, etc.
      SPENDING_PATTERN   — trend summaries and spend-by-category breakdowns
      CASH_FLOW_FORECAST — projected cash position over future periods
      CATEGORY_SUGGESTION — recommended GL account / cost centre for a transaction

    Tenants review, dismiss, or action each insight via the UI.
    """

    __tablename__ = "ai_insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    insight_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    severity: Mapped[str] = mapped_column(Text, nullable=False, server_default="INFO")
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="PENDING")
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
