# MASTER CONTEXT — Ziva BI
> **Role of this document:** Durable decisions and rationale (the "why") — locked principles, architectural choices, milestone intent, and process guidance. This does NOT contain volatile facts.
> **For current code/schema/endpoint facts (the "what"):** see `docs/PROJECT_STATE.md`, which is the authoritative current-state snapshot and wins all conflicts on volatile matters.
> If anything in this document conflicts with PROJECT_STATE.md on a volatile fact (table columns, endpoint paths, feature status), **PROJECT_STATE.md wins**.
>
> Last updated: June 2026

---

## 1. PRODUCT VISION

Ziva BI is an intelligent, fully automated, end-to-end business operations platform for companies of every size and industry. It is a world-class, enterprise-grade SaaS product — not a demo, not a prototype.

**Mission:** Zero manual work. 100% automation. Intelligent decision-making.

**Core principles (non-negotiable):**
- Production-grade code at all times — clean, commented, scalable, modular
- Multi-tenant with full data isolation between tenants
- Every feature configurable per tenant — no hardcoded rules
- AI and OCR everywhere — baked in, not bolted on
- Performance is a feature — fast UI, optimised queries, cached where appropriate
- Drag-and-drop support everywhere files or items are moved
- PWA-enabled frontend — installable as mobile shortcut

---

## 2. TECH STACK

- **Frontend:** Next.js 15, React, TailwindCSS
- **Backend:** Python / FastAPI
- **Database:** PostgreSQL (local: `ziva_dev`)
- **File storage:** Supabase Storage
- **Auth:** JWT (access + refresh tokens)
- **Local dev:** Backend on localhost:8000, Frontend on localhost:3000
- **GitHub:** github.com/oladunmoyeadeniyi/ziva-bi
- **Deployment:** Render (when ready — not yet)

---

## 3. PORTAL ARCHITECTURE

Ziva BI has **two portals**, not one:

### 3.1 Super Admin Portal
- Used exclusively by the Ziva BI internal team
- Provisions tenants, controls module licensing, monitors usage, manages billing
- Completely separate from tenant portal
- **Not yet built**

### 3.2 Tenant Portal (one portal, three role tiers)

This is the main portal. It serves both implementation consultants and the company's own staff. Role tier determines what each person sees and can do.

#### Role Tier 1 — Consultant (Ziva BI implementation team)
- Assigned by Super Admin only
- Full access to everything in the tenant
- Can override any configuration
- Can lock/unlock sections for lower tiers
- Can impersonate any user for testing
- Every action logged against consultant account
- Sees "Implementation mode" banner
- Locked settings show lock icon + "Contact your Ziva BI consultant to modify"

#### Role Tier 2 — Power Admin (e.g. Finance Director / CFO)
- Assigned by Consultant
- Full access to all config within their tenant
- Cannot override implementation-locked settings
- Can delegate specific config rights to Functional Admins

#### Role Tier 3 — Functional Admin (e.g. HR Manager, Procurement)
- Assigned by Power Admin
- Access only to what Power Admin has delegated
- e.g. HR can manage employees but cannot touch CoA or dimensions

**Key rule:** Consultant > Power Admin > Functional Admin. Consultants can always override anything.

---

## 4. IMPLEMENTATION SETUP SEQUENCE

When a new tenant is onboarded, the consultant follows this exact sequence. Sections are locked in the UI until prerequisites are met:

1. Organisation — identity, structure (org tree + cost centers), branding, fiscal year
2. Module activation — activate/deactivate modules from full list
3. Chart of Accounts — upload via dynamic template (SOCI/SOFP, FS mappings, dimensions)
4. Dimensions — optional; define dimensions, value types, upload master data
5. Employees — upload template (pre-populated with cost centers); line managers assigned here
6. Currencies & FX — rate sources, realized/unrealized rules, revaluation
7. Tax & Statutory — VAT, WHT, PAYE, non-resident rules
8. Roles & Permissions — permission matrix, user assignments
9. Approval Workflows — per module, drag-and-drop builder
10. Document Rules — required documents per module/transaction type
11. Module Setup — one section per activated module
12. Readiness & Go-live — checklist, mark tenant live

