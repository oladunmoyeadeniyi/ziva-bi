# Accounts Payable (AP) Module — Product Requirements Document (PRD)

**Product:** Ziva BI — Accounting Automation Platform
**Module:** Accounts Payable (AP)
**Document status:** Consolidated PRD (merged from two source drafts)
**Consolidated on:** July 25, 2026

> This document consolidates two source drafts into a single PRD:
>
> **Draft A** — *"ACCOUNTS PAYABLE (AP) MODULE — PRODUCT REQUIREMENTS DOCUMENT (PRD).docx"* (the more detailed draft, used as the primary structure for most sections).
> **Draft B** — *"ZivaBI_AP_PRD_v2.docx"* (a second draft with additional engineering-facing sections — API, UI/UX by role, deployment, migration, notifications, and database schema — plus extra rules and workflows not covered in Draft A).
>
> Where both drafts covered the same topic, Draft A's version is used as the primary content, with any genuinely new material from Draft B appended underneath as **"Additional details (Draft B)"**. Sections that exist in only one draft are included in full. No content from either source was discarded.

---

## Table of Contents

1. Executive Summary
2. Background & Problem Statement
3. Scope & Out-of-Scope
4. Personas, Stakeholders & System Actors
5. User Stories
6. Data Model
7. Workflow Requirements
8. Business Rules
9. API Requirements
10. UI/UX Requirements
11. Security & Permissions Requirements
12. Reporting & Analytics
13. Non-Functional Requirements (NFRs)
14. Integration Requirements
15. Vendor Category-Specific AP Logic
16. Invoice Lifecycle Management
17. Audit & Compliance Requirements
18. Deployment & Environment Requirements
19. Configuration & Customization Requirements
20. Notifications & Communication Requirements
21. Migration Requirements
22. Appendix & Consolidated Tables

---

---

## 1. Executive Summary

The Accounts Payable (AP) Module within ZivaBI is a unified automation
engine designed to eliminate manual payable processes, ensure financial
integrity, enforce compliance, and enable seamless integration with
vendor onboarding, procurement, expense management, ERP systems, and
banking platforms.

This module is engineered to replace traditional spreadsheet-driven AP
workflows --- including manual invoice review, PO/GRN matching, tax
computation, document collation, approval routing, payment preparation,
and accounting posting --- with a fully automated, configurable,
enterprise-grade system.

The AP module incorporates:

-   Multi-layer workflow automation

-   Vendor-specific tax rules (from Vendor Onboarding)

-   Intelligent invoice capture & OCR

-   Automated duplicate detection

-   PO/GRN matching engine

-   Withholding tax (WHT) automation

-   VAT handling (input VAT, self-accounted VAT, reverse VAT)

-   Accrual engine (automated + manual)

-   Advance settlement & adjustment engine

-   Multi-currency support

-   ERP posting compatibility (SAP, Oracle, Sage X3, Dynamics, etc.)

-   Bank payment scheduling and batch generation

-   Audit-grade financial logging

-   Approval hierarchy configurable per tenant

-   Vendor category--specific invoice logic (Event Agencies, Clearing
    Agents, 3PL, Retainer Vendors, Non-Resident Vendors, etc.)

The AP module will provide:

#### ✔ Speed --- near-instant processing of invoices

#### ✔ Accuracy --- automated GL, dimension, and tax validation

#### ✔ Transparency --- real-time workflow visibility

#### ✔ Control --- strong audit and compliance frameworks

#### ✔ Intelligence --- AI-based classification and duplicate prevention

#### ✔ Scalability --- suitable for SMB, mid-market, and enterprise

This module forms the financial backbone of ZivaBI, enabling
organizations to:

-   Improve working capital efficiency

-   Reduce operational AP cost

-   Strengthen financial controls

-   Prevent vendor fraud

-   Maintain complete audit trails

-   Ensure tax compliance automatically

-   Achieve full automation from invoice-to-pay

The AP module integrates seamlessly with:

-   Vendor Onboarding Module (vendor eligibility, tax rules, banking
    rules)

-   Procurement Module (PO creation & approvals)

-   Inventory Module (GRN, landed cost, PPV)

-   Expense Module (advance settlement)

-   3PL/Logistics Module (delivery confirmations)

-   Finance Module (GL posting)

-   ERP Integration Engine (posting of entries)

-   Bank Payment Integration Engine

The hybrid design ensures that the PRD retains the structure of the
Vendor Onboarding PRD where appropriate, while incorporating advanced
financial rules, workflows, tax logic, compliance checks, and accounting
treatments.


---

## 2. Background & Problem Statement

### 2.0 ENHANCED PROBLEM STATEMENT

Accounts Payable (AP) is one of the most operationally intensive,
error-prone, and risk-sensitive financial processes in any organization.
When managed manually---using PDF invoices, email approvals,
spreadsheets, and fragmented tools---it creates significant
inefficiencies, financial exposure, and compliance gaps.

This section articulates the complete set of business problems,
operational bottlenecks, compliance risks, and inefficiencies that the
ZivaBI AP Module is designed to resolve.

#### 2.1 Core Problem Summary

Most organizations struggle with AP because processes are:

-   Manual (email approvals, spreadsheet GL coding, PDF processing)

-   Slow (approvals take days or weeks)

-   Error-prone (missed taxes, wrong GL, wrong amounts)

-   Non-compliant (weak audit trails, poor document retention)

-   Non-standardized (inconsistent vendor treatment across departments)

-   Dependent on tribal knowledge (GL coding dependent on a few people)

-   Disconnected from other processes (procurement, vendor onboarding,
    inventory)

The result is:

-   Delayed payments

-   Incorrect payments

-   Duplicate payments

-   Tax errors

-   Fraud exposure

-   Audit failures

-   Poor vendor relationships

-   Cashflow unpredictability

#### 2.2 Real-World Scenarios Highlighting the Problem

This expanded section incorporates actual problems you described from
your real experience as Chief Accountant, ensuring the AP PRD is
grounded in reality.

**Scenario 1 --- Manual Request Templates (Excel + Email)**

Employees currently:

-   Download Excel templates

-   Fill the fields manually

-   Convert to PDF

-   Send via email for approval

-   Attach quotation, invoice, PO, etc. manually

-   Email to Finance after GM approval

Problems created:

-   Wrong GL selection

-   Wrong dimensions (IO, cost center, material IO)

-   Missing supporting documents

-   No tracking of approval stages

-   No automated validation

-   Emails are lost or overlooked

-   Rework cycles are slow and invisible

-   Zero traceability

**Scenario 2 --- Extremely Complex Mapping Logic (Your Current Company)**

Employees must manually select:

-   PL Group (PL1--PL4 / BS)

-   P&L line (mapped to PL group)

-   GL account (mapped to P&L line)

-   Real/Statistical IO

-   Cost Center IO

-   Material IO

-   Location

Manually linking all these often results in:

-   Wrong dimension assignment

-   Inconsistent GL choices

-   Unbudgeted IO selection

-   Incorrect cost center allocation

-   Finance spending hours correcting errors

**Scenario 3 --- AP Staff Overloaded With Review & Rework**

Every request must be reviewed manually:

-   Check correctness of GL

-   Check correctness of IO

-   Check for budget availability

-   Check invoice number & date

-   Check VAT on invoice

-   Self-account for VAT if missing

-   Check WHT application

-   Correct WHT base

-   Compute net payable

-   Handle vendor advances

-   Adjust previous WHT deducted

-   Compute additional WHT

-   Draft journals manually

-   Prepare payment schedule manually

This creates significant workload bottlenecks.

**Scenario 4 --- Multiple Vendor Types With Different Tax Rules**

For example:

-   Event Agencies → WHT applies only to agency fee

-   Clearing Agents → Need mapping to specific import invoice

-   3PL Providers → Need mapping to SLA and deliveries

-   Professional Service Vendors → WHT applies only to service component

-   Rent / Lease Vendors → Different VAT/WHT rules

-   Insurance Providers → WHT does not apply

-   Non-Resident Vendors → Special withholding rules

Manual handling makes compliance high-risk.

**Scenario 5 --- PO/GRN/Invoice Matching is Manual or Non-Existent**

There is no system verification that:

-   Goods/services were actually delivered

-   PO was approved before purchase

-   GRN was prepared

-   Service delivery confirmation was obtained

Finance is forced to rely on trust, not evidence.

**Scenario 6 --- Advance Settlement Is Extremely Complex**

In your current workflow:

-   Vendor receives advance

-   Vendor provides final invoice

-   Finance must recompute entire tax profile

-   Compute new WHT

-   Deduct old WHT

-   Reconcile remaining balance

-   Adjust payable based on advance

-   Adjust VAT where applicable

-   Adjust price difference accounts

This is very manual, high-risk, and prone to mistakes.

**Scenario 7 --- Document Storage Is Manual and Disorganized**

Finance staff must:

-   Create monthly folders

-   Create vendor subfolders

-   Name invoices by convention (e.g., P11-01-25, P10-01-25, etc.)

-   Save Excel versions separately

-   Save PDF versions separately

-   Save approval emails separately

This is:

-   Time-consuming

-   Prone to human error

-   Not audit-ready

-   Hard to trace after months/years

**Scenario 8 --- Bank Platform Export & Payment Scheduling**

Currently:

-   Local currency \< NGN100M can be batch-uploaded

-   FX transactions & \> NGN100M must be done manually

-   No automated link between AP approved payments & bank batch files

-   Manual errors lead to incorrect payments

**Scenario 9 --- No Automated Duplicate Invoice Detection**

Because everything is manual:

-   Duplicate vendor invoicing

-   Duplicate invoice numbers

-   Duplicate payments after adjustments

-   Invoice versions not tracked

Finance struggles to track duplicates using spreadsheets.

**Scenario 10 --- No Automated Accrual Engine**

Month-end accruals require:

-   Scanning folders manually

-   Reviewing all outstanding approvals

-   Reviewing all outstanding vendor balances

-   Reviewing cleared vs uncleared GRNs

-   Reviewing pending deliverables

This delays month-end closure significantly.

**Scenario 11 --- Lack of Audit Trail & Data Integrity**

Auditors often request:

-   Proof of approval trail

-   Vendor verification data

-   GRN proofs

-   Document history

-   Version tracking

Manually assembling this is extremely painful.

#### 2.3 Summary of Pain Points Addressed by ZivaBI AP Module

ZivaBI AP will fully automate:

✔ Invoice intake (upload or vendor portal)

✔ OCR extract (invoice number, date, currency, amount)

✔ GL & IO auto-suggestion based on historical patterns

✔ PO/GRN matching (2-way & 3-way match)

✔ Advance settlement engine

✔ WHT & VAT handling

✔ Net payable calculation

✔ Approval workflow

✔ ERP posting

✔ Payment scheduling

✔ Vendor eligibility based on Onboarding module

✔ Duplicate invoice prevention

✔ Accrual automation

✔ Document storage + retrieval

✔ Audit trail creation

✔ Month-end reporting

The system transforms AP from a manual compliance risk to an automated,
intelligent, controllable, transparent financial engine.

### Additional details (Draft B)

### 1 BACKGROUND & PROBLEM STATEMENT

#### 1.1 Introduction
The Accounts Payable (AP) function is a mission‑critical financial
operation that ensures vendors,
service providers, clearing agents, event agencies, landlords,
consultants, and other corporate suppliers
are paid accurately, on time, and in accordance with internal financial
policies, tax laws, contractual terms,
and audit standards.

In most organizations today---regardless of size---AP processes remain
heavily manual, fragmented across departments,
driven by emails, spreadsheets, PDF invoices, unstructured approval
workflows, and inconsistent financial controls.
This leads to inefficiency, risk, errors, fraud exposure, and poor
vendor relationships.

The ZivaBI AP Module is designed to fully automate AP operations using
smart workflows, multi‑tenant configurability,
AI‑assisted invoice classification, vendor category rule‑engines, tax
governance, and complete audit traceability.

This PRD defines all functional, technical, workflow, UX, data,
compliance, and integration requirements
for building the world‑class ZivaBI AP engine.

#### 1.2 The AP Pain Points (Industry‑Wide)

A. Manual Invoice Capture
- Emails with attached invoices scattered across departments.
- Manual retyping of invoice data into Excel or ERP.
- High error rates, inconsistent formats, missing details.
- No automated OCR ingestion or structured data extraction.

B. Lack of End‑to‑End Traceability
- No "single source of truth" for:
  - Submitted invoices
  - Approval progress
  - PO checks
  - GRN (goods receipt confirmation)
  - Vendor verification
  - Tax calculation evidence
  - Payment status
- AP teams depend on chasing requestors and managers for documents.

C. Slow & Inconsistent Approvals
- Approvals happen via email forwarding.
- Hard to enforce approval matrix:
LM → HOD → GM → Finance Review → Finance Approval
- No automated escalation or reminder logic.
- No visibility for vendor or internal stakeholders.

D. Weak Vendor Management
- Vendor onboarding via PDF forms and emails.
- No automated validation of:
  - Bank account
  - Tax identification
  - Registration documents
- No fraud‑proof vendor update workflow.
- No link between vendor category and accounting/tax rules.

E. Different Vendor Categories With Unique Rules
Examples with special treatment:
- Event Agencies --- reimbursable vs agency fee separation.
- Clearing Agents --- import duties, VAT, WHT, landing cost allocation.
- 3PL Warehousing & Logistics --- service fees, handling fees, POD
rules.
- Professional Services --- professional fees vs reimbursables.
- Rent & Lease --- period‑based allocation, WHT logic.
- One‑off Vendors --- onboarding overhead without automation.

Each category requires different:
- GL accounts
- Dimension mappings
- Tax rules
- Documentation
- Approval flows

Manual handling causes repeated errors.

F. PO, GRN & Invoice Mismatch
- Many companies raise POs in Excel, not in a system.
- GRN confirmation done verbally or via WhatsApp/email.
- Invoice received after service delivery with no structured
verification.
- Finance cannot confirm:
  - Was the service delivered?
  - Was it delivered in full?
  - Was it delivered to the correct department/location?

G. Tax Compliance Failures (WHT, VAT, Reverse VAT, WVAT)
- Wrong WHT base applied.
- Wrong VAT treatment (deductible vs non‑deductible).
- Missing reverse VAT (self‑accounting where applicable by law).
- Over‑deduction causing vendor disputes.
- Under‑deduction exposing organization to tax risk and penalties.

H. FX & Multi‑Currency Invoices
- Applying wrong FX rates.
- No unified FX rule:
  - Final approval date?
  - Invoice date?
  - Monthly corporate FX rate?
- No link to central FX source (e.g., CBN).

I. Budget Control Failures
- Requestor does not know remaining budget.
- PO raised without budget checks.
- Payment processed without budget verification.
- No real‑time visibility for Finance.

J. Duplicate Invoice / Fraud Risk
- Vendors resending invoices with slight modifications.
- No system preventing booking of the same invoice twice.
- Finance often catches duplicates too late.

K. Finance Workload & Processing Inefficiency
- Finance manually reviews:
  - GL classification
  - Dimension selection
  - Tax computation
  - PO matching
  - GRN confirmation
- Any wrong classification leads to rework and delays.

L. Extensive Audit Burden
- Auditors request hundreds of documents.
- Locating approved invoice packets is difficult.
- No unified "audit export" capability.

#### 1.3 Additional Pains Confirmed From Your Organization's Workflow

A. Need for Line‑Splitting
- Many vendor invoices or employee requests combine multiple activities
into one line.
- Finance must often split:
  - Across GL accounts
  - Across dimensions (IOs, cost centers, locations)
  - Across projects or events
- Currently split is manual, error‑prone, invisible to workflow
history.

B. Beneficiary/Team Member Declaration
- Many expenses cover multiple employees or internal beneficiaries.
- Requestor must provide:
  - Names
  - Department
  - Allocation percentage or amount
- Finance may request this at review stage.
- No dedicated system form currently exists.

C. Support Documentation Mapping
- Documents span multiple lines.
- Some lines have multiple supporting documents.
- No structured validation system exists.

#### 1.4 The Opportunity
Organizations require:
- End‑to‑end automated invoice lifecycle
- AI‑assisted GL/dimension classification
- Vendor category rule‑based automation
- Smart tax calculation engine
- PO/GRN verification
- Strong approval governance
- Zero‑email workflow
- Full audit trail
- Vendor portal interaction
- Real‑time budget tracking
- Multi‑currency intelligence

The ZivaBI AP Module will deliver these capabilities with multi‑tenant
configurability and enterprise‑grade controls.

#### 1.5 Objectives of the ZivaBI AP Module
- Eliminate manual AP processing.
- Automate PO/GRN matching.
- Automate tax calculations according to tenant rules.
- Enable AI‑assisted invoice coding.
- Provide configurable approval workflows.
- Provide vendor portals for invoice upload & tracking.
- Provide real‑time budget validation.
- Provide strong fraud & duplicate invoice detection.
- Fully automate documentation audit trail generation.


---

## 3. Scope & Out-of-Scope

##### 3A SCOPE OF THE ACCOUNTS PAYABLE (AP) MODULE (EXPANDED)

#### Including Full Tenant Scenarios & Policy Variations

The AP Module covers the end-to-end lifecycle of vendor invoices, from
receipt to posting to payment, integrating accounting, procurement,
vendor management, tax compliance, approval-driven workflows, and ERP
synchronization.

This expanded section provides a precise definition of what the ZivaBI
AP Module WILL and WILL NOT do, with detailed consideration for
different tenant configurations, industry needs, and varying internal
policies.

#### 3A.1 In-Scope Functional Capabilities

The AP Module includes the following capabilities:

##### 1 Invoice Intake & Capture

ZivaBI supports three major invoice intake channels:

#### A. Employee-uploaded invoices

-   For vendors without portal access

-   From requestor during payment request

#### B. Vendor Portal invoice submission

-   Vendor uploads invoice directly

-   OCR extracts details

-   Finance pre-review page triggered

#### C. Email-to-Invoice Ingestion (future enhancement)

-   Auto-read mailbox

-   Auto-OCR

-   Auto-classification

All invoices undergo:

✔ Document validation

✔ Duplicate detection

✔ OCR data extraction

✔ Cross-check against vendor master

##### 2 GL + Dimension + Cost Mapping Engine

AP auto-selects:

-   Correct GL account

-   Correct PL grouping

-   Correct Real/Stat IO

-   Correct Cost Center IO

-   Correct Material IO

-   Correct Location

Based on:

✔ Vendor category

✔ Historical posting patterns

✔ Budget mapping

✔ Tenant rules

✔ AI-based suggestion engine

##### 3 PO/GRN Matching Engine (2-Way & 3-Way Matching)

The system supports:

-   2-way match (PO vs Invoice)

-   3-way match (PO vs GRN vs Invoice)

-   Tolerance rules (tenant configurable)

-   Price variance checks

-   Quantity variance checks

-   Auto-hold for mismatches

Special case matching:

-   Event Agency PO (budget-item-level)

-   Clearing Agent PO (linked to import invoice)

-   3PL PO (linked to SLA/route or delivery)

##### 4 Tax Automation Engine

#### ZivaBI automatically applies:

-   VAT (input VAT)

-   VAT Self-Accounted (WVAT)

-   Reverse VAT (where applicable by jurisdiction)

-   WHT (withholding tax)

-   Withholding adjustments after advances

-   Non-resident WHT

-   Statutory exemptions (insurance, rent, etc.)

#### Based on:

-   Vendor type

-   Category-specific rules

-   Jurisdiction

-   Document analysis

-   Tenant-configured tax tables

-   OCR-detected invoice conditions

All tax postings flow into ERP-ready journal entries.

##### 5 Invoice Review & Approval Workflow

Supports:

-   Requestor review (initial)

-   Line Manager (LM)

-   Head of Unit (HOD)

-   General Manager (GM)

-   Procurement review

-   Finance Pre-Check

-   Finance Final Approval

-   CFO/FD approval (optional)

-   Multi-level or parallel flows

-   Vendor-specific approval variants

Tenant defines the approval matrix using:

✔ Org structure

✔ Thresholds

✔ Vendor type

✔ Budget owner rules

✔ Currency-based rules

✔ Risk level rules

##### 6 Vendor Advance Settlement Engine

Handles:

-   Vendor advance payments

-   Reconciliation of final invoice

-   Automatic adjustment for:

    -   WHT differences

    -   VAT differences

    -   Additional charges

    -   Exchange rate differences

-   Multi-line mapping between budget items and actual invoices

This is especially critical for:

-   Event Agencies

-   Clearing Agents

-   contractors

-   Importation vendors

-   Vendors receiving milestone-based advances

##### 7 Multi-Currency & FX Handling

AP supports:

-   Invoice currency

-   PO currency

-   Payment currency

-   Tenant FX rate rules

-   Date-of-effective-rate rules:

    -   Invoice date

    -   Approval date

    -   Posting date

    -   Payment date

Auto-handles:

-   Unrealized FX

-   Realized FX

-   FX conversion losses/gains

-   FX rounding tolerance

##### 8 Payment Scheduling & Bank Upload Integration

Bank integration supports:

-   Batch uploads

-   Multi-currency payments

-   Multiple account selection

-   Payment approval workflows

For tenants like your current organization:

-   NGN batch upload (\< ₦100M)

-   Manual FX entry (\> ₦100M or foreign currency)

The module automates:

✔ Net payable calculation

✔ Bank batch file generation

✔ Payment schedule generation

✔ Payment hold/unhold

✔ Finance Director approval

##### 9 ERP Posting Integration

Supports posting to:

-   SAP

-   Sage X3

-   Microsoft Dynamics

-   Oracle Financials

-   Netsuite

-   QuickBooks

Posting includes:

-   GL postings

-   WHT postings

-   Input VAT postings

-   Accrual postings

-   Settlement postings

-   Vendor ledger entries

##### 10 Document Management & Audit Trail

AP integrates deeply with:

-   Vendor documents

-   Invoice documents

-   PO documents

-   GRN documents

-   Contracts (if required)

All actions generate:

-   Immutable audit logs

-   Document version history

-   Workflow history

-   Financial justification history

##### 11 Reporting & Analytics

AP provides advanced analytics including:

-   Aging reports

-   AP ledger

-   WHT/VAT reports

-   Outstanding advances

-   Budget vs actual

-   Vendor payment analysis

-   Duplicate invoice detection logs

-   Month-end close dashboard

-   Accrual dashboard

#### 3A.2 Tenant-Specific Policy Variations Supported

Each tenant can independently configure:

#### Vendor eligibility

-   Only full vendors

-   Allow one-time vendors

-   Expense-only vendors

-   Auto-expiring vendors

#### Invoice thresholds

-   Auto-flag invoice \> set amount

-   CFO approval for big payments

-   Extra KYC for high-value vendors

#### Tax rules

-   Country-based tax treatments

-   Reverse VAT applicability

-   WHT thresholds

-   Exempt vendors

#### Approval flows

-   One-step or multi-step

-   Parallel or sequential

-   Department-based approvals

