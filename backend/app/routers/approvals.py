"""
ZivaBI — approval workflow router (Milestone 4).

Implements the full expense approval chain:
    Tenant Admin configures approval matrix (levels + role labels + amount thresholds).
    Employee selects specific approvers and submits report → PENDING_APPROVAL.
    Level-1 approver sees report in queue; approves → activates level 2 (or APPROVED).
    Any approver can reject → report returns to DRAFT with rejection comment.
    Rejection email sent to the employee (falls back to console log if SMTP not set).

Endpoints:
    POST   /api/approvals/matrix                          Create or update approval matrix
    GET    /api/approvals/matrix                          Get current tenant's matrix
    POST   /api/approvals/reports/{report_id}/submit      Submit report with approver selection
    GET    /api/approvals/queue                           List reports pending current user's action
    GET    /api/approvals/reports/{report_id}             List all approval records for a report
    POST   /api/approvals/{approval_id}/approve           Approve at current level
    POST   /api/approvals/{approval_id}/reject            Reject with comment
"""

import logging
import smtplib
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.approvals import ApprovalMatrix, ExpenseApproval
from app.models.auth import User, UserTenant
from app.models.expenses import ExpenseReport
from app.schemas.approvals import (
    ApprovalMatrixCreate,
    ApprovalMatrixResponse,
    ApprovalQueueItem,
    ApprovalRecordResponse,
    ApproveRequest,
    RejectRequest,
    SubmitWithApproversRequest,
)
from app.schemas.expenses import ExpenseReportResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    """Raise 403 if the current user has no tenant (individual account)."""
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approval workflow is a business-tier feature.",
        )
    return current_user.tenant_id


def _require_admin(current_user: CurrentUser) -> None:
    """Raise 403 if the current user is not a tenant admin or super admin."""
    if not current_user.is_tenant_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant admin access is required.",
        )


