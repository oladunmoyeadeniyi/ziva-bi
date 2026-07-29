# Ziva BI — AI Engine Module PRD (Version 1.0)

**Product:** Ziva BI — Accounting Automation Platform
**Module:** AI Engine (Cross-Platform Infrastructure)
**Document status:** Converted from source Word document to Markdown
**Converted on:** July 25, 2026

---

## Table of Contents

1. Executive Summary
2. Problem Statement
3. Scope
4. Actors & Roles
5. High-Level AI Workflow
6. Detailed Features
7. User Stories
8. UI Requirements
9. API Architecture
10. Data Model (Summary)
11. Non-Functional Requirements
12. Audit Requirements
13. Future Features
14. Conclusion

---

**Prepared for:** Ziva BI Core Platform
**Module Type:** Cross-Platform Infrastructure Module
**Audience:** PM, Tech Leads, Backend, AI/ML Engineers, UI/UX, QA, Compliance

## 1. EXECUTIVE SUMMARY

The AI Engine Module is a core Ziva BI infrastructure component designed
to intelligently automate manually intensive accounting and operational
workflows.

The module provides:

1.  OCR → Structured Data Extraction

2.  Auto-classification and prediction of accounting fields

3.  Learning Finance behaviour

4.  Fraud & anomaly detection

5.  Duplicate invoice detection & similarity scoring

6.  Intelligent bank statement matching

7.  Vendor category prediction & tax rule suggestion

8.  Budget utilization forecasting

9.  Outbound logistics cost prediction (3PL)

The AI Engine operates as a central shared service, accessible by:

-   Expense Retirement Module

-   Expense Advance Module

-   Vendor Payment Request Module

-   Vendor Onboarding Module

-   Accounts Receivable Module

-   Bank Reconciliation Module

-   3PL / Warehouse / Inventory Module

-   Budgeting Module

-   Tax Engine

It is tenant-configurable, super-admin controlled, role-based, and
auditable.

## 2. PROBLEM STATEMENT

Organizations perform repetitive manual tasks such as:

-   Extracting data from invoices, receipts, bank statements

-   Choosing GL accounts and dimensions

-   Determining VAT/WHT applicability

-   Checking for duplicate documents

-   Reconciling bank statement lines

-   Verifying vendor identity

-   Predicting project/event cost overruns

-   Detecting fraud or misclassification

These tasks consume 50--70% of Finance department time.

AI can reduce these manual touches to near zero, while improving:

-   Accuracy

-   Speed

-   Consistency

-   Tax compliance

-   Fraud detection ability

-   Internal control compliance

## 3. SCOPE

### IN SCOPE

-   OCR extraction for all document types

-   ML-based classification for GL, IO, CC, Material IO

-   VAT/WHT prediction logic & rule-learning

-   Duplicate invoice detection

-   Fraud anomaly detection

-   Bank statement intelligent matching

-   Vendor category prediction

-   Budget variance intelligence

-   Accrual suggestion

-   Event/project cost overrun prediction

-   Predictive analytics dashboards

### OUT OF SCOPE (for now but expandable later)

-   Voice-based expense submission

-   Full tax computation automation

-   Predictive cashflow forecasting (future)

## 4. ACTORS & ROLES

| Actor | Role of AI |
| --- | --- |
| Employee | Document → OCR → auto-filled expense lines |
| Requestor | Vendor invoice → AI classifies GL + IO |
| Line Manager | Sees AI confidence score during approval |
| Finance Reviewer | Accept/override AI suggestions |
| Auditor | Views AI audit trail |
| Tenant Admin | Configure AI activation level |
| Super Admin | Approve global AI model updates |

## 5. HIGH-LEVEL AI WORKFLOW

1.  Document Upload

2.  OCR Processing

3.  Field Normalization

4.  AI Prediction

-   GL

-   PL Line

-   Real IO

-   Stat IO

-   Cost Center

-   Material IO

-   Vendor Category

-   Tax applicability

-   Duplicate detection

-   Fraud/anomaly scoring

5.  Confidence Score Calculation

6.  User UI → Accept/Override

7.  Learning Loop

-   Overrides are fed back into the model

## 6. DETAILED FEATURES

### 6.1. OCR ENGINE

### Document Types Supported:

-   Vendor invoices

-   Employee receipts

-   Bank statements (PDF & image)

-   Delivery notes / PODs

-   Contracts

-   POSM documents

-   Project budgets

-   3PL invoices

### Extraction:

-   Invoice number

-   Invoice date

-   Vendor name

-   Line descriptions

-   Tax values

-   Amounts (multi-currency)

-   Payment references

-   IBAN / account numbers

### Special Logic:

-   Multi-line invoice OCR

-   Handling multi-page PDFs

-   Extraction of totals, VAT summary blocks

-   Footnote/ watermark extraction

### 6.2. AI CLASSIFICATION ENGINE

### Predicts:

| Field | Example output |
| --- | --- |
| GL Account | "765100 -- Event Sponsoring 3rd Party Events" |
| PL Line | "Marketing -- Sponsorship" |
| Real IO | "R245 -- 3rd Party Partnership Activation" |
| Stat IO | "S031 -- Cost Center: Finance" |
| Material IO | "SKU-45338" |
| Location | "Lagos" |

### Models Used:

-   Multi-class classification

-   Hierarchical classification

-   Embedding similarity

-   Past behaviour pattern matching

### Confidence thresholds configurable per tenant:

-   Level 1 → Recommend

-   Level 2 → Auto-fill

-   Level 3 → Auto-post (Finance-approved tenants only)

### 6.3. DUPLICATE DOCUMENT DETECTION

Uses:

-   OCR text matching

-   Vendor + invoice + amount comparison

