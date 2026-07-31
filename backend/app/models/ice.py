"""
PRAD — Intelligent Categorization Engine (ICE) ORM models.

ICE is PRAD's AI brain for financial classification. It learns from
historical GL selections, vendor patterns, and employee behaviour to suggest
GL accounts, dimensions, and expense categories with confidence scores.

ICE NEVER posts, NEVER approves, NEVER overrides. It only suggests.
Humans always have the final decision.

Tables:
    ice_tenant_config          — per-tenant AI enable flag + thresholds
    vendor_behavior_profiles   — learned per-vendor GL/category patterns
    employee_behavior_profiles — learned per-employee GL patterns
    ice_predictions            — one row per prediction made by the engine
    ice_feedback               — corrections captured from users (training signal)
    ice_audit_log              — immutable append-only AI event log

Connects to:
    - tenants, users (FK)
    - chart_of_accounts (soft ref via gl_number/gl_name denormalized)
    - expense_lines (soft ref via expense_line_id — no hard FK to avoid coupling)

Security:
    Every table carries tenant_id. No cross-tenant queries are permitted anywhere
    in the ICE service layer.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IceTenantConfig(Base):
    """
    ICE configuration for a single tenant.

    One row per tenant. Created on first ICE config request (lazy creation).
    Tenant Admin can update: ai_enabled, enabled_fields, thresholds,
    sensitive_gl_accounts, allow_user_disable.

    Attributes:
        ai_enabled: Master switch. ICE only runs when True AND platform ICE is enabled.
        enabled_fields: JSONB dict controlling which field types ICE may suggest.
            Example: {"gl": true, "cost_center": true, "category": true}
        confidence_threshold_high: Integer 0-100. Predictions at or above this are "HIGH".
        confidence_threshold_low: Integer 0-100. Predictions below this are "LOW".
        sensitive_gl_accounts: JSONB list of GL account IDs ICE must never suggest.
        allow_user_disable: If True, employees may disable AI suggestions for their account.
    """

    __tablename__ = "ice_tenant_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    ai_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enabled_fields: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=lambda: {"gl": True, "cost_center": True, "category": True}
    )
    confidence_threshold_high: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=80)
    confidence_threshold_low: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=50)
    sensitive_gl_accounts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    allow_user_disable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class VendorBehaviorProfile(Base):
    """
    Aggregated GL and category usage patterns per vendor per tenant.

    Built incrementally from accepted ICE predictions and user corrections.
    The most frequent GL for a vendor becomes the top candidate for the next
    prediction involving that vendor.

    Attributes:
        vendor_name: Normalised vendor name (lowercased, stripped).
        gl_frequency: JSONB dict {gl_account_id: hit_count}.
        category_frequency: JSONB dict {category_name: hit_count}.
        sample_count: Total number of transactions used to build this profile.
    """

    __tablename__ = "vendor_behavior_profiles"
    __table_args__ = (UniqueConstraint("tenant_id", "vendor_name", name="uq_vendor_profile_tenant_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    vendor_name: Mapped[str] = mapped_column(Text, nullable=False)
    gl_frequency: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    category_frequency: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EmployeeBehaviorProfile(Base):
    """
    Aggregated GL and category usage patterns per employee (user) per tenant.

    Built the same way as VendorBehaviorProfile but keyed on user_id.
    Employee patterns are a secondary signal — vendor patterns take precedence
    when both are available and vendor confidence is high.

    Attributes:
        user_id: FK to users.id. Identifies the employee.
        gl_frequency: JSONB dict {gl_account_id: hit_count}.
        category_frequency: JSONB dict {category_name: hit_count}.
        sample_count: Total transactions used to build this profile.
    """

    __tablename__ = "employee_behavior_profiles"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", name="uq_employee_profile_tenant_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    gl_frequency: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    category_frequency: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class IcePrediction(Base):
    """
    One row per ICE prediction — the full record of what the engine suggested.

    Written by the ICE service on every POST /api/ai/ice/predict call.
    The `accepted` field is updated by the feedback endpoint (None = no response yet).

    Attributes:
        expense_line_id: Soft FK to expense line (no hard FK — avoids coupling).
        predicted_gl_id: UUID of the suggested GL account.
        predicted_gl_number: Denormalized GL code (e.g. "642100") for display.
        predicted_gl_name: Denormalized GL name for display.
        predicted_category: Suggested expense category (e.g. "Travel").
        predicted_dimensions: JSONB dict of suggested dimensions.
        confidence: Integer 0-100 score from the engine.
        confidence_band: "HIGH" | "MEDIUM" | "LOW" (derived from thresholds).
        accepted: True if user accepted, False if corrected, None if no feedback yet.
    """

    __tablename__ = "ice_predictions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    expense_line_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Inputs
    input_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    input_vendor_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Predicted GL
    predicted_gl_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    predicted_gl_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    predicted_gl_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    predicted_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    predicted_dimensions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Confidence
    confidence: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    confidence_band: Mapped[str] = mapped_column(String(6), nullable=False, default="LOW")

    # Outcome
    accepted: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    engine_version: Mapped[str] = mapped_column(String(50), nullable=False, default="ice-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    feedback: Mapped[list["IceFeedback"]] = relationship("IceFeedback", back_populates="prediction", lazy="select")


class IceFeedback(Base):
    """
    A correction or acceptance submitted by a user for an ICE prediction.

    Every row updates the VendorBehaviorProfile and EmployeeBehaviorProfile
    for the relevant vendor and user. This is the core training signal that
    improves ICE over time.

    Attributes:
        prediction_id: The ICE prediction being responded to.
        accepted_prediction: True if user accepted the suggestion, False if corrected.
        corrected_gl_id: The GL the user actually chose (if correcting).
        corrected_by_role: "employee" | "approver" | "finance" | "tenant_admin"
        vendor_name: Denormalized for profile update — avoids joining predictions.
    """

    __tablename__ = "ice_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    prediction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ice_predictions.id", ondelete="SET NULL"), nullable=True
    )
    accepted_prediction: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Corrected values (populated when accepted_prediction = False)
    corrected_gl_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    corrected_gl_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    corrected_gl_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_dimensions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Who corrected
    corrected_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    corrected_by_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    correction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    vendor_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    prediction: Mapped["IcePrediction | None"] = relationship("IcePrediction", back_populates="feedback")


class IceAuditLog(Base):
    """
    Immutable append-only log of every ICE event.

    NEVER updated or deleted after creation. 7-year retention minimum.
    Used by Finance and external auditors to trace AI influence on any transaction.

    Event types:
        PREDICTED   — engine returned a prediction
        ACCEPTED    — user accepted the prediction
        CORRECTED   — user overrode the prediction
        ENABLED     — ICE was enabled for the tenant
        DISABLED    — ICE was disabled for the tenant
        CONFIG_CHANGED — a config field was updated

    Attributes:
        old_value: JSON snapshot of the value before the event.
        new_value: JSON snapshot of the value after the event.
        engine_version: ICE engine version string at the time of the event.
    """

    __tablename__ = "ice_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    prediction_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    feedback_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    user_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    old_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    engine_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
