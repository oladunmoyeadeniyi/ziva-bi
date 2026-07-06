"use client";

/**
 * Roles & Permissions page — M8.2 Implementation Portal.
 *
 * 2 tabs: Role tiers | Role assignments
 * - ZivaBI Consultant: always full access (locked, no config)
 * - Tenant Power Admin: full access by default, scope configurable per ORG ROLE
 * - Functional Admin: per-role scope — which sections + at what level
 * - Roles are name-deduplicated: DPM in 3 cost centers shows as one chip.
 * - Drag a chip to assign the entire name group; ⚙ opens scope per instance.
 * - Search/autocomplete lets you find and assign roles without scrolling.
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

/** Name-deduplicated display unit. Multiple OrgRoles with the same name show as one chip. */
interface NameGroup {
  name: string;
  instances: OrgRole[];
  permission_tier: string | null;
  cost_centers: string[];
  totalOccupants: number;
}

function groupByName(roles: OrgRole[]): NameGroup[] {
  const map = new Map<string, OrgRole[]>();
  for (const r of roles) {
    if (!map.has(r.name)) map.set(r.name, []);
    map.get(r.name)!.push(r);
  }
  return Array.from(map.entries()).map(([name, instances]) => ({
    name,
    instances,
    permission_tier: instances[0].permission_tier,
    cost_centers: [...new Set(instances.map(i => i.cost_center_name).filter(Boolean) as string[])],
    totalOccupants: instances.reduce((s, i) => s + i.occupants.length, 0),
  }));
}

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

  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [savingTier, setSavingTier] = useState<string | null>(null);

  const [scopeMap, setScopeMap] = useState<Record<string, Record<string, string>>>({});
  const [openScope, setOpenScope] = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pendingRemove, setPendingRemove] = useState<NameGroup | null>(null);

  // Drag state — uses group name as key
  const [draggingGroupName, setDraggingGroupName] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);

  // Search autocomplete
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
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
        // Auto-assign head_of_department / head_of_entity roles that have no tier yet
        const hodRoles = roles.filter(
          r => !r.permission_tier &&
               (r.designation === "head_of_department" || r.designation === "head_of_entity")
        );
        if (hodRoles.length > 0) {
          await Promise.all(
            hodRoles.map(r =>
              apiFetch(`/api/approvals/roles/${r.id}/permission-tier`, {
                method: "PATCH", token: accessToken!,
                body: { permission_tier: "functional_admin" },
              }).catch(() => null)
            )
          );
          const updated = await apiFetch<OrgRole[]>("/api/approvals/roles", { token: accessToken! });
          setOrgRoles(updated);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setRolesLoading(false));
  }, [accessToken, tab]);

  /** Assign all instances in a NameGroup to the given tier (or null = remove). */
  const saveTierForGroup = async (group: NameGroup, tier: string | null) => {
    if (!accessToken) return;
    const ids = group.instances.map(i => i.id);
    setSavingTier(group.name);
    try {
      await Promise.all(ids.map(id =>
        apiFetch(`/api/approvals/roles/${id}/permission-tier`, {
          method: "PATCH", token: accessToken, body: { permission_tier: tier },
        })
      ));
      setOrgRoles(prev => prev.map(r => ids.includes(r.id) ? { ...r, permission_tier: tier } : r));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSavingTier(null); }
  };

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
      const currentLevel = current[section] ?? "none";
      const next = currentLevel === "none" ? "read_only" : currentLevel === "read_only" ? "full" : "none";
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

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, groupName: string) => {
    setDraggingGroupName(groupName);
    e.dataTransfer.setData("groupName", groupName);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => { setDraggingGroupName(null); setDragOverTier(null); };
  const handleDragOver = (e: React.DragEvent, tier: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTier(tier);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTier(null);
  };
  const handleDrop = (e: React.DragEvent, tier: string) => {
    e.preventDefault();
    const groupName = e.dataTransfer.getData("groupName");
    if (groupName) {
      const group = allNameGroups.find(g => g.name === groupName);
      if (group) saveTierForGroup(group, tier);
    }
    setDraggingGroupName(null); setDragOverTier(null);
  };

  // ── Scope panel ───────────────────────────────────────────────────────────
  const renderScopePanel = (role: OrgRole) => {
    if (openScope !== role.id) return null;
    const sectionMap = scopeMap[role.id];
    if (sectionMap === undefined) return <div className="mt-2 px-3 py-2 text-xs text-gray-400">Loading…</div>;
    const isPA = role.permission_tier === "power_admin";
    const sections = isPA ? PA_SCOPE_SECTIONS : FA_SCOPE_SECTIONS;
    const grantedCount = Object.values(sectionMap).filter((l) => l !== "none").length;
    return (
      <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{role.name} — scope</p>
          <button type="button" onClick={() => saveScope(role.id)} disabled={savingScope}
            className="text-[10px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 border border-blue-300 px-2 py-0.5 rounded">
            {savingScope ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="px-3 pt-2 pb-1">
          <p className="text-[9px] text-gray-400 mb-2">Click to cycle: No access → Read only → Full</p>
          <div className="space-y-1">
            {sections.map((sec) => {
              const fallback = isPA ? (PA_SECTION_DEFAULTS[sec] ?? "full") : "none";
              const level = sectionMap[sec] ?? fallback;
              return (
                <div key={sec} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-600">{sec}</span>
                  <button type="button" onClick={() => cycleScopeSection(role.id, sec)}
                    className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${ACCESS_PILL[level] ?? ACCESS_PILL.none}`}>
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

  // ── Group chip ─────────────────────────────────────────────────────────────
  const renderGroupChip = (group: NameGroup, opts: { bgClass: string; textClass: string; removable?: boolean }) => {
    const firstRole = group.instances[0];
    const isLoading = savingTier === group.name;
    return (
      <div key={group.name} className="mb-2 mr-2 inline-block align-top">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${opts.bgClass} ${isLoading ? "opacity-60" : ""}`}>
          <div className="min-w-0">
            <span className={`font-medium ${opts.textClass}`}>{group.name}</span>
            {group.cost_centers.length > 0 && (
              <span className="ml-1.5 text-[10px] text-gray-400 truncate">
                {group.cost_centers.length <= 2
                  ? group.cost_centers.join(", ")
                  : `${group.cost_centers[0]} +${group.cost_centers.length - 1}`}
              </span>
            )}
            {group.totalOccupants > 0 && (
              <span className="ml-1.5 text-[10px] text-gray-400">
                · {group.totalOccupants} {group.totalOccupants === 1 ? "occupant" : "occupants"}
              </span>
            )}
          </div>
          <button type="button" title="Configure scope" onClick={() => toggleScope(firstRole)}
            className={`ml-0.5 shrink-0 ${openScope === firstRole.id ? "text-blue-500" : "text-gray-300 hover:text-blue-400"} transition-colors`}>
            <i className="ti ti-settings" style={{ fontSize: 11 }} />
          </button>
          {opts.removable && (
            <button type="button" title="Remove from tier" onClick={() => setPendingRemove(group)}
              className="text-gray-300 hover:text-red-400 leading-none transition-colors shrink-0">
              <i className="ti ti-x" style={{ fontSize: 10 }} />
            </button>
          )}
        </div>
        {renderScopePanel(firstRole)}
      </div>
    );
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  const paGroups   = groupByName(orgRoles.filter(r => r.permission_tier === "power_admin"));
  const faGroups   = groupByName(orgRoles.filter(r => r.permission_tier === "functional_admin"));
  const freeGroups = groupByName(orgRoles.filter(r => !r.permission_tier));
  const allNameGroups = groupByName(orgRoles);

  // Search suggestions
  const searchTerm = search.trim().toLowerCase();
  const suggestions = searchTerm.length >= 1
    ? allNameGroups.filter(g => g.name.toLowerCase().includes(searchTerm)).slice(0, 8)
    : [];

  // ── Tier column ───────────────────────────────────────────────────────────
  const TierCol = ({
    tier, label, badge, subLabel, chipBg, chipText, groups, dropHighlight,
  }: {
    tier: string; label: string; badge: string; subLabel: string;
    chipBg: string; chipText: string; groups: NameGroup[]; dropHighlight: string;
  }) => (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-start justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE[tier]}`}>{label}</span>
            <span className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${badge}`}>
              {tier === "power_admin" ? "Full by default" : "Scope per role"}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{subLabel}</p>
        </div>
        {draggingGroupName && (
          <span className="text-[10px] text-blue-500 font-medium mt-1 shrink-0 ml-2 animate-pulse">Drop here</span>
        )}
      </div>
      <div
        onDragOver={(e) => handleDragOver(e, tier)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, tier)}
        className={`px-3 py-2.5 min-h-[52px] transition-colors rounded-b-lg ${dragOverTier === tier ? dropHighlight : ""}`}
      >
        {groups.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Drag a role here to assign.</p>
        ) : (
          <div className="flex flex-wrap">
            {groups.map(g => renderGroupChip(g, { bgClass: chipBg, textClass: chipText, removable: true }))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PageContainer maxWidth="5xl">
      <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Back
      </button>
      <PageHeading title="Roles & permissions" />
      <p className="text-sm text-gray-500 mb-4">
        Assign org chart roles to permission tiers. Everyone holding that role inherits the settings — no individual user config needed.
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
              <p className="text-xs">Go to Organisation → Structure → Chart to build your role hierarchy first.</p>
            </div>
          ) : (
            <>
              {/* Search bar */}
              <div className="relative mb-4" ref={searchRef}>
                <div className="relative">
                  <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: 13 }} />
                  <input
                    type="text"
                    placeholder="Search roles to assign…"
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
                    {suggestions.map(group => (
                      <div key={group.name} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <div className="min-w-0 mr-2">
                          <span className="text-sm font-medium text-gray-800">{group.name}</span>
                          {group.cost_centers.length > 0 && (
                            <span className="ml-2 text-xs text-gray-400">{group.cost_centers.join(", ")}</span>
                          )}
                          {group.permission_tier && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${TIER_BADGE[group.permission_tier]}`}>
                              {group.permission_tier === "power_admin" ? "Power Admin" : "Functional Admin"}
                            </span>
                          )}
                        </div>
                        {!group.permission_tier ? (
                          <div className="flex gap-1 shrink-0">
                            <button type="button"
                              onClick={() => { saveTierForGroup(group, "power_admin"); setSearch(""); setShowSuggestions(false); }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 whitespace-nowrap">
                              → Power Admin
                            </button>
                            <button type="button"
                              onClick={() => { saveTierForGroup(group, "functional_admin"); setSearch(""); setShowSuggestions(false); }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap">
                              → Func. Admin
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 shrink-0">Already assigned</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {freeGroups.length > 0 && (
                <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                  <i className="ti ti-drag-drop" style={{ fontSize: 13 }} />
                  Drag any unassigned role into a tier to assign it, or use the search bar above.
                </div>
              )}

              {/* PA + FA side by side */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <TierCol
                  tier="power_admin"
                  label="Tenant Power Admin"
                  badge="bg-green-100 text-green-800 border border-green-300"
                  subLabel="Full access by default. Use ⚙ to restrict per role. Typically Finance Director, CFO."
                  chipBg="bg-white border-gray-200"
                  chipText="text-gray-700"
                  groups={paGroups}
                  dropHighlight="bg-blue-50 ring-2 ring-blue-300 ring-inset"
                />
                <TierCol
                  tier="functional_admin"
                  label="Functional Admin"
                  badge="bg-blue-100 text-blue-800 border border-blue-200"
                  subLabel="Configure which sections each role can access. Use ⚙ to set section-level access."
                  chipBg="bg-green-50 border-green-200"
                  chipText="text-green-800"
                  groups={faGroups}
                  dropHighlight="bg-green-50 ring-2 ring-green-300 ring-inset"
                />
              </div>

              {/* Unassigned — 3-column grid, deduplicated */}
              {freeGroups.length > 0 && (
                <div className="border border-dashed border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Unassigned roles ({freeGroups.length} unique{freeGroups.length !== orgRoles.filter(r => !r.permission_tier).length ? `, ${orgRoles.filter(r => !r.permission_tier).length} total` : ""})
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Drag into a tier above, or search above to quick-assign.</p>
                    </div>
                    <i className="ti ti-grip-horizontal text-gray-300" style={{ fontSize: 15 }} />
                  </div>
                  <div className="px-3 py-2.5" style={{ columns: 3, columnGap: "0.75rem" }}>
                    {freeGroups.map(group => (
                      <div
                        key={group.name}
                        draggable
                        onDragStart={(e) => handleDragStart(e, group.name)}
                        onDragEnd={handleDragEnd}
                        style={{ breakInside: "avoid", marginBottom: "0.4rem" }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border bg-white border-gray-200 text-gray-600 cursor-grab active:cursor-grabbing select-none transition-opacity ${
                          draggingGroupName === group.name ? "opacity-40 scale-95" : "hover:border-blue-300 hover:text-blue-700 hover:shadow-sm"
                        }`}
                      >
                        <i className="ti ti-grip-vertical text-gray-300 shrink-0" style={{ fontSize: 11 }} />
                        <span className="font-medium truncate">{group.name}</span>
                        {group.instances.length > 1 && (
                          <span className="shrink-0 ml-auto text-[10px] text-gray-400 border border-gray-100 rounded px-1"
                            title={`${group.instances.length} variants: ${group.cost_centers.join(", ")}`}>
                            ×{group.instances.length}
                          </span>
                        )}
                        {group.instances.length === 1 && group.totalOccupants > 0 && (
                          <span className="shrink-0 ml-auto text-[10px] text-gray-400 border border-gray-100 rounded px-1">
                            {group.totalOccupants}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Remove confirmation modal ── */}
      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Remove role from tier?</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{pendingRemove.name}</span>
                {pendingRemove.instances.length > 1 && ` (${pendingRemove.instances.length} variants)`}
                {" "}will be removed from its permission tier. Occupants lose inherited permissions at their next login.
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button type="button" onClick={() => setPendingRemove(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={!!savingTier}
                onClick={async () => { await saveTierForGroup(pendingRemove, null); setPendingRemove(null); }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {savingTier ? "Removing…" : "Remove"}
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
