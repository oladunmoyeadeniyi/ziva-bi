# MASTER CONTEXT — Ziva BI
> **Role of this document:** Durable decisions and rationale (the "why") — locked principles, architectural choices, milestone intent, and process guidance. This does NOT contain volatile facts.
> **For current code/schema/endpoint facts (the "what"):** see `docs/PROJECT_STATE.md`, which is the authoritative current-state snapshot and wins all conflicts on volatile matters.
> If anything in this document conflicts with PROJECT_STATE.md on a volatile fact (table columns, endpoint paths, feature status), **PROJECT_STATE.md wins**.
>
> Last updated: 2026-07-13 (Mode-Aware Implementation Portal — sidebar + 5 pages + expense config lock; also SA portal hardening batch — see §5)

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
- **Deployment:** Render (configured — not yet deployed; currently running on localhost for development)

---

## 3. PORTAL ARCHITECTURE

Ziva BI has **two portals**, not one:

### 3.1 Super Admin Portal (Owner Portal)
- Used exclusively by the Ziva BI internal team
**Built so far:**
- Tenant lifecycle management: list/detail, lifecycle transitions, suspend/reactivate, impersonation ("enter" tenant), full test↔live promotion engine (diff + apply). Routes under `/api/platform/*`, frontend at `/platform/tenants*`.
- "Trials & signups" lead management page (`/platform/trials`): lists all `lifecycle_status='trial'` tenants, lead-status tabs (new/contacted/qualified/disqualified), inline notes, search, one-click activation to `'in_implementation'`.
- Consultant config panel on tenant detail page: set posting mode, module licenses.

**Not yet built:** Billing, self-service provisioning, Team, Audit, Support, Settings — frontend-only shells with no backend.
- Completely separate from tenant portal

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

> **Note:** `role_tier` enforcement is still partial — see §11.

---

## 3b. THREE-MODE ARCHITECTURE (core invariant — locked)

Every module supports all three modes from day one. The mode is set by the consultant in the SA Portal **before** entering the tenant. Tenants never see or change this setting.

| Mode | Description | GL posting |
|---|---|---|
| **Lite** | Workflow-only. No GL coding. Basic CSV export of approved transactions. | None |
| **Connected** | Full GL coding + dimensions in Ziva BI, posts to an **external ERP** (download or API sync). | Export queue (`posting_batches`) |
| **Full ERP** | Everything inside Ziva BI. GL posts to `journal_entries`. Financial statements in-app. | Internal GL |

### Nomenclature (locked — do not rename)
- **Lite** — not "Standalone", not "Basic", not "Simple"
- **Connected** — not "Integration Mode", not "Hybrid", not "Bridge"
- **Full ERP** — not "Enterprise", not "Advanced", not "Standard"
- Column name: `posting_mode` (on `tenant_org_config`)
- Export table: `posting_batches`

### Key principle
The employee/user experience is **identical** across all modes. GL coding fields appear when the tenant needs them. The difference is invisible at the transaction level — it only surfaces at the posting/export step.

### What each mode requires
- CoA, Dimensions, Currencies, Tax, Document Rules → **Optional** in Lite/Connected, **Required** in Full ERP
- Account Mapping (posting roles → GL accounts) → Required in Connected and Full ERP
- Posting Batches page (Connected only) — Finance sees batch queue + download/sync buttons
- Go-live gate enforces mode-specific blocking steps before activation

### Tenant lifecycle (sealed decision)
1. **Signup** → `lifecycle_status = 'trial'`; demo seed data loaded **manually** by SA team via `scripts/seed_demo_tenant.py --apply` (not automatic at signup)
2. **Consultant** sets mode + modules in SA Portal → notes on the lead
3. **Consultant clicks "Activate"** → `'in_implementation'`; enters tenant; guided setup
4. **Go-live** when all mode-required steps complete → `'active'` (live environment)
5. **Test environment** stays active permanently after go-live (never archived)

---

## 4. IMPLEMENTATION SETUP SEQUENCE

### 4.1 Pre-implementation: Consultant configuration (SA Portal)

Before entering a tenant, the consultant sets system-level config in the SA Portal tenant detail page. These settings are never exposed inside the tenant implementation pages:

- **Posting mode** (Lite / Connected / Full ERP) — determines which setup steps are required
- **Module licensing** — which modules the tenant has subscribed to
- **Integration settings** — which external ERP (Connected mode only)

### 4.2 In-tenant setup sequence (mode-aware)

The setup portal adapts to `posting_mode` + active modules. Steps are shown/hidden accordingly:

| Setup Step | Lite | Connected | Full ERP |
|---|---|---|---|
| 1. Organisation | ✅ required | ✅ required | ✅ required |
| 2. Module Activation | ✅ required | ✅ required | ✅ required |
| 3. Chart of Accounts | ❌ hidden | ✅ simplified* | ✅ full |
| 4. Dimensions | ❌ hidden | Optional | ✅ required |
| 5. Employees | ✅ required | ✅ required | ✅ required |
| 6. Currencies & FX | ❌ hidden | Optional | ✅ required |
| 7. Tax & Statutory | ❌ hidden | Optional | ✅ required |
| 8. Roles & Permissions | ✅ required | ✅ required | ✅ required |
| 9. Approval Workflows | ✅ required | ✅ required | ✅ required |
| 10. Account Mapping | ❌ hidden | ✅ required | ✅ required |
| 11. Bank Accounts | Optional | Optional | Optional |
| 12. Accounting Periods | Optional | Optional | Optional |
| 13. Document Rules | Optional | Optional | ✅ required |
| 14. Module Setup | Optional | Optional | Optional |
| 15. Readiness & Go-live | ✅ | ✅ | ✅ |

*Simplified CoA (Connected): GL code + name + account type only. No SOCI/SOFP, FS mapping, or TB mapping required. GL grouping columns (gl_group/subgroup/sub-subgroup) optional but recommended for the GL picker hierarchy tab.

**Employee unlock sequence:** after Organisation (Lite) or after CoA (Connected/Full ERP).

