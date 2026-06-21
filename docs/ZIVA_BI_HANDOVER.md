# ZIVA BI — HANDOVER NOTE
_Last updated: 21 June 2026_

## 🔴 START HERE — read this first, then jump to the bottom of the file for full detail
**Most recent work is at the BOTTOM of this file** (chronological log, oldest→newest). Read top-of-file only for deep history; for "where are we now," scroll to the end.

**Current state (21 June 2026):**
- Expense → GL posting is LIVE and tested (real journals post on final approval).
- Implementation→live promotion + clone-on-create test shadows: fully built (4 phases), including org_config/modules/approval_matrix in the clone (fixed a completeness-display gap).
- Currency single-source-of-truth, HR relationship bug, bank PUT 500: all fixed.
- Standing rule: all real-write tests use the dedicated test tenant `f2aecfab-025f-410f-a7f6-df923172c8a1` ("Ziva BI — Test Tenant"), documented in `docs/TEST_TENANT.md` — NEVER live Red Bull.
- **IN PROGRESS / NEXT:** Employee management improvements (cost-center dropdown sourced from Organisation structure, not free text; bulk-template validation; head-of-cost-center column; bulk-employee edit/delete/filter/sort like CoA). Was about to write this brief when the chat hit the 100-file upload limit — **start a fresh conversation, re-upload `backend/app/routers/hr.py` + the employees frontend page, and continue from "Employee management improvements" at the bottom of this doc.**
- Also still open (low priority): scope the Phase 4 clone test script's overly-broad teardown(); wire `suppress_outbound_email` into the 2 real SMTP send sites before production; clone_data toggle UI on "Create test environment".
- Once employees/cost-centers/approval-matrix are properly set up on the test shadow, the live walkthrough (submit→approve→GL) is still pending — that was the original goal of this whole thread.

## SESSION 2 — PORTAL BUILDS (deployed from wireframes)
- **Staff portal shell** — `/dashboard/business` for staff: left sidebar (WORKSPACE: Home/Expenses/Approvals + ACCOUNT: Profile), home dashboard (greeting, context subline, role pill, notification bell from approvals count, metric cards from real expense data, My tasks, My modules — real surfaces only, no fakes). Admin setup nav unchanged. RBAC/module-grid plug-in points marked in code. (Note: staff nav was hidden by `isExclusivelyAdmin` gate — fixed.)
- **Owner portal** — `/platform` now a shell with left section nav (7 sections): Overview (real metrics computed from tenants list), Tenants (real list+detail, moved to /platform/tenants), Team/Trials/Billing/Support (honest "coming soon" placeholders naming milestones), Audit (real if endpoint exists else placeholder). Tenant detail enter/lifecycle/suspend all working.
- All wireframes (staff, owner, profile) now deployed and matching.

## SESSION 2 — LATER ADDITIONS (UI + profile)
- **Header overhaul** — one shared `AppHeader` component across platform + business + impersonation; removed duplicated logout/profile/menu logic; context-aware (Platform owner / company name / "Viewing {tenant}"); dropdown deduplicated.
- **Profile page redesign** — `/dashboard/profile` rebuilt: identity rail (avatar, role pills, meta) + sectioned cards (Personal, Work [hidden for super admin], Security, Active sessions). Role-aware. Back navigation added.
- **Profile backend (sessions + 2FA)** — `sessions` table already existed. New: GET /me/sessions, DELETE /me/sessions/{id}, POST /me/sessions/revoke-others; 2FA via pyotp: POST /me/2fa/enroll (secret+otpauth URI), /verify, /disable; login takes optional totp_code (non-2FA users unaffected). User gained totp_secret + totp_enabled columns. Frontend renders QR from URI. (totp_secret at-rest encryption = future hardening.)

## WIREFRAMES APPROVED (deploy plan — separate briefs each)
Owner portal full vision (7 sections): Overview, Tenants, Team & delegation, Trials & signups, Billing, Support, Audit. Build plan: real sections (Overview metrics + Tenants — have backends) built properly; honest "coming in [milestone]" placeholders for unbuilt ones (Team=M9.1b, Trials=M9.4, Billing=post-v1, Support, Audit=partial). Separate brief per section. Header overhaul = DONE (was first foundational brief). Next deploy briefs: owner portal shell+nav+Overview, then Tenants refinement, then placeholders.
Staff portal: one adaptive permission-driven portal (covered above).
Profile redesign: DONE.

## SESSION 2 PROGRESS (18 June 2026) — M9 Platform/Owner Portal mostly built

**Consultant model resolved (important):** "Consultant" is NOT a tenant role_tier — it's a PLATFORM/super-admin capability. Ziva owner/staff configure tenants by entering them. Tenant staff get role-based access only (RBAC, future).

**Built & verified this session:**
- **M9.0 Environment architecture** — shadow-tenant model. Tenant gained `environment` (live/test), `parent_tenant_id`, `lifecycle_status` (trial/in_implementation/live/suspended), `test_data_retention_days`. Endpoints: create-test-environment, switch-environment (mints fresh token), promote (config-only: org_config/tax/fx done; CoA/dimensions/periods deferred — FK remap risk), purge-test-data (stub). JWT carries `environment`. Same login, in-app toggle.
- **M9.1 Owner portal backend** — `require_super_admin` guard; `/api/platform/*`: list/detail/lifecycle/suspend/reactivate tenants. `pre_suspension_status` column. Suspension blocks login+refresh+switch.
- **M9.2 Owner portal UI** — `/platform` area (super-admin guarded, redirects others). Tenant list/detail/suspend/reactivate/lifecycle. "Platform" link in user dropdown. Clean styling (full responsive deferred).
- **Super Admin account** — created standalone via `backend/scripts/create_super_admin.py <email> <password>` (NOT signup — signup wrongly makes a tenant). Owner account: admin@zivafinance.com, is_super_admin=true, no tenant.
- **Fix: super-admin routing + remove personal dashboard** — super admin lands on /platform; personal/individual dashboard removed (out of scope); signup is business-only now.
- **M9.3a Consultant access backend** — `POST /platform/tenants/{id}/enter` mints impersonation token (claims: impersonator_id, impersonation_mode). Two modes by lifecycle: implementation (trial/in_impl → full edit) / support (live → read-only via `block_if_readonly_impersonation`; can act on test). Stripped consultant role_tier from tenant users; reopen/go-live/module-license rewired to is_super_admin.
- **M9.3b Enter-tenant frontend** — "Enter tenant" buttons on platform detail; impersonation banner (amber=support/read-only, blue=implementation/edit, shows TEST); effectiveToken swap (impersonation token overrides accessToken; base session preserved; sessionStorage rehydrate on refresh); "Exit to platform".
- **M9.3c Strip tenant_admin + module licensing** — `is_tenant_admin` no longer grants config access (now super_admin OR power_admin only). Setup nav hidden from non-admins. Consultant gets "Add/Remove subscription" (is_licensed) controls on modules page. License endpoint: `PATCH /api/setup/modules/{key}/license?is_licensed=true`.
- **Fix: staff landing** — plain staff land on a clean operational page (expenses), not the 403 setup dashboard.

**Verified working in UI:** owner portal, enter-tenant (implementation edit + live read-only 403 + test edit), module licensing, staff sees no config nav.

**Expense module:** backend + UI exist and work; expense_reports table is currently empty (0 rows) — earlier test data gone through migrations. Not a bug.

