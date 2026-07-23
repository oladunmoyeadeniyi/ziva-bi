"""
ZivaBI — centralised email service (P2 milestone).

All outbound email for the platform goes through this module.  The transport
is Resend (https://resend.com) called via its REST API using the httpx async
client that is already a project dependency.

Usage
-----
    from app.services.email import send_email, send_invitation_email, ...

If RESEND_API_KEY is not set (local dev / CI), every call writes a rich
console simulation log instead of making a real API call — no mocking
required for development.

suppress_outbound_email
-----------------------
Test tenants carry ``Tenant.suppress_outbound_email = True`` by default.
Callers that have the tenant object in scope should pass
``suppress=tenant.suppress_outbound_email`` so that simulated flows on test
tenants never fire real emails.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_RESEND_API = "https://api.resend.com/emails"


# ── Core sender ───────────────────────────────────────────────────────────────

async def send_email(
    to_email: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    suppress: bool = False,
) -> bool:
    """
    Send a single transactional email via Resend.

    Parameters
    ----------
    to_email : str
        Recipient address.
    subject : str
        Email subject line.
    html : str
        HTML body — used when the recipient's client supports it.
    text : str, optional
        Plain-text fallback.  Derived from ``html`` by stripping tags if omitted.
    suppress : bool
        When ``True`` the email is suppressed and only logged at DEBUG level.
        Pass ``tenant.suppress_outbound_email`` to prevent test-tenant emails.

    Returns
    -------
    bool
        ``True`` if Resend accepted the message, ``False`` otherwise (the
        exception is caught and logged — do not raise to the request handler).
    """
    if suppress:
        logger.debug(
            "[EMAIL SUPPRESSED — test tenant]\nTo: %s\nSubject: %s",
            to_email, subject,
        )
        return False

    text_body = text or _strip_html(html)

    if not settings.resend_api_key:
        logger.info(
            "[EMAIL SIMULATION — RESEND_API_KEY not set]\n"
            "To: %s\nSubject: %s\n\n%s",
            to_email, subject, text_body,
        )
        return False

    payload: dict = {
        "from": settings.email_from,
        "to": [to_email],
        "subject": subject,
        "html": html,
        "text": text_body,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                _RESEND_API,
                json=payload,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            )
        if resp.status_code in (200, 201):
            logger.debug("Email sent to %s (subject: %s)", to_email, subject)
            return True
        logger.warning(
            "Resend API returned %d for %s: %s",
            resp.status_code, to_email, resp.text[:200],
        )
        return False
    except Exception as exc:
        logger.warning("Failed to send email to %s: %s", to_email, exc)
        return False


def _strip_html(html: str) -> str:
    """Very light HTML → plain-text conversion (no external deps)."""
    import re
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Template helpers ──────────────────────────────────────────────────────────

async def send_invitation_email(
    to_email: str,
    tenant_name: str,
    invited_by_name: str,
    role: str,
    accept_url: str,
    app_name: str = "Ziva BI",
    suppress: bool = False,
) -> bool:
    """Send a tenant invitation email with an accept link."""
    subject = f"You've been invited to join {tenant_name} on {app_name}"
    html = f"""
<p>Hi,</p>
<p><strong>{invited_by_name}</strong> has invited you to join
<strong>{tenant_name}</strong> on <strong>{app_name}</strong> as
<strong>{role}</strong>.</p>
<p><a href="{accept_url}" style="background:#0f62fe;color:#fff;padding:10px 20px;
text-decoration:none;border-radius:4px;display:inline-block;">
Accept Invitation</a></p>
<p>Or copy this link into your browser:<br>
<a href="{accept_url}">{accept_url}</a></p>
<p>This invitation link expires in <strong>48 hours</strong>.</p>
<p>If you didn't expect this invitation, you can safely ignore this email.</p>
<hr>
<p style="color:#666;font-size:12px;">{app_name} — Finance Automation Platform</p>
"""
    text = (
        f"{invited_by_name} has invited you to join {tenant_name} on {app_name} as {role}.\n\n"
        f"Accept your invitation here:\n{accept_url}\n\n"
        f"This link expires in 48 hours.\n\n"
        f"If you didn't expect this invitation, you can safely ignore this email."
    )
    return await send_email(to_email, subject, html, text, suppress=suppress)


async def send_password_reset_email(
    to_email: str,
    full_name: str,
    reset_url: str,
    app_name: str = "Ziva BI",
) -> bool:
    """Send a password reset link. Never suppressed — always a real-user action."""
    subject = f"Reset your {app_name} password"
    html = f"""
