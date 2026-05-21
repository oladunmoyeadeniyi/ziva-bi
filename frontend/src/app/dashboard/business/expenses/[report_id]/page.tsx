"use client";

/**
 * Expense report detail — /dashboard/business/expenses/{report_id}
 *
 * M4: APPROVED/REJECTED banners, approval chain, approve/reject panel.
 * M5: REFERRED_TO_REQUESTOR banner, refer-back modal, audit trail link.
 * M5 UI fixes:
 *   FIX 1 — query banner uses approver's actual name, not level number
 *   FIX 2 — REFERRED_BACK label is contextual ("Referred back to you" / "Referred to [Name]")
 *   FIX 3 — visible_to_requestor defaulted ON; toggle relabelled "Hide from requestor"
 *   FIX 4 — two-column layout on desktop (65/35 split); single column on mobile
 *   FIX 5 — approval chain cards vertical, compact, name-first
 *   FIX 6 — action panel in right column on desktop; fixed bottom bar on mobile
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
  visible_to_requestor: boolean;
  response_comment: string | null;
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
    DRAFT:                 { label: "Draft",            cls: "bg-gray-100 text-gray-700" },
    SUBMITTED:             { label: "Submitted",        cls: "bg-blue-100 text-blue-800" },
    PENDING_APPROVAL:      { label: "Pending Approval", cls: "bg-yellow-100 text-yellow-800" },
    APPROVED:              { label: "Approved",         cls: "bg-green-100 text-green-800" },
    REJECTED:              { label: "Rejected",         cls: "bg-red-100 text-red-800" },
    REFERRED_BACK:         { label: "Referred Back",    cls: "bg-orange-100 text-orange-800" },
    REFERRED_TO_REQUESTOR: { label: "Referred to You",  cls: "bg-orange-100 text-orange-800" },
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

  // Desktop action panel state
  const [approveComment, setApproveComment] = useState("");
  const [approveResponse, setApproveResponse] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [isActioning, setIsActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Mobile reject bottom sheet
  const [showMobileRejectModal, setShowMobileRejectModal] = useState(false);
  const [mobileRejectComment, setMobileRejectComment] = useState("");

  // Refer Back modal — FIX 3: default visible (hide = false)
  const [showReferBackModal, setShowReferBackModal] = useState(false);
  const [referBackType, setReferBackType] = useState<"approver" | "requestor">("requestor");
  const [referBackSelectedLevels, setReferBackSelectedLevels] = useState<number[]>([]);
  const [referBackHideFromRequestor, setReferBackHideFromRequestor] = useState(false); // FIX 3
  const [referBackComment, setReferBackComment] = useState("");
  const [referBackError, setReferBackError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !report_id) return;
    const fetchAll = async () => {
      try {
        const reportData = await apiFetch<ExpenseReport>(
          `/api/expenses/reports/${report_id}`,
          { token: accessToken }
        );
        setReport(reportData);
        if (["PENDING_APPROVAL", "APPROVED", "REJECTED", "REFERRED_TO_REQUESTOR"].includes(reportData.status)) {
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

  const myPendingApproval =
    report?.status === "PENDING_APPROVAL"
      ? approvals.find(
          (a) => a.approver_id === user?.id && a.status === "PENDING" && a.level === report.current_approval_level
        )
      : undefined;

  // Detect referring approval (higher-level approver who referred down to me)
  const referringApproval = myPendingApproval
    ? approvals.find((a) => a.status === "REFERRED_BACK" && a.level > myPendingApproval.level)
    : undefined;

  // Levels below current that can be refer-back targets
  const referBackLevels = myPendingApproval
    ? approvals.filter((a) => a.level < myPendingApproval.level)
    : [];

  const isRequestor = user?.id === report?.employee_id;

  // FIX 2: contextual REFERRED_BACK label using actual names
  const getReferredBackLabel = (a: ApprovalRecord): string => {
    if (report?.status === "REFERRED_TO_REQUESTOR") {
      return isRequestor ? "Referred back to you" : "Referred to requestor";
    }
    const lowerPending = approvals.filter((la) => la.level < a.level && la.status === "PENDING");
    if (lowerPending.length > 0) {
      const firstNames = lowerPending.map((la) => la.approver_name.split(" ")[0]);
      return `Referred to ${firstNames.join(" & ")}`;
    }
    return "Referred Back";
  };

  const refreshApprovals = async () => {
    if (!accessToken || !report_id) return;
    const [r, a] = await Promise.all([
      apiFetch<ExpenseReport>(`/api/expenses/reports/${report_id}`, { token: accessToken }),
      apiFetch<ApprovalRecord[]>(`/api/approvals/reports/${report_id}`, { token: accessToken }),
    ]);
    setReport(r);
    setApprovals(a);
  };

  const handleApprove = async (comment?: string, responseComment?: string) => {
    const pending = report?.status === "PENDING_APPROVAL"
      ? approvals.find((a) => a.approver_id === user?.id && a.status === "PENDING" && a.level === report.current_approval_level)
      : undefined;
    if (!pending || !accessToken) return;
    setIsActioning(true); setActionError(null);
    try {
      await apiFetch<ExpenseReport>(`/api/approvals/${pending.id}/approve`, {
        method: "POST", token: accessToken,
        body: JSON.stringify({
          comment: (comment ?? approveComment) || null,
          response_comment: (responseComment ?? approveResponse) || null,
        }),
      });
      setApproveComment(""); setApproveResponse("");
      await refreshApprovals();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve.";
      setActionError(msg === "Failed to fetch" ? "Cannot reach the server." : msg);
    } finally { setIsActioning(false); }
  };

  const handleReject = async (comment?: string) => {
    const pending = report?.status === "PENDING_APPROVAL"
      ? approvals.find((a) => a.approver_id === user?.id && a.status === "PENDING" && a.level === report.current_approval_level)
      : undefined;
    if (!pending || !accessToken) return;
    const finalComment = comment ?? rejectComment;
    if (!finalComment.trim()) { setActionError("Rejection comment is required."); return; }
    setIsActioning(true); setActionError(null);
    try {
      await apiFetch<ExpenseReport>(`/api/approvals/${pending.id}/reject`, {
        method: "POST", token: accessToken,
        body: JSON.stringify({ comment: finalComment }),
      });
      setRejectComment(""); setShowRejectInput(false);
      setMobileRejectComment(""); setShowMobileRejectModal(false);
      await refreshApprovals();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject.";
      setActionError(msg === "Failed to fetch" ? "Cannot reach the server." : msg);
    } finally { setIsActioning(false); }
  };

  const handleReferBack = async () => {
    const pending = report?.status === "PENDING_APPROVAL"
      ? approvals.find((a) => a.approver_id === user?.id && a.status === "PENDING" && a.level === report.current_approval_level)
      : undefined;
    if (!pending || !accessToken) return;
    if (!referBackComment.trim()) { setReferBackError("Comment is required."); return; }
    if (referBackType === "approver" && referBackSelectedLevels.length === 0) {
      setReferBackError("Select at least one level."); return;
    }
    setIsActioning(true); setReferBackError(null);
    try {
      await apiFetch<ExpenseReport>(`/api/approvals/${pending.id}/refer-back`, {
        method: "POST", token: accessToken,
        body: JSON.stringify({
          target_type: referBackType,
          target_levels: referBackType === "approver" ? referBackSelectedLevels : null,
          visible_to_requestor: !referBackHideFromRequestor, // FIX 3: inverted
          comment: referBackComment,
        }),
      });
      setShowReferBackModal(false); setReferBackComment(""); setReferBackSelectedLevels([]);
      setReferBackHideFromRequestor(false);
      await refreshApprovals();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to refer back.";
      setReferBackError(msg === "Failed to fetch" ? "Cannot reach the server." : msg);
    } finally { setIsActioning(false); }
  };

  const openReferBackModal = () => {
    setShowReferBackModal(true);
    setReferBackType("requestor");
    setReferBackSelectedLevels([]);
    setReferBackComment("");
    setReferBackHideFromRequestor(false); // FIX 3: default visible
    setReferBackError(null);
  };

  const toggleLevel = (level: number) => {
    setReferBackSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Report not found."}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // pb-24 on mobile to clear the fixed bottom action bar (FIX 6)
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto pb-24 md:pb-8">

      {/* ── Refer Back modal ─────────────────────────────────────────────── */}
      {showReferBackModal && myPendingApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Refer Back</h2>
            <p className="text-sm text-gray-500 mb-4">Refer this report back for further review.</p>
            <div className="space-y-4">
              {/* Target type */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Refer to:</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="referBackType" value="requestor"
                      checked={referBackType === "requestor"}
                      onChange={() => { setReferBackType("requestor"); setReferBackSelectedLevels([]); }}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-800">Requestor (send back for revision)</span>
                  </label>
                  {referBackLevels.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="referBackType" value="approver"
                        checked={referBackType === "approver"}
                        onChange={() => setReferBackType("approver")}
                        className="accent-orange-500" />
                      <span className="text-sm text-gray-800">Lower approver (for consultation)</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Multi-select level checkboxes */}
              {referBackType === "approver" && referBackLevels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Select levels <span className="text-red-500">*</span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {referBackLevels.map((a) => (
                      <label key={a.level} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={referBackSelectedLevels.includes(a.level)}
                          onChange={() => toggleLevel(a.level)}
                          className="accent-orange-500 w-4 h-4" />
                        <span className="text-sm text-gray-800">
                          {a.approver_name} — {a.level_label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* FIX 3: "Hide from requestor" toggle, default OFF (visible by default) */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={referBackHideFromRequestor}
                  onClick={() => setReferBackHideFromRequestor((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    referBackHideFromRequestor ? "bg-red-500" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    referBackHideFromRequestor ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
                <span className="text-sm text-gray-700">Hide from requestor (internal query only)</span>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Comment <span className="text-red-500">*</span>
                </label>
                <textarea rows={3} value={referBackComment}
                  onChange={(e) => setReferBackComment(e.target.value)}
                  placeholder="Explain what needs to be reviewed or revised…"
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            {referBackError && <p className="mt-3 text-xs text-red-600">{referBackError}</p>}

            <div className="flex gap-3 justify-end mt-6">
              <button type="button"
                onClick={() => { setShowReferBackModal(false); setReferBackError(null); setReferBackComment(""); }}
                disabled={isActioning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={handleReferBack} disabled={isActioning}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-60">
                {isActioning ? "Sending…" : "Confirm Refer Back"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile reject bottom sheet (FIX 6) ───────────────────────────── */}
      {showMobileRejectModal && myPendingApproval && (
        <div className="fixed inset-0 z-50 md:hidden flex items-end bg-black/40">
          <div className="bg-white rounded-t-2xl w-full px-4 pt-4 pb-8 space-y-3">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
            <h3 className="text-base font-semibold text-gray-900">Rejection Reason</h3>
            <textarea
              rows={4}
              value={mobileRejectComment}
              onChange={(e) => setMobileRejectComment(e.target.value)}
              placeholder="Explain why this report is being rejected…"
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {actionError && <p className="text-xs text-red-600">{actionError}</p>}
            <div className="flex gap-3">
              <button type="button"
                onClick={() => { setShowMobileRejectModal(false); setMobileRejectComment(""); setActionError(null); }}
                disabled={isActioning}
                className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg disabled:opacity-60">
                Cancel
              </button>
              <button type="button"
                onClick={() => handleReject(mobileRejectComment)}
                disabled={isActioning}
                className="flex-1 py-3 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                {isActioning ? "Processing…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Back + Audit link ─────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Expense Reports
        </button>
        {user?.is_tenant_admin && (
          <Link href={`/dashboard/business/expenses/${report.id}/audit`}
            className="text-xs text-gray-400 hover:text-gray-600 underline">
            View Audit Trail
          </Link>
        )}
      </div>

      {/* ── Full-width status banners ─────────────────────────────────────── */}
      {report.status === "APPROVED" && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          This report has been fully approved.
        </div>
      )}
      {report.status === "REJECTED" && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold mb-1">This report was rejected:</p>
          <p>{report.rejection_comment}</p>
          <Link href={`/dashboard/business/expenses/${report.id}/edit`}
            className="inline-block mt-3 px-4 py-2 min-h-[44px] bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
            Edit &amp; Resubmit
          </Link>
        </div>
      )}
      {report.status === "REFERRED_TO_REQUESTOR" && (
        <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
          <p className="font-semibold mb-1">This report was referred back to you for revision:</p>
          <p>{report.rejection_comment}</p>
          <Link href={`/dashboard/business/expenses/${report.id}/edit`}
            className="inline-block mt-3 px-4 py-2 min-h-[44px] bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors">
            Edit &amp; Resubmit
          </Link>
        </div>
      )}

      {/* FIX 1 — query banners: use approver name, not level number */}
      {report.status === "PENDING_APPROVAL" && isRequestor &&
        approvals.some((a) => a.status === "REFERRED_BACK") && (
        <div className="mb-4 space-y-2">
          {approvals.filter((a) => a.status === "REFERRED_BACK").map((a) => (
            a.visible_to_requestor ? (
              <div key={a.id} className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
                {/* FIX 1: use a.approver_name instead of "Level X" */}
                <p className="font-semibold mb-0.5">
                  Query from {a.approver_name} ({a.level_label}):
                </p>
                <p>{a.comment}</p>
              </div>
            ) : (
              <div key={a.id} className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500 italic">
                Pending internal review at {a.level_label}
              </div>
            )
          ))}
        </div>
      )}

      {/* ── FIX 4: Two-column layout ──────────────────────────────────────── */}
      <div className="md:grid md:grid-cols-[1fr_340px] md:gap-5 md:items-start">

        {/* LEFT COLUMN: report card ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Document header */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                  Business Expense Retirement
                </h1>
                <p className="mt-0.5 text-xs text-gray-500">Ziva BI — Expense Management</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-800">{report.report_number}</p>
                <div className="mt-1"><StatusBadge status={report.status} /></div>
              </div>
            </div>
          </div>

          {/* Employee info */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
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
          <div className="px-6 py-5 overflow-x-auto">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Expense Lines</h2>
            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {["#", "GL Account", "P/L Group", "IO / Dimension", "Cost Center", "Location",
                    "Inv. Date", "Inv. No.", "Description", "Amount (NGN)"].map((h) => (
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
                  <td colSpan={9} className="px-3 py-3 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right text-base font-bold text-gray-900 whitespace-nowrap">
                    {formatNGN(report.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legacy placeholder for SUBMITTED reports without approval matrix */}
          {report.status === "SUBMITTED" && approvals.length === 0 && (
            <div className="px-6 py-5 border-t border-gray-200 bg-gray-50">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Approval Status</h2>
              <div className="flex gap-4">
                <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center flex-1">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Employee</p>
                  <p className="text-xs text-green-700 font-medium">Submitted</p>
                  <p className="mt-2 text-xs text-gray-400">{formatDateTime(report.submitted_at)}</p>
                </div>
                <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center flex-1">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Approval</p>
                  <p className="text-xs text-gray-400 italic">No approval matrix configured</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: approval progress + action panel ─────────────────── */}
        {/* FIX 4: sticky on desktop, regular block on mobile (shows below left column) */}
        <div className="mt-4 md:mt-0 space-y-3 md:sticky md:top-6">

          {/* Referred-to context panel (shown to the target approver) */}
          {myPendingApproval && referringApproval && (
            <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">
                Referred to you by {referringApproval.approver_name}
              </p>
              <p className="text-sm text-orange-800">{referringApproval.comment}</p>
            </div>
          )}

          {/* FIX 5: Approval Progress — compact vertical cards */}
          {approvals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Approval Progress</h2>
              </div>
              <div className="p-3 space-y-2">
                {approvals.map((a, idx) => {
                  const isActive = report.status === "PENDING_APPROVAL" && a.level === report.current_approval_level;
                  const isApproved = a.status === "APPROVED";
                  const isRejected = a.status === "REJECTED";
                  const isReferredBack = a.status === "REFERRED_BACK";

                  const cardCls = isActive ? "border-blue-300 bg-blue-50"
                    : isApproved ? "border-green-200 bg-green-50"
                    : isRejected ? "border-red-200 bg-red-50"
                    : isReferredBack ? "border-orange-200 bg-orange-50"
                    : "border-gray-200 bg-white opacity-60";

                  const statusColor = isApproved ? "text-green-700"
                    : isRejected ? "text-red-700"
                    : isReferredBack ? "text-orange-700"
                    : isActive ? "text-blue-700"
                    : "text-gray-400";

                  const statusIcon = isApproved ? "✓" : isRejected ? "✗"
                    : isReferredBack ? "↩" : isActive ? "●" : "○";

                  // FIX 2: contextual label
                  const statusLabel = isApproved ? "Approved"
                    : isRejected ? "Rejected"
                    : isReferredBack ? getReferredBackLabel(a)
                    : isActive ? "Awaiting your action"
                    : "Pending";

                  // Comment visibility for requestor
                  const showComment = !isRequestor || a.visible_to_requestor || !isReferredBack;

                  return (
                    <div key={a.id}>
                      <div className={`rounded-lg border-2 p-3 ${cardCls} transition-all`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {/* FIX 5: name first, large and prominent */}
                            <p className="text-sm font-semibold text-gray-900 truncate">{a.approver_name}</p>
                            <p className="text-xs text-gray-500 truncate">L{a.level} — {a.level_label}</p>
                            <p className={`text-xs font-semibold mt-1 ${statusColor}`}>{statusLabel}</p>
                            {a.actioned_at && (
                              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.actioned_at)}</p>
                            )}
                            {showComment && a.comment && (
                              <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                                &ldquo;{a.comment}&rdquo;
                              </p>
                            )}
                            {isReferredBack && !showComment && (
                              <p className="text-xs text-gray-400 mt-1 italic">Internal query</p>
                            )}
                            {a.response_comment && (
                              <p className="text-xs text-blue-600 mt-1 italic line-clamp-2">
                                Response: &ldquo;{a.response_comment}&rdquo;
                              </p>
                            )}
                          </div>
                          <span className={`text-lg font-bold leading-none shrink-0 ${statusColor}`}>
                            {statusIcon}
                          </span>
                        </div>
                      </div>
                      {/* Vertical connector */}
                      {idx < approvals.length - 1 && (
                        <div className="flex justify-center h-4 items-center">
                          <span className="text-gray-300 text-xs">↓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FIX 6: Action panel — desktop only (hidden on mobile, fixed bar handles mobile) */}
          {myPendingApproval && (
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Your Action — {myPendingApproval.level_label}
              </h2>

              {actionError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {actionError}
                </div>
              )}

              {/* Response field when in a refer-back scenario */}
              {referringApproval && (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Your response <span className="text-gray-400 font-normal">(sent to {referringApproval.approver_name})</span>
                  </label>
                  <textarea rows={2} value={approveResponse} onChange={(e) => setApproveResponse(e.target.value)}
                    placeholder="Enter your findings or response…"
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              {/* Approval comment */}
              {!showRejectInput && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Comment <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea rows={2} value={approveComment} onChange={(e) => setApproveComment(e.target.value)}
                    placeholder="Add a note…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              {/* Rejection comment */}
              {showRejectInput && (
                <div>
                  <label className="block text-xs font-medium text-red-700 mb-1">
                    Rejection reason <span className="text-red-500">*</span>
                  </label>
                  <textarea rows={3} value={rejectComment} onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Explain why this report is being rejected…"
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              )}

              {/* Action buttons */}
              {!showRejectInput ? (
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => handleApprove()} disabled={isActioning}
                    className="w-full py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
                    {isActioning ? "Processing…" : "Approve"}
                  </button>
                  <button type="button" onClick={openReferBackModal} disabled={isActioning}
                    className="w-full py-2.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-60">
                    Refer Back
                  </button>
                  <button type="button" onClick={() => { setShowRejectInput(true); setActionError(null); }}
                    disabled={isActioning}
                    className="w-full py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                    Reject
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleReject()} disabled={isActioning}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                    {isActioning ? "Processing…" : "Confirm Rejection"}
                  </button>
                  <button type="button"
                    onClick={() => { setShowRejectInput(false); setRejectComment(""); setActionError(null); }}
                    disabled={isActioning}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FIX 6: Mobile fixed bottom action bar — visible only when approver has action */}
      {myPendingApproval && (
        <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 px-4 py-3 flex gap-2 shadow-lg">
          <button type="button"
            onClick={() => handleApprove()}
            disabled={isActioning}
            className="flex-1 min-h-[48px] text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-60">
            {isActioning ? "…" : "Approve"}
          </button>
          <button type="button"
            onClick={openReferBackModal}
            disabled={isActioning}
            className="flex-1 min-h-[48px] text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 disabled:opacity-60">
            Refer Back
          </button>
          <button type="button"
            onClick={() => { setShowMobileRejectModal(true); setActionError(null); }}
            disabled={isActioning}
            className="flex-1 min-h-[48px] text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-60">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
