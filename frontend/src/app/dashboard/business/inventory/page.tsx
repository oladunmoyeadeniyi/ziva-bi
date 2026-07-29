"use client";

/**
 * Inventory Items page — M17.
 * Lists all SKUs with current stock levels, cost, and reorder alerts.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  category_name: string | null;
  unit_of_measure: string;
  current_quantity: number;
  moving_average_cost: number;
  reorder_point: number | null;
  valuation_method: string;
  is_active: boolean;
}

export default function InventoryPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    apiFetch<InventoryItem[]>(
      `/api/inventory/items?active_only=true&low_stock=${showLowStock}`,
      { token: accessToken }
    )
      .then(setItems)
      .catch(() => setError("Failed to load inventory items."))
      .finally(() => setLoading(false));
  }, [accessToken, showLowStock]);

  const totalValue = items.reduce(
    (sum, i) => sum + i.current_quantity * i.moving_average_cost,
    0
  );

  const fmt = (n: number) =>
    n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading
        title="Inventory Items"
        actions={
          <Link
            href="/dashboard/business/inventory/movements"
            className="text-sm px-4 py-2 rounded-md text-white"
            style={{ background: "var(--ziva-primary, #2563EB)" }}
          >
            + Stock Movement
          </Link>
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
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Total Value</th>
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
              const value = item.current_quantity * item.moving_average_cost;
              const isLow = item.reorder_point !== null && item.current_quantity <= item.reorder_point;
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.item_code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(item.current_quantity).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit_of_measure}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(item.moving_average_cost)}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(value)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.valuation_method}</td>
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
    </PageContainer>
  );
}
