"use client";

/**
 * Expense report detail — /dashboard/business/expenses/{report_id}
 *
 * Read-only view of a single expense report matching the enterprise form layout:
 * header info at top, expense lines in a clean table, grand total at bottom,
 * and a signature/approval placeholder section.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ExpenseLine {
  id: string;
  line_number: number;
  pl_group: string | null;
  gl_account: string;
  io_dimension: string | null;
  cost_center: string | null;
  location: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  description: string;
  amount: string;
}

interface ExpenseReport {
  id: string;
  report_number: string;
  employee_id: string;
  employee_code: string | null;
  employee_function: string | null;
  report_date: string;
  status: "DRAFT" | "SUBMITTED";
  currency: string;
  total_amount: string;
  submitted_at: string | null;
  created_at: string;
  lines: ExpenseLine[];
}

function formatNGN(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
        Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      Draft
    </span>
  );
}

export default function ExpenseDetailPage() {
  const { report_id } = useParams<{ report_id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !report_id) return;

    const fetchReport = async () => {
      try {
        const data = await apiFetch<ExpenseReport>(
          `/api/expenses/reports/${report_id}`,
          { token: accessToken }
        );
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [accessToken, report_id]);

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Report not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Navigation */}
      <div className="mb-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Expense Reports
        </button>
      </div>

      {/* Report shell */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Document header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                Business Expense Retirement
              </h1>
              <p className="mt-0.5 text-xs text-gray-500">Ziva BI — Expense Management</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{report.report_number}</p>
              <StatusBadge status={report.status} />
            </div>
          </div>
        </div>

        {/* Employee + report header info */}
        <div className="px-8 py-5 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee Code</p>
              <p className="mt-0.5 text-sm text-gray-900">{report.employee_code ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Function</p>
              <p className="mt-0.5 text-sm text-gray-900">{report.employee_function ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Date</p>
              <p className="mt-0.5 text-sm text-gray-900">{formatDate(report.report_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Currency</p>
              <p className="mt-0.5 text-sm text-gray-900">{report.currency}</p>
            </div>
            {report.status === "SUBMITTED" && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted At</p>
                <p className="mt-0.5 text-sm text-gray-900">{formatDateTime(report.submitted_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lines table */}
        <div className="px-8 py-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Expense Lines
          </h2>
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">GL Account</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">P/L Group</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">IO / Dimension</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Cost Center</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Location</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Inv. Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Inv. No.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Description</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 border-b border-gray-200">Amount (NGN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{line.line_number}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium">{line.gl_account}</td>
                  <td className="px-3 py-2 text-gray-600">{line.pl_group ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{line.io_dimension ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{line.cost_center ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{line.location ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{formatDate(line.invoice_date)}</td>
                  <td className="px-3 py-2 text-gray-600">{line.invoice_number ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900">{line.description}</td>
                  <td className="px-3 py-2 text-gray-900 font-semibold text-right">
                    {formatNGN(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={9} className="px-3 py-3 text-right text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Grand Total
                </td>
                <td className="px-3 py-3 text-right text-base font-bold text-gray-900">
                  {formatNGN(report.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Approval signature placeholder */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Approval Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-gray-600 mb-2">Employee</p>
              <div className="h-8 flex items-center justify-center">
                <p className="text-xs text-green-700 font-medium">Submitted</p>
              </div>
              <p className="mt-2 text-xs text-gray-500 border-t border-gray-200 pt-2">
                {report.submitted_at ? formatDateTime(report.submitted_at) : formatDate(report.report_date)}
              </p>
            </div>
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-gray-600 mb-2">Line Manager</p>
              <div className="h-8 flex items-center justify-center">
                <p className="text-xs text-amber-600 font-medium italic">Pending Line Manager Approval</p>
              </div>
              <p className="mt-2 text-xs text-gray-400 border-t border-gray-200 pt-2">Available in Milestone 4</p>
            </div>
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-gray-600 mb-2">Finance</p>
              <div className="h-8 flex items-center justify-center">
                <p className="text-xs text-gray-400 italic">Awaiting approvals</p>
              </div>
              <p className="mt-2 text-xs text-gray-400 border-t border-gray-200 pt-2">Available in Milestone 4</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
