"""Acceptance test script for BRIEF_expense_gl_3a. Run: python scripts/test_gl3a.py"""
import asyncio
import datetime
import json
import os
import sys

import asyncpg
import jwt

sys.path.insert(0, ".")
os.environ.update({
    "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost:5432/ziva_dev",
    "SECRET_KEY": "local-dev-secret-change-me-ziva-bi-2026",
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "30",
    "REFRESH_TOKEN_EXPIRE_DAYS": "7",
    "ALLOWED_ORIGINS": '["http://localhost:3000"]',
    "SUPABASE_URL": "https://x.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "x",
    "SUPABASE_BUCKET": "documents",
})

from httpx import AsyncClient, ASGITransport
from app.main import app

SEC = "local-dev-secret-change-me-ziva-bi-2026"
TID = "bd2c8a25-7467-494a-96fa-30f40b5b5d19"
SES = "0843a3f5-13b5-495a-9749-aa0ed7d0be25"
UID_A = "a9961259-7838-455a-bc1b-d7a58da02690"
UID_B = "a471bbb0-94ae-4a76-9716-909e986eedac"
UT_A  = "22da50be-66d7-4068-8010-678386404c4c"
UT_B  = "1cc6cff1-f5b1-404b-8f34-402ab4703d82"
# GL 860000 (Profit or Loss clearing account) — no required dimensions
GL_NO_DIM = "b24bc316-01fe-4d8b-8560-83c0a210db41"
DATE = "2027-01-15"  # FY2027 P1 — opened OPEN for testing; FY2026 is STATUTORY_CLOSED


def make_tok(uid, ut, admin=False, tier=None):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "sub": uid, "user_tenant_id": ut, "tenant_id": TID, "session_id": SES,
        "email": "x@x.com", "account_type": "business", "role_tier": tier,
        "is_super_admin": False, "is_tenant_admin": admin,
        "has_non_admin_role": not admin, "environment": "live",
        "exp": now + datetime.timedelta(hours=24), "iat": now, "type": "access",
    }, SEC, algorithm="HS256")


HA = {"Authorization": f"Bearer {make_tok(UID_A, UT_A, admin=False)}", "Content-Type": "application/json"}
HB = {"Authorization": f"Bearer {make_tok(UID_B, UT_B, admin=True, tier='power_admin')}", "Content-Type": "application/json"}

results = []


def chk(label, ok, detail=""):
    s = "PASS" if ok else "FAIL"
    results.append((label, s, detail))
    print(f"  {s}  {label}  {detail}")


async def submit_and_get_lvl1(c, rid, approver_id):
    r = await c.post(f"/api/approvals/reports/{rid}/submit", headers=HA,
                     content=json.dumps({"level1_approver_id": approver_id}))
    if r.status_code != 200:
        return None
    approvals = (await c.get(f"/api/approvals/reports/{rid}", headers=HA)).json()
    return next((a for a in approvals if a["level"] == 1 and a["status"] == "PENDING"), None)


