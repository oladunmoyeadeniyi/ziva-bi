# Bank Reconciliation Module — Product Requirements Document (PRD)

**Product:** Ziva BI — Accounting Automation Platform
**Module:** Bank Reconciliation
**Document status:** Converted from source Word document to Markdown
**Converted on:** July 25, 2026

---

## Table of Contents

1. Executive Summary
2. Problem Statement
3. Scope & Module Boundaries
4. Personas & Roles
5. Workflow Requirements
6. Data Model
7. Business Rules
8. Non-Functional Requirements
9. Detailed Feature Requirements
10. UI/UX Design Principles & Screens
11. Integration Requirements
12. Security & Compliance Requirements
13. Reporting & Analytics
14. Open Questions, Future Enhancements & Edge Cases

---

## 1.0 EXECUTIVE SUMMARY

The ZivaBI Bank Reconciliation Module is designed to be the most
advanced, intelligent, flexible, and audit-ready reconciliation system
in the global market, exceeding the capabilities of traditional
solutions like Blackline, Trintech, Sage X3 native reconciliation, SAP
Bank Analyzer, QuickBooks Match, and Oracle Cash Management.

This module eliminates all manual reconciliation pain points---across
all industries, all bank formats, all currencies, all statement
structures, and all tenant configurations---by combining:

-   AI-powered transaction recognition

-   Adaptive OCR for broken/multi-line descriptions

-   Smart GL + BP (Business Partner) auto-mapping

-   Dimension-aware posting

-   Multi-bank, multi-currency, multi-format support

-   Tenant-configurable rules

-   End-to-end workflow approval

-   Full audit trail logging

-   Complete financial traceability

The module works seamlessly with all other ZivaBI modules:

-   Accounts Receivable (AR) --- customer receipts

-   Accounts Payable (AP) --- vendor payments

-   Expense Management --- employee reimbursements

-   Payroll Management --- salary & benefit disbursements

-   Journal Engine --- adjustment entries

-   ERP Integration Module --- syncing postings

-   Tax Engine --- WHT/VAT on fees

-   FX Engine --- FX conversions and gains/losses

By automating reconciliation across all sources and transaction types,
the Bank Reconciliation Module becomes the single source of truth for
cashbook accuracy, drastically reducing month-end close time, audit
queries, and reconciliation errors.

### 1.1 PURPOSE OF THE MODULE

The Bank Reconciliation Module exists to:

1.  Automatically ingest bank statements, regardless of format.

2.  Convert unstructured financial statements into clean, structured
    data.

3.  Match bank transactions to system transactions across all modules.

4.  Post unmatched items correctly with proper GL, BP, and dimensions.

5.  Provide full transparency and auditability for every transaction.

6.  Ensure cashbook accuracy and eliminate financial discrepancies.

7.  Accelerate month-end closures and reduce finance workload by
    80--95%.

This module is mandatory for any organization operating at scale,
especially those with:

-   High volume of AR/AP transactions

-   Multiple bank accounts

-   Multi-currency operations

-   3PL and external operational partners

-   Large staff bases and frequent reimbursement

-   Heavy payroll and vendor payments

-   Complex imports or FX transactions

-   Tight audit/compliance requirements

### 1.2 PROBLEM STATEMENT

Finance teams today struggle with:

### A. Manual extraction & cleaning of bank statements

-   PDF formats differ across banks

-   Mobile app vs Web portal PDFs differ

-   Statement descriptions are broken across multiple rows

Resulting in:

-   Errors

-   Time loss

-   Misclassifications

-   Month-end delays

### B. Manual reconciliation of bank lines

Finance teams manually match:

-   Customer receipts

-   Vendor payments

-   Payroll

-   Employee reimbursements

-   Bank fees

-   FX debits/credits

-   Loan payments

-   Intercompany transfers

-   POS inflows

-   Unidentified bank deposits

Manual matching leads to:

-   Slow reconciliation

-   Missed transactions

-   Double-counting

-   Audit exceptions

-   Lack of traceability

### C. No system learning

Recurring transactions (e.g., fees, POS charges, standing instructions)
must be manually mapped every time.

Finance teams repeat identical tasks every month.

This is inefficient and error-prone.

### D. Zero AI support in current systems

Most ERP-native reconciliation tools lack:

-   OCR

-   AI pattern recognition

-   Multi-format parsing

-   Learning from correction patterns

### E. No connection between bank statements and AR/AP/Expense/Payroll

Today, finance must manually connect:

-   Customer receipt → AR

-   Vendor payment → AP

-   Payroll direct debit → Payroll module

-   Employee reimbursement → Expense module

This increases work and reduces accuracy.

### F. Auditors require detailed evidence

But current manual processes lack:

-   Clean audit trails

-   Transaction-level explanations

-   Automated document bundling

-   GL + BP + dimension traceability

### 1.3 BUSINESS IMPACT

Organizations using manual reconciliation face:

-   8--20 days added to month-end close

-   10--30% of bank transactions incorrectly categorized

-   High audit risk exposure

-   30--70% finance time wasted

-   Inconsistent financial statements

-   Approvals delayed

-   Unallocated/unapplied cash accumulating

-   Missed fraud indicators

-   FX differences improperly posted

-   Difficulty scaling to multiple bank accounts

The ZivaBI Bank Reconciliation Module solves these comprehensively.

### 1.4 SOLUTION SUMMARY

The ZivaBI Bank Reconciliation Module provides:

### ✔

### Any-format bank statement ingestion

Including multi-line OCR reconstruction.

### ✔

### AI-powered auto-matching

Against:

-   AR invoices

-   AP invoices

-   Payroll runs

-   Expense reimbursements

-   Vendor advances

-   Employee advances

-   3PL and clearing agents

-   Manual journal entries

-   Tax remittances

### ✔

### Smart GL & BP classification

Using:

-   Rules

-   AI

-   Past corrections

-   Narration analysis

-   Tenant configuration

### ✔

### Dimension-aware posting

Real IO, Statistical IO, Cost Center IO, Material IO, Location.

### ✔

### Finance review & correction layer

Finance can:

-   Fix mappings

-   Reclassify

-   Split lines

-   Assign BP

-   Adjust dimensions

-   Approve batch for posting

### ✔

### Audit-ready posting

Complete traceability to:

-   Statement page

-   Narration

-   GL line

-   Invoice

-   Business partner

-   Dimensions

-   Workflow actions

### ✔

### Multi-bank, multi-currency, multi-tenant support

### ✔

### Automated exceptions queue

For unresolved or suspicious bank transactions.

### ✔

### Auto-posting of fees, charges, FX impacts

### ✔

### Automatic reconciliation after posting

Showing:

-   Book balance

-   Bank balance

-   Reconciling items

### ✔

### AI learning engine

Improves accuracy monthly with feedback loops.

### 1.5 STRATEGIC VALUE

This module is foundational to the financial health and audit
reliability of tenants using ZivaBI.

Strategic benefits include:

-   95% reduction in reconciliation effort

-   100% clean audit trail

-   95--99% matching accuracy after steady-state learning

-   Real-time visibility of cash

-   Automated posting of bank-related GL transactions

-   Accelerated month-end closure cycle

-   Reduced fraud risk

-   Better working capital management

With this module, ZivaBI becomes not just an automation tool ---

it becomes the core financial intelligence engine of the organization.

## 2.0 PROBLEM STATEMENT

Bank reconciliation is one of the most critical, time-consuming, and
error-prone financial processes in every organization---especially in
companies with high transaction volumes, multiple bank accounts, foreign
currency exposure, 3PL payments, payroll runs, vendor settlements, and
customer receipts.

Today, most finance teams---including your current environment---face
significant operational bottlenecks because reconciliation is still:

-   Manual

-   Slow

-   Unstructured

-   Fragile

-   Difficult to audit

-   Dependent on individual staff knowledge

The issues begin from the very first step: getting a usable bank
statement.

### 2.1 PROBLEM 1 --- Inconsistent and Unstructured Bank Statement Formats

Bank statements come in inconsistent, difficult-to-parse formats:

### A. PDF formats differ

-   Mobile app download PDF

-   Web platform PDF

-   E-statement PDF

-   Branch-generated PDF

Each uses different:

-   Table layouts

-   Column structures

-   Fonts

-   Header/footer logic

-   Page borders

-   Multi-line descriptions

### B. PDF statements break transaction descriptions across multiple lines

You mentioned:

"Sometimes the description spans up to 5 rows."

This breaks automatic extraction, causing:

-   Wrong narration

-   Wrong grouping

-   Wrong classification

-   Missing references

-   Misinterpretation of customer/vendor names

-   Incorrect mapping to AR/AP

### C. Excel/CSV formats may still be inconsistent

Banks often:

-   Change column layouts without notice

-   Introduce new columns unexpectedly

-   Combine debit & credit into one column

-   Split debit & credit into different columns

-   Change date format (DD-MM-YYYY → MM/DD/YYYY)

All these lead to failed imports and wasted time.

### 2.2 PROBLEM 2 --- Manual Transaction Categorization Is Highly Error-Prone

Finance officers must manually analyze every bank statement line to
decide:

-   Is this AR?

-   Is this AP?

-   Is this payroll?

-   Is this employee reimbursement?

-   Is this a bank charge?

-   Is this VAT on bank charges?

-   Is this FX movement?

-   Is this interest income?

-   Is this POS settlement?

-   Is this an internal transfer?

-   Is this WHT remitted by customer?

This manual process leads to:

-   Misclassification errors

-   Incorrect GL postings

-   Wrong BP mapping

-   Unreconciled cash

-   Audit gaps

-   Rework and reversals

Mistakes compound during month-end.

### 2.3 PROBLEM 3 --- No Connection Between Bank Statements and Internal Modules (AR/AP/Expense/Payroll)

When bank statements are not integrated:

### Finance manually tries to link:

-   Customer payments → AR invoices

-   Vendor payments → AP invoices

-   Employee reimbursements → Expense retirement

-   Salary disbursements → Payroll module

-   Advance retirements → Expense/AP module

This creates:

-   Huge inefficiencies

-   Matching errors

-   Duplicated work

-   Lost audit traceability

Financial systems become fragmented.

### 2.4 PROBLEM 4 --- High Volume of Monthly Transactions

In companies like yours, there are:

-   Thousands of customer receipts

-   Hundreds of vendor payments

-   Dozens of employee reimbursements

-   Payroll disbursement

-   Import clearing agent payments

-   3PL and warehouse invoices

-   FX conversions

-   Bank charges

In high-volume environments:

-   Manual reconciliation is NOT scalable

-   Errors multiply quickly

-   Month-end delays worsen

### 2.5 PROBLEM 5 --- No AI or System Learning in Traditional Tools

Traditional ERPs:

-   Cannot learn from past reconciliations

-   Cannot detect pattern-based matches

-   Cannot remember mapping rules

-   Cannot classify recurring transactions automatically

This results in:

-   Repeated manual work every month

-   Reliance on one "experienced staff"

-   Slow onboarding when staff change

Your requirement:

"Can the system learn how similar transactions were treated?"

Yes --- but traditional systems do not support this.

### 2.6 PROBLEM 6 --- Lack of Automated Handling for Multi-Currency & FX

Companies operating in foreign currencies face:

-   FX gains

-   FX losses

-   Bank FX charges

-   Cross-currency transfers

-   Rate differences between ERP and bank

-   Settlement differences

Without a specialized module:

-   FX differences are misposted

-   Gains/losses are unaccounted for

-   AR/AP balances become wrong

-   Auditors find discrepancies

### 2.7 PROBLEM 7 --- Missing Bank Fees, Taxes, and Charges Classification

Finance must manually detect:

-   Bank SMS charges

-   Transfer fees

-   POS charges

-   Processing fees

-   Stamp Duty

-   VAT on bank charges

-   LC charges

-   FX conversion fees

These are often:

-   Posted late

-   Posted incorrectly

-   Not posted at all

-   Posted without dimensions

-   Posted to the wrong GL

Leading to financial statement inaccuracies.

### 2.8 PROBLEM 8 --- No Audit Trail or Inspector-Friendly Documentation

When reconciliation is done in Excel:

-   No audit log of changes

-   No approval workflow

-   No version history

-   No link between bank line → GL posting

-   No link between mapping decisions and invoices

-   No forensic trail for adjustments

Auditors must reconstruct everything manually.

This creates audit inefficiency and increases risk.

### 2.9 PROBLEM 9 --- No Support for Multi-Bank, Multi-Account, Multi-Entity

Finance may need to reconcile:

-   10+ bank accounts

-   Across 3--5 banks

-   Across 2--3 currencies

-   Across multiple subsidiaries

If reconciliation tools are not multi-bank aware:

-   Cash flow visibility becomes fragmented

-   Intercompany transfers cannot be reconciled

-   Month-end consolidation becomes complex

### 2.10 PROBLEM 10 --- Inability to Produce Clean, Structured, Exportable Reconciliation Files

You said:

"Let finance be able to download the cleaned bank statement to excel
with/without mapping."

Current tools do not:

-   Reconstruct transaction narratives

-   Merge multi-row statements

-   Provide clean mapping for audit

-   Provide mapping-based or raw exports

-   Include supporting documentation links

This makes audit preparation extremely painful.

### 2.11 SUMMARY OF PAIN POINTS

| Problem | Impact |
| --- | --- |
| Inconsistent bank formats | Import errors, wasted time |
| Multi-line descriptions | Wrong mapping & misclassification |
| Manual matching | Slow, inaccurate, dependent on staff |
| No connection to AR/AP/Expenses | Double work and reconciliation breaks |
| No AI learning | Repeated mappings monthly |
| Multi-currency complexity | FX differences not properly posted |
| Misclassified bank charges | Wrong financial statements |
| No audit trail | Audit risk and inefficiency |
| Multi-bank complexity | Hard to manage, high error risk |
| No clean export files | No standardized documentation |

### 2.12 THE NEED FOR A NEW SOLUTION

Finance teams need a system that:

-   Accepts ANY bank statement format

-   Reconstructs multi-line descriptions

-   Uses AI to auto-classify transactions

-   Links to AR/AP/Expense/Payroll modules

-   Handles multi-currency & FX differences

-   Auto-posts bank charges correctly

-   Provides clean exportable files

-   Supports workflow approval

-   Ensures perfect audit traceability

-   Learns and improves monthly

This is exactly what ZivaBI Bank Reconciliation Module is built to
deliver.

