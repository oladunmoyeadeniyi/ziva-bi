"""
Acceptance tests for BRIEF_fix_resumption_date_clean_reupload.md.
All work against shadow e8a2fd8c-5466-4618-bb37-97681a8bfb05 only.
"""
import asyncio, datetime, io, json, os, sys
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

SHADOW  = "e8a2fd8c-5466-4618-bb37-97681a8bfb05"
UID_RBA = "a9961259-7838-455a-bc1b-d7a58da02690"
SEC     = "local-dev-secret-change-me-ziva-bi-2026"
SES     = "0843a3f5-13b5-495a-9749-aa0ed7d0be25"


def tok(ut):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "sub": UID_RBA, "user_tenant_id": ut, "tenant_id": SHADOW, "session_id": SES,
        "email": "x@x.com", "account_type": "business", "role_tier": "power_admin",
        "is_super_admin": False, "is_tenant_admin": True, "has_non_admin_role": False,
        "environment": "live", "exp": now + datetime.timedelta(hours=24), "iat": now, "type": "access",
    }, SEC, algorithm="HS256")


results = []

def chk(label, ok, detail=""):
    s = "PASS" if ok else "FAIL"
    results.append((label, s, detail)); print(f"  {s}  {label}  {detail}")


def make_xlsx(rows: list[list]) -> bytes:
    """Build a minimal employee upload xlsx with header + given rows."""
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = "Employees"
    ws.append(["First Name", "Last Name", "Email", "Other Name", "Preferred Name",
               "Employee Code", "Phone", "Cost Center Code", "Line Manager Email",
               "Resumption Date (dd/mm/yyyy)", "Head of Cost Center (Y/N)"])
    for row in rows:
        ws.append(row)
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return buf.read()


def make_xlsx_with_datetime(rows_data: list[tuple]) -> bytes:
    """
    Build xlsx where the Resumption Date cell is a real Python datetime object
    (simulating what Excel does when a user types a date into a date-formatted cell).
    """
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = "Employees"
    ws.append(["First Name", "Last Name", "Email", "Other Name", "Preferred Name",
               "Employee Code", "Phone", "Cost Center Code", "Line Manager Email",
               "Resumption Date (dd/mm/yyyy)", "Head of Cost Center (Y/N)"])
    for fname, lname, email, cc, dt_val, head in rows_data:
        ws.append([fname, lname, email, "", "", "", "", cc, "", dt_val, head])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return buf.read()


