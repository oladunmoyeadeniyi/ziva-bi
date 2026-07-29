# PAYROLL MANAGEMENT MODULE --- PRODUCT REQUIREMENTS DOCUMENT (PRD)

**SECTION 1 --- EXECUTIVE SUMMARY**

(High-level overview, fully aligned with your vision for ZivaBI as a
world-class, end-to-end finance automation ecosystem.)

## 1.0 INTRODUCTION

The Payroll Management Module is the central engine for all salary,
statutory, benefits, deductions, accruals, and payroll compliance
activities across any tenant using ZivaBI. It is designed to handle
simple, medium, and complex payroll operations across diverse
industries, and integrates seamlessly with:

-   Expense Management

-   Accounts Payable (AP)

-   Accounts Receivable (AR)

-   Bank Reconciliation

-   Vendor Portal

-   Employee Portal

-   GL / Chart of Accounts

-   Dimensions Engine

-   Tax Engine

-   3rd-party payroll consultants

This module is designed to replace manual spreadsheets, eliminate
errors, strengthen internal controls, accelerate payroll cycles, and
provide full transparency to management and auditors.

### 1.1 PURPOSE OF THE MODULE

The Payroll Module exists to provide:

### A. Accurate, fast, and auditable payroll computation

-   Calculate gross → net salaries automatically.

-   Compute statutory tax deductions.

-   Apply pension/NHF/NSITF and custom contributions.

-   Handle variable pay, commissions, allowances, bonuses.

-   Automatically prorate salaries for hires/resignations.

### B. Multi-source payroll workflow

-   In-house payroll calculation

-   Consultant-prepared payroll (upload & verify)

-   Hybrid mode --- ZivaBI computes payroll, consultant validates.

### C. Complete automation of payment & posting

-   Auto-generate payroll bank payment files.

-   Post payroll to GL with dimensions.

-   Generate payroll accruals & reversals.

-   Prevent duplicate/incorrect payments.

### D. A secure and private payroll environment

-   Hard RBAC separation from non-payroll modules.

-   Sensitive fields masked for unauthorized roles.

-   Employee self-service portal for personal payslips only.

### 1.2 STRATEGIC VALUE

This module helps tenant organizations achieve:

## 1. Elimination of manual payroll processing

No more spreadsheets, email approvals, or manual journal postings.

## 2. Enhanced compliance

Supports:

-   Local tax laws (PAYE, WHT, Pension, NHF, NSITF)

-   Multi-country statutory rules (configurable)

-   Year-end statutory reporting

## 3. Zero-error payroll

The system prevents:

-   Double payment

-   Excess salary

-   Duplicate employee records

-   Outdated contract terms

-   Incorrect proration

-   Wrong statutory calculations

## 4. Full transparency

Management gains:

-   Monthly payroll variance analysis

-   Employee-level breakdowns

-   Accrual/liability reporting

-   Trend and budget comparison

## 5. Reduced cost

No need for expensive payroll outsourcing unless tenant prefers
validation from consultants.

### 1.3 KEY FEATURES (EXECUTIVE SUMMARY)

**A. Payroll Computation Engine**

-   Gross salary calculator

-   Proration engine

-   Multi-country tax rules

-   Pension/NHF/NHIS rules

-   Overtime/bonus/shift/commission rules

-   Statutory tables dynamically updateable

-   Payroll formulas fully tenant-configurable

**B. Payroll Data Comparison Engine**

Industry-first innovation:

ZivaBI auto-compares:

-   Consultant payroll file

    vs.

-   Internal ZivaBI computed payroll

Comparison detects:

-   Variance in gross pay

-   Variance in deductions

-   Variance in taxes

-   Bank account differences

-   WHT and pension differences

-   Errors in consultant spreadsheets

This eliminates dependence on consultant spreadsheets and prevents
fraud.

**C. Employee Master Data Engine**

Supports:

-   Role

-   Grade/Level

-   Department/Unit

-   Bank details

-   Pension details

-   Salary structure

-   Allowances

-   Deductions

-   Joining & exit dates

-   Location & dimensions

-   Supervisor/manager relationship

-   Outsourced vs Permanent staff

Dynamic update approvals:

-   Salary change

-   Department change

-   Transfer

-   Promotion

-   Regrading

**D. Multi-Approval Payroll Workflow**

Configurable per tenant:

-   Payroll Officer → Payroll Manager → CFO

-   Payroll Officer → HR → CFO

-   HR → Payroll → Finance Director

-   HR alone (for small companies)

Approval gates also apply to:

-   Payroll drafts

-   Variance review

-   Payment files

-   GL postings

-   Statutory schedules

**E. Integration with Bank & Finance Systems**

-   Auto-generate payroll bank upload file

-   Auto-generate PAYE, Pension, NHF schedules

-   Auto-generate vendor payment request for outsourced staff

-   Send payroll transactions directly to Bank Reconciliation module

**F. Dimensions & GL Posting**

Every payroll transaction must flow to GL with full dimensions:

-   Cost center

-   Real IO

-   Statistical IO

-   Material IO (if applicable)

-   Location

-   Project/Contract

Examples:

-   Salary Expense

-   Employer Pension Liability

-   PAYE Payable

-   Pension Payable

-   NHF Payable

-   Outsourced Staff Expense

-   Management fee (for outsourced staff vendors)

**G. Employee Self-Service Portal**

Employees can:

-   Download monthly payslips

-   Download YTD report

-   Download annual tax report

-   View leave encashment status

-   View salaries and deductions history

-   Correct personal details (under approval)

**H. Outsourced Staff Management**

For service providers supplying contract/outsourced labour:

-   Vendor portal upload of monthly invoice

-   System auto-extracts:

    -   Staff list

    -   PAYE breakdown

    -   Salary components

    -   Vendor management fee

-   ZivaBI validates:

    -   Against expected staff list

    -   Against agreed rates

    -   Against previous month variances

-   Auto-creates AP invoice for vendor payment

**I. Payroll Accruals & Reversals**

End-of-month accrual:

-   Full salary expense

-   Employer contributions

-   Statutory liabilities

Automatically reversed in next period.

### 1.4 MODULE-SPECIFIC BENEFITS

### For Finance:

-   Accurate GL posting

-   Automatic bank payment file

-   Accruals automated

-   Variances detected

-   No manual journals

-   Statutory schedules ready instantly

### For HR:

-   Salary structure rules

-   Promotion and revision engine

-   Employee onboarding automation

-   Employee exit settlement wizard

### For Employees:

-   Secure payslips

-   Full payroll history

-   Zero dependency on HR to get documents

### For Auditors:

-   Immutable audit trail

-   Side-by-side payroll comparison

-   Automated checks

-   Salary mapping proof

-   Fraud prevention rules

### 1.5 OUT OF SCOPE (FOR NOW)

(Will come in future phases.)

-   Full HRMS (performance management, recruitment)

-   Loan management module (separate PRD)

-   Time & attendance/bio-metric integration (optional add-on)

-   Payroll budgeting & forecasting

**SECTION 2 --- PROBLEM STATEMENT & MODULE OBJECTIVES**

(Full depth, enterprise-grade, combining Payroll + Leave Management
under one integrated HR-Finance engine.)

## 2.0 PROBLEM STATEMENT

Payroll is one of the most sensitive, error-prone, and manually burdened
processes within any organization. Across the tenants you plan to serve,
payroll challenges typically include:

### 2.1 Manual, Error-Prone Salary Computations

Most organizations still rely heavily on:

-   Excel spreadsheets

-   Email-based workflow

-   Consultant-prepared payroll files

-   Manual prorations and adjustments

-   Manual statutory calculations

This leads to:

-   Miscalculations

-   Overpayments & underpayments

-   Inaccurate statutory deductions

-   Fraud vulnerabilities

-   High audit risk

-   Weak controls

### 2.2 Fragmented Payroll Data & Poor Version Control

Because payroll data is scattered across:

-   HR spreadsheets

-   Consultant files

-   Finance journals

-   Bank upload files

-   Employee personal emails

...it becomes nearly impossible to:

-   Reconcile payroll amounts

-   Detect discrepancies

-   Validate consultant output

-   Maintain reliable audit trails

-   Track historical changes

### 2.3 No Integration Between Payroll, Finance, and Leave

In traditional setups:

-   Leave balances are tracked manually

-   Leave encashment is not calculated automatically

-   Leave does not auto-adjust payroll

-   Payroll accruals are done separately

-   Leave and payroll operate in silos

This results in:

-   Incorrect proration of salary

-   Unpaid leave not deducted

-   Overpayment during employee exit

-   Incorrect leave liability accounting

### 2.4 Limited Payroll Access Control

Payroll contains highly sensitive information, yet most organizations
lack:

-   Proper role-based access control (RBAC)

-   Masking rules

-   Segregation of duties

-   Audit-level monitoring

-   Approval flows based on seniority

This leads to:

-   Confidentiality breaches

-   Fraud opportunities

-   Data exposure risks

### 2.5 Inefficient Consultant Payroll Validation

Where tenants use external payroll consultants:

-   Consultants may use outdated tax tables

-   Calculations differ from tenant's policies

-   No automated comparison exists

-   Validation is manual and error-prone

-   Discrepancies are often discovered late

Organizations need a system that can automatically:

-   Compute payroll internally

-   Compare consultant output

-   Highlight variances line-by-line

### 2.6 No Accurate Employee Master Data Governance

Employee master data is usually:

-   In spreadsheets

-   Held by HR alone

-   Missing key fields

-   Not updated promptly

-   Lacking approvals

-   Prone to manipulation

This causes:

-   Wrong salaries

-   Wrong allowances

-   Wrong tax calculations

-   Wrong pension/NHF deductions

### 2.7 Outsourced Staff Payroll Not Controlled

In organizations using outsourced/contract staff:

-   Vendor invoices are manually validated

-   Staff lists are manually cross-checked

-   Rates vary and often dispute-prone

-   WHT errors are common

-   Overbilling can go unnoticed

ZivaBI needs to automatically:

-   Validate vendor invoices

-   Match staff list

-   Apply agreed rates

-   Split salary vs vendor management fee

-   Auto-generate AP invoice for payment

### 2.8 Lack of Complete Payroll-to-GL Automation

Today, most organizations:

-   Prepare manual payroll journals

-   Forget to accrue payroll at month-end

-   Reverse accruals manually

-   Post incorrect amounts

-   Struggle to match payroll expense to GL

No complete automation exists that supports:

-   Dimensions (Real IO, Cost Center, Material IO, Location)

-   Multi-country compliance

-   Multi-company architecture

-   Multi-currency payroll

### 2.9 Inadequate Employee Self-Service Experience

Employees rely on HR for simple tasks:

-   Requesting payslips

-   Checking leave balance

-   Resolving salary queries

-   Updating personal info

-   Checking deduction history

This increases HR workload and delays.

### 2.10 No Comprehensive Leave Management Integration

Most organizations manage leave with:

-   Paper forms

-   Google Sheets

-   Email approvals

-   Manual monthly leave reports

This results in:

-   Wrong leave balances

-   Leave abuse

-   Inaccurate leave accruals

-   Delays in approvals

-   Reduced productivity visibility

Leave must be integrated with payroll, not external.

### 2.11 SUMMARY OF THE PROBLEM

Organizations need a payroll system that is:

-   Accurate

-   Automated

-   Auditable

-   Integrated

-   Configurable

-   Role-secure

-   Scalable

-   Fast

-   Analytical

-   Multi-tenant flexible

ZivaBI Payroll + Leave Management will solve all of these.

### 2.12 MODULE OBJECTIVES

Below are the core objectives that this module MUST achieve.

#### 2.12.1 Objective 1 --- Automate Payroll End-to-End

The module must:

-   Accept raw employee data

-   Calculate gross and net pay

-   Apply allowances & deductions

-   Compute statutory contributions

-   Handle payroll variations & exceptions

-   Generate GL postings

-   Generate bank files

-   Maintain audit logs

#### 2.12.2 Objective 2 --- Enable Dual Payroll Modes

Support:

### Mode A --- In-house payroll computation

ZivaBI computes payroll fully.

### Mode B --- Consultant-prepared payroll

Tenant uploads consultant file.

### Mode C --- Hybrid mode

System computes; consultant reviews.

#### 2.12.3 Objective 3 --- Guarantee Accuracy & Compliance

-   Auto-update statutory tables

-   Local tax and pension rules built-in

-   Ability for tenant to override rules

-   Support country-specific regulations

#### 2.12.4 Objective 4 --- Integrate Leave Management

-   Leave approval workflow

-   Leave calendar view

-   Leave balance auto-update

-   Payroll proration based on leave

-   Leave encashment

-   Leave accrual & carry-over

#### 2.12.5 Objective 5 --- Provide Full Employee Self-Service

Employees gain secure access to:

-   Payslips

-   YTD salary

-   Annual tax report

-   Leave balance

-   Leave application

-   Personal info update workflow

#### 2.12.6 Objective 6 --- Automate Payroll Accruals

System must:

-   Accrue monthly payroll

-   Recognize employer liabilities

-   Reverse accrual automatically

-   Prevent duplicate postings

#### 2.12.7 Objective 7 --- Support Outsourced Staff Payroll

System must:

-   Validate vendor staff list

-   Compare with expected roster

-   Auto-compute outsourced staff payroll

-   Apply management fee

-   Auto-create AP invoice

#### 2.12.8 Objective 8 --- Full Integration With Financial Modules

Links with:

-   AP (vendor payments)

-   AR (employee loan and salary deductions)

-   Expense module (travel advances)

-   Bank reconciliation

-   GL & Dimensions

#### 2.12.9 Objective 9 --- Provide Secure, Flexible Access Control

-   HR access limited

-   Finance access limited

-   Employee access strictly personal

-   Payroll managers & CFO get elevated rights

-   Masked views for non-payroll roles

#### 2.12.10 Objective 10 --- Support Multi-Company & Multi-Country Tenants

Each tenant can configure:

-   Payroll rules per company

-   Statutory settings per country

-   Separate or shared employee pools

-   Separate approval flows

**SECTION 3 --- SCOPE & OUT-OF-SCOPE**

(Full enterprise depth, precise boundaries, clear expectations for
engineering, HR, Finance, and Payroll teams.)

## 3.0 OVERVIEW

This section defines:

-   What is included in the Payroll + Leave module

-   What is excluded for now

-   What will be optional / tenant-configurable

-   What will be delivered in later phases

Precise scoping ensures predictable engineering timelines and avoids
scope creep.

### 3.1 IN-SCOPE (FULLY INCLUDED IN THE MODULE)

Everything listed here will be built, will be supported, and will be
configurable.

#### 3.1.1 Payroll Computation Engine

The system must support:

### A. Core Payroll Elements

-   Basic salary

-   Housing allowance

-   Transport allowance

-   Utility allowance

-   Meal allowance

-   Leave allowance

-   Bonus

-   Overtime

-   Shift allowance

-   Sales commissions

-   Productivity bonus

-   Hazard allowance

-   Special allowances (configurable)

### B. Statutory Deductions

-   PAYE

-   Pension employee contribution

-   Pension employer contribution

-   NHF

-   NSITF

-   Tax reliefs

-   Consolidated relief allowance (CRA)

-   National/local taxes (multi-country)

