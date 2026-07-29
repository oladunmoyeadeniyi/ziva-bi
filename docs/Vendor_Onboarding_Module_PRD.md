# Vendor Onboarding Module — Product Requirements Document (PRD)

**Product:** Ziva BI — Accounting Automation Platform
**Module:** Vendor Onboarding
**Document status:** Merged and converted from two source Word documents to Markdown
**Converted on:** July 25, 2026

> This document merges two source files: the main PRD (Sections 1-9: Executive Summary through API Requirements) and its continuation document (Sections 10-18: UI/UX Requirements through Module Interdependency Map), originally authored as a separate file picking up where the main document left off. Note: Section 6 (Business Rules) appears twice in the source material, covering two distinct rule sets — both are preserved and labeled Part 1 and Part 2.

---

## Table of Contents

1. Executive Summary
2. Problem Statement & Background
3. Scope & Out of Scope
4. Personas & User Roles
5. User Stories
6. Business Rules (Part 1 — Core Module Rules)
6. Business Rules (Part 2 — Vendor Creation, Validation & KYC)
7. Workflow Diagrams & End-to-End Process Flows
8. Data Model & Database Schema
9. API Requirements
10. UI/UX Requirements
11. Non-Functional Requirements (NFRs)
12. Reporting & Analytics Requirements
13. Vendor Lifecycle Management Requirements
14. Glossary of Terms
15. High-Level Architecture Summary
16. User Personas
17. Module Interdependency Map
18. PRD Closure Statement

---

## 1. Executive Summary

The Vendor Onboarding Module is a core component of the ZivaBI
Automation Suite. It provides a unified,
configurable, audit-ready, multi-tenant onboarding system for all types
of vendors including
professional services, event agencies, clearing agents, logistics
providers (3PL), suppliers,
contractors, import partners, and non-resident vendors.
The module fully replaces manual vendor onboarding forms, scattered
emails, fragmented approvals,
and spreadsheet-based vendor master setups with a centralized,
automated, AI-assisted solution.

## 2. Problem Statement & Background

Organizations across industries face significant challenges with vendor
onboarding due to fragmented,
manual, and non-standardized processes. Most companies depend heavily on
emails, spreadsheets,
PDF forms, physical documents, and multiple disconnected approval chains
to capture and verify
vendor information.

These inefficiencies lead to:

1. High administrative workload:
- Finance, procurement, and operations teams spend excessive time
chasing vendors for documents.
- Manual data entry introduces delays and inconsistencies.

2. High risk of fraud and financial error:
- Bank account detail changes are handled without strict controls.
- Duplicate or fake vendors can be mistakenly onboarded.
- Incorrect tax classification results in compliance breaches.

3. Long onboarding cycle time:
- Multi-level approvals often occur across email threads.
- Vendors submit incomplete documentation requiring repeated
back-and-forth communication.

4. Lack of transparency:
- Requestors cannot track onboarding progress.
- Finance lacks visibility into pending or stalled vendor approvals.
- Audit teams cannot easily review historical vendor setup decisions.

5. Compliance and governance failures:
- Missing KYC/AML checks.
- Unverified tax identifiers.
- Absence of structured retention for vendor contracts and legal
documents.

6. No centralized vendor lifecycle management:
- No unified view of vendor documents, risk classification, or
historical activities.
- No mechanism to manage vendor updates (bank details, address changes,
contact changes).

7. Vendor dissatisfaction:
- Vendors cannot track their onboarding status.
- No self-service portal to update information.
- Excessive delays reduce vendor trust and service quality.

ZivaBI's Vendor Onboarding Module solves these challenges by providing a
modern, automated,
audit-ready onboarding engine integrated with vendor portals, workflow
automation,
AI-based validation, and multi-tenant configurability.

## 3. Scope & Out of Scope

This section defines the full boundary of the Vendor Onboarding Module
  - what it includes,
what it excludes, and key assumptions for successful implementation.

### 3.1 In Scope

The ZivaBI Vendor Onboarding Module includes the following
capabilities:

A. Vendor Self-Service Onboarding
- Vendors receive secure onboarding links (expires in 30 days).
- Web form for vendor details.
- Option to complete online or download/upload offline form.
- Upload of mandatory documents:
  - Business registration documents (CAC, Certificate of Incorporation,
etc.)
  - Tax identification documents
  - Bank verification documents
  - Company profile
  - Contracts/retainer agreements (if applicable)

B. AI-Assisted Data Capture & OCR
- OCR extraction of uploaded documents.
- Automatic pre-filling of vendor fields.
- Error detection (e.g., incomplete forms).
- Validation of tax ID, business registration numbers, etc.

C. Vendor Category Classification Engine
- Auto-classifies vendors into categories (e.g., Event Agency, Clearing
Agent, Professional Services, 3PL).
- Determines tax rules (WHT/VAT applicability).
- Determines compliance requirements.

D. Workflow & Approvals
- Multi-step approvals:
  - Requestor → Line Manager → HOD → GM → Finance → Procurement → Legal
(optional)
- Configurable based on tenant requirements.
- Approvals can require multiple reviewers.

E. Vendor Bank Account Verification Flow
- Mandatory upload of bank letter.
- Call-back verification workflow for Finance.
- Dual approval requirement for bank account changes.
- AI-based fraud anomaly detection (future).

F. Vendor Portal Activation
- Vendors gain access to a limited self-service portal after
onboarding.
- Can view their profile, invoices, payment status.
- Can request vendor profile updates.

G. Vendor Update Workflow
- For updating:
  - Bank details
  - Contact details
  - Address
  - Tax information
- Request automatically routed to Finance for verification.

H. Compliance & Risk Controls
- Vendor risk scoring.
- Mandatory KYC checks based on vendor category.
- Restriction of high-risk vendors until compliance approval.
- Document completeness checks.

I. Multi-Tenant Configuration
- Tenant can customize:
  - Required fields
  - Required documents
  - Approval workflow
  - Vendor categories
  - Naming conventions
- Super Admin controls module activation per tenant.

J. Integration Support
- ERP vendor master data push.
- Sync with AP, PO, GRN, and AR modules.
- Integration with tax authorities (optional).
- Integration with bank verification systems (optional).

### 3.2 Out of Scope

The following are NOT part of this module:

- AP invoice submission (covered in AP module)
- Expense reimbursement vendor setup (handled in Expense module)
- Payroll vendors (handled by Payroll PRD)
- Inventory/3PL service execution (covered in Warehouse/Inventory PRD)
- Sourcing/RFX processes (future Procurement module)
- Contract lifecycle management (future CLM module)
- Vendor performance scoring (future vendor scorecard engine)
- Tender evaluation workflows

### 3.3 Assumptions & Dependencies

A. Assumptions
- Each tenant will configure their own vendor category rules.
- Each tenant will upload their COA and dimensions.
- All vendors have valid email addresses for onboarding.
- Tenants will verify bank accounts manually unless integrated.

B. Dependencies
- Integration with ERP for vendor master sync.
- Email/SMS provider for onboarding notifications.
- Document storage (S3/Azure/GCP).
- OCR and AI (ICE engine) for document processing.
- AP module for vendor invoice workflows.
- Super Admin module for tenant provisioning.

## 4. Personas & User Roles

This section defines all user personas involved in the Vendor Onboarding
Module, their responsibilities,
permissions, motivations, and how the system supports their workflows.

### 4.1 Requestor (Staff Initiating Vendor Creation)

Responsibilities:
- Initiates request to onboard a new vendor.
- Provides justification and business need.
- Selects initial vendor category (optional).

Goals/Pain Points Addressed:
- Avoid long email threads.
- Track status of onboarding.
- Ensure vendor setup is completed quickly.

Permissions:
- Create vendor onboarding request.
- View status of request.
- Upload justification documents.
- Respond to Finance/Compliance queries.

Interactions:
- Vendor onboarding form.
- Approval workflow.
- Notifications.

### 4.2 Vendor (External Party Completing the Form)

Responsibilities:
- Completes onboarding form via secure link.
- Uploads required legal, tax, and banking documents.
- Confirms bank details and identity.
- Responds to clarification requests.

Pain Points Addressed:
- No need to print or scan forms.
- Clear checklist of required documents.
- Ability to track onboarding status.

Permissions:
- Access onboarding link (expires in 30 days).
- Submit or edit onboarding form.
- Upload documents.
- Receive notifications from the system.

### 4.3 Line Manager (LM)

Responsibilities:
- Approves or rejects vendor creation request.
- Ensures requestor's justification is valid.

Permissions:
- Approve/reject vendor onboarding request.
- Add comments.
- View vendor details.

### 4.4 Head of Department (HOD)

Responsibilities:
- Secondary approval for vendor creation.
- Ensures vendor aligns with departmental strategy.

Permissions:
- Approve or reject.
- Add comments.
- View workflow history.

### 4.5 General Manager (GM) / Executive Approver

Responsibilities:
- Final business approval before Finance review.
- Ensures vendor fits corporate and operational goals.

Permissions:
- Approve/reject.
- View all supporting documents.
- See submitted vendor form.

### 4.6 Procurement Team

Responsibilities:
- Validate vendor fit within procurement policies.
- Verify product/service offering.
- Validate pricing models when applicable.

Permissions:
- Approve/reject vendor.
- Request more documents.
- Update vendor category (if allowed).
- Upload procurement contracts.

### 4.7 Finance Reviewer

Responsibilities:
- Validate tax details, WHT/VAT applicability.
- Validate bank account and banking documents.
- Perform fraud checks.
- Validate vendor category and GL mapping where needed.

Permissions:
- Approve/reject vendor.
- Request corrections from requestor.
- Trigger bank account verification workflow.
- Access finance-only documents.

### 4.8 Finance Approver (Senior Finance)

Responsibilities:
- Final Finance approval before adding to ERP.
- Validate all financial information and tax compliance.

Permissions:
- Approve/reject.
- Access full vendor profile.
- Approve bank account changes.

### 4.9 Compliance/KYC Officer

Responsibilities:
- Validate legal documents.
- Verify identity, tax ID, business registration.
- Assign risk score.

Permissions:
- Approve/reject vendor onboarding.
- Mark vendor as high, medium, low risk.
- Upload compliance notes.
- Flag vendor for enhanced due diligence.

### 4.10 Legal Reviewer (Optional Based on Tenant Setup)

Responsibilities:
- Validate contracts, retainer agreements, NDAs.
- Approve legal compliance.

Permissions:
- Approve/reject vendor.
- Upload legal notes.
- View vendor contracts.

### 4.11 Tenant Administrator

Responsibilities:
- Configure onboarding rules.
- Manage vendor categories.
- Manage required documents.
- Configure approval workflows.

Permissions:
- Access full tenant configuration.
- Override rules (document requirements, naming).
- Activate/inactivate vendor categories.

### 4.12 Super Admin (ZivaBI Platform Owner)

Responsibilities:
- Provision new tenant.
- Activate modules for tenant.
- Monitor system-wide analytics.
- Ensure platform-level security.

Permissions:
- Cannot view tenant vendor data.
- Can enable/disable vendor module.
- Configure global vendor templates.
- Manage global compliance settings.

## 5. User Stories

This section defines detailed user stories for all personas involved in
the Vendor Onboarding Module.
Each user story includes acceptance criteria, rationale, and
exceptions.

### 5.1 Requestor User Stories

US-REQ-01: Create Vendor Onboarding Request
As a Requestor, I want to initiate a new vendor onboarding request so
that a vendor can be onboarded for business use.

Acceptance Criteria:
- Mandatory justification field.
- Able to upload supporting documents.
- System generates onboarding link for vendor.
- Requestor receives confirmation notification.

US-REQ-02: Track Vendor Onboarding Status
As a Requestor, I want to see where the onboarding process is so that I
am aware of delays or pending actions.

Acceptance Criteria:
- Status timeline visible (Initiated → Vendor Form Submitted → Approvals
→ Finance Review → Approved).
- Notifications for each status change.

### 5.2 Vendor User Stories

US-VEN-01: Complete Vendor Onboarding Form
As a Vendor, I want to fill out my onboarding form online so that my
information can be submitted efficiently.

Acceptance Criteria:
- Secure link expires in 30 days.
- All required fields highlighted.
- OCR auto-fills fields from uploaded documents.

US-VEN-02: Upload Required Documents
As a Vendor, I want to upload all necessary legal, tax, and bank
documents so that I can meet onboarding requirements.

Acceptance Criteria:
- Accepts PDF, JPG, PNG, DOCX.
- Real-time document completeness check.
- Hash checksum to prevent tampering.

US-VEN-03: Respond to Clarification Requests
As a Vendor, I want to respond to Finance/Procurement clarifications so
the onboarding can proceed.

### 5.3 Line Manager & HOD User Stories

US-LM-01: Approve Vendor Request
As a Line Manager, I want to approve the justification for vendor
creation so that only necessary vendors proceed.

Acceptance Criteria:
- Approve/Reject with comments.
- Cannot modify vendor data.

US-HOD-01: Review High-Level Need
As HOD, I want to validate the departmental need for the vendor.

### 5.4 GM / Executive User Stories

US-GM-01: Final Business Approval
As GM, I want to approve the vendor setup so that Finance can proceed.

Acceptance Criteria:
- Access all documents.
- One-click approve/reject.

### 5.5 Procurement User Stories

US-PROC-01: Validate Vendor Category
As Procurement, I want to validate the vendor category so that correct
tax and risk rules apply.

US-PROC-02: Request Additional Documents
As Procurement, I want to request missing documents from vendor.

### 5.6 Finance Reviewer User Stories

US-FIN-01: Verify Bank Account
As a Finance Reviewer, I want to verify the vendor's bank account to
prevent fraud.

Acceptance Criteria:
- Bank letter upload required.
- Dual approval workflow.

US-FIN-02: Assign Tax Rules
As a Finance Reviewer, I want to apply correct WHT/VAT rules.

### 5.7 Finance Approver User Stories

US-FINAPP-01: Approve Vendor for ERP Sync
As Finance Approver, I want to finalize vendor setup so ERP sync can
occur.

Acceptance Criteria:
- Ensure all documents are complete.
- All mandatory approvals completed.

### 5.8 Compliance/KYC Officer User Stories

US-KYC-01: Validate Legal Documents
As a Compliance Officer, I want to verify corporate registration
details.

US-KYC-02: Assign Vendor Risk Score
As a Compliance Officer, I want to assign a compliance risk score
(Low/Medium/High).

### 5.9 Legal Reviewer User Stories

US-LEGAL-01: Review Contracts
As Legal, I want to validate vendor contracts or retainer agreements.

### 5.10 Tenant Admin User Stories

US-ADMIN-01: Configure Vendor Categories
As Tenant Admin, I want to configure vendor categories.

US-ADMIN-02: Configure Required Documents
As Tenant Admin, I want to manage required fields and document
checklists.

### 5.11 Super Admin User Stories

US-SADMIN-01: Activate Module for Tenants
As Super Admin, I want to enable/disable the vendor onboarding module
for any tenant.

US-SADMIN-02: Configure Global Templates
As Super Admin, I want to manage vendor templates used across all
tenants.

## 6. Business Rules

This section defines the core business rules that govern how the Vendor
Onboarding Module must behave.
All rules are mandatory unless overridden by Tenant Admin
configurations.

### 6.1 Vendor Identity Rules

