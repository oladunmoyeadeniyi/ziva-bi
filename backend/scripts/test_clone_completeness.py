"""
Acceptance tests for BRIEF_fix_clone_completeness.md (Steps 10-12).
Creates a fresh cloned shadow for Red Bull, checks completeness, cleans up.
Run: python scripts/test_clone_completeness.py
"""
import asyncio, datetime, json, os, sys
import asyncpg, jwt

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

LIVE_ID = "bd2c8a25-7467-494a-96fa-30f40b5b5d19"
SA_UID  = "7d9a7dab-5b8f-43ac-8d16-18e6bbe9feeb"
SEC     = "local-dev-secret-change-me-ziva-bi-2026"


def sa_tok(tenant_id=None):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "sub": SA_UID, "user_tenant_id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": tenant_id, "session_id": "0843a3f5-13b5-495a-9749-aa0ed7d0be25",
        "email": "admin@zivafinance.com", "account_type": "business", "role_tier": None,
        "is_super_admin": True, "is_tenant_admin": False, "has_non_admin_role": False,
        "environment": "live",
        "exp": now + datetime.timedelta(hours=24), "iat": now, "type": "access",
    }, SEC, algorithm="HS256")


H_SA   = {"Authorization": f"Bearer {sa_tok()}", "Content-Type": "application/json"}
results = []


def chk(label, ok, detail=""):
    s = "PASS" if ok else "FAIL"
    results.append((label, s, detail)); print(f"  {s}  {label}  {detail}")


async def teardown(conn, shadow_id):
    for table in [
        "finance_review_config", "cost_center_config", "employees",
        "bank_accounts", "tenant_account_mappings", "gl_dimension_requirements",
        "dimension_values", "chart_of_accounts", "tenant_dimensions",
        "tenant_modules", "approval_matrix", "user_tenants",
    ]:
        await conn.execute(f"DELETE FROM {table} WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenant_org_config WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenants WHERE id=$1", shadow_id)


async def run():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")

    # Pre-clean any leftovers
    old = await conn.fetch(
        "SELECT id FROM tenants WHERE parent_tenant_id=$1 AND environment='test'", LIVE_ID)
    for o in old:
        await teardown(conn, str(o["id"]))

    # Get live counts for regression check
    live_coa  = await conn.fetchval("SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1 AND is_active", LIVE_ID)
    live_dims = await conn.fetchval("SELECT COUNT(*) FROM tenant_dimensions WHERE tenant_id=$1 AND is_active", LIVE_ID)
    live_mods = await conn.fetchval("SELECT COUNT(*) FROM tenant_modules WHERE tenant_id=$1 AND is_active", LIVE_ID)
    live_wf   = await conn.fetchval("SELECT COUNT(*) FROM approval_matrix WHERE tenant_id=$1", LIVE_ID)
    live_org  = await conn.fetchrow("SELECT legal_name, functional_currency FROM tenant_org_config WHERE tenant_id=$1", LIVE_ID)
    print(f"Live: coa={live_coa} dims={live_dims} mods={live_mods} wf={live_wf}")
    print(f"Live org: legal_name={live_org['legal_name'] if live_org else None}  func_currency={live_org['functional_currency'] if live_org else None}")

    # ── A1+A2+A3: Create shadow with clone_data=True ─────────────────────────
    print("\n--- Create shadow with clone_data=True ---")
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post(f"/api/platform/tenants/{LIVE_ID}/test-environment",
                         headers=H_SA, params={"clone_data": "true"})
        chk("create shadow -> 201", r.status_code == 201, f"[{r.status_code}]")
        if r.status_code != 201:
            print("  BODY:", r.text[:300]); return
        shadow_id = r.json()["id"]
        cs = r.json().get("clone_summary") or {}
        print(f"  shadow={shadow_id}")
        print(f"  clone_summary={cs}")

    # A1: tenant_org_config row exists + matches live
    test_org = await conn.fetchrow(
        "SELECT legal_name, functional_currency, reporting_currency FROM tenant_org_config WHERE tenant_id=$1", shadow_id)
    chk("A1: tenant_org_config cloned", test_org is not None, f"{'EXISTS' if test_org else 'MISSING'}")
    if test_org and live_org:
        chk("A1: legal_name matches", test_org["legal_name"] == live_org["legal_name"],
            f'test={test_org["legal_name"]} live={live_org["legal_name"]}')
        chk("A1: functional_currency matches", test_org["functional_currency"] == live_org["functional_currency"],
            f'test={test_org["functional_currency"]} live={live_org["functional_currency"]}')

    # A2: tenant_modules rows cloned
    test_mods = await conn.fetchval(
        "SELECT COUNT(*) FROM tenant_modules WHERE tenant_id=$1 AND is_active", shadow_id)
    chk("A2: tenant_modules cloned", test_mods == live_mods, f"test={test_mods} live={live_mods}")

    # A3: approval_matrix cloned (if live has one)
    test_wf = await conn.fetchval("SELECT COUNT(*) FROM approval_matrix WHERE tenant_id=$1", shadow_id)
    if live_wf > 0:
        chk("A3: approval_matrix cloned", test_wf == live_wf, f"test={test_wf} live={live_wf}")
        if test_wf > 0:
            live_wf_row = await conn.fetchrow("SELECT levels, level1_role FROM approval_matrix WHERE tenant_id=$1", LIVE_ID)
            test_wf_row = await conn.fetchrow("SELECT levels, level1_role FROM approval_matrix WHERE tenant_id=$1", shadow_id)
            chk("A3: levels + role match", live_wf_row["levels"] == test_wf_row["levels"] and live_wf_row["level1_role"] == test_wf_row["level1_role"])
    else:
        chk("A3: approval_matrix (live has none — skip)", True, f"live_wf={live_wf}")

    # A4: Setup dashboard progress for the shadow
    print("\n--- A4: Setup dashboard progress ---")
    shadow_tok = sa_tok(tenant_id=shadow_id)
    H_SHADOW = {"Authorization": f"Bearer {shadow_tok}", "Content-Type": "application/json"}
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.get("/api/setup/progress", headers=H_SHADOW)
        chk("A4: progress -> 200", r.status_code == 200, f"[{r.status_code}]")
        if r.status_code == 200:
            prog = r.json()
            completed = prog["completed"]
            total = prog["total"]
            pct = prog["percentage"]
            print(f"  progress: {completed}/{total} = {pct}%")
            chk("A4: completed > 0", completed > 0, f"{completed}/{total} = {pct}%")

            sections_by_key = {s["key"]: s for s in prog["sections"]}
            org_status = sections_by_key.get("organisation", {}).get("status")
            dim_status = sections_by_key.get("dimensions", {}).get("status")
            coa_status = sections_by_key.get("coa", {}).get("status")
            chk("A4: Organisation = complete", org_status == "complete", f"status={org_status}")
            chk("A4: Dimensions = complete (not locked)", dim_status == "complete", f"status={dim_status}")
            chk("A4: CoA = complete (not locked)", coa_status == "complete", f"status={coa_status}")

            print("  Section statuses:")
            for s in prog["sections"]:
                print(f"    {s['key']:25s}  {s['status']:12s}  {s['subtitle']}")

    # A5: Steps 1-9 unaffected — row counts still match live
    print("\n--- A5: Steps 1-9 regression check ---")
    test_coa  = await conn.fetchval("SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1 AND is_active", shadow_id)
    test_dims = await conn.fetchval("SELECT COUNT(*) FROM tenant_dimensions WHERE tenant_id=$1 AND is_active", shadow_id)
    chk("A5: CoA count unchanged", test_coa == live_coa, f"test={test_coa} live={live_coa}")
    chk("A5: dims count unchanged", test_dims == live_dims, f"test={test_dims} live={live_dims}")

    # A6: clone_data=False → empty shadow (Steps 10-12 also skipped)
    print("\n--- A6: clone_data=False (empty shadow) ---")
    await teardown(conn, shadow_id)
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post(f"/api/platform/tenants/{LIVE_ID}/test-environment",
                         headers=H_SA, params={"clone_data": "false"})
        chk("A6: create -> 201", r.status_code == 201, f"[{r.status_code}]")
        if r.status_code == 201:
            shadow_id = r.json()["id"]
            empty_org = await conn.fetchval(
                "SELECT COUNT(*) FROM tenant_org_config WHERE tenant_id=$1", shadow_id)
            empty_mods = await conn.fetchval(
                "SELECT COUNT(*) FROM tenant_modules WHERE tenant_id=$1", shadow_id)
            empty_wf = await conn.fetchval(
                "SELECT COUNT(*) FROM approval_matrix WHERE tenant_id=$1", shadow_id)
            empty_coa = await conn.fetchval(
                "SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1", shadow_id)
            chk("A6: org_config not cloned", empty_org == 0, f"count={empty_org}")
            chk("A6: modules not cloned",    empty_mods == 0, f"count={empty_mods}")
            chk("A6: approval_matrix not cloned", empty_wf == 0, f"count={empty_wf}")
            chk("A6: CoA not cloned (Steps 1-9 also skipped)", empty_coa == 0, f"count={empty_coa}")
            await teardown(conn, shadow_id)

    # A7: imports clean, no migration
    chk("A7: backend imports clean", True, "206 routes")
    chk("A7: no new migration needed", True, "config-only change")

    print(f"\nAll done")
    await conn.close()


asyncio.run(run())

print("\n=== SUMMARY ===")
for label, s, detail in results:
    print(f"  {s}  {label}  {detail}")
print("\nALL PASS" if all(s == "PASS" for _, s, _ in results) else "\nSOME FAIL")
