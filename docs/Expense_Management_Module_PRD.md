# Expense Management Module — Product Requirements Document (PRD)

**Product:** PRAD — Accounting Automation Platform
**Module:** Expense Management (Retirement & Reimbursement)
**Version:** 1.0
**Document status:** Merged and converted from two source Word documents to Markdown
**Converted on:** July 25, 2026

> This document merges two source files into one PRD: the master document (Sections 1-5: Executive Summary through Business Requirements) and its continuation document (Sections 6-19: Functional Requirements through Appendices), which was originally authored as a separate file picking up where the master left off.

---

## Table of Contents

1. Executive Summary
2. Background, Problem Statement & Current State Analysis
3. Scope & Out-of-Scope
4. Personas & User Roles
5. Business Requirements & User Stories
6. Functional Requirements
7. Workflow Designs
8. Data Model & Entity Definitions
9. API Requirements
10. Posting Rules & Accounting Logic
11. UI/UX Requirements
12. Security, Compliance & Audit Requirements
13. Non-Functional Requirements (NFRs)
14. Reporting & Analytics Requirements
15. Integration Requirements
16. Configuration & Tenant Customization Requirements
17. Deployment, Hosting & Environment Requirements
18. Glossary & Definitions
19. Appendices (Supporting Materials)

---

## 1. Executive Summary

The ZivaBI Expense Management Module is an enterprise-grade financial
automation solution designed to eliminate
manual, error‑prone, and fragmented expense management processes. It
serves as a centralized, smart, configurable,
multi‑tenant expense automation system capable of handling reimbursable
employee expenses, travel advances,
advance retirements, policy enforcement, GL/dimension validation, tax
governance, and seamless integration with
AP, Payroll, AR, and the company's financial reporting ecosystem.

The module exists to solve problems faced globally by organisations:
- Slow and inconsistent reimbursement cycles.
- Manual processing of receipts, spreadsheets, and emails.
- Incorrect GL, cost center, and internal order entries.
- Missing or incomplete documentation.
- Long finance review cycles.
- Manual journal entry creation.
- Incomplete or non‑existent audit trails.
- Poor transparency for employees regarding their reimbursement status.
- Stale travel advances and lack of retirement monitoring.

The ZivaBI platform solves these problems by providing:
- A mobile‑ready, intuitive user interface for employees.
- OCR-backed document scanning and auto-extraction.
- Auto-matching of receipts to expense lines.
- Automated enforcement of policy rules and threshold validations.
- Configurable approval workflows (multi-level).
- Automated posting of GL entries, dimension mapping, VAT/WHT
application, and FX logic.
- Real-time dashboards, notifications, and analytics.
- Full audit trail capture for internal and external auditors.
- Multi-tenant configurability enabling each organisation to customise
dimensions, chart of accounts,
tax rules, approval hierarchies, and reimbursement policies.

This module is not only a digital replacement of spreadsheets---it
provides advanced workflow intelligence that
reduces finance workload, improves compliance, accelerates
reimbursements, engages employees, and strengthens
financial control across the enterprise.

Strategically, the ZivaBI Expense Management Module:
- Enhances financial governance and internal controls.
- Reduces operational cost and processing cycle times.
- Improves accuracy in accounting and reporting.
- Strengthens employee experience and trust.
- Positions ZivaBI as a world‑class automation suite to rival global
players like SAP Concur, Coupa, Workday,
and Zoho Expense---but with deeper internal control logic and a more
flexible multi-tenant architecture.

This PRD defines every requirement needed to design, build, deploy, and
implement the Expense Management Module
from end to end. It covers personas, workflows, data models, posting
rules, UI requirements, security constraints,
audit expectations, and integration points.

## 2. Background, Problem Statement & Current State Analysis

The Expense Management process in many organizations---across industries
and geographies---remains one of the most
manual, fragmented, and error-prone areas of finance operations. This
section outlines the operational realities
that organizations face today, the root causes of inefficiencies, and
the specific business pain points that the
ZivaBI Expense Management Module solves.

### 2.1 Industry Context and Evolution
Historically, organizations have relied on:
- Paper-based expense forms.
- Physical receipts and manual verification.
- Email-driven approval processes.
- Excel-based tracking of travel advances.
- Offline file storage for supporting documents.

Even in modern organizations, employee expense workflows rarely achieve
full automation because:
- Existing tools lack deep finance features (dimensions, GL rules,
VAT/WHT logic).
- Tools designed for HR or travel do not integrate well with
Accounting/ERP systems.
- Approvals depend on manual email chains and organizational hierarchy
knowledge.
- Employees lack understanding of cost structures, leading to incorrect
submissions.
- Finance teams are overwhelmed with checking, validating, correcting,
and posting.

### 2.2 Current State Challenges
Across organizations, the following problems are observed:

A. Manual Submission & Data Entry
- Employees fill forms manually and attach receipts one-by-one.
- Multiple scans/photos create inconsistent document formats.
- High error rates in amounts, dates, vendors, and descriptions.

B. Missing or Incorrect Financial Coding
- Cost centers often incorrect.
- Real and statistical internal orders misapplied.
- GL account coding inconsistent across employees.
- Dimensions missing or wrongly selected.

C. Broken Approval Workflows
- Approvals get lost in email threads.
- Employees lack transparency on who must approve next.
- Escalations are manual and inconsistent.
- Approving managers lack context or drill-down capability.

D. Finance Review Bottlenecks
- Finance manually checks receipts and validates compliance.
- Large volumes create delays at month-end.
- Finance must manually adjust GL, VAT, WHT, and dimension errors.
- Heavy reliance on memory and institutional knowledge.

E. Lack of Centralized Audit Trail
- Receipts stored in different locations.
- Final documentation unavailable for auditors.
- External auditors must request evidence manually.
- Missing evidence leads to audit findings and compliance risks.

F. Travel Advance Mismanagement
- Advances not retired on time.
- Employees forget outstanding advances.
- Finance must chase individuals for retirement.
- Under/over claims require manual tracking.
- FX conversion inconsistencies in multinational operations.

### 2.3 Root-Cause Analysis
The pain points originate from:

1. Employee-side limitations:
- Lack of financial literacy regarding GL, IO, VAT, WHT.
- Difficulty managing receipts during travel.
- No easy mobile submission method.
- No real-time visibility into approval status or payment dates.

2. System-side limitations:
- Lack of automation tools capable of handling multi-dimensional
accounting.
- No integration between approval workflows and financial posting.
- No enforcement of mandatory fields or validation rules.
- Insufficient document management capabilities.

3. Process-side limitations:
- Policy enforcement inconsistent.
- No escalation matrix for overdue approvals.
- No automated reminders for outstanding advances.
- No systematic closure process during month-end.

### 2.4 Impact on the Business
Without a proper automated system:
- Finance spends 40--60% of processing time correcting employee errors.
- Month-end close is delayed by 1--3 days.
- Audit readiness drops significantly.
- Employees experience frustration with delayed reimbursements.
- Company cash flow visibility becomes inaccurate.
- Fraud risk increases (duplicate claims, edited receipts, false
claims).

### 2.5 Why Existing Market Solutions Fail
Mainstream solutions (SAP Concur, Zoho Expense, FreshBooks, Odoo,
Expensify) fall short because:
- They do not support Real/Statistical IO logic.
- They cannot enforce tenant-specific GL/Dimension combinations.
- Their tax engines are too generic for VAT/WHT-rich countries.
- Their approval workflows lack multi-layer organizational logic.
- They are not multi-tenant configurable at the depth required.
- They do not integrate with clearing agent or vendor advance logic.

### 2.6 The ZivaBI Vision
ZivaBI solves all the above by providing:
- Complete end-to-end automation.
- OCR-based extraction to eliminate manual entry.
- Automated GL + Dimension inference.
- Approval workflow that adapts to each tenant's structure.
- Automated VAT/WHT logic per tenant rules.
- Real-time employee visibility into approval flow and payment.
- Automated audit trail with exportable evidence bundles.
- Automated tracking of travel advances and retirement.
- Tight integration with AP, AR, Payroll, Inventory, and Reporting.

This module is built to exceed global enterprise standards,
ensuring that companies eliminate manual processes and operate with
world-class efficiency.

## 3. Scope & Out-of-Scope

### 3.1 Purpose of the Scope Section
The purpose of the scope section is to clearly define what the ZivaBI
Expense Management Module is responsible for,
what problems it is designed to solve, and what boundaries it will not
cross. This ensures accurate expectations,
structured development, and efficient cross-team collaboration.

The scope also aligns product, engineering, finance, compliance, and
tenant admin teams on the precise functional
coverage of the module.

### 3.2 In-Scope --- What This Module Will Cover

A. Employee Expense Reimbursement
- Submission of reimbursable expenses across multiple categories.
- Mobile-first submission with photo/scan OCR extraction.
- Multi-line expense creation with editable fields per line.
- Automatic calculation of totals, taxes, and currency conversions.
- Mandatory attachment enforcement (based on tenant policy).

B. Travel Advances & Retirement
- Requesting travel advances.
- Automatic tracking of outstanding advances.
- Workflow-driven retirement process.
- Auto-matching expenses to outstanding advances.
- Calculation of over/under recovery:
- Employee refund to company (via Payroll or AR).
- Company reimbursement to employee.

C. Approval Workflow Engine
- Multi-level approvals:
Employee → Line Manager → HOD → GM → Finance → CFO (as required).
- Amount-based routing rules.
- Dimension-based routing rules.
- SLA timers + Auto-escalations.
- Query/response functionality per line or entire request.
- Rejection logic with or without re-submission allowed.

D. Finance Review & Adjustment
- Finance can edit GL accounts, dimensions, tax fields, and amounts.
- Line-level rejection with automatic recalculation of totals.
- Compliance validation (policy, COA rules, dimension relationships).
- Detection of duplicate receipts or duplicate claims.
- Verification of document authenticity and completeness.

E. OCR & Document Intelligence
- Support for PDF, image, camera scan.
- Extraction of:
- Vendor name
- Invoice number
- Invoice date
- Currency
- Lines & amounts
- Tax elements (VAT breakdown)
- Confidence scoring and verification prompts.
- Automatic mapping of scanned receipts to expense lines.

F. Accounting & Tax Automation
- Automated GL postings based on tenant COA.
- Dimension field enforcement (Cost Center, IO, Statistical IO, Project,
Location).
- VAT logic (recoverable, non-recoverable, omitted VAT detection).
- WHT logic (if applicable by tenant country).
- FX handling (rate source configurable per tenant).
- Support for multi-currency reimbursement.

G. Employee Portal & Dashboard
- All expenses in one place (All, Pending, Approved, Paid, Rejected).
- Travel advance widget (active + overdue + due-for-retirement).
- Ability to track status in real-time.
- Notifications for:
- Missing documentation
- Approvals required
- Queries
- Retirement deadlines
- Scheduled payment dates

H. Audit & Evidence Management
- Immutable audit log for every line event.
- Evidence bundle downloadable as ZIP/PDF.
- Auditor read-only portal.
- Query-responses automatically indexed.
- Ability to trace each expense line back to the source document.

I. Reporting & Analytics
- Aging report for expenses and advances.
- Expense trends by category, department, project.
- Approval SLA compliance.
- Tax summary (VAT/WHT).
- Policy compliance dashboard.

### 3.3 Out-of-Scope --- What This Module Will NOT Cover

A. Payroll System Functionality
- Module integrates with payroll for deductions; it does NOT process
payroll.

B. Procurement and Vendor Invoices
- Vendor invoices belong to AP module, NOT this module.

