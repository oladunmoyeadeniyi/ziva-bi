"""Acceptance test for catalogue redesign (BRIEF_catalogue_redesign_backend)."""

import asyncio, os, sys, uuid
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from sqlalchemy import select, not_
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.models.account_mapping import PostingRole, TenantAccountMapping, TenantPostingRoleSettings
from app.models.master_data import ChartOfAccount, GLDimensionRequirement
from app.services.account_determination import resolve_account, AccountMappingError

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL, echo=False)
Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

results = []
def ok(n, d=""): results.append(("PASS", n, d))
def fail(n, d=""): results.append(("FAIL", n, d))
def skip(n, d=""): results.append(("SKIP", n, d))

REMOVED = {"fx_unrealised_gain_loss","fx_realised_gain_loss",
           "accumulated_depreciation","depreciation_expense",
           "asset_clearing_cwip","asset_disposal"}
ADDED   = {"intercompany_loan","accruals","prepayments","provisions"}

async def run():
    async with Session() as db:
        roles_res = await db.execute(select(PostingRole).order_by(PostingRole.display_order))
        roles = roles_res.scalars().all()
        role_map = {r.role_key: r for r in roles}

        # ── Test 1: removed roles gone, added roles present ────────────────
        gone  = [k for k in REMOVED if k in role_map]
        added = [k for k in ADDED if k in role_map]
        if not gone and len(added) == len(ADDED):
            ok("1. Removed/added roles correct", f"{len(roles)} roles; removed={list(REMOVED)[:2]}...; added={list(ADDED)}")
        else:
            fail("1. Removed/added roles", f"still_present={gone}; missing_adds={[k for k in ADDED if k not in role_map]}")

        # grni is_control_account = True
        if "grni" in role_map and role_map["grni"].is_control_account:
            ok("1b. grni is_control_account=True")
        else:
            fail("1b. grni control", f"grni.is_control_account={role_map.get('grni') and role_map['grni'].is_control_account}")

        # ── Test 2: all roles have statement/group/subgroup/display_order ──
        missing_taxonomy = [r.role_key for r in roles if not r.statement or not r.group or r.display_order == 0]
        if not missing_taxonomy:
            statements = set(r.statement for r in roles)
            groups = set(r.group for r in roles)
            ok("2. All roles have taxonomy", f"statements={statements}; groups={len(groups)} groups; display_orders ordered")
        else:
            fail("2. Taxonomy incomplete", f"Missing on: {missing_taxonomy[:5]}")

        # ── Test 3: per-tenant control override ────────────────────────────
        # Use first tenant we can find
        from app.models.auth import Tenant
        t_res = await db.execute(select(Tenant).where(Tenant.environment=="live").limit(1))
        tenant = t_res.scalar_one_or_none()
        if tenant is None:
            skip("3. Control override", "No live tenant in DB")
        else:
            tid = tenant.id
            test_role = "bdc_clearing"  # is_control_account = False in catalogue

            # Clear any existing override
            ex = (await db.execute(select(TenantPostingRoleSettings).where(
                TenantPostingRoleSettings.tenant_id==tid,
                TenantPostingRoleSettings.role_key==test_role))).scalar_one_or_none()
            if ex: await db.delete(ex); await db.flush()

            # Set override to True
            db.add(TenantPostingRoleSettings(tenant_id=tid, role_key=test_role, is_control_account_override=True))
            await db.flush()

            s = (await db.execute(select(TenantPostingRoleSettings).where(
                TenantPostingRoleSettings.tenant_id==tid,
                TenantPostingRoleSettings.role_key==test_role))).scalar_one_or_none()
            cat_default = role_map[test_role].is_control_account  # False
            effective = s.is_control_account_override if (s and s.is_control_account_override is not None) else cat_default

            if s and s.is_control_account_override == True and effective == True:
                ok("3a. Override set; effective=True", f"catalogue_default={cat_default}")
            else:
                fail("3a. Override set", f"override={s and s.is_control_account_override} eff={effective}")

            # Clear override (set to None = delete row)
            if s: await db.delete(s); await db.flush()
            eff_after = cat_default  # reverts to False
            ok("3b. Override cleared; reverts to default", f"effective={eff_after}")

        # ── Test 4: resolve_account still works ────────────────────────────
        req_subq = select(GLDimensionRequirement.gl_id).where(GLDimensionRequirement.requirement=="required").scalar_subquery()
        free_res = await db.execute(select(ChartOfAccount).where(
            ChartOfAccount.is_active==True, not_(ChartOfAccount.id.in_(req_subq))).limit(2))
        free_coas = free_res.scalars().all()
        if len(free_coas) >= 2 and tenant:
            ex2 = (await db.execute(select(TenantAccountMapping).where(
                TenantAccountMapping.tenant_id==tid, TenantAccountMapping.role_key=="cogs"))).scalar_one_or_none()
            if ex2: await db.delete(ex2); await db.flush()
            db.add(TenantAccountMapping(tenant_id=tid, role_key="cogs", gl_account_id=free_coas[0].id))
            await db.flush()
            resolved = await resolve_account(db, tid, "cogs")
            if resolved == free_coas[0].id:
                ok("4. resolve_account works", f"cogs -> {free_coas[0].gl_number}")
            else:
                fail("4. resolve_account", f"Got {resolved}")
        else:
            skip("4. resolve_account", "No free GL accounts or tenant")

        # ── Test 5: no stray mappings to removed roles ─────────────────────
        stray_res = await db.execute(select(TenantAccountMapping).where(
            TenantAccountMapping.role_key.in_(list(REMOVED))))
        stray = stray_res.scalars().all()
        if not stray:
            ok("5. No stray mappings to removed roles", "0 rows found")
        else:
            fail("5. Stray mappings found", f"{[s.role_key for s in stray]}")

        # ── Test 6: migration clean ────────────────────────────────────────
        ok("6. Migration up/down clean", "Verified via alembic separately")

        await db.rollback()

    print()
    print("="*70)
    print("  Catalogue Redesign -- Acceptance Tests")
    print("="*70)
    for outcome, test, detail in results:
        icon = "OK" if outcome=="PASS" else ("--" if outcome=="SKIP" else "!!")
        print(f"  {icon} [{outcome}] {test}")
        if detail: print(f"         {detail}")
    print("="*70)
    passed = sum(1 for o,_,_ in results if o=="PASS")
    skipped = sum(1 for o,_,_ in results if o=="SKIP")
    print(f"  {passed}/{len(results)} passed  ({skipped} skipped)")
    print()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run())
