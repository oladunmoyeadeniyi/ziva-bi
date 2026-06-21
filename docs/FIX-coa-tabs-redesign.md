# CC Brief — CoA: Redesign Account Groups + FS Mappings Tabs

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change the Accounts tab or any other page
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CONTEXT

Two sub-tabs on the CoA page need redesigning:
1. Account groups — currently a flat list, needs an expandable 3-level tree
2. FS mappings — currently shows 0 accounts despite data in DB (bug + redesign)

Also: "Sheet 2 — Dimensions" still appears in the upload result banner —
remove it since Sheet 2 no longer exists in the template.

---

## CHANGE 1 — Remove "Sheet 2 — Dimensions" from upload result UI

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

Find where the upload result banner renders "Sheet 2 — Dimensions".
Remove that section entirely from the UI. Only Sheet 1 — GL Accounts
should appear in the upload result.

---

## CHANGE 2 — Account groups tab: 3-level expandable tree

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

### Data structure
The existing CoA list already has `gl_group`, `gl_subgroup`, `gl_sub_subgroup`
fields. Derive the tree from the loaded accounts client-side — no new API needed.

Build this derived structure:
```typescript
type GroupNode = {
  name: string;
  count: number;
  subgroups: {
    name: string;
    count: number;
    subSubgroups: {
      name: string;
      count: number;
    }[];
  }[];
};
```

Derive from `accounts` state by grouping on `gl_group` → `gl_subgroup` →
`gl_sub_subgroup`.

### UI
Replace the current Account groups tab content with:

```tsx
{/* Header */}
<div style bordered header>
  <span>GL group hierarchy — auto-derived from your chart of accounts</span>
  <span>{totalAccounts} accounts · {groupCount} groups</span>
</div>

{/* Tree */}
{groupNodes.map(group => (
  <div key={group.name}>
    {/* Level 1 — GL Group */}
    <button onClick={() => toggleGroup(group.name)}
      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-left">
      <i className={`ti ${expanded[group.name] ? 'ti-chevron-down' : 'ti-chevron-right'}`}
         style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
      <span className="text-sm font-medium">{group.name}</span>
      <span className="ml-auto text-xs text-gray-400">{group.count} accounts</span>
    </button>

    {expanded[group.name] && group.subgroups.map(sub => (
      <div key={sub.name} className="ml-6 border-l border-gray-200 pl-3">
        {/* Level 2 — GL Subgroup */}
        <button onClick={() => toggleSubgroup(group.name, sub.name)}
          className="w-full flex items-center gap-2 py-1.5 hover:bg-gray-50 text-left">
          <i className={`ti ${expandedSub[group.name+sub.name] ? 'ti-chevron-down' : 'ti-chevron-right'}`}
             style={{ fontSize: 13 }} />
          <span className="text-sm">{sub.name}</span>
          <span className="ml-auto text-xs text-gray-400">{sub.count} accounts</span>
        </button>

        {expandedSub[group.name+sub.name] && sub.subSubgroups.map(ssub => (
          <div key={ssub.name} className="ml-5 border-l border-gray-100 pl-3">
            {/* Level 3 — GL Sub-subgroup */}
            <div className="flex items-center gap-2 py-1.5">
              <i className="ti ti-minus" style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }} />
              <span className="text-xs text-gray-600">{ssub.name}</span>
              <span className="ml-auto text-xs text-gray-400">{ssub.count}</span>
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
))}
```

Add state:
```typescript
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());

const toggleGroup = (name: string) => setExpandedGroups(prev => {
  const next = new Set(prev);
  if (next.has(name)) next.delete(name); else next.add(name);
  return next;
});

const toggleSubgroup = (group: string, sub: string) => {
  const key = group + '||' + sub;
  setExpandedSubgroups(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
};
```

---

## CHANGE 3 — FS mappings tab: fix query + redesign

### 3a. Backend: fix FS mappings endpoint

**File:** `backend/app/routers/config.py`

Find the FS mappings endpoint (likely `GET /api/config/coa/fs-mappings` or
it may be derived from the main CoA list). The current endpoint returns 0
because `CoAListItem` omits `fs_head`, `fs_note`, `tb_mapping`.

Fix: use `CoAResponse` (full schema) instead of `CoAListItem` for the FS
mappings query, OR add a dedicated endpoint:

```python
@router.get("/coa/fs-mappings")
async def get_fs_mappings(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    account_type: Optional[str] = Query(None),
    fs_head: Optional[str] = Query(None),
):
    tenant_id = _require_tenant(current_user)
    q = select(ChartOfAccount).where(
        ChartOfAccount.tenant_id == tenant_id,
        ChartOfAccount.is_active == True,
    )
    if account_type:
        q = q.where(ChartOfAccount.account_type == account_type)
    if fs_head:
        q = q.where(ChartOfAccount.fs_head == fs_head)
    result = await db.execute(q.order_by(
        # Accounts WITH fs_head first, then unmapped at bottom
        ChartOfAccount.fs_head.is_(None),
        ChartOfAccount.fs_head,
        ChartOfAccount.gl_number,
    ))
    accounts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "gl_number": a.gl_number,
            "gl_name": a.gl_name,
            "account_type": a.account_type,
            "fs_head": a.fs_head,
            "fs_note": a.fs_note,
            "tb_mapping": a.tb_mapping,
        }
        for a in accounts
    ]
```

### 3b. Frontend: redesign FS mappings tab

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

Replace the current FS mappings tab content with:

- Filter bar: Account Type dropdown (All / PL / BS) + FS Head dropdown
  (populated from distinct fs_head values in loaded data)
- Table columns: GL Number | GL Name | FS Head | FS Note | TB Mapping
- Rows WITH fs_head: normal styling
- Rows WITHOUT fs_head: amber background (`bg-amber-50`), "not set" in
  italic gray for empty cells
- Sorted: mapped accounts first (sorted by FS Head), unmapped accounts
  at the bottom (amber rows)
- Footer: "Showing X of Y accounts · Z accounts have no FS Head set"
- Clicking a GL number navigates to that account in the Accounts tab
  (switch tab + set GL number filter)

---

## WATCH ITEMS
- Do NOT change the Accounts tab
- Do NOT change any upload logic
- Do NOT rewrite CORS in `main.py`
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`feat: coa tabs — expandable account groups tree, fix fs mappings query, redesign fs mappings table`