### C. Custom Deductions

-   Loans & advances

-   Salary advances

-   Union dues

-   Employee welfare

-   School fees loan

-   Asset purchase loan

-   Custom deduction formula

### D. Payroll Proration

Automatic proration for:

-   New joiners

-   Resignations

-   Suspensions

-   Unpaid leave

-   Partial-month leave

### E. Recurring & Non-Recurring Earnings

-   Recurring allowances

-   Partial payment allowances

-   One-time incentives

-   One-time deductions

Everything must be tenant-configurable.

#### 3.1.2 Leave Management System

Fully included:

### A. Leave Types

-   Annual leave

-   Sick leave

-   Maternity/Paternity

-   Casual leave

-   Unpaid leave

-   Study/Sabbatical

-   Compassionate leave

-   Administrative leave

-   Custom leave types

### B. Leave Rules Engine

-   Accrual method (monthly, yearly, lump-sum)

-   Carry-over rules with expiry

-   Maximum usage limits

-   Block leave vs flexible leave

-   Required documentation

-   Leave type impact on payroll (paid vs unpaid)

### C. Leave Workflows

-   Employee applies

-   Manager approves

-   HR validates (optional)

-   CFO approval (optional)

-   Automatic posting to payroll proration

-   Return-from-leave confirmation

-   Overstay alerts

### D. Leave Analytics

-   Department leave calendar

-   Leave usage trends

-   Accrued leave liability

-   Leave encashment insights

#### 3.1.3 Employee Master Data & Employee Lifecycle

Included:

### A. Employee Master Records

-   Personal information

-   Bank details

-   Tax details

-   Allowances & benefits

-   Job role / grade

-   Department

-   Cost center

-   Location

-   Dimensions (Real IO, Statistical IO, Material IO if needed)

### B. Employee Lifecycle

-   Onboarding

-   Promotion

-   Transfer

-   Salary review

-   Sabbatical / leave without pay

-   Resignation / termination

-   Exit/Final settlement (HR + Finance)

#### 3.1.4 Payroll Approval Workflows

Configurable workflows, including:

-   Payroll officer → Payroll manager

-   Payroll officer → HR → CFO

-   HR → Payroll → Finance Director

-   Direct approval (small companies)

-   Multi-level hierarchical routing

Workflows can differ by:

-   Company

-   Subsidiary

-   Employee category

-   Department

#### 3.1.5 External Consultant Integration

The system will allow:

### A. Uploading consultant-prepared payroll files

-   Excel, CSV

-   Custom mapping

-   Data validation

### B. Automatic comparison

System compares:

-   Gross

-   Net

-   Pension

-   PAYE

-   Allowances

-   Deductions

-   Bank details

-   FX salary adjustments

### C. Variance flagging with explanations

### D. Workflow for approval of consultant's file

#### 3.1.6 Outsourced Staff Payroll Support

Included:

-   Vendor staff list upload

-   Validation against master list

-   Rate validation

-   Vendor management fee calculation

-   WHT application on fee

-   AP invoice auto-generation

-   Dimensions assignment

-   Payroll reporting for outsourced employees

#### 3.1.7 Payroll-to-GL Full Automation

-   Multi-line GL postings

-   Dimensions applied automatically

-   Employer statutory liabilities

-   Employee deductions

-   Provisions/accruals

-   Accrual reversals

-   Country-specific GL mappings

#### 3.1.8 Employee Self-Service Portal

Included:

-   Payslip download

-   Leave application

-   Leave balance

-   Salary history

-   Update personal information (under approval)

-   View loan/advance balances

-   Access employment documents

#### 3.1.9 Payroll Bank Payment File Automation

System must generate files accepted by:

-   Local banks

-   International banks

-   Payroll gateways

-   Multi-currency payroll payment

-   Segregated payment channels (salary, statutory deductions)

Payment file formats configurable.

### 3.2 OUT OF SCOPE (FOR NOW, FUTURE MODULES)

These items will not be included in this payroll module version, but may
be part of future HR or Finance modules.

**❌** 

#### 3.2.1 Time & Attendance (Clock-in Devices)

-   Biometric integration

-   Timesheet capture

-   Overtime computation based on shift logs

-   Geo-location attendance

(May be added in future as an optional module.)

**❌** 

#### 3.2.2 Performance Management

-   KPIs

-   Appraisals

-   360° evaluations

-   Promotion recommendation engine

(Not part of payroll; HR module extension will handle this.)

**❌** 

#### 3.2.3 Recruitment Module

-   Job posts

-   Applicant tracking

-   Shortlisting workflow

-   Interview scheduling

-   Offer letter automation

**❌** 

#### 3.2.4 Loans & Asset Financing (Full Loan Module)

Although payroll will deduct loan repayments, a full loan module
(origination, amortization schedules, collateral, interest rates) is
excluded.

**❌** 

#### 3.2.5 Medical Insurance & Benefits Module

-   Medical claims

-   Insurance renewals

-   Benefit plan comparison

To be built separately.

**❌** 

#### 3.2.6 Payroll Budgeting Module

-   Manpower planning

-   Salary forecasting

-   Budget vs actual payroll

This becomes part of the Planning & Budgeting module later.

### 3.3 OPTIONAL / TENANT-CONFIGURABLE FEATURES

These features are included but may be toggled on/off.

#### 3.3.1 AI-Based Payroll Prediction

Optional: Predict next-month salary and variances.

#### 3.3.2 Employee Leave Encashment Module

(Optional: some tenants do not allow encashment.)

#### 3.3.3 Multi-Country Payroll Setups for One Tenant

Enabled only for enterprises.

#### 3.3.4 Payroll Delegation Rules

HR & Finance delegation while someone is on leave.

#### 3.3.5 Payroll Cost Allocation Across Dimensions

Where salary is split across:

-   Multiple projects

-   Multiple cost centers

-   Multiple locations

#### 3.3.6 Customized Pay Elements per Subsidiary

Some tenants will assign different payroll structures per affiliated
entity.

#### 3.3.7 Outsourced Payroll Mode

Tenant may disable internal payroll computation.

### 3.4 DELIVERABLES

The following will be delivered in the final module:

-   Full payroll engine

-   Full leave engine

-   Employee portal

-   HR portal

-   Payroll approval workflows

-   Consultant validation module

-   Outsourced staff validation module

-   GL posting automation

-   Payment file generator

-   Statutory schedules

-   Payroll analytics dashboards

-   Audit trail for payroll

-   Multi-company support

-   Multi-currency support

**SECTION 4 --- ACTORS, ROLES & ACCESS CONTROL MODEL**

(Deep, enterprise-grade role specification ensuring confidentiality,
separation of duties, and compliance with global payroll standards.)

## 4.0 OVERVIEW

Payroll is one of the most sensitive modules in ZivaBI.

To preserve confidentiality, eliminate fraud, and enable compliance, the
module requires a granular, role-based access control system (RBAC).

This section defines:

-   Actors (human or system entities)

-   Primary roles

-   Sub-roles

-   Permissions per role

-   Restrictions per role

-   Cross-module access logic

-   SOD (Segregation of Duties) enforcement

-   Tenant configuration flexibility

-   Audit and traceability requirements for each role

### 4.1 ACTOR LIST

The Payroll Module interacts with these actors:

### A. Internal Actors

1.  Employee (Self-service user)

2.  Line Manager / Supervisor

3.  HR Officer

4.  HR Manager

5.  Payroll Officer

6.  Payroll Manager

7.  Finance Officer

8.  Finance Manager

9.  CFO / Finance Director

10. System Administrator (Tenant Admin)

11. Super Admin (ZivaBI Owner) --- restricted access

12. Internal Auditor

13. External Auditor

### B. External Actors

1.  Payroll Consultant (External firm)

2.  Outsourced Staff Vendor

3.  Bank Systems (For payment files/API)

### 4.2 ROLE MATRIX (HIGH-LEVEL SUMMARY)

| Role | View Payroll | Edit Payroll | Approve Payroll | View Leave | Approve Leave | Manage Employees | View GL/Finance | View Sensitive Payroll | Upload Consultant File |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Employee | ✔ (own only) | ✖ | ✖ | ✔ (own) | ✖ | ✖ | ✖ | ✖ | ✖ |
| Supervisor | ✔ (team only) | ✖ | ✔ (team leave) | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| HR Officer | ✔ | ✔ | ✖ | ✔ | ✔ | ✔ | ✖ | Limited | ✔ |
| HR Manager | ✔ | ✔ | ✔ (HR approval) | ✔ | ✔ | ✔ | ✖ | Limited | ✔ |
| Payroll Officer | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ | ✔ | ✔ | ✔ |
| Payroll Manager | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ | ✔ | ✔ | ✔ |
| Finance Officer | ✔ | ✖ | ✖ | ✔ | ✖ | ✖ | ✔ | Limited | ✖ |
| Finance Manager | ✔ | ✖ | ✔ (finance-level) | ✔ | ✖ | ✖ | ✔ | Limited | ✖ |
| CFO | ✔ | ✖ | ✔ (final approval) | ✔ | ✖ | ✖ | ✔ | ✔ | ✖ |
| Tenant Admin | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ (config only) |
| Super Admin | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Internal Auditor | ✔ (read-only) | ✖ | ✖ | ✔ | ✖ | ✖ | ✔ | Masked view | ✖ |
| External Auditor | ✔ (strictly masked) | ✖ | ✖ | ✖ | ✖ | ✖ | Masked | Masked | ✖ |
| Consultant | ✔ (limited) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | Masked | ✔ |
| Outsourced Staff Vendor | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ (vendor staff upload only) |

### 4.3 ROLE DESCRIPTIONS & PERMISSIONS

Below are deep details of what each role is allowed and not allowed to
do.

#### 4.3.1 Employee

### Permissions

-   View own payslips (monthly, YTD)

-   View own tax reports

-   Apply for leave

-   Track leave approval status

-   View leave balance

-   Update personal information (under approval workflow)

-   View salary history

-   View loan/advance balances

### Restrictions

-   Cannot see other employees

-   Cannot see payroll computation

-   Cannot see GL or expenses

-   Cannot see outsourced staff data

#### 4.3.2 Supervisor / Line Manager

### Permissions

-   Approve/reject leave for direct reports

-   View team leave calendar

-   View team leave balances

-   View team basic payroll summaries (optional tenant configuration)

    -   Salary figure masked by default

### Restrictions

-   Cannot see detailed payroll breakdown

-   Cannot modify employee data

-   Cannot approve payroll

#### 4.3.3 HR Officer

### Permissions

-   Maintain employee master data

-   Approve employee information changes

-   Manage leave policies

-   Manage leave accruals

-   Manage leave encashment rules

-   Upload consultant payroll draft

-   View payroll components (but sensitive values masked if tenant
    restricts)

-   Trigger payroll computation (optional)

-   Manage employee onboarding/offboarding

### Restrictions

-   Cannot approve payroll payments

-   Cannot post to GL

-   Limited access to salary amounts (tenant-configurable)

#### 4.3.4 HR Manager

### Permissions

-   All HR Officer permissions

-   Full view of employee salaries

-   Approve consultant payroll file

-   Approve leave encashment

-   Approve salary changes

-   Approve special allowances

-   Approve off-cycle payroll

-   Override leave decisions

### Restrictions

-   Cannot approve payroll payment files directly (Finance must approve)

#### 4.3.5 Payroll Officer

### Permissions

-   View full payroll (unmasked)

-   Build payroll batches

-   Input variable earnings/deductions

-   Validate consultant payroll file

-   Resolve payroll exceptions

-   Run payroll draft computation

-   Prepare statutory schedules:

    -   PAYE

    -   Pension

    -   NHF

    -   NSITF

### Restrictions

-   Cannot approve final payroll

-   Cannot approve payment

-   Cannot override GL mappings

#### 4.3.6 Payroll Manager

### Permissions

-   Review payroll draft

-   Approve payroll draft

-   Approve statutory schedules

-   Unlock payroll period

-   Override computation exceptions

-   Approve payroll adjustments

### Restrictions

-   Cannot post to GL or approve payment (Finance only)

#### 4.3.7 Finance Officer

### Permissions

-   View final payroll summary

-   Generate payroll payment file

-   Validate payroll posting totals

-   Generate payroll-to-GL entries

### Restrictions

-   Cannot edit payroll

-   Cannot approve payroll

-   Cannot adjust salaries

-   Cannot edit employee master data

#### 4.3.8 Finance Manager

### Permissions

-   Approve payroll payment file

-   Approve payroll postings

-   Approve GL journals

-   Approve statutory remittance payments

### Restrictions

-   Cannot modify payroll computations

#### 4.3.9 CFO / Finance Director

### Permissions

-   Final approval of payroll

-   Final approval of payment file

-   Final approval of GL postings

-   Approve high-value salaries

-   Approve exceptional off-cycle payroll runs

-   Override statutory payment decisions

### Restrictions

-   Cannot modify payroll inputs (Segregation of Duties)

#### 4.3.10 Tenant Admin (System Admin)

### Permissions

-   Configure payroll settings

-   Configure leave policies

-   Configure salary structure templates

-   Configure approval workflows

-   Configure statutory values & tables

-   Configure user roles

### Restrictions

-   Cannot see payroll data

-   Cannot approve payroll

-   Cannot see payslips

-   Cannot edit employee salaries

#### 4.3.11 Super Admin (ZivaBI Owner)

### Permissions

-   System health monitoring

-   Tenant onboarding

-   Module activation/deactivation

-   Billing

### Restrictions

-   Cannot view any payroll data

-   Cannot view employee details

-   Cannot download payroll reports

-   Cannot override tenant approvals

This enforces absolute tenant data privacy.

#### 4.3.12 Internal Auditor

### Permissions

-   Read-only access to payroll summary

-   Read-only access to:

    -   Payroll runs

    -   Changes made

    -   Approval trail

    -   GL postings

### Masked fields

-   Employee name (optional masking)

-   Bank account numbers

-   Sensitive allowances

#### 4.3.13 External Auditor

### Permissions

-   Read-only access to selected periods

-   View payroll summary (high level)

-   Download payroll audit pack

### Restrictions

-   Cannot see individual employee salaries (masked)

-   Cannot see bank account numbers

-   Cannot access employee personal details

### 4.4 SEGREGATION OF DUTIES (MANDATORY)

The following SOD rules must be enforced:

### SOD-1: No single person can prepare, approve, and pay payroll

-   Payroll Officer prepares

-   Payroll Manager/HR Manager approves

-   CFO/Finance Director approves payment

-   Finance Officer processes payment

### SOD-2: Employee who creates payroll batch cannot approve it

### SOD-3: HR cannot approve payroll payments

### SOD-4: Finance cannot modify payroll computation

### SOD-5: Consultant cannot view sensitive data beyond what tenant allows

### SOD-6: No one can modify payroll after CFO final approval

### 4.5 PAYROLL ACCESS LEVELS (MASKING & PARTIAL VISIBILITY)

### Masking Rules

Fields subject to masking:

-   Basic salary

-   Net salary

-   Bank account numbers

-   Pension details

-   Tax IDs

Masking can be:

-   Fully masked

-   Partially masked

-   Visible only to designated roles

**SECTION 5 --- HIGH-LEVEL WORKFLOWS**

