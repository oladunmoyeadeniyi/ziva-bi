# Authentication & User Management — PRD

> Part of Ziva BI. This PRD wins over any older version.
> Last updated: May 2026

---

## 1. Purpose

This module is the security gateway for Ziva BI. It controls:

- How users register and log in
- How sessions and tokens are managed
- How roles determine what users can see and do
- How user accounts are created, activated, and deactivated
- How all auth events are audited

Every other module depends on this one. Nothing works without it.

---

## 2. Account Types

Ziva BI has two top-level account types. Auth behaviour adapts to each.

| Account Type | Who it's for | Key difference |
|---|---|---|
| `individual` | Personal users | Single user, no tenant, simplified flow |
| `business` | Companies of all sizes | Multi-tenant, RBAC, approval workflows |

Both types share the same auth infrastructure. The `account_type` flag on the user record drives the difference in UX and permissions.

---

## 3. Scope

### In scope
- Multi-tenant secure login (business)
- Individual account login (personal)
- JWT-based session management (access + refresh tokens)
- Password hashing (Argon2)
- Role-based access control (RBAC)
- User ↔ Tenant association
- MFA (optional per tenant)
- Password reset via email or OTP
- Super Admin with elevated privileges
- Tenant Admin user creation
- External user onboarding (vendors, customers, 3PL, auditors)
- Logout and token invalidation
- Audit logging for all auth actions
- Multi-role per user (e.g. Requestor + Approver)

### Out of scope (handled elsewhere)
- GL posting → GL Engine
- Workflow routing logic → Workflow Engine
- Budget variance → Budget Module
- Vendor onboarding details → Vendor Module
- Customer/order logic → AR Module
- 3PL operational rules → Warehouse Module
- Tax calculations → Tax Engine
- Payroll rules → Payroll Module

---

## 4. Authentication Methods

Tenants can enable one or both login methods. Individuals use email + password by default.

### 4.1 Email + Password
- Argon2 password hashing
- Tenant-configurable password complexity rules
- Optional MFA on login
- Account lockout after X failed attempts (tenant setting)

### 4.2 Phone Number + OTP (SMS or WhatsApp)
- Best for: vendors, field staff, drivers, 3PL, warehouse workers
- 6-digit OTP, hashed before storage
- OTP expiry configurable per tenant (default: 5 mins)
- Rate-limited per phone number
- No password required

### 4.3 Email OTP (Passwordless)
- User receives a one-time secure link
- Link expires in X minutes, single-use
- Tenant can enforce this for vendors/customers

### 4.4 TOTP-Based MFA (Authenticator App)
- Compatible with Google Authenticator, Microsoft Authenticator, Authy
- Tenant can mandate MFA for sensitive roles (Finance, Admin, Auditors)
- Backup codes available
- Users can self-enrol from profile settings

---

## 5. MFA Levels

Tenant Admin configures the MFA level:

| Level | Description |
|---|---|
| 0 | No MFA |
| 1 | OTP required on new device only |
| 2 | OTP required on every login |
| 3 | OTP + Authenticator App |
| 4 | Corporate policy (SSO + MFA + device trust) |

---

## 6. User Types & Roles

### 6.1 Individual Account
No roles needed. Single user, single account. Sees personal modules only.

### 6.2 Business Account — Global Roles

**1. Super Admin (Ziva BI Global)**
- Creates new tenants
- Enables/disables modules per tenant
- Manages global templates (tax rules, vendor categories, notifications)
- Read-only access to all tenant data for auditing
- Portal: Super Admin Portal

### 6.3 Business Account — Tenant-Level Roles

**2. Tenant Admin**
- Manages all users within their company
- Configures: chart of accounts, dimensions, approval workflows, tax rules, expense policies, credit policies, login methods
- Activates/deactivates users
- Reviews audit logs
- Portal: Tenant Admin Portal

