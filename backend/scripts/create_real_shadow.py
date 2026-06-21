"""Create the real Red Bull test shadow with Step 13 (org_structure)."""
import asyncio, datetime, jwt, os, sys
sys.path.insert(0, ".")
os.environ.update({
    "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost:5432/ziva_dev",
    "SECRET_KEY": "local-dev-secret-change-me-ziva-bi-2026", "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "30", "REFRESH_TOKEN_EXPIRE_DAYS": "7",
    "ALLOWED_ORIGINS": '["http://localhost:3000"]',
    "SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "x",
    "SUPABASE_BUCKET": "documents",
})
from httpx import AsyncClient, ASGITransport
from app.main import app
import asyncpg

RB_TID = "bd2c8a25-7467-494a-96fa-30f40b5b5d19"
SA_UID = "7d9a7dab-5b8f-43ac-8d16-18e6bbe9feeb"
SEC    = "local-dev-secret-change-me-ziva-bi-2026"


def sa_tok():
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "sub": SA_UID, "user_tenant_id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": None, "session_id": "0843a3f5-13b5-495a-9749-aa0ed7d0be25",
        "email": "admin@zivafinance.com", "account_type": "business", "role_tier": None,
        "is_super_admin": True, "is_tenant_admin": False, "has_non_admin_role": False,
        "environment": "live", "exp": now + datetime.timedelta(hours=24), "iat": now, "type": "access",
    }, SEC, algorithm="HS256")


H = {"Authorization": f"Bearer {sa_tok()}", "Content-Type": "application/json"}


async def delete_shadow(conn, shadow_id):
    for t in ["finance_review_config", "cost_center_config", "employees",
              "bank_accounts", "tenant_account_mappings", "gl_dimension_requirements",
              "dimension_values", "chart_of_accounts", "tenant_dimensions",
              "tenant_modules", "approval_matrix", "org_structure", "user_tenants"]:
        await conn.execute(f"DELETE FROM {t} WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenant_org_config WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenants WHERE id=$1", shadow_id)


async def main():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")

    # Delete any existing shadow
    old = await conn.fetch(
        "SELECT id FROM tenants WHERE parent_tenant_id=$1 AND environment='test'", RB_TID)
    for o in old:
        sid = str(o["id"])
        print(f"Deleting old shadow {sid}...")
        await delete_shadow(conn, sid)
        print("  Done.")

    # Create new shadow
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post(f"/api/platform/tenants/{RB_TID}/test-environment",
                         headers=H, params={"clone_data": "true"})
        print(f"Create status: {r.status_code}")
        if r.status_code != 201:
            print("ERROR:", r.text[:300])
            await conn.close()
            return
        body = r.json()
        shadow_id = body["id"]
        cs = body.get("clone_summary", {})
        print(f"New shadow ID: {shadow_id}")
        print(f"Clone summary: {cs}")

    # Verify shadow tenant properties
    shadow = await conn.fetchrow(
        "SELECT environment, parent_tenant_id, lifecycle_status, name FROM tenants WHERE id=$1", shadow_id)
    print(f"\nShadow properties:")
    print(f"  name={shadow['name']}")
    print(f"  environment={shadow['environment']}")
    print(f"  parent_tenant_id={shadow['parent_tenant_id']}")
    print(f"  lifecycle_status={shadow['lifecycle_status']}")

    # Row-count comparison
    tables = [
        ("tenant_dimensions",         "is_active"),
        ("dimension_values",          "is_active"),
        ("chart_of_accounts",         "is_active"),
        ("employees",                 "is_active"),
        ("bank_accounts",             "is_active"),
        ("gl_dimension_requirements", None),
        ("tenant_account_mappings",   None),
        ("tenant_org_config",         None),
        ("tenant_modules",            "is_active"),
        ("approval_matrix",           None),
        ("org_structure",             "is_active"),
    ]
    print("\nRow-count comparison (shadow vs live Red Bull):")
    all_match = True
    for table, ac in tables:
        if ac:
            sc = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE tenant_id=$1 AND {ac}", shadow_id)
            rc = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE tenant_id=$1 AND {ac}", RB_TID)
        else:
            sc = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE tenant_id=$1", shadow_id)
            rc = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE tenant_id=$1", RB_TID)
        m = "MATCH" if sc == rc else "DIFF"
        if sc != rc:
            all_match = False
        print(f"  {table:40s}  shadow={sc:5}  live={rc:5}  {m}")

    # FK integrity checks
    d1 = await conn.fetchval("""
        SELECT COUNT(*) FROM org_structure os
        WHERE os.tenant_id=$1 AND os.parent_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM org_structure p WHERE p.id=os.parent_id AND p.tenant_id=$1)
    """, shadow_id)
    print(f"\nDangling org_structure.parent_id FKs: {d1} (should be 0)")

    d2 = await conn.fetchval("""
        SELECT COUNT(*) FROM dimension_values dv
        WHERE dv.tenant_id=$1
          AND NOT EXISTS (SELECT 1 FROM tenant_dimensions d WHERE d.id=dv.dimension_id AND d.tenant_id=$1)
    """, shadow_id)
    print(f"Dangling dimension_values.dimension_id FKs: {d2} (should be 0)")

    # Org structure detail
    nodes = await conn.fetch(
        "SELECT code, name, node_type FROM org_structure WHERE tenant_id=$1 AND is_active ORDER BY sort_order", shadow_id)
    print(f"\nOrg structure nodes on shadow ({len(nodes)}):")
    for n in nodes:
        print(f"  code={n['code']}  name={n['name']}  type={n['node_type']}")

    print(f"\n{'ALL TABLE COUNTS MATCH' if all_match else 'SOME COUNTS DIFFER'}")
    print(f"\nFINAL SHADOW UUID: {shadow_id}")
    await conn.close()


asyncio.run(main())