#### FX rules

-   Source of FX rate:

    -   CBN

    -   ECB

    -   Tenant-custom

-   Date of applicable rate

-   Rounding rules

#### Document rules

-   Require PO?

-   Require GRN?

-   Require contract?

#### Advance policies

-   Max advance %

-   Advance limit rules

-   Advance approval workflow

#### 3A.3 Industry & Scenario Variations Supported

The AP system is engineered to support multiple industries:

#### A. FMCG / Distribution

-   PO/GRN-heavy

-   Clearing agent processes

-   Inventory valuation impacts

#### B. Manufacturing

-   Raw material GRNs

-   Landed cost allocation

-   Multi-stage GRNs

#### C. Events & Marketing Agencies

-   Budget-driven settlements

-   Agency fee mapping

-   Reimbursable management

#### D. Logistics & 3PL

-   SLA-based invoice validation

-   Weight/volume-based costing

-   Delivery POD matching

#### E. Professional Services

-   Contract-based billing

-   Hourly rate validation

-   Retainers

#### F. Hospitality / Travel

-   Expense-heavy

-   One-time vendors

-   Multi-currency flows

#### 3A.4 Out-of-Scope (Explicit Boundaries)

The AP module does not include:

#### ❌ Payroll processing

(Handled separately by Payroll Module)

#### ❌ Inventory stock valuation

(Handled under Inventory Module)

#### ❌ Customer invoicing

(Handled under AR Module)

#### ❌ Cash advances to employees

(Handled under Expense/Travel Advance Module)

#### ❌ Treasury management / FX trading

(Bank integration supports usage, not FX acquisition)

#### ❌ Long-term contract management

(Core contract functions covered by Vendor & Legal modules only)

#### ❌ Card transactions or corporate cards

(Future enhancement)

#### ❌ Full bank reconciliation

(Handled by Bank Rec Module)

### Additional details (Draft B)

### 2 Scope & Out-of-Scope

#### 2.1 IN SCOPE

The ZivaBI Accounts Payable (AP) Module will deliver the following
capabilities:

A. Invoice Intake & Digitization
- Upload invoices (PDF, image, email-to-invoice)
- OCR extraction of invoice details
- Auto-mapping vendor from invoice metadata
- ICE-assisted classification (GL, dimensions, category)

B. Vendor Category Engine
- Event agencies (reimbursables vs agency fees)
- Clearing agents (import duties, VAT, WHT logic, landing cost
allocation)
- 3PL warehousing/logistics invoices
- Professional service providers
- Rent/lease vendors
- One-off vendors
- Non-resident vendors
- POSM suppliers
- Inventory-related invoice logic

C. PO & GRN Matching
- Automated PO match verification
- GRN (Goods Received/Service Rendered) confirmation workflow
- Exception handling for mismatches
- Configurable PO rules per tenant

D. Tax Determination Engine
- Withholding tax (WHT)
- VAT / reverse VAT / self-account VAT
- WHT base determination rules
- Multi-country tax profiles (tenant configurable)
- Tax audit trails

E. Multi-Currency & FX Rules
- FX rate rules configurable by tenant:
  - Approval date rate
  - Invoice date rate
  - Monthly corporate rate
- FX gain/loss posting logic
- Handling of importation clearing FX flows

F. Budget Management & Project/Event Mapping
- Real-time budget checks
- Budget line mapping
- Historical budget consumption tracking

G. Approval Workflow Engine Integration
- Multi-level approvals:
  - Line Manager
  - HOD
  - GM
  - Finance Reviewer
  - Finance Approver
- Escalations & reminders
- Delegation rules
- Mobile approval support

H. Finance Review & Posting Logic
- GL review
- Dimension validation
- Tax revalidation
- PO/GRN verification
- Posting preparation for ERP integration
- Export-ready ERP posting packets
- Support for accrual posting

I. Line Splitting (NEW REQUIREMENT)
Fully included in scope:
- Finance can split any invoice/request line
- Requestor can split lines upon request
- Split across:
  - GL accounts
  - Dimensions (IOs, Cost Center, Location, Material IO)
  - Projects/events
  - Tax treatment
- Auto-calculation or manual split
- Full audit trail for each split

J. Beneficiary / Team Member Declaration (NEW REQUIREMENT)
Fully included in scope:
- Requestor can declare beneficiaries on any line
- Dedicated entry form
- Allocation rules (% or value)
- Upload beneficiary evidence
- Finance can request beneficiary details at review stage
- Workflow pause until completed
- Visible in audit trail

K. Duplicate Invoice Detection
- Auto-flagging of:
  - Duplicate invoice numbers
  - Duplicate amounts with same vendor
  - Duplicate PO/invoice combos
- AI pattern detection of subtle duplicates

L. Vendor Portal Integration
- Vendor uploads invoices
- Vendor checks payment status
- Vendor updates profile (controlled workflow)
- Vendor receives notifications

M. Document Management
- Auto-bundling of:
  - Invoice
  - PO
  - GRN
  - Support docs
  - Approval trail
- One-click audit export

N. AI/ICE Integration
- ICE predicts GL, dimensions, category
- ICE learns from corrections
- ICE supports vendor category patterns
- AI suggestions require human validation

O. Reporting & Analytics
- AP aging
- Vendor spend analysis
- Tax analysis
- Approval turnaround analytics
- Duplicate/fraud risk analytics

O. Multi-Tenant Configuration
- Tenant-level tax rules
- Tenant-level dimension rules
- Tenant-level category rules
- Tenant-level approval matrix
- Tenant-level vendor category preferences
- Tenant-level FX rules

#### 2.2 OUT OF SCOPE (FOR V1)

A. Automatic payment execution (future payment hub)
B. Bank integration (SWIFT/API) for direct disbursements
C. Contract lifecycle management (separate module)
D. Automated PO creation (Procurement module)
E. Inventory valuation adjustments (Inventory module)
F. Federated AP intelligence (future ICE extension)
G. Autonomous invoice approval without human validation
H. Collections/AR deduction automation (separate AR module)

These items may be included in future modules or future versions.


---

## 4. Personas, Stakeholders & System Actors

### 4.0 USER PERSONAS --- ACCOUNTS PAYABLE (AP) MODULE

This section defines all key user personas who interact with the
Accounts Payable module. Each persona includes:

-   Role overview

-   Responsibilities

-   Goals

-   Pain points

-   System needs

-   Behaviors & use cases

-   Influence on workflow design

These personas ensure the system is built around real-world needs and
behaviors of every stakeholder involved in the invoice-to-pay process.

#### 4.1 Requestor Persona

Role: Any staff member initiating AP payment requests (e.g., budget
owner, requester of vendor service)

Department: Any

System Access: Basic user

#### Responsibilities

-   Raise vendor payment requests

-   Upload invoice + supporting documents

-   Select GL, PL, dimensions (if required)

-   Complete PO/GRN references (if required)

-   Respond to finance or approver clarifications

#### Goals

-   Submit clean requests quickly

-   Minimal rework

-   Visibility into approval progress

-   Guidance on correct GL/dimension selections

#### Pain Points (Real World)

-   Complex financial fields

-   Wrong GL or IO selection

-   Missing documents

-   Frequent rejections

-   No visibility into status of request

#### System Needs

-   AI suggestions for GL & dimensions

-   OCR extraction to reduce typing

-   Clear progress tracking

-   Smart validation before submission

-   Ability to upload or scan documents

-   Resubmit corrected lines if rejected

#### 4.2 Line Manager (LM) Persona

Role: First-level approver

Department: Departmental Supervisors

#### Responsibilities

-   Validate business justification

-   Validate budget alignment

-   Approve or reject requests

#### Goals

-   Fast approval decisions

-   Clear understanding of what is being paid

-   Ability to reject only problematic lines

#### Pain Points

-   Too many approvals

-   Missing context

-   Poorly organized requests

#### System Needs

-   Clean summarized view

-   Ability to drill into details when necessary

-   Reject individual lines, not entire request

-   Mobile-friendly approval

#### 4.3 Head of Department (HOD) Persona

Role: Department head with budget authority

#### Responsibilities

-   Approve high-value items

-   Provide strategic oversight on spend

#### Goals

-   Ensure compliance with departmental budgets

-   Prevent out-of-scope or unauthorized payments

#### Pain Points

-   No visibility into historical spends

-   Manual scanning of invoices

#### System Needs

-   Monthly spend analytics

-   Budget vs actual indicator

-   Red flags for abnormal patterns

#### 4.4 General Manager / Director Persona

Role: Final approver before Finance

Responsibilities:

-   Validate large-value items

-   Approve strategic or sensitive vendor payments

#### Goals

-   Zero financial leakages

-   Clear traceability

#### Pain Points

-   Poor visibility into underlying workflows

-   Too much manual review

#### System Needs

-   Executive-level summary

-   Risk flags

-   Vendor category & risk profile

#### 4.5 Procurement Officer Persona

Role: Ensures vendor compliance with purchasing policy

Department: Operations / Procurement

#### Responsibilities

-   Confirm PO alignment

-   Validate vendor category

-   Validate service/goods delivery

-   Confirm GRN or service delivery documentation

#### Goals

-   Enforce procurement policy

-   Stop unauthorized vendor spending

#### Pain Points

-   Missing PO numbers

-   Inconsistent invoice formats

-   Vendor category misalignment

#### System Needs

-   Automated PO/GRN match

-   Vendor category auto-detection

-   Ability to send clarification requests

#### 4.6 Finance Pre-Check Officer Persona

Role: Performs initial financial validation

Department: Finance (AP sub-team)

#### Responsibilities

-   Validate invoice amount

-   Validate VAT/WHT application

-   Validate GL/dimensions

-   Validate currency and FX rate

-   Detect duplicates

-   Route corrections

#### Goals

-   Reduce rework for Finance Final Approval

-   Prevent errors early in pipeline

#### Pain Points

-   Too much manual checking

-   Wrong GL/dimension selection by requestors

-   Duplicate invoices are hard to detect

#### System Needs

-   Automated tax engine

-   Automated GL/dimension suggestion

-   Duplicate detection

-   Advance settlement automation

#### 4.7 Finance Final Approver Persona

Role: Final authority in Finance before payment scheduling

Department: Finance

#### Responsibilities

-   Approve overall correctness

-   Approve tax application

-   Verify net payable amounts

-   Approve WHT/VAT entries

-   Approve advances applied

-   Approve account postings

#### Goals

-   Zero tolerance for errors

-   Fully accurate financial postings

#### Pain Points

-   Overloaded with manual tasks

-   No consolidated view of all validations

-   Lack of accounting automation

#### System Needs

-   Consolidated validation view

-   Automated journal entry generation

-   Payment readiness indicator

-   Month-end accrual visibility

#### 4.8 CFO / Finance Director Persona

Role: Highest finance approver

Department: Executive Finance

#### Responsibilities

-   Approve high-value payments

-   Ensure compliance

-   Maintain financial governance

#### Goals

-   Reduce financial exposure

-   Full visibility into AP liabilities

#### Pain Points

-   Lack of real-time AP aging

-   Manual payment schedule approvals

#### System Needs

-   High-level dashboard

-   Aging analysis

-   Vendor outstanding metrics

-   Payment run approval UI

#### 4.9 AP Processor Persona

Role: Operates AP processes daily

Responsibilities

-   Prepare payment batches

-   Upload bank files

-   Verify settlement

-   Post ERP entries

-   Handle rejected payments

#### Goals

-   Fast payment processing

-   Error-free uploads

#### Pain Points

-   Manual bank file preparation

-   Time-consuming validation

-   Hard to track rejected payments

#### System Needs

-   Auto-generate bank upload files

-   Auto-posting to ERP

-   Reconciliation with vendor ledger

#### 4.10 Tax & Compliance Officer Persona

Role: Ensures correct statutory remittances

#### Responsibilities

-   Validate WHT rates

-   Validate VAT applicability

-   Ensure compliance with local tax laws

#### Goals

-   100% accurate tax postings

-   Zero penalties

#### Pain Points

-   Inconsistent manual tax application

-   Poor document visibility

#### System Needs

-   Automated tax engine

-   Clear tax basis breakdown

-   Tax exception flagging

#### 4.11 Vendor Persona (Invoice Submission)

Role: Vendor submitting invoices

Needs:

-   Upload invoice

-   Track approval status

-   Correct rejected invoices

-   Update banking details (through controlled workflow)

#### 4.12 Tenant Admin Persona

Role: Configures AP rules for tenant

Responsibilities

-   Define approval workflows

-   Define tax rules

-   Define vendor types permitted

-   Define PO/GRN rules

-   Manage dimension/GL structures

#### 4.13 Super Admin Persona

Role: Oversees all tenants

Responsibilities

-   Set global AP limits

-   Approve new tenant configurations

-   Monitor performance

-   Ensure multi-tenant isolation

### Additional details (Draft B)

### 3 Personas & Stakeholder Roles

This section defines every actor that interacts with the ZivaBI Accounts
Payable (AP) Module.
Each persona includes: responsibilities, permissions, workflow
involvement, system interactions,
and constraints.

#### 3.1 Requestor (Employee / Department User)

Responsibilities:
- Initiates vendor payment requests.
- Uploads invoices, support documents, and maps PO (if applicable).
- Provides correct GL, dimensions, tax applicability (or accepts AI
suggestions).
- Provides Beneficiary/Team Member details when required.
- Responds to Finance clarification requests.
- Splits lines when instructed by Finance.

Permissions:
- Create new payment requests.
- Edit request in "Draft" or when returned by Finance.
- Track status of every submitted invoice.
- View vendor payment schedule (if enabled by tenant).

System Interactions:
- Invoice submission form.
- Beneficiary declaration form.
- Document upload panel.
- AI suggestion review.
- Notes & clarification chat.

Constraints:
- Cannot self-approve.
- Cannot bypass approval workflow.
- Cannot change vendor banking details.

#### 3.2 Line Manager (LM)

Responsibilities:
- First-level approval of invoice requests.
- Checks budget relevance and operational legitimacy.
- Provides clarification when needed.

Permissions:
- Approve or reject submitted invoices.
- Add comments visible to Finance.

Constraints:
- Cannot modify GL/dimensions.
- Cannot override Finance/tax rules.

#### 3.3 Head of Department (HOD)

Responsibilities:
- Reviews departmental invoices.
- Ensures expense aligns with department budget and objectives.

Permissions:
- Approve or reject.
- Add comments.

Constraints:
- Cannot override tenant approval matrix.
- Cannot edit finance-related fields.

#### 3.4 General Manager (GM)

Responsibilities:
- Final business-side approval before Finance.
- Ensures high-value or sensitive invoices are justified.

Permissions:
- Approve/reject requests above high-value thresholds.
- Provide business justification notes.

Constraints:
- Cannot modify invoice coding.

#### 3.5 Finance Reviewer

Responsibilities:
- Validates GL, dimensions, tax rules, PO/GRN match.
- Performs line splitting when required.
- Requests Beneficiary details if missing.
- Ensures documentation is correct & complete.
- Rejects request if compliance fails.

Permissions:
- Edit any coding field.
- Split lines.
- Request more documents.
- Correct tax calculations.
- Add Finance notes (internal).

Constraints:
- Cannot approve final payment.
- Cannot modify vendor master data.

#### 3.6 Finance Approver (Finance Manager / CFO / AP Manager)

Responsibilities:
- Final validation before payment scheduling.
- Ensures invoice is correct, compliant, and ready for ERP posting.
- Approves payment amounts after WHT/VAT adjustments.

Permissions:
- Approve/reject final Finance review stage.
- View full audit trail, PO, GRN, and attachments.

Constraints:
- Cannot edit vendor details.
- Cannot bypass audit trail.

#### 3.7 AP Manager (Operational Role)

Responsibilities:
- Oversees AP workflow for tenant.
- Manages Finance team exceptions.
- Ensures timely processing.

Permissions:
- Reassign Finance tasks.
- View AP workload.
- Temporarily disable/enable AI suggestions for AP.

#### 3.8 Vendor (External Stakeholder)

Responsibilities:
- Upload invoices via Vendor Portal.
- Upload vendor forms and required documents.
- Track invoice and payment status.
- Respond to Finance queries (if enabled).

Permissions:
- Submit invoices directly.
- View processing stage.
- Add supporting evidence.
- Request vendor profile updates (via controlled workflow).

Constraints:
- Cannot modify banking information without full verification workflow.

#### 3.9 Operations / Warehouse Officer (GRN Confirmation)

Responsibilities:
- Confirms goods received / service rendered.
- Provides delivery evidence (delivery note, POD, photos).
- Confirms quantities, location, date, and condition.

Permissions:
- Approve GRN confirmation step.
- Upload GRN evidence.

Constraints:
- Cannot alter invoice details.

#### 3.10 Tax Officer

Responsibilities:
- Reviews or sets tenant tax rules.
- Ensures correct WHT/VAT treatment.

Permissions:
- Configure tax settings.
- Approve tax exceptions.

#### 3.11 Internal Auditor

Responsibilities:
- Conducts periodic audit checks.
- Uses audit export bundles.
- Reviews all AP events and approvals.
- Validates vendor compliance and invoice authenticity.

Permissions:
- Read-only access to all supporting documents.
- Download audit-ready packs.

#### 3.12 External Auditor

Similar to internal auditor but with stricter access:
- Read-only access to AP transaction logs.
- Cannot view confidential Finance internal notes.

#### 3.13 Tenant Admin

Responsibilities:
- Configures AP rules.
- Sets approval matrix.
- Defines vendor category mappings.
- Sets dimension rules.
- Configures tax rules and FX policies.

Permissions:
- Manage all tenant AP configurations.
- Enable/disable AI per field.
- Configure budget rules.

#### 3.14 Super Admin (Platform Owner)

Responsibilities:
- Oversees platform-wide operations.
- Manages system-wide configurations.
- Handles escalations across tenants.
- Ensures multi-tenant security and compliance.

Permissions:
- Access to aggregated AP analytics (no raw tenant data).
- Manage module activations for tenants.

#### 3.15 ICE Engine (AI System Actor)

Responsibilities:
- Provides GL/dimension suggestions.
- Detects duplicate invoice patterns.
- Supports vendor pattern learning.
- Flags anomalies.

Constraints:
- Cannot override human decisions.
- Cannot auto-post entries.

#### 3.16 Workflow Engine (System Actor)

Responsibilities:
- Manages all AP approvals.
- Sends reminders and escalations.
- Manages requestor return loops.
- Ensures correct approval sequence per tenant.


---

## 5. User Stories

### 4 User Stories

User stories represent functional requirements from the perspective of
each role in the AP workflow.
They follow the format: "As a [persona], I want to [action], so that
[business objective]."

#### 4.1 Requestor (Employee)

- As a Requestor, I want to upload an invoice and supporting documents,
so that Finance can process the payment.
- As a Requestor, I want to accept or modify AI-suggested GL and
dimensions, so that my request is accurate.
- As a Requestor, I want to enter beneficiary/ team-member information,
so that expenses covering multiple people are properly allocated.
- As a Requestor, I want to split lines when instructed by Finance, so
that the invoice reflects accurate financial classification.
- As a Requestor, I want to track the approval progress, so that I know
when the invoice will be processed.
- As a Requestor, I want to correct any issues Finance flags, so that my
request can proceed without rejection.

#### 4.2 Line Manager (LM)

- As an LM, I want to review submitted invoices, so that only legitimate
expenses are approved.
- As an LM, I want to view attached documents, so that I can verify the
request is valid.
- As an LM, I want to reject or approve invoices, so that I maintain
departmental control.

#### 4.3 Head of Department (HOD)

- As an HOD, I want to approve larger or more critical invoices, so that
departmental budgets are protected.
- As an HOD, I want to review justification notes, so that I can confirm
the necessity of the transaction.

#### 4.4 General Manager (GM)

- As a GM, I want to approve high-value invoices, so that organizational
controls are met.
- As a GM, I want to view audit trails, so that decisions are properly
justified.

#### 4.5 Operations/Warehouse (GRN Officer)

- As a GRN Officer, I want to confirm goods received or services
rendered, so that Finance has proof of delivery.
- As a GRN Officer, I want to attach delivery evidence, so that invoices
can be validated.

#### 4.6 Finance Reviewer

- As a Finance Reviewer, I want to validate GL, dimensions, and taxes,
so that the posting is accurate.
- As a Finance Reviewer, I want to split invoice lines when necessary,
so that cost allocations are correct.
- As a Finance Reviewer, I want to request missing documents or
beneficiary lists, so that compliance is met.
- As a Finance Reviewer, I want to verify PO and GRN matches, so that
only fulfilled services are paid for.

#### 4.7 Finance Approver

- As a Finance Approver, I want to validate the final coding and tax
calculations, so that the posting is audit-proof.
- As a Finance Approver, I want to approve invoices for payment
scheduling, so that vendors are paid on time.

#### 4.8 AP Manager

- As an AP Manager, I want to view all pending invoices, so that I can
manage workload.
- As an AP Manager, I want to reassign tasks, so that bottlenecks are
removed.

#### 4.9 Vendor

- As a Vendor, I want to upload invoices, so that I can initiate payment
processing.
- As a Vendor, I want to track payment status, so that I know when I
will be paid.
- As a Vendor, I want to update my business documents, so that Finance
has current records.

#### 4.10 Tenant Admin

- As a Tenant Admin, I want to configure the approval workflow, so that
AP routing follows company policy.
- As a Tenant Admin, I want to define tax rules, so that WHT/VAT
calculations match local regulations.

#### 4.11 Super Admin

- As a Super Admin, I want to activate AP module features for tenants,
so that system usage is controlled.
- As a Super Admin, I want to enforce multi-tenant protections, so that
data remains isolated.

#### 4.12 ICE Engine (AI Actor)

- As ICE, I want to suggest GL and dimensions, so that users save time
and reduce errors.
- As ICE, I want to detect duplicate invoices, so that fraud is
prevented.

#### 4.13 Workflow Engine (System Actor)

- As the Workflow Engine, I want to enforce approval sequences, so that
financial governance is maintained.
- As the Workflow Engine, I want to trigger escalations and reminders,
so that invoices are not delayed.


---

## 6. Data Model

### 5.0 ACCOUNTS PAYABLE (AP) DATA MODEL

The AP Data Model contains all standardized structures required for
invoice capture, processing, matching, posting, payment, tax handling,
and audit logging.

This is the central backbone of the AP module and must be consistent
across:

-   Invoice workflows

-   Vendor rules

-   PO/GRN matching

-   Expense advances

-   ERP mapping

-   Document management

-   Reporting & analytics

The AP Data Model is broken into structured sub-models:

