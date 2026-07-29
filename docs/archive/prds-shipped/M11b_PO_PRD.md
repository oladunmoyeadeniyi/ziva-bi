# M11b — Purchase Orders & 3-Way Match PRD

**Module code:** `ap` (extends existing module)
**Author:** Cowork
**Date:** 2026-07-25
**Status:** APPROVED FOR BUILD — build after M11 is live and stable
**Depends on:** M11 (Accounts Payable core — vendors, ap_invoices, ap_approvals)

---

## 1. Purpose

M11 (AP core) ships the downstream half of P2P: invoice capture, approval, and payment.
M11b closes the loop upstream: formalising what was *ordered* before any invoice arrives,
confirming *what was received*, and then verifying the invoice matches both.

Without this, AP teams rely on email chains, physical purchase requisitions, or tribal
knowledge to know whether an invoice is legitimate. With it, every invoice can be
answered with: "Does this match what we ordered? Did we actually receive it?"

**The P2P chain becomes:**

```
Purchase Requisition (optional, future)
        ↓
  Purchase Order  ← M11b
        ↓
 Goods Receipt Note ← M11b
        ↓
  AP Invoice (M11)
        ↓
   3-Way Match ← M11b
        ↓
   Payment (M11)
```

---

## 2. Scope

### In scope (M11b — this build)
- **Purchase Order (PO)** master: header + lines, approval workflow, send to vendor
- **Goods Receipt Note (GRN)**: confirm partial or full delivery against a PO
- **3-Way Match engine**: link AP invoice lines → GRN lines → PO lines; flag variances
- Tolerance configuration: price tolerance (%), quantity tolerance (%)
- PO status tracking: open amount, received amount, invoiced amount
- All three modes from first commit (Lite / Connected / Full ERP)
- CSV/Excel export of PO register and open PO report
- Sidebar pages: PO list, New PO, PO detail, GRN list, New GRN, Match invoice

### Out of scope (future milestones)
- Purchase Requisition (PR) / purchase request workflow before PO
- Vendor quotation / RFQ management
- Contract management and blanket orders
- Multi-currency PO with forward FX hedging
- Vendor portal: vendor self-submits invoice against a PO
- Automated OCR matching (OCR is M10; auto-match to PO is M10+M11b integration)
- Three-way match on services (qty-less POs) — v1 covers goods only; services use 2-way

---

## 3. Three-Mode Support

Every PO and GRN must be three-mode-aware from the first commit.
The mode is read from `tenant_org_config.posting_mode` at approval time and snapshotted.

| Event | Lite | Connected | Full ERP |
|---|---|---|---|
| PO approved | Workflow only; no GL | GL coding on lines; `posting_batches` entry for commitment | Optional commitment journal: DR Commitment / CR Commitment offset (memo only — not P&L) |
| GRN confirmed | Workflow only | `posting_batches` for accrual | DR GRNI accrual / CR Goods Received Not Invoiced (GRNI) |
| Invoice matched to GRN | No posting | `posting_batches` reconciliation entry | DR GRNI / CR Accounts Payable (clears the GRNI accrual) |
| Invoice with no PO/GRN | Same as M11 two-way flow | Same as M11 | Same as M11 |

> **Note on GRNI posting (Full ERP):** On GRN confirmation, the system posts a
> debit to the expense/asset GL (from PO line) and a credit to a GRNI clearing
> account (`goods_received_not_invoiced` posting role). When the AP invoice is
> matched and approved, it reverses the GRNI credit and posts to accounts_payable.
> This prevents premature P&L impact before invoice approval.

---

## 4. Data Model

