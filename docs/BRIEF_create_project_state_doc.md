Read docs/ZIVA_BI_ROADMAP.md, docs/MASTER_CONTEXT.md, and docs/TEST_TENANT.md first, then follow this brief.

# BRIEF — Create docs/PROJECT_STATE.md: The Authoritative Code/Schema/Endpoint Snapshot

## Why this exists

Claude (who writes the briefs) and Claude Code (who implements them) drift out of sync across chat sessions, because Claude reconstructs its understanding of the codebase from memory and from completion summaries, which go stale and are sometimes wrong (e.g. a recent "PASS" claimed a template dropdown existed when the actual file had none; another claimed cost centers came from dimension_values when they actually live in org_structure). This document is the single factual source of truth about the *actual current state of the code, schema, and API* — generated directly from the real repo and database, not from memory. It is what gets uploaded into every new chat so Claude starts accurate.

**Critical principle:** every fact in this document must be derived from the actual codebase/database RIGHT NOW, by reading files and querying the schema — NOT from memory, NOT from prior completion summaries, NOT from what "should" be true. If you cannot verify something directly, mark it explicitly as unverified rather than guessing. An inaccurate snapshot is worse than an incomplete one.

**This is a structural map, not a code dump.** Do NOT paste full file contents. Map where things live and what they do, with enough schema/endpoint/signature detail to be authoritative, so the document stays accurate and maintainable.

## Create `docs/PROJECT_STATE.md` with these sections

### 1. Header
- Generated date/time, current git commit hash (`git rev-parse HEAD`), current branch.
- One-paragraph project summary (Ziva BI: multi-tenant finance automation SaaS; stack: Next.js 15 frontend, FastAPI/Python backend, PostgreSQL).

### 2. Repository structure (file tree with purpose)
- A directory tree of `backend/app/` and `frontend/src/` (and other top-level dirs that matter), each meaningful file annotated with a one-line purpose.
- For backend routers: list each router file and the resource it owns (e.g. `hr.py — employees, cost-center options, bulk template/upload, transfers, head assignment`).
- For backend models: list each model file and the tables/models it defines.
- For backend services: list each service file and what it does (e.g. `tenant_clone.py — Phase 4 clone-on-create engine, 13 steps`).
- For frontend: map the main route/page structure under `frontend/src/app/`, each key page annotated with what it does. Don't enumerate every tiny component — focus on pages and significant shared components.
- Exclude noise (node_modules, build artifacts, logs, __pycache__).

### 3. Database schema (full, authoritative)
- Query the ACTUAL database (or read the models + migrations) to produce, for every table: table name, every column with its type and nullability, primary key, and every foreign key (column → referenced table.column, with on-delete behavior).
- Group logically (tenant/org tables, master data, HR/employees, GL/accounting, expense/approval, periods, audit).
- Explicitly note multi-tenancy: how tenant isolation works (which column, how it's enforced).
- Call out the known architectural invariants in-line where relevant:
  - Cost centers live in `org_structure` (node_type='COST_CENTER') — this is the SOLE source of truth; `dimension_values` cost_center rows exist but are NOT read by any live code path.
  - Functional currency and enabled currencies live only in `tenant_org_config`.
  - Standing date floor: no date may be earlier than `tenant_org_config.date_of_registration`.
  - `lifecycle_status` values and what each gates (e.g. Replace All only in `in_implementation`, Remap only when `live`).
  - Expense→GL posting is synchronous, same-transaction; uncoded lines block posting.

### 4. API endpoint inventory (full)
- Every endpoint across all routers: METHOD + path, one-line purpose, auth/tenant guard applied, and the main request/response shape at a high level (not full schemas — just enough to know what it takes and returns).
- Group by router/resource.
- Flag any endpoint that is stubbed/incomplete/deprecated (e.g. the invite endpoint that only console-logs instead of emailing; the deprecated/restored Replace All; manual journal entry if still stubbed).

### 5. Key models & their relationships
- For the core models (Tenant, TenantOrgConfig, Employee, OrgStructureNode, ChartOfAccount, DimensionValue/TenantDimension, CostCenterConfig, ApprovalMatrix, ExpenseReport/ExpenseApproval, AccountingPeriod, GlCodeRemap, journal/GL tables), describe key fields and how they relate. A concise relationship map, not exhaustive.

### 6. Feature/milestone status
- A table of major features and their actual current state (built & working / partially built / stubbed / not started), derived from what's actually in the code — not from the roadmap's intentions. Cover at minimum: expense submit→approve→GL posting, CoA management + remap, employee management + bulk upload, org structure, dimensions, period management (M8.3), tenant clone/test-environment, approval matrix, currencies/FX, tax & statutory.
- For anything partially built, note specifically what works and what's missing.

### 7. Environment & config facts
- DB name (`ziva_dev`), key config values that matter (CORS allowed origins, SMTP-is-empty-so-emails-stub, Supabase bucket/project), how to run backend (localhost:8000) and frontend (localhost:3000).
- Current test shadow tenant UUID (read from docs/TEST_TENANT.md, don't hardcode from memory) and its parent.
- Migration state: current alembic head.

### 8. Known gaps / tech debt / open questions
- Any TODOs, stubs, known-incomplete areas, or inconsistencies you encounter while generating this document. This section is valuable precisely because it surfaces what's NOT done.

## After creating it

- Commit and push `docs/PROJECT_STATE.md`.
- In your completion summary, report: total tables documented, total endpoints documented, total routers/models/pages mapped, and anything you found while generating it that surprised you or contradicts a prior assumption (these are high-value — they're exactly the drift points this document exists to catch).

## Standing instruction (note in the document itself)
Add a line at the top of PROJECT_STATE.md stating: "This document is regenerated/updated at the end of each working session before switching chats. It is the authoritative current-state snapshot. If anything here conflicts with memory or a prior summary, THIS document (verified against the live codebase on [date]) wins."

## Files CC is allowed to modify
- Create `docs/PROJECT_STATE.md` only. No code changes in this brief.

## Acceptance / completion summary must include
- Confirmation the document was generated by reading the ACTUAL codebase/database, not from memory or summaries.
- Counts: tables, endpoints, routers, models, frontend pages documented.
- The git commit hash captured in the header.
- A short list of anything discovered during generation that contradicts a prior assumption or completion summary (drift points caught).
- Confirmation it's committed and pushed.