**SECTION 3 --- SCOPE & OUT-OF-SCOPE**

(Enterprise-grade, deeply detailed, reflecting all your requirements
exactly.)

## 3.0 SCOPE & MODULE BOUNDARIES

This section defines what the Bank Reconciliation Module WILL deliver
and what it WILL NOT deliver in the initial release. This ensures
clarity of boundaries, prevents scope creep, and aligns expectations
with your enterprise-level design goals.

### 3.1 IN-SCOPE FUNCTIONALITY

Below is the full list of features that WILL be included in the Bank
Reconciliation Module.

#### 3.1.1 BANK STATEMENT INGESTION & FORMATS

The system will support ingestion of:

### ✔ PDF Formats

-   Mobile app generated

-   Web portal generated

-   Email monthly statement

-   Complex PDF layouts

-   Scanned PDF (OCR mandatory)

-   Multi-column PDFs

-   PDFs with wrapped narration across multiple rows

### ✔ Excel / CSV

-   Structured Excel files (XLS/XLSX)

-   Multi-sheet Excel files

-   CSV files with any column order

### ✔ Digital Bank Feeds

-   JSON/XML via API

-   OFX

-   MT940 / SWIFT formats

### ✔ OCR Support

-   Full reconstruction of transaction rows

-   AI-driven interpretation of incomplete or ambiguous text

-   Automatic merging of multi-line descriptions

#### 3.1.2 BANK STATEMENT CLEANING & NORMALIZATION

The system will:

-   Detect column headers automatically

-   Normalize date formats

-   Convert debit/credit into unified schema

-   Merge multi-line descriptions intelligently

-   Remove duplicates

-   Validate opening and closing balances

-   Validate running balances

-   Extract embedded metadata (e.g., reference numbers, channel codes)

Finance will be able to download cleaned statement with and without
mapping.

#### 3.1.3 AUTO-MATCHING ENGINE (AR/AP/Expenses/Payroll)

### ✔ AR Matching

Match customer receipts to:

-   Invoice numbers

-   PO numbers

-   Customer names

-   Amount patterns

-   Partial payments

-   Overpayments

-   WHT deductions

### ✔ AP Matching

Match vendor payments to:

-   Vendor invoices

-   PO references

-   Advance retirements

-   Partial settlements

### ✔ Expense & Employee Reimbursement Matching

Match reimbursement payments to:

-   Retirement entries

-   Approved reimbursements

### ✔ Payroll Matching

Match salary disbursements with:

-   Payroll batch

-   Outlier detection for suspicious amounts

-   Statutory deductions

### ✔ Journal Matching

Match manually posted JEs related to:

-   WHT remittances

-   Loan repayments

-   Intercompany transfers

-   Accrual reversals

#### 3.1.4 AI-ASSISTED CLASSIFICATION

The system will include a full AI Classification Engine that:

-   Learns from prior reconciliations

-   Suggests GL account

-   Suggests BP (customer, vendor, employee)

-   Suggests dimensions

-   Suggests category (bank fee, POS settlement, loan repayment, etc.)

-   Suggests FX posting

-   Scores confidence (High / Medium / Low)

Finance can override manually.

#### 3.1.5 DIMENSION-AWARE MAPPING

System must apply:

-   Real IO

-   Cost Center IO

-   Material IO

-   Location

-   Statistical IO

-   Project IO (if tenant activates)

Dimensions must be:

-   Auto-suggested

-   Editable

-   Mandatory or optional per tenant configuration

#### 3.1.6 FINANCE REVIEW & APPROVAL WORKFLOW

The module will support:

### ✔ Draft Mapping Review

Finance can:

-   Accept mapping

-   Modify mapping

-   Reclassify

-   Split lines

-   Manually match

-   Assign BP

-   Assign dimensions

-   Assign GL

### ✔ Supervisor/Manager Approval

Manager can:

-   Approve batch

-   Reject individual lines

-   Request clarification

-   Approve reclassifications

-   Approve suspense postings

### ✔ Posting

System automatically posts reconciled transactions to:

-   GL

-   AR

-   AP

-   Expense module

-   Payroll module

-   Tax module (WHT/VAT on bank charges)

#### 3.1.7 AUTO-DETECTION OF BANK FEES & CHARGES

System detects:

-   SMS charges

-   Stamp duty

-   Transfer charges

-   POS settlement fees

-   Processing charges

-   FX conversion charges

-   LC/documentary credit charges

Maps them to:

-   Correct GL

-   Correct tax rules

-   Correct dimensions

Bank VAT is automatically separated.

#### 3.1.8 MULTI-CURRENCY SUPPORT

Handles:

-   FX settlement differences

-   FX gains/losses

-   Multi-currency accounts

-   Customer paying in foreign currency

-   Vendor receiving in foreign currency

-   Cross-currency bank transfers

-   CBN rates (for Nigeria)

-   ECB / Fed rates for global tenants

#### 3.1.9 AUTO-POSTING OF RECONCILED ENTRIES

System auto-posts:

-   AR receipts

-   AP payments

-   Expense reimbursements

-   Payroll disbursements

-   Bank charges

-   FX differences

-   Interest income

-   Loan repayments

-   Intercompany transfers

-   Miscellaneous receipts/payments

All with dimensions.

#### 3.1.10 RECONCILIATION DASHBOARD & EXCEPTION MANAGEMENT

Dashboard includes:

-   Statement balance

-   Book balance

-   Reconciliation variance

-   Matched items

-   Unmatched items

-   Suspense items

-   Auto-matched transactions

-   Manual-match pending items

-   High-risk items

-   AI low-confidence items

Exception Management Supports:

-   "Investigate later" bucket

-   Notes per line

-   Assign task to another staff

-   Escalation workflow

#### 3.1.11 EXPORT & DOWNLOAD CAPABILITIES

Finance can download:

### ✔ Cleaned Statement (raw)

### ✔ Cleaned + Auto-Mapped

### ✔ Cleaned + Finance Corrected

### ✔ Cleaned + Approved Mapping

### ✔ Full Reconciliation Pack:

-   Statement

-   Mappings

-   Exceptions

-   Final postings

-   Audit logs

All in Excel, CSV, or PDF formats.

#### 3.1.12 AUDIT TRAIL & FORENSICS

Audit trail includes:

-   Upload event

-   Parsing transformations

-   AI suggestions

-   Finance corrections

-   Manager approvals

-   Posting logs

Auditors can:

-   Download reconciled statement

-   Review GL mappings

-   Inspect individual transactions

-   See source PDF next to parsed result

#### 3.1.13 MULTI-BANK, MULTI-ACCOUNT SUPPORT

Tenants can configure:

-   Unlimited number of banks

-   Unlimited number of accounts

-   Account-level rules

-   Bank-specific parsing logic

-   Bank-specific charges templates

#### 3.1.14 FULL INTEGRATION WITH OTHER MODULES

Integrates with:

-   AR

-   AP

-   Expense

-   Payroll

-   Inventory (for FX on imports)

-   Vendor Onboarding (for BP mapping)

-   ERP connectors

#### 3.1.15 ROLE-BASED PORTALS

Roles include:

-   Finance Reconciliation Officer

-   Finance Manager

-   CFO/FD

-   Treasury

-   Internal Audit

-   External Auditor (read-only)

-   Super Admin (infrastructure access only, no data access)

### 3.2 OUT-OF-SCOPE (FOR INITIAL RELEASE)

These items may come in future releases but are NOT included initially.

#### 3.2.1 Real-time Open Banking API Feeds

(Not guaranteed; depends on bank support and regulatory environment.)

#### 3.2.2 Automated Bank Instruction (Outbound Payments)

Outbound payments will be covered under the AP Payment Module, not
within Reconciliation.

#### 3.2.3 Predictive Cashflow Forecasting (Advanced AI)

Basic dashboards included; advanced forecasting is a future module.

#### 3.2.4 Automated Bank-to-Bank Transfers

Not within reconciliation scope; part of Treasury module.

#### 3.2.5 Direct Integration to Tax Authorities

WHT & VAT calculations included, but tax authority integration is part
of the Tax Module.

#### 3.2.6 Enterprise Data Lake Integration

Supported by core infrastructure, but not specific to this module's
initial release.

#### 3.2.7 Cash Pooling & Sweeping Automation

Will be handled in Treasury module.

#### 3.2.8 Investment & Liquidity Management

Also part of Treasury module.

### 3.3 WHAT THIS MODULE DOES NOT DO

-   Does NOT generate payroll

-   Does NOT create vendor invoices

-   Does NOT decide approval of expenses

-   Does NOT manage inventory (only uses data)

-   Does NOT override tenant tax rules

-   Does NOT bypass workflow approvals

-   Does NOT allow super admin to view tenant financial data (security
    sandbox)

**SECTION 4 --- ACTORS & ROLES**

(Enterprise-grade, deeply detailed, matching the sophistication level of
earlier PRDs.)

## 4.0 PERSONAS & ROLES

The Bank Reconciliation Module involves multiple internal and external
roles across Finance, Treasury, Audit, and IT.

Each role has unique permissions, responsibilities, and data visibility
rules determined at the tenant level.

The roles below are modular and tenant-configurable:

-   A tenant may deactivate certain roles

-   A role may be combined for smaller companies

-   Role permissions are governed by ZivaBI's RBAC (Role-Based Access
    Control) framework

This ensures maximum flexibility for different organizational structures
and industries.

### 4.1 FINANCE RECONCILIATION OFFICER (Primary Actor)

### Key Responsibilities

-   Upload bank statements (all formats)

-   Review auto-parsed transactions

-   Validate AI-suggested mappings

-   Manually match unmatched transactions

-   Assign GL, BP, and dimensions

-   Split lines where needed

-   Flag suspicious transactions

-   Prepare batch for supervisor approval

-   Prepare monthly reconciliation packs

### Permissions

-   Upload statements

-   Edit mappings

-   Override AI suggestions

-   Reclassify transactions

-   Assign AR/AP/Expense/Payroll references

-   Add internal comments

-   Download cleaned statements

-   Generate draft reconciliation reports

### Data Visibility

-   Full view of all tenant bank accounts

-   AR/AP/Employee/Payroll transaction references

-   No access to salary details (masked unless tenant allows)

-   No access to vendor banking details (restricted by Vendor Module
    policies)

### 4.2 FINANCE RECONCILIATION SUPERVISOR / FINANCE MANAGER

### Key Responsibilities

-   Review Finance Officer mappings

-   Approve final reconciliations

-   Approve reclassifications

-   Approve suspense account postings

-   Validate FX gains/loss postings

-   Approve bank charges posting

-   Approve unreconciled items

-   Manage reconciliation closing for each period

### Permissions

-   Everything Finance Officer can do, plus:

-   Approve or reject reconciliation batches

-   Lock bank statement period

-   Approve suspense postings

-   Approve tax implications

-   Override GL mapped by Finance Officer

-   Approve FX difference postings

-   Unlock transactions if rework is needed

### Data Visibility

-   Full financial visibility

-   Full BP visibility

-   Full dimension visibility

-   View all audit logs

### 4.3 TREASURY / CASH MANAGEMENT TEAM

### Key Responsibilities

-   View real-time bank balances

-   Verify cash inflow/outflow patterns

-   Monitor unallocated deposits

-   Track inter-company transfers

-   Validate daily liquidity positions

-   Identify cash shortages or unexplained inflows

-   Provide cash flow forecasts (if activated in tenant settings)

### Permissions

-   View reconciliations

-   View bank statements

-   Download cleaned statements

-   Comment on transactions

-   NO editing rights unless granted by tenant

### Data Visibility

-   High-level transaction visibility

-   Limited salary visibility (amount and date only)

-   No dimension-level view

-   No ability to post entries

### 4.4 ACCOUNTS RECEIVABLE (AR) OFFICER

### Key Responsibilities

-   Review customer receipts mapped by reconciliation

-   Confirm allocation to invoices

-   Manage partial/overpayments

-   Upload WHT certificates received from customers

-   Resolve customer receipt discrepancies

-   Investigate unidentified inflows

### Permissions

-   Read-only access to bank lines mapped to AR

-   Reallocate receipts (if allowed by tenant)

-   Add AR comments

-   Tag receipts to invoices

### Data Visibility

-   Only AR-related bank lines

-   No full-bank visibility unless tenant activates

-   Access to customer statement impact

### 4.5 ACCOUNTS PAYABLE (AP) OFFICER

### Key Responsibilities

-   Review vendor payments mapped by reconciliation

-   Confirm settlement of invoices

-   Resolve mismatches

-   Validate FX settlement and bank charges

-   Confirm WHT deducted and mapped

### Permissions

-   Read-only access to AP-related transactions

-   Confirm or correct invoice allocation

-   Tag payments to vendors

### Data Visibility

-   AP transactions only

-   Vendor-level visibility (masked bank details)

### 4.6 EXPENSE MANAGEMENT / PAYROLL OFFICER

### Key Responsibilities

-   Validate mapping of:

    -   Employee reimbursements

    -   Payroll salary runs

    -   Statutory salary deductions (PAYE, pension)

-   Verify partial or unusual payments

-   Collaborate with reconciliation officers to identify anomalies

### Permissions

-   Read-only view for Expense & Payroll-related bank lines

-   Validate employee settlement references

### Data Visibility

-   Limited payroll detail (depending on tenant rules)

-   Full expense retirement mapping

### 4.7 INTERNAL AUDIT

### Key Responsibilities

-   Review reconciliation audit logs

-   Review mapping decisions

-   Identify suspicious transactions

-   Perform sample testing

-   Validate completeness of reconciliation process

-   Assess segregation of duties

### Permissions

-   Read-only access to:

    -   Reconciliation history

    -   Audit logs

    -   Posting logs

    -   Cleaned statements

    -   Final reconciled statements

-   No editing rights

-   Ability to raise audit queries in-system (Audit Query Engine)

### Data Visibility

-   All data except masked payroll details

### 4.8 EXTERNAL AUDITOR (Optional Portal Access)

### Key Responsibilities

-   Review financial evidence for audit

-   Verify reconciliation accuracy

-   Download reconciliation packs

-   Review system-generated logs

### Permissions

-   Strict read-only access

-   Can only view periods unlocked for audit

-   Cannot see payroll amounts unless tenant explicitly permits

### Data Visibility

-   Limited to audit-bound periods

-   Masked sensitive data

### 4.9 CFO / FINANCE DIRECTOR