### 4.1 `purchase_orders` (new table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | |
| `vendor_id` | UUID FK → vendors | |
| `po_number` | VARCHAR(50) | Auto: `PO-{YYYY}-{NNNN}` per tenant per year |
| `requester_id` | UUID FK → users | Employee who raised the PO |
| `department_id` | UUID FK → org_structure (nullable) | Cost centre / department |
| `title` | VARCHAR(255) | Brief description of what is being ordered |
| `delivery_date` | DATE (nullable) | Expected delivery date |
| `delivery_address` | TEXT (nullable) | Delivery location |
| `currency` | VARCHAR(3) | Default NGN |
| `exchange_rate` | NUMERIC(18,6) | Default 1 |
| `total_amount_foreign` | NUMERIC(18,2) | Sum of line amounts in PO currency |
| `total_amount_base` | NUMERIC(18,2) | Converted to functional currency |
| `amount_received` | NUMERIC(18,2) | Running total confirmed via GRNs |
| `amount_invoiced` | NUMERIC(18,2) | Running total matched from AP invoices |
| `status` | VARCHAR(20) | See §5.1 |
| `posting_mode` | VARCHAR(20) | Snapshotted from org config at approval |
| `notes` | TEXT (nullable) | Internal notes |
| `submitted_at / by` | TIMESTAMPTZ / UUID | |
| `approved_at / by` | TIMESTAMPTZ / UUID | |
| `rejected_at / by / reason` | TIMESTAMPTZ / UUID / TEXT | |
| `sent_at / by` | TIMESTAMPTZ / UUID | Marked when PO sent to vendor |
| `closed_at / by` | TIMESTAMPTZ / UUID | Manually closed |
| `cancelled_at / by` | TIMESTAMPTZ / UUID | |
| `journal_entry_id` | UUID FK → journal_entries (nullable) | Commitment journal (Full ERP) |
| `posting_batch_id` | UUID FK → posting_batches (nullable) | Connected mode |
| `created_at / by` | TIMESTAMPTZ / UUID | |
| `updated_at` | TIMESTAMPTZ | |

Constraints:
- `UNIQUE (tenant_id, po_number)`
- `CHECK status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','SENT','PARTIALLY_RECEIVED','FULLY_RECEIVED','CLOSED','CANCELLED')`

Indexes:
- `(tenant_id, status)`, `(tenant_id, vendor_id)`, `(tenant_id, delivery_date)`

---

### 4.2 `purchase_order_lines` (new table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `po_id` | UUID FK → purchase_orders CASCADE | |
| `line_number` | INTEGER | |
| `description` | TEXT | Item or service description |
| `unit_of_measure` | VARCHAR(30) | e.g. "units", "kg", "hours", "cartons" |
| `quantity_ordered` | NUMERIC(18,4) | |
| `unit_price` | NUMERIC(18,2) | Per unit in PO currency |
| `amount_foreign` | NUMERIC(18,2) | `quantity_ordered × unit_price` |
| `amount_base` | NUMERIC(18,2) | `amount_foreign × exchange_rate` |
| `quantity_received` | NUMERIC(18,4) | Running total from GRN lines |
| `quantity_invoiced` | NUMERIC(18,4) | Running total from matched invoice lines |
| `gl_account_id` | UUID FK → gl_accounts (nullable) | Connected + Full ERP |
| `dimension_values` | JSONB | |
| `vat_applicable` | BOOLEAN | |
| `vat_rate` | NUMERIC(6,4) | |
| `wht_applicable` | BOOLEAN | |
| `wht_rate` | NUMERIC(6,4) | |
| `category_hint` | VARCHAR(100) | Lite mode reporting |

Index: `(po_id)`

---

### 4.3 `po_approvals` (new table)

Mirrors `ap_approvals` exactly. Same columns, same pattern.

| Column | Type |
|---|---|
| `id` | UUID PK |
| `po_id` | UUID FK → purchase_orders CASCADE |
| `tenant_id` | UUID FK → tenants |
| `step_order` | INTEGER |
| `approver_id` | UUID FK → users |
| `role_id` | UUID FK → approval_roles |
| `status` | VARCHAR(20) CHECK IN ('PENDING','APPROVED','REJECTED','REFERRED_BACK','SKIPPED') |
| `is_advisory` | BOOLEAN |
| `action_at` | TIMESTAMPTZ |
| `comment` | TEXT |

---

### 4.4 `po_snapshots` (new table)

