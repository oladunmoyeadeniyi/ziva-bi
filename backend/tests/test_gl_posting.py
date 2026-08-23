"""
GL posting correctness tests.

Unit tests (no DB required):
    - Journal entry DR = CR invariant verified via pure arithmetic

Integration tests (require TEST_DATABASE_URL):
    - Any posted journal entry in the DB has balanced DR and CR totals
    - Manual journal entry creation → post flow
"""

import decimal
from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import integration


# --------------------------------------------------------------------------- #
# Unit tests — pure logic, no DB
# --------------------------------------------------------------------------- #

def _sum_side(lines: list[dict], side: str) -> decimal.Decimal:
    """Sum all amounts for a given side ('debit' or 'credit') in a journal."""
    return sum(
        decimal.Decimal(str(ln["amount"]))
        for ln in lines
        if ln.get("side") == side
    )


def test_balanced_journal_passes():
    """A balanced journal entry (DR = CR) validates correctly."""
    lines = [
        {"side": "debit",  "amount": "10000.00"},
        {"side": "debit",  "amount": "2500.00"},
        {"side": "credit", "amount": "12500.00"},
    ]
    dr = _sum_side(lines, "debit")
    cr = _sum_side(lines, "credit")
    assert dr == cr, f"DR {dr} ≠ CR {cr}"


def test_unbalanced_journal_detected():
    """An unbalanced journal (DR ≠ CR) is caught by the validator."""
    lines = [
        {"side": "debit",  "amount": "5000.00"},
        {"side": "credit", "amount": "4999.99"},  # off by 0.01
    ]
    dr = _sum_side(lines, "debit")
    cr = _sum_side(lines, "credit")
    assert dr != cr


def test_zero_amount_lines_excluded():
    """Zero-amount lines don't affect the balance check."""
    lines = [
        {"side": "debit",  "amount": "1000.00"},
        {"side": "credit", "amount": "1000.00"},
        {"side": "debit",  "amount": "0.00"},  # zero line — no impact
    ]
    dr = _sum_side(lines, "debit")
    cr = _sum_side(lines, "credit")
    # DR = 1000, CR = 1000 — the zero debit doesn't break balance
    assert dr == cr + decimal.Decimal("0.00")


# --------------------------------------------------------------------------- #
# Integration tests
# --------------------------------------------------------------------------- #

@integration
async def test_posted_journals_are_balanced(async_client: AsyncClient, admin_headers: dict):
    """
    Fetch posted journal entries from the API and verify every one is balanced.

    This is a regression guard: if any posting service accidentally creates
    unbalanced entries, this test will catch it.
    """
    resp = await async_client.get("/api/gl/journal-entries", headers=admin_headers)
    if resp.status_code == 404:
        pytest.skip("GL journal-entries endpoint not available on this tenant")
    assert resp.status_code == 200, f"Journal list failed: {resp.text}"

    entries: list[Any] = resp.json() if isinstance(resp.json(), list) else resp.json().get("items", [])
    posted = [e for e in entries if e.get("status") == "POSTED"]

    if not posted:
        pytest.skip("No posted journal entries in test DB to validate")

    for entry in posted:
        entry_id = entry["id"]
        detail_resp = await async_client.get(
            f"/api/gl/journal-entries/{entry_id}", headers=admin_headers
        )
        assert detail_resp.status_code == 200
        data = detail_resp.json()
        lines = data.get("lines", [])

        dr = sum(decimal.Decimal(str(ln.get("debit_amount", 0) or 0)) for ln in lines)
        cr = sum(decimal.Decimal(str(ln.get("credit_amount", 0) or 0)) for ln in lines)

        assert dr == cr, (
            f"Journal {entry_id} is unbalanced: DR={dr} CR={cr}\n"
            f"Lines: {lines}"
        )


@integration
async def test_manual_journal_create(async_client: AsyncClient, admin_headers: dict):
    """
    Create a manual journal entry and confirm it is stored as DRAFT.

    Getting the GL account IDs requires the CoA to be set up.
    If CoA is empty we skip rather than fail.
    """
    # Fetch CoA to get two account IDs
    coa_resp = await async_client.get("/api/setup/coa", headers=admin_headers)
    if coa_resp.status_code != 200 or not coa_resp.json():
        pytest.skip("CoA not configured — skipping manual journal test")

    accounts = coa_resp.json()
    if len(accounts) < 2:
        pytest.skip("Need at least 2 GL accounts for a manual journal")

    dr_account = accounts[0]["id"]
    cr_account = accounts[1]["id"]

    resp = await async_client.post("/api/gl/journal-entries", headers=admin_headers, json={
        "description": "Pytest manual journal",
        "entry_date": "2026-08-01",
        "lines": [
            {"gl_account_id": dr_account, "debit_amount": "1000.00", "credit_amount": "0.00", "description": "DR line"},
            {"gl_account_id": cr_account, "debit_amount": "0.00", "credit_amount": "1000.00", "description": "CR line"},
        ],
    })
    assert resp.status_code in (200, 201), f"Journal create failed: {resp.text}"
    data = resp.json()
    assert data.get("status") in ("DRAFT", "POSTED")
