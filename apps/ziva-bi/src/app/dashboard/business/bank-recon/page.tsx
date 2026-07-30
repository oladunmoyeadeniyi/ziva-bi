"use client";

/**
 * Bank Reconciliation — statement list
 * /dashboard/business/bank-recon
 *
 * Lists all bank statements for the tenant.
 * Filter by bank account and status.
 * Quick stats: total, reconciled, in-progress, draft.
 * Links to create new statement and open existing ones.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
}

interface BankStatement {
  id: string;
  bank_account_id: string;
  statement_ref: string;
  statement_date: string;
  period_start: string | null;
  opening_balance: string;
  closing_balance: string;
  currency: string;
  status: string;
  total_lines: number;
  matched_lines: number;
  unmatched_lines: number;
  created_at: string;
}

const STATUS_COLOURS: Record<string, string> = {
  DRAFT:       "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RECONCILED:  "bg-green-100 text-green-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

const STATUSES = ["", "DRAFT", "IN_PROGRESS", "RECONCILED"];

export default function BankReconListPage() {
  const { accessToken } = useAuth();

  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accountFilter, setAccountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [stmtData, acctData] = await Promise.all([
        apiFetch(`/api/bank-recon/statements${accountFilter ? `?bank_account_id=${accountFilter}` : ""}${statusFilter ? `${accountFilter ? "&" : "?"}status=${statusFilter}` : ""}`, { token: accessToken }),
        apiFetch("/api/setup/bank-accounts", { token: accessToken }),
      ]);
      setStatements(Array.isArray(stmtData) ? stmtData : []);
      setBankAccounts(Array.isArray(acctData) ? acctData : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load statements.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, accountFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const accountMap = Object.fromEntries(bankAccounts.map(a => [a.id, a]));

  // Quick stats
  const total      = statements.length;
  const reconciled = statements.filter(s => s.status === "RECONCILED").length;
  const inProgress = statements.filter(s => s.status === "IN_PROGRESS").length;
  const draft      = statements.filter(s => s.status === "DRAFT").length;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeading title="Bank Reconciliation" subtitle="Match bank statements against your GL or posting batches." />
        <Link
          href="/dashboard/business/bank-recon/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <i className="ti ti-plus" style={{ fontSize: 15 }} /> New Statement
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: total, colour: "text-gray-700" },
          { label: "Reconciled", value: reconciled, colour: "text-green-700" },
          { label: "In Progress", value: inProgress, colour: "text-blue-700" },
          { label: "Draft", value: draft, colour: "text-gray-500" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className={`text-2xl font-bold ${s.colour}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={accountFilter}
          onChange={e => setAccountFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
        >
          <option value="">All bank accounts</option>
          {bankAccounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.bank_name} — {a.account_name} ({a.currency})
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s ? s.replace("_", " ") : "All statuses"}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : statements.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <i className="ti ti-building-bank" style={{ fontSize: 40 }} />
          <p className="mt-2 text-sm">No statements found.</p>
          <Link href="/dashboard/business/bank-recon/new" className="mt-3 inline-block text-blue-600 text-sm hover:underline">
            Import your first statement →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ref</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Account</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statement Date</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Closing Balance</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Lines</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statements.map(s => {
                const acct = accountMap[s.bank_account_id];
                const matchPct = s.total_lines > 0
                  ? Math.round((s.matched_lines / s.total_lines) * 100)
                  : 0;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.statement_ref}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{acct?.bank_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{acct?.account_name} · {s.currency}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(s.statement_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {formatMoney(parseFloat(s.closing_balance))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-xs text-gray-500">
                        {s.matched_lines}/{s.total_lines}
                      </div>
                      {s.total_lines > 0 && (
                        <div className="mt-1 h-1.5 w-16 mx-auto bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${matchPct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${matchPct}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/dashboard/business/bank-recon/${s.id}`}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          {s.status === "RECONCILED" ? "View" : "Reconcile"}
                        </Link>
                        {s.status !== "DRAFT" && (
                          <Link
                            href={`/dashboard/business/bank-recon/${s.id}/report`}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            Report
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