Immutable JSONB snapshot at submission. Same pattern as `ap_invoice_snapshots`.

| Column | Type |
|---|---|
| `id` | UUID PK |
| `po_id` | UUID FK → purchase_orders CASCADE |
| `snapshot_data` | JSONB |
| `created_at` | TIMESTAMPTZ |

---

### 4.5 `goods_receipt_notes` (new table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | |
| `po_id` | UUID FK → purchase_orders | |
| `grn_number` | VARCHAR(50) | Auto: `GRN-{YYYY}-{NNNN}` per tenant per year |
| `received_by` | UUID FK → users | Person who confirmed receipt |
| `receipt_date` | DATE | Date goods/services were received |
| `delivery_note_number` | VARCHAR(100) (nullable) | Vendor delivery note ref |
| `notes` | TEXT (nullable) | Condition notes, damages, etc. |
| `status` | VARCHAR(20) | CHECK IN ('DRAFT','CONFIRMED') |
| `confirmed_at / by` | TIMESTAMPTZ / UUID | |
| `grni_journal_entry_id` | UUID FK → journal_entries (nullable) | Full ERP GRNI accrual |
| `grni_posting_batch_id` | UUID FK → posting_batches (nullable) | Connected |
| `created_at / by` | TIMESTAMPTZ / UUID | |

Constraints:
- `UNIQUE (tenant_id, grn_number)`

---

### 4.6 `grn_lines` (new table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `grn_id` | UUID FK → goods_receipt_notes CASCADE | |
| `po_line_id` | UUID FK → purchase_order_lines | The PO line being received |
| `line_number` | INTEGER | |
| `description` | TEXT | Can differ from PO line (what was actually received) |
| `quantity_received` | NUMERIC(18,4) | |
| `unit_price_on_po` | NUMERIC(18,2) | Copied from PO line for GRNI valuation |
| `amount_base` | NUMERIC(18,2) | `quantity_received × unit_price_on_po × exchange_rate` |
| `condition_notes` | TEXT (nullable) | e.g. "3 units damaged" |

Index: `(grn_id)`, `(po_line_id)`

---

### 4.7 `ap_invoice_po_matches` (new table)

Links an AP invoice line to a GRN line (and therefore to a PO line) for 3-way matching.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | |
| `invoice_id` | UUID FK → ap_invoices | |
| `invoice_line_id` | UUID FK → ap_invoice_lines | |
| `grn_id` | UUID FK → goods_receipt_notes | |
| `grn_line_id` | UUID FK → grn_lines | |
| `po_id` | UUID FK → purchase_orders | Denormalised for query speed |
| `po_line_id` | UUID FK → purchase_order_lines | Denormalised |
| `matched_quantity` | NUMERIC(18,4) | Quantity attributed to this match |
| `matched_amount_base` | NUMERIC(18,2) | |
| `price_variance` | NUMERIC(18,2) | invoice unit price − PO unit price |
| `price_variance_pct` | NUMERIC(6,4) | As a fraction (e.g. 0.02 = 2%) |
| `qty_variance` | NUMERIC(18,4) | matched_quantity − grn_line.quantity_received |
| `match_status` | VARCHAR(30) | See §5.3 |
| `created_at / by` | TIMESTAMPTZ / UUID | |

Constraint: `CHECK match_status IN ('MATCHED','PRICE_VARIANCE','QTY_VARIANCE','OVER_INVOICED','UNDER_INVOICED','MANUAL_OVERRIDE')`

---

### 4.8 `po_tolerance_config` (new table — per tenant)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants UNIQUE | One row per tenant |
| `price_tolerance_pct` | NUMERIC(6,4) | e.g. 0.02 = 2% price variance allowed |
| `qty_tolerance_pct` | NUMERIC(6,4) | e.g. 0.05 = 5% qty variance allowed |
| `auto_approve_within_tolerance` | BOOLEAN | Default FALSE — require manual confirm |
| `block_payment_on_variance` | BOOLEAN | Default TRUE — APPROVED invoice blocked if variance exists |
| `updated_at / by` | TIMESTAMPTZ / UUID | |

