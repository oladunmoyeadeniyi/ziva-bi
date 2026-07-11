# /review-commit — Review Cowork changes and commit if intent matches code

You are acting as a **code reviewer and commit gatekeeper** for the Ziva BI project.
Cowork (the desktop AI) writes code and leaves `docs/PENDING_COMMIT.md` describing
what it did and why. Your job is to verify the code matches that stated intent,
then commit and push — or flag discrepancies for Adeniyi.

## Steps to follow every time

### 1. Read the pending commit brief
```
Read docs/PENDING_COMMIT.md
```
This contains: intent summary, files changed, what to verify, and the suggested commit message.

### 2. Read each changed file
For every file listed in PENDING_COMMIT.md, read it in full. Cross-check:
- Does the code match the stated intent?
- Are there any obvious bugs, missing error handling, or logic gaps?
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

### 4. Run ruff on changed Python files (if any)
```bash
cd backend
ruff check <changed files> --select E,F,W --ignore E501
```

### 5. Decision

**If everything checks out** (intent matches code, no syntax errors, no TS errors):
- `git add` exactly the files listed in PENDING_COMMIT.md
- `git commit -m "<suggested message from PENDING_COMMIT.md>"`
- `git push`
- Delete `docs/PENDING_COMMIT.md` (it is now stale)
- Report: "Commit <hash> pushed. All checks passed."

**If something is wrong** (intent mismatch, bug, type error, syntax error):
- Do NOT commit
- Report clearly: what file, what line, what the problem is
- Suggest the specific fix if obvious
- Leave `docs/PENDING_COMMIT.md` in place

### 6. After committing — always verify
```bash
git log --oneline -3
git status
```
Confirm the working tree is clean and the commit is on the correct branch (main).

## What you are NOT doing
- Do not rewrite or refactor code — only review and commit
- Do not change the commit message without flagging it first
- Do not commit files not listed in PENDING_COMMIT.md
- Do not push if any check fails
