# BRIEF — Commit M9.0.1 + Period Hardening, then run Red Bull retrofit

**Status:** Code complete and verified (py_compile + tsc both clean, 0 file
corruption). Blocked only on git locks a sandboxed session couldn't clear.
Run this from a local terminal with real filesystem + git access.

## 1. Clear stale git locks

Delete these two files (leftover from an interrupted git operation,
0 bytes, safe to remove):

```
.git/index.lock
.git/objects/maintenance.lock
```

## 2. Stage exactly this file set

Do **not** use `git add -A`. The working tree shows almost every file as
modified because of a CRLF/LF mismatch (working tree is CRLF, git history is
LF) — that's cosmetic noise, not real changes. Only these files have real
content changes:

```
backend/app/models/auth.py
backend/app/models/setup.py
backend/app/routers/auth.py
backend/app/routers/platform.py
backend/app/routers/setup.py
backend/app/routers/tenant.py
backend/app/schemas/platform.py
backend/app/schemas/setup.py
docs/MASTER_CONTEXT.md
docs/PROJECT_STATE.md
frontend/src/app/dashboard/business/setup/go-live/page.tsx
frontend/src/app/dashboard/business/setup/periods/page.tsx
frontend/src/app/platform/tenants/[id]/page.tsx
frontend/src/components/PromotionReviewDialog.tsx
backend/alembic/versions/k7l8m9n0o1p2_period_uniqueness_by_start_date.py
backend/scripts/__init__.py
backend/scripts/cleanup_duplicate_periods.py
backend/scripts/retrofit_red_bull_test_first.py
docs/BRIEF_M9_0_1_test_first_environment_flow.md
```

(Optional but recommended: set `git config core.autocrlf true` locally first
— it matches how the repo's history is actually stored and stops the
CRLF/LF noise from recurring on every future `git status`.)

## 3. Commit and push

```
git commit -m "M9.0.1: test-first tenant environment flow + period management hardening"
git push origin main
```

## 4. Leave alone — do not stage

```
*.bak files
backend/uvicorn_err.txt
backend/uvicorn_out.txt
frontend/src/app/dashboard/business/setup/organisation/page.tsx
```

The `organisation/page.tsx` file has a real, unrelated ~3000-line diff that
needs its own separate review — do not bundle it into this commit.

## 5. Run the Red Bull retrofit script

Re-points the existing Red Bull live/test tenant pair from the old
live-first `parent_tenant_id` direction to the new M9.0.1 test-first
direction. Two columns, two rows, `tenants` table only — see the script's
own docstring for full detail.

```
cd backend
python -m scripts.retrofit_red_bull_test_first                # dry run first
```

Read the dry-run output carefully — it prints the exact UPDATE statements
it plans to run and cross-checks the two tenant rows by name/environment
before touching anything. Only proceed with `--apply` if the plan matches
expectations:

```
python -m scripts.retrofit_red_bull_test_first --apply        # takes an automatic pg_dump backup first
```

## If anything doesn't match

If the file list above doesn't match what's actually in the working tree,
or the retrofit script's pre-flight checks fail, stop and report back rather
than guessing or forcing it through.