BR-ID-01: Vendor Name Uniqueness
- Vendor legal name must be unique within a tenant.
- System must detect:
  - Exact duplicates
  - Near-duplicates (e.g., "EventByClaud Ltd" vs "Event By Claud
Limited")
- Uses fuzzy-matching AI for similarity detection.

BR-ID-02: Vendor Email Uniqueness
- A vendor email address cannot be associated with multiple active
vendors.

BR-ID-03: Duplicate Vendor Detection
- System must check duplicates using:
  - Vendor name
  - Tax ID / TIN
  - RC/CAC number
  - Bank account number
  - Phone numbers
- Duplicate risk score must be generated.

BR-ID-04: Vendor Type Classification
- Vendor category must be assigned based on:
  - Requestor input
  - Vendor documents
  - AI analysis
- Final category adjustable by Procurement or Finance.

### 6.2 Document Rules

BR-DOC-01: Required Documents by Category
- Event Agencies must submit:
  - Certificate of Incorporation
  - Tax ID
  - Budget Template (if event/project-based)
  - Agency Contract or Agreement
- Professional Services require Consulting Agreement.
- Clearing Agents require Customs License.
- 3PL require logistics certification + insurance.

BR-DOC-02: Document Completeness Validation
- All required documents must be uploaded before onboarding moves to
Finance.

BR-DOC-03: File Validation Rules
- Supported file formats: PDF, JPG, PNG, DOCX.
- Maximum file size: Tenant-configurable.
- OCR must auto-validate content (e.g., detecting corruption or blank
scans).

### 6.3 Bank Account Verification Rules

BR-BANK-01: Mandatory Bank Verification
- Vendors must upload a bank letter or stamped bank document.
- AI extracts:
  - Bank name
  - Account number
  - Account holder name
- Finance must confirm manually.

BR-BANK-02: Dual Approval for Bank Details
- Any bank account change must require:
  - Finance Reviewer approval
  - Finance Approver approval

BR-BANK-03: Fraud Risk Detection
- System flags:
  - Bank name mismatch with region
  - Recently created accounts
  - Repeated mismatches between invoice name and vendor name

### 6.4 Compliance & KYC Rules

BR-KYC-01: Mandatory Compliance Check
- KYC Officer must validate:
  - Legal documents
  - Tax ID (TIN)
  - CAC/RC number
- High-risk vendors require enhanced due diligence (EDD).

BR-KYC-02: Risk Scoring Method
- Risk score = (Document Completeness + Category Risk + Country Risk +
Historical Issues)
- Categories:
  - Low risk
  - Medium risk
  - High risk (requires GM + Compliance approval)

BR-KYC-03: High-Risk Vendor Lock
- High-risk vendors cannot be activated until Compliance approves.

### 6.5 Workflow & Approval Rules

BR-WF-01: Multi-Level Approval
- Vendor onboarding must follow defined workflow:
  - Requestor → LM → HOD → GM → Procurement → Compliance → Finance
Reviewer → Finance Approver

BR-WF-02: Conditional Approvals
- Event Agencies require Procurement approval.
- Clearing Agents require both Procurement and Compliance approval.
- High-risk vendors require GM approval regardless of amount.

BR-WF-03: Rejection & Resubmission
- Any approver may reject with comments.
- Vendor or Requestor must correct and resubmit.
- System tracks number of rejection cycles.

### 6.6 Expiring Onboarding Links

BR-LINK-01: Link Expiration
- Vendor onboarding link must expire in 30 calendar days.
- Tenant Admin can adjust period (1--90 days).

BR-LINK-02: Link Renewal
- Requestor or Finance can trigger renewal.
- Renewal generates a new secure link.

BR-LINK-03: Link Access Restrictions
- Link is single-use per IP/browser session.
- Vendor must authenticate email OTP to open.

### 6.7 ERP Sync Rules

BR-ERP-01: Mandatory Fields Before Sync
- Vendor cannot be synced unless:
  - Category assigned
  - Tax details verified
  - Bank details approved
  - Compliance approved
  - All required documents validated

BR-ERP-02: Sync Failure Handling
- If ERP rejects data:
  - System logs error
  - Finance notified
  - Approver can correct and retry sync

### 6.8 Vendor Update Rules

BR-UPDT-01: Change Requests
- Requestor or Procurement may initiate vendor update requests.

BR-UPDT-02: Bank Account Change
- Treated as high-risk workflow.
- Requires call-back verification and dual approval.

BR-UPDT-03: Vendor Profile Update
- Email, phone, address updates require:
  - Vendor submission via portal
  - Finance approval
  - Audit logging

### 6.9 Data Retention Rules

BR-RET-01: Vendor Documents
- Must be stored for minimum 7 years (tenant configurable).
- Cannot be deleted while vendor is active.

BR-RET-02: Audit Logs
- Retained permanently or until tenant-defined policy.

## 6. Business Rules

This section defines ALL rules governing vendor creation, validation,
classification, approvals, compliance,
KYC, ERP synchronization, and update workflows. These rules ensure data
integrity, governance, audit compliance,
and alignment with tax authorities and financial regulations.

### 6.1 Vendor Identity & Uniqueness Rules

BR-ID-01: Vendor Name Must Be Unique
- The system must prevent creation of two vendors with identical legal
names under the same tenant.

BR-ID-02: Fuzzy Duplicate Detection
- System flags potential duplicates based on:
  - 80% name similarity
  - Matching phone numbers
  - Matching email domains
  - Matching tax ID (TIN)
  - Matching bank account number

BR-ID-03: Duplicate Detected → Mandatory Finance Review
- If a duplicate is flagged, Finance must approve with a reason.

BR-ID-04: Vendor Cannot Be Activated Without Email Verification
- Onboarding email must be successfully delivered and accessed.

### 6.2 Document & Evidence Rules

BR-DOC-01: Required Documents Based on Category
- Each vendor category (e.g., Event Agency, Clearing Agent, Professional
Services) has specific required documents.

BR-DOC-02: Minimum Required Files
- Vendor must provide ALL mandatory documents before workflow proceeds.

BR-DOC-03: OCR Completeness Rules
- OCR must confirm:
  - Document is readable
  - No pages missing
  - No blank scans

BR-DOC-04: Sensitive Document Encryption
- All bank documents must be encrypted at rest.

### 6.3 Bank Account Verification Rules

BR-BNK-01: Bank Letter Must Be Uploaded
- Mandatory bank letter for all vendors receiving payment.

BR-BNK-02: Dual Approval Required
- Finance Reviewer + Finance Approver must approve bank details.

BR-BNK-03: Callback Verification
- System requires call-back verification to vendor bank contact if
tenant enables this feature.

BR-BNK-04: Bank Account Change Workflow
- Any modification triggers:
  - Identity verification
  - Document re-upload
  - Dual approval

### 6.4 Vendor Category Rules

BR-CAT-01: Vendor Category Determines Tax Logic
- WHT/VAT applicability is derived from category rules.

BR-CAT-02: Category Determines Workflow
- Some categories (e.g., clearing agents) may require extra Finance
steps.

BR-CAT-03: Category Determines Document Checklist
- Event agencies must upload event budgets and retainer agreements.

### 6.5 Tax Classification Rules

BR-TAX-01: Tax Identification Number Required
- Vendors must provide valid TIN before approval.

BR-TAX-02: Non-Resident Vendor Tax Rules
- Non-resident vendors trigger different WHT logic.

BR-TAX-03: Self-Account VAT Rules
- If vendor does not charge VAT, system flags "Reverse VAT".

BR-TAX-04: Tax Rule Override Requires Finance Note
- Tax overrides always require justification.

### 6.6 Compliance / KYC / Risk Rules

BR-KYC-01: KYC Mandatory for All Vendors
- No vendor can be activated without KYC approval.

BR-KYC-02: Risk Scoring Logic
- Risk score calculated from:
  - Document completeness
  - Vendor jurisdiction
  - Vendor category
  - Bank verification results
  - Historical compliance status

BR-KYC-03: High-Risk Vendors Require Enhanced Due Diligence
- Requires additional approvals.

### 6.7 Workflow & Approval Rules

BR-WF-01: Workflow Order Must Be Followed
- Requestor → LM → HOD → GM → Procurement → Finance → Compliance → Legal
(optional)

BR-WF-02: No Step Can Be Skipped
- Attempting to skip results in compliance error.

BR-WF-03: Each Rejection Must Include Comment
- System enforces comment before rejection.

BR-WF-04: Resubmission After Rejection
- Vendor can resubmit corrected form.
- Finance/Procurement may add comments or clarifications.

### 6.8 Vendor Update Rules

BR-UPD-01: Vendor Update Must Be Raised by Employee
- Only designated requestors can initiate vendor updates.

BR-UPD-02: Verification Required for Updates
- Finance must verify bank/account/tax/contact updates.

BR-UPD-03: Vendor Cannot Update Critical Fields Directly
- Sensitive fields (bank account, tax ID) cannot be changed without
Finance workflow.

### 6.9 ERP Sync Rules

BR-ERP-01: Only Fully Approved Vendors Sync
- Vendor must pass ALL steps.

BR-ERP-02: Mandatory Fields for ERP
- Vendor name, category, tax ID, bank details, address, currency.

BR-ERP-03: Sync Failure Handling
- If ERP rejects vendor, Finance receives error and must resolve.

### 6.10 System Rules

BR-SYS-01: Secure Link Expiration
- Onboarding link valid for 30 days.

BR-SYS-02: Auto-Archival of Incomplete Requests
- Requests inactive for >60 days automatically archived.

BR-SYS-03: Document Retention
- Vendor documents retained for minimum 7 years (tenant configurable).

BR-SYS-04: Notifications
- All workflow steps trigger notifications to relevant parties.

## 7. Workflow Diagrams & End-to-End Process Flows

This section contains highly detailed, step-by-step textual workflow
diagrams describing the full lifecycle of vendor onboarding.

### 7.1 Vendor Initiation Workflow

Step 1: Requestor logs into ZivaBI → selects "Create Vendor Onboarding
Request".
Step 2: Requestor enters justification, selects optional vendor
category.
Step 3: System validates requestor permissions and department rules.
Step 4: System generates a pending onboarding request record.
Step 5: System triggers Workflow Step 1 Approval: Line Manager.
Step 6: Line Manager reviews → Approve/Reject.
Step 7: If approved → Workflow Step 2: HOD.
Step 8: HOD reviews → Approve/Reject.
Step 9: If approved → Workflow Step 3: GM/Executive.
Step 10: GM approves → System generates secure vendor onboarding link.
Step 11: System sends onboarding invitation to vendor email.

### 7.2 Vendor Self-Onboarding Workflow

Step 1: Vendor clicks secure link (valid 30 days).
Step 2: System validates link + token + expiry.
Step 3: Vendor form loads with:
- Company details
- Tax info
- Bank details
- Contact info
- Document checklist
Step 4: Vendor uploads documents.
Step 5: OCR service extracts data.
Step 6: ICE engine validates:
- Tax ID format
- Registration number validity
- Bank document authenticity (where possible)
Step 7: Vendor reviews auto-filled fields.
Step 8: Vendor submits form.
Step 9: System logs submission and routes to Procurement.

### 7.3 Internal Multi-Layer Review & Approval Workflow

PROCUREMENT REVIEW
Step 1: Procurement reviews vendor category.
Step 2: Procurement requests missing documents if needed.
Step 3: Procurement approves → routes to Finance Reviewer.

FINANCE REVIEW
Step 4: Finance Reviewer examines:
- Bank account documents
- Tax compliance
- Category logic
- Duplicate vendor alerts
Step 5: Finance Reviewer requests vendor clarification if required.
Step 6: Vendor responds via link.
Step 7: Finance Reviewer approves → routes to Compliance/KYC.

COMPLIANCE / KYC REVIEW
Step 8: KYC officer performs:
- Identity verification
- Risk scoring
- Contract compliance review
Step 9: High-risk vendors → enhanced due diligence.
Step 10: KYC approves → route to Legal (optional).

LEGAL REVIEW (TENANT OPTIONAL)
Step 11: Legal reviews contracts/retainer agreement.
Step 12: Legal approves → route to Finance Approver.

FINANCE APPROVER (FINAL)
Step 13: Finance Approver reviews final vendor packet.
Step 14: Approves → vendor is activated in ZivaBI.
Step 15: System triggers ERP sync.

### 7.4 Vendor Update Workflow

Step 1: Requestor initiates vendor update request.
Step 2: Vendor receives secure link to submit updated details.
Step 3: Vendor modifies requested fields.
Step 4: Finance Reviewer validates updates.
Step 5: Sensitive updates (bank/tax) route to dual approval.
Step 6: Approved changes sync with ERP.
Step 7: System logs complete audit trail.

### 7.5 Bank Account Change Workflow (High Security)

Step 1: Vendor requests bank account update.
Step 2: Vendor uploads:
- Bank letter
- Valid ID
- Support documents
Step 3: OCR/ICE extract & validate data.
Step 4: Finance Reviewer performs:
- Document check
- Fraud check
Step 5: Callback verification (if tenant enabled):
- Finance contacts vendor using existing contact on record.
Step 6: Finance Approver validates change.
Step 7: System updates vendor record + triggers ERP sync.
Step 8: System logs sensitive change audit event.

### 7.6 Duplicate Vendor Handling Workflow

Step 1: System runs fuzzy match:
- Name similarity ≥ 80%
- Bank account match
- TIN match
- Phone/email match
Step 2: If suspicious → system flags duplicate.
Step 3: Workflow pauses.
Step 4: Finance Reviewer must:
- Validate match manually
- Choose: "True Duplicate" or "Allow as New"
Step 5: If true duplicate → request rejected.

### 7.7 Vendor Category & Tax Classification Workflow

Step 1: Vendor selects category (optional).
Step 2: System runs ICE classification based on uploaded docs.
Step 3: Procurement validates the proposed category.
Step 4: Finance applies tax rules:
- WHT rate
- VAT applicability
- Reverse VAT rules
Step 5: Category determines workflow and document requirements.

### 7.8 ERP Synchronization Workflow

Step 1: Vendor marked "Ready for Sync".
Step 2: System prepares vendor master data packet.
Step 3: Mandatory fields checked:
- Legal name
- Tax ID
- Bank details
- Address
- Category
Step 4: System sends vendor data to ERP via:
- API OR
- CSV/XML (tenant choice)
Step 5: ERP responses:
- SUCCESS → vendor activated
- FAILURE → Finance notified + error logged
Step 6: Vendor status updated.

### 7.9 Secure Link Expiration & Regeneration Workflow

Step 1: Vendor link expires after 30 days.
Step 2: Vendor attempting access sees expiry message.
Step 3: Requestor + Procurement notified.
Step 4: Requestor may regenerate link.
Step 5: System issues new link + audit trail event.

### 7.10 Rejection, Exception, and Resubmission Flow

Step 1: Any reviewer can reject with mandatory comment.
Step 2: Vendor/requestor notified instantly.
Step 3: Vendor edits data + uploads missing documents.
Step 4: Resubmitted → workflow resumes from rejecting stage.
Step 5: System maintains full rejection history for audit.

## 8. Data Model & Database Schema

This section defines the complete database schema for the Vendor
Onboarding Module.
All tables include tenant_id for multi-tenant isolation. Primary keys
use UUIDs.

### 8.1 Vendor Master Tables

TABLE: vendor_master
- vendor_id (PK)
- tenant_id (FK)
- legal_name
- trading_name
- vendor_category_id (FK)
- tax_id
- registration_number
- country
- address_line1
- address_line2
- city
- state
- postal_code
- phone_number
- email
- risk_score
- status (Draft, Submitted, Under Review, Approved, Rejected,
Activated)
- created_at
- updated_at

### 8.2 Vendor Contact Information

TABLE: vendor_contacts
- contact_id (PK)
- vendor_id (FK)
- tenant_id
- contact_name
- email
- phone
- role
- is_primary (boolean)
- created_at
- updated_at

### 8.3 Vendor Bank Accounts

TABLE: vendor_bank_accounts
- bank_id (PK)
- vendor_id (FK)
- tenant_id
- bank_name
- account_name
- account_number
- swift_code
- currency
- verification_status (Pending, Verified, Rejected)
- verified_by (User FK)
- created_at
- updated_at

### 8.4 Vendor Documents

TABLE: vendor_documents
- document_id (PK)
- vendor_id (FK)
- tenant_id
- document_type
- file_url
- checksum
- ocr_extracted_data (JSON)
- kyc_verified (boolean)
- created_at
- updated_at

### 8.5 Vendor Category Tables

TABLE: vendor_categories
- vendor_category_id (PK)
- tenant_id
- category_name
- requires_bank_letter (boolean)
- requires_tax_docs (boolean)
- requires_contract (boolean)
- tax_rule_id (FK)
- is_active
- created_at
- updated_at

### 8.6 Tax Rule Tables

TABLE: tax_rules
- tax_rule_id (PK)
- tenant_id
- wht_rate
- vat_rate
- reverse_vat_applicable (boolean)
- non_resident_applicable (boolean)
- created_at
- updated_at

### 8.7 Workflow Tables

TABLE: vendor_workflow_state
- workflow_id (PK)
- vendor_id (FK)
- tenant_id
- current_step
- current_approver_role
- current_approver_id
- status (Pending, In Progress, Awaiting Vendor, Awaiting Finance,
Completed)
- created_at
- updated_at

TABLE: vendor_approval_history
- approval_id (PK)
- vendor_id (FK)
- tenant_id
- approver_id
- approver_role
- action (Approved, Rejected, Returned)
- comments
- created_at

### 8.8 KYC & Compliance Tables

TABLE: vendor_kyc_records
- kyc_id (PK)
- vendor_id (FK)
- tenant_id
- verified_by
- verification_status
- risk_score
- notes
- created_at

### 8.9 Vendor Update Request Tables

TABLE: vendor_update_requests
- update_request_id (PK)
- vendor_id (FK)
- tenant_id
- field_name
- old_value
- new_value
- status (Pending, Approved, Rejected)
- created_at
- updated_at

### 8.10 Link & Token Tables

TABLE: vendor_access_tokens
- token_id (PK)
- vendor_id (FK)
- tenant_id
- token_value
- expires_at
- is_used
- created_at

### 8.11 ERP Sync Tables

TABLE: vendor_sync_log
- sync_id (PK)
- vendor_id
- tenant_id
- status (Pending, Success, Failed)
- error_message
- created_at
- updated_at

### 8.12 Audit Tables

TABLE: vendor_audit_log
- audit_id (PK)
- vendor_id (FK)
- tenant_id
- changed_by
- change_type
- before_state (JSON)
- after_state (JSON)
- created_at

### 8.13 Entity Relationship Overview

vendor_master 1---N vendor_contacts
vendor_master 1---N vendor_documents
vendor_master 1---N vendor_bank_accounts
vendor_master 1---N vendor_approval_history
vendor_master 1---N vendor_kyc_records
vendor_master 1---N vendor_update_requests
vendor_master 1---N vendor_sync_log

vendor_categories 1---N vendor_master
tax_rules 1---N vendor_categories

vendor_master 1---1 vendor_workflow_state

vendor_master 1---N vendor_access_tokens

All tables include tenant_id for strict data isolation.

## 9. API Requirements (Full Endpoint Specification with Examples)

This section provides full, engineering-ready REST API specifications
for the Vendor Onboarding Module.
All endpoints are JSON-based unless otherwise noted. All protected
endpoints require JWT authentication in the
Authorization header: Authorization: Bearer <token>. Every request
must include tenant_id either via JWT claims
or a mandatory header X-Tenant-ID for multi-tenant isolation.

Common error schema:
HTTP 4xx/5xx responses return:
{
\"error_code\": \"VEND_400_DUPLICATE\",
\"message\": \"Human-readable message\",
\"details\": {}
}

### 9.1 API Principles

- RESTful endpoints (versioned): /api/v1/vendor-onboarding/...
- All POST/PUT/PATCH requests are idempotent where applicable
(idempotency-key header recommended).
- Files uploaded via multipart/form-data to /files/upload with returned
file_url (signed URL).
- Audit: All state-changing calls create audit records.
- Role-based access enforced server-side.
- Rate limiting and request validation applied.

### 9.2 Create Onboarding Request (Requestor)

POST /api/v1/vendor-onboarding/requests
Auth: Bearer token (Requestor)
Purpose: Create a vendor onboarding request and trigger approval chain
up to GM.
Request JSON:
{
\"tenant_id\": \"tenant_123\",
\"requestor_id\": \"user_abc\",
\"vendor_name\": \"EventByClaud\",
\"initial_category\": \"EVENT_AGENCY\", // optional
\"justification\": \"Event support for Q4 campaign\",
\"estimated_annual_spend\": 4500000,
\"attachments\": [\"file_uuid_1\",\"file_uuid_2\"] // optional
file references returned from files API
}
Response 201:
{
\"request_id\": \"req_7f9a\",
\"status\": \"pending_lm_approval\",
\"workflow_ticket\": \"wf_00123\"
}
Errors:
- 400 Missing required fields
- 403 Not authorized
- 409 Duplicate vendor suspected (contains duplicate candidates array)

Idempotency: use header Idempotency-Key to avoid duplicates.

### 9.3 Generate Secure Onboarding Link (System/GM triggered)

POST /api/v1/vendor-onboarding/requests/{request_id}/generate-link
Auth: Bearer token (GM or system)
Purpose: Create a secure expiring link to send vendor.
Request JSON:
{
\"expires_in_days\": 30,
\"send_email\": true,
\"email_template_id\": \"tmpl_vendor_invite_v1\"
}
Response 200:
{
\"link_id\": \"link_abc123\",
\"onboarding_url\": \"/onboard/abcd123?token=eyJ...\",
\"expires_at\": \"2025-12-31T23:59:59Z\"
}
Notes:
- Token embedded in link is single-use if tenant enables single-use.
- System will send email when send_email=true. Audit event created.

9.4 Validate Onboarding Token (Public endpoint used by vendor link)

GET /api/v1/vendor-onboarding/token/validate?token={token}
Auth: None (token verifies tenant & request)
Response 200:
{
\"valid\": true,
\"vendor_request_id\": \"req_7f9a\",
\"expires_at\": \"2025-12-31T23:59:59Z\",
\"required_documents\": [\"CAC\", \"TIN\", \"BANK_LETTER\"]
}
Response 400/410 if expired or invalid.

### 9.5 Vendor Submit Onboarding Form (Vendor)

POST /api/v1/vendor-onboarding/submissions
Auth: None (or short-lived vendor JWT after token verification)
Content-Type: application/json
Request JSON:
{
\"token\": \"eyJ...\",
\"company\": {
\"legal_name\": \"Event By Claud Ltd\",
\"trading_name\": \"EventByClaud\",
\"tax_id\": \"TIN12345\",
\"registration_number\": \"RC-98765\",
\"country\": \"NG\",
\"address\": \"12 Lagos Ave\"
},
\"contacts\": [
{\"name\":\"John
Doe\",\"email\":\"john\@claud.com\",\"phone\":\"+2348012345\",\"role\":\"primary\"}
],
\"bank_accounts\":[
{\"bank_name\":\"GTBank\",\"account_name\":\"Event By
Claud\",\"account_number\":\"0123456789\",\"currency\":\"NGN\"}
],
\"vendor_category\":\"EVENT_AGENCY\",
\"documents\": [\"file_1\",\"file_2\"],
\"declarations\": {\"has_related_parties\": false}
}
Response 201:
{
\"submission_id\":\"sub_55aa\",
\"status\":\"submitted_to_procurement\",
\"ocr_summary\": { \"cac_number\":\"RC-98765\",
\"tax_id\":\"TIN12345\" }
}
Errors:
- 400 Missing document (per tenant rules)
- 422 OCR mismatch (system highlights mismatches to support manual
review)

### 9.6 File Upload (multipart) --- used by vendor & internal users

POST /api/v1/files/upload
Auth: Bearer token (or vendor token for anonymous upload linked to
token)
Content-Type: multipart/form-data
Form fields:
- file (binary)
- file_type (e.g., CAC, BANK_LETTER)
- vendor_submission_id (optional)
Response 201:
{
\"file_id\": \"file_abc123\",
\"file_url\": \"s3://tenant123/vendor_docs/file_abc123.pdf\",
\"signed_url\": \"https://s3-presigned-url...\",
\"checksum\":\"sha256:abcd...\"
}
Notes:
- Files scanned for viruses and OCR-read asynchronously (status in file
metadata).
- Upload returns signed_url for temporary download. Permanent storage
path returned in file_url.

### 9.7 OCR Extraction Status (Async webhook + poll)

GET /api/v1/files/{file_id}/ocr-status
Auth: Bearer token
Response 200:
{
\"file_id\":\"file_abc123\",
\"ocr_status\":\"completed\", // pending, failed
\"extracted_data\": { \"company_name\":\"Event By Claud Ltd\",
\"reg_no\":\"RC-98765\" },
\"confidence_scores\": { \"reg_no\":0.98 }
}
Webhook: POST /webhooks/ocr (tenant-provided) on completion with same
payload.

### 9.8 Procurement Review APIs

