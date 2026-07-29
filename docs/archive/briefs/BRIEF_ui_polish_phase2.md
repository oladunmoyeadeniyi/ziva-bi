# BRIEF — UI Polish Phase 2 (findings D–H)

Read `docs/MASTER_CONTEXT.md` §5 (UI Polish Phase 1 entry) fully before starting. This is the second and final phase of the UI Polish milestone — Phase 1 (Button/PageContainer/PageHeading, commit `0d55ea8`) is done and out of scope here. This brief covers the remaining audit findings D–H: date-input pattern drift, tab-state lost on refresh, modal backdrop drift, banner color drift, and loading-state gaps.

All line numbers below were captured fresh against the current `main` (post-`0d55ea8`). Re-verify each with a grep before editing — a line may have shifted by a few lines from unrelated work, but the file and the defect should still be there. If a cited line/pattern is *not* there, stop and report rather than guessing.

## Scope

- **Build D** — converge all date inputs to the one locked pattern.
- **Build E** — sync tab state to the URL on the 6 pages that don't.
- **Build F** — standardize modal backdrop dim to `bg-black/40`.
- **Build G** — extract a shared `Banner`/`Alert` component, roll out across dashboard pages.
- **Build H** — add loading states to dashboard pages that fetch data but show nothing while loading.

Out of scope: anything already covered by Phase 1 (Button/PageContainer/PageHeading internals), any page outside `frontend/src/app/dashboard/` (platform/onboard/invite/auth/marketing pages keep their own conventions, same exclusion rule as Phase 1).

## STEP 0 — mandatory, before touching any file

1. Read `docs/MASTER_CONTEXT.md` §5 (Phase 1 entry) and this brief in full.
2. Re-run the greps in each Build section below against current `main` and confirm the line numbers/counts still roughly match. Note any drift in your completion summary.
3. For Build F: inspect `frontend/src/app/dashboard/business/settings/dimensions/page.tsx:2175` (`fixed inset-0 z-20`, no background). Confirm whether this is a dropdown/click-outside-catcher (not a true modal) or an actual modal missing its dim. Only fix it if it's a real modal.
4. For Build H: inspect `frontend/src/app/dashboard/business/setup/modules/[module]/page.tsx`. It showed zero `useEffect`/`fetch`/`await api` matches — confirm whether it genuinely has no async data load (e.g., all data comes from a parent layout/server component) before deciding it needs no loading state.
5. For Build D: identify the exact lines of `frontend/src/app/dashboard/business/setup/organisation/page.tsx` that already use the correct locked pattern (the fiscal-year-end field, fixed in commit `3ee5eba`) — use that as your template, and do not touch it.

## Build D — Date input convergence

**Locked pattern** (already established, do not relitigate): uncontrolled input via `defaultValue`, state updated **only** in `onBlur`, never `onChange`. Rationale: controlled `value=` + `onChange` on `type="date"` causes cursor/value-reset bugs mid-entry; `onBlur`-only avoids it.

Currently 3 patterns coexist. Convert all of the below to the locked pattern:

**Hybrid pattern (controlled + onChange + onBlur-triggered autosave)** — preserve the autosave behavior, just move the state write into `onBlur`:
- `frontend/src/app/dashboard/business/expenses/new/page.tsx:923` — `value={reportDate} onChange={...} onBlur={scheduleAutoSave}` → `defaultValue={reportDate} onBlur={(e) => { setReportDate(e.target.value); scheduleAutoSave(); }}`
- `frontend/src/app/dashboard/business/expenses/new/page.tsx:1093` — `value={line.invoice_date}` (per-line date, check full context for its onChange)
- `frontend/src/app/dashboard/business/expenses/[report_id]/edit/page.tsx:962` — same as the `new` page's :923
- `frontend/src/app/dashboard/business/expenses/[report_id]/edit/page.tsx:1134` — `value={line.invoice_date} disabled={!canEdit}` — preserve the `disabled` logic

**Controlled, onChange-only (no onBlur at all)** — convert to `defaultValue` + `onBlur`:
- `frontend/src/app/dashboard/business/settings/employees/page.tsx:787,823,916`
- `frontend/src/app/dashboard/business/settings/dimensions/[id]/values/page.tsx:362,367,471,474`
- `frontend/src/app/dashboard/business/setup/organisation/page.tsx:560,563` (`date_of_registration`, `commencement_date` — do NOT touch the already-correct fiscal-year-end field elsewhere on this page)

**Bare `type="date"` — inspect full surrounding context first, convert if controlled:**
- `frontend/src/app/dashboard/business/settings/dimensions/page.tsx:2028,2041,2386,2401`
- `frontend/src/app/dashboard/business/setup/currencies/page.tsx:911`
- `frontend/src/app/dashboard/business/setup/organisation/page.tsx:583`

## Build E — Tab state survives refresh

Reference (already correct — copy this exact pattern): `settings/dimensions/page.tsx`, `setup/organisation/page.tsx`, `settings/chart-of-accounts/page.tsx` — all use `useSearchParams` + URL sync for active tab.

Apply the same pattern to (confirmed via fresh grep: zero `useSearchParams` usage in all 6):
- `frontend/src/app/dashboard/business/approvals/page.tsx`
- `frontend/src/app/dashboard/business/expenses/page.tsx`
- `frontend/src/app/dashboard/business/setup/currencies/page.tsx`
- `frontend/src/app/dashboard/business/setup/periods/page.tsx`
- `frontend/src/app/dashboard/business/setup/roles/page.tsx`
- `frontend/src/app/dashboard/business/setup/tax/page.tsx`

If the reference pages wrap the tab-reading component in `<Suspense>` (Next.js App Router requirement for `useSearchParams`), mirror that too.

## Build F — Modal backdrop standardization