## STAFF PORTAL — wireframe APPROVED (design only, build later)
- **ONE adaptive portal, permission-driven** — NOT separate portals per role. Same shell; the user's granted permissions reshape everything. "Finance" is just a user with more permissions (approver + tax + AP), not a separate app.
- Role-aware home dashboard + module nav. Home = greeting, role pill, metric cards, My Tasks, My Modules.
- **Modules a staff member lacks access to are HIDDEN entirely** (no locked/greyed items). Each user sees only granted modules.
- **Approvals tab shows ONLY for users who are approvers in a workflow** (a line manager in any department, not just Finance) — not shown to non-approvers.
- Nav, tasks, metrics all reshape to what the person can actually do.
- Access is per tenant: tenant tells Ziva who handles what (role/function/cost-center); consultant configures it. Fundamentally a permissions/RBAC engine with one adaptive UI on top.
- Builds LATER — after GL/posting engine + Expense module are real, alongside RBAC. Same milestone as RBAC.

## ROADMAP POSITION (unchanged spine)
Phase 1 (foundation: role wiring ✓, owner portal ✓ ✓ — M9 nearly done) → Phase 2 (GL/posting engine + OCR/AI — the big core gap, next major work) → Phase 3 (make Expense + Tax real on the GL) → Reporting → Staff portal + RBAC → ship v1.

**GL Brief 2 — trial balance + account ledger (read): DONE (3 pass / 3 skip, no failures — skips were because test tenant FY is STATUTORY_CLOSED so test entries stayed DRAFT; code paths verified, but needs re-test against a real OPEN period).**
- `backend/app/services/gl_reporting.py` — trial_balance(db, tenant_id, date_from, date_to, include_zero=False) → rows (gl_number, gl_name, account_type, total_debit, total_credit, balance) + grand totals (sum_debit, sum_credit, is_balanced). account_ledger(db, tenant_id, gl_account_id, date_from, date_to, dimension_filter) → opening_balance, lines (with running_balance), closing_balance. POSTED only (DRAFT + REVERSED excluded). Compute-on-demand (no running balances stored). Decimal money.
- `backend/app/routers/gl.py` (prefix /api/gl) — GET /trial-balance, GET /accounts/{id}/ledger. Guard: require_auth + tenant required (any authenticated business user; finance RBAC deferred). Registered in main.py.
- dimension_filter via JSONB @> containment.

**GL CONFIRMED CAPABILITIES (asked + verified):**
- **Multi-line entries (>2 lines):** fully supported — post_journal takes lines list of any length (min 2, no max). Sales-of-goods (Dr AR / Cr Revenue / Cr Output VAT / Dr COGS / Cr Inventory), fixed-asset acquisition, depreciation — all post as single balanced multi-leg journals.
- **Accruals:** supported mechanically (accrual entry + reversal entry are just journals). 

**PENDING BEFORE BRIEF 3: re-test GL end-to-end against a real OPEN period — DONE.** CC verified via Jan 2027 (legitimately postable through M8.3 SOFT_CLOSED grace-window: soft_closed_at=NULL → grace runs from now; no period state changed, no guard bypassed). Brief 1: 10/11 pass (balanced entry posts POSTED; all validations fire). Brief 2: 5/6 pass (TB is_balanced true, sum_dr 1500=sum_cr 1500; ledger opening/running/closing 0→1000→1500 correct; DRAFT excluded). The 1 skip in each = no DimensionValue seeded in tenant (data gap, JSONB @> + required-dim paths proven by code/other tests, not live data). No stray test data. **GL engine verified real & trustworthy.**

**FUTURE (tenant-configurable):** auto-reversing accrual rule — one action posts accrual + auto-dated reversal (e.g. first day of next period). Tenant can enable/disable + set reversal-date convention. Not built; design later.

## ACCOUNT DETERMINATION LAYER (designed — building now, BEFORE expense→GL wiring)
**Why:** posting service must resolve "employee payable control account" etc. to a tenant's actual GL number (every tenant's CoA differs — Red Bull uploads own, others adopt default/build). Standard ERP "account determination" (SAP) / control-account setup. Modules post to a ROLE; layer resolves role → tenant's GL.

**Design (extensible, two layers):**
1. **System-defined role catalogue** — platform catalogue of posting roles (keys), shipped + maintained by Ziva, each with an expected account nature for validation. Extensible (add roles as modules grow, no rebuild).
2. **Tenant mappings** — each tenant maps roles they use → their GL numbers during implementation (Super Admin/consultant sets up; post-go-live Finance HOD can manage — see expense config below).

**Fuller role catalogue (grouped, not final — extensible):**
- Control: Employee payable, Accounts payable, Accounts receivable, Intercompany payable, Intercompany receivable
- Tax: Output VAT, Input VAT, WHT payable, WHT receivable, PAYE payable, other statutory deductions (pension, NHF, NSITF)
- Cash/bank: Default bank, Cash, BDC clearing/suspense
- Fixed assets/CAPEX: Asset clearing/CWIP, Accumulated depreciation, Depreciation expense, Asset disposal
- Inventory: Inventory control, GRNI, COGS
- FX: Unrealised gain/loss, Realised gain/loss
- Period-end: Retained earnings, Current-year earnings
- Suspense/clearing: General suspense, Rounding differences

**Rules:**
- **Validate role↔account-type fit** — catalogue defines each role's expected nature (e.g. employee-payable = BS/liability; depreciation expense = PL). Mapping rejects mismatched GL.
- **Block posting if a needed role is unmapped** — posting/resolution raises clear PostingError ("role X not mapped").
- Build order: determination backend (catalogue + mapping + validation) → setup UI → then expense→GL (3a).

## EXPENSE → GL WIRING (designed — 3a after determination layer)
- **3a (posting mechanic):** approved expense → balanced journal (Dr expense lines with their GL+cost center+IO dimensions / Cr employee-payable CONTROL account, resolved via determination layer). Posts via post_journal. **No WHT** (WHT off for employee retirement by default). Employee payable = control account from the start.
- **Credit side configurable per expense type** (Option 3); default Dr Expense / Cr Employee payable (control).
- **3b (config/policy layer):** Finance review level (configurable per tenant; DEFAULT ON — Finance reviews after line-manager approval; tenant can turn off so line-manager approval alone posts). Finance review level configurable (who/levels). Super Admin sets up during implementation; post-go-live Finance HOD can be granted access to manage/delegate reviewers/approvers before GL. Per-expense-type credit account config lives here too.
- **Posting trigger:** at conclusion of the Finance review trail (when enabled), else at line-manager approval completion. This is the shared approval-layer concept arriving early via Finance review as a configurable approval stage before post.
- **WHT:** default OFF for employee expense retirement (correct per Nigerian practice). Applies to vendor invoices + IC transactions where applicable. Configurable (future-proof). Not in 3a.

**Account Determination Layer — DONE (7/7 pass).**
- `backend/app/models/account_mapping.py` — PostingRole (role_key PK, label, group, expected_account_type, expected_nature, is_control_account, description) + TenantAccountMapping (tenant_id, role_key, gl_account_id, unique per tenant+role).
- `backend/app/services/account_determination.py` — resolve_account(db, tenant_id, role_key) → gl_account_id or raises AccountMappingError; resolve_many collects all missing roles in one error. Modules call this BEFORE building journal lines; posting blocked if a needed role unmapped.
- `backend/app/routers/account_mapping.py` (/api/setup/account-mapping) — GET /roles (catalogue + current tenant mapping), PUT /{role_key} (validate + upsert), DELETE /{role_key}. Guard: _require_admin + _require_tenant + block_if_readonly_impersonation.
- **27 roles seeded across 8 groups** (control incl. IC, tax incl. statutory_deductions combined, cash_bank, fixed_assets incl. CWIP/depreciation/disposal, inventory incl. GRNI/COGS, fx, period_end, suspense). expected_account_type set per role (control/payable/bank/asset/earnings = BS; depreciation/cogs/fx/disposal = PL; suspense = either).
- Migration clean, catalogue seeded atomically in migration.