**3. Employee (Requestor)**
- Submits expense retirements, payment requests, travel advances
- Uploads documents
- Views own transaction history
- Portal: Employee Portal

**4–7. Approvers (LM1, LM2, LM3, General Manager)**
- Approve/reject requests in their authority level
- Can query, return for correction, or partially approve
- GM can override workflow path
- Portal: Approver Portal

**8. Finance Reviewer**
- Validates GL accounts, dimensions, and tax (WHT, VAT, WVAT)
- Can split lines, correct GL/dimension errors, query requestor
- Approves or rejects for posting
- Portal: Finance Portal

**9. Finance Poster**
- Posts approved transactions to ERP
- Generates GL entries, manages bank uploads, accruals/reversals
- Portal: Finance Portal

**10. Finance Manager / FD / CFO**
- Approves disbursements, payroll, payable runs
- Can override tax treatment and approval routes
- Accesses financial reports and budget vs actuals
- Portal: Finance Leadership Dashboard

**11. Internal Auditor**
- Read-only access to all transactions
- Can raise queries and download document bundles
- Reviews workflow compliance
- Portal: Internal Audit Portal

**12. DPS (Distributor Partner Specialist)**
- Receives and submits customer orders
- Validates credit limits and payment balances
- Portal: Sales Portal

**13. DPM (Distributor Partner Manager)**
- Approves orders, credits, debits
- Manages customers under them
- Portal: Sales Leadership Portal

**14. Customer Admin** (external, customer side)
- Views account statement, invoices, credits, debits
- Downloads PODs, initiates returns
- Portal: Customer Portal

**15. Customer Finance User** (external)
- Manages payables on customer side
- Resolves discrepancies, downloads aging reports
- Portal: Customer Finance Portal

**16. Vendor Admin** (external)
- Manages vendor profile, uploads documents and invoices
- Requests bank detail updates (Finance must approve)
- Tracks payment status
- Portal: Vendor Portal

**17. Vendor Staff** (external)
- Uploads invoices and PODs
- Responds to Finance queries
- Portal: Vendor Portal

**18. 3PL Admin**
- Manages 3PL staff, confirms inbound/outbound, uploads POD
- Portal: 3PL Portal

**19. 3PL Operations Staff**
- Handles delivery tasks, updates delivery status, uploads POD
- Portal: 3PL Portal

**20. Warehouse Manager**
- Approves inbound/outbound movement, manages stock takes
- Reports damages and discrepancies
- Portal: Warehouse Portal

**21. Inventory Controller**
- Tracks stock, validates adjustments, handles valuation events (FIFO, AVCO, standard cost)
- Portal: Inventory Portal

**22. HR Officer**
- Manages employee master data, onboarding, leave, resignations
- Portal: HR Portal

**23. Payroll Officer**
- Runs payroll simulations, posts payroll to GL, manages deductions
- Portal: Payroll Portal

**24. Tax Officer**
- Configures tax rules, uploads schedules, generates tax summaries
- Portal: Tax Engine Portal

**25. Asset Manager**
- Registers assets, manages depreciation, disposals, and location tracking
- Portal: Asset Management Portal

**26. External Auditor**
- Read-only access across all transactions
- Downloads full audit trail, raises audit queries
- Portal: Audit Portal (External)

**27. API Integration User**
- Token-based only, no UI
- Used for ERP (Sage X3) and external system integrations

---

## 7. RBAC — Permission System

### How permissions are computed

```
Final permissions = role permissions + granted overrides − revoked overrides
```

Every user can hold multiple roles simultaneously (e.g. Requestor + Approver + Finance Reviewer).

### Permission layers

1. **Global permissions** — Super Admin only (e.g. `system.tenant.create`)
2. **Tenant permissions** — Tenant Admin (e.g. `tenant.user.create`)
3. **Module permissions** — Role-specific (e.g. `finance.post.erp`)
4. **Workflow permissions** — Who can approve at what level
5. **Data-level permissions** — Which GL ranges, cost centres, IOs a user can access
6. **Overrides** — Tenant Admin can grant or revoke individual permissions per user