### Key Responsibilities

-   Oversee period close

-   Approve suspense clearing

-   Approve policy-based overrides

-   Approve manual FX adjustments

-   Monitor cash position and trends

-   Approve boundaries like:

    -   Acceptable unreconciled variance threshold

    -   Escalation boundaries

    -   Tolerance levels for bank fees

### Permissions

-   Full visibility

-   Right to unlock closed periods

-   Right to approve policy-level changes

-   No ability to perform routine mapping (unless tenant permits)

### Data Visibility

-   Complete and unrestricted (except masked employee info if
    configured)

### 4.10 TENANT ADMIN

### Key Responsibilities

-   Configure bank accounts

-   Configure mapping rules

-   Set OCR rules for each bank

-   Activate/deactivate dimensions

-   Configure approval workflows

-   Configure user access and permissions

-   Determine visibility of sensitive payroll data

-   Set limit thresholds for reconciliation variances

### Permissions

-   Configuration and admin rights

-   No financial data visibility unless explicitly granted

### 4.11 SUPER ADMIN (ZivaBI Platform Owner)

### Key Responsibilities

-   System maintenance

-   Infrastructure monitoring

-   Tenant-level sandboxing enforcement

-   Feature activation/deactivation

### Permissions

-   No access to tenant financial data

-   No access to bank statements

-   No visibility into any bank mapping

-   Only metadata (service status, performance, integration health)

### Data Visibility

-   Zero tenant data visibility (extremely strict isolation)

### 4.12 3PL / WAREHOUSE (If Tenant Enables)

### Key Responsibilities

-   Validate POD

-   Provide delivery confirmations

-   Approve delivery-related payments as matched by bank lines

-   Upload delivery proof if needed

### Permissions

-   Extremely limited

-   Only access to transactions they are associated with

### 4.13 ROLE INTERACTIONS MATRIX

| Role | Reconcile | Approve | Configure | View | Audit | Post |
| --- | --- | --- | --- | --- | --- | --- |
| Finance Officer | ✔ | ✖ | ✖ | ✔ | ✖ | ✖ |
| Finance Manager | ✔ | ✔ | ✖ | ✔ | ✖ | ✔ |
| Treasury | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ |
| AR/AP Officers | Partial | ✖ | ✖ | ✔ | ✖ | ✖ |
| Internal Audit | ✖ | ✖ | ✖ | ✔ | ✔ | ✖ |
| External Audit | ✖ | ✖ | ✖ | ✔ | ✔ | ✖ |
| CFO | ✔ | ✔ | ✖ | ✔ | ✔ | ✔ |
| Tenant Admin | ✖ | ✖ | ✔ | Optional | ✖ | ✖ |
| Super Admin | ✖ | ✖ | ✔ | ✖ | ✖ | ✖ |

**SECTION 5 --- HIGH-LEVEL WORKFLOWS**

(Deep, enterprise-grade, fully aligned with your expectations and
earlier modules.)

## 5.0 WORKFLOW REQUIREMENTS

This section outlines the complete workflow for the Bank Reconciliation
Module.

It explains how transactions flow from:

-   Bank Upload → Parsing → Mapping → Review → Approval → Posting →
    Reconciliation

-   While interacting with AR, AP, Expense, Payroll, Inventory, FX, and
    GL modules.

Workflows are written to support all tenants:

-   Small organizations (low-volume, simple bank formats)

-   Medium organizations (multiple banks, moderate volume)

-   Large enterprises (multi-currency, 3PL, FX, high-volume,
    multi-account)

Each workflow is tenant-configurable and approval-flow driven.

### 5.1 WORKFLOW 1 --- BANK STATEMENT INGESTION & PRE-PROCESSING

### Step 1 --- Finance Officer Uploads Bank Statement

Supported formats:

-   PDF (mobile/web)

-   Excel/CSV

-   MT940/OFX

-   JSON/XML (API)

-   Scanned PDF (OCR needed)

System validates:

-   File type

-   Password protection (prompts for password if encrypted PDF)

-   Duplicate upload detection

-   Date range of statement

-   Bank account match

### Step 2 --- OCR & Parsing Engine Processes File

System performs:

#### A. Page Structure Detection

-   Table boundaries

-   Headers/footers

-   Page breaks

-   Multi-column detection

#### B. Multi-line Description Reconstruction

-   Identifies continuation rows

-   Merges lines into a single narration

-   Removes noise (headers, footers, blank lines)

-   Normalizes spacing & punctuation

#### C. Column Extraction

Identifies:

-   Date

-   Description

-   Debit amount

-   Credit amount

-   Currency

-   Balance (if present)

#### D. Cleansing

-   Corrects date formats

-   Converts comma/period separators

-   Checks running balances

-   Detects missing rows

-   Removes duplicates

### Step 3 --- Raw → Cleaned Statement Transformation

System produces a cleaned, structured statement.

Finance can download:

-   Cleaned (no mapping)

-   Cleaned + auto-mapping

-   Cleaned + approved mapping (later stage)

### 5.2 WORKFLOW 2 --- AUTO-MAPPING & AI SUGGESTION ENGINE

After parsing, the AI/Rules engine performs multi-layer mapping:

### Step 1 --- AR Matching

Matches inflows to:

-   Customer invoices

-   Customer codes

-   Customer names in narration

-   PO numbers

-   Payment reference patterns

-   Amount thresholds

-   WHT deductions (auto-detected)

Supports:

-   Partial payments

-   Overpayments

-   Bulk payments for multiple invoices

-   Auto-generation of AR settlement lines

### Step 2 --- AP Matching

Matches outflows to:

-   Vendor invoices

-   Advance retirements

-   Payment runs

-   Vendor codes

-   FX payables

Supports:

-   Partial settlements

-   Multi-payment vendor batches

-   Vendor-specific bank references

### Step 3 --- Employee Reimbursement Matching

Matches transactions for:

-   Approved expense retirement

-   Approved travel advance retirement

-   Payroll reimbursements

### Step 4 --- Payroll Matching

Identifies:

-   Salary payments

-   PAYE remittances

-   Pension deductions

-   Union dues

-   Allowance adjustments

Narration patterns recognized automatically.

### Step 5 --- Bank Fees Identification

AI detects:

-   Stamp duty

-   SMS charges

-   Processing fees

-   POS settlement charges

-   FX conversion charges

-   LC/import charges

-   FX spread

Correctly maps:

-   Fee GL account

-   VAT on bank charges

### Step 6 --- FX & Multi-Currency Handling

AI identifies:

-   FX debits

-   FX credits

-   Automatic conversion postings

-   FX differences due to settlement

-   Interbank FX conversion

### Step 7 --- Suspense Routing for Unknown Transactions

System flags:

-   Unusual amounts

-   Unknown payers

-   Unknown payees

-   Fraud-risk transactions

-   Suspicious patterns

These are placed into an Exception Queue.

### 5.3 WORKFLOW 3 --- FINANCE REVIEW & CORRECTION

### Step 1 --- Finance Officer Reviews Mapping Dashboard

Dashboard shows:

-   AI confidence score

-   Suggested GL/BP

-   Suggested dimensional mapping

-   Possible invoice matches

-   Suspense candidates

-   FX scenarios

### Step 2 --- Manual Correction Tools

Finance Officer can:

-   Edit GL

-   Edit BP

-   Edit invoice match

-   Edit dimensions

-   Split line across multiple GLs

-   Combine two statement lines

-   Mark line as "Investigate Later"

-   Add internal notes

-   Reverse AI suggestions

All actions are logged.

### Step 3 --- Line-level Approval Preparation

Once satisfied:

-   Officer sends batch for Manager approval

System locks mapping (until rejected or approved).

### 5.4 WORKFLOW 4 --- FINANCE MANAGER APPROVAL

### Step 1 --- Manager receives batch notification

### Step 2 --- Manager reviews:

-   High-value items

-   Suspense account postings

-   FX difference postings

-   WHT impact

-   VAT on bank charges

-   Outlier transactions

-   Non-standard mapping

-   Multi-line splits

Manager can:

-   Approve

-   Reject entire batch

-   Reject specific lines

-   Request clarification

-   Reassign mapping

-   Lock transaction for audit

### 5.5 WORKFLOW 5 --- POSTING TO GL AND SUB-LEDGERS

### Step 1 --- Approved items go to posting engine

System generates:

#### A. AR Settlement Entries

Dr Bank

Cr Accounts Receivable

#### B. AP Settlement Entries

Dr Vendor Liability

Cr Bank

#### C. Expense Reimbursement

Dr Employee Settlement

Cr Bank

#### D. Payroll Payments

Dr Payroll liability

Cr Bank

#### E. FX Differences

Dr/Cr FX Gain/Loss

#### F. Bank Charges

Dr Bank Charges

Dr VAT on Charges

Cr Bank

#### G. Suspense Clearing

Dr/Credit GL: Suspense Account

### Step 2 --- Dimension Enforcement

System assigns:

-   Real IO

-   Cost Center IO

-   Material IO

-   Project

-   Location

-   Statistical IO

According to tenant rules.

### Step 3 --- Posting Success/Failure Handling

System returns:

-   Successful postings

-   Failed postings

-   Partial postings

Finance is notified instantly.

### 5.6 WORKFLOW 6 --- BANK RECONCILIATION & VARIANCE RESOLUTION

### Step 1 --- System updates reconciliation state

Shows:

-   Statement balance

-   Book balance

-   Variance

-   Matched line count

-   Unmatched items

### Step 2 --- Unmatched Items Investigation

Finance investigates:

-   Unexpected inflows

-   Bank errors

-   Duplicate payments

-   Reversed transactions

-   Unrecorded AR receipts

-   Unrecorded AP payments

### Step 3 --- Residual Variance Threshold

Tenant can configure:

-   Acceptable month-end unreconciled threshold

-   Auto-carry forward rules

### Step 4 --- Period Close

Manager closes period to lock reconciliation.

### 5.7 WORKFLOW 7 --- EXPORT, AUDIT & DOCUMENTATION

### Export Options

-   Cleaned raw bank statement

-   Cleaned + auto-mapping

-   Cleaned + reviewed

-   Cleaned + approved mapping

-   Full reconciliation pack (multi-sheet Excel)

-   Audit-ready PDF

### Audit Trail Includes:

-   Upload logs

-   Parsing logs

-   Mapping logs

-   AI decisions

-   Finance corrections

-   Manager approvals

-   Posting references

-   GL entries

-   Exception logs

### Auditor Portal

Auditors get read-only access to:

-   Reconciled statements

-   Mapping evidence

-   GL postings

-   Suspense clearing proofs

**SECTION 6 --- DATA MODEL**

(Extremely detailed, enterprise-grade, multi-layered data model
capturing all entities, relationships, fields, behaviors, and audit
constraints.)

This is written at the same depth as SAP FI/Bank Analyzer, Oracle Cash
Management, Sage X3, and Blackline--level specification.

## 6.0 DATA MODEL

The Bank Reconciliation Data Model defines all data entities, their
attributes, constraints, and how they relate to the rest of the ZivaBI
platform.

This module must support:

-   Multi-bank

-   Multi-account

-   Multi-currency

-   Multi-tenant

-   Multi-format ingestion

-   AI-based classification

-   GL posting

-   AR/AP/Expense/Payroll integrations

-   FX impacts

-   Tax impacts

-   Audit traceability

-   Exportability

The data model is intentionally modular, scalable, dimension-aware, and
ERP-agnostic.

### 6.1 ENTITY LIST (Master + Transactional + AI + Audit)

The Bank Reconciliation Module uses the following 21 primary entities:

**MASTER ENTITIES**

1.  BankAccount

2.  BankInstitution

3.  BankParsingProfile

4.  GLAccount

5.  BusinessPartner (BP)

6.  DimensionSet (Tenant Dimensions)

7.  TenantConfig (Bank Recon Settings)

**TRANSACTION ENTITIES**

8.  BankStatement

9.  BankStatementPage

10. BankStatementRawLine

11. BankStatementCleanedLine

12. SystemTransaction (AR/AP/Expense/Payroll)

13. ProposedMapping

14. FinalMapping

15. PostingEntry

16. SuspenseEntry

17. UnmatchedItem

18. FXImpactRecord

19. BankChargeRecord

**AI / LEARNING ENTITIES**

20. AIMappingDecision

21. AIFeedbackTrainingSet

**AUDIT ENTITIES**

22. AuditLog

23. ReconciliationBatch

24. ExportHistory

25. ExceptionQueueItem

### 6.2 ENTITY DETAILS & FIELD DEFINITIONS

Below is a full blueprint of each entity with all critical fields.

#### 6.2.1 BankAccount

Represents each bank account owned by the tenant.

| Field | Type | Description |
| --- | --- | --- |
| BankAccountID | UUID | Unique account identifier |
| TenantID | UUID | Tenant owning the account |
| BankInstitutionID | UUID | Link to bank master |
| AccountNumber | String | Full bank account number |
| AccountName | String | Name per bank |
| Currency | ISO Code | NGN, USD, EUR, etc. |
| GLAccountID | UUID | Linked GL cash/bank account |
| Status | Enum | Active / Inactive |
| OpeningBalance | Decimal | Used during first onboarding |
| CreatedAt | Timestamp |  |
| UpdatedAt | Timestamp |  |

#### 6.2.2 BankInstitution

Represents banks across different tenants.

| Field | Type | Description |
| --- | --- | --- |
| BankInstitutionID | UUID | Global ID |
| Name | String | e.g., Zenith, GTBank, Standard Chartered |
| Country | Enum | NG, UK, US, etc. |
| SupportedFormats | Array | PDF, Excel, CSV, MT940, OFX |
| APIEndpoint | String | For future open banking |
| OCRProfileID | UUID | Parsing rules |
| LogoURL | String | UI branding |

#### 6.2.3 BankParsingProfile

Critical entity that defines how to correctly parse any PDF/

| Field | Type | Description |
| --- | --- | --- |
| ParsingProfileID | UUID | Unique profile |
| BankInstitutionID | UUID | Bank-specific |
| TenantID | UUID | For tenant overrides |
| DateColumnRule | JSON | Column name, regex, position |
| DebitColumnRule | JSON |  |
| CreditColumnRule | JSON |  |
| BalanceColumnRule | JSON |  |
| DescriptionMergeRule | JSON | For multi-line descriptions |
| OCRConfig | JSON | OCR thresholds, cleanup rules |
| TestSamples | Array | Stored examples for validation |

