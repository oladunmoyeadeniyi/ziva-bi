# ZIVA BI — SESSION HANDOVER NOTE 2
*Written at end of session, June 15-16 2026. Paste this as the first message in the new chat, along with PROJECT_STATE.md and MASTER_CONTEXT.md from CC.*

---

## 1. ENVIRONMENT STATE

- **Machine path:** `C:\Users\Adeniyi Oladunmoye\Projects\ziva-bi`
- **Backend:** `C:\Users\Adeniyi Oladunmoye\Projects\ziva-bi\backend` · port 8000
- **Frontend:** `C:\Users\Adeniyi Oladunmoye\Projects\ziva-bi\frontend` · port 3000
- **OS:** Windows 11, PowerShell
- **DB:** PostgreSQL 17, DB name `ziva_dev` (hardcoded — never rename)
- **CORS:** hardcoded `http://localhost:3000` in `main.py` — never rewrite
- **Claude Code:** v2.1.178 (Sonnet 4.6)
- **Alembic:** at head, 52+ tables confirmed

### Start commands
```
# Backend
cd "C:\Users\Adeniyi Oladunmoye\Projects\ziva-bi\backend"
.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000

# Frontend
cd "C:\Users\Adeniyi Oladunmoye\Projects\ziva-bi\frontend"
npm run dev

# Claude Code
cd "C:\Users\Adeniyi Oladunmoye\Projects\ziva-bi"
claude
```

### Known issues
- `uvicorn --reload` sometimes silently misses file changes — if a fix "doesn't work", restart manually before re-diagnosing
- If CC crashes with Bun segfault: `npm cache clean --force && npm uninstall -g @anthropic-ai/claude-code && npm install -g @anthropic-ai/claude-code`

---

## 2. PROJECT OVERVIEW

**Adeniyi Oladunmoye** — Chartered Accountant (ICAN 2019), Chief Accountant → Controller at Red Bull Nigeria Limited, Lagos. Non-technical founder of Ziva BI. Prior 2 years at Ernst & Young.

**Ziva BI** — enterprise multi-tenant SaaS finance automation platform competing with Sage X3, Oracle, Microsoft Dynamics. Multi-tenant, serves individual and business accounts from one codebase. Goal: sell as SaaS, fund early retirement, support UK relocation Q4 2026.

**Stack:** Next.js 15 · React · TailwindCSS · ShadCN UI · Python 3.14 · FastAPI · Alembic · PostgreSQL 17 · Supabase Storage (bucket: `documents`)

**Repo:** `github.com/oladunmoyeadeniyi/ziva-bi`, branch `main`

---

## 3. WORKFLOW RULES (NON-NEGOTIABLE)

1. Claude writes markdown briefs to `docs/[FILENAME].md`. Adeniyi pastes a **one-line terminal command** to CC — never long multi-paragraph instructions.
2. Standard invocation: `Read docs/MASTER_CONTEXT.md fully before starting, then read and implement docs/[FILENAME].md exactly.`
3. Every brief must list **"Allowed files"** — CC touches nothing outside that list.
4. CC must list **every file changed** in completion summary.
5. Claude must **read actual code** before diagnosing — no guessing.
6. **UI fixes batched** into dedicated UI Polish milestones — never fixed piecemeal.
7. **Reusable components** must be flagged, not duplicated across pages.
8. **Wireframes approved** before any CC implementation of new UI.
9. `npm run type-check` must show **zero errors** before any commit.
10. **Always suggest standard ERP/accounting best practice first** (SAP, Oracle, Microsoft Dynamics, Sage X3 as reference). Flag deviations proactively. Adeniyi makes the final call, but non-standard approaches must never pass without being flagged. This is a standing principle for every session.

---

## 4. STANDING ARCHITECTURAL DECISIONS (ALL LOCKED)

### Date constraint (app-wide hard rule)
No date anywhere in the system may be earlier than `tenant_org_config.date_of_registration`. If a business restructures, the original earliest registration date remains the floor — restructuring never moves it forward. Every future milestone with date fields inherits this rule.

