# M11 — Accounts Payable (P2P) PRD

**Module code:** `ap`  
**Author:** Cowork  
**Date:** 2026-07-25  
**Status:** APPROVED FOR BUILD  

---

## 1. Purpose

Accounts Payable (AP) is the Purchase-to-Pay process: capturing vendor invoices, routing them for approval, and recording payment. It is the most common daily pain point for any finance team — manual invoice tracking, missed due dates, and unreconciled vendor statements.

This module ships in all three posting modes from the first commit:

| Mode | What it adds |
|---|---|
| **Lite** | Vendor master + bill capture + approval workflow + CSV/Excel export |
| **Connected** | + GL coding per line + `posting_batches` export to external ERP |
| **Full ERP** | + Automatic journal entries on approval and on payment + AP ledger per vendor |

---

## 2. Scope (M11 — this build)

### In scope
- Vendor master (CRUD per tenant)
- AP invoices / bills (header + multi-line)
- Status lifecycle: DRAFT → SUBMITTED → APPROVED → PAID / REJECTED / CANCELLED
- Approval routing: reuses existing designation-based approval matrix (same engine as expenses)
- Finance review chain: reuses existing `FinanceReviewStep` chain
- Supporting documents: reuses existing document upload service (per-invoice attachments)
- CSV + Excel export of approved bills (Lite-equivalent output)
- GL coding per line (Connected + Full ERP)
- `posting_batches` entries on approval (Connected)
- Journal entries on bill approval + on payment (Full ERP)
- Payment recording (mark bill as paid, log bank account + date + reference)
- AP aging report (0–30, 31–60, 61–90, 90+ days past due)
- Sidebar nav + module guard (only visible when `ap` module is active)

### Explicitly out of scope (future milestones)
- 3-way match (requires PO module — M11c or later)
- Batch payment runs with bank file generation
- Vendor portal (self-service invoice submission) — M future
- Recurring / standing invoices
- Multi-currency AP (use functional currency only for now)
- Credit notes / debit notes
- VAT/WHT computation on lines (M19 Tax Engine)

---

## 3. Data Model

### 3.1 `vendors` table

One row per supplier within a tenant.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | tenant-scoped |
| `code` | VARCHAR(20) | unique per tenant, auto-generated if blank |
| `name` | VARCHAR(255) | display name |
| `tax_id` | VARCHAR(50) | nullable — RC number / TIN |
| `email` | VARCHAR(255) | nullable — for remittance advice |
| `phone` | VARCHAR(50) | nullable |
| `address` | TEXT | nullable |
| `bank_name` | VARCHAR(100) | nullable |
| `bank_account_number` | VARCHAR(50) | nullable |
| `bank_sort_code` | VARCHAR(20) | nullable |
| `is_active` | BOOLEAN | default true |
| `notes` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | server default now() |
| `updated_at` | TIMESTAMPTZ | onupdate now() |

Index: `(tenant_id, code)` UNIQUE, `(tenant_id, name)`.

### 3.2 `ap_invoices` table

One row per vendor bill / invoice.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | |
| `vendor_id` | UUID FK → vendors | |
| `invoice_number` | VARCHAR(100) | vendor's own invoice ref |
| `reference` | VARCHAR(100) | internal reference (auto-generated: AP-YYYY-NNNN) |
| `invoice_date` | DATE | date on the vendor invoice |
| `due_date` | DATE | payment due date |
| `currency` | VARCHAR(3) | defaults to tenant functional currency |
| `total_amount` | NUMERIC(18,2) | sum of all line amounts |
| `status` | VARCHAR(20) | DRAFT / SUBMITTED / APPROVED / REJECTED / CANCELLED / PAID |
| `description` | TEXT | nullable — overall memo / narration |
| `posting_mode` | VARCHAR(20) | snapshot of tenant posting mode at submission |
| `submitted_at` | TIMESTAMPTZ | nullable |
| `submitted_by` | UUID FK → users | nullable |
| `approved_at` | TIMESTAMPTZ | nullable |
| `approved_by` | UUID FK → users | nullable |
| `rejected_at` | TIMESTAMPTZ | nullable |
| `rejected_by` | UUID FK → users | nullable |
| `rejection_reason` | TEXT | nullable |
| `paid_at` | TIMESTAMPTZ | nullable |
| `paid_by` | UUID FK → users | nullable |
| `payment_reference` | VARCHAR(255) | nullable — cheque/transfer ref |
| `payment_bank_account_id` | UUID FK → bank_accounts | nullable |
| `journal_entry_id` | UUID FK → journal_entries | nullable — Full ERP only: AP posting on approval |
| `payment_journal_entry_id` | UUID FK → journal_entries | nullable — Full ERP only: payment posting |
| `posting_batch_id` | UUID FK → posting_batches | nullable — Connected only |
| `created_at` | TIMESTAMPTZ | server default |
| `created_by` | UUID FK → users | |

