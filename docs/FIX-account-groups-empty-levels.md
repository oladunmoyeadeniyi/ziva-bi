# CC Brief — Account Groups Tree: Fix Empty Level Inheritance

## CRITICAL INSTRUCTIONS
1. Modify ONLY the files listed in the "Allowed files" section
2. Do NOT change anything else
3. Run `npm run type-check` before committing — zero errors required
4. List every file changed in your completion summary

---

## PROBLEM

When a GL account has no subgroup (gl_subgroup is null/empty), the tree
is incorrectly using the group name as the subgroup name. Same issue at
the sub-subgroup level — if gl_sub_subgroup is null/empty, the subgroup
name is being repeated as a fake sub-subgroup.

The correct behaviour:
- If ALL accounts in a group have no subgroup → group expands directly
  to show GL accounts (no subgroup level)
- If a subgroup exists but has no sub-subgroup → subgroup expands
  directly to show GL accounts (no sub-subgroup level)
- Never inherit parent name as child name at any level

---

## FIX

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

### Fix the groupNodes derivation

In the derivation that builds groupNodes from accounts, apply these rules:

```typescript
const groupMap = new Map<string, {
  count: number;
  accounts: GLAccount[];  // direct GL accounts with no subgroup
  subgroups: Map<string, {
    count: number;
    accounts: GLAccount[];  // direct GL accounts with no sub-subgroup
    subSubgroups: Map<string, {
      count: number;
      accounts: GLAccount[];
    }>;
  }>;
}>();

for (const a of accounts) {
  const groupKey = a.gl_group || "(No group)";
  if (!groupMap.has(groupKey)) {
    groupMap.set(groupKey, { count: 0, accounts: [], subgroups: new Map() });
  }
  const gNode = groupMap.get(groupKey)!;
  gNode.count++;

  const subKey = a.gl_subgroup?.trim() || "";
  if (!subKey || subKey === groupKey) {
    // No valid subgroup — GL account belongs directly to group
    gNode.accounts.push(a);
    continue;
  }

  if (!gNode.subgroups.has(subKey)) {
    gNode.subgroups.set(subKey, { count: 0, accounts: [], subSubgroups: new Map() });
  }
  const sNode = gNode.subgroups.get(subKey)!;
  sNode.count++;

  const ssKey = a.gl_sub_subgroup?.trim() || "";
  if (!ssKey || ssKey === subKey || ssKey === groupKey) {
    // No valid sub-subgroup — GL account belongs directly to subgroup
    sNode.accounts.push(a);
    continue;
  }

  if (!sNode.subSubgroups.has(ssKey)) {
    sNode.subSubgroups.set(ssKey, { count: 0, accounts: [] });
  }
  const ssNode = sNode.subSubgroups.get(ssKey)!;
  ssNode.count++;
  ssNode.accounts.push(a);
}
```

### Fix the tree rendering

The rendering must handle each level's direct accounts:

**Level 1 expansion (group → no subgroups):**
When `gNode.subgroups.size === 0` OR when group is expanded and has
direct accounts, render GL accounts directly:
```tsx
{gNode.accounts.map(a => (
  <div key={a.id} className="flex items-center gap-2 py-1 pl-8 hover:bg-gray-50 cursor-pointer"
    onClick={() => navigateToAccount(a.gl_number)}>
    <span className="text-xs font-mono text-gray-400 w-16">{a.gl_number}</span>
    <span className="text-xs text-gray-600">{a.gl_name}</span>
  </div>
))}
```

**Level 2 expansion (subgroup → no sub-subgroups):**
When subgroup has no sub-subgroups, show sNode.accounts directly.

**Level 3 expansion (sub-subgroup → GL accounts):**
Show ssNode.accounts.

---

## Allowed files:
1. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`fix: account groups tree — no fake level inheritance, direct GL accounts when level is empty`
