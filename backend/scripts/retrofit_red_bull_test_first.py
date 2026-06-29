"""
One-off retrofit: re-point the existing Red Bull live/test tenant pair from
the old M9.0 live-first parent_tenant_id direction to the new M9.0.1
test-first direction.

Background
----------
Before M9.0.1, parent_tenant_id lived on the TEST tenant, pointing at its
LIVE parent (live-first / clone-on-signup model). M9.0.1 flipped this:
parent_tenant_id now lives on the LIVE tenant, pointing back at the TEST
tenant it was promoted from (test-first model -- signup creates only a test
tenant; live is born later via an explicit promotion). New tenants created
after the M9.0.1 code shipped already have the new direction. The ORIGINAL
Red Bull pair was created before the flip and still has the old direction --
this script corrects it, without touching anything else. See
docs/BRIEF_M9_0_1_test_first_environment_flow.md and
docs/PROJECT_STATE.md §7 for full context.

What this changes
------------------
Exactly two columns, on exactly two rows, in the `tenants` table:
    UPDATE tenants SET parent_tenant_id = NULL        WHERE id = <test_id>
    UPDATE tenants SET parent_tenant_id = <test_id>    WHERE id = <live_id>

What this does NOT touch (verified against the M9.0.1 brief's locked
decisions -- do not change without re-reading it first):
    - tenant.id, tenant.environment, tenant.lifecycle_status, tenant.is_active
    - any of the ~30 other tenant-scoped tables (no environment column
      exists anywhere except `tenants` itself)
    - any transaction/audit/approval history
    - any row's primary key on any table

Safety
------
- Dry run by default -- prints the plan, makes no changes.
- --apply actually commits the two UPDATEs, inside one transaction.
- Idempotent: if the pair already has the NEW direction, prints
  "already retrofitted" and exits cleanly -- safe to re-run.
- Aborts loudly (no changes) if the pair is in any shape other than
  "old direction" or "new direction" -- e.g. if parent_tenant_id already
  points somewhere unexpected -- rather than guessing.
- Cross-checks the two known tenant ids against expected name/environment
  before touching anything, in case local data has drifted from what
  docs/PROJECT_STATE.md §7 describes.
- Takes an automatic pg_dump backup before --apply (unless --skip-backup is
  passed, which prints a loud warning). Requires `pg_dump` on PATH.

This was written and syntax/logic-checked in a sandbox with no Postgres
available (no `pg_dump`/`psql`, no root to install them) -- it has NOT been
run against a live database. Run the dry run first and read its output
carefully before passing --apply.

Usage (from backend/, with venv active and .env pointing at the target DB):
    python -m scripts.retrofit_red_bull_test_first                       # dry run
    python -m scripts.retrofit_red_bull_test_first --apply               # apply, with backup
    python -m scripts.retrofit_red_bull_test_first --apply --skip-backup # apply, no backup (not recommended)
"""
import argparse
import asyncio
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import AsyncSessionLocal  # noqa: E402
from app.models.auth import Tenant  # noqa: E402

# Known ids for the existing Red Bull pair (see docs/PROJECT_STATE.md §7).
# Looked up by these ids first; cross-checked by name/environment below so
# the script aborts loudly instead of silently acting on the wrong rows if
# the local DB doesn't match what's documented.
LIVE_TENANT_ID = "bd2c8a25-7467-494a-96fa-30f40b5b5d19"
TEST_TENANT_ID = "e8a2fd8c-5466-4618-bb37-97681a8bfb05"


