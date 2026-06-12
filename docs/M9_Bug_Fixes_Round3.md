# M9 Bug Fixes — Round 3
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## FIX 1 — Split dimension logic

**Problem:**
When a line is split, the parent line still shows dimension fields. These are meaningless
once a split exists — the dimensions belong on each split row, not the parent.

**Fix:**
- When a line has one or more split rows, hide/disable BOTH the GL selector AND
  the dimension fields on the parent line entirely
- The parent line becomes purely a container for: Amount, Invoice Date, Invoice No,
  Description, and the Split rows below it
- Each split row has its own GL selector and its own dimension fields
- The parent line amount field remains unchanged — it is the total for the invoice
- If all split rows are removed, restore the GL selector and dimension fields on
  the parent line
- This means: once split exists, GL + dimensions live exclusively on split rows

---

## FIX 2 — Upload box "Uploading" state showing incorrectly

**Problem:**
The drag-and-drop upload zone shows "Uploading" text when no file is being uploaded.

**Fix:**
- Audit the upload state management in both new/page.tsx and edit/page.tsx
- "Uploading" state should ONLY show when a file transfer is actively in progress
- Default/idle state: show "📎 Drop file or click to upload"
- Uploading state: show "Uploading..." with a spinner
- Complete state: show filename + remove (×) button
- Ensure state resets correctly after upload completes or fails

---

## FIX 3 — Collapsed line summary

**Problem:**
When a line card is collapsed, there is not enough information visible. The user has
to expand every line just to review it.

**Fix:**
Collapsed line header should show a compact summary row containing:
- Line number (#1, #2 etc.)
- GL chip (GL number + name) — or "No GL selected" in muted text if not yet selected
- Amount (comma-formatted)
- Dimensions summary: show each dimension value as a small pill/badge
  - If the line has splits: show "Split (N)" instead of individual dimension values
  - On hover of "Split (N)": show a tooltip listing each split's GL + dimensions
- Document indicator: paperclip icon
  - Grey = no document attached
  - Green = document(s) attached — clicking the green icon opens the document viewer
    directly without needing to expand the line
- Collapse/expand chevron (already exists — keep)

All of the above must fit in a single compact header row without wrapping.

---

## FIX 4 — GL button size and style

**Problem:**
The GL selector button is too bold and takes too much vertical space.

**Fix:**
- Unselected state: slim, single-line outlined button
  - Height: 36px (same as other input fields)
  - Border: 1px solid blue-400
  - Text: "🔍 Select GL Account" in blue-600, font-size 13px
  - Full width of the line card
  - No bold, no heavy background
- Selected state: slim blue filled chip (height 28px) showing GL number + name
  - "change" link in blue-400 beside it (font-size 12px)
  - Should not take more height than a normal input field
- The GL row in the line card should not stand out more than other field rows in
  terms of height — it should feel like part of the form, not a CTA button

---

## Notes for CC

- Apply all fixes to both new/page.tsx and edit/page.tsx
- Fix 1 requires careful state logic — test with: add line → add split → confirm
  parent dimensions hidden → remove all splits → confirm parent dimensions return
- Fix 3 tooltip on "Split (N)" is optional if complex — a simple expand on click
  is acceptable as fallback
- Do not change any other UI elements not mentioned in this brief

## Commit Message
```
fix: M9 round 3 - split dimensions, upload state, collapsed summary, GL button size
```

Then push to GitHub and update docs/MASTER_CONTEXT.md.

---

*End of M9 Bug Fixes Round 3 Brief. Written May 2026.*
