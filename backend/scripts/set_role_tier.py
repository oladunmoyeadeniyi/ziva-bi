"""
ZivaBI — repeatable role-tier setter.

Sets role_tier on user_tenants for a given email address.
Safe to re-run (idempotent UPDATE).

Usage (from the backend/ directory):
    python scripts/set_role_tier.py <email> <tier>

    tier must be one of: consultant | power_admin | functional_admin | null

Examples:
    python scripts/set_role_tier.py adeniyi.oladunmoye@redbull.com consultant
    python scripts/set_role_tier.py someone@example.com power_admin
    python scripts/set_role_tier.py someone@example.com null   # clears the tier

Requires DATABASE_URL in .env (or the environment). Uses asyncpg (already a
project dependency) — no extra packages needed.
"""

import asyncio
import os
import sys
from pathlib import Path

# Load .env from the backend directory regardless of working directory
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

import asyncpg

VALID_TIERS = {"consultant", "power_admin", "functional_admin", "null"}


async def _set_tier(email: str, tier: str) -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    # asyncpg wants postgresql:// not postgresql+asyncpg://
    dsn = db_url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(dsn)
    try:
        tier_value = None if tier == "null" else tier
        rows = await conn.fetch(
            """
            UPDATE user_tenants
            SET    role_tier  = $1,
                   updated_at = now()
            WHERE  user_id = (SELECT id FROM users WHERE email = $2)
            RETURNING user_id, role_tier
            """,
            tier_value,
            email,
        )
        if not rows:
            print(f"No user_tenants row found for email '{email}'.")
            sys.exit(1)
        for row in rows:
            print(f"OK — user_id={row['user_id']}  role_tier={row['role_tier']!r}")
    finally:
        await conn.close()


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python scripts/set_role_tier.py <email> <tier>")
        print(f"  tier: {' | '.join(sorted(VALID_TIERS))}")
        sys.exit(1)

    email, tier = sys.argv[1], sys.argv[2].lower()

    if tier not in VALID_TIERS:
        print(f"Invalid tier '{tier}'. Must be one of: {', '.join(sorted(VALID_TIERS))}")
        sys.exit(1)

    asyncio.run(_set_tier(email, tier))


if __name__ == "__main__":
    main()
