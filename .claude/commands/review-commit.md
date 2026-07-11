# /review-commit — Review Cowork changes and commit if intent matches code

You are acting as a **code reviewer and commit gatekeeper** for the Ziva BI project.
Cowork (the desktop AI) writes code and leaves `docs/PENDING_COMMIT.md` describing
what it did and why. Your job is to verify the code matches that stated intent,
then commit and push — or flag discrepancies for Adeniyi.

## Steps to follow every time

### 0. Load project context (do this first, every time)
```
Read docs/MASTER_CONTEXT.md
```
This is the single source of truth — owner, vision, stack, Three-Mode Architecture, milestone status, and design decisions. Use it to judge whether new code is consistent with the project direction, not just syntactically correct.

### 1. Read the pending commit brief
```
Read docs/PENDING_COMMIT.md
```
This contains: intent summary, files changed, what to verify, and the suggested commit message.

### 2. Read each changed file in full
For every file listed in PENDING_COMMIT.md, read it completely. Cross-check:
- Does the code match the stated intent?
- Are there obvious bugs, missing error handling, or logic gaps?
- Do new backend endpoints match the schema they return?
- Do new frontend components call the correct API paths?

### 3. Run syntax and type checks
```bash
# Backend — py_compile every changed .py file
cd backend
python -m py_compile <each changed file>

# Frontend — full type check
cd frontend
npx tsc --noEmit
```

### 4. Run ruff on changed Python files (if installed)
```bash
cd backend
ruff check <changed files> --select E,F,W --ignore E501
```

### 5. Architectural review (do this every time — not optional)

For every changed Python file, check:

**Security**
- Are SA-only endpoints guarded with `_sa(current_user)` or equivalent?
- Could an impersonating consultant call an endpoint they shouldn't?
- Are tenant IDs validated against the caller's tenant, not just taken from the URL?

**Data integrity**
- Is `blocking_complete` / any completion gate actually strict? Could a tenant reach
  go-live with a gap (e.g., partial mappings, missing required config)?
- Are new nullable columns handled defensively everywhere they're read?
- If a config field changes (e.g., `posting_mode` upgraded from lite → full_erp), do
  existing rows break or behave unexpectedly?

**Correctness of counts/conditions**
- Are count-based completion checks (`am_count > 0`) meaningful, or could they pass
  with partial data? Flag if "at least one" is being used where "all" is required.
- Are `total_roles = 0` or empty-catalogue edge cases handled without false positives?

**Query efficiency**
- Does a new endpoint run N+1 queries in a loop? Not a blocker but flag it as a note.
- Are new `WHERE` clauses on columns that have indexes?

**API contract consistency**
- Does the new endpoint follow the same auth pattern, error codes, and response shape
  as existing endpoints in the same router?
- Are 404 vs 400 vs 403 used correctly (not-found vs bad-state vs unauthorized)?

**Backwards compatibility**
- Does a schema change break existing frontend pages that call the same endpoint?
- Is a new required field added without a default, which would break old callers?

**Known deferred issues**
- The brief may list known issues that are deliberately deferred. Accept these but
  still list them in the CC_RESULT notes so they're tracked.

### 6. Decision

**If everything checks out** (intent matches code, no syntax errors, no TS errors, no architectural blockers):
- `git add` exactly the files listed in PENDING_COMMIT.md
- `git commit -m "<suggested message from PENDING_COMMIT.md>"`
- `git push`
- Delete `docs/PENDING_COMMIT.md` (it is now stale)
- Write `docs/CC_RESULT.md` with status PASSED (see format below)

**If something is wrong** (intent mismatch, bug, type error, syntax error, architectural blocker):
- Do NOT commit
- Leave `docs/PENDING_COMMIT.md` in place
- Write `docs/CC_RESULT.md` with status FAILED (see format below)

### 7. After committing — always verify
```bash
git log --oneline -3
git status
```
Confirm the working tree is clean and the commit is on the correct branch (main).

### 8. Always write docs/CC_RESULT.md

Write this file as the **last action** every time, whether pass or fail.
Cowork reads this file so Adeniyi does not need to copy-paste terminal output.

**Format — PASSED:**
```markdown
# CC Review Result

**Status:** PASSED
**Commit:** <full commit hash>
**Branch:** main
**Timestamp:** <date and time>

## Checks
- py_compile: OK
- tsc --noEmit: OK
- ruff: OK (or "skipped — not installed")
- Intent vs code: matched

## Architectural notes
<any non-blocking observations about query efficiency, edge cases, future concerns>

## Post-commit actions needed
<any follow-up e.g. "run alembic upgrade head" — or "none">
```

**Format — FAILED:**
```markdown
# CC Review Result

**Status:** FAILED
**Commit:** none — not committed
**Timestamp:** <date and time>

## Issues Found
<file path, line number, description of problem, suggested fix>

## Architectural concerns (non-blocking)
<observations that are not blockers but worth noting>

## Next step
Cowork must fix the issues above, then trigger /review-commit again.
```

## What you are NOT doing
- Do not rewrite or refactor code — only review and commit
- Do not change the commit message without flagging it first
- Do not commit files not listed in PENDING_COMMIT.md
- Do not push if any check fails
