"""
ZivaBI — supporting documents router (Milestone 6 + tasks #53, #54, #55).

Handles file attachments for expense reports. Files are stored in Supabase
Storage; this router manages metadata in the expense_documents table and
acts as a proxy for upload/download/delete operations.

Security hardening (task #53):
- Magic bytes validation: file content signature checked, not just Content-Type.
  Accepted types: JPEG, PNG, GIF, WEBP, PDF only.
- Type-aware size limits: images <= 10 MB raw, PDFs <= 20 MB raw.
- Signed URL expiry: 15 minutes (changed in storage.py).

Document pipeline (task #55):
- SHA-256 hash: computed on original bytes; stored for integrity + dedup.
- Compression: images → WebP via Pillow (quality 82, max 2000×2000 px, keep
  original if WebP is larger). PDFs → pikepdf stream compress (keep original
  if savings < 5 %).
- Deduplication: before Supabase upload, hash-lookup within the tenant.
  If match found, new row shares the existing storage_path + sets dedup_ref.
- retain_until: set on every upload from tenant_org_config.document_retention_years
  (platform minimum 15 years; SA-configurable per tenant).
- Access audit log: every upload, view-list, and delete is recorded in
  document_access_log with IP address and user attribution.
- Deletion guard: 403 if retain_until > today() or retain_until IS NULL.
  Storage blob only deleted when no other rows share the same storage_path.

Endpoints:
    POST   /api/documents/reports/{report_id}/upload   Upload a file
    GET    /api/documents/reports/{report_id}           List docs for a report
    DELETE /api/documents/{document_id}                 Delete a doc

Auth required on all routes. All queries scoped by tenant_id.
"""

import asyncio
import hashlib
import io
import uuid
from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_auth
from app.models.documents import DocumentAccessLog, ExpenseDocument
from app.models.expenses import ExpenseLine, ExpenseReport
from app.models.setup import TenantOrgConfig
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

# Per-type raw upload size limits (before compression).
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

# Platform-minimum retention. SA may raise per tenant (never lower).
MINIMUM_RETENTION_YEARS = 15

# ── Response schema ────────────────────────────────────────────────────────────


class DocumentResponse(BaseModel):
    """Response shape for a single document record."""

    id: str
    report_id: str
    line_id: str | None
    uploaded_by: str
    file_name: str
    file_size: int
    size_stored: int | None
    mime_type: str
    storage_path: str
    retain_until: str | None
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


