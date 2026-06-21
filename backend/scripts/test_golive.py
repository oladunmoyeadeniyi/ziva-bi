"""Acceptance tests for BRIEF_golive_lifecycle_link. Run: python scripts/test_golive.py"""
import asyncio
import datetime
import json
import os
import sys
from unittest.mock import AsyncMock, patch

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
from app.schemas.setup import ProgressResponse, SectionStatus

SEC     = "local-dev-secret-change-me-ziva-bi-2026"
TID     = "bd2c8a25-7467-494a-96fa-30f40b5b5d19"   # Red Bull (fully configured)
TEST_TID = "f2aecfab-025f-410f-a7f6-df923172c8a1"  # test tenant (empty setup)
SES     = "0843a3f5-13b5-495a-9749-aa0ed7d0be25"
SA_UID  = "7d9a7dab-5b8f-43ac-8d16-18e6bbe9feeb"   # admin@zivafinance.com


def make_tok(tenant_id):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        "sub": SA_UID,
        "user_tenant_id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": tenant_id,
        "session_id": SES,
        "email": "admin@zivafinance.com",
        "account_type": "business",
        "role_tier": None,
        "is_super_admin": True,
        "is_tenant_admin": False,
        "has_non_admin_role": False,
        "environment": "live",
        "exp": now + datetime.timedelta(hours=24),
        "iat": now,
        "type": "access",
    }, SEC, algorithm="HS256")


# Simulates a tenant with all blocking sections complete.
ALL_COMPLETE = ProgressResponse(
    sections=[
        SectionStatus(key=k, label=k, status="complete",
                      subtitle="ok", route="/", blocking=True)
        for k in ["organisation", "modules", "coa", "dimensions", "employees",
                  "currencies", "tax", "roles", "workflows", "documents",
                  "module_setup", "golive"]
    ],
    total=12, completed=12, percentage=100,
)

results = []


def chk(label, ok, detail=""):
    s = "PASS" if ok else "FAIL"
    results.append((label, s, detail))
    print(f"  {s}  {label}  {detail}")


async def run():
    # ── DB setup: reset Red Bull to in_implementation ─────────────────────────
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")
    await conn.execute(
        "UPDATE tenants SET lifecycle_status=$1, is_active=$2 WHERE id=$3",
        "in_implementation", True, TID,
    )
    init = await conn.fetchrow(
        "SELECT lifecycle_status, is_active FROM tenants WHERE id=$1", TID
    )
    print(f"Reset: lifecycle_status={init['lifecycle_status']}  is_active={init['is_active']}")
    await conn.close()

    H_RB      = {"Authorization": f"Bearer {make_tok(TID)}", "Content-Type": "application/json"}
    H_TEST    = {"Authorization": f"Bearer {make_tok(TEST_TID)}", "Content-Type": "application/json"}
    H_SA_NONE = {"Authorization": f"Bearer {make_tok(None)}", "Content-Type": "application/json"}

    # ── A5: blocking sections correctly prevent go-live ───────────────────────
    print("\n--- A5: blocking sections gate ---")
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as c:
        r = await c.post("/api/setup/go-live", headers=H_TEST)
        chk("A5: empty tenant blocked (422)", r.status_code == 422,
            f"[{r.status_code}] {r.text[:80]}")

    conn_a5 = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")
    ts = await conn_a5.fetchrow(
        "SELECT lifecycle_status FROM tenants WHERE id=$1", TEST_TID
    )
    chk("A5: blocked lifecycle unchanged",
        ts["lifecycle_status"] == "in_implementation",
        f"lifecycle={ts['lifecycle_status']}")
    await conn_a5.close()

    # ── A1 + A2: go-live with mocked all-complete sections ────────────────────
    print("\n--- A1+A2: go-live sets is_active + lifecycle_status + audit log ---")
    with patch("app.routers.setup.get_progress", new=AsyncMock(return_value=ALL_COMPLETE)):
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
        ) as c:
            r = await c.post("/api/setup/go-live", headers=H_RB)
            chk("A1: go-live returns 200", r.status_code == 200,
                f"[{r.status_code}] {r.text[:100]}")

    conn_a1 = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/ziva_dev")
    after = await conn_a1.fetchrow(
        "SELECT lifecycle_status, is_active FROM tenants WHERE id=$1", TID
    )
    chk("A1: is_active=True", after["is_active"] is True,
        f"is_active={after['is_active']}")
    chk("A1: lifecycle_status=live", after["lifecycle_status"] == "live",
        f"lifecycle_status={after['lifecycle_status']}")

    audit = await conn_a1.fetchrow(
        """
        SELECT event_type, log_metadata FROM audit_logs
        WHERE tenant_id=$1
          AND event_type='platform.lifecycle.updated'
          AND log_metadata->>'via' = 'go_live'
        ORDER BY created_at DESC LIMIT 1
        """,
        TID,
    )
    if audit:
        raw_meta = audit["log_metadata"]
        import json as _json
        meta = _json.loads(raw_meta) if isinstance(raw_meta, str) else raw_meta
        chk("A2: audit entry present", True, f"meta={meta}")
        chk("A2: from=in_implementation", meta.get("from") == "in_implementation",
            f"from={meta.get('from')}")
        chk("A2: to=live", meta.get("to") == "live", f"to={meta.get('to')}")
        chk("A2: via=go_live", meta.get("via") == "go_live", f"via={meta.get('via')}")
    else:
        chk("A2: audit entry present", False, "not found")

    # ── A3: after go-live, enter_tenant → mode=support ────────────────────────
    print("\n--- A3: enter_tenant mode = support after go-live ---")
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as c:
        r = await c.post(
            f"/api/platform/tenants/{TID}/enter",
            headers=H_SA_NONE,
            content=json.dumps({"environment": "live"}),
        )
        chk("A3: enter_tenant 200", r.status_code == 200, f"[{r.status_code}]")
        if r.status_code == 200:
            body = r.json()
            chk("A3: mode=support", body.get("impersonation_mode") == "support",
                f"mode={body.get('impersonation_mode')}")
            chk("A3: environment=live", body.get("environment") == "live",
                f"env={body.get('environment')}")

    # ── A4: no test shadow → 404 with clear message (shadow path still works) ─
    print("\n--- A4: test shadow path still works ---")
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as c:
        r = await c.post(
            f"/api/platform/tenants/{TID}/enter",
            headers=H_SA_NONE,
            content=json.dumps({"environment": "test"}),
        )
        chk("A4: no shadow -> 404 (not a crash)", r.status_code == 404,
            f"[{r.status_code}] {r.text[:80]}")

    # ── Restore Red Bull ──────────────────────────────────────────────────────
    await conn_a1.execute(
        "UPDATE tenants SET lifecycle_status=$1 WHERE id=$2", "in_implementation", TID
    )
    restored = await conn_a1.fetchval(
        "SELECT lifecycle_status FROM tenants WHERE id=$1", TID
    )
    print(f"\nRestored: lifecycle_status={restored}")
    await conn_a1.close()


asyncio.run(run())

print("\n=== SUMMARY ===")
for label, s, detail in results:
    print(f"  {s}  {label}  {detail}")
print("\nALL PASS" if all(s == "PASS" for _, s, _ in results) else "\nSOME FAIL")
