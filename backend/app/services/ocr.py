"""
PRAD — OCR service (M10 AI Engine).

Wraps the Anthropic Vision/Documents API to extract structured financial data
from receipt and invoice images.  Called by routers/ai.py.

How it works:
1.  Caller passes raw image bytes + MIME type (image/jpeg, image/png, image/webp,
    application/pdf).
2.  This module base64-encodes the bytes and sends them to claude-haiku-4-5-20251001
    with a strict JSON-only extraction prompt.
3.  The model response is parsed as JSON and mapped to OcrExtractedData.
4.  The caller (router) writes an ai_predictions row and returns OcrExtractedData
    to the frontend.

Error handling:
- Anthropic SDK not configured (key blank) → raises OCRNotConfiguredError
- API errors → raises OCRServiceError with appropriate HTTP status hint
- Model returns un-parseable JSON → returns a partial result with parse_error=True
  (the raw_text is still populated so the user isn't left with nothing)

Separation of concerns:
- This module does NOT write to the database — the router handles persistence.
- This module does NOT check ocr_enabled — the router enforces that guard.
"""

from __future__ import annotations

import base64
import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Optional

import anthropic

from app.config import settings

# ── Constants ─────────────────────────────────────────────────────────────────

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 2048
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

EXTRACTION_PROMPT = """\
You are a financial document extraction engine. Extract all financial data from this receipt or invoice.

Return ONLY a valid JSON object — no explanation, no markdown fences, no text outside the JSON.

Required fields (set to null if not found or unclear):
{
  "vendor_name": string | null,
  "vendor_name_confidence": float (0.0-1.0),
  "date": "YYYY-MM-DD" | null,
  "date_confidence": float,
  "total_amount": number | null,
  "total_amount_confidence": float,
  "currency": "ISO 4217 code" | null,
  "currency_confidence": float,
  "description": string | null,
  "description_confidence": float,
  "tax_amount": number | null,
  "tax_type": string | null,
  "line_items": [
    {
      "description": string,
      "quantity": number | null,
      "unit_price": number | null,
      "amount": number,
      "confidence": float
    }
  ],
  "raw_text": string
}

Rules:
- Remove all currency symbols (₦, $, £, €) from amounts — return pure numbers.
- Use ISO 4217 for currency (NGN, USD, GBP, EUR).
- If document appears to be in Naira and no currency symbol is shown, set currency = "NGN" with confidence 0.70.
- date must be YYYY-MM-DD. If only month/year visible, use first day of that month.
- total_amount is the grand total after tax and discounts.
- If the receipt is a POS/screen photo, extract the displayed total.
- Set null and confidence 0.0 for any field you cannot read reliably.
- 0.95+ = certain. 0.70–0.94 = probable. Below 0.70 = uncertain.
- description: concise summary of what was purchased, max 120 characters.
"""

# ── Custom exceptions ──────────────────────────────────────────────────────────

class OCRNotConfiguredError(Exception):
    """Raised when ANTHROPIC_API_KEY is blank — OCR not set up for this deployment."""


class OCRServiceError(Exception):
    """Raised for Anthropic API-level errors.

    Parameters
    ----------
    message : str
        Human-readable error message.
    http_status : int
        Suggested HTTP status for the router to return (503, 429, 502).
    """
    def __init__(self, message: str, http_status: int = 503) -> None:
        super().__init__(message)
        self.http_status = http_status


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class OcrLineItemData:
    """A single extracted line item."""
    description: str
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: float = 0.0
    confidence: float = 0.0


@dataclass
class OcrExtractedData:
    """Structured extraction result from a single OCR call.

    All confidence fields are 0.0–1.0.  Fields that could not be extracted
    are set to None with a confidence of 0.0.

    Attributes
    ----------
    vendor_name : str | None
    vendor_name_confidence : float
    date : str | None — YYYY-MM-DD
    date_confidence : float
    total_amount : float | None — pure number, no currency symbol
    total_amount_confidence : float
    currency : str | None — ISO 4217
    currency_confidence : float
    description : str | None — concise purchase summary
    description_confidence : float
    tax_amount : float | None
    tax_type : str | None — 'VAT' | 'WHT' | other
    line_items : list[OcrLineItemData]
    raw_text : str | None — verbatim text from the document
    ocr_model : str — model identifier
    processing_ms : int — wall-clock latency in ms
    input_hash : str — SHA-256 of the input bytes for dedup
    parse_error : bool — True if the model returned un-parseable JSON
    """
    vendor_name: Optional[str] = None
    vendor_name_confidence: float = 0.0
    date: Optional[str] = None
    date_confidence: float = 0.0
    total_amount: Optional[float] = None
    total_amount_confidence: float = 0.0
    currency: Optional[str] = None
    currency_confidence: float = 0.0
    description: Optional[str] = None
    description_confidence: float = 0.0
    tax_amount: Optional[float] = None
    tax_type: Optional[str] = None
    line_items: list[OcrLineItemData] = field(default_factory=list)
    raw_text: Optional[str] = None
    ocr_model: str = MODEL
    processing_ms: Optional[int] = None
    input_hash: str = ""
    parse_error: bool = False


# ── Core extraction function ──────────────────────────────────────────────────

