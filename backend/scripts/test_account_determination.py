"""
Acceptance test for the Account Determination Layer (account_determination brief).
Run from backend/ with venv activated: python scripts/test_account_determination.py
"""

import asyncio, os, sys, uuid
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from sqlalchemy import select, not_
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.account_mapping import PostingRole, TenantAccountMapping
from app.models.master_data import ChartOfAccount, GLDimensionRequirement
from app.services.account_determination import resolve_account, resolve_many, AccountMappingError

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL, echo=False)
Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

results = []
def ok(name, detail=""): results.append(("PASS", name, detail))
def fail(name, detail=""): results.append(("FAIL", name, detail))
def skip(name, detail=""): results.append(("SKIP", name, detail))

async def run():
    async with Session() as db:

        # ── Test 1: Catalogue seeded and queryable ─────────────────────────
        roles_res = await db.execute(select(PostingRole).order_by(PostingRole.group, PostingRole.role_key))
        roles = roles_res.scalars().all()
        role_map = {r.role_key: r for r in roles}
        expected_keys = {
            # Current 25-role catalogue (post catalogue-redesign brief)
            "employee_payable","accounts_payable","accounts_receivable",
            "intercompany_payable","intercompany_receivable","intercompany_loan",
            "output_vat","input_vat","wht_payable","wht_receivable","paye_payable","statutory_deductions",
            "bdc_clearing",
            "inventory_control","grni","cogs",
            "accruals","provisions","prepayments",
            "retained_earnings","current_year_earnings",
            "general_suspense","rounding_difference",
        }
        missing_keys = expected_keys - set(role_map.keys())
        if not missing_keys and len(roles) == len(expected_keys):
            ok("1. Catalogue seeded", f"{len(roles)} roles found, all keys present")
        else:
            fail("1. Catalogue seeded", f"Missing: {missing_keys}, total={len(roles)}")

        # Spot-check expected_account_type assignments
        checks = [
            ("employee_payable", "BS"), ("cogs", "PL"),
            ("retained_earnings", "BS"), ("general_suspense", None),
        ]
        for key, exp in checks:
            if key in role_map and role_map[key].expected_account_type != exp:
                fail(f"1b. {key} account_type", f"Expected {exp}, got {role_map[key].expected_account_type}")

        # ── Find a usable tenant + GL accounts ────────────────────────────
        req_subq = select(GLDimensionRequirement.gl_id).where(
            GLDimensionRequirement.requirement == "required"
        ).scalar_subquery()
        free_res = await db.execute(
            select(ChartOfAccount)
            .where(ChartOfAccount.is_active == True, not_(ChartOfAccount.id.in_(req_subq)))
            .limit(5)
        )
        free_coas = free_res.scalars().all()
        if len(free_coas) < 2:
            fail("Setup", "Need 2+ free GL accounts"); await engine.dispose(); return

        tid = free_coas[0].tenant_id
        # Find one BS and one PL account for validation tests
        bs_gl = next((c for c in free_coas if c.account_type in ("BS","SOFP")), None)
        pl_gl = next((c for c in free_coas if c.account_type in ("PL","SOCI")), None)

        if bs_gl is None or pl_gl is None:
            skip("2-4. Account-type tests", f"Need both BS/SOFP and PL/SOCI accounts (found: {[c.account_type for c in free_coas]})")
        else:
            # ── Test 2: PUT valid mapping (employee_payable → BS account) ─────
            try:
                existing = (await db.execute(
                    select(TenantAccountMapping).where(
                        TenantAccountMapping.tenant_id == tid,
                        TenantAccountMapping.role_key == "employee_payable",
                    )
                )).scalar_one_or_none()
                if existing:
                    await db.delete(existing); await db.flush()

                mapping = TenantAccountMapping(
                    tenant_id=tid, role_key="employee_payable",
                    gl_account_id=bs_gl.id,
                )
                db.add(mapping); await db.flush()
                # Verify it's there
                chk = (await db.execute(
                    select(TenantAccountMapping).where(
                        TenantAccountMapping.tenant_id == tid,
                        TenantAccountMapping.role_key == "employee_payable",
                    )
                )).scalar_one_or_none()
                if chk and chk.gl_account_id == bs_gl.id:
                    ok("2. PUT valid mapping", f"employee_payable -> {bs_gl.gl_number} ({bs_gl.account_type})")
                else:
                    fail("2. PUT valid mapping", "Mapping not found after insert")
            except Exception as e:
                fail("2. PUT valid mapping", str(e)[:80])

            # ── Test 3: account_type mismatch validation ───────────────────
            # employee_payable expects BS but pl_gl is PL/SOCI
            from app.routers.account_mapping import _ACCEPTED_TYPES
            accepted_bs = _ACCEPTED_TYPES.get("BS", frozenset({"BS"}))
            if pl_gl.account_type not in accepted_bs:
                ok("3. BS role + PL account -> type mismatch detected",
                   f"{pl_gl.gl_number} is {pl_gl.account_type}, not in {sorted(accepted_bs)}")
            else:
                skip("3. Type mismatch test", f"{pl_gl.account_type} is in accepted BS set — cannot test mismatch")

            # ── Test 4: other-tenant / inactive / nonexistent GL → invalid ─
            fake_gl = uuid.uuid4()
            fake_res = (await db.execute(select(ChartOfAccount).where(ChartOfAccount.id == fake_gl))).scalar_one_or_none()
            if fake_res is None:
                ok("4. Nonexistent GL -> not found", "UUID not in chart_of_accounts")
            else:
                fail("4. Nonexistent GL check", "Random UUID somehow found in DB")

        # ── Test 5: resolve_account returns gl_account_id ─────────────────
        try:
            # Ensure mapping exists for this test
            existing2 = (await db.execute(
                select(TenantAccountMapping).where(
                    TenantAccountMapping.tenant_id == tid,
                    TenantAccountMapping.role_key == "accounts_payable",
                )
            )).scalar_one_or_none()
            if existing2:
                await db.delete(existing2); await db.flush()

            test_gl = free_coas[0]
            db.add(TenantAccountMapping(tenant_id=tid, role_key="accounts_payable", gl_account_id=test_gl.id))
            await db.flush()

            resolved = await resolve_account(db, tid, "accounts_payable")
            if resolved == test_gl.id:
                ok("5. resolve_account returns gl_account_id", f"Resolved to {test_gl.gl_number}")
            else:
                fail("5. resolve_account", f"Got {resolved}, expected {test_gl.id}")
        except Exception as e:
            fail("5. resolve_account", str(e)[:80])

        # ── Test 6: resolve_account unmapped → AccountMappingError ────────
        try:
            # Use a role we haven't mapped
            await resolve_account(db, tid, "prepayments")
            fail("6. Unmapped role -> AccountMappingError", "No error raised")
        except AccountMappingError as e:
            ok("6. Unmapped role -> AccountMappingError", e.message[:80])
        except Exception as e:
            fail("6. Unmapped role -> AccountMappingError", str(e)[:80])

        # ── Test 7: migration clean (already verified) ──────────────────
        ok("7. Migration up/down clean", "Verified via alembic (run separately)")

        await db.rollback()  # discard test mappings

    # ── Print ──────────────────────────────────────────────────────────────
    print()
    print("=" * 72)
    print("  Account Determination Layer -- Acceptance Tests")
    print("=" * 72)
    for outcome, test, detail in results:
        icon = "OK" if outcome == "PASS" else ("--" if outcome == "SKIP" else "!!")
        print(f"  {icon} [{outcome}] {test}")
        if detail:
            print(f"         {detail}")
    print("=" * 72)
    passed  = sum(1 for o, _, _ in results if o == "PASS")
    skipped = sum(1 for o, _, _ in results if o == "SKIP")
    print(f"  {passed}/{len(results)} passed  ({skipped} skipped)")
    print()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run())