---

## 5. COMPLETED MILESTONES

### M1 — Foundation
Database setup, project structure, base models, multi-tenant architecture.

### M2 — Authentication
JWT auth, login, signup, refresh tokens, invite flow, has_non_admin_role flag in JWT.

### M3 — Business Expense Retirement
Multi-line expense form, draft/submit flow, auto-save with PATCH (not duplicate POST).

### M4 — Approval Workflow
LM to Finance approval chain, approve/reject/refer actions, approval matrix config.

### M5 — Tenant User Management
Invite users, assign roles, deactivate users, team management page.

### M6 — Supporting Documents
File upload per expense line and per report, Supabase Storage integration.

### M7 — Expense Categories & GL Coding Mode
Three GL coding modes. All M7 bugs fixed:
- Duplicate save fixed (PATCH after first POST)
- Save Draft stays on page, redirects to edit page after first save (so attachments work)
- P/L Group hidden in finance/category_mapped modes
- Duplicate Team tab removed
- Tenant Admin is config-only (cannot submit expenses, not in approver dropdowns)

### M8 — Intelligent Expense Form Foundation
- 5 new DB tables: tenant_dimensions, dimension_values, chart_of_accounts, gl_dimension_requirements, expense_categories, category_gl_mappings
- coding_level (int 0-4) replaces gl_coding_mode enum
- show_location and require_location added to tenant_expense_config
- Admin pages: Dimensions, Chart of Accounts, Expense Categories, Expense Config
- 5 coding level cards in Expense Config

### M8.1 — Advanced CoA, Dimensions & Employee Foundation
- CoA template rebuilt: 3-sheet xlsx (GL Accounts + Dimensions Setup + Instructions)
- SOCI/SOFP account types (IFRS-aligned)
- FS Head, FS Note, TB Mapping, Group Account mapping columns
- GL Grouping, Subgroup, Sub-subgroup hierarchy
- Category/subcategory mapping per GL (one-to-many)
- Dynamic dimension columns per tenant in template
- Dimension value types (value_type column)
- Cascading dimension logic (cascade_dimension_id, cascade_value_id)
- Period activation (valid_from, valid_to on dimension values)
- Bulk actions across all master data (select, deactivate, delete, Replace All)
- Employee master data: employees, employee_code_history, employee_transfers tables
- Employee upload template (dynamically generated)
- Employee transfers and code change history
- Employee codes auto-sync as dimension values
- Cost center head config and Finance review config tables
- New admin pages: Employees, Cost Centers, Finance Review

### M9 — Intelligent Expense Form (Employee-facing)
- All 5 coding levels working on expense form
- GL popup flow: group to subgroup to GL selection (popup modal)
- Both "By Category" and "By GL Group" paths in popup
- Dimension fields render dynamically per selected GL
- When line has splits: GL and dimensions hidden on parent, live on each split row
- Dimension type filtering (only valid types per GL shown)
- Cascading dimension auto-fill with lock icon
- Incomplete line: amber border; complete line: green border
- Submit blocked until all lines complete + all documents attached
- Split lines: parent = total amount; splits subdivide it with progress bar
- AI suggestions with confidence thresholds (80%+ auto-fill, 40-79% suggestion pill)
- Drag-and-drop upload zones on line cards and report documents section
- Collapsed line shows compact summary: GL chip, amount, dimension pills, doc indicator

### M9 Bug Fixes (Rounds 1-3) — complete
- Dimension values bulk upload fixed
- Compact line cards
- Split button in line header beside amount
- Split logic corrected (subdivides parent total)
- Upload state fixed
- GL selector slim outlined style
- Collapsed line summary
- Drag-drop upload zones

