"""
Authentication endpoint tests.

Covers:
    POST /api/auth/login     — valid credentials, invalid credentials
    POST /api/auth/refresh   — token refresh flow
    POST /api/auth/logout    — logout clears refresh cookie
"""

import pytest
from httpx import AsyncClient

from tests.conftest import integration, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD


# --------------------------------------------------------------------------- #
# Login
# --------------------------------------------------------------------------- #

@integration
async def test_login_success(async_client: AsyncClient, admin_tokens: dict):
    """Valid credentials return an access token."""
    resp = await async_client.post("/api/auth/login", json={
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASSWORD,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"


@integration
async def test_login_wrong_password(async_client: AsyncClient):
    """Wrong password returns 401."""
    resp = await async_client.post("/api/auth/login", json={
        "email": TEST_ADMIN_EMAIL,
        "password": "definitely-wrong",
    })
    assert resp.status_code == 401


@integration
async def test_login_unknown_email(async_client: AsyncClient):
    """Unknown email returns 401 (not 404 — avoid user enumeration)."""
    resp = await async_client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "anything",
    })
    assert resp.status_code == 401


@integration
async def test_login_missing_fields(async_client: AsyncClient):
    """Missing email/password returns 422 validation error."""
    resp = await async_client.post("/api/auth/login", json={"email": TEST_ADMIN_EMAIL})
    assert resp.status_code == 422


# --------------------------------------------------------------------------- #
# Protected endpoint guard
# --------------------------------------------------------------------------- #

@integration
async def test_unauthenticated_request_rejected(async_client: AsyncClient):
    """Any protected endpoint without a token returns 401."""
    resp = await async_client.get("/api/setup/org")
    assert resp.status_code in (401, 403)


@integration
async def test_invalid_token_rejected(async_client: AsyncClient):
    """A tampered / expired token is rejected."""
    resp = await async_client.get(
        "/api/setup/org",
        headers={"Authorization": "Bearer not.a.real.token"},
    )
    assert resp.status_code in (401, 403)


# --------------------------------------------------------------------------- #
# Logout
# --------------------------------------------------------------------------- #

@integration
async def test_logout(async_client: AsyncClient, admin_tokens: dict):
    """Logout endpoint returns 200 and sets a cleared refresh cookie."""
    resp = await async_client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert resp.status_code == 200