async def _get_matrix(tenant_id: uuid.UUID, db: AsyncSession) -> ApprovalMatrix | None:
    """Fetch the approval matrix for a tenant, returning None if not configured."""
    result = await db.execute(
        select(ApprovalMatrix).where(ApprovalMatrix.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def _get_report_or_404(
    report_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ExpenseReport:
    """Fetch an expense report by ID scoped to tenant, raising 404 if not found."""
    result = await db.execute(
        select(ExpenseReport)
        .where(ExpenseReport.id == report_id, ExpenseReport.tenant_id == tenant_id)
        .options(selectinload(ExpenseReport.lines))
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    return report


async def _reload_report(report_id: uuid.UUID, db: AsyncSession) -> ExpenseReport:
    """Re-fetch a report with lines after a mutation."""
    result = await db.execute(
        select(ExpenseReport)
        .where(ExpenseReport.id == report_id)
        .options(selectinload(ExpenseReport.lines))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _validate_approver(
    approver_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> User:
    """
    Validate that the approver belongs to the same tenant.

    Returns the User record so callers can use the approver's name/email.
    """
    result = await db.execute(
        select(User)
        .join(UserTenant, User.id == UserTenant.user_id)
        .where(
            User.id == approver_id,
            UserTenant.tenant_id == tenant_id,
            UserTenant.is_active.is_(True),
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Approver {approver_id} not found in your company.",
        )
    return user


def _role_label_for_level(matrix: ApprovalMatrix, level: int) -> str:
    """Return the configured role label for a given approval level."""
    if level == 1:
        return matrix.level1_role
    if level == 2:
        return matrix.level2_role or f"Level {level}"
    return matrix.level3_role or f"Level {level}"


def _send_rejection_email(
    to_email: str,
    report_number: str,
    report_date: str,
    total_amount: Decimal,
    rejection_comment: str,
) -> None:
    """
    Send a rejection notification email to the employee.

    Falls back to console logging when SMTP credentials are not configured —
    so local development works without an email server.
    """
    subject = f"Expense Report {report_number} Rejected"
    body = (
        f"Your expense report {report_number} dated {report_date} "
        f"for ₦{total_amount:,.2f} has been rejected.\n\n"
        f"Reason: {rejection_comment}\n\n"
        f"Please log in to Ziva BI to review and resubmit."
    )

    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_password]):
        logger.info(
            "[EMAIL SIMULATION] Rejection notification\nTo: %s\nSubject: %s\n\n%s",
            to_email,
            subject,
            body,
        )
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email or settings.smtp_user
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception as exc:
        logger.warning("Failed to send rejection email to %s: %s", to_email, exc)


# ── Approval Matrix ───────────────────────────────────────────────────────────

@router.post("/matrix", response_model=ApprovalMatrixResponse)
async def upsert_approval_matrix(
    data: ApprovalMatrixCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ApprovalMatrixResponse:
    """
    Create or update the tenant's approval matrix.

    Tenant Admin only. Calling this endpoint again overwrites the existing config.
    Validates that level 2 / 3 role labels and thresholds are only provided when
    the selected levels count supports them.
    """
    _require_admin(current_user)
    tenant_id = _require_tenant(current_user)

    matrix = await _get_matrix(tenant_id, db)

    if matrix:
        matrix.levels = data.levels
        matrix.level1_role = data.level1_role
        matrix.level2_role = data.level2_role if data.levels >= 2 else None
        matrix.level3_role = data.level3_role if data.levels >= 3 else None
        matrix.amount_threshold_l2 = data.amount_threshold_l2 if data.levels >= 2 else None
        matrix.amount_threshold_l3 = data.amount_threshold_l3 if data.levels >= 3 else None
    else:
        matrix = ApprovalMatrix(
            tenant_id=tenant_id,
            levels=data.levels,
            level1_role=data.level1_role,
            level2_role=data.level2_role if data.levels >= 2 else None,
            level3_role=data.level3_role if data.levels >= 3 else None,
            amount_threshold_l2=data.amount_threshold_l2 if data.levels >= 2 else None,
            amount_threshold_l3=data.amount_threshold_l3 if data.levels >= 3 else None,
        )
        db.add(matrix)

    await db.flush()
    return ApprovalMatrixResponse.from_orm(matrix)


@router.get("/matrix", response_model=ApprovalMatrixResponse | None)
async def get_approval_matrix(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ApprovalMatrixResponse | None:
    """
    Return the current tenant's approval matrix.

    Returns null (204-equivalent JSON null) if no matrix is configured yet.
    """
    tenant_id = _require_tenant(current_user)
    matrix = await _get_matrix(tenant_id, db)
    return ApprovalMatrixResponse.from_orm(matrix) if matrix else None


# ── Submit with Approvers ─────────────────────────────────────────────────────

@router.post("/reports/{report_id}/submit", response_model=ExpenseReportResponse)
async def submit_with_approvers(
    report_id: uuid.UUID,
    data: SubmitWithApproversRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Submit an expense report for approval (M4 flow).

    Handles two scenarios:

    First-time submission (no prior expense_approvals records):
      - level1_approver_id (and l2/l3 where applicable) must be provided.
      - Creates ExpenseApproval records for each applicable level.

    Resubmission (expense_approvals records already exist from a prior rejected submission):
      - Approver IDs from the request are ignored.
      - Old approval records are deleted and recreated with the same approver IDs,
        all reset to PENDING status — so the approval chain starts fresh.
      - No modal shown to the employee; original approvers are reused automatically.
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only DRAFT reports can be submitted.",
        )
    if not report.lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A report must have at least one expense line before submitting.",
        )

    matrix = await _get_matrix(tenant_id, db)
    if not matrix:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Your company has not configured an approval matrix. Contact your administrator.",
        )

    # ── Check for existing approvals (determines first-time vs resubmission) ──
    existing_result = await db.execute(
        select(ExpenseApproval)
        .where(ExpenseApproval.report_id == report.id)
        .order_by(ExpenseApproval.level.asc())
    )
    existing_approvals = existing_result.scalars().all()

    if existing_approvals:
        # Resubmission — reuse the same approver IDs, just reset to PENDING
        level_to_approver: dict[int, uuid.UUID] = {
            a.level: a.approver_id for a in existing_approvals
        }
        for old in existing_approvals:
            await db.delete(old)
        await db.flush()
        for level, approver_id in sorted(level_to_approver.items()):
            db.add(ExpenseApproval(
                report_id=report.id,
                tenant_id=tenant_id,
                level=level,
                approver_id=approver_id,
                status="PENDING",
            ))
    else:
        # First-time submission — require approver IDs from the request body
        if data.level1_approver_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Level 1 approver is required.",
            )

        applicable_levels: list[tuple[int, uuid.UUID]] = [
            (1, data.level1_approver_id)
        ]

        if matrix.levels >= 2:
            threshold_l2 = matrix.amount_threshold_l2
            if threshold_l2 is None or report.total_amount > threshold_l2:
                if data.level2_approver_id is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Level 2 approver is required for this report.",
                    )
                applicable_levels.append((2, data.level2_approver_id))

        if matrix.levels >= 3:
            threshold_l3 = matrix.amount_threshold_l3
            if threshold_l3 is None or report.total_amount > threshold_l3:
                if data.level3_approver_id is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Level 3 approver is required for this report.",
                    )
                applicable_levels.append((3, data.level3_approver_id))

        for _, approver_id in applicable_levels:
            await _validate_approver(approver_id, tenant_id, db)

        for level, approver_id in applicable_levels:
            db.add(ExpenseApproval(
                report_id=report.id,
                tenant_id=tenant_id,
                level=level,
                approver_id=approver_id,
                status="PENDING",
            ))

    report.status = "PENDING_APPROVAL"
    report.current_approval_level = 1
    report.submitted_at = datetime.now(timezone.utc)
    report.rejection_comment = None

    await db.flush()
    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))