(End-to-end process maps, engineered for automation, auditability, and
tenant configurability.)

This section describes all major workflows in the Payroll + Leave
Management Module.

Each workflow is designed for:

-   Full automation

-   Multi-level approval

-   Segregation of Duties (SoD)

-   Integration with Finance, HR, Bank Reconciliation, AP, AR

-   Multi-tenant policy variations

-   Compliance & traceability

## 5.0 WORKFLOW MAP OVERVIEW

The Payroll Module consists of eight major workflows:

1.  Employee Master Data Lifecycle Workflow

2.  Leave Management Workflow

3.  Payroll Computation Workflow

4.  Consultant Payroll Upload & Comparison Workflow

5.  Payroll Review & Approval Workflow

6.  Payroll Payment Workflow

7.  Payroll GL Posting Workflow

8.  Outsourced Staff Payroll Workflow

Each is detailed below.

### 5.1 WORKFLOW 1 --- EMPLOYEE MASTER DATA LIFECYCLE

This workflow defines how employee information enters and evolves within
the system.

### Step 1 --- HR Creates New Employee (Onboarding)

HR captures:

-   Name

-   Address

-   Designation

-   Department

-   Cost center

-   Bank details

-   Tax ID

-   Salary structure

-   Allowances

-   Pension/NHF details

-   Dimensions (Real IO, etc.)

-   Employment type (Permanent vs Outsourced)

-   Leave eligibility

System automatically:

-   Assigns employee ID

-   Generates portal login

-   Notifies employee

### Step 2 --- Approval (Optional per tenant)

Approval chain may be:

HR Officer → HR Manager → Payroll Manager → CFO (optional)

### Step 3 --- Employee Edits Personal Info (Self-Service)

Employee can request updates:

-   Address

-   Next-of-kin

-   Bank details

-   Contact information

Changes go through:

Employee → HR Officer → HR Manager → (Optional: Payroll Manager)

### Step 4 --- Salary Review Workflow

Triggered by:

-   Promotion

-   Role transfer

-   Market adjustment

-   Annual increment

-   Performance review

Workflow:

HR Officer → HR Manager → CFO → Payroll Manager

System automatically:

-   Recalculates payroll

-   Prorates salary (if mid-month)

-   Updates GL mappings

### Step 5 --- Transfer / Department Change

Triggers:

-   Change in cost center

-   Change in location

-   Change in Real IO

System updates:

-   Dimensions

-   Leave approver hierarchy

-   Reporting line

### Step 6 --- Exit/Resignation Workflow

HR enters exit details:

-   Resignation/Termination date

-   Accrued leave payout

-   Unpaid leave deduction

-   Final prorated salary

-   Loans outstanding

-   Unreturned company assets (future FA module integration)

Workflow:

HR Officer → HR Manager → Payroll Manager → Finance Manager → CFO

System automatically calculates:

-   Final salary

-   Leave encashment

-   Pension

-   PAYE

-   Deductions

-   Employer liabilities

Final settlement is stored permanently.

### 5.2 WORKFLOW 2 --- LEAVE MANAGEMENT

This workflow handles all leave-related activities.

### Step 1 --- Employee Applies for Leave

Employee selects:

-   Leave type

-   Start/end date

-   Reason

-   Uploads document (medical, funeral, etc.)

System checks:

-   Eligibility

-   Balance

-   Blackout periods

-   Team conflicts

-   Public holidays

-   Required documentation

If any violation → notify employee.

### Step 2 --- Manager-Level Approval

Line Manager sees:

-   Employee leave balance

-   Team calendar

-   Impact on operations

-   Conflicting leaves

Manager approves/rejects.

### Step 3 --- HR Validation (Optional per tenant)

HR ensures:

-   Leave type rules applied

-   Documentation is valid

-   Leave interlocks (e.g., maternity leave rules)

-   Leave accrual consumption

HR approves/rejects.

### Step 4 --- Leave Applied Successfully

System updates:

-   Leave ledger

-   Leave balance

-   Leave calendar

Leave appears in team calendar as pending → approved.

### Step 5 --- Integration With Payroll

System automatically:

-   Applies proration if unpaid leave

-   Applies salary deductions

-   Applies leave encashment

-   Updates leave liability

### Step 6 --- Return From Leave

Employee confirms resumption (self-service).

Manager verifies.

System triggers:

-   Back-to-work confirmation

-   Overstay penalty workflow if needed

### 5.3 WORKFLOW 3 --- PAYROLL COMPUTATION WORKFLOW

This is the core payroll process.

### Step 1 --- HR/Payroll Officer Initiates Payroll Run

Inputs required:

-   Salary structure

-   Allowances

-   Deductions

-   Loan repayments

-   Overtime

-   Leave impacts

-   Bonuses

System loads:

-   All active employees

-   Updated master data

-   Approved variable components

### Step 2 --- System Automatically Computes Payroll

Includes:

-   Basic salary

-   Prorated salary

-   All allowances

-   Statutory deductions

-   Pension (employee/employer)

-   NHF

-   NSITF

-   PAYE

-   Net salary

System applies:

-   Tax tables

-   Statutory ceilings

-   Per-country formulas

-   Custom tenant formulas

### Step 3 --- Validation & Exception Detection

System detects:

-   Variance to previous month

-   Excess allowances

-   Zero pension contributions

-   Salary below legal minimum

-   Suspended employees

-   Employees with no bank details

-   Duplicate pay elements

-   Missing dimensions

Exceptions must be resolved before next step.

### Step 4 --- Payroll Draft Ready

Payroll Officer reviews before submitting to Payroll Manager.

### 5.4 WORKFLOW 4 --- CONSULTANT PAYROLL UPLOAD & COMPARISON

Where tenants use external payroll consultants.

### Step 1 --- Consultant Uploads Payroll File

File may contain:

-   Basic salary

-   Allowances

-   Deductions

-   Pension

-   PAYE

-   Bank details

-   Net salary

System supports:

-   Excel

-   CSV

-   XML

-   Custom templates

### Step 2 --- AI-Assisted Parsing & Normalization

System:

-   Reads consultant file

-   Maps fields

-   Detects missing columns

-   Validates numeric accuracy

### Step 3 --- Automatic Comparison Engine

System compares:

| Component | ZivaBI Calculation | Consultant Value | Difference |
| --- | --- | --- | --- |
| BASIC SALARY | Computed | Consultant | ✔/✖ |
| ALLOWANCES | Computed | Consultant | ✔/✖ |
| PAYE | Computed tax | Consultant | ✔/✖ |
| PENSION | Based on rules | Consultant | ✔/✖ |
| NET PAY | Generated | Consultant | ✔/✖ |

Highlighted variances:

-   Red → Major variance

-   Yellow → Minor difference

-   Green → Perfect match

Payroll Manager must review before approval.

### 5.5 WORKFLOW 5 --- PAYROLL REVIEW & APPROVAL

### Step 1 --- Payroll Officer Submits Payroll Draft

Locks draft to prevent changes.

### Step 2 --- Payroll Manager Review

Sees:

-   Salary totals

-   Statutory totals

-   Variance report

-   Leave impact summary

-   Consultant differences (if applicable)

-   Suspicious item flags

Payroll Manager can:

-   Approve

-   Reject

-   Comment

-   Request rework

### Step 3 --- Finance Manager Review

Sees:

-   Final payroll

-   GL impact

-   Total bank payment

-   Total statutory liabilities

-   Dimensions

Finance Manager approves.

### Step 4 --- CFO Final Approval

CFO sees:

-   Summary-level payroll

-   Key variances

-   Statutory breakdown

-   Payment file preview

CFO approves and releases payroll.

### 5.6 WORKFLOW 6 --- PAYROLL PAYMENT WORKFLOW

### Step 1 --- Finance Officer Generates Payment File

System generates:

-   Bank upload file

-   Employee payment list

-   Statutory payment list

Formats per bank:

-   CSV

-   TXT

-   XML

-   NACHA

-   ISO 20022 (for modern banks)

### Step 2 --- Finance Manager Approves Payment File

Checks for:

-   Duplication

-   Suspicious payments

-   High-value payments

-   Payroll alignment

### Step 3 --- CFO Approves Payment Release

Final approval.

### Step 4 --- System Sends File to Bank

Either:

-   User uploads manually

-   OR

