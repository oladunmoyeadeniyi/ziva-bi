# BRIEF — User Impersonation (M9.3b)

Read `docs/MASTER_CONTEXT.md` and `docs/IMPERSONATION_DESIGN.md` in full before starting. The design doc is the specification; this brief translates it into exact build steps given what's already in the codebase.

## Context — what already exists vs what's missing

**Already built (M9.3a — tenant context switch):**
- `POST /api/platform/tenants/{tenant_id}/enter` — mints an impersonation token for a Super Admin entering a *tenant*. The token's `sub` remains the SA's own `user_id`; `impersonation_mode` = `"implementation"` | `"support"`.
- `CurrentUser.impersonator_id` and `CurrentUser.impersonation_mode` fields on the JWT/middleware.
- `block_if_readonly_impersonation()` — blocks mutations when `impersonation_mode == "support"` + `environment == "live"`.
- Frontend: `ImpersonationState` type in `AuthContext`, existing tenant-viewing banner in `layout.tsx`.
- `GET /api/platform/tenants/{tenant_id}` — already returns the tenant's user list.

**What M9.3b adds — user-level impersonation:**
- Entering a *specific user's* session (the target user's identity in the JWT, not the SA's).
- Audit trail table (`impersonation_sessions`).
- Persistent in-app banner: "You are viewing as [Full Name] — [Role]" with a non-dismissable Exit.
- Entry points in both the Super Admin portal and the employee list.
- Sensitive field masking framework (fields empty when payroll/HR ships).
- Sidebar fix: hide WORKSPACE + ACCOUNT sections in tenant-level context switch modes.

---

## STEP 0 — mandatory before touching anything

1. Read `docs/MASTER_CONTEXT.md` §2 (tech stack) and §8 (coding standards) in full.
2. Read `docs/IMPERSONATION_DESIGN.md` in full.
3. Read `backend/app/middleware/auth.py` and `backend/app/core/security.py` — understand the current JWT payload structure and `CurrentUser` dataclass before adding fields.
4. Read `backend/app/routers/platform.py` — understand `_mint_impersonation_token()` and the existing `enter_tenant` endpoint before adding the new user-impersonation endpoint.
5. Read `frontend/src/app/dashboard/business/layout.tsx` — find the WORKSPACE + ACCOUNT nav sections and the TODO comment around line 226.
6. Confirm `frontend/src/contexts/AuthContext.tsx` has `ImpersonationState` typed — read it fully to understand what the frontend currently stores about impersonation before adding user-level fields.

---

## Fix A — Sidebar: hide WORKSPACE + ACCOUNT in tenant-context mode

**File:** `frontend/src/app/dashboard/business/layout.tsx`

When `impersonation` is set in `AuthContext` (i.e., a Super Admin has entered a tenant via the existing M9.3a enter mechanism) **and** the session is NOT a user-level impersonation (M9.3b, added later in this brief), hide the WORKSPACE and ACCOUNT nav groups entirely.

The Super Admin in implementation or support mode is doing admin/diagnostic work — they should not see Home / Expenses / Approvals / Profile in the sidebar, as those are employee-facing items. The sidebar for this mode shows only: COMMON DATA, FINANCIALS, PEOPLE, WORKFLOW & ACCESS, MODULE SETUP, GO-LIVE groups.

Condition to hide WORKSPACE + ACCOUNT:
```
impersonation != null && impersonation.mode !== "user"
```
(The `"user"` mode is added in Fix E below — when that mode is active, the sidebar SHOULD show WORKSPACE because the SA is seeing exactly what the target user sees.)

For now (before Fix E), the condition is simply: `impersonation != null` → hide WORKSPACE + ACCOUNT.

---

## Fix B — Backend: `impersonation_sessions` audit table

**File:** `backend/app/models/auth.py` (add alongside existing models, or create `backend/app/models/impersonation.py`)

```python
class ImpersonationSession(Base):
    __tablename__ = "impersonation_sessions"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    impersonator_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    impersonator_role   = Column(String(50), nullable=False)        # "super_admin_owner" | "super_admin"
    target_user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    target_tenant_id    = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    environment         = Column(String(10), nullable=False)         # "live" | "test"
    entry_point         = Column(String(30), nullable=False)         # "user_list" | "employee_list"
    started_at          = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ended_at            = Column(DateTime(timezone=True), nullable=True)
    # append-only: no updates or deletes permitted (enforce via service layer, never raw SQL)
```

