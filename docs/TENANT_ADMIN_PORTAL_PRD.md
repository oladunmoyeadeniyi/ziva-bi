# Tenant Admin Portal --- PRD

**SECTION 1 --- EXECUTIVE SUMMARY**

This marks the beginning of the most important PRD in the entire ZivaBI
ecosystem, because the Tenant Admin Portal is the central control hub
through which each organization configures and personalizes ZivaBI to
match their processes, structure, policies, accounting rules, tax
environment, approval hierarchy, workflows, and branding.

This module determines how well ZivaBI adapts to any tenant in any
industry.

### 1.1 PURPOSE

The purpose of the Tenant Admin Portal is to provide each subscribing
organization ("tenant") with a comprehensive, secure, no-code interface
to configure every core behavioral and structural component of ZivaBI.

This portal ensures:

-   Zero engineering involvement in tenant-specific configurations

-   Maximum flexibility for different industries, legal environments,
    accounting policies, workflows, and corporate structures

-   Consistent governance across all modules

-   Scalable operations for multi-country, multi-entity, and
    multi-branch organizations

The portal empowers the tenant to:

-   Activate/deactivate modules

-   Configure the Chart of Accounts

-   Set dimensions and financial tags

-   Define approval matrices

-   Customize workflows

-   Map taxes and statutory rules

-   Build vendor and customer categories

-   Define document requirements

-   Configure payroll, AR, AP, inventory, POSM, and expense settings

-   Set FX policies

-   Manage employee access

-   Apply branding

-   Set data retention rules

With this portal, ZivaBI becomes a highly adaptive and scalable
enterprise automation platform, capable of serving:

-   Retail & FMCG

-   Manufacturing

-   Logistics & 3PL

-   Professional Services

-   Healthcare

-   Telecommunications

-   Banks & financial institutions

-   NGOs & public sector

-   Technology companies

-   Construction & Engineering

-   Hospitality

-   Multi-national organizations

### 1.2 PROBLEM STATEMENT

Organizations adopt ZivaBI because existing manual and disconnected
systems create:

-   Poor workflow governance

-   Inefficient approval processes

-   Inconsistent accounting entries

-   Inflexible chart-of-account structures

-   Heavy reliance on Excel and email

-   Errors due to inconsistent tax and statutory computation

-   Vendor onboarding failures

-   Inventory discrepancies

-   Weak dimension mapping

-   Poor audit trails

-   High compliance risk

-   Lack of automation in day-to-day transactions

But without a central configuration portal:

-   Each module behaves inconsistently

-   Tenants cannot personalize the system

-   Finance teams must call IT for every change

-   Approvals break when org structures change

-   GL postings become incorrect or incomplete

-   Modules cannot adapt to industry differences

-   Multi-country deployments become impossible

-   Data definitions become fragmented

Thus, ZivaBI must provide a robust, tenant-controlled configuration
environment.

### 1.3 MODULE OBJECTIVES

The Tenant Admin Portal aims to:

### O1 --- Provide full autonomy

Tenants should configure ZivaBI without developer involvement.

### O2 --- Support every industry workflow

Flexible settings must allow ZivaBI to serve ANY company type.

### O3 --- Unify configuration across modules

One source of truth for:

-   Dimensions

-   Chart of accounts

-   Approval workflows

-   Document rules

-   Tax rules

-   FX settings

### O4 --- Ensure compliance consistency

Policies should be enforced across:

-   AP

-   AR

-   Expense

-   Payroll

-   Inventory

-   POSM

-   Vendor onboarding

-   Customer onboarding

### O5 --- Create a governance layer

Centralized oversight ensures:

-   Standardization

-   Audit readiness

-   Policy continuity

-   Zero tolerance for fraud

### O6 --- Enable cross-country operations

Multi-entity & multi-branch organizations must configure:

-   Currencies

-   Taxes

-   Dimensions

-   Accounting periods

-   Statutory rules

### O7 --- Fully integrate with other core services

Including:

-   Workflow Engine

-   Document Management

-   OCR Engine

-   Dimension Engine

-   Notification Engine

-   AI Categorization Engine

-   Integration Hub

### 1.4 SCOPE

The Tenant Admin Portal covers:

### A. Organization Identity & Branding

-   Logo

-   Theme

-   Color palette

-   Sub-domains

-   Email templates

-   Notification tone-of-voice

### B. Module Activation

Tenants choose which modules they subscribe to:

-   AP

-   AR

-   Expense

-   Payroll

-   Inventory

-   POSM

-   Fixed Assets

-   Vendor Portal

-   Customer Portal

-   Bank Reconciliation

-   3PL Portal

-   Reporting

-   AI/ML add-ons

-   Others

### C. Organizational Structure Management

-   Departments

-   Cost centers

-   Business units

-   Profit centers

-   Warehouses

-   Project codes

### D. Chart of Accounts Configuration

-   Import COA

-   Create/update accounts

-   Grouping: P&L, BS, sub-groups

-   Mapping for AP/AR/Payroll/Inventory

-   Validation rules

### E. Dimensions Setup

Dynamic number of dimensions:

-   Real IO

-   Statistical IO

-   Cost Center IO

-   Material IO

-   Location

-   Custom tags (tenant-defined)

-   Scenario-based activation

### F. Approval Workflow Builder

Drag-and-drop builder:

-   Multi-level approvals

-   Conditional routing

-   Value-based thresholds

-   Role-based approvers

-   Parallel & sequential approvals

-   Escalations

-   Time-based auto-escalation

### G. Tax & Statutory Configuration

-   VAT

-   WHT

-   PAYE

-   Social contributions

-   Region-specific rules

-   Rate tables

-   Effective date settings

### H. Vendor Category & Rule Setup

Rules for:

-   Professional services

-   Agencies

-   Clearing agents

-   3PL

-   Import vendors

-   Non-residents

-   One-off vendors

-   Rent / Property / Insurance

-   POSM suppliers

-   Combined scenarios

### I. Customer Category & Credit Rules

-   Credit limit

-   Payment terms

-   Customer group dimensions

-   Price structures

-   Rebate structures

### J. FX & Currency Setup

-   FX source selection

-   FX application rules

-   Daily/Monthly/Spot rate

-   Unrealized & realized gain/loss rules

### K. Document Requirements Setup

Define required documents for:

-   Vendor onboarding

-   Customer onboarding

-   AP invoices

-   Payroll KYC

-   Expense retirement

-   Inventory receipts

-   POSM issuance

-   Bank reconciliations

Document-specific rules:

-   Mandatory

-   Optional

-   Expiry date

-   OCR extraction template

### L. Notification Configuration

-   Email templates

-   SMS

-   In-app alerts

-   Escalation notifications

### M. Data Import / Export Configuration

Allow import from:

-   Excel

-   CSV

-   PDF with OCR

-   ERP extractions

Mapping templates configurable.

### N. User & Role Management

-   Assign roles

-   Manage permissions

-   Field-level masking

-   Salary secrecy rules

-   Approval rights

-   Portal access

### O. Audit Configuration

-   Enable/disable specific logs

-   Export logs

-   Retention period

### 1.5 OUT OF SCOPE

The following are NOT part of the Tenant Admin Portal:

-   Financial posting logic (belongs to modules)

-   Workflow execution (belongs to workflow engine)

-   ERP connectors (belongs to Integration Hub)

-   Payroll computation engine

-   OCR engine internals

-   AI/ML training datasets

Tenant Admin portal configures these but doesn't execute them.

### 1.6 KEY BENEFITS

### B1 --- Zero-code flexibility

Tenants can configure ZivaBI like top-tier ERPs without any developer.

### B2 --- One configuration to rule all modules

Dimensions, approval rules, and taxes apply company-wide.

### B3 --- Faster tenant onboarding

A full enterprise setup can be completed in hours---not weeks.

### B4 --- Lower operational risk

Consistent rule application reduces errors, fraud, and audit issues.

### B5 --- Locally and globally compliant

Supports local, regional, and multinational operations.

### B6 --- Scalable

Works for:

-   SMEs

-   Large enterprises

-   Multi-entity groups

-   Multi-country holdings

**SECTION 2 --- PROBLEM STATEMENT**

This section defines the core problems that organizations face without a
centralized configuration system, and why the Tenant Admin Portal is
essential.

### 2.1 Fragmented Configuration Across Modules

Most organizations operate with multiple systems for:

-   AP

-   AR

-   Expenses

-   Payroll

-   Inventory

-   Vendor management

-   Customer management

-   ERP integrations

Without a unified configuration framework:

-   Rules are inconsistent

-   Accounting mappings break

-   Approval workflows fail

-   Documents are not standardized

-   Compliance becomes risky

This leads to high administrative overhead, confusion among users, and
increased audit failures.

### 2.2 Heavy Dependence on IT or Developers

Most ERP, HRMS, and workflow systems require:

-   Developers

-   Consultants

-   System integrators

...just to update:

-   Chart of accounts

-   Approval rules

-   Dimensions

-   KYC requirements

-   Tax settings

-   FX rules

-   Document templates

-   Access control

-   Compliance logic

This makes companies:

-   Slow

-   Rigid

-   Inefficient

-   Dependent on technical teams

The Tenant Admin Portal removes ALL technical dependency.

### 2.3 Lack of Standardization Across Departments

Without a centralized configuration portal:

-   Finance uses one standard

-   Operations uses another

-   HR uses another

-   Procurement uses another

This causes:

-   Mismatched GL postings

-   Weak audit trails

-   Statutory reporting failures

-   Vendor & customer inconsistencies

-   Poor reconciliation

-   Conflicting definitions of policies

ZivaBI must enforce policy uniformity, customized per tenant.

### 2.4 Scaling Breaks Processes

As organizations grow:

-   More departments

-   More employees

-   More warehouses

-   More vendors

-   More customers

-   More branches

-   More countries

Manual configuration becomes unmanageable.

Common problems include:

-   Approval flow breakdown

-   Incorrect dimensions applied

-   Incorrect tax rules across entities

-   Conflict between local and HQ policies

-   Too many exceptions

A centralized admin portal enables multi-branch, multi-entity,
multi-country scale.

### 2.5 Compliance Failures

Organizations often fail audits due to:

-   Missing KYC documents

-   Wrong WHT or VAT application

-   Inconsistent vendor categories

-   Misaligned revenue recognition

-   Incorrect dimension mapping

-   Lack of approval trail evidence

-   No configured retention policies

The Tenant Admin Portal must enforce compliance-by-design.

### 2.6 Broken Approval Processes

When approval workflows are hardcoded or scattered:

-   Approvers are wrong

-   Escalations don't work

-   New hires/promotions break workflows

-   Finance overrides cause errors

-   Managers bypass processes

-   Documents get stuck in limbo

The portal must enable drag-and-drop workflow configuration that
instantly updates across all modules.

### 2.7 No Single Source of Truth for Financial Structures

Without a centralized admin portal, companies fail to maintain
consistent structures such as:

-   Chart of Accounts

-   Dimensions

-   Mapping rules

-   Financial categories

-   Segment codes

-   Entity-level settings

This often results in:

-   Discrepant postings

-   Poor financial reporting

-   Failed audits

-   Incorrect consolidation

ZivaBI must enforce a unified configuration applied everywhere.

### 2.8 Multi-Tenant SaaS Without Tenant Configuration = Impossible

To serve:

-   10 tenants

-   100 tenants

-   10,000 tenants

...you cannot have engineers modifying each tenant's database.

ZivaBI must allow tenants to configure:

-   Modules

-   Policies

-   Rules

-   Workflows

-   Dimensions

-   Accounting structures

-   Subscription levels

...without touching the backend.

### 2.9 Lack of Field Customization

Different companies call fields by different names.

Examples:

-   "Cost Center" = "Department Code" = "Responsibility Center"

-   "Internal Order" = "Job Code" = "Project Code"

-   "Vendor" = "Supplier"

-   "Customer" = "Client"

Without customizable labels:

-   Adoption becomes difficult

-   Training becomes harder

-   Users get confused

-   Systems feel "foreign"

The Tenant Admin Portal must make all field names tenant-renamable.

### 2.10 Inability to Handle Diverse Industries

Different industries require different settings:

-   FMCG = COGS mapping + 3PL + POSM

-   Logistics = 3PL portal

-   Consulting = No inventory, heavy WIP rules

-   Manufacturing = BOM, job costing

-   Hospitality = Service charges, revenue splits

-   NGOs = Fund-based accounting

-   Real estate = Rent accrual, CAM charges

-   Multinationals = Multi-currency, multi-entity

-   Importers = Landed cost allocation

The Tenant Admin Portal must allow industry-fit configurations.

### 2.11 Summary of the Problem

Companies struggle because there is no centralized, configurable,
intelligent control center to manage the entire ZivaBI ecosystem.

This leads to:

-   Fragmentation

-   Errors

-   Manual work

-   Audit failures

-   Delayed approvals

-   Unreliable financial reporting

-   Difficulty scaling

-   Poor compliance

-   Confusion among users

The Tenant Admin Portal eliminates all these issues by providing a
no-code, high-precision, enterprise-wide configuration platform.

**SECTION 3 --- SCOPE**

This section defines exactly what the Tenant Admin Portal covers, the
boundaries of its responsibility, and the full breadth of configurable
elements it governs across the entire ZivaBI ecosystem.

This is one of the broadest and most strategically important modules in
the platform.

## 3.0 SCOPE OVERVIEW

The Tenant Admin Portal provides full, no-code configuration control
over:

1.  Organization Identity & Branding

2.  Module Activation & Subscription Control

3.  Organization Structure (Departments, Cost Centers, Warehouses,
    Branches, Entities)

4.  Chart of Accounts (COA) Setup & Financial Categories

5.  Dimensions Engine Setup (Unlimited Dimensions)

6.  Approval Workflow Builder (for all modules)

7.  Document Rules & KYC Requirements

8.  Tax & Statutory Configuration

9.  FX & Currency Settings

10. Vendor & Customer Category Rules

11. Inventory & POSM Configuration

12. Payroll Configuration

13. AR/AP Setup

14. User Management & Roles

15. Employee Access & Permissions

16. Notification Setup

17. Data Import/Export Settings

18. Retention & Compliance Configuration

19. AI & Automation Settings

20. Integration Setup (ERP, Banks, 3rd-party)

21. Audit Configuration

Every ZivaBI tenant will rely on this module to configure how all other
modules behave.

### 3.1 IN-SCOPE CONFIGURATION CATEGORIES

Below is a fully detailed breakdown of every area included in the Tenant
Admin Portal scope.

### A. ORGANIZATION IDENTITY & BRANDING

The tenant can configure:

-   Company name

-   Logo upload

-   Brand color scheme

-   Button styles

-   Light mode / dark mode defaults

-   Header and footer styling

-   URL subdomain (e.g., tenant.zivabi.com)

-   Email header/footer design

-   SMS sender ID

-   Document branding (invoices, POs, payslips, statements)

Purpose:

Every tenant sees ZivaBI as their own software, not a generic tool.

### B. MODULE ACTIVATION & SUBSCRIPTION CONTROL

Tenant Admin can activate/deactivate any module, including:

-   AP (Accounts Payable)

-   AR (Accounts Receivable)

-   Expense Management

-   Payroll

-   Inventory Management

-   POSM Management

-   Fixed Asset Management

-   Vendor Portal

-   Customer Portal

-   Bank Reconciliation

-   3PL Portal

-   Reporting & Analytics

-   AI Automation Engine

-   Bank API Integrations

-   OCR Engine

Activation Rules:

-   Modules auto-configure when activated

-   Tenant must complete setup checklists

-   Super Admin (ZivaBI) controls module availability

-   Access controlled by roles

### C. ORGANIZATIONAL STRUCTURE CONFIGURATION

Tenant can define:

-   Departments

-   Cost Centers

-   Business Units

-   Regions

-   Divisions