-   API integration (if tenant's bank supports)

### Step 5 --- Confirmation Returned

Bank reconciliation module receives:

-   Debit confirmation

-   Per-employee payment status

### 5.7 WORKFLOW 7 --- PAYROLL GL POSTING WORKFLOW

### Step 1 --- System Auto-Generates GL Entries

For:

-   Salary expense

-   Employer liabilities

-   PAYE

-   Pension

-   NHF

-   NSITF

-   Leave liability

-   Leave encashment

-   Deductions

-   Accrual reversals

Each line has dimensions attached.

### Step 2 --- Finance Officer Reviews & Submits

Checks:

-   Totals

-   Dimensions

-   GL validity

### Step 3 --- Finance Manager Approves GL Posting

Ensures:

-   No doubled posting

-   No missing liability

-   Correct period

### Step 4 --- System Posts to GL

### 5.8 WORKFLOW 8 --- OUTSOURCED STAFF PAYROLL

### Step 1 --- Vendor Uploads Outsourced Staff List/Invoice

Includes:

-   Staff names

-   Rate per staff

-   Salary components

-   Management fee

-   WHT

-   PAYE (optional)

### Step 2 --- System Validates

Checks:

-   Staff exist on approved roster

-   Rates match contract

-   New staff flagged

-   Removed staff flagged

-   Differences in rate detected

-   Variance to last month

### Step 3 --- Auto-Split Vendor Invoice

System separates:

-   Staff salaries

-   Vendor management fee

-   WHT base

-   Statutory deductions

### Step 4 --- Auto-Create AP Invoice

System passes:

-   Debit Outsourced Labour Expense

-   Debit Employer liabilities

-   Credit Vendor Payables

### Step 5 --- Vendor paid via AP workflow

Integrated with AP PRD.

**SECTION 6 --- DETAILED BUSINESS RULES**

(This is one of the most important sections of the PRD. These rules
govern how payroll, leave, deductions, dimensions, postings, approvals,
and validations must behave for every tenant.)

These rules are strict, configurable, traceable, and audit-ready,
ensuring the Payroll + Leave Management Module meets the standards of:

-   IFRS

-   GAAP

-   Local statutory requirements

-   Payroll best practices

-   HR governance

-   Internal audit & external audit expectations

## 6.0 OVERVIEW

Business Rules define how the system must behave when processing:

-   Payroll

-   Leave

-   Employment lifecycle events

-   Statutory deductions

-   Accruals

-   GL postings

-   Consultant comparisons

-   Outsourced payroll

-   Dimensions

-   Permissions

-   Data validation

These rules are mandatory unless a tenant explicitly changes them
through Tenant Configuration.

Below is the complete, enterprise-level set.

### 6.1 EMPLOYEE MASTER DATA RULES

### BR-1: Employee Master Record Must Have Minimum Data Elements

Mandatory fields:

-   Employee ID (system-generated)

-   First/Last name

-   Employment type (permanent, contract, outsourced)

-   Bank account details

-   Salary structure

-   Tax ID

-   Pension details

-   Department & cost center

-   Dimensions (based on tenant rules)

-   Employment start date

### BR-2: Master Data Updates Require Approval Workflow

All sensitive updates must go through approval:

-   Bank details → HR + Payroll approval

-   Salary changes → HR → Payroll → CFO

-   Department change → HR → Payroll Manager

-   Promotion → HR → CFO

-   Exit → HR → Payroll → Finance → CFO

### BR-3: Effective Date Rule

All changes take effect:

-   On the specified effective date

-   Backdated changes must be flagged and approved

-   Future-dated changes must auto-trigger on that date

### BR-4: Employee Cannot Edit Payroll-Sensitive Fields

Employees can only request updates to:

-   Personal information

-   Address

-   Next-of-kin

Payroll-sensitive fields require HR action.

### 6.2 SALARY STRUCTURE RULES

### BR-5: Salary Components Must Be Configurable

Tenant may define:

-   Basic

-   Housing

-   Transport

-   Utility

-   Meal

-   Leave allowance

-   13th month

-   Bonus

-   Shift allowance

-   Sales commission

-   Custom allowances

### BR-6: Taxable vs Non-Taxable Components

Tenant must configure:

-   Tax-free allowances

-   Taxable allowances

-   Taxable benefits

-   Fringe benefits

-   Non-taxable reimbursements

System must automatically:

-   Apply correct statutory treatment

-   Validate amounts against statutory limits

### BR-7: Salary Review Rule

When salary increases:

-   Pro-rated salary for current month

-   Tax recalculated

-   Pension recalculated

-   Leave accrual recalculated

Old salary may still apply for previous closed periods.

### 6.3 STATUTORY DEDUCTIONS RULES

### BR-8: Statutory Calculations Must Be Fully Automated

System must calculate:

-   PAYE

-   Pension (employee + employer)

-   NHF

-   NSITF

-   Local taxes (multi-country)

### BR-9: Statutory Tables Must Be Configurable

Tenant can modify:

-   Tax bands

-   Pension ceilings

-   Exemptions

-   Allowable deductions

-   Custom statutory codes

### BR-10: CRA (Consolidated Relief Allowance) Must Be Auto-Applied

System must apply statutory reliefs automatically.

### BR-11: Over-Deduction Prevention

System must:

-   Prevent deduction exceeding salary

-   Prevent deduction above statutory ceilings

### 6.4 PAYROLL PRORATION RULES

### BR-12: Proration Based on Tenant Policy

Proration methods:

-   Calendar days

-   Work days

-   Fixed proration (tenant-defined)

### BR-13: Proration Applies To

-   New joiners

-   Resignations

-   Unpaid leave

-   Suspensions

-   Mid-month salary changes

### BR-14: Leave-Based Proration

Unpaid leave always triggers proration.

Paid leave does NOT reduce salary.

### 6.5 LEAVE MANAGEMENT RULES

### BR-15: Leave Accrual Rules

Leave may accrue:

-   Monthly

-   Yearly

-   Lump-sum at start of year

-   Based on grade/level

### BR-16: Leave Balance Must Be Enforced

System must prevent:

-   Negative leave balance (unless allowed)

-   Leave above entitlement

-   Overlapping leave applications

### BR-17: Leave Approval Rules

Approver must be:

-   Employee's supervisor

-   Manager

-   HR Manager (optional)

-   CFO for special leave

### BR-18: Leave Encashment Rules

Encashment only allowed if tenant enables.

Rules include:

-   Max encashable days

-   Encashment formula

-   Approval required

### BR-19: Overstay Rule

If employee does not resume on expected date:

-   System flags overstay

-   Applies salary deduction

-   Notifies supervisor & HR

### 6.6 PAYROLL COMPUTATION RULES

### BR-20: Payroll Run Locked After Submission

Once Payroll Officer submits payroll draft:

-   No changes to inputs

-   No employee edits

-   No HR edits

Until payroll is rejected.

### BR-21: Payroll Exceptions Must Be Resolved

Cannot submit payroll for approval if:

-   Employee has no bank details

-   Pension details missing

-   Tax ID missing

-   Negative net pay

-   Duplicate allowances

-   Leave without pay not applied

### BR-22: Negative Net Pay Rule

System must display:

-   Warning

-   List of offending deductions

-   Suggest correction

Approval cannot proceed unless corrected.

### BR-23: Multi-Currency Payroll Rule

If employee is paid in:

-   Local currency → standard rules

-   FX currency → system must apply:

    -   FX conversion

    -   FX rate validation

    -   FX impact posting

### 6.7 CONSULTANT PAYROLL COMPARISON RULES

### BR-24: Consultant File Must Meet Required Structure

File must contain:

-   Salary components

-   Deductions

-   Bank details

-   Employee ID

-   Pension/PAYE details

### BR-25: Comparison Done Per Employee

System must compare:

-   Gross salary

-   Allowances

-   Deductions

-   PAYE

-   Pension

-   NHF

-   Net salary

### BR-26: Variances Must Be Highlighted

Significant variance threshold configurable.

Examples:

-   ₦1,000 difference triggers Minor Alert

-   ₦5,000 triggers Major Alert

-   ₦25,000 triggers High-Risk Alert

### BR-27: Consultant Payroll Cannot Be Approved Until Variances Resolved

### 6.8 PAYROLL APPROVAL RULES

### BR-28: Approval Must Follow Multi-Level Workflow

Levels:

-   Payroll Officer → Payroll Manager

-   Payroll Manager → Finance Manager

-   Finance Manager → CFO

### BR-29: No User Can Approve Their Own Work

System prevents self-approval.

### BR-30: Payroll Cannot Be Approved If Exceptions Exist

Cannot proceed with:

-   Unresolved differences

-   Negative net pays

-   Missing dimensions

-   Missing bank details

-   Suspended employees included

-   Duplicate staff entries

### 6.9 PAYROLL PAYMENT RULES

### BR-31: Payment File Must Include All Necessary Banking Fields

-   Bank name

-   Account number

-   Branch code

-   Net salary

-   Reference

-   Employee name

-   Narration

### BR-32: Duplicate Payment Prevention

System checks:

-   Previous month salary payments

-   Same-month payment attempts

-   Duplicate bank references

### BR-33: Statutory Payments Must Be Separated

-   PAYE → Tax authority vendor

-   Pension → Pension vendor

-   NHF → Housing fund authority

Each must generate its own AP request.

### 6.10 GL POSTING RULES

### BR-34: Payroll Must Generate Multi-Line Journals

Mandatory postings:

-   Salary expense

-   Employer pension

-   Payroll accruals

-   PAYE liability

-   Pension liability

-   NHF liability

-   NSITF liability

-   Leave liability

-   Encashment posting

### BR-35: Dimensions Must Be Enforced

Based on tenant settings:

-   Real IO

-   Cost Center IO

-   Material IO (if applicable)

-   Location

-   Project

If dimension missing → block posting.

### BR-36: Accrual Reversal Rule

System must reverse payroll accrual at start of next month.

### 6.11 OUTSOURCED STAFF RULES

### BR-37: Vendor List Must Match Approved Roster

System flags:

-   Extra names

-   Missing names

-   Changed rates

-   Changed roles

### BR-38: Vendor Management Fee Treated Separately

-   Fee subjected to WHT

-   Staff salaries NOT subjected to WHT

-   Fee and salary must be separated in AP invoice

### BR-39: Outsourced Staff Included in Payroll Reports

But treated separately from permanent staff.

### 6.12 LEAVE ACCRUAL & LIABILITY RULES

### BR-40: Monthly Leave Accrual Rule

e.g. 1.75 days per month (tenant-configurable)

### BR-41: Leave Liability Posting

Leave days * average daily salary = leave liability.

### BR-42: Carry-Over Rule

-   Days carried over must expire if tenant sets expiry

-   Expired days must be reversed from leave ledger

### 6.13 DIMENSIONS & MAPPING RULES

### BR-43: Dimension Assignment Rule

For payroll transactions:

-   Salary → cost center + Real IO

-   Bonus → Real IO

-   Pension liability → location dimension

-   Leave liability → cost center

Tenant can customize rules.

### 6.14 AUDIT & COMPLIANCE RULES

### BR-44: Payroll Logs Immutable

Including:

-   Computation version

-   Approvals

-   Rejections

-   Variance corrections

-   Consultant comparisons

### BR-45: Sensitive Fields Masked for Unauthorized Roles

### 6.15 ERROR HANDLING RULES

### BR-46: System Must Catch All Payroll Anomalies

Including:

-   Salary < legal minimum wage

-   Zero PAYE for taxable salaries

-   Pension below statutory rules

-   Unapproved allowances

-   Unapproved deductions

**SECTION 7 --- DATA MODEL (ENTITY DEFINITIONS & RELATIONSHIPS)**

(Deep, enterprise-grade, future-proof relational model for Payroll +
Leave + Outsourced Staff + Dimensions + Statutory + Consultant
Integration.)

The Data Model in this section defines:

-   All core entities

-   Their attributes/fields

-   Their relationships

-   Validation constraints

-   Behavioral rules

-   Integration roles

Only a small number of payroll systems in the world define this level of
structure; this is ERP-level design, aligned with SAP HCM, Workday,
Oracle HRMS, ADP, Sage X3, and top-tier audit requirements.

## 7.0 DATA MODEL OVERVIEW

The Payroll Data Model consists of 15 core entities:

1.  Employee

2.  Employment Contract

3.  Salary Structure

4.  Payroll Element

5.  Payroll Run

6.  Payroll Result

7.  Statutory Configuration

8.  Leave Ledger

9.  Leave Application

10. Leave Type

11. Outsourced Staff Roster

12. Outsourced Staff Invoice

13. Vendor Management Fee

14. Consultant Payroll File

15. Payroll GL Posting Set

16. Payroll Dimension Mapping Configuration

17. Payroll Variance Log

18. Employee Bank Information

19. Employee Exit/Final Settlement

Each entity and relationship is defined below.

### 7.1 ENTITY 1 --- EMPLOYEE

### Purpose:

Represents each staff member (permanent, contract, or outsourced).

### Key Attributes:

| Field | Type | Description |
| --- | --- | --- |
| employee_id | UUID | Primary key |
| first_name | String | Required |
| last_name | String | Required |
| middle_name | String | Optional |
| employment_type | Enum | Permanent / Contract / Outsourced |
| grade | String | Level or grade |
| department_id | FK | Department/Cost Center |
| job_title | String | Role |
| start_date | Date | Employment start |
| exit_date | Date | Null if active |
| tax_id | String | National tax ID |
| pension_number | String | RSA PIN or local equivalent |
| nhf_number | String | Housing fund ID |
| bank_id | FK | Bank reference |
| bank_account | String | Full or masked |

### Relationships:

-   1 → Many with Employment Contract

-   1 → Many with Payroll Result

-   1 → Many with Leave Ledger

-   1 → Many with Leave Applications

-   1 → 1 with Employee Bank Information

-   1 → Many with Variance Logs

-   1 → Many with Payroll Deductions

### 7.2 ENTITY 2 --- EMPLOYMENT CONTRACT

Represents the employee's terms of employment.

### Key Attributes

| Field | Type | Description |
| --- | --- | --- |
| contract_id | UUID | Primary key |
| employee_id | FK | Linked to Employee |
| contract_type | Enum | Full-time / Part-time / Contract |
| contract_start | Date | Start date |
| contract_end | Date | End date (if any) |
| salary_structure_id | FK | Salary structure template |
| pension_applicable | Boolean | Yes/No |
| pay_currency | Currency | NGN, USD, EUR, etc. |
| dimension_default | FK | Real IO / Cost Center |

### 7.3 ENTITY 3 --- SALARY STRUCTURE

Defines all pay components for an employee.

### Key Attributes:

| Field | Type |
| --- | --- |
| structure_id | UUID |
| employee_id | FK |
| basic_salary | Decimal |
| housing_allowance | Decimal |
| transport_allowance | Decimal |
| utility_allowance | Decimal |
| meal_allowance | Decimal |
| leave_allowance | Decimal |
| pensionable_salary | Decimal |
| taxable_salary | Decimal |
| recurring_allowances | JSON |
| recurring_deductions | JSON |

### 7.4 ENTITY 4 --- PAYROLL ELEMENT

A standardized list of all salary components.

### Example Elements:

-   BASIC

-   HOUSING

-   TRANSPORT

-   PENSION_EMPLOYEE

-   PENSION_EMPLOYER

-   PAYE

-   NHF

-   NSITF

-   LOAN_REPAYMENT

-   COMMISSION

-   BONUS

-   OVERTIME

-   SHIFT_ALLOWANCE

-   LEAVE_ENCASHMENT

-   UNPAID_LEAVE_DEDUCTION

Tenant can add custom elements.

### 7.5 ENTITY 5 --- PAYROLL RUN

Represents a single payroll cycle.

### Attributes:

| Field | Type |
| --- | --- |
| run_id | UUID |
| period_start | Date |
| period_end | Date |
| run_type | Enum (Regular, Off-cycle, Bonus) |
| status | Enum (Draft, Submitted, Approved, Paid, Posted) |
| initiated_by | FK (User ID) |
| approved_by | FK (User ID) |
| cfo_approved_by | FK (User ID) |
| consultant_mode | Boolean |

### 7.6 ENTITY 6 --- PAYROLL RESULT

Stores the computed payroll per employee.

### Attributes:

| Field | Type |
| --- | --- |
| result_id | UUID |
| run_id | FK |
| employee_id | FK |
| gross_pay | Decimal |
| total_allowances | Decimal |
| total_deductions | Decimal |
| net_pay | Decimal |
| pay_currency | Currency |
| fx_rate_applied | Decimal |
| leave_deduction | Decimal |
| leave_encashment | Decimal |
| pension_employee | Decimal |
| pension_employer | Decimal |
| paye | Decimal |
| nhf | Decimal |
| taxable_income | Decimal |
| dimension_set | JSON |

### 7.7 ENTITY 7 --- STATUTORY CONFIGURATION

Configurable per tenant, per country.

### Attributes:

| Rule | Type |
| --- | --- |
| tax_bands | JSON |
| pension_rate_employee | Decimal |
| pension_rate_employer | Decimal |
| nhf_rate | Decimal |
| nsitf_rate | Decimal |
| statutory_ceiling | JSON |
| local_tax_rules | JSON |

### 7.8 ENTITY 8 --- LEAVE LEDGER

Tracks leave balances.

### Attributes:

| Field | Type |
| --- | --- |
| ledger_id | UUID |
| employee_id | FK |
| leave_type_id | FK |
| accrued_days | Decimal |
| used_days | Decimal |
| carry_over_days | Decimal |
| expired_days | Decimal |
| remaining_days | Decimal |

### 7.9 ENTITY 9 --- LEAVE APPLICATION

### Attributes:

| Field | Type |
| --- | --- |
| application_id | UUID |
| employee_id | FK |
| leave_type_id | FK |
| start_date | Date |
| end_date | Date |
| duration_days | Decimal |
| status | Enum (Pending, Manager Approved, HR Approved, Rejected) |
| approved_by | FK |
| comments | Text |
| proof_document | URL |

### 7.10 ENTITY 10 --- LEAVE TYPE

Contains tenant-specific leave types.

### Attributes:

| Field | Type |
| --- | --- |
| leave_type_id | UUID |
| leave_name | String |
| accrual_method | Enum |
| max_days | Decimal |
| carry_over | Boolean |
| requires_document | Boolean |
| affects_payroll | Boolean |
| encashable | Boolean |

### 7.11 ENTITY 11 --- OUTSOURCED STAFF ROSTER

### Attributes:

| Field | Type |
| --- | --- |
| roster_id | UUID |
| vendor_id | FK |
| staff_list | JSON |
| contract_rate | JSON |
| staff_roles | JSON |

### 7.12 ENTITY 12 --- OUTSOURCED STAFF INVOICE

### Attributes:

| Field | Type |
| --- | --- |
| invoice_id | UUID |
| vendor_id | FK |
| roster_id | FK |
| invoice_date | Date |
| total_salary_component | Decimal |
| total_management_fee | Decimal |
| wht_amount | Decimal |
| discrepancies | JSON |

### 7.13 ENTITY 13 --- VENDOR MANAGEMENT FEE

### Attributes:

| Field | Type |
| --- | --- |
| mgmt_fee_id | UUID |
| vendor_id | FK |
| fee_amount | Decimal |
| wht_rate | Decimal |
| dimension_set | JSON |

### 7.14 ENTITY 14 --- CONSULTANT PAYROLL FILE

### Attributes:

| Field | Type |
| --- | --- |
| file_id | UUID |
| uploaded_by | FK |
| file_url | URL |
| parsed_data | JSON |
| comparison_result | JSON |
| variance_summary | JSON |

### 7.15 ENTITY 15 --- PAYROLL GL POSTING SET

Stores all GL entries generated for payroll.

### Attributes:

| Field | Type |
| --- | --- |
| posting_set_id | UUID |
| run_id | FK |
| gl_lines | JSON |
| posted_at | Timestamp |
| posted_by | FK |
| posting_status | Enum |

### 7.16 ENTITY 16 --- PAYROLL DIMENSION MAPPING CONFIG

Maps payroll elements → dimensions.

### 7.16 ENTITY 16 --- PAYROLL DIMENSION MAPPING CONFIG

Maps payroll elements → dimensions.

### Examples:

| Payroll Element | Real IO | Cost Center | Material IO | Location |
| --- | --- | --- | --- | --- |
| Basic Salary | Required | Required | N/A | Optional |
| Bonus | Required | Optional | N/A | Optional |
| Pension | Optional | Required | N/A | Optional |

### 7.17 ENTITY 17 --- PAYROLL VARIANCE LOG

Tracks variances between system-calculated vs consultant file.

### Attributes:

| Field | Type |
| --- | --- |
| variance_id | UUID |
| employee_id | FK |
| run_id | FK |
| element_name | String |
| system_value | Decimal |
| consultant_value | Decimal |
| difference | Decimal |
| severity | Enum |
| resolution_note | Text |

### 7.18 ENTITY 18 --- EMPLOYEE BANK INFORMATION

Bank details are stored separately for security.

### Attributes:

| Field | Type |
| --- | --- |
| bank_info_id | UUID |
| employee_id | FK |
| bank_name | String |
| account_number (encrypted) | String |
| account_type | String |
| swift_code | String |
| status | Enum (Active/Inactive) |
| last_updated_by | FK |

### 7.19 ENTITY 19 --- EMPLOYEE EXIT / FINAL SETTLEMENT

### Attributes:

| Field | Type |
| --- | --- |
| exit_id | UUID |
| employee_id | FK |
| last_working_day | Date |
| accrued_leave | Decimal |
| leave_payout | Decimal |
| unpaid_leave_deduction | Decimal |
| loan_balance | Decimal |
| fx_adjustments | Decimal |
| final_net_pay | Decimal |
| approval_workflow | JSON |

### 7.20 ENTITY RELATIONSHIP SUMMARY (TEXTUAL DIAGRAM)

Employee

├── Employment Contract

├── Salary Structure

├── Payroll Results (many)

├── Leave Ledger (many)

├── Leave Applications (many)

├── Bank Information (1)

├── Variance Logs (many)

└── Exit Settlement (0 or 1)

Payroll Run

├── Payroll Results (many)

├── Consultant File (0 or 1)

└── GL Posting Set (1)

Outsourced Vendor

├── Staff Roster (many)

└── Outsourced Staff Invoices (many)

**SECTION 8 --- USER STORIES (FULL ENTERPRISE-GRADE LIBRARY)**

(Each user story includes acceptance criteria, system expectations, and
workflow context. This provides engineering with a complete blueprint
for development.)

This is a fully expanded user story set, covering employees, HR, payroll
team, finance, CFO, auditors, consultants, outsourced vendors, and
system admins.

This section is extremely comprehensive --- similar to Workday, Oracle
HCM, SAP SuccessFactors, ADP, and other enterprise payroll products.

## 8.0 USER STORY ORGANIZATION

User stories are grouped into 11 categories:

1.  Employee Self-Service (ESS)

2.  Leave Management

3.  HR Master Data

4.  Payroll Officer Workflow

5.  Payroll Manager Workflow

6.  Finance (Payroll-Related)

7.  CFO / Executive Role

8.  Consultant Payroll Integration

9.  Outsourced Staff Vendor

10. Auditors (Internal & External)

11. Tenant Admin / Super Admin

Now we proceed with each category in full detail.

### 8.1 EMPLOYEE SELF-SERVICE (ESS) USER STORIES

### US-E01 --- View Payslip

As an employee,

I want to view and download my monthly payslip

so that I can understand my salary breakdown.

Acceptance Criteria:

-   Payslip accessible only to the specific employee

-   Masked bank account

-   Shows gross salary, deductions, net salary

-   Leave encashment or unpaid leave reflected

-   PDF export enabled

### US-E02 --- View YTD Salary & Tax Summary

As an employee,

I want to see my year-to-date tax & salary totals

so that I can monitor my annual compensation.

### US-E03 --- Update Personal Information

As an employee,

I want to submit requests to update my address, next-of-kin, or phone
number

so that my personal records remain accurate.

### US-E04 --- Update Bank Details

As an employee,

I want to update my bank account details

so that future salary payments go to the correct bank.

Acceptance Criteria:

-   Requires approval (HR + Payroll)

-   Triggers fraud check

-   Logs old → new change

### US-E05 --- View Leave Balance

As an employee,

I want to view my leave balance

so that I know how many days I can take.

### US-E06 --- Apply for Leave Online

As an employee,

I want to apply for leave from my portal

so that I don't need paper-based processes.

### US-E07 --- Track Leave Approval Status

As an employee,

I want to track where my leave request is in the approval chain

so that I stay informed.

### US-E08 --- Confirm Return From Leave

As an employee,

I want to confirm that I have resumed work

so that HR can clear my leave entry.

### US-E09 --- View Loan & Salary Advance Balances

As an employee,

I want to see my outstanding loans and salary advances

so that I understand upcoming deductions.

### US-E10 --- View Final Settlement (Upon Exit)

As a departing employee,

I want to view my final settlement details

so that I can confirm correctness.

### 8.2 LEAVE MANAGEMENT USER STORIES

### US-L01 --- Apply for Leave

As an employee,

I want to apply for any leave type

so that I can follow the official leave process.

### US-L02 --- Manager Approves Leave

As a supervisor,

I want to approve or reject leave requests

so that I can manage team capacity.

### US-L03 --- HR Validates Leave

As an HR officer,

I want to verify documentation and policies

so that only compliant leave is approved.

### US-L04 --- View Team Leave Calendar

As a supervisor,

I want to see who in my team is on leave

so that I can manage scheduling.

### US-L05 --- Process Overstay Alerts

As HR,

I want to receive notifications of overstayed leave

so that appropriate action can be taken.

### US-L06 --- Encash Leave

As HR/Payroll,

I want to process leave encashment

so that employees receive payout accurately.

### US-L07 --- Adjust Leave Manually

As HR,

I want to adjust leave balances manually

so that corrections can be applied when needed.

### 8.3 HR MASTER DATA USER STORIES

### US-HR01 --- Create New Employee

As an HR Officer,

I want to onboard a new employee

so that payroll and leave systems have correct data.

### US-HR02 --- Maintain Employee Contracts

As HR,

I want to update contract information

so that payroll calculations remain accurate.

### US-HR03 --- Update Salary Structure

As HR,

I want to adjust an employee's salary structure

so that promotions, adjustments, or demotions reflect properly.

### US-HR04 --- Upload Supporting Documents

As HR,

I want to upload employee documentation (contracts, letters)

so that records are complete.

### US-HR05 --- Process Exit Workflow

As HR,

I want to manage employee exit

so that payroll final settlement can be processed.

### US-HR06 --- Trigger Leave Accrual

As HR,

I want to run monthly/annual leave accrual

so that leave balances remain up to date.

### 8.4 PAYROLL OFFICER USER STORIES

### US-P01 --- Initiate Payroll Run

As a Payroll Officer,

I want to initiate a payroll run

so that the system computes salaries for the period.

### US-P02 --- Enter Variable Pay Items

As a Payroll Officer,

I want to add allowances, overtime, shifts, deductions

so that employees get correct pay.

### US-P03 --- Review Payroll Exceptions

As a Payroll Officer,

I want to see errors or anomalies

so that I can correct them before approval.

### US-P04 --- Upload Consultant File

As a Payroll Officer,

I want to upload consultant-prepared payroll

so that I can compare it with system computation.

### US-P05 --- View Variance Report

As a Payroll Officer,

I want to view line-by-line variances

so that discrepancies are resolved.

### US-P06 --- Submit Payroll Draft

As a Payroll Officer,

I want to submit payroll draft

so that Payroll Manager can review.

### 8.5 PAYROLL MANAGER USER STORIES

### US-PM01 --- Approve Payroll Draft

As a Payroll Manager,

I want to approve payroll draft

so that payroll can move to Finance stage.

### US-PM02 --- Reject Payroll Draft

As a Payroll Manager,

I want to reject payroll draft

so that corrections can be made.

### US-PM03 --- Review GL Impact Summary

As a Payroll Manager,

I want to see GL postings summary

so that I confirm correctness.

### 8.6 FINANCE USER STORIES (PAYROLL-RELATED)

### US-F01 --- Review Payroll Totals

As a Finance Officer,

I want to validate totals

so that amounts are correct before payment.

### US-F02 --- Generate Payment File

As a Finance Officer,

I want to generate salary payment files

so that salaries can be processed.

### US-F03 --- Approve Payment File

As a Finance Manager,

I want to approve payment file

so that payroll can be submitted to CFO.

### US-F04 --- Post Payroll GL Journals

As Finance,

I want to post payroll-related GL entries

so that accounting books remain accurate.

### US-F05 --- Reverse Payroll Accruals

As Finance,

I want to auto-reverse prior accruals

so that there is no double-counting.

### 8.7 CFO / EXECUTIVE USER STORIES

### US-CFO01 --- Final Payroll Approval

As CFO,

I want to approve final payroll

so that payments can be released.

### US-CFO02 --- Approve High-Value Exceptions

As CFO,

I want to approve exceptions > threshold

so that risk is controlled.

### US-CFO03 --- Approve Payment File

As CFO,

I want to approve the final payment

so that bank disbursement is authorized.

### 8.8 CONSULTANT USER STORIES

### US-CONS01 --- Upload Payroll File

As a Payroll Consultant,

I want to upload my payroll version

so that tenant can validate my calculations.

### US-CONS02 --- View Variance Summary

As a Consultant,

I want to see variance summary

so that I can understand differences.

### 8.9 OUTSOURCED STAFF VENDOR USER STORIES

### US-OUT01 --- Upload Outsourced Staff Invoice

As an Outsourced Vendor,

I want to upload staff list and invoice

so that tenant can validate billing.

### US-OUT02 --- Receive Variance Alerts

As a Vendor,

I want to see discrepancies

so that I can correct before invoice approval.

### 8.10 AUDITOR USER STORIES

### US-AUD01 --- View Payroll Audit Pack

As an Internal Auditor,

I want to view payroll reports

so that I can verify compliance.

### US-AUD02 --- View Approval Trail

As an Auditor,

I want to see approvals

so that I can verify segregation of duties.

### US-AUD03 --- View Variance Logs

As an Auditor,

I want to validate differences

so that payroll integrity is preserved.

### 8.11 TENANT ADMIN / SUPER ADMIN USER STORIES

### US-TA01 --- Configure Payroll Settings

As a Tenant Admin,

I want to configure statutory rules, salary structures, workflows

so that payroll matches company policy.

### US-TA02 --- Configure Leave Policy

As a Tenant Admin,

I want to define accrual rules and leave types

so that leave runs automatically.

### US-TA03 --- Configure Access Control

As a Tenant Admin,

I want to assign roles

so that data confidentiality is maintained.

### US-SA01 --- Activate Payroll Module

As Super Admin,

I want to activate payroll for a tenant

so that they can begin payroll operations.

### US-SA02 --- Monitor Tenant Payroll Health

As Super Admin,

I want to see system-health metrics (not payroll data)

so that performance is monitored.

**SECTION 9 --- DETAILED WORKFLOW DIAGRAMS (TEXT-BASED BPMN)**

(Because images cannot be generated here, the workflows are represented
in a precise, text-based BPMN style suitable for engineering translation
into UI/UX flows and sequence diagrams.)

This section contains all critical process flows, written in a
BPMN-compatible textual notation that engineers can directly convert
into diagrams (Mermaid, Draw.io, Figma flows, Lucidchart).

We will include 8 full workflows:

1.  Employee Master Data Lifecycle

2.  Leave Application & Approval

3.  Payroll Computation

4.  Payroll Exception Resolution

5.  Consultant File Upload & Comparison

6.  Payroll Approval Workflow

7.  Payroll Payment Workflow

8.  Payroll GL Posting Workflow

### 9.1 WORKFLOW 1 --- EMPLOYEE MASTER DATA LIFECYCLE

(Text BPMN: clear, structured, engineering-ready)

Start

→ HR Officer selects \"Create New Employee\"

→ System loads Employee Master Form

→ HR inputs mandatory details

→ System validates completeness

→ If validation fails → Return to HR with error

→ HR submits for approval

[Approval Chain Triggered]

→ HR Manager reviews

→ Approve → Next Step

→ Reject → Back to HR with comment

→ Payroll Manager reviews salary structure

→ Approve → Next Step

→ Reject → Back to HR

→ CFO approval (if salary > threshold or senior role)

→ Approve → Next Step

→ Reject → Back to HR

[Onboarding Confirmation]

→ System generates Employee ID

→ System creates Employee Portal account

→ System activates employee in payroll + leave modules

End

### Key Notes

-   Every approval step must record:

    -   user_id

    -   timestamp

    -   comments

    -   change_log

### 9.2 WORKFLOW 2 --- LEAVE APPLICATION & APPROVAL

Start

→ Employee selects \"Apply for Leave\"

→ System loads Leave Application Form

→ Employee selects leave type, date range, uploads document

→ System validates:

- Eligibility

- Leave balance

- Public holidays

- Overlap with team leave

- Required documents

→ If failing → Error shown to employee

→ Employee submits

[Approval Workflow]

→ Manager receives request

→ Approve → Next Step

→ Reject → Notify Employee → End

→ HR receives request (if enabled)

→ Approve → Next Step

→ Reject → Notify Employee → End

[System Updates]

→ System posts leave to Leave Ledger

→ System updates team leave calendar

→ System triggers payroll proration for unpaid leave

→ System sends confirmation to employee

[Return From Leave]

→ Employee selects "Confirm Resumption"

→ Manager verifies

→ HR updates leave status to "Closed"

End

### 9.3 WORKFLOW 3 --- PAYROLL COMPUTATION

Start

→ Payroll Officer selects \"Initiate Payroll Run\"

→ System loads all active employees

→ System fetches:

- Salary structure

- Allowances

- Deductions

- Leave impacts

- Loans/advances

- Statutory settings

→ System computes payroll for each employee:

- Gross Pay

- Taxable Income

- Payroll Statutory Items (Pension, PAYE, NHF, NSITF)

- Net Pay

→ System runs 45+ validation rules

→ If errors → Exception Queue

→ If clean → Move to Draft

→ Payroll Officer reviews exceptions

→ Fixes data OR sends query to HR

→ Payroll Officer submits \"Payroll Draft\"

End

### 9.4 WORKFLOW 4 --- PAYROLL EXCEPTION RESOLUTION

Start

→ System generates exception list:

- Missing bank details

- Salary < minimum wage

- Missing pension details

- Duplicate allowances

- Suspended employee included

- Negative net pay

- Dimension missing

→ Payroll Officer reviews each exception

Case A --- Missing data

→ Payroll Officer clicks "Send Query"

→ HR receives update request

→ HR updates data

→ System returns employee to payroll

Case B --- Calculation anomaly

→ Payroll Officer adjusts variable items

→ System recalculates for affected employee

Case C --- Invalid statutory

→ System suggests correct statutory rule

→ Payroll adjusts and revalidates

Once all issues resolved:

→ Exception Queue = empty

→ Payroll Officer re-submits draft

End

### 9.5 WORKFLOW 5 --- CONSULTANT FILE UPLOAD & COMPARISON

Start

→ Payroll Officer selects \"Upload Consultant File\"

→ System requests file (CSV/Excel/XML)

→ System parses file using AI normalizer

→ System maps fields → internal structure

→ System compares:

- Gross salary

- Allowances

- Deductions

- PAYE

- Pension

- NHF

- Net salary

→ System generates Variance Report:

- Employee level

- Element level

- Severity classification

→ Payroll Officer reviews variances

→ If acceptable → Submit to Payroll Manager

→ If not acceptable → Consultant notified automatically

End

### 9.6 WORKFLOW 6 --- PAYROLL APPROVAL WORKFLOW

Start

→ Payroll Officer submits "Payroll Draft"

[Stage 1: Payroll Manager Review]

→ Payroll Manager reviews:

- Summary totals

- Variances

- Leave impact

- Statutory schedules

→ Approve → Moves to Finance

→ Reject → Back to Payroll Officer

[Stage 2: Finance Manager Review]

→ Finance Manager reviews:

- Payment totals

- GL impact

- Liability postings

→ Approve → Moves to CFO

→ Reject → Back to Payroll Officer

[Stage 3: CFO Final Approval]

→ CFO reviews:

- Net payroll

- High-value items

- Variances > threshold

- Payment file preview

→ Approve → Unlock Payment Processing

→ Reject → Back to Payroll Manager

End

### 9.7 WORKFLOW 7 --- PAYROLL PAYMENT WORKFLOW

Start

→ CFO approval completed

→ Finance Officer selects "Generate Payment File"

→ System generates:

- Salary payment file (bank format)

- Statutory payment file(s)

- Vendor payment file for outsourced staff

→ Finance Manager reviews payment file

→ Approve → Next Step

→ Reject → Back to Finance Officer

→ CFO approves payment file

→ Approve → Bank disbursement allowed

→ Reject → Back to Finance Manager

→ Payment sent:

Option A: Manual bank upload by Finance

Option B: API integration (if enabled)

→ Bank reconciliation engine receives payment confirmations

End

### 9.8 WORKFLOW 8 --- PAYROLL GL POSTING WORKFLOW

Start

→ Payroll approved & processed

→ System generates GL Posting Set:

- Salary expense

- Employer liabilities

- Employee deductions

- Leave liability impact

- Leave encashment

- Reversals (previous accrual)

- New month accrual

→ Finance Officer previews entries

→ System validates:

- GL accounts exist

- Dimensions complete

- Periods open

→ Finance Officer submits

→ Finance Manager approves

→ System posts entries to GL (ERP or ZivaBI ledger)

→ Posting confirmation stored

End

**SECTION 10 --- DETAILED UI/UX REQUIREMENTS**

(Full, enterprise-grade UI specification --- screen-by-screen,
component-by-component, with responsive behavior, validation rules, and
multi-tenant branding support.)

This section describes exactly how each part of the Payroll + Leave
Management module must look, feel, and behave across:

-   Employee Self-Service Portal

-   Manager Portal

-   HR Portal

-   Payroll Portal

-   Finance Portal

-   CFO Approval Portal

-   Consultant Portal

-   Outsourced Vendor Portal

-   Tenant Admin Portal

It includes:

-   Page layouts

-   Interaction details

-   Validation rules

-   Error states

-   Responsive behavior

-   Dark/Light mode

-   Multi-tenant branding

-   Accessibility requirements

## 10.0 GLOBAL UI/UX PRINCIPLES

All payroll & leave screens must follow core ZivaBI standards:

### P1 --- Clean, modern, Apple-level simplicity

Minimal clutter; intuitive navigation; white space emphasis.

### P2 --- Mobile-first responsive design

All screens work seamlessly on:

-   Desktop

-   Tablet

-   Mobile (iOS & Android)

-   PWA shortcuts

### P3 --- Component reusability

Use unified components:

-   Buttons

-   Tables

-   Form controls

-   Modals

-   Approval timeline widgets

-   Status badges

-   Error indicators

### P4 --- Consistency across modules

Payroll screens must feel like natural extensions of:

-   Expense Module

-   AP Module

-   AR Module

-   Bank Reconciliation Module

### P5 --- Accessibility

WCAG 2.1 compliance:

-   Screen reader support

-   High contrast mode

-   Keyboard navigation

### P6 --- Multi-Tenant Branding

Every tenant can customize:

-   Primary color

-   Secondary color

-   Logo

-   Font choices

-   Button styles

### 10.1 EMPLOYEE SELF-SERVICE (ESS) UI REQUIREMENTS

### ESS-01 --- Employee Dashboard

Widgets:

-   My Payslip (Latest Month)

-   Year-to-Date Summary

-   Leave Balance Card

-   Leave Application Shortcut

-   Upcoming Leave Calendar

-   My Loans & Advances

-   My Profile Overview

Design Requirements:

-   Cards must be draggable and rearrangeable

-   Quick action menu:

    -   Apply for Leave

    -   View Payslip

    -   Update Personal Info

-   Dark/light mode support

### ESS-02 --- Payslip Viewer

Screen Layout:

-   Month selector (dropdown)

-   Payslip preview panel

-   Download PDF button

-   Email-to-self button

Payslip Information Display:

-   Employee details

-   Pay period

-   Gross → Net breakdown

-   Allowances

-   Deductions

-   Statutory amounts

-   Company message section

Security Requirements:

-   Bank account number masked by default

-   Button to toggle visibility

-   PIN/2FA validation if tenant enables

### ESS-03 --- Personal Information Update

Tabs:

-   Contact Details

-   Address Details

-   Bank Details

-   Emergency Contact

-   Identification Documents

Workflow:

-   Employee edits

-   Submits for HR approval

-   Tracking timeline displayed

Validation:

-   Mandatory fields highlighted

-   Incorrect format alerts

-   Duplicate bank account warning

### ESS-04 --- Leave Application Form

Form Fields:

-   Leave Type (dropdown)

-   Start Date

-   End Date

-   Auto-calculated Duration

-   Attach Document (if required)

-   Reason for leave

-   Replacement Contact (optional)

UI Behavior:

-   Shows remaining leave balance

-   Shows holidays overlapping

-   Shows team leave conflicts

-   Displays approval chain preview

### ESS-05 --- Leave Dashboard

Tabs:

-   Active Leaves

-   Past Leaves

-   Rejected Leaves

-   Pending Approvals

-   Calendar View

Visual Elements:

-   Color-coded leave types

-   Approver timeline

-   Status badges (Pending, Approved, Rejected)

### 10.2 MANAGER PORTAL UI REQUIREMENTS

### Manager Dashboard

Widgets:

-   Team Leave Requests

-   Team Calendar

-   Pending Approvals

-   Payroll Exceptions (if manager sees salary data)

-   Team Attendance (future)

### Leave Approval Screen

Shows:

-   Employee info

-   Leave type

-   Date range

-   Document attachment

-   Conflict alerts

-   Impact on team workload

-   Approve/Reject with comments

Manager must never see salary details.

### Team Leave Calendar

-   Color-coded leave by employee

-   Filters: Department / Role / Leave Type

-   Month, Week, Year view

-   Export to PDF

### 10.3 HR PORTAL UI REQUIREMENTS

### HR Dashboard

Widgets:

-   New Employee Requests

-   Pending Salary Updates

-   Leave to Validate

-   Staff Count by Department

-   Upcoming Exit Dates

-   Policy Update Alerts

-   Compliance Alerts

### Employee Master Data Screen

Tabs:

-   Personal Details

-   Job Details

-   Salary Structure

-   Documents

-   Statutory Info

-   Leave Ledger

-   Payroll History

Features:

-   Edit with version history

-   Upload documents

-   Comparison of old vs new values

-   Audit trail panel

### Leave Policy Setup Screen

Tenant can configure:

-   Leave types

-   Accrual rules

-   Carry-over rules

-   Encashment rules

-   Documentation rules

-   Blackout dates

-   Mandatory holidays

UI Elements:

-   Table with toggle switches

-   Rule builder (no-code style)

-   Preview of policy effect

### Employee Exit Processing Screen

Components:

-   Exit details

-   Final settlement preview

-   Leave payout

-   Loan balance

-   Asset return checklist

-   Exit approval workflow

### 10.4 PAYROLL OFFICER UI REQUIREMENTS

### Payroll Dashboard

Widgets:

-   Payroll Period Selector

-   Payroll Status

-   Employees with Exceptions

-   Variance Summary

-   Pending Variable Input

-   Statutory Totals Panel

-   Payroll Run History

### Variable Pay Entry Screen

Features:

-   Add earnings or deductions

-   Bulk upload (Excel/CSV)

-   Validation warnings

-   Auto-save

### Exception Resolution Screen

Exception categories:

-   Missing Bank Details

-   Missing Pension/NHF

-   Duplicate Allowances

-   Zero Net Pay

-   Salary Below Minimum Wage

-   Missing Dimensions

-   Suspended Employee Included

UI:

-   Bucket view (tabs)

-   Inline editing

-   Send query to HR/Manager

-   Exception timeline

### Consultant Payroll Upload Screen

Components:

-   File upload widget

-   Parser preview grid

-   Field mapping panel

-   AI matching suggestions

### Variance Analysis Screen

-   Left panel → System calculations

-   Right panel → Consultant values

-   Middle column → Variance amounts

-   Color-coded variance levels

-   Export variance report

### 10.5 PAYROLL MANAGER UI REQUIREMENTS

### Payroll Approval Screen

Includes:

-   Summary dashboard

-   Variance summary

-   Statutory schedule summary

-   Exception list (resolved/unresolved)

-   Approval & Reject buttons

-   Comment field

-   Approval timeline

### Payroll Run History

-   Past payroll cycles

-   Status

-   Approver chain

-   Total payroll cost

-   GL posting status

### 10.6 FINANCE PORTAL UI REQUIREMENTS

### Finance Dashboard

Widgets:

-   Payroll totals

-   GL entries pending posting

-   Payment files awaiting approval

-   Statutory payments summary

### Payment File Generation Screen

Includes:

-   Bank selector

-   File format selector

-   Salary vs Statutory batches

-   Preview of generated file

-   Download button

-   "Send to Bank" (via API if enabled)

### GL Posting Review Screen

Fields:

-   Debit/Credit lines

-   Dimensions

-   Total validation

-   Approval workflow

-   Posting confirmation logs

### 10.7 CFO / EXECUTIVE UI REQUIREMENTS

### Executive Payroll Review Screen

Summary panels:

-   Gross payroll

-   Net payroll

-   Statutory liabilities

-   Variances over threshold

-   High-earner salary list

-   Employee count

-   Cash requirement

CFO sees full salary details.

### Approval Workflow Screen

Components:

-   Approve

-   Reject

-   Comment

-   Full audit log

-   Document attachments

### 10.8 CONSULTANT PORTAL UI REQUIREMENTS

Screens:

### Consultant File Upload

-   Drag-and-drop zone

-   File mapping

-   Parsing feedback

### Variance Report (Restricted View)

-   Consultant sees only differences

-   Cannot see full employee salary details

-   Cannot download sensitive payroll data

### 10.9 OUTSOURCED STAFF VENDOR UI REQUIREMENTS

### Invoice Upload Screen

-   Upload invoice

-   Upload staff roster

-   Auto-parse and preview

-   Receive discrepancy notifications

### Discrepancy Resolution Screen

-   View flagged issues

-   Respond with comments

-   Re-upload corrected file

### 10.10 TENANT ADMIN CONFIGURATION UI REQUIREMENTS

### Payroll Settings Screen

Configurable:

-   Salary structure

-   Pay cycles

-   Statutory rules

-   Currency rules

-   FX settings

-   Proration rules

### Leave Policy Configuration

-   Accrual builder

-   Encashment builder

-   Carry-over rules

-   Blackout days

### Approval Workflow Builder

-   Drag-and-drop workflow

-   Add/remove approval stages

-   Conditional flows

-   "If salary > X, require CFO approval"

### Role & Permission Management

-   Role-based access

-   Data masking rules

-   Page-level & field-level permissions

### 10.11 SUPER ADMIN UI REQUIREMENTS

Limited to:

-   Tenant health dashboard

-   Module activation/deactivation

-   Billing

-   System version control

-   Zero access to tenant payroll data

**SECTION 11 --- NON-FUNCTIONAL REQUIREMENTS (NFRs)**

(Enterprise-grade reliability, performance, security, compliance, and
scalability standards.)

This section defines the technical quality standards the Payroll + Leave
Management Module must meet before it can be deployed to real-world
tenants, including multi-company and multi-country organizations.

These NFRs ensure ZivaBI Payroll remains:

-   Highly secure

-   Auditable

-   Scalable

-   Fast

-   Compliant

-   Modular

-   Fault-tolerant

-   Multi-tenant safe

-   Future-proof

## 11.0 OVERVIEW

Non-functional requirements govern how the system behaves, not what it
does.

This section covers:

1.  Performance requirements

2.  Availability & reliability

3.  Scalability

4.  Security

5.  Compliance & audit

6.  Data privacy

7.  Multi-tenant isolation

8.  Integration quality

9.  Backup & disaster recovery

10. Maintainability & extensibility

11. Accessibility

12. Localization & multi-currency

13. Monitoring & observability

### 11.1 PERFORMANCE REQUIREMENTS

### NFR-P1 --- Payroll computation speed

-   The system must compute payroll for:

    -   Up to 500 employees in < 15 seconds

    -   Up to 5,000 employees in < 60 seconds

    -   Up to 50,000 employees in < 4 minutes

-   Performance must scale with horizontal processing (worker queues).

### NFR-P2 --- Leave calculation speed

-   Leave balance recalculation < 2 seconds per employee.

-   Annual leave accrual for entire organization < 1 minute.

### NFR-P3 --- Consultant file comparison speed

-   Parsing Excel/CSV files up to 50MB < 15 seconds.

-   Variance computation for 5,000 employees < 30 seconds.

### NFR-P4 --- UI responsiveness

-   Every UI action must respond within < 300ms.

-   Table rendering for 1,000 rows < 2 seconds.

-   PDF payslip generation < 5 seconds.

### 11.2 AVAILABILITY & RELIABILITY

### NFR-A1 --- Availability

-   Payroll module must maintain 99.9% uptime.

-   Critical payroll periods (21st--5th monthly):

    -   99.99% uptime SLA.

### NFR-A2 --- Zero data loss tolerance

-   No payroll or leave data can be lost at any point.

-   ACID-compliant storage for payroll results.

### NFR-A3 --- Transaction integrity

-   Salary adjustments must be atomic:

    -   Either fully saved or not saved at all.

### 11.3 SCALABILITY

### NFR-S1 --- Horizontal scalability

-   All payroll computation services must scale horizontally.

### NFR-S2 --- Multi-tenant elastic scaling

-   New tenants must not affect performance of existing tenants.

### NFR-S3 --- Scalable storage

-   Database must store:

    -   10 years of payroll cycles

    -   10 years of leave history

    -   Unlimited payslip PDFs

    -   Unlimited consultant files

### 11.4 SECURITY REQUIREMENTS

Security is critical, especially for payroll.

### NFR-SEC1 --- Encryption

-   Data in transit: TLS 1.2+

-   Data at rest: AES-256

-   Bank account numbers: Field-level encryption

-   Sensitive logs: encrypted

### NFR-SEC2 --- Access control

-   Role-based access control (RBAC)

-   Page-level & field-level permissions

-   Sensitive fields masking

    -   Bank accounts

    -   Net salary

    -   Tax details

### NFR-SEC3 --- 2-Factor Authentication

-   Optional per tenant

-   Required for:

    -   CFO approvals

    -   HR salary updates

    -   Bank detail changes

### NFR-SEC4 --- Session security

-   Automatic logout after 15 minutes inactivity (configurable)

-   IP whitelisting for payroll officers (optional)

-   Device fingerprinting for high-risk users

### NFR-SEC5 --- Data segregation

-   Each tenant's data must be isolated at the database layer

-   No cross-organization access possible

### 11.5 COMPLIANCE & AUDITABILITY

### NFR-C1 --- Full audit logs

Every action must be recorded:

-   Who changed what

-   Before/after values

-   Timestamp

-   IP address

-   Device fingerprint

-   Approval chain

### NFR-C2 --- IFRS/GAAP compliance

Payroll posting must support:

-   Accrual accounting

-   Leave liability

-   Earned vs unearned benefits

### NFR-C3 --- Statutory compliance

Support for:

-   PAYE

-   Pension contributions

-   Local tax authorities

-   Country-specific statutory rules

### NFR-C4 --- Immutable payroll runs

Once payroll is closed:

-   No modification allowed

-   Only reversal via next run

### 11.6 DATA PRIVACY (GLOBAL)

### NFR-DP1 --- Regional compliance

-   GDPR (EU)

-   NDPA (Nigeria)

-   POPI (South Africa)

-   CCPA (California)

-   Any tenant-specific jurisdiction requirements

### NFR-DP2 --- Employee data minimization

Only required fields may be stored.

### NFR-DP3 --- Right to be forgotten

Upon employee exit, system must:

-   Anonymize personal data

-   Retain payroll records (for audit)

### 11.7 MULTI-TENANT ISOLATION

### NFR-MT1 --- Database isolation

Use:

-   Separate schemas per tenant

    OR

-   Separate databases per tenant (large enterprises)

### NFR-MT2 --- Configurable payroll rules per tenant

Every tenant can maintain:

-   Local statutory rules

-   Leave policies

-   Salary structures

-   Tax formulas

-   Approval workflows

### NFR-MT3 --- Tenant-specific branding

UI theme configurable per tenant.

### 11.8 INTEGRATION REQUIREMENTS

### NFR-INT1 --- ERP posting connectivity

Support integration with:

-   SAP

-   Oracle

-   Sage X3

-   Microsoft Dynamics

-   QuickBooks

-   Odoo

-   ZivaBI Ledger

### NFR-INT2 --- Bank integration

Via:

-   API

-   File-based NACHA/XML/CSV uploads

### NFR-INT3 --- Payroll consultant integration

Must parse:

-   Excel

-   CSV

-   XML

-   JSON

### NFR-INT4 --- Outsourced vendor integration

File uploads for:

-   Payroll roster

-   Salary invoice

-   Management fee invoice

### 11.9 BACKUP & DISASTER RECOVERY

### NFR-DR1 --- Automated Backups

-   Hourly incremental backups

-   Daily full backups

-   Retain for minimum 5 years (configurable per tenant)

### NFR-DR2 --- Disaster Recovery

-   RTO < 1 hour

-   RPO < 15 minutes

-   Multi-region failover

### NFR-DR3 --- Immutable payroll archives

Backups must include:

-   Payroll runs

-   Payslips

-   GL postings

-   Leave history

### 11.10 MAINTAINABILITY & EXTENSIBILITY

### NFR-M1 --- Modular architecture

Payroll engine must be:

-   Extendable

-   Replaceable

-   Loosely coupled

### NFR-M2 --- Versioned APIs

Any external integrations must use versioned APIs.

### NFR-M3 --- Configuration over customization

Most behaviors should be configurable, not custom-coded.

### 11.11 ACCESSIBILITY

### NFR-A11 --- WCAG 2.1 AA compliance

-   Screen reader

-   Keyboard navigation

-   High contrast mode

-   Font resizing

### 11.12 LOCALIZATION & MULTI-CURRENCY

### NFR-L1 --- Multi-currency payroll

Support:

-   NGN, USD, GBP, EUR, ZAR, GHS, KES, etc.

### NFR-L2 --- Exchange rate rules

Tenant chooses:

-   CBN rate

-   Market FX

-   Daily rate

-   Monthly fixed rate

### NFR-L3 --- Date formats & number formats

Per tenant locale.

### 11.13 MONITORING & OBSERVABILITY

### NFR-MON1 --- Logs

-   System logs

-   Audit logs

-   Error logs

-   Access logs

### NFR-MON2 --- Alerts

Trigger alerts for:

-   Failed payroll computation

-   High variances

-   Missing statutory data

-   Duplicate bank files

-   Suspicious salary change

### NFR-MON3 --- Metrics Dashboard

-   Payroll computation time

-   Leave accrual time

-   API performance

-   Payment file generations

**SECTION 12 --- API REQUIREMENTS (FULL ENGINEERING-READY SPECIFICATION)**

(RESTful API definitions for internal & external integrations --- exact
request/response payloads, authentication, validation, versioning, and
error patterns.)

This section provides complete API requirements for:

-   Employee master data

-   Salary structure management

-   Leave management

-   Payroll computation

-   Payroll approvals

-   Payroll GL posting

-   Consultant payroll comparison

-   Outsourced vendor integration

-   Payment file generation

-   Statutory schedules

-   Audit trails

-   Multi-tenant isolation

All APIs must be versioned (e.g., /api/v1/payroll/...) and respect
tenant-level authentication + RBAC.

## 12.0 API ARCHITECTURE OVERVIEW

### API Style:

### REST (JSON)

### Authentication:

### OAuth2 + JWT + Tenant API Key

### Transport:

### HTTPS (TLS 1.2+)

### Authorization:

### RBAC-based

### Rate Limiting:

### 100 requests/sec per tenant (adjustable)

### Versioning:

### /api/v1/

### required on all endpoints

Common URL structure:

/api/v1/{tenantId}/payroll/{resource}

### 12.1 EMPLOYEE MASTER DATA APIs

#### 12.1.1 Create Employee

POST /api/v1/{tenantId}/employees

### Request:

{

\"first_name\": \"Ola\",

\"last_name\": \"Adeniyi\",

\"email\": \"ola\@example.com\",

\"employment_type\": \"permanent\",

\"job_title\": \"Accountant\",

\"department_id\": \"D001\",

\"start_date\": \"2025-02-01\",

\"bank_details\": {

\"bank_name\": \"GTBank\",

\"account_number\": \"0123456789\"

}

}

