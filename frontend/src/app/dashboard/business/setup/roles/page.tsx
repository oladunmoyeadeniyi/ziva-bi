"use client";

/**
 * Roles & Permissions — 3-column layout: PA | FA | Unassigned
 * PA: grouped by cost center, each role as a draggable chip.
 * FA: "HoD & above — auto" + "Additionally assigned" sections.
 * UA: collapsible cost-center groups.
 * Drag chips between columns to reassign. + Add opens search popover per column.
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
  full:      "bg-green-600 text-white hover:bg-green-700",
  read_only: "bg-blue-600 text-white hover:bg-blue-700",
  none:      "bg-white text-gray-500 border border-gray-300 hover:bg-gray-50",
};
const ACCESS_LABEL: Record<string, string> = { full: "Full access", read_only: "Read only", none: "No access" };

interface OrgRole {
  id: string;
  name: string;
  designation: string | null;
  cost_center_name: string | null;
  area: string | null;
  sub_area: string | null;
  permission_tier: string | null;
  occupants: { id: string; full_name: string; initials: string }[];
}

function groupByCostCenter(roles: OrgRole[]): { cc: string; ccRoles: OrgRole[] }[] {
  const map = new Map<string, OrgRole[]>();
  for (const r of roles) {
    const key = r.cost_center_name || "General";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([cc, ccRoles]) => ({ cc, ccRoles }));
}

function getUniqueNames(roles: OrgRole[]): { name: string; instances: OrgRole[] }[] {
  const map = new Map<string, OrgRole[]>();
  for (const r of roles) {
    if (!map.has(r.name)) map.set(r.name, []);
    map.get(r.name)!.push(r);
  }
  return Array.from(map.entries()).map(([name, instances]) => ({ name, instances }));
}

function desigBadge(d: string | null) {
  if (d === "head_of_entity") return { label: "HoE", cls: "bg-purple-50 text-purple-700 border border-purple-100" };
  if (d === "head_of_department") return { label: "HoD", cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" };
  return null;
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
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const [scopeMap, setScopeMap] = useState<Record<string, Record<string, string>>>({});
  const [openScope, setOpenScope] = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState(false);

  const [pendingRemove, setPendingRemove] = useState<OrgRole | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);

  // UA groups — all collapsed by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (cc: string) => {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(cc) ? n.delete(cc) : n.add(cc); return n; });
  };

  // Per-tier add popover
  const [addTier, setAddTier] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");
  const addRef = useRef<HTMLDivElement>(null);

  // Assignment prompt for multi-variant
  const [assignPrompt, setAssignPrompt] = useState<{ name: string; instances: OrgRole[]; tier: string } | null>(null);
  const [promptSelected, setPromptSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
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
        const hodRoles = roles.filter(r =>
          !r.permission_tier &&
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
      .catch(e => setError(e.message))
      .finally(() => setRolesLoading(false));
  }, [accessToken, tab]);

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

  const requestAssign = (name: string, instances: OrgRole[], tier: string) => {
    if (instances.length === 1) { saveTierForIds([instances[0].id], tier); }
    else { setAssignPrompt({ name, instances, tier }); setPromptSelected(new Set(instances.map(i => i.id))); }
  };

  // ── Scope ──────────────────────────────────────────────────────────────────
  const loadScope = async (role: OrgRole) => {
    if (!accessToken || scopeMap[role.id] !== undefined) return;
    const isPA = role.permission_tier === "power_admin";
    const sections = isPA ? PA_SCOPE_SECTIONS : FA_SCOPE_SECTIONS;
    const initMap: Record<string, string> = {};
    for (const s of sections) initMap[s] = isPA ? (PA_SECTION_DEFAULTS[s] ?? "full") : "none";
    try {
      const d = await apiFetch<{ sections: { section: string; access_level: string }[] }>(
        `/api/approvals/roles/${role.id}/scope`, { token: accessToken }
      );
      for (const item of d.sections) initMap[item.section] = item.access_level;
    } catch { /* keep defaults */ }
    setScopeMap(prev => ({ ...prev, [role.id]: initMap }));
  };
  const toggleScope = async (role: OrgRole) => {
    if (openScope === role.id) { setOpenScope(null); return; }
    setOpenScope(role.id); await loadScope(role);
  };
  const cycleScopeSection = (roleId: string, section: string) => {
    setScopeMap(prev => {
      const cur = prev[roleId] ?? {};
      const lvl = cur[section] ?? "none";
      return { ...prev, [roleId]: { ...cur, [section]: lvl === "none" ? "read_only" : lvl === "read_only" ? "full" : "none" } };
    });
  };
  const saveScope = async (roleId: string) => {
    if (!accessToken) return;
    setSavingScope(true);
    try {
      const sections = Object.entries(scopeMap[roleId] ?? {})
        .filter(([, l]) => l !== "none").map(([section, access_level]) => ({ section, access_level }));
      await apiFetch(`/api/approvals/roles/${roleId}/scope`, { method: "PATCH", token: accessToken, body: { sections } });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Scope save failed"); }
    finally { setSavingScope(false); }
  };
  const renderScopePanel = (role: OrgRole) => {
    if (openScope !== role.id) return null;
    const sm = scopeMap[role.id];
    if (!sm) return <div className="mt-1 px-3 py-2 text-xs text-gray-400">Loading…</div>;
    const isPA = role.permission_tier === "power_admin";
    const sections = isPA ? PA_SCOPE_SECTIONS : FA_SCOPE_SECTIONS;
    return (
      <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-500 uppercase">{role.name} — scope</p>
          <button type="button" onClick={() => saveScope(role.id)} disabled={savingScope}
            className="text-[10px] text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-0.5 rounded disabled:opacity-50">
            {savingScope ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="px-3 py-1.5 space-y-0.5">
          <p className="text-[9px] text-gray-400 mb-1">Click to cycle: No access → Read only → Full</p>
          {sections.map(sec => {
            const lvl = sm[sec] ?? (isPA ? (PA_SECTION_DEFAULTS[sec] ?? "full") : "none");
            return (
              <div key={sec} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-gray-600">{sec}</span>
                <button type="button" onClick={() => cycleScopeSection(role.id, sec)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${ACCESS_PILL[lvl]}`}>
                  {ACCESS_LABEL[lvl]}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, role: OrgRole) => {
    setDraggingId(role.id);
    e.dataTransfer.setData("roleId", role.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => { setDraggingId(null); setDragOverTier(null); };
  const handleDragOver = (e: React.DragEvent, tier: string) => { e.preventDefault(); setDragOverTier(tier); };
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTier(null); };
  const handleDrop = (e: React.DragEvent, tier: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("roleId");
    if (id) saveTierForIds([id], tier);
    setDraggingId(null); setDragOverTier(null);
  };

  // ── Role chip ─────────────────────────────────────────────────────────────
  const RoleChip = ({ role, draggable: isDraggable = false, removable = false, showDesig = false }: {
    role: OrgRole; draggable?: boolean; removable?: boolean; showDesig?: boolean;
  }) => {
    const desig = desigBadge(role.designation);
    const isSaving = savingIds.has(role.id);
    const isDragging = draggingId === role.id;
    return (
      <div className={`transition-opacity ${isSaving || isDragging ? "opacity-50" : ""}`}>
        <div
          draggable={isDraggable}
          onDragStart={isDraggable ? e => handleDragStart(e, role) : undefined}
          onDragEnd={isDraggable ? handleDragEnd : undefined}
          className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg border text-xs bg-white ${
            isDraggable ? "cursor-grab active:cursor-grabbing border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm" : "border-gray-200"
          } select-none transition-all`}
        >
          {isDraggable && <i className="ti ti-grip-vertical text-gray-300 shrink-0" style={{ fontSize: 10 }} />}
          <span className="font-medium text-gray-800">{role.name}</span>
          {role.area && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
              {role.area}
            </span>
          )}
          {showDesig && desig && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0 ${desig.cls}`}>{desig.label}</span>
          )}
          <button type="button" title="Configure scope" onClick={() => toggleScope(role)}
            className={`shrink-0 ${openScope === role.id ? "text-blue-500" : "text-gray-300 hover:text-blue-400"} transition-colors`}>
            <i className="ti ti-settings" style={{ fontSize: 10 }} />
          </button>
          {removable && (
            <button type="button" title="Remove" onClick={() => setPendingRemove(role)}
              className="shrink-0 text-gray-300 hover:text-red-400 transition-colors">
              <i className="ti ti-x" style={{ fontSize: 9 }} />
            </button>
          )}
        </div>
        {renderScopePanel(role)}
      </div>
    );
  };

  // ── Add popover (shared) ──────────────────────────────────────────────────
  const AddPopover = ({ tier }: { tier: string }) => {
    const freeRoles = orgRoles.filter(r => !r.permission_tier);
    const term = addSearch.trim().toLowerCase();
    const options = getUniqueNames(freeRoles).filter(g => !term || g.name.toLowerCase().includes(term)).slice(0, 8);
    return (
      <div ref={addRef} className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
        <div className="p-2 border-b border-gray-100">
          <input autoFocus type="text" placeholder="Search roles…" value={addSearch}
            onChange={e => setAddSearch(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {options.length === 0
            ? <p className="px-3 py-3 text-xs text-gray-400 italic">No unassigned roles.</p>
            : options.map(({ name, instances }) => (
              <button key={name} type="button"
                onClick={() => { requestAssign(name, instances, tier); setAddTier(null); setAddSearch(""); }}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                <span className="text-xs font-medium text-gray-800 truncate">{name}</span>
                {instances.length > 1 && (
                  <span className="ml-2 shrink-0 text-[10px] text-gray-400 bg-gray-100 rounded px-1">×{instances.length}</span>
                )}
              </button>
            ))
          }
        </div>
      </div>
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const paRoles   = orgRoles.filter(r => r.permission_tier === "power_admin");
  const faRoles   = orgRoles.filter(r => r.permission_tier === "functional_admin");
  const freeRoles = orgRoles.filter(r => !r.permission_tier);
  const faAutoRoles   = faRoles.filter(r => r.designation === "head_of_department" || r.designation === "head_of_entity");
  const faManualRoles = faRoles.filter(r => r.designation !== "head_of_department" && r.designation !== "head_of_entity");

  const paCCGroups = groupByCostCenter(paRoles);
  const uaCCGroups = groupByCostCenter(freeRoles);

  return (
    <PageContainer maxWidth="7xl">
      <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Back
      </button>
      <PageHeading title="Roles & permissions" />
      <p className="text-sm text-gray-500 mb-4">
        Permissions by org role — HoD+ auto Functional Admin. Drag chips between columns to reassign. Same-name roles share a slot; expand to edit individual scope.
      </p>

      <div className="flex border-b border-gray-200 mb-5 gap-1">
        <TabBtn id="tiers"       active={tab === "tiers"}       onClick={handleTabChange} label="Role tiers" />
        <TabBtn id="assignments" active={tab === "assignments"} onClick={handleTabChange} label="Role assignments" />
      </div>

      {isExpired ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">Your session has expired.</p>
          <button type="button" onClick={async () => { await logout(); window.location.href = "/auth/login"; }}
            className="text-xs text-red-700 border border-red-300 px-2.5 py-1 rounded hover:bg-red-100">Sign in again</button>
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
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.consultant}`}>ZivaBI Consultant</span></td>
                  <td className="px-4 py-3 text-gray-700">ZivaBI implementation team</td>
                  <td className="px-4 py-3 text-gray-700">Super admin only</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-600 text-white">Full — all sections, always</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.power_admin}`}>Tenant Power Admin</span></td>
                  <td className="px-4 py-3 text-gray-700">Finance Director / CFO</td>
                  <td className="px-4 py-3 text-gray-700">ZivaBI Consultant</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-300">Full by default — adjustable per role</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.functional_admin}`}>Functional Admin</span></td>
                  <td className="px-4 py-3 text-gray-700">Department / Cost Center Heads</td>
                  <td className="px-4 py-3 text-gray-700">Consultant or Power Admin</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Configured per section per role</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Role assignments — 3-column ── */}
      {tab === "assignments" && !isExpired && (
        <>
          {rolesLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : orgRoles.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <i className="ti ti-sitemap block mb-2" style={{ fontSize: 36, color: "#d1d5db" }} />
              <p className="font-semibold text-gray-600 mb-1">No org roles defined yet</p>
              <p className="text-xs">Go to Organisation → Structure to build your role hierarchy first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 items-start">

              {/* ── Tenant Power Admin ── */}
              <div className="border border-gray-200 rounded-xl overflow-visible">
                <div className="px-3 py-2.5 bg-white border-b border-gray-100 flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.power_admin}`}>Tenant Power Admin</span>
                  <div className="relative">
                    <button type="button"
                      onClick={() => { setAddTier(addTier === "power_admin" ? null : "power_admin"); setAddSearch(""); }}
                      className="flex items-center gap-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50 transition-colors">
                      <i className="ti ti-plus" style={{ fontSize: 11 }} /> Add
                    </button>
                    {addTier === "power_admin" && <AddPopover tier="power_admin" />}
                  </div>
                </div>
                <p className="px-3 py-1.5 text-[10px] text-gray-400 bg-gray-50 border-b border-gray-100">
                  Full access by default. Drag or + Add to assign.
                </p>
                <div
                  onDragOver={e => handleDragOver(e, "power_admin")}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, "power_admin")}
                  className={`p-2 min-h-[80px] transition-colors ${dragOverTier === "power_admin" ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : ""}`}
                >
                  {paRoles.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-1">Drag or + Add roles here.</p>
                  ) : (
                    paCCGroups.map(({ cc, ccRoles }) => (
                      <div key={cc} className="mb-3 last:mb-0">
                        <p className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                          <i className="ti ti-square-filled" style={{ fontSize: 7, color: "#9ca3af" }} />
                          {cc}
                        </p>
                        <div className="space-y-1 ml-2">
                          {ccRoles.map(r => <RoleChip key={r.id} role={r} draggable removable showDesig />)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Functional Admin ── */}
              <div className="border border-gray-200 rounded-xl overflow-visible">
                <div className="px-3 py-2.5 bg-white border-b border-gray-100 flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.functional_admin}`}>Functional Admin</span>
                  <div className="relative">
                    <button type="button"
                      onClick={() => { setAddTier(addTier === "functional_admin" ? null : "functional_admin"); setAddSearch(""); }}
                      className="flex items-center gap-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50 transition-colors">
                      <i className="ti ti-plus" style={{ fontSize: 11 }} /> Add
                    </button>
                    {addTier === "functional_admin" && <AddPopover tier="functional_admin" />}
                  </div>
                </div>
                <p className="px-3 py-1.5 text-[10px] text-gray-400 bg-gray-50 border-b border-gray-100">
                  HoD+ auto-included. Drag PA role here to demote.
                </p>
                <div
                  onDragOver={e => handleDragOver(e, "functional_admin")}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, "functional_admin")}
                  className={`p-2 min-h-[80px] transition-colors ${dragOverTier === "functional_admin" ? "bg-green-50 ring-2 ring-green-300 ring-inset" : ""}`}
                >
                  {faRoles.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-1">No roles assigned yet.</p>
                  ) : (
                    <>
                      {/* Auto section */}
                      {faAutoRoles.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">HOD & ABOVE — AUTO</p>
                          <div className="space-y-1.5">
                            {faAutoRoles.map(r => (
                              <div key={r.id} className="flex items-start gap-2">
                                <span className="flex items-center gap-0.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide shrink-0 w-28 pt-1.5">
                                  <i className="ti ti-square-filled" style={{ fontSize: 7, color: "#9ca3af" }} />
                                  <span className="truncate">{r.cost_center_name || "—"}</span>
                                </span>
                                <RoleChip role={r} draggable showDesig />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Manual section */}
                      {faManualRoles.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">ADDITIONALLY ASSIGNED</p>
                          <div className="space-y-1.5">
                            {faManualRoles.map(r => (
                              <div key={r.id} className="flex items-start gap-2">
                                <span className="flex items-center gap-0.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide shrink-0 w-28 pt-1.5">
                                  <i className="ti ti-square-filled" style={{ fontSize: 7, color: "#9ca3af" }} />
                                  <span className="truncate">{r.cost_center_name || "—"}</span>
                                </span>
                                <RoleChip role={r} draggable removable showDesig />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── Unassigned ── */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2.5 bg-white border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Unassigned</span>
                  <span className="text-xs text-gray-400">{freeRoles.length} roles</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {uaCCGroups.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-gray-400 italic">All roles have been assigned.</p>
                  ) : uaCCGroups.map(({ cc, ccRoles }) => {
                    const isExpanded = expandedGroups.has(cc);
                    return (
                      <div key={cc}>
                        <button type="button" onClick={() => toggleGroup(cc)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <i className="ti ti-square-filled shrink-0" style={{ fontSize: 7, color: "#9ca3af" }} />
                            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide truncate">{cc}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="text-[10px] text-gray-400">{ccRoles.length} {ccRoles.length === 1 ? "role" : "roles"}</span>
                            <i className={`ti ${isExpanded ? "ti-chevron-down" : "ti-chevron-right"} text-gray-400`} style={{ fontSize: 10 }} />
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-2 space-y-1">
                            {ccRoles.map(r => (
                              <div key={r.id}
                                draggable
                                onDragStart={e => handleDragStart(e, r)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-sm transition-all select-none ${draggingId === r.id ? "opacity-40" : ""}`}
                              >
                                <i className="ti ti-grip-vertical text-gray-300 shrink-0" style={{ fontSize: 10 }} />
                                <span className="font-medium text-gray-700 truncate">{r.name}</span>
                                {r.area && (
                                  <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded-full text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100">{r.area}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* ── Assignment prompt ── */}
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
            <div className="px-5 py-3 space-y-2 max-h-60 overflow-y-auto">
              {assignPrompt.instances.map(r => (
                <label key={r.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                  <input type="checkbox" checked={promptSelected.has(r.id)}
                    onChange={e => { const n = new Set(promptSelected); e.target.checked ? n.add(r.id) : n.delete(r.id); setPromptSelected(n); }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.cost_center_name || "General"}{r.area ? ` / ${r.area}` : ""}{r.sub_area ? ` / ${r.sub_area}` : ""}</p>
                    {r.occupants.length > 0 && <p className="text-[10px] text-gray-400">{r.occupants.length} occupant{r.occupants.length !== 1 ? "s" : ""}</p>}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100">
              <button type="button"
                onClick={() => { const all = assignPrompt.instances.every(r => promptSelected.has(r.id)); setPromptSelected(all ? new Set() : new Set(assignPrompt.instances.map(r => r.id))); }}
                className="text-xs text-gray-500 hover:text-gray-700">
                {assignPrompt.instances.every(r => promptSelected.has(r.id)) ? "Deselect all" : "Select all"}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setAssignPrompt(null); setPromptSelected(new Set()); }}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">Cancel</button>
                <button type="button" disabled={promptSelected.size === 0 || savingIds.size > 0}
                  onClick={async () => { await saveTierForIds([...promptSelected], assignPrompt.tier); setAssignPrompt(null); setPromptSelected(new Set()); }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {savingIds.size > 0 ? "Assigning…" : `Assign ${promptSelected.size}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove confirm ── */}
      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Remove from tier?</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{pendingRemove.name}</span>
                {pendingRemove.cost_center_name && ` (${pendingRemove.cost_center_name})`} will lose its permission tier.
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button type="button" onClick={() => setPendingRemove(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">Cancel</button>
              <button type="button" disabled={savingIds.has(pendingRemove.id)}
                onClick={async () => { await saveTierForIds([pendingRemove.id], null); setPendingRemove(null); }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
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
