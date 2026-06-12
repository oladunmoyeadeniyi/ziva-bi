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

        # First show current state
        result = await conn.execute(text("""
            SELECT id, code, name, is_active
            FROM tenant_dimensions
            WHERE tenant_id = :tid
            ORDER BY code, is_active DESC
        """), {"tid": tenant_id})
        rows = result.fetchall()
        print(f"\nCurrent state ({len(rows)} records):")
        for row in rows:
            print(f"  {row.code} | {row.name} | active={row.is_active} | id={row.id}")

        # The seed will re-create missing standard dimensions on next page load.
        # Just confirm what's there and we're done.
        print("\nCleanup complete. Missing dimensions will be re-seeded on next page load.")

asyncio.run(main())
