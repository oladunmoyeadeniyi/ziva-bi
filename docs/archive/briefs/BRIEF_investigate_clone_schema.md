Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Investigate Bank Accounts / Employees / Cost Centers schema for Phase 4 (clone-on-create). Report only, no changes.

**Purpose:** Designing "clone live's current state into a new test shadow on create-test-environment" (Phase 4). 3a/3b already solved Dimensions/CoA/DimValues/GLDimensionRequirement/TenantAccountMapping promotion (test→live, diff-based). Phase 4 reuses that logic for the SAME entities but in the OTHER direction (live→test, on creation, no diff needed since test starts empty) — PLUS three new entities not previously investigated: BankAccount, Employee, CostCenterConfig. Need their exact schema, natural keys, and dependency chains before designing. Investigate and report. Do NOT change any code.

---

## Investigate and report (no code changes)

### 1. BankAccount (`backend/app/models/bank_account.py`)
- Re-confirm full column list (should match what was built in the bank-accounts register brief — re-verify nothing changed).
- Any unique constraint (DB or app-level) usable as a natural key? (bank_name + account_number? account_number alone?)
- Confirm its only FK dependency is `gl_account_id` → chart_of_accounts (already being cloned by the reused 3a logic) — report if there's anything else (e.g. currency — is that just a string code, no FK?).

### 2. Employee (`backend/app/models/master_data.py`)
- Full column list, especially: `cost_center_id` (→ DimensionValue, per the earlier hr-relationships fix), `line_manager_id` (self-referential FK → employees.id, confirmed earlier this session).
- Any other FK columns on Employee not yet accounted for (e.g. user_id linking to a login account — IMPORTANT: does Employee link to a `users` table row? If so, does cloning an Employee into test need a corresponding test-tenant User, or can employee master-data exist independently of a login? Report exactly how Employee relates to authentication/users).
- Unique constraint / natural key candidate (email? employee_code?).
- Confirm: does Employee have any field that's clearly NOT safe/sensible to clone (e.g. a real email that would cause notification emails to fire if test-tenant logic ever emails employees — flag if so, no fix needed, just report).

### 3. CostCenterConfig (`backend/app/models/master_data.py`)
- Full column list: `cost_center_id` (→ DimensionValue), `head_employee_id` (→ Employee), `head_user_id` (→ users — report what this is for, separate from head_employee_id).
- Natural key candidate (likely tied 1:1 to a DimensionValue via cost_center_id — confirm cardinality, is it unique per cost_center_id?).

### 4. Dependency chain confirmation
Lay out the full dependency order needed for Phase 4, building on 3a's confirmed order:
```
TenantDimension → ChartOfAccount → DimensionValue (2-pass cascade) → GLDimensionRequirement → TenantAccountMapping
                                          ↓                                                              ↑
                                      [NEW] Employee (cost_center_id, line_manager_id self-ref) ─────────┘
                                          ↓
                                      [NEW] CostCenterConfig (cost_center_id, head_employee_id, head_user_id)
                                      [NEW] BankAccount (gl_account_id) — depends on ChartOfAccount only
```
Confirm or correct this ordering based on actual FKs found. Specifically confirm: can CostCenterConfig be created before ALL employees exist (if head_employee_id is nullable), or must it strictly come after every Employee is cloned?

### 5. The `users` / `user_id` question (important)
- Does cloning Employees into the test tenant require creating corresponding test-tenant `users`/login rows, or does `create-test-environment` already handle user mirroring (per the existing M9.0 logic noted in the earlier diagnosis — "all users mirrored from live tenant, same credentials")? Confirm whether existing user-mirroring logic already produces test-tenant user rows that Employee.user_id (if it exists) could link to, BEFORE Employee cloning runs — i.e. confirm the right order: users mirrored first (already happens), THEN employees cloned referencing those mirrored users.

### 6. Self-referential Employee.line_manager_id
- Confirm: is this nullable? Same two-pass concern as DimensionValue.cascade_value_id — report whether a two-pass approach (clone all employees first with line_manager_id=NULL, then a second pass to wire manager references using the id-map) is needed here too.

---

## Output
Write full findings to `docs/diagnosis_clone_schema.md`. Quote exact model code. This drives the Phase 4 design — precision matters more than brevity.
