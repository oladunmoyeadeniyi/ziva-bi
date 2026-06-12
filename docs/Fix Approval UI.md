UI improvements for the approval workflow. No backend changes 
needed — frontend only unless stated.

FIX 1 — Query banner wording
Current: "Query from approver (Level 3 — GM):"
Change to: "Query from [Approver Full Name] (GM):"
Use the actual name of the person who referred, not the level.

FIX 2 — Referred Back status label
Current: shows "Referred Back" generically
Change to:
- If referred to requestor: "Referred back to you"
- If referred to lower approver: "Referred to [Name]"
Use actual names throughout.

FIX 3 — Visible to requestor toggle default
Current: default is OFF (not visible to requestor)
Change default to: ON (visible to requestor)
The referring approver can turn it OFF if they want it internal.
Update the toggle label to: 
"Hide from requestor (internal query only)"
Default state: unchecked (meaning visible by default)

FIX 4 — Approval Progress layout redesign
The current layout puts approve/reject buttons too far below.
Redesign the expense detail page layout:

Desktop (md and above):
- Two column layout
- Left column (65%): Report header + Expense lines table
- Right column (35%): 
  - Approval Progress cards (sticky, scrolls with page)
  - Action panel (Approve / Refer Back / Reject buttons)
  - Comment field
  This way the approver always sees the approval status and 
  action buttons alongside the expense details

Mobile (below md):
- Single column
- Order: Header → Lines → Approval Progress → Action panel
- Action buttons full width, large touch targets (min 48px)

FIX 5 — Approval Progress cards
Make the cards more compact and informative:
- Show approver name prominently (not "Red Bull" — that is 
  the tenant name, not the person's name)
- Show first name + last name of the assigned approver
- Status with icon: 
  ✓ Approved (green) | ✗ Rejected (red) | 
  ↩ Referred Back (amber) | ● Active (blue) | ○ Awaiting (grey)
- Show timestamp only if actioned
- Show comment/reason below if rejected or referred back

FIX 6 — Action panel positioning
On desktop: action panel sits in the right column below 
approval progress, always visible without scrolling
On mobile: action panel fixed at bottom of screen as a 
sticky bar with Approve (green) | Refer Back (amber) | 
Reject (red) buttons

Test on both desktop and mobile viewport sizes.
Commit and push.