Indexes: `(tenant_id, status)`, `(tenant_id, vendor_id)`, `(tenant_id, due_date)`.

Constraint: `invoice_number` + `vendor_id` + `tenant_id` UNIQUE (prevent duplicate invoices from same vendor).

### 3.3 `ap_invoice_lines` table

One row per line item on an AP invoice.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `invoice_id` | UUID FK → ap_invoices ON DELETE CASCADE | |
| `line_number` | INTEGER | ordering (1-based) |
| `description` | TEXT | line narration |
| `quantity` | NUMERIC(18,4) | default 1 |
| `unit_price` | NUMERIC(18,2) | |
| `amount` | NUMERIC(18,2) | quantity × unit_price |
| `gl_account_id` | UUID FK → gl_accounts | nullable — Connected + Full ERP |
| `dimension_values` | JSONB | nullable — `{dim_id: value_id}` |
| `category_hint` | VARCHAR(100) | nullable — optional tag for Lite mode reporting |

### 3.4 `ap_approvals` table

Mirrors `expense_approvals`. One row per approval action per invoice.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `invoice_id` | UUID FK → ap_invoices | |
| `step_order` | INTEGER | step in the chain |
| `approver_id` | UUID FK → users | |
| `role_id` | UUID FK → approval_roles | |
| `status` | VARCHAR(20) | PENDING / APPROVED / REJECTED / REFERRED_BACK |
| `is_advisory` | BOOLEAN | default false |
| `action_at` | TIMESTAMPTZ | nullable |
| `comment` | TEXT | nullable |
| `tenant_id` | UUID FK → tenants | for fast tenant-scoped queries |

### 3.5 `ap_invoice_snapshots` table

