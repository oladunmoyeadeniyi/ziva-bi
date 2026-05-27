"use client";

import { useEffect, useState, useCallback } from "react";
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
  value_source: string;
  description?: string;
  icon?: string;
}

interface OrgNode {
  id: string;
  name: string;
  code: string;
  cost_center_code?: string;
  parent_id?: string;
}

interface DimensionValue {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
}

function generateCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

type Tab = "setup" | "values";
type AddStep = "source" | "org" | "employee" | "hybrid" | "manual";
type ValuesSubTab = "employee" | "manual";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  org_structure: "Auto — org structure",
  employee_master: "Auto — employee master",
  hybrid: "Hybrid — auto + manual",
  customer_order: "Manual now · Auto when AR active",
  product_master: "Auto — product master (future)",
};

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-gray-100 text-gray-600",
  org_structure: "bg-green-50 text-green-700",
  employee_master: "bg-blue-50 text-blue-700",
  hybrid: "bg-blue-50 text-blue-700",
  customer_order: "bg-amber-50 text-amber-700",
  product_master: "bg-amber-50 text-amber-700",
};

const DIM_ICONS: Record<string, string> = {
  cost_center: "building-community",
  material: "barcode",
  statistical_order: "git-branch",
  real_order: "git-commit",
  customer_order: "users-group",
};

const HYBRID_SOURCE_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  employee_master: { icon: "users", label: "Employee codes", desc: "Auto-synced from employee master" },
  org_structure: { icon: "building-community", label: "Cost center codes", desc: "Auto-synced from org structure" },
};

