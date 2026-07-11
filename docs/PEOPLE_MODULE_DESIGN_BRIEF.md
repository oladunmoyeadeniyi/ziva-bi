# People Module — Architecture Design Brief

**Document type:** Design brief / pre-build consultation  
**Scope:** Employees, Positions, Org Roles, Transfers, Role Hierarchy  
**Status:** Proposed — requires sign-off before build  
**Author:** Ziva BI Architecture Review  
**Date:** 2026-07-06

---

## 1. The Core Problem with the Current Model

Ziva BI currently uses a **person-based HR model**: an `Employee` row has a direct `cost_center_id` FK and an `approval_role_id` FK. This is simple but creates serious gaps:

| Gap | Consequence |
|-----|------------|
| No "vacant position" concept | Cannot plan headcount before hire |
| Cost centre assigned to person, not role | When a role moves departments, you must manually re-assign every person |
| Approval chain tied to person's role at point of transaction | If someone moves mid-approval, chain becomes ambiguous |
| No effective-date model on cost-centre assignment | No audit trail; no ability to reconstruct "who was in Finance on 15 March?" |
| Employee upload template references role by name (string), not position | Breaks if roles are renamed; no hierarchy |

World-class ERP systems (Workday, SAP HCM, Oracle Fusion) all converge on the same answer: the **position-based model**. We need to adopt it — but pragmatically, not all at once.

---

## 2. The Position-Based Model (World Standard)

### 2.1 Core Concept

```
Org Structure (cost centres / departments)
        │
        ▼
   Positions  ◄─── these are the "slots" in the org chart
        │              e.g. "Head of Finance", "AP Controller", "Treasury Officer"
        ▼
   Employees  ◄─── people are assigned to positions
```

A **Position** is an independent entity that:
- Belongs to a cost centre (the org node)
- Has a designation / grade
- Reports to another position (hierarchy)
- Can be vacant or occupied
- Carries the approval role (OrgRole) — not the person

A **Person** (Employee) is assigned to a position. They inherit the position's cost centre, manager, and approval authority. When they leave, the position stays; when a new person joins, they slot into the same position.

### 2.2 Why This Matters for Every System Feature

| Feature | Person-based problem | Position-based solution |
|---------|---------------------|------------------------|
| Approval routing | Re-assign approver on every staff change | Approval chain says "Head of Finance position" — whoever occupies it approves |
| GL cost centre coding | Employee cost centre may be wrong after transfer | Position cost centre drives the coding at point of transaction |
| Finance Review Chain | Filter by employee attribute | Filter by position.function_code mapping |
| Budget | Budget allocated to employee | Budget allocated to position (survives attrition) |
| Historical queries | "Who approved this in March?" needs audit log | Position assignment history gives the answer directly |
| Headcount planning | Can't plan until hire is made | Create vacant position → plan cost → hire into it |

---

## 3. Proposed Data Model

### 3.1 New: `positions` table

```sql
positions (
  id            UUID PK,
  tenant_id     UUID FK → tenants,
  title         VARCHAR(200) NOT NULL,          -- "Head of Finance", "AP Controller"
  cost_center_id UUID FK → org_structure,       -- which dept/cost centre owns this position
  parent_position_id UUID FK → positions,       -- who does this position report to?
  grade         VARCHAR(50),                    -- salary grade / band (optional)
  function_code VARCHAR(50),                    -- "finance"|"hr"|"procurement" etc. (links to SystemFunctionMapping)
  is_head_of_cost_center BOOL DEFAULT false,    -- this position leads the cost centre
  max_occupants INT DEFAULT 1,                  -- 1 = single occupancy, >1 = shared/pooled
  is_active     BOOL DEFAULT true,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)
```

### 3.2 New: `position_history` table

Tracks every time a position moves in the org (cost centre change, parent change, reclassification).

```sql
position_history (
  id              UUID PK,
  position_id     UUID FK → positions,
  -- What changed
  old_cost_center_id   UUID,
  new_cost_center_id   UUID,
  old_parent_position_id UUID,
  new_parent_position_id UUID,
  -- When
  effective_date  DATE NOT NULL,
  change_type     VARCHAR(50),   -- 'restructure'|'reclassify'|'rename'
  change_reason   TEXT,
  change_notes    TEXT,
  -- Who
  changed_by      UUID FK → users,
  created_at      TIMESTAMPTZ
)
```

