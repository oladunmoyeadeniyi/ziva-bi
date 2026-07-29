# ZIVA BI — Architecture & Build Sequence (the spine)
_Authoritative roadmap. Every session checks against this. New ideas slot in here, not sideways._
_Created: 17 June 2026_

## Product principle (locked)
Every module sits on a shared **core**, but each module can be **sold standalone**.
The core must be built first and built well — weak core = every module inherits the weakness.

## v1 definition (smallest sellable product)
A robust, easy-to-use **Expense module** + **Tax module**, Nigeria-first, with **reporting (export + ERP integration)** and a **Ziva owner portal** (required before selling). Everything below serves reaching that.

---

## THE LAYER MODEL (bottom-up dependency order)

### Layer 0 — Platform foundation
- Auth, multi-tenancy, sessions — **DONE**
- Users, role model (`role_tier`: consultant / power_admin / functional_admin) — **BUILT but NOT WIRED** (all accounts null). Gap.
- **Ziva owner / Super Admin portal** — **MISSING**. v1 blocker (you confirmed). Create/view/suspend tenants, onboarding, later billing.

### Layer 1 — Master data (reference data every transaction points to)
- Chart of accounts — **DONE**
- Dimensions — **DONE**
- Currencies & FX — **DONE**
- Tax setup (applicability, VAT/WHT/PAYE config) — **DONE**
- Periods / fiscal calendar (M8.3) — **DONE**
- Org structure — **DONE**

### Layer 2 — Core ledger + shared services (THE MIDDLE GAP)
- **GL / journal posting engine** — **MISSING**. The heart. Records double-entry. Everything operational posts here. Several existing stubs (retained-earnings roll-forward, `is_date_postable` wiring) wait on this.
- Posting rules, journal validation, balancing, audit trail of entries.
- **OCR / AI engine — CORE shared service, required for v1.** Used by every module (expense receipts, invoices, bank statements, tax docs). Built once as a service modules call — NOT rebuilt per module. Expense and Tax both depend on it for v1.

## GLOBAL DESIGN PRINCIPLES (apply to every screen, no exceptions)
- **Mobile + desktop must work equally** — responsive from the first line of every new screen. NOT a "mobile version" built later.
- ⚠️ Existing screens (setup pages, Period Management, expense form) are desktop-oriented — they need a **responsive retrofit within v1 scope**, not deferred.
- Easy-to-use / low-friction UX is a product requirement, not polish.

### Layer 3 — Reporting & output (CORE, not a module)
Every tenant needs output regardless of modules subscribed.
- Trial balance, financial statements (SOFP/SOCI) — reads the GL
- **Tenant-configurable export formats** (v1)
- **ERP integration / API push** to a tenant's existing system (v1)
- Reads Layer 2; must exist for v1 to be useful.

### Layer 4 — Modules (sit on core, sellable standalone)
- **Expense module = digital replication of the Red Bull expense retirement process, made configurable for other companies.** NOT an abstract enterprise system. Definitive reference = the real Excel template (Templates / Table View / Journal sheets; columns: Employee Name/Code, P/L Category, GL, GL Name, Real IO, Stat IO, Cost Center, Material/SKU, Location, Invoice Date/No, Description, Currency, Amount NGN, Approval Status, Posting Status, Year, Month). Replaces the email + Excel + Power Query flow that crashes at volume. Must POST to the GL.
  - Original manual flow being replaced: employee fills Excel template → manager email approval(s) → forward to Finance with supports → Finance files in structured folders → manual invoice-vs-line review → email queries (payment blocked until resolved) → summary schedule → manager approval → bank upload.
- **Intake / automation = the front door to the expense module.** Email + Excel-template capture turns inbound finance requests into structured expense submissions so Finance isn't overwhelmed. Leans on OCR/AI. Configurable: auto-create OR queue-for-review per tenant. Post-v1 (v1 can ship without it) but it's the module's reason for existing.
- **Tax module** — config done; must COMPUTE + POST (WHT/VAT) via the GL.
- Later: AP, AR, fixed assets, inventory, payroll, POSM, bank rec.

### Layer 5 — Close & control (depends on sub-ledgers)
- Period close mechanics (M8.3) — **DONE** (engine)
- System-wired close checklist (reconciliations tied to module + control GL) — **FUTURE** (needs sub-ledgers). Currently free-text placeholder.
- M8.4 Audit & statutory close — fills the statutory-close stub.

---

## WHAT'S BUILT vs MISSING (honest snapshot)

**Built:** Layer 0 (auth/tenancy), Layer 1 (all master data), Layer 5 period engine, a slice of Layer 4 (expense form).

**Missing / blocking v1:**
1. `role_tier` not wired to accounts (Layer 0)
2. Ziva owner portal (Layer 0) — v1 blocker
3. GL / posting engine (Layer 2) — the central unlock
4. OCR / AI engine (Layer 2) — core, required for Expense/Tax v1
5. Reporting + export + integration (Layer 3) — v1 requirement
6. Expense not posting to GL; Tax not computing/posting (Layer 4)
7. Responsive retrofit of existing screens (global) — v1 requirement

