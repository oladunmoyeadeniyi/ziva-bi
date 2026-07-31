# BRIEF: UX Hardening — Six Issues (2026-07-12)

Six issues identified during live testing of the SA portal and tenant-facing UI.
Each issue below states what exists, what the gap is, and the exact fix required.

---

## Issue 1 — SA portal: no way to create a tenant

**What exists:** `/platform/tenants` is a list-only page. The only way to create a
tenant is via the public `/auth/signup` form.

**Gap:** A consultant needs to be able to manually onboard a company directly from the
SA portal — especially for enterprise customers who don't go through self-service signup.

**Fix — backend:**
- Add `POST /api/platform/tenants` endpoint (SA-only). Accepts: company name, country,
  contact name, contact email, contact phone, interested modules (array), preferred
  posting mode, notes. Creates `Tenant` (lifecycle=`trial`, environment=`test`),
  seeds `TenantOrgConfig` and default expense categories. Optionally sends invite email
  to the contact.

**Fix — frontend:**
- Add "Add company" button to `/platform/tenants` list page (SA-only, top right).
- Opens a slide-over or modal with the fields above.
- On success: navigate to the new tenant's detail page.

---

## Issue 2 — Signup form: missing trial-intent fields

**What exists:**
The form collects: full name, email, password, company name, country.
The backend creates a `trial` tenant and seeds the org config, but nothing about
*what the customer wants* is captured.

**Gap:**
The SA's "Trials & signups" page shows new leads with almost no context. The consultant
has to chase the customer to understand what they need before they can even begin
qualification. This defeats the purpose of the lead-capture flow.

**Fields to add (all optional — do not block signup if omitted):**

| Field | Type | Where stored |
|---|---|---|
| Phone number | text | `users.phone` (column already exists) |
| Job title | text | `users.job_title` (column already exists) |
| Company size | select (1–10 / 11–50 / 51–200 / 200+) | new `tenants.company_size` column (varchar) |
| Modules of interest | multi-checkbox | new `tenants.interested_modules` JSONB column |
| Preferred subscription mode | radio (Lite / Connected / Full ERP) | seeds `tenant_org_config.posting_mode` |

**Fix — backend:**
1. Alembic migration: add `company_size varchar(20)` and `interested_modules jsonb`
   to `tenants` table.
2. Update `SignupRequest` schema to accept the 5 new optional fields.
3. Update `signup` endpoint: persist `phone` and `job_title` on `User`, `company_size`
   and `interested_modules` on `Tenant`, and if `posting_mode` supplied, seed it into
   `TenantOrgConfig` instead of defaulting.

**Fix — frontend:**
Add a second step to the signup form (or expand in-place after company details):

```
Step 1 (existing): Name, email, password, company name, country
Step 2 (new, optional):
  - Phone number
  - Job title
  - Company size (select)
  - "What would you like to manage?" — module checkboxes using MODULE_CATALOGUE labels
  - "How do you intend to use PRAD?" — radio:
      ○ Approval-only (Lite)  ○ Connect to existing ERP (Connected)  ○ Full finance system (Full ERP)
```

Label the second step clearly as "Help us set up your trial" so customers know
it's optional qualification info, not required account info.

**Display in SA portal (Trials page):**
The existing `trials/page.tsx` should show `company_size`, `interested_modules` (as
badge chips), and `posting_mode` preference so the consultant sees full context at a
glance without needing to enter the tenant.

---

## Issue 3 — Module list: two separate definitions

**What exists:**
- `MODULE_CATALOGUE` in `backend/app/routers/setup.py:181` — used by
  `GET /api/setup/modules` (tenant-facing). 14 modules.
- `_ALL_MODULES` in `backend/app/routers/platform.py:1120` — used by SA consultant
  config panel. 13 modules. Different label text for same keys
  (e.g. "Accounts Payable" vs "Accounts Payable (P2P)").

**Gap:** When a consultant licenses a module, the label shown in the SA panel differs
from the label the tenant sees. Updating one doesn't update the other.

**Fix:**
1. Create `backend/app/constants/modules.py` (new file):
   ```python
   MODULE_CATALOGUE: list[dict] = [
       {"key": "expense",          "label": "Expense Management"},
       {"key": "ap",               "label": "Accounts Payable"},
       {"key": "ar",               "label": "Accounts Receivable"},
       {"key": "payroll",          "label": "Payroll & HR"},
       {"key": "bank_recon",       "label": "Bank Reconciliation"},
       {"key": "budget",           "label": "Budget Engine"},
       {"key": "tax_engine",       "label": "Tax Engine"},
       {"key": "inventory",        "label": "Inventory & Warehouse"},
       {"key": "fixed_assets",     "label": "Fixed Assets"},
       {"key": "posm",             "label": "POSM Management"},
       {"key": "vendor_portal",    "label": "Vendor Portal"},
       {"key": "customer_portal",  "label": "Customer Portal"},
       {"key": "warehouse",        "label": "Warehouse / 3PL Portal"},
       {"key": "reporting",        "label": "Reporting & Analytics"},
   ]
   MODULE_KEY_TO_LABEL: dict[str, str] = {m["key"]: m["label"] for m in MODULE_CATALOGUE}
   ```
