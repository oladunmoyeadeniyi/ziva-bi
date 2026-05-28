"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface DimensionSource {
  source_type: string;
  filter?: { parent_code?: string } | null;
}

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
  display_name?: string;
  dimension_sources?: DimensionSource[];
}

interface InlineValue {
  id: string;
  code: string;
  name: string;
  source: string;
  editable: boolean;
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
type AddStep = "name" | "sources" | "review";
type ValuesSubTab = string;

const STANDARD_CODES = new Set([
  "cost_center", "material", "statistical_order", "statistical_internal_order",
  "real_order", "real_internal_order", "customer_order", "employee",
  "brand", "region", "channel", "project", "trading_partner",
]);

const STANDARD_OPTIONS = [
  { value: "material",  icon: "barcode",        name: "Material / Product (SKU)", code: "material",               desc: "Tag transactions with product or SKU codes.",          sources: [{ source_type: "product_master", filter: null }] },
  { value: "brand",     icon: "award",           name: "Brand",                    code: "brand",                  desc: "Tag costs and revenues by brand.",                     sources: [] },
  { value: "region",    icon: "map-pin",         name: "Region / Geography",       code: "region",                 desc: "Tag costs by geographical region or zone.",            sources: [] },
  { value: "channel",   icon: "arrows-split",    name: "Sales channel",            code: "channel",                desc: "Track revenue and costs by sales channel.",            sources: [{ source_type: "org_structure", filter: null }] },
  { value: "project",   icon: "clipboard-list",  name: "Project",                  code: "project",                desc: "Track costs by project or initiative.",                sources: [] },
  { value: "employee",  icon: "users",           name: "Employee",                 code: "employee",               desc: "Tag transactions by employee.",                        sources: [{ source_type: "employee_master", filter: null }] },
];

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  org_structure: "Org structure",
  employee_master: "Employee master",
  hybrid: "Hybrid — auto + manual",
  customer_order: "Manual now · Auto when AR active",
  product_master: "Auto — product master (future)",
  customer_master: "Customer master (future)",
  group_structure: "Group structure (future)",
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
  statistical_internal_order: "git-branch",
  real_order: "git-commit",
  real_internal_order: "git-commit",
  customer_order: "users-group",
};