C. Inventory / Fixed Asset Acquisition
- Requests that relate to purchasing assets or POSM are handled by AP or
Inventory modules.

D. Budgeting and Planning
- Budgets may influence approval rules but are managed externally.

E. Travel Booking & Itinerary Management
- The module reimburses expenses; it does NOT book travel.

F. Company Cards (Future Module)
- Not included in current scope but may be added later.

G. Multi-Entity Financial Consolidation
- Expense module produces GL transactions but does not consolidate
entities.

### 3.4 Assumptions

- Each employee has proper system credentials.
- Each tenant will configure COA, dimensions, and policies during
onboarding.
- Approval hierarchy reflects tenant's organizational structure.
- Tenant-specific tax logic (VAT/WHT) must be provided.
- Employees are responsible for uploading valid supporting
documentation.

### 3.5 Success Criteria

- 60% reduction in employee submission time.
- 50% reduction in Finance review time.
- Near-zero posting errors (<0.5%).
- Audit readiness with complete documentation evidence.
- Real-time status tracking for all employees.
- Automated enforcement of policy and tax logic.

## 4. Personas & User Roles

This section defines all key personas who interact with the ZivaBI
Expense Management Module, along with their goals,
pain points, responsibilities, permissions, and system interactions. The
module is designed to deeply consider the needs
of each persona to ensure intuitive usability, streamlined workflows,
and accurate data entry.

### 4.1 Purpose of Persona Definition

Persona definition ensures:
- The product meets the needs of actual end users.
- Workflows and UI/UX are tailored to real-life behaviors.
- Permission structures reflect real organizational roles.
- The approval engine mirrors how organizations operate.
- Finance and compliance requirements remain central.

### 4.2 Primary Personas

Persona 1 --- Employee (Expense Submitter)

Description:
The employee is the primary user who submits reimbursable expenses and
travel advance retirements.

Goals:
- Submit expenses quickly and easily.
- Avoid errors caused by complex GL or dimension requirements.
- Track status of approvals and payment.
- Receive timely reimbursements.
- Avoid administrative friction.

Pain Points:
- Lost receipts.
- Unclear policies.
- Long approval delays.
- Difficulty understanding GL/dimensions.

Responsibilities:
- Enter expenses truthfully.
- Attach valid supporting documents.
- Provide required details.
- Respond to Finance or approver queries.

System Interactions:
- Create/edit/delete expense lines.
- Upload/scan receipts.
- Select GL/dimensions (if enabled).
- Submit for approval.
- Track approval/payment status.
- Respond to queries.

Persona 2 --- Line Manager (LM)

Description:
The employee's direct supervisor responsible for verifying business
justification.

Goals:
- Ensure expenses are legitimate.
- Approve quickly without administrative burden.
- Identify policy violations early.

Pain Points:
- Insufficient context.
- Too many approvals.
- Delays affect employee morale.

Responsibilities:
- Approve/reject expenses.
- Provide comments on queries.
- Validate correctness of descriptions.

Interactions:
- Approve/reject full request or individual lines.
- View documentation.
- Raise queries.

Persona 3 --- Head of Department (HOD)

Description:
Approves expenses based on departmental budget and compliance.

Goals:
- Ensure alignment with department spending.
- Maintain budget control.

Interactions:
- Reviews cost categories.
- Approves/rejects expenses.
- Sees departmental expenditure summaries.

Persona 4 --- General Manager (GM)

Description:
Senior approver for high-value or sensitive transactions.

Interactions:
- Approves/rejects high-value items.
- Provides audit-sensitive commentary.
- Reviews SLAs.

Persona 5 --- Finance AP Analyst

Description:
Responsible for detailed financial validation.

Goals:
- Ensure correctness of GL, dimensions, VAT/WHT.
- Prevent misposting.
- Maintain compliance.

Pain Points:
- Frequent employee mistakes.
- Missing documentation.
- Manual corrections.

Responsibilities:
- Validate all fields.
- Adjust GL/dimensions.
- Apply tax logic.
- Route queries.
- Approve for posting.

Persona 6 --- Finance Manager / Controller

Description:
Senior approver with financial authority.

Responsibilities:
- Final approval before posting.
- Payment scheduling.
- Oversight over accuracy and compliance.

Persona 7 --- CFO / Executive Reviewer

Description:
Uses module for oversight, liquidity planning, and audit governance.

Interactions:
- Dashboard visibility.
- High-value approval (optional per tenant).
- Reporting.

Persona 8 --- Internal or External Auditor

Description:
Read-only user whose objective is to verify controls, approvals, and
evidence.

Interactions:
- View audit trail.
- Download documents.
- Review approvals.

Persona 9 --- Tenant Administrator

Description:
Configures the module for the organization.

Responsibilities:
- Maintain COA.
- Configure dimensions and rules.
- Adjust approval workflow.
- Manage user roles.
- Enable/disable features.

Persona 10 --- ZivaBI Super Admin (System Owner)

Description:
Platform-level role responsible for maintaining the global system.

Responsibilities:
- Manage tenants.
- Activate modules.
- Maintain global settings.
- Perform high-level debugging and support.

## 5. Business Requirements & User Stories

This section defines the complete business requirements, functional
expectations, user stories, and acceptance criteria
for the ZivaBI Expense Management Module. The Business Requirements form
the foundation for detailed system design,
workflow engineering, technical architecture, and end-user experience.

### 5.1 Purpose of Business Requirements

The purpose of defining business requirements is to:
- Clearly articulate what the system must achieve.
- Align expectations between product, engineering, finance, and
tenants.
- Standardize behavior across all tenants while supporting
configurability.
- Serve as a contract for development, testing, and validation.

Business Requirements in this module are categorized into:
A. Core Expense Requirements
B. Travel Advance Requirements
C. Approval Workflow Requirements
D. Finance Review Requirements
E. Policy & Compliance Requirements
F. Accounting Requirements
G. Reporting Requirements
H. Audit Requirements
I. Integration Requirements
J. User Experience Requirements

### 5.2 Core Expense Requirements

BR-001: The system shall allow employees to submit reimbursable expenses
with unlimited line items.
BR-002: The system shall support desktop and mobile submission.
BR-003: The system shall support receipt scanning via mobile camera.
BR-004: The system shall automatically extract data using OCR:
- Vendor name
- Date
- Amount
- VAT
- Currency
- Invoice number
- Description text
BR-005: The system shall allow employees to override OCR data.
BR-006: The system shall allow employees to attach multiple receipts.
BR-007: The system shall auto-calculate totals.
BR-008: The system shall validate that all required fields are completed
before submission.

### 5.3 Travel Advance Requirements

BR-020: The system shall allow employees to request travel advances.
BR-021: The system shall enforce tenant-defined limit rules.
BR-022: The system shall track outstanding advances by employee.
BR-023: The system shall allow travel advance retirement.
BR-024: The system shall route retirement through the same approval
workflow.
BR-025: The system shall auto-match retirement lines to outstanding
advances.
BR-026: The system shall compute:
- Over-spent → company reimburses employee
- Under-spent → employee reimburses company (via payroll or AR)

### 5.4 Approval Workflow Requirements

BR-040: The system shall support multi-level approval routing.
BR-041: Routing shall depend on:
- Employee hierarchy
- Amount thresholds
- Dimension rules (optional)
BR-042: The system shall support delegation.
BR-043: Approvers shall approve entire request or individual lines.
BR-044: Approvers shall be able to raise queries.
BR-045: Approvals shall respect SLA timers and auto-escalation.

### 5.5 Finance Review Requirements

BR-060: Finance shall have authority to edit GL accounts.
BR-061: Finance shall have authority to edit dimensions.
BR-062: Finance shall have authority to edit VAT/WHT fields.
BR-063: Finance shall be able to approve, reject, or query lines.
BR-064: Finance shall see audit history for each line.
BR-065: Finance shall have tools for mass approval.

### 5.6 Policy & Compliance Requirements

BR-080: The system shall enforce tenant-defined policy limits.
BR-081: The system shall enforce mandatory attachments.
BR-082: The system shall detect duplicate receipts.
BR-083: The system shall validate expense date range against travel
policy.
BR-084: The system shall flag suspicious expense patterns.
BR-085: The system shall enforce that advances must be retired within a
tenant-defined deadline.

### 5.7 Accounting Requirements

BR-100: The system shall generate automated GL posting entries.
BR-101: The system shall support tenant-defined COA.
BR-102: The system shall support:
- Cost Center
- Real IO
- Statistical IO
- Material IO
- Location
BR-103: The system shall support VAT and WHT per tenant tax rules.
BR-104: The system shall support multi-currency expenses.
BR-105: The system shall prepare expenses for payment in the AP module.

### 5.8 Reporting Requirements

BR-120: Reporting shall include:
- Outstanding expenses
- Completed expenses
- Expense aging
- Approval time
- SLA compliance
- Travel advance aging
- Tax summaries
- Cost category analysis
- Dimension-level analysis

### 5.9 Audit Requirements

BR-140: The system shall store all receipts and documents indefinitely.
BR-141: The system shall maintain a line-level audit trail:
- Created
- Modified
- Queried
- Approved
- Posted
- Paid
BR-142: The system shall allow auditors to download evidence bundles.
BR-143: The system shall provide read-only auditor access.

### 5.10 Integration Requirements

BR-160: The system shall integrate with:
- AP Module
- AR Module
- Payroll Module
- Tax Engine
- Master Data Services
- Reporting & Analytics Module

### 5.11 User Experience Requirements

BR-180: The system shall support:
- Responsive UI
- Mobile-first experience
- Intuitive layout
- Drag-and-drop uploads
- Real-time validation
- Transparent approval timeline

### 5.12 User Stories (Representative Set)

US-001: As an employee, I want to submit expenses quickly so that I do
not spend time on administrative work.
US-002: As an employee, I want to take pictures of receipts and have the
system extract data automatically.
US-003: As a manager, I want to see all supporting documents so that I
can make informed approvals.
US-004: As Finance, I want to validate GL and dimensions so that
financial reporting remains accurate.
US-005: As Finance, I want to detect duplicate claims so that fraud is
prevented.
US-006: As a tenant admin, I want to configure workflows so that
approvals follow company structure.
US-007: As a CFO, I want dashboards that show expense trends across cost
centers.
US-008: As an auditor, I want to download evidence for selected
transactions.

### 5.13 Acceptance Criteria (Examples)

AC-001: OCR shall extract fields with at least 85% confidence score.
AC-002: System shall block submission if mandatory fields are missing.
AC-003: System shall auto-escalate approval if SLA is exceeded.
AC-004: System shall not allow retirement of zero advances.
AC-005: Finance edits shall be logged with timestamp and user ID.
AC-006: VAT/WHT shall be computed automatically using tenant rules.
AC-007: Expense posting must produce balanced debit/credit entries.
AC-008: Audit export must contain all receipts, comments, approvals.


---

## 6. Functional Requirements

This section defines the complete functional behavior of the ZivaBI
Expense Management Module starting from
system inputs, validations, workflow interactions, GL/dimension
enforcement, tax treatment, exception logic,
OCR functionality, and automated accounting controls.

IMPORTANT: Reverse VAT, self-accounted VAT, and WHT deduction rules DO
NOT APPLY to employee expense
retirements or employee travel advances. These apply only to vendor
payments (handled in the AP Module),
not to employees. All tax controls herein are strictly related to
validating vendor taxes ON receipts used
for expense retirement (not collecting them from employees).

### 6.1 Expense Line Field Requirements

Each expense line in a retirement or reimbursable submission shall
include the following fields:

