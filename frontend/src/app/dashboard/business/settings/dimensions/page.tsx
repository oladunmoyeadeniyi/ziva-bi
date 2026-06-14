"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface DimensionSource {
  source_type: string;
  filter?: {
    parent_code?: string;
    excluded_codes?: string[];
  } | null;
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
  parent_id?: string | null;
  node_id?: string;
}

interface CascadeTarget {
  node: InlineValue;
  children: InlineValue[];
  action: "exclude" | "include";
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
  description?: string | null;
  is_active: boolean;
  valid_from?: string | null;  // DD/MM/YYYY
  valid_to?: string | null;    // DD/MM/YYYY
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

function DimensionsPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTabParam = (searchParams.get("tab") as Tab) || "setup";
  const initialDimParam = searchParams.get("dim") || "";
  const initialSubTabParam = searchParams.get("subtab") || "";

  const [activeTab, setActiveTab] = useState<Tab>(initialTabParam);
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
  const [addValueValidFrom, setAddValueValidFrom] = useState("");
  const [addValueValidTo, setAddValueValidTo] = useState("");
  const [addValueIsActive, setAddValueIsActive] = useState(true);
  const [addingValue, setAddingValue] = useState(false);
  const [addValueError, setAddValueError] = useState<string | null>(null);
  const [dimValues, setDimValues] = useState<Record<string, DimensionValue[]>>({});

  // Values tab
  const [selectedDimForValues, setSelectedDimForValues] = useState<string>(initialDimParam);
  const [valuesSubTab, setValuesSubTab] = useState<string>(initialSubTabParam || "org_structure");

  // Inline values (merged auto + manual per dimension)
  const [inlineValues, setInlineValues] = useState<Record<string, InlineValue[]>>({});
  const [inlineValuesLoading, setInlineValuesLoading] = useState<Record<string, boolean>>({});

  // Deactivated section collapsed by default
  const [deactivatedExpanded, setDeactivatedExpanded] = useState(false);

  // Edit display name
  const [editDisplayName, setEditDisplayName] = useState("");

