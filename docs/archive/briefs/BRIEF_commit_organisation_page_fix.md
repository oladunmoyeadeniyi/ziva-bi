# BRIEF — Commit the real organisation/page.tsx fix + doc updates

**Status:** Diagnosis from `docs/BRIEF_investigate_organisation_page_diff.md`
is in. Verdict: CRLF noise plus one small, real, intentional fix. Commit it
normally — no revert, no further investigation needed.

## Context

The ~1,500-line diff on `organisation/page.tsx` was almost entirely
line-ending noise. With `core.autocrlf=true` normalization, the real change
is 7 lines across two hunks: the `first_fiscal_year_end` date-picker upper
bound widened from `+1 year` to `+2 years` (with matching help text), and
that date input switched from controlled to the locked uncontrolled pattern
(`defaultValue=` + a `key` prop on tenant id). Both are correct and
consistent with already-decided UI patterns. MASTER_CONTEXT.md §9 and
CLAUDE.md's milestone table have already been updated to mark this resolved.

## 1. Stage exactly this file set

```
frontend/src/app/dashboard/business/setup/organisation/page.tsx
docs/MASTER_CONTEXT.md
CLAUDE.md
docs/BRIEF_commit_organisation_page_fix.md
```

Use `git -c core.autocrlf=true add ...` (or ensure `core.autocrlf=true` is
already set locally, per earlier sessions) so this doesn't accidentally
stage CRLF noise on top of the real change.

## 2. Verify before committing

```
git -c core.autocrlf=true diff --cached --stat
```

Confirm `organisation/page.tsx` shows roughly 7 lines changed, not 1,500+.
If it shows a large number, stop and report back — don't force the commit.

## 3. Commit and push

```
git commit -m "fix(setup): widen first_fiscal_year_end picker to +2 years, use uncontrolled date input"
git push origin main
```

## If anything doesn't match

If the file list or diff size doesn't match what's described above, stop
and report back rather than guessing or forcing it through.