### Test-first tenant provisioning (locked)
When a new tenant is created or signs up, **only a test/shadow environment** is provisioned. No live environment exists until the tenant explicitly promotes their validated configuration. Live environment is born from a promotion event, never created empty.

### User impersonation (locked)
- **Access**: clicking a user in the tenant user list OR employee list (People → Employees) in the Super Admin/Consultant portal opens that user's session — one click, visible "You are viewing as [Name]" banner + Exit button
- **Ziva BI Super Admin owner (Adeniyi)**: full unrestricted access everywhere, both test and live, including sensitive financial data
- **Ziva BI team (consultants/support)**: test = full transact; live = view-only, sensitive personal financial data hidden (salary, bank details, employee TIN, payroll)
- **Impersonation = diagnostic only**: no support actions from within impersonated session
- **Support actions** (password reset, unlock, ticket) done from Super Admin portal on user's profile — clean audit trail. Mirrors Intercom/Zendesk pattern.

### Portal & role architecture (locked)
- Two portals: Super Admin + Tenant Portal (three role tiers: Consultant, Power Admin, Functional Admin)
- Tenant Admin = configuration-only, never in approver dropdowns, cannot submit expenses

### Implementation setup sequence (locked dependency order)
Organisation → Dimensions → CoA → Module activation → Employees → Currencies & FX → Tax & statutory → Roles & permissions → Approval workflows → Document rules → Module setup → Go-live

### ERP best practice principle (standing, applies every session)
Always design based on SAP/Oracle/Dynamics/Sage X3 standards. Proactively flag deviations. Adeniyi's informed decision is final, but non-standard approaches must never pass silently.

---

## 5. MILESTONE STATUS

### ✅ COMPLETE — Dimensions page
Full feature set signed off: upload, edit modal, date fields (clear correctly via `null` PATCH, `onBlur` not `onChange`), validity year-pill filter (popover, dynamic), Active/Inactive groups, bulk actions, URL state persistence (`tab`, `dim`, `subtab` all survive refresh).

**Critical date input pattern (locked after extensive trial/error):**
- Never `<input type="date">` with `onChange` — browsers auto-fire with placeholder value
- Never third-party date picker (react-datepicker was installed, fully wired, then rejected by Adeniyi on visual grounds)
- **Locked pattern:** native `<input type="date">`, `defaultValue` (uncontrolled), `onBlur` handler (not `onChange`), convert via `toInputDate`/`fromInputDate` helpers
- **onBlur must NOT guard on non-empty** — empty input must produce empty string in state so clearing works
- Always send `null` explicitly in PATCH payload when field is cleared — never omit

### ✅ COMPLETE — Chart of Accounts page
All 4 tabs fully signed off:

**Template:**
- Row 1: Headers (cell comments with examples — no example data row)
- Row 2: Instructions · Row 3: Marker · Row 4+: Data
- No sheet protection (openpyxl protection was attempted multiple ways, never worked reliably — abandoned in favour of amber fill on rows 1-3)
- Parser: `data_rows = all_rows[3:]`, `enumerate(sheet1_rows, start=4)`
- Group Account Number/Name always included (is_subsidiary gate removed — `org_configuration` JSONB has no `structure_type` key)

**Accounts tab:** Dynamic GL Group filter, persistent multi-column cascade sort (`localStorage` key `ziva_coa_accounts_sort`), cascading filters (Account Type → GL Group → Classification), Edit GL modal fetches fresh data via `GET /coa/{gl_id}` endpoint

**Account groups tab:** 4-level expandable tree with strict no-fake-inheritance rule (empty level falls through directly to GL accounts), `limit=10000` fix, GL number click navigates to Accounts tab

**FS mappings tab:** Cascading filters (Account Type → FS Head → FS Note → TB Mapping), persistent sort (`ziva_coa_fs_sort`), unmapped accounts sort to bottom with amber highlight

