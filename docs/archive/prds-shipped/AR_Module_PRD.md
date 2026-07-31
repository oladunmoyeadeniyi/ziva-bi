# Accounts Receivable (AR) Module — Product Requirements Document (PRD)

**Product:** PRAD — Accounting Automation Platform
**Module:** Accounts Receivable (AR)
**Document status:** Converted from source Word document to Markdown
**Converted on:** July 25, 2026

---

## Table of Contents

1. Executive Summary
2. Scope of the AR Module
3. Personas & Roles
4. Business Rules
5. Data Model Overview
6. Workflow Overview
7. Business Logic Overview
8. UI/UX Requirements Overview
9. Reporting & Analytics
10. Integration Overview
11. Non-Functional Requirements
12. Audit & Compliance Requirements
13. Configuration & Customization Requirements
14. Future Enhancements & Roadmap

---

## 1.0 EXECUTIVE SUMMARY --- ACCOUNTS RECEIVABLE (AR) MODULE

The ZivaBI Accounts Receivable (AR) Module is the core financial engine
that manages the entire Order-to-Cash (O2C) lifecycle for any tenant ---
regardless of industry, business model, or operational complexity.

Designed as a multi-tenant, highly configurable, AI-powered platform,
the AR module supports:

-   Goods-based businesses (inventory selling)

-   Service-based businesses (consulting, agency, logistics,
    professional services)

-   Hybrid businesses (selling goods and providing services)

-   B2B retail and distribution

-   Multi-jurisdiction, multi-currency operations

-   Multi-warehouse / 3PL environments

This module ensures accurate revenue recognition, timely customer
invoicing, robust customer balance monitoring, and complete visibility
from order to delivery to cash collection, with support for:

-   Complex pricing structures

-   Credit and cash customer workflows

-   High-volume sales operations

-   Customer portal automation

-   Proof of delivery (POD) tracking

-   Return & credit note workflows

-   Automated AR reconciliation

-   FX revaluation for foreign invoices

-   VAT, WHT, and regulatory compliance

-   Inventory and service cost management

-   3PL billing accruals

-   Enterprise-grade audit tracking

The AR Module integrates tightly with:

-   Inventory

-   Warehouse operations

-   3PL portal

-   Pricing engine

-   Tax engine

-   Expense/FOC management

-   Budget/trade spend

-   General Ledger

-   ERP systems

-   Customer portal

-   Sales/CRM data

-   Workflow engine

-   Document engine (POD, invoices, proofs, credit memos)

ZivaBI AR provides a level of governance and automation typically found
only in world-class ERPs (SAP, Oracle, Sage X3, Dynamics 365), but
refactored into a modern, flexible, no-code configurable cloud platform
suitable for organizations of any size --- from SMEs to multinational
corporations.

**🌍** 

### 1.1 Key Problems the AR Module Solves

From your detailed walkthrough and industry best practices, ZivaBI AR
eliminates the following pain points:

### ✔ Manual customer statement reconciliation

### ✔ Difficulty tracking order → delivery → AR → payment

### ✔ Lack of customer-facing visibility

### ✔ Fragmented warehouse/3PL delivery confirmation

### ✔ Manual credit note / claim verification

### ✔ Inefficient handling of returns & damages

### ✔ Poor WHT receivable tracking

### ✔ Manual FX revaluation

### ✔ Lack of integration between Sales, Warehouse, and Finance

### ✔ No automated balance confirmations to customers

### ✔ High risk of error in revenue/COGS recognition

ZivaBI solves these through:

-   Real-time AR ledger

-   Automated matching and reconciliations

-   Auto-generated statements

-   Customer portal visibility

-   Automated 3PL POD ingestion

-   Automated credit notes & claim workflows

-   Automated revenue & COGS posting

-   Multi-dimension GL mapping

-   Auto WHT receivable recognition

-   Direct linkage with pricing, budget & tax engines

-   Advanced AI-driven anomaly detection

**⚙️** 

### 1.2 High-Level Functional Overview

The AR Module supports eight core functional pillars:

#### 1.2.1 Customer Order Management (DP PO → Quote → Approval)

-   Upload customer PO (On-Premise / Off-Premise templates)

-   DPS → DPM → Sales Specialist review

-   Finance credit check for credit customers

-   Finance payment confirmation for cash customers

-   Routing for operational delivery confirmation

-   Pricing validation and tax computation

-   Ability to split orders into goods vs services (tenant-configurable)

#### 1.2.2 Delivery Instruction & Warehouse/3PL Integration

-   Auto-delivery instruction generation

-   Warehouse portal integration

-   3PL portal integration

-   POD document upload

-   Delivery quantity verification

-   Auto-update order status

-   Auto-trigger AR recognition on delivery confirmation

#### 1.2.3 Revenue Recognition & AR Posting

Supports multiple models:

### ✔ Goods Revenue

Recognized on delivery confirmation.

### ✔ Service Revenue

Recognized on service completion.

### ✔ Mixed Revenue (Tenant Configurable)

-   Single invoice (mixed)

-   OR separate invoices (goods vs services)

### ✔ Dimension-based Revenue

Dimensions applied automatically:

-   Real IO (customer group / region)

-   Material IO (SKU for goods)

-   Statistical / Cost center (services)

### ✔ COGS posting (inventory tenants)

-   On delivery

-   Using tenant's valuation method (Standard, Weighted Average, Actual)

#### 1.2.4 Customer Portal

Customers can:

-   View invoices & statements

-   Track deliveries

-   Download POD

-   Raise disputes

-   Submit FOC requests

-   Submit trade spend claims

-   Upload WHT certificates

-   Submit return requests

-   Track credit note approvals

-   See end-to-end order status

Automatically-generated balance confirmation emails can also be enabled
(monthly, quarterly, or yearly).

#### 1.2.5 Returns & Credit Notes

Tenant-configurable:

-   Customer-initiated return

-   DPS/DPM initiated return

-   Warehouse/3PL damage reporting

-   Finance/Operations verification flows

-   Approval workflow (LM → Ops → Finance → CFO)

System handles automatically:

-   Revenue reversal

-   COGS reversal (goods only)

-   VAT reversal

-   WHT adjustments

-   Inventory adjustments:

    -   Return to stock

    -   Scrap

    -   Salvage

-   Customer credit note posting

#### 1.2.6 Customer Receipts, WHT, and Bank Matching

Supports:

-   Payment allocation

-   Full/partial/over/under payments

-   Unallocated cash

-   WHT receivable generation

-   WHT matching

-   Automatic bank statement matching

-   Daily cash summary

-   Customer balance updates

#### 1.2.7 FOC, Discounts, Rebates & Trade Spend Management

Supports:

-   FOC requests

-   Promotional schemes

-   End-of-month rebate accrual

-   Distributor credit requests (DP Credit Request template)

-   Multi-level approval routes

-   Automatic posting to trade spend GLs

Offers auditable workflows with full document history.

#### 1.2.8 Reporting, Analytics & AI Insights

Includes:

-   AR aging

-   Customer balance dashboard

-   AR performance dashboard

-   Cash forecasting

-   Invoice-to-cash cycle times

-   Delivery performance KPI (3PL/warehouse)

-   Sales performance to AR correlation

-   AI-driven payment behavior prediction

-   AI-driven anomaly detection

-   Credit exposure report

**🧩** 

### 1.3 Cross-Module Integrations

### ✔ Inventory

(Quantity, COGS, real-time stock deduction, returns)

### ✔ Warehouse

(Picking, packing, inbound/outbound movements, damages)

### ✔ 3PL Portal

(POD, delivery confirmation, billing accruals)

### ✔ Pricing Engine

(Price list, promotions, contract pricing, effective dated price
changes)

### ✔ Tax Engine

(VAT, WHT, multi-country handling)

### ✔ Workflow Engine

(All AR approvals & escalations)

### ✔ Budget/Trade Spend

(Discounts, rebates, promotions)

### ✔ ERP Integration Layer

(Postings to GL, AR Ledger, WHT receivable, FX gains/losses)

### ✔ Document Engine

(POD, DP PO, invoices, credit memos, photo evidence, customs docs)

### ✔ Customer Portal

(Account visibility, disputes, claims)

**⚡** 

### 1.4 Key Differentiators of ZivaBI AR

Compared to traditional ERPs, ZivaBI AR is:

### ⭐ Multi-tenant configurable

### ⭐ Industry-agnostic (goods + services)

### ⭐ Highly automated

### ⭐ AI-enhanced

### ⭐ Workflow-first

### ⭐ Document-centric

### ⭐ Customer and Sales-user friendly

### ⭐ Integrated with 3PL & warehouse systems

### ⭐ Designed for both SMEs and multinationals

### ⭐ Fully dimension-aware (IO, SKU, cost center)

### ⭐ Fully compliant with tax and accounting standards

This positions ZivaBI as the future of AR automation for African, Middle
Eastern, Asian, and global enterprises.

## 2.0 SCOPE OF THE AR MODULE

The Accounts Receivable (AR) Module of ZivaBI defines the complete
functional, operational, financial, and technical boundaries for all
processes related to Order-to-Cash (O2C), revenue recognition,
receivables management, and customer-facing interactions.

This section specifies what is in scope and what is out of scope, and
provides clarity on the module boundaries, integrations, and
cross-functional dependencies.

The AR Module is designed to support:

-   Companies selling physical goods

-   Companies selling services

-   Companies selling both goods and services (hybrid)

-   Companies operating multiple warehouses, multiple 3PLs, multiple
    currencies, and multiple tax jurisdictions

All features must be multi-tenant configurable to reflect each tenant's
operational model, tax requirements, industry, and internal controls.

### 2.1 IN SCOPE (Functional Coverage)

The following capabilities ARE INCLUDED within the AR Module.

#### 2.1.1 Customer Order Intake & Validation

-   Customer PO upload (Excel templates, PDF, or customer portal)

-   DPS/DPM review and approval

-   Sales Specialist quote creation

-   Price list validation based on tenant configuration

-   Customer credit verification

-   Cash customer payment validation and proof-of-payment rules

-   Product & service line classification

-   Split goods/service invoice logic (tenant-configurable: mixed or
    separate)

-   Order completeness validation (SKU code, units, service description,
    delivery terms)

#### 2.1.2 Delivery Instruction & Logistics Coordination

-   Auto-generation of delivery instruction (DI)

-   Routing to Warehouse and/or 3PL based on tenant rules

-   Delivery scheduling and routing visibility

-   Real-time order status tracking (Sales, Ops, Finance, Customer)

-   POD upload (image, PDF, e-waybill, driver signature)

-   Delivery confirmation for revenue recognition

-   Support for split deliveries, partial deliveries, and multi-drop
    delivery routes

#### 2.1.3 Revenue Recognition & AR Posting

Supports:

### ✔ Goods Revenue

-   Recognized on delivery confirmation

-   Uses SKU-level dimension mapping (Material IO)

### ✔ Service Revenue

-   Recognized on service delivery or milestone completion

-   Uses service-level dimension mapping (Cost Center IO, Real IO)

### ✔ Mixed Transactions (goods + services)

-   Single or separate invoices according to tenant's configuration

### ✔ FX-based revenue recognition for foreign currency sales

### ✔ Dimension-aware posting rules

-   Real IO

-   Material IO

-   Statistical IO

-   Cost center IO

-   Location dimension (if enabled)

All revenue and COGS rules are configurable by tenant.

#### 2.1.4 Customer Invoices

System-generated invoices:

-   Goods invoice

-   Service invoice

-   Mixed invoice (if tenant allows)

-   VAT-inclusive or VAT-exclusive pricing

-   Multi-currency invoices

-   WHT deduction support

-   Invoice PDF generation with company logo & tenant branding

-   Automatic sharing with customer portal

-   Automatic email delivery

#### 2.1.5 Customer Portal & Self-Service

Customers can:

-   View all invoices

-   View pending & overdue items

-   Download statements

-   Download POD

-   View order status and fulfillment timeline

-   Submit return or dispute requests

-   Submit FOC or rebate claims

-   Upload WHT certificates

-   Upload payment proof

-   View entire O2C lifecycle for each order

The portal supports configurable access levels for B2B customers.

#### 2.1.6 Customer Payments & Bank Matching

-   Manual and automated payment posting

-   Full, partial, over- and under-payment handling

-   Unallocated payment bucket

-   Automated matching engine (AI-enhanced)

-   Bank statement import (PDF, Excel, CSV)

-   Pattern recognition to match payment to invoice

-   Multi-currency receipt handling

-   WHT receivable recognition and matching

-   FX revaluation at month-end

#### 2.1.7 Returns & Credit Notes

Tenant-configurable:

-   Customer-initiated returns

-   DPS/DPM or Sales-initiated returns

-   Warehouse/3PL return reporting

-   Approval routing (LM → Ops → Finance → CFO)

-   Return quantity validation

-   Condition-based return categories (damaged, expired, price dispute)

System auto-handles:

-   Revenue reversal

-   COGS reversal (goods only)

-   VAT reversal

-   WHT adjustments

-   Inventory adjustments (good stock, damaged stock, salvage)

-   Customer credit note posting

#### 2.1.8 Pricing & Discount Management (Integration)

-   Price list configuration

-   Future-dated price changes

-   Promotional pricing and discounts

-   Customer-specific pricing

-   Territory-based pricing

-   Price change approval workflow

-   Full audit logging of all price modifications

(Pricing Engine is a separate module but AR depends heavily on it.)

#### 2.1.9 FOC, Rebates & Claim Processing

Full automation of:

-   Free-of-Charge (FOC) item workflows

-   Distributor Partner (DP) Credit Requests

-   Promotional claims and trade spend

-   Automatic matching of claims to budget

-   Multi-level approval routes

-   Statement integration for customers

-   Credit note posting upon approval

#### 2.1.10 Accrual Management (Warehouse, 3PL, Services)

Automatically create accruals for:

-   3PL delivery costs

-   Warehouse handling

-   Service subcontractor cost accrual

-   Consumption-based accruals

-   Month-end accrual automation

Automatically reverse accruals when vendor invoice arrives.

#### 2.1.11 Tax Management (VAT, WHT, Multi-Jurisdiction)

Full support for:

-   VAT on goods

-   VAT on services

-   VAT exemptions

-   Zero-rated items

-   Reverse VAT (non-resident vendors)

-   Self-account VAT

-   Product/service-specific VAT mapping

-   Client-specific VAT rules

-   WHT deducted by customers

-   Country-based VAT application logic

-   Future-dated tax configuration

-   FX conversion of tax base

The Tax Engine drives all tax rules with full tenant configurability.

#### 2.1.12 Customer Statements & Balance Confirmations

Supports:

-   Monthly, quarterly, or yearly customer statements

-   Automated statement emails (PDF/Excel)

-   Balance confirmation for audit purposes

-   Customer self-download via customer portal

-   Tenant-configurable templates

#### 2.1.13 AR Aging & Collection Management

-   Real-time aging buckets

-   Risk scoring

-   Overdue reminders

-   Customer performance dashboard

-   Promise-to-pay logging

-   AR team assignment per customer

-   Region-based AR segmentation

-   Analytics for cash collection efficiency