2. In `setup.py`: delete the local `MODULE_CATALOGUE` block and import from
   `app.constants.modules`.
3. In `platform.py`: delete `_ALL_MODULES` and replace all references with
   `MODULE_CATALOGUE` from `app.constants.modules` (iterate `m["key"], m["label"]`
   instead of tuple unpacking).
4. Frontend: the frontend module list is fetched from `GET /api/setup/modules` which
   uses `MODULE_CATALOGUE` — no frontend change needed once the backend is unified.

---

## Issue 4 — Tenants can activate/deactivate their own modules

**What exists:**
`PATCH /api/setup/modules` is guarded by `_require_admin`, which passes for
`power_admin`. A Tenant Power Admin can toggle any licensed module on or off from
the Setup → Modules page.

**Gap:**
Module licensing is a commercial/contractual decision made by the SA/consultant.
The tenant should not be able to turn modules on or off — they can only see which
modules are active. The consultant enables/disables through the SA portal
(Consultant Config panel on the tenant detail page).

**Fix — backend:**
Change the guard on `PATCH /api/setup/modules` from `_require_admin` to `_sa`
(super admin only). When a tenant visits Setup → Modules, they can GET the list
but cannot PATCH it.

**Fix — frontend:**
On `frontend/src/app/dashboard/business/setup/modules/page.tsx`:
- Hide or disable the Activate/Deactivate button if `user.is_super_admin` is false
  (or if the session is not an impersonation session by an SA).
- Replace the button with a message: "Contact your PRAD account manager to
  activate this module."
- The module detail panel can still render normally (description, features) — just
  without the toggle.

---

## Issue 5 — "ZivaBI Consultant" visible in tenant roles page

**What exists:**
`frontend/src/app/dashboard/business/setup/roles/page.tsx:391` renders a table row:
```tsx
<tr>
  <td>ZivaBI Consultant</td>
  <td>ZivaBI implementation team</td>
  <td>Super admin only</td>
  <td>Full — all sections, always</td>
</tr>
```
This is visible to any tenant user who opens Settings → Roles → Tiers.

**Gap:**
The `consultant` role tier was removed in M9.3c (super admin impersonation replaces
it). The table row is stale and leaks internal PRAD team structure to customers.
The "Granted by: ZivaBI Consultant" entry on the Power Admin row is also stale.

**Fix — frontend:**
- Delete the entire "ZivaBI Consultant" `<tr>` (3 lines: ~line 391–395).
- On the Power Admin row, change "Granted by: ZivaBI Consultant" to
  "Granted by: PRAD".
- On the Functional Admin row, "Consultant or Power Admin" → "Power Admin".
- Update the banner text: "Role tier structure is defined by ZivaBI. Contact your
  account manager to modify."

---

## Issue 6 — CC: audit codebase for single-source-of-truth violations

This is a standing instruction for CC to run as a one-off audit (not a feature build).

**What CC should look for and report:**

1. Any constant, list, or dict defined more than once with the same semantic meaning
   (like `MODULE_CATALOGUE` / `_ALL_MODULES` above). Check: module keys/labels,
   lifecycle status values, role tier names, country/currency maps, posting modes.

2. Any hardcoded string that duplicates a value from a model enum or DB column
   (e.g. `"trial"`, `"live"`, `"test"` as bare strings where an Enum would enforce it).

3. Any frontend component that has its own local copy of data that is also served by
   an API endpoint (e.g. a hardcoded list of modules in a `.tsx` file that doesn't
   come from `GET /api/setup/modules`).

4. Any migration that defines a column default that diverges from the ORM model's
   default (e.g. `server_default="new"` vs Python `default="active"`).

**CC output format:** A markdown report listing each violation with file + line,
the duplicated value, and a one-line recommended fix. Do not make any code changes —
report only. Save to `docs/cc_results/SOT_AUDIT_<date>.md`.

---

## Priority order

| # | Issue | Complexity | Priority |
|---|---|---|---|
| 5 | Remove consultant row from roles page | Low | Do first |
| 3 | Unify module list to single constant | Low-Medium | Do second |
| 4 | Lock module activation to SA only | Low | Do third |
| 2 | Signup form trial-intent fields | Medium | Do fourth |
| 1 | SA portal: create tenant | Medium | Do fifth |
| 6 | CC SOT audit | Investigative | Parallel with above |
