"use client";

/**
 * Internal Stores — /dashboard/business/stores
 *
 * Keeper-managed consumables tracking. Four tabs:
 *   Issues     — record and list item issuances to employees/departments
 *   Returns    — record and list item returns
 *   Stock      — all store items with current stock vs minimum levels
 *   Analytics  — per-item consumption rates, days of stock, reorder flags
 *
 * No employee self-service — the store keeper records all movements directly.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreItem {
  id: string;
  item_name: string;
  item_code: string;
  unit_of_measure: string | null;
  current_stock: number;
  minimum_stock_level: number | null;
  reorder_quantity: number | null;
}

interface StoreIssue {
  id: string;
  item_name: string;
  item_code: string;
  employee_name: string | null;
  department: string | null;
  location_name: string | null;
  quantity_issued: number;
  unit_of_measure: string | null;
  issue_date: string;
  purpose: string | null;
  reference: string | null;
}

interface StoreReturn {
  id: string;
  item_name: string;
  item_code: string;
  employee_name: string | null;
  quantity_returned: number;
  return_date: string;
  condition: string;
}

interface AnalyticsItem {
  inventory_item_id: string;
  item_name: string;
  item_code: string;
  unit_of_measure: string | null;
  current_stock: number;
  minimum_stock_level: number | null;
  reorder_quantity: number | null;
  total_issued_30d: number;
  avg_daily_usage: number;
  avg_monthly_usage: number;
  days_of_stock_remaining: number | null;
  below_minimum: boolean;
  reorder_recommended: boolean;
  last_issue_date: string | null;
}

interface EmployeeOption { id: string; full_name: string; employee_number: string; }

type Tab = "issues" | "returns" | "stock" | "analytics";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function ConditionBadge({ c }: { c: string }) {
  const map: Record<string, string> = {
    GOOD: "bg-green-50 text-green-700 border-green-100",
    PARTIAL: "bg-amber-50 text-amber-700 border-amber-100",
    DAMAGED: "bg-red-50 text-red-700 border-red-100",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[c] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}>{c}</span>;
}

// ── Issue Form ────────────────────────────────────────────────────────────────

function IssueForm({
  storeItems,
  employees,
  onSaved,
  onCancel,
  token,
}: {
  storeItems: StoreItem[];
  employees: EmployeeOption[];
  onSaved: () => void;
  onCancel: () => void;
  token: string;
}) {
  const [assigneeType, setAssigneeType] = useState<"employee" | "department" | "location">("employee");
  const [form, setForm] = useState({
    inventory_item_id: "",
    employee_id: "",
    department: "",
    location_name: "",
    quantity_issued: "",
    issue_date: new Date().toISOString().split("T")[0],
    purpose: "",
    reference: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.inventory_item_id) { setError("Select an item."); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch("/api/stores/issues", {
        method: "POST", token,
        body: JSON.stringify({
          inventory_item_id: form.inventory_item_id,
          employee_id: assigneeType === "employee" ? form.employee_id || null : null,
          department: assigneeType === "department" ? form.department || null : null,
          location_name: assigneeType === "location" ? form.location_name || null : null,
          quantity_issued: parseFloat(form.quantity_issued),
          issue_date: form.issue_date,
          purpose: form.purpose || null,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setSaving(false); }
  }

  const selectedItem = storeItems.find(i => i.id === form.inventory_item_id);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Record Store Issue</h3>
      {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Item *</label>
            <select required value={form.inventory_item_id} onChange={e => setForm(f => ({ ...f, inventory_item_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
              <option value="">— Select —</option>
              {storeItems.map(i => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
            </select>
            {selectedItem && (
              <p className="text-xs text-gray-400 mt-0.5">In stock: {fmt(selectedItem.current_stock)} {selectedItem.unit_of_measure ?? ""}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
            <input required type="number" min="0.001" step="any" value={form.quantity_issued}
              onChange={e => setForm(f => ({ ...f, quantity_issued: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Issue date *</label>
            <input required type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
            <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="Optional" />
          </div>
        </div>

        {/* Issued to */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Issued to *</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm mb-2">
            {(["employee", "department", "location"] as const).map(t => (
              <button key={t} type="button" onClick={() => setAssigneeType(t)}
                className={`flex-1 py-1.5 font-medium capitalize transition-colors ${assigneeType === t ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                {t}
              </button>
            ))}
          </div>
          {assigneeType === "employee" && (
            <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
              <option value="">— Select employee (optional) —</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.employee_number} — {emp.full_name}</option>)}
            </select>
          )}
          {assigneeType === "department" && (
            <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="e.g. Finance, Sales, Operations" />
          )}
          {assigneeType === "location" && (
            <input value={form.location_name} onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="e.g. Ikeja outlet, Lagos warehouse" />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Purpose</label>
          <input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            placeholder="Brief reason" />
        </div>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? "Saving…" : "Record issue"}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ── Return Form ───────────────────────────────────────────────────────────────

function ReturnForm({
  storeItems,
  employees,
  onSaved,
  onCancel,
  token,
}: {
  storeItems: StoreItem[];
  employees: EmployeeOption[];
  onSaved: () => void;
  onCancel: () => void;
  token: string;
}) {
  const [form, setForm] = useState({
    inventory_item_id: "",
    employee_id: "",
    quantity_returned: "",
    return_date: new Date().toISOString().split("T")[0],
    condition: "GOOD",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await apiFetch("/api/stores/returns", {
        method: "POST", token,
        body: JSON.stringify({
          inventory_item_id: form.inventory_item_id,
          employee_id: form.employee_id || null,
          quantity_returned: parseFloat(form.quantity_returned),
          return_date: form.return_date,
          condition: form.condition,
          notes: form.notes || null,
        }),
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Record Return</h3>
      {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Item *</label>
            <select required value={form.inventory_item_id} onChange={e => setForm(f => ({ ...f, inventory_item_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
              <option value="">— Select —</option>
              {storeItems.map(i => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity returned *</label>
            <input required type="number" min="0.001" step="any" value={form.quantity_returned}
              onChange={e => setForm(f => ({ ...f, quantity_returned: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Return date *</label>
            <input required type="date" value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
            <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
              {["GOOD", "PARTIAL", "DAMAGED"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Returned by</label>
            <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
              <option value="">— Unknown —</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.employee_number} — {emp.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? "Saving…" : "Record return"}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StoresPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("issues");
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [issues, setIssues] = useState<StoreIssue[]>([]);
  const [returns, setReturns] = useState<StoreReturn[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [items, issList, retList, empList] = await Promise.all([
        apiFetch<StoreItem[]>("/api/stores/items", { token: accessToken }),
        apiFetch<StoreIssue[]>("/api/stores/issues", { token: accessToken }),
        apiFetch<StoreReturn[]>("/api/stores/returns", { token: accessToken }),
        apiFetch<{ employees: EmployeeOption[] }>("/api/hr/employees?active=true", { token: accessToken }),
      ]);
      setStoreItems(Array.isArray(items) ? items : []);
      setIssues(Array.isArray(issList) ? issList : []);
      setReturns(Array.isArray(retList) ? retList : []);
      setEmployees(empList.employees ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [accessToken]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<AnalyticsItem[]>("/api/stores/analytics", { token: accessToken });
      setAnalytics(Array.isArray(data) ? data : []);
    } catch {}
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "analytics") loadAnalytics(); }, [tab, loadAnalytics]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "issues", label: "Issues" },
    { key: "returns", label: "Returns" },
    { key: "stock", label: "Stock levels" },
    { key: "analytics", label: "Usage analytics" },
  ];

  const reorderCount = analytics.filter(a => a.reorder_recommended).length;

  return (
    <PageContainer maxWidth="5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageHeading>Internal Stores</PageHeading>
          <p className="text-sm text-gray-500 mt-1">Track consumable items — stationery, spare parts, supplies.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setShowReturnForm(s => !s); setShowIssueForm(false); setTab("returns"); }}>
            <i className="ti ti-corner-down-left" style={{ fontSize: 14 }} /> Record return
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setShowIssueForm(s => !s); setShowReturnForm(false); setTab("issues"); }}>
            <i className="ti ti-plus" style={{ fontSize: 14 }} /> Record issue
          </Button>
        </div>
      </div>

      {/* Reorder alert */}
      {reorderCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          <i className="ti ti-alert-triangle text-amber-500" style={{ fontSize: 16 }} />
          <span>{reorderCount} item{reorderCount > 1 ? "s" : ""} recommended for reorder. Check the Analytics tab.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Forms */}
      {showIssueForm && (
        <IssueForm storeItems={storeItems} employees={employees} token={accessToken!}
          onSaved={() => { setShowIssueForm(false); load(); }}
          onCancel={() => setShowIssueForm(false)} />
      )}
      {showReturnForm && (
        <ReturnForm storeItems={storeItems} employees={employees} token={accessToken!}
          onSaved={() => { setShowReturnForm(false); load(); }}
          onCancel={() => setShowReturnForm(false)} />
      )}

      {/* Issues tab */}
      {tab === "issues" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            : issues.length === 0 ? <EmptyState icon="hand-move" title="No issues recorded" description="Record the first store issue using the button above." compact />
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Issued to</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((iss, i) => (
                    <tr key={iss.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 font-medium text-gray-800">{iss.item_name} <span className="text-gray-400 text-xs">({iss.item_code})</span></td>
                      <td className="px-4 py-3 text-gray-600">{iss.employee_name ?? iss.department ?? iss.location_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(iss.quantity_issued)} {iss.unit_of_measure ?? ""}</td>
                      <td className="px-4 py-3 text-gray-500">{iss.issue_date}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{iss.purpose ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{iss.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* Returns tab */}
      {tab === "returns" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            : returns.length === 0 ? <EmptyState icon="corner-down-left" title="No returns recorded" description="Record a return using the button above." compact />
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Returned by</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.item_name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.employee_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.quantity_returned)}</td>
                      <td className="px-4 py-3 text-gray-500">{r.return_date}</td>
                      <td className="px-4 py-3"><ConditionBadge c={r.condition} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* Stock levels tab */}
      {tab === "stock" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            : storeItems.length === 0 ? <EmptyState icon="package" title="No store items configured" description="Mark inventory items as store items via Inventory → Items → Edit." compact />
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">In stock</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Min level</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Reorder qty</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {storeItems.map((item, i) => {
                    const low = item.minimum_stock_level != null && item.current_stock < item.minimum_stock_level;
                    return (
                      <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-4 py-3 font-medium text-gray-800">{item.item_name} <span className="text-gray-400 text-xs">({item.item_code})</span></td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${low ? "text-red-600" : "text-gray-800"}`}>{fmt(item.current_stock)} {item.unit_of_measure ?? ""}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{item.minimum_stock_level ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{item.reorder_quantity ?? "—"}</td>
                        <td className="px-4 py-3">
                          {low ? (
                            <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Below minimum</span>
                          ) : (
                            <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* Analytics tab */}
      {tab === "analytics" && (
        <div className="space-y-3">
          {analytics.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
              No store items configured yet.
            </div>
          ) : analytics.map(a => (
            <div key={a.inventory_item_id} className={`bg-white rounded-xl border p-4 ${a.reorder_recommended ? "border-amber-200 bg-amber-50/30" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{a.item_name} <span className="text-gray-400 font-normal">({a.item_code})</span></p>
                  {a.reorder_recommended && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 mt-0.5">
                      <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} /> Reorder recommended
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-6 text-right shrink-0">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">In stock</p>
                    <p className={`text-sm font-bold tabular-nums ${a.below_minimum ? "text-red-600" : "text-gray-800"}`}>{fmt(a.current_stock)} {a.unit_of_measure ?? ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Avg/month</p>
                    <p className="text-sm font-bold tabular-nums text-gray-800">{a.avg_monthly_usage.toFixed(1)} {a.unit_of_measure ?? ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Issued (30d)</p>
                    <p className="text-sm font-bold tabular-nums text-gray-800">{fmt(a.total_issued_30d)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Days left</p>
                    <p className={`text-sm font-bold tabular-nums ${a.days_of_stock_remaining != null && a.days_of_stock_remaining < 14 ? "text-red-600" : "text-gray-800"}`}>
                      {a.days_of_stock_remaining != null ? `${a.days_of_stock_remaining}d` : "—"}
                    </p>
                  </div>
                </div>
              </div>
              {a.last_issue_date && <p className="text-xs text-gray-400 mt-2">Last issued: {a.last_issue_date}</p>}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
