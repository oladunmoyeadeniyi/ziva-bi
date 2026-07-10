"use client";

/**
 * Positions — /dashboard/business/settings/positions
 *
 * Single source of truth: approval_roles table.
 * Any role created here appears in the Role Hierarchy and vice versa —
 * both views query the same backend table via their respective endpoints.
 *
 * Positions page focuses on the occupancy / slot management lens:
 *   - View all org roles with current occupants
 *   - Create / edit positions (writes to approval_roles)
 *   - Move a position (updates parent_role_id)
 *   - Archive a position (marks is_active = false)
 *   - Assign an employee to a position
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PositionOccupant {
  employee_id: string;
  employee_code: string | null;
  full_name: string;
  email: string;
  assignment_type: string;
  effective_from: string;
}

interface Position {
  id: string;
  name: string;                    // role title
  code: string | null;             // position code e.g. "CFO-001"
  grade: string | null;            // salary/job grade e.g. "G8", "Director"
  description: string | null;
  display_order: number;
  is_active: boolean;
  parent_role_id: string | null;
  parent_role_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  cost_center_code: string | null;
  entity_node_id: string | null;
  max_occupants: number | null;    // null = unlimited
  designation: string | null;
  area: string | null;
  sub_area: string | null;
  employment_type: string | null;
  occupant_count: number;
  occupants: PositionOccupant[];
  created_at: string;
}

interface CostCenterOption {
  id: string;
  code: string;
  name: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_code: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ASSIGNMENT_TYPES = ["substantive", "acting", "secondment"] as const;
const TRANSFER_REASONS = ["hire", "promotion", "lateral", "restructure", "acting", "secondment", "termination"] as const;

function badge(text: string, color: string) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {text}
    </span>
  );
}

function assignmentBadge(type: string) {
  const map: Record<string, string> = {
    substantive: "bg-blue-100 text-blue-800",
    acting: "bg-amber-100 text-amber-800",
    secondment: "bg-purple-100 text-purple-800",
  };
  return badge(type, map[type] ?? "bg-gray-100 text-gray-700");
}

function desigLabel(d: string | null) {
  const map: Record<string, string> = {
    individual_contributor: "Contributor",
    team_lead: "Team Lead",
    manager: "Manager",
    head_of_department: "HoD",
    head_of_entity: "HoE",
  };
  return d ? (map[d] ?? d) : null;
}

function desigColor(d: string | null) {
  const map: Record<string, string> = {
    individual_contributor: "bg-gray-100 text-gray-700",
    team_lead: "bg-teal-100 text-teal-800",
    manager: "bg-orange-100 text-orange-800",
    head_of_department: "bg-violet-100 text-violet-800",
    head_of_entity: "bg-blue-100 text-blue-800",
  };
  return map[d ?? ""] ?? "bg-gray-100 text-gray-700";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { accessToken } = useAuth();

  // List state
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "archived">("active");
  const [searchQ, setSearchQ] = useState("");

  // Reference data
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [movePos, setMovePos] = useState<Position | null>(null);
  const [historyPos, setHistoryPos] = useState<Position | null>(null);
  const [assignPos, setAssignPos] = useState<Position | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form state — create/edit
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fCostCenter, setFCostCenter] = useState("");
  const [fParent, setFParent] = useState("");
  const [fDesignation, setFDesignation] = useState("");
  const [fEmploymentType, setFEmploymentType] = useState("permanent");
  const [fCapacity, setFCapacity] = useState<"single" | "unlimited" | "custom">("single");
  const [fCustomN, setFCustomN] = useState("2");
  const [fArea, setFArea] = useState("");
  const [fSubArea, setFSubArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state — move
  const [mCostCenter, setMCostCenter] = useState("");
  const [mParent, setMParent] = useState("");
  const [mName, setMName] = useState("");
  const [mEffectiveDate, setMEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [mChangeReason, setMChangeReason] = useState("");
  const [mRetrospective, setMRetrospective] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Form state — assign
  const [aEmployee, setAEmployee] = useState("");
  const [aEffectiveDate, setAEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [aAssignType, setAAssignType] = useState<string>("substantive");
  const [aTransferReason, setATransferReason] = useState<string>("hire");
  const [aRetrospective, setARetrospective] = useState(false);
  const [aNotes, setANotes] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadPositions = async () => {
    setLoading(true);
    setError(null);
    try {
      const isActiveParam = filterActive === "active" ? "true" : filterActive === "archived" ? "false" : undefined;
      const qs = isActiveParam ? `?is_active=${isActiveParam}` : "";
      const data = await apiFetch<Position[]>(`/api/hr/positions${qs}`, { token: accessToken ?? undefined });
      setPositions(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load positions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();
  }, [filterActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiFetch<CostCenterOption[]>("/api/hr/cost-centers/options", { token: accessToken ?? undefined })
      .then((cc) => setCostCenters(cc))
      .catch(() => {/* non-fatal */});
    apiFetch<{ employees: Employee[] }>("/api/hr/employees?limit=500", { token: accessToken ?? undefined })
      .then((d) => setEmployees(d.employees ?? []))
      .catch(() => {/* non-fatal */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = positions.filter((p) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code ?? "").toLowerCase().includes(q) ||
      (p.cost_center_name ?? "").toLowerCase().includes(q) ||
      (p.grade ?? "").toLowerCase().includes(q) ||
      (p.designation ?? "").toLowerCase().includes(q)
    );
  });

  // ── Derived max_occupants from capacity toggle ───────────────────────────────
  const capacityToMaxOcc = () => {
    if (fCapacity === "single") return 1;
    if (fCapacity === "unlimited") return null;
    return parseInt(fCustomN) || 2;
  };

  // ── Open helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setFName(""); setFCode(""); setFGrade(""); setFDescription("");
    setFCostCenter(""); setFParent(""); setFDesignation(""); setFEmploymentType("permanent");
    setFCapacity("single"); setFCustomN("2"); setFArea(""); setFSubArea("");
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = (pos: Position) => {
    setFName(pos.name);
    setFCode(pos.code ?? "");
    setFGrade(pos.grade ?? "");
    setFDescription(pos.description ?? "");
    setFCostCenter(pos.cost_center_id ?? "");
    setFParent(pos.parent_role_id ?? "");
    setFDesignation(pos.designation ?? "");
    setFEmploymentType(pos.employment_type ?? "permanent");
    const cap = pos.max_occupants === 1 ? "single" : pos.max_occupants === null ? "unlimited" : "custom";
    setFCapacity(cap as "single" | "unlimited" | "custom");
    setFCustomN(String(pos.max_occupants ?? 2));
    setFArea(pos.area ?? "");
    setFSubArea(pos.sub_area ?? "");
    setFormError(null);
    setEditPos(pos);
  };

  const openMove = (pos: Position) => {
    setMCostCenter(pos.cost_center_id ?? "");
    setMParent(pos.parent_role_id ?? "");
    setMName(pos.name);
    setMEffectiveDate(new Date().toISOString().split("T")[0]);
    setMChangeReason("");
    setMRetrospective(false);
    setMoveError(null);
    setMovePos(pos);
  };

  const openHistory = async (pos: Position) => {
    setHistoryPos(pos);
    setHistoryLoading(true);
    setTimeout(() => setHistoryLoading(false), 400); // history endpoint returns [] — audit log future
  };

  const openAssign = (pos: Position) => {
    setAEmployee("");
    setAEffectiveDate(new Date().toISOString().split("T")[0]);
    setAAssignType("substantive");
    setATransferReason("hire");
    setARetrospective(false);
    setANotes("");
    setAssignError(null);
    setAssignPos(pos);
  };

  // ── CRUD actions ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!fName.trim()) { setFormError("Role name is required."); return; }
    if (!fDesignation) { setFormError("Designation is required."); return; }
    setSaving(true); setFormError(null);
    try {
      await apiFetch("/api/hr/positions", {
        token: accessToken ?? undefined,
        method: "POST",
        body: {
          name: fName.trim(),
          code: fCode.trim() || undefined,
          grade: fGrade.trim() || undefined,
          description: fDescription.trim() || undefined,
          cost_center_id: fCostCenter || undefined,
          parent_role_id: fParent || undefined,
          designation: (fDesignation === "regular" || !fDesignation) ? null : fDesignation,
          employment_type: fEmploymentType || "permanent",
          max_occupants: capacityToMaxOcc(),
          area: fArea.trim() || undefined,
          sub_area: fSubArea.trim() || undefined,
        },
      });
      setShowCreate(false);
      loadPositions();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create position.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editPos) return;
    if (!fName.trim()) { setFormError("Role name is required."); return; }
    setSaving(true); setFormError(null);
    try {
      await apiFetch(`/api/hr/positions/${editPos.id}`, {
        token: accessToken ?? undefined,
        method: "PATCH",
        body: {
          name: fName.trim(),
          code: fCode.trim() || null,
          grade: fGrade.trim() || null,
          description: fDescription.trim() || null,
          cost_center_id: fCostCenter || null,
          parent_role_id: fParent || null,
          designation: (fDesignation === "regular" || !fDesignation) ? null : fDesignation,
          employment_type: fEmploymentType || "permanent",
          max_occupants: capacityToMaxOcc(),
          area: fArea.trim() || null,
          sub_area: fSubArea.trim() || null,
        },
      });
      setEditPos(null);
      loadPositions();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to update position.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (pos: Position) => {
    if (!confirm(`Archive "${pos.name}"? Occupants remain but no new assignments can be made.`)) return;
    try {
      await apiFetch(`/api/hr/positions/${pos.id}`, { token: accessToken ?? undefined, method: "DELETE" });
      loadPositions();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to archive position.");
    }
  };

  const handleMove = async () => {
    if (!movePos) return;
    if (!mEffectiveDate) { setMoveError("Effective date is required."); return; }
    setSaving(true); setMoveError(null);
    try {
      await apiFetch(`/api/hr/positions/${movePos.id}/move`, {
        token: accessToken ?? undefined,
        method: "POST",
        body: {
          new_cost_center_id: mCostCenter || undefined,
          new_parent_role_id: mParent || undefined,
          new_name: mName !== movePos.name ? mName : undefined,
          effective_date: mEffectiveDate,
          change_reason: mChangeReason || undefined,
          is_retrospective: mRetrospective,
        },
      });
      setMovePos(null);
      loadPositions();
    } catch (e: unknown) {
      setMoveError(e instanceof Error ? e.message : "Failed to move position.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!assignPos) return;
    if (!aEmployee) { setAssignError("Select an employee."); return; }
    if (!aEffectiveDate) { setAssignError("Effective date is required."); return; }
    setSaving(true); setAssignError(null);
    try {
      await apiFetch(`/api/hr/employees/${aEmployee}/assign`, {
        token: accessToken ?? undefined,
        method: "POST",
        body: {
          approval_role_id: assignPos.id,
          effective_from: aEffectiveDate,
          assignment_type: aAssignType,
          transfer_reason: aTransferReason,
          is_retrospective: aRetrospective,
          notes: aNotes || undefined,
        },
      });
      setAssignPos(null);
      loadPositions();
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : "Failed to assign employee.");
    } finally {
      setSaving(false);
    }
  };

  // ── Shared position form ─────────────────────────────────────────────────────

  const positionFormFields = () => (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role / Position name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={fName}
          onChange={(e) => setFName(e.target.value)}
          placeholder="e.g. Head of Finance"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Code + Grade */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position code <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={fCode}
            onChange={(e) => setFCode(e.target.value)}
            placeholder="e.g. CFO-001"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade / band <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={fGrade}
            onChange={(e) => setFGrade(e.target.value)}
            placeholder="e.g. G8, Director"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
        <input
          type="text"
          value={fDescription}
          onChange={(e) => setFDescription(e.target.value)}
          placeholder="Brief description of this role"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Cost centre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cost centre</label>
        <select
          value={fCostCenter}
          onChange={(e) => setFCostCenter(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— None —</option>
          {costCenters.map((cc) => (
            <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
          ))}
        </select>
      </div>

      {/* Reports to */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reports to</label>
        <select
          value={fParent}
          onChange={(e) => setFParent(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— None (top-level) —</option>
          {positions.filter((p) => p.is_active && p.id !== editPos?.id).map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.cost_center_name ? ` · ${p.cost_center_name}` : ""}</option>
          ))}
        </select>
      </div>

      {/* Designation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Designation <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-5 rounded-lg border border-gray-300 overflow-hidden text-xs">
          {([
            { value: "individual_contributor", label: "Contributor", activeClass: "bg-gray-500 text-white" },
            { value: "team_lead",              label: "Team Lead",   activeClass: "bg-teal-600 text-white" },
            { value: "manager",                label: "Manager",     activeClass: "bg-orange-500 text-white" },
            { value: "head_of_department",     label: "HoD",         activeClass: "bg-violet-600 text-white" },
            { value: "head_of_entity",         label: "HoE",         activeClass: "bg-blue-600 text-white" },
          ] as const).map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFDesignation(opt.value)}
              className={`px-1 py-2 font-medium transition-colors text-center ${
                fDesignation === opt.value ? opt.activeClass : "bg-white text-gray-600 hover:bg-gray-50"
              } ${idx > 0 ? "border-l border-gray-300" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employment Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Employment type</label>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {([
            { value: "permanent",  label: "Permanent",  cls: "bg-green-600 text-white" },
            { value: "contract",   label: "Contract",   cls: "bg-amber-500 text-white" },
            { value: "outsourced", label: "Outsourced", cls: "bg-slate-500 text-white" },
          ] as const).map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFEmploymentType(opt.value)}
              className={`flex-1 px-3 py-2 font-medium transition-colors ${
                fEmploymentType === opt.value ? opt.cls : "bg-white text-gray-600 hover:bg-gray-50"
              } ${idx > 0 ? "border-l border-gray-300" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {([
            { value: "single",    label: "Single person" },
            { value: "unlimited", label: "Multiple" },
            { value: "custom",    label: "Fixed count" },
          ] as const).map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFCapacity(opt.value)}
              className={`flex-1 px-3 py-2 font-medium transition-colors ${
                fCapacity === opt.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              } ${idx > 0 ? "border-l border-gray-300" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {fCapacity === "custom" && (
          <input
            type="number" min={2} value={fCustomN}
            onChange={(e) => setFCustomN(e.target.value)}
            className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Max number of persons"
          />
        )}
      </div>

      {/* Area + Sub area */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Area / Location <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text" value={fArea}
            onChange={(e) => setFArea(e.target.value)}
            placeholder="e.g. Lagos Region"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub area <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text" value={fSubArea}
            onChange={(e) => setFSubArea(e.target.value)}
            placeholder="e.g. Mainland"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <PageHeading
        title="Positions"
        subtitle="Org roles and position slots — shared with the Role Hierarchy. Changes here reflect there and vice versa."
        actions={
          <Button onClick={openCreate} size="sm">+ New position</Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(["active", "archived", "all"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterActive(v)}
              className={`px-3 py-1.5 ${filterActive === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search positions…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">{filtered.length} position{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {error && <Banner variant="error" className="mb-4">{error}</Banner>}

      {/* Positions table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading positions…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium mb-1">No positions yet</p>
          <p className="text-sm">Create a position here, or add a role in Organisation → Role Hierarchy — they share the same data.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Position</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cost centre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reports to</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Grade / Designation</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Occupants</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((pos) => (
                <tr key={pos.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{pos.name}</div>
                    {pos.code && (
                      <div className="text-xs text-gray-400 font-mono">{pos.code}</div>
                    )}
                    {pos.area && (
                      <div className="text-xs text-gray-500 mt-0.5">{pos.area}{pos.sub_area ? ` · ${pos.sub_area}` : ""}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {pos.cost_center_name ?? <span className="text-gray-300">—</span>}
                    {pos.cost_center_code && (
                      <div className="text-xs text-gray-400 font-mono">{pos.cost_center_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {pos.parent_role_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {pos.grade && (
                        <span className="text-xs font-mono text-gray-700">{pos.grade}</span>
                      )}
                      {pos.designation && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${desigColor(pos.designation)}`}>
                          {desigLabel(pos.designation)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {pos.occupant_count === 0 ? (
                      <span className="text-xs text-amber-600 font-medium">Vacant</span>
                    ) : (
                      <div className="space-y-1">
                        {pos.occupants.map((occ) => (
                          <div key={occ.employee_id} className="flex items-center gap-1.5">
                            {assignmentBadge(occ.assignment_type)}
                            <span className="text-xs text-gray-700">{occ.full_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {pos.occupant_count}/{pos.max_occupants ?? "∞"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {pos.is_active
                      ? badge("Active", "bg-green-100 text-green-800")
                      : badge("Archived", "bg-gray-100 text-gray-500")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => openAssign(pos)}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => openEdit(pos)}
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openMove(pos)}
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Move
                      </button>
                      <button
                        onClick={() => openHistory(pos)}
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        History
                      </button>
                      {pos.is_active && (
                        <button
                          onClick={() => handleArchive(pos)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                        >
                          Archive
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

      {/* ── Create modal ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">New position</h2>
              <p className="text-xs text-gray-500 mt-0.5">Also appears immediately in Organisation → Role Hierarchy.</p>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {positionFormFields()}
              {formError && <Banner variant="error" className="mt-4">{formError}</Banner>}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0">
              <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Creating…" : "Create position"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      {editPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Edit — {editPos.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Changes also update the Role Hierarchy view.</p>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {positionFormFields()}
              {formError && <Banner variant="error" className="mt-4">{formError}</Banner>}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0">
              <Button variant="secondary" onClick={() => setEditPos(null)} disabled={saving}>Cancel</Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move / Restructure modal ──────────────────────────────────────── */}
      {movePos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Restructure — {movePos.name}</h2>
            <p className="text-sm text-gray-500 mb-5">
              Move this position to a new parent or cost centre. The Role Hierarchy tree updates automatically.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New cost centre</label>
                <select
                  value={mCostCenter}
                  onChange={(e) => setMCostCenter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No change —</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New reports-to</label>
                <select
                  value={mParent}
                  onChange={(e) => setMParent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No change / top-level —</option>
                  {positions.filter((p) => p.is_active && p.id !== movePos.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.cost_center_name ? ` · ${p.cost_center_name}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New name (optional)</label>
                <input
                  type="text"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={mEffectiveDate}
                  onChange={(e) => setMEffectiveDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason / notes</label>
                <textarea
                  value={mChangeReason}
                  onChange={(e) => setMChangeReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this position moving?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mRetrospective}
                    onChange={(e) => setMRetrospective(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-amber-800">Retrospective change</div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      The effective date is in the past. Transactions between that date and today will be
                      flagged for finance review. Historical GL entries are NOT auto-recoded.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            {moveError && <Banner variant="error" className="mt-4">{moveError}</Banner>}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setMovePos(null)} disabled={saving}>Cancel</Button>
              <Button onClick={handleMove} disabled={saving}>
                {saving ? "Moving…" : "Confirm move"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── History modal ─────────────────────────────────────────────────── */}
      {historyPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">History — {historyPos.name}</h2>
              <button onClick={() => setHistoryPos(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            {historyLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                <i className="ti ti-clock-history block mb-2" style={{ fontSize: 28 }} />
                <p>Full change history is recorded in the audit log.</p>
                <p className="text-xs mt-1">Audit log module coming in a future release.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assign employee modal ─────────────────────────────────────────── */}
      {assignPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Assign to — {assignPos.name}</h2>
            <p className="text-sm text-gray-500 mb-5">
              Substantive assignments close any previous substantive role.
              Acting / secondment adds a secondary assignment without closing the primary.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={aEmployee}
                  onChange={(e) => setAEmployee(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select employee —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}{emp.employee_code ? ` (${emp.employee_code})` : ""} — {emp.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignment type</label>
                  <select
                    value={aAssignType}
                    onChange={(e) => setAAssignType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ASSIGNMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={aTransferReason}
                    onChange={(e) => setATransferReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TRANSFER_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={aEffectiveDate}
                  onChange={(e) => setAEffectiveDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={aNotes}
                  onChange={(e) => setANotes(e.target.value)}
                  rows={2}
                  placeholder="Optional context for this assignment"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aRetrospective}
                    onChange={(e) => setARetrospective(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-amber-800">Retrospective assignment</div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      Effective date is in the past. Transactions between that date and today will be
                      flagged for review. Historical GL is not auto-recoded.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            {assignError && <Banner variant="error" className="mt-4">{assignError}</Banner>}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setAssignPos(null)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAssign} disabled={saving}>
                {saving ? "Assigning…" : "Confirm assignment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
