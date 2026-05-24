# M9 Bug Fixes
> Ziva BI | Written: May 2026
> Status: Ready for Claude Code execution

---

## Context
These are UI and logic fixes identified during M9 testing. M9 full testing is deferred
until M8.1 (full CoA template rebuild) is complete. These fixes address what can be
tested and corrected now.

---

## FIX 1 — Dimension values upload not working

**Problem:**
Dimension values cannot be uploaded via the bulk upload feature on the Dimension Values
page. As a result, dimension dropdowns on the expense form are empty.

**Fix:**
- Debug and fix the POST `/api/config/dimensions/{id}/values/upload` endpoint
- Test with both .xlsx and .csv files
- Confirm values appear in the dropdown on the expense form after upload
- Expected upload columns: `code` (required), `name` (required), `sort_order` (optional)
- Return clear error messages per row if validation fails

---

## FIX 2 — Compact expense line card

**Problem:**
Each expense line card takes too much vertical space. The form feels heavy and hard to
scan when multiple lines are present.

**Fix:**
- Reduce padding inside line cards
- Place fields in a tighter 2-column grid where possible:
  - Row 1: Amount (NGN) | Invoice Date | Invoice No
  - Row 2: Description (full width)
  - Row 3: Dimension fields (2 per row)
- Reduce font size of field labels slightly (12px)
- Line header (GL button + amount + status) should be compact and always visible
- Collapsed state: show only the line header (GL, amount, status indicator)
- Expanded state: show all fields
- New lines open expanded by default; completed lines collapse automatically

---

## FIX 3 — Split button placement and logic

**Problem A — Placement:**
"+ Add Split" button is at the bottom of the line card. It should be beside the line
total in the line header.

**Fix:**
- Move the Split button to the line header row, sitting beside the amount total
- Show as a small secondary button: "Split ⑂" 
- Only show Split button after the GL has been selected on the line

**Problem B — Split logic is wrong:**
Split lines are currently deducting from the parent amount. This is incorrect.

**Correct logic:**
- The parent line amount is the TOTAL for that invoice
- Each split row represents a portion of that total allocated to a different GL/dimension
- Split rows ADD together — their sum should equal the parent amount
- Progress indicator shows: "₦300,000 of ₦425,000 allocated" (allocated vs total)
- Warning shown in amber if under-allocated
- Warning shown in red if over-allocated
- Split rows do NOT have their own amount field added to the parent — they subdivide it

---

## FIX 4 — Support document button on line card

**Problem:**
Support document attach/view button is not clearly on the line card body.

**Fix:**
- Place "📎 Attach Document" button on the line card body
- Position: bottom of the expanded card, left-aligned
- Once a document is attached: show "📎 1 document attached — View" as a link
- Multiple documents: "📎 2 documents — View all"
- Clicking "View" opens the existing document viewer
- Document status should also be visible in the collapsed line header as a small icon
  indicator (paperclip icon, grey = none, green = attached)

---

## FIX 5 — Amount field comma formatting

**Problem:**
Amount input shows raw numbers (e.g. 50000) without comma formatting.

**Fix:**
- Format amount input with comma separators as the user types
- Display: 50,000 / 425,000 / 1,250,000
- Underlying stored value remains a plain number (no commas)
- Use a formatting utility function — apply consistently on ALL amount fields across
  the app (line amount, split amounts, grand total)
- Grand total at bottom of form should also be comma-formatted

---

## FIX 6 — GL button visibility and required field highlighting

**Problem A — GL button not prominent enough:**
The GL selector button is not visually distinct enough as the first required action on
a new line.

**Fix:**
- Style the GL selector as a prominent full-width button at the top of each new line
- Text: "🔍 Select GL Account" (or "🔍 Select Expense Type" for lower coding levels)
- Color: blue outlined button, not grey
- Once GL is selected: button becomes a blue filled chip showing GL number + name
  with a small "change" link beside it

**Problem B — Unfilled required fields not highlighted on submit attempt:**
When the user clicks Submit with incomplete lines, required fields are not clearly
highlighted.

**Fix:**
- On submit attempt: scroll to the first incomplete line and expand it
- Highlight each unfilled required field with a red border + red label
- Show a summary message at the top of the Expense Lines section:
  "2 lines incomplete — please fill all required fields before submitting"
- The message should list which line numbers are incomplete (e.g. "Lines 1 and 3")

---

## General Notes for CC

- Test all fixes with at least 2 expense lines
- Ensure fixes work on both new expense page and edit expense page
- Do not change any backend logic — these are frontend fixes only (except Fix 1
  which is a backend upload bug)
- Amount formatting utility should be a shared helper used across the whole app,
  not just on this page

---

## Commit Message
```
fix: M9 UI fixes - compact lines, split logic, document button, amount formatting, GL visibility, dimension upload
```

Then push to GitHub and update `docs/MASTER_CONTEXT.md`.

---

*End of M9 Bug Fixes Brief. Written May 2026.*