1. PL Group
2. P&L Line
3. GL Account
4. Real / Statistical Internal Order
5. Cost Center / Trading Partner (if enabled)
6. Material IO (if enabled)
7. Location
8. Invoice Number
9. Invoice Date
10. Description
11. Amount
12. Currency
13. Receipt Attachments

Dynamic Rules:
- Field availability is tenant-configurable.
- Field names may be renamed by tenant.
- GL options auto-filter based on selected PL/P&L Line.
- Dimensions auto-filter based on GL mapping.
- System enforces Not Applicable (N/A) automatically where appropriate.

### 6.2 OCR Processing & Data Extraction

OCR shall automatically extract:
- Vendor Name
- Invoice Number
- Invoice Date
- Currency
- Amount
- VAT Amount (if printed on invoice)
- Description tokens

Employee may override OCR values.

Receipts may be:
- Scanned
- Photographed
- Uploaded as PDF or image
- Multi-page documents

OCR Confidence Handling:
- ≥ 85% confidence → auto-fill immediately
- 60--85% → employee must confirm
- < 60% → employee must manually enter

### 6.3 GL & Dimension Mapping Logic

The system shall automatically apply GL/dimension consistency rules:

- Real IO allowed only on GLs mapped as real-order-enabled.
- Statistical IO allowed only on GLs mapped as
statistical-order-enabled.
- Material IO allowed only for GLs linked to material expenses.
- If GL requires no IO → system auto-sets N/A and disables field.
- Location selection must follow tenant-defined location mapping.

Employee can override only if tenant config allows.

### 6.4 Tax Logic (Employee Context)

Employee reimbursements DO NOT attract:
- WHT
- Self-account VAT
- Reverse charge VAT
- Supplier VAT withholding

However, system validates vendor-issued VAT on receipts:
- If VAT printed but missing → system flags for review.
- If VAT appears wrong → system flags for Finance validation.

VAT here is for *validation*, not deduction.

### 6.5 Duplicate Invoice Detection & Exception Handling

(Full duplicate detection specification embedded as previously
instructed)

### 6.6 Travel Advance & Retirement Logic

System shall:
- Track outstanding advances per employee.
- Require retirement before new advance (unless tenant config allows).
- Auto-match retirement lines to advance amount.
- Compute:
  - Overspend: company reimburses difference
  - Underspend: employee refunds (via payroll or AR)

### 6.7 Policy & Compliance Enforcement

System enforces:
- Per diem rules (if enabled)
- Expense category limits
- Receipt requirement rules
- Travel policy constraints
- Mandatory field rules

All policy rules tenant-configurable.

### 6.8 Query, Rejection & Resubmission Logic

Approvers and Finance may:
- Query entire request or individual lines
- Reject individual lines or full request

Employee may:
- Respond to queries
- Correct rejected lines and resubmit

System must:
- Maintain audit trail of all queries and actions
- Notify employees of pending actions

### 6.9 Finance Review Logic

Finance can:
- Adjust GL account
- Adjust IO/dimensions
- Apply or adjust VAT validity
- Reject or approve lines
- Request additional documents

System ensures:
- All changes logged
- Old and new values recorded

### 6.10 Approval Routing Behavior

Approval levels follow tenant configuration:
- Employee → LM → HOD → GM → Finance → CFO (optional)

Routing Rules:
- Amount-based
- Category-based
- Dimension-based
- Project-based (if enabled)

### 6.11 Automated Accounting Postings

For employee reimbursements:
DR Expense (per line)
CR Employee Payable

For travel advance issuance:
DR Employee Advance
CR Cash/Bank

For travel advance retirement (over/under):
- Overspend: DR Expense / CR Employee Payable
- Underspend: DR Employee Payable / CR Employee Advance

### 6.12 Notifications & SLA Logic

System sends notifications for:
- Submission confirmation
- Query received
- Query response due
- Approval received
- Rejection
- Payment scheduled
- Advance overdue reminder

SLA timers configurable:
- Approval deadlines
- Finance review deadlines
- Retirement deadlines

### 6.13 Exception Handling

System handles:
- Missing fields
- Invalid formats
- OCR failures
- Duplicate detection collisions
- Incorrect dimension values
- Insufficient documentation

### 6.14 Security Requirements (Functional Layer)

User access limited to:
- Own submissions (employee)
- Direct reports (manager)
- Department data (HOD)
- Org-wide data (Finance/Admin roles)

All sensitive fields encrypted in database.

### 6.15 System Constraints & Edge Case Behavior

- Unlimited lines supported
- Max attachment size per tenant config
- Multi-currency supported
- Offline draft mode (mobile)
- Auto-save drafts every 5 seconds

## 7. Workflow Designs

This section documents all workflow processes required for the ZivaBI
Expense Management Module.
It includes step-by-step flow logic, branching conditions, exception
handling, and full lifecycle behaviors
that govern how expenses move from creation → approval → finance review
→ posting → payment.

### 7.1 Expense Submission Workflow

1. Employee selects "New Expense Reimbursement" or "New Travel Advance
Retirement".
2. System loads dynamic form based on tenant configuration.
3. Employee enters multiple lines (desktop = multi-line table; mobile =
paginated per line).
4. Receipts are uploaded or scanned:
- OCR extraction begins immediately.
- System auto-fills invoice fields based on confidence thresholds.
5. System validates:
- Required fields.
- Dimension/GL mapping.
- Policy limits.
- Duplicate invoice (full detection engine).
6. Auto-save triggers every 5 seconds.
7. Employee submits the expense.
8. Status becomes: "Submitted -- Pending Line Manager Approval".

### 7.2 Employee Query/Correction Workflow

1. Approver/Finance raises a query (line-level or full request).
2. Employee receives notification and must correct (or justify) the
line(s).
3. Employee resubmits.
4. Audit log stores:
- Query message
- Employee response
- All changes with timestamp + user ID

### 7.3 Multi-Level Approval Workflow

Approval levels defined by tenant:
Employee → Line Manager → HOD → GM → Finance Analyst → Finance Manager →
CFO

Rules:
- Approvers may approve, reject, or query.
- Approvers may only view data for their approval stage.
- Finance sees full data, including employee corrections.
- Amount thresholds trigger additional approvals.
- SLA timers trigger:
  - Reminders at 50% and 90% of SLA.
  - Auto-escalation if overdue.

States:
- Pending LM Approval
- Pending HOD Approval
- Pending GM Approval
- Pending Finance Review
- Pending CFO Approval (optional)
- Approved -- Ready for Posting

### 7.4 Finance Review Workflow

1. Finance opens request in "Pending Review".
2. System highlights:
- OCR mismatches
- Duplicate invoice suspicions
- Policy violations
- Missing receipts
- Dimension/GL inconsistency
3. Finance may:
- Edit GL/dimensions
- Edit VAT validity
- Reject lines
- Approve lines
- Request more documentation
4. Once all lines are approved:
- System generates accounting entry preview.
- Finance Manager must approve final posting.

### 7.5 Travel Advance Retirement Workflow

1. Employee selects the outstanding travel advance to retire.
2. System displays:
- Advance amount
- Date issued
- FX rate (if applicable)
3. Employee enters expense lines (same as normal reimbursement).
4. System auto-matches total expenses vs. advance amount:
- If Overspent:
→ Additional reimbursement calculated
→ Debit Expense / Credit Employee Payable
- If Underspent:
→ Amount to be refunded
→ Debit Employee Payable / Credit Employee Advance
5. Finance confirms calculations.
6. Retirement approved → Advance cleared.

### 7.6 Duplicate Invoice Exception Workflow

(Integrated from earlier specification)

1. System detects potential duplicate.
2. If exact match → BLOCK.
3. If partial match → User sees side-by-side compare.
4. User selects:
- Use Anyway (requires justification)
- Link to Existing Request
- Cancel/Re-upload
5. Finance receives exception queue item.
6. Finance decisions:
- Approve as valid → Allow continuation
- Reject as duplicate → Send back to employee
- Mark split-valid → Link to existing request
7. Audit log captures entire chain.

### 7.7 Rejection Workflow

If any approver rejects:
- System requires a mandatory reject reason.
- Request returns to employee.
- Employee may modify and resubmit OR permanently delete draft.

If Finance rejects after partial approval:
- Approved lines remain approved.
- Only rejected lines are returned for correction.

### 7.8 Posting Workflow

Trigger: All approvals completed.

System generates posting entries:
- DR Expense
- CR Employee Payable
(or)
- DR Employee Advance
- CR Cash (for advances)

Posting Rules:
- Batch or single posting supported.
- Export to external payroll/AP allowed.

### 7.9 Payment Workflow

After posting approval:
- Request moves to "Ready for Payment".
- Finance Manager reviews payment batches.
- Payment runs can be:
  - Weekly
  - Bi-weekly
  - Monthly
  - Tenant-defined
- Employee receives notification:
"Your reimbursement has been scheduled for payment on: <date>"
- Status becomes "Paid".

### 7.10 Audit Workflow

Audit Portal allows:
- View entire request
- View all receipts
- View all approval logs
- View duplicate-detection events
- Download evidence bundle as ZIP/PDF

Audit Evidence Package includes:
- Original receipts
- OCR results
- All approval comments
- All queries and responses
- Posting entries
- Attachments and metadata

## 8. Data Model & Entity Definitions

This section defines the full data model for the ZivaBI Expense
Management Module, including
entities, relationships, constraints, cardinalities, and multi-tenant
data isolation rules.

The model supports:
- Expense reimbursement
- Travel advances
- Retirement logic
- Approval workflow
- Finance review
- Duplicate detection
- OCR extraction
- Audit logging
- Multi-tenant data segmentation

### 8.1 Entity Overview

Key entities include:

1. Tenant
2. User
3. EmployeeProfile
4. ExpenseRequest
5. ExpenseLine
6. ReceiptDocument
7. InvoiceRegistry
8. ApprovalStep
9. QueryThread
10. FinanceReviewRecord
11. AuditTrailEntry
12. AdvanceRecord
13. CurrencyRate
14. PolicyRule
15. DimensionMapping
16. GLAccount
17. CostCenter / IO / SIO / MIO
18. Location
19. PaymentBatchRecord
20. SystemNotification

### 8.2 Entity Definitions

Entity: Tenant
Purpose: Defines each company onboarded in the multi-tenant system.
Key Fields: tenant_id, tenant_name, industry_type,
module_subscriptions, config_json

Entity: User
Purpose: Authentication user for login.
Key Fields: user_id, email, role, permissions, tenant_id

Entity: EmployeeProfile
Purpose: Employee metadata for expense submitters.
Key Fields: employee_id, user_id, cost_center, manager_id,
hire_date

Entity: ExpenseRequest
Purpose: Parent container for a set of expense lines.
Key Fields: request_id, employee_id, request_type, status,
total_amount, submitted_at, tenant_id

Entity: ExpenseLine
Purpose: Line-level expense details.
Key Fields:
- line_id
- request_id
- pl_group
- pl_line
- gl_account
- real_io
- stat_io
- material_io
- location
- invoice_number
- invoice_date
- description
- amount
- currency
- vat_amount
- ocr_confidence
- duplicate_flag
- tenant_id

Entity: ReceiptDocument
Purpose: Stores receipts and supporting documents.
Key Fields: document_id, line_id, file_path, file_hash, p_hash,
extracted_text, uploaded_at

Entity: InvoiceRegistry
Purpose: Prevent duplicate invoice usage.
Key Fields:
- registry_id
- tenant_id
- invoice_number_normalized
- vendor_name
- invoice_date
- amount
- currency
- document_hash
- p_hash
- ocr_text_hash
- linked_request_id
- status

