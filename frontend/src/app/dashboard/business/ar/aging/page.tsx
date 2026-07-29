"use client";

/**
 * AR Aging report — /dashboard/business/ar/aging
 *
 * Shows outstanding (APPROVED, unreceived) AR invoices grouped by customer,
 * bucketed by days overdue: Current, 1-30, 31-60, 61-90, 90+.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgingBucket {
  current: string;
  days_1_30: string;
  days_31_60: string;
  days_61_90: string;
  days_over_90: string;
  total: string;
}

interface AgingRow {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  buckets: AgingBucket;
  invoice_count: number;
}

interface AgingResponse {
  as_at_date: string;
  rows: AgingRow[];
  totals: AgingBucket;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const m = (v: string | number) => formatMoney(parseFloat(String(v)) || 0);

function AgingCell({ value }: { value: string }) {
  const n = parseFloat(value) || 0;
  return (
    <td className={`px-4 py-3 text-right tabular-nums text-sm ${n > 0 ? "font-medium text-gray-800" : "text-gray-300"}`}>
      {n > 0 ? m(value) : "—"}
    </td>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ArAgingPage() {
  const { accessToken } = useAuth();

  const [asAtDate, setAsAtDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<AgingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAging = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = asAtDate ? `?as_at_date=${asAtDate}` : "";
      const result = await apiFetch<AgingResponse>(`/api/ar/aging${params}`, { token: accessToken });
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load aging report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAging(); }, [accessToken]);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <PageHeading title="AR Aging Report" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">As at date</label>
          <input
            type="date"
            value={asAtDate}
            onChange={e => setAsAtDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <button
            onClick={fetchAging}
            className="px-4 py-1.5 text-sm font-medium text-white rounded-md"
            style={{ background: "var(--ziva-primary, #4F46E5)" }}
          >
            Run
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
      )}

      {loading && <p className="text-gray-400 text-sm py-4">Loading…</p>}

      {data && !loading && (
        <>
          <p className="text-xs text-gray-500 mb-3">
            Outstanding AR as at <strong>{data.as_at_date}</strong> — {data.rows.length} customer{data.rows.length !== 1 ? "s" : ""} with open balances
          </p>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-yellow-600">1–30 days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-orange-600">31–60 days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-red-500">61–90 days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase text-red-700">90+ days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-800 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No outstanding AR balances.</td></tr>
                ) : (
                  data.rows.map(row => (
                    <tr key={row.customer_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{row.customer_name}</div>
                        <div className="text-xs text-gray-400">{row.customer_code} · {row.invoice_count} invoice{row.invoice_count !== 1 ? "s" : ""}</div>
                      </td>
                      <AgingCell value={row.buckets.current} />
                      <AgingCell value={row.buckets.days_1_30} />
                      <AgingCell value={row.buckets.days_31_60} />
                      <AgingCell value={row.buckets.days_61_90} />
                      <AgingCell value={row.buckets.days_over_90} />
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">
                        {m(row.buckets.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Grand Total</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{m(data.totals.current)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-yellow-700">{m(data.totals.days_1_30)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-orange-700">{m(data.totals.days_31_60)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-red-500">{m(data.totals.days_61_90)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-red-700">{m(data.totals.days_over_90)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-indigo-700">{m(data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