<p>Hi {full_name},</p>
<p>We received a request to reset your password on <strong>{app_name}</strong>.</p>
<p><a href="{reset_url}" style="background:#0f62fe;color:#fff;padding:10px 20px;
text-decoration:none;border-radius:4px;display:inline-block;">
Reset Password</a></p>
<p>Or copy this link into your browser:<br>
<a href="{reset_url}">{reset_url}</a></p>
<p>This link expires in <strong>1 hour</strong>.</p>
<p>If you didn't request a password reset, please ignore this email — your
account remains secure.</p>
<hr>
<p style="color:#666;font-size:12px;">{app_name} — Finance Automation Platform</p>
"""
    text = (
        f"Hi {full_name},\n\n"
        f"We received a request to reset your {app_name} password.\n\n"
        f"Reset your password here (expires in 1 hour):\n{reset_url}\n\n"
        f"If you didn't request this, please ignore this email — your account remains secure."
    )
    return await send_email(to_email, subject, html, text)


async def send_live_promotion_email(
    to_email: str,
    full_name: str,
    tenant_name: str,
    login_url: str,
    app_name: str = "Ziva BI",
) -> bool:
    """Notify a user that their live environment is now ready."""
    subject = f"Your {app_name} live account for {tenant_name} is ready"
    html = f"""
<p>Hi {full_name},</p>
<p>Great news — the live environment for <strong>{tenant_name}</strong>
on <strong>{app_name}</strong> has been activated.</p>
<p>Your credentials are the same as the ones you used during the
implementation phase. Log in to get started:</p>
<p><a href="{login_url}" style="background:#0f62fe;color:#fff;padding:10px 20px;
text-decoration:none;border-radius:4px;display:inline-block;">
Log In Now</a></p>
<p>Or visit: <a href="{login_url}">{login_url}</a></p>
<hr>
<p style="color:#666;font-size:12px;">{app_name} — Finance Automation Platform</p>
"""
    text = (
        f"Hi {full_name},\n\n"
        f"The live environment for {tenant_name} on {app_name} has been activated.\n\n"
        f"Your login credentials are unchanged. Log in here:\n{login_url}\n\n"
        f"Welcome to {app_name}!"
    )
    return await send_email(to_email, subject, html, text)


async def send_onboarding_invite_email(
    to_email: str,
    full_name: str,
    tenant_name: str,
    onboarding_url: str,
    app_name: str = "Ziva BI",
    suppress: bool = False,
) -> bool:
    """Send an employee self-onboarding invitation."""
    subject = f"Complete your {app_name} profile for {tenant_name}"
    html = f"""
<p>Hi {full_name},</p>
<p>You've been added to <strong>{tenant_name}</strong> on
<strong>{app_name}</strong>. Please complete your profile so our
HR team can finalise your account:</p>
<p><a href="{onboarding_url}" style="background:#0f62fe;color:#fff;
padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">
Complete My Profile</a></p>
<p>Or copy this link into your browser:<br>
<a href="{onboarding_url}">{onboarding_url}</a></p>
<p>This link expires in <strong>30 days</strong>.</p>
<hr>
<p style="color:#666;font-size:12px;">{app_name} — Finance Automation Platform</p>
"""
    text = (
        f"Hi {full_name},\n\n"
        f"You've been added to {tenant_name} on {app_name}.\n\n"
        f"Please complete your profile (link valid 30 days):\n{onboarding_url}"
    )
    return await send_email(to_email, subject, html, text, suppress=suppress)


async def send_approval_notification_email(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str,
    app_name: str = "Ziva BI",
) -> bool:
    """
    Generic approval-workflow notification.

    Callers in approvals.py build their own subject + body and call this helper
    rather than the lower-level send_email() — gives a consistent footer.
    """
    html = f"""
<p>{body_html}</p>
<p><a href="{settings.frontend_url}/dashboard">Log in to {app_name}</a>
to view and action.</p>
<hr>
<p style="color:#666;font-size:12px;">{app_name} — Finance Automation Platform</p>
"""
    return await send_email(to_email, subject, html, body_text)
