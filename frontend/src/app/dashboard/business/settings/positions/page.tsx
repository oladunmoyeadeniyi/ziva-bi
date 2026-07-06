"use client";

/**
 * Positions — /dashboard/business/settings/positions
 *
 * People v1: Position-based org model.
 * Allows tenant admins to:
 *   - View all positions with current occupants
 *   - Create new positions (linked to cost centre + org role)
 *   - Edit position metadata
 *   - Move a position (org restructure) with effective date + prospective/retrospective choice
 *   - Archive a position (blocked if occupied)
 *   - View position movement history
 *   - Assign an employee to a position (hire / transfer / acting / secondment)
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
  title: string;
  position_code: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  cost_center_code: string | null;
  parent_position_id: string | null;
  parent_position_title: string | null;
  org_role_id: string | null;
  org_role_name: string | null;
  function_code: string | null;
  grade: string | null;
  is_head_of_cost_center: boolean;
  max_occupants: number;
  is_active: boolean;
  occupants: PositionOccupant[];
  created_at: string;
}

interface PositionHistoryItem {
  id: string;
  old_cost_center_id: string | null;
  new_cost_center_id: string | null;
  old_title: string | null;
  new_title: string | null;
  effective_date: string;
  change_type: string;
  change_reason: string | null;
  is_retrospective: boolean;
  changed_by: string | null;
  created_at: string;
}

interface CostCenterOption {
  id: string;
  code: string;
  name: string;
}

interface OrgRole {
  id: string;
  name: string;
  level: number;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_code: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FUNCTION_CODES = ["finance", "hr", "procurement", "operations", "it", "sales", "legal", "audit"];
const ASSIGNMENT_TYPES = ["substantive", "acting", "secondment"] as const;
const TRANSFER_REASONS = ["hire", "promotion", "lateral", "restructure", "acting", "secondment", "termination"] as const;
const CHANGE_TYPES = ["restructure", "reclassify", "rename", "role_change"] as const;

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { token } = useAuth();

  // List state
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "archived">("active");
  const [searchQ, setSearchQ] = useState("");

  // Reference data
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [movePos, setMovePos] = useState<Position | null>(null);
  const [historyPos, setHistoryPos] = useState<Position | null>(null);
  const [assignPos, setAssignPos] = useState<Position | null>(null);
  const [history, setHistory] = useState<PositionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form state — create/edit
  const [fTitle, setFTitle] = useState("");
  const [fCode, setFCode] = useState("");
  const [fCostCenter, setFCostCenter] = useState("");
  const [fParent, setFParent] = useState("");
  const [fOrgRole, setFOrgRole] = useState("");
  const [fFunctionCode, setFFunctionCode] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fIsHead, setFIsHead] = useState(false);
  const [fMaxOccupants, setFMaxOccupants] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state — move
  const [mCostCenter, setMCostCenter] = useState("");
  const [mParent, setMParent] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mOrgRole, setMOrgRole] = useState("");
  const [mEffectiveDate, setMEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [mChangeType, setMChangeType] = useState<string>("restructure");
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
      const data = await apiFetch<Position[]>(`/api/hr/positions${qs}`, { token });
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
    // Load reference data once
    Promise.all([
      apiFetch<CostCenterOption[]>("/api/hr/cost-centers/options", { token }),
      apiFetch<OrgRole[]>("/api/hr/roles", { token }),
      apiFetch<{ employees: Employee[] }>("/api/hr/employees?limit=500", { token }),
    ])
      .then(([cc, roles, empData]) => {
        setCostCenters(cc);
        setOrgRoles(roles);
        setEmployees(empData.employees ?? []);
      })
      .catch(() => {/* non-fatal */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = positions.filter((p) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.position_code ?? "").toLowerCase().includes(q) ||
      (p.cost_center_name ?? "").toLowerCase().includes(q) ||
      (p.function_code ?? "").toLowerCase().includes(q)
    );
  });

  // ── CRUD actions ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setFTitle(""); setFCode(""); setFCostCenter(""); setFParent("");
    setFOrgRole(""); setFFunctionCode(""); setFGrade(""); setFIsHead(false); setFMaxOccupants(1);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = (pos: Position) => {
    setFTitle(pos.title);
    setFCode(pos.position_code ?? "");
    setFCostCenter(pos.cost_center_id ?? "");
    setFParent(pos.parent_position_id ?? "");
    setFOrgRole(pos.org_role_id ?? "");
    setFFunctionCode(pos.function_code ?? "");
    setFGrade(pos.grade ?? "");
    setFIsHead(pos.is_head_of_cost_center);
    setFMaxOccupants(pos.max_occupants);
    setFormError(null);
    setEditPos(pos);
  };

  const openMove = (pos: Position) => {
    setMCostCenter(pos.cost_center_id ?? "");
    setMParent(pos.parent_position_id ?? "");
    setMTitle(pos.title);
    setMOrgRole(pos.org_role_id ?? "");
    setMEffectiveDate(new Date().toISOString().split("T")[0]);
    setMChangeType("restructure");
    setMChangeReason("");
    setMRetrospective(false);
    setMoveError(null);
    setMovePos(pos);
  };

  const openHistory = async (pos: Position) => {
    setHistoryPos(pos);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const data = await apiFetch<PositionHistoryItem[]>(`/api/hr/positions/${pos.id}/history`, { token });
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
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

  const handleCreate = async () => {
    if (!fTitle.trim()) { setFormError("Title is required."); return; }
    setSaving(true); setFormError(null);
    try {
      await apiFetch("/api/hr/positions", {
        token,
        method: "POST",
        body: {
          title: fTitle.trim(),
          position_code: fCode.trim() || undefined,
          cost_center_id: fCostCenter || undefined,
          parent_position_id: fParent || undefined,
          org_role_id: fOrgRole || undefined,
          function_code: fFunctionCode || undefined,
          grade: fGrade.trim() || undefined,
          is_head_of_cost_center: fIsHead,
          max_occupants: fMaxOccupants,
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
    setSaving(true); setFormError(null);
    try {
      await apiFetch(`/api/hr/positions/${editPos.id}`, {
        token,
        method: "PATCH",
        body: {
          title: fTitle.trim() || undefined,
          position_code: fCode.trim() || undefined,
          cost_center_id: fCostCenter || undefined,
          parent_position_id: fParent || undefined,
          org_role_id: fOrgRole || undefined,
          function_code: fFunctionCode || undefined,
          grade: fGrade.trim() || undefined,
          is_head_of_cost_center: fIsHead,
          max_occupants: fMaxOccupants,
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
    if (!confirm(`Archive position "${pos.title}"? This cannot be undone unless re-activated manually.`)) return;
    try {
      await apiFetch(`/api/hr/positions/${pos.id}`, { token, method: "DELETE" });
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
        token,
        method: "POST",
        body: {
          new_cost_center_id: mCostCenter || undefined,
          new_parent_position_id: mParent || undefined,
          new_title: mTitle !== movePos.title ? mTitle : undefined,
          new_org_role_id: mOrgRole !== movePos.org_role_id ? mOrgRole || undefined : undefined,
          effective_date: mEffectiveDate,
          change_type: mChangeType,
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
        token,
        method: "POST",
        body: {
          position_id: assignPos.id,
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

  // ── Shared form UI ──────────────────────────────────────────────────────────

  const positionFormFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={fTitle}
          onChange={(e) => setFTitle(e.target.value)}
          placeholder="e.g. Head of Finance"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position code</label>
          <input
            type="text"
            value={fCode}
            onChange={(e) => setFCode(e.target.value)}
            placeholder="Auto-generated if blank"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade / band</label>
          <input
            type="text"
            value={fGrade}
            onChange={(e) => setFGrade(e.target.value)}
            placeholder="e.g. L5, Senior"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cost centre</label>
        <select
          value={fCostCenter}
          onChange={(e) => setFCostCenter(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— None —</option>
          {costCenters.map((cc) => (
            <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reports to (parent position)</label>
        <select
          value={fParent}
          onChange={(e) => setFParent(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— None (top-level) —</option>
          {positions.filter((p) => p.is_active).map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Org role (approval authority)</label>
          <select
            value={fOrgRole}
            onChange={(e) => setFOrgRole(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— None —</option>
            {orgRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Function</label>
          <select
            value={fFunctionCode}
            onChange={(e) => setFFunctionCode(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— None —</option>
            {FUNCTION_CODES.map((fc) => (
              <option key={fc} value={fc}>{fc.charAt(0).toUpperCase() + fc.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max occupants</label>
          <input
            type="number"
            min={1}
            max={50}
            value={fMaxOccupants}
            onChange={(e) => setFMaxOccupants(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={fIsHead}
              onChange={(e) => setFIsHead(e.target.checked)}
              className="rounded"
            />
            Head of cost centre
          </label>
        </div>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <PageHeading
        title="Positions"
        subtitle="Position-based org model — durable slots that survive attrition. Assign employees to positions; approval routing and GL coding follow the position."
        actions={
          <Button onClick={openCreate} size="sm">
            + New position
          </Button>
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

      {error && <Banner type="error" message={error} className="mb-4" />}

      {/* Positions table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading positions…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium mb-1">No positions yet</p>
          <p className="text-sm">Create your first position to start building the org structure.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Position</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cost centre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reports to</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Org role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Occupants</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((pos) => (
                <tr key={pos.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{pos.title}</div>
                    {pos.position_code && (
                      <div className="text-xs text-gray-400 font-mono">{pos.position_code}</div>
                    )}
                    {pos.function_code && (
                      <div className="text-xs text-gray-500 mt-0.5">{pos.function_code}</div>
                    )}
                    {pos.is_head_of_cost_center && (
                      <span className="inline-block mt-0.5 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                        Head of CC
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {pos.cost_center_name ?? <span className="text-gray-300">—</span>}
                    {pos.cost_center_code && (
                      <div className="text-xs text-gray-400 font-mono">{pos.cost_center_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {pos.parent_position_title ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {pos.org_role_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {pos.occupants.length === 0 ? (
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
                      {pos.occupants.length}/{pos.max_occupants}
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
                        title="Assign employee"
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => openEdit(pos)}
                        title="Edit"
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openMove(pos)}
                        title="Restructure / move"
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Move
                      </button>
                      <button
                        onClick={() => openHistory(pos)}
                        title="History"
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        History
                      </button>
                      {pos.is_active && (
                        <button
                          onClick={() => handleArchive(pos)}
                          title="Archive"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">New position</h2>
            {positionFormFields()}
            {formError && <Banner type="error" message={formError} className="mt-4" />}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Edit — {editPos.title}</h2>
            {positionFormFields()}
            {formError && <Banner type="error" message={formError} className="mt-4" />}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditPos(null)} disabled={saving}>Cancel</Button>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Restructure — {movePos.title}</h2>
            <p className="text-sm text-gray-500 mb-5">
              Moving a position updates its cost centre and/or parent in the hierarchy.
              Transactions before the effective date are unaffected.
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
                    <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New parent position</label>
                <select
                  value={mParent}
                  onChange={(e) => setMParent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No change / top-level —</option>
                  {positions.filter((p) => p.is_active && p.id !== movePos.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New title (optional)</label>
                <input
                  type="text"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Change type</label>
                  <select
                    value={mChangeType}
                    onChange={(e) => setMChangeType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CHANGE_TYPES.map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
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
            {moveError && <Banner type="error" message={moveError} className="mt-4" />}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setMovePos(null)} disabled={saving}>Cancel</Button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">History — {historyPos.title}</h2>
              <button onClick={() => setHistoryPos(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            {historyLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No history recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{h.change_type}</span>
                      <span className="text-gray-500">{h.effective_date}</span>
                      {h.is_retrospective && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">retrospective</span>
                      )}
                    </div>
                    {h.old_title && h.new_title && h.old_title !== h.new_title && (
                      <div className="text-gray-600">Title: <span className="line-through text-gray-400">{h.old_title}</span> → <strong>{h.new_title}</strong></div>
                    )}
                    {h.new_cost_center_id && (
                      <div className="text-gray-600">Cost centre changed</div>
                    )}
                    {h.change_reason && (
                      <div className="text-gray-500 mt-1 italic">"{h.change_reason}"</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">{new Date(h.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assign employee modal ─────────────────────────────────────────── */}
      {assignPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Assign to — {assignPos.title}</h2>
            <p className="text-sm text-gray-500 mb-5">
              For substantive assignments, the employee&apos;s previous substantive assignment will be closed.
              Acting/secondment adds a secondary assignment without closing the primary.
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
            {assignError && <Banner type="error" message={assignError} className="mt-4" />}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setAssignPos(null)} disabled={saving}>Cancel</Button>
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
