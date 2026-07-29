# Quick Fix: Input Field Text Contrast in Dark Mode

## Problem
When the user's OS/browser is in dark mode, input field text and placeholder text
are rendering with colors too close to the input background color (dark-on-dark),
making typed text and placeholders nearly invisible. This is happening across all
form input fields app-wide (confirmed on Organisation > Identity tab, but applies
globally).

## Root cause (likely)
Tailwind/ShadCN input components are likely using default/transparent background
and text colors that don't have explicit light-mode overrides, so they inherit
dark OS theme colors via `prefers-color-scheme` or unset CSS variables.

## Scope of this fix
This is a TEMPORARY, MINIMAL fix to unblock testing today. It is NOT the full
dark mode implementation (that is a separate future milestone — do not attempt
full theme support here).

## What to do
1. Force the app to render in light mode regardless of OS/browser theme setting,
   OR explicitly set input field background and text colors (e.g. white background,
   dark gray/black text, visible placeholder gray) so they are readable in both
   light and dark OS modes.
2. Apply this fix at the global level (e.g. root layout, global CSS, or a shared
   input component / ShadCN input theme override) — do NOT edit individual pages.
3. Preferred approach: add `color-scheme: light;` to the root HTML/body element
   AND ensure ShadCN input components have explicit `bg-white text-gray-900`
   (or equivalent) classes/tokens that don't depend on `prefers-color-scheme`.

## Files CC may modify
- Global CSS file (e.g. `frontend/app/globals.css` or equivalent)
- Root layout file (e.g. `frontend/app/layout.tsx`)
- Shared ShadCN input component (e.g. `frontend/components/ui/input.tsx`) — ONLY
  if input text/background colors are defined there

CC must not modify any other files. CC must list every file changed in its
completion summary.

## Acceptance criteria
- Text typed into any input field is clearly visible (dark text on light background)
  regardless of OS/browser dark mode setting
- Placeholder text is visible (light gray, but legible) in the same condition
- No other visual changes to the app (layout, spacing, colors of other elements unchanged)

## Note
Full dark mode support (theme toggle, color token system, contrast audit across
all components) is logged as a separate future milestone — NOT part of this fix.
