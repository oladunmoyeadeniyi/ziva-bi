"use client";

/**
 * Team management — /dashboard/business/admin/users
 *
 * Tenant Admin only. Two tabs: Users and Invitations.
 * Users tab: view all members, edit roles, deactivate/reactivate.
 * Invitations tab: send invites, view status, cancel pending.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface TenantUser {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  department: string | null;
  job_title: string | null;
  roles: string[];
  is_active: boolean;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by_name: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  accept_url: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  line_manager: "Line Manager",
  finance_reviewer: "Finance Reviewer",
  finance_manager: "Finance Manager",
  gm: "GM",
  tenant_admin: "Tenant Admin",
  approver: "Approver",
};

const ASSIGNABLE_ROLES = [
  { value: "employee", label: "Employee" },
  { value: "line_manager", label: "Line Manager" },
  { value: "finance_reviewer", label: "Finance Reviewer" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "gm", label: "GM" },
  { value: "tenant_admin", label: "Tenant Admin" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB");
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
      active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
    }`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function InviteStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    ACCEPTED: "bg-green-100 text-green-800",
    EXPIRED: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function TeamPage() {
  const { user, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "invitations">("users");

  // Users tab
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Edit roles modal
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesSaving, setRolesSaving] = useState(false);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<TenantUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Invitations tab
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<TenantUser[]>("/api/tenant/users", { token: accessToken })
      .then(setUsers)
      .catch((err) => setUsersError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setUsersLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (activeTab !== "invitations" || !accessToken) return;
    setInvitesLoading(true);
    apiFetch<Invitation[]>("/api/tenant/invitations", { token: accessToken })
      .then(setInvitations)
      .catch((err) => setInvitesError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setInvitesLoading(false));
  }, [activeTab, accessToken]);

  const openEditRoles = (u: TenantUser) => {
    setEditingUser(u);
    setSelectedRoles([...u.roles]);
    setRolesError(null);
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const saveRoles = async () => {
    if (!editingUser || !accessToken) return;
    setRolesSaving(true); setRolesError(null);
    try {
      const updated = await apiFetch<TenantUser>(`/api/tenant/users/${editingUser.id}/roles`, {
        method: "PATCH", token: accessToken,
        body: JSON.stringify({ roles: selectedRoles }),
      });
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      setEditingUser(null);
    } catch (err) {
      setRolesError(err instanceof Error ? err.message : "Failed to save roles.");
    } finally { setRolesSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget || !accessToken) return;
    setDeactivating(true);
    try {
      const updated = await apiFetch<TenantUser>(`/api/tenant/users/${deactivateTarget.id}/deactivate`, {
        method: "PATCH", token: accessToken,
      });
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      setDeactivateTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate.");
    } finally { setDeactivating(false); }
  };

  const handleReactivate = async (userId: string) => {
    if (!accessToken) return;
    try {
      const updated = await apiFetch<TenantUser>(`/api/tenant/users/${userId}/reactivate`, {
        method: "PATCH", token: accessToken,
      });
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reactivate.");
    }
  };

  const handleInvite = async () => {
    if (!accessToken) return;
    if (!inviteEmail.trim()) { setInviteError("Email is required."); return; }
    setInviting(true); setInviteError(null);
    try {
      const inv = await apiFetch<Invitation>("/api/tenant/invitations", {
        method: "POST", token: accessToken,
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInvitations((prev) => [inv, ...prev]);
      setShowInviteModal(false);
      setInviteEmail(""); setInviteRole("employee");
      setInviteSuccess(`Invitation sent to ${inv.email}`);
      setTimeout(() => setInviteSuccess(""), 4000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally { setInviting(false); }
  };

  const handleCancelInvite = async (id: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/tenant/invitations/${id}`, { method: "DELETE", token: accessToken });
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel.");
    }
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      {/* ── Edit Roles modal ─────────────────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Edit Roles</h2>
            <p className="text-sm text-gray-500 mb-4">{editingUser.full_name}</p>
            <div className="flex flex-col gap-2 mb-4">
              {ASSIGNABLE_ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedRoles.includes(r.value)}
                    onChange={() => toggleRole(r.value)}
                    className="accent-blue-600 w-4 h-4" />
                  <span className="text-sm text-gray-800">{r.label}</span>
                </label>
              ))}
            </div>
            {rolesError && <p className="text-xs text-red-600 mb-3">{rolesError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingUser(null)} disabled={rolesSaving}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={saveRoles} disabled={rolesSaving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {rolesSaving ? "Saving…" : "Save Roles"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate confirm ────────────────────────────────────────────── */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Deactivate User?</h2>
            <p className="text-sm text-gray-600 mb-5">
              <strong>{deactivateTarget.full_name}</strong> will no longer be able to log in.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeactivateTarget(null)} disabled={deactivating}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={handleDeactivate} disabled={deactivating}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                {deactivating ? "Deactivating…" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite modal ──────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Invite Team Member</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email address <span className="text-red-500">*</span></label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {inviteError && <p className="mt-2 text-xs text-red-600">{inviteError}</p>}
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => { setShowInviteModal(false); setInviteError(null); setInviteEmail(""); }}
                disabled={inviting}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={handleInvite} disabled={inviting}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {inviting ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage members and invitations</p>
        </div>
        {activeTab === "invitations" && (
          <button type="button" onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + Invite Member
          </button>
        )}
      </div>

      {inviteSuccess && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          ✓ {inviteSuccess}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(["users", "invitations"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab === "users" ? "Users" : "Invitations"}
          </button>
        ))}
      </div>

      {/* ── Users tab ────────────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <>
          {usersLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          )}
          {usersError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{usersError}</div>
          )}
          {!usersLoading && !usersError && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Name", "Email", "Employee Code", "Department", "Roles", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{u.full_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.employee_code ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.department ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">No roles</span>
                          ) : (
                            u.roles.map((r) => (
                              <span key={r} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 font-medium">
                                {ROLE_LABELS[r] ?? r}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge active={u.is_active} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => openEditRoles(u)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                            Edit Roles
                          </button>
                          {u.id !== user?.id && (
                            u.is_active ? (
                              <button type="button" onClick={() => setDeactivateTarget(u)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium">
                                Deactivate
                              </button>
                            ) : (
                              <button type="button" onClick={() => handleReactivate(u.id)}
                                className="text-xs text-green-600 hover:text-green-800 font-medium">
                                Reactivate
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Invitations tab ──────────────────────────────────────────────── */}
      {activeTab === "invitations" && (
        <>
          {invitesLoading && (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          )}
          {invitesError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{invitesError}</div>
          )}
          {!invitesLoading && !invitesError && invitations.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-sm text-gray-500">No invitations sent yet.</p>
              <button type="button" onClick={() => setShowInviteModal(true)}
                className="mt-3 inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                Send First Invite
              </button>
            </div>
          )}
          {!invitesLoading && !invitesError && invitations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Email", "Role", "Invited By", "Status", "Sent", "Expires", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{inv.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ROLE_LABELS[inv.role] ?? inv.role}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{inv.invited_by_name}</td>
                      <td className="px-4 py-3"><InviteStatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(inv.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(inv.expires_at)}</td>
                      <td className="px-4 py-3">
                        {inv.status === "PENDING" && (
                          <div className="flex items-center gap-3">
                            {inv.accept_url && (
                              <button type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(inv.accept_url!);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                                Copy Link
                              </button>
                            )}
                            <button type="button" onClick={() => handleCancelInvite(inv.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium">
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
