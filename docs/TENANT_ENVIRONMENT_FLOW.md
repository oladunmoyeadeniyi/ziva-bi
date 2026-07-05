# Ziva BI — Tenant Environment Flow: Full Design History & Current State
*Written June 28 2026. Share this in the new chat when discussing the tenant environment architecture.*

---

## 1. THE ORIGINAL DESIGN (locked in session ~June 21 2026)

### Architecture decision: Shadow Tenant Model (Option 3)
Chosen over two rejected alternatives:
- **Rejected Option 1** — environment column on all ~30 tenant-scoped tables: hundreds of queries to change forever, permanent leak risk if a filter is forgotten. Unacceptable for an accounting product where data integrity is everything.
- **Rejected Option 2** — Postgres schema-per-env: heavy plumbing, overengineered.
- **Chosen Option 3 — Shadow tenant**: a test environment is a linked shadow tenant row. `tenants` table gets two new columns: `environment` (live/test) and `parent_tenant_id` (links test shadow to its live parent). All ~30 existing tenant-scoped tables stay completely untouched — they isolate data automatically through existing `tenant_id` scoping.

### Original flow
1. A new tenant's **live environment is created first** (on signup or consultant-led creation)
2. A **test/shadow tenant is then created** as a linked shadow (same users get access to both)
3. The clone-on-create engine copies the live tenant's current state into the new test shadow (4,337 rows across 13 data categories, ~2 seconds)
4. Users toggle between environments via an **in-app environment toggle** — switch repoints the session's `tenant_id` at the live or test shadow tenant, same login
5. Finance team configures and tests changes in the test shadow
6. When ready, **promote test → live** = copy selected config between the two tenant_ids
7. Promotion is **repeatable, not one-time** — test env is an ongoing configuration rehearsal space
8. **Retention** = scheduled purge of test tenant's transactional data (not config); `test_data_retention_days` column (nullable int, default 90). No scheduler yet — `POST /api/tenant/purge-test-data` stub endpoint only.

### What was built against the original model
All four phases were completed and acceptance-tested:

**Phase 1 — DB + auth foundation:**
- `tenants` table: `environment` (live/test) + `parent_tenant_id` + `lifecycle_status` columns added via Alembic migration
- Existing tenants migrated to `environment="live"`
- `lifecycle_status` states: Trial / In Implementation / Live / Suspended
- Go-live endpoint links `lifecycle_status` to `environment="live"` atomically
- `CurrentUser.environment` added to auth middleware — every request knows its environment

**Phase 2 — Super Admin UI:**
- Create-test-environment entry point surfaced in Super Admin tenant detail page
- Promote entry point surfaced (gated: `is_super_admin && environment==="live" && test_environment exists`)

**Phase 3a — Promotion engine backend:**
- Repeatable diff-review-apply engine
- Natural-key matching for CoA and dimensions (matches on gl_number/code, not UUID — handles UUID differences between test and live)
- Computes CREATE / UPDATE / DEACTIVATE diffs
- Server-side recompute on apply (tamper-resistant)

**Phase 3b — Promotion review UI:**
- `frontend/src/components/PromotionReviewDialog.tsx` (new component)
- Grouped/collapsible by entity type, color-coded (green=create, amber=update, red=deactivate)
- UPDATE items show only changed fields (not full row dumps)
- Accepted-ids logic: explicit enumeration — even "Accept all" fills the set with every item id, never sends "all" as a shortcut
- Empty-diff handled gracefully ("already up to date" message)
- Error states handled (dialog stays open, error shown to user)
- 8/8 acceptance tests passed

**Clone-on-create engine (`tenant_clone.py`):**
- 13 steps, copies 4,337 rows when creating a test shadow from a live tenant
- Committed as a 31,654-line insertion (was discovered uncommitted and at risk of loss)
- Covers all 13 data categories including CoA, dimensions, employees, org config, etc.
- Creating test env clones live by default (opt-out toggle available)

### Open design questions that were NEVER resolved in the original design
1. **Where active environment lives** — JWT carries it? session swaps tenant_id? header? (JWT currently carries `tenant_id`, so switching env means reissuing/augmenting the token)
2. When a test env is created — auto for every live tenant, or on demand? (partially answered by new flow — see below)
3. **JWT/token reissue mechanics on env switch** — not designed or built
4. **What exactly "promote" copies** — the original build covered CoA + dimensions only; other config tables not yet included

---

## 2. ADENIYI'S PROPOSED CHANGE (this session, June 28 2026)

### The proposal (exact wording)
> "During implementation before going live, can we set it by default when creating a tenant or a tenant signup that it is the test environment that is created by default? After all configuration is done and the tenant is ready to go live or has requested to go live, it's upon promoting the configuration and preferences configured in the test environment to live that the live environment would now be created and all tenant users/staff can now log in to the account."

### What this changes — the inverted flow
**Original model:** Live tenant created first → test shadow created separately → promote copies config changes to already-existing live
**New model:** Test environment created FIRST (on signup) → no live environment exists yet → promotion event CREATES the live environment for the first time → live is BORN from promotion, never created empty

