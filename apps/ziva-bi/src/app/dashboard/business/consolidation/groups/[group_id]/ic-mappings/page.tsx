"use client";

/**
 * IC Account Mappings page — tag GL accounts with intercompany roles per entity.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface IcMapping {
  id: string;
  member_tenant_id: string;
  gl_account_id: string;
  ic_role: string;
  counterparty_tenant_id: string | null;
  created_at: string;
}

const IC_ROLES = ["RECEIVABLE", "PAYABLE", "REVENUE", "EXPENSE", "LOAN_ASSET", "LOAN_LIABILITY"];

const ROLE_COLORS: Record<string, string> = {
  RECEIVABLE: "bg-blue-50 text-blue-700",
  PAYABLE: "bg-orange-50 text-orange-700",
  REVENUE: "bg-green-50 text-green-700",
  EXPENSE: "bg-red-50 text-red-600",
  LOAN_ASSET: "bg-purple-50 text-purple-700",
  LOAN_LIABILITY: "bg-yellow-50 text-yellow-700",
};

export default function IcMappingsPage() {
  const { group_id } = useParams<{ group_id: string }>();
  const { accessToken } = useAuth();
  const [mappings, setMappings] = useState<IcMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    member_tenant_id: "",
    gl_account_id: "",
    ic_role: "RECEIVABLE",
    counterparty_tenant_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadMappings = () => {
    if (!accessToken) return;
    apiFetch<IcMapping[]>(`/api/consolidation/groups/${group_id}/ic-mappings`, { token: accessToken })
      .then(setMappings)
      .catch(() => setError("Failed to load mappings."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMappings(); }, [accessToken, group_id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      await apiFetch(
        `/api/consolidation/groups/${group_id}/members/${form.member_tenant_id}/ic-mappings`,
        {
          token: accessToken,
          method: "POST",
          body: {
            gl_account_id: form.gl_account_id,
            ic_role: form.ic_role,
            counterparty_tenant_id: form.counterparty_tenant_id || null,
          },
        }
      );
      setForm({ member_tenant_id: "", gl_account_id: "", ic_role: "RECEIVABLE", counterparty_tenant_id: "" });
      loadMappings();
    } catch {
      setError("Failed to add mapping. Check field values.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mappingId: string) => {
    if (!accessToken || !confirm("Delete this mapping?")) return;
    try {
      await apiFetch(`/api/consolidation/groups/${group_id}/ic-mappings/${mappingId}`, {
        token: accessToken,
        method: "DELETE",
      });
      loadMappings();
    } catch {
      alert("Failed to delete mapping.");
    }
  };

  return (
    <PageContainer>
      <PageHeading
        title="IC Account Mappings"
        subtitle="Tag GL accounts with intercompany roles to enable auto-matching"
        backHref={`/dashboard/business/consolidation/groups/${group_id}/members`}
      />

      {/* Add mapping form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h3 className="font-medium text-gray-800 mb-3">Add Mapping</h3>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Member Tenant ID *</label>
            <input
              className="input"
              value={form.member_tenant_id}
              onChange={(e) => setForm({ ...form, member_tenant_id: e.target.value })}
              required
              placeholder="UUID"
            />
          </div>
          <div>
            <label className="label">GL Account ID *</label>
            <input
              className="input"
              value={form.gl_account_id}
              onChange={(e) => setForm({ ...form, gl_account_id: e.target.value })}
              required
              placeholder="UUID"
            />
          </div>
          <div>
            <label className="label">IC Role *</label>
            <select
              className="input"
              value={form.ic_role}
              onChange={(e) => setForm({ ...form, ic_role: e.target.value })}
            >
              {IC_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Counterparty Tenant ID (optional)</label>
            <input
              className="input"
              value={form.counterparty_tenant_id}
              onChange={(e) => setForm({ ...form, counterparty_tenant_id: e.target.value })}
              placeholder="UUID — leave blank for any member"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Adding…" : "Add Mapping"}
            </button>
          </div>
        </form>
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Loading…</p>}

      {!loading && mappings.length === 0 && (
        <p className="text-gray-500 py-8 text-center">No IC account mappings yet.</p>
      )}

      {!loading && mappings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">GL Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Counterparty</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-mono text-xs">{m.member_tenant_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.gl_account_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.ic_role] || "bg-gray-100 text-gray-600"}`}>
                      {m.ic_role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {m.counterparty_tenant_id ? `${m.counterparty_tenant_id.slice(0, 8)}…` : "Any"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
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