-   Warehouses (with location and capacity metadata)

-   Branches

-   Legal Entities

-   Reporting Lines

-   Hierarchy Trees

-   Employee groups (e.g., Field Sales, Office Staff)

Use Cases:

-   Approval workflows

-   Dimensions mapping

-   Payroll grouping

-   Warehouse-level inventory

### D. CHART OF ACCOUNTS (COA) & FINANCIAL MAPPING

Tenant can:

-   Import COA via Excel, CSV, TXT, or API

-   Add new GL accounts

-   Edit existing accounts

-   Deactivate obsolete accounts

-   Define:

    -   Account type (Asset/Liability/Income/Expense)

    -   Financial category (BS/PL)

    -   Sub-grouping (PL1, PL2, PL3, PL4)

    -   Group account mapping

    -   Reporting categories

    -   Control accounts (AP, AR, Inventory, Payroll, etc.)

    -   Multicurrency posting behaviors

This drives GL mapping across ALL modules:

-   AP

-   AR

-   Expenses

-   Payroll

-   Inventory

-   POSM

-   FA

### E. DIMENSIONS ENGINE (UNLIMITED DIMENSIONS)

Tenant can configure:

-   Number of dimensions (0 to unlimited)

-   Names of dimensions

-   Behavior rules

-   Required/optional per module

-   Dropdown items

-   Validation rules

-   Applicability to GL accounts

-   Default values

-   Budget-based restrictions

-   Time-based activation (valid-from / valid-to)

Example dimensions:

-   Real IO

-   Statistical IO

-   Cost Center IO

-   Material IO

-   Customer Group

-   Location

-   Region

-   Project

-   Activity Code

-   Event Code

This directly powers entry validation in every module.

### F. APPROVAL WORKFLOW BUILDER

Tenant can configure workflow for all processes:

-   Vendor onboarding

-   Customer onboarding

-   AP invoices

-   Expense retirement

-   Payroll approval

-   Inventory receipts

-   POSM issuance

-   Fixed asset capitalization

-   Bank reconciliation

-   Credit notes

-   AR invoicing

-   AR delivery confirmation

-   Returns approval

-   Leave approval

Workflow features:

-   Drag-and-drop builder

-   Role-based approval

-   Value-based thresholds

-   Conditional routing

-   Parallel approvals

-   Escalations

-   Timeouts

-   Substitute approvers

-   Skip-level approvals

-   Error-proofing rules

### G. DOCUMENT & KYC REQUIREMENT CONFIGURATION

Tenant can specify:

### Which documents are required for:

-   Vendor onboarding

-   Customer onboarding

-   Employee onboarding

-   AP invoices

-   Expense line items

-   Fixed asset acquisitions

-   Inventory receipts

-   Return validations

-   Payroll changes

-   Bank reconciliations

-   Leave requests

### Per-document rules:

-   Required / optional

-   Expiry date

-   OCR extraction

-   Validation logic

-   Maximum file size

-   Allowed formats

-   Number of files allowed

Industry-specific KYC handled.

### H. TAX, WHT AND STATUTORY CONFIGURATION

Tenant configures:

-   VAT % by category

-   WHT rates

-   Multiple tax types

-   Exemptions

-   Non-resident vendor rules

-   Country-specific payroll statutory setups

-   Reverse VAT rules (if applicable)

-   Effective dates

-   Statutory remittance accounts

The system automatically applies rules based on these settings.

### I. FX & CURRENCY CONFIGURATION

Tenant can set:

-   FX rate sources (CBN, XE, Manual, Monthly Fixed)

-   FX rate application rules

-   Realized gain/loss rules

-   Unrealized gain/loss rules

-   Automatic month-end revaluation

-   Currency revaluation accounts

-   Effective date of FX changes

### J. VENDOR CATEGORY & BUSINESS RULE SETUP

Tenant defines:

-   Vendor categories

-   Tax rules per category

-   Document rules

-   PO requirements

-   Dimension requirements

-   Budget linking

-   Advance request caps

Categories include:

-   Professional services

-   Agencies / Event managers

-   Clearing agents

-   3PLs

-   Import vendors

-   Utility vendors

-   Rent

-   Insurance

-   LTC vendors

-   Ad-hoc one-off vendors

Each category has its own configurable rules.

### K. CUSTOMER CATEGORY & CREDIT RULE CONFIGURATION

Tenant configures:

-   Customer types (Cash, Credit, Distributor)

-   Credit limit rules

-   Customer group dimension mapping

-   Pricing configurations

-   Rebate rules

-   FX rules (if export-based)

### L. INVENTORY & POSM CONFIGURATION

Tenant configures:

-   Inventory valuation method:

    -   Standard cost

    -   Weighted average

    -   Actual cost

-   Warehouses

-   Item categories

-   Expiry tracking

-   Batch/lot rules

-   POSM issuance rules

-   Return rules

-   Damage categories

-   3PL integration rules

### M. PAYROLL CONFIGURATION

Tenant configures:

-   Salary structure

-   Statutory setup

-   Pay cycles

-   Leave policies

-   Deduction rules

-   Proration rules

-   Outsourced staff rules

-   Dimension mapping

-   Approval workflow

-   Employee portal access

### N. USER & ROLE MANAGEMENT

Tenant manages:

-   Adding/removing employees

-   Role assignments

-   Permission sets

-   Field masking rules

-   Team membership

-   Approval rights

-   Access to modules

-   Multi-factor authentication settings

### O. NOTIFICATION CONFIGURATION

Tenant controls:

-   Email templates

-   SMS templates

-   Alert rules

-   Escalation rules

-   Reminder frequency

### P. DATA IMPORT & EXPORT CONFIGURATION

Tenant configures:

-   Allowed file formats

-   Field mapping templates

-   Validation rules

-   Data cleansing rules

-   Duplicate handling

### Q. COMPLIANCE & RETENTION CONFIGURATION

Tenant sets rules for:

-   Data retention period

-   Document retention

-   Employee file retention

-   Audit retention

-   Access review frequency

### R. AI CONFIGURATION

Tenant configures:

-   AI prediction on/off

-   AI categorization on/off

-   Confidence thresholds

-   Mapping rules

-   Feedback loop preferences

### S. INTEGRATION SETUP

Tenant configures:

-   ERP integration

-   Bank API integrations

-   3rd-party payroll consultants

-   Logistics vendors

-   Payment gateways

-   Tax authority integrations

**SECTION 4 --- OUT OF SCOPE**

Section 4 defines what the Tenant Admin Portal will NOT do, to avoid
ambiguity, stakeholder misinterpretation, or over-extension of the
module's intended purpose.

This ensures clear boundaries between:

-   Configuration (Tenant Admin)

    vs.

-   Execution (Operational Modules like AP, AR, Inventory, Payroll,
    etc.)

The Tenant Admin Portal controls and configures, but it does NOT execute
operational workflows.

## 4.0 OVERVIEW

The Tenant Admin Portal is the central configuration engine for all
ZivaBI modules.

However, it does not:

-   Perform financial transactions

-   Execute workflows

-   Process payroll

-   Post GL entries

-   Authorize accounting actions

-   Manage day-to-day operational tasks

This section clarifies these boundaries.

### 4.1 OPERATIONAL TASKS OUT OF SCOPE

These tasks belong to operational modules and not the Tenant Admin
Portal.

#### 4.1.1 No Transaction Processing

Tenant Admin Portal does NOT:

-   Record AP invoices

-   Record AR invoices

-   Process payments

-   Generate payroll runs

-   Process bank statements

-   Perform expense retirements

-   Process inventory receipts

-   Issue POSM items

-   Approve delivery notes

-   Approve vendor invoices

These are handled within their respective modules.

#### 4.1.2 No Financial Posting

The Portal will NOT:

-   Post to the general ledger (GL)

-   Generate journal entries

-   Adjust balances

-   Modify financial reports

These actions belong to AP, AR, Payroll, Inventory, Expense, and FA
modules.

#### 4.1.3 No Direct Data Entry for Modules

Tenant Admin cannot:

-   Upload vendor invoices

-   Upload customer purchase orders

-   Upload payslips

-   Upload payroll variances

-   Upload inventory receipts

-   Upload delivery notes

-   Upload credit notes

The Portal only defines templates, not the data entries.

### 4.2 WORKFLOW EXECUTION OUT OF SCOPE

#### 4.2.1 No Approvals of Operational Requests

Tenant Admin Portal does NOT approve:

-   AP requests

-   Expense retirements

-   Payroll runs

-   Vendor onboarding requests

-   Customer onboarding requests

-   Journal entries

-   Bank reconciliations

The approval structure is defined here, but approval execution is not.

#### 4.2.2 No Real-Time Workflow Routing

The Portal:

-   Defines workflows

-   Defines routing logic

-   Sets conditional rules

...but does NOT:

-   Route documents

-   Notify approvers

-   Track approval progress

-   Manage approval history

Those functions belong to the Universal Workflow Engine.

### 4.3 NO MODULE REPLACEMENT

Tenant Admin Portal is NOT:

-   An ERP

-   A payroll engine

-   An HRIS

-   A procurement system

-   A CRM

-   An inventory management UI

It configures these modules within ZivaBI but does not replace them.

### 4.4 NO LOW-LEVEL DATABASE ADMINISTRATION

The Portal does NOT allow tenants to directly:

-   Modify database schema

-   Modify backend tables

-   Modify stored procedures

-   Modify system architecture

-   Modify server resources

-   Modify encryption settings

-   Modify backup schedules

These are handled by Super Admin + Platform Infrastructure.

### 4.5 NO CODING OR SCRIPT EXECUTION

Tenant Admin cannot:

-   Write scripts

-   Inject custom code

-   Upload plugins

-   Add custom backend logic

-   Interfere with backend logic

All configurations must be no-code.

### 4.6 NO TENANT-TO-TENANT VISIBILITY

Tenant Admin cannot:

-   View other tenants

-   Compare with other organizations

-   Access other tenant configurations

-   Trigger settings that affect global ZivaBI infrastructure

Super Admin exclusively handles that.

### 4.7 NO AI MODEL TRAINING OR MANUAL ML CONFIGURATION

Tenant Admin:

-   CANNOT train models manually

-   CANNOT modify AI engine logic

-   CANNOT upload datasets for ML

-   CANNOT tune ML hyperparameters

The Portal can enable/disable AI features, but cannot manipulate ML
internals.

### 4.8 NO CUSTOM FEATURE DEVELOPMENT FROM PORTAL

Tenant Admin Portal cannot:

-   Create new system modules

-   Add new backend features

-   Change global UX layout

-   Add new integration engines

-   Modify system-wide microservices

Requests of this nature must be sent to ZivaBI Support or Super Admin.

### 4.9 NO ACCESS TO SENSITIVE GLOBAL SETTINGS

The Portal does NOT expose:

-   Encryption keys

-   Global IP firewall rules

-   Cloud infrastructure settings

-   CI/CD pipeline

-   DB credentials

-   System logs (platform-level)

-   Core workflow engine logic

-   Tenant container runtime

These are Super Admin only.

### 4.10 NO BILLING OR PLAN MANAGEMENT

Tenant Admin cannot:

-   Upgrade subscription plan

-   Modify billing frequency

-   Change payment methods

-   View billing history

-   Change modular pricing

-   Add or remove billable seats

These belong to Super Admin Billing Portal.

### 4.11 NO MASS RECORD MANIPULATION OUTSIDE CONFIG

Tenant Admin is restricted from performing:

-   Mass deletion of employees

-   Mass wiping of financial data

-   Mass modification of accounting entries

-   Mass disabling of workflows

Bulk imports exist, but bulk destructive changes are blocked.

### 4.12 NO AUDIT LOG MODIFICATIONS

Tenant Admin cannot:

-   Alter audit trails

-   Delete logs

-   Modify logs

-   Export logs with sensitive system-level details

Only read-only access for tenant-specific logs is allowed.

### 4.13 SUMMARY OF OUT OF SCOPE

The Tenant Admin Portal:

-   Is not an operational tool

-   Does not process financial transactions

-   Does not execute workflows

-   Does not post to GL

-   Does not serve as an ERP on its own

-   Does not alter backend infrastructure

-   Does not modify global configurations

-   Does not handle billing

-   Does not enable tenant-side coding

It configures everything but does NOT execute day-to-day operations.

**SECTION 5 --- USER ROLES & PERSONAS**

This section defines all personas who will interact with the Tenant
Admin Portal, including their:

-   Responsibilities

-   Permissions

-   Restrictions

-   Decision-making authority

-   Access boundaries

-   Configurable modules

-   High-risk actions

-   Limitations

-   Cross-module visibility

The Tenant Admin Portal must rigorously enforce RBAC (Role-Based Access
Control) and Field-Level Security, ensuring every tenant's internal
structure is respected and sensitive elements remain secure at all
times.

## 5.0 OVERVIEW

The Tenant Admin Portal serves users who manage:

-   Company-wide settings

-   Workflow structures

-   Financial configurations

-   HR/payroll policies

-   Multi-departmental mappings

-   Access rights

-   Compliance frameworks

These users are typically senior and operate at the policy level, not
transactional level.

There are three categories of personas:

1.  Tenant-Level Personas

2.  ZivaBI-Level Personas (Super Admin & Support)

3.  Special-Permission Personas (Finance, HR, Compliance)

Each persona has VERY different authority levels.

### 5.1 TENANT-LEVEL PERSONAS

These personas belong to the tenant company and are responsible for
configuring their ZivaBI environment.

### Persona TA-1: Tenant Admin (Primary)

Most powerful role within the tenant.

### Responsibilities:

-   Configure all modules

-   Manage organizational structure

-   Define approval workflows

-   Set up dimensions

-   Import/modify chart of accounts

-   Configure vendor/customer categories

-   Set FX rules

-   Configure tax, VAT, WHT rules

-   Set up KYC/document requirements

-   Activate/deactivate modules

-   Manage user roles & access

-   Configure payroll, inventory, AR/AP settings

-   Control data retention

-   Manage branding

-   Set notifications

-   Manage integration endpoints

### Permissions:

-   FULL access to Tenant Admin Portal

-   NO access to financial transactions

-   NO access to salary details (except through permission delegation)

### Restrictions:

-   Cannot see payroll values unless given explicit visibility

-   Cannot modify global system settings

-   Cannot alter audit logs

This is the core persona for Tenant Admin Portal.

### Persona TA-2: Finance Admin (Senior Finance / System Finance Owner)

### Responsibilities:

-   Configure financial policies

-   Control GL mappings for modules

-   Approve COA updates

-   Configure dimensions tied to accounting

-   Maintain tax/WHT rules

-   Maintain FX configuration

-   Maintain revenue/COGS setup

-   Set AP/AR posting logic

-   Review document requirements for compliance

-   Define period-end rules

### Permissions:

-   Access all Finance-related sections

-   Cannot modify global branding

-   Cannot manage user accounts

-   Cannot configure HR/Payroll modules (unless given optional access)

### Restrictions:

-   Cannot modify core system structure

-   Cannot deactivate modules

### Persona TA-3: HR Admin

### Responsibilities:

-   Configure HR-specific policies

-   Manage leave rules

-   Define payroll settings (if allowed)

-   Configure employee KYC rules

-   Manage employee provisioning

-   Restrict visibility for salary secrecy

-   Handle employee lifecycle configuration

### Permissions:

-   Access HR/Payroll configuration areas

-   Limited access to organizational structure

-   Limited access to dimensions (only those relevant to HR)

### Restrictions:

-   Cannot access financial configuration

-   Cannot modify COA

-   Cannot alter AP/AR workflow

### Persona TA-4: IT Admin / Technical Admin

### Responsibilities:

-   Manage user roles and access

-   Configure integrations (bank API, ERP API, SSO)

-   Configure MFA settings

-   Manage SSO and identity providers

-   Configure API keys

-   Manage tenant-specific environments

