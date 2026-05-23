"""
ZivaBI — auth router.

Endpoints:
    POST /api/auth/signup          Register individual or business account
    POST /api/auth/login           Email + password login
    POST /api/auth/refresh-token   Rotate refresh token, get new access token
    POST /api/auth/logout          Revoke refresh token and end session

All endpoints are public (no require_auth dependency). Token-protected endpoints
live in app/routers/users.py and future module routers.

Account locking:
    After LOCKOUT_THRESHOLD consecutive failed logins, the user_tenant record
    is locked for LOCKOUT_MINUTES. This is the system default; tenant-configurable
    lockout policy is a future enhancement (tenant_settings table).
"""

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.database import get_db
from app.models.auth import (
    AuditLog,
    RefreshToken,
    Role,
    Session,
    Tenant,
    User,
    UserRole,
    UserTenant,
)
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshTokenRequest,
    SignupRequest,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

LOCKOUT_THRESHOLD = 5    # failed attempts before lockout
LOCKOUT_MINUTES = 15     # lockout duration


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_slug(name: str) -> str:
    """Convert a company name to a URL-friendly slug (max 50 chars)."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower())
    return slug.strip("-")[:50] or "company"


async def _unique_slug(base: str, db: AsyncSession) -> str:
    """Append a random hex suffix until the slug is unique in the tenants table."""
    import secrets
    slug = base
    while True:
        result = await db.execute(select(Tenant).where(Tenant.slug == slug))
        if result.scalar_one_or_none() is None:
            return slug
        slug = f"{base}-{secrets.token_hex(3)}"


async def _is_tenant_admin(user_tenant_id: uuid.UUID, db: AsyncSession) -> bool:
    """
    Return True if the user_tenant has the global 'tenant_admin' role.

    Called at login, signup, and token refresh so the JWT always reflects
    the current role assignment — role changes take effect at next token refresh.
    """
    result = await db.execute(
        select(UserRole)
        .join(Role, UserRole.role_id == Role.id)
        .where(
            UserRole.user_tenant_id == user_tenant_id,
            Role.name == "tenant_admin",
        )
    )
    return result.scalar_one_or_none() is not None


async def _has_non_admin_roles(user_tenant_id: uuid.UUID, db: AsyncSession) -> bool:
    """
    Return True if the user_tenant has at least one role besides tenant_admin.

    When False (user is exclusively tenant_admin), operational features such as
    expense submission are hidden and the API blocks them.
    """
    result = await db.execute(
        select(UserRole)
        .join(Role, UserRole.role_id == Role.id)
        .where(
            UserRole.user_tenant_id == user_tenant_id,
            Role.name != "tenant_admin",
        )
    )
    return result.scalar_one_or_none() is not None


def _build_access_token(
    user: User,
    user_tenant: UserTenant,
    session: Session,
    *,
    is_tenant_admin: bool = False,
    has_non_admin_role: bool = False,
) -> str:
    """Assemble the JWT payload and sign it."""
    return create_access_token({
        "sub": str(user.id),
        "user_tenant_id": str(user_tenant.id),
        "account_type": user.account_type.value,
        "tenant_id": str(user_tenant.tenant_id) if user_tenant.tenant_id else None,
        "session_id": str(session.id),
        "is_super_admin": user.is_super_admin,
        "is_tenant_admin": is_tenant_admin,
        "has_non_admin_role": has_non_admin_role,
    })


async def _create_session_and_tokens(
    user_tenant: UserTenant,
    db: AsyncSession,
    request: Request,
) -> tuple[Session, str, str]:
    """
    Create a session + refresh token pair.

    Returns (session, raw_refresh_token, token_hash) so the caller can
    build the access token and return the raw refresh token to the client.
    """
    from app.config import settings

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    session = Session(
        user_tenant_id=user_tenant.id,
        ip_address=ip,
        user_agent=ua,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)
    await db.flush()  # get session.id before creating the refresh token

    raw_token, token_hash = generate_refresh_token()
    refresh = RefreshToken(
        session_id=session.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(refresh)
    return session, raw_token, token_hash


async def _log_event(
    event_type: str,
    db: AsyncSession,
    request: Request,
    user: User | None = None,
    tenant_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> None:
    """Append an immutable audit log entry."""
    log = AuditLog(
        event_type=event_type,
        user_id=user.id if user else None,
        tenant_id=tenant_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        log_metadata=metadata,
    )
    db.add(log)


# ── Signup ────────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    data: SignupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Register a new user.

    Individual: creates User + UserTenant (tenant_id=NULL).
    Business:   creates Tenant + User + UserTenant, assigns tenant_admin role.
    Returns access token + refresh token on success.
    """
    # ── 1. Email uniqueness check ─────────────────────────────────────────────
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    tenant: Tenant | None = None

    # ── 2. Create tenant for business accounts ────────────────────────────────
    if data.account_type == "business":
        assert data.company_name and data.company_country  # validated by schema
        slug = await _unique_slug(_make_slug(data.company_name), db)
        tenant = Tenant(
            name=data.company_name.strip(),
            country=data.company_country,
            slug=slug,
        )
        db.add(tenant)
        await db.flush()  # get tenant.id

    # ── 3. Create user ────────────────────────────────────────────────────────
    from app.models.auth import AccountType
    user = User(
        email=data.email,
        full_name=data.full_name,
        account_type=AccountType(data.account_type),
    )
    db.add(user)
    await db.flush()  # get user.id

    # ── 4. Create user_tenant (holds password hash) ───────────────────────────
    user_tenant = UserTenant(
        user_id=user.id,
        tenant_id=tenant.id if tenant else None,
        password_hash=hash_password(data.password),
    )
    db.add(user_tenant)
    await db.flush()  # get user_tenant.id

    # ── 5. Assign tenant_admin role for business accounts ─────────────────────
    if tenant:
        role_result = await db.execute(
            select(Role).where(Role.name == "tenant_admin", Role.tenant_id.is_(None))
        )
        role = role_result.scalar_one_or_none()
        if role:
            db.add(UserRole(user_tenant_id=user_tenant.id, role_id=role.id))

        # Seed default top-level expense categories for new tenants (M8).
        from app.models.expenses import ExpenseCategory
        import re as _re

        def _cat_code(name: str) -> str:
            return _re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")

        default_categories = [
            "Travel Cost",
            "Entertainment",
            "Staff Cost",
            "Car Cost",
            "Insurance",
            "Consulting",
            "Other Indirect Costs",
        ]
        for cat_name in default_categories:
            db.add(ExpenseCategory(
                tenant_id=tenant.id,
                name=cat_name,
                code=_cat_code(cat_name),
                sort_order=default_categories.index(cat_name),
            ))

    # ── 6. Session + tokens ───────────────────────────────────────────────────
    session, raw_token, _ = await _create_session_and_tokens(user_tenant, db, request)
    # Business signups always create a tenant_admin — no DB query needed here.
    # New business accounts have only tenant_admin at signup, so has_non_admin_role=False.
    admin_flag = tenant is not None
    access_token = _build_access_token(
        user, user_tenant, session,
        is_tenant_admin=admin_flag,
        has_non_admin_role=False,
    )

    # ── 7. Audit log ──────────────────────────────────────────────────────────
    await _log_event(
        "signup",
        db,
        request,
        user=user,
        tenant_id=tenant.id if tenant else None,
        metadata={"account_type": data.account_type},
    )

    return AuthResponse(
        access_token=access_token,
        refresh_token=raw_token,
        user=UserResponse.from_orm_pair(
            user,
            tenant.id if tenant else None,
            is_tenant_admin=admin_flag,
            has_non_admin_role=False,
        ),
    )


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Email + password login.

    Verifies credentials, checks account lockout, creates a session,
    and returns a fresh access + refresh token pair.
    """
    # ── 1. Resolve user ───────────────────────────────────────────────────────
    user_result = await db.execute(select(User).where(User.email == data.email))
    user: User | None = user_result.scalar_one_or_none()

    if not user or not user.is_active:
        # Return a generic message — don't reveal whether the email exists
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # ── 2. Resolve user_tenant (primary membership for this login) ────────────
    # Individual accounts have tenant_id IS NULL.
    # Business accounts: use the first membership (active or not) — then check
    # is_active to provide a specific deactivation message instead of the
    # generic "invalid credentials" response.
    ut_result = await db.execute(
        select(UserTenant).where(UserTenant.user_id == user.id)
    )
    user_tenant: UserTenant | None = ut_result.scalars().first()

    if not user_tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user_tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Contact your administrator.",
        )

    # ── 3. Lockout check ──────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    if user_tenant.locked_until and user_tenant.locked_until > now:
        remaining = int((user_tenant.locked_until - now).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Account locked. Try again in {remaining} minute(s).",
        )

    # ── 4. Password verification ──────────────────────────────────────────────
    if not verify_password(data.password, user_tenant.password_hash):
        user_tenant.failed_login_attempts += 1
        if user_tenant.failed_login_attempts >= LOCKOUT_THRESHOLD:
            user_tenant.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            user_tenant.failed_login_attempts = 0
            await _log_event("account.locked", db, request, user=user, tenant_id=user_tenant.tenant_id)
        await _log_event("login.failed", db, request, user=user, tenant_id=user_tenant.tenant_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # ── 5. Successful login ───────────────────────────────────────────────────
    user_tenant.failed_login_attempts = 0
    user_tenant.locked_until = None
    user_tenant.last_login_at = now

    session, raw_token, _ = await _create_session_and_tokens(user_tenant, db, request)
    admin_flag = await _is_tenant_admin(user_tenant.id, db)
    non_admin_flag = await _has_non_admin_roles(user_tenant.id, db)
    access_token = _build_access_token(
        user, user_tenant, session,
        is_tenant_admin=admin_flag,
        has_non_admin_role=non_admin_flag,
    )

    await _log_event("login.success", db, request, user=user, tenant_id=user_tenant.tenant_id)

    return AuthResponse(
        access_token=access_token,
        refresh_token=raw_token,
        user=UserResponse.from_orm_pair(
            user, user_tenant.tenant_id,
            is_tenant_admin=admin_flag,
            has_non_admin_role=non_admin_flag,
        ),
    )


# ── Token refresh ─────────────────────────────────────────────────────────────

@router.post("/refresh-token", response_model=AuthResponse)
async def refresh_token(
    data: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Rotate the refresh token and issue a new access token.

    The old refresh token is marked as used and linked to the new one.
    If a token that has already been used is presented (replay attack),
    all sessions for that user_tenant are revoked.
    """
    token_hash = hash_refresh_token(data.refresh_token)

    rt_result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored: RefreshToken | None = rt_result.scalar_one_or_none()

    if not stored or stored.is_revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    now = datetime.now(timezone.utc)

    if stored.expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired.")

    # Replay attack: token was already used — revoke all sessions for this user_tenant
    if stored.used_at is not None:
        session_result = await db.execute(
            select(Session).where(Session.id == stored.session_id)
        )
        compromised_session = session_result.scalar_one_or_none()
        if compromised_session:
            all_sessions = await db.execute(
                select(Session).where(
                    Session.user_tenant_id == compromised_session.user_tenant_id,
                    Session.is_active.is_(True),
                )
            )
            for s in all_sessions.scalars().all():
                s.is_active = False
                s.ended_at = now
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token reuse detected. All sessions revoked for security.",
        )

    # ── Rotate: mark old token used, issue new token ──────────────────────────
    stored.used_at = now

    session_result = await db.execute(
        select(Session).where(Session.id == stored.session_id)
    )
    session: Session | None = session_result.scalar_one_or_none()
    if not session or not session.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session ended.")

    ut_result = await db.execute(
        select(UserTenant).where(UserTenant.id == session.user_tenant_id)
    )
    user_tenant: UserTenant = ut_result.scalar_one()

    user_result = await db.execute(select(User).where(User.id == user_tenant.user_id))
    user: User = user_result.scalar_one()

    from app.config import settings
    new_expires = now + timedelta(days=settings.refresh_token_expire_days)
    raw_new, new_hash = generate_refresh_token()

    new_rt = RefreshToken(
        session_id=session.id,
        token_hash=new_hash,
        expires_at=new_expires,
    )
    db.add(new_rt)
    await db.flush()
    stored.replaced_by_id = new_rt.id

    admin_flag = await _is_tenant_admin(user_tenant.id, db)
    non_admin_flag = await _has_non_admin_roles(user_tenant.id, db)
    access_token = _build_access_token(
        user, user_tenant, session,
        is_tenant_admin=admin_flag,
        has_non_admin_role=non_admin_flag,
    )
    await _log_event("token.refreshed", db, request, user=user, tenant_id=user_tenant.tenant_id)

    return AuthResponse(access_token=access_token, refresh_token=raw_new)


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout", response_model=MessageResponse)
async def logout(
    data: LogoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Revoke the refresh token and mark the session as ended.

    Silent success even if the token is already invalid — prevents
    information leakage about token validity.
    """
    token_hash = hash_refresh_token(data.refresh_token)

    rt_result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored: RefreshToken | None = rt_result.scalar_one_or_none()

    if stored and not stored.is_revoked:
        stored.is_revoked = True
        stored.used_at = datetime.now(timezone.utc)

        session_result = await db.execute(
            select(Session).where(Session.id == stored.session_id)
        )
        session = session_result.scalar_one_or_none()
        if session and session.is_active:
            session.is_active = False
            session.ended_at = datetime.now(timezone.utc)

            ut_result = await db.execute(
                select(UserTenant).where(UserTenant.id == session.user_tenant_id)
            )
            ut = ut_result.scalar_one_or_none()
            if ut:
                user_result = await db.execute(select(User).where(User.id == ut.user_id))
                user = user_result.scalar_one_or_none()
                await _log_event("logout", db, request, user=user, tenant_id=ut.tenant_id)

    return MessageResponse(message="Logged out successfully.")
