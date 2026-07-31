"""
PRAD — Intelligent Categorization Engine (ICE) router.

Registered at prefix /api/ai/ice (nested under the /api/ai namespace).

Endpoints:
    POST  /api/ai/ice/predict          Request a GL + category suggestion.
    POST  /api/ai/ice/feedback         Submit acceptance or correction.
    GET   /api/ai/ice/config           Get tenant ICE configuration.
    PATCH /api/ai/ice/config           Update tenant ICE configuration (Tenant Admin+).
    GET   /api/ai/ice/analytics        Accuracy + override metrics (Finance / Admin+).
    GET   /api/ai/ice/audit-log        Recent ICE audit events (Finance / Admin+).

Security note:
    All IceServiceError exceptions are caught by the router and mapped to HTTP 503
    with the generic message "AI analysis is temporarily unavailable. Please try
    again later."  The Anthropic brand name, model identifiers, and API key names
    are NEVER exposed to the client in any error response.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.ice import IceAuditLog
from app.schemas.ice import (
    IceAuditLogEntry,
    IceConfigResponse,
    IceConfigUpdate,
    IceFeedbackRequest,
    IceFeedbackResponse,
    IcePredictRequest,
    IcePredictResponse,
    IcePredictionStats,
)
from app.services.ice_service import (
    IceServiceError,
    get_analytics,
    get_or_create_config,
    predict,
    record_feedback,
    update_config,
)

router = APIRouter(prefix="/api/ai/ice", tags=["ice"])


def _require_tenant(user: CurrentUser) -> uuid.UUID:
    """Raise 400 if user has no tenant context."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No tenant context.")
    return user.tenant_id


def _require_finance_or_admin(user: CurrentUser) -> None:
    """Raise 403 if user does not hold Finance, Tenant Admin, or Super Admin authority.

    Maps to real CurrentUser fields:
    - is_super_admin: platform-level super admin (always passes)
    - is_tenant_admin: tenant administrator role (always passes)
    - role_tier "power_admin": equivalent to finance/power admin inside a tenant
    - role_tier "functional_admin": functional admin (finance team lead, etc.)
    Regular employees (role_tier "user" or None) are denied.
    """
    if user.is_super_admin or user.is_tenant_admin:
        return
    if user.role_tier in ("power_admin", "functional_admin"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Finance or Admin access required.",
    )


def _require_tenant_admin(user: CurrentUser) -> None:
    """Raise 403 if user does not hold Tenant Admin or Super Admin authority.

    Only tenant administrators and super admins may change ICE configuration.
    power_admin role_tier is also accepted as it has equivalent tenant-level
    admin capability (mirrors the convention used in platform.py and other
    admin-only endpoints across the codebase).
    """
    if user.is_super_admin or user.is_tenant_admin:
        return
    if user.role_tier == "power_admin":
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tenant Admin access required.",
    )


# ── POST /api/ai/ice/predict ──────────────────────────────────────────────────

@router.post("/predict", response_model=IcePredictResponse, status_code=status.HTTP_200_OK)
async def ice_predict(
    body: IcePredictRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> IcePredictResponse:
    """
    Request a GL account + category suggestion for an expense line.

    Returns a structured prediction with a confidence score (0-100) and a
    confidence band (HIGH/MEDIUM/LOW) derived from the tenant's thresholds.

    Status codes:
        200  — prediction returned (even LOW confidence predictions return 200)
        400  — no tenant context
        503  — AI engine unavailable or not configured
    """
    tenant_id = _require_tenant(current_user)
    try:
        result = await predict(
            db=db,
            tenant_id=tenant_id,
            user_id=current_user.user_id,
            description=body.description,
            amount=body.amount,
            vendor_name=body.vendor_name,
            expense_line_id=body.expense_line_id,
        )
    except IceServiceError as exc:
        # Never expose internal details — only the generic message reaches the client
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI analysis is temporarily unavailable. Please try again later.",
        )
    return IcePredictResponse(**result)


# ── POST /api/ai/ice/feedback ─────────────────────────────────────────────────

