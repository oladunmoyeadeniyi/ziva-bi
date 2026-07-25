"use client";

/**
 * Trial Balance — /dashboard/business/accounting/trial-balance
 *
 * Reads from GET /api/gl/trial-balance with optional date range + include_zero flag.
 * Available to all posting modes (Lite/Connected/Full ERP) — mode guard is on the
 * individual sidebar links for pages that are mode-specific (Financial Statements).
 *
 * Columns: GL#, Account Name, Type, Debit, Credit, Balance (debit − credit).
 * Footer: grand totals + is_balanced integrity indicator.
 *
 * A red banner is shown when is_balanced = false (double-entry integrity failure).
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Banner } from "@/components/Banner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TBRow {
  gl_number: string;
  gl_name: string;
  account_type: string; // 'PL' | 'BS'
  total_debit: string;
  total_credit: string;
  balance: string; // debit − credit (positive = net debit)
}

interface TBResponse {
  rows: TBRow[];
  sum_debit: string;
  sum_credit: string;
  is_balanced: boolean;
  date_from: string | null;
  date_to: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const amt = (v: string | number) => parseFloat(String(v)) || 0;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TrialBalancePage() {
  const { accessToken } = useAuth();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeZero, setIncludeZero] = useState(false);

  const [data, setData] = useState<TBResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (includeZero) params.set("include_zero", "true");
      const qs = params.toString();
      const result = await apiFetch<TBResponse>(
        `/api/gl/trial-balance${qs ? `?${qs}` : ""}`,
        { token: accessToken }
      );
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trial balance.");
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = data ? amt(data.sum_debit) : 0;
  const totalCredit = data ? amt(data.sum_credit) : 0;

  return (
    <PageContainer>
      <PageHeading
        title="Trial Balance"
        subtitle="Debit and credit totals per account from posted journal entries"
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            defaultValue={dateFrom}
            onBlur={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            defaultValue={dateTo}
            onBlur={(e) => setDateTo(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 pb-0.5">
          <input
            type="checkbox"
            className="rounded"
            checked={includeZero}
            onChange={(e) => setIncludeZero(e.target.checked)}
          />
          Include zero-balance accounts
        </label>
        <button
          type="button"
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          onClick={run}
        >
          Run
        </button>
        {data && (
          <span className="text-xs text-gray-400 self-end pb-1">
            {data.date_from
              ? `${data.date_from} — ${data.date_to ?? "present"}`
              : "All time"}
          </span>
        )}
      </div>

      {error && <Banner variant="error" className="mb-4">{error}</Banner>}

      {loading && (
        <p className="text-sm text-gray-400 py-12 text-center">Loading…</p>
      )}

      {!loading && !data && !error && (
        <p className="text-sm text-gray-400 py-12 text-center">
          Set a date range (optional) and click Run.
        </p>
      )}

      {data && !loading && (
        <>
          {!data.is_balanced && (
            <Banner variant="error" className="mb-4">
              <strong>Integrity warning:</strong> Total debits do not equal total credits.
              This indicates a double-entry error in the posting service. Please contact support.
            </Banner>
          )}

          {data.rows.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">
              No posted transactions found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                      GL #
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Account Name
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">
                      Type
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                      Debit
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                      Credit
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                      Balance (Dr)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.rows.map((row) => {
                    const balance = amt(row.balance);
                    return (
                      <tr key={row.gl_number} className="hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-mono text-xs text-blue-600 whitespace-nowrap">
                          {row.gl_number}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{row.gl_name}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                              row.account_type === "PL"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {row.account_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">
                          {amt(row.total_debit) > 0
                            ? formatMoney(amt(row.total_debit))
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">
                          {amt(row.total_credit) > 0
                            ? formatMoney(amt(row.total_credit))
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono font-medium ${
                            balance > 0
                              ? "text-gray-800"
                              : balance < 0
                              ? "text-red-600"
                              : "text-gray-400"
                          }`}
                        >
                          {balance === 0
                            ? "—"
                            : balance < 0
                            ? `(${formatMoney(Math.abs(balance))})`
                            : formatMoney(balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="px-3 py-3 text-xs uppercase text-gray-500" colSpan={3}>
                      Grand Total
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">
                      {formatMoney(totalDebit)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">
                      {formatMoney(totalCredit)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {data.is_balanced ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Balanced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                          Out of balance
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
