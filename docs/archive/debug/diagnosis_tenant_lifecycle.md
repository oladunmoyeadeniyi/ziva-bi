# Diagnosis — Existing Tenant Environment / Lifecycle Scaffolding
**Date:** 2026-06-20  
**Purpose:** Full inventory of what exists before designing a real implementation→live promotion workflow.

---

## 1. Tenant model fields related to environment / lifecycle

**File:** `backend/app/models/auth.py`

```python
class Tenant(Base):
    """
    M9.0 environment model: a live tenant may have one shadow test tenant linked via
    parent_tenant_id. The environment column ("live" | "test") drives routing.
    Switching environments reissues the JWT to point at the target tenant's id.
    """

    # M9.0: environment architecture
    # "live" | "test" — test tenants are shadow copies of their live parent.
    environment: Mapped[str] = mapped_column(
        String(20), nullable=False, default="live", server_default="live"
    )

    # Null for live tenants; set on test tenants to point at their live parent.
    parent_tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # "trial" | "in_implementation" | "live" | "suspended" — used by M9.1 owner portal.
    lifecycle_status: Mapped[str] = mapped_column(
        String(50), nullable=False,
        default="in_implementation", server_default="in_implementation"
    )

    # Days to retain test transactional data (null = use system default of 90).
    test_data_retention_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # M9.1: saved before suspension so reactivate can restore the prior status.
    pre_suspension_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
```

**Summary of lifecycle-related fields:**

| Field | Type | Values | Intent |
|---|---|---|---|
| `environment` | `VARCHAR(20)` NOT NULL default `"live"` | `"live"` \| `"test"` | Identifies whether this row is the live tenant or its test shadow. Drives JWT routing. |
| `parent_tenant_id` | `UUID` nullable FK → `tenants.id` SET NULL | UUID or null | Null on live tenants; set on test-shadow tenants to point at their live parent. |
| `lifecycle_status` | `VARCHAR(50)` NOT NULL default `"in_implementation"` | `"trial"` \| `"in_implementation"` \| `"live"` \| `"suspended"` | Business lifecycle stage. Controls which mode the super admin enters and whether logins are allowed. |
| `test_data_retention_days` | `INTEGER` nullable | integer or null | How many days to keep test transactional data. Null = system default of 90. No enforcement logic built yet. |
| `pre_suspension_status` | `VARCHAR(50)` nullable | any of the lifecycle statuses | Saved when suspending so reactivate can restore the prior status. |

---

## 2. What `environment` actually controls

### 2a. JWT payload

**`backend/app/core/security.py`** — the JWT includes:
```python
"environment": "live" | "test",  # M9.0: active tenant environment
```
Every token carries the environment of the tenant it addresses.

### 2b. Login / token refresh (auth.py ~line 439)

On login and refresh, the server reads `tenant.environment` and bakes it into the JWT:
```python
# M9.0/M9.1: read tenant, check suspension, extract environment for JWT
login_env = getattr(_t, "environment", "live") if _t else "live"
access_token = _build_access_token(..., environment=login_env)
```
Same pattern on `POST /api/auth/refresh` (~line 555).

### 2c. `block_if_readonly_impersonation` (middleware/auth.py ~line 58)

Called at the top of every write/mutation endpoint:
```python
def block_if_readonly_impersonation(current_user: "CurrentUser") -> None:
    if (
        current_user.impersonation_mode == "support"
        and current_user.environment == "live"
    ):
        raise HTTPException(403,
            "Read-only support session — editing/posting is disabled on the live environment.")
```
**Effect:** When a super admin enters a LIVE tenant in "support" mode, all mutation endpoints raise 403. `environment="live"` is the discriminator. This does NOT apply when the super admin is in "implementation" mode on a live `in_implementation` tenant, nor when they're on the test shadow.

### 2d. `POST /api/auth/switch-environment` (auth.py ~line 624)

Full endpoint for tenants users to switch between their live and test environments:
- Resolves the counterpart tenant (live → test shadow via `parent_tenant_id`; test → live via own `parent_tenant_id`)
- Verifies the caller has a `UserTenant` on the target tenant
- Mints a fresh access + refresh token pair pointing at the target tenant
- Bakes `environment=target_tenant.environment` into the JWT
- Logs `"environment.switched"` audit event

**Important:** This endpoint is for tenants users (not super admins). It requires the caller to have a `UserTenant` row on both the live tenant and the test shadow.

