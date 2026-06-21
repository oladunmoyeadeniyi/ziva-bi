# CC Brief — CoA: Add Dimensions Tab (Matrix View)

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section
3. Do NOT change any other tab or upload logic
4. Run `npm run type-check` before committing — zero errors required
5. List every file changed in your completion summary

---

## CONTEXT

Add a fourth tab "Dimensions" to the CoA page. It shows a matrix of
GL accounts vs configured dimensions, with each cell showing the
requirement level (Required / Optional / N/A). Supports cascading
filters, persistent multi-column sort, and bulk editing.

---

## CHANGE 1 — Backend: GL accounts with dimension requirements endpoint

**File:** `backend/app/routers/config.py`

Add a new endpoint that returns GL accounts with their dimension
requirements pre-joined:

```python
@router.get("/coa/dimension-matrix")
async def get_coa_dimension_matrix(
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = _require_tenant(current_user)

    # Load all active dimensions
    dims_result = await db.execute(
        select(TenantDimension)
        .where(TenantDimension.tenant_id == tenant_id,
               TenantDimension.is_active == True)
        .order_by(TenantDimension.sort_order)
    )
    dimensions = dims_result.scalars().all()

    # Load all GL accounts
    gl_result = await db.execute(
        select(ChartOfAccount)
        .where(ChartOfAccount.tenant_id == tenant_id)
        .order_by(ChartOfAccount.gl_number)
    )
    accounts = gl_result.scalars().all()

    # Load all dimension requirements for this tenant
    req_result = await db.execute(
        select(GLDimensionRequirement)
        .where(GLDimensionRequirement.tenant_id == tenant_id)
    )
    requirements = req_result.scalars().all()

    # Build a lookup: gl_id -> dimension_id -> requirement
    req_map: dict[str, dict[str, str]] = {}
    for r in requirements:
        gl_key = str(r.gl_id)
        if gl_key not in req_map:
            req_map[gl_key] = {}
        req_map[gl_key][str(r.dimension_id)] = r.requirement

    return {
        "dimensions": [
            {"id": str(d.id), "name": d.display_name or d.name}
            for d in dimensions
        ],
        "accounts": [
            {
                "id": str(a.id),
                "gl_number": a.gl_number,
                "gl_name": a.gl_name,
                "account_type": a.account_type,
                "gl_group": a.gl_group,
                "is_active": a.is_active,
                "requirements": {
                    str(d.id): req_map.get(str(a.id), {}).get(str(d.id), "optional")
                    for d in dimensions
                },
            }
            for a in accounts
        ],
    }
```

### Bulk update endpoint

```python
@router.patch("/coa/dimension-requirements/bulk")
async def bulk_update_dimension_requirements(
    data: dict,
    current_user: CurrentUser = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    data = {
      "gl_ids": ["uuid1", "uuid2"],
      "dimension_id": "uuid",
      "requirement": "required" | "optional" | "na"
    }
    """
    tenant_id = _require_tenant(current_user)
    _require_admin(current_user)

    gl_ids = [uuid.UUID(i) for i in data["gl_ids"]]
    dimension_id = uuid.UUID(data["dimension_id"])
    requirement = data["requirement"]

    if requirement not in ("required", "optional", "na"):
        raise HTTPException(status_code=400, detail="Invalid requirement value.")

    for gl_id in gl_ids:
        req_result = await db.execute(
            select(GLDimensionRequirement).where(
                GLDimensionRequirement.gl_id == gl_id,
                GLDimensionRequirement.dimension_id == dimension_id,
                GLDimensionRequirement.tenant_id == tenant_id,
            )
        )
        req_row = req_result.scalar_one_or_none()
        if req_row:
            req_row.requirement = requirement
        else:
            db.add(GLDimensionRequirement(
                tenant_id=tenant_id,
                gl_id=gl_id,
                dimension_id=dimension_id,
                requirement=requirement,
            ))

    await db.commit()
    return {"updated": len(gl_ids)}
```

---

## CHANGE 2 — Frontend: Dimensions tab

**File:** `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

### 2a. Add "Dimensions" to the tab list

Add a fourth tab after "FS mappings":
```tsx
<button onClick={() => setCoaTab("dimensions")}
  className={`...same tab style as others...`}>
  Dimensions
</button>
```

### 2b. Add state for dimensions tab

```typescript
type DimMatrixAccount = {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  gl_group: string;
  is_active: boolean;
  requirements: Record<string, string>; // dimension_id -> requirement
};

type DimMatrixDimension = { id: string; name: string };

const [dimMatrix, setDimMatrix] = useState<{
  dimensions: DimMatrixDimension[];
  accounts: DimMatrixAccount[];
} | null>(null);
const [dimMatrixLoading, setDimMatrixLoading] = useState(false);

// Filters
const [dimFilterType, setDimFilterType] = useState("");
const [dimFilterGroup, setDimFilterGroup] = useState("");
const [dimFilterReq, setDimFilterReq] = useState("");

