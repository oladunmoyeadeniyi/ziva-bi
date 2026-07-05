Read docs/ZIVA_BI_ROADMAP.md, docs/MASTER_CONTEXT.md, docs/TEST_TENANT.md, and docs/PROJECT_STATE.md first, then follow this brief.

# BRIEF — DB State Verification + Full Severity-Ranked Codebase Audit + Self-Maintaining Issues Register

## Part 1 — Reconcile the DB-state discrepancy (do this first)

`docs/PROJECT_STATE.md` §8 and Gap #14 state the local `ziva_dev` DB was wiped in a June 2026 OS reload and is empty, needing all 36 migrations reapplied. But real work has been happening all session against live data (40 Red Bull employees uploaded, org structure visible, test shadow with 4,359 cloned rows). These contradict.

- Query the ACTUAL current state of `ziva_dev` right now: does it have data? How many tenants, how many employees on the shadow, is the migration state at head?
- Determine the truth and correct PROJECT_STATE.md §8 and Gap #14 to reflect reality. If the DB is populated and at head, say so. If the "wiped" note was stale boilerplate, remove it.
- Report the actual reconciled state in your completion summary.

## Part 2 — Full codebase audit (whole codebase, severity-ranked)

Audit the ENTIRE codebase — backend and frontend — for issues that would cause errors, data corruption, security holes, or failures during future build-up or live deployment. This is a real audit, not a formality.

**Look specifically for:**
- **Architectural errors / inconsistencies**: violations of the stated invariants (cost-center source of truth, currency source of truth, date floor, lifecycle gates, synchronous GL posting, GL immutability), split-source-of-truth, FKs pointing at the wrong table, models and migrations that disagree.
- **Data integrity risks**: missing/incorrect FK cascade behavior, places where money/journal balance could be violated, uncoded lines slipping through, period gates that can be bypassed, race conditions in same-transaction posting, anywhere debits≠credits could post.
- **Multi-tenant isolation holes**: any query, endpoint, or join that could leak or write across tenant boundaries; any endpoint missing the tenant guard; any place tenant_id is trusted from the request body instead of the JWT.
- **Auth / security**: missing auth guards, super-admin-only actions reachable without the guard, impersonation/readonly bypasses, token handling flaws, anything that lets a user act outside their role_tier.
- **Step omissions / incomplete sections**: half-built features that look done but aren't wired end to end (the doc already flags Currencies&FX backend, role_tier gating, manual journal UI, purge stub — confirm and find others), TODOs, stubs that silently no-op where a caller assumes success.
- **Future-deployment landmines**: hardcoded localhost/dev values that break in production, the SMTP stub silently swallowing failures, missing migrations, anything that works locally but would fail on a fresh deploy, anything depending on manual setup that isn't documented.
- **Error-handling gaps**: places that assume success without checking, swallowed exceptions, missing validation that would 500 on bad input.

**For EVERY finding, you MUST provide:**
1. **Severity**: Critical / High / Medium / Low.
   - Critical = data corruption, money/journal integrity violation, cross-tenant leak, auth bypass, or guaranteed live-deploy failure.
   - High = serious bug or security weakness likely to bite, but not instantly catastrophic.
   - Medium = real issue, limited blast radius or needs specific conditions.
   - Low = cleanup, polish, minor inconsistency.
2. **Evidence**: exact file + line reference(s) and a one-sentence explanation of the actual mechanism by which it fails. NO speculative findings without evidence — a finding you can't point to in the code does not go in the report. If you suspect something but can't confirm it, list it separately under "Unconfirmed suspicions" with what you'd need to check, NOT as a finding.
3. **Suggested fix** (one line — do NOT implement any fixes in this brief; this is audit-only).

Rank the whole report by severity, Critical first. Do not pad the report to look thorough — a short report of real issues is better than a long one of noise.

**This brief is AUDIT ONLY. Do NOT fix anything.** Fixes will be separate, prioritized briefs after Adeniyi reads the findings.

## Part 3 — Make PROJECT_STATE.md self-maintaining (standing change)

Add/restructure a section in `docs/PROJECT_STATE.md` called **"Known Issues Register"** that absorbs the current "Known Gaps / Tech Debt" section and the audit findings from Part 2, with this standing maintenance rule written into the document itself:

> **Maintenance rule:** This register is updated every working session. When an issue is resolved, DELETE it from this register (do not leave resolved items cluttering the list). When a new issue is found, ADD it with severity + evidence. Issues that remain unresolved STAY. Each issue carries: ID, severity, short title, evidence (file/line), and date first identified.

Going forward (note this as a standing instruction at the top of PROJECT_STATE.md): at the end of every working session, before a chat switch, CC refreshes the ENTIRE PROJECT_STATE.md (structure, schema, endpoints, feature status, AND the Known Issues Register) against the live codebase — removing resolved issues, keeping unresolved ones, adding newly-identified ones.

## Part 4 — MASTER_CONTEXT cleanup (fold in, since we're already restructuring docs)

PROJECT_STATE.md is now the authoritative source for all volatile facts (paths, schema, endpoints, status). Clean up `docs/MASTER_CONTEXT.md` so the two documents cannot contradict:
- Remove volatile facts from MASTER_CONTEXT: specific endpoint paths, schema/column details, anything that changes when code changes (including the stale `/api/config/cost-centers` and `/api/config/finance-review` paths flagged in PROJECT_STATE Gap #12).
- Keep in MASTER_CONTEXT only: durable decisions, architectural rationale ("why"), locked principles, milestone intent/roadmap context, and process/communication preferences.
- Where MASTER_CONTEXT needs to reference a fact, have it name the concept and point to PROJECT_STATE.md, never hardcode the volatile detail.
- Add a line at the top of MASTER_CONTEXT.md clarifying its role: "This document holds durable decisions and rationale (the 'why'). For current code/schema/endpoint facts (the 'what'), see PROJECT_STATE.md, which is authoritative for all volatile state."

## Files CC is allowed to modify
- `docs/PROJECT_STATE.md` (Part 1 correction, Part 3 restructure)
- `docs/MASTER_CONTEXT.md` (Part 4 cleanup)
- NO code files — this is audit + docs only.

## Completion summary must include
- Part 1: the actual reconciled DB state, and confirmation the doc was corrected.
- Part 2: the full severity-ranked audit report (Critical → Low), each finding with file/line evidence and one-line fix; plus the separate "Unconfirmed suspicions" list if any. Give a count per severity tier up front (e.g. "2 Critical, 5 High, 9 Medium, 12 Low").
- Part 3: confirmation the Known Issues Register exists with the maintenance rule baked in.
- Part 4: confirmation MASTER_CONTEXT no longer contains volatile facts and points to PROJECT_STATE.
- All doc changes committed and pushed, with commit hash.
