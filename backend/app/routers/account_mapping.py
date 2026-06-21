"""
ZivaBI — Account Mapping router (updated for catalogue redesign).

Prefix:  /api/setup/account-mapping
Tags:    account-mapping

Endpoints:
    GET  /api/setup/account-mapping/roles
        Full catalogue with taxonomy (statement/group/subgroup/display_order),
        effective control flag, and current tenant mapping. Ordered by display_order.

    PUT  /api/setup/account-mapping/{role_key}
        Upsert GL mapping. Validates account_type match. Guard: _require_admin.

    DELETE /api/setup/account-mapping/{role_key}
        Remove GL mapping. Guard: _require_admin.

    PUT  /api/setup/account-mapping/{role_key}/control
        Set or clear the per-tenant control-account override.
        Guard: is_super_admin only (not plain power_admin) — this is a financial
        classification decision that only a Ziva super admin (or impersonating one)
        should be able to make.

account_type validation:
    "BS" → accepted DB values {BS, SOFP}
    "PL" → accepted DB values {PL, SOCI}
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth, block_if_readonly_impersonation
from app.models.account_mapping import (
    PostingRole,
    TenantAccountMapping,
    TenantPostingRoleSettings,
)
from app.models.master_data import ChartOfAccount
from app.schemas.account_mapping import (
    AccountMappingResponse,
    AccountMappingUpsertRequest,
    ControlOverrideRequest,
    PostingRoleResponse,
    RelevanceRequest,
)

router = APIRouter(prefix="/api/setup/account-mapping", tags=["account-mapping"])

_ACCEPTED_TYPES: dict[str, frozenset[str]] = {
    "BS": frozenset({"BS", "SOFP"}),
    "PL": frozenset({"PL", "SOCI"}),
}
_TYPE_LABELS: dict[str, str] = {
    "BS": "Balance Sheet / SOFP",
    "PL": "P&L / SOCI (income statement)",
}


# ── Guards ────────────────────────────────────────────────────────────────────

def _require_admin(current_user: CurrentUser) -> None:
    """is_super_admin OR power_admin. Also blocks read-only impersonation."""
    if not current_user.is_super_admin and current_user.role_tier != "power_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Admin access required.")
    block_if_readonly_impersonation(current_user)


def _require_super_admin(current_user: CurrentUser) -> None:
    """is_super_admin only — used for control-account override."""
    if not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Super admin access required for control-account overrides.")
    block_if_readonly_impersonation(current_user)


def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Tenant context required.")
    return current_user.tenant_id


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[PostingRoleResponse])
async def list_roles(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[PostingRoleResponse]:
    """
    Full posting-role catalogue with taxonomy, effective control flag,
    and current tenant mapping. Ordered by display_order.
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    roles_res = await db.execute(
        select(PostingRole).order_by(PostingRole.display_order)
    )
    roles = roles_res.scalars().all()

    # Batch-load GL mappings
    mappings_res = await db.execute(
        select(TenantAccountMapping, ChartOfAccount)
        .join(ChartOfAccount, TenantAccountMapping.gl_account_id == ChartOfAccount.id)
        .where(TenantAccountMapping.tenant_id == tenant_id)
    )
    mapping_map: dict[str, tuple[TenantAccountMapping, ChartOfAccount]] = {
        row[0].role_key: (row[0], row[1]) for row in mappings_res.all()
    }

    # Batch-load per-tenant settings (control override + relevance)
    settings_res = await db.execute(
        select(TenantPostingRoleSettings).where(
            TenantPostingRoleSettings.tenant_id == tenant_id
        )
    )
    # Keyed by role_key; presence of key means a row exists (even if both fields are NULL)
    settings_by_role: dict[str, TenantPostingRoleSettings] = {
        s.role_key: s for s in settings_res.scalars().all()
    }

    result = []
    for r in roles:
        s = settings_by_role.get(r.role_key)  # None = no row exists

        # Control: override takes precedence when explicitly set (not None)
        ctrl_override: Optional[bool] = s.is_control_account_override if s else None
        ctrl_effective = ctrl_override if ctrl_override is not None else r.is_control_account

        # Relevance: False only when is_relevant is explicitly False; else True
        rel_override: Optional[bool] = s.is_relevant if s else None
        rel_effective = not (rel_override is False)  # True unless explicitly hidden

        m = mapping_map.get(r.role_key)
        result.append(PostingRoleResponse(
            role_key=r.role_key,
            label=r.label,
            statement=r.statement,
            group=r.group,
            subgroup=r.subgroup,
            display_order=r.display_order,
            expected_account_type=r.expected_account_type,
            is_control_account=r.is_control_account,
            is_control_account_override=ctrl_override,
            is_control_account_effective=ctrl_effective,
            is_relevant_override=rel_override,
            is_relevant_effective=rel_effective,
            description=r.description,
            gl_account_id=str(m[0].gl_account_id) if m else None,
            gl_number=m[1].gl_number if m else None,
            gl_name=m[1].gl_name if m else None,
            gl_account_type=m[1].account_type if m else None,
        ))
    return result