**⚠️ KEY FINDING (SOFP/SOCI):** Red Bull's uploaded CoA uses account_type values **'SOFP'/'SOCI'** (IFRS statement names), NOT 'BS'/'PL' as the model docstring assumes. And **account_classification is entirely NULL** (all 595 accounts — uploaded CoA never classified). Determination validation handles this by mapping BS→{BS,SOFP}, PL→{PL,SOCI}, and skips nature/classification validation (no data). **Implication to revisit:** account_classification drives Tax Engine, AP, AR, Payroll, Fixed Assets, Reporting (per model comment) — but it's unpopulated for uploaded CoAs. The CoA upload/template flow likely needs a classification step so account nature is reliably known for those modules + FX revaluation. Log for CoA-default/upload feature work.
**FUTURE:** per-expense-type / per-dimension mapping overrides (single mapping per role for v1).

**Account Mapping UI rework — DONE (7/7 pass).** Nested collapsible BS/PL → group → subgroup → roles (ordered by display_order); readable label maps; all sections expanded by default. Z-index fixed (removed overflow-hidden from cards, dropdown z-[200], verified at section boundary). Control toggle (super admin only) flips is_control_account_effective via PUT /control; "reset to default" clears override (PUT null); non-super-admins see Control tag read-only. Per-scope + overall mapped counts. No backend touched.

**NEXT: map Red Bull roles (esp. employee_payable → SOFP liability GL) → resume expense→GL 3a.**

**⚠️ CATALOGUE REDESIGN — BACKEND DONE (8/8 pass).** 25 roles in statement taxonomy (statement→group→subgroup→display_order): 10 BS Current Assets, 9 BS Current Liabilities, 1 BS Non-Current Liability (intercompany_loan), 2 BS Equity, 2 BS Suspense, 1 PL Cost of Sales. FX + per-class FA roles removed (0 mappings existed). Added intercompany_loan/accruals/prepayments/provisions; grni now control. Per-tenant control override in separate `tenant_posting_role_settings` table (toggle independent of GL mapping). New endpoint PUT /api/setup/account-mapping/{role_key}/control — gated to **super admin only** (not power_admin). GET /roles returns taxonomy + is_control_account_effective. Migration clean; FX config (Currencies & FX) + frontend untouched. **NEXT: UI rework (nested collapsible statement→group→subgroup, control toggle, + dropdown z-index fix).**

**⚠️ CATALOGUE REDESIGN (in progress — supersedes the flat 8-group catalogue):**
Review of the mapping UI surfaced the flat catalogue was too simplistic. Redesign decisions:
- **2-level statement taxonomy:** each role has statement (PL/BS) → sub-group → role. PL groups: Revenue, Cost of Sales, Marketing & Advertising, Indirect/Overhead, Other Income/Expense, Finance Cost/Income, Taxes. BS groups: Current Assets, Non-Current Assets, Current Liabilities, Non-Current Liabilities, Equity. Collapsible sub-groups under each (Inventory, Prepayments, Accruals & Provisions, Tangible/PPE, Intangibles, CAPEX, Taxes, etc.) — standard relatable names. UI = nested collapsible.
- **REMOVE from mapping:** FX roles (fx_unrealised/realised gain_loss) → handled in Currencies & FX PER-CATEGORY (AP third-party / AP IC / AR / etc. with realised+unrealised each — already exists, see Currencies & FX page; directional netting locked default). Per-class Fixed-Asset roles (accumulated_depreciation, depreciation_expense, asset_clearing_cwip, asset_disposal) → belong in Fixed Assets module PER ASSET CLASS (each class has own cost/accum dep/dep expense/CWIP).
- **ADD:** intercompany_loan, accruals, prepayments, provisions. **CHANGE:** grni → is_control_account=true.
- **Control-account status:** catalogue default set by Ziva; **Super Admin can override per-tenant**.
- Build order: backend taxonomy + reseed FIRST, then UI rework (nested collapsible), then dropdown z-index fix (bundle into UI rework). THEN resume expense→GL 3a.
- Note: FA per-class determination + FX per-category are their own module-config concerns (FX config already exists on Currencies & FX page; FA per-class is future Fixed Assets module work).

**Account Mapping setup UI — DONE (6/6 pass).** `/dashboard/business/setup/account-mapping` (FINANCIALS nav, near Chart of accounts). 8 groups, searchable GL picker (full CoA fetched once via GET /api/config/coa, client-filtered, capped 50; inline GLPicker component), account-type pre-filter (BS→{BS,SOFP}, PL→{PL,SOCI}) with "show all" escape, per-row immediate save (PUT, re-fetch, "Saved" indicator), "X of 27 mapped" progress + incomplete warning, inline 422 validation. Admin-gated. No backend touched.

**NEXT: map roles for Red Bull (esp. employee_payable → a SOFP liability GL) → then expense→GL 3a.**

