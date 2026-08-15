"use client";

/**
 * Advance detail — /dashboard/business/advances/[id]
 *
 * Shows advance status, timeline, and all retirements.
 * Finance actions: Approve, Reject, Issue (disburse).
 * Employee actions: Submit, Cancel, Start Retirement.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface Advance {
  id: string;
  advance_number: string;
  advance_type: string;
  purpose: string;
  amount: string;
  currency: string;
  status: string;
  request_date: string;
  required_by_date: string | null;
  due_retirement_date: string | null;
  total_retired: string;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  issued_at: string | null;
  rejection_comment: string | null;
  employee_id: string;
}

interface Retirement {
  id: string;
  retirement_number: string;
  retirement_date: string;
  advance_amount: string;
  total_claimed: string;
  balance: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:             "bg-gray-100 text-gray-600",
  SUBMITTED:         "bg-blue-50 text-blue-700",
  APPROVED:          "bg-emerald-50 text-emerald-700",
  ISSUED:            "bg-indigo-50 text-indigo-700",
  PARTIALLY_RETIRED: "bg-yellow-50 text-yellow-700",
  FULLY_RETIRED:     "bg-green-100 text-green-800",
  REJECTED:          "bg-red-50 text-red-700",
  CANCELLED:         "bg-gray-50 text-gray-500",
};

export default function AdvanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const [advance, setAdvance] = useState<Advance | null>(null);
  const [retirements, setRetirements] = useState<Retirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [working, setWorking] = useState(false);

  const isFinance = user?.is_tenant_admin;
  const isOwner = advance?.employee_id === user?.id;

  const load = async () => {
    if (!accessToken) return;
    try {
      const [adv, rets] = await Promise.all([
        apiFetch<Advance>(`/api/advances/${id}`, { token: accessToken }),
        apiFetch<Retirement[]>(`/api/advances/${id}/retirements`, { token: accessToken }),
      ]);
      setAdvance(adv);
      setRetirements(rets);
    } catch {
      setAdvance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, accessToken]);

  const action = async (endpoint: string, body?: Record<string, unknown>) => {
    if (!accessToken) return;
    setWorking(true);
    setActionMsg("");
    try {
      await apiFetch(`/api/advances/${endpoint}`, { method: "POST", token: accessToken, body });
      await load();
      setActionMsg("Done.");
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <PageContainer><p className="text-sm text-gray-400 py-8 text-center">Loading…</p></PageContainer>;
  if (!advance) return <PageContainer><p className="text-sm text-red-500 py-8 text-center">Advance not found.</p></PageContainer>;

  const outstanding = parseFloat(advance.amount) - parseFloat(advance.total_retired || "0");
  const canRetire = ["ISSUED", "PARTIALLY_RETIRED"].includes(advance.status) && (isOwner || isFinance);

  return (
    <PageContainer>
      <PageHeading
        title={advance.advance_number}
        subtitle={`${advance.advance_type} advance · ${advance.purpose}`}
        actions={
          canRetire ? (
            <Link href={`/dashboard/business/advances/${id}/retire`}>
              <Button size="sm">Retire advance</Button>
            </Link>
          ) : undefined
        }
      />

      {actionMsg && (
        <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${actionMsg === "Done." ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Status card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Status</p>
          <span className={`text-sm font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[advance.status] ?? "bg-gray-100 text-gray-600"}`}>
            {advance.status.replace(/_/g, " ")}
          </span>
          {advance.rejection_comment && (
            <p className="text-xs text-red-600 mt-2">Rejected: {advance.rejection_comment}</p>
          )}
        </div>

        {/* Amount card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Amount</p>
          <p className="text-xl font-bold text-gray-900">{formatMoney(parseFloat(advance.amount), advance.currency)}</p>
          {["ISSUED", "PARTIALLY_RETIRED"].includes(advance.status) && (
            <p className="text-xs text-amber-600 mt-1">Outstanding: {formatMoney(outstanding, advance.currency)}</p>
          )}
        </div>

        {/* Dates card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-1">
          <p className="text-xs text-gray-400">Requested: <span className="text-gray-700">{advance.request_date}</span></p>
          {advance.required_by_date && <p className="text-xs text-gray-400">Required by: <span className="text-gray-700">{advance.required_by_date}</span></p>}
          {advance.due_retirement_date && <p className="text-xs text-gray-400">Retire by: <span className="text-gray-700 font-medium">{advance.due_retirement_date}</span></p>}
          {advance.issued_at && <p className="text-xs text-gray-400">Issued: <span className="text-gray-700">{new Date(advance.issued_at).toLocaleDateString()}</span></p>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Employee actions */}
        {isOwner && advance.status === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => action(`${id}/submit`)} disabled={working}>Submit for approval</Button>
            <Link href={`/dashboard/business/advances/${id}/edit`}>
              <Button size="sm" variant="secondary">Edit</Button>
            </Link>
            <Button size="sm" variant="secondary" className="text-red-600 border-red-200" onClick={() => action(`${id}/cancel`)} disabled={working}>Cancel</Button>
          </>
        )}
        {isOwner && advance.status === "SUBMITTED" && (
          <Button size="sm" variant="secondary" className="text-red-600 border-red-200" onClick={() => action(`${id}/cancel`)} disabled={working}>Cancel request</Button>
        )}

        {/* Finance actions */}
        {isFinance && advance.status === "SUBMITTED" && (
          <>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => action(`${id}/approve`)} disabled={working}>Approve</Button>
            <Button size="sm" variant="secondary" className="text-red-600 border-red-200" onClick={() => setShowRejectBox(!showRejectBox)} disabled={working}>Reject</Button>
          </>
        )}
        {isFinance && advance.status === "APPROVED" && (
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => action(`${id}/issue`)} disabled={working}>
            Mark as issued (disburse)
          </Button>
        )}
      </div>

      {/* Reject comment box */}
      {showRejectBox && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <label className="block text-sm font-medium text-red-700 mb-2">Rejection reason *</label>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Explain why this advance is being rejected…"
          />
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { action(`${id}/reject`, { comment: rejectComment }); setShowRejectBox(false); }}
              disabled={!rejectComment.trim() || working}
            >
              Confirm reject
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowRejectBox(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Retirements */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Retirements</h3>
        {retirements.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No retirements submitted yet.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {retirements.map((ret) => (
              <Link
                key={ret.id}
                href={`/dashboard/business/advances/retirements/${ret.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{ret.retirement_number}</p>
                  <p className="text-xs text-gray-400">{ret.retirement_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatMoney(parseFloat(ret.total_claimed), advance.currency)}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[ret.status] ?? "bg-gray-100"}`}>
                    {ret.status}
                  </span>
                </div>
                <i className="ti ti-chevron-right text-gray-300 ml-3" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {advance.notes && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-700">{advance.notes}</p>
        </div>
      )}
    </PageContainer>
  );
}