def _take_backup() -> Path:
    """
    Shells out to pg_dump for a plain-SQL backup before any write.

    Parses settings.database_url (the same DSN the app itself connects
    with) into pg_dump's --host/--port/--username/--dbname flags and a
    PGPASSWORD env var, rather than assuming `pg_dump` understands the
    SQLAlchemy "postgresql+asyncpg://" prefix (it does not).
    """
    url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    parsed = urlparse(url)
    backup_dir = Path(__file__).resolve().parent / "backups"
    backup_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = backup_dir / f"pre_retrofit_{stamp}.sql"

    cmd = [
        "pg_dump",
        "--host", parsed.hostname or "localhost",
        "--port", str(parsed.port or 5432),
        "--username", unquote(parsed.username or "postgres"),
        "--dbname", (parsed.path or "/").lstrip("/"),
        "--file", str(backup_path),
        "--format=plain",
        "--no-owner",
    ]
    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = unquote(parsed.password)

    print(f"Taking backup -> {backup_path}")
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise SystemExit(
            "pg_dump failed -- aborting without making any changes. Fix the "
            "backup step (or re-run with --skip-backup if you have already "
            "taken a manual backup) before retrofitting."
        )
    print(f"Backup OK ({backup_path.stat().st_size:,} bytes).")
    return backup_path


async def main(apply: bool, skip_backup: bool) -> None:
    async with AsyncSessionLocal() as db:
        live = (
            await db.execute(select(Tenant).where(Tenant.id == LIVE_TENANT_ID))
        ).scalar_one_or_none()
        test = (
            await db.execute(select(Tenant).where(Tenant.id == TEST_TENANT_ID))
        ).scalar_one_or_none()

        if live is None or test is None:
            raise SystemExit(
                f"Expected tenants not found (live found={live is not None}, "
                f"test found={test is not None}). Check LIVE_TENANT_ID/"
                f"TEST_TENANT_ID at the top of this script against the "
                f"current `tenants` table before re-running -- this script "
                f"will not guess which rows to touch."
            )

        # Cross-checks against what docs/PROJECT_STATE.md §7 describes --
        # abort rather than act on rows that don't match expectations.
        problems = []
        if live.environment != "live":
            problems.append(f"expected live tenant environment='live', got {live.environment!r}")
        if test.environment != "test":
            problems.append(f"expected test tenant environment='test', got {test.environment!r}")
        if "red bull" not in live.name.lower():
            problems.append(f"expected live tenant name to contain 'Red Bull', got {live.name!r}")
        if "red bull" not in test.name.lower():
            problems.append(f"expected test tenant name to contain 'Red Bull', got {test.name!r}")
        if problems:
            raise SystemExit("Pre-flight checks failed:\n  - " + "\n  - ".join(problems))

        old_shape = test.parent_tenant_id == live.id and live.parent_tenant_id is None
        new_shape = live.parent_tenant_id == test.id and test.parent_tenant_id is None

        print(f"live tenant: id={live.id} name={live.name!r} parent_tenant_id={live.parent_tenant_id}")
        print(f"test tenant: id={test.id} name={test.name!r} parent_tenant_id={test.parent_tenant_id}")

        if new_shape:
            print("\nAlready in the new (test-first) direction. Nothing to do.")
            return

        if not old_shape:
            raise SystemExit(
                "\nPair is in neither the expected OLD shape "
                "(test.parent_tenant_id=live.id, live.parent_tenant_id=NULL) "
                "nor the NEW shape (live.parent_tenant_id=test.id, "
                "test.parent_tenant_id=NULL). Refusing to guess -- inspect "
                "manually before retrofitting."
            )

        print(
            "\nPlan:\n"
            f"  UPDATE tenants SET parent_tenant_id = NULL          WHERE id = '{test.id}'  -- (was {test.parent_tenant_id})\n"
            f"  UPDATE tenants SET parent_tenant_id = '{test.id}'   WHERE id = '{live.id}'  -- (was {live.parent_tenant_id})\n"
        )

        if not apply:
            print("Dry run only -- re-run with --apply to actually update.")
            return

        if skip_backup:
            print("!! --skip-backup passed -- proceeding WITHOUT taking a backup. !!")
        else:
            _take_backup()

        test.parent_tenant_id = None
        live.parent_tenant_id = test.id
        await db.commit()

        await db.refresh(live)
        await db.refresh(test)
        print(
            "Done.\n"
            f"  live.parent_tenant_id = {live.parent_tenant_id}  (expected {test.id})\n"
            f"  test.parent_tenant_id = {test.parent_tenant_id}  (expected None)"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually update (default is dry-run)")
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="Skip the automatic pg_dump backup before --apply (not recommended)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.apply, args.skip_backup))
