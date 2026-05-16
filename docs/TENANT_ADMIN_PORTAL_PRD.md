# Tenant Admin Portal — PRD

> Part of Ziva BI. This PRD wins over any older version.  
> Last updated: May 2026

---

## 1. Purpose

The Tenant Admin Portal is the central control hub for every business tenant on Ziva BI. It is where each company configures the platform to match their own processes, accounting rules, workflows, taxes, org structure, and policies — all without touching code.

Every other module in Ziva BI draws its rules from here. Nothing works properly without it.

**Key principle:** This portal **configures** — it does not execute. Financial transactions, GL postings, workflow routing, and payroll processing all happen in their respective modules. The Tenant Admin Portal only defines the rules those modules follow.

---

## 2. The Problem It Solves

Without a central configuration portal:
- Each module behaves inconsistently
- Finance teams must call IT for every rule change
- Approval workflows break when org structures change
- GL postings become incorrect or incomplete
- Tax rules are applied inconsistently
- Multi-country or multi-entity deployments become impossible
- There is no single source of truth for dimensions, COA, or workflows

The Tenant Admin Portal eliminates all of this with a no-code, self-service configuration environment.

---

## 3. Scope

### What the Portal Does

The Tenant Admin Portal gives each business tenant full configuration control over:

| Area | What's configurable |
|---|---|
| Organization Identity & Branding | Logo, colors, subdomain, email/SMS templates, document branding |
| Module Activation | Activate/deactivate AP, AR, Expense, Payroll, Inventory, POSM, FA, Vendor Portal, Customer Portal, Bank Rec, 3PL, AI, OCR |
| Org Structure | Departments, cost centers, business units, warehouses, branches, legal entities |
| Chart of Accounts (COA) | Import/create/edit GL accounts, financial category mapping, module-to-GL mapping |
| Dimensions Engine | Unlimited dimensions, required/optional per module, dropdown values, GL mapping |
| Approval Workflow Builder | Drag-and-drop workflows for all processes, conditional routing, escalations, versioning |
| Document & KYC Rules | Define required documents per process, mandatory/optional, OCR templates |
| Tax & Statutory Rules | VAT, WHT, PAYE, pension, social contributions, effective dates, exemptions |
| FX & Currency | Rate sources, application rules, gain/loss GL accounts, revaluation rules |
| Vendor Categories | Category rules: tax, documents, PO requirements, dimension rules, invoice structure |
| Customer Categories | Credit limits, payment terms, pricing rules, rebate rules, dimension mapping |
| Module-Specific Settings | AP, AR, Expense, Payroll, Inventory, POSM, FA specific configuration |
| User & Role Management | Create roles, assign permissions, field masking, MFA settings |
| Notifications | Email/SMS templates, escalation rules, reminder frequency |
| Data Import/Export | Field mapping templates, validation rules, duplicate handling |
| AI/Automation | Enable/disable ICE, confidence thresholds, auto-categorization rules |
| Integrations | ERP, bank APIs, SSO (Google, Microsoft, Okta), 3PL, payroll consultants |
| Audit & Compliance | Log retention, document retention, compliance rules |

### What the Portal Does NOT Do

| Out of scope | Where it belongs |
|---|---|
| Record or post financial transactions | AP, AR, Expense, Payroll modules |
| Execute or route approvals | Workflow Engine |
| Process payroll | Payroll module |
| Run OCR extraction | OCR Engine |
| Train AI models | ICE module |
| Manage billing or subscriptions | Super Admin Portal |
| Modify database schema or backend | Super Admin + Platform Infrastructure |
| Write custom scripts or plugins | Not supported (no-code only) |
| View other tenants | Super Admin only |
| Alter audit logs | Not permitted for anyone |
| Mass-delete financial records | Blocked at system level |

---

## 4. Who Uses This Portal

### Tenant-Level Personas

**Tenant Admin (Primary)**
- Full access to all configuration areas
- Cannot view/modify financial transactions
- Cannot see payroll values unless explicitly granted
- Cannot alter audit logs