#### 2.1.14 ERP Integration

Integration with tenant ERPs including:

-   Sage X3

-   SAP

-   Oracle

-   Microsoft Dynamics

-   QuickBooks

-   Tally

-   Odoo

-   Any ERP via API or flat file

Supports:

-   AR posting

-   Revenue posting

-   COGS posting

-   Tax posting

-   Accrual posting

-   Return posting

-   Credit note posting

-   Payment posting

### 2.2 OUT OF SCOPE (Explicit Exclusions)

The following items are NOT INCLUDED within AR (but may exist in other
modules):

### ❌ Lead Management, CRM, or Sales Pipeline (separate CRM module)

### ❌ Expense reimbursement (handled in Expense Module)

### ❌ Vendor invoice management (handled in AP Module)

### ❌ Manufacturing BOM or production costing

### ❌ HR or payroll processing (handled in Payroll Module)

### ❌ Inventory valuation engine (exists in Inventory Module)

### ❌ POS terminal integration (handled in POS Module)

### ❌ Legal contract authoring (handled in Legal Module)

### ❌ Budget formulation (handled in Budget/Planning Module)

### 2.3 ASSUMPTIONS & DEPENDENCIES

The AR module relies on the following:

-   Accurate customer master data

-   Approved price lists

-   Valid tax configuration

-   Integrated warehouse/3PL or manual POD workflow

-   Workflow engine for approvals

-   Inventory engine for quantity & COGS

-   ERP integration connector

-   Dimension engine for IO/Material/Cost center

-   Document engine for PDF generation

-   Notification engine for email/SMS

### 2.4 SUCCESS METRICS

ZivaBI AR is successful if:

-   Customer statements automatically reconcile 80--100% of items

-   Order-to-cash cycle time reduces by 40--70%

-   Cash collection improves by 20--40%

-   Manual posting errors fall by \>90%

-   Returns/credit notes become fully auditable

-   3PL delivery confirmation becomes real-time

-   AR aging is accurate and available instantly

-   Customers self-serve \>50% of account activities

-   Finance team workload reduces significantly

-   Tenant onboarding requires no coding

## 3.0 PERSONAS & ROLES

This section defines all users ("personas") who interact with the AR
module, their responsibilities, permissions, data visibility, and system
actions. These personas are derived from your walkthrough and real-world
O2C (Order-to-Cash) operations across industries.

The AR Module supports internal staff, customers, warehouse/3PL
partners, and system admins, each with clearly delineated access rights
and operational boundaries.

All roles and visibility are tenant-configurable, meaning each
organization can enable, disable, or customize any persona's permissions
without coding.

### 3.1 INTERNAL PERSONAS

#### 3.1.1 Distributor Partner Specialist (DPS)

Primary Role: First-level reviewer of customer requests and POs.

### Responsibilities:

-   Review customer Purchase Orders (DP PO templates)

-   Validate quantities, pricing, and delivery requirements

-   Raise quote on behalf of customer (if allowed)

-   Ensure proof of payment is attached for cash customers

-   Initiate return requests (if tenant enables)

-   Submit FOC requests on behalf of customers

-   Track order → delivery → credit note cycle for assigned customers

-   Verify delivery satisfaction before invoicing

### System Access:

-   Assigned customer list & AR balances

-   Order status tracking (timeline view)

-   View PODs

-   Raise disputes/returns

-   View and download customer statements

-   Cannot delete or modify invoices

### Restrictions:

-   Cannot see customers not assigned to them

-   Cannot approve financial transactions

#### 3.1.2 Distributor Partner Manager (DPM)

Primary Role: Approver and supervisor for DPS and key accounts.

### Responsibilities:

-   Approve/reject DPS requests (DP PO, returns, FOC, claims)

-   View customer AR balances for all assigned customers

-   Track collections and overdue accounts

-   Approve promotional/discount claims submitted by DPS

-   Monitor product availability and delivery SLAs

-   Collaborate with Finance to resolve customer disputes

### System Access:

-   Full visibility for assigned region/territory

-   AR aging dashboard (only for their region)

-   Customer statements

-   Payment history

-   Overdue escalations

-   Sales vs AR performance analytics

### Restrictions:

-   Cannot view financial details for unassigned regions/customers

-   Cannot post credit notes (finance role)

#### 3.1.3 Sales Specialist (Sales Ops)

Primary Role: Creates quotes and links customer orders to pricing lists.

### Responsibilities:

-   Create and update customer quotes

-   Validate pricing, discounts, VAT, and order accuracy

-   Convert DP PO into system-approved sales order

-   Manage service delivery milestones (service businesses)

-   Provide operational approval for delivery where needed

### System Access:

-   Quote creation interface

-   Price list visibility

-   Customer account status (credit limit, balance)

-   Delivery instruction generation (if enabled)

### Restrictions:

-   Cannot alter invoices after posting

-   Cannot override credit limits

#### 3.1.4 Sales Manager

Primary Role: Approves high-value orders and oversees territory
pipeline.

### Responsibilities:

-   Approve high-value quotes

-   Validate discount levels

-   Monitor revenue recognition

-   Track customer performance

-   Collaborate closely with AR team on overdue customers

### System Access:

-   Region-level AR dashboards

-   Customer sales & AR correlation charts

-   Statement downloader

-   Collection forecast

-   Service/goods revenue split

#### 3.1.5 Operations Manager

Primary Role: Confirms delivery capability and coordinates with
warehouse/3PL.

### Responsibilities:

-   Validate stock availability

-   Confirm route and delivery timeline

-   Approve delivery instruction where needed

-   Review POD discrepancies

-   Approve return requests from warehouse/3PL

-   Collaborate for damage classification (warehouse vs 3PL vs customer)

### System Access:

-   Delivery instruction dashboard

-   POD summary

-   Returns awaiting operational review

-   Warehouse/3PL activity logs

#### 3.1.6 Warehouse Officer (Internal WH)

Primary Role: Handles physical stock picking, packing, and dispatch.

### Responsibilities:

-   Receive DI (Delivery Instruction)

-   Confirm stock availability

-   Process picking & packing

-   Update dispatch status

-   Upload POD received from driver

-   Report damages/missing stock immediately

-   Raise warehouse-initiated return requests

### System Access:

-   Warehouse portal

-   DI list

-   Return & damage reporting panel

-   Stock level visibility (restricted)

#### 3.1.7 3PL Delivery Officer / Agent (External or Internal)

Primary Role: Fulfills delivery and uploads POD.

### Responsibilities:

-   Receive delivery instructions

-   Update delivery attempt statuses

-   Upload POD (photo, signature, invoice stamp)

-   Report transit damages

-   Provide final delivered quantity

### System Access:

-   3PL portal

-   Assigned delivery orders

-   POD uploader

-   Damage reporting form

### Restrictions:

-   No access to financial information

-   No access to inventory valuation

#### 3.1.8 Finance AR Officer

Primary Role: Core AR processing and financial posting.

### Responsibilities:

-   Validate invoice details

-   Post customer invoices

-   Reverse invoices and revenue where required

-   Apply payments

-   Match WHT certificates

-   Manage credit notes

-   Reconcile bank statements

-   Run FX revaluation

-   Prepare AR ledger for month-end close

-   Monitor overdue accounts

### System Access:

-   Full AR ledger

-   Customer statements

-   Return & credit note approval

-   Accrual management

-   Tax computation panel

-   ERP integration report

-   Open dispute list

#### 3.1.9 Finance AR Manager

Primary Role: Supervises AR operations and approves key steps.

### Responsibilities:

-   Approve credit notes

-   Approve customer refunds

-   Approve adjustments

-   Oversee reconciliation

-   Approve WHT receivable postings

-   Review aging and credit exposure

-   Approve FX revaluation results

### System Access:

-   All AR dashboards

-   Customer-level deep dive views

-   Adjustments console

#### 3.1.10 CFO / Finance Director

Primary Role: Final approval for high-value items and audit governance.

### Responsibilities:

-   Approve high-value return requests

-   Sign off credit note batches

-   Approve customer write-offs

-   Approve bad-debt provisions

-   Oversee tax compliance (VAT/WHT/FX gains/losses)

-   Review KPIs for O2C

### System Access:

-   Full unrestricted visibility

-   High-level analytics

-   Audit trails

-   Exception monitoring

#### 3.1.11 Tenant Administrator

Primary Role: Configures tenant-specific AR behavior.

### Responsibilities:

-   Configure invoice type settings (mixed or separate invoices)

-   Configure dimensions (IO, SKU, cost center)

-   Configure VAT/WHT rules

-   Configure credit limit rules

-   Map GL accounts for AR postings

-   Configure workflows for:

    -   Customer order approvals

    -   Returns

    -   Credit notes

    -   Price approvals

-   Enable/disable access for various personas

-   Configure customer portal settings

-   Configure statement automation schedule

### System Access:

-   Full configuration menu

-   Role management

-   Feature toggles

#### 3.1.12 Super Admin (ZivaBI Owner)

Primary Role: Oversees all tenants and global platform settings.

### Responsibilities:

-   Approve modules tenant can access

-   Enforce platform-wide compliance

-   Handle escalations

-   Monitor multi-tenant infrastructure

-   Manage rate limits and usage levels

### 3.2 EXTERNAL PERSONAS

#### 3.2.1 Customer (Portal User)

### Responsibilities:

-   View all invoices, statements, PODs

-   Submit disputes

-   Submit return requests

-   Upload WHT certificates

-   Upload proof of payment

-   Track order → delivery → return → credit → payment

-   Download account statement

-   Confirm balances for year-end audit

### System Access:

-   Only their own data

-   No internal financial details

#### 3.2.2 External 3PL Partner

As covered above, with limited logistics-only access.

### 3.3 PERSONA → PRIVILEGE MATRIX

A detailed matrix is required in Section 10 (UI/UX), but Section 3 must
list the core access principles:

### ✔ Principle 1 --- Least Privilege

Users only see what is necessary for their role.

### ✔ Principle 2 --- Customer/Region/Territory-Based Segmentation

Sales users see only the customers assigned to them.

### ✔ Principle 3 --- Finance Override Rights

Finance can see everything but cannot override operational workflows
unless tenant config permits.

### ✔ Principle 4 --- Tenant-Level Customization

Tenants can enable/disable:

-   Return initiation roles

-   Balance visibility

-   Credit approval rights

-   Statement download access

### ✔ Principle 5 --- Super Admin Isolation

Super Admin can configure module access but cannot view transactional
data of any tenant.

## 4.0 BUSINESS RULES

The Business Rules define the behavioral logic, validations,
constraints, workflows, and automated system decisions governing the AR
module. These rules ensure consistency, financial accuracy, regulatory
compliance, and alignment with tenant-specific O2C processes.

ZivaBI AR is built around tenant-configurable business rules, meaning NO
code changes are needed for tenants to adopt their operational model ---
from simple direct invoicing to complex multi-step distribution
operations.

### 4.1 ORDER INTAKE & VALIDATION RULES

#### 4.1.1 Customer PO Rules

1.  Customer POs must be submitted in tenant-approved formats:

    -   DP PO Template (On-Premise / Off-Premise)

    -   PDF

    -   Uploaded Excel

    -   Structured digital order from customer portal

2.  Customer PO must contain:

    -   Customer name

    -   PO number

    -   Date

    -   Delivery location

    -   SKU codes or service descriptions

    -   Quantity

    -   Approved prices (optional --- validated against price list)

3.  System must validate that:

    -   Customer is active

    -   Customer belongs to the DPS/DPM submitting the PO

    -   Customer PO is not duplicated

    -   Customer has no account suspension

4.  Customer PO cannot be modified after the first approval.

    Any change requires:

    -   Cancel + re-upload

    -   Or customer confirmation, depending on tenant rules

#### 4.1.2 Price Validation Rules

1.  Price must match:

    -   The tenant's active price list

    -   Customer-specific pricing contract (if any)

    -   Product/service category price rules

2.  Price change effective dates must be respected:

    -   If order date \< new price start date → old price

    -   If order date ≥ new price start date → new price

3.  Promotional / discount rules apply based on:

    -   Customer tier

    -   Quantity/volume

    -   Season/window-based promotions

    -   SKU-specific discounting

    -   Territory discounts

4.  If "strict price validation" is enabled:

    -   DPS or Sales Specialist cannot override price

    -   Only Sales Manager or Finance can override

#### 4.1.3 Customer Credit Validation Rules

### For Credit Customers:

1.  System must verify:

    -   Credit limit

    -   Outstanding AR

    -   Pending invoices

    -   Unallocated payments

    -   Overdue aging (if credit block rules are enabled)

2.  If order exceeds available credit:

    -   Auto-block

    -   Notify Sales & Finance

    -   Allow override only if tenant configuration permits

3.  System auto-updates available credit after:

    -   Posting new invoice

    -   Applying payment

    -   Approving credit note

### For Cash Customers:

1.  Proof of payment may be required based on tenant settings:

    -   Always required

    -   Required above X amount

    -   Required only for first-time customers

    -   Not required if account has positive credit balance

2.  Acceptable proof of payment types:

    -   Bank slip

    -   Payment screenshot

    -   Bank reference number

    -   Automated bank API match

### 4.2 DELIVERY INSTRUCTION & FULFILLMENT RULES

#### 4.2.1 Delivery Instruction (DI) Generation

1.  DI is auto-generated after final approval of order.

2.  DI must include:

    -   Order number

    -   Customer details

    -   SKUs or service lines

    -   Quantity

    -   Delivery location

    -   Preferred delivery window

    -   Payment status

    -   Credit approval status

3.  DI must be routed to:

    -   Internal Warehouse

    -   3PL

    -   Or both, based on tenant configuration

#### 4.2.2 Warehouse Fulfillment Rules

1.  Warehouse officer must confirm:

    -   Stock availability

    -   Picked quantity

    -   Dispatch quantity

2.  System must prevent:

    -   Dispatch beyond available stock

    -   Dispatch beyond approved order quantity

3.  Warehouse must upload:

    -   Dispatch note

    -   Driver assignment

    -   Seal number (if required)

#### 4.2.3 3PL Fulfillment Rules

1.  3PL must update delivery attempt statuses:

    -   Out for delivery

    -   Delivered

    -   Partially delivered

    -   Failed delivery

    -   No access / Customer unavailable

2.  Proof of Delivery (POD) must be uploaded:

    -   Photo of signed invoice

    -   Digital signature

    -   GPS-stamped proof (if enabled)

    -   Customer stamp/acceptance

3.  System must validate consistency:

    -   Delivered quantity ≤ ordered quantity

    -   POD uploaded for all delivered items

### 4.3 REVENUE RECOGNITION RULES

#### 4.3.1 Goods Revenue

1.  Revenue is recognized only after delivery is confirmed (POD).

2.  COGS is recognized simultaneously.

3.  Dimensions applied automatically from:

    -   SKU → Material IO

    -   Customer → Real IO

#### 4.3.2 Service Revenue

1.  Recognized upon:

    -   Service milestone completion

    -   Completion acknowledgement from customer

    -   Or a combination (tenant decides)

2.  No COGS unless service has underlying direct cost or subcontractor
    cost.

