"use client";

/**
 * Issue Asset form — /dashboard/business/assets/issuances/new
 *
 * Staff can be assigned via employee picker.
 * Locations (outlets, warehouses) can be entered as free text.
 * One or the other must be provided.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import Button from "@/components/Button";

interface AssetOption { id: string; code: string; name: string; }
interface EmployeeOption { id: string; full_name: string; employee_number: string; }

type AssigneeType = "employee" | "location";

export default function IssueAssetPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [assigneeType, setAssigneeType] = useState<AssigneeType>("employee");
  const [form, setForm] = useState({
    asset_id: "",
    employee_id: "",
    location_name: "",
    issue_date: new Date().toISOString().split("T")[0],
    expected_return_date: "",
    condition_at_issue: "GOOD",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<{ assets: AssetOption[] }>("/api/fixed-assets/assets", { token: accessToken })
      .then(d => setAssets(d.assets ?? []))
      .catch(() => {});
    apiFetch<{ employees: EmployeeOption[] }>("/api/hr/employees?active=true", { token: accessToken })
      .then(d => setEmployees(d.employees ?? []))
      .catch(() => {});
  }, [accessToken]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!form.asset_id) { setError("Select an asset."); return; }
    if (assigneeType === "employee" && !form.employee_id) { setError("Select an employee."); return; }
    if (assigneeType === "location" && !form.location_name.trim()) { setError("Enter a location name."); return; }

    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/assets/issuances", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          asset_id: form.asset_id,
          employee_id: assigneeType === "employee" ? form.employee_id : null,
          location_name: assigneeType === "location" ? form.location_name : null,
          issue_date: form.issue_date,
          expected_return_date: form.expected_return_date || null,
          condition_at_issue: form.condition_at_issue,
          notes: form.notes || null,
        }),
      });
      router.push("/dashboard/business/assets/issuances");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <PageHeading>Issue Asset</PageHeading>
        <p className="text-sm text-gray-500 mt-1">Record the assignment of an asset to a staff member or location.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-lg">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Asset *</label>
            <select
              required
              value={form.asset_id}
              onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="">— Select asset —</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>

          {/* Assignee type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assign to *</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(["employee", "location"] as AssigneeType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAssigneeType(t)}
                  className={`flex-1 py-2 font-medium capitalize transition-colors ${
                    assigneeType === t ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {t === "employee" ? "Staff member" : "Location / outlet"}
                </button>
              ))}
            </div>
          </div>

          {assigneeType === "employee" ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
              <select
                value={form.employee_id}
                onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="">— Select employee —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.employee_number} — {emp.full_name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location name *</label>
              <input
                value={form.location_name}
                onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder="e.g. Ikeja outlet, Lagos warehouse"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issue date *</label>
              <input
                required type="date"
                value={form.issue_date}
                onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected return</label>
              <input
                type="date"
                value={form.expected_return_date}
                onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Condition at issue</label>
            <select
              value={form.condition_at_issue}
              onChange={e => setForm(f => ({ ...f, condition_at_issue: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              {["GOOD", "FAIR", "POOR"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
              placeholder="Optional notes"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Issue asset"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
