"use client";

/**
 * Reconciliation Report — /dashboard/business/bank-recon/[id]/report
 *
 * Displays the formal bank reconciliation statement:
 *
 * Full ERP mode:
 *   ┌─────────────────────────────────────────┐
 *   │ GL book balance (as at statement date)  │
 *   │ + Outstanding deposits (in GL, not bank)│
 *   │ − Outstanding payments (in GL, not bank)│
 *   │ = Adjusted GL balance                   │
 *   │                                         │
 *   │ Bank statement closing balance          │
 *   │                                         │
 *   │ Difference (should be 0.00) ✓           │
 *   └─────────────────────────────────────────┘
 *
 * Lite / Connected: shows summary line counts only.
 * Links back to the reconciliation workspace.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface OutstandingItem {
  journal_entry_id: string;
  entry_date: string;
  reference_number: string;
  description: string;
  amount: string;
}

interface ReconReport {
  statement_id: string;
  statement_ref: string;
  statement_date: string;
  opening_balance: string;
  closing_balance: string;
  currency?: string;
  gl_book_balance: string | null;
  outstanding_deposits: OutstandingItem[];
  outstanding_payments: OutstandingItem[];
  total_outstanding_deposits: string;
  total_outstanding_payments: string;
  adjusted_gl_balance: string | null;
  total_lines: number;
  matched_lines: number;
  excluded_lines: number;
  unmatched_lines: number;
  is_balanced: boolean | null;
}

function AmountRow({
  label,
  amount,
  indent = false,
  bold = false,
  colour,
}: {
  label: string;
  amount: string | number;
  indent?: boolean;
  bold?: boolean;
  colour?: string;
}) {
  const val = typeof amount === "string" ? parseFloat(amount) : amount;
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent ? "pl-6" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold text-gray-800" : "text-gray-600"}`}>
        {label}
      </span>
      <span className={`text-sm font-mono ${bold ? "font-bold" : ""} ${colour ?? "text-gray-800"}`}>
        {formatMoney(val)}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-1.5 border-b border-gray-100 pb-1">
      {children}
    </p>
  );
}

export default function ReconReportPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const stmtId = params.id as string;

  const [report, setReport] = useState<ReconReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/api/bank-recon/statements/${stmtId}/report`, { token: accessToken });
      setReport(data as ReconReport);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, stmtId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  if (loading) {
    return (
      <PageContainer>
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading report…</div>
      </PageContainer>
    );
  }

  if (error || !report) {
    return (
      <PageContainer>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error || "Report not found."}</div>
      </PageContainer>
    );
  }

  const isFullErp = report.gl_book_balance !== null;
  const diff = isFullErp
    ? parseFloat(report.adjusted_gl_balance ?? "0") - parseFloat(report.closing_balance)
    : null;
  const isBalanced = report.is_balanced;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="mb-1">
            <Link href={`/dashboard/business/bank-recon/${stmtId}`} className="text-sm text-gray-400 hover:text-gray-600">
              ← Back to reconciliation workspace
            </Link>
          </div>
          <PageHeading
            title={`Reconciliation Report — ${report.statement_ref}`}
            subtitle={`Statement date: ${new Date(report.statement_date).toLocaleDateString()}`}
          />
        </div>

        {isBalanced === true && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 border border-green-200 rounded-lg">
            <i className="ti ti-circle-check text-green-600" style={{ fontSize: 16 }} />
            <span className="text-sm font-medium text-green-700">Balanced</span>
          </div>
        )}
        {isBalanced === false && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 border border-red-200 rounded-lg">
            <i className="ti ti-alert-circle text-red-600" style={{ fontSize: 16 }} />
            <span className="text-sm font-medium text-red-700">Not balanced</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left — Reconciliation statement */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">Bank Reconciliation Statement</p>
          <p className="text-xs text-gray-400 mb-4">As at {new Date(report.statement_date).toLocaleDateString()}</p>

          {isFullErp ? (
            <>
              <SectionHeading>General Ledger</SectionHeading>
              <AmountRow label="GL book balance (bank account)" amount={report.gl_book_balance!} bold />

              {report.outstanding_deposits.length > 0 && (
                <>
                  <SectionHeading>Add: Outstanding deposits (in GL, not on statement)</SectionHeading>
                  {report.outstanding_deposits.map(item => (
                    <AmountRow
                      key={item.journal_entry_id + item.reference_number}
                      label={`${new Date(item.entry_date).toLocaleDateString()} — ${item.description.slice(0, 45)}`}
                      amount={item.amount}
                      indent
                      colour="text-green-700"
                    />
                  ))}
                  <AmountRow
                    label="Total outstanding deposits"
                    amount={report.total_outstanding_deposits}
                    colour="text-green-700"
                  />
                </>
              )}

              {report.outstanding_payments.length > 0 && (
                <>
                  <SectionHeading>Less: Outstanding payments (in GL, not on statement)</SectionHeading>
                  {report.outstanding_payments.map(item => (
                    <AmountRow
                      key={item.journal_entry_id + item.reference_number}
                      label={`${new Date(item.entry_date).toLocaleDateString()} — ${item.description.slice(0, 45)}`}
                      amount={item.amount}
                      indent
                      colour="text-red-700"
                    />
                  ))}
                  <AmountRow
                    label="Total outstanding payments"
                    amount={report.total_outstanding_payments}
                    colour="text-red-700"
                  />
                </>
              )}

              <div className="border-t border-gray-300 mt-3 pt-3">
                <AmountRow label="Adjusted GL balance" amount={report.adjusted_gl_balance!} bold />
              </div>

              <div className="border-t border-gray-300 mt-3 pt-3">
                <SectionHeading>Bank Statement</SectionHeading>
                <AmountRow label="Opening balance (per statement)" amount={report.opening_balance} />
                <AmountRow label="Closing balance (per statement)" amount={report.closing_balance} bold />
              </div>

              <div className={`border-t-2 mt-3 pt-3 ${isBalanced ? "border-green-400" : "border-red-400"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">Difference</span>
                  <span className={`text-sm font-bold font-mono ${isBalanced ? "text-green-700" : "text-red-700"}`}>
                    {formatMoney(Math.abs(diff ?? 0))}
                    {isBalanced ? " ✓" : " ✗"}
                  </span>
                </div>
                {!isBalanced && (
                  <p className="text-xs text-red-600 mt-1">
                    The GL adjusted balance does not match the bank statement closing balance.
                    Check for unmatched items or GL entries that need a clearing journal.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 py-4 text-center">
              <i className="ti ti-info-circle text-gray-400" style={{ fontSize: 24 }} />
              <p className="mt-2">
                Full GL reconciliation is only available in <strong>Full ERP</strong> mode.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Connected mode: verify matched batches have been synced to your ERP.
                <br />Lite mode: verify all statement lines have been matched or excluded.
              </p>
            </div>
          )}
        </div>

        {/* Right — Line summary */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-gray-800 mb-4">Line Summary</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total lines",    value: report.total_lines,    colour: "text-gray-700" },
                { label: "Matched",        value: report.matched_lines,  colour: "text-green-700" },
                { label: "Excluded",       value: report.excluded_lines, colour: "text-purple-700" },
                { label: "Unmatched",      value: report.unmatched_lines,colour: report.unmatched_lines > 0 ? "text-red-700" : "text-gray-400" },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${s.colour}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {report.unmatched_lines > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700">
                  {report.unmatched_lines} line(s) are still unmatched. Go back to the workspace to resolve them before marking this statement reconciled.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-gray-800 mb-3">Statement Balances</p>
            <AmountRow label="Opening balance" amount={report.opening_balance} />
            <AmountRow label="Closing balance" amount={report.closing_balance} bold />
          </div>

          <div className="flex gap-2">
            <Link
              href={`/dashboard/business/bank-recon/${stmtId}`}
              className="flex-1 py-2 text-sm text-center text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back to workspace
            </Link>
            <Link
              href="/dashboard/business/bank-recon"
              className="flex-1 py-2 text-sm text-center text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
            >
              All statements
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
