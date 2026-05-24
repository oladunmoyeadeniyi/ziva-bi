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
}

interface Dimension {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

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
  const [addingGL, setAddingGL] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editGL, setEditGL] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"SOCI" | "SOFP">("SOCI");
  const [savingEdit, setSavingEdit] = useState(false);

  // Dimensions modal
  const [dimGlId, setDimGlId] = useState<string | null>(null);
  const [dimRequirements, setDimRequirements] = useState<Record<string, string>>({});
  const [savingDims, setSavingDims] = useState(false);

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
        body: JSON.stringify({ gl_number: addGL.trim(), gl_name: addName.trim(), account_type: addType }),
      });
      setAddGL(""); setAddName(""); setAddType("SOCI"); setShowAdd(false);
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
        body: JSON.stringify({ gl_number: editGL.trim(), gl_name: editName.trim(), account_type: editType }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update GL account.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeactivate = async (id: string, glNumber: string) => {
    if (!accessToken) return;
    if (!confirm(`Deactivate GL account ${glNumber}?`)) return;
    try {
      await apiFetch(`/api/config/coa/${id}`, { method: "DELETE", token: accessToken });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate account.");
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

  const openDimModal = (gl: GLAccount) => {
    setDimGlId(gl.id);
    const defaults: Record<string, string> = {};
    dimensions.forEach((d) => { defaults[d.id] = "optional"; });
    setDimRequirements(defaults);
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
      <p className="text-sm text-gray-500 mb-6">
        Manage GL accounts. Download the template for the full enterprise format with hierarchy, FS mappings, and dynamic dimension columns.
      </p>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Add GL Account</h2>
            {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}
            <div className="space-y-3">
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Type <span className="text-red-500">*</span></label>
                <select value={addType} onChange={(e) => setAddType(e.target.value as "SOCI" | "SOFP")}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="SOCI">SOCI — P&amp;L (Income Statement)</option>
                  <option value="SOFP">SOFP — Balance Sheet</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Edit GL Account</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GL Number</label>
                <input type="text" value={editGL} onChange={(e) => setEditGL(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GL Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
                <select value={editType} onChange={(e) => setEditType(e.target.value as "SOCI" | "SOFP")}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="SOCI">SOCI — P&amp;L</option>
                  <option value="SOFP">SOFP — Balance Sheet</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
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
            {dimensions.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No dimensions configured yet.</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {dimensions.map((dim) => (
                  <div key={dim.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{dim.name}</span>
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
                        onClick={() => { setEditId(gl.id); setEditGL(gl.gl_number); setEditName(gl.gl_name); setEditType((gl.account_type === "PL" ? "SOCI" : gl.account_type === "BS" ? "SOFP" : gl.account_type) as "SOCI" | "SOFP"); }}
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
                          onClick={() => handleDeactivate(gl.id, gl.gl_number)}
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
    </div>
  );
}
