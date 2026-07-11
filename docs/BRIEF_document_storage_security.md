# BRIEF — Document Storage, Security & Cost Optimisation
**Date:** 2026-07-11  
**Status:** Approved — ready for implementation  
**Affects:** `backend/app/services/storage.py`, `backend/app/models/documents.py`, migration, all upload/download handlers

---

## 1. Problem Statement

Current document storage has four gaps:
1. **Signed URLs expire in 1 hour** — too long; a leaked URL gives 60 minutes of access.
2. **No file integrity check** — malicious files can be uploaded; no hash means we can't detect tampering or duplicates.
3. **No compression** — images and PDFs uploaded raw; storage grows faster than necessary.
4. **Long-term cost** — Supabase Storage charges for egress. An ERP with thousands of documents across many tenants will produce significant egress fees as documents are downloaded repeatedly.

---

## 2. Decisions

### 2.1 Signed URL Expiry → 15 minutes
Change `storage.py` `create_signed_url()` call from `expires_in=3600` to `expires_in=900` (15 minutes).

Rationale: Finance documents are accessed in-session. If a user needs to view a document again, the UI calls the endpoint again and gets a fresh URL. 15 minutes is the industry standard for signed document URLs (AWS, Azure, GCS all recommend 5–15 mins for sensitive financial docs).

### 2.2 SHA-256 File Hash
Compute `hashlib.sha256(file_bytes).hexdigest()` on upload, store in `expense_documents.file_hash`. Purpose: integrity verification, deduplication, audit trail. Algorithm stored in `file_hash_algorithm` (value: `'sha256'`).

### 2.3 Magic Bytes Validation
Check the actual file content signature (first ~12 bytes), not just the `Content-Type` header, on every upload. Accepted types for financial documents: JPEG, PNG, GIF, WEBP, PDF. Any other magic bytes → 400 error, file rejected.

```python
MAGIC_SIGNATURES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
    b'RIFF': 'image/webp',  # + check bytes 8-11 for 'WEBP'
    b'%PDF': 'application/pdf',
}
```

### 2.4 Image Compression Pipeline (Pillow)
On upload, if file is an image (JPEG/PNG/GIF/WEBP):
1. Resize to max 2000×2000 px (maintaining aspect ratio, no upscale)
2. Convert to WebP (quality 82)
3. If WebP is larger than original, keep original

Store `size_stored` (compressed bytes) alongside `file_size` (original bytes).

**Dependency:** `Pillow` is already in most Python environments; confirm in `requirements.txt`.

### 2.5 PDF Compression (pikepdf)
On upload, if file is a PDF:
1. Run `pikepdf.compress_streams()` + remove XMP metadata
2. If compressed PDF < original by >5%, use compressed version

**Dependency:** Add `pikepdf` to `requirements.txt`.

### 2.6 Hash-Based Deduplication
Before uploading to storage:
1. Query `expense_documents` WHERE `tenant_id = X AND file_hash = <computed_hash>`
2. If match found: store a reference (`dedup_ref = existing_document.id`), skip Supabase upload, point new record to same storage path
3. If no match: upload normally

This means a receipt image submitted by 10 employees is stored once in Supabase, referenced 10 times in the DB.

### 2.7 Access Audit Log (in-DB)
Table: `document_access_log`  
Columns: `id`, `document_id`, `accessed_by` (user_id FK), `tenant_id`, `accessed_at`, `access_type` (`view | download | upload | delete`), `ip_address` (optional, from request headers)

All signed URL generations (view/download) and uploads are logged here. Retention: 7 years (matches FIRS 6-year rule + 1 year buffer).

### 2.8 Retention Policy
NDPR 2019 + CAMA 2020 + FIRS guidelines require financial records retained for minimum 6 years.

Add `retain_until DATE` column to `expense_documents`. Set on upload:
```python
retain_until = date.today() + relativedelta(years=6)
```

