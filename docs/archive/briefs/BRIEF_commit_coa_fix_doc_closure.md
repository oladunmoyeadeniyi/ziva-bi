# BRIEF — Commit doc updates for CoA account_type fix + Default-CoA queue addition

**Status:** Docs-only. The code fix is already committed (`2eda43f`). This
commits the doc updates that close it out and add the new Default-CoA item
to the priority queue.

## Context

Two doc changes were made after `2eda43f` landed:

1. `CLAUDE.md` and `docs/MASTER_CONTEXT.md` §9 item 3 updated from "in
   progress" to "Resolved — commit `2eda43f`" with the fix summary.
2. A new priority-queue item added: **Default-CoA feature** (system-default
   CoA template + 3 tenant adoption paths), slotted into `MASTER_CONTEXT.md`
   §9 item 5 / §10 item 3 — right after UI Polish, ahead of the Currencies/FX
   decision and Super Admin Portal backend completion. `CLAUDE.md`'s
   milestone table got a matching row.

No application code changed in this brief — docs only.

## 1. Stage exactly this file set

```
docs/MASTER_CONTEXT.md
CLAUDE.md
docs/BRIEF_commit_coa_fix_doc_closure.md
```

Do **not** stage anything else currently in your working tree (there appear
to be several unrelated modified/untracked files — `docs/PROJECT_STATE.md`,
`frontend/.../organisation/page.tsx`, various `.bak` files, and other new
brief docs not covered here). Leave all of that untouched; it's outside this
brief's scope.

## 2. Commit and push

```
git commit -m "docs: close out CoA account_type fix (2eda43f), add Default-CoA feature to priority queue"
git push origin main
```

## If anything doesn't match

If `git diff --cached --stat` shows anything beyond the 3 files above, stop
and report back rather than committing.
