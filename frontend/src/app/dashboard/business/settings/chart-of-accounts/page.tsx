"use client";

/**
 * Chart of Accounts — /dashboard/business/settings/chart-of-accounts
 *
 * M8.1 enhancements:
 *   - Bulk actions (activate / deactivate / delete selected rows)
 *   - Replace All CoA upload with confirmation modal
 *   - Multi-sheet upload result display (sheet1 + sheet2)
 *   - Account type display updated to SOCI/SOFP
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";
import ModeNotAvailable from "@/components/ModeNotAvailable";

interface GLAccount {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  is_active: boolean;
  is_retired: boolean;
  gl_group?: string;
  gl_subgroup?: string;
  gl_sub_subgroup?: string;
  fs_head?: string;
  fs_note?: string;
  tb_mapping?: string;
  group_account_number?: string;
  group_account_name?: string;
  account_classification?: string;
  is_foreign_currency?: boolean;
  foreign_currency_code?: string;
  revalue_at_period_end?: boolean;
}

interface Dimension {
  id: string;
  name: string;
  display_name?: string;
  code: string;
  is_active: boolean;
}

type CoATab = "accounts" | "groups" | "fs_mappings" | "dimensions";
type SortEntry = { col: string; dir: "asc" | "desc" };

type DimMatrixAccount = {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  gl_group: string;
  is_active: boolean;
  requirements: Record<string, string>;
};
type DimMatrixDimension = { id: string; name: string };

const SORT_STORAGE_KEY_ACCOUNTS = "ziva_coa_accounts_sort";
const SORT_STORAGE_KEY_FS = "ziva_coa_fs_sort";

const loadSort = (key: string): SortEntry[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SortEntry[]) : [];
  } catch { return []; }
};

const saveSort = (key: string, sort: SortEntry[]) => {
  try { localStorage.setItem(key, JSON.stringify(sort)); } catch {}
};

const toggleSort = (
  sort: SortEntry[],
  setSort: (s: SortEntry[]) => void,
  col: string
) => {
  const existing = sort.find(s => s.col === col);
  if (!existing) {
    setSort([...sort, { col, dir: "asc" }]);
  } else if (existing.dir === "asc") {
    setSort(sort.map(s => s.col === col ? { ...s, dir: "desc" } : s));
  } else {
    setSort(sort.filter(s => s.col !== col));
  }
};

const REQ_ORDER: Record<string, number> = { required: 0, optional: 1, na: 2 };

const applySort = <T extends Record<string, unknown>>(
  list: T[],
  sort: SortEntry[]
): T[] => {
  if (!sort.length) return list;
  return [...list].sort((a, b) => {
    for (const { col, dir } of sort) {
      const aVal = String(a[col] ?? "");
      const bVal = String(b[col] ?? "");
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
};

const SortIndicator = ({ col, sort }: { col: string; sort: SortEntry[] }) => {
  const entry = sort.find(s => s.col === col);
  if (!entry) return null;
  const priority = sort.indexOf(entry) + 1;
  return (
    <span style={{ fontSize: 10, marginLeft: 4, color: "#6b7280" }}>
      {entry.dir === "asc" ? "↑" : "↓"}
      {sort.length > 1 && <sup style={{ fontSize: 9 }}>{priority}</sup>}
    </span>
  );
};

const PL_CLASSIFICATIONS = [
  "Revenue",
  "Revenue — service fees",
  "Cost of sales",
  "Gross profit",
  "Operating expense",
  "EBITDA",
  "Depreciation & amortisation",
  "EBIT",
  "Finance income",
  "Finance cost",
  "Tax expense",
  "Other comprehensive income",
];

const BS_CLASSIFICATIONS = [
  "Non-current asset",
  "Current asset",
  "Contract asset — unbilled revenue",
  "Cash & cash equivalent",
  "Non-current liability",
  "Current liability",
  "Contract liability — deferred revenue",
  "Equity",
  "Retained earnings",
];

const COMMON_CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "GHS", "KES", "ZAR",
  "AED", "CAD", "AUD", "JPY", "CHF", "CNY", "INR",
];

const normaliseAccountType = (raw: string | undefined): string => {
  if (!raw) return "—";
  const v = raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (["PL", "SOCI", "PLV", "PANDL"].includes(v) || v.startsWith("PL")) return "PL";
  if (["BS", "SOFP", "BALANCESHEET"].includes(v) || v.startsWith("BS")) return "BS";
  return raw;
};

interface SkippedRow {
  row: number;
  gl_number: string;
  reason: string;
}

interface FSMappingItem {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  fs_head: string | null;
  fs_note: string | null;
  tb_mapping: string | null;
}

interface SheetResult {
  imported: number;
  updated: number;
  skipped: number;
  skipped_rows?: SkippedRow[];
  errors: { row: number; reason: string }[];
}

type UploadResultType = SheetResult | { sheet1: SheetResult; sheet2: SheetResult };

function SheetResultDisplay({ result, label }: { result: SheetResult; label: string }) {
  const [skippedExpanded, setSkippedExpanded] = useState(false);
  const skippedRows = result.skipped_rows ?? [];
  return (
    <div>
      <p className="text-xs font-semibold text-green-700 mb-0.5">{label}</p>
      <p className="text-green-700 text-xs">
        {result.imported} imported · {result.updated ?? 0} updated · {result.skipped} skipped · {result.errors.length} errors
      </p>
      {result.errors.length > 0 && (
        <ul className="mt-1 text-xs text-red-700 space-y-0.5">
          {result.errors.slice(0, 8).map((e, i) => (
            <li key={i}>Row {e.row}: {e.reason}</li>
          ))}
          {result.errors.length > 8 && <li>…and {result.errors.length - 8} more</li>}
        </ul>
      )}
      {skippedRows.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setSkippedExpanded(prev => !prev)}
            className="text-xs text-amber-700 hover:text-amber-900 underline"
          >
            {skippedExpanded ? "▲ Hide skipped rows" : "▼ View skipped rows"} ({skippedRows.length})
          </button>
          {skippedExpanded && (
            <ul className="mt-1 text-xs text-amber-800 space-y-0.5 border-l-2 border-amber-200 pl-2">
              {skippedRows.slice(0, 50).map((s, i) => (
                <li key={i}>Row {s.row}{s.gl_number ? ` · ${s.gl_number}` : ""}: {s.reason}</li>
              ))}
              {skippedRows.length > 50 && (
                <li className="text-amber-600">…and {skippedRows.length - 50} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChartOfAccountsPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubsidiary, setIsSubsidiary] = useState(false);
  const [postingMode, setPostingMode] = useState<'lite' | 'connected' | 'full_erp' | null>(null);

  // Template column selector
  const [showTemplateOptions, setShowTemplateOptions] = useState(false);
  const [templateCols, setTemplateCols] = useState({
    is_active: true,
    gl_group: true,
    gl_subgroup: true,
    gl_sub_subgroup: true,
    fs_head: true,
    fs_note: true,
    tb_mapping: true,
    group_account: true,
    account_classification: true,
    category: true,
    subcategory: true,
    is_default_gl: true,
  });

  // Multi-column filters
  const [filterGL, setFilterGL] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterClassification, setFilterClassification] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "retired">("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | "delete" | null>(null);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addGL, setAddGL] = useState("");
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<"PL" | "BS">("PL");
  const [addGroup, setAddGroup] = useState("");
  const [addSubgroup, setAddSubgroup] = useState("");
  const [addSubSubgroup, setAddSubSubgroup] = useState("");
  const [addFsHead, setAddFsHead] = useState("");
  const [addFsNote, setAddFsNote] = useState("");
  const [addTbMapping, setAddTbMapping] = useState("");
  const [addGroupAccNum, setAddGroupAccNum] = useState("");
  const [addGroupAccName, setAddGroupAccName] = useState("");
  const [addClassification, setAddClassification] = useState("");
  const [addIsForeignCurrency, setAddIsForeignCurrency] = useState(false);
  const [addForeignCurrencyCode, setAddForeignCurrencyCode] = useState("");
  const [addRevalueAtPeriodEnd, setAddRevalueAtPeriodEnd] = useState(false);
  const [addingGL, setAddingGL] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editGL, setEditGL] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"PL" | "BS">("PL");
  const [editActive, setEditActive] = useState(true);
  const [editGroup, setEditGroup] = useState("");
  const [editSubgroup, setEditSubgroup] = useState("");
  const [editSubSubgroup, setEditSubSubgroup] = useState("");
  const [editFsHead, setEditFsHead] = useState("");
  const [editFsNote, setEditFsNote] = useState("");
  const [editTbMapping, setEditTbMapping] = useState("");
  const [editGroupAccNum, setEditGroupAccNum] = useState("");
  const [editGroupAccName, setEditGroupAccName] = useState("");
  const [editClassification, setEditClassification] = useState("");
  const [editIsForeignCurrency, setEditIsForeignCurrency] = useState(false);
  const [editForeignCurrencyCode, setEditForeignCurrencyCode] = useState("");
  const [editRevalueAtPeriodEnd, setEditRevalueAtPeriodEnd] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Dimensions modal
  const [dimGlId, setDimGlId] = useState<string | null>(null);
  const [dimRequirements, setDimRequirements] = useState<Record<string, string>>({});
  const [savingDims, setSavingDims] = useState(false);
  const [dimModalLoading, setDimModalLoading] = useState(false);

  // Sub-tabs
  const initialTabParam = (searchParams.get("tab") as CoATab) || "accounts";
  const [coaTab, setCoaTab] = useState<CoATab>(initialTabParam);

  const updateCoaTabUrl = (tab: CoATab) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Deactivate confirmation modal
  const [deactivateConfirmGl, setDeactivateConfirmGl] = useState<GLAccount | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Lifecycle status — fetched from GET /api/setup/progress on load
  const [lifecycleStatus, setLifecycleStatus] = useState<string>("in_implementation");

  // Upload
  const [uploadResult, setUploadResult] = useState<UploadResultType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceAllConfirm, setReplaceAllConfirm] = useState(false);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Remap modal
  const [showRemap, setShowRemap] = useState(false);
  const [remapOldIds, setRemapOldIds] = useState<Set<string>>(new Set());
  const [remapNewId, setRemapNewId] = useState("");
  const [remapCreateNew, setRemapCreateNew] = useState(false);
  const [remapNewGL, setRemapNewGL] = useState("");
  const [remapNewName, setRemapNewName] = useState("");
  const [remapNewType, setRemapNewType] = useState<"PL" | "BS">("PL");
  const [remapReason, setRemapReason] = useState("");
  const [remapping, setRemapping] = useState(false);
  const [remapError, setRemapError] = useState<string | null>(null);
  const [remapSuccess, setRemapSuccess] = useState<string | null>(null);
  const [remapBulkDownloading, setRemapBulkDownloading] = useState(false);
  const remapBulkFileRef = useRef<HTMLInputElement>(null);
  const [remapBulkResult, setRemapBulkResult] = useState<{remapped: number; errors: number; rows: {row: number; old_gl_number: string; new_gl_number: string; status: string; reason?: string}[]} | null>(null);

  // FS mappings tab
  const [fsMappings, setFsMappings] = useState<FSMappingItem[]>([]);
  const [fsMappingsLoading, setFsMappingsLoading] = useState(false);
  const [fsTypeFilter, setFsTypeFilter] = useState("");
  const [fsFsHeadFilter, setFsFsHeadFilter] = useState("");
  const [filterFsNote, setFilterFsNote] = useState("");
  const [filterTbMapping, setFilterTbMapping] = useState("");
  const [accountsSort, setAccountsSort] = useState<SortEntry[]>(() => loadSort(SORT_STORAGE_KEY_ACCOUNTS));
  const [fsMappingsSort, setFsMappingsSort] = useState<SortEntry[]>(() => loadSort(SORT_STORAGE_KEY_FS));

  // Dimensions tab
  const SORT_KEY_DIM = "ziva_coa_dim_sort";
  const [dimMatrix, setDimMatrix] = useState<{
    dimensions: DimMatrixDimension[];
    accounts: DimMatrixAccount[];
  } | null>(null);
  const [dimMatrixLoading, setDimMatrixLoading] = useState(false);
  const [dimFilterType, setDimFilterType] = useState("");
  const [dimFilterGroup, setDimFilterGroup] = useState("");
  const [dimFilterReq, setDimFilterReq] = useState("");
  const [dimSort, setDimSort] = useState<SortEntry[]>(() => loadSort(SORT_KEY_DIM));
  const [dimSelected, setDimSelected] = useState<Set<string>>(new Set());
  const [bulkDimId, setBulkDimId] = useState("");
  const [bulkReq, setBulkReq] = useState("required");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Account groups expand state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [expandedSubSubgroups, setExpandedSubSubgroups] = useState<Set<string>>(new Set());

  // Default CoA template picker modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateList, setTemplateList] = useState<{
    id: string; industry: string | null; name: string; description: string; account_count: number;
  }[]>([]);
  const [suggestedTemplateId, setSuggestedTemplateId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateModalLoading, setTemplateModalLoading] = useState(false);
  const [templateAdopting, setTemplateAdopting] = useState(false);
  const [templateModalError, setTemplateModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) router.replace("/dashboard/business");
  }, [user, router]);

  const load = async () => {
    if (!accessToken) return;
    try {
      const [accs, dims, progress] = await Promise.all([
        apiFetch<GLAccount[]>(`/api/config/coa?active_only=false&limit=10000`, { token: accessToken }),
        apiFetch<Dimension[]>("/api/config/dimensions", { token: accessToken }),
        apiFetch<{ lifecycle_status: string }>("/api/setup/progress", { token: accessToken }).catch(() => ({ lifecycle_status: "in_implementation" })),
      ]);
      setAccounts(accs);
      setDimensions(dims.filter((d) => d.is_active));
      setLifecycleStatus(progress.lifecycle_status ?? "in_implementation");
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts.");
    } finally {
      setIsLoading(false);
    }
    // Check subsidiary status + posting mode
    try {
      const orgConfig = await apiFetch<{
        org_configuration?: { structure_type?: string };
        posting_mode?: string;
      }>("/api/setup/org", { token: accessToken! });
      const structureType = orgConfig.org_configuration?.structure_type ?? "";
      setIsSubsidiary(["subsidiary", "branch"].includes(structureType.toLowerCase()));
      if (orgConfig.posting_mode) setPostingMode(orgConfig.posting_mode as 'lite' | 'connected' | 'full_erp');
    } catch {}
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTemplateModal = async () => {
    setShowTemplateModal(true);
    setTemplateModalError(null);
    setSelectedTemplateId(null);
    setTemplateModalLoading(true);
    try {
      const data = await apiFetch<{
        templates: { id: string; industry: string | null; name: string; description: string; account_count: number }[];
        suggested_template_id: string | null;
      }>("/api/config/coa/templates", { token: accessToken! });
      setTemplateList(data.templates);
      setSuggestedTemplateId(data.suggested_template_id);
      setSelectedTemplateId(data.suggested_template_id);
    } catch (err) {
      setTemplateModalError(err instanceof Error ? err.message : "Failed to load templates.");
    } finally {
      setTemplateModalLoading(false);
    }
  };

  const handleAdoptTemplate = async () => {
    if (!selectedTemplateId) return;
    setTemplateAdopting(true);
    setTemplateModalError(null);
    try {
      await apiFetch("/api/config/coa/adopt-template", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({ template_id: selectedTemplateId }),
      });
      setShowTemplateModal(false);
      await load();
    } catch (err) {
      setTemplateModalError(err instanceof Error ? err.message : "Adoption failed.");
    } finally {
      setTemplateAdopting(false);
    }
  };

  useEffect(() => {
    if (coaTab !== "fs_mappings" || !accessToken) return;
    setFsMappingsLoading(true);
    apiFetch<FSMappingItem[]>("/api/config/coa/fs-mappings", { token: accessToken })
      .then(data => setFsMappings(data))
      .catch(() => setFsMappings([]))
      .finally(() => setFsMappingsLoading(false));
  }, [coaTab, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { saveSort(SORT_STORAGE_KEY_ACCOUNTS, accountsSort); }, [accountsSort]);
  useEffect(() => { saveSort(SORT_STORAGE_KEY_FS, fsMappingsSort); }, [fsMappingsSort]);
  useEffect(() => { saveSort(SORT_KEY_DIM, dimSort); }, [dimSort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (coaTab !== "dimensions" || dimMatrix) return;
    setDimMatrixLoading(true);
    apiFetch<{ dimensions: DimMatrixDimension[]; accounts: DimMatrixAccount[] }>(
      "/api/config/coa/dimension-matrix", { token: accessToken! }
    )
      .then(data => setDimMatrix(data))
      .finally(() => setDimMatrixLoading(false));
  }, [coaTab, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (name: string) => setExpandedGroups(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const toggleSubgroup = (group: string, sub: string) => {
    const key = group + "||" + sub;
    setExpandedSubgroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSubSubgroup = (group: string, sub: string, ssub: string) => {
    const key = group + "||" + sub + "||" + ssub;
    setExpandedSubSubgroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleTypeChange = (val: string) => {
    setFilterType(val);
    setFilterGroup("");
    setFilterClassification("");
  };

  const handleGroupChange = (val: string) => {
    setFilterGroup(val);
    setFilterClassification("");
  };

  const handleFsTypeChange = (val: string) => {
    setFsTypeFilter(val);
    setFsFsHeadFilter("");
    setFilterFsNote("");
    setFilterTbMapping("");
  };

  const handleFsHeadChange = (val: string) => {
    setFsFsHeadFilter(val);
    setFilterFsNote("");
    setFilterTbMapping("");
  };

  const handleFsNoteChange = (val: string) => {
    setFilterFsNote(val);
    setFilterTbMapping("");
  };

  const handleAdd = async () => {
    if (!accessToken || !addGL.trim() || !addName.trim()) return;
    setAddingGL(true);
    setAddError(null);
    try {
      await apiFetch("/api/config/coa", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          gl_number: addGL.trim(),
          gl_name: addName.trim(),
          account_type: addType,
          gl_group: addGroup.trim() || null,
          gl_subgroup: addSubgroup.trim() || null,
          gl_sub_subgroup: addSubSubgroup.trim() || null,
          fs_head: addFsHead.trim() || null,
          fs_note: addFsNote.trim() || null,
          tb_mapping: addTbMapping.trim() || null,
          group_account_number: addGroupAccNum.trim() || null,
          group_account_name: addGroupAccName.trim() || null,
          account_classification: addClassification || null,
          is_foreign_currency: addIsForeignCurrency,
          foreign_currency_code: addIsForeignCurrency ? addForeignCurrencyCode || null : null,
          revalue_at_period_end: addIsForeignCurrency ? addRevalueAtPeriodEnd : false,
        }),
      });
      setAddGL(""); setAddName(""); setAddType("PL");
      setAddGroup(""); setAddSubgroup(""); setAddSubSubgroup("");
      setAddFsHead(""); setAddFsNote(""); setAddTbMapping("");
      setAddGroupAccNum(""); setAddGroupAccName("");
      setAddClassification(""); setAddIsForeignCurrency(false);
      setAddForeignCurrencyCode(""); setAddRevalueAtPeriodEnd(false);
      setShowAdd(false);
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create GL account.");
    } finally {
      setAddingGL(false);
    }
  };

  const handleEdit = async () => {
    if (!accessToken || !editId) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/config/coa/${editId}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({
          gl_name: editName.trim(),
          account_type: editType,
          is_active: editActive,
          gl_group: editGroup.trim() || null,
          gl_subgroup: editSubgroup.trim() || null,
          gl_sub_subgroup: editSubSubgroup.trim() || null,
          fs_head: editFsHead.trim() || null,
          fs_note: editFsNote.trim() || null,
          tb_mapping: editTbMapping.trim() || null,
          group_account_number: editGroupAccNum.trim() || null,
          group_account_name: editGroupAccName.trim() || null,
          account_classification: editClassification || null,
          is_foreign_currency: editIsForeignCurrency,
          foreign_currency_code: editIsForeignCurrency ? editForeignCurrencyCode || null : null,
          revalue_at_period_end: editIsForeignCurrency ? editRevalueAtPeriodEnd : false,
        }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update GL account.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeactivate = (gl: GLAccount) => {
    setDeactivateConfirmGl(gl);
  };

  const confirmDeactivate = async () => {
    if (!accessToken || !deactivateConfirmGl) return;
    setDeactivating(true);
    try {
      await apiFetch(`/api/config/coa/${deactivateConfirmGl.id}`, {
        method: "DELETE",
        token: accessToken,
      });
      setDeactivateConfirmGl(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate account.");
      setDeactivateConfirmGl(null);
    } finally {
      setDeactivating(false);
    }
  };

  const handleUploadFile = async (file: File, endpoint: string) => {
    if (!accessToken) return;
    setUploading(true);
    setUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await apiFetch<UploadResultType>(endpoint, {
        method: "POST",
        token: accessToken,
        body: form,
        isFormData: true,
      });
      setUploadResult(result);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (replaceFileRef.current) replaceFileRef.current.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    if (!accessToken) return;
    setDownloadingTemplate(true);
    setShowTemplateOptions(false);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const params = new URLSearchParams({
        is_active:              templateCols.is_active.toString(),
        gl_group:               templateCols.gl_group.toString(),
        gl_subgroup:            templateCols.gl_subgroup.toString(),
        gl_sub_subgroup:        templateCols.gl_sub_subgroup.toString(),
        fs_head:                templateCols.fs_head.toString(),
        fs_note:                templateCols.fs_note.toString(),
        tb_mapping:             templateCols.tb_mapping.toString(),
        group_account:          templateCols.group_account.toString(),
        account_classification: templateCols.account_classification.toString(),
        category:               templateCols.category.toString(),
        subcategory:            templateCols.subcategory.toString(),
        is_default_gl:          templateCols.is_default_gl.toString(),
      });
      const res = await fetch(`${BASE}/api/config/coa/template?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Template download failed.");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const fnMatch = cd.match(/filename=([^;]+)/);
      const filename = fnMatch ? fnMatch[1].replace(/"/g, "") : "coa_template.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // ── Bulk actions ────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAccounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!accessToken || !bulkAction || selectedIds.size === 0) return;
    if (bulkAction === "delete" && bulkConfirmText !== "DELETE") return;
    setBulkProcessing(true);
    try {
      await apiFetch("/api/config/coa/bulk-action", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ ids: Array.from(selectedIds), action: bulkAction }),
      });
      setBulkAction(null);
      setBulkConfirmText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const openDimModal = async (gl: GLAccount) => {
    setDimGlId(gl.id);
    setDimModalLoading(true);
    const defaults: Record<string, string> = {};
    dimensions.forEach((d) => { defaults[d.id] = "optional"; });
    setDimRequirements(defaults);

    try {
      const saved = await apiFetch<{ dimension_id: string; requirement: string }[]>(
        `/api/config/coa/${gl.id}/dimensions`,
        { token: accessToken! }
      );
      if (saved.length > 0) {
        const loaded: Record<string, string> = { ...defaults };
        saved.forEach(r => { loaded[r.dimension_id] = r.requirement; });
        setDimRequirements(loaded);
      }
    } catch {
      // keep defaults if fetch fails
    } finally {
      setDimModalLoading(false);
    }
  };

  const handleSaveDims = async () => {
    if (!accessToken || !dimGlId) return;
    setSavingDims(true);
    try {
      const requirements = Object.entries(dimRequirements).map(([dimension_id, requirement]) => ({
        dimension_id,
        requirement,
      }));
      await apiFetch(`/api/config/coa/${dimGlId}/dimensions`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ requirements }),
      });
      setDimGlId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save dimension requirements.");
    } finally {
      setSavingDims(false);
    }
  };

  // Cascading filter pipeline for Accounts tab
  const acctAfterTypeFilter = useMemo(() =>
    accounts.filter(a => !filterType || normaliseAccountType(a.account_type) === filterType)
  , [accounts, filterType]);

  const groupOptions = useMemo(() =>
    Array.from(new Set(acctAfterTypeFilter.map(a => a.gl_group).filter((g): g is string => !!g))).sort()
  , [acctAfterTypeFilter]);

  const acctAfterGroupFilter = useMemo(() =>
    acctAfterTypeFilter.filter(a => !filterGroup || a.gl_group === filterGroup)
  , [acctAfterTypeFilter, filterGroup]);

  const classificationOptions = useMemo(() =>
    Array.from(new Set(acctAfterGroupFilter.map(a => a.account_classification).filter((c): c is string => !!c))).sort()
  , [acctAfterGroupFilter]);

  const filteredAccounts = useMemo(() =>
    acctAfterGroupFilter.filter(a => {
      if (filterGL && !a.gl_number.toLowerCase().includes(filterGL.toLowerCase())) return false;
      if (filterName && !a.gl_name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterClassification && a.account_classification !== filterClassification) return false;
      if (filterStatus === "active"   && (!a.is_active || a.is_retired)) return false;
      if (filterStatus === "inactive" && (a.is_active || a.is_retired)) return false;
      if (filterStatus === "retired"  && !a.is_retired) return false;
      return true;
    })
  , [acctAfterGroupFilter, filterGL, filterName, filterClassification, filterStatus]);

  // Cascading filter pipeline — each step narrows options for the next dropdown
  const afterTypeFilter = useMemo(() =>
    fsMappings.filter(a => !fsTypeFilter || normaliseAccountType(a.account_type) === fsTypeFilter)
  , [fsMappings, fsTypeFilter]);

  const fsHeadOptions = useMemo(() =>
    Array.from(new Set(afterTypeFilter.filter(a => a.fs_head).map(a => a.fs_head!))).sort()
  , [afterTypeFilter]);

  const afterFsHeadFilter = useMemo(() =>
    afterTypeFilter.filter(a => !fsFsHeadFilter || a.fs_head === fsFsHeadFilter)
  , [afterTypeFilter, fsFsHeadFilter]);

  const fsNoteOptions = useMemo(() =>
    Array.from(new Set(afterFsHeadFilter.filter(a => a.fs_note).map(a => a.fs_note!))).sort()
  , [afterFsHeadFilter]);

  const afterFsNoteFilter = useMemo(() =>
    afterFsHeadFilter.filter(a => !filterFsNote || a.fs_note === filterFsNote)
  , [afterFsHeadFilter, filterFsNote]);

  const tbMappingOptions = useMemo(() =>
    Array.from(new Set(afterFsNoteFilter.filter(a => a.tb_mapping).map(a => a.tb_mapping!))).sort()
  , [afterFsNoteFilter]);

  const filteredFsMappings = useMemo(() =>
    afterFsNoteFilter.filter(a => !filterTbMapping || a.tb_mapping === filterTbMapping)
  , [afterFsNoteFilter, filterTbMapping]);

  const sortedFsMappings = useMemo(() =>
    applySort(
      filteredFsMappings.map(a => ({
        ...a,
        _unmapped: a.fs_head ? "0" : "1",
      })),
      [{ col: "_unmapped", dir: "asc" }, ...fsMappingsSort]
    ) as FSMappingItem[]
  , [filteredFsMappings, fsMappingsSort]);

  const sortedAccounts = useMemo(() =>
    applySort(filteredAccounts as unknown as Record<string, unknown>[], accountsSort) as unknown as GLAccount[]
  , [filteredAccounts, accountsSort]);

  // Dimensions tab derived state
  const dimAfterType = useMemo(() =>
    (dimMatrix?.accounts ?? []).filter(a => !dimFilterType || normaliseAccountType(a.account_type) === dimFilterType)
  , [dimMatrix, dimFilterType]);

  const dimGroupOptions = useMemo(() =>
    Array.from(new Set(dimAfterType.map(a => a.gl_group).filter((g): g is string => !!g))).sort()
  , [dimAfterType]);

  const dimAfterGroup = useMemo(() =>
    dimAfterType.filter(a => !dimFilterGroup || a.gl_group === dimFilterGroup)
  , [dimAfterType, dimFilterGroup]);

  const dimFiltered = useMemo(() =>
    dimAfterGroup.filter(a => {
      if (!dimFilterReq) return true;
      const reqs = Object.values(a.requirements);
      if (dimFilterReq === "has_required") return reqs.includes("required");
      if (dimFilterReq === "all_optional") return reqs.every(r => r === "optional");
      if (dimFilterReq === "has_na") return reqs.includes("na");
      return true;
    })
  , [dimAfterGroup, dimFilterReq]);

  const dimSorted = useMemo(() => {
    if (!dimSort.length) return dimFiltered;
    return [...dimFiltered].sort((a, b) => {
      for (const { col, dir } of dimSort) {
        let cmp: number;
        if (col.startsWith("req_")) {
          const dimId = col.slice(4);
          const aOrd = REQ_ORDER[a.requirements[dimId] ?? "optional"] ?? 1;
          const bOrd = REQ_ORDER[b.requirements[dimId] ?? "optional"] ?? 1;
          cmp = aOrd - bOrd;
        } else {
          const aVal = String((a as unknown as Record<string, unknown>)[col] ?? "");
          const bVal = String((b as unknown as Record<string, unknown>)[col] ?? "");
          cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
        }
        if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }, [dimFiltered, dimSort]);

  const dimStats = useMemo(() => {
    const accs = dimMatrix?.accounts ?? [];
    return {
      total: accs.length,
      hasRequired: accs.filter(a => Object.values(a.requirements).includes("required")).length,
      allNa: accs.filter(a => Object.values(a.requirements).every(r => r === "na")).length,
    };
  }, [dimMatrix]);

  const handleBulkUpdate = async () => {
    if (!bulkDimId || dimSelected.size === 0) return;
    setBulkSaving(true);
    try {
      await apiFetch("/api/config/coa/dimension-requirements/bulk", {
        token: accessToken!,
        method: "PATCH",
        body: JSON.stringify({
          gl_ids: Array.from(dimSelected),
          dimension_id: bulkDimId,
          requirement: bulkReq,
        }),
      });
      setDimMatrix(null);
      setDimSelected(new Set());
    } finally {
      setBulkSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-3">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const isMultiSheetResult = uploadResult && "sheet1" in uploadResult;

  const groupNodes = (() => {
    type SSNode = { count: number; accounts: GLAccount[] };
    type SNode  = { count: number; accounts: GLAccount[]; subSubgroups: Map<string, SSNode> };
    type GNode  = { count: number; accounts: GLAccount[]; subgroups: Map<string, SNode> };
    const groupMap = new Map<string, GNode>();

    for (const a of accounts.filter(a => a.is_active)) {
      const groupKey = a.gl_group?.trim() || "(No group)";
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, { count: 0, accounts: [], subgroups: new Map() });
      const gNode = groupMap.get(groupKey)!;
      gNode.count++;

      const subKey = a.gl_subgroup?.trim() || "";
      if (!subKey || subKey === groupKey) { gNode.accounts.push(a); continue; }

      if (!gNode.subgroups.has(subKey)) gNode.subgroups.set(subKey, { count: 0, accounts: [], subSubgroups: new Map() });
      const sNode = gNode.subgroups.get(subKey)!;
      sNode.count++;

      const ssKey = a.gl_sub_subgroup?.trim() || "";
      if (!ssKey || ssKey === subKey || ssKey === groupKey) { sNode.accounts.push(a); continue; }

      if (!sNode.subSubgroups.has(ssKey)) sNode.subSubgroups.set(ssKey, { count: 0, accounts: [] });
      const ssNode = sNode.subSubgroups.get(ssKey)!;
      ssNode.count++;
      ssNode.accounts.push(a);
    }

    return Array.from(groupMap.entries()).map(([name, gNode]) => ({
      name,
      count: gNode.count,
      accounts: gNode.accounts,
      subgroups: Array.from(gNode.subgroups.entries()).map(([subName, sNode]) => ({
        name: subName,
        count: sNode.count,
        accounts: sNode.accounts,
        subSubgroups: Array.from(sNode.subSubgroups.entries()).map(([ssName, ssNode]) => ({
          name: ssName,
          count: ssNode.count,
          accounts: ssNode.accounts,
        })),
      })),
    }));
  })();

  // Mode guard — CoA not available in Lite mode (null = still loading, show page)
  if (postingMode === 'lite') {
    return (
      <PageContainer maxWidth="5xl">
        <ModeNotAvailable
          pageName="Chart of Accounts"
          availableIn={["Connected", "Full ERP"]}
          currentMode="lite"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="5xl">
      <button
        type="button"
        onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Back
      </button>
      <div className="flex items-center justify-between mb-1">
        <PageHeading title="Chart of Accounts" />
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setShowTemplateOptions(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Download Template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Merge Upload"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.csv"
            onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0], "/api/config/coa/upload")}
            className="hidden"
          />
          {/* Replace All — in_implementation only */}
          {lifecycleStatus === "in_implementation" && (
            <>
              <button
                type="button"
                onClick={() => setReplaceAllConfirm(true)}
                className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100"
              >
                Replace All
              </button>
              <input
                type="file"
                ref={replaceFileRef}
                accept=".xlsx,.csv"
                onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0], "/api/config/coa/replace-all")}
                className="hidden"
              />
            </>
          )}
          {/* Remap codes — live only */}
          {lifecycleStatus === "live" && (
            <button
              type="button"
              onClick={() => { setShowRemap(true); setRemapOldIds(new Set()); setRemapNewId(""); setRemapCreateNew(false); setRemapNewGL(""); setRemapNewName(""); setRemapReason(""); setRemapError(null); setRemapSuccess(null); setRemapBulkResult(null); }}
              className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
            >
              Remap codes
            </button>
          )}
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            + Add GL Account
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Manage GL accounts. Download the template for the full enterprise format with hierarchy, FS mappings, and dynamic dimension columns.
      </p>

      <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <i className="ti ti-info-circle text-blue-500 shrink-0 mt-0.5" style={{ fontSize: 15 }} />
        <p className="text-sm text-blue-800">
          Your CoA template is generated based on your configured dimensions. Complete dimension setup first for the correct template format.
        </p>
      </div>

      <div className="flex gap-0 border-b border-gray-200 mb-5">
        {([
          { key: "accounts",    label: "Accounts" },
          { key: "groups",      label: "Account groups" },
          { key: "fs_mappings", label: "FS mappings" },
          { key: "dimensions",  label: "Dimensions" },
        ] as { key: CoATab; label: string }[]).map(t => (
          <button key={t.key} type="button" onClick={() => { setCoaTab(t.key); updateCoaTabUrl(t.key); }}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              coaTab === t.key
                ? "border-blue-600 text-gray-900 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <Banner variant="error" className="mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold ml-4">×</button>
        </Banner>
      )}

      {uploadResult && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm space-y-2">
          <p className="font-medium text-green-800">Upload complete</p>
          {isMultiSheetResult ? (
            <SheetResultDisplay result={(uploadResult as { sheet1: SheetResult; sheet2: SheetResult }).sheet1} label="Sheet 1 — GL Accounts" />
          ) : (
            <SheetResultDisplay result={uploadResult as SheetResult} label="GL Accounts" />
          )}
        </div>
      )}

      {coaTab === "accounts" && (<>
      {/* Filters */}
      <div className="space-y-2 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <input type="text" value={filterGL}
            onChange={e => setFilterGL(e.target.value)}
            placeholder="GL number…"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" value={filterName}
            onChange={e => setFilterName(e.target.value)}
            placeholder="GL name…"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={filterGroup} onChange={e => handleGroupChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All groups</option>
            {groupOptions.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select value={filterType} onChange={e => handleTypeChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All types</option>
            <option value="PL">PL — Profit &amp; Loss</option>
            <option value="BS">BS — Balance Sheet</option>
          </select>
          <select value={filterClassification} onChange={e => setFilterClassification(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All classifications</option>
            {classificationOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as "all" | "active" | "inactive" | "retired")}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="retired">Retired (remapped)</option>
          </select>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {(filterGL || filterName || filterGroup || filterType || filterClassification || filterStatus !== "all") && (
            <>
              <span className="text-xs text-gray-500">
                {filteredAccounts.length} of {accounts.length} accounts
              </span>
              <button type="button"
                onClick={() => {
                  setFilterGL(""); setFilterName(""); setFilterGroup("");
                  setFilterType(""); setFilterClassification(""); setFilterStatus("all");
                }}
                className="text-xs text-blue-600 hover:text-blue-800">
                Clear filters
              </button>
            </>
          )}
          {accountsSort.length > 0 && (
            <button type="button" onClick={() => setAccountsSort([])}
              className="text-xs text-gray-500 hover:text-gray-700 underline">
              Clear sorting
            </button>
          )}
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={() => setBulkAction("activate")}
            className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => setBulkAction("deactivate")}
            className="text-xs px-2.5 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium"
          >
            Deactivate
          </button>
          <button
            type="button"
            onClick={() => setBulkAction("delete")}
            className="text-xs px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-blue-500 hover:text-blue-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Bulk action confirm modal */}
      {bulkAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-3 capitalize">{bulkAction} {selectedIds.size} GL accounts?</h2>
            {bulkAction === "delete" && (
              <>
                <p className="text-sm text-red-700 mb-3">This cannot be undone. Type DELETE to confirm.</p>
                <input
                  type="text"
                  value={bulkConfirmText}
                  onChange={(e) => setBulkConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                />
              </>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => { setBulkAction(null); setBulkConfirmText(""); }} disabled={bulkProcessing}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleBulkAction}
                disabled={bulkProcessing || (bulkAction === "delete" && bulkConfirmText !== "DELETE")}
                loading={bulkProcessing}>
                {bulkProcessing ? "Processing…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Replace All confirm modal (in_implementation only) ────────────── */}
      {replaceAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Replace All GL Accounts?</h2>
            <p className="text-sm text-gray-700 mb-4">
              This will <strong>deactivate all existing GL accounts</strong> and import the new file.
              Available during implementation only — once your tenant goes live, use Remap instead.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setReplaceAllConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="button"
                onClick={() => { setReplaceAllConfirm(false); replaceFileRef.current?.click(); }}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700">
                Yes, Choose File &amp; Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remap modal ──────────────────────────────────────────────────── */}
      {showRemap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Remap GL Codes</h2>
              <p className="text-xs text-gray-500 mt-1">
                Retire old GL codes and redirect their history to a new or existing code.
                Old codes are frozen permanently — historical journals remain intact.
              </p>
            </div>

            <div className="px-6 py-4 space-y-5">
              {remapError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{remapError}</div>
              )}
              {remapSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">{remapSuccess}</div>
              )}

              {/* Old codes to retire */}
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Step 1 — Select old codes to retire
                  {remapOldIds.size > 0 && <span className="ml-2 text-blue-600 font-normal normal-case">{remapOldIds.size} selected</span>}
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 w-8" />
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">GL Number</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {accounts.filter(a => a.is_active && !a.is_retired).map(a => (
                          <tr key={a.id} className={remapOldIds.has(a.id) ? "bg-amber-50" : "hover:bg-gray-50"}>
                            <td className="px-3 py-1.5">
                              <input type="checkbox" checked={remapOldIds.has(a.id)}
                                onChange={() => {
                                  const n = new Set(remapOldIds);
                                  n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                                  setRemapOldIds(n);
                                }} className="rounded border-gray-300" />
                            </td>
                            <td className="px-3 py-1.5 font-mono text-gray-800">{a.gl_number}</td>
                            <td className="px-3 py-1.5 text-gray-700">{a.gl_name}</td>
                            <td className="px-3 py-1.5 text-gray-500">{a.account_type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* New code */}
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Step 2 — Define the new code</p>
                <div className="flex gap-3 mb-3">
                  <button type="button" onClick={() => setRemapCreateNew(false)}
                    className={`px-3 py-1.5 text-xs rounded-lg border font-medium ${!remapCreateNew ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                    Pick existing code
                  </button>
                  <button type="button" onClick={() => setRemapCreateNew(true)}
                    className={`px-3 py-1.5 text-xs rounded-lg border font-medium ${remapCreateNew ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                    Create new code inline
                  </button>
                </div>

                {!remapCreateNew ? (
                  <select value={remapNewId} onChange={e => setRemapNewId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select existing code —</option>
                    {accounts.filter(a => a.is_active && !a.is_retired && !remapOldIds.has(a.id)).map(a => (
                      <option key={a.id} value={a.id}>{a.gl_number} — {a.gl_name} ({a.account_type})</option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">GL Number <span className="text-red-500">*</span></label>
                      <input type="text" value={remapNewGL} onChange={e => setRemapNewGL(e.target.value)}
                        placeholder="e.g. 5015"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">GL Name <span className="text-red-500">*</span></label>
                      <input type="text" value={remapNewName} onChange={e => setRemapNewName(e.target.value)}
                        placeholder="e.g. Consolidated Travel"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Account Type <span className="text-red-500">*</span></label>
                      <select value={remapNewType} onChange={e => setRemapNewType(e.target.value as "PL" | "BS")}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="PL">PL — Profit &amp; Loss</option>
                        <option value="BS">BS — Balance Sheet</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional — appears in audit log)</label>
                <input type="text" value={remapReason} onChange={e => setRemapReason(e.target.value)}
                  placeholder="e.g. Consolidating travel cost codes per Q3 restructure"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Bulk remap section */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Bulk remap via template</p>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" disabled={remapBulkDownloading}
                    onClick={async () => {
                      if (!accessToken) return;
                      setRemapBulkDownloading(true);
                      try {
                        const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
                        const res = await fetch(`${BASE}/api/config/coa/remap-template`, { headers: { Authorization: `Bearer ${accessToken}` } });
                        if (!res.ok) throw new Error("Download failed.");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "coa_remap_template.xlsx"; a.click();
                        URL.revokeObjectURL(url);
                      } catch { setRemapError("Template download failed."); }
                      finally { setRemapBulkDownloading(false); }
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                    {remapBulkDownloading ? "…" : "Download bulk template"}
                  </button>
                  <button type="button" onClick={() => remapBulkFileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                    Upload bulk remap file
                  </button>
                  <input type="file" ref={remapBulkFileRef} accept=".xlsx,.csv" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0]; if (!f || !accessToken) return;
                      const form = new FormData(); form.append("file", f);
                      try {
                        const { apiFetch: af } = await import("@/lib/api");
                        const res = await apiFetch<typeof remapBulkResult>("/api/config/coa/remap-bulk", { method: "POST", token: accessToken, body: form, isFormData: true });
                        setRemapBulkResult(res); setRemapSuccess(`Bulk remap: ${res?.remapped} remapped, ${res?.errors} errors.`);
                        await load();
                      } catch (err) { setRemapError(err instanceof Error ? err.message : "Bulk upload failed."); }
                      if (remapBulkFileRef.current) remapBulkFileRef.current.value = "";
                    }} />
                </div>
                {remapBulkResult && remapBulkResult.errors > 0 && (
                  <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                    {remapBulkResult.rows.filter(r => r.status === "error").slice(0, 10).map((r, i) => (
                      <div key={i} className="text-xs text-red-600">Row {r.row}: {r.old_gl_number} → {r.new_gl_number} — {r.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowRemap(false)} disabled={remapping}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">Close</button>
              <button type="button" disabled={remapping || remapOldIds.size === 0 || (!remapCreateNew && !remapNewId) || (remapCreateNew && (!remapNewGL.trim() || !remapNewName.trim()))}
                onClick={async () => {
                  if (!accessToken) return;
                  setRemapping(true); setRemapError(null); setRemapSuccess(null);
                  try {
                    const body: Record<string, unknown> = {
                      old_account_ids: Array.from(remapOldIds),
                      reason: remapReason || null,
                    };
                    if (remapCreateNew) {
                      body.new_account = { gl_number: remapNewGL.trim(), gl_name: remapNewName.trim(), account_type: remapNewType };
                    } else {
                      body.new_account_id = remapNewId;
                    }
                    const res = await apiFetch<{ remapped: {old_gl_number: string; new_gl_number: string}[]; new_gl_number: string; new_gl_name: string; new_account_created: boolean }>("/api/config/coa/remap", { method: "POST", token: accessToken, body: JSON.stringify(body) });
                    setRemapSuccess(`${res.remapped.length} code(s) retired → remapped to ${res.new_gl_number} (${res.new_gl_name}).${res.new_account_created ? " New account created." : ""}`);
                    setRemapOldIds(new Set()); setRemapNewId(""); setRemapCreateNew(false); setRemapNewGL(""); setRemapNewName(""); setRemapReason("");
                    await load();
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Remap failed.";
                    try {
                      const parsed = JSON.parse(msg);
                      setRemapError(parsed.message || msg);
                    } catch { setRemapError(msg); }
                  }
                  finally { setRemapping(false); }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60">
                {remapping ? "Remapping…" : `Remap ${remapOldIds.size || ""} code${remapOldIds.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Add GL Account</h2>
            {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">GL Identity</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GL Number <span className="text-red-500">*</span></label>
                <input type="text" value={addGL} onChange={(e) => setAddGL(e.target.value)} placeholder="e.g. 670010"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GL Name <span className="text-red-500">*</span></label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Travel Expenses"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Type <span className="text-red-500">*</span></label>
                <select value={addType} onChange={(e) => {
                  const newType = e.target.value as "PL" | "BS";
                  setAddType(newType);
                  const validOptions = newType === "PL" ? PL_CLASSIFICATIONS : BS_CLASSIFICATIONS;
                  if (addClassification && !validOptions.includes(addClassification)) setAddClassification("");
                }}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="PL">PL — Profit &amp; Loss (SOCI)</option>
                  <option value="BS">BS — Balance Sheet (SOFP)</option>
                </select>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">GL Hierarchy</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {([["GL Group", addGroup, setAddGroup], ["GL Subgroup", addSubgroup, setAddSubgroup], ["GL Sub-subgroup", addSubSubgroup, setAddSubSubgroup]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" value={val} onChange={(e) => setter(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Financial Statement Mappings</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {([["FS Head", addFsHead, setAddFsHead], ["FS Note", addFsNote, setAddFsNote], ["TB Mapping", addTbMapping, setAddTbMapping]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" value={val} onChange={(e) => setter(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Group Reporting (optional)</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group Account Number</label>
                <input type="text" value={addGroupAccNum} onChange={(e) => setAddGroupAccNum(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group Account Name</label>
                <input type="text" value={addGroupAccName} onChange={(e) => setAddGroupAccName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-4">Account Classification</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Classification</label>
                <select
                  value={addClassification}
                  onChange={e => setAddClassification(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select classification —</option>
                  {(addType === "PL" ? PL_CLASSIFICATIONS : addType === "BS" ? BS_CLASSIFICATIONS : [...PL_CLASSIFICATIONS, ...BS_CLASSIFICATIONS]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Used by all modules to determine how this GL is treated automatically.
                </p>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Foreign Currency</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2 flex items-center gap-3">
                <label className="relative w-9 h-5 cursor-pointer flex-shrink-0">
                  <input type="checkbox" className="sr-only"
                    checked={addIsForeignCurrency}
                    onChange={e => setAddIsForeignCurrency(e.target.checked)} />
                  <span className={`absolute inset-0 rounded-full transition-colors ${
                    addIsForeignCurrency ? "bg-blue-600" : "bg-gray-300"
                  }`} />
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    addIsForeignCurrency ? "translate-x-4" : ""
                  }`} />
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-900">Foreign currency account</p>
                  <p className="text-xs text-gray-500">Enable if this account holds balances in a foreign currency.</p>
                </div>
              </div>
              {addIsForeignCurrency && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Currency <span className="text-red-500">*</span></label>
                    <select
                      value={addForeignCurrencyCode}
                      onChange={e => setAddForeignCurrencyCode(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select currency —</option>
                      {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input type="checkbox"
                      className="w-3.5 h-3.5 accent-blue-600"
                      checked={addRevalueAtPeriodEnd}
                      onChange={e => setAddRevalueAtPeriodEnd(e.target.checked)} />
                    <div>
                      <p className="text-xs font-medium text-gray-900">Revalue at period end</p>
                      <p className="text-xs text-gray-400">Apply FX revaluation on period close.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <Button variant="secondary" onClick={() => { setShowAdd(false); setAddError(null); }} disabled={addingGL}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAdd} disabled={addingGL || !addGL.trim() || !addName.trim()} loading={addingGL}>
                {addingGL ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Edit GL Account</h2>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">GL Identity</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GL Number</label>
                <input type="text" value={editGL} readOnly
                  className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GL Name <span className="text-red-500">*</span></label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Type <span className="text-red-500">*</span></label>
                <select value={editType} onChange={(e) => {
                  const newType = e.target.value as "PL" | "BS";
                  setEditType(newType);
                  const validOptions = newType === "PL" ? PL_CLASSIFICATIONS : BS_CLASSIFICATIONS;
                  if (editClassification && !validOptions.includes(editClassification)) setEditClassification("");
                }}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="PL">PL — Profit &amp; Loss (SOCI)</option>
                  <option value="BS">BS — Balance Sheet (SOFP)</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="editActive" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="accent-blue-600" />
                <label htmlFor="editActive" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">GL Hierarchy</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ["GL Group", editGroup, setEditGroup],
                ["GL Subgroup", editSubgroup, setEditSubgroup],
                ["GL Sub-subgroup", editSubSubgroup, setEditSubSubgroup],
              ].map(([label, val, setter]) => (
                <div key={label as string}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label as string}</label>
                  <input type="text" value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Financial Statement Mappings</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ["FS Head", editFsHead, setEditFsHead],
                ["FS Note", editFsNote, setEditFsNote],
                ["TB Mapping", editTbMapping, setEditTbMapping],
              ].map(([label, val, setter]) => (
                <div key={label as string}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label as string}</label>
                  <input type="text" value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Group Reporting (optional)</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group Account Number</label>
                <input type="text" value={editGroupAccNum} onChange={(e) => setEditGroupAccNum(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group Account Name</label>
                <input type="text" value={editGroupAccName} onChange={(e) => setEditGroupAccName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-4">Account Classification</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Classification</label>
                <select
                  value={editClassification}
                  onChange={e => setEditClassification(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select classification —</option>
                  {(editType === "PL" ? PL_CLASSIFICATIONS : editType === "BS" ? BS_CLASSIFICATIONS : [...PL_CLASSIFICATIONS, ...BS_CLASSIFICATIONS]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Used by all modules to determine how this GL is treated automatically.
                </p>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Foreign Currency</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2 flex items-center gap-3">
                <label className="relative w-9 h-5 cursor-pointer flex-shrink-0">
                  <input type="checkbox" className="sr-only"
                    checked={editIsForeignCurrency}
                    onChange={e => setEditIsForeignCurrency(e.target.checked)} />
                  <span className={`absolute inset-0 rounded-full transition-colors ${
                    editIsForeignCurrency ? "bg-blue-600" : "bg-gray-300"
                  }`} />
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    editIsForeignCurrency ? "translate-x-4" : ""
                  }`} />
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-900">Foreign currency account</p>
                  <p className="text-xs text-gray-500">Enable if this account holds balances in a foreign currency.</p>
                </div>
              </div>
              {editIsForeignCurrency && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Currency <span className="text-red-500">*</span></label>
                    <select
                      value={editForeignCurrencyCode}
                      onChange={e => setEditForeignCurrencyCode(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select currency —</option>
                      {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input type="checkbox"
                      className="w-3.5 h-3.5 accent-blue-600"
                      checked={editRevalueAtPeriodEnd}
                      onChange={e => setEditRevalueAtPeriodEnd(e.target.checked)} />
                    <div>
                      <p className="text-xs font-medium text-gray-900">Revalue at period end</p>
                      <p className="text-xs text-gray-400">Apply FX revaluation on period close.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <Button variant="secondary" onClick={() => setEditId(null)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleEdit} disabled={savingEdit} loading={savingEdit}>
                {savingEdit ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dimension requirements modal */}
      {dimGlId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Dimension Requirements</h2>
            <p className="text-xs text-gray-500 mb-4">Set whether each dimension is required, optional, or not applicable for this GL account.</p>
            {dimModalLoading ? (
              <div className="py-4 text-center text-sm text-gray-400">Loading requirements…</div>
            ) : dimensions.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No dimensions configured yet.</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {dimensions.map((dim) => (
                  <div key={dim.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{dim.display_name || dim.name}</span>
                    <select
                      value={dimRequirements[dim.id] ?? "optional"}
                      onChange={(e) => setDimRequirements({ ...dimRequirements, [dim.id]: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="required">Required</option>
                      <option value="optional">Optional</option>
                      <option value="na">N/A</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => setDimGlId(null)} disabled={savingDims}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveDims} disabled={savingDims} loading={savingDims}>
                {savingDims ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts table */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-1">No GL accounts yet</p>
          <p className="text-xs text-gray-400 mb-4">Download the template, fill it in, then upload to import your Chart of Accounts.</p>
          <button
            type="button"
            onClick={openTemplateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Use a default template
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredAccounts.length && filteredAccounts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th onClick={() => toggleSort(accountsSort, setAccountsSort, "gl_number")}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700">
                  GL Number <SortIndicator col="gl_number" sort={accountsSort} />
                </th>
                <th onClick={() => toggleSort(accountsSort, setAccountsSort, "gl_name")}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700">
                  GL Name <SortIndicator col="gl_name" sort={accountsSort} />
                </th>
                <th onClick={() => toggleSort(accountsSort, setAccountsSort, "gl_group")}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell cursor-pointer select-none hover:text-gray-700">
                  Group <SortIndicator col="gl_group" sort={accountsSort} />
                </th>
                <th onClick={() => toggleSort(accountsSort, setAccountsSort, "account_type")}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700">
                  Type <SortIndicator col="account_type" sort={accountsSort} />
                </th>
                <th onClick={() => toggleSort(accountsSort, setAccountsSort, "account_classification")}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell cursor-pointer select-none hover:text-gray-700">
                  Classification <SortIndicator col="account_classification" sort={accountsSort} />
                </th>
                <th onClick={() => toggleSort(accountsSort, setAccountsSort, "is_active")}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700">
                  Status <SortIndicator col="is_active" sort={accountsSort} />
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedAccounts.map((gl) => (
                <tr key={gl.id} className={`hover:bg-gray-50 ${!gl.is_active ? "opacity-50" : ""} ${selectedIds.has(gl.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(gl.id)}
                      onChange={() => toggleSelect(gl.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{gl.gl_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div>{gl.gl_name}</div>
                    {gl.gl_subgroup && <div className="text-xs text-gray-400">{gl.gl_subgroup}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{gl.gl_group || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      normaliseAccountType(gl.account_type) === "PL"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}>
                      {normaliseAccountType(gl.account_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                    {gl.account_classification || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {gl.is_retired ? (
                      <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">Retired</span>
                    ) : gl.is_active ? (
                      <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          const fresh = await apiFetch<GLAccount>(`/api/config/coa/${gl.id}`, { token: accessToken! });
                          setEditId(fresh.id);
                          setEditGL(fresh.gl_number);
                          setEditName(fresh.gl_name);
                          setEditType(normaliseAccountType(fresh.account_type) as "PL" | "BS");
                          setEditActive(fresh.is_active);
                          setEditGroup(fresh.gl_group ?? "");
                          setEditSubgroup(fresh.gl_subgroup ?? "");
                          setEditSubSubgroup(fresh.gl_sub_subgroup ?? "");
                          setEditFsHead(fresh.fs_head ?? "");
                          setEditFsNote(fresh.fs_note ?? "");
                          setEditTbMapping(fresh.tb_mapping ?? "");
                          setEditGroupAccNum(fresh.group_account_number ?? "");
                          setEditGroupAccName(fresh.group_account_name ?? "");
                          setEditClassification(fresh.account_classification ?? "");
                          setEditIsForeignCurrency(fresh.is_foreign_currency ?? false);
                          setEditForeignCurrencyCode(fresh.foreign_currency_code ?? "");
                          setEditRevalueAtPeriodEnd(fresh.revalue_at_period_end ?? false);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                      {dimensions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openDimModal(gl)}
                          className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                        >
                          Dimensions
                        </button>
                      )}
                      {gl.is_active && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(gl)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}

      {coaTab === "groups" && (
        <div className="max-w-3xl">
          <div className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 mb-4">
            <span className="text-sm text-gray-600">GL group hierarchy — auto-derived from your chart of accounts</span>
            <span className="text-xs text-gray-400">
              {accounts.filter(a => a.is_active && a.gl_group).length} accounts · {groupNodes.filter(g => g.name !== "(No group)").length} groups
            </span>
          </div>

          {groupNodes.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <i className="ti ti-folder text-gray-300" style={{ fontSize: 32 }} />
              <p className="text-sm text-gray-500 mt-2">No GL groups defined yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Add GL group names when creating or editing GL accounts on the Accounts tab.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {groupNodes.map(group => (
                <div key={group.name}>
                  {/* Level 1 — GL Group */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <i
                      className={`ti ${expandedGroups.has(group.name) ? "ti-chevron-down" : "ti-chevron-right"}`}
                      style={{ fontSize: 14, color: "#6b7280" }}
                    />
                    <span className="text-sm font-medium text-gray-800">{group.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{group.count} accounts</span>
                  </button>

                  {expandedGroups.has(group.name) && (
                    <div className="ml-4">
                      {/* Level 2 — Subgroup nodes */}
                      {group.subgroups.map(sub => (
                        <div key={sub.name} className="ml-2 border-l border-gray-200 pl-3">
                          <button
                            type="button"
                            onClick={() => toggleSubgroup(group.name, sub.name)}
                            className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 text-left"
                          >
                            <i
                              className={`ti ${expandedSubgroups.has(group.name + "||" + sub.name) ? "ti-chevron-down" : "ti-chevron-right"}`}
                              style={{ fontSize: 13, color: "#9ca3af" }}
                            />
                            <span className="text-sm text-gray-700">{sub.name}</span>
                            <span className="ml-auto text-xs text-gray-400">{sub.count} accounts</span>
                          </button>

                          {expandedSubgroups.has(group.name + "||" + sub.name) && (
                            <div className="ml-4 border-l border-gray-100 pl-3">
                              {/* Level 3 — Sub-subgroup nodes */}
                              {sub.subSubgroups.map(ssub => {
                                const ssKey = group.name + "||" + sub.name + "||" + ssub.name;
                                return (
                                  <div key={ssub.name}>
                                    <button
                                      type="button"
                                      onClick={() => toggleSubSubgroup(group.name, sub.name, ssub.name)}
                                      className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 text-left"
                                    >
                                      <i
                                        className={`ti ${expandedSubSubgroups.has(ssKey) ? "ti-chevron-down" : "ti-chevron-right"}`}
                                        style={{ fontSize: 12, color: "#d1d5db" }}
                                      />
                                      <span className="text-xs text-gray-600">{ssub.name}</span>
                                      <span className="ml-auto text-xs text-gray-400">{ssub.count}</span>
                                    </button>
                                    {/* Level 4 — GL accounts under sub-subgroup */}
                                    {expandedSubSubgroups.has(ssKey) && (
                                      <div className="ml-4 border-l border-gray-50 pl-3">
                                        {ssub.accounts.map(a => (
                                          <div key={a.id} className="flex items-center gap-2 py-1 px-2">
                                            <i className="ti ti-minus" style={{ fontSize: 11, color: "#e5e7eb" }} />
                                            <button
                                              type="button"
                                              onClick={() => { setCoaTab("accounts"); updateCoaTabUrl("accounts"); setFilterGL(a.gl_number); }}
                                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                              {a.gl_number}
                                            </button>
                                            <span className="text-xs text-gray-500">{a.gl_name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Direct GL accounts under subgroup (no sub-subgroup) */}
                              {sub.accounts.map(a => (
                                <div key={a.id} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50">
                                  <i className="ti ti-minus" style={{ fontSize: 12, color: "#d1d5db" }} />
                                  <button
                                    type="button"
                                    onClick={() => { setCoaTab("accounts"); updateCoaTabUrl("accounts"); setFilterGL(a.gl_number); }}
                                    className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {a.gl_number}
                                  </button>
                                  <span className="text-xs text-gray-600 ml-1">{a.gl_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Direct GL accounts under group (no subgroup) */}
                      {group.accounts.map(a => (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 py-1 pl-8 hover:bg-gray-50 cursor-pointer"
                          onClick={() => { setCoaTab("accounts"); updateCoaTabUrl("accounts"); setFilterGL(a.gl_number); }}
                        >
                          <span className="text-xs font-mono text-gray-400 w-16">{a.gl_number}</span>
                          <span className="text-xs text-gray-600">{a.gl_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {coaTab === "fs_mappings" && (
        <div className="max-w-4xl">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-4">
            <i className="ti ti-info-circle text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
            <p className="text-xs text-blue-700">
              FS Head, FS Note, and TB Mapping are set when editing a GL account. Click a GL number to jump to that account. Amber rows have no FS Head set.
            </p>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <select value={fsTypeFilter} onChange={e => handleFsTypeChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All account types</option>
              <option value="PL">PL — Profit &amp; Loss</option>
              <option value="BS">BS — Balance Sheet</option>
            </select>
            <select value={fsFsHeadFilter} onChange={e => handleFsHeadChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All FS Heads</option>
              {fsHeadOptions.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select value={filterFsNote} onChange={e => handleFsNoteChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All FS Notes</option>
              {fsNoteOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={filterTbMapping} onChange={e => setFilterTbMapping(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All TB Mappings</option>
              {tbMappingOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(fsTypeFilter || fsFsHeadFilter || filterFsNote || filterTbMapping) && (
              <button type="button" onClick={() => { setFsTypeFilter(""); setFsFsHeadFilter(""); setFilterFsNote(""); setFilterTbMapping(""); }}
                className="text-xs text-blue-600 hover:text-blue-800">
                Clear filters
              </button>
            )}
            {fsMappingsSort.length > 0 && (
              <button type="button" onClick={() => setFsMappingsSort([])}
                className="text-xs text-gray-500 hover:text-gray-700 underline">
                Clear sorting
              </button>
            )}
          </div>

          {fsMappingsLoading ? (
            <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide text-[10px]">Type</th>
                      {[
                        { key: "gl_number", label: "GL Number" },
                        { key: "gl_name", label: "GL Name" },
                        { key: "fs_head", label: "FS Head" },
                        { key: "fs_note", label: "FS Note" },
                        { key: "tb_mapping", label: "TB Mapping" },
                      ].map(col => (
                        <th key={col.key}
                          onClick={() => toggleSort(fsMappingsSort, setFsMappingsSort, col.key)}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none">
                          {col.label}
                          <SortIndicator col={col.key} sort={fsMappingsSort} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedFsMappings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                          {fsMappings.length === 0 ? "No GL accounts found." : "No accounts match the current filters."}
                        </td>
                      </tr>
                    ) : sortedFsMappings.map(m => {
                      const isMapped = !!m.fs_head;
                      return (
                        <tr key={m.id} className={isMapped ? "hover:bg-gray-50" : "bg-amber-50 hover:bg-amber-100"}>
                          <td className="px-4 py-2.5 text-gray-500">{normaliseAccountType(m.account_type)}</td>
                          <td className="px-4 py-2.5 font-mono">
                            <button type="button"
                              onClick={() => { setCoaTab("accounts"); updateCoaTabUrl("accounts"); setFilterGL(m.gl_number); }}
                              className="text-blue-600 hover:text-blue-800 hover:underline">
                              {m.gl_number}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-gray-800">{m.gl_name}</td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {m.fs_head ?? <span className="italic text-gray-400">not set</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {m.fs_note ?? <span className="italic text-gray-400">not set</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {m.tb_mapping ?? <span className="italic text-gray-400">not set</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {fsMappings.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  Showing {sortedFsMappings.length} of {fsMappings.length} accounts · {fsMappings.filter(m => !m.fs_head).length} accounts have no FS Head set
                </p>
              )}
            </>
          )}
        </div>
      )}

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
                  <option value="PL">PL</option>
                  <option value="BS">BS</option>
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

              {/* Bulk edit toolbar */}
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
                  <Button variant="primary" size="sm" onClick={handleBulkUpdate} disabled={!bulkDimId || bulkSaving} loading={bulkSaving}>
                    {bulkSaving ? "Saving..." : "Apply to selected"}
                  </Button>
                  <button onClick={() => setDimSelected(new Set())}
                    className="text-blue-600 underline text-xs">
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
                        <td style={{ padding: "6px 10px" }}>
                          <button
                            type="button"
                            onClick={() => { setCoaTab("accounts"); updateCoaTabUrl("accounts"); setFilterGL(a.gl_number); }}
                            className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {a.gl_number}
                          </button>
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
                          const badgeStyles: Record<string, React.CSSProperties> = {
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
                              <span style={badgeStyles[req] ?? badgeStyles.optional}>
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

      {showTemplateOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40"
            onClick={() => setShowTemplateOptions(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Download CoA Template</h2>
            <p className="text-xs text-gray-500 mb-4">
              Uncheck columns you don&apos;t need. Mandatory columns are always included.
            </p>

            {/* Mandatory */}
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Always included
            </p>
            <div className="space-y-1 mb-4">
              {["GL Number *", "GL Name *", "Account Type *"].map(col => (
                <div key={col} className="flex items-center gap-2 opacity-50">
                  <input type="checkbox" checked disabled
                    className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0" />
                  <span className="text-xs text-gray-600 flex-1">{col}</span>
                  <span className="text-[10px] text-gray-400">Mandatory</span>
                </div>
              ))}
            </div>

            {/* Optional — individual */}
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Optional columns
            </p>
            <div className="space-y-1 mb-4">
              {([
                { key: "is_active" as const,              label: "Is Active",                      desc: "Yes / No" },
                { key: "gl_group" as const,               label: "GL Group",                       desc: "Top-level GL grouping" },
                { key: "gl_subgroup" as const,            label: "GL Subgroup",                    desc: "Second-level grouping" },
                { key: "gl_sub_subgroup" as const,        label: "GL Sub-subgroup",                desc: "Third-level grouping" },
                { key: "fs_head" as const,                label: "FS Head",                        desc: "Financial statement face line" },
                { key: "fs_note" as const,                label: "FS Note",                        desc: "FS note reference" },
                { key: "tb_mapping" as const,             label: "TB Mapping",                     desc: "Trial balance roll-up group" },
                { key: "account_classification" as const, label: "Account Classification",          desc: "For module-level behaviour" },
                { key: "category" as const,               label: "Category",                       desc: "Expense category name" },
                { key: "subcategory" as const,            label: "Subcategory",                    desc: "Subcategory name" },
                { key: "is_default_gl" as const,          label: "Is Default GL for Subcategory",  desc: "Yes / No" },
              ] as { key: keyof typeof templateCols; label: string; desc: string }[]).map(opt => (
                <label key={opt.key}
                  className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1">
                  <input type="checkbox"
                    className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                    checked={templateCols[opt.key]}
                    onChange={e => setTemplateCols(prev => ({
                      ...prev, [opt.key]: e.target.checked
                    }))} />
                  <span className="text-xs text-gray-800 flex-1">{opt.label}</span>
                  <span className="text-[10px] text-gray-400">{opt.desc}</span>
                </label>
              ))}

              {/* Group account */}
              <label className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1">
                <input type="checkbox"
                  className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                  checked={templateCols.group_account}
                  onChange={e => setTemplateCols(prev => ({
                    ...prev, group_account: e.target.checked
                  }))} />
                <span className="text-xs text-gray-800 flex-1">Group Account Mapping</span>
                <span className="text-[10px] text-gray-400">Group Number + Name</span>
              </label>
            </div>

            <div className="flex items-center justify-between mb-4">
              <button type="button"
                onClick={() => setTemplateCols({
                  is_active: true, gl_group: true, gl_subgroup: true,
                  gl_sub_subgroup: true, fs_head: true, fs_note: true,
                  tb_mapping: true, group_account: true,
                  account_classification: true, category: true,
                  subcategory: true, is_default_gl: true,
                })}
                className="text-xs text-blue-600 hover:text-blue-800">
                Select all
              </button>
              <button type="button"
                onClick={() => setTemplateCols({
                  is_active: false, gl_group: false, gl_subgroup: false,
                  gl_sub_subgroup: false, fs_head: false, fs_note: false,
                  tb_mapping: false, group_account: false,
                  account_classification: false, category: false,
                  subcategory: false, is_default_gl: false,
                })}
                className="text-xs text-gray-500 hover:text-gray-700">
                Clear all
              </button>
            </div>

            <p className="text-[11px] text-gray-400 italic mb-4">
              Dimension columns are always included based on your configured dimensions.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowTemplateOptions(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDownloadTemplate} disabled={downloadingTemplate} loading={downloadingTemplate}>
                {downloadingTemplate
                  ? <><i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} /> Generating…</>
                  : <><i className="ti ti-download" style={{ fontSize: 14 }} /> Download</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Use a default template</h2>
            <p className="text-xs text-gray-500 mb-4">
              Select a starter Chart of Accounts. All accounts are fully editable after adoption.
            </p>

            {templateModalLoading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading templates…</p>
            ) : (
              <div className="space-y-2 mb-4">
                {templateList.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedTemplateId === tpl.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{tpl.name}</span>
                      {tpl.id === suggestedTemplateId && (
                        <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex-shrink-0">
                          Suggested
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{tpl.account_count} accounts</p>
                  </button>
                ))}
              </div>
            )}

            {templateModalError && (
              <p className="text-xs text-red-600 mb-3">{templateModalError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                disabled={templateAdopting}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdoptTemplate}
                disabled={!selectedTemplateId || templateAdopting || templateModalLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {templateAdopting
                  ? <><i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} /> Applying…</>
                  : "Apply template"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateConfirmGl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40"
            onClick={() => !deactivating && setDeactivateConfirmGl(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-alert-triangle text-amber-500" style={{ fontSize: 18 }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Deactivate {deactivateConfirmGl.gl_number}?
                </p>
                <p className="text-xs text-gray-500">
                  &quot;{deactivateConfirmGl.gl_name}&quot; will be deactivated and hidden from transaction entry.
                  Existing posted transactions are not affected.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeactivateConfirmGl(null)}
                disabled={deactivating}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={confirmDeactivate} disabled={deactivating}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                {deactivating
                  ? <><i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} /> Deactivating…</>
                  : <><i className="ti ti-eye-off" style={{ fontSize: 14 }} /> Deactivate</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