#### 5.1 Invoice Header Data Model

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| Invoice_ID | UUID | ✔ | System-generated unique invoice identifier |
| Vendor_ID | FK (Vendor Master) | ✔ | Links invoice to approved vendor |
| Vendor_Type | Enum | ✔ | Full, One-Time, Expense-Only, 3PL, Clearing Agent, Event Agency, etc. |
| Invoice_Number | String | ✔ | Extracted by OCR or input manually |
| Invoice_Date | Date | ✔ | As per vendor invoice |
| Received_Date | Date | ✔ | When invoice was received by tenant or system |
| Invoice_Due_Date | Date | Optional | If provided by vendor |
| Currency | Enum (ISO 4217) | ✔ | Invoice currency |
| Exchange_Rate | Decimal | Conditional | Rate used for conversion; based on tenant settings |
| Invoice_Amount_Foreign | Decimal | ✔ | Invoice amount in invoice currency |
| Invoice_Amount_Base | Decimal | ✔ | Converted amount to tenant base currency |
| PO_Number | String/Null | Optional | PO reference (if exists) |
| GRN_Number | String/Null | Optional | GRN reference (if exists) |
| Invoice_Source | Enum | ✔ | Vendor Portal, Requestor Upload, Email OCR, System API |
| Status | Enum | ✔ | Draft, Under Review, Approved, Posted, Paid, Rejected, Clarification |
| Workflow_ID | FK | ✔ | Links to workflow engine |
| Tax_Status | Enum | ✔ | Auto-evaluated---Normal, Reverse VAT, Self VAT, VAT Missing, WHT Applicable |
| Is_Advance_Settlement | Boolean | ✔ | Whether invoice relates to advance utilization |
| Duplicate_Flag | Boolean | ✔ | Set by system if similarity \> threshold |
| Fraud_Risk_Score | Integer (0--100) | ✔ | AI-analyzed pattern risk |
| Created_By | FK | ✔ | User who entered invoice |
| Created_At | Timestamp | ✔ | Date/time stamp |
| Updated_At | Timestamp | ✔ | Last update |


#### 5.2 Invoice Line Items Data Model

Each invoice can have one or more line items, each with its own GL,
dimension, tax, and budget mapping.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| Line_ID | UUID | ✔ | Unique row identifier |
| Invoice_ID | FK | ✔ | Links to invoice header |
| Line_Number | Integer | ✔ | Display ordering |
| Description | Text | ✔ | Line item description |
| Quantity | Decimal | Optional | For goods/services |
| Unit_Price | Decimal | Optional | Price per item |
| Line_Total_Foreign | Decimal | ✔ | Amount per line in invoice currency |
| Line_Total_Base | Decimal | ✔ | Amount converted using exchange rate |
| PL_Group | Enum | Tenant-configurable | PL1--PL4, BS |
| PL_SubLine | Enum | Tenant-configurable | e.g., Marketing → Sponsorship |
| GL_Account | FK (Chart of Accounts) | ✔ | GL selected manually or via AI |
| Real_Stat_IO | FK | Conditional | Real or statistical IO |
| Cost_Center_IO | FK | Conditional | Cost center |
| Material_IO | FK | Conditional | For inventory or marketing assets |
| Location | FK | Conditional | Required if tenant config demands |
| Budget_Owner_ID | FK | ✔ | Budget owner for this cost |
| Is_Budgeted | Boolean | ✔ | Indicates if cost falls in approved budget |
| VAT_Applicable | Boolean | ✔ | Determined by vendor category & tax rules |
| WHT_Applicable | Boolean | ✔ | Vendor category rules |
| VAT_Rate | Decimal | Conditional | 0%, 7.5%, etc. |
| WHT_Rate | Decimal | Conditional | e.g., 2%, 5%, 10% |
| VAT_Amount | Decimal | Auto | System calculation |
| WHT_Amount | Decimal | Auto | System calculation |
| Net_Payable_Line | Decimal | Auto | Line total -- WHT + reverse VAT, etc. |
| PO_Line_ID | FK | Optional | PO reference |
| GRN_Line_ID | FK | Optional | GRN reference |
| Supporting_docs | Array | ✔ | Linked file identifiers |
| Rejection_Reason | Text | Optional | If approver rejects the line |
| Status | Enum | ✔ | Active, Rejected, Corrected |


#### 5.3 PO Header Data Model (AP Perspective)

Even though PO is part of the Procurement Module, AP must store its own
read-only snapshot for matching.

| Field | Type | Description |
| --- | --- | --- |
| PO_ID | FK | Links to procurement system |
| PO_Number | String | Unique PO number |
| Vendor_ID | FK | Vendor of PO |
| PO_Currency | Enum | Currency of PO |
| PO_Total_Amount | Decimal | Total amount |
| PO_Date | Date | Date PO approved |
| PO_Status | Enum | Open, Partially Received, Closed, Cancelled |
| Workflow_Approver | Array | Approval audit |
| PO_Type | Enum | Normal, Capex, Marketing, Clearing Agent PO |


#### 5.4 PO Line Items (For Matching)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| PO_Line_ID | UUID | ✔ | Unique PO line ID |
| PO_ID | FK | ✔ | Link to PO header |
| Description | Text | ✔ | Line description |
| Qty_Ordered | Decimal | ✔ | Ordered quantity |
| Qty_Received | Decimal | ✔ | GRN updates this |
| Unit_Price | Decimal | ✔ | PO price |
| Line_Total | Decimal | ✔ | Qty × Price |
| Budget_Code | String | Optional | Budget owner tracking |
| GL_Account | FK | ✔ | PO GL |
| Real_Stat_IO | FK | Conditional |  |
| Cost_Center | FK | Conditional |  |


#### 5.5 GRN Header Data Model

ZivaBI will integrate GRN information to support 3-way matching.

| Field | Type | Description |
| --- | --- | --- |
| GRN_ID | UUID | Goods receipt note ID |
| PO_ID | FK | Associated PO |
| Vendor_ID | FK | Vendor |
| Received_Date | Date | When goods/services confirmed |
| Received_By | FK | Operations user |
| GRN_Status | Enum | Pending, Approved, Reversed |


#### 5.6 GRN Line Items

| Field | Type | Description |
| --- | --- | --- |
| GRN_Line_ID | UUID | Unique ID |
| GRN_ID | FK | Belongs to GRN |
| PO_Line_ID | FK | PO line reference |
| Qty_Received | Decimal | Actual received |
| Qty_Accepted | Decimal | Accepted amount |
| Variance | Decimal | Difference from PO |
| Remarks | Text | Notes on damage, shortfall |


#### 5.7 Tax Engine Data Model

#### VAT Table

| Field | Type | Description |
| --- | --- | --- |
| VAT_ID | UUID | Identifier |
| Jurisdiction | Enum | Country/state |
| Vendor_Type | Enum | Different vendors, different rules |
| GL_Account_VAT | FK | VAT posting GL |
| VAT_Rate | Decimal | \% |
| Reverse_VAT | Boolean | If applicable |
| Self_Account | Boolean | WVAT rules |


#### WHT Table

| Field | Type | Description |
| --- | --- | --- |
| WHT_ID | UUID | Identifier |
| Vendor_Type | Enum | Professional, Event Agency, Clearing Agent |
| Expense_Type | Enum | Professional Fees, Rent, Technical Services |
| WHT_Rate | Decimal | Rate |
| WHT_Base_Rule | Enum | Gross, Net of VAT, Agency Fee Only |
| GL_Account_WHT | FK | WHT payable GL |


#### 5.8 Advance Settlement Data Model

This model enables the system to automatically reconcile vendor advances
with final invoices.

| Field | Type | Description |
| --- | --- | --- |
| Advance_ID | UUID | Advance transaction |
| Vendor_ID | FK | Vendor |
| Advance_Amount | Decimal | Amount paid in advance |
| WHT_Deducted_On_Advance | Decimal | WHT on advance |
| VAT_On_Advance | Decimal | VAT component |
| Currency | Enum | FX or local |
| Linked_Invoice_ID | FK | Final invoice |
| Advance_Balance | Decimal | Remaining amount |
| Adjustments | Array | Difference adjustments |


#### 5.9 ERP Posting Data Model

For pushing entries into ERP:

| Posting Field | Description |
| --- | --- |
| Posting_ID | Unique posting identifier |
| ERP_Document_Number | Returned by ERP |
| Posting_Status | Success, Failed, Retry Pending |
| Debit_Lines | Array of GL, amount, IO, cost center |
| Credit_Lines | Array of GL, amount, IO, cost center |
| Tax_Lines | VAT, WHT accounts |
| FX_Lines | Unrealized/realized FX adjustments |
| Posting_Date | Date |
| Posted_By | User |
| Retry_Count | For failed attempts |


#### 5.10 Document Management Data Model

| Field | Type | Description |
| --- | --- | --- |
| Document_ID | UUID | Unique file |
| Invoice_ID | FK | Belongs to invoice |
| File_Path | String | Location in storage |
| File_Type | Enum | PDF, JPG, PNG, DOCX |
| OCR_Text | Text | Extracted OCR text |
| Comparison_Score | Decimal | \% match between OCR and user input |


#### 5.11 Audit Trail Data Model

| Field | Type | Description |
| --- | --- | --- |
| Audit_ID | UUID | Record identifier |
| User_ID | FK | Who performed action |
| Action_Type | Enum | Upload, Edit, Approve, Reject, Clarification |
| Timestamp | DateTime | When |
| Old_Value | JSON | Before change |
| New_Value | JSON | After change |
| Remarks | Text | Additional context |


### Technical Database Schema (Draft B)

### 7 Data Model & Database Schema

This section defines the complete logical and relational data model for
the ZivaBI AP Module.
Each entity is multi-tenant, auditable, and designed for large-scale
enterprise automation.

#### 7.1 Multi-Tenant Core Structure

Each table includes:
- tenant_id (UUID) --- Required for strict tenant isolation.
- created_at, updated_at --- UTC timestamps.
- created_by, updated_by --- User IDs.
- audit_log_id --- Foreign key to audit trail.

#### 7.2 Entity: ap_invoice_header

Fields:
- invoice_id (UUID, PK)
- tenant_id (FK)
- vendor_id (FK)
- requestor_id (FK)
- invoice_number (string)
- invoice_date (date)
- invoice_amount_fx (decimal)
- invoice_amount_ngn (decimal)
- currency_code (string)
- fx_rate_used (decimal)
- status (enum: draft, submitted, approved_lm, approved_hod,
approved_gm, finance_review, finance_approved, posted)
- is_duplicate_flag (boolean)
- duplicate_score (decimal)
- po_id (FK, nullable)
- grn_id (FK, nullable)

#### 7.3 Entity: ap_invoice_line

Fields:
- line_id (UUID, PK)
- invoice_id (FK)
- tenant_id (FK)
- line_number (int)
- description (string)
- amount_fx (decimal)
- amount_ngn (decimal)
- gl_account (string)
- cost_center (string, nullable)
- internal_order_real (string, nullable)
- internal_order_stat (string, nullable)
- material_io (string, nullable)
- location_code (string, nullable)
- vendor_category_code (string)
- tax_wht_amount (decimal)
- tax_vat_amount (decimal)
- split_from_line_id (UUID, nullable)

#### 7.4 Entity: ap_line_split_history

Fields:
- split_id (UUID)
- original_line_id (FK)
- new_line_id (FK)
- performed_by (user_id)
- reason (string)
- allocation_percent (decimal)
- allocation_amount (decimal)
- timestamp (UTC)

#### 7.5 Entity: ap_beneficiary

Fields:
- beneficiary_id (UUID)
- line_id (FK)
- tenant_id (FK)
- employee_id (FK, nullable)
- beneficiary_name (string)
- allocation_percent (decimal)
- allocation_amount (decimal)
- notes (string)

#### 7.6 Entity: vendor_category_rules

Defines accounting/tax logic.

Fields:
- category_code
- applies_wht (boolean)
- applies_vat (boolean)
- vat_reversed (boolean)
- wht_rate (decimal)
- vat_rate (decimal)
- dimension_rules (JSON)

#### 7.7 Entity: po_header, po_line, grn

Simplified for AP linkage:
- po_header: po_id, vendor_id, total_value, status
- po_line: po_line_id, gl_account, amount
- grn: grn_id, received_by, date_received, evidence_url

#### 7.8 Entity: fx_rate_log

Fields:
- fx_id
- currency_code
- rate_value
- source
- effective_date

#### 7.9 Entity: tax_calculation_log

Fields:
- tax_id
- invoice_id
- line_id
- tax_type
- tax_base
- tax_amount
- rules_applied (JSON)

#### 7.10 Entity: ap_approval_workflow_state

Tracks every approval stage.

Fields:
- workflow_id
- invoice_id
- approver_role
- approver_id
- status (pending, approved, rejected)
- comments
- timestamp

#### 7.11 Entity: ap_document_store

Stores links to files.

Fields:
- document_id
- invoice_id
- line_id
- document_type (invoice, PO, GRN, support)
- file_url
- storage_provider (S3, Azure, GCP)
- checksum
- upload_user_id

#### 7.12 Entity: audit_trail

Fields:
- audit_id
- tenant_id
- entity_type
- entity_id
- action_type
- before_state (JSON)
- after_state (JSON)
- performed_by
- timestamp


---

## 7. Workflow Requirements

### 6.0 ACCOUNTS PAYABLE WORKFLOW REQUIREMENTS

The AP workflows must be:

-   Fully configurable per tenant

-   Vendor-type aware

-   Category-specific

-   Tax-rule aware

-   Multi-currency aware

-   Audit compliant

-   Automated where possible

-   Equipped with exception handling

-   Driven by the workflow engine

-   Integrated with PO, GRN, Vendor Master, Expense, Inventory, 3PL, and
    ERP modules

Below are all required workflow definitions.

#### 6.1 MAIN AP WORKFLOW --- HIGH-LEVEL STRUCTURE

All AP invoices pass through the stages below (some may be skipped based
on configuration):

1.  Invoice Intake

2.  OCR & Duplicate Check

3.  Invoice Classification (AI + Rules)

4.  GL & Dimension Suggestion

5.  PO/GRN Matching (if applicable)

6.  Tax Engine Evaluation

7.  Advance Settlement Check

8.  Workflow Routing

9.  Approvals (Multi-Level)

10. Finance Final Approval

11. ERP Posting

12. Payment Scheduling & Processing

Exception paths:

-   Rejection

-   Clarification

-   Suspicious invoice handling

-   High-risk vendor routing

-   Tax inconsistency detection

-   Advance mismatch

-   FX difference handling

#### 6.2 INVOICE INTAKE WORKFLOW

#### Supported Intake Channels:

1.  Vendor Portal upload

2.  Requestor uploads invoice in AP Request Form

3.  Finance manual entry (last resort)

4.  Email Invoice Capture (future enhancement)

#### Workflow

-   Invoice arrives → System assigns Draft status

-   Mandatory field validation

-   Vendor eligibility check (from Vendor Onboarding Module)

-   If One-Time vendor:

    -   Apply one-time vendor workflow

    -   Apply tenant expiration policies

#### 6.3 OCR WORKFLOW

#### Step 1 --- OCR Extraction

-   Extract invoice number

-   Extract date

-   Extract line descriptions

-   Extract currency

-   Extract total amount

-   Extract tax lines

#### Step 2 --- OCR Confidence Score

-   If score \< tenant threshold → Flag for manual entry

#### Step 3 --- OCR Mismatch Check

-   System compares OCR data vs user input:

    -   Amount mismatch

    -   Date mismatch

    -   Tax mismatch

    -   Vendor mismatch

#### Step 4 --- Exception Handling

-   If mismatch \> threshold → "OCR Mismatch Queue" → Finance Pre-Check

#### 6.4 DUPLICATE INVOICE DETECTION WORKFLOW

#### System checks:

-   Same vendor + invoice number

-   Same vendor + date + amount

-   OCR similarity score

-   Line item similarity

-   History of similar invoices

#### If duplicate detected:

-   Auto-Block invoice

-   Notify Finance Pre-Check

-   Requestor can appeal with justification

-   Finance decides to unblock or reject

#### 6.5 GL & DIMENSION SUGGESTION WORKFLOW

After OCR, system auto-suggests:

-   GL account

-   PL Group

-   PL Sub-line

-   Real/Stat IO

-   Cost center IO

-   Material IO

-   Location

Sources of intelligence:

-   Vendor category

-   Historical postings

-   Budget codes

-   Tenant rules

-   AI classification (optional based on tenant config)

Requestor can override only if tenant permits.

Finance can always override.

#### 6.6 PO/GRN MATCHING WORKFLOW

#### Workflow Type:

-   2-Way Match: PO vs Invoice

-   3-Way Match: PO vs GRN vs Invoice

#### Steps:

1.  System fetches PO

2.  System fetches GRN (if applicable)

3.  System compares:

    -   Quantity

    -   Unit price

    -   Total

    -   Line description

4.  Tolerance rules applied

5.  Variance handling:

    -   Over-variance

    -   Under-variance

    -   Partial receipts

    -   Non-delivery

    -   Wrong vendor

    -   Wrong PO line

#### Exception path:

-   Auto-flag discrepancy

-   Route to:

    -   Procurement

    -   Operations

    -   Finance (if monetary variance)

#### 6.7 TAX ENGINE WORKFLOW

The system applies:

#### VAT Rules

-   Input VAT

-   Reverse VAT

-   Self-Account VAT

-   Exempt items

-   FX VAT translation

#### WHT Rules

-   WHT based on:

    -   Vendor type

    -   Category

    -   Invoice line type

    -   VAT exclusion rules

    -   Special category rules:
        
        Event Agency → WHT only on agency fee
        
        Clearing Agent → WHT only on service component
        
        Insurance → No WHT
        
        Non-resident vendor → special rates

#### Workflow:

-   Tax rules applied automatically

-   Tax summary panel visible to Finance

-   Requestor cannot alter tax

-   Finance can override if tenant permits

#### 6.8 ADVANCE SETTLEMENT WORKFLOW

#### Applies if vendor has advance outstanding.

Workflow:

1.  Identify outstanding advance

2.  Compare advance-related documents

3.  Apply advance to invoice

4.  Reverse earlier VAT/WHT if needed

5.  Compute new VAT/WHT

6.  Deduct old WHT from new WHT

7.  Recompute net payable

8.  Post adjustment entries

#### Special: Event Agencies

-   Settlement occurs per budget line

-   Reimbursables vs Agency Fee separated

-   PO/GRN replaced by Budget → Actual matching

#### 6.9 APPROVAL WORKFLOW (MULTI-PATH)

Approval levels depend on:

-   Amount

-   Vendor category

-   GL account

-   Budget owner rules

-   Department

#### Possible Approvers:

-   Line Manager

-   HOD

-   GM

-   Procurement

-   Finance Pre-Check

-   Finance Final

-   CFO

#### Approver Actions:

-   Approve all lines

-   Approve some, reject some

-   Request clarification

-   Request additional documents

-   Reassign approver (if workflow permitted)

#### 6.10 CLARIFICATION WORKFLOW

Clarifications can be raised by:

-   Approvers

-   Procurement

-   Finance

-   Tax Officer

-   CFO

#### Clarification flow:

1.  Approver requests clarification

2.  Requestor receives in-app + email notification

3.  Requestor responds with:

    -   Explanation

    -   New document

    -   Updated line item

4.  Approver rechecks

5.  Workflow resumes

Every clarification is logged in the audit trail.

#### 6.11 REJECTION WORKFLOW

Rejection can be:

#### Line-Level Rejection

-   Only problematic line is rejected

-   Other lines continue through workflow

#### Full Request Rejection

-   Entire invoice rejected

-   Requestor must resubmit

#### Rejection must:

-   Provide a reason

-   Support attachments (if needed)

-   Be visible in audit trail

-   Be reversible if tenant configuration allows

#### 6.12 FINANCE FINAL APPROVAL WORKFLOW

Finance final approval requires:

#### Review Panels:

-   GL correctness

-   Dimension correctness

-   Tax correctness

-   PO/GRN match correctness

-   Advance settlement correctness

-   Net payable summary

-   Duplicate check

-   Vendor compliance

-   Budget vs actual comparison

-   Audit log review

Finance approves → Invoice becomes Ready for Posting.

#### 6.13 ERP POSTING WORKFLOW

After Finance Final Approval:

1.  System generates accounting entries

2.  Sends to ERP

3.  ERP returns:

    -   Document Number

    -   Success

    -   Error (if failed)

4.  If failed:

    -   Auto-retry

    -   Finance alerted

    -   Tenant Admin notified

Posting includes:

-   DR Expense

-   DR VAT

-   CR Accounts Payable

-   CR Advance (if applied)

-   CR WHT Payable

#### 6.14 PAYMENT SCHEDULING WORKFLOW

The system:

-   Aggregates approved invoices

-   Generates payment batches

-   Aligns with bank templates

-   Supports multi-currency runs

-   Supports thresholds (like NGN100M batch cap)

-   Sends payment run to CFO/FD for approval

-   Logs payment date

-   Updates vendor ledger

Payment statuses:

-   Scheduled

-   Processing

-   Paid

-   Failed

-   Reversed

#### 6.15 EXCEPTION WORKFLOW

Covers failures in:

-   OCR extraction

-   Duplicate detection

-   ERP posting

-   Payment processing

-   PO/GRN mismatches

-   Advance settlement mismatches

-   High-risk vendor alerts

-   Suspicious invoice fraud detection

Each exception creates:

-   A queue

-   Notification

-   Assigned owner

-   SLA timer

-   Escalation rules

### Additional Workflow Diagrams (Draft B)

### 6 Workflow Diagrams & End-to-End Process Flows

This section defines full text-based workflow diagrams for all critical
AP processes.
Each workflow includes actors, decision points, system actions, and
exception handling.

#### 6.1 High-Level AP Workflow Overview

Vendor/Requestor → Invoice Upload → OCR → ICE Suggestions → Requestor
Review
→ LM Approval → HOD Approval → GM Approval → Finance Review
→ Finance Approval → Posting Packet → Payment Scheduling → ERP Posting →
Payment Execution

#### 6.2 Vendor Invoice Submission Workflow

Vendor/Requestor uploads invoice
↓
OCR extracts data → sends to ICE
↓
ICE generates GL/dimension/category predictions
↓
Requestor reviews & edits
↓
Workflow Engine routes to LM/HOD/GM
↓
Finance Reviewer validates:
- GL/dimensions
- Taxes
- Vendor category rules
- PO/GRN match
↓
Finance Approver finalizes
↓
ERP posting packet generated

#### 6.3 PO + GRN Matching Workflow

PO created → Shared with Requestor/Vendor
↓
Vendor delivers goods/services
↓
Operations/Warehouse confirms GRN
↓
Invoice received & OCR-processed
↓
System performs:
- PO ↔ Invoice amount match
- GRN ↔ Invoice quantity match
- Item-level mapping
↓
If mismatch → Exception Handling:
- Requestor justification
- Finance override
- PO amendment workflow

#### 6.4 Event Agency Workflow

Budget prepared → Uploaded to system
↓
PO created for event
↓
Vendor requests advance (capped by tenant policy)
↓
Advance invoice → WHT computed on gross-up VAT component
↓
Event executed → Vendor submits reimbursables + agency fee
↓
System splits:
- Reimbursables (no WHT)
- Agency fee (WHT applies)
↓
Finance validates per budget lines
↓
Final settlement processed