### 3.3 Modified: `employee_position_assignments` (replaces direct cost_center_id on Employee)

```sql
employee_position_assignments (
  id              UUID PK,
  tenant_id       UUID FK → tenants,
  employee_id     UUID FK → employees,
  position_id     UUID FK → positions,
  -- Temporal
  effective_from  DATE NOT NULL,
  effective_to    DATE,             -- NULL = current assignment
  -- Assignment type
  assignment_type VARCHAR(50),      -- 'substantive'|'acting'|'secondment'
  -- Transfer metadata
  transfer_reason VARCHAR(100),     -- 'hire'|'promotion'|'lateral'|'secondment'|'restructure'|'termination'
  is_retrospective BOOL DEFAULT false,
  -- Approval
  approved_by     UUID FK → users,
  -- Audit
  created_by      UUID FK → users,
  created_at      TIMESTAMPTZ
)
```

### 3.4 Modified: `employees` table

Remove `cost_center_id` and `approval_role_id` direct FKs — these now come through the position. Keep for backward compatibility with a **computed/denormalised** view.

> **Migration strategy:** Keep `cost_center_id` and `approval_role_id` on Employee for now (backward compat), and sync them from the active position assignment via trigger or application layer. Remove in M-People v2 once positions are fully live.

### 3.5 Modified: `org_roles` (approval roles)

Approval roles are currently assigned directly to OrgRole records. With positions, the link becomes:

```
Position → OrgRole (the position carries the approval authority)
Employee occupying Position → inherits OrgRole
```

Add `position_id FK → positions` to OrgRole (nullable — existing roles keep working until migrated).

---

## 4. Transfer Mechanics — Full Model

### 4.1 Types of Movement

| Type | What moves | Affects |
|------|-----------|---------|
| **Position move** | The position slot moves to a new cost centre or parent | All future transactions for anyone in that position use new CC |
| **Person transfer** | Employee moves from Position A to Position B | Employee's future transactions use new position's CC |
| **Acting assignment** | Employee temporarily covers another position | Secondary assignment; primary is preserved |
| **Secondment** | Employee moves to a new position for a fixed term with automatic return | Time-bounded; original position may be backfilled |
| **Promotion** | Employee moves to a higher-grade position | Like transfer but grade changes too |
| **Termination** | Employee leaves; assignment ends | Position becomes vacant |

### 4.2 Prospective vs Retrospective — Decision Framework

#### Prospective (default, safest)
- Effective date = today or a future date
- All transactions **before** the effective date: untouched — use old cost centre / old approver
- All transactions **from** effective date: use new position / new cost centre
- In-flight transactions at the cutover: **complete under old routing** (world standard — SAP, Workday both default to this)
- Budget: no automatic reallocation; finance can manually adjust

#### Retrospective
- Effective date = a past date
- **High risk** — affects reporting, GL, budget variances
- Use cases: correcting a hire date error; backfill a missed transfer
- Ziva BI approach:
  - Allow retrospective with **approval gate** (at least one admin must confirm)
  - Flag all transactions between the backdated date and today for **review** (not auto-recode)
  - Write audit log entry with `is_retrospective=true` and reason
  - Do **NOT** auto-recode historical GL entries — finance must review and decide on journal corrections separately
  - Surface the flagged transactions in a "Retrospective Review" queue (future milestone)

### 4.3 Effective Date Rules

```
Rule 1: effective_from must be ≥ employee's resumption_date
Rule 2: effective_from must be ≤ today + 365 days (cannot schedule too far ahead)
Rule 3: Retrospective: effective_from must be ≥ tenant's go-live date (cannot edit pre-system history)
Rule 4: If a period is HARD CLOSED, retrospective into that period is blocked (unless consultant override)
Rule 5: Two active assignments of type 'substantive' cannot overlap for the same employee
```

### 4.4 What Happens to In-Flight Approval Chains

This is the most critical design decision. The answer is **"complete under old authority"**:

