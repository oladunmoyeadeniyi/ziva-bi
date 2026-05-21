"""
ZivaBI — approval workflow router (Milestones 4–5).

Implements the full expense approval chain with audit trail, snapshots,
refer-back enhancements, separation of duties, and full email coverage.

Endpoints:
    POST   /api/approvals/matrix                                Create or update approval matrix
    GET    /api/approvals/matrix                                Get current tenant's matrix
    POST   /api/approvals/reports/{report_id}/submit            Submit report for approval
    GET    /api/approvals/queue                                  Reports pending current user's action
    GET    /api/approvals/rejected                               Reports rejected involving current user
    GET    /api/approvals/reports/{report_id}/audit-log          Chronological event trail
    GET    /api/approvals/reports/{report_id}/snapshot/{version} Snapshot of lines at submission
    GET    /api/approvals/reports/{report_id}                   All approval records for a report
    POST   /api/approvals/{approval_id}/approve                 Approve at current level
    POST   /api/approvals/{approval_id}/reject                  Reject with comment
    POST   /api/approvals/{approval_id}/refer-back              Refer back to lower approver or requestor
"""

import logging
import smtplib
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.approvals import ApprovalMatrix, ExpenseApproval
from app.models.auth import AuditLog, User, UserTenant
from app.models.expenses import ExpenseReport, ExpenseReportSnapshot
from app.schemas.approvals import (
    ApprovalMatrixCreate,
    ApprovalMatrixResponse,
    ApprovalQueueItem,
    ApprovalRecordResponse,
    ApproveRequest,
    AuditLogEntry,
    ReferBackRequest,
    RejectRequest,
    SnapshotResponse,
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
    """Validate that the approver belongs to the same tenant."""
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


async def _write_audit_log(
    db: AsyncSession,
    event_type: str,
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    metadata: dict,
) -> None:
    """Append an immutable audit log entry. Never raises — failures are logged only."""
    try:
        db.add(AuditLog(
            event_type=event_type,
            user_id=user_id,
            tenant_id=tenant_id,
            log_metadata=metadata,
        ))
    except Exception as exc:
        logger.error("Failed to write audit log %s: %s", event_type, exc)


async def _write_snapshot(
    report: ExpenseReport,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> int:
    """
    Write an immutable snapshot of the report's current lines and header.

    Returns the snapshot version number (1-based, increments per resubmission).
    Must be called BEFORE the report status is changed so the lines are still
    in their pre-submission state.
    """
    version_result = await db.execute(
        select(func.count(ExpenseReportSnapshot.id)).where(
            ExpenseReportSnapshot.report_id == report.id
        )
    )
    version = (version_result.scalar_one() or 0) + 1

    lines_data = [
        {
            "line_number": ln.line_number,
            "gl_account": ln.gl_account,
            "pl_group": ln.pl_group,
            "io_dimension": ln.io_dimension,
            "cost_center": ln.cost_center,
            "location": ln.location,
            "invoice_date": str(ln.invoice_date) if ln.invoice_date else None,
            "invoice_number": ln.invoice_number,
            "description": ln.description,
            "amount": str(ln.amount),
        }
        for ln in (report.lines or [])
    ]

    db.add(ExpenseReportSnapshot(
        report_id=report.id,
        tenant_id=tenant_id,
        snapshot_data={
            "report_number": report.report_number,
            "employee_id": str(report.employee_id),
            "report_date": str(report.report_date),
            "currency": report.currency,
            "total_amount": str(report.total_amount),
            "lines": lines_data,
        },
        submitted_at=datetime.now(timezone.utc),
        version=version,
    ))
    return version


def _send_rejection_email(
    to_email: str,
    report_number: str,
    report_date: str,
    total_amount: Decimal,
    rejection_comment: str,
) -> None:
    """Send rejection notification; falls back to console log if SMTP not configured."""
    subject = f"Expense Report {report_number} Rejected"
    body = (
        f"Your expense report {report_number} dated {report_date} "
        f"for ₦{total_amount:,.2f} has been rejected.\n\n"
        f"Reason: {rejection_comment}\n\n"
        f"Please log in to Ziva BI to review and resubmit."
    )
    _smtp_send(to_email, subject, body)


def _send_approver_notification_email(
    to_email: str,
    report_number: str,
    report_date: str,
    total_amount: Decimal,
    employee_name: str,
    role_label: str,
) -> None:
    """Notify an approver that a report is awaiting their action."""
    subject = f"Action Required: Expense Report {report_number} awaiting your approval"
    body = (
        f"{employee_name} has submitted expense report {report_number} "
        f"dated {report_date} for ₦{total_amount:,.2f} requiring your "
        f"approval as {role_label}.\n\n"
        f"Please log in to Ziva BI to review and action."
    )
    _smtp_send(to_email, subject, body)


def _send_approval_complete_email(
    to_email: str,
    report_number: str,
    report_date: str,
    total_amount: Decimal,
) -> None:
    """Notify the requestor that their report has been fully approved."""
    subject = f"Approved: Expense Report {report_number}"
    body = (
        f"Your expense report {report_number} dated {report_date} "
        f"for ₦{total_amount:,.2f} has been fully approved.\n\n"
        f"Please log in to Ziva BI to view the approved report."
    )
    _smtp_send(to_email, subject, body)


def _send_refer_back_email(
    to_email: str,
    report_number: str,
    comment: str,
    referring_level: int,
) -> None:
    """Notify requestor that their report was referred back to them."""
    subject = f"Query on Expense Report {report_number}"
    body = (
        f"There is a query on your expense report {report_number}.\n\n"
        f"Query: {comment}\n\n"
        f"Please log in to Ziva BI to view the details."
    )
    _smtp_send(to_email, subject, body)


def _send_referred_approver_email(
    to_email: str,
    report_number: str,
    referring_approver_name: str,
    referring_level: int,
    comment: str,
) -> None:
    """Notify a lower approver that a report has been referred to them for consultation."""
    subject = f"Referred to you: Expense Report {report_number}"
    body = (
        f"Expense report {report_number} has been referred to you by "
        f"{referring_approver_name} (Level {referring_level}) for review.\n\n"
        f"Query: {comment}\n\n"
        f"Please log in to Ziva BI to respond."
    )
    _smtp_send(to_email, subject, body)


def _smtp_send(to_email: str, subject: str, body: str) -> None:
    """Shared SMTP send; logs to console when SMTP credentials are not configured."""
    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_password]):
        logger.info(
            "[EMAIL SIMULATION]\nTo: %s\nSubject: %s\n\n%s",
            to_email, subject, body,
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
        logger.warning("Failed to send email to %s: %s", to_email, exc)


# ── Approval Matrix ───────────────────────────────────────────────────────────

@router.post("/matrix", response_model=ApprovalMatrixResponse)
async def upsert_approval_matrix(
    data: ApprovalMatrixCreate,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ApprovalMatrixResponse:
    """Create or update the tenant's approval matrix. Tenant Admin only."""
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
    """Return the current tenant's approval matrix, or null if not configured."""
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
    Submit an expense report for approval.

    First-time submission: approver IDs must be provided via the request body.
    Resubmission (after rejection/referral): backend reuses original approver IDs
    and resumes the chain from rejected_at_level, skipping already-approved levels.

    Separation of duties: none of the selected approvers may be the same person
    as the report's employee (requestor).

    Writes an expense snapshot and audit log entry on every submission.
    Sends an email notification to the first active approver.
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status not in ("DRAFT", "REJECTED", "REFERRED_TO_REQUESTOR"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only DRAFT, REJECTED, or REFERRED_TO_REQUESTOR reports can be submitted.",
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

    existing_result = await db.execute(
        select(ExpenseApproval)
        .where(ExpenseApproval.report_id == report.id)
        .order_by(ExpenseApproval.level.asc())
    )
    existing_approvals = existing_result.scalars().all()

    # Write snapshot before mutating report state
    snapshot_version = await _write_snapshot(report, tenant_id, db)

    if existing_approvals:
        # Resubmission — smart resume from rejected_at_level
        rejected_at = report.rejected_at_level or 1

        to_recreate = [a for a in existing_approvals if a.level >= rejected_at]
        level_to_approver: dict[int, uuid.UUID] = {a.level: a.approver_id for a in to_recreate}

        for old in to_recreate:
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

        start_level = rejected_at
        approver_ids_for_log = [str(v) for v in level_to_approver.values()]

        report.status = "PENDING_APPROVAL"
        report.current_approval_level = start_level
        report.submitted_at = datetime.now(timezone.utc)
        report.rejection_comment = None
        report.rejected_at_level = None
        report.referred_back_from_level = None
        report.referred_back_levels = None

        await db.flush()

        await _write_audit_log(db, "EXPENSE_RESUBMITTED", current_user.user_id, tenant_id, {
            "report_id": str(report.id),
            "report_number": report.report_number,
            "total_amount": str(report.total_amount),
            "resumed_from_level": start_level,
            "snapshot_version": snapshot_version,
        })

        # Notify the first active approver
        first_approver_id = level_to_approver.get(start_level)
        if first_approver_id:
            approver_result = await db.execute(select(User).where(User.id == first_approver_id))
            approver = approver_result.scalar_one_or_none()
            employee_result = await db.execute(select(User).where(User.id == report.employee_id))
            employee = employee_result.scalar_one_or_none()
            if approver and employee:
                _send_approver_notification_email(
                    to_email=approver.email,
                    report_number=report.report_number,
                    report_date=str(report.report_date),
                    total_amount=report.total_amount,
                    employee_name=employee.full_name,
                    role_label=_role_label_for_level(matrix, start_level),
                )

        return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))

    # ── First-time submission ─────────────────────────────────────────────────
    if data.level1_approver_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Level 1 approver is required.",
        )

    applicable_levels: list[tuple[int, uuid.UUID]] = [(1, data.level1_approver_id)]

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

    # Separation of duties: no approver may be the requestor
    for _, approver_id in applicable_levels:
        if approver_id == report.employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An expense approver cannot be the same person as the requestor.",
            )

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
    report.rejected_at_level = None
    report.referred_back_from_level = None
    report.referred_back_levels = None

    await db.flush()

    approver_ids_for_log = [str(approver_id) for _, approver_id in applicable_levels]
    await _write_audit_log(db, "EXPENSE_SUBMITTED", current_user.user_id, tenant_id, {
        "report_id": str(report.id),
        "report_number": report.report_number,
        "total_amount": str(report.total_amount),
        "employee_id": str(report.employee_id),
        "approver_ids": approver_ids_for_log,
        "snapshot_version": snapshot_version,
    })

    # Notify Level 1 approver
    l1_approver_id = applicable_levels[0][1]
    approver_result = await db.execute(select(User).where(User.id == l1_approver_id))
    approver = approver_result.scalar_one_or_none()
    employee_result = await db.execute(select(User).where(User.id == report.employee_id))
    employee = employee_result.scalar_one_or_none()
    if approver and employee:
        _send_approver_notification_email(
            to_email=approver.email,
            report_number=report.report_number,
            report_date=str(report.report_date),
            total_amount=report.total_amount,
            employee_name=employee.full_name,
            role_label=_role_label_for_level(matrix, 1),
        )

    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))


