# MASTER CONTEXT — Ziva BI
> **Role of this document:** Durable decisions and rationale (the "why") — locked principles, architectural choices, milestone intent, and process guidance. This does NOT contain volatile facts.
> **For current code/schema/endpoint facts (the "what"):** see `docs/PROJECT_STATE.md`, which is the authoritative current-state snapshot and wins all conflicts on volatile matters.
> If anything in this document conflicts with PROJECT_STATE.md on a volatile fact (table columns, endpoint paths, feature status), **PROJECT_STATE.md wins**.
>
> Last updated: 2026-06-29 (full milestone reconciliation — see §5, §9, §10)

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
2. **Organisation tab restructuring** — per the latest brief/feedback on how the Organisation page should be laid out.
3. **Verify CoA PL/BS filter** — confirm the account-type filter behaves correctly across both classification schemes.
4. **UI Polish Milestone** — global UI overhaul (per §11, never done piecemeal). Do this before more feature surface area is added.

### Next feature work
5. **Confirm Currencies & FX / BDC completeness** — decide whether the JSONB-based implementation is final or whether BDC register volume justifies moving to dedicated tables.
6. **Super Admin Portal backend completion** — build Billing (incl. payment provider integration), self-service Trials/provisioning, Team, Audit, Support, Settings. Currently frontend-only stubs (§3.1).
7. **M11 — Accounts Payable**, then **M13 — Bank Reconciliation**, **M14 — Accounts Receivable**, **M16 — Budget Engine**, **M19 — Tax Engine**, **M10 — OCR & Receipt Scanning**, **M15 — Payroll & HR**, **M17 — Inventory & Warehouse**, **M18 — Fixed Assets**, **M20 — AI Intelligence Layer**, in that order (see §10).

---

## 10. FUTURE MILESTONES (recommended order)

1. Organisation page diff resolution + Organisation tab restructuring (cleanup)
2. CoA PL/BS filter verification (cleanup)
3. UI Polish Milestone — global UI overhaul (do not fix UI piecemeal before this)
4. Currencies & FX / BDC completeness decision
5. Super Admin Portal backend completion (Billing, Trials, Team, Audit, Support, Settings)
6. M11 — Accounts Payable
7. M13 — Bank Reconciliation
8. M14 — Accounts Receivable
9. M16 — Budget Engine
10. M19 — Tax Engine
11. M10 — OCR & Receipt Scanning (Anthropic Vision API)
12. M15 — Payroll & HR
13. M17 — Inventory & Warehouse
14. M18 — Fixed Assets
15. M20 — AI Intelligence Layer (98%+ accuracy target)

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

*End of Master Context. Last updated: 2026-06-29 (full milestone reconciliation — M8.3 mislabel corrected, ~7 undocumented completed milestones added to §5, §9/§10 rewritten; last pushed commit `b3e70e3`, confirmed against `origin/main`). For current schema/endpoint/feature facts, see `docs/PROJECT_STATE.md`.*