async def run():
    # Ensure matrix starts at 1-level (idempotent; resets any previous test run state)
    _conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")
    await _conn.execute(
        "UPDATE approval_matrix SET levels=1, level2_role=NULL WHERE tenant_id=$1", TID
    )
    await _conn.close()

    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:

        # T2: missing gl_id -> 422, status not changed to APPROVED
        print("\n--- T2: missing gl_id blocks approval ---")
        r = await c.post("/api/expenses/reports", headers=HA,
                         content=json.dumps({"report_date": DATE, "description": "T2"}))
        rid2 = r.json().get("id")
        chk("T2 report created", r.status_code == 201, r.json().get("report_number", "?"))
        await c.post(f"/api/expenses/reports/{rid2}/lines", headers=HA,
                     content=json.dumps({"description": "uncoded", "amount": "300.00"}))
        lvl1 = await submit_and_get_lvl1(c, rid2, UID_B)
        if lvl1:
            r = await c.post(f"/api/approvals/{lvl1['id']}/approve", headers=HB,
                             content=json.dumps({"comment": "x"}))
            chk("T2 blocked -> 422", r.status_code == 422, r.text[:120])
            r2 = (await c.get(f"/api/expenses/reports/{rid2}", headers=HA)).json()
            chk("T2 status unchanged (PENDING_APPROVAL)", r2.get("status") == "PENDING_APPROVAL",
                f"status={r2.get('status')}")
        else:
            chk("T2 pending approval found", False)

        # T1: fully coded 2-line -> 200, journal posted
        print("\n--- T1: fully coded 2-line, journal posted ---")
        r = await c.post("/api/expenses/reports", headers=HA,
                         content=json.dumps({"report_date": DATE, "description": "T1"}))
        rid1 = r.json().get("id")
        rnum1 = r.json().get("report_number")
        chk("T1 report created", r.status_code == 201, rnum1)
        for i in [1, 2]:
            r = await c.post(f"/api/expenses/reports/{rid1}/lines", headers=HA,
                             content=json.dumps({"description": f"line {i}", "amount": "500.00",
                                                 "gl_id": GL_NO_DIM}))
            chk(f"T1 line {i} added", r.status_code in (200, 201), f"[{r.status_code}]")
        lvl1 = await submit_and_get_lvl1(c, rid1, UID_B)
        if lvl1:
            r = await c.post(f"/api/approvals/{lvl1['id']}/approve", headers=HB,
                             content=json.dumps({"comment": "Approved"}))
            chk("T1 final approve -> 200", r.status_code == 200, f"[{r.status_code}]")
            chk("T1 status APPROVED", r.json().get("status") == "APPROVED",
                f"status={r.json().get('status')}")
        else:
            chk("T1 pending approval found", False)

        # T4: multi-line 3 amounts, same GL (posting allows duplicate GL entries)
        print("\n--- T4: 3-line multi report ---")
        r = await c.post("/api/expenses/reports", headers=HA,
                         content=json.dumps({"report_date": DATE, "description": "T4"}))
        rid4 = r.json().get("id")
        rnum4 = r.json().get("report_number")
        chk("T4 report created", r.status_code == 201, rnum4)
        for i, amt in enumerate(["200.00", "300.00", "100.00"], 1):
            r = await c.post(f"/api/expenses/reports/{rid4}/lines", headers=HA,
                             content=json.dumps({"description": f"multi {i}", "amount": amt,
                                                 "gl_id": GL_NO_DIM}))
            chk(f"T4 line {i} added", r.status_code in (200, 201), f"[{r.status_code}]")
        lvl1 = await submit_and_get_lvl1(c, rid4, UID_B)
        if lvl1:
            r = await c.post(f"/api/approvals/{lvl1['id']}/approve", headers=HB,
                             content=json.dumps({"comment": "ok"}))
            chk("T4 approve -> 200", r.status_code == 200, f"[{r.status_code}]")
            chk("T4 status APPROVED", r.json().get("status") == "APPROVED")
        else:
            chk("T4 pending approval found", False)

    # T5: non-final (level 1 of 2) does NOT trigger posting.
    # The approval_matrix router has a separate updated_at lazy-load bug (same class as
    # bank_accounts PUT — a separate fix). Patch the matrix directly via DB.
    print("\n--- T5: non-final L1-of-2 does not post ---")

    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")
    # Temporarily set matrix to 2 levels so L1 is not final
    await conn.execute(
        "UPDATE approval_matrix SET levels=2, level2_role='GM' WHERE tenant_id=$1", TID
    )
    await conn.close()

    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        r = await c.post("/api/expenses/reports", headers=HA,
                         content=json.dumps({"report_date": DATE, "description": "T5"}))
        rid5 = r.json().get("id")
        await c.post(f"/api/expenses/reports/{rid5}/lines", headers=HA,
                     content=json.dumps({"description": "x", "amount": "1000.00", "gl_id": GL_NO_DIM}))
        # UID_B at both levels (requestor is UID_A; UID_B can be at multiple levels)
        r = await c.post(f"/api/approvals/reports/{rid5}/submit", headers=HA,
                         content=json.dumps({"level1_approver_id": UID_B, "level2_approver_id": UID_B}))
        chk("T5 submitted", r.status_code == 200, f"[{r.status_code}]")
        approvals5 = (await c.get(f"/api/approvals/reports/{rid5}", headers=HA)).json()
        lvl1 = next((a for a in approvals5 if a["level"] == 1 and a["status"] == "PENDING"), None)
        if lvl1:
            r = await c.post(f"/api/approvals/{lvl1['id']}/approve", headers=HB,
                             content=json.dumps({"comment": "ok"}))
            chk("T5 L1 approve -> 200", r.status_code == 200, f"[{r.status_code}]")
            chk("T5 status still PENDING_APPROVAL (no post yet)", r.json().get("status") == "PENDING_APPROVAL",
                f"status={r.json().get('status')}")
        else:
            chk("T5 pending L1 found", False, str(approvals5[:1]))

    # Reset matrix to 1-level
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")
    await conn.execute("UPDATE approval_matrix SET levels=1, level2_role=NULL WHERE tenant_id=$1", TID)

    # Verify DB: journal entries for expense source
    jes = await conn.fetch("""
        SELECT je.reference_number, je.source, je.source_reference, je.status,
               je.entry_date, COUNT(jl.id) as line_count,
               SUM(CASE WHEN jl.debit>0 THEN jl.debit ELSE 0 END) as total_debit,
               SUM(CASE WHEN jl.credit>0 THEN jl.credit ELSE 0 END) as total_credit
        FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id
        WHERE je.tenant_id=$1 AND je.source='expense'
        GROUP BY je.id, je.reference_number, je.source, je.source_reference,
                 je.status, je.entry_date
        ORDER BY je.created_at DESC LIMIT 5
    """, TID)

    print("\n=== Posted expense journals ===")
    for je in jes:
        balanced = je["total_debit"] == je["total_credit"]
        print(f"  {je['reference_number']}  "
              f"src_ref={je['source_reference']}  status={je['status']}  "
              f"lines={je['line_count']}  debit={je['total_debit']}  credit={je['total_credit']}  "
              f"balanced={balanced}")
    chk("T1 journal posted for report", any(je["source_reference"] == rnum1 for je in jes))
    chk("T4 journal posted for report", any(je["source_reference"] == rnum4 for je in jes))

    # T1 detail check
    t1_je = next((je for je in jes if je["source_reference"] == rnum1), None)
    if t1_je:
        chk("T1 journal balanced", t1_je["total_debit"] == t1_je["total_credit"],
            f"debit={t1_je['total_debit']} credit={t1_je['total_credit']}")
        chk("T1 total=1000 (2x500)", t1_je["total_debit"] == 1000,
            f"debit={t1_je['total_debit']}")
        chk("T1 status POSTED", t1_je["status"] == "POSTED")
        chk("T1 3 journal lines (2 debit + 1 credit)", int(t1_je["line_count"]) == 3,
            f"lines={t1_je['line_count']}")

    # T7: audit log includes EXPENSE_GL_POSTED with reference_number
    audit = await conn.fetch("""
        SELECT event_type, log_metadata FROM audit_logs
        WHERE tenant_id=$1 AND event_type='EXPENSE_GL_POSTED'
        ORDER BY created_at DESC LIMIT 3
    """, TID)
    print("\n=== Audit log EXPENSE_GL_POSTED ===")
    for al in audit:
        print(f"  event={al['event_type']}  meta={al['log_metadata']}")
    chk("T7 EXPENSE_GL_POSTED audit entry exists", len(audit) > 0)
    if audit:
        meta = audit[0]["log_metadata"]
        chk("T7 journal_reference in metadata", "journal_reference" in meta,
            f"meta_keys={list(meta.keys())}")

    await conn.close()


asyncio.run(run())

print("\n=== SUMMARY ===")
for label, s, detail in results:
    print(f"  {s}  {label}  {detail}")
all_pass = all(s == "PASS" for _, s, _ in results)
print("\nALL PASS" if all_pass else "\nSOME FAIL")