### Permissions:

-   Integration & authentication sections

-   User provisioning

-   Security settings

-   SSO settings

### Restrictions:

-   No access to payroll settings

-   No access to financial configuration

-   No access to confidential employee data

### Persona TA-5: Compliance & Audit Admin

### Responsibilities:

-   Configure retention rules

-   Configure audit retention durations

-   Activate mandatory document policies

-   Define compliance behaviors

-   Manage approval audit requirements

### Permissions:

-   Read-only access to:

    -   All workflows

    -   All document requirements

-   Can update compliance configuration section

### Restrictions:

-   Cannot modify financial settings

-   Cannot modify HR settings

-   Cannot alter system technical configuration

### 5.2 SPECIAL-PERMISSION TENANT PERSONAS

These roles do NOT access the Tenant Admin module fully but have partial
configuration privileges.

### Persona SP-1: CFO / Executive Approver

### Responsibilities:

-   Approve high-risk policy changes

-   Approve workflow modifications

-   Approve payroll dimension rules

-   Validate/approve GL mapping changes

-   Approve tax rule updates

### Permissions:

-   Only receives high-impact configurations for approval

-   Does not create configurations

-   Has read-only access to configuration history

### Persona SP-2: Head of Operations

### Responsibilities:

-   Configure 3PL interaction rules

-   Configure inventory workflow approval

-   Configure damage handling rules

-   Set POSM rules

-   Maintain supplier operational categories

### Permissions:

-   Partial access to inventory, POSM, vendor categories

-   No access to core financial rules

### Persona SP-3: Procurement Manager

### Responsibilities:

-   Configure vendor categories

-   Define required documents for suppliers

-   Maintain supplier onboarding rules

### Permissions:

-   Vendor category configuration

-   Workflow builder for procurement processes

### Restrictions:

-   No financial configuration

-   No HR configuration

### Persona SP-4: Warehouse Manager (For Inventory Setup)

### Responsibilities:

-   Configure warehouse metadata

-   Configure inbound/outbound rules

-   Set damage categories

-   Define 3PL mapping

### Permissions:

-   Limited inventory settings

### 5.3 ZivaBI-LEVEL PERSONAS (Platform Owner Side)

### Persona ZA-1: Super Admin (ZivaBI Platform Owner)

### Responsibilities:

-   Provision new tenants

-   Enable/disable modules at the platform level

-   Manage billing plans

-   Define global system behaviors

-   Manage platform-wide configurations

-   No access to tenant data

### Permissions:

-   Full platform-level admin

-   Zero tenant-level financial or payroll visibility

### Restrictions:

-   Cannot see tenant salaries

-   Cannot see tenant operational transactions

-   Cannot alter tenant workflows

### Persona ZA-2: ZivaBI Support Engineer

### Responsibilities:

-   Assist tenants with setup if invited

-   Troubleshoot tenant configuration issues

-   Provide support for integration failures

### Restrictions:

-   Access only tenant-specified areas

-   NO access to salaries or confidential data

### 5.4 FIELD-LEVEL SECURITY PERSONAS

These personas manage or inherit field masking settings:

-   Payroll Manager (may override salary fields)

-   HR Admin (limited salary visibility)

-   Finance Admin (no salary visibility unless approved)

-   Employee Self-Service (sees only own salary)

Tenant Admin configures masking.

### 5.5 PERSONAS WHO HAVE ZERO ACCESS TO TENANT ADMIN PORTAL

-   Regular Employees

-   DSS / DPS / DPM (unless granted special access)

-   Line Managers (unless granted approval configuration rights)

-   External Vendors

-   Customers

-   Warehouse Operators

-   3PL Users

-   Auditors (read-only to selected compliance views)

These users will never see the Tenant Admin Portal.

**SECTION 6 --- DETAILED FUNCTIONAL REQUIREMENTS**

(This is the largest and most critical section of the entire Tenant
Admin PRD. It defines every feature, rule, configuration option, and
system behavior in full enterprise detail.)

This section outlines all functional capabilities the Tenant Admin
Portal must provide.

Every requirement listed here will be implemented as a configurable,
no-code feature.

This is the "brain" of ZivaBI configurability.

## 6.0 OVERVIEW

The Tenant Admin Portal consists of 12 major functional blocks:

1.  Organization Identity & Branding Configuration

2.  Module Activation & Subscription Controls

3.  Organizational Structure Setup

4.  Chart of Accounts (COA) & Financial Mappings

5.  Dimensions Engine Configuration

6.  Approval Workflow Builder

7.  Document & KYC Rules Configuration

8.  Tax, WHT, VAT, Statutory Configuration

9.  Currency & FX Rule Configuration

10. Vendor & Customer Category Configuration

11. Module-Specific Settings (AP, AR, Expense, Payroll, Inventory, POSM,
    FA)

12. User, Access, Roles & Security Configuration

13. Notification & Escalation Configuration

14. Data Import/Export Templates Configuration

15. AI/Automation Configuration

16. Integration & API Configuration

17. Audit & Compliance Configuration

We will now document each block in full detail*.

### 6.1 ORGANIZATION IDENTITY & BRANDING CONFIGURATION

The tenant can configure:

#### 6.1.1 Branding Appearance

-   Company logo (PNG, JPG, SVG)

-   Portal banner

-   Light/dark mode default

-   Color palette customization:

    -   Primary color

    -   Secondary color

    -   Button color

    -   Link color

    -   Background tone

-   Font style selection (5 options)

-   Layout density (comfortable/compact)

-   Document branding for:

    -   Invoices

    -   PO

    -   Payslips

    -   Customer statements

    -   Vendor statements

#### 6.1.2 URL Personalization

-   Subdomain e.g., tenant.zivabi.com

-   Custom domain support (future enhancement)

#### 6.1.3 Email/SMS Branding

Tenant can configure:

-   Email header/footer

-   Sender email (via verification)

-   SMS sender ID (for supported countries)

-   Standardized message templates for:

    -   Approvals

    -   Rejections

    -   Account activation

    -   Password resets

    -   Notifications

    -   Reminders

### 6.2 MODULE ACTIVATION & SUBSCRIPTION CONTROLS

Tenant Admin can activate any available module:

### AP --- Accounts Payable

### AR --- Accounts Receivable

### Expense Management

### Payroll

### Inventory Management

### POSM Management

### Fixed Asset Management

### Vendor Portal

### Customer Portal

### 3PL Portal

### Bank Reconciliation

### Reporting & Analytics

### AI/ML Add-on

### Document OCR Engine

Functional behaviors:

-   Modules remain hidden until activated.

-   Each module requires tenant to complete a Setup Checklist.

-   Incomplete setup disables the module.

Setup Checklist Examples:

-   AP setup:

    -   Set COA mapping

    -   Configure vendor categories

    -   Configure tax rules

    -   Configure workflows

-   Payroll setup:

    -   Set salary structure

    -   Define statutory rules

    -   Configure pay cycles

-   Inventory setup:

    -   Select valuation method

    -   Define warehouses

    -   Configure product categories

### 6.3 ORGANIZATIONAL STRUCTURE SETUP

Tenant Admin defines the hierarchical and reporting structure.

#### 6.3.1 Departments

-   Create / edit / deactivate departments

-   Assign department heads

-   Link to cost centers (optional)

-   Set department code (unique)

#### 6.3.2 Cost Centers & Profit Centers

-   Create unlimited cost centers

-   Map cost centers to GL accounts

-   Set reporting hierarchy

-   Link to departments

#### 6.3.3 Business Units / Divisions

-   Support multi-BU and multi-entity organizations

-   Mapping rules for workflow routing

-   Reporting segmentation

#### 6.3.4 Warehouses

Supports:

-   Main warehouses

-   Regional hubs

-   3PL-managed warehouses

-   POSM storage centers

Metadata includes:

-   Address

-   GPS coordinate (optional)

-   Capacity

-   Assigned warehouse manager

-   Allowed valuation method override (optional)

#### 6.3.5 Legal Entities

Tenant can configure:

-   Separate entities

-   Separate TIN/VAT IDs

-   Bank accounts per entity

-   Separate financial periods

-   Separate FX rules

### 6.4 CHART OF ACCOUNTS (COA) CONFIGURATION

#### 6.4.1 COA Import

Supports:

-   Excel

-   CSV

-   TXT

-   PDF (with OCR)

-   API (ERP Sync)

System validates:

-   Duplicates

-   Missing hierarchy

-   Missing account types

-   Bad formatting

#### 6.4.2 Manual COA Management

Tenant can:

-   Add new GL accounts

-   Edit descriptions

-   Deactivate accounts

-   Group accounts

#### 6.4.3 COA Classification

Every account has:

-   Account Type (Asset/Liability/Equity/Income/Expense)

-   Sub-type

-   Financial Category:

    -   Balance Sheet (BS)

    -   Profit & Loss (PL1, PL2, PL3, PL4)

-   Group Account (for IFRS)

-   Reporting Tag (for analytics)

#### 6.4.4 Module-to-GL Mapping

Tenant configures GL mapping for:

-   AP defaults

-   AR defaults

-   Inventory adjustments

-   PPV account

-   POSM account

-   Payroll expense accounts

-   Salaries payable

-   WHT payable

-   VAT receivable/payable

-   Bank settlement

-   COGS

-   Revenue

-   Returns

-   FX gain/loss

Dynamic mapping per dimension also supported.

### 6.5 DIMENSIONS ENGINE CONFIGURATION

This engine is one of ZivaBI's most powerful features.

#### 6.5.1 Dimension Creation

Tenant can create unlimited dimensions, e.g.:

-   Real IO

-   Statistical IO

-   Cost Center IO

-   Material IO

-   Location

-   Region

-   Project

-   Event

-   Customer Group

-   Campaign

-   Sales Channel

#### 6.5.2 Dimension Rules

For each dimension:

-   Required/Optional

-   Mandatory for specific GL accounts

-   Mandatory for specific modules

-   Dropdown values

-   Description

-   Dimension owner

-   Effective dates

-   Budget-linked restrictions

#### 6.5.3 Advanced Dimension Behavior

-   Default value per user

-   Default value per module

-   Allow override: Yes/No

