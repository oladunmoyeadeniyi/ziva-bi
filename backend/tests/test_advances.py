"""
Employee advance lifecycle tests.

Covers the full workflow:
    POST /api/advances                              — request advance
    GET  /api/advances                              — list (employee sees own)
    GET  /api/advances/{id}                         — detail
    POST /api/advances/{id}/approve                 — finance approves
    POST /api/advances/{id}/issue                   — finance issues (disbursement)
    POST /api/advances/{id}/retirements             — employee starts retirement
    POST /api/advances/{id}/retirements/{r}/submit  — submit for review
    GET  /api/advances/retirements/{r}              — retirement detail

All tests are integration tests (require TEST_DATABASE_URL + seeded employee data).
The admin user is used as both the employee and the finance approver for simplicity
in a test environment.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import integration


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

async def _get_employee_id(client: AsyncClient, headers: dict) -> str | None:
    """Return the employee_id of the current user, or None if not an employee."""
    resp = await client.get("/api/profile/me", headers=headers)
    if resp.status_code != 200:
        return None
    return resp.json().get("employee_id")


async def _create_advance(client: AsyncClient, headers: dict, employee_id: str) -> str:
    """Create a PENDING advance and return its ID."""
    resp = await client.post("/api/advances", headers=headers, json={
        "employee_id": employee_id,
        "advance_type": "TRAVEL",
        "purpose": "Pytest business trip",
        "amount": "50000.00",
        "currency": "NGN",
        "request_date": "2026-08-01",
        "required_by_date": "2026-08-10",
        "due_retirement_date": "2026-08-31",
    })
    assert resp.status_code in (200, 201), f"Advance create failed: {resp.text}"
    return resp.json()["id"]


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #

@integration
async def test_advance_create_and_list(async_client: AsyncClient, admin_headers: dict):
    """Creating an advance returns PENDING status and it appears in the list."""
    employee_id = await _get_employee_id(async_client, admin_headers)
    if not employee_id:
        pytest.skip("Admin user is not linked to an employee record")

    advance_id = await _create_advance(async_client, admin_headers, employee_id)

    # Should appear in list
    resp = await async_client.get("/api/advances", headers=admin_headers)
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.json()]
    assert advance_id in ids

    # Status should be PENDING
    detail = await async_client.get(f"/api/advances/{advance_id}", headers=admin_headers)
    assert detail.status_code == 200
    assert detail.json()["status"] == "PENDING"


@integration
async def test_advance_approve_flow(async_client: AsyncClient, admin_headers: dict):
    """Finance (admin) can approve a PENDING advance."""
    employee_id = await _get_employee_id(async_client, admin_headers)
    if not employee_id:
        pytest.skip("Admin user is not linked to an employee record")

    advance_id = await _create_advance(async_client, admin_headers, employee_id)

    resp = await async_client.post(
        f"/api/advances/{advance_id}/approve", headers=admin_headers
    )
    assert resp.status_code in (200, 201), f"Approve failed: {resp.text}"
    detail = await async_client.get(f"/api/advances/{advance_id}", headers=admin_headers)
    assert detail.json()["status"] == "APPROVED"


@integration
async def test_advance_full_lifecycle(async_client: AsyncClient, admin_headers: dict):
    """
    Full advance lifecycle: request → approve → issue → retire (DRAFT) → submit.

    Posting to GL requires Full ERP mode; we accept APPROVED and POSTED both
    as valid terminal states for the issue step.
    """
    employee_id = await _get_employee_id(async_client, admin_headers)
    if not employee_id:
        pytest.skip("Admin user is not linked to an employee record")

    advance_id = await _create_advance(async_client, admin_headers, employee_id)

    # Approve
    await async_client.post(f"/api/advances/{advance_id}/approve", headers=admin_headers)

    # Issue
    issue_resp = await async_client.post(
        f"/api/advances/{advance_id}/issue",
        headers=admin_headers,
        json={"notes": "Disbursed via bank transfer"},
    )
    assert issue_resp.status_code in (200, 201), f"Issue failed: {issue_resp.text}"

    detail = await async_client.get(f"/api/advances/{advance_id}", headers=admin_headers)
    assert detail.json()["status"] == "ISSUED"

    # Start retirement
    ret_resp = await async_client.post(
        f"/api/advances/{advance_id}/retirements",
        headers=admin_headers,
        json={"retirement_date": "2026-08-25", "notes": "Returned from trip"},
    )
    assert ret_resp.status_code in (200, 201), f"Retirement create failed: {ret_resp.text}"
    ret_id = ret_resp.json()["id"]

    # Add a retirement line
    line_resp = await async_client.post(
        f"/api/advances/retirements/{ret_id}/lines",
        headers=admin_headers,
        json={
            "description": "Hotel expense",
            "amount": "30000.00",
            "currency": "NGN",
            "receipt_date": "2026-08-20",
        },
    )
    assert line_resp.status_code in (200, 201), f"Line add failed: {line_resp.text}"

    # Submit retirement
    sub_resp = await async_client.post(
        f"/api/advances/retirements/{ret_id}/submit",
        headers=admin_headers,
    )
    assert sub_resp.status_code in (200, 201), f"Submit retirement failed: {sub_resp.text}"

    ret_detail = await async_client.get(
        f"/api/advances/retirements/{ret_id}", headers=admin_headers
    )
    assert ret_detail.json()["status"] == "SUBMITTED"


@integration
async def test_advance_not_found(async_client: AsyncClient, admin_headers: dict):
    """Non-existent advance UUID returns 404."""
    import uuid
    resp = await async_client.get(f"/api/advances/{uuid.uuid4()}", headers=admin_headers)
    assert resp.status_code == 404
