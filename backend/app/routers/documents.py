"""
ZivaBI — supporting documents router (Milestone 6 + document security hardening).

Handles file attachments for expense reports. Files are stored in Supabase
Storage; this router manages metadata in the expense_documents table and
acts as a proxy for upload/delete operations.

Security hardening (task #53):
- Magic bytes validation: file content signature checked, not just Content-Type.
  Accepted types: JPEG, PNG, GIF, WEBP, PDF only.
- SHA-256 hash computed on upload for integrity + deduplication
  (stored in expense_documents.file_hash in task #55 after migration).
- Type-aware size limits: images <= 10 MB raw, PDFs <= 20 MB raw.
- Signed URL expiry: 15 minutes (changed in storage.py).

Endpoints:
    POST   /api/documents/reports/{report_id}/upload   Upload a file
    GET    /api/documents/reports/{report_id}           List docs for a report
    DELETE /api/documents/{document_id}                 Delete a doc

Auth required on all routes. All queries scoped by tenant_id.
"""

import asyncio
import hashlib
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

# Accepted MIME types — mirrors magic-byte check. Images + PDF only.
# Word/Excel removed: macro risk; magic bytes cannot reliably distinguish
# clean vs malicious Office files without full parsing.
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

# Per-type raw upload size limits (before compression in task #55).
MAX_FILE_SIZES: dict[str, int] = {
    "application/pdf": 20 * 1024 * 1024,  # 20 MB
    "image/jpeg":      10 * 1024 * 1024,  # 10 MB
    "image/png":       10 * 1024 * 1024,  # 10 MB
    "image/gif":       10 * 1024 * 1024,  # 10 MB
    "image/webp":      10 * 1024 * 1024,  # 10 MB
}

# Global ceiling — reject before full body is processed.
MAX_GLOBAL_SIZE = 20 * 1024 * 1024  # 20 MB

# Magic bytes signatures: (prefix, optional_suffix, suffix_offset, mime_type).
# WEBP: RIFF header (bytes 0-3) + WEBP marker (bytes 8-11).
MAGIC_SIGNATURES: list[tuple[bytes, bytes | None, int, str]] = [
    (b"\xff\xd8\xff",       None,     0, "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", None,     0, "image/png"),
    (b"GIF87a",             None,     0, "image/gif"),
    (b"GIF89a",             None,     0, "image/gif"),
    (b"RIFF",               b"WEBP",  8, "image/webp"),
    (b"%PDF",               None,     0, "application/pdf"),
]

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


def _detect_mime_from_magic(file_bytes: bytes) -> str | None:
    """
    Inspect the leading bytes of a file and return the canonical MIME type.

    Checks against MAGIC_SIGNATURES. WEBP requires both a RIFF prefix and a
    WEBP marker at bytes 8-11. Returns None if no signature matches.

    Args:
        file_bytes: raw file content (first 12 bytes are sufficient).

    Returns:
        MIME type string (e.g. ``"image/jpeg"``) or ``None``.

    Example:
        >>> _detect_mime_from_magic(b'%PDF-1.4...')
        'application/pdf'
    """
    for prefix, suffix, suffix_offset, mime in MAGIC_SIGNATURES:
        if file_bytes[: len(prefix)] == prefix:
            if suffix is None:
                return mime
            end = suffix_offset + len(suffix)
            if len(file_bytes) >= end and file_bytes[suffix_offset:end] == suffix:
                return mime
    return None


def _to_response(doc: ExpenseDocument, signed_url: str | None) -> DocumentResponse:
    """Serialise an ExpenseDocument ORM row to a DocumentResponse."""
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

    Validation order (security-first):
    1. Report exists and belongs to the current tenant.
    2. Report is in an editable status (DRAFT, REJECTED, REFERRED_TO_REQUESTOR).
    3. Read file bytes; apply global 20 MB ceiling.
    4. Magic bytes check — file content signature must match an accepted type
       (JPEG, PNG, GIF, WEBP, PDF). The client-supplied Content-Type header
       is ignored; magic bytes are authoritative.
    5. Per-type size limit (images <= 10 MB, PDFs <= 20 MB).
    6. SHA-256 hash computed (stored in DB in task #55 after migration adds column).
    7. Validate line_id if provided.
    8. Upload to Supabase; persist metadata.
    """
    tenant_id = _require_tenant(current_user)
    report = await _get_report_or_404(report_id, tenant_id, db)

    if report.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot attach documents to a report with status '{report.status}'.",
        )

    # ── 1. Read bytes + global ceiling ────────────────────────────────────────
    file_bytes = await file.read()
    if len(file_bytes) > MAX_GLOBAL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum allowed size is 20 MB.",
        )

    # ── 2. Magic bytes validation ──────────────────────────────────────────────
    # Detected type is authoritative; Content-Type header is informational only.
    detected_mime = _detect_mime_from_magic(file_bytes)
    if detected_mime is None or detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed. Accepted formats: PDF, JPEG, PNG, GIF, WEBP.",
        )
    mime = detected_mime

    # ── 3. Per-type size limit ─────────────────────────────────────────────────
    type_limit = MAX_FILE_SIZES.get(mime, 10 * 1024 * 1024)
    if len(file_bytes) > type_limit:
        limit_mb = type_limit // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large for type {mime}. Maximum: {limit_mb} MB.",
        )

    # ── 4. SHA-256 hash ────────────────────────────────────────────────────────
    # Computed now; stored in expense_documents.file_hash in task #55 (after
    # the migration in task #54 adds that column).
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    file_hash_algorithm = "sha256"

    # ── 5. Validate line_id ────────────────────────────────────────────────────
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

    # ── 6. Storage path + upload ───────────────────────────────────────────────
    folder = str(resolved_line_id) if resolved_line_id else "report"
    safe_filename = (file.filename or "upload").replace(" ", "_")
    storage_path = f"{tenant_id}/{report_id}/{folder}/{uuid.uuid4()}_{safe_filename}"

    try:
        await asyncio.to_thread(storage.upload_file, file_bytes, storage_path, mime)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage upload failed: {exc}",
        )

    # ── 7. Persist metadata ────────────────────────────────────────────────────
    # file_hash, file_hash_algorithm, size_stored, retain_until, dedup_ref
    # added to this record in task #55 (after migration in task #54).
    doc = ExpenseDocument(
        tenant_id=tenant_id,
        report_id=report_id,
        line_id=resolved_line_id,
        uploaded_by=current_user.user_id,
        file_name=file.filename or "upload",
        file_size=len(file_bytes),
        mime_type=mime,
        storage_path=storage_path,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # ── 8. Signed URL (15-minute expiry — see storage.py) ─────────────────────
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
    List all documents attached to a report, with fresh signed URLs (15-min expiry).

    Returns documents ordered by upload time. Approvers can call this endpoint
    to view supporting documents before acting on an approval.

    Access log entries (view) added in task #55 after migration creates
    document_access_log table.
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

    Permission rules:
    - Only the uploader or a Tenant Admin can delete.
    - Report must be DRAFT, REJECTED, or REFERRED_TO_REQUESTOR.

    Retention block (task #55): once retain_until column exists, deletion is
    additionally blocked if retain_until > today(), returning 403
    "Document is within mandatory retention period."
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
    if doc.uploaded_by != current_user.user_id and not current_user.is_tenant_admin:
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

    # NOTE: Retention block (retain_until > today() → 403) added in task #55.

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
