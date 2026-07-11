# MASTER CONTEXT — Ziva BI
> **Role of this document:** Durable decisions and rationale (the "why") — locked principles, architectural choices, milestone intent, and process guidance. This does NOT contain volatile facts.
> **For current code/schema/endpoint facts (the "what"):** see `docs/PROJECT_STATE.md`, which is the authoritative current-state snapshot and wins all conflicts on volatile matters.
> If anything in this document conflicts with PROJECT_STATE.md on a volatile fact (table columns, endpoint paths, feature status), **PROJECT_STATE.md wins**.
>
> Last updated: 2026-07-11 (Three-Mode Architecture + Document Security decisions + implementation Phase 1 — see §5, §7, §9, §10)

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

### 3.1 Super Admin Portal (Owner Portal)
- Used exclusively by the Ziva BI internal team
- **Partially built.** Tenant lifecycle management is live and working: list/detail, lifecycle transitions, suspend/reactivate, impersonation ("enter" tenant), and the full test↔live promotion engine (diff + apply). Routes under `/api/platform/*`, frontend at `/platform/tenants*`.
- **Not built:** Billing, Trials (self-service provisioning), Team, Audit, Support, Settings. These have frontend page shells at `/platform/billing`, `/platform/trials`, `/platform/team`, `/platform/audit`, `/platform/support`, `/platform/settings` but **no backend at all** — no routes, no models, no Stripe/payment integration. See §10 (Super Admin Portal backend completion).
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

All 12 sections above are implemented and working (see PROJECT_STATE.md §4.11, §6).

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

### SA Portal — Consultant Config Panel (#49, uncommitted, pending CC review 2026-07-11)

Extended the SA portal tenant detail page with a consultant-only configuration panel. This is the "Three-Mode Phase 2 SA Portal" work from `docs/BRIEF_three_mode_architecture.md`.

**Backend (uncommitted):**
- **`app/schemas/platform.py`** — 3 new schemas: `ModuleLicenseItem`, `SystemConfigResponse`, `SystemConfigUpdate`.
- **`app/routers/platform.py`** — 2 new endpoints:
  - `GET /api/platform/tenants/{tenant_id}/system-config` → reads `TenantOrgConfig.posting_mode` + all `TenantModule` rows; returns `SystemConfigResponse`.
  - `PATCH /api/platform/tenants/{tenant_id}/system-config` → upserts `posting_mode`, upserts module license flags (revoking license auto-sets `is_active=False`), writes audit log. SA-only.
- Modules catalogue (`_ALL_MODULES`): 13 modules (expense, ap, ar, payroll, bank_recon, budget, tax_engine, inventory, fixed_assets, posm, vendor_portal, customer_portal, reporting).

**Frontend (uncommitted):**
- **`frontend/src/app/platform/tenants/[id]/page.tsx`** — new "Consultant Config" section (indigo accent, SA-only): posting mode radio cards (lite/connected/full_erp) + module license checkboxes grid + save button. State: `sysConfig`, `sysConfigSaving`, `pendingMode`, `pendingLicenses`.

**Workflow tooling (uncommitted):**
- **`.claude/commands/review-commit.md`** — CC slash command (`/review-commit`): 6-step process (read PENDING_COMMIT.md → read changed files → py_compile + tsc → ruff → commit+push or report → verify with git log).
- **`docs/PENDING_COMMIT.md`** — current brief for CC's first comprehensive review.

> ⏳ **Waiting for CC commit.** The user will type `/review-commit` in Claude Code to trigger the review + push.


---

### What changed in this reconciliation (2026-06-29)