#### 4.3.3 Mixed Transactions (Goods + Services)

Tenant selection determines:

-   Mixed Invoice Mode

    or

-   Separate Invoices Mode

Invoice generation must follow the chosen configuration.

#### 4.3.4 VAT Rules

1.  VAT calculation must respect:

    -   Product type

    -   Service type

    -   Customer VAT registration status

    -   Jurisdiction rules

    -   Zero-rating or exemption flags

2.  VAT reversal must occur automatically when:

    -   Returns are approved

    -   Invoice is cancelled

#### 4.3.5 WHT Rules

1.  If customer deducts WHT:

    -   System creates WHT receivable

    -   System reduces customer outstanding balance

    -   WHT must be matched to certificate uploaded by customer

### 4.4 RETURN & CREDIT NOTE RULES

#### 4.4.1 Return Initiation (Tenant Configurable)

Any of the following may initiate returns depending on settings:

-   Customer

-   DPS

-   DPM

-   Sales Specialist

-   Warehouse

-   3PL

-   Finance

#### 4.4.2 Return Approval Workflow

Tenant may configure:

-   Single approval

-   Multi-approval chain (LM → Ops → Finance → CFO)

-   Value-based approval levels

-   Reason-based approval levels

#### 4.4.3 Return Types & Rules

### A. Customer Returns

-   Must be validated against delivered quantity

-   Must check POD and delivery discrepancy

### B. Warehouse-Initiated Returns

-   For inbound damages

-   For spoilage or expired items

-   For wrong picking

### C. 3PL-Initiated Returns

-   Transit damage

-   Short delivery

-   Delivery cancellation

#### 4.4.4 Financial Processing Rules

1.  Revenue reversal

2.  VAT reversal

3.  COGS reversal (goods only)

4.  Inventory adjustments:

    -   Good stock

    -   Damaged stock

    -   Scrap

    -   Salvaged items

5.  Customer credit note issuance

6.  FX adjustment (if foreign currency invoice)

### 4.5 PAYMENT & COLLECTION RULES

#### 4.5.1 Payment Application Rules

1.  Apply payment to oldest invoice first (default)

2.  Tenant may switch to:

    -   Matching by invoice number

    -   Matching by order number

    -   Matching by amount

    -   Manual matching

#### 4.5.2 Unallocated Payment Rules

1.  Customer cannot place new cash orders if unallocated balance exceeds
    tenant threshold.

2.  AR officer must allocate within SLA defined by tenant.

#### 4.5.3 Bank Reconciliation & Matching Rules

1.  System must read bank statement (PDF, Excel)

2.  AI must detect:

    -   Customer name mentions

    -   Invoice number mentions

    -   Similar amounts

    -   FX conversions

3.  Automatically suggest matches

4.  Finance manually confirms or overrides suggestions

### 4.6 ACCRUAL RULES

#### 4.6.1 3PL Accruals

1.  Accrue cost per POD delivered

2.  Reverse when 3PL invoice arrives

3.  Track by:

    -   Delivery route

    -   SKU weight/volume

    -   Negotiated contract rate

#### 4.6.2 Warehouse Accruals

1.  Costs accrued per item handled

2.  Reversed upon invoice

3.  Multi-warehouse supported

#### 4.6.3 Month-End Accruals

-   Auto-run on close date

-   Manual adjustments allowed

-   Full audit trail kept

### 4.7 CUSTOMER STATEMENT & BALANCE CONFIRMATION RULES

1.  Tenant configures frequency:

    -   Monthly

    -   Quarterly

    -   Yearly

2.  Customers receive a statement via email automatically.

3.  Customer portal allows:

    -   Full statement download

    -   Payment detail view

    -   Outstanding invoices

    -   Pending credit notes

4.  Balance confirmation workflow is logged for audit.

### 4.8 ACCESS CONTROL RULES

1.  Region-based restrictions for DPS/DPM

2.  Customer-level visibility settings

3.  Finance roles have override rights

4.  Tenant admin manages granular role controls

5.  Super Admin cannot see tenant financial data

## 5.0 DATA MODEL OVERVIEW

The AR data model defines all entities, attributes, relationships, and
data flows that govern the Order-to-Cash (O2C) lifecycle.

It ensures:

-   Data integrity

-   Dimensional accuracy (IO, SKU, Cost center, Location)

-   Traceability for audit & compliance

-   Scalability across industries

-   Seamless integration with Inventory, Warehouse, 3PL, AP, Tax,
    Pricing & ERP modules

-   Full support for multi-currency, multi-warehouse, multi-jurisdiction
    environments

The AR data model is modular, configuration-driven, and tenant-isolated,
supporting:

-   Goods-based companies

-   Service-based companies

-   Hybrid companies (goods + services)

Each tenant receives a logically separate schema for security, while
ZivaBI maintains a unified logical model.

### 5.1 CORE ENTITIES

Below are the AR module's primary entities.

#### 5.1.1 Customer

Contains customer master data.

### Core Attributes

| Field | Description |
| --- | --- |
| CustomerID | Unique internal identifier |
| TenantID | Tenant isolation scope |
| CustomerName | Legal name |
| TradingName | Business name (if applicable) |
| CustomerType | Cash / Credit / Hybrid |
| CustomerGroup | Real IO mapping |
| Territory / Region | For reporting & approval flows |
| CreditLimit | Tenant-configured credit level |
| AvailableCredit | Auto-calculated |
| TaxRegistrationNo | VAT/TIN number |
| Currency | Default customer currency |
| PaymentTerms | Net 0 / Net 30 / Net 60 etc. |
| PriceListID | Link to pricing engine |
| CustomerPortalUserIDs | Linked logins |
| IsActive | True/False |

#### 5.1.2 CustomerOrder (Sales Order)

Represents the validated order.

### Attributes

-   OrderID

-   CustomerID

-   OrderDate

-   OrderType (Goods / Services / Mixed)

-   Currency

-   VATType

-   PaymentStatus (Paid / Unpaid / Partially Paid / N/A)

-   CreditStatus (Approved / Blocked)

-   TotalAmount

-   TotalVAT

-   TotalWHT

-   WorkflowStatus

-   CreatedBy / ApprovedBy

-   DPPOReference (if DP PO template uploaded)

-   PriceListSnapshotID (captured pricing rules at the time of order)

#### 5.1.3 CustomerOrderLine

Each SKU/service in the order.

### Attributes

-   OrderLineID

-   OrderID

-   LineType (Goods / Service)

-   SKU or ServiceCode

-   Description

-   QuantityOrdered

-   QuantityDelivered

-   UnitPrice

-   LineDiscount

-   VATRate

-   WHTRate

-   Dimension fields:

    -   MaterialIO

    -   RealIO

    -   CostCenterIO

    -   Location

-   TotalLineAmount

-   TotalLineVAT

#### 5.1.4 DeliveryInstruction (DI)

Represents the instruction sent to warehouse/3PL.

### Attributes

-   DIID

-   OrderID

-   WarehouseID / 3PLID

-   DeliveryDate

-   RouteID

-   VehicleDetails

-   DriverID

-   DeliveryStatus

-   PODRequired (Yes/No)

-   DIApprovalStatus

-   DispatchTimestamp

#### 5.1.5 DeliveryEvent

Captures each action taken by warehouse/3PL.

### Attributes

-   DeliveryEventID

-   DIID

-   EventType (Picked, Packed, OutForDelivery, Delivered, Failed,
    Partial)

-   EventTimestamp

-   DeliveredQuantity

-   ReasonCode (for failed/partial delivery)

-   GPSCoordinates (optional)

-   PODDocumentIDs

#### 5.1.6 POD (Proof of Delivery)

POD files uploaded by 3PL or warehouse.

### Attributes

-   PODID

-   DIID

-   DeliveryEventID

-   FileType (Photo, PDF, e-signature)

-   FilePath

-   UploadedBy

-   Timestamp

-   ValidatedBy (optional)

#### 5.1.7 InvoiceHeader

Represents the financial invoice.

### Attributes

-   InvoiceID

-   InvoiceNo (tenant-specific format rules)

-   InvoiceType (Goods / Service / Mixed)

-   InvoiceStatus (Draft, Posted, Cancelled, Reversed)

-   CustomerID

-   Currency

-   FXRateUsed

-   InvoiceDate

-   PostingDate

-   TotalAmount

-   TotalVAT

-   TotalWHT

-   ERPPostingStatus

-   GLBatchID

#### 5.1.8 InvoiceLine

Detailed financial lines for revenue/COGS.

### Attributes

-   InvoiceLineID

-   InvoiceID

-   LineType (Goods/Service)

-   SKU or ServiceCode

-   Description

-   QuantityBilled

-   UnitPrice

-   Discount

-   VATRate

-   WHTRate

-   RevenueGLAccount

-   COGSGLAccount

-   DimensionFields

-   LineAmount

-   LineVAT

#### 5.1.9 CustomerPayment

Represents a payment received.

### Attributes

-   PaymentID

-   CustomerID

-   PaymentDate

-   Amount

-   Currency

-   FXRate

-   PaymentReference

-   PaymentMethod

-   BankAccountID

-   UnallocatedAmount

-   AllocatedAmountTotal

#### 5.1.10 PaymentAllocation

Represents payment applied to specific invoices.

### Attributes

-   AllocationID

-   PaymentID

-   InvoiceID

-   AmountAllocated

-   AllocationDate

-   WHTApplied

#### 5.1.11 WHTCertificate

Customer-uploaded or finance-uploaded certificate.

### Attributes

-   WHTCertificateID

-   CustomerID

-   InvoiceID

-   Amount

-   CertificateNumber

-   IssueDate

-   FilePath

#### 5.1.12 ReturnRequest

Represents a customer / DPS / DPM / WH / 3PL initiated return.

### Attributes

-   ReturnID

-   OriginatorType (Customer/DPS/DPM/Warehouse/3PL/Finance)

-   CustomerID

-   OrderID / InvoiceID

-   ReturnReason

-   Attachments

-   Status (Draft, Submitted, Approved, Rejected)

-   ApprovalWorkflowRoute

-   CreatedBy

-   ApprovedBy

#### 5.1.13 ReturnLine

Details of goods/services being returned.

### Attributes

-   ReturnLineID

-   ReturnID

-   SKU/ServiceCode

-   QuantityReturned

-   Condition (Good/Damaged/Scrap)

-   ReturnCategory (Customer return, WH damage, Transit damage)

-   LinkedInvoiceLineID

#### 5.1.14 CreditNote

Represents issued credit.

### Attributes

-   CreditNoteID

-   CustomerID

-   InvoiceID (can be null)

-   ReturnID (if applicable)

-   CreditAmount

-   VATReversal

-   WHTAdjustment

-   ApprovalStatus

-   PostingStatus

#### 5.1.15 ARLedger

Summarizes customer receivables.

### Attributes

-   ARLedgerID

-   CustomerID

-   OpeningBalance

-   InvoiceAmount

-   CreditNoteAmount

-   PaymentAmount

-   WHTAmount

-   FXAdjustment

-   ClosingBalance

#### 5.1.16 StatementRecord

Generated customer statements.

### Attributes

-   StatementID

-   CustomerID

-   PeriodStart

-   PeriodEnd

-   GeneratedDate

-   DeliveryStatus (Sent/Failed)

-   FilePath

### 5.2 DIMENSION MODEL

ZivaBI supports multi-dimensional posting. Dimensions are
tenant-configurable.

### Standard Dimensions:

-   Real IO --- Customer group / territory

-   Material IO --- SKU-level segmentation

-   Cost Center IO --- For service lines

-   Statistical IO --- Optional

-   Location --- Warehouse / region / country

Each dimension must be:

-   Imported via master data

-   Validated per tenant rules

-   Mapped at line level

-   Stored in every journal entry

### 5.3 TAX MODEL

Entities:

### VATRate

-   Rate

-   EffectiveDate

-   AppliesTo: Goods / Services / Both

### WHTRate

-   Rate

-   CustomerType

-   EffectiveDate

### TaxRuleMapping

-   SKUCategory

-   ServiceCategory

-   VATApplicable (Yes/No)

-   WHTApplicable (Yes/No)

### 5.4 PRICING MODEL (Referenced by AR)

Entities:

-   PriceList

-   PriceListItem

-   CustomerPriceContract

-   VolumePricingRule

-   PromoDiscountRule

Each order line stores a PriceListSnapshot to preserve historical
integrity.

### 5.5 INVENTORY & COGS MODEL (AR Integration)

AR depends on Inventory for:

-   Cost of goods sold

-   Inventory availability

-   SKUs

-   Material IO

-   Valuation method (Standard / WAC / Actual)

Entities included:

-   InventoryItem

-   InventoryCostLayer

-   SKUCategory

-   WarehouseStock

### 5.6 WORKFLOW MODEL

All approvals (orders, returns, credit notes, DI, pricing, payments) use
a workflow engine.

Entities:

-   WorkflowDefinition

-   WorkflowStep

-   WorkflowActor

-   WorkflowInstance

-   WorkflowAction

### 5.7 RELATIONSHIP DIAGRAM SUMMARY (Textual)

### Customer 1---M CustomerOrder

### CustomerOrder 1---M CustomerOrderLine

### CustomerOrder 1---1 DeliveryInstruction

### DeliveryInstruction 1---M DeliveryEvent

### DeliveryEvent 1---M POD

### CustomerOrder → InvoiceHeader

### InvoiceHeader 1---M InvoiceLine

### Customer 1---M CustomerPayment

### CustomerPayment 1---M PaymentAllocation

### InvoiceHeader 1---M PaymentAllocation

### ReturnRequest 1---M ReturnLine

### ReturnRequest 1---1 CreditNote

### InvoiceHeader 1---1 CreditNote (optional)

This will be translated into a diagram when needed.

## 6.0 WORKFLOW OVERVIEW

The AR module of ZivaBI is powered by the Unified Workflow Engine, which
supports:

-   Multi-level approvals

-   Role-based routing

-   Value-based routing

-   Condition-based branching

-   Industry-specific flows (goods, services, hybrid)

-   Tenant-configurable workflows (no coding required)

-   SLA monitoring and escalations

-   Audit trail for every action

-   Document-driven workflows (PO, POD, invoices, returns, credit notes)

This section defines ALL workflows involved in the AR lifecycle, from
customer PO intake to invoice posting, return approvals, and payment
matching.

### 6.1 CUSTOMER ORDER WORKFLOW

This workflow manages the journey from Customer PO → Validated Sales
Order → Approved Order → Delivery Instruction.

### 6.1.1 Trigger Events

-   Customer uploads DP PO via portal

-   DPS uploads DP PO for customer

-   DPM forwards customer order

-   Sales Specialist raises direct quote

#### 6.1.2 Workflow Steps

### Step 1 --- Order Creation

Actor: Customer / DPS / Sales Specialist

System actions:

-   Validate PO format

-   Validate customer status

-   Validate product/service codes

-   Check price list validity

-   Check if duplicate PO exists

-   Check credit (if credit customer)

-   Check payment proof (if cash customer and tenant requires it)

Outcome:

-   Order moves to Pending DPS Review

### Step 2 --- DPS Review

