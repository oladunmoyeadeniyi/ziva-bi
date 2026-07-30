"use client";

/**
 * Inventory Items page — M17 / M17b.
 *
 * Lists all SKUs with current stock levels and a "+ New Item" form supporting
 * all three costing methods: WACC (moving average), FIFO (lot tracking), and
 * STANDARD (fixed standard cost with PPV journaling).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  category_name: string | null;
  unit_of_measure: string;
  current_quantity: number;
  moving_average_cost: number;
  standard_cost: number;
  valuation_method: "WACC" | "FIFO" | "STANDARD";
  reorder_point: number | null;
  is_active: boolean;
}

interface InventoryCategory {
  id: string;
  name: string;
  code: string;
}

interface NewItemForm {
  item_code: string;
  name: string;
  description: string;
  unit_of_measure: string;
  category_id: string;
  valuation_method: "WACC" | "FIFO" | "STANDARD";
  standard_cost: string;
  gl_ppv_id: string;
  gl_inventory_id: string;
  gl_cogs_id: string;
  reorder_point: string;
}

interface GlAccount {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  is_active: boolean;
}

const METHOD_INFO: Record<string, { label: string; description: string }> = {
  WACC: {
    label: "WACC — Weighted Average Cost",
    description:
      "Moving average cost updates on every receipt. Best for high-volume fungible goods.",
  },
  FIFO: {
    label: "FIFO — First In, First Out",
    description:
      "Each receipt creates a cost lot. Issues consume the oldest lots first. Ideal for perishables, beverage, or batch-tracked goods.",
  },
  STANDARD: {
    label: "Standard Cost",
    description:
      "Inventory is valued at a fixed budgeted rate. Difference between actual and standard is posted as Purchase Price Variance (PPV). Used by FMCG trading subsidiaries and manufacturers.",
  },
};

const EMPTY_FORM: NewItemForm = {
  item_code: "",
  name: "",
  description: "",
  unit_of_measure: "PCS",
  category_id: "",
  valuation_method: "WACC",
  standard_cost: "0",
  gl_ppv_id: "",
  gl_inventory_id: "",
  gl_cogs_id: "",
  reorder_point: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadItems = () => {
    if (!accessToken) return;
    setLoading(true);
    apiFetch<InventoryItem[]>(
      `/api/inventory/items?active_only=true&low_stock=${showLowStock}`,
      { token: accessToken }
    )
      .then(setItems)
      .catch(() => setError("Failed to load inventory items."))
      .finally(() => setLoading(false));
  };

  useEffect(loadItems, [accessToken, showLowStock]);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      apiFetch<InventoryCategory[]>("/api/inventory/categories", { token: accessToken }),
      apiFetch<GlAccount[]>("/api/config/coa?limit=500", { token: accessToken }),
    ])
      .then(([cats, gl]) => {
        setCategories(cats);
        setGlAccounts((Array.isArray(gl) ? gl : []).filter(a => a.is_active));
      })
      .catch(() => {/* non-critical */});
  }, [accessToken]);

  // ── Per-item display cost (best available from list endpoint) ──────────────
  const displayCost = (item: InventoryItem): number => {
    if (item.valuation_method === "STANDARD") return item.standard_cost;
    return item.moving_average_cost; // WACC and FIFO: MAC is best available on list view
  };

  const totalValue = items.reduce(
    (sum, i) => sum + i.current_quantity * displayCost(i),
    0
  );

  const fmt = (n: number) =>
    n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Form handlers ──────────────────────────────────────────────────────────
  const setField = (k: keyof NewItemForm, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const openModal = () => {
    setForm(EMPTY_FORM);
    setSaveError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload: Record<string, unknown> = {
        item_code: form.item_code.trim(),
        name: form.name.trim(),
        unit_of_measure: form.unit_of_measure.trim() || "PCS",
        valuation_method: form.valuation_method,
        standard_cost: form.valuation_method === "STANDARD" ? parseFloat(form.standard_cost || "0") : 0,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.category_id) payload.category_id = form.category_id;
      if (form.reorder_point) payload.reorder_point = parseFloat(form.reorder_point);
      if (form.gl_inventory_id.trim()) payload.gl_inventory_id = form.gl_inventory_id.trim();
      if (form.gl_cogs_id.trim()) payload.gl_cogs_id = form.gl_cogs_id.trim();
      if (form.valuation_method === "STANDARD" && form.gl_ppv_id.trim())
        payload.gl_ppv_id = form.gl_ppv_id.trim();

      await apiFetch("/api/inventory/items", {
        token: accessToken,
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowModal(false);
      loadItems();
    } catch {
      setSaveError("Failed to create item. Check all required fields.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      <PageHeading
        title="Inventory Items"
        actions={
          <div className="flex gap-2">
            <button
              onClick={openModal}
              className="text-sm px-4 py-2 rounded-md text-white"
              style={{ background: "var(--ziva-primary, #2563EB)" }}
            >
              + New Item
            </button>
            <Link
              href="/dashboard/business/inventory/movements"
              className="text-sm px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              + Stock Movement
            </Link>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total SKUs</p>
          <p className="text-2xl font-bold text-gray-800">{items.length}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Inventory Value</p>
          <p className="text-2xl font-bold text-gray-800">₦{fmt(totalValue)}</p>
          <p className="text-xs text-gray-400 mt-1">See Valuation Report for exact figures</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600">
            {items.filter(i => i.reorder_point !== null && i.current_quantity <= i.reorder_point).length}
          </p>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setShowLowStock(false)}
          className={`text-sm px-3 py-1 rounded-md border ${!showLowStock ? "bg-blue-50 border-blue-300 text-blue-700 font-medium" : "text-gray-500"}`}
        >
          All Items
        </button>
        <button
          onClick={() => setShowLowStock(true)}
          className={`text-sm px-3 py-1 rounded-md border ${showLowStock ? "bg-red-50 border-red-300 text-red-700 font-medium" : "text-gray-500"}`}
        >
          Low Stock Only
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Item Name</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-left">UoM</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-center">Stock Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No inventory items found.</td></tr>
            ) : items.map(item => {
              const cost = displayCost(item);
              const value = item.current_quantity * cost;
              const isLow = item.reorder_point !== null && item.current_quantity <= item.reorder_point;
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.item_code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(item.current_quantity).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit_of_measure}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(cost)}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(value)}</td>
                  <td className="px-4 py-3">
                    <span
                      title={METHOD_INFO[item.valuation_method]?.description}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 cursor-help"
                    >
                      {item.valuation_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isLow ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Low Stock</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── New Item Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">New Inventory Item</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item Code *</label>
                  <input
                    type="text"
                    value={form.item_code}
                    onChange={e => setField("item_code", e.target.value)}
                    placeholder="e.g. RB-250-CAN"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setField("name", e.target.value)}
                    placeholder="e.g. Red Bull 250ml Can"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    value={form.unit_of_measure}
                    onChange={e => setField("unit_of_measure", e.target.value)}
                    placeholder="PCS / CASE / KG / L"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select
                    value={form.category_id}
                    onChange={e => setField("category_id", e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="">— None —</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setField("description", e.target.value)}
                  rows={2}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Costing method */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Valuation (Costing) Method *</label>
                <div className="space-y-2">
                  {(["WACC", "FIFO", "STANDARD"] as const).map(m => (
                    <label
                      key={m}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.valuation_method === m
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="valuation_method"
                        value={m}
                        checked={form.valuation_method === m}
                        onChange={() => setField("valuation_method", m)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{METHOD_INFO[m].label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{METHOD_INFO[m].description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Standard cost fields — shown only when STANDARD selected */}
              {form.valuation_method === "STANDARD" && (
                <div className="space-y-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Standard Cost Configuration</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Standard Cost per Unit *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.standard_cost}
                        onChange={e => setField("standard_cost", e.target.value)}
                        placeholder="0.00"
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <p className="text-xs text-gray-400 mt-1">Budgeted/target cost. All receipts are valued at this rate.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">PPV GL Account</label>
                      <select
                        value={form.gl_ppv_id}
                        onChange={e => setField("gl_ppv_id", e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                      >
                        <option value="">— None (suppress PPV journals) —</option>
                        {glAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.gl_number} — {a.gl_name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Full ERP only. Difference between actual and standard cost posts here.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* GL accounts (optional, collapsible feel via section header) */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GL Accounts (optional — Full ERP mode)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Inventory Asset Account</label>
                    <select
                      value={form.gl_inventory_id}
                      onChange={e => setField("gl_inventory_id", e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    >
                      <option value="">— None —</option>
                      {glAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.gl_number} — {a.gl_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">COGS Account</label>
                    <select
                      value={form.gl_cogs_id}
                      onChange={e => setField("gl_cogs_id", e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    >
                      <option value="">— None —</option>
                      {glAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.gl_number} — {a.gl_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Reorder point */}
              <div className="w-1/2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Point (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.reorder_point}
                  onChange={e => setField("reorder_point", e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>

            {saveError && (
              <div className="mx-6 mb-3 px-4 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">
                {saveError}
              </div>
            )}

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.item_code.trim() || !form.name.trim()}
                className="text-sm px-5 py-2 rounded-md text-white disabled:opacity-50"
                style={{ background: "var(--ziva-primary, #2563EB)" }}
              >
                {saving ? "Saving…" : "Create Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