export default function DimensionsPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<AddStep>("source");
  const [addSource, setAddSource] = useState<string>("");
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addRequired, setAddRequired] = useState(true);
  const [addDescription, setAddDescription] = useState("");
  const [addingDim, setAddingDim] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Hybrid source selection
  const [hybridSources, setHybridSources] = useState<Set<string>>(new Set(["employee_master"]));

  // Org structure preview for add form
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [orgNodesLoading, setOrgNodesLoading] = useState(false);
  const [selectedOrgNodes, setSelectedOrgNodes] = useState<Set<string>>(new Set());

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editRequired, setEditRequired] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Inline value management
  const [addValueDimId, setAddValueDimId] = useState<string | null>(null);
  const [addValueCode, setAddValueCode] = useState("");
  const [addValueName, setAddValueName] = useState("");
  const [addValueDesc, setAddValueDesc] = useState("");
  const [addingValue, setAddingValue] = useState(false);
  const [addValueError, setAddValueError] = useState<string | null>(null);
  const [dimValues, setDimValues] = useState<Record<string, DimensionValue[]>>({});

  // Values tab
  const [selectedDimForValues, setSelectedDimForValues] = useState<string>("");
  const [valuesSubTab, setValuesSubTab] = useState<ValuesSubTab>("employee");

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      // Seed standard dimensions and fix value_source for legacy rows
      await apiFetch("/api/config/dimensions/seed-standard", {
        method: "POST",
        token: accessToken,
      });
      const data = await apiFetch<Dimension[]>("/api/config/dimensions", {
        token: accessToken,
      });
      setDimensions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dimensions.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) {
      router.replace("/dashboard/business");
    }
  }, [user, router]);

  const loadDimValues = useCallback(async (dimId: string) => {
    if (!accessToken) return;
    try {
      const vals = await apiFetch<DimensionValue[]>(
        `/api/config/dimensions/${dimId}/values`,
        { token: accessToken }
      );
      setDimValues(prev => ({ ...prev, [dimId]: vals }));
    } catch {}
  }, [accessToken]);

  const toggleExpand = (id: string, dim?: Dimension) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (dim && !["org_structure", "employee_master"].includes(dim.value_source ?? "")) {
          loadDimValues(id);
        }
      }
      return next;
    });
  };

  const pickSource = async (src: string) => {
    setAddSource(src);
    if (src === "org_structure") {
      setAddStep("org");
      setOrgNodesLoading(true);
      try {
        const nodes = await apiFetch<OrgNode[]>(
          "/api/config/dimensions/org-structure-preview",
          { token: accessToken! }
        );
        setOrgNodes(nodes);
        setSelectedOrgNodes(new Set(nodes.map(n => n.id)));
      } catch {
        setOrgNodes([]);
      } finally {
        setOrgNodesLoading(false);
      }
    } else if (src === "employee_master") {
      setAddName("Employee");
      setAddCode("employee");
      setAddStep("employee");
    } else if (src === "hybrid") {
      setAddStep("hybrid");
    } else {
      setAddStep("manual");
    }
  };

  const handleAdd = async () => {
    if (!accessToken) return;
    setAddingDim(true);
    setAddError(null);
    try {
      await apiFetch("/api/config/dimensions", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: addName.trim(),
          code: addCode.trim() || generateCode(addName),
          is_required: addRequired,
          value_source: addSource,
          description: addDescription.trim() || (
            addSource === "hybrid"
              ? `hybrid:${Array.from(hybridSources).join(",")}`
              : undefined
          ),
        }),
      });
      setShowAdd(false);
      setAddStep("source");
      setAddSource("");
      setAddName("");
      setAddCode("");
      setAddDescription("");
      setAddError(null);
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
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim(),
          is_required: editRequired,
        }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dimension.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggle = async (dim: Dimension) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/config/dimensions/${dim.id}`, {
        method: "DELETE",
        token: accessToken,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dimension.");
    }
  };

  const activeDims = dimensions.filter(d => d.is_active);

  const handleMoveUp = async (dim: Dimension, index: number) => {
    if (!accessToken || index === 0) return;
    const prevOrder = activeDims[index - 1].sort_order;
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
    if (!accessToken || index === activeDims.length - 1) return;
    const nextOrder = activeDims[index + 1].sort_order;
    try {
      await apiFetch(`/api/config/dimensions/${dim.id}/reorder`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ sort_order: nextOrder + 1 }),
      });
      await load();
    } catch {}
  };

  const handleAddValue = async (dimId: string) => {
    if (!accessToken || !addValueCode.trim() || !addValueName.trim()) return;
    setAddingValue(true);
    setAddValueError(null);
    try {
      await apiFetch(`/api/config/dimensions/${dimId}/values`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          code: addValueCode.trim(),
          name: addValueName.trim(),
          description: addValueDesc.trim() || undefined,
        }),
      });
      setAddValueDimId(null);
      setAddValueCode("");
      setAddValueName("");
      setAddValueDesc("");
      await loadDimValues(dimId);
    } catch (err) {
      setAddValueError(err instanceof Error ? err.message : "Failed to add value.");
    } finally {
      setAddingValue(false);
    }
  };

  const handleDownloadTemplate = async (dimId: string) => {
    if (!accessToken) return;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/config/dimensions/${dimId}/values/template`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dimension_values_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleBulkUpload = async (dimId: string, file: File) => {
    if (!accessToken) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${baseUrl}/api/config/dimensions/${dimId}/values/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      await loadDimValues(dimId);
    } catch {
      setError("Bulk upload failed.");
    }
  };

  return (
    <div className="px-6 py-6 max-w-3xl">

      {/* Back button */}
      <button type="button" onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>

      <h1 className="text-xl font-semibold text-gray-900 mb-1">Financial Dimensions</h1>
      <p className="text-sm text-gray-500 mb-5">
        Define dimensions your organisation uses for analytical coding (e.g. Cost Center, Material, Brand).
      </p>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-5">
        {(["setup", "values"] as Tab[]).map(t => (
          <button key={t} type="button" onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              activeTab === t
                ? "border-blue-600 text-gray-900 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "setup" ? "Dimension setup" : "Master data / values"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* ── SETUP TAB ── */}
      {activeTab === "setup" && (
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <p className="text-xs text-gray-500">Configure dimensions before uploading your Chart of Accounts. Active dimensions appear as columns in the CoA template.</p>
            <button type="button" onClick={() => { setShowAdd(v => !v); setAddStep("source"); setAddSource(""); }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0">
              <i className="ti ti-plus" style={{ fontSize: 13 }} />
              Add dimension
            </button>
          </div>

          {/* Source-first add form */}
          {showAdd && (
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">

              {/* Step 1: Pick source */}
              {addStep === "source" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">New dimension</p>
                  <p className="text-xs text-gray-500 mb-3">Step 1 — Where do the values for this dimension come from?</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { src: "org_structure", icon: "building-community", label: "Org structure", desc: "Auto-sync cost centers from your org tree" },
                      { src: "employee_master", icon: "users", label: "Employee master", desc: "Auto-sync all active employee codes" },
                      { src: "hybrid", icon: "git-branch", label: "Hybrid", desc: "One or more auto-sources + manual codes" },
                      { src: "manual", icon: "pencil", label: "Manual", desc: "Enter values manually or upload in bulk" },
                    ].map(opt => (
                      <button key={opt.src} type="button" onClick={() => pickSource(opt.src)}
                        className={`text-left p-3 border rounded-lg transition-colors hover:border-blue-400 ${
                          addSource === opt.src ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                        }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <i className={`ti ti-${opt.icon} text-blue-500`} style={{ fontSize: 14 }} />
                          <span className="text-xs font-medium text-gray-900">{opt.label}</span>
                        </div>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowAdd(false)}
                    className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              )}

              {/* Step 2: Org structure */}
              {addStep === "org" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Org structure dimension</p>
                  <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md mb-3">
                    <i className="ti ti-refresh text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                    <p className="text-xs text-blue-700">Values will auto-sync from Organisation → Structure. Select which data to use.</p>
                  </div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Step 2 — Select data source:</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => { setAddName("Cost center"); setAddCode("cost_center"); }}>
                      <input type="radio" name="org-type" checked={addName === "Cost center"} readOnly className="accent-blue-600" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">Cost centers</p>
                        <p className="text-xs text-gray-500">All cost center nodes from your org tree</p>
                      </div>
                    </div>
                  </div>

                  {addName === "Cost center" && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">Step 3 — Uncheck any cost centers to exclude:</p>
                      {orgNodesLoading ? (
                        <div className="h-24 bg-gray-100 rounded animate-pulse" />
                      ) : orgNodes.length === 0 ? (
                        <p className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded-lg">No cost centers found. Add cost centers in Organisation → Structure first.</p>
                      ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          {orgNodes.map(node => (
                            <label key={node.id}
                              className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                              <input type="checkbox"
                                checked={selectedOrgNodes.has(node.id)}
                                onChange={e => {
                                  setSelectedOrgNodes(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(node.id);
                                    else next.delete(node.id);
                                    return next;
                                  });
                                }}
                                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {node.cost_center_code || node.code}
                              </span>
                              <span className="text-xs text-gray-800">{node.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{selectedOrgNodes.size} of {orgNodes.length} selected</p>
                    </div>
                  )}

                  {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddStep("source")}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">← Back</button>
                    <button type="button" onClick={handleAdd} disabled={addingDim || !addName}
                      className="text-xs px-4 py-1.5 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {addingDim ? "Saving…" : "Save dimension"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Employee master */}
              {addStep === "employee" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Employee master dimension</p>
                  <div className="flex items-start gap-2 p-2.5 bg-green-50 rounded-md mb-3">
                    <i className="ti ti-check text-green-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                    <p className="text-xs text-green-700">All active employee codes will be added automatically. New employees are added automatically. Deactivated employees are archived.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dimension name</label>
                      <input type="text" value={addName}
                        onChange={e => { setAddName(e.target.value); setAddCode(generateCode(e.target.value)); }}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
                      <input type="text" value={addCode} onChange={e => setAddCode(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddStep("source")}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">← Back</button>
                    <button type="button" onClick={handleAdd} disabled={addingDim || !addName.trim()}
                      className="text-xs px-4 py-1.5 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {addingDim ? "Saving…" : "Save dimension"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Hybrid — user picks which auto-sources to combine */}
              {addStep === "hybrid" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Hybrid dimension</p>
                  <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md mb-3">
                    <i className="ti ti-git-branch text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                    <p className="text-xs text-blue-700">
                      Hybrid combines one or more auto-synced sources with manually added codes. Manual codes are always included.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Step 2 — Which auto-sources should this dimension include?</p>
                  <div className="space-y-2 mb-3">
                    {[
                      { key: "employee_master", icon: "users", label: "Employee master", desc: "All active employee codes — auto-synced" },
                      { key: "org_structure", icon: "building-community", label: "Org structure", desc: "Cost center nodes — auto-synced from org tree" },
                    ].map(opt => (
                      <label key={opt.key}
                        className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0"
                          checked={hybridSources.has(opt.key)}
                          onChange={e => {
                            setHybridSources(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(opt.key);
                              else next.delete(opt.key);
                              return next;
                            });
                          }} />
                        <i className={`ti ti-${opt.icon} text-blue-500`} style={{ fontSize: 14 }} />
                        <div>
                          <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                    <div className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg bg-gray-50 opacity-60">
                      <input type="checkbox" checked disabled className="w-3.5 h-3.5 flex-shrink-0" />
                      <i className="ti ti-pencil text-gray-400" style={{ fontSize: 14 }} />
                      <div>
                        <p className="text-xs font-medium text-gray-600">Manual codes</p>
                        <p className="text-xs text-gray-400">Always included — add campaigns, vehicles, assets etc.</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dimension name *</label>
                      <input type="text" value={addName}
                        onChange={e => { setAddName(e.target.value); setAddCode(generateCode(e.target.value)); }}
                        placeholder="e.g. Statistical internal order"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                      <input type="text" value={addCode} onChange={e => setAddCode(e.target.value)}
                        placeholder="e.g. statistical_order"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddStep("source")}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">← Back</button>
                    <button type="button" onClick={handleAdd}
                      disabled={addingDim || !addName.trim() || hybridSources.size === 0}
                      className="text-xs px-4 py-1.5 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {addingDim ? "Saving…" : "Save dimension"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Manual */}
              {addStep === "manual" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Manual dimension</p>
                  <div className="flex items-start gap-2 p-2.5 bg-gray-100 rounded-md mb-3">
                    <i className="ti ti-pencil text-gray-500 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                    <p className="text-xs text-gray-600">Values entered manually or uploaded in bulk. Add values after saving the dimension.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                      <input type="text" value={addName}
                        onChange={e => { setAddName(e.target.value); setAddCode(generateCode(e.target.value)); }}
                        placeholder="e.g. Customer order, Brand, Region"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                      <input type="text" value={addCode} onChange={e => setAddCode(e.target.value)}
                        placeholder="auto-generated"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Default requirement</label>
                      <select value={addRequired ? "required" : "optional"}
                        onChange={e => setAddRequired(e.target.value === "required")}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="required">Required where applicable</option>
                        <option value="optional">Optional</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">GL-level override set on Chart of Accounts.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                      <input type="text" value={addDescription}
                        onChange={e => setAddDescription(e.target.value)}
                        placeholder="What does this dimension represent?"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddStep("source")}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">← Back</button>
                    <button type="button" onClick={handleAdd} disabled={addingDim || !addName.trim()}
                      className="text-xs px-4 py-1.5 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {addingDim ? "Saving…" : "Save dimension"}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Dimension cards */}
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : activeDims.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <i className="ti ti-vector text-gray-300" style={{ fontSize: 32 }} />
              <p className="text-sm font-medium text-gray-600 mt-2 mb-1">No dimensions configured</p>
              <p className="text-xs text-gray-400">Add dimensions to enable analytical coding on transactions.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeDims.map((dim, idx) => {
                const isExpanded = expandedIds.has(dim.id);
                const iconName = DIM_ICONS[dim.code] ?? "vector";
                const isHybrid = dim.value_source === "hybrid";
                const isOrgAuto = dim.value_source === "org_structure";
                const isEmpAuto = dim.value_source === "employee_master";

                // Parse hybrid sources from description field
                const hybridDesc = dim.description ?? "";
                const parsedHybridSources = isHybrid && hybridDesc.startsWith("hybrid:")
                  ? hybridDesc.replace("hybrid:", "").split(",")
                  : isHybrid ? ["employee_master"] : [];

                // Description to show in card header (suppress hybrid: encoding)
                const displayDesc = dim.description && !dim.description.startsWith("hybrid:")
                  ? dim.description
                  : null;

                return (
                  <div key={dim.id}
                    className={`border rounded-xl overflow-hidden ${
                      dim.is_active ? "border-blue-300 bg-white" : "border-gray-200 bg-gray-50 opacity-60"
                    }`}>

                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleExpand(dim.id, dim)}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        dim.is_active ? "bg-blue-50" : "bg-gray-100"
                      }`}>
                        <i className={`ti ti-${iconName}`}
                          style={{ fontSize: 15, color: dim.is_active ? "#378ADD" : "#9CA3AF" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{dim.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            SOURCE_COLORS[dim.value_source ?? "manual"]
                          }`}>
                            {SOURCE_LABELS[dim.value_source ?? "manual"]}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            dim.is_required ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
                          }`}>
                            {dim.is_required ? "Required" : "Optional"}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {dim.code}
                          </span>
                        </div>
                        {displayDesc && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{displayDesc}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="relative w-8 h-4 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                          aria-label={`Toggle ${dim.name}`}>
                          <input type="checkbox" className="sr-only" checked={dim.is_active}
                            onChange={() => handleToggle(dim)} />
                          <span className={`absolute inset-0 rounded-full transition-colors ${
                            dim.is_active ? "bg-blue-500" : "bg-gray-300"
                          }`} />
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                            dim.is_active ? "translate-x-4" : ""
                          }`} />
                        </label>
                        <i className={`ti ti-chevron-${isExpanded ? "down" : "right"} text-gray-400`}
                          style={{ fontSize: 13 }} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-100">

                        {isOrgAuto && (
                          <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md mt-3 mb-2">
                            <i className="ti ti-refresh text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                            <p className="text-xs text-blue-700">Values auto-synced from <strong className="font-medium">Organisation → Structure</strong>. Edit cost centers there.</p>
                          </div>
                        )}

                        {isEmpAuto && (
                          <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md mt-3 mb-2">
                            <i className="ti ti-refresh text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                            <p className="text-xs text-blue-700">Values auto-synced from the employee master. Manage employees on the Employees page.</p>
                          </div>
                        )}

                        {isHybrid && (
                          <div className="mt-3 mb-2 space-y-1.5">
                            {parsedHybridSources.map(src => {
                              const info = HYBRID_SOURCE_INFO[src];
                              if (!info) return null;
                              return (
                                <div key={src} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                  <i className={`ti ti-${info.icon} text-blue-600`} style={{ fontSize: 13 }} />
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-900">{info.label} — auto-synced</p>
                                    <p className="text-xs text-gray-500">{info.desc}</p>
                                  </div>
                                  <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">Live</span>
                                </div>
                              );
                            })}
                            <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
                              <i className="ti ti-pencil text-gray-500" style={{ fontSize: 13 }} />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-900">Manual codes — campaigns, vehicles, assets etc.</p>
                              </div>
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">Manual</span>
                            </div>
                          </div>
                        )}

                        {dim.value_source === "customer_order" && (
                          <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-md mt-3 mb-2">
                            <i className="ti ti-alert-triangle text-amber-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                            <p className="text-xs text-amber-700">Customer categories managed manually until the <strong className="font-medium">Accounts Receivable</strong> module is active, when they will auto-sync from the customer master.</p>
                          </div>
                        )}

                        {(!isOrgAuto && !isEmpAuto) && (
                          <div className="mt-3 mb-2">
                            {/* Values list */}
                            {dimValues[dim.id] && dimValues[dim.id].length > 0 && (
                              <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Code</th>
                                      <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Name</th>
                                      <th className="px-3 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {dimValues[dim.id].map(val => (
                                      <tr key={val.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 font-mono text-gray-600">{val.code}</td>
                                        <td className="px-3 py-2 text-gray-800">{val.name}</td>
                                        <td className="px-3 py-2 text-right">
                                          <button type="button" className="text-red-400 hover:text-red-600">
                                            <i className="ti ti-x" style={{ fontSize: 12 }} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Add value inline form */}
                            {addValueDimId === dim.id ? (
                              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <input type="text" value={addValueCode}
                                    onChange={e => setAddValueCode(e.target.value)}
                                    placeholder="Code *"
                                    className="px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                  <input type="text" value={addValueName}
                                    onChange={e => setAddValueName(e.target.value)}
                                    placeholder="Name *"
                                    className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </div>
                                <input type="text" value={addValueDesc}
                                  onChange={e => setAddValueDesc(e.target.value)}
                                  placeholder="Description (optional)"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2" />
                                {addValueError && <p className="text-xs text-red-600 mb-1">{addValueError}</p>}
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleAddValue(dim.id)}
                                    disabled={addingValue || !addValueCode.trim() || !addValueName.trim()}
                                    className="text-xs px-3 py-1 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                                    {addingValue ? "Adding…" : "Add"}
                                  </button>
                                  <button type="button"
                                    onClick={() => { setAddValueDimId(null); setAddValueError(null); }}
                                    className="text-xs px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button type="button"
                                  onClick={() => { setAddValueDimId(dim.id); loadDimValues(dim.id); }}
                                  className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50">
                                  + Add value
                                </button>
                                <button type="button" onClick={() => handleDownloadTemplate(dim.id)}
                                  className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1">
                                  <i className="ti ti-download" style={{ fontSize: 11 }} /> Template
                                </button>
                                <label className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 cursor-pointer">
                                  <i className="ti ti-upload" style={{ fontSize: 11 }} /> Upload
                                  <input type="file" accept=".xlsx,.csv" className="hidden"
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleBulkUpload(dim.id, file);
                                      e.target.value = "";
                                    }} />
                                </label>
                              </div>
                            )}
                          </div>
                        )}

                        {editId === dim.id ? (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              <input type="text" value={editCode} onChange={e => setEditCode(e.target.value)}
                                className="px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-700 mb-2">
                              <input type="checkbox" checked={editRequired}
                                onChange={e => setEditRequired(e.target.checked)} className="accent-blue-600" />
                              Required by default
                            </label>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleEdit(dim.id)} disabled={savingEdit}
                                className="text-xs text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-60">
                                {savingEdit ? "Saving…" : "Save"}
                              </button>
                              <button type="button" onClick={() => setEditId(null)}
                                className="text-xs text-gray-700 bg-gray-100 px-3 py-1 rounded hover:bg-gray-200">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setEditId(dim.id); setEditName(dim.name); setEditCode(dim.code); setEditRequired(dim.is_required); }}
                              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
                              <i className="ti ti-edit" style={{ fontSize: 12 }} /> Edit
                            </button>
                            <button type="button"
                              onClick={() => { setActiveTab("values"); setSelectedDimForValues(dim.id); }}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                              <i className="ti ti-list" style={{ fontSize: 12 }} /> View values
                            </button>
                            <div className="flex items-center gap-1 ml-auto text-xs text-gray-400">
                              <button type="button" onClick={() => handleMoveUp(dim, idx)} disabled={idx === 0}
                                className="p-0.5 hover:text-gray-700 disabled:opacity-30">
                                <i className="ti ti-arrow-up" style={{ fontSize: 12 }} />
                              </button>
                              <button type="button" onClick={() => handleMoveDown(dim, idx)}
                                disabled={idx === activeDims.length - 1}
                                className="p-0.5 hover:text-gray-700 disabled:opacity-30">
                                <i className="ti ti-arrow-down" style={{ fontSize: 12 }} />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-2 p-2 bg-gray-50 rounded mt-3 border border-gray-100">
                          <i className="ti ti-table text-gray-400 flex-shrink-0 mt-0.5" style={{ fontSize: 12 }} />
                          <p className="text-[11px] text-gray-500">
                            GL-level applicability configured on the{" "}
                            <strong className="font-medium">Chart of Accounts</strong> page.
                            {(dim.code === "statistical_order" || dim.code === "real_order" || dim.code === "customer_order") &&
                              " A GL account can accept any combination of order types — configured per account on CoA."}
                          </p>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-2">
            <i className="ti ti-info-circle text-gray-400 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
            <p className="text-xs text-gray-500">
              A GL account can accept any combination of order types (Real, Statistical, Customer) — configured per account on the{" "}
              <strong className="font-medium">Chart of Accounts</strong> page.
            </p>
          </div>
        </div>
      )}

      {/* ── VALUES TAB ── */}
      {activeTab === "values" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-600">Dimension:</label>
            <select value={selectedDimForValues}
              onChange={e => { setSelectedDimForValues(e.target.value); setValuesSubTab("employee"); }}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 max-w-xs">
              <option value="">— Select dimension —</option>
              {activeDims.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {!selectedDimForValues ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <i className="ti ti-table text-gray-300" style={{ fontSize: 32 }} />
              <p className="text-sm text-gray-500 mt-2">Select a dimension above to manage its values.</p>
            </div>
          ) : (() => {
            const dim = activeDims.find(d => d.id === selectedDimForValues);
            if (!dim) return null;

            if (dim.value_source === "org_structure") {
              return (
                <div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-4">
                    <i className="ti ti-refresh text-blue-600 flex-shrink-0" style={{ fontSize: 13 }} />
                    <p className="text-xs text-blue-700">Read-only — values auto-synced from Organisation → Structure.</p>
                  </div>
                  <Link href="/dashboard/business/setup/organisation"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
                    Go to Organisation → Structure
                  </Link>
                </div>
              );
            }

            if (dim.value_source === "hybrid") {
              return (
                <div>
                  <div className="flex gap-0 border-b border-gray-200 mb-4">
                    {(["employee", "manual"] as const).map(st => (
                      <button key={st} type="button" onClick={() => setValuesSubTab(st)}
                        className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                          valuesSubTab === st
                            ? "border-blue-600 text-gray-900 font-medium"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}>
                        {st === "employee" ? "Auto-synced codes" : "Manual codes"}
                      </button>
                    ))}
                  </div>
                  {valuesSubTab === "employee" && (
                    <div>
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-3">
                        <i className="ti ti-refresh text-blue-600 flex-shrink-0" style={{ fontSize: 13 }} />
                        <p className="text-xs text-blue-700">Auto-synced from configured sources. Manage employees on the Employees page.</p>
                      </div>
                      <Link href="/dashboard/business/settings/employees"
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
                        Go to Employees
                      </Link>
                    </div>
                  )}
                  {valuesSubTab === "manual" && (
                    <div>
                      <div className="flex gap-2 mb-3">
                        <button type="button"
                          onClick={() => { setAddValueDimId(dim.id); loadDimValues(dim.id); }}
                          className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50">+ Add code</button>
                        <button type="button" onClick={() => handleDownloadTemplate(dim.id)}
                          className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1">
                          <i className="ti ti-download" style={{ fontSize: 11 }} /> Template
                        </button>
                        <label className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 cursor-pointer">
                          <i className="ti ti-upload" style={{ fontSize: 11 }} /> Upload
                          <input type="file" accept=".xlsx,.csv" className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleBulkUpload(dim.id, file);
                              e.target.value = "";
                            }} />
                        </label>
                      </div>
                      {addValueDimId === dim.id && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-3">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <input type="text" value={addValueCode}
                              onChange={e => setAddValueCode(e.target.value)}
                              placeholder="Code *"
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            <input type="text" value={addValueName}
                              onChange={e => setAddValueName(e.target.value)}
                              placeholder="Name *"
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          {addValueError && <p className="text-xs text-red-600 mb-1">{addValueError}</p>}
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleAddValue(dim.id)}
                              disabled={addingValue || !addValueCode.trim() || !addValueName.trim()}
                              className="text-xs px-3 py-1 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                              {addingValue ? "Adding…" : "Add"}
                            </button>
                            <button type="button"
                              onClick={() => { setAddValueDimId(null); setAddValueError(null); }}
                              className="text-xs px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {dimValues[dim.id] && dimValues[dim.id].length > 0 ? (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Code</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Name</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {dimValues[dim.id].map(val => (
                                <tr key={val.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-gray-600">{val.code}</td>
                                  <td className="px-3 py-2 text-gray-800">{val.name}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No manual codes yet. Add non-employee codes like campaigns, vehicles, hubs, funds.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div>
                <div className="flex gap-2 mb-3">
                  <button type="button"
                    onClick={() => { setAddValueDimId(dim.id); loadDimValues(dim.id); }}
                    className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50">+ Add value</button>
                  <button type="button" onClick={() => handleDownloadTemplate(dim.id)}
                    className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1">
                    <i className="ti ti-download" style={{ fontSize: 11 }} /> Download template
                  </button>
                  <label className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 cursor-pointer">
                    <i className="ti ti-upload" style={{ fontSize: 11 }} /> Bulk upload
                    <input type="file" accept=".xlsx,.csv" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleBulkUpload(dim.id, file);
                        e.target.value = "";
                      }} />
                  </label>
                </div>
                {addValueDimId === dim.id && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-3">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input type="text" value={addValueCode}
                        onChange={e => setAddValueCode(e.target.value)}
                        placeholder="Code *"
                        className="px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="text" value={addValueName}
                        onChange={e => setAddValueName(e.target.value)}
                        placeholder="Name *"
                        className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <input type="text" value={addValueDesc}
                      onChange={e => setAddValueDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2" />
                    {addValueError && <p className="text-xs text-red-600 mb-1">{addValueError}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleAddValue(dim.id)}
                        disabled={addingValue || !addValueCode.trim() || !addValueName.trim()}
                        className="text-xs px-3 py-1 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                        {addingValue ? "Adding…" : "Add"}
                      </button>
                      <button type="button"
                        onClick={() => { setAddValueDimId(null); setAddValueError(null); }}
                        className="text-xs px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {dimValues[dim.id] && dimValues[dim.id].length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Code</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dimValues[dim.id].map(val => (
                          <tr key={val.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-gray-600">{val.code}</td>
                            <td className="px-3 py-2 text-gray-800">{val.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No values configured yet for {dim.name}.</p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