---

## 6. MODULE LIST (ALL 14)

1. Expense Management (built M3-M9)
2. Accounts Payable
3. Accounts Receivable
4. Payroll & HR
5. Inventory Management
6. Fixed Assets
7. POSM Management
8. Vendor Portal
9. Customer Portal
10. Warehouse / 3PL Portal
11. Bank Reconciliation
12. Budget Engine
13. Tax Engine
14. Reporting & Analytics

---

## 7. DATABASE & API REFERENCE

> Schema (tables, columns, FKs), API endpoint paths, and feature status are volatile — they change every session. See **`docs/PROJECT_STATE.md`** for the authoritative, verified current state of all of these.

Architectural invariants that are durable decisions (the WHY):
- **Cost center source of truth:** cost centers live in `org_structure`, NOT in `dimension_values`. Both `employees.cost_center_id` and `cost_center_config.cost_center_id` FK to `org_structure.id`.
- **Currency source of truth:** functional currency, reporting currency, and enabled currencies live exclusively in `tenant_org_config`. `tenant_fx_config` holds ONLY FX mechanics (rates, revaluation rules).
- **Environment isolation:** test tenants are shadow tenants with distinct `tenant_id` values — NOT an environment column on shared tables. This was the explicit architectural choice (Option 3 in the M9 design session) over environment columns (Option 1) and schema-per-env (Option 2).
- **Tenant lifecycle direction (M9.0.1, 2026-06-29):** signup creates ONLY a test tenant; live is born second, only via explicit super-admin promotion. `parent_tenant_id` runs test→live (live points back at the test it came from) — the inverse of the original live-first/clone design. Test stays active permanently after go-live; it's never archived. See the M9.0.1 entry below (§8) for the full change.
- **Expense→GL posting is synchronous, same-transaction** at final approval. This is intentional so a GL failure rolls back the approval — no partial state.

---

## 8. CODING STANDARDS (NON-NEGOTIABLE)

### Backend
- Every file fully commented: purpose, each function, inputs/outputs, edge cases
- All foreign keys indexed
- Paginate every list endpoint (default 50 per page)
- Never SELECT * — specify columns needed
- Cache tenant config — read constantly, changes rarely
- Single DB round-trip for validation where possible
- Return field-level errors, not generic 400s

### Frontend
- No full page reload on data changes
- Debounce all search inputs (300ms)
- Lazy load heavy components
- Comma-format ALL amount fields everywhere in the app
- Drag-and-drop upload zones on all file upload areas
- Amount inputs: type="text" inputMode="decimal" with fmtCommaInput/stripCommas helpers

### Performance targets
- CoA template generation: under 3 seconds
- Suggestions endpoint: under 200ms
- GL popup category tree: loaded once on page load
- Dimension cascade lookup: cached per tenant session

---

### M8.2 — Implementation Portal Redesign ✅ COMPLETE
- Sidebar: 6-group structure (COMMON DATA | FINANCIALS | PEOPLE | WORKFLOW & ACCESS | MODULE SETUP | GO-LIVE), Tabler outline icons throughout
- Implementation Mode banner for consultant role_tier (amber, 36px, non-dismissable)
- Setup dashboard: progress bar, checklist cards with Tabler icons, correct locked/unlocked sequence per brief, green/amber/grey states
- Organisation page: all identity fields (Legal & registration, Contact & address, Group & currency), Structure tree CRUD + template download + upload, Fiscal year with period generation
- Module activation: split-panel (40/60), subscribed vs available groups, full MODULE_DETAILS per module, is_licensed enforcement (403 on unlicensed activate)
- Dimensions: 3-tab layout (Dimension setup, Master data/values, Not using dimensions?), sequence alert, not-applicable endpoint (POST /api/setup/dimensions/not-applicable)
- Dimension values: Download template button added beside Upload
- CoA: expanded Add/Edit modals (all fields: hierarchy, FS mappings, group reporting), sequence note alert
- Employees: 4-tab layout (Add employees, Employee list, Transfers & changes, Code config), 3 onboarding method cards (bulk upload, HR manual, self-onboarding invite)
- Self-onboarding: public /onboard/[token] page, invite modal, backend token flow
- api.ts: Omit<RequestInit, 'body'> fix for proper object body passing
- Alembic migration l2m3n4o5p6q7: org_structure, fiscal_periods, employee_onboarding_tokens + new columns on tenants + tenant_org_config + tenant_modules

