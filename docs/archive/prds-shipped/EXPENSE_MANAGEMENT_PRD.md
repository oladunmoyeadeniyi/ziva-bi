# Ziva BI — Expense Management Module PRD

> **Version:** 2.0 (Unified — Individual + Business)
> **Status:** Active — Build reference for Milestone 3 onward
> **Last updated:** May 2026
> **Owner:** Adeniyi Oladunmoye

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Target Users & Personas](#3-target-users--personas)
4. [Module Scope](#4-module-scope)
5. [Milestone Breakdown](#5-milestone-breakdown)
6. [Individual Tier — Feature Specifications](#6-individual-tier--feature-specifications)
7. [Business Tier — Feature Specifications](#7-business-tier--feature-specifications)
8. [Shared Logic](#8-shared-logic)
9. [Data Model](#9-data-model)
10. [API Requirements](#10-api-requirements)
11. [Accounting & Posting Rules](#11-accounting--posting-rules)
12. [UI/UX Requirements](#12-uiux-requirements)
13. [Security & Compliance](#13-security--compliance)
14. [Reporting & Analytics](#14-reporting--analytics)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Tenant Configuration (Business)](#16-tenant-configuration-business)
17. [Integrations](#17-integrations)
18. [Glossary](#18-glossary)

---

## 1. Overview

The Ziva BI Expense Management Module serves **two distinct user groups** on the same codebase:

- **Individual users** — personal spending tracking, budgeting, bank statement analysis, and personal tax prep.
- **Business users (SMB to Enterprise)** — employee expense submissions, multi-level approvals, GL/dimension mapping, automated posting, travel advances, and full audit compliance.

The `account_type` flag (`individual` | `business`) on the user record controls which experience and features are exposed. The underlying database, API, and posting engine are shared.

**Tagline:** *Zero manual work. 100% automation. Intelligent decision-making.*

This module is the first feature module to be built after the auth foundation (Milestone 2) and is designed to be usable by both account types from day one.

---

## 2. Problem Statement

### 2.1 Individual Users

Most individuals:
- Have no clear picture of where their money goes month to month.
- Rely on memory or manual spreadsheets to track expenses.
- Cannot easily categorise bank transactions or link them to budgets.
- Have no system that connects spending, income, and financial goals in one place.
- Do not prepare for personal taxes until it is too late.

Ziva BI solves this by giving individuals a clean, intelligent personal finance tracker that starts with manual entry and evolves into a bank-connected, AI-powered money management tool.

### 2.2 Business Users

Most organisations — particularly in Africa and emerging markets — still manage employee expenses via:
- Excel templates filled manually by employees.
- Email-based approval chains with no visibility or tracking.
- Finance teams manually checking receipts and correcting GL errors.
- Month-end close delayed by 1–3 days due to unprocessed expense retirements.
- Audit risk from missing documents and inconsistent filing.

**Red Bull Nigeria example (real workflow this module replaces):**
- Employee fills Excel template → emails manager for approval → forwards to Finance with scanned receipts → Finance saves to structured folders → manually reviews and posts to Sage X3 → emails queries back and forth → compiles summary schedule → line manager approves → uploads to bank.
- Pain: Power Query crashing at scale, manual duplicate checking, no real-time status visibility.

Ziva BI replaces this entirely with a structured, automated, auditable workflow.

---

## 3. Target Users & Personas

### 3.1 Individual Tier

| Persona | Description |
|---|---|
| Individual User | A person tracking personal income and expenses. May be salaried, self-employed, or a freelancer. Primary goal: clarity on spending and savings. |

### 3.2 Business Tier

| Persona | Description |
|---|---|
| Employee (Submitter) | Submits reimbursable expenses and travel advance retirements. |
| Line Manager (LM) | First approver. Verifies business justification. |
| Head of Department (HOD) | Optional second approver. Budget-level oversight. |
| General Manager (GM) | High-value or sensitive transaction approver. |
| Finance AP Analyst | Validates GL, dimensions, VAT, duplicates. Can edit and adjust. |
| Finance Manager / Controller | Final approver before posting. Schedules payments. |
| CFO / Executive | Dashboard visibility. Optional high-value approver. |
| Internal / External Auditor | Read-only. Downloads evidence bundles. |
| Tenant Admin | Configures the module for the company. Manages COA, dimensions, workflows, users. |
| Ziva BI Super Admin | Platform-level. Manages all tenants and modules. |

---

## 4. Module Scope

### 4.1 In Scope — Individual Tier

- Manual expense entry (description, amount, category, date)
- Expense categorisation (Food, Transport, Utilities, Entertainment, etc.)
- Income entry
- Personal budget setup and tracking
- Bank statement upload + AI-powered transaction categorisation
- Personal expense reports and trend charts
- Document vault (receipts, statements, tax documents)
- Personal tax preparation support (jurisdiction-aware, Phase 2+)
- Live bank connection (Phase 2+)

### 4.2 In Scope — Business Tier

- Employee expense reimbursement (multi-line, multi-receipt)
- Travel advance request, tracking, and retirement
- Multi-level configurable approval workflow
- Finance review and adjustment (GL, dimensions, VAT)
- OCR receipt scanning and auto-extraction
- Duplicate invoice detection engine
- Automated GL/dimension posting (DR/CR)
- VAT validation on receipts (not withholding — see Section 8)
- FX handling (multi-currency)
- Audit trail and evidence bundle export
- Reporting and analytics (employee, manager, finance, CFO, auditor)

### 4.3 Out of Scope (Both Tiers)

- Payroll processing (integration only)
- Vendor invoice management (AP Module)
- Inventory / Fixed Asset acquisition (separate modules)
- Travel booking
- Corporate card management (future)
- Multi-entity consolidation (ICE Module)

---

## 5. Milestone Breakdown

This module is built incrementally. Each milestone is independently deployable and testable.

### Individual Milestones

| Milestone | Scope | Status |
|---|---|---|
| M3-I | Manual expense entry — log a personal expense, save to DB, list on dashboard | **Next** |
| M4-I | Bank statement upload + AI categorisation | Planned |
| M5-I | Personal budget setup and tracking vs. actuals | Planned |
| M6-I | Live bank connection (Mono/Plaid API) | Planned |
| M7-I | Personal reports and trend analysis | Planned |

### Business Milestones

| Milestone | Scope | Status |
|---|---|---|
| M3-B | Employee expense submission — multi-line form, receipt upload, saved to DB | **Next** |
| M4-B | Approval workflow — submitted → manager → finance → approved | Planned |
| M5-B | OCR receipt extraction | Planned |
| M6-B | Travel advance request and retirement | Planned |
| M7-B | Automated GL posting + accounting engine | Planned |
| M8-B | Duplicate invoice detection | Planned |
| M9-B | Audit portal + evidence bundle export | Planned |
| M10-B | Reporting and analytics | Planned |

> **M3 is the active build target.** Both individual and business M3 run in parallel as they share the same expense entry infrastructure.

---

## 6. Individual Tier — Feature Specifications

### 6.1 M3-I: Manual Expense Entry

**Done definition:** Individual user can log a personal expense, and it appears on their dashboard.

**Fields per expense:**
- Date
- Amount
- Currency (default: user's home currency)
- Category (Food, Transport, Utilities, Entertainment, Health, Shopping, Other)
- Description (optional)
- Receipt attachment (optional)

**Behaviour:**
- User selects "+ New Expense" from personal dashboard.
- Form validates required fields (date, amount, category).
- On save: expense stored to DB, listed on dashboard with running monthly total.
- Expenses editable and deletable (no approval flow for individuals).

**Dashboard widgets after M3-I:**
- Total spent this month
- Spend by category (simple list)
- Recent transactions (last 10)

---

### 6.2 M4-I: Bank Statement Upload + AI Categorisation

**Done definition:** Individual can upload a bank statement (PDF or CSV), and Ziva BI extracts and categorises transactions automatically.

**Supported formats:** PDF (text-based), CSV, Excel.

**AI behaviour:**
- Each transaction line is sent to the AI categorisation engine.
- Engine assigns: Category, Confidence Score, suggested description.
- Confidence ≥ 85%: auto-categorised.
- Confidence 60–85%: user must confirm category.
- Confidence < 60%: user must manually assign.

**User flow:**
1. Upload statement.
2. Ziva BI parses transactions.
3. Preview screen shows all transactions with suggested categories.
4. User reviews, confirms, or overrides.
5. On confirm: all transactions saved as expenses.

**Duplicate prevention:** If a transaction date + amount + description already exists, system flags it before import.

---

### 6.3 M5-I: Personal Budget Engine

**Done definition:** Individual can set monthly category budgets and see actual vs. budget on dashboard.

**Features:**
- Set monthly budget per category (e.g., Food: ₦50,000/month).
- Dashboard shows progress bar: spent vs. budget per category.
- Alert when 80% of any category budget is reached.
- Alert when any category is exceeded.

---

### 6.4 M6-I: Live Bank Connection

**Done definition:** Individual can connect a bank account and transactions sync automatically.

**Provider:** Mono (Nigeria) as first integration. Plaid for future international.

**Behaviour:**
- Same categorisation engine as M4-I, running on each new sync.
- Sync runs daily or on-demand.
- User can disconnect at any time.

---

### 6.5 M7-I: Personal Reports

**Done definition:** Individual can view spending trends over time and export a report.

**Reports:**
- Monthly spending by category (bar chart)
- Income vs. expense (line chart)
- Savings rate
- Year-to-date summary
- Export: PDF, CSV

---

## 7. Business Tier — Feature Specifications

### 7.1 M3-B: Expense Submission (No Approval Yet)

**Done definition:** Business employee can submit a multi-line expense reimbursement, attach receipts, and see it listed on their dashboard with status "Submitted."

**Expense Request fields:**
- Request type: `REIMBURSEMENT` | `ADVANCE_RETIREMENT`
- Employee ID (from session)
- Submission date
- Total amount (auto-calculated)
- Status
- Tenant ID

**Expense Line fields:**
- PL Group
- P&L Line
- GL Account
- Real IO (if tenant-enabled)
- Statistical IO (if tenant-enabled)
- Material IO (if tenant-enabled)
- Cost Center
- Location
- Invoice Number
- Invoice Date
- Description
- Amount
- Currency
- Receipt attachment(s)

**Dynamic rules:**
- GL options filter based on selected PL Group / P&L Line.
- Dimensions filter based on GL mapping.
- Fields can be made mandatory, optional, or hidden per tenant config.
- System enforces N/A automatically where a dimension is not applicable.

**Receipt upload:**
- Drag-and-drop or click to attach per line.
- Supported formats: PDF, JPG, PNG.
- Max size: tenant-configurable (default 5MB per file).
- Receipt stored to Cloudflare R2, path saved to DB.

**Validations before submit:**
- All mandatory fields populated.
- At least one line exists.
- Each line has at least one receipt (if tenant policy requires).
- No negative amounts.

**Auto-save:** Every 5 seconds as draft.

**On submit:**
- Status = `SUBMITTED`
- In M3, no approval workflow yet — status stays Submitted until M4-B introduces workflow.

---

### 7.2 M4-B: Approval Workflow

**Done definition:** Submitted expenses route through the configured approval chain and Finance can approve/reject/query.

**Approval levels (tenant-configurable):**
```
Employee → Line Manager → HOD → GM → Finance Analyst → Finance Manager → CFO (optional)
```

**Routing rules:**
- Amount-based: e.g., > ₦500,000 requires GM approval.
- Role-based: configured per tenant.
- Delegation: if approver is absent, routes to fallback.

**Approver actions per request:**
- Approve (full request or line-by-line)
- Reject (mandatory reject reason required)
- Query (line-level or full request)

**SLA timers:**
- Each approval stage has a configurable deadline.
- Reminders at 50% and 90% of deadline.
- Auto-escalation if deadline exceeded.

**States:**
- `DRAFT`
- `SUBMITTED`
- `PENDING_LM_APPROVAL`
- `PENDING_HOD_APPROVAL`
- `PENDING_GM_APPROVAL`
- `PENDING_FINANCE_REVIEW`
- `PENDING_CFO_APPROVAL`
- `APPROVED_READY_FOR_POSTING`
- `POSTED`
- `PAID`
- `REJECTED`
- `QUERIED`

**Query/Response flow:**
1. Approver/Finance raises a query (line-level or full request).
2. Employee receives notification and must respond or correct.
3. Employee resubmits.
4. Audit log stores: query message, response, all changes with timestamp + user ID.

**Rejection flow:**
- Mandatory reject reason.
- Employee may correct and resubmit OR permanently delete.
- If Finance rejects after partial approval: approved lines remain; only rejected lines return to employee.

---

### 7.3 M5-B: OCR Receipt Extraction

**Done definition:** When a receipt is uploaded, the system automatically extracts invoice fields and pre-fills the expense line.

**Extracted fields:**
- Vendor name
- Invoice number
- Invoice date
- Currency
- Amount
- VAT amount (if printed)
- Description tokens

**Confidence handling:**
- ≥ 85%: auto-fill immediately.
- 60–85%: employee must confirm.
- < 60%: employee must manually enter.

**Override:** Employee can always override OCR values.

**Receipt types supported:**
- Scanned image (JPG, PNG)
- Photographed via mobile camera
- PDF (single or multi-page)

---

### 7.4 M6-B: Travel Advance & Retirement

**Done definition:** Employee can request a travel advance, retire it, and system correctly calculates over/under spend.

**Advance request:**
- Employee requests advance amount + currency + trip ID.
- Routes through same approval workflow.
- On approval: DR Employee Advance / CR Cash/Bank.
- Advance marked outstanding until retired.

**Retirement:**
- Employee selects outstanding advance to retire.
- Submits expense lines (same form as reimbursement).
- System auto-matches total expenses vs. advance amount.

**Overspend (employee spent more than advance):**
```
DR Expense Lines (full amount)
CR Employee Advance (advance amount)
CR Employee Payable (difference owed to employee)
```

**Underspend (employee spent less than advance):**
```
DR Expense Lines (expenses amount)
DR Employee Advance (unspent difference)
CR Employee Advance (original advance amount)
```
Finance then chooses: payroll deduction OR AR charge.

**Advance constraints:**
- Employee cannot request new advance if outstanding advance exists (unless tenant config allows).
- System flags advances older than X days (tenant-configurable).

---

### 7.5 M7-B: Automated GL Posting

**Done definition:** Once Finance approves, system automatically generates and posts balanced DR/CR journal entries.

See Section 11 for full posting rules.

---

### 7.6 M8-B: Duplicate Invoice Detection

**Done definition:** System detects and blocks (or flags) duplicate invoice submissions within a tenant.

**Detection methods:**
1. Document hash (SHA-256): exact file match.
2. Perceptual hash (pHash): visually similar images (modified scans).
3. OCR text hash: same invoice number + vendor + amount + date combo.

**Thresholds (tenant-configurable):**
- ≥ 95% match: BLOCK — submission prevented.
- 70–95% match: WARN — employee sees side-by-side comparison.
- < 70%: pass through.

**Employee options on warning:**
- Use Anyway (requires written justification)
- Link to Existing Request
- Cancel / Re-upload

**Finance exception queue:**
- Finance receives flagged items.
- Decisions: Approve as valid / Reject as duplicate / Mark split-valid.
- Full audit trail captured.

**Scope:** Detection is per tenant only. No cross-tenant checks.

---

### 7.7 M9-B: Audit Portal + Evidence Bundle

**Done definition:** Auditor can log in, browse requests, and download a complete evidence bundle.

**Evidence bundle contents (ZIP/PDF):**
```
/EvidenceBundle_ER_{request_id}/
  /Receipts/
  /OCR/
  /AuditLogs/
  /Approvals/
  /Posting/
  summary.pdf
```

**Auditor permissions:** Read-only. No edits.

---

### 7.8 M10-B: Reporting & Analytics

See Section 14.

---

## 8. Shared Logic

### 8.1 Account Type Routing

The `account_type` field on the `users` table determines which experience loads:
- `individual` → Personal dashboard, simplified expense form, no approval workflow, no GL/dimension fields.
- `business` → Business dashboard, full expense form, multi-level approvals, GL/dimension enforcement.

Same API endpoints, different validation rules and form schemas applied based on account type context.

### 8.2 Tax Clarification (Critical)

**For individual users:**
- No VAT, WHT, or any tax logic applied.
- Tax preparation support (M7-I) is a separate future feature.

**For business users — employee expense retirements:**
- Employee reimbursements do **NOT** attract WHT, reverse charge VAT, or self-accounted VAT.
- These tax types apply only to vendor payments (AP Module).
- VAT logic in the expense module is **validation only**: system checks if a vendor-issued VAT appears on a receipt and flags anomalies for Finance review. No tax is withheld from employees.

### 8.3 FX Handling

- Multi-currency supported for both tiers.
- FX rate source: tenant-configurable (CBN API, ECB API, custom upload) for business; user's home currency with manual rate entry for individual.
- Rate application rule: invoice date / approval date / posting date (business, tenant-configurable).
- Conversion formula: `Amount_in_base_currency = Receipt_Amount × FX_Rate`.

### 8.4 File Storage

- All receipts and documents stored to Cloudflare R2.
- File path + hash saved to `receipt_documents` table.
- Files encrypted at rest (AES-256).
- Files cannot be deleted once linked to a submitted or approved request.

---

## 9. Data Model

### 9.1 Key Entities

**expense_requests**
```
request_id          UUID PK
user_id             FK → users
tenant_id           FK → tenants (NULL for individual)
request_type        ENUM: REIMBURSEMENT | ADVANCE_RETIREMENT | PERSONAL
status              ENUM (see states in 7.2)
total_amount        DECIMAL
currency            VARCHAR
submitted_at        TIMESTAMP
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**expense_lines**
```
line_id             UUID PK
request_id          FK → expense_requests
pl_group            VARCHAR (business only)
pl_line             VARCHAR (business only)
gl_account          VARCHAR (business only)
real_io             VARCHAR (nullable)
stat_io             VARCHAR (nullable)
material_io         VARCHAR (nullable)
cost_center         VARCHAR (nullable)
location            VARCHAR (nullable)
category            VARCHAR (individual: spending category; business: expense category)
invoice_number      VARCHAR
invoice_date        DATE
description         TEXT
amount              DECIMAL
currency            VARCHAR
vat_amount          DECIMAL (business only, nullable)
ocr_confidence      INTEGER (nullable)
duplicate_flag      BOOLEAN DEFAULT false
tenant_id           FK → tenants (NULL for individual)
```

**receipt_documents**
```
document_id         UUID PK
line_id             FK → expense_lines
file_path           VARCHAR (R2 path)
file_hash           VARCHAR (SHA-256)
p_hash              VARCHAR (perceptual hash)
extracted_text      TEXT (OCR output)
ocr_data            JSONB
uploaded_at         TIMESTAMP
tenant_id           FK → tenants (NULL for individual)
```

**invoice_registry** (business only)
```
registry_id         UUID PK
tenant_id           FK → tenants
invoice_number_normalized VARCHAR
vendor_name         VARCHAR
invoice_date        DATE
amount              DECIMAL
currency            VARCHAR
document_hash       VARCHAR
p_hash              VARCHAR
ocr_text_hash       VARCHAR
linked_request_id   FK → expense_requests
status              ENUM: ACTIVE | BLOCKED | EXCEPTION
```

**approval_steps** (business only)
```
approval_id         UUID PK
request_id          FK → expense_requests
approver_id         FK → users
step_order          INTEGER
step_name           VARCHAR (LM | HOD | GM | FINANCE | CFO)
action              ENUM: APPROVED | REJECTED | QUERIED | ESCALATED
comments            TEXT
timestamp           TIMESTAMP
tenant_id           FK → tenants
```

**query_threads** (business only)
```
query_id            UUID PK
line_id             FK → expense_lines (nullable for full-request query)
request_id          FK → expense_requests
from_user_id        FK → users
to_user_id          FK → users
message             TEXT
response            TEXT
resolved            BOOLEAN
created_at          TIMESTAMP
resolved_at         TIMESTAMP
```

**finance_review_records** (business only)
```
review_id           UUID PK
line_id             FK → expense_lines
field_changed       VARCHAR
old_value           TEXT
new_value           TEXT
finance_user_id     FK → users
timestamp           TIMESTAMP
tenant_id           FK → tenants
```

**advance_records** (business only)
```
advance_id          UUID PK
employee_id         FK → users
tenant_id           FK → tenants
amount              DECIMAL
currency            VARCHAR
fx_rate             DECIMAL
issue_date          DATE
trip_id             VARCHAR
cleared_flag        BOOLEAN DEFAULT false
cleared_at          TIMESTAMP
```

**audit_trail_entries**
```
audit_id            UUID PK
entity_type         VARCHAR (expense_request | expense_line | approval | etc.)
entity_id           UUID
action              VARCHAR
old_value           JSONB
new_value           JSONB
user_id             FK → users
tenant_id           FK → tenants (NULL for individual)
timestamp           TIMESTAMP
```

**personal_categories** (individual only)
```
category_id         UUID PK
user_id             FK → users
name                VARCHAR
color               VARCHAR
icon                VARCHAR
monthly_budget      DECIMAL (nullable)
```

**bank_statements** (individual only)
```
statement_id        UUID PK
user_id             FK → users
file_path           VARCHAR
upload_date         TIMESTAMP
status              ENUM: PROCESSING | PROCESSED | FAILED
transactions_count  INTEGER
```

### 9.2 Key Relationships

- `expense_requests` → `expense_lines`: 1-to-many
- `expense_lines` → `receipt_documents`: 1-to-many
- `expense_lines` → `query_threads`: 1-to-many
- `expense_requests` → `approval_steps`: 1-to-many
- `expense_lines` → `finance_review_records`: 1-to-many
- `expense_requests` → `audit_trail_entries`: 1-to-many
- `users` → `advance_records`: 1-to-many

### 9.3 Multi-Tenant Isolation

- Every business entity includes `tenant_id`.
- Individual accounts have `tenant_id = NULL`.
- No cross-tenant data is ever returned by any query.
- Duplicate detection, GL validation, and dimension checks are scoped strictly to `tenant_id`.

---

## 10. API Requirements

### 10.1 Design Principles

- RESTful, JSON-based.
- All endpoints require JWT (contains `user_id`, `tenant_id`, `account_type`, `role`).
- RBAC enforced at every endpoint.
- Tenant context from JWT (primary) or `X-Tenant-ID` header (fallback).
- Standard error format (see 10.4).
- Pagination default: `limit=50`, max `500`.
- Versioned: `/api/v1/...`

### 10.2 Expense Request Endpoints

```
POST   /api/v1/expenses/requests                    Create new request (draft)
GET    /api/v1/expenses/requests                    List requests (filtered by user/status)
GET    /api/v1/expenses/requests/{request_id}       Get single request with lines + approvals
PUT    /api/v1/expenses/requests/{request_id}/submit Submit draft for approval
PUT    /api/v1/expenses/requests/{request_id}       Update draft
DELETE /api/v1/expenses/requests/{request_id}       Delete draft only
```

### 10.3 Expense Line Endpoints

```
POST   /api/v1/expenses/lines                       Add line to request
PUT    /api/v1/expenses/lines/{line_id}             Update line
DELETE /api/v1/expenses/lines/{line_id}             Delete line (draft only)
```

### 10.4 Receipt Endpoints

```
POST   /api/v1/expenses/receipts                    Upload receipt (triggers OCR + duplicate check)
GET    /api/v1/expenses/receipts/{document_id}      Get receipt details + OCR data
```

### 10.5 Approval Endpoints (Business)

```
PUT    /api/v1/approvals/{request_id}/approve       Approve
PUT    /api/v1/approvals/{request_id}/reject        Reject (reason required)
PUT    /api/v1/approvals/{request_id}/query         Raise query
PUT    /api/v1/approvals/{request_id}/respond       Respond to query
GET    /api/v1/approvals/{request_id}/history       Full approval history
```

### 10.6 Finance Endpoints (Business)

```
PUT    /api/v1/finance/lines/{line_id}/adjust       Edit GL, dimensions, VAT
PUT    /api/v1/finance/requests/{request_id}/approve Final approval for posting
```

### 10.7 Advance Endpoints (Business)

```
POST   /api/v1/advances                             Request new advance
GET    /api/v1/advances?employee_id=...             List advances for employee
PUT    /api/v1/advances/{advance_id}/retire         Retire advance (links to expense request)
```

### 10.8 Duplicate Detection Endpoint (Business)

```
POST   /api/v1/duplicates/check                     Check file or fields for duplicate
```
Response includes: `confidence_score`, `matched_invoice_ids`, `recommended_action`, `blocking_flag`.

### 10.9 Audit Endpoints

```
GET    /api/v1/audit/requests/{request_id}          Full audit trail
GET    /api/v1/audit/requests/{request_id}/download Returns ZIP/PDF evidence bundle
```

### 10.10 Individual Bank Statement Endpoints

```
POST   /api/v1/statements/upload                    Upload bank statement
GET    /api/v1/statements/{statement_id}/preview    Preview extracted transactions + categories
POST   /api/v1/statements/{statement_id}/confirm    Confirm and import transactions
```

### 10.11 Error Response Format

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "GL account is invalid for selected PL group",
  "field": "gl_account"
}
```

HTTP codes: `400` Validation | `401` Auth required | `403` Access denied | `409` Duplicate invoice | `422` Business rule violation | `500` Internal error.

---

## 11. Accounting & Posting Rules

> Applies to business tier only.

### 11.1 Employee Reimbursement Posting

On Finance Manager final approval:
```
DR  Expense Account (per line GL + dimensions)
CR  Employee Payable (aggregated per request)
```

- Each line creates an independent DR entry.
- Posting date = Finance Manager approval date (or tenant-configured rule).

### 11.2 Travel Advance Issuance

On advance approval and payment:
```
DR  Employee Advance
CR  Cash / Bank
```

### 11.3 Advance Retirement — Overspend

Employee spent more than the advance:
```
Example: Advance = ₦200,000 | Expenses = ₦250,000 | Diff = ₦50,000

DR  Expense Lines        250,000
CR  Employee Advance     200,000
CR  Employee Payable      50,000
```

### 11.4 Advance Retirement — Underspend

Employee spent less than the advance:
```
Example: Advance = ₦200,000 | Expenses = ₦150,000 | Diff = ₦50,000

DR  Expense Lines        150,000
DR  Employee Advance      50,000  (recovery)
CR  Employee Advance     200,000
```
Finance chooses recovery method: payroll deduction or AR charge.

### 11.5 Dimension Propagation

Each DR line must carry:
- GL Account
- Cost Center
- Real IO (if applicable)
- Statistical IO (if applicable)
- Material IO (if applicable)
- Location

CR Employee Payable carries:
- Employee's home cost center
- Other dimensions = tenant defaults

### 11.6 FX Logic

```
Amount_in_base_currency = Receipt_Amount × FX_Rate
```

- Rate source and application date rule are tenant-configurable.
- Each line stores the FX rate applied.
- Mixed-currency requests: FX applied per line.

### 11.7 Posting Validations

System blocks posting if:
- DR ≠ CR (unbalanced entry)
- Invalid GL for tenant
- Invalid dimension mapping
- Open unresolved queries exist
- Missing mandatory receipts
- Uncleared duplicate flag
- FX calculation fails validation

### 11.8 Journal Output Structure

```json
{
  "request_id": "ER-2026-00112",
  "posting_date": "2026-05-14",
  "journal_entries": [
    {
      "line_type": "DR",
      "gl_account": "742000",
      "description": "Marketing Expense",
      "amount": 120000,
      "dimensions": {
        "cost_center": "CC100",
        "real_io": "RIO2002",
        "stat_io": "SIO410",
        "material_io": null,
        "location": "LAGOS"
      }
    },
    {
      "line_type": "CR",
      "gl_account": "221500",
      "description": "Employee Payable",
      "amount": 120000,
      "dimensions": {
        "cost_center": "CC_EMPLOYEE",
        "real_io": null,
        "stat_io": null,
        "material_io": null,
        "location": null
      }
    }
  ]
}
```

### 11.9 Month-End Rules

- Advances older than X days (tenant-configurable) are flagged in aging report.
- If accounting period is locked: posting date moves to next open period (or system blocks — tenant-configurable).
- FX revaluation (optional): unrealized gains/losses posted monthly, reversed on first day of next month.

---

## 12. UI/UX Requirements

### 12.1 Design Principles

- Minimal clicks to complete any action.
- Mobile-first (PWA enabled).
- Responsive across desktop, tablet, mobile.
- Inline validation — errors appear as the user types, not only on submit.
- Auto-save every 5 seconds for all forms.
- Clear status visibility at all times.

### 12.2 Individual Dashboard (Post M3-I)

- Widget: Total spent this month
- Widget: Spend by category (bar or donut)
- Widget: Recent transactions (last 10)
- Quick action: + Add Expense
- Quick action: Upload Bank Statement (M4-I)
- Budget progress bars per category (M5-I)

### 12.3 Individual Expense Form

- Simple single-page form: Date, Amount, Category (dropdown), Description (optional), Receipt (optional).
- After M4-I: bank statement import preview table with category suggestions.

### 12.4 Business Employee Dashboard

Widgets:
- My Reimbursable Expenses (count + total)
- My Travel Advances (outstanding advances + overdue)
- Pending Actions (queries awaiting response)
- Upcoming Reimbursement Dates
- Total Expenses This Month

Filters: Status, Date, Category, Amount range.

Quick actions: + New Expense | + New Travel Advance | View Retirement

### 12.5 Business Expense Form — Desktop

- Multi-line grid. Two rows shown by default; "Add Line" adds infinite rows.
- Inline field validation per cell.
- Dynamic dropdowns: PL Group → filters P&L Line → filters GL → filters dimensions.
- Running total recalculates live.
- Receipt upload panel: drag-and-drop, attach to specific line, thumbnails, zoom + rotate.
- OCR result overlay: shows extracted values vs. user-entered values.
- Duplicate detection modal if triggered.
- Advance balance comparison bar if retiring an advance.

### 12.6 Business Expense Form — Mobile

- Paginated: one expense line per page, swipe to navigate.
- Camera button for receipt scan with auto-crop and OCR.
- Top bar: total amount, line count, advance balance (if applicable).
- Save Draft / Submit / Add Line / Delete Line buttons always visible.

### 12.7 Finance Review Screen

- Line-by-line validation panel: GL, dimensions, VAT flags, duplicate warning, OCR mismatch.
- Editable fields directly on screen (Finance can type new GL/dimension without a separate modal).
- Side-by-side receipt viewer with OCR extracted values.
- Audit history drawer: all queries, responses, value changes.
- Tools: Approve All | Reject Line | Query Line | Mass Dimension Adjustment | Recalculate Posting Preview.

### 12.8 Approver Screen (LM/HOD/GM/CFO)

- Summary card: employee name, amount, category breakdown, compliance flags.
- Receipt viewer.
- Approve / Reject / Query buttons.
- SLA indicator: deadline + escalation path.

### 12.9 Audit Portal

- Request browser with filters.
- Evidence bundle viewer: receipts, documents, posting entries, approval trail, duplicate detection history.
- Export as ZIP or PDF.
- Strictly read-only — no edit buttons rendered.

### 12.10 Notifications

Delivered via: in-app, email, mobile push (M4+).

Events:
- Submission confirmation
- Query received / response required
- Approval received
- Rejection
- Payment scheduled
- Advance overdue reminder

---

## 13. Security & Compliance

### 13.1 Authentication

- JWT (access + refresh tokens) — already implemented in Milestone 2.
- MFA: optional per tenant (SMS, email, authenticator app).
- Account lockout: 5 failed attempts → 15-minute lockout (already implemented).

### 13.2 Authorisation

- RBAC enforced at every API endpoint.
- Employee: sees own requests only.
- Manager: sees direct reports' requests at their approval stage.
- Finance: sees all requests in Finance review queue.
- Auditor: read-only across all completed requests.
- Super Admin: all tenants.

### 13.3 Data Isolation

- Every business query scoped by `tenant_id`.
- No cross-tenant data access at any layer (application, API, database).
- Row-level security on all expense tables.

### 13.4 Encryption

- In transit: HTTPS/TLS 1.2+.
- At rest: AES-256 for all documents and OCR data.
- Sensitive PII fields (employee name, bank details) encrypted in DB.
- All uploaded documents hashed (SHA-256 + pHash) on upload.

### 13.5 Fraud Prevention

- Duplicate invoice detection (M8-B).
- Receipt hash tampering check.
- Forced justification for flagged claims.
- Mandatory Finance review for high-risk items.
- Threshold alerts for large expenses.

### 13.6 Audit Trail

- Immutable, append-only.
- Every create, edit, approval, rejection, query, Finance adjustment, and posting event logged.
- Old and new values stored on every change.
- Audit logs retained minimum 7 years (tenant-configurable).

### 13.7 Compliance Standards

- IFRS (expense recognition).
- SOC 2 (security and audit controls — target).
- GDPR / Nigerian NDPR.
- SOX-aligned audit trail structure.

---

## 14. Reporting & Analytics

### 14.1 Individual Reports (M7-I)

- Monthly spend by category
- Income vs. expense trend (monthly)
- Savings rate
- Year-to-date summary
- Export: PDF, CSV

### 14.2 Employee Reports (Business)

- My Expenses: status, amounts, categories, dates
- My Travel Advances: outstanding, overdue, history
- My Payments: scheduled and paid

### 14.3 Manager / HOD Reports

- Team expense overview by employee
- Pending approvals + SLA aging
- Budget vs. actual (if budget module enabled)

### 14.4 Finance Reports

- GL-level expense summary with dimension drill-down
- Outstanding advance aging (0–30, 31–60, 61–90, 90+ days)
- Reimbursement pending payment (batch view)
- Duplicate detection analysis report
- VAT validation report (anomalies only — no VAT liability created)
- Posting report (DR/CR summary, errors, non-posted transactions)

### 14.5 Auditor Reports

- Full evidence bundle (ZIP/PDF)
- Exception and query log
- High-risk items (duplicate suspicions, large claims, out-of-policy)
- Change tracking (Finance edits with old/new values)

### 14.6 CFO / Executive Reports

- Total company expense dashboard (monthly totals + trend)
- Expense vs. budget (if budget module enabled)
- Employee cost distribution
- Advance exposure report

### 14.7 Export Formats

- PDF, Excel (.xlsx), CSV, JSON (API).
- All exports apply role-based data filters.
- Exports logged in audit trail.

### 14.8 Performance

- Reports < 5 seconds for fewer than 100,000 rows.
- Complex GL/dimension join reports < 10 seconds.
- Scheduled reports run off-peak.

---

## 15. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Page load time (web) | < 2 seconds |
| Mobile view load | < 1.5 seconds |
| OCR extraction | < 3 seconds |
| Receipt upload (including hash + OCR + duplicate check) | < 5 seconds |
| Approval action execution | < 1 second |
| System uptime | 99.9% |
| RPO (max data loss) | < 5 minutes |
| RTO (max downtime) | < 30 minutes |
| Supported employees per tenant | 100,000 |
| Expense lines annually | 5 million |
| Document storage per tenant | 1 TB |
| API throughput | 500 req/sec (burst 2,000) |
| Audit log retention | 7 years (tenant-configurable) |
| Encryption | AES-256 at rest, TLS 1.2+ in transit |
| Accessibility | WCAG 2.1 AA |
| Browser support | Chrome, Safari, Edge, Firefox (latest 2–3 versions) |
| Mobile OS support | iOS latest 2, Android latest 5 |

---

## 16. Tenant Configuration (Business)

### 16.1 What Each Tenant Can Configure

- **Company profile:** Name, country, fiscal year, home currency.
- **Branding:** Logo, colours, custom field labels.
- **Modules:** Enable/disable Expense, Advances, AP, etc.
- **Dimensions:** Enable/disable Real IO, Statistical IO, Material IO, Cost Center, Location.
- **Chart of Accounts:** Upload via CSV/Excel. Map to PL/BS classification.
- **Approval workflow:** Levels, roles, amount thresholds, SLAs, escalation rules, delegation.
- **Policy rules:** Per-diem, category limits, receipt requirements, advance ceilings, settlement timeframes.
- **FX settings:** Rate source (CBN, ECB, manual), application date rule, rounding rules.
- **OCR config:** Confidence thresholds per action.
- **Duplicate detection:** Strict/relaxed thresholds, exception queue routing.
- **Payment schedule:** Weekly/monthly/on-demand, cut-off dates, approval requirements.
- **Notifications and SLAs:** Per-stage deadlines, reminder frequency, quiet hours.
- **Retention:** Document and audit log retention periods.
- **Security:** MFA enforcement, password policy, session timeout, SSO.

### 16.2 Configuration Edge Cases

- Tenant changes dimensions mid-year → new rules apply to new postings only; history unchanged.
- Tenant changes approval workflow → in-flight requests keep old workflow; new requests use new workflow.
- Tenant disables a module → historical data visible, new actions blocked.
- Tenant disables a GL → system sets N/A and prompts Finance to remap existing open items.

---

## 17. Integrations

| Integration | Purpose | Priority |
|---|---|---|
| Cloudflare R2 | Receipt and document storage | M3 |
| OCR Engine (Google Vision / AWS Textract) | Receipt data extraction | M5-B |
| Mono API | Live bank connection for individuals | M6-I |
| Payroll System | Underspend recovery, deductions | M6-B |
| ERP (Sage, SAP, Oracle, Dynamics) | GL posting export | M7-B |
| SMTP Provider | Email notifications | M4 |
| Push Notification (FCM/APNS) | Mobile alerts | M4 |
| CBN / ECB Rate API | FX rates for business | M3-B |
| Azure AD / Okta / Google SSO | Enterprise identity | Phase 2 |
| Power BI / Tableau | Analytics export | Phase 2 |

### 17.1 ERP Integration Format

All postings exportable as: JSON, XML, CSV.

Supported targets: SAP, Oracle Fusion, Microsoft Dynamics, Sage X3, QuickBooks, custom ERP.

Integration modes: direct API push, manual export, scheduled bulk transfer.

---

## 18. Glossary

| Term | Definition |
|---|---|
| Tenant | A company using Ziva BI. Has its own isolated data, config, and workflow. |
| Request | Parent-level expense submission (contains one or more lines). |
| Expense Line | A single expense entry inside a request. |
| GL Account | General Ledger account from the tenant's Chart of Accounts. |
| PL Group | High-level P&L category grouping. |
| Real IO | Real Internal Order — cost collector at granular level. |
| Statistical IO | Internal Order for analytical/tracking purposes only (no actual cost posting). |
| Employee Payable | Liability account for reimbursements owed to the employee. |
| Employee Advance | Amount given to employee before travel, to be retired with receipts. |
| Retirement | Employee submitting receipts to justify and clear an advance. |
| OCR | Optical Character Recognition — extracts text from receipt images. |
| pHash | Perceptual hash — detects visually similar (potentially modified) images. |
| Evidence Bundle | ZIP/PDF package of all receipts, OCR results, approvals, and postings for one request. |
| SLA | Service Level Agreement — deadline for an approver to act. |
| RBAC | Role-Based Access Control. |
| Draft | Request state while employee is still editing. |
| Exception Queue | Finance review queue for high-risk or flagged items. |
| Overspend | Employee spent more than advance issued. Company owes difference. |
| Underspend | Employee spent less than advance issued. Employee owes difference back. |

---

*End of Expense Management PRD v2.0.*
*Update this document before building each new milestone.*
*Next action: Begin M3 build — individual expense entry + business expense submission.*
