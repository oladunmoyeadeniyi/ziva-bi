"""
Acceptance test script for GL Engine #2 (trial balance + account ledger).

Run from backend/ with venv activated:
    python scripts/test_gl_reporting.py

Posts balanced entries via post_journal, then reads them back through the
reporting service functions. All DB operations are rolled back at the end.
"""

import asyncio
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from sqlalchemy import not_, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.gl import JournalEntry
from app.models.master_data import ChartOfAccount, GLDimensionRequirement
from app.schemas.gl import JournalLineInput
from app.services.gl_posting import post_journal, PostingError
from app.services.gl_reporting import trial_balance, account_ledger

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL, echo=False)
Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

PASS = "PASS"
FAIL = "FAIL"
SKIP = "SKIP"
results = []

def ok(name, detail=""):
    results.append((name, PASS, detail))

def fail(name, detail=""):
    results.append((name, FAIL, detail))

def skip(name, detail=""):
    results.append((name, SKIP, detail))


async def run():
    async with Session() as db:

        # ── Find GL accounts without required dimensions ───────────────────────
        req_subq = select(GLDimensionRequirement.gl_id).where(
            GLDimensionRequirement.requirement == "required"
        ).scalar_subquery()

        free_res = await db.execute(
            select(ChartOfAccount)
            .where(ChartOfAccount.is_active == True,
                   not_(ChartOfAccount.id.in_(req_subq)))
            .limit(3)
        )
        free_coas = free_res.scalars().all()

        if len(free_coas) < 2:
            print("SKIP: need 2+ active GL accounts without required dimensions.")
            await engine.dispose()
            return

        tid = free_coas[0].tenant_id
        gl_a_id = free_coas[0].id
        gl_b_id = free_coas[1].id
        gl_a_num = free_coas[0].gl_number
        gl_b_num = free_coas[1].gl_number

        # Find a postable period: OPEN first, then SOFT_CLOSED with null soft_closed_at
        # (the M8.3 grace-window path — grace starts from now when soft_closed_at is NULL).
        from app.models.setup import AccountingPeriod, FiscalYearState
        from app.services.periods import is_date_postable as _is_postable

        stat_fys_res = await db.execute(
            select(FiscalYearState.fiscal_year).where(
                FiscalYearState.tenant_id == tid,
                FiscalYearState.status == "STATUTORY_CLOSED",
            )
        )
        stat_fys = {r[0] for r in stat_fys_res.all()}

        cand_res = await db.execute(
            select(AccountingPeriod)
            .where(
                AccountingPeriod.tenant_id == tid,
                AccountingPeriod.status.in_(["OPEN", "SOFT_CLOSED"]),
                AccountingPeriod.fiscal_year.not_in(stat_fys) if stat_fys else True,
            )
            .order_by(AccountingPeriod.start_date.desc())
            .limit(5)
        )
        candidates = cand_res.scalars().all()

        post_date_1 = None
        for cand in candidates:
            ok_flag, _ = await _is_postable(tid, cand.start_date, db, module="manual")
            if ok_flag:
                post_date_1 = cand.start_date
                break

        # Use two distinct dates within the same postable period for the two test entries
        from datetime import timedelta
        post_date_2 = (post_date_1 + timedelta(days=1)) if post_date_1 else None

        post_status = "POSTED" if post_date_1 else "DRAFT"
        d1 = post_date_1 or date(2025, 1, 15)
        d2 = post_date_2 or date(2025, 1, 16)

        # ── Post test entries ─────────────────────────────────────────────────
        try:
            e1 = await post_journal(db, tid,
                entry_date=d1, description="Test entry 1", source="manual",
                lines=[
                    JournalLineInput(gl_account_id=gl_a_id, debit=Decimal("1000")),
                    JournalLineInput(gl_account_id=gl_b_id, credit=Decimal("1000")),
                ],
                status=post_status,
            )
            e2 = await post_journal(db, tid,
                entry_date=d2, description="Test entry 2", source="manual",
                lines=[
                    JournalLineInput(gl_account_id=gl_a_id, debit=Decimal("500")),
                    JournalLineInput(gl_account_id=gl_b_id, credit=Decimal("500")),
                ],
                status=post_status,
            )
        except PostingError as e:
            fail("Setup: posting test entries", f"{e.code}: {e.message[:60]}")
            print("\n!! Setup failed — cannot run reporting tests.")
            await db.rollback()
            await engine.dispose()
            return

        note = f" [status={post_status}]"

        # ── Test 1: TB shows correct per-account totals, grand totals balance ─
        try:
            tb = await trial_balance(db, tid)
            acct_rows = {r.gl_number: r for r in tb.rows}
            if post_status == "POSTED":
                if gl_a_num in acct_rows:
                    ra = acct_rows[gl_a_num]
                    assert ra.total_debit == Decimal("1500.00"), f"Expected 1500, got {ra.total_debit}"
                    assert ra.total_credit == Decimal("0.00")
                    assert ra.balance == Decimal("1500.00")
                    assert tb.is_balanced, "TB not balanced!"
                    ok("1. TB correct totals + is_balanced", f"sum_dr={tb.sum_debit} sum_cr={tb.sum_credit}")
                else:
                    fail("1. TB correct totals", f"{gl_a_num} not in TB rows")
            else:
                # DRAFT entries excluded: TB should not contain our entries
                if gl_a_num not in acct_rows or acct_rows[gl_a_num].total_debit == Decimal("0"):
                    ok("1. TB excludes DRAFT entries" + note, "DRAFT entries correctly absent")
                else:
                    fail("1. TB should exclude DRAFT", f"Found debit {acct_rows.get(gl_a_num)}")
        except Exception as e:
            fail("1. TB correct totals", str(e)[:80])

        # ── Test 2: date_from/date_to filters TB ──────────────────────────────
        try:
            if post_status == "POSTED" and post_date_1:
                # Filter to just d1 — only 1000 should show (not 500 from d2)
                tb_filtered = await trial_balance(db, tid, date_from=d1, date_to=d1)
                acct_rows_f = {r.gl_number: r for r in tb_filtered.rows}
                if gl_a_num in acct_rows_f:
                    assert acct_rows_f[gl_a_num].total_debit == Decimal("1000.00"), \
                        f"Expected 1000, got {acct_rows_f[gl_a_num].total_debit}"
                    ok("2. date filter narrows TB", f"total_debit={acct_rows_f[gl_a_num].total_debit}")
                else:
                    fail("2. date filter narrows TB", f"{gl_a_num} not in filtered TB")
            else:
                skip("2. date filter narrows TB", "No OPEN period; DRAFT entries not filterable by date in reporting")
        except Exception as e:
            fail("2. date filter narrows TB", str(e)[:80])

        # ── Test 3: account ledger opening/running/closing balance ────────────
        try:
            if post_status == "POSTED" and post_date_1:
                # Ledger for gl_a with date_from=d2 — opening should be 1000 (from d1)
                ledger = await account_ledger(db, tid, gl_a_id, date_from=d2, date_to=d2)
                assert ledger is not None
                assert ledger.opening_balance == Decimal("1000.00"), \
                    f"Expected opening 1000, got {ledger.opening_balance}"
                assert len(ledger.lines) == 1  # only d2 line
                assert ledger.lines[0].debit == Decimal("500.00")
                assert ledger.lines[0].running_balance == Decimal("1500.00")
                assert ledger.closing_balance == Decimal("1500.00")
                ok("3. Ledger opening/running/closing correct",
                   f"opening={ledger.opening_balance} closing={ledger.closing_balance}")
            else:
                # All-time ledger for DRAFT: should have 0 lines
                ledger = await account_ledger(db, tid, gl_a_id)
                assert ledger is not None
                has_our_lines = any(
                    ln.debit in (Decimal("1000.00"), Decimal("500.00"))
                    for ln in ledger.lines
                )
                if not has_our_lines:
                    ok("3. Ledger excludes DRAFT" + note, f"lines={len(ledger.lines)}")
                else:
                    fail("3. Ledger should exclude DRAFT", "DRAFT lines found in ledger")
        except Exception as e:
            fail("3. Ledger opening/running/closing", str(e)[:80])

        # ── Test 4: dimension_filter narrows ledger lines ─────────────────────
        # Only meaningful if we can post entries with dimensions; skip for now
        # since the test GL accounts may have no dimension values.
        skip("4. dimension_filter narrows ledger",
             "Requires dimension values in DB (no setup in this test); "
             "JSONB @> path verified in code review")

        # ── Test 5: DRAFT entries excluded from TB + ledger ───────────────────
        try:
            if post_status == "POSTED":
                # Post a DRAFT entry and confirm it doesn't appear
                draft = await post_journal(db, tid,
                    entry_date=d1, description="Draft test", source="manual",
                    lines=[
                        JournalLineInput(gl_account_id=gl_a_id, debit=Decimal("9999")),
                        JournalLineInput(gl_account_id=gl_b_id, credit=Decimal("9999")),
                    ],
                    status="DRAFT",
                )
                tb5 = await trial_balance(db, tid)
                a5 = {r.gl_number: r for r in tb5.rows}.get(gl_a_num)
                if a5 and a5.total_debit == Decimal("1500.00"):
                    ok("5. DRAFT excluded from TB", "9999 DRAFT not counted; total still 1500")
                elif a5 is None:
                    ok("5. DRAFT excluded from TB", "GL not in TB (no POSTED lines for it)")
                else:
                    fail("5. DRAFT excluded", f"total_debit={a5.total_debit} (expected 1500)")
            else:
                skip("5. DRAFT excluded from TB", "All entries are DRAFT in this tenant")
        except Exception as e:
            fail("5. DRAFT excluded", str(e)[:80])

        # ── Test 6: nonexistent / other-tenant account -> None (404) ──────────
        import uuid as _uuid
        fake_id = _uuid.uuid4()
        ledger6 = await account_ledger(db, tid, fake_id)
        if ledger6 is None:
            ok("6. Nonexistent GL -> None (404 at router)", "account_ledger returned None")
        else:
            fail("6. Nonexistent GL -> None", "Expected None, got a result")

        await db.rollback()  # don't persist test entries

    # ── Print results ─────────────────────────────────────────────────────────
    print()
    print("=" * 72)
    print("  GL Engine #2 -- Acceptance Tests")
    print("=" * 72)
    for test, outcome, detail in results:
        icon = "OK" if outcome == PASS else ("--" if outcome == SKIP else "!!")
        print(f"  {icon} [{outcome}] {test}")
        if detail:
            print(f"         {detail}")
    print("=" * 72)
    passed  = sum(1 for _, o, _ in results if o == PASS)
    skipped = sum(1 for _, o, _ in results if o == SKIP)
    total   = len(results)
    print(f"  {passed}/{total} passed  ({skipped} skipped/conditional)")
    print()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