**Dimensions tab:** Matrix view (GL accounts × dimensions), bulk edit (`PATCH /api/config/coa/dimension-requirements/bulk`), cascading filters, persistent sort with special handling for `req_{dimension_id}` sort keys

**URL state persistence:** `coaTab` syncs to URL `tab` param, survives refresh

**⚠️ PENDING — Account Classification dropdown filtered by PL/BS:** Brief was written in a combined `docs/FIX-coa-filters-classification.md` but this specific piece was NOT confirmed as tested. **Verify in the live app before assuming done.**

### ✅ SUBSTANTIALLY COMPLETE — Period Management (M8.3)

**Backend (fully built, in `backend/app/routers/setup.py` and `backend/app/models/setup.py`):**

7 tables: `accounting_periods`, `period_grace_overrides`, `future_posting_exceptions`, `close_checklist`, `period_checklist_items`, `fiscal_year_states`, `period_audit_logs`

18 endpoints including: generate, list, check (date postability), soft-close, hard-close, reopen, management-close (stage 1 year-end), statutory-close (stage 2 permanent lock), year-state, audit-log, checklist CRUD, checklist prepare/approve

**`is_date_postable` function** (in `services/periods.py`) — the single gating function all posting paths call. Full decision tree: registration date floor → no period defined → statutory closed → FUTURE (check exception) → HARD_CLOSED → OPEN → SOFT_CLOSED/OVERDUE (grace window logic) → manual journal sequential-close block.

**Frontend (fully built, at `frontend/src/app/dashboard/business/setup/periods/page.tsx`):**
- Tab 1: Fiscal year & periods (settings form + period grid + year-end close strip)
- Tab 2: Grace overrides
- Tab 3: Close checklist

**This session's additions to Period Management:**
1. **Generation now bounded**: fiscal year selector replaced with `<select>` bounded to registration year → current year only. Future years blocked. Backend validates both bounds.
2. **Stub first fiscal year**: when FY start < registration date, uses registration date as `fy_start` (not a block). Stub year ends at correct `fy_end` derived from fiscal year config, NOT 12 months from registration date.
3. **Regeneration blocked**: strengthened idempotent guard — ANY existing period for a fiscal year blocks regeneration (was only HARD_CLOSED before). Error: "Fiscal year already generated. Delete all periods for this year before regenerating." (Note: delete button was subsequently removed — see below.)
4. **Manual generation replaced with auto-generation**: `_generate_periods_for_year` internal helper called by: (a) PATCH /api/setup/org after fiscal year settings save, (b) hard-close of last period in a year triggers next year's generation. Generate button and delete button removed from UI. Deprecated generate endpoint kept silently.
5. **Year name format**: replaced free-text input with dropdown of format codes (`YYYY`, `FYYYYY`, `YYYY/YYYY`, `YYYY-YYYY`, `MMM YYYY - MMM YYYY`) with live preview. `_build_fy_label` in backend mirrors frontend's `previewYearFormat`. Legacy `{year}`, `{nextyear}`, `MMM` codes still work for existing tenants.
6. **First fiscal year end date**: new field in Organisation form (full date picker, valid range = anchor date to anchor date + 1 year - 1 day, where anchor = earlier of `date_of_registration` or `commencement_date`). Backend derives `fiscal_year_start_month` and `fiscal_year_start_day` from this. New `first_fiscal_year_end` column added to `tenant_org_config` via Alembic migration. `_generate_periods_for_year` uses anchor date as `fy_start` for first fiscal year.

**What's NOT yet surfaced in the frontend (backend exists, no UI):**
- Manual soft-close button (only auto-soft-close exists)
- Future posting exceptions UI
- Grace row editing (add/delete only, no edit)
- Audit grace months per-year adjustment
- Audit log viewer tab
- Sidebar link may need verification

