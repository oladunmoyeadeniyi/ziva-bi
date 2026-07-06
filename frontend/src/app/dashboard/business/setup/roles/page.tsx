"use client";

/**
 * Roles & Permissions page — M8.2 Implementation Portal.
 *
 * Tabs: Role tiers | Role assignments
 * - Roles grouped by cost center within each tier.
 * - Same-name roles within a cost center collapse into a sub-role group.
 * - Assigning a name with multiple variants shows a selection prompt.
 * - + button on each tier card for quick add without dragging.
 * - UA section collapsed by default; PA/FA expanded.
 */

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

type Tab = "tiers" | "assignments";

const PA_SCOPE_SECTIONS = [
  "Organisation", "Module activation", "Chart of accounts", "Dimensions",
  "Employees", "Currencies & FX", "Tax & statutory", "Roles & permissions",
  "Approval workflows", "Document rules", "Module setup",
];
const PA_SECTION_DEFAULTS: Record<string, string> = { "Roles & permissions": "none" };
const FA_SCOPE_SECTIONS = [
  "Chart of accounts", "Dimensions", "Employees", "Approval workflows", "Document rules",
];

const TIER_BADGE: Record<string, string> = {
  consultant:       "bg-amber-100 text-amber-800 border border-amber-300",
  power_admin:      "bg-blue-100 text-blue-800 border border-blue-300",
  functional_admin: "bg-green-100 text-green-800 border border-green-300",
};
const ACCESS_PILL: Record<string, string> = {
  full:      "bg-green-600 text-white border border-green-600 hover:bg-green-700",
  read_only: "bg-blue-600  text-white border border-blue-600  hover:bg-blue-700",
  none:      "bg-white     text-gray-500 border border-gray-300 hover:bg-gray-50",
};
const ACCESS_LABEL: Record<string, string> = {
  full: "Full access", read_only: "Read only", none: "No access",
};

interface OrgRole {
  id: string;
  name: string;
  designation: string | null;
  cost_center_name: string | null;
  permission_tier: string | null;
  occupants: { id: string; full_name: string; initials: string; employee_code?: string }[];
}

/** Group by cost center for display. No-CC roles go under "General". */
function groupByCostCenter(roles: OrgRole[]): { cc: string; ccRoles: OrgRole[] }[] {
  const map = new Map<string, OrgRole[]>();
  for (const r of roles) {
    const key = r.cost_center_name || "General";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([cc, ccRoles]) => ({ cc, ccRoles }));
}

/** Within a cost center, group same-name roles as sub-role clusters. */
function groupByNameWithin(roles: OrgRole[]): { name: string; instances: OrgRole[] }[] {
  const map = new Map<string, OrgRole[]>();
  for (const r of roles) {
    if (!map.has(r.name)) map.set(r.name, []);
    map.get(r.name)!.push(r);
  }
  return Array.from(map.entries()).map(([name, instances]) => ({ name, instances }));
}

/** Unique role names across a list (for search / dedup). */
function getUniqueNames(roles: OrgRole[]): { name: string; instances: OrgRole[] }[] {
  const map = new Map<string, OrgRole[]>();
  for (const r of roles) {
    if (!map.has(r.name)) map.set(r.name, []);
    map.get(r.name)!.push(r);
  }
  return Array.from(map.entries()).map(([name, instances]) => ({ name, instances }));
}

function TabBtn({ id, active, onClick, label }: { id: Tab; active: boolean; onClick: (t: Tab) => void; label: string }) {
  return (
    <button type="button" onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
      {label}
    </button>
  );
}

