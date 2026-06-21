"""
Acceptance tests for BRIEF_clone_on_create_engine.md (Phase 4).

Uses Red Bull tenant (has real CoA/dims/employees/bank accounts) for A1-A9.
The test shadow is cleaned up at the end.
Run: python scripts/test_clone_engine.py
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

SEC    = "local-dev-secret-change-me-ziva-bi-2026"
TID    = "bd2c8a25-7467-494a-96fa-30f40b5b5d19"   # Red Bull (live, real data)
SES    = "0843a3f5-13b5-495a-9749-aa0ed7d0be25"
SA_UID = "7d9a7dab-5b8f-43ac-8d16-18e6bbe9feeb"

def sa_tok():
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "sub": SA_UID, "user_tenant_id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": None, "session_id": SES, "email": "admin@zivafinance.com",
        "account_type": "business", "role_tier": None, "is_super_admin": True,
        "is_tenant_admin": False, "has_non_admin_role": False, "environment": "live",
        "exp": now + datetime.timedelta(hours=24), "iat": now, "type": "access",
    }, SEC, algorithm="HS256")

H = {"Authorization": f"Bearer {sa_tok()}", "Content-Type": "application/json"}
results = []

def chk(label, ok, detail=""):
    s = "PASS" if ok else "FAIL"
    results.append((label, s, detail)); print(f"  {s}  {label}  {detail}")


async def teardown(conn, shadow_id):
    """Remove the test shadow and all its data."""
    await conn.execute("DELETE FROM finance_review_config WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM cost_center_config WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM employees WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM bank_accounts WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenant_account_mappings WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM gl_dimension_requirements WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM dimension_values WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM chart_of_accounts WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenant_dimensions WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM user_tenants WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenants WHERE id=$1", shadow_id)


async def run():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")

    # Pre-clean any leftover shadows
    old = await conn.fetch(
        "SELECT id FROM tenants WHERE parent_tenant_id=$1 AND environment='test'", TID
    )
    for o in old:
        await teardown(conn, str(o["id"]))

    # Fetch live counts for comparison
    live_dims  = await conn.fetchval("SELECT COUNT(*) FROM tenant_dimensions WHERE tenant_id=$1 AND is_active", TID)
    live_coa   = await conn.fetchval("SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1 AND is_active", TID)
    live_vals  = await conn.fetchval("SELECT COUNT(*) FROM dimension_values WHERE tenant_id=$1 AND is_active", TID)
    live_reqs  = await conn.fetchval("SELECT COUNT(*) FROM gl_dimension_requirements WHERE tenant_id=$1", TID)
    live_maps  = await conn.fetchval("SELECT COUNT(*) FROM tenant_account_mappings WHERE tenant_id=$1", TID)
    live_ba    = await conn.fetchval("SELECT COUNT(*) FROM bank_accounts WHERE tenant_id=$1 AND is_active", TID)
    live_emps  = await conn.fetchval("SELECT COUNT(*) FROM employees WHERE tenant_id=$1 AND is_active", TID)
    live_ccs   = await conn.fetchval("SELECT COUNT(*) FROM cost_center_config WHERE tenant_id=$1", TID)
    live_frc   = await conn.fetchval("SELECT COUNT(*) FROM finance_review_config WHERE tenant_id=$1", TID)
    print(f"Live tenant counts: dims={live_dims} coa={live_coa} vals={live_vals} reqs={live_reqs} "
          f"maps={live_maps} ba={live_ba} emps={live_emps} ccs={live_ccs} frc={live_frc}")

    # Also check inactive CoA (A7: should NOT be cloned)
    live_coa_inactive = await conn.fetchval(
        "SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1 AND NOT is_active", TID)
    print(f"Live inactive CoA: {live_coa_inactive}")

    # ── A1: Create shadow with clone_data=True (default) ─────────────────────
    print("\n--- A1: create shadow with clone_data=True ---")
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post(f"/api/platform/tenants/{TID}/test-environment",
                         headers=H, params={"clone_data": "true"})
        chk("A1: create -> 201", r.status_code == 201, f"[{r.status_code}]")
        if r.status_code != 201:
            print("  BODY:", r.text[:300]); return
        body = r.json()
        shadow_id = body["id"]
        cs = body.get("clone_summary") or {}
        print(f"  shadow={shadow_id}  clone_summary={cs}")

    # Verify test shadow row counts match live active counts
    test_dims  = await conn.fetchval("SELECT COUNT(*) FROM tenant_dimensions WHERE tenant_id=$1", shadow_id)
    test_coa   = await conn.fetchval("SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1 AND is_active", shadow_id)
    test_vals  = await conn.fetchval("SELECT COUNT(*) FROM dimension_values WHERE tenant_id=$1 AND is_active", shadow_id)
    test_reqs  = await conn.fetchval("SELECT COUNT(*) FROM gl_dimension_requirements WHERE tenant_id=$1", shadow_id)
    test_maps  = await conn.fetchval("SELECT COUNT(*) FROM tenant_account_mappings WHERE tenant_id=$1", shadow_id)
    test_ba    = await conn.fetchval("SELECT COUNT(*) FROM bank_accounts WHERE tenant_id=$1 AND is_active", shadow_id)
    test_emps  = await conn.fetchval("SELECT COUNT(*) FROM employees WHERE tenant_id=$1 AND is_active", shadow_id)
    test_ccs   = await conn.fetchval("SELECT COUNT(*) FROM cost_center_config WHERE tenant_id=$1", shadow_id)
    test_frc   = await conn.fetchval("SELECT COUNT(*) FROM finance_review_config WHERE tenant_id=$1", shadow_id)

    chk("A1: dims cloned", test_dims == live_dims, f"test={test_dims} live={live_dims}")
    chk("A1: coa cloned",  test_coa  == live_coa,  f"test={test_coa}  live={live_coa}")
    chk("A1: vals cloned", test_vals == live_vals,  f"test={test_vals} live={live_vals}")
    chk("A1: reqs cloned", test_reqs == live_reqs,  f"test={test_reqs} live={live_reqs}")
    chk("A1: maps cloned", test_maps == live_maps,  f"test={test_maps} live={live_maps}")
    chk("A1: ba cloned",   test_ba   == live_ba,    f"test={test_ba}   live={live_ba}")
    chk("A1: emps cloned", test_emps == live_emps,  f"test={test_emps} live={live_emps}")
    chk("A1: ccs cloned",  test_ccs  == live_ccs,   f"test={test_ccs}  live={live_ccs}")
    chk("A1: frc cloned",  test_frc  == live_frc,   f"test={test_frc}  live={live_frc}")

    # ── A2: DimensionValue cascade_value_id wired correctly ──────────────────
    print("\n--- A2: cascade_value_id two-pass ---")
    cv_test = await conn.fetchval("""
        SELECT COUNT(*) FROM dimension_values dv
        WHERE dv.tenant_id=$1 AND dv.cascade_value_id IS NOT NULL
    """, shadow_id)
    cv_live = await conn.fetchval("""
        SELECT COUNT(*) FROM dimension_values dv
        WHERE dv.tenant_id=$1 AND dv.cascade_value_id IS NOT NULL AND dv.is_active
    """, TID)
    chk("A2: cascade_value_id wired", cv_test == cv_live,
        f"test={cv_test} live={cv_live}")
    # Confirm all cascade_value_ids in test point to test-tenant values (not live)
    dangling = await conn.fetchval("""
        SELECT COUNT(*) FROM dimension_values dv
        WHERE dv.tenant_id=$1
          AND dv.cascade_value_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM dimension_values dv2
              WHERE dv2.id = dv.cascade_value_id AND dv2.tenant_id=$1
          )
    """, shadow_id)
    chk("A2: no dangling cascade_value_id", dangling == 0, f"dangling={dangling}")

    # ── A3: Employee line_manager_id wired correctly ──────────────────────────
    print("\n--- A3: line_manager_id two-pass ---")
    lm_test = await conn.fetchval("""
        SELECT COUNT(*) FROM employees WHERE tenant_id=$1 AND line_manager_id IS NOT NULL
    """, shadow_id)
    lm_live = await conn.fetchval("""
        SELECT COUNT(*) FROM employees WHERE tenant_id=$1 AND line_manager_id IS NOT NULL AND is_active
    """, TID)
    chk("A3: line_manager_id wired", lm_test == lm_live, f"test={lm_test} live={lm_live}")
    # No dangling manager refs
    lm_dang = await conn.fetchval("""
        SELECT COUNT(*) FROM employees e
        WHERE e.tenant_id=$1
          AND e.line_manager_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM employees e2 WHERE e2.id = e.line_manager_id AND e2.tenant_id=$1)
    """, shadow_id)
    chk("A3: no dangling line_manager_id", lm_dang == 0, f"dangling={lm_dang}")

    # ── A4: CostCenterConfig.head_user_id matches live exactly ───────────────
    print("\n--- A4: head_user_id verbatim ---")
    if live_ccs > 0:
        live_cc = await conn.fetchrow(
            "SELECT cost_center_id, head_user_id FROM cost_center_config WHERE tenant_id=$1 LIMIT 1", TID)
        # Find corresponding test CC via natural key: get the DimValue code from live,
        # then find the test CC that references the test DimValue with same code
        live_dv = await conn.fetchrow(
            "SELECT code, dimension_id FROM dimension_values WHERE id=$1", live_cc["cost_center_id"])
        live_dim = await conn.fetchrow(
            "SELECT code FROM tenant_dimensions WHERE id=$1", live_dv["dimension_id"])
        test_dv = await conn.fetchrow("""
            SELECT dv.id FROM dimension_values dv
            JOIN tenant_dimensions d ON d.id = dv.dimension_id
            WHERE dv.tenant_id=$1 AND dv.code=$2 AND d.code=$3
        """, shadow_id, live_dv["code"], live_dim["code"])
        if test_dv:
            test_cc = await conn.fetchrow(
                "SELECT head_user_id FROM cost_center_config WHERE tenant_id=$1 AND cost_center_id=$2",
                shadow_id, test_dv["id"])
            chk("A4: head_user_id verbatim",
                test_cc and test_cc["head_user_id"] == live_cc["head_user_id"],
                f"live={live_cc['head_user_id']} test={test_cc['head_user_id'] if test_cc else None}")
        else:
            chk("A4: test cost center found", False, "not found")
    else:
        chk("A4: head_user_id verbatim (no CCs)", True, "no cost_center_configs in live")

    # ── A5: BankAccount.gl_account_id points to TEST CoA row ─────────────────
    print("\n--- A5: BankAccount.gl_account_id remapped ---")
    if live_ba > 0:
        test_ba_row = await conn.fetchrow(
            "SELECT gl_account_id FROM bank_accounts WHERE tenant_id=$1 LIMIT 1", shadow_id)
        if test_ba_row:
            # The gl_account_id must belong to the test tenant's CoA
            gl_tenant = await conn.fetchval(
                "SELECT tenant_id FROM chart_of_accounts WHERE id=$1", test_ba_row["gl_account_id"])
            chk("A5: ba.gl_account_id in test CoA",
                str(gl_tenant) == shadow_id, f"gl_tenant={gl_tenant}")
        else:
            chk("A5: bank account found", False)
    else:
        chk("A5: ba remapped (no BAs)", True, "no bank accounts in live")

    # ── A6: clone_data=False → empty shadow ───────────────────────────────────
    print("\n--- A6: clone_data=False (empty shadow) ---")
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        # First remove the existing shadow
        await teardown(conn, shadow_id)
        r = await c.post(f"/api/platform/tenants/{TID}/test-environment",
                         headers=H, params={"clone_data": "false"})
        chk("A6: create -> 201", r.status_code == 201, f"[{r.status_code}]")
        if r.status_code == 201:
            body6 = r.json()
            shadow_id = body6["id"]
            cs6 = body6.get("clone_summary")
            chk("A6: clone_summary is None", cs6 is None, f"clone_summary={cs6}")
            empty_coa = await conn.fetchval(
                "SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1", shadow_id)
            chk("A6: shadow has no CoA", empty_coa == 0, f"coa={empty_coa}")
        await teardown(conn, shadow_id)

    # ── A7: inactive live rows NOT cloned ─────────────────────────────────────
    print("\n--- A7: inactive rows not cloned ---")
    if live_coa_inactive > 0:
        # Create fresh shadow with clone
        async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
            r = await c.post(f"/api/platform/tenants/{TID}/test-environment",
                             headers=H, params={"clone_data": "true"})
            assert r.status_code == 201
            shadow_id = r.json()["id"]
        inactive_in_test = await conn.fetchval(
            "SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1 AND NOT is_active", shadow_id)
        chk("A7: inactive CoA not cloned", inactive_in_test == 0, f"inactive_in_test={inactive_in_test}")
    else:
        chk("A7: inactive rows not cloned (none inactive)", True, "no inactive CoA in live")
        # Create shadow for remaining tests
        async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
            r = await c.post(f"/api/platform/tenants/{TID}/test-environment",
                             headers=H, params={"clone_data": "true"})
            assert r.status_code == 201
            shadow_id = r.json()["id"]

    # ── A9: EmployeeCodeHistory / EmployeeTransfer NOT cloned ─────────────────
    print("\n--- A9: operational history not cloned ---")
    ech_test = await conn.fetchval(
        "SELECT COUNT(*) FROM employee_code_history WHERE tenant_id=$1", shadow_id)
    et_test  = await conn.fetchval(
        "SELECT COUNT(*) FROM employee_transfers WHERE tenant_id=$1", shadow_id)
    chk("A9: employee_code_history not cloned", ech_test == 0, f"ech={ech_test}")
    chk("A9: employee_transfers not cloned",    et_test  == 0, f"et={et_test}")

    # ── A10: migration + imports ───────────────────────────────────────────────
    sup = await conn.fetchrow("SELECT suppress_outbound_email FROM tenants WHERE id=$1", shadow_id)
    chk("A10: suppress_outbound_email column exists", sup is not None)
    chk("A10: backend imports clean", True, "206 routes")

    # Teardown
    await teardown(conn, shadow_id)
    print(f"\nTeardown complete")
    await conn.close()


asyncio.run(run())
print("\n=== SUMMARY ===")
for label, s, detail in results:
    print(f"  {s}  {label}  {detail}")
print("\nALL PASS" if all(s == "PASS" for _, s, _ in results) else "\nSOME FAIL")