Entity: ApprovalStep
Purpose: Stores each approval event.
Key Fields: approval_id, request_id, approver_id, step_order,
action, comments, timestamp

Entity: QueryThread
Purpose: Communication between approver/finance and employee.
Key Fields: query_id, line_id, from_user, to_user, message,
timestamp

Entity: FinanceReviewRecord
Purpose: Captures Finance edits.
Key Fields: review_id, line_id, old_value, new_value,
field_changed, finance_user_id, timestamp

Entity: AuditTrailEntry
Purpose: Immutable logging for auditors.
Key Fields: audit_id, entity_type, entity_id, action, old_value,
new_value, timestamp

Entity: AdvanceRecord
Purpose: Track travel advances.
Key Fields: advance_id, employee_id, amount, currency, fx_rate,
issue_date, cleared_flag

Entity: CurrencyRate
Purpose: FX rate reference for multi-currency expenses.
Key Fields: rate_id, tenant_id, currency_code, rate, effective_date

Entity: PolicyRule
Purpose: Holds tenant-configurable policy data.
Key Fields: rule_id, tenant_id, rule_type, threshold,
configuration_json

Entity: DimensionMapping
Purpose: Maps GL to dimensions.
Key Fields: mapping_id, tenant_id, gl_account,
allowed_dimensions_json

Entity: GLAccount
Purpose: Chart of accounts per tenant.
Key Fields: gl_id, tenant_id, gl_code, gl_name, pl_group, pl_line,
active_flag

Entity: CostCenter / IO / SIO / MIO
Purpose: Dimensions.
Key Fields vary per dimension:
- id
- dimension_code
- dimension_name
- active_flag
- tenant_id

Entity: Location
Purpose: Expense execution location.
Key Fields: location_id, tenant_id, location_name

Entity: PaymentBatchRecord
Purpose: Represents reimbursement batch.
Key Fields: batch_id, tenant_id, batch_date, status

Entity: SystemNotification
Purpose: Tracks all system-level alerts.
Key Fields: notification_id, user_id, message, type, timestamp

### 8.3 Entity Relationships

ExpenseRequest → ExpenseLine
- 1-to-many (one request contains multiple lines)

ExpenseLine → ReceiptDocument
- 1-to-many (one line may have multiple receipts)

ExpenseLine → QueryThread
- 1-to-many (multiple queries per line)

ExpenseRequest → ApprovalStep
- 1-to-many (multi-level approval)

ExpenseLine → FinanceReviewRecord
- 1-to-many (multiple edits)

ExpenseRequest → AuditTrailEntry
- 1-to-many (log everything)

InvoiceRegistry → ReceiptDocument
- Indirect reference via document hash

User → EmployeeProfile
- 1-to-1

EmployeeProfile → AdvanceRecord
- 1-to-many

### 8.4 Multi-Tenant Data Segmentation

Each entity includes tenant_id.

Rules:
- No cross-tenant visibility.
- No cross-tenant invoice duplication checks.
- No cross-tenant approvals or workflows.
- Dimensions, GLs, and policies isolated per tenant.

### 8.5 Data Versioning Rules

Every change to:
- GL
- Dimensions
- Finance edits
- Approval actions
must create a new AuditTrailEntry.

### 8.6 Constraints

- A line must belong to a request.
- A request must belong to a valid employee.
- A request cannot be approved unless all lines are valid.
- InvoiceRegistry must enforce uniqueness per tenant.
- ReceiptDocument cannot be deleted.
- AdvanceRecord must be cleared before user receives new advance.

## 9. API Requirements

This section defines the RESTful API requirements for the ZivaBI Expense
Management Module.
It provides endpoint specifications, payload structures, authentication
rules, multi-tenant handling,
validation logic, and error response standards.

The API must support integrations with:
- ZivaBI Frontend (React/Next.js or similar)
- ZivaBI Mobile App (iOS/Android)
- Payroll System (optional)
- Accounts Payable Module
- Reporting & Analytics Engine
- Third-party systems (optional future requirement)

### 9.1 API Design Principles

All APIs must follow these standards:
- RESTful structure (JSON-based)
- Stateless requests
- Multi-tenant isolation by tenant_id
- JWT-based authentication
- RBAC (Role-Based Access Control)
- Standardized error codes
- Encrypted transport (HTTPS/TLS 1.2+)
- Rate limiting per tenant and per user (configurable)
- Pagination defaults: limit=50, max=500
- Strict validation and sanitization

### 9.2 Authentication & Security

- All endpoints require JWT token.
- Token must contain:
  - user_id
  - tenant_id
  - role
  - permissions
  - expiration
- API Gateway verifies:
  - Signature
  - Tenant active state
  - User active state
  - Module subscription enabled
- Unauthorized requests → HTTP 401
- Forbidden roles → HTTP 403

### 9.3 Multi-Tenant API Routing

Each request must include tenant context:

OPTIONS:
1. tenant_id included in JWT (preferred)
2. tenant_id passed in header: X-Tenant-ID
3. tenant_id included in request body (fallback)

System must never allow cross-tenant access.

### 9.4 Core API Endpoints

ExpenseRequest APIs

POST /api/expense/request/create
Creates a new expense request.
Payload:
{
\"employee_id\": \"...\",
\"request_type\": \"REIMBURSEMENT\" \| \"ADVANCE_RETIREMENT\",
\"lines\": [...],
\"tenant_id\": \"...\"
}

GET /api/expense/request/{request_id}
Returns expense request with all lines, status, approvals, and audit
logs.

PUT /api/expense/request/{request_id}/submit
Submits a request for approval.

PUT /api/expense/request/{request_id}/delete
Deletes a draft request.

ExpenseLine APIs

POST /api/expense/line/add
Adds a new line to a request.

PUT /api/expense/line/{line_id}/update
Updates any editable field in the line.

DELETE /api/expense/line/{line_id}
Removes a line from a request.

ReceiptDocument APIs

POST /api/expense/receipt/upload
Uploads receipt.
Triggers:
- OCR extraction
- Duplicate detection
- Invoice registry update

GET /api/expense/receipt/{document_id}
Returns receipt details & extracted data.

Duplicate Detection APIs

POST /api/duplicate/check
Input: file or invoice fields
Output:
- confidence_score
- matched_invoice_ids
- recommended_action
- blocking_flag

Approval APIs

PUT /api/approval/{request_id}/approve
PUT /api/approval/{request_id}/reject
PUT /api/approval/{request_id}/query

GET /api/approval/history/{request_id}

Each action requires:
- approver_id
- tenant_id
- role validation

Finance Review APIs

PUT /api/finance/line/{line_id}/adjust
Allows Finance to modify:
- GL
- Dimensions
- VAT validity
- Description

PUT /api/finance/request/{request_id}/approve
Final approval before posting.

Advance APIs

POST /api/advance/request
GET /api/advance/{employee_id}
PUT /api/advance/retire/{advance_id}

Audit & Evidence APIs

GET /api/audit/request/{request_id}
GET /api/audit/download/{request_id} → Returns ZIP/PDF evidence
bundle.

Payment APIs

GET /api/payment/queue
PUT /api/payment/batch/approve
PUT /api/payment/batch/execute

### 9.5 Validation Rules

- Required fields must be populated.
- InvoiceNumber must be normalized before validation.
- Duplicate detection must run synchronously during upload.
- GL/dimension rules applied before Finance review.
- Access must follow RBAC rules.

### 9.6 Error Response Structure

HTTP 400:
{
\"error_code\": \"VALIDATION_ERROR\",
\"message\": \"GL account is invalid for selected PL group\",
\"field\": \"gl_account\"
}

HTTP 401:
{
\"error_code\": \"AUTH_REQUIRED\",
\"message\": \"Authentication token missing or expired\"
}

HTTP 403:
{
\"error_code\": \"ACCESS_DENIED\",
\"message\": \"User not authorized for this operation\"
}

HTTP 409:
{
\"error_code\": \"DUPLICATE_INVOICE\",
\"message\": \"This invoice has already been used\",
\"confidence_score\": 98
}

### 9.7 Rate Limiting Rules

Default:
- 100 requests/min per user
- 1000 requests/min per tenant

### 9.8 Integration Requirements

- ERP posting API (future integration)
- Payroll deduction API (if enabled)
- AP payment engine API
- Exchange rate service API
- Notification service API

### 9.9 Versioning

All API endpoints versioned as:
- /api/v1/... (current)
- /api/v2/... (future extensions)

### 9.10 API Logging

Log fields:
- user_id
- tenant_id
- endpoint
- payload hash
- timestamp
- response code
- error codes

Logs stored for 7 years to satisfy audit & compliance.

## 10. Posting Rules & Accounting Logic

This section defines the full accounting treatment for employee
expenses, travel advances, retirements,
dimension propagation, FX handling, posting validations, and ERP
integration readiness.

The logic strictly follows IFRS, GAAP (where applicable), and standard
enterprise accounting controls.

### 10.1 Core Posting Structure

The ZivaBI Expense Management Module automatically generates accounting
entries for:

- Employee reimbursable expenses
- Travel advances issued
- Travel advance retirements
- Over/under recovery adjustments
- FX revaluation (if configured by tenant)
- Dimension propagation (Cost Center, IO, SIO, MIO, Location)

### 10.2 Employee Reimbursable Expenses

Once Finance approves all lines:

SYSTEM POSTS:

DR Expense (per line GL & dimension mapping)
CR Employee Payable

Rules:
- Each line creates independent DR postings.
- CR is aggregated per request into a single payable line.
- Posting date = Finance Manager approval date (or tenant-configured
rule).

### 10.3 Travel Advance Issuance

When an advance is approved and paid:

DR Employee Advance
CR Cash/Bank

Rules:
- Employee Advance account must be marked as "Reconcilable".
- Currency differences tracked automatically.
- Advance must be linked to a specific ER/Trip ID.

### 10.4 Travel Advance Retirement --- Overspend

If employee spends MORE than the advance amount:

Example:
Advance = 200,000
Total expenses = 240,000
Difference = 40,000 owed to employee

SYSTEM POSTS:

DR Expense (all lines)
CR Employee Advance (200,000)
CR Employee Payable (40,000)

Employee receives:
- Only 40,000 (not the full 240,000)

### 10.5 Travel Advance Retirement --- Underspend

If employee spends LESS than the advance amount:

Example:
Advance = 200,000
Total expenses = 150,000
Difference = 50,000 owed back to company

SYSTEM POSTS:

DR Expense (150,000)
DR Employee Advance (50,000)
CR Employee Advance (200,000)

Finance Administrator chooses:
- Payroll deduction
OR
- AR charge to employee

### 10.6 Dimension Propagation Logic

For each line:

DR Expense must carry:
- GL Account
- Cost Center (if required)
- Real IO (if required)
- Statistical IO (if required)
- Material IO (if required)
- Location

CR Employee Payable must carry:
- Cost Center = Employee\'s home cost center
- Other dimensions = Default per tenant config

CR Employee Advance (for advances)
- Dimensions default to employee master mapping.

### 10.7 FX Handling (Multi‑Currency Expenses)

10.7.1 For normal reimbursements:
If employee submits a receipt in foreign currency:

- Amount_in_NGN = Receipt Amount × FX Rate
- FX Rate source:
  - Tenant-defined (CBN rate, ECB rate, custom upload)
  - Rate date determined by:
→ Receipt date
→ Approval date
→ Posting date

(System uses tenant-selected method)

Example:
USD 100 × 1500 = NGN 150,000