**Finance Admin**
- Configures all financial policies: COA, GL mappings, tax rules, FX, AP/AR posting logic
- Cannot manage user accounts or HR/payroll modules

**HR Admin**
- Configures HR/payroll policies, leave rules, employee KYC, salary secrecy rules
- No access to financial configuration or COA

**IT Admin**
- Manages integrations, MFA, SSO, API keys, user provisioning
- No access to financial or payroll configuration

**Compliance & Audit Admin**
- Read-only across workflows and document requirements
- Can update compliance and retention configuration
- Cannot modify financial or HR settings

**CFO / Executive (Special Permission)**
- Approves high-risk policy changes (GL mapping, tax rates, workflow modifications)
- Does not create configurations; read-only access to configuration history

**Procurement Manager (Special Permission)**
- Configures vendor categories, supplier onboarding rules, procurement workflows
- No financial or HR configuration

**Warehouse Manager (Special Permission)**
- Configures warehouse metadata, inbound/outbound rules, damage categories
- Limited inventory settings only

### ZivaBI-Level Personas (Platform Side)

**Super Admin**
- Provisions new tenants, enables/disables modules at platform level
- Has zero visibility into tenant financial data, payroll, or transactions

**ZivaBI Support Engineer**
- Can assist with configuration only if invited by tenant
- No access to salaries or confidential data

### Personas with Zero Access

Regular employees, vendors, customers, 3PL users, warehouse operators, auditors (read-only to specific compliance views only).

---

## 5. Configuration Areas — Functional Detail

### 5.1 Organization Identity & Branding

Tenant configures:
- Company logo (PNG, JPG, SVG), favicon
- Primary and secondary colors (WCAG contrast enforced)
- Font style (5 options), layout density (comfortable/compact)
- Light/dark/auto theme
- Subdomain: `tenant.zivabi.com` (uniqueness checked)
- Email header/footer, sender email (verified), SMS sender ID
- Document branding for invoices, POs, payslips, customer/vendor statements

Live preview panel shows real-time rendering of all UI changes.

### 5.2 Module Activation

Each module remains hidden until activated. Activation requires completing a Setup Checklist — the module stays disabled until 100% complete.

**Setup Checklist examples:**

AP requires: COA mapping → tax rules → dimensions → workflow → vendor categories  
Payroll requires: salary structure → statutory rules → pay cycles  
Inventory requires: valuation method → warehouses → product categories

Super Admin controls which modules are available to each tenant. Tenant Admin activates within that set.

### 5.3 Organizational Structure

**Departments**
- Create/edit/deactivate departments with unique department codes
- Assign department heads, link to cost centers

**Cost Centers & Profit Centers**
- Unlimited cost centers, mapped to GL accounts
- Multi-level hierarchy, linked to departments

**Business Units / Legal Entities**
- Support multi-entity and multi-country organizations
- Separate TIN/VAT IDs, bank accounts, financial periods, and FX rules per entity

**Warehouses**
- Main, regional, 3PL-managed, and POSM storage
- Metadata: address, GPS, capacity, assigned manager, valuation method override

### 5.4 Chart of Accounts (COA)

**Import:** Excel, CSV, TXT, PDF (via OCR), API (ERP sync)  
**Validation:** Duplicates, missing hierarchy, missing account types, bad formatting

**Every GL account has:**
- Account type: Asset / Liability / Equity / Income / Expense
- Financial category: Balance Sheet (BS) or P&L (PL1–PL4)
- Group account (for IFRS)
- Reporting tag

**Module-to-GL mapping** — Tenant maps GL defaults for:
AP, AR, Inventory, PPV, POSM, Payroll expense, Salaries payable, WHT payable, VAT receivable/payable, Bank settlement, COGS, Revenue, Returns, FX gain/loss

Active GL accounts cannot be deactivated if they are in use in an active mapping.

### 5.5 Dimensions Engine

Tenants can create **unlimited dimensions**. Each dimension has:
- Name and tenant-customizable label
- Required / optional per module
- Dropdown values (with codes, names, defaults)
- Valid-from / valid-to effective dates
- Mandatory for specific GL accounts or modules
- Budget-linked restrictions
- Dependent dimensions (e.g., choosing "Sponsorship" reveals "Event Code")