@router.put("/{role_key}", response_model=AccountMappingResponse)
async def upsert_mapping(
    role_key: str,
    data: AccountMappingUpsertRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> AccountMappingResponse:
    """Upsert the GL mapping for role_key with account_type validation."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    role_res = await db.execute(select(PostingRole).where(PostingRole.role_key == role_key))
    role = role_res.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Posting role '{role_key}' not found.")

    gl_res = await db.execute(select(ChartOfAccount).where(ChartOfAccount.id == data.gl_account_id))
    gl = gl_res.scalar_one_or_none()
    if gl is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"GL account {data.gl_account_id} does not exist.")
    if gl.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="GL account belongs to a different tenant.")
    if not gl.is_active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"GL account {gl.gl_number} is inactive.")

    if role.expected_account_type:
        accepted = _ACCEPTED_TYPES.get(role.expected_account_type,
                                       frozenset({role.expected_account_type}))
        if gl.account_type not in accepted:
            label = _TYPE_LABELS.get(role.expected_account_type, role.expected_account_type)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(f"Role '{role_key}' requires a {label} account, "
                        f"but '{gl.gl_number}' is '{gl.account_type}'. "
                        f"Accepted: {sorted(accepted)}."),
            )

    existing_res = await db.execute(
        select(TenantAccountMapping).where(
            TenantAccountMapping.tenant_id == tenant_id,
            TenantAccountMapping.role_key == role_key,
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        existing.gl_account_id = data.gl_account_id
        existing.created_by = current_user.user_id
    else:
        db.add(TenantAccountMapping(
            tenant_id=tenant_id, role_key=role_key,
            gl_account_id=data.gl_account_id, created_by=current_user.user_id,
        ))

    await db.flush()
    return AccountMappingResponse(
        role_key=role_key, gl_account_id=str(data.gl_account_id),
        gl_number=gl.gl_number, gl_name=gl.gl_name, account_type=gl.account_type,
    )


@router.delete("/{role_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mapping(
    role_key: str,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove the tenant GL mapping for role_key. 404 if not mapped."""
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    res = await db.execute(
        select(TenantAccountMapping).where(
            TenantAccountMapping.tenant_id == tenant_id,
            TenantAccountMapping.role_key == role_key,
        )
    )
    mapping = res.scalar_one_or_none()
    if mapping is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No mapping for role '{role_key}'.")
    await db.delete(mapping)
    await db.flush()


@router.put("/{role_key}/control", response_model=PostingRoleResponse)
async def set_control_override(
    role_key: str,
    data: ControlOverrideRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PostingRoleResponse:
    """
    Set or clear the per-tenant control-account override for a posting role.

    Guard: super admin only (not plain power_admin). Control-account classification
    is a financial metadata decision that only a Ziva super admin should change.

    body { is_control_account: true | false } → sets override.
    body { is_control_account: null }          → clears override (reverts to catalogue default).
    """
    _require_super_admin(current_user)
    tenant_id = _require_tenant(current_user)

    role_res = await db.execute(select(PostingRole).where(PostingRole.role_key == role_key))
    role = role_res.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Posting role '{role_key}' not found.")

    settings_res = await db.execute(
        select(TenantPostingRoleSettings).where(
            TenantPostingRoleSettings.tenant_id == tenant_id,
            TenantPostingRoleSettings.role_key == role_key,
        )
    )
    settings = settings_res.scalar_one_or_none()

    ctrl_override: Optional[bool] = data.is_control_account

    if settings:
        settings.is_control_account_override = ctrl_override
        # Prune the row only when BOTH fields are null (keeps table clean)
        if ctrl_override is None and settings.is_relevant is None:
            await db.delete(settings)
            settings = None
    else:
        if ctrl_override is not None:
            db.add(TenantPostingRoleSettings(
                tenant_id=tenant_id, role_key=role_key,
                is_control_account_override=ctrl_override,
            ))

    await db.flush()

    ctrl_effective = ctrl_override if ctrl_override is not None else role.is_control_account
    rel_override = settings.is_relevant if settings else None
    rel_effective = not (rel_override is False)

    m_res = await db.execute(
        select(TenantAccountMapping, ChartOfAccount)
        .join(ChartOfAccount, TenantAccountMapping.gl_account_id == ChartOfAccount.id)
        .where(TenantAccountMapping.tenant_id == tenant_id,
               TenantAccountMapping.role_key == role_key)
    )
    m_row = m_res.first()

    return PostingRoleResponse(
        role_key=role.role_key, label=role.label, statement=role.statement,
        group=role.group, subgroup=role.subgroup, display_order=role.display_order,
        expected_account_type=role.expected_account_type,
        is_control_account=role.is_control_account,
        is_control_account_override=ctrl_override,
        is_control_account_effective=ctrl_effective,
        is_relevant_override=rel_override,
        is_relevant_effective=rel_effective,
        description=role.description,
        gl_account_id=str(m_row[0].gl_account_id) if m_row else None,
        gl_number=m_row[1].gl_number if m_row else None,
        gl_name=m_row[1].gl_name if m_row else None,
        gl_account_type=m_row[1].account_type if m_row else None,
    )


@router.put("/{role_key}/relevance", response_model=PostingRoleResponse)
async def set_relevance_override(
    role_key: str,
    data: RelevanceRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> PostingRoleResponse:
    """
    Set or clear the per-tenant relevance flag for a posting role.

    Guard: super admin only — same level as the control override.

    body { is_relevant: false } → hide this role in the setup UI for this tenant.
    body { is_relevant: true }  → explicitly mark as relevant.
    body { is_relevant: null }  → clear override (revert to default: relevant).

    IMPORTANT: relevance is cosmetic for setup UX only. It does NOT block
    resolve_account() or posting. A module that posts to a role will still
    resolve it even when is_relevant_effective is False.
    """
    _require_super_admin(current_user)
    tenant_id = _require_tenant(current_user)

    role_res = await db.execute(select(PostingRole).where(PostingRole.role_key == role_key))
    role = role_res.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Posting role '{role_key}' not found.")

    settings_res = await db.execute(
        select(TenantPostingRoleSettings).where(
            TenantPostingRoleSettings.tenant_id == tenant_id,
            TenantPostingRoleSettings.role_key == role_key,
        )
    )
    settings = settings_res.scalar_one_or_none()

    rel_override: Optional[bool] = data.is_relevant

    if settings:
        settings.is_relevant = rel_override
        # Prune row when BOTH fields are null
        if rel_override is None and settings.is_control_account_override is None:
            await db.delete(settings)
            settings = None
    else:
        if rel_override is not None:
            db.add(TenantPostingRoleSettings(
                tenant_id=tenant_id, role_key=role_key,
                is_relevant=rel_override,
            ))

    await db.flush()

    ctrl_override = settings.is_control_account_override if settings else None
    ctrl_effective = ctrl_override if ctrl_override is not None else role.is_control_account
    rel_effective = not (rel_override is False)

    m_res = await db.execute(
        select(TenantAccountMapping, ChartOfAccount)
        .join(ChartOfAccount, TenantAccountMapping.gl_account_id == ChartOfAccount.id)
        .where(TenantAccountMapping.tenant_id == tenant_id,
               TenantAccountMapping.role_key == role_key)
    )
    m_row = m_res.first()

    return PostingRoleResponse(
        role_key=role.role_key, label=role.label, statement=role.statement,
        group=role.group, subgroup=role.subgroup, display_order=role.display_order,
        expected_account_type=role.expected_account_type,
        is_control_account=role.is_control_account,
        is_control_account_override=ctrl_override,
        is_control_account_effective=ctrl_effective,
        is_relevant_override=rel_override,
        is_relevant_effective=rel_effective,
        description=role.description,
        gl_account_id=str(m_row[0].gl_account_id) if m_row else None,
        gl_number=m_row[1].gl_number if m_row else None,
        gl_name=m_row[1].gl_name if m_row else None,
        gl_account_type=m_row[1].account_type if m_row else None,
    )
