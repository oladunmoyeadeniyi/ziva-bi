"use client";

/**
 * Dimension Values — /dashboard/business/settings/dimensions/[id]/values
 *
 * Lists master data values for a given dimension and allows manual add,
 * bulk upload (xlsx/csv), edit, and soft-delete.
 */

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface DimensionValue {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface Dimension {
  id: string;
  name: string;
  code: string;
}

interface UploadResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export default function DimensionValuesPage() {
  const { user, accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const dimensionId = params.id as string;

  const [dimension, setDimension] = useState<Dimension | null>(null);
  const [values, setValues] = useState<DimensionValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [addOrder, setAddOrder] = useState("0");
  const [addingVal, setAddingVal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Upload
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) router.replace("/dashboard/business");
  }, [user, router]);

  const loadDimension = async () => {
    if (!accessToken) return;
    const dims = await apiFetch<Dimension[]>("/api/config/dimensions", { token: accessToken });
    const dim = dims.find((d) => d.id === dimensionId);
    if (dim) setDimension(dim);
  };

  const loadValues = async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<DimensionValue[]>(
        `/api/config/dimensions/${dimensionId}/values`,
        { token: accessToken }
      );
      setValues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load values.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([loadDimension(), loadValues()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, dimensionId]);

  const handleAdd = async () => {
    if (!accessToken || !addCode.trim() || !addName.trim()) return;
    setAddingVal(true);
    setAddError(null);
    try {
      await apiFetch(`/api/config/dimensions/${dimensionId}/values`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ code: addCode.trim(), name: addName.trim(), sort_order: parseInt(addOrder) || 0 }),
      });
      setAddCode(""); setAddName(""); setAddOrder("0"); setShowAdd(false);
      await loadValues();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add value.");
    } finally {
      setAddingVal(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!accessToken) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/config/dimensions/${dimensionId}/values/${id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ code: editCode.trim(), name: editName.trim() }),
      });
      setEditId(null);
      await loadValues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update value.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!accessToken) return;
    if (!confirm(`Deactivate value "${code}"?`)) return;
    try {
      await apiFetch(`/api/config/dimensions/${dimensionId}/values/${id}`, {
        method: "DELETE",
        token: accessToken,
      });
      await loadValues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate value.");
    }
  };

  const handleUpload = async (file: File) => {
    if (!accessToken) return;
    setUploading(true);
    setUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await apiFetch<UploadResult>(
        `/api/config/dimensions/${dimensionId}/values/upload`,
        { method: "POST", token: accessToken, body: form, isFormData: true }
      );
      setUploadResult(result);
      await loadValues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const activeValues = values.filter((v) => v.is_active);

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-3">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/dashboard/business/settings/dimensions" className="hover:text-blue-600">
          Dimensions
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{dimension?.name ?? "Loading…"}</span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">
          {dimension?.name ?? "Dimension"} Values
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload .xlsx/.csv"}
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
            onClick={() => { setShowAdd(true); setEditId(null); }}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            + Add Value
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Upload expected columns: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">code</code>,{" "}
        <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">name</code>,{" "}
        <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">sort_order</code> (optional)
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
            {uploadResult.imported} imported · {uploadResult.skipped} skipped · {uploadResult.errors.length} errors
          </p>
          {uploadResult.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-700 space-y-0.5">
              {uploadResult.errors.map((e, i) => (
                <li key={i}>Row {e.row}: {e.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-5 p-4 border border-blue-200 bg-blue-50 rounded-xl">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">New Value</p>
          {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={addCode}
                onChange={(e) => setAddCode(e.target.value)}
                placeholder="e.g. NG_FI"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Nigeria Finance"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
              <input
                type="number"
                value={addOrder}
                onChange={(e) => setAddOrder(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={addingVal || !addCode.trim() || !addName.trim()}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {addingVal ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddCode(""); setAddName(""); setAddError(null); }}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeValues.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-1">No values yet</p>
          <p className="text-xs text-gray-400">Add values manually or upload a .xlsx/.csv file.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeValues.map((val) => (
                <tr key={val.id} className="hover:bg-gray-50">
                  {editId === val.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(val.id)}
                            disabled={savingEdit}
                            className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-60"
                          >
                            {savingEdit ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditId(null)} className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-gray-800">{val.code}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{val.name}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => { setEditId(val.id); setEditCode(val.code); setEditName(val.name); setShowAdd(false); }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(val.id, val.code)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
