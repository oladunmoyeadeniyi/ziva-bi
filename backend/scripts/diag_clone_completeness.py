"""Diagnose why cloned test shadow shows 0% setup completion. No changes."""
import asyncio, datetime, os, sys
sys.path.insert(0, ".")
os.environ.update({
    "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost:5432/ziva_dev",
    "SECRET_KEY": "local-dev-secret-change-me-ziva-bi-2026", "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "30", "REFRESH_TOKEN_EXPIRE_DAYS": "7",
    "ALLOWED_ORIGINS": '["http://localhost:3000"]',
    "SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "x",
    "SUPABASE_BUCKET": "documents",
})
import asyncpg, jwt
from httpx import AsyncClient, ASGITransport
from app.main import app

LIVE_ID = "bd2c8a25-7467-494a-96fa-30f40b5b5d19"
SA_UID  = "7d9a7dab-5b8f-43ac-8d16-18e6bbe9feeb"
SEC     = "local-dev-secret-change-me-ziva-bi-2026"


def sa_tok():
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "sub": SA_UID, "user_tenant_id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": None, "session_id": "0843a3f5-13b5-495a-9749-aa0ed7d0be25",
        "email": "admin@zivafinance.com", "account_type": "business",
        "role_tier": None, "is_super_admin": True, "is_tenant_admin": False,
        "has_non_admin_role": False, "environment": "live",
        "exp": now + datetime.timedelta(hours=2), "iat": now, "type": "access",
    }, SEC, algorithm="HS256")


