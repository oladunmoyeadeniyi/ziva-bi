"""
PRAD — Intelligent Categorization Engine (ICE) Pydantic schemas.

Request/response schemas for all ICE API endpoints:
    POST /api/ai/ice/predict       — get GL + category + dimension suggestions
    POST /api/ai/ice/feedback      — submit a correction or acceptance
    GET  /api/ai/ice/config        — get tenant ICE configuration
    PATCH /api/ai/ice/config       — update tenant ICE configuration
    GET  /api/ai/ice/analytics     — accuracy + override metrics

Connects to:
    - routers/ice.py (imports these schemas)
    - services/ice_service.py (returns IcePredictionResult for router serialisation)

Security note:
    No schema field may expose AI provider names, model identifiers,
    or internal infrastructure details to the client.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ── Prediction ─────────────────────────────────────────────────────────────────

class IcePredictRequest(BaseModel):
    """
    Input to POST /api/ai/ice/predict.

    At least one of description or vendor_name must be non-empty.
    The expense_line_id is optional — callers from the new-expense form send it
    when the line ID is known; preview calls (before saving) may omit it.
    """

    description: str = Field(default="", max_length=500, description="Expense line description text.")
    amount: float = Field(default=0.0, ge=0, description="Line amount (used to weight predictions).")
    vendor_name: str = Field(default="", max_length=200, description="Vendor name from OCR or user input.")
    expense_line_id: Optional[uuid.UUID] = Field(default=None, description="Expense line UUID if already persisted.")

    @field_validator("description", "vendor_name", mode="before")
    @classmethod
    def strip_strings(cls, v: Any) -> str:
        return str(v).strip() if v else ""


class IcePredictResponse(BaseModel):
    """
    Response from POST /api/ai/ice/predict.

    The frontend uses confidence_band to decide how to render the suggestion:
    - HIGH (≥ threshold_high): green badge, accept with one click
    - MEDIUM: yellow badge, employee and approver must review
    - LOW (< threshold_low): red badge, manual classification required
    """

    prediction_id: uuid.UUID
    predicted_gl_id: Optional[uuid.UUID]
    predicted_gl_number: Optional[str]
    predicted_gl_name: Optional[str]
    predicted_category: Optional[str]
    predicted_dimensions: Optional[dict]
    confidence: int = Field(ge=0, le=100, description="Confidence score 0–100.")
    confidence_band: str = Field(description="'HIGH' | 'MEDIUM' | 'LOW'")
    reason: Optional[str] = Field(default=None, description="Human-readable explanation of the suggestion.")
    engine_version: str


# ── Feedback ───────────────────────────────────────────────────────────────────

class IceFeedbackRequest(BaseModel):
    """
    Input to POST /api/ai/ice/feedback.

    Call this whenever a user acts on an ICE suggestion:
    - Acceptance: set accepted=True; corrected_* fields are ignored.
    - Correction: set accepted=False; populate corrected_gl_id/corrected_category.

    corrected_by_role must be one of: "employee", "approver", "finance", "tenant_admin".
    """

    prediction_id: uuid.UUID
    accepted: bool = Field(description="True if user accepted the AI suggestion.")
    corrected_gl_id: Optional[uuid.UUID] = None
    corrected_gl_number: Optional[str] = None
    corrected_gl_name: Optional[str] = None
    corrected_category: Optional[str] = None
    corrected_dimensions: Optional[dict] = None
    corrected_by_role: str = Field(default="employee", description="Role of the correcting user.")
    correction_reason: Optional[str] = Field(default=None, max_length=500)
    vendor_name: Optional[str] = Field(default=None, max_length=200)


class IceFeedbackResponse(BaseModel):
    """Response from POST /api/ai/ice/feedback."""

    feedback_id: uuid.UUID
    prediction_id: Optional[uuid.UUID]
    accepted: bool
    profiles_updated: bool = Field(description="True if vendor/employee profiles were updated.")


# ── Config ─────────────────────────────────────────────────────────────────────

class IceConfigResponse(BaseModel):
    """
    Response from GET /api/ai/ice/config.

    Returned to both Tenant Admin and employee (subset of fields).
    """

    id: uuid.UUID
    tenant_id: uuid.UUID
    ai_enabled: bool
    enabled_fields: dict
    confidence_threshold_high: int
    confidence_threshold_low: int
    sensitive_gl_accounts: list
    allow_user_disable: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class IceConfigUpdate(BaseModel):
    """
    Input to PATCH /api/ai/ice/config.

    All fields are optional — only provided fields are updated.
    Tenant Admin only (enforced in router).
    """

    ai_enabled: Optional[bool] = None
    enabled_fields: Optional[dict] = None
    confidence_threshold_high: Optional[int] = Field(default=None, ge=1, le=100)
    confidence_threshold_low: Optional[int] = Field(default=None, ge=1, le=100)
    sensitive_gl_accounts: Optional[list] = None
    allow_user_disable: Optional[bool] = None


# ── Analytics ──────────────────────────────────────────────────────────────────

class IcePredictionStats(BaseModel):
    """
    Accuracy analytics for GET /api/ai/ice/analytics.

    Derived by counting ice_predictions and ice_feedback rows in the time window.
    """

    total_predictions: int
    accepted: int
    corrected: int
    pending_feedback: int
    acceptance_rate: float = Field(description="0.0 – 1.0")
    high_confidence_count: int
    medium_confidence_count: int
    low_confidence_count: int
    # Top 5 most frequently corrected GL accounts
    top_corrected_gls: list[dict] = Field(default_factory=list)
    period_days: int


# ── Audit log ──────────────────────────────────────────────────────────────────

class IceAuditLogEntry(BaseModel):
    """Single entry from the ICE audit log."""

    id: uuid.UUID
    event_type: str
    prediction_id: Optional[uuid.UUID]
    feedback_id: Optional[uuid.UUID]
    user_id: Optional[uuid.UUID]
    user_role: Optional[str]
    old_value: Optional[dict]
    new_value: Optional[dict]
    engine_version: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
