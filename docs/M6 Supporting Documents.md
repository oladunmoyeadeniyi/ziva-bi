Milestone 6 — Supporting Documents (File Attachments)

CONTEXT:
- Stack: Next.js 15 + FastAPI + PostgreSQL + Supabase Storage
- M1-M5 complete
- Employees need to attach receipts/invoices to expense lines
- Files stored in Supabase Storage, metadata in PostgreSQL
- Bucket name: documents (already created, private)

SUPABASE CONFIG:
Add these to backend/.env:
SUPABASE_URL=https://qoshtcbdrudbxwrxlfgx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvc2h0Y2JkcnVkYnh3cnhsZmd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3MTE3NiwiZXhwIjoyMDk0OTQ3MTc2fQ.GE_iuKNMRKvUb9QK6LgSNqznHmKpF6uD57uhTHesZ4M
SUPABASE_BUCKET=documents

Install supabase python client:
pip install supabase

---

## 1. DATABASE — New migration

### expense_documents
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- report_id (UUID, FK → expense_reports)
- line_id (UUID, FK → expense_lines, nullable) — if attached 
  to a specific line; null if attached to the report header
- uploaded_by (UUID, FK → users)
- file_name (VARCHAR) — original filename
- file_size (INTEGER) — size in bytes
- mime_type (VARCHAR) — e.g. image/jpeg, application/pdf
- storage_path (VARCHAR) — path in Supabase bucket
- storage_url (VARCHAR) — signed URL cached (nullable)
- created_at (TIMESTAMP)

---

## 2. BACKEND

Create: backend/app/services/storage.py
- Supabase storage service using supabase-py client
- Functions:
  - upload_file(file_bytes, path, mime_type) → storage_path
  - get_signed_url(storage_path, expires_in=3600) → url
  - delete_file(storage_path) → bool

File path pattern in bucket:
{tenant_id}/{report_id}/{line_id or "report"}/{uuid}_{filename}

Create: backend/app/routers/documents.py

All routes require auth. All queries filter by tenant_id.

POST /api/documents/reports/{report_id}/upload
- Multipart form upload
- Fields: file (required), line_id (optional)
- Validate: report must belong to current tenant
- Validate file: max 10MB, allowed types: 
  PDF, JPG, JPEG, PNG, XLSX, DOCX
- Upload to Supabase Storage
- Save metadata to expense_documents table
- Returns: document record with signed URL

GET /api/documents/reports/{report_id}
- List all documents for a report
- Returns signed URLs for each document (1 hour expiry)
- Group by line_id

DELETE /api/documents/{document_id}
- Only uploader or Tenant Admin can delete
- Delete from Supabase Storage
- Delete metadata from DB
- Only allowed if report is DRAFT or REJECTED

Register router in main.py with prefix /api/documents

---

## 3. FRONTEND

### Expense Edit Page (/dashboard/business/expenses/{id}/edit)
Add document upload section below each expense line:

Per line, show:
- "Attach Document" button — opens file picker
- List of attached documents with: filename, size, 
  download icon, delete icon (if report is DRAFT)
- Accepted formats shown: PDF, JPG, PNG, Excel, Word (max 10MB)
- Upload progress indicator while uploading
- Error message if file too large or wrong type

Also add a "Report Documents" section at the bottom for 
documents attached to the report as a whole (not a specific line)

### Expense Detail Page (/dashboard/business/expenses/{id})
Show all attached documents in read-only view:
- Group by line number
- Each document shows: filename, file type icon, size, 
  "View" button (opens signed URL in new tab)
- Approvers can see all documents
- Download button per document

### New Expense Page (/dashboard/business/expenses/new)
Add document upload after saving draft:
- Show message: "Save as draft first to attach documents"
- Once saved as draft, show upload section same as edit page

---

## 4. FILE TYPE ICONS
Use different icons per file type:
- PDF → red document icon
- Image (JPG/PNG) → image icon
- Excel → green spreadsheet icon
- Word → blue document icon

---

## AFTER BUILDING:
1. Install supabase pip package
2. Run Alembic migration
3. Add env vars to backend/.env
4. Test:
   - Create expense, save as draft
   - Attach a PDF to a line
   - Attach an image to another line
   - Submit expense
   - View as approver — confirm documents visible
   - Click View — confirm file opens in new tab
   - Try uploading a file > 10MB — confirm error
5. Commit: "feat: Milestone 6 - Supporting documents"
6. Push to GitHub