// Sort (persistent)
const SORT_KEY_DIM = "ziva_coa_dim_sort";
const [dimSort, setDimSort] = useState<SortEntry[]>(
  () => loadSort(SORT_KEY_DIM)
);
useEffect(() => { saveSort(SORT_KEY_DIM, dimSort); }, [dimSort]);

// Selection for bulk edit
const [dimSelected, setDimSelected] = useState<Set<string>>(new Set());
const [bulkDimId, setBulkDimId] = useState("");
const [bulkReq, setBulkReq] = useState("required");
const [bulkSaving, setBulkSaving] = useState(false);
```

### 2c. Fetch dimension matrix when tab is active

```typescript
useEffect(() => {
  if (coaTab !== "dimensions" || dimMatrix) return;
  setDimMatrixLoading(true);
  apiFetch<typeof dimMatrix>("/api/config/coa/dimension-matrix", { token: accessToken })
    .then(data => setDimMatrix(data))
    .finally(() => setDimMatrixLoading(false));
}, [coaTab, accessToken]);
```

### 2d. Cascading filters for dimensions tab

```typescript
const dimAfterType = (dimMatrix?.accounts ?? []).filter(a =>
  !dimFilterType || a.account_type === dimFilterType
);

const dimGroupOptions = useMemo(() =>
  Array.from(new Set(dimAfterType.map(a => a.gl_group).filter(Boolean))).sort()
, [dimAfterType]);

const dimAfterGroup = dimAfterType.filter(a =>
  !dimFilterGroup || a.gl_group === dimFilterGroup
);

const dimFiltered = dimAfterGroup.filter(a => {
  if (!dimFilterReq) return true;
  const reqs = Object.values(a.requirements);
  if (dimFilterReq === "has_required") return reqs.includes("required");
  if (dimFilterReq === "all_optional") return reqs.every(r => r === "optional");
  if (dimFilterReq === "has_na") return reqs.includes("na");
  return true;
});

