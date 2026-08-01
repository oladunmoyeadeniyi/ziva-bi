"""Router — IxE Inter-Company Eliminations.

Full ERP mode only. Parent tenant manages groups; member tenants
contribute journal data. All endpoints require the calling user to
be an authenticated member of the parent tenant.

Route map:
  POST   /api/consolidation/groups                              — create group
  GET    /api/consolidation/groups                              — list groups
  GET    /api/consolidation/groups/{group_id}                   — get group detail
  PATCH  /api/consolidation/groups/{group_id}                   — update group
  POST   /api/consolidation/groups/{group_id}/members           — add member
  DELETE /api/consolidation/groups/{group_id}/members/{member_id} — remove member
  GET    /api/consolidation/groups/{group_id}/members           — list members
  POST   /api/consolidation/groups/{group_id}/members/{member_id}/ic-mappings  — add IC mapping
  GET    /api/consolidation/groups/{group_id}/ic-mappings       — list IC mappings
  DELETE /api/consolidation/groups/{group_id}/ic-mappings/{mapping_id}          — delete IC mapping
  POST   /api/consolidation/groups/{group_id}/periods/{period_id}/auto-match    — run auto-match
  GET    /api/consolidation/groups/{group_id}/matches           — list IC matches
  PATCH  /api/consolidation/groups/{group_id}/matches/{match_id} — confirm/dispute match
  GET    /api/consolidation/groups/{group_id}/elimination-journals — list journals
  POST   /api/consolidation/groups/{group_id}/elimination-journals — post journal
  POST   /api/consolidation/groups/{group_id}/elimination-journals/{journal_id}/reverse — reverse
  GET    /api/consolidation/groups/{group_id}/periods/{period_id}/trial-balance  — consolidated TB
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth, require_module
from app.models.setup import TenantOrgConfig
from app.schemas.consolidation import (
    ConsolidationGroupCreate,
    ConsolidationGroupResponse,
    ConsolidationGroupUpdate,
    ConsolidationMemberCreate,
    ConsolidationMemberResponse,
    ConsolidatedTrialBalanceResponse,
    EliminationJournalCreate,
    EliminationJournalResponse,
    IcAccountMappingCreate,
    IcAccountMappingResponse,
    IcMatchConfirm,
    IcMatchResponse,
)
from app.services import consolidation_service as svc

async def _require_full_erp(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Raise 403 if the calling tenant is not in Full ERP posting mode.

    IxE is Full ERP only — elimination journals need a live in-app GL
    to consolidate against. Lite and Connected tenants cannot post here.
    Super admins are always exempt (they enter tenant context explicitly).
    """
    if current_user.is_super_admin:
        return
    result = await db.execute(
        select(TenantOrgConfig.posting_mode).where(
            TenantOrgConfig.tenant_id == current_user.tenant_id
        )
    )
    mode = result.scalar_one_or_none()
    if mode != "full_erp":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inter-Company Eliminations requires Full ERP mode.",
        )


router = APIRouter(
    prefix="/api/consolidation",
    tags=["consolidation"],
    dependencies=[Depends(require_module("ixe")), Depends(_require_full_erp)],
)


# ── Groups ────────────────────────────────────────────────────────────────────