Standard dimensions: Real IO, Statistical IO, Cost Center IO, Material IO, Location, Region, Project, Event, Customer Group, Campaign, Sales Channel.

Dimensions can be imported via Excel, CSV, or ERP API.

### 5.6 Approval Workflow Builder

Workflow builder covers all processes:  
AP, AR, Expense, Payroll, Inventory, POSM, Fixed Assets, Vendor Onboarding, Customer Onboarding, Leave, Bank Reconciliation

**Supported workflow types:**
- Sequential, parallel, conditional, threshold-based, scenario-based, escalation flows

**Node types:**
- User approval, role approval, department-based, value-threshold, exception override, auto-approve, auto-reject

**Features:**
- Drag-and-drop canvas with zoom and pan
- Conditional routing (IF/ELSE)
- Substitute approvers, skip-level approvals
- Time-based auto-escalation
- Workflow preview and logic simulation

**Versioning:**
- Every change creates a new version
- Active/in-progress requests continue under the old version
- New requests use the new version immediately

**Validation:**
- No workflow can end without a final approver
- Approvers must exist in the system
- Conditional rules must reference valid fields

### 5.7 Document & KYC Rules

Tenant defines required documents for each process. Per-document rules:
- Mandatory / optional
- Expiry date required
- OCR extraction template (drag-and-drop field mapping)
- Maximum file size and allowed formats
- Maximum number of files

**Processes covered:** Vendor onboarding, customer onboarding, employee onboarding, AP invoices, expense lines, fixed asset acquisitions, inventory receipts, return validations, payroll changes, bank reconciliations, leave requests

### 5.8 Tax & Statutory Configuration

**VAT:** Rate by category, reverse VAT, exemptions, effective dates  
**WHT:** Rates by vendor category, resident/non-resident rules, gross-up rules, effective dates  
**PAYE:** Tax tables per country, computation method  
**Statutory:** Pension %, NHF %, NSITF %, social contribution rules

Rules have effective dates and cannot overlap. Remittance GL accounts must be mapped before publishing tax rules.

### 5.9 FX & Currency

- Primary currency and supported foreign currencies
- FX rate source: CBN, XE, Manual, Monthly Fixed
- FX application rule: Posting date / Approval date / Invoice date
- Realized and unrealized gain/loss GL accounts (must be mapped)
- Monthly or scheduled revaluation rules
- Base currency cannot change after a financial year begins

### 5.10 Vendor Categories

Each category defines its own rules:
- Tax rules (WHT rate, VAT applicability)
- Document requirements
- PO requirement (mandatory/optional)
- Dimension requirements
- Invoice structure (single-line vs multi-line)
- Budget linkage
- Advance request caps

Default categories: Professional services, Agencies/Event managers, Clearing agents, 3PL, Import vendors, Utility vendors, Rent/Property/Insurance, One-off vendors.

### 5.11 Customer Categories

- Customer types: Cash, Credit, Distributor, Reseller, Export
- Credit limit and payment terms
- Pricing group and rebate scheme
- Dimension mapping for revenue and COGS

Customer-level overrides for credit limit, payment terms, and dimensions are permitted, with tenant-configured override rules (soft or hard).

### 5.12 Module-Specific Settings

| Module | Key settings |
|---|---|
| AP | Invoice approval rules, duplicate invoice detection, WHT/VAT application rules |
| AR | Credit limit enforcement, delivery approval, returns handling, dimension mapping |
| Expense | Expense caps per employee, expense types, multi-currency rules, OCR validation |
| Payroll | Salary structures, statutory compliance, leave rules, proration, outsourced staff |
| Inventory | Valuation method (standard cost/weighted avg/actual), damage categories, 3PL rules |
| POSM | Issue rules, return rules, damage categories, event/customer tagging |
| Fixed Assets | Asset categories, depreciation method, disposal workflow, custodian tracking |

### 5.13 User & Role Management

