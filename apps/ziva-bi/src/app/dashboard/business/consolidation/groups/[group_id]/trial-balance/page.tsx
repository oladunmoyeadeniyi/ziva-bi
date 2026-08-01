"use client";

/**
 * Consolidated Trial Balance page — shows the group-level TB
 * after applying all elimination journals for a given period.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface TbLine {
  account_code: string;
  account_name: string;
  entity_balances: Record<string, { debit: number; credit: number }>;
  eliminations_dr: number;
  eliminations_cr: number;
  consolidated_debit: number;
  consolidated_credit: number;
}

interface TbResponse {
  group_id: string;
  period_id: string;
  currency: string;
  lines: TbLine[];
  total_debit: number;
  total_credit: number;
  ic_difference: number;
}

export default function ConsolidatedTrialBalancePage() {
  const { group_id } = useParams<{ group_id: string }>();
  const { accessToken } = useAuth();
  const [periodId, setPeriodId] = useState("");
  const [tb, setTb] = useState<TbResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTb = async () => {
    if (!accessToken || !periodId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<TbResponse>(
        `/api/consolidation/groups/${group_id}/periods/${periodId}/trial-balance`,
        { token: accessToken }
      );
      setTb(data);
    } catch {
      setError("Failed to load trial balance. Check the Period ID.");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading
        title="Consolidated Trial Balance"
        subtitle="Post-elimination trial balance across all group entities"
        backHref={`/dashboard/business/consolidation/groups/${group_id}/journals`}
      />

      <div className="flex gap-3 mb-6">
        <input
          className="input w-72"
          placeholder="Accounting Period ID (UUID)"
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
        />
        <button onClick={loadTb} disabled={loading} className="btn-primary">
          {loading ? "Loading…" : "Load TB"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {tb && (
        <>
          <div className="flex gap-4 mb-4">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Currency</p>
              <p className="font-bold text-lg">{tb.currency}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Total Debit</p>
              <p className="font-bold text-lg">{fmt(tb.total_debit)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Total Credit</p>
              <p className="font-bold text-lg">{fmt(tb.total_credit)}</p>
            </div>
            <div className={`border rounded-lg px-4 py-3 text-center ${tb.ic_difference === 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <p className="text-xs text-gray-500 mb-0.5">IC Difference</p>
              <p className={`font-bold text-lg ${tb.ic_difference === 0 ? "text-green-700" : "text-red-600"}`}>
                {fmt(tb.ic_difference)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Elim. DR</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Elim. CR</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 text-indigo-700">Consol. DR</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 text-indigo-700">Consol. CR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tb.lines.map((line) => (
                  <tr key={line.account_code}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{line.account_code}</td>
                    <td className="px-4 py-2.5">{line.account_name}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-orange-600">{Number(line.eliminations_dr) > 0 ? fmt(line.eliminations_dr) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-orange-600">{Number(line.eliminations_cr) > 0 ? fmt(line.eliminations_cr) : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-indigo-700">{Number(line.consolidated_debit) > 0 ? fmt(line.consolidated_debit) : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-indigo-700">{Number(line.consolidated_credit) > 0 ? fmt(line.consolidated_credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(tb.total_debit)}</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(tb.total_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