#### 6.5 Clearing Agent Workflow

IC Proforma Invoice received
↓
Clearing agent raises:
- Form M
- Pre-arrival assessment
- Final assessment
↓
Advance clearing cost request submitted
↓
WHT computed on service portion only
↓
Final invoice received:
- Customs duty → Inventory/Landed Cost
- VAT from final assessment → Input VAT
- Service fee → WHT
↓
System performs:
- Advance offset
- WHT recomputation
- Tax adjustment posting

#### 6.6 Expense → Vendor Payment Workflow (Employee Expense Integration)

Employee incurs reimbursable expense
↓
Employee uploads receipts (OCR)
↓
ICE classifies lines
↓
Finance validates employee retirement
↓
If vendor must be reimbursed → AP invoice auto-created
↓
AP follows normal workflow

#### 6.7 Line Splitting Workflow

Finance identifies need to split a line
↓
Finance clicks "Split Line"
↓
System creates:
- Child lines
- Allocation % or values
- Tax recalculation
↓
Requestor notified (if needed)
↓
Workflow continues with split lines

#### 6.8 Beneficiary Declaration Workflow

Requestor submits invoice
↓
Finance requests beneficiary info
↓
System pauses workflow
↓
Requestor fills beneficiary form:
- Names
- Departments
- Allocation
- Attach proof
↓
Workflow resumes after validation

#### 6.9 Duplicate Invoice Detection Workflow

Invoice uploaded
↓
OCR extracts invoice number/date/vendor/amount
↓
ICE checks:
- Exact match
- Fuzzy match
- AI pattern match
↓
If potential duplicate:
- System flags
- Requires Finance override
↓
If confirmed original:
- Workflow continues

#### 6.10 Finance Review Workflow

Finance Reviewer opens invoice
↓
System displays:
- GL/dimension AI suggestions
- PO/GRN results
- Tax breakdown
- Duplicate probability
- Vendor category rules
↓
Finance adjusts or approves coding
↓
Finance Approver performs final check

#### 6.11 Payment Scheduling Workflow

Approved invoices → AP Aging List
↓
System groups:
- Due payments
- Overdue
- Early-payment discount candidates
↓
Finance Approver confirms payable batch
↓
ERP integration triggers payment scheduling
↓
Vendors receive payment notifications


---

## 8. Business Rules

### 7.0 BUSINESS RULES --- ACCOUNTS PAYABLE MODULE

This section covers:

1.  Invoice validation rules

2.  Vendor eligibility rules

3.  PO/GRN match rules

4.  Tax rules (WHT, VAT, Reverse VAT, Self VAT)

5.  Advance settlement rules

6.  Exchange rate rules

7.  GL + dimension mapping rules

8.  Document requirement rules

9.  Approval rules

10. Payment rules

11. Duplicate prevention rules

12. Suspicious invoice detection rules

13. Budget rules

14. Special vendor category rules

15. Exception rules

16. Master data dependency rules

Each rule ensures AP is consistent, compliant, and intelligent.

#### 7.1 Invoice Validation Rules

#### BR-1: Required Fields

An invoice cannot progress without:

-   Invoice Number

-   Invoice Date

-   Vendor

-   Currency

-   Amount

-   Supporting document (invoice)

-   At least one line item

#### BR-2: Invoice Date Validity Check

-   Invoice date cannot be in the future (unless tenant allows).

-   Invoice date cannot be older than X years (tenant configurable).

#### BR-3: Negative Amount Invoices

Only permitted if:

-   Vendor type = credit note / adjustment

-   Approved by Finance

#### 7.2 Vendor Eligibility Rules

#### BR-4: Vendor Must Be Active

Invoice cannot be submitted if:

-   Vendor is suspended

-   Vendor is expired (document expiry)

-   Vendor is deactivated

-   Vendor is flagged for compliance issues

#### BR-5: One-Time Vendors

-   Only allowed for low-risk categories

-   Auto-expire after one transaction or by tenant rule

-   Cannot be used for PO workflows (tenant configurable)

#### BR-6: Vendor Category Controls

Certain vendor categories require special ERPs:

-   Clearing Agent → Must link invoice to import document

-   Event Agency → Must link invoice to approved event budget

-   3PL Vendor → Must attach proof-of-delivery (POD)

-   Professional Services → Must attach contract or engagement letter

#### 7.3 PO/GRN Matching Rules

#### BR-7: PO Required Based on Tenant Policy

Examples:

-   ₦1,000,000 requires PO

-   Non-resident vendors require PO

-   Vendors without retainer require PO

#### BR-8: 2-Way / 3-Way Rules

-   2-way = PO vs Invoice

-   3-way = PO vs GRN vs Invoice

#### BR-9: Variance Tolerance

Tenant can define:

-   Price variance tolerance (e.g., ±5%)

-   Quantity variance tolerance (e.g., ±2 units)

#### BR-10: Hard Block If Variance Above Threshold

Invoice cannot proceed unless:

-   Procurement resolves

-   GRN corrected

-   PO amended

#### 7.4 Tax Rules (WHT, VAT, Reverse VAT, Self VAT)

This is one of the most important sections.

#### BR-11: WHT Determined by Vendor Category

Examples:

-   Event Agency → Apply WHT only to Agency Fee

-   Clearing Agent → Apply WHT only to service component

-   Insurance Vendors → No WHT

-   Non-resident vendors → Use special WHT rates

#### BR-12: WHT Cannot Be Overridden Unless Tenant Allows

If overridden:

-   Reason required

-   Logged in audit trail

#### BR-13: VAT Must Follow Correct Base Calculation

VAT base = amount + adjustments, EXCLUDING:

-   WHT

-   Reimbursable items

-   Foreign components (where applicable)

#### BR-14: Self-Account VAT (WVAT)

If invoice does NOT include VAT but VAT applies:

-   System computes VAT

-   Posts VAT payable & VAT recoverable

-   Adjusts net payable correctly

#### BR-15: Reverse VAT

If jurisdiction demands reverse VAT:

-   VAT payable is posted

-   Vendor still receives net amount

#### 7.5 Advance Settlement Rules

#### BR-16: Advance Must Be Linked to Same Vendor

System blocks cross-vendor matching.

#### BR-17: Advance Must Link to Correct Event/Project/PO

Example:

-   Event agencies must map advance → event budget

-   Clearing agents must map advance → import invoice

#### BR-18: WHT Adjustment Rule

Final invoice WHT = WHT(final invoice) -- WHT(advance)

#### BR-19: VAT Adjustment Rule

If VAT on advance differs from VAT on final invoice:

System applies correction postings automatically.

#### 7.6 Exchange Rate Rules

#### BR-20: Tenant Defines Source of FX Rate

Options:

-   CBN

-   ECB

-   Tenant ERP

-   Manual override (Finance only)

#### BR-21: Effective Date Rule

Tenant defines:

-   Invoice date

-   Approval date

-   Posting date

-   Payment date

#### BR-22: FX Gain/Loss Rule

If converted amount differs between invoice and payment:

-   Post realized FX gain/loss

-   Unrealized FX revalued at month end

#### 7.7 GL & Dimension Mapping Rules

#### BR-23: AI/Rule-Based GL Suggestion

System suggests GL based on:

-   Vendor category

-   Historical patterns

-   Budget owner

-   Invoice description (OCR & AI)

#### BR-24: Finance Final Authority

Finance can override any GL/dimension.

#### BR-25: Dimension Applicability

If a GL requires dimension:

-   Requestor must select

-   If wrong → system blocks

Example:

-   Marketing GL requires Real IO

-   Distribution GL requires Cost Center IO

#### 7.8 Document Requirement Rules

#### BR-26: Mandatory Attachments

Depending on vendor type:

-   Event Agency → Budget + Invoice + POD

-   Clearing Agent → Customs documents + assessment + final bill

-   3PL Vendor → POD + route log

-   Professional vendor → Contract/engagement letter

-   Non-resident vendor → Tax residency certificate

#### BR-27: Document Expiry

If document expired → system blocks.

#### 7.9 Approval Rules

#### BR-28: Parallel Approvals Allowed

Finance + Procurement can approve simultaneously.

#### BR-29: Approvals Can Be Multi-Level

Tenant can define:

-   LM

-   HOD

-   GM

-   CFO

#### BR-30: Delegation

Approvers can delegate for a limited time.

#### 7.10 Payment Rules

#### BR-31: Only Approved Invoices Reach Payment Queue

Must pass all checks.

#### BR-32: Duplicate Payment Block

System prevents paying same invoice twice.

#### BR-33: Net Payable Calculation

Net Payable = Invoice Total -- WHT + Reverse VAT -- Advance +
Adjustments

#### BR-34: Payment Threshold Rules

E.g., \>₦100M requires CFO approval.

#### 7.11 Duplicate Prevention Rules

#### BR-35: Strong Duplicate Detection

Checks:

-   Invoice number

-   Vendor

-   Amount

-   Date

-   OCR similarity

-   Hashes of document files

#### BR-36: Duplicate invoices enter "Fraud Review Queue"

#### 7.12 Suspicious Invoice Detection Rules

#### BR-37: AI Fraud Scoring

Invoice receives risk score based on:

-   Vendor behavior

-   Invoice pattern

-   Past discrepancies

#### BR-38: High-Risk Invoices Require Finance + Compliance Review

#### 7.13 Budget Rules

#### BR-39: Budget Verification

System checks:

-   Approved budget

-   Remaining balance

-   Budget owner

#### BR-40: Over-Budget Rule

Tenant config:

-   Block

-   Warn

-   Allow with escalated approval

#### 7.14 Special Vendor Category Rules

Covered categories:

-   Clearing Agents

-   Event Agencies

-   Non-resident vendors

-   3PL vendors

-   Professional Service Vendors

-   Rent/Lease providers

-   Insurance providers

Each has unique:

-   WHT rules

-   VAT rules

-   Document rules

-   Matching rules

-   Workflow routing rules

#### 7.15 Exception Rules

#### BR-41: Exceptions Require Justification

User must provide:

-   Reason

-   Evidence

-   Additional documents

#### BR-42: Finance Must Approve Exceptions

#### 7.16 Master Data Dependency Rules

#### BR-43: No Invoice Without Vendor Master

Unless one-time vendor is enabled.

#### BR-44: No Posting Without GL Mapping

If unmapped, system blocks.

### Additional Business Rules (Draft B)

### 5 Business Rules

This section defines all mandatory business rules governing the AP
Module. These rules ensure compliance,
accuracy, auditability, and alignment with tenant-configured financial,
tax, workflow, and vendor policies.

#### 5.1 Invoice Submission Rules

- Every invoice must be linked to a registered vendor.
- Invoice number + vendor + amount must be unique.
- Uploading the invoice file is mandatory before submission.
- AI suggestions are optional but must be reviewable.
- Beneficiary form required when:
  - Expense involves multiple staff.
  - Finance requests additional context.
- No invoice may proceed without required supporting documents.

#### 5.2 Vendor Category Rules

A. Event Agencies:
- Invoice split between reimbursables and agency fee.
- WHT applies only on agency fee (net of VAT).
- Budget mapping required per event.
- PO mandatory for every event project.

B. Clearing Agents:
- Invoice must be mapped to specific importation IC invoice.
- Customs duties → mapped to Inventory/Landed cost.
- VAT from final customs assessment → Input VAT.
- WHT applies on service fee (grossed-up where applicable).
- Advance vs final invoice logic required.

C. 3PL Warehousing & Logistics:
- Invoices must indicate service period.
- Mandatory GRN/evidence for deliveries.
- WHT applicable for logistics services.

D. Professional Services:
- Professional fees separated from reimbursables.
- WHT applies only on fee component.

E. Rent/Lease Vendors:
- Rent period required.
- Advance rent amortization rules apply.

#### 5.3 PO/GRN Matching Rules

- PO required for:
  - Amounts above tenant threshold.
  - Non-retainer vendors.
  - All event projects.
  - All clearing agents.
- GRN mandatory for:
  - Inventory receipts.
  - Delivered services (delivery evidence).
- Invoice cannot proceed if PO amount exceeded unless justified.

#### 5.4 Tax Determination Rules

- WHT applied based on vendor category.
- VAT applied based on invoice category and tenant configuration.
- Reverse VAT applied when:
  - Vendor does not charge VAT.
  - Service is VAT-applicable.
- WHT base rules:
  - Excluding VAT for services.
  - Only agency fee for event vendors.
- Tax must be recalculated by Finance before posting.

#### 5.5 FX & Multi-Currency Rules

- FX rate source configurable by tenant:
  - Final approval date.
  - Invoice date.
  - Monthly corporate rate.
- Rate must be locked at final approval.
- System automatically calculates:
  - NGN equivalent.
  - FX gain/loss when applicable.

#### 5.6 Budget Rules

- Budget line required for event agencies.
- Budget availability checked at:
  - Request submission.
  - Final approval.
- Over-budget requests flagged for justification.

#### 5.7 Line Splitting Rules

- Finance can split any line during review.
- Requestor can also split when returned for correction.
- Split criteria include:
  - GL
  - Cost Center
  - IOs (Real/Stat)
  - Material IO
  - Tax base
  - Projects/events
- System must automatically:
  - Recalculate taxes per split.
  - Recalculate NGN value if FX involved.
- Splitting must maintain audit ties to original line.

#### 5.8 Beneficiary Declaration Rules

- Mandatory when:
  - Multiple employees benefit from expense.
  - Finance requests justification.
  - Category requires per-person allocation.
- Allocation can be:
  - Percentage-based.
  - Amount-based.
- Finance must validate correctness before approval.

#### 5.9 Duplicate Invoice Rules

System must prevent:
- Same invoice number with same vendor.
- Same amount with similar invoice number.
- Slight modifications (AI detection):
  - Date changes
  - PDF alterations
  - Typography differences

#### 5.10 Workflow Rules

- Approval must follow tenant matrix.
- Escalations triggered after configurable timeout.
- Rejections must include reason.
- Rejected request returns to Requestor only.

#### 5.11 Finance Review Rules

Finance must verify:
- GL accuracy.
- Dimension correctness.
- Tax correctness.
- PO/GRN matching.
- Vendor category accounting rules.
- Duplicate invoice probability score.
- Beneficiary list completeness.

#### 5.12 Posting Rules

- Only Finance Approver can finalize posting packet.
- AP posting packet must contain:
  - GL, dimensions
  - WHT/VAT calculations
  - FX rate
  - Vendor info
  - PO & GRN links
  - Audit trail
- ICE suggestions cannot override Finance decisions.

#### 5.13 Vendor Portal Rules

- Vendor can upload invoices but cannot apply GL coding.
- Vendor cannot modify bank details without verification workflow.
- Vendor can view payment status only.

#### 5.14 Audit & Compliance Rules

- Immutable audit logs required.
- All approvals must be timestamped.
- Full "Audit Pack" must be downloadable as ZIP/PDF.
- Audit pack includes:
  - Invoice
  - PO, GRN
  - Approval trail
  - Beneficiary list
  - Tax computation
  - Final Finance review notes

#### 5.15 Multi-Tenant Configuration Rules

Tenant Admin controls:
- Tax policies
- Approval hierarchies
- Vendor categories
- Required fields
- FX rules
- Budget constraints

Super Admin controls:
- Module activation
- Global settings
- Cross-tenant compliance


---

## 9. API Requirements

### 8 API Requirements

This section defines the full REST API architecture for the AP Module.
All endpoints are structured for multi-tenant, secure, scalable
communication.

#### 8.1 API Architecture Principles

- RESTful JSON APIs
- JWT authentication
- tenant_id required in all protected endpoints
- Role-based authorization
- Versioned endpoints: /api/v1/ap/
- All write operations logged to audit_trail
- Pagination for list endpoints
- Standard error schema

#### 8.2 Invoice Submission APIs

POST /api/v1/ap/invoice
Purpose:
- Create new invoice header.

Request:
{
\"tenant_id\": \"...\",
\"vendor_id\": \"...\",
\"invoice_number\": \"...\",
\"invoice_date\": \"YYYY-MM-DD\",
\"currency\": \"USD\",
\"amount_fx\": 2000.00
}

Response:
{
\"invoice_id\": \"...\",
\"status\": \"draft\"
}

#### 8.3 Invoice Line APIs

POST /api/v1/ap/invoice/{invoice_id}/lines
Purpose:
- Add invoice line.

Request:
{
\"description\": \"Event support\",
\"amount_fx\": 500,
\"gl_account\": \"765100\",
\"cost_center\": \"MKT01\"
}

Response:
{
\"line_id\": \"...\"
}

#### 8.4 Line Splitting API

POST /api/v1/ap/lines/{line_id}/split
Purpose:
- Split a line into multiple allocations.