### Response:

{

\"employee_id\": \"EMP-12455\",

\"status\": \"success\"

}

#### 12.1.2 Update Employee (Partial Update)

PATCH /api/v1/{tenantId}/employees/{employeeId}

### Allowed fields:

-   address

-   phone

-   next_of_kin

-   bank_details

-   job_title

-   department_id

#### 12.1.3 Get Employee Data

GET /api/v1/{tenantId}/employees/{employeeId}

Returns full profile (masked if role restricts it).

### 12.2 SALARY STRUCTURE & PAY ELEMENT APIs

#### 12.2.1 Get Salary Structure

GET /api/v1/{tenantId}/employees/{employeeId}/salary-structure

#### 12.2.2 Update Salary Structure

POST /api/v1/{tenantId}/employees/{employeeId}/salary-structure

### Request:

{

\"basic_salary\": 350000,

\"housing\": 150000,

\"transport\": 50000,

\"allowances\": {

\"entertainment\": 20000,

\"meal\": 15000

}

}

### 12.3 LEAVE MANAGEMENT APIs

#### 12.3.1 Apply for Leave

POST

/api/v1/{tenantId}/leave/apply

### Request:

{

\"employee_id\": \"EMP-12455\",

\"leave_type_id\": \"annual\",

\"start_date\": \"2025-04-03\",

\"end_date\": \"2025-04-10\",

\"reason\": \"Family event\"

}

