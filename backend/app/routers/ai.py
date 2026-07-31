"""
PRAD — AI Engine router (M10 + M20).

Registered at prefix /api/ai.

Endpoints (M10):
    POST  /api/ai/ocr                  Receipt/invoice OCR extraction.
    POST  /api/ai/override             Record a Finance reviewer's field override.

Endpoints (M20 — AI Intelligence Layer):
    POST  /api/ai/detect-anomalies     Run statistical anomaly scan → ai_insights
    POST  /api/ai/spending-patterns    Spending pattern narrative for a period
    POST  /api/ai/forecast             Cash flow forecast for N months ahead
    POST  /api/ai/classify             Auto-suggest GL account for a description
    GET   /api/ai/insights             List ai_insights for current tenant
    POST  /api/ai/insights/{id}/review Mark insight as REVIEWED
    POST  /api/ai/insights/{id}/dismiss Mark insight as DISMISSED

Security note:
    All AI errors are caught by the service layer and re-raised as AiIntelligenceError.
    The router maps this to a generic HTTP 503 response.
    Under no circumstances do error messages expose "Anthropic",
    model names, API key names, or any internal infrastructure detail to tenants.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.ai import AILearningOverride, AIPrediction, AiInsight
from app.models.auth import Tenant
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
from app.services.ai_intelligence import (
    AiIntelligenceError,
    detect_anomalies,
    generate_anomaly_insight,
    generate_spending_patterns,
    forecast_cash_flow,
    suggest_category,
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


# ═══════════════════════════════════════════════════════════════════════════════
# M20 — AI Intelligence Layer endpoints
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_tenant_name(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    result = await db.execute(select(Tenant.name).where(Tenant.id == tenant_id))
    return result.scalar_one_or_none() or ""


def _require_tenant(user: CurrentUser) -> uuid.UUID:
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant context.")
    return user.tenant_id


# ── Pydantic schemas (inline — small enough not to need a separate file) ──────

class SpendingPatternRequest(BaseModel):
    period_start: date
    period_end: date


class ClassifyRequest(BaseModel):
    description: str
    amount: float = 0.0
    vendor_name: str = ""


class ForecastRequest(BaseModel):
    periods_ahead: int = 3


class InsightResponse(BaseModel):
    id: uuid.UUID
    insight_type: str
    entity_type: Optional[str]
    entity_id: Optional[uuid.UUID]
    title: str
    summary: str
    detail: Optional[Any]
    severity: str
    status: str
    reviewed_by_id: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ── POST /api/ai/detect-anomalies ─────────────────────────────────────────────

@router.post("/detect-anomalies", status_code=status.HTTP_200_OK)
async def run_anomaly_detection(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    lookback_days: int = Query(90, ge=7, le=365),
) -> dict:
    """
    Run statistical anomaly detection and persist findings as ai_insights rows.

    Scans expense lines (amount outliers by GL account) and AP invoices
    (duplicate detection). Each finding is summarised via AI into a human-readable
    alert, then stored in ai_insights for Finance review.

    Returns a summary count of findings created.
    """
    tenant_id = _require_tenant(current_user)
    tenant_name = await _get_tenant_name(db, tenant_id)

    try:
        findings = await detect_anomalies(db, tenant_id, lookback_days=lookback_days)
    except AiIntelligenceError as exc:
        raise HTTPException(status_code=503, detail="AI analysis is temporarily unavailable. Please try again later.")

    created = 0
    for finding in findings:
        try:
            enriched = await generate_anomaly_insight(finding, tenant_name)
        except AiIntelligenceError:
            enriched = {**finding, "title": "Unusual transaction detected", "summary": "An anomaly was identified in your financial data."}

        insight = AiInsight(
            tenant_id=tenant_id,
            insight_type=enriched["insight_type"],
            entity_type=enriched.get("entity_type"),
            entity_id=uuid.UUID(enriched["entity_id"]) if enriched.get("entity_id") else None,
            title=enriched["title"],
            summary=enriched["summary"],
            severity=enriched.get("severity", "INFO"),
            status="PENDING",
            detail={k: v for k, v in enriched.items() if k not in ("insight_type", "entity_type", "entity_id", "title", "summary", "severity")},
        )
        db.add(insight)
        created += 1

    if created:
        await db.commit()

    return {"findings_created": created, "lookback_days": lookback_days}


# ── POST /api/ai/spending-patterns ────────────────────────────────────────────

@router.post("/spending-patterns", status_code=status.HTTP_201_CREATED)
async def run_spending_patterns(
    body: SpendingPatternRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> InsightResponse:
    """Generate and persist a spending pattern insight for the given period."""
    tenant_id = _require_tenant(current_user)
    tenant_name = await _get_tenant_name(db, tenant_id)

    try:
        result = await generate_spending_patterns(db, tenant_id, body.period_start, body.period_end, tenant_name)
    except AiIntelligenceError:
        raise HTTPException(status_code=503, detail="AI analysis is temporarily unavailable. Please try again later.")

    insight = AiInsight(
        tenant_id=tenant_id,
        insight_type=result["insight_type"],
        entity_type=result.get("entity_type"),
        title=result["title"],
        summary=result["summary"],
        severity=result.get("severity", "INFO"),
        status="PENDING",
        detail=result.get("detail"),
    )
    db.add(insight)
    await db.commit()
    await db.refresh(insight)
    return InsightResponse.model_validate(insight)


# ── POST /api/ai/forecast ─────────────────────────────────────────────────────

@router.post("/forecast", status_code=status.HTTP_201_CREATED)
async def run_cash_flow_forecast(
    body: ForecastRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> InsightResponse:
    """Generate and persist a cash flow forecast insight."""
    tenant_id = _require_tenant(current_user)
    tenant_name = await _get_tenant_name(db, tenant_id)

    try:
        result = await forecast_cash_flow(db, tenant_id, periods_ahead=body.periods_ahead, tenant_name=tenant_name)
    except AiIntelligenceError:
        raise HTTPException(status_code=503, detail="AI analysis is temporarily unavailable. Please try again later.")

    insight = AiInsight(
        tenant_id=tenant_id,
        insight_type=result["insight_type"],
        entity_type=result.get("entity_type"),
        title=result["title"],
        summary=result["summary"],
        severity=result.get("severity", "INFO"),
        status="PENDING",
        detail=result.get("detail"),
    )
    db.add(insight)
    await db.commit()
    await db.refresh(insight)
    return InsightResponse.model_validate(insight)


# ── POST /api/ai/classify ─────────────────────────────────────────────────────

@router.post("/classify", status_code=status.HTTP_200_OK)
async def classify_transaction(
    body: ClassifyRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Suggest a GL account for a transaction based on its description."""
    tenant_id = _require_tenant(current_user)
    try:
        result = await suggest_category(db, tenant_id, body.description, body.amount, body.vendor_name)
    except AiIntelligenceError:
        raise HTTPException(status_code=503, detail="AI analysis is temporarily unavailable. Please try again later.")
    return result


