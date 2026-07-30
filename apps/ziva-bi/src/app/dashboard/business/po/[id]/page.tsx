"use client";

/**
 * PO Detail — /dashboard/business/po/[id]
 *
 * Shows full PO with lines, approval history, GRN list, and action buttons
 * (Submit, Approve, Reject, Send, Close, Cancel).
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface PoLine {
  id: string;
  line_number: number;
  description: string;
  unit_of_measure: string;
  quantity_ordered: string;
  unit_price: string;
  amount_base: string;
  quantity_received: string;
  quantity_invoiced: string;
  gl_account_id: string | null;
}

interface PoApproval {
  id: string;
  step_order: number;
  status: string;
  is_advisory: boolean;
  action_at: string | null;
  comment: string | null;
}

interface Grn {
  id: string;
  grn_number: string;
  receipt_date: string;
  status: string;
  delivery_note_number: string | null;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  title: string;
  status: string;
  currency: string;
  exchange_rate: string;
  total_amount_foreign: string;
  total_amount_base: string;
  amount_received: string;
  amount_invoiced: string;
  delivery_date: string | null;
  delivery_address: string | null;
  notes: string | null;
  posting_mode: string | null;
  rejection_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  sent_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  lines: PoLine[];
  approvals: PoApproval[];
}

const STATUS_COLOURS: Record<string, string> = {
  DRAFT:              "bg-gray-100 text-gray-600",
  SUBMITTED:          "bg-blue-100 text-blue-700",
  APPROVED:           "bg-green-100 text-green-700",
  REJECTED:           "bg-red-100 text-red-700",
  SENT:               "bg-indigo-100 text-indigo-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  FULLY_RECEIVED:     "bg-teal-100 text-teal-700",
  CLOSED:             "bg-gray-200 text-gray-600",
  CANCELLED:          "bg-gray-100 text-gray-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function PoDetailPage() {
  const { accessToken, user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionComment, setActionComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const loadPo = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const [poData, grnData] = await Promise.all([
        apiFetch<PurchaseOrder>(`/api/po/${id}`, { token: accessToken }),
        apiFetch<Grn[]>(`/api/po/${id}/grns`, { token: accessToken }).catch(() => []),
      ]);
      setPo(poData);
      setGrns(grnData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load PO.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => { loadPo(); }, [loadPo]);

  const action = async (endpoint: string, body?: object) => {
    if (!accessToken) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/po/${id}/${endpoint}`, {
        token: accessToken,
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      await loadPo();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Action failed.`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <PageContainer><p className="text-sm text-gray-500">Loading…</p></PageContainer>;
  if (!po) return <PageContainer><p className="text-sm text-red-600">{error ?? "PO not found."}</p></PageContainer>;

  const canSubmit = po.status === "DRAFT";
  const canApprove = po.status === "SUBMITTED";
  const canSend = po.status === "APPROVED";
  const canClose = ["SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"].includes(po.status);
  const canCancel = !["PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"].includes(po.status);
  const canCreateGrn = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(po.status);

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <PageHeading title={po.po_number} />
            <StatusBadge status={po.status} />
          </div>
          <p className="text-sm text-gray-600">{po.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateGrn && (
            <Link
              href={`/dashboard/business/po/${id}/grns/new`}
              className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
            >
              + Create GRN
            </Link>
          )}
          {canSubmit && (
            <button onClick={() => action("submit")} disabled={actionLoading} className="px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-50" style={{ background: "var(--ziva-primary, #2563EB)" }}>
              Submit for Approval
            </button>
          )}
          {canApprove && (
            <>
              <button onClick={() => action("approve", { comment: actionComment })} disabled={actionLoading} className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white disabled:opacity-50">
                Approve
              </button>
              <button onClick={() => setShowReject(true)} disabled={actionLoading} className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white disabled:opacity-50">
                Reject
              </button>
            </>
          )}
          {canSend && (
            <button onClick={() => action("send")} disabled={actionLoading} className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50">
              Mark as Sent
            </button>
          )}
          {canClose && (
            <button onClick={() => action("close")} disabled={actionLoading} className="px-3 py-1.5 text-sm border border-gray-400 rounded-md hover:bg-gray-50 disabled:opacity-50">
              Close PO
            </button>
          )}
          {canCancel && po.status !== "DRAFT" && (
            <button onClick={() => { if (confirm("Cancel this PO?")) action("cancel"); }} disabled={actionLoading} className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50">
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <p className="font-semibold text-gray-800 mb-3">Reject PO</p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rejection Reason *</label>
            <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => { action("reject", { rejection_reason: rejectReason }); setShowReject(false); }} disabled={!rejectReason.trim() || actionLoading} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md disabled:opacity-50">Reject</button>
              <button onClick={() => setShowReject(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "PO Total", value: formatMoney(parseFloat(po.total_amount_base)) },
          { label: "Received", value: formatMoney(parseFloat(po.amount_received)) },
          { label: "Invoiced", value: formatMoney(parseFloat(po.amount_invoiced)) },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5 bg-white border border-gray-200 rounded-lg p-5 text-sm">
        <div><span className="text-gray-500">Currency:</span> <span className="font-medium ml-1">{po.currency} @ {po.exchange_rate}</span></div>
        <div><span className="text-gray-500">Delivery Date:</span> <span className="font-medium ml-1">{po.delivery_date ?? "—"}</span></div>
        <div><span className="text-gray-500">Mode:</span> <span className="font-medium ml-1">{po.posting_mode ?? "—"}</span></div>
        {po.rejection_reason && <div className="col-span-2"><span className="text-red-600 text-xs">Rejected: {po.rejection_reason}</span></div>}
        {po.notes && <div className="col-span-2"><span className="text-gray-500">Notes:</span> <span className="ml-1 text-gray-700">{po.notes}</span></div>}
      </div>

      {/* Lines */}
      <div className="bg-white border border-gray-200 rounded-lg mb-5">
        <div className="px-5 py-3 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">Line Items</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                {["#","Description","UOM","Ordered","Received","Invoiced","Unit Price","Amount"].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {po.lines.map(ln => (
                <tr key={ln.id}>
                  <td className="px-4 py-2 text-gray-400">{ln.line_number}</td>
                  <td className="px-4 py-2 text-gray-800">{ln.description}</td>
                  <td className="px-4 py-2 text-gray-500">{ln.unit_of_measure}</td>
                  <td className="px-4 py-2">{ln.quantity_ordered}</td>
                  <td className="px-4 py-2 text-amber-700">{ln.quantity_received}</td>
                  <td className="px-4 py-2 text-blue-700">{ln.quantity_invoiced}</td>
                  <td className="px-4 py-2">{formatMoney(parseFloat(ln.unit_price))}</td>
                  <td className="px-4 py-2 font-medium">{formatMoney(parseFloat(ln.amount_base))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRNs */}
      <div className="bg-white border border-gray-200 rounded-lg mb-5">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Goods Receipt Notes</p>
          {canCreateGrn && (
            <Link href={`/dashboard/business/po/${id}/grns/new`} className="text-xs text-blue-600 hover:underline">+ New GRN</Link>
          )}
        </div>
        {grns.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No GRNs yet.</p>
        ) : (
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                {["GRN #","Receipt Date","Status","Delivery Note",""].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {grns.map(g => (
                <tr key={g.id}>
                  <td className="px-4 py-2 font-mono text-xs font-medium text-blue-600">
                    <Link href={`/dashboard/business/po/grns/${g.id}`}>{g.grn_number}</Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{g.receipt_date}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${g.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{g.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{g.delivery_note_number ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/business/po/grns/${g.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approval trail */}
      {po.approvals.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-5 py-3 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">Approval Trail</p></div>
          <div className="divide-y divide-gray-50">
            {po.approvals.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center gap-4">
                <span className="text-xs text-gray-400 w-16">Step {a.step_order}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  a.status === "APPROVED" ? "bg-green-100 text-green-700"
                  : a.status === "REJECTED" ? "bg-red-100 text-red-700"
                  : a.status === "PENDING" ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
                }`}>{a.status}</span>
                {a.is_advisory && <span className="text-xs text-gray-400">(advisory)</span>}
                {a.comment && <span className="text-xs text-gray-600 italic">{a.comment}</span>}
                {a.action_at && <span className="text-xs text-gray-400 ml-auto">{new Date(a.action_at).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
