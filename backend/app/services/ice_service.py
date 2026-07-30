"""
Ziva BI — Intelligent Categorization Engine (ICE) service.

This module implements the core ICE inference and feedback loop:

1.  get_or_create_config(db, tenant_id)
    Returns the IceTenantConfig row for the tenant, creating a default one if absent.

2.  predict(db, tenant_id, user_id, request)
    Main inference function:
    - Validates ICE is enabled for the tenant.
    - Fetches the tenant's CoA (expense/COGS/asset GL accounts).
    - Loads vendor and employee behavior profiles for historical context.
    - Builds a structured prompt and calls the LLM (Anthropic API, same pattern
      as ai_intelligence.py).
    - Parses the structured LLM response (GL_ID, GL_NUMBER, GL_NAME, CATEGORY,
      CONFIDENCE, REASON).
    - Derives the confidence band from tenant thresholds.
    - Persists an IcePrediction row.
    - Appends a PREDICTED event to ice_audit_log.
    - Returns the prediction data as a dict for the router.

3.  record_feedback(db, tenant_id, user_id, request)
    Feedback loop:
    - Creates an IceFeedback row.
    - Updates IcePrediction.accepted.
    - Increments the vendor and employee gl_frequency / category_frequency counters
      (using the accepted or corrected GL).
    - Appends ACCEPTED or CORRECTED event to ice_audit_log.
    - Returns feedback summary.

4.  update_config(db, tenant_id, user_id, updates)
    Tenant Admin config update + CONFIG_CHANGED audit log entry.

5.  get_analytics(db, tenant_id, period_days)
    Derives acceptance rate, confidence distribution, top corrected GLs.

Security:
    All LLM errors are caught and re-raised as IceServiceError.
    The router maps this to HTTP 503 with the generic message
    "AI analysis is temporarily unavailable. Please try again later."
    No Anthropic brand names, model names, or API key names ever reach the client.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ice import (
    EmployeeBehaviorProfile,
    IceAuditLog,
    IceFeedback,
    IcePrediction,
    IceTenantConfig,
    VendorBehaviorProfile,
)

logger = logging.getLogger(__name__)

ICE_ENGINE_VERSION = "ice-v1-anthropic"


# ── Custom exception ───────────────────────────────────────────────────────────

class IceServiceError(Exception):
    """
    Raised when the ICE inference engine is unavailable or returns an error.

    The caller (router) maps this to HTTP 503.
    Never expose provider names or infrastructure details in the message.
    """
    pass


# ── LLM client (mirrors ai_intelligence.py pattern) ───────────────────────────

def _get_client():
    """
    Return an Anthropic client instance.

    Raises IceServiceError if the API key is missing or the library is absent.
    Never mentions "Anthropic" in the raised exception message.
    """
    try:
        import anthropic  # type: ignore
        key = getattr(settings, "anthropic_api_key", None) or ""
        if not key.strip():
            raise IceServiceError("AI analysis is not configured.")
        return anthropic.Anthropic(api_key=key)
    except ImportError:
        raise IceServiceError("AI analysis service is not available.")


async def _llm_call(prompt: str, system: str = "") -> str:
    """
    Call the LLM and return raw text response.

    Uses run_in_executor so the synchronous Anthropic SDK does not block
    the async event loop.

    Args:
        prompt: User-turn content.
        system: Optional system prompt.

    Returns:
        The LLM's text response.

    Raises:
        IceServiceError: on any failure — internal detail is never forwarded.
    """
    try:
        client = _get_client()
        loop = asyncio.get_event_loop()
        model = getattr(settings, "ocr_model", "claude-haiku-4-5-20251001")

        def _call() -> str:
            kwargs: dict[str, Any] = {
                "model": model,
                "max_tokens": 400,
                "messages": [{"role": "user", "content": prompt}],
            }
            if system:
                kwargs["system"] = system
            response = client.messages.create(**kwargs)
            return response.content[0].text if response.content else ""

        return await loop.run_in_executor(None, _call)
    except IceServiceError:
        raise
    except Exception as exc:
        logger.error("ICE LLM call failed: %s", type(exc).__name__)
        raise IceServiceError("AI analysis service is temporarily unavailable.") from exc


# ── Config helpers ─────────────────────────────────────────────────────────────

async def get_or_create_config(db: AsyncSession, tenant_id: uuid.UUID) -> IceTenantConfig:
    """
    Return the ICE config row for the tenant, creating a default one if absent.

    Default: ai_enabled=False, thresholds 80/50, all fields enabled.

    Args:
        db: Async database session.
        tenant_id: The tenant to look up.

    Returns:
        IceTenantConfig ORM instance.
    """
    result = await db.execute(
        select(IceTenantConfig).where(IceTenantConfig.tenant_id == tenant_id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = IceTenantConfig(
            tenant_id=tenant_id,
            ai_enabled=False,
            enabled_fields={"gl": True, "cost_center": True, "category": True},
            confidence_threshold_high=80,
            confidence_threshold_low=50,
            sensitive_gl_accounts=[],
            allow_user_disable=True,
        )
        db.add(config)
        await db.flush()
    return config


def _confidence_band(score: int, threshold_high: int, threshold_low: int) -> str:
    """
    Map a 0-100 confidence score to a band string.

    Args:
        score: Integer 0-100 from the LLM.
        threshold_high: Tenant's high-confidence cutoff.
        threshold_low: Tenant's low-confidence cutoff.

    Returns:
        "HIGH" | "MEDIUM" | "LOW"
    """
    if score >= threshold_high:
        return "HIGH"
    if score >= threshold_low:
        return "MEDIUM"
    return "LOW"


# ── Profile helpers ────────────────────────────────────────────────────────────

async def _get_vendor_profile(db: AsyncSession, tenant_id: uuid.UUID, vendor_name: str) -> dict:
    """
    Return the top GL IDs from the vendor's behavior profile, sorted by frequency.

    Returns empty dict if no profile exists or vendor_name is blank.

    Args:
        db: Async session.
        tenant_id: Tenant scope.
        vendor_name: Normalised vendor name.

    Returns:
        Dict {gl_id_str: count} ordered descending, top 5.
    """
    if not vendor_name.strip():
        return {}
    result = await db.execute(
        select(VendorBehaviorProfile).where(
            VendorBehaviorProfile.tenant_id == tenant_id,
            VendorBehaviorProfile.vendor_name == vendor_name.lower().strip(),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {}
    freq: dict = profile.gl_frequency or {}
    # Return top 5 by count
    return dict(sorted(freq.items(), key=lambda x: x[1], reverse=True)[:5])


async def _get_employee_profile(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    """
    Return the top GL IDs from the employee's behavior profile, sorted by frequency.

    Args:
        db: Async session.
        tenant_id: Tenant scope.
        user_id: Employee user ID.

    Returns:
        Dict {gl_id_str: count} ordered descending, top 5.
    """
    result = await db.execute(
        select(EmployeeBehaviorProfile).where(
            EmployeeBehaviorProfile.tenant_id == tenant_id,
            EmployeeBehaviorProfile.user_id == user_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {}
    freq: dict = profile.gl_frequency or {}
    return dict(sorted(freq.items(), key=lambda x: x[1], reverse=True)[:5])


async def _increment_vendor_profile(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    vendor_name: str,
    gl_id: Optional[str],
    category: Optional[str],
) -> None:
    """
    Upsert vendor behavior profile and increment gl_frequency and category_frequency counters.

    Called after an acceptance or correction so the profile learns from the outcome.

    Args:
        db: Async session.
        tenant_id: Tenant scope.
        vendor_name: Normalised vendor name.
        gl_id: GL account UUID string to increment (may be None).
        category: Category string to increment (may be None).
    """
    if not vendor_name.strip():
        return
    norm = vendor_name.lower().strip()
    result = await db.execute(
        select(VendorBehaviorProfile).where(
            VendorBehaviorProfile.tenant_id == tenant_id,
            VendorBehaviorProfile.vendor_name == norm,
        )
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = VendorBehaviorProfile(
            tenant_id=tenant_id,
            vendor_name=norm,
            gl_frequency={},
            category_frequency={},
            sample_count=0,
        )
        db.add(profile)
        await db.flush()

    if gl_id:
        freq: dict = dict(profile.gl_frequency or {})
        freq[str(gl_id)] = freq.get(str(gl_id), 0) + 1
        profile.gl_frequency = freq
    if category:
        cfreq: dict = dict(profile.category_frequency or {})
        cfreq[category] = cfreq.get(category, 0) + 1
        profile.category_frequency = cfreq
    profile.sample_count = (profile.sample_count or 0) + 1
    profile.last_updated = datetime.now(timezone.utc)


async def _increment_employee_profile(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    gl_id: Optional[str],
    category: Optional[str],
) -> None:
    """
    Upsert employee behavior profile and increment frequency counters.

    Args:
        db: Async session.
        tenant_id: Tenant scope.
        user_id: Employee user ID.
        gl_id: GL account UUID string to increment.
        category: Category string to increment.
    """
    result = await db.execute(
        select(EmployeeBehaviorProfile).where(
            EmployeeBehaviorProfile.tenant_id == tenant_id,
            EmployeeBehaviorProfile.user_id == user_id,
        )
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = EmployeeBehaviorProfile(
            tenant_id=tenant_id,
            user_id=user_id,
            gl_frequency={},
            category_frequency={},
            sample_count=0,
        )
        db.add(profile)
        await db.flush()

    if gl_id:
        freq: dict = dict(profile.gl_frequency or {})
        freq[str(gl_id)] = freq.get(str(gl_id), 0) + 1
        profile.gl_frequency = freq
    if category:
        cfreq: dict = dict(profile.category_frequency or {})
        cfreq[category] = cfreq.get(category, 0) + 1
        profile.category_frequency = cfreq
    profile.sample_count = (profile.sample_count or 0) + 1
    profile.last_updated = datetime.now(timezone.utc)


def _append_audit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    event_type: str,
    user_id: Optional[uuid.UUID] = None,
    user_role: Optional[str] = None,
    prediction_id: Optional[uuid.UUID] = None,
    feedback_id: Optional[uuid.UUID] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
) -> None:
    """
    Append an entry to ice_audit_log (append-only, never update or delete).

    Args:
        db: Async session.
        tenant_id: Tenant scope.
        event_type: One of PREDICTED, ACCEPTED, CORRECTED, ENABLED, DISABLED, CONFIG_CHANGED.
        user_id: User who triggered the event.
        user_role: Their role.
        prediction_id: Related prediction UUID (if applicable).
        feedback_id: Related feedback UUID (if applicable).
        old_value: JSON snapshot before the event.
        new_value: JSON snapshot after the event.
    """
    log = IceAuditLog(
        tenant_id=tenant_id,
        event_type=event_type,
        prediction_id=prediction_id,
        feedback_id=feedback_id,
        user_id=user_id,
        user_role=user_role,
        old_value=old_value,
        new_value=new_value,
        engine_version=ICE_ENGINE_VERSION,
    )
    db.add(log)


# ── Core predict function ──────────────────────────────────────────────────────

async def predict(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    description: str,
    amount: float,
    vendor_name: str,
    expense_line_id: Optional[uuid.UUID] = None,
) -> dict:
    """
    Generate a GL account + category + dimension prediction for an expense line.

    Workflow:
    1. Check ICE is enabled for the tenant.
    2. Load CoA accounts (expense/COGS/asset types, active, limited to 80).
    3. Load vendor behavior profile (top GL candidates with usage counts).
    4. Load employee behavior profile (top GL candidates with usage counts).
    5. Build a structured LLM prompt with all context.
    6. Call the LLM, parse the structured response.
    7. Derive confidence band from tenant thresholds.
    8. Persist IcePrediction row.
    9. Append PREDICTED audit log entry.
    10. Return prediction dict.

    Args:
        db: Async database session.
        tenant_id: Tenant to predict for.
        user_id: User triggering the prediction.
        description: Expense line description text.
        amount: Expense line amount.
        vendor_name: Vendor name from user input or OCR.
        expense_line_id: Optional expense line UUID if already persisted.

    Returns:
        Dict with keys matching IcePredictResponse fields.

    Raises:
        IceServiceError: If ICE is disabled for the tenant or LLM call fails.
    """
    config = await get_or_create_config(db, tenant_id)
    if not config.ai_enabled:
        raise IceServiceError("AI categorisation is not enabled for this organisation.")

    # ── Load CoA ───────────────────────────────────────────────────────────────
    coa_result = await db.execute(text("""
        SELECT id, gl_number, gl_name, account_type
          FROM chart_of_accounts
         WHERE tenant_id = :tid
           AND is_active = TRUE
           AND account_type IN ('EXPENSE', 'COGS', 'ASSET')
         ORDER BY gl_number
         LIMIT 80
    """), {"tid": str(tenant_id)})
    accounts = [
        {"id": str(r.id), "gl_number": r.gl_number, "gl_name": r.gl_name, "type": r.account_type}
        for r in coa_result.fetchall()
    ]

    if not accounts:
        raise IceServiceError("No chart of accounts configured — cannot generate suggestions.")

    # ── Load behavior profiles ─────────────────────────────────────────────────
    vendor_hist = await _get_vendor_profile(db, tenant_id, vendor_name)
    employee_hist = await _get_employee_profile(db, tenant_id, user_id)

    # Build GL id→name lookup for hint lines
    gl_lookup = {a["id"]: f"{a['gl_number']} — {a['gl_name']}" for a in accounts}

    # Format hints: "  642100 — Staff Travel (used 12 times for this vendor)"
    vendor_hints = ""
    if vendor_hist:
        lines = []
        for gl_id, count in list(vendor_hist.items())[:5]:
            label = gl_lookup.get(gl_id, gl_id)
            lines.append(f"  {label} ({count}x)")
        vendor_hints = "Vendor history (most frequent GLs):\n" + "\n".join(lines) + "\n"

    employee_hints = ""
    if employee_hist:
        lines = []
        for gl_id, count in list(employee_hist.items())[:5]:
            label = gl_lookup.get(gl_id, gl_id)
            lines.append(f"  {label} ({count}x)")
        employee_hints = "Employee history (most frequent GLs):\n" + "\n".join(lines) + "\n"

    # ── Build prompt ───────────────────────────────────────────────────────────
    accounts_text = "\n".join(f"{a['id']}|{a['gl_number']}|{a['gl_name']}|{a['type']}" for a in accounts)
    prompt = (
        f"Description: '{description}'\n"
        f"Amount: {amount:,.2f}\n"
        f"Vendor: '{vendor_name}'\n\n"
        f"{vendor_hints}"
        f"{employee_hints}\n"
        "Available GL accounts (id|gl_number|gl_name|type):\n"
        f"{accounts_text}\n\n"
        "Respond with EXACTLY this format and nothing else:\n"
        "GL_ID: <id from list above>\n"
        "GL_NUMBER: <gl_number>\n"
        "GL_NAME: <gl_name>\n"
        "CATEGORY: <one of: Travel,Meals,Accommodation,Fuel,Office,Entertainment,Training,Medical,Utilities,Repairs,Other>\n"
        "CONFIDENCE: <integer 0-100>\n"
        "REASON: <one sentence explaining the suggestion>"
    )
    system = (
        "You are a financial GL categorisation assistant for a business expense management system. "
        "Your sole task is to pick the single most appropriate GL account from the provided list "
        "based on the transaction description, vendor, amount, and historical patterns. "
        "Output only the structured response format specified. Do not add any other text."
    )

    try:
        raw = await _llm_call(prompt, system=system)
    except IceServiceError:
        raise

    # ── Parse response ─────────────────────────────────────────────────────────
    parsed: dict[str, str] = {}
    for line in raw.splitlines():
        for key in ("GL_ID", "GL_NUMBER", "GL_NAME", "CATEGORY", "CONFIDENCE", "REASON"):
            if line.startswith(f"{key}:"):
                parsed[key] = line[len(key) + 1:].strip()

    predicted_gl_id_str = parsed.get("GL_ID", "").strip()
    predicted_gl_number = parsed.get("GL_NUMBER", "").strip() or None
    predicted_gl_name = parsed.get("GL_NAME", "").strip() or None
    predicted_category = parsed.get("CATEGORY", "").strip() or None
    reason = parsed.get("REASON", "").strip() or None

    # Validate GL_ID against our list — prevents hallucinated IDs
    valid_ids = {a["id"] for a in accounts}
    if predicted_gl_id_str not in valid_ids:
        predicted_gl_id_str = ""
        predicted_gl_number = None
        predicted_gl_name = None

    try:
        confidence = max(0, min(100, int(parsed.get("CONFIDENCE", "0"))))
    except (ValueError, TypeError):
        confidence = 0

    band = _confidence_band(confidence, config.confidence_threshold_high, config.confidence_threshold_low)

    # ── Persist prediction ─────────────────────────────────────────────────────
    prediction = IcePrediction(
        tenant_id=tenant_id,
        expense_line_id=expense_line_id,
        requested_by_id=user_id,
        input_description=description or None,
        input_amount=amount if amount else None,
        input_vendor_name=vendor_name or None,
        predicted_gl_id=uuid.UUID(predicted_gl_id_str) if predicted_gl_id_str else None,
        predicted_gl_number=predicted_gl_number,
        predicted_gl_name=predicted_gl_name,
        predicted_category=predicted_category,
        predicted_dimensions=None,
        confidence=confidence,
        confidence_band=band,
        accepted=None,
        engine_version=ICE_ENGINE_VERSION,
    )
    db.add(prediction)
    await db.flush()  # obtain prediction.id

    _append_audit(
        db, tenant_id, "PREDICTED",
        user_id=user_id,
        prediction_id=prediction.id,
        new_value={
            "gl_number": predicted_gl_number,
            "gl_name": predicted_gl_name,
            "category": predicted_category,
            "confidence": confidence,
            "confidence_band": band,
        },
    )
    await db.commit()

    return {
        "prediction_id": prediction.id,
        "predicted_gl_id": prediction.predicted_gl_id,
        "predicted_gl_number": predicted_gl_number,
        "predicted_gl_name": predicted_gl_name,
        "predicted_category": predicted_category,
        "predicted_dimensions": None,
        "confidence": confidence,
        "confidence_band": band,
        "reason": reason,
        "engine_version": ICE_ENGINE_VERSION,
    }


# ── Feedback ───────────────────────────────────────────────────────────────────

async def record_feedback(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    prediction_id: uuid.UUID,
    accepted: bool,
    corrected_gl_id: Optional[uuid.UUID],
    corrected_gl_number: Optional[str],
    corrected_gl_name: Optional[str],
    corrected_category: Optional[str],
    corrected_dimensions: Optional[dict],
    corrected_by_role: str,
    correction_reason: Optional[str],
    vendor_name: Optional[str],
) -> dict:
    """
    Record a user's response to an ICE prediction (acceptance or correction).

    Updates:
    - IceFeedback row (created)
    - IcePrediction.accepted (updated)
    - VendorBehaviorProfile (incremented with the final GL, accepted or corrected)
    - EmployeeBehaviorProfile (same)
    - IceAuditLog (ACCEPTED or CORRECTED event)

    The GL used for profile updates is:
    - If accepted=True: the prediction's predicted_gl_id
    - If accepted=False: the user-supplied corrected_gl_id

    Args:
        db: Async session.
        tenant_id: Tenant scope.
        user_id: User submitting feedback.
        prediction_id: UUID of the IcePrediction being responded to.
        accepted: True if user accepted; False if correcting.
        corrected_gl_id: The GL the user actually selected (when accepted=False).
        corrected_gl_number: Denormalized GL number.
        corrected_gl_name: Denormalized GL name.
        corrected_category: The category the user selected.
        corrected_dimensions: Dimension overrides.
        corrected_by_role: User's role at time of feedback.
        correction_reason: Optional free-text reason.
        vendor_name: Vendor name (denormalized for profile update).

    Returns:
        Dict with feedback_id, prediction_id, accepted, profiles_updated.
    """
    # Load the original prediction to get the predicted GL for profile updates
    pred_result = await db.execute(
        select(IcePrediction).where(
            IcePrediction.id == prediction_id,
            IcePrediction.tenant_id == tenant_id,
        )
    )
    prediction = pred_result.scalar_one_or_none()

    # Create feedback row
    feedback = IceFeedback(
        tenant_id=tenant_id,
        prediction_id=prediction_id,
        accepted_prediction=accepted,
        corrected_gl_id=corrected_gl_id if not accepted else None,
        corrected_gl_number=corrected_gl_number if not accepted else None,
        corrected_gl_name=corrected_gl_name if not accepted else None,
        corrected_category=corrected_category if not accepted else None,
        corrected_dimensions=corrected_dimensions if not accepted else None,
        corrected_by_id=user_id,
        corrected_by_role=corrected_by_role,
        correction_reason=correction_reason,
        vendor_name=(vendor_name or "").lower().strip() or None,
    )
    db.add(feedback)
    await db.flush()

    # Update prediction.accepted
    if prediction is not None:
        prediction.accepted = accepted

    # Determine the "winning" GL to reinforce in profiles
    if accepted and prediction is not None:
        reinforce_gl_id = str(prediction.predicted_gl_id) if prediction.predicted_gl_id else None
        reinforce_category = prediction.predicted_category
        reinforce_vendor = vendor_name or (prediction.input_vendor_name or "")
    else:
        reinforce_gl_id = str(corrected_gl_id) if corrected_gl_id else None
        reinforce_category = corrected_category
        reinforce_vendor = vendor_name or ""

    profiles_updated = False
    if reinforce_gl_id or reinforce_category:
        if reinforce_vendor:
            await _increment_vendor_profile(db, tenant_id, reinforce_vendor, reinforce_gl_id, reinforce_category)
            profiles_updated = True
        await _increment_employee_profile(db, tenant_id, user_id, reinforce_gl_id, reinforce_category)
        profiles_updated = True

    event_type = "ACCEPTED" if accepted else "CORRECTED"
    _append_audit(
        db, tenant_id, event_type,
        user_id=user_id,
        user_role=corrected_by_role,
        prediction_id=prediction_id,
        feedback_id=feedback.id,
        old_value={
            "predicted_gl_number": prediction.predicted_gl_number if prediction else None,
            "predicted_category": prediction.predicted_category if prediction else None,
        },
        new_value={
            "corrected_gl_number": corrected_gl_number if not accepted else None,
            "corrected_category": corrected_category if not accepted else None,
            "accepted": accepted,
        },
    )
    await db.commit()

    return {
        "feedback_id": feedback.id,
        "prediction_id": prediction_id,
        "accepted": accepted,
        "profiles_updated": profiles_updated,
    }


# ── Config update ──────────────────────────────────────────────────────────────

async def update_config(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    updates: dict,
) -> IceTenantConfig:
    """
    Apply updates to the tenant's ICE config and log the change.

    Args:
        db: Async session.
        tenant_id: Tenant to update.
        user_id: Admin making the change.
        updates: Dict of fields to update (only non-None values applied).

    Returns:
        Updated IceTenantConfig instance.
    """
    config = await get_or_create_config(db, tenant_id)
    old_snapshot = {
        "ai_enabled": config.ai_enabled,
        "confidence_threshold_high": config.confidence_threshold_high,
        "confidence_threshold_low": config.confidence_threshold_low,
    }

    ALLOWED = (
        "ai_enabled", "enabled_fields", "confidence_threshold_high",
        "confidence_threshold_low", "sensitive_gl_accounts", "allow_user_disable",
    )
    for field in ALLOWED:
        if field in updates and updates[field] is not None:
            setattr(config, field, updates[field])

    config.updated_at = datetime.now(timezone.utc)

    event = "ENABLED" if updates.get("ai_enabled") is True else (
        "DISABLED" if updates.get("ai_enabled") is False else "CONFIG_CHANGED"
    )
    _append_audit(
        db, tenant_id, event,
        user_id=user_id,
        old_value=old_snapshot,
        new_value={k: updates[k] for k in ALLOWED if k in updates},
    )
    await db.commit()
    await db.refresh(config)
    return config


# ── Analytics ──────────────────────────────────────────────────────────────────

async def get_analytics(db: AsyncSession, tenant_id: uuid.UUID, period_days: int = 30) -> dict:
    """
    Compute ICE accuracy metrics for the given period.

    Metrics:
    - total_predictions: rows in ice_predictions
    - accepted / corrected / pending_feedback: breakdown by accepted field
    - acceptance_rate: accepted / (accepted + corrected)
    - high/medium/low confidence counts
    - top_corrected_gls: the 5 GL numbers most frequently corrected to

    Args:
        db: Async session.
        tenant_id: Tenant scope.
        period_days: How many days back to analyse.

    Returns:
        Dict matching IcePredictionStats fields.
    """
    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    # Total predictions in window
    total_result = await db.execute(
        select(func.count(IcePrediction.id)).where(
            IcePrediction.tenant_id == tenant_id,
            IcePrediction.created_at >= since,
        )
    )
    total = total_result.scalar_one() or 0

    # Accepted / corrected / pending
    accepted_result = await db.execute(
        select(func.count(IcePrediction.id)).where(
            IcePrediction.tenant_id == tenant_id,
            IcePrediction.created_at >= since,
            IcePrediction.accepted == True,  # noqa: E712
        )
    )
    accepted_count = accepted_result.scalar_one() or 0

    corrected_result = await db.execute(
        select(func.count(IcePrediction.id)).where(
            IcePrediction.tenant_id == tenant_id,
            IcePrediction.created_at >= since,
            IcePrediction.accepted == False,  # noqa: E712
        )
    )
    corrected_count = corrected_result.scalar_one() or 0
    pending_count = total - accepted_count - corrected_count

    acceptance_rate = round(accepted_count / (accepted_count + corrected_count), 4) if (accepted_count + corrected_count) else 0.0

    # Confidence distribution
    high_result = await db.execute(
        select(func.count(IcePrediction.id)).where(
            IcePrediction.tenant_id == tenant_id,
            IcePrediction.created_at >= since,
            IcePrediction.confidence_band == "HIGH",
        )
    )
    medium_result = await db.execute(
        select(func.count(IcePrediction.id)).where(
            IcePrediction.tenant_id == tenant_id,
            IcePrediction.created_at >= since,
            IcePrediction.confidence_band == "MEDIUM",
        )
    )
    low_result = await db.execute(
        select(func.count(IcePrediction.id)).where(
            IcePrediction.tenant_id == tenant_id,
            IcePrediction.created_at >= since,
            IcePrediction.confidence_band == "LOW",
        )
    )

    # Top corrected GLs (from ice_feedback, not accepted rows)
    fb_result = await db.execute(
        select(IceFeedback.corrected_gl_number, IceFeedback.corrected_gl_name).where(
            IceFeedback.tenant_id == tenant_id,
            IceFeedback.created_at >= since,
            IceFeedback.accepted_prediction == False,  # noqa: E712
            IceFeedback.corrected_gl_number.isnot(None),
        ).limit(200)
    )
    fb_rows = fb_result.fetchall()
    gl_counter: Counter = Counter()
    gl_names: dict = {}
    for row in fb_rows:
        gl_counter[row.corrected_gl_number] += 1
        gl_names[row.corrected_gl_number] = row.corrected_gl_name
    top_corrected = [
        {"gl_number": gl, "gl_name": gl_names.get(gl), "count": cnt}
        for gl, cnt in gl_counter.most_common(5)
    ]

    return {
        "total_predictions": total,
        "accepted": accepted_count,
        "corrected": corrected_count,
        "pending_feedback": pending_count,
        "acceptance_rate": acceptance_rate,
        "high_confidence_count": high_result.scalar_one() or 0,
        "medium_confidence_count": medium_result.scalar_one() or 0,
        "low_confidence_count": low_result.scalar_one() or 0,
        "top_corrected_gls": top_corrected,
        "period_days": period_days,
    }
