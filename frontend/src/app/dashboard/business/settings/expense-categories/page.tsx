"use client";

/**
 * Expense Categories — /dashboard/business/settings/expense-categories
 *
 * Tenant Admin only. Two-panel layout: categories on the left,
 * subcategories + GL mappings for the selected category on the right.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface GLMapping {
  id: string;
  gl_id: string;
  gl_number: string;
  gl_name: string;
  is_default: boolean;
}

interface Subcategory {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  gl_mappings: GLMapping[];
}

interface Category {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  sort_order: number;
  subcategories: Subcategory[];
}

interface GLAccount {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
}

export default function ExpenseCategoriesPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Add category
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // Add subcategory
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [addingSub, setAddingSub] = useState(false);

  // Add GL mapping
  const [addingGLFor, setAddingGLFor] = useState<string | null>(null);
  const [glSearch, setGLSearch] = useState("");
  const [glSearchResults, setGLSearchResults] = useState<GLAccount[]>([]);

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) router.replace("/dashboard/business");
  }, [user, router]);

  const load = async () => {
    if (!accessToken) return;
    try {
      const [cats, gls] = await Promise.all([
        apiFetch<Category[]>("/api/config/categories", { token: accessToken }),
        apiFetch<GLAccount[]>("/api/config/coa?active_only=true", { token: accessToken }),
      ]);
      setCategories(cats);
      setGLAccounts(gls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  const handleAddCategory = async () => {
    if (!accessToken || !newCatName.trim()) return;
    setAddingCat(true);
    try {
      await apiFetch("/api/config/categories", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      setNewCatName(""); setShowAddCat(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCat = async (id: string, name: string) => {
    if (!accessToken) return;
    if (!confirm(`Deactivate "${name}" and all its subcategories?`)) return;
    try {
      await apiFetch(`/api/config/categories/${id}`, { method: "DELETE", token: accessToken });
      if (selectedCatId === id) setSelectedCatId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate category.");
    }
  };

  const handleAddSubcategory = async (parentId: string) => {
    if (!accessToken || !newSubName.trim()) return;
    setAddingSub(true);
    try {
      await apiFetch("/api/config/categories", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ name: newSubName.trim(), parent_id: parentId }),
      });
      setNewSubName(""); setAddingSubFor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subcategory.");
    } finally {
      setAddingSub(false);
    }
  };

  const handleDeleteSub = async (id: string, name: string) => {
    if (!accessToken) return;
    if (!confirm(`Deactivate "${name}"?`)) return;
    try {
      await apiFetch(`/api/config/categories/${id}`, { method: "DELETE", token: accessToken });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate subcategory.");
    }
  };

  const handleGLSearch = (term: string) => {
    setGLSearch(term);
    if (!term.trim()) {
      setGLSearchResults([]);
      return;
    }
    const lower = term.toLowerCase();
    setGLSearchResults(
      glAccounts.filter(
        (g) => g.gl_number.toLowerCase().includes(lower) || g.gl_name.toLowerCase().includes(lower)
      ).slice(0, 8)
    );
  };

  const handleAddGLMapping = async (subId: string, glId: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/config/categories/${subId}/gl-mappings`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ gl_id: glId }),
      });
      setAddingGLFor(null);
      setGLSearch("");
      setGLSearchResults([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add GL mapping.");
    }
  };

  const handleRemoveGLMapping = async (subId: string, glId: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/config/categories/${subId}/gl-mappings/${glId}`, {
        method: "DELETE",
        token: accessToken,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove GL mapping.");
    }
  };

  const handleToggleDefault = async (subId: string, glId: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/config/categories/${subId}/gl-mappings/${glId}`, {
        method: "PATCH",
        token: accessToken,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update default.");
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-3">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Expense Categories</h1>
        <button
          type="button"
          onClick={() => setShowAddCat(true)}
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + Add Category
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Build your category hierarchy and map subcategories to GL accounts.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold">×</button>
        </div>
      )}

      {/* Add category inline form */}
      {showAddCat && (
        <div className="mb-4 flex gap-2 items-center p-3 border border-blue-200 bg-blue-50 rounded-xl">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Category name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60">
            {addingCat ? "…" : "Add"}
          </button>
          <button onClick={() => { setShowAddCat(false); setNewCatName(""); }}
            className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
            Cancel
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-96">
        {/* Left panel: categories */}
        <div className="w-56 shrink-0 bg-white rounded-xl border border-gray-200 overflow-y-auto flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categories</p>
          </div>
          {categories.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400 text-center px-4">No categories yet</p>
            </div>
          ) : (
            <div className="flex-1 p-2 space-y-1">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedCatId === cat.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedCatId(cat.id)}
                >
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{cat.name}</span>
                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">
                    {cat.subcategories.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCat(cat.id, cat.name); }}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 shrink-0"
                    title="Deactivate"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: subcategories + GL mappings */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-y-auto flex flex-col">
          {!selectedCat ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Select a category to manage its subcategories and GL mappings</p>
            </div>
          ) : (
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-800">{selectedCat.name}</h2>
                <button
                  type="button"
                  onClick={() => { setAddingSubFor(selectedCat.id); setNewSubName(""); }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Subcategory
                </button>
              </div>

              {/* Add subcategory inline */}
              {addingSubFor === selectedCat.id && (
                <div className="flex gap-2 mb-4 p-2 border border-blue-100 bg-blue-50 rounded-lg">
                  <input
                    type="text"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="Subcategory name"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubcategory(selectedCat.id)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={() => handleAddSubcategory(selectedCat.id)} disabled={addingSub || !newSubName.trim()}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60">
                    {addingSub ? "…" : "Add"}
                  </button>
                  <button onClick={() => { setAddingSubFor(null); setNewSubName(""); }}
                    className="px-3 py-1 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              )}

              {glAccounts.length === 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  Upload your Chart of Accounts first before mapping GL accounts to subcategories.
                </div>
              )}

              {selectedCat.subcategories.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No subcategories yet. Add one above.</p>
              ) : (
                <div className="space-y-3">
                  {selectedCat.subcategories.map((sub) => (
                    <div key={sub.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-800">{sub.name}</span>
                        <div className="flex gap-2">
                          {glAccounts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => { setAddingGLFor(sub.id); setGLSearch(""); setGLSearchResults([]); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              + GL Account
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSub(sub.id, sub.name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Add GL mapping search */}
                      {addingGLFor === sub.id && (
                        <div className="mb-2 relative">
                          <input
                            type="text"
                            value={glSearch}
                            onChange={(e) => handleGLSearch(e.target.value)}
                            placeholder="Search GL number or name…"
                            autoFocus
                            className="w-full px-2 py-1.5 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {glSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                              {glSearchResults.map((g) => (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => handleAddGLMapping(sub.id, g.id)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                                >
                                  <span className="font-mono text-xs text-gray-500 mr-2">{g.gl_number}</span>
                                  {g.gl_name}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => { setAddingGLFor(null); setGLSearch(""); setGLSearchResults([]); }}
                            className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {/* GL mappings */}
                      {sub.gl_mappings.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No GL accounts mapped</p>
                      ) : (
                        <div className="space-y-1">
                          {sub.gl_mappings.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
                              <span className="font-mono text-xs text-gray-500">{m.gl_number}</span>
                              <span className="text-xs text-gray-700 flex-1">{m.gl_name}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleDefault(sub.id, m.gl_id)}
                                title={m.is_default ? "Default — click to unset" : "Set as default"}
                                className={`text-sm ${m.is_default ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}
                              >
                                ★
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveGLMapping(sub.id, m.gl_id)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                ×
                              </button>
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
        </div>
      </div>
    </div>
  );
}
