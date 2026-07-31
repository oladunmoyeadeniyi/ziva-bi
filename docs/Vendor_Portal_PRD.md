# Vendor Portal (Supplier Self-Service) — Product Requirements Document (PRD)

**Product:** PRAD — Accounting Automation Platform
**Module:** Vendor Portal (Supplier Self-Service)
**Version:** 1.0
**Document status:** Merged and converted from three source Word documents to Markdown
**Converted on:** July 25, 2026

> This document merges three source parts into one PRD: Part 1 (Business, UX & Workflow Specification — Modern UX), Part 2 (Technical Architecture & Data Models), and Part 3 (APIs, Validation, Error Handling & Security). Section numbers have been renumbered to run continuously across all three parts.

---

## Table of Contents

1. Executive Summary
2. Business Objectives
3. Modern UX Principles (Option A)
4. Vendor Portal Dashboard
5. Portal Features Overview
6. End-to-End Workflow — Vendor Invoice Submission
7. Vendor-Internal Communication (Dispute Center)
8. Vendor Compliance Documentation Management
9. Technical Architecture Overview
10. Authentication Architecture
11. Vendor Portal Service Components
12. Data Model Specification
13. Integration Architecture
14. API Specification
15. Validation Rules
16. Error Handling
17. Security Requirements

---

## 1. Executive Summary

This document provides Part 1 of the full engineering-ready
specification for the Vendor Portal (Supplier Self-Service Portal).
Designed using a modern enterprise-grade UX (inspired by Stripe,
Salesforce, and Azure), this portal delivers an intuitive, secure, and
high-performing experience for vendors while maintaining strict
financial controls and compliance.

## 2. Business Objectives

- Deliver a best-in-class vendor experience with modern UX.

- Provide transparency into invoice, payment, and PO status.

- Allow vendors to upload invoices digitally for AP automation.

- Give vendors visibility into compliance document status.

- Reduce AP processing time by eliminating email invoice chaos.

- Improve communication channels between vendors and AP/Procurement.

- Support global operations with multi-currency and multi-entity
structures.

- Enhance fraud prevention controls through secure workflows.

## 3. Modern UX Principles (Option A)

- Minimalist, clean, white-space-friendly design.

- Card-based dashboards summarizing key metrics.

- Visual status indicators (green = paid, yellow = pending, red =
rejected).

- Smooth animations, responsive layout, mobile-friendly.

- Search bars and intelligent filters for navigating invoices, payments,
and POs.

- Vendor-first language and guidance (tooltips, hints, warnings).

- Iconography to simplify navigation.

## 4. Vendor Portal Dashboard

The dashboard uses a series of KPI tiles:

- Total invoices submitted

- Pending invoices

- Approved but unpaid invoices

- Paid invoices

- Compliance documents expiring soon

- Outstanding disputes

Below KPIs is a table layout with infinite scroll for invoice history.

## 5. Portal Features Overview

- Invoice submission via guided flow.

- Payment status tracking.

- PO visibility (if enabled).

- Dispute & Query center.

- Compliance documentation management.

- Notifications center.

- Profile review & controlled update workflow.

- Audit trail view for vendor activities.

## 6. End-to-End Workflow -- Vendor Invoice Submission

1. Vendor logs in via email/password or magic link.

2. Vendor clicks \'Submit Invoice\'.

3. Portal guides vendor to upload invoice PDF.

4. OCR processes invoice and extracts key info.

5. Vendor selects internal company requester.

6. Vendor reviews extracted data and confirms.

7. Invoice moves into AP workflow.

8. Vendor tracks status in real time.

## 7. Vendor-Internal Communication (Dispute Center)

- Vendors can send messages on specific invoices.

- AP/Procurement can request corrections or documents.

- All communication is timestamped and auditable.

- Vendors receive notifications via email and portal.

## 8. Vendor Compliance Documentation Management

- Vendors upload compliance documents (CAC, TIN, insurance).

- System detects expiring documents and sends reminders.

- Vendors can upload replacements from the portal.

- Compliance status is displayed using colored badges.


---

## 9. Technical Architecture Overview

- Vendor Portal is built as a standalone micro-frontend application.

- Backend uses microservices architecture with REST APIs.

- Dedicated service for vendor authentication & permissions.

- Fully multi-tenant with vendor-level isolation.

- Integrates with AP module, PO engine, payment engine, and compliance
module.

## 10. Authentication Architecture

- Supports email/password login.

- Supports magic-link login (email one-time token).

- Support for OAuth (Google/Microsoft).

- Vendor roles mapped at vendor_id level.

- Tokens expire every 12 hours.

## 11. Vendor Portal Service Components

- Vendor Auth Service

- Invoice Submission Service

- Vendor Messaging Service

- PO Visibility Service

- Payment Tracking Service

- Compliance Document Service

- Notification Engine

- Vendor Activity Log Service

## 12. Data Model Specification

vendor_portal_user(user_id, vendor_id, email, password_hash,
mfa_enabled, ...)

vendor_invoice_submission(invoice_id, vendor_id, status, amount,
currency, ...)

vendor_message(message_id, invoice_id, sender_type, message_text,
timestamp, ...)

vendor_compliance(doc_id, vendor_id, doc_type, file_path,
expiry_date, ...)

vendor_payment(payment_id, vendor_id, amount, currency, paid_date,
...)

vendor_po(po_id, vendor_id, description, amount, balance_remaining,
...)

vendor_audit(event_id, vendor_id, action, metadata, ...)

## 13. Integration Architecture

- AP Integration: invoice ingestion APIs.

- PO Integration: PO lookup and balances.

- Payment Integration: payment confirmations.

- Compliance Integration: document expiry monitoring.

- Notification Integration: email/SMS for alerts.


---

## 14. API Specification

POST /vendor/login -- Authenticate vendor.

POST /vendor/magic-link -- Request login link.

GET /vendor/dashboard -- Load KPI data.

POST /vendor/invoice/upload -- Upload invoice PDF.

POST /vendor/invoice/submit -- Submit invoice data.

GET /vendor/invoice/{id} -- Invoice details.

POST /vendor/message/send -- Send dispute message.

GET /vendor/compliance -- Compliance list.

POST /vendor/compliance/upload -- Upload compliance doc.

GET /vendor/payments -- Payment history.

## 15. Validation Rules

- Invoice number required.

- Invoice date cannot exceed current date.

- Vendor must select internal staff contact.

- File type must be PDF/JPEG/PNG.

- File size must not exceed configured limit.

- Compliance documents must meet required types.

## 16. Error Handling

- Invalid login → 401 Unauthorized.

- Expired magic link → 410 Link Expired.

- OCR failure → Vendor prompted to manually enter data.

- Invoice duplicate → 409 Duplicate Invoice.

- Document failed validation → Vendor asked to re-upload.

## 17. Security Requirements

- AES-256 encryption for documents.

- Multi-tenant row isolation.

- Vendor cannot access internal employee info beyond name/role.

- Full audit on message logs.

- Secure storage buckets with tenant/vendor scoping.

- MFA optional per organization.
