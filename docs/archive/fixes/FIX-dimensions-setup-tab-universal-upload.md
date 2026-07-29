# CC Brief — Dimensions: Remove Inline Values from Setup Tab + Fix Delete + Universal Upload

## CRITICAL INSTRUCTIONS
1. Read `docs/MASTER_CONTEXT.md` fully before starting
2. Modify ONLY the files listed in the "Allowed files" section at the bottom
3. Do NOT touch any file not in that list
4. Do NOT improve anything not mentioned in this brief
5. At the end, list every file you changed

---

## CONTEXT

Three changes to the Dimensions page
(`/dashboard/business/settings/dimensions`):

1. The **Dimension setup tab** currently shows an inline expanded list of
   uploaded values beneath each dimension card. This clutters the setup tab
   and pushes the "View values" button far down the page. The inline list
   must be removed — values belong only in the Master data / values tab.

2. The red ✕ buttons on each value row in the inline list (currently visible
   on the Dimension setup tab) do nothing. Since we are removing the inline
   list entirely, these buttons go away with it. However, the delete action
   must work correctly in the Master data / values tab (already briefed in
   FIX-dimension-values-list.md — confirm it is wired correctly there).

3. The template download and upload on the Master data / values tab must
   support a universal "Dimension" column so that one file can contain values
   for multiple dimensions, with each row routed to the correct dimension
   based on the value in that column.

---

## CHANGE 1 — Remove inline values list from Dimension setup tab

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

On the **Dimension setup tab**, each dimension card expands to show:
- Add value / Template / Upload buttons
- An inline table/list of values with red ✕ buttons
- View values link at the bottom

### What to remove:
- The entire inline values table/list (all rows with CODE, NAME, and ✕ button)
- The red ✕ delete buttons
- Any state or data-fetching logic that exists ONLY to power this inline list
  (do not remove logic that is also used by the Master data / values tab)

### What to KEEP on the Dimension setup tab card when expanded:
- **+ Add value** button
- **Template** button
- **Upload** button
- **View values** link (keep this — it navigates to Master data / values tab)
- The note: "GL-level applicability configured on the Chart of Accounts page."

The expanded card should be compact — just the three action buttons + View
values link, nothing else.

---

## CHANGE 2 — Universal upload with optional Dimension column

### 2a. Template download — add Dimension column

**File:** `backend/app/routers/config.py`

Find the dimension values template download endpoint. When generating the
`.xlsx` template, add a **"Dimension"** column as the FIRST column, before
Code and Name.

The Dimension column must have an Excel data validation dropdown populated
with the display names of all active manual dimensions for the tenant
(i.e. dimensions where source is "manual" or includes "manual").

Header row structure:
```
Dimension | Code * | Name * | Description
```

Instruction row (row 2):
```
Select dimension from dropdown | Unique code e.g. NG_AEKHALAMA | Full name | Optional description
```

Example row (row 3):
```
Real internal order | NG_AEKHALAMA | Khalamanja | Optional description
```

Add data validation dropdown for column A (Dimension), rows 4 to 1000:
```python
from openpyxl.worksheet.dataval import DataValidation

# Get all active manual dimensions for this tenant
manual_dims = [d for d in dimensions if "manual" in (d.dimension_sources or [])]
dim_names = [d.display_name or d.name for d in manual_dims]
dim_formula = '"' + ','.join(dim_names) + '"'

dv = DataValidation(
    type="list",
    formula1=dim_formula,
    allow_blank=True,
    showDropDown=False,
    showErrorMessage=True,
    errorTitle="Invalid dimension",
    error="Please select a dimension from the dropdown list.",
)
dv.sqref = "A4:A1000"
ws.add_data_validation(dv)
```

Keep rows 1-3 locked (same as existing template protection with password "ziva").
Data rows (row 4+) remain editable.

### 2b. Upload endpoint — handle optional Dimension column

**File:** `backend/app/routers/config.py`

Find the dimension values upload endpoint
(`POST /api/config/dimensions/{dimension_id}/values/upload`).

Update the upload logic to detect whether a "Dimension" column is present:

```python
headers_lower = [h.lower().replace("*", "").strip() for h in headers]

has_dimension_col = "dimension" in headers_lower
dim_col_idx = headers_lower.index("dimension") if has_dimension_col else None
code_idx_raw = headers_lower.index("code") if "code" in headers_lower else None
code_idx = code_idx_raw if code_idx_raw is not None else (
    headers_lower.index("value code") if "value code" in headers_lower else None
)
name_idx_raw = headers_lower.index("name") if "name" in headers_lower else None
name_idx = name_idx_raw if name_idx_raw is not None else (
    headers_lower.index("value name") if "value name" in headers_lower else None
)
desc_idx = headers_lower.index("description") if "description" in headers_lower else None
```

