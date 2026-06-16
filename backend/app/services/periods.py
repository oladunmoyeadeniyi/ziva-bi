"""
ZivaBI — M8.3 Period Engine service module (Brief 1 of 4).

Provides:
    is_date_postable   — reusable postability check for any posting engine to call.
    apply_auto_soft_close — transitions an OPEN period to SOFT_CLOSED when today
                            has moved past its end_date (persists immediately).
    generate_monthly_periods — builds the 12 (date, period_no, period_name) tuples
                                for a monthly fiscal year starting from fy_start.

Extension points for later briefs:
    Brief 2  — grace-period override: inside is_date_postable where OVERDUE is
               checked, call a grace-table lookup to allow posting past soft-close
               deadline with a logged exception. Stub comment: # BRIEF-2: grace override
    Brief 3  — close-checklist gate: before hard-closing in the router, call a
               checklist_complete(period_id, db) guard here. Stub comment: # BRIEF-3: checklist gate
    Brief 4  — audit log on reopen: after incrementing reopened_count in the router,
               write an audit entry here. Stub comment: # BRIEF-4: audit log on reopen

This module MUST NOT be imported from inside routers at module load time to avoid
circular imports — always import inside the function or at the top of the router file.
"""

import re
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setup import AccountingPeriod, TenantOrgConfig


# Month abbreviations used in period_name: "January 2026" style (full names).
_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


async def apply_auto_soft_close(period: AccountingPeriod, db: AsyncSession) -> bool:
    """
    Transition an OPEN period to SOFT_CLOSED if today has moved past its end_date.

    Returns True if the transition was made and committed, False otherwise.
    Called on every list/check read so the state machine stays consistent without
    a scheduler. Future: move this to a scheduled job (Brief 2 or infra sprint).
    """
    today = date.today()
    if period.status == "OPEN" and today > period.end_date:
        period.status = "SOFT_CLOSED"
        period.soft_closed_at = datetime.now(timezone.utc)
        db.add(period)
        await db.flush()
        return True
    return False


async def is_date_postable(
    tenant_id: UUID,
    target_date: date,
    db: AsyncSession,
) -> tuple[bool, str]:
    """
    Check whether target_date is open for posting by this tenant.

    Returns (True, "") when posting is allowed, (False, <reason>) when not.

    Called by: expense posting (future), AP, payroll — any module that needs
    to gate journal entries by accounting period status.

    Logic (Brief 1):
        1. date before date_of_registration → not postable
        2. no period covers target_date → not postable
        3. FUTURE → not postable
        4. HARD_CLOSED → not postable
        5. OPEN or SOFT_CLOSED → postable
           (Brief 2 will refine SOFT_CLOSED via the grace table — # BRIEF-2: grace override)
        OVERDUE is treated as SOFT_CLOSED here — same posting permission.
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

    # Auto-soft-close in case the period slipped to past while still OPEN.
    await apply_auto_soft_close(period, db)
    await db.commit()

    # ── 3-5. Status gate ─────────────────────────────────────────────────────
    if period.status == "FUTURE":
        return False, "Period has not started yet."

    if period.status == "HARD_CLOSED":
        return False, "Period is hard-closed."

    # OPEN, SOFT_CLOSED, OVERDUE → postable
    # BRIEF-2: grace override — for SOFT_CLOSED/OVERDUE, check grace_expires_at
    #          and raise a 422 with a logged exception if grace has passed.
    return True, ""


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

    Args:
        fy_start:    First day of the first period.
        num_periods: Number of monthly periods to generate (default 12).
        start_day:   Day-of-month on which subsequent periods begin (usually 1).

    Returns:
        List of (period_no, period_name, start_date, end_date) tuples.
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

    - entirely in the past (end_date < today) → SOFT_CLOSED
    - contains today (start_date <= today <= end_date) → OPEN
    - entirely in the future (start_date > today) → FUTURE
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

    Supports "FY2026", "2025/2026", "2026", etc.
    Returns None if no 4-digit year is found.
    """
    match = re.search(r"(\d{4})", fiscal_year_label)
    if not match:
        return None
    return int(match.group(1))
