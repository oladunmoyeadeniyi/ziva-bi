# BRIEF — Commit doc reconciliation (MASTER_CONTEXT.md, CLAUDE.md, PROJECT_STATE.md)

**Status:** Edits complete. This is a docs-only commit — no code changed. Run
from a local terminal with real filesystem + git access.

## Context

A 2026-06-29 audit found these three docs had drifted from the real shipped
state (M8.3 mislabeled as "Currencies & FX" instead of the Accounting Periods
Engine; ~7 fully-shipped milestones — Currencies & FX, M8.4 Tax & Statutory,
GL Posting Engine, Account Mapping & Bank Accounts, M9.0 shadow env, M9.1
Owner Portal tenant-lifecycle slice, Profile/Sessions/2FA — had no entry
anywhere; both docs described commit `b3e70e3` as "uncommitted" even though
`git log origin/main` confirms it's pushed). All three files have been
corrected to reflect verified current state (router list in `main.py`, the
alembic migration chain, and `git log`).

## 1. Stage exactly this file set

```
docs/MASTER_CONTEXT.md
CLAUDE.md
docs/PROJECT_STATE.md
docs/BRIEF_commit_doc_reconciliation_2026_06_29.md
```

Do **not** use `git add -A` — the working tree still shows a CRLF/LF mismatch
on unrelated files as "modified" (cosmetic, not real changes), and
`frontend/src/app/dashboard/business/setup/organisation/page.tsx` has its own
real, unrelated, still-unreviewed diff that must not be bundled into this
commit (see "Leave alone" below).

## 2. Commit and push

```
git commit -m "docs: reconcile MASTER_CONTEXT/CLAUDE/PROJECT_STATE with actual shipped state"
git push origin main
```

## 3. Leave alone — do not stage

```
*.bak files
backend/uvicorn_err.txt
backend/uvicorn_out.txt
frontend/src/app/dashboard/business/setup/organisation/page.tsx
backend/scripts/backups/
docs/TENANT_ENVIRONMENT_FLOW.md
docs/ZIVA_BI_HANDOVER_2_1.md
```

## 4. Optional — close out the one open item in PROJECT_STATE.md §8

PROJECT_STATE.md's Known Issues Register has exactly one unresolved item: the
Red Bull live+test tenant pair's `parent_tenant_id` retrofit status is
unconfirmed (script written, dry-run logic-checked, but never confirmed run
against the real local DB). This is read-only — just confirm current state,
don't change anything yet:

```sql
SELECT id, name, environment, parent_tenant_id, lifecycle_status
FROM tenants
WHERE name ILIKE '%red bull%';
```

Report back which direction `parent_tenant_id` points (test→live per the new
M9.0.1 model, or the old live→test direction). If it's still the old
direction, the retrofit script (`backend/scripts/retrofit_red_bull_test_first.py`)
still needs to be run — dry-run first, then `--apply` only if the plan looks
right (see the script's own docstring).

## If anything doesn't match

If the file list above doesn't match what's actually in the working tree,
stop and report back rather than guessing or forcing it through.