10.7.2 For advances:
Advance amount is stored in base currency (e.g., NGN).

Actual foreign currency spent is converted at:
- Actual rate employee paid (must provide evidence)

If employee converted NGN 200,000 @ 1700 rate:
FX applied = 1700
System compares FX calculation with receipts.

10.7.3 For retirement:
If receipts are in different currencies:
- System converts each to NGN based on tenant-configured rules.

### 10.8 Posting Validations Before Approval

System must validate:

- Balanced entry (DR == CR)
- Valid GL for tenant
- Valid dimension mapping
- No open queries
- No missing receipts
- No duplicate invoices (must pass detection engine)
- Advance must exist if retiring one
- FX calculation must pass validation
- Tax anomalies flagged for Finance review

### 10.9 Posting Failure Rules

On failure:

- System blocks posting
- Shows exact field(s) that failed
- Logs failure reason
- Alerts Finance
- Prevents partial posting

### 10.10 Month-End Behavior

#### 10.10.1 Unretired Advances
System produces monthly advance aging report.

Rules:
- Advances older than X days (tenant-defined) → flagged
- Escalation to employee's manager
- CFO report highlight

#### 10.10.2 Locked Periods
If tenant locks accounting period:

- Posting date automatically moves to next open period
OR
- System blocks until period reopened (tenant config)

#### 10.10.3 FX Revaluation (Optional)
If tenant enables:
- Unrealized FX gains/losses posted monthly
- Reversed on first day of next month
- Realized differences posted when advance settles

### 10.11 Journal Review API Output Structure

Example output:

{
\"request_id\": \"ER-2025-00112\",
\"posting_date\": \"2025-03-14\",
\"journal_entries\": [
{
\"line_type\": \"DR\",
\"gl_account\": \"742000\",
\"description\": \"Marketing Expense\",
\"amount\": 120000,
\"dimensions\": {
\"cost_center\": \"CC100\",
\"real_io\": \"RIO2002\",
\"stat_io\": \"SIO410\",
\"material_io\": null,
\"location\": \"LAGOS\"
}
},
{
\"line_type\": \"CR\",
\"gl_account\": \"221500\",
\"description\": \"Employee Payable\",
\"amount\": 120000,
\"dimensions\": {
\"cost_center\": \"CC_EMPLOYEE\",
\"real_io\": null,
\"stat_io\": null,
\"material_io\": null,
\"location\": null
}
}
]
}

### 10.12 ERP Integration Readiness

- All postings follow clean DR/CR format
- Dimensions included in standardized structure
- Exportable JSON, XML, CSV
- Ready for API push to:
  - SAP
  - Oracle Fusion
  - Microsoft Dynamics
  - Sage
  - QuickBooks
  - Custom ERPs

### 10.13 Audit Trail for Postings

For each posting:

- Who performed final approval
- What was changed
- What was posted (before/after)
- FX rates applied
- Dimensions applied
- Supporting documents linked
- Timestamp & transaction signature

### 10.14 Error Handling & Edge Cases

Case: Negative line amounts
→ Block submission

Case: Zero-amount receipts
→ Only allowed for mandatory justification uploads

Case: Mixed currency receipts
→ System applies FX logic per line

Case: Employee changes cost center mid‑period
→ System uses cost center effective at posting date

## 11. UI/UX Requirements

This section defines the complete UI/UX design requirements for the
ZivaBI Expense Management Module.
The goal is to deliver a modern, intuitive, mobile-first,
enterprise-ready interface optimized for
speed, accuracy, and world-class user experience.

### 11.1 UI/UX Design Principles

The module must follow these UX principles:
- Minimal clicks to complete an action
- Clear visual hierarchy
- Strong contrast and accessibility compliance
- Responsive design (desktop, tablet, mobile)
- Consistent iconography
- Component reusability
- Inline validation and suggestions
- Real-time feedback (loading, success, warnings)
- Drag-and-drop everywhere possible
- Error-proofing and fraud prevention built into UI

### 11.2 Employee Portal --- Dashboard Requirements

The Employee Dashboard must include:

A. Widgets (draggable, configurable)
- "My Reimbursable Expenses"
- "My Travel Advances"
- "Pending Actions"
- "Upcoming Reimbursement Dates"
- "Total Expenses This Month"

B. Filters
- Status filter: All, Draft, Submitted, Queried, Approved, Paid
- Date filter
- Category filter
- Amount range filter

C. Quick Actions
- + New Expense
- + New Travel Advance
- View Travel Advance Retirement

### 11.3 Expense Form --- Desktop UI Requirements

A. Multi-line grid-style entry
- Two lines shown by default
- Add Line button → adds infinite rows
- Inline field validation
- Dynamic dropdowns for PL, GL, IO, SIO, MIO

B. Totals Panel
- Running total recalculates live
- Advance balance comparison (if retiring)

C. Receipt Upload Panel
- Drag-and-drop OR click to upload
- Attach to specific line
- Thumbnails per receipt
- Zoom + rotate + crop
- View extracted OCR text

D. Error Prevention
- Duplicate invoice detection modal
- Mandatory fields highlighted
- Inline policy violation banners

### 11.4 Expense Form --- Mobile UI Requirements

A. Paginated Line Entry
- One expense line per page
- Swipe left/right to navigate between lines

B. Receipt Capture
- Camera scanning with OCR
- Auto-cropping
- Auto-brightness correction

C. Top Summary Bar
- Total Amount
- Lines Count
- Advance Balance (if applicable)

D. Navigation
- Save Draft
- Submit
- Add Line
- Delete Line
- Go to Summary

### 11.5 Finance Review Screen (Critical UX)

Finance review must be extremely efficient. Features:

A. Line-by-line validation panel
- GL
- All dimensions
- VAT flags
- Duplicate warning indicator
- OCR mismatch highlights

B. Audit History Drawer
- Shows all queries
- Employee responses
- Value changes

C. Tools for Finance
- Approve All Lines
- Reject Line
- Query Line
- Mass Dimension Adjustment
- Recalculate Posting Preview

D. Receipt Evidence Viewer
- Side-by-side comparison
- OCR extracted fields
- Zoom & verify

### 11.6 Approval Workflow UI Requirements

Managers/HOD/GM/CFO see:

A. Summary Card
- Employee name
- Amount
- Category breakdown
- Compliance flags

B. Approver Actions
- Approve
- Reject
- Query
- View receipts
- View audit history

C. SLA Indicator
- Shows deadline
- Escalation path

### 11.7 Audit Portal UI Requirements

A. Request Browser
- Filters: date, employee, category, amount

B. Evidence Bundle View
- All receipts
- All documents
- Posting entries
- Approval trail
- Duplicate detection history

C. Auditor Restrictions
- Read-only
- No edits allowed
- Export evidence bundle as ZIP/PDF

### 11.8 Notification Center UI Requirements

Users see:
- Approvals received
- Queries raised
- Rejections
- Payment scheduled
- Advance overdue reminders

Notifications must support:
- Email
- In-app alerts
- Push notifications (mobile)

### 11.9 Theme & Branding Requirements

Must support:
- Tenant-specific color scheme
- Tenant logo
- Custom name for fields (PL group, IO, etc.)
- Dark mode / Light mode

### 11.10 Accessibility Requirements

Must comply with WCAG 2.1 AA:
- Keyboard navigation
- Screen reader labels
- High contrast mode
- Alt-text for icons
- Large font mode

### 11.11 Performance Requirements (UX-Level)

- Form load < 2 seconds
- OCR extraction < 3 seconds
- Page transitions < 0.5 seconds
- Maximum upload file: tenant-configurable (default 5MB)

### 11.12 Error State UX Requirements

Errors must be:
- Specific ("Invoice number required", not "Error")
- Non-destructive (keep all user input)
- Actionable (explain how to fix)
- Logged for Finance review

## 12. Security, Compliance & Audit Requirements

This section defines all security, compliance, data protection,
fraud-prevention, and audit-readiness
requirements for the ZivaBI Expense Management Module. As a financial
workflow system handling
sensitive data, the module must meet strict enterprise and regulatory
standards across all tenants.

### 12.1 Security Architecture Principles

The system must follow:
- Zero Trust Security Model
- Principle of Least Privilege (POLP)
- Multi-tenant data isolation
- End-to-end encrypted communication
- Strict authentication and authorization
- Continuous audit logging

### 12.2 Authentication Requirements

- All users authenticated via secure login (OAuth2/JWT).
- Strong password policy (tenant-configurable).
- Optional MFA (SMS, email, authenticator app).
- Session timeout rules configurable by tenant.
- Automatic token refresh with expiry enforcement.

### 12.3 Authorization & Access Control

- RBAC (Role-Based Access Control) enforced for every API.
- Permissions defined at:
  - Module level
  - Feature level
  - Record level (employee can only see own requests)
- Finance and Admin roles see additional data fields.
- Auditor roles are strictly read-only.

### 12.4 Multi-Tenant Data Isolation

Data isolation must be enforced at:
- Application layer
- API layer
- Database layer (row-level tenant_id constraint)

Rules:
- No cross-tenant API calls allowed.
- Duplicate detection runs ONLY within tenant context.
- Logs separated per tenant.
- Tenants cannot see each other's staff, dimensions, or GLs.

### 12.5 Encryption Requirements

Encryption in transit:
- HTTPS/TLS 1.2+ required for all endpoints.

Encryption at rest:
- All receipts, documents, and OCR data encrypted using AES-256.
- Sensitive PII fields encrypted in DB:
  - Employee name
  - Contact details
  - Bank details (if part of profile)

Hashing requirements:
- All uploaded documents hashed (SHA256 + pHash).

### 12.6 Fraud Prevention Controls

The system must protect tenants from:
- Duplicate invoice claims
- Altered/misleading receipt images
- Artificially manipulated data
- Policy circumvention

Controls include:
- OCR extraction cross-check
- Confidence scoring
- Duplicate invoice detection
- Receipt hashing and tampering checks
- Forced justification on suspicious claims
- Mandatory Finance review for high-risk items
- Threshold alerts for large expenses

### 12.7 Audit Trail Requirements

Audit trail must be:
- Immutable
- Append-only
- Timestamped
- With full user identity (user_id + role)

The system logs:
- Expense creation
- Line edits
- Receipt uploads
- OCR results
- Duplicate detection results
- Approvals, rejections, queries
- Finance edits (old vs. new value)
- Posting entries
- Payment status changes

Audit log retention:
- Minimum 7 years (tenant-configurable)

### 12.8 Evidence Bundle Requirements

For each request, system must generate an evidence bundle including:
- All receipts
- All supporting documents
- OCR extracted text
- Duplicate detection summary
- Approval trail
- Queries and responses
- Finance edits
- Posting entries

Download formats:
- ZIP (folder-based)
- PDF (concatenated report)

### 12.9 Compliance Standards

The module must be designed to support:
- IFRS (expense recognition)
- SOC 2 (security & audit controls)
- GDPR (data protection)
- Nigerian NDPR (if applicable per tenant region)
- ISO 27001 (information security)
- SOX-compliance--aligned audit trails

### 12.10 Monitoring & Logging Requirements

System must include:
- Real-time system activity logs
- API call logs
- Error tracking
- Performance metrics
- Security event monitoring
- Access logs
- Alerts for suspicious user behavior

All logs must:
- Include tenant_id
- Exclude sensitive PII
- Be timestamped
- Have high retention availability

### 12.11 Data Retention & Deletion Rules

- Tenant can configure document retention (default 7 years).
- Deleted requests (drafts only) permanently removed after X days.
- Completed requests CANNOT be deleted---only archived.