### 2e. Platform tenants list filter (platform.py ~line 242)

```python
env_param = (environment or "live").lower()
if env_param == "live":
    q = q.where(Tenant.environment == "live")
elif env_param == "test":
    q = q.where(Tenant.environment == "test")
# "all" → no env filter
```
Default is `"live"` — test shadow tenants are excluded from the default list.

### 2f. Tenant detail — test environment summary (platform.py ~line 326)

When retrieving a live tenant's detail, the backend looks for a child shadow:
```python
if tenant.environment == "live":
    shadow = await db.execute(
        select(Tenant).where(
            Tenant.parent_tenant_id == tenant_id,
            Tenant.environment == "test",
        )
    )
```
If found, it populates a `TestEnvSummary` nested in the response.

### 2g. GL engine model (gl.py ~line 12)

Explicitly documents the architecture decision:
```python
# environment column is NOT included — test/live isolation is enforced by tenant_id
# (test tenants have distinct IDs); adding an environment column would be redundant.
```
**Data isolation is purely by `tenant_id`**, not by an environment column on data tables.

---

## 3. What `lifecycle_status` actually controls

**Valid values (defined in `platform.py` line 47):**
```python
_VALID_LIFECYCLE = frozenset({"trial", "in_implementation", "live", "suspended"})
```

### 3a. Login blocks suspended tenants (auth.py ~line 444)

```python
if _t and getattr(_t, "lifecycle_status", None) == "suspended":
    raise HTTPException(403, "This account is suspended. Contact support.")
```
`"suspended"` is the only value that blocks login. All other statuses allow normal login.

### 3b. Token refresh also checks (auth.py ~line 560)

Same check during `POST /api/auth/refresh`:
```python
if _rt and getattr(_rt, "lifecycle_status", None) == "suspended":
    raise HTTPException(403, "This account is suspended. Contact support.")
```

### 3c. `switch-environment` checks target tenant (auth.py ~line 691)

```python
if getattr(target_tenant, "lifecycle_status", None) == "suspended":
    raise HTTPException(403, "The target environment's tenant is suspended.")
```

### 3d. `enter_tenant` mode determination (platform.py ~line 140)

This is the most significant behavioral branch:
```python
lifecycle = target.lifecycle_status

if lifecycle == "suspended":
    raise HTTPException(409, "Cannot enter a suspended tenant.")

# "live" lifecycle — sets requested_env from request body
requested_env = (data.environment if data else "live") if lifecycle == "live" else target.environment

if lifecycle in ("trial", "in_implementation"):
    mode = "implementation"      # ← full edit access
    actual_tenant = target
    environment = target.environment  # always "live" for a direct tenant

else:  # lifecycle == "live"
    if requested_env == "test":
        # Route to the test shadow — full edit allowed
        mode = "implementation"
        actual_tenant = shadow
        environment = "test"
    else:
        # Live environment — support/read-only
        mode = "support"
        actual_tenant = target
        environment = "live"
```

**Mode matrix:**

| `lifecycle_status` | Super admin enters with | Mode | Access |
|---|---|---|---|
| `trial` | (any) | `implementation` | Full edit on live data |
| `in_implementation` | (any) | `implementation` | Full edit on live data |
| `live` | no env param or `environment="live"` | `support` | Read-only on live |
| `live` | `environment="test"` | `implementation` | Full edit on test shadow |
| `suspended` | (any) | — | 409 blocked |

### 3e. Super Admin UI: dashboard banner (dashboard/business/layout.tsx ~line 88)

The impersonation banner at the top of the tenant dashboard shows:
```typescript
const label = isSupport
  ? `Support · read-only (live)`
  : `Implementation · edit${impersonation.environment === "test" ? " · TEST" : ""}`;
```
This is the "Viewing X — Implementation" banner the brief references. It is driven by `impersonation_mode` (from the JWT), not directly by `lifecycle_status`.

### 3f. Super Admin UI: tenant detail page (platform/tenants/[id]/page.tsx)

Lifecycle controls what buttons are shown:
```typescript
const isConfigurable = ["trial", "in_implementation"].includes(tenant.lifecycle_status);
```
- `isConfigurable=true` → single "Enter tenant (configure)" button → calls `enterTenant(id)` with no env param
- `isConfigurable=false` (i.e. `lifecycle="live"`) → two buttons: "Enter live (read-only)" and "Enter test (edit)" (test button only shown if `test_environment` exists)
- `isSuspended=true` → no entry, message shown

