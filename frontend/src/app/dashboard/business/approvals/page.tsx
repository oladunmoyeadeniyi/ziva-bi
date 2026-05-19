"use client";

/**
 * Approver queue — /dashboard/business/approvals
 *
 * Shows all expense reports currently awaiting the current user's approval.
 * "Review" navigates to the report detail page where approve/reject actions live.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ApprovalQueueItem {
  approval_id: string;
  report_id: string;
  report_number: string;
  employee_name: string;
  report_date: string;
  total_amount: string;
  level: number;
  level_label: string;
  created_at: string;
}

function formatNGN(amount: string): string {
  const num = parseFloat(amount);
  return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB");
}

export default function ApprovalsPage() {
  const { accessToken } = useAuth();
  const [queue, setQueue] = useState<ApprovalQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ApprovalQueueItem[]>("/api/approvals/queue", { token: accessToken })
      .then((data) => setQueue(data))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load approval queue.";
        setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
      })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Approvals</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Expense reports waiting for your review and approval.
        </p>
      </div>

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

      {!isLoading && !error && queue.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-sm font-semibold text-gray-800">No pending approvals</h3>
          <p className="mt-1 text-xs text-gray-500">
            You have no expense reports awaiting your review.
          </p>
        </div>
      )}

      {!isLoading && !error && queue.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Report No.</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Employee</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Your Level</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queue.map((item) => (
                <tr key={item.approval_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {item.report_number}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-800">
                    {item.employee_name}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(item.report_date)}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                    {formatNGN(item.total_amount)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      L{item.level}: {item.level_label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/dashboard/business/expenses/${item.report_id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Review
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