- Create unlimited roles with granular permissions
- Permission types: page access, module access, field-level masking, data export, payroll visibility, workflow builder access
- User-level permission overrides (above or below role defaults)
- Assign multiple roles per user
- MFA: optional/mandatory per role or all roles
- Field masking: salary fields masked by default; configurable per role

### 5.14 Notifications

- Email and SMS template editor with variables (`{UserName}`, `{Amount}`, etc.)
- In-app and push notification toggles
- Escalation rule builder with configurable timing
- Test send functionality
- Notification triggers: approvals, rejections, queries, expirations, reminders

### 5.15 Data Import/Export

- Upload sample file → map fields → set validation rules → save as template
- Validation rules: mandatory fields, data types, duplicate handling, cleansing rules
- Supported formats: Excel, CSV, PDF (OCR), API

### 5.16 AI/Automation (ICE Settings)

- Enable/disable AI suggestions per module
- Set high/medium/low confidence thresholds
- Choose which fields AI may suggest
- Configure auto-categorization fallback rules
- Manage feedback loop preferences

See ICE PRD for full specification.

### 5.17 Integrations

- ERP: Sage X3, SAP, Oracle, MS Dynamics 365, QuickBooks, Odoo (future)
- Banks: GTB, Zenith, UBA, Access, Stanbic (future)
- SSO: Google, Microsoft AD, Okta
- Payment gateways, tax authority integrations
- 3PL and logistics vendors

Each integration: enter API key + endpoint → system tests connection → publish.

### 5.18 Audit & Compliance Configuration

- Log retention: configurable minimum (12 months), no-delete option
- Document retention: configurable per document type
- KYC expiry rules with early warning notifications
- Sensitive action approval: high-risk config changes (tax rates, FX source, WHT rules) require a second approver
- Compliance blocks: disable posting if KYC is expired, if WHT is missing, etc.
- Configuration freeze mode (future): lock changes during audit periods

---

## 6. Configuration Flows

Every configuration area follows the same structure:

**Entry → Data entry → Validation → Dependency check → Save as draft → Preview → Publish → Impact propagates**

Key flow rules across all areas:
- Publishing never disrupts active workflows or open transactions
- Old versions remain active for in-progress tasks
- Rollback is available for every configuration action
- All changes generate an audit record

### Key Validation Rules by Area

| Area | Key validations |
|---|---|
| COA | Cannot deactivate account in active mapping; no duplicates |
| Dimensions | Required dimensions must be mapped before module use |
| Workflows | Must end with a final approver; no orphaned stages; approvers must exist |
| Tax rules | Effective dates must not overlap; rate > 0 unless exempt; remittance GL must be mapped |
| FX | Cannot change base currency after financial year begins; gain/loss GL must be mapped |
| Branding | Logo max 5MB; subdomain must be unique; colors must meet WCAG contrast |
| Module activation | 100% checklist completion required; dependencies must be met first |

---

## 7. Data Model

### Design Principles

- `tenant_id` on every table (strict multi-tenant isolation)
- Row-level security enforced at DB level
- Immutable audit logs
- All config changes versioned with rollback support

### Core Entity Groups