Excel/CSV format.

#### 6.2.4 BankStatement

Represents the full bank statement file upload.

| Field | Type | Description |
| --- | --- | --- |
| StatementID | UUID | Unique identifier |
| TenantID | UUID |  |
| BankAccountID | UUID | Account this statement belongs to |
| FileName | String | Original uploaded file |
| FileType | Enum | PDF, Excel, CSV, API |
| PeriodStart | Date | Start date |
| PeriodEnd | Date | End date |
| UploadUserID | UUID | The finance staff |
| ParsingStatus | Enum | Pending / Success / Error |
| ReconciliationStatus | Enum | Draft / Reviewed / Approved / Posted |
| CreatedAt | Timestamp |  |

#### 6.2.5 BankStatementRawLine

Each unprocessed row extracted by OCR/Parser.

| Field | Type |
| --- | --- |
| RawLineID | UUID |
| StatementID | UUID |
| PageNumber | Integer |
| RawText | Text |
| OCRConfidence | Decimal |

#### 6.2.6 BankStatementCleanedLine

Each cleaned, normalized, structured transaction.

| Field | Type |
| --- | --- |
| CleanedLineID | UUID |
| StatementID | UUID |
| SequenceNumber | Integer |
| TransactionDate | Date |
| Description | Text |
| DebitAmount | Decimal |
| CreditAmount | Decimal |
| Currency | ISO |
| Balance | Decimal (optional) |
| NormalizedReference | String |
| ExtractedKeywords | Array |
| MD5Hash | String (duplicate detection) |
| IsPossibleDuplicate | Boolean |

#### 6.2.7 SystemTransaction

Represents any internal transaction ZivaBI knows about.

| Type | Examples |
| --- | --- |
| AR | Customer invoices, receipts |
| AP | Vendor invoices, payments |
| Expense | Employee reimbursement payments |
| Payroll | Salary disbursements |
| Journal | WHT, FX, adjustments |

#### 6.2.8 ProposedMapping

AI or rule-engine generated mapping per bank line.

| Field | Type |
| --- | --- |
| ProposedMappingID | UUID |
| CleanedLineID | UUID |
| SuggestedModule | Enum |
| SuggestedGL | UUID |
| SuggestedBP | UUID |
| SuggestedSystemTransactionID | UUID |
| SuggestedDimensions | JSON |
| ConfidenceScore | Decimal (0--1) |
| ReasonCodes | Array |

#### 6.2.9 FinalMapping

Finance-reviewed approved mapping.

| Field | Type |
| --- | --- |
| FinalMappingID | UUID |
| CleanedLineID | UUID |
| FinalGLID | UUID |
| FinalBPID | UUID |
| FinalSystemTransactionID | UUID |
| FinalDimensions | JSON |
| ApprovedBy | UUID |
| ApprovalTimestamp | Timestamp |

#### 6.2.10 PostingEntry

The actual journal entry created after approval.

| Field | Type |
| --- | --- |
| PostingEntryID | UUID |
| CleanedLineID | UUID |
| GLDebit | Decimal |
| GLCredit | Decimal |
| GLAccountDebit | UUID |
| GLAccountCredit | UUID |
| Dimensions | JSON |
| PostingDate | Date |
| PostedBy | UUID |
| Status | Enum |

#### 6.2.11 SuspenseEntry

For unresolved or suspicious transactions.

| Field | Type |
| --- | --- |
| SuspenseEntryID | UUID |
| CleanedLineID | UUID |
| Amount | Decimal |
| SuspenseGL | UUID |
| Reason | Text |
| CreatedBy | UUID |

#### 6.2.12 UnmatchedItem

Anything that cannot be resolved.

| Field | Type |
| --- | --- |
| UnmatchedItemID | UUID |
| CleanedLineID | UUID |
| Reason | Text |
| CreatedAt | Timestamp |

#### 6.2.13 FXImpactRecord

Handles multi-currency banking events

| Field | Type |
| --- | --- |
| FXRecordID | UUID |
| CleanedLineID | UUID |
| SourceCurrency | ISO |
| TargetCurrency | ISO |
| RateUsed | Decimal |
| FXGainLossGL | UUID |

#### 6.2.14 BankChargeRecord

Any identified bank fee.

| Field | Type |
| --- | --- |
| BankChargeID | UUID |
| CleanedLineID | UUID |
| ChargeType | Enum |
| ChargeGL | UUID |
| VATGL | UUID |
| Amount | Decimal |
| VATAmount | Decimal |

#### 6.2.15 AIMappingDecision

Stores AI reasoning for each mapping.

| Field | Type |
| --- | --- |
| AIDecisionID | UUID |
| CleanedLineID | UUID |
| SuggestedGL | UUID |
| Keywords | Array |
| SimilarPastTransactions | Array |
| ModelVersion | String |

#### 6.2.16 AIFeedbackTrainingSet

Captures human corrections for learning.

| Field | Type |
| --- | --- |
| TrainingID | UUID |
| CleanedLineID | UUID |
| CorrectGL | UUID |
| CorrectBP | UUID |
| SubmittedBy | UUID |
| Timestamp | Timestamp |

#### 6.2.17 AuditLog

Captures every action.

| Field | Type |
| --- | --- |
| AuditID | UUID |
| Entity | String |
| EntityID | UUID |
| Action | String |
| OldValue | JSON |
| NewValue | JSON |
| PerformedBy | UUID |
| Timestamp | Timestamp |

#### 6.2.18 ReconciliationBatch

Represents a full batch reconciliation period.

| Field | Type |
| --- | --- |
| BatchID | UUID |
| StatementID | UUID |
| PeriodMonth | Integer |
| PeriodYear | Integer |
| Status | Enum |
| CreatedBy | UUID |
| ApprovedBy | UUID |

#### 6.2.19 ExportHistory

Tracks downloads for audit integrity.

| Field | Type |
| --- | --- |
| ExportID | UUID |
| StatementID | UUID |
| ExportType | Enum (Raw, Cleaned, Mapped, Approved) |
| ExportedBy | UUID |
| Timestamp | Timestamp |

#### 6.2.20 ExceptionQueueItem

Used for fraud review & unresolved items.

| Field | Type |
| --- | --- |
| ExceptionID | UUID |
| CleanedLineID | UUID |
| Severity | Enum |
| Notes | Text |
| AssignedTo | UUID |

### 6.3 RELATIONAL I DIAGRAM (Textual Form)

BankInstitution → 1:N → BankAccount

BankAccount → 1:N → BankStatement

BankStatement → 1:N → BankStatementPage

BankStatementPage → 1:N → BankStatementRawLine

BankStatement → 1:N → BankStatementCleanedLine

BankStatementCleanedLine → 1:1 → ProposedMapping

BankStatementCleanedLine → 1:1 → FinalMapping

FinalMapping → 1:N → PostingEntry

FinalMapping → 1:N → FXImpactRecord

FinalMapping → 1:N → BankChargeRecord

BankStatementCleanedLine → 0:1 → SuspenseEntry

BankStatementCleanedLine → 0:1 → UnmatchedItem

BankStatementCleanedLine → 1:N → AIMappingDecision

AIMappingDecision → 1:N → AIFeedbackTrainingSet

BankStatement → 1:N → ReconciliationBatch

ReconciliationBatch → 1:N → ExportHistory

**SECTION 7 --- BUSINESS RULES**

(Full enterprise-grade detail. Clean, structured, aligned with SAP FI,
Oracle Cash Management, Blackline, and the earlier PRDs you approved.)

## 7.0 BUSINESS RULES

This section defines all mandatory Business Rules governing:

-   Data ingestion

-   Parsing

-   Cleaning

-   Mapping (AI, rule-based, and manual)

-   Approvals

-   Posting

-   FX handling

-   Tax treatment

-   Bank charges logic

-   Dimension requirements

-   Suspense handling

-   Duplicate prevention

-   Audit rules

-   Error handling

-   Export rules

These rules ensure consistency, accuracy, auditability, and
configurability across all tenants.

### 7.1 BANK STATEMENT INGESTION RULES

### BR-1: Supported Formats

System MUST accept:

-   PDF

-   Scanned PDF

-   Excel (XLS/XLSX)

-   CSV

-   OFX

-   MT940

-   JSON/XML (via bank API)

### BR-2: File Validation Must Occur Before Processing

Validation includes:

-   Tenant ownership of bank account

-   Period overlap check

-   Duplicate statement prevention

-   Format integrity check

-   OCR readiness check

-   File password detection (ask for password if encrypted)

### BR-3: Duplicate Upload Detection

System must compare:

-   File MD5 hash

-   Statement period

-   First & last transaction hash

-   Bank account number

If duplicate → block upload unless tenant admin overrides.

### BR-4: Multi-Page Handling

System must correctly join:

-   Page 1 → Page 2 → Page N

-   Ignore headers/footers per page

-   Ensure row sequence integrity

### BR-5: Ability to Upload Multiple Statements for Same Month

Allowed when:

-   Statements cover different days

-   Statements cover different accounts

-   Statements are supplementary

-   Statements are intraday

-   Statements represent additional settlement pages (POS, gateway)

### 7.2 OCR & PARSING RULES

### BR-6: Multi-Line Description Detection

System MUST automatically detect and merge:

-   Continuation rows

-   Wrapped text

-   Broken text

-   Descriptions spanning 2--5 lines

-   Rows that lack date but continue previous narration

### BR-7: Date Reconstruction

Rules:

-   If a row contains amount but no date → inherit date from last valid
    row

-   Apply tenant-specific date format (DD-MM-YYYY, MM/DD/YYYY,
    YYYY/MM/DD)

-   Reject impossible dates (e.g., 30th Feb)

### BR-8: Debit/Credit Identification

System must detect:

-   Debit column

-   Credit column

-   Combined "Amount" column with +/- sign

-   Debit/Credit swapped formats depending on bank

If ambiguous → move line to "Needs Review".

### BR-9: Currency Recognition

Extract:

-   Currency symbols (₦, \$, €, £)

-   Embedded ISO codes (NGN, USD)

-   Infer currency from bank account default

### BR-10: Balance Validation

If running balance exists:

-   System must recalculate running balance

-   Flag discrepancies

-   Flag missing rows

-   Detect corrupted sections

### 7.3 CLEANING & NORMALIZATION RULES

### BR-11: Remove Bank Noise

Ignore:

-   Page headers

-   Page footers

-   Bank disclaimers

-   Watermark lines

-   Summary rows

### BR-12: Trim & Normalize Descriptions

System must:

-   Remove excessive whitespace

-   Normalize casing

-   Remove non-printable characters

-   Extract keywords (e.g., "POS", "NIP", "REF", "TRF")

### BR-13: Unique Transaction Fingerprint

System must compute MD5 or SHA-1 hash from:

-   Date

-   Amount

-   Final merged description

-   Sequence number

Used to detect duplicates across:

-   Multi-format uploads

-   Daily statements

-   Merchant settlement files

### 7.4 AUTO-MATCHING RULES

### BR-14: AR Auto-Matching

Match criteria:

-   Exact invoice number in description

-   Customer name match (90% similarity threshold)

-   Amount match (exact or near exact)

-   Pattern detection (REF:xxxxx)

-   WHT deduction patterns

-   Partial payment logic

### BR-15: AP Auto-Matching

Match criteria:

-   Vendor name match

-   Invoice reference

-   Payment batch ID

-   PO number

-   FX settlement references

-   Year/month reference (common in vendor invoices)

### BR-16: Expense & Employee Reimbursement Matching

Match criteria:

-   Employee name

-   Employee ID

-   Expense reference

-   Advance retirement reference

-   Exact amount matching

### BR-17: Payroll Auto-Matching

System must detect:

-   Salary batch

-   Individual salary transfers (if configured)

-   PAYE

-   Pension

-   NHF

-   NSITF

### BR-18: Bank Charges Auto-Matching

Detect via keywords:

-   "CHG", "BANK CHARGE", "SMS", "STAMP DUTY", "VAT", "POS CHG"

-   Fee mapping table per tenant

-   VAT auto-calculation (7.5% default for Nigeria; tenant-configurable)

### BR-19: FX Recognition

System must detect:

-   "FX", "FOREX", "FX SALE", "FX BUY"

-   Multi-currency difference

-   Bank rate vs tenant rate

-   FX GL mapping

### 7.5 SPLIT, MERGE & RECLASSIFICATION RULES

### BR-20: Split Line Rule

Finance must be allowed to split:

-   One bank line → Multiple GL postings

-   One bank line → AR + Bank Charges (common in POS settlements)

-   One bank line → Multiple expense lines

-   One bank line → AP + WHT deduction

### BR-21: Merge Lines Rule

When narration spans multiple lines that are incorrectly separated,
system merges automatically.

### BR-22: Reclassification Rule

Finance must be able to manually override:

-   GL

-   BP

-   Invoice link

-   Dimensions

Reclassification is logged for AI learning.

### 7.6 DIMENSION ASSIGNMENT RULES

Dimensions apply after mapping:

### BR-23: Mandatory Dimensions (Tenant-Configurable)

Examples:

-   Real IO on Revenue lines

-   Material IO on COGS

-   Cost Center IO on salary payments

-   Location Dimension on warehouse payments

### BR-24: AI Dimension Guessing

AI suggests dimensions based on:

-   BP history

-   GL history

-   Transaction description

### BR-25: Manual Override Allowed

Finance can override dimension suggestions.

### 7.7 APPROVAL WORKFLOW RULES

### BR-26: 4 Possible Workflow Levels

Tenant can configure:

1.  Finance Officer → Manager

2.  Officer → Manager → CFO

3.  Officer → Manager → Treasury → CFO

4.  Direct Post (very small companies)

### BR-27: Tier-Based Approval

If transaction > threshold → escalate to higher-level approver.

### BR-28: Suspense Account Must Be Approved by Manager or CFO

No suspense entry can post without approval.

### 7.8 GL POSTING RULES

### BR-29: Posting Must Not Begin Until Batch Is Approved

System must block posting if:

-   Any line pending review

-   Any dimension missing (when mandatory)

-   Any GL mapping invalid

### BR-30: AR Settlement Posting

Dr Bank

Cr Accounts Receivable

### BR-31: AP Settlement Posting

Dr Vendor Liability

Cr Bank

### BR-32: Expense Reimbursement Posting

Dr Employee Settlement

Cr Bank