---

## 5. Status Lifecycles

### 5.1 Purchase Order Status

```
DRAFT ──► SUBMITTED ──► APPROVED ──► SENT ──► PARTIALLY_RECEIVED ──► FULLY_RECEIVED ──► CLOSED
                │                                                                           ▲
                └──► REJECTED (returns to DRAFT)                                           │
                                                          APPROVED ─────────────────────────┘
DRAFT / SUBMITTED / APPROVED ──► CANCELLED
```

| Status | Meaning |
|---|---|
| `DRAFT` | Created, not yet submitted |
| `SUBMITTED` | Awaiting approval |
| `APPROVED` | Approved; ready to send to vendor |
| `REJECTED` | Returned to requester for revision |
| `SENT` | Formally sent to vendor (manual action) |
| `PARTIALLY_RECEIVED` | At least one GRN confirmed; `amount_received < total_amount_base` |
| `FULLY_RECEIVED` | All lines fully received; `amount_received >= total_amount_base` |
| `CLOSED` | Manually closed (e.g. partial order accepted as complete) |
| `CANCELLED` | Cancelled before any receipt |

Transitions are enforced server-side. Only DRAFT and SUBMITTED can be cancelled.

---

### 5.2 GRN Status

```
DRAFT ──► CONFIRMED
```

A GRN in DRAFT can be edited. Once CONFIRMED it is immutable (same pattern as approved expense snapshots). Confirmation triggers:
- Update `po_lines.quantity_received` (increment)
- Update `purchase_orders.amount_received` (recalculate)
- Advance PO status to `PARTIALLY_RECEIVED` or `FULLY_RECEIVED`
- Post GRNI journal (Full ERP) or posting_batch (Connected)

---

### 5.3 Match Status (per `ap_invoice_po_matches` row)

| Status | Meaning |
|---|---|
| `MATCHED` | Qty and price within tolerance — auto-pass |
| `PRICE_VARIANCE` | Unit price on invoice exceeds PO price beyond tolerance |
| `QTY_VARIANCE` | Invoice qty exceeds GRN confirmed qty beyond tolerance |
| `OVER_INVOICED` | Invoice total exceeds PO total |
| `UNDER_INVOICED` | Invoice covers only part of the GRN value (acceptable) |
| `MANUAL_OVERRIDE` | Finance manually accepted a variance with a comment |

---

## 6. GL Journals (Full ERP)

### 6.1 Posting Roles Required (add to `posting_roles` seed)

| `role_key` | `group` | `subgroup` | Purpose |
|---|---|---|---|
| `grni_clearing` | `current_liabilities` | `accruals` | Goods Received Not Invoiced |
| `po_commitment` | `memo` | `commitments` | Off-balance-sheet PO commitment (optional) |

### 6.2 On GRN Confirmation (Full ERP)

```
DR  <expense or asset GL from PO line>   grn_line.amount_base   (one per GRN line)
CR  grni_clearing                         sum(grn_line.amount_base)
```

Narration: `GRN-{grn_number} against {po_number}`

### 6.3 On Invoice Match + Approval (Full ERP, invoice linked to GRN)

```
DR  grni_clearing          matched_amount_base   (clears the GRNI accrual)
CR  accounts_payable       invoice.net_payable

(If price variance and within tolerance, post variance to:)
DR/CR  expense GL          price_variance amount   (small debit or credit)
```

### 6.4 On Invoice Approval (Full ERP, invoice with NO PO link — unchanged M11 behaviour)

The existing M11 `post_ap_approval()` runs unchanged. PO-matched invoices use the new `post_ap_invoice_match()` function instead.

---

## 7. Business Rules

### 7.1 PO Reference Generation
`PO-{YYYY}-{NNNN:04d}` — sequential per tenant per year, same pattern as AP invoices.

### 7.2 GRN Reference Generation
`GRN-{YYYY}-{NNNN:04d}` — sequential per tenant per year.