1. Any expense report or AP invoice already in an approval chain at the time of the transfer → **continues under the original routing**. The approver doesn't change mid-chain.
2. New submissions after the effective date → routed using the new position's approval authority.
3. Edge case — approver is the employee who transferred: if the transferring employee is themselves an approver in an in-flight chain, the chain continues because the position's designation doesn't change; the person still holds the designation until their assignment ends.

This is also Workday's and SAP's default. It preserves audit integrity.

---

## 5. Role Hierarchy — How It Flows Through the System

### 5.1 Current State (OrgRole)

OrgRoles are approval authority roles: "Finance Director", "CFO", "AP Controller". They are linked to cost centres and carry approval thresholds. Employees link to OrgRoles via `approval_role_id`.

### 5.2 Target State

```
Position (Head of Finance, Finance cost centre)
    └── org_role_id → OrgRole "Finance Director"
         └── Threshold rules
         └── Designation fallback

Employee assigned to Position
    └── Inherits OrgRole from Position (computed)
    └── GL transactions coded to Position's cost centre
    └── Approval chain: resolved from Position's OrgRole
```

The key insight: **OrgRole is a property of a Position, not a Person**. This means:
- If Michael is Head of Finance today, he approves things as "Finance Director"
- If Michael transfers to CFO role, the next person who becomes Head of Finance automatically inherits the "Finance Director" approval authority
- No manual re-wiring needed

### 5.3 Hierarchy Traversal (For Approval Chains)

When the approval engine resolves "who approves at level N?":

```
1. Find the Position linked to this OrgRole
2. Resolve the occupant of that Position (current active assignment)
3. If vacant → use the parent Position's occupant (escalation)
4. If parent also vacant → escalate to the designated fallback designation
5. If no occupant anywhere up the chain → alert the tenant admin
```

This is the "vacancy escalation" pattern used by SAP and Workday.

---

## 6. What Happens When a Position Moves

Scenario: "Finance" cost centre is restructured — the "AP Controller" position is moved from Finance to a new "Shared Services" cost centre, effective 1 August.

**System actions (prospective):**

| Item | Action |
|------|--------|
| `positions.cost_center_id` | Updated to Shared Services |
| `position_history` | New row: old CC → Shared Services, effective 1 Aug |
| `system_function_mappings` | NOT automatically updated — Finance function still points to Finance CC; Shared Services needs to be mapped to a new function or finance function updated |
| Transactions before 1 Aug | Unchanged — still coded to Finance CC |
| Transactions from 1 Aug | Coded to Shared Services CC |
| In-flight approval chains | Complete under original routing |
| Budget | Flagged for review by finance (no auto-reallocate) |
| Employee `cost_center_id` (denorm) | Updated on 1 Aug by the application layer |
| `SystemFunctionMapping` for Finance Review | Finance admin reviews — may need to add Shared Services to Finance function or move it |

---

## 7. Bulk Upload Redesign

### 7.1 Current Template Columns

`First Name* | Last Name* | Email* | Other Name | Preferred Name | Employee Code | Phone | Cost Center Code | Line Manager Email | Resumption Date | Head of Cost Center (Y/N) | Org Role`

### 7.2 Problems

- References cost centre by code directly (bypasses position model)
- "Head of Cost Center Y/N" is a property of a position, not a person
- No position column — users can't specify the position slot
- Org Role is a string name — fragile

### 7.3 Proposed Template v2 (Position-Aware)

Phase 1 (before position table is live — practical bridge):

`First Name* | Last Name* | Email* | Employee Code | Cost Center Code* | Position Title | Org Role Name | Line Manager Email | Resumption Date | Other Name | Preferred Name | Phone`

- `Position Title` — if a position with this title in this cost centre exists, the employee is assigned to it; if not, a new position is auto-created
- `Org Role Name` — links the position to an existing OrgRole by name
- `Head of Cost Center` removed — this is now a property of the Position (is_head_of_cost_center flag), not a one-off upload field

Phase 2 (after positions table):

`First Name* | Last Name* | Email* | Employee Code | Position Code* | Assignment Type | Effective Date | Other Name | Preferred Name | Phone`

- `Position Code` references a pre-created position (positions are set up in the Org tab, not the upload)
- Cleaner, no ambiguity

### 7.4 Immediate Fix

The template download currently fails with a 500 error because `tenant_id` was never assigned in the backend handler (one-line bug — already fixed in this session). The fix is already committed.