**`tenants`** — Company record: name, industry, currency, timezone, theme, active modules, status  
**`tenant_settings`** — JSONB config per tenant for all module-level settings  
**`departments`** — Department records with codes, heads, cost center links  
**`cost_centers`** — Linked to departments and GL accounts, with hierarchy  
**`business_units`** — Legal entities with TIN, address, FX/period rules  
**`warehouses`** — Physical locations with manager, capacity, 3PL flag, valuation override  
**`gl_accounts`** — Chart of accounts with type, category, group, reporting tag  
**`gl_mappings`** — Module-to-GL and dimension-to-GL mappings with override rules  
**`dimensions`** — Dimension definitions with behavior rules and effective dates  
**`dimension_values`** — Dropdown values for each dimension  
**`dimension_gl_mappings`** — Links dimensions to GL accounts  
**`workflow_definitions`** — Workflow per process type, versioned  
**`workflow_stages`** — Ordered stages per workflow with node type, approver, conditions  
**`document_templates`** — Per-process document requirements with rules  
**`tax_rules`** — Tax rates, types, categories, effective dates, exemptions  
**`wht_rules`** — WHT rates by vendor category, gross-up rules  
**`vat_rules`** — VAT rates and applicability  
**`statutory_tables`** — PAYE and other payroll statutory brackets per country  
**`currencies`** — Supported currencies per tenant  
**`fx_rules`** — FX source, application rule, gain/loss GL, revaluation schedule  
**`vendor_categories`** — Category definitions with tax/document/dimension/invoice rules  
**`customer_categories`** — Category definitions with credit/pricing/rebate rules  
**`module_settings`** — Per-module settings stored as JSONB (one record per module per tenant)  
**`integrations`** — API key, endpoint, provider, scope, status per integration  
**`sso_config`** — SSO provider, client ID, redirect URI per tenant  
**`roles`** — Role definitions with permission arrays and module access  
**`permissions`** — Permission codes per action/module  
**`user_roles`** — User-to-role assignments (tenant-scoped)  
**`audit_logs`** — Immutable, append-only log of all configuration changes  
**`retention_rules`** — Log and document retention settings per tenant

### Key Relationships

```
tenants (1) ── (M) departments ── (M) cost_centers
tenants (1) ── (M) business_units
tenants (1) ── (M) warehouses
tenants (1) ── (M) gl_accounts ── (M) gl_mappings
tenants (1) ── (M) dimensions ── (M) dimension_values
dimensions (M) ── (M) gl_accounts [via dimension_gl_mappings]
tenants (1) ── (M) workflow_definitions ── (M) workflow_stages
tenants (1) ── (M) document_templates
tenants (1) ── (M) tax_rules / wht_rules / vat_rules
tenants (1) ── (M) currencies ── (1) fx_rules
tenants (1) ── (M) vendor_categories
tenants (1) ── (M) customer_categories
tenants (1) ── (M) module_settings
tenants (1) ── (M) integrations
tenants (1) ── (M) roles ── (M) permissions [via role_permissions]
tenants (1) ── (M) audit_logs
```

---

## 8. API Endpoints

### Design Principles
- RESTful JSON, HTTPS only
- OAuth2 + JWT; `tenant_id` validated on every request
- All endpoints RBAC-enforced
- All write operations logged to audit trail
- Versioned: `/api/v1/...`
- Rate limit: 300 requests/min per tenant; burst 1,000/min

### Required Headers
```
Authorization: Bearer <token>
X-Tenant-ID: <tenant_id>
Content-Type: application/json
```

### Standard Error Format
```json
{
  "status": "error",
  "error_code": "INVALID_GL_MAPPING",
  "message": "The selected GL is not mapped to any financial category.",
  "timestamp": "2026-01-01T12:00:00Z"
}
```

### Endpoints by Area

**Tenant Profile**
```
GET  /api/v1/tenant/profile
PUT  /api/v1/tenant/profile
```

**Organization Structure**
```
GET/POST/PUT/DELETE  /api/v1/org/departments
GET/POST/PUT/DELETE  /api/v1/org/cost-centers
GET/POST/PUT/DELETE  /api/v1/org/warehouses
GET/POST/PUT/DELETE  /api/v1/org/entities
```

**Chart of Accounts**
```
GET        /api/v1/finance/coa
POST       /api/v1/finance/coa/upload
POST/PUT   /api/v1/finance/coa
GET/POST/PUT  /api/v1/finance/gl-mapping
POST       /api/v1/finance/validate/gl-mapping
```

**Dimensions**
```
GET/POST/PUT/DELETE  /api/v1/dimensions
GET/POST             /api/v1/dimensions/{id}/values
POST                 /api/v1/dimensions/{id}/gl-mappings
```

**Workflows**
```
GET/POST/PUT  /api/v1/workflows
GET           /api/v1/workflows/{id}/versions
POST          /api/v1/workflows/{id}/publish
POST          /api/v1/workflows/validate
```

