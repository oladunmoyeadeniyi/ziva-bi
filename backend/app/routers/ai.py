"""
ZivaBI — AI Engine router (M10+).

Registered at prefix /api/ai.

Endpoints (M10):
    POST  /api/ai/ocr       Submit an image or PDF for receipt/invoice OCR extraction.
    POST  /api/ai/override  Record a Finance reviewer's override of an AI field prediction.

Planned endpoints (M20 — not yet implemented):
    POST  /api/ai/classify         GL / dimension / vendor category prediction
    POST  /api/ai/detect-duplicate Invoice duplicate detection
    POST  /api/ai/reconcile        AI bank statement matching suggestions
    POST  /api/ai/tax-predict      VAT / WHT applicability prediction
    POST  /api/ai/fraud            Fraud / anomaly scoring

Architecture:
    - This router is the single entry point for all AI Engine functionality.
    - The OCR service (services/ocr.py) is pure business logic — no DB access.
    - This router handles all DB writes (ai_predictions, ai_learning_overrides).
    - OCR is guarded by the tenant's ocr_enabled flag — returns 400 if disabled.
    - A missing / blank ANTHROPIC_API_KEY returns 501 (not 500) so ops teams
      know immediately it's a configuration issue, not a code bug.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.ai import AILearningOverride, AIPrediction
from app.models.expenses import TenantExpenseConfig
from app.schemas.ai import AIOverrideRequest, AIOverrideResponse, OcrLineItem, OcrResponse
from app.services.ocr import (
    MAX_FILE_BYTES,
    SUPPORTED_MIME_TYPES,
    OCRNotConfiguredError,
    OCRServiceError,
    OcrExtractedData,
    extract_receipt,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# ── Helpers ───────────────────────────────────────────────────────────────────

_MIME_FROM_EXT: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def _detect_mime(filename: str, content_type: str | None) -> str:
    """
    Resolve MIME type from filename extension or the upload's content_type header.

    Extension wins over content_type because browsers sometimes send generic
    application/octet-stream for file inputs.

    Raises HTTPException 400 for unsupported types.
    """
    lower = (filename or "").lower()
    for ext, mime in _MIME_FROM_EXT.items():
        if lower.endswith(ext):
            return mime
    # Fall back to content_type header
    if content_type and content_type.split(";")[0].strip() in SUPPORTED_MIME_TYPES:
        return content_type.split(";")[0].strip()
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Unsupported file type. Accepted: JPEG, PNG, WEBP, PDF. "
            f"Got: {filename!r}"
        ),
    )


async def _get_ocr_enabled(tenant_id: uuid.UUID, db: AsyncSession) -> bool:
    """Return the tenant's ocr_enabled flag, or True (default) if no config row exists."""
    result = await db.execute(
        select(TenantExpenseConfig.ocr_enabled).where(
            TenantExpenseConfig.tenant_id == tenant_id
        )
    )
    val = result.scalar_one_or_none()
    return True if val is None else bool(val)


# ── POST /api/ai/ocr ──────────────────────────────────────────────────────────

