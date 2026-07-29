# BRIEF — Commit doc closure for Organisation tab restructuring

**Status:** Docs-only. No code change — this confirms work that already shipped.

## Context

"Organisation tab restructuring" was carried in `MASTER_CONTEXT.md` §9/§10 as a
pending item, referencing `docs/BRIEF-0-org-tax-restructure.md`. Reading the
actual current code confirms that brief is fully implemented already:

- `organisation/page.tsx`'s Configuration tab is flattened — no sub-tabs, just
  Financial features then Governance, stacked.
- Fiscal year settings live on `periods/page.tsx` (the Period Management page).
- Tax applicability is the first, gating tab on `tax/page.tsx`
  (`type Tab = "applicability" | "vat" | "wht" | "paye" | "other"`).

No build work is needed. `MASTER_CONTEXT.md` §5/§9/§10 and `CLAUDE.md`'s
milestone table have already been updated to reflect this. This brief just
commits that doc correction.

## 1. Stage exactly this file set

```
docs/MASTER_CONTEXT.md
CLAUDE.md
docs/BRIEF_commit_org_restructure_doc_closure.md
```

## 2. Commit and push

```
git commit -m "docs: confirm Organisation tab restructuring (BRIEF-0) already shipped, close out priority queue item"
git push origin main
```

## If anything doesn't match

If the file list doesn't match the working tree (e.g. if `organisation/page.tsx`
or `tax/page.tsx` or `periods/page.tsx` look different from what's described
above when you check them), stop and report back rather than committing.
