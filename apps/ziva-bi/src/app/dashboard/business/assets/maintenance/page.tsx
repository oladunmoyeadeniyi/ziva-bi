"use client";

/**
 * Asset Maintenance Costs page — /dashboard/business/assets/maintenance
 *
 * Lists all maintenance cost records across the tenant.
 * Shows the record maintenance cost form inline.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import Button from "@/components/Button";

interface MaintenanceCost {
  id: string;
  asset_id: string;
  asset_name: string;
  maintenance_date: string;
  description: string;
  cost: number;
  currency_code: string;
  maintenance_type: string | null;
  vendor_name: string | null;
  reference: string | null;
}

interface AssetOption { id: string; code: string; name: string; }

const MAINTENANCE_TYPES = ["REPAIR", "PREVENTIVE", "INSPECTION", "UPGRADE", "OTHER"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MaintenancePage() {
  const { accessToken } = useAuth();
  const [records, setRecords] = useState<MaintenanceCost[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    asset_id: "",
    maintenance_date: new Date().toISOString().split("T")[0],
    description: "",
    cost: "",
    currency_code: "NGN",
    maintenance_type: "REPAIR",
    vendor_name: "",
    reference: "",
  });

  const fetchRecords = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<MaintenanceCost[]>("/api/assets/maintenance", { token: accessToken });
      setRecords(Array.isArray(data) ? data : []);
    } catch { setError("Failed to load maintenance records."); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    fetchRecords();
    if (accessToken) {
      apiFetch<{ assets: AssetOption[] }>("/api/fixed-assets/assets", { token: accessToken })
        .then(d => setAssets(d.assets ?? []))
        .catch(() => {});
    }
  }, [accessToken, fetchRecords]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !form.asset_id) { setError("Select an asset."); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/assets/maintenance", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          ...form,
          cost: parseFloat(form.cost),
          vendor_name: form.vendor_name || null,
          reference: form.reference || null,
        }),
      });
      setShowForm(false);
      setForm({ asset_id: "", maintenance_date: new Date().toISOString().split("T")[0], description: "", cost: "", currency_code: "NGN", maintenance_type: "REPAIR", vendor_name: "", reference: "" });
      await fetchRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const totalCost = records.reduce((s, r) => s + r.cost, 0);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageHeading>Asset Maintenance</PageHeading>
          <p className="text-sm text-gray-500 mt-1">Track repair and maintenance spend across all assets.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(s => !s)}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} />
          Record maintenance
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total maintenance spend (all time)</p>
          <p className="text-xl font-bold text-gray-800">{fmt(totalCost)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Records</p>
          <p className="text-xl font-bold text-gray-800">{records.length}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">
          {error}
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Record Maintenance Cost</h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Asset *</label>
                <select
                  required value={form.asset_id}
                  onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="">— Select asset —</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input
                  required type="date" value={form.maintenance_date}
                  onChange={e => setForm(f => ({ ...f, maintenance_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={form.maintenance_type}
                  onChange={e => setForm(f => ({ ...f, maintenance_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  {MAINTENANCE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cost *</label>
                <div className="flex gap-2">
                  <select value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                    {["NGN","USD","GBP","EUR"].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input
                    required type="number" min="0" step="0.01" value={form.cost}
                    onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
              <input
                required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder="Brief description of work done"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor / contractor</label>
                <input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="Optional" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="Invoice or work order #" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save record"}
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
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No maintenance records yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Asset</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.asset_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.maintenance_date}</td>
                  <td className="px-4 py-3">
                    {r.maintenance_type && (
                      <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full">
                        {r.maintenance_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {r.currency_code} {fmt(r.cost)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.vendor_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
