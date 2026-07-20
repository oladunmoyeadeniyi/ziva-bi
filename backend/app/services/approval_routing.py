"""
ZivaBI — Approval Routing Engine.

Computes the ordered approval chain for a given submission (expense report, AP invoice, etc.)
based on the tenant's ApprovalPolicy for that module. Returns a list of ChainStep objects
that the submit endpoint converts into ExpenseApproval records.

Routing modes:
    org_tree          — walk employee.line_manager_id upward; thresholds determine how far.
    selective_tree    — same traversal as org_tree but only designation levels listed in
                        policy.selected_designations participate; others are skipped.
    requestor_selects — caller provides approver_id; engine validates they are above in hierarchy.
    direct_to_hod     — route straight to the head of the submitter's org structure node.

Finance chain always appended after the management chain when policy.finance_levels > 0.

Delegation resolution: for every step in the chain, if the approver has an active delegation,
the delegate is substituted. The original approver ID is stored in delegated_from_id for the
audit trail.

Vacant seat handling: when a step's approver cannot be resolved to an active user:
    skip                  — omit that step; continue up the chain.
    hold                  — raise ApprovalChainHoldError; caller should pause the submission.
    escalate_to_fallback  — use policy.fallback_approver_id; if none configured, raise an error.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import User, UserTenant
from app.models.master_data import Employee
from app.models.approvals import (
    ApprovalPolicy,
    ApprovalRoleThreshold,
    ApprovalDelegation,
)


# ── Errors ────────────────────────────────────────────────────────────────────

class ApprovalRoutingError(Exception):
    """Raised when the engine cannot compute a valid chain (misconfiguration)."""


class ApprovalChainHoldError(Exception):
    """
    Raised when vacant_seat_behavior = "hold" and a step has no active user.
    Caller should surface this to the submitter rather than proceeding.
    """


# ── Output types ──────────────────────────────────────────────────────────────

@dataclass
class ChainStep:
    """One step in the computed approval chain."""
    level: int
    approver_user_id: uuid.UUID
    role_label: str
    chain_type: str  # "management" | "finance"
    delegated_from_id: Optional[uuid.UUID] = None  # set when this step was delegated
    is_advisory: bool = False  # True for "Reviews only" steps (selective_tree); non-blocking


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _find_employee_by_user(user_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> Optional[Employee]:
    """
    Look up the Employee record for a given user within a tenant.
    Links via email: user.email == employee.email AND employee.tenant_id = tenant_id.
    Returns None if no matching employee record exists.
    """
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return None

    emp_result = await db.execute(
        select(Employee)
        .options(
            selectinload(Employee.line_manager).selectinload(Employee.line_manager),
            selectinload(Employee.approval_role),
        )
        .where(
            and_(Employee.email == user.email, Employee.tenant_id == tenant_id, Employee.is_active == True)  # noqa: E712
        )
    )
    return emp_result.scalar_one_or_none()


async def _find_user_by_employee(employee: Employee, db: AsyncSession) -> Optional[User]:
    """
    Find the User account for a given Employee (matched by email).
    Returns None if the employee has no system user (external / seat is vacant).
    """
    result = await db.execute(
        select(User)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(
            and_(
                User.email == employee.email,
                UserTenant.tenant_id == employee.tenant_id,
                User.is_active == True,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none()


async def _resolve_delegation(
    approver_user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    today: date,
    db: AsyncSession,
) -> tuple[uuid.UUID, Optional[uuid.UUID]]:
    """
    Check if approver_user_id has an active delegation today.
    Returns (effective_approver_id, delegated_from_id).
    delegated_from_id is None when no delegation is in effect.
    """
    result = await db.execute(
        select(ApprovalDelegation).where(
            and_(
                ApprovalDelegation.tenant_id == tenant_id,
                ApprovalDelegation.delegator_id == approver_user_id,
                ApprovalDelegation.is_active == True,  # noqa: E712
                ApprovalDelegation.start_date <= today,
                or_(
                    ApprovalDelegation.end_date == None,  # noqa: E711
                    ApprovalDelegation.end_date >= today,
                ),
            )
        )
    )
    delegation = result.scalar_one_or_none()
    if delegation:
        return delegation.delegate_id, approver_user_id
    return approver_user_id, None


async def _get_thresholds(
    policy_id: uuid.UUID, db: AsyncSession
) -> dict[uuid.UUID, Optional[Decimal]]:
    """Return {approval_role_id: max_amount} for all thresholds on this policy."""
    result = await db.execute(
        select(ApprovalRoleThreshold).where(ApprovalRoleThreshold.policy_id == policy_id)
    )
    return {t.approval_role_id: t.max_amount for t in result.scalars().all()}


async def _load_employee_with_managers(
    employee: Employee, max_depth: int, db: AsyncSession
) -> list[Employee]:
    """
    Walk the line_manager_id chain from the given employee upward.
    Returns a flat list [employee.line_manager, their manager, ...] up to max_depth levels.
    Stops early if a manager has no further manager (top of tree) or a cycle is detected.
    """
    chain: list[Employee] = []
    seen_ids: set[uuid.UUID] = {employee.id}
    current: Optional[Employee] = employee

    for _ in range(max_depth):
        if current is None or current.line_manager_id is None:
            break
        # Load the next manager with their approval_role eagerly
        result = await db.execute(
            select(Employee)
            .options(selectinload(Employee.approval_role))
            .where(Employee.id == current.line_manager_id)
        )
        manager = result.scalar_one_or_none()
        if not manager or manager.id in seen_ids:
            break
        seen_ids.add(manager.id)
        chain.append(manager)
        current = manager

    return chain


# ── Public API ────────────────────────────────────────────────────────────────

async def get_policy(module: str, tenant_id: uuid.UUID, db: AsyncSession) -> Optional[ApprovalPolicy]:
    """Load the active ApprovalPolicy for a tenant+module. Returns None if not configured."""
    result = await db.execute(
        select(ApprovalPolicy).where(
            and_(
                ApprovalPolicy.tenant_id == tenant_id,
                ApprovalPolicy.module == module,
                ApprovalPolicy.is_active == True,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none()


async def compute_chain(
    *,
    submitter_user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    module: str,
    total_amount: Decimal,
    db: AsyncSession,
    requestor_selected_approver_id: Optional[uuid.UUID] = None,
    today: Optional[date] = None,
) -> list[ChainStep]:
    """
    Compute the full ordered approval chain for a submission.

    Parameters
    ----------
    submitter_user_id:
        The User.id of the person submitting the request.
    tenant_id:
        The tenant context.
    module:
        "expense" | "payable" | "receivable" | ...
    total_amount:
        Report / invoice total; used against ApprovalRoleThreshold.max_amount.
    db:
        Async DB session.
    requestor_selected_approver_id:
        For routing_mode = "requestor_selects" — the approver the requestor chose.
        Ignored for other modes.
    today:
        Override today's date (used in tests). Defaults to date.today().

    Returns
    -------
    Ordered list of ChainStep objects (level 1, 2, 3, …).
    Raises ApprovalRoutingError for unresolvable configurations.
    Raises ApprovalChainHoldError when vacant_seat_behavior = "hold".
    """
    if today is None:
        today = date.today()

    policy = await get_policy(module, tenant_id, db)
    if not policy:
        raise ApprovalRoutingError(
            f"No active approval policy configured for module '{module}'. "
            "Contact your administrator to set one up."
        )

    thresholds = await _get_thresholds(policy.id, db)
    chain: list[ChainStep] = []
    level = 1

    # ── Management chain ─────────────────────────────────────────────────────

    if policy.routing_mode == "org_tree":
        submitter_emp = await _find_employee_by_user(submitter_user_id, tenant_id, db)
        if not submitter_emp:
            raise ApprovalRoutingError(
                "The submitter does not have an employee record. "
                "Assign this user to an employee profile before submitting."
            )

        managers = await _load_employee_with_managers(submitter_emp, max_depth=20, db=db)

        for manager_emp in managers:
            manager_user = await _find_user_by_employee(manager_emp, db)

            if not manager_user:
                # Vacant seat — apply configured behavior
                if policy.vacant_seat_behavior == "skip":
                    continue
                elif policy.vacant_seat_behavior == "hold":
                    raise ApprovalChainHoldError(
                        f"Approver seat '{manager_emp.first_name} {manager_emp.last_name}' "
                        "is vacant. Submission is on hold until the seat is filled."
                    )
                else:  # escalate_to_fallback
                    if not policy.fallback_approver_id:
                        raise ApprovalRoutingError(
                            "Vacant seat encountered but no fallback approver is configured. "
                            "Set a fallback approver in the approval policy."
                        )
                    manager_user_id = policy.fallback_approver_id
            else:
                manager_user_id = manager_user.id

            # Delegation check
            effective_id, delegated_from = await _resolve_delegation(
                manager_user_id, tenant_id, today, db
            )

            # Role label for this step
            role_label = (
                manager_emp.approval_role.name
                if manager_emp.approval_role
                else f"{manager_emp.first_name} {manager_emp.last_name}"
            )

            chain.append(ChainStep(
                level=level,
                approver_user_id=effective_id,
                role_label=role_label,
                chain_type="management",
                delegated_from_id=delegated_from,
            ))
            level += 1

            # Stop if this manager is the ceiling role
            if (
                policy.ceiling_role_id
                and manager_emp.approval_role
                and manager_emp.approval_role.id == policy.ceiling_role_id
            ):
                break

            # Stop if this role's threshold covers the amount (or no threshold = they are final)
            if manager_emp.approval_role:
                role_max = thresholds.get(manager_emp.approval_role.id)
                # None max_amount means this role has no limit — they are ceiling
                if role_max is None or total_amount <= role_max:
                    break
            # else: no role assigned → no threshold → keep climbing

    elif policy.routing_mode == "requestor_selects":
        if not requestor_selected_approver_id:
            raise ApprovalRoutingError("Approver selection is required for this module.")

        # Validate: selected approver must be above submitter in hierarchy
        submitter_emp = await _find_employee_by_user(submitter_user_id, tenant_id, db)
        if submitter_emp:
            managers = await _load_employee_with_managers(submitter_emp, max_depth=20, db=db)
            manager_user_ids: set[uuid.UUID] = set()
            for m in managers:
                u = await _find_user_by_employee(m, db)
                if u:
                    manager_user_ids.add(u.id)
            if requestor_selected_approver_id not in manager_user_ids:
                raise ApprovalRoutingError(
                    "The selected approver is not above you in the reporting hierarchy."
                )

        # Resolve delegation for the selected approver
        effective_id, delegated_from = await _resolve_delegation(
            requestor_selected_approver_id, tenant_id, today, db
        )
        chain.append(ChainStep(
            level=level,
            approver_user_id=effective_id,
            role_label="Approver",
            chain_type="management",
            delegated_from_id=delegated_from,
        ))
        level += 1

    elif policy.routing_mode == "direct_to_hod":
        # Find HOD via submitter's cost_center → org_structure → head user
        submitter_emp = await _find_employee_by_user(submitter_user_id, tenant_id, db)
        if not submitter_emp or not submitter_emp.cost_center_id:
            raise ApprovalRoutingError(
                "Cannot determine Head of Department — submitter has no cost center assigned."
            )
        # Find the employee whose cost_center matches and is the highest in that node
        # Simplification: find the manager whose cost_center matches submitter's and has no line_manager
        # within the same cost center (i.e., they're the HOD).
        result = await db.execute(
            select(Employee)
            .options(selectinload(Employee.approval_role))
            .where(
                and_(
                    Employee.tenant_id == tenant_id,
                    Employee.cost_center_id == submitter_emp.cost_center_id,
                    Employee.is_active == True,  # noqa: E712
                    Employee.id != submitter_emp.id,
                )
            )
        )
        dept_employees = result.scalars().all()

        # HOD = employee in same cost center whose line_manager is NOT in the same cost center
        hod: Optional[Employee] = None
        for emp in dept_employees:
            if emp.line_manager_id is None:
                hod = emp
                break
            # Check if manager is in a different cost center
            mgr_result = await db.execute(select(Employee).where(Employee.id == emp.line_manager_id))
            mgr = mgr_result.scalar_one_or_none()
            if mgr and mgr.cost_center_id != submitter_emp.cost_center_id:
                hod = emp
                break

        if not hod:
            raise ApprovalRoutingError(
                "Could not determine Head of Department for this cost center. "
                "Ensure the department structure is configured correctly."
            )

        hod_user = await _find_user_by_employee(hod, db)
        if not hod_user:
            if policy.vacant_seat_behavior == "hold":
                raise ApprovalChainHoldError("Head of Department seat is vacant.")
            elif policy.vacant_seat_behavior == "escalate_to_fallback" and policy.fallback_approver_id:
                hod_user_id = policy.fallback_approver_id
            else:
                raise ApprovalRoutingError(
                    "Head of Department has no system account. Configure a fallback approver."
                )
        else:
            hod_user_id = hod_user.id

        effective_id, delegated_from = await _resolve_delegation(hod_user_id, tenant_id, today, db)
        role_label = hod.approval_role.name if hod.approval_role else "Head of Department"
        chain.append(ChainStep(
            level=level,
            approver_user_id=effective_id,
            role_label=role_label,
            chain_type="management",
            delegated_from_id=delegated_from,
        ))
        level += 1

    elif policy.routing_mode == "selective_tree":
        # Walk the org-tree (same traversal as org_tree) but include only managers
        # whose ApprovalRole.designation is in policy.selected_designations.
        # selected_designations: [{designation: str, role: "approve"|"review"}, ...]
        # Designations with role="approve" produce blocking steps; role="review" produces advisory
        # (non-blocking) steps that notify the reviewer but do not gate the chain's advancement.
        submitter_emp = await _find_employee_by_user(submitter_user_id, tenant_id, db)
        if not submitter_emp:
            raise ApprovalRoutingError(
                "The submitter does not have an employee record. "
                "Assign this user to an employee profile before submitting."
            )

        sd = policy.selected_designations or []
        included_designations: set[str] = {
            d["designation"]
            for d in sd
            if isinstance(d, dict) and "designation" in d
        }
        if not included_designations:
            raise ApprovalRoutingError(
                "Selective org-tree routing is configured but no designation levels are selected. "
                "Edit the approval policy to include at least one designation level."
            )
        # Designations configured as "Reviews only" produce advisory (non-blocking) steps.
        review_designations: set[str] = {
            d["designation"]
            for d in sd
            if isinstance(d, dict) and d.get("role") == "review" and "designation" in d
        }

        managers = await _load_employee_with_managers(submitter_emp, max_depth=20, db=db)

        for manager_emp in managers:
            # Skip designations not in the selected set
            mgr_desig = (
                manager_emp.approval_role.designation
                if manager_emp.approval_role
                else None
            )
            if mgr_desig not in included_designations:
                continue

            manager_user = await _find_user_by_employee(manager_emp, db)

            if not manager_user:
                if policy.vacant_seat_behavior == "skip":
                    continue
                elif policy.vacant_seat_behavior == "hold":
                    raise ApprovalChainHoldError(
                        f"Approver seat '{manager_emp.first_name} {manager_emp.last_name}' "
                        "is vacant. Submission is on hold until the seat is filled."
                    )
                else:  # escalate_to_fallback
                    if not policy.fallback_approver_id:
                        raise ApprovalRoutingError(
                            "Vacant seat encountered but no fallback approver is configured. "
                            "Set a fallback approver in the approval policy."
                        )
                    manager_user_id = policy.fallback_approver_id
            else:
                manager_user_id = manager_user.id

            effective_id, delegated_from = await _resolve_delegation(
                manager_user_id, tenant_id, today, db
            )
            role_label = (
                manager_emp.approval_role.name
                if manager_emp.approval_role
                else f"{manager_emp.first_name} {manager_emp.last_name}"
            )
            step_is_advisory = mgr_desig in review_designations
            chain.append(ChainStep(
                level=level,
                approver_user_id=effective_id,
                role_label=role_label,
                chain_type="management",
                delegated_from_id=delegated_from,
                is_advisory=step_is_advisory,
            ))
            level += 1

            # Ceiling role check
            if (
                policy.ceiling_role_id
                and manager_emp.approval_role
                and manager_emp.approval_role.id == policy.ceiling_role_id
            ):
                break

            # Threshold check (same logic as org_tree)
            if manager_emp.approval_role:
                role_max = thresholds.get(manager_emp.approval_role.id)
                if role_max is None or total_amount <= role_max:
                    break

    else:
        raise ApprovalRoutingError(f"Unknown routing_mode: '{policy.routing_mode}'.")

    # ── Finance review chain ──────────────────────────────────────────────────

    if policy.requires_finance_review and policy.finance_levels > 0:
        finance_role_ids = [
            (policy.finance_l1_role_id, 1),
            (policy.finance_l2_role_id, 2),
            (policy.finance_l3_role_id, 3),
        ]
        for role_id, finance_level in finance_role_ids:
            if finance_level > policy.finance_levels:
                break
            if not role_id:
                continue

            # Apply finance-level thresholds
            if finance_level == 2 and policy.finance_amount_threshold_l2 is not None:
                if total_amount <= policy.finance_amount_threshold_l2:
                    continue
            if finance_level == 3 and policy.finance_amount_threshold_l3 is not None:
                if total_amount <= policy.finance_amount_threshold_l3:
                    continue

            # Find the user holding this finance role
            # We look for employees with this approval_role_id in the tenant
            result = await db.execute(
                select(Employee)
                .options(selectinload(Employee.approval_role))
                .where(
                    and_(
                        Employee.tenant_id == tenant_id,
                        Employee.approval_role_id == role_id,
                        Employee.is_active == True,  # noqa: E712
                    )
                )
            )
            role_holders = result.scalars().all()

            if not role_holders:
                if policy.vacant_seat_behavior == "skip":
                    continue
                elif policy.vacant_seat_behavior == "hold":
                    raise ApprovalChainHoldError(
                        f"Finance review step {finance_level} has no user assigned to the required role."
                    )
                elif policy.vacant_seat_behavior == "escalate_to_fallback" and policy.fallback_approver_id:
                    finance_user_id = policy.fallback_approver_id
                    role_label = "Finance Reviewer"
                else:
                    raise ApprovalRoutingError(
                        f"Finance review role (level {finance_level}) has no user assigned."
                    )
            else:
                # If multiple users hold the role, take the first active one
                role_user: Optional[User] = None
                role_label = role_holders[0].approval_role.name if role_holders[0].approval_role else "Finance Reviewer"
                for holder in role_holders:
                    u = await _find_user_by_employee(holder, db)
                    if u:
                        role_user = u
                        break
                if not role_user:
                    if policy.vacant_seat_behavior == "skip":
                        continue
                    elif policy.vacant_seat_behavior == "hold":
                        raise ApprovalChainHoldError(f"Finance reviewer seat (level {finance_level}) is vacant.")
                    elif policy.vacant_seat_behavior == "escalate_to_fallback" and policy.fallback_approver_id:
                        finance_user_id = policy.fallback_approver_id
                    else:
                        raise ApprovalRoutingError(
                            f"Finance reviewer (level {finance_level}) has no active user account."
                        )
                else:
                    finance_user_id = role_user.id

            effective_id, delegated_from = await _resolve_delegation(
                finance_user_id, tenant_id, today, db
            )
            chain.append(ChainStep(
                level=level,
                approver_user_id=effective_id,
                role_label=role_label,
                chain_type="finance",
                delegated_from_id=delegated_from,
            ))
            level += 1

    # Guard: if every step in the chain is advisory, the report would be submitted but never
    # advance past its initial level — a silent permanent-stuck failure. Surface it immediately.
    if chain and not any(not step.is_advisory for step in chain):
        raise ApprovalRoutingError(
            "This approval policy has no blocking approver — at least one designation level must "
            "be set to 'Approves', or finance review must be enabled with at least one level."
        )

    if not chain:
        raise ApprovalRoutingError(
            "No approvers could be determined for this submission. "
            "Check that the approval policy and employee reporting structure are configured."
        )

    return chain


async def preview_chain(
    *,
    submitter_user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    module: str,
    total_amount: Decimal,
    db: AsyncSession,
) -> list[dict]:
    """
    Compute the chain and return a lightweight preview for the submission form UI.
    Returns list of {level, name, email, role_label, chain_type, is_delegated}.
    Errors are caught and surfaced as {"error": "<message>"} so the UI can display them.
    """
    try:
        steps = await compute_chain(
            submitter_user_id=submitter_user_id,
            tenant_id=tenant_id,
            module=module,
            total_amount=total_amount,
            db=db,
        )
    except (ApprovalRoutingError, ApprovalChainHoldError) as e:
        return [{"error": str(e)}]

    preview = []
    for step in steps:
        user_result = await db.execute(select(User).where(User.id == step.approver_user_id))
        user = user_result.scalar_one_or_none()
        preview.append({
            "level": step.level,
            "name": user.full_name if user else "Unknown",
            "email": user.email if user else "",
            "role_label": step.role_label,
            "chain_type": step.chain_type,
            "is_delegated": step.delegated_from_id is not None,
        })
    return preview
