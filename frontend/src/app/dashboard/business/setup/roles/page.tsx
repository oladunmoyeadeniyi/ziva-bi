"use client";

/**
 * Roles & Permissions page — M8.2 Implementation Portal.
 *
 * 2 tabs: Role tiers | Role assignments
 * - ZivaBI Consultant: always full access (locked, no config)
 * - Tenant Power Admin: full access by default, scope configurable per ORG ROLE
 * - Functional Admin: per-role scope — which sections + at what level
 * - Org roles are assigned to a tier; anyone holding the role inherits permissions
 *
 * Drag-and-drop: drag any unassigned role chip into a tier section to assign it.
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

type Tab = "tiers" | "assignments";

const PA_SCOPE_SECTIONS = [
  "Organisation",
  "Module activation",
  "Chart of accounts",
  "Dimensions",
  "Employees",
  "Currencies & FX",
  "Tax & statutory",
  "Roles & permissions",
  "Approval workflows",
  "Document rules",
  "Module setup",
];

const PA_SECTION_DEFAULTS: Record<string, string> = {
  "Roles & permissions": "none",
};

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

const ACCESS_PILL: Record<string, string> = {
  full:      "bg-green-600 text-white border border-green-600 hover:bg-green-700",
  read_only: "bg-blue-600  text-white border border-blue-600  hover:bg-blue-700",
  none:      "bg-white     text-gray-500 border border-gray-300 hover:bg-gray-50",
};
const ACCESS_LABEL: Record<string, string> = { full: "Full access", read_only: "Read only", none: "No access" };

interface OrgRole {
  id: string;
  name: string;
  designation: string | null;
  permission_tier: string | null;
  occupants: { id: string; full_name: string; initials: string; employee_code?: string }[];
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

  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);

  // Drag-and-drop state
  const [draggingRoleId, setDraggingRoleId] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || tab !== "assignments") return;
    setRolesLoading(true);
    apiFetch<OrgRole[]>("/api/approvals/roles", { token: accessToken })
      .then(setOrgRoles)
      .catch((e) => setError(e.message))
      .finally(() => setRolesLoading(false));
  }, [accessToken, tab]);

  const saveTier = async (roleId: string, tier: string | null) => {
    if (!accessToken) return;
    setSavingTier(roleId);
    try {
      await apiFetch(`/api/approvals/roles/${roleId}/permission-tier`, {
        method: "PATCH", token: accessToken, body: { permission_tier: tier },
      });
      setOrgRoles(prev => prev.map(r => r.id === roleId ? { ...r, permission_tier: tier } : r));
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
  const handleDragStart = (e: React.DragEvent, roleId: string) => {
    setDraggingRoleId(roleId);
    e.dataTransfer.setData("roleId", roleId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => { setDraggingRoleId(null); setDragOverTier(null); };
  const handleDragOver = (e: React.DragEvent, tier: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTier(tier); };
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTier(null); };
  const handleDrop = (e: React.DragEvent, tier: string) => {
    e.preventDefault();
    const roleId = e.dataTransfer.getData("roleId");
    if (roleId) saveTier(roleId, tier);
    setDraggingRoleId(null);
    setDragOverTier(null);
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

  // ── Role chip ─────────────────────────────────────────────────────────────
  const renderRoleChip = (role: OrgRole, opts: { bgClass: string; textClass: string; removable?: boolean }) => (
    <div key={role.id} className="mb-2 mr-2 inline-block">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${opts.bgClass}`}>
        <div>
          <span className={`font-medium ${opts.textClass}`}>{role.name}</span>
          {role.occupants.length > 0 && (
            <span className="ml-1.5 text-[10px] text-gray-400">
              {role.occupants.length} {role.occupants.length === 1 ? "occupant" : "occupants"}
            </span>
          )}
        </div>
        <button type="button" title="Configure scope" onClick={() => toggleScope(role)}
          className={`ml-0.5 ${openScope === role.id ? "text-blue-500" : "text-gray-300 hover:text-blue-400"} transition-colors`}>
          <i className="ti ti-settings" style={{ fontSize: 11 }} />
        </button>
        {opts.removable && (
          <button type="button" title="Remove" onClick={() => setPendingRemove({ id: role.id, name: role.name })}
            className="text-gray-300 hover:text-red-400 leading-none transition-colors">
            <i className="ti ti-x" style={{ fontSize: 10 }} />
          </button>
        )}
      </div>
      {renderScopePanel(role)}
    </div>
  );

  const paRoles   = orgRoles.filter(r => r.permission_tier === "power_admin");
  const faRoles   = orgRoles.filter(r => r.permission_tier === "functional_admin");
  const freeRoles = orgRoles.filter(r => !r.permission_tier);

  // ── Tier drop zone ────────────────────────────────────────────────────────
  const TierDropZone = ({
    tier, label, badge, subLabel, chipBg, chipText, roles, dropHighlight,
  }: {
    tier: string; label: string; badge: string; subLabel: string;
    chipBg: string; chipText: string; roles: OrgRole[]; dropHighlight: string;
  }) => (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-start justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE[tier]}`}>{label}</span>
            <span className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${badge}`}>{tier === "power_admin" ? "Full by default" : "Scope per role"}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{subLabel}</p>
        </div>
        {draggingRoleId && (
          <span className="text-[10px] text-blue-500 font-medium mt-1 shrink-0 ml-4 animate-pulse">
            Drop here to assign
          </span>
        )}
      </div>
      <div
        onDragOver={(e) => handleDragOver(e, tier)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, tier)}
        className={`px-4 py-3 min-h-[56px] transition-colors rounded-b-lg ${
          dragOverTier === tier ? dropHighlight : ""
        }`}
      >
        {roles.length === 0 && !dragOverTier ? (
          <p className="text-xs text-gray-400 italic">
            {freeRoles.length > 0 ? "Drag a role here or use + Add role above." : "No roles assigned yet."}
          </p>
        ) : (
          <div>{roles.map(r => renderRoleChip(r, { bgClass: chipBg, textClass: chipText, removable: true }))}</div>
        )}
      </div>
    </div>
  );

  return (
    <PageContainer maxWidth="4xl">
      <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Back
      </button>
      <PageHeading title="Roles & permissions" />
      <p className="text-sm text-gray-500 mb-6">
        Assign org chart roles to permission tiers. Everyone holding that role inherits the settings — no individual user config needed.
      </p>

      <div className="flex border-b border-gray-200 mb-6 gap-1">
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

      {saved && <p className="mb-4 text-xs text-green-600">✓ Saved</p>}

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
        <div className="space-y-4">
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
              {freeRoles.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                  <i className="ti ti-drag-drop" style={{ fontSize: 14 }} />
                  Drag any unassigned role into a tier below to assign it.
                </div>
              )}

              {/* Power Admin */}
              <TierDropZone
                tier="power_admin"
                label="Tenant Power Admin"
                badge="bg-green-100 text-green-800 border border-green-300"
                subLabel="Full access to all setup sections by default. Use ⚙ to restrict per role. Typically Finance Director, CFO roles."
                chipBg="bg-white border-gray-200"
                chipText="text-gray-700"
                roles={paRoles}
                dropHighlight="bg-blue-50 ring-2 ring-blue-300 ring-inset"
              />

              {/* Functional Admin */}
              <TierDropZone
                tier="functional_admin"
                label="Functional Admin"
                badge="bg-blue-100 text-blue-800 border border-blue-200"
                subLabel="Configure which sections each role can access. Use ⚙ on each role to set section-level access."
                chipBg="bg-green-50 border-green-200"
                chipText="text-green-800"
                roles={faRoles}
                dropHighlight="bg-green-50 ring-2 ring-green-300 ring-inset"
              />

              {/* Unassigned — 3-column grid */}
              {freeRoles.length > 0 && (
                <div className="border border-dashed border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Unassigned roles ({freeRoles.length})
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        These roles have no permission tier. Drag them into a tier above to assign.
                      </p>
                    </div>
                    <i className="ti ti-grip-horizontal text-gray-300" style={{ fontSize: 16 }} />
                  </div>
                  <div
                    className="px-4 py-3"
                    style={{ columns: 3, columnGap: "1rem" }}
                  >
                    {freeRoles.map(r => (
                      <div
                        key={r.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, r.id)}
                        onDragEnd={handleDragEnd}
                        style={{ breakInside: "avoid", marginBottom: "0.5rem" }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border bg-white border-gray-200 text-gray-600 cursor-grab active:cursor-grabbing select-none transition-opacity ${
                          draggingRoleId === r.id ? "opacity-40 scale-95" : "hover:border-blue-300 hover:text-blue-700 hover:shadow-sm"
                        }`}
                      >
                        <i className="ti ti-grip-vertical text-gray-300 shrink-0" style={{ fontSize: 11 }} />
                        <span className="font-medium truncate">{r.name}</span>
                        {r.occupants.length > 0 && (
                          <span className="ml-auto shrink-0 text-[10px] text-gray-400 border border-gray-100 rounded px-1">
                            {r.occupants.length}
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
                <span className="font-medium">{pendingRemove.name}</span> will be removed from its permission tier.
                Occupants will lose the inherited permissions at their next login.
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button type="button" onClick={() => setPendingRemove(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={savingTier === pendingRemove.id}
                onClick={async () => { await saveTier(pendingRemove.id, null); setPendingRemove(null); }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {savingTier === pendingRemove.id ? "Removing…" : "Remove"}
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