# ── Approver Queue ────────────────────────────────────────────────────────────

@router.get("/queue", response_model=list[ApprovalQueueItem])
async def get_approval_queue(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalQueueItem]:
    """
    Return all expense reports currently awaiting the current user's approval.

    A report is in the queue when the approval record is PENDING and
    expense_reports.current_approval_level matches the record's level,
    enforcing sequential approval.
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
    matrix = await _get_matrix(tenant_id, db)

    return [
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
        for approval, report, employee in rows
    ]


# ── Rejected Reports (approver visibility) ───────────────────────────────────

@router.get("/rejected", response_model=list[ApprovalQueueItem])
async def get_rejected_reports(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalQueueItem]:
    """
    Return reports that were rejected and where the current user was an approver.

    Deduplicated — each report appears once even if assigned at multiple levels.
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
        items.append(ApprovalQueueItem(
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
        ))
    return items


# ── Audit Trail ───────────────────────────────────────────────────────────────

@router.get("/reports/{report_id}/audit-log", response_model=list[AuditLogEntry])
async def get_audit_log(
    report_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogEntry]:
    """
    Return the full chronological audit trail for an expense report.

    Restricted to tenant admins and super admins.
    The report must belong to the current user's tenant.
    """
    tenant_id = _require_tenant(current_user)
    if not current_user.is_tenant_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Audit trail access requires Tenant Admin or Super Admin.",
        )

    # Verify report belongs to this tenant
    report_check = await db.execute(
        select(ExpenseReport.id).where(
            ExpenseReport.id == report_id,
            ExpenseReport.tenant_id == tenant_id,
        )
    )
    if not report_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    result = await db.execute(
        select(AuditLog, User)
        .join(User, AuditLog.user_id == User.id, isouter=True)
        .where(
            AuditLog.tenant_id == tenant_id,
            AuditLog.log_metadata["report_id"].astext == str(report_id),
            AuditLog.event_type.in_([
                "EXPENSE_SUBMITTED", "EXPENSE_APPROVED", "EXPENSE_REJECTED",
                "EXPENSE_REFERRED_BACK", "EXPENSE_RESUBMITTED",
            ]),
        )
        .order_by(AuditLog.created_at.asc())
    )
    rows = result.all()

    return [
        AuditLogEntry(
            id=str(log.id),
            event_type=log.event_type,
            user_id=str(log.user_id) if log.user_id else None,
            actor_name=actor.full_name if actor else "Unknown",
            log_metadata=log.log_metadata or {},
            created_at=log.created_at,
        )
        for log, actor in rows
    ]