@router.post("/ocr", response_model=OcrResponse, status_code=status.HTTP_200_OK)
async def ocr_receipt(
    file: UploadFile = File(...),
    tenant_currency: Optional[str] = Query(
        default=None,
        description="ISO 4217 currency hint (e.g. NGN). Used if OCR cannot detect currency.",
        max_length=3,
    ),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> OcrResponse:
    """
    Extract structured financial data from a receipt or invoice image/PDF.

    Accepts a multipart/form-data upload with a single image or PDF file.
    Returns extracted fields (vendor, date, amount, currency, line items) with
    per-field confidence scores and a prediction_id for audit trail purposes.

    The prediction_id can be passed to POST /api/ai/override when the user
    changes any extracted field before submitting the expense.

    Status codes:
        200  — extraction complete (parse_error may still be true for partial results)
        400  — unsupported file type, file too large, or OCR disabled for tenant
        501  — Anthropic API key not configured
        503  — Anthropic API unreachable
        429  — Anthropic rate limit hit
        502  — Anthropic API returned an unexpected error
    """
    # ── Guard: tenant required ─────────────────────────────────────────────────
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OCR is available for business accounts only.",
        )

    # ── Guard: ocr_enabled flag ────────────────────────────────────────────────
    if not await _get_ocr_enabled(current_user.tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OCR receipt scanning is disabled for this organisation. "
                   "Enable it in Settings → Expense Configuration.",
        )

    # ── Validate file ──────────────────────────────────────────────────────────
    mime_type = _detect_mime(file.filename or "", file.content_type)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is 10 MB (got {len(file_bytes) // 1024} KB).",
        )
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Run OCR in thread pool (synchronous Anthropic SDK) ─────────────────────
    try:
        extracted: OcrExtractedData = await asyncio.get_event_loop().run_in_executor(
            None,
            extract_receipt,
            file_bytes,
            mime_type,
            tenant_currency,
        )
    except OCRNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Receipt scanning is not available. Please contact support.",
        )
    except OCRServiceError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail="Receipt scanning is temporarily unavailable. Please try again later.",
        )

    # ── Persist ai_predictions audit row ──────────────────────────────────────
    prediction = AIPrediction(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        prediction_type="ocr",
        input_hash=extracted.input_hash,
        ocr_model=extracted.ocr_model,
        prediction_json={
            "vendor_name": extracted.vendor_name,
            "vendor_name_confidence": extracted.vendor_name_confidence,
            "date": extracted.date,
            "date_confidence": extracted.date_confidence,
            "total_amount": extracted.total_amount,
            "total_amount_confidence": extracted.total_amount_confidence,
            "currency": extracted.currency,
            "currency_confidence": extracted.currency_confidence,
            "description": extracted.description,
            "description_confidence": extracted.description_confidence,
            "tax_amount": extracted.tax_amount,
            "tax_type": extracted.tax_type,
            "line_items": [
                {
                    "description": li.description,
                    "quantity": li.quantity,
                    "unit_price": li.unit_price,
                    "amount": li.amount,
                    "confidence": li.confidence,
                }
                for li in extracted.line_items
            ],
            "parse_error": extracted.parse_error,
        },
        confidence_overall=extracted.total_amount_confidence or None,
        processing_ms=extracted.processing_ms,
    )
    db.add(prediction)
    await db.commit()
    await db.refresh(prediction)

    # ── Build response ─────────────────────────────────────────────────────────
    return OcrResponse(
        prediction_id=prediction.id,
        vendor_name=extracted.vendor_name,
        vendor_name_confidence=extracted.vendor_name_confidence,
        date=extracted.date,
        date_confidence=extracted.date_confidence,
        total_amount=extracted.total_amount,
        total_amount_confidence=extracted.total_amount_confidence,
        currency=extracted.currency,
        currency_confidence=extracted.currency_confidence,
        description=extracted.description,
        description_confidence=extracted.description_confidence,
        tax_amount=extracted.tax_amount,
        tax_type=extracted.tax_type,
        line_items=[
            OcrLineItem(
                description=li.description,
                quantity=li.quantity,
                unit_price=li.unit_price,
                amount=li.amount,
                confidence=li.confidence,
            )
            for li in extracted.line_items
        ],
        raw_text=extracted.raw_text,
        ocr_model=extracted.ocr_model,
        processing_ms=extracted.processing_ms,
        parse_error=extracted.parse_error,
    )


# ── POST /api/ai/override ─────────────────────────────────────────────────────

@router.post("/override", response_model=AIOverrideResponse, status_code=status.HTTP_200_OK)
async def record_ai_override(
    data: AIOverrideRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> AIOverrideResponse:
    """
    Record a Finance reviewer's correction of an AI-predicted field.

    Called from the frontend whenever the user edits an extracted field before
    applying it to an expense line.  These override records are the training
    signal for M20's tenant-specific learning loop.

    One call per field changed — call multiple times for the same prediction_id
    to record multiple field overrides.

    Returns the UUID of the created ai_learning_overrides row.
    """
    # Verify the prediction belongs to the current tenant
    pred_result = await db.execute(
        select(AIPrediction).where(
            AIPrediction.id == data.prediction_id,
            AIPrediction.tenant_id == current_user.tenant_id,
        )
    )
    prediction = pred_result.scalar_one_or_none()
    if prediction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI prediction not found.",
        )

    override = AILearningOverride(
        id=uuid.uuid4(),
        prediction_id=data.prediction_id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        field_name=data.field,
        original_value={"value": data.original_value},
        override_value={"value": data.override_value},
    )
    db.add(override)

    # Mark the prediction as overridden (False = user changed something)
    prediction.accepted = False
    await db.commit()
    await db.refresh(override)

    return AIOverrideResponse(status="recorded", override_id=override.id)