-   Dependent dimensions (E.g., choosing "Sponsorship" reveals "Event
    Code")

#### 6.5.4 Dimension Import & Sync

Import via:

-   Excel

-   CSV

-   ERP API

### 6.6 APPROVAL WORKFLOW BUILDER

Tenant Admin configures workflows for:

-   AP

-   Expense

-   Payroll

-   AR

-   Inventory

-   POSM

-   FA

-   Vendor onboarding

-   Customer onboarding

-   Leave

-   Bank reconciliation

#### 6.6.1 Workflow Types Supported

-   Sequential

-   Parallel

-   Conditional

-   Threshold-based

-   Scenario-based

-   Escalation flows

#### 6.6.2 Workflow Nodes

Nodes include:

-   User approval

-   Role approval

-   Department-based approval

-   Value-based approval

-   Exception override approval

-   Auto-approval

-   Auto-rejection

-   AI-suggested approval (future)

#### 6.6.3 Workflow Versioning

-   Each workflow update creates a new version

-   Old version applies to already-initiated requests

-   New version applies to new requests

### 6.7 DOCUMENT & KYC RULE CONFIGURATION

Tenant defines documents required for:

#### 6.7.1 Vendor Onboarding

Example:

-   CAC Certificate

-   Tax Clearance

-   Bank letter

-   Director ID

-   Utility bill

Rules include:

-   Mandatory / Optional

-   Expiry date required?

-   OCR extraction template

-   File size limit

#### 6.7.2 Customer Onboarding

E.g.,

-   Business license

-   Credit application form

-   Board resolution (optional)

#### 6.7.3 AP/Expense Documents

-   Invoice

-   PO

-   GRN

-   Support documents

-   VAT documents

#### 6.7.4 Payroll Documents

-   Staff KYC

-   Bank account proof

-   ID card

-   Contract letter

### 6.8 TAX, WHT, VAT & STATUTORY CONFIGURATION

#### 6.8.1 VAT Rules

Tenant can configure:

-   VAT %

-   Reverse VAT

-   VAT exempt categories

-   VAT per vendor category

-   VAT effective dates

#### 6.8.2 WHT Rules

Configure:

-   WHT rates

-   Vendor category rules

-   Resident / non-resident rules

-   Gross-up rules

-   Effective dates

#### 6.8.3 PAYROLL Statutory Rules

Configure:

-   PAYE tax tables

-   Pension %

-   NHF %

-   NSITF %

-   PAYE computation method

-   Country-specific rules

### 6.9 FX & CURRENCY CONFIGURATION

Tenant configures:

-   Local currency

-   Supported foreign currencies

-   FX source (CBN, Manual, API, Monthly fixed rate)

-   FX application (Approval date, Posting date, Invoice date)

-   Unrealized & realized FX rules

-   FX revaluation schedules

### 6.10 VENDOR CATEGORY & CUSTOMER CATEGORY CONFIGURATION

#### 6.10.1 Vendor Categories

Supports:

-   Professional services

-   Clearing agents

-   3PL

-   Import vendors

-   Event agencies

-   Utility vendors

-   Rent & Property

-   Insurance

-   One-off vendors

Each category has rules for:

-   Tax

-   WHT

-   VAT

-   Documents

-   PO requirement

-   Dimension requirement

-   Budget linkage

-   Invoice structure (single-line vs multi-line)

#### 6.10.2 Customer Categories

Supports:

-   Cash customers

-   Credit customers

-   Distributor

-   Reseller

-   Export customers

Rules include:

-   Credit limit

-   Payment terms

-   Dimension mapping

-   Pricing group

-   Rebate scheme

### 6.11 MODULE-SPECIFIC SETTINGS

Tenant Admin configures advanced rules for:

#### 6.11.1 AP Settings

-   Invoice approval rules

-   Duplicate invoice detection

-   Mandatory fields

-   WHT application rules

-   VAT application rules

#### 6.11.2 Expense Settings

-   Expense caps per employee

-   Expense type creation

-   Multi-currency rules

-   OCR validation rules

#### 6.11.3 Payroll Settings

-   Salary structures

-   Statutory compliance

-   Leave rules

-   Proration rules

-   Outsourced staff rules

#### 6.11.4 Inventory Settings

-   Valuation method

-   Damage categories

-   Inbound rules

-   3PL involvement

-   Product categorization

#### 6.11.5 AR Settings

-   Credit limit enforcement

-   Delivery approval rules

-   Returns handling

-   Dimension mapping for revenue & COGS

### 6.12 USER & ACCESS CONFIGURATION

#### 6.12.1 Roles

Tenant can create unlimited roles.

#### 6.12.2 Permissions

Permissions include:

-   Page access

-   Field-level masking

-   Module access

-   Workflow builder access

-   Data export permissions

-   Payroll visibility

#### 6.12.3 MFA Settings

Tenant-level setting:

-   Optional / Mandatory

-   For high-risk roles only

-   For all roles

### 6.13 NOTIFICATION CONFIGURATION

Tenant configures:

-   Email alerts

-   SMS alerts

-   Push notifications

-   Notification templates

-   Escalation rules

-   Reminder frequency

### 6.14 DATA IMPORT/EXPORT CONFIGURATION

Tenant defines:

-   Mapping templates

-   Validations

-   Mandatory fields

-   Duplicate handling rules

### 6.15 AI/ML CONFIGURATION

Tenant configures:

-   Enable/disable AI suggestions

-   Confidence threshold

-   Training feedback

-   Auto-categorization fallback rules

### 6.16 INTEGRATION & API CONFIGURATION

Tenant can:

-   Connect ERP

-   Connect banks

-   Connect payroll consultants

-   Connect 3PL partners

-   Configure API keys

-   Configure SSO (Google, Microsoft AD, Okta)

### 6.17 AUDIT & COMPLIANCE CONFIGURATION

Tenant configures:

-   Log retention

-   Document retention

-   Sensitive action approval

-   Blocking rules for compliance

-   Export rules

**SECTION 7 --- CONFIGURATION CATEGORIES & FLOWS**

This section explains HOW each configuration category behaves in the
system --- not only what it does (Section 6), but the logical flow,
validation mechanics, interdependencies, and activation sequences for
all tenant-level settings.

This is crucial for development, QA, architecture, and future
maintainability, because it defines:

-   Step-by-step flows

-   Preconditions

-   Post-conditions

-   Inter-module effects

-   Validation rules

-   Cascading impacts

-   UI/UX transitions

-   Error prevention mechanisms

-   Onboarding sequence

-   Version-control behavior

This is the "workflow DNA" of the Tenant Admin Portal.

## 7.0 OVERVIEW OF CONFIGURATION FLOWS

There are 12 Core Configuration Flows, each defining a complete
end-to-end setup process.

Each flow consists of:

1.  Activation / Entry Point

2.  Data Requirements

3.  Validation Rules

4.  Dependencies

5.  Save & Publish Actions

6.  Version Control Behavior

7.  Rollback Behavior

8.  Impact on Modules

9.  System Restrictions

10. Notifications

We will now detail all flows.

### 7.1 FLOW A --- ORGANIZATION IDENTITY & BRANDING CONFIGURATION

### Entry Point

Tenant Admin → Settings → Branding

### Steps

1.  Upload company logo (PNG/SVG/JPEG)

2.  Select primary & secondary colors

3.  Select font

4.  Choose layout density (comfortable/compact)

5.  Set subdomain (auto-check availability)

6.  Customize email headers/footers

7.  Select system-wide theme:

    -   Light

    -   Dark

    -   Auto

### Validation Rules

-   Logo max size 5MB

-   Subdomain must be unique

-   Color contrast ratio must meet WCAG

### Dependencies

-   None (independent category)

### Impact on Modules

-   Affects all module UI appearance

-   Affects document branding (payslips, statements, invoices)

### 7.2 FLOW B --- MODULE ACTIVATION FLOW

This determines how a module becomes available/usable for a tenant.

### Entry Point

Settings → Modules

### Steps

1.  Tenant Admin selects module to activate

2.  System opens a Setup Checklist

3.  User completes all required configuration items

4.  Validation on each item

5.  When 100% complete → Module becomes active

### Validation Rules

Each module has mandatory preconditions before activation.

Example:

For AP:

-   COA mapped

-   Tax rules set

-   Dimensions configured

-   Workflow defined

-   Vendor categories defined

### Dependencies

-   Chart of Accounts

-   Dimensions

-   Workflows

-   Document templates

### Impact on Modules

-   Activated module appears in navigation for assigned roles

-   Deactivated modules are hidden

### 7.3 FLOW C --- ORGANIZATIONAL STRUCTURE SETUP

### Entry Point

Settings → Organization Structure

### Steps

1.  Create departments

2.  Create cost centers

3.  Create business units

4.  Create warehouses

5.  Define reporting lines

6.  Assign department heads/managers

### Validation Rules

-   Department codes must be unique

-   Cost center cannot be assigned to more than one department

-   Warehouses cannot share same physical address unless flagged

### Dependencies

-   Approval workflows

-   Dimensions

-   HR structure

### Impact on Modules

-   Routing of approvals

-   Dimension defaults

-   Payroll grouping

-   Inventory ownership

### 7.4 FLOW D --- CHART OF ACCOUNTS (COA) CONFIGURATION FLOW

### Entry Point

Settings → Finance → Chart of Accounts

### Steps

1.  Upload COA file OR manually create accounts

2.  System validates:

    -   Duplicate account codes

    -   Missing categories

    -   Wrong value types

3.  Admin maps:

    -   Category (Asset, Liability, etc.)

    -   Financial group (PL1-4, BS)

    -   Group account

4.  System performs dependency check

5.  Publish COA

### Validation Rules

-   Cannot deactivate account used in mapping

-   Cannot deactivate account in active period

-   Warning if unassigned dimension

### Dependencies

-   Dimensions

-   Module-to-GL mapping

-   Inventory valuation methods

### Impact

-   Affects posting across ALL modules

### 7.5 FLOW E --- DIMENSIONS ENGINE CONFIGURATION FLOW

### Entry Point

Settings → Dimensions

### Steps

1.  Create new dimension (e.g., "Location")

2.  Define behavior rules:

    -   Required / Optional

    -   Dropdown items

    -   Effective date

3.  Map dimension to GL accounts

4.  Map dimension to modules

5.  Define default behavior per user/department

6.  Publish dimension

### Validation Rules

-   At least one dimension must be selected for PL accounts

-   If required = true → UI validation must enforce at module level

### Impact

-   Controls financial accuracy for all entries

-   Affects reporting and analytics

### 7.6 FLOW F --- APPROVAL WORKFLOW BUILDER FLOW

### Entry Point

Settings → Workflow Builder

### Steps

1.  Select process (AP, Expense, Payroll, etc.)

2.  Drag-and-drop approval stages

3.  Add conditional rules

4.  Add threshold-based approvals

5.  Add escalation rules

6.  Add fallback approver

7.  Preview workflow

8.  Save as Draft

9.  Publish workflow

### Validation Rules

-   No workflow can end without a final approver

-   No approval stage may be orphaned

-   Conditional rules must reference valid fields

-   Approvers must exist in system

### Dependencies

-   User roles

-   Organizational structure

-   Dimensions

### Version Control Behavior

-   Changes create new version

-   Active tasks remain on old version

### 7.7 FLOW G --- DOCUMENT & KYC RULE CONFIGURATION FLOW

### Entry Point

Settings → Documents & KYC

### Steps

1.  Select process (Vendor onboarding, AP, AR, Payroll)

2.  Add required documents

3.  For each document define:

    -   Mandatory

    -   Expiry handling

    -   OCR template

    -   File size limit

    -   File count limit

4.  Save & publish

### Validation Rules

-   Mandatory documents must be uploaded before submission

-   KYC documents must not be expired

### Impact

-   Ensures compliance and audit readiness

### 7.8 FLOW H --- TAX, VAT, WHT & STATUTORY CONFIGURATION FLOW

### Entry Point

Settings → Taxation

### Steps

1.  Select tax type

2.  Define rates

3.  Define rules per vendor category

4.  Define exemptions

5.  Define effective date

6.  System checks conflicts

7.  Publish rules

### Validation Rules

-   Effective date must not overlap with existing rules

-   Tax rate must be > 0 unless exempt

### Impact

-   AP invoice posting

-   AR invoice posting

-   Payroll statutory deduction

-   FX revaluation

### 7.9 FLOW I --- CURRENCY & FX RULE CONFIGURATION FLOW

### Entry Point

Settings → Currency & FX

### Steps

1.  Select primary currency

2.  Add supported currencies

3.  Set FX rate source

4.  Set FX application rule

5.  Set revaluation frequency

6.  Set gain/loss accounts

7.  Publish

### Validation Rules

-   Cannot use FX rules without mapping gain/loss accounts

-   Cannot change base currency after financial year begins

### 7.10 FLOW J --- VENDOR CATEGORY CONFIGURATION FLOW

### Entry Point

Settings → Vendor Categories

### Steps

1.  Create category

2.  Assign:

    -   GL rules

    -   Tax rules

    -   Document rules

    -   Dimension rules

    -   Invoice structure rules

    -   PO requirement rules

3.  Publish

### Dependencies

-   AP module

-   Workflow builder

### 7.11 FLOW K --- CUSTOMER CATEGORY CONFIGURATION FLOW

### Entry Point

Settings → Customer Categories

### Steps

1.  Create category

2.  Assign credit terms

3.  Assign dimension mapping

4.  Assign pricing rules

5.  Assign rebate rules

6.  Publish

### 7.12 FLOW L --- MODULE-SPECIFIC SETTINGS FLOW

### Entry Point

Settings → Module Settings

### General Steps

1.  Select module

2.  Open configuration wizard

3.  Complete required settings

4.  Validate dependencies

5.  Publish

### 7.13 FLOW M --- USER, ACCESS, & SECURITY CONFIGURATION FLOW

### Entry Point

Settings → User Management

### Steps

1.  Create role

2.  Assign permissions

3.  Apply field masking rules

4.  Assign to users

5.  Configure MFA for roles

6.  Publish

### Impact

-   Entire portal security

### 7.14 FLOW N --- NOTIFICATION CONFIGURATION FLOW

### Entry Point

Settings → Notifications

### Steps

1.  Select notification type

2.  Edit template (with variables)

3.  Set trigger events

4.  Set escalation

5.  Publish

### 7.15 FLOW O --- IMPORT/EXPORT TEMPLATE CONFIGURATION FLOW

### Entry Point

Settings → Data Templates

### Steps

1.  Upload sample file

2.  Map fields

3.  Define validation rules

4.  Save as template

### 7.16 FLOW P --- AI/ML CONFIGURATION FLOW

### Entry Point

Settings → AI/Automation

### Steps

1.  Enable/disable AI

2.  Set confidence threshold

3.  Choose modules for auto-suggestions

4.  Publish

### 7.17 FLOW Q --- INTEGRATION CONFIGURATION FLOW

### Entry Point

Settings → Integrations

### Steps

1.  Select integration type

2.  Enter API keys

3.  Enter endpoint URLs

4.  Validate connection

5.  Publish

### 7.18 FLOW R --- AUDIT & COMPLIANCE CONFIGURATION FLOW

### Entry Point

Settings → Compliance

### Steps

1.  Select log retention

2.  Select document retention

3.  Set compliance rules

4.  Publish

**SECTION 8 --- DATA MODEL**

This section defines the full database schema, data relationships,
entities, attributes, and logical structures needed to support the
Tenant Admin Portal. It establishes the foundational dataset shared
across all ZivaBI modules.

This is one of the most critical sections because Tenant Admin Portal
data controls how the entire platform behaves.

The data model is designed for:

-   Multi-tenant isolation

-   Future scalability

-   High configurability

-   Cross-module reusability

-   Strict auditability

-   Low coupling, high modularity

To maintain clarity, we break the Tenant Admin Data Model into 14 core
entity groups.

## 8.0 ENTITY GROUP OVERVIEW

1.  Tenant Entities

2.  Organization Structure Entities

3.  User & Role Entities

4.  COA & Financial Mapping Entities

5.  Dimensions Entities

6.  Workflow Builder Entities

7.  Document & KYC Entities

8.  Tax/VAT/WHT Entities

9.  Currency & FX Entities

10. Vendor Category Entities

11. Customer Category Entities

12. Module Settings Entities

13. Integration Entities

14. Audit & Compliance Entities

Each group is detailed below with attributes, relationships, and data
governance rules.

### 8.1 TENANT ENTITIES

#### 8.1.1 Tenant

Purpose: Defines the company using ZivaBI.

Fields:

-   tenant_id (PK)

-   tenant_name

-   industry_type

-   primary_currency

-   country

-   timezone

-   logo_url

-   theme_primary_color

-   theme_secondary_color

-   theme_mode (light/dark/auto)

-   active_modules (list)

-   status (active/suspended/terminated)

-   date_created

-   subscription_plan

-   admin_contact_email

Relationships:

-   1 Tenant → Many Users

-   1 Tenant → Many Entities (business units)

### 8.2 ORGANIZATIONAL STRUCTURE ENTITIES

#### 8.2.1 Department

-   department_id (PK)

-   tenant_id

-   department_name

-   department_code

-   head_user_id

-   status

#### 8.2.2 Cost Center

-   cost_center_id

-   tenant_id

-   center_code

-   center_name

-   department_id

-   status

#### 8.2.3 Business Unit / Entity

-   entity_id

-   tenant_id

-   entity_name

-   entity_code

-   TIN

-   legal_address

-   is_primary_entity

#### 8.2.4 Warehouse

-   warehouse_id

-   warehouse_code

-   tenant_id

-   name

-   address

-   manager_user_id

-   is_3pl

-   valuation_override

-   status

Relationships:

-   Department → Cost Center (1:M)

-   Tenant → Business Units (1:M)

-   Tenant → Warehouses (1:M)

### 8.3 USER & ROLE ENTITIES

#### 8.3.1 User

-   user_id

-   tenant_id

-   first_name

-   last_name

-   email

-   phone

-   role_ids (list)

-   department_id

-   custom_field_values

-   mfa_enabled

-   status

#### 8.3.2 Role

-   role_id

-   tenant_id

-   role_name

-   permissions (JSON array)

-   accessible_modules (JSON)

-   field_masking_rules

#### 8.3.3 Permission

-   permission_id

-   permission_name

-   Modules

-   Actions

Relationships:

-   User ←→ Roles (M:M)

-   Roles ←→ Permissions (M:M)

### 8.4 COA & FINANCIAL MAPPING ENTITIES

#### 8.4.1 Chart of Account

-   gl_id

-   tenant_id

-   account_code

-   account_name

-   account_type (Asset/Liability/PL etc.)

-   financial_group (PL1-PL4, BS)

-   group_account

-   is_active

#### 8.4.2 GL Mapping

Mapping for module operations:

-   mapping_id

-   tenant_id

-   module_type

-   transaction_type

-   dimension_rules

-   default_gl_id

-   override_rules

### 8.5 DIMENSION ENTITIES

#### 8.5.1 Dimension

-   dimension_id

-   tenant_id

-   name

-   label (custom field label)

-   is_required

-   applicable_modules (JSON array)

-   activation_date

-   status

#### 8.5.2 Dimension Values

-   value_id

-   dimension_id

-   value_code

-   value_name

-   is_default

-   status

#### 8.5.3 Dimension-to-GL Mapping

-   map_id

-   dimension_id

-   gl_id

### 8.6 WORKFLOW BUILDER ENTITIES

#### 8.6.1 Workflow Definition

-   workflow_id

-   tenant_id

-   process_type

-   version_number

-   is_active

-   created_by

-   created_at

#### 8.6.2 Workflow Stages

-   stage_id

-   workflow_id

-   order

-   stage_type (User, Role, Conditional, Parallel)

-   approver_role_id

-   approver_user_id

-   threshold_value

-   conditions_json

### 8.7 DOCUMENT & KYC ENTITIES

#### 8.7.1 Document Template

-   doc_template_id

-   tenant_id

-   process_type

-   doc_name

-   is_mandatory

-   validity_required

-   max_file_size

-   accepted_types

-   ocr_enabled

#### 8.7.2 Document Upload Record

-   doc_id

-   uploaded_by

-   uploaded_at

-   linked_to_request_id

-   doc_template_id

-   status (valid, expired, pending review)

### 8.8 TAX / WHT / VAT / STATUTORY ENTITIES

#### 8.8.1 Tax Rule

-   tax_rule_id

-   tenant_id

-   tax_type

-   rate

-   applicable_category

-   effective_from

-   effective_to

-   exemption_rules

#### 8.8.2 WHT Rule

-   wht_rule_id

-   vendor_category_id

-   rate

-   gross_up

#### 8.8.3 VAT Rule

-   vat_rule_id

-   vat_rate

-   applicable_category

#### 8.8.4 Statutory Payroll Table

-   table_id

-   country_id

-   brackets_json

### 8.9 CURRENCY & FX ENTITIES

#### 8.9.1 Currency Setup

-   currency_id

-   tenant_id

-   currency_code

-   symbol

-   is_primary

#### 8.9.2 FX Rule

-   fx_id

-   rate_source

-   apply_on (posting date, approval date, invoice date)

-   gain_gl_id

-   loss_gl_id

### 8.10 VENDOR CATEGORY ENTITIES

#### 8.10.1 Vendor Category

-   vendor_category_id

-   name

-   rules_json

-   dimension_rules_json

-   tax_rules_json

-   document_rules_json

### 8.11 CUSTOMER CATEGORY ENTITIES

#### 8.11.1 Customer Category

-   customer_category_id

-   name

-   credit_limit

-   payment_terms

-   dimension_mapping_json

-   pricing_rules

### 8.12 MODULE SETTINGS ENTITIES

#### 8.12.1 AP / AR / Expense / Payroll / Inventory / POSM Settings

Each module has:

-   setting_id

-   tenant_id

-   module_type

-   settings_json

Examples of settings_json:

{

\"expense_cap_enabled\": true,

\"default_currency\": \"NGN\",

\"ocr_strict_validation\": true

}

### 8.13 INTEGRATION ENTITIES

#### 8.13.1 Integration Definition

-   integration_id

-   tenant_id

-   provider_name

-   api_key

-   endpoint_url

-   scope (ERP, bank, tax authority)

-   status

#### 8.13.2 SSO Setup

-   sso_id

-   tenant_id

-   provider (Google, Microsoft, Okta)

-   client_id

-   client_secret

-   redirect_uri

### 8.14 AUDIT & COMPLIANCE ENTITIES

#### 8.14.1 Audit Logs

-   log_id

-   tenant_id

-   user_id

-   action_type

-   entity_type

-   before_value_json

-   after_value_json

-   timestamp

-   ip_address

#### 8.14.2 Retention Rules

-   retention_id

-   tenant_id

-   log_retention_period

-   document_retention_period

-   mask_rules

### 8.15 RELATIONSHIP SUMMARY

### Key relationships include:

-   Tenant → Users → Roles

-   Tenant → COA → GL Mapping

-   Tenant → Dimensions → Values → GL Rules

-   Tenant → Workflows → Stages

-   Tenant → Vendor Categories → Rules

-   Tenant → Customer Categories → Rules

-   Tenant → Modules → Settings

-   Tenant → Integrations

-   Tenant → Audit Logs

This model ensures:

-   Full multi-tenant separation

-   Complete flexibility

-   Strong auditability

-   Consistent behavior across modules

**SECTION 9 --- WORKFLOW DIAGRAMS**

This section provides visual workflow descriptions in text form (since
diagrams cannot be drawn here directly), but they are written in a
diagram-equivalent structured format so designers, engineers, and BPMN
modelers can easily convert them into:

-   BPMN diagrams

-   Flowcharts

-   Sequence diagrams

-   ERD expansions

-   Swimlane diagrams

The workflows defined here illustrate the full end-to-end logic for each
major configuration category of the Tenant Admin Portal.

You will be able to copy/paste these into Draw.io, Lucidchart, or Visio
for graphical representation.

### Overview of Workflow Diagrams

We will describe workflows for:

1.  Branding & Identity Setup

2.  Module Activation Flow

3.  Organizational Structure Setup

4.  Chart of Accounts Import & Publish

5.  Dimensions Setup Flow

6.  Approval Workflow Builder

7.  Document & KYC Rules Setup

8.  Tax/VAT/WHT Rule Setup

9.  FX & Currency Rule Setup

10. Vendor Category Configuration

11. Customer Category Configuration

12. Module Settings Flow

13. Roles & Access Flow

14. Notification Setup Flow

15. Integrations & API Setup

16. Audit Configuration Flow

17. AI/Automation Setup Flow

Each workflow will follow the same format:

-   Start Event

-   User Actions

-   System Validations

-   Decision Branches

-   Exceptions

-   Approval Points (if any)

-   End State

Let's begin.

### 9.1 WORKFLOW A --- BRANDING & IDENTITY SETUP

Start

↓

Tenant Admin opens Branding Setup Page

↓

Admin uploads company logo

→ System checks file format & size

→ If invalid → Error notification → Back to upload

↓

Admin selects primary/secondary colors

→ System checks WCAG contrast compliance

→ If fail → Suggest alternative colors

↓

Admin selects font + layout density

↓

Admin sets subdomain

→ System checks subdomain availability

→ If taken → Prompt alternative options

↓

Admin configures email/SMS templates

↓

Admin clicks "Save & Publish"

↓

System updates tenant appearance globally

↓

END

### 9.2 WORKFLOW B --- MODULE ACTIVATION

Start

↓

Tenant Admin opens "Modules & Subscriptions"

↓

Admin selects a module to activate (e.g., AP)

↓

System loads Setup Checklist

↓

Admin completes each checklist item

→ Configure COA mapping

→ Configure Tax/WHT rules

→ Configure Dimensions

→ Configure Workflows

→ Configure Document Rules

↓

System validates each item

→ If incomplete → Block activation

↓

Checklist = 100%

↓

Admin clicks "Activate Module"

↓

System makes module available to authorized roles

↓

END

Start

↓

Tenant Admin opens "Modules & Subscriptions"

↓

Admin selects a module to activate (e.g., AP)

↓

System loads Setup Checklist

↓

Admin completes each checklist item

→ Configure COA mapping

→ Configure Tax/WHT rules

→ Configure Dimensions

→ Configure Workflows

→ Configure Document Rules

↓

System validates each item

→ If incomplete → Block activation

↓

Checklist = 100%

↓

Admin clicks "Activate Module"

↓

System makes module available to authorized roles

↓

END

### 9.3 WORKFLOW C --- ORGANIZATIONAL STRUCTURE SETUP

Start

↓

Tenant Admin navigates to Organization Structure

↓

Admin adds/edits Departments

↓

Admin adds/edits Cost Centers

→ System validates uniqueness of codes

↓

Admin adds Business Units

↓

Admin adds Warehouses

↓

Admin defines reporting structure

↓

System performs dependency check

↓

Admin publishes structure

↓

Changes propagate to workflows, dimensions, inventory, payroll

↓

END

### 9.4 WORKFLOW D --- COA IMPORT & PUBLISH

Start

↓

Tenant Admin uploads COA file (Excel/CSV/TXT/PDF via OCR)

↓

System parses file

→ Validates format

→ Checks for duplicates

→ Checks mandatory columns

↓

If errors → Show error list → Admin corrects → Re-upload

↓

If clean → Admin reviews preview

↓

Admin maps financial categories

↓

Admin confirms mapping

↓

System validates dependencies

→ If mapped GL missing → Block publish

↓

Admin clicks "Publish COA"

↓

COA becomes active across all modules

↓

END

### 9.5 WORKFLOW E --- DIMENSION CREATION & MAPPING

Start

↓

Tenant Admin opens Dimensions

↓

Admin clicks "Create Dimension"

↓

Admin enters:

→ Name

→ Label

→ Required/Optional

→ Applicable Modules

↓

Admin adds dimension values (codes + names)

↓

Admin maps dimension to GL accounts

↓

System checks conflicts:

→ Required dimension must be mapped

↓

Admin publishes dimension

↓

Modules update dimension dropdowns immediately

↓

END

### 9.6 WORKFLOW F --- APPROVAL WORKFLOW BUILDER

Start

↓

Admin opens Workflow Builder

↓

Admin selects process (e.g., Expense Retirement)

↓

System loads current workflow (if exists)

↓

Admin drags approval nodes:

→ Role Approval

→ Conditional Approval

→ Value-based Approval

→ Parallel Approval

↓

Admin configures conditions & thresholds

↓

Admin clicks Preview

↓

System runs logic simulation

→ If logic inconsistent → Error message

↓

Admin clicks Publish

↓

New workflow version created

↓

Old tasks continue using old version

↓

END

### 9.7 WORKFLOW G --- DOCUMENT & KYC RULE SETUP

Start

↓

Admin navigates to Documents & KYC

↓

Admin selects process (Vendor Onboarding, AP Invoice...)

↓

Admin adds document list

↓

Admin sets:

→ Mandatory / Optional

→ Expiry Needed

→ OCR Template

→ File Size Limit

↓

Admin publishes document rules

↓

System updates form requirements across modules

↓

END

### 9.8 WORKFLOW H --- TAX/VAT/WHT RULE SETUP

Start

↓

Admin navigates to Taxation

↓

Admin selects tax type (VAT/WHT/PAYE/Regional Tax)

↓

Admin enters rate, category, exemptions

↓

Admin sets effective date

↓

System checks:

→ Overlapping dates

→ Missing categories

↓

Admin publishes tax rule

↓

AP/AR/Payroll update calculations immediately

↓

END

### 9.9 WORKFLOW I --- CURRENCY & FX RULE SETUP

Start

↓

Admin opens Currency & FX

↓

Admin selects base currency

↓

Admin chooses FX rate source

↓

Admin sets:

→ Application rule

→ Rate frequency

→ Gain/Loss GL

↓

System validates GL mapping completeness

↓

Admin publishes

↓

FX Engine applies new rules

↓

END

### 9.10 WORKFLOW J --- VENDOR CATEGORY CONFIGURATION

Start

↓

Admin opens Vendor Categories

↓

Admin clicks "Create Category"

↓

Admin sets:

→ Tax rules

→ Document requirements

→ PO rules

→ Dimension rules

→ Invoice structure rules

↓

System validates logical consistency

↓

Admin publishes

↓

Vendor Onboarding Portal updates configuration

↓

END

### 9.11 WORKFLOW K --- CUSTOMER CATEGORY CONFIGURATION

Start

↓

Admin opens Customer Categories

↓

Admin creates category

↓

Admin sets:

→ Credit rules

→ Dimension mapping

→ Pricing rules

→ Rebate rules

↓

Admin publishes

↓

AR processes adopt category behavior

↓

END

### 9.12 WORKFLOW L --- MODULE SETTINGS CONFIGURATION

Start

↓

Admin opens Module Settings

↓

Admin selects specific module (AP/Pay/Inventory...)

↓

System loads module-specific fields

↓

Admin configures rules

↓

Admin saves

↓

Module updates configuration in real time

↓

END

### 9.13 WORKFLOW M --- USER, ROLES & SECURITY SETUP

Start

↓

Admin opens User Management

↓

Admin creates roles

↓

Admin assigns permissions & masking rules

↓

Admin adds users

↓

Admin assigns roles

↓

System validates no conflicting permissions

↓

Admin publishes

↓

Access control updates immediately

↓

END

Start

↓

Admin opens User Management

↓

Admin creates roles

↓

Admin assigns permissions & masking rules

↓

Admin adds users

↓

Admin assigns roles

↓

System validates no conflicting permissions

↓

Admin publishes

↓

Access control updates immediately

↓

END

### 9.14 WORKFLOW N --- NOTIFICATION SETUP

Start

↓

Admin opens Notifications

↓

Admin edits:

→ Email templates

→ SMS templates

→ Escalation logic

↓

Admin previews message

↓

Admin publishes

↓

Notification engine updates templates

↓

END

### 9.15 WORKFLOW O --- INTEGRATIONS & API SETUP

Start

↓

Admin opens Integrations

↓

Admin selects ERP/Bank/3PL provider

↓

Admin enters API key & endpoint

↓

System tests connection

↓

If successful → Save & Publish

If failure → Error message

↓

Integration Hub activates connector

↓

END

### 9.15 WORKFLOW O --- INTEGRATIONS & API SETUP

Start

↓

Admin opens Integrations

↓

Admin selects ERP/Bank/3PL provider

↓

Admin enters API key & endpoint

↓

System tests connection

↓

If successful → Save & Publish

If failure → Error message

↓

Integration Hub activates connector

↓

END

### 9.16 WORKFLOW P --- AUDIT & COMPLIANCE SETUP

Start

↓

Admin opens Compliance Settings

↓

Admin sets log/document retention

↓

Admin sets compliance rules

↓

Admin saves

↓

Audit Engine updates retention logic

↓

END

### 9.17 WORKFLOW Q --- AI/AUTOMATION SETUP

Start

↓

Admin opens AI/Automation Center

↓

Admin enables/disables modules

↓

Admin sets confidence threshold

↓

Admin selects auto-categorization behaviors

↓

Admin publishes

↓

AI Engine updates inference behavior

↓

END

**SECTION 10 --- UI / USER INTERFACE REQUIREMENTS**

Purpose of this section:

Define WHAT the user sees and interacts with inside the Tenant Admin
Portal.

This includes:

-   Page layouts

-   Menu structures

-   Input controls

-   Dynamic fields

-   Validation messaging

-   Modals, wizards, and step-by-step flows

-   Role-based visibility

-   Mobile responsiveness

-   Accessibility requirements

-   UX principles

-   Error-handling

-   Internationalization

This ensures:

-   Developers build the correct screens

-   UI/UX designers have clarity

-   QA testers know expected behaviors

-   No ambiguity in how the tenant configures the system

-   The portal remains user-friendly even with extreme configurability

## 10.0 GENERAL UI PRINCIPLES (GLOBAL)

The entire Tenant Admin Portal UI must follow:

#### 10.0.1 Modern UI Framework

-   Clean, minimal design

-   Light & dark mode support

-   High contrast for accessibility

-   Smooth animations (non-distracting)

-   Mobile responsive using collapsible panels

#### 10.0.2 Layout Structure

Every screen must follow the same consistent layout:

-   Left fixed navigation

-   Top global header

-   Main content panel

-   Right-side slide-over panel (when editing)

#### 10.0.3 Control Types

The system must support:

-   Dropdowns

-   Multi-select

-   Searchable dropdowns

-   Toggle switches

-   Radio groups

-   Date pickers

-   Multi-step progress wizards

-   Drag-and-drop builders

-   Dynamic tables

-   Expandable accordions

-   JSON editors (advanced settings)

-   Validation indicators

-   Inline warnings

#### 10.0.4 Accessibility

-   WCAG 2.1 AA compliance

-   Keyboard navigation

-   VoiceOver screen reader support

-   ARIA labels

### 10.1 TENANT ADMIN PORTAL DASHBOARD

#### 10.1.1 Dashboard Components

The dashboard must show:

A. Setup Progress Indicators

For each major area:

-   Organization Structure

-   Module Activation

-   Tax Engine Setup

-   Workflow Builder

-   Dimensions

-   COA Mapping

-   Document/KYC Rules

-   Integrations

Each item has:

-   Progress bar

-   Status (Not Started / In Progress / Complete)

-   "Resume Setup" button

B. Alerts & Warnings

Examples:

-   Missing GL mapping

-   Conflicting tax rules

-   Expiring KYC requirements

-   Workflow with no final approver

-   Inactive dimensions used in modules

C. Quick Actions

-   Add User

-   Add Dimension

-   Add Workflow

-   Add GL Account

-   Add Vendor Category

D. System Health Summary

-   Integration status

-   API connectivity

-   Pending workflow updates

### 10.2 ORGANIZATION IDENTITY UI REQUIREMENTS

#### 10.2.1 Branding Page

Fields must include:

-   Company logo uploader

-   Favicon uploader

-   Primary and secondary color pickers

-   Font selector

-   Layout density selector

-   Subdomain checker

-   Email template editor

-   SMS template editor

#### 10.2.2 Live Preview Panel

Right side shows real-time preview:

-   Button styles

-   Headings

-   Cards

-   Email templates

### 10.3 MODULE ACTIVATION UI

Each module tile shows:

-   Module name

-   Description

-   Setup required items

-   Status (inactive/active)

-   "Start Setup" button

### Clicking a module opens a Setup Wizard:

Step 1: Requirements Overview

Step 2: Prerequisite Configurations

Step 3: Mapping & Rules

Step 4: Workflow

Step 5: Document Rules

Step 6: Summary

Step 7: Activate Module

### Visual Indicators:

-   ✔ Completed

-   ⚠ Missing

-   ✖ Blocked

### 10.4 ORGANIZATION STRUCTURE UI

#### 10.4.1 Departments Page

-   Table list of departments

-   Add/Edit department modal

-   Department codes auto-generated or user input

-   Assign department head

-   Link cost centers

#### 10.4.2 Cost Centers Page

-   Multi-level hierarchy support

-   Searchable tree view

-   Add/Deactivate toggle

#### 10.4.3 Business Units Page

-   Entity setup fields: Name, TIN, Address, FX rules

-   "Set as Primary Entity" toggle

#### 10.4.4 Warehouse Page

Supports:

-   Add warehouse

-   Mark as 3PL-operated

-   Assign manager

-   Add GPS coordinates

-   Add additional metadata

### 10.5 CHART OF ACCOUNTS (COA) UI

#### 10.5.1 COA Upload Screen

Includes:

-   Drag-and-drop upload

-   Template download

-   COA preview table

-   Error panel

-   Column mapping tool

#### 10.5.2 COA Management Screen

Columns:

-   GL Code

-   GL Name

-   Category

-   PL/BS classification

-   Status

-   Edit (inline or modal)

### 10.6 DIMENSIONS ENGINE UI

#### 10.6.1 Dimensions List

Table shows:

-   Dimension Name

-   Required?

-   Modules applied

-   Status

#### 10.6.2 Create/Edit Dimension Wizard

Step 1: Basic Info

Step 2: Dropdown Values

Step 3: GL Mapping

Step 4: Module Mapping

Step 5: Behavior Rules

### UX Requirements:

-   Add value inline in table

-   Multi-value import option

-   Searchable dropdowns

### 10.7 WORKFLOW BUILDER UI

This is one of the most important UIs.

#### 10.7.1 Canvas Layout

-   Drag-and-drop nodes

-   Zoom controls

-   Pan across canvas

-   Grid background

#### 10.7.2 Node Types

-   Approve Role

-   Approve User

-   Conditional

-   Threshold

-   Parallel

-   Auto-approve

-   Auto-reject

#### 10.7.3 Node Properties Panel

Right slide-in panel:

-   Approver selection

-   Condition builder (IF/ELSE)

-   Threshold entry

-   Escalation rules

-   Effective dates

#### 10.7.4 Version Control UI

-   Show version history

-   Compare versions

-   Clone version

-   Archive version

### 10.8 DOCUMENT & KYC CONFIGURATION UI

#### 10.8.1 Document Rule Table

Columns:

-   Document Name

-   Mandatory?

-   Expiry required?

-   File types

-   File count limit

-   OCR enabled?

-   Edit/Delete

#### 10.8.2 OCR Mapping UI

-   Drag-and-drop field mapping

-   AI-suggested fields

-   Sample document preview

### 10.9 TAX, VAT, WHT UI

#### 10.9.1 Tax Rule Builder

Fields:

-   Tax Name

-   Tax Type (VAT, WHT, Levy, Custom)

-   Applicable Vendor Categories

-   Applicable Customer Categories

-   Tax Rate

-   Calculation Mode

-   Effective from / to

-   Jurisdiction selector

-   Exemption rules

#### 10.9.2 Multi-Rate Tax Support

UI must support adding multiple rates under one tax type.

#### 10.9.3 Warning Panel

Warnings show:

-   Overlapping rules

-   Expired tax

-   Missing remittance GL

-   Missing withholding rules

### 10.10 CURRENCY & FX UI

### Includes:

-   Base currency selector

-   FX source selector (API/manual/CBN)

-   Gain/Loss GL assignment

-   Revaluation rule toggle

### 10.11 VENDOR CATEGORY UI

-   "Create Vendor Category" modal

-   Category code auto-generation

-   Tax rules panel

-   Document rules panel

-   Invoice structure type selector

-   PO requirement rules

### 10.12 CUSTOMER CATEGORY UI

Similar to vendor category, but includes:

-   Credit limit

-   Payment terms

-   Pricing rules

-   Rebate settings

### 10.13 MODULE SETTINGS UI

Each module has its own configuration page with:

-   Toggles

-   Dropdowns

-   Dynamic forms

-   JSON advanced options

-   Reset-to-default button

### 10.14 USER & ROLE MANAGEMENT UI

### Role Editor Page

-   Permissions grouped by module

-   Field masking previews

-   Dimension access

-   Multi-select permissions

### User Management Page

-   Invite user

-   Assign/remove roles

-   Activate/deactivate user

-   MFA status

-   Last login

### 10.15 NOTIFICATION SETTINGS UI

### Email Template Editor:

-   Rich text editor

-   Variables panel ({UserName}, {Amount}, etc.)

-   Test send

### SMS Template Editor

### Push Notification Toggles

### Escalation Rule Builder

### 10.16 INTEGRATION UI

### ERP Integration Page:

-   Endpoint URL

-   API Key

-   Test Connection button

-   Sync history

### Bank Integration Page:

-   Token-based setup

-   Account linking

-   Status indicator

### 10.17 AUDIT & COMPLIANCE UI

-   Log retention dropdown

-   Document retention dropdown

-   Compliance toggles

-   View-only audit trail

-   Export logs

### 10.18 AI/ML CONFIGURATION UI

-   Enable AI toggle

-   Select modules

-   Confidence threshold slider

-   Exception rules

**SECTION 11 --- NON-FUNCTIONAL REQUIREMENTS (NFRs)**

This section defines the technical quality standards the Tenant Admin
Portal must meet across:

-   Performance

-   Reliability

-   Scalability

-   Availability

-   Security

-   Data protection

-   Usability

-   Maintainability

-   Observability

-   Localization & internationalization

-   Compliance

-   Disaster recovery

-   Compatibility

These govern how the system behaves under real operational conditions.

This PRD section applies to the Tenant Admin Portal, but also impacts
all ZivaBI modules globally because the Tenant Admin Portal is the
control center for platform-wide configuration.

## 11.0 OVERVIEW

ZivaBI is designed to be an enterprise-grade platform used by:

-   Multinational organizations

-   Multi-location companies

-   Multi-department structures

-   Businesses with complex workflows

-   Organizations operating in regulated environments

Therefore, strict non-functional standards are mandatory.

Below is the detailed specification.

### 11.1 PERFORMANCE REQUIREMENTS

#### 11.1.1 Portal Loading Performance

-   Initial page load: < 2.5 seconds on broadband

-   Subsequent screen loads: < 1.2 seconds

-   Mobile load target: < 3.0 seconds

#### 11.1.2 Workflow Builder Performance

-   Workflows up to 50 nodes: instant drag-and-drop (< 200ms)

-   Workflows up to 200 nodes: max 1 second UI refresh

#### 11.1.3 Bulk Operations

-   COA upload < 10,000 rows → processed in < 20 seconds

-   Dimension value import up to 5,000 rows → < 10 seconds

-   User provisioning up to 1,000 users → < 15 seconds

#### 11.1.4 Search & Filtering

Search must return results for:

-   Users

-   COA

-   Dimensions

-   Categories

-   Workflows

All searches must return in < 300ms under normal load.

### 11.2 SCALABILITY REQUIREMENTS

#### 11.2.1 Horizontal Scaling

Platform must scale automatically:

-   API layer

-   Workflow engine

-   Document/KYC engine

-   Tax engine

-   Authentication layer

#### 11.2.2 Tenant Scaling

Each tenant must operate in logical isolation with:

-   Separate configuration sets

-   Separate audit trails

-   Separate workflows

-   Separate COA

-   Separate tax engine rules

#### 11.2.3 User Growth

Must support:

-   1--50,000 users per tenant

-   Unlimited departments, cost centers

-   Unlimited dimensions

-   Unlimited workflow rules

-   Unlimited vendor/customer categories

#### 11.2.4 Multi-Region Scaling

Latency must remain stable across:

-   Africa

-   Europe

-   Middle East

-   North America

-   Asia Pacific

### 11.3 AVAILABILITY REQUIREMENTS

#### 11.3.1 Uptime

-   99.95% uptime (excluding maintenance windows)

-   Allows ≤ 22 minutes downtime per month

#### 11.3.2 Maintenance

-   Scheduled maintenance at low-usage hours

-   No configuration loss during maintenance

-   Hot-reload for configuration updates

### 11.4 RELIABILITY REQUIREMENTS

#### 11.4.1 Configuration Reliability

-   No partial configuration states

-   No silent failures

-   Rollback available for every configuration action

-   Versioning for:

    -   Workflows

    -   COA

    -   Tax rules

    -   Dimensions

    -   Categories

    -   Integrations

#### 11.4.2 Consistency

-   Strong data consistency for all write operations

-   Eventual consistency permitted for reporting

### 11.5 SECURITY REQUIREMENTS

#### 11.5.1 Authentication

-   MFA optional per tenant or per role

-   SSO support (Google, Microsoft, Okta, Azure AD)

-   OAuth2 + JWT for API access

-   Password hashing with bcrypt/argon2

#### 11.5.2 Authorization

-   Fine-grained RBAC (Role-Based Access Control)

-   Field-level masking support

-   Module-level restrictions

-   User-level overrides

#### 11.5.3 Network Security

-   TLS 1.2+

-   Encrypted API communication

-   DDoS protection

-   IP allowlisting (optional)

#### 11.5.4 Data Encryption

-   Encryption in transit

-   Encryption at rest

-   Sensitive fields double-encrypted (salary, tax IDs, bank accounts)

#### 11.5.5 Tenant Isolation

Absolutely mandatory:

-   No cross-tenant data visibility

-   No cross-tenant API leakage

-   No cross-tenant configuration inheritance

-   Shared nothing at logical layer

### 11.6 DATA INTEGRITY REQUIREMENTS

#### 11.6.1 Validation Controls

Every configuration change must pass:

-   Type validation

-   Format validation

-   Dependency checks

-   Circular reference detection

#### 11.6.2 Safe Publish Mechanism

Publishing must not disrupt:

-   Active workflows

-   Open transactions

-   Ongoing approvals

Old versions remain active until new ones take effect.

#### 11.6.3 Automatic Audit Logging

All configuration actions must be logged:

-   Who changed what

-   Old vs new values

-   Timestamp

-   IP address

-   Role and user ID

-   Context

### 11.7 USABILITY REQUIREMENTS

#### 11.7.1 UX Simplicity

Even though the system is powerful, UI must remain:

-   Easy to navigate

-   Clean

-   Non-technical

-   Minimal cognitive load

-   Wizard-driven

-   Contextual help enabled

#### 11.7.2 Mobile-Friendly

Tenant Admin Portal must be usable on:

-   Mobile phones

-   Tablets

-   Laptops

-   Large screens

#### 11.7.3 Tooltips & Explanations

Every complex configuration item must have:

-   Tooltip

-   Info icon

-   Inline description

-   "Learn More" link

### 11.8 LOCALIZATION & INTERNATIONALIZATION

#### 11.8.1 Time Zones

-   All tenants can set their own timezone

-   All timestamps are automatically localized

#### 11.8.2 Language Support

Initially support:

-   English

Future support:

-   French

-   Arabic

-   Swahili

-   Spanish

#### 11.8.3 Currency Display

-   Local currency shown by tenant choice

-   Multi-currency supported for Finance Admin views

### 11.9 COMPLIANCE REQUIREMENTS

### Applicable Compliance Standards

Depending on region:

-   GDPR (EU)

-   NDPR (Nigeria)

-   POPIA (South Africa)

-   GLBA (US Financial Institutions)

-   PCI-DSS (for payments via integration)

-   ISO 27001 (security)

-   SOC 2

### Data Retention Rules

Tenant can configure:

-   Audit logs retention

-   Document retention

-   Redaction rules

-   Deletion rules

System must enforce:

-   No deletion of critical audit events

-   No tampering with immutable logs

### 11.10 MAINTAINABILITY REQUIREMENTS

#### 11.10.1 Modular Architecture

-   High cohesion

-   Low coupling

-   Services segregated:

    -   Tax Engine

    -   Workflow Engine

    -   Posting Engine

    -   Integration Hub

    -   OCR Engine

    -   Notification Engine

#### 11.10.2 Rollback

Every change in Tenant Admin Portal must support rollback.

#### 11.10.3 Self-Diagnostics

System must surface:

-   Misconfigured workflows

-   Missing GL accounts

-   Conflicting tax rules

-   Broken integration endpoints

### 11.11 OBSERVABILITY REQUIREMENTS

#### 11.11.1 Logging

-   Structured logs

-   Event logs

-   Audit logs

-   Error logs

#### 11.11.2 Metrics

-   API latency

-   Error rates

-   Workflow execution times

-   Integration uptime

#### 11.11.3 Alerts

-   Integration failure

-   Tax rule conflicts

-   Workflow inconsistencies

### 11.12 DISASTER RECOVERY

#### 11.12.1 Backup

-   Full database backup every 6 hours

-   Incremental backups every 15 minutes

#### 11.12.2 Recovery Time Objective (RTO)

-   < 1 hour

#### 11.12.3 Recovery Point Objective (RPO)

-   < 15 minutes

#### 11.12.4 Cross-region redundancy

-   Data replicated across regions

### 11.13 COMPATIBILITY

### Browsers Supported

-   Chrome (latest 2 versions)

-   Edge

-   Firefox

-   Safari

-   Mobile browsers

### Devices

-   iOS

-   Android

-   Windows

-   macOS

**SECTION 12 --- AUDIT & COMPLIANCE REQUIREMENTS**

This section defines all audit, control, governance, and compliance
standards the Tenant Admin Portal must enforce.

Because Tenant Admin drives all configuration that controls financial
postings, workflows, tax rules, HR/payroll rules, and integration
behaviors, it must adhere to strict audit and regulatory standards.

This section ensures that every action is traceable, immutable, secure,
compliant with local/global laws, and defensible in an external audit.

## 12.0 OVERVIEW

The Tenant Admin Portal is the highest-privilege environment for each
tenant.

Therefore, all changes must be:

-   Fully logged

-   Immutable

-   Version controlled

-   Reviewable

-   Exportable

-   Compliant with multiple jurisdictions

For every change, auditors must be able to answer:

-   Who did it?

-   When did they do it?

-   What exactly changed?

-   What was the value before and after?

-   Which module was affected?

-   What transactions were influenced?

-   Was an approval required?

-   Was an approval granted?

These requirements apply globally across all ZivaBI modules.

### 12.1 AUDIT TRAIL REQUIREMENTS

#### 12.1.1 Immutable Audit Logs

Audit logs must be:

-   Write-only

-   Append-only

-   Cryptographically protected

-   Not editable by any tenant, user, or even ZivaBI Support

-   Only viewable (not modifiable)

#### 12.1.2 Mandatory Audit Logging for All Configurations

Any change in the Tenant Admin Portal must generate an audit record for:

-   COA

-   Dimensions

-   Workflows

-   Tax rules

-   Vendor categories

-   Customer categories

-   User roles

-   Permissions

-   Module activation

-   KYC requirements

-   FX rules

-   Notification rules

-   Retention rules

-   Integrations

-   Branding

-   Security settings

-   Any record deactivation

The system must never allow silent changes.

#### 12.1.3 Detailed Before/After Values

Each audit entry must store:

-   Previous value

-   New value

-   Field name

-   Entity name

-   Reference object ID

-   Metadata (IP, device, browser)

### 12.2 AUDITABLE EVENTS (MANDATORY LIST)

The following are non-negotiable audit event categories:

#### 12.2.1 Access Control

-   User creation

-   User deactivation

-   Role assignment

-   Permission changes

-   MFA requirement changes

#### 12.2.2 Financial Configuration

-   GL account additions/changes

-   COA uploads

-   Module-to-GL mapping

-   Dimension-to-GL mapping

-   FX gain/loss mapping

-   Posting rules

#### 12.2.3 Workflow Configuration

-   Workflow drafts created

-   Workflow published

-   Workflow archived

-   Workflow version changes

#### 12.2.4 Tax & Statutory

-   VAT rule creation or change

-   WHT rule creation or change

-   PAYE changes

-   Regional tax changes

-   Reverse VAT rule activation

#### 12.2.5 Document / KYC Rules

-   Document requirement changes

-   OCR template updates

-   KYC field changes

#### 12.2.6 Module Activation

-   Module enabled/disabled

-   Checklist override (if allowed)

#### 12.2.7 Branding & Identity

-   Logo changes

-   Color changes

-   Email template changes

-   Subdomain changes

#### 12.2.8 Integrations

-   Adding API keys

-   Changing endpoints

-   Connection test logs

### 12.3 COMPLIANCE REQUIREMENTS

The system must support multiple regulatory frameworks, depending on
tenant location.

#### 12.3.1 Data Privacy Compliance

Must comply with:

-   GDPR (EU)

-   NDPR (Nigeria)

-   POPIA (South Africa)

-   LGPD (Brazil)

-   CCPA (California)

This includes:

-   Right to access

-   Right to export

-   Right to redact (as allowed)

-   Right to delete (only for non-critical data)

#### 12.3.2 Financial Reporting Compliance

All financial configuration changes must support:

-   IFRS

-   GAAP

-   IPSAS (public sector, optional)

#### 12.3.3 Tax Compliance

The Tax Engine changes must ensure:

-   Correct WHT classification

-   Correct VAT treatment

-   Proper reverse VAT behavior

-   Accurate remittance extraction

-   Auditable tax rule versioning

#### 12.3.4 HR/Payroll Compliance

Payroll-related configurations must comply with:

-   Local statutory deductions

-   Privacy rules (salary secrecy)

-   Payslip encryption

-   Employee record retention rules

### 12.4 DATA RETENTION & DELETION RULES

#### 12.4.1 Retention Policy Configuration

Tenant Admin must be able to set:

-   Audit log retention (min 12 months, max "never delete")

-   Document retention (configurable by document type)

-   KYC expiry rules

-   Tax document retention

-   GL retention policies (cannot delete)

ZivaBI must enforce minimum legally required retention per region.

#### 12.4.2 Automatic Expiry

Expiring documents (e.g., vendor KYC) should trigger:

-   Early warnings

-   Notifications

-   Soft block or workflow block

#### 12.4.3 Deletion Rules

Critical records cannot be deleted, including:

-   Audit logs

-   Workflow versions

-   Posted financial transactions

-   Uploaded supporting documents for posted transactions

Non-critical items may be deleted (e.g., old branding images, draft
workflows).

### 12.5 REGULATORY REPORTING SUPPORT

#### 12.5.1 Exportable Audit Log

Audit logs must be exportable to:

-   Excel

-   CSV

-   JSON

-   Audit PDF summary

#### 12.5.2 Tax & WHT Reporting

System must support extraction of:

-   VAT payable

-   VAT receivable

-   WHT payable per vendor per jurisdiction

-   WHT certificates (where required)

-   Tax rule version history

#### 12.5.3 Payroll Reporting

Where payroll is active:

-   PAYE schedule

-   Pension reports

-   NHF, NSITF

-   Gross-to-net reports

### 12.6 SECURITY & RISK CONTROLS

#### 12.6.1 Sensitive Action Approval

High-risk configuration changes must require approval:

Examples:

-   Changing VAT rates

-   Changing WHT rates

-   Mapping GLs for sensitive accounts

-   Lowering tax remittance thresholds

-   Changing FX source

-   Changing payroll statutory rules

Tenant Admin can configure:

-   Who approves

-   Second approver requirement

-   Reason fields

#### 12.6.2 Access Risk Monitoring

The system must automatically flag:

-   High-privilege roles with too much access

-   Conflicting role assignments

-   Dormant admin accounts

#### 12.6.3 Session Monitoring

-   Record active sessions

-   Allow admin to force logout a user

-   IP-based monitoring

### 12.7 AUDITOR ACCESS

Auditors must have:

#### 12.7.1 Read-Only Access

They can view:

-   Audit logs

-   Workflow versions

-   Tax rules

-   COA

-   Dimension rules

-   Vendor/customer categories

-   Role & permission configuration

#### 12.7.2 No Access To:

-   Payroll values unless explicitly granted

-   Employee personal identifiable information (PII)

-   Sensitive user data

#### 12.7.3 Audit Extraction Portal

Auditors can export:

-   Logs

-   Tax rules

-   Workflow history

-   Financial mapping rules

-   Configuration snapshots

### 12.8 INCIDENT & CHANGE MANAGEMENT

#### 12.8.1 Change Request Logging

All configuration changes are automatically classified as:

-   Normal

-   Emergency

-   Scheduled

#### 12.8.2 Incident Correlation

If a system error occurs due to configuration:

-   The engine must map it to the configuration version

-   Tenant Admin must see what configuration caused the failure

#### 12.8.3 Configuration Snapshots

Tenant can snapshot full config including:

-   COA

-   Dimensions

-   Workflows

-   Tax rules

-   Document rules

-   Categories

-   Module settings

Snapshots can be:

-   Exported

-   Archived

-   Restored

### 12.9 COMPLIANCE ALERTS

System must alert tenant for:

-   Near expiring KYC

-   Tax rule conflicts

-   Workflow circular dependency

-   Duplicate GL codes

-   Inactive dimension in active workflow

-   Missing GL mappings

-   WHT/VAT inconsistencies

-   Expiring statutory tables

### 12.10 FORENSIC LOGGING

The system must store extended forensic logs for:

-   Failed login attempts

-   Access to sensitive pages

-   Permission escalations

-   Use of override privileges

-   Tax rule overrides

-   Workflow override actions

Forensics logs must be:

-   Immutable

-   Exportable

-   Hidden from normal users

**SECTION 13 --- API REQUIREMENTS**

This section defines all backend API capabilities, endpoints,
authentication mechanisms, data structures, validation rules, rate
limits, and integration expectations required to power the Tenant Admin
Portal and to allow other ZivaBI modules to query, consume, or react to
Tenant Admin configuration.

The Tenant Admin Portal is the master configuration source for the
entire ZivaBI ecosystem; therefore, its APIs must be:

-   Secure

-   Versioned

-   Immutable where required

-   Highly available

-   Governed by strict RBAC

-   Consistent across modules

-   Efficient

-   Fully auditable

These APIs are the "backbone" for all cross-module configuration sync.

## 13.0 API ARCHITECTURE OVERVIEW

ZivaBI uses a modular microservices API architecture:

-   Auth Service --- SSO, MFA, token issuance

-   Tenant Admin Service --- configuration APIs

-   Workflow Engine Service --- workflow definitions

-   Tax Engine Service --- tax rules and logic

-   Posting Engine Service --- GL mapping

-   Dimension Engine Service --- dimension rules

-   Document Service --- KYC/document templates

-   Integration Hub --- ERP, Bank, 3PL integrations

All APIs must:

-   Use HTTPS only

-   Use OAuth2 + JWT

-   Support tenant isolation

-   Support pagination, filtering, search

-   Support JSON requests/responses

-   Support rate limiting

-   Support audit logging

### 13.1 AUTHENTICATION & AUTHORIZATION

#### 13.1.1 Authentication

-   OAuth2 token issuance via /auth/token

-   JWT tokens signed using asymmetric keys

-   Access tokens valid for 1 hour

-   Refresh tokens valid for 24 hours

#### 13.1.2 Authorization

Every API call enforces:

-   Tenant context

-   User role permissions

-   Field-level masking rules

-   Module access rights

-   User-level overrides

#### 13.1.3 Required Headers

Authorization: Bearer <token>

X-Tenant-ID: <tenant_id>

Content-Type: application/json

### 13.2 VERSIONING REQUIREMENTS

-   All APIs must support /v1, /v2, ...

-   Changes that break clients require a new version

-   Deprecated endpoints must remain functional for a minimum of 18
    months

-   Version metadata available at /meta/api-version

### 13.3 ERROR HANDLING

Standard error response:

{

\"status\": \"error\",

\"error_code\": \"INVALID_GL_MAPPING\",

\"message\": \"The selected GL is not mapped to any financial
category.\",

\"details\": {},

\"timestamp\": \"2025-11-05T12:44:22Z\"

}

### 13.4 TENANT CONFIGURATION API ENDPOINTS

These APIs allow backends and modules to query tenant configurations.

#### 13.4.1 Get Tenant Profile

GET /tenant/profile

Returns:

-   Branding

-   Active modules

-   Feature flags

-   Base currency

-   Country

-   Timezone

#### 13.4.2 Update Tenant Profile

PUT /tenant/profile

Payload includes:

{

\"company_name\": \"ABC Distributors\",

\"branding\": {...},

\"modules_enabled\": [\"AP\", \"AR\", \"Expense\"],

\"timezone\": \"Africa/Lagos\"

}

Audit log required.

### 13.5 USER & ROLE MANAGEMENT API ENDPOINTS

#### 13.5.1 List Users

GET /tenant/users

Supports filters:

-   status

-   department

-   role

-   search text

#### 13.5.2 Create User

POST /tenant/users

#### 13.5.3 Update User

PUT /tenant/users/{user_id}

#### 13.5.4 Assign Roles

POST /tenant/users/{user_id}/roles

#### 13.5.5 Deactivate User

DELETE /tenant/users/{user_id}

### 13.6 ORGANIZATION STRUCTURE API ENDPOINTS

### Departments

-   GET /org/departments

-   POST /org/departments

-   PUT /org/departments/{id}

-   DELETE /org/departments/{id}

### Cost Centers

-   GET /org/cost-centers

-   POST /org/cost-centers

-   PUT /org/cost-centers/{id}

-   DELETE /org/cost-centers/{id}

### Warehouses

-   GET /org/warehouses

-   POST /org/warehouses

-   PUT /org/warehouses/{id}

-   DELETE /org/warehouses/{id}

### 13.7 COA & FINANCIAL MAPPING API ENDPOINTS

### Chart of Accounts

-   GET /finance/coa

-   POST /finance/coa/upload

-   POST /finance/coa

-   PUT /finance/coa/{gl_id}

### GL Mapping

-   GET /finance/gl-mapping

-   POST /finance/gl-mapping

-   PUT /finance/gl-mapping/{id}

### Validation

-   POST /finance/validate/gl-mapping

### 13.8 DIMENSIONS API ENDPOINTS

### Dimension Definitions

-   GET /dimensions

-   POST /dimensions

-   PUT /dimensions/{id}

-   DELETE /dimensions/{id}

### Dimension Values

-   GET /dimensions/{id}/values

-   POST /dimensions/{id}/values

### Dimension to GL Mapping

-   POST /dimensions/{id}/gl-mappings

### 13.9 WORKFLOW BUILDER API ENDPOINTS

### Workflows

-   GET /workflows?module=AP

-   POST /workflows

-   PUT /workflows/{id}

-   GET /workflows/{id}/versions

-   POST /workflows/{id}/publish

### Workflow Validation

-   POST /workflows/validate

### 13.10 DOCUMENT & KYC API ENDPOINTS

-   GET /docs/templates

-   POST /docs/templates

-   PUT /docs/templates/{id}

-   DELETE /docs/templates/{id}

### OCR Mapping

-   POST /docs/ocr/test

-   POST /docs/ocr/mapping

### 13.11 TAX API ENDPOINTS

(Full details will be in the dedicated Tax Engine PRD, but Tenant Admin
endpoints include:)

-   GET /tax/rules

-   POST /tax/rules

-   PUT /tax/rules/{id}

-   DELETE /tax/rules/{id}

-   GET /tax/rules/evaluate (used across modules)

### 13.12 FX & CURRENCY API ENDPOINTS

-   GET /finance/currencies

-   POST /finance/currencies

-   POST /finance/fx-rules

-   PUT /finance/fx-rules/{id}

### 13.13 VENDOR / CUSTOMER CATEGORY API

### Vendor Categories

-   GET /vendors/categories

-   POST /vendors/categories

-   PUT /vendors/categories/{id}

### Customer Categories

-   Similar structure.

### 13.14 MODULE SETTINGS API

-   GET /modules/{module}/settings

-   PUT /modules/{module}/settings

### 13.15 NOTIFICATION API

-   GET /notifications/templates

-   PUT /notifications/templates/{id}

-   POST /notifications/test-send

### 13.16 INTEGRATION API

### ERP Integration

-   POST /integrations/erp/test

-   POST /integrations/erp/configure

### Bank Integration

-   POST /integrations/bank/test

-   POST /integrations/bank/configure

### 13.17 AUDIT LOG API

-   GET /audit/logs

-   GET /audit/logs/export

-   GET /audit/logs/{entity_type}/{entity_id}

Filters include:

-   User

-   Date range

-   Entity

-   Action

-   Module

### 13.18 RATE LIMITS

-   Default: 300 requests per minute per tenant

-   Burst: 1,000 requests per minute

-   Abuse triggers throttling

### 13.19 SECURITY REQUIREMENTS FOR API LAYER

-   All sensitive endpoints require MFA role enforcement

-   All admin endpoints require elevated session

-   No API returns actual salary values unless permission is granted

-   No cross-tenant leakage (strict tenant_id validation)

-   IP filtering optional

**SECTION 14 --- FUTURE ENHANCEMENTS & EXTENSIBILITY ROADMAP**

This section outlines planned, optional, and future-facing enhancements
that extend the capabilities of the Tenant Admin Portal and the ZivaBI
platform as a whole. These are not part of the initial MVP but are
critical for long-term scalability, global competitiveness, and
enterprise-grade adoption.

Future enhancements cover:

-   Intelligence (AI/ML)

-   Interoperability (API/ERP/Bank/3PL integrations)

-   Compliance growth

-   Multi-country expansions

-   Automation depth

-   UI/UX personalization

-   Advanced workflow capabilities

-   Cross-module harmonization

-   Enhanced reporting

The objective is to ensure ZivaBI remains future-proof, globally
competitive, and technically superior to any manual or semi-automated
solution.

## 14.0 OVERVIEW

Future enhancements are categorized into:

1.  AI & Automation Enhancements

2.  Global Tax & Regulatory Engine Enhancements

3.  Advanced Workflow Enhancements

4.  Expanded Integration Ecosystem

5.  Cross-Module Analytics Enhancements

6.  User Experience Enhancements

7.  Performance & Scalability Enhancements

8.  Tenant Personalization Enhancements

9.  Security Enhancements

10. Compliance and Audit Enhancements

11. Industry-Specific Template Packs

12. Super Admin Platform Enhancements

13. Marketplace Ecosystem Enhancements

14. Financial Intelligence Enhancements

15. Infrastructure & Deployment Enhancements

### 14.1 AI & AUTOMATION ENHANCEMENTS

These enhancements extend the Tenant Admin Portal's intelligence
features.

#### 14.1.1 AI-Based Auto-Configuration

-   System analyzes tenant industry and recommends:

    -   Dimensions

    -   COA grouping

    -   Vendor categories

    -   Tax rules

    -   Standard workflows

    -   Posting rules

#### 14.1.2 Machine Learning Suggestions

Models predict:

-   Missing GL mappings

-   Correct dimension combinations

-   Vendor category classification

-   Tax anomaly detection

-   Workflow optimization suggestions

#### 14.1.3 Natural Language Configuration

Tenant Admin can type:

"Create a workflow where all invoices above ₦2M require CFO approval"

System will:

-   Interpret

-   Generate workflow

-   Show preview

-   Ask for confirmation

#### 14.1.4 Intelligent Policy Validation

AI identifies:

-   Conflicting tax rules

-   Duplicate workflows

-   Circular approval logic

-   Inactive dimensions used in active mappings

### 14.2 GLOBAL TAX & REGULATORY ENGINE ENHANCEMENTS

This section will sync with the standalone Tax Engine PRD, but upcoming
enhancements include:

#### 14.2.1 Automated Global Tax Updates

-   Integration with public tax databases

-   Automatic updates for:

    -   VAT

    -   WHT

    -   Payroll taxes

    -   Levies

    -   Import duties

#### 14.2.2 Multi-Country Multi-Branch Engines

Allow multi-national tenants to configure:

-   Country-level tax rules

-   Entity-level tax rules

-   Branch-level withholding

-   FX rules per jurisdiction

#### 14.2.3 Tax Law Simulation Engine

Finance teams can simulate:

-   Effects of rate changes

-   WHT adjustments

-   VAT exemptions

-   FX revaluation impact

### 14.3 ADVANCED WORKFLOW ENHANCEMENTS

#### 14.3.1 Event-Based Approval Workflows

Workflows trigger automatically when:

-   Budget is exceeded

-   Vendor KYC expires

-   Tax rules change

-   FX spikes reach threshold

-   Employee profile changes

#### 14.3.2 Multi-Entity Shared Workflows

For groups with subsidiaries.

#### 14.3.3 BPMN Import/Export

Allow advanced users to:

-   Export workflows to BPMN

-   Modify externally

-   Import back into ZivaBI

#### 14.3.4 AI-Based Workflow Routing

AI predicts the right approver based on:

-   Past patterns

-   Historical approval durations

-   Current workload

### 14.4 EXPANDED INTEGRATION ECOSYSTEM

#### 14.4.1 Plug-and-Play ERP Connectors

Out-of-the-box connectors for:

-   SAP

-   Oracle

-   Sage X3

-   MS Dynamics 365

-   QuickBooks

-   Odoo

#### 14.4.2 Bank Connectors Marketplace

Pre-built integrations for:

-   GTB

-   Zenith

-   UBA

-   Access

-   Stanbic

-   Multinational banks

#### 14.4.3 POS, Inventory & 3PL Integrations

Support for:

-   Warehouse management systems

-   Logistics tracking

-   Vehicle tracking

-   RFID devices

### 14.5 CROSS-MODULE ANALYTICS ENHANCEMENTS

#### 14.5.1 Enterprise Reports Console

Future "Reporting & Analytics" module will include:

-   Financial dashboards

-   Tax dashboards

-   AP/AR aging

-   Workflow bottleneck analysis

-   Employee expense trends

-   Vendor performance ratings

-   Customer credit behavior

#### 14.5.2 Predictive Analytics

-   Predict invoice delays

-   Predict payroll anomalies

-   Predict order-to-cash collections

-   Predict vendor risk profiles

### 14.6 USER EXPERIENCE ENHANCEMENTS

#### 14.6.1 Multi-Tenant Theme Packs

Unique themes:

-   Corporate

-   Minimalist

-   Dark Pro

-   High Contrast

#### 14.6.2 Dynamic Page Layouts

Tenant Admin can choose layout style:

-   Sidebar

-   Minimal top-bar

-   Multi-panel view

#### 14.6.3 Voice Command Support

Tenant can say:

"Show workflow for AP invoices"

and get the correct screen.

### 14.7 PERFORMANCE & SCALABILITY

#### 14.7.1 Global CDN Optimization

Front-end loads faster across regions.

#### 14.7.2 Offline Mode (Future Vision)

For mobile approval processes.

#### 14.7.3 Distributed Workflow Engine

Massive workflows can run concurrently across nodes.

### 14.8 TENANT PERSONALIZATION

#### 14.8.1 Questionnaire-Based Setup

During onboarding, tenant answers \~30 questions.

The system automatically configures:

-   Workflows

-   Dimensions

-   Tax rules

-   Chart of accounts

-   KYC documents

-   Approval structures

#### 14.8.2 Industry Templates

Tailored frameworks for:

-   FMCG

-   Pharmaceuticals

-   Oil & Gas

-   Manufacturing

-   Retail

-   Logistics

-   Consulting

-   Fintech

-   NGOs

### 14.9 SECURITY ENHANCEMENTS

#### 14.9.1 SOC 2-Compliant Controls

#### 14.9.2 Multi-Region Data Residency

#### 14.9.3 Granular Session Control

#### 14.9.4 Just-In-Time Access

Temporary approval for sensitive configurations.

### 14.10 COMPLIANCE ENHANCEMENTS

#### 14.10.1 Automated Compliance Reporting

For:

-   Tax

-   Audit

-   Payroll

-   Regulatory filings

#### 14.10.2 Configuration Freeze Mode

During audit period, configuration cannot be changed.

#### 14.10.3 Change Request Management

Every configuration change must undergo:

-   Justification

-   Approval

-   Review

-   Audit logging

### 14.11 INDUSTRY-SPECIFIC TEMPLATE PACKS

Future modules will include specialized configurations for:

-   Clearing agents

-   Event agencies

-   Healthcare service providers

-   Import-export companies

-   3PL logistics

-   POSM-heavy marketing organizations

-   Rent/hospitality vendors

### 14.12 SUPER ADMIN PLATFORM ENHANCEMENTS

Super Admin Portal (ZivaBI side) will eventually support:

-   Tenant provisioning automation

-   API key lifecycle management

-   Global tax updates

-   Incident monitoring

-   Billing & subscription management

-   Module license management

### 14.13 MARKETPLACE ECOSYSTEM (Future Vision)

ZivaBI will support a marketplace where:

-   Vendors list integrations

-   Consultants list workflow packages

-   Developers build plug-ins

-   Tenants download industry templates

### 14.14 FINANCIAL INTELLIGENCE ENGINE

Future AI features:

-   Auto-classifying transactions

-   Auto-suggesting GL mappings

-   Detecting anomalies in expenses

-   Detecting duplicate or incorrect invoices

-   Suggesting charge codes

-   Predicting future accruals

-   Forecasting COGS and expenses

### 14.15 INFRASTRUCTURE & DEPLOYMENT ENHANCEMENTS

#### 14.15.1 Multi-Cloud Deployment

Support for:

-   AWS

-   Azure

-   GCP

-   Local African cloud providers

#### 14.15.2 Tenant-Level Data Backups

Self-managed backup exports.

#### 14.15.3 Edge Compute

Faster workflow execution in remote regions.

**SECTION 15 --- GLOBAL ENHANCEMENTS, CROSS-MODULE BEHAVIORS & UNIVERSAL CONFIGURATION RULES**

This section consolidates all platform-wide enhancements, multi-module
logic, and future-proof configuration rules that apply across ZivaBI.

These requirements were gathered from your earlier instructions and are
now unified into one structured, enterprise-grade specification.

This section is intentionally placed at the end of the Tenant Admin PRD
so it does not interrupt the flow of the earlier sections, but it
remains an authoritative part of the document and must be implemented by
development teams.

This section acts as the cross-module backbone of the entire ZivaBI
platform.

## 15.0 OVERVIEW

This section covers:

-   Additional configuration requirements requested by you

-   Cross-module logic

-   Advanced vendor/customer behavior

-   Asset & POSM management rules

-   Return flows

-   Employee-related dimension and approval behaviors

-   Tax & jurisdiction rules (high-level; detailed PRD is separate)

-   Enhanced posting & override rules

-   Universal validations

-   System-wide extensibility

These enhancements ensure that ZivaBI is:

-   Enterprise-ready

-   Industry-agnostic

-   Scalable

-   Flexible

-   Compliant

-   Configurable

-   Aligned with real-world finance and operational flows

### 15.1 DYNAMIC CATEGORY EXPANSION ENGINE (Unlimited Categories)

### Description

Tenants must be able to create unlimited custom categories, not
restricted to pre-defined options.

### Supported Category Types

-   Vendor categories

-   Customer categories

-   Service categories

-   Asset categories

-   POSM categories

-   Tax categories

-   Pricing categories

-   Dimension categories

-   Event/project categories

-   Inventory categories

-   Warehouse categories

-   Clearing agent categories

-   Employee classification categories

### Rules

-   Each category may have unique behavior and rules

-   Categories can have mandatory/optional fields

-   Categories may have workflow implications

-   Categories may determine tax rules

-   Categories may determine required documents

-   Categories may determine posting GL rules

### Configuration Method

Tenant Admin Portal → Categories

-   Add new category

-   Define rules (JSON or form-driven)

-   Attach to modules

-   Attach to tax rules

-   Make category active/inactive

### 15.2 MULTI-JURISDICTION TAX BEHAVIOR SUPPORT

### Tenant Flexibility

Tenants must be able to:

-   Add new tax types

-   Add/remove/update tax rates

-   Add multiple tax regimes

-   Define custom withholding rules

-   Define reverse VAT rules

-   Define import VAT rules

-   Define non-resident tax rules

-   Assign tax jurisdiction per vendor

-   Assign tax jurisdiction per customer

-   Assign tax jurisdiction per entity/branch

-   Map remittance accounts per authority

### Supported Scenarios

-   Vendor-charged VAT

-   Vendor failed to charge VAT → Self-account

-   Reverse-charge VAT

-   WHT applied only to certain line items

-   WHT gross-up rules

-   VAT not applicable to reimbursables

-   VAT rate changes mid-contract

-   WHT with different authorities based on vendor location

-   Multiple VAT rates per jurisdiction

-   Multi-country tenants with different tax codes

### Cross-Module Implications

These rules automatically apply in:

-   AP

-   Expense

-   AR

-   Payroll (statutory taxes)

-   Inventory (import duties, VAT on clearing)

-   Vendor Portal

-   Posting Engine

### 15.3 CREDIT TERMS OVERRIDES AT CUSTOMER LEVEL

Customer category defines default credit terms.

But the customer profile must be able to override:

-   Payment terms

-   Credit limit

-   Allowed currencies

-   Revenue dimensions

-   Inventory dispatch rules

-   Return rules

-   Discounts & pricing group

Tenant Admin can enforce:

-   Hard overrides (category > customer)

-   Soft overrides (customer > category)

-   Approval required for exceeding limits

### 15.4 ROLE-BASED GLOBAL ACCESS ASSIGNMENT WITH USER OVERRIDES

### Requirement

Roles determine default access, but each user must have independent
overrides.

### Example

-   Role: DPS → AR module access = ON

-   Specific user "John Doe" → AR access = OFF (overridden)

### Capabilities

-   Activate/deactivate access per user

-   Elevate access temporarily

-   Restrict access based on compliance flags

-   Enable per-module overrides

-   Apply dimension-based user restrictions (optional future
    enhancement)

### 15.5 FIXED ASSET CUSTODIANSHIP & LIFECYCLE TRACKING

### System must track:

-   Assigned-to employee

-   Assigned-to department

-   Assignment history

-   Transfers with approvals

-   Returns with condition updates

-   Maintenance logs

-   Depreciation linkage

-   Disposal workflow

-   Post-asset-tracking with POSM (shared logic)

### Asset Status Values

-   New

-   Assigned

-   In Use

-   Returned to Store

-   Under Repair

-   Damaged

-   Scrap

-   Lost

### Dimension Mapping

Assets may carry:

-   Cost center

-   Employee

-   Event/project

-   Material category

-   Location

### 15.6 POSM / MARKETING MATERIAL MANAGEMENT

### Full POSM Request-to-Return Workflow

-   POSM issue request

-   Approval (role-based)

-   Warehouse/3PL dispatch

-   Event or customer tagging

-   Delivery/Pickup logs

-   Damage reporting

-   Condition capture (with images)

-   Return workflow

-   Reconciliation

-   Stock reallocation

### Financial Rule

-   No monetary entries for issues/returns

-   Monetary entry only for disposal or loss

-   Automatic posting for disposal expenses

-   Dimension tagging for marketing attribution

### 15.7 RETURN FLOW (SALES / POSM / INVENTORY)

### Features

-   Customer returns workflow

-   Quality/damage check

-   Validation against original invoice

-   Return approval workflow

-   Automatic raising of credit notes

-   VAT reversal rules

-   Movement of items into:

    -   Good stock

    -   Damaged stock

    -   Salvage

    -   Scrap

### Dimension Mapping for Returns

Dimensions must match the original transaction unless overridden.

### 15.8 SYSTEM-LEVEL POSTING ENGINE ENHANCEMENTS

#### 15.8.1 Dynamic GL Posting Rules

Tenant can configure rules for:

-   Dr/Cr accounts

-   Dimension propagation logic

-   Tax bases

-   FX conversion

-   Rate source

-   Project/event attribution

-   Employee attribution

#### 15.8.2 Override Behavior

Finance users may override:

-   GL account

-   VAT rules

-   WHT rules

-   Dimensions

-   Tax jurisdictions

-   FX rates

But system must log overrides under audit trail.

### 15.9 UNIVERSAL VALIDATION AND DUPLICATION PREVENTION

Examples:

-   Invoice cannot be reused across AP/Expense unless allowed

-   Employee expense must match support document metadata

-   Vendor invoice number must not duplicate within configurable window

-   Duplicate GRN prevention

-   Duplicate workflow creation prevention

-   Duplicate tax rule version conflicts

### AI-Assisted Duplicate Detection (Future)

AI detects:

-   Duplicate invoices

-   Duplicate expense claims

-   Duplicate POSM requests

-   Duplicate vendor onboarding

-   Duplicate GL mappings

### 15.10 MULTI-WAREHOUSE, MULTI-LOCATION SUPPORT

System supports:

-   Multiple warehouses per tenant

-   Multiple 3PLs

-   Different inventory valuation per warehouse

-   Different damage classification per warehouse

-   Inbound receiving workflow

-   In-transit stock reporting

-   Salvage stock classification

### 15.11 UNIVERSAL CONFIGURATION RULES

#### 15.11.1 Effective Dates

Every configuration must support effective dating:

-   Future activation

-   Scheduled deactivation

-   Retroactive correction (with approval)

#### 15.11.2 Versioning

Every major configuration must maintain versions:

-   COA

-   Dimensions

-   Tax rules

-   Workflows

-   Vendor categories

-   Customer categories

-   FX rules

-   Posting rules

-   Document templates

#### 15.11.3 Rollback

Easy rollback is required for:

-   Workflow versions

-   COA mapping versions

-   Configuration snapshots

### 15.12 EMPLOYEE INVOLVEMENT IN CROSS-MODULE BEHAVIOR

Employees must be able to:

-   Apply for leave (Payroll/HR)

-   Retire expenses (Expense Module)

-   Approve/Review requests (if assigned roles)

-   Acknowledge POSM issued to them

-   Confirm receipt of vendor services (AP quality check)

-   Confirm custody of assigned assets

### Dimensions populated using employee profile

-   Statistical IO

-   Department cost center

-   Employee location

### 15.13 CUSTOMER & VENDOR PORTAL ENHANCEMENTS (Cross-Module)

### Vendor Portal Must Support

-   Invoice upload

-   Access to PO

-   Payment status

-   Tax deductions summary

-   KYC expiry notifications

-   WHT certificate downloads

-   Ability to update limited profile fields

-   Dispute management

### Customer Portal Must Support

-   View account balance

-   View invoice history

-   Download statements

-   Credit note visibility

-   Price lists

-   Order tracking

-   Returns initiation

### 15.14 GLOBAL AUTOMATION RULES

Examples:

-   Auto-deduct employee advances from payroll

-   Auto-close workflow stage after X days

-   Auto-remind pending approvals

-   Auto-escalate after deadline

-   Auto-generate tax returns

-   Auto-expire workflows with stale data

### 15.15 CROSS-MODULE SECURITY & PRIVACY

-   Salary fields masked by default

-   Vendor bank details masked unless authorized

-   Customer credit information protected

-   Employee PII protected

-   Tax identification numbers encrypted

-   Document files scanned for malware

### 15.16 SUPER ADMIN & PLATFORM OWNER RULES

Super Admin (ZivaBI) can:

-   Enable modules

-   Disable modules

-   Approve tenant onboarding

-   Restrict features for specific tenants

-   Block modules for non-compliant tenants

-   Trigger forced audit resets

-   Apply system-wide updates

Super Admin cannot see:

-   Tenant payroll

-   Tenant salary data

-   Tenant financial transactions

-   Sensitive KYC

### 15.17 GLOBAL NOTES FOR FUTURE MODULES

These rules apply to:

-   Inventory Management

-   Fixed Asset

-   POSM

-   3PL Portal

-   Advanced AR

-   Multi-Entity Consolidation

-   Tax Engine PRD

-   Reporting Engine PRD