/** Expandable sub-role cluster for same-name roles within a cost center. */
function SubRoleGroup({
  name, instances, onRemove, onScope, openScopeId, scopePanel,
}: {
  name: string;
  instances: OrgRole[];
  onRemove: (r: OrgRole) => void;
  onScope: (r: OrgRole) => void;
  openScopeId: string | null;
  scopePanel: (r: OrgRole) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm transition-all">
          <span className="font-medium">{name}</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1">×{instances.length}</span>
          <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"} text-gray-400`} style={{ fontSize: 10 }} />
        </button>
      </div>
      {expanded && (
        <div className="ml-3 mt-1 border-l-2 border-gray-100 pl-2 space-y-1">
          {instances.map(r => (
            <div key={r.id}>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border bg-gray-50 border-gray-200 text-gray-600">
                <span className="truncate">{r.cost_center_name || "General"}</span>
                {r.occupants.length > 0 && (
                  <span className="text-[10px] text-gray-400 ml-1">· {r.occupants.length}</span>
                )}
                <button type="button" title="Configure scope" onClick={() => onScope(r)}
                  className={`ml-auto shrink-0 ${openScopeId === r.id ? "text-blue-500" : "text-gray-300 hover:text-blue-400"} transition-colors`}>
                  <i className="ti ti-settings" style={{ fontSize: 11 }} />
                </button>
                <button type="button" title="Remove" onClick={() => onRemove(r)}
                  className="text-gray-300 hover:text-red-400 shrink-0 transition-colors">
                  <i className="ti ti-x" style={{ fontSize: 10 }} />
                </button>
              </div>
              {scopePanel(r)}
            </div>
          ))}
        </div>
      )}
    </div>
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

  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const [scopeMap, setScopeMap] = useState<Record<string, Record<string, string>>>({});
  const [openScope, setOpenScope] = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState(false);

  // Remove confirmation
  const [pendingRemove, setPendingRemove] = useState<OrgRole | null>(null);

  // Drag state — dragging a unique name (may cover multiple roles)
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);

  // Search autocomplete (global)
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Per-tier add dropdown
  const [addTier, setAddTier] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");
  const addRef = useRef<HTMLDivElement>(null);

  // UA collapsed
  const [uaCollapsed, setUaCollapsed] = useState(true);

  // Assignment prompt (for multi-variant roles)
  const [assignPrompt, setAssignPrompt] = useState<{ name: string; instances: OrgRole[]; tier: string } | null>(null);
  const [promptSelected, setPromptSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddTier(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!accessToken || tab !== "assignments") return;
    setRolesLoading(true);
    apiFetch<OrgRole[]>("/api/approvals/roles", { token: accessToken })
      .then(async (roles) => {
        setOrgRoles(roles);
        const hodRoles = roles.filter(
          r => !r.permission_tier &&
               (r.designation === "head_of_department" || r.designation === "head_of_entity")
        );
        if (hodRoles.length > 0) {
          await Promise.all(hodRoles.map(r =>
            apiFetch(`/api/approvals/roles/${r.id}/permission-tier`, {
              method: "PATCH", token: accessToken!, body: { permission_tier: "functional_admin" },
            }).catch(() => null)
          ));
          const updated = await apiFetch<OrgRole[]>("/api/approvals/roles", { token: accessToken! });
          setOrgRoles(updated);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setRolesLoading(false));
  }, [accessToken, tab]);

  /** Assign specific role IDs to a tier (or null to remove). */
  const saveTierForIds = async (ids: string[], tier: string | null) => {
    if (!accessToken) return;
    setSavingIds(new Set(ids));
    try {
      await Promise.all(ids.map(id =>
        apiFetch(`/api/approvals/roles/${id}/permission-tier`, {
          method: "PATCH", token: accessToken, body: { permission_tier: tier },
        })
      ));
      setOrgRoles(prev => prev.map(r => ids.includes(r.id) ? { ...r, permission_tier: tier } : r));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSavingIds(new Set()); }
  };

  /** Request assignment — shows prompt if multiple variants exist. */
  const requestAssign = (name: string, instances: OrgRole[], tier: string) => {
    if (instances.length === 1) {
      saveTierForIds([instances[0].id], tier);
    } else {
      setAssignPrompt({ name, instances, tier });
      setPromptSelected(new Set(instances.map(i => i.id)));
    }
  };

  const confirmAssign = async () => {
    if (!assignPrompt) return;
    const ids = [...promptSelected];
    await saveTierForIds(ids, assignPrompt.tier);
    setAssignPrompt(null);
    setPromptSelected(new Set());
  };

  // ── Scope ──────────────────────────────────────────────────────────────────
  const loadScope = async (role: OrgRole) => {
    if (!accessToken || scopeMap[role.id] !== undefined) return;
    const isPA = role.permission_tier === "power_admin";
    const sections = isPA ? PA_SCOPE_SECTIONS : FA_SCOPE_SECTIONS;
    const initMap: Record<string, string> = {};
    for (const sec of sections) initMap[sec] = isPA ? (PA_SECTION_DEFAULTS[sec] ?? "full") : "none";
    try {
      const d = await apiFetch<{ role_id: string; sections: { section: string; access_level: string }[] }>(
        `/api/approvals/roles/${role.id}/scope`, { token: accessToken }
      );
      for (const item of d.sections) initMap[item.section] = item.access_level;
    } catch { /* keep defaults */ }
    setScopeMap(prev => ({ ...prev, [role.id]: initMap }));
  };

  const toggleScope = async (role: OrgRole) => {
    if (openScope === role.id) { setOpenScope(null); return; }
    setOpenScope(role.id);
    await loadScope(role);
  };

  const cycleScopeSection = (roleId: string, section: string) => {
    setScopeMap(prev => {
      const current = prev[roleId] ?? {};
      const lvl = current[section] ?? "none";
      const next = lvl === "none" ? "read_only" : lvl === "read_only" ? "full" : "none";
      return { ...prev, [roleId]: { ...current, [section]: next } };
    });
  };

  const saveScope = async (roleId: string) => {
    if (!accessToken) return;
    setSavingScope(true);
    try {
      const sectionMap = scopeMap[roleId] ?? {};
      const sections = Object.entries(sectionMap)
        .filter(([, level]) => level !== "none")
        .map(([section, access_level]) => ({ section, access_level }));
      await apiFetch(`/api/approvals/roles/${roleId}/scope`, {
        method: "PATCH", token: accessToken, body: { sections },
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Scope save failed"); }
    finally { setSavingScope(false); }
  };

  const renderScopePanel = (role: OrgRole) => {
    if (openScope !== role.id) return null;
    const sectionMap = scopeMap[role.id];
    if (sectionMap === undefined) return <div className="mt-1 px-3 py-2 text-xs text-gray-400">Loading…</div>;
    const isPA = role.permission_tier === "power_admin";
    const sections = isPA ? PA_SCOPE_SECTIONS : FA_SCOPE_SECTIONS;
    const grantedCount = Object.values(sectionMap).filter(l => l !== "none").length;
    return (
      <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{role.name} — scope</p>
          <button type="button" onClick={() => saveScope(role.id)} disabled={savingScope}
            className="text-[10px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 border border-blue-300 px-2 py-0.5 rounded">
            {savingScope ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="px-3 pt-2 pb-1">
          <p className="text-[9px] text-gray-400 mb-1.5">Click to cycle: No access → Read only → Full</p>
          <div className="space-y-0.5">
            {sections.map((sec) => {
              const fallback = isPA ? (PA_SECTION_DEFAULTS[sec] ?? "full") : "none";
              const level = sectionMap[sec] ?? fallback;
              return (
                <div key={sec} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-600">{sec}</span>
                  <button type="button" onClick={() => cycleScopeSection(role.id, sec)}
                    className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${ACCESS_PILL[level] ?? ACCESS_PILL.none}`}>
                    {ACCESS_LABEL[level]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        {!isPA && grantedCount === 0 && (
          <p className="px-3 pb-2 text-[10px] text-amber-600 italic">No sections granted — this role has no config access.</p>
        )}
      </div>
    );
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, name: string) => {
    setDraggingName(name);
    e.dataTransfer.setData("roleName", name);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => { setDraggingName(null); setDragOverTier(null); };
  const handleDragOver = (e: React.DragEvent, tier: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTier(tier);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTier(null);
  };
  const handleDrop = (e: React.DragEvent, tier: string) => {
    e.preventDefault();
    const name = e.dataTransfer.getData("roleName");
    if (name) {
      const instances = orgRoles.filter(r => r.name === name && !r.permission_tier);
      if (instances.length) requestAssign(name, instances, tier);
    }
    setDraggingName(null); setDragOverTier(null);
  };

  // ── Single role chip (for assigned tiers, single instance) ─────────────────
  const renderSingleChip = (role: OrgRole, chipBg: string, chipText: string) => (
    <div key={role.id} className="mb-1.5">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${chipBg} ${savingIds.has(role.id) ? "opacity-60" : ""}`}>
        <span className={`font-medium ${chipText}`}>{role.name}</span>
        {role.occupants.length > 0 && (
          <span className="text-[10px] text-gray-400 ml-0.5">· {role.occupants.length}</span>
        )}
        <button type="button" title="Configure scope" onClick={() => toggleScope(role)}
          className={`ml-auto shrink-0 ${openScope === role.id ? "text-blue-500" : "text-gray-300 hover:text-blue-400"} transition-colors`}>
          <i className="ti ti-settings" style={{ fontSize: 11 }} />
        </button>
        <button type="button" title="Remove" onClick={() => setPendingRemove(role)}
          className="text-gray-300 hover:text-red-400 shrink-0 transition-colors">
          <i className="ti ti-x" style={{ fontSize: 10 }} />
        </button>
      </div>
      {renderScopePanel(role)}
    </div>
  );

  // ── Derived lists ─────────────────────────────────────────────────────────
  const paRoles   = orgRoles.filter(r => r.permission_tier === "power_admin");
  const faRoles   = orgRoles.filter(r => r.permission_tier === "functional_admin");
  const freeRoles = orgRoles.filter(r => !r.permission_tier);

  const freeNames = getUniqueNames(freeRoles);

  // Global search suggestions (all roles)
  const allNames = getUniqueNames(orgRoles);
  const searchTerm = search.trim().toLowerCase();
  const suggestions = searchTerm.length >= 1
    ? allNames.filter(g => g.name.toLowerCase().includes(searchTerm)).slice(0, 8)
    : [];

  // Per-tier add search
  const addTerm = addSearch.trim().toLowerCase();
  const addSuggestions = addTerm.length >= 1
    ? freeNames.filter(g => g.name.toLowerCase().includes(addTerm)).slice(0, 6)
    : freeNames.slice(0, 6);

  // ── Tier column ───────────────────────────────────────────────────────────
  const TierCol = ({
    tier, label, badge, subLabel, chipBg, chipText, roles, dropHighlight,
  }: {
    tier: string; label: string; badge: string; subLabel: string;
    chipBg: string; chipText: string; roles: OrgRole[]; dropHighlight: string;
  }) => {
    const ccGroups = groupByCostCenter(roles);
    const isAddOpen = addTier === tier;

    return (
      <div className="border border-gray-200 rounded-lg overflow-visible">
        {/* Header */}
        <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE[tier]}`}>{label}</span>
                <span className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${badge}`}>
                  {tier === "power_admin" ? "Full by default" : "Scope per role"}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{subLabel}</p>
            </div>
            {/* + Add button */}
            <div className="relative shrink-0" ref={isAddOpen ? addRef : undefined}>
              <button type="button"
                onClick={() => { setAddTier(isAddOpen ? null : tier); setAddSearch(""); }}
                className="flex items-center gap-1 text-[10px] font-medium text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50 transition-colors whitespace-nowrap">
                <i className="ti ti-plus" style={{ fontSize: 11 }} />
                Add role
              </button>
              {isAddOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                  <div className="p-2 border-b border-gray-100">
                    <input autoFocus type="text" placeholder="Search unassigned roles…"
                      value={addSearch}
                      onChange={e => setAddSearch(e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {addSuggestions.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-gray-400 italic">No unassigned roles found.</p>
                    ) : addSuggestions.map(({ name, instances }) => (
                      <button key={name} type="button"
                        onClick={() => { requestAssign(name, instances, tier); setAddTier(null); setAddSearch(""); }}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                        <span className="text-xs font-medium text-gray-800 truncate">{name}</span>
                        {instances.length > 1 && (
                          <span className="ml-2 shrink-0 text-[10px] text-gray-400 bg-gray-100 rounded px-1">×{instances.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {draggingName && (
            <p className="mt-1.5 text-[10px] text-blue-500 font-medium animate-pulse">Drop here to assign</p>
          )}
        </div>

        {/* Drop zone + content */}
        <div
          onDragOver={(e) => handleDragOver(e, tier)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tier)}
          className={`px-3 py-2.5 min-h-[52px] transition-colors ${dragOverTier === tier ? dropHighlight : ""}`}
        >
          {roles.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Drag a role here or use + Add role.</p>
          ) : (
            ccGroups.map(({ cc, ccRoles }) => (
              <div key={cc} className="mb-3 last:mb-0">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{cc}</p>
                {groupByNameWithin(ccRoles).map(({ name, instances }) =>
                  instances.length === 1
                    ? renderSingleChip(instances[0], chipBg, chipText)
                    : (
                      <SubRoleGroup
                        key={name}
                        name={name}
                        instances={instances}
                        onRemove={setPendingRemove}
                        onScope={toggleScope}
                        openScopeId={openScope}
                        scopePanel={renderScopePanel}
                      />
                    )
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <PageContainer maxWidth="5xl">
      <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Back
      </button>
      <PageHeading title="Roles & permissions" />
      <p className="text-sm text-gray-500 mb-4">
        Assign org chart roles to permission tiers. Everyone holding that role inherits the settings.
      </p>

      <div className="flex border-b border-gray-200 mb-5 gap-1">
        <TabBtn id="tiers"       active={tab === "tiers"}       onClick={handleTabChange} label="Role tiers" />
        <TabBtn id="assignments" active={tab === "assignments"} onClick={handleTabChange} label="Role assignments" />
      </div>

      {isExpired ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">Your session has expired.</p>
          <button type="button" onClick={async () => { await logout(); window.location.href = "/auth/login"; }}
            className="text-xs font-medium text-red-700 border border-red-300 px-2.5 py-1 rounded hover:bg-red-100">Sign in again</button>
        </div>
      ) : error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {saved && <p className="mb-3 text-xs text-green-600">✓ Saved</p>}

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
                  <td className="px-4 py-3"><span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-600 text-white">Full — all sections, always</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.power_admin}`}>Tenant Power Admin</span></td>
                  <td className="px-4 py-3 text-gray-700">Finance Director / CFO</td>
                  <td className="px-4 py-3 text-gray-700">ZivaBI Consultant</td>
                  <td className="px-4 py-3"><span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-300">Full by default — adjustable per role</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.functional_admin}`}>Functional Admin</span></td>
                  <td className="px-4 py-3 text-gray-700">Department / Cost Center Heads</td>
                  <td className="px-4 py-3 text-gray-700">Consultant or Power Admin</td>
                  <td className="px-4 py-3"><span className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Configured per section per role</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Role assignments ── */}
      {tab === "assignments" && !isExpired && (
        <div>
          {rolesLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : orgRoles.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <i className="ti ti-sitemap block mb-2" style={{ fontSize: 36, color: "#d1d5db" }} />
              <p className="font-semibold text-gray-600 mb-1">No org roles defined yet</p>
              <p className="text-xs">Go to Organisation → Structure to build your role hierarchy first.</p>
            </div>
          ) : (
            <>
              {/* Global search */}
              <div className="relative mb-4" ref={searchRef}>
                <div className="relative">
                  <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: 13 }} />
                  <input type="text" placeholder="Search roles to assign…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {search && (
                    <button type="button" onClick={() => { setSearch(""); setShowSuggestions(false); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                      <i className="ti ti-x" style={{ fontSize: 12 }} />
                    </button>
                  )}
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                    {suggestions.map(({ name, instances }) => {
                      const tier = instances[0]?.permission_tier;
                      const unassigned = instances.filter(i => !i.permission_tier);
                      return (
                        <div key={name} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <div className="min-w-0 mr-2">
                            <span className="text-sm font-medium text-gray-800">{name}</span>
                            {instances.length > 1 && (
                              <span className="ml-2 text-xs text-gray-400">×{instances.length} variants</span>
                            )}
                            {tier && (
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${TIER_BADGE[tier]}`}>
                                {tier === "power_admin" ? "Power Admin" : "Func. Admin"}
                              </span>
                            )}
                          </div>
                          {unassigned.length > 0 ? (
                            <div className="flex gap-1 shrink-0">
                              <button type="button"
                                onClick={() => { requestAssign(name, unassigned, "power_admin"); setSearch(""); setShowSuggestions(false); }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 whitespace-nowrap">
                                → PA
                              </button>
                              <button type="button"
                                onClick={() => { requestAssign(name, unassigned, "functional_admin"); setSearch(""); setShowSuggestions(false); }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap">
                                → FA
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 shrink-0">Assigned</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {freeRoles.length > 0 && (
                <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                  <i className="ti ti-drag-drop" style={{ fontSize: 13 }} />
                  Drag unassigned roles into a tier, or use the search bar or + Add role button.
                </div>
              )}

              {/* PA + FA side by side */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <TierCol
                  tier="power_admin"
                  label="Tenant Power Admin"
                  badge="bg-green-100 text-green-800 border border-green-300"
                  subLabel="Full access by default. Use ⚙ to restrict per role."
                  chipBg="bg-white border-gray-200"
                  chipText="text-gray-700"
                  roles={paRoles}
                  dropHighlight="bg-blue-50 ring-2 ring-blue-300 ring-inset"
                />
                <TierCol
                  tier="functional_admin"
                  label="Functional Admin"
                  badge="bg-blue-100 text-blue-800 border border-blue-200"
                  subLabel="Configure section access per role using ⚙."
                  chipBg="bg-green-50 border-green-200"
                  chipText="text-green-800"
                  roles={faRoles}
                  dropHighlight="bg-green-50 ring-2 ring-green-300 ring-inset"
                />
              </div>

              {/* Unassigned — collapsible */}
              {freeRoles.length > 0 && (
                <div className="border border-dashed border-gray-200 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => setUaCollapsed(c => !c)}
                    className="w-full px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors">
                    <div className="text-left">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Unassigned ({freeNames.length} unique · {freeRoles.length} total)
                      </p>
                      {!uaCollapsed && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Drag into a tier above, or use + Add role.</p>
                      )}
                    </div>
                    <i className={`ti ${uaCollapsed ? "ti-chevron-down" : "ti-chevron-up"} text-gray-400`} style={{ fontSize: 13 }} />
                  </button>

                  {!uaCollapsed && (
                    <div className="px-3 py-2.5" style={{ columns: 3, columnGap: "0.75rem" }}>
                      {freeNames.map(({ name, instances }) => (
                        <div
                          key={name}
                          draggable
                          onDragStart={(e) => handleDragStart(e, name)}
                          onDragEnd={handleDragEnd}
                          style={{ breakInside: "avoid", marginBottom: "0.4rem" }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border bg-white border-gray-200 text-gray-600 cursor-grab active:cursor-grabbing select-none transition-opacity ${
                            draggingName === name ? "opacity-40 scale-95" : "hover:border-blue-300 hover:text-blue-700 hover:shadow-sm"
                          }`}
                        >
                          <i className="ti ti-grip-vertical text-gray-300 shrink-0" style={{ fontSize: 11 }} />
                          <span className="font-medium truncate">{name}</span>
                          {instances.length > 1 ? (
                            <span className="shrink-0 ml-auto text-[10px] text-gray-400 border border-gray-100 rounded px-1"
                              title={`${instances.length} variants across: ${[...new Set(instances.map(i => i.cost_center_name).filter(Boolean))].join(", ")}`}>
                              ×{instances.length}
                            </span>
                          ) : instances[0].occupants.length > 0 ? (
                            <span className="shrink-0 ml-auto text-[10px] text-gray-400 border border-gray-100 rounded px-1">
                              {instances[0].occupants.length}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Assignment prompt (multi-variant) ── */}
      {assignPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Assign "{assignPrompt.name}"</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {assignPrompt.instances.length} variants found. Select which to assign to{" "}
                <span className="font-medium">{assignPrompt.tier === "power_admin" ? "Tenant Power Admin" : "Functional Admin"}</span>.
              </p>
            </div>
            <div className="px-5 py-3 space-y-2 max-h-64 overflow-y-auto">
              {assignPrompt.instances.map(r => (
                <label key={r.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                  <input type="checkbox"
                    checked={promptSelected.has(r.id)}
                    onChange={e => {
                      const next = new Set(promptSelected);
                      e.target.checked ? next.add(r.id) : next.delete(r.id);
                      setPromptSelected(next);
                    }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{r.cost_center_name || "General"}</p>
                    {r.occupants.length > 0 && (
                      <p className="text-[10px] text-gray-400">{r.occupants.length} occupant{r.occupants.length !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-2 border-t border-gray-100">
              <button type="button"
                onClick={() => {
                  const all = assignPrompt.instances.every(r => promptSelected.has(r.id));
                  setPromptSelected(all ? new Set() : new Set(assignPrompt.instances.map(r => r.id)));
                }}
                className="text-xs text-gray-500 hover:text-gray-700">
                {assignPrompt.instances.every(r => promptSelected.has(r.id)) ? "Deselect all" : "Select all"}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setAssignPrompt(null); setPromptSelected(new Set()); }}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="button" disabled={promptSelected.size === 0 || savingIds.size > 0}
                  onClick={confirmAssign}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {savingIds.size > 0 ? "Assigning…" : `Assign ${promptSelected.size}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove confirmation ── */}
      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Remove from tier?</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{pendingRemove.name}</span>
                {pendingRemove.cost_center_name && ` (${pendingRemove.cost_center_name})`}
                {" "}will lose its permission tier. Occupants lose inherited permissions at next login.
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button type="button" onClick={() => setPendingRemove(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={savingIds.has(pendingRemove.id)}
                onClick={async () => { await saveTierForIds([pendingRemove.id], null); setPendingRemove(null); }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {savingIds.has(pendingRemove.id) ? "Removing…" : "Remove"}
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
