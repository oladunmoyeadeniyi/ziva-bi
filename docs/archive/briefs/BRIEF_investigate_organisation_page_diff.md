# BRIEF — Investigate organisation/page.tsx diff (read-only, no commit)

**Status:** Diagnosis only. Do **not** stage, commit, or modify this file —
report findings back so the next step can be decided with real information.

## Context

`frontend/src/app/dashboard/business/setup/organisation/page.tsx` has shown
up as a large uncommitted diff (~1,500+ insertions/deletions, i.e. looks like
the whole file was rewritten) across several recent sessions. Two competing,
unconfirmed explanations are on record:

1. It's CRLF/LF noise — the working tree is CRLF, git history is LF, so a
   plain `git diff` flags every line as changed even when only a handful of
   real lines differ. This exact issue was confirmed and fixed for other
   files earlier in the M9.0.1 commit (`b3e70e3`).
2. An older brief (`docs/BRIEF_commit_m9_0_1_period_hardening.md`) explicitly
   called this "a real, unrelated ~3000-line diff that needs its own separate
   review" — implying it's not just whitespace.

Nobody has actually run the normalized diff to settle which is true. Standing
rule: don't diagnose or fix anything here without reading the real diff
output first.

## 1. Get the real diff size (strip CRLF/LF noise)

```
git -c core.autocrlf=true diff --stat -- frontend/src/app/dashboard/business/setup/organisation/page.tsx
```

Report the exact insertion/deletion counts from this command's output.

## 2. If the count is still large (more than ~20-30 real lines changed)

```
git -c core.autocrlf=true diff -- frontend/src/app/dashboard/business/setup/organisation/page.tsx > /tmp/org_page.diff
wc -l /tmp/org_page.diff
```

Then look through `/tmp/org_page.diff` and describe, in your own words, what
actually changed — e.g. "tab structure reordered," "new fields added to the
edit modal," "entire component re-indented," "looks like an older version
was pasted back in." Paste 2-3 representative hunks (not the whole file) so
the nature of the change is clear without flooding the report.

Also run, for context:

```
git log --oneline -5 -- frontend/src/app/dashboard/business/setup/organisation/page.tsx
```

and compare the file's on-disk modified time against the last commit date
for it — useful for telling whether this is leftover local work-in-progress
or something else.

## 3. If the count is small (mostly whitespace/CRLF)

No code-content investigation needed — just confirm this in your report and
note that a line-ending normalization (e.g. `git add --renormalize .` or
setting `core.autocrlf=true` locally, already recommended in an earlier
brief) would clean it up whenever it's convenient. Do not run that
normalization yet — just report.

## 4. Report back

Give a clear verdict: "real change" vs "CRLF noise" vs "inconclusive — needs
more digging," plus the evidence above. Do not stage, commit, or revert
anything on this file. The next step (keep the change, discard it, or
investigate further) will be decided after seeing your findings.