# ── Approver Queue ────────────────────────────────────────────────────────────

@router.get("/queue", response_model=list[ApprovalQueueItem])
async def get_approval_queue(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalQueueItem]:
    """
    Return all expense reports currently awaiting the current user's approval.

    A report is in the queue when:
      - expense_approvals.approver_id = current user
      - expense_approvals.status = PENDING
      - expense_reports.current_approval_level = expense_approvals.level

    The last condition enforces sequential approval: only the active level
    appears for the approver.
    """
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(ExpenseApproval, ExpenseReport, User)
        .join(ExpenseReport, ExpenseApproval.report_id == ExpenseReport.id)
        .join(User, ExpenseReport.employee_id == User.id)
        .where(
            ExpenseApproval.approver_id == current_user.user_id,
            ExpenseApproval.status == "PENDING",
            ExpenseReport.current_approval_level == ExpenseApproval.level,
            ExpenseApproval.tenant_id == tenant_id,
        )
        .order_by(ExpenseApproval.created_at.asc())
    )
    rows = result.all()

    # Fetch the approval matrix once for level labels
    matrix = await _get_matrix(tenant_id, db)

    items = []
    for approval, report, employee in rows:
        items.append(
            ApprovalQueueItem(
                approval_id=str(approval.id),
                report_id=str(report.id),
                report_number=report.report_number,
                employee_name=employee.full_name,
                report_date=report.report_date,
                total_amount=report.total_amount,
                level=approval.level,
                level_label=_role_label_for_level(matrix, approval.level) if matrix else f"Level {approval.level}",
                created_at=approval.created_at,
            )
        )
    return items


# ── Rejected Reports (approver visibility) ───────────────────────────────────

@router.get("/rejected", response_model=list[ApprovalQueueItem])
async def get_rejected_reports(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalQueueItem]:
    """
    Return all expense reports that were rejected AND where the current user
    was assigned as an approver at any level.

    Gives approvers visibility into rejections they were involved in so they
    can track the outcome without needing to search through every report.
    Deduplicated — each report appears once even if the same user was assigned
    at multiple levels.
    """
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(ExpenseApproval, ExpenseReport, User)
        .join(ExpenseReport, ExpenseApproval.report_id == ExpenseReport.id)
        .join(User, ExpenseReport.employee_id == User.id)
        .where(
            ExpenseApproval.approver_id == current_user.user_id,
            ExpenseReport.status == "REJECTED",
            ExpenseApproval.tenant_id == tenant_id,
        )
        .order_by(ExpenseReport.created_at.desc(), ExpenseApproval.level.asc())
    )
    rows = result.all()

    matrix = await _get_matrix(tenant_id, db)

    seen: set[uuid.UUID] = set()
    items: list[ApprovalQueueItem] = []
    for approval, report, employee in rows:
        if report.id in seen:
            continue
        seen.add(report.id)
        items.append(
            ApprovalQueueItem(
                approval_id=str(approval.id),
                report_id=str(report.id),
                report_number=report.report_number,
                employee_name=employee.full_name,
                report_date=report.report_date,
                total_amount=report.total_amount,
                level=approval.level,
                level_label=_role_label_for_level(matrix, approval.level) if matrix else f"Level {approval.level}",
                created_at=approval.created_at,
                rejection_comment=report.rejection_comment,
            )
        )
    return items


# ── Report Approval Chain ─────────────────────────────────────────────────────

