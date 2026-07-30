"""
ZivaBI — WebAuthn service.

Wraps the `webauthn` (py_webauthn) library to provide:

    generate_registration_options()     — build PublicKeyCredentialCreationOptions
    verify_registration_response()      — verify attestation + extract public key
    generate_authentication_options()   — build PublicKeyCredentialRequestOptions
    verify_authentication_response()    — verify assertion + check sign_count

Challenge store:
    Challenges are short-lived (5 minutes) server-side values that prevent
    replay attacks. This implementation uses an in-memory dict keyed by
    user_id string. A future enhancement can swap this for Redis without
    changing the callers — the store interface is local to this module.

RP configuration:
    rpId is env-aware:
        ENVIRONMENT=production  → "zivabi.com"
        ENVIRONMENT=development → "localhost"
    rpName is always "Ziva BI".

Sign count policy:
    RFC 8809 recommends rejecting credentials where the presented sign_count
    is ≤ the stored value (possible cloning). ZivaBI enforces this strictly:
    if the authenticator returns 0 we skip the check (some software
    authenticators always return 0); otherwise we require strictly greater.

Security note:
    This module never logs the raw challenge or private key material.
    All exceptions from py_webauthn are caught and re-raised as standard
    Python ValueError so callers can map them to HTTP 400/401 without
    importing webauthn types.
"""

import base64
import os
import time
import uuid
from typing import Any

from app.config import settings

# ── Challenge store ───────────────────────────────────────────────────────────
# Dict: user_id_str → {"challenge": bytes, "expires": float}
# Single-use: entry is deleted immediately on first retrieval.
# 5-minute TTL is enforced at write time (could also be checked at read time
# for extra safety, but the authenticator timeout makes this redundant in practice).

_CHALLENGE_TTL = 300  # seconds

_challenge_store: dict[str, dict[str, Any]] = {}


def _store_challenge(user_id: str, challenge: bytes) -> None:
    """Store a challenge for user_id, overwriting any existing one."""
    _challenge_store[user_id] = {
        "challenge": challenge,
        "expires": time.monotonic() + _CHALLENGE_TTL,
    }


def _pop_challenge(user_id: str) -> bytes:
    """Retrieve and delete the challenge for user_id. Raises ValueError if missing/expired."""
    entry = _challenge_store.pop(user_id, None)
    if entry is None:
        raise ValueError("No pending WebAuthn challenge for this user. Begin the ceremony first.")
    if time.monotonic() > entry["expires"]:
        raise ValueError("WebAuthn challenge expired. Please try again.")
    return entry["challenge"]  # type: ignore[return-value]


# ── RP configuration ──────────────────────────────────────────────────────────

def _rp_id() -> str:
    """
    Return the WebAuthn relying party ID from settings.

    Reads WEBAUTHN_RP_ID env var (default "localhost").
    Set to the actual frontend domain in Render:
        today  → "ziva-bi-frontend.onrender.com"
        future → "zivabi.com" (after custom domain cutover)

    The rpId MUST be a registrable-domain suffix of the actual browser origin
    or WebAuthn registration/authentication will be rejected by the browser.
    """
    return settings.webauthn_rp_id


def _rp_name() -> str:
    return "Ziva BI"


# ── Registration ──────────────────────────────────────────────────────────────

def generate_registration_options(
    user_id: uuid.UUID,
    user_email: str,
    user_display_name: str,
    existing_credential_ids: list[str],
) -> dict[str, Any]:
    """
    Generate PublicKeyCredentialCreationOptions for the browser.

    Stores a fresh challenge in the in-memory store keyed by str(user_id).
    The frontend passes the returned dict to navigator.credentials.create().

    existing_credential_ids: list of base64url credential IDs already registered
        for this user — passed as excludeCredentials so the same authenticator
        cannot be registered twice.

    Returns a JSON-serialisable dict matching the WebIDL shape expected by
    navigator.credentials.create().
    """
    import webauthn
    from webauthn.helpers.structs import (
        AttestationConveyancePreference,
        AuthenticatorSelectionCriteria,
        ResidentKeyRequirement,
        UserVerificationRequirement,
        PublicKeyCredentialDescriptor,
    )
    from webauthn.helpers.cose import COSEAlgorithmIdentifier

    challenge = os.urandom(32)
    _store_challenge(str(user_id), challenge)

    exclude = [
        PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(cid + "=="))
        for cid in existing_credential_ids
    ]

    options = webauthn.generate_registration_options(
        rp_id=_rp_id(),
        rp_name=_rp_name(),
        user_id=str(user_id).encode(),
        user_name=user_email,
        user_display_name=user_display_name,
        challenge=challenge,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
        exclude_credentials=exclude,
        timeout=60_000,  # 60 seconds
    )

    return webauthn.options_to_json(options)  # type: ignore[return-value]