**If Dimension column IS present:**
- For each row, read the dimension display name from the Dimension column
- Look up the matching tenant dimension by display_name OR name (case-insensitive)
- If the dimension name is blank for a row → skip that row silently
- If the dimension name is not recognised → add to errors list with row number
  and reason: "Unknown dimension: {value}"
- Insert/upsert the value into the MATCHED dimension, NOT the dimension_id
  from the URL path

**If Dimension column is NOT present:**
- Behaviour unchanged: all rows go to the dimension_id from the URL path

Return response format (unchanged):
```json
{ "imported": N, "updated": N, "skipped": N, "errors": [{"row": N, "reason": "..."}] }
```

### 2c. Universal Upload button on Master data / values tab

**File:** `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

On the **Master data / values tab**, add a row of buttons at the top (above
the Dimension dropdown), containing:

```tsx
<div className="flex items-center gap-2 mb-4">
  <button
    type="button"
    onClick={handleUniversalTemplateDownload}
    className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
  >
    ↓ Download universal template
  </button>
  <button
    type="button"
    onClick={() => universalFileInputRef.current?.click()}
    disabled={universalUploading}
    className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
  >
    {universalUploading ? "Uploading…" : "↑ Upload all dimensions"}
  </button>
  <input
    type="file"
    ref={universalFileInputRef}
    className="hidden"
    accept=".xlsx"
    onChange={handleUniversalUpload}
  />
  <span className="text-xs text-gray-400 ml-2">
    Use this to upload values for multiple dimensions at once
  </span>
</div>
```

Add state and refs:
```typescript
const universalFileInputRef = useRef<HTMLInputElement>(null);
const [universalUploading, setUniversalUploading] = useState(false);
const [universalUploadResult, setUniversalUploadResult] = useState<{
  message: string;
  type: "success" | "error";
} | null>(null);
```

**handleUniversalTemplateDownload:**
```typescript
const handleUniversalTemplateDownload = async () => {
  if (!accessToken) return;
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    // Use any dimension_id — the universal template doesn't depend on one
    // Find the first manual dimension's ID, or use a dedicated universal endpoint
    const res = await fetch(
      `${BASE}/api/config/dimensions/template/universal`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dimension_values_universal_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
  }
};
```

**handleUniversalUpload:**
```typescript
const handleUniversalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !accessToken) return;
  e.target.value = "";
  setUniversalUploading(true);
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(
      `${BASE}/api/config/dimensions/upload/universal`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? "Upload failed");
    setUniversalUploadResult({
      message: `Imported ${data.imported}, updated ${data.updated}, skipped ${data.skipped}. Errors: ${data.errors?.length ?? 0}.`,
      type: "success",
    });
    // Refresh current dimension values
    if (activeDimensionId) await loadDimensionValues(activeDimensionId);
  } catch (err) {
    setUniversalUploadResult({
      message: err instanceof Error ? err.message : "Upload failed.",
      type: "error",
    });
  } finally {
    setUniversalUploading(false);
    setTimeout(() => setUniversalUploadResult(null), 6000);
  }
};
```

Show result feedback below the universal upload buttons:
```tsx
{universalUploadResult && (
  <p className={`text-xs mb-3 ${
    universalUploadResult.type === "success" ? "text-green-600" : "text-red-600"
  }`}>
    {universalUploadResult.message}
  </p>
)}
```

### 2d. Add universal template and upload endpoints to backend

**File:** `backend/app/routers/config.py`

Add two new endpoints:

**GET /api/config/dimensions/template/universal**
- Same as the per-dimension template but:
  - Always includes the Dimension column as first column
  - Dimension dropdown populated with ALL active manual dimensions for the tenant
  - Does not require a dimension_id path parameter

**POST /api/config/dimensions/upload/universal**
- Accepts .xlsx file
- Dimension column is REQUIRED (not optional)
- For each row: look up dimension by display_name/name, upsert the value
- Returns: `{ imported: N, updated: N, skipped: N, errors: [{row, reason}] }`

---

## WATCH ITEMS
- Do NOT change `config.py` database name — must stay `ziva_dev`
- Do NOT rewrite CORS in `main.py` — must keep `http://localhost:3000`
- Do NOT make unsolicited UI changes anywhere else
- Do NOT use browser `alert()` or `confirm()` — always use UI modals

---

## Allowed files:
1. `backend/app/routers/config.py`
2. `frontend/src/app/dashboard/business/settings/dimensions/page.tsx`

## Commit message:
`feat: dimensions — remove inline values from setup tab, universal upload template with dimension column`