### 3g. `/api/setup/go-live` endpoint (setup.py ~line 2994)

```python
@router.post("/go-live", response_model=GoLiveResponse)
async def mark_go_live(current_user, db):
    """
    Mark this tenant as live.
    Requires is_super_admin (consultant role_tier stripped M9.3a).
    All blocking sections must be complete.
    """
    if not current_user.is_super_admin:
        raise HTTPException(403, "Only consultants and super admins can mark a tenant as live.")
    
    progress = await get_progress(...)
    blocking_incomplete = [s.label for s in progress.sections if s.blocking and s.status != "complete"]
    if blocking_incomplete:
        raise HTTPException(422, f"Blocking items incomplete: {', '.join(blocking_incomplete)}")

    tenant.is_active = True          # ← only sets is_active; does NOT change lifecycle_status
    await db.commit()

    return GoLiveResponse(
        message="Tenant is now live. Welcome emails will be sent to all Power Admins.",
        tenant_id=str(tenant_id),
    )
```

**Critical observation:** `mark_go_live` sets `tenant.is_active = True` but does **NOT** update `lifecycle_status` to `"live"`. So after clicking "Mark tenant as live" in the UI, `lifecycle_status` stays at whatever it was (typically `"in_implementation"`). The lifecycle transition to `"live"` must be done separately via `PATCH /api/platform/tenants/{id}/lifecycle` from the Super Admin portal. **These two actions are not linked.**

### 3h. Platform dashboard stats (platform/page.tsx ~line 84)

```typescript
const countImpl = live.filter((t) => t.lifecycle_status === "in_implementation").length;
// displayed as: "In implementation" metric card
```

### 3i. PATCH /api/platform/tenants/{id}/lifecycle

Allows super admin to set `trial` | `in_implementation` | `"live"` directly. No business logic enforced — no checklist check, no cascade effects. Just sets the field and logs `"platform.lifecycle.updated"`.

---

## 4. `parent_tenant_id` — what it's for and existing code

### 4a. Architecture intent

From the model docstring:
> "a live tenant may have one shadow test tenant linked via parent_tenant_id. The environment column ('live' | 'test') drives routing. Switching environments reissues the JWT to point at the target tenant's id."

`parent_tenant_id` is the link from a test-shadow to its live parent. Convention:
- Live tenant: `parent_tenant_id = NULL`, `environment = "live"`
- Test shadow: `parent_tenant_id = <live_tenant_id>`, `environment = "test"`

### 4b. `POST /api/tenant/create-test-environment` (tenant.py ~line 150)

**Full implementation exists.** Creates a test shadow of the live tenant:

```python
test_tenant = Tenant(
    name=f"{live_tenant.name} (Test)",
    country=live_tenant.country,
    slug=f"{live_tenant.slug}-test",      # unique slug ensured
    environment="test",
    parent_tenant_id=live_tenant.id,      # ← links to live parent
    lifecycle_status=live_tenant.lifecycle_status,
    is_active=True,
)
# Then mirrors all UserTenant rows from live to test (same role_tier, password_hash)
```

**Idempotent** — if a test tenant already exists, returns it unchanged.

**Caller must be:** `is_tenant_admin=True` OR `is_super_admin=True`, and on a live tenant.

### 4c. `POST /api/tenant/promote` (tenant.py ~line 259)

**Partially implemented.** Copies selected config sections from test → live:

**Implemented sections:**
- `org_config` → copies `TenantOrgConfig` fields (legal_name, functional_currency, enabled_currencies, etc.)
- `tax` → copies `TenantTaxConfig` (VAT/WHT/PAYE JSONB blobs)
- `fx` → copies `TenantFxConfig` (fx_rates, revaluation_rules)

**Deferred sections (flagged, NOT implemented):**
```python
_DEFERRED_SECTIONS = {"chart_of_accounts", "dimensions", "periods"}
```
> "chart_of_accounts and dimensions are deferred: they contain internal FKs (account_group → account, dimension_value → dimension) that require id remapping to avoid referential corruption in the live tenant. Periods are operational (status machine), not pure config, so they are also deferred."

**Schema:**
```python
class PromoteRequest(BaseModel):
    sections: list[Literal["org_config", "tax", "fx"]]

class PromoteResponse(BaseModel):
    promoted: list[str]
    deferred: list[str]
    message: str
```

