Read docs/UI_POLISH_AUDIT.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — UI Polish Phase 1: shared Button, PageContainer, PageHeading

**Scope:** Frontend only. Builds 3 shared components and rolls them out across all pages, fixing audit findings A (44 button variants), B (page container — 2 competing conventions), and C (11 page-title variants). Findings D–H (date inputs, tab-state-on-refresh, modal backdrops, banner colors, loading states) are explicitly **out of scope** for this brief — separate future phase, do not touch them here even if you notice them while editing a file.

Root cause (per the audit): 46 pages hand-roll their own Tailwind strings with no shared component library, so copy-paste has drifted. The fix is building the 3 components once and swapping every page onto them — not touching pages piecemeal.

---

## STEP 0 — Read before changing anything (mandatory)

Read and report exact current state before editing anything:

- `docs/UI_POLISH_AUDIT.md` — full doc. This is the source-of-truth findings doc (analogous to a design-review doc) — it has the exact variant counts and file:line evidence for A/B/C. Re-run the greps it describes yourself and confirm the counts still match current code before trusting them (don't take the doc on faith — same rule as every other brief).
- `frontend/components.json` — confirm shadcn/ui is configured (`style: new-york`, `baseColor: zinc`, aliases pointing `ui` → `@/components/ui`) but `frontend/src/components/ui/` **does not exist yet** — zero shadcn primitives have been scaffolded despite the config being ready. Confirm this is still true.
- `frontend/src/lib/utils.ts` — confirm the `cn()` helper (clsx + tailwind-merge) already exists and is exported.
- `frontend/package.json` — confirm `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` are already installed (they are, as of this writing). This brief should need **zero new dependencies** beyond what scaffolding the shadcn Button component itself pulls in — confirm that holds once you run the CLI in Build A, and report if it doesn't.
- Pick 5 representative pages across different areas (e.g. one from `settings/`, one from `setup/`, one from `expenses/`, one from `approvals/`, one auth/landing page) and read their current button/container/h1 markup directly, to confirm the patterns described in the audit before mass-editing.
- `frontend/src/app/dashboard/business/setup/organisation/page.tsx` lines ~153-180 — note the inline `Field`/`Input` helper functions defined there. These are a separate page-local pattern, out of scope for this brief (not a button/container/heading), but flag in your completion summary whether they look like good future-phase candidates for promotion to shared components — don't build that now, just note it.

Report all of the above before writing any code.

---

## Build

### A. Shared `Button` component

Scaffold via the shadcn CLI rather than hand-rolling: `npx shadcn@latest add button` (this generates `frontend/src/components/ui/button.tsx` using CVA, matching the project's already-declared-but-unused shadcn setup). Then customize the generated variants — do **not** keep shadcn's default zinc/slate styling, replace it to match Ziva's actual existing brand colors, derived from the audit's own variant-frequency counts (use the single most common existing string for each, not an average or a guess):

- `variant="primary"`: the most common existing primary-action string — `bg-blue-600 text-white hover:bg-blue-700` (13 of 44 variants matched this exact blue, the largest single group).
- `variant="secondary"`: the most common existing secondary string — `bg-gray-100 text-gray-700 hover:bg-gray-200` (15 occurrences, the single largest group across all button colors).
- `variant="danger"` (or `destructive`, your call on naming — match whatever shadcn's convention calls it): `bg-red-600 text-white hover:bg-red-700`, sized **consistent with primary** (`px-4 py-2 text-sm font-medium`), not the small `text-xs px-2.5 py-1` red buttons seen in table rows — those are a different use case (see scope boundary below).
- All variants: `rounded-lg`, `text-sm font-medium`, `transition-colors` (missing on many existing buttons per audit — add to all), `disabled:opacity-60`, and `min-h-[44px]` on the default/medium size (touch-target gap flagged in the audit — a `size="sm"` variant for compact contexts doesn't need to hit 44px, your call on exact sizing scale).
- Optional but recommended: a `loading` prop (spinner + auto-disable) — several pages already hand-roll a "Saving…" disabled-button pattern; fold it in if it's a clean, low-risk addition. Skip it if it would require touching logic beyond className/markup swaps.

**Scope boundary (important):** only replace **primary page-level action buttons** — Save / Submit / Create / Add / Confirm / Cancel / Use-template, the kind that sit in forms, modals, or page headers. Do **not** touch small inline/per-row icon-only action buttons inside tables (e.g. an edit or delete icon button inside a `<tr>`) — different use case, deliberately deferred to a later phase to avoid risking 46-file-wide layout breakage in one pass. If a button is ambiguous, use judgment and note the call in your completion summary rather than guessing silently.

Apply the new `Button` component across all pages for every in-scope button instance (this is the highest-touch part of the brief — that's expected and fine, it's mechanical className/markup swapping, not logic change).

### B. Shared `PageContainer` component

Build `frontend/src/components/PageContainer.tsx`: a wrapper rendering `px-4 sm:px-6 py-8 {maxWidth} mx-auto` where `maxWidth` is a prop (e.g. `"3xl" | "4xl" | "5xl" | "6xl" | "7xl"`, default your call). This replaces **both** existing conventions — the old fixed `p-8 max-w-{N}xl` (19 pages) **and** the already-responsive-but-unshared `px-4 sm:px-6 py-8 max-w-{N}xl mx-auto` (7 pages) — so every page ends up on the shared component, not just the currently-broken ones.

**Preserve each page's existing max-width value** — read off whatever `max-w-Nxl` that page currently uses and pass it as the prop. Don't force every page to the same width; a wide table page (e.g. chart-of-accounts) legitimately needs more room than a simple form page. If a page's current width looks clearly wrong for its content (your judgment), note it in the completion summary rather than silently changing it.

### C. Shared `PageHeading` component

Build `frontend/src/components/PageHeading.tsx`: renders `title` (and an optional `subtitle`/`description`) in the single most common existing style — `text-xl font-semibold ... mb-1` (19 of the audit's 11 variants, the largest group).

Apply across all `dashboard/` pages (settings, setup, expenses, approvals, etc.). **Exclude** landing/marketing/auth pages (anything outside `dashboard/`, using `text-3xl font-bold` today) — the audit explicitly calls this a reasonable, deliberate difference in visual context. List exactly which pages you excluded and why in your completion summary.

---

## Files CC may modify/create

- `frontend/src/components/ui/button.tsx` (NEW — via shadcn CLI, then customized)
- `frontend/src/components/PageContainer.tsx` (NEW)
- `frontend/src/components/PageHeading.tsx` (NEW)
- Any/all `frontend/src/app/**/page.tsx` files — swapping in the 3 components above (expect most or all of the 46 pages to need at least one change)
- `frontend/package.json` / `package-lock.json` — only if the shadcn CLI adds a dependency genuinely required for the Button component; report exactly what was added and why if so

Do **not** touch: any backend file, any migration, `frontend/components.json` (config, not content), Tailwind config, anything related to audit findings D–H (date inputs, tab-state-on-refresh, modal backdrops, banner colors, loading states) — those are a separate future phase.

---

## House rules

- Zero new npm dependencies beyond what the shadcn Button scaffold itself requires — if the CLI wants to add something unexpected, stop and report rather than accepting silently.
- Primary/secondary/danger CTA-style buttons only — table-row icon-only action buttons are out of scope (see Build A scope boundary).
- Preserve each page's existing max-width in `PageContainer` — don't force uniform width.
- Landing/marketing/auth pages keep their existing `<h1>` styling — don't apply `PageHeading` there.
- Don't touch findings D–H even if you notice them mid-edit — note them for a future brief instead.
- `npm run type-check` = 0 errors.
- `npm run lint` = 0 new errors (state the before/after count if any pre-existing unrelated lint errors exist).
- Commit + push at the end (single commit is fine given this is one mechanical milestone — your call if you'd rather split into 2-3 logical commits, just report exactly what landed in each).

---

## Acceptance / test steps (state pass/fail each — via grep, not guesswork)

1. `frontend/src/components/ui/button.tsx`, `PageContainer.tsx`, `PageHeading.tsx` all exist. `Button` exports `primary`/`secondary`/`danger` variants and at least a default + `sm` size. Confirm via `git diff package.json` that no unexpected dependency was added.
2. Grep for the old in-scope button classNames (the primary/secondary/danger CTA patterns the audit identified) across all pages → 0 remaining matches. Separately confirm the count of small inline/table-row icon-action buttons (out of scope) is **unchanged** from the pre-edit baseline — i.e. you didn't accidentally touch them.
3. Grep for `<div className="p-8 max-w-` and the old `px-4 sm:px-6 py-8 max-w-{N}xl mx-auto` raw string (not via `PageContainer`) across all pages → 0 remaining matches for both. State how many pages now use `<PageContainer`.
4. Grep for the old 11 `<h1>` className variants on `dashboard/` pages → 0 remaining matches, excluding the explicitly-listed landing/auth exclusions. State how many pages now use `<PageHeading`.
5. `npm run type-check` → 0 errors.
6. `npm run lint` → 0 new errors.
7. Paste the relevant JSX snippet (button + container + heading usage) from 3 pages in different areas (e.g. one `settings/`, one `setup/`, one `expenses/` page) in your completion summary, so the result can be sanity-checked by reading without needing to run the app.

---

## Completion summary required

List every file created/changed (expect ~46-50). Confirm the dependency diff (expected: none beyond the Button scaffold's own requirement, or state exactly what was added and why). State exact before/after grep counts for each of the 3 categories (A/B/C). List which pages were excluded from the `PageHeading` swap and why. State approximately how many table-row icon buttons were deliberately left untouched. State whether the `Field`/`Input` inline helpers on the organisation page look like good future-phase candidates. Confirm commit hash(es) and that it's pushed. Report acceptance pass/fail for all 7 steps. Explicitly restate that findings D–H were **not** touched and remain open for a future phase.