**Documents & KYC**
```
GET/POST/PUT/DELETE  /api/v1/docs/templates
POST                 /api/v1/docs/ocr/mapping
POST                 /api/v1/docs/ocr/test
```

**Tax Rules**
```
GET/POST/PUT/DELETE  /api/v1/tax/rules
GET                  /api/v1/tax/rules/evaluate
```

**FX & Currency**
```
GET/POST         /api/v1/finance/currencies
POST/PUT         /api/v1/finance/fx-rules
```

**Vendor & Customer Categories**
```
GET/POST/PUT/DELETE  /api/v1/vendors/categories
GET/POST/PUT/DELETE  /api/v1/customers/categories
```

**Module Settings**
```
GET  /api/v1/modules/{module}/settings
PUT  /api/v1/modules/{module}/settings
```

**User & Role Management**
```
GET/POST        /api/v1/tenant/users
GET/PUT/DELETE  /api/v1/tenant/users/{id}
POST            /api/v1/tenant/users/{id}/roles
GET/POST/PUT    /api/v1/tenant/roles
```

**Notifications**
```
GET/PUT   /api/v1/notifications/templates
POST      /api/v1/notifications/test-send
```

**Integrations**
```
POST  /api/v1/integrations/erp/test
POST  /api/v1/integrations/erp/configure
POST  /api/v1/integrations/bank/test
POST  /api/v1/integrations/bank/configure
```

**Audit Logs**
```
GET   /api/v1/audit/logs
GET   /api/v1/audit/logs/export
GET   /api/v1/audit/logs/{entity_type}/{entity_id}
```

---

## 9. Audit & Compliance

### Audit Logging Rules

Every configuration change must generate an immutable audit record:
- Who changed what (user ID, role)
- When (timestamp)
- What exactly changed (before and after values)
- Which entity and module was affected
- IP address and device metadata

Logs are **append-only, write-only, cryptographically protected.** No user — including Tenant Admin, Super Admin, or ZivaBI Support — can modify or delete audit logs.

**Mandatory audit events:**
COA changes, dimension changes, workflow creation/publish/archive, tax rule changes, FX changes, vendor/customer category changes, role/permission changes, module activation/deactivation, KYC rule changes, integration changes, branding changes, any record deactivation.

### Compliance Standards

- GDPR, NDPR, POPIA, LGPD, CCPA — right to access, export, redact (limited), delete (non-critical only)
- IFRS and GAAP financial configuration compliance
- SOX segregation of duties (config and posting are separate)
- ISO 27001, SOC 2

### Sensitive Action Approval

High-risk configuration changes require a second approver. Examples:
- Changing VAT or WHT rates
- Mapping GLs for sensitive accounts
- Changing FX source
- Modifying payroll statutory rules

Tenant Admin configures who approves, whether a second approver is required, and whether a reason field is mandatory.

### Auditor Access

Internal and external auditors get **read-only** access to:
- Audit logs
- Workflow versions
- Tax rules and COA
- Dimension rules
- Role and permission configuration

Auditors cannot see payroll values or employee PII unless explicitly granted. Audit logs can be exported to Excel, CSV, JSON, or PDF.

### Retention Rules

| Data | Minimum retention |
|---|---|
| Audit logs | 12 months minimum (configurable to never-delete) |
| Documents for posted transactions | Cannot be deleted |
| Workflow versions | Indefinite |
| KYC and tax documents | Configurable per document type |
| GL accounts | Cannot delete if in active use |

---

## 10. UI/UX Requirements

### Global Layout

- Fixed left navigation, top global header, main content panel
- Right-side slide-over panel for editing
- Light and dark mode support
- WCAG 2.1 AA accessibility compliance
- Mobile responsive with collapsible panels

### Dashboard

The main dashboard shows:
- Setup progress indicators per configuration area (progress bar, status, "Resume Setup" button)
- Alerts and warnings (missing GL mapping, conflicting tax rules, expiring KYC, workflow with no final approver)
- Quick actions (Add User, Add Dimension, Add Workflow, Add GL Account)
- System health summary (integration status, pending workflow updates)

### Workflow Builder UI

