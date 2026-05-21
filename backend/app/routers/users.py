"""
ZivaBI — users router (Milestones 2 + 5).

Endpoints:
    GET   /api/users/me              Return current user's full profile
    PATCH /api/users/me              Update own profile (name, employee_code, etc.)
    PATCH /api/users/me/password     Change own password
    GET   /api/users/tenant          List active users in current tenant (approver dropdowns)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import User, UserTenant
from app.schemas.auth import UserResponse
from app.schemas.approvals import TenantUserResponse
from app.schemas.users import PasswordChangeRequest, ProfileUpdateRequest

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Return the full profile of the currently authenticated user.

    is_tenant_admin is read from the JWT (set at login/refresh) so this
    endpoint never needs a role DB query.
    """
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
        )

    return UserResponse.from_orm_pair(
        user,
        current_user.tenant_id,
        is_tenant_admin=current_user.is_tenant_admin,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Update the current user's profile fields.

    Email and password cannot be changed via this endpoint.
    Only the fields present in the request body are updated (partial update).
    """
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.employee_code is not None:
        user.employee_code = data.employee_code.strip() or None
    if data.department is not None:
        user.department = data.department.strip() or None
    if data.job_title is not None:
        user.job_title = data.job_title.strip() or None
    if data.phone is not None:
        user.phone = data.phone.strip() or None

    await db.flush()
    return UserResponse.from_orm_pair(
        user,
        current_user.tenant_id,
        is_tenant_admin=current_user.is_tenant_admin,
    )


@router.patch("/me/password", response_model=dict)
async def change_password(
    data: PasswordChangeRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Change the current user's password.

    Requires the current password to prevent account hijacking via
    an unattended session. Returns a simple success message.
    """
    ut_result = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.user_id,
            UserTenant.id == current_user.user_tenant_id,
        )
    )
    user_tenant: UserTenant | None = ut_result.scalar_one_or_none()
    if not user_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User session not found.")

    if not verify_password(data.current_password, user_tenant.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Current password is incorrect.",
        )

    user_tenant.password_hash = hash_password(data.new_password)
    await db.flush()
    return {"message": "Password updated successfully."}


@router.get("/tenant", response_model=list[TenantUserResponse])
async def list_tenant_users(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[TenantUserResponse]:
    """
    List all active users in the current user's tenant.

    Used to populate approver dropdowns during expense submission.
    Returns id, full_name, email for each active tenant member.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available to business accounts.",
        )

    result = await db.execute(
        select(User)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(
            UserTenant.tenant_id == current_user.tenant_id,
            UserTenant.is_active.is_(True),
            User.is_active.is_(True),
        )
        .order_by(User.full_name)
    )
    users = result.scalars().all()

    return [
        TenantUserResponse(id=str(u.id), full_name=u.full_name, email=u.email)
        for u in users
    ]