### M8.3 — Currencies & FX ✅ COMPLETE (UI built; backend DB tables pending)

Full rebuild of the Currencies & FX implementation portal section. Four tabs:

1. **Currencies** — ISO 4217 dropdown to add active currencies per tenant; functional currency locked (IAS 21); reporting currency editable via dropdown
2. **FX Rates** — rate entry form with date, currency pair, rate type (spot / average / closing / budget); rate history table per pair
3. **Revaluation Rules** — one collapsible card per balance type (trade receivables, trade payables, cash & bank, intercompany, other). Each card: revaluation method selector, GL accounts for realized/unrealized gain/loss (CoA GL search), reversal GL preference, NGN settlement note for NGN-denominated FX. **Directional netting is the default revaluation method.** Complete/incomplete badge per card.
4. **BDC Register** — bureau de change transaction log for NGN FX compliance

Key decisions captured:
- Directional netting is the default revaluation method (not gross)
- All revaluation cards are independently collapsible
- GL selection uses live CoA search (not hardcoded lists)
- NGN-denominated FX balances show a settlement note (CBN compliance)

**Backend status:** No new DB tables yet. Currencies, FX rates, revaluation rules, and BDC entries will require a new migration (tenant_currencies, tenant_fx_rates, tenant_revaluation_rules, tenant_bdc_entries) before the backend router is wired.

---

### M8.2 Post-release Fixes ✅ COMPLETE
All committed and pushed in May 2026 session.

**Login & Auth fix** (migration `m3n4o5p6q7r8`):
- `first_name` column added to users table; auto-populated from full_name on signup and backfilled for existing rows
- Login redirects to `/dashboard/business/setup`; welcome greeting uses `first_name`
- `api.ts` body serialization fixed (pre-stringified strings no longer double-encoded)

**Functional currency auto-detection** (no migration needed):
- `COUNTRY_CURRENCY_MAP` added to `auth.py` and `setup.py`
- At business signup, a `TenantOrgConfig` row is seeded with `functional_currency` derived from `company_country`
- `_get_or_create_org` falls back to tenant's country for legacy tenants with no org config row
- `functional_currency` is protected in PATCH `/api/setup/org` via `PROTECTED_ORG_FIELDS` — can never be overwritten by user input
- Signup page shows amber functional currency preview after country selection (IAS 21 lock note)
- Organisation page reporting currency field replaced with Select dropdown (15 currencies)

**Signup page polish**:
- Country defaults to blank, auto-detected via `ipapi.co/json/` on mount with silent fallback
- "Detecting your location…" placeholder shown during geolocation; swaps to select once resolved
- Full name label: "Your full name" with helper text; placeholder changed to generic example

**Org structure — edit/delete + entity_code** (migration `n4o5p6q7r8s9`):
- `entity_code VARCHAR(100)` added to `org_structure` table — stores ERP profit centre / entity code for Legal entity nodes (e.g. Sage X3 profit centre N22341)
- Edit button on each tree node row (hover to reveal): opens Edit modal with name, node_type, cost_center_code, entity_code fields; code is read-only
- Delete button on each tree node row: soft-delete with confirmation prompt
- `entity_code` badge (blue) shown on Legal entity nodes in tree view
- `entity_code` field in Add node modal (shown only for Legal entity)
- Template generator rebuilt: 2-sheet xlsx (Instructions + Org Structure), Node Type dropdown validation, conditional formatting (amber row + red cell for Cost center nodes missing Cost Center Code, green cell when present), Entity Code column added
- Upload handler reads 7 columns (was 5); `VALID_TYPES` updated to include "Division / Business unit"