### 7.3 Over-receipt Guard
A GRN line cannot record `quantity_received` greater than:
`po_line.quantity_ordered − po_line.quantity_received_to_date`
…unless an explicit "over-receipt" flag is set (rare; configurable per tenant).

### 7.4 Over-invoice Guard
When matching an invoice line to a GRN line, `matched_quantity` cannot exceed
`grn_line.quantity_received − grn_line.quantity_already_matched`.
If the invoice total exceeds the GRN value, the match status is `OVER_INVOICED` and
payment is blocked (if `block_payment_on_variance = TRUE`).

### 7.5 Partial Matching
An invoice line can be partially matched to multiple GRN lines (e.g. one PO delivered
in two shipments, invoice covers both). One `ap_invoice_po_matches` row per
invoice_line ↔ grn_line pair.

### 7.6 Invoice Without PO
Invoices created without any PO link continue through the M11 2-way match flow.
The system does NOT require all invoices to be PO-backed. This is per-tenant
configurable via `po_tolerance_config.require_po_for_payment` (add if needed).

### 7.7 Duplicate PO Number
`UNIQUE (tenant_id, po_number)` enforced at DB level. Auto-generated numbers never
collide; manually entered codes raise a 409.

### 7.8 Separation of Duties
The person who raises a PO cannot approve it (same SOD rule as expense approvals).
Enforced in the submit endpoint.

### 7.9 Closed Period Guard
PO approval date must fall within an open accounting period (same `is_date_postable`
check used by GL posting). If the PO `delivery_date` falls in a closed period, warn
but do not block — the receipt date (not PO date) drives the GRNI journal.

---

## 8. API Endpoints

All routes under `/api/ap/` prefix (extending existing AP router or a separate `/api/ap/po` sub-prefix).

### Purchase Orders
```
GET    /api/ap/purchase-orders                     List POs (filter: status, vendor, date range)
POST   /api/ap/purchase-orders                     Create DRAFT PO
GET    /api/ap/purchase-orders/{id}                PO detail (lines + approvals)
PUT    /api/ap/purchase-orders/{id}                Update DRAFT PO (replace lines)
DELETE /api/ap/purchase-orders/{id}                Delete DRAFT PO
POST   /api/ap/purchase-orders/{id}/submit         Submit for approval
POST   /api/ap/purchase-orders/{id}/approve        Approver action: approve
POST   /api/ap/purchase-orders/{id}/reject         Approver action: reject (reason required)
POST   /api/ap/purchase-orders/{id}/send           Mark as sent to vendor
POST   /api/ap/purchase-orders/{id}/close          Close PO (partial acceptance as complete)
POST   /api/ap/purchase-orders/{id}/cancel         Cancel PO
GET    /api/ap/purchase-orders/export              CSV/Excel PO register
GET    /api/ap/purchase-orders/open-report         Open POs: ordered but not yet fully received
```

### Goods Receipt Notes
```
GET    /api/ap/grn                                 List GRNs (filter: po_id, status, date)
POST   /api/ap/grn                                 Create DRAFT GRN (must reference a PO)
GET    /api/ap/grn/{id}                            GRN detail (lines)
PUT    /api/ap/grn/{id}                            Update DRAFT GRN
DELETE /api/ap/grn/{id}                            Delete DRAFT GRN
POST   /api/ap/grn/{id}/confirm                    Confirm receipt (immutable; triggers GRNI journal)
```

### 3-Way Match
```
GET    /api/ap/invoices/{id}/po-matches            List current match records for an invoice
POST   /api/ap/invoices/{id}/match-po              Create match: link invoice lines to GRN lines
DELETE /api/ap/invoices/{id}/po-matches/{match_id} Remove a match (DRAFT invoice only)
POST   /api/ap/invoices/{id}/override-variance     Finance manually accepts a flagged variance
GET    /api/ap/match-report                        Tenant-wide match status report
```

### Config
```
GET    /api/ap/tolerance-config                    Get tenant tolerance settings
PUT    /api/ap/tolerance-config                    Update tolerance settings
```

---

## 9. Pydantic Schemas

