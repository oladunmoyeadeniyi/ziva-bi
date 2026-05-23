"""
M7 seed script — expense categories for the test tenant.

Run once after applying the g7h8i9j0k1l2 migration to populate the first
tenant's expense categories so the new Expense Config UI has data to show.

Usage (from backend/):
    python -m app.scripts.seed_m7_categories

The script is idempotent: it skips categories that already exist by name
so it is safe to run multiple times.
"""

import asyncio
import os
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.auth import Tenant  # noqa: F401  imported to register the model
from app.models.expenses import ExpenseCategory, TenantExpenseConfig


DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/ziva_dev",
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)  # type: ignore[call-overload]

# Seed definition: (name, code, gl_suggestion, subcategory_names)
SEED: list[tuple[str, str, str, list[str]]] = [
    ("Travel",                "TRV", "670010", ["Domestic Travel", "International Travel"]),
    ("Accommodation",         "ACC", "733060", ["Hotel", "Guest House"]),
    ("Meals & Entertainment", "MEA", "733500", ["Business Meals", "Client Entertainment"]),
    ("Fuel & Lubricants",     "FUE", "720000", []),
    ("Office Supplies",       "OFF", "760020", []),
    ("Staff Costs",           "STF", "500000", []),
]


async def seed(db: AsyncSession) -> None:
    # Pick the first (oldest) tenant to seed
    tenant_result = await db.execute(
        select(Tenant).order_by(Tenant.created_at).limit(1)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        print("No tenants found — create a business account first, then re-run this script.")
        return

    tenant_id: uuid.UUID = tenant.id
    print(f"Seeding categories for tenant: {tenant.name} ({tenant_id})")

    sort = 0
    for name, code, gl_suggestion, sub_names in SEED:
        # Check if top-level category already exists
        existing = await db.execute(
            select(ExpenseCategory).where(
                ExpenseCategory.tenant_id == tenant_id,
                ExpenseCategory.name == name,
                ExpenseCategory.parent_id.is_(None),
            )
        )
        parent = existing.scalar_one_or_none()
        if parent is None:
            parent = ExpenseCategory(
                tenant_id=tenant_id,
                name=name,
                code=code,
                gl_account_suggestion=gl_suggestion,
                sort_order=sort,
            )
            db.add(parent)
            await db.flush()
            print(f"  + {name} ({code} -> {gl_suggestion})")
        else:
            print(f"  ~ {name} already exists, skipping")

        sort += 10

        for sub_name in sub_names:
            sub_existing = await db.execute(
                select(ExpenseCategory).where(
                    ExpenseCategory.tenant_id == tenant_id,
                    ExpenseCategory.name == sub_name,
                    ExpenseCategory.parent_id == parent.id,
                )
            )
            if sub_existing.scalar_one_or_none() is None:
                sub = ExpenseCategory(
                    tenant_id=tenant_id,
                    name=sub_name,
                    parent_id=parent.id,
                    sort_order=0,
                )
                db.add(sub)
                print(f"      + {sub_name}")

    await db.commit()
    print("\nSeed complete.")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed(db)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
