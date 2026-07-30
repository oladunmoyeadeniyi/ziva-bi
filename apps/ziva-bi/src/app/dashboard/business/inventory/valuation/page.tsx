"use client";

/**
 * Stock Valuation Report page — M17 / M17b.
 *
 * Shows current inventory value per item, with unit_cost computed by the
 * backend using the item's costing method:
 *   WACC     — moving average cost
 *   FIFO     — weighted average of open cost layers (layer_value / qty_remaining)
 *   STANDARD — standard cost (budgeted unit cost)
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface ValuationRow {
  item_id: string;
  item_code: string;
  item_name: string;
  category_name: string | null;
  unit_of_measure: string;
  valuation_method: string;
  current_quantity: number;
  unit_cost: number;
  total_value: number;
  reorder_point: number | null;
  below_reorder: boolean;
}

interface ValuationResponse {
  as_at: string;
  rows: ValuationRow[];
  total_inventory_value: number;
}

const METHOD_LABELS: Record<string, string> = {
  WACC: "WACC",
  FIFO: "FIFO",
  STANDARD: "STD",
};

const METHOD_TOOLTIPS: Record<string, string> = {
  WACC: "Weighted Average Cost — unit cost is the moving average",
  FIFO: "First In First Out — unit cost is the weighted average of open lots",
  STANDARD: "Standard Cost — unit cost is the budgeted standard rate",
};

export default function ValuationPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<ValuationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ValuationResponse>("/api/inventory/valuation", { token: accessToken })
      .then(setData)
      .catch(() => setError("Failed to load valuation report."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const fmt = (n: number) =>
    n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading
        title="Stock Valuation Report"
        actions={data ? <p className="text-sm text-gray-500">As at {data.as_at}</p> : undefined}
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {data && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-5 py-4">
          <p className="text-xs text-blue-600 uppercase tracking-wider mb-1">Total Inventory Value</p>
          <p className="text-3xl font-bold text-blue-800">₦{fmt(data.total_inventory_value)}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-left">UoM</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
              <th className="px-4 py-3 text-right">Total Value</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : !data || data.rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No inventory items.</td></tr>
            ) : data.rows.map(r => (
              <tr key={r.item_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.item_code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{r.item_name}</td>
                <td className="px-4 py-3 text-gray-500">{r.category_name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{Number(r.current_quantity).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-500">{r.unit_of_measure}</td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 cursor-help"
                    title={METHOD_TOOLTIPS[r.valuation_method] ?? r.valuation_method}
                  >
                    {METHOD_LABELS[r.valuation_method] ?? r.valuation_method}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">₦{fmt(r.unit_cost)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">₦{fmt(r.total_value)}</td>
                <td className="px-4 py-3 text-center">
                  {r.below_reorder ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Low</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {data && (
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">₦{fmt(data.total_inventory_value)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Unit cost reflects the item&apos;s costing method: WACC = moving average; FIFO = weighted average of open lots; Standard = budgeted standard cost.
      </p>
    </PageContainer>
  );
}
