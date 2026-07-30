"""
ZivaBI — WebAuthn and Push Pydantic schemas.

Covers:
    WebAuthn registration ceremony  (begin → complete)
    WebAuthn authentication ceremony (begin → complete)
    Credential management            (list, delete)
    Push subscription management     (subscribe, unsubscribe, VAPID key)

Naming conventions:
    *Options  — sent from server to client (browser calls navigator.credentials.*)
    *Response — returned from server after verifying the client's credential response
    *Request  — body sent from client to server

All base64url values are kept as plain strings; the webauthn library handles
encoding/decoding internally. Bytes fields (public_key, challenge) are base64url
strings at the API boundary — never raw bytes — to be JSON-serialisable.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


# ── Registration ──────────────────────────────────────────────────────────────

class RegistrationBeginRequest(BaseModel):
    """
    Optional body for POST /api/auth/webauthn/register/begin.

    device_name: user-supplied label for the credential being registered
                 (e.g. "iPhone 15 Pro"). Stored on the user_credentials row
                 so the Manage Devices screen can display it.
    """
    device_name: str | None = None


class RegistrationOptionsResponse(BaseModel):
    """
    Returned by POST /api/auth/webauthn/register/begin.

    The frontend passes this object directly to navigator.credentials.create().
    challenge is a base64url string; the browser SDK handles decoding.

    Fields mirror the PublicKeyCredentialCreationOptions WebIDL type but are
    serialised to JSON-compatible types for transport.
    """
    challenge: str
    rp: dict[str, str]                  # {"id": "...", "name": "Ziva BI"}
    user: dict[str, str]                # {"id": base64url(user_id), "name": email, "displayName": full_name}
    pubKeyCredParams: list[dict[str, Any]]
    timeout: int
    attestation: str
    authenticatorSelection: dict[str, Any]
    excludeCredentials: list[dict[str, Any]]  # already-registered creds to exclude


class RegistrationCompleteRequest(BaseModel):
    """
    Body for POST /api/auth/webauthn/register/complete.

    credential: the raw JSON object returned by navigator.credentials.create(),
                re-serialised to a Python dict for transport. py_webauthn's
                verify_registration_response() accepts this shape directly.
    device_name: optional label supplied at begin-time; passed through to be
                 stored on the credential row.
    """
    credential: dict[str, Any]
    device_name: str | None = None


class RegistrationCompleteResponse(BaseModel):
    """Returned on successful registration — confirms the new credential is enrolled."""
    credential_id: str
    device_name: str | None
    created_at: datetime


# ── Authentication ────────────────────────────────────────────────────────────

class AuthenticationBeginRequest(BaseModel):
    """
    Body for POST /api/auth/webauthn/authenticate/begin.

    email is required so the server can look up the user's registered
    credentials and build the allowCredentials list.
    """
    email: str


class AuthenticationOptionsResponse(BaseModel):
    """
    Returned by POST /api/auth/webauthn/authenticate/begin.

    Passed by the frontend directly to navigator.credentials.get().
    """
    challenge: str
    timeout: int
    rpId: str
    allowCredentials: list[dict[str, Any]]
    userVerification: str


class AuthenticationCompleteRequest(BaseModel):
    """
    Body for POST /api/auth/webauthn/authenticate/complete.

    email is needed again to resolve the user (challenge is keyed by user_id
    in the server-side challenge store).
    credential: raw navigator.credentials.get() result re-serialised as a dict.
    """
    email: str
    credential: dict[str, Any]


class AuthenticationCompleteResponse(BaseModel):
    """
    Returned after a successful WebAuthn authentication.

    Issues the same token pair as a normal password login — the frontend
    handles it identically.
    """
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ── Credential management ─────────────────────────────────────────────────────

class CredentialResponse(BaseModel):
    """One row in the Manage Devices list."""
    id: str                          # UUID of the user_credentials row
    credential_id: str               # WebAuthn credential ID (base64url)
    device_name: str | None
    aaguid: str | None
    created_at: datetime
    last_used_at: datetime | None

    model_config = {"from_attributes": True}


class CredentialListResponse(BaseModel):
    """Response for GET /api/auth/webauthn/credentials."""
    credentials: list[CredentialResponse]


# ── Push subscriptions ────────────────────────────────────────────────────────

class PushSubscribeRequest(BaseModel):
    """
    Body for POST /api/push/subscribe.

    Mirrors the PushSubscriptionJSON WebIDL shape returned by
    pushManager.subscribe().toJSON() in the browser.

    app_name identifies which PWA the subscription belongs to so
    push_service.send_push() can fan-out to the correct app only.
    """
    endpoint: str
    p256dh: str
    auth: str
    app_name: str   # 'ziva-expense' | 'ziva-approve' | 'ziva-procure' | 'ziva-insights'


class PushUnsubscribeRequest(BaseModel):
    """Body for DELETE /api/push/subscribe — identifies the subscription by endpoint."""
    endpoint: str


class VapidPublicKeyResponse(BaseModel):
    """Returned by GET /api/push/vapid-public-key (unauthenticated)."""
    vapid_public_key: str