### Period Management Enhancements ✅ COMPLETE (June 2026 — commits 384fd0e → 17491da)

Full overhaul of period generation to be automatic and config-driven. No more manual FY label input.

**New DB column (migration `j6k7l8m9n0o1`):**
- `tenant_org_config.first_fiscal_year_end DATE NULL` — last day of the company's very first accounting year. When set, backend derives `fiscal_year_start_month`/`fiscal_year_start_day` automatically (next month, day 1). Validated to fall within one year of `date_of_registration`/`commencement_date`.

**Auto-generation triggers (replaces manual "Generate" section in UI):**
1. **On org settings save** (`PATCH /api/setup/org`): if current FY periods don't exist yet, silently generate them.
2. **On last period hard-close**: when every period in a FY is `HARD_CLOSED`, automatically generate the next FY (capped at current year + 1).

**New endpoint:**
- `DELETE /api/setup/periods/fiscal-year/{fiscal_year}` — delete all periods + FiscalYearState for a label. Blocked (409) if any period is `SOFT_CLOSED`, `OVERDUE`, or `HARD_CLOSED`. Intended for pre-close corrections.

**`POST /api/setup/periods/generate` changes:**
- Now delegates to shared `_generate_periods_for_year()` helper (same logic used by both triggers).
- Idempotent guard strengthened: 409 if *any* period exists for the label (was: only if HARD_CLOSED periods exist).
- Bounds enforced: year ≥ `date_of_registration.year` AND year ≤ current calendar year.
- Marked deprecated in docstring — manual use is now a fallback/override only.

**Fiscal year name format:**
- Frontend dropdown with 5 structured codes (was free-text input): `YYYY`, `FYYYYY`, `YYYY/YYYY`, `YYYY-YYYY`, `MMM YYYY - MMM YYYY`
- Live preview label shown beneath dropdown (e.g. "Preview: FY2026")
- All FY labels in the periods page (grid selector, year-end close heading, statutory close confirm) are now formatted via `formatFY()` using the tenant's stored format — not the raw stored value.

**Stub first-year logic:**
- `first_fiscal_year_end` takes precedence over the start_month/day clamp for the company's first FY.
- Subsequent FYs always use configured `fiscal_year_start_month`/`fiscal_year_start_day`.
- FY end date derived from config (day before next FY start) — never from fy_start + 12 months.

**`_build_fy_label()` helper (backend, `routers/setup.py`):**
- Handles all 5 new format codes plus legacy `{year}`/`{nextyear}`/`MMM` codes for backward compatibility.
- Used by both auto-generation triggers and `parse_fy_start_year()`.

### Period Management Hardening — duplicate-FY + stub-year fixes (2026-06-28, uncommitted)

Two bugs found after the Period Management Enhancements above shipped, both root-caused to the same pattern: deriving behavior from *configuration* instead of *actual stored data*.