#### 12.3.2 Approve Leave

POST /api/v1/{tenantId}/leave/{applicationId}/approve

#### 12.3.3 Reject Leave

POST /api/v1/{tenantId}/leave/{applicationId}/reject

#### 12.3.4 Leave Ledger Lookup

GET /api/v1/{tenantId}/leave/ledger/{employeeId}

### 12.4 PAYROLL COMPUTATION APIs

#### 12.4.1 Initiate Payroll Run

POST /api/v1/{tenantId}/payroll/run

### Request:

{

\"period_start\": \"2025-03-01\",

\"period_end\": \"2025-03-31\",

\"run_type\": \"regular\"

}

### Response:

{

\"run_id\": \"RUN-2025-03\",

\"status\": \"draft_created\"

}

#### 12.4.2 Recalculate Single Employee Payroll

POST

/api/v1/{tenantId}/payroll/run/{runId}/recalculate/{employeeId}

Used for exception resolution.

#### 12.4.3 Get Payroll Draft Summary

GET

/api/v1/{tenantId}/payroll/run/{runId}/summary

#### 12.4.4 Submit Payroll Draft for Approval

POST

/api/v1/{tenantId}/payroll/run/{runId}/submit

### 12.5 CONSULTANT FILE APIs

#### 12.5.1 Upload Consultant Payroll File