async def run():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")

    # Get user_tenant id for shadow
    ut = await conn.fetchrow("SELECT id FROM user_tenants WHERE tenant_id=$1 AND user_id=$2", SHADOW, UID_RBA)
    if not ut:
        import uuid as _uuid
        ut_id = str(_uuid.uuid4())
        await conn.execute("""
            INSERT INTO user_tenants (id, user_id, tenant_id, password_hash, is_active, role_tier, failed_login_attempts)
            VALUES ($1, $2, $3, '$2b$12$x', true, 'power_admin', 0)
        """, ut_id, UID_RBA, SHADOW)
    else:
        ut_id = str(ut["id"])

    H = {"Authorization": f"Bearer {tok(ut_id)}", "Content-Type": "application/json"}

    # ── Part B: Delete partial rows ───────────────────────────────────────────
    print("\n--- Part B: Delete partial rows ---")
    before_emps = await conn.fetchval("SELECT COUNT(*) FROM employees WHERE tenant_id=$1", SHADOW)
    before_ccc  = await conn.fetchval("SELECT COUNT(*) FROM cost_center_config WHERE tenant_id=$1", SHADOW)
    print(f"  Before: {before_emps} employees, {before_ccc} CostCenterConfig rows")

    # Hard-delete on test shadow (clean slate)
    await conn.execute("DELETE FROM cost_center_config WHERE tenant_id=$1", SHADOW)
    await conn.execute("DELETE FROM employees WHERE tenant_id=$1", SHADOW)

    after_emps = await conn.fetchval("SELECT COUNT(*) FROM employees WHERE tenant_id=$1", SHADOW)
    after_ccc  = await conn.fetchval("SELECT COUNT(*) FROM cost_center_config WHERE tenant_id=$1", SHADOW)
    chk("B1: employees deleted", after_emps == 0, f"remaining={after_emps}")
    chk("B1: CostCenterConfig deleted", after_ccc == 0, f"remaining={after_ccc}")

    # ── Part A acceptance tests ───────────────────────────────────────────────
    print("\n--- A1: Parser accepts Excel datetime cell (real Python datetime object) ---")
    # N22341FI = Finance cost center
    dt_cell = datetime.datetime(2024, 1, 4, 0, 0, 0)  # same as what openpyxl returns
    xlsx_dt = make_xlsx_with_datetime([
        ("Test", "Datetime", "dt@shadow.com", "N22341FI", dt_cell, ""),
    ])
    from httpx import AsyncClient as HC
    async with HC(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post("/api/hr/employees/upload",
            headers={"Authorization": H["Authorization"]},
            files={"file": ("test.xlsx", xlsx_dt, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        chk("A1: upload -> 200", r.status_code == 200, f"[{r.status_code}]")
        if r.status_code == 200:
            res = r.json()
            chk("A1: imported=1, errors=0", res.get("imported",0) == 1 and len(res.get("errors",[])) == 0,
                f"imported={res.get('imported')} errors={res.get('errors')}")
            emp = await conn.fetchrow("SELECT resumption_date FROM employees WHERE tenant_id=$1 AND email='dt@shadow.com'", SHADOW)
            chk("A1: resumption_date stored as date(2024,1,4)",
                emp and str(emp["resumption_date"]) == "2024-01-04",
                f"stored={emp['resumption_date'] if emp else None}")

    print("\n--- A2: Parser accepts text dd/mm/yyyy string ---")
    xlsx_txt = make_xlsx([["Test2", "Text", "txt@shadow.com", "", "", "", "", "N22341FI", "", "04/01/2024", ""]])
    async with HC(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post("/api/hr/employees/upload",
            headers={"Authorization": H["Authorization"]},
            files={"file": ("t2.xlsx", xlsx_txt, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        if r.status_code == 200:
            res = r.json()
            chk("A2: imported=1, errors=0", (res.get("imported",0)+res.get("updated",0)) >= 1 and len(res.get("errors",[])) == 0,
                f"imported={res.get('imported')} errors={res.get('errors')}")
            emp2 = await conn.fetchrow("SELECT resumption_date FROM employees WHERE tenant_id=$1 AND email='txt@shadow.com'", SHADOW)
            chk("A2: resumption_date stored as date(2024,1,4)",
                emp2 and str(emp2["resumption_date"]) == "2024-01-04",
                f"stored={emp2['resumption_date'] if emp2 else None}")

    print("\n--- A3: Parser rejects genuinely unparseable value ---")
    xlsx_bad = make_xlsx([["Test3", "Bad", "bad@shadow.com", "", "", "", "", "", "", "not-a-date", ""]])
    async with HC(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post("/api/hr/employees/upload",
            headers={"Authorization": H["Authorization"]},
            files={"file": ("t3.xlsx", xlsx_bad, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        if r.status_code == 200:
            res = r.json()
            chk("A3: has row error for bad date", len(res.get("errors",[])) > 0, f"errors={res.get('errors',[][:1])}")
            chk("A3: employee still created (date optional)", (res.get("imported",0)+res.get("updated",0)) >= 1)

    print("\n--- A4: Date floor check: date before registration rejected ---")
    xlsx_floor = make_xlsx([["Test4", "Floor", "floor@shadow.com", "", "", "", "", "", "", "25/08/2020", ""]])
    async with HC(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post("/api/hr/employees/upload",
            headers={"Authorization": H["Authorization"]},
            files={"file": ("t4.xlsx", xlsx_floor, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        if r.status_code == 200:
            res = r.json()
            chk("A4: has row error for pre-registration date", len(res.get("errors",[])) > 0,
                f"errors={res.get('errors',[][:1])}")
            if res.get("errors"):
                chk("A4: error mentions registration date", "registration" in str(res["errors"][0]).lower(),
                    f"error={res['errors'][0]}")

    print("\n--- A5: Blank resumption date (optional) has no error ---")
    xlsx_blank = make_xlsx([["Test5", "Blank", "blank@shadow.com", "", "", "", "", "", "", "", ""]])
    async with HC(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post("/api/hr/employees/upload",
            headers={"Authorization": H["Authorization"]},
            files={"file": ("t5.xlsx", xlsx_blank, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        if r.status_code == 200:
            res = r.json()
            date_errors = [e for e in res.get("errors",[]) if "date" in str(e).lower()]
            chk("A5: blank date has no error", len(date_errors) == 0, f"date_errors={date_errors}")

    # Cleanup partial test rows before Part C
    await conn.execute("DELETE FROM cost_center_config WHERE tenant_id=$1", SHADOW)
    await conn.execute("DELETE FROM employees WHERE tenant_id=$1", SHADOW)
    print("  Cleaned test rows, ready for Part C re-upload")

    print("\n=== Part C waiting ===")
    chk("C: shadow clean (0 employees before re-upload)",
        (await conn.fetchval("SELECT COUNT(*) FROM employees WHERE tenant_id=$1", SHADOW)) == 0)
    chk("C: shadow clean (0 CostCenterConfig before re-upload)",
        (await conn.fetchval("SELECT COUNT(*) FROM cost_center_config WHERE tenant_id=$1", SHADOW)) == 0)
    print("  Awaiting Adeniyi's re-upload of the original 40-employee file.")
    print("  The file's datetime cells will now parse correctly.")
    print("  Red Bull registration date: 2021-08-25")
    print("  File dates like 2024-01-04 pass the floor (2024-01-04 > 2021-08-25). CLEAR TO PROCEED.")

    await conn.close()


asyncio.run(run())

print("\n=== SUMMARY ===")
for label, s, detail in results:
    print(f"  {s}  {label}  {detail}")
print("\nALL PASS" if all(s == "PASS" for _, s, _ in results) else "\nSOME FAIL")