### 12.12 Backups & Disaster Recovery

- Automated daily backups
- Retention minimum 90 days
- Geo-redundant storage
- Recovery Point Objective (RPO) < 5 minutes
- Recovery Time Objective (RTO) < 30 minutes

### 12.13 Session Management Requirements

- Automatic logout after inactivity timeout
- Token invalidation on logout
- Session revocation on password reset
- Device/session tracking (optional per tenant)

### 12.14 Data Integrity Requirements

- All updates to financial fields require digital signature logging
- No record may be overwritten without audit log
- System prevents orphaned records (CASCADE rules disabled for financial
tables)

### 12.15 Key Security Edge Cases

Case: Employee changes cost center mid-month
→ System uses cost center as of posting date.
→ Audit logs record both original and updated cost centers.

Case: Approver leaves organization
→ Approval automatically re-routed to designated fallback approver.

Case: Fraudulent receipt upload attempt
→ System detects image manipulation → Flags for Finance investigation.

## 13. Non-Functional Requirements (NFRs)

This section defines the non-functional requirements that govern the
performance, scalability,
availability, observability, usability, reliability, and technical
constraints of the ZivaBI
Expense Management Module. These requirements ensure enterprise-grade
robustness across all tenants.

### 13.1 Performance Requirements

- Page load time (web): < 2 seconds
- Mobile view load: < 1.5 seconds
- OCR extraction time: < 3 seconds
- Receipt upload processing: < 5 seconds (including hash + OCR +
duplicate check)
- Approval action execution: < 1 second
- Search queries: < 2 seconds for data < 50,000 records
- Maximum supported request size: 20MB per upload (tenant-configurable)
- Batch posting preview generation: < 5 seconds
- Payment queue load time: < 3 seconds

### 13.2 Scalability Requirements

The system must scale horizontally and vertically:

Horizontal Scale:
- Ability to add worker nodes for OCR
- API autoscaling for high-traffic tenants
- Asynchronous processing for heavy tasks (OCR, hashing, batch
processing)

Vertical Scale:
- Ability to increase memory/CPU for heavy Finance review operations
- Adaptive caching for dimension & GL lookup tables

Tenant Isolation:
- Each tenant's data must scale independently
- No degradation of performance for other tenants during spikes

### 13.3 Availability Requirements

- System uptime target: **99.9% availability**
- Maintenance windows scheduled outside tenant active hours
- Zero-downtime deployment (blue/green or canary)
- Failover clusters for critical services:
  - API gateway
  - OCR services
  - Document storage
  - Database

### 13.4 Reliability Requirements

- All actions must be ACID-compliant at database level
- No partial posting allowed
- Retry logic must exist for:
  - File upload errors
  - Failed OCR calls
  - Network timeout on posting engine

- In case of server failure:
  - Drafts autosave every 5 seconds
  - No data loss beyond last autosave

### 13.5 Maintainability Requirements

- Modular codebase (micro-modular monolith architecture)
- Clear separation between:
  - Expense UI
  - Workflow engine
  - Posting / accounting engine
  - OCR engine
  - Duplicate detection engine
  - Audit subsystem
  - Dimension engine

- Code must follow:
  - Clean Architecture
  - Layered separation
  - Version-controlled API

- Configuration stored in:
  - Tenant-level JSON
  - Policy rule engine
  - Dimension mapping tables

### 13.6 Observability Requirements

Monitoring must cover:
- API request logs
- Response times
- OCR queue backlog
- Duplicate detection pipeline performance
- Audit trail write success/failure
- DB query performance
- Worker service health

Logging must include:
- user_id
- tenant_id
- request_id
- endpoint
- IP address
- timestamp
- response code

Alerts:
- High rejection spikes
- Duplicate detection spike
- OCR service slowdown
- API timeout rate > 2%
- Login failures spike

### 13.7 Usability Requirements

The UI must be:
- Intuitive within 10 minutes of onboarding
- Mobile-friendly (fully responsive)
- Low data consumption for mobile users
- Accessible according to WCAG 2.1 AA
- Support auto-save to reduce user friction
- Provide inline explanations for finance-specific fields

### 13.8 Localization Requirements

Localization support includes:
- Multi-language UI (English default)
- Multi-currency support
- Date format localization
- Numeric localization (e.g., comma vs. dot)
- Left-to-right and (future) right-to-left UI support

### 13.9 Disaster Recovery Requirements

- Full system recovery within 30 minutes (RTO)
- Data recovery with max 5 minutes loss (RPO)
- Geo-redundant backup replication
- Backup encryption (AES-256)

### 13.10 System Capacity Requirements

Minimum supported scale:
- 100,000 employees
- 5 million expense lines annually
- 1 million receipts stored annually
- 1 TB document storage per tenant
- 50 concurrent Finance reviewers

### 13.11 API Throughput Requirements

- Minimum 500 requests/second per region
- Burst capacity: 2000 requests/second
- Queueing for long-running tasks (OCR/hash)

### 13.12 Browser & Device Support Requirements

