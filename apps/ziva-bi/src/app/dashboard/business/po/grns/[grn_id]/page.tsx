"use client";

/**
 * GRN Detail — /dashboard/business/po/grns/[grn_id]
 *
 * Shows GRN lines and Confirm button (triggers GRNI accrual + PO status update).
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface GrnLine {
  id: string;
  line_number: number;
  description: string;
  quantity_received: string;
  unit_price_on_po: string;
  amount_base: string;
  condition_notes: string | null;
}

interface Grn {
  id: string;
  po_id: string;
  grn_number: string;
  receipt_date: string;
  status: string;
  delivery_note_number: string | null;
  notes: string | null;
  confirmed_at: string | null;
  grni_journal_entry_id: string | null;
  grni_posting_batch_id: string | null;
  lines: GrnLine[];
}

export default function GrnDetailPage() {
  const { accessToken } = useAuth();
  const { grn_id } = useParams<{ grn_id: string }>();
  const router = useRouter();

  const [grn, setGrn] = useState<Grn | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGrn = useCallback(async () => {
    if (!accessToken || !grn_id) return;
    setLoading(true);
    try {
      const data = await apiFetch<Grn>(`/api/po/grns/${grn_id}`, { token: accessToken });
      setGrn(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load GRN.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, grn_id]);

  useEffect(() => { loadGrn(); }, [loadGrn]);

  const confirmGrn = async () => {
    if (!accessToken || !grn_id) return;
    if (!confirm("Confirm this GRN? This action is irreversible and will update PO receipt totals.")) return;
    setConfirming(true);
    setError(null);
    try {
      await apiFetch(`/api/po/grns/${grn_id}/confirm`, { token: accessToken, method: "POST" });
      await loadGrn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Confirmation failed.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <PageContainer><p className="text-sm text-gray-500">Loading…</p></PageContainer>;
  if (!grn) return <PageContainer><p className="text-sm text-red-600">{error ?? "GRN not found."}</p></PageContainer>;

  const totalAmount = grn.lines.reduce((s, l) => s + parseFloat(l.amount_base), 0);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <PageHeading title={grn.grn_number} />
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${grn.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {grn.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Receipt Date: <strong>{grn.receipt_date}</strong>
            {grn.delivery_note_number && <> · DN: <strong>{grn.delivery_note_number}</strong></>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/business/po/${grn.po_id}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
            ← PO
          </Link>
          {grn.status === "DRAFT" && (
            <button
              onClick={confirmGrn}
              disabled={confirming}
              className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white disabled:opacity-50"
            >
              {confirming ? "Confirming…" : "Confirm GRN"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {grn.status === "DRAFT" && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          This GRN is a DRAFT. Review quantities and click <strong>Confirm GRN</strong> to lock it and update PO receipt totals.
          {grn.grni_journal_entry_id && <> A GRNI journal will be posted automatically.</>}
        </div>
      )}

      {grn.status === "CONFIRMED" && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          Confirmed on {grn.confirmed_at ? new Date(grn.confirmed_at).toLocaleDateString() : "—"}.
          {grn.grni_journal_entry_id && <> GRNI accrual journal posted.</>}
          {grn.grni_posting_batch_id && <> Posting batch created for Connected-mode export.</>}
        </div>
      )}

      {grn.notes && <p className="text-sm text-gray-600 mb-4"><span className="font-medium">Notes:</span> {grn.notes}</p>}

      <div className="bg-white border border-gray-200 rounded-lg mb-4">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Items Received</p>
          <p className="text-sm font-semibold text-gray-900">Total: {formatMoney(totalAmount)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                {["#","Description","Qty Received","PO Unit Price","Amount (Base)","Condition Notes"].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {grn.lines.map(ln => (
                <tr key={ln.id}>
                  <td className="px-4 py-2 text-gray-400">{ln.line_number}</td>
                  <td className="px-4 py-2 text-gray-800">{ln.description}</td>
                  <td className="px-4 py-2 font-medium">{ln.quantity_received}</td>
                  <td className="px-4 py-2">{formatMoney(parseFloat(ln.unit_price_on_po))}</td>
                  <td className="px-4 py-2 font-medium">{formatMoney(parseFloat(ln.amount_base))}</td>
                  <td className="px-4 py-2 text-gray-500 italic text-xs">{ln.condition_notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