### Purchase Orders
- `PoLineIn` — `line_number, description, unit_of_measure, quantity_ordered, unit_price, amount_foreign, gl_account_id, dimension_values, vat_applicable, vat_rate, wht_applicable, wht_rate, category_hint`
- `PoLineResponse` — above + `amount_base, quantity_received, quantity_invoiced`
- `PurchaseOrderCreate` — `vendor_id, title, delivery_date, delivery_address, currency, exchange_rate, notes, lines`
- `PurchaseOrderUpdate` — all optional
- `PoApprovalResponse` — mirrors `ApApprovalResponse`
- `PurchaseOrderResponse` — list view summary
- `PurchaseOrderDetail` — full with lines + approvals
- `PoApproveBody`, `PoRejectBody`

### GRN
- `GrnLineIn` — `po_line_id, line_number, description, quantity_received, condition_notes`
- `GrnLineResponse` — above + `unit_price_on_po, amount_base`
- `GrnCreate` — `po_id, receipt_date, delivery_note_number, notes, lines`
- `GrnResponse`, `GrnDetail`

### Match
- `MatchLineIn` — `invoice_line_id, grn_line_id, matched_quantity`
- `MatchBody` — `lines: list[MatchLineIn]`
- `MatchResponse` — all fields of `ap_invoice_po_matches`
- `VarianceOverrideBody` — `match_id, comment`
- `ToleranceConfig` — `price_tolerance_pct, qty_tolerance_pct, auto_approve_within_tolerance, block_payment_on_variance`

---

## 10. Frontend Pages

All pages under `/dashboard/business/ap/` extending the existing AP section.

### New sidebar links (under "Accounts Payable" section)
```
Invoices       (existing)
Vendors        (existing)
AP Aging       (existing)
──────────
Purchase Orders    /dashboard/business/ap/purchase-orders
GRN                /dashboard/business/ap/grn
Match Report       /dashboard/business/ap/match-report
```

### Pages to build

| Page | Route | Key Features |
|---|---|---|
| PO list | `/ap/purchase-orders` | Status filter tabs, open amount vs received amount columns, export |
| New PO | `/ap/purchase-orders/new` | Vendor selector, multi-line table, live total, delivery date |
| PO detail | `/ap/purchase-orders/[id]` | Header + lines + approval trail + action buttons (Submit / Approve / Reject / Send / Close / Cancel). Shows linked GRNs and matched invoices |
| GRN list | `/ap/grn` | Filter by PO, date range, status |
| New GRN | `/ap/grn/new` | PO selector → auto-loads PO lines → qty received per line |
| GRN detail | `/ap/grn/[id]` | Lines + confirmation status + GRNI journal link |
| Match invoice | `/ap/invoices/[id]/match` | Select GRN lines for each invoice line; shows variance calculation; override button if finance has permission |
| Match report | `/ap/match-report` | Tenant-wide: unmatched invoices, variance flags, over-invoiced alerts |

---

## 11. Services

### `backend/app/services/po_posting.py`
- `post_grni_journal(db, grn, created_by)` — GRNI accrual on GRN confirmation (Full ERP)
- `post_invoice_match_journal(db, invoice, matches, created_by)` — clears GRNI, posts to AP (Full ERP)
- `create_po_posting_batch(db, po, created_by)` — Connected mode commitment batch
- `create_grn_posting_batch(db, grn, created_by)` — Connected mode GRNI accrual batch

### `backend/app/services/po_match_engine.py`
- `compute_match_status(invoice_unit_price, po_unit_price, tolerance_pct) → MatchStatus`
- `compute_qty_variance(matched_qty, grn_qty, tolerance_pct) → MatchStatus`
- `validate_match(invoice_line, grn_line, po_line, tolerance_config) → list[ValidationError]`
- `run_auto_match(invoice_id, db) → list[MatchResult]` — future: auto-match by PO number on invoice

---

## 12. Migration

New revision after M11's `y7z8a9b0c1d2`:

**Revision ID:** `z8a9b0c1d2e3` (suggested)
**Down revision:** `y7z8a9b0c1d2`

