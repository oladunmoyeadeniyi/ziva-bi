"""
ZivaBI — Account Determination resolver service.

Modules call resolve_account() (or resolve_many()) before building journal lines.
The resolver looks up the tenant's TenantAccountMapping for the requested role and
returns the gl_account_id. If the role is unmapped, it raises AccountMappingError
with a clear, actionable message.

Separation of concerns:
    - This service resolves role → gl_account_id.
    - gl_posting.post_journal() then validates the UUID against the CoA and posts.
    - The two layers are deliberately independent: posting could be called directly
      with a known UUID; determination is the "find the right account" layer.

Single mapping per role (v1):
    One GL account per (tenant, role_key). Per-expense-type or per-dimension overrides
    are FUTURE — noted here so the caller knows where to add discriminator params.
"""

import uuid
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_mapping import TenantAccountMapping
from app.models.master_data import ChartOfAccount


# ── Domain exception ──────────────────────────────────────────────────────────

class AccountMappingError(Exception):
    """
    Raised when a required posting role has no configured GL mapping for the tenant.

    role_keys: the role(s) that are unmapped.
    message:   actionable human-readable description for API surfaces.
    """

    def __init__(self, role_keys: list[str] | str) -> None:
        if isinstance(role_keys, str):
            role_keys = [role_keys]
        self.role_keys = role_keys
        keys_str = ", ".join(f"'{k}'" for k in role_keys)
        super().__init__(
            f"Posting role(s) {keys_str} are not mapped for this tenant. "
            "Configure them in Setup -> Account Mapping before posting."
        )

    @property
    def message(self) -> str:
        return str(self)


# ── Resolver ──────────────────────────────────────────────────────────────────

async def resolve_account(
    db: AsyncSession,
    tenant_id: UUID,
    role_key: str,
) -> UUID:
    """
    Resolve a posting role to its mapped GL account UUID for this tenant.

    Parameters:
        db        — async session (read-only; no writes).
        tenant_id — the tenant to scope the lookup to.
        role_key  — e.g. "employee_payable", "output_vat".

    Returns:
        The mapped gl_account_id (UUID).

    Raises:
        AccountMappingError if the role is unmapped OR the mapped GL has been
        deactivated / removed from this tenant's CoA.
    """
    mapping_result = await db.execute(
        select(TenantAccountMapping).where(
            TenantAccountMapping.tenant_id == tenant_id,
            TenantAccountMapping.role_key == role_key,
        )
    )
    mapping: Optional[TenantAccountMapping] = mapping_result.scalar_one_or_none()

    if mapping is None:
        raise AccountMappingError(role_key)

    # Verify the mapped GL still exists, is active, and belongs to this tenant.
    gl_result = await db.execute(
        select(ChartOfAccount).where(
            ChartOfAccount.id == mapping.gl_account_id,
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.is_active.is_(True),
        )
    )
    if gl_result.scalar_one_or_none() is None:
        raise AccountMappingError(role_key)

    return mapping.gl_account_id


async def resolve_many(
    db: AsyncSession,
    tenant_id: UUID,
    role_keys: list[str],
) -> dict[str, UUID]:
    """
    Resolve multiple posting roles in a single round-trip.

    Returns a dict {role_key: gl_account_id} for all requested roles.
    If ANY role is unmapped or its GL is inactive, raises AccountMappingError
    naming ALL missing roles so the caller can surface them in one message.

    # FUTURE: add a discriminator (e.g. expense_category_id, cost_center_id) for
    # per-type or per-dimension override resolution.
    """
    if not role_keys:
        return {}

    # Batch-load all mappings for these roles
    mappings_result = await db.execute(
        select(TenantAccountMapping).where(
            TenantAccountMapping.tenant_id == tenant_id,
            TenantAccountMapping.role_key.in_(role_keys),
        )
    )
    mappings: dict[str, TenantAccountMapping] = {
        m.role_key: m for m in mappings_result.scalars().all()
    }

    # Batch-load GL accounts for mapped roles
    mapped_gl_ids = [m.gl_account_id for m in mappings.values()]
    gl_map: dict[UUID, ChartOfAccount] = {}
    if mapped_gl_ids:
        gl_result = await db.execute(
            select(ChartOfAccount).where(
                ChartOfAccount.id.in_(mapped_gl_ids),
                ChartOfAccount.tenant_id == tenant_id,
                ChartOfAccount.is_active.is_(True),
            )
        )
        gl_map = {gl.id: gl for gl in gl_result.scalars().all()}

    # Collect resolutions and failures
    resolved: dict[str, UUID] = {}
    missing: list[str] = []

    for role_key in role_keys:
        mapping = mappings.get(role_key)
        if mapping is None or mapping.gl_account_id not in gl_map:
            missing.append(role_key)
        else:
            resolved[role_key] = mapping.gl_account_id

    if missing:
        raise AccountMappingError(missing)

    return resolved
