"""
PRAD — WebAuthn router.

Endpoints:
    POST /api/auth/webauthn/register/begin          Generate registration options
    POST /api/auth/webauthn/register/complete       Verify attestation + enroll credential
    POST /api/auth/webauthn/authenticate/begin      Generate authentication options
    POST /api/auth/webauthn/authenticate/complete   Verify assertion + issue JWT
    GET  /api/auth/webauthn/credentials             List user's registered devices
    DELETE /api/auth/webauthn/credentials/{id}      Remove a specific credential

Registration and authentication/complete require the request Origin header
for py_webauthn's expected_origin validation. FastAPI injects this via
Request.headers["origin"] — no additional middleware needed.

All WebAuthn verification errors are returned as HTTP 400 (bad request) —
not 401 — because a WebAuthn failure does not imply the user is unauthenticated;
they may simply have presented the wrong credential or an expired challenge.

The authenticate/complete endpoint is the only unauthenticated WebAuthn
endpoint that issues tokens. All other endpoints require a valid access token
(register/begin, register/complete, list, delete — the user is already logged
in via password and is adding a biometric credential).
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import User, UserTenant, Session, Tenant
from app.models.webauthn import UserCredential
from app.routers.auth import (
    _build_access_token,
    _create_session_and_tokens,
    _get_org_role_tier,
    _has_non_admin_roles,
    _is_tenant_admin,
    _log_event,
    _set_refresh_cookie,
)
from app.schemas.auth import AuthResponse, UserResponse
from app.schemas.webauthn import (
    AuthenticationBeginRequest,
    AuthenticationCompleteRequest,
    AuthenticationCompleteResponse,
    AuthenticationOptionsResponse,
    CredentialListResponse,
    CredentialResponse,
    RegistrationBeginRequest,
    RegistrationCompleteRequest,
    RegistrationCompleteResponse,
    RegistrationOptionsResponse,
)
from app.services import webauthn_service

router = APIRouter(prefix="/api/auth/webauthn", tags=["webauthn"])


def _get_origin(request: Request) -> str:
    """Extract the Origin header. Falls back to a localhost default for dev."""
    origin = request.headers.get("origin", "")
    if not origin:
        # Local dev without a browser Origin (e.g. curl / Swagger UI) — allow localhost
        origin = "http://localhost:3000"
    return origin


# ── Registration ──────────────────────────────────────────────────────────────

@router.post("/register/begin", response_model=RegistrationOptionsResponse)
async def register_begin(
    data: RegistrationBeginRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> RegistrationOptionsResponse:
    """
    Generate PublicKeyCredentialCreationOptions for the browser.

    Stores a challenge in the server-side challenge store keyed by the
    authenticated user's ID. The challenge is consumed (single-use) by
    register/complete.

    Requires: valid access token (user already logged in via password).
    """
    # Load existing credential IDs to populate excludeCredentials
    result = await db.execute(
        select(UserCredential).where(UserCredential.user_id == current_user.user_id)
    )
    existing = result.scalars().all()
    existing_ids = [c.credential_id for c in existing]

    # Load user profile for user.name / user.displayName in the options
    user_result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    options = webauthn_service.generate_registration_options(
        user_id=current_user.user_id,
        user_email=user.email,
        user_display_name=user.full_name,
        existing_credential_ids=existing_ids,
    )
    return RegistrationOptionsResponse(**options)


@router.post("/register/complete", response_model=RegistrationCompleteResponse, status_code=status.HTTP_201_CREATED)
async def register_complete(
    data: RegistrationCompleteRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> RegistrationCompleteResponse:
    """
    Verify the attestation response and enroll the new credential.

    Pops the stored challenge (single-use). On success, inserts a row into
    user_credentials and returns the credential_id and device_name.
    """
    try:
        cred_id, public_key, sign_count, aaguid = webauthn_service.verify_registration(
            user_id=current_user.user_id,
            credential_json=data.credential,
            expected_origin=_get_origin(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # Guard against duplicate credential_id (should not happen; excludeCredentials prevents it)
    dup = await db.execute(
        select(UserCredential).where(UserCredential.credential_id == cred_id)
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This credential is already registered.",
        )

    device_name = data.device_name or "Unknown device"
    credential = UserCredential(
        user_id=current_user.user_id,
        credential_id=cred_id,
        public_key=public_key,
        sign_count=sign_count,
        device_name=device_name,
        aaguid=aaguid,
    )
    db.add(credential)
    await db.commit()
    await db.refresh(credential)

    return RegistrationCompleteResponse(
        credential_id=cred_id,
        device_name=device_name,
        created_at=credential.created_at,
    )


# ── Authentication ────────────────────────────────────────────────────────────

@router.post("/authenticate/begin", response_model=AuthenticationOptionsResponse)
async def authenticate_begin(
    data: AuthenticationBeginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthenticationOptionsResponse:
    """
    Generate PublicKeyCredentialRequestOptions for the browser.

    Public endpoint — no access token required (user is trying to log in).
    Resolves the user by email, looks up their registered credentials, and
    stores a challenge keyed by user_id.
    """
    # Resolve user by email
    user_result = await db.execute(select(User).where(User.email == data.email.strip().lower()))
    user = user_result.scalar_one_or_none()
    if not user:
        # Don't reveal whether the email exists
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No passkey registered for this account.",
        )

    # Load credential IDs
    cred_result = await db.execute(
        select(UserCredential).where(UserCredential.user_id == user.id)
    )
    credentials = cred_result.scalars().all()
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No passkey registered for this account.",
        )

    options = webauthn_service.generate_authentication_options(
        user_id=user.id,
        credential_ids=[c.credential_id for c in credentials],
    )
    return AuthenticationOptionsResponse(**options)


@router.post("/authenticate/complete", response_model=AuthResponse)
async def authenticate_complete(
    data: AuthenticationCompleteRequest,
    request: Request,
    response: "Response",  # type: ignore[name-defined]
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Verify the assertion response and issue a JWT pair.

    Public endpoint. On success this is equivalent to a password login:
    - Access token + refresh token are issued
    - httpOnly cookie ziva_rt is set (same as login endpoint)
    - sign_count is updated on the credential row
    - An audit log entry is written

    The response shape is identical to AuthResponse so the frontend can
    handle it the same way as a normal login.
    """
    from fastapi import Response as FastAPIResponse  # local import to avoid circular

    # Resolve user
    user_result = await db.execute(select(User).where(User.email == data.email.strip().lower()))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed.")

    # Find the matching credential by credential_id in the assertion
    credential_id_from_client = data.credential.get("id", "")
    cred_result = await db.execute(
        select(UserCredential).where(
            UserCredential.user_id == user.id,
            UserCredential.credential_id == credential_id_from_client,
        )
    )
    stored_cred = cred_result.scalar_one_or_none()
    if not stored_cred:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed.")

    try:
        new_sign_count = webauthn_service.verify_authentication(
            user_id=user.id,
            credential_json=data.credential,
            stored_public_key=stored_cred.public_key,
            stored_sign_count=stored_cred.sign_count,
            expected_origin=_get_origin(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    # Update sign_count and last_used_at
    stored_cred.sign_count = new_sign_count
    stored_cred.last_used_at = datetime.now(timezone.utc)

    # Resolve user_tenant (same logic as login)
    ut_result = await db.execute(
        select(UserTenant).where(UserTenant.user_id == user.id)
    )
    user_tenant = ut_result.scalars().first()
    if not user_tenant or not user_tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not active.",
        )

    # Check tenant suspension
    login_env = "live"
    if user_tenant.tenant_id:
        t_res = await db.execute(select(Tenant).where(Tenant.id == user_tenant.tenant_id))
        tenant = t_res.scalar_one_or_none()
        if tenant and getattr(tenant, "lifecycle_status", None) == "suspended":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended.")
        login_env = getattr(tenant, "environment", "live") if tenant else "live"

    session_obj, raw_token, _ = await _create_session_and_tokens(user_tenant, db, request)
    admin_flag = await _is_tenant_admin(user_tenant.id, db)
    non_admin_flag = await _has_non_admin_roles(user_tenant.id, db)
    org_tier = await _get_org_role_tier(user.id, user_tenant.tenant_id, db)
    access_token = _build_access_token(
        user, user_tenant, session_obj,
        is_tenant_admin=admin_flag,
        has_non_admin_role=non_admin_flag,
        environment=login_env,
        org_role_tier=org_tier,
    )

    await _log_event("webauthn.login.success", db, request, user=user, tenant_id=user_tenant.tenant_id)
    await db.commit()

    _set_refresh_cookie(response, raw_token)
    return AuthResponse(
        access_token=access_token,
        refresh_token=raw_token,
        user=UserResponse.from_orm_pair(
            user, user_tenant.tenant_id,
            is_tenant_admin=admin_flag,
            has_non_admin_role=non_admin_flag,
            role_tier=getattr(user_tenant, "role_tier", None),
        ),
    )


# ── Credential management ─────────────────────────────────────────────────────

@router.get("/credentials", response_model=CredentialListResponse)
async def list_credentials(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CredentialListResponse:
    """
    List all passkeys registered by the current user.

    Used by the Manage Devices screen (Phase 6) to display device name,
    registration date, and last used date for each credential.
    """
    result = await db.execute(
        select(UserCredential)
        .where(UserCredential.user_id == current_user.user_id)
        .order_by(UserCredential.created_at.desc())
    )
    credentials = result.scalars().all()
    return CredentialListResponse(
        credentials=[
            CredentialResponse(
                id=str(c.id),
                credential_id=c.credential_id,
                device_name=c.device_name,
                aaguid=c.aaguid,
                created_at=c.created_at,
                last_used_at=c.last_used_at,
            )
            for c in credentials
        ]
    )


@router.delete("/credentials/{credential_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_uuid: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Remove a registered passkey.

    Scoped to current_user.user_id — users can only delete their own credentials.
    Deleting the last credential is allowed (the user can still log in via password).
    """
    try:
        cred_uuid = uuid.UUID(credential_uuid)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid credential ID.")

    result = await db.execute(
        select(UserCredential).where(
            UserCredential.id == cred_uuid,
            UserCredential.user_id == current_user.user_id,
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found.")

    await db.delete(credential)
    await db.commit()
