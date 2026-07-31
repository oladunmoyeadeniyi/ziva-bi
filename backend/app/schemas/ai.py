"""
PRAD — Pydantic schemas for the AI Engine (M10+).

Used by routers/ai.py to validate request bodies and shape API responses.

M10 covers OCR receipt scanning (POST /api/ai/ocr).
Future milestones (M20) will extend this with classify, detect-duplicate, fraud schemas.

OcrLineItem:
    A single extracted line item from a receipt or invoice.

OcrResponse:
    Full response from POST /api/ai/ocr — all extracted financial fields with
    per-field confidence scores and an audit prediction_id.

AIOverrideRequest:
    Body for POST /api/ai/override — records a Finance reviewer's correction.

AIOverrideResponse:
    Confirmation that the override was stored.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class OcrLineItem(BaseModel):
    """
    A single line item extracted from a receipt or invoice.

    Parameters
    ----------
    description : str — item name/description
    quantity : float | None — quantity purchased (None if not shown)
    unit_price : float | None — per-unit price (None if not shown)
    amount : float — line total (always present; computed or extracted)
    confidence : float — model's confidence in this line (0.0–1.0)
    """

    description: str
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: float
    confidence: float = Field(ge=0.0, le=1.0)


class OcrResponse(BaseModel):
    """
    Response from POST /api/ai/ocr.

    All extracted fields from the receipt or invoice, with a per-field
    confidence score (0.0–1.0). Low-confidence fields should be flagged
    in the UI (amber or red badge) so the user verifies before submitting.

    prediction_id is the UUID of the ai_predictions row created for this call.
    Finance reviewers can reference it when recording overrides.

    Parameters
    ----------
    prediction_id : UUID — audit trail row ID in ai_predictions
    vendor_name : extracted vendor name
    vendor_name_confidence : confidence for vendor_name
    date : extracted document date (ISO YYYY-MM-DD)
    date_confidence : confidence for date
    total_amount : grand total (numeric, no currency symbols)
    total_amount_confidence : confidence for total_amount
    currency : ISO 4217 currency code (e.g. 'NGN', 'USD')
    currency_confidence : confidence for currency
    description : concise summary of what was purchased (max 120 chars)
    description_confidence : confidence for description
    tax_amount : tax/VAT amount (None if not shown)
    tax_type : 'VAT' | 'WHT' | None
    line_items : extracted line items (may be empty for single-line receipts)
    raw_text : full verbatim text extracted from the document
    ocr_model : model identifier used for this call
    processing_ms : wall-clock latency in milliseconds
    parse_error : True if the model's JSON could not be parsed cleanly
    """

    prediction_id: uuid.UUID

    vendor_name: Optional[str] = None
    vendor_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    date: Optional[str] = None  # YYYY-MM-DD
    date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    total_amount: Optional[float] = None
    total_amount_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    currency: Optional[str] = None  # ISO 4217
    currency_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    description: Optional[str] = None
    description_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    tax_amount: Optional[float] = None
    tax_type: Optional[str] = None  # 'VAT' | 'WHT' | other

    line_items: list[OcrLineItem] = []

    raw_text: Optional[str] = None
    ocr_model: str = "claude-haiku-4-5-20251001"
    processing_ms: Optional[int] = None
    parse_error: bool = False


class AIOverrideRequest(BaseModel):
    """
    Body for POST /api/ai/override.

    Records that a Finance reviewer changed one field from the AI's suggestion.
    Multiple override calls may be made for the same prediction_id (one per field).

    Parameters
    ----------
    prediction_id : UUID of the ai_predictions row being overridden
    field : field name that was changed (e.g. 'total_amount', 'description')
    original_value : what the AI suggested (pass None if the field was null)
    override_value : what the user chose instead
    """

    prediction_id: uuid.UUID
    field: str
    original_value: Optional[object] = None
    override_value: Optional[object] = None


class AIOverrideResponse(BaseModel):
    """
    Confirmation response from POST /api/ai/override.

    Parameters
    ----------
    status : always 'recorded'
    override_id : UUID of the new ai_learning_overrides row
    """

    status: str = "recorded"
    override_id: uuid.UUID