def extract_receipt(
    file_bytes: bytes,
    mime_type: str,
    tenant_currency_hint: Optional[str] = None,
) -> OcrExtractedData:
    """
    Extract financial data from a receipt or invoice image/PDF.

    This is a synchronous call (Anthropic SDK is sync). FastAPI will run it in
    a thread pool via run_in_executor in the router.

    Parameters
    ----------
    file_bytes : bytes
        Raw file content (JPEG, PNG, WEBP, or single-page PDF).
    mime_type : str
        MIME type string, must be in SUPPORTED_MIME_TYPES.
    tenant_currency_hint : str | None
        ISO 4217 currency code to append to the prompt as a fallback hint.
        E.g. 'NGN' for a Nigerian tenant, 'GBP' for a UK tenant.

    Returns
    -------
    OcrExtractedData

    Raises
    ------
    OCRNotConfiguredError
        ANTHROPIC_API_KEY is not set.
    OCRServiceError
        Anthropic API returned an error.
    """
    if not settings.anthropic_api_key:
        raise OCRNotConfiguredError("ANTHROPIC_API_KEY is not configured.")

    if mime_type not in SUPPORTED_MIME_TYPES:
        raise ValueError(f"Unsupported MIME type: {mime_type}")

    if len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError(f"File too large: {len(file_bytes)} bytes (max {MAX_FILE_BYTES})")

    # Compute input hash for dedup / audit trail
    input_hash = hashlib.sha256(file_bytes).hexdigest()

    # Build prompt with optional currency hint
    prompt = EXTRACTION_PROMPT
    if tenant_currency_hint:
        prompt += (
            f"\n\nContext: This document is from a company whose functional currency is "
            f"{tenant_currency_hint}. If no currency is visible, set currency = "
            f'"{tenant_currency_hint}" with confidence 0.75.'
        )

    # Build content block — image vs document (PDF)
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    if mime_type == "application/pdf":
        content_block: dict = {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": mime_type,
                "data": b64,
            },
        }
    else:
        content_block = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime_type,
                "data": b64,
            },
        }

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    t0 = time.monotonic()
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[
                {
                    "role": "user",
                    "content": [
                        content_block,
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
    except anthropic.APIConnectionError as exc:
        raise OCRServiceError(f"Cannot reach Anthropic API: {exc}", http_status=503) from exc
    except anthropic.RateLimitError as exc:
        raise OCRServiceError(f"Anthropic rate limit: {exc}", http_status=429) from exc
    except anthropic.APIStatusError as exc:
        raise OCRServiceError(
            f"Anthropic API error {exc.status_code}: {exc.message}", http_status=502
        ) from exc

    processing_ms = int((time.monotonic() - t0) * 1000)

    # Extract text content from response
    raw_response_text: str = ""
    for block in response.content:
        if hasattr(block, "text"):
            raw_response_text += block.text

    # Parse JSON
    parse_error = False
    extracted: dict = {}
    try:
        # Strip markdown fences if the model disobeyed the prompt
        clean = raw_response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```", 2)[1]
            if clean.startswith("json"):
                clean = clean[4:]
        extracted = json.loads(clean)
    except (json.JSONDecodeError, IndexError):
        parse_error = True
        # Fall through — we'll return partial data with parse_error=True

    # Map extracted dict → OcrExtractedData
    def _f(key: str) -> Optional[float]:
        """Safely extract a float field."""
        val = extracted.get(key)
        try:
            return float(val) if val is not None else None
        except (TypeError, ValueError):
            return None

    def _conf(key: str) -> float:
        """Safely extract a confidence float, clamped to [0.0, 1.0]."""
        val = extracted.get(key)
        try:
            v = float(val)
            return max(0.0, min(1.0, v))
        except (TypeError, ValueError):
            return 0.0

    line_items: list[OcrLineItemData] = []
    for raw_line in extracted.get("line_items") or []:
        if not isinstance(raw_line, dict):
            continue
        try:
            line_items.append(
                OcrLineItemData(
                    description=str(raw_line.get("description") or ""),
                    quantity=_safe_float(raw_line.get("quantity")),
                    unit_price=_safe_float(raw_line.get("unit_price")),
                    amount=float(raw_line.get("amount") or 0.0),
                    confidence=max(0.0, min(1.0, float(raw_line.get("confidence") or 0.0))),
                )
            )
        except (TypeError, ValueError):
            continue

    return OcrExtractedData(
        vendor_name=extracted.get("vendor_name"),
        vendor_name_confidence=_conf("vendor_name_confidence"),
        date=extracted.get("date"),
        date_confidence=_conf("date_confidence"),
        total_amount=_f("total_amount"),
        total_amount_confidence=_conf("total_amount_confidence"),
        currency=extracted.get("currency"),
        currency_confidence=_conf("currency_confidence"),
        description=extracted.get("description"),
        description_confidence=_conf("description_confidence"),
        tax_amount=_f("tax_amount"),
        tax_type=extracted.get("tax_type"),
        line_items=line_items,
        raw_text=extracted.get("raw_text") or raw_response_text[:4000],
        ocr_model=MODEL,
        processing_ms=processing_ms,
        input_hash=input_hash,
        parse_error=parse_error,
    )


def _safe_float(val: object) -> Optional[float]:
    """Return float(val) or None if conversion fails."""
    try:
        return float(val) if val is not None else None  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