---

## LOCKED BUILD SEQUENCE TO v1

Foundation must be solid before operational layers. Order:

**Phase 1 — Finish the foundation**
1. Wire `role_tier` to accounts + reconcile with `is_tenant_admin`.
2. Ziva owner portal (minimal: view/create/suspend tenants, onboarding).

**Phase 2 — Build the core ledger + shared services**
3. GL / journal posting engine. Retrofit existing stubs (roll-forward, `is_date_postable` wiring) onto it.
4. OCR / AI engine as a shared service (Expense/Tax call it).

**Phase 3 — Make v1 modules real**
5. Connect Expense → GL (post proper double-entry) + OCR receipt capture. Build to the retirement-process template, configurable.
6. Connect Tax → GL (compute + post WHT/VAT) + OCR tax-doc reading.

**Phase 4 — Output**
7. Reporting core: TB + financial statements.
8. Tenant-configurable export.
9. ERP integration / API push.

**Phase 5 — Polish, responsive, ship v1**
10. Responsive retrofit of existing screens (mobile + desktop equal).
11. UI polish backlog, consultant override, fiscal-year relocation.
12. Hardening, end-to-end testing, go-live readiness.

---

## DEVIATION RULE
Fresh ideas are welcome — they go into this roadmap at the right layer, not built immediately out of order. Before any new brief, confirm it's the next item in the sequence or a deliberate, logged exception.

## M9 — PLATFORM / OWNER PORTAL (next major milestone, one milestone, sequenced briefs)

Two onboarding paths coexist:
- **Path A — Consultant-led:** consultant fully configures a tenant's base setup to their preferences before go-live (high-touch). Consultant portal can **go into each tenant** to configure it (impersonation/context-switch, logged).
- **Path B — Self-service trial:** potential tenant signs up via a **detailed signup form** capturing preferences + modules to test → auto-provisioned **guided test environment**. Consultant's job shifts to follow-up/conversion.

**Tenant lifecycle states (locked):** Trial / In Implementation / Live / Suspended.

**Environment architecture (locked decision — biggest architectural choice in the app):**
- Every tenant can have a **live environment + a mirrored test/sandbox environment**, always available. Test env exists for live tenants too (configure/test changes before promoting to live), not just trials.
- **Approach = SHADOW TENANT (Option 3, chosen over environment-column and schema-per-env).** A test environment is a linked shadow tenant: `tenants` table gets `environment` (live/test) + `parent_tenant_id`. All ~30 existing tenant-scoped tables stay UNTOUCHED — they isolate data automatically via existing tenant-scoping. Chosen because: app is already fully tenant_id-scoped; zero retrofit of 30 tables; near-zero risk of test/live data leak (vs Option 1's high corruption risk from a forgotten filter). Rejected Option 1 (environment column on all 30 tables — hundreds of queries to change forever, leak risk) and Option 2 (Postgres schema-per-env — heavy plumbing).
- **Same login, in-app environment toggle** — switch points the session's tenant_id at the live or test shadow tenant.
- **Promote test → live** = copy selected config between the two tenant_ids.
- **Retention** = scheduled purge of the test tenant's data (managed).

**M9 build order (one milestone, sequenced briefs):**
- **M9.0 — Environment architecture** (shadow-tenant model; the env toggle; promotion mechanism; retention). FOUNDATION — built first, before the portal, so everything else is environment-aware from the start.
- **M9.1 — Tenant lifecycle + owner data model** (4 states; super-admin backend; tenant list/detail APIs)
- **M9.2 — Owner portal UI** (separate /super area, styled like the app: tenant list, detail, suspend/reactivate)
- **M9.3 — Consultant impersonation** (go into a tenant to configure, safely + logged)
- **M9.4 — Detailed signup form + trial provisioning** (product-led path)

**M9.0 OPEN DESIGN QUESTIONS (settle next session before briefing):**
1. Where the active environment lives (JWT carries it? session swaps tenant_id? header?) — note: JWT currently carries tenant_id, so switching env means reissuing/augmenting the token.
2. When a test env is created — auto for every live tenant, or on demand?
3. What "promote" copies — all config, a selected subset, config-only vs transactional?
4. JWT/token reissue mechanics on env switch.

## POST-V1 (logged, not built yet)
- **Email + Excel intake / automation** — front door to the expense module; captures inbound finance requests into structured submissions. Configurable auto-create vs queue-for-review. Depends on OCR/AI + expense module.
- Checklist v2 (system-wired) — Layer 5 future, after sub-ledgers.
- Multi-country expansion (beyond Nigeria).

## PENDING (already briefed, slots into Phase 5 / Phase 1)
- UI Polish + fiscal move + consultant override brief (written; consultant-override piece relates to Phase 1 role wiring — may fold together).
- Checklist v2 (system-wired) — Layer 5 future, after sub-ledgers.

## SCOPE DECISIONS (locked)
- Nigeria first; multi-country later.
- Reporting v1 = export + ERP integration.
- Owner portal required before selling.
