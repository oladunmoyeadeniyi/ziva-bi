# UI Polish Audit — punch list for sign-off

**Status:** Draft, for Adeniyi's review. Nothing here is briefed to CC yet — this is the "what," scoping happens after you mark priorities below.

**Method:** Code-level audit (no live browser access to localhost from this chat). 46 `page.tsx` files, ~25,700 lines, only 5 shared components (`AppHeader`, `LockedField`, `PromotionReviewDialog`, 2 expense-specific). Findings below are grep-verified with exact file:line evidence, not guesses.

**Root cause, stated up front:** almost every finding traces back to one thing — there's no shared `Button`/`Modal`/`Banner`/`PageHeader` component library. Every page hand-rolls its own Tailwind strings, and 46 files of copy-paste have drifted. Fixing the drift page-by-page would just recreate it next milestone; building 4-5 shared components once and swapping pages onto them is the actual fix.

---

## A. No shared `Button` component — 44 distinct variants of one button

Searched just the primary blue "submit" button (`bg-blue-600 text-white`) across all pages: **44 different className strings**, e.g.:

- `px-3 py-1 ... rounded` vs `px-4 py-2 ... rounded-lg` vs `px-5 py-2 ... rounded-md` (3 different paddings, 3 different corner radii for the same button)
- `disabled:opacity-50` vs `disabled:opacity-60` vs `disabled:opacity-70` (3 different disabled-state opacities)
- `transition-colors` present on some, absent on others (button feels "snappier" on some pages, abrupt on others)
- `min-h-[44px]` touch-target sizing present on a few buttons only — most buttons fall short of the 44px tap-target guideline on mobile

**Fix:** one `<Button variant="primary|secondary|danger" size="sm|md">` component, swap all 44 in.

---

## B. Page container/layout — two competing conventions

- **19 pages** use `<div className="p-8 max-w-{2-5}xl">` — fixed padding, not responsive, not centered.
- **7 pages** use `<div className="px-4 sm:px-6 py-8 max-w-{5,6}xl mx-auto">` — responsive padding, centered.

The first group will sit flush left on a wide monitor and feel cramped on a phone (no responsive breakpoint). Pick one (recommend the second — it's the one that's actually responsive) and apply everywhere.

---

## C. Page titles (`<h1>`) — 11 different style variants

| Style | Count |
|---|---|
| `text-xl font-semibold ... mb-1` | 19 |
| `text-xl font-bold` (no mb) | 10 |
| `text-xl font-semibold` (no mb) | 7 |
| `text-3xl font-bold` | 2 (landing/auth — probably fine to differ) |
| `text-base font-semibold mb-2` | 2 |
| 6 more one-off variants | 1 each |

Every setup/settings page title should be one style. Auth/landing pages can reasonably differ (different visual context).

---

## D. Date inputs — locked pattern not applied consistently

Project rule: native `<input type="date">`, **uncontrolled** (`defaultValue`), `onBlur` only (never `onChange`), explicit `null` on clear. This was deliberately settled after trial-and-error on the Organisation fiscal-year-end field. In practice, **3 different patterns coexist**:

1. **Locked pattern (correct):** Organisation page's fiscal-year-end field only.
2. **Controlled + onChange + onBlur (hybrid):** expense report date — `expenses/new/page.tsx:925`, `expenses/[report_id]/edit/page.tsx:965` — updates state immediately on change, autosaves on blur. Works, but isn't the documented pattern.
3. **Controlled + onChange only, no onBlur at all:** every other date field —
   - `expenses/new/page.tsx:1095`, `expenses/[report_id]/edit/page.tsx:1137` (invoice date per line)
   - `settings/dimensions/[id]/values/page.tsx:365,370,477,480` (validity dates)
   - `settings/employees/page.tsx:791,829,924` (transfer/code-effective/start date)
   - `setup/currencies/page.tsx:922` (FX rate date)
   - `setup/organisation/page.tsx:557,560` (date of registration, commencement date — on the *same page* as the one correctly-fixed field)

**Fix:** decide if the hybrid (#2) is now the real intended pattern or if everything should match #1, then apply one pattern to all ~13 fields above.

---

## E. Tab state lost on refresh — 6 of 10 tabbed pages

10 pages have in-page tabs (`useState` tab). Only 5 sync that to the URL (`useSearchParams`/`router.replace`), so the tab survives a refresh or back-button. The other 6 reset to the first tab every time:

- `dashboard/business/approvals/page.tsx`
- `dashboard/business/expenses/page.tsx`
- `dashboard/business/setup/currencies/page.tsx`
- `dashboard/business/setup/periods/page.tsx`
- `dashboard/business/setup/roles/page.tsx`
- `dashboard/business/setup/tax/page.tsx`

(Already flagged in old session-bootstrap notes as a "standing, batch-only" item — still real, still unfixed.)

---

## F. Modal backdrop — minor but real drift

Almost all modals use `fixed inset-0 z-50 flex items-center justify-center bg-black/40`. Exceptions:

- 2 modals use `bg-black/30` instead of `/40` (slightly lighter dim)
- 5 modals in `chart-of-accounts/page.tsx` (lines 2183, 2297, 2354, 2418, 2463, 2495) have **no backdrop color class at all** in the matched div — worth confirming in Step 0 of any brief whether the dim is applied elsewhere (e.g. a wrapper) or genuinely missing
- One instance uses `z-20` instead of `z-50` (line 2183) — could sit under other fixed elements

---

## G. Success/error banner colors — same drift pattern as buttons, smaller

Green success banners alone have at least 6 variants (`bg-green-50` vs `bg-green-100`, `text-green-700` vs `text-green-800`, with/without border). Same root cause as A — fold into a shared `Banner` component alongside the button fix.

---

## H. Loading states — likely under-covered (lower confidence, worth a closer look)

Only 25 `animate-pulse` skeleton instances found across all 46 pages. Several pages key loading purely off `isLoading &&` conditionals without a skeleton (e.g. `approvals`, `expenses` list pages just show/hide blocks — unclear what's visible during the gap). Not confirmed broken, just thin — worth a quick visual check once you're testing other things rather than a dedicated investigation.

---

## What's NOT in this list

- The old `ZIVA_BI_HANDOVER.md` 5-item backlog (combined Save button, fiscal-field relocation, etc.) — re-checked, mostly **superseded** by BRIEF-0's org/tax restructure already shipped. Not resurrected here; flag if you want any of those 5 specifically re-verified.
- Anything requiring a live browser session (actual visual spacing/alignment bugs, responsive breakpoints in practice, real click-through feel) — this audit is code-level only. A live pass once you're testing #86 would catch what grep can't.

---

## Your call

Mark which of A–H are in scope for this milestone (recommend A+B+C as the highest-leverage trio — building the shared components fixes most of the visible inconsistency in one pass) and I'll turn the agreed scope into a CC brief.