# ── Snapshot ─────────────────────────────────────────────────────────────────

@router.get("/reports/{report_id}/snapshot/{version}", response_model=SnapshotResponse)
async def get_snapshot(
    report_id: uuid.UUID,
    version: int,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> SnapshotResponse:
    """
    Return the expense report snapshot for a specific submission version.

    Any tenant member can view snapshots for reports in their tenant.
    """
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(ExpenseReportSnapshot).where(
            ExpenseReportSnapshot.report_id == report_id,
            ExpenseReportSnapshot.tenant_id == tenant_id,
            ExpenseReportSnapshot.version == version,
        )
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot version {version} not found for this report.",
        )

    return SnapshotResponse(
        id=str(snapshot.id),
        report_id=str(snapshot.report_id),
        version=snapshot.version,
        submitted_at=snapshot.submitted_at,
        snapshot_data=snapshot.snapshot_data,
        created_at=snapshot.created_at,
    )


# ── Report Approval Chain ─────────────────────────────────────────────────────

@router.get("/reports/{report_id}", response_model=list[ApprovalRecordResponse])
async def get_report_approvals(
    report_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalRecordResponse]:
    """
    Return all approval records for a given expense report.

    Used by the report detail page to display the approval chain.
    Any tenant member can view the approval chain for any report in their tenant.
    """
    tenant_id = _require_tenant(current_user)

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
        .order_by(ExpenseApproval.level.asc(), ExpenseApproval.created_at.desc())
    )
    rows = result.all()
    matrix = await _get_matrix(tenant_id, db)

    seen_levels: set[int] = set()
    deduped: list[ApprovalRecordResponse] = []
    for approval, approver in rows:
        if approval.level in seen_levels:
            continue
        seen_levels.add(approval.level)
        deduped.append(ApprovalRecordResponse(
            id=str(approval.id),
            level=approval.level,
            level_label=_role_label_for_level(matrix, approval.level) if matrix else f"Level {approval.level}",
            approver_id=str(approval.approver_id),
            approver_name=approver.full_name,
            status=approval.status,
            comment=approval.comment,
            visible_to_requestor=approval.visible_to_requestor,
            response_comment=approval.response_comment,
            actioned_at=approval.actioned_at,
            created_at=approval.created_at,
        ))
    return deduped


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

    If the approval is part of a refer-back-to-approver flow, control returns to
    the referring level after all referred levels have approved.
    Supports optional response_comment sent back to the referring approver.
    Sends a full-approval email to the requestor when the last level approves.
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You are not the designated approver for this record.")
    if approval.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This approval record has already been actioned.")

    report = await _get_report_or_404(approval.report_id, tenant_id, db)

    if report.current_approval_level != approval.level:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This approval level is not currently active for this report.")

    approval.status = "APPROVED"
    approval.comment = data.comment
    approval.response_comment = data.response_comment
    approval.actioned_at = datetime.now(timezone.utc)

    await _write_audit_log(db, "EXPENSE_APPROVED", current_user.user_id, tenant_id, {
        "report_id": str(report.id),
        "report_number": report.report_number,
        "level": approval.level,
        "approver_id": str(approval.approver_id),
        "comment": data.comment,
        "response_comment": data.response_comment,
        "total_amount": str(report.total_amount),
    })

    if report.referred_back_from_level is not None:
        # Multi-level refer-back: check if there are more levels to visit
        referred_levels_queue = report.referred_back_levels or []

        if referred_levels_queue:
            next_level = referred_levels_queue[0]
            new_queue = referred_levels_queue[1:]

            next_result = await db.execute(
                select(ExpenseApproval).where(
                    ExpenseApproval.report_id == report.id,
                    ExpenseApproval.level == next_level,
                ).order_by(ExpenseApproval.created_at.desc())
            )
            next_target = next_result.scalars().first()
            if next_target:
                next_target.status = "PENDING"
                next_target.actioned_at = None

                # Notify next referred approver
                next_approver_result = await db.execute(select(User).where(User.id == next_target.approver_id))
                next_approver = next_approver_result.scalar_one_or_none()
                referring_approver_result = await db.execute(select(User).where(User.id == approval.approver_id))
                referring_approver = referring_approver_result.scalar_one_or_none()
                if next_approver and referring_approver:
                    _send_referred_approver_email(
                        to_email=next_approver.email,
                        report_number=report.report_number,
                        referring_approver_name=referring_approver.full_name,
                        referring_level=report.referred_back_from_level,
                        comment=approval.comment or "",
                    )

            report.current_approval_level = next_level
            report.referred_back_levels = new_queue if new_queue else None

        else:
            # All referred levels done — reactivate the referring level
            referring_level = report.referred_back_from_level
            referring_result = await db.execute(
                select(ExpenseApproval).where(
                    ExpenseApproval.report_id == report.id,
                    ExpenseApproval.level == referring_level,
                    ExpenseApproval.status == "REFERRED_BACK",
                ).order_by(ExpenseApproval.created_at.desc())
            )
            referring_approval = referring_result.scalars().first()
            if referring_approval:
                referring_approval.status = "PENDING"
                referring_approval.actioned_at = None

            report.current_approval_level = referring_level
            report.referred_back_from_level = None
            report.referred_back_levels = None
    else:
        # Normal sequential chain — advance to the next PENDING level
        next_result = await db.execute(
            select(ExpenseApproval).where(
                ExpenseApproval.report_id == report.id,
                ExpenseApproval.level == approval.level + 1,
                ExpenseApproval.status == "PENDING",
            ).order_by(ExpenseApproval.created_at.desc())
        )
        next_approval = next_result.scalars().first()

        if next_approval:
            report.current_approval_level = next_approval.level

            # Notify the next approver
            matrix = await _get_matrix(tenant_id, db)
            next_approver_result = await db.execute(select(User).where(User.id == next_approval.approver_id))
            next_approver = next_approver_result.scalar_one_or_none()
            employee_result = await db.execute(select(User).where(User.id == report.employee_id))
            employee = employee_result.scalar_one_or_none()
            if next_approver and employee:
                _send_approver_notification_email(
                    to_email=next_approver.email,
                    report_number=report.report_number,
                    report_date=str(report.report_date),
                    total_amount=report.total_amount,
                    employee_name=employee.full_name,
                    role_label=_role_label_for_level(matrix, next_approval.level) if matrix else f"Level {next_approval.level}",
                )
        else:
            # Final approval — report is fully approved
            report.status = "APPROVED"
            report.current_approval_level = None

            # Notify requestor
            employee_result = await db.execute(select(User).where(User.id == report.employee_id))
            employee = employee_result.scalar_one_or_none()
            if employee:
                _send_approval_complete_email(
                    to_email=employee.email,
                    report_number=report.report_number,
                    report_date=str(report.report_date),
                    total_amount=report.total_amount,
                )

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

    Sets rejected_at_level so smart resubmission resumes from this level.
    Sends a rejection email to the employee.
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You are not the designated approver for this record.")
    if approval.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This approval record has already been actioned.")

    report = await _get_report_or_404(approval.report_id, tenant_id, db)

    if report.current_approval_level != approval.level:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This approval level is not currently active for this report.")

    approval.status = "REJECTED"
    approval.comment = data.comment
    approval.actioned_at = datetime.now(timezone.utc)

    report.status = "REJECTED"
    report.rejection_comment = data.comment
    report.rejected_at_level = approval.level
    report.referred_back_from_level = None
    report.referred_back_levels = None
    report.current_approval_level = None

    await db.flush()

    await _write_audit_log(db, "EXPENSE_REJECTED", current_user.user_id, tenant_id, {
        "report_id": str(report.id),
        "report_number": report.report_number,
        "level": approval.level,
        "approver_id": str(approval.approver_id),
        "comment": data.comment,
        "total_amount": str(report.total_amount),
        "rejected_at_level": approval.level,
    })

    employee_result = await db.execute(select(User).where(User.id == report.employee_id))
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


