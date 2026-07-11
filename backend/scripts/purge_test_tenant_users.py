"""
purge_test_tenant_users.py
===========================
One-off: hard-remove users from a test/pre-live tenant.

For each inactive UserTenant row in the target tenant:
  - Delete the UserTenant row for this tenant.
  - If the user has NO other UserTenant rows anywhere → hard-delete the User
    row entirely (cascades to sessions, refresh_tokens, etc.).
  - If the user HAS other tenant memberships → leave the User row intact
    (they exist in a live tenant; removing them would break that tenant).

Default: dry-run. Pass --apply to commit.
Pass --tenant <uuid> to target a specific tenant (required).

Usage:
  cd backend && source .venv/bin/activate
  python scripts/purge_test_tenant_users.py --tenant e8a2fd8c-5466-4618-bb37-97681a8bfb05
  python scripts/purge_test_tenant_users.py --tenant e8a2fd8c-5466-4618-bb37-97681a8bfb05 --apply
"""

import argparse
import asyncio
import logging
import os
import sys
import uuid as _uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import delete as sa_delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.auth import User, UserTenant

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


async def run(apply: bool, tenant_id: _uuid.UUID) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Step 1: all UserTenant rows for this tenant (active or inactive)
        rows = (await db.execute(
            select(UserTenant, User)
            .join(User, User.id == UserTenant.user_id)
            .where(UserTenant.tenant_id == tenant_id)
            .order_by(User.full_name)
        )).all()

        if not rows:
            log.info("No UserTenant rows found for tenant %s. Nothing to do.", tenant_id)
            await engine.dispose()
            return

        log.info("Found %d UserTenant row(s) in tenant %s.", len(rows), tenant_id)

        # Step 2: for each user, count their OTHER tenant memberships
        will_delete_user: list[tuple[UserTenant, User]] = []
        will_delete_ut_only: list[tuple[UserTenant, User]] = []

        for ut, user in rows:
            other_count_res = await db.execute(
                select(func.count()).select_from(UserTenant).where(
                    UserTenant.user_id == user.id,
                    UserTenant.id != ut.id,
                )
            )
            other_count = other_count_res.scalar_one()
            if other_count == 0:
                will_delete_user.append((ut, user))
            else:
                will_delete_ut_only.append((ut, user))

        log.info(
            "%d user(s) will be HARD-DELETED (no other memberships):",
            len(will_delete_user),
        )
        for _, user in will_delete_user:
            log.info("    DELETE USER  %-40s  %s", user.email, user.full_name or "")

        log.info(
            "%d user(s) will have only the UserTenant row removed (have other memberships):",
            len(will_delete_ut_only),
        )
        for _, user in will_delete_ut_only:
            log.info("    REMOVE UT    %-40s  %s", user.email, user.full_name or "")

        if not apply:
            log.info("\nDRY-RUN complete. Re-run with --apply to commit changes.")
            await engine.dispose()
            return

        # Step 3: apply
        deleted_users = 0
        removed_uts = 0

        # Hard-delete users with no other memberships (CASCADE removes their UserTenant too)
        for _, user in will_delete_user:
            user_obj = await db.get(User, user.id)
            if user_obj:
                await db.delete(user_obj)
                deleted_users += 1

        # Delete only the UserTenant row for users who have other memberships
        for ut, _ in will_delete_ut_only:
            ut_obj = await db.get(UserTenant, ut.id)
            if ut_obj:
                await db.delete(ut_obj)
                removed_uts += 1

        await db.commit()
        log.info(
            "Done. Hard-deleted %d User row(s), removed %d UserTenant row(s).",
            deleted_users,
            removed_uts,
        )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Purge all users from a test/pre-live tenant."
    )
    parser.add_argument("--tenant", required=True, metavar="UUID",
                        help="Tenant UUID to purge users from.")
    parser.add_argument("--apply", action="store_true",
                        help="Commit changes. Default is dry-run.")
    args = parser.parse_args()

    try:
        tid = _uuid.UUID(args.tenant)
    except ValueError:
        print(f"ERROR: invalid UUID: {args.tenant}")
        raise SystemExit(1)

    mode = "APPLY" if args.apply else "DRY-RUN"
    log.info("Mode: %s | Tenant: %s", mode, tid)

    asyncio.run(run(apply=args.apply, tenant_id=tid))


if __name__ == "__main__":
    main()