Generate and apply an Alembic migration for this table. No FK cascade deletes — this table is append-only for audit.

---

## Fix C — Backend: JWT + `CurrentUser` additions

**Files:** `backend/app/core/security.py`, `backend/app/middleware/auth.py`

Add two new fields to the JWT payload structure (add alongside the existing M9.3a fields):

```
"is_user_impersonation":   bool,          # True when impersonating a specific user's identity
"impersonation_session_id": str | None,   # UUID of the ImpersonationSession record
```

In `CurrentUser` dataclass (`middleware/auth.py`), add:

```python
is_user_impersonation: bool = False
impersonation_session_id: uuid.UUID | None = None
```

In the JWT decode block (wherever `impersonator_id` and `impersonation_mode` are decoded), also decode these two new fields.

**Do not change** the existing `impersonator_id` or `impersonation_mode` fields — they continue to work for M9.3a tenant-level context switches.

---

## Fix D — Backend: user impersonation endpoint

**File:** `backend/app/routers/platform.py`

New endpoint:

```
POST /api/platform/tenants/{tenant_id}/users/{user_id}/impersonate
```

Body (optional): `{ "entry_point": "user_list" | "employee_list" }`

Logic:
1. Guard: `_sa(current_user)` — Super Admin only.
2. Verify the target `user_id` has a `UserTenant` record for `tenant_id` (i.e., they actually belong to this tenant). If not → 404.
3. Look up the target `UserTenant` — get `is_locked`, `is_active`. If locked or inactive → 403 ("Cannot impersonate a locked or inactive user.").
4. Look up the target user's roles for this tenant via `UserRole` → derive `is_tenant_admin`, `has_non_admin_role`, `role_tier` (same logic as the login flow uses).
5. Determine `impersonator_role`: if `current_user.user_id == UUID(settings.owner_user_id)` (see Fix F) → `"super_admin_owner"`, else `"super_admin"`.
6. Create an `ImpersonationSession` record — `started_at = now()`, `ended_at = None`, `entry_point` from body (default `"user_list"`).
7. Mint a new access token where **`sub` = target user's `user_id`** (not the impersonator's), carrying the target user's full identity:
   ```python
   {
       "sub":                     str(target_user.id),
       "user_tenant_id":          str(target_ut.id),
       "account_type":            target_ut.account_type,  # or from User
       "tenant_id":               str(tenant_id),
       "session_id":              str(current_user.session_id),  # reuse SA session
       "is_super_admin":          False,
       "is_tenant_admin":         is_tenant_admin,
       "has_non_admin_role":      has_non_admin_role,
       "role_tier":               role_tier,
       "environment":             current_user.environment,
       "impersonator_id":         str(current_user.user_id),
       "impersonation_mode":      current_user.impersonation_mode,  # carry forward
       "is_user_impersonation":   True,
       "impersonation_session_id": str(session.id),
       "type":                    "access",
   }
   ```
   Use the same expiry as standard access tokens.
8. Log to `AuditLog` (existing pattern): `"platform.user.impersonation.started"`.
9. Return: `{ access_token, session_id, target_user: { id, full_name, email, role } }`.

New endpoint to end a session:

```
POST /api/platform/impersonation/{session_id}/end
```

Logic: look up `ImpersonationSession` by `id`, verify `impersonator_id == current_user.impersonator_id` (must be the same SA who started it), set `ended_at = now()`. Log `"platform.user.impersonation.ended"`. Return 200.

Guard: the `require_auth` dependency is sufficient here (the call will be made with the *original* SA token, restored by the frontend before calling this endpoint).

---

## Fix E — Backend: sensitive field masking framework

**File:** `backend/app/middleware/auth.py`

Add a helper alongside `block_if_readonly_impersonation`:

```python
def is_restricted_impersonation(current_user: CurrentUser, settings) -> bool:
    """
    Returns True when sensitive personal financial fields should be masked.

    Condition: user-level impersonation session + live environment +
    impersonator is NOT the platform owner.

    Usage: call in any serializer/endpoint that returns salary, bank details,
    TIN, or payroll data. Return None (or "****") instead of the real value
    when this returns True.
    """
    if not current_user.is_user_impersonation:
        return False
    if current_user.environment != "live":
        return False
    owner_id = getattr(settings, "owner_user_id", None)
    if owner_id and current_user.impersonator_id == uuid.UUID(owner_id):
        return False
    return True
```

