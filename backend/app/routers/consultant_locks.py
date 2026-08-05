"""Router — Consultant Section Locks.

Allows a PRAD consultant (super admin in implementation mode) to lock or
unlock specific setup sections within a tenant. Locked sections are visible
to power_admin and functional_admin users but their forms are disabled.

Route map:
  GET  /api/locks              — list all lock states for the current tenant
  PUT  /api/locks/{section_key} — create or update a lock (SA implementation only)

Access rules:
  GET: any authenticated user with a tenant_id (SA impersonating counts).
  PUT: super admin ONLY, and only when impersonation_mode == "implementation".
       Support-mode impersonation is read-only and cannot set locks.

Design decision: locks are never deleted — rows are toggled between
is_locked=True/False. This preserves the full audit trail (who locked,
when, when unlocked).
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.consultant_lock import ConsultantLock, VALID_SECTION_KEYS
from app.schemas.consultant_lock import ConsultantLockRead, ConsultantLockUpsert, LocksResponse

router = APIRouter(prefix="/api/locks", tags=["consultant-locks"])


def _assert_implementation_mode(current_user: CurrentUser) -> None:
    """Raise 403 unless the caller is an SA in implementation mode.

    Support-mode impersonation is read-only; billing/portal SAs with no
    impersonation also cannot set locks (they would have no tenant context).

    Args:
        current_user: Decoded JWT from require_auth.

    Raises:
        HTTPException 403: Not a super admin, or not in implementation mode.
    """
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only PRAD consultants can lock or unlock sections.",
        )
    if current_user.impersonation_mode != "implementation":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Section locks can only be set while in implementation mode. "
                "Support sessions are read-only."
            ),
        )


def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    """Return tenant_id or raise 400 if the user has no tenant context.

    Args:
        current_user: Decoded JWT from require_auth.

    Returns:
        The tenant_id UUID.

    Raises:
        HTTPException 400: No tenant context available.
    """
    tid = current_user.tenant_id
    if tid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant context — cannot read section locks.",
        )
    return tid


async def _row_to_schema(row: ConsultantLock) -> ConsultantLockRead:
    """Convert an ORM row to the response schema.

    Args:
        row: ConsultantLock ORM instance.

    Returns:
        ConsultantLockRead Pydantic model.
    """
    return ConsultantLockRead(
        section_key=row.section_key,
        is_locked=row.is_locked,
        lock_note=row.lock_note,
        locked_by_id=row.locked_by,
        locked_at=row.locked_at,
        unlocked_at=row.unlocked_at,
    )


# ── GET /api/locks ────────────────────────────────────────────────────────────

@router.get("", response_model=LocksResponse)
async def list_locks(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> LocksResponse:
    """Return all lock states for the current tenant.

    Only returns sections that have a DB row — sections without a row are
    implicitly unlocked. The frontend keys into the returned dict and treats
    absent keys as unlocked.

    Available to any authenticated user with a tenant context (including
    SA in implementation/support mode and regular tenant users).

    Returns:
        LocksResponse: Map of section_key → ConsultantLockRead.
    """
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(ConsultantLock).where(ConsultantLock.tenant_id == tenant_id)
    )
    rows = result.scalars().all()

    locks: dict[str, ConsultantLockRead] = {}
    for row in rows:
        locks[row.section_key] = await _row_to_schema(row)

    return LocksResponse(locks=locks)


# ── PUT /api/locks/{section_key} ──────────────────────────────────────────────

@router.put("/{section_key}", response_model=ConsultantLockRead)
async def upsert_lock(
    section_key: str,
    payload: ConsultantLockUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ConsultantLockRead:
    """Create or update a section lock.

    Idempotent — if the row already exists, it is updated in-place.
    The locked_at / unlocked_at timestamps are set based on is_locked.

    Only callable by a super admin in implementation mode.

    Args:
        section_key: Which section to lock/unlock. Must be a valid key.
        payload:     is_locked (bool) + optional lock_note (str).

    Returns:
        ConsultantLockRead: Updated lock state.

    Raises:
        403: Not SA in implementation mode.
        422: Unknown section_key.
    """
    _assert_implementation_mode(current_user)
    tenant_id = _require_tenant(current_user)

    if section_key not in VALID_SECTION_KEYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unknown section key '{section_key}'. "
                f"Valid keys: {sorted(VALID_SECTION_KEYS)}"
            ),
        )

    now = datetime.now(timezone.utc)

    # Try to find an existing row
    result = await db.execute(
        select(ConsultantLock).where(
            ConsultantLock.tenant_id == tenant_id,
            ConsultantLock.section_key == section_key,
        )
    )
    row = result.scalar_one_or_none()

    if row is None:
        # First time this section is touched — create the row
        row = ConsultantLock(
            tenant_id=tenant_id,
            section_key=section_key,
            is_locked=payload.is_locked,
            lock_note=payload.lock_note,
            locked_by=current_user.user_id,
            locked_at=now,
            unlocked_at=None if payload.is_locked else now,
        )
        db.add(row)
    else:
        # Update in-place — preserve the row so audit trail is intact
        row.is_locked = payload.is_locked
        row.lock_note = payload.lock_note
        row.locked_by = current_user.user_id
        if payload.is_locked:
            row.locked_at = now
            # Don't clear unlocked_at so we know when it was last unlocked
        else:
            row.unlocked_at = now

    await db.commit()
    await db.refresh(row)

    return await _row_to_schema(row)
