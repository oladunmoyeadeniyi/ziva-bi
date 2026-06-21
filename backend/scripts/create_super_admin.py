"""
ZivaBI — super admin creation script.

Creates a standalone Ziva BI owner (super admin) directly in the database,
bypassing the signup endpoint (which always creates a tenant and is wrong for
platform-level accounts).

What it creates:
  users row       — is_super_admin=True, account_type='individual', no tenant.
  user_tenants row — tenant_id IS NULL, password stored here (app's bcrypt hasher).

Why tenant_id IS NULL:
  The login endpoint resolves a UserTenant by user_id. For a super admin there is
  no company — the UserTenant exists purely to hold the password hash and session
  anchor. The JWT will carry tenant_id=None and is_super_admin=True, which is
  exactly what /api/platform/* requires.

Idempotent:
  - Email already exists + is_super_admin=True → reports done, no duplicate rows.
  - Email already exists + is_super_admin=False → promotes the account and ensures
    a tenant-less UserTenant exists.
  - Email not found → creates both rows in a single transaction.

Usage (run from the backend/ directory, venv activated):
    python scripts/create_super_admin.py <email> <password>

Example:
    python scripts/create_super_admin.py admin@zivafinance.com MyStr0ngP@ss!

Requires DATABASE_URL in backend/.env (or already in the environment).
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

# ── Path setup so we can load .env from the backend dir ──────────────────────
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(backend_dir / ".env")

# ── bcrypt — same algorithm and cost factor as app.core.security ─────────────
import bcrypt  # noqa: E402  (already a project dependency)


def _hash_password(plain: str) -> str:
    """Bcrypt hash at cost=12 — identical to app.core.security.hash_password."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


# ── Main async logic ──────────────────────────────────────────────────────────

async def _create(email: str, password: str) -> None:
    import asyncpg  # noqa: E402  (already a project dependency)

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not set. Add it to backend/.env or the environment.")
        sys.exit(1)

    # asyncpg expects postgresql:// not postgresql+asyncpg://
    dsn = db_url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(dsn)
    try:
        # ── Check whether this email already exists ───────────────────────────
        existing = await conn.fetchrow(
            "SELECT id, is_super_admin FROM users WHERE email = $1",
            email,
        )

        if existing:
            user_id = existing["id"]
            if existing["is_super_admin"]:
                print(f"  OK'{email}' already exists and is already a super admin.")
            else:
                await conn.execute(
                    "UPDATE users SET is_super_admin = TRUE, updated_at = now() WHERE id = $1",
                    user_id,
                )
                print(f"  OKPromoted existing user '{email}' → is_super_admin = TRUE.")

            # Ensure a tenant-less UserTenant row exists so login works
            tenant_less = await conn.fetchrow(
                "SELECT id FROM user_tenants WHERE user_id = $1 AND tenant_id IS NULL",
                user_id,
            )
            if tenant_less:
                print(f"  OKTenant-less UserTenant already present (id={tenant_less['id']}).")
            else:
                ut_id = uuid.uuid4()
                pw_hash = _hash_password(password)
                await conn.execute(
                    """
                    INSERT INTO user_tenants
                        (id, user_id, tenant_id, password_hash,
                         is_active, failed_login_attempts, created_at, updated_at)
                    VALUES
                        ($1, $2, NULL, $3,
                         TRUE, 0, now(), now())
                    """,
                    ut_id, user_id, pw_hash,
                )
                print(f"  OKCreated tenant-less UserTenant (id={ut_id}).")
            _print_summary(email, user_id)
            return

        # ── Create brand-new super admin ──────────────────────────────────────
        pw_hash = _hash_password(password)
        user_id = uuid.uuid4()
        ut_id = uuid.uuid4()

        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO users
                    (id, email, full_name, first_name,
                     account_type, is_active, is_super_admin,
                     created_at, updated_at)
                VALUES
                    ($1, $2, 'Super Admin', 'Super',
                     'individual'::accounttype, TRUE, TRUE,
                     now(), now())
                """,
                user_id, email,
            )
            await conn.execute(
                """
                INSERT INTO user_tenants
                    (id, user_id, tenant_id, password_hash,
                     is_active, failed_login_attempts, created_at, updated_at)
                VALUES
                    ($1, $2, NULL, $3,
                     TRUE, 0, now(), now())
                """,
                ut_id, user_id, pw_hash,
            )

        print("  OKSuper admin created.")
        print(f"     user_id:        {user_id}")
        print(f"     user_tenant_id: {ut_id}")
        _print_summary(email, user_id)

    finally:
        await conn.close()


def _print_summary(email: str, user_id: uuid.UUID) -> None:
    print()
    print("  Login via:")
    print(f'    POST /api/auth/login')
    print(f'    {{"email": "{email}", "password": "<your-password>"}}')
    print()
    print("  JWT will carry:  is_super_admin=true, tenant_id=null")
    print("  Platform portal: /platform")


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) != 3:
        print("Usage:   python scripts/create_super_admin.py <email> <password>")
        print("Example: python scripts/create_super_admin.py admin@zivafinance.com MyStr0ngP@ss!")
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    password = sys.argv[2]

    if len(password) < 8:
        print("ERROR: password must be at least 8 characters.")
        sys.exit(1)

    asyncio.run(_create(email, password))


if __name__ == "__main__":
    main()