No actual field masking is needed yet — payroll/HR (M15) hasn't been built. This helper is the hook; apply it when M15 ships. Document this in a docstring clearly.

---

## Fix F — Config: owner user ID

**File:** `backend/app/config.py`

Add one optional setting:

```python
owner_user_id: str | None = None  # UUID of the Ziva BI platform owner (Adeniyi)
```

Add to `.env.example`:
```
# Optional: UUID of the platform owner account. When set, this user's
# impersonation sessions in live environments are unrestricted (full access,
# no sensitive field masking). If unset, all super admins are treated as
# non-owner (restricted in live).
OWNER_USER_ID=
```

---

## Fix G — Frontend: `ImpersonationUserBanner` component

**File:** `frontend/src/components/ImpersonationUserBanner.tsx` (new file)

```tsx
interface Props {
  fullName: string;
  role: string;
  onExit: () => void;
}
```

Renders a persistent, non-dismissable banner (cannot be closed — no X button):

```
"You are viewing as [Full Name] — [Role]"   [Exit impersonation]
```

Design: distinct from the existing tenant-viewing banner (which is amber/orange). Use a different color — e.g. violet or indigo — so the two banners are visually distinct if both are visible simultaneously. The Exit button calls `onExit`.

Place the banner in `frontend/src/app/dashboard/business/layout.tsx` — render it when `impersonation?.mode === "user"` is set in `AuthContext`, stacked below the existing tenant-context banner (which continues to show the tenant name and environment).

---

## Fix H — Frontend: `AuthContext` updates

**File:** `frontend/src/contexts/AuthContext.tsx`

`ImpersonationState` currently tracks the tenant-level context. Extend it to also track user-level state:

```ts
interface ImpersonationState {
  mode: "implementation" | "support" | "user";  // add "user"
  tenantName: string;
  environment: string;
  // New (only set when mode === "user"):
  sessionId?: string;
  targetUser?: { id: string; fullName: string; role: string; };
}
```

Add to `AuthContext`:
- `originalSAToken: string | null` — the Super Admin's original access token, stored when user impersonation starts so it can be restored on exit.
- `startUserImpersonation(targetUserId, entryPoint)` — calls `POST /api/platform/tenants/{tenantId}/users/{targetUserId}/impersonate`, stores the returned token as `accessToken`, stores the current token as `originalSAToken`, updates `ImpersonationState.mode` to `"user"`.
- `exitUserImpersonation()` — calls `POST /api/platform/impersonation/{sessionId}/end`, restores `originalSAToken` as `accessToken`, resets `ImpersonationState.mode` back to `"implementation"` or `"support"` (the previous mode before user impersonation started).

---

## Fix I — Frontend: entry point 1 (Super Admin portal → tenant user list)

**File:** `frontend/src/app/platform/tenants/[id]/page.tsx`