**Caller must be:** `is_super_admin=True`, on a TEST tenant (not live).

### 4d. `POST /api/tenant/purge-test-data` (tenant.py)

**STUB — documented no-op.** Comment reads:
> "STUB — documented no-op. Scheduled purge of test transactional data is not yet built."

### 4e. `POST /api/auth/switch-environment` (auth.py ~line 624)

Tenant users (non-super-admin) use this to switch between their live and test environments. Resolves the counterpart tenant via `parent_tenant_id`.

### 4f. No "clone" or "staging" code

Searched the entire backend for "clone", "staging", "sandbox" — no hits. The test environment architecture uses "shadow" terminology internally.

---

## 5. `tenant_management.py` model and tenant-lifecycle relevance

**File:** `backend/app/models/tenant_management.py`

Contains only `TenantInvitation`. Nothing tenant-lifecycle related. No new fields beyond invitation token, expiry, and status.

---

## 6. Super Admin Tenants UI — current capabilities

**File:** `frontend/src/app/platform/tenants/[id]/page.tsx`

The super admin tenant detail page exposes the following actions via UI buttons calling backend APIs:

| UI element | API called | Effect |
|---|---|---|
| **"Enter tenant (configure)"** (for `trial`/`in_implementation`) | `POST /api/platform/tenants/{id}/enter` | Mints impersonation token, mode=`implementation`, navigates to setup dashboard |
| **"Enter live (read-only)"** (for `live`) | `POST /api/platform/tenants/{id}/enter` with no env | Mints impersonation token, mode=`support`, read-only |
| **"Enter test (edit)"** (for `live` + test shadow exists) | `POST /api/platform/tenants/{id}/enter` with `{environment:"test"}` | Mints impersonation token for test shadow, mode=`implementation` |
| **Lifecycle dropdown + "Set lifecycle"** | `PATCH /api/platform/tenants/{id}/lifecycle` | Sets `lifecycle_status` to `trial`\|`in_implementation`\|`live` (no cascade, no checklist) |
| **"Suspend tenant"** | `POST /api/platform/tenants/{id}/suspend` | Sets `lifecycle_status="suspended"`, saves prior in `pre_suspension_status` |
| **"Reactivate tenant"** | `POST /api/platform/tenants/{id}/reactivate` | Restores `lifecycle_status` from `pre_suspension_status` |

