"use client";

/**
 * Consolidation Group — Members page.
 * Displays and manages entity memberships in a consolidation group.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface Member {
  id: string;
  member_tenant_id: string;
  ownership_pct: number;
  joined_at: string;
  left_at: string | null;
}

export default function GroupMembersPage() {
  const { group_id } = useParams<{ group_id: string }>();
  const { accessToken } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addForm, setAddForm] = useState({ member_tenant_id: "", ownership_pct: "100" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const loadMembers = () => {
    if (!accessToken) return;
    apiFetch<Member[]>(`/api/consolidation/groups/${group_id}/members`, { token: accessToken })
      .then(setMembers)
      .catch(() => setError("Failed to load members."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMembers(); }, [accessToken, group_id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setAdding(true);
    setAddError("");
    try {
      await apiFetch(`/api/consolidation/groups/${group_id}/members`, {
        token: accessToken,
        method: "POST",
        body: {
          member_tenant_id: addForm.member_tenant_id,
          ownership_pct: parseFloat(addForm.ownership_pct),
        },
      });
      setAddForm({ member_tenant_id: "", ownership_pct: "100" });
      loadMembers();
    } catch {
      setAddError("Failed to add member. Ensure the tenant ID is valid.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!accessToken || !confirm("Remove this entity from the group?")) return;
    try {
      await apiFetch(`/api/consolidation/groups/${group_id}/members/${memberId}`, {
        token: accessToken,
        method: "DELETE",
      });
      loadMembers();
    } catch {
      alert("Failed to remove member.");
    }
  };

  return (
    <PageContainer>
      <PageHeading
        title="Group Members"
        subtitle="Entities included in this consolidation group"
        backHref="/dashboard/business/consolidation"
        actions={
          <div className="flex gap-2">
            <Link href={`/dashboard/business/consolidation/groups/${group_id}/ic-mappings`} className="btn-secondary text-sm">
              IC Mappings
            </Link>
            <Link href={`/dashboard/business/consolidation/groups/${group_id}/matches`} className="btn-secondary text-sm">
              IC Matches
            </Link>
          </div>
        }
      />

      {/* Add member form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h3 className="font-medium text-gray-800 mb-3">Add Entity</h3>
        {addError && <p className="text-red-600 text-sm mb-3">{addError}</p>}
        <form onSubmit={handleAdd} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Tenant ID *</label>
            <input
              className="input"
              value={addForm.member_tenant_id}
              onChange={(e) => setAddForm({ ...addForm, member_tenant_id: e.target.value })}
              required
              placeholder="UUID of the subsidiary tenant"
            />
          </div>
          <div className="w-32">
            <label className="label">Ownership %</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input"
              value={addForm.ownership_pct}
              onChange={(e) => setAddForm({ ...addForm, ownership_pct: e.target.value })}
            />
          </div>
          <button type="submit" disabled={adding} className="btn-primary">
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      {/* Member list */}
      {loading && <p className="text-gray-500 text-center py-8">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && members.length === 0 && (
        <p className="text-gray-500 text-center py-8">No entities added yet.</p>
      )}

      {!loading && members.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tenant ID</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ownership %</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.member_tenant_id}</td>
                  <td className="px-4 py-3 text-right">{m.ownership_pct}%</td>
                  <td className="px-4 py-3 text-gray-500">{m.joined_at}</td>
                  <td className="px-4 py-3">
                    {m.left_at ? (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Removed {m.left_at}</span>
                    ) : (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!m.left_at && (
                      <button
                        onClick={() => handleRemove(m.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