**⚠️ NOT YET TESTED this session:** First fiscal year end date field in Organisation form — CC committed it (commit `17491da`) but Adeniyi had not yet tested it at session end. **Test first in new chat.**

### 🔵 NOT YET STARTED — Configuration Promotion Pipeline
**Agreed concept (locked):** Test/shadow tenant = full configuration sandbox. "Promote to live" = atomic copy of all configuration (CoA, dimensions, periods, org config, workflows, roles, tax config) from test to live. Transaction data stays in test. Promotion is repeatable. Sits between implementation portal and go-live. **Scope in a dedicated session before building.**

### 🔵 NOT YET STARTED — Organisation page tab restructuring
**Agreed decisions (locked, nothing built yet):**
- Fiscal year settings → move OUT of Organisation/Configuration tab → become setup section of Period Management page
- Tax applicability → move OUT of Organisation/Configuration tab → into Tax & statutory page
- Feature toggles + governance preferences → stay in Organisation/Configuration tab (pending confirmation after reading live file)
- **Session ended before reading `frontend/src/app/dashboard/business/setup/organisation/page.tsx`** — Adeniyi was about to share this file. **First action in new chat: read this file to confirm exact current Configuration tab contents before writing any briefs.**

### ⏸️ QUEUED, UNCHANGED FROM PRIOR SESSIONS
- M8.4 Audit & Statutory Compliance
- M8.5 Dimension Intelligence + Value Integrity Rules
- Active-years for dimension values (deferred to M8.3 permanent-lock trigger — that trigger now exists via statutory-close)
- Yearly recurring IO template system (deferred same reason)
- Tax Engine (M19)
- M20 AI layer (OCR)
- Render deployment (deferred)
- Dark mode (dedicated milestone)
- Reusable `DateInput` component (app-wide refactor)
- Currencies & FX backend DB tables
- UI Polish milestone — URL state persistence across ALL pages (not just Dimensions + CoA)

---

## 6. RECENT COMMITS (this session, in order)
- `cc881f4` — Codebase audit fixes (split-parent GL, impersonation guards, audit snapshots, Alembic tracking, race condition, closed-period trap, debug prints, purge stub)
- `384fd0e` — Period generation bounded to registration year → current year
- `75315cb` — Stub first fiscal year + correct fy_end derivation from config
- `17491da` — Auto-generation, year name format codes, first fiscal year end field (6 files)

---

## 7. ACCOUNTING/PRODUCT DECISIONS LOCKED THIS SESSION

1. **Fiscal year defined by year-end, not start** — organisations have a fiscal year END, not a start month/day. Start is derived automatically (month after year-end, day 1). This mirrors how real companies describe their accounting year ("year ending 31 December").

2. **First fiscal year is a stub year** — a company registered mid-year gets a short first year (registration/commencement date → fiscal year end), then full years thereafter. Standard practice.

3. **No manual fiscal year generation** — auto-generated on fiscal year settings save and on last-period hard-close. This eliminates user error and matches SAP/Dynamics behaviour.

4. **No delete fiscal year** — removed entirely. Deleting periods with any history (even auto-soft-closed) is not standard accounting practice and would cause audit issues. Correct remedy for misconfiguration is Consultant-assisted remediation.

5. **Year name format = format codes** — `YYYY`, `FYYYYY`, `YYYY/YYYY`, `YYYY-YYYY`, `MMM YYYY - MMM YYYY` — not rendered examples. With live preview. Matches how ERP systems present fiscal year naming options.

6. **Commencement date matters** — the earlier of `date_of_registration` OR `commencement_date` is the anchor for the registration date floor AND the first fiscal year start. A company may commence operations before formal registration; both dates must be captured.

7. **Quarterly period generation not yet implemented** — `_generate_periods_for_year` silently returns `[]` for non-monthly frequency. This is a known gap — quarterly tenants won't get auto-generated periods. Flag this when a quarterly tenant is onboarded.

---

## 8. IMMEDIATE NEXT STEPS (in order)

