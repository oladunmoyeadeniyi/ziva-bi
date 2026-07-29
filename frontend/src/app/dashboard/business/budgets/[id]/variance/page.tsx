"use client";

/**
 * Budget vs Actuals Variance report page — M16 Budget & Planning.
 *
 * Shows each GL account's annual budget, YTD budget (pro-rated),
 * actual spend, variance amount, and variance %.
 * Colour-codes rows: green if under budget, red if over budget.
 *
 * Data source is shown in the header:
 *   Full ERP → GL journal entries
 *   Connected → posting batches
 *   Lite      → expense reports + AP invoices
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface VarianceRow {
  gl_account_id: string | null;
  gl_code: string | null;
  gl_name: string | null;
  department_name: string | null;
  annual_budget: string;
  ytd_budget: string;
  actual_amount: string;
  variance: string;
  variance_pct: number | null;
}

interface VarianceTotals {
  annual_budget: string;
  ytd_budget: string;
  actual_amount: string;
  variance: string;
  variance_pct: number | null;
}

interface VarianceReport {
  period_id: string;
  period_name: string;
  as_at_date: string;
  data_source: string;
  rows: VarianceRow[];
  totals: VarianceTotals;
}

const DATA_SOURCE_LABELS: Record<string, string> = {
  gl_entries: "GL Journal Entries (Full ERP)",
  posting_batches: "Posting Batches (Connected)",
  expense_reports: "Expense Reports + AP Invoices (Lite)",
};

function VarianceCell({ value, pct }: { value: number; pct: number | null }) {
  const isOver = value < 0;
  return (
    <td className={`px-4 py-2 text-right font-mono ${isOver ? "text-red-600" : "text-green-700"}`}>
      <div>{formatMoney(value)}</div>
      {pct !== null && (
        <div className="text-xs opacity-70">{isOver ? "" : "+"}{pct.toFixed(1)}%</div>
      )}
    </td>
  );
}

export default function VariancePage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [asAtDate, setAsAtDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");

  const runReport = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<VarianceReport>(`/api/budgets/${id}/variance?as_at_date=${asAtDate}`);
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load variance report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runReport(); }, []);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeading
          title="Budget vs Actuals"
          subtitle={report ? report.period_name : "Loading…"}
        />
        <Link href={`/dashboard/business/budgets/${id}`}>
          <Button variant="secondary">← Back to Budget</Button>
        </Link>
      </div>

      {/* Controls */}
      <div className="flex items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-600 mb-1 font-medium">As At Date</label>
          <input
            type="date"
            value={asAtDate}
            onChange={(e) => setAsAtDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <Button onClick={runReport} disabled={loading}>
          {loading ? "Running…" : "Run Report"}
        </Button>
        {report && (
          <div className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
            Data source: {DATA_SOURCE_LABELS[report.data_source] ?? report.data_source}
          </div>
        )}
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <div className="text-xs text-gray-500 mb-1">Annual Budget</div>
              <div className="text-lg font-semibold">{formatMoney(parseFloat(report.totals.annual_budget))}</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-xs text-gray-500 mb-1">YTD Budget</div>
              <div className="text-lg font-semibold">{formatMoney(parseFloat(report.totals.ytd_budget))}</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-xs text-gray-500 mb-1">Actual Spend</div>
              <div className="text-lg font-semibold">{formatMoney(parseFloat(report.totals.actual_amount))}</div>
            </div>
            <div className={`rounded-xl border p-4 ${parseFloat(report.totals.variance) >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <div className="text-xs text-gray-500 mb-1">Variance (YTD)</div>
              <div className={`text-lg font-semibold ${parseFloat(report.totals.variance) >= 0 ? "text-green-700" : "text-red-600"}`}>
                {formatMoney(parseFloat(report.totals.variance))}
              </div>
              {report.totals.variance_pct !== null && (
                <div className="text-xs text-gray-500">{report.totals.variance_pct.toFixed(1)}%</div>
              )}
            </div>
          </div>

          {/* Variance table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">GL Account</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Annual Budget</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">YTD Budget</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actual</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">No budget lines found.</td>
                  </tr>
                ) : (
                  report.rows.map((row, i) => (
                    <tr key={i} className={`hover:bg-gray-50 ${parseFloat(row.variance) < 0 ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-2">
                        <div className="font-mono text-xs text-gray-700">{row.gl_code ?? "—"}</div>
                        <div className="text-gray-600">{row.gl_name ?? row.department_name ?? "Unspecified"}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(parseFloat(row.annual_budget))}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(parseFloat(row.ytd_budget))}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(parseFloat(row.actual_amount))}</td>
                      <VarianceCell value={parseFloat(row.variance)} pct={row.variance_pct} />
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t bg-gray-100">
                <tr>
                  <td className="px-4 py-3 font-bold">Totals</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatMoney(parseFloat(report.totals.annual_budget))}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatMoney(parseFloat(report.totals.ytd_budget))}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatMoney(parseFloat(report.totals.actual_amount))}</td>
                  <VarianceCell value={parseFloat(report.totals.variance)} pct={report.totals.variance_pct} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
