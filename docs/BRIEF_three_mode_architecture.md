# BRIEF — Three-Mode Architecture + Modular Subscription
**Date:** 2026-07-11  
**Status:** Approved — ready for implementation  
**Affects:** Entire platform (signup, SA portal, expense posting, setup sequence, CoA, GL picker)

---

## 1. Decision Summary

Ziva BI operates in three distinct modes. Every module supports all three modes from day one.

| Mode | What it is | GL posting |
|---|---|---|
| **Lite** | Workflow-only. No GL coding required. Basic CSV export of approved transactions. | None |
| **Connected** | Full GL coding + dimensions in Ziva BI, but posts to an external ERP (download or API sync). | Export to external ERP |
| **Full ERP** | Everything in Ziva BI. GL posting to internal journal_entries. Financial statements in-app. | Internal GL |

**Key principle:** The employee/user experience is identical across all modes. GL coding fields appear when the tenant needs them. The difference is invisible at the transaction level — it only surfaces at the posting/export step.

---

## 2. What Changes vs. What Stays

### Stays completely unchanged
- All models, migrations, and API endpoints already built
- Expense form UI (all 5 coding levels)
- Approval workflow engine
- Finance review chain
- People module (employees, positions, roles)
- GL coding UI and dimension capture
- CoA upload and dimension setup
- All frontend pages

### What changes (minimal)

**A. New column: `tenant_org_config.posting_mode`**
```sql
VARCHAR(20) DEFAULT 'full_erp'  -- 'lite' | 'connected' | 'full_erp'
```
Existing Red Bull tenant auto-defaults to `'full_erp'`. No data migration needed.

**B. New table: `posting_batches`**
Holds approved transactions waiting for export/sync in Connected Mode.
Columns: `id`, `tenant_id`, `batch_ref` (human-readable e.g. "BATCH-2026-07-001"), `module` (expense/ap/ar etc.), `status` (pending/exported/synced), `transactions` (JSONB — approved journals with GL codes + dimensions), `created_at`, `exported_at`, `synced_at`.

**C. Routing check in `expense_posting.py`**
```python
if posting_mode == 'full_erp':
    → write to journal_entries (existing, unchanged)
elif posting_mode == 'connected':
    → write to posting_batches (new)
elif posting_mode == 'lite':
    → mark approved, done (no posting)
```

**D. Export endpoint (Connected Mode)**
`GET /api/posting-batches/{batch_id}/export?format=csv|excel`
Returns a formatted file with debit/credit journal entries ready to import into the external ERP. Formats: standard CSV, Excel (configurable column mapping per ERP type).

**E. Posting Batches page (Connected Mode)**
Finance team sees "Posting Batches" tab on the transactions page. Each batch: status indicator, download button, optional "Sync to [ERP]" button (Phase 2 connectors).

---

## 3. Module Independence Principle

Every module must work standalone. A company subscribing to only one module should be live within the hour.

**Required setup per module (minimum):**

| Module | Minimum required setup |
|---|---|
| Expense Management | Organisation basics, Employees, Approval Workflow |
| AP (P2P) | Organisation basics, Vendors, Approval Workflow |
| AR (O2C) | Organisation basics, Customers |
| Bank Reconciliation | Organisation basics, Bank Accounts |
| Payroll & HR | Organisation basics, Employees, Salary Structures |
| Inventory | Organisation basics, Item Catalogue, Locations |
| Fixed Assets | Organisation basics, Asset Register |
| Budgeting & Planning | Organisation basics, Budget Periods |

CoA, Dimensions, Currencies, Tax, Document Rules are optional in Lite/Connected mode. They are required in Full ERP mode.

---

## 4. Setup Sequence — Mode + Module Aware

The 12-step implementation portal adapts based on `posting_mode` + active modules. Steps are shown/hidden accordingly.

| Setup Step | Lite | Connected | Full ERP |
|---|---|---|---|
| Organisation | ✅ | ✅ | ✅ |
| Module Activation | ✅ | ✅ | ✅ |
| Chart of Accounts | ❌ | ✅ simplified* | ✅ full |
| Dimensions | ❌ | Optional | ✅ |
| Employees | ✅ | ✅ | ✅ |
| Currencies | ❌ | Optional | ✅ |
| Tax & Statutory | ❌ | Optional | ✅ |
| Roles & Permissions | ✅ | ✅ | ✅ |
| Approval Workflows | ✅ | ✅ | ✅ |
| Document Rules | Optional | Optional | ✅ |
| Go-live | ✅ | ✅ | ✅ |

*Simplified CoA (Connected): GL code + GL name + account type only. No SOCI/SOFP, no FS mapping, no TB mapping required. Grouping columns (gl_group, gl_subgroup, gl_sub_subgroup) optional but recommended for the GL picker hierarchy.