All overrides are audit-logged.

### Key permission examples

| Role | Sample permissions |
|---|---|
| Employee | `requests.create`, `documents.upload`, `expenses.submit` |
| Approver | `requests.approve`, `requests.query`, `requests.partialApprove` |
| Finance Reviewer | `finance.review`, `finance.correct.gl`, `finance.tax.verify` |
| Finance Poster | `finance.post.erp`, `finance.bank.upload`, `finance.gl.generate` |
| Finance Manager | `finance.approve.disbursement`, `finance.override.tax`, `finance.reports.financial` |
| Vendor Admin | `vendor.invoice.upload`, `vendor.profile.manage`, `vendor.bank.update.request` |
| Internal Auditor | `audit.readonly`, `audit.download`, `audit.queries.raise` |
| Tenant Admin | `tenant.user.create`, `tenant.roles.assign`, `tenant.approval.flow.configure` |

---

## 8. Authentication Flows

### 8.1 Email + Password Login

1. User submits email + password
2. System checks: user exists, is active, belongs to a tenant
3. Password compared against Argon2 hash → failed attempts increment → lockout after X attempts
4. If MFA enabled: OTP sent or authenticator app code requested
5. On success: Access Token + Refresh Token generated, session created
6. User redirected to their portal based on roles

**Error codes:** `USER_NOT_FOUND`, `USER_DISABLED`, `PASSWORD_INCORRECT`, `ACCOUNT_LOCKED`, `MFA_REQUIRED`

### 8.2 Phone + OTP Login

1. User enters phone number → system checks it's registered and active
2. 6-digit OTP generated, hashed, stored, sent via SMS or WhatsApp
3. User submits OTP → backend verifies: correct, not expired, not reused, retries not exceeded
4. Tokens generated, session created, user redirected

### 8.3 Password Reset

**Via email:** System sends single-use link (expires in X mins) → user sets new password → logged  
**Via OTP:** OTP sent to phone or email → user enters OTP + new password → logged  
**Tenant-configured:** Admin chooses which method(s) are available per tenant

### 8.4 MFA Setup (TOTP)

1. Backend generates TOTP secret
2. User scans QR code with authenticator app
3. User enters 6-digit code to verify
4. MFA enabled, backup codes generated (optional)

### 8.5 First-Time Login

Tenant can require on first login:
- Forced password change
- MFA enrollment
- Profile completion
- Acceptance of company policies

### 8.6 Multi-Tenant Login (Consultant / Cross-Company User)

1. User logs in → system detects multiple tenant memberships
2. User selects which tenant to enter
3. Token issued for selected tenant
4. Switching tenants requires new token

### 8.7 Account Lockout

Triggered by too many failed password/OTP/MFA attempts or suspicious patterns.  
Tenant sets: allowed attempts, lockout duration, whether admin reset is required.

### 8.8 Account Deactivation

Triggered by resignation, suspension, or security concern.  
Effects: all tokens immediately invalidated, login blocked, workflow tasks optionally reassigned.

### 8.9 Session Expiry & Token Refresh

- Access token: expires every 15–60 mins (tenant setting)
- Refresh token: expires in 7–30 days (tenant setting)
- Frontend sends refresh token → backend validates → issues new access token
- Rotating refresh tokens: old token marked as replaced; if reused, all sessions revoked (replay attack protection)

### 8.10 Logout

- Refresh token revoked
- Session marked ended
- Audit event logged
- Device trust optionally cleared

### 8.11 Suspicious Login Detection

Triggered by: new device, new country, unusual time.  
Actions: require OTP, notify user by email/SMS, log event.

---

## 9. Session Management

Each session records:
- User ID + Tenant ID
- Device fingerprint
- IP address
- Login time + expiry
- MFA method used
- Is new device / new location flags

