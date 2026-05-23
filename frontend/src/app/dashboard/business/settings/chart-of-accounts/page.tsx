"use client";

/**
 * Chart of Accounts — /dashboard/business/settings/chart-of-accounts
 *
 * Tenant Admin only. Manage the company's GL accounts — add manually,
 * upload from xlsx/csv, download a pre-configured template, and set
 * dimension requirements per GL account.
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
}

interface Dimension {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface UploadResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export default function ChartOfAccountsPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addGL, setAddGL] = useState("");
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<"PL" | "BS">("PL");
  const [addingGL, setAddingGL] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editGL, setEditGL] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"PL" | "BS">("PL");
  const [savingEdit, setSavingEdit] = useState(false);

  // Dimensions modal
  const [dimGlId, setDimGlId] = useState<string | null>(null);
  const [dimRequirements, setDimRequirements] = useState<Record<string, string>>({});
  const [savingDims, setSavingDims] = useState(false);

  // Upload
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
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
      setAddGL(""); setAddName(""); setAddType("PL"); setShowAdd(false);
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

  const handleUpload = async (file: File) => {
    if (!accessToken) return;
    setUploading(true);
    setUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await apiFetch<UploadResult>("/api/config/coa/upload", {
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "coa_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download template.");
    } finally {
      setDownloadingTemplate(false);
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

  return (
    <div className="px-6 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
        <div className="flex gap-2">
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
            {uploading ? "Uploading…" : "Upload CoA"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.csv"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
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
        Upload your company&apos;s GL accounts. Download the template to get the correct format with your configured dimensions.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold">×</button>
        </div>
      )}

      {uploadResult && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm">
          <p className="font-medium text-green-800 mb-1">Upload complete</p>
          <p className="text-green-700">
            {uploadResult.imported} imported · {uploadResult.updated} updated · {uploadResult.skipped} skipped · {uploadResult.errors.length} errors
          </p>
          {uploadResult.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-700 space-y-0.5">
              {uploadResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>Row {e.row}: {e.reason}</li>
              ))}
              {uploadResult.errors.length > 10 && <li>…and {uploadResult.errors.length - 10} more</li>}
            </ul>
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
                <select value={addType} onChange={(e) => setAddType(e.target.value as "PL" | "BS")}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="PL">P&L</option>
                  <option value="BS">Balance Sheet</option>
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
                <select value={editType} onChange={(e) => setEditType(e.target.value as "PL" | "BS")}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="PL">P&L</option>
                  <option value="BS">Balance Sheet</option>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">GL Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">GL Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((gl) => (
                <tr key={gl.id} className={`hover:bg-gray-50 ${!gl.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{gl.gl_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{gl.gl_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      gl.account_type === "PL" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                    }`}>
                      {gl.account_type === "PL" ? "P&L" : "B/S"}
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
                        onClick={() => { setEditId(gl.id); setEditGL(gl.gl_number); setEditName(gl.gl_name); setEditType(gl.account_type as "PL" | "BS"); }}
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
