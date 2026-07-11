"""
cleanup_orphan_employee_usertenant.py
======================================
One-off cleanup: deactivate UserTenant rows that belong to employees who were
deleted (soft or hard) before the cascade email-fallback fix shipped in commit
d7ddea6 (2026-07-11).

Background
----------
Prior to d7ddea6, _cascade_employee_deactivate and _cascade_employee_hard_delete
both returned early when emp.user_id was None.  This meant that any employee
deleted while their user_id column was still NULL kept their portal account
active (UserTenant.is_active = True), making them appear as Active users in the
SA portal and allowing them to continue logging in.

Strategy
--------
For every tenant, find UserTenant rows where:
  - user_type = 'employee'          (portal account tied to an employee)
  - is_active = True                (still appears active)

For each such row, resolve the user's email from the users table, then check
whether there is a currently-active employee (employees.is_active = True) in
the same tenant with that email (case-insensitive).

  - Active employee found  -> leave alone
  - No active employee     -> deactivate UserTenant + revoke sessions

Covers:
  - Hard-deleted employees (row gone from employees table entirely)
  - Soft-deleted employees (is_active = False) whose user_id was None at
    deletion time so the cascade never fired

Sessions
--------
Session rows FK to user_tenants.id via user_tenant_id only.
There is no Session.user_id or Session.tenant_id column.
We delete sessions by Session.user_tenant_id == ut.id.

Usage
-----
  # Dry-run (default - shows what would change, commits nothing):
  python scripts/cleanup_orphan_employee_usertenant.py

  # Apply changes:
  python scripts/cleanup_orphan_employee_usertenant.py --apply

  # Scope to one tenant:
  python scripts/cleanup_orphan_employee_usertenant.py --tenant <uuid> --apply

Run from backend/ with venv active. Requires DATABASE_URL in .env.
"""

import argparse
import asyncio
import logging
import os
import sys
import uuid as _uuid
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.auth import Session as UserSession
from app.models.auth import User, UserTenant
from app.models.master_data import Employee

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


async def run(apply: bool, tenant_filter: str | None) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Step 1: collect candidate UserTenant rows
        q = (
            select(UserTenant, User)
            .join(User, User.id == UserTenant.user_id)
            .where(
                UserTenant.user_type == "employee",
                UserTenant.is_active.is_(True),
            )
        )
        tid = None
        if tenant_filter:
            try:
                tid = _uuid.UUID(tenant_filter)
            except ValueError:
                log.error("Invalid tenant UUID: %s", tenant_filter)
                await engine.dispose()
                return
            q = q.where(UserTenant.tenant_id == tid)

        rows = (await db.execute(q)).all()
        log.info("Found %d active employee UserTenant rows to evaluate.", len(rows))

        # Step 2: build set of active employee emails per tenant (case-insensitive)
        emp_q = select(Employee.tenant_id, Employee.email).where(
            Employee.is_active.is_(True)
        )
        if tid is not None:
            emp_q = emp_q.where(Employee.tenant_id == tid)

        emp_rows = (await db.execute(emp_q)).all()
        active_employees: set[tuple] = {
            (str(r.tenant_id), r.email.lower()) for r in emp_rows
        }
        log.info("Loaded %d active employee records.", len(active_employees))

        # Step 3: identify rows to deactivate
        to_deactivate: list[tuple[UserTenant, User]] = []
        for ut, user in rows:
            key = (str(ut.tenant_id), user.email.lower())
            if key not in active_employees:
                to_deactivate.append((ut, user))

        log.info(
            "%d UserTenant row(s) have no matching active employee -> %s",
            len(to_deactivate),
            "WILL deactivate" if apply else "would deactivate (dry-run)",
        )

        if not to_deactivate:
            log.info("Nothing to do.")
            await engine.dispose()
            return

        # Step 4: report (always)
        by_tenant: dict[str, list[tuple[UserTenant, User]]] = defaultdict(list)
        for ut, user in to_deactivate:
            by_tenant[str(ut.tenant_id)].append((ut, user))

        for t_id, pairs in sorted(by_tenant.items()):
            log.info("  Tenant %s -- %d user(s):", t_id, len(pairs))
            for ut, user in pairs:
                log.info("    %-40s  %s", user.email, user.full_name or "(no name)")

        # Step 5: apply if requested
        if not apply:
            log.info("\nDRY-RUN complete. Re-run with --apply to commit changes.")
            await engine.dispose()
            return

        deactivated_ut = 0
        deleted_sessions = 0

        for ut, user in to_deactivate:
            ut.is_active = False
            deactivated_ut += 1

            # Session rows FK via user_tenant_id only -- no user_id/tenant_id columns.
            result = await db.execute(
                sa_delete(UserSession).where(
                    UserSession.user_tenant_id == ut.id,
                )
            )
            deleted_sessions += result.rowcount  # type: ignore[attr-defined]

        await db.commit()
        log.info(
            "Done. Deactivated %d UserTenant row(s), deleted %d session(s).",
            deactivated_ut,
            deleted_sessions,
        )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deactivate orphaned employee UserTenant rows (pre-d7ddea6 cleanup)."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to the database. Default is dry-run.",
    )
    parser.add_argument(
        "--tenant",
        metavar="UUID",
        default=None,
        help="Scope cleanup to a single tenant UUID (optional).",
    )
    args = parser.parse_args()

    if args.apply:
        log.info("Running in APPLY mode -- changes will be committed.")
    else:
        log.info("Running in DRY-RUN mode -- no changes will be written.")

    asyncio.run(run(apply=args.apply, tenant_filter=args.tenant))


if __name__ == "__main__":
    main()