### BR-33: Payroll Settlement Posting

Dr Payroll Liability

Cr Bank

### BR-34: Bank Fees Posting

Dr Bank Charges

Dr VAT on Charges

Cr Bank

### BR-35: FX Gains/Losses Posting

Dr/Cr FX Gain/Loss

Cr/Dr Bank

### BR-36: Interest Income/Charges Posting

Dr Bank

Cr Interest Income

(Or vice versa)

### BR-37: Suspense Posting

Dr/Cr Suspense

Cr/Dr Bank

### 7.9 EXCEPTION HANDLING RULES

### BR-38: Suspicious Transaction Detection

Flag when:

-   Keyword triggers ("fraud", "chargeback")

-   Very large value

-   Amount inconsistent with past patterns

-   Narration ambiguous or empty

### BR-39: Exception Queue Must Be Monitored

Unresolved items cannot be ignored at month-end.

### BR-40: Expiry of Unresolved Exceptions

Tenant-configurable (e.g., 90 days) → escalate to CFO.

### 7.10 DUPLICATE PREVENTION RULES

### BR-41: Duplicate Cleaned Line Rule

If MD5 hash matches → flag duplicate.

### BR-42: Duplicate Posting Prevention

System must block posting:

-   Same invoice → two receipts

-   Same vendor payment → two postings

-   Same bank line → two mappings

### 7.11 AUDIT TRAIL RULES

### BR-43: Every Action Must Be Logged

Including:

-   Upload

-   Parsing

-   Mapping

-   Override

-   Approval

-   Posting

-   Download

-   Export

### BR-44: Audit Log Must Never Be Editable

Even by Super Admin.

### 7.12 EXPORT RULES

### BR-45: Finance Must Be Able to Export:

-   Raw cleaned statement

-   Auto-mapped statement

-   Finance-corrected statement

-   Approved mapped statement

-   Full reconciliation pack

### BR-46: Export Security

Export logs must include:

-   Who exported

-   When

-   What filters applied

### 7.13 MONTH-END RULES

### BR-47: Period Lock

Once period locked →

-   No edits

-   No uploads

-   No reclassification

Only CFO can unlock.

### 7.14 MULTI-TENANT SECURITY RULES

### BR-48: Tenant Sandbox Enforcement

No tenant can see another tenant's:

-   Bank accounts

-   Statements

-   Balances

-   GL entries

-   Audit logs

-   Mapping history

### BR-49: Super Admin Cannot View Tenant Bank Data

Super Admin sees only metadata, never financial content.

**SECTION 8 --- NON-FUNCTIONAL REQUIREMENTS (NFRs)**

(Enterprise-grade, deeply detailed, covering performance, scalability,
security, availability, UX, audit, and compliance.)

## 8.0 NON-FUNCTIONAL REQUIREMENTS

The Bank Reconciliation Module must deliver high performance, accuracy,
reliability, audit integrity, security, and scalability across all
tenant sizes---from small companies with one bank account to global
enterprises with hundreds of accounts across multiple currencies and
jurisdictions.

These NFRs ensure that ZivaBI Bank Reconciliation is faster, more
stable, more auditable, and more secure than any existing ERP-native or
third-party reconciliation tool.

### 8.1 PERFORMANCE REQUIREMENTS

### NFR-1: Parsing Speed

-   PDF/Excel/CSV statements up to 2,000 rows must parse within 8--12
    seconds.

-   High-volume statements (10,000+ rows) must parse within 30--45
    seconds.

### NFR-2: OCR Accuracy

-   OCR confidence for clean PDFs: ≥ 99%

-   OCR confidence for scanned PDFs: ≥ 92%

-   System must allow human corrections to train the AI.

### NFR-3: Auto-Matching Speed

-   5,000 bank lines → auto-match in under 10 seconds

-   AI suggestions generated in real-time (<1 second per line)

### NFR-4: Posting Performance

-   Posting up to 2,000 GL entries must occur within 5 seconds.

-   Batch posting must support up to 20,000 entries/hour.

### NFR-5: Dashboard Response Time

-   Dashboard must load within <2 seconds after filters are applied.

### 8.2 SCALABILITY REQUIREMENTS

### NFR-6: Multi-tenant Scalability

System must handle:

-   10,000+ tenants

-   Each with multiple bank accounts

-   Each with hundreds of statements monthly

-   Without performance degradation.

### NFR-7: Horizontal Scaling

System must be containerized and able to scale via:

-   Kubernetes auto-scaling

-   Per-tenant isolation

-   Dedicated worker queues for parsing & AI engines

### NFR-8: AI Training Scalability

-   The AI training engine must use background jobs.

-   AI model updates must not slow down active users.

### 8.3 AVAILABILITY & RELIABILITY REQUIREMENTS

### NFR-9: System Availability

-   Target 99.9% uptime

-   Zero downtime deployments (rolling deployment)

### NFR-10: Fault Tolerance

-   If parsing fails, system must:

    -   Provide error diagnostics

    -   Store raw file for reprocessing

    -   Allow user to upload corrected version

### NFR-11: Redundancy

-   Multi-zone cloud deployment

-   Redundant OCR nodes

-   Redundant API processing pipelines

### NFR-12: Auto-Recovery

System must auto-retry:

-   Failed parsing

-   Failed classification

-   Failed posting (retry with back-off)

### 8.4 SECURITY REQUIREMENTS

### NFR-13: Bank Data Encryption

-   All bank files encrypted at-rest using AES-256

-   All bank files encrypted in-transit (TLS 1.2+)

### NFR-14: Access Control

-   Strict RBAC

-   No user sees a bank account unless assigned

-   No employee sees payroll details unless tenant explicitly allows
    masked/unmasked mode

### NFR-15: Data Isolation

-   Every tenant has logical isolation (schema/database separation)

-   Super Admin cannot access tenant data

### NFR-16: Audit Logs Are Immutable

-   Cannot be edited or deleted by any role

-   Even Tenant Admin cannot modify logs

### NFR-17: Secure Storage of Uploaded Files

-   Bank statements stored in encrypted object storage

-   Access only via signed URLs (short-lived)

### 8.5 COMPLIANCE REQUIREMENTS

### NFR-18: GDPR Compliance

-   Bank statements must never appear in logs

-   Data export must respect tenant privacy settings

### NFR-19: PCI-Friendly Architecture

Although not directly processing cards, bank data must meet PCI-like
constraints:

-   Restricted access

-   Masking of sensitive fields

### NFR-20: ISO 27001 Security Alignment

System must follow:

-   Secure coding practices

-   Change management

-   Asset monitoring

### NFR-21: Nigerian Regulatory Support (If Tenant is in Nigeria)

-   CBN regulations

-   Anti-money laundering checks (optional future module)

-   WHT on bank charges

-   VAT posting on bank fees

### 8.6 DATA QUALITY & ACCURACY REQUIREMENTS

### NFR-22: Multi-line Narration Reconstruction Accuracy: ≥ 98%

Descriptions must be merged accurately.

### NFR-23: Duplicate Detection Accuracy: ≥ 99%

Hash-based + pattern-based duplicate detection.

### NFR-24: AI Mapping Accuracy (After Training): ≥ 95%

System improves monthly from finance corrections.

### NFR-25: FX Calculation Accuracy

FX differences must match ERP-calculated differences to within ± 0.01%.

### 8.7 USER EXPERIENCE (UX) REQUIREMENTS

### NFR-26: No Screen Should Take More Than 3 Seconds to Load

Especially:

-   Mapping dashboard

-   Reconciliation summary

### NFR-27: Drag & Drop Support

Users can:

-   Upload bank statements

-   Reorder mappings

-   Attach supporting documents

### NFR-28: Real-Time Validation

-   Errors must be displayed instantly

-   AI suggestions appear without page reload

### NFR-29: Mobile Responsiveness

Finance users must be able to:

-   View reconciliation dashboard

-   Approve mappings

-   Download reports

-   Review exceptions

On mobile or tablet.

### 8.8 AUDIT & TRACEABILITY REQUIREMENTS

### NFR-30: Full Traceability for Every Transaction

Each line must show:

-   Source statement line

-   Cleaned narration

-   AI suggestion

-   Human corrections

-   Approval actions

-   GL postings

-   Dimensions applied

### NFR-31: Exportable Audit Packs

Must include:

-   Cleaned statement

-   Mapping decisions

-   GL postings

-   Exception list

-   Unmatched items

-   Dimension mapping

-   Audit logs

### NFR-32: Locked Periods

After reconciliation is approved and closed:

-   No changes allowed

-   CFO must unlock explicitly

### 8.9 MAINTAINABILITY REQUIREMENTS

### NFR-33: Parser Profiles Must Be Editable

Tenant Admin can override parsing rules per bank.

### NFR-34: Mapping Rules Must Be Configurable

Tenant can:

-   Add new keywords

-   Add new GL rules

-   Set thresholds for partial matches

### NFR-35: AI Model Must Be Retrainable Without Downtime

New training sets do not interrupt active operations.

### 8.10 INTEGRATION REQUIREMENTS

### NFR-36: ERP Integration Latency

Posting to ERP must occur in:

-   < 3 seconds for synchronous posting

-   < 60 seconds for asynchronous batch posting

### NFR-37: AR/AP/Expense/Payroll Integration

Reconciliation must pull:

-   Open invoices

-   Open settlements

-   Open payables

-   Payroll runs

In < 1 second per request.

### NFR-38: Vendor & Customer Master Sync

Mapping must sync vendor/customer names within minutes of changes.

### 8.11 BACKUP & DISASTER RECOVERY

### NFR-39: Automatic Backups

-   Hourly diff backups

-   Daily full backups

### NFR-40: RPO (Recovery Point Objective)

-   Max data loss: < 5 minutes

### NFR-41: RTO (Recovery Time Objective)

-   System recovery: < 30 minutes

### 8.12 AI ETHICAL REQUIREMENTS

### NFR-42: AI Decisions Must Always Be Explainable

For each suggestion:

-   Model shows reasons

-   Confidence score

-   Past pattern references

### NFR-43: AI Must Never Auto-Post

Human approval is mandatory.

### NFR-44: Continuous Learning Requires Human Corrections

AI models only learn from approved corrections, never raw data.

**SECTION 9 --- FUNCTIONAL REQUIREMENTS**

(Extremely detailed, enterprise-grade, structured exactly like a true
software engineering specification.)

This section defines ALL functional requirements (FRs) for the Bank
Reconciliation Module, grouped logically for engineering, QA, and UX
teams.

Each requirement below is:

-   Atomic (one requirement per FR)

-   Testable (can be validated by QA)

-   Traceable (can be linked to workflows/business rules)

-   Comprehensive (covers every functional behavior expected)

## 9.0 DETAILED FEATURE REQUIREMENTS

The Bank Reconciliation Module must:

1.  Ingest any bank statement format

2.  Clean, normalize, and structure the content

3.  Auto-classify transactions using rules + AI

4.  Allow finance to correct mappings

5.  Process approvals

6.  Post to GL/AR/AP/Expense/Payroll

7.  Reconcile book balance vs bank balance

8.  Surface exceptions for resolution

9.  Maintain complete audit trail

10. Export all reconciliation outputs

This section defines how all these must function.

### 9.1 BANK STATEMENT UPLOAD & INGESTION

### FR-1: Upload Statement

User must be able to upload files in formats:

-   PDF

-   Excel

-   CSV

-   MT940

-   OFX

-   JSON/XML (API feed)

### FR-2: File Validation

System must validate:

-   File size

-   Supported format

-   Password protection

-   Duplicate upload prevention

-   Tenant ownership of the bank account

### FR-3: Multi-Account Upload

A single upload must support:

-   Multiple accounts

-   Multiple statements

-   Multiple date ranges

### FR-4: Upload Logging

Each upload must be logged with:

-   User

-   Timestamp

-   File name

-   File type

-   Bank account

-   IP address

### 9.2 OCR & PARSING

### FR-5: OCR Engine Activation

System must automatically apply OCR when:

-   PDF is scanned

-   Text cannot be extracted natively

-   Mixed text/image PDF is detected

### FR-6: Multi-Line Narration Reconstruction

System must detect and merge rows where:

-   No date appears after the first row

-   No debit/credit amount appears

-   Line resembles continuation text

### FR-7: Header/Footer Removal

OCR must detect and remove:

-   Page number lines

-   Bank logo lines

-   Disclaimer paragraphs

-   Repeated table headers

### FR-8: Column Mapping Discovery

System must auto-detect:

-   Date column

-   Narration column

-   Debit column

-   Credit column

-   Balance column

-   Currency column

Even if:

-   Order changes

-   Column names differ

-   Columns lack headers

### FR-9: Date Format Normalization

System must parse:

-   DD/MM/YYYY

-   MM-DD-YYYY

-   YY/MM/DD

-   Asterisks, spaces, or misprints

### FR-10: Continuity Validation

System must verify:

-   Running balances are continuous

-   Missing rows are flagged

-   Misordered rows are corrected

### 9.3 CLEANING, STRUCTURING & NORMALIZATION

### FR-11: Cleaned Statement Generation

System must generate a clean, single-row-per-transaction dataset.

### FR-12: Duplicate Detection

System must detect duplicates using:

-   MD5/SHA hash

-   Date + Amount + Description combination

-   Sequence similarity

### FR-13: Keyword Extraction

System must extract keywords like:

-   POS

-   MOBILE BANKING

-   NIP

-   REF

-   CHG

-   VAT

-   FX

-   PAYROLL

### FR-14: Reference Extraction

System must extract potential references:

-   Invoice numbers

-   PO numbers

-   Employee IDs

-   Customer IDs

-   Vendor IDs

### FR-15: Cleaned Statement Download

User must be able to download:

-   Cleaned (no mapping)

-   Cleaned + auto-mapping

-   Cleaned + approved mapping

### 9.4 AUTO-MATCHING & AI SUGGESTION ENGINE

### FR-16: AR Auto-Matching

System must match inflows to:

-   Customer invoices

-   Customer names

-   Sales orders

-   Weighted matching

-   Partial payments

### FR-17: AP Auto-Matching

System must match outflows to:

-   Vendor invoices

-   Vendor advances

-   AP settlement batches

-   Payment runs

### FR-18: Employee/Expense Matching

System must match:

-   Expense reimbursements

-   Travel advance settlements

### FR-19: Payroll Matching

System must auto-detect:

-   Salary batch

-   PAYE