Deletion of documents where `retain_until > today()` must be blocked at the API level (return 403 with message "Document is within mandatory retention period"). Hard deletes only allowed after `retain_until` passes.

---

## 3. New DB Columns (expense_documents)

Migration to add to existing `expense_documents` table:

| Column | Type | Purpose |
|---|---|---|
| `file_hash` | `VARCHAR(64)` nullable | SHA-256 hex digest |
| `file_hash_algorithm` | `VARCHAR(10)` nullable | `'sha256'` |
| `size_stored` | `INTEGER` nullable | Bytes stored in Supabase (post-compression) |
| `retain_until` | `DATE` nullable | Mandatory retention expiry |
| `dedup_ref` | `UUID` FK → `expense_documents.id` nullable | Points to original if this is a dedup reference |

New table: `document_access_log` (all columns above in §2.7).

---

## 4. Storage Provider — Cloudflare R2 (Phase 2)

**Current:** Supabase Storage (S3-compatible, $0.021/GB/month, egress billed at $0.09/GB)

**Problem:** As Ziva BI grows to hundreds of tenants with thousands of documents each, the egress cost dominates. An ERP with active daily document viewing creates continuous outbound traffic.

**Decision:** Migrate to Cloudflare R2 once tenants > 5 (or storage exceeds 5 GB).

| | Supabase Storage | Cloudflare R2 |
|---|---|---|
| Storage | $0.021/GB/month | $0.015/GB/month |
| Egress | $0.09/GB | **$0.00** |
| API ops | Included | $0.36/million Class B |
| S3 compat | ✅ | ✅ |
| Drop-in swap | Yes (same boto3 interface) | Yes |

**Migration plan:**
1. Stand up R2 bucket, configure env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`)
2. Rewrite `storage.py` to use `boto3` S3 client (R2 is S3-compatible; `endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"`)
3. Run migration script: iterate all `expense_documents`, copy blob from Supabase to R2, update `storage_path` if needed
4. Switch `STORAGE_PROVIDER` env var to `'r2'`; `storage.py` factory reads this and returns correct client
5. After 30 days (verify no Supabase storage reads in logs), remove Supabase Storage bucket

This is a Phase 2 task. Phase 1 (security hardening below) does NOT require R2. Everything is implemented against the current Supabase interface; the R2 swap is a client swap, not a logic change.

---

## 5. Build Sequence

### Phase 1 — Security Hardening (implement first, minimal risk)

1. `storage.py` — change `expires_in` to `900`
2. Migration — add `file_hash`, `file_hash_algorithm`, `size_stored`, `retain_until`, `dedup_ref` to `expense_documents`
3. Migration — create `document_access_log` table
4. Upload handler — add magic bytes validation (before file touches storage)
5. Upload handler — add SHA-256 hash computation
6. Upload handler — add deduplication check (hash lookup before upload)
7. Upload handler — add image compression (Pillow) + PDF compression (pikepdf)
8. Upload handler — set `retain_until` on create
9. Download handler — add access log entry on signed URL generation
10. Delete handler — block deletion if `retain_until > today()`

### Phase 2 — R2 Migration (when ready to scale)

11. Stand up R2 bucket
12. Rewrite `storage.py` as dual-provider factory (`STORAGE_PROVIDER` env var)
13. Write `scripts/migrate_storage_r2.py` — copies all blobs, verifies hash match
14. Run migration, update env var, verify, decommission Supabase storage

---

## 6. File Size Limits

Policy (to codify in upload validation):
- Images: 10 MB (raw) / ~3 MB expected after compression
- PDFs: 20 MB (raw) / ~5–8 MB expected after compression
- Any other type: rejected

These limits prevent abuse and keep storage costs bounded. Configurable per tenant in the future via `tenant_org_config.max_document_size_mb`.

---

## 7. Dependencies to Add

```
# requirements.txt
Pillow>=10.4.0
pikepdf>=9.0.0
python-dateutil>=2.9.0  # for relativedelta (retention date calc)
```

`python-dateutil` may already be present (check before adding).
