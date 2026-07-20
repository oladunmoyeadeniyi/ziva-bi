"use client";

/**
 * Approver queue — /dashboard/business/approvals
 *
 * Two tabs:
 *   Pending   — reports awaiting the current user's action (GET /api/approvals/queue)
 *   Rejected  — reports that were rejected and involved the current user as an approver
 *               (GET /api/approvals/rejected) — Bug 3 fix
 *
 * "Review" navigates to the report detail page where approve/reject actions live.
 */

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Banner } from "@/components/Banner";

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
  rejection_comment: string | null;
  is_advisory?: boolean;
}

type Tab = "pending" | "rejected";


function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB");
}

function ApprovalsContent() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "pending");
  const [pendingQueue, setPendingQueue] = useState<ApprovalQueueItem[]>([]);
  const [rejectedQueue, setRejectedQueue] = useState<ApprovalQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateUrl = (tab: string) => {
    router.replace(`?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);

    const endpoint = activeTab === "pending" ? "/api/approvals/queue" : "/api/approvals/rejected";
    apiFetch<ApprovalQueueItem[]>(endpoint, { token: accessToken })
      .then((data) => {
        if (activeTab === "pending") setPendingQueue(data);
        else setRejectedQueue(data);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load.";
        setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
      })
      .finally(() => setIsLoading(false));
  }, [accessToken, activeTab]);

  const items = activeTab === "pending" ? pendingQueue : rejectedQueue;

  return (
    <PageContainer maxWidth="6xl">
      <div className="mb-6">
        <PageHeading title="Approvals" subtitle="Review expense reports assigned to you for approval." />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(
          [
            { key: "pending" as Tab, label: "Pending" },
            { key: "rejected" as Tab, label: "Rejected" },
          ]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setActiveTab(key); updateUrl(key); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {label}
            {!isLoading && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {key === "pending" ? pendingQueue.length : rejectedQueue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <Banner variant="error">{error}</Banner>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">{activeTab === "pending" ? "✅" : "📋"}</div>
          <h3 className="text-sm font-semibold text-gray-800">
            {activeTab === "pending" ? "No pending approvals" : "No rejected reports"}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {activeTab === "pending"
              ? "You have no expense reports awaiting your review."
              : "No reports you were involved in have been rejected."}
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Report No.</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Employee</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {activeTab === "pending" ? "Your Level" : "Level"}
                </th>
                {activeTab === "rejected" && (
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejection Reason</th>
                )}
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.report_id} className="hover:bg-gray-50 transition-colors">
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
                    {formatMoney(item.total_amount)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        activeTab === "pending" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      }`}>
                        L{item.level}: {item.level_label}
                      </span>
                      {item.is_advisory && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                          Advisory
                        </span>
                      )}
                    </div>
                  </td>
                  {activeTab === "rejected" && (
                    <td className="px-5 py-3 text-sm text-gray-600 max-w-xs">
                      <span className="line-clamp-2">{item.rejection_comment ?? "—"}</span>
                    </td>
                  )}
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/dashboard/business/expenses/${item.report_id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {activeTab === "pending" ? "Review" : "View"}
                    </Link>
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

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <ApprovalsContent />
    </Suspense>
  );
}