# ── Refer Back ────────────────────────────────────────────────────────────────

@router.post("/{approval_id}/refer-back", response_model=ExpenseReportResponse)
async def refer_back(
    approval_id: uuid.UUID,
    data: ReferBackRequest,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    """
    Refer back an expense report from the current approval level.

    target_type = "requestor": report → REFERRED_TO_REQUESTOR.
      visible_to_requestor controls whether the requestor can see the comment.
      On resubmit, the chain resumes at the referring level.

    target_type = "approver": activates one or more lower levels for consultation
      via target_levels (list, visited in ascending order). After all complete,
      control returns to the referring level.
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You are not the designated approver for this record.")
    if approval.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This approval record has already been actioned.")

    report = await _get_report_or_404(approval.report_id, tenant_id, db)

    if report.current_approval_level != approval.level:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This approval level is not currently active for this report.")

    # Mark the referring approval as referred back
    approval.status = "REFERRED_BACK"
    approval.comment = data.comment
    approval.visible_to_requestor = data.visible_to_requestor
    approval.actioned_at = datetime.now(timezone.utc)

    if data.target_type == "requestor":
        report.status = "REFERRED_TO_REQUESTOR"
        report.rejection_comment = data.comment
        report.rejected_at_level = approval.level
        report.current_approval_level = None

        await _write_audit_log(db, "EXPENSE_REFERRED_BACK", current_user.user_id, tenant_id, {
            "report_id": str(report.id),
            "report_number": report.report_number,
            "level": approval.level,
            "referring_approver_id": str(approval.approver_id),
            "target_type": "requestor",
            "target_levels": [],
            "comment": data.comment,
            "visible_to_requestor": data.visible_to_requestor,
            "total_amount": str(report.total_amount),
        })

        if data.visible_to_requestor:
            employee_result = await db.execute(select(User).where(User.id == report.employee_id))
            employee = employee_result.scalar_one_or_none()
            if employee:
                _send_refer_back_email(
                    to_email=employee.email,
                    report_number=report.report_number,
                    comment=data.comment,
                    referring_level=approval.level,
                )

    else:
        # target_type == "approver"
        if not data.target_levels:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="target_levels is required when target_type is 'approver'.",
            )

        invalid = [lvl for lvl in data.target_levels if lvl >= approval.level]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"All target levels must be lower than the current level ({approval.level}).",
            )

        sorted_levels = sorted(set(data.target_levels))

        # Verify all target approval records exist
        target_approvals: dict[int, ExpenseApproval] = {}
        for lvl in sorted_levels:
            target_result = await db.execute(
                select(ExpenseApproval).where(
                    ExpenseApproval.report_id == report.id,
                    ExpenseApproval.level == lvl,
                ).order_by(ExpenseApproval.created_at.desc())
            )
            ta = target_result.scalars().first()
            if not ta:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"No approval record found for level {lvl}.",
                )
            target_approvals[lvl] = ta

        # Activate the first (lowest) level; queue the rest
        first_level = sorted_levels[0]
        remaining = sorted_levels[1:]

        first_target = target_approvals[first_level]
        first_target.status = "PENDING"
        first_target.actioned_at = None

        report.current_approval_level = first_level
        report.referred_back_from_level = approval.level
        report.referred_back_levels = remaining if remaining else None

        await _write_audit_log(db, "EXPENSE_REFERRED_BACK", current_user.user_id, tenant_id, {
            "report_id": str(report.id),
            "report_number": report.report_number,
            "level": approval.level,
            "referring_approver_id": str(approval.approver_id),
            "target_type": "approver",
            "target_levels": sorted_levels,
            "comment": data.comment,
            "visible_to_requestor": data.visible_to_requestor,
            "total_amount": str(report.total_amount),
        })

        # Fetch referring approver name for the notification
        referring_approver_result = await db.execute(select(User).where(User.id == approval.approver_id))
        referring_approver = referring_approver_result.scalar_one_or_none()

        first_approver_result = await db.execute(select(User).where(User.id == first_target.approver_id))
        first_approver = first_approver_result.scalar_one_or_none()
        if first_approver and referring_approver:
            _send_referred_approver_email(
                to_email=first_approver.email,
                report_number=report.report_number,
                referring_approver_name=referring_approver.full_name,
                referring_level=approval.level,
                comment=data.comment,
            )

    await db.flush()
    return ExpenseReportResponse.from_orm(await _reload_report(report.id, db))
