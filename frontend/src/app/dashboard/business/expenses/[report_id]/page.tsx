"use client";

/**
 * Expense report detail — /dashboard/business/expenses/{report_id}
 *
 * Read-only view of a single expense report with full line detail.
 *
 * M4 additions:
 *   - APPROVED banner (green)
 *   - REJECTED banner with rejection comment + "Edit & Resubmit" button
 *   - Live approval chain status section
 *   - Approve/Reject panel when current user is the active approver
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  status: string;
  currency: string;
  total_amount: string;
  submitted_at: string | null;
  current_approval_level: number | null;
  rejection_comment: string | null;
  created_at: string;
  lines: ExpenseLine[];
}

interface ApprovalRecord {
  id: string;
  level: number;
  level_label: string;
  approver_id: string;
  approver_name: string;
  status: string;
  comment: string | null;
  actioned_at: string | null;
  created_at: string;
}

function formatNGN(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB");
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT:            { label: "Draft",           cls: "bg-gray-100 text-gray-700" },
    SUBMITTED:        { label: "Submitted",       cls: "bg-blue-100 text-blue-800" },
    PENDING_APPROVAL: { label: "Pending Approval", cls: "bg-amber-100 text-amber-800" },
    APPROVED:         { label: "Approved",        cls: "bg-green-100 text-green-800" },
    REJECTED:         { label: "Rejected",        cls: "bg-red-100 text-red-800" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export default function ExpenseDetailPage() {
  const { report_id } = useParams<{ report_id: string }>();
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approve/reject panel state
  const [approveComment, setApproveComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !report_id) return;

    const fetchAll = async () => {
      try {
        const reportData = await apiFetch<ExpenseReport>(
          `/api/expenses/reports/${report_id}`,
          { token: accessToken }
        );
        setReport(reportData);

        if (["PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(reportData.status)) {
          const approvalData = await apiFetch<ApprovalRecord[]>(
            `/api/approvals/reports/${report_id}`,
            { token: accessToken }
          );
          setApprovals(approvalData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [accessToken, report_id]);

  // The approval record the current user needs to action (if any)
  const myPendingApproval =
    report?.status === "PENDING_APPROVAL"
      ? approvals.find(
          (a) =>
            a.approver_id === user?.id &&
            a.status === "PENDING" &&
            a.level === report.current_approval_level
        )
      : undefined;

  const handleApprove = async () => {
    // Re-derive from current state to avoid stale closure
    const pendingApproval = report?.status === "PENDING_APPROVAL"
      ? approvals.find(
          (a) => a.approver_id === user?.id && a.status === "PENDING" && a.level === report.current_approval_level
        )
      : undefined;
    if (!pendingApproval || !accessToken) return;

    setIsActioning(true);
    setActionError(null);
    try {
      const updated = await apiFetch<ExpenseReport>(
        `/api/approvals/${pendingApproval.id}/approve`,
        {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ comment: approveComment || null }),
        }
      );
      setReport(updated);
      const updatedApprovals = await apiFetch<ApprovalRecord[]>(
        `/api/approvals/reports/${report_id}`,
        { token: accessToken }
      );
      setApprovals(updatedApprovals);
      setApproveComment("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve.";
      setActionError(
        msg === "Failed to fetch"
          ? "Cannot reach the server. Make sure the backend is running."
          : msg
      );
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    const pendingApproval = report?.status === "PENDING_APPROVAL"
      ? approvals.find(
          (a) => a.approver_id === user?.id && a.status === "PENDING" && a.level === report.current_approval_level
        )
      : undefined;
    if (!pendingApproval || !accessToken) return;
    if (!rejectComment.trim()) {
      setActionError("Rejection comment is required.");
      return;
    }
    setIsActioning(true);
    setActionError(null);
    try {
      const updated = await apiFetch<ExpenseReport>(
        `/api/approvals/${pendingApproval.id}/reject`,
        {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ comment: rejectComment }),
        }
      );
      setReport(updated);
      const updatedApprovals = await apiFetch<ApprovalRecord[]>(
        `/api/approvals/reports/${report_id}`,
        { token: accessToken }
      );
      setApprovals(updatedApprovals);
      setRejectComment("");
      setShowRejectInput(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject.";
      setActionError(
        msg === "Failed to fetch"
          ? "Cannot reach the server. Make sure the backend is running."
          : msg
      );
    } finally {
      setIsActioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Report not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Expense Reports
        </button>
      </div>

      {/* Status banners */}
      {report.status === "APPROVED" && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          This report has been approved.
        </div>
      )}
      {report.status === "REJECTED" && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold mb-1">This report was rejected:</p>
          <p>{report.rejection_comment}</p>
          <Link
            href={`/dashboard/business/expenses/${report.id}/edit`}
            className="inline-block mt-3 px-4 py-2 min-h-[44px] bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Edit &amp; Resubmit
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Document header */}
        <div className="px-6 sm:px-8 py-6 border-b border-gray-200">
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
        <div className="px-6 sm:px-8 py-5 bg-gray-50 border-b border-gray-200">
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
            {report.submitted_at && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted At</p>
                <p className="mt-0.5 text-sm text-gray-900">{formatDateTime(report.submitted_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lines table */}
        <div className="px-6 sm:px-8 py-6 overflow-x-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Expense Lines</h2>
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {["#", "GL Account", "P/L Group", "IO / Dimension", "Cost Center", "Location", "Inv. Date", "Inv. No.", "Description", "Amount (NGN)"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
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
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(line.invoice_date)}</td>
                  <td className="px-3 py-2 text-gray-600">{line.invoice_number ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900">{line.description}</td>
                  <td className="px-3 py-2 text-gray-900 font-semibold text-right whitespace-nowrap">
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
                <td className="px-3 py-3 text-right text-base font-bold text-gray-900 whitespace-nowrap">
                  {formatNGN(report.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Approval chain — progress-style, one card per configured level */}
        {approvals.length > 0 && (
          <div className="px-6 sm:px-8 py-6 border-t border-gray-200 bg-gray-50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Approval Progress
            </h2>
            <div className="flex flex-col sm:flex-row items-stretch gap-0">
              {approvals.map((a, idx) => {
                const isActive =
                  report.status === "PENDING_APPROVAL" &&
                  a.level === report.current_approval_level;
                const isApproved = a.status === "APPROVED";
                const isRejected = a.status === "REJECTED";

                const cardBorder = isActive
                  ? "border-blue-400 bg-white shadow-sm"
                  : isApproved
                  ? "border-green-300 bg-green-50"
                  : isRejected
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 bg-white opacity-60";

                const statusColor = isApproved
                  ? "text-green-700"
                  : isRejected
                  ? "text-red-700"
                  : isActive
                  ? "text-blue-700"
                  : "text-gray-400";

                const statusIcon = isApproved ? "✓" : isRejected ? "✗" : isActive ? "●" : "○";
                const statusLabel = isApproved ? "Approved" : isRejected ? "Rejected" : isActive ? "Awaiting" : "Pending";

                return (
                  <div key={a.id} className="flex sm:flex-col flex-row flex-1 items-stretch">
                    {/* Card */}
                    <div className={`flex-1 border-2 rounded-xl p-4 ${cardBorder} transition-all`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Level {a.level}
                        </span>
                        <span className={`text-base font-bold leading-none ${statusColor}`}>
                          {statusIcon}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">{a.level_label}</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{a.approver_name}</p>
                      <p className={`text-xs font-semibold mt-1 ${statusColor}`}>{statusLabel}</p>
                      {a.comment && (
                        <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                          "{a.comment}"
                        </p>
                      )}
                      {a.actioned_at && (
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(a.actioned_at)}</p>
                      )}
                    </div>

                    {/* Connector arrow between cards (hidden after last) */}
                    {idx < approvals.length - 1 && (
                      <div className="flex items-center justify-center sm:w-6 sm:flex-none w-auto h-6 sm:h-auto">
                        <span className="text-gray-300 text-sm font-bold sm:rotate-0 rotate-90">→</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legacy M3 approval placeholder for SUBMITTED reports */}
        {report.status === "SUBMITTED" && approvals.length === 0 && (
          <div className="px-6 sm:px-8 py-6 border-t border-gray-200 bg-gray-50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Approval Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                <p className="text-xs font-semibold text-gray-600 mb-2">Employee</p>
                <p className="text-xs text-green-700 font-medium">Submitted</p>
                <p className="mt-2 text-xs text-gray-500 border-t border-gray-200 pt-2">
                  {formatDateTime(report.submitted_at)}
                </p>
              </div>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                <p className="text-xs font-semibold text-gray-600 mb-2">Approval</p>
                <p className="text-xs text-gray-400 italic">Configure approval matrix to enable workflow</p>
              </div>
            </div>
          </div>
        )}

        {/* Approve / Reject panel for active approvers */}
        {myPendingApproval && (
          <div className="px-6 sm:px-8 py-6 border-t border-gray-200">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Your Action Required — Level {myPendingApproval.level}: {myPendingApproval.level_label}
            </h2>

            {actionError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Comment <span className="text-gray-400">(optional for approval)</span>
                </label>
                <textarea
                  rows={2}
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder="Add a comment (optional)…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {showRejectInput && (
                <div>
                  <label className="block text-xs font-medium text-red-700 mb-1">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Explain why this report is being rejected…"
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {!showRejectInput ? (
                  <>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isActioning}
                      className="px-6 py-2 min-h-[44px] text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
                    >
                      {isActioning ? "Processing…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowRejectInput(true); setActionError(null); }}
                      disabled={isActioning}
                      className="px-6 py-2 min-h-[44px] text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={isActioning}
                      className="px-6 py-2 min-h-[44px] text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
                    >
                      {isActioning ? "Processing…" : "Confirm Rejection"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowRejectInput(false); setRejectComment(""); setActionError(null); }}
                      disabled={isActioning}
                      className="px-6 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
