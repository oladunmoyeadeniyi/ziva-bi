"use client";

/**
 * Stock Valuation Report page — M17.
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
  current_quantity: number;
  moving_average_cost: number;
  total_value: number;
  valuation_method: string;
  reorder_point: number | null;
  below_reorder: boolean;
}

interface ValuationResponse {
  as_at: string;
  rows: ValuationRow[];
  total_inventory_value: number;
}

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
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Total Value</th>
              <th className="px-4 py-3 text-left">Method</th>
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
                <td className="px-4 py-3 text-right font-mono">₦{fmt(r.moving_average_cost)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">₦{fmt(r.total_value)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.valuation_method}</td>
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
                <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">₦{fmt(data.total_inventory_value)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </PageContainer>
  );
}