Actor: DPS

Tasks:

-   Review customer PO accuracy

-   Confirm SKU or service availability

-   Confirm delivery address

-   Attach missing supporting documents

Actions:

-   Approve → moves to DPM

-   Reject → goes back to customer

-   Request clarification → holds workflow

### Step 3 --- DPM Review

Actor: DPM

Tasks:

-   Validate pricing, territory, and volume

-   Confirm customer commercial terms

-   Validate future promotions, discounts

-   Ensure order aligns with customer hierarchy

Actions:

-   Approve → moves to Sales Specialist

-   Reject → returned to DPS

-   Clarify → DPS notified

### Step 4 --- Sales Specialist Review

Actor: Sales Specialist (Sales Ops)

Tasks:

-   Create quote based on:

    -   Price lists

    -   Discounts

    -   VAT/WHT configuration

    -   Promotions

-   Confirm availability of goods

-   Confirm service capacity (if applicable)

-   Validate taxable lines

Actions:

-   Approve → moves to Finance

-   Reject → returned to DPM

-   Clarification → DPM notified

### Step 5 --- Finance Review

Actor: AR Officer / Finance Manager

Tasks:

-   Validate credit limit for credit customers

-   Validate payment proof for cash customers

-   Validate tax calculations (VAT/WHT)

-   Validate currency and FX rate rules

-   Validate customer outstanding balance

Actions:

-   Approve → moves to Operations Manager

-   Reject → returned to Sales

-   Hold → customer notified

### Step 6 --- Operational Approval

Actor: Operations Manager

Tasks:

-   Confirm delivery feasibility

-   Confirm warehouse capacity

-   Confirm route assignment

-   Confirm 3PL availability

Actions:

-   Approve → auto-generate Delivery Instruction

-   Reject → back to Finance

-   Request clarification → loops back to Sales Specialist

#### 6.1.3 Workflow Completion

Outcome:

-   Customer Order Status = Approved

-   Delivery Instruction generated → routed to Warehouse/3PL

-   Order ready for fulfillment

### 6.2 DELIVERY WORKFLOW (WAREHOUSE + 3PL)

This covers DI → Picking → Dispatch → Delivery → POD Upload → Delivery
Confirmation.

#### 6.2.1 Step 1 --- DI Receipt

Actor: Warehouse Officer / 3PL Officer

System Actions:

-   Notify warehouse & 3PL via email/SMS

-   Show DI in logistics portal

-   Highlight lines requiring special handling (fragile, promo packs,
    etc.)

#### 6.2.2 Step 2 --- Stock Check (Warehouse)

Actor: Warehouse Officer

Tasks:

-   Validate stock availability

-   If short, system:

    -   Blocks delivery

    -   Notifies Operations Manager

    -   Suggests alternative warehouse (if tenant has multi-WH setup)

#### 6.2.3 Step 3 --- Picking & Packing

Actor: Warehouse

Tasks:

-   Pick items based on DI

-   Pack items

-   Attach packing list

-   Update "Picked Quantity"

System:

-   Generates digital picking slip

-   Stores audit log

#### 6.2.4 Step 4 --- Dispatch

Actor: Warehouse / 3PL

Tasks:

-   Assign driver

-   Assign delivery vehicle

-   Update estimated arrival time

-   Generate Dispatch Note

#### 6.2.5 Step 5 --- Delivery Attempt

Actor: 3PL / Driver

Possible outcomes:

-   Delivered

-   Partial delivery

-   Failed delivery

-   Customer rejected goods

-   No access

Each outcome triggers a different branch.

#### 6.2.6 Step 6 --- POD Upload

Actor: 3PL / Driver / Warehouse

POD types:

-   Signed invoice

-   Photo evidence

-   Digital signature

-   Customer stamp

-   E-waybill barcode scan

System:

-   Attaches POD to DI

-   Notifies Sales, Finance, Customer

#### 6.2.7 Step 7 --- Delivery Confirmation

Actor: Warehouse / Operations Manager

System auto-updates:

-   Delivered quantity

-   Delivery timestamp

-   Proof validated status

Outcome:

-   Revenue recognition triggered (goods)

-   COGS posted

-   AR invoice created

### 6.3 INVOICE GENERATION WORKFLOW

Workflow depends on tenant selection:

### ✔ Mixed Invoice Mode

  - Goods + services can be on SAME invoice

### ✔ Separate Invoice Mode

  - Generate separate invoices: Goods Invoice + Service Invoice

#### 6.3.1 Trigger

-   Delivery confirmed (goods)

-   Service completion confirmed (services)

#### 6.3.2 Steps

### Step 1 --- Invoice Draft

System auto-generates draft with:

-   Price

-   Discount

-   VAT

-   WHT

-   FX rate

-   Dimensions (Real IO, Material IO, etc.)

### Step 2 --- Finance Validation

Actor: AR Officer

Checks:

-   FX conversion (if foreign currency)

-   VAT correctness

-   WHT applicability

-   Dimension enforcement

-   Cross-check with POD

### Step 3 --- Final Approval (Finance Manager)

After approval:

-   Invoice is posted

-   AR ledger updated

-   Customer balance updated

-   ERP posting triggered

#### 6.3.3 Workflow Completion

System actions:

-   Email invoice to customer

-   Upload invoice to customer portal

-   Update AR aging

-   Enable payment allocation

### 6.4 PAYMENT RECEIPTING WORKFLOW

Manages customer payments and WHT.

#### 6.4.1 Step 1 --- Payment Upload

Actor: Customer / Finance

Sources:

-   Bank transfer

-   Deposit slip

-   Payment portal

-   POS (if supported)

#### 6.4.2 Step 2 --- Bank Matching

System matches payment to invoices using:

-   AI keyword detection

-   Customer name

-   Invoice number in description

-   Amount similarity

-   FX rate inference

#### 6.4.3 Step 3 --- Payment Allocation

Actor: AR Officer

Options:

-   Oldest-first (default)

-   Exact invoice match

-   Manual allocation

-   Unallocated balance stored

#### 6.4.4 Step 4 --- WHT Certificate Matching

Customer uploads certificate.

System:

-   Links certificate → invoice(s)

-   Posts WHT receivable

-   Adjusts outstanding AR balance

### 6.5 RETURN & CREDIT NOTE WORKFLOW

Supports multi-actor return initiation.

#### 6.5.1 Step 1 --- Return Request Creation

Actors:

-   Customer

-   DPS

-   DPM

-   Warehouse

-   3PL

-   Finance

Information captured:

-   Returned quantity

-   Condition (good/damaged/scrap)

-   Reason

-   Photo evidence

#### 6.5.2 Step 2 --- Return Review

Actor: Operations Manager

Validates:

-   POD

-   Delivery records

-   3PL logs

-   Warehouse return notes

#### 6.5.3 Step 3 --- Finance Review

Validates:

-   Revenue reversal

-   VAT reversal

-   COGS reversal (if goods)

-   FX adjustments

-   Return category mapping

#### 6.5.4 Step 4 --- Approval Workflow

Tenant configurable:

-   LM → Finance

-   DPM → Ops → Finance

-   CFO for high-value returns

#### 6.5.5 Step 5 --- Credit Note Posting

System posts:

-   AR credit

-   VAT reversal

-   Inventory adjustment

-   COGS reversal

-   WHT adjustments

System sends credit note to customer.

### 6.6 STATEMENT GENERATION & CONFIRMATION WORKFLOW

#### 6.6.1 Step 1 --- Statement Auto-generation

Triggered:

-   Monthly

-   Quarterly

-   Year-end

System generates:

-   Outstanding invoices

-   Payments

-   Credit notes

-   Aging summary

#### 6.6.2 Step 2 --- Customer Notification

Customer receives:

-   PDF Statement

-   Link to customer portal

#### 6.6.3 Step 3 --- Customer Confirmation

Customer can:

-   Accept balance

-   Raise dispute

#### 6.6.4 Step 4 --- Finance Resolution

AR Officer:

-   Investigates dispute

-   Resolves differences

-   Updates statement

### 6.7 AGING & COLLECTION WORKFLOW

#### 6.7.1 Step 1 --- Automated Aging Calculation

Runs nightly.

Buckets:

-   0--30

-   31--60

-   61--90

-   91--180

-   181+

#### 6.7.2 Step 2 --- Reminder Logic

Tenant configures:

-   Overdue reminder rules

-   Escalation to DPS, DPM, Sales Manager

-   Customer reminder frequency

#### 6.7.3 Step 3 --- Collection Assignment

System assigns:

-   Collectors by region

-   Collectors by customer group

#### 6.7.4 Step 4 --- Promise-to-Pay Tracking

Collectors record:

-   Promised date

-   Follow-up reminders

### 6.8 FX REVALUATION WORKFLOW

**Step 1 --- Fetch FX Rates**

From tenant-approved source.

**Step 2 --- Identify Foreign Receivables**

Outstanding balances per currency.

**Step 3 --- Compute Revaluation**

Post:

-   Unrealized gain/loss

Reverse at next month start.

## 7.0 BUSINESS LOGIC OVERVIEW

This section describes how the AR system THINKS --- the internal logic,
calculations, decisions, constraints, validations, and automated
behaviors that power the Order-to-Cash (O2C) lifecycle.

While Section 6 focused on workflows,

Section 7 focuses on rules, engines, and decision frameworks, including:

-   Pricing logic

-   Tax logic (VAT/WHT)

-   FX logic

-   Dimension assignment logic

-   Inventory & service logic

-   Revenue & COGS logic

-   Return logic

-   Credit note logic

-   Accrual logic

-   Customer balance logic

-   Statement logic

-   Cross-module logic

Every rule below supports multi-tenant configuration and industry
variety (goods / services / hybrid).

### 7.1 PRICING & DISCOUNT LOGIC

Pricing logic is driven by the Pricing Engine, integrated into AR.

#### 7.1.1 Price Determination Logic

Price is pulled based on the following priority (highest → lowest):

1.  Customer-specific contract price

2.  Promotion/discount campaign price

3.  Customer group price list

4.  Global standard price

5.  Default fallback price

Price selection rules:

-   System always uses price effective on the order date.

-   Future-dated price changes automatically activate at 00:00 on
    effective date.

-   Expired prices are never used.

#### 7.1.2 Discount Logic

Discount categories:

-   Line discount

-   Volume discount

-   Basket-level discount

-   Customer group discount

-   Territory or region discount

-   Promotional discount

-   Manual discount (requires approval)

Discount application order:

1.  Line discount

2.  Volume discount

3.  Promo discount

4.  Basket discount

System ensures discount does NOT reduce price below tenant-configured
margin thresholds unless approved.

#### 7.1.3 Service Pricing Logic

Service line pricing may depend on:

-   Hourly rate

-   Daily rate

-   Milestone-based pricing

-   Retainer pricing

-   Contract-based pricing

-   Project-based pricing

Additional validation:

-   Service deliverables must be defined before invoice posting.

-   Service milestones require completion confirmation.

#### 7.1.4 Mixed Order Pricing Logic

If tenant allows mixed orders:

-   Goods pricing uses SKU price list

-   Service pricing uses service rate card

-   System separates VAT/WHT rules per line

-   System calculates revenue per line type

If tenant requires separate invoices:

-   Two invoices are generated, each with pricing logic appropriate for
    that line type.

### 7.2 TAX LOGIC (VAT, WHT, EXEMPTIONS)

Tax logic is governed by the Tax Engine.

#### 7.2.1 VAT Applicability Logic

VAT decision depends on:

1.  Customer VAT status

    -   VAT registered or not

    -   VAT exempt customer (NGO, export, govt etc.)

2.  Product/service VAT status

    -   VAT applicable

    -   Zero-rated

    -   Exempt

3.  Jurisdiction-specific rules

    -   Each tenant country has its own VAT model

4.  Transaction type

    -   Goods

    -   Services

    -   Hybrid

VAT is computed per line, not per invoice.

### VAT Formula

If VAT exclusive price:

VAT = Net Amount × VAT Rate

If VAT inclusive price:

VAT = Gross Amount × VAT Rate / (1 + VAT Rate)

#### 7.2.2 WHT Logic

WHT is applicable only when:

-   Customer deducts withholding tax

-   Product or service falls under taxable WHT category

-   Tenants map WHT rates per service category (professional services,
    rents, etc.)

System posts:

DR WHT Receivable

CR AR (Customer)

WHT reduces AR balance immediately.

WHT certificate must be uploaded to complete matching.

#### 7.2.3 VAT Reversal Logic (Returns)

When a return is approved:

1.  VAT on returned items is reversed

2.  Output VAT payable decreases

3.  Customer credit note includes VAT reversal

4.  VAT audit trail automatically updated

### 7.3 DIMENSION ASSIGNMENT LOGIC

Dimensions are required for:

-   Revenue

-   COGS

-   Accruals

-   Returns

-   Discounts

-   FX gain/loss

-   WHT receivable

Dimensions include:

-   Real IO

-   Material IO

-   Statistical IO

-   Cost Center IO

-   Location

### Logic:

-   Goods lines → Material IO + Real IO

-   Service lines → Cost Center IO + Real IO

-   Returns inherit invoice dimensions

-   Accruals inherit delivery dimensions

-   FX gain/loss inherits invoice dimensions

All dimension rules are tenant-configurable.

### 7.4 INVENTORY & COGS LOGIC

Applies only if tenant uses the Inventory Module.

#### 7.4.1 Inventory Reservation Logic

When order is approved:

-   System optionally reserves stock (if tenant enables stock
    reservation)

-   Partial reservation allowed

-   Reservation duration configurable

#### 7.4.2 COGS Determination Logic

COGS depends on tenant-selected valuation method:

### 1. Standard Cost

-   COGS = Standard cost × quantity delivered

-   Variance posted to price variance account

### 2. Weighted Average Cost (WAC)

-   COGS uses current moving average cost

-   Automatically recalculated after each inbound posting

### 3. Actual Cost (Import Model)

-   COGS = Actual landed cost per batch

-   Landed cost includes:

    -   IC invoice

    -   Customs duty

    -   Freight

    -   Clearing agent cost

    -   VAT where reclaimable

#### 7.4.3 Delivery → COGS Logic

When POD is confirmed:

DR COGS

CR Inventory

Dimensions applied automatically.

#### 7.4.4 Return Impact on COGS

If items are returned in good condition:

DR Inventory

CR COGS

If damaged beyond resale:

DR Damage Losses / Scrap

CR Inventory

### 7.5 REVENUE LOGIC

#### 7.5.1 Goods Revenue

Triggered by:

-   Delivery confirmation

-   POD upload

Revenue is recognized per delivered quantity, not ordered quantity.

#### 7.5.2 Service Revenue

Triggered by:

-   Milestone completion

    or

-   Service delivery confirmation

Revenue is posted per delivered milestone.

#### 7.5.3 Mixed Revenue Logic

If tenant uses separate invoices:

-   Revenue posted per invoice type

If tenant uses mixed invoice:

-   Revenue posted per line type

-   Dimensions differ accordingly

### 7.6 RETURN & CREDIT NOTE LOGIC

#### 7.6.1 Return Validation Logic

System checks:

-   Delivered quantity vs return quantity

-   POD

-   Delivery timestamp

-   Return reason category

-   Damage category

-   Customer eligibility (within return window)

-   Outstanding credit notes

#### 7.6.2 Return Approval Logic

Based on tenant-configured rules:

-   Value thresholds

-   Return categories

-   Initiator role

-   Risk scoring

#### 7.6.3 Credit Note Posting Logic

System posts:

### Goods Returns:

-   Reverse revenue

-   Reverse VAT

-   Reverse COGS

-   Adjust inventory

-   Post credit note

### Service Returns:

-   Reverse revenue

-   Reverse VAT

-   No COGS

### Mixed:

-   Combination of above

#### 7.6.4 Price Dispute Logic

If customer disputes price:

-   System recomputes line pricing

-   Creates price adjustment credit note

-   Posts VAT & WHT correctly

### 7.7 PAYMENT LOGIC

#### 7.7.1 Allocation Logic

Default: Oldest invoice first

Tenant can override to:

-   Exact match

-   Highest value first

-   Manual allocation

#### 7.7.2 Unallocated Payment Handling

Unallocated payments stored separately and shown in:

-   Customer statement

-   AR aging (not aged until allocated)

#### 7.7.3 WHT Matching Logic

When certificate uploaded:

-   System matches to invoice

-   Posts WHT receivable

-   Reduces outstanding AR

### 7.8 FX LOGIC

#### 7.8.1 FX Rate Selection Logic

Tenant selects rule:

-   Invoice date rate

-   Delivery date rate

-   Month-end rate

-   Daily central bank rate

#### 7.8.2 FX Revaluation Logic

At month-end:

If local currency value increases:

-   Post unrealized gain

If local currency value decreases:

-   Post unrealized loss

All reversed next month.

#### 7.8.3 FX Settlement Logic

When payment received:

-   Compute realized gain/loss

-   Post difference between:

    -   FX rate at invoicing

    -   FX rate at payment

### 7.9 ACCRUAL LOGIC

#### 7.9.1 3PL Accrual Determination

Accrue cost per delivered quantity:

-   Weight

-   Volume

-   Distance

-   Contract rate

#### 7.9.2 Warehouse Accrual Logic

Accrue cost per:

-   SKU handled

-   Pallet

-   Carton

-   Hour of storage (if tenant uses storage billing)

#### 7.9.3 Accrual Reversal Logic

When invoice from 3PL/warehouse arrives:

-   Reverse accrual

-   Book actual expense

-   Post variance

### 7.10 CUSTOMER STATEMENT LOGIC

#### 7.10.1 Statement Generation

Statements include:

-   Opening balance

-   Invoice details

-   Payments

-   Credit notes

-   WHT

-   Aging buckets

-   Running balance

#### 7.10.2 Statement Email Logic

Tenant configures:

-   Frequency

-   Email template

-   Recipients

-   Copy to DPS/DPM

#### 7.10.3 Year-End Balance Confirmation Logic

System tracks:

-   Customer acceptance

-   Rejection/remarks

-   Audit log

## 8.0 UI/UX REQUIREMENTS OVERVIEW

The UI/UX for the Accounts Receivable (AR) Module must be:

-   Modern, clean, intuitive, and future-proof

-   Modular and extremely responsive (mobile-first + desktop optimized)

-   Role-based (DPS, DPM, Sales Specialist, AR Officer, Customer,
    Warehouse, 3PL)

-   Configurable per tenant (layout, fields, labels, color branding)

-   Driven by drag-and-drop widgets and dashboards

-   Consistent with ZivaBI's global design system (ZDS)

-   Accommodating industry diversity: distribution, services, hybrid,
    logistics

-   Accessible (WCAG AA level), supporting all modern devices

-   Data-rich but simple to navigate

This section describes every screen, widget, component, and navigation
pathway relevant to the AR module.

### 8.1 GLOBAL DESIGN PRINCIPLES

1.  Dashboard-first navigation

    -   All personas land on dashboards with actionable widgets.

2.  Low learning curve

    -   Interface should be usable by non-technical staff.

3.  Phone-first design (critical for DPS, DPM, 3PL, drivers)

    -   All flows must work smoothly on mobile view.

