# Vendor Master Data Change Request Module — Product Requirements Document (PRD)

**Product:** Ziva BI — Accounting Automation Platform
**Module:** Vendor Master Data Change Request (critical & complementary to Vendor Onboarding)
**Version:** 1.0
**Document status:** Merged and converted from three source Word documents to Markdown
**Converted on:** July 25, 2026

> This document merges three source parts into one PRD: Part 1 (Business, UX & Workflow Specification), Part 2 (Technical Architecture & Data Models), and Part 3 (APIs, Validation, Error Handling & Security). Section numbers have been renumbered to run continuously across all three parts.

---

## Table of Contents

1. Executive Summary
2. Business Objectives
3. Roles & Permissions
4. End-to-End Workflow Overview
5. Supported Change Types
6. Vendor UX (Modern Design)
7. Finance Validation Process
8. Technical Architecture Overview
9. Data Model Specification
10. Change Types Architecture
11. Integration Architecture
12. API Endpoints
13. Validation Rules
14. Error Handling
15. Security Requirements

---

## 1. Executive Summary

This document represents Part 1 of the Vendor Master Data Change Request
Module. This module manages secure, finance-controlled workflows for
updating vendor master data (bank account, address, tax ID, contact
details, compliance documents). It prevents fraud, supports strong
internal controls, and provides a modern UX aligned with enterprise
standards.

## 2. Business Objectives

- Prevent fraudulent vendor master data changes.

- Ensure all changes are initiated internally by authorized personnel.

- Ensure Finance is the final approver for all vendor master data
updates.

- Provide secure vendor-facing change forms via 30-day expiring links.

- Maintain full audit trail and historical record of all changes.

- Allow requestor or LM to track updates with view-only access.

- Integrate cleanly with Vendor Portal, AP, and payment processing
modules.

## 3. Roles & Permissions

- Internal Initiators: Requestor, Requestor LM, Assigned Vendor Owner,
Finance.

- Vendor: Can only update fields when invited via secure link.

- Finance: Final approver, performs validations and background checks.

- Audit Role: Read-only access to full change history.

## 4. End-to-End Workflow Overview

1. Internal staff initiates vendor data change request.

2. Finance reviews request and triggers secure vendor update link.

3. Vendor authenticates (OTP) and completes update form.

4. Vendor uploads supporting documents.

5. Finance performs validations and background checks.

6. Finance approves, updates master data, and closes request.

7. Requestor receives view-only update notification.

## 5. Supported Change Types

- Bank account updates (high risk).

- Registered address change.

- Operational address change.

- Change of tax identification details (TIN/EIN/VAT).

- Contact person updates.

- Email domain changes.

- Director changes.

- Compliance document refresh.

- Insurance policy update.

## 6. Vendor UX (Modern Design)

- Clean and guided forms with tooltips.

- Banner displaying type of change requested.

- Document upload area with drag-and-drop UX.

- Progress indicator (Step 1: Authenticate → Step 2: Update → Step 3:
Review → Step 4: Submit).

- Real-time validations and warnings.

- Confirmation page summarizing changes.

## 7. Finance Validation Process

- Identity validation (vendor OTP).

- Bank verification (API or manual).

- Duplicate account detection.

- Cross-check against historical bank accounts.

- Sanction list screening (optional).

- Internal fraud-controls checklist.

- Conditional escalation for high-value vendors.


---

## 8. Technical Architecture Overview

- Implemented as independent microservice interacting with Vendor Master
and Finance modules.

- Uses workflow engine for multi-stage approvals.

- Vendor access controlled via secure 30‑day expiring tokens.

- Fully multi-tenant with vendor-level isolation.

- All changes archived in immutable historical tables.

## 9. Data Model Specification

vendor_change_request(request_id, vendor_id, initiator_id,
change_type, status, created_at, ...)

vendor_change_item(item_id, request_id, field, old_value,
new_value, ...)

vendor_change_document(doc_id, request_id, vendor_id, type,
file_path, hash, ...)

vendor_change_approval(approval_id, request_id, approver_id, role,
status, timestamp, ...)

vendor_old_values_archive(archive_id, vendor_id, field_name,
old_value, changed_on, changed_by, ...)

vendor_update_token(token_id, request_id, vendor_id, token_hash,
expiry_date)

audit_log(log_id, entity_type, entity_id, action, metadata,
timestamp)

## 10. Change Types Architecture

- Each change type triggers its own validation rules.

- High‑risk changes (bank account, tax ID) trigger extended validation.

- External checks (bank API, sanctions check) configurable per tenant.

- All field changes must be individually logged.

## 11. Integration Architecture

- Integrates with Vendor Master Service for write-back.

- Integrates with Bank Reconciliation for bank validation.

- Integrates with Notification Engine for email alerts.

- Integrates with Audit Trail module for event logging.

- Integrates with AP & Vendor Portal modules for cross-linking.


---

## 12. API Endpoints

POST /vendor-change/initiate -- Internal user initiates change.

GET /vendor-change/{id} -- View status.

POST /vendor-change/{id}/send-to-vendor -- Finance triggers vendor link.

POST /vendor-change/vendor-submit -- Vendor submits update.

POST /vendor-change/{id}/finance-approve -- Finance final approval.

POST /vendor-change/{id}/reject -- Reject update request.

GET /vendor-change/vendor-token/{token} -- Validate vendor link.

## 13. Validation Rules

- Bank account updates require: bank letter, ID of signatory,
verification call.

- Address changes require utility bill or business license.

- Tax ID changes must match country format rules.

- Email domain changes require corporate evidence.

- All vendor submissions must pass OTP validation.

- Mandatory fields enforced per change type.

## 14. Error Handling

- Expired link → 410 Link Expired.

- Incorrect token → 401 Unauthorized.

- Missing documents → 422 Unprocessable Entity.

- Fraud suspicion → escalation to Finance.

- Duplicate bank account detected → flagged for manual review.

## 15. Security Requirements

- AES‑256 encryption of bank and tax identifiers.

- Token hashing for vendor update links.

- MFA optional for large vendors.

- Full audit trail of every value change.

- Segregation-of-duties enforced for internal approvers.

- Tenant‑level row isolation for multi-tenant safety.