Request:
{
\"splits\": [
{ \"percent\": 70, \"gl_account\": \"730010\" },
{ \"percent\": 30, \"gl_account\": \"730020\" }
]
}

Response:
{
\"new_lines\": [ \"...\", \"...\" ]
}

#### 8.5 Beneficiary API

POST /api/v1/ap/lines/{line_id}/beneficiaries
Purpose:
- Add beneficiary list.

Request:
{
\"beneficiaries\": [
{ \"name\": \"John Doe\", \"allocation_percent\": 50 },
{ \"name\": \"Jane Doe\", \"allocation_percent\": 50 }
]
}

#### 8.6 PO/GRN Matching API

GET /api/v1/ap/invoice/{invoice_id}/match
Purpose:
- Return PO and GRN matching results.

Response:
{
\"po_match\": true,
\"grn_match\": false,
\"exceptions\": [\"GRN not found for PO line 3\"]
}

#### 8.7 Tax Calculation API

POST /api/v1/ap/tax/calc
Purpose:
- Return WHT/VAT breakdown.

Request:
{
\"vendor_category\": \"EVENT_AGENCY\",
\"amount\": 100000
}

Response:
{
\"vat\": 7500,
\"wht\": 5000
}

#### 8.8 ICE Recommendations API

GET /api/v1/ap/lines/{line_id}/ai
Purpose:
- Fetch AI suggestions for GL and dimensions.

Response:
{
\"gl_suggestion\": \"765100\",
\"confidence\": 0.89
}

#### 8.9 Approval Workflow API

POST /api/v1/ap/invoice/{invoice_id}/approve
POST /api/v1/ap/invoice/{invoice_id}/reject

#### 8.10 Finance Review API

POST /api/v1/ap/invoice/{invoice_id}/finance-review
Purpose:
- Finance reviewer submits final coding and validations.

#### 8.11 Vendor Portal API

POST /api/v1/vendor/invoice-upload
Purpose:
- Vendor uploads invoice.

#### 8.12 Document Upload API

POST /api/v1/files/upload
Purpose:
- Upload invoice/support files.

#### 8.13 Audit Export API

GET /api/v1/ap/invoice/{invoice_id}/audit-pack

#### 8.14 Reporting APIs

GET /api/v1/ap/reports/aging
GET /api/v1/ap/reports/vendor-spend

#### 8.15 Error Response Schema

{
\"error_code\": \"AP_403\",
\"message\": \"Unauthorized\",
\"details\": {}
}


---

## 10. UI/UX Requirements

### 8.0 UI/UX REQUIREMENTS --- ACCOUNTS PAYABLE MODULE

The AP module UI must be:

#### ✔ Ultra-modern

#### ✔ Minimalist

#### ✔ Intuitive

#### ✔ Error-resistant

#### ✔ Mobile-responsive

#### ✔ Intelligent (AI suggestions & smart validation)

#### ✔ Highly configurable per tenant

#### ✔ Easily navigable with intuitive menus

#### ✔ Beautiful and "consumer-grade," not ERP-like

It must support:

-   End-to-end invoice flow

-   Document management

-   Approvals

-   PO/GRN matching

-   Advance settlement

-   Journal preview

-   Payment queues

-   Audit trails

-   Notifications

-   Drag-and-drop everywhere

-   Smart OCR-driven input automation

#### 8.1 GLOBAL UI PRINCIPLES FOR AP MODULE

#### 8.1.1 Modern Aesthetic

-   Clean, flat UI

-   Soft shadows

-   Rounded components

-   Card-based design

-   Dynamic spacing

-   Neutral base colors + tenant theme

#### 8.1.2 Drag-and-Drop Everywhere

Used for:

-   Uploading documents

-   Re-ordering line items

-   Assigning documents to lines

-   Changing approval routes (tenant admin)

#### 8.1.3 Real-Time Validation

Errors must be displayed immediately:

-   Missing fields

-   Wrong format

-   Invalid tax rules

-   Dimension mismatch

-   Incorrect GL selections

#### 8.1.4 Autosave

Every 5 seconds + on every field change.

#### 8.1.5 Mobile First

Every screen must:

-   Scale smoothly

-   Offer swipe navigation

-   Use simplified controls

#### 8.1.6 Accessibility

-   WCAG 2.2 AA

-   Keyboard navigation

-   Screen reader labels

#### 8.2 AP REQUESTOR UI (Invoice Submission Screen)

This is the primary screen for staff initiating AP requests.

It must be extremely user-friendly because requestors are not finance
experts.

##### 8.2.1 Screen Layout

#### Top Navigation Bar:

-   "New Payment Request"

-   "My Requests"

-   "My Approvals" (if applicable)

-   Notifications bell

-   Profile menu

#### Main Form Layout:

Divided into three collapsible panels:

**Panel 1 --- Invoice Details Panel**

-   Invoice Number (OCR autofill)

-   Invoice Date (calendar picker)

-   Vendor (dropdown + vendor info shortcut)

-   Currency (autofill from invoice if OCR successful)

-   Amount (OCR autofill)

-   Exchange rate (auto from tenant policy)

-   PO Number (if required by vendor/company policy)

#### Smart Features:

✔ Auto-scan invoice PDF/JPG

✔ Pre-fill all fields using OCR

✔ Show confidence levels

✔ Highlight mismatches

**Panel 2 --- Line Item Entry Panel**

The most important UI section.

Each line includes:

-   Description (text area; OCR suggestion)

-   PL Group (dropdown)

-   PL Sub-Line (dynamic dropdown)

-   GL Account (dynamic dropdown)

-   Real/Stat IO (dynamic)

-   Cost Center IO (dynamic)

-   Material IO (conditional)

-   Location

-   Amount (OCR line extraction optional)

-   Tax preview (VAT/WHT auto-calc)

#### 2-line default:

-   Desktop: Show 2 rows pre-loaded

-   Mobile: Show 1 card per page

#### Smart Features:

✔ AI-based GL suggestions

✔ Prevent invalid dimension combinations

✔ Show remaining budget for GL/IO

✔ Document attachment indicator

✔ Add Line button

✔ Delete Line button

✔ Drag line to reorder

**Panel 3 --- Attachments Panel**

Includes:

-   Invoice (mandatory)

-   Supporting documents

-   PO/GRN (if applicable)

-   POD (if 3PL)

-   Customs documents (if clearing agent)

-   Budget file (if event agency)

#### UI Features:

✔ Drag and drop files

✔ Multi-file upload

✔ Auto-categorization (OCR)

✔ Inline document viewer

✔ Assign document to line item (drag to line)

#### 8.3 APPROVAL UI (LM, HOD, GM, PROCUREMENT, FINANCE)

#### 8.3.1 Approval Dashboard

Displays:

-   Invoice summary

-   Vendor details

-   Net payable

-   Tax summary

-   Attached docs

-   Approval route

-   SLA timer

-   Flags (variance, duplicate, tax issues)

#### 8.3.2 Approver Actions

-   Approve All

-   Approve by Line

-   Reject Only Selected Lines

-   Reject Entire Request

-   Request Clarification

-   Add Private Note (Not visible to requestor)

#### 8.3.3 Line-by-Line Audit Panel

For each line:

-   GL

-   Dimension

-   VAT

-   WHT

-   Net line amount

-   Attachments

-   Validation results

#### 8.4 FINANCE PRE-CHECK UI

This has the most powerful UI.

#### Key Panels:

1.  Invoice Summary Panel

2.  Tax Panel (VAT/WHT breakdown)

3.  PO/GRN Match Panel

4.  Advance Settlement Panel

5.  GL/Dimension Checker Panel

6.  Duplicate Detection Panel

#### Special Features:

✔ Force override button (audit logged)

✔ Auto-correct GL/dimensions

✔ Auto-correct tax

✔ See audit history inline

✔ Split/Add line on behalf of requestor

#### 8.5 FINANCE FINAL APPROVAL UI

#### Features include:

-   Preview of journal entries

-   Tax posting preview

-   Net payable summary

-   Advance adjustment summary

-   FX rate & FX impact

-   ERP preview mapping

-   Payment readiness indicator

-   "Approve & Post" button

#### 8.6 TAX OFFICER UI (IF TENANT CONFIG ENABLED)

The tax officer sees:

-   Tax basis

-   VAT rules applied

-   WHT basis

-   Adjustment calculations

-   Differences from invoice

-   Reverse/WVAT rules

-   FX impact on tax

#### 8.7 PROCUREMENT UI (PO/GRN MATCH)

#### Features:

-   Side-by-side comparison

-   Highlight mismatches

-   Tolerance range indicators

-   Auto-suggest correct PO line

-   Flag GRN issues

-   Accept or reject variances

#### 8.8 PAYMENT SCHEDULING UI

#### Dashboard:

-   Approved invoices list

-   Multi-select

-   Group by vendor

-   Group by currency

-   Define payment batch name

-   Generate bank upload file

-   CFO approval module

#### 8.9 ERP POSTING UI

#### Shows:

-   Posting status

-   Errors (if any)

-   Retry posting

-   View journal lines

-   ERP document number

#### 8.10 MOBILE UI (FOR REQUESTOR & APPROVERS)

Mobile-first design for:

-   Submitting invoices

-   Scanning documents via camera

-   Approving requests

-   Viewing audit trails

-   Responding to clarifications

Mobile uses:

-   Step-by-step screens

-   Swipeable cards

-   Sticky footer actions

-   Large tap targets

#### 8.11 DOCUMENT VIEWER UI

Features:

-   Multi-page PDF viewer

-   Zoom

-   Rotate

-   Side-by-side compare (OCR vs document)

-   Highlight OCR-detected fields

-   Detect duplicate document

-   Watermark expired/invalid documents

#### 8.12 WORKFLOW TIMELINE UI

Shows:

-   Each approval step

-   Timestamped actions

-   SLA remaining

-   Clarification loops

-   Rejection events

-   ERP posting times

-   Payment run linkage

Beautiful vertical timeline or Gantt-style.

#### 8.13 ERROR HANDLING UI

Errors must:

-   Be descriptive

-   Show exact lines affected

-   Show how to resolve

-   Include retry button

-   Not block unrelated lines

#### 8.14 NOTIFICATION & ALERT UI

Channels:

-   In-app

-   Email

-   Mobile push

Alerts include:

-   Duplicate invoice suspected

-   High-risk vendor

-   Tax mismatch

-   PO/GRN variance

-   Missing documents

-   Clarification request

-   Payment due

-   ERP posting failure

#### 8.15 THEME & BRANDING

Tenant Admin can set:

-   Primary & secondary colors

-   Logo (header & mobile)

-   Button styles

-   Dashboard branding

-   Document watermarking

-   Default avatar

### Additional UI/UX Requirements by Role (Draft B)

### 9 UI/UX Requirements

This section defines all user interface and user experience requirements
for the AP Module.
The design must follow ZivaBI's modern, minimalistic, mobile-responsive,
tenant-themed visual identity.

#### 9.1 General UI Principles

- Clean, modern, intuitive interface.
- Mobile-responsive design.
- Dark mode and tenant color theme support.
- Minimal clicks to complete any task.
- Inline validations for all form fields.
- OCR and AI suggestions presented as clean cards or bubbles.
- Full keyboard navigation support.
- ADA / WCAG accessibility compliance.

#### 9.2 Requestor UI Requirements

A. Invoice Submission Page
- Drag-and-drop invoice upload panel.
- Real-time OCR preview panel.
- AI suggestion sidebar showing:
  - GL suggestion
  - Dimension suggestions
  - Vendor category detected
- Inline PO linking modal.
- Beneficiary form button (conditional).
- Support document mapping UI.

B. Multi-Line Entry Interface
- Two lines visible by default (desktop).
- Add line button creates new row.
- Mobile pagination for each line (mobile).
- Inline alerts for missing mandatory fields.

C. Beneficiary Form UI
- Modal card with:
  - Search staff directory
  - Add external beneficiary
  - Allocation percentage/amount sliders
  - Drag-to-reorder beneficiaries

#### 9.3 Approver UI Requirements (LM, HOD, GM)

- Approvals dashboard with:
  - Pending approvals
  - High-priority items
  - Aging alerts
- Invoice packet viewer with:
  - Invoice preview
  - PO/GRN tab
  - Beneficiary tab
  - Split line tab
- Approve/Reject buttons with comment box.
- Quick Approve mode for batch approvals.

#### 9.4 GRN/Operations UI Requirements

- GRN confirmation page.
- Photo upload support (mobile camera).
- Quantity/quality confirmation fields.
- PO comparison table.

#### 9.5 Finance Reviewer UI Requirements

This is the most important console in AP.

A. Invoice Review Console
- Multi-tab interface:
  - Invoice summary
  - Lines & coding
  - Tax breakdown
  - Supporting documents
  - PO/GRN match
  - Duplicate detection
  - Beneficiaries
  - Audit log

B. AI Suggestion Panel
- GL, IO, CC, Material IO, Location suggestions.
- Confidence score display.
- Accept/Reject buttons.

C. Line Splitting UI
- Modal with:
  - Allocation mode: Percent / Amount
  - Add new split line
  - Inline recalculation of taxes
  - Visual link to original line

D. Duplicate Detection UI
- Flag banner with risk score.
- Comparison table of suspicious invoices.
- View PDF differences.

#### 9.6 Finance Approver UI Requirements

- Final review dashboard.
- "Ready for Posting" list.
- Tax breakdown confirmation.
- Approval comment mandatory.

#### 9.7 Vendor Portal UI Requirements

A. Vendor Dashboard
- Invoice upload widget
- Status timeline:
  - Received
  - Under review
  - Awaiting approval
  - Finance review
  - Approved for payment
  - Paid

B. Vendor Update Workflow
- View-only vendor details.
- Request Change button for:
  - Bank account
  - Address
  - Contact info
- Status of vendor update requests.

C. Document Requirements Panel
- Shows missing documents required for onboarding.
- Upload panel for:
  - Certificate of incorporation
  - Tax documents
  - Bank letter
  - Identification documents

#### 9.8 Audit UI Requirements

- Read-only audit dashboard.
- Search by vendor, date, amount, GL.
- One-click audit pack export:
  - Invoice
  - PO
  - GRN
  - Approval trail
  - Tax breakdown
  - Documents
  - Beneficiaries
  - Line split history

#### 9.9 Tenant Admin UI Requirements

- Approval workflow builder (drag-and-drop).
- Vendor category rule builder.
- Dimension display toggle.
- FX rule configuration.
- Tax rule wizard.
- AI enable/disable toggles per field.
- Document requirement configurator.

#### 9.10 Super Admin UI Requirements

- Tenant list with activation status.
- Module activation toggles.
- License usage dashboard.
- Global analytics dashboard (aggregated, anonymous).
- No tenant data visibility.

#### 9.11 Mobile UI Requirements

- Optimized 1-column layout.
- Quick invoice capture using camera.
- Offline mode for expense capture.
- Mobile approval panel.

#### 9.12 Theming & White-Labeling Requirements

- Tenant custom logo.
- Tenant primary & secondary colors.
- Custom field naming.
- Custom landing page layout (!)
- ZivaBI watermark optional per tenant.

#### 9.13 Performance UI Requirements

- Invoice page load \< 2 seconds.
- AI suggestion load \< 1 second.
- Search results \< 1.5 seconds.
- Vendor dashboard load \< 2 seconds.


---

## 11. Security & Permissions Requirements

### 10 Security & Permissions Requirements (Part 1 — RBAC, Data & Fraud Controls)

This section defines the security model, permission layers, data
protection standards, and fraud-prevention mechanisms required for a
financial‑grade AP module in a multi‑tenant architecture.

#### 10.1 Multi‑Tenant Security Architecture

- Every API request must include tenant_id (server‑validated).
- All data queries automatically scoped to tenant_id.
- No cross‑tenant data exposure permitted at:
  - API level
  - Database query level
  - Cache layer
  - AI/ICE inference layer
- Tenant‑specific encryption keys may be supported for high‑security
clients.

#### 10.2 Role‑Based Access Control (RBAC)

Roles:
- Requestor
- Line Manager (LM)
- HOD
- GM
- GRN/Operations
- Finance Reviewer
- Finance Approver
- AP Manager
- Tax Officer
- Tenant Admin
- Super Admin
- Vendor (external)
- ICE Engine (system actor)
- Workflow Engine (system actor)

Rules:
- Least‑privilege access enforced.
- Role‑action mapping stored in configurable RBAC table.
- Sensitive fields (e.g., vendor bank details) hidden for all except
Finance & Tenant Admin.
- Approvers cannot edit financial coding or documents.

#### 10.3 Document Security & File Handling

- All uploads scanned for malware.
- All documents stored in encrypted storage (AES‑256).
- Signed URLs used for temporary access.
- Expiration configurable by tenant.
- Vendor uploads isolated per organization.
- Checksum used to detect tampering.

#### 10.4 Data Encryption (At Rest & In Transit)

- TLS 1.2+ for all transport.
- AES‑256 for all stored data.
- Secure hashing (SHA‑256) for sensitive identifiers.
- No plaintext passwords stored (bcrypt salted hashing).

#### 10.5 Authentication & Session Security

- JWT authentication with:
  - short‑lived access token
  - long‑lived refresh token
- Device fingerprinting for mobile app.
- Automatic logout after inactivity.
- Optional MFA for tenants.
- Vendor portal supports email‑OTP login if configured.

#### 10.6 Fraud Prevention & Invoice Integrity

System must detect:
- Duplicate invoices (number, date, amount).
- AI‑detected modified/tampered PDFs.
- Inconsistent vendor category patterns.
- Abnormal tax or amount patterns.
- Suspicious beneficiary patterns.

Finance must override any flagged item before approval.

#### 10.7 Vendor Identity Verification & Bank Account Protection

- Vendor cannot change bank details without:
  - Tenant Admin approval
  - Finance verification call or email
  - Document verification workflow
- Change detection:
  - Bank account number change triggers a high‑risk flag.
  - Name mismatch triggers additional validation.
- All changes logged in audit trail.

#### 10.8 Access Logging & Audit Trails

System must log:
- Every view of an invoice
- Every document download
- Every approval or rejection
- Every financial field modification
- Vendor data changes
- Tax rule changes
- Workflow escalations
- AI override decisions

Audit logs:
- Cannot be modified or deleted.
- Must include before_state and after_state in JSON.

#### 10.9 API Security

- All endpoints authenticated except public onboarding links.
- Rate limiting to prevent abuse.
- Throttling for high‑volume vendor uploads.
- CORS restricted per tenant domain.
- Input sanitization and validation.

#### 10.10 Permissions Matrix (High-Level)

Requestor:
  - Create invoice, respond to queries, view status.

Approvers (LM/HOD/GM):
  - Approve/reject only.

Finance Reviewer:
  - Edit GL/dimensions/tax.
  - Split lines.
  - Request beneficiaries/document corrections.

Finance Approver:
  - Final approval only.
  - Cannot modify vendor bank details.

Tenant Admin:
  - Configure workflows, tax, FX, categories.

Super Admin:
  - Manage tenants.
  - No access to financial data.

Vendor:
  - Upload invoices.
  - Track status.
  - Cannot see internal approval notes.

#### 10.11 Sensitive Actions & Mandatory MFA

MFA must be enforced for:
- Vendor bank‑detail changes.
- Tenant configuration changes.
- Workflow matrix changes.
- Tax rule changes.

#### 10.12 Data Retention & Disposal Policies

- Tenant‑configurable retention period (default 7 years).
- Automatic archival for old invoices.
- Secure purge workflows for tenants requesting deletion.

### 10 Security & Permissions Requirements (Part 2 — SOX & Vendor Portal Controls)

The AP Module must comply with enterprise-grade security practices,
financial audit standards,
and multi-tenant data segregation.

#### 10.1 Multi-Tenant Security Architecture

- Strict tenant_id enforcement on all tables.
- API layer automatically filters by tenant_id.
- No cross-tenant data visibility.
- Super Admin sees only aggregated analytics (never raw data).
- Documents isolated per-tenant in storage (S3 buckets with tenant
prefix).

#### 10.2 Authentication & Authorization

- OAuth2 / JWT authentication.
- Role-based access control (RBAC).
- Session tokens expire after configurable period.
- MFA support for high-privilege roles (Finance, Admins).
- Password rules configurable per tenant.

#### 10.3 Permissions Matrix

Roles and allowed operations:
- Requestor: create/edit invoice, upload docs.
- LM/HOD/GM: review & approve.
- Finance Reviewer: modify GL/dimensions/taxes.
- Finance Approver: finalize posting.
- Vendor: upload/view invoices.
- Auditor: read-only access.
- Tenant Admin: configure tenant settings.
- Super Admin: manage tenants, never see tenant data.

#### 10.4 Document Security

- All invoices and files stored with:
  - AES-256 encryption at rest
  - TLS 1.2+ encryption in transit
- Checksum validation to detect tampering.
- Virus scan before accepting uploaded documents.
- Expiring signed URLs for document access.

#### 10.5 Audit Trail Integrity

- Immutable audit logs.
- No delete operations allowed.
- Every API change logged with:
  - Before and after state
  - User ID
  - Timestamp
  - IP address

#### 10.6 Fraud Detection & Risk Controls

- Duplicate invoice scoring.
- Vendor bank account change verification.
- Vendor identity validation workflow.
- AI anomaly detection (future extension).

#### 10.7 Data Privacy & Compliance

- GDPR, NDPR, CCPA aligned.
- PII encrypted in DB.
- Right-to-access exportable.
- Right-to-delete anonymization support per tenant (subject to audit
retention).

#### 10.8 API Security

- Throttling and rate limiting.
- Input validation & sanitization.
- SQL injection protection via ORM.
- Webhook signature validation.
- Mandatory HTTPS.

#### 10.9 Infrastructure Security

- Containerized deployment.
- Secrets stored in encrypted vault (HashiCorp Vault).
- Automatic patching on base images.
- VPC isolation per environment (dev, qa, prod).
- WAF for web endpoints.

#### 10.10 Vendor Portal Security

- Dedicated vendor login separate from employees.
- Limited permissions.
- Vendor update workflow requires Finance verification.
- Bank account change requires:
  - Upload of bank letter
  - Call-back verification
  - Two-person Finance approval

#### 10.11 Finance Controls (SOX-Supporting Controls)

- Segregation of duties:
  - Requestor cannot approve.
  - Finance Reviewer cannot finalize posting.
  - Finance Approver cannot modify coding.
- Mandatory approval notes for rejections.
- Mandatory documentation upload for advances.

#### 10.12 Access Logging

- Full session logging.
- Document access logging.
- Field-level audit for changes to:
  - GL
  - Dimensions
  - Tax fields
  - Amount
  - Vendor banking info


---

## 12. Reporting & Analytics

### 9.0 REPORTING & ANALYTICS --- ACCOUNTS PAYABLE MODULE

The AP Reporting Engine must offer real-time, drillable, configurable,
and exportable reports covering the entire invoice lifecycle from
capture to payment.

Reports must support:

-   Multi-tenant isolation

-   Multi-currency

-   Tax reporting (WHT, VAT, Reverse VAT, Self VAT)

-   Payment cycle visibility

-   Aging

-   AP ledger reconciliation

-   Month-end close

-   Budget vs actual comparison

-   Duplicate invoice detection

-   Advance settlement visibility

-   Vendor performance analysis

-   Approver performance analysis

Reports must be accessible by:

● Finance

● CFO

● Procurement

● Tax/Compliance

● Auditor

● Super Admin (platform-wide view)

● Tenant Admin

#### 9.1 AP DASHBOARDS (REAL-TIME)

The system must provide pre-built dashboards with real-time metrics.

##### 9.1.1 AP Executive Dashboard

#### KPIs:

-   Total AP Liabilities

-   Total Approved but Unpaid

-   Total Paid This Month

-   Aging Summary (0--30, 31--60, 61--90, 90+)

-   Top 10 Vendors by Outstanding Amount

-   Top 10 Overdue Invoices

-   FX Exposure Summary

-   Budget vs Actual (invoice actuals)

-   Tax Payable (WHT, VAT, Reverse VAT) Summary

-   Number of invoices in:

    -   Workflow

    -   Clarification

    -   On Hold

    -   Exception Queue

##### 9.1.2 Finance Operational Dashboard

#### KPIs:

-   Daily invoice inflow

-   Daily processing rate

-   Average processing time

-   SLA compliance %

- % of invoices pending per stage

-   Duplicate invoices flagged

- % of invoices waiting for PO/GRN match

-   High-risk vendor invoices

- % of invoices stuck in exception queues

-   Payment batches pending

-   ERP posting failures

##### 9.1.3 Procurement Dashboard

-   PO/Invoice Match Rate

-   GRN/Invoice Match Variances

-   Vendor Category Spend Distribution

-   Delayed GRNs

-   Vendor Delivery Reliability Score

-   Services vs Goods invoice split

-   Event Agency Budget vs Actual

##### 9.1.4 CFO / Executive Finance Dashboard

-   Total AP Outstanding

-   Cash Requirement Forecast

-   Expected Payment Outflow (next 7/14/30 days)

-   WHT due this month

-   VAT due this month

-   FX exposure

-   Largest 20 invoices pending payment

-   Vendor concentration risk

#### 9.2 AP CORE REPORTS (STANDARD)

All reports must allow:

-   Filtering

-   Sorting

-   Column selection

-   Drill-down

-   Export (Excel, CSV, PDF)

-   Scheduling (daily/weekly/monthly)

##### 9.2.1 Aging Report (AP)

Breakdown by:

-   Vendor

-   Invoice

-   Currency

-   Purchase Category

-   Department

Buckets:

-   0--15

-   16--30

-   31--45

-   46--60

-   61--90

-   90

Special:

✔ Multi-currency aging with base-currency normalization

✔ FX impact column

##### 9.2.2 AP Ledger Report

Mirrors ERP vendor ledger:

-   Opening balance

-   Invoices

-   Payments

-   Adjustments

-   Credits

-   Closing balance

Reconciliation ready.

##### 9.2.3 Pending Invoice Report

Shows:

-   In workflow

-   Waiting for PO/GRN

-   Waiting for Finance Pre-Check

-   Waiting for Finance Final

-   Waiting for CFO

-   On-hold invoices (e.g., vendor disputes)

##### 9.2.4 High-Risk Invoice Report

Based on:

-   Vendor risk score

-   Invoice fraud score

-   Document mismatch

-   Suspicious patterns

-   Duplicate detection

##### 9.2.5 Duplicate Invoice Report

For detecting:

-   Same invoice number

-   Same vendor

-   Same date + amount

-   OCR similarity \> threshold

-   Image hash match

Must show:

-   Reason for duplication

-   System recommendation

-   Action taken

#### 9.3 TAX REPORTS

##### 9.3.1 Withholding Tax (WHT) Schedule

Columns:

-   Vendor

-   Invoice

-   WHT rate

-   WHT base

-   WHT amount

-   Jurisdiction

-   Date deducted

-   Date payable

-   Ledger account

Special rules:

-   Event Agencies → WHT only on Agency Fee

-   Clearing Agent → WHT only on service component

-   Insurance → No WHT

##### 9.3.2 VAT Schedule

Includes:

-   Input VAT

-   Self-accounted VAT (WVAT)

-   Reverse VAT

-   VAT exempt invoices

-   VAT base vs vendor VAT amount

-   VAT discrepancies

#### 9.4 PAYMENT REPORTS

##### 9.4.1 Payment Due Report

Shows invoices due in:

-   0--7 days

-   8--14 days

-   15--30 days

-   30

##### 9.4.2 Payment Batch Report

Shows:

-   Batch code

-   Vendor payments inside batch

-   Total value

-   Currency

-   Batch status

-   CFO approval

-   Bank upload file

-   Success/failure breakdown

##### 9.4.3 Payment Reconciliation Report

Compares:

-   Scheduled payments

-   Bank successful payments

-   Payment failures

-   Reasons for failure

#### 9.5 ADVANCE & SETTLEMENT REPORTS

##### 9.5.1 Vendor Advance Outstanding Report

Shows:

-   Vendor

-   Advance amount

-   WHT deducted

-   VAT (if any)

-   Remaining balance

-   Linked invoices

-   Unsettled variance

##### 9.5.2 Advance Settlement Reconciliation Report

Highlights:

-   Advances applied

-   WHT adjustments

-   VAT adjustments

-   Overpayment/underpayment

-   Final settlement amount

#### 9.6 PO/GRN MATCHING REPORTS

##### 9.6.1 PO/Invoice Variance Report

-   Price variance

-   Quantity variance

-   Description variance

-   Missing PO lines

##### 9.6.2 GRN/Invoice Variance Report

-   GRN shortfall

-   Over-receipt

-   Unmatched GRNs

#### 9.7 WORKFLOW PERFORMANCE REPORTS

##### 9.7.1 Approval SLA Report

Shows stage-wise delays:

-   Requestor

-   LM

-   HOD

-   GM

-   Procurement

-   Finance Pre-check

-   Finance Final

-   CFO

Includes:

-   SLA breach count

-   SLA breach owner

-   SLA breach duration

##### 9.7.2 Clarification Loop Report

Shows:

-   Number of clarifications

-   Time taken

-   User responsiveness

-   Repetition patterns

#### 9.8 AUDIT REPORTS

##### 9.8.1 Audit Trail Export

Includes:

-   Every action performed

-   User

-   Timestamp

-   Old values

-   New values

-   Reason

-   Attachments

Filters:

-   Date range

-   Vendor

-   Invoice

-   User

-   Action type

##### 9.8.2 Compliance Exception Report

-   Tax overrides

-   GL overrides

-   Dimension overrides

-   Policy breaches

-   Variance tolerance violations

-   Non-resident vendor issues

#### 9.9 ANALYTICAL INSIGHTS (AI-ASSISTED)

**AI Insight 1:**

 **Predicted Delayed Invoices**

Uses historical approval timing.

**AI Insight 2:**

 **Fraud Pattern Detection**

Detects suspicious sequential invoices, timing anomalies, etc.

**AI Insight 3:**

 **Vendor Performance Insights**

Which vendors cause the most exceptions.

**AI Insight 4:**

 **Budget Consumption Trends**

Predicts when a budget will be exhausted based on invoice patterns.

### Additional Reporting (Draft B)

### 12 Reporting & Analytics Requirements

This section defines all reporting, analytics, dashboards, exports, and
insights required for the ZivaBI AP module.
Sample mock tables and illustrative report layouts are included for
clarity.

#### 12.1 AP Aging Report (With Mock Table)

Purpose:
- Provide visibility of outstanding vendor payables by aging bucket.

Mock Report Table:

Vendor \| Invoice No \| Amount (NGN) \| 0--30 Days \| 31--60 Days \|
61--90 Days \| 91+ Days
--------------\|------------\|--------------\|-----------\|------------\|------------\|---------
EventByClaud \| INV-2025-44\| 450,000 \| 450,000 \| 0 \| 0 \| 0
GMT Logistics \| CLR-11102 \| 5,200,000 \| 0 \| 5,200,000 \| 0 \| 0
EY Nigeria \| AUD-2025-5 \| 2,100,000 \| 0 \| 0 \| 2,100,000 \| 0

Functional Requirements:
- Filter by date range, vendor, department, approver.
- Drill-down to invoice details.
- Export: Excel, CSV, PDF, API feed.

#### 12.2 Vendor Spend Analytics (With Mock Graph Description)

Purpose:
- Analyze vendor spending trends to support financial planning.

Mock Dashboard Snapshot:
- Bar chart: Spend by Vendor (Top 10)
- Pie chart: Spend by Category (Event, Logistics, Consulting, Rent)
- Line chart: Month-over-Month Vendor Spend

Key Metrics:
- Total spend per vendor.
- Spend per cost center.
- Spend per internal order.
- Year-over-year vendor growth.

#### 12.3 Tax Reporting (WHT, VAT, Reverse VAT)

Purpose:
- Enable compliance with tax remittance.

Mock WHT Report:

Vendor \| Invoice No \| Base Amount \| WHT Rate \| WHT Amount \|
Remittance Date
--------------\|------------\|-------------\|----------\|------------\|------------------
EventByClaud \| EVT-2201 \| 300,000 \| 5% \| 15,000 \| Pending
EY Nigeria \| AUD-11001 \| 2,000,000 \| 10% \| 200,000 \| Pending

Capabilities:
- WHT payable summary.
- VAT input/output analysis.
- Reverse VAT summary.
- Export-ready tax schedules.

#### 12.4 Budget vs Actual Reports (AP Alignment With Event Budgets)

Purpose:
- Track event/project expenditures against approved budgets.

Mock Table:

Project/Event \| Budget (NGN) \| Actual (NGN) \| Variance \| Variance %
--------------\|--------------\|--------------\|----------\|------------
Concert 2025 \| 12,000,000 \| 11,200,000 \| 800,000 \| +6.7%
Roadshow \| 4,000,000 \| 4,750,000 \| -750,000 \| -18.7%

Features:
- Drill-down to invoice lines.
- Budget threshold alerts.

#### 12.5 Approval SLA Performance

Purpose:
- Monitor efficiency of approvers.

Mock Metrics:
- Avg LM approval time: 1.2 days
- Avg HOD approval time: 0.8 days
- Avg GM approval time: 2.1 days
- Avg Finance Review time: 0.9 days

Dashboard Elements:
- SLA heatmap by department.
- Delay identification.
- Approver performance ranking.

#### 12.6 Duplicate Invoice Risk Report

Purpose:
- Identify high-risk duplicate entries.

Mock Risk Output:
Invoice No \| Vendor \| Amount \| Risk Score \| Duplicate Candidate
-----------\|---------------\|--------\|------------\|---------------------
15501 \| GMT Logistics \| 950,000\| 0.92 \| clr-15501.pdf

#### 12.7 Finance Operations Report

Metrics:
- Avg processing time.
- Count of split lines.
- Beneficiary requests.
- Finance adjustments per invoice.
- Rejection reasons analysis.

#### 12.8 GRN & PO Compliance Report

Purpose:
- Detect compliance gaps.

Mock Overview:
- PO compliance: 92%
- GRN compliance: 81%
- GRN missing for: 33 invoices
- Over-PO invoices: 12

#### 12.9 Audit Reporting Suite

Reports:
- Missing support docs.
- Missing approvals.
- Non-compliant vendor category assignments.
- Audit pack download logs.

#### 12.10 ICE AI Reports

Metrics:
- GL prediction accuracy.
- Dimensions prediction accuracy.
- AI acceptance rate.
- Override rate.
- AI drift over time.

#### 12.11 Export Formats

- Excel (.xlsx)
- CSV
- PDF
- JSON for API integration
- BI connectors

#### 12.12 Super Admin Analytics

- Tenant module usage statistics.
- System performance KPIs.
- Aggregated (non-tenant specific) AI metrics.


---

## 13. Non-Functional Requirements (NFRs)

### 10.0 NON-FUNCTIONAL REQUIREMENTS (NFRs) --- ACCOUNTS PAYABLE MODULE

The Accounts Payable (AP) Module must meet stringent enterprise
standards for:

-   Performance

-   Scalability

-   Availability

-   Reliability

-   Security

-   Data protection & privacy

-   Multi-tenant isolation

-   Observability

-   Compliance

-   Disaster recovery

-   Maintainability

The AP module processes financial transactions that directly affect the
general ledger, vendor balances, WHT/VAT liabilities, and cash outflows
  - therefore NFRs must be exceptionally strong.

#### 10.1 PERFORMANCE REQUIREMENTS

#### 10.1.1 API Performance

-   Standard APIs must respond in \< 800ms.

-   Document-related APIs: \< 2.5 seconds.

-   OCR pipeline initiation: \< 2 seconds.

-   Workflow advancement APIs: \< 600ms.

-   ERP posting API: \< 3 seconds (excluding ERP latency).

#### 10.1.2 UI Performance

-   AP dashboard load time: \< 3 seconds.

-   Invoice summary load time: \< 1.5 seconds.

-   Switching between line items: \< 300ms.

#### 10.1.3 Bulk Processing

AP must handle bulk actions without degradation:

-   Payment batch generation (100--10,000 invoices) \< 10 seconds

-   ERP posting for 1,000 invoices \< 60 seconds

-   Mass PDF export \< 20 seconds

#### 10.2 SCALABILITY REQUIREMENTS

#### 10.2.1 Horizontal Scaling

AP module must scale horizontally for:

-   Invoice spikes (month-end, year-end, procurement campaigns)

-   Multiple tenants processing AP concurrently

-   High volume of OCR requests

#### 10.2.2 Tenant Scalability

Support:

-   10,000+ tenants

-   50 million+ total invoices

-   1M invoices per tenant per year

-   Unlimited document attachments

#### 10.2.3 Background Job Scaling

OCR, ERP posting, payment batch creation must autoscale using job
queues.

#### 10.3 AVAILABILITY REQUIREMENTS

#### 10.3.1 Uptime

-   99.9% uptime SLA

-   No downtime during deployment (blue-green or rolling updates)

#### 10.3.2 Redundancy

-   Multi-zone failover for job processors

-   Multi-zone document storage redundancy

#### 10.4 RELIABILITY REQUIREMENTS

#### 10.4.1 Retry Logic

For:

-   Payment batch generation

-   Workflow advancement

-   OCR failures

-   ERP posting failures

Retries use exponential backoff.

#### 10.4.2 Queue Durability

Job queues must preserve tasks through system restarts.

#### 10.4.3 Event Consistency

-   Strong consistency for financial data

-   Eventual consistency acceptable for dashboards

#### 10.5 SECURITY REQUIREMENTS

Security is paramount due to financial sensitivity.

#### 10.5.1 Authentication

-   OAuth2 / OpenID Connect

-   MFA optional per tenant

-   SSO for enterprise customers

#### 10.5.2 Authorization

Role-based access (RBAC) and fine-grained permission layers:

-   Requestor

-   Approver

-   Procurement

-   Finance Pre-Check

-   Finance Final

-   Tax Officer

-   CFO

-   Tenant Admin

-   Super Admin

Access must be scoped to:

-   Tenant

-   Department (if enabled)

-   Role

-   Approval rights

#### 10.5.3 Encryption

-   TLS 1.2+ for all in-transit data

-   AES-256 for data at rest

-   Encrypted document storage

-   Key rotation via cloud KMS

#### 10.5.4 Financial Data Hardening

The system must protect:

-   Vendor bank details

-   Invoice amounts

-   Payment batches

-   WHT/VAT calculations

-   Accounting entries

Access restricted to specific roles only.

#### 10.5.5 Audit Protection

All audit logs must be immutable.

#### 10.6 DATA PRIVACY REQUIREMENTS

#### 10.6.1 PII Protection

Sensitive vendor details must be masked for non-finance users.

#### 10.6.2 Data Residency

Tenant may select data region.

#### 10.6.3 Document Retention

Tenant defines:

-   7 years

-   10 years

-   Or custom retention

System automatically archives older documents.

#### 10.7 MULTI-TENANCY ISOLATION REQUIREMENTS

AP MUST maintain strict isolation between tenants.

#### 10.7.1 Hard isolation

Each tenant MUST have isolated:

-   Invoice data

-   Vendor master view

-   WHT/VAT rules

-   Multi-currency settings

-   Payment runs

-   Documents

-   Audit logs

-   Workflows

-   ERP integration flows

#### 10.7.2 Document Isolation

Documents stored in tenant-scoped buckets:

/tenants/{tenant_id}/ap/documents/...

#### 10.7.3 Performance Isolation

A heavy tenant's workload must not affect others.

#### 10.8 OBSERVABILITY REQUIREMENTS

#### 10.8.1 Logging

AP module must log:

-   API calls

-   Workflow transitions

-   Tax rule application

-   ERP posting events

-   OCR outcomes

-   Suspicious invoice detections

-   Approvals & rejections

#### 10.8.2 Monitoring

Provide:

-   API latency monitor

-   Job queue monitor

-   OCR failure monitor

-   ERP posting monitor

-   Invoice intake monitor

#### 10.8.3 Alerts

Alerts for:

-   ERP posting failures

-   Duplicate invoices

-   Workflow delays

-   SLA breaches

-   Missing documents

-   Tax calculation failures

-   Payment run failures

#### 10.9 COMPLIANCE REQUIREMENTS

The AP module must comply with:

-   IFRS

-   GAAP (US / UK)

-   GDPR (EU)

-   NDPR (Nigeria)

-   CCPA (California)

-   Local tax laws per tenant jurisdiction

-   SOX (if tenant requires)

-   Anti-corruption and anti-fraud policies

Audit trails must satisfy:

-   External auditors

-   Internal auditors

-   Regulatory audits

#### 10.10 DISASTER RECOVERY REQUIREMENTS

#### 10.10.1 Backup

-   Nightly full backups

-   15-minute incremental backups

-   Tenant-level backup and restore

#### 10.10.2 Recovery Objectives

-   RTO: 4 hours

-   RPO: 15 minutes

#### 10.10.3 Multi-Zone Redundancy

All critical systems must support cross-zone redundancy.

#### 10.11 MAINTAINABILITY REQUIREMENTS

#### 10.11.1 Code Quality Standards

-   Modular architecture

-   Clear separation of concerns

-   Linting enforced

-   Automated tests

-   API contract-first development

#### 10.11.2 Configuration Driven Architecture

Most AP behaviors must be configurable without code changes:

-   Approval levels

-   Tax rules

-   Vendor rules

-   PO/GRN rules

-   FX rules

-   Tolerance levels

-   Dimension applicability

-   Document requirements

#### 10.11.3 Documentation

-   API documentation

-   User guides

-   Admin configuration guides

-   Developer onboarding

### Additional NFRs (Draft B)

### 13 Non-Functional Requirements (NFRs)

This section defines the non-functional requirements (NFRs) essential
for ensuring that the AP Module
operates with enterprise-grade reliability, security, scalability, and
performance.

#### 13.1 Performance Requirements

- Page load time for invoice screens: \< 2 seconds.
- API response time (95th percentile): \< 800 ms.
- AI suggestion computation: \< 1 second.
- Bulk invoice upload processing: \< 10 seconds for 100 invoices.
- OCR extraction time: \< 2 seconds per page.
- Search queries: \< 1.5 seconds.

#### 13.2 Scalability Requirements

- Horizontal scaling of:
  - API servers
  - AI inference servers
  - OCR worker nodes
  - Workflow engine
- Support for 10,000+ invoices per minute.
- Auto-scaling policies based on load.

#### 13.3 Availability & Reliability

- Uptime SLA: 99.9%
- Multi-region redundancy.
- Automatic failover.
- Graceful degradation during partial outages.
- Zero data loss in case of system restart.

#### 13.4 Maintainability Requirements

- Code must follow modular architecture.
- Feature toggles for tenant-specific settings.
- Centralized logging with:
  - Request logs
  - Error logs
  - Audit logs
- Self-healing worker processes for OCR/AI tasks.

#### 13.5 Observability Requirements

Metrics:
- API latency
- AI accuracy
- Duplicate detection triggers
- Workflow bottlenecks
- Document upload errors

Logs:
- Structured logs with JSON
- Retraceable audit logs

Traces:
- Distributed tracing for multi-service workflows.

#### 13.6 Security Requirements (Extended)

- Zero-trust architecture.
- Mandatory MFA for Finance and Admins.
- PII encryption at rest and in transit.
- Rate limiting to prevent DDoS.
- WAF-enabled API gateway.

#### 13.7 Disaster Recovery (DR)

- Daily backups.
- Hourly incremental backups.
- RPO (Recovery Point Objective): 15 minutes.
- RTO (Recovery Time Objective): 30 minutes.
- Cross-region backup replication.

#### 13.8 Compliance Requirements

- GDPR & NDPR compliance.
- SOX Section 404 internal control support.
- ISO 27001-aligned processes.
- Secure audit log retention (minimum 7 years, tenant configurable).

#### 13.9 Usability Requirements

- Mobile-first responsive design.
- Accessible for visually impaired users (WCAG AA).
- Clear iconography and tooltips.
- Multi-language support.

#### 13.10 Localization Requirements

- Configurable date formats.
- Local currency formats.
- Time zone aware workflows.
- Local tax rules configurable per tenant.

#### 13.11 Extensibility Requirements

- Support for plugins (future).
- Ability to add new vendor categories.
- Ability to add new tax rules without code changes.
- AI model upgrades without downtime.

#### 13.12 Interoperability Requirements

- Works with multiple ERPs (SAP, Oracle, Dynamics, Netsuite, Sage X3,
Odoo).
- Standard REST API contract.
- Standard import/export formats.

#### 13.13 Environmental Requirements

- System must operate in:
  - Dev
  - QA
  - UAT
  - Production
- Versioned deployments with rollback support.


---

## 14. Integration Requirements

### 11.0 INTEGRATION REQUIREMENTS --- ACCOUNTS PAYABLE (AP) MODULE

The Accounts Payable module must integrate cleanly with:

#### Internal ZivaBI Modules

-   Vendor Onboarding

-   Procurement / PO Management

-   GRN & Inventory

-   Expense & Travel Advances

-   Workflow Engine

-   Tax Engine

-   Budget Engine

-   Document Engine

-   OCR Engine

-   Notification Engine

-   Audit Engine

#### External Systems

-   ERP Systems (SAP, Oracle, Sage X3, MS Dynamics, NetSuite,
    QuickBooks, etc.)

-   Banking Platforms

-   Tax Authorities (optional future)

-   Identity/SSO Providers

The AP Module must use a modular, API-driven, multi-tenant architecture
supporting two-way sync where necessary.

#### 11.1 Integration With Vendor Onboarding Module

AP consumes vendor data from Vendor Onboarding.

#### AP Must Retrieve:

-   Vendor ID

-   Vendor category

-   Vendor type (full, one-time, expense-only, 3PL, clearing agent,
    non-resident, etc.)

-   Tax profile (VAT, WHT rules)

-   Bank account details

-   Vendor risk score

-   Vendor document status

-   Vendor suspension / active status

#### Integration Rules:

1.  Invoice cannot be submitted if vendor is not Active.

2.  Vendor category determines AP logic, including tax, workflow,
    documents, advance handling.

3.  Vendor banking updates flow into AP payment engine.

4.  Document expiry prevents invoice processing (e.g., expired tax
    certificate).

#### 11.2 Integration With Procurement Module (PO/PR)

AP must pull procurement data for:

-   Purchase Orders (POs)

-   PO Lines

-   Budget owners

-   Contract references (if any)

-   Approval trail of PO

#### Integration Functions:

-   Fetch PO details for 2-way/3-way matching

-   Validate PO status (Open, Partially Received, Closed)

-   Retrieve PO amount and tolerance rules

-   Fetch PO currency

-   Map PO GL / dimension to AP GL / dimension

-   Validate vendor consistency

-   Block invoice if PO is cancelled

#### 11.3 Integration With GRN / Inventory Module

For 3-way matching, AP must retrieve:

-   GRN header

-   GRN lines

-   Received quantity

-   Accepted quantity

-   Damaged/short quantity

-   Receiving timestamps

-   Receiving officer details

GRN integration is required for:

-   Inventory purchases

-   Clearing agent invoices linked to importation

-   3PL delivery confirmations

-   POSM & asset receipts

#### Integration Rules:

-   Invoice cannot be finalized if GRN mismatch \> allowed tolerance.

-   GRN changes after invoice approval trigger AP re-validation.

#### 11.4 Integration With ERP Systems

The AP module must integrate with any ERP using:

-   REST API

-   SOAP (legacy ERPs)

-   SFTP (file-based integrations)

-   Webhooks

Supported ERPs:

-   SAP ECC / S/4HANA

-   Sage X3

-   Microsoft Dynamics 365 / AX

-   Oracle Fusion Cloud

-   NetSuite

-   QuickBooks

#### Data Pushed to ERP:

-   GL Journal Entries

-   Vendor Ledger Entries

-   WHT Payable

-   VAT Input / Reverse / Self VAT

-   Advance Adjustments

-   FX Differences

-   Payment Confirmation

#### Data Pulled From ERP:

-   Chart of Accounts

-   Dimensions (IO, cost center, department)

-   Vendor master updates (if dual-master mode)

-   Exchange rates (optional)

-   Vendor balances (optional)

#### Important:

POSTING TO ERP MUST ONLY HAPPEN AFTER FINANCE FINAL APPROVAL.

#### 11.5 Integration With Expense & Travel Advance Module

Integration scenarios:

#### 1. Employee Advance → Vendor Invoice

If expense advance is settled using vendor invoice, AP must:

-   Fetch advance balance

-   Apply advance

-   Adjust VAT/WHT

-   Update advance ledger

#### 2. Vendor Advance → Vendor Final Invoice

AP pulls advance settlement data from the Advance Module:

-   WHT deducted on advance

-   VAT on advance

-   Outstanding amount

-   Advance-to-budget mapping (Event Agencies)

#### 11.6 Integration With Tax Engine

AP relies entirely on the tax engine for:

-   VAT calculation

-   Reverse VAT

-   Self-account VAT

-   WHT rate selection

-   WHT base calculation (gross, net-of-VAT, agency-fee-only,
    service-only, etc.)

-   Non-resident vendor tax rules

#### Required Integrations:

-   Real-time tax rule fetch

-   Real-time tax computation API

-   WHT/VAT posting sync to ERP

#### 11.7 Integration With Budget Engine

The AP module needs:

-   Budget lines per GL + IO

-   Yearly budget amounts

-   Revised budgets (FRE, SRE)

-   Real-time budget consumption

#### Integration Rules:

-   System must validate budget before approval.

-   Over-budget invoices must follow tenant-defined escalation pathway.

-   Event Agency invoices must map invoice lines to budget lines.

#### 11.8 Integration With Workflow Engine

The workflow engine must control each AP stage:

-   Requestor submission

-   Multi-level approvals

-   Clarification flows

-   Rejection flows

-   Delegation flows

-   Escalation flows

-   SLA tracking

AP triggers the workflow engine using events:

-   Invoice.Submitted

-   Invoice.RequiresClarification

-   Invoice.ApprovedByLM

-   Invoice.ApprovedByFinancePreCheck

-   Invoice.FinalApproved

-   Invoice.Rejected

-   Invoice.Suspended

The workflow engine pushes results back to AP.

#### 11.9 Integration With OCR Engine

OCR Engine extracts:

-   Invoice number

-   Invoice date

-   Currency

-   Amount

-   Line items

-   Vendor name

-   Tax amounts

-   Tax identifiers

-   Bank information (optional)

#### OCR Integration Features:

-   Confidence scoring

-   OCR vs user input mismatch detection

-   Auto-line mapping

-   Auto-classification

If OCR confidence \< threshold → manual review.

#### 11.10 Integration With Document Engine

Document engine handles:

-   File storage

-   Versioning

-   Metadata management

-   Previews

-   Compression

-   Virus scanning

-   Document-to-line linking

All supporting docs (PO, GRN, invoice, advance docs, budget, POD,
customs docs) are stored here.

#### 11.11 Integration With Notification Engine

Notifications for:

-   Invoice submission

-   Invoice approval

-   Clarification requests

-   Rejection

-   PO/GRN mismatch

-   Duplicate invoice detected

-   Payment scheduled

-   Payment completed

-   ERP posting success/failure

-   Tax override warnings

-   High-risk invoice alerts

Channels:

-   Email

-   Mobile push

-   In-app

-   Webhooks (tenant integration)

#### 11.12 Integration With Banking Platforms

AP must integrate with bank systems via:

-   Bank upload templates

-   API (future/tenant-specific)

-   Manual approval screens

Payment batches include:

-   Vendor name

-   Vendor bank account

-   Net payable

-   Currency

-   Payment description

-   Unique reference

Bank integration must support:

-   NGN local transfers

-   FX payments

-   Bulk uploads

-   Payment result reconciliation

#### 11.13 Integration With 3PL / Logistics Module (Future)

For vendors who:

-   Deliver goods to customers

-   Provide POD

-   Perform warehouse operations

AP must retrieve:

-   Delivery confirmation

-   SLA metrics

-   Route details

-   POD files

-   Amounts payable per SLA

This prevents AP from paying 3PL without proof of service.

#### 11.14 Integration With Fixed Asset Module (Future)

For invoices relating to assets:

-   Engine must identify asset-related GLs

-   Route invoice to Asset module

-   Allow asset creation

-   Allocate clearing cost (import)

-   Calculate capitalization rules

#### 11.15 Integration With AI Engine (Future)

AP should incorporate:

-   AI line item classification

-   GL/dimension suggestion

-   Duplicate invoice prediction

-   Fraud scoring

-   Aging predictions

-   Anomaly detection

All AI events go through internal ML microservice.

### Additional Integration Notes (Draft B)

### 11 Integration Requirements

This section outlines all integration points needed for the ZivaBI
Accounts Payable (AP) Module to exchange data with ERPs,
authentication systems, tax engines, FX rate providers, document
platforms, and other enterprise systems.

#### 11.1 ERP Integration (SAP, Oracle, Dynamics, Netsuite, Odoo)

The AP module must support export and API-based integration with major
ERPs.

Integration Modes:
- File-based export (CSV, XML, JSON)
- REST API push
- Scheduled batch sync
- Event-driven posting

ERP Posting Packet Includes:
- Invoice Header
- Invoice Lines (GL, Dimensions)
- WHT/VAT records
- FX rate applied
- PO/GRN references
- Vendor ID
- Audit trail ID

#### 11.2 Procurement / PO System Integration

- Sync PO data (header + lines)
- Sync GRN confirmations
- Validate PO balance
- Support for procurement system webhooks (PO updates)

#### 11.3 Authentication Integration (SSO / IAM)

- SAML SSO
- Azure AD integration
- Okta support
- SCIM provisioning for user sync

#### 11.4 Document Storage Integration

Support for:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage

Features:
- Signed URLs
- Versioning
- Checksum validation

#### 11.5 FX Rate Provider Integration

Supported FX providers:
- CBN
- ECB
- Tenant custom API

Mode:
- Daily rate fetch
- On-demand fetch
- Rate history logging

#### 11.6 Tax Engine Integration (Optional)

- External tax engines (e.g., Avalara)
- Local regulatory endpoints
- Tenant-configurable tax API mapping

#### 11.7 Payment Provider Integration (Future)

- Bank APIs (NIBSS, SWIFT, ACH)
- Payment gateways
- Treasury systems

#### 11.8 Notification System Integration

- Email via SMTP or provider API
- SMS providers
- In-app notifications
- Vendor portal alerts

#### 11.9 BI & Analytics Integration

- Export to BI tools (Power BI, Tableau)
- Scheduled data snapshot
- Real-time event stream (future)
- Warehouse sync via ETL connector

#### 11.10 Webhooks & Event Architecture

Outbound events:
- invoice.created
- invoice.updated
- invoice.approved
- invoice.paid
- vendor.updated

Features:
- Retry logic
- Dead-letter queue
- Webhook signing

#### 11.11 GRN/Warehouse App Integration

- Mobile warehouse GRN app
- Delivery confirmation workflow
- Sync delivery photos/docs


---

## 15. Vendor Category-Specific AP Logic

### 12.0 VENDOR CATEGORY--SPECIFIC ACCOUNTS PAYABLE LOGIC

Each vendor category requires different rules and handling based on:

-   Nature of the cost

-   Tax regulations (WHT/VAT)

-   Documentation requirements

-   Settlement patterns

-   Delivery confirmation

-   Budget vs actual linkage

-   PO/GRN necessity

-   Advance rules

-   FX rules

ZivaBI MUST automatically apply these distinctions.

Below are the categories with full enterprise logic.

#### 12.1 EVENT AGENCY AP LOGIC

(Your real scenario --- extremely complex & unique)

Event Agencies issue invoices that contain two (2) components:

#### A. Reimbursables

Examples:

-   Venue cost

-   Catering

-   Hotel bookings

-   Transportation

-   Décor

-   Artists

-   Printing

-   Logistics

-   Subcontractors

#### B. Agency Fee

This is the only component subject to WHT.

##### 12.1.1 Required Documents

-   Event budget (mandatory)

-   Approved PO (if tenant requires)

-   Vendor invoice

-   Reimbursable supporting documents (mandatory)

-   Proof of delivery (photos/videos/attendance sheet)

-   Contract/retainer (if applicable)

##### 12.1.2 Budget Mapping Logic

Each invoice line must map to a line in the event budget.

Rules:

1.  Reimbursable line → corresponding budget line

2.  Agency fee → agency fee budget line

3.  No mapping = system blocks invoice

4.  Budget cannot be exceeded unless:

    -   Tenant allows

    -   HOD/GM approves exception

##### 12.1.3 Tax Rules

#### VAT

Applies to entire invoice amount

unless VAT-exempt items are present.

#### WHT

Applies ONLY to the agency fee, not reimbursables.

Formula:

WHT = Agency Fee × Rate

If advance was taken earlier:

-   Adjust WHT based on advance-deducted WHT

##### 12.1.4 Advance Settlement Logic

Event Agencies often receive 20%--30% advance.

Rules:

1.  Advance links to event budget

2.  Reimbursable actual cost must be supported

3.  Advance is applied per budget line

4.  WHT on advance must be carried over

5.  Advance + invoice actual must reconcile fully

If vendor under-spent:

-   System computes refund owed

-   Refund owed passed to AR module OR deducted from next invoice

##### 12.1.5 Workflow

Approval route must include:

-   HOD

-   GM

-   Procurement (optional)

-   Finance Pre-check

-   Tax Officer (optional)

-   Finance Final

#### 12.2 CLEARING AGENT AP LOGIC

(Critical for your importation workflows --- includes VAT/duty
integration)

Clearing agent invoices are tied to import shipments, and contain:

-   Customs duty

-   VAT on customs

-   Terminal fees

-   Shipping line fees

-   Logistics fees

-   Agency service fee

##### 12.2.1 Required Documents

-   Proforma Invoice (IC vendor)

-   Final Commercial Invoice

-   Form M

-   PAAR (Pre-Arrival Assessment Report)

-   Final Customs Assessment

-   Terminal receipts

-   Clearing invoice

-   Delivery note

System MUST validate these.

##### 12.2.2 Tax Rules

#### VAT

Customs VAT → posted as Input VAT on Importation

Terminal VAT → posted to Input VAT (local)

Where vendor charges VAT incorrectly → WVAT applies

#### WHT

Applies only to clearing agent's service component

NOT to:

-   Customs duty

-   VAT on customs

-   Terminal fees

##### 12.2.3 Advance Settlement Logic (Your exact scenario)

Steps:

1.  Advance invoice posted to Finished Goods Prepayment or POSM
    Prepayment

2.  Prepayment reversed when final customs assessment received

3.  VAT from customs assessment posted to Input VAT

4.  Price difference posted to:

    -   Price Variance account (for goods)

    -   Asset prepayment (for POSM equipment)

5.  Final invoice settlement adjusts:

    -   WHT difference

    -   Advance applied

    -   Variances

System auto-calculates EVERYTHING.

##### 12.2.4 PO/GRN Logic

-   Clearing Agent PO may be optional (tenant-defined)

-   PO ties to container/invoice number

-   GRN ties to arrival or warehouse receipt

#### 12.3 3PL / LOGISTICS VENDOR AP LOGIC

Applies to:

-   Warehousing companies

-   Delivery companies

-   Transportation partners

-   Outsourced distribution teams

##### 12.3.1 Required Documents

-   Proof of Delivery (POD)

-   Route sheets

-   Weight/volume metrics

-   SLA compliance logs

##### 12.3.2 Billing Models Supported

-   Per carton

-   Per trip

-   Per tonnage

-   SLA penalties

-   Fixed monthly retainer

-   Ad-hoc charges

-   Success-based fees

##### 12.3.3 Tax Rules

-   WHT applies to service component only

-   VAT applies normally

##### 12.3.4 Workflow Requirements

-   Operations must confirm delivery

-   POD must be attached

-   SLA scoring must be computed

-   Incorrect POD → invoice goes to "Delivery Exception Queue"

#### 12.4 PROFESSIONAL SERVICES AP LOGIC

Vendors include:

-   Auditors

-   Consultants

-   Accounting firms

-   Lawyers

-   Outsourced professionals

##### 12.4.1 Required Documents

-   Contract / engagement letter

-   Vendor invoice

-   Project deliverables (optional)

##### 12.4.2 Tax Rules

-   WHT applies to professional service fee

-   VAT applies normally

-   Reimbursables are VAT only (no WHT)

#### 12.5 RENT / LEASE VENDORS

Includes:

-   Property rent

-   Equipment rent

-   Fleet lease

##### 12.5.1 Tax Rules

-   VAT often exempt (jurisdiction-dependent)

-   WHT applicable to rent (Nigeria)

System must support country-specific configurations.

#### 12.6 INSURANCE VENDORS

#### NO WHT

for insurance premiums.

VAT depends on jurisdiction.

#### 12.7 NON-RESIDENT (FOREIGN) VENDORS

Foreign vendors require special AP logic:

#### 12.7.1 Tax Rules

-   WHT applies at non-resident rate

-   Reverse VAT may apply

-   VAT may not be charged on invoice

-   System must self-account if applicable

#### 12.7.2 FX Rules

-   FX must follow tenant FX policy

-   Monthly revaluation (unrealized FX)

-   Realized FX recognized at payment

#### 12.7.3 Compliance Requirements

-   Residency certificate

-   Withholding tax certificate

-   Contract

-   SOW (statement of work)

#### 12.8 EXPENSE-ONLY VENDORS

Used ONLY for employee reimbursement flows.

Rules:

-   No PO

-   No GRN

-   No vendor banking required

-   No WHT (for employee reimbursements)

-   Finance-only review

-   Cannot be used in standard AP payments

#### 12.9 ONE-TIME / ONE-OFF VENDOR LOGIC

(Hotel, taxi, restaurant, courier, small services --- exactly as you
described)

#### Rules:

-   Simplified data requirements

-   No KYC (tenant configurable)

-   No PO (tenant configurable)

-   Limited invoice amount (tenant configurable)

-   Auto-expire after one use

-   Vendor cannot be reused without reactivation

-   No WHT unless tenant specifically enables

-   Minimal documentation

Workflow:

-   Requestor → Finance Pre-check → Finance Final

#### 12.10 CATEGORY-AWARE WORKFLOW ROUTING

Workflow changes based on vendor category:

-   Event Agencies → HOD, GM, Procurement, Finance, CFO

-   Clearing Agents → Procurement, Operations, Finance, Tax

-   3PL → Operations, Procurement, Finance

-   Professional Services → HOD, Legal (if required), Finance

-   Non-Resident → Tax Team → Finance

-   Rent/Lease → Admin + Legal + Finance

-   Insurance → Finance Only

#### 12.11 CATEGORY-SPECIFIC TAX ENGINE CONFIGURATION

Each vendor category has its own tax rules, such as:

-   WHT base selection

-   VAT exemption or applicability

-   Reverse VAT

-   Self-account VAT

-   Advance WHT/VAT adjustments

The tax engine must compute:

-   Line-level tax

-   Invoice-level tax

-   Summary tax posting

-   GL mapping

#### 12.12 CATEGORY-SPECIFIC PAYMENT RULES

Example:

#### Event Agencies

-   Withhold WHT

-   Pay reimbursables in full

-   Separate agency fee payment

#### Clearing Agents

-   Advance settlement BEFORE payment

-   Duty & customs fees may be paid separately

#### Non-resident vendors

-   Pay net of WHT

-   FX bank instructions

#### Rent

-   WHT reduction

-   No VAT depending on jurisdiction


---

## 16. Invoice Lifecycle Management

### 13.0 INVOICE LIFECYCLE MANAGEMENT --- END-TO-END

Below are all possible states an invoice may enter, including normal
paths and exception paths.

Full lifecycle covers:

1.  Draft

2.  Submitted

3.  OCR Processing

4.  Pre-Validation

5.  GL/Dimension Assignment

6.  Tax Evaluation

7.  PO/GRN Match

8.  Advance Settlement Check

9.  Approval Workflow

10. Finance Pre-Check

11. Finance Final Approval

12. Ready for Posting

13. ERP Posting

14. Payment Scheduling

15. Payment Execution

16. Paid

17. Archived

18. Exception States (Reject, Clarification, On-Hold, Duplicate,
    Suspicious)

#### 13.1 STATE 1 --- Draft

#### Trigger:

-   Requestor uploads invoice OR vendor uploads via portal.

#### Characteristics:

-   All fields editable

-   Autosave every 5 seconds

-   OCR not yet executed

-   Requestor can upload documents

-   Validation errors shown in real-time

-   Can be deleted

#### Allowed Actions:

-   Edit

-   Delete

-   Save as Draft

-   Submit

#### 13.2 STATE 2 --- Submitted

#### Trigger:

-   Requestor clicks Submit for Approval

#### System Actions:

-   Lock certain fields (Invoice Number, Vendor)

-   Initiate OCR processing

-   Begin duplicate detection

-   Begin vendor eligibility check

-   Begin tax-rule pre-check

-   Determine if PO/GRN required

#### Allowed Actions:

-   Cancel submission (if workflow not yet started)

-   View only

-   Withdraw (tenant option)

#### 13.3 STATE 3 --- OCR Processing

OCR engine extracts:

-   Invoice number

-   Amount

-   Date

-   Line descriptions

-   Taxes

-   Currency

#### Outcomes:

-   High confidence → auto-population

-   Low confidence → route to OCR Review Queue

-   Mismatch → route to "Validation Needed"

Invoice cannot proceed until OCR completes.

#### 13.4 STATE 4 --- System Pre-Validation

Checks:

-   Vendor active?

-   Vendor category rules met?

-   Invoice duplicate?

-   Required documents uploaded?

-   PO required?

-   GRN required?

-   Currency valid?

#### Failed Pre-Validation → Move to:

-   Exception: Validation Error Queue

-   Requestor notified

#### 13.5 STATE 5 --- GL / Dimension Assignment

System auto-suggests:

-   PL Group

-   PL Sub-Line

-   GL Account

-   IO (Real/Stat)

-   Cost Center IO

-   Material IO

-   Location

Tenant configuration decides:

-   Mandatory dimensions

-   Optional dimensions

-   Auto-populated dimensions

Finance can override at any stage.

#### 13.6 STATE 6 --- Tax Evaluation

Tax Engine calculates:

-   VAT

-   Self-account VAT

-   Reverse VAT

-   WHT

-   Non-resident WHT

-   Withholdable vs non-withholdable components

-   Advance-related tax adjustments

Any tax conflict → Tax Exception Queue.

#### 13.7 STATE 7 --- PO/GRN Matching (If Applicable)

#### 2-Way or 3-Way Match:

-   PO vs Invoice

-   PO vs GRN vs Invoice

#### Validation:

-   Price

-   Quantity

-   Vendor

-   Line match

-   Currency

#### Outcomes:

-   Match OK → proceed

-   Within tolerance → proceed but flag

-   Outside tolerance → Variance Exception Queue

#### 13.8 STATE 8 --- Advance Settlement Check

If vendor has outstanding advances:

-   Match advance → invoice

-   Compute remaining balance

-   Adjust VAT/WHT base

-   Adjust GL entries

-   Adjust net payable

If settlement mismatch → Advance Exception Queue.

#### 13.9 STATE 9 --- Approval Workflow

Workflow engine handles all routing.

#### Approval Levels:

-   LM

-   HOD

-   GM

-   Procurement

-   Tax Officer

-   Finance Pre-check

-   Finance Final

-   CFO

#### Key Rules:

-   Approver can approve line-by-line

-   Approver can reject line(s) or whole invoice

-   Approver can request clarification

-   Delegation allowed (tenant configuration)

-   Approval SLA monitored

#### 13.10 STATE 10 --- Finance Pre-Check

Finance validates:

-   GL/Dimensions

-   Tax rules

-   PO/GRN match

-   Advance settlement

-   Duplicate detection

-   Supporting documents

-   Workflow history

-   Vendor eligibility

Finance may:

-   Approve

-   Request clarification

-   Reject line(s)

-   Reject entire invoice

-   Split line items

-   Correct GL/dimensions

#### 13.11 STATE 11 --- Finance Final Approval

This is the last approval before ERP posting.

Finance validates:

-   Journal entries

-   Tax postings

-   Net payable amount

-   WHT adjustments

-   FX rules applied

-   Budget compliance

-   All exception resolutions

Invoice becomes:

#### ✔

#### Ready for Posting

#### 13.12 STATE 12 --- Ready for Posting

System generates:

-   Journal entry preview

-   Vendor ledger entry

-   Tax ledger entries

-   Advance adjustment entries

-   FX entry (if applicable)

All mapped to tenant's COA → from master data import.

#### 13.13 STATE 13 --- ERP Posting

AP pushes data to ERP:

-   Journal entry

-   Vendor ledger

-   Advance settlement

-   Tax postings

#### Outcomes:

-   Success → store ERP doc number

-   Failure → retry queue

-   Repeated failure → Finance notified

ERP failure does not delete invoice --- it remains pending until
resolved.

#### 13.14 STATE 14 --- Payment Scheduling

Finance or AP Processor generates:

-   Payment batch

-   Multi-currency grouping

-   Vendor grouping

-   Bank upload file

CFO/FD approves the batch.

Once approved, batch becomes:

#### ✔

#### Released for Payment

#### 13.15 STATE 15 --- Payment Execution

Invoice marked as:

-   Paid

-   Partially Paid

-   Failed

If bank integrates via API:

-   Payment confirmation auto-updated

-   Failed payments returned to Exception Queue

#### 13.16 STATE 16 --- Paid

Invoice is:

-   Locked

-   Non-editable

-   Posted to ERP

-   Added to AP Ledger

-   Added to aging report

-   Reconciled against advance (if applicable)

#### 13.17 STATE 17 --- Archived

After payment + ERP posting:

Invoice moves to Archived based on tenant policy.

Archived invoices remain:

-   Searchable

-   Viewable

-   Downloadable

-   Exportable

-   Audit accessible

But cannot be edited.

#### 13.18 EXCEPTION STATES

(Critical to real-world finance operations)

#### A. Clarification Needed

-   Requestor must respond

-   Timer-based escalation

#### B. Rejected (Line-Level or Invoice-Level)

-   Requestor can resubmit

-   or mark as closed

#### C. Duplicate Suspicion

-   Finance review required

#### D. Fraud Suspicion

-   Sent to "Fraud Risk Queue"

-   Requires Compliance Officer action

#### E. On Hold

Reason examples:

-   Budget freeze

-   Vendor dispute

-   Legal dispute

-   Pending documents

#### F. ERP Failure

-   Automatic retry

-   Manual override option

#### 13.19 END-TO-END LIFECYCLE DIAGRAM (Logical Flow)

(You will use this in the final UI/UX design)

Draft → Submitted → OCR → Validation → GL/Dimensions → Tax → PO/GRN →
Advance → Approvals → Finance Pre-check → Finance Final → Ready for
Posting → ERP Posting → Payment Scheduling → Payment Execution → Paid →
Archived

Exception flows attach at many stages.


---

## 17. Audit & Compliance Requirements

### 14 Audit & Compliance Requirements

This section defines all auditability, compliance, and regulatory
requirements necessary to ensure
that the ZivaBI AP Module satisfies internal audit, external audit, SOX,
tax authority, and
corporate governance expectations.

#### 14.1 Internal Audit Controls

- Every invoice, line, approval action, edit, split, tax change, and
beneficiary update must be fully logged.
- Audit logs must include:
  - User ID
  - Timestamp (UTC)
  - Before and after JSON states
  - IP address
  - Reason code (for Finance overrides)
- No audit record may be deleted or modified.
- All changes must be immutable.

#### 14.2 External Audit Requirements

- One-click "Audit Pack" generator including:
  - Invoice file
  - PO/GRN
  - Beneficiary list
  - Supporting documents
  - Approval trail
  - Line split history
  - Tax calculation sheet
  - FX conversion evidence
- PDF + ZIP export.
- Evidence must be time-stamped and checksum-protected.

#### 14.3 SOX (Sarbanes-Oxley) Compliance Controls

- Segregation of duties enforced:
  - Requestor ≠ Approver
  - Finance Reviewer ≠ Finance Approver
- Mandatory Finance review before posting.
- Changes to financial coding require explanation notes.
- Approval chain must match configured matrix.
- All exception overrides must be documented.

#### 14.4 Tax Compliance Controls

- Automated WHT/VAT computation based on vendor category.
- Reverse VAT computation where applicable.
- Comprehensive tax reports for:
  - Monthly remittance
  - Vendor-level withholding
  - VAT input/output summaries
- Tax logs must show rules applied.
- Ability to export tax files for auditors or tax authorities.

#### 14.5 Vendor Compliance Requirements

- Vendor KYC:
  - CAC or equivalent business registration
  - Tax Identification Number (TIN)
  - Bank account verification
- Vendor change requests require:
  - Supporting documents
  - Two-person verification workflow
  - Call-back confirmation (optional)
- Retainer agreements and contracts must be stored and auditable.

#### 14.6 Duplicate Invoice Compliance

- Mandatory duplicate detection.
- Any high-risk duplicate requires:
  - Mandatory Finance override
  - Explanation note
  - Approval from AP Manager for final submission
- Duplicate logs must be preserved for audit.

#### 14.7 Approval Chain Compliance

- Workflow engine must enforce the correct approval order.
- Any skipped approver immediately triggers a compliance violation.
- Compliance violations logged for auditor visibility.

#### 14.8 Document Retention Policies

- 7 years default retention (tenant configurable).
- Automatic archival after retention period.
- Secure encrypted long-term storage.
- Retrieval must remain instantaneous (\<3 seconds).

#### 14.9 Access Control Auditing

- User access logs must show:
  - Login/logout
  - Session duration
  - All sensitive document access events
- Monthly access review report must be available to internal audit.
- Role changes logged with approver identity.

#### 14.10 Workflow & Change Management Auditing

- Modifications to:
  - Approval workflows
  - Tax rules
  - FX rules
  - Vendor categories
  - Dimension mapping
must be logged with:
  - Old configuration
  - New configuration
  - User ID
  - Timestamp

#### 14.11 Fraud Prevention Controls

- AI-based anomaly alerts.
- Vendor bank account change fraud checks.
- Multiple-invoice pattern checks.
- Beneficiary irregularity detection (future).
- Escalation to internal audit for suspicious patterns.

#### 14.12 Legal & Regulatory Compliance

- GDPR & NDPR compliance for PII.
- Country-specific tax compliance (tenant-driven).
- Support for regulatory audits (export formats).
- Compliance notes added to audit pack.


---

## 18. Deployment & Environment Requirements

### 15 Deployment & Environment Requirements

This section defines all deployment, hosting, infrastructure, and
runtime environment requirements
for the ZivaBI Accounts Payable (AP) Module. These requirements ensure
high availability,
security, scalability, and predictable release cycles.

#### 15.1 Environment Tiers

ZivaBI must operate in the following isolated environments:

- Development (DEV)
  - Used by engineers for feature building.
  - Connected to mock services (dummy OCR, dummy ERP).
- Quality Assurance (QA)
  - Automated testing.
  - Regression suites.
  - Load and stress testing.
- User Acceptance Testing (UAT)
  - Tenant-specific sandbox.
  - Mirrors production data structure, but without sensitive data.
- Production (PROD)
  - Live tenant operations.
  - Strict access control.
  - High availability configuration.

#### 15.2 Deployment Approach (CI/CD)

- CI pipeline triggered on every commit.
- Automated code quality checks.
- Automated security scanning.
- Unit tests + integration tests required to pass before deploy.
- Canary deployment for AI/ICE components.
- Blue-green deployment for major releases.
- Rollback capability for every deployment.

#### 15.3 Containerization & Orchestration

- All services must be containerized (Docker).
- Orchestration via Kubernetes.
- Resource autoscaling based on:
  - CPU usage
  - Memory usage
  - Request load
- Node pools separated by service type:
  - API servers
  - AI inference servers
  - OCR workers
  - Workflow engine workers

#### 15.4 Secrets & Configuration Management

- Secrets stored in encrypted vault:
  - HashiCorp Vault
  - AWS Secrets Manager
  - Azure Key Vault
- No secrets in code.
- Configuration stored in environment variables.

#### 15.5 Logging & Monitoring (Observability)

Logging:
- Structured JSON logs.
- Centralized log aggregation.

Monitoring:
- Metrics for latency, throughput, resource usage.
- AI accuracy metrics.
- OCR performance metrics.

Alerting:
- PagerDuty / Opsgenie integration.
- Alerts for API failures, high error rate, abnormal latency.

#### 15.6 Backup & Recovery

- Full database backup every 24 hours.
- Incremental backups every hour.
- Encrypted backups stored across regions.
- Backup restoration test every month.
- RPO: 15 minutes.
- RTO: 30 minutes.

#### 15.7 High Availability (HA)

- Multi-zone deployment.
- Load balancers for all public services.
- Auto-restart for failed components.
- AI and OCR workloads scaled independently.

#### 15.8 Disaster Recovery (DR)

- Cross-region standby cluster.
- Automated failover logic.
- DR health checks every 5 minutes.
- DR switch tests quarterly.

#### 15.9 Versioning & Release Management

- Semantic versioning:
  - MAJOR.MINOR.PATCH
- Release notes autogenerated during CI.
- Hotfix release pipeline for urgent patches.
- AI model versioning separate from application versioning.

#### 15.10 Data Migration & Compatibility

- Migration scripts created for all schema changes.
- Forward- and backward-compatible migrations when possible.
- Zero-downtime migrations using:
  - Shadow tables
  - Dual-read/dual-write (if needed)

#### 15.11 Environment Isolation Requirements

- DEV, QA, UAT, and PROD fully isolated.
- No cross-environment data mixing.
- Production data never copied into UAT.

#### 15.12 Performance Scaling Requirements

- API servers scale horizontally.
- OCR workers scale based on queue depth.
- AI inference pods scale based on request load.
- Workflow engine scales based on task backlog.

#### 15.13 Infrastructure Compliance

- Infrastructure must be compliant with:
  - ISO 27001
  - SOC2 Type II
  - GDPR / NDPR
- Annual penetration tests.
- Continuous vulnerability scanning.

#### 15.14 Cost Optimization Requirements

- Auto-scaling to reduce idle cost.
- Storage lifecycle policies for documents.
- Spot instances allowed for non-critical AI training jobs.


---

## 19. Configuration & Customization Requirements

### 16 Configuration & Customization Requirements

This section defines all configurable and customizable components of the
AP Module for both Tenant Admin and Super Admin.
ZivaBI must support full flexibility without code changes.

#### 16.1 Tenant Admin Configuration

A. Approval Workflow Configuration
- Drag-and-drop workflow builder.
- Configure:
  - LM → HOD → GM → Finance Reviewer → Finance Approver
- Conditional rules:
  - Amount thresholds
  - Vendor category-specific workflows
  - Department-specific workflows
  - FX invoice workflows

B. Tax Configuration
- Configure WHT rates per vendor category.
- Configure VAT rates.
- Enable/disable Reverse VAT.
- Set tax exempt categories.
- Configure tax rounding rules.

C. FX Rate Configuration
- Choose FX source:
  - CBN
  - ECB
  - Custom API
- Choose FX rule:
  - Invoice date rate
  - Approval date rate
  - Monthly corporate rate
- Configure rounding rules.

D. Vendor Category Configuration
- Add/edit/delete vendor categories.
- Define:
  - WHT applicability
  - VAT applicability
  - Reverse VAT applicability
  - Dimension enforcement rules
  - Required support documents

E. Dimension Configuration
- Enable/disable:
  - GL field
  - Cost Center field
  - Stat IO
  - Real IO
  - Material IO
  - Location
- Rename fields per tenant conventions.
- Configure dropdown values.
- Configure GL → dimension dependency rules.

F. Required Field Configuration
- Make fields mandatory or optional.
- Example:
  - Beneficiary name required
  - PO required
  - GRN required
  - Event code required (event agencies)
  - Budget code required

G. Document Requirement Configuration
- Configure required documents for:
  - Vendor invoices
  - Event agency invoices
  - Clearing agent submissions
  - Professional services
- Allow multiple uploads per field.

H. AI Configuration
- Enable/disable:
  - GL prediction
  - Dimension prediction
  - Vendor category detection
  - Duplicate detection
- Set AI confidence threshold per tenant.
- Enable AI-assisted splitting suggestion (future).
- Enable/disable ICE training from tenant data.

I. Line Splitting Configuration
- Allow/disallow requestor-initiated splitting.
- Allow Finance-only splitting.
- Configure reason code list.
- Configure split dimension behavior.

J. Beneficiary Configuration
- Enable/disable beneficiary requirement.
- Configure:
  - Minimum allocation fields
  - Allowed beneficiaries (employees only or external)
  - Mandatory supporting evidence

#### 16.2 Super Admin Configuration

A. Module Activation
- Enable/disable AP Module per tenant.
- Enable vendor portal per tenant.
- Enable OCR engine.
- Enable ICE AI engine.

B. Global Tax Profiles
- Default tax templates for countries.
- Template assignment per tenant.

C. Global Vendor Categories
- Preconfigured vendor category templates (event, logistics, rent,
etc.).
- Tenant override support.

D. Global Dimensions Templates
- Default layouts for:
  - GL
  - IOs
  - Cost centers
  - Locations

E. AI Governance
- Enable ICE training globally.
- Enforce AI privacy constraints.
- Configure maximum training dataset size per tenant.
- Approve new model versions.

#### 16.3 User-Level Customization

- Users can configure:
  - Dashboard widgets
  - Notification preferences
  - Approval filters
  - Table column visibility

#### 16.4 Mobile Configuration

- Enable camera-based invoice capture.
- Configure offline capture support per tenant.
- Mobile dashboard customization.

#### 16.5 Reporting Configuration

- Tenant-specific:
  - Aging period configuration
  - SLA thresholds
  - Dashboard KPIs
  - Custom report builder

#### 16.6 Multi-Tenant White-Labeling

- Tenant can upload logo.
- Tenant can choose primary and secondary colors.
- Tenant can configure:
  - Login screen text
  - Email templates
  - Invoice submission templates


---

## 20. Notifications & Communication Requirements

### 17 Notifications & Communication Requirements

This section defines all requirements for email, in‑app, mobile, and
vendor-side notifications within the
ZivaBI Accounts Payable (AP) Module.

#### 17.1 Notification Channels

ZivaBI must support the following channels:
- Email notifications
- In-app notification center
- Mobile push notifications (future)
- Vendor portal alerts
- SMS (optional, tenant-enabled)

#### 17.2 Notification Types

A. Workflow Notifications
- Invoice submitted
- Invoice returned for correction
- Invoice approved at each stage
- Invoice fully approved and ready for posting
- Invoice rejected
- GRN required
- PO mismatch alert

B. Finance Notifications
- Invoice pending finance review
- Duplicate invoice detected
- Tax exception detected
- Missing document alert
- Beneficiary clarification needed
- Request to split line or update coding

C. Vendor Notifications
- Invoice received
- Invoice under review
- Invoice approved for payment
- Invoice rejected (with reason)
- Additional documents required
- Vendor master data update status

D. Escalation Notifications
- SLA breach alerts
- Approver inactivity for X days
- Unposted aging invoices
- GRN confirmation overdue

E. Audit Notifications
- Auditor queries assigned to Finance
- Finance response reminders
- Audit pack ready for download

#### 17.3 Notification Delivery Rules

- Delivery must respect tenant timezone.
- SLA reminders configurable per tenant.
- Approvers must receive summaries when multiple requests are pending.
- Duplicate notifications must be suppressed intelligently.
- Notification retries for failed deliveries.

#### 17.4 Notification Templates

- Tenant-customizable templates (HTML + variables).
- Variables include:
  - {{vendor_name}}
  - {{invoice_number}}
  - {{amount}}
  - {{approval_stage}}
  - {{due_date}}
  - {{department}}
  - {{requestor_name}}

- Templates must support multi-language versions.

#### 17.5 In-App Notification Center

Features:
- Notifications grouped by category (Approvals, Finance, Vendor,
System).
- Mark as read/unread.
- Snooze notifications.
- Quick actions (Approve / View / Upload Docs).
- Search notifications.

#### 17.6 Mobile Push Notifications (Future)

- For approvers:
  - Approve/reject from notification
- For requestors:
  - Document requests
  - Rejections with comments
- For Finance:
  - Urgent escalations

#### 17.7 Vendor Portal Notifications

- Vendor-facing timeline updates.
- Email + in-portal alerts for:
  - Missing documents
  - Payment approval
  - Payment settlement confirmation
  - Compliance alerts

#### 17.8 Notification Preferences

Each user can configure:
- Email frequency:
  - Real-time
  - Hourly digest
  - Daily digest
- Notification categories on/off
- Mobile push enable/disable
- Escalation alerts on/off

#### 17.9 System-Level Notification Policies

- Finance-critical alerts cannot be turned off.
- Escalations follow a hierarchy:
  - LM → HOD → GM → Finance Manager
- SLA breaches generate alerts automatically.


---

## 21. Migration Requirements

### 18 Migration Requirements

This section defines all requirements for migrating legacy AP data,
structures, vendor masters,
documents, and workflows into the ZivaBI Accounts Payable Module.

#### 18.1 Migration Objectives

- Ensure smooth transition from legacy AP processes to ZivaBI.
- Preserve financial accuracy and audit trail.
- Avoid disruption of vendor payments.
- Allow tenant to import large volumes of historical data.
- Ensure dimensions and tax rules remain consistent.

#### 18.2 Migration Scope

The following can be migrated:
- Vendor master data
- Vendor category assignments
- Chart of accounts (COA)
- Dimensions (Cost centers, IOs, Material IOs)
- Open invoices
- Historical invoices (optional)
- PO and GRN history
- Tax rules
- FX rate history
- User roles and approval workflows

Not migrated:
- Deleted, voided, or non-financial data
- Vendor documents older than retention policy (unless tenant
overrides)

#### 18.3 Migration Phases

A. Pre-Migration Assessment
- Legacy system analysis.
- Data quality review.
- Identify gaps or missing fields.
- Confirm mapping templates.

B. Staging Upload
- Upload via Excel/CSV templates.
- Supported file types: XLSX, CSV, JSON.
- Validation engine checks formatting, completeness, duplicates.

C. Transformation Phase
- COA mapping to ZivaBI structure.
- Dimension normalization.
- Vendor category classification.
- Tax rule conversion.

D. Verification Phase
- Trial balance reconciliation.
- Vendor statement reconciliation.
- PO/GRN linkage checks.
- Historical audit log verification.

E. Cutover
- Freeze legacy AP.
- Final import.
- Activate approval workflows.
- Activate vendor portal (optional).
- Enable AI training.

#### 18.4 Migration Templates

The system provides downloadable templates for:

A. Vendor Master Template
Columns:
- vendor_code
- vendor_name
- category
- tax_id
- bank_details
- address
- required_documents_completed (Y/N)

B. COA Template
- gl_account
- description
- financial_statement_group
- category (PL/BS)
- dimensions_enabled (Y/N)

C. Open Invoice Template
- invoice_number
- vendor_code
- invoice_date
- due_date
- amount
- currency
- po_number (optional)
- grn_number (optional)

D. Dimension Templates
- cost_center
- stat_io
- real_io
- material_io
- location

#### 18.5 Imported Document Handling

- Vendors may supply legacy invoice PDFs.
- All legacy documents stored in ZivaBI Document Store.
- Tagged as "Migrated".
- Audit logs created automatically.

#### 18.6 Migration Validation Rules

The system validates:

- Duplicate invoice numbers.
- Missing vendor category.
- Invalid GL accounts.
- Incorrect tax mapping.
- Missing required documents.
- Invalid FX conversions.
- PO/GRN mismatches.
- Dimension inconsistencies.

#### 18.7 Reconciliation Requirements

Mandatory reconciliation after migration:

A. Vendor Reconciliation:
- Vendor balance = Sum(open invoices) -- Sum(payments)

B. GL Reconciliation:
- AP control account = Total migrated payables.

C. PO/GRN Reconciliation:
- All migrated POs must match GRNs.

D. Tax Reconciliation:
- WHT and VAT carryovers tested against previous declarations.

#### 18.8 Migration Cutover Strategy

- Freeze AP operations 24 hours before go-live.
- Lock all workflows.
- Final import completion.
- Smoke test (5 critical tests).
- Finance Approver signs off.
- Activate tenant.

#### 18.9 Post-Migration Validation (First 30 Days)

- Daily vendor payment validation.
- Daily duplicate invoice scan.
- Weekly Finance reconciliation checks.
- Full audit log export for auditors.

#### 18.10 Migration Audit Trail

- Each imported record includes import metadata:
  - import_id
  - user_id
  - timestamp
  - source_file
- Migration report exportable to auditors.


---

## 22. Appendix & Consolidated Tables

### 14.0 APPENDIX & CONSOLIDATED TABLES

This appendix includes:

#### ✔ Field Definitions

#### ✔ Status Definitions

#### ✔ Tax Rule Matrix

#### ✔ Vendor Category Matrix

#### ✔ Workflow Matrix

#### ✔ Document Requirements Matrix

#### ✔ GL/Dimension Applicability Matrix

#### ✔ Exception Types

#### ✔ SLA Definitions

#### ✔ Audit Log Structures

#### ✔ API Endpoint List (High-Level)

#### ✔ Data Retention Policies

#### ✔ Tenant Configuration Summary

#### 14.1 FIELD DEFINITIONS (AP MODULE)

The table defines all fields used across AP forms and APIs.

| Field | Description | Required | Editable By | Validation Rules |
| --- | --- | --- | --- | --- |
| Invoice Number | Unique invoice identifier from vendor | Yes | Requestor, Vendor | Duplicate check |
| Invoice Date | Date on vendor invoice | Yes | Requestor | Must not be future date |
| Vendor | Vendor selected from master | Yes | Requestor | Must be Active |
| Currency | Invoice currency | Yes | Requestor | Must match allowed currencies |
| Amount | Total invoice amount | Yes | OCR/Requestor | Numeric, \> 0 |
| Line Description | Description of invoice line | Yes | Requestor | Minimum 10 characters |
| GL Account | Accountant code to charge | Yes | Requestor/Finance | Must exist in COA |
| PL Group | PL grouping category | Yes | Requestor | Tenant-defined |
| PL Sub-Line | Sub-category matching PL group | Yes | Requestor | Dependent on PL |
| Real/Stat IO | Internal order code | Conditional | Requestor/Finance | GL-specific |
| Cost Center IO | Cost center dimension | Conditional | Requestor | Tenant rules |
| Material IO | Inventory/material code | Conditional | Requestor | If GL requires |
| Location | Location of expense/service | Conditional | Requestor | Tenant-config |
| VAT Amount | VAT calculated | Auto | Tax Engine | Rules applied |
| WHT Amount | Withholding tax | Auto | Tax Engine | Vendor category rules |
| Net Payable | Amount to pay vendor | Auto | System | Formula validated |
| Attachments | Supporting documents | Yes | Requestor | Must meet document rules |


#### 14.2 INVOICE STATUS DEFINITIONS

| Status | Meaning |
| --- | --- |
| Draft | Invoice created but not submitted |
| Submitted | Sent to workflow; validation begins |
| OCR Processing | OCR extraction running |
| Validation Error | Failed pre-validation |
| Pending GL/Dimension Assignment | Waiting for mapping |
| Pending Tax Evaluation | Tax engine in progress |
| PO/GRN Matching | Matching PO & GRN |
| Pending Advance Check | Checking outstanding advances |
| Pending Approvals | In approval chain |
| Clarification Needed | Requestor must respond |
| Rejected | One or all lines rejected |
| Finance Pre-check | Finance analytical review |
| Finance Final Approval | Final finance review |
| Ready for Posting | Ready for ERP |
| ERP Posting | ERP integration in progress |
| Payment Scheduling | Awaiting payment batching |
| Payment Processing | Bank processing |
| Paid | Vendor has been paid |
| Archived | Frozen for audit/history |


#### 14.3 TAX RULE MATRIX

| Vendor Category | VAT Applies? | WHT Applies? | Notes |
| --- | --- | --- | --- |
| Event Agency | Yes | Yes (Agency Fee only) | Reimbursables excluded |
| Clearing Agent | Yes | Yes (Service Only) | Duty & Customs exempt |
| Professional Services | Yes | Yes | Standard tax |
| Non-Resident Vendor | Reverse VAT | Yes (NR Rate) | FX-based rules |
| Insurance Vendor | Jurisdiction-based | No | Premiums exempt |
| Rent/Lease | Sometimes | Yes | Based on locale |
| 3PL | Yes | Yes | Service only |
| One-Time Vendor | Tenant-based | Tenant-based | Simplified flow |


#### 14.4 VENDOR CATEGORY MATRIX

| Category | PO Required? | GRN Required? | Advance Allowed? | Special Rules |
| --- | --- | --- | --- | --- |
| Event Agency | Yes | No | Yes (20%--40%) | Budget mapping |
| Clearing Agent | Optional | Yes | Yes | Customs logic |
| 3PL | Optional | Yes | No | POD required |
| Professional Services | Optional | No | Sometimes | Contract required |
| Non-Resident | Yes | No | No | Reverse VAT |
| Insurance | No | No | No | VAT exemption |
| Rent/Lease | Yes | No | No | Lease contract |
| One-Time Vendor | No | No | No | Invoice-only |


#### 14.5 WORKFLOW MATRIX

| Stage | Actor | Mandatory? | Notes |
| --- | --- | --- | --- |
| Request Submission | Requestor | Yes | Starts workflow |
| LM Approval | LM | Configurable | Amount-based |
| HOD Approval | HOD | Configurable | Department-based |
| GM Approval | GM | Configurable | Threshold-based |
| Procurement | Procurement | Conditional | PO/vendors |
| Finance Pre-check | Finance | Yes | Heavy validations |
| Tax Review | Tax Officer | Optional | Tenant-based |
| Finance Final | Finance | Yes | Last checkpoint |
| CFO Approval | CFO | Optional | High-value invoices |


#### 14.6 DOCUMENT REQUIREMENTS MATRIX

| Vendor Type | Required Documents |
| --- | --- |
| Event Agency | Budget, Invoice, PO, Reimbursables, POD |
| Clearing Agent | Commercial Invoice, Form M, PAAR, Customs Assessment |
| 3PL | POD, Route Log |
| Professional Services | Contract/Engagement Letter |
| Rent | Lease contract |
| One-Time | Invoice only |
| Non-resident | Tax certificate, Invoice |


#### 14.7 GL/DIMENSION APPLICABILITY MATRIX

| GL Type | Real IO | Stat IO | Material IO | Cost Center |
| --- | --- | --- | --- | --- |
| Marketing | Yes | No | No | Optional |
| Distribution | Yes | Yes | Sometimes | Yes |
| COGS | No | No | Yes | No |
| Admin | No | Yes | No | Yes |
| CAPEX | No | No | Yes | Optional |


#### 14.8 EXCEPTION TYPES

| Exception Type | Trigger |
| --- | --- |
| Tax Exception | Incorrect VAT/WHT |
| Duplicate Detection | Similar invoice found |
| PO/GRN Variance | Out-of-tolerance |
| Advance Exception | Incorrect mapping |
| Fraud Suspicion | AI anomaly |
| Document Exception | Missing/expired files |
| ERP Failure | Integration error |


#### 14.9 SLA DEFINITIONS

| Stage | SLA | Escalation |
| --- | --- | --- |
| LM Approval | 48 hours | HOD |
| HOD Approval | 48 hours | GM |
| Finance Pre-check | 24 hours | Finance Manager |
| Finance Final | 48 hours | CFO |
| Clarification Response | 72 hours | Auto-close or Auto-reject (tenant setting) |
| ERP Posting | 1 hour | Finance |


#### 14.10 AUDIT LOG STRUCTURE

Every action must record:

-   User ID

-   Tenant ID

-   Timestamp

-   Old value

-   New value

-   Comments

-   System-generated notes

-   IP address

-   Device/browser metadata

-   Linked document IDs

-   Workflow state

Audit logs are immutable.

#### 14.11 HIGH-LEVEL API ENDPOINT LIST

(Not technical spec --- just summary reference.)

#### Invoice Intake APIs

-   POST /ap/invoices

-   GET /ap/invoices/{id}

-   PUT /ap/invoices/{id}

#### Workflow APIs

-   POST /ap/invoices/{id}/submit

-   POST /ap/invoices/{id}/approve

-   POST /ap/invoices/{id}/reject

-   POST /ap/invoices/{id}/clarify

#### Tax APIs

-   POST /ap/tax/calculate

#### ERP APIs

-   POST /ap/erp/post

-   GET /ap/erp/status/{id}

#### Payment APIs

-   POST /ap/payments/batch

-   GET /ap/payments/batch/{id}

#### 14.12 DATA RETENTION POLICIES

| Data Type | Retention |
| --- | --- |
| Invoices | Tenant-defined (7--10 years default) |
| Documents | Same as invoice |
| Audit Logs | 10 years minimum |
| Payment Files | 5 years |
| OCR Data | 90 days |


#### 14.13 TENANT CONFIGURATION SUMMARY

Every tenant can configure:

-   PO/GRN rules

-   WHT/VAT rules

-   Expense caps

-   Vendor categories

-   Approval workflow

-   Document requirements

-   Advance rules

-   FX rules

-   Dimension rules

-   Budget rules

-   Invoice aging policies

-   Payment limits

-   Mobile restrictions

-   AI suggestions (enable/disable)

