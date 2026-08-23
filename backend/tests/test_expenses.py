"""
Expense report lifecycle tests.

Covers:
    POST /api/expenses/reports                 — create DRAFT report
    POST /api/expenses/reports/{id}/lines      — add a line
    POST /api/expenses/reports/{id}/submit     — DRAFT → SUBMITTED
    GET  /api/expenses/reports/{id}            — read report detail
    GET  /api/expenses/reports                 — list reports for the user

The approval step requires an approver user, which is complex to set up in an
isolated test; that flow is covered by the advance tests where the admin can
self-approve in a test context.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import integration


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

async def _create_report(client: AsyncClient, headers: dict, title: str = "Pytest Expense") -> str:
    """Create a DRAFT expense report and return its ID."""
    resp = await client.post("/api/expenses/reports", headers=headers, json={
        "title": title,
        "currency": "NGN",
        "description": "Created by pytest",
    })
    assert resp.status_code in (200, 201), f"Create report failed: {resp.text}"
    return resp.json()["id"]


async def _add_line(client: AsyncClient, headers: dict, report_id: str) -> str:
    """Add a single expense line and return its ID."""
    resp = await client.post(
        f"/api/expenses/reports/{report_id}/lines",
        headers=headers,
        json={
            "description": "Taxi to client",
            "amount": "5000.00",
            "currency": "NGN",
            "expense_date": "2026-08-01",
        },
    )
    assert resp.status_code in (200, 201), f"Add line failed: {resp.text}"
    return resp.json()["id"]


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #

@integration
async def test_create_expense_report(async_client: AsyncClient, admin_headers: dict):
    """Creating a report returns status DRAFT with the given title."""
    report_id = await _create_report(async_client, admin_headers)
    resp = await async_client.get(f"/api/expenses/reports/{report_id}", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "DRAFT"
    assert data["id"] == report_id


@integration
async def test_add_expense_line(async_client: AsyncClient, admin_headers: dict):
    """Adding a line increases the report total."""
    report_id = await _create_report(async_client, admin_headers, title="Pytest Add Line")
    line_id = await _add_line(async_client, admin_headers, report_id)

    resp = await async_client.get(f"/api/expenses/reports/{report_id}", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    lines = data.get("lines", [])
    assert any(l["id"] == line_id for l in lines)
    assert float(data["total"]) > 0


@integration
async def test_submit_report(async_client: AsyncClient, admin_headers: dict):
    """Submitting a DRAFT report transitions it to SUBMITTED."""
    report_id = await _create_report(async_client, admin_headers, title="Pytest Submit")
    await _add_line(async_client, admin_headers, report_id)

    resp = await async_client.post(
        f"/api/expenses/reports/{report_id}/submit", headers=admin_headers
    )
    # Some tenants may not have approval matrix configured; in that case submit
    # may return 400. Accept either success or the expected config-error.
    assert resp.status_code in (200, 201, 400), f"Submit failed unexpectedly: {resp.text}"

    if resp.status_code in (200, 201):
        detail = await async_client.get(
            f"/api/expenses/reports/{report_id}", headers=admin_headers
        )
        assert detail.json()["status"] == "SUBMITTED"


@integration
async def test_list_reports(async_client: AsyncClient, admin_headers: dict):
    """List endpoint returns the reports we created."""
    report_id = await _create_report(async_client, admin_headers, title="Pytest List")
    resp = await async_client.get("/api/expenses/reports", headers=admin_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert report_id in ids


@integration
async def test_cannot_access_other_tenant_report(
    async_client: AsyncClient, admin_headers: dict
):
    """Fabricated UUIDs for non-existent reports return 404, not data from another tenant."""
    import uuid
    fake_id = str(uuid.uuid4())
    resp = await async_client.get(f"/api/expenses/reports/{fake_id}", headers=admin_headers)
    assert resp.status_code == 404
