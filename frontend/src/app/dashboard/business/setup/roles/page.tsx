"use client";

/**
 * Roles & Permissions page — M8.2 Implementation Portal.
 *
 * 2 tabs: Role tiers | User assignments
 * - ZivaBI Consultant: always full access (locked, no config)
 * - Tenant Power Admin: full access by default, but each person's scope is tweakable
 * - Functional Admin: per-user scope — which sections + at what level (Full / Read only / No access)
 * - CC heads auto-populate Functional Admin (top-level only)
 * - Staff grouped by cost center, collapsible, click-to-add as Functional Admin
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

type Tab = "tiers" | "assignments";

interface Assignment {
  id: string;
  user_id: string;
  user_tenant_id: string;
  full_name: string;
  email: string;
  role_tier: string | null;
  is_active: boolean;
}

interface CCConfig {
  id: string;
  cost_center_id: string;
  cost_center_name: string | null;
  cost_center_code: string | null;
  parent_id: string | null;
  head_user_id: string | null;
  head_user_name: string | null;
}

interface EmployeeItem {
  email: string;
  cost_center_id: string | null;
  cost_center_name: string | null;
}

// Sections for Tenant Power Admin scope (full suite)
const PA_SCOPE_SECTIONS = [
  "Organisation",
  "Module activation",
  "Chart of accounts",
  "Dimensions",
  "Employees",
  "Currencies & FX",
  "Tax & statutory",
  "Roles & permissions",   // PA only; defaults to none — Consultant grants this
  "Approval workflows",
  "Document rules",
  "Module setup",
];

// "Roles & permissions" defaults to no access for PA (only Consultant should grant it)
const PA_SECTION_DEFAULTS: Record<string, string> = {
  "Roles & permissions": "none",
};

// Sections for Functional Admin scope — module-level config only.
// Global sections (Organisation, Currencies & FX, Tax & statutory, Roles & permissions,
// Module activation, Module setup) are PA/Consultant territory and never appear here.
// Employees stays here because it is cross-module foundational (Expense, AP, Payroll, etc.)
// regardless of whether the HR module is subscribed.
const FA_SCOPE_SECTIONS = [
  "Chart of accounts",
  "Dimensions",
  "Employees",
  "Approval workflows",
  "Document rules",
];

const TIER_BADGE: Record<string, string> = {
  consultant:       "bg-amber-100 text-amber-800 border border-amber-300",
  power_admin:      "bg-blue-100 text-blue-800 border border-blue-300",
  functional_admin: "bg-green-100 text-green-800 border border-green-300",
};

const ACCESS_LEVELS = ["full", "read_only", "none"] as const;
type AccessLevel = typeof ACCESS_LEVELS[number];
const ACCESS_LABEL: Record<string, string> = { full: "Full access", read_only: "Read only", none: "No access" };
const ACCESS_PILL: Record<string, string> = {
  full:      "bg-green-600 text-white border border-green-600 hover:bg-green-700",
  read_only: "bg-blue-600  text-white border border-blue-600  hover:bg-blue-700",
  none:      "bg-white     text-gray-500 border border-gray-300 hover:bg-gray-50",
};

function TabBtn({ id, active, onClick, label }: { id: Tab; active: boolean; onClick: (t: Tab) => void; label: string }) {
  return (
    <button type="button" onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
      {label}
    </button>
  );
}

function RolesContent() {
  const { accessToken, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "tiers");
  const [error, setError] = useState<string | null>(null);
  const isExpired = error === "Invalid or expired token.";

  const handleTabChange = (t: Tab) => { setTab(t); setError(null); router.replace(`?tab=${t}`, { scroll: false }); };

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [ccConfigs,   setCcConfigs]   = useState<CCConfig[]>([]);
  const [employees,   setEmployees]   = useState<EmployeeItem[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [addingToTier, setAddingToTier] = useState<string | null>(null);

  // Scope per user: assignmentId → { section → access_level }
  const [scopeMap,    setScopeMap]    = useState<Record<string, Record<string, string>>>({});
  const [openScope,   setOpenScope]   = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState(false);

  // Pending removal confirmation
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);

  // Collapsed CC groups in staff section
  const [collapsedCCs, setCollapsedCCs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!accessToken || tab !== "assignments") return;
    Promise.all([
      apiFetch<Assignment[]>("/api/setup/roles/assignments", { token: accessToken }),
      apiFetch<CCConfig[]>("/api/hr/cost-centers", { token: accessToken }).catch(() => [] as CCConfig[]),
      apiFetch<EmployeeItem[]>("/api/hr/employees", { token: accessToken }).catch(() => [] as EmployeeItem[]),
    ]).then(([a, cc, emps]) => {
      setAssignments(a);
      setCcConfigs(cc);
      setEmployees(emps);
      const grouped: Record<string, boolean> = {};
      for (const emp of emps) { if (emp.cost_center_name) grouped[emp.cost_center_name] = true; }
      grouped["— No cost center"] = true;
      setCollapsedCCs(grouped);
    }).catch((e) => setError(e.message));
  }, [accessToken, tab]);

  const saveAssignment = async (id: string, tier: string | null) => {
    if (!accessToken) return;
    setSaving(true); setError(null);
    try {
      const updated = await apiFetch<Assignment>(`/api/setup/roles/assignments/${id}`, {
        method: "PATCH", token: accessToken, body: { role_tier: tier ?? null },
      });
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, role_tier: updated.role_tier } : a));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  /**
   * Load scope for an assignment.
   * PA sections default to "full" except those listed in PA_SECTION_DEFAULTS.
   * FA sections all default to "none".
   * Saved values from the backend always override defaults.
   */
  const loadScope = async (a: Assignment) => {
    if (!accessToken || scopeMap[a.id] !== undefined) return;
    const isPA = a.role_tier === "power_admin";
    const sections = isPA ? PA_SCOPE_SECTIONS : FA_SCOPE_SECTIONS;
    // Build default map
    const initMap: Record<string, string> = {};
    for (const sec of sections) {
      initMap[sec] = isPA ? (PA_SECTION_DEFAULTS[sec] ?? "full") : "none";
    }
    try {
      const d = await apiFetch<{ sections: { section: string; access_level: string }[] }>(
        `/api/setup/roles/assignments/${a.id}/scope`, { token: accessToken }
      );
      for (const item of d.sections) initMap[item.section] = item.access_level;
    } catch { /* keep defaults on error */ }
    setScopeMap((prev) => ({ ...prev, [a.id]: initMap }));
  };

  const toggleScope = async (a: Assignment) => {
    if (openScope === a.id) { setOpenScope(null); return; }
    setOpenScope(a.id);
    await loadScope(a);
  };

  const cycleScopeSection = (assignmentId: string, section: string) => {
    setScopeMap((prev) => {
      const current = prev[assignmentId] ?? {};
      const currentLevel = current[section] ?? "none";
      // Cycle: none → read_only → full → none
      const next = currentLevel === "none" ? "read_only" : currentLevel === "read_only" ? "full" : "none";
      return { ...prev, [assignmentId]: { ...current, [section]: next } };
    });
  };

  const saveScope = async (assignmentId: string) => {
    if (!accessToken) return;
    setSavingScope(true);
    try {
      const sectionMap = scopeMap[assignmentId] ?? {};
      // Omit "none" sections from the payload
      const sections = Object.entries(sectionMap)
        .filter(([, level]) => level !== "none")
        .map(([section, access_level]) => ({ section, access_level }));
      await apiFetch(`/api/setup/roles/assignments/${assignmentId}/scope`, {
        method: "PATCH", token: accessToken, body: { sections },
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Scope save failed"); }
    finally { setSavingScope(false); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────────

  const empCcByEmail: Record<string, { id: string | null; name: string | null }> = {};
  for (const emp of employees) empCcByEmail[emp.email.toLowerCase()] = { id: emp.cost_center_id, name: emp.cost_center_name };

  const getUserCcName = (a: Assignment): string | null => empCcByEmail[a.email.toLowerCase()]?.name ?? null;

  const groupByCc = (list: Assignment[]): Record<string, Assignment[]> => {
    const groups: Record<string, Assignment[]> = {};
    for (const a of list) { const cc = getUserCcName(a) ?? "— No cost center"; groups[cc] = [...(groups[cc] ?? []), a]; }
    return groups;
  };

  const allCcNodeIds    = new Set(ccConfigs.map((cc) => cc.cost_center_id));
  const topLevelCCs     = ccConfigs.filter((cc) => !cc.parent_id || !allCcNodeIds.has(cc.parent_id));
  const headCcNames: Record<string, string[]> = {};
  for (const cc of topLevelCCs) {
    if (cc.head_user_id && cc.cost_center_name)
      headCcNames[cc.head_user_id] = [...(headCcNames[cc.head_user_id] ?? []), cc.cost_center_name];
  }
  const topLevelHeadUserIds = new Set(Object.keys(headCcNames));
  const allCcHeadUserIds    = new Set(ccConfigs.filter((cc) => cc.head_user_id).map((cc) => cc.head_user_id!));
  const allHeadCcNames: Record<string, string[]> = {};
  for (const cc of ccConfigs) {
    if (cc.head_user_id && cc.cost_center_name)
      allHeadCcNames[cc.head_user_id] = [...(allHeadCcNames[cc.head_user_id] ?? []), cc.cost_center_name];
  }

  const autoFunctionalAdmins     = assignments.filter((a) => topLevelHeadUserIds.has(a.user_id) && a.role_tier !== "power_admin" && a.role_tier !== "consultant" && a.is_active);
  const explicitFunctionalAdmins = assignments.filter((a) => a.role_tier === "functional_admin" && !topLevelHeadUserIds.has(a.user_id) && a.is_active);
  const eligibleForFunctional    = assignments.filter((a) => !topLevelHeadUserIds.has(a.user_id) && !a.role_tier && a.is_active);

  // ── Scope panel renderer ──────────────────────────────────────────────────────
  const renderScopePanel = (a: Assignment) => {
    if (openScope !== a.id) return null;
    const sectionMap = scopeMap[a.id];
    if (sectionMap === undefined) return <div className="mt-2 px-3 py-2 text-xs text-gray-400">Loading…</div>;
    const isPA = a.role_tier === "power_admin";
    const sections = isPA ? PA_SCOPE_SECTIONS : FA_SCOPE_SECTIONS;
    const grantedCount = Object.values(sectionMap).filter((l) => l !== "none").length;
    return (
      <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            {a.full_name} — scope
          </p>
          <button type="button" onClick={() => saveScope(a.id)} disabled={savingScope}
            className="text-[10px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 border border-blue-300 px-2 py-0.5 rounded">
            {savingScope ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="px-3 pt-2 pb-1">
          <p className="text-[9px] text-gray-400 mb-2">Click to cycle: No access → Read only → Full</p>
          <div className="space-y-1">
            {sections.map((sec) => {
              // Fall back to the same defaults used in loadScope
              const fallback = isPA ? (PA_SECTION_DEFAULTS[sec] ?? "full") : "none";
              const level = sectionMap[sec] ?? fallback;
              return (
                <div key={sec} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-600">{sec}</span>
                  <button type="button"
                    onClick={() => cycleScopeSection(a.id, sec)}
                    className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${ACCESS_PILL[level] ?? ACCESS_PILL.none}`}>
                    {ACCESS_LABEL[level]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        {!isPA && grantedCount === 0 && (
          <p className="px-3 pb-2 text-[10px] text-amber-600 italic">No sections granted — this user has no config access.</p>
        )}
      </div>
    );
  };

  // ── Generic chip with scope button ───────────────────────────────────────────
  const renderScopedChip = (
    a: Assignment,
    opts: { bgClass: string; textClass: string; label?: string; removable?: boolean }
  ) => (
    <div key={a.id} className="mb-2 mr-2 inline-block">
      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${opts.bgClass}`}>
        <span className={opts.textClass}>{a.full_name}</span>
        {opts.label && <span className="text-[10px] opacity-60">· {opts.label}</span>}
        <button type="button" title="Configure scope" onClick={() => toggleScope(a)}
          className={`ml-0.5 ${openScope === a.id ? "text-blue-500" : "text-gray-300 hover:text-blue-400"} transition-colors`}>
          <i className="ti ti-settings" style={{ fontSize: 11 }} />
        </button>
        {opts.removable && (
          <button type="button" title="Remove" onClick={() => setPendingRemove({ id: a.id, name: a.full_name })}
            className="text-gray-300 hover:text-red-400 leading-none transition-colors">
            <i className="ti ti-x" style={{ fontSize: 10 }} />
          </button>
        )}
      </div>
      {renderScopePanel(a)}
    </div>
  );

  return (
    <PageContainer maxWidth="4xl">
      <button type="button" onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <PageHeading title="Roles & permissions" />
      <p className="text-sm text-gray-500 mb-6">
        Three access tiers. Consultant is always full access. Power Admin defaults to full access but can be adjusted per person. Functional Admin access is configured per section per person.
      </p>

      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="tiers"       active={tab === "tiers"}       onClick={handleTabChange} label="Role tiers" />
        <TabBtn id="assignments" active={tab === "assignments"} onClick={handleTabChange} label="User assignments" />
      </div>

      {isExpired ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">Your session has expired.</p>
          <button type="button" onClick={async () => { await logout(); window.location.href = "/auth/login"; }}
            className="text-xs font-medium text-red-700 border border-red-300 px-2.5 py-1 rounded hover:bg-red-100">Sign in again</button>
        </div>
      ) : error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {/* ── Role tiers ── */}
      {tab === "tiers" && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Role tier structure is defined by ZivaBI. Contact your consultant to modify.
          </div>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-44">Role tier</th>
                  <th className="px-4 py-3 text-left">Who holds it</th>
                  <th className="px-4 py-3 text-left">Granted by</th>
                  <th className="px-4 py-3 text-left">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.consultant}`}>ZivaBI Consultant</span></td>
                  <td className="px-4 py-3 text-gray-700">ZivaBI implementation team</td>
                  <td className="px-4 py-3 text-gray-700">Super admin only</td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-600 text-white">Full — all sections, always</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.power_admin}`}>Tenant Power Admin</span></td>
                  <td className="px-4 py-3 text-gray-700">Finance Director / CFO</td>
                  <td className="px-4 py-3 text-gray-700">ZivaBI Consultant</td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-300">Full by default — adjustable per person</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.functional_admin}`}>Functional Admin</span></td>
                  <td className="px-4 py-3 text-gray-700">Department / Cost Center Heads</td>
                  <td className="px-4 py-3 text-gray-700">Consultant or Power Admin</td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Configured per section per person</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── User assignments ── */}
      {tab === "assignments" && !isExpired && (
        <div className="space-y-4">
          {saving && <p className="text-xs text-gray-400">Saving…</p>}
          {saved  && <p className="text-xs text-green-600">Saved</p>}
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No users in this tenant yet.</p>
          ) : (
            <>
              {/* ── Power Admin ── */}
              {(() => {
                const assigned        = assignments.filter((a) => a.role_tier === "power_admin" && a.is_active);
                const eligibleOther   = assignments.filter((a) => !a.role_tier && a.is_active && !allCcHeadUserIds.has(a.user_id));
                const eligibleCCHeads = assignments.filter((a) => !a.role_tier && a.is_active && allCcHeadUserIds.has(a.user_id));
                const isAdding = addingToTier === "power_admin";
                return (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-start justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.power_admin}`}>Tenant Power Admin</span>
                          <span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-300">Full by default</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Full access to all setup sections by default. Use <i className="ti ti-settings" style={{ fontSize: 10 }} /> to restrict individual users. Typically Finance Director or CFO.
                        </p>
                      </div>
                      <button type="button" onClick={() => setAddingToTier(isAdding ? null : "power_admin")}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-0.5 shrink-0 ml-4">
                        <i className="ti ti-plus" style={{ fontSize: 11 }} /> Add user
                      </button>
                    </div>
                    {isAdding && (
                      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-2">
                        {eligibleOther.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {eligibleOther.map((u) => (
                              <button key={u.id} type="button" onClick={() => { saveAssignment(u.id, "power_admin"); setAddingToTier(null); }}
                                className="text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-full hover:border-blue-400 hover:text-blue-700 text-gray-700">{u.full_name}</button>
                            ))}
                          </div>
                        )}
                        {eligibleCCHeads.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Cost center heads</p>
                            <div className="flex flex-wrap gap-1.5">
                              {eligibleCCHeads.map((u) => (
                                <button key={u.id} type="button" onClick={() => { saveAssignment(u.id, "power_admin"); setAddingToTier(null); }}
                                  className="text-xs px-2.5 py-1 bg-white border border-blue-200 rounded-full hover:border-blue-500 hover:text-blue-700 text-gray-700">
                                  {u.full_name}<span className="text-gray-400 ml-1 text-[10px]">· {allHeadCcNames[u.user_id]?.join(", ")}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {eligibleOther.length === 0 && eligibleCCHeads.length === 0 && (
                          <p className="text-xs text-gray-400 italic">All active users already have a tier.</p>
                        )}
                      </div>
                    )}
                    <div className="px-4 py-3 min-h-[48px]">
                      {assigned.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No users assigned yet.</p>
                      )}
                      <div>
                        {assigned.map((a) => renderScopedChip(a, {
                          bgClass: "bg-white border-gray-200",
                          textClass: "text-gray-700",
                          removable: true,
                        }))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Functional Admin ── */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.functional_admin}`}>Functional Admin</span>
                      <span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Scope per person</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Cost center heads are auto-included. Use <i className="ti ti-settings" style={{ fontSize: 10 }} /> on each person to set which sections they can access and at what level.
                    </p>
                  </div>
                  {eligibleForFunctional.length > 0 && (
                    <button type="button" onClick={() => setAddingToTier(addingToTier === "functional_admin" ? null : "functional_admin")}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-0.5 shrink-0 ml-4">
                      <i className="ti ti-plus" style={{ fontSize: 11 }} /> Add user
                    </button>
                  )}
                </div>

                {addingToTier === "functional_admin" && (
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Select staff to grant functional admin access</p>
                    {eligibleForFunctional.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No more staff to add.</p>
                    ) : (
                      Object.entries(groupByCc(eligibleForFunctional)).sort(([a], [b]) => a.localeCompare(b)).map(([ccName, users]) => (
                        <div key={ccName}>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{ccName}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {users.map((u) => (
                              <button key={u.id} type="button" onClick={() => { saveAssignment(u.id, "functional_admin"); setAddingToTier(null); }}
                                className="text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-full hover:border-blue-400 hover:text-blue-700 text-gray-700">{u.full_name}</button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="px-4 py-3 min-h-[48px]">
                  {autoFunctionalAdmins.length === 0 && explicitFunctionalAdmins.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No cost center heads configured yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {autoFunctionalAdmins.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Cost center heads — auto</p>
                          <div>
                            {autoFunctionalAdmins.map((a) => renderScopedChip(a, {
                              bgClass: "bg-green-50 border-green-200",
                              textClass: "text-green-800",
                              label: headCcNames[a.user_id]?.join(", "),
                            }))}
                          </div>
                        </div>
                      )}
                      {explicitFunctionalAdmins.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Additionally assigned</p>
                          <div>
                            {explicitFunctionalAdmins.map((a) => renderScopedChip(a, {
                              bgClass: "bg-white border-gray-200",
                              textClass: "text-gray-700",
                              removable: true,
                            }))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Staff grouped by CC, collapsible, click-to-add ── */}
              {(() => {
                const staff = assignments.filter((a) => !a.role_tier && a.is_active && !allCcHeadUserIds.has(a.user_id));
                if (staff.length === 0) return null;
                const grouped = groupByCc(staff);
                const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
                return (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Staff — no admin tier assigned ({staff.length})</p>
                      <p className="text-[10px] text-gray-400">Click a name to add as Functional Admin</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {sortedGroups.map(([ccName, users]) => {
                        const isCollapsed = collapsedCCs[ccName] !== false;
                        return (
                          <div key={ccName}>
                            <button type="button"
                              onClick={() => setCollapsedCCs((p) => ({ ...p, [ccName]: !isCollapsed }))}
                              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors text-left">
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{ccName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">{users.length} {users.length === 1 ? "person" : "people"}</span>
                                <i className={`ti ti-chevron-${isCollapsed ? "down" : "up"} text-gray-400`} style={{ fontSize: 11 }} />
                              </div>
                            </button>
                            {!isCollapsed && (
                              <div className="px-4 pb-3 flex flex-wrap gap-2">
                                {users.map((a) => (
                                  <button key={a.id} type="button"
                                    title="Click to add as Functional Admin"
                                    onClick={() => { saveAssignment(a.id, "functional_admin"); setAddingToTier(null); }}
                                    className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors cursor-pointer">
                                    {a.full_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
      {/* ── Remove confirmation modal ── */}
      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Remove user?</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{pendingRemove.name}</span> will be removed from this role tier.
                Their scope configuration will also be cleared.
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button type="button" onClick={() => setPendingRemove(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={saving}
                onClick={async () => {
                  await saveAssignment(pendingRemove.id, null);
                  setPendingRemove(null);
                }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {saving ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <RolesContent />
    </Suspense>
  );
}