Immutable audit record captured at submission (mirrors `expense_report_snapshots`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `invoice_id` | UUID FK → ap_invoices | |
| `snapshot_data` | JSONB | full invoice + lines at time of submission |
| `created_at` | TIMESTAMPTZ | |

---

## 4. Status Lifecycle

```
DRAFT ──► SUBMITTED ──► APPROVED ──► PAID
              │               │
              ▼               ▼
           REJECTED       REJECTED (by finance review)
              │
              ▼
           CANCELLED (only from DRAFT)
```

- **DRAFT** → creator can edit freely
- **SUBMITTED** → locked for editing; triggers approval routing
- **APPROVED** → GL journal / posting_batch created; available for payment recording
- **PAID** → payment journal entry created; aging clock stops
- **REJECTED** → reverts to DRAFT with rejection reason; creator can correct and resubmit
- **CANCELLED** → terminal; only from DRAFT by the creator

---

## 5. Approval Routing

Reuses the existing engine verbatim:

1. On SUBMIT → query `ApprovalPolicy` for the submitter's designation + invoice total
2. Build the approval chain: ceiling check + `FinanceReviewStep` chain (finance_function = `procurement`)
3. Create `ApAproval` rows for each step (status = PENDING)
4. Email first approver via `send_approval_notification_email()`
5. Each approver's APPROVE advances to next step; REJECT triggers rejection flow
6. Final approver APPROVE → set invoice status = APPROVED → trigger GL/batch action

The `procurement` system function (already seeded in `system_functions`) maps to the organisational node responsible for AP approvals.

---

## 6. GL Posting — Full ERP Mode

### 6.1 On bill APPROVAL

```
DR  <expense GL account>   amount   (per line — from gl_account_id)
CR  accounts_payable        total    (from posting_roles → tenant_posting_role_settings)
```

- One journal entry per invoice
- Journal date = invoice `invoice_date`
- Reference = invoice `reference` (e.g. AP-2026-0001)
- Description = `AP: {vendor_name} — {invoice_number}`
- Lines = one DR per invoice line + one CR for the AP control account total
- Sets `ap_invoices.journal_entry_id`

### 6.2 On PAYMENT recording

```
DR  accounts_payable        amount   (the control account — reverses the creditor)
CR  <bank GL account>       amount   (from bank_accounts.gl_account_id)
```

- Journal date = payment date
- Reference = `PMT-{invoice_reference}`
- Sets `ap_invoices.payment_journal_entry_id`

---

## 7. Connected Mode — posting_batches

On bill APPROVAL in Connected mode:
- Create one `PostingBatch` row (module = `ap`, status = `pending`)
- Payload JSONB contains the full invoice + lines with GL codes + dimensions
- Sets `ap_invoices.posting_batch_id`
- The posting_batches export endpoint (already built) handles download/sync to external ERP

---

## 8. Lite Mode — CSV / Excel Export

Same pattern as expense CSV export:
- `GET /api/ap/invoices/export?status=APPROVED&from=&to=` → CSV
- `GET /api/ap/invoices/export?format=xlsx` → Excel
- Columns: Reference, Vendor Code, Vendor Name, Invoice Number, Invoice Date, Due Date, Currency, Amount, Description, Status, Approved By, Approved At

---

## 9. AP Aging Report

`GET /api/ap/aging?as_at_date=YYYY-MM-DD`

Buckets all APPROVED + unpaid invoices by days past due:

| Bucket | Days past due |
|---|---|
| Current | Not yet due |
| 1–30 days | 1–30 |
| 31–60 days | 31–60 |
| 61–90 days | 61–90 |
| 90+ days | > 90 |

Response: per-vendor rows with bucket totals + grand total per bucket.

---

## 10. API Endpoints

### Vendors
| Method | Path | Description |
|---|---|---|
| GET | `/api/ap/vendors` | List vendors (active only by default) |
| POST | `/api/ap/vendors` | Create vendor |
| GET | `/api/ap/vendors/{id}` | Get vendor detail |
| PATCH | `/api/ap/vendors/{id}` | Update vendor |
| DELETE | `/api/ap/vendors/{id}` | Deactivate vendor (soft) |

### Invoices
| Method | Path | Description |
|---|---|---|
| GET | `/api/ap/invoices` | List invoices (filterable by status, vendor, date range) |
| POST | `/api/ap/invoices` | Create draft invoice |
| GET | `/api/ap/invoices/{id}` | Get invoice detail with lines + approvals |
| PATCH | `/api/ap/invoices/{id}` | Update draft invoice |
| DELETE | `/api/ap/invoices/{id}` | Cancel draft invoice |
| POST | `/api/ap/invoices/{id}/submit` | Submit for approval |
| POST | `/api/ap/invoices/{id}/approve` | Approve current step |
| POST | `/api/ap/invoices/{id}/reject` | Reject invoice |
| POST | `/api/ap/invoices/{id}/pay` | Record payment |
| GET | `/api/ap/invoices/export` | CSV / Excel export |

### Reporting
| Method | Path | Description |
|---|---|---|
| GET | `/api/ap/aging` | AP aging report |

### Documents (reuse existing)
| Method | Path | Description |
|---|---|---|
| POST | `/api/documents/upload` | Upload attachment (entity_type=ap_invoice) |
| GET | `/api/documents/{id}` | Download / signed URL |

---

## 11. Frontend Pages

All pages live under `/dashboard/business/ap/`:

| Route | Description |
|---|---|
| `/vendors` | Vendor list + create/edit modal |
| `/invoices` | Invoice list with status tabs (All / Draft / Pending / Approved / Paid) |
| `/invoices/new` | Create invoice form |
| `/invoices/[id]` | Invoice detail + approval timeline + payment action |
| `/aging` | AP aging report page |

Sidebar section: **Accounts Payable** (only visible when `ap` module is active).  
Sub-links: Vendors, Invoices, AP Aging.

---

## 12. Module Guard

All AP pages check that the `ap` module is active for the tenant. If not:
- Show `ModeNotAvailable` with message: "Accounts Payable module is not active for your organisation."

---

## 13. Seed Data

The `procurement` system function is already seeded.  
No additional seeding needed — vendors are tenant-created data.

---

## 14. Build Order

1. **Migration** — `vendors`, `ap_invoices`, `ap_invoice_lines`, `ap_approvals`, `ap_invoice_snapshots`
2. **Backend models** — `Vendor`, `ApInvoice`, `ApInvoiceLine`, `ApApproval`, `ApInvoiceSnapshot`
3. **Backend schemas + router** — vendor CRUD + invoice lifecycle + approval + payment + export + aging
4. **Backend service** — `ap_posting.py` (GL journal on approval + payment, posting_batch on Connected)
5. **Frontend** — Vendor page, Invoice list, Invoice new/detail, Aging report
6. **Sidebar** — AP section (module-gated)
7. **PENDING_COMMIT.md** → CC review + commit