def verify_registration(
    user_id: uuid.UUID,
    credential_json: dict[str, Any],
    expected_origin: str,
) -> tuple[str, bytes, int, str | None]:
    """
    Verify the attestation response from navigator.credentials.create().

    Pops the stored challenge for user_id (single-use).
    Returns (credential_id_b64url, public_key_bytes, sign_count, aaguid).

    Raises ValueError on any verification failure.

    expected_origin: the Origin header value from the request (e.g.
        "https://expense.zivabi.com"). py_webauthn validates that the
        credential was created for this exact origin.
    """
    import webauthn
    from webauthn.helpers.exceptions import InvalidCBORData, InvalidAuthenticatorDataStructure

    challenge = _pop_challenge(str(user_id))

    try:
        verification = webauthn.verify_registration_response(
            credential=credential_json,
            expected_challenge=challenge,
            expected_rp_id=_rp_id(),
            expected_origin=expected_origin,
            require_user_verification=False,
        )
    except Exception as exc:
        raise ValueError(f"WebAuthn registration verification failed: {exc}") from exc

    cred_id = base64.urlsafe_b64encode(verification.credential_id).rstrip(b"=").decode()
    aaguid = str(verification.aaguid) if verification.aaguid else None
    return cred_id, verification.credential_public_key, verification.sign_count, aaguid


# ── Authentication ────────────────────────────────────────────────────────────

def generate_authentication_options(
    user_id: uuid.UUID,
    credential_ids: list[str],
) -> dict[str, Any]:
    """
    Generate PublicKeyCredentialRequestOptions for the browser.

    Stores a fresh challenge keyed by str(user_id).
    credential_ids: list of base64url credential IDs registered for this user —
        passed as allowCredentials so the browser knows which key to use.

    Returns a JSON-serialisable dict for navigator.credentials.get().
    """
    import webauthn
    from webauthn.helpers.structs import (
        PublicKeyCredentialDescriptor,
        UserVerificationRequirement,
    )

    challenge = os.urandom(32)
    _store_challenge(str(user_id), challenge)

    allow = [
        PublicKeyCredentialDescriptor(
            id=base64.urlsafe_b64decode(cid + "==")
        )
        for cid in credential_ids
    ]

    options = webauthn.generate_authentication_options(
        rp_id=_rp_id(),
        challenge=challenge,
        allow_credentials=allow,
        user_verification=UserVerificationRequirement.PREFERRED,
        timeout=60_000,
    )

    return webauthn.options_to_json(options)  # type: ignore[return-value]


def verify_authentication(
    user_id: uuid.UUID,
    credential_json: dict[str, Any],
    stored_public_key: bytes,
    stored_sign_count: int,
    expected_origin: str,
) -> int:
    """
    Verify the assertion response from navigator.credentials.get().

    Pops the stored challenge for user_id (single-use).
    Returns the new sign_count to persist on the credential row.

    sign_count policy:
        - If the authenticator reports 0 AND stored count is 0 → allow (software authenticator).
        - If the authenticator reports > 0 AND ≤ stored count → reject (possible clone).

    Raises ValueError on any verification failure.
    """
    import webauthn

    challenge = _pop_challenge(str(user_id))

    try:
        verification = webauthn.verify_authentication_response(
            credential=credential_json,
            expected_challenge=challenge,
            expected_rp_id=_rp_id(),
            expected_origin=expected_origin,
            credential_public_key=stored_public_key,
            credential_current_sign_count=stored_sign_count,
            require_user_verification=False,
        )
    except Exception as exc:
        raise ValueError(f"WebAuthn authentication verification failed: {exc}") from exc

    new_count = verification.new_sign_count
    # Enforce sign_count monotonicity (skip check when both are 0).
    if new_count > 0 and new_count <= stored_sign_count:
        raise ValueError(
            "Sign count did not increase — possible credential clone detected. "
            "Authentication rejected."
        )

    return new_count