POST

/api/v1/{tenantId}/payroll/consultant/upload

### Request:

Multipart form upload:

-   file

-   payroll_period

#### 12.5.2 Get Variance Report

GET

/api/v1/{tenantId}/payroll/consultant/variance/{runId}

### 12.6 PAYROLL APPROVAL APIs

#### 12.6.1 Approve Payroll

POST

/api/v1/{tenantId}/payroll/run/{runId}/approve

#### 12.6.2 Reject Payroll

POST

/api/v1/{tenantId}/payroll/run/{runId}/reject

#### 12.6.3 Approval Timeline

GET

/api/v1/{tenantId}/payroll/run/{runId}/approvals

### 12.7 PAYMENT APIs

#### 12.7.1 Generate Salary Payment File

POST

/api/v1/{tenantId}/payroll/run/{runId}/payment-file

#### 12.7.2 Get Payment File Status

GET

/api/v1/{tenantId}/payments/{paymentId}

#### 12.7.3 Send Payment File to Bank (API Integration)

POST

/api/v1/{tenantId}/bank/send-payment

### 12.8 GL POSTING APIs

#### 12.8.1 Generate GL Posting Set

POST

/api/v1/{tenantId}/payroll/run/{runId}/gl/generate

#### 12.8.2 Post GL Entries

POST

/api/v1/{tenantId}/payroll/run/{runId}/gl/post

#### 12.8.3 Get GL Posting Status

GET

/api/v1/{tenantId}/gl/posting/{postingSetId}

### 12.9 OUTSOURCED STAFF APIs

#### 12.9.1 Upload Outsourced Vendor Invoice

POST

/api/v1/{tenantId}/outsourced/vendors/{vendorId}/invoice/upload

#### 12.9.2 Retrieve Vendor Discrepancies

GET

/api/v1/{tenantId}/outsourced/vendors/{vendorId}/invoice/{invoiceId}/discrepancies

#### 12.9.3 Approve Vendor Invoice

POST

/api/v1/{tenantId}/outsourced/vendors/{vendorId}/invoice/{invoiceId}/approve

### 12.10 STATUTORY APIs

#### 12.10.1 Get Statutory Tables

GET

/api/v1/{tenantId}/statutory/tables

#### 12.10.2 Update Statutory Rules

POST

/api/v1/{tenantId}/statutory/update

#### 12.10.3 Get Statutory Schedule

GET

/api/v1/{tenantId}/statutory/schedule/{runId}

### 12.11 AUDIT APIs

#### 12.11.1 Get Payroll Audit Trail

GET

/api/v1/{tenantId}/audit/payroll/{runId}

#### 12.11.2 Get Employee Audit Trail

GET

/api/v1/{tenantId}/audit/employees/{employeeId}

### 12.12 ERROR HANDLING STANDARD

All API errors follow a standard format:

### Error Response Example:

{

\"error_code\": \"PAYROLL_VALIDATION_ERROR\",

\"message\": \"Duplicate allowance detected\",

\"details\": {

\"employee_id\": \"EMP-44322\",

\"element\": \"Housing Allowance\"

},

\"timestamp\": \"2025-11-25T09:32:44Z\"

}

**SECTION 13 --- ACCEPTANCE CRITERIA (DETAILED, MODULE-WIDE, ENTERPRISE-GRADE)**

Acceptance Criteria (AC) defines the minimum conditions that must be met
before the Payroll Module is approved for deployment to real tenants.

This is the section auditors, CFOs, QA testers, developers, and project
managers rely on to determine go-live readiness.

We define acceptance criteria at four levels:

-   Functional Acceptance Criteria (FAC)

-   Integration Acceptance Criteria (IAC)

-   Security Acceptance Criteria (SAC)

-   Performance Acceptance Criteria (PAC)

-   Compliance Acceptance Criteria (CAC)

-   User Experience Acceptance Criteria (UXAC)

-   UAT Acceptance Criteria (UAT-AC)

### 13.1 FUNCTIONAL ACCEPTANCE CRITERIA (FAC)

### FAC-1: Payroll must compute accurately for all employees

-   Salary structure applied correctly

-   Allowances & deductions applied

-   Statutory computations must be correct to 2 decimal places

-   Proration must follow tenant-selected rules

-   Leave impact must reflect correctly

### FAC-2: Workflow approvals must function correctly

-   HR → Payroll Manager → Finance Manager → CFO

-   No self-approval allowed

-   Conditional approvals must trigger (salary threshold)

### FAC-3: Leave approval & balance must be correct

-   Leave balance must reduce after approval

-   Encashment must reflect in payroll

-   Unpaid leave must cause payroll proration

-   Overstay triggers must work

### FAC-4: Employee self-service must work fully

Employees must be able to:

-   Apply for leave

-   View payslips

-   Download payslips

-   View leave balance

-   Update personal info (with approval)

-   View salary history

-   View loan/advance balances

### FAC-5: Consultant payroll file comparison must work

-   Consultant file must parse successfully

-   Variance detection must be accurate

-   All mismatches must be shown

-   System blocks approval until variances are resolved

### FAC-6: Payroll exceptions must block submission

Examples:

-   Missing bank details

-   Missing pension info

-   Negative net pay

-   Duplicate allowances

-   Missing dimensions

### FAC-7: Outsourced staff processing must work

-   Staff list validation

-   Rate validation

-   Management fee calculation

-   WHT calculation

-   Auto-generation of AP invoice

### 13.2 INTEGRATION ACCEPTANCE CRITERIA (IAC)

### IAC-1: Bank payment files must pass validation

Generated files must match:

-   Format

-   Required fields

-   Encoding

-   Structure

### IAC-2: GL Posting must integrate with tenant ERP

Supported ERPs:

-   SAP

-   Sage X3

-   Oracle

-   Dynamics

-   QuickBooks

-   Odoo

-   Ziva Ledger

### IAC-3: Leave must integrate with Payroll

When leave is:

-   Approved → proration applied

-   Unpaid → deduction applied

-   Encashment → allowance added

### IAC-4: Expense module integration

Salary advance repayments must flow into payroll deductions.

### IAC-5: AR integration

Employee overpayment or clawback items must flow into AR if tenant
chooses.

### 13.3 SECURITY ACCEPTANCE CRITERIA (SAC)

### SAC-1: RBAC must function correctly

-   Sensitive data masked for unauthorized users

-   Payroll visibility restricted to payroll-approved roles

### SAC-2: 2FA enforced for critical operations

-   Bank detail changes

-   Payroll approval

-   Payment file generation

-   CFO approval

### SAC-3: Audit logs must be complete

Every action must be logged with:

-   Before/after values

-   Actor

-   Role

-   IP address

-   Timestamp

### SAC-4: Multi-tenant isolation must be perfect

-   No data bleed between tenants

-   Separate schemas or separate DBs

### SAC-5: Data encryption must be active

-   AES-256 at rest

-   TLS 1.2+ in transit

-   Bank accounts encrypted at field-level

### 13.4 PERFORMANCE ACCEPTANCE CRITERIA (PAC)

### PAC-1: Payroll computation times

-   < 10 seconds for 500 employees

-   < 60 seconds for 5,000 employees

-   < 5 minutes for 50,000 employees

### PAC-2: UI performance

-   Dashboard loads < 2 seconds

-   Payslip generation < 5 seconds

-   Leave balance computation < 1 second

### PAC-3: API response

-   All API endpoints respond within < 300ms average

### 13.5 COMPLIANCE ACCEPTANCE CRITERIA (CAC)

### CAC-1: Statutory compliance

Payroll must correctly compute:

-   PAYE

-   Pension

-   NHF

-   NSITF

-   Relevant local laws

### CAC-2: IFRS/GAAP posting compliance

System must post:

-   Salary expenses

-   Leave liabilities

-   Accruals

-   Employer liabilities

In compliance with IFRS.

### CAC-3: Data privacy compliance

Must comply with:

-   GDPR

-   NDPA (Nigeria)

-   POPI

-   CCPA

-   Local country variations

### 13.6 USER EXPERIENCE ACCEPTANCE CRITERIA (UXAC)

### UXAC-1: Screens must be intuitive