-   Pension

-   NHF

-   Other statutory remittance

### FR-20: FX Event Detection

System must identify transactions where:

-   Currency debit ≠ currency credit

-   Bank applies FX conversion

### FR-21: Bank Fee Detection

System must auto-classify:

-   SMS charge

-   Stamp duty

-   Transfer fee

-   POS fee

-   Processing fees

-   Bank commission

### FR-22: AI Confidence Scoring

Every AI-generated mapping must have:

-   A score (0 to 1)

-   A reasons list

### FR-23: AI Suggestions Must Never Auto-Post

Human approval mandatory.

### 9.5 MANUAL MAPPING, CORRECTION & REVIEW

### FR-24: Correction Tools

Finance must be able to:

-   Change GL

-   Change BP

-   Change invoice linkage

-   Change module (AR/AP/Payroll/Expense/Journal)

-   Edit description

-   Split a bank line

-   Merge bank lines

-   Add dimensions

-   Override AI suggestions

### FR-25: Validation Before Approval

System must block approval if:

-   Required dimensions missing

-   GL invalid

-   BP missing where required

-   Transaction value is zero

-   BP frozen (inactive vendor/customer)

### FR-26: Mapping Notes

User must be able to add notes explaining mapping decisions.

### 9.6 EXCEPTION HANDLING

### FR-27: Exception Queue

System must automatically route problematic lines into:

-   Unknown inflow

-   Unknown outflow

-   Suspicious transaction

-   FX mismatch

-   Bank error

-   Negative narration

-   Duplicate lines

-   Missing dimensions

-   Mismatched amount

### FR-28: Exception Assignment

User can assign exception to:

-   Another team member

-   Treasury

-   AR/AP team

-   Manager

### FR-29: Exception Aging

System must display:

-   Days outstanding

-   Escalation threshold

-   Overdue exceptions

### 9.7 APPROVAL WORKFLOW

### FR-30: Submit for Approval

Finance officer submits mapped lines.

### FR-31: Approver View

Approver sees:

-   High-risk items at top

-   Suspense postings

-   Large-value transactions

-   FX postings

-   Tax implications

### FR-32: Approver Actions

Approver can:

-   Approve whole batch

-   Approve selected lines

-   Reject selected lines

-   Request clarification

### FR-33: Lock After Approval

After approval:

-   Mappings locked

-   No further edits allowed

Unless manager reopens.

### 9.8 POSTING ENGINE

### FR-34: Posting to GL

System must generate GL postings for:

-   AR settlements

-   AP settlements

-   Payroll

-   Expenses

-   FX gains/losses

-   Bank fees

-   Interest income

-   Suspense

### FR-35: Multi-Debit/Multi-Credit Postings

Supports:

-   One bank line → Many GL entries

-   Many bank lines → One GL entry

### FR-36: Posting Errors

If ERP rejects posting → system must:

-   Log error

-   Allow user to correct

-   Retry posting

### FR-37: Reversal Posting

User must be able to reverse a prior posting.

### 9.9 RECONCILIATION ENGINE

### FR-38: Book Balance Calculation

System must compute:

-   Opening book balance

-   Closing book balance

-   Book-side unreconciled items

### FR-39: Bank Balance Calculation

System must compute:

-   Opening statement balance

-   Closing balance

-   Bank-side unreconciled items

### FR-40: Variance Reporting

Dashboard must show:

-   Statement vs Book

-   Difference

-   Aging of unreconciled items

### FR-41: Partial Reconciliation

Transactions may be marked partially reconciled if:

-   Partial AR payment posted

-   Multi-line AP payment posted

### FR-42: Final Reconciliation Lock

User must lock period.

CFO unlocks if needed.

### 9.10 EXPORTS & REPORTING

### FR-43: Export Cleaned Statement

Excel/PDF/CSV exports.

### FR-44: Export Full Reconciliation Pack

Includes:

-   Cleaned statement

-   Mapping

-   Approvals

-   GL postings

-   FX impacts

-   Bank fees

-   Exceptions

-   Unmatched

-   Audit logs

### FR-45: Period Summary Report

Must include:

-   Reconciled items

-   Open items

-   Suspense items

-   FX adjustments

-   Fees totals

-   Reconciling differences

### 9.11 AUDIT REQUIREMENTS

### FR-46: Immutable Logs

System must track:

-   Upload

-   Mapping

-   Corrections

-   Approvals

-   Posting

-   Export

Logs cannot be edited or deleted.

### FR-47: Auditor Portal

Auditors must be able to:

-   View reconciliations

-   Download packs

-   Filter by period

-   View mapping history

-   See original PDF side-by-side

### FR-48: Audit Evidence Bundling

System automatically bundles:

-   Original PDF

-   Cleaned version

-   Mapping

-   GL postings

-   Approvals

### 9.12 MULTI-TENANT & SECURITY REQUIREMENTS

### FR-49: Tenant Sandbox

Each tenant must have isolated:

-   Bank accounts

-   Statements

-   Mappings

-   Logs

-   AI models

### FR-50: Super Admin Restrictions

Super Admin:

-   Cannot view statements

-   Cannot view mapping

-   Cannot view GL data

Only sees infrastructure health.

**SECTION 10 --- UI/UX REQUIREMENTS**

(Extremely detailed, modern, intuitive, enterprise-grade,
mobile-responsive, and consistent with all ZivaBI modules.)

The UI/UX design for the Bank Reconciliation Module must be:

-   Modern (2025-level UI standards)

-   User-friendly

-   Fast & responsive

-   Drag-and-drop enabled

-   Dashboard-driven

-   Auditor-friendly

-   Mobile-accessible

-   Role-based

Every screen must reinforce simplicity despite the immense complexity
happening in the backend.

Below is the full specification.

## 10.0 OVERVIEW OF UI DESIGN PRINCIPLES

The UI across this module must follow these core principles:

### UI-P1: Zero-Confusion Interface

Users must immediately understand:

-   What needs attention

-   What is pending

-   What is complete

-   What is unusual

### UI-P2: Minimal Clicks

Most actions should be 1--2 clicks.

### UI-P3: Real-Time Feedback

All validations must occur instantly.

### UI-P4: Uniform Design Across ZivaBI

Consistent:

-   Fonts

-   Button styles

-   Iconography

-   Modal behavior

-   Layout

### UI-P5: Intelligent Automation Visualized

AI suggestions should be clearly shown with:

-   Confidence scores

-   Reasoning tags

-   Explanation tooltips

### UI-P6: Auditor-Friendly

All screens that involve compliance must be:

-   Exportable

-   Filterable

-   Clearly timestamped

-   Traceable

### 10.1 UI REQUIREMENTS --- BANK STATEMENT UPLOAD SCREEN

### 10.1.1 Screen Purpose

Enable users to upload, validate, and preview bank statements before
parsing.

### 10.1.2 Required Components

-   Drag & Drop Zone (large, centered)

-   Upload Button (for mobile users)

-   Bank Account Selector

-   Statement Period Detector (auto-filled after upload)

-   File Type Indicator

-   File Validation Card (shows pass/fail rules)

-   Duplicate Check Alert

-   Parsing Profile Indicator (bank format auto-recognition)

-   Progress Spinner

-   Error Summary Panel

-   "Upload & Parse" button

-   "Cancel Upload" button

### 10.1.3 UX Requirements

-   Parsing progress displayed in real-time.

-   Any parsing errors shown with "Fix Instructions".

-   File contents show preview of first 5 lines before parsing.

-   If multiple files are uploaded, system must group them.

### 10.1.4 Mobile Layout

-   Vertical flow

-   Upload button large and thumb-accessible

-   Parsing results scrollable

### 10.2 UI REQUIREMENTS --- CLEANED STATEMENT VIEW

After parsing, user sees:

### 10.2.1 Cleaned Statement Table

Columns:

-   Sequence

-   Transaction Date

-   Description (merged)

-   Debit

-   Credit

-   Currency

-   Balance

-   Extracted References

-   Extracted Keywords

-   Duplicate Flag (if any)

### 10.2.2 Row Color Logic

-   Red: Parsing anomalies

-   Yellow: Potential duplicate

-   Blue: Multi-line description merged

-   Grey: Low-confidence OCR

### 10.2.3 Expandable Row

Shows:

-   Original raw lines

-   OCR confidence

-   Pre-normalized description

### 10.2.4 Filters

-   Date

-   Amount

-   Description

-   Keyword

-   Duplicate status

### 10.2.5 Downloads Button

User can download:

-   Cleaned (no mapping)

-   Cleaned + AI mapping

### 10.3 UI REQUIREMENTS --- AUTO-MAPPING DASHBOARD

This is the heart of the system.

### 10.3.1 Layout

Three vertical panels:

#### Panel A --- Bank Line List

Shows:

-   Line number

-   Date

-   Amount

-   Description

With status tag:

-   Auto-matched

-   Needs review

-   High risk

-   Duplicate?

-   Suspense candidate

#### Panel B --- Mapping Workspace

Shows AI's proposed mapping:

-   Suggested Module (AR/AP/Payroll/Expense/Journal)

-   Suggested GL

-   Suggested BP

-   Suggested Invoice / System Transaction

-   Suggested Dimensions

-   AI Confidence Score