1. **Ask CC to update `docs/MASTER_CONTEXT.md` and `docs/PROJECT_STATE.md`** — share both with Claude in new chat
2. **Test first fiscal year end field** in Organisation form (commit `17491da` not yet tested)
3. **Read `frontend/src/app/dashboard/business/setup/organisation/page.tsx`** — confirm exact current Configuration tab contents before writing the Organisation restructuring brief
4. **Write and implement Organisation tab restructuring** (fiscal year → Period Management, tax applicability → Tax & statutory)
5. **Verify Account Classification PL/BS filter** in CoA Edit modal (not confirmed tested)
6. **Period Management walkthrough** — generate FY2026 via new auto-generation (save org fiscal year settings), verify 12 periods appear, verify period grid shows correct dates and statuses
7. **Verify sidebar link** for Period Management page exists and navigates correctly

---

## 9. KEY REMINDERS — DO NOT REPEAT THESE MISTAKES

1. **Always read actual code before diagnosing** — speculative fix briefs waste sessions. If a fix doesn't work on retest, ask for the actual file or terminal/DB output.
2. **CC's "already correct, no change needed" is not proof** — verify with independent evidence (browser console, DB query, terminal log) when the user reports a symptom is still occurring.
3. **Debug print statements need `flush=True`** in Python to appear in uvicorn terminal reliably.
4. **Stale downloaded files** — always tell the user to download a FRESH copy after any backend change to a generated file.
5. **Duplicate route definitions** — when a fix "doesn't change behaviour at all," check for duplicate/shadowed FastAPI route definitions.
6. **"Too long for terminal"** — always write a brief file + give a one-line invocation. Never paste multi-paragraph instructions as a terminal command.
7. **ERP best practice** — always flag when a design deviates from SAP/Oracle/Dynamics/Sage X3 standards. Suggest the correct approach first. Adeniyi makes the final call.
8. **`onBlur` not `onChange`** for all native date inputs — this is the locked pattern after extensive trial/error. Never use `onChange` on `<input type="date">`.
9. **Send `null` explicitly** when clearing date fields in PATCH payloads — never omit the field.
10. **`ziva_dev` DB name and `http://localhost:3000` CORS** — hardcoded, never rename or rewrite.

---

## 10. CC INSTRUCTIONS BEFORE CLOSING THIS CHAT

Tell CC:
```
Update docs/MASTER_CONTEXT.md and docs/PROJECT_STATE.md to reflect the current state of the project as of commit 17491da. Include: all new tables added this session (first_fiscal_year_end column), all new endpoints (DELETE fiscal year — removed, auto-generation triggers), Period Management complete feature list, known gaps (quarterly generation not implemented, manual soft-close no UI, audit log no UI). Then commit with message "chore: update MASTER_CONTEXT and PROJECT_STATE to reflect session end state".
```

---
*End of handover note 2.*

---

## 11. NATHAN'S DEVELOPMENT PLAN
(No Nathan-specific discussion occurred this session. Carried from memory.)

- **Born:** 31/03/2025
- **Daily plan system active** — ask day type first (crèche day / WFH day / weekend / public holiday), then generate full daily plan covering: activities, games, food, learning, language, music, sport, faith, and character. Track completed activities; check completion before rotating to new content.
- **Development goals:** Multilingual (English, Yoruba, French, Mandarin — in that phase order) · Musical (guitar) · Sporty (basketball, equipment already purchased) · Science/tech/AI/business career path · Confident public speaker · Leader · Spiritually grounded · Globally successful
- **Current nutrition:** SMA Gold 3 formula. Meal Plan Phase 1 (months 1–2) active
- **Core brain-development food:** multigrain pap (maize, guinea corn, tiger nuts, dates, millet) mixed with formula and daily egg
- **No known allergies; good appetite; fully walking**
- Family speaks English and Yoruba at home. Partner fully involved. Nathan attends crèche on weekdays; Adeniyi handles morning bath and drop-off; partner handles evening pickups.
- Family plans to relocate to UK in Q4 2026.