GET /api/v1/vendor-onboarding/requests/{request_id}
Auth: Bearer token (Procurement, LM, HOD)
Response includes full submission packet and OCR-extracted fields.
POST
/api/v1/vendor-onboarding/requests/{request_id}/procurement-action
Auth: Bearer token (Procurement)
Request JSON:
{
\"action\":\"request_documents\", // approve \| request_documents \|
escalate
\"comments\":\"Need proof of retainer agreement\"
}
Response 200: { \"status\":\"awaiting_vendor_documents\" }

### 9.9 Finance Review API (Detailed)

POST /api/v1/vendor-onboarding/requests/{request_id}/finance-review
Auth: Bearer token (Finance Reviewer)
Request JSON:
{
\"action\":\"approve\", // approve \| reject \| request_info \|
flag_duplicate
\"assigned_tax_rule_id\":\"tax_ng_01\",
\"bank_verification_required\": true,
\"comments\":\"Bank letter valid, but request for KYC evidence\"
}
Response 200:
{
\"status\":\"finance_approved\",
\"next\":\"kyc_review\"
}
Errors:
- 409 Duplicate detected (returns duplicate_candidates array)

### 9.10 KYC / Compliance APIs

POST /api/v1/vendor-onboarding/requests/{request_id}/kyc-action
Auth: Bearer token (KYC Officer)
Request JSON:
{
\"action\":\"approve\", // approve \| reject \|
enhanced_due_diligence
\"risk_score\": 32,
\"notes\":\"Verified registration details via gov portal\"
}
Response 200: { \"status\":\"kyc_approved\" }

### 9.11 Legal Review API (Optional)

POST /api/v1/vendor-onboarding/requests/{request_id}/legal-action
Auth: Bearer token (Legal)
Request JSON:
{ \"action\":\"approve\", \"comments\":\"Contract template ok\" }
Response 200: { \"status\":\"legal_approved\" }

### 9.12 Final Activation & ERP Sync API

POST /api/v1/vendor-onboarding/requests/{request_id}/activate
Auth: Bearer token (Finance Approver)
Request JSON:
{
\"sync_mode\":\"api\", // api \| file_batch
\"erp_target\":\"sage_x3\", // preconfigured per tenant
\"post_to_erp_now\": true
}
Response 200:
{
\"status\":\"activated\",
\"vendor_id\":\"vendor_999\",
\"erp_sync\": {\"status\":\"queued\",\"job_id\":\"sync_321\"}
}
Notes:
- If ERP sync fails, vendor remains active in ZivaBI but flagged in
vendor_sync_log with failure details.

### 9.13 Duplicate Detection API (Detailed)

POST /api/v1/vendor-onboarding/duplicates/check
Auth: Bearer token (Finance)
Request JSON:
{
\"tenant_id\":\"tenant_123\",
\"candidate\": {
\"legal_name\":\"Event By Claud Ltd\",
\"tax_id\":\"TIN12345\",
\"bank_account\":\"0123456789\"
}
}
Response 200:
{
\"duplicate_found\": true,
\"confidence\": 0.92,
\"candidates\": [
{\"vendor_id\":\"vendor_102\",\"legal_name\":\"Eventby
Claud\",\"tax_id\":\"TIN12345\",\"match_reasons\":[\"tax_id\",\"name_sim\"]}
]
}
Actions:
- Finance can call /duplicates/resolve to keep as new or merge/mark
duplicate.

### 9.14 Bank Account Change API (Secure)

POST /api/v1/vendor-onboarding/vendors/{vendor_id}/bank-change
Auth: Bearer token (Finance Reviewer)
Request JSON:
{
\"new_bank_account\": { \"bank_name\":\"GTBank\",
\"account_number\":\"0123456789\", \"account_name\":\"Event By Claud\"
},
\"supporting_documents\": [\"file_abc\"],
\"callback_required\": true
}
Response 200:
{
\"status\":\"bank_change_pending\",
\"verification_id\":\"ver_4545\"
}
Follow-ups:
- /bank-change/{verification_id}/confirm to record callback result &
final approval flow.

### 9.15 Vendor Update APIs (Address, Contact, Tax)

PATCH /api/v1/vendor-onboarding/vendors/{vendor_id}
Auth: Bearer token (Tenant Admin or Finance)
Request JSON (example - change address):
{
\"field_changes\": [{\"field\":\"address_line1\",\"old\":\"12 Lagos
Ave\",\"new\":\"45 Victoria Island\"}],
\"reason\":\"Office relocated\"
}
Response 200: { \"status\":\"update_pending\",
\"update_request_id\":\"upd_101\" }

### 9.16 Vendor Portal --- Vendor Invoice Upload Hook (future)

POST /api/v1/vendor-portal/{vendor_id}/invoices
Auth: Vendor token
Request JSON:
{
\"invoice_number\":\"INV-0012\",
\"amount\": 250000,
\"currency\":\"NGN\",
\"file_id\":\"file_123\",
\"requesting_contact\":\"john\@claud.com\"
}
Response 201: { \"status\":\"received\", \"ap_ticket\":\"ap_998\" }

### 9.17 Audit Pack API

GET
/api/v1/vendor-onboarding/requests/{request_id}/audit-pack?format=zip
Auth: Bearer token (Auditor/Finance)
Response 200:
ZIP containing: submission PDF, documents, approval trail JSON, OCR
outputs, KYC notes, sync logs.

### 9.18 Webhooks (Outbound Events)

Events:
- vendor.submitted
- vendor.approved
- vendor.activated
- vendor.kyc_approved
- vendor.sync_failed

Webhook payload sample for vendor.activated:
{
\"event\":\"vendor.activated\",
\"vendor_id\":\"vendor_999\",
\"tenant_id\":\"tenant_123\",
\"timestamp\":\"2025-11-20T10:00:00Z\"
}

### 9.19 Error Codes (Partial List)

- VEND_400_MISSING_FIELD
- VEND_401_UNAUTHORIZED
- VEND_403_FORBIDDEN
- VEND_404_NOT_FOUND
- VEND_409_DUPLICATE_DETECTED
- VEND_422_OCR_MISMATCH
- VEND_500_INTERNAL_ERROR

### 9.20 Permissions Matrix (excerpt)

- Requestor: create request, view status
- Vendor: submit form & upload docs (via token)
- LM/HOD/GM: view & approve
- Procurement: procurement-action
- Finance Reviewer: finance-review, bank-change actions
- KYC: kyc-action
- Legal: legal-action
- Finance Approver: activate (ERP sync)
- Auditor: audit-pack download (read-only)


---

## 10.0 Introduction to UI/UX Requirements

This UI/UX section defines the complete front-end design standards for
the ZivaBI Vendor Onboarding Module.

It ensures consistency, usability, accessibility, and multi-tenant
branding across:

-   Vendor Portal

-   Employee Portal (Requestor, LM, HOD, GM)

-   Procurement Portal

-   Finance Reviewer/Approver Portal

-   Compliance/KYC Portal

-   Legal Portal

-   Tenant Admin Portal

-   Super Admin Portal

The goal is to deliver a modern, world-class enterprise experience
comparable to:

-   Workday

-   SAP Ariba

-   Coupa

-   Oracle Fusion

-   Netsuite

while remaining:

✔ Lightweight

✔ Mobile-friendly

✔ Configurable per tenant

✔ Easy for non-technical users

✔ Flexible for future modules

UI design emphasizes:

-   Simplicity (clean, intuitive, minimal)

-   Consistency (uniform layout + component behavior)

-   Discoverability (actions are obvious)

-   Transparency (workflow status always visible)

-   Error Prevention (intelligent validation, AI assistance)

-   Speed (fewest clicks possible)

This section contains HIGHLY detailed UI specifications, including:

### ✔ Screen layouts

### ✔ Field-by-field behavior

### ✔ Validation and error messages

### ✔ Mobile & desktop layouts

### ✔ Drag-and-drop zones

### ✔ Document preview UI

### ✔ Workflow timeline components

### ✔ Themes & branding

### ✔ Accessibility (WCAG 2.1 AA)

### ✔ Micro-interactions & animations

### ✔ Multi-step forms

### ✔ Notification UI

This is the foundation that guides the work of designers, frontend
engineers, QA testers, and product owners.

### 10.1 Global UI Design Principles

#### 10.1.1 Design Style

ZivaBI uses a modern, minimal, clean enterprise UI, with:

-   Rounded corners (6px radius)

-   Soft shadows for elevation

-   Neutral color base (tenant can override palette)

-   Light & dark modes

-   Extensive whitespace for clarity

Typography:

-   Primary font: Inter or Roboto

-   Font sizes scale based on device

-   Line spacing optimized for readability

#### 10.1.2 Layout Grid

All screens follow:

-   12-column grid (desktop)

-   6-column grid (tablet)

-   2-column grid (mobile)

Margin standards:

-   Desktop: 24px

-   Tablet: 16px

-   Mobile: 12px

#### 10.1.3 Component Library (Reusable Everywhere)

### ✔ Buttons

Primary (filled), Secondary (outline), Tertiary (text).

States: default, hover, focus, disabled, loading.

### ✔ Inputs

Text fields, dropdowns, date pickers, file upload, chip selectors,
segmented controls.

### ✔ Tabs

Horizontal top tabs for major sections (vendor form sections, workflow
timeline).

### ✔ Cards

Used for vendor summary, document cards, info panels.

### ✔ Tables

Sortable, filterable, scrollable with sticky header.

### ✔ Modals

Centered, standard padding, close on ESC or X icon.

### ✔ Toast Notifications

Appear top-right, auto-dismiss 6s, coded by severity.

### ✔ Stepper / Progress Indicators

For multi-step onboarding and approval stages.

### ✔ Timeline Component

Shows real-time workflow progress with timestamps.

#### 10.1.4 Multi-Tenant Branding & Theming

Each tenant can configure:

-   Primary color

-   Secondary color

-   Accent color

-   Logo & favicon

-   Light or dark mode default

-   Button shape (square/rounded)

-   Typography option

The system automatically adjusts component colors based on theme.

Super Admin can globally apply:

-   Font updates

-   Default spacing

-   Accessibility constraints

#### 10.1.5 Accessibility (WCAG 2.1 AA)

Mandatory guidelines:

-   Color contrast ≥ 4.5:1

-   Keyboard navigable workflow

-   Screen reader labels for all form fields

-   Error messages readable by screen readers

-   Focus outline visible for all interactive elements

-   Avoid tooltip-only information

Validation errors must include:

✔ Red underline

✔ Icon

✔ Error text below field

✔ Screen reader announcement

#### 10.1.6 Mobile Responsiveness

Mobile-first design:

-   Automatic stacking of fields

-   Sticky footer for action buttons

-   Swipe-enabled tabs

-   Modal becomes full-screen sheet

-   File upload uses device camera for scans

-   Document preview uses touch gestures

Vendor onboarding experience must be fully functional on:

-   iPhone

-   Android

-   Mobile browser

-   Tablet

#### 10.1.7 Error Prevention & Recovery

The UI must prevent errors by:

-   Inline validation

-   Real-time duplicate detection alert

-   Required document checklist

-   Vendor cannot submit incomplete form

-   Clear warnings before destructive actions

Error messages must be simple and human-friendly:

Examples:

-   "Please upload your tax document before proceeding."

-   "Bank account name does not match the company name."

-   "Your onboarding link has expired. Request a new one."

#### 10.1.8 Performance Requirements

UI must load:

-   First paint ≤ 1.5 seconds

-   Interactions ≤ 100ms

-   Document preview ≤ 800ms

-   Vendor form autosave every 5 seconds

### 10.2 Vendor Portal UI Requirements

The Vendor Portal is the external-facing interface used by vendors to
complete onboarding, upload documents, respond to clarifications, update
details, and view their onboarding/workflow status. It must be simple,
intuitive, mobile-friendly, and designed for users with minimal
technical background.

The Vendor Portal must require zero training, be fully responsive, and
meet global UX standards.

#### 10.2.1 Vendor Portal Entry Experience

### A. Secure Link Entry Screen

When a vendor clicks the onboarding link, they land on a dedicated entry
screen:

UI Elements:

-   Vendor company logo placeholder (optional)

-   Tenant company logo (branding)

-   "Welcome to Vendor Onboarding" header

-   Expiration notice (e.g., "Link expires on 25-Dec-2025")

-   Button: "Begin Onboarding"

-   Link: "Need help?" (opens help modal)

Validation:

-   If token expired → show "Link Expired" screen

-   If already completed → redirect to login (if vendor portal
    activated)

-   If invalid token → security warning

#### 10.2.2 Multi-Step Onboarding Wizard

Vendor onboarding uses a stepper with 5--7 steps depending on tenant
settings.

### Standard Steps:

1.  Company Information

2.  Contact Information

3.  Tax Information

4.  Bank Details

5.  Document Upload

6.  Declarations

7.  Review & Submit

A progress bar at the top must show:

-   Step title

-   Step number

-   Progress dots

-   Time estimate

Each step autosaves every 5 seconds and saves on navigation.

#### 10.2.3 Step 1 --- Company Information UI

Fields:

-   Legal name (text, required)

-   Trading name (optional)

-   Registration number

-   Country (dropdown)

-   Business address:

    -   Address line 1

    -   Address line 2

    -   City

    -   State/Province

    -   Postal code

UI Behaviors:

-   Country selection dynamically adapts state/province dropdown

-   Address fields use Google Maps or OpenStreetMap autocomplete
    (optional by tenant)

Validation:

-   Registration number must match country formatting

-   Legal name required

-   All required fields highlight in red if empty

#### 10.2.4 Step 2 --- Contact Information UI

Allow multiple contacts with "Add another contact" button.

Contact Card UI:

-   Contact name

-   Email

-   Phone

-   Role (primary, finance, operations, etc.)

-   Checkbox: "Set as Primary Contact"

UI Behaviors:

-   Primary contact always moves to top

-   Email validated in real-time

-   Phone validated using international format

#### 10.2.5 Step 3 --- Tax Information UI

Fields:

-   Tax Identification Number (TIN)

-   VAT registration number

-   Company tax type (resident, non-resident)

-   Country-specific tax fields (tenant configurable)

UI Behaviors:

-   Real-time TIN format validation

-   On blur event: call backend API to validate TIN (if tenant enabled)

-   Tooltip with examples of valid formats

#### 10.2.6 Step 4 --- Bank Details UI

Fields:

-   Bank name

-   Account name

-   Account number

-   Currency

-   SWIFT/BIC code (for international vendors)

-   IBAN (if applicable)

UI Behaviors:

-   Autofill bank name based on account number (tenant-specific
    optional)

-   Real-time validation of account number format

-   Account name must match company name → warning if mismatch

Security Considerations:

-   Vendor must upload bank letter or evidence

-   Vendor cannot view previously submitted sensitive bank data after
    submission

-   Encrypt all bank data at rest

#### 10.2.7 Step 5 --- Document Upload UI

This is one of the most important sections.

Document Checklist UI:

-   Dynamic list of required documents based on vendor category

-   Status indicators:

    -   Not uploaded

    -   Uploaded

    -   OCR in progress

    -   OCR completed

    -   Error

Upload Zone:

-   Drag & drop functionality

-   Button: Upload document

-   Accepts: PDF, JPG, PNG, DOCX

Document Card UI:

-   Thumbnail preview

-   File name

-   File type

-   Size

-   Remove/replace button

-   OCR results link

#### 10.2.8 Step 6 --- Declarations UI

Vendor must confirm checkboxes such as:

-   "All information provided is accurate."

-   "We certify that the bank account belongs to our organization."

-   "We agree to data processing terms."

Must include:

-   Checkbox validation

-   Link to tenant-specific terms & conditions

#### 10.2.9 Step 7 --- Review & Submit UI

Vendor sees a full summary page before submitting:

-   Company information

-   Contacts

-   Tax details

-   Bank details

-   Uploaded documents

-   Declaration summary

Actions:

-   Edit section (jump to step)

-   Submit

-   Download PDF summary (optional)

After submission:

Confirmation Screen:

-   Thank you message

-   Onboarding ID

-   Next steps timeline

-   Contact details for support

#### 10.2.10 Vendor Clarification UI

When Finance/Procurement requests clarifications:

Vendor sees:

-   Clarification message

-   Highlighted fields requiring updates

-   Re-upload document zones

-   Add comment box

-   Submit corrected info

#### 10.2.11 Vendor Status Tracker UI

Vendors can track onboarding progress visually:

Timeline Example:

1.  Vendor Submitted

2.  Procurement Review

3.  Finance Review

4.  KYC/Compliance

5.  Legal Review

6.  Activation

7.  ERP Sync

Each stage shows:

-   Status icon (pending / in progress / completed)

-   Timestamp

-   Reviewer comments

#### 10.2.12 Vendor Portal Dashboard (Post-Onboarding)

Once vendor is approved and activated:

Dashboard shows:

### A. Vendor Information Panel

-   Company name

-   Vendor ID

-   Status (Active)

-   Category

### B. Payment Information Panel

-   Bank details

-   Last verification date

### C. Document Panel

-   All uploaded documents

-   Document expiry reminders

### D. Invoices Panel

-   Recent invoices

-   Invoice upload button (future module)

-   Payment status

#### 10.2.13 Vendor Portal Navigation Structure

Left Sidebar:

-   Dashboard

-   My Profile

-   Documents

-   Invoices (future)

-   Support

-   Logout

#### 10.2.14 Mobile UI Requirements

-   Wizard steps collapse into full-screen swipeable pages

-   Sticky "Continue" button at bottom

-   Upload camera integration

-   Document preview uses pinch-to-zoom

-   Timeline scrolls horizontally

### 10.3 Internal User UI Requirements

(Requestor, Line Manager, HOD, GM, Procurement, Finance Reviewer,
Finance Approver, Compliance/KYC, Legal)

The internal portals are used by employees within the tenant
organization.

They must be:

-   Simple

-   Fast

-   Intuitive

-   Role-based (each user sees only what they should see)

-   Audit-friendly

-   Consistent across all modules

UI must be standard across departments to minimize training and maximize
adoption.

#### 10.3.1 General Internal Portal Structure

Every internal user portal uses the same layout:

### A. Top Navigation Bar

-   Tenant logo

-   Module switcher (AP, Expenses, Vendors, AR, etc.)

-   Search bar (global search: vendor name, request ID, TIN, etc.)

-   Notifications bell

-   User avatar menu (Profile, Settings, Logout)

### B. Left Sidebar (role-based)

-   Dashboard

-   My Tasks

-   Vendor Onboarding

    -   New Vendor Requests

    -   Pending Approvals

    -   All Vendors

    -   Vendor Updates

-   Documents

-   Audit Trail

-   Settings (based on role)

### C. Main Content Area

-   Dynamic section for forms, tables, workflows, vendor profiles

### D. Sticky Footer Actions

-   Save

-   Submit

-   Approve

-   Reject

-   Request Clarification

#### 10.3.2 Requestor UI Requirements

Requestor initiates new vendor creation.

### Requestor Dashboard

Widgets:

-   "My Vendor Requests"

-   "Requests Awaiting My Action"

-   "Vendor Category Distribution"

-   "Recently Activated Vendors"

### Key Actions:

-   Button: "Create New Vendor Request"

-   View workflow timeline

-   Upload supporting justification documents

-   Track vendor onboarding progress

### UI Rules:

-   Requestor CANNOT edit vendor-entered data

-   Requestor CAN edit "justification details"

-   Requestor CAN respond to clarifications

### Status UI:

Each request shows:

-   Request ID

-   Vendor name

-   Current step

-   Who is holding it

#### 10.3.3 Line Manager / HOD / GM UI Requirements

Line Manager, HOD, and GM are part of hierarchical approvals.

### Approval Queue UI

List view with:

-   Request ID

-   Vendor name

-   Requestor name

-   Category

-   Submission time

-   SLA timers (e.g., "3 days left")

### Detail View Components

-   Summary panel (vendor name, category, justification)

-   Vendor-uploaded documents section

-   Timeline component

-   Comment box

-   Approve / Reject / Return buttons

### UI Rules:

-   Approver CANNOT change any fields

-   Approver MUST enter comment when rejecting

-   Approver CAN download all documents

### Visual Cues:

-   Green badge → ready for approval

-   Red badge → missing documents

-   Yellow badge → pending clarification

#### 10.3.4 Procurement UI Requirements

Procurement validates category and documents.

### Procurement Dashboard

Widgets:

-   "Pending Procurement Reviews"

-   "Vendors Awaiting Documents"

-   "Duplicate Suspects"

-   Alerts for missing contracts

### Vendor Review Screen UI

Tabs:

1.  Overview

2.  Vendor Form

3.  Documents

4.  OCR Extracted Data

5.  Category & Risk

6.  Comments

Procurement Actions:

-   Approve

-   Reject

-   Request more documents

-   Update vendor category (if tenant allows)

### Document Completeness Indicator

Statuses:

-   Required

-   Uploaded

-   OCR Complete

-   Missing

-   Unclear (flagged by system)

#### 10.3.5 Finance Reviewer UI Requirements

This is the most critical approval step.

### Finance Dashboard

Widgets:

-   Vendors pending financial review

-   Suspected duplicates

-   Pending bank verification

-   High-risk vendors

-   Pending tax verification

### Finance Vendor Review UI

Special UI components:

#### A. Duplicate Detection Panel

Shows possible matches:

-   Confidence score

-   Similar attribute

-   Quick compare button

#### B. Tax Validation Panel

Show tax rules for category:

-   WHT rate

-   VAT applicability

-   Reverse VAT flag

#### C. Bank Verification Panel

-   Bank letter preview

-   Account name vs company name match indicator

-   "Flag for callback verification" toggle

#### D. OCR Mismatch Panel

Highlighted fields that differ:

-   Tax ID mismatch

-   Company name mismatch

Finance Actions:

-   Approve

-   Reject

-   Request clarification

-   Flag duplicate

-   Require callback verification

#### 10.3.6 Compliance / KYC UI Requirements

KYC reviews legal and regulatory compliance.

### KYC Dashboard

Widgets:

-   Vendors pending identity review

-   High-risk vendors

-   Fraud alerts

-   Missing KYC documents

### KYC Vendor Review UI

UI Components:

-   Risk scoring wheel (0--100)

-   Identity verification status

-   Registration validation (TIN, CAC/RC)

-   Country risk classification

-   Notes panel

Actions:

-   Approve

-   Reject

-   Mark for enhanced due diligence

-   Upload internal compliance notes

#### 10.3.7 Legal UI Requirements

Legal review is optional per tenant.

UI Elements:

-   Vendor contracts

-   Retainer agreements

-   NDAs

-   Compliance notes

-   Document comparison tool

Actions:

-   Approve

-   Reject

-   Request updated contract

#### 10.3.8 Finance Approver (Final) UI Requirements

Final authority before ERP sync.

UI Components:

-   Vendor full profile

-   Approval history timeline

-   Document completeness summary

-   ERP sync readiness status

Actions:

-   Approve & Sync

-   Reject

-   Send back to Finance Reviewer

#### 10.3.9 UX Requirements for ALL Internal Roles

### Mandatory:

-   Every role sees only the actions available to them

-   All actions must log audit trail automatically

-   All pages must load in < 1.8 seconds

-   Every approval screen must include:

    -   Comments box

    -   Document preview

    -   Timeline

### Accessibility:

-   Keyboard approval shortcuts (A = Approve, R = Reject)

-   Screen reader labels

-   High-contrast mode

### 10.4 --- Vendor Master Profile UI Requirements

Copy & paste this directly into your PRD.

### 10.4 Vendor Master Profile UI Requirements

The Vendor Master Profile UI represents the centralized, single source
of truth for all vendor-related information within the ZivaBI ecosystem.
It must be:

-   Clean and highly structured

-   Easy to navigate

-   Rich in detail

-   Fully audit-ready

-   Secure for sensitive data

-   Configurable per tenant

This is the screen Finance, Procurement, Compliance, Legal, and Tenant
Admin will interact with most frequently.

#### 10.4.1 Vendor Master Layout Structure

The Vendor Master Profile page uses a three-panel layout:

### A. Left Panel --- Vendor Summary Card

Always visible (sticky):

-   Vendor name

-   Status badge (Draft, Under Review, Approved, Active, Suspended)

-   Vendor ID

-   Vendor category

-   Vendor type (Resident, Non-resident)

-   Country

-   Created by / Created on

-   Risk score badge (Low/Medium/High/EDD)

### B. Top Bar Tabs

1.  Overview

2.  Company Information

3.  Contacts

4.  Bank Details

5.  Tax Information

6.  Documents

7.  Workflow Timeline

8.  Notes & Comments

9.  Audit Trail

10. ERP Sync Status

11. Change History

12. Settings (Tenant Admin only)

Tabs must be horizontally scrollable on mobile.

### C. Main Content Panel

Dynamic content depending on active tab.

#### 10.4.2 Overview Tab (Default Landing)

This is the executive summary of all vendor information.

### UI Sections:

### 1. Vendor Snapshot Panel

-   Vendor name

-   Category

-   TIN

-   Status

-   Risk score

-   Last updated

### 2. Key Contacts

-   Primary contact

-   Finance contact

-   Operations contact

### 3. Bank Summary

-   Masked account number (e.g., \*\*\*4567)

-   Bank name

-   Currency

-   Verification status badge

### 4. Compliance Summary

-   KYC status

-   Document completeness score

-   Country risk flag (colored badge)

### 5. Workflow Progress

A miniature timeline showing:

-   Completed stages (green)

-   Current step (blue)

-   Pending steps (gray)

### 6. Quick Actions

Buttons:

-   Request Update

-   Suspend Vendor

-   Add Internal Note

-   Download Vendor Packet (PDF)

#### 10.4.3 Company Information Tab

This contains all legal and registration info.

### Fields:

-   Legal name

-   Trading name

-   Registration number

-   Country

-   Address lines

-   State/Province

-   City

-   Postal code

-   Website (optional)

### UI Behaviors:

-   Editable only if user role allows (Finance, Tenant Admin)

-   Change requests automatically trigger workflow

-   Hover tooltip for "Verified by KYC" fields

#### 10.4.4 Contacts Tab

Displays all vendor contacts in card layout:

### Contact Card:

-   Contact name

-   Email

-   Phone

-   Role (primary/finance/operations)

-   Tags (Verified, Unverified)

-   Edit / Delete buttons (permissions-based)

### UI Rules:

-   At least one Primary Contact is required

-   Deleting primary contact triggers a prompt

-   Email format validated on edit

-   Phone auto-formats based on country code

#### 10.4.5 Bank Details Tab

Sensitive financial data UI must be extremely secure.

### Bank Information Card:

-   Bank name

-   Account name

-   Account number (masked, only last 4 digits visible)

-   SWIFT/BIC / IBAN (if applicable)

-   Currency

-   Verification status & timestamp

-   Verified by (user)

-   Supporting document link

### Security UI Rules:

-   Account number fully visible only to:

    -   Finance Reviewer

    -   Finance Approver

    -   Tenant Admin

-   All other roles see masked version

-   Update Bank Details → opens secure modal with MFA (if tenant
    enabled)

### Actions:

-   Initiate Bank Change Request

-   View Verification History

-   Preview Bank Letter (PDF)

#### 10.4.6 Tax Information Tab

Tax logic is essential for AP integration.

### Fields:

-   Tax Identification Number (TIN)

-   VAT registration number

-   Tax residency

-   WHT rule

-   VAT rule

-   Reverse VAT status

-   Non-resident classification

### Tag Indicators:

-   Verified

-   Mismatch detected (ICE)

-   Requires update

### UI Behavior:

-   Changing tax residency triggers full Finance review reroute

-   Updated tax rules reflect in AP module immediately

#### 10.4.7 Documents Tab

Shows all uploaded documents in a grid layout.

### Document Cards:

-   Thumbnail preview

-   Name of document

-   Type (CAC, TIN, Bank Letter, etc.)

-   Upload date

-   OCR status

-   Expiry date (if applicable)

-   Replace / View / Download buttons

### Additional UI Features:

-   Bulk upload

-   Bulk download as ZIP

-   Document history (version control)

-   "OCR Mismatch" badge on flagged files

#### 10.4.8 Workflow Timeline Tab

Extremely important for transparency and audit completeness.

### Timeline UI:

Each step appears as a node:

-   Step name

-   Status (Pending, In Progress, Completed, Rejected)

-   Date/time stamp

-   Reviewer/Approver name

-   Comments (click to expand)

Rejected steps appear in red with reason.

Clarification loops are displayed as sub-steps.

#### 10.4.9 Notes & Comments Tab

Internal-only notes:

-   Finance notes

-   Compliance notes

-   Procurement notes

-   Legal notes

UI:

-   Rich text editor

-   Timestamp

-   User name

-   Category tag (Finance/Legal/etc.)

-   Search notes

#### 10.4.10 Audit Trail Tab

Shows ALL events related to the vendor.

Columns:

-   Timestamp

-   User

-   Action

-   Before state (JSON pretty formatted)

-   After state (JSON pretty formatted)

-   IP address

Filters:

-   Date range

-   Action type

-   User

Export:

-   PDF

-   CSV

-   JSON

#### 10.4.11 ERP Sync Status Tab

Shows integration lifecycle.

### Fields:

-   Last sync status (Success / Failed / Pending)

-   ERP reference ID

-   Error logs (if any)

-   Retry button

-   Sync history table

#### 10.4.12 Change History Tab

Shows detailed versioning of:

-   Company info

-   Contacts

-   Bank details

-   Tax details

-   Documents

UI:

-   Side-by-side diff view

-   Highlighted changes in green (added), red (removed), yellow
    (modified)

#### 10.4.13 Settings Tab (Tenant Admin Only)

Admin settings include:

-   Vendor category override

-   Activate/deactivate vendor

-   Rename fields

-   Configure custom fields

-   Manage document templates

-   Toggle advanced validation rules

### 10.5 Procurement UI Requirements

The Procurement team plays a critical role in the vendor onboarding
workflow. Their UI must enable efficient validation of vendor category,
completeness of procurement-related documents, contract-handling, and
coordination with Requestor, Vendor, and Finance.

The Procurement UI must prioritize:

-   Speed of review

-   Document clarity

-   Easy category assignment

-   Compliance with procurement policies

-   Clear communication and comments

-   Visibility of workflow status

#### 10.5.1 Procurement Dashboard

Procurement users see a dedicated dashboard upon login or module entry.

### Dashboard Widgets

-   Pending Procurement Reviews

    Displays count and list of vendors awaiting Procurement action.

-   Vendors Awaiting Documents

    Vendors whose submissions are incomplete or require more
    documents.

-   High-Risk Vendors (KYC Flagged)

    Highlight vendors flagged by Compliance.

-   Duplicate Vendor Suspects

    Vendors whose names or details match existing vendor records.

-   Documents Missing / Invalid

    Automatically detected via OCR or category rules.

### Dashboard Table Columns

-   Vendor Name

-   Category (proposed)

-   Status

-   Submission Date

-   Requested By

-   SLA Timer (e.g., "2 days remaining")

-   Action Button (Review)

Filtering Options:

-   Status

-   Category

-   Country

-   Submission Date

-   Vendor Risk Score

#### 10.5.2 Procurement Review Screen (Core UI)

When procurement selects a vendor to review, they see a powerful
multi-tab review interface.

### A. Vendor Summary Header Bar

Always visible at the top:

-   Vendor Name

-   Category (tag + color-coded)

-   Vendor ID

-   TIN

-   Status

-   SLA countdown

-   Last updated timestamp

### B. Tab Structure

Procurement receives access to the following tabs:

1.  Overview

2.  Vendor Form Details

3.  Documents

4.  OCR Extracted Data

5.  Category & Tax Logic

6.  Clarifications

7.  Workflow Timeline

8.  Internal Notes

Tabs must be responsive and scrollable on mobile.

#### 10.5.3 Overview Tab (Procurement View)

Shows a summarized view relevant to procurement:

### Sections:

-   Vendor Snapshot

-   Business Justification (from Requestor)

-   Proposed Category (system + requestor)

-   Document Completeness Indicator

-   Duplicate Warning Banner (if triggered)

### Duplicate Warning Banner UI:

Red or yellow bar with:

"Possible duplicate vendor detected (92% match). Compare now."

Button: Compare Vendors → Opens side-by-side modal.

#### 10.5.4 Vendor Form Details Tab

Procurement sees read-only version of all vendor-entered fields:

### Fields Visible:

-   Company info

-   Contacts

-   Address

-   Country classification

-   Bank details

-   Tax details

Procurement CANNOT edit these fields.

Procurement CAN flag inconsistencies.

#### 10.5.5 Documents Tab (Procurement View)

A powerful feature for procurement verification.

### Document Grid UI:

Each document card shows:

-   Thumbnail preview

-   Document type (CAC/TIN/Bank Letter)

-   Upload date

-   OCR status tag

-   "View OCR Output" link

-   "Flag Issue" button

-   Replace button (for vendor re-upload requests)

Icons:

-   Green check → Validated

-   Orange exclamation → Attention needed

-   Red cross → Missing/Invalid

### Procurement Actions on Documents:

-   Request vendor to upload a missing document

-   Request vendor to replace unclear or invalid document

-   Add document-specific comment

-   Mark document as verified

#### 10.5.6 OCR Extracted Data Tab

OCR-powered UI helps procurement review:

### UI Items:

-   Split view: Document preview left, OCR output right

-   Color-coded confidence indicators

-   Highlight mismatched values (e.g., Company Name doesn't match form
    input)

-   Option to mark OCR result as accepted or override

### Procurement Tools Available:

-   "Mark mismatch and request correction"

-   "Accept mismatched field with explanation"

-   "Flag for Finance/KYC review"

#### 10.5.7 Category & Tax Logic Tab

This is one of procurement's main responsibilities.

### UI Elements:

-   Current category (e.g., EVENT AGENCY, CLEARING AGENT, PROFESSIONAL
    SERVICES)

-   System-suggested category (based on AI + documents)

-   Dropdown to change category (if permitted by tenant)

-   Document requirements list (auto adjusted by category)

-   Tax applicability table:

    -   WHT applicable (Yes/No)

    -   WHT rate (%)

    -   VAT applicable (Yes/No)

    -   Self-account VAT (Reverse VAT)

-   Country risk classification (imported from tenant settings)

### Rules:

-   Changing category triggers:

    -   Document checklist refresh

    -   New workflow conditions

    -   Tax recalculations

#### 10.5.8 Clarifications Tab

Procurement can request clarifications from:

-   Vendor

-   Requestor

-   Finance

### UI Components:

-   Comment threads (chat-like)

-   Attachments in comments

-   Tagging ability: "\@Vendor", "\@Finance", "\@Requestor"

-   Status indicators (Pending / Responded / Closed)

-   "Request More Information" button

#### 10.5.9 Workflow Timeline Tab

Shows procurement's position in workflow.

### Timeline Node Details:

-   Node name: "Procurement Review"

-   Start time

-   Completion time

-   Comments

-   Escalations (if any)

-   SLA warnings

Procurement must be able to view previous approver notes.

#### 10.5.10 Internal Notes Tab

Procurement can record internal-only notes, not visible to vendor.

UI:

-   Rich-text notes

-   Timestamp

-   Visible only to internal roles

-   Searchable notes

-   Capability to categorize notes (Procurement, Risk, Finance, etc.)

#### 10.5.11 Procurement Action Panel (Sticky Right Panel)

Procurement sees a dedicated panel for actions:

### Actions:

-   Approve Vendor for Finance Review

-   Reject Vendor

-   Request Additional Documents

-   Send Clarification to Vendor

-   Update Category (if allowed)

Buttons are color-coded:

-   Approve = Green

-   Reject = Red

-   Request Info = Yellow

-   Update Category = Blue

#### 10.5.12 Validation Before Approving

Procurement CANNOT approve unless all Rules are met:

-   Required category documents uploaded

-   No unresolved OCR mismatches

-   Duplicate review completed if duplicate was flagged

-   All clarifications resolved

-   KYC flags (if any) acknowledged

If validation fails → Modal appears listing missing items.

#### 10.5.13 Procurement Rejection UI

If rejecting, mandatory fields appear:

-   Reason for rejection (textarea)

-   Attach supporting evidence (optional)

Vendor and Requestor receive notifications instantly.

#### 10.5.14 Procurement Mobile UI Requirements

Mobile must support:

-   All actions

-   Document preview

-   OCR preview

-   Side-by-side vendor comparison (stacked vertically)

-   Sticky approve button

-   Swipeable tabs

### 10.6 Finance & KYC UI Requirements

Finance and Compliance/KYC are the core risk-control stakeholders in
Vendor Onboarding.

Their UI must be extremely detailed, audit-friendly, and optimized for
risk detection, tax validation, and sensitive data handling.

This section describes the complete UI/UX requirements for:

-   Finance Reviewer

-   Finance Approver

-   Compliance/KYC Officer

Each screen must support:

✔ Deep review

✔ Document verification

✔ Duplicate detection

✔ Tax logic validation

✔ Risk scoring

✔ Security

✔ Audit trail

✔ Clear decision-making

#### 10.6.1 Finance Reviewer Dashboard

Finance Reviewer sees the most advanced dashboard of all roles.

### Dashboard Widgets:

1.  Pending Finance Reviews

2.  Vendors Requiring Bank Verification

3.  Duplicate Vendor Suspects

4.  Vendors With OCR Mismatches

5.  High-Risk Vendors (KYC Flagged)

6.  Pending Clarifications (Vendor reply pending)

7.  Mandatory Tax Checks Failing

### Dashboard Table Columns

-   Vendor Name

-   Category

-   Risk Level

-   Duplicate Score % (if flagged)

-   Pending Task (e.g., "Verify Bank Account")

-   Time in Queue

-   SLA Remaining

-   Action Button (Review)

### Filters:

-   Category

-   Risk score

-   Country

-   Duplicate flag

-   Bank verification pending

-   Tax status

-   Date

#### 10.6.2 Finance Review Screen (Core UI)

The Finance review screen is a multi-panel interface designed for deep
validation.

### UI Layout Structure

-   Left Sidebar → Vendor summary

-   Top Tabs → Details, Documents, Duplicate Check, Bank Check, Tax
    Logic, OCR Mismatch, History

-   Right Action Panel → Approve / Reject / Request Clarification / Flag
    Duplicate

#### 10.6.3 Left Sidebar --- Finance Summary Panel

The sticky left panel always displays:

### Vendor Basic Summary

-   Vendor name

-   Vendor ID

-   Category

-   Country

-   Risk level badge

-   Status

-   SLA countdown

### Finance-Specific Summary

-   Tax ID

-   Bank account (masked)

-   VAT registration

-   WHT applicability

-   KYC status

-   Duplicate detected: Yes/No

#### 10.6.4 Top Tab Structure for Finance

Tabs available to Finance Reviewer:

1.  Overview

2.  Vendor Form Data

3.  Bank Verification

4.  Tax Validation

5.  Duplicate Detection

6.  OCR Mismatch Report

7.  Documents

8.  Clarifications

9.  Workflow Timeline

10. Internal Notes

#### 10.6.5 Overview Tab (Finance View)

Shows Finance-critical summary:

### Sections:

-   Vendor Legal Details

-   Category

-   Tax Summary (WHT %, VAT applicability, Reverse VAT flag)

-   Document Summary (missing/invalid)

-   Duplicate Summary (with confidence scores)

-   Bank Verification Summary

-   KYC Summary

#### 10.6.6 Vendor Form Data Tab

Finance reviews details but does not modify.

### Differences from Procurement View:

-   Finance sees raw OCR values alongside vendor-entered values

-   Differences are highlighted automatically

-   "Mark mismatch as intentional" button

-   "Send back for correction" button

#### 10.6.7 Bank Verification Tab

This is the most sensitive section.

### Bank Info Panel:

-   Bank name

-   Account name

-   Account number (full visible only to Finance)

-   Currency

-   SWIFT/BIC/IBAN if applicable

-   Verification status

### Supporting Documents Panel:

-   Bank Letter preview (PDF viewer)

-   Optional additional verification documents

### Verification Tools:

-   "Auto-verify name match" (compares company name to bank account
    name)

-   "Mark for callback verification" (Finance enters callback notes)

-   "Flag suspicious document"

-   "Approve bank details"

### Callback Workflow UI:

-   Phone/Email used

-   Timestamp of verification

-   Callback result

-   Notes

#### 10.6.8 Tax Validation Tab

Shows the final tax classification for the vendor.

### UI Elements:

-   Tax Identification Number (TIN)

-   VAT Registration Number

-   Residency status (Resident/Non-resident)

-   Tax rules determined by system:

    -   WHT applicable?

    -   WHT rate

    -   VAT applicable?

    -   Reverse VAT required?

-   Country-based tax compliance (from tenant settings)

### Finance Actions:

-   Approve tax details

-   Override tax rule (with justification)

-   Send vendor back for correction

-   Send procurement back to adjust category

#### 10.6.9 Duplicate Detection Tab

A specialized screen for fraud prevention.

### UI Components:

A. Duplicate Alert Banner

-   Confidence score (e.g., 94%)

-   Matching attributes (TIN, name similarity, phone, etc.)

-   Button: Open Comparison Panel

B. Side-by-Side Vendor Comparison Modal

Left: New vendor

Right: Existing vendor

Comparing:

-   Company name

-   TIN

-   Bank account

-   Contacts

-   Country

-   Documents

-   Risk score

Color coding:

-   Green → Match acceptable

-   Yellow → Suspicious

-   Red → High-risk mismatch

### Finance Actions:

-   "Approve as Unique Vendor"

-   "Mark as Duplicate → Reject"

-   "Merge / Link to Existing" (if tenant allows)

#### 10.6.10 OCR Mismatch Report Tab

Shows mismatched fields discovered by AI vs vendor entry.

### UI Components:

-   Field name

-   OCR value

-   Vendor-entered value

-   Confidence score

-   Severity indicator

Actions:

-   Accept vendor value

-   Accept OCR value

-   Request correction

-   Auto-fill corrected fields

#### 10.6.11 Documents Tab (Finance Version)

Enhanced version of Procurement Documents Tab.

Additional abilities:

-   Mark document as fraud-risk

-   Tag document as "low quality"

-   Compare multiple versions of same document

-   Open audit trail for document

#### 10.6.12 Clarifications Tab (Finance)

Finance can:

-   Request vendor clarification

-   Request procurement clarification

-   Request requestor clarification

-   Upload supporting documents

-   See full thread

#### 10.6.13 Workflow Timeline Tab (Finance)

Extended details for Finance:

-   All timestamps

-   Approver name & role

-   SLA breaches highlighted

-   Rejection reasons visible

-   Loopbacks shown clearly

#### 10.6.14 Internal Notes Tab

Finance can add confidential notes.

Categories:

-   Tax

-   Bank verification

-   Risk

-   Fraud suspicion

-   General

Notes are timestamped and user-tagged.

#### 10.6.15 Finance Approver UI Requirements

Finance Approver is the final internal authority before activating
vendor and syncing to ERP.

### Approver Actions:

-   Approve vendor setup

-   Reject back to Finance Reviewer

-   Add final note

-   Approve bank verification

-   Trigger ERP sync immediately

-   Queue ERP sync

### Approver UI:

-   Full vendor summary

-   All documents

-   Workflow summary

-   ERP sync readiness panel

-   Pre-sync validation warnings

#### 10.6.16 KYC / Compliance UI Requirements

The KYC Officer ensures regulatory compliance.

### KYC Dashboard Widgets:

-   Pending KYC reviews

-   High-risk jurisdiction vendors

-   Vendors missing critical documents

-   Identity mismatch alerts

-   Fraud indicators

### KYC Review Screen Tabs:

-   Identity Check

-   Document Legitimacy Check

-   Country Risk

-   Vendor Risk Scoring

-   Notes & Comments

### Identity Check Panel:

-   Registration number

-   Legal name

-   TIN

-   Jurisdiction

-   Verification method (manual/API)

-   Verification timestamp

### Country Risk UI:

-   Color-coded risk flags

-   Sanctioned list check (if tenant enabled)

### Vendor Risk Score UI:

-   Circular dial showing score 0--100

-   Risk category: Low/Medium/High/EDD

-   Automated risk scoring explanation table

### KYC Actions:

-   Approve

-   Reject

-   Mark EDD (Enhanced Due Diligence)

-   Upload KYC notes

-   Link external KYC report

#### 10.6.17 KYC Document Verification Tools

Tools available to KYC:

-   Document authenticity checker

-   OCR validation panel

-   Signature verification (basic checksum)

-   Government registry lookup integration (optional)

#### 10.6.18 KYC Decision Validation

KYC cannot approve if:

-   Country is prohibited

-   TIN mismatch unresolved

-   Document authenticity not confirmed

-   Risk score > 80 and no EDD approved

-   Required documents missing

KYC must provide:

-   Decision

-   Reason

-   Notes

-   Evidence (optional upload)

### 10.7 Legal UI Requirements

The Legal review step is optional per tenant configuration, but when
enabled, it plays a crucial role in validating:

-   Vendor contracts

-   Retainer agreements

-   NDAs

-   Compliance with legal requirements

-   Regulatory documentation

-   Special licenses or permits

Legal review is often the final gate before Finance Approver activates a
vendor.

Therefore, the Legal UI must prioritize:

✔ Clarity

✔ Document accuracy

✔ Comparison capability

✔ Contract consistency

✔ Auditability

✔ Security

The interface must make it easy for legal staff to detect missing
documentation, inconsistencies, and contractual risks.

#### 10.7.1 Legal Dashboard

The Legal dashboard provides a consolidated view of pending, active, and
completed reviews.

### Dashboard Widgets

-   Pending Legal Reviews

-   Vendors With Missing Contract Documents

-   Vendors With Conflicting Contract Terms (auto-detected by OCR + ICE)

-   Documents Awaiting Re-upload

-   Legal Notes Pending Approval

### Dashboard Table Columns

-   Vendor name

-   Requestor

-   Category

-   Required legal document status

-   Date submitted

-   SLA timer

-   Action button (Review)

### Filters:

-   Status

-   Vendor category

-   Contract type

-   Date submitted

#### 10.7.2 Legal Review Screen Layout

The Legal Review Screen contains:

### A. Sticky Left Panel --- Vendor Legal Snapshot

Always visible:

-   Vendor name

-   Category

-   Status

-   Contract required? (Yes/No)

-   Contract uploaded? (Yes/No)

-   NDA required? (Yes/No)

-   NDA uploaded? (Yes/No)

-   Legal risk badge (Low/Medium/High)

-   SLA timer

#### 10.7.3 Top-Level Tabs for Legal Review

Legal users see the following tabs:

1.  Overview

2.  Contracts & Agreements

3.  Document Comparison Tool

4.  Document Legitimacy (OCR-based)

5.  Legal Notes

6.  Workflow Timeline

7.  Audit Trail

#### 10.7.4 Overview Tab

Legal sees a summary tailored to legal concerns:

### Sections:

-   Vendor basic information

-   Business justification

-   Category-specific legal requirements

-   Contract & agreement status

-   Country jurisdiction and risk flag

-   Expiry dates for uploaded legal documents

### Automated Alerts:

-   Missing required legal documents

-   Expired or expiring documents

-   Contract inconsistencies detected by AI

-   Non-resident vendor legal compliance required

#### 10.7.5 Contracts & Agreements Tab

This is the core workspace for legal review.

### Document Cards Display:

Each contract/agreement card includes:

-   Thumbnail preview

-   Document name

-   Type (Contract, Retainer Agreement, NDA, License, Permit, etc.)

-   Uploaded by

-   Upload date

-   OCR status

-   Validity/Expiry date (if applicable)

-   Document version number

-   Buttons:

    -   Preview

    -   Download

    -   Mark as Valid

    -   Request Replacement

    -   Add Comment

### UI Behaviors:

-   Preview documents inline in a large modal

-   Supports PDF, DOCX, and image formats

-   Side-by-side comparison available

-   Version history visible

#### 10.7.6 Document Comparison Tool

A powerful feature for legal review.

### Comparison UI

-   Split-screen comparison

    -   Left: Current version

    -   Right: Previous version / template version

-   Auto-highlight differences:

    -   Added text (green)

    -   Removed text (red)

    -   Modified text (yellow)

-   Clause comparison matrix:

    -   Clause name

    -   Old text

    -   New text

### Automated Legal Intelligence (ICE AI):

AI flags:

-   Unusual contract terms

-   Missing standard clauses

-   Liability inconsistencies

-   Payment terms outside policy

-   Termination clauses outside threshold

Legal can:

-   Accept AI flag

-   Dismiss flag

-   Add notes

#### 10.7.7 Document Legitimacy Tab (AI-Enhanced)

This tab helps Legal check authenticity of legal documents.

### AI/OCR Legitimacy Checks

-   Signature detection

-   Seal verification (if image-based)

-   Company name match

-   Registration number match

-   Mismatch highlights

-   Document tampering detection (checksum mismatch)

### UI Components:

-   List of documents analyzed

-   Legitimacy score (0--100)

-   "Potential tampering detected" warnings

-   "Document integrity verified" badge

-   "Require manual verification" toggle

#### 10.7.8 Legal Notes Tab

A dedicated internal-only notes space.

### Features:

-   Rich text editor

-   Insert citations

-   Upload supporting files

-   Add hyperlinks

-   Timestamped notes

-   Visibility restricted to Legal, Finance, Compliance

-   Tag notes by category:

    -   Contract Risk

    -   Regulatory Compliance

    -   Missing Information

    -   Legal Exception

#### 10.7.9 Workflow Timeline Tab

Shows legal's position in the workflow.

### Timeline Node for Legal:

-   Name: Legal Review

-   Status (Pending / In Progress / Completed / Rejected)

-   Reviewer name

-   Time started

-   Time completed

-   Rejection comments (if any)

-   Requests for clarification

#### 10.7.10 Audit Trail Tab (Legal Version)

Legal sees all audit logs but filtered to legal-relevant fields.

Fields shown:

-   Contract uploads

-   Contract replacements

-   Document comparisons

-   Legal approvals or rejections

-   Legal note additions

-   AI contract anomaly flags

Filters:

-   Date

-   Document type

-   Reviewer

-   Action

Export:

-   PDF

-   CSV

#### 10.7.11 Legal Action Panel (Sticky Right Panel)

Actions Legal can take:

### Primary Buttons:

-   Approve Legal Review (green)

-   Reject (red)

-   Request Document Replacement (yellow)

-   Request Clarification (blue)

### Mandatory Fields When Rejecting

-   Reason (textarea)

-   Attach supporting evidence (optional uploaded file)

### Clarification Workflow

Legal can target:

-   Vendor

-   Procurement

-   Finance

-   Requestor

#### 10.7.12 Legal Mobile UI Requirements

The legal process must also work seamlessly on mobile.

### Mobile considerations:

-   Full-screen document preview

-   Swipe-left/right for document comparison

-   Sticky Approve/Reject bar at bottom

-   Collapsible legal notes

-   Tap-to-enlarge clause highlights

### 10.8 Tenant Admin UI Requirements

The Tenant Admin portal is one of the most powerful parts of the Vendor
Onboarding Module.

Tenant Admins manage all onboarding rules, templates, workflows,
categories, document requirements, tax settings, portal settings, and
permissions specific to their organization.

The UI must be:

-   Highly intuitive

-   Safe and secure

-   Fully audited

-   Clear about dependencies

-   Configurable with minimal training

-   Protected from misconfiguration

The Tenant Admin has NO access to vendor transaction data, invoices, or
operational AP entries unless assigned additional roles.

This section outlines the Enterprise-Grade UI/UX Requirements for Tenant
Admin.

#### 10.8.1 Tenant Admin Dashboard

The dashboard provides full control and visibility of vendor-related
configurations.

### Dashboard Widgets

1.  Active Vendor Categories

2.  Document Templates in Use

3.  Approval Workflow Summary

4.  Compliance Requirements Enabled

5.  Bank Verification Settings

6.  Incomplete Vendor Configurations

7.  Recent Configuration Changes

8.  Theme/Branding Status

Each widget is clickable and opens its corresponding configuration
panel.

#### 10.8.2 Navigation Menu (Left Sidebar)

Tenant Admin sees a dedicated section:

-   Dashboard

-   Vendor Categories

-   Required Documents

-   Approval Workflow

-   Tax Rules

-   Bank Verification Rules

-   Field Name Customization

-   KYC Requirements

-   Branding & Theming

-   Permissions & Roles

-   Notification Templates

-   Integration Settings

-   Audit Logs

-   System Health

#### 10.8.3 Vendor Categories Management UI

Tenant Admin configures categories such as:

-   Professional Services

-   Event Agency

-   Clearing Agent

-   3PL / Logistics

-   Supplier

-   Contractor

-   One-Off Vendor

-   Import/IC Vendor

### UI Elements:

-   Category list view

-   "Add Category" button

-   Editable category name

-   Category description

-   Toggle: Active / Inactive

-   Icon selector

### Category Configuration Panel:

-   Required documents (checkbox list)

-   Tax rules linked

-   Workflow overrides

-   KYC requirements

-   System AI classification mapping

#### 10.8.4 Required Document Configuration

Tenant Admin defines which documents are mandatory per category.

### Document Matrix UI:

A grid layout (rows = categories, columns = document types):

Documents include:

-   CAC / Registration Cert

-   TIN / Tax Certificate

-   Bank Letter

-   NDAs

-   Retainer Agreements

-   Import License

-   Regulatory Certificates (tenant-specific)

UI Features:

-   Multi-select checkboxes

-   Hover tooltips explaining each document

-   Upload sample/template document

-   Set document expiry cycle (e.g., 12 months)

-   Toggle for OCR validation requirement

#### 10.8.5 Approval Workflow Configuration UI

Each tenant can define multi-level approval workflows, including:

### Possible Roles:

-   Requestor Manager (LM)

-   HOD

-   GM

-   Procurement

-   Finance Reviewer

-   Compliance/KYC

-   Legal

-   Finance Approver (Final)

### Workflow Designer UI:

Drag-and-drop interface:

-   Drag roles to the workflow sequence

-   Add conditional steps (e.g., "If vendor category is Clearing Agent →
    add Compliance step")

-   Add parallel approvals

-   Add escalation rules

-   Add SLA time limits

-   Enable reminders

### Conditions UI:

-   Based on vendor category

-   Based on country

-   Based on annual spend

-   Based on risk score

### Validation Rules:

-   At least one Finance role is mandatory

-   Avoid circular workflows

-   Workflow preview required before saving

#### 10.8.6 Tax Rules Configuration UI

Tenant Admin sets tax rules per category or globally.

### Fields:

-   WHT applicable?

-   WHT rate %

-   VAT applicable?

-   Reverse VAT (Self-Account VAT) toggle

-   Non-resident vendor rules

### UI Features:

-   Editable tax table

-   Tooltip with country-specific regulations

-   Auto-apply system rules to AP module

-   Tax rule versioning (history view)

#### 10.8.7 Bank Verification Configuration UI

Tenant Admin controls how bank verification works.

### Settings Include:

-   Require bank letter? (Yes/No)

-   Require callback verification? (Yes/No)

-   Require dual approval? (Yes/No)

-   Automatically mask account numbers for non-finance?

-   Map validation rules for country-specific banking formats

-   Enable auto-match (account name vs company name)

#### 10.8.8 Field Name Customization UI

Tenant Admin can rename fields to match internal language/terminology.

### Examples:

-   "TIN" → "Tax ID"

-   "Registration Number" → "Business Reg No"

-   "Vendor Category" → "Supplier Type"

### UI:

-   Table with:

    -   System Field Name

    -   Custom Field Name

    -   Reset to Default button

Changes must reflect immediately across:

-   Forms

-   Workflow screens

-   Audit logs

-   Reports

#### 10.8.9 KYC Requirements Configuration UI

Tenant Admin defines the KYC process depth.

### KYC Configuration Fields:

-   Identity documents required

-   Country risk mappings

-   Mandatory compliance checks

-   Enhanced due diligence thresholds

-   Secondary document requirements

-   Automated KYC API integration toggle

UI includes:

-   Risk score threshold sliders

-   Country risk profile editor

#### 10.8.10 Branding & Theming UI

Tenant-level customization UI.

### Options:

-   Upload logo

-   Upload favicon

-   Primary color

-   Secondary color

-   Accent color

-   Light or Dark theme default

-   Typography choice (Inter/Roboto/etc.)

-   Button styling

-   Login background image

### Theme Preview:

Live preview panel showing changes before publishing.

#### 10.8.11 Permissions & Roles UI

Tenant Admin dictates what each role can do.

### Roles:

-   Requestor

-   LM

-   HOD

-   GM

-   Procurement

-   Finance Reviewer

-   Finance Approver

-   KYC

-   Legal

-   Auditor

-   Tenant Admin

### Permissions Table:

Rows = features

Columns = roles

Features include:

-   View vendor

-   Edit vendor

-   Approve

-   Reject

-   Request clarifications

-   Edit workflow

-   Edit tax rules

-   Edit categories

-   Suspend vendor

-   Delete vendor (rarely allowed)

Each cell has toggles: Allow / Deny.

#### 10.8.12 Notification Template Configuration UI

Tenant Admin configures email & SMS templates.

### Editable Templates:

-   Vendor onboarding invitation

-   Clarification request

-   Approval notifications

-   Rejection notifications

-   Bank account change alerts

-   ERP sync failure alerts

UI Features:

-   HTML editor

-   Variable tags (e.g., {{vendor_name}}, {{request_id}})

-   Preview with sample data

-   Restore default template

#### 10.8.13 Integration Settings UI

Tenant Admin configures external systems:

### Integration Options:

-   ERP (SAP, Oracle, Sage X3, Microsoft Dynamics, Odoo, etc.)

-   KYC APIs

-   Tax Authority API

-   Bank Verification API

-   Document Storage Provider (AWS S3, Azure, GCP)

-   Email/SMS providers

### UI Components:

-   Dropdown for integration type

-   Credential fields (API keys, tokens, passwords)

-   Connection test button

-   Environment setup (sandbox/production)

#### 10.8.14 Tenant Admin Audit Logs

Tenant Admin must have a dedicated audit log view for configuration
changes.

### Audit Columns:

-   Timestamp

-   Admin user

-   Action

-   Before → After values

-   Affected module

-   IP address

Search filters:

-   Date

-   Module

-   Action type

-   User

Export:

-   CSV

-   JSON

-   PDF

### 10.9 Super Admin UI Requirements

(For the Platform Owner --- Not Tenant-Level)

The Super Admin portal is the highest-level administrative interface in
the entire ZivaBI ecosystem.

This portal is used by YOU (the platform owner) or your authorized staff
to:

-   Manage all tenant organizations

-   Control licensing & subscriptions

-   Enable or disable modules per tenant

-   Configure global system settings

-   Manage platform-wide AI models

-   Oversee security

-   Handle tenant billing

-   Monitor platform health

-   Enforce compliance & data isolation

This is the "control center" for the entire product.

The UI must prioritize:

✔ Security

✔ Clarity

✔ Easy oversight

✔ Monitoring

✔ Full auditability

✔ Isolation between tenants

✔ Configuration without code

#### 10.9.1 Super Admin Dashboard

A high-level view of platform-wide activity.

### Dashboard Widgets

-   Total Tenants (Active / Inactive)

-   Total Vendors Across Platform

-   Modules Activated Across Tenants

-   Platform Health (Uptime, API Latency, Errors)

-   Pending Support Tickets

-   Storage Consumption by Tenant

-   AI Model Status (Training / Active / Needs Retraining)

-   Upcoming Expiring Subscriptions

-   Data Residency Overview

-   Security Alerts / Suspicious Activity

Each widget must be clickable, leading to deeper analytics.

#### 10.9.2 Super Admin Navigation Menu (Left Sidebar)

The menu must include:

-   Dashboard

-   Tenant Management

-   Module Licensing

-   Global Configuration

-   AI Model Management

-   Usage & Billing

-   Data Residency Controls

-   Security Center

-   Integration Governance

-   System Logs

-   Platform Notifications

-   Support & Escalation Tools

-   Super Admin User Management

#### 10.9.3 Tenant Management UI

Super Admin can view and manage ALL tenant companies.

### Tenant List Columns:

-   Tenant Name

-   Industry

-   Country

-   Status (Active, Suspended, Trial)

-   Modules Activated

-   Storage Usage

-   Date Created

-   Subscription Tier

-   Action button

### Tenant Profile Page (Super Admin View):

Tabs:

1.  Overview

2.  Activated Modules

3.  Users & Roles

4.  Branding

5.  Integrations

6.  Storage & Data Residency

7.  Activity Logs

8.  Billing & Invoices

9.  Support Tickets

#### 10.9.4 Module Licensing UI

Super Admin can enable/disable modules per tenant:

### Modules include:

-   Vendor Onboarding

-   Accounts Payable (AP)

-   Employee Expense & Travel Advance

-   Accounts Receivable (AR)

-   Bank Reconciliation

-   Inventory Management

-   Fixed Asset Management

-   POSM Management

-   Payroll Management

-   Customer Onboarding

-   Customer Portal

-   Vendor Portal

-   AI Auto-Categorization Engine

-   Workflow Automation Engine

-   Reporting & Analytics Suite

### UI Features:

-   Toggle per module

-   Apply module bundle presets

-   Add usage-based pricing rules

-   Preview tenant invoice impact

-   Enforce mandatory modules (e.g., Authentication)

-   Restrict modules with dependencies

#### 10.9.5 Global Configuration UI

This governs system-wide rules.

### Settings Include:

-   Allowed identity providers (SSO, OAuth, SAML)

-   Password policy

-   Default AI models

-   Default themes

-   Allowed file types

-   Max upload size

-   Global OCR configurations

-   System-wide validation rules

-   Multi-factor authentication defaults

### UI Safeguards:

-   Warnings before changing critical settings

-   Preview impact dialog

-   Rollback capability

#### 10.9.6 AI Model Management UI

ZivaBI's AI engines must be fully controllable from the Super Admin UI.

### AI Models:

-   Document OCR engine

-   Duplicate detection engine

-   Vendor category prediction engine

-   Tax rule prediction engine

-   Workflow optimization model

-   Anomaly detection model

### UI Features:

-   View model versions

-   Deploy new model versions

-   Roll back to previous versions

-   Retrain models (manual or automatic)

-   Monitor model performance

-   Upload training datasets (secure area)

#### 10.9.7 Usage & Billing UI

Super Admin can monitor tenant usage and billing.

### Usage Metrics (Per Tenant):

-   Number of vendors onboarded

-   Number of documents uploaded

-   Storage consumed

-   API calls made

-   AI model usage (OCR pages, duplicate checks, etc.)

-   Monthly active users

### Billing Panel:

-   Subscription tier

-   Module-based pricing

-   Usage-based billing add-ons

-   Invoice history

-   Payment history

-   Outstanding balances

#### 10.9.8 Data Residency Controls UI

Some tenants require compliance with:

-   GDPR

-   CCPA

-   Nigeria Data Protection Regulation

-   UK Data Protection Act

-   EU Data Residency

-   Other country mandates

Super Admin must set:

### Controls:

-   Which data center each tenant resides in

-   Whether cross-region replication is allowed

-   Encryption rules

-   Backup schedule

#### 10.9.9 Security Center UI

A central place for monitoring platform-wide security.

### Security Dashboard Shows:

-   Failed logins (per tenant)

-   Unusual login locations

-   Suspicious API activities

-   File upload risks

-   Vendor fraud patterns

-   KYC non-compliance

-   Audit anomalies

### Super Admin Actions:

-   Force logout all users of tenant

-   Suspend tenant

-   Lock vendor records

-   Reset tenant configuration

#### 10.9.10 Integration Governance UI

Super Admin controls platform-wide integrations.

### Configurable Integrations:

-   OCR providers

-   AI providers

-   KYC providers

-   Identity providers

-   Payment systems

-   ERP connectors

-   Email/SMS gateways

-   Cloud storage providers

### Features:

-   View usage per integration

-   Enable/disable for tenants

-   Manage global API keys

-   Security validation checks

#### 10.9.11 System Logs UI

Super Admin must access platform-wide logs, not tenant-isolated logs.

Logs include:

-   Authentication logs

-   Error logs

-   API gateway logs

-   File processing logs

-   AI engine logs

-   Synchronization logs

-   Database performance logs

Filters:

-   Tenant

-   Time

-   Severity

-   Module

Export:

-   CSV

-   JSON

#### 10.9.12 Platform Notifications UI

Super Admin creates announcements for:

-   System maintenance

-   New module availability

-   Outages or incidents

-   Deprecation notices

-   New features

-   Billing changes

Delivered via:

-   Email

-   In-app banners

-   SMS (optional)

-   Push notifications

#### 10.9.13 Super Admin User Management UI

Super Admin must manage internal platform-owner users:

### Controls:

-   Create/edit/delete Super Admin roles

-   Assign module-specific privileges

-   MFA enforcement

-   Set IP allowlists

-   Suspend/activate users

-   View all actions made by Super Admins

#### 10.9.14 Super Admin Mobile UI Requirements

Even Super Admin features must work on mobile.

Mobile requires:

-   Collapsible panels

-   Stacked dashboards

-   Sticky save/apply buttons

-   Swipeable tabs

-   Compact forms

#### 10.9.15 Dependency Warnings UI

Before making a change, the system must warn the Super Admin if:

-   A module depends on another module

-   Removing a feature breaks tenant workflows

-   Changing an AI model affects live workflows

-   Disabling a module impacts billing

The UI must display:

-   Dependency graph

-   Risk level

-   Recommended actions

### 10.10 Multi-Tenant Branding & Theming UI Requirements

Multi-tenant branding is a critical feature of ZivaBI because each
organization using the system must feel like the platform is
theirs---not a generic shared product.

The UI must provide a highly configurable, intuitive environment where
each tenant can:

-   Upload their own branding

-   Apply their company colors

-   Change typography

-   Customize component styling

-   Define theme behavior (light/dark mode)

-   Preview changes before applying them

-   Restore defaults anytime

This section describes how the branding and theming engine should behave
from the user perspective.

#### 10.10.1 Goals of the Branding & Theming System

The Branding system must:

-   Make the platform visually aligned with the tenant company identity

-   Maintain a clean, modern, enterprise-grade standard

-   Avoid breaking layouts or contrast/accessibility rules

-   Support both internal users and vendor/customer portals

-   Propagate changes instantly across all modules

-   Allow rollback to previous themes

-   Support both light and dark modes

-   Handle multi-language direction changes (LTR/RTL)

The design must remain consistent and legible regardless of the brand
theme applied.

#### 10.10.2 Branding Page Overview (Tenant Admin Portal)

The tenant admin accesses a dedicated "Branding & Themes" page.

### Layout:

-   Left Sidebar: Branding sections

-   Right Preview Panel: Real-time preview of UI

-   Top Ribbon: Save, Discard, Restore Defaults, Publish buttons

### Branding Sections:

1.  Company Logo

2.  Colors

3.  Typography

4.  Buttons & Components

5.  Forms & Inputs

6.  Navigation Styling

7.  Light/Dark Mode

8.  Portal Header/Footer

9.  Login Page Customization

10. Advanced CSS Overrides (optional)

11. Preview & Apply

#### 10.10.3 Logo Management UI

Tenant admin can upload:

-   Primary logo

-   Secondary logo (dark/light version)

-   Favicon

### Requirements:

-   Accepted formats: PNG, SVG, JPG

-   Max file size: 5MB

-   Automatic resizing for device types

-   Preview in light/dark backgrounds

-   Cropping tool for best-fit

-   Logo placement defines header size automatically

#### 10.10.4 Color Theme Configuration UI

Tenant admin defines the primary color scheme:

### Color Pickers:

-   Primary color

-   Secondary color

-   Accent color

-   Success (green)

-   Error (red)

-   Warning (yellow)

-   Info (blue)

-   Background color

-   Text color

### Features:

-   HEX and RGB input

-   Preview color contrast

-   Automatic contrast warning if text/background ratio < WCAG 4.5:1

-   Palette presets (8 modern presets)

-   Button to "Auto-Generate Palette" from logo

#### 10.10.5 Typography Configuration UI

Tenant chooses typography styles:

### Options:

-   Font family (Inter, Roboto, Open Sans, Lato, or tenant upload)

-   Font size scale (Small / Medium / Large)

-   Line spacing

-   Letter spacing

### Restrictions:

-   Must meet accessibility standards

-   Minimum body font size enforced (>= 14px)

#### 10.10.6 Component Styling UI

Tenants customize UI components:

### Components:

-   Buttons

-   Tabs

-   Cards

-   Tables

-   Modals

-   Alerts

-   Badges

### Customizable Properties:

-   Radius (square, round, pill)

-   Shadows

-   Text style

-   Hover states

-   Transition animations

All changes must reflect in preview instantly.

#### 10.10.7 Forms & Inputs Styling UI

Tenant customizes:

-   Input border thickness

-   Input border radius

-   Input active state

-   Required-field markers

-   Placeholder styling

System must validate contrast and readability.

#### 10.10.8 Navigation Styling UI

Customizations include:

-   Sidebar color

-   Sidebar text color

-   Sidebar collapse behavior

-   Header background

-   Header text color

-   Footer background

-   Divider line visibility

Tenant sees preview for desktop and mobile navigation.

#### 10.10.9 Light/Dark Mode Controls

Tenants can choose:

-   Light mode default

-   Dark mode default

-   Allow user switching? (Toggle ON/OFF)

-   Automatic theme switching based on system settings (optional)

Dark Mode Requirements:

-   Must auto-adjust text contrast

-   Must auto-adjust highlights

-   Errors/warnings must remain visible

#### 10.10.10 Login Page Customization UI

The login page can be fully branded.

Customizable items:

-   Background image

-   Background color

-   Logo placement

-   Welcome text

-   Authentication button styles

-   Optional slogan or compliance note

Login preview available in full-screen modal.

#### 10.10.11 Advanced Theme Overrides

For advanced tenants:

-   Custom CSS override panel

-   Syntax highlighting

-   Real-time preview

-   Validation rules to avoid layout-breaking CSS

-   Ability to "lock down" theme (freeze unauthorized changes)

Audit trail tracks all CSS overrides.

#### 10.10.12 Preview Mode

The preview UI shows:

-   Desktop preview

-   Tablet preview

-   Mobile preview

-   Vendor portal preview

-   Employee portal preview

-   Login page preview

Users can toggle between screens seamlessly.

#### 10.10.13 Publishing Flow

Publishing changes requires:

### Buttons:

-   Save Draft

-   Discard Draft

-   Preview

-   Publish

-   Restore Defaults

-   Rollback Theme

### Publish Validations:

-   WCAG contrast check

-   Conflict detection

-   Mobile compatibility check

Theme becomes active immediately for all users.

#### 10.10.14 Branding Impact Scope

When theme is published, updates propagate across:

-   Vendor Portals

-   Customer Portals

-   Employee Portals

-   Dashboard

-   Tables

-   Forms

-   Buttons

-   Sidebar Navigation

-   Login & MFA screens

No reload required --- dynamic update.

#### 10.10.15 Multi-Tenant Isolation Rules

❗ Critical requirement:

No tenant must ever see another tenant's branding or have access to any
theme assets.

Enforced by:

-   Dedicated theme storage bucket per tenant

-   Strict URL tokenization

-   Tenant-scoped CDN paths

-   Server-side checks

### 10.11 Sub-Module Interaction UI Requirements

Vendor Onboarding does not operate in isolation. It interacts with many
sub-modules within ZivaBI, including:

-   Accounts Payable (AP)

-   Expense & Travel Advance

-   AR / Customer Onboarding

-   Inventory & POSM

-   Fixed Assets

-   3PL / Logistics

-   Reporting & Insights

-   Workflow Engine

-   Identity & Access Management

-   Document Management / OCR

-   Audit Trail Engine

-   ERP Integration Module

This section explains how the UI behaves when Vendor Onboarding
interacts with these modules, ensuring:

✔ Seamless navigation

✔ Clear visibility

✔ Zero data duplication

✔ Role-based isolation

✔ Cross-module linking

✔ Unified workflow experience

#### 10.11.1 Global Interaction Principles

All module-to-module interactions must support:

### 1. Deep Linking

Users can click any vendor name anywhere in the platform and be taken
directly to the Vendor Master Profile.

### 2. Contextual Navigation

When viewing a Vendor from AP or Expenses, the UI must show where the
user came from.

Example:

"Viewing Vendor Profile (opened from AP → Payment \#P12345)"

### 3. Unified Sidebar

Sidebar remains consistent across modules, with the active module
highlighted.

### 4. Consistent Topbar

Same search, profile, and notification menu globally.

### 5. Audit Continuity

If a user crosses from Vendor Onboarding into AP or Expenses, audits
must record:

"User navigated from Vendor Profile → Expense Retirement → Line 3 GL
correction."

### 6. Role-Based Restrictions

Even if a user accesses a vendor from another module:

-   They can ONLY see the data permitted by their role.

Example: An AP user cannot see KYC notes.

### 7. Smart Breadcrumbs

Breadcrumbs update dynamically:

Vendor Onboarding → Vendor Profile → Documents

AP Module → Vendor Profile → Bank Details

#### 10.11.2 Interaction with Accounts Payable (AP) UI

AP relies heavily on Vendor Onboarding.

UI requirements include:

### A. Vendor Selection UI in AP

When AP users choose a vendor for payment:

-   Vendor dropdown shows ONLY approved vendors

-   Search supports: name, Vendor ID, TIN, phone

-   Status badges:

    -   Active (green)

    -   Suspended (yellow)

    -   Pending KYC (gray)

    -   Incomplete (red---cannot select)

### B. Vendor Panel in AP Payments

When processing an invoice:

AP sees a vendor info panel on the right:

-   Vendor name

-   Category

-   WHT rules

-   VAT rules

-   Bank details (masked)

-   Tax residency

-   Risk level

-   Link: "Open Full Vendor Profile"

### C. Error Handling

If a vendor:

-   Has expired documents

-   Has pending KYC

-   Is suspended

    AP UI must show:

    "Vendor cannot be used for payment until compliance is completed."

#### 10.11.3 Interaction with Expense & Travel Advance Module UI

Employees submitting expenses must NOT select vendors from the Vendor
Onboarding list unless:

-   The tenant explicitly activates "Employee-as-Vendor" or

-   The vendor is part of reimbursable policies (e.g., hotels, airlines)

UI rules:

### A. When employee selects vendor for reimbursement:

Show:

-   Vendor name

-   Tax information

-   VAT applicability

-   Dimensions required

If vendor is not found:

-   Employee can create "Temporary Vendor (Employee Only)"

    -   Triggers Finance review

    -   Never goes to procurement

### B. Link Expense → Vendor Profile

If the invoice is from a known vendor:

-   Finance can click vendor name to view full profile

#### 10.11.4 Interaction with Inventory & POSM Module UI

Inventory module requires vendor data for:

-   Stock purchases

-   POSM procurement

-   Clearing / Import vendor selection

-   IC vendor mapping (for intercompany)

### Inventory Purchase UI Must Show:

-   Vendor category (e.g., Clearing Agent)

-   Required documentation

-   Tax rules

-   Allowed currencies

-   Import license validity

### POSM Vendors

Special UI badges:

-   POSM Supplier (blue badge)

-   Asset Supplier (purple badge)

When issuing POSM:

-   "Vendor Active Status" must be checked

-   "Pending invoices?" must be visible

#### 10.11.5 Interaction with Fixed Asset Module UI

When asset purchases are made:

UI shows:

-   Vendor name

-   Vendor category

-   Tax rules

-   Whether vendor supports asset purchases (tag from onboarding)

-   Bank detail verification status

Fixed asset posting UI must highlight:

"Vendor classification allows asset capitalization."

If not allowed:

"Vendor category not configured for asset purchases."

#### 10.11.6 Interaction with 3PL / Logistics Module UI

3PL vendors are configured during onboarding.

UI must:

-   Show "3PL Vendor" badge

-   Show warehouse location mapping

-   Show logistics contract details

-   Provide link to SLA metrics

-   Provide flag if 3PL vendor has expired service agreement

Logistics module vendor selection dropdown must be filtered to show only
3PL vendors.

#### 10.11.7 Interaction with Reporting & Insights UI

Vendor data drives multiple analytics dashboards.

### Reporting UI must show:

-   Total vendors by category

-   Onboarding cycle times

-   KYC pass/fail rates

-   Procurement bottlenecks

-   Finance rejection trends

-   Tax classification distribution

-   Vendor risk distribution

-   Document expiry forecasts

### UI Filters:

-   Vendor Category

-   Country

-   Risk Level

-   Tax Rule

-   Review Stage

#### 10.11.8 Interaction with Workflow Engine UI

The Workflow Engine UI shows:

### Vendor Workflow Visualization:

-   Requestor → LM → HOD → GM → Procurement → Finance → KYC → Legal →
    Finance Approver → ERP Sync

UI must allow users to:

-   View workflow progress

-   See who is holding the workflow

-   Reassign tasks

-   Escalate tasks

-   Re-run workflow step after correction

-   View workflow audit logs

#### 10.11.9 Interaction with Identity & Access Management UI

Identity module ensures:

### UI Requirements:

-   Vendor users only see vendor portal

-   Internal users see only internal modules

-   Roles must be visible on user profile page

-   Tenant Admin can enforce MFA

-   Vendor password reset flow must be separate

#### 10.11.10 Interaction with Document Management & OCR UI

Vendor onboarding uses OCR heavily.

### UI Requirements:

-   Side-by-side comparison

-   Confidence scoring

-   OCR mismatch alerts

-   "Accept OCR Value" button

-   "Request Replacement Document"

-   Document version history

OCR UI must be consistent across modules.

#### 10.11.11 Interaction with Audit Trail Engine UI

Audit Trail UI must:

-   Show cross-module transitions

-   Track user actions

-   Track document changes

-   Track vendor approvals

-   Track tax rule overrides

-   Track workflow modifications

UI must allow:

-   Sorting

-   Filtering

-   Exporting

#### 10.11.12 Interaction with ERP Integration UI

For each vendor:

### ERP Sync Panel UI must show:

-   ERP sync status

-   ERP vendor ID

-   Last sync time

-   Errors from ERP

-   Retry button

-   Mapping of fields from ZivaBI → ERP

Errors shown in red with tooltips.

### 10.12 Notification & Email UI Requirements

The Notification & Email UI defines how the Vendor Onboarding module
communicates with:

-   Vendors

-   Internal users

-   Approvers

-   Finance

-   Compliance

-   Procurement

-   Tenant Admin

-   Super Admin

Notifications must be:

✔ Clear

✔ Actionable

✔ Professional

✔ Audit-friendly

✔ Configurable per tenant

✔ Multi-channel (Email, In-App, SMS, Push)

✔ Multi-lingual (future-ready)

✔ Accessible on all devices

This section describes the full UI/UX specifications for notification
management, notification delivery, and template configuration.

#### 10.12.1 Notification Types

### A. System Notifications (Triggered Automatically)

-   Vendor onboarding invitation

-   Vendor submission received

-   Clarification requested

-   Clarification response received

-   Document replacement request

-   Stage approval

-   Stage rejection

-   Workflow escalation

-   Vendor activation

-   ERP sync success/failure

-   Document expiry reminders

-   Compliance/KYC flags

### B. User-Initiated Notifications

-   Message to vendor

-   Message to procurement

-   Message to finance

-   Manual reminders

### C. Scheduled Notifications

-   SLA reminders

-   Pending approval reminders

-   Document expiry reminders

-   Weekly summaries

#### 10.12.2 Notification Channels UI

The system supports:

-   Email (primary)

-   In-App Notifications

-   SMS (optional)

-   Push Notifications (mobile/web)

Tenant Admin can enable/disable each channel per notification type.

#### 10.12.3 Notification Center (In-App UI)

Every internal user sees a notification bell on the top navigation bar.

### UI Features:

-   Red badge with unread count

-   Dropdown list showing recent notifications

-   "Mark all as read" button

-   Clickable items → navigate directly to relevant screen

-   Search notifications

-   Filter by:

    -   Type

    -   Sender

    -   Date

    -   Module

### Notification Card Layout:

-   Icon (type-based: alert, check, info, warning)

-   Title

-   Short message

-   Timestamp

-   "View Details" link

Unread notifications appear in bold.

#### 10.12.4 Notification Sidebar Panel

On click of a notification:

A right-side sliding panel opens, showing:

-   Notification title

-   Full message

-   Category

-   Status

-   Action buttons

-   Attachments (if any)

-   Source user details

-   Workflow state (if applicable)

Examples of actions:

-   Approve

-   Reject

-   Respond

-   Open vendor profile

-   Upload document

-   Add comment

#### 10.12.5 Email Notification Templates

Each template must follow modern, professional layout structure:

### Template Components:

-   Header with tenant logo

-   Branding (colors, fonts as configured in 10.10)

-   Body content

-   Call-to-action button

-   Footer with:

    -   Company name

    -   Support email

    -   Unsubscribe (optional)

### Supported Formats:

-   HTML

-   Plain text fallback

### Email Must Render Correctly On:

-   Gmail

-   Outlook (desktop + web)

-   Yahoo

-   Apple Mail

-   Mobile email apps

#### 10.12.6 Template Editor UI (Tenant Admin Portal)

Tenant Admin can customize templates for:

-   Invitation

-   Approvals

-   Rejections

-   Clarifications

-   Expiring documents

-   KYC reminders

-   Vendor activation

-   ERP sync notifications

-   Workflow escalation

### UI Features:

-   Rich-text editor

-   HTML editor toggle

-   Variable tags (auto-generated):

    -   {{vendor_name}}

    -   {{requestor}}

    -   {{approval_step}}

    -   {{tenant_name}}

    -   {{link}}

    -   {{category}}

    -   {{due_date}}

    -   {{document_type}}

    -   {{erp_error}}

### Template Validation:

-   Missing variables are highlighted

-   Preview on desktop / mobile

-   Test email sending

-   Restore default template

-   Version history

#### 10.12.7 SMS Notification UI

SMS messages must be short and actionable.

### UI Rules:

-   Limit to 160 characters

-   No HTML

-   No attachments

-   Must include a link for action (shortened)

-   Tenant must confirm SMS charges

Tenant Admin can enable SMS for:

-   Urgent approvals

-   Rejections

-   Workflow escalations

-   Vendor activation

SMS template editor supports placeholders, e.g.:

"Vendor {{vendor_name}} is awaiting your approval. Click here:
{{link}}"

#### 10.12.8 Push Notification UI (Mobile/Web)

Push notifications used for:

-   Approvals

-   Clarification requests

-   Vendor submission

-   Document expiry

### UI Features:

-   Compact message format

-   Includes icon

-   Click → deep link into mobile app

-   Ability to mute notifications

#### 10.12.9 Vendor Notification UI

Vendor portal also contains notifications:

### Vendor Notification Types:

-   Onboarding link sent

-   Clarification requested

-   Document rejected

-   Document accepted

-   Vendor activated

-   Legal/Finance/KYC requests

-   Bank verification needed

-   TIN mismatch

### Vendor Notifications UI:

-   Bell icon in vendor portal

-   Sliding panel with message list

-   Clear call-to-action buttons

-   Upload zones directly from notification

Examples:

"Finance requested a clearer copy of your bank letter."

Button: Upload Document

#### 10.12.10 Notification Prioritization & Severity Levels

Severity levels determine UI styling:

### Levels:

1.  Critical (Red) -- ERP sync failures, fraud detection

2.  High (Orange) -- Required document rejected, SLA breach

3.  Medium (Yellow) -- Pending approvals, clarifications

4.  Low (Blue) -- Informational updates

Icons reflect severity.

#### 10.12.11 Notification History UI

Full notification history visible in user profile.

### Features:

-   Pagination

-   Filtering

-   Date range selector

-   Export to CSV

-   Clear categorization

#### 10.12.12 Real-Time Notification Delivery

UI must update live using:

-   WebSockets or

-   Server-Sent Events (SSE)

Real-time triggers:

-   Approvals

-   Clarifications

-   Document uploads

-   Vendor submissions

-   ERP sync updates

No page refresh required.

#### 10.12.13 Accessibility Requirements

Notifications must be:

-   Screen-reader friendly

-   Keyboard navigable

-   Colorblind-safe

-   Have alternative text for icons

#### 10.12.14 Error State Notifications

Error messages must be:

-   Human-friendly

-   Precise

-   Provide next steps

Example:

"Bank verification failed: account name does not match vendor legal
name."

Button: Review Bank Details

#### 10.12.15 Notification Audit Logging

Audit logs record:

-   Notification text

-   Sender

-   Receiver

-   Delivery channel

-   Delivery status

-   Actions taken (read, clicked, ignored)

Tenant Admin and Super Admin can export logs.

### 10.13 Accessibility & Performance UI Requirements

Accessibility and performance are non-negotiable pillars of the ZivaBI
Vendor Onboarding Module.

These requirements ensure the UI is usable by:

-   People with disabilities

-   Users in low-bandwidth locations

-   Users on older devices

-   Users on mobile

-   Users in highly regulated environments

This section defines all expectations for:

-   Accessibility (WCAG 2.1 AA)

-   Performance (speed, loading time, responsiveness)

-   Language readiness

-   Device compatibility

-   Error handling

-   Compliance requirements

#### 10.13.1 Accessibility Standards

ZivaBI must comply with:

### WCAG 2.1 AA

### , including:

-   Contrast ratios

-   Keyboard navigation

-   Screen reader support

-   Logical tab order

-   Alternative text

-   Form labels

-   Toast message accessibility

-   Focus visibility

-   Error prevention

This applies to:

-   Vendor Portal

-   Internal portals

-   Mobile views

-   Email templates

-   Notification banners

-   Modals

-   Workflow timelines

-   Forms and inputs

#### 10.13.2 Color & Contrast Requirements

All text must meet minimum 4.5:1 contrast ratio.

### Automatic UI validation:

-   When tenant admin selects branding colors (Section 10.10), the UI
    must warn if the chosen color fails contrast.

-   System blocks publishing a theme that violates WCAG rules unless the
    tenant overrides intentionally (logged in audit trail).

-   For dark mode, text color automatically switches to ensure
    visibility.

#### 10.13.3 Keyboard Navigation Requirements

Every interactive component must support keyboard navigation:

-   Tab → next element

-   Shift + Tab → previous

-   Enter → primary action

-   Space → toggle button

-   Arrow keys → list navigation

-   ESC → close modal, dropdown, drawer

### Components that must be keyboard accessible:

-   Buttons

-   Dropdowns

-   Date pickers

-   Tabs

-   Notification dropdown

-   Vendor documents grid

-   Modals

-   Side drawers

-   Workflow timelines

#### 10.13.4 Screen Reader Requirements

All ZivaBI UI must work with:

-   NVDA

-   JAWS

-   VoiceOver

-   TalkBack

### Required behaviors:

-   All fields must have <label> tags

-   All dynamic updates must announce via ARIA live regions

-   Buttons must have descriptive ARIA labels

-   Icons must have alt-text

-   Decorative icons should have aria-hidden=\"true\"

-   Error messages must be announced automatically

Example:

-   "Document uploaded successfully."

-   "This field is required."

-   "Vendor legal name does not match document."

#### 10.13.5 Focus & Highlight Requirements

Focus outline MUST be visible:

-   2 px solid outline

-   High-contrast color

-   Not overridden by tenant themes without passing contrast tests

Focus states apply to:

-   Buttons

-   Input fields

-   Dropdowns

-   Tabs

-   Modals

-   Notifications

#### 10.13.6 Form Accessibility Requirements

Every form must meet:

### Requirements:

-   Labels always visible (never placeholder-only)

-   Required fields show a red asterisk

-   Validation errors appear under the field

-   Error messages must be specific

-   Tooltip must describe formatting rules

-   100% form screen reader compliance

### Dual-label rule:

Each field must have:

-   Visible label

-   Screen-reader-only label

#### 10.13.7 Language & Localization Readiness

Even if multi-language support is not implemented at launch, UI must be:

✔ Translation ready

✔ Support string externalization

✔ Support right-to-left (RTL) layouts (Arabic, Hebrew)

✔ Support date/number localization

No text should be hardcoded. All strings must be stored in:

/locales/en.json

/locales/fr.json

/locales/ar.json

/locales/... (future)

#### 10.13.8 Performance Requirements

ZivaBI must meet enterprise speed requirements.

### A. Page Load Targets

-   First Contentful Paint (FCP) ≤ 1.5 seconds

-   Time to Interactive (TTI) ≤ 2.5 seconds

-   Mobile load ≤ 3 seconds

### B. Navigation Performance

-   Screen transition ≤ 300ms

-   Dropdown responsiveness ≤ 50ms

-   Form validation ≤ 150ms

-   Document preview ≤ 800ms

### C. API Response Targets

-   Vendor form submission ≤ 800ms

-   Vendor info load ≤ 1 second

-   Document OCR upload ≤ 2 seconds

#### 10.13.9 Responsiveness & Device Performance

UI must adapt fluidly to:

-   Desktops

-   Laptops

-   Tablets

-   Mobile phones

-   Low-power devices

-   Older browsers

### Requirements:

-   Use responsive grid

-   Stack cards vertically on mobile

-   Use bottom fixed action bar for mobile actions

-   Avoid large image loads

-   Minimize blocking scripts

#### 10.13.10 Document & OCR Performance Requirements

OCR is performance-heavy; UI must:

-   Show skeleton loaders while processing

-   Show progress bar during upload

-   Allow user to continue onboarding (async processing)

-   Notify user when OCR is complete

-   Support resuming document upload

-   Cache OCR results for faster reload

OCR document preview must load:

≤ 1 second for images

≤ 2 seconds for PDFs

#### 10.13.11 Error Handling Requirements

Error states must be:

✔ Human-friendly

✔ Descriptive

✔ Actionable

### Types of errors:

-   Network loss

-   Document upload failure

-   Invalid file format

-   OCR failure

-   TIN mismatch

-   Bank verification failure

-   Expired onboarding link

### Error UI:

-   Red banner at top

-   Icon

-   Clear message

-   Suggested next step

-   Retry button (if applicable)

Example:

"OCR failed. The document appears blurry. Please upload a clearer
version."

#### 10.13.12 System Resilience Requirements

UI must gracefully handle:

-   API timeouts

-   Partial failures

-   ERP sync errors

-   High latency networks

### Behavior:

-   Retry logic

-   Graceful fallback messages

-   Offline detection banner

-   Autosave every 5 seconds

#### 10.13.13 Security UI Requirements

All sensitive data must be visually protected:

-   Bank details masked by default

-   TIN partially masked (configurable)

-   Document previews watermarked if tenant enables

-   MFA indicators on user profile

-   Suspicious vendor alerts highlighted in red

#### 10.13.14 Accessibility and Performance Testing

UI must support automated testing for:

-   Lighthouse accessibility score ≥ 90

-   Keyboard-only usability tests

-   Screen reader walkthrough test cases

-   Mobile performance under throttled network

-   Document preview under low bandwidth

Testing reports must be auditable by Tenant Admin or Super Admin.

### 10.14 Mobile UI Requirements

ZivaBI must deliver a fully mobile-capable Vendor Onboarding experience.

Mobile UI is not a reduced version of desktop---it must be a first-class
experience, optimized for:

-   Speed

-   Readability

-   One-hand operation

-   Minimal typing

-   Touch-based interactions

-   Navigation clarity

-   Offline tolerance

-   Security

This applies to:

-   Vendor Portal (external vendors)

-   Employee/Internal portals

-   Approver portals (LM → HOD → GM → Procurement → Finance → KYC →
    Legal)

-   Tenant Admin portal (limited but accessible)

-   Super Admin portal (high-level oversight view)

#### 10.14.1 Mobile Design Philosophy

The mobile UI must follow:

### ✔ Mobile-First Design

Elements must be designed for mobile before being adapted for desktop.

### ✔ Minimal Input

Use dropdowns, pickers, auto-fill, OCR extraction, and tap gestures
instead of typing.

### ✔ Large Click Targets

Minimum touch target = 44px × 44px.

### ✔ Simplified Navigation

Use tab bars, bottom action bars, and sliding panels.

### ✔ Fast Loading

All screens must load under 2 seconds.

### ✔ Offline-Friendly Behavior

Autosave locally if a network drop occurs.

### ✔ Consistent Experience Across Devices

Uniform UX across:

-   iOS

-   Android

-   Mobile web

-   Tablet

#### 10.14.2 Mobile Layout Structure

Mobile screens follow a consistent structure:

### A. Header Bar

-   Back button

-   Page title

-   Options menu (3 dots)

### B. Main Content Area

Scrollable vertical content.

### C. Sticky Action Bar (Bottom)

For key actions:

-   Continue

-   Submit

-   Approve

-   Reject

-   Upload Document

Sticky bar is essential so the user doesn't scroll up/down to find
buttons.

#### 10.14.3 Mobile Navigation Requirements

### Navigation Components:

-   Bottom Navigation Bar for Vendor Portal

-   Side Drawer Menu for internal portals

-   Swipeable Tabs for multi-step forms

-   Horizontal scroll tabs for workflow pages

### Navigation Must Support:

-   Deep linking (open directly to vendor document preview)

-   Back-button consistency

-   In-app notifications

#### 10.14.4 Mobile Vendor Onboarding Wizard

The multi-step onboarding wizard must work flawlessly on mobile.

### Mobile Wizard Behavior:

-   One step per full screen

-   Swipe left/right to move between steps

-   Step indicator displayed at top

-   Auto-save after each field

### Field Input Optimization:

-   Numeric keypad for numeric fields

-   Email-specific keyboard for email fields

-   Date picker optimized for touch

-   Country picker with search

### OCR Integration (Mobile Camera)

Vendors can:

-   Take photo of documents

-   Crop/rotate before upload

-   OCR runs instantly

-   Values auto-filled

#### 10.14.5 Mobile Vendor Document Upload UI

Document upload UI must support:

### Upload Options:

-   Camera

-   Gallery

-   Files app

### Document Preview:

-   Full-screen viewer

-   Pinch-to-zoom

-   Swipe to see next document

-   "Mark as Primary Document" toggle

### Upload Feedback:

-   Progress bar

-   Upload success toast

-   Error toast (retry option)

OCR results displayed in a sliding bottom sheet.

#### 10.14.6 Mobile Review UI (Internal Roles)

Internal stakeholders must easily review documents and approve vendors
on mobile.

### Approver Mobile UI Requirements:

-   Quick summary at top

-   Accordion sections for details

-   Document preview button always visible

-   Swipe to switch between tabs (Overview, Documents, Timeline, Notes)

-   Sticky Approve/Reject bar at bottom

-   Keyboard-aware layout for comments

### Document Review Tools:

-   Tap to zoom

-   Rotate

-   Flag document

-   Add comment

#### 10.14.7 Mobile Workflow Timeline UI

The workflow timeline must be adapted for small screens:

### Timeline Behavior:

-   Vertical stacked layout

-   Expandable/collapsible steps

-   Icons for completed, pending, rejected

-   Tap step to view details

-   Smooth scrolling

Each node shows:

-   Step name

-   Approver

-   Timestamp

-   Status badge

-   Expand arrow

#### 10.14.8 Mobile Clarification Workflow

Vendor ↔ Procurement ↔ Finance ↔ Legal ↔ Requestor communication must
work seamlessly.

### Clarification UI:

-   Chat-style thread

-   Speech bubble layout

-   Timestamp on each message

-   Attach/document button

-   Pull-to-refresh

-   Push notifications on new messages

Mobile must support:

-   Tagging users (\@Procurement)

-   Inline document previews

#### 10.14.9 Mobile Tenant Admin UI Requirements

Tenant Admin mobile must provide limited but critical features:

### Allowed on Mobile:

-   View workflows

-   Review configuration summaries

-   Approve urgent configuration changes

-   Notifications management

-   User management (basic)

-   Branding preview

### Restricted on Mobile:

-   Full configuration wizard

-   Complex workflow designer

-   AI model configuration

-   Tax-system configuration

These require desktop for clarity and safety.

#### 10.14.10 Mobile Super Admin UI Requirements

Super Admin mobile must allow:

-   Tenant monitoring

-   Notifications

-   Viewing errors

-   Approving urgent escalations

-   Viewing logs summaries

-   Monitoring API health

-   Billing alerts

Complex platform-level configuration must remain desktop-only.

#### 10.14.11 Offline & Low Network Mode (Mobile)

### Must detect:

-   No network

-   Weak network

-   API timeout

### Behavior:

-   Show banner "You're offline---saving changes locally..."

-   Save form progress offline

-   Allow reading cached data

-   Sync automatically when back online

#### 10.14.12 Mobile Performance Requirements

Performance thresholds:

-   Load screen ≤ 2 seconds

-   Document preview ≤ 1 second

-   Notification delivery ≤ 1 second

-   Action buttons respond ≤ 50ms

-   OCR request UI feedback ≤ 300ms

Mobile UI must remain smooth even when:

-   Documents are large

-   Network slow

-   Device low on memory

#### 10.14.13 Mobile Security Requirements

Security measures include:

-   Biometric authentication (if enabled)

-   Auto-logout on inactivity

-   Redact sensitive fields (bank details)

-   Prevent screenshots for sensitive pages (optional per tenant)

-   Encrypted local cache

-   No logs stored offline

#### 10.14.14 Responsive Testing Requirements

All mobile UI must pass:

-   iOS Safari

-   iOS Chrome

-   Android Chrome

-   Android Edge

-   iPad split-screen mode

-   Mobile landscape mode

-   Low-resolution devices

-   Emulated network throttling tests

### 10.15 Document Viewer & OCR UI Requirements

Document processing is one of the core pillars of the Vendor Onboarding
module.

This section defines the full UI/UX requirements for:

-   Document upload

-   Document preview

-   AI-based OCR extraction

-   OCR validation

-   Side-by-side comparison

-   Document versioning

-   Error handling

-   Mobile behavior

-   Accessibility compliance

The Document Viewer must support all document types used during
onboarding:

✔ PDF

✔ JPG

✔ PNG

✔ TIFF

✔ DOCX (converted automatically to PDF preview)

#### 10.15.1 Document Upload UI Requirements

### Upload Methods:

-   Drag & drop (desktop)

-   File picker (desktop & mobile)

-   Camera upload (mobile)

-   Gallery upload (mobile)

### Supported Formats:

-   PDF

-   DOCX

-   JPG, PNG, HEIC

-   Up to 50MB per file

### UI Elements:

-   Upload icon (large)

-   "Upload Document" button

-   Description text: "Drag and drop or click to upload files"

-   Section shows required documents with checkboxes

### Upload Feedback:

-   Inline progress bar

-   Upload status icon (success, warning, error)

-   Tooltip for errors

-   "Replace File" button

-   Thumbnail preview after upload

#### 10.15.2 Document Card UI

Each uploaded document appears as a document card.

### Document Card Must Show:

-   Filename

-   File type icon

-   Thumbnail preview

-   Upload date

-   Uploaded by

-   OCR status:

    -   Pending

    -   Processing

    -   Complete

    -   Failed

### Card Actions:

-   View

-   Download

-   Replace

-   Delete (if user role allows)

-   View OCR results

-   View version history

-   Flag issue

#### 10.15.3 Document Viewer UI (Full Preview Mode)

When a document is clicked, a full-screen modal or new page opens.

### Essential Viewer Features:

#### A. Page Navigation

-   Next page / previous page buttons

-   Page thumbnails (left sidebar)

-   Jump to page input field

#### B. Zoom Controls

-   Zoom in/out buttons

-   Pinch-to-zoom (mobile)

-   Fit-to-screen

-   Fit-to-width

#### C. Rotate

-   Rotate left/right

#### D. Dark/Light Background Toggle

Improves readability for scanned docs.

#### E. Download Button

Permission-based visibility.

#### F. Fullscreen Mode

Expands viewer to entire screen.

#### G. Document Info Panel

-   File name

-   Upload date

-   Uploaded by

-   Document type

-   Version number

#### 10.15.4 Side-by-Side Comparison UI

Used for:

-   Version comparison

-   OCR vs Original comparison

-   Submitted vs Approved contract comparison

-   Vendor replacement document comparison

### UI Layout:

Two panes:

Left: Document A (original)

Right: Document B (OCR text or updated version)

### Comparison Tools:

-   Scroll sync ON/OFF

-   Highlight differences

-   Switch document sides

-   Optical highlight of mismatched fields

### Modes:

-   OCR comparison mode

-   Version comparison mode

-   Contract comparison mode

#### 10.15.5 OCR UI Requirements

OCR (Optical Character Recognition) must be deeply integrated.

### OCR Behavior:

-   Runs automatically after upload

-   Extracts:

    -   Vendor name

    -   TIN

    -   Address

    -   Bank details

    -   Registration numbers

    -   Invoice number (for AP)

    -   Document dates

    -   Signatures (presence check)

### Extraction Confidence Indicators:

Each extracted value shows:

-   Confidence score (0--100%)

-   Color indicator:

    -   Green (≥ 90%)

    -   Yellow (60--89%)

    -   Red (< 60%)

#### 10.15.6 OCR Result Viewer UI

OCR results appear in a split-view sliding drawer.

### UI Fields:

-   Key-value table

-   Confidence bars

-   Badge showing "Match / Mismatch / Missing"

-   Side-by-side comparison with vendor input

### UI Actions:

-   Accept OCR value

-   Reject OCR value

-   Merge OCR & form values

-   Request document replacement

-   Mark OCR as incorrect (for AI retraining)

#### 10.15.7 Document Mismatch Highlighting

If OCR detects inconsistencies, the UI must highlight them.

### Highlight Colors:

-   Red: Critical mismatch (e.g., TIN mismatch)

-   Orange: Moderate mismatch (e.g., spelling difference)

-   Yellow: Low mismatch (formatting differences)

UI shows info tooltip:

"OCR detected a mismatch between document and form input."

Users can:

-   Confirm vendor entry

-   Accept OCR entry

-   Request correction

#### 10.15.8 Document Versioning UI

Every document has a version history.

### Version History Panel Shows:

-   Version number

-   Upload date

-   Uploaded by

-   Change notes (optional)

-   OCR status for each version

-   Compare with previous version button

### Document Replacement Workflow:

-   Old version remains stored

-   New version becomes active

-   Audit logs record:

    -   Who replaced

    -   Why

    -   Review actions taken

#### 10.15.9 Document Expiry UI

Some documents expire (CAC, TIN, business licenses).

### UI Indicators:

-   Expired (red)

-   Expiring soon (orange)

-   Valid (green)

### Actions:

-   Upload new version

-   Notify vendor

-   Auto-remind vendor before expiry

#### 10.15.10 OCR Error Handling UI

If OCR fails:

### UI Shows:

-   Error badge

-   Reason for failure (e.g., "Low resolution")

-   Suggestion to re-upload

-   "Retry OCR" button (Finance/Procurement only)

#### 10.15.11 Document Security UI Requirements

Sensitive documents must be masked or restricted depending on user
roles.

### Masking Rules:

-   Bank documents → full masking except last 4 digits

-   Contracts → watermarked if tenant enables

-   Identity documents → partially redacted for non-KYC reviewers

### UI Indicators:

-   Lock icon for restricted documents

-   Disclaimer: "Full document visible to KYC/Finance only."

#### 10.15.12 Bulk Document Actions UI

Bulk operations supported for Mass Document Review (Finance/KYC):

### Actions:

-   Bulk download

-   Bulk approve

-   Bulk reject

-   Bulk flag

-   Bulk request re-upload

Bulk UI requires:

-   Checkboxes

-   Progress indicator

-   Batch operation summary

#### 10.15.13 Mobile Document Viewer UI Behavior

Mobile viewer must support:

-   Fullscreen preview

-   Swipe between pages

-   Pinch-to-zoom

-   Tap to focus

-   Touch-enabled comparisons

-   Capture using camera and preview instantly

-   Faster OCR for mobile (prioritized tasks)

#### 10.15.14 Accessibility Requirements for Documents

Document viewer must support:

-   Screen reader text descriptions

-   Logical tab order

-   Keyboard navigation for actions

-   High-contrast mode for readability

-   Large text rendering

#### 10.15.15 Performance Requirements

Document viewer must load efficiently:

### Targets:

-   First preview: ≤ 1s (image) / ≤ 2s (PDF)

-   Fast page switching: ≤ 200ms

-   OCR results loading: ≤ 1.5s

-   Comparison mode switching: ≤ 300ms

Large documents should stream pages instead of loading whole file.

### 10.16 Error Handling & Validation UI Requirements

Error handling is one of the most critical components of the Vendor
Onboarding Module.

Errors must be:

-   Clear

-   Actionable

-   Friendly

-   Consistent

-   Logged

-   Accessible

-   Localized-ready

-   Helpful (suggest corrections)

The goal is to prevent user frustration and ensure users understand
exactly what went wrong and how to fix it.

This section covers:

-   Validation rules

-   Inline error messages

-   Form-level errors

-   System errors

-   Network errors

-   Workflow errors

-   OCR errors

-   Document upload errors

-   Security errors

-   Cross-module errors

#### 10.16.1 Global Error Message Principles

### All error messages must be:

✔ Human-readable

✔ Precise

✔ Free from technical jargon

✔ Tell the user what to do next

✔ Consistently styled across modules

### Structure of every error message:

A. What happened

B. Why it happened

C. What the user must do to fix it

Example:

❌ Bad: "Validation error: 422."

✔ Good: "The TIN you entered does not match the value found on the
uploaded certificate. Please check and correct it."

#### 10.16.2 Inline Field Validation

Inline validation triggers on:

-   Field blur (when user leaves the field)

-   Real-time input for specific types (email, phone, numeric)

-   Form submission

### Inline UI Elements:

-   Red border

-   Red error text under field

-   Error icon

-   Tooltip (optional)

### Mandatory fields must show:

"This field is required."

### Formatting failures:

-   "TIN must be 10 digits."

-   "Phone number must start with country code."

-   "Email format is invalid."

### Data mismatch failures:

-   "Company name does not match the document provided."

-   "Address does not match registration certificate."

#### 10.16.3 Form-Level Validation

Form-level error bar appears at the top of the form.

### Bar must include:

-   Error icon

-   Summary text ("Please fix 3 errors on this page.")

-   "Jump to error" links

-   Dismiss button

#### 10.16.4 Document Upload Errors

Document upload errors must clearly explain the issue.

### Error types:

-   Invalid file type

-   File too large

-   Corrupted PDF

-   Blurry image (OCR cannot read)

-   Unsupported document format

-   Virus scan failure (if enabled)

### Examples:

"Upload failed: The file is too large. Maximum allowed size is 50MB."

"OCR failed: The image is too blurry. Please upload a clearer version."

### Retrying:

UI must show:

-   Retry button

-   Replace file button

#### 10.16.5 OCR Errors

OCR errors can occur due to:

-   Low resolution

-   Handwritten documents

-   Stamps over text

-   Bad lighting

-   Rotated images

-   Non-standard fonts

### OCR Error UI:

-   Highlight problematic fields

-   Provide AI guess confidence

-   "Retry OCR" button

-   "Accept as-is" (role-based)

-   Suggest uploading a clearer copy

#### 10.16.6 API & Network Errors

If API fails:

### Badge at top:

"Unable to reach the server. Please check your connection."

### Behavior:

-   Autosave offline

-   Retry logic (3 attempts)

-   Save to local cache

-   Re-sync when back online

### Specific errors:

-   Timeout

-   500 server error

-   401 unauthorized

-   403 forbidden

Messages must NOT expose stack traces.

#### 10.16.7 Workflow Errors

If workflow step is unavailable or invalid:

### Types:

-   Approver not assigned

-   Role mismatch

-   Workflow stuck or delayed

-   Workflow blocked due to missing documents

### UI examples:

"Approval cannot proceed because required documents are missing."

"Workflow is waiting for Procurement review."

### Provide buttons:

-   Re-assign approver

-   Notify next approver

-   Escalate to Admin

#### 10.16.8 Bank Verification Errors

### Possible errors:

-   Account name mismatch

-   Incorrect account number format

-   Missing bank letter

-   Verification timeout

### UI Example:

"Account name does not match the legal name. Please verify and re-upload
evidence."

#### 10.16.9 Tax Validation Errors

Tax mismatches cause critical issues.

Examples:

-   Invalid TIN

-   Wrong tax residency

-   Missing VAT registration

-   WHT rate conflict

UI must show:

❌ WHT rate mismatch:

Document indicates 5% but system expects 2%.

You may override with explanation.

#### 10.16.10 Permission & Security Errors

Examples:

-   Viewing restricted document

-   Editing disabled field

-   Changing protected workflow

-   Accessing unauthorized vendor

UI must show:

"You do not have permission to perform this action."

Role requirements must be clear.

#### 10.16.11 ERP Sync Errors

These affect AP and vendor activation.

### Common errors:

-   ERP connection failed

-   Field mapping missing

-   Duplicate vendor ID in ERP

-   ERP system timeout

UI must show:

-   Error details

-   Suggested fix

-   Retry sync

-   Download error log

#### 10.16.12 Duplicate Vendor Detection Errors

Duplicate detection produces:

-   Warnings

-   Blocking errors

-   Advisory messages

Examples:

### Warning (yellow):

"Possible duplicate vendor detected. Please review before continuing."

### Blocking (red):

"This vendor already exists in the system. Onboarding cannot continue."

UI must provide:

-   Compare button

-   Merge option (if tenant allows)

#### 10.16.13 Legal/KYC Errors

For compliance:

### Types:

-   Missing required document

-   Document expired

-   Identity mismatch

-   Country risk restriction

UI message:

"Vendor is located in a restricted country. Compliance review required."

#### 10.16.14 Clarification Errors

If clarification cannot be processed:

-   Message too long

-   Invalid attachment

-   Thread closed

UI shows:

"Clarification thread is closed. Please open a new request."

#### 10.16.15 Mobile Error Handling UI

Mobile optimizations:

-   Bottom pop-up error messages

-   Pull-to-refresh retry

-   Inline error highlights

-   One-tap retry buttons

Avoid covering input fields.

#### 10.16.16 Accessibility Requirements for Errors

Errors must:

-   Be screen-reader accessible

-   Have ARIA live regions

-   Follow contrast rules

-   Support keyboard focus

#### 10.16.17 Error Logging Requirements

Every error must be recorded in:

-   Audit log

-   Developer error log

-   User activity log

Fields logged:

-   Timestamp

-   User

-   Module

-   Error type

-   API endpoint

-   Resolution (if fixed)

### 10.17 Workflow Timeline UI Requirements

The Workflow Timeline is one of the most important UI components in the
entire Vendor Onboarding Module.

It visually communicates:

-   Where a vendor is currently in the workflow

-   Who has approved which step

-   Where delays or bottlenecks exist

-   Whether clarifications occurred

-   Rejection reasons

-   SLA status

-   Any escalation

-   Audit-relevant timestamps

This section defines the complete UI/UX requirements for an advanced,
enterprise-grade workflow timeline.

#### 10.17.1 Goals of the Workflow Timeline UI

The timeline must:

✔ Provide clear, transparent workflow visibility

✔ Display step-by-step progress

✔ Highlight pending tasks and owners

✔ Show all clarification cycles

✔ Show rejection and rework loops

✔ Support detailed drill-down

✔ Support mobile responsiveness

✔ Provide audit-grade accuracy

✔ Update in real time

✔ Allow role-based viewing

#### 10.17.2 Timeline Placement & Access

The workflow timeline must be accessible from:

-   Vendor Master Profile (primary)

-   Vendor Review Screens

-   Approver screens

-   Clarification screens

-   Audit Trail

-   Mobile view under separate "Workflow" tab

UI must include a dedicated Workflow Timeline tab in all reviewer-facing
UIs.

#### 10.17.3 Timeline Layout Structure

### On Desktop:

Horizontal timeline at the top, expandable vertical details below.

### On Mobile:

Vertical stacked layout (one step per expandable card).

#### 10.17.4 Timeline Nodes (Workflow Steps)

Each step in the workflow is represented as a Timeline Node.

### Node Must Display:

-   Step name

-   Role responsible (LM, HOD, GM, Procurement, Finance, KYC, Legal)

-   Status badge:

    -   Completed (green)

    -   Pending (gray)

    -   In Progress (blue)

    -   Rejected (red)

    -   Clarification Requested (orange)

    -   On Hold (yellow)

-   Timestamp (date/time)

-   Approver name & title

-   SLA countdown indicator

-   Icons for:

    -   Comments

    -   Attachments

    -   Documents validated

#### 10.17.5 Node Status Behaviors

### 1. Completed (Green)

-   Solid green circle

-   Line leading to next node becomes solid

-   Completion timestamp displayed

### 2. In Progress (Blue)

-   Animated pulse

-   Tooltip: "Awaiting action from {{role}}"

### 3. Pending (Gray)

-   Gray outline

-   Disabled hover state

### 4. Rejected (Red)

-   Red triangle icon

-   Node turns red

-   Rejection reason shown

-   "View rejection details" link

### 5. Clarification Requested (Orange)

-   Orange question icon

-   Indicates action required

-   "View clarification thread" link

### 6. On Hold (Yellow)

-   Yellow pause icon

-   Tooltip explaining reason

#### 10.17.6 Node Expansion Panel

Clicking a node expands a detailed panel beneath it.

### Expanded Panel Shows:

-   Approver details

-   Comments

-   Attachments

-   Clarification threads

-   Reasons for rejection

-   Supporting documents

-   Time spent in step

-   SLA performance status

-   Delegation information (if reassigned)

-   Link to open full vendor profile

#### 10.17.7 Clarification Loop Visualization

Clarification loops must be explicitly visible.

### UI Structure:

-   Curved line looping back to previous node

-   Orange pulse animation

-   "Clarification round 1 / 2 / 3" labels

-   Expandable message thread

### Clarification Thread UI:

-   Chat-style messages

-   Timestamps

-   Attachments

-   Roles tagged (e.g., "\@Vendor", "\@Procurement")

#### 10.17.8 Rejection Flow Visualization

When a rejection occurs:

### UI Behavior:

-   Node turns red

-   Downward branch appears beneath timeline

-   Rejection reason displayed

-   Next node becomes disabled

-   Action button: "Resubmit after correction"

-   Audit trail logged

If resubmitted, timeline must show:

✔ Resubmission arrow

✔ New approval loop

✔ Updated timestamps

✔ "Resubmitted" badge

#### 10.17.9 SLA Indicators

Each node has SLA-bound behavior.

### Node UI Shows:

-   Time remaining

-   Time overdue

-   SLA percentage bar

-   Color-coded timer:

    -   Green (>50% time left)

    -   Yellow (<50%)

    -   Orange (<20%)

    -   Red (expired)

If SLA breached:

-   Node border flashes red

-   Approver receives alert

-   Tenant Admin / Super Admin sees SLA alert

#### 10.17.10 Workflow Legend UI

A legend must be displayed:

-   Green = Completed

-   Blue = In Progress

-   Gray = Pending

-   Red = Rejected

-   Yellow = On Hold

-   Orange = Clarification

#### 10.17.11 Real-Time Updates

Workflow timeline updates in real-time using:

-   WebSockets or

-   Server-Sent Events (SSE)

When a reviewer approves:

✔ Node updates immediately

✔ Next node activates

✔ Notifications fired

✔ SLA timers reset

#### 10.17.12 Role-Based Visibility

### Vendor Portal Users See:

-   Only their portion:

    -   Vendor Submission (completed)

    -   Clarification loops

    -   Final approval

They cannot see:

-   Internal comments

-   Internal rejections

-   KYC notes

-   Auditor notes

### Requestor Sees:

-   All internal steps except Finance/KYC/Legal details

-   Clarification threads

-   Rejection reasons that involve them

### Internal Approvers See:

-   Full workflow

-   All steps and details

### Tenant Admin Sees:

-   All workflows across all vendors

### Super Admin Sees:

-   All workflows across all tenants

#### 10.17.13 Workflow Modification & Manual Overrides

UI must support:

### Tenant Admin Actions:

-   Reassign approver

-   Skip step (if allowed)

-   Add new step (affects future workflows only)

-   Rerun step

-   Force approve (logged with high-severity audit)

UI for override:

-   Modal window with reason field

-   Requires digital signature or password

-   Highlight in timeline with "Manual Override" badge

#### 10.17.14 Mobile Timeline UI Requirements

### Mobile must show:

-   Vertical stacked timeline

-   Expandable accordion nodes

-   Icons instead of text labels

-   Sticky action bar at bottom

### Actions:

-   Approve

-   Reject

-   Add comment

-   View documents

#### 10.17.15 Workflow Timeline Performance Requirements

Timeline must load:

-   ≤ 300ms for small workflows (≤ 8 nodes)

-   ≤ 500ms for advanced workflows (≤ 15 nodes)

Lazy-loading can be used for extremely complex tenant workflows.

#### 10.17.16 Workflow Export UI

Users must be able to export the timeline:

### Export formats:

-   PDF

-   PNG

-   SVG vector (for presentation)

### Export panel must show:

-   Include timestamps? (checkbox)

-   Include comments?

-   Include SLA status?

-   Include clarifications?

#### 10.17.17 Audit Trail Integration

Every workflow action must automatically:

✔ Add an audit log record

✔ Capture old and new state

✔ Record user, timestamp, IP

✔ Log reasons for overrides

✔ Record document actions

### 10.18 End-to-End UI Flow Summary

This section provides a complete, high-level but fully detailed
walkthrough of how all UI components come together in the Vendor
Onboarding Module---across Vendor Portal, Internal User Portals, Tenant
Admin, and Super Admin.

It describes the full user journey, integrating all UI behaviors
described in previous sections, ensuring consistency, clarity, and
traceability across the entire workflow.

This end-to-end flow ensures:

-   Every screen transitions seamlessly

-   Users understand where they are at all times

-   Validation and error handling is consistent

-   Workflow progression is visible

-   Documents are processed correctly

-   Approvers experience a streamlined review journey

-   Audit trails are naturally integrated

-   Role-based visibility is preserved

-   Notifications tie into action points

-   The experience is intuitive on desktop and mobile

#### 10.18.1 Vendor Onboarding Journey (Vendor Portal)

**Step 1 --- Vendor Receives Onboarding Invitation**

-   Email contains:

    -   Tenant branding

    -   Secure onboarding link

    -   Expiry timer (30 days by default)

### UI:

-   Vendor clicks link → directed to onboarding start screen

-   Shows welcome message + tenant logo

-   Shows progress indicator (Step 0/6)

-   "Start Onboarding" button

**Step 2 --- Account Registration**

-   Vendor creates account:

    -   Name

    -   Email

    -   Password

    -   Phone

-   Multi-factor authentication (if tenant requires)

### UI:

-   Form with simple inputs

-   Inline validation

-   OTP screen (if MFA enabled)

-   Account activation confirmation

**Step 3 --- Vendor Information Form (Multi-Step Wizard)**

### Steps:

1.  Company Information

2.  Tax Information

3.  Bank Details

4.  Business Category & Services

5.  Compliance Information

6.  Documents & Attachments

### UI:

-   One step per screen

-   Top progress bar

-   Save as draft

-   Auto-save every 5 seconds

-   Next/Previous navigation

-   OCR-backed autofill where applicable

**Step 4 --- Document Upload & OCR Processing**

### Vendor uploads:

-   CAC / Business registration docs

-   Tax documents (TIN, VAT)

-   Bank letter

-   Utility bill

-   ID of directors (if required)

-   Certificate of Incorporation

-   Contract (optional)

### UI:

-   Drag & drop zone

-   File preview cards

-   OCR auto triggers

-   Mismatch alerts in real time

-   Side-by-side comparison

-   Document status indicators

**Step 5 --- Review & Submit**

### UI:

-   Summary screen

-   Collapsible panels for each section

-   Missing items highlighted

-   Button: Submit for Review

-   Confirmation modal

Submission triggers:

✔ Notifications

✔ Workflow kick-off

✔ Timeline entry

#### 10.18.2 Internal Workflow Journey (Requestor → Approvers → Procurement → Finance → KYC → Legal)

**Step 6 --- Internal Review Dashboard (All Roles)**

UI displays:

-   List of vendors under review

-   Search bar

-   Filters:

    -   Status

    -   Category

    -   Country

    -   Risk level

    -   Submission date

-   SLA countdown badges

-   "Open Vendor Profile" button

**Step 7 --- Vendor Profile Page (Internal View)**

### Tabs:

-   Overview

-   Documents

-   Bank Verification

-   Compliance

-   Workflow Timeline

-   Notes & Communication

-   History

-   Audit Log

-   ERP Sync

### Overview UI Includes:

-   Top summary card

-   Risk scoring

-   Vendor category

-   Submission age

-   Pending tasks

-   Warnings (e.g., mismatch, expiry)

**Step 8 --- Approver Review UI**

Each approver sees:

-   Vendor Summary Panel

-   Required fields marked

-   Documents list with thumbnails

-   OCR mismatches flagged

-   Bank verification panel

-   Tax rules panel

-   Compliance check status

-   Workflow timeline (10.17)

### Action Bar (sticky bottom):

-   Approve

-   Reject

-   Raise Clarification

-   Add Note

**Step 9 --- Clarification Loop UI**

Clarification triggers chat-style thread:

### UI:

-   Speech bubble messages

-   Attachments

-   AI-suggested responses

-   Vendor-side view (limited access)

-   Timeline loop visualization

-   "Thread Closed" status when resolved

**Step 10 --- Finance/KYC Detailed Validation UI**

Includes:

-   High-risk vendor flagging

-   Bank detail cross-checks

-   Tax identification match

-   Document verification

-   Redaction-style sensitive data masks

-   Compliance questions

-   Risk score recalculation

Finance/KYC has additional options:

-   Request additional documents

-   Override rules (with justification)

-   Mark vendor as "High Risk"

-   Escalate to Legal

**Step 11 --- Legal Review UI**

Legal verifies:

-   Contracts

-   Engagement agreements

-   Terms of service

-   Country compliance

UI includes:

-   Version comparison

-   Contract redline notes

-   Document flags

-   Approval actions

#### 10.18.3 Final Approval & Activation

**Step 12 --- Final Review Panel**

The final approver sees an all-in-one summary:

-   Vendor identity summary

-   Risk score

-   Required documents

-   KYC status

-   Bank verification

-   Compliance checklist

-   Tax rules

-   Workflow summary

### UI:

Large, prominent button:

Activate Vendor

Activation triggers:

✔ ERP sync

✔ Vendor ID generation

✔ Notification to vendor

✔ Internal notification

#### 10.18.4 Post-Approval Vendor Experience

Vendor logs into portal:

### UI:

-   Vendor dashboard

-   Invoice submission (if module activated)

-   Manage profile

-   Update documents

-   Status indicators

-   Notifications

Tenant can enable:

-   Invoice upload

-   Payment tracking

-   Contract renewals

-   Document refresh reminders

#### 10.18.5 Tenant Admin Experience (End-to-End)

Tenant Admin UI includes:

### Admin Dashboard:

-   All vendors

-   Active vs Pending

-   Risk levels

-   SLA compliance

-   Workflow bottlenecks

-   Document expiry overview

### Admin Tools:

-   Configure vendor categories

-   Configure required documents

-   Configure workflows

-   Configure tax rules

-   Branding and theme

-   Notification templates

-   Role/permission management

#### 10.18.6 Super Admin Experience (End-to-End)

Super Admin UI includes:

-   Tenant overview

-   Tenant health metrics

-   API health

-   Workflow monitoring

-   Billing

-   Tenant configuration logs

-   Security alerts

-   Audit trail search

Super Admin also oversees:

-   Master vendor categories

-   Global configurations

-   Global KYC templates

#### 10.18.7 Mobile End-to-End Flow Summary

Mobile UI adapts the full journey:

### Vendor:

-   Onboarding

-   Document upload

-   OCR preview

-   Clarification messages

-   Status updates

### Approver:

-   Review

-   Approve/Reject

-   Timeline analysis

### Offline Mode:

-   Draft saving

-   Retries

-   Re-sync

#### 10.18.8 End-to-End Workflow Completion Summary

Once the vendor is fully activated:

### Visible in UI:

-   Activation badge

-   ERP vendor code

-   Risk level

-   Next review date (if periodic review enabled)

### Historical Timeline:

-   Each approval step

-   Clarifications

-   Rejections and corrections

-   Document version history

-   Audit logs

-   Sync logs

The full vendor life cycle becomes traceable from:

Creation → Review → Approval → Activation → Maintenance → Updates →
Deactivation

### 10.19 Appendix: UI Wireframe Descriptions

This appendix provides detailed text-based wireframe specifications for
all key screens in the Vendor Onboarding Module.

Although these are NOT visual sketches, they provide precise component
placement and behavior so designers and engineers can produce consistent
high-fidelity UI mockups later.

These wireframe descriptions follow a structured layout for readability:

-   Page Title

-   Purpose

-   Sections

-   Component Placement

-   User Actions

-   Validation & Behaviors

-   Mobile Adaptation

-   Role-Based UI Differences

#### 10.19.1 Vendor Portal --- Welcome & Start Screen

### Purpose:

The first screen vendors see after opening the onboarding link.

### Layout:

-   Centered card

-   Tenant logo at top

-   Title: "Welcome to {{Tenant Name}} Vendor Onboarding"

-   Subtitle: "Please complete the steps below to become an approved
    vendor."

-   Button: "Start Onboarding" (primary)

-   Link: "Continue from where you stopped" (if a draft exists)

-   Expiry badge: "This link expires in {{days}} days"

### Mobile:

-   All content vertically stacked

-   Button size increased for touch

#### 10.19.2 Vendor Registration Page

### Sections:

1.  Basic Information

2.  Create Password

3.  Verification (if MFA)

### UI Components:

-   Full-width text inputs

-   Password strength meter

-   Checkbox: "Agree to Terms & Conditions"

-   Button: "Create Account"

#### 10.19.3 Vendor Onboarding Wizard -- Multi-Step Form

### Step 1 --- Company Information

Fields:

-   Legal Name

-   Trading Name

-   Registration Number

-   Business Category

-   Country

-   Address

-   Website

Actions:

-   Next

-   Save Draft

### Wireframe Layout:

-   2-column layout on desktop

-   1-column layout on mobile

-   Progress bar at top

#### 10.19.4 Document Upload Page

### Layout:

-   Section headers for each document type

-   Document card placeholder

-   "Upload Document" button

-   Drag & drop zone

### After Upload --- Card Shows:

-   Thumbnail on left

-   Filename

-   Status badge ("OCR Processing...")

-   Action icons:

    -   View

    -   Replace

    -   Delete

    -   Compare

#### 10.19.5 Full-Page Document Viewer

### Top Bar:

-   Back button

-   Document Title

-   Download

-   Rotate

-   Zoom controls

-   Close (X)

### Body:

-   Document canvas

-   Page thumbnails (left)

### Right Drawer (optional):

-   OCR extracted fields

-   Confidence bars

-   Accept/Reject buttons

#### 10.19.6 Vendor Summary Review Page (Before Submission)

### Sections:

-   Company details

-   Tax details

-   Bank details

-   Documents

-   Compliance checklist

### UI:

-   Expandable accordions

-   Status icons (complete/incomplete)

-   Primary button: "Submit"

#### 10.19.7 Internal User Dashboard (Procurement / Finance / Legal)

### Layout:

-   Search bar

-   Filter bar

-   Data table

### Columns:

-   Vendor Name

-   Category

-   Status

-   Submission Date

-   SLA Time Left

-   Last Updated

### Actions:

-   Open Profile

-   Export

-   Assign Reviewer

#### 10.19.8 Internal Vendor Profile Page

### Tabs:

-   Overview

-   Documents

-   Bank Verification

-   Compliance

-   Timeline

-   Notes

-   Audit Trail

### On Right Side (Desktop):

-   Vendor Snapshot Card

-   Risk Score

-   Status Badge

-   Action Buttons

    -   Approve

    -   Reject

    -   Request Clarification

#### 10.19.9 Workflow Timeline (Full View)

### Horizontal Desktop Layout:

-   Nodes arranged left → right

-   Status colors and icons

-   Expandable step details below

### Mobile Layout:

-   Vertical stacked

-   Each node is a card

#### 10.19.10 Clarification Thread Page

### Layout:

-   Message bubbles

-   Attachments preview

-   Input box at bottom

-   "Send Message" button

-   Sidebar showing participants

### Vendor View Differences:

-   No internal-only messages

-   Only vendor-facing comments

#### 10.19.11 Finance Review Page

### Sections:

1.  KYC Verification

2.  Bank Verification

3.  Document Matching

4.  Tax Review

5.  Risk Review

6.  Decision Panel

### Decision Panel:

-   Approve

-   Reject

-   Return for Correction

-   Add Notes

#### 10.19.12 Legal Review Page

### Components:

-   Contract viewer

-   Version comparison tool

-   Clause checklist

-   Comment box

-   Approve/Reject/Request Revision

#### 10.19.13 Vendor Activation Page

### When final approver validates vendor:

### UI:

-   Success animation

-   Vendor ID (bold, large)

-   "Vendor is now Active"

-   Button: Go to Vendor Profile

-   Button: Sync to ERP (if manual)

#### 10.19.14 Vendor Portal Dashboard (Post-Activation)

### Sections:

-   Vendor status

-   Documents

-   Invoices (if enabled)

-   Clarifications

-   Notifications

-   My Profile

### Cards:

-   "Submit Invoice"

-   "Upload Updated Document"

-   "View Payments / Aging" (if AR/AP integrated)

#### 10.19.15 Tenant Admin Configuration Screens (Simplified Wireframes)

### Vendor Settings Overview

-   Cards for:

    -   Categories

    -   Required Documents

    -   Workflows

    -   Tax Rules

    -   KYC Requirements

### Workflow Builder Screen

-   Drag-and-drop nodes

-   Sidebar with step types

-   Configuration modal when clicking node

### Notification Template Editor

-   Left: Template list

-   Right: Editor

-   Top: Preview, Save, Test

#### 10.19.16 Super Admin Tenant Oversight Panel

### Layout:

-   Global search

-   Tenant list

-   Health indicators

-   API logs overview

-   Configuration audit trail

-   Billing metrics

#### 10.19.17 Mobile Wireframe Summary

### General Mobile Rules:

-   One component per row

-   Sticky bottom bar for actions

-   Swipe navigation between tabs

-   Pull-to-refresh

-   Accordion components for large sections

### Key Mobile Screens:

-   Vendor onboarding wizard

-   Document uploader

-   Workflow timeline

-   Clarification messages

-   Vendor profile

-   Approver panel

#### 10.19.18 Accessibility Wireframe Notes

Every wireframe must account for:

-   Focus outlines

-   ARIA labels

-   Screen reader text

-   High contrast mode toggle

-   Keyboard-friendly actions

#### 10.19.19 Performance Wireframe Notes

Wireframes must accommodate:

-   Skeleton loaders

-   Lazy-loading lists

-   Progressive document loading

-   Optimized mobile rendering

## 11.0 NON-FUNCTIONAL REQUIREMENTS (NFRs)

Non-Functional Requirements define how the Vendor Onboarding Module must
behave---not the business logic, but the engineering qualities that make
the system reliable, scalable, fast, secure, and maintainable.

ZivaBI is an enterprise-class multi-tenant automation platform, so the
NFRs must match world-class products like SAP Ariba, Oracle Fusion,
Coupa, Workday, and Netsuite.

This section covers:

-   Performance

-   Scalability

-   Availability

-   Reliability

-   Security

-   Data privacy

-   Multi-tenancy isolation

-   Network requirements

-   Integrations

-   Extensibility

-   Logging & monitoring

-   Compliance

-   Disaster recovery

-   Maintainability

### 11.1 Performance Requirements

#### 11.1.1 API Response Times

-   Critical APIs: < 800ms

-   Document-related APIs: < 2 seconds

-   OCR extraction APIs: < 3 seconds (async allowed)

-   Vendor submission: < 1 second

#### 11.1.2 UI responsiveness

-   First Contentful Paint (FCP): ≤ 1.5s

-   Time To Interactive (TTI): ≤ 2.5s

-   Mobile load: ≤ 3s

-   Navigation between screens: ≤ 300ms

-   Document viewer initial load: ≤ 1s

#### 11.1.3 Workflow updates

-   Approvals must reflect system-wide in < 500ms

-   SLA countdown timers update live

### 11.2 Scalability Requirements

#### 11.2.1 Horizontal scaling

The system must scale horizontally for:

-   Vendor onboarding spikes

-   Peak financial operations periods

-   Tenants onboarding thousands of vendors

#### 11.2.2 Multi-tenant load scalability

Each tenant must be isolated logically but share compute.

The system must support:

-   Up to 10,000 tenants

-   Up to 5 million vendors

-   Unlimited documents

-   Concurrent OCR processing

#### 11.2.3 OCR scaling

OCR pipeline must scale automatically using:

-   Job queues

-   Cloud functions

-   Distributed workers

### 11.3 Availability Requirements

#### 11.3.1 Uptime Target

-   99.9% uptime (SLA)

-   Planned maintenance allowed only during low-traffic windows

#### 11.3.2 Zero-downtime deployments

-   Use rolling updates or blue-green deployment

#### 11.3.3 Multi-region support

Future requirement:

-   Automatic failover between regions

### 11.4 Reliability Requirements

#### 11.4.1 Retry Mechanisms

-   Automatic retries for transient API failures

-   Exponential backoff

-   Graceful fallback UI

#### 11.4.2 Consistency

-   Eventual consistency allowed for non-critical data

-   Strong consistency for:

    -   Approvals

    -   Vendor activation

    -   Tax data

    -   Banking details

    -   ERP sync

#### 11.4.3 Autosave

-   Form autosave every 5 seconds

-   Offline autosave for mobile

### 11.5 Security Requirements

ZivaBI follows the highest enterprise security standards.

#### 11.5.1 Authentication

-   OAuth 2.0 / OpenID Connect

-   Multi-factor authentication (optional per tenant)

-   Biometric login (mobile)

#### 11.5.2 Authorization

-   Role-based access control (RBAC)

-   Attribute-based access control (ABAC)

-   Fine-grained permissions

-   Row-level access enforcement

#### 11.5.3 Encryption

-   Data in transit: TLS 1.2+

-   Data at rest: AES-256

-   Key rotation supported

#### 11.5.4 Secrets Management

-   Managed using cloud KMS

-   Secrets never hard-coded

#### 11.5.5 Secure Vendor Access

Vendors only access their own portal; absolutely no internal views.

### 11.6 Data Privacy Requirements

#### 11.6.1 Compliance

-   GDPR

-   CCPA

-   Nigeria NDPR

-   UK DPA

-   EU/UK privacy shields

-   Any tenant-specific jurisdictional laws

#### 11.6.2 Data minimization

Only necessary vendor data is collected.

#### 11.6.3 PII Handling

-   Masked fields (TIN, bank details, IDs)

-   Redaction feature for sensitive docs

#### 11.6.4 Data Residency

Tenant may choose storage region.

### 11.7 Multi-Tenant Isolation Requirements

This is one of the most important NFRs.

#### 11.7.1 Hard Isolation

Each tenant must have isolated:

-   Data

-   Documents

-   Workflows

-   Logs

-   Notification templates

-   Vendor records

#### 11.7.2 Document Storage

Documents stored in tenant-scoped buckets:

/tenant_id/vendor_docs/...

#### 11.7.3 Theming Isolation

Tenant themes must not leak to other tenants.

#### 11.7.4 Performance Isolation

A single tenant's heavy processing must not degrade another tenant.

### 11.8 Network Requirements

#### 11.8.1 API Gateway

-   Rate limiting

-   Throttling

-   IP whitelisting (for ERP integrations)

#### 11.8.2 Bandwidth Efficiency

-   Compressed document preview

-   Optimized mobile assets

### 11.9 Integration Requirements

#### 11.9.1 ERP Integrations

Support connectors for:

-   SAP

-   Oracle

-   Microsoft Dynamics

-   Sage X3

-   QuickBooks

-   Netsuite

#### 11.9.2 Webhooks

-   Vendor activation

-   Document approval

-   ERP sync events

#### 11.9.3 API Versioning

-   Use /v1/vendor/onboarding structure

### 11.10 Extensibility Requirements

System must support:

-   Adding new vendor categories

-   Adding new fields

-   Adding new onboarding steps

-   Adding new document types

-   Adding new tax rules

-   Adding new KYC workflows

-   Adding new risk scoring rules

without code changes for most cases.

### 11.11 Logging & Monitoring Requirements

#### 11.11.1 System Logs

-   API logs

-   Workflow logs

-   OCR logs

-   Audit logs

-   Error logs

#### 11.11.2 Monitoring

-   Performance dashboard

-   Workflow SLA dashboard

-   Vendor processing throughput

#### 11.11.3 Alerting

Alerts for:

-   SLA breaches

-   API errors

-   ERP sync failures

-   Document processing errors

-   Security violations

### 11.12 Compliance Requirements

#### 11.12.1 Audit Trails

-   Immutable

-   Timestamped

-   Role-based views

-   Exportable (PDF, CSV)

#### 11.12.2 Periodic Access Reviews

Tenant admins must conduct periodic reviews.

### 11.13 Backup & Disaster Recovery Requirements

#### 11.13.1 Backup

-   Daily full backup

-   30-day retention (default)

-   Tenant can configure retention

#### 11.13.2 Restoration

-   Recovery Time Objective (RTO): 4 hours

-   Recovery Point Objective (RPO): 15 minutes

### 11.14 Maintainability Requirements

#### 11.14.1 Code Quality

-   Modular

-   Component-based

-   High test coverage

-   Linting enforced

-   API contracts documented

#### 11.14.2 Documentation

-   API docs

-   Admin docs

-   Setup wizard docs

-   User training material

## 12.0 REPORTING & ANALYTICS REQUIREMENTS

Vendor Onboarding must provide powerful, real-time analytics that help:

-   Procurement optimize onboarding and vendor performance

-   Finance ensure tax and banking compliance

-   Legal track contract processing

-   Compliance/KYC monitor risk

-   Tenant Admin analyze operational efficiency

-   Super Admin monitor multi-tenant usage

The analytics engine must produce real-time, multi-dimensional,
drillable insights, with exportability and dashboard-ready structures.

This section defines the functional, UI, and data requirements for
reporting and analytics specifically tied to the Vendor Onboarding
module.

### 12.1 Reporting Objectives

The reporting system must enable stakeholders to:

### ✔ Identify workflow bottlenecks

### ✔ Monitor SLA compliance

### ✔ Track vendor risk distribution

### ✔ Observe onboarding throughput

### ✔ Detect recurring document mistakes

### ✔ Predict delays using AI (future)

### ✔ Track clarifications, rejections, and rework

### ✔ Ensure compliance with tax & KYC requirements

### ✔ Identify fraudulent or suspicious vendors

### ✔ Monitor ERP sync health and integration outcomes

### ✔ Produce audit-ready reports

### 12.2 Reporting Types

The platform must support 4 categories of reports:

### 1. Operational Reports

For day-to-day tracking:

-   Vendors onboarding today

-   Pending approvals

-   SLA time remaining

-   Rejected vendors

-   Clarification loops

### 2. Compliance Reports

For Finance / KYC:

-   KYC approval metrics

-   Tax certificate validity

-   Risk scoring distribution

-   Document expiry tracking

### 3. Procurement Analytics

-   Vendor category distribution

-   Onboarding cycle time per category

-   Vendor performance leading to future procurement scoring

-   Time to contract approval

### 4. Executive Dashboards

For Admins and leadership:

-   Total vendors onboarded

-   SLA adherence

-   Bottleneck heat maps

-   Cross-tenant dashboards (Super Admin)

### 12.3 Key Metrics & KPIs

### Vendor Onboarding Core KPIs

-   Total vendors onboarded

-   Vendors onboarded this month

-   Average onboarding time

-   Median onboarding time

-   Longest workflow step

-   Steps with highest rejection rate

-   Steps with highest clarification frequency

-   Vendors per category

-   Vendors by country

-   Vendors by risk level

### Compliance & Finance KPIs

-   KYC pass rate

-   Document mismatch rate

-   Bank verification failures

-   Tax verification failures

-   Vendor activation failures

-   Document expiry due within 30, 60, 90 days

### Workflow & SLA KPIs

-   SLA compliance %

-   Approvals completed within SLA

-   Steps breaching SLA

-   Approver workload distribution

-   Time per step per role

-   Escalations

### Super Admin KPIs (Across All Tenants)

-   Tenant onboarding activity

-   Performance by tenant

-   Vendor throughput across tenants

-   Integration health across tenants

### 12.4 Analytics Dashboards UI Requirements

Dashboards must follow a modern design:

### UI Components:

-   KPI tiles

-   Bar charts

-   Line charts

-   Pie charts

-   Donut charts

-   Heatmaps

-   Tables

-   Filters panel

-   Date picker

-   Segmentation chips (e.g., Category / Country / Risk Level)

### Dashboard Structure:

-   Top row: KPI tiles

-   Middle: Visualizations

-   Bottom: Tabular detail drill-down

-   Right panel (optional): Filters

### 12.5 Filters (Global & Local)

All reports must support dynamic filtering by:

-   Vendor category

-   Vendor country

-   Submission date range

-   Approval stage

-   Workflow status

-   SLA status

-   Assigned approver

-   Document compliance status

-   Risk level

-   TIN availability

-   Bank verification status

Super Admin also filters by:

-   Tenant

-   Region

-   Industry

### 12.6 Drill-Down & Deep-Dive Requirements

Users must be able to:

-   Click any datapoint (e.g., a bar chart segment) → open the filtered
    vendor list

-   Click a vendor → open vendor profile

-   Click a workflow step → open timeline

-   Click a document metric → open document viewer

Drill-down must support up to 5 levels.

### 12.7 Export Requirements

Exports must be available in:

-   Excel (.xlsx)

-   CSV

-   PDF

-   JSON (API-based export)

### Export Options:

-   Current filters

-   Full dataset

-   Columns selection

-   Anonymize PII (optional)

-   Include audit trail (optional)

### 12.8 Scheduling & Automation

Tenants must be able to:

-   Schedule reports (daily, weekly, monthly)

-   Configure recipients

-   Export formats

-   Select filters to apply

-   Enable PII masking

Reports delivered via:

-   Email attachment

-   Secure link

-   In-app message

### 12.9 Real-Time Monitoring Widgets

Modules must include:

### Real-Time SLA Widget

Shows:

-   Number of workflows due within 2 hours

-   Steps overdue

-   SLA breach count

### Real-Time Clarification Widget

Shows:

-   Active clarification threads

-   Threads idle > 48 hours

### Real-Time Compliance Widget

Shows:

-   Pending KYC

-   Document failures

-   Expiring certificates

### 12.10 AI-Assisted Analytics (Future Enhancement)

AI will assist with:

-   Predicting onboarding delays

-   Detecting fraud or inconsistencies

-   Suggesting vendor categories

-   Identifying risk patterns

-   Auto-flagging document anomalies

### Example:

"Vendors with similar profiles exhibit 40% higher rejection rates due to
tax certificate issues."

### 12.11 Reporting Security & Permissions

### Role-Based Access:

-   Vendors: No analytics access

-   Internal approvers: Limited view

-   Procurement: Category-based reports

-   Finance/KYC: Compliance reports

-   Tenant Admin: Full tenant analytics

-   Super Admin: All-tenant analytics

### Sensitive Data:

-   Mask bank details

-   Mask TIN

-   Mask ID documents

### 12.12 Data Model Requirements for Analytics

Analytics requires:

-   Fact tables for onboarding events

-   Dimension tables for:

    -   Vendor

    -   Category

    -   Country

    -   Risk level

    -   Workflow stage

    -   Document type

-   Time-series tables

-   SLA tracking tables

-   Audit trail tables

### 12.13 Performance Requirements for Analytics

Dashboards must load:

-   Initial load: ≤ 2s

-   Drill-down: ≤ 1s

-   Export: ≤ 3s

Large datasets must support:

-   Pagination

-   Lazy loading

-   Query optimization via indexes

-   Caching

## 13.0 VENDOR LIFECYCLE MANAGEMENT REQUIREMENTS

Vendor Lifecycle Management (VLM) defines all stages a vendor passes
through in ZivaBI from creation to archival. This includes:

-   Full vendors

-   One-time vendors

-   Temporary vendors

-   Expense-only vendors

-   High-risk vendors

-   Non-resident vendors

-   Contractual/Retainer vendors

-   3PL vendors

-   Tax-sensitive vendors

-   Bank-dependent vendors

The objective is to ensure:

✔ complete vendor traceability

✔ clear compliance checkpoints

✔ lifecycle controls for audit

✔ automated deactivation rules

✔ tenant-configurable lifecycle policies

✔ full alignment with procurement, finance, and AP workflows

### 13.1 Vendor Lifecycle Objectives

The Vendor Lifecycle Management system must:

-   Handle multiple vendor types

-   Provide configurable workflows

-   Maintain accuracy and data integrity

-   Support ERP integration

-   Provide automated reviews and renewals

-   Track vendor activities, invoices, and compliance

-   Enable suspension, reactivation, deletion, archival

-   Support auto-promotion from temporary → full vendor

-   Ensure internal and statutory compliance

-   Support multi-country onboarding variations

### 13.2 Vendor Types (Including One-Time Vendor)

The system must support at least eight vendor types, each with unique
properties:

### 1. Full Vendor (Standard)

-   Full onboarding

-   Full KYC

-   Full workflow

### 2. One-Time Vendor (Temporary / Limited Use) --- NEW

-   Light onboarding

-   Minimal documentation

-   Used ONLY for:

    -   Employee reimbursements

    -   Advance retirements

    -   Small procurement items

    -   Hotels

    -   Car hires

    -   Event venues

    -   Minor ad-hoc purchases

-   Auto-expiring

-   Tenant-configurable

### 3. Expense-Only Vendor

-   For reimbursements ONLY

-   NO AP/PO usage

-   Bypasses procurement

### 4. Contract Vendor (Retainer)

-   Requires contract upload

-   Auto-renewal or end-of-contract workflow

### 5. Non-Resident Vendor (Foreign Vendor)

-   Requires special tax rules

-   Requires currency mapping

-   Requires statutory compliance

### 6. 3PL / Logistics Vendor

-   Requires SLA mapping

-   Requires warehouse link

-   Additional KYC stage

### 7. Clearing Agent (Importation)

-   Special invoice handling

-   Multiple document stages

-   PPV, VAT, duty impact

### 8. Project/Event Vendors

-   Budget mapping

-   Advance request logic

-   Event execution tie-in

Each vendor type must be selectable by:

-   Requestor

-   Procurement

-   Tenant Admin

Workflow, required documents, and tax rules must adapt automatically.

### 13.3 Vendor Lifecycle Stages

All vendors (regardless of type) go through lifecycle stages.

### Stage 0 --- Creation

-   Initiated by requestor or system (temporary vendor)

### Stage 1 --- Draft

-   Vendor has not yet submitted

-   Editable

### Stage 2 --- Under Review

-   Active across multi-step workflow

-   Clarifications possible

-   Rejections possible

### Stage 3 --- Activated

-   Vendor approved

-   ERP-sync done

-   Vendor can be used in:

    -   AP payments

    -   PO

    -   Expenses

    -   Advances

### Stage 4 --- Active Maintenance

-   Document renewals

-   Bank updates

-   Compliance updates

-   Risk updates

### Stage 5 --- Suspended

-   Temporarily blocked

-   Business cannot transact

### Stage 6 --- Deactivated / Archived

-   No longer usable

-   Retained for audit

### Stage 7 --- Deleted

### (if company policy allows)

-   Soft delete

-   Redacted for privacy

-   Logged in audit

### 13.4 One-Time Vendor Lifecycle

Because you explicitly requested robust support, One-Time Vendors get
their own lifecycle:

### 1. Create (System or User)

-   Employee enters vendor details during expense retirement

-   Or AP enters during exceptional case

-   Or procurement creates temporary vendor record

### 2. Quick KYC (Tenant Configurable)

Minimal fields:

-   Name

-   Invoice number

-   Phone

-   Address (optional)

-   Receipt image

-   Bank details (optional or required)

### 3. Auto-Approval (Optional)

Tenant can choose:

-   Auto-approve one-time vendors

-   Require 1-step approval

-   Require quick KYC check

-   Require finance-only approval

### 4. Auto-Expiration

Based on tenant policy:

-   After 1 transaction

-   After 30 days

-   After month-end close

-   After completion of expense flow

### 5. Promotion to Full Vendor (If Needed)

If a one-time vendor is used more than allowed threshold:

-   System suggests promotion

-   User clicks "Promote to Full Vendor"

-   Full onboarding workflow begins

-   Old data remains linked

### 6. Final Archival

Auto-remove access but retain audit trail.

### 13.5 Workflow Configurations for Vendor Types

Tenant Admin can configure:

### For Full Vendors:

-   Multi-step workflow (Requestor → LM → HOD → GM → Procurement →
    Finance → KYC → Legal → Activation)

### For One-Time Vendors:

Three workflow options:

#### Option A --- Automatic Activation

-   No approvals

-   For low-risk transactions

-   For hotels, taxis, restaurants

#### Option B --- Minimal Workflow

-   Requestor → Finance (quick verification)

#### Option C --- Short Workflow

-   Requestor → Procurement → Finance

### For Contract Vendors:

Adds Legal Review step.

### For Clearing Agents:

Adds Import/Customs verification.

### For 3PL Vendors:

Adds SLA & Warehouse ma

ping step.

Tenant Admin can mix and match workflows per vendor type.

### 13.6 Vendor Data Maintenance

Vendors must allow:

-   Update company information

-   Update bank details (requires finance verification)

-   Update tax documents

-   Update legal agreements

-   Replace expired documents

-   Add new services/capabilities

-   Upload additional compliance documents

Each update may trigger:

-   Full workflow

-   Short workflow

-   Finance-only review

-   Auto-approval (if low-risk)

Tenant config controls this.

### 13.7 Vendor Suspension & Reactivation

### Reasons for Suspension:

-   Expired documents

-   Suspicious activity

-   Tax risk

-   Bank verification failure

-   KYC compliance failure

-   ERP sync issues

-   Tenant manual suspension

### Suspension UI:

-   Suspended badge

-   Reason displayed

-   Vendor cannot be selected in:

    -   AP

    -   Expense

    -   PO

    -   Procurement

### Reactivation Workflow:

-   Vendor updates required documents

-   Workflow triggered depending on vendor type

-   Reactivation approved

### 13.8 Vendor Expiry & Auto-Archival

For one-time vendors:

-   Auto-expire after usage

-   Auto-expire after X days

-   Move to archived state

For full vendors:

-   Archive only via Tenant Admin

-   Maintain audit history

-   Cannot be hard-deleted unless necessary by law

### 13.9 Vendor Promotion From One-Time → Full Vendor

### Trigger Conditions:

-   Vendor used more than X times

-   Expense amount exceeds threshold

-   AP transactions exceed threshold

-   Requestor manually requests promotion

### Promotion Process:

-   System creates new Full Vendor onboarding request

-   Vendor receives email to complete full workflow

-   Prior documents available for reuse

-   Vendor assigned new Vendor ID after ERP sync

### 13.10 Cross-Module Lifecycle Anchors

Vendor lifecycle must integrate with:

-   AP

-   Inventory

-   Expenses

-   Travel Advance

-   Fixed Assets

-   3PL Logistics

-   Import Clearing

-   Customer Onboarding

-   Settlement Engine

Examples:

-   Suspended vendor cannot be used for AP invoices

-   Expired vendor cannot be assigned as clearing agent for inbound
    shipment

-   One-time vendor cannot be used for asset capitalization

-   Vendor under review cannot receive payment

### 13.11 Notifications Throughout Vendor Lifecycle

All lifecycle events trigger notifications:

-   Vendor under review

-   Suspended

-   Activated

-   Documents expiring

-   Bank details updated

-   Tax details updated

-   Pending review

-   Clarifications

-   Expired one-time vendor

-   Promotion suggestion

### 13.12 Tenant-Specific Vendor Policy Controls

Tenants define:

-   Vendor types allowed

-   Required documents per vendor type

-   Workflow per vendor type

-   Tax rules per vendor type

-   Bypass rules for one-time vendors

-   Expense-only vendor settings

-   Suspended vendor usage rules

-   Document expiry reminders

-   Auto-expire rules

### 13.13 Vendor Deletion & Data Retention

### Soft Delete Only

-   Vendor moves to deleted bucket

-   PII may be redacted

-   Retained for audit

### Hard Delete

-   Allowed only on legal request

-   Only by Super Admin

-   Logged permanently

### 13.14 Audit & Compliance Requirements

Lifecycle must produce:

-   Full audit history of every action

-   Document version history

-   Bank change verification logs

-   Workflow transitions

-   Identity of every approver

-   Rejection explanations

-   Clarification threads

-   ERP sync logs

## 14.0 GLOSSARY OF TERMS (Vendor Onboarding Module Only)

This glossary defines all terminology used throughout the Vendor
Onboarding PRD.

Terms are grouped for clarity.

### 14.1 Core Vendor Terms

### Vendor

A third-party entity that provides goods or services to the tenant
company.

### Full Vendor

A vendor who undergoes the complete onboarding workflow, document
checks, KYC, and final approval.

### One-Time Vendor / One-Off Vendor

A lightweight, temporary vendor used for:

-   employee reimbursements

-   minor expenses

-   hotels, taxis, venues

-   one-time operational payments

    Approved with simplified workflow, auto-expire rules.

### Expense-Only Vendor

Vendors used strictly for expense reimbursement; cannot be used in AP or
PO processes.

### Non-Resident Vendor

Vendor not located in the tenant's jurisdiction; requires special tax
and compliance handling.

### 14.2 Workflow Terms

### Workflow Engine

The subsystem controlling approvals, rejection, clarifications,
escalations.

### Approval Node

A step in the workflow that requires review or decision.

### Clarification Cycle

Two-way communication between reviewers and vendor to resolve missing or
incorrect data.

### Rejection Loop

Process of rejecting a vendor onboarding submission, requiring
correction and resubmission.

### SLA (Service Level Agreement)

Expected time to complete each workflow stage.

### 14.3 Document & OCR Terms

### KYC Documents

Legal and compliance documents required to verify vendor identity (CAC,
TIN, tax cert., etc.).

### OCR (Optical Character Recognition)

AI engine that extracts structured text from uploaded documents for
validation.

### Document Card

UI element representing an uploaded file along with status and actions.

### Document Mismatch

Discrepancy between vendor-entered data and OCR-extracted values.

### Document Expiry

The end date for documents requiring periodic renewal (tax certificates,
CAC filings, etc.).

### 14.4 Tax & Banking Terms

### TIN

Tax identification number (country-specific).

### VAT Registration

Certification that a vendor is eligible to charge and remit VAT.

### WHT (Withholding Tax)

Statutory tax applied based on vendor type and nature of service.

### Bank Verification

Automated validation of account number, account name, and bank
information.

### 14.5 Multi-Tenancy & Security Terms

### Tenant

A company using the ZivaBI system.

### Tenant Admin

Internal administrator managing configuration for a specific tenant.

### Super Admin

ZivaBI platform owner/administrator overseeing all tenants.

### Data Isolation

Ensures each tenant's data is secure and invisible to others.

### Branding/Theming

Customization of UI colors, logo, and typography per tenant.

## 15.0 HIGH-LEVEL ARCHITECTURE SUMMARY (TEXT-BASED)

This section describes the architecture for the Vendor Onboarding module
using structured ASCII diagramming.

### 15.1 Architecture Overview

+---------------------------------------------------------------+

\| ZivaBI Platform \|

+---------------------------------------------------------------+

\| Authentication & Security Layer (OAuth2, MFA, RBAC) \|

\| Multi-Tenant Engine & Tenant Context Resolver \|

\| Workflow Engine (Approvals, SLA, Escalations) \|

\| Document Engine (Upload, Storage, Versioning) \|

\| OCR Engine (Auto Extraction, AI Layer) \|

\| Notification Engine (Email, SMS, Push, In-App) \|

\| ERP Integration Layer (SAP, Oracle, Sage, Dynamics, etc.) \|

\| Audit Engine (Immutable Logs, History, Evidence) \|

+---------------------------------------------------------------+

### 15.2 Vendor Onboarding Module Architecture

+--------------------------------------------------------------+

\| Vendor Onboarding Module \|

+--------------------------------------------------------------+

\| 1. Vendor Portal UI \|

\| 2. Internal User UI (Procurement, Finance, KYC, Legal) \|

\| 3. Vendor Data Model \|

\| 4. Document & OCR Pipeline \|

\| 5. Workflow Configuration Engine \|

\| 6. Vendor Type Engine (Full, One-Time, Non-Resident, etc.) \|

\| 7. Compliance/KYC Validation Engine \|

\| 8. Bank Verification Engine \|

\| 9. Risk Scoring Engine \|

\| 10. Reporting & Analytics Layer \|

\| 11. ERP Sync Connector \|

+--------------------------------------------------------------+.

### 15.3 Data Flow Summary

Vendor → Upload Docs → OCR → Validation → Workflow →

Approval → Activation → ERP Sync → Vendor Ready For Use

## 16.0 USER PERSONAS (Vendor Onboarding)

Comprehensive personas ensure UI/UX and workflow decisions are grounded
in real user needs.

### 16.1 Vendor Persona

Role: External supplier

Goals: Get approved quickly; upload documents easily

Frustrations: Complex forms, unclear errors

Needs:

-   Simple mobile-friendly onboarding

-   Camera upload + OCR autofill

-   Clear instructions + status tracking

### 16.2 Procurement Officer

Role: Reviews vendor capability & category

Goals: Ensure valid supplier fit

Frustrations: Missing documents, long back-and-forth

Needs:

-   Clean vendor summary

-   Fast document review

-   Risk scoring & category-specific checks

### 16.3 Finance Reviewer

Role: Validates bank details, tax information

Goals: Avoid fraud and tax errors

Frustrations: Mismatched bank names, bad OCR

Needs:

-   Bank verification engine

-   Tax mismatch alerts

-   Document comparison

-   Clean approval UI

### 16.4 KYC / Compliance Specialist

Role: Deep identity verification

Needs:

-   Restricted secure document view

-   Ability to flag suspicious vendors

-   Document expiry tracking

### 16.5 Legal Reviewer

Role: Reviews contracts and required legal forms

Needs:

-   Version comparison UI

-   Commenting

-   Track changes across documents

### 16.6 Tenant Admin

Role: Configures workflows, documents, policies

Needs:

-   Drag-and-drop workflow builder

-   Theming & branding controls

-   Vendor policy settings (e.g., One-Time Vendor rules)

### 16.7 Super Admin (ZivaBI Platform Owner)

Needs:

-   Multi-tenant monitoring

-   Tenant health dashboards

-   API usage logs

-   Platform-wide configurations

## 17.0 MODULE INTERDEPENDENCY MAP (TEXT-BASED)

This shows how Vendor Onboarding integrates with other ZivaBI modules.

+-------------------------+
+----------------------------+

\| Vendor Onboarding \| -----> \| Accounts Payable \|

+-------------------------+
+----------------------------+

Provides vendor master Provides payable verification

data, tax rules, bank info and payment eligibility

+-------------------------+
+----------------------------+

\| Vendor Onboarding \| -----> \| Expense Module \|

+-------------------------+
+----------------------------+

Provides approved vendor Supports One-Time Vendors

or temporary vendors for reimbursements

+-------------------------+
+----------------------------+

\| Vendor Onboarding \| -----> \| Travel Advance Module \|

+-------------------------+
+----------------------------+

+-------------------------+
+----------------------------+

\| Vendor Onboarding \| -----> \| Inventory / POSM \|

+-------------------------+
+----------------------------+

Provides vendor type (3PL, clearing agent, POSM supplier)

+-------------------------+
+----------------------------+

\| Vendor Onboarding \| <-----> \| Workflow Engine \|

+-------------------------+
+----------------------------+

+-------------------------+
+----------------------------+

\| Vendor Onboarding \| <-----> \| OCR/Document Engine \|

+-------------------------+
+----------------------------+

+-------------------------+
+----------------------------+

\| Vendor Onboarding \| <-----> \| ERP Sync Engine \|

+-------------------------+
+----------------------------+

## 18.0 PRD CLOSURE STATEMENT

### ✔ This PRD for the ZivaBI Vendor Onboarding Module is

### complete

### , comprehensive, and production-ready.

It includes:

-   Business requirements

-   Functional requirements

-   UI/UX requirements

-   APIs

-   Data models

-   Workflows

-   NFRs

-   Lifecycle rules

-   Reporting

-   Architecture

-   Personas

-   Interdependencies

### ✔ It is now ready for:

-   Engineering development

-   UI/UX design

-   QA test case development

-   Documentation & onboarding

-   Integration planning

-   Executive approval

You can now proceed to the next module PRD (AP, Expenses, etc.) fully
confident that Vendor Onboarding is solid.

