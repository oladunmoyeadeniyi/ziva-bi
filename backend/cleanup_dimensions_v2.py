import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

async def main():
    engine = create_async_engine(os.environ['DATABASE_URL'])
    async with engine.begin() as conn:

        result = await conn.execute(text("SELECT DISTINCT tenant_id FROM tenant_dimensions LIMIT 1"))
        tenant_id = result.scalar()
        print(f"Tenant: {tenant_id}")

        # Show current state first
        result = await conn.execute(text("""
            SELECT id, code, name, is_active
            FROM tenant_dimensions
            WHERE tenant_id = :tid
            ORDER BY code, is_active DESC
        """), {"tid": tenant_id})
        rows = result.fetchall()
        print(f"\nBefore cleanup ({len(rows)} records):")
        for row in rows:
            status = "ACTIVE" if row.is_active else "inactive"
            print(f"  [{status}] {row.code} | {row.name} | {row.id}")

        # Hard delete ALL inactive records — the active ones are the canonical ones
        # The seed will re-create any missing standard dimensions on next page load
        r = await conn.execute(text("""
            DELETE FROM tenant_dimensions
            WHERE tenant_id = :tid AND is_active = false
        """), {"tid": tenant_id})
        print(f"\nDeleted {r.rowcount} inactive dimension records")

        # Also delete duplicate active records — keep only the most recent per code
        # First find codes with duplicates
        dup_result = await conn.execute(text("""
            SELECT code, COUNT(*) as cnt
            FROM tenant_dimensions
            WHERE tenant_id = :tid AND is_active = true
            GROUP BY code
            HAVING COUNT(*) > 1
        """), {"tid": tenant_id})
        dups = dup_result.fetchall()

        for dup in dups:
            code = dup.code
            # Keep only one — the one with the lowest sort_order or first created
            r = await conn.execute(text("""
                DELETE FROM tenant_dimensions
                WHERE tenant_id = :tid AND code = :code AND is_active = true
                AND id NOT IN (
                    SELECT id FROM tenant_dimensions
                    WHERE tenant_id = :tid AND code = :code AND is_active = true
                    ORDER BY sort_order ASC NULLS LAST, id ASC
                    LIMIT 1
                )
            """), {"tid": tenant_id, "code": code})
            print(f"Deleted {r.rowcount} duplicate active '{code}' records")

        # Delete old-code records entirely (canonical codes are without _order suffix variants)
        old_codes = ['statistical_order', 'real_order']
        for old_code in old_codes:
            r = await conn.execute(text("""
                DELETE FROM tenant_dimensions
                WHERE tenant_id = :tid AND code = :code
            """), {"tid": tenant_id, "code": old_code})
            if r.rowcount:
                print(f"Deleted {r.rowcount} old-code '{old_code}' records")

        # Final state
        result = await conn.execute(text("""
            SELECT code, name, is_active, COUNT(*) as cnt
            FROM tenant_dimensions
            WHERE tenant_id = :tid
            GROUP BY code, name, is_active
            ORDER BY code, is_active DESC
        """), {"tid": tenant_id})
        rows = result.fetchall()
        print(f"\nFinal state ({sum(r.cnt for r in rows)} records):")
        for row in rows:
            status = "ACTIVE" if row.is_active else "inactive"
            print(f"  [{status}] {row.code} | {row.name} | count={row.cnt}")

asyncio.run(main())