User must be able to complete tasks with no training.

### UXAC-2: Mobile responsiveness

All screens must work on mobile.

### UXAC-3: Accessibility compliance

WCAG 2.1 AA minimum.

### UXAC-4: Dark/light mode

Required for all screens.

### 13.7 USER ACCEPTANCE TESTING (UAT) CRITERIA (UAT-AC)

### UAT-AC1 --- 20 critical payroll test scenarios must pass

Examples:

-   New joiner mid-month

-   Resignation mid-month

-   Leave encashment

-   Sick leave deductions

-   Salary structure change

-   Consultant upload mismatch

### UAT-AC2 --- Finance team must approve all GL postings

### UAT-AC3 --- HR team must approve all leave workflows

### UAT-AC4 --- CFO must approve a full test payroll cycle

### UAT-AC5 --- No data errors should remain in exception queue

**SECTION 14 --- SECURITY CONSIDERATIONS**

(Deep, enterprise-grade security architecture designed for payroll,
leave, and sensitive employee data. Aligned with global financial, HR,
and compliance standards.)

Payroll data is the most sensitive dataset in any organization---more
sensitive than AP, AR, Inventory, and even Cash & Banking---because it
contains:

-   Employee salaries

-   Bank accounts

-   Pension numbers

-   Tax identities

-   Sensitive allowances

-   Personal identification

-   Employment status

-   Deductions (loans, advances, welfare items)

Accordingly, security must be zero-compromise, multi-layered, and
non-negotiable.

## 14.0 SECURITY OVERVIEW

This section defines:

-   Authorization & access control

-   Role-based data exposure

-   Encryption standards

-   Audit logging

-   Input validation

-   Intrusion detection

-   Fraud prevention

-   Payroll integrity preservation

-   Tenant isolation

-   Compliance requirements

These are the hard-security rules that engineering MUST follow.

### 14.1 ACCESS CONTROL & AUTHORIZATION

#### 14.1.1 RBAC Enforcement

Payroll module MUST enforce:

-   Role-Based Access Control (RBAC)

-   Page-level permissions

-   Field-level permissions

-   Action-level permissions

#### 14.1.2 Payroll Data Visibility Rules

Salary-related fields are visible ONLY to:

-   Payroll Officer

-   Payroll Manager

-   Finance Manager

-   CFO

-   HR Manager (optional per tenant)

Not visible to:

-   Line Managers

-   Supervisors

-   Normal HR Officers

-   Auditors (masked view)

-   Tenant Admin

-   Super Admin

-   IT Support

#### 14.1.3 Field-Level Masking

Mandatory masking for:

-   Bank account numbers

-   Pension IDs

-   Tax IDs

-   Net salary

-   Sensitive allowances

Mask patterns:

Bank Account: ****-****-1234

Salary: ₦***,***

Tax ID: ****4658

### 14.2 AUTHENTICATION & IDENTITY SECURITY

#### 14.2.1 Multi-Factor Authentication (MFA)

Required for:

-   Payroll approval

-   Payroll draft submission

-   Bank detail updates

-   Consultant payroll approval

-   CFO decisions

Factor options:

-   OTP (SMS/Email/App)

-   Authenticator App

-   Biometric (if mobile)

#### 14.2.2 Session Security

-   Auto-logout after 15 minutes of inactivity (configurable)

-   Device fingerprinting

-   Block simultaneous logins (tenant-configurable)

-   IP whitelisting for payroll team (optional)

### 14.3 ENCRYPTION REQUIREMENTS

#### 14.3.1 Data-in-Transit Encryption

-   TLS 1.2 or higher

-   HSTS enabled

-   Strict cookie security

#### 14.3.2 Data-at-Rest Encryption

-   AES-256 encryption

-   Encrypted columns:

    -   Bank account

    -   Pension RSA PIN

    -   National ID

    -   Salary structure

#### 14.3.3 Key Management

-   Keys rotated every 90 days

-   Stored using KMS (AWS KMS, Azure Vault, or GCP KMS)

-   No hard-coded secrets

### 14.4 AUDIT LOGGING & TRACEABILITY

The payroll module MUST maintain a tamper-proof, immutable audit log of:

#### 14.4.1 What Must Be Logged

-   Salary structure changes

-   Allowance/deduction changes

-   Leave adjustments

-   Payroll run initiation

-   Payroll run approval/rejection

-   Payment file generation

-   Bank detail updates

-   Consultant uploads

-   Variance adjustments

-   System overrides

-   Login attempts

-   MFA events

-   Dimension changes

#### 14.4.2 Audit Log Fields

Each log must contain:

-   Actor (User ID + Role)

-   Timestamp

-   Old value (if applicable)

-   New value

-   IP address

-   Device fingerprint

-   Reason/comment

-   Approval chain context

#### 14.4.3 Audit Log Immutability

-   Logs cannot be modified or deleted

-   Only read-only access allowed

-   Backed up daily

### 14.5 FRAUD PREVENTION MEASURES

Fraud prevention is essential.

#### 14.5.1 High-Risk Event Alerts

System must auto-detect:

-   Sudden salary increases

-   Large one-time allowances

-   Duplicate allowances

-   New bank accounts added close to payroll

-   Payroll run initiated outside allowed window

-   Multiple login failures

-   Consultant file mismatch beyond threshold

#### 14.5.2 Two-Person Rule (4-Eye Principle)

No critical payroll action should be performed by one user alone.

Mandatory dual-approvals for:

-   Salary structure changes

-   Payroll approval

-   Payment file release

-   GL posting approval

-   Bank detail changes

#### 14.5.3 Ghost Employee Prevention

System cross-checks:

-   Leave ledger

-   Active contracts

-   Last login date

-   Payroll roster

-   Access logs

-   Exit workflow status

If any mismatch → flag for review.

### 14.6 DATA VALIDATION & INPUT SANITIZATION

#### 14.6.1 Salary Input Validation

-   Salary cannot be negative

-   Allowances cannot exceed salary (tenant configurable)

-   Duplicate allowances blocked

-   Deductions cannot exceed total allowances

#### 14.6.2 File Upload Validation

Files uploaded to payroll (consultant files, vendor files):

-   Must be virus scanned

-   Must be validated against expected schema

-   Must be normalized

#### 14.6.3 API Input Validation

-   Strict schema validation

-   Rejection of malformed JSON

-   Prevention of code injection

### 14.7 MULTI-TENANT SECURITY

#### 14.7.1 Database Isolation

Each tenant must have:

-   Separate schema

    OR

-   Separate database (enterprise tenants)

#### 14.7.2 Tenant API Key Isolation

All API calls require:

-   Tenant ID

-   Tenant API Key

-   User JWT

Requests without matching tenant key → reject.

#### 14.7.3 Cross-Tenant Blocking

No user can:

-   Query another tenant's employees

-   See another tenant's payroll

-   Access shared objects

This is absolutely non-negotiable.

### 14.8 COMPLIANCE STANDARDS

Payroll must comply with:

-   GDPR (Europe)

-   NDPA (Nigeria)

-   POPI (South Africa)

-   CCPA (California)

-   Data residency policies

-   IFRS for payroll posting

-   Local labor laws

### Data Residency

Tenants must be able to choose:

-   EU data centers

-   US data centers

-   Africa data centers

### 14.9 PENETRATION TESTING & VULNERABILITY SCANNING

#### 14.9.1 Penetration Tests

Must be conducted:

-   Before every major release

-   Quarterly

#### 14.9.2 Vulnerability Scans

-   Per formed weekly

-   CVE monitoring

-   OWASP Top 10 checks

#### 14.9.3 Secure Coding Requirements

-   No SQL injection

-   No cross-site scripting

-   No insecure direct object reference

-   Use parameterized queries

-   Secrets in environment variables only

### 14.10 PAYROLL INTEGRITY PROTECTION

#### 14.10.1 Locking Mechanisms

Payroll run becomes locked when submitted.

#### 14.10.2 Immutable Results

Once approved by CFO:

-   No reprocessing

-   Only adjustments via next payroll

-   Historical runs preserved permanently

### 14.11 BACKUP & RECOVERY SECURITY

### Backups must be:

-   Encrypted at rest

-   Replicated to secondary region

-   Retained for minimum 5 years

### Disaster Recovery:

-   RTO < 1 hour

-   RPO < 15 minutes

-   Automated failover capability

**SECTION 15 --- FUTURE ENHANCEMENTS**

(Strategic roadmap for the next 24--48 months to evolve the Payroll +
Leave module into a world-class HRMS/ERP-grade solution.)

This section outlines improvements, expansions, and next-gen
capabilities that are NOT part of the current release, but are
recommended for future versions.

These enhancements elevate ZivaBI Payroll from a robust payroll engine
into a full HR, workforce management, and people operations platform.

## 15.0 OVERVIEW

Enhancements are grouped into:

1.  Payroll Enhancements

2.  Leave & Workforce Enhancements

3.  HR & Employee Experience Enhancements

4.  AI, Machine Learning & Analytics Enhancements

5.  Integration Enhancements

6.  Compliance Enhancements

7.  Security Enhancements

8.  Infrastructure Enhancements

### 15.1 PAYROLL ENHANCEMENTS

#### 15.1.1 Multi-Country Payroll Engine (Phase 2)

Support multiple statutory frameworks simultaneously:

-   Africa: Nigeria, Ghana, Kenya, South Africa, Egypt

-   Middle East

-   Europe

-   LATAM

-   Asia

Each with:

-   Local tax rules

-   Local pension/insurance systems

-   Currency & FX integrations

-   Country-specific payslip formats

Strategic Advantage:

Positions ZivaBI as a cross-border payroll solution.

#### 15.1.2 Pay Run Simulation Engine

Allows HR/Payroll to:

-   Simulate next month's payroll

-   Model salary increases

-   Test statutory rule changes

-   Compare "What-if" scenarios

#### 15.1.3 Automated Off-Cycle Payroll Runs

For:

-   Bonuses

-   Adjustments

-   Refunds

-   Retroactive pay

-   Gratuity

-   Severance

#### 15.1.4 Payroll Reconciliation Module

Auto-matches:

-   Previous month payroll

-   Consultant payroll

-   GL posted values

-   Bank payment values

-   Statutory remittances

#### 15.1.5 Employee Recognition & Reward Integration

When rewards are monetary → auto-added to payroll.

### 15.2 LEAVE & WORKFORCE MANAGEMENT ENHANCEMENTS

#### 15.2.1 Time & Attendance (Full Module)

-   Biometric device integration

-   GPS attendance (mobile workers)

-   QR-code attendance

-   Shift scheduling

-   Overtime tracking

-   Attendance → automatic payroll adjustments

#### 15.2.2 Leave Forecasting using AI

AI predicts:

-   Future leave spikes

-   Department risk zones

-   Productivity impact

-   Leave liabilities projection

#### 15.2.3 Workforce Scheduling Integration

Create and manage work schedules:

-   Shift planning

-   Rotation rules

-   Weekend/holiday pay rules

Direct link to payroll.

#### 15.2.4 Sick Leave Document OCR

OCR automatically extracts:

-   Sick days

-   Doctor's notes

-   Hospital visit details

Reduces fraud and manual work.

### 15.3 HR & EMPLOYEE EXPERIENCE ENHANCEMENTS

#### 15.3.1 Full HRIS (Phase 3)

Add:

-   Employee file management

-   Job architecture

-   Competency frameworks

-   Onboarding tasks

-   Employee transfers & promotions

#### 15.3.2 Performance Management Module

-   KPI setting

-   Quarterly review cycle

-   Automated scoring

-   Salary increment suggestions

-   Promotion recommendations

#### 15.3.3 Learning Management System (LMS)

-   Course assignments

-   Completion tracking

-   Certification workflows

#### 15.3.4 Employee Wellness & Engagement Portal

-   Pulse surveys

-   EAP (Employee Assistance Program)

-   Engagement analytics

### 15.4 AI, MACHINE LEARNING & ADVANCED ANALYTICS

#### 15.4.1 Payroll Anomaly Detection AI

AI highlights unusual payroll items:

-   Sudden large salary jumps

-   Duplicate payments

-   Suspicious allowances

-   Fraudulent deductions

-   Vendor scams

#### 15.4.2 AI-Based Salary Benchmarking

Compares salaries with:

-   Industry data

-   Geographic data

-   Experience level

-   Academic background

Helps tenants set competitive salaries.

#### 15.4.3 Predictive Attrition Model

Predicts employees likely to leave based on:

-   Payroll patterns

-   Leave usage

-   Engagement score

-   Performance

-   Career history

#### 15.4.4 Chatbot for HR & Payroll Queries

Employees can ask:

-   "How many leave days do I have left?"

-   "When is my next payday?"

-   "Show me my payslip for December."

#### 15.4.5 Salary Forecasting AI

Predicts:

-   Next-month payroll

-   Annual payroll cost

-   Leave liabilities

-   Statutory changes impact

### 15.5 INTEGRATION ENHANCEMENTS

#### 15.5.1 Real-Time ERP Bi-directional Sync

Integrations with:

-   SAP HCM

-   Workday

-   Oracle HRMS

-   Sage X3

-   Dynamics 365

#### 15.5.2 Bank Real-Time Validation API

Before payroll:

-   Validate account name

-   Validate account number

-   Validate BVN (optional, Nigeria-specific)

#### 15.5.3 Pension/Tax Authority Direct Integration

Submit:

-   PAYE schedules

-   Pension remittances

-   NHF reports

-   NSITF returns

Automatically.

#### 15.5.4 Consultant API Integration

Allow consultants to:

-   Send payroll files via API

-   Retrieve variance report

-   Verify corrections

### 15.6 COMPLIANCE ENHANCEMENTS

#### 15.6.1 Automated Statutory Updates

System auto-updates:

-   Tax bands

-   Pension rules

-   Social security

-   Minimum wage laws

Tenant receives notification and must approve update.

#### 15.6.2 Digital Payslip Archiving (10--20 years)

Compliant with:

-   Labor laws

-   Audits

-   Statutory retention

#### 15.6.3 Compliance Dashboard

Shows:

-   Missing statutory IDs

-   Pension not remitted

-   PAYE discrepancies

-   Leave liability anomalies

### 15.7 SECURITY ENHANCEMENTS

#### 15.7.1 Payroll Approval Biometrics

Using mobile biometrics for:

-   Payroll final approval

-   Salary adjustments

-   Bank detail updates

#### 15.7.2 Zero-Trust Security Layer

Includes:

-   Continuous authentication

-   UEBA (User & Entity Behavior Analytics)

-   Device trust scoring

#### 15.7.3 Encrypted Chat for Payroll Discussions

Internal secure messaging channel.

### 15.8 INFRASTRUCTURE ENHANCEMENTS

#### 15.8.1 Serverless Payroll Engine (Phase 4)

Allows near-infinite scaling:

-   Run 100,000+ employee payroll

-   Zero infrastructure management

#### 15.8.2 Geo-Redundant Infrastructure

Multiple data centers:

-   Africa (Lagos, Johannesburg)

-   Europe (Ireland, Frankfurt)

-   US (Virginia, California)

Allows tenant-level residency selection.

#### 15.8.3 Containerization & Microservices

Move payroll engine to:

-   Docker

-   Kubernetes

For maximum reliability.
