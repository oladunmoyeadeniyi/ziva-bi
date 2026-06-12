import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

async def main():
    engine = create_async_engine(os.environ['DATABASE_URL'])
    async with engine.begin() as conn:

        # Step 1: Get tenant_id (there's only one test tenant)
        result = await conn.execute(text("SELECT DISTINCT tenant_id FROM tenant_dimensions LIMIT 1"))
        tenant_id = result.scalar()
        print(f"Tenant: {tenant_id}")

        # Step 2: For each canonical code, keep only the best record
        # Strategy: keep the one with is_active=True and most recent updated_at
        # For duplicates with same active status, keep most recently updated

        # Delete all inactive cost_center records
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE code = 'cost_center' AND is_active = false AND tenant_id = :tid
        """), {"tid": tenant_id})
        print(f"Deleted {r.rowcount} inactive cost_center records")

        # Keep only 1 active cost_center (the most recently created)
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE code = 'cost_center' AND is_active = true AND tenant_id = :tid
            AND id NOT IN (
                SELECT id FROM tenant_dimensions
                WHERE code = 'cost_center' AND is_active = true AND tenant_id = :tid
                ORDER BY created_at DESC LIMIT 1
            )
        """), {"tid": tenant_id})
        print(f"Deleted {r.rowcount} duplicate active cost_center records")

        # Keep only 1 active customer_order
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE code = 'customer_order' AND is_active = true AND tenant_id = :tid
            AND id NOT IN (
                SELECT id FROM tenant_dimensions
                WHERE code = 'customer_order' AND is_active = true AND tenant_id = :tid
                ORDER BY created_at DESC LIMIT 1
            )
        """), {"tid": tenant_id})
        print(f"Deleted {r.rowcount} duplicate active customer_order records")

        # Delete old statistical_order code entirely (canonical is statistical_internal_order)
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE code = 'statistical_order' AND tenant_id = :tid
        """), {"tid": tenant_id})
        print(f"Deleted {r.rowcount} statistical_order (old code) records")

        # Delete old real_order code entirely (canonical is real_internal_order)
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE code = 'real_order' AND tenant_id = :tid
        """), {"tid": tenant_id})
        print(f"Deleted {r.rowcount} real_order (old code) records")

        # Delete inactive statistical_internal_order
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE code = 'statistical_internal_order' AND is_active = false AND tenant_id = :tid
        """), {"tid": tenant_id})
        print(f"Deleted {r.rowcount} inactive statistical_internal_order records")

        # Delete inactive employee (was never properly seeded)
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE code = 'employee' AND is_active = false AND tenant_id = :tid
        """), {"tid": tenant_id})
        print(f"Deleted {r.rowcount} inactive employee records")

        # Step 3: Verify final state
        result = await conn.execute(text("""
            SELECT code, name, is_active, COUNT(*) as cnt
            FROM tenant_dimensions
            WHERE tenant_id = :tid
            GROUP BY code, name, is_active
            ORDER BY code, is_active
        """), {"tid": tenant_id})
        print("\nFinal state:")
        for row in result:
            print(f"  {row}")

asyncio.run(main())