This section was significantly out of date relative to shipped code. Fixed:
- M8.3 was mislabeled as "Currencies & FX" — corrected to Accounting Periods Engine (the migration chain proves this).
- Currencies & FX, M8.4 Tax & Statutory, GL Posting Engine, Account Mapping & Bank Accounts, the Super Admin Portal tenant-lifecycle slice, and Profile/Sessions/2FA were fully built but had no entry anywhere in this document.
- Period Management Enhancements/Hardening and M9.0.1 were marked "uncommitted" — both are now committed and pushed (`b3e70e3`, confirmed against `origin/main`).
- §9/§10 (below) were rewritten to reflect the real next milestone instead of the now-completed M8.3 Backend / M8.4 Tax items.

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
- **Tenant lifecycle direction (M9.0.1, 2026-06-29):** signup creates ONLY a test tenant; live is born second, only via explicit super-admin promotion. `parent_tenant_id` runs test→live (live points back at the test it came from) — the inverse of the original live-first/clone design. Test stays active permanently after go-live; it's never archived.
- **Expense→GL posting is synchronous, same-transaction** at final approval. This is intentional so a GL failure rolls back the approval — no partial state.
- **Three-mode architecture (2026-07-11 — see `docs/BRIEF_three_mode_architecture.md`):** Every module supports three posting modes: `'lite'` (workflow-only, no GL), `'connected'` (GL coding in Ziva, posts to external ERP via export), `'full_erp'` (GL posts internally). Mode is set by the consultant in SA portal (`tenant_org_config.posting_mode VARCHAR(20) DEFAULT 'full_erp'`) — tenants never see this setting. The `posting_batches` table is the export queue for Connected Mode. Existing tenants default to `'full_erp'` — no migration of existing data.
- **Module independence:** every module must work standalone. A company subscribing to only one module (e.g. only expense management, only AP) should be production-ready within the hour. CoA/Dimensions/Currencies/Tax are OPTIONAL in Lite/Connected mode and REQUIRED in Full ERP mode. The setup portal shows/hides steps based on `posting_mode` + active modules.
- **Signup = trial lead (2026-07-11):** the business signup page creates `lifecycle_status = 'trial'`, NOT `'in_implementation'`. Trials get demo seed data. The SA portal "Trials & signups" page is the lead management queue. Consultants activate implementation manually after qualification. This is a one-line change to the signup router.
- **Consultant config lives in SA portal:** posting mode, module licensing, integration settings (which external ERP) — all set by the consultant in the SA portal tenant detail page BEFORE "Enter Tenant." These are never exposed inside the tenant implementation pages.
- **Document security invariants (2026-07-11 — see `docs/BRIEF_document_storage_security.md`):** (a) Signed URLs expire in 15 minutes (not 1 hour). (b) All uploaded files are SHA-256 hashed; `file_hash` stored in `expense_documents`. (c) Magic bytes validation on every upload — Content-Type header is not trusted. (d) `retain_until` enforced — deletion of financial documents within the mandatory 6-year retention window is blocked at API level (NDPR 2019 + CAMA 2020 + FIRS). (e) Document access is logged to `document_access_log`. (f) Cloudflare R2 is the target storage provider (zero egress fees vs. Supabase's $0.09/GB) — migrate when tenants > 5 or storage > 5 GB.

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

6. **Three-Mode Architecture** — Phase 1 (backend) ✅ DONE (commit `f24c2fe`): migrations, posting_batches, expense_posting routing, export endpoints, trial signup. Phase 2 (SA portal consultant panel) ⏳ PENDING CC REVIEW (uncommitted — `#49`): system-config GET/PATCH endpoints, frontend panel. Phase 3 (not yet started): "Trials & signups" SA page, mode-aware setup portal, GL group hierarchy path in picker. Full spec: `docs/BRIEF_three_mode_architecture.md`.
7. **Document Security Hardening** — Phase 1: signed URL expiry → 15 min, SHA-256 hash, magic bytes validation, image/PDF compression, deduplication, retention policy enforcement, access audit log. Phase 2 (later): Cloudflare R2 migration. Full spec: `docs/BRIEF_document_storage_security.md`.
8. **Confirm Currencies & FX / BDC completeness** — decide whether the JSONB-based implementation is final or whether BDC register volume justifies moving to dedicated tables.
9. **Super Admin Portal backend completion** — build Billing (incl. payment provider integration), self-service Trials/provisioning, Team, Audit, Support, Settings. Currently frontend-only stubs (§3.1).
10. **M11 — Accounts Payable**, then **M13 — Bank Reconciliation**, **M14 — Accounts Receivable**, **M16 — Budget Engine**, **M19 — Tax Engine**, **M10 — OCR & Receipt Scanning**, **M15 — Payroll & HR**, **M17 — Inventory & Warehouse**, **M18 — Fixed Assets**, **M20 — AI Intelligence Layer**, in that order (see §10).

**Also completed since last §9 rewrite (now closed):**
- ~~Role Hierarchy Enhancements~~ — **Done** (commits `3d2cf71`–`68608fd`, ~2026-07-01 to 2026-07-05). See §5.
- ~~Finance Review Workflow~~ — **Done** (commits `6cbbf09`–`57e05a8`, ~2026-07-05). See §5.
- ~~System Function Mapping~~ — **Done** (commits `290945a`–`7aa91bc`, ~2026-07-05). See §5.
- ~~People Module v1 (Positions + Transfers)~~ — **Done** (commits `a2c0b35`, `a000794`, ~2026-07-06). See §5.
- ~~Single Source of Truth merge (Positions → approval_roles)~~ — **Done** (commits `71025bd`–`1ddeaba`, ~2026-07-07). See §5.
- ~~People Module Polish + Employee-User Link~~ — **Done** (commits `b8c4709`–`a656f65`, 2026-07-10/11). See §5.

---

## 10. FUTURE MILESTONES (recommended order)

1. **Three-Mode Architecture Foundation** — backend + SA portal + setup sequence (see `docs/BRIEF_three_mode_architecture.md`)
2. **Document Security Hardening** — Phase 1: security/integrity/compression; Phase 2: Cloudflare R2 migration (see `docs/BRIEF_document_storage_security.md`)
3. Currencies & FX / BDC completeness decision
4. Super Admin Portal backend completion (Billing, Trials, Team, Audit, Support, Settings)
5. M11 — Accounts Payable
6. M13 — Bank Reconciliation
7. M14 — Accounts Receivable
8. M16 — Budget Engine
9. M19 — Tax Engine
10. M10 — OCR & Receipt Scanning (Anthropic Vision API)
11. M15 — Payroll & HR
12. M17 — Inventory & Warehouse
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

*End of Master Context. Last updated: 2026-07-11 (Three-Mode Architecture + Demo Seed + SA Portal Consultant Config — §5 entries added; last pushed commit `ceb2862`; #49 uncommitted, pending CC review). For current schema/endpoint/feature facts, see `docs/PROJECT_STATE.md`.*