---

## 8. Phased Build Plan

### Phase 1 — Immediate (this milestone)
**Goal:** Fix current bugs; keep person-based model but add temporal integrity.

- [x] Fix template download 500 bug (`tenant_id` assignment)
- [ ] Add `effective_date` to the `employee_transfers` table (it may already exist — verify)
- [ ] Ensure the transfer UI captures effective date, change type, and reason
- [ ] Add `is_retrospective` flag to transfers
- [ ] Block retrospective transfers into hard-closed periods
- [ ] Approval chain: document "complete under old routing" behaviour explicitly in code comments

### Phase 2 — People v1 (next milestone: M-People)
**Goal:** Introduce Positions as first-class objects.

- [ ] Create `positions` table + migration
- [ ] Create `position_history` table + migration
- [ ] Create `employee_position_assignments` table + migration
- [ ] Add "Positions" tab to Organisation page (list/create/edit/move positions)
- [ ] Link OrgRoles to Positions
- [ ] Update approval engine to resolve occupant via position assignment
- [ ] Update GL coding to pull cost centre from position (not employee directly)
- [ ] Update `SystemFunctionMapping` to map function → position (not just cost centre)
- [ ] Update Finance Review Chain to filter by position.function_code
- [ ] Update bulk upload template to Phase 2 format

### Phase 3 — People v2 (future)
**Goal:** Full vacancy management, acting/secondment, retrospective review queue.

- [ ] Vacancy management UI (positions without occupants)
- [ ] Acting and secondment assignment types with auto-return date
- [ ] "Retrospective Review" queue — surfaces flagged transactions for finance review
- [ ] Position-based budget allocation
- [ ] Headcount planning view

---

## 9. Immediate UI/UX Changes Needed (Before Phase 2)

Even without positions, the current People tab UX needs these fixes:

### 9.1 Add employees tab
- Fix the download template 500 error (done)
- Add: "Cost center code" column should show a dropdown in Excel (already exists in backend, was broken by the 500)
- Add: "Org Role" column should reference roles from the system

### 9.2 Employee list tab
- Add column: Position / Role title (from approval_role if present)
- Add column: effective date of current cost centre assignment

### 9.3 Transfers & changes tab
- Add: effective date picker (required)
- Add: change type selector (Promotion / Lateral / Restructure / Acting / Secondment)
- Add: retrospective toggle with warning + admin confirmation
- Add: reason / notes field
- Show: current position before and after

### 9.4 Code config tab
- No immediate changes needed

---

## 10. Key Design Decisions Requiring Confirmation

Before building Phase 2, the following decisions need to be locked:

| # | Decision | Options | Recommended |
|---|----------|---------|------------|
| D1 | Can one employee occupy multiple positions simultaneously? | Yes (acting) / No (single occupancy only) | Yes — allow acting/secondment as secondary |
| D2 | When position moves, auto-update `system_function_mappings`? | Auto / Manual review | Manual review — show alert to tenant admin |
| D3 | Retrospective transfers: who can approve? | Tenant admin only / Any admin | Tenant admin only |
| D4 | Can a position be deleted if it has ever had an occupant? | Hard delete / Soft delete / Archive only | Archive only (preserve history) |
| D5 | When employee has no position assigned, can they still transact? | Yes (fallback to direct CC) / No (block) | Yes during transition; No in Phase 2 |
| D6 | Grade/band: free text or tenant-configurable lookup? | Free text (simpler) / Lookup table | Free text for Phase 2, lookup in Phase 3 |

---

## 11. Summary Recommendation

The right architecture is clear: **position-based model**. Every major ERP converges here because it solves the right problem — the role/slot is the durable entity, not the person.

The pragmatic path for Ziva BI:

1. **Fix now:** Template download bug (done), transfer effective dates, retrospective flag
2. **Build next:** Positions table, position history, employee→position assignment
3. **Build later:** Vacancy management, acting/secondment, retrospective review queue

The foundation must be solid before we add modules like Payroll (where employee→position→cost-centre→grade determines salary band) and Budget (where headcount is planned by position, not person).

**Do not add Payroll or Budget until Positions are live.** They will be impossible to build correctly without this foundation.