-   Fuzzy similarity scoring

-   Hashing of extracted content

Flags:

-   Exact duplicate

-   Possible duplicate

-   Invoice reused in another retirement

### 6.4. FRAUD & ANOMALY DETECTION

Detects:

-   Unusual spend patterns

-   Expense claimed above budget cap

-   Wrong vendor category usage

-   Vendor invoice mismatch with historical patterns

-   Suspicious employee behavior

-   Non-compliant GL usage

-   High deviation from budget

AI provides:

-   Risk Score (0--100)

-   Recommendation: approve / escalate / block

### 6.5. VAT / WHT PREDICTION ENGINE

AI evaluates:

-   Vendor category

-   Jurisdiction

-   Line item description

-   Contract terms

-   Prior transactions

-   Tax authority rules

Predicts:

-   Whether VAT is applicable

-   Whether WHT applies

-   The correct base for WHT

-   Recommended WHT rate

Overrides allow Finance to teach the model.

### 6.6. BANK RECONCILIATION INTELLIGENCE

AI performs:

### Matching:

-   Statement line ↔ ERP journal

-   Statement line ↔ AR collection

-   Statement line ↔ AP payment

### Soft matching features:

-   Amount tolerance

-   Date deviation tolerance

-   Narration similarity

-   Pattern recognition

AI suggests:

-   Matches

-   Partial matches

-   Unidentified lines

-   Fraud alerts

### 6.7. VENDOR CATEGORY PREDICTION

Predicts vendor category:

-   Professional Service

-   Event Agency

-   Import Clearing Agent

-   3PL / Logistics

-   Insurance

-   Rent & Lease

-   One-Off Vendors

Uses:

-   Invoice structure

-   Keywords

-   Historical behavior

-   Tax rules

### 6.8. EVENT / PROJECT COST INTELLIGENCE

Predicts:

-   Cost overrun risk

-   Unrealistic budget lines

-   Missing documents

-   Spend anomalies

Auto-suggests:

-   Required accruals

-   Where budget is nearly exhausted

-   Total expected cost

### 6.9. AI FOR INVENTORY & WAREHOUSE

Predicts:

-   Inbound quantity discrepancies

-   Damage probability

-   Expiry risk

-   Abnormal shrinkage

-   3PL billing irregularities

Handles:

-   Allocation of customs duty

-   Cost absorption logic

-   Weighted average cost alerts

### 6.10. AI LEARNING ENGINE

### Learning Inputs:

-   Finance overrides

-   Historical GL postings

-   Budget usage

-   Vendor category corrections

-   Tax override decisions

-   Reconciliation edits

-   Approvals vs rejections

### Learning Cycle:

1.  Batch nightly training

2.  Tenant-specific models updated

3.  Global model improved occasionally

4.  Super Admin validates global updates

## 7. USER STORIES

### Employee

-   Upload receipt → AI fills GL + IO → employee confirms → submit

### Finance Reviewer

-   Sees AI predicted GL (92% confidence) → accepts 2 lines, overrides 1

-   Duplicate detected → automatically flagged

-   VAT prediction → correct base picked

### Auditor

-   "Show me all AI decisions for this expense"

-   "Show all overrides by Finance in October"

### Tenant Admin

-   Enable AI Mode: Standard or Aggressive

-   Set auto-post rules

-   Set confidence thresholds

## 8. UI REQUIREMENTS

### AI Assist Panel (for every module)

Shows:

-   Extracted fields

-   Predicted fields

-   Confidence scores

-   Reasoning snippet (explainability)

-   Duplicate alerts

-   Fraud score

#### Buttons:

-   Accept All

-   Reject All

-   Review Individually

-   Send back to employee

## 9. API ARCHITECTURE

### Endpoints (examples)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/ai/ocr | submit document for OCR |
| POST | /api/ai/classify | classify GL/IO/CC fields |
| POST | /api/ai/detect-duplicate | check invoice duplication |
| POST | /api/ai/reconcile | AI bank match suggestions |
| POST | /api/ai/vendor-category | classify vendor type |
| POST | /api/ai/tax-predict | VAT/WHT prediction |
| POST | /api/ai/event-cost | project/event prediction |
| POST | /api/ai/override | finance override → learning |

## 10. DATA MODEL (SUMMARY)

Tables:

-   ai_predictions

-   ai_duplicate_checks

-   ai_learning_overrides

-   ai_bank_matching

-   ai_vendor_classifications

-   ai_tax_predictions

-   ai_fraud_scores

## 11. NON-FUNCTIONAL REQUIREMENTS

-   \<1000ms prediction latency

-   Multi-tenant isolation

-   Explainable AI mandatory

-   GDPR & Local Data Protection compliance

-   Versioned models per tenant

-   Zero-trust access rules

-   Offline fallback: system must work without AI

## 12. AUDIT REQUIREMENTS

Every AI action must store:

-   Document ID

-   Prediction

-   Confidence

-   Fields extracted

-   Who accepted/overrode

-   Timestamp

-   Model version used

Auditors must be able to regenerate:

-   Before/after values

-   Reasoning snapshot

-   Confidence history

## 13. FUTURE FEATURES

-   Generative AI summarizing full expense requests

-   Voice-to-expense submission

-   Predictive cashflow / working capital

-   AI-driven internal audit sample selection

-   3PL billing fraud scoring

## 14. CONCLUSION

The AI Engine is a critical accelerator for Ziva BI's mission:

### "Zero Manual Work. Maximum Intelligence."

When implemented, it will:

-   Reduce processing time by 70--90%

-   Improve posting accuracy to >98%

-   Significantly improve audit readiness

-   Automatically detect fraud & duplicates

-   Reduce tax misclassification errors

-   Provide predictive insights across operations