4.  Clear business terminology

    -   Tenant can rename fields/labels (e.g., "Sales Order" → "DP
        Request").

5.  Minimalist but information-rich

    -   Use collapsible containers, filters, and progressive disclosure.

6.  Document-driven navigation

    -   Screens show attached documents (PO, POD, invoices) in a side
        panel.

7.  Full audit transparency

    -   Every action has a time-stamped history panel.

8.  Configurable UI elements per tenant

    -   Hide/show fields

    -   Rename dimension fields

    -   Rearrange form sections

    -   Select mandatory vs optional

9.  Dark mode & accessible font scaling

    -   Included across all tenant portals.

### 8.2 PERSONA-LEVEL UI/UX SUMMARIES

Below are requirements per persona.

#### 8.2.1 DPS Dashboard

### Widgets

-   Assigned Customers

-   Customer Balances

-   Pending Approvals

-   Pending Deliveries

-   Disputes Requiring Action

-   Returns Awaiting Processing

-   My Sales Orders (Draft / Submitted / Approved)

-   Overdue Customers in Territory

### Key Interface Components

-   DP PO Upload Form

-   Order Status Tracker

-   Customer Financial Snapshot

-   FOC Request Form

-   Return Request Form

-   Customer Portal View-as (limited)

#### 8.2.2 DPM Dashboard

### Widgets

-   Territory Sales Performance

-   Territory AR Aging

-   Top Debt Customers

-   Order Pipeline

-   Credit Utilization Summary

-   Pending DPM Approvals

-   Returns Pending Review

-   FOC & Claim Approvals

-   Customer Profitability Snapshots

### Screens

-   Customer AR Balance View

-   Price Exception Alerts

-   Territory-level Statement Downloads

#### 8.2.3 Sales Specialist UI

### Main Panels

-   Quote Creation Console

-   Price List Insights

-   Pending Finance Approval

-   Upcoming Deliveries

-   Customer Profitability Snapshots

-   Service Milestone Completion Form

### Key UX Rules

-   Auto-fill pricing

-   Real-time discount validation

-   VAT/WHT explanation popup on hover

#### 8.2.4 Operations Manager UI

### Main Panels

-   Delivery Instruction (DI) Dashboard

-   Warehouse Fulfillment Overview

-   3PL Assignment Board

-   Return Verification Console

-   Damage Classification Interface

-   Route Optimization (if enabled)

#### 8.2.5 Warehouse Portal UI

### Features

-   DI List

-   Picking Screen

-   Packing List Generation

-   Damaged/Missing Items Reporter

-   POD Upload (via mobile camera)

-   Stock Inquiry Panel

### UX Requirements

-   Fully mobile-optimized

-   Offline mode for bad warehouse connectivity

-   Simple checkbox-based picking UX

#### 8.2.6 3PL Portal UI

### Features

-   Delivery Job List

-   Scan-to-Open DI (Barcode / QR)

-   POD Upload

-   Delivery Status Update Buttons

-   Damage Reporting Form

-   Shipment History

UX: Minimal, lightweight, mobile-first.

#### 8.2.7 Finance AR Officer UI

### Widgets

-   Outstanding AR

-   WHT Certificates Pending Matching

-   Returns Awaiting Finance Approval

-   Credit Notes Queue

-   Overdue Customers

-   FX Revaluation Pending

-   Bank Statement Unmatched Lines

-   Exception Queue

### Screens

-   Invoice Review Panel

-   Payment Allocation Console

-   Credit Note Issuer

-   Return Validator

-   AR Ledger Explorer

-   Bank Reconciliation Screen

-   ERP Posting Monitor

#### 8.2.8 Finance AR Manager UI

### Features

-   High-level dashboards

-   Approval screens for:

    -   Credit notes

    -   WHT adjustments

    -   Write-offs

    -   High-value returns

-   Cash Projection Dashboard

-   AR Aging by Region / DPM / Territory

#### 8.2.9 CFO / FD UI

### Widgets

-   Total AR Aging

-   DSO Trends

-   Revenue Recognition Dashboard

-   FX Gain/Loss Summary

-   High Risk Customer List

-   Collections Performance

-   Accrual Summary

-   Exception Summary (Tax, FX, AR, Rev Rec)

#### 8.2.10 Customer Portal UI

### Features

-   Order → Delivery → Invoice timeline

-   Statement download

-   Invoices (PDF, Excel, View Online)

-   POD Download

-   WHT Upload

-   Dispute Form

-   Return Request Form

-   Payment Proof Upload

-   Credit Notes & Claim Status

-   Chat/Message to AR Team (optional)

UI: Must feel modern like a banking or telecom portal.

### 8.3 KEY SCREENS & UX FLOWS

Below are descriptions of major AR module screens.

#### 8.3.1 Customer Order Creation Screen (Internal)

### UI Structure:

-   Section A: Customer Details

-   Section B: PO Upload

-   Section C: Goods & Services Lines

-   Section D: Pricing & Tax Summary

-   Section E: Dimension Preview

-   Section F: Submission Panel

### Behaviors:

-   Auto-validate SKU / service codes

-   Auto-calc VAT/WHT

-   Highlight credit limit issues

-   Show warnings for price anomalies

-   Dynamic form for service vs goods

#### 8.3.2 Order Status Tracker UI

A timeline view showing:

1.  PO Uploaded

2.  DPS Review

3.  DPM Review

4.  Sales Specialist Review

5.  Finance Check

6.  Ops Check

7.  DI Generated

8.  Warehouse Picked

9.  Out for Delivery

10. Delivered

11. POD Uploaded

12. Invoice Generated

13. Payment Received

14. Statement Updated

Each step clickable to open sub-screens.

#### 8.3.3 Delivery Instruction (DI) Board

Kanban-style board:

-   TO PROCESS

-   PICKING

-   IN TRANSIT

-   DELIVERED

-   FAILED

-   RETURN REQUESTED

Each DI card shows:

-   Customer

-   Route

-   Delivery notes

-   Items

-   SLA remaining

#### 8.3.4 Invoice Review Screen

### Contains:

-   Invoice header

-   Line items with VAT/WHT

-   Dimensions

-   POD link

-   Delivered quantity vs invoiced quantity

-   FX rate selector

-   ERP export status

#### 8.3.5 Return Management UI

Split into:

-   Pending Returns

-   Under Review

-   Finance Review

-   Approved for Credit Note

-   Completed

Each return line shows:

-   Reason

-   Quantity

-   Condition (Good / Damaged / Scrap)

-   Linked POD / photos

#### 8.3.6 Credit Note Issuance Screen

Shows:

-   Auto-computed amounts

-   VAT/WHT adjustments

-   GL impact preview

-   Dimensions preview

-   Draft credit note PDF

#### 8.3.7 AR Ledger Explorer

### Features:

-   Even Excel-like grid

-   Search by invoice, order, customer

-   Drill down into invoice lines

-   Show AR movements:

    -   Invoice → Payment → CN → FX → WHT

#### 8.3.8 Payment Allocation Console

Supports:

-   Manual allocation

-   Suggested matches (AI)

-   Split allocations

-   Partial payments

UX must be simple and intuitive.

#### 8.3.9 Bank Reconciliation UI

Like advanced spreadsheet view:

-   Bank Statement Column

-   System Column

-   AI Matches

-   Manual Override Buttons

-   Allocation Suggestions

#### 8.3.10 Customer Portal Statement UI

Shows:

-   Opening balance

-   Line by line AR items

-   Running balance

-   Aging filter

-   Download options

### 8.4 DRAG-AND-DROP DASHBOARD WIDGETS

Widgets available:

-   Total AR

-   DSO

-   Credit Utilization

-   Pending Deliveries

-   Order Pipeline

-   FX Exposure

-   Payment Trend

-   Overdue Customers

-   Revenue vs COGS

-   3PL SLA Performance

-   Return Rates

-   Claim Status Tracker

Users can personalize dashboards per preference.

### 8.5 TENANT BRANDING & CUSTOMIZATION

Tenant can configure:

-   Company colors

-   Logo

-   Font

-   Field labels

-   Field visibility

-   Mandatory fields

-   Invoice template design

-   Statement template design

-   Customer portal theme

## 9.0 REPORTING & ANALYTICS

The AR Reporting & Analytics framework provides complete financial
visibility, performance insights, audit transparency, and operational
intelligence across the entire Order-to-Cash (O2C) lifecycle.

Reports must support:

-   Sales

-   Operations

-   Finance (AR, Treasury, Tax)

-   Audit

-   Executives (CEO, CFO, GM)

-   Customers (via Customer Portal)

Reports must be:

-   Real-time

-   Filterable

-   Exportable (PDF, Excel, CSV)

-   Dimension-aware

-   Multi-currency capable

-   Tenant-configurable

-   Fully drillable (summary → detail → document)

Analytics must support:

-   Dashboards

-   Trends

-   Variances

-   Predictive scoring

-   Exception identification

This section outlines all reporting and analytics capabilities required
for the AR module.

### 9.1 STANDARD FINANCIAL REPORTS

These are core finance reports aligned with IFRS, GAAP, and industry
practice.

#### 9.1.1 AR Aging Report

Breakdown of receivables by age brackets:

-   0--30 days

-   31--60 days

-   61--90 days

-   91--180 days

-   180 days

Features:

-   Dimension filters (customer group, region, DPS, DPM, SKU-category)

-   Currency filter

-   Drilldown to invoice

-   Drilldown to POD

-   Export to Excel/PDF

#### 9.1.2 Customer Statement of Account (SOA)

Used for:

-   Customer reconciliation

-   Balance confirmation

-   Audit

Includes:

-   Opening balance

-   Invoices

-   Credit notes

-   Payments

-   WHT certificates

-   Running balance

-   Aging summary

Customers can download via Customer Portal.

#### 9.1.3 AR Ledger Report

Shows all AR movements:

-   Invoice

-   Payment

-   WHT

-   Credit note

-   FX gain/loss

-   Write-offs

Supports:

-   Date range

-   Multi-currency

-   Customer filters

-   Export

#### 9.1.4 Credit Utilization Report

For credit customers:

-   Credit limit

-   Used credit

-   Available credit

-   Over-limit warnings

-   Trends

Segmentable by:

-   Territory

-   DPS

-   DPM

-   Region

#### 9.1.5 Revenue Report

Can be viewed:

-   By customer

-   By region

-   By SKU

-   By service type

-   By sales person

-   By dimension (Real IO / Material IO)

Supports goods + services.

#### 9.1.6 COGS Report

Inventory tenants only.

Shows:

-   COGS by SKU

-   COGS by customer

-   COGS by region

-   Profit margins

#### 9.1.7 VAT Report (Output VAT)

Based on invoice postings.

Breakdown by:

-   Tax category

-   Customer type

-   Region/state

-   Zero-rated vs standard VAT

Supports export to match regulatory filings.

#### 9.1.8 WHT Receivable Report

Shows:

-   WHT deducted

-   Certificates uploaded

-   Certificates missing

-   Outstanding WHT receivables

-   Matching status

Useful for tax teams.

### 9.2 OPERATIONAL REPORTS

These support sales, warehouse, 3PL, and O2C performance.

#### 9.2.1 Order-to-Cash Cycle Time Report

Shows duration of each O2C phase:

-   PO review

-   Quote approval

-   Finance confirmation

-   Delivery time

-   Invoice issuance

-   Payment receipt

Highlights bottlenecks.

#### 9.2.2 Delivery SLA Report

Measures:

-   Expected vs actual delivery time

-   On-time delivery %

-   3PL failure reasons

-   Route-based delays

Supports SLA monitoring.

#### 9.2.3 POD Compliance Report

Tracks:

-   POD uploaded vs missing

-   POD validation failures

-   POD delay patterns

#### 9.2.4 Return & Credit Note Report

Shows:

-   Return frequency

-   Reason categories

-   Credit note value

-   Operational vs customer returns

-   Damage classification

Helps detect fraud or operational inefficiencies.

#### 9.2.5 FOC & Rebate Compliance Report

Tracks:

-   FOC volume by customer

-   Rebate claims submitted vs approved

-   Promotional spend

-   Trade spend alignment

### 9.3 SALES & CUSTOMER REPORTS

Reports designed specifically for DPS, DPM, Sales Managers.

#### 9.3.1 Customer Performance Dashboard

Shows:

-   Sales value

-   Quantity purchased

-   AR balance

-   Payment behavior

-   Return ratio

-   FOC received

-   Claim history

-   Credit approval turnaround

#### 9.3.2 Territory Performance Report

Breakdown by:

-   Region

-   DPS

-   DPM

-   Key accounts

-   Route-to-market

#### 9.3.3 Customer Risk Score Report

AI-powered risk scoring using:

-   Payment history

-   Overdues

-   Order frequency

-   Dispute patterns

-   Return patterns

-   Customer profile

### 9.4 3PL & WAREHOUSE REPORTS

#### 9.4.1 3PL Delivery Performance Report

Shows:

-   Total deliveries

-   Successful deliveries

-   Failed attempts

-   Damage incidents

-   SLA adherence

-   Cost per route

-   3PL performance ranking

#### 9.4.2 Warehouse Fulfillment Report

Tracks:

-   Picking accuracy

-   Packing accuracy

-   Outbound timeliness

-   Inbound accuracy

-   Warehouse damages

### 9.5 TAX & COMPLIANCE REPORTS

#### 9.5.1 VAT Output Summary

Categorized by goods vs services.

#### 9.5.2 WHT Certificate Validation Report

Shows:

-   Missing certificates

-   Certificates uploaded late

-   Discrepancies

#### 9.5.3 FX Revaluation Report

Shows:

-   Unrealized gains/losses

-   Realized gains/losses

-   Impact per customer

### 9.6 MANAGEMENT & EXECUTIVE ANALYTICS

These support CFO, CEO, Director-level decision-making.

#### 9.6.1 Executive AR Dashboard

Includes:

-   Total AR

-   DSO trend

-   Cash collection efficiency

-   Top 20 customers by exposure

-   Top overdue customers

-   Revenue vs COGS margin

-   Region performance

-   FX exposure

#### 9.6.2 Cash Forecasting Model

Predicts:

-   Expected cash inflows

-   High-risk customers

-   Payment delays

-   Budget vs actual collections

AI-enhanced predictions.

#### 9.6.3 Customer Profitability Model

Shows:

-   Revenue

-   COGS

-   Return costs

-   Trade spend applied

-   Logistics cost

-   Net profitability

Per customer.

### 9.7 AUDIT TRAILS & FORENSIC REPORTING

#### 9.7.1 AR Audit Log

Tracks:

-   Every invoice action

-   Every return action

-   Every approval step

-   Changes in dimensions

-   FX adjustments

-   Price overrides

-   Credit approvals

#### 9.7.2 Fraud Detection Report

AI flags:

-   Abnormal returns

-   Price overrides

-   Credit misuse

-   Suspicious payment patterns

-   Duplicate invoices

-   High-volume negative postings

### 9.8 CUSTOMER PORTAL REPORTS

Customers can access:

-   Real-time account balance

-   Statement of account

-   Invoice history

-   Payment history

-   Credit notes

-   Claims status

-   FOC records

-   WHT certificate logs

These improve transparency and reduce finance workload.

### 9.9 REPORT DELIVERY METHODS

Reports must be delivered via:

-   On-screen dashboards

-   Email schedules

-   Export (Excel, CSV, PDF)

-   API endpoints

-   Customer portal

-   External auditor access (read-only)

### 9.10 CONFIGURATION OPTIONS

Tenant can configure:

-   Report visibility per role

-   Report frequency

-   Report formats

-   Custom report fields

-   Custom dimensions

-   Branded report templates

-   Tax-specific formats

-   Multi-company consolidation

## 10.0 INTEGRATION OVERVIEW

The AR module must seamlessly integrate with:

-   Inventory Module

-   Warehouse Module

-   3PL Portal

-   Pricing Engine

-   Tax Engine

-   Workflow Engine

-   Customer Portal

-   Payment Engine

-   ERP systems (Sage X3, SAP, Oracle, Dynamics, etc.)

-   Document Engine (PDF generator, file storage)

-   Notification Engine (email/SMS/push)

-   Banking/Payment providers

-   Master Data Services

This section defines all APIs, integration behavior, and data exchange
rules for the AR module.

### 10.1 INTERNAL MODULE INTEGRATIONS

Integrations with other ZivaBI modules.

#### 10.1.1 Inventory Module Integration

### Data consumed from Inventory:

-   SKU list

-   Inventory availability

-   Costing method (Standard, WAC, Actual)

-   Material IO mapping

-   Batch/lot information (optional)

-   Warehouse stock levels

-   Product VAT classifications

### Data sent to Inventory:

-   Delivered quantity (for COGS posting)

-   Returned quantity

-   Damage classification

-   Inbound/outbound stock movements

### Real-time behaviors:

-   Real-time reservation (if tenant enables)

-   Partial delivery handling

-   Return-to-stock updates

#### 10.1.2 Warehouse Module Integration

### Data sent to Warehouse:

-   Delivery Instruction (DI) details

-   Order priority

-   Picking/packing lists

### Data received:

-   Picked quantity

-   Packed quantity

-   Dispatch logs

-   Warehouse damage reports

-   Return acceptance feedback

#### 10.1.3 3PL Portal Integration

### Data sent to 3PL:

-   Delivery jobs

-   Delivery instructions

-   Route information

-   Customer delivery locations

### Data received from 3PL:

-   Delivery attempt updates

-   POD (documents, photos, signature)

-   Damage reports

-   Final delivered quantities

#### 10.1.4 Pricing Engine Integration

### Data consumed:

-   Price lists

-   Volume discounts

-   Promotion rules

-   Customer contract pricing

-   Effective/expiry dates

### Behavior:

-   AR uses snapshot of pricing at order creation

-   Ensures historical price integrity

#### 10.1.5 Tax Engine Integration

### Data consumed:

-   VAT rules

-   WHT rules

-   Zero-rated/exempt product list

-   Reverse VAT rules

-   Tax effective dates

### Data returned by Tax Engine:

-   VAT amount per line

-   WHT amount per line

-   Tax journal entries

#### 10.1.6 Workflow Engine Integration

Used for approvals for:

-   Sales order

-   Pricing override

-   Credit limit override

-   Returns

-   Credit notes

-   Service milestone approvals

-   Invoice review

-   Payment exceptions

#### 10.1.7 Customer Portal Integration

Customer portal shows:

-   Order → Delivery → Invoice timeline

-   Statements

-   Invoices

-   POD

-   WHT history

-   Claims

-   Return requests

-   Payment proof upload

AR pushes all relevant data to the Customer Portal API.

#### 10.1.8 Document Engine Integration

Documents stored:

-   Customer PO

-   Quotes

-   Delivery notes

-   POD

-   Invoices

-   Return pictures

-   Credit notes

-   WHT certificates

Document engine generates:

-   PDFs

-   Excel exports

-   Branded templates

#### 10.1.9 Notification Engine Integration

Notifications delivered via:

-   Email

-   SMS

-   Push notifications

-   Customer portal alerts

-   In-app notifications

Triggers include:

-   Delivery updates

-   Invoice posting

-   Returns

-   Credit note approval

-   Payment receipt

-   Statement generation

### 10.2 EXTERNAL INTEGRATIONS

This section defines how AR interacts with external systems.

#### 10.2.1 ERP Integration (Sage X3, SAP, Oracle, Dynamics, etc.)

ERP integration is bidirectional, depending on tenant capability.

### Data sent TO ERP:

-   AR invoices

-   Credit notes

-   Customer payments

-   WHT receivables

-   FX gains/losses

-   COGS postings

-   Revenue postings

-   Customer master data updates (optional)

### Data received FROM ERP:

-   Customer master data

-   Customer balances

-   Approved price lists (if ERP is pricing source)

-   FX rates

-   Tax rate changes

-   Opening AR ledger

### Integration Methods:

-   REST API

-   SFTP batch upload (CSV, XML, JSON)

-   Direct database connector (for on-prem ERP)

#### 10.2.2 Banking System Integration

### Supported methods:

-   Bank statement retrieval

-   Real-time payment API (if bank supports)

-   Payment confirmation webhooks

-   Secure FTP downloads

### Data used for:

-   Payment matching

-   WHT deduction recognition

-   Cash forecasting

#### 10.2.3 EDI / Customer Integration (optional)

Allows major customers to send:

-   EDI purchase orders

-   EDI confirmations

-   ASN (Advanced Shipping Notice)

-   Payment remittances

Supports global retailers.

#### 10.2.4 3PL System Integration (External)

If tenant uses large logistics companies (DHL, GIG, etc.):

-   API endpoint for delivery status

-   Webhook for POD

-   Scheduled sync for delivery logs

### 10.3 API ENDPOINTS (INTERNAL)

Below are key ZivaBI internal API endpoints required for AR
functionality.

#### 10.3.1 Order API

### POST /orders

Create order.

### GET /orders/{id}

Retrieve order.

### PUT /orders/{id}

Update order.

### GET /orders?customer=...

List customer orders.

#### 10.3.2 Delivery Instruction API

### POST /delivery-instructions

Generate DI.

### GET /delivery-instructions/{id}

Retrieve DI.

### POST /delivery-instructions/{id}/events

Post delivery events (picking, dispatch, delivered).

#### 10.3.3 POD API

### POST /pod/upload

Upload POD file.

### GET /pod/{id}

Retrieve POD.

#### 10.3.4 Invoice API

### POST /invoices

Generate invoice.

### GET /invoices/{id}

Retrieve invoice.

### GET /invoices?customer=...

List invoices.

### POST /invoices/{id}/post

Post to ERP.

#### 10.3.5 Payment API

### POST /payments

Record payment.

### POST /payments/{id}/allocate

Allocate payment.

### GET /payments/unallocated

Retrieve unallocated payments.

#### 10.3.6 Return API

### POST /returns

Start return request.

### POST /returns/{id}/approve

Approve return.

### POST /returns/{id}/reject

Reject return.

#### 10.3.7 Credit Note API

### POST /credit-notes

Issue credit note.

### GET /credit-notes/{id}

Retrieve credit note.

#### 10.3.8 AR Aging API

### GET /ar/aging

Retrieve aging summary.

#### 10.3.9 WHT Certificate API

### POST /wht-certificates

Upload WHT certificate.

### GET /wht-certificates/{id}

Retrieve certificate.

### 10.4 AUTHENTICATION & SECURITY

All external APIs use:

-   OAuth 2.0

-   JWT tokens

-   Tenant-level API keys

-   Role-based rate limits

Security mandates:

-   No cross-tenant data visibility

-   All files stored encrypted at rest

-   All transmissions use TLS 1.3

-   Full audit log for every API call

### 10.5 DATA SYNCHRONIZATION LOGIC

### Real-time sync:

-   Delivery events

-   POD uploads

-   Price list changes

-   Tax rate changes

### Scheduled sync:

-   ERP postings

-   Daily FX rates

-   Customer credit updates

### 10.6 FAILURE HANDLING

### If ERP posting fails:

-   Invoice returns to "Posting Failed" queue

-   Retry mechanism every X minutes

-   Finance notified

-   Full error detail logged

### If POD upload fails:

-   3PL portal retries

-   Warehouse can upload manually

### If bank statement import fails:

-   Error goes to Reconciliation Exception Queue

### 10.7 LOGGING & MONITORING

-   API request/response logs

-   Workflow logs

-   Error logs

-   ERP sync logs

-   Bank integration logs

-   Customer portal activity

-   POD ingestion logs

All logs are timestamped and tenant-isolated.

**SECTION 11 --- NON-FUNCTIONAL REQUIREMENTS (NFRs)**

(Full, enterprise-grade, deeply detailed. Paste directly into your AR
PRD.)

## 11.0 NON-FUNCTIONAL REQUIREMENTS

The AR module must meet strict performance, security, scalability,
availability, auditability, and compliance standards required in modern
enterprise financial systems.

The requirements ensure ZivaBI AR can operate in:

-   High-volume FMCG environments

-   Multi-warehouse distribution chains

-   Multi-country, multi-currency companies

-   Hybrid service + goods organizations

-   Small businesses and global enterprises

These NFRs apply across:

-   Internal portals

-   Customer portals

-   Warehouse & 3PL portals

-   APIs & integrations

-   Document engine

-   Workflow engine

-   Mobile access

### 11.1 PERFORMANCE REQUIREMENTS

#### 11.1.1 Response Time

-   All UI pages must load in \< 3 seconds under normal network
    conditions.

-   Search queries and list views must return results in \< 2 seconds.

-   Bulk AR aging calculations must finish in \< 30 seconds for up to 5
    million records.

-   Payment allocation suggestions must compute in \< 5 seconds.

-   Invoice generation (goods or services) should not exceed 5 seconds.

#### 11.1.2 Scalability

System must support:

| Item | Requirement |
| --- | --- |
| Concurrent users | Up to 50,000 globally |
| Daily transactions | 5--20 million O2C events |
| Deliveries processed/day | 2--5 million |
| Invoices/day | 1--3 million |
| Returns/day | 500,000+ |
| POD uploads/day | 5 million |

Horizontal autoscaling is required for:

-   API services

-   Document storage

-   Notification engine

-   Workflow engine

-   Pricing engine

#### 11.1.3 Data Processing

Batch workloads (nightly jobs):

-   AR aging

-   Statement generation

-   FX revaluation

-   Accrual updates

-   ERP sync

-   Risk scoring

Must complete within defined tenant window (usually midnight--5 AM).

### 11.2 RELIABILITY & AVAILABILITY

#### 11.2.1 Uptime

-   99.9% uptime SLA for standard tenants

-   99.99% uptime SLA for premium tenants

#### 11.2.2 Fault Tolerance

System must:

-   Retry failed API calls

-   Resubmit ERP postings

-   Auto-recover long-running workflows

-   Save partial data during network loss

-   Queue POD uploads offline for 3PL mobile users

#### 11.2.3 Backup & Recovery

-   Full backup every 24 hours

-   Incremental backup every 15 minutes

-   Retention: 7 years (finance compliance)

-   RPO: ≤ 15 minutes

-   RTO: ≤ 2 hours

### 11.3 SECURITY REQUIREMENTS

#### 11.3.1 Authentication

-   OAuth 2.0

-   MFA (optional per tenant)

-   SSO (Azure AD, Google Workspace, Okta)

-   JWT tokens for API calls

-   Role-based permissions enforced at every endpoint

#### 11.3.2 Authorization

Granular role-based access:

-   DPS sees only assigned customers

-   DPM sees only territory

-   Warehouse sees only DI & picking data

-   3PL sees only assigned deliveries

-   Finance sees tenant-wide AR

-   Super Admin sees no tenant data (structural access only)

#### 11.3.3 Encryption

-   All data in transit: TLS 1.3

-   All data at rest: AES-256

-   Documents: Encrypted Blob Storage

-   Passwords: Hashed & salted (bcrypt)

#### 11.3.4 Logging & Monitoring

-   Every action logged

-   Every API call logged

-   Multi-level audit trails (user + system)

-   Logs immutable for 7 years

-   Separate event log for:

    -   Financial postings

    -   Workflow approvals

    -   Pricing overrides

    -   Returns & credit notes

### 11.4 DATA PRIVACY & COMPLIANCE

System must comply with:

-   GDPR

-   NDPR

-   PCI DSS (for payment processing tenants)

-   SOC 2

-   IFRS/GAAP reporting

-   Local VAT & WHT laws

-   Tenancy data isolation standards

Data separation rules:

-   Each tenant has isolated schema

-   No cross-tenant database access

-   No shared reporting datasets

### 11.5 USABILITY & ACCESSIBILITY

#### 11.5.1 Accessibility

-   WCAG 2.1 AA compliance

-   Screen reader support

-   High contrast and large-text mode

-   Keyboard-only navigation

-   Mobile-first design for field users (DPS/3PL)

#### 11.5.2 Usability

-   Progressive disclosure (show complexity only when needed)

-   Tooltips for tax/dimension logic

-   Inline document viewer for PO/POD/invoice

-   Multi-file drag-and-drop

-   Automatic field suggestion (AI learning)

### 11.6 LOCALIZATION & MULTI-CURRENCY

#### 11.6.1 Multi-Currency Support

System must handle:

-   Customer currency ≠ Tenant currency

-   Real-time FX fetching

-   Deferred FX posting

-   FX revaluation

-   Unrealized/realized gain/loss

All monetary values stored in:

1.  Transaction currency

2.  Base currency

3.  Reporting currency

#### 11.6.2 Localization

Tenant-specific:

-   Date format

-   Number format

-   Currency symbol

-   VAT/WHT naming

-   Tax rules

-   Regional language (if enabled)

### 11.7 DOCUMENT HANDLING

System must support:

-   PDF, XLSX, DOCX, JPG, PNG upload

-   OCR scanning (PO, POD, invoice, WHT certificate)

-   Document mapping to order/delivery/invoice

-   Max file size: 250MB per file

-   Bulk upload: 5GB per batch

Document viewer must support annotations and comparison.

### 11.8 INTEGRATION & API NFRs

#### 11.8.1 Throughput

-   10,000 API calls/second per tenant

-   Burst of 100,000 requests/second supported

#### 11.8.2 Latency

-   \<200ms for internal APIs

-   \<500ms for ERP/3PL external APIs

#### 11.8.3 Error Handling

-   Standard error formats

-   Retry-with-backoff

-   Circuit breaker pattern

-   Alerting to DevOps via Slack/Teams/SMS

### 11.9 MOBILE APP REQUIREMENTS

Mobile portals for:

-   DPS

-   DPM

-   Warehouse

-   3PL

-   Customers

Capabilities:

-   Offline mode (queue until reconnect)

-   Camera integration (POD, WHT cert, PO scan)

-   GPS tagging (optional for deliveries)

-   Touch-optimized UI

### 11.10 EXTENSIBILITY & CONFIGURABILITY

#### 11.10.1 Tenant Config

Tenant can configure:

-   Price logic

-   Tax logic

-   Credit rules

-   Workflow steps

-   Field labels

-   Visibility rules

-   Portal theming

All without coding.

#### 11.10.2 Plugin Framework

Allows tenants to:

-   Add custom validations

-   Add custom reports

-   Inject approval rules

-   Extend return rules

-   Add risk scoring models

### 11.11 AUDIT & FORENSICS REQUIREMENTS

Must track:

-   Every financial posting

-   Every return action

-   Every credit note

-   Every dimension change

-   Every FX update

-   Every POD upload

-   Every ERP sync

-   Every access from any portal

Audit logs must be exportable and searchable.

### 11.12 HIGH AVAILABILITY & DISASTER RECOVERY

**HA Requirements**

-   Multi-zone deployment

-   Load-balanced microservices

-   Self-healing containers

**DR Requirements**

-   Hot standby in alternate region

-   Failover \< 5 minutes

-   Regular DR test reports

**SECTION 12 --- AUDIT & COMPLIANCE REQUIREMENTS**

(Full, enterprise-grade, comprehensive. Paste directly into your AR
PRD.)

## 12.0 AUDIT & COMPLIANCE REQUIREMENTS

The AR module of ZivaBI must operate under strict financial audit,
internal control, regulatory compliance, and forensic tracking
requirements.

This section defines:

-   Mandatory audit trails

-   Financial control requirements

-   Compliance with tax & accounting standards

-   Document retention rules

-   System access & segregation-of-duties controls

-   Forensic and fraud-detection requirements

-   Reporting obligations

These ensure the system satisfies CFOs, auditors (internal & external),
regulators, and corporate governance teams.

### 12.1 AUDIT TRAIL REQUIREMENTS

Every action in the AR module must be logged with:

-   Timestamp (UTC)

-   Actor (UserID, Role, IP, Device)

-   Old Value

-   New Value

-   Origin Module (Customer Portal, AR Portal, Warehouse, 3PL, API)

-   Document Link (PO, DI, POD, Invoice, Payment, Return, Credit Note)

-   Change Reason (if provided by user)

Audit logs MUST NEVER be editable by any user, including:

-   Super Admin

-   Tenant Admin

-   Finance roles

-   Developers

-   DBAs

Only read access is allowed based on permissions.

### 12.2 AUDITABLE ENTITIES

The following AR entities must have full audit trails:

### (A) Order-to-Cash Artifacts

-   Customer PO

-   Sales Order

-   Delivery Instruction (DI)

-   Warehouse Pick/Pack

-   3PL Delivery updates

-   POD

-   Invoice

-   Credit note

-   Returns

-   Claims (FOC, rebates)

-   Payments

-   WHT Certificates

### (B) Financial Records

-   AR ledger entries

-   COGS entries

-   Revenue recognition entries

-   VAT postings

-   WHT receivable postings

-   FX gain/loss

-   Accruals & reversals

### (C) Master Data

-   Customer master data

-   Price lists

-   Credit limits

-   Dimensions

-   Tax rates

-   Payment terms

### (D) Access & Authentication

-   Logins / logouts

-   Role assignments

-   Permission changes

-   API key usage

### 12.3 SEGREGATION OF DUTIES (SoD)

The AR system must enforce SoD rules to prevent conflicts of interest.

Below are standard SoD controls (tenant can configure additional):

### 12.3.1 Creation vs Approval

-   DPS/DPM can create orders

-   Finance must approve credit

-   Operations must approve delivery

-   Only Finance Manager can approve invoices

-   Only CFO/FD can approve high-value credit notes

### 12.3.2 Posting vs Reconciliation

-   AR Officer posts invoices

-   Treasury handles bank reconciliation

-   AR Manager approves adjustments

### 12.3.3 Credit Control

-   Sales cannot modify credit limits

-   Credit team cannot modify SKUs/pricing

### 12.3.4 Return vs Credit Note

-   Operations approves return

-   Finance approves credit note

-   Sales may only initiate, not finalize

### 12.3.5 Super Admin Restrictions

Super Admin cannot:

-   View tenant financial data

-   Approve or reject anything

-   Access AR ledger

Super Admin only manages:

-   Infrastructure

-   Tenant provisioning

-   Module activation

### 12.4 TAX COMPLIANCE REQUIREMENTS

The AR module must support compliance with:

-   VAT (local jurisdiction rules)

-   GST (where applicable)

-   WHT (with tax rate mapping)

-   Customs duty (if using import module)

-   Excise tax (if tenant requires)

### System Responsibilities

1.  Correct VAT classification per line

2.  Correct WHT determination

3.  Ensure tax rate validity per date

4.  Block invoicing of tax-invalid transactions

5.  Generate audit-ready VAT & WHT reports

6.  Reverse VAT/WHT on returns

7.  Support multi-jurisdiction tax rules

### 12.5 FINANCIAL COMPLIANCE & ACCOUNTING STANDARDS

The AR module must comply with:

-   IFRS 15 (Revenue Recognition)

-   IFRS 9 (Financial Instruments -- receivables impairment)

-   IFRS 21 (Effects of changes in FX)

-   IFRS 2 (Share-based payments -- rebates if applicable)

-   GAAP equivalents

-   Internal corporate accounting policies

### Revenue Recognition Rules (IFRS 15)

-   Goods: revenue recognized on delivery (POD confirmed)

-   Services: revenue recognized on milestone completion

-   Mixed orders: line-level revenue recognition

### Financial Instrument Rules (IFRS 9)

-   AR balances tracked as financial assets

-   WHT receivables treated as temporary assets

-   Impairment rules applicable for overdue customers

### 12.6 DOCUMENT RETENTION & ARCHIVING

### Retention requirements

-   7 years minimum (tenant can extend)

-   Permanent retention for credit notes (tax-sensitive)

-   Immutable storage for:

    -   Customer POs

    -   PODs

    -   WHT certificates

    -   Invoices

    -   Credit Notes

### Archiving Rules

-   Automatic archive after tenant-defined period

-   Archive does NOT delete --- only moves to cold storage

-   Archived items must be retrievable within \< 30 seconds

### 12.7 FRAUD DETECTION & FORENSIC ANALYTICS

AI-based fraud detection monitors:

### 12.7.1 AR Fraud Patterns

-   Unusual returns

-   Excessive discounts

-   Duplicate invoicing

-   Suspicious payment reversals

-   Abnormal credit notes

-   Irregular WHT certificate uploads

-   Manipulated delivery records

### 12.7.2 3PL/Warehouse Fraud

-   Fake POD

-   Repeat "failed delivery" pattern

-   GPS mismatch during delivery

-   Excess damages reports

### 12.7.3 Customer Fraud

-   Multiple unallocated payments

-   Disputes raised frequently

-   Suspicious account balance adjustments

### 12.7.4 Sales & Operations Fraud

-   Manual price overrides

-   Unauthorized credit limit override

-   Fake customer orders

-   Backdated orders

All flagged items show in a Fraud Dashboard and trigger alerts to AR
Manager/CFO.

### 12.8 COMPLIANCE WITH INDUSTRY POLICIES

Tenants must be able to configure:

-   Credit policy

-   Return policy

-   Delivery SLA policy

-   Price override policy

-   Tax applicability policy

-   FOC & rebate policy

-   Year-end balance confirmation policy

AR module must enforce all compliance controls.

### 12.9 EXTERNAL AUDITOR ACCESS

External auditors can have:

-   Read-only portal

-   Restricted date-range access

-   Download rights for:

    -   Invoices

    -   POD

    -   Returns

    -   Payment allocations

    -   WHT certificates

    -   Credit notes

    -   AR ledger movements

Audit logs must be included.

### 12.10 INTERNAL AUDIT FEATURES

Internal Audit can:

-   Raise queries inside the system

-   Attach audit evidence

-   Request customer statements

-   Request transaction-level documents

-   View all audit logs

-   Download bundled audit folders (auto-organized)

-   Validate SoD violations

Every audit request has its own workflow:

-   Initiated by auditor

-   Routed to process owner

-   Response required

-   Auditor closes the query

### 12.11 COMPLIANCE WITH TENANT COUNTRY REGULATIONS

The AR system must support...

-   Local invoice formats (e.g., Nigeria VAT-compliant invoice, GCC VAT
    invoice, EU VAT invoice)

-   Digital tax authorities (where applicable)

    -   Example: E-Invoice integration for Saudi ZATCA, Kenya TIMS, etc.

-   Country-specific delivery documentation formats

-   Country-specific credit note rules

Tenants choose their jurisdiction at onboarding.

### 12.12 CONTROLS OVER MANUAL OVERRIDES

Manual overrides must require:

-   Reason text

-   Approval from superior role

-   Full audit trail

-   Notification to Finance Manager

Overrides include:

-   Price override

-   Credit limit override

-   Exchange rate override

-   Tax rate override

-   Dimension override

-   Return override

-   Credit note amount override

### 12.13 FORENSIC DOCUMENT BUNDLES

For audit periods, system can auto-generate bundled ZIP folders:

For each customer:

-   All invoices

-   All POD

-   All returns

-   All credit notes

-   Payment allocations

-   WHT certificates

-   Statement history

-   AR ledger transactions

-   Approvals audit logs

This drastically shortens audit preparation time.

**SECTION 13 --- CONFIGURABILITY & TENANT SETTINGS**

(Deep, enterprise-level, fully detailed. Paste directly into your AR
PRD.)

## 13.0 CONFIGURATION & CUSTOMIZATION REQUIREMENTS

The AR Module must support extensive configurability, allowing each
tenant (company) to tailor:

-   Their processes

-   Their approval flows

-   Their pricing logic

-   Their tax rules

-   Their credit rules

-   Their invoice formats

-   Their statement formats

-   Their workflows

-   Their portals

-   Their integrations

WITHOUT ANY CODE CHANGES.

Tenant configurability is a core design pillar of ZivaBI, enabling:

-   Global adaptability

-   Industry-agnostic flexibility

-   Scalability across thousands of organizations

-   Minimal onboarding cost

-   Rapid customization

-   Seamless updates

This section outlines all AR settings configurable by each tenant.

### 13.1 GENERAL TENANT SETTINGS (AR MODULE)

Tenants can configure:

### 13.1.1 Currency Settings

-   Base currency

-   Reporting currency

-   Customer currency rules

-   FX rate selection rule

-   FX rounding rules

-   Daily FX rate provider (CBN, ECB, etc.)

-   Auto FX revaluation toggle

### 13.1.2 Date Settings

-   Financial year start

-   Posting date vs transaction date rule

-   Cut-off rules for:

    -   Posting

    -   Returns

    -   Credit notes

    -   FOC claims

-   Month-end closure settings

### 13.1.3 Document Numbering

Tenant can configure numbering format for:

-   Sales orders

-   Delivery instructions

-   Invoices

-   Credit notes

-   Returns

-   Payments

-   WHT certificates

-   Statements

Format can include:

-   Prefix

-   Suffix

-   Year

-   Month

-   Auto-increment

-   Department code

### 13.2 CREDIT POLICY CONFIGURATION

### 13.2.1 Credit Limit Settings

-   Allowed or disabled

-   Per-customer limit

-   Credit utilization threshold (%)

-   Soft block vs hard block

-   Automated email alerts

### 13.2.2 Overdue Rule Settings

-   Number of overdue days before block

-   Auto-block toggle

-   Escalation rules (Finance → Sales → CFO)

### 13.2.3 Credit Approval Workflow

Tenant defines approval flow based on:

-   Customer type

-   Value

-   Region

-   Payment history

-   Risk scoring

### 13.3 PRICING CONFIGURATION

### 13.3.1 Price Source Settings

Tenant can choose:

-   ZivaBI Pricing Engine

-   ERP Pricing Engine

-   Customer-specific pricing

-   Service pricing model (Hourly, Milestone, Project)

### 13.3.2 Discount Settings

-   Allowed discounts

-   Approval thresholds

-   Max discount by role

-   Promotional discount definitions

-   Tiered discount rules

### 13.3.3 Price Change Settings

-   Effective date rules

-   Auto-notify DPS/DPM

-   Price freeze window before promotions

### 13.4 TAX CONFIGURATION

### 13.4.1 VAT Configuration

Tenant can configure:

-   VAT rate

-   VAT rate per product/service category

-   Zero-rated categories

-   VAT-exempt categories

-   Reverse VAT applicability

-   Tax point date:

    -   Invoice date

    -   Delivery date

    -   Posting date

### 13.4.2 WHT Configuration

-   WHT categories

-   WHT rate per category

-   Applicability rules

-   Customer-specific WHT preferences

-   Required WHT certificate upload

### 13.4.3 Multi-Jurisdiction Compliance

-   Activate multiple tax jurisdictions

-   Define rules per location

-   Set filing frequency

### 13.5 DIMENSION CONFIGURATION

Dimensions must be fully configurable:

### 13.5.1 Activate/Deactivate Dimensions

Tenant can toggle:

-   Real IO

-   Material IO

-   Cost Center IO

-   Statistical IO

-   Location Dimension

-   Territory Dimension

-   Project Dimension (optional)

### 13.5.2 Dimension Label Customization

Tenant can rename:

-   Real IO → Customer Category

-   Material IO → Product Group

-   Cost Center IO → Department Code

...and more.

### 13.5.3 Mapping Rules

Tenant can define:

-   SKU → Material IO

-   Customer → Real IO

-   Service → Cost Center IO

-   Region → Location

#### 13.5.4 Dimension Enforcement Rules

Tenant chooses:

-   Mandatory line-level dimensions

-   Mandatory header-level dimensions

-   Allow Finance override (yes/no)

-   Allow auto-suggestion from AI

### 13.6 WORKFLOW CONFIGURATION

Each tenant may build custom workflows for:

-   Sales orders

-   Returns

-   Credit notes

-   Invoice approvals

-   Price overrides

-   Credit limit overrides

-   Delivery approval

-   Dispute resolution

Workflow builder must support:

-   Drag-and-drop design

-   Conditional routing

-   Parallel approvals

-   Escalation rules

-   SLA timers

-   Notification configuration

### 13.7 RETURN POLICY CONFIGURATION

### Tenant-configurable rules:

1.  Who can initiate returns (Customer, DPS, DPM, Warehouse, 3PL,
    Finance).

2.  Types of returns allowed:

    -   Goods

    -   Services

    -   Pricing disputes

    -   Promotional goods

    -   Damaged goods

3.  Valid return window (e.g., within 7 days of delivery).

4.  Return approval workflow.

5.  Whether POD is required.

6.  Whether warehouse inspection is required.

7.  Whether credit note auto-generates after approval or needs Finance
    approval.

### 13.8 INVOICE CONFIGURATION

### 13.8.1 Invoice Type Settings

Tenant selects:

-   Goods-only

-   Service-only

-   Mixed

-   Force split invoices for goods vs services

### 13.8.2 Invoice Template Customization

Tenant can configure:

-   Logo

-   Colors

-   Header/footer

-   VAT declaration text

-   TIN/VAT number fields

-   Signature blocks

-   Digital QR code

### 13.8.3 Invoice Posting Rules

Tenant defines:

-   Posting date rules

-   Tax point rules

-   Revenue recognition rule

-   FX rule

-   COGS method (if OP module enabled)

### 13.9 DELIVERY & 3PL CONFIGURATION

### 13.9.1 Delivery Instruction Rules

-   Warehouse vs 3PL routing logic

-   Multi-warehouse priority

-   Route optimization settings

-   POD type required

### 13.9.2 3PL Billing Rules

Tenant configures:

-   Rate per km

-   Rate per carton / pallet

-   Rate per weight

-   Rate per delivery

-   Minimum billing thresholds

-   Accrual vs direct billing method

### 13.9.3 POD Validation Rules

-   Mandatory or optional

-   Must match quantity delivered

-   Must match customer signature

### 13.10 RETURN & CREDIT NOTE CONFIGURATION

### Tenant configures:

-   Return reason codes

-   Return categories

-   Approval flow

-   Whether credit note auto-issues or must be reviewed

-   Value-based approval tiers

-   Tax reversal rules

-   Dimension retention rules

### 13.11 STATEMENT & CUSTOMER PORTAL CONFIGURATION

### 13.11.1 Statement Frequency

Tenant chooses:

-   Monthly

-   Quarterly

-   Yearly

-   On-demand

### 13.11.2 Customer Portal Settings

Tenant configures:

-   Which customers can log in

-   Which documents are visible

-   Whether customer can:

    -   Raise disputes

    -   Raise returns

    -   Upload WHT certs

    -   View POD

    -   View FOC/claim status

### 13.11.3 Automated Email Templates

Tenant can edit templates for:

-   Statements

-   Invoices

-   Delivery confirmation

-   Payment receipt

-   Return approval

-   Credit note issuance

### 13.12 PAYMENT CONFIGURATION

### Tenant can set:

-   Allowed payment methods

-   Mandatory payment proof rules

-   Auto-allocation vs manual

-   Priority rules for allocations

-   FX settlement rules

### 13.13 ERP & EXTERNAL SYSTEM CONFIGURATION

### Tenant selects integration mode:

-   Real-time

-   Near-real-time

-   Batch sync

-   Manual export/import

Tenant maps:

-   GL accounts

-   Tax codes

-   Customer codes

-   Dimension mappings

-   FX sources

-   Product IDs

### 13.14 SECURITY & ROLE CONFIGURATION

Tenant configures:

-   Roles

-   Permissions

-   Access scopes

-   Menu visibility

-   API access keys

Role examples:

-   DPS

-   DPM

-   Sales Specialist

-   Warehouse

-   3PL

-   AR Officer

-   AR Manager

-   CFO

-   Customer

-   External Auditor

### 13.15 NOTIFICATION & ALERT SETTINGS

Tenant defines:

-   Which events trigger alerts

-   Alert recipients

-   Notification channels

-   SLA thresholds

-   Escalation paths

Examples:

-   Delivery delays

-   Price override requests

-   Credit block triggers

-   Missing POD

-   Payment received

-   Unallocated payments

-   FOC request approvals

-   High-value customer returns

### 13.16 AI/ML CONFIGURATION

Tenant may enable:

-   AI pricing suggestions

-   AI payment matching

-   AI fraud detection

-   AI risk scoring

-   AI dimension predictions

-   AI delivery failure predictions

Tenant can also disable AI fully.

### 13.17 TENANT-LEVEL ONBOARDING WIZARD

Onboarding wizard guides tenant through:

-   Customer setup

-   Price list setup

-   Tax setup

-   Workflow setup

-   Dimension setup

-   Invoice template setup

-   Credit policy setup

-   3PL and warehouse onboarding

-   Default FX rules

-   Branding & theme setup

This is a step-by-step questionnaire with clear explanations and
tooltips.

**SECTION 14 --- FUTURE ENHANCEMENTS & ROADMAP**

(Full, enterprise-grade, detailed. Paste directly into your AR PRD.)

## 14.0 FUTURE ENHANCEMENTS & ROADMAP

This section outlines future enhancements planned for the AR module of
ZivaBI.

These are functionalities not included in the initial release, but
intentionally designed into the architecture so they can be added
without structural changes.

The roadmap is divided into:

-   Short-term enhancements (Phase 2, 3--6 months)

-   Medium-term enhancements (Phase 3, 6--12 months)

-   Long-term enhancements (Phase 4+, 12--24 months)

These enhancements are driven by:

-   Industry best practices

-   CFO and Finance team needs

-   User feedback

-   Scalability requirements

-   Regulatory changes

-   AI & automation capabilities

### 14.1 SHORT-TERM ENHANCEMENTS (PHASE 2 --- 3 to 6 MONTHS)

These enhancements provide high business value with low-to-medium
complexity.

#### 14.1.1 AI-Enhanced Payment Matching (Advanced Version)

Current AR includes basic AI suggestions.

Future enhancement will add:

-   Natural Language Processing (NLP) to read bank narration

-   Intelligence to detect abbreviations, wrong spellings, references

-   Matching multiple invoices to one payment

-   Matching one payment to multiple customers (rare, but possible)

-   Predictive matching based on customer behavior patterns

Expected Benefits:

-   95% auto-match rate

-   Faster reconciliation

-   Reduced finance workload

#### 14.1.2 Customer Risk Scoring Engine (Enhanced Model)

Initial version supports basic scoring.

Future version will integrate:

-   Behavioral analytics

-   Industry benchmarks

-   Predictive ML models

-   Payment probability forecasting

-   Real-time risk score recalculation

Use cases:

-   Preemptive credit blocking

-   Sales territory risk planning

-   CFO dashboard insights

#### 14.1.3 Automated Dunning (Reminder) Campaigns

Future module will support:

-   Multi-level dunning letters

-   Automated email/SMS/WhatsApp reminders

-   Configurable templates

-   Severe delinquency escalation

-   Sales involvement workflows

#### 14.1.4 E-Invoicing Compliance Engine

For countries requiring government e-invoice submission (e.g., ZATCA,
Kenya TIMS):

-   Auto-generation of clearance codes

-   QR code embedding

-   Real-time API submission

-   Validation by tax authorities

-   Automated error handling

#### 14.1.5 Dynamic Pricing Alerts for DPS/DPM

System analyses:

-   Price fluctuations

-   Customer buying patterns

-   Promotion effectiveness

Then alerts DPS/DPM on:

-   Upselling opportunities

-   Contract renewal triggers

-   Price changes affecting margin

#### 14.1.6 Automated Credit Limit Adjustment Proposal

AI recommends:

-   Increase/decrease of limits

-   Flagging risky customers

-   Suggesting temporary credit extensions

### 14.2 MEDIUM-TERM ENHANCEMENTS (PHASE 3 --- 6 to 12 MONTHS)

#### 14.2.1 Real-Time GPS Delivery Tracking (3PL Enhancement)

Integrate:

-   GPS-enabled deliveries

-   Route optimization

-   Live map tracking

-   Predictive ETAs

-   AI-based delivery delay prediction

#### 14.2.2 Integrated Collections CRM

Turn the AR module into a mini-CRM for collections:

-   Customer contact logs

-   Automated follow-up tasks

-   Escalation rules

-   Customer dispute management

-   Promise-to-pay tracking w/ AI reminders

-   Customizable communication templates

#### 14.2.3 Payment Gateway Integration for Customers

Customers can pay invoices directly in the portal via:

-   Cards

-   Bank transfers

-   Mobile money

-   Wallets

-   USSD

Automated allocation included.

#### 14.2.4 Customer Self-Service Credit Notes

Allow customers to:

-   Submit price disputes

-   Validate reruns

-   Upload evidence

-   Track CN approval status

-   Receive instant notifications

#### 14.2.5 AR Aging Visualization Engine

Advanced dashboards:

-   Multi-dimensional aging (by DPS, DPM, SKU group, region)

-   Heatmaps

-   Trend lines

-   AI anomaly detection

#### 14.2.6 Multi-Entity AR Consolidation

For tenants owning multiple subsidiaries:

-   Consolidated AR view

-   Inter-company eliminations

-   Group aging

-   Multi-currency consolidation

### 14.3 LONG-TERM ENHANCEMENTS (PHASE 4 --- 12 to 24 MONTHS)

These are strategic future expansions, adding high sophistication.

#### 14.3.1 Autonomous AR (Self-Driving Finance)

AI monitors:

-   Customer behavior

-   Payment history

-   Inventory availability

-   Sales patterns

-   Delivery patterns

System autonomously:

-   Suggests credit limit changes

-   Adjusts risk scores

-   Flags high-risk orders

-   Advises on cashflow predictions

-   Adjusts pricing (if authorized)

-   Recommends optimized delivery routes

#### 14.3.2 Smart Customer Behaviour Prediction

Predict:

-   Which customers are likely to default

-   Which customers will place large orders

-   Seasonal buying patterns

-   Effect of pricing changes on customer retention

#### 14.3.3 Blockchain-Based Proof of Delivery (Optional)

For global FMCGs:

-   Immutable POD records

-   Smart contract confirmation

-   Decentralized delivery ledger

-   Fraud-proof delivery chain

#### 14.3.4 Automated Customer Reconciliation Engine

Reads:

-   Customer statements

-   Customer remittance advice

-   Customer disputes

Automatically resolves:

-   Underpayments

-   Overpayments

-   Duplicate payments

-   WHT discrepancies

-   FX adjustments

#### 14.3.5 Behavioral Collections Engine

AI predicts:

-   When customers will pay

-   Which communication method works best

-   Expected payment delay

-   Recommended collection action

### 14.4 ARCHITECTURE ENHANCEMENTS

### Future optimizations include:

-   Event-driven microservices for ultra-scale

-   Dedicated analytics microservice

-   In-memory caching for high-speed AR aging

-   Distributed ledger for delivery chain

-   AI agent for real-time AR supervision

-   Data lake integration for BI dashboards

### 14.5 TENANT REQUEST PORTAL FOR NEW FEATURES

A new "Feature Request Portal" will allow:

-   Tenants to request enhancements

-   Voting on features

-   Prioritized roadmap updates

-   Transparent release cycles

-   Beta-testing groups per tenant

### 14.6 REGULATORY FUTURE READINESS

ZivaBI will track regulatory shifts:

-   Global e-invoicing mandates

-   VAT law changes

-   WHT categories

-   FX control policies

-   Digital reporting obligations

Automatic configuration updates will be applied per tenant region.

### 14.7 RELEASE STRATEGY

### Every 3 months:

-   Minor features

-   Performance improvements

-   UI enhancements

### Every 6 months:

-   New AR capabilities

-   New integrations

-   New dashboard widgets

### Every 12 months:

-   Major features

-   AI enhancements

-   New modules

### 14.8 SUMMARY OF FUTURE ENHANCEMENTS

| Category | Feature |
| --- | --- |
| AI/ML | Risk scoring, payment matching, fraud detection |
| Mobility | Real-time GPS, offline warehouse support |
| ERP | Deeper Sage X3, SAP, Oracle integrations |
| Tax | E-invoicing engines |
| Portal | Enhanced customer self-service |
| Finance | Autonomous AR engine |
| Logistics | Dynamic route optimization |
| Compliance | Automated audit bundling |

