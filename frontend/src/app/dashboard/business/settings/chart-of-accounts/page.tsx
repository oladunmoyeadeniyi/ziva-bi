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

interface SheetResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

type UploadResultType = SheetResult | { sheet1: SheetResult; sheet2: SheetResult };

function SheetResultDisplay({ result, label }: { result: SheetResult; label: string }) {
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
  const [search, setSearch] = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | "delete" | null>(null);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addGL, setAddGL] = useState("");
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<"SOCI" | "SOFP">("SOCI");
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
  const [editType, setEditType] = useState<"SOCI" | "SOFP">("SOCI");
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

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) router.replace("/dashboard/business");
  }, [user, router]);

  const load = async () => {
    if (!accessToken) return;
    try {
      const [accs, dims] = await Promise.all([
        apiFetch<GLAccount[]>(`/api/config/coa?search=${encodeURIComponent(search)}&active_only=false`, { token: accessToken }),
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
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    if (!accessToken) return;
    try {
      const accs = await apiFetch<GLAccount[]>(
        `/api/config/coa?search=${encodeURIComponent(search)}&active_only=false`,
        { token: accessToken }
      );
      setAccounts(accs);
      setSelectedIds(new Set());
    } catch {}
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
      setAddGL(""); setAddName(""); setAddType("SOCI");
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
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${BASE}/api/config/coa/template`, {
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
    if (selectedIds.size === accounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(accounts.map((a) => a.id)));
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

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-3">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const isMultiSheetResult = uploadResult && "sheet1" in uploadResult;

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
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            {downloadingTemplate ? "…" : "Download Template"}
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
            <>
              <SheetResultDisplay result={(uploadResult as { sheet1: SheetResult; sheet2: SheetResult }).sheet1} label="Sheet 1 — GL Accounts" />
              <SheetResultDisplay result={(uploadResult as { sheet1: SheetResult; sheet2: SheetResult }).sheet2} label="Sheet 2 — Dimensions" />
            </>
          ) : (
            <SheetResultDisplay result={uploadResult as SheetResult} label="GL Accounts" />
          )}
        </div>
      )}

      {coaTab === "accounts" && (<>
      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by GL number or name…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Search
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(""); load(); }} className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            Clear
          </button>
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
                <select value={addType} onChange={(e) => setAddType(e.target.value as "SOCI" | "SOFP")}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="SOCI">SOCI — Statement of Comprehensive Income</option>
                  <option value="SOFP">SOFP — Statement of Financial Position</option>
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
                <select value={editType} onChange={(e) => setEditType(e.target.value as "SOCI" | "SOFP")}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="SOCI">SOCI — Statement of Comprehensive Income</option>
                  <option value="SOFP">SOFP — Statement of Financial Position</option>
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
                    checked={selectedIds.size === accounts.length && accounts.length > 0}
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
              {accounts.map((gl) => (
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
                      gl.account_type === "SOCI" || gl.account_type === "PL"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}>
                      {gl.account_type === "PL" ? "SOCI" : gl.account_type === "BS" ? "SOFP" : gl.account_type}
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
                        onClick={() => {
                          setEditId(gl.id);
                          setEditGL(gl.gl_number);
                          setEditName(gl.gl_name);
                          setEditType((gl.account_type === "PL" ? "SOCI" : gl.account_type === "BS" ? "SOFP" : gl.account_type) as "SOCI" | "SOFP");
                          setEditActive(gl.is_active);
                          setEditGroup(gl.gl_group ?? "");
                          setEditSubgroup(gl.gl_subgroup ?? "");
                          setEditSubSubgroup(gl.gl_sub_subgroup ?? "");
                          setEditFsHead(gl.fs_head ?? "");
                          setEditFsNote(gl.fs_note ?? "");
                          setEditTbMapping(gl.tb_mapping ?? "");
                          setEditGroupAccNum(gl.group_account_number ?? "");
                          setEditGroupAccName(gl.group_account_name ?? "");
                          setEditClassification(gl.account_classification ?? "");
                          setEditIsForeignCurrency(gl.is_foreign_currency ?? false);
                          setEditForeignCurrencyCode(gl.foreign_currency_code ?? "");
                          setEditRevalueAtPeriodEnd(gl.revalue_at_period_end ?? false);
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
          <p className="text-sm text-gray-500 mb-4">
            GL groups, subgroups, and sub-subgroups used in your Chart of Accounts.
            These are defined when adding or editing GL accounts and appear here automatically.
          </p>
          {(() => {
            const groups = new Map<string, Map<string, Set<string>>>();
            accounts.filter(a => a.is_active && a.gl_group).forEach(a => {
              if (!groups.has(a.gl_group!)) groups.set(a.gl_group!, new Map());
              const subMap = groups.get(a.gl_group!)!;
              if (a.gl_subgroup) {
                if (!subMap.has(a.gl_subgroup)) subMap.set(a.gl_subgroup, new Set());
                if (a.gl_sub_subgroup) subMap.get(a.gl_subgroup)!.add(a.gl_sub_subgroup);
              }
            });

            if (groups.size === 0) {
              return (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <i className="ti ti-folder text-gray-300" style={{ fontSize: 32 }} />
                  <p className="text-sm text-gray-500 mt-2">No GL groups defined yet.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Add GL group names when creating or editing GL accounts on the Accounts tab.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {Array.from(groups.entries()).map(([group, subMap]) => (
                  <div key={group} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-800">{group}</p>
                      <p className="text-xs text-gray-400">
                        {accounts.filter(a => a.gl_group === group && a.is_active).length} GL accounts
                      </p>
                    </div>
                    {subMap.size > 0 && (
                      <div className="divide-y divide-gray-50">
                        {Array.from(subMap.entries()).map(([sub, subSubs]) => (
                          <div key={sub} className="px-4 py-2">
                            <p className="text-xs font-medium text-gray-700">
                              <span className="text-gray-300 mr-1.5">└</span>{sub}
                            </p>
                            {subSubs.size > 0 && Array.from(subSubs).map(ss => (
                              <p key={ss} className="text-xs text-gray-500 pl-5 mt-0.5">
                                <span className="text-gray-200 mr-1.5">└</span>{ss}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {coaTab === "fs_mappings" && (
        <div className="max-w-3xl">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-4">
            <i className="ti ti-info-circle text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
            <p className="text-xs text-blue-700">
              FS Head, FS Note, and TB Mapping for each GL account are set on the Accounts tab when editing a GL account.
              Per-year versioning and audit lock workflow will be available in a future release (Period Management module).
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">GL Number</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">GL Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">FS Head</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">FS Note</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wide text-[10px]">TB Mapping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts
                  .filter(a => a.is_active && (a.fs_head || a.fs_note || a.tb_mapping))
                  .map(gl => (
                    <tr key={gl.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-gray-600">{gl.gl_number}</td>
                      <td className="px-4 py-2.5 text-gray-800">{gl.gl_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{gl.fs_head || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{gl.fs_note || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{gl.tb_mapping || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Showing {accounts.filter(a => a.is_active && (a.fs_head || a.fs_note || a.tb_mapping)).length} of {accounts.filter(a => a.is_active).length} active GL accounts with FS mappings configured.
          </p>
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
