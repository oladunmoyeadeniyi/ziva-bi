"""
ZivaBI — M8.3 Period Engine service module (Briefs 1 & 2 of 4).

Provides:
    is_date_postable   — reusable postability check for any posting engine to call.
    apply_auto_soft_close — transitions an OPEN period to SOFT_CLOSED when today
                            has moved past its end_date; also computes grace_expires_at.
    compute_grace_expiry — converts (soft_closed_at, grace_value, grace_unit) to a
                           timezone-aware expiry datetime.
    get_matching_grace_row — finds the most-specific grace override row for a caller.
    generate_monthly_periods — builds the 12 (period_no, name, start, end) tuples.
    initial_status_for — determines initial status by comparing dates to today.
    parse_fy_start_year — extracts starting calendar year from a FY label string.

Allowed module values (validated at endpoint layer; checked here for context):
    default | expense | manual_journal | future_exception

Extension points for later briefs:
    Brief 3 — close-checklist gate: in routers/setup.py hard_close_period.
              Stub comment: # BRIEF-3: checklist gate
    Brief 4 — audit log on reopen: in routers/setup.py reopen_period.
              Stub comment: # BRIEF-4: audit log on reopen

This module MUST NOT be imported from inside routers at module load time to avoid
circular imports — always import at the top of the router file, not inside functions.
"""

import re
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setup import (
    AccountingPeriod,
    FuturePostingException,
    PeriodGraceOverride,
    TenantOrgConfig,
)


# Month abbreviations used in period_name: "January 2026" style (full names).
_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Allowed module values — validated at the endpoint layer.
ALLOWED_MODULES = {"default", "expense", "manual_journal", "future_exception"}


# ── Grace helpers ─────────────────────────────────────────────────────────────

def compute_grace_expiry(
    soft_closed_at: datetime,
    grace_value: int,
    grace_unit: str,
) -> datetime:
    """
    Return the datetime after which the grace window for this period expires.

    Args:
        soft_closed_at: When the period was soft-closed (timezone-aware).
        grace_value:    Number of days.
        grace_unit:     "calendar_days" or "workdays".

    For calendar_days: simple timedelta addition.
    For workdays: advance one calendar day at a time, counting only Mon–Fri.
        # FUTURE: subtract public holidays when a holiday calendar is available.
    """
    if grace_unit == "calendar_days":
        return soft_closed_at + timedelta(days=grace_value)

    # workdays — skip weekends (Sat=5, Sun=6 in Python's weekday())
    remaining = grace_value
    current_date = soft_closed_at.date()
    while remaining > 0:
        current_date += timedelta(days=1)
        if current_date.weekday() < 5:  # Mon–Fri
            remaining -= 1
        # FUTURE: subtract public holidays — check against a tenant holiday calendar here.

    # Preserve the original time-of-day component; replace only the date.
    expiry = datetime.combine(current_date, soft_closed_at.time())
    return expiry.replace(tzinfo=soft_closed_at.tzinfo)


async def get_matching_grace_row(
    tenant_id: UUID,
    period_type: str,
    db: AsyncSession,
    module: Optional[str] = None,
    user_id: Optional[UUID] = None,
    role_tier: Optional[str] = None,
) -> Optional[PeriodGraceOverride]:
    """
    Find the most-specific grace override row for a given caller context.

    Precedence (highest to lowest):
        1. User-specific (applies_to_type="user", applies_to_user_id=user_id)
        2. Role-specific (applies_to_type="role", applies_to_role=role_tier)
        3. All users (applies_to_type="all")

    Within each specificity tier, a row whose module matches the given module
    beats a row with module="default".

    Args:
        tenant_id:   Tenant being checked.
        period_type: "regular" or "year_end".
        db:          Async database session.
        module:      Posting module ("expense", "manual_journal", etc.) or None.
        user_id:     UUID of the posting user, or None.
        role_tier:   Role tier of the posting user ("consultant", etc.) or None.

    Returns the best-matching row, or None if no rows exist at all.
    """
    result = await db.execute(
        select(PeriodGraceOverride).where(
            PeriodGraceOverride.tenant_id == tenant_id,
            PeriodGraceOverride.period_type == period_type,
        )
    )
    rows = result.scalars().all()

    best: Optional[PeriodGraceOverride] = None
    best_score = -1

    for row in rows:
        # ── Module relevance ──────────────────────────────────────────────────
        # A row is relevant if its module matches the given module, OR is "default".
        # A module-specific match is preferred over "default".
        if module and row.module not in (module, "default"):
            continue
        if not module and row.module != "default":
            continue

        mod_score = 1 if row.module == module else 0

        # ── Specificity ───────────────────────────────────────────────────────
        if row.applies_to_type == "user":
            if user_id and row.applies_to_user_id == user_id:
                spec = 3
            else:
                continue
        elif row.applies_to_type == "role":
            if role_tier and row.applies_to_role == role_tier:
                spec = 2
            else:
                continue
        elif row.applies_to_type == "all":
            spec = 1
        else:
            continue

        score = spec * 10 + mod_score
        if score > best_score:
            best_score = score
            best = row

    return best