The tenant detail page already shows a user list. Add an "Impersonate" button or clickable row action for each user. On click:
1. Call `startUserImpersonation(userId, "user_list")` from `AuthContext`.
2. On success, navigate to `/dashboard/business` (the tenant's home page) — the user will now see the tenant through that user's eyes.

Only show the Impersonate button when the viewer is Super Admin (`user?.is_super_admin`).

---

## Fix J — Frontend: entry point 2 (employee list within tenant)

**File:** `frontend/src/app/dashboard/business/settings/employees/page.tsx`

Add an "Impersonate" button on each employee row in the table. Only visible when `user?.is_super_admin` (i.e., the viewer is a Super Admin who has entered the tenant). On click: call `startUserImpersonation(employeeUserId, "employee_list")`.

Note: the employee list uses `employee.user_id` or similar to identify the underlying user account. In Step 0, verify that the API response for employees includes `user_id` (the UUID that links to the `users` table) so the frontend can pass it to the impersonation endpoint. If it's missing from the current response, add it.

---

## Fix K — Sidebar update for "user" mode

**File:** `frontend/src/app/dashboard/business/layout.tsx`

Update Fix A's condition now that `mode: "user"` exists:

```tsx
// Hide WORKSPACE + ACCOUNT when in tenant-context mode (not user impersonation)
const hideWorkspace = !!impersonation && impersonation.mode !== "user";
```

When `mode === "user"`, WORKSPACE and ACCOUNT render normally (the SA is seeing exactly what the user sees, including their home page and profile).

---

## Files you may create or modify

**Backend:**
- `backend/app/models/auth.py` (or new `models/impersonation.py`) — add `ImpersonationSession`
- `backend/app/routers/platform.py` — add two new endpoints
- `backend/app/middleware/auth.py` — two new fields on `CurrentUser`, new `is_restricted_impersonation()` helper
- `backend/app/core/security.py` — extend JWT payload comment/structure
- `backend/app/config.py` — add `owner_user_id`
- `backend/app/.env.example` — add `OWNER_USER_ID`
- `backend/alembic/` — new migration for `impersonation_sessions`
- `backend/app/schemas/platform.py` (or `schemas/auth.py`) — new request/response schemas for the two new endpoints

**Frontend:**
- `frontend/src/components/ImpersonationUserBanner.tsx` — new
- `frontend/src/contexts/AuthContext.tsx` — extend `ImpersonationState`, add new context methods
- `frontend/src/app/dashboard/business/layout.tsx` — Fix A + Fix K
- `frontend/src/app/platform/tenants/[id]/page.tsx` — Fix I
- `frontend/src/app/dashboard/business/settings/employees/page.tsx` — Fix J

**Do not touch:**
- The existing `enter_tenant` endpoint or its token structure — M9.3a stays as-is.
- Any backend router not listed above.
- Any frontend page not listed above.

---

## House rules

- Every new Python file or function needs a docstring per coding standards.
- Zero new npm dependencies — the banner component reuses `cn()` and existing Tailwind classes.
- Migration must be generated via Alembic (`alembic revision --autogenerate`), never raw SQL.
- No secrets in code — `owner_user_id` comes from `settings`, not hardcoded.
- Run `npm run type-check`, `npm run lint`, and `ruff check app/` clean before reporting done.
- Commit and push when done.
- Do NOT update `docs/MASTER_CONTEXT.md` or `CLAUDE.md` — Cowork handles that.

---

## Acceptance / test steps

1. **Sidebar fix (Fix A):** Navigate to any `/dashboard/business/*` page while in tenant-context mode (implementation or support) but NOT in user impersonation. WORKSPACE (Home, Expenses, Approvals) and ACCOUNT (Profile) must NOT appear in the sidebar. Grep: `hideWorkspace` logic is present in `layout.tsx`.
2. **Migration:** `alembic upgrade head` runs clean. `impersonation_sessions` table exists in DB.
3. **New JWT fields:** `grep -rn 'is_user_impersonation' backend/app/` → found in `security.py`, `middleware/auth.py`, and `routers/platform.py`.
4. **Impersonate endpoint:** `POST /api/platform/tenants/{id}/users/{uid}/impersonate` returns `{ access_token, session_id, target_user }`. Token's `sub` is the target user's ID, not the SA's.
5. **End endpoint:** `POST /api/platform/impersonation/{session_id}/end` sets `ended_at` on the DB record.
6. **Entry point 1:** Impersonate button visible on tenant user list rows in the Super Admin portal.
7. **Entry point 2:** Impersonate button visible on employee rows in `employees/page.tsx` when logged in as Super Admin in tenant context.
8. **`ImpersonationUserBanner`:** Renders visibly when `mode === "user"`, not when `mode === "implementation"` or `"support"`. Exit button restores the original SA session and the banner disappears.
9. **Sidebar in user mode (Fix K):** When in user impersonation (`mode === "user"`), WORKSPACE and ACCOUNT ARE visible.
10. **`is_restricted_impersonation` helper:** `grep -rn 'is_restricted_impersonation' backend/app/` → found in `middleware/auth.py`, exported and usable by future serializers.
11. `npm run type-check` → 0 errors. `npm run lint` → 0 errors. `ruff check app/` → 0 errors.
12. Committed and pushed to `main`.

---

## Completion summary required

Report:
- Commit hash + confirmation it's on `origin/main`.
- The exact JWT payload diff (before vs after) — which fields were added.
- Confirmation that the `impersonation_sessions` migration ran clean and the table exists.
- Which pages have entry points and what the button/click action looks like.
- The two banner components — existing tenant banner vs new user banner — and how they're visually distinguished.
- Confirmation that Fix A (sidebar) and Fix K (sidebar in user mode) are both wired correctly — state the condition used.
- Any Step-0 discoveries (e.g., whether `user_id` was already in the employee list API response or had to be added).
- Confirmation that `docs/MASTER_CONTEXT.md` and `CLAUDE.md` were NOT touched.