@router.get("/reports/{report_id}", response_model=list[ApprovalRecordResponse])
async def get_report_approvals(
    report_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalRecordResponse]:
    """
    Return all approval records for a given expense report.

    Used by the report detail page to show the approval chain and determine
    whether the current user has an active pending approval to action.
    Any tenant member can view the approval chain for any report in their tenant.
    """
    tenant_id = _require_tenant(current_user)

    # Ensure the report belongs to this tenant
    report_result = await db.execute(
        select(ExpenseReport).where(
            ExpenseReport.id == report_id,
            ExpenseReport.tenant_id == tenant_id,
        )
    )
    if not report_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    result = await db.execute(
        select(ExpenseApproval, User)
        .join(User, ExpenseApproval.approver_id == User.id)
        .where(
            ExpenseApproval.report_id == report_id,
            ExpenseApproval.tenant_id == tenant_id,
        )
        .order_by(ExpenseApproval.level.asc())
    )
    rows = result.all()

    matrix = await _get_matrix(tenant_id, db)

    return [
        ApprovalRecordResponse(
            id=str(approval.id),
            level=approval.level,
            level_label=_role_label_for_level(matrix, approval.level) if matrix else f"Level {approval.level}",
            approver_id=str(approval.approver_id),
            approver_name=approver.full_name,
            status=approval.status,
            comment=approval.comment,
            actioned_at=approval.actioned_at,
            created_at=approval.created_at,
        )
        for approval, approver in rows
    ]


# ── Approve ───────────────────────────────────────────────────────────────────

@router.post("/{approval_id}/approve", response_model=ExpenseReportResponse)
async def approve(
    approval_id: uuid.UUID,
    data: ApproveRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Approve an expense report at the current level.

    Validates the current user is the designated approver and the approval is
    still PENDING at the report's current_approval_level. After approving:
      - If a higher level exists: increment current_approval_level.
      - If this was the last level: set report status = APPROVED.
    """
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.id == approval_id,
            ExpenseApproval.tenant_id == tenant_id,
        )
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval record not found.")

    if approval.approver_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the designated approver for this record.",
        )
    if approval.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This approval record has already been actioned.",
        )

    report = await _get_report_or_404(approval.report_id, tenant_id, db)

    if report.current_approval_level != approval.level:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This approval level is not currently active for this report.",
        )

    # Mark this level as approved
    approval.status = "APPROVED"
    approval.comment = data.comment
    approval.actioned_at = datetime.now(timezone.utc)

    # Check if there is a next level
    next_result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.report_id == report.id,
            ExpenseApproval.level == approval.level + 1,
        )
    )
    next_approval = next_result.scalar_one_or_none()

    if next_approval:
        report.current_approval_level = next_approval.level
    else:
        report.status = "APPROVED"
        report.current_approval_level = None

    await db.flush()
    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))


# ── Reject ────────────────────────────────────────────────────────────────────

@router.post("/{approval_id}/reject", response_model=ExpenseReportResponse)
async def reject(
    approval_id: uuid.UUID,
    data: RejectRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Reject an expense report with a mandatory comment.

    Sets this approval record to REJECTED and returns the report to REJECTED
    status with the rejection comment stored. The employee can then edit and
    resubmit the report, which creates a fresh approval chain.

    Sends an email notification to the employee (console log if SMTP not configured).
    """
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.id == approval_id,
            ExpenseApproval.tenant_id == tenant_id,
        )
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval record not found.")

    if approval.approver_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the designated approver for this record.",
        )
    if approval.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This approval record has already been actioned.",
        )

    report = await _get_report_or_404(approval.report_id, tenant_id, db)

    if report.current_approval_level != approval.level:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This approval level is not currently active for this report.",
        )

    # Mark this approval as rejected
    approval.status = "REJECTED"
    approval.comment = data.comment
    approval.actioned_at = datetime.now(timezone.utc)

    # Return report to REJECTED so employee sees the rejection with comment
    report.status = "REJECTED"
    report.rejection_comment = data.comment
    report.current_approval_level = None

    await db.flush()

    # Fetch employee details for the notification email
    employee_result = await db.execute(
        select(User).where(User.id == report.employee_id)
    )
    employee = employee_result.scalar_one_or_none()
    if employee:
        _send_rejection_email(
            to_email=employee.email,
            report_number=report.report_number,
            report_date=str(report.report_date),
            total_amount=report.total_amount,
            rejection_comment=data.comment,
        )

    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))
