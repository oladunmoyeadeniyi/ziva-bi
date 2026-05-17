"""
ZivaBI — users router.

Endpoints:
    GET /api/users/me   Return the currently authenticated user's profile

Additional user management endpoints (update profile, change password,
deactivate account, list users for Tenant Admin) will be added as milestones
progress. All endpoints require a valid JWT via the require_auth dependency.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.auth import User, UserTenant
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Return the profile of the currently authenticated user.

    Loads the User record from the database using the user_id decoded from
    the JWT. The tenant_id comes from the JWT payload directly (no extra join).
    """
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user: User | None = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
        )

    return UserResponse.from_orm_pair(user, current_user.tenant_id)
