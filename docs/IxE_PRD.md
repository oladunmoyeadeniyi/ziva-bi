# IxE — Inter-Company Eliminations (Group Consolidation)
## Product Requirements Document

> **Status:** PRD complete — NOT YET BUILT  
> **Mode:** Full ERP only (`posting_mode = "full_erp"`)  
> **Depends on:** M8.3 Accounting Periods, GL Posting Engine, Financial Statements (Q1a/Q1b)  
> **Author:** Cowork — 2026-07-29  
> **Phase 1 scope:** 100% ownership only; no minority interest; no multi-currency translation  

---

## 1. Problem Statement

When a group of companies files consolidated financial statements, any transaction between entities within the group (intercompany) is eliminated from the group-level view — otherwise revenue, cost, receivables, and payables would be double-counted.

**Example:**
- Company A (parent) sells goods worth ₦5,000,000 to Company B (subsidiary). A records ₦5,000,000 revenue; B records ₦5,000,000 cost. If you add them without elimination, the group shows ₦5,000,000 revenue and ₦5,000,000 cost that never existed commercially.
- A is also owed ₦2,000,000 by B (intercompany receivable = B's payable). The group balance sheet must show neither; the net position within the group is zero.

IxE automates this: it identifies intercompany GL lines across entities, matches counterparty positions, generates elimination journals, and produces a consolidated P&L and balance sheet that presents the group as if it were a single economic entity.

**Why Full ERP only:** IxE requires in-app double-entry journals. Lite and Connected tenants export their GL to external systems; group consolidation across those systems is not PRAD's responsibility.

---

## 2. Glossary

| Term | Definition |
|---|---|
| **Consolidation group** | A named collection of entity tenants with one designated parent |
| **Parent tenant** | The top-level entity that owns (directly or indirectly) the other members |
| **Member tenant** | A subsidiary or controlled entity within the group |
| **Intercompany (IC) transaction** | Any GL posting where the counterparty is another entity within the group |
| **IC account** | A GL account tagged as intercompany — e.g. "Due from Group Companies" |
| **IC role** | The accounting character of an IC account (RECEIVABLE, PAYABLE, REVENUE, EXPENSE, LOAN_ASSET, LOAN_LIABILITY) |
| **Matching** | Linking Entity A's IC receivable line with Entity B's corresponding IC payable line |
| **Elimination journal** | A group-level journal that zeros out matched IC positions in the consolidated view |
| **Consolidated statements** | P&L and Balance Sheet assembled from all members' trial balances, then adjusted for eliminations |
| **NCI / Minority interest** | The portion of a subsidiary's equity not owned by the parent — **Phase 2 only** |

---

## 3. User Stories

### Group Setup (Power Admin / CFO at parent entity)
- As a CFO, I want to define a consolidation group so that I can manage which entities are consolidated together.
- As a CFO, I want to add or remove member entities so that I can reflect changes in group structure.
- As a CFO, I want to tag which GL accounts in each entity are intercompany so that IxE knows what to match.

### Period-End Workflow (Finance Admin)
- As a Finance Admin, I want to view all intercompany GL postings for a reporting period across all members so that I can see the full IC picture in one place.
- As a Finance Admin, I want IxE to auto-match offsetting IC positions (e.g. A's IC receivable vs. B's IC payable) so that I don't have to match manually.
- As a Finance Admin, I want to see unmatched IC items clearly so that I can chase the other entity to post the counterpart entry before close.
- As a Finance Admin, I want to generate elimination journals for a period with one click so that the consolidated view is immediately correct.
- As a Finance Admin, I want to view the consolidated P&L and Balance Sheet with eliminations applied so that I can produce group financial reports.

### Audit / Oversight
- As an auditor, I want to drill from a consolidated line item to the underlying entity GL postings and elimination journals so that I can trace every number.
- As a Power Admin, I want elimination journals to be immutable after posting (corrections via reversals) so that the audit trail is preserved.

---

## 4. Functional Scope — Phase 1

### 4.1 In Scope

1. **Consolidation group management** — create, rename, delete group; add/remove members; set ownership percentages (stored, not computed in Phase 1 since NCI is deferred).
2. **IC account tagging** — per entity, per GL account, assign an IC role. One account can have only one IC role. Roles: `RECEIVABLE`, `PAYABLE`, `REVENUE`, `EXPENSE`, `LOAN_ASSET`, `LOAN_LIABILITY`.
3. **IC transaction register** — for a selected group + period, pull all journal lines posted against tagged IC accounts across all member tenants. Display entity, GL account, IC role, amount, journal reference.
4. **Auto-matching** — pair IC RECEIVABLE lines in Entity A with IC PAYABLE lines in Entity B for the same period and amount (±tolerance configurable per group, default 0). Match IC REVENUE in A with IC EXPENSE in B on the same basis. Mark status PROPOSED.
5. **Manual matching** — Finance Admin can manually link two unmatched lines, or unlink a proposed match and re-match.
6. **Match confirmation** — Finance Admin confirms proposed matches (status → CONFIRMED). Disputed matches can be marked DISPUTED and excluded from elimination.
7. **Elimination journal generation** — for a period, generate elimination journals from all CONFIRMED matches. Journals live in a group-level context (not in any single entity's GL). Each journal balances (DR = CR). Immutable after posting.
8. **Elimination journal reversal** — if a period needs to be re-done, reverse the elimination journal and regenerate.
9. **Consolidated P&L** — sum all members' period P&L trial balance lines, apply CONFIRMED eliminations, present group-level P&L. Group currency = parent tenant's functional currency.
10. **Consolidated Balance Sheet** — same approach for BS; eliminations applied to relevant accounts.
11. **Unmatched items report** — list of all IC lines with no confirmed match, with entity and amount, so the Finance team can chase counterpart postings.

### 4.2 Out of Scope — Phase 1 (explicitly deferred)

- **Minority interest / NCI** — partial ownership stored but not computed. Consolidated statements show 100% of all entities.
- **Unrealised profit in inventory** — IC sales where goods remain in the buyer's inventory are not adjusted.
- **Intercompany dividends** — no special treatment; if dividend payable/receivable accounts are tagged, they will be matched and eliminated like any IC receivable/payable.
- **Multi-currency translation** — all member tenants must share the same functional currency as the parent in Phase 1. Cross-currency consolidation (CTA, IFRS 21) is Phase 2.
- **Equity method investments** — investment in subsidiary account elimination (parent's asset vs. subsidiary's equity) is Phase 2.
- **IFRS 10 / IAS 27 compliance disclosures** — no automated disclosure notes.
- **Consolidation across tenants in different posting modes** — all members must be Full ERP.

---

## 5. Database Design

Migration ID: `n2o3p4q5r6s7` — NOTE: `n2o3p4q5r6s7` is already taken (tenant_trial_lead_fields); assign a fresh unique ID when building IxE. Must chain from `p9q0r1s2t3u4` (ICE).

### 5.1 New Tables

#### `consolidation_groups`
```
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
parent_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
name              VARCHAR(120) NOT NULL
description       TEXT
currency          VARCHAR(3) NOT NULL DEFAULT 'NGN'
ic_match_tolerance NUMERIC(18,2) NOT NULL DEFAULT 0  -- abs amount diff allowed for auto-match
is_active         BOOLEAN NOT NULL DEFAULT TRUE
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(parent_tenant_id, name)
```

#### `consolidation_members`
```
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
group_id          UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE
member_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
ownership_pct     NUMERIC(5,2) NOT NULL DEFAULT 100.00  -- stored; NCI computation deferred to Phase 2
joined_at         DATE NOT NULL DEFAULT CURRENT_DATE
left_at           DATE  -- NULL = still a member
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(group_id, member_tenant_id)
```

#### `ic_account_mappings`
```
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
group_id          UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE
member_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
gl_account_id     UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE
ic_role           VARCHAR(20) NOT NULL  -- RECEIVABLE | PAYABLE | REVENUE | EXPENSE | LOAN_ASSET | LOAN_LIABILITY
counterparty_tenant_id UUID REFERENCES tenants(id)  -- NULL = any group member
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(group_id, member_tenant_id, gl_account_id)
INDEX(group_id, member_tenant_id)
```

#### `ic_matches`
```
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
group_id              UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE
period_id             UUID NOT NULL REFERENCES accounting_periods(id)
debit_tenant_id       UUID NOT NULL REFERENCES tenants(id)
debit_journal_line_id UUID NOT NULL REFERENCES journal_entry_lines(id)
credit_tenant_id      UUID NOT NULL REFERENCES tenants(id)
credit_journal_line_id UUID NOT NULL REFERENCES journal_entry_lines(id)
matched_amount        NUMERIC(18,2) NOT NULL
status                VARCHAR(10) NOT NULL DEFAULT 'PROPOSED'  -- PROPOSED | CONFIRMED | DISPUTED
match_type            VARCHAR(10) NOT NULL DEFAULT 'AUTO'      -- AUTO | MANUAL
matched_at            TIMESTAMPTZ NOT NULL DEFAULT now()
confirmed_at          TIMESTAMPTZ
confirmed_by          UUID REFERENCES users(id)
disputed_reason       TEXT
CHECK(debit_tenant_id <> credit_tenant_id)
INDEX(group_id, period_id, status)
```

#### `elimination_journals`
```
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
group_id      UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE
period_id     UUID NOT NULL REFERENCES accounting_periods(id)
reference     VARCHAR(60) NOT NULL  -- e.g. "ELIM-2026-01-001"
description   TEXT NOT NULL
total_dr      NUMERIC(18,2) NOT NULL
total_cr      NUMERIC(18,2) NOT NULL
status        VARCHAR(10) NOT NULL DEFAULT 'POSTED'  -- POSTED | REVERSED
reversed_by   UUID REFERENCES elimination_journals(id)
posted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
posted_by     UUID NOT NULL REFERENCES users(id)
CHECK(total_dr = total_cr)
INDEX(group_id, period_id)
```

#### `elimination_journal_lines`
```
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
elimination_journal_id  UUID NOT NULL REFERENCES elimination_journals(id) ON DELETE CASCADE
ic_match_id             UUID REFERENCES ic_matches(id)  -- the match that generated this line
member_tenant_id        UUID NOT NULL REFERENCES tenants(id)
gl_account_id           UUID NOT NULL REFERENCES chart_of_accounts(id)
debit                   NUMERIC(18,2) NOT NULL DEFAULT 0
credit                  NUMERIC(18,2) NOT NULL DEFAULT 0
narrative               TEXT
```

### 5.2 Index Strategy
- `ic_matches(group_id, period_id, status)` — primary query pattern for matching view
- `ic_account_mappings(group_id, member_tenant_id)` — IC account lookup per entity
- `elimination_journals(group_id, period_id)` — elimination retrieval per period

---

## 6. API Design

All routes under prefix `/api/consolidation`. Access: Power Admin or Finance Admin at the **parent tenant** only. Member tenants have read-only visibility into their own IC data within a group.

### Group Management

| Method | Path | Description |
|---|---|---|
| `GET` | `/groups` | List consolidation groups for the caller's tenant |
| `POST` | `/groups` | Create a new group (parent = caller's tenant) |
| `GET` | `/groups/{group_id}` | Group detail + members |
| `PATCH` | `/groups/{group_id}` | Update name, description, currency, tolerance |
| `DELETE` | `/groups/{group_id}` | Soft-delete (is_active = false) |
| `POST` | `/groups/{group_id}/members` | Add a member tenant |
| `PATCH` | `/groups/{group_id}/members/{member_id}` | Update ownership_pct or left_at |
| `DELETE` | `/groups/{group_id}/members/{member_id}` | Remove member (sets left_at = today) |

### IC Account Mapping

| Method | Path | Description |
|---|---|---|
| `GET` | `/groups/{group_id}/ic-accounts` | List all IC account tags for the group |
| `POST` | `/groups/{group_id}/ic-accounts` | Tag a GL account with an IC role |
| `DELETE` | `/groups/{group_id}/ic-accounts/{mapping_id}` | Remove a tag |

### IC Transaction Register + Matching

| Method | Path | Description |
|---|---|---|
| `GET` | `/groups/{group_id}/ic-transactions` | All IC GL lines for a period (`?period_id=`) |
| `GET` | `/groups/{group_id}/ic-unmatched` | Unmatched IC lines for a period |
| `POST` | `/groups/{group_id}/auto-match` | Run auto-match for a period |
| `GET` | `/groups/{group_id}/ic-matches` | List matches (filter by period, status) |
| `POST` | `/groups/{group_id}/ic-matches` | Create a manual match |
| `PATCH` | `/groups/{group_id}/ic-matches/{match_id}` | Confirm or dispute a match |
| `DELETE` | `/groups/{group_id}/ic-matches/{match_id}` | Unlink a PROPOSED or DISPUTED match |

### Elimination Journals

| Method | Path | Description |
|---|---|---|
| `POST` | `/groups/{group_id}/periods/{period_id}/eliminate` | Generate elimination journals from CONFIRMED matches |
| `GET` | `/groups/{group_id}/periods/{period_id}/eliminations` | List elimination journals for a period |
| `GET` | `/groups/{group_id}/eliminations/{journal_id}` | Journal detail + lines |
| `POST` | `/groups/{group_id}/eliminations/{journal_id}/reverse` | Reverse an elimination journal |

### Consolidated Statements

| Method | Path | Description |
|---|---|---|
| `GET` | `/groups/{group_id}/periods/{period_id}/consolidated-pl` | Consolidated P&L |
| `GET` | `/groups/{group_id}/periods/{period_id}/consolidated-bs` | Consolidated Balance Sheet |

---

## 7. Business Logic — Key Rules

### 7.1 Auto-Matching Algorithm
1. For each period, collect all journal_entry_lines where the GL account is tagged in `ic_account_mappings` for this group.
2. For pairs of IC accounts with complementary roles (RECEIVABLE ↔ PAYABLE; REVENUE ↔ EXPENSE; LOAN_ASSET ↔ LOAN_LIABILITY), group lines by (debit_tenant, credit_tenant, amount).
3. For each pair where |Entity A amount − Entity B amount| ≤ `ic_match_tolerance`, propose a match.
4. Do not propose a match if either line is already in a CONFIRMED match.
5. One journal line can participate in at most one match.
6. Insert all proposals as `ic_matches` with status `PROPOSED`.

### 7.2 Elimination Journal Generation
1. Can only be called if the period is in `CLOSED` or `GRACE` status (prevents eliminations against an open period).
2. Collect all CONFIRMED matches for the group+period.
3. For each match, generate two elimination lines:
   - Debit: reverse the selling/receivable entity's IC GL line (DR the P&L or BS account)
   - Credit: reverse the buying/payable entity's IC GL line (CR the P&L or BS account)
4. Group all elimination lines into a single `elimination_journal` per `generate` call (one journal per period per generate event).
5. Verify `total_dr = total_cr` before insert — if they don't balance, rollback and return 422.
6. If an elimination journal already exists for this period, return 409. The caller must first reverse the existing journal before regenerating.
7. The elimination journal is immutable after creation (corrections via reversal + regeneration).

### 7.3 Consolidated Statements
1. Fetch the trial balance for each active member tenant (using the existing trial balance query) for the period.
2. Sum each GL account across members. Group by IFRS account type (as in Q1a) for P&L vs. BS classification.
3. Apply elimination journal lines: for each elimination line, adjust the relevant entity's GL account balance in the aggregation.
4. Present:
   - **Consolidated P&L**: Revenue − Expense = Net Profit (group-level; IC revenue/expense zeroed by eliminations)
   - **Consolidated BS**: Assets = Liabilities + Equity (group-level; IC receivables/payables zeroed by eliminations)
5. Add a drill-through: each line shows the entity-level breakdown and the elimination adjustment.

### 7.4 Multi-Entity Data Access
- The parent tenant's Finance Admin queries data across all member tenants. This crosses tenant_id boundaries — a deliberate controlled exception.
- All cross-tenant data access is isolated to the `/api/consolidation/` router.
- Enforce: the caller's tenant must be `consolidation_groups.parent_tenant_id`.
- Member tenants cannot call any consolidation endpoint other than `GET /api/consolidation/groups/{id}/ic-transactions` scoped to their own tenant_id.

### 7.5 Period Guard
- Elimination journals require the target period to be CLOSED or GRACE. Enforce at the service layer. Return 422 with message "Period must be closed before eliminations can be generated" if the period is OPEN.
- Reversing an elimination journal re-opens the period for re-elimination but does not change the period's own status.

---

## 8. Frontend Pages

All pages live under `/dashboard/business/consolidation/`. Sidebar section: **"Group Consolidation"** — visible only in Full ERP mode.

### 8.1 Groups List (`/consolidation`)
- Table: group name, member count, currency, last elimination date, status badge (Active/Inactive)
- "New group" button → modal form (name, description, currency, tolerance)
- Row click → Group Detail

### 8.2 Group Detail (`/consolidation/[groupId]`)
- Header: group name, currency, tolerance, Edit/Delete actions
- **Members tab** — table of member tenants with ownership %, joined date, left date; "Add member" button; Remove button per row
- **IC Accounts tab** — table of GL account tags per member; "Tag account" button → modal (entity, GL picker, IC role); Remove per row

### 8.3 IC Transaction Register (`/consolidation/[groupId]/transactions`)
- Period selector (accounting periods of the parent entity)
- Table: entity, journal reference, date, GL account, IC role, debit, credit, match status badge
- "Auto-match" button → triggers `/auto-match` and refreshes
- Filter tabs: All / Matched / Unmatched / Disputed
- "Generate eliminations" button → triggers `/eliminate` for the selected period (disabled if period is not CLOSED/GRACE; disabled if unconfirmed matches exist)

### 8.4 Matches Review (`/consolidation/[groupId]/matches`)
- Period selector
- Table of PROPOSED matches: Entity A + line, Entity B + line, amount, "Confirm" / "Dispute" buttons
- Table of CONFIRMED matches (read-only, "Unlink" if no elimination journal exists for period yet)
- Table of DISPUTED matches with disputed reason field

### 8.5 Elimination Journals (`/consolidation/[groupId]/eliminations`)
- Period selector
- List of elimination journals: reference, description, total DR/CR, posted at, status badge
- "Generate eliminations" button (with same guards as 8.3)
- Drill into journal → lines table (entity, GL account, DR, CR, narrative)
- "Reverse" button on a posted journal → confirmation modal

### 8.6 Consolidated P&L (`/consolidation/[groupId]/consolidated-pl`)
- Period selector
- P&L table with entity columns + Eliminations column + Consolidated total column
- Collapsible account groups (Revenue, Cost of Sales, Gross Profit, Operating Expenses, EBITDA, Net Profit)
- Export to Excel button

### 8.7 Consolidated Balance Sheet (`/consolidation/[groupId]/consolidated-bs`)
- Same layout as P&L but for BS structure (Assets, Liabilities, Equity)
- Entity columns + Eliminations + Consolidated
- Check: Assets = Liabilities + Equity (display in footer; flag if out of balance)

---

## 9. Permissions

| Action | Required role |
|---|---|
| Create/edit/delete consolidation group | Power Admin at parent tenant |
| Add/remove members | Power Admin at parent tenant |
| Tag IC accounts | Finance Admin or Power Admin at parent tenant |
| View IC transactions | Finance Admin or Power Admin at parent tenant |
| Auto-match / manual match | Finance Admin or Power Admin at parent tenant |
| Confirm / dispute matches | Finance Admin or Power Admin at parent tenant |
| Generate elimination journals | Power Admin at parent tenant (irreversible step) |
| Reverse elimination journals | Power Admin at parent tenant |
| View consolidated statements | Finance Admin or Power Admin at parent tenant |
| View group's IC transactions (own entity only) | Finance Admin at member tenant |

---

## 10. Error Cases

| Scenario | Response |
|---|---|
| Member tenant not in Full ERP mode | 422 "Member [name] is not in Full ERP mode. IxE requires all members to use in-app GL." |
| Member tenant already in a different active group | Allowed (one entity can be in multiple groups) |
| Generate eliminations when period is OPEN | 422 "Period must be CLOSED or GRACE before generating eliminations." |
| Generate when elimination already exists for period | 409 "An elimination journal already exists for this period. Reverse it before regenerating." |
| Elimination journal lines don't balance | 422 "Elimination journal does not balance (DR ≠ CR). No journal was created." |
| Auto-match finds no candidates | 200 with `matches_created: 0` and `message: "No matching IC pairs found for this period."` |
| Caller's tenant is not the group's parent | 403 |
| Member tenant posting mode check at consolidation time | Service validates all members are `full_erp`; returns 422 listing any non-compliant members |

---

## 11. Migration Checklist for CC

When CC commits this module:

1. Migration must chain from `p9q0r1s2t3u4` (ICE). Assign a fresh unique ID — do not use `n2o3p4q5r6s7` (already taken by tenant_trial_lead_fields).
2. Run `alembic upgrade head` — verify all 6 new tables appear.
3. `py_compile` all new `.py` files.
4. `tsc --noEmit --skipLibCheck` on all new `.tsx` files.
5. Verify the `/api/consolidation/groups` endpoint appears in `/openapi.json`.
6. Smoke test: create a group, add two members, tag IC accounts, call auto-match for a period — verify 200 responses.

---

## 12. Phase 2 Notes (not designed yet — do not build)

- **Minority interest / NCI** — store `ownership_pct` in `consolidation_members` (already done); compute NCI share of subsidiary profit/equity in consolidated BS/P&L.
- **Translation reserve (CTA)** — consolidate entities in different functional currencies; apply closing rate for BS items, average rate for P&L items; record translation differences in equity.
- **Equity method** — for associates (<50% owned), present Ziva's share of associate profit/loss in the P&L line "Share of results of associates."
- **Unrealised profit elimination** — if Entity A sells inventory to Entity B and B has not yet sold it externally, eliminate A's profit on the unsold portion.
- **IFRS 10 / IAS 27 disclosure packs** — generate disclosure notes for consolidation basis, list of subsidiaries, significant judgements in consolidation.