@router.post("/feedback", response_model=IceFeedbackResponse, status_code=status.HTTP_201_CREATED)
async def ice_feedback(
    body: IceFeedbackRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> IceFeedbackResponse:
    """
    Submit the user's response to an ICE prediction.

    Call this after the user acts on the suggestion:
    - If they accepted: body.accepted=True, corrected_* fields can be omitted.
    - If they corrected: body.accepted=False, populate corrected_gl_id etc.

    The feedback is stored, the vendor and employee behavior profiles are updated,
    and the event is logged to the ice_audit_log.

    Status codes:
        201  — feedback recorded
        400  — no tenant context
        503  — service unavailable
    """
    tenant_id = _require_tenant(current_user)
    try:
        result = await record_feedback(
            db=db,
            tenant_id=tenant_id,
            user_id=current_user.user_id,
            prediction_id=body.prediction_id,
            accepted=body.accepted,
            corrected_gl_id=body.corrected_gl_id,
            corrected_gl_number=body.corrected_gl_number,
            corrected_gl_name=body.corrected_gl_name,
            corrected_category=body.corrected_category,
            corrected_dimensions=body.corrected_dimensions,
            corrected_by_role=body.corrected_by_role,
            correction_reason=body.correction_reason,
            vendor_name=body.vendor_name,
        )
    except IceServiceError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI analysis is temporarily unavailable. Please try again later.",
        )
    return IceFeedbackResponse(**result)


# ── GET /api/ai/ice/config ────────────────────────────────────────────────────

@router.get("/config", response_model=IceConfigResponse, status_code=status.HTTP_200_OK)
async def get_ice_config(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> IceConfigResponse:
    """
    Return the tenant's ICE configuration.

    Called by the expense form to determine whether to show AI suggestions
    and by the Tenant Admin config page to display current settings.

    Status codes:
        200  — config returned (auto-created if first call)
        400  — no tenant context
    """
    tenant_id = _require_tenant(current_user)
    config = await get_or_create_config(db, tenant_id)
    await db.commit()  # flush the auto-creation if it happened
    return IceConfigResponse.model_validate(config)


# ── PATCH /api/ai/ice/config ──────────────────────────────────────────────────

@router.patch("/config", response_model=IceConfigResponse, status_code=status.HTTP_200_OK)
async def patch_ice_config(
    body: IceConfigUpdate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> IceConfigResponse:
    """
    Update the tenant's ICE configuration.

    Tenant Admin only. All fields are optional — only provided fields change.

    Status codes:
        200  — config updated
        400  — no tenant context
        403  — insufficient role
    """
    tenant_id = _require_tenant(current_user)
    _require_tenant_admin(current_user)

    updates = body.model_dump(exclude_none=True)
    config = await update_config(db, tenant_id, current_user.user_id, updates)
    return IceConfigResponse.model_validate(config)


# ── GET /api/ai/ice/analytics ─────────────────────────────────────────────────

@router.get("/analytics", response_model=IcePredictionStats, status_code=status.HTTP_200_OK)
async def ice_analytics(
    period_days: int = Query(30, ge=7, le=365, description="Look-back window in days."),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> IcePredictionStats:
    """
    Return ICE accuracy metrics for the given period.

    Includes: total predictions, acceptance rate, confidence distribution,
    and the top 5 GL accounts most frequently corrected to by users.

    Finance and Admin only.

    Status codes:
        200  — metrics returned
        400  — no tenant context
        403  — insufficient role
    """
    tenant_id = _require_tenant(current_user)
    _require_finance_or_admin(current_user)

    data = await get_analytics(db, tenant_id, period_days=period_days)
    return IcePredictionStats(**data)


# ── GET /api/ai/ice/audit-log ─────────────────────────────────────────────────

@router.get("/audit-log", response_model=list[IceAuditLogEntry], status_code=status.HTTP_200_OK)
async def ice_audit_log(
    limit: int = Query(50, le=200),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[IceAuditLogEntry]:
    """
    Return recent ICE audit log entries for the tenant, newest first.

    Append-only log — never modified after creation. Finance / Admin only.

    Status codes:
        200  — audit entries returned
        400  — no tenant context
        403  — insufficient role
    """
    tenant_id = _require_tenant(current_user)
    _require_finance_or_admin(current_user)

    result = await db.execute(
        select(IceAuditLog)
        .where(IceAuditLog.tenant_id == tenant_id)
        .order_by(IceAuditLog.created_at.desc())
        .limit(limit)
    )
    return [IceAuditLogEntry.model_validate(row) for row in result.scalars().all()]