async def _get_default_grace_row(
    tenant_id: UUID,
    db: AsyncSession,
) -> Optional[PeriodGraceOverride]:
    """Return the is_default=True row for this tenant, or None if not seeded yet."""
    result = await db.execute(
        select(PeriodGraceOverride).where(
            PeriodGraceOverride.tenant_id == tenant_id,
            PeriodGraceOverride.is_default == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()


# ── Auto-soft-close ───────────────────────────────────────────────────────────

async def apply_auto_soft_close(period: AccountingPeriod, db: AsyncSession) -> bool:
    """
    Transition an OPEN period to SOFT_CLOSED if today has moved past its end_date.

    Also computes and persists `grace_expires_at` from the tenant's default regular-period
    grace row (Brief 2). If no grace row exists yet, `grace_expires_at` stays None.

    Returns True if the transition was made, False otherwise.
    Future: move this to a scheduled job (cron/celery) when infrastructure allows.
    """
    today = date.today()
    if period.status != "OPEN" or today <= period.end_date:
        return False

    period.status = "SOFT_CLOSED"
    now = datetime.now(timezone.utc)
    period.soft_closed_at = now

    # Compute grace_expires_at from the default grace row (no user/module context at auto-close time).
    default_row = await _get_default_grace_row(period.tenant_id, db)
    if default_row:
        period.grace_expires_at = compute_grace_expiry(now, default_row.grace_value, default_row.grace_unit)

    db.add(period)
    await db.flush()
    return True


# ── Postability check ─────────────────────────────────────────────────────────

async def is_date_postable(
    tenant_id: UUID,
    target_date: date,
    db: AsyncSession,
    user_id: Optional[UUID] = None,
    module: Optional[str] = None,
    role_tier: Optional[str] = None,
) -> tuple[bool, str]:
    """
    Check whether target_date is open for posting by this tenant.

    Returns (True, "") when posting is allowed, (False, <reason>) when not.

    Optional params (Brief 2):
        user_id:   UUID of the posting user — used to find user-specific grace rows.
        module:    Posting module — used to find module-specific grace rows and for
                   the manual-journal block check. Falls back to "default" when None.
        role_tier: Role tier of the posting user — used for role-specific grace rows.

    Logic:
        1. Date before date_of_registration → not postable.
        2. No period covers target_date → not postable.
        3. FUTURE → check for future-dated exception; if none → not postable.
        4. HARD_CLOSED → not postable.
        5. OPEN → postable (with manual-journal block check if module="manual_journal").
        6. SOFT_CLOSED / OVERDUE → find best grace row; if within grace → postable;
           else set status to OVERDUE and return not postable.
        7. (manual_journal only, for any postable status) → check earlier-period block.
    """
    # ── 1. Registration-date floor ────────────────────────────────────────────
    org_result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org = org_result.scalar_one_or_none()
    if org and org.date_of_registration and target_date < org.date_of_registration:
        return False, "Date is before the organisation's date of registration."

    # ── 2. Find the covering period ───────────────────────────────────────────
    result = await db.execute(
        select(AccountingPeriod).where(
            AccountingPeriod.tenant_id == tenant_id,
            AccountingPeriod.start_date <= target_date,
            AccountingPeriod.end_date >= target_date,
        )
    )
    period = result.scalar_one_or_none()

    if period is None:
        return False, "No accounting period defined for this date."

    # Auto-soft-close in case the period slipped past while still OPEN.
    if await apply_auto_soft_close(period, db):
        await db.commit()

    # ── 3. FUTURE — check for a logged exception ──────────────────────────────
    if period.status == "FUTURE":
        # Check if a FuturePostingException exists for this tenant + date + module.
        fpe_query = select(FuturePostingException).where(
            FuturePostingException.tenant_id == tenant_id,
            FuturePostingException.target_date == target_date,
        )
        if module:
            fpe_query = fpe_query.where(FuturePostingException.module == module)
        fpe_result = await db.execute(fpe_query)
        if fpe_result.scalars().first() is not None:
            return True, "Future-dated exception on record."
        return False, "Period has not started yet."

    # ── 4. HARD_CLOSED ───────────────────────────────────────────────────────
    if period.status == "HARD_CLOSED":
        return False, "Period is hard-closed."

    # ── 5-6. OPEN / SOFT_CLOSED / OVERDUE ────────────────────────────────────
    if period.status in ("SOFT_CLOSED", "OVERDUE"):
        # Find the most-specific grace row for this caller.
        grace_row = await get_matching_grace_row(
            tenant_id, "regular", db,
            module=module, user_id=user_id, role_tier=role_tier,
        )

        if grace_row is None:
            # No grace configured at all — fall back to the seeded default if available.
            grace_row = await _get_default_grace_row(tenant_id, db)

        if grace_row is not None:
            soft_ts = period.soft_closed_at or datetime.now(timezone.utc)
            expiry = compute_grace_expiry(soft_ts, grace_row.grace_value, grace_row.grace_unit)
            if datetime.now(timezone.utc) > expiry:
                # Grace expired — mark as OVERDUE and block posting.
                if period.status != "OVERDUE":
                    period.status = "OVERDUE"
                    db.add(period)
                    await db.commit()
                return False, "Grace period for posting into this period has expired."
        # Within grace (or no grace configured → always open while SOFT_CLOSED).

    # ── 7. Manual-journal block ───────────────────────────────────────────────
    if module == "manual_journal" and org and org.block_journal_into_open_prior:
        earlier_result = await db.execute(
            select(AccountingPeriod).where(
                AccountingPeriod.tenant_id == tenant_id,
                AccountingPeriod.start_date < period.start_date,
                AccountingPeriod.status != "HARD_CLOSED",
            )
        )
        if earlier_result.scalars().first() is not None:
            return (
                False,
                "Cannot post a manual journal into this period while an earlier period is not hard-closed.",
            )

    return True, ""


# ── Calendar helpers ──────────────────────────────────────────────────────────

def generate_monthly_periods(
    fy_start: date,
    num_periods: int = 12,
    start_day: int = 1,
) -> list[tuple[int, str, date, date]]:
    """
    Build a list of (period_no, period_name, start_date, end_date) tuples.

    period_no is 1-based. Period names use full month names ("January 2026").
    The first period begins at fy_start; each subsequent period starts on
    start_day of the next calendar month.
    """
    periods: list[tuple[int, str, date, date]] = []
    current = fy_start

    for i in range(num_periods):
        period_no = i + 1
        period_end_day = monthrange(current.year, current.month)[1]
        end = date(current.year, current.month, period_end_day)
        name = f"{_MONTH_NAMES[current.month - 1]} {current.year}"
        periods.append((period_no, name, current, end))

        next_month = current.month + 1
        next_year = current.year + (1 if next_month > 12 else 0)
        next_month = next_month if next_month <= 12 else 1
        current = date(next_year, next_month, start_day)

    return periods


def initial_status_for(start_date: date, end_date: date) -> str:
    """
    Determine the initial status for a newly-generated period based on today.

    - entirely in the past (end_date < today)  → SOFT_CLOSED
    - contains today                            → OPEN
    - entirely in the future                   → FUTURE
    """
    today = date.today()
    if end_date < today:
        return "SOFT_CLOSED"
    if start_date <= today <= end_date:
        return "OPEN"
    return "FUTURE"


def parse_fy_start_year(fiscal_year_label: str) -> Optional[int]:
    """
    Extract the starting calendar year from a fiscal year label.

    Supports "FY2026", "2025/2026", "2026", etc. Returns None if no year found.
    """
    match = re.search(r"(\d{4})", fiscal_year_label)
    if not match:
        return None
    return int(match.group(1))
