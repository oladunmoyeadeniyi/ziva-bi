"use client";

/**
 * Inventory Locations page — M17.
 * Manages warehouse zones, shelves, and bins.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface Location {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  is_active: boolean;
}

export default function InventoryLocationsPage() {
  const { accessToken } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", code: "", parent_id: "" });

  const load = () => {
    if (!accessToken) return;
    apiFetch<Location[]>("/api/inventory/locations", { token: accessToken })
      .then(setLocations)
      .catch(() => setError("Failed to load locations."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/inventory/locations", {
        token: accessToken!,
        method: "POST",
        body: { name: form.name, code: form.code, parent_id: form.parent_id || null },
      });
      setShowForm(false);
      setForm({ name: "", code: "", parent_id: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create location.");
    } finally {
      setSaving(false);
    }
  };

  const locMap = Object.fromEntries(locations.map(l => [l.id, l]));

  return (
    <PageContainer>
      <PageHeading
        title="Warehouse Locations"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-4 py-2 rounded-md text-white"
            style={{ background: "var(--ziva-primary, #2563EB)" }}
          >
            + New Location
          </button>
        }
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {showForm && (
        <div className="bg-white border rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4">New Warehouse Location</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="Main Warehouse" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Code *</label>
              <input required value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="WH-A1" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Parent Location</label>
              <select value={form.parent_id} onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="">None (top-level)</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm text-white rounded-md"
                style={{ background: "var(--ziva-primary, #2563EB)" }}>
                {saving ? "Saving…" : "Create Location"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border rounded-md text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Parent</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : locations.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No locations defined yet.</td></tr>
            ) : locations.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{l.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {l.parent_id ? `${locMap[l.parent_id]?.code ?? "—"} — ${locMap[l.parent_id]?.name ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {l.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
