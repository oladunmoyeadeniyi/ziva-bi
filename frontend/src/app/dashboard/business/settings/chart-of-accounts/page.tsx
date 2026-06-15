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

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface GLAccount {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  is_active: boolean;
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

type CoATab = "accounts" | "groups" | "fs_mappings";

const SOCI_CLASSIFICATIONS = [
  "Revenue — trading",
  "Revenue — other income",
  "Revenue — capital gain",
  "Cost of sales",
  "Operating expense",
  "Finance income",
  "Finance cost",
  "Tax charge — current",
  "Tax charge — deferred",
];

const SOFP_CLASSIFICATIONS = [
  "Fixed asset — tangible",
  "Fixed asset — intangible",
  "Fixed asset — right of use",
  "Investment",
  "Inventory",
  "Trade receivable",
  "Other receivable",
  "Prepayment",
  "Cash and bank",
  "Trade payable",
  "Other payable",
  "Accrual",
  "Tax payable — current",
  "Tax payable — deferred",
  "Borrowing",
  "Lease liability",
  "Share capital",
  "Retained earnings",
  "Other reserve",
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

  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubsidiary, setIsSubsidiary] = useState(false);

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
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

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
  const [coaTab, setCoaTab] = useState<CoATab>("accounts");

  // Deactivate confirmation modal
  const [deactivateConfirmGl, setDeactivateConfirmGl] = useState<GLAccount | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Upload
  const [uploadResult, setUploadResult] = useState<UploadResultType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceAllConfirm, setReplaceAllConfirm] = useState(false);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // FS mappings tab
  const [fsMappings, setFsMappings] = useState<FSMappingItem[]>([]);
  const [fsMappingsLoading, setFsMappingsLoading] = useState(false);
  const [fsTypeFilter, setFsTypeFilter] = useState("");
  const [fsFsHeadFilter, setFsFsHeadFilter] = useState("");

  // Account groups expand state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [expandedSubSubgroups, setExpandedSubSubgroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) router.replace("/dashboard/business");
  }, [user, router]);

  const load = async () => {
    if (!accessToken) return;
    try {
      const [accs, dims] = await Promise.all([
        apiFetch<GLAccount[]>(`/api/config/coa?active_only=false&limit=10000`, { token: accessToken }),
        apiFetch<Dimension[]>("/api/config/dimensions", { token: accessToken }),
      ]);
      setAccounts(accs);
      setDimensions(dims.filter((d) => d.is_active));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts.");
    } finally {
      setIsLoading(false);
    }
    // Check subsidiary status
    try {
      const orgConfig = await apiFetch<{ org_configuration?: { structure_type?: string } }>(
        "/api/setup/org", { token: accessToken! }
      );
      const structureType = orgConfig.org_configuration?.structure_type ?? "";
      setIsSubsidiary(["subsidiary", "branch"].includes(structureType.toLowerCase()));
    } catch {}
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (coaTab !== "fs_mappings" || !accessToken) return;
    setFsMappingsLoading(true);
    apiFetch<FSMappingItem[]>("/api/config/coa/fs-mappings", { token: accessToken })
      .then(data => setFsMappings(data))
      .catch(() => setFsMappings([]))
      .finally(() => setFsMappingsLoading(false));
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

  const filteredAccounts = accounts
    .filter(a => {
      if (filterGL && !a.gl_number.toLowerCase().includes(filterGL.toLowerCase())) return false;
      if (filterName && !a.gl_name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterGroup && !(a.gl_group ?? "").toLowerCase().includes(filterGroup.toLowerCase())) return false;
      if (filterType && normaliseAccountType(a.account_type) !== filterType) return false;
      if (filterClassification && !(a.account_classification ?? "").toLowerCase().includes(filterClassification.toLowerCase())) return false;
      if (filterStatus === "active" && !a.is_active) return false;
      if (filterStatus === "inactive" && a.is_active) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return a.gl_number.localeCompare(b.gl_number);
    });

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
    const nodeMap = new Map<string, { count: number; subgroups: Map<string, { count: number; subSubgroups: Map<string, number> }> }>();
    accounts.filter(a => a.is_active && a.gl_group).forEach(a => {
      const g = a.gl_group!;
      if (!nodeMap.has(g)) nodeMap.set(g, { count: 0, subgroups: new Map() });
      const gNode = nodeMap.get(g)!;
      gNode.count++;
      if (a.gl_subgroup) {
        if (!gNode.subgroups.has(a.gl_subgroup)) gNode.subgroups.set(a.gl_subgroup, { count: 0, subSubgroups: new Map() });
        const sNode = gNode.subgroups.get(a.gl_subgroup)!;
        sNode.count++;
        if (a.gl_sub_subgroup && a.gl_sub_subgroup !== a.gl_subgroup) {
          sNode.subSubgroups.set(a.gl_sub_subgroup, (sNode.subSubgroups.get(a.gl_sub_subgroup) ?? 0) + 1);
        }
      }
    });
    return Array.from(nodeMap.entries()).map(([name, gNode]) => ({
      name,
      count: gNode.count,
      subgroups: Array.from(gNode.subgroups.entries()).map(([subName, sNode]) => ({
        name: subName,
        count: sNode.count,
        subSubgroups: Array.from(sNode.subSubgroups.entries()).map(([ssName, count]) => ({
          name: ssName,
          count,
        })),
      })),
    }));
  })();

  return (
    <div className="px-6 py-8 max-w-5xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
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
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            + Add GL Account
          </button>
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
        ] as { key: CoATab; label: string }[]).map(t => (
          <button key={t.key} type="button" onClick={() => setCoaTab(t.key)}
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
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold ml-4">×</button>
        </div>
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
          <input type="text" value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            placeholder="Group…"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All types</option>
            <option value="PL">PL — Profit &amp; Loss</option>
            <option value="BS">BS — Balance Sheet</option>
          </select>
          <input type="text" value={filterClassification}
            onChange={e => setFilterClassification(e.target.value)}
            placeholder="Classification…"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
        {(filterGL || filterName || filterGroup || filterType || filterClassification || filterStatus !== "all") && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
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
              <button type="button" onClick={() => { setBulkAction(null); setBulkConfirmText(""); }} disabled={bulkProcessing}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAction}
                disabled={bulkProcessing || (bulkAction === "delete" && bulkConfirmText !== "DELETE")}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {bulkProcessing ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace All confirm modal */}
      {replaceAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Replace All GL Accounts?</h2>
            <p className="text-sm text-gray-700 mb-4">
              This will <strong>deactivate all existing GL accounts</strong> and import the new file.
              Existing expense lines will not be affected. Continue?
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setReplaceAllConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setReplaceAllConfirm(false); replaceFileRef.current?.click(); }}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
              >
                Yes, Choose File &amp; Replace
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
                <select value={addType} onChange={(e) => setAddType(e.target.value as "PL" | "BS")}
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
                  <optgroup label="Income statement (SOCI)">
                    {SOCI_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="Balance sheet (SOFP)">
                    {SOFP_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
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
              <button type="button" onClick={() => { setShowAdd(false); setAddError(null); }}
                disabled={addingGL} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={handleAdd} disabled={addingGL || !addGL.trim() || !addName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {addingGL ? "Adding…" : "Add"}
              </button>
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
                <select value={editType} onChange={(e) => setEditType(e.target.value as "PL" | "BS")}
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
                  <optgroup label="Income statement (SOCI)">
                    {SOCI_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="Balance sheet (SOFP)">
                    {SOFP_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
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
              <button type="button" onClick={() => setEditId(null)} disabled={savingEdit}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={handleEdit} disabled={savingEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {savingEdit ? "Saving…" : "Save"}
              </button>
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
              <button type="button" onClick={() => setDimGlId(null)} disabled={savingDims}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={handleSaveDims} disabled={savingDims}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {savingDims ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts table */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-1">No GL accounts yet</p>
          <p className="text-xs text-gray-400">Download the template, fill it in, then upload to import your Chart of Accounts.</p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">GL Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">GL Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Group</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Classification</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAccounts.map((gl) => (
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
                    {gl.is_active ? (
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
              {accounts.filter(a => a.is_active && a.gl_group).length} accounts · {groupNodes.length} groups
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

                  {expandedGroups.has(group.name) && group.subgroups.length > 0 && (
                    <div className="ml-4">
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
                              {sub.subSubgroups.length > 0
                                ? sub.subSubgroups.map(ssub => {
                                    const ssKey = group.name + "||" + sub.name + "||" + ssub.name;
                                    return (
                                      <div key={ssub.name}>
                                        {/* Level 3 — GL Sub-subgroup */}
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
                                        {/* Level 4 — Individual GL accounts */}
                                        {expandedSubSubgroups.has(ssKey) && (
                                          <div className="ml-4 border-l border-gray-50 pl-3">
                                            {accounts
                                              .filter(a =>
                                                a.is_active &&
                                                a.gl_group === group.name &&
                                                a.gl_subgroup === sub.name &&
                                                a.gl_sub_subgroup === ssub.name
                                              )
                                              .map(a => (
                                                <div key={a.id} className="flex items-center gap-2 py-1 px-2">
                                                  <i className="ti ti-minus" style={{ fontSize: 11, color: "#e5e7eb" }} />
                                                  <button
                                                    type="button"
                                                    onClick={() => { setCoaTab("accounts"); setFilterGL(a.gl_number); }}
                                                    className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                  >
                                                    {a.gl_number}
                                                  </button>
                                                  <span className="text-xs text-gray-500">{a.gl_name}</span>
                                                </div>
                                              ))
                                            }
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                : /* Fallback — no valid sub-subgroups: show leaf GL accounts directly */
                                  accounts
                                    .filter(a =>
                                      a.is_active &&
                                      a.gl_group === group.name &&
                                      a.gl_subgroup === sub.name &&
                                      (!a.gl_sub_subgroup || a.gl_sub_subgroup === sub.name)
                                    )
                                    .map(a => (
                                      <div key={a.id} className="flex items-center gap-2 py-1.5 px-2">
                                        <i className="ti ti-minus" style={{ fontSize: 12, color: "#d1d5db" }} />
                                        <button
                                          type="button"
                                          onClick={() => { setCoaTab("accounts"); setFilterGL(a.gl_number); }}
                                          className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                          {a.gl_number}
                                        </button>
                                        <span className="text-xs text-gray-600 ml-1">{a.gl_name}</span>
                                      </div>
                                    ))
                              }
                            </div>
                          )}
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
            <select value={fsTypeFilter} onChange={e => setFsTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All account types</option>
              <option value="PL">PL — Profit &amp; Loss</option>
              <option value="BS">BS — Balance Sheet</option>
            </select>
            <select value={fsFsHeadFilter} onChange={e => setFsFsHeadFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All FS Heads</option>
              {[...new Set(fsMappings.filter(m => m.fs_head).map(m => m.fs_head!))].sort().map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            {(fsTypeFilter || fsFsHeadFilter) && (
              <button type="button" onClick={() => { setFsTypeFilter(""); setFsFsHeadFilter(""); }}
                className="text-xs text-blue-600 hover:text-blue-800">
                Clear filters
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
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">GL Number</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">GL Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">Type</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">FS Head</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">FS Note</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">TB Mapping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const filtered = fsMappings.filter(m => {
                        if (fsTypeFilter && normaliseAccountType(m.account_type) !== fsTypeFilter) return false;
                        if (fsFsHeadFilter && m.fs_head !== fsFsHeadFilter) return false;
                        return true;
                      });
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                              {fsMappings.length === 0 ? "No GL accounts found." : "No accounts match the current filters."}
                            </td>
                          </tr>
                        );
                      }
                      return filtered.map(m => {
                        const isMapped = !!m.fs_head;
                        return (
                          <tr key={m.id} className={isMapped ? "hover:bg-gray-50" : "bg-amber-50 hover:bg-amber-100"}>
                            <td className="px-4 py-2.5 font-mono">
                              <button type="button"
                                onClick={() => { setCoaTab("accounts"); setFilterGL(m.gl_number); }}
                                className="text-blue-600 hover:text-blue-800 hover:underline">
                                {m.gl_number}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-gray-800">{m.gl_name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{normaliseAccountType(m.account_type)}</td>
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
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              {fsMappings.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  Showing {fsMappings.filter(m => {
                    if (fsTypeFilter && normaliseAccountType(m.account_type) !== fsTypeFilter) return false;
                    if (fsFsHeadFilter && m.fs_head !== fsFsHeadFilter) return false;
                    return true;
                  }).length} of {fsMappings.length} accounts · {fsMappings.filter(m => !m.fs_head).length} accounts have no FS Head set
                </p>
              )}
            </>
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
              <button type="button" onClick={() => setShowTemplateOptions(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                {downloadingTemplate
                  ? <><i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} /> Generating…</>
                  : <><i className="ti ti-download" style={{ fontSize: 14 }} /> Download</>
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
    </div>
  );
}