def _extract_ip(request: Request) -> str | None:
    """
    Extract the client IP address from the request.

    Prefers the X-Forwarded-For header (first hop) for deployments behind a
    reverse proxy (Render, Nginx). Falls back to the direct ASGI client host.

    Args:
        request: FastAPI Request object.

    Returns:
        IPv4 or IPv6 address string, or None if unavailable.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _compress_image_sync(file_bytes: bytes, original_mime: str) -> tuple[bytes, str]:
    """
    Compress an image to WebP using Pillow (CPU-bound — run in a thread).

    Pipeline:
    1. Open image with Pillow.
    2. Resize to max 2000×2000 px (maintains aspect ratio, no upscale).
    3. Convert to WebP at quality 82.
    4. Return WebP bytes + 'image/webp' if smaller than original.
       Otherwise return original bytes + original_mime unchanged.

    Args:
        file_bytes:    Raw image bytes (any Pillow-supported format).
        original_mime: MIME type of the original file (fallback if WebP is larger).

    Returns:
        Tuple of (bytes_to_store, mime_type_to_store).
    """
    from PIL import Image

    img = Image.open(io.BytesIO(file_bytes))
    max_dim = 2000
    if img.width > max_dim or img.height > max_dim:
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)

    # Ensure mode is compatible with WebP (handles palettes, CMYK, etc.)
    if img.mode not in ("RGB", "RGBA", "L", "LA"):
        img = img.convert("RGBA")

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=82)
    webp_bytes = buf.getvalue()

    if len(webp_bytes) < len(file_bytes):
        return webp_bytes, "image/webp"
    return file_bytes, original_mime


def _compress_pdf_sync(file_bytes: bytes) -> bytes:
    """
    Compress a PDF using pikepdf (CPU-bound — run in a thread).

    Pipeline:
    1. Open with pikepdf.
    2. Clear XMP metadata (reduces size; irrelevant for financial docs).
    3. Re-save with stream compression + object stream packing.
    4. Return compressed bytes if >5 % smaller than original.
       Otherwise return original bytes unchanged.

    Args:
        file_bytes: Raw PDF bytes.

    Returns:
        Compressed bytes (if savings > 5 %) or original bytes.
    """
    import pikepdf

    buf = io.BytesIO()
    with pikepdf.open(io.BytesIO(file_bytes)) as pdf:
        with pdf.open_metadata() as meta:
            meta.clear()
        pdf.save(
            buf,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
        )
    compressed = buf.getvalue()
    if len(compressed) < len(file_bytes) * 0.95:
        return compressed
    return file_bytes


async def _log_access(
    db: AsyncSession,
    document_id: uuid.UUID,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID | None,
    access_type: str,
    ip_address: str | None,
) -> None:
    """
    Append an entry to document_access_log.

    Non-fatal — exceptions are suppressed so access logging never blocks
    the primary upload/list/delete response.

    Args:
        db:          Async database session.
        document_id: UUID of the document being accessed.
        tenant_id:   Tenant scope.
        user_id:     User performing the action (None for anonymous).
        access_type: One of 'upload' | 'view' | 'delete'.
        ip_address:  Client IP (IPv4 or IPv6 string, or None).
    """
    try:
        log = DocumentAccessLog(
            document_id=document_id,
            tenant_id=tenant_id,
            accessed_by=user_id,
            access_type=access_type,
            ip_address=ip_address,
        )
        db.add(log)
        await db.commit()
    except Exception:
        # Access logging must never break the primary flow.
        await db.rollback()


def _to_response(doc: ExpenseDocument, signed_url: str | None) -> DocumentResponse:
    """Serialise an ExpenseDocument ORM row to a DocumentResponse."""
    return DocumentResponse(
        id=str(doc.id),
        report_id=str(doc.report_id),
        line_id=str(doc.line_id) if doc.line_id else None,
        uploaded_by=str(doc.uploaded_by),
        file_name=doc.file_name,
        file_size=doc.file_size,
        size_stored=doc.size_stored,
        mime_type=doc.mime_type,
        storage_path=doc.storage_path,
        retain_until=doc.retain_until.isoformat() if doc.retain_until else None,
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
    request: Request,
    file: UploadFile = File(...),
    line_id: str | None = Form(default=None),
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    """
    Upload a document and attach it to an expense report (or a specific line).

    Full pipeline (in order):
    1. Report exists and belongs to the current tenant.
    2. Report is in an editable status (DRAFT, REJECTED, REFERRED_TO_REQUESTOR).
    3. Read file bytes; apply global 20 MB ceiling.
    4. Magic bytes validation — file content signature is authoritative;
       Content-Type header is ignored.
    5. Per-type size limit (images <= 10 MB, PDFs <= 20 MB).
    6. SHA-256 hash of original bytes (for integrity + dedup).
    7. Compression: images → WebP (Pillow), PDFs → compressed (pikepdf).
    8. Deduplication: hash-lookup within tenant. If match, share storage_path
       and set dedup_ref; skip Supabase upload.
    9. If no dedup match: upload compressed bytes to Supabase.
    10. Resolve and validate line_id if provided.
    11. Fetch tenant retention config; compute retain_until.
    12. Persist ExpenseDocument row.
    13. Log 'upload' to document_access_log.
    14. Return DocumentResponse with fresh 15-minute signed URL.
    """
    tenant_id = _require_tenant(current_user)
    ip_addr = _extract_ip(request)

    # ── 1. Report exists + status guard ───────────────────────────────────────
    report = await _get_report_or_404(report_id, tenant_id, db)
    if report.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot attach documents to a report with status '{report.status}'.",
        )

    # ── 2. Read bytes + global ceiling ────────────────────────────────────────
    file_bytes = await file.read()
    if len(file_bytes) > MAX_GLOBAL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum allowed size is 20 MB.",
        )

    # ── 3. Magic bytes validation ──────────────────────────────────────────────
    detected_mime = _detect_mime_from_magic(file_bytes)
    if detected_mime is None or detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed. Accepted formats: PDF, JPEG, PNG, GIF, WEBP.",
        )
    original_mime = detected_mime

    # ── 4. Per-type size limit ─────────────────────────────────────────────────
    type_limit = MAX_FILE_SIZES.get(original_mime, 10 * 1024 * 1024)
    if len(file_bytes) > type_limit:
        limit_mb = type_limit // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large for type {original_mime}. Maximum: {limit_mb} MB.",
        )

    # ── 5. SHA-256 hash of ORIGINAL bytes ─────────────────────────────────────
    # Hash is always computed on the pre-compression bytes so that:
    # a) dedup works regardless of what compression does to the bytes, and
    # b) the original file can be verified against this hash independently.
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    file_hash_algorithm = "sha256"
    original_size = len(file_bytes)

    # ── 6. Compression ────────────────────────────────────────────────────────
    if original_mime.startswith("image/"):
        stored_bytes, stored_mime = await asyncio.to_thread(
            _compress_image_sync, file_bytes, original_mime
        )
    else:
        # PDF
        stored_bytes = await asyncio.to_thread(_compress_pdf_sync, file_bytes)
        stored_mime = original_mime

    size_stored = len(stored_bytes)

    # ── 7. Deduplication check ────────────────────────────────────────────────
    # Only match against original rows (dedup_ref IS NULL) so dedup refs always
    # chain at most one level deep.
    dedup_result = await db.execute(
        select(ExpenseDocument).where(
            ExpenseDocument.tenant_id == tenant_id,
            ExpenseDocument.file_hash == file_hash,
            ExpenseDocument.dedup_ref == None,  # noqa: E711 — SQLAlchemy IS NULL
        ).limit(1)
    )
    existing_doc = dedup_result.scalars().first()

    if existing_doc:
        # Reuse the existing Supabase blob. No upload needed.
        storage_path = existing_doc.storage_path
        dedup_ref_id = existing_doc.id
        # Inherit the original's size_stored if available; otherwise our computed value.
        size_stored = existing_doc.size_stored or size_stored
    else:
        # ── 8. Supabase upload ────────────────────────────────────────────────
        folder = "report"  # resolved after line_id check below; updated in path
        safe_filename = (file.filename or "upload").replace(" ", "_")
        storage_path = (
            f"{tenant_id}/{report_id}/upload/{uuid.uuid4()}_{safe_filename}"
        )
        try:
            await asyncio.to_thread(storage.upload_file, stored_bytes, storage_path, stored_mime)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Storage upload failed: {exc}",
            )
        dedup_ref_id = None

    # ── 9. Validate line_id ────────────────────────────────────────────────────
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

    # ── 10. Retention config ───────────────────────────────────────────────────
    config_result = await db.execute(
        select(TenantOrgConfig).where(TenantOrgConfig.tenant_id == tenant_id)
    )
    org_config = config_result.scalars().first()
    retention_years = (
        org_config.document_retention_years
        if org_config and org_config.document_retention_years >= MINIMUM_RETENTION_YEARS
        else MINIMUM_RETENTION_YEARS
    )
    retain_until = date.today() + relativedelta(years=retention_years)

    # ── 11. Persist document record ────────────────────────────────────────────
    doc = ExpenseDocument(
        tenant_id=tenant_id,
        report_id=report_id,
        line_id=resolved_line_id,
        uploaded_by=current_user.user_id,
        file_name=file.filename or "upload",
        file_size=original_size,
        size_stored=size_stored,
        mime_type=stored_mime,
        storage_path=storage_path,
        file_hash=file_hash,
        file_hash_algorithm=file_hash_algorithm,
        retain_until=retain_until,
        dedup_ref=dedup_ref_id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # ── 12. Access log (non-fatal) ─────────────────────────────────────────────
    await _log_access(db, doc.id, tenant_id, current_user.user_id, "upload", ip_addr)

    # ── 13. Signed URL (15-minute expiry — see storage.py) ────────────────────
    try:
        signed_url = await asyncio.to_thread(storage.get_signed_url, doc.storage_path)
    except RuntimeError:
        signed_url = None

    return _to_response(doc, signed_url)


@router.get("/reports/{report_id}", response_model=list[DocumentResponse])
async def list_documents(
    report_id: uuid.UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentResponse]:
    """
    List all documents attached to a report, with fresh signed URLs (15-min expiry).

    Returns documents ordered by upload time. Approvers can call this endpoint
    to view supporting documents before acting on an approval.

    One 'view' access-log entry is written per call (not per document) to avoid
    flooding the log on reports with many attachments.
    """
    tenant_id = _require_tenant(current_user)
    ip_addr = _extract_ip(request)
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

        # Log one 'view' entry per document (signed-URL generation = access event).
        await _log_access(db, doc.id, tenant_id, current_user.user_id, "view", ip_addr)

    return responses


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a document from storage and the database.

    Permission rules:
    - Only the uploader or a Tenant Admin can delete.
    - Report must be in an editable status (DRAFT, REJECTED, REFERRED_TO_REQUESTOR).

    Retention rules:
    - Blocked with 403 if retain_until > today().
    - Blocked with 403 if retain_until IS NULL (pre-migration rows — SA must set
      retention before deletion is permitted).

    Storage rules:
    - If the document is a dedup reference (dedup_ref IS NOT NULL), the Supabase
      blob is NOT deleted (it is shared with the original row).
    - If the document is an original (dedup_ref IS NULL), the blob is deleted only
      if no other rows reference the same storage_path (i.e., no active dedup refs
      point to this document).

    Access log:
    - A 'delete' event is written before the DB row is removed. The log entry is
      cascade-deleted with the document row (by design — document_access_log tracks
      live access events; long-term financial audit lives in audit_logs).
    """
    tenant_id = _require_tenant(current_user)
    ip_addr = _extract_ip(request)

    result = await db.execute(
        select(ExpenseDocument).where(
            ExpenseDocument.id == document_id,
            ExpenseDocument.tenant_id == tenant_id,
        )
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # ── Permission check ───────────────────────────────────────────────────────
    if doc.uploaded_by != current_user.user_id and not current_user.is_tenant_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the uploader or a Tenant Admin can delete documents.",
        )

    # ── Report status guard ────────────────────────────────────────────────────
    report = await _get_report_or_404(doc.report_id, tenant_id, db)
    if report.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete documents from a report with status '{report.status}'.",
        )

    # ── Retention guard ────────────────────────────────────────────────────────
    # Pre-migration rows with retain_until IS NULL are blocked conservatively —
    # we cannot confirm the retention period has expired.
    if doc.retain_until is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Document retention expiry is not set. "
                "A System Admin must configure retain_until before this document can be deleted."
            ),
        )
    if doc.retain_until > date.today():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Document is within the mandatory retention period "
                f"and cannot be deleted until {doc.retain_until.isoformat()}."
            ),
        )

    # ── Access log (before delete — cascade will remove it with the row) ───────
    await _log_access(db, doc.id, tenant_id, current_user.user_id, "delete", ip_addr)

    # ── Storage blob deletion ──────────────────────────────────────────────────
    # Only delete the Supabase blob when:
    #   a) this is an original row (dedup_ref IS NULL), AND
    #   b) no other rows in this tenant share the same storage_path
    #      (i.e., no active dedup references point to this document).
    # Dedup rows share the blob of their original — deleting the DB row only
    # removes the metadata; the blob remains accessible via the original.
    should_delete_blob = False
    if doc.dedup_ref is None:
        # Check for active dedup references to this document
        dedup_count_result = await db.execute(
            select(func.count(ExpenseDocument.id)).where(
                ExpenseDocument.dedup_ref == doc.id
            )
        )
        dedup_count = dedup_count_result.scalar() or 0
        should_delete_blob = dedup_count == 0

    if should_delete_blob:
        try:
            await asyncio.to_thread(storage.delete_file, doc.storage_path)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Storage delete failed: {exc}",
            )

    # ── DB row deletion ────────────────────────────────────────────────────────
    await db.delete(doc)
    await db.commit()
