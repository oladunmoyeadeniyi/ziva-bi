# Ziva BI — User Impersonation: Full Design Specification
*Written June 28 2026. Share this in the new chat when implementing impersonation.*

---

## 1. WHAT IT IS

Impersonation allows Ziva BI staff (Super Admin owner, consultants, support) to enter any tenant user's session directly — seeing exactly what that user sees — without knowing their password. It is a **diagnostic tool**, not an action tool. Its purpose is to understand a user's problem from their perspective.

This is distinct from the environment toggle (switching between test/live environments). Impersonation is switching to a different *user's identity* within an environment.

---

## 2. HOW IT IS ACCESSED (entry points)

Two entry points, both in the Super Admin / Ziva BI Admin / Consultant portal:

**Entry point 1 — Tenant user list:**
On the tenant detail page in the Super Admin portal, there is a list of all users belonging to that tenant. Clicking on any user in that list opens that user's session directly.

**Entry point 2 — Employee list:**
When a consultant/admin is inside a tenant's context (via the environment toggle or impersonation of an admin), navigating to People → Employees in the sidebar shows the employee list. Clicking on any employee in that list opens that employee's session directly.

Both entry points trigger the same impersonation mechanism — one click, no separate login, no password prompt.

---

## 3. THE IMPERSONATION SESSION

When impersonation is active:

- A **persistent visible banner** is shown at all times: `"You are viewing as [Full Name] — [Role]"` with an **Exit** button
- The banner must be impossible to dismiss except by clicking Exit — not closeable, not collapsable
- The Exit button returns the admin/consultant to their own session (back to the Super Admin portal or wherever they came from)
- The URL should reflect the impersonation state (e.g. a `?as={user_id}` param or a dedicated route prefix) so it is always clear from the browser what is happening
- **Every action taken during an impersonated session must be logged** in an audit trail: who impersonated, whose account, start time, end time, environment (test/live), and a record of any navigation/actions taken

---

## 4. ACCESS LEVELS BY ROLE

### Ziva BI Super Admin Owner (Adeniyi — the platform owner)
- **Full unrestricted access** in both test and live environments
- Can see everything the impersonated user sees including all sensitive financial data:
  - Individual salary figures
  - Personal bank account details
  - Employee TIN (Tax Identification Number)
  - Payroll figures
  - Any other sensitive personal financial information
- No restrictions whatsoever

### Ziva BI Team Members (consultants, support staff — NOT the owner)
**In the test environment:**
- Full transact access — can do everything the impersonated user can do:
  - Submit expense reports
  - Approve/reject expenses
  - Post journal entries
  - Any other transactional action
- This is intentional — testing requires full transact access to validate flows

**In the live environment:**
- **View-only** — can navigate anywhere the user can navigate, but cannot submit, approve, post, or take any action
- **Sensitive personal financial data is hidden:**
  - Individual salary figures → shown as `****` or hidden entirely
  - Personal bank account details → hidden
  - Employee TIN → hidden
  - Payroll figures → hidden
  - Any field tagged as sensitive personal financial data → hidden
- The UI should clearly indicate when data is hidden (e.g. a lock icon or "Hidden for privacy" label) rather than silently showing empty fields — so the consultant knows data exists but is restricted, not that the field is empty

---

## 5. WHAT IMPERSONATION CANNOT DO (hard rules)

These actions are **never available** from within an impersonated session, regardless of who is impersonating:

- Password reset
- Account unlock
- Role change
- Raising a support ticket on behalf of the user
- Any account settings change

These actions must be performed from the **Super Admin portal** on the user's profile page, outside of impersonation. This keeps a clean, unambiguous audit trail — every support action is logged as "Consultant X performed action Y on User Z's account" with a clear actor, not attributed to an impersonated session.

---

## 6. SUPPORT TICKET RAISING

Consultants CAN raise support tickets for a user's issue — but the mechanism is:

1. Consultant clicks user → enters impersonated session → observes the problem
2. Consultant clicks Exit → returns to Super Admin portal
3. Consultant navigates to that user's profile in the Super Admin portal
4. Consultant raises the support ticket from the user's profile page (not from within the impersonated session)

This mirrors the Intercom / Zendesk / Salesforce enterprise SaaS support pattern.

---

## 7. AUDIT TRAIL REQUIREMENTS

Every impersonation session must log:
- `impersonator_id` — who entered the session
- `impersonator_role` — their role (super_admin_owner / consultant / support)
- `target_user_id` — whose account was entered
- `target_tenant_id` — which tenant
- `environment` — test or live
- `started_at` — timestamp
- `ended_at` — timestamp (set when Exit is clicked)
- `entry_point` — "user_list" or "employee_list"
- Optional: a log of pages/actions navigated during the session

The audit log must be append-only (no deletes, no updates) and accessible to the Super Admin owner.

---

## 8. TECHNICAL IMPLEMENTATION NOTES

### JWT / session mechanics
Impersonation should NOT reuse the standard JWT mechanism (which carries `tenant_id` + `user_id`). Instead:

- Issue a **short-lived impersonation token** that carries: `real_user_id` (the impersonator), `impersonated_user_id`, `tenant_id`, `environment`, `is_impersonation: true`
- The impersonation token expires in a short window (e.g. 2 hours) regardless of session activity
- All API calls during impersonation use this token — the backend knows it's an impersonated session and applies the correct access restrictions (view-only in live, hide sensitive fields)
- When Exit is clicked: discard the impersonation token, restore the original admin/consultant token

### Sensitive field hiding (backend-enforced, not frontend-only)
Sensitive field restrictions **must be enforced in the API response**, not just in the UI. If a consultant impersonates a live user and the frontend tries to show salary, the backend must return `null` or a masked value — never the real value. Frontend-only hiding can be bypassed by inspecting API responses.

A clean pattern:
- Tag sensitive fields in the schema (e.g. `is_sensitive: true` metadata)
- In the response serializer, check `current_user.is_impersonation and current_user.environment == "live" and not current_user.is_super_admin_owner`
- If true, replace sensitive field values with `None` before returning

### Access control check
Before opening an impersonation session, verify:
1. The impersonator has the right to impersonate (is a Ziva BI staff member, not a tenant user)
2. The target user belongs to a tenant the impersonator has access to
3. Log the session start immediately

---

## 9. WHAT IS NOT YET BUILT

As of June 28 2026, impersonation is **designed but not yet implemented**. Nothing in the codebase handles:
- Impersonation token issuance
- The impersonation banner component
- Sensitive field masking in API responses
- The audit log table for impersonation sessions
- Entry points in the Super Admin portal user list or employee list

The design above is the complete specification to implement from.

---

## 10. RELATIONSHIP TO OTHER FEATURES

- **Environment toggle** (test/live switch) — separate from impersonation. Toggle switches environment; impersonation switches user identity. Both can be active simultaneously (e.g. a consultant is in the test environment AND impersonating a specific user within that test environment).
- **Configuration Promotion Pipeline** — unrelated to impersonation.
- **Super Admin portal** — impersonation entry points live here. The portal must exist before impersonation can be built.

---
*End of document.*