All sections are implemented and working; mode-aware visibility is live (task #51, commit `eac25846`).

---

## 5. COMPLETED MILESTONES

> Ordered chronologically. This section was reconciled on 2026-06-29 against the actual alembic migration chain, router registrations (`main.py`), and `docs/PROJECT_STATE.md` — several milestones below were previously undocumented or mislabeled here. See the bottom of this section for what changed.

### M1 — Foundation
Database setup, project structure, base models, multi-tenant architecture.

### M2 — Authentication
JWT auth, login, signup, refresh tokens, invite flow, has_non_admin_role flag in JWT.

### M3 — Business Expense Retirement
Multi-line expense form, draft/submit flow, auto-save with PATCH (not duplicate POST).

### M4 — Approval Workflow
LM to Finance approval chain, approve/reject/refer actions, approval matrix config.

### M4+ — Approval Enhancements
Refer-back, audit trail, immutable submission snapshots, separation-of-duties.

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
- GL popup flow: category → subcategory → GL selection (popup modal)
- Level 4: direct GL search (text search by number or name)
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

**M9 Bug Fixes (Rounds 1-3)** — dimension values bulk upload, compact line cards, split button placement, split logic correction, upload state fix, GL selector style, collapsed line summary, drag-drop zones.

### M8.2 — Implementation Portal Redesign
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

**M8.2 Post-release Fixes:**
- **Login & Auth fix** (migration `m3n4o5p6q7r8`): `first_name` column added to users table, auto-populated/backfilled; login redirects to `/dashboard/business/setup`; `api.ts` body serialization fixed
- **Functional currency auto-detection** (no migration): `COUNTRY_CURRENCY_MAP` in `auth.py`/`setup.py`; org config seeded at signup; `functional_currency` protected via `PROTECTED_ORG_FIELDS`; signup page shows IAS 21 lock preview
- **Signup page polish**: country auto-detect via `ipapi.co/json/`, full name label/helper text
- **Org structure — edit/delete + entity_code** (migration `n4o5p6q7r8s9`): `entity_code` column for ERP profit centre codes, edit/delete buttons per node, rebuilt 2-sheet template, 7-column upload

### M8.3 — Accounting Periods Engine
> **Correction (2026-06-29):** this milestone was previously mislabeled in this document as "Currencies & FX." The alembic migration chain (`m8_3_accounting_periods` → `brief2_grace_journalblock_futureexception` → `brief3_close_checklist` → `brief4_yearend_auditlog`) confirms M8.3 is the **Accounting Periods Engine**. Currencies & FX is a separate, also-completed milestone documented below.

- Period generation (monthly periods per fiscal year), grace windows, journal-block on closed periods, future-posting exceptions
- Close checklist (configurable items, prepared/approved with separation-of-duties)
- Soft close, hard close (sequential), reopen (super-admin only, audited)
- Year-end audit log, two-stage statutory close (management close → audit grace → statutory close, permanent lock)
- Tables: `accounting_periods`, `period_grace_overrides`, `future_posting_exceptions`, `close_checklist_items`, `period_checklist_completions`, `fiscal_year_states`, `period_audit_logs`

**Period Management Enhancements** (committed, June 2026 → `17491da`):
- `tenant_org_config.first_fiscal_year_end` — derives `fiscal_year_start_month`/`day` automatically for a company's first FY
- Auto-generation triggers replace manual "Generate": on org settings save, and on last-period hard-close (next FY auto-created)
- `DELETE /api/setup/periods/fiscal-year/{fiscal_year}` — delete all periods for a label, blocked if any period is closed
- Fiscal year name format: 5 structured codes with live preview (was free-text)

**Period Management Hardening** (committed `b3e70e3`, 2026-06-29):
- Fixed duplicate-fiscal-year bug: changing format/start-month after periods existed could silently create a second duplicate period set. Fixed with an app-level overlap check plus DB-level `UQ(tenant_id, start_date)` (migration `k7l8m9n0o1p2`, replacing the old `UQ(tenant_id, fiscal_year, period_no)`). `backend/scripts/cleanup_duplicate_periods.py` cleaned existing duplicates pre-migration.
- Fixed stub first-year (registration-truncated, e.g. Aug–Dec) gaps: three places hardcoded `period_no == 12` as "last period of the year" instead of `MAX(period_no)` — fixed in `management_close`, `get_period_checklist` (`backend/app/routers/setup.py`) and `decPeriod`/`formatFY` (periods page).

### Currencies & FX
Full implementation portal section, 4 tabs: Currencies (ISO 4217, functional currency locked per IAS 21, reporting currency dropdown), FX Rates (rate entry + history per pair, spot/average/closing/budget types), Revaluation Rules (per balance-type collapsible cards, directional netting default, live CoA GL search, NGN settlement note), BDC Register (bureau de change log for NGN compliance).

**Backend:** working end-to-end via `GET/PATCH /api/setup/currencies`. **Architecture note:** storage is JSONB (`tenant_org_config.enabled_currencies`, `tenant_fx_config.fx_rates`/`revaluation_rules`) rather than the originally-scoped dedicated relational tables (`tenant_currencies`/`tenant_fx_rates`/`tenant_revaluation_rules`/`tenant_bdc_entries`). This is a deliberate implementation shortcut, not a gap — see §10 for the open question of whether to migrate to dedicated tables (e.g. for BDC register volume) or keep JSONB.

### M8.4 — Tax & Statutory
Implementation portal section for VAT, WHT, PAYE, and non-resident withholding — one card per tax type, configurable per tenant. Backend: `GET/PATCH /api/setup/tax`, JSONB storage on `tenant_tax_config` (`vat_config`, `wht_config`, `paye_config`, `other_statutory`).

### GL Posting Engine & Reporting
Synchronous expense→GL posting at final approval (same transaction — a GL failure rolls back the approval). `journal_entries`/`journal_lines` tables, immutable once posted (corrections via reversing entries). Trial balance and account ledger query builders. Endpoints: `/api/gl/trial-balance`, `/api/gl/accounts/{id}/ledger`.

### Account Mapping & Bank Accounts
Posting-role catalogue (`posting_roles`) with per-tenant GL mapping (`tenant_account_mappings`), control-account overrides (super-admin only), and a bank account register (`bank_accounts`, GL must be BS/SOFP, one default per currency). Endpoints: `/api/setup/account-mapping/*`, `/api/setup/bank-accounts/*`.

### Organisation Page / Tax Restructuring (BRIEF-0, status corrected 2026-06-30)
> **Doc lapse, same pattern as the M9.0.1 retrofit:** this was scoped as "Organisation tab restructuring," carried as a pending item in §9/§10 and Cowork task #36, with no record it had shipped. Reading the actual current code (2026-06-30) confirms `docs/BRIEF-0-org-tax-restructure.md` is **fully implemented**, almost certainly landed silently alongside the M8.3/M8.4 work. No further build needed — this entry just closes the loop.

- Organisation page's Configuration tab is flattened exactly as specified: no sub-tabs, just **Financial features** then a divider then **Governance**, each with its own save button (`organisation/page.tsx`, `tab === "config"` block). No fiscal-year or tax-applicability content remains on this page.
- Fiscal year settings (`fiscal_year_start_month`/`_day`, `period_closing_frequency`, `generatePeriods`) live on the dedicated Period Management page (`frontend/src/app/dashboard/business/setup/periods/page.tsx`), confirmed by direct grep — this is the M8.3 Accounting Periods Engine page above.
- Tax applicability is the first, gating tab on the Tax & Statutory page (`frontend/src/app/dashboard/business/setup/tax/page.tsx`): `type Tab = "applicability" | "vat" | "wht" | "paye" | "other"` — matching BRIEF-0's spec exactly.

### M9.0 — Shadow Test Environment (live-first clone model)
13-step clone engine (`services/tenant_clone.py`) that, under the original design, created a test shadow tenant from a live tenant at signup. Superseded by M9.0.1's direction flip (below) — no longer invoked at signup, but still used on demand by a super admin to create a test shadow for a live tenant that doesn't already have one (e.g. a legacy/retrofitted tenant). Migration: `x4y5z6a7b8c9_m9_0_environment_architecture`.

### M9.1 — Super Admin Portal (Owner Portal) — Tenant Lifecycle Slice
Migration: `y5z6a7b8c9d0_m9_1_owner_portal`. Tenant list/detail, lifecycle transitions, suspend/reactivate, impersonation ("enter" tenant in implementation or support mode), and the unified test↔live promotion engine (diff + apply). See §3.1 for what's still missing (Billing/Trials/Team/Audit/Support/Settings).

### User Profile, Sessions & 2FA
Migration: `z6a7b8c9d0e1_profile_sessions_2fa`. Own-profile view/edit, password change, active session list with per-session revoke and "sign out everywhere else," TOTP 2FA enroll/verify/disable.

### M9.0.1 — Test-first environment flow inversion (committed `b3e70e3`, 2026-06-29)
Reconciled the tenant environment architecture per `docs/BRIEF_M9_0_1_test_first_environment_flow.md`, flipping from "live-first" (M9.0 shadow-tenant model — clone live → test at signup) to "test-first": signup creates *only* a test tenant; live is born second, only via explicit super-admin promotion.

**What changed:**
- Signup (`auth.py`) creates one tenant: `environment="test"`, `parent_tenant_id=NULL`, `lifecycle_status="in_implementation"`. No clone at signup.
- Direction flip: `live.parent_tenant_id = test.id` (inverse of the old model).
- The promotion engine (`platform.py`) was unified into one bidirectional resolver (`_resolve_promotion_pair`) handling both first promotion (creates live, mirrors `UserTenant` rows, copies org/tax/fx config) and repeat promotion (existing CoA/dimension/account-mapping diff behavior, unchanged).
- Test environment stays active permanently after go-live — never archived.
- Three redundant promote-style endpoints deprecated to `410 Gone`: `/api/tenant/promote` and a previously-undocumented duplicate `/api/platform/tenants/{id}/promote`. `mark_go_live` kept but guarded (400 if `tenant.environment != "live"`).
- **Explicitly NOT done** (locked decision): no `environment` column added to any tenant-scoped table; no transaction/audit/approval history copied in any promotion path.

**Retrofit confirmed applied (2026-06-30):** the pre-existing Red Bull live+test pair has been re-pointed to the new `parent_tenant_id` direction — confirmed via direct DB query (live tenant's `parent_tenant_id` points to the test tenant's id; the test tenant's `parent_tenant_id` is NULL). This was the last outstanding item from this milestone and is now closed. See `docs/PROJECT_STATE.md` §7 for current values.

### Default-CoA Templates (committed `7965f33`, 2026-06-30)

Lets a tenant with zero GL accounts adopt one of 3 system-managed starter Chart of Accounts (FMCG/Consumer goods, Professional services, Generic/Other — 94/76/57 GL rows respectively, 227 total) instead of building from scratch or uploading blind. New tables `coa_templates`/`coa_template_accounts` (migration `l8m9n0o1p2q3`, chained off `k7l8m9n0o1p2`) carry **no `tenant_id` column at all** — system-wide reference data, structurally impossible to leak across tenants. New `_adopt_coa_template()` service (deliberately not reusing `tenant_clone.py`'s `_clone_coa()`, which is shaped for tenant-to-tenant cloning) plus `POST /api/config/coa/adopt-template` (409 if the tenant already has any CoA row) and `GET /api/config/coa/templates` (with `suggested_template_id` from `TenantOrgConfig.industry`). Adopted accounts are ordinary, fully-editable rows from the moment they land (`locked_by_implementation=false`) — no locking. `download_coa_template()` also now pre-fills Sheet 1 from existing accounts (incl. dimension requirements) instead of returning a blank template once a tenant has ≥1 GL account. Added 3 new `account_classification` values: "Revenue — service fees" (PL), "Contract asset — unbilled revenue" / "Contract liability — deferred revenue" (BS). A 4th candidate value ("Other income") was deliberately left out — still open, non-blocking, tracked in `docs/DEFAULT_COA_TEMPLATES_DRAFT.md` §8 item 5.

> **Verification status — partial.** Migration up/down, seed row counts (94/76/57, independently cross-checked against the draft doc), and the FX/revalue parsing were confirmed by direct DB query. The two new endpoints' live HTTP behavior (`GET /coa/templates` response shape, the `POST /adopt-template` 409 gate, post-adoption PATCH/POST) and the frontend CTA/modal were verified by **code review only** — no working test-tenant JWT was available to exercise them end-to-end, and the frontend wasn't clicked through in a browser. Treat acceptance steps 2, 4, 5, 7, 8 in `docs/BRIEF_default_coa_templates.md` as unconfirmed until someone (Adeniyi, in-browser, or CC with a real test login) actually exercises the adopt-template flow on a zero-CoA tenant.

### UI Polish Milestone — Phase 1 (committed `0d55ea8`, 2026-06-30)

Code-level audit (`docs/UI_POLISH_AUDIT.md`) found 46 pages with no shared component library — 44 distinct button className variants, 2 competing page-container conventions, 11 page-title styles, plus drift in date-input handling, tab-state persistence, modal backdrops, and banner colors (findings A–H). Adeniyi signed off on tackling the highest-leverage trio first (`docs/BRIEF_ui_polish_phase1.md`). Phase 1 ships findings **A, B, C only**:

- **`Button`** (`frontend/src/components/ui/button.tsx`) — CVA-based, scaffolded against the project's already-configured-but-unused shadcn/ui setup (`components.json` existed, `src/components/ui/` didn't). Variants `primary`/`secondary`/`danger` (colors = the single most common existing string for each, not an average), sizes `default` (`min-h-[44px]`, closing the touch-target gap finding A flagged) / `sm`, built-in `loading` prop with spinner. Zero new npm dependencies — `class-variance-authority`/`clsx`/`tailwind-merge`/`lucide-react`/`radix-ui` were all already in `package.json`.
- **`PageContainer`** (`frontend/src/components/PageContainer.tsx`) — replaces both the old fixed `p-8 max-w-Nxl` convention and the old unshared-but-correct `px-4 sm:px-6 py-8 max-w-Nxl mx-auto` convention with one component, `maxWidth` prop (default `5xl`), each page's existing width preserved rather than forced uniform.
- **`PageHeading`** (`frontend/src/components/PageHeading.tsx`) — standardizes on the single most common existing `<h1>` style (`text-xl font-semibold text-gray-900`, optional subtitle). Applied across `dashboard/` pages only; pages outside `dashboard/` (auth, onboarding, landing) deliberately excluded per the brief — different visual context, audit explicitly called this a reasonable difference.

Scope boundary respected: small inline/per-row icon-only action buttons inside tables (a different use case from page-level CTAs) were deliberately left untouched, not swept into the Button rollout.

**Verification — independently re-checked 2026-06-30, holds up.** 41 files changed (matches the claim): 3 new component files + 38 pages. `package.json`/`package-lock.json` diff is empty — no new dependencies, confirmed `radix-ui` (used by the new `Button` via `Slot`) was already present pre-existing. Re-ran the audit's own greps against current code post-commit: old button/container/h1 patterns are gone from in-scope pages; the only remaining matches were (a) a stray untracked `frontend/.../setup/go-live/page.tsx.bak` backup file (not committed, harmless cruft worth deleting) and (b) `app/onboard/[token]/page.tsx`'s `<h1>`, which is correctly excluded (outside `dashboard/`). Out-of-scope small icon-action buttons confirmed still present/unchanged. `tsc --noEmit` claimed 0 errors — not independently re-run (no working node toolchain in this verification pass), code-level checks otherwise all confirm. **Findings D–H (date inputs, tab-state-on-refresh, modal backdrops, banner colors, loading states) are explicitly not part of this phase** — still open, tracked as Phase 2.

---

### UI Polish Milestone — Phase 2 (committed `300b22d`, 2026-06-30)

Brief: `docs/BRIEF_ui_polish_phase2.md`. Closes the remaining five audit findings:

- **Build D** — All `type="date"` inputs in `dashboard/` now use the locked `defaultValue` + `onBlur`-only pattern (was: 3 coexisting patterns — hybrid controlled+onChange+onBlur autosave, controlled+onChange-only, and a few bare inputs). 5 files converted: `expenses/new`, `expenses/[report_id]/edit`, `settings/employees`, `settings/dimensions/[id]/values`, `setup/organisation` (registration/commencement fields only — the already-correct fiscal-year-end field left untouched) + `setup/currencies`. Acceptance grep (`type="date"` with `value=`) returns 0 matches.
- **Build E** — Tab state now URL-synced via `useSearchParams` + `Suspense` wrapper on all 6 previously-broken tabbed pages: `approvals`, `expenses`, `setup/currencies`, `setup/periods`, `setup/roles`, `setup/tax`. Reference pattern copied from already-correct pages (`dimensions`, `organisation`, `chart-of-accounts`).
- **Build F** — Modal backdrop standardised to `bg-black/40` across `dashboard/`. `setup/organisation`'s two modals converted from `bg-black/30`. The remaining `fixed inset-0` entries without `bg-black/40` on the *outer* div were confirmed as intentional architectural exceptions: 6 use a two-element pattern (outer `fixed inset-0 z-50` for positioning + inner `absolute inset-0 bg-black/40` sibling for the dim — independently code-verified against `dimensions/page.tsx:2289` and `chart-of-accounts/page.tsx:2407`), 1 is a click-outside-to-close catcher (`dimensions:2175`, z-20), 1 is a bottom drawer (`employees:843`).
- **Build G** — New `Banner` component (`frontend/src/components/Banner.tsx`), 4 variants (`success`/`error`/`warning`/`info`) using `bg-green-50`/`bg-red-50`/`bg-orange-50`/`bg-blue-50` + matching border/text classes, optional `onDismiss` prop. Rolled out to 12 dashboard pages replacing inline banner divs.
- **Build H** — Animate-pulse skeleton loading states added to 6 previously-uncovered pages that fetch data on mount: `expenses/new`, `setup/organisation`, `setup/modules`, `setup/documents`, `setup/periods`, `setup/tax`. `modules/[module]/page.tsx` confirmed no direct data fetch (Step 0 judgment call — correctly excluded). `tsc --noEmit` → 0 errors, `npm run lint` → 0 errors (warnings only, pre-existing). Also added `eslint.config.mjs` (`next/core-web-vitals + next/typescript`) since `npm run lint` had never been wired — now it is.

**Side effects / housekeeping notes (independently verified):**
- `radix-ui ^1.6.0` added to `package.json` as a formal direct dependency — it was already in use transitively (Phase 1's `Button` imports `Slot` from it); this formalises the import, not a true new package.
- `invite/accept/page.tsx` had 1 unused import removed — minor out-of-scope touch, harmless.
- **`setup/go-live/page.tsx.bak` was accidentally committed** (256 lines, stale backup) — needs a follow-up clean-up commit (`git rm --cached` + push). Not blocking anything but messy.

---

### M9.3b — User Impersonation (committed `1a60a1c`, 2026-06-30)

Brief: `docs/BRIEF_impersonation.md` (spec: `docs/IMPERSONATION_DESIGN.md`). Extends the existing M9.3a tenant context-switch ("Enter tenant") with a deeper, user-identity-level impersonation layer. Design doc distinction: M9.3a keeps `sub = SA's own user_id`; M9.3b replaces `sub` with the **target user's** user_id so the backend sees exactly that user's permissions for every request.

**Backend (15 files, 655 insertions):**
- New `impersonation_sessions` table (`migration 5d5e730f42ac`) — append-only audit log with `impersonator_id`, `impersonator_role`, `target_user_id`, `target_tenant_id`, `environment`, `entry_point`, `started_at`, `ended_at`. FK indexes on all three ID columns.
- Two new JWT claims: `is_user_impersonation: bool`, `impersonation_session_id: UUID | None`. Decoded into `CurrentUser` dataclass.
- `POST /api/platform/tenants/{tenant_id}/users/{user_id}/impersonate` — guards (SA only, target must be active on tenant), derives target user's roles, creates `ImpersonationSession` record, mints token with target's full identity, logs `"platform.user.impersonation.started"`.
- `POST /api/platform/impersonation/{session_id}/end` — sets `ended_at`, logs `"platform.user.impersonation.ended"`. Called with the original SA token (restored by frontend before the call).
- `is_restricted_impersonation(current_user, settings)` helper — returns True for user-level impersonation + live environment + non-owner impersonator. Hook for M15 sensitive field masking; no actual masking yet (payroll/HR unbuilt).
- `OWNER_USER_ID` env var in `config.py` + `.env.example` — when set, this SA's live impersonation sessions are unrestricted (no masking).
- `EmployeeListItem.user_id: str | None` added to HR schema; `list_employees` now does a batch email→user_id lookup against the `users` table to populate it (None when employee has no portal account).

**Frontend:**
- `ImpersonationState.mode` extended: `"implementation" | "support" | "user"`. Added `sessionId` and `targetUser` fields (only set when `mode === "user"`).
- `startUserImpersonation(targetUserId, entryPoint, tenantContext?)` + `exitUserImpersonation()` in `AuthContext`. Original SA token stored in `_originalSAToken` state; restored on exit. `exitUserImpersonation` calls the backend end-session endpoint (best-effort — non-fatal if it fails).
- New `ImpersonationUserBanner` component (`frontend/src/components/ImpersonationUserBanner.tsx`) — indigo styling (distinct from existing amber/blue tenant banner), non-dismissable, shows "You are viewing as [Full Name] — [Role]" + Exit button. Stacks below the tenant-context banner when both are active.
- `hideWorkspace = !!impersonation && impersonation.mode !== "user"` — WORKSPACE + ACCOUNT sidebar groups hidden in `"implementation"`/`"support"` mode (SA doing admin work, not acting as a user), visible in `"user"` mode (SA sees exactly what the target user sees). Fixes the sidebar bug visible in the screenshot.
- Entry point 1: tenant detail page (`/platform/tenants/[id]`) → user list → indigo "Impersonate" button per active-user row. Calls `startUserImpersonation(userId, "user_list", { tenantId, tenantName, environment })` then navigates to `/dashboard/business`.
- Entry point 2: employees page (`/settings/employees`) → list → indigo "Impersonate" button per row where `emp.user_id` is set (employee has portal account). Calls `startUserImpersonation(emp.user_id, "employee_list")`.

**Independently verified 2026-06-30:** all 15 files in scope, none outside. JWT fields confirmed in `security.py` + `CurrentUser`. Both endpoints confirmed in `platform.py`. Migration creates `impersonation_sessions` with three FK indexes; downgrade drops them. `hideWorkspace` condition confirmed wired to both sidebar groups. Both entry points confirmed. `is_restricted_impersonation` at `middleware/auth.py:79`. `tsc --noEmit` + `ruff check` clean.

---

### Role Hierarchy Enhancements (commits `3d2cf71`–`68608fd`, ~2026-07-01 to 2026-07-05)

Iterative build-out of the Role Hierarchy page (`/setup/roles`) across ~12 commits:

- **Layout** — 3-column PA / FA / UA layout; chip-based role cards with HoD auto-assigned to FA tier; collapsible Unassigned Roles section (collapsed by default).
- **Role disambiguation** — roles are now distinguished by `area` + `sub_area` (not cost center) — same-name roles in different areas are correctly treated as separate roles rather than collapsed.
- **Composite key** — `(name, area, sub_area)` uniqueness on `approval_roles` prevents same-area roles from collapsing on upload/display.
- **Role-based permission assignments** — users are assigned to roles via the org role page, not a separate user tab. Permission scope is per org role.
- **Occupant avatars** — org chart nodes show initials/avatars for current occupants.
- **Org chart UX** — collapse/expand at HoD level by default; one-level expand; Expand All / Collapse All; zoom + fullscreen; `localStorage` persistence of expand state.
- **10-column employee template** — rich header tooltips, Instructions sheet, no-cache header, asterisk stripping on upload.
- **Org Role in employee upload** — employee template now includes Org Role column; upload parser maps it to the role assignment.
- **Backend** — `approval_roles` gained `sub_area`, `area`, `composite uniqueness constraint (l9m0n1o2p3q4)`, and `permission_tier (c2d3e4f5a6b7)` columns via separate migrations; `role_tier` migration ID renamed to avoid conflict.

**Key architectural decision:** Role variants are identified by `(name, area, sub_area)` — NOT by cost center or code. This allows the same role name (e.g. "Finance Reviewer") to exist in multiple areas without conflict. Cost center is a PLACEMENT attribute, not an IDENTITY attribute.

---

### Finance Review Workflow (commits `6cbbf09`, `6736981`, `57e05a8`, ~2026-07-05)

Built the Finance Review step builder UI and backend, completing the approval chain integration:

- **Model/migration** — `finance_review_steps` table (`migration b0c1d2e3f4a5`): `tenant_id`, `function_code`, `step_order`, `reviewer_type` (role/person), `reviewer_id`. Migration chained off impersonation head.
- **API** — `GET /api/setup/functions/{code}/users` for reviewer lookup. Full CRUD for steps under `/api/hr/finance-review`.
- **Frontend** — step builder UI in Finance Review settings page: drag-and-drop step ordering, add/edit/delete steps, reviewer autocomplete (role or person), function-scoped (one chain per business function).
- **Integration** — approval chain resolver uses the function mapping (§ below) to determine which finance review chain applies to each expense report.

---

### System Function Mapping (commits `290945a`, `2a6540e`, `4e9a9c4`, `7aa91bc`, ~2026-07-05)

Maps business functions to org structure nodes (departments / cost centers), which drives Finance Review chain scoping:

- **Model/migration** — `system_function_mappings` table (`migration c1d2e3f4a5b6`): `tenant_id`, `function_code` (enum: `finance`, `hr`, `procurement`, `operations`, `legal`, `sales`), `org_node_id` (FK → `org_structure`).
- **API** — full CRUD under `/api/setup/functions`. Filtering: only `department` and `cost_centre` node types are mappable (team/sub-team excluded). Cross-function exclusivity enforced (a node can only be mapped to one function).
- **Frontend** — "Function Mapping" tab on the Organisation page (`/setup/organisation`): displays function list with assigned org nodes; inline assign/unassign; node shown with code for clarity.
- **Finance Review wiring** — when an expense is submitted, the function mapping resolves which function the submitter's cost center belongs to, then looks up the corresponding finance review chain.

---

### People Module v1 — Positions + Transfers (commit `a2c0b35`, `a000794`, ~2026-07-06)

First version of the People module with Positions and enhanced employee transfer tracking:

- **Positions** — `positions` and `position_history` tables (migration `e3f4a5b6c7d8`): named positions attached to org nodes, with history tracking.
- **Employee Position Assignments** — `employee_position_assignments` table: links employees to positions, with `effective_from`/`effective_to`.
- **Transfers enhancement** — `employee_transfers` gained `change_type` (transfer/promotion/demotion/regrade/secondment/return) and `is_retrospective` fields.
- **Positions API** — full CRUD + `POST /{id}/move` + history endpoint under `/api/hr/positions`. Employees can be assigned to positions.
- **Positions frontend page** — `/settings/positions`: view all positions with occupants, role hierarchy import, assign employees.
- **Employee Transfers tab updated** — shows change_type, retrospective flag.

---

### Single Source of Truth — Positions Merged into Approval Roles (commits `71025bd`, `dcf1147`, `195cc83`, `1ddeaba`, ~2026-07-07)

Eliminated the `positions` / `position_history` tables as a separate concept. Role Hierarchy (`approval_roles`) IS the position registry:

- **Migration `f1g2h3i4j5k6`** — adds `code` and `grade` columns to `approval_roles`; retargets `employee_position_assignments.approval_role_id` → `approval_roles.id`; drops `positions`, `position_history` tables using `DROP TABLE IF EXISTS ... CASCADE` (raw SQL, transactionally safe). Rewritten to use IF EXISTS / CASCADE throughout to avoid PostgreSQL transaction aborts.
- **`employee_position_assignments`** now FKs to `approval_roles` directly — no separate positions table.
- **`/api/hr/positions`** rewritten to query `approval_roles` — transparently bridges old Positions frontend page to the new single source.
- **`/api/approvals/roles`** extended — returns `code`, `grade`, `occupant_count` per role.
- **Positions frontend page** — updated for `approval_roles` field names; Import from Role Hierarchy button generates positions from the current role hierarchy.

**Key architectural decision:** "Position" and "Role" are the same concept in Ziva BI — defined by `(name, area, sub_area)` on `approval_roles`. `code` and `grade` on `approval_roles` carry the job-grading information. No separate positions table needed.

---

### People Module Polish + Employee-User Link (commits `b8c4709`, `95a0a22`, `68a6a77`, `fd7304c`, `6458fcd`, `a656f65`, 2026-07-10/11)

Final polish on the People module plus the employee-to-user-account architecture:

**Display format changes:**
- Cost center dropdowns everywhere: changed from `CODE — Name` (em-dash) to `CODE - Name` (hyphen). Affects employee template, positions template, expenses form, SplitLinePanel, organisation page.
- Role dropdowns (app UI + XLSX template + upload parser): now show `Role Name - CC Name [Area > Sub-area]` for unambiguous identification. Upload parser accepts all variants for backward compat.
- Cost Centers nav item removed from sidebar; `settings/cost-centers/page.tsx` replaced with a redirect to `setup/organisation`.

**Employee template redesign (`b8c4709`):**
- Org Role column moved to first position and made mandatory.
- Resumption Date made mandatory (was optional).
- Employee capacity enforcement on upload (role capacity vs. current occupants).
- Role vs. cost-centre validation (role's CC must match employee's CC).
- Line Manager Email + Head of CC columns removed from template.

**Employee-User link (`6458fcd`, `a656f65`):**
- **Migration `g1h2i3j4k5l6`** — adds `employees.user_id UUID FK → users.id ON DELETE SET NULL` and `user_tenants.user_type VARCHAR(20) DEFAULT 'employee'`.
- `user_type = 'employee' | 'external'` — distinguishes internal staff from externally-invited users on a tenant.
- Employee deactivation cascades to `UserTenant.is_active = False` + session revocation.
- Employee reactivation (approve onboarding) reactivates the `UserTenant`.
- Pre-go-live hard delete: if no live-env activity → hard-delete `User` (CASCADE removes UserTenant/sessions); if live-env activity → only deactivate `UserTenant`.
- Rehire handling: `_ensure_portal_account` reactivates existing inactive `UserTenant` instead of creating a duplicate.
- SA portal tenant detail page: shows Staff/External badge (blue/amber) per user; Impersonate button gated on `is_active`.

**GitHub head after this session:** `a656f65` | **DB migration head:** `g1h2i3j4k5l6`

---

### Three-Mode Architecture — Phase 1 (committed `f24c2fe`, 2026-07-11)

Implemented the three-mode posting architecture and wired signup to create trial tenants. Full spec: `docs/BRIEF_three_mode_architecture.md`.

**Backend (committed `f24c2fe`):**
- **Migration `h1i2j3k4l5m6`** — adds `posting_mode VARCHAR(20) DEFAULT 'full_erp'` to `tenant_org_config`. Existing tenants default to `'full_erp'` — no data migration.
- **Migration `i2j3k4l5m6n7`** — creates `posting_batches` table: `id UUID PK`, `tenant_id FK→tenants CASCADE`, `batch_ref VARCHAR(50) UNIQUE`, `module VARCHAR(30)`, `status` (pending/exported/synced), `transactions JSONB`, `created_at`, `exported_at`, `synced_at`. Reference format `BATCH-{YYYY}-{MM}-{NNN}`.
- **`app/models/gl.py`** — `PostingBatch` ORM class with full docstrings.
- **`app/models/setup.py`** — `posting_mode` field added to `TenantOrgConfig`.
- **`app/schemas/posting.py`** — `PostingBatchSummary`, `PostingBatchDetail`, `TenantSystemConfig` (for consultant view).
- **`app/schemas/setup.py`** — `posting_mode: str = "full_erp"` on `OrgConfigResponse` (read-only — NOT on PATCH schemas, intentional).
- **`app/services/expense_posting.py`** — `PostingResult` dataclass (unified return: `mode`, `reference`, `journal_entry`, `posting_batch`). `post_expense_to_gl()` reads `posting_mode`, routes: lite → skip, connected → create `PostingBatch`, full_erp → existing GL journal path. Original GL path 100% unchanged.
- **`app/routers/approvals.py`** — consumes `PostingResult`; mode-aware audit log events.
- **`app/routers/posting_batches.py`** — NEW router: `GET /api/posting-batches` (list), `GET /api/posting-batches/{id}` (detail), `POST /api/posting-batches/{id}/export` (mark exported), `POST /api/posting-batches/{id}/mark-synced`.
- **`app/main.py`** — registers `posting_batches_router`.
- **`app/routers/auth.py`** — signup now creates `lifecycle_status='trial'` + `suppress_outbound_email=True`. Replaces previous `'in_implementation'` direct flow. No frontend change needed.

---

### Demo Seed Script (committed `ceb2862`, 2026-07-11)

`backend/scripts/seed_demo_tenant.py` — idempotent seeder for trial tenants. Prepopulates a fresh trial with realistic demo data so new signups immediately see a working system.

**Usage:**
```
python scripts/seed_demo_tenant.py --list-trials              # show available trial slugs
python scripts/seed_demo_tenant.py --tenant-slug <slug>       # dry run (preview only)
python scripts/seed_demo_tenant.py --tenant-slug <slug> --apply  # writes to DB
```

**Seeds (all idempotent — re-running is safe):**
- `TenantOrgConfig`: "Acme Manufacturing Limited", NGN, posting_mode=full_erp
- 4 `org_structure` cost centers: FIN, OPS, SAL, ADM
- 7 `approval_roles`: CEO, FD, FM, SA, OM, SM, HRM
- 24 `chart_of_accounts` entries (P&L + BS covering common account types)
- 12 employees (EMP-001 through EMP-012)
- 6 `expense_reports`: 2×DRAFT, 2×SUBMITTED, 1×APPROVED, 1×REJECTED

---

### SA Portal — Consultant Config Panel (#49, committed 2026-07-11)

Extended the SA portal tenant detail page with a consultant-only configuration panel. This is the "Three-Mode Phase 2 SA Portal" work from `docs/BRIEF_three_mode_architecture.md`.

**Backend:**
- **`app/schemas/platform.py`** — 3 new schemas: `ModuleLicenseItem`, `SystemConfigResponse`, `SystemConfigUpdate`.
- **`app/routers/platform.py`** — 2 new endpoints:
  - `GET /api/platform/tenants/{tenant_id}/system-config` → reads `TenantOrgConfig.posting_mode` + all `TenantModule` rows; returns `SystemConfigResponse`.
  - `PATCH /api/platform/tenants/{tenant_id}/system-config` → upserts `posting_mode`, upserts module license flags (revoking license auto-sets `is_active=False`), writes audit log. SA-only.
- Modules catalogue (`_ALL_MODULES`): 13 modules (expense, ap, ar, payroll, bank_recon, budget, tax_engine, inventory, fixed_assets, posm, vendor_portal, customer_portal, reporting).

**Frontend:**
- **`frontend/src/app/platform/tenants/[id]/page.tsx`** — new "Consultant Config" section (indigo accent, SA-only): posting mode radio cards (lite/connected/full_erp) + module license checkboxes grid + save button.

**Workflow tooling added this session:**
- **`.claude/commands/review-commit.md`** — upgraded CC slash command: Step 0 (read MASTER_CONTEXT.md), Step 5 (architectural review — security, data integrity, count correctness, query efficiency, API contract, backwards compat), Step 7 (CC writes `docs/CC_RESULT.md` so Adeniyi doesn't need to copy-paste output). Also added: unexpected-file-diff check, import-time NameError check, alembic chain validation, CC_RESULT archiving to `docs/cc_results/`.
- **`docs/CC_RESULT.md`** pattern — CC writes pass/fail result file; Cowork reads it; user says "CC finished" to resume.


---

### SA Portal — Trials & Signups Lead Management (#50, committed 2026-07-11)

New page at `/platform/trials` that gives the SA team a live queue of all trial tenants and a lightweight CRM-style workflow to manage them through to activation.

**Backend (`app/routers/platform.py`):**
- `GET /api/platform/trials` — SA-only; filters tenants by `lifecycle_status='trial'`; joins `TenantOrgConfig` for industry/company_email; subquery for user_count; ordered by `created_at desc`. Returns `list[TrialListItem]`.
- `PATCH /api/platform/trials/{tenant_id}` — updates `lead_status` and/or `implementation_notes`; 400 if tenant is not a trial; audit logged.
- **Migration `j1k2l3m4n5o6`** — adds `lead_status VARCHAR(30) NOT NULL DEFAULT 'new'` and `implementation_notes TEXT` to `tenants`; index on `lead_status`.

**Frontend (`frontend/src/app/platform/trials/page.tsx`):**
- Stats bar (total trials, new leads, contacted, qualified).
- Filter tabs by lead status + search by name/email.
- `lead_status` inline dropdown (new/contacted/qualified/disqualified) with instant PATCH.
- Expandable notes cell with save button.
- "Activate" button per row — moves tenant to `'in_implementation'` and removes from list.

---

### Setup Portal — Mode-Aware Checklist (#51, committed `eac25846`, 2026-07-11)

The setup portal checklist (`GET /api/setup/progress`) is now fully posting-mode aware — which sections are shown, which are blocking, and which unlock sequence applies all derive from `posting_mode`.

**Backend (`app/routers/setup.py`, `app/schemas/setup.py`):**
- Added `posting_mode: str = "lite"` to `ProgressResponse`.
- 5 new DB queries per progress call: `PostingRole` catalogue count, `TenantAccountMapping` count, `BankAccount` count, `AccountingPeriod` count — used to compute `account_mapping_complete` (requires ALL roles mapped, not just ≥1), `bank_accounts_complete`, `periods_complete`.
- Mode-aware `blocking_complete`: lite = base gates only; connected = base + CoA + account_mapping; full_erp = base + CoA + dimensions + account_mapping.
- Mode-aware unlock sequence: employees unlock after org (lite) or after CoA (connected/full_erp).
- Mode-aware sections list: CoA + Account Mapping shown in connected/full_erp; Dimensions shown in full_erp; Periods + Bank Accounts always optional; sections hidden in lite.

**Frontend (`frontend/src/app/dashboard/business/setup/page.tsx`):**
- New section icons: `account_mapping`, `bank_accounts`, `periods`.
- `MODE_LABELS` and `MODE_COLORS` constants.
- Mode badge rendered between page heading and progress bar.

**Known deferred (accepted):** ~12 sequential DB queries per progress call (batch before scale); no warning when `posting_mode` changes mid-setup; `dims_not_applicable` escape hatch still works in `full_erp` (consultant's responsibility).

---

### Mode-Aware Implementation Portal — Sidebar + Pages + Module Activation (2026-07-13, commits `63f61fe`, pending)

Extends task #51 (mode-aware checklist) to the sidebar nav and individual setup pages. Previously, the checklist hid steps for irrelevant modes but the sidebar and pages were mode-blind — a Lite tenant could still navigate to Chart of Accounts, Account Mapping, Tax, etc.

**What changed (frontend-only, no backend/migration changes):**

- **`frontend/src/app/dashboard/business/layout.tsx`**: Added `postingMode` state (`'lite' | 'connected' | 'full_erp' | null`). Extended `fetchOrgConfig` apiFetch type to include `posting_mode?: string` at the top level of the `/api/setup/org` response (already returned by the backend). FINANCIALS sidebar section now wraps CoA, Dimensions, Currencies & FX, Account Mapping, and Tax with `postingMode !== 'lite'` guards. Dimensions keeps the `orgConfig?.use_dimensions` sub-gate; Currencies keeps `orgConfig?.use_multi_currency`. Fallback while loading (null): all links remain visible.

- **`frontend/src/components/ModeNotAvailable.tsx`** (new): Neutral informational gate rendered by pages that are hidden in the current mode. Props: `pageName`, `availableIn[]`, `currentMode`. Shows a lock icon, descriptive message, and a "Back to setup dashboard" button.

- **5 page-level mode guards** (each fetches `posting_mode` from `/api/setup/org` — a call each page already makes or adds one): `settings/chart-of-accounts/page.tsx`, `settings/dimensions/page.tsx`, `setup/currencies/page.tsx`, `setup/tax/page.tsx`, `setup/account-mapping/page.tsx`. Guard renders `<ModeNotAvailable>` if `postingMode === 'lite'`; null (still loading) shows the page normally.

- **`settings/expense-config/page.tsx`**: Fetches `posting_mode`. In Lite mode: amber Banner above coding level cards (GL coding not available), all 5 cards greyed-out with `pointer-events-none`. Does not reset `coding_level` server-side — shows an inline note if current level > 0.

**Mode visibility table (authoritative — §4.2):**

| Section | Lite | Connected | Full ERP |
|---|---|---|---|
| Chart of Accounts | ❌ sidebar hidden + page gated | ✅ | ✅ |
| Dimensions | ❌ sidebar hidden + page gated | ✅ optional | ✅ |
| Currencies & FX | ❌ sidebar hidden + page gated | ✅ optional | ✅ |
| Tax & Statutory | ❌ sidebar hidden + page gated | ✅ optional | ✅ |
| Account Mapping | ❌ sidebar hidden + page gated | ✅ | ✅ |
| Bank Accounts | ✅ sidebar visible | ✅ | ✅ |
| Accounting Periods | ✅ sidebar visible | ✅ | ✅ |
| Expense Config coding level | Locked at 0, amber banner | ✅ | ✅ |

**Backend fix (commit `63f61fe`, same day):** `backend/app/routers/setup.py` `_org_to_response()` was building `OrgConfigResponse(...)` without passing `posting_mode=org.posting_mode`, so the field always returned the Pydantic default (`"full_erp"`) regardless of actual tenant config. One-line fix added `posting_mode=org.posting_mode` — all frontend mode guards now receive the real value.

**Mode-Aware Module Activation (pending commit, 2026-07-13):**

- **`setup/modules/page.tsx`**: Replaced ad-hoc `MODULE_REQUIRES_GL` blocklist with `MODULE_MODE_AVAILABILITY` map — 14 module keys, each declaring which posting modes can list it. Lite allowlist: `expense`, `ap`, `ar`, `tax_engine`, `reporting` only. Connected + Full ERP: all 14 modules. `isAvailableForMode()` helper drives `visibleModules` filter (unlicensed incompatible modules hidden; licensed-but-incompatible modules stay visible with deactivate-only path for mode-downgrade cleanup). `postingMode` fetched from `/api/setup/org` in `Promise.all` alongside module list.
- **`backend/app/routers/platform.py`** `create_tenant()`: seeds `TenantOrgConfig` with `legal_name=data.company_name.strip()` and `country=country` at creation time — Organisation tab now pre-populated on first entry instead of blank.
- **"Tax & Compliance" rename**: `tax_engine` label updated from "Tax Engine" in `backend/app/constants/modules.py`, `frontend/src/lib/modules.ts`, and `frontend/src/app/dashboard/business/setup/modules/[module]/page.tsx`.

**Module availability per mode (authoritative):**

| Module | Lite | Connected | Full ERP | Notes |
|---|---|---|---|---|
| Expense Management | ✅ | ✅ | ✅ | Core Lite module |
| Accounts Payable (P2P) | ✅ | ✅ | ✅ | Workflow in Lite; GL posting in Connected/Full ERP |
| Accounts Receivable (O2C) | ✅ | ✅ | ✅ | Workflow in Lite; GL posting in Connected/Full ERP |
| Tax & Compliance | ✅ | ✅ | ✅ | Transaction upload in Lite; GL reads in Connected/Full ERP |
| Reporting & Analytics | ✅ | ✅ | ✅ | Operational reports in Lite; financial statements in Connected/Full ERP |
| Payroll & HR | ❌ | ✅ | ✅ | Connected/Full ERP only |
| Bank Reconciliation | ❌ | ✅ | ✅ | Requires GL as book-side; no standalone use in Lite |
| Budget & Planning | ❌ | ✅ | ✅ | Actuals comparison requires GL |
| Inventory & Warehouse | ❌ | ✅ | ✅ | Connected/Full ERP only |
| Fixed Assets | ❌ | ✅ | ✅ | Connected/Full ERP only |
| POSM Management | ❌ | ✅ | ✅ | Connected/Full ERP only |
| Vendor Portal | ❌ | ✅ | ✅ | Connected/Full ERP only |
| Customer Portal | ❌ | ✅ | ✅ | Connected/Full ERP only |
| Warehouse / 3PL Portal | ❌ | ✅ | ✅ | Connected/Full ERP only |

---

### GL Group Hierarchy Tab in ExpenseItemPicker (#52, committed `55028cc` 2026-07-11)

Adds a "By GL Group" second tab to the expense form GL account picker for coding levels 3 and 4. The tab navigates the `gl_group → gl_subgroup → gl_sub_subgroup` hierarchy as an alternative to the Category → Subcategory flow.

**Backend (`app/schemas/config.py`, `app/routers/config.py`):**
- `GLSearchResult` extended with `gl_group`, `gl_subgroup`, `gl_sub_subgroup` optional fields (populated from `ChartOfAccount`).
- New schemas: `GLGroupSubgroup` (name, sub_subgroups, account_count), `GLGroupNode` (name, subgroups, account_count).
- New `GET /api/config/gl/groups` — returns full GL group tree in one round-trip; tenant-scoped; only includes accounts where `gl_group IS NOT NULL AND gl_group != ''`.
- `GET /api/config/gl/search` extended with optional `gl_group`, `gl_subgroup`, `gl_sub_subgroup` exact-match filter params; default limit raised from 20 → 50, max from 100 → 200.

**Frontend:**
- `ExpenseItemPicker.tsx` rewritten (312 → 733 lines). All original behavior preserved.
- New exported interfaces: `GLGroupSubgroup`, `GLGroupNode`, `SearchGLFilters`.
- New optional props: `fetchGLGroups?`, `searchGLFiltered?` — if absent, tab is hidden (backward compat).
- Adaptive drill-down: skips levels with no children; "All accounts in X" shortcut at each level; back navigation resets one level at a time. Group data cached for picker session.
- Both expense form pages (`new/page.tsx`, `edit/page.tsx`) wired with `doFetchGLGroups` + `doSearchGLFiltered`.

---

### SA Portal Hardening — Cascade Fixes (commits `d7ddea6`, `db69e51`, `3177d3d`, `83ab8b2`, 2026-07-11/12)

A series of stability fixes around the employee-user cascade and impersonation FK constraints:

- **Cascade deactivation email fallback (`d7ddea6`)** — `hr.py` cascade deactivate now handles `emp.user_id is None` gracefully (email fallback) instead of crashing. Module label names unified: `backend/app/routers/platform.py` + `setup/modules/[module]/page.tsx` updated.
- **Session revocation hotfix (`db69e51`)** — `_cascade_employee_deactivate` now correctly references `Session.user_tenant_id` (not `.user_id`). Added `backend/scripts/cleanup_orphan_employee_usertenant.py` — one-time cleanup for deactivated test-tenant users whose `UserTenant` rows were never cleaned up before the cascade was wired.
- **passive_deletes (`3177d3d`)** — `User.user_tenants` relationship gained `passive_deletes=True` to let PostgreSQL's `ON DELETE CASCADE` handle child row cleanup instead of SQLAlchemy issuing redundant DELETEs.
- **ImpersonationSession nullable FKs (`83ab8b2`, migration `m1n2o3p4q5r6`)** — `impersonation_sessions.user_id` and `tenant_id` FK columns made nullable (`SET NULL` on CASCADE) so a hard-deleted user or tenant no longer blocks the FK constraint. ORM model updated to match.

---

### Nuke Tenant — Full Hard Delete (commit `946aa16`, 2026-07-12)

SA-only endpoint to permanently destroy a tenant and all its data. Intended for test tenants, orphan trials, and QA cleanup.

**Backend (`app/routers/platform.py`):**
- `DELETE /api/platform/tenants/{tenant_id}` — hard-deletes the tenant and CASCADE-removes all child rows. Guards: SA-only. Request body: `NukeTenantRequest { confirmation_slug: str, confirm_live_delete: bool }`. Live-lifecycle tenants require `confirm_live_delete=True` (not blocked outright). Writes final audit log entry before deletion.
- `backend/scripts/purge_test_tenant_users.py` — companion cleanup script for deactivated test-tenant user accounts.

**Frontend (`platform/tenants/[id]/page.tsx`):**
- "Delete Tenant" danger button (red, SA-only). Two-step confirmation modal: type tenant slug to confirm, then hard-delete. On success, navigates back to `/platform/tenants`.

---

### Nuke Paired Environments (commit `c6d05ee`, 2026-07-12)

Extended nuke to delete both sides of a test+live pair in a single operation:

- `DELETE /api/platform/tenants/{tenant_id}` now resolves the environment pair (`_resolve_promotion_pair`) and deletes both the test and live tenants in one transaction. Guards: still cannot nuke if lifecycle is `'live'` on the LIVE side (i.e. tenant is in production).
- Frontend: "Delete Tenant" modal updated — when a paired environment is detected, the modal warns "This will also delete the paired [live/test] environment."

---

### SA Portal UX Hardening — Create Company + 2-step Signup + Module SOT (commits `336e7b4`, `d596f14`, 2026-07-12)

Major SA portal and signup overhaul:

**Migration `n2o3p4q5r6s7` (tenant_trial_lead_fields):**
- Adds `company_size VARCHAR(50)` and `interested_modules JSONB` to `tenants`. These are captured at signup to help the SA team qualify leads.

**Backend:**
- `backend/app/constants/modules.py` — `_ALL_MODULES` dict (single source of truth for module codes + display names + descriptions). `backend/app/constants/__init__.py` created.
- `app/routers/platform.py` — new `POST /api/platform/tenants` endpoint: SA creates a company directly (name, country, admin email, admin password, posting mode, modules). Auto-creates the test tenant + `TenantOrgConfig` + `power_admin` `UserTenant` with `must_change_password=True`. Sets the environment toggle default correctly. Audit-logged.
- `app/routers/setup.py` — module activation now checks `is_licensed` AND `is_super_admin` — only SA can toggle module activation (tenants can see but not change).
- `app/schemas/auth.py` — signup schema extended with `company_size` and `interested_modules`.
- `app/schemas/platform.py` — `CreateTenantRequest`, `CreateTenantResponse`.

**Frontend:**
- `auth/signup/page.tsx` — 2-step form: Step 1 = company basics + account creation; Step 2 = intent fields (company size, modules of interest). Both fields optional, stored on `tenants` row.
- `platform/tenants/page.tsx` — "Create Company" button + modal with name, country, admin email, password (show/hide + generator), posting mode selector, module checkboxes. On submit: `POST /api/platform/tenants`.
- `dashboard/business/setup/modules/page.tsx` — module activation toggle now SA-only (locked for tenant users — shows lock icon + "contact your Ziva BI consultant").
- `dashboard/business/setup/roles/page.tsx` — "ZivaBI Consultant" system role row removed from the visible role list (SA-internal, not relevant to tenant admins).
- `lib/modules.ts` — module list now imports from the shared SOT; labels unified everywhere.
- `d596f14` follow-up: fixed Create Company environment toggle default + corrected remaining module SOT label inconsistencies.

---

### Password Force-Change on First Login + Posting Mode Guard + SA Portal Polish (pending commit `o3p4q5r6s7t8` batch, 2026-07-13)

Five improvements shipped together:

**1. Generic Organisation page placeholder** — removed personal employer name ("Red Bull Nigeria Limited") from legal name field placeholder; replaced with "e.g. Acme Corporation Limited".

**2. Create Company password UX** — show/hide toggle (eye icon) + "Generate" button (cryptographically random 12-char via `crypto.getRandomValues`; auto-copies to clipboard; auto-reveals in plaintext so SA can share). Helper text: "The admin will be required to change this on first login."

**3. Force-change-password on first login:**
- **Migration `o3p4q5r6s7t8`** — adds `must_change_password BOOLEAN NOT NULL DEFAULT false` to `user_tenants`.
- **`UserTenant` model** — `must_change_password: Mapped[bool]`.
- **Login response** — `must_change_password: bool = False` added to `AuthResponse`.
- **`ChangePasswordRequest` schema** + `POST /api/auth/change-password` endpoint: verifies current password, rejects same-as-current, hashes new password, sets `must_change_password = False`, commits.
- **`create_tenant` (platform.py)** — sets `must_change_password=True` on the auto-created `power_admin` `UserTenant`.
- **Login page** — destructures `must_change_password` from login response; if true, redirects to `/auth/change-password` before any dashboard route.
- **`/auth/change-password` (NEW page)** — amber "Action required" banner; fields for temp password, new password, confirm; calls `POST /api/auth/change-password`; on success redirects to `/platform` (SA) or `/dashboard`; cannot be skipped.

**4. Posting mode guard** — `PATCH /api/platform/tenants/{id}/system-config` now queries `journal_entries` before allowing a posting mode switch. If the tenant has any posted journal entries, returns `409 Conflict: "Cannot switch posting mode … already has posted journal entries."` NetSuite/SAP lock posting mode at provisioning; this guard enforces the same invariant.

**5. Collapsible tenant user list** — Users section on `/platform/tenants/[id]` is collapsed by default (`useState(false)`). Header is a clickable toggle button showing total + active user counts. Chevron rotates on expand. Filter bar + table only rendered when expanded.

> **CC review notes (commit `7989709`, 2026-07-13):**
> - `ImpersonationSession.environment` widened `String(10)→String(20)`, `entry_point` `String(30)→String(50)`, Python-side `default=` values added. No new migration for these column-length increases — minor model/migration drift. Non-blocking (existing values are short strings); run `alembic revision --autogenerate` if strict alignment is needed before Render deploy.
> - `create_tenant`'s audit log payload dropped `slug`, `posting_mode`, and `initial_modules` fields — smaller audit trail than intended but not functional. Fix next time `create_tenant` is touched.
> - Non-blocking UI drift (not blocking compile): Consultant Config "Save" button uses raw `<button>` instead of shared `Button` component (loses standardized spinner); `tenants/page.tsx` table uses `<a href>` instead of `Link`, and lost Badge-styled lifecycle-status pill and tenant-count summary footer. Carry forward for UI polish pass.

---

### SA Portal — is_internal flag + Create Company modal enhancements + MODULE_MODE_AVAILABILITY centralisation (pending commit, 2026-07-13)

Three improvements bundled in one commit (migration `p4q5r6s7t8u9`, all 7 files verified clean):

**1. `is_internal` flag on tenants:**
- **Migration `p4q5r6s7t8u9`** — adds `is_internal BOOLEAN NOT NULL DEFAULT FALSE` to `tenants`. Also resolves the previously-reported two-head state to a single head.
- **`Tenant` model** — `is_internal: Mapped[bool]` with `server_default="false"`.
- **`TenantListItem` schema** — `is_internal: bool` added to the list-endpoint response shape.
- **`CreateTenantRequest` schema** — `is_internal: bool = False` (SA-settable at creation; defaults false).
- **`platform.py`** `list_tenants()` and `create_tenant()` wired through.
- Use: Ziva BI internal sandbox/demo tenants (e.g. the Red Bull build-verification company) are marked `is_internal=True` so they can be excluded from commercial reporting and clearly distinguished in the SA portal.

**2. `MODULE_MODE_AVAILABILITY` centralised to `lib/modules.ts`:**
- Moved from an inline constant in `setup/modules/page.tsx` to `frontend/src/lib/modules.ts` as a named export.
- `setup/modules/page.tsx` now imports it — no change in runtime behaviour, one source of truth.
- Create Company modal imports from the same location.

**3. Create Company modal enhancements:**
- **is_internal toggle** — purple on/off switch at the top of the form. Resets to false on modal close. Sent as `is_internal` in the POST body.
- **Mode-filtered module checkboxes** — module list only renders modules compatible with the selected posting mode (using `MODULE_MODE_AVAILABILITY`). Switching mode auto-deselects any already-checked modules that are incompatible with the new mode.
- **autoComplete fix** — admin email: `autoComplete="off"`; admin password: `autoComplete="new-password"`. Prevents browser from injecting SA's own saved credentials into the Create Company form.
- **Tenant list badge** — purple "internal" chip displayed next to the tenant name for any row where `is_internal === true`.

---

### What changed in this reconciliation (2026-06-29)

This section was significantly out of date relative to shipped code. Fixed:
- M8.3 was mislabeled as "Currencies & FX" — corrected to Accounting Periods Engine (the migration chain proves this).
- Currencies & FX, M8.4 Tax & Statutory, GL Posting Engine, Account Mapping & Bank Accounts, the Super Admin Portal tenant-lifecycle slice, and Profile/Sessions/2FA were fully built but had no entry anywhere in this document.
- Period Management Enhancements/Hardening and M9.0.1 were marked "uncommitted" — both are now committed and pushed (`b3e70e3`, confirmed against `origin/main`).
- §9/§10 (below) were rewritten to reflect the real next milestone instead of the now-completed M8.3 Backend / M8.4 Tax items.

---

## 6. MODULE LIST

> **Internal module codes** (used in `TenantModule.module_code`, `posting_batches.module`, licence catalogue): `expense`, `ap`, `ar`, `payroll`, `bank_recon`, `budget`, `tax_engine`, `inventory`, `fixed_assets`, `posm`, `vendor_portal`, `customer_portal`, `reporting`. All 13 codes are registered in `_ALL_MODULES` in `platform.py`. The display names below are the user-facing names shown in the SA portal and any tenant-facing module pages.

| # | Display Name | Internal Code | Status | All Modes |
|---|---|---|---|---|
| 1 | Expense Management | `expense` | ✅ Built (M3–M9 + #52) | ✅ |
| 2 | Accounts Payable (P2P) | `ap` | ⏳ M11 | ✅ |
| 3 | Accounts Receivable (O2C) | `ar` | ⏳ M14 | ✅ |
| 4 | Payroll & HR | `payroll` | ⏳ M15 | ✅ |
| 5 | Inventory Management | `inventory` | ⏳ M17 | ✅ |
| 6 | Fixed Assets | `fixed_assets` | ⏳ M18 | ✅ |
| 7 | POSM Management | `posm` | ⏳ Future | ✅ |
| 8 | Vendor Portal | `vendor_portal` | ⏳ Future | ✅ |
| 9 | Customer Portal | `customer_portal` | ⏳ Future | ✅ |
| 10 | Bank Reconciliation | `bank_recon` | ⏳ M13 | ✅ |
| 11 | Budget & Planning | `budget` | ⏳ M16 | ✅ |
| 12 | Tax Engine | `tax_engine` | ⏳ M19 | ✅ |
| 13 | Reporting & Analytics | `reporting` | ⏳ M20 | ✅ |

> **Module naming rationale:**
> - "Accounts Payable (P2P)" — P2P = Purchase to Pay, the end-to-end process. AP handles supplier invoices, payment runs, and vendor account management.
> - "Accounts Receivable (O2C)" — O2C = Order to Cash. AR is the **financial** module: invoicing, credit control, collections, ageing, cash receipts. It is NOT a CRM. CRM (customer relationships, sales pipeline, leads) would be a separate future module if added.
> - "Budget & Planning" — not "Budget Engine". The "& Planning" signals it covers forward-looking planning, not just budget entry.
> - "Warehouse / 3PL Portal" (previously listed as module 14) has no internal code in the licence catalogue — it is either a sub-feature of Inventory Management or a future separate module, to be decided when that module is scoped.

---

## 7. DATABASE & API REFERENCE

> Schema (tables, columns, FKs), API endpoint paths, and feature status are volatile — they change every session. See **`docs/PROJECT_STATE.md`** for the authoritative, verified current state of all of these.

Architectural invariants that are durable decisions (the WHY):
- **Cost center source of truth:** cost centers live in `org_structure`, NOT in `dimension_values`. Both `employees.cost_center_id` and `cost_center_config.cost_center_id` FK to `org_structure.id`.
- **Currency source of truth:** functional currency, reporting currency, and enabled currencies live exclusively in `tenant_org_config`. `tenant_fx_config` holds ONLY FX mechanics (rates, revaluation rules).
- **Environment isolation:** test tenants are shadow tenants with distinct `tenant_id` values — NOT an environment column on shared tables. This was the explicit architectural choice (Option 3 in the M9 design session) over environment columns (Option 1) and schema-per-env (Option 2).
- **Tenant lifecycle direction (M9.0.1, 2026-06-29):** signup creates ONLY a test tenant; live is born second, only via explicit super-admin promotion. `parent_tenant_id` runs test→live (live points back at the test it came from) — the inverse of the original live-first/clone design. Test stays active permanently after go-live; it's never archived.
- **Expense→GL posting is synchronous, same-transaction** at final approval. This is intentional so a GL failure rolls back the approval — no partial state.
- **Three-mode architecture (2026-07-11 — see `docs/BRIEF_three_mode_architecture.md`):** Every module supports three posting modes: `'lite'` (workflow-only, no GL), `'connected'` (GL coding in Ziva, posts to external ERP via export), `'full_erp'` (GL posts internally). Mode is set by the consultant in SA portal (`tenant_org_config.posting_mode VARCHAR(20) DEFAULT 'full_erp'`) — tenants never see this setting. The `posting_batches` table is the export queue for Connected Mode. Existing tenants default to `'full_erp'` — no migration of existing data.
- **Module independence:** every module must work standalone. A company subscribing to only one module (e.g. only expense management, only AP) should be production-ready within the hour. CoA/Dimensions/Currencies/Tax are OPTIONAL in Lite/Connected mode and REQUIRED in Full ERP mode. The setup portal shows/hides steps based on `posting_mode` + active modules.
- **Signup = trial lead (2026-07-11):** the business signup page creates `lifecycle_status = 'trial'`, NOT `'in_implementation'`. Trials get demo seed data. The SA portal "Trials & signups" page is the lead management queue. Consultants activate implementation manually after qualification. This is a one-line change to the signup router.
- **Consultant config lives in SA portal:** posting mode, module licensing, integration settings (which external ERP) — all set by the consultant in the SA portal tenant detail page BEFORE "Enter Tenant." These are never exposed inside the tenant implementation pages.
- **Document security invariants (2026-07-11 — shipped tasks #53–#55 + DOCX/XLSX, see `docs/BRIEF_document_storage_security.md`):** (a) Signed URLs expire in 15 minutes. (b) All uploads SHA-256 hashed; `file_hash` + `file_hash_algorithm` stored in `expense_documents`. (c) Magic bytes + ZIP structure validation — Content-Type header never trusted; DOCX/XLSX validated by inspecting `word/document.xml` / `xl/workbook.xml`; macro-enabled variants (`vbaProject.bin`) rejected. (d) Images compressed to WebP via Pillow; PDFs compressed via pikepdf (>5 % savings threshold). (e) Hash dedup within tenant — same file reuses Supabase blob, only stores `dedup_ref`. (f) `retain_until` = 15-year minimum (SA-configurable per tenant via `tenant_org_config.document_retention_years`); deletion blocked if `retain_until > today()` or IS NULL. (g) `document_access_log` table logs upload/view/delete events with IP. (h) Dedup-safe delete: blob kept if other rows share `storage_path`. (i) Cloudflare R2 is the target storage provider (zero egress) — migrate when tenants > 5 or storage > 5 GB.

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

## 9. NEXT MILESTONE

> M8.3 Backend and M8.4 Tax & Statutory (the previous contents of this section) are both **done** — see §5. This section is rewritten to reflect the real current priority queue, in recommended build order.

### Immediate (cleanup / consolidation, before new features)
1. ~~Resolve `organisation/page.tsx` working-tree diff~~ — **Resolved 2026-06-30.** The apparent ~1,500-line rewrite was almost entirely CRLF/LF noise (no `core.autocrlf` normalization on that diff). The real change was 7 lines, two hunks: (a) the `first_fiscal_year_end` date-picker upper bound widened from `+1 year` to `+2 years` with matching help text, and (b) that same date input switched from controlled (`value=`) to the locked uncontrolled pattern (`defaultValue=` + a `key` prop keyed on tenant id) — see §11/rule 5 in workflow guidance. Both changes are correct and consistent with already-decided patterns; committed alongside this doc update.
2. ~~Organisation tab restructuring~~ — **Resolved 2026-06-30 (was already shipped, doc lapse).** Confirmed via direct code read that `docs/BRIEF-0-org-tax-restructure.md` is fully implemented — see §5 "Organisation Page / Tax Restructuring." No build work needed, only this doc closure.
3. ~~Verify CoA PL/BS filter~~ — **Resolved 2026-06-30, commit `2eda43f`.** Real bug, not a doc lapse: `InlineNewAccountFields` (Remap codes → "Create new" inline account) had no validator normalising `account_type` to canonical `SOCI`/`SOFP`, so it could store literal `"PL"`/`"BS"`, which broke the CoA Dimension Matrix tab's filter (raw `===` against hardcoded `SOCI`/`SOFP`). Fixed: validator added to `InlineNewAccountFields`; Dimension Matrix filter now uses `normaliseAccountType()`; `/coa/fs-mappings`'s unnormalised `account_type` filter fixed via a shared `_account_type_filter_clause()` helper also used by `list_coa`. DB check confirmed zero existing rows had literal `PL`/`BS` stored — no backfill needed.
4. ~~UI Polish Milestone~~ — **Fully shipped 2026-06-30.** Phase 1 (commit `0d55ea8`, findings A/B/C) and Phase 2 (commit `300b22d`, findings D–H) both done and independently verified — see §5 for both entries.
5. ~~Default-CoA feature~~ — **Shipped 2026-06-30, commit `7965f33`** — see §5 "Default-CoA Templates." Core DB-level facts verified; live endpoint/UI smoke test still outstanding (not blocking, but do it before treating this as fully closed).
6. ~~M9.3b — User Impersonation~~ — **Shipped 2026-06-30, commit `1a60a1c`** — see §5 "M9.3b User Impersonation."

### Next feature work (in this order)

6. **Three-Mode Architecture** — ✅ ALL THREE PHASES DONE: Phase 1 (commit `f24c2fe`, backend infrastructure), Phase 2 (committed, SA portal consultant config panel #49), Phase 3 (committed: Trials & signups SA page #50, mode-aware setup portal #51, GL Group picker tab #52 — commit `55028cc`). Full spec: `docs/BRIEF_three_mode_architecture.md`.
7. ~~**Document Security Hardening Phase 1**~~ — **✅ DONE** (5 commits: `23ff91d`, `634d93a`, `6f9e752`, `5924b08`, `3dc5f1f`, 2026-07-11). Magic bytes + ZIP structure validation, SHA-256, Pillow/pikepdf compression, dedup, 15-year retention (SA-configurable), `document_access_log`, DOCX/XLSX with macro rejection. Phase 2 (Cloudflare R2 migration) pending.
8. **Confirm Currencies & FX / BDC completeness** — decide whether the JSONB-based implementation is final or whether BDC register volume justifies moving to dedicated tables.
9. **Super Admin Portal backend completion** — build Billing (incl. payment provider integration), self-service Trials/provisioning, Team, Audit, Support, Settings. Currently frontend-only stubs (§3.1).
10. **M11 — Accounts Payable (P2P)**, then **M13 — Bank Reconciliation**, **M14 — Accounts Receivable (O2C)**, **M16 — Budget & Planning**, **M19 — Tax Engine**, **M10 — OCR & Receipt Scanning**, **M15 — Payroll & HR**, **M17 — Inventory Management**, **M18 — Fixed Assets**, **M20 — AI Intelligence Layer**, in that order (see §10).

**Also completed since last §9 rewrite (now closed):**
- ~~Role Hierarchy Enhancements~~ — **Done** (commits `3d2cf71`–`68608fd`, ~2026-07-01 to 2026-07-05). See §5.
- ~~Finance Review Workflow~~ — **Done** (commits `6cbbf09`–`57e05a8`, ~2026-07-05). See §5.
- ~~System Function Mapping~~ — **Done** (commits `290945a`–`7aa91bc`, ~2026-07-05). See §5.
- ~~People Module v1 (Positions + Transfers)~~ — **Done** (commits `a2c0b35`, `a000794`, ~2026-07-06). See §5.
- ~~Single Source of Truth merge (Positions → approval_roles)~~ — **Done** (commits `71025bd`–`1ddeaba`, ~2026-07-07). See §5.
- ~~People Module Polish + Employee-User Link~~ — **Done** (commits `b8c4709`–`a656f65`, 2026-07-10/11). See §5.
- ~~SA Portal Consultant Config Panel (#49)~~ — **Done** (committed 2026-07-11). See §5.
- ~~SA Portal Trials & Signups page (#50)~~ — **Done** (committed 2026-07-11). See §5.
- ~~Setup Portal mode-aware checklist (#51)~~ — **Done** (commit `eac25846`, 2026-07-11). See §5.
- ~~GL Group hierarchy tab in ExpenseItemPicker (#52)~~ — **Done** (commit `55028cc`, 2026-07-11). See §5.
- ~~Document Security Hardening Phase 1 (#53–#55 + DOCX/XLSX)~~ — **Done** (5 commits ending `3dc5f1f`, 2026-07-11). 15-min signed URLs, magic bytes + ZIP validation, SHA-256, Pillow/pikepdf compression, hash dedup, 15yr retention, `document_access_log`, DOCX/XLSX macro guard.
- ~~SA Portal Hardening — Cascade Fixes~~ — **Done** (commits `d7ddea6`, `db69e51`, `3177d3d`, `83ab8b2`, 2026-07-11/12). Email fallback, session revocation hotfix, passive_deletes, impersonation FK nullable. See §5.
- ~~Nuke Tenant — Full Hard Delete~~ — **Done** (commit `946aa16`, 2026-07-12). `DELETE /api/platform/tenants/{id}` + confirmation modal. See §5.
- ~~Nuke Paired Environments~~ — **Done** (commit `c6d05ee`, 2026-07-12). Single operation deletes both test+live pair. See §5.
- ~~SA Portal UX Hardening (Create Company + 2-step Signup + Module SOT)~~ — **Done** (commits `336e7b4`, `d596f14`, 2026-07-12). `POST /api/platform/tenants`, 2-step signup, `_ALL_MODULES` SOT, SA-only module toggle. Migration `n2o3p4q5r6s7`. See §5.
- ~~Force-change-password + Posting mode guard + SA Portal Polish~~ — **Done** (commit `7989709`, 2026-07-13). Migration `o3p4q5r6s7t8`. 5 features: generic placeholder, password UX, force-change, posting mode 409 guard, collapsible user list. Run `alembic upgrade head` needed locally. See §5.

---

## 10. FUTURE MILESTONES (recommended order)

1. ~~**Three-Mode Architecture Foundation**~~ — **✅ DONE** (Phases 1-3 shipped 2026-07-11; all four tasks committed). See §5.
2. ~~**Document Security Hardening Phase 1**~~ — **✅ DONE** (2026-07-11). Phase 2: Cloudflare R2 migration when tenants > 5 or storage > 5 GB.
3. Currencies & FX / BDC completeness decision
4. Super Admin Portal backend completion (Billing, Trials, Team, Audit, Support, Settings)
5. M11 — Accounts Payable (P2P)
6. M13 — Bank Reconciliation
7. M14 — Accounts Receivable (O2C)
8. M16 — Budget & Planning
9. M19 — Tax Engine
10. M10 — OCR & Receipt Scanning (Anthropic Vision API)
11. M15 — Payroll & HR
12. M17 — Inventory Management
13. M18 — Fixed Assets
14. M20 — AI Intelligence Layer (98%+ accuracy target)

### Infrastructure (do in parallel with feature work, not as a blocker)
- Upgrade Render PostgreSQL to Standard ($50/month) — before launch
- Audit all `(tenant_id, ...)` composite DB indexes — as part of Three-Mode migration
- Redis caching for tenant config (org_config, modules, dimensions) — at 10+ tenants
- Cloudflare R2 migration — before > 5 tenants or > 5 GB stored (see §7 invariants)

---

## 11. KNOWN ISSUES / TECH DEBT

> Current issues register (with severity, evidence, and fix guidance) is maintained in **`docs/PROJECT_STATE.md §8 Known Issues Register`**. Only durable, architectural-level notes belong here.

- **UI polish deferred to dedicated milestone** — do not fix UI piecemeal across feature milestones. One dedicated UI polish milestone will do a global overhaul.
- **role_tier enforcement is incomplete** — `role_tier` column exists on `user_tenants` and is included in the JWT, but full gate enforcement (blocking power_admin from overriding consultant-locked sections) is not wired end to end.
- **"Invalid or expired token" errors** on some admin pages after extended sessions — restart backend + re-login resolves it. Root cause is token expiry without smooth refresh; will be addressed in a dedicated session management improvement.
- **Documentation maintenance lapsed** — the rule in `CLAUDE.md` ("update MASTER_CONTEXT.md after every completed milestone") was not followed for roughly 10 consecutive milestones, which is why this document required the 2026-06-29 reconciliation in §5. Going forward, every completed milestone gets an entry here in the same session it ships, not retroactively.

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

*End of Master Context. Last updated: 2026-07-13 (is_internal flag + MODULE_MODE_AVAILABILITY centralisation + Create Company modal enhancements; pending commit). Last pushed commit: `63f61fe`. All migrations applied; run `alembic upgrade head` locally if not done. For current schema/endpoint/feature facts, see `docs/PROJECT_STATE.md`.*
