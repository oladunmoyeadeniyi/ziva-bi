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
This is the single source of truth — owner, vision, stack, Three-Mode Architecture,
milestone status, and design decisions. Use it to judge whether new code is consistent
with the project direction, not just syntactically correct.

### 1. Read the pending commit brief
```
Read docs/PENDING_COMMIT.md
```
This contains: intent summary, files changed, what to verify, and the suggested commit message.


### 1b. Verify docs are updated before committing

Read both:
```
Read docs/MASTER_CONTEXT.md     (§5 Completed Milestones, §9 Next Milestone, footer)
Read docs/PROJECT_STATE.md      (header git commit/migration head, §2 schema, §4 endpoints, §5 page map, §6 feature status, §7 environment facts)
```

Check whether they already reflect the work in PENDING_COMMIT.md:
- If they **do** → proceed to Step 2.
- If they **do not** → **block the commit**. Write `docs/CC_RESULT.md` with status `BLOCKED — docs not updated`. Do NOT commit until Cowork updates the docs.

In CC_RESULT.md (both PASSED and FAILED), always include a **"Docs review"** section:
- Whether MASTER_CONTEXT.md and PROJECT_STATE.md were up to date before this commit
- Any inaccuracies spotted in the docs vs the actual code (wrong endpoint paths, stale migration heads, missing schema columns, etc.)
- Any CC architectural notes from this review that Cowork should incorporate into the docs

### 2. Check for unexpected file changes
Run:
```bash
git diff --name-only HEAD
git status --short
```
Compare the output against the files listed in PENDING_COMMIT.md.
- If a file is modified but NOT in the brief → flag it. It may be a truncation bug or
  an accidental edit. Do not commit it unless Cowork explicitly lists it.
- If a file is in the brief but NOT modified → flag it. The brief may be wrong, or
  the change may not have been written.
- CRLF-only changes (line endings) on files not in the brief are noise — ignore them.

### 3. Read each changed file in full
For every file listed in PENDING_COMMIT.md, read it completely. Cross-check:
- Does the code match the stated intent?
- Are there obvious bugs, missing error handling, or logic gaps?
- Do new backend endpoints match the schema they return?
- Do new frontend components call the correct API paths?

### 4. Run syntax, import, and type checks
```bash
# Backend — py_compile (syntax only)
cd backend
python -m py_compile <each changed .py file>

# Backend — import-time check (catches NameError, missing imports, circular deps)
# Run for each changed router/service/model
python -c "from app.routers.<module> import router"
python -c "from app.models.<module> import <Model>"
# (adjust import path per changed file)

# Migration chain validation (if any migration files changed)
alembic check

# Frontend — full type check
cd frontend
npx tsc --noEmit
```

### 5. Run ruff on changed Python files (if installed)
```bash
cd backend
ruff check <changed files> --select E,F,W --ignore E501
```

### 6. Architectural review (do this every time — not optional)

For every changed Python file, check:

**Security**
- Are SA-only endpoints guarded with `_sa(current_user)` or equivalent?
- Could an impersonating consultant call an endpoint they shouldn't?
- Are tenant IDs validated against the caller's tenant, not just taken from the URL?

**Data integrity**
- Is `blocking_complete` / any completion gate actually strict? Could a tenant reach
  go-live with a gap (e.g., partial mappings, missing required config)?
- Are new nullable columns handled defensively everywhere they're read?
- If a config field changes (e.g., `posting_mode` upgraded lite → full_erp), do
  existing rows break or behave unexpectedly?

**Correctness of counts/conditions**
- Are count-based completion checks meaningful, or could they pass with partial data?
  Flag if "at least one" is used where "all" is required.
- Are empty-catalogue edge cases handled without false positives?

**Query efficiency**
- Does a new endpoint run N+1 queries in a loop? Not a blocker but flag as a note.
- Are new WHERE clauses on indexed columns?

**API contract consistency**
- Does the new endpoint follow the same auth pattern, error codes, and response shape
  as existing endpoints in the same router?
- Are 404 vs 400 vs 403 used correctly?

**Backwards compatibility**
- Does a schema change break existing frontend pages that call the same endpoint?
- Is a new required field added without a default, which would break old callers?

**Known deferred issues**
- The brief may list known issues deliberately deferred. Accept these but list them
  in CC_RESULT notes so they're tracked.

### 7. Decision

**If everything checks out:**
- `git add` exactly the files listed in PENDING_COMMIT.md
- If `.claude/commands/review-commit.md` is modified (untracked or changed), include it too
- `git commit -m "<suggested message from PENDING_COMMIT.md>"`
- `git push`
- Delete `docs/PENDING_COMMIT.md` (stale once pushed)
- Archive the result: `cp docs/CC_RESULT.md docs/cc_results/CC_RESULT_$(date +%Y%m%d_%H%M%S).md`
  (create `docs/cc_results/` if it doesn't exist)
- Write `docs/CC_RESULT.md` with status PASSED

**If something is wrong:**
- Do NOT commit
- Leave `docs/PENDING_COMMIT.md` in place
- Write `docs/CC_RESULT.md` with status FAILED

### 8. After committing — always verify
```bash
git log --oneline -3
git status
```
Confirm the working tree is clean and the commit is on main.

### 9. Always write docs/CC_RESULT.md

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
- import-time check: OK (or "skipped — module path unclear")
- alembic check: OK / not applicable (no migration changes)
- tsc --noEmit: OK
- ruff: OK (or "skipped — not installed")
- Unexpected file changes: none (or list any CRLF-only noise ignored)
- Intent vs code: matched

## Architectural notes
<any non-blocking observations — efficiency, edge cases, future concerns>

## Post-commit actions needed
<e.g. "run alembic upgrade head" — or "none">
```

**Format — FAILED:**
```markdown
# CC Review Result

**Status:** FAILED
**Commit:** none — not committed
**Timestamp:** <date and time>

## Issues Found
<file path, line number or context, description, suggested fix>

## Architectural concerns (non-blocking)
<observations that are not blockers>

## Next step
Cowork must fix the issues above, then trigger /review-commit again.
```

## What you are NOT doing
- Do not rewrite or refactor code — only review and commit
- Do not change the commit message without flagging it first
- Do not commit files not listed in PENDING_COMMIT.md (except review-commit.md itself)
- Do not push if any check fails