export default function DimensionsPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Add form state — 3-step flow
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<AddStep>("name");
  const [addStdValue, setAddStdValue] = useState<string>("");
  const [addCustomName, setAddCustomName] = useState<string>("");
  const [addCode, setAddCode] = useState<string>("");
  const [addDescription, setAddDescription] = useState<string>("");
  const [addRequired, setAddRequired] = useState<boolean>(true);
  const [addSources, setAddSources] = useState<DimensionSource[]>([]);
  const [addOrgFilter, setAddOrgFilter] = useState<string>("");
  const [addingDim, setAddingDim] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Org structure preview nodes for source scope filter
  const [orgPreviewNodes, setOrgPreviewNodes] = useState<OrgNode[]>([]);

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
  const [valuesSubTab, setValuesSubTab] = useState<ValuesSubTab>("manual");

  // Inline values (merged auto + manual per dimension)
  const [inlineValues, setInlineValues] = useState<Record<string, InlineValue[]>>({});
  const [inlineValuesLoading, setInlineValuesLoading] = useState<Record<string, boolean>>({});

  // Deactivated section collapsed by default
  const [deactivatedExpanded, setDeactivatedExpanded] = useState(false);

  // Edit display name
  const [editDisplayName, setEditDisplayName] = useState("");

  // Delete confirmation modal
  const [deleteConfirmDim, setDeleteConfirmDim] = useState<Dimension | null>(null);
  const [deletingDim, setDeletingDim] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
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

  const loadInlineValues = async (dimId: string) => {
    if (!accessToken) return;
    setInlineValuesLoading(prev => ({ ...prev, [dimId]: true }));
    try {
      const vals = await apiFetch<InlineValue[]>(
        `/api/config/dimensions/${dimId}/inline-values`,
        { token: accessToken }
      );
      setInlineValues(prev => ({ ...prev, [dimId]: vals }));
    } catch {
      setInlineValues(prev => ({ ...prev, [dimId]: [] }));
    } finally {
      setInlineValuesLoading(prev => ({ ...prev, [dimId]: false }));
    }
  };

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

  const handleAdd = async () => {
    if (!accessToken) return;
    setAddingDim(true);
    setAddError(null);
    try {
      const name = addStdValue === "__custom__"
        ? addCustomName.trim()
        : STANDARD_OPTIONS.find(o => o.value === addStdValue)?.name ?? addCustomName.trim();

      const sources = addSources.map(s =>
        s.source_type === "org_structure" && addOrgFilter
          ? { ...s, filter: { parent_code: addOrgFilter } }
          : s
      );

      const valueSource = sources.length === 0
        ? "manual"
        : sources.length === 1
          ? sources[0].source_type
          : "hybrid";

      await apiFetch("/api/config/dimensions", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name,
          code: addCode.trim() || generateCode(name),
          is_required: addRequired,
          value_source: valueSource,
          dimension_sources: sources,
          description: addDescription.trim() || undefined,
        }),
      });
      setShowAdd(false);
      setAddStep("name");
      setAddStdValue("");
      setAddCustomName("");
      setAddCode("");
      setAddSources([]);
      setAddOrgFilter("");
      setAddDescription("");
      setAddError(null);
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create dimension.");
      setAddStep("review");
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
          display_name: editDisplayName.trim() || null,
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
      if (dim.is_active) {
        await apiFetch(`/api/config/dimensions/${dim.id}`, {
          method: "DELETE",
          token: accessToken,
        });
      } else {
        await apiFetch(`/api/config/dimensions/${dim.id}/reactivate`, {
          method: "PATCH",
          token: accessToken,
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dimension.");
    }
  };

  const handleHardDelete = (dim: Dimension) => {
    setDeleteConfirmDim(dim);
  };

  const confirmHardDelete = async () => {
    if (!accessToken || !deleteConfirmDim) return;
    setDeletingDim(true);
    try {
      await apiFetch(`/api/config/dimensions/${deleteConfirmDim.id}/permanent`, {
        method: "DELETE",
        token: accessToken,
      });
      setDeleteConfirmDim(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dimension.");
      setDeleteConfirmDim(null);
    } finally {
      setDeletingDim(false);
    }
  };

  const activeDims = dimensions.filter(d => d.is_active);
  const inactiveDims = dimensions.filter(d => !d.is_active);

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
      await loadInlineValues(dimId);
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
            <button type="button"
              onClick={() => {
                setShowAdd(v => !v);
                setAddStep("name");
                setAddStdValue("");
                setAddCustomName("");
                setAddCode("");
                setAddSources([]);
                setAddOrgFilter("");
                setAddDescription("");
                setAddError(null);
              }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0">
              <i className="ti ti-plus" style={{ fontSize: 13 }} />
              Add dimension
            </button>
          </div>

          {/* 3-step add form */}
          {showAdd && (
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">

              {/* Step 1: Name */}
              {addStep === "name" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">New dimension</p>
                  <p className="text-xs text-gray-500 mb-3">Step 1 — What dimension do you want to configure?</p>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Dimension name *</label>
                    <select value={addStdValue}
                      onChange={e => {
                        setAddStdValue(e.target.value);
                        if (e.target.value && e.target.value !== "__custom__") {
                          const opt = STANDARD_OPTIONS.find(o => o.value === e.target.value);
                          if (opt) {
                            setAddCode(opt.code);
                            setAddSources(opt.sources as DimensionSource[]);
                          }
                        } else {
                          setAddCode("");
                          setAddSources([]);
                        }
                      }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Select a dimension —</option>
                      <optgroup label="Standard dimensions">
                        {STANDARD_OPTIONS
                          .filter(o => !dimensions.some(d => d.code === o.code))
                          .map(o => (
                            <option key={o.value} value={o.value}>{o.name}</option>
                          ))}
                      </optgroup>
                      <option value="__custom__">Not on list — enter custom name</option>
                    </select>
                    {addStdValue && addStdValue !== "__custom__" && (
                      <p className="text-xs text-gray-400 mt-1">
                        {STANDARD_OPTIONS.find(o => o.value === addStdValue)?.desc}
                      </p>
                    )}
                  </div>
                  {addStdValue === "__custom__" && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Custom name *</label>
                      <input type="text" value={addCustomName}
                        onChange={e => { setAddCustomName(e.target.value); setAddCode(generateCode(e.target.value)); }}
                        placeholder="e.g. Territory, Fund, Vehicle fleet"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  )}
                  {addStdValue && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
                      <input type="text" value={addCode} onChange={e => setAddCode(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowAdd(false); setAddStdValue(""); setAddStep("name"); }}
                      className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    <button type="button" onClick={() => setAddStep("sources")}
                      disabled={!addStdValue || (addStdValue === "__custom__" && !addCustomName.trim())}
                      className="text-xs px-4 py-1.5 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      Next — configure sources →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Sources */}
              {addStep === "sources" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Connected sources</p>
                  <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md mb-3">
                    <i className="ti ti-plug-connected text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                    <p className="text-xs text-blue-700">Select which system sources this dimension should draw values from. Manual values are always available on every dimension.</p>
                  </div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Step 2 — Connected sources (select all that apply)</p>
                  <div className="space-y-2 mb-3">
                    {[
                      { key: "org_structure",   icon: "building-community", label: "Org structure",   desc: "Cost center nodes from your organisation tree.", available: true },
                      { key: "employee_master", icon: "users",              label: "Employee master", desc: "All active employee codes, auto-synced.",         available: true },
                      { key: "product_master",  icon: "barcode",            label: "Product master",  desc: "SKU and product codes (available when Inventory active).", available: false },
                      { key: "customer_master", icon: "users-group",        label: "Customer master", desc: "Customer category codes (available when AR active).",       available: false },
                    ].map(opt => {
                      const isSelected = addSources.some(s => s.source_type === opt.key);
                      return (
                        <div key={opt.key}>
                          <label className={`flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                          }`}>
                            <input type="checkbox" className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                              checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) {
                                  setAddSources(prev => [...prev, { source_type: opt.key, filter: null }]);
                                  if (opt.key === "org_structure" && orgPreviewNodes.length === 0) {
                                    apiFetch<OrgNode[]>("/api/config/dimensions/org-structure-preview", {
                                      token: accessToken!,
                                    }).then(nodes => setOrgPreviewNodes(nodes)).catch(() => {});
                                  }
                                } else {
                                  setAddSources(prev => prev.filter(s => s.source_type !== opt.key));
                                  if (opt.key === "org_structure") setAddOrgFilter("");
                                }
                              }} />
                            <i className={`ti ti-${opt.icon} ${isSelected ? "text-blue-500" : "text-gray-400"}`} style={{ fontSize: 14 }} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  opt.available ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                                }`}>{opt.available ? "Available now" : "Future"}</span>
                              </div>
                              <p className="text-xs text-gray-500">{opt.desc}</p>
                            </div>
                          </label>
                          {opt.key === "org_structure" && isSelected && (
                            <div className="ml-6 mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-md">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Scope to (optional)</label>
                              <select value={addOrgFilter} onChange={e => setAddOrgFilter(e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">All cost centers</option>
                                {orgPreviewNodes
                                  .filter(n => n.cost_center_code)
                                  .map(n => (
                                    <option key={n.code} value={n.code}>
                                      Children of: {n.name} ({n.cost_center_code || n.code})
                                    </option>
                                  ))
                                }
                              </select>
                              <p className="text-xs text-gray-400 mt-1">e.g. &quot;Children of Sales&quot; gives Off Premise and On Premise — useful for a Sales channel dimension.</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-start gap-3 p-2.5 border border-dashed border-gray-300 rounded-lg opacity-60">
                      <input type="checkbox" checked disabled className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <i className="ti ti-pencil text-gray-400" style={{ fontSize: 14 }} />
                      <div>
                        <p className="text-xs font-medium text-gray-600">Manual values</p>
                        <p className="text-xs text-gray-400">Always available — add codes that aren&apos;t in any system source.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddStep("name")}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">← Back</button>
                    <button type="button" onClick={() => setAddStep("review")}
                      className="text-xs px-4 py-1.5 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                      Next — review →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {addStep === "review" && (
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-3">Review & save</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                    <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-800">
                        {addStdValue === "__custom__" ? addCustomName : STANDARD_OPTIONS.find(o => o.value === addStdValue)?.name}
                        <span className="font-mono font-normal text-gray-400 ml-2 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{addCode}</span>
                      </p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-xs text-gray-500 mb-1.5">Connected sources:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {addSources.length === 0 ? (
                          <span className="text-xs text-gray-400">None — manual only</span>
                        ) : addSources.map(s => (
                          <span key={s.source_type} className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700">
                            {SOURCE_LABELS[s.source_type] ?? s.source_type}
                            {s.source_type === "org_structure" && addOrgFilter ? ` (scoped to ${addOrgFilter})` : ""}
                          </span>
                        ))}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">Manual (always)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Default requirement</label>
                    <select value={addRequired ? "required" : "optional"}
                      onChange={e => setAddRequired(e.target.value === "required")}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="required">Required where applicable</option>
                      <option value="optional">Optional</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">GL-level override set on Chart of Accounts.</p>
                  </div>
                  {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddStep("sources")}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">← Back</button>
                    <button type="button" onClick={handleAdd} disabled={addingDim}
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
                const sources = dim.dimension_sources ?? [];
                const isOrgAuto = sources.some(s => s.source_type === "org_structure");
                const isEmpAuto = sources.some(s => s.source_type === "employee_master");
                const isHybrid = sources.length > 1 || (sources.length === 1 && dim.value_source === "hybrid");

                const displayDesc = dim.description && !dim.description.startsWith("hybrid:")
                  ? dim.description
                  : null;

                return (
                  <div key={dim.id}
                    className="border rounded-xl overflow-hidden border-blue-300 bg-white">

                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleExpand(dim.id, dim)}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-50">
                        <i className={`ti ti-${iconName}`}
                          style={{ fontSize: 15, color: "#378ADD" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">
                            {dim.display_name || dim.name}
                            {dim.display_name && dim.display_name !== dim.name && (
                              <span className="text-xs font-normal text-gray-400 ml-1.5">({dim.name})</span>
                            )}
                          </p>
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
                          <span className="absolute inset-0 rounded-full transition-colors bg-blue-500" />
                          <span className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform translate-x-4" />
                        </label>
                        <i className={`ti ti-chevron-${isExpanded ? "down" : "right"} text-gray-400`}
                          style={{ fontSize: 13 }} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-100">

                        {isOrgAuto && !isHybrid && (
                          <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md mt-3 mb-2">
                            <i className="ti ti-refresh text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                            <p className="text-xs text-blue-700">Values auto-synced from <strong className="font-medium">Organisation → Structure</strong>. Edit cost centers there.</p>
                          </div>
                        )}

                        {isEmpAuto && !isHybrid && !isOrgAuto && (
                          <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md mt-3 mb-2">
                            <i className="ti ti-refresh text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                            <p className="text-xs text-blue-700">Values auto-synced from the employee master. Manage employees on the Employees page.</p>
                          </div>
                        )}

                        {sources.length > 0 && (isHybrid || (sources.length === 1 && !isOrgAuto && !isEmpAuto)) && (
                          <div className="mt-3 mb-2 space-y-1.5">
                            {sources.map(src => (
                              <div key={src.source_type} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                <i className="ti ti-refresh text-blue-600" style={{ fontSize: 13 }} />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-900">{SOURCE_LABELS[src.source_type] ?? src.source_type} — auto-synced</p>
                                </div>
                                <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">Live</span>
                              </div>
                            ))}
                            {isHybrid && (
                              <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
                                <i className="ti ti-pencil text-gray-500" style={{ fontSize: 13 }} />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-900">Manual codes — campaigns, vehicles, assets etc.</p>
                                </div>
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">Manual</span>
                              </div>
                            )}
                          </div>
                        )}

                        {dim.value_source === "customer_order" && (
                          <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-md mt-3 mb-2">
                            <i className="ti ti-alert-triangle text-amber-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                            <p className="text-xs text-amber-700">Customer categories managed manually until the <strong className="font-medium">Accounts Receivable</strong> module is active, when they will auto-sync from the customer master.</p>
                          </div>
                        )}

                        {(!isOrgAuto || isHybrid) && (!isEmpAuto || isHybrid) && (
                          <div className="mt-3 mb-2">
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
                            <div className="mb-2">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Display name (optional — rename for your organisation)</label>
                              <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)}
                                placeholder={`Default: ${dim.name}`}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
                              onClick={e => { e.stopPropagation(); setEditId(dim.id); setEditName(dim.name); setEditCode(dim.code); setEditRequired(dim.is_required); setEditDisplayName(dim.display_name || ""); }}
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
                          </p>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Deactivated dimensions */}
          {inactiveDims.length > 0 && (
            <div className="mt-4">
              <button type="button" onClick={() => setDeactivatedExpanded(v => !v)}
                className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 hover:text-gray-600">
                <i className={`ti ti-chevron-${deactivatedExpanded ? "down" : "right"}`} style={{ fontSize: 12 }} />
                Deactivated ({inactiveDims.length})
              </button>
              {deactivatedExpanded && <div className="space-y-2">
                {inactiveDims.map(dim => (
                  <div key={dim.id}
                    className="border border-gray-200 rounded-xl bg-gray-50 opacity-60 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <i className={`ti ti-${DIM_ICONS[dim.code] ?? "vector"} text-gray-400`} style={{ fontSize: 15 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-600">{dim.name}</p>
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{dim.code}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button type="button" onClick={() => handleToggle(dim)}
                        className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-white text-gray-600">
                        Reactivate
                      </button>
                      <button type="button" onClick={() => handleHardDelete(dim)}
                        className="text-xs px-2.5 py-1 border border-red-200 rounded hover:bg-red-50 text-red-500">
                        Delete permanently
                      </button>
                    </div>
                  </div>
                ))}
              </div>}
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
              onChange={e => {
                const newDimId = e.target.value;
                setSelectedDimForValues(newDimId);
                if (newDimId) {
                  const newDim = activeDims.find(d => d.id === newDimId);
                  const srcs = newDim?.dimension_sources ?? [];
                  setValuesSubTab(srcs[0]?.source_type ?? "manual");
                  loadInlineValues(newDimId);
                }
              }}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 max-w-xs">
              <option value="">— Select dimension —</option>
              {activeDims.map(d => <option key={d.id} value={d.id}>{d.display_name || d.name}</option>)}
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

            const sources = dim.dimension_sources ?? [];
            const autoSourceKeys = sources.map(s => s.source_type).filter(k => k !== "manual");
            const allTabs = [...autoSourceKeys, "manual"];

            const vals = inlineValues[selectedDimForValues] ?? [];
            const isLoadingVals = inlineValuesLoading[selectedDimForValues] ?? false;

            const SOURCE_BADGE: Record<string, string> = {
              org_structure: "bg-green-50 text-green-700",
              employee_master: "bg-blue-50 text-blue-700",
              manual: "bg-gray-100 text-gray-600",
            };

            const TAB_LABELS: Record<string, string> = {
              org_structure: "Org structure",
              employee_master: "Employee master",
              product_master: "Product master",
              customer_master: "Customer master",
              group_structure: "Group structure",
              manual: "Manual codes",
            };

            const currentVals = vals.filter(v => v.source === valuesSubTab);

            return (
              <div>
                <div className="flex gap-0 border-b border-gray-200 mb-4">
                  {allTabs.map(tab => (
                    <button key={tab} type="button" onClick={() => setValuesSubTab(tab)}
                      className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                        valuesSubTab === tab
                          ? "border-blue-600 text-gray-900 font-medium"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}>
                      {TAB_LABELS[tab] ?? tab}
                    </button>
                  ))}
                </div>

                {isLoadingVals ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
                  </div>
                ) : valuesSubTab !== "manual" ? (
                  <div>
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg mb-3">
                      <i className="ti ti-refresh text-blue-600 flex-shrink-0" style={{ fontSize: 13 }} />
                      <p className="text-xs text-blue-700">
                        {valuesSubTab === "org_structure"
                          ? "Read-only — values auto-synced from Organisation → Structure."
                          : valuesSubTab === "employee_master"
                          ? "Read-only — values auto-synced from the employee master."
                          : "Read-only — values auto-synced from the linked source."}
                      </p>
                    </div>
                    {valuesSubTab === "org_structure" && (
                      <Link href="/dashboard/business/setup/organisation"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-3">
                        <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
                        Go to Organisation → Structure
                      </Link>
                    )}
                    {valuesSubTab === "employee_master" && (
                      <Link href="/dashboard/business/settings/employees"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-3">
                        <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
                        Go to Employees
                      </Link>
                    )}
                    {currentVals.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Code</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Name</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {currentVals.map(val => (
                              <tr key={val.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-gray-600">{val.code}</td>
                                <td className="px-3 py-2 text-gray-800">{val.name}</td>
                                <td className="px-3 py-2">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SOURCE_BADGE[val.source] ?? "bg-gray-100 text-gray-600"}`}>
                                    {TAB_LABELS[val.source] ?? val.source}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No values from this source yet.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2 mb-3">
                      <button type="button"
                        onClick={() => setAddValueDimId(dim.id)}
                        className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50">+ Add value</button>
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
                    {currentVals.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Code</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Name</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {currentVals.map(val => (
                              <tr key={val.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-gray-600">{val.code}</td>
                                <td className="px-3 py-2 text-gray-800">{val.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No manual values yet. Add codes that aren&apos;t in any auto-synced source.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmDim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deletingDim && setDeleteConfirmDim(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-trash text-red-500" style={{ fontSize: 18 }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Delete &quot;{deleteConfirmDim.display_name || deleteConfirmDim.name}&quot;?
                </p>
                <p className="text-xs text-gray-500">
                  This will permanently delete this dimension and all its values.
                  This cannot be undone.
                </p>
                {STANDARD_CODES.has(deleteConfirmDim.code) && (
                  <p className="text-xs text-blue-600 mt-2">
                    <i className="ti ti-info-circle" style={{ fontSize: 12, verticalAlign: -1 }} /> This is a standard dimension. If needed, it will be recreated automatically on next page load.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmDim(null)}
                disabled={deletingDim}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmHardDelete}
                disabled={deletingDim}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                {deletingDim ? (
                  <>
                    <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} />
                    Deleting…
                  </>
                ) : (
                  <>
                    <i className="ti ti-trash" style={{ fontSize: 14 }} />
                    Delete permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
