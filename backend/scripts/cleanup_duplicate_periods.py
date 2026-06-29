"""
One-off cleanup for accounting_periods rows duplicated under different
fiscal_year labels.

Root cause: the auto-generation triggers (PATCH /api/setup/org and the
hard-close roll-forward in routers/setup.py) used to check "does this fiscal
year already have periods?" by comparing the *formatted* fiscal_year label.
That label is derived from fiscal_year_name_format + fiscal_year_start_month
and changes whenever either setting changes -- so a format/start-month change
made the check miss the existing rows and silently generate a second, fully
duplicate set of periods for the same months under the new label.

Run this BEFORE applying migration k7l8m9n0o1p2, which adds a DB-level unique
constraint on (tenant_id, start_date). That migration will fail with an
IntegrityError if duplicate rows still exist.

Usage (from backend/, with venv active and .env pointing at the target DB):
    python -m scripts.cleanup_duplicate_periods            # dry run, prints plan
    python -m scripts.cleanup_duplicate_periods --apply    # actually deletes

For each (tenant, start_date) with more than one distinct fiscal_year label,
keeps the row whose label matches what that tenant's CURRENT
fiscal_year_name_format / fiscal_year_start_month would generate today, and
deletes the rest (close_checklist_items cascade automatically via FK).
Afterwards deletes any fiscal_year_states rows left with no matching
accounting_periods.
"""
import argparse
import asyncio
import calendar as _cal
import sys
from collections import defaultdict
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.setup import (  # noqa: E402
    AccountingPeriod,
    FiscalYearState,
    TenantOrgConfig,
)


def _build_fy_label(fmt: Optional[str], year: int, start_month: int = 1) -> str:
    """Mirrors app.routers.setup._build_fy_label — keep in sync if that changes."""
    template = fmt or "FYYYYY"
    next_year = year + 1
    start_mon_abbr = _cal.month_abbr[start_month]
    end_mon_num = ((start_month - 2) % 12) + 1
    end_mon_abbr = _cal.month_abbr[end_mon_num]
    end_year = year if end_mon_num >= start_month else next_year
    return (
        template
        .replace("FYYYYY", f"FY{year}")
        .replace("YYYY/YYYY", f"{year}/{next_year}")
        .replace("YYYY-YYYY", f"{year}-{next_year}")
        .replace("MMM YYYY - MMM YYYY", f"{start_mon_abbr} {year} - {end_mon_abbr} {end_year}")
        .replace("YYYY", str(year))
        .replace("{year}", str(year))
        .replace("{nextyear}", str(next_year))
        .replace("MMM", _cal.month_abbr[1])
    )


async def main(apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        periods = (await db.execute(select(AccountingPeriod))).scalars().all()
        orgs = {
            o.tenant_id: o
            for o in (await db.execute(select(TenantOrgConfig))).scalars().all()
        }

        groups: dict[tuple, list[AccountingPeriod]] = defaultdict(list)
        for p in periods:
            groups[(p.tenant_id, p.start_date)].append(p)

        to_delete: list[AccountingPeriod] = []
        for (tenant_id, start_date), rows in groups.items():
            labels = {r.fiscal_year for r in rows}
            if len(labels) <= 1:
                continue  # no duplication for this tenant/date

            org = orgs.get(tenant_id)
            keep_label = _build_fy_label(
                org.fiscal_year_name_format if org else None,
                start_date.year,
                (org.fiscal_year_start_month or 1) if org else 1,
            )
            keepers = [r for r in rows if r.fiscal_year == keep_label]
            losers = [r for r in rows if r.fiscal_year != keep_label]

            if not keepers:
                # Current format doesn't match ANY existing label (it's been
                # changed again since) -- keep the first row deterministically
                # and flag it so a human can sanity-check.
                keepers = [rows[0]]
                losers = rows[1:]
                print(
                    f"  ! no label matches current format for tenant {tenant_id} "
                    f"{start_date} -- defaulting to keep {keepers[0].fiscal_year!r}"
                )

            print(
                f"tenant={tenant_id} start_date={start_date}: "
                f"keep '{keepers[0].fiscal_year}' (id={keepers[0].id}), "
                f"delete {[(r.fiscal_year, str(r.id)) for r in losers]}"
            )
            to_delete.extend(losers)

        if not to_delete:
            print("No duplicate periods found. Nothing to do.")
            return

        print(f"\n{len(to_delete)} duplicate period row(s) to delete.")
        if not apply:
            print("Dry run only -- re-run with --apply to actually delete.")
            return

        for r in to_delete:
            await db.delete(r)
        await db.flush()

        # Drop now-orphaned fiscal_year_states (no remaining periods under that label)
        remaining = (await db.execute(select(AccountingPeriod))).scalars().all()
        live_labels = {(r.tenant_id, r.fiscal_year) for r in remaining}
        fy_states = (await db.execute(select(FiscalYearState))).scalars().all()
        orphaned = [s for s in fy_states if (s.tenant_id, s.fiscal_year) not in live_labels]
        for s in orphaned:
            print(f"deleting orphaned fiscal_year_state tenant={s.tenant_id} fy={s.fiscal_year}")
            await db.delete(s)

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually delete (default is dry-run)")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
