"""
ZivaBI — database seed script.

Creates the Super Admin user and a test tenant with a Tenant Admin user
so that you can immediately test both account types after running migrations.

Run from the backend/ directory with the venv activated:
    DATABASE_URL="postgresql+asyncpg://..." python seed.py

Idempotent: safe to run multiple times — skips records that already exist.

Credentials created:
    Super Admin:   admin@ziva.bi            / SuperAdmin123!
    Test Tenant:   tenant@testcorp.ziva.bi  / TenantAdmin123!
    Individual:    individual@test.ziva.bi  / Individual123!
"""

import asyncio
import os
import sys

# Allow running from the backend/ directory without installing the package
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select

from app.core.security import hash_password
from app.database import AsyncSessionLocal
from app.models.auth import (  # noqa: F401 — ensures tables are registered
    AccountType,
    AuditLog,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    Session,
    Tenant,
    User,
    UserRole,
    UserTenant,
)


async def seed() -> None:
    async with AsyncSessionLocal() as db:

        # ── Super Admin user ──────────────────────────────────────────────────
        sa_email = "admin@ziva.bi"
        existing_sa = await db.execute(select(User).where(User.email == sa_email))
        if existing_sa.scalar_one_or_none() is None:
            sa_user = User(
                email=sa_email,
                full_name="Ziva Super Admin",
                account_type=AccountType.business,
                is_super_admin=True,
            )
            db.add(sa_user)
            await db.flush()

            sa_ut = UserTenant(
                user_id=sa_user.id,
                tenant_id=None,
                password_hash=hash_password("SuperAdmin123!"),
            )
            db.add(sa_ut)
            await db.flush()
            print(f"  Created Super Admin: {sa_email}")
        else:
            print(f"  Super Admin already exists: {sa_email}")

        # ── Test tenant ───────────────────────────────────────────────────────
        tenant_slug = "test-corp"
        existing_tenant = await db.execute(
            select(Tenant).where(Tenant.slug == tenant_slug)
        )
        tenant: Tenant | None = existing_tenant.scalar_one_or_none()

        if tenant is None:
            tenant = Tenant(
                name="Test Corporation Ltd",
                country="NG",
                slug=tenant_slug,
            )
            db.add(tenant)
            await db.flush()
            print(f"  Created test tenant: {tenant.name}")
        else:
            print(f"  Test tenant already exists: {tenant.name}")

        # ── Tenant Admin user for the test tenant ─────────────────────────────
        ta_email = "tenant@testcorp.ziva.bi"
        existing_ta = await db.execute(select(User).where(User.email == ta_email))
        if existing_ta.scalar_one_or_none() is None:
            ta_user = User(
                email=ta_email,
                full_name="Test Corp Admin",
                account_type=AccountType.business,
            )
            db.add(ta_user)
            await db.flush()

            ta_ut = UserTenant(
                user_id=ta_user.id,
                tenant_id=tenant.id,
                password_hash=hash_password("TenantAdmin123!"),
            )
            db.add(ta_ut)
            await db.flush()

            # Assign tenant_admin role
            role_result = await db.execute(
                select(Role).where(Role.name == "tenant_admin", Role.tenant_id.is_(None))
            )
            role = role_result.scalar_one_or_none()
            if role:
                db.add(UserRole(user_tenant_id=ta_ut.id, role_id=role.id))

            print(f"  Created Tenant Admin: {ta_email}")
        else:
            print(f"  Tenant Admin already exists: {ta_email}")

        # ── Test individual user ───────────────────────────────────────────────
        ind_email = "individual@test.ziva.bi"
        existing_ind = await db.execute(select(User).where(User.email == ind_email))
        if existing_ind.scalar_one_or_none() is None:
            ind_user = User(
                email=ind_email,
                full_name="Test Individual",
                account_type=AccountType.individual,
            )
            db.add(ind_user)
            await db.flush()

            db.add(UserTenant(
                user_id=ind_user.id,
                tenant_id=None,
                password_hash=hash_password("Individual123!"),
            ))
            print(f"  Created Individual user: {ind_email}")
        else:
            print(f"  Individual user already exists: {ind_email}")

        await db.commit()
        print("\nSeed complete.")


if __name__ == "__main__":
    print("Seeding ZivaBI database...\n")
    asyncio.run(seed())