async def main():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")

    # Create fresh shadow for inspection
    H = {"Authorization": f"Bearer {sa_tok()}", "Content-Type": "application/json"}
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post(f"/api/platform/tenants/{LIVE_ID}/test-environment", headers=H,
                         params={"clone_data": "true"})
        assert r.status_code == 201, f"Failed: {r.text}"
        shadow_id = r.json()["id"]
        cs = r.json().get("clone_summary", {})
        print(f"Shadow created: {shadow_id}")
        print(f"Clone summary: {cs}")

    print()
    print("=== CLONED tables (present in shadow) ===")
    rows = [
        ("tenant_dimensions",        "is_active"),
        ("chart_of_accounts",        "is_active"),
        ("dimension_values",         "is_active"),
        ("gl_dimension_requirements", None),
        ("tenant_account_mappings",  None),
        ("bank_accounts",            "is_active"),
        ("employees",                "is_active"),
        ("cost_center_config",       None),
        ("finance_review_config",    None),
    ]
    for table, col in rows:
        if col:
            n = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE tenant_id=$1 AND {col}", shadow_id)
        else:
            n = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE tenant_id=$1", shadow_id)
        print(f"  {table:40s} {n}")

    print()
    print("=== NOT-CLONED tables (what completeness checks need) ===")

    # 1. tenant_org_config
    org = await conn.fetchrow(
        "SELECT legal_name, functional_currency FROM tenant_org_config WHERE tenant_id=$1", shadow_id)
    print(f"  tenant_org_config row:        {'EXISTS' if org else 'MISSING'}")
    if org:
        print(f"    legal_name={org['legal_name']}  functional_currency={org['functional_currency']}")
    org_complete = bool(org and org["legal_name"] and org["functional_currency"])
    print(f"    -> org_complete = {org_complete}")

    # 2. tenant_modules
    mod_total  = await conn.fetchval("SELECT COUNT(*) FROM tenant_modules WHERE tenant_id=$1", shadow_id)
    mod_active = await conn.fetchval("SELECT COUNT(*) FROM tenant_modules WHERE tenant_id=$1 AND is_active", shadow_id)
    print(f"  tenant_modules rows:          total={mod_total} active={mod_active}")
    modules_complete = mod_active > 0
    print(f"    -> modules_complete = {modules_complete}")

    # 3. tenant_tax_config
    tax = await conn.fetchrow("SELECT vat_config, wht_config, paye_config FROM tenant_tax_config WHERE tenant_id=$1", shadow_id)
    has_tax = bool(tax and (tax["vat_config"] or tax["wht_config"] or tax["paye_config"]))
    print(f"  tenant_tax_config row:        {'EXISTS' if tax else 'MISSING'}  has_any_config={has_tax}")
    print(f"    -> tax_complete = {has_tax}")

    # 4. approval_matrix
    wf = await conn.fetchval("SELECT COUNT(*) FROM approval_matrix WHERE tenant_id=$1", shadow_id)
    print(f"  approval_matrix rows:         {wf}")
    print(f"    -> workflows_complete = {wf > 0}")

    # 5. tenant_expense_config
    ec = await conn.fetchrow("SELECT id FROM tenant_expense_config WHERE tenant_id=$1", shadow_id)
    print(f"  tenant_expense_config row:    {'EXISTS' if ec else 'MISSING'}")
    print(f"    -> module_setup_complete = {ec is not None}")

    # 6. user_tenants power_admin
    pa = await conn.fetchval(
        "SELECT COUNT(*) FROM user_tenants WHERE tenant_id=$1 AND role_tier='power_admin' AND is_active", shadow_id)
    print(f"  user_tenants power_admin:     {pa}")
    print(f"    -> roles_complete = {pa > 0}")

    print()
    print("=== Live tenant values (for comparison) ===")
    l_org = await conn.fetchrow("SELECT legal_name, functional_currency FROM tenant_org_config WHERE tenant_id=$1", LIVE_ID)
    l_mod = await conn.fetchval("SELECT COUNT(*) FROM tenant_modules WHERE tenant_id=$1 AND is_active", LIVE_ID)
    l_tax = await conn.fetchrow("SELECT vat_config, wht_config, paye_config FROM tenant_tax_config WHERE tenant_id=$1", LIVE_ID)
    l_wf  = await conn.fetchval("SELECT COUNT(*) FROM approval_matrix WHERE tenant_id=$1", LIVE_ID)
    l_ec  = await conn.fetchrow("SELECT id FROM tenant_expense_config WHERE tenant_id=$1", LIVE_ID)
    l_pa  = await conn.fetchval("SELECT COUNT(*) FROM user_tenants WHERE tenant_id=$1 AND role_tier='power_admin' AND is_active", LIVE_ID)
    print(f"  tenant_org_config:  legal_name={l_org['legal_name'] if l_org else None}  func_currency={l_org['functional_currency'] if l_org else None}")
    print(f"  tenant_modules active: {l_mod}")
    l_has_tax = bool(l_tax and (l_tax["vat_config"] or l_tax["wht_config"] or l_tax["paye_config"]))
    print(f"  tenant_tax_config: has_config={l_has_tax}")
    print(f"  approval_matrix: {l_wf} rows")
    print(f"  tenant_expense_config: {'EXISTS' if l_ec else 'MISSING'}")
    print(f"  power_admin count: {l_pa}")

    print()
    print("=== Simulated progress logic for shadow ===")
    dim_count = await conn.fetchval("SELECT COUNT(*) FROM tenant_dimensions WHERE tenant_id=$1 AND is_active", shadow_id)
    coa_count = await conn.fetchval("SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id=$1 AND is_active", shadow_id)
    emp_count = await conn.fetchval("SELECT COUNT(*) FROM employees WHERE tenant_id=$1 AND is_active", shadow_id)

    dims_not_applicable = False
    dims_complete  = dims_not_applicable or dim_count > 0
    coa_complete   = coa_count > 0
    emps_complete  = emp_count > 0

    dims_locked    = not org_complete
    coa_locked     = not (dims_complete or dims_not_applicable) or dims_locked
    emps_locked    = not coa_complete or coa_locked
    roles_locked   = not emps_complete or emps_locked
    wf_locked      = not (pa > 0) or roles_locked
    tax_locked     = not org_complete
    module_locked  = not (coa_complete and (dims_complete or dims_not_applicable))

    def status(complete, locked):
        if locked:   return "LOCKED"
        if complete: return "complete"
        return "not_started"

    print(f"  Organisation:          status={status(org_complete, False)}      complete={org_complete}")
    print(f"  Module activation:     status={status(modules_complete, False)}      complete={modules_complete}  (no modules in test)")
    print(f"  Dimensions:            status={status(dims_complete, dims_locked)}  complete={dims_complete}  dim_count={dim_count}")
    print(f"  Chart of accounts:     status={status(coa_complete, coa_locked)}  complete={coa_complete}  coa_count={coa_count}")
    print(f"  Employees:             status={status(emps_complete, emps_locked)}")
    print(f"  Tax & statutory:       status={status(has_tax, tax_locked)}")
    print(f"  Roles & permissions:   status={status(pa > 0, roles_locked)}")
    print(f"  Approval workflows:    status={status(wf > 0, wf_locked)}")
    print(f"  Module setup:          status={status(ec is not None, module_locked)}")

    complete_count = sum(1 for c,l in [
        (org_complete,False), (modules_complete,False), (dims_complete,dims_locked),
        (coa_complete,coa_locked), (emps_complete,emps_locked), (has_tax,tax_locked),
        (pa>0,roles_locked), (wf>0,wf_locked), (ec is not None,module_locked)
    ] if c and not l)
    print(f"\n  => Sections complete (rough): {complete_count}/12  (0% is expected given missing org_config)")

    print()
    print("=== Root cause summary ===")
    missing = []
    if not org:          missing.append("tenant_org_config (legal_name + functional_currency)")
    if mod_active == 0:  missing.append("tenant_modules (no active modules)")
    if not has_tax:      missing.append("tenant_tax_config (no tax rules)")
    if wf == 0:          missing.append("approval_matrix (no workflows)")
    if not ec:           missing.append("tenant_expense_config (module setup)")
    for m in missing:
        print(f"  MISSING: {m}")

    # Teardown
    for table in ["finance_review_config","cost_center_config","employees",
                  "bank_accounts","tenant_account_mappings","gl_dimension_requirements",
                  "dimension_values","chart_of_accounts","tenant_dimensions",
                  "user_tenants"]:
        await conn.execute(f"DELETE FROM {table} WHERE tenant_id=$1", shadow_id)
    await conn.execute("DELETE FROM tenants WHERE id=$1", shadow_id)
    print(f"\nCleaned up shadow {shadow_id}")
    await conn.close()


asyncio.run(main())
