"use client";

/**
 * Approval Workflows -- /dashboard/business/settings/approval-matrix
 *
 * Two tabs:
 *   Approver Roles  -- org-wide registry (Line Manager, CFO, etc.)
 *   Module Policies -- per-module routing config (org_tree | requestor_selects | direct_to_hod)
 *                      + finance review chain + role thresholds + vacant-seat behaviour
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

type Tab = "roles" | "policies";

interface ApprovalRole {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
  approval_role_id: string | null;
  user_id: string | null;
}

interface ThresholdRow {
  approval_role_id: string;
  role_name: string;
  max_amount: string;
}

interface ApprovalPolicy {
  id: string;
  module: string;
  routing_mode: string;
  ceiling_role_id: string | null;
  ceiling_role_name: string | null;
  vacant_seat_behavior: string;
  fallback_approver_id: string | null;
  requires_finance_review: boolean;
  finance_levels: number;
  finance_l1_role_id: string | null;
  finance_l2_role_id: string | null;
  finance_l3_role_id: string | null;
  finance_amount_threshold_l2: string | null;
  finance_amount_threshold_l3: string | null;
  is_active: boolean;
  thresholds: {
    id: string;
    approval_role_id: string;
    role_name: string;
    max_amount: string | null;
  }[];
}

const MODULE_POLICIES = [
  { key: "expense", label: "Expense Management", icon: "ti-receipt", description: "Approval routing for employee expense reports.", active: true },
  { key: "payable", label: "Accounts Payable", icon: "ti-building-bank", description: "Invoice and payment approval chains.", active: false },
  { key: "receivable", label: "Accounts Receivable", icon: "ti-cash", description: "Credit note and write-off approvals.", active: false },
  { key: "payroll", label: "Payroll", icon: "ti-users", description: "Payroll run approval before disbursement.", active: false },
  { key: "budget", label: "Budget", icon: "ti-chart-bar", description: "Budget submission and revision approvals.", active: false },
];

const ROUTING_MODES = [
  { value: "org_tree", label: "Org-tree traversal", desc: "Auto-route up the reporting hierarchy. Thresholds control how far it escalates." },
  { value: "requestor_selects", label: "Requestor selects approver", desc: "The submitter picks their approver. System validates they are above them in hierarchy." },
  { value: "direct_to_hod", label: "Direct to Head of Department", desc: "Skip intermediate managers -- route straight to the HOD of the submitter's department." },
];

const VACANT_OPTIONS = [
  { value: "skip", label: "Skip -- bypass the vacant step and continue" },
  { value: "hold", label: "Hold -- pause the chain until the seat is filled" },
  { value: "escalate_to_fallback", label: "Escalate to fallback approver" },
];

function TabBtn({ id, active, onClick, label }: { id: Tab; active: boolean; onClick: (t: Tab) => void; label: string }) {
  return (
    <button type="button" onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{children}</p>;
}

export default function ApprovalWorkflowsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("roles");
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<ApprovalRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [editingRole, setEditingRole] = useState<ApprovalRole | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ApprovalRole | null>(null);

  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>("expense");

  const [routingMode, setRoutingMode] = useState("org_tree");
  const [ceilingRoleId, setCeilingRoleId] = useState("");
  const [vacantBehavior, setVacantBehavior] = useState("skip");
  const [fallbackApproverId, setFallbackApproverId] = useState("");
  const [requiresFinanceReview, setRequiresFinanceReview] = useState(false);
  const [financeLevels, setFinanceLevels] = useState<0 | 1 | 2 | 3>(0);
  const [financeL1RoleId, setFinanceL1RoleId] = useState("");
  const [financeL2RoleId, setFinanceL2RoleId] = useState("");
  const [financeL3RoleId, setFinanceL3RoleId] = useState("");
  const [financeThreshL2, setFinanceThreshL2] = useState("");
  const [financeThreshL3, setFinanceThreshL3] = useState("");
  const [thresholds, setThresholds] = useState<ThresholdRow[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  // Org-sync: maps approval_role_id -> "First Last" of whoever holds that role
  const [roleHolders, setRoleHolders] = useState<Record<string, string>>({});
  // All employees, for fallback approver picker
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);

  const activeRoles = roles.filter((r) => r.is_active);

  const loadRoles = useCallback(async () => {
    if (!accessToken) return;
    setLoadingRoles(true);
    try {
      const data = await apiFetch<ApprovalRole[]>("/api/approvals/roles", { token: accessToken });
      setRoles(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load roles"); }
    finally { setLoadingRoles(false); }
  }, [accessToken]);

  const loadPolicies = useCallback(async () => {
    if (!accessToken) return;
    setLoadingPolicies(true);
    try {
      const [data, emps] = await Promise.all([
        apiFetch<ApprovalPolicy[]>("/api/approvals/policies", { token: accessToken }),
        apiFetch<EmployeeOption[]>("/api/hr/employees?active_only=true", { token: accessToken }).catch(() => [] as EmployeeOption[]),
      ]);
      setPolicies(data);
      setEmployeeOptions(emps);
      // Build role holders map: approval_role_id -> "First Last"
      const holders: Record<string, string> = {};
      for (const e of emps) {
        if (e.approval_role_id) {
          // If multiple employees share a role, show the first alphabetically
          if (!holders[e.approval_role_id]) {
            holders[e.approval_role_id] = `${e.first_name} ${e.last_name}`;
          } else {
            holders[e.approval_role_id] += `, ${e.first_name} ${e.last_name}`;
          }
        }
      }
      setRoleHolders(holders);
      const ep = data.find((p) => p.module === "expense");
      if (ep) {
        setRoutingMode(ep.routing_mode);
        setCeilingRoleId(ep.ceiling_role_id ?? "");
        setVacantBehavior(ep.vacant_seat_behavior);
        setFallbackApproverId(ep.fallback_approver_id ?? "");
        setRequiresFinanceReview(ep.requires_finance_review);
        setFinanceLevels(ep.finance_levels as 0 | 1 | 2 | 3);
        setFinanceL1RoleId(ep.finance_l1_role_id ?? "");
        setFinanceL2RoleId(ep.finance_l2_role_id ?? "");
        setFinanceL3RoleId(ep.finance_l3_role_id ?? "");
        setFinanceThreshL2(ep.finance_amount_threshold_l2 ?? "");
        setFinanceThreshL3(ep.finance_amount_threshold_l3 ?? "");
        setThresholds(ep.thresholds.map((t) => ({ approval_role_id: t.approval_role_id, role_name: t.role_name, max_amount: t.max_amount ?? "" })));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load policies"); }
    finally { setLoadingPolicies(false); }
  }, [accessToken]);

  useEffect(() => { if (tab === "roles") loadRoles(); }, [tab, loadRoles]);
  useEffect(() => { if (tab === "policies") { loadRoles(); loadPolicies(); } }, [tab, loadRoles, loadPolicies]);

  const createRole = async () => {
    if (!accessToken || !newName.trim()) return;
    setSavingRole(true); setError(null);
    try {
      const role = await apiFetch<ApprovalRole>("/api/approvals/roles", {
        method: "POST", token: accessToken,
        body: { name: newName.trim(), description: newDesc.trim() || null, display_order: roles.length },
      });
      setRoles((prev) => [...prev, role]);
      setNewName(""); setNewDesc(""); setShowAddForm(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to create role"); }
    finally { setSavingRole(false); }
  };

  const saveRole = async (role: ApprovalRole) => {
    if (!accessToken) return;
    setSavingRole(true); setError(null);
    try {
      const updated = await apiFetch<ApprovalRole>(`/api/approvals/roles/${role.id}`, {
        method: "PATCH", token: accessToken,
        body: { name: role.name, description: role.description, is_active: role.is_active },
      });
      setRoles((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setEditingRole(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save role"); }
    finally { setSavingRole(false); }
  };

  const deleteRole = async (role: ApprovalRole) => {
    if (!accessToken) return;
    setSavingRole(true); setError(null);
    try {
      await apiFetch(`/api/approvals/roles/${role.id}`, { method: "DELETE", token: accessToken });
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      setPendingDelete(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to delete role"); }
    finally { setSavingRole(false); }
  };

  const addThresholdRow = (roleId: string) => {
    const role = activeRoles.find((r) => r.id === roleId);
    if (!role || thresholds.some((t) => t.approval_role_id === roleId)) return;
    setThresholds((prev) => [...prev, { approval_role_id: roleId, role_name: role.name, max_amount: "" }]);
  };

  const updateThresholdAmount = (roleId: string, amount: string) => {
    setThresholds((prev) => prev.map((t) => t.approval_role_id === roleId ? { ...t, max_amount: amount } : t));
  };

  const removeThreshold = (roleId: string) => {
    setThresholds((prev) => prev.filter((t) => t.approval_role_id !== roleId));
  };

  const savePolicy = async (module: string) => {
    if (!accessToken) return;
    setSavingPolicy(true); setError(null);
    try {
      const body = {
        module,
        routing_mode: routingMode,
        ceiling_role_id: ceilingRoleId || null,
        vacant_seat_behavior: vacantBehavior,
        fallback_approver_id: vacantBehavior === "escalate_to_fallback" ? (fallbackApproverId || null) : null,
        requires_finance_review: requiresFinanceReview,
        finance_levels: requiresFinanceReview ? financeLevels : 0,
        finance_l1_role_id: requiresFinanceReview && financeLevels >= 1 ? (financeL1RoleId || null) : null,
        finance_l2_role_id: requiresFinanceReview && financeLevels >= 2 ? (financeL2RoleId || null) : null,
        finance_l3_role_id: requiresFinanceReview && financeLevels >= 3 ? (financeL3RoleId || null) : null,
        finance_amount_threshold_l2: requiresFinanceReview && financeLevels >= 2 && financeThreshL2 ? parseFloat(financeThreshL2) : null,
        finance_amount_threshold_l3: requiresFinanceReview && financeLevels >= 3 && financeThreshL3 ? parseFloat(financeThreshL3) : null,
        thresholds: thresholds.map((t) => ({ approval_role_id: t.approval_role_id, max_amount: t.max_amount ? parseFloat(t.max_amount) : null })),
      };
      const saved = await apiFetch<ApprovalPolicy>("/api/approvals/policies", { method: "POST", token: accessToken, body });
      setPolicies((prev) => {
        const existing = prev.find((p) => p.module === module);
        return existing ? prev.map((p) => p.module === module ? saved : p) : [...prev, saved];
      });
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 2500);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save policy"); }
    finally { setSavingPolicy(false); }
  };

  const expensePolicy = policies.find((p) => p.module === "expense");
  const isConfigured = (module: string) => policies.some((p) => p.module === module && p.is_active);

  return (
    <PageContainer maxWidth="3xl">
      <button type="button" onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <PageHeading title="Approval workflows" />
      <p className="text-sm text-gray-500 mb-6">
        Define approver roles for your organisation, then configure routing rules per module.
      </p>

      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="roles" active={tab === "roles"} onClick={setTab} label="Approver roles" />
        <TabBtn id="policies" active={tab === "policies"} onClick={setTab} label="Module policies" />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg font-bold">&times;</button>
        </div>
      )}

      {/* Approver Roles tab */}
      {tab === "roles" && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            Roles defined here are used across all modules to identify who can approve.
            Each module policy references these roles for routing and finance review.
          </div>

          {loadingRoles ? (
            <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {roles.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 italic text-center">No roles yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {roles.map((role) => (
                    <div key={role.id} className="px-4 py-3">
                      {editingRole?.id === role.id ? (
                        <div className="space-y-2">
                          <input value={editingRole.name}
                            onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                            className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <input value={editingRole.description ?? ""}
                            onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value || null })}
                            placeholder="Description (optional)"
                            className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => saveRole(editingRole)} disabled={savingRole}
                              className="text-xs font-medium bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                              {savingRole ? "Saving..." : "Save"}
                            </button>
                            <button type="button" onClick={() => setEditingRole(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${role.is_active ? "text-gray-800" : "text-gray-400 line-through"}`}>{role.name}</p>
                              {!role.is_active && <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1">Inactive</span>}
                            </div>
                            {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => setEditingRole(role)} className="text-xs text-gray-400 hover:text-blue-600">
                              <i className="ti ti-pencil" style={{ fontSize: 13 }} />
                            </button>
                            <button type="button" onClick={() => saveRole({ ...role, is_active: !role.is_active })}
                              className={`text-xs transition-colors ${role.is_active ? "text-gray-400 hover:text-amber-500" : "text-gray-300 hover:text-green-600"}`}
                              title={role.is_active ? "Deactivate" : "Activate"}>
                              <i className={`ti ti-${role.is_active ? "eye-off" : "eye"}`} style={{ fontSize: 13 }} />
                            </button>
                            <button type="button" onClick={() => setPendingDelete(role)} className="text-xs text-gray-300 hover:text-red-500">
                              <i className="ti ti-trash" style={{ fontSize: 13 }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {showAddForm && (
                <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 space-y-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Role name e.g. Board Secretary"
                    className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex gap-2">
                    <button type="button" onClick={createRole} disabled={savingRole || !newName.trim()}
                      className="text-xs font-medium bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                      {savingRole ? "Adding..." : "Add role"}
                    </button>
                    <button type="button" onClick={() => { setShowAddForm(false); setNewName(""); setNewDesc(""); }}
                      className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!showAddForm && (
            <button type="button" onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add role
            </button>
          )}
        </div>
      )}

      {/* Module Policies tab */}
      {tab === "policies" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Configure approval routing per module. Inactive modules become configurable once activated.
          </p>
          {loadingPolicies ? (
            <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : (
            MODULE_POLICIES.map((mod) => {
              const isExpanded = expandedModule === mod.key;
              const configured = isConfigured(mod.key);
              return (
                <div key={mod.key} className={`border rounded-lg overflow-hidden ${mod.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                  <button type="button"
                    onClick={() => { if (mod.active) setExpandedModule(isExpanded ? null : mod.key); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${mod.active ? "hover:bg-gray-50 cursor-pointer" : "cursor-not-allowed"}`}>
                    <div className="flex items-center gap-3">
                      <i className={`ti ${mod.icon} text-gray-400`} style={{ fontSize: 16 }} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{mod.label}</p>
                        <p className="text-xs text-gray-400">{mod.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!mod.active && <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Module not active</span>}
                      {mod.active && (
                        <>
                          {configured
                            ? <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">Configured</span>
                            : <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Not configured</span>}
                          <i className={`ti ti-chevron-${isExpanded ? "up" : "down"} text-gray-400`} style={{ fontSize: 12 }} />
                        </>
                      )}
                    </div>
                  </button>

                  {mod.key === "expense" && isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-5 bg-white space-y-6">
                      {policySaved && <p className="text-xs text-green-600 font-medium">Policy saved successfully.</p>}
                      {activeRoles.length === 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                          No active approver roles found. Define roles in the Approver roles tab first.
                        </div>
                      )}

                      <div>
                        <SectionLabel>Routing mode</SectionLabel>
                        <div className="space-y-2">
                          {ROUTING_MODES.map((rm) => (
                            <label key={rm.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${routingMode === rm.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                              <input type="radio" name="routing_mode" value={rm.value} checked={routingMode === rm.value}
                                onChange={() => setRoutingMode(rm.value)} className="accent-blue-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-gray-800">{rm.label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{rm.desc}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {routingMode === "org_tree" && (
                        <div>
                          <SectionLabel>Ceiling role (org-tree stops here)</SectionLabel>
                          <p className="text-xs text-gray-400 mb-2">
                            Traversal stops when it reaches someone holding this role. They are always the final management approver.
                          </p>
                          <select value={ceilingRoleId} onChange={(e) => setCeilingRoleId(e.target.value)}
                            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="">-- No ceiling (traverse to the top) --</option>
                            {activeRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                          {ceilingRoleId && (
                            <p className="text-xs mt-1.5">
                              {roleHolders[ceilingRoleId]
                                ? <span className="text-indigo-700"><i className="ti ti-shield-check" /> Held by: <span className="font-medium">{roleHolders[ceilingRoleId]}</span></span>
                                : <span className="text-amber-600"><i className="ti ti-alert-triangle" /> No employee assigned this role yet</span>}
                            </p>
                          )}
                        </div>
                      )}

                      {routingMode === "org_tree" && (
                        <div>
                          <SectionLabel>Amount thresholds per role</SectionLabel>
                          <p className="text-xs text-gray-400 mb-3">
                            Escalation stops when the current approver role covers the amount. Leave blank = no limit (ceiling role).
                          </p>
                          {thresholds.length > 0 && (
                            <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Role</th>
                                    <th className="px-3 py-2 text-left font-medium">Max amount (blank = no limit)</th>
                                    <th className="px-3 py-2 w-8" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {thresholds.map((t) => (
                                    <tr key={t.approval_role_id}>
                                      <td className="px-3 py-2 text-gray-800">{t.role_name}</td>
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                          <span className="text-gray-400 text-xs">N</span>
                                          <input type="number" min="0" step="1000" value={t.max_amount}
                                            onChange={(e) => updateThresholdAmount(t.approval_role_id, e.target.value)}
                                            placeholder="No limit"
                                            className="w-40 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <button type="button" onClick={() => removeThreshold(t.approval_role_id)} className="text-gray-300 hover:text-red-500">
                                          <i className="ti ti-x" style={{ fontSize: 12 }} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) { addThresholdRow(e.target.value); e.target.value = ""; } }}>
                            <option value="">+ Add role threshold...</option>
                            {activeRoles.filter((r) => !thresholds.some((t) => t.approval_role_id === r.id))
                              .map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      )}

                      <div>
                        <SectionLabel>When an approver seat is vacant</SectionLabel>
                        <select value={vacantBehavior} onChange={(e) => setVacantBehavior(e.target.value)}
                          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          {VACANT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {vacantBehavior === "escalate_to_fallback" && (
                          <div className="mt-3">
                            <label className="block text-xs text-gray-500 mb-1">Fallback approver</label>
                            <select value={fallbackApproverId} onChange={(e) => setFallbackApproverId(e.target.value)}
                              className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              <option value="">-- Select employee --</option>
                              {employeeOptions.filter(e => e.user_id).map((e) => (
                                <option key={e.user_id!} value={e.user_id!}>{e.first_name} {e.last_name}</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">Only employees with a portal account can be a fallback approver.</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <SectionLabel>Finance review</SectionLabel>
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                          <input type="checkbox" checked={requiresFinanceReview}
                            onChange={(e) => { setRequiresFinanceReview(e.target.checked); if (!e.target.checked) setFinanceLevels(0); }}
                            className="accent-blue-600" />
                          <span className="text-sm text-gray-700">Require finance review after management approval</span>
                        </label>

                        {requiresFinanceReview && (
                          <div className="pl-6 space-y-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Number of finance review levels</label>
                              <div className="flex gap-2">
                                {([1, 2, 3] as const).map((n) => (
                                  <label key={n} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 cursor-pointer text-sm transition-colors ${financeLevels === n ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                                    <input type="radio" name="finance_levels" value={n} checked={financeLevels === n}
                                      onChange={() => setFinanceLevels(n)} className="accent-blue-600" />
                                    {n}
                                  </label>
                                ))}
                              </div>
                            </div>

                            {([1, 2, 3] as const).filter((n) => n <= financeLevels).map((n) => {
                              const roleId = n === 1 ? financeL1RoleId : n === 2 ? financeL2RoleId : financeL3RoleId;
                              const setRoleId = n === 1 ? setFinanceL1RoleId : n === 2 ? setFinanceL2RoleId : setFinanceL3RoleId;
                              const thresh = n === 2 ? financeThreshL2 : n === 3 ? financeThreshL3 : null;
                              const setThresh = n === 2 ? setFinanceThreshL2 : n === 3 ? setFinanceThreshL3 : null;
                              return (
                                <div key={n} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                                  <p className="text-xs font-semibold text-gray-600">Finance level {n}</p>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Role</label>
                                    <select value={roleId} onChange={(e) => setRoleId(e.target.value)}
                                      className="w-full max-w-xs px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                      <option value="">-- Select role --</option>
                                      {activeRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    {roleId && (
                                      <p className="text-xs mt-1">
                                        {roleHolders[roleId]
                                          ? <span className="text-indigo-700"><i className="ti ti-shield-check" /> Held by: <span className="font-medium">{roleHolders[roleId]}</span></span>
                                          : <span className="text-amber-600"><i className="ti ti-alert-triangle" /> No employee assigned this role yet</span>}
                                      </p>
                                    )}
                                  </div>
                                  {thresh !== null && setThresh && (
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">
                                        Amount threshold <span className="text-gray-400">(skip this level if amount is below threshold)</span>
                                      </label>
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-400 text-xs">N</span>
                        