@router.post("/groups", response_model=ConsolidationGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: ConsolidationGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ConsolidationGroupResponse:
    """Create a new consolidation group (Full ERP parent tenant only)."""
    group = await svc.create_group(db, current_user.tenant_id, payload)
    await db.commit()
    response = ConsolidationGroupResponse.model_validate(group)
    response.member_count = 0
    return response


@router.get("/groups", response_model=list[ConsolidationGroupResponse])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[ConsolidationGroupResponse]:
    """List all consolidation groups for the current tenant."""
    groups = await svc.list_groups(db, current_user.tenant_id)
    result = []
    for g in groups:
        resp = ConsolidationGroupResponse.model_validate(g)
        resp.member_count = len([m for m in g.members if m.left_at is None])
        result.append(resp)
    return result


@router.get("/groups/{group_id}", response_model=ConsolidationGroupResponse)
async def get_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ConsolidationGroupResponse:
    """Get a single consolidation group by ID."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    resp = ConsolidationGroupResponse.model_validate(group)
    resp.member_count = len([m for m in group.members if m.left_at is None])
    return resp


@router.patch("/groups/{group_id}", response_model=ConsolidationGroupResponse)
async def update_group(
    group_id: uuid.UUID,
    payload: ConsolidationGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ConsolidationGroupResponse:
    """Update a consolidation group's settings."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    group = await svc.update_group(db, group, payload)
    await db.commit()
    resp = ConsolidationGroupResponse.model_validate(group)
    resp.member_count = len([m for m in group.members if m.left_at is None])
    return resp


# ── Members ───────────────────────────────────────────────────────────────────

@router.post("/groups/{group_id}/members", response_model=ConsolidationMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: uuid.UUID,
    payload: ConsolidationMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ConsolidationMemberResponse:
    """Add a member entity to a consolidation group."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    try:
        member = await svc.add_member(db, group, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return ConsolidationMemberResponse.model_validate(member)


@router.get("/groups/{group_id}/members", response_model=list[ConsolidationMemberResponse])
async def list_members(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[ConsolidationMemberResponse]:
    """List all members of a consolidation group."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    return [ConsolidationMemberResponse.model_validate(m) for m in group.members]


@router.delete("/groups/{group_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: uuid.UUID,
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> None:
    """Soft-remove a member from a consolidation group."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    member = await svc.remove_member(db, group_id, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.commit()


# ── IC Account Mappings ───────────────────────────────────────────────────────

@router.post(
    "/groups/{group_id}/members/{member_tenant_id}/ic-mappings",
    response_model=IcAccountMappingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_ic_mapping(
    group_id: uuid.UUID,
    member_tenant_id: uuid.UUID,
    payload: IcAccountMappingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> IcAccountMappingResponse:
    """Tag a GL account with an IC role for a group member."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    mapping = await svc.add_ic_mapping(db, group_id, member_tenant_id, payload)
    await db.commit()
    return IcAccountMappingResponse.model_validate(mapping)


@router.get("/groups/{group_id}/ic-mappings", response_model=list[IcAccountMappingResponse])
async def list_ic_mappings(
    group_id: uuid.UUID,
    member_tenant_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[IcAccountMappingResponse]:
    """List IC account mappings for a group."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    mappings = await svc.list_ic_mappings(db, group_id, member_tenant_id)
    return [IcAccountMappingResponse.model_validate(m) for m in mappings]


@router.delete("/groups/{group_id}/ic-mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ic_mapping(
    group_id: uuid.UUID,
    mapping_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> None:
    """Delete an IC account mapping."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    deleted = await svc.delete_ic_mapping(db, mapping_id, group_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="IC mapping not found")
    await db.commit()


# ── Auto-matching ─────────────────────────────────────────────────────────────

@router.post(
    "/groups/{group_id}/periods/{period_id}/auto-match",
    response_model=list[IcMatchResponse],
    status_code=status.HTTP_201_CREATED,
)
async def run_auto_match(
    group_id: uuid.UUID,
    period_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[IcMatchResponse]:
    """Run IC auto-matching for a period. Returns newly proposed matches."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    matches = await svc.run_auto_match(db, group, period_id)
    await db.commit()
    return [IcMatchResponse.model_validate(m) for m in matches]


@router.get("/groups/{group_id}/matches", response_model=list[IcMatchResponse])
async def list_matches(
    group_id: uuid.UUID,
    period_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[IcMatchResponse]:
    """List IC matches for a group, optionally filtered by period and status."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    matches = await svc.list_matches(db, group_id, period_id, status)
    return [IcMatchResponse.model_validate(m) for m in matches]


@router.patch("/groups/{group_id}/matches/{match_id}", response_model=IcMatchResponse)
async def confirm_match(
    group_id: uuid.UUID,
    match_id: uuid.UUID,
    payload: IcMatchConfirm,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> IcMatchResponse:
    """Confirm or dispute a proposed IC match."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    match = await svc.confirm_match(db, match_id, group_id, current_user.user_id, payload)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found or not in PROPOSED status")
    await db.commit()
    return IcMatchResponse.model_validate(match)


# ── Elimination journals ──────────────────────────────────────────────────────

@router.get("/groups/{group_id}/elimination-journals", response_model=list[EliminationJournalResponse])
async def list_elimination_journals(
    group_id: uuid.UUID,
    period_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> list[EliminationJournalResponse]:
    """List elimination journals for a group."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    journals = await svc.list_elimination_journals(db, group_id, period_id)
    return [EliminationJournalResponse.model_validate(j) for j in journals]


@router.post(
    "/groups/{group_id}/elimination-journals",
    response_model=EliminationJournalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_elimination_journal(
    group_id: uuid.UUID,
    payload: EliminationJournalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> EliminationJournalResponse:
    """Post a new elimination journal."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    try:
        journal = await svc.post_elimination_journal(db, group_id, current_user.user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    await db.commit()
    return EliminationJournalResponse.model_validate(journal)


@router.post(
    "/groups/{group_id}/elimination-journals/{journal_id}/reverse",
    response_model=EliminationJournalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def reverse_elimination_journal(
    group_id: uuid.UUID,
    journal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> EliminationJournalResponse:
    """Reverse an elimination journal."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    result = await svc.reverse_elimination_journal(db, journal_id, group_id, current_user.user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Journal not found or already reversed")
    await db.commit()
    _, reversal = result
    return EliminationJournalResponse.model_validate(reversal)


# ── Consolidated trial balance ────────────────────────────────────────────────

@router.get(
    "/groups/{group_id}/periods/{period_id}/trial-balance",
    response_model=ConsolidatedTrialBalanceResponse,
)
async def consolidated_trial_balance(
    group_id: uuid.UUID,
    period_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_auth),
) -> ConsolidatedTrialBalanceResponse:
    """Get the consolidated trial balance for a group and period."""
    group = await svc.get_group(db, group_id, current_user.tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Consolidation group not found")
    data = await svc.consolidated_trial_balance(db, group, period_id)
    return ConsolidatedTrialBalanceResponse(**data)
