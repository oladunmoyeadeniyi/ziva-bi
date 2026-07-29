# M9 Bug Fixes — Round 2
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## FIX 1 — Revert GL selector UI

**Problem:**
The GL selector button style was changed in the last round and is now worse than before.

**Fix:**
Revert the GL selector to the style from before M9 bug fixes round 1:
- Unselected state: full-width blue OUTLINED button with "🔍 Select GL Account" text
- Selected state: compact blue FILLED chip showing GL number + name, with a small
  "change" link beside it
- Do not use the current style — go back to the previous implementation

---

## FIX 2 — Split logic is still wrong

**Problem:**
Split amounts are still deducting from the parent line total instead of subdividing it.

**Correct behaviour:**
- The parent line amount field is the TOTAL for that invoice (set by the employee)
- Split rows subdivide that total — each split row gets a portion of it
- The sum of all split row amounts should equal the parent line amount
- Progress indicator: "₦80,000 of ₦500,000 allocated" (sum of splits vs parent total)
- Progress bar fills as splits are allocated
- Amber warning if under-allocated when trying to submit
- Red warning if over-allocated
- The parent line amount field should NOT change when splits are added
- Grand total at bottom reflects parent line amounts only (not split rows separately)

---

## FIX 3 — Split amount fields not comma-formatted

**Problem:**
Amount fields inside split rows are not comma-formatted.

**Fix:**
Apply the same `fmtCommaInput` / `stripCommas` helpers already used on parent line
amount fields to ALL split row amount fields as well.

---

## FIX 4 — Line document upload redesign

**Problem:**
Document upload button placement and style needs improvement.

**Fix:**
- Position: bottom-right of each expanded line card
- Style: dashed border box (drag-and-drop zone), approximately 120px × 60px
- Text inside box: "📎 Drop file or click to upload"
- Supports both drag-and-drop AND click-to-browse
- Once a file is attached: box shows filename + a remove (×) button
- Multiple files: show count "2 files attached" with a "View all" link
- Paperclip indicator in collapsed card header remains (grey = none, green = attached)

---

## FIX 5 — Report Documents section redesign

**Problem:**
Report Documents section at the bottom of the form needs the same drag-and-drop
treatment as line-level document upload.

**Fix:**
- Replace the current "+ Attach Document" link with a dashed drag-and-drop box
- Style consistent with line-level upload box (Fix 4 above)
- Text: "📎 Drop files or click to upload — applies to the whole report"
- Supports drag-and-drop AND click-to-browse
- Multiple files supported
- List attached files below the box with remove (×) per file

---

## Notes for CC

- Apply Fix 4 and Fix 5 to both new/page.tsx and edit/page.tsx
- Fix 2 is a logic fix in SplitLinePanel.tsx — review the allocation calculation carefully
- Do not change any other UI elements not mentioned in this brief
- Test with at least 2 lines and 1 split before committing

## Commit Message
```
fix: M9 round 2 - GL selector revert, split logic, comma format splits, drag-drop upload
```

Then push to GitHub and update docs/MASTER_CONTEXT.md.

---

*End of M9 Bug Fixes Round 2 Brief. Written May 2026.*
