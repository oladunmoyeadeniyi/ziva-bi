"use client";

/**
 * Match Report — /dashboard/business/po/match-report
 *
 * Shows 3-way match status across all invoices that have match records.
 * Highlights variances and payment-blocked invoices.
 * Links to override page for each invoice.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface MatchReportRow {
  invoice_id: string;
  invoice_reference: string;
  vendor_name: string;
  total_invoice_amount: string;
  total_matched_amount: string;
  line_count: number;
  clean_match_count: number;
  variance_count: number;
  payment_blocked: boolean;
  match_statuses: string[];
}

function VarianceBadge({ status }: { status: string }) {
  const cls = status === "MATCHED"
    ? "bg-green-100 text-green-700"
    : status === "MANUAL_OVERRIDE"
    ? "bg-purple-100 text-purple-700"
    : "bg-red-100 text-red-700";
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

export default function MatchReportPage() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<MatchReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MatchReportRow[]>("/api/po/match-report", { token: accessToken });
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load match report.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const blockedCount = rows.filter(r => r.payment_blocked).length;
  const varianceCount = rows.filter(r => r.variance_count > 0).length;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeading title="3-Way Match Report" />
        <Link href="/dashboard/business/po" className="text-sm border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50">
          ← Purchase Orders
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Invoices Matched", value: rows.length },
          { label: "With Variances", value: varianceCount, warn: varianceCount > 0 },
          { label: "Payment Blocked", value: blockedCount, danger: blockedCount > 0 },
        ].map(s => (
          <div key={s.label} className={`border rounded-lg px-4 py-3 ${(s as { danger?: boolean }).danger ? "bg-red-50 border-red-200" : (s as { warn?: boolean }).warn ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-semibold mt-0.5 ${(s as { danger?: boolean }).danger ? "text-red-700" : (s as { warn?: boolean }).warn ? "text-amber-700" : "text-gray-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Invoice","Vendor","Invoice Amount","Matched Amount","Lines","Variances","Statuses","Payment",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No match records yet.{" "}
                    <Link href="/dashboard/business/ap/invoices" className="text-blue-600 hover:underline">Go to invoices to match them.</Link>
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.invoice_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600">
                    <Link href={`/dashboard/business/ap/invoices/${row.invoice_id}`}>{row.invoice_reference}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.vendor_name}</td>
                  <td className="px-4 py-3 font-medium">{formatMoney(parseFloat(row.total_invoice_amount))}</td>
                  <td className="px-4 py-3">{formatMoney(parseFloat(row.total_matched_amount))}</td>
                  <td className="px-4 py-3 text-gray-500">{row.clean_match_count}/{row.line_count}</td>
                  <td className="px-4 py-3">
                    {row.variance_count > 0 ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{row.variance_count} variance{row.variance_count > 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-green-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(row.match_statuses)].map(s => <VarianceBadge key={s} status={s} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.payment_blocked ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">BLOCKED</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/business/po/match/${row.invoice_id}`} className="text-xs text-blue-600 hover:underline">Match</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
