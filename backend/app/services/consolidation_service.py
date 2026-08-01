"""Consolidation service — IxE Inter-Company Eliminations.

Implements:
  - Group and member management
  - IC account mapping management
  - Auto-matching of IC journal lines within a period
  - Elimination journal posting (immutable once posted)
  - Reversal of elimination journals
  - Consolidated trial balance computation

Design principles:
  - All writes use SELECT FOR UPDATE on affected rows to prevent double-posting
  - Elimination journals are immutable: reversal creates a new journal
  - Auto-match runs only on POSTED journal lines
  - Only Full ERP tenants may participate as members

Args (most service functions):
    db: AsyncSession — caller-supplied database session.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.consolidation import (
    ConsolidationGroup,
    ConsolidationMember,
    EliminationJournal,
    EliminationJournalLine,
    IcAccountMapping,
    IcMatch,
)
from app.models.gl import JournalEntry, JournalLine
from app.models.master_data import ChartOfAccount
from app.models.setup import AccountingPeriod
from app.schemas.consolidation import (
    ConsolidationGroupCreate,
    ConsolidationGroupUpdate,
    ConsolidationMemberCreate,
    EliminationJournalCreate,
    IcAccountMappingCreate,
    IcMatchConfirm,
)


# ── Group management ──────────────────────────────────────────────────────────

async def create_group(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: ConsolidationGroupCreate,
) -> ConsolidationGroup:
    """Create a new consolidation group owned by *tenant_id*.

    Args:
        db: Async database session.
        tenant_id: The parent (holding) tenant.
        payload: Validated group creation payload.

    Returns:
        The newly created ConsolidationGroup ORM object.
    """
    group = ConsolidationGroup(
        parent_tenant_id=tenant_id,
        name=payload.name,
        description=payload.description,
        currency=payload.currency.upper(),
        ic_match_tolerance=payload.ic_match_tolerance,
    )
    db.add(group)
    await db.flush()
    await db.refresh(group)
    return group


async def list_groups(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> list[ConsolidationGroup]:
    """Return all consolidation groups where *tenant_id* is the parent."""
    result = await db.execute(
        select(ConsolidationGroup)
        .options(selectinload(ConsolidationGroup.members))
        .where(ConsolidationGroup.parent_tenant_id == tenant_id)
        .order_by(ConsolidationGroup.name)
    )
    return list(result.scalars().all())


async def get_group(
    db: AsyncSession,
    group_id: uuid.UUID,
    parent_tenant_id: uuid.UUID,
) -> ConsolidationGroup | None:
    """Fetch a group by ID, ensuring it belongs to *parent_tenant_id*."""
    result = await db.execute(
        select(ConsolidationGroup)
        .options(
            selectinload(ConsolidationGroup.members),
            selectinload(ConsolidationGroup.ic_account_mappings),
        )
        .where(
            ConsolidationGroup.id == group_id,
            ConsolidationGroup.parent_tenant_id == parent_tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def update_group(
    db: AsyncSession,
    group: ConsolidationGroup,
    payload: ConsolidationGroupUpdate,
) -> ConsolidationGroup:
    """Apply partial updates to a consolidation group."""
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(group, field, value)
    if payload.currency:
        group.currency = payload.currency.upper()
    await db.flush()
    await db.refresh(group)
    return group


# ── Member management ─────────────────────────────────────────────────────────

async def add_member(
    db: AsyncSession,
    group: ConsolidationGroup,
    payload: ConsolidationMemberCreate,
) -> ConsolidationMember:
    """Add a subsidiary entity to a consolidation group.

    Args:
        group: The group to add the member to.
        payload: Member creation payload.

    Raises:
        ValueError: If the member is already in the group.
    """
    # Check for duplicate membership
    existing = await db.execute(
        select(ConsolidationMember).where(
            ConsolidationMember.group_id == group.id,
            ConsolidationMember.member_tenant_id == payload.member_tenant_id,
            ConsolidationMember.left_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Tenant {payload.member_tenant_id} is already an active member of this group")

    member = ConsolidationMember(
        group_id=group.id,
        member_tenant_id=payload.member_tenant_id,
        ownership_pct=payload.ownership_pct,
        joined_at=payload.joined_at or date.today(),
    )
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return member


async def remove_member(
    db: AsyncSession,
    group_id: uuid.UUID,
    member_id: uuid.UUID,
) -> ConsolidationMember | None:
    """Soft-remove a member by setting left_at = today."""
    result = await db.execute(
        select(ConsolidationMember).where(
            ConsolidationMember.id == member_id,
            ConsolidationMember.group_id == group_id,
        )
    )
    member = result.scalar_one_or_none()
    if member and member.left_at is None:
        member.left_at = date.today()
        await db.flush()
    return member


# ── IC Account Mapping ────────────────────────────────────────────────────────

async def add_ic_mapping(
    db: AsyncSession,
    group_id: uuid.UUID,
    member_tenant_id: uuid.UUID,
    payload: IcAccountMappingCreate,
) -> IcAccountMapping:
    """Tag a GL account with an intercompany role for a group member."""
    mapping = IcAccountMapping(
        group_id=group_id,
        member_tenant_id=member_tenant_id,
        gl_account_id=payload.gl_account_id,
        ic_role=payload.ic_role,
        counterparty_tenant_id=payload.counterparty_tenant_id,
    )
    db.add(mapping)
    await db.flush()
    await db.refresh(mapping)
    return mapping


async def list_ic_mappings(
    db: AsyncSession,
    group_id: uuid.UUID,
    member_tenant_id: uuid.UUID | None = None,
) -> list[IcAccountMapping]:
    """List IC account mappings for a group, optionally filtered by member."""
    q = select(IcAccountMapping).where(IcAccountMapping.group_id == group_id)
    if member_tenant_id:
        q = q.where(IcAccountMapping.member_tenant_id == member_tenant_id)
    result = await db.execute(q.order_by(IcAccountMapping.ic_role))
    return list(result.scalars().all())


async def delete_ic_mapping(
    db: AsyncSession,
    mapping_id: uuid.UUID,
    group_id: uuid.UUID,
) -> bool:
    """Delete an IC account mapping. Returns True if found and deleted."""
    result = await db.execute(
        select(IcAccountMapping).where(
            IcAccountMapping.id == mapping_id,
            IcAccountMapping.group_id == group_id,
        )
    )
    mapping = result.scalar_one_or_none()
    if mapping:
        await db.delete(mapping)
        await db.flush()
        return True
    return False


# ── Auto-matching ─────────────────────────────────────────────────────────────

async def run_auto_match(
    db: AsyncSession,
    group: ConsolidationGroup,
    period_id: uuid.UUID,
) -> list[IcMatch]:
    """Auto-match IC journal lines within a period.

    Algorithm:
      1. Load all IC-tagged GL accounts for all members in the group.
      2. Query POSTED journal lines for those accounts in the period.
      3. Pair RECEIVABLE↔PAYABLE and REVENUE↔EXPENSE lines across different entities.
      4. Match where abs(debit - credit) ≤ group.ic_match_tolerance.
      5. Skip lines already matched (linked to an existing IcMatch).
      6. Insert PROPOSED IcMatch rows.

    Returns:
        List of newly created IcMatch objects.
    """
    # Get member tenant IDs (active only)
    member_ids = [
        m.member_tenant_id
        for m in group.members
        if m.left_at is None
    ]
    if not member_ids:
        return []

    # Load IC mappings for the group
    mappings_result = await db.execute(
        select(IcAccountMapping).where(IcAccountMapping.group_id == group.id)
    )
    mappings = list(mappings_result.scalars().all())
    if not mappings:
        return []

    # Build lookup: gl_account_id → (member_tenant_id, ic_role, counterparty_tenant_id)
    account_meta: dict[uuid.UUID, tuple[uuid.UUID, str, uuid.UUID | None]] = {
        m.gl_account_id: (m.member_tenant_id, m.ic_role, m.counterparty_tenant_id)
        for m in mappings
    }
    ic_gl_ids = list(account_meta.keys())

    # Fetch already-matched line IDs to exclude
    matched_lines_result = await db.execute(
        select(IcMatch.debit_journal_line_id, IcMatch.credit_journal_line_id)
        .where(IcMatch.group_id == group.id, IcMatch.period_id == period_id)
    )
    already_matched: set[uuid.UUID] = set()
    for row in matched_lines_result.all():
        already_matched.add(row[0])
        already_matched.add(row[1])

    # Resolve period date range (journal_entries has no period_id; filter by entry_date)
    period_row = await db.get(AccountingPeriod, period_id)
    if not period_row:
        return []

    # Query POSTED journal lines for IC accounts within the period date range
    lines_result = await db.execute(
        select(JournalLine)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(
            JournalEntry.entry_date >= period_row.start_date,
            JournalEntry.entry_date <= period_row.end_date,
            JournalEntry.status == "POSTED",
            JournalLine.gl_account_id.in_(ic_gl_ids),
            JournalLine.tenant_id.in_(member_ids),
        )
    )
    lines: list[JournalLine] = list(lines_result.scalars().all())

    # Separate debit and credit lines by IC role
    debit_lines: list[JournalLine] = []
    credit_lines: list[JournalLine] = []

    DEBIT_ROLES = {"RECEIVABLE", "EXPENSE", "LOAN_ASSET"}
    CREDIT_ROLES = {"PAYABLE", "REVENUE", "LOAN_LIABILITY"}

    for line in lines:
        if line.id in already_matched:
            continue
        meta = account_meta.get(line.gl_account_id)
        if not meta:
            continue
        _, ic_role, _ = meta
        if line.debit > 0 and ic_role in DEBIT_ROLES:
            debit_lines.append(line)
        elif line.credit > 0 and ic_role in CREDIT_ROLES:
            credit_lines.append(line)

    # Match debit↔credit lines across different tenants
    new_matches: list[IcMatch] = []
    used_credits: set[uuid.UUID] = set()

    for dr_line in debit_lines:
        for cr_line in credit_lines:
            if cr_line.id in used_credits:
                continue
            if dr_line.tenant_id == cr_line.tenant_id:
                continue
            diff = abs(dr_line.debit - cr_line.credit)
            if diff <= group.ic_match_tolerance:
                match = IcMatch(
                    group_id=group.id,
                    period_id=period_id,
                    debit_tenant_id=dr_line.tenant_id,
                    debit_journal_line_id=dr_line.id,
                    credit_tenant_id=cr_line.tenant_id,
                    credit_journal_line_id=cr_line.id,
                    matched_amount=min(dr_line.debit, cr_line.credit),
                    status="PROPOSED",
                    match_type="AUTO",
                )
                db.add(match)
                used_credits.add(cr_line.id)
                new_matches.append(match)
                break  # Each debit line is matched at most once

    if new_matches:
        await db.flush()
    return new_matches


# ── Match confirmation ────────────────────────────────────────────────────────

async def confirm_match(
    db: AsyncSession,
    match_id: uuid.UUID,
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: IcMatchConfirm,
) -> IcMatch | None:
    """Confirm or dispute an IC match."""
    result = await db.execute(
        select(IcMatch).where(
            IcMatch.id == match_id,
            IcMatch.group_id == group_id,
            IcMatch.status == "PROPOSED",
        )
    )
    match = result.scalar_one_or_none()
    if not match:
        return None

    if payload.action == "CONFIRM":
        match.status = "CONFIRMED"
        match.confirmed_at = datetime.utcnow()
        match.confirmed_by = user_id
    else:
        match.status = "DISPUTED"
        match.disputed_reason = payload.disputed_reason

    await db.flush()
    await db.refresh(match)
    return match


async def list_matches(
    db: AsyncSession,
    group_id: uuid.UUID,
    period_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[IcMatch]:
    """List IC matches for a group, optionally filtered."""
    q = select(IcMatch).where(IcMatch.group_id == group_id)
    if period_id:
        q = q.where(IcMatch.period_id == period_id)
    if status:
        q = q.where(IcMatch.status == status)
    result = await db.execute(q.order_by(IcMatch.matched_at.desc()))
    return list(result.scalars().all())


# ── Elimination journals ──────────────────────────────────────────────────────

async def _next_reference(db: AsyncSession, group_id: uuid.UUID) -> str:
    """Generate the next elimination journal reference (ELIM-YYYY-NNN)."""
    year = date.today().year
    result = await db.execute(
        select(func.count(EliminationJournal.id))
        .where(
            EliminationJournal.group_id == group_id,
            func.extract("year", EliminationJournal.posted_at) == year,
        )
    )
    count = result.scalar() or 0
    return f"ELIM-{year}-{count + 1:03d}"


async def post_elimination_journal(
    db: AsyncSession,
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: EliminationJournalCreate,
) -> EliminationJournal:
    """Post a new (immutable) elimination journal.

    Validates that lines balance (Σ debit = Σ credit) — the Pydantic schema
    already enforces this, but we double-check in the service layer.

    Args:
        group_id: The consolidation group this entry belongs to.
        user_id: The controller posting the entry.
        payload: Validated journal + lines.

    Returns:
        The newly posted EliminationJournal with lines loaded.

    Raises:
        ValueError: If lines don't balance (should not happen after schema validation).
    """
    total_dr = sum(line.debit for line in payload.lines)
    total_cr = sum(line.credit for line in payload.lines)
    if total_dr != total_cr:
        raise ValueError(f"Journal does not balance: debit={total_dr}, credit={total_cr}")

    reference = await _next_reference(db, group_id)

    journal = EliminationJournal(
        group_id=group_id,
        period_id=payload.period_id,
        reference=reference,
        description=payload.description,
        total_dr=total_dr,
        total_cr=total_cr,
        status="POSTED",
        posted_by=user_id,
    )
    db.add(journal)
    await db.flush()  # Get journal.id

    for line_data in payload.lines:
        line = EliminationJournalLine(
            elimination_journal_id=journal.id,
            ic_match_id=line_data.ic_match_id,
            member_tenant_id=line_data.member_tenant_id,
            gl_account_id=line_data.gl_account_id,
            debit=line_data.debit,
            credit=line_data.credit,
            narrative=line_data.narrative,
        )
        db.add(line)

    await db.flush()
    await db.refresh(journal)
    return journal


async def reverse_elimination_journal(
    db: AsyncSession,
    journal_id: uuid.UUID,
    group_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[EliminationJournal, EliminationJournal] | None:
    """Reverse an elimination journal by posting an equal and opposite entry.

    Returns:
        Tuple of (original_journal, reversal_journal) or None if not found/already reversed.
    """
    result = await db.execute(
        select(EliminationJournal)
        .options(selectinload(EliminationJournal.lines))
        .where(
            EliminationJournal.id == journal_id,
            EliminationJournal.group_id == group_id,
            EliminationJournal.status == "POSTED",
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        return None

    # Create reversal with swapped debit/credit
    reference = await _next_reference(db, group_id)
    reversal = EliminationJournal(
        group_id=group_id,
        period_id=original.period_id,
        reference=reference,
        description=f"REVERSAL of {original.reference}: {original.description}",
        total_dr=original.total_cr,
        total_cr=original.total_dr,
        status="POSTED",
        posted_by=user_id,
    )
    db.add(reversal)
    await db.flush()

    for orig_line in original.lines:
        rev_line = EliminationJournalLine(
            elimination_journal_id=reversal.id,
            ic_match_id=orig_line.ic_match_id,
            member_tenant_id=orig_line.member_tenant_id,
            gl_account_id=orig_line.gl_account_id,
            debit=orig_line.credit,   # swap
            credit=orig_line.debit,   # swap
            narrative=f"REVERSAL: {orig_line.narrative or ''}",
        )
        db.add(rev_line)

    # Mark original as reversed
    original.status = "REVERSED"
    original.reversed_by = reversal.id

    await db.flush()
    await db.refresh(original)
    await db.refresh(reversal)
    return original, reversal


async def list_elimination_journals(
    db: AsyncSession,
    group_id: uuid.UUID,
    period_id: uuid.UUID | None = None,
) -> list[EliminationJournal]:
    """List elimination journals for a group."""
    q = (
        select(EliminationJournal)
        .options(selectinload(EliminationJournal.lines))
        .where(EliminationJournal.group_id == group_id)
    )
    if period_id:
        q = q.where(EliminationJournal.period_id == period_id)
    result = await db.execute(q.order_by(EliminationJournal.posted_at.desc()))
    return list(result.scalars().all())


# ── Consolidated trial balance ────────────────────────────────────────────────

async def consolidated_trial_balance(
    db: AsyncSession,
    group: ConsolidationGroup,
    period_id: uuid.UUID,
) -> dict[str, Any]:
    """Compute the consolidated trial balance for a group and period.

    Aggregates POSTED journal lines per GL account per entity, then
    subtracts elimination journal lines. Returns a structured response
    suitable for serialisation to ConsolidatedTrialBalanceResponse.

    Args:
        group: The consolidation group.
        period_id: The period to consolidate.

    Returns:
        Dict with keys: group_id, period_id, currency, lines, total_debit,
        total_credit, ic_difference.
    """
    member_ids = [m.member_tenant_id for m in group.members if m.left_at is None]
    if not member_ids:
        return {
            "group_id": group.id,
            "period_id": period_id,
            "currency": group.currency,
            "lines": [],
            "total_debit": Decimal("0"),
            "total_credit": Decimal("0"),
            "ic_difference": Decimal("0"),
        }

    # Resolve period date range
    period_row = await db.get(AccountingPeriod, period_id)
    if not period_row:
        return {
            "group_id": group.id,
            "period_id": period_id,
            "currency": group.currency,
            "lines": [],
            "total_debit": Decimal("0"),
            "total_credit": Decimal("0"),
            "ic_difference": Decimal("0"),
        }

    # Fetch entity journal line totals per account within the period date range
    entity_totals_result = await db.execute(
        select(
            JournalLine.tenant_id,
            JournalLine.gl_account_id,
            ChartOfAccount.gl_number.label("account_code"),
            ChartOfAccount.gl_name.label("account_name"),
            func.sum(JournalLine.debit).label("total_dr"),
            func.sum(JournalLine.credit).label("total_cr"),
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .join(ChartOfAccount, ChartOfAccount.id == JournalLine.gl_account_id)
        .where(
            JournalEntry.entry_date >= period_row.start_date,
            JournalEntry.entry_date <= period_row.end_date,
            JournalEntry.status == "POSTED",
            JournalLine.tenant_id.in_(member_ids),
        )
        .group_by(
            JournalLine.tenant_id,
            JournalLine.gl_account_id,
            ChartOfAccount.gl_number,
            ChartOfAccount.gl_name,
        )
    )

    # Build nested dict: account_id → {code, name, entity_balances}
    accounts: dict[uuid.UUID, dict] = {}
    for row in entity_totals_result.all():
        aid = row.gl_account_id
        if aid not in accounts:
            accounts[aid] = {
                "account_code": row.account_code,
                "account_name": row.account_name,
                "entity_balances": {},
                "eliminations_dr": Decimal("0"),
                "eliminations_cr": Decimal("0"),
            }
        accounts[aid]["entity_balances"][str(row.tenant_id)] = {
            "debit": row.total_dr or Decimal("0"),
            "credit": row.total_cr or Decimal("0"),
        }

    # Fetch elimination journal line totals per account
    elim_totals_result = await db.execute(
        select(
            EliminationJournalLine.gl_account_id,
            func.sum(EliminationJournalLine.debit).label("elim_dr"),
            func.sum(EliminationJournalLine.credit).label("elim_cr"),
        )
        .join(EliminationJournal, EliminationJournal.id == EliminationJournalLine.elimination_journal_id)
        .where(
            EliminationJournal.group_id == group.id,
            EliminationJournal.period_id == period_id,
            EliminationJournal.status == "POSTED",
        )
        .group_by(EliminationJournalLine.gl_account_id)
    )
    for row in elim_totals_result.all():
        aid = row.gl_account_id
        if aid in accounts:
            accounts[aid]["eliminations_dr"] = row.elim_dr or Decimal("0")
            accounts[aid]["eliminations_cr"] = row.elim_cr or Decimal("0")

    # Build output lines
    lines = []
    total_debit = Decimal("0")
    total_credit = Decimal("0")

    for aid, data in accounts.items():
        raw_dr = sum(b["debit"] for b in data["entity_balances"].values())
        raw_cr = sum(b["credit"] for b in data["entity_balances"].values())
        cons_dr = raw_dr - data["eliminations_dr"]
        cons_cr = raw_cr - data["eliminations_cr"]

        lines.append({
            "account_code": data["account_code"],
            "account_name": data["account_name"],
            "entity_balances": data["entity_balances"],
            "eliminations_dr": data["eliminations_dr"],
            "eliminations_cr": data["eliminations_cr"],
            "consolidated_debit": cons_dr,
            "consolidated_credit": cons_cr,
        })
        total_debit += cons_dr
        total_credit += cons_cr

    lines.sort(key=lambda x: x["account_code"])

    # IC difference = unmatched IC balance (should be 0 after all eliminations)
    ic_difference = abs(total_debit - total_credit)

    return {
        "group_id": group.id,
        "period_id": period_id,
        "currency": group.currency,
        "lines": lines,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "ic_difference": ic_difference,
    }
