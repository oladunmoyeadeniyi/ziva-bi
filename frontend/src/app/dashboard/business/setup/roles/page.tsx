"use client";

/**
 * Roles & Permissions page — M8.2 Implementation Portal.
 *
 * 3 tabs: Role tiers | Permission matrix | User assignments
 *
 * Route: /dashboard/business/setup/roles
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

type Tab = "tiers" | "matrix" | "assignments";

interface PermCell {
  section: string;
  role_tier: string;
  access_level: string;
}

interface Assignment {
  id: string;
  user_tenant_id: string;
  full_name: string;
  email: string;
  role_tier: string | null;
  is_active: boolean;
}

function TabBtn({
  id,
  active,
  onClick,
  label,
}: {
  id: Tab;
  active: boolean;
  onClick: (t: Tab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

const TIER_BADGE: Record<string, string> = {
  consultant:      "bg-amber-100 text-amber-800 border border-amber-300",
  power_admin:     "bg-blue-100 text-blue-800 border border-blue-300",
  functional_admin:"bg-green-100 text-green-800 border border-green-300",
};

const ACCESS_LABELS: Record<string, string> = {
  full:        "Full access",
  read_only:   "Read only",
  none:        "No access",
  delegatable: "Delegatable",
};

const SECTIONS = [
  "Organisation", "Module activation", "Chart of accounts", "Dimensions",
  "Employees", "Currencies & FX", "Tax & statutory", "Roles & permissions",
  "Approval workflows", "Document rules", "Module setup",
];

export default function RolesPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tiers");
  const [matrix, setMatrix] = useState<PermCell[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    if (tab === "matrix") {
      apiFetch<{ cells: PermCell[] }>("/api/setup/roles/matrix", { token: accessToken })
        .then((d) => setMatrix(d.cells))
        .catch((e) => setError(e.message));
    } else if (tab === "assignments") {
      apiFetch<Assignment[]>("/api/setup/roles/assignments", { token: accessToken })
        .then(setAssignments)
        .catch((e) => setError(e.message));
    }
  }, [accessToken, tab]);

  const saveAssignment = async (id: string, tier: string) => {
    if (!accessToken) return;
    setSaving(true);
    try {
      await apiFetch(`/api/setup/roles/assignments/${id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ role_tier: tier }),
      });
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, role_tier: tier } : a))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  // Build section → role_tier → access_level lookup
  const matrixLookup: Record<string, Record<string, string>> = {};
  for (const cell of matrix) {
    if (!matrixLookup[cell.section]) matrixLookup[cell.section] = {};
    matrixLookup[cell.section][cell.role_tier] = cell.access_level;
  }

  return (
    <div className="p-8 max-w-4xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Roles & permissions</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage the three role tiers, configure the permission matrix, and assign tiers to users.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="tiers"       active={tab === "tiers"}       onClick={setTab} label="Role tiers" />
        <TabBtn id="matrix"      active={tab === "matrix"}      onClick={setTab} label="Permission matrix" />
        <TabBtn id="assignments" active={tab === "assignments"} onClick={setTab} label="User assignments" />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* ── Role tiers tab ── */}
      {tab === "tiers" && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-4">
            Role tier structure is defined by Ziva BI. Contact your consultant to modify.
          </div>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">Role tier</th>
                  <th className="px-4 py-3 text-left">Who holds it</th>
                  <th className="px-4 py-3 text-left">Granted by</th>
                  <th className="px-4 py-3 text-left">Override power</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.consultant}`}>
                      Consultant
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">Ziva BI implementation team</td>
                  <td className="px-4 py-3 text-gray-700">Super admin only</td>
                  <td className="px-4 py-3 text-gray-700">Full — can override everything</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.power_admin}`}>
                      Power Admin
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">Finance Director / CFO</td>
                  <td className="px-4 py-3 text-gray-700">Consultant</td>
                  <td className="px-4 py-3 text-gray-700">Within unlocked sections only</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BADGE.functional_admin}`}>
                      Functional Admin
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">HR, Procurement, etc.</td>
                  <td className="px-4 py-3 text-gray-700">Power Admin</td>
                  <td className="px-4 py-3 text-gray-700">Within delegated scope only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Permission matrix tab ── */}
      {tab === "matrix" && (
        <div>
          {matrix.length === 0 ? (
            <p className="text-sm text-gray-400">Loading matrix…</p>
          ) : (
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left w-48">Section</th>
                    <th className="px-4 py-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TIER_BADGE.consultant}`}>Consultant</span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TIER_BADGE.power_admin}`}>Power Admin</span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TIER_BADGE.functional_admin}`}>Functional Admin</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {SECTIONS.map((sec) => (
                    <tr key={sec}>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{sec}</td>
                      {["consultant", "power_admin", "functional_admin"].map((tier) => (
                        <td key={tier} className="px-4 py-2.5 text-center text-xs text-gray-600">
                          {ACCESS_LABELS[matrixLookup[sec]?.[tier] ?? "none"] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── User assignments tab ── */}
      {tab === "assignments" && (
        <div>
          {saving && <p className="mb-2 text-xs text-gray-400">Saving…</p>}
          {saved && <p className="mb-2 text-xs text-green-600">Saved</p>}
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No users in this tenant.</p>
          ) : (
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role tier</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{a.full_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{a.email}</td>
                      <td className="px-4 py-2.5">
                        {editingId === a.id ? (
                          <select
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                            value={editTier}
                            onChange={(e) => setEditTier(e.target.value)}
                          >
                            <option value="">No tier</option>
                            <option value="power_admin">Power Admin</option>
                            <option value="functional_admin">Functional Admin</option>
                          </select>
                        ) : a.role_tier ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${TIER_BADGE[a.role_tier] ?? "bg-gray-100 text-gray-600"}`}>
                            {a.role_tier.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${a.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {a.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {editingId === a.id ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveAssignment(a.id, editTier)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(a.id);
                              setEditTier(a.role_tier ?? "");
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
