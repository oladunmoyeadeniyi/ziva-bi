Milestone 5 — Tenant Admin & User Management

STANDING REQUIREMENTS:
- All pages fully mobile responsive
- Use existing ShadCN components
- Follow existing auth patterns
- All queries filter by tenant_id

CONTEXT:
- M1-M4 complete. Auth, expenses, approvals all working.
- Current problem: one user can submit and approve their own 
  expenses. This milestone fixes that by enabling proper 
  multi-user tenants with role-based access.
- Users table exists. Roles table exists. user_roles and 
  user_tenants tables exist.

---

## 1. DATABASE — New migration

### tenant_invitations
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- invited_by (UUID, FK → users)
- email (VARCHAR) — email of person being invited
- role (VARCHAR) — role to assign on acceptance
- token (VARCHAR, UNIQUE) — secure random token for invite link
- status (VARCHAR) — PENDING | ACCEPTED | EXPIRED
- expires_at (TIMESTAMP) — 48 hours from creation
- accepted_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)

### Update users table:
Add columns:
- employee_code (VARCHAR, nullable)
- department (VARCHAR, nullable)
- job_title (VARCHAR, nullable)
- phone (VARCHAR, nullable)
- is_active (BOOLEAN, default true)
- full_name (VARCHAR, nullable) — display name separate from 
  first/last if needed

---

## 2. BACKEND

### User Profile
GET /api/users/me
- Returns current user's full profile including employee_code,
  department, job_title, phone, tenant info, roles

PATCH /api/users/me
- Update own profile
- Body: { employee_code, department, job_title, phone, 
  full_name, phone }
- Cannot change email or password here

PATCH /api/users/me/password
- Change own password
- Body: { current_password, new_password }
- Validate current_password before updating

### Tenant User Management (Tenant Admin only)
GET /api/tenant/users
- List all users in current tenant
- Returns: id, full_name, email, employee_code, department, 
  job_title, roles, is_active, created_at

GET /api/tenant/users/{user_id}
- Get single user detail

PATCH /api/tenant/users/{user_id}/roles
- Assign or update roles for a user
- Body: { roles: ["employee", "finance_reviewer"] }
- Cannot change own roles

PATCH /api/tenant/users/{user_id}/deactivate
- Deactivate a user (soft delete — sets is_active = false)
- Deactivated users cannot login
- Cannot deactivate yourself

PATCH /api/tenant/users/{user_id}/reactivate
- Reactivate a deactivated user

### Invitations
POST /api/tenant/invitations
- Tenant Admin only
- Body: { email, role }
- Check email not already in tenant
- Generate secure token (secrets.token_urlsafe(32))
- Set expires_at = now + 48 hours
- Send invitation email:
  Subject: "You've been invited to join [Tenant Name] on Ziva BI"
  Body:
    "[Invited By Name] has invited you to join [Tenant Name] 
     on Ziva BI as [Role].
     
     Click the link below to accept your invitation:
     {FRONTEND_URL}/invite/accept?token={token}
     
     This link expires in 48 hours."
- If SMTP not configured, log to console

GET /api/tenant/invitations
- List all invitations for tenant
- Returns: email, role, status, expires_at, invited_by name

DELETE /api/tenant/invitations/{invitation_id}
- Cancel a pending invitation

### Invitation Acceptance (public endpoint — no auth required)
GET /api/invitations/validate/{token}
- Validate token is valid and not expired
- Returns: { email, tenant_name, role, invited_by_name }

POST /api/invitations/accept/{token}
- Body: { full_name, password }
- Validate token
- Create user account with provided details
- Link user to tenant with specified role
- Mark invitation as ACCEPTED
- Return JWT tokens (auto-login after acceptance)

### Enforce is_active on login
- Update login endpoint: if user is_active = false, 
  return 401: "Your account has been deactivated. 
  Contact your administrator."

---

## 3. FRONTEND

### Profile Page
Page: /dashboard/profile
- Accessible from top nav (click user name "Red Bull" → Profile)
- Sections:
  1. Personal Info: full_name, email (read only), phone
  2. Work Info: employee_code, department, job_title
  3. Change Password: current_password, new_password, 
     confirm_new_password
- Save button per section
- Success toast on save
- This fixes the "Employee Code not set on profile" 
  issue from M3

### Tenant Admin — User Management
Page: /dashboard/business/admin/users
- Only visible to Tenant Admin role
- Add "Team" to Settings section in sidebar

Table columns: Name, Email, Employee Code, Department, 
Roles, Status, Actions

Actions per user:
- "Edit Roles" — opens modal with role checkboxes:
  [ ] Employee
  [ ] Line Manager  
  [ ] Finance Manager
  [ ] GM
  [ ] Tenant Admin
- "Deactivate" (red) — confirm dialog
- "Reactivate" (green) — if deactivated

Status badge: Active (green) | Inactive (grey)

### Tenant Admin — Invitations
Page: /dashboard/business/admin/invitations
- Add "Invitations" tab on the users page (tabs: Users | Invitations)

Invitations tab:
- Button: "Invite User"
- Opens modal:
  - Email field
  - Role dropdown: Employee | Line Manager | Finance Manager 
    | GM | Tenant Admin
  - Send Invite button
- Invitations table: Email, Role, Status, Sent, Expires, Actions
- Status badges: Pending (yellow) | Accepted (green) | 
  Expired (grey)
- Cancel button on pending invitations

### Invitation Acceptance Page
Page: /invite/accept?token={token}
- Public page (no auth required)
- On load: validate token via GET /api/invitations/validate/{token}
- If valid: show form:
  - Welcome message: "You've been invited to join 
    [Tenant Name] as [Role]"
  - Full Name field
  - Password field
  - Confirm Password field
  - "Create Account & Join" button
- If invalid/expired: show error with link to contact admin
- On success: auto-login and redirect to dashboard

### Navigation Updates
- Add profile link: clicking "Red Bull" (top right) 
  opens dropdown with "Profile" and "Sign out"
- Add "Team" under Settings in sidebar (Tenant Admin only)

### Role-Based Access Updates
Now that real roles exist, enforce these rules:
- Expenses list: Finance Manager sees ALL reports in tenant; 
  Employee sees only their own
- Approvals queue: only shows reports assigned to current user
- Settings (approval matrix): Tenant Admin only
- Team management: Tenant Admin only
- Approver dropdowns: exclude the requestor (already done), 
  also only show active users

---

## 4. SEED DATA UPDATE
Update seed.py to create multiple test users for the 
test tenant so the approval flow can be tested properly:

Test tenant: testcorp.ziva.bi (already exists)
Add these users if they don't exist:
1. employee@testcorp.ziva.bi / Employee123! — role: employee
2. manager@testcorp.ziva.bi / Manager123! — role: line_manager
3. finance@testcorp.ziva.bi / Finance123! — role: finance_manager
4. gm@testcorp.ziva.bi / GM123! — role: gm

---

## AFTER BUILDING:
1. Run Alembic migration
2. Run updated seed.py to create test users
3. Test invitation flow:
   - Send invite to a new email
   - Accept invite via the token link
   - Confirm user appears in team list
4. Test profile:
   - Update employee code
   - Confirm it shows on expense forms
5. Test role-based access:
   - Login as employee — submit expense, select manager 
     as L1 approver
   - Login as manager — approve it
   - Login as finance — approve at L2
   - Login as gm — approve at L3
   - Confirm employee cannot approve own expense
6. Commit: "feat: Milestone 5 - Tenant user management"
7. Push to GitHub