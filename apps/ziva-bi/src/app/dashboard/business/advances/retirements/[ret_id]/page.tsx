"use client";

/**
 * Retirement detail — /dashboard/business/advances/retirements/[ret_id]
 *
 * Shows the retirement and all its lines.
 * Finance can approve, reject, and post to GL.
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

interface Retirement {
  id: string;
  retirement_number: string;
  retirement_date: string;
  advance_id: string;
  advance_amount: string;
  total_claimed: string;
  balance: string;
  status: string;
  rejection_comment: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  notes: string | null;
  lines: RetirementLine[];
}

interface RetirementLine {
  id: string;
  description: string;
  amount: string;
  currency: string;
  receipt_date: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    "bg-gray-100 text-gray-600",
  SUBMITTED:"bg-blue-50 text-blue-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  POSTED:   "bg-green-100 text-green-800",
  REJECTED: "bg-red-50 text-red-700",
};

export default function RetirementDetailPage() {
  const { ret_id } = useParams<{ ret_id: string }>();
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const [retirement, setRetirement] = useState<Retirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [msg, setMsg] = useState("");

  const isFinance = user?.is_tenant_admin;

  const load = async () => {
    if (!accessToken) return;
    try {
      const ret = await apiFetch<Retirement>(`/api/advances/retirements/${ret_id}`, { token: accessToken });
      setRetirement(ret);
    } catch { setRetirement(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [ret_id, accessToken]);

  const doAction = async (endpoint: string, body?: Record<string, unknown>) => {
    if (!accessToken) return;
    setWorking(true); setMsg("");
    try {
      await apiFetch(`/api/advances/retirements/${ret_id}/${endpoint}`, {
        method: "POST", token: accessToken, body,
      });
      await load();
      setMsg("Done.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Action failed.");
    } finally { setWorking(false); }
  };

  if (loading) return <PageContainer><p className="text-sm text-gray-400 py-8 text-center">Loading…</p></PageContainer>;
  if (!retirement) return <PageContainer><p className="text-sm text-red-500 py-8">Retirement not found.</p></PageContainer>;

  const advanceAmount = parseFloat(retirement.advance_amount);
  const totalClaimed = parseFloat(retirement.total_claimed);
  const balance = parseFloat(retirement.balance);
  const currency = retirement.lines?.[0]?.currency ?? "NGN";

  return (
    <PageContainer>
      <PageHeading
        title={retirement.retirement_number}
        subtitle={`Retirement for advance`}
        actions={
          <Link href={`/dashboard/business/advances/${retirement.advance_id}`}>
            <Button size="sm" variant="secondary">Back to advance</Button>
          </Link>
        }
      />

      {msg && (
        <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${msg === "Done." ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {msg}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Status</p>
          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[retirement.status] ?? "bg-gray-100"}`}>
            {retirement.status}
          </span>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Advance amount</p>
          <p className="font-bold text-gray-900">{formatMoney(advanceAmount, currency)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Total claimed</p>
          <p className="font-bold text-indigo-700">{formatMoney(totalClaimed, currency)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${balance > 0 ? "bg-green-50 border-green-200" : balance < 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
          <p className="text-xs text-gray-400 mb-1">{balance > 0 ? "Overspend" : balance < 0 ? "Underspend" : "Balanced"}</p>
          <p className={`font-bold ${balance > 0 ? "text-green-700" : balance < 0 ? "text-amber-700" : "text-gray-500"}`}>
            {formatMoney(Math.abs(balance), currency)}
          </p>
        </div>
      </div>

      {/* Finance action buttons */}
      {isFinance && (
        <div className="flex flex-wrap gap-2 mb-6">
          {retirement.status === "SUBMITTED" && (
            <>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => doAction("approve")} disabled={working}>Approve</Button>
              <Button size="sm" variant="secondary" className="text-red-600 border-red-200" onClick={() => setShowRejectBox(!showRejectBox)} disabled={working}>Reject</Button>
            </>
          )}
          {retirement.status === "APPROVED" && !retirement.posted_at && (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => doAction("post")} disabled={working}>
              Post to GL
            </Button>
          )}
        </div>
      )}

      {/* Reject box */}
      {showRejectBox && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <label className="block text-sm font-medium text-red-700 mb-2">Rejection reason *</label>
          <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} rows={3}
            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="bg-red-600 hover:bg-red-700"
              onClick={() => { doAction("reject", { comment: rejectComment }); setShowRejectBox(false); }}
              disabled={!rejectComment.trim() || working}>Confirm reject</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowRejectBox(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Rejection comment */}
      {retirement.rejection_comment && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-600 mb-1">Rejection reason</p>
          <p className="text-sm text-red-700">{retirement.rejection_comment}</p>
        </div>
      )}

      {/* Lines */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Expense lines</h3>
      {(retirement.lines ?? []).length === 0 ? (
        <p className="text-sm text-gray-400">No lines.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {(retirement.lines ?? []).map((line) => (
            <div key={line.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm text-gray-900">{line.description}</p>
                {line.receipt_date && <p className="text-xs text-gray-400">{line.receipt_date}</p>}
              </div>
              <span className="text-sm font-medium text-gray-900">{formatMoney(parseFloat(line.amount), line.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2.5 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-bold text-gray-900">{formatMoney(totalClaimed, currency)}</span>
          </div>
        </div>
      )}

      {retirement.notes && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-700">{retirement.notes}</p>
        </div>
      )}
    </PageContainer>
  );
}
