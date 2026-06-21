# CC Brief — Fix Account Groups Tree: All Level Issues

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## PROBLEMS TO FIX

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

### Issue 1 — Sub-subgroups truncated
Only 3 sub-subgroups show under Marketing Costs despite more existing.
Find and remove any `.slice()`, `.filter()` limit, or array cap on
sub-subgroups rendering. ALL sub-subgroups must render.

### Issue 2 — COGS subgroup shows itself as sub-subgroup
Accounts with no gl_sub_subgroup are being incorrectly added to
subSubgroups with the subgroup name repeated. Fix the derivation:
only add to subSubgroups if gl_sub_subgroup is non-empty string
AND gl_sub_subgroup !== gl_subgroup name.

### Issue 3 — Subgroups with no sub-subgroups show nothing
When a subgroup has no valid sub-subgroups (after fix 2), expanding
it shows nothing. Instead show individual GL accounts:
filter accounts where gl_group === group.name AND gl_subgroup === sub.name
AND (gl_sub_subgroup is null/empty/same as subgroup name).
Render them as leaf rows: GL number (monospace) + GL name.

### Issue 4 — Level 4 (GL accounts under sub-subgroup) not rendering
When a sub-subgroup node is expanded, individual GL accounts should
appear. Add a 4th level:
- Add expandedSubSubgroups state: Set<string>
- Toggle key: group.name + '||' + sub.name + '||' + ssub.name
- When expanded, show GL accounts filtered by gl_group + gl_subgroup
  + gl_sub_subgroup matching that node
- Each GL account row: GL number (monospace, muted) + GL name
- Clicking the GL number navigates to Accounts tab with that GL
  number pre-filtered (use existing navigation pattern)

### Data source
All four levels must derive from the FULL accounts list that includes
gl_sub_subgroup. Confirm CoAListItem now includes gl_sub_subgroup
(it was added in the previous fix). If not, use the fsMappings data
or the full CoAResponse list instead.

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`fix: account groups tree — all 4 levels, no truncation, correct sub-subgroup derivation`