Tenant can configure:
- Max active sessions per user
- Auto-logout after inactivity
- Login notifications

---

## 10. Device Trust (Optional)

User can mark a device as trusted for 30 days → MFA skipped on subsequent logins from that device.  
Trust is revoked if: location changes drastically, suspicious behaviour detected, or tenant policy overrides it.  
Device fingerprint stored as a hash (not raw PII).

---

## 11. Portal Routing (Post-Login Redirect)

| Role | Portal |
|---|---|
| Individual | Personal Dashboard |
| Employee | Employee Portal |
| Approver | Approver Portal |
| Finance Reviewer / Poster | Finance Portal |
| Finance Manager / FD / CFO | Finance Leadership Dashboard |
| Internal Auditor | Internal Audit Portal |
| External Auditor | Audit Portal (External) |
| DPS | Sales Portal |
| DPM | Sales Leadership Portal |
| Customer Admin / Finance | Customer Portal |
| Vendor Admin / Staff | Vendor Portal |
| 3PL Admin / Staff | 3PL Portal |
| Warehouse Manager | Warehouse Portal |
| Inventory Controller | Inventory Portal |
| HR Officer | HR Portal |
| Payroll Officer | Payroll Portal |
| Tax Officer | Tax Engine Portal |
| Asset Manager | Asset Management Portal |
| Tenant Admin | Tenant Admin Portal |
| Super Admin | Ziva BI Global Admin Portal |

Multi-role users are redirected to their primary portal; they can switch between permitted portals.

---

## 12. Password & OTP Policy (Tenant Controlled)

### Password
- Minimum length, complexity rules (uppercase, numbers, special chars)
- Optional expiry and history (no reuse of last N passwords)
- Account lockout policy
- Mandatory periodic reset

### OTP
- Expiry time (e.g. 3, 5, 10 mins)
- Max retries per hour
- Allowed channels (SMS, WhatsApp, email)
- Throttle on multiple requests
- Branding (company name in OTP message)

---

## 13. Audit Logging

Every auth event is logged immutably:

- Login success / failure
- OTP sent / verified
- Password reset
- MFA setup / disabled
- Session created / revoked
- Role assigned / removed
- Permission override added / removed
- Tenant context switch
- Account created / deactivated

Visible to: Super Admin, Tenant Admin, Internal Auditor, Finance Director.

---

## 14. API Endpoints (Summary)

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Email + password login |
| POST | `/auth/login-otp` | OTP-based login |
| POST | `/auth/request-otp` | Request OTP |
| POST | `/auth/verify-otp` | Verify OTP |
| POST | `/auth/mfa/setup` | Enrol TOTP |
| POST | `/auth/mfa/verify` | Verify TOTP code |
| POST | `/auth/logout` | Logout + revoke tokens |
| POST | `/auth/refresh-token` | Refresh access token |

### Users
| Method | Endpoint | Description |
|---|---|---|
| POST | `/users` | Create user |
| GET | `/users/:id` | Get user |
| PATCH | `/users/:id` | Update user |
| DELETE | `/users/:id` | Deactivate user |
| GET | `/roles` | List available roles |
| POST | `/roles/assign` | Assign role to user |
| POST | `/roles/remove` | Remove role from user |

---

## 15. Data Model (PostgreSQL)

### Design principles
- Strict tenant isolation via `tenant_id` on all business tables
- Row-Level Security (RLS) enforced at DB level
- Immutable audit log
- Argon2 password hashing; hashed OTPs and refresh tokens
- TOTP secrets encrypted at rest via KMS
- Partition `sessions` and `audit_logs` for scale

### Core tables

