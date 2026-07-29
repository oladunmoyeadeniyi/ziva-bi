"use client";

/**
 * Asset Categories page — M18.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface AssetCategory {
  id: string;
  name: string;
  code: string;
  useful_life_months: number;
  depreciation_method: string;
  residual_pct: number;
  is_active: boolean;
}

export default function AssetCategoriesPage() {
  const { accessToken } = useAuth();
  const [cats, setCats] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", code: "", useful_life_months: "60", depreciation_method: "SL", residual_pct: "0" });

  const load = () => {
    if (!accessToken) return;
    apiFetch<AssetCategory[]>("/api/assets/categories", { token: accessToken })
      .then(setCats).catch(() => setError("Failed to load categories.")).finally(() => setLoading(false));
  };

  useEffect(load, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/assets/categories", {
        token: accessToken!, method: "POST",
        body: { ...form, useful_life_months: parseInt(form.useful_life_months), residual_pct: parseFloat(form.residual_pct) },
      });
      setShowForm(false); load();
    } catch (err: any) { setError(err?.message || "Failed."); }
    finally { setSaving(false); }
  };

  return (
    <PageContainer>
      <PageHeading
        title="Asset Categories"
        actions={
          <button onClick={() => setShowForm(true)} className="text-sm px-4 py-2 rounded-md text-white"
            style={{ background: "var(--ziva-primary, #2563EB)" }}>+ New Category</button>
        }
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {showForm && (
        <div className="bg-white border rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4">New Asset Category</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-600 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Code *</label>
              <input required value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Useful Life (months) *</label>
              <input type="number" required value={form.useful_life_months} onChange={e => setForm(p => ({ ...p, useful_life_months: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Depreciation Method</label>
              <select value={form.depreciation_method} onChange={e => setForm(p => ({ ...p, depreciation_method: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                <option value="SL">Straight Line (SL)</option><option value="RB">Reducing Balance (RB)</option>
              </select></div>
            <div><label className="block text-xs text-gray-600 mb-1">Residual % (e.g. 0.05 = 5%)</label>
              <input type="number" step="0.01" min="0" max="1" value={form.residual_pct} onChange={e => setForm(p => ({ ...p, residual_pct: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white rounded-md" style={{ background: "var(--ziva-primary, #2563EB)" }}>
                {saving ? "Saving…" : "Create"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-md text-gray-600">Cancel</button>
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
              <th className="px-4 py-3 text-center">Useful Life</th>
              <th className="px-4 py-3 text-center">Method</th>
              <th className="px-4 py-3 text-right">Residual %</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : cats.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No categories yet.</td></tr>
              : cats.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{c.useful_life_months} months</td>
                  <td className="px-4 py-3 text-center"><span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">{c.depreciation_method}</span></td>
                  <td className="px-4 py-3 text-right font-mono">{(Number(c.residual_pct) * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.is_active ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
