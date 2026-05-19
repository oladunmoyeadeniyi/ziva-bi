"""
ZivaBI — users router.

Endpoints:
    GET /api/users/me       Return the currently authenticated user's profile
    GET /api/users/tenant   List all active users in the current user's tenant
                            (used for approver dropdowns in M4 approval flow)

All endpoints require a valid JWT via the require_auth dependency.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import User, UserTenant
from app.schemas.auth import UserResponse
from app.schemas.approvals import TenantUserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Return the profile of the currently authenticated user.

    Loads the User record from the database using the user_id decoded from
    the JWT. is_tenant_admin is read directly from the JWT payload (set at login).
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


@router.get("/tenant", response_model=list[TenantUserResponse])
async def list_tenant_users(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[TenantUserResponse]:
    """
    List all active users in the current user's tenant.

    Used by the frontend to populate approver selection dropdowns during
    expense report submission. Returns id, full_name, email for each user.
    Only available to business-tier accounts.
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