**`tenants`** — Company records  
**`tenant_settings`** — Per-tenant auth/security config (stored as JSONB)  
**`users`** — Global user identity (one record per person across all tenants)  
**`user_tenants`** — Maps users to tenants; holds tenant-specific login email/phone and password hash  
**`roles`** — System and tenant-defined roles  
**`permissions`** — Canonical permission codes (e.g. `finance.post.erp`)  
**`role_permissions`** — Joins roles to permissions  
**`user_roles`** — Roles assigned to a user within a tenant  
**`permission_overrides`** — Per-user, per-tenant grants and revocations  
**`sessions`** — Active and ended sessions (device, IP, expiry, revoked flag)  
**`refresh_tokens`** — Hashed refresh tokens, linked to sessions. Supports token rotation.  
**`otp_codes`** — Hashed OTPs with purpose (LOGIN, RESET_PASSWORD, MFA_ENROLL) and channel  
**`mfa_secrets`** — Encrypted TOTP secrets  
**`device_trust`** — Trusted device fingerprints per user  
**`audit_logs`** — Immutable auth event log, partitioned monthly

### Entity relationships

```
tenants (1) ── (1) tenant_settings
tenants (1) ── (M) user_tenants ── (1) users
user_tenants (1) ── (M) user_roles ── (1) roles
roles (M) ── (M) permissions [via role_permissions]
user_tenants (1) ── (M) permission_overrides
user_tenants (1) ── (M) sessions ── (1) refresh_tokens
user_tenants (1) ── (M) otp_codes
user_tenants (1) ── (0..1) mfa_secrets
user_tenants (1) ── (M) device_trust
tenants (1) ── (M) audit_logs
```

### Key DDL

```sql
-- Effective permissions for a user (role perms + overrides)
WITH role_perms AS (
  SELECT p.code
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_tenant_id = '<<id>>' AND ur.revoked_at IS NULL
),
overrides AS (
  SELECT permission_id, allowed FROM permission_overrides
  WHERE user_tenant_id = '<<id>>'
)
SELECT DISTINCT code FROM (
  SELECT code, true AS granted FROM role_perms
  UNION ALL
  SELECT p.code, po.allowed FROM overrides po JOIN permissions p ON p.id = po.permission_id
) t
WHERE NOT (t.granted = false);
```

### Security checklist
- TLS on all DB connections
- Argon2 for passwords, SHA-256 HMAC for refresh tokens, hashed OTPs
- TOTP secrets encrypted via KMS (never stored plain)
- Device fingerprints stored as hashes
- RLS policies enforced per tenant
- No secrets in audit log payloads
- Rotate DB credentials; use IAM roles where available
- Partition + archive `audit_logs` (keep 2 years online, archive older to cold storage)
- GDPR right-to-be-forgotten: anonymise email/phone, keep audit trail, strip PII

---

## 16. Individual Account Differences

Individual accounts use a simplified subset:

| Feature | Individual | Business |
|---|---|---|
| Tenants | No tenant | Has tenant_id |
| Roles | None (single user) | Full RBAC |
| MFA | Optional (user-set) | Tenant-enforced |
| Approval workflows | None | Full workflow engine |
| Portal routing | Personal Dashboard | Role-based |
| Password policy | System default | Tenant-configured |
| Audit log | User-visible only | Admin + Auditor visible |

The same tables are used. `tenant_id` is null for individual accounts. `account_type` flag drives UI behaviour.

---

## 17. Build Notes for Claude Code

When building this module, follow this order:

1. Database migrations: create all tables in dependency order (tenants → users → user_tenants → roles → permissions → role_permissions → user_roles → sessions → refresh_tokens → otp_codes → mfa_secrets → device_trust → audit_logs)
2. Backend (FastAPI): auth router, JWT middleware, password hashing service, OTP service
3. Frontend (Next.js): sign up page (individual vs business selection), login page, forgot password page
4. Seed: Super Admin user + at least one test tenant with one Tenant Admin
5. Test: login, token refresh, logout, password reset before moving to next milestone

MFA and device trust are **optional at MVP** — build the hooks but don't block milestone 2 on them.

---

*End of PRD. Update this document just before building the Auth module.*