- Drag-and-drop canvas with zoom/pan
- Node types: Approve Role, Approve User, Conditional, Threshold, Parallel, Auto-approve, Auto-reject
- Right slide-in panel for node properties (approver selection, IF/ELSE conditions, threshold, escalation)
- Version history panel: compare versions, clone, archive
- Logic simulation on preview

### COA Upload UI

- Drag-and-drop file upload
- Template download
- Column mapping tool
- Preview table and error panel

### Dimensions UI

Create/edit wizard:
1. Basic info (name, label, required/optional)
2. Dropdown values (inline table, bulk import option)
3. GL mapping
4. Module mapping
5. Behavior rules (defaults, overrides, dependent dimensions)

### Module Activation UI

Each module tile shows: name, description, setup items, status, "Start Setup" button.  
Setup wizard: Requirements → Prerequisites → Mapping & Rules → Workflow → Documents → Summary → Activate.  
Visual indicators: ✔ Completed / ⚠ Missing / ✖ Blocked

### Other Pages

- **Tax UI:** Rule builder with multi-rate support, overlapping rule warnings, missing remittance GL alerts
- **Notification UI:** Rich text email editor with variable panel, test send, SMS editor, escalation rule builder
- **Integration UI:** Endpoint + API key entry, test connection button, sync history
- **Audit UI:** Read-only log viewer, filter by user/date/entity/action, export button
- **AI/ML UI:** Enable toggle, module selector, confidence threshold slider, exception rules

### Control Types Required

Dropdowns, multi-select, searchable dropdowns, toggle switches, radio groups, date pickers, multi-step progress wizards, drag-and-drop builders, dynamic tables, expandable accordions, JSON editors (advanced settings), inline validation indicators.

---

## 11. Non-Functional Requirements

### Performance

| Metric | Target |
|---|---|
| Initial page load | < 2.5 seconds (broadband) |
| Subsequent screen loads | < 1.2 seconds |
| Mobile load | < 3.0 seconds |
| Workflow builder (up to 50 nodes) | < 200ms UI response |
| COA upload (up to 10,000 rows) | < 20 seconds |
| Search results (users, COA, dimensions) | < 300ms |

### Scalability

- 1–50,000 users per tenant
- Unlimited departments, cost centers, dimensions, workflows, vendor/customer categories
- Auto-scale API layer, workflow engine, tax engine, auth layer
- Stable latency across Africa, Europe, Middle East, North America, Asia Pacific

### Availability

- 99.95% uptime (≤ 22 minutes downtime per month)
- Scheduled maintenance at low-usage hours; no config loss during maintenance
- Hot-reload for configuration updates

### Security

- OAuth2 + JWT; MFA optional or mandatory per role
- SSO support: Google, Microsoft, Okta, Azure AD
- Fine-grained RBAC + field-level masking
- TLS 1.2+, AES-256 at rest
- Sensitive fields double-encrypted: salary, tax IDs, bank accounts
- Zero cross-tenant data visibility (strict `tenant_id` enforcement)
- DDoS protection, optional IP allowlisting

### Reliability

- No partial configuration states; no silent failures
- Rollback available for every configuration action
- Versioning for: workflows, COA, tax rules, dimensions, categories, FX rules, document templates
- Publishing never disrupts active workflows or open transactions

### Disaster Recovery

| Metric | Target |
|---|---|
| Full DB backup | Every 6 hours |
| Incremental backup | Every 15 minutes |
| RTO | < 1 hour |
| RPO | < 15 minutes |

---

## 12. Cross-Module Behaviors

These rules apply platform-wide and are configured through the Tenant Admin Portal.

### Effective Dates

Every configuration must support:
- Future activation (schedule a rule change)
- Scheduled deactivation
- Retroactive correction (with approval and audit trail)

### Versioning

All major configurations maintain version history: COA, dimensions, tax rules, workflows, vendor/customer categories, FX rules, posting rules, document templates.

### Duplicate Prevention

- Vendor invoice numbers must not duplicate within a configurable window
- Expense claims must match support document metadata
- Duplicate workflow creation is blocked
- Conflicting tax rule versions are blocked