-   Reason Codes (e.g., "Matched invoice \#10239", "Recognized customer
    name")

User can override everything.

#### Panel C --- Evidence Panel

Displays:

-   Raw OCR text

-   Similar historical transactions

-   Past mappings for same BP

-   Posting rules triggered

### 10.3.2 Inline Edit Controls

Each suggestion can be edited by:

-   Dropdown

-   Search bar

-   Quick BP finder

-   GL finder

-   Dimension picker

### 10.3.3 Split/Merge Buttons

-   "Split Line" → opens mini-form for splitting by % or amount

-   "Merge With Previous/Next" → joins rows

### 10.3.4 Notes & Comments

User can:

-   Add internal notes

-   Tag coworkers

-   Attach supporting files

### 10.3.5 AI Assistance Indicators

-   Green badge: High confidence

-   Yellow badge: Medium

-   Red badge: Low

-   Hovering shows explanation:

    -   "Matched by name similarity"

    -   "Matched by invoice amount"

    -   "Recurring vendor payment"

### 10.4 UI REQUIREMENTS --- FINANCE REVIEW SCREEN

### 10.4.1 Summary Bar

Shows totals:

-   Total Lines

-   Auto-matched

-   Pending review

-   Exceptions

-   Suspense candidates

-   FX lines

-   Bank fees detected

### 10.4.2 Bulk Actions

Finance can:

-   Accept all high-confidence mappings

-   Reject selected mappings

-   Reclassify in bulk

-   Assign same BP to multiple lines

-   Assign same GL to multiple lines

### 10.5 UI REQUIREMENTS --- APPROVAL SCREEN

### 10.5.1 Manager Approval View

Shows:

-   Exceptions needing approval

-   Suspense lines

-   High-value items

-   FX lines needing review

-   Bank charges

-   Dimension warnings

### 10.5.2 Approver Actions

-   Approve batch

-   Approve selected

-   Reject with notes

-   Request clarification

-   Escalate to CFO

### 10.6 UI REQUIREMENTS --- POSTING RESULT SCREEN

### 10.6.1 Posting Result Summary

Shows:

-   GL entries generated

-   Sub-ledger updates (AR/AP/Expense/Payroll)

-   FX postings

-   Suspense postings

-   Posting failures

### 10.6.2 Retry & Correct UI

Users can:

-   Retry posting

-   Edit problematic lines

-   Generate error report

### 10.7 UI REQUIREMENTS --- RECONCILIATION DASHBOARD

### 10.7.1 Dashboard Metrics

-   Statement balance

-   Book balance

-   Reconciliation difference

-   Matched amount

-   Unmatched amount

-   Suspense outstanding

-   FX gain/loss total

-   Bank charges total

-   Exception count

### 10.7.2 Visualizations

-   Bar chart: Inflows vs Outflows

-   Line chart: Daily cash trend

-   Pie chart: Mapped vs Unmapped

-   Heatmap: Exception aging

### 10.8 UI REQUIREMENTS --- EXCEPTION MANAGEMENT

### 10.8.1 Exception List

Filters for:

-   Unknown inflow

-   Unknown outflow

-   FX mismatch

-   Duplicate detection

-   Suspicious keywords

-   Missing dimensions

-   Suspense account required

### 10.8.2 Exception Detail View

Shows:

-   Bank line

-   AI reasons

-   User notes

-   Audit history

-   Attachments

-   Dimension assignment

### 10.8.3 Actions

-   Assign to user

-   Add comment

-   Resolve

-   Reject mapping

-   Force map to suspense

### 10.9 UI REQUIREMENTS --- EXPORTS & AUDIT PACK

### 10.9.1 Export Options

Users can export:

-   Cleaned statement

-   Cleaned + mapping

-   Approved mappings

-   Full reconciliation pack

-   Audit logs

-   Dimension mappings

### 10.9.2 Multi-Sheet Excel Export

Sheets:

1.  Summary

2.  Cleaned Statement

3.  AI Mapping

4.  User-reviewed Mapping

5.  Approved Mapping

6.  GL postings

7.  Exceptions

8.  Suspense

9.  FX postings

10. Audit logs

### 10.10 UI REQUIREMENTS --- AUDITOR PORTAL

### 10.10.1 Read-only Access

Auditor can:

-   View reconciliations

-   Filter by period

-   Download audit pack

-   Inspect mapping history

-   Compare raw vs cleaned vs approved

### 10.10.2 Side-by-Side Viewer

Auditor sees:

Left side → Original PDF line

Right side → Cleaned + mapped line

### 10.11 MOBILE UI REQUIREMENTS

### 10.11.1 Essential Features Available

-   Approvals

-   Reviewing mappings

-   Reviewing exceptions

-   Downloading summary reports

-   Viewing dashboards

### 10.11.2 Responsive Views

Tables collapse into vertical cards showing:

-   Date

-   Description

-   Amount

-   Status

**SECTION 11 --- INTEGRATION REQUIREMENTS**

(Deep, enterprise-grade, covering all required integrations with AR, AP,
Expense, Payroll, GL, FX, Dimensions, Tax, ERP systems, and external
bank channels.)

This section ensures the Bank Reconciliation Module connects seamlessly
and intelligently with every part of ZivaBI and any external ERP.

## 11.0 INTEGRATION REQUIREMENTS

The Bank Reconciliation Module is a core financial engine, so it must
integrate with:

-   Internal ZivaBI modules (AR, AP, Expense, Payroll, Inventory, Tax
    Engine, Dimensions Engine)

-   External ERP systems (Sage X3, SAP, Oracle, Dynamics, QuickBooks,
    Odoo, etc.)

-   Bank data sources (API or file-based)

-   AI services

-   Tenant configuration service

-   Audit service

-   Export service

All integrations must be:

-   Secure

-   Performant

-   Transactionally consistent

-   Fully traceable

-   Multi-tenant safe

-   Fault-tolerant (fail gracefully)

### 11.1 INTEGRATION WITH ZivaBI CHART OF ACCOUNTS (GL ENGINE)

### IR-1: GL Account Retrieval

System must retrieve:

-   Active GL accounts

-   GL account types (Asset, Liability, Equity, Income, Expense)

-   Posting rules

-   Dimension rules

-   Currency rules

### IR-2: GL Posting

After approval, Bank Reconciliation Module must send:

-   Debit/Credit amounts

-   GL accounts

-   Dimensions

-   Posting date

-   Document number

-   Transaction reference

### IR-3: Posting Validation

GL engine must validate:

-   GL is active

-   Posting level correct (control account, sub-ledger, etc.)

-   Dimensions complete

-   Currency allowed

### IR-4: Error Handling

If posting fails:

-   Return error message

-   Mark line as "Posting Failed"

-   Allow user to fix and retry

### 11.2 INTEGRATION WITH ACCOUNTS RECEIVABLE (AR)

### IR-5: AR Invoice Retrieval

For matching, Bank Reconciliation Module must retrieve:

-   Outstanding invoices

-   Invoice amount

-   Invoice currency

-   Customer details

-   Dimensions attached to invoice

-   WHT settings

-   FX rate (for FX customers)

### IR-6: Settlement Posting

When AR settlement occurs:

-   System must reduce AR balance

-   Post settlement to correct AR sub-ledger

-   Handle partial payments

-   Handle overpayments

-   Handle WHT deductions

### IR-7: AR Notification

AR team must be notified when:

-   Unmatched inflow exists

-   Customer pays without reference

-   Customer pays multiple invoices in one payment

### 11.3 INTEGRATION WITH ACCOUNTS PAYABLE (AP)

### IR-8: AP Invoice Retrieval

System retrieves:

-   Outstanding vendor invoices

-   Vendor advances

-   Vendor banking profile

-   WHT deduction rules

-   AP posting rules

### IR-9: AP Payment Settlement

When vendor payment line is mapped:

-   System must settle AP liability

-   Apply WHT logic where relevant

-   Detect FX adjustments

-   Validate vendor account

### IR-10: 3PL & Clearing Agent Integration

System must identify and integrate:

-   Clearing agent invoices for imports

-   3PL delivery invoices

-   Accrual reversals

-   Warehouse billing cycles

### 11.4 INTEGRATION WITH EXPENSE MANAGEMENT MODULE

### IR-11: Expense Retrieval

System retrieves:

-   Approved staff reimbursements

-   Approved travel advance retirements

-   Expense IDs

-   Staff IDs

### IR-12: Expense Settlement

When a reimbursement payment matches:

-   System must post settlement

-   Update employee expense ledger

-   Close expenses in Expense Module

### 11.5 INTEGRATION WITH PAYROLL MODULE

### IR-13: Payroll Batch Retrieval

System must retrieve payroll:

-   Salary batch total

-   Statutory deductions (PAYE, Pension, etc.)

-   Employee payout references

### IR-14: Payroll Settlement

When payroll payment is detected:

-   Mark payroll run as settled

-   Post payroll liability clearing

### IR-15: Sensitive Data Masking

Payroll amounts must be masked unless:

-   Tenant explicitly configures visibility

### 11.6 INTEGRATION WITH TAX ENGINE

### IR-16: VAT on Bank Charges

System must send:

-   Charge amount

-   VAT base

-   VAT rate

-   VAT GL

### IR-17: WHT Processing

System must categorize:

-   Customer WHT (from AR receipts)

-   Vendor WHT (from AP payments)

-   Bank-related WHT (if any)

### IR-18: Tax Export

Tax engine must be able to export:

-   VAT on bank charges

-   WHT deductions

-   FX gains/loss tax relevance

### 11.7 INTEGRATION WITH DIMENSIONS ENGINE

### IR-19: Dimension Fetching

System fetches:

-   Real IO list

-   Cost Center IO

-   Material IO

-   Location dimension

-   Custom tenant dimensions

### IR-20: Dimension Enforcement

System enforces:

-   Mandatory dimensions

-   Valid dimension combinations

-   Default dimensions based on GL or BP

### 11.8 INTEGRATION WITH AI & ML ENGINE

### IR-21: AI Mapping Request

For each cleaned bank line, system must send:

-   Description

-   Amount

-   Keywords

-   Past mapping signatures

-   Vendor/Customer/Employee matching patterns

### IR-22: AI Mapping Response

AI returns:

-   Suggested module

-   Suggested GL

-   Suggested BP

-   Suggested dimensions

-   Confidence score

-   Reason metadata

### IR-23: AI Feedback Loop

After Finance approves or corrects mapping:

-   System must update AI training set

-   Train model periodically

-   Improve future suggestions

### 11.9 INTEGRATION WITH EXPORT ENGINE

### IR-24: Export Formats

Support:

-   Excel

-   CSV

-   PDF

-   JSON

### IR-25: Export Packages

Export engine must support:

-   Cleaned statement

-   Mapping statement

-   Reconciliation pack

-   Audit logs

### IR-26: Export History Tracking

All exports logged.

### 11.10 INTEGRATION WITH NOTIFICATION ENGINE

### IR-27: Email/SMS/Push Notifications

Trigger notifications:

-   Approval required

-   Exception requires review

-   Unmatched transaction detected

-   Posting failed

-   Reconciliation completed

-   Suspicious activity detected

### IR-28: Slack/Teams Integration (Optional)

Tenant may enable slack or Teams notifications.

### 11.11 INTEGRATION WITH ERP SYSTEMS

### IR-29: ERP Connector Compatibility

Module must be compatible with:

-   Sage X3

-   SAP ECC/S4

-   Oracle Fusion

-   Dynamics 365

-   Odoo

-   QuickBooks

-   Zoho ERP

-   Custom ERPs

### IR-30: Posting Mode

Two posting modes:

1.  Real-time posting (synchronous)

2.  Batch posting (asynchronous)

### IR-31: ERP Mapping Tables

Tenant must be able to map:

-   GL accounts

-   BP codes

-   Tax codes

-   Dimensions

-   Document types

### IR-32: Error Handling

ERP failures must not block remaining postings.

### 11.12 INTEGRATION WITH BANK CHANNELS

### IR-33: API-Based Bank Integration (Where Available)

System must support:

-   OAuth 2.0

-   Mutual TLS

-   Secure tokens

-   Daily/real-time statement sync

### IR-34: Email Ingestion

For banks that send:

-   Daily email statements

-   POS settlement files

### IR-35: SFTP Integration

System must pick statements from:

-   Tenant bank SFTP

-   POS processors

-   Gateway partners

### 11.13 MULTI-TENANCY INTEGRATION

### IR-36: Tenant Isolation

Each tenant must have:

-   Dedicated schema

-   Separate AI dataset

-   Separate parsing profiles

### IR-37: Cross-Module Security

A user assigned to AR cannot access AP mappings unless tenant enables.

### 11.14 DATA WAREHOUSE / ANALYTICS INTEGRATION

### IR-38: Reconciliation Data Sync

Sync structured data to data warehouse for analytics:

-   Cash trends

-   FX positions

-   Reconciliation timelines

-   Exception patterns

### IR-39: BI Dashboard Integration

Must integrate with:

-   ZivaBI Analytics Module (future)

-   Power BI

-   Tableau

-   Looker

-   Qlik

**SECTION 12 --- SECURITY, AUDIT & COMPLIANCE REQUIREMENTS**

(Enterprise-grade, bank-level, regulator-ready security and audit
standards that ensure the module is acceptable for statutory audits,
internal audits, external auditors, regulatory reviewers, and large
multinational tenants.)

## 12.0 SECURITY & COMPLIANCE REQUIREMENTS

The Bank Reconciliation Module handles highly sensitive financial data,
including:

-   Bank transactions

-   Payroll payments

-   Vendor payments

-   Customer receipts

-   FX transfers

-   Charges and taxes

-   Sensitive descriptions

Because of this, the security, audit, compliance, and data-protection
requirements must match:

-   Bank-grade security

-   Regulatory compliance across multiple jurisdictions

-   Internal and External Audit standards

-   Financial reporting frameworks (IFRS, GAAP)

-   Data protection frameworks (GDPR, NDPR, CCPA)

This section defines everything the system must satisfy to be globally
deployable.

### 12.1 DATA SECURITY REQUIREMENTS

### SEC-1: Bank Data Encryption (At Rest)

All bank statements and processed lines MUST be encrypted with AES-256.

### SEC-2: Data Encryption (In Transit)

All communications (web, API, OCR, ERP connectors) must enforce:

-   TLS 1.2 or higher

-   HSTS

-   Perfect Forward Secrecy

### SEC-3: Separation of Duties

System must enforce:

-   A user who uploads statements cannot approve them

-   A user who approves cannot post

-   A user who posts cannot modify the GL config

All tenant-configurable.

### SEC-4: Masking of Sensitive Data

Mask the following unless a role has explicit permission:

-   Salary payments

-   Employee names on payroll transactions

-   Vendor bank account numbers

-   Customer bank account numbers

Masking level is tenant-configurable.

### SEC-5: Hashing of Narrative for AI Training

AI training data must use:

-   Masked descriptions

-   Tokenized personal data

Sensitive names must never be stored in raw form in the AI dataset.

### 12.2 ACCESS CONTROL & ROLE SECURITY

### SEC-6: Role-Based Access Control (RBAC)

The module must support granular permissions for:

-   Viewing statements

-   Parsing statements

-   Editing mappings

-   Approving

-   Posting

-   Exporting

-   Viewing payroll lines

-   Viewing vendor/customer details

### SEC-7: Multi-Factor Authentication (MFA)

MFA must be required for:

-   Approvers

-   CFO

-   Tenant Admin

-   Internal Auditor

-   External Auditor

### SEC-8: IP Restrictions

Tenant may optionally enforce:

-   Whitelisted IPs

-   Office-network-only access

-   Restricted access for auditors

### SEC-9: Session Timeout Policies

Tenant can configure:

-   15 min

-   30 min

-   60 min

-   Custom

### 12.3 AUDIT TRAIL REQUIREMENTS

### AUD-1: Immutable Audit Logs

All logs must be:

-   Append-only

-   Non-editable

-   Non-deletable

-   Time-stamped

-   User-linked

-   IP-address linked

-   Contain before/after values

### AUD-2: Version History

Every version of mapping decision must be stored:

-   Initial AI suggestion

-   User edit

-   Final approved version

-   Reversal if any

### AUD-3: Traceability Across Modules

A bank line must be traceable to:

-   AR settlement

-   AP settlement

-   Expense or Payroll settlement

-   FX posting

-   GL entry

-   Dimensions applied

-   Approval trail

### AUD-4: Side-by-Side PDF Comparison

Auditors must see:

-   Original PDF

-   Cleaned output

-   Mapped version

-   Posted version

### AUD-5: Evidence Bundling

System must generate:

-   Full audit pack

-   Time-stamped

-   Serialized (unique ID)

### 12.4 EXTERNAL AUDIT ACCESS REQUIREMENTS

### AUD-6: External Auditor Portal

Externally authorized auditors can:

-   View but not edit

-   Access only periods tenant allows

-   Download audit packs

-   Search by GL account, period, amount

-   Add audit queries in-system

### AUD-7: Restricted Payroll Visibility

External auditors see:

-   Masked payroll lines (unless tenant enables full visibility)

-   Totals only for payroll transactions

### AUD-8: Zero Access to Bank Account Numbers

Must be fully masked for all external auditors.

### 12.5 INTERNAL CONTROLS & FRAUD DETECTION

### FRD-1: Suspicious Transaction Alerts

System must flag:

-   Very large deposits

-   Very large withdrawals

-   Activity outside normal patterns

-   Repeated similar descriptions

-   Negative descriptions ("chargeback", "fraud", etc.)

-   Duplicate bank lines

### FRD-2: Bank vs Book Mismatch Alerts

System must notify finance if:

-   Bank closing balance ≠ Book closing balance

-   Overdue exceptions exist

-   High-risk items unresolved

### FRD-3: Forced Posting Restrictions

User cannot override:

-   GL mapping

-   BP mapping

-   Dimension requirements

unless they have explicit privilege.

### FRD-4: Suspense Account Restrictions

Suspense postings require:

-   Additional confirmation

-   Manager or CFO approval

### FRD-5: Audit Query Workflow

Auditors can raise queries:

-   Finance must respond inside the platform

-   All responses logged

-   Query resolution included in audit pack

### 12.6 COMPLIANCE REQUIREMENTS

### CMP-1: IFRS / GAAP Compliance

Reconciliation must support:

-   Accrual basis

-   Realization of revenue upon bank receipt

-   FX revaluation

-   Bank fee amortization

-   Proper suspense usage

-   Clear settlement of sub-ledgers

### CMP-2: Tax Compliance

System must support:

-   VAT on bank charges (e.g., Nigeria 7.5%)

-   WHT deduction recognition

-   FX tax implications

-   Compliance reporting

### CMP-3: CBN and NDPR (Nigeria) Support

For Nigerian tenants:

-   Bank statements securely stored

-   No leakage of bank account numbers

-   CBN reporting fields supported

### CMP-4: GDPR / CCPA Compliance

-   Right to erasure (of personal data) must be tenant-controlled

-   Export must respect data privacy levels

### 12.7 BACKUP, FAILOVER & DISASTER RECOVERY

### DR-1: Multi-Zone Deployment

App must run in multiple zones for redundancy.

### DR-2: Regular Backups

Automated backups:

-   Every hour (diff)

-   Daily full backups

### DR-3: RPO < 5 minutes

Maximum acceptable data loss: < 5 minutes.

### DR-4: RTO < 30 minutes

System must recover within 30 minutes.

### DR-5: Corrupted File Recovery

If statement upload is corrupted:

-   System stores original

-   Allows re-upload

-   Maintains logs for audit

### 12.8 DATA RETENTION & DELETION

### RET-1: Statement Storage Retention

Default:

-   7 years (tenant-configurable)

### RET-2: Log Retention

Audit logs must never be deletable manually.

### RET-3: Masking After Retention Period

Older statements (beyond retention) must be masked if tenant mandates.

### 12.9 SECURITY MONITORING & ALERTING

### SEC-21: SIEM Integration

Supports:

-   Splunk

-   ELK

-   Azure Sentinel

-   AWS CloudWatch

-   Datadog

### SEC-22: Real-Time Alerts

Alerts for:

-   Unauthorized access attempt

-   Suspicious file upload

-   Failed login attempts

-   Unusual volume of exceptions

-   Sudden surge in unmatched items

**SECTION 13 --- REPORTING & ANALYTICS REQUIREMENTS**

(This section defines all dashboards, KPIs, exports, drill-downs, pivot
analytics, and data-quality insights the module must deliver. Designed
for CFO-level visibility, finance managers, auditors, treasury analysts,
and internal controllers.)

## 13.0 REPORTING & ANALYTICS

The Bank Reconciliation Module is a financial control center.

Its reporting must:

-   Provide full transparency

-   Surface risk, exceptions, delays, and reconciliation breakdown

-   Enable CFOs and auditors to validate cash integrity

-   Give actionable intelligence for cash flow, fraud detection, FX
    impacts, and operational bottlenecks

-   Be exportable and ingestible into BI systems

-   Work for any tenant size (small business ↔ enterprise clients)

This section defines everything required from Reporting & Analytics.

### 13.1 CORE RECONCILIATION DASHBOARD

### RPT-1: Real-Time Reconciliation Summary

Dashboard must display:

-   Bank Statement Balance

-   Book Balance (per GL)

-   Reconciling Difference

-   Matched Amount

-   Unmatched Amount

-   Exception Count

-   Number of Statements Uploaded

-   Number of Transactions Processed

-   Posting Errors

Drill-down must be available for every number.

### RPT-2: Daily Cash Movement Chart

A line chart showing:

-   Inflows by day

-   Outflows by day

-   Net position by day

### RPT-3: Cash Position by Bank Account

A multi-account view showing:

-   Opening balance

-   Closing balance

-   Cash inflow

-   Cash outflow

-   FX impact

-   Reconciling items

Supports currency conversion to tenant functional currency.

### 13.2 EXCEPTION REPORTING

### RPT-4: Exception Heatmap

Heatmap showing:

-   Exception Type vs. Days Outstanding

Exception types:

-   Unknown inflow

-   Unknown outflow

-   FX mismatch

-   Dimension missing

-   Suspense mapping

-   Duplicate transaction

-   Parsing anomaly

-   Unposted mapping

### RPT-5: Exception Aging Report

Group exceptions by:

-   0--3 days

-   4--7 days

-   8--14 days

-   15--30 days

-   30 days

With owner assignment.

### RPT-6: Exception Resolution Time KPI

Track average resolution times by:

-   User

-   Team

-   Exception category

### 13.3 AI PERFORMANCE ANALYTICS

### RPT-7: AI Accuracy Report

Shows:

-   \% Auto-matched

-   \% Accepted without edits

-   \% Accepted with minor edits

-   \% Rejected

-   \% Overridden

### RPT-8: AI Confidence Distribution Chart

Histogram of AI confidence levels:

-   0--0.25

-   0.25--0.50

-   0.50--0.75

-   0.75--1.00

### RPT-9: AI Misclassification Log

List of transactions AI misclassified, including:

-   Suggested mapping

-   Actual mapping

-   Reason for mismatch

-   Corrected dimensions

Used for training dataset improvements.

### 13.4 BANK CHARGES & TAX REPORTING

### RPT-10: Bank Charges Summary

Shows:

-   SMS charges

-   Transfer charges

-   POS charges

-   Commissions

-   FX settlement fees

-   Others (configurable)

### RPT-11: VAT on Bank Charges Report

Calculate:

-   VAT base

-   VAT rate

-   VAT posted

-   Remaining VAT discrepancies

### RPT-12: WHT on Customer Receipts (if applicable)

Show:

-   WHT deductions

-   Customer

-   Invoice affected

-   Tax impact

### 13.5 FX & MULTI-CURRENCY REPORTING

### RPT-13: FX Gain/Loss Report

Shows:

-   FX gain

-   FX loss

-   Per bank account

-   Per day

-   Per transaction type (AP, AR, FX conversion)

### RPT-14: Multi-Currency Settlement Summary

Report includes:

-   Foreign amount

-   Converted amount

-   Applied exchange rate

-   Bank rate

-   Difference

-   GL postings

### 13.6 POSTING & JOURNAL REPORTING

### RPT-15: GL Posting Summary

Shows:

-   Total DR

-   Total CR

-   Posting count

-   Posting failures

-   Suspense GL usage

### RPT-16: Posting Error Log

Shows:

-   Bank line

-   Error message from GL engine

-   User who attempted posting

-   Retry history

### RPT-17: Sub-Ledger Settlement Reports

Separate views:

-   AR Settlements

-   AP Settlements

-   Expense Reimbursements

-   Payroll Settlements

### 13.7 MATCHING & RECONCILIATION DETAIL REPORTS

### RPT-18: Matched Transactions Report

Shows:

-   Bank line

-   Mapped entity (invoice, vendor, expense, etc.)

-   Amount

-   Dimensions

-   Posting reference

### RPT-19: Unmatched Transactions Report

Shows:

-   Raw cleaned line

-   Reason they remain unmatched

-   Suggested next steps

### RPT-20: Partial Matches Report

Shows transactions matched to multiple items.

### 13.8 AUDIT AND COMPLIANCE REPORTING

### RPT-21: Compliance Checklist Report

Shows if tenant is compliant with:

-   Reconciliation timelines

-   Exception resolution

-   Suspense clearing

-   Required approvals

### RPT-22: Audit-Ready Reconciliation Pack

A downloadable pack containing:

1.  Cleaned statement

2.  Mapping

3.  Approved mapping

4.  GL postings

5.  Exception logs

6.  Suspense activity

7.  FX posting details

8.  Bank charges VAT schedule

9.  Approval history

10. Source PDF

### RPT-23: Cross-Module Audit Report

Shows any inconsistency between:

-   AR settlements

-   AP settlements

-   Payroll settlements

-   Expense settlements

-   Journal entries

### 13.9 EXPORT REQUIREMENTS

### RPT-24: Excel Export

All reports exportable to Excel with formatting preserved.

### RPT-25: PDF Export

Available for:

-   Audit pack

-   Monthly reconciliation summary

-   Exception reports

-   Posting summaries

### RPT-26: JSON/CSV Export

For integrations with:

-   Power BI

-   Tableau

-   Data warehouses

-   Tenant custom systems

### 13.10 ROLE-BASED DATA VISIBILITY (IN REPORTS)

### RPT-27: Role-Based Filtering

Payroll-sensitive amounts masked unless role allows.

### RPT-28: Tenant Admin Preview Mode

Tenant admin can see what each role sees.

### RPT-29: Auditor View

Auditors see:

-   Only approved mappings

-   Only selected periods

-   Masked sensitive details

**SECTION 14 --- OPEN QUESTIONS, FUTURE ENHANCEMENTS & EDGE CASES**

(Final section---captures everything that must be clarified, enhanced,
or implemented in Phase 2/3 of the module. This ensures engineering,
product, finance SMEs, and auditors know what is pending or optional.)

## 14.0 OPEN QUESTIONS, FUTURE ENHANCEMENTS & EDGE CASES

This module is extremely complex and deeply integrated with AR, AP,
Payroll, Expense, FX, Dimensions, Tax, and ERP systems.

Section 14 captures:

1.  Open questions

2.  Pending decisions

3.  Tenant-configurable choices

4.  Future enhancements

5.  Rare edge cases that must still be engineered correctly

This makes the PRD future-proof and transparent for all stakeholders.

### 14.1 OPEN QUESTIONS (TO BE CONFIRMED WITH TENANTS OR SUPER ADMIN)

These must be clarified for each tenant during onboarding or
configuration.

### OQ-1: Frequency of Reconciliation

-   Daily?

-   Weekly?

-   Monthly?

-   Per bank account?

-   Per currency?

Default assumption: Daily, but tenant must choose.

### OQ-2: Payroll Visibility

Should payroll payments be masked for:

-   All users except Finance Manager?

-   Only CFO?

-   Nobody (full visibility)?

(This is a legal and internal governance decision.)

### OQ-3: Approval Levels

Which approval workflow does the tenant want?

-   Officer → Manager

-   Officer → Manager → CFO

-   Officer → Manager → Treasury → CFO

-   Direct posting

### OQ-4: Suspense Account Rules

Tenant must define:

-   Maximum allowed suspense number of days

-   Allowed suspense GL codes

-   Mandatory explanations?

-   Suspense escalation path

### OQ-5: AI Usage Policy

Tenant must choose:

-   Allowed for all mappings?

-   Allowed only for AR/AP?

-   Not allowed for payroll?

-   Not allowed for sensitive items?

Super Admin can override per industry.

### OQ-6: Bank Fees Handling

Different banks use different narrations.

Tenant must confirm:

-   How to classify each charge?

-   Which GL receives them?

-   VAT treatment?

-   WHT applicability?

### OQ-7: FX Conversion Policy

Tenant must specify:

-   Use bank exchange rate?

-   Use tenant FX policy rate?

-   Use average monthly rate?

-   Use ERP FX rate?

This affects realized FX postings.

### OQ-8: POS / Gateway Settlement Handling

Does the tenant receive:

-   Direct POS settlement from banks?

-   Multi-day POS settlement files?

-   Gateway-operated POS?

This changes auto-matching rules.

### OQ-9: Duplicate Handling Policy

If a potential duplicate is flagged:

-   Should the system auto-block posting?

-   Allow override?

-   Require manager approval?

### OQ-10: Data Retention

How long should the tenant keep:

-   Original statements?

-   Cleaned statements?

-   Mapping logs?

-   Audit logs?

Local law may require 5--10 years.

### 14.2 FUTURE ENHANCEMENTS (POST MVP / PHASE 2)

These items are recommended for Phase 2 or Phase 3 and align with our
vision of world-class automation.

### FE-1: Direct Bank API Connections

Real-time API-based bank feeds.

-   Zenith

-   GTB

-   Access Bank

-   FirstBank

-   Standard Chartered

-   UBA

-   Euro/US banks (SEPA/Open Banking)

Would eliminate manual uploads.

### FE-2: Machine-Learning Categorization of Transactions

Beyond rule-based mapping, AI should learn:

-   Customer-specific patterns

-   Vendor-specific patterns

-   Seasonal patterns

-   POS settlement patterns

-   Payroll patterns

AI accuracy should reach > 97% after 3--6 months of training per
tenant.

### FE-3: Auto-Reconciliation of Book Transactions Before Bank Upload

System can anticipate matches even before bank statement is uploaded.

### FE-4: Automated Fraud Detection

Machine learning model to detect:

-   Suspicious inflows/outflows

-   Sudden value spikes

-   Unusual vendors

-   Hidden references

### FE-5: Auto-Reclassification of Old Suspense Items

System could automatically propose:

-   Matching to AR/AP items

-   Matching to GL entries

-   Splitting based on patterns

### FE-6: Real-Time Cash Forecasting (Integrates Into ZivaBI Treasury Module)

Using:

-   AR expected receipts

-   AP planned disbursements

-   Payroll schedule

-   POS settlement timing

-   FX maturity dates

### FE-7: Automated Bank Confirmation Letters

The system could generate:

-   Bank confirmation letters

-   Secure sign-off

-   Auditor-ready confirmations

### FE-8: AI-Driven Parsing Profiles

If a bank changes its format, AI will adjust automatically (no
reconfiguration needed).

### FE-9: API for Third-Party POS & Payment Gateways

Supported for:

-   Flutterwave

-   Paystack

-   Interswitch

-   Stripe

-   PayPal

-   Square

### FE-10: Multiple Approval Flows for High-Value Transactions

Different approval rules per bank account, region, or department.

### FE-11: "Auto-Clear" Rules for Small Transactions

Automatically classify:

-   Bank SMS fees

-   Small bank deductions

-   Error corrections

Threshold configurable.

### FE-12: Blockchain-Based Reconciliation Ledger

###  

### (future research)

For large multinational enterprises requiring:

-   Immutable proof of reconciliation

-   Multi-entity transparency

-   Zero audit disputes

### 14.3 EDGE CASES TO ENGINEER FOR (VERY IMPORTANT)

These are rare but must be accounted for to avoid reconciliation breaks.

### EC-1: Bank Statement With No Running Balance

System must still reconcile using:

-   Starting/ending balance logic

-   Summation checks

### EC-2: Same Amount Occurs Many Times

Must differentiate using:

-   Narration

-   Time stamps (if available)

-   Reference numbers

-   Sequence order

### EC-3: Negative Amount With Wrong Sign

Some banks put:

-   Debit as positive

-   Credit as positive

-   Or flip in different sections

User must be able to flip column signs.

### EC-4: FX Transactions Without Narration

System must detect based only on:

-   Amount

-   Currency

-   Counterbalancing line

### EC-5: Bank Reversal Entries

Common reversal types:

-   Reversal of duplicate debit

-   Reversal of POS failure

-   Reversal of NIP error

System must match them automatically.

### EC-6: Out-of-Order Lines

Bank statements sometimes appear unordered.

System must:

-   Reorder

-   Preserve original order (for auditors)

### EC-7: Bank Statements Spanning Two Business Days

For example:

-   11:59 pm → 00:01 am transactions merged in one row

System must not misclassify them.

### EC-8: Split Payroll Batches Across Multiple Bank Files

Some banks send:

-   Payroll debit slip

-   Detailed list separately

System must merge logically.

### EC-9: Customer Paid Into Wrong Bank Account

System must allow:

-   AR settlement via internal bank transfer

-   Cross-bank reconciliation

### EC-10: Same Statement Uploaded Twice But File Name Changes

Duplicate detection must rely on hash, not name.

### EC-11: Banks That Repeat Previous Lines Across Pages

OCR must detect repeated lines and remove them.

### EC-12: Very Large Statements With 50,000+ Rows

System must process in streaming mode with:

-   Chunking

-   Background jobs

-   Progressive UI updates