  // Bulk upload state
  const [uploadingDimId, setUploadingDimId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    dimId: string; imported: number; updated: number; skipped: number;
    errors: { row: number; reason: string }[];
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Universal upload (all dimensions in one file)
  const universalFileInputRef = useRef<HTMLInputElement>(null);
  const [universalUploading, setUniversalUploading] = useState(false);
  const [universalUploadResult, setUniversalUploadResult] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Delete confirmation modal
  const [deleteConfirmDim, setDeleteConfirmDim] = useState<Dimension | null>(null);
  const [deletingDim, setDeletingDim] = useState(false);

  // Cascade exclusion modal
  const [cascadeModal, setCascadeModal] = useState<CascadeTarget | null>(null);
  const [cascadeSelectedChildren, setCascadeSelectedChildren] = useState<Set<string>>(new Set());
  const [cascadeMode, setCascadeMode] = useState<"all" | "parent_only" | "choose" | null>(null);
  const [savingExclusion, setSavingExclusion] = useState(false);

  // Tree collapse state — empty = all expanded
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Values list — search, filters, selection, confirm modal
  const [valuesSearch, setValuesSearch] = useState("");
  const [selectedValueIds, setSelectedValueIds] = useState<Set<string>>(new Set());
  const [valuesStatusFilter, setValuesStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [valuesValidityFilter, setValuesValidityFilter] = useState<"all" | "no_expiry" | number>("all");
  const [activeGroupCollapsed, setActiveGroupCollapsed] = useState(false);
  const [inactiveGroupCollapsed, setInactiveGroupCollapsed] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    type: "delete" | "bulk-delete" | "bulk-deactivate" | "bulk-reactivate";
    ids: string[];
    label: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit value modal
  const [editValueModal, setEditValueModal] = useState<{
    id: string;
    code: string;
    name: string;
    description: string;
    valid_from: string;  // DD/MM/YYYY or empty string
    valid_to: string;    // DD/MM/YYYY or empty string
    is_active: boolean;
  } | null>(null);
  const [editValueSaving, setEditValueSaving] = useState(false);
  const [editValueError, setEditValueError] = useState<string | null>(null);

  const toggleNodeCollapse = (nodeCode: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeCode)) next.delete(nodeCode);
      else next.add(nodeCode);
      return next;
    });
  };

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
      if (initialDimParam) {
        loadInlineValues(initialDimParam);
        if (initialSubTabParam) {
          setValuesSubTab(initialSubTabParam);
        }
      }
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
          description: addValueDesc.trim() || null,
          valid_from: addValueValidFrom.trim() || null,
          valid_to: addValueValidTo.trim() || null,
          is_active: addValueIsActive,
        }),
      });
      setAddValueDimId(null);
      setAddValueCode("");
      setAddValueName("");
      setAddValueDesc("");
      setAddValueValidFrom("");
      setAddValueValidTo("");
      setAddValueIsActive(true);
      await loadDimValues(dimId);
      await loadInlineValues(dimId);
    } catch (err) {
      setAddValueError(err instanceof Error ? err.message : "Failed to add value.");
    } finally {
      setAddingValue(false);
    }
  };

  const handleEditValueSave = async () => {
    if (!editValueModal || !accessToken || !selectedDimForValues) return;
    setEditValueSaving(true);
    setEditValueError(null);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const patchBody: Record<string, unknown> = {
        name: editValueModal.name,
        description: editValueModal.description || null,
        is_active: editValueModal.is_active,
      };
      if (editValueModal.valid_from.trim()) {
        patchBody.valid_from = editValueModal.valid_from.trim();
      }
      if (editValueModal.valid_to.trim()) {
        patchBody.valid_to = editValueModal.valid_to.trim();
      }
      const res = await fetch(
        `${BASE}/api/config/dimensions/${selectedDimForValues}/values/${editValueModal.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchBody),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let errMsg = "Save failed";
        if (typeof data.detail === "string") {
          errMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errMsg = data.detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join("; ");
        } else if (data.detail) {
          errMsg = JSON.stringify(data.detail);
        }
        throw new Error(errMsg);
      }
      await loadDimValues(selectedDimForValues);
      setEditValueModal(null);
    } catch (err) {
      setEditValueError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setEditValueSaving(false);
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
    setUploadingDimId(dimId);
    setUploadResult(null);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/config/dimensions/${dimId}/values/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setUploadError(body?.detail ?? `Upload failed (${res.status}).`);
        return;
      }
      const result = await res.json();
      setUploadResult({ dimId, ...result });
      await loadDimValues(dimId);
      await loadInlineValues(dimId);
    } catch {
      setUploadError("Upload failed — check your connection and try again.");
    } finally {
      setUploadingDimId(null);
    }
  };

  const handleUniversalTemplateDownload = async () => {
    if (!accessToken) return;
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${BASE}/api/config/dimensions/template/universal`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dimension_values_universal_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUniversalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    e.target.value = "";
    setUniversalUploading(true);
    setUniversalUploadResult(null);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/api/config/dimensions/upload/universal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Upload failed");
      setUniversalUploadResult({
        message: `Imported ${data.imported}, updated ${data.updated}, skipped ${data.skipped}. Errors: ${data.errors?.length ?? 0}.`,
        type: "success",
      });
      if (selectedDimForValues) await loadDimValues(selectedDimForValues);
    } catch (err) {
      setUniversalUploadResult({
        message: err instanceof Error ? err.message : "Upload failed.",
        type: "error",
      });
    } finally {
      setUniversalUploading(false);
      setTimeout(() => setUniversalUploadResult(null), 6000);
    }
  };

  const filteredValues = (dimValues[selectedDimForValues] ?? []).filter(v => {
    if (valuesSearch) {
      const q = valuesSearch.toLowerCase();
      if (!v.code.toLowerCase().includes(q) && !v.name.toLowerCase().includes(q)) return false;
    }
    if (valuesStatusFilter === "active" && !v.is_active) return false;
    if (valuesStatusFilter === "inactive" && v.is_active) return false;
    if (typeof valuesValidityFilter === "number") {
      const year = valuesValidityFilter;
      const parseYear = (dateStr: string | null | undefined): number | null => {
        if (!dateStr) return null;
        if (dateStr.includes("-")) return parseInt(dateStr.split("-")[0]);
        const parts = dateStr.split("/");
        return parts.length === 3 ? parseInt(parts[2]) : null;
      };
      const fromYear = parseYear(v.valid_from);
      const toYear = parseYear(v.valid_to);
      const fromOk = fromYear === null || fromYear <= year;
      const toOk = toYear === null || toYear >= year;
      if (!fromOk || !toOk) return false;
    }
    if (valuesValidityFilter === "no_expiry") {
      if (v.valid_to) return false;
    }
    return true;
  });

  const activeValues = filteredValues.filter(v => v.is_active);
  const inactiveValues = filteredValues.filter(v => !v.is_active);

  const availableYears: number[] = (() => {
    const allValues = dimValues[selectedDimForValues] ?? [];
    const yearSet = new Set<number>();
    for (const v of allValues) {
      const parseYear = (dateStr: string | null | undefined): number | null => {
        if (!dateStr) return null;
        if (dateStr.includes("-")) {
          const y = parseInt(dateStr.split("-")[0]);
          return isNaN(y) ? null : y;
        }
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const y = parseInt(parts[2]);
          return isNaN(y) ? null : y;
        }
        return null;
      };
      const fromYear = parseYear(v.valid_from);
      const toYear = parseYear(v.valid_to);
      if (fromYear) yearSet.add(fromYear);
      if (toYear) yearSet.add(toYear);
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  })();

  const handleToggleValue = async (valueId: string) => {
    if (!accessToken || !selectedDimForValues) return;
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(
        `${BASE}/api/config/dimensions/${selectedDimForValues}/values/${valueId}/toggle`,
        { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error("Failed to toggle value");
      await loadDimValues(selectedDimForValues);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal || !accessToken || !selectedDimForValues) return;
    setActionLoading(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const { type, ids } = confirmModal;

      if (type === "delete") {
        await fetch(
          `${BASE}/api/config/dimensions/${selectedDimForValues}/values/${ids[0]}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
        );
      } else if (type === "bulk-delete") {
        await fetch(
          `${BASE}/api/config/dimensions/${selectedDimForValues}/values/bulk-delete`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          }
        );
      } else if (type === "bulk-deactivate") {
        await fetch(
          `${BASE}/api/config/dimensions/${selectedDimForValues}/values/bulk-deactivate`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          }
        );
      } else if (type === "bulk-reactivate") {
        await fetch(
          `${BASE}/api/config/dimensions/${selectedDimForValues}/values/bulk-reactivate`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          }
        );
      }

      setSelectedValueIds(new Set());
      await loadDimValues(selectedDimForValues);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  const buildTree = (nodes: InlineValue[]): (InlineValue & { children: InlineValue[] })[] => {
    const nodeMap = new Map<string, InlineValue & { children: InlineValue[] }>();
    const roots: (InlineValue & { children: InlineValue[] })[] = [];
    nodes.forEach(n => nodeMap.set(n.node_id ?? n.id, { ...n, children: [] }));
    nodes.forEach(n => {
      const node = nodeMap.get(n.node_id ?? n.id)!;
      if (n.parent_id && nodeMap.has(n.parent_id)) {
        nodeMap.get(n.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const getExcludedCodes = (dim: Dimension, sourceType: string = "org_structure"): Set<string> => {
    const src = (dim.dimension_sources ?? []).find(s => s.source_type === sourceType);
    return new Set<string>(src?.filter?.excluded_codes ?? []);
  };

  const saveExclusions = async (
    dim: Dimension,
    excludedCodes: string[],
    sourceType: string = "org_structure"
  ) => {
    if (!accessToken) return;
    setSavingExclusion(true);
    try {
      const newSources = (dim.dimension_sources ?? []).map(s => {
        if (s.source_type === sourceType) {
          return { ...s, filter: { ...(s.filter ?? {}), excluded_codes: excludedCodes } };
        }
        return s;
      });
      await apiFetch(`/api/config/dimensions/${dim.id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ dimension_sources: newSources }),
      });
      await load();
    } catch {
      setError("Failed to save exclusion.");
    } finally {
      setSavingExclusion(false);
    }
  };

  const handleNodeCheck = (
    dim: Dimension,
    node: InlineValue & { children: (InlineValue & { children: InlineValue[] })[] },
    allNodes: InlineValue[],
    currentlyExcluded: Set<string>
  ) => {
    const isExcluded = currentlyExcluded.has(node.code);
    const action: "exclude" | "include" = isExcluded ? "include" : "exclude";
    const children = allNodes.filter(n => n.parent_id === (node.node_id ?? node.id));
    if (children.length > 0) {
      setCascadeModal({ node, children, action });
      setCascadeMode(null);
      setCascadeSelectedChildren(new Set(children.map(c => c.code)));
    } else {
      const newExcluded = new Set(currentlyExcluded);
      if (isExcluded) newExcluded.delete(node.code);
      else newExcluded.add(node.code);
      saveExclusions(dim, Array.from(newExcluded), "org_structure");
    }
  };

  const applyCascade = async (dim: Dimension, currentlyExcluded: Set<string>) => {
    if (!cascadeModal || !cascadeMode) return;
    const { node, action } = cascadeModal;
    const newExcluded = new Set(currentlyExcluded);
    if (action === "exclude") {
      newExcluded.add(node.code);
      if (cascadeMode === "all") {
        cascadeModal.children.forEach(c => newExcluded.add(c.code));
      } else if (cascadeMode === "choose") {
        cascadeSelectedChildren.forEach(code => newExcluded.add(code));
      }
    } else {
      newExcluded.delete(node.code);
      if (cascadeMode === "all") {
        cascadeModal.children.forEach(c => newExcluded.delete(c.code));
      } else if (cascadeMode === "choose") {
        cascadeSelectedChildren.forEach(code => newExcluded.delete(code));
      }
    }
    await saveExclusions(dim, Array.from(newExcluded), "org_structure");
    setCascadeModal(null);
    setCascadeMode(null);
  };

  const toInputDate = (ddmmyyyy: string): string => {
    if (!ddmmyyyy) return "";
    const [d, m, y] = ddmmyyyy.split("/");
    if (!d || !m || !y) return "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  const fromInputDate = (yyyymmdd: string): string => {
    if (!yyyymmdd) return "";
    const [y, m, d] = yyyymmdd.split("-");
    if (!y || !m || !d) return "";
    return `${d}/${m}/${y}`;
  };

  const formatDateDisplay = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "—";
    if (dateStr.includes("/")) return dateStr;
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}/${y}`;
  };

  const renderValuesTable = (values: DimensionValue[]) => (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="w-8 px-3 py-2">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-blue-600"
              checked={values.length > 0 && values.every(v => selectedValueIds.has(v.id))}
              onChange={e => {
                setSelectedValueIds(prev => {
                  const next = new Set(prev);
                  if (e.target.checked) values.forEach(v => next.add(v.id));
                  else values.forEach(v => next.delete(v.id));
                  return next;
                });
              }}
            />
          </th>
          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Code</th>
          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Valid From</th>
          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Valid To</th>
          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {values.map(v => (
          <tr key={v.id} className="hover:bg-gray-50">
            <td className="px-3 py-2">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-blue-600"
                checked={selectedValueIds.has(v.id)}
                onChange={e => {
                  setSelectedValueIds(prev => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(v.id);
                    else next.delete(v.id);
                    return next;
                  });
                }}
              />
            </td>
            <td className="px-3 py-2 font-mono text-gray-700">{v.code}</td>
            <td className="px-3 py-2 text-gray-800">{v.name}</td>
            <td className="px-3 py-2 text-gray-500 text-[11px]">{formatDateDisplay(v.valid_from)}</td>
            <td className="px-3 py-2 text-gray-500 text-[11px]">{formatDateDisplay(v.valid_to)}</td>
            <td className="px-3 py-2">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditValueModal({
                    id: v.id,
                    code: v.code,
                    name: v.name,
                    description: v.description ?? "",
                    valid_from: v.valid_from ?? "",
                    valid_to: v.valid_to ?? "",
                    is_active: v.is_active,
                  })}
                  className="text-[11px] text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleValue(v.id)}
                  className="text-[11px] text-gray-500 hover:text-gray-800"
                >
                  {v.is_active ? "Deactivate" : "Reactivate"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal({
                    type: "delete",
                    ids: [v.id],
                    label: `Delete "${v.code} — ${v.name}"? This cannot be undone.`
                  })}
                  className="text-[11px] text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

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
                              <>
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
                                  <label className={`text-xs px-2.5 py-1 border border-gray-300 rounded flex items-center gap-1 ${uploadingDimId === dim.id ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}>
                                    <i className={`ti ${uploadingDimId === dim.id ? "ti-loader-2 animate-spin" : "ti-upload"}`} style={{ fontSize: 11 }} />
                                    {uploadingDimId === dim.id ? "Uploading…" : "Upload"}
                                    <input type="file" accept=".xlsx,.csv" className="hidden"
                                      disabled={uploadingDimId === dim.id}
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleBulkUpload(dim.id, file);
                                        e.target.value = "";
                                      }} />
                                  </label>
                                </div>
                                {uploadResult?.dimId === dim.id && (
                                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex items-start gap-1.5">
                                    <i className="ti ti-circle-check flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                                    <span>
                                      Imported {uploadResult.imported}, updated {uploadResult.updated}, skipped {uploadResult.skipped}.
                                      {uploadResult.errors.length > 0 && (
                                        <span className="text-amber-700"> {uploadResult.errors.length} row error{uploadResult.errors.length !== 1 ? "s" : ""}: {uploadResult.errors.slice(0, 2).map(e => `Row ${e.row}: ${e.reason}`).join("; ")}{uploadResult.errors.length > 2 ? "…" : ""}</span>
                                      )}
                                    </span>
                                  </div>
                                )}
                                {uploadError && uploadingDimId === null && (
                                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-1.5">
                                    <i className="ti ti-alert-circle flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                                    {uploadError}
                                  </div>
                                )}
                              </>
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
          {/* Universal upload — one file for all dimensions */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={handleUniversalTemplateDownload}
              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
            >
              <i className="ti ti-download" style={{ fontSize: 13 }} /> Download universal template
            </button>
            <button
              type="button"
              onClick={() => universalFileInputRef.current?.click()}
              disabled={universalUploading}
              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
            >
              <i className={`ti ${universalUploading ? "ti-loader-2 animate-spin" : "ti-upload"}`} style={{ fontSize: 13 }} />
              {universalUploading ? "Uploading…" : "Upload all dimensions"}
            </button>
            <input
              type="file"
              ref={universalFileInputRef}
              className="hidden"
              accept=".xlsx"
              onChange={handleUniversalUpload}
            />
            <span className="text-xs text-gray-400 ml-2">Use this to upload values for multiple dimensions at once</span>
          </div>
          {universalUploadResult && (
            <p className={`text-xs mb-3 ${universalUploadResult.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {universalUploadResult.message}
            </p>
          )}

          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-600">Dimension:</label>
            <select value={selectedDimForValues}
              onChange={e => {
                const newDimId = e.target.value;
                setSelectedDimForValues(newDimId);
                setAddValueDimId(null);
                setAddValueCode("");
                setAddValueName("");
                setValuesStatusFilter("all");
                setValuesValidityFilter("all");
                setValuesSearch("");
                setSelectedValueIds(new Set());
                setActiveGroupCollapsed(false);
                setInactiveGroupCollapsed(true);
                if (newDimId) {
                  const newDim = activeDims.find(d => d.id === newDimId);
                  const newSources = newDim?.dimension_sources ?? [];
                  const hasOrg = newSources.some(s => s.source_type === "org_structure");
                  const hasEmp = newSources.some(s => s.source_type === "employee_master");
                  if (hasOrg) setValuesSubTab("org_structure");
                  else if (hasEmp) setValuesSubTab("employee_master");
                  else setValuesSubTab("manual");
                  loadInlineValues(newDimId);
                  loadDimValues(newDimId);
                  setSelectedValueIds(new Set());
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
                    {valuesSubTab === "org_structure" && (() => {
                      const returnUrl = encodeURIComponent(
                        `/dashboard/business/settings/dimensions?tab=values&dim=${dim.id}&subtab=${valuesSubTab}`
                      );
                      return (
                        <Link href={`/dashboard/business/setup/organisation?tab=structure&returnTo=${returnUrl}`}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-3">
                          <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
                          Go to Organisation → Structure
                        </Link>
                      );
                    })()}
                    {valuesSubTab === "employee_master" && (() => {
                      const empVals = vals.filter(v => v.source === "employee_master");
                      const excludedEmpCodes = getExcludedCodes(dim, "employee_master");

                      const sortedEmpVals = [...empVals].sort((a, b) => {
                        const aEx = excludedEmpCodes.has(a.code) ? 1 : 0;
                        const bEx = excludedEmpCodes.has(b.code) ? 1 : 0;
                        return aEx - bEx;
                      });

                      return (
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md flex-1 mr-3">
                              <i className="ti ti-refresh text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                              <p className="text-xs text-blue-700">
                                Auto-synced from employee master. Uncheck employees to exclude them from this dimension.
                              </p>
                            </div>
                            <Link
                              href={`/dashboard/business/settings/employees?returnTo=${encodeURIComponent(
                                `/dashboard/business/settings/dimensions?tab=values&dim=${dim.id}&subtab=employee_master`
                              )}`}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 flex-shrink-0 mt-2.5">
                              <i className="ti ti-external-link" style={{ fontSize: 12 }} />
                              Go to source
                            </Link>
                          </div>

                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-500">
                              {empVals.length - excludedEmpCodes.size} of {empVals.length} employees included.
                              {excludedEmpCodes.size > 0 && (
                                <button
                                  type="button"
                                  onClick={() => saveExclusions(dim, [], "employee_master")}
                                  className="ml-2 text-blue-600 hover:text-blue-800">
                                  Include all
                                </button>
                              )}
                            </p>
                            {savingExclusion && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 12 }} /> Saving…
                              </span>
                            )}
                          </div>

                          {sortedEmpVals.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-4 text-center">
                              No employees loaded yet. Add employees on the Employees page.
                            </p>
                          ) : (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 w-8">
                                      <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                        checked={excludedEmpCodes.size === 0}
                                        ref={el => {
                                          if (el) el.indeterminate =
                                            excludedEmpCodes.size > 0 &&
                                            excludedEmpCodes.size < empVals.length;
                                        }}
                                        onChange={e => saveExclusions(
                                          dim,
                                          e.target.checked ? [] : empVals.map(v => v.code),
                                          "employee_master"
                                        )}
                                      />
                                    </th>
                                    <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide text-[10px]">Code</th>
                                    <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide text-[10px]">Name</th>
                                    <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide text-[10px]">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {sortedEmpVals.map(emp => {
                                    const isExcluded = excludedEmpCodes.has(emp.code);
                                    return (
                                      <tr key={emp.id} className={`hover:bg-gray-50 ${isExcluded ? "opacity-40" : ""}`}>
                                        <td className="px-3 py-2">
                                          <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                            checked={!isExcluded}
                                            onChange={() => {
                                              const newExcluded = new Set(excludedEmpCodes);
                                              if (isExcluded) newExcluded.delete(emp.code);
                                              else newExcluded.add(emp.code);
                                              saveExclusions(dim, Array.from(newExcluded), "employee_master");
                                            }}
                                          />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{emp.code}</td>
                                        <td className="px-3 py-2 text-gray-800">{emp.name}</td>
                                        <td className="px-3 py-2">
                                          {isExcluded
                                            ? <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">Excluded</span>
                                            : <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Included</span>
                                          }
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {valuesSubTab === "org_structure" ? (() => {
                      const orgVals = vals.filter(v => v.source === "org_structure");
                      const excludedCodes = getExcludedCodes(dim, "org_structure");
                      const tree = buildTree(orgVals);

                      const renderNode = (
                        node: InlineValue & { children: (InlineValue & { children: InlineValue[] })[] },
                        depth: number = 0,
                        excCodes: Set<string> = excludedCodes
                      ): React.ReactNode => {
                        const isExcluded = excCodes.has(node.code);
                        const hasChildren = node.children.length > 0;
                        const isCollapsed = collapsedNodes.has(node.code);
                        const sortedChildren = hasChildren
                          ? [...node.children].sort((a, b) => {
                              const aEx = excCodes.has(a.code) ? 1 : 0;
                              const bEx = excCodes.has(b.code) ? 1 : 0;
                              return aEx - bEx;
                            })
                          : [];
                        const someChildrenExcluded = hasChildren && node.children.some(c => excCodes.has(c.code));
                        const allChildrenExcluded = hasChildren && node.children.every(c => excCodes.has(c.code));
                        const isIndeterminate = hasChildren && someChildrenExcluded && !allChildrenExcluded && !isExcluded;
                        return (
                          <React.Fragment key={node.code}>
                            <tr className={`hover:bg-gray-50 ${isExcluded ? "opacity-40" : ""}`}>
                              <td className="px-3 py-2 w-8">
                                <input
                                  type="checkbox"
                                  className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                  checked={!isExcluded}
                                  ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                                  onChange={() => handleNodeCheck(dim, node, orgVals, excCodes)}
                                />
                              </td>
                              <td className="px-3 py-2 font-mono text-gray-600 text-xs">
                                <span style={{ paddingLeft: `${depth * 16}px` }} className="flex items-center gap-1">
                                  {depth > 0 && <span className="text-gray-300 mr-0.5">└</span>}
                                  {hasChildren && (
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); toggleNodeCollapse(node.code); }}
                                      className="text-gray-400 hover:text-gray-600 flex-shrink-0 w-4"
                                      title={isCollapsed ? "Expand children" : "Collapse children"}
                                    >
                                      <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"}`} style={{ fontSize: 11 }} />
                                    </button>
                                  )}
                                  {!hasChildren && <span className="w-4 flex-shrink-0" />}
                                  {node.code}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-800 text-xs">{node.name}</td>
                              <td className="px-3 py-2 text-xs">
                                {isExcluded
                                  ? <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">Excluded</span>
                                  : <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Included</span>
                                }
                              </td>
                            </tr>
                            {hasChildren && !isCollapsed && sortedChildren.map(child =>
                              renderNode(child as InlineValue & { children: (InlineValue & { children: InlineValue[] })[] }, depth + 1, excCodes)
                            )}
                          </React.Fragment>
                        );
                      };

                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-500">
                              {orgVals.length - excludedCodes.size} of {orgVals.length} cost centers included.
                              {excludedCodes.size > 0 && (
                                <button type="button" onClick={() => saveExclusions(dim, [], "org_structure")}
                                  className="ml-2 text-blue-600 hover:text-blue-800">
                                  Include all
                                </button>
                              )}
                            </p>
                            {savingExclusion && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 12 }} /> Saving…
                              </span>
                            )}
                          </div>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="min-w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 w-8">
                                    <input type="checkbox"
                                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                      checked={excludedCodes.size === 0}
                                      ref={el => { if (el) el.indeterminate = excludedCodes.size > 0 && excludedCodes.size < orgVals.length; }}
                                      onChange={e => saveExclusions(dim, e.target.checked ? [] : orgVals.map(v => v.code), "org_structure")}
                                    />
                                  </th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide text-[10px]">Code</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide text-[10px]">Name</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide text-[10px]">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {tree.map(node => renderNode(node as any, 0, excludedCodes))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })() : currentVals.length > 0 ? (
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
                      <label className={`text-xs px-2.5 py-1 border border-gray-300 rounded flex items-center gap-1 ${uploadingDimId === dim.id ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}>
                        <i className={`ti ${uploadingDimId === dim.id ? "ti-loader-2 animate-spin" : "ti-upload"}`} style={{ fontSize: 11 }} />
                        {uploadingDimId === dim.id ? "Uploading…" : "Upload"}
                        <input type="file" accept=".xlsx,.csv" className="hidden"
                          disabled={uploadingDimId === dim.id}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleBulkUpload(dim.id, file);
                            e.target.value = "";
                          }} />
                      </label>
                    </div>
                    {uploadResult?.dimId === dim.id && (
                      <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex items-start gap-1.5">
                        <i className="ti ti-circle-check flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                        <span>
                          Imported {uploadResult.imported}, updated {uploadResult.updated}, skipped {uploadResult.skipped}.
                          {uploadResult.errors.length > 0 && (
                            <span className="text-amber-700"> {uploadResult.errors.length} row error{uploadResult.errors.length !== 1 ? "s" : ""}: {uploadResult.errors.slice(0, 2).map(e => `Row ${e.row}: ${e.reason}`).join("; ")}{uploadResult.errors.length > 2 ? "…" : ""}</span>
                          )}
                        </span>
                      </div>
                    )}
                    {uploadError && uploadingDimId === null && (
                      <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-1.5">
                        <i className="ti ti-alert-circle flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                        {uploadError}
                      </div>
                    )}
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
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">
                              Valid From <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <input
                              type="date"
                              value={toInputDate(addValueValidFrom)}
                              onChange={e => setAddValueValidFrom(fromInputDate(e.target.value))}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">
                              Valid To <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <input
                              type="date"
                              value={toInputDate(addValueValidTo)}
                              onChange={e => setAddValueValidTo(fromInputDate(e.target.value))}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            id="add-value-is-active"
                            checked={addValueIsActive}
                            onChange={e => setAddValueIsActive(e.target.checked)}
                            className="w-3.5 h-3.5 accent-blue-600"
                          />
                          <label htmlFor="add-value-is-active" className="text-xs font-medium text-gray-600">
                            Active
                          </label>
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
                    {/* Search + filter bar */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <input
                        type="text"
                        value={valuesSearch}
                        onChange={e => setValuesSearch(e.target.value)}
                        placeholder="Search by code or name…"
                        className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={valuesStatusFilter}
                        onChange={e => setValuesStatusFilter(e.target.value as "all" | "active" | "inactive")}
                        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none bg-white"
                      >
                        <option value="all">All statuses</option>
                        <option value="active">Active only</option>
                        <option value="inactive">Inactive only</option>
                      </select>
                      {/* Validity filter — pill buttons */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setValuesValidityFilter("all")}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            valuesValidityFilter === "all"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setValuesValidityFilter("no_expiry")}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            valuesValidityFilter === "no_expiry"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          No expiry
                        </button>
                        {availableYears.map(year => (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setValuesValidityFilter(year)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              valuesValidityFilter === year
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                            }`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">{filteredValues.length} values</span>
                    </div>

                    {/* Bulk action bar — only visible when rows selected */}
                    {selectedValueIds.size > 0 && (
                      <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-xs font-medium text-blue-700">
                          {selectedValueIds.size} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmModal({
                            type: "bulk-deactivate",
                            ids: Array.from(selectedValueIds),
                            label: `Deactivate ${selectedValueIds.size} value(s)?`
                          })}
                          className="text-xs px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                        >
                          Deactivate
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmModal({
                            type: "bulk-reactivate",
                            ids: Array.from(selectedValueIds),
                            label: `Reactivate ${selectedValueIds.size} value(s)?`
                          })}
                          className="text-xs px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                        >
                          Reactivate
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmModal({
                            type: "bulk-delete",
                            ids: Array.from(selectedValueIds),
                            label: `Permanently delete ${selectedValueIds.size} value(s)? This cannot be undone.`
                          })}
                          className="text-xs px-3 py-1 rounded border border-red-300 bg-white text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedValueIds(new Set())}
                          className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}

                    {/* ACTIVE GROUP */}
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => setActiveGroupCollapsed(prev => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 mb-1"
                      >
                        <span className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          Active
                          <span className="font-normal text-gray-400">({activeValues.length})</span>
                        </span>
                        <span className="text-xs text-gray-400">{activeGroupCollapsed ? "▼ Expand" : "▲ Collapse"}</span>
                      </button>
                      {!activeGroupCollapsed && (
                        activeValues.length === 0 ? (
                          <p className="text-xs text-gray-400 italic px-3 py-3">No active values match your filters.</p>
                        ) : (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            {renderValuesTable(activeValues)}
                          </div>
                        )
                      )}
                    </div>

                    {/* INACTIVE GROUP — only shown if there are inactive values matching filters */}
                    {inactiveValues.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setInactiveGroupCollapsed(prev => !prev)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 mb-1"
                        >
                          <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                            Inactive
                            <span className="font-normal text-gray-400">({inactiveValues.length})</span>
                          </span>
                          <span className="text-xs text-gray-400">{inactiveGroupCollapsed ? "▼ Expand" : "▲ Collapse"}</span>
                        </button>
                        {!inactiveGroupCollapsed && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden opacity-75">
                            {renderValuesTable(inactiveValues)}
                          </div>
                        )}
                      </div>
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

      {/* Edit value modal */}
      {editValueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !editValueSaving && setEditValueModal(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              Edit value — <span className="font-mono text-gray-600">{editValueModal.code}</span>
            </h2>
            <p className="text-xs text-gray-400 mb-4">Code cannot be changed after creation.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Name *</label>
                <input
                  type="text"
                  value={editValueModal.name}
                  onChange={e => setEditValueModal(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editValueModal.description}
                  onChange={e => setEditValueModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Valid From <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editValueModal.valid_from}
                    onChange={e => setEditValueModal(prev =>
                      prev ? { ...prev, valid_from: e.target.value } : null
                    )}
                    placeholder="e.g. 01/01/2025"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Valid To <span className="text-gray-400 font-normal">(dd/mm/yyyy, optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editValueModal.valid_to}
                    onChange={e => setEditValueModal(prev =>
                      prev ? { ...prev, valid_to: e.target.value } : null
                    )}
                    placeholder="e.g. 31/12/2025"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-value-is-active"
                  checked={editValueModal.is_active}
                  onChange={e => setEditValueModal(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <label htmlFor="edit-value-is-active" className="text-xs font-medium text-gray-700">
                  Active
                </label>
              </div>

              {editValueError && (
                <p className="text-xs text-red-600">{editValueError}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setEditValueModal(null)}
                disabled={editValueSaving}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditValueSave}
                disabled={editValueSaving || !editValueModal.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {editValueSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Values list confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !actionLoading && setConfirmModal(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Confirm action</h2>
            <p className="text-sm text-gray-600 mb-5">{confirmModal.label}</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cascade exclusion modal */}
      {cascadeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40"
            onClick={() => !savingExclusion && setCascadeModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                cascadeModal.action === "exclude" ? "bg-amber-50" : "bg-green-50"
              }`}>
                <i className={`ti ${cascadeModal.action === "exclude" ? "ti-minus text-amber-500" : "ti-plus text-green-500"}`}
                  style={{ fontSize: 18 }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {cascadeModal.action === "exclude" ? "Exclude" : "Reinclude"} &quot;{cascadeModal.node.name}&quot;?
                </p>
                <p className="text-xs text-gray-500">
                  This cost center has {cascadeModal.children.length} child{cascadeModal.children.length !== 1 ? "ren" : ""}.
                  What would you like to {cascadeModal.action === "exclude" ? "exclude" : "reinclude"}?
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => setCascadeMode("all")}>
                <input type="radio" name="cascade" checked={cascadeMode === "all"}
                  onChange={() => setCascadeMode("all")} className="accent-blue-600" />
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    {cascadeModal.action === "exclude" ? "Exclude" : "Reinclude"} parent and all children
                  </p>
                  <p className="text-xs text-gray-400">
                    {cascadeModal.node.name} + {cascadeModal.children.map(c => c.name).join(", ")}
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => setCascadeMode("parent_only")}>
                <input type="radio" name="cascade" checked={cascadeMode === "parent_only"}
                  onChange={() => setCascadeMode("parent_only")} className="accent-blue-600" />
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    {cascadeModal.action === "exclude" ? "Exclude" : "Reinclude"} parent only
                  </p>
                  <p className="text-xs text-gray-400">Children are not affected</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => setCascadeMode("choose")}>
                <input type="radio" name="cascade" checked={cascadeMode === "choose"}
                  onChange={() => setCascadeMode("choose")} className="accent-blue-600" />
                <div>
                  <p className="text-xs font-medium text-gray-900">Let me choose specific children</p>
                </div>
              </label>
            </div>

            {cascadeMode === "choose" && (
              <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                {cascadeModal.children.map(child => (
                  <label key={child.code}
                    className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox"
                      className="w-3.5 h-3.5 accent-blue-600"
                      checked={cascadeSelectedChildren.has(child.code)}
                      onChange={e => {
                        setCascadeSelectedChildren(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(child.code);
                          else next.delete(child.code);
                          return next;
                        });
                      }} />
                    <span className="text-xs font-mono text-gray-500">{child.code}</span>
                    <span className="text-xs text-gray-800">{child.name}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setCascadeModal(null)}
                disabled={savingExclusion}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="button"
                onClick={() => {
                  const dim = activeDims.find(d => d.id === selectedDimForValues);
                  if (dim) applyCascade(dim, getExcludedCodes(dim, "org_structure"));
                }}
                disabled={savingExclusion || !cascadeMode || (cascadeMode === "choose" && cascadeSelectedChildren.size === 0)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 ${
                  cascadeModal.action === "exclude"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}>
                {savingExclusion ? (
                  <><i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} /> Saving…</>
                ) : (
                  cascadeModal.action === "exclude" ? "Confirm exclusion" : "Confirm inclusion"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DimensionsPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <DimensionsPage />
    </Suspense>
  );
}