### Employee Cross-Module Involvement

Employees interact with dimensions automatically — their department, cost center, and location populate from their profile. Employees can: submit expenses, acknowledge POSM issued to them, confirm asset custody, apply for leave.

### Vendor Portal (Cross-Module)

Vendors can: upload invoices and PODs, view PO status, track payment, download WHT certificates, receive KYC expiry notifications, manage dispute resolution.

### Customer Portal (Cross-Module)

Customers can: view account balance and invoice history, download statements, view credit notes and price lists, track orders, initiate returns.

### POSM Lifecycle

Issue → Approve → Dispatch → Deliver → Damage report → Return → Reconcile → Reallocate.  
Monetary entries only on disposal or loss. No GL posting for issue/return. Dimension tagging required for marketing attribution.

### Fixed Asset Lifecycle

Register → Assign (with custodian) → Track (transfers, condition, maintenance) → Depreciate → Dispose.  
Asset statuses: New, Assigned, In Use, Returned to Store, Under Repair, Damaged, Scrap, Lost.

### Return Flow (Sales / Inventory / POSM)

Customer return → quality/damage check → validate against original invoice → approval workflow → raise credit note → VAT reversal → move to good/damaged/salvage/scrap stock. Dimensions must match original transaction unless overridden.

---

## 13. Future Roadmap

> These are documented for planning only. Claude Code does not build these until formally scoped.

| Phase | Feature |
|---|---|
| V2 | AI-based auto-configuration (system recommends dimensions, COA, workflows by industry) |
| V2 | Natural language workflow creation ("Create workflow where invoices > ₦2M need CFO approval") |
| V2 | BPMN import/export for advanced users |
| V2 | Questionnaire-based onboarding (30 questions → full auto-configuration) |
| V2 | Industry template packs (FMCG, Pharma, Oil & Gas, Logistics, Consulting, NGO) |
| V3 | Automated global tax updates (sync with public tax databases) |
| V3 | Multi-country multi-entity tax engine |
| V3 | Advanced workflow routing (AI predicts right approver based on workload and history) |
| V3 | Plug-and-play ERP connectors (SAP, Oracle, Dynamics 365, Odoo) |
| V3 | Bank connectors marketplace |
| V3 | Configuration freeze mode for audit periods |
| V4 | Predictive analytics (invoice delays, payroll anomalies, vendor risk) |
| V4 | Voice command configuration |
| V4 | Just-in-time temporary access for sensitive configurations |
| V5 | Cross-module BI dashboards and CFO-level reporting console |
| V5 | Marketplace for integrations, workflow packages, and industry templates |

---

## 14. Build Notes for Claude Code

The Tenant Admin Portal is a **mid-to-late stage module.** It must not be fully built before:

- ✅ Auth & User Management
- ✅ Basic tenant scaffolding (tenant exists in DB, Tenant Admin role works)

**But parts of it are needed early.** The following must be built as part of the foundation, not deferred:

| Item | When needed |
|---|---|
| Tenant record creation | Milestone 1 — foundation |
| Basic module activation flags | Milestone 2 — before any module goes live |
| COA setup (basic) | Before Expense or AP can post |
| Dimensions setup (basic) | Before Expense can assign dimensions |
| Workflow builder (basic) | Before Expense approval workflow |
| Vendor categories (basic) | Before AP goes live |
| User & role management | Before any multi-user module goes live |

**Build order when the time comes:**

1. Tenant profile page (branding, basic settings)
2. Module activation toggles
3. Org structure (departments, cost centers)
4. COA upload + GL mapping
5. Dimensions engine
6. Workflow builder (start with sequential only; add parallel/conditional in phase 2)
7. Document & KYC rules
8. Tax rules
9. FX & currency
10. Vendor & customer categories
11. Module-specific settings
12. Notification templates
13. Integration setup
14. Audit log viewer
15. AI/ML configuration (last — depends on ICE being built)

The workflow builder is the most complex UI in the entire product. Budget extra time for it.

---

*End of PRD. Update this document just before building the Tenant Admin Portal.*
