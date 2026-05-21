"""
ZivaBI — supporting documents router (Milestone 6).

Handles file attachments for expense reports. Files are stored in Supabase
Storage; this router manages metadata in the expense_documents table and
acts as a proxy for upload/delete operations.

Endpoints:
    POST   /api/documents/reports/{report_id}/upload   Upload a file
    GET    /api/documents/reports/{report_id}           List docs for a report
    DELETE /api/documents/{document_id}                 Delete a doc

Auth required on all routes. All queries scoped by tenant_id.
"""

import asyncio
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.documents import ExpenseDocument
from app.models.expenses import ExpenseLine, ExpenseReport
from app.services import storage

router = APIRouter(prefix="/api/documents", tags=["documents"])

# ── Constants ──────────────────────────────────────────────────────────────────

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

EDITABLE_STATUSES = {"DRAFT", "REJECTED", "REFERRED_TO_REQUESTOR"}

# ── Response schema ────────────────────────────────────────────────────────────


class DocumentResponse(BaseModel):
    """Response shape for a single document record."""

    id: str
    report_id: str
    line_id: str | None
    uploaded_by: str
    file_name: str
    file_size: int
    mime_type: str
    storage_path: str
    signed_url: str | None
    created_at: str

    model_config = {"from_attributes": True}


# ── Helpers ────────────────────────────────────────────────────────────────────


def _require_tenant(current_user: CurrentUser) -> uuid.UUID:
    """Raise 403 for individual (non-tenant) accounts."""
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Document attachments are a business-tier feature.",
        )
    return current_user.tenant_id


async def _get_report_or_404(
    report_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> ExpenseReport:
    """Load a report scoped to the tenant, or raise 404."""
    result = await db.execute(
        select(ExpenseReport).where(
            ExpenseReport.id == report_id,
            ExpenseReport.tenant_id == tenant_id,
        )
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    return report


def _to_response(doc: ExpenseDocument, signed_url: str | None) -> DocumentResponse:
    return DocumentResponse(
        id=str(doc.id),
        report_id=str(doc.report_id),
        line_id=str(doc.line_id) if doc.line_id else None,
        uploaded_by=str(doc.uploaded_by),
        file_name=doc.file_name,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        storage_path=doc.storage_path,
        signed_url=signed_url,
        created_at=doc.created_at.isoformat(),
    )


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.post(
    "/reports/{report_id}/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    report_id: uuid.UUID,
    file: UploadFile = File(...),
    line_id: str | None = Form(default=None),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    """
    Upload a document and attach it to an expense report (or a specific line).

    Validates:
    - Report belongs to the current tenant.
    - Report is in an editable status (DRAFT, REJECTED, REFERRED_TO_REQUESTOR).
    - File size ≤ 10 MB.
    - MIME type is one of PDF, JPG, PNG, XLSX, XLS, DOCX, DOC.
    - line_id (if provided) belongs to the same report.
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot attach documents to a report with status '{report.status}'.",
        )

    # Validate MIME type
    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed. Accepted: PDF, JPG, PNG, XLSX, DOCX.",
        )

    # Read and validate file size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum allowed size is 10 MB.",
        )

    # Validate line_id belongs to this report
    resolved_line_id: uuid.UUID | None = None
    if line_id:
        try:
            resolved_line_id = uuid.UUID(line_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid line_id.")
        line_result = await db.execute(
            select(ExpenseLine).where(
                ExpenseLine.id == resolved_line_id,
                ExpenseLine.report_id == report_id,
            )
        )
        if not line_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense line not found in this report.",
            )

    # Build storage path: {tenant_id}/{report_id}/{line_id or "report"}/{uuid}_{filename}
    folder = str(resolved_line_id) if resolved_line_id else "report"
    safe_filename = (file.filename or "upload").replace(" ", "_")
    storage_path = f"{tenant_id}/{report_id}/{folder}/{uuid.uuid4()}_{safe_filename}"

    # Upload to Supabase (blocking I/O → thread pool)
    try:
        await asyncio.to_thread(storage.upload_file, file_bytes, storage_path, mime)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage upload failed: {exc}",
        )

    # Persist metadata
    doc = ExpenseDocument(
        tenant_id=tenant_id,
        report_id=report_id,
        line_id=resolved_line_id,
        uploaded_by=current_user.id,
        file_name=file.filename or "upload",
        file_size=len(file_bytes),
        mime_type=mime,
        storage_path=storage_path,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Generate signed URL for immediate use
    try:
        signed_url = await asyncio.to_thread(storage.get_signed_url, doc.storage_path)
    except RuntimeError:
        signed_url = None

    return _to_response(doc, signed_url)


@router.get("/reports/{report_id}", response_model=list[DocumentResponse])
async def list_documents(
    report_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentResponse]:
    """
    List all documents attached to a report, with fresh signed URLs.

    Returns documents grouped implicitly by line_id (null = report-level).
    Approvers can call this endpoint to view supporting documents before acting.
    """
    tenant_id = _require_tenant(current_user)
    await _get_report_or_404(report_id, tenant_id, db)

    result = await db.execute(
        select(ExpenseDocument)
        .where(
            ExpenseDocument.report_id == report_id,
            ExpenseDocument.tenant_id == tenant_id,
        )
        .order_by(ExpenseDocument.created_at)
    )
    docs = result.scalars().all()

    responses: list[DocumentResponse] = []
    for doc in docs:
        try:
            signed_url = await asyncio.to_thread(storage.get_signed_url, doc.storage_path)
        except RuntimeError:
            signed_url = None
        responses.append(_to_response(doc, signed_url))

    return responses


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a document from storage and the database.

    Only the uploader or a Tenant Admin can delete.
    Only allowed while the report is DRAFT, REJECTED, or REFERRED_TO_REQUESTOR.
    """
    tenant_id = _require_tenant(current_user)

    result = await db.execute(
        select(ExpenseDocument).where(
            ExpenseDocument.id == document_id,
            ExpenseDocument.tenant_id == tenant_id,
        )
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Permission check
    if doc.uploaded_by != current_user.id and not current_user.is_tenant_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the uploader or a Tenant Admin can delete documents.",
        )

    # Status guard
    report = await _get_report_or_404(doc.report_id, tenant_id, db)
    if report.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete documents from a report with status '{report.status}'.",
        )

    # Delete from Supabase Storage
    try:
        await asyncio.to_thread(storage.delete_file, doc.storage_path)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage delete failed: {exc}",
        )

    await db.delete(doc)
    await db.commit()
