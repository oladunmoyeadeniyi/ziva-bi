"use client";

/**
 * Expense reports list — /dashboard/business/expenses
 *
 * Shows all expense reports for the tenant.
 * Finance/admin sees all; employees see their own (filtering handled here via
 * the employee_id query param when role info is available in a later milestone).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ExpenseLine {
  id: string;
  line_number: number;
  description: string;
  amount: string;
}

interface ExpenseReport {
  id: string;
  report_number: string;
  employee_id: string;
  employee_function: string | null;
  report_date: string;
  status: "DRAFT" | "SUBMITTED";
  currency: string;
  total_amount: string;
  submitted_at: string | null;
  created_at: string;
  line_count: number;
}

function formatNGN(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      Draft
    </span>
  );
}

export default function ExpensesListPage() {
  const { accessToken } = useAuth();
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchReports = async () => {
      try {
        const data = await apiFetch<ExpenseReport[]>("/api/expenses/reports", {
          token: accessToken,
        });
        setReports(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reports.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [accessToken]);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expense Reports</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage and submit business expense retirements</p>
        </div>
        <Link
          href="/dashboard/business/expenses/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span>+</span>
          New Expense Retirement
        </Link>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && reports.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">🧾</div>
          <h3 className="text-sm font-semibold text-gray-800">No expense reports yet</h3>
          <p className="mt-1 text-xs text-gray-500">Create your first expense retirement to get started.</p>
          <Link
            href="/dashboard/business/expenses/new"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Expense Retirement
          </Link>
        </div>
      )}

      {!isLoading && !error && reports.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Report No.
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Function
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Lines
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">
                    {report.report_number}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {formatDate(report.report_date)}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {report.employee_function ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {report.line_count}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">
                    {formatNGN(report.total_amount)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/dashboard/business/expenses/${report.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