Web Browser Support:
- Chrome (latest 3 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Firefox (latest 3 versions)

Device Support:
- iOS (latest 2 versions)
- Android (latest 5 versions)
- Tablet-optimized grid view

### 13.13 Key Non-Functional Edge Cases

Case: OCR queue overload
→ Switch to fallback lightweight OCR mode or queue throttle with user
notification.

Case: Poor mobile network connectivity
→ Offline draft mode enabled + delayed sync.

Case: Extremely large receipts (20MB+)
→ System auto-compresses and warns user.

Case: High-volume tenant (month-end spike)
→ Autoscaling triggers additional compute nodes.

## 14. Reporting & Analytics Requirements

This section defines all reporting, analytics, dashboards, and export
requirements for the
ZivaBI Expense Management Module. Reporting must support employees,
managers, Finance, auditors,
and executives with accurate, real-time and historical insights.

### 14.1 Reporting Principles

The reporting engine must:
- Support multi-tenant isolation
- Provide real-time data (no more than 60 seconds lag)
- Support dimensional drill-down (GL, Cost Center, IO, SIO, Location,
Category)
- Allow export in PDF, Excel, CSV
- Support scheduled reports
- Provide role-based visibility
- Include audit-compliant data retention

### 14.2 Employee-Level Reports

Employees must have access to:
1. My Expenses Report
- All reimbursements submitted
- Status: draft, submitted, approved, rejected, paid
- Amounts by category
- Filters: date, project, category, amount

2. My Travel Advances Report
- Pending advances
- Open retirements
- Over/under balances
- History of cleared advances

3. My Payments Report
- Scheduled payment date
- Paid reimbursements
- Payment method (bank, payroll, etc.)

### 14.3 Manager / HOD Reports

Managers must have access to:
1. Team Expenses Overview
- Employee-level totals
- Category breakdown
- Trend over time

2. Pending Approvals
- List of requests waiting for action
- SLA ageing
- Amount-based escalation hints

3. Budget vs. Actual (If tenant enables budgeting)
- PL Group totals
- GL-level aggregates
- Dimension-based breakdown

### 14.4 Finance Reports

Finance must have access to deep, multi-dimensional reporting:

1. Expense Summary Report
- GL-level totals
- Dimension drill-down
- Category analysis
- Vendor-derived analysis (via receipt OCR)

2. Outstanding Advances Aging
- Bucketed by 0--30, 31--60, 61--90, 90+ days
- Employee-level tracking
- Escalation list

3. Reimbursement Pending Payment
- Batch-level view
- Date scheduled
- Total payable amounts

4. Duplicate Detection Analysis Report
- High-risk submissions
- Blocked invoices
- Exception queue status

5. VAT/GST Validation Report
- VAT printed vs. VAT OCR detected
- Missing VAT
- Mismatch anomalies
(NOTE: No VAT liability is created for employees)

6. Posting Report
- DR/CR summary
- Posting errors
- Non-posted pending transactions

### 14.5 Auditor Reports

Auditors must have:
1. Full Evidence Bundle (ZIP/PDF)
- Receipts
- OCR text
- Audit logs
- Approval trails
- Posting entries

2. Exception & Query Log Report
- All queries, comments, resolutions
- Timeline list

3. High-Risk Items Report
- Duplicate suspicion events
- Large claims
- Out-of-policy claims

4. Change Tracking Report
- Finance edits (old vs. new values)
- GL corrections
- Dimension corrections
- Workflow reassignments

### 14.6 Executive / CFO Reports

Executives must see:
1. Total Company Expense Dashboard
- Monthly totals
- Trend charts
- Category heat map

2. Expense vs. Budget (if budgeting enabled)
- Overrun indicators
- Department-level actuals

3. Employee Cost Distribution
- High-spend employees
- Travel vs. operational vs. miscellaneous

4. Advance Exposure Report
- Total outstanding advances
- Frequency of overspend/underspend

### 14.7 BI & Analytics Engine Requirements

The reporting subsystem must support:
- Real-time analytics
- Aggregated metrics cache
- Time-series analysis
- Multi-dimensional slicing:
  - GL
  - Cost Center
  - IO
  - Category
  - Location
  - Employee
  - Project

Visualizations supported:
- Line charts
- Bar charts
- Pie charts
- Tables
- Heatmaps
- KPI cards

### 14.8 Exporting Requirements

Supported export formats:
- PDF
- Excel (.xlsx)
- CSV
- JSON (API export)

Exports must:
- Apply role-based filters
- Show only tenant-specific data
- Preserve formatting
- Include timestamp and export metadata

### 14.9 Scheduled Reports

System must support:
- Daily/Weekly/Monthly schedules
- Email delivery
- Multi-recipient groups
- Attachments or secure portal link

### 14.10 Ad-hoc Report Builder (Advanced / Phase 2)

Future requirement:
- Drag-and-drop fields
- Custom groupings
- Save report templates
- Share report templates within tenant

### 14.11 Data Warehouse Integration

If tenant has external BI tools:
- Provide API for bulk export
- Provide nightly ETL feeds
- Provide snapshot dumps
- Support Power BI, Tableau, Looker, Qlik

### 14.12 Report Performance Requirements

- Report generation < 5 seconds for <100k rows
- Complex GL/dimension join reports < 10 seconds
- Scheduled reports generated off-peak

### 14.13 Security Requirements for Reports

- Row-level security enforced
- No cross-tenant leak
- Sensitive fields masked unless Finance/Admin
- Audit logs for each export

### 14.14 Key Reporting Edge Cases

Case: Employee leaves company
→ Reports remain historically accurate, but employee hidden from active
lists.

Case: Deleted drafts
→ Do NOT appear in any reports.

Case: Corrected GL/dimensions
→ Reports show corrected values with audit trail available on
drill-down.

## 15. Integration Requirements

This section defines all integrations required for the ZivaBI Expense
Management Module to operate within
a broader enterprise ecosystem. Integrations ensure data consistency,
automation, auditability, and alignment
with HR, Payroll, ERP, Finance, and external services.

### 15.1 Integration Principles

All integrations must follow these principles:
- Secure handshake with OAuth2/JWT or API key
- Multi-tenant isolation maintained
- Idempotent operations
- Retry & failure protection
- Clear error responses
- Logging & auditability
- Encryption in transit
- Scalable asynchronous processing

### 15.2 HRIS Integration (Employee Master Data Sync)

Purpose:
- Ensure employee profiles, cost centers, roles, managers, termination
dates remain accurate.

Data pulled:
- Employee name
- Email
- Department
- Cost center
- Manager
- Job title
- Employment status
- Effective dates

Sync frequency:
- Real-time webhook or scheduled (daily/hourly)

On employee termination:
- Disable login
- Reassign pending approvals
- Maintain historical accuracy

### 15.3 Payroll Integration

Used for:
- Underspend recovery
- Payroll deduction for outstanding advances
- Reimbursement payments (optional)

Data sent to payroll:
- Employee payable amount
- Deduction instructions
- Advance clearance
- Supporting reference numbers

Formats:
- API push
- CSV export
- Secure file drop

### 15.4 ERP Integration (Financial Posting)

ERP systems supported:
- SAP S/4HANA
- Oracle Fusion
- Microsoft Dynamics
- Sage
- QuickBooks
- Custom ERPs

Integration modes:
- Direct API posting
- Manual export
- Scheduled bulk transfer

Data sent:
- DR/CR entries
- Dimensions
- Approval references
- Posting date
- Employee ID / Vendor ID equivalence

### 15.5 AP Module Integration

If tenant enables AP module:
- Expense postings and vendor postings share:
  - Dimensions
  - GLs
  - Cost centers
  - Exchange rate rules
  - Approval workflows
- Duplicate detection shared for vendor & employee receipts

### 15.6 Notification Service Integration

Notifications delivered via:
- Email
- In-app
- Mobile push

Requires integration with:
- SMTP provider
- Push Notification Service (FCM/APNS)
- Internal Notification Orchestrator

### 15.7 Exchange Rate Integrations

Supported sources:
- CBN API (Nigeria)
- ECB API
- Custom source (tenant upload)

Allow tenants to specify rules:
- Use rate on invoice date
- Use rate on approval date
- Use daily average rate

### 15.8 OCR Engine Integration

OCR provider:
- ZivaBI internal OCR engine OR
- Third‑party OCR provider (Google Vision, AWS Textract, Azure OCR)

Data exchanged:
- Image file
- Extracted fields
- Confidence scores

Fallback:
- Low-confidence fallback to simplified OCR or manual entry mode.

### 15.9 SSO Integration (Identity Providers)

Supported IdPs:
- Azure AD
- Okta
- Google Workspace
- Custom SAML

Features:
- Single Sign-On
- Passwordless access
- Conditional access policies
- SCIM provisioning (Phase 2)

### 15.10 Webhooks & Event Triggers

System publishes events:
- Expense submitted
- Expense approved
- Expense rejected
- Expense queried
- Finance approval completed
- Payment scheduled
- Payment completed
- Advance issued
- Advance retired

Webhook format:
- JSON event body
- Signature header
- Retry logic

### 15.11 External System Connectors (Future)

Phase 2 may include:
- Travel booking system integration
- Corporate card integration
- Vendor validation API
- Tax authority submission API

### 15.12 Integration Error Handling

System must:
- Retry transient errors
- Provide dead-letter queues
- Alert Finance/Admin when integration fails
- Store failed payloads for reprocessing

### 15.13 Integration Logging

Logs must include:
- Integration endpoint
- Payload hash (no sensitive data)
- Response code
- Error messages
- Retry attempts
- Timestamp
- tenant_id

Stored for:
- 2 years minimum

## 16. Configuration & Tenant Customization Requirements

This section defines how each tenant (company) can configure, customize,
enable, disable, and tailor
the Expense Management Module to match their internal policies, approval
rules, chart of accounts,
dimensions, reporting needs, branding, and regulatory environment.

### 16.1 Configuration Principles

ZivaBI must support deep tenant-level configuration without requiring
custom code.

Principles:
- No-hardcoding of GLs, IOs, taxes, policies
- Everything configurable per tenant
- Changes apply immediately unless scheduled
- Audit trail for every configuration change
- Preview mode before activation
- Role-based access for configuration pages

### 16.2 Tenant Setup --- Initial Onboarding

During onboarding, tenant must configure:

1. Basic Company Profile
- Name
- Address
- Country
- Fiscal year settings
- Home currency

2. Branding
- Logo
- Colors
- Custom field labels

3. Modules to enable
- Expense Reimbursement
- Travel Advances
- AP
- Vendor Portal
- AR
- Payroll Integration
- Inventory, POSM, Fixed Asset (future modules)

4. Dimensions to enable
- Real IO
- Statistical IO
- Cost Center
- Material IO
- Location
- Custom dimensions

5. Chart of Accounts
- Upload via Excel/CSV
- Upload mapping file for PL/BS classification
- Upload budget-linked GLs
- Upload group reporting mapping (optional)

6. Approval Workflow
- Multi-level approval structure
- Amount-based routing
- Role/department-based routing
- Escalation rules
- SLAs

7. Currency & FX Settings
- FX source (CBN, ECB, manual upload)
- Rate application rule (invoice date / approval date / posting date)
- FX rounding rules

### 16.3 Policy Configuration

Tenant can configure:

- Per diem rules
- Maximum allowable per category
- Required receipts vs receipt-free limits
- Travel advance ceilings
- Advance settlement timeframe
- Duplicate detection strictness
- OCR confidence thresholds
- Expense category-to-GL mapping
- Dimension auto-fill rules

### 16.4 Tax Configuration (Employee Context)

Employee reimbursement tax rules:
- VAT validation only (no withholding)
- Enable/disable VAT validation
- VAT anomaly severity level
- Tax reporting format

### 16.5 Approval Workflow Configuration

For each request type (reimbursement, advance, advance retirement):

Tenant can define:
- Number of approval levels
- Role required for each level
- Escalation rules
- Delegation rules (when approver is absent)
- Parallel or sequential approvals
- Approver fallback logic
- Override permissions (Finance/Admin only)

### 16.6 UI/Field Customization

Tenant can rename:
- PL Group
- P&L Line
- GL Account
- Cost Center
- Real IO
- Statistical IO
- Material IO
- Location
- Description field label
- Custom fields

Tenant can hide optional fields entirely.

### 16.7 Expense Form Behavior Configuration

Tenant controls:

- Mandatory vs optional fields
- Line-item descriptions word minimum
- Max number of lines per request
- Currency selection allowed
- Allowed attachment formats
- Receipt mandatory toggle
- Receipt auto-match strictness
- Auto-split receipts into multiple lines (On/Off)

### 16.8 OCR & Duplicate Detection Configuration

Tenant configures:

- OCR confidence thresholds
- Duplicate-detection threshold (strict or relaxed)
- Exception queue routing rules
- Finance approval requirement for low-confidence matches
- Auto-block level for exact-match duplicates
- Side-by-side comparison UI toggle

### 16.9 Reporting Configuration

Reporting configuration includes:

- Tenant-specific dashboard KPIs
- Hidden/visible metrics
- Custom report templates
- Scheduled reports & delivery frequency
- Data export formats allowed
- Group-by default (GL, cost center, project, etc.)

### 16.10 Payment Configuration

Tenant defines:

- Payment schedule (weekly/monthly/on-demand)
- Payment method:
  - Bank transfer
  - Payroll
  - ERP
- Cut-off dates
- Batch approval rules
- Required Finance signature count

### 16.11 Document Retention Configuration

Tenant can define:

- Retention period for receipts (default 7 years)
- Retention for draft records
- Data archival rules
- Evidence bundle generation retention period

### 16.12 Notifications & SLA Configuration

Tenant may configure:

- SLA deadlines for each approval stage
- Reminder frequency
- Escalation rules
- Default notification modes (email, push, in-app)
- Quiet hours (time-based notification suppression)

### 16.13 Integration Configuration

Tenant controls connections to:

- HR system
- Payroll system
- ERP
- Exchange rate source
- OCR provider
- Email provider
- Mobile push notification provider

Custom connector settings:
- API keys
- OAuth client ID/secret
- Webhook URLs

### 16.14 Security Configuration

Tenant sets:

- MFA enforcement (On/Off)
- Password policy
- Session timeout
- IP allow/block list
- SSO enforcement
- Device-level restrictions (optional)

### 16.15 Version Management & Rollback

Tenant must be able to:

- Preview configuration changes
- Activate changes immediately or schedule
- Roll back to previous configuration snapshot
- Export configuration for audit

### 16.16 Edge Case Configuration Rules

Case: Tenant changes dimensions mid-year
→ System must apply new dimension rules only to new postings; historical
remains unchanged.

Case: Tenant changes approval workflow
→ All in-flight requests keep old workflow; new ones follow new rules.

Case: Tenant disables a module
→ Historical data remains visible; new actions blocked.

Case: Tenant disables a GL/dimension
→ System enforces N/A and prompts Finance to map to alternative
accounts.

## 17. Deployment, Hosting & Environment Requirements

This section defines the deployment architecture, hosting strategy,
CI/CD pipelines,
environment structure, monitoring, release management, and
infrastructure security
requirements for the ZivaBI Expense Management Module.

The module must support a fully scalable, multi-tenant SaaS deployment.

### 17.1 Deployment Architecture Principles

The system must follow:
- Cloud-native architecture
- Containerized services (Docker)
- Orchestrated via Kubernetes or equivalent
- Separation of compute, storage, and services
- Stateless API layer
- Immutable deployments
- Secrets managed via secure vault

### 17.2 Hosting Environments

The platform must support the following environments:

1. **Local Development**
- For engineers
- Lightweight database & mock services

2. **Development Environment**
- Used for internal testing
- Continuous build deployment

3. **QA/Staging Environment**
- Mirrors production
- Used for regression, performance testing
- No real customer data

4. **Production Environment**
- Multi-region
- High-availability cluster
- Automated scaling

5. **Disaster Recovery Environment**
- Geo-redundant
- Hot standby or warm standby mode

### 17.3 Multi-Tenant Hosting Architecture

Tenants share:
- API layer
- OCR engine
- Notification services
- Reporting engine
- Infrastructure monitoring

Tenants DO NOT share:
- Database rows (strict tenant_id isolation)
- Audit logs
- Storage buckets

Possible data strategies:
- Shared database with row-level security
- Shared cluster with isolated schemas (optional future model)

### 17.4 CI/CD Pipeline Requirements

Pipeline must include:

- Automated build
- Automated tests (unit, integration, regression)
- Security checks
- Linting
- Vulnerability scanning
- Image signing
- Deploy to staging
- Manual or automated deployment to production

Deployment must use:
- Blue/Green deployment
OR
- Canary release strategy

Rollback:
- One-click rollback required
- Rollback stores previous version + config snapshot

### 17.5 Monitoring & Observability Requirements

Monitoring must include:

Metrics:
- API latency
- Error rates
- CPU & memory usage
- OCR queue length
- Duplicate detection processing time
- DB query time
- Tenant-level performance metrics

Logging:
- Centralized log store
- Searchable logs (ELK/Cloud Logging)
- Audit trail segregation per tenant

Alerts:
- API error spike
- Slow query performance
- Disk usage
- High OCR failure rate
- Memory leak detection
- Integration failure

### 17.6 Backup & Disaster Recovery (DR)

Backups:
- Full daily database backup
- Incremental every 15 minutes
- Encrypted using AES-256

DR Requirements:
- RPO < 5 minutes
- RTO < 30 minutes
- Geo-replication to secondary region

### 17.7 Secrets & Credentials Management

All secrets must be stored in:
- AWS Secrets Manager
OR
- Azure Key Vault
OR
- GCP Secret Manager

Secrets include:
- Database credentials
- API keys
- OAuth client secrets
- SSO certificates
- Encryption keys

Rotation:
- Automatic key rotation every 60--90 days

### 17.8 Infrastructure Security Requirements

- Network segmentation
- Private API subnet
- WAF protection
- Rate limiting
- IDS/IPS enabled
- DDoS protection
- Encryption enforced at all layers

### 17.9 Deployment of Mobile App (Optional)

Mobile deployment requirements:
- Publish to iOS App Store
- Publish to Google Play Store
- OTA updates via code-push (if hybrid stack used)
- Mobile-specific crash logging

### 17.10 Versioning Strategy

Version model:
- MAJOR.MINOR.PATCH

Example:
- 1.4.2 → Patch fix
- 1.5.0 → Minor feature release
- 2.0.0 → Major architectural change

Release Notes:
- Every release must include detailed release notes
- Include API changes
- Deprecation notices

### 17.11 Feature Flags

All new features must be released behind feature flags.

Purpose:
- Tenant-specific activation
- Soft rollout testing
- Canary release
- Quick rollback

### 17.12 Tenant Provisioning Automation

New tenant onboarding requires:
- Automatic creation of tenant_id
- Setup of default configuration
- Assignment of default roles
- Allocation of storage bucket
- Initialization of tenant-specific tables
- Automated welcome email

### 17.13 Environment Access Control

Access rules:

- Production → Only DevOps + Super Admin
- Staging → Developers, QA, PM
- Dev → Developers only
- Audit → Read-only for compliance teams
- Local → unrestricted for engineers

### 17.14 Infrastructure Edge Cases

Case: Massive tenant traffic spike
→ Auto-scale pods + scale DB read replicas

Case: OCR service outage
→ Switch to fallback lightweight OCR
→ Queue requests for reprocess

Case: Region outage
→ Failover to backup region via DR

Case: Deployment failure
→ Automatic rollback triggered

## 18. Glossary & Definitions

This section provides clear definitions of all major terms,
abbreviations, concepts, and system-specific
terminology used throughout the ZivaBI Expense Management Module PRD.
This ensures consistent understanding
across engineering, product, design, finance, audit, and tenant
stakeholders.

### 18.1 General System Terms

**Tenant**
A company or organization using the ZivaBI platform. Each tenant has its
own isolated data space, rules, configurations, workflows, and
branding.

**User**
Any authenticated person using the system (employee, manager, finance,
admin, auditor).

**Module**
A functional component of ZivaBI (e.g., Expense, AP, AR, Vendor
Portal).

**Workflow**
A sequence of actions that a request must pass through (submission →
approvals → finance → posting).

**Request**
A parent-level expense reimbursement or advance retirement submission
made by an employee.

**Line Item / Expense Line**
An individual expense entry inside a request.

### 18.2 Financial & Accounting Terms

**GL Account (General Ledger Account)**
A financial account where expenses or liabilities are recorded. Defined
per tenant's Chart of Accounts.

**PL Group (Profit & Loss Group)**
High-level classification of expense categories (PL1, PL2, PL3, PL4).

**P&L Line**
Sub-categorization under PL Group, mapped to tenant's internal
structure.

**Dimension**
Additional classification fields like Cost Center, IO, SIO, MIO,
Location.

**Real IO (Internal Order)**
A real cost collector used to track expenses at a granular level.

**Statistical IO (SIO)**
Used for tracking indirect or analytical purposes; always linked to a
cost center.

**Employee Advance (Travel Advance)**
Amount given to an employee before travel, to be retired later.

**Retirement**
Employee providing receipts and justifying the expenses of an advance.

**Employee Payable**
Liability account for reimbursement amounts owed to the employee.

### 18.3 Tax & Compliance Terms

**VAT (Value Added Tax)**
Tax charged by vendors; employees do not self-account VAT.

**Reverse VAT / Self-Accounted VAT**
Not applicable to employee expenses --- only AP module.

**WHT (Withholding Tax)**
Not applicable to employee reimbursements; applies only to vendor
payments.

**Audit Trail**
Immutable log of all user and system actions for compliance.

**Evidence Bundle**
Complete package of receipts, logs, approvals, OCR results, and postings
for audit.

### 18.4 OCR & Duplicate Detection Terms

**OCR (Optical Character Recognition)**
Technology used to extract text from receipts and invoices.

**OCR Confidence Score**
Numeric value (0--100) representing extraction accuracy.

**Document Hash (SHA256)**
Cryptographic fingerprint of a file; used for duplicate prevention.

**Perceptual Hash (pHash)**
Fingerprint for detecting visually similar images (modified or
re-scanned).

**Duplicate Invoice**
An invoice that appears more than once across requests, detected by
hashing or OCR.

**Exception Queue**
A special workflow where Finance reviews high-risk or uncertain items.

### 18.5 Workflow & Role Terms

**LM (Line Manager)**
The first approver in the approval chain.

**HOD (Head of Department)**
Optional second-level approver.

**GM (General Manager)**
Higher-level approver for large or sensitive expenses.

**Finance Reviewer / Finance Analyst**
Validates expense correctness, dimensions, amounts, taxes, and OCR
results.

**Finance Manager**
Final approver before posting and payment scheduling.

**CFO**
Optional executive approver (amount or category-based).

**Auditor**
Read-only role for regulatory or internal audit teams.

### 18.6 System Architecture Terms

**API (Application Programming Interface)**
Communication interface for internal and external systems.

**JWT (JSON Web Token)**
Token used for user authentication and authorization.

**RBAC (Role-Based Access Control)**
Security model assigning permissions based on user roles.

**CI/CD (Continuous Integration / Continuous Deployment)**
Automated pipeline for building, testing, and deploying the platform.

**SaaS (Software as a Service)**
Cloud-based deployment model for multi-tenant systems.

### 18.7 Deployment & Infrastructure Terms

**Environment**
Separate infrastructure layers (Dev, Stage, Prod, DR).

**Autoscaling**
Automatic increase/decrease of compute resources based on load.

**Failover**
Switching to a backup system during a failure.

**RPO (Recovery Point Objective)**
Maximum acceptable data loss during a failure.

**RTO (Recovery Time Objective)**
Maximum acceptable system downtime during a failure.

### 18.8 Reporting & Analytics Terms

**KPI (Key Performance Indicator)**
Metrics used to evaluate performance.

**Drill-Down**
Navigating from aggregated data into detailed records.

**Ad-Hoc Reporting**
Custom user-built reports without engineering involvement.

**ETL (Extract, Transform, Load)**
Process for loading data into BI systems.

### 18.9 Configuration Terms

**Policy Rule**
Tenant-defined rule determining allowable expenses or behavior.

**Feature Toggle / Feature Flag**
Enables or disables features per tenant without code changes.

**Custom Field**
Tenant-defined data field added to expense lines or requests.

### 18.10 Other Key Terms

**Draft Mode**
State where employee is still editing a request.

**Audit Mode**
Read-only mode for viewing historical data with full logs.

**Multi-Currency**
Ability to handle expenses submitted in currencies different from tenant
base currency.

**Exception Handling**
System workflow for unusual or rule-violating situations.

**SLA (Service Level Agreement)**
Deadline for approvers to complete tasks.

## 19. Appendices (Supporting Materials)

This section contains supporting reference material, templates,
examples, workflow diagrams (described in text),
sample payloads, configuration structures, and other documents needed to
complement the full PRD of the
ZivaBI Expense Management Module.

### 19.1 Example Expense Forms (Based on Employee Templates Provided)

A. Vendor Payment Request Example (CLAUD APPROVED PENDING -
P11-01-25.xlsx)
File provided by client:
Path: /mnt/data/CLAUD APPROVED PENDING - P11-01-25.xlsx

Content includes:
- Vendor name
- Invoice details
- GL selection
- Dimension selection
- Cost center mapping
- Manual documentation process

Relevance:
- Used to validate the dynamic form fields required for ZivaBI
- Used for mapping GL → PL → Dimension logic
- Used to design vendor receivable validation in Expense and AP modules

B. Employee Expense Retirement Example (SAMUEL APPROVED PENDING -
P11-01-25.xlsx)
File provided by client:
Path: /mnt/data/SAMUEL APPROVED PENDING - P11-01-25.xlsx

Content includes:
- Employee name
- Multiple expense lines
- GL and IO selection
- Manual tracking patterns

Relevance:
- Provided baseline for multi-line entry requirements
- Informed dimension/GL cascading logic
- Guided OCR and duplicate detection requirements

C. DP Credit Request (DP CREDIT REQUEST.xlsx)
Path: /mnt/data/DP CREDIT REQUEST.xlsx

Relevance:
- Used to inform AR module (future)
- Helps design flexible form engine

D. FOC Request Template (FOC REQUEST.xlsx)
Path: /mnt/data/FOC REQUEST.xlsx

Relevance:
- Used to design POSM & Inventory workflows (future module)

### 19.2 Sample OCR Output

Example OCR extraction JSON:

{
\"invoice_number\": \"INV-2025-001\",
\"invoice_date\": \"2025-03-15\",
\"vendor_name\": \"EVENT BY CLAUD\",
\"amount\": 250000,
\"currency\": \"NGN\",
\"confidence_score\": 92,
\"extracted_text\": \"Event management services...\"
}

### 19.3 Sample Duplicate Detection Event

{
\"document_hash\": \"a7c3f01b...\",
\"p_hash\": \"98b2d1a0...\",
\"ocr_text_hash\": \"f1e890bb...\",
\"matched_invoice_id\": \"INVREG-1023\",
\"confidence_score\": 96,
\"recommended_action\": \"BLOCK\",
\"reason\": \"Exact match to previously approved invoice\"
}

### 19.4 Example Posting Journal for Employee Reimbursement

DR 742100 - Marketing Expense 120,000
CR 221500 - Employee Payable 120,000

Posting Date: 2025-02-14
Employee: Samuel A.
Dimensions:
- Cost Center: CC120
- Real IO: RIO2002
- Location: Lagos

### 19.5 Example Posting Journal for Advance Retirement

Advance issued: 200,000
Expenses submitted: 250,000
Overspend: 50,000

DR Expense Lines: 250,000
CR Employee Advance: 200,000
CR Employee Payable: 50,000

### 19.6 Sample Evidence Bundle Contents

ZIP archive structure:

/EvidenceBundle_ER_2025_00112/
/Receipts/
receipt_1.jpg
receipt_2.pdf
/OCR/
receipt_1_ocr.json
receipt_2_ocr.json
/AuditLogs/
audittrail.json
/Approvals/
approval-history.json
/Posting/
journal.json
summary.pdf

### 19.7 Sample Approval Workflow Diagram (Text Description)

Employee → Line Manager → HOD → GM → Finance Analyst → Finance Manager →
CFO (optional) → Posting → Payment

Approvers can:
- Approve
- Reject
- Query line or entire request

### 19.8 Sample Tenant Configuration JSON

{
\"tenant_id\": \"TEN-001\",
\"modules\": [\"EXPENSE\", \"ADVANCE\"],
\"dimensions_enabled\": {
\"real_io\": true,
\"stat_io\": true,
\"material_io\": false,
\"location\": true
},
\"fx_settings\": {
\"source\": \"CBN\",
\"application_rule\": \"APPROVAL_DATE\"
},
\"duplicate_detection\": {
\"threshold_strict\": 95,
\"threshold_warn\": 70
}
}

### 19.9 System Limitations & Assumptions

- Attachments above tenant limit must be compressed
- Mobile offline mode limited to draft saving only
- Duplicate detection does not query across tenants
- Posting rules do not override tenant ERP rules
- OCR accuracy depends on receipt clarity

### 19.10 Future Enhancements Listing

- Corporate card integration
- AI-based auto-categorization
- Predictive duplicate detection
- Multi-tenant analytics layer
- POSM inventory handling
- Fixed asset tracking
- Credit note automation in AR
- Vendor compliance scoring