const dimSorted = applySort(
  dimFiltered as unknown as Record<string, unknown>[],
  dimSort
) as DimMatrixAccount[];
```

### 2e. Summary stats

```typescript
const dimStats = useMemo(() => {
  const accs = dimMatrix?.accounts ?? [];
  return {
    total: accs.length,
    hasRequired: accs.filter(a =>
      Object.values(a.requirements).includes("required")
    ).length,
    allNa: accs.filter(a =>
      Object.values(a.requirements).every(r => r === "na")
    ).length,
  };
}, [dimMatrix]);
```

### 2f. Bulk update handler

```typescript
const handleBulkUpdate = async () => {
  if (!bulkDimId || dimSelected.size === 0) return;
  setBulkSaving(true);
  try {
    await apiFetch("/api/config/coa/dimension-requirements/bulk", {
      token: accessToken,
      method: "PATCH",
      body: JSON.stringify({
        gl_ids: Array.from(dimSelected),
        dimension_id: bulkDimId,
        requirement: bulkReq,
      }),
    });
    // Refresh matrix
    setDimMatrix(null);
    setDimSelected(new Set());
  } finally {
    setBulkSaving(false);
  }
};
```

### 2g. Dimensions tab JSX

```tsx
{coaTab === "dimensions" && (
  <div>
    {dimMatrixLoading && (
      <p className="text-sm text-gray-500 p-4">Loading dimension matrix...</p>
    )}

    {dimMatrix && (
      <div className="border border-gray-200 rounded-lg overflow-hidden">

        {/* Filter bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-wrap">
          <select value={dimFilterType}
            onChange={e => { setDimFilterType(e.target.value); setDimFilterGroup(""); }}
            className="text-xs border border-gray-200 rounded px-2 py-1">
            <option value="">All types</option>
            <option value="SOCI">PL</option>
            <option value="SOFP">BS</option>
          </select>

          <select value={dimFilterGroup}
            onChange={e => setDimFilterGroup(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1">
            <option value="">All groups</option>
            {dimGroupOptions.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select value={dimFilterReq}
            onChange={e => setDimFilterReq(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1">
            <option value="">All requirements</option>
            <option value="has_required">Has required dimensions</option>
            <option value="all_optional">All optional</option>
            <option value="has_na">Has N/A dimensions</option>
          </select>

          {dimSort.length > 0 && (
            <button onClick={() => setDimSort([])}
              className="text-xs text-gray-500 hover:text-gray-700 underline ml-2">
              Clear sorting
            </button>
          )}

          {/* Legend */}
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-100 border border-blue-300 mr-1"></span>Required</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-100 border border-gray-300 mr-1"></span>Optional</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-red-50 border border-red-200 mr-1"></span>N/A</span>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex gap-6 px-4 py-2 border-b border-gray-200 text-xs text-gray-500">
          <span><span className="font-medium text-gray-700">{dimStats.total}</span> GL accounts</span>
          <span><span className="font-medium text-gray-700">{dimMatrix.dimensions.length}</span> dimensions</span>
          <span><span className="font-medium text-gray-700">{dimStats.hasRequired}</span> accounts with required dimensions</span>
          <span><span className="font-medium text-gray-700">{dimStats.allNa}</span> accounts with all N/A</span>
        </div>

        {/* Bulk edit toolbar — shown when rows selected */}
        {dimSelected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs">
            <span className="text-blue-700 font-medium">{dimSelected.size} selected</span>
            <select value={bulkDimId} onChange={e => setBulkDimId(e.target.value)}
              className="border border-blue-200 rounded px-2 py-1 text-xs">
              <option value="">Select dimension</option>
              {dimMatrix.dimensions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select value={bulkReq} onChange={e => setBulkReq(e.target.value)}
              className="border border-blue-200 rounded px-2 py-1 text-xs">
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="na">N/A</option>
            </select>
            <button onClick={handleBulkUpdate} disabled={!bulkDimId || bulkSaving}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50">
              {bulkSaving ? "Saving..." : "Apply to selected"}
            </button>
            <button onClick={() => setDimSelected(new Set())}
              className="text-blue-600 underline">
              Clear selection
            </button>
          </div>
        )}

        {/* Matrix table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                <th style={{ width: 32, padding: "8px 8px" }}>
                  <input type="checkbox"
                    checked={dimSelected.size === dimSorted.length && dimSorted.length > 0}
                    onChange={e => setDimSelected(
                      e.target.checked ? new Set(dimSorted.map(a => a.id)) : new Set()
                    )} />
                </th>
                {[
                  { key: "gl_number", label: "GL number", width: 80 },
                  { key: "gl_name", label: "GL name", width: 180 },
                  { key: "gl_group", label: "Group", width: 60 },
                ].map(col => (
                  <th key={col.key}
                    onClick={() => toggleSort(dimSort, setDimSort, col.key)}
                    style={{ width: col.width, padding: "8px 10px", textAlign: "left",
                      fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)",
                      cursor: "pointer", userSelect: "none", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    {col.label}
                    <SortIndicator col={col.key} sort={dimSort} />
                  </th>
                ))}
                {dimMatrix.dimensions.map(d => (
                  <th key={d.id}
                    onClick={() => toggleSort(dimSort, setDimSort, `req_${d.id}`)}
                    style={{ width: 90, padding: "8px 6px", textAlign: "center",
                      fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis",
                      borderBottom: "0.5px solid var(--color-border-tertiary)" }}
                    title={d.name}>
                    {d.name.length > 12 ? d.name.slice(0, 12) + "…" : d.name}
                    <SortIndicator col={`req_${d.id}`} sort={dimSort} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dimSorted.map(a => (
                <tr key={a.id}
                  style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}
                  className="hover:bg-gray-50">
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <input type="checkbox"
                      checked={dimSelected.has(a.id)}
                      onChange={e => {
                        const next = new Set(dimSelected);
                        e.target.checked ? next.add(a.id) : next.delete(a.id);
                        setDimSelected(next);
                      }} />
                  </td>
                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono)",
                    color: "var(--color-text-secondary)", fontSize: 11 }}>
                    {a.gl_number}
                  </td>
                  <td style={{ padding: "6px 10px", color: "var(--color-text-primary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {a.gl_name}
                  </td>
                  <td style={{ padding: "6px 10px", color: "var(--color-text-secondary)", fontSize: 11 }}>
                    {a.gl_group}
                  </td>
                  {dimMatrix.dimensions.map(d => {
                    const req = a.requirements[d.id] ?? "optional";
                    const styles: Record<string, React.CSSProperties> = {
                      required: { background: "#E6F1FB", color: "#0C447C", padding: "2px 7px",
                        borderRadius: 4, fontSize: 11, fontWeight: 500, display: "inline-block" },
                      optional: { background: "#F1EFE8", color: "#5F5E5A", padding: "2px 7px",
                        borderRadius: 4, fontSize: 11, fontWeight: 500, display: "inline-block" },
                      na: { background: "#FCEBEB", color: "#A32D2D", padding: "2px 7px",
                        borderRadius: 4, fontSize: 11, fontWeight: 500, display: "inline-block" },
                    };
                    const labels: Record<string, string> = {
                      required: "Required", optional: "Optional", na: "N/A"
                    };
                    return (
                      <td key={d.id} style={{ padding: "6px 6px", textAlign: "center" }}>
                        <span style={styles[req] ?? styles.optional}>
                          {labels[req] ?? req}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", borderTop: "0.5px solid var(--color-border-tertiary)",
          fontSize: 12, color: "var(--color-text-tertiary)", display: "flex",
          justifyContent: "space-between" }}>
          <span>Showing {dimSorted.length} of {dimMatrix.accounts.length} accounts</span>
          <span>Click any column header to sort · Select rows to bulk edit</span>
        </div>

      </div>
    )}
  </div>
)}
```

---

## WATCH ITEMS
- Do NOT change any other tab
- Do NOT change any upload logic
- applySort and SortEntry must be reused from the existing sort implementation
- Run `npm run type-check` before committing — zero errors required

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx`

## Commit message:
`feat: coa dimensions tab — matrix view, cascading filters, persistent sort, bulk edit`
