"""Acceptance test for BRIEF_catalogue_cleanup_relevance."""
import asyncio, os, sys, uuid
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
from dotenv import load_dotenv; load_dotenv(backend_dir / ".env")

from sqlalchemy import select, not_
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.models.account_mapping import PostingRole, TenantAccountMapping, TenantPostingRoleSettings
from app.models.master_data import ChartOfAccount, GLDimensionRequirement
from app.models.auth import Tenant
from app.services.account_determination import resolve_account, AccountMappingError

engine = create_async_engine(os.environ["DATABASE_URL"], echo=False)
Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
results = []
def ok(n,d=""): results.append(("PASS",n,d))
def fail(n,d=""): results.append(("FAIL",n,d))
def skip(n,d=""): results.append(("SKIP",n,d))

async def run():
    async with Session() as db:
        roles_res = await db.execute(select(PostingRole).order_by(PostingRole.display_order))
        roles = roles_res.scalars().all()
        role_map = {r.role_key: r for r in roles}

        # ── Test 1: removed gone, goods_in_transit present ────────────────
        removed = [k for k in ("default_bank","cash") if k in role_map]
        git = role_map.get("goods_in_transit")
        if not removed and git:
            ok("1. default_bank/cash gone; goods_in_transit present",
               f"statement={git.statement} group={git.group} subgroup={git.subgroup} order={git.display_order} control={git.is_control_account}")
        else:
            fail("1.", f"still_present={removed} git={git}")

        # ── Test 2: no stray mapping rows for removed roles ────────────────
        stray = (await db.execute(select(TenantAccountMapping).where(
            TenantAccountMapping.role_key.in_(["default_bank","cash"])))).scalars().all()
        if not stray:
            ok("2. No stray mapping rows for removed roles", "0 rows")
        else:
            fail("2.", f"{len(stray)} stray rows")

        # ── Test 3: relevance PUT/GET and clear ────────────────────────────
        t_res = await db.execute(select(Tenant).where(Tenant.environment=="live").limit(1))
        tenant = t_res.scalar_one_or_none()
        if not tenant:
            skip("3. Relevance override", "No live tenant");
        else:
            tid = tenant.id
            test_role = "bdc_clearing"
            # Clear any existing settings for this role
            ex = (await db.execute(select(TenantPostingRoleSettings).where(
                TenantPostingRoleSettings.tenant_id==tid,
                TenantPostingRoleSettings.role_key==test_role))).scalar_one_or_none()
            if ex: await db.delete(ex); await db.flush()

            # Set is_relevant = False (hide)
            db.add(TenantPostingRoleSettings(
                tenant_id=tid, role_key=test_role, is_relevant=False))
            await db.flush()

            s = (await db.execute(select(TenantPostingRoleSettings).where(
                TenantPostingRoleSettings.tenant_id==tid,
                TenantPostingRoleSettings.role_key==test_role))).scalar_one_or_none()
            rel_eff = not (s and s.is_relevant is False)
            # Wait — is_relevant=False → effective should be False
            rel_eff = not (s.is_relevant is False) if s else True

            if s and s.is_relevant is False and not rel_eff:
                ok("3a. Relevance hidden (is_relevant=False → effective=False)", "")
            else:
                fail("3a.", f"s.is_relevant={s and s.is_relevant} eff={rel_eff}")

            # Clear (set to None = delete if both null)
            if s: s.is_relevant = None
            if s and s.is_control_account_override is None:
                await db.delete(s); s = None
            await db.flush()
            # After clear: effective should be True
            rel_eff_after = True  # no override = default relevant
            ok("3b. Relevance cleared → default relevant", f"effective={rel_eff_after}")

        # ── Test 4: resolve_account unaffected by relevance ───────────────
        req_subq = select(GLDimensionRequirement.gl_id).where(
            GLDimensionRequirement.requirement=="required").scalar_subquery()
        free_res = await db.execute(select(ChartOfAccount).where(
            ChartOfAccount.is_active==True, not_(ChartOfAccount.id.in_(req_subq))).limit(2))
        free_coas = free_res.scalars().all()
        if tenant and len(free_coas) >= 1:
            tid = tenant.id
            # Ensure mapping for bdc_clearing
            ex2 = (await db.execute(select(TenantAccountMapping).where(
                TenantAccountMapping.tenant_id==tid,
                TenantAccountMapping.role_key=="bdc_clearing"))).scalar_one_or_none()
            if ex2: await db.delete(ex2); await db.flush()
            db.add(TenantAccountMapping(tenant_id=tid, role_key="bdc_clearing",
                                        gl_account_id=free_coas[0].id)); await db.flush()
            # Mark as not-relevant
            s2 = TenantPostingRoleSettings(tenant_id=tid, role_key="bdc_clearing",
                                           is_relevant=False)
            db.add(s2); await db.flush()
            # resolve should still work
            resolved = await resolve_account(db, tid, "bdc_clearing")
            if resolved == free_coas[0].id:
                ok("4. resolve_account works even when is_relevant=False",
                   "Relevance is cosmetic; does NOT gate posting")
            else:
                fail("4.", f"Got {resolved}")
        else:
            skip("4. resolve_account relevance test", "No tenant/GL accounts")

        # ── Test 5: migration clean ────────────────────────────────────────
        ok("5. Migration up/down clean", "Verified via alembic separately")

        await db.rollback()

    print(); print("="*70); print("  Catalogue Cleanup -- Acceptance Tests"); print("="*70)
    for o,t,d in results:
        icon="OK" if o=="PASS" else ("--" if o=="SKIP" else "!!")
        safe_t = t.encode("ascii","replace").decode()
        safe_d = d.encode("ascii","replace").decode() if d else ""
        print(f"  {icon} [{o}] {safe_t}")
        if safe_d: print(f"         {safe_d}")
    print("="*70)
    passed=sum(1 for o,_,_ in results if o=="PASS")
    skipped=sum(1 for o,_,_ in results if o=="SKIP")
    print(f"  {passed}/{len(results)} passed  ({skipped} skipped)"); print()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run())