**Implementation:** Setup portal reads `posting_mode` + `tenant_modules` from the DB on load and conditionally renders steps. A step is hidden if it's not required for the current mode + active module combination.

---

## 5. CoA in Connected Mode

**Upload (Phase 1):** Simplified XLSX template — GL code, GL name, account type (Asset/Liability/Equity/Income/Expense), and optional grouping columns. The company maps their external ERP's CoA directly. No SOCI/SOFP classification needed.

**Sync from external ERP (Phase 2):** API connector pulls CoA from QuickBooks/Xero/Sage on demand. "Sync from [ERP]" button on the CoA setup page. Periodic re-sync available. Not blocking Phase 1.

**GL picker hierarchy path (new):** Alongside the existing "By Category" path, add a "By GL Group" path: GL Group → GL Subgroup → GL Sub-subgroup → GL Account. Uses existing `gl_group`/`gl_subgroup`/`gl_sub_subgroup` columns on `chart_of_accounts`. The picker detects which navigation options to offer based on what data is populated.

---

## 6. SA Portal — Consultant Configuration

**Moved OUT of tenant implementation pages and INTO SA portal (before "Enter Tenant"):**

- **Posting mode** (Lite / Connected / Full ERP) — consultant sets this; tenant never sees it
- **Module licensing** — which modules the tenant has subscribed to and paid for
- **Integration settings** — which external ERP for Connected Mode; export format preference
- **Implementation notes** — internal consultant notes visible only in SA portal

**New UI section in SA portal tenant detail page** (between lifecycle and "Enter Tenant"):
```
SYSTEM CONFIGURATION
  Mode:     [Connected ▼]
  Modules:  [Expense ✅] [AP ✅] [Payroll ☐] ...
  ERP:      [Sage Business Cloud ▼]  (shown only for Connected mode)
  [Save configuration]
```

**Tenant implementation pages (inside "Enter Tenant"):** Contain ONLY tenant-facing config — their org details, their CoA, their employees, their workflows. No Ziva system roles visible inside the tenant portal. System roles are platform-level, managed in SA portal only.

---

## 7. Signup Flow — Trial Lead Model

**Current:** Signup → creates test tenant (`lifecycle_status = 'in_implementation'`) → self-serve implementation

**New:**
```
Signup page
  → Creates trial tenant (lifecycle_status = 'trial')
  → Pre-loads demo/sample data (seed script)
  → User can explore product freely
  → SA portal "Trials & signups" page shows new lead
  → Consultant follows up, collects real company details
  → Consultant sets mode + modules in SA portal
  → Consultant clicks "Activate implementation" → status: 'in_implementation'
  → Consultant enters tenant and does guided setup
  → Go-live when ready
```

**Trial tenant limitations:**
- Can explore all features against demo data
- Cannot go live (go-live button locked with "Contact your Ziva BI consultant")
- Posting to external ERP disabled
- Email notifications suppressed (or redirect to demo email)

**Technical change:** Signup router changes `lifecycle_status` from `'in_implementation'` to `'trial'`. One line change. Demo seed script populates org structure, sample employees, sample CoA, sample expense reports, sample approval chains.

**"Trials & signups" SA portal page:** Table of all trial tenants — company name, signup date, country, last activity, lead status (new/contacted/qualified/activated). Consultant actions: "Activate" (transitions to in_implementation), "Notes", "Disqualify".

---

## 8. Build Sequence

Execute in this exact order. Each phase must be complete before the next starts.

### Phase 1 — Posting Mode Foundation (backend)
1. Migration: add `posting_mode` to `tenant_org_config`
2. Migration: add `posting_batches` table
3. Update `expense_posting.py` — routing check
4. Add `GET /api/posting-batches` + `GET /api/posting-batches/{id}/export` endpoints
5. Update `schemas/` for posting mode + batch

### Phase 2 — Signup + SA Portal
6. Update signup router: `lifecycle_status = 'trial'`
7. Write demo seed script (`backend/scripts/seed_demo_tenant.py`)
8. Add consultant config panel to SA portal tenant detail page (mode + modules + ERP)
9. Build "Trials & signups" SA portal page

### Phase 3 — Setup Sequence + CoA
10. Update setup portal: mode + module aware (show/hide steps)
11. Simplified CoA template variant for Connected Mode
12. Add GL Group hierarchy navigation path to `ExpenseItemPicker`

### Phase 4 — New Modules (after foundation is done)
13. M11 — Accounts Payable (inherits all three modes)
14. Subsequent modules per roadmap

---

## 9. Nomenclature (locked)

- **Lite** — not "Standalone", not "Basic"
- **Connected** — not "Integration Mode", not "Hybrid"
- **Full ERP** — not "Enterprise", not "Advanced"
- **posting_batches** — the export/sync queue table name
- **posting_mode** — the column name on `tenant_org_config`
