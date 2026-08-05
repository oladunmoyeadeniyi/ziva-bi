"use client";

/**
 * Platform Team — /platform/team
 *
 * Lists all PRAD super-admin users (the internal team).
 * SA can invite a new team member, which creates a super_admin user
 * with a temporary password they must change on first login.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import Button from "@/components/Button";

interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
}

export default function PlatformTeamPage() {
  const { accessToken } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "" });
  const [saving, setSaving] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; temp_password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<TeamMember[]>("/api/platform/team", { token: accessToken });
      setMembers(Array.isArray(data) ? data : []);
    } catch { setError("Failed to load team."); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ email: string; temp_password: string; message: string }>(
        "/api/platform/team/invite",
        { method: "POST", token: accessToken, body: JSON.stringify(form) }
      );
      setNewCreds({ email: result.email, temp_password: result.temp_password });
      setShowForm(false);
      setForm({ email: "", first_name: "", last_name: "" });
      await fetchTeam();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer maxWidth="4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageHeading>Team</PageHeading>
          <p className="text-sm text-gray-500 mt-1">PRAD internal team members with super-admin access.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(s => !s)}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} />
          Invite team member
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">
          {error}
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* New credentials reveal */}
      {newCreds && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-800 mb-2">Team member created</p>
          <p className="text-xs text-green-700 mb-1">Email: <span className="font-mono">{newCreds.email}</span></p>
          <p className="text-xs text-green-700 mb-2">
            Temporary password: <span className="font-mono bg-green-100 px-1.5 py-0.5 rounded">{newCreds.temp_password}</span>
          </p>
          <p className="text-xs text-green-600">Share this securely. They must change it on first login.</p>
          <button type="button" onClick={() => setNewCreds(null)}
            className="mt-2 text-xs text-green-700 underline">Dismiss</button>
        </div>
      )}

      {/* Invite form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Invite Team Member</h3>
          <form onSubmit={inviteMember} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="First name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="Last name" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder="team@prad.com" />
            </div>
            <div className="flex gap-3">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Creating…" : "Create account"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No team members found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Joined</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Last login</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-semibold text-purple-700">
                        {(m.full_name || m.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{m.full_name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      m.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}>
                      {m.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.last_login ? new Date(m.last_login).toLocaleString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