Tables to create (in dependency order):
1. `purchase_orders`
2. `purchase_order_lines`
3. `po_approvals`
4. `po_snapshots`
5. `goods_receipt_notes`
6. `grn_lines`
7. `ap_invoice_po_matches`
8. `po_tolerance_config`

Seed additions:
- `posting_roles`: `grni_clearing` (current_liabilities / accruals), `po_commitment` (memo / commitments)

---

## 13. Build Order

Build in this exact sequence to minimise re-work:

1. **Migration** — all 8 tables + seed posting roles
2. **ORM models** — `po.py` (PurchaseOrder, PurchaseOrderLine, PoApproval, PoSnapshot, GoodsReceiptNote, GrnLine, ApInvoicePoMatch, PoToleranceConfig); add to `models/__init__.py`
3. **Schemas** — `schemas/po.py`
4. **Match engine service** — `services/po_match_engine.py` (pure functions, no DB writes; easiest to unit test)
5. **Posting service** — `services/po_posting.py` (GL journals + posting_batches)
6. **Router** — `routers/po.py` (PO lifecycle) — register in `main.py`
7. **GRN router** — extend `routers/po.py` or separate `routers/grn.py`
8. **Match router** — extend `routers/ap.py` (3-way match endpoints on `/api/ap/invoices/{id}/match-po`)
9. **Tolerance config router** — small, can be added to `routers/setup.py` or `routers/ap.py`
10. **Frontend** — PO list → New PO → PO detail → GRN list → New GRN → Match invoice → Match report
11. **Sidebar** — add PO, GRN, Match Report links under Accounts Payable section

---

## 14. Key Design Decisions

### Why separate GRN from AP Invoice?
GRN is a warehouse/operations event; AP Invoice is a finance event. They happen at
different times, by different people (stores officer vs finance officer), and they
describe different things (physical receipt vs billing). Merging them creates
permission and audit problems.

### Why `ap_invoice_po_matches` instead of a FK on `ap_invoice_lines`?
One invoice line can be matched across multiple GRN lines (split deliveries). And one
GRN line can be partially matched to multiple invoice lines (partial billing). A
junction table handles this N:M relationship cleanly.

### Why not require PO for every invoice?
Nigerian SME reality: many vendor relationships are informal, especially for utilities,
ad-hoc services, and one-time vendors. Forcing PO backing for these would make the
system unusable. The match engine applies only when a match link exists.

### Why store `price_variance` on the match record?
Variance must be frozen at match time, not recalculated. If a PO is edited after
matching (edge case), the variance on existing matches should not silently change.

### GRNI Clearing Account
`grni_clearing` is a liability on the balance sheet. It represents the company's
obligation to pay for goods received but not yet invoiced. It should be reconciled
monthly (GRNs confirmed but no invoice within 30 days = accrual to chase vendor).
A GRNI reconciliation report is a natural follow-on feature.

---

## 15. Open Questions (resolve before build)

| # | Question | Recommendation |
|---|---|---|
| 1 | Should PO approval use the same policy engine (`module="po"`) or a separate policy? | Same engine, `module="po"`. Finance admin sets up a `po` approval policy in the Approval Workflows page. |
| 2 | Should GRN confirmation require an approver or is the receiving officer's action sufficient? | No approval chain on GRN in v1. The person with the `receive_goods` permission (TBD) confirms directly. Add GRN approval in v2 if auditors require it. |
| 3 | When posting_mode changes after POs are already approved, what happens to existing match links? | Existing matches retain their original `posting_mode` snapshot. New invoices get the new mode. |
| 4 | Should `po_commitment` journal be on by default in Full ERP? | Default OFF. Commitment accounting is not universal and clutters the GL for smaller orgs. Expose as a toggle in Setup → Accounting Config. |
| 5 | What happens if a GRN is confirmed but the related PO is cancelled? | Block GRN confirmation if PO status is CANCELLED. If PO is cancelled after GRN is confirmed, log a warning but do not reverse the GRN — stock has already been received. |
