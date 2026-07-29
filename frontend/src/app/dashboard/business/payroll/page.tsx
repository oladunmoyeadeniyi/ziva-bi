"use client";

/**
 * Payroll Runs page — M15.
 * Lists payroll runs with totals; supports creating and approving runs.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface PayrollRun {
  id: string;
  reference: string;
  period_name: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross: number;
  total_paye: number;
  total_net: number;
  employee_count: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  APPROVED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-600",
};

export default function PayrollRunsPage() {
  const { accessToken } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ period_start: "", period_end: "" });

  const load = () => {
    if (!accessToken) return;
    apiFetch<PayrollRun[]>("/api/payroll/runs", { token: accessToken })
      .then(setRuns).catch(() => setError("Failed to load payroll runs.")).finally(() => setLoading(false));
  };

  useEffect(load, [accessToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/payroll/runs", {
        token: accessToken!, method: "POST",
        body: { period_start: form.period_start, period_end: form.period_end },
      });
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err?.message || "Failed to create payroll run.");
    } finally { setSaving(false); }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm("Approve this payroll run? This will create a GL journal entry.")) return;
    try {
      await apiFetch(`/api/payroll/runs/${id}/approve`, { token: accessToken!, method: "POST" });
      load();
    } catch (err: any) { setError(err?.message || "Failed to approve."); }
  };

  const fmt = (n: number) => n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading
        title="Payroll Runs"
        actions={
          <button onClick={() => setShowCreate(true)} className="text-sm px-4 py-2 rounded-md text-white"
            style={{ background: "var(--ziva-primary, #2563EB)" }}>+ New Payroll Run</button>
        }
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {showCreate && (
        <div className="bg-white border rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4">Create Payroll Run</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-600 mb-1">Period Start *</label>
              <input type="date" required value={form.period_start}
                onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Period End *</label>
              <input type="date" required value={form.period_end}
                onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white rounded-md"
                style={{ background: "var(--ziva-primary, #2563EB)" }}>{saving ? "Running…" : "Run Payroll"}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-md text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Reference</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-right">Employees</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">PAYE</th>
              <th className="px-4 py-3 text-right">Net Pay</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : runs.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No payroll runs yet.</td></tr>
              : runs.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{r.reference}</td>
                  <td className="px-4 py-3 text-gray-600">{r.period_start} → {r.period_end}</td>
                  <td className="px-4 py-3 text-right">{r.employee_count}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(r.total_gross)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">₦{fmt(r.total_paye)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">₦{fmt(r.total_net)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.status === "DRAFT" && (
                      <button onClick={() => handleApprove(r.id)} className="text-xs text-blue-600 hover:underline">Approve</button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