# ── GET /api/ai/insights ──────────────────────────────────────────────────────

@router.get("/insights", status_code=status.HTTP_200_OK)
async def list_insights(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    insight_type: Optional[str] = Query(None),
    insight_status: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
) -> list[InsightResponse]:
    """List AI insights for the current tenant, newest first."""
    tenant_id = _require_tenant(current_user)
    q = select(AiInsight).where(AiInsight.tenant_id == tenant_id)
    if insight_type:
        q = q.where(AiInsight.insight_type == insight_type.upper())
    if insight_status:
        q = q.where(AiInsight.status == insight_status.upper())
    if severity:
        q = q.where(AiInsight.severity == severity.upper())
    q = q.order_by(AiInsight.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return [InsightResponse.model_validate(i) for i in result.scalars().all()]


# ── POST /api/ai/insights/{id}/review ────────────────────────────────────────

@router.post("/insights/{insight_id}/review", status_code=status.HTTP_200_OK)
async def review_insight(
    insight_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> InsightResponse:
    """Mark an insight as REVIEWED."""
    tenant_id = _require_tenant(current_user)
    result = await db.execute(
        select(AiInsight).where(AiInsight.id == insight_id, AiInsight.tenant_id == tenant_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found.")
    insight.status = "REVIEWED"
    insight.reviewed_by_id = current_user.user_id
    insight.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(insight)
    return InsightResponse.model_validate(insight)


# ── POST /api/ai/insights/{id}/dismiss ───────────────────────────────────────

@router.post("/insights/{insight_id}/dismiss", status_code=status.HTTP_200_OK)
async def dismiss_insight(
    insight_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> InsightResponse:
    """Mark an insight as DISMISSED."""
    tenant_id = _require_tenant(current_user)
    result = await db.execute(
        select(AiInsight).where(AiInsight.id == insight_id, AiInsight.tenant_id == tenant_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found.")
    insight.status = "DISMISSED"
    insight.reviewed_by_id = current_user.user_id
    insight.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(insight)
    return InsightResponse.model_validate(insight)