**What's NOT in the UI:**
- No "Create test environment" button (the `POST /api/tenant/create-test-environment` endpoint exists but is not surfaced in the super admin portal — it's a tenant-side action)
- No "Promote config test→live" button in the UI (the `POST /api/tenant/promote` endpoint exists in the tenant router but has no frontend)
- No "Purge test data" button

The platform tenants LIST page (`/platform/tenants`) shows `lifecycle_status` badges (trial/in_implementation/live/suspended) and lifecycle filter dropdown. It only lists/navigates; all mutations happen on the detail page.

---

## 7. Global search: "implementation", "go-live", "promote", "staging"

### Backend hits

| Location | Hit | Type |
|---|---|---|
| `platform.py:47` | `_VALID_LIFECYCLE = frozenset({..."in_implementation"...})` | Real: valid lifecycle values enum |
| `platform.py:125–153` | `if lifecycle in ("trial", "in_implementation"): mode = "implementation"` | Real: mode determination |
| `tenant.py` docstring | "M9.0 environment endpoints... POST /api/tenant/create-test-environment... POST /api/tenant/promote" | Real implemented endpoints |
| `tenant.py:259` | `POST /api/tenant/promote` — partial implementation | Real: org_config/tax/fx promoted; CoA/dims/periods deferred |
| `tenant.py:_DEFERRED_SECTIONS` | `{"chart_of_accounts", "dimensions", "periods"}` | Real: intentional deferral |
| `setup.py:2994` | `POST /api/setup/go-live` — sets `is_active=True` only | Real but incomplete (does NOT update lifecycle_status) |
| `auth.py:switch-environment` | Full live↔test switching for tenant users | Real, fully implemented |
| `middleware/auth.py:block_if_readonly_impersonation` | Used in many write endpoints | Real: blocks writes in support+live mode |

### Frontend hits

| Location | Hit | Type |
|---|---|---|
| `setup/go-live/page.tsx` | "Mark tenant as live" calls `POST /api/setup/go-live` | Real: connected to the incomplete backend endpoint |
| `setup/go-live/page.tsx:69` | `const isConsultant = user?.is_super_admin` | Real: gate for the go-live button |
| `platform/page.tsx:84` | `filter((t) => t.lifecycle_status === "in_implementation")` | Real: dashboard metric |
| `platform/tenants/[id]/page.tsx:210` | `isConfigurable = ["trial", "in_implementation"].includes(...)` | Real: controls entry buttons |
| `platform/tenants/page.tsx:34,118` | Lifecycle badge + filter dropdown for "in implementation" | UI label only — no logic |
| `platform/trials/page.tsx:27` | `"Conversion pipeline — trial → in implementation → live"` | **Stub/placeholder only** — this page has no real data |
| `components/LockedField.tsx` | "Locked by implementation. Contact your Ziva BI consultant to modify." | Real UI component, used for consultant-locked fields |
| `setup/organisation/page.tsx:1381` | "locked after go-live" (text in form helper) | UI label only |
| `setup/currencies/page.tsx:597` | "Cannot be changed after go-live." | UI label only |
| `layout.tsx:90` | `"Implementation · edit · TEST"` banner label | Real: displays during impersonation |
| `AuthContext.tsx:265` | `mode: res.impersonation_mode as "implementation" | "support"` | Real: stores impersonation mode in context |

### No hits for: "clone", "staging", "sandbox", "promote_to_live", "go_live" (underscore form)

---

## 8. Current field values in DB

### Red Bull Nigeria Limited (`bd2c8a25-7467-494a-96fa-30f40b5b5d19`)

| Field | Value |
|---|---|
| `environment` | `"live"` |
| `parent_tenant_id` | `null` |
| `lifecycle_status` | `"in_implementation"` |
| `test_data_retention_days` | `null` |
| `pre_suspension_status` | `null` |
| `is_active` | `true` |

**Why `lifecycle_status = "in_implementation"` with `environment = "live"`:** This is the current genuine state — the tenant is being configured by Adeniyi via the implementation portal. These two fields are entirely independent. A tenant can be `environment=live` (it's not a test shadow) while `lifecycle_status=in_implementation` (it hasn't been marked as ready for production). The "Implementation" banner in the UI appears because the super admin entered the tenant while its lifecycle was `in_implementation`, which maps to mode=`implementation` in the `enter_tenant` logic.

### Ziva BI — Test Tenant (`f2aecfab-025f-410f-a7f6-df923172c8a1`)

| Field | Value |
|---|---|
| `environment` | `"live"` |
| `parent_tenant_id` | `null` |
| `lifecycle_status` | `"in_implementation"` |
| `test_data_retention_days` | `null` |
| `pre_suspension_status` | `null` |
| `is_active` | `true` |

**Note:** The "Ziva BI — Test Tenant" created for acceptance tests has `environment="live"` and `parent_tenant_id=null`. It is NOT a proper M9.0 test shadow. It's just a standalone tenant with no live parent. It was created manually for script isolation, not via `POST /api/tenant/create-test-environment`.

---

## Summary: what exists vs. what's missing

### Built and working
- `environment` column + test-shadow model (`parent_tenant_id`)
- `lifecycle_status` with `suspended` login block
- `POST /api/tenant/create-test-environment` — creates shadow, mirrors users
- `POST /api/auth/switch-environment` — live↔test token swap for tenant users
- `POST /api/platform/tenants/{id}/enter` — super admin impersonation with mode logic
- `block_if_readonly_impersonation` — support+live = read-only write block
- `PATCH /api/platform/tenants/{id}/lifecycle` — manual lifecycle transition
- `POST /api/platform/tenants/{id}/suspend` / `reactivate`
- `POST /api/tenant/promote` — copies org_config/tax/fx from test→live

### Partially built
- `POST /api/setup/go-live` — sets `is_active=True` but **does NOT update `lifecycle_status`**; the two are unlinked
- `POST /api/tenant/promote` — org_config/tax/fx work; **CoA, dimensions, periods are deferred** (need id remapping)

### Stubbed / planned but empty
- `POST /api/tenant/purge-test-data` — documented no-op
- `/platform/trials` page — placeholder with no real data
- No frontend UI for `create-test-environment` or `promote` in the Super Admin portal
- No automated promotion flow (must be done via API calls, not a button)
- `test_data_retention_days` — column exists but no enforcement logic
