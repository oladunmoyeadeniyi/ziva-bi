"""
Shared test fixtures for the PRAD backend test suite.

Integration tests require a real PostgreSQL database.  Point them at a
*separate* test database by setting TEST_DATABASE_URL before running:

    export TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/prad_test
    cd backend && pytest

If TEST_DATABASE_URL is not set, every test decorated with the `integration`
mark is automatically skipped — unit tests still run.

Fixture hierarchy (session-scoped for speed):
    app              — FastAPI app with DB overridden to test DB
    async_client     — httpx.AsyncClient wired to the test app
    admin_tokens     — {access_token, refresh_token} from test tenant signup
    admin_headers    — {"Authorization": "Bearer <access_token>"}
"""

import os
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

TEST_DB_URL = os.getenv("TEST_DATABASE_URL")

integration = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="Integration test — set TEST_DATABASE_URL to run",
)

# A stable company/email suffix that is unlikely to exist in production
_SUFFIX = "pytest-" + uuid.uuid4().hex[:8]
TEST_COMPANY = f"Pytest Corp {_SUFFIX}"
TEST_ADMIN_EMAIL = f"admin_{_SUFFIX}@prad-test.local"
TEST_ADMIN_PASSWORD = "TestPass!9876"


# --------------------------------------------------------------------------- #
# App fixture — overrides DATABASE_URL to point at the test DB
# --------------------------------------------------------------------------- #

@pytest.fixture(scope="session")
def app():
    """Return the FastAPI application wired to the test database.

    The DATABASE_URL override must happen *before* app.main is imported,
    which is why we patch os.environ directly at fixture time.  The patched
    value is restored after the session ends.
    """
    if not TEST_DB_URL:
        pytest.skip("TEST_DATABASE_URL not set")

    original = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = TEST_DB_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgres://", "postgresql+asyncpg://")

    from app.main import app as _app  # import after env override
    yield _app

    # Restore
    if original is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = original


# --------------------------------------------------------------------------- #
# HTTP client
# --------------------------------------------------------------------------- #

@pytest_asyncio.fixture(scope="session")
async def async_client(app):
    """Async HTTPX client bound to the test FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


# --------------------------------------------------------------------------- #
# Auth fixtures
# --------------------------------------------------------------------------- #

@pytest_asyncio.fixture(scope="session")
async def admin_tokens(async_client: AsyncClient) -> dict:
    """
    Sign up a fresh test company + admin, return {access_token, refresh_token}.

    If signup fails (e.g. duplicate company name from a previous run that
    rolled back mid-test), falls back to login — so the fixture is idempotent.
    """
    signup_resp = await async_client.post("/api/auth/signup", json={
        "company_name": TEST_COMPANY,
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASSWORD,
        "first_name": "Pytest",
        "last_name": "Admin",
        "currency": "NGN",
    })
    if signup_resp.status_code not in (200, 201, 409):
        raise RuntimeError(f"Unexpected signup response: {signup_resp.status_code} {signup_resp.text}")

    # Now login to get fresh tokens
    login_resp = await async_client.post("/api/auth/login", json={
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASSWORD,
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    data = login_resp.json()
    return {"access_token": data["access_token"]}


@pytest.fixture(scope="session")
def admin_headers(admin_tokens: dict) -> dict:
    """Authorization header dict for admin requests."""
    return {"Authorization": f"Bearer {admin_tokens['access_token']}"}