1. **Duplicate fiscal years.** Changing `fiscal_year_name_format` or `fiscal_year_start_month` after periods already existed produced a new formatted FY label that didn't collide with the old one under the then-current `UQ(tenant_id, fiscal_year, period_no)` constraint — so the auto-generation triggers silently created a second, fully duplicate period set for the same calendar months. Fixed with an app-level date-range-overlap check plus a DB-level constraint change to `UQ(tenant_id, start_date)` (migration `k7l8m9n0o1p2`) — `start_date` is the one identity a period has that never changes regardless of label/format. `backend/scripts/cleanup_duplicate_periods.py` cleans existing duplicates before the migration can apply.
2. **Stub first-year (registration-truncated) gaps.** A first FY clamped to the registration date (e.g. Aug–Dec, 5 periods) had no "Year-end close" section at all, and its dropdown showed an incorrect "Jan YYYY – Dec YYYY" label. Root cause: three places hardcoded the literal `period_no == 12` (or "December") as "the final period of the year" instead of computing `MAX(period_no)` for that fiscal year — `management_close` and `get_period_checklist` in `backend/app/routers/setup.py`, and `decPeriod` in the periods page. The FY label issue was a separate root cause in the same area: `formatFY()`'s `"MMM YYYY - MMM YYYY"` format derived the range purely from configured `fiscal_year_start_month`, ignoring the period's real dates — fixed by deriving the displayed range from the earliest/latest period `start_date`/`end_date` when periods are available.

**Status:** code changes complete and verified (`ast.parse`/`py_compile` backend, `npx tsc --noEmit` frontend — zero errors). Migration applied to local DB. **Not yet committed/pushed** — see `docs/PROJECT_STATE.md` §8 for the exact file list pending commit.

### M9.0.1 — Test-first environment flow inversion (2026-06-29, uncommitted)

Reconciled the tenant environment architecture per `docs/BRIEF_M9_0_1_test_first_environment_flow.md`, flipping it from "live-first" (the original M9.0 shadow-tenant model — clone live → test at signup) to "test-first": signup now creates *only* a test tenant, and live is born second, only via an explicit super-admin promotion.

**What changed:**
- Signup (`auth.py`) creates a single tenant: `environment="test"`, `parent_tenant_id=NULL`, `lifecycle_status="in_implementation"`. No clone runs at signup.
- Direction flip: live is created second, with `live.parent_tenant_id = test.id` — the inverse of the old model, where test pointed at live.
- The Phase 3a promotion engine (`platform.py`, `/promotion/diff` + `/promotion/apply`) was unified into one bidirectional resolver (`_resolve_promotion_pair`) that handles both a tenant's first promotion (creates live, mirrors every `UserTenant` row test→live to auto-grant access, copies org/tax/fx config) and repeat promotion (existing Phase 3a CoA/dimension/account-mapping diff behavior, unchanged). Trigger remains super-admin only.
- Test environment stays active permanently after go-live — it is never archived.
- Three now-redundant promote-style endpoints were deprecated to `410 Gone` (not removed, so old clients get a clear signal): `/api/tenant/promote`, and a previously-undocumented duplicate `/api/platform/tenants/{id}/promote` found mid-implementation. `mark_go_live` (`/api/setup/go-live`) was kept but guarded — 400 if `tenant.environment != "live"`.
- Frontend: the live/test environment toggle on the platform tenant detail page only renders once a live counterpart exists; `PromotionReviewDialog` branches its copy (title, warning banner, empty-diff state, success message, footer button) between "create live" (first promotion) and "promote" (repeat) framing; the business-side go-live page now routes to the platform promotion review instead of calling the old endpoint directly.
- **Explicitly NOT done** (per the brief, locked decisions): no `environment` column added to any of the ~30 tenant-scoped tables; no transaction/audit/approval history copied in any promotion path.
- **Not yet done:** retrofit of the existing Red Bull live+test pair (created under the old direction) to the new `parent_tenant_id` direction — script written (`backend/scripts/retrofit_red_bull_test_first.py`), dry-run by default with `--apply` to commit and an automatic `pg_dump` backup first. Logic-checked against fabricated tenant shapes (no live Postgres in this sandbox to test against for real). Must run against the user's real local Postgres, unreachable from this sandbox. Until that runs, Red Bull's pair keeps the old direction (test→live) — see `docs/PROJECT_STATE.md` §7.

**Status:** code changes complete and verified (`py_compile` backend on all 5 touched files, `npx tsc --noEmit` frontend — zero errors across the whole project). Two unrelated pre-existing file-corruption issues (NUL-byte padding, stale bash-mount cache) were found and fixed in passing during verification, with no content lost. **Not yet committed/pushed.** Red Bull retrofit (task tracked separately) not started.