---

## 12. ADDITIONAL LOCKED DECISIONS FROM END OF SESSION

### Configuration Promotion Pipeline (formally logged)
- Test/shadow tenant = full configuration sandbox — CoA, dimensions, periods, approval workflows, roles, tax config, org settings all configured and validated end-to-end before go-live
- Single "promote to live" action atomically copies all configuration from test to live tenant
- Transaction data stays in test
- Promotion is repeatable — test environment remains active as ongoing rehearsal space
- What promotes: all configuration. What stays: transaction data
- Promotion includes a checklist of what is/isn't included
- **Sits between current implementation portal work and go-live**
- **Design not yet finalized — scope in a dedicated session before building**

### User impersonation — full detail (locked)
- **Access method:** clicking a user in the tenant user list OR the employee list (People → Employees sidebar) in Super Admin / Ziva BI Admin / Consultant portal — one click opens that user's session
- **Visible banner:** "You are viewing as [Name]" + Exit button — always shown during impersonation
- **Ziva BI Super Admin owner (Adeniyi):** full unrestricted access in both test and live, including all sensitive financial data
- **Ziva BI team members (consultants/support):**
  - Test environment: full transact access (submit, approve, post)
  - Live environment: view-only; sensitive personal financial data hidden (individual salary, personal bank details, employee TIN, payroll figures)
- **Impersonation = diagnostic only.** No support actions from within an impersonated session
- **Support actions** (password reset, account unlock, role change, raise ticket) performed from Super Admin portal on user's profile — clean separate audit trail
- Mirrors Intercom/Zendesk enterprise SaaS pattern
- Adeniyi confirmed consultants can raise support tickets — done from the admin portal, not from within the impersonated session

### Fiscal year philosophy (locked)
- Organisations have a **fiscal year END**, not a start — this is how real companies describe their accounting year ("year ending 31 December")
- Start is derived automatically: month after year-end, day 1
- `fiscal_year_start_month` and `fiscal_year_start_day` remain in DB but are derived fields, never directly entered by users going forward
- **First fiscal year end** is the single user-facing input: a full date picker (day + month + year), valid range = earlier of `date_of_registration`/`commencement_date` up to exactly 1 year after that anchor date
- **Commencement date matters:** earlier of `date_of_registration` OR `commencement_date` is the anchor for both the registration date floor AND the first fiscal year start. A company may commence before formal registration.

### Period generation philosophy (locked, replacing prior manual approach)
- **No manual generation button** — auto-generated on: (1) saving fiscal year settings, (2) hard-closing the last period of a year
- **No delete fiscal year** — not standard accounting practice, would cause audit issues, removed entirely
- **Stub first year** — company registered/commenced mid-year gets a short first year (anchor date → fiscal year end), then full 12-month years thereafter
- **Regeneration permanently blocked** once any period exists for a fiscal year — requires Consultant-assisted remediation if misconfigured
- **Quarterly period generation gap** — `_generate_periods_for_year` silently returns `[]` for non-monthly frequency. Known gap, not yet implemented.

---

## 13. MEMORY SYSTEM — WHAT IS STORED (will auto-appear in future chats)

The following are in Claude's persistent memory and will surface automatically:
1. Nathan's development goals and daily plan system
2. Nathan's nutritional status (SMA Gold 3, Meal Plan Phase 1)
3. Dimension value active-years + IO template system — both deferred to M8.3 (now built, so this should be revisited — the trigger condition exists)
4. M8.3 Period Management full scope (now substantially built)
5. Standing date constraint — registration date floor, app-wide
6. URL state persistence — UI Polish milestone, batch not piecemeal
7. Configuration Promotion Pipeline — scope in dedicated session
8. Impersonation system — full detail as above
9. Test-first tenant provisioning
10. **Standing ERP best practice principle** — always design per SAP/Oracle/Dynamics/Sage X3, flag deviations proactively, every session without exception

