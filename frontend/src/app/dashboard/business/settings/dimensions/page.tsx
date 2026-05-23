"use client";

/**
 * Dimensions management — /dashboard/business/settings/dimensions
 *
 * Tenant Admin only. Allows defining the company's financial dimensions
 * (Cost Center, IO, Brand, etc.) with code, required flag, and sort order.
 * Provides links to manage each dimension's values.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface Dimension {
  id: string;
  name: string;
  code: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

function generateCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export default function DimensionsPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addRequired, setAddRequired] = useState(false);
  const [addingDim, setAddingDim] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editRequired, setEditRequired] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) {
      router.replace("/dashboard/business");
    }
  }, [user, router]);

  const load = async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<Dimension[]>("/api/config/dimensions", { token: accessToken });
      setDimensions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dimensions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!accessToken || !addName.trim()) return;
    setAddingDim(true);
    setAddError(null);
    try {
      await apiFetch("/api/config/dimensions", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: addName.trim(),
          code: addCode.trim() || undefined,
          is_required: addRequired,
        }),
      });
      setAddName(""); setAddCode(""); setAddRequired(false); setShowAdd(false);
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create dimension.");
    } finally {
      setAddingDim(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!accessToken) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/config/dimensions/${id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ name: editName.trim(), code: editCode.trim(), is_required: editRequired }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dimension.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!accessToken) return;
    if (!confirm(`Deactivate dimension "${name}"?`)) return;
    try {
      await apiFetch(`/api/config/dimensions/${id}`, { method: "DELETE", token: accessToken });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate dimension.");
    }
  };

  const handleMoveUp = async (dim: Dimension, index: number) => {
    if (!accessToken || index === 0) return;
    const prevOrder = dimensions[index - 1].sort_order;
    try {
      await apiFetch(`/api/config/dimensions/${dim.id}/reorder`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ sort_order: prevOrder - 1 }),
      });
      await load();
    } catch {}
  };

  const handleMoveDown = async (dim: Dimension, index: number) => {
    if (!accessToken || index === dimensions.length - 1) return;
    const nextOrder = dimensions[index + 1].sort_order;
    try {
      await apiFetch(`/api/config/dimensions/${dim.id}/reorder`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ sort_order: nextOrder + 1 }),
      });
      await load();
    } catch {}
  };

  const activeDims = dimensions.filter((d) => d.is_active);

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-3">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Financial Dimensions</h1>
        <button
          type="button"
          onClick={() => { setShowAdd(true); setEditId(null); }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + Add Dimension
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Define dimensions your employees may need to fill in on expense lines (e.g. Cost Center, IO, Brand).
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold">×</button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-5 p-4 border border-blue-200 bg-blue-50 rounded-xl">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">New Dimension</p>
          {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={addName}
                onChange={(e) => { setAddName(e.target.value); setAddCode(generateCode(e.target.value)); }}
                placeholder="e.g. Cost Center"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
              <input
                type="text"
                value={addCode}
                onChange={(e) => setAddCode(e.target.value)}
                placeholder="auto-generated"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={addRequired}
                onChange={(e) => setAddRequired(e.target.checked)}
                className="accent-blue-600"
              />
              Required by default on all expense lines
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={addingDim || !addName.trim()}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {addingDim ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddName(""); setAddCode(""); setAddError(null); }}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dimensions table */}
      {activeDims.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-1">No dimensions configured</p>
          <p className="text-xs text-gray-400">Add dimensions to define what employees must fill in per expense line.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Required</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeDims.map((dim, idx) => (
                <tr key={dim.id} className="hover:bg-gray-50">
                  {editId === dim.id ? (
                    <>
                      <td className="px-4 py-2" colSpan={3}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={editRequired}
                            onChange={(e) => setEditRequired(e.target.checked)}
                            className="accent-blue-600"
                          />
                          Required by default
                        </label>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(dim.id)}
                            disabled={savingEdit}
                            className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-60"
                          >
                            {savingEdit ? "…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{dim.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {dim.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {dim.is_required ? (
                          <span className="text-xs font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(dim, idx)}
                            disabled={idx === 0}
                            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(dim, idx)}
                            disabled={idx === activeDims.length - 1}
                            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <Link
                            href={`/dashboard/business/settings/dimensions/${dim.id}/values`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Values →
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(dim.id);
                              setEditName(dim.name);
                              setEditCode(dim.code);
                              setEditRequired(dim.is_required);
                              setShowAdd(false);
                            }}
                            className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(dim.id, dim.name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Deactivate
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