## BANK ACCOUNTS REGISTER (new setup feature — building now: backend + UI)
**Design (locked):**
- Master-data register of bank/cash accounts. Each record: bank name, account name, account number, **currency**, **GL account** (may be SHARED per-currency across accounts OR UNIQUE — tenant's choice), **is_default for currency** (one default per currency), active.
- Supports MULTIPLE accounts per currency (Red Bull: 5 NGN + 3 USD + 1 EUR).
- **KEY:** every bank-side journal line records the **specific bank_account_id** (a tag on JournalLine), so reconciliation/reporting works PER INDIVIDUAL ACCOUNT even when GLs are shared ("nested inside the GL, spooled + reconciled per account"). GL posting service extended to accept optional bank_account_id on a line.
- Default-per-currency used for auto-posting where no specific account is chosen; but individual account is always recorded for rec/detail.
- Replaces removed default_bank/cash roles. Lives in setup (Financials).
- **Reconciliation tooling = later Bank Rec module** (this brief just builds the register + GL-line tagging readiness).
- Build: backend (model + endpoints + GL-line bank_account_id) + setup UI together.

**⚠️ STANDING RULE (Adeniyi, critical going forward):** ALL acceptance/script tests that create real records (expenses, journals, etc.) must run against the DEDICATED TEST TENANT — never the live Red Bull tenant. **Test tenant: `f2aecfab-025f-410f-a7f6-df923172c8a1`, "Ziva BI — Test Tenant", documented in `docs/TEST_TENANT.md`.** Needs setup before reuse: open period, employee_payable mapping, CoA rows, approval_matrix, test users — not yet built, do as part of whichever brief first needs it. Every brief going forward that involves real-write tests must reference this tenant. (Triggered by: 3a's acceptance tests hit live Red Bull directly, creating 28 expense reports + 6 posted journals as test pollution — CLEANED UP, 6/6 verified: Red Bull now 0 expense_reports/0 journal_entries, cascades clean, other tenants untouched, audit log preserved. Report numbering restarts at EXP-2026-0001, count-based, not a bug.)

## CATALOGUE CLEANUP + BANK REGISTER + REVENUE ENGINE (decisions — building flat cleanup + bank register now)

**Determination principle (locked):** account-determination roles are ONLY for postings the SYSTEM generates automatically (no human picks the GL). User-picked-per-line GLs are NOT roles. Test: does the system post here without a human choosing the account?

**Critical catalogue review:**
- REMOVE: `default_bank`, `cash` — these are bank/cash ACCOUNTS, not determination roles. Move to a new **Bank Accounts register** (see below).
- ADD: `goods_in_transit` (BS, Current Assets, Inventory subgroup) — system-posted on goods movement.
- KEEP (all genuinely system-determined): control accounts (employee/AP/AR/IC payable+receivable, IC loan), tax (output/input VAT, WHT payable/receivable, PAYE, statutory_deductions), clearing (bdc_clearing, general_suspense, rounding_difference), inventory (inventory_control, grni, cogs), accruals/provisions/prepayments (system-posted by accrual/prepayment engine + auto-reversal), period-end (retained_earnings, current_year_earnings).
- DEFER (add when modules need them): bank_charges, discount_allowed/received, wht_expense, vat_irrecoverable.
- FX roles stay OUT (handled per-category in Currencies & FX).

**Per-tenant role RELEVANCE (not free add/remove):** catalogue stays system-maintained (module code relies on role keys existing). Instead, per-tenant **hide/show (enable) flag** so each tenant only sees roles relevant to them (e.g. hide provisions/IC/BDC if unused). Super Admin toggles relevance per tenant. Safe cleanup without fragility. (Provisions use case: year-end booking of estimated future costs not yet invoiced — Dr Expense / Cr Provisions.)

## BANK ACCOUNTS REGISTER (new setup feature — build now, before/with 3a as needed)
A master-data register of bank/cash accounts (NOT determination roles). Each: bank name, account name/number, **currency**, its **GL account**, is_default-for-currency flag, active. Supports MULTIPLE accounts per currency (Red Bull: 5 NGN + 3 USD + 1 EUR). Replaces the removed default_bank/cash roles. Payments/receipts select the specific bank account; system resolves its GL. Lives in setup (Financials). Build as its own brief.

## REVENUE + RETURNS DETERMINATION (logged — AR/Sales module milestone, NOT now)
Revenue is NEVER manually keyed. On invoice raised → approved → validated, system AUTO-POSTS revenue to the correct GL **by category** (export / domestic / IC / other), because pricing is already set by price list (per product/service, per customer category, per sales type, per date). Customer RETURNS post to a category-driven returns GL (distinct from revenue). COGS/inventory/damages post via inventory module.
- This is **category-keyed determination** (a discriminator-based rule: `(tenant, determination_type, category_value) → GL`), NOT flat one-GL roles. Bigger structure than the flat role table.
- Belongs with the **AR/Sales module** (categories come from price lists / customer categories / sales types — which don't exist yet). Build there as a proper sub-system.
- The flat determination layer + expense→GL don't need this; proceed without it now.

**Catalogue cleanup — DONE (6/6 pass).** Removed default_bank + cash (3 mapping rows + 1 settings row cleaned). Added goods_in_transit (BS/current_assets/inventory, control=false — transient clearing). Added per-tenant `is_relevant` to TenantPostingRoleSettings (one row holds both control + relevance overrides, pruned when both null). GET /roles exposes is_relevant_effective; PUT /{role_key}/relevance (super-admin gated). **Relevance is COSMETIC only — resolve_account has no awareness of it, never blocks posting (verified).** Migration clean. Catalogue now ~24 flat roles, all genuinely system-determined.

**NEXT: (1) Bank Accounts register (backend+UI), (2) mapping UI relevance toggle surface, (3) expense→GL 3a.**

**Bank Accounts register — DONE (7/7 pass).** `backend/app/models/bank_account.py` (BankAccount: bank_name, account_name, account_number, currency [3-char code], gl_account_id [shared allowed, no uniqueness], is_default, is_active). Currency model = `tenant_currencies` (functional_currency + additional_currencies JSONB); bank accounts store currency code. One-default-per-currency via app logic (_unset_defaults). GL must be BS/SOFP (422 blocks SOCI/PL). Soft-delete when referenced by journal lines, else hard. Endpoints `/api/setup/bank-accounts` (GET/POST/PUT/DELETE, _require_admin). **JournalLine gained nullable bank_account_id** (FK, validated in post_journal step 5b — exists/tenant/active; existing posting unaffected; lines without it unchanged) → enables per-account reconciliation later. UI `/dashboard/business/setup/bank-accounts` (FINANCIALS nav), grouped by currency, searchable BS-filtered GL picker, default badge, active toggle. Migrations clean, type-check 0. Reconciliation tooling deferred to Bank Rec module.

**NEXT: (1) mapping UI relevance toggle surface (small), (2) expense→GL 3a.**

**Bank currency dropdown fix — DONE (4/4 pass).** Dropdown now builds full enabled set; shared `frontend/src/lib/currencies.ts` (ISO_CURRENCIES + getCurrencyLabel) extracted; bank-accounts reads org+fx+reporting+transactions, deduped.

**⚠️ DATA-INTEGRITY ISSUE FOUND (functional currency split — fix before FX revaluation):** Functional currency is stored in TWO places that disagree: `tenant_org_config.functional_currency` (Org tab) = NGN ✓, but `tenant_fx_config.functional_currency` = NULL. Two sources of truth. CC worked around it on bank-accounts by merging 4 sources, but the split is a latent bug — anything reading only tenant_fx_config (the Currencies & FX tab itself, FX revaluation later) will see no functional currency. **Clean fix needed:** ONE authoritative source (almost certainly tenant_org_config since that's where org setup sets it); tenant_fx_config should READ functional currency from there, not store its own copy. Log/fix before building FX revaluation. Also: the Currencies & FX tab vs Org tab both touch currency — review for overlap/duplication (relates to logged Org Configuration restructure).

**NEXT: (1) finish adding Red Bull bank accounts, (2) expense→GL 3a. (relevance-toggle UI = optional, skip for now.)**

**SINGLE SOURCE OF TRUTH — STANDING PRINCIPLE (Adeniyi, critical for go-live):** Every fact in the system must have ONE authoritative source. No duplicated/disagreeing stores (they cause silent production bugs). Apply this everywhere, ongoing.

**Currency consolidation — DONE (7/7 pass).** `tenant_org_config` now SOLE source for functional + `enabled_currencies` (JSONB list of ISO codes, functional always included; Red Bull = [EUR,NGN]; USD to be added in UI — never existed in any store). Migration unioned 4 sources (org functional + fx additional_currencies + reporting + bank_accounts in-use) so no tenant lost a currency. `tenant_fx_config` stripped to ONLY fx_rates + revaluation_rules (dropped functional_currency, additional_currencies, reporting_currency). Canonical GET /api/setup/currencies (currency list from org_config, rates from fx_config); PATCH routes writes correctly. Zero additional_currencies reads remain (grep clean). Bank dropdown + FX tab + expense all read one source. Migration up/down clean, type-check 0. The functional-currency-split data-integrity issue is RESOLVED.

**Currency consolidation — IN PROGRESS:** Fixing the functional-currency split. `tenant_org_config` = SINGLE SOURCE for functional currency + enabled currencies. `tenant_fx_config` keeps ONLY FX mechanics (rates, reporting currency, per-category revaluation GLs) — stops owning the currency list. All screens (Org tab, Currencies & FX, bank-accounts, expense) read the one source. Migration merges all existing currency data so no tenant loses a currency (Red Bull must end with NGN+USD+EUR). Brief: BRIEF_currency_single_source_of_truth.md. (Symptom that surfaced it: bank dropdown missing USD because currencies were split across org_config + fx_config.)

**INFRA LESSON:** A migration that drops/adds columns must be APPLIED (`alembic upgrade head` with DATABASE_URL set) before/with the uvicorn --reload picking up model changes — otherwise model-vs-DB mismatch 500s every endpoint touching that table (happened with enabled_currencies: model had it, DB didn't, all tenant_org_config reads 500'd until migration run). When CC writes a migration, ensure it's actually applied + verify alembic current = head.

**HR relationships fix — DONE (5/5 pass).** Pre-existing bug (NOT currency-related): hr.py used selectinload on Employee.cost_center/line_manager + CostCenterConfig.cost_center/head_employee/head_user, but models had only FK columns, no relationship() → 500s. Added 5 relationships in master_data.py (Employee.cost_center→DimensionValue, Employee.line_manager→self w/ remote_side; CostCenterConfig.cost_center/head_employee/head_user), explicit foreign_keys, one-directional (no back_populates). No migration. Employees + Cost Centers pages now load. hr.py untouched.

**Bank PUT 500 fix — IN PROGRESS.** Root cause (confirmed via traceback): update_bank_account flush expires acct.updated_at (UPDATE has no RETURNING); _to_response reads it → synchronous lazy-load in async context → sqlalchemy.exc.MissingGreenlet → 500. The 500 reached browser WITHOUT CORS headers (temp debug middleware sat outside CORSMiddleware) → masqueraded as "Failed to fetch / CORS". Create (POST) unaffected (INSERT uses RETURNING). **Fix:** `await db.refresh(acct)` after flush, before _to_response. Plus remove temp debug artifacts (_BankRequestLogger, put_debug.log) and ensure CORSMiddleware is outermost so 500s carry CORS headers (don't broaden origins). Brief: BRIEF_fix_bank_put_500.md.

**LESSONS:** (1) After an async UPDATE, server-side timestamps (updated_at) are EXPIRED not refreshed — `await db.refresh(obj)` before reading them, else MissingGreenlet 500. INSERT is fine (RETURNING). (2) A 500 without CORS headers shows in the browser as "Failed to fetch"/CORS-block — the real error is server-side; CORSMiddleware must wrap error responses. Don't trust "CORS"/"Failed to fetch" at face value — check the Network tab status code.

**Bank PUT 500 fix — DONE.** `await db.refresh(acct)` added after flush in update_bank_account; updated_at populated correctly, no lazy-load. All temp debug artifacts removed (_dbg logger, _BankRequestLogger middleware, put_debug.log). CORS confirmed on error responses (404/422 carry header) — removing the temp middleware (which sat outside CORSMiddleware and ate exceptions) WAS the CORS fix; no middleware-order change needed. Allow-list unchanged. PUT with real currency change → 200, is_default unset logic correct, no-change PUT still 200, POST untouched. No migration. **Bank-accounts feature is now fully functional end-to-end.**

**🎯 EXPENSE → GL 3a — DONE (22/22 pass). MAJOR MILESTONE: expenses now post real GL journals.**
`backend/app/services/expense_posting.py` (new): `post_expense_to_gl(db, tenant_id, report, created_by)`. Called BEFORE `report.status = "APPROVED"` (so a posting failure never even transiently marks approved). Validates: all lines have gl_id (else blocks with clear message, no silent skip); Σ line amounts == report.total_amount (clear error before post_journal's generic balance check); resolves employee_payable via determination layer (unmapped → blocks with clear message). Builds Dr each expense line's GL+dimensions / Cr employee_payable, posts via post_journal (source="expense", source_reference=report_number, module="expense"). Split-line parents excluded from posting (only leaf lines) — avoids double-counting. Same-transaction safety confirmed: get_db() rolls back on any exception, so posting failure fully reverts approval too — no partial state. Wired into the SINGLE final-approval point in approvals.py (confirmed only one location sets status=APPROVED; refer-back never independently finalizes). New EXPENSE_GL_POSTED audit log entry carries journal reference_number. No WHT (per design). No migration. **Follow-up noted (not done):** journal_reference not yet on ExpenseReportResponse (would need schema/migration).

Test results: JE-2027-000005 (3 lines, dr=cr=1000, POSTED), JE-2027-000006 (3-line multi-line), uncoded-line block confirmed, unmapped-role block confirmed, non-final-level no-posting confirmed, refer-back confirmed never finalizes independently.

**Phase 3 design (locked, via schema investigation + discussion):**
- Scenario: live starts empty for CoA/dimensions; test is REPEATABLE rehearsal space, re-promoted as client reconfigures. Config/master-data only, NEVER transactions.
- **Matching strategy: natural keys, not persistent ID-mapping table.** Confirmed reliable via diagnosis_promotion_schema.md: CoA `(tenant_id, gl_number)` active-only partial-unique; TenantDimension `(tenant_id, code)` active-only partial-unique; DimensionValue `(tenant_id, dimension_id, code)`. In-memory test_id→live_id map built per promotion run (not persisted — natural keys are source of truth).
- **Dependency order:** TenantDimension → ChartOfAccount → DimensionValue (2-pass: insert all w/ cascade_value_id=NULL, then wire cascade refs — the only circular FK) → GLDimensionRequirement (needs dim+CoA) → TenantAccountMapping (needs CoA; discovered dependency — mappings point at gl_account_id, must re-resolve via gl_number or they'd dangle after CoA promotion).
- **Deactivation propagates:** if deactivated in test, next promotion deactivates in live too (not silently — see review step).
- **Periods: NOT promoted as rows.** org_config (Phase 2) carries structure params; live re-runs existing "Generate periods" endpoint. No remapping needed, no new logic — simplest correct answer.
- **UX: diff/review required before any write** — side-by-side current-live vs incoming-test-value, per-item accept + "accept all", THEN apply. This is NOT a blind promote button (unlike Phase 2's org/tax/fx). Two-step: (3a) preview/diff endpoint (read-only) + apply endpoint (writes only what's accepted); (3b) the review UI.
- posting_roles is the only global non-tenant table — role_keys are stable strings, safe across tenants, no remapping needed.

**Phase 3b (review/confirm UI) — DONE (8/8 pass). 🎯 FULL IMPLEMENTATION→LIVE PROMOTION FEATURE COMPLETE.**
`frontend/src/components/PromotionReviewDialog.tsx` (new) + entry point on tenant detail page, same gating as Phase 2 (`is_super_admin && environment==="live" && test_environment`). Wide scrollable modal, grouped/collapsible by entity type, CREATE green/UPDATE amber w/ field-level before→after (red strikethrough/green)/DEACTIVATE red. Accepted-ids = explicit `Set<string>` enumeration always sent as `Array.from(accepted)` — "Accept all" just fills the set, never sends a blind "all" flag (matches 3a's server-side recompute for defense in depth). Empty-diff → clear "already up to date" message, zero-count sections hidden. Apply errors shown as banner, dialog stays open for retry. type-check 0.

**Full feature now spans:** Phase 1 (go-live↔lifecycle_status atomic) → Phase 2 (Super Admin UI for test-shadow creation + org/tax/fx promote) → Phase 3a (CoA/Dimensions/DimValues/GLDimReq/AccountMapping diff+apply engine, natural-key matching, 2-pass cascade resolution) → Phase 3b (review UI). Periods deliberately out of scope (org_config + existing "Generate periods" suffices). This was triggered by Adeniyi correctly identifying that the standalone "Ziva Test Tenant" wasn't the real per-client implementation→live architecture — investigation revealed substantial M9.0 scaffolding already existed but was disconnected/unsurfaced; all gaps now closed.

**Phase 4 design — FULLY SPECIFIED (via diagnosis_clone_schema.md), ready to brief:**
Full 9-step dependency chain confirmed: Step 0 UserTenant mirroring (already done by create_test_environment) → 1 TenantDimension (key: code) → 2 ChartOfAccount (key: gl_number) → 3 DimensionValue 2-pass (key: dim.code+val.code; cascade_value_id back-filled pass 2) → 4 GLDimensionRequirement (key: gl_number+dim.code) → 5 TenantAccountMapping (key: role_key) → 6 BankAccount (key: bank_name+account_number+currency; gl_account_id remapped via gl_number; created_by→NULL) → 7 Employee 2-pass (key: email; cost_center_id remapped; line_manager_id self-ref back-filled pass 2 — same pattern as DimensionValue.cascade_value_id) → 8 CostCenterConfig (key: dim.code+val.code; cost_center_id + head_employee_id remapped; **head_user_id copied VERBATIM — Users are global, already mirrored, zero remapping needed**) → 9 FinanceReviewConfig (NEW, included per Adeniyi — reviewer_user_id verbatim, cost_center_id remapped). EmployeeCodeHistory/EmployeeTransfer explicitly EXCLUDED (operational history, not config).
**Phase 4 engine (clone-on-create) — DONE (24/24 pass). Real run: 4,337 rows cloned from live Red Bull → test shadow in ~2s** (6 dimensions, 595 CoA, dimension values, 3570 GL dim requirements, 17 account mappings, 2 bank accounts + employees/cost centers/finance review configs).
`backend/app/services/tenant_clone.py` (new, deliberately separate from promotion_engine.py — clone is pure insert-only across 4 NEW entities Phase 3a never touched; coupling would mix conceptually different operations). `_CloneIdMap` (dim/coa/dimval/emp sub-maps) mirrors 3a's `_IdMap` pattern but independent. Both two-pass entities confirmed working (DimensionValue.cascade_value_id, Employee.line_manager_id) with FK-integrity-verified tests. head_user_id/reviewer_user_id copied verbatim (global users table). If a live row's FK target wasn't cloned (inactive), FK set to NULL rather than failing — good defensive choice. All-or-nothing via existing get_db() session (clone failure rolls back entire test-env creation incl. Tenant row + UserTenant mirroring). EmployeeCodeHistory/EmployeeTransfer confirmed excluded (0 rows). `clone_data: bool = True` param on both create_test_environment and the platform proxy.

**⚠️ EMAIL FINDING (real, action needed before production SMTP):** Real SMTP sending EXISTS (`_smtp_send` in approvals.py for approve/reject/refer notifications; `_send_invitation_email` in tenant.py) — both have a console-log fallback when SMTP unconfigured (safe in current local dev), but **in production with SMTP configured, test-tenant actions would email real people.** `suppress_outbound_email: bool=True` added to Tenant model + migration — schema-ready but NOT YET WIRED into the send call sites (deliberately deferred as a separate scoped brief, correctly not rushed into this one). **MUST wire before connecting real SMTP in production.**

**Clone completeness fix — DONE (21/21 pass).** Steps 10-12 added to tenant_clone.py: org_config (1 row), tenant_modules (3 active), approval_matrix (1 row) — total 4,342 rows on a real clone run. `_ORG_COPY_FIELDS` (29 fields) factored to a single module-level constant in tenant_clone.py; promote() now imports it (eliminated duplication between promote and clone — single source of truth). **Fresh clone now shows 5/12 (42%) and every remaining gap maps exactly to a real gap on live Red Bull itself** (0 employees, no tax config, no expense config, no document rules) — the shadow now faithfully mirrors live's TRUE state including its real incompleteness, not fabricated completeness. Steps 1-9 confirmed unaffected (595 CoA, 6 dims still exact). clone_data=False path confirmed unaffected (all new steps skipped too).

**STATUS: test shadow needs recreating again (this fix only applies to NEW clones) — then ready for the live walkthrough (employees, cost centers, approval matrix setup, submit+approve an expense, verify GL posting).**

**Minor process bug found (low priority, logged not yet fixed):** Phase 4's acceptance test script (test_clone_engine.py) had an overly-broad teardown() that deleted ALL test shadows for a tenant as pre-clean, not just ones it created — collaterally deleted the real Red Bull test shadow from earlier in the session. No data loss that matters (test shadows are disposable by design), confirmed via full audit trail. Fix: scope teardown to only shadows the test itself created. Not urgent — recreate the shadow via UI when needed.

## PHASE 4 — Clone-on-create for test environments (NEW, found via live walkthrough)

**Gap found:** `create-test-environment` mirrors USERS only, not data — new test shadows start completely empty (0/12 setup sections) even when live has real config (Red Bull live: 5/12, 595 CoA accounts, 6 dimensions). Confirmed via screenshots — not a bug, just incomplete scope from original M9.0 design (test was meant for fresh builds, not rehearsing changes to existing config).

**Decision (locked):** "Create test environment" should CLONE live's current state into the new shadow by DEFAULT, with a toggle to disable cloning (start empty) at creation time. Default = clone ON.

**Scope of clone (locked):** EVERYTHING — org/tax/fx config, Dimensions+Values, Chart of Accounts, GL Dimension Requirements, Account Mappings (reuse 3a's natural-key logic, one-directional live→test, no diff/merge needed since test starts empty), PLUS Bank Accounts, Employees, Cost Centers (NEW entities, not covered by 3a — have their own dependencies: Employee.line_manager_id self-ref, CostCenterConfig→Employee head_employee_id, BankAccount→ChartOfAccount gl_account_id). 

**Simpler than Phase 3a in one way:** this is pure clone-to-empty, no diff/review/accept-reject needed (nothing to reconcile — test is empty).
**Harder in another way:** more entities, new self-ref (Employee) + cross-entity dependency (CostCenterConfig needs Employees needs DimensionValues).

**Next:** investigate Bank Accounts/Employees/Cost Centers schema (same discipline as 3a) before designing the clone engine.

## TENANT IMPLEMENTATION→LIVE PROMOTION (investigated — substantial existing scaffolding found, completing in phases)

**What already exists (M9.0, found via investigation, NOT newly designed):**
- `Tenant` model: `environment` ("live"|"test"), `parent_tenant_id` (test shadow → live parent), `lifecycle_status` ("trial"|"in_implementation"|"live"|"suspended"), `test_data_retention_days` (no enforcement yet), `pre_suspension_status`.
- `POST /api/tenant/create-test-environment` — creates a live tenant's test shadow (mirrors UserTenant rows). Real, working.
- `POST /api/auth/switch-environment` — tenant users swap live↔test via JWT reissue. Real, working.
- `POST /api/tenant/promote` — copies org_config/tax/fx test→live. **CoA, dimensions, periods are DEFERRED** (need FK id-remapping to avoid referential corruption — genuinely hard, intentional).
- `POST /api/platform/tenants/{id}/enter` — Super Admin mode logic: trial/in_implementation → full edit; live → read-only (support) unless test env requested → full edit on shadow.
- `block_if_readonly_impersonation` — blocks writes when support+live.
- Lifecycle mutations: PATCH lifecycle, suspend/reactivate — all real.

**What's broken/missing (the actual gaps):**
1. **`POST /api/setup/go-live` sets `is_active=True` but never updates `lifecycle_status` to "live"** — two unlinked actions. (Phase 1 — fixing now.)
2. **No Super Admin UI** for create-test-environment or promote — real endpoints, zero buttons.
3. **CoA/dimensions/periods promotion unbuilt** — the hard part, deliberately deferred (FK remapping). This is what "roll over master data" actually requires.
4. Current "Ziva BI — Test Tenant" is NOT a real M9.0 shadow (no parent_tenant_id) — **kept deliberately** as a separate Ziva-internal engineering/QA fixture (not client-facing), distinct from per-client test shadows. Both concepts coexist for different audiences.

**Phase 1 (go-live↔lifecycle link) — DONE (6/6 pass).** mark_go_live now sets lifecycle_status="live" atomically with is_active=True, same commit. Audit event "platform.lifecycle.updated" (same as manual PATCH, unified trail) with metadata {from, to, via:"go_live"}. Confirmed downstream: post-go-live Super Admin entry → mode="support" (read-only); test shadow path unaffected. Blocking-checklist logic untouched. No migration.

**Phase 2 (Super Admin UI for test-env + promote) — DONE (6/6 pass).** Platform session has no tenant context + existing tenant-router endpoints require tenant-scoped guards (require_tenant_admin/_require_consultant) + promote requires being authenticated AS the test tenant — none hold from the platform page. Added 2 thin proxy endpoints on platform.py (`/api/platform/tenants/{id}/test-environment`, `/api/platform/tenants/{id}/promote`) that INLINE the same logic (not crafted CurrentUser objects — safer pattern). UI: "Create test environment" button → idempotent, replaced by shadow summary once it exists. "Promote configuration" → per-section checkboxes (org_config/tax/fx, default checked — kept granular per-section rather than single action, since a consultant may want to promote org config without overwriting manually-tuned FX rates) + grayed deferred list (CoA/Dimensions/Periods) + overwrite warning + confirm dialog. Super-Admin-only gating (`is_super_admin && environment==="live"`). Existing backend endpoints fully untouched. type-check 0.

**Phase 3a (CoA/Dimensions promotion diff+apply engine) — DONE (36/36 pass).** `backend/app/services/promotion_engine.py` (new): natural-key matching, no persistent ID-map (in-memory `_IdMap` per call, 3 dicts dim/coa/dimval test_id→live_id, built incrementally — matched rows populate it first, CREATEs add their new live UUIDs, downstream entities resolve through it). Dependency order: TenantDimension → ChartOfAccount → DimensionValue (2-pass: insert with cascade_value_id=None, flush, second pass wires cascade refs — verified no FK violation) → GLDimensionRequirement → TenantAccountMapping. Two endpoints: `POST /api/platform/tenants/{id}/promotion/diff` (read-only preview) and `.../promotion/apply` (accepts accepted_item_ids). **apply_promotion does NOT trust the client diff — recomputes fresh server-side, matches by natural key independently** (confirmed). All-or-nothing per apply call (one transaction, full rollback on any exception). DEACTIVATE only ever sets is_active=False, never deletes. Diff item-id scheme: `coa:{gl_number}`, `dim:{code}`, `dimval:{dim_code}:{val_code}`, `glreq:{gl_number}:{dim_code}`, `accmap:{role_key}` — stable, human-readable, for 3b's UI to reference. Periods confirmed untouched/out of scope. Both endpoints super-admin-gated, require test shadow. No migration.

**NEXT: Phase 3b — review/confirm UI (side-by-side diff, accept individual/all, calls apply).**

**Sequencing (agreed):** Phase 1 ✅. Phase 2 ✅. Phase 3a (diff+apply engine) ✅. Phase 3b (review UI) — next.

## GL ENGINE — BUILD LOG
**GL Brief 1 — journal model + central posting service: DONE (all 8 acceptance pass).**
- `backend/app/models/gl.py` — JournalEntry (header: entry_date, description, source, source_reference, reference_number `JE-{YYYY}-{NNNNNN}` unique per tenant, status DRAFT/POSTED/REVERSED, reversal-link FKs schema-ready, created_by, posted_at) + JournalLine (gl_account_id, debit/credit Numeric(18,2), line_number, dimensions JSONB {tenant_dimension_id: dimension_value_id}).
- `backend/app/services/gl_posting.py` — `post_journal(db, tenant_id, *, entry_date, description, source, source_reference, lines, created_by, module="manual", status="POSTED")` + `PostingError(code, message)`. Validation order: ≥2 lines → exactly one of debit/credit>0 & non-negative → Σdebits==Σcredits (2dp) → accounts exist/active/this-tenant → dimensions valid + GLDimensionRequirement 'required' enforced → is_date_postable(tenant_id, entry_date, db, module=) for POSTED. DRAFT skips date-postable (stages any date); POSTED must pass.
- Commit pattern: service flushes only; router get_db commits at request end.
- Decisions: JSONB dimensions (child table = future option); no environment column (test/live isolated by tenant_id); reference_number = JE-{YYYY}-{count+1 zero-padded 6}.
- `backend/app/schemas/gl.py` (JournalLineInput), migration clean (up/down verified), models registered via app/models/__init__.py.
- **Every future posting engine (expense, AP, payroll, manual JE, FX, year-end) calls post_journal().** Approval gate sits BEFORE this call (see Approval Layer notes).

**GL Brief 2 (next): trial balance / account ledger read** — sum journal_lines → account balances + TB report. Then Brief 3: wire expense module to post real journals (with approval gate). Later: reversal flow, manual JE UI.

## APPROVAL LAYER (design decisions logged — build after GL basics + expense wiring)
- Evolve the existing expense approval engine into a SHARED workflow layer all modules reuse (expense, AP, manual JE, payroll). Shared = shared ENGINE (routing through levels, recording approvals, referrals/rejections), NOT shared rules. Each module AND each tenant still defines its own approval criteria (levels, thresholds, approvers, amount limits) via its own approval matrix. Shared layer makes per-module/per-tenant criteria easier + consistent, not uniform.
- **Approval is a gate BEFORE the GL posting service**, not inside it. Flow: transaction created → approval workflow (levels) → fully approved → THEN call post_journal() → hits GL. The posting service stays "dumb" about business approval; it only enforces accounting rules (balance, valid accounts, period open, dimensions).
- **Posting gate is tenant-configurable:** default = fully-approved required before anything hits GL. A tenant can configure exceptions (e.g. auto-post low-value). System-generated entries (FX revaluation, year-end roll-forward) bypass approval by nature.
- Wiring point: GL Brief 3 (wire expense to GL) — expense posts to GL only when its approval chain completes. The shared approval layer itself is its own milestone after GL basics.

## DEFAULT-CoA FEATURE (logged — build AFTER GL)
System-default CoA template, platform-managed by Super Admin (a curated standard Nigerian CoA), distinct from any tenant CoA (needs a template store the Super Admin maintains that tenants copy from). During tenant setup, three adoption paths (all for v1): (1) adopt system default, (2) upload own CoA Excel/CSV — tenant OR Super Admin/consultant on their behalf, (3) build from scratch (current behaviour). Separate from GL (GL just needs accounts to exist). Sits in master data/setup. Build after the GL engine.

## OUTSTANDING M9 ITEMS (logged)
- M9.0 needs a UI (env toggle + create-test-environment button) — later M9 frontend brief.
- M9.1b: delegated owner-staff (Ziva colleagues with assigned-tenant restricted access) — designed, not built.
- M9.4: detailed signup form + trial provisioning (product-led path) — not built.
- Promote test→live for CoA/dimensions/periods (deferred FK-remap work).

## IMMEDIATE NEXT STEP
M9 is largely built and verified. The big remaining core work is **Phase 2: GL / posting engine + OCR/AI engine** — the central gap everything operational waits on. Optionally finish M9 loose ends first (M9.0 env-toggle UI, M9.1b delegation, M9.4 signup/trial). Next session: decide GL engine vs M9 polish, then brief.

## (earlier note, now done)
Design **M9.0 — Environment architecture** (shadow-tenant model). Architecture decided (see ROADMAP); 4 open design questions remain before briefing. Do that first next session.

Also pending your manual confirmation: after Phase 1a, **log out and back in** as adeniyi.oladunmoye@redbull.com, then test **Request reopen** on a hard-closed period — confirms the consultant role_tier chain works end to end.

## THIS SESSION'S PROGRESS
- **M8.3 Period Management** — complete (see below).
- **ROADMAP created** (`ZIVA_BI_ROADMAP.md`) — the authoritative build sequence/spine. Read it. Locked scope: Nigeria-first; reporting v1 = export + ERP integration; owner portal required before selling; v1 = robust Expense + Tax on a shared core; every module standalone-sellable.
- **Expense module north star corrected**: it's a configurable digital replication of the Red Bull expense retirement process (real Excel template is the reference), with email+Excel intake as its front door (post-v1).
- **OCR/AI engine** = core, required for v1. **Mobile+desktop equal** = global principle; existing screens need responsive retrofit in v1.
- **Phase 1a (role_tier wiring) — DONE & committed.** `_require_admin` now tier-aware (consultant/power_admin pass; functional_admin excluded; is_tenant_admin kept, NOT retired; is_super_admin untouched). Repeatable tier-setter: `python scripts/set_role_tier.py <email> <tier>` (from backend/). Your redbull account set to consultant. **Requires log-out/in for the JWT to carry it.**
- **M9 milestone fully designed** (see ROADMAP): owner portal, two onboarding paths (consultant-led + self-service trial), 4 lifecycle states, shadow-tenant environment architecture, 5-brief order (M9.0→9.4).

## ___ (rest of M8.3 detail below) ___


## Where we are

**M8.3 Period Management — COMPLETE and committed.** Built across 5 briefs (0, 0b, 1, 2, 3, 4), all landed, all acceptance tests passed, walked through in the UI.

### What M8.3 delivered
- **Period engine** (`AccountingPeriod` model, replaced old `FiscalPeriod`): state machine FUTURE → OPEN → SOFT_CLOSED → OVERDUE → HARD_CLOSED. Periods run independently; only *closing* is sequential. Auto-soft-close on read (no scheduler yet). Registration-date floor enforced. Reusable `is_date_postable(tenant_id, target_date, db, user_id?, module?)` in `services/periods.py` — the keystone future posting engines (expense/AP/payroll) will call. NOT yet wired into expense flow (deliberate, later brief).
- **Grace overrides** (`PeriodGraceOverride`): tenant default (3 workdays, regular, all) + override rows by module (default/expense/manual_journal/future_exception) / applies_to (all/role/user) / period_type / grace value+unit (per-row workdays or calendar_days). Workday math = weekends-only (no holiday calendar yet; `# FUTURE` comment left).
- **Manual-journal block** (`block_journal_into_open_prior` column on TenantOrgConfig, default ON): blocks manual journals into a period while an earlier period isn't hard-closed.
- **Future-dated exception** (`FuturePostingException`): FUTURE periods hard-blocked by default; permitted roles (consultant or a `future_exception` grace row) can post a logged future-dated exception.
- **Close checklist** (`CloseChecklistItem` template + `PeriodChecklistCompletion`): tenant items tagged every_close / year_end_only (year-end = period_no 12). Preparer ≠ approver enforced server-side. Gates hard-close (empty checklist ⇒ hard-close allowed). History preserved via `item_label_snapshot` + no-cascade FK; items soft-deleted (is_active).
- **Year-end two-stage** (`FiscalYearState`): Management close (Dec hard-closed → state AUDIT_PENDING; roll-forward is a STUB — no GL postings, `# M8.x` marker; new year runs normally) → audit grace (3 months default, per-tenant; AUDIT_OVERDUE flag on expiry, visual only) → Statutory close (gate OPEN this brief; real audit artifacts = M8.4 stub; sets STATUTORY_CLOSED = permanent lock; `is_date_postable` refuses any date in a statutory-closed year; reopen refused).
- **Reopen** (`PeriodAuditLog`): consultant-only, increments reopened_count, now writes audit-log row with reason; refused if year statutory-closed.
- **Period Management page** at `/dashboard/business/setup/periods` — 3 tabs (Fiscal year & periods / Grace overrides / Close checklist). Sidebar link added under FINANCIALS.

### Tax/Org restructure (pre-M8.3, also complete)
- Configuration tab flattened (fiscal + tax sub-tabs removed). Tax applicability moved to Tax & statutory as gating first tab. Verified: org_configuration merge doesn't wipe toggles; tax-tab gating works.

---

## OPEN BACKLOG (written into brief: `BRIEF_uipolish_fiscalmove_consultant_override.md`)

**UI Polish + fixes (items 1–5, briefed, ready to run):**
1. Organisation → Configuration: one combined Save button (top + bottom) instead of two section saves.
2. Move fiscal-year definition (start month/day, format, closing frequency) FROM Period Management TO Organisation (Identity tab). Period Management keeps year selector + generate + grid + year-end only. Start-only; end derived.
3. Year name format → preset DROPDOWN (lives in Organisation with the fiscal fields). Presets: `FY{YYYY}`, `{YYYY}FY`, `{YYYY}/{YYYY+1}`, `FY{YYYY}/{YY+1}`, `{YYYY}`, `FY{YY}`. Generation uses chosen format for naming.
4. Grace overrides: add edit control for the default row's grace value/unit (currently no control).
5. Consultant override role may self-approve checklist items during implementation, logged as a consultant override in PeriodAuditLog. Non-consultant preparer≠approver stays absolute. (This unblocks solo testing of the checklist close loop.)

**Future milestone — Checklist v2 (system-wired close items):**
- Replace free-text checklist items with system-wired reconciliations: each item links to a module + control GL (bank rec → bank GL; AP sub-ledger → AP control; AR; fixed assets; inventory; POSM; etc.), reviewed and signed off by responsible officers. Depends on those sub-ledger modules existing. Revisit after they're built. (Adeniyi's point: free-text is a weak control; real close items must be system-verifiable, not typed-and-ticked.)

**Deferred / dependent on later work:**
- Retained-earnings roll-forward actual GL postings (currently a state-only stub) — needs a GL posting engine.
- M8.4 Audit & Statutory Compliance — audited TB upload, balance validation, audit adjustment journals, signed AFS upload, CFO sign-off; this fills the statutory-close gate stub.
- Wire `is_date_postable` into the expense posting flow (and future AP/payroll).
- Holiday calendar for workday grace math.
- Auto-soft-close / audit-overdue currently compute on read; move to a scheduled job eventually.

---

## TESTING STATUS
- Period engine, grace, journal-block, future-exception, year-end states: all passed CC's API acceptance tests (Briefs 1–4).
- UI walk-through (FY2024): generated 12 periods, all SOFT_CLOSED; sequential-close gate confirmed (only earliest period's Hard close active); checklist gate confirmed (hard-close blocked with "Close checklist incomplete" banner).
- NOT yet tested end-to-end: full checklist prepare→approve→close loop (blocked by solo login + preparer≠approver; item 5 fixes this) and the year-end strip (requires reaching a hard-closed December). Plan: test properly once item 5 lands and/or system is further built.

## ENVIRONMENT NOTES
- Backend venv is `.venv` (dot). Activate: `.\.venv\Scripts\Activate.ps1`.
- `uvicorn` only on PATH inside the venv. If not, `python -m uvicorn app.main:app --reload --port 8000`.
- Alembic needs `DATABASE_URL` in the shell env (not auto-read like the app). Set it before migrating:
  `$env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').ToString().Split('=',2)[1]`
  then `alembic upgrade head`.
- DB stays `ziva_dev`; CORS stays hardcoded `http://localhost:3000`. CC sometimes overwrites both — catch each time.
- `--reload` is unreliable; manual restart after migrations.
- Registration date for current test tenant (Red Bull): 2021-08-25 (the app-wide date floor).
