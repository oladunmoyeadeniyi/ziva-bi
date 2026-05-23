"use client";

/**
 * Expense Config settings — /dashboard/business/settings/expense-config
 *
 * Tenant Admin only.  Three sections:
 *   1. GL Coding Mode — radio buttons (employee / finance / category_mapped)
 *   2. Expense Categories — require_category / require_subcategory toggles
 *   3. Category Management — tree of categories with add/edit/deactivate actions
 *      (only shown when require_category is ON)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ExpenseConfig {
  gl_coding_mode: string;
  require_category: boolean;
  require_subcategory: boolean;
  allow_free_text_description: boolean;
}

interface Category {
  id: string;
  name: string;
  code: string | null;
  gl_account_suggestion: string | null;
  sort_order: number;
  subcategories: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  code: string | null;
  gl_account_suggestion: string | null;
  sort_order: number;
}

type GlMode = "employee" | "finance" | "category_mapped";

// ── Inline edit form state ────────────────────────────────────────────────────
interface EditState {
  id: string;
  name: string;
  code: string;
  gl_account_suggestion: string;
}

export default function ExpenseConfigPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Config state
  const [glMode, setGlMode] = useState<GlMode>("employee");
  const [requireCategory, setRequireCategory] = useState(false);
  const [requireSubcategory, setRequireSubcategory] = useState(false);

  // Category management state
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Add category form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatGl, setNewCatGl] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // Add subcategory form (keyed by parent category ID)
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [addingSub, setAddingSub] = useState(false);

  // Edit form
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) {
      router.replace("/dashboard/business");
    }
  }, [user, router]);

  // Load config
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ExpenseConfig>("/api/expense-config", { token: accessToken })
      .then((cfg) => {
        setGlMode(cfg.gl_coding_mode as GlMode);
        setRequireCategory(cfg.require_category);
        setRequireSubcategory(cfg.require_subcategory);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  // Load categories
  const loadCategories = async () => {
    if (!accessToken) return;
    setCatLoading(true);
    try {
      const data = await apiFetch<Category[]>("/api/expense-config/categories", {
        token: accessToken,
      });
      setCategories(data);
    } catch {
      setCatError("Failed to load categories.");
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Save config
  const handleSaveConfig = async () => {
    if (!accessToken) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await apiFetch<ExpenseConfig>("/api/expense-config", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          gl_coding_mode: glMode,
          require_category: requireCategory,
          require_subcategory: requireCategory ? requireSubcategory : false,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config.");
    } finally {
      setIsSaving(false);
    }
  };

  // Add top-level category
  const handleAddCategory = async () => {
    if (!accessToken || !newCatName.trim()) return;
    setAddingCat(true);
    try {
      await apiFetch("/api/expense-config/categories", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: newCatName.trim(),
          code: newCatCode.trim() || null,
          gl_account_suggestion: newCatGl.trim() || null,
        }),
      });
      setNewCatName("");
      setNewCatCode("");
      setNewCatGl("");
      setShowAddCategory(false);
      await loadCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setAddingCat(false);
    }
  };

  // Add subcategory
  const handleAddSubcategory = async (parentId: string) => {
    if (!accessToken || !newSubName.trim()) return;
    setAddingSub(true);
    try {
      await apiFetch("/api/expense-config/categories", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: newSubName.trim(),
          parent_id: parentId,
        }),
      });
      setNewSubName("");
      setAddingSubFor(null);
      await loadCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Failed to add subcategory.");
    } finally {
      setAddingSub(false);
    }
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!accessToken || !editState) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/expense-config/categories/${editState.id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({
          name: editState.name.trim(),
          code: editState.code.trim() || null,
          gl_account_suggestion: editState.gl_account_suggestion.trim() || null,
        }),
      });
      setEditState(null);
      await loadCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Failed to update category.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Deactivate category
  const handleDeactivate = async (id: string, name: string) => {
    if (!accessToken) return;
    if (!confirm(`Deactivate "${name}"? This will also deactivate its subcategories.`)) return;
    try {
      await apiFetch(`/api/expense-config/categories/${id}`, {
        method: "DELETE",
        token: accessToken,
      });
      await loadCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Failed to deactivate category.");
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Expense Form Config</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure how employees fill in GL accounts and expense categories.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold">×</button>
        </div>
      )}

      {/* ── Section 1: GL Coding Mode ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">
          GL Coding Mode
        </h2>

        <div className="space-y-4">
          {/* Employee codes GL */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            glMode === "employee" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
          }`}>
            <input
              type="radio"
              name="glMode"
              value="employee"
              checked={glMode === "employee"}
              onChange={() => setGlMode("employee")}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">Employee codes GL</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Employees select GL accounts when submitting expenses. Requires Chart of
                Accounts to be configured.
              </p>
            </div>
          </label>

          {/* Finance codes GL */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            glMode === "finance" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
          }`}>
            <input
              type="radio"
              name="glMode"
              value="finance"
              checked={glMode === "finance"}
              onChange={() => setGlMode("finance")}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Finance codes GL
                <span className="ml-2 text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                  Recommended
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Employees do not see GL fields. Finance team assigns GL codes during
                review and posting.
              </p>
            </div>
          </label>

          {/* Category-mapped GL */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            glMode === "category_mapped" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
          }`}>
            <input
              type="radio"
              name="glMode"
              value="category_mapped"
              checked={glMode === "category_mapped"}
              onChange={() => setGlMode("category_mapped")}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">Category-mapped GL</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Employees select an expense category. The system suggests a GL account
                based on category mapping. Finance can override.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* ── Section 2: Category Toggles ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">
          Expense Categories
        </h2>

        {/* Require category toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Require expense category</p>
            <p className="text-xs text-gray-500">
              Employees must select a category on each expense line.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={requireCategory}
            onClick={() => {
              setRequireCategory((v) => !v);
              if (requireCategory) setRequireSubcategory(false);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              requireCategory ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              requireCategory ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>

        {/* Require subcategory toggle — only shown when category is required */}
        {requireCategory && (
          <div className="flex items-center justify-between pl-4 border-l-2 border-blue-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Require subcategory</p>
              <p className="text-xs text-gray-500">
                Employees must also select a subcategory.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={requireSubcategory}
              onClick={() => setRequireSubcategory((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                requireSubcategory ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                requireSubcategory ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        )}
      </div>

      {/* Save config button */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save Configuration"}
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600 font-medium">Saved successfully</span>
        )}
      </div>

      {/* ── Section 3: Category Management ────────────────────────────────── */}
      {requireCategory && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Category Management
            </h2>
            <button
              type="button"
              onClick={() => { setShowAddCategory(true); setEditState(null); }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Category
            </button>
          </div>

          {catError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex justify-between">
              <span>{catError}</span>
              <button onClick={() => setCatError(null)} className="text-red-400 font-bold">×</button>
            </div>
          )}

          {/* Add category form */}
          {showAddCategory && (
            <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                New Category
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Travel"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Code <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                    placeholder="e.g. TRV"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {(glMode === "category_mapped") && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      GL Account Suggestion
                    </label>
                    <input
                      type="text"
                      value={newCatGl}
                      onChange={(e) => setNewCatGl(e.target.value)}
                      placeholder="e.g. 670010"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCat || !newCatName.trim()}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
                >
                  {addingCat ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddCategory(false); setNewCatName(""); setNewCatCode(""); setNewCatGl(""); }}
                  className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Category tree */}
          {catLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4 text-center">
              No categories yet. Click &ldquo;+ Add Category&rdquo; to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id}>
                  {/* Category row */}
                  {editState?.id === cat.id ? (
                    <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <input
                          type="text"
                          value={editState.name}
                          onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                          placeholder="Name"
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={editState.code}
                          onChange={(e) => setEditState({ ...editState, code: e.target.value })}
                          placeholder="Code"
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {glMode === "category_mapped" && (
                          <input
                            type="text"
                            value={editState.gl_account_suggestion}
                            onChange={(e) => setEditState({ ...editState, gl_account_suggestion: e.target.value })}
                            placeholder="GL suggestion"
                            className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} disabled={savingEdit}
                          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60">
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setEditState(null)}
                          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="font-medium text-gray-500 text-xs w-4">▼</span>
                      <span className="text-sm font-semibold text-gray-800 flex-1">{cat.name}</span>
                      {cat.code && (
                        <span className="text-xs text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono">
                          {cat.code}
                        </span>
                      )}
                      {glMode === "category_mapped" && cat.gl_account_suggestion && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                          GL: {cat.gl_account_suggestion}
                        </span>
                      )}
                      <div className="flex gap-2 ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditState({
                              id: cat.id,
                              name: cat.name,
                              code: cat.code ?? "",
                              gl_account_suggestion: cat.gl_account_suggestion ?? "",
                            });
                            setShowAddCategory(false);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingSubFor(cat.id);
                            setNewSubName("");
                            setEditState(null);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          + Sub
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(cat.id, cat.name)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Subcategory rows */}
                  <div className="ml-6 mt-1 space-y-1">
                    {cat.subcategories.map((sub) => (
                      editState?.id === sub.id ? (
                        <div key={sub.id} className="p-2 border border-blue-200 bg-blue-50 rounded-lg">
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={editState.name}
                              onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                              placeholder="Name"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleSaveEdit} disabled={savingEdit}
                              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60">
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => setEditState(null)}
                              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={sub.id} className="flex items-center gap-2 px-3 py-1.5 border border-gray-100 rounded-lg bg-white">
                          <span className="text-gray-300 text-xs w-4 shrink-0">├</span>
                          <span className="text-sm text-gray-700 flex-1">{sub.name}</span>
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditState({
                                id: sub.id,
                                name: sub.name,
                                code: sub.code ?? "",
                                gl_account_suggestion: sub.gl_account_suggestion ?? "",
                              })}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(sub.id, sub.name)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )
                    ))}

                    {/* Add subcategory form */}
                    {addingSubFor === cat.id && (
                      <div className="flex gap-2 p-2 border border-blue-100 bg-blue-50 rounded-lg">
                        <input
                          type="text"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          placeholder="Subcategory name"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleAddSubcategory(cat.id)}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSubcategory(cat.id)}
                          disabled={addingSub || !newSubName.trim()}
                          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
                        >
                          {addingSub ? "…" : "Add"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingSubFor(null); setNewSubName(""); }}
                          className="px-3 py-1 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