Canonical: `bg-black/40` (confirmed dominant — ~26 of ~34 modal instances already use it).

**Convert `bg-black/30` → `bg-black/40`:**
- `frontend/src/app/dashboard/business/setup/organisation/page.tsx:767,818`

**Add `bg-black/40` where the dim is missing entirely** (confirm each is a real modal, not a transparent click-catcher, before touching):
- `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx:2406`
- `frontend/src/app/dashboard/business/settings/dimensions/page.tsx:2289,2346,2445,2477`
- `frontend/src/app/dashboard/business/settings/employees/page.tsx:842` (also missing the centering classes the other 6 modals on this page have — add those too if confirmed to be a real modal)

Leave `dimensions/page.tsx:2175` (`z-20`, no bg) untouched unless Step 0 confirms it's a real modal, not a dropdown-close overlay.

## Build G — Shared Banner/Alert component

New file: `frontend/src/components/Banner.tsx`. Four variants — `success` / `error` / `warning` / `info` — based on the dominant existing shades across `dashboard/` (frequency-counted): green-50/green-700ish for success, red-50/red-700ish for error, amber-50/amber-700ish for warning, blue-50/blue-700ish for info. Before building, grep 4-5 real examples of each to capture the exact companion text/border classes (background alone isn't enough — match the full combination already in most common use).

Roll out across dashboard pages with inline banner/alert markup — confirmed present on (non-exhaustive, survey for more in Step 0): `setup/tax`, `setup/periods`, `setup/organisation`, `setup/modules`, `setup/go-live`, `setup/currencies`, `setup/account-mapping`, `settings/employees`, `settings/dimensions`, `settings/dimensions/[id]/values`, `settings/cost-centers`, `dashboard/profile`.

**Scope boundary**: only swap genuine status/alert banners (a message block telling the user something succeeded/failed/needs attention). Do NOT touch buttons, pills/badges, or icons that happen to share the same Tailwind color token (e.g. a `bg-green-600` button is not a banner). Judge by visual role, not by string match.

## Build H — Loading state coverage

33 dashboard pages total; 17 already show some loading indicator (`isLoading`, `loading &&`, `Loading...`, spinner, `animate-spin`). The other 16 were grepped for data-fetching (`useEffect`/`fetch(`/`await api`) — 15 of them clearly fetch data on mount and show nothing while it loads:

`admin/users`, `expenses/new`, `setup/bank-accounts`, `setup/organisation`, `setup/periods`, `setup/roles`, `setup/tax`, `setup/modules`, `setup/go-live`, `setup/documents`, `setup/page` (index), `personal/page`, `profile/page`, `dashboard/business/page`, `settings/expense-categories`.

The 16th, `setup/modules/[module]/page.tsx`, showed no fetch pattern — confirm per Step 0 #4 before deciding it needs nothing.

For each of the 15 confirmed pages, add a minimal loading state for the primary data fetch. Inspect 2-3 of the 17 already-covered pages first and copy whichever loading UI pattern (skeleton vs. spinner vs. text) is most common there, for consistency — don't invent a new pattern.

## Files you may modify

Only the files named above, plus the new `frontend/src/components/Banner.tsx`. If Build H's pattern-copy reveals a shared loading-skeleton component would reduce duplication, you may extract one (same precedent as Phase 1 extracting Button/PageContainer/PageHeading) — note it explicitly in your summary if you do.

**Do not touch:** Button.tsx / PageContainer.tsx / PageHeading.tsx internals (Phase 1, done), any page outside `dashboard/`, anything not named above. If you find more instances of D-H drift while working, list them in your summary rather than fixing them — they need their own sign-off.

## House rules

- Zero new npm dependencies — `Banner.tsx` should reuse `cn()` and the already-installed `lucide-react` icons (same as `Button.tsx` does), nothing new.
- Do NOT edit `docs/MASTER_CONTEXT.md` or `CLAUDE.md` — Cowork updates those after reviewing your diff, per the established workflow.
- Run `npm run type-check` and `npm run lint` clean before reporting done.
- Commit and push when done — work that isn't on GitHub doesn't exist.

## Acceptance / test steps (run these yourself, report actual output)

1. `grep -rn 'type="date"' frontend/src/app --include=page.tsx | grep 'value='` → must return 0 matches (locked pattern never uses controlled `value=`).
2. For each of the 6 Build E pages: `grep -L useSearchParams <file>` → 0 results (all 6 now import it). Manually switch tabs and hard-refresh on at least 2 of the 6 — tab must persist.
3. `grep -rn 'fixed inset-0' frontend/src/app --include=page.tsx | grep -v 'bg-black/40'` → only the confirmed-excluded click-catcher (if any) should remain; everything else converted.
4. `Banner.tsx` exists with 4 variants; report exact before/after counts of inline banner markup replaced per page.
5. All 15 Build H pages now match a loading-indicator grep; `modules/[module]/page.tsx` explicitly confirmed and explained either way.
6. `npm run type-check` → 0 errors. `npm run lint` → 0 errors.
7. Committed and pushed to `main`.

## Completion summary required

Report, explicitly:
- Exact before/after grep counts for each of D, E, F, G, H (not just "0 remaining" — show the actual grep command and output).
- Full list of files touched, grouped by build (D/E/F/G/H).
- The two Step-0 judgment calls and what you decided: `dimensions/page.tsx:2175` (modal or click-catcher?) and `modules/[module]/page.tsx` (fetches data or not?).
- The `Banner.tsx` component's 4 variants — exact class strings for each.
- Any additional D-H-pattern instances you found but did NOT fix (per the "list, don't fix" rule above).
- Confirmation that Phase 1 components (Button/PageContainer/PageHeading) and all non-`dashboard/` pages were untouched.
- The commit hash and confirmation it's pushed to `origin/main`.
