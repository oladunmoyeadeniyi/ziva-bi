"use client";

/**
 * Stock Movements page — M17.
 * Records and lists RECEIPT / ISSUE / ADJUSTMENT / TRANSFER movements.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  unit_of_measure: string;
  valuation_method: string;
}

interface StockMovement {
  id: string;
  item_id: string;
  movement_type: string;
  movement_date: string;
  reference: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
}

const MOVEMENT_TYPES = ["RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER"];

export default function StockMovementsPage() {
  const { accessToken } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    item_id: "",
    movement_type: "RECEIPT",
    movement_date: new Date().toISOString().split("T")[0],
    quantity: "",
    unit_cost: "",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      apiFetch<StockMovement[]>("/api/inventory/movements?limit=100", { token: accessToken }),
      apiFetch<InventoryItem[]>("/api/inventory/items?active_only=true", { token: accessToken }),
    ])
      .then(([mvts, itms]) => {
        setMovements(mvts);
        setItems(itms);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/api/inventory/movements", {
        token: accessToken!,
        method: "POST",
        body: {
          item_id: form.item_id,
          movement_type: form.movement_type,
          movement_date: form.movement_date,
          quantity: parseFloat(form.quantity),
          unit_cost: parseFloat(form.unit_cost || "0"),
          reference: form.reference || null,
          notes: form.notes || null,
        },
      });
      setSuccess("Movement recorded.");
      setShowForm(false);
      // Reload
      const [mvts] = await Promise.all([
        apiFetch<StockMovement[]>("/api/inventory/movements?limit=100", { token: accessToken! }),
      ]);
      setMovements(mvts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record movement.");
    } finally {
      setSaving(false);
    }
  };

  const typeColor = (t: string) => ({
    RECEIPT: "bg-green-50 text-green-700",
    ISSUE: "bg-orange-50 text-orange-700",
    ADJUSTMENT: "bg-blue-50 text-blue-700",
    TRANSFER: "bg-purple-50 text-purple-700",
  }[t] ?? "bg-gray-50 text-gray-700");

  const fmt = (n: number) =>
    n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  return (
    <PageContainer>
      <PageHeading
        title="Stock Movements"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-4 py-2 rounded-md text-white"
            style={{ background: "var(--ziva-primary, #2563EB)" }}
          >
            + Record Movement
          </button>
        }
      />

      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-3 py-2 rounded">{success}</p>}
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* New movement form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Record Stock Movement</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Item *</label>
              <select
                required
                value={form.item_id}
                onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select item</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Movement Type *</label>
              <select
                value={form.movement_type}
                onChange={e => setForm(p => ({ ...p, movement_type: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date *</label>
              <input
                type="date"
                required
                value={form.movement_date}
                onChange={e => setForm(p => ({ ...p, movement_date: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                required
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              {(() => {
                const selItem = items.find(i => i.id === form.item_id);
                const isStdReceipt = selItem?.valuation_method === "STANDARD" && form.movement_type === "RECEIPT";
                return (
                  <>
                    <label className="block text-xs text-gray-600 mb-1">
                      Unit Cost (actual purchase price)
                      {isStdReceipt && <span className="text-red-500 ml-1">* required for Standard-costed items</span>}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required={isStdReceipt}
                      value={form.unit_cost}
                      onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))}
                      className={`w-full border rounded px-3 py-2 text-sm ${isStdReceipt && !form.unit_cost ? "border-amber-400 bg-amber-50" : ""}`}
                    />
                    {isStdReceipt && (
                      <p className="text-xs text-amber-600 mt-1">
                        Enter the actual supplier price. The system will value inventory at the standard cost and post any Purchase Price Variance (PPV) to your configured GL account.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Reference</label>
              <input
                type="text"
                value={form.reference}
                onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="PO-001, SO-003…"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm text-white rounded-md"
                style={{ background: "var(--ziva-primary, #2563EB)" }}
              >
                {saving ? "Saving…" : "Record Movement"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border rounded-md text-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
              <th className="px-4 py-3 text-right">Total Cost</th>
              <th className="px-4 py-3 text-right">Qty After</th>
              <th className="px-4 py-3 text-left">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : movements.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No movements recorded yet.</td></tr>
            ) : movements.map(m => {
              const item = itemMap[m.item_id];
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{m.movement_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor(m.movement_type)}`}>
                      {m.movement_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{item ? `${item.item_code} — ${item.name}` : m.item_id}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(m.quantity).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(m.unit_cost)}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(m.total_cost)}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(m.quantity_after).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.reference ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