---

## 9. NEXT MILESTONE — M8.3 Backend + M8.4 Tax & Statutory

### M8.3 Backend (immediate — unblock the Currencies & FX UI)
The Currencies & FX UI is fully built but has no backend storage. This milestone creates the DB layer:

1. Alembic migration: `tenant_currencies`, `tenant_fx_rates`, `tenant_revaluation_rules`, `tenant_bdc_entries` tables
2. FastAPI router: `/api/setup/currencies/*` — CRUD for all four entities
3. Wire frontend API calls (currently returning mock/empty state)
4. Validation: functional currency cannot be deleted; rate pair uniqueness per date

### M8.4 Tax & Statutory
Implementation portal section for VAT, WHT, PAYE, and non-resident withholding rules. One card per tax type, configurable per tenant.

---

## 10. FUTURE MILESTONES

- M10 — OCR & Receipt Scanning (Anthropic Vision API)
- M11 — Accounts Payable
- M12 — Super Admin Portal
- M13 — Bank Reconciliation
- M14 — Accounts Receivable
- M15 — Payroll & HR
- M16 — Budget Engine
- M17 — Inventory & Warehouse
- M18 — Fixed Assets
- M19 — Tax Engine
- M20 — AI Intelligence Layer (98%+ accuracy target)
- UI Polish Milestone — global UI overhaul (do not fix UI piecemeal before this)

---

## 11. KNOWN ISSUES / TECH DEBT

> Current issues register (with severity, evidence, and fix guidance) is maintained in **`docs/PROJECT_STATE.md §8 Known Issues Register`**. Only durable, architectural-level notes belong here.

- **UI polish deferred to dedicated milestone** — do not fix UI piecemeal across feature milestones. One dedicated UI polish milestone will do a global overhaul.
- **role_tier enforcement is incomplete** — `role_tier` column exists on `user_tenants` and is included in the JWT, but full gate enforcement (blocking power_admin from overriding consultant-locked sections) is not wired end to end. Addressed in the ZIVA_BI_ROADMAP.md Phase 1 work.
- **"Invalid or expired token" errors** on some admin pages after extended sessions — restart backend + re-login resolves it. Root cause is token expiry without smooth refresh; will be addressed in a dedicated session management improvement.

---

## 12. CURRENCY SINGLE SOURCE OF TRUTH (June 2026)

Migration `f2g3h4i5j6k7` consolidated all currency identity into `tenant_org_config`:

- `tenant_org_config.functional_currency` — THE authority (protected since M8.2 post-release)
- `tenant_org_config.enabled_currencies` — NEW JSONB column: sorted list of ISO codes the tenant transacts in (e.g. `["EUR", "NGN", "USD"]`). Functional currency is always included.
- `tenant_org_config.reporting_currency` — single authority (was duplicated in fx_config; fx_config copy dropped)

`tenant_fx_config` now holds ONLY FX mechanics: `fx_rates` and `revaluation_rules`.

Dropped from `tenant_fx_config`: `functional_currency`, `additional_currencies`, `reporting_currency`.

Canonical read endpoint: `GET /api/setup/currencies` returns all three currency fields from `tenant_org_config` plus `fx_rates`/`revaluation_rules` from `tenant_fx_config`.

`PATCH /api/setup/currencies` routes `enabled_currencies` and `reporting_currency` to `org_config`; `fx_rates`/`revaluation_rules` to `fx_config`.

Bank-accounts page now reads `enabled_currencies` from the single canonical endpoint — no more multi-source merge.

---

*End of Master Context. Last updated: 2026-06-29 (M9.0.1 test-first environment flow inversion added, pending commit; last pushed commit 17491da). For current schema/endpoint/feature facts, see `docs/PROJECT_STATE.md`.*