### The locked decision
> "When a new tenant is created or signs up, only a test/shadow environment is provisioned by default. No live environment exists until the tenant explicitly promotes their validated configuration. Live environment is born from a promotion event, never created empty. A live tenant with no configuration is therefore impossible by design."

### Why this is better
- Eliminates the risk of users logging into a half-configured live system
- Forces a deliberate go-live decision with a validated configuration
- Mirrors how serious ERP implementations work (Sage X3, Oracle) — you always configure in a sandbox first, never directly in production
- The existing clone-on-create engine becomes irrelevant at signup (nothing to clone — test IS the tenant from day one)

### What this breaks in the existing codebase
The existing Phase 1–3b code was built against the original model. The new flow requires these reconciliations:

1. **Clone-on-create engine** — currently clones a LIVE tenant into a new test shadow. Under the new model, there's no live tenant to clone at signup. The test env IS the tenant from day one. The clone engine may only be needed later (when a live tenant wants to create a fresh test shadow to test config changes post-go-live).

2. **Promotion engine** — currently copies config from test→live where live already exists. Under the new model, promotion must:
   - CREATE the live tenant row (new `tenants` record with `environment="live"`, `parent_tenant_id` pointing back to the test tenant)
   - Copy ALL validated configuration from test→live atomically
   - Mark the test tenant as `lifecycle_status="live"` equivalent (or the live tenant takes that status)
   - Trigger the ability for all tenant users to log in (currently their `tenant_id` would point to the test tenant — post-promotion, they need access to the live tenant)

3. **`lifecycle_status` flow** — needs to reflect the new path:
   - Test-only → In Implementation → (promotion event) → Live
   - The go-live endpoint currently links `lifecycle_status` to `environment="live"` but assumes live already exists

4. **User access model** — in the original model, the same users have access to both live and test via the toggle. In the new model, during implementation the users only have the test environment. Post-promotion, they need access to both (toggle between live and test for ongoing use).

---

## 3. WHAT PROMOTE SHOULD COPY (agreed this session)

**Copies to live:**
- Chart of Accounts (CoA)
- Dimensions (all configured dimensions + values)
- Periods (fiscal year settings, period calendar)
- Organisation config (org identity, structure, fiscal year end, feature flags)
- Approval workflows
- Document rules
- Module settings
- Roles & permissions config

**Stays in test (never promoted):**
- Transaction data (expense reports, journal entries, GL postings)
- Audit logs
- Employee submissions/approvals history

**Promotion includes a checklist** showing exactly what is/isn't included, presented to the user before confirming.

**Promotion is repeatable** — even after go-live, the test environment remains active as an ongoing sandbox. Finance team can configure changes in test, validate, then promote again. Not a one-time event.

---

## 4. OPEN QUESTIONS / PENDING DECISIONS

These were never resolved and must be settled before the reconciliation brief is written:

1. **JWT mechanics on env switch** — how does the in-app toggle work technically? Options:
   - Option A: JWT carries `tenant_id` only; switch = reissue JWT with new `tenant_id` (requires a round-trip to auth server)
   - Option B: JWT carries both `live_tenant_id` and `test_tenant_id`; switch = client changes active context, no new JWT needed
   - Option C: Session stores active `tenant_id`; JWT stays static; middleware resolves from session

2. **What happens to the test environment after go-live?** Does it:
   - Stay active as an ongoing sandbox (recommended — this is the "repeatable promotion" model)
   - Get archived/frozen
   - Get deleted

3. **User access post-promotion** — when the live tenant is created by promotion:
   - Do all existing test-tenant users automatically get access to live?
   - Or does the Ziva admin explicitly grant live access?
   - Can a user be test-only (e.g. an implementation consultant who shouldn't have live access)?

4. **The toggle in the new model** — in the original design, the toggle exists because both environments exist from the start. In the new model, during implementation there's no live to toggle to. Does the toggle appear only after go-live? Or is the concept of a toggle replaced by something else during implementation?

5. **Reconciling the existing Phase 1–3b code** — before writing the new brief, CC should read the existing code (`tenant_clone.py`, `PromotionReviewDialog.tsx`, the promotion endpoints in `setup.py` or wherever they live) and confirm exactly what needs to change vs what can stay. This is a REQUIRED first step — do not write a reconciliation brief without reading the existing implementation first.

---

## 5. IMMEDIATE NEXT STEP FOR NEW CHAT

Before writing any brief to reconcile the codebase with the new flow:

Tell CC:
```
Read docs/MASTER_CONTEXT.md and docs/PROJECT_STATE.md fully. Then show me: (1) the current tenant creation flow — what happens step by step when a new tenant is created, specifically what tenant rows are created and what lifecycle_status/environment values are set; (2) the current promotion endpoint — what it does step by step, what it copies, what it assumes about whether live exists; (3) the clone-on-create engine entry point — when is it called and what triggers it. Do not change anything. Report only.
```

This gives us the actual current state to design the reconciliation from, rather than guessing.

---
*End of document.*
