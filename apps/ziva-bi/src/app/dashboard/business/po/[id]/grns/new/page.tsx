"use client";

/**
 * New GRN — /dashboard/business/po/[id]/grns/new
 *
 * Renders PO lines and allows user to enter received quantities.
 * Over-receipt guard: quantity_received field caps at remaining balance.
 * Posts to POST /api/po/{po_id}/grns and redirects to GRN detail.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface PoLine {
  id: string;
  line_number: number;
  description: string;
  unit_of_measure: string;
  quantity_ordered: string;
  quantity_received: string;
  unit_price: string;
}

interface PoHeader {
  po_number: string;
  title: string;
  status: string;
  exchange_rate: string;
  lines: PoLine[];
}

interface GrnLineForm {
  po_line_id: string;
  line_number: number;
  description: string;
  quantity_received: string;
  max_receivable: number;
  condition_notes: string;
}

export default function NewGrnPage() {
  const { accessToken } = useAuth();
  const { id: po_id } = useParams<{ id: string }>();
  const router = useRouter();

  const [po, setPo] = useState<PoHeader | null>(null);
  const [lines, setLines] = useState<GrnLineForm[]>([]);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !po_id) return;
    apiFetch<PoHeader>(`/api/po/${po_id}`, { token: accessToken })
      .then(data => {
        setPo(data);
        setLines(data.lines.map(ln => ({
          po_line_id: ln.id,
          line_number: ln.line_number,
          description: ln.description,
          quantity_received: "0",
          max_receivable: parseFloat(ln.quantity_ordered) - parseFloat(ln.quantity_received),
          condition_notes: "",
        })));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, po_id]);

  const updateLine = (i: number, field: keyof GrnLineForm, value: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !po_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        po_id,
        receipt_date: receiptDate,
        delivery_note_number: deliveryNote || null,
        notes: notes || null,
        lines: lines
          .filter(l => parseFloat(l.quantity_received) > 0)
          .map(l => ({
            po_line_id: l.po_line_id,
            line_number: l.line_number,
            description: l.description,
            quantity_received: parseFloat(l.quantity_received),
            condition_notes: l.condition_notes || null,
          })),
      };
      if (body.lines.length === 0) {
        setError("Enter at least one received quantity greater than zero.");
        setSubmitting(false);
        return;
      }
      const grn = await apiFetch<{ id: string }>(`/api/po/${po_id}/grns`, {
        token: accessToken,
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/dashboard/business/po/grns/${grn.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create GRN.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";

  if (loading) return <PageContainer><p className="text-sm text-gray-500">Loading…</p></PageContainer>;
  if (!po) return <PageContainer><p className="text-sm text-red-600">{error ?? "PO not found."}</p></PageContainer>;

  return (
    <PageContainer>
      <PageHeading title={`New GRN — ${po.po_number}`} />
      <p className="text-sm text-gray-600 mb-5">{po.title}</p>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Receipt Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Receipt Date *</label>
              <input type="date" className={inputCls} value={receiptDate} onChange={e => setReceiptDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Note #</label>
              <input className={inputCls} placeholder="Vendor's delivery note number" value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Items Received</p>
          <p className="text-xs text-gray-500 mb-3">Enter 0 for items not received in this delivery.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  {["#","Description","UOM","Ordered","Remaining","Received","Condition Notes"].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, i) => (
                  <tr key={line.po_line_id}>
                    <td className="px-2 py-2 text-gray-400">{line.line_number}</td>
                    <td className="px-2 py-2 text-gray-700">{line.description}</td>
                    <td className="px-2 py-2 text-gray-500">{po.lines[i]?.unit_of_measure ?? ""}</td>
                    <td className="px-2 py-2 text-gray-600">{po.lines[i]?.quantity_ordered ?? ""}</td>
                    <td className="px-2 py-2 font-medium text-amber-700">{line.max_receivable.toFixed(4)}</td>
                    <td className="px-2 py-2 w-28">
                      <input
                        type="number"
                        className={inputCls}
                        min="0"
                        max={line.max_receivable}
                        step="0.0001"
                        value={line.quantity_received}
                        onChange={e => updateLine(i, "quantity_received", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[160px]">
                      <input className={inputCls} placeholder="Optional notes" value={line.condition_notes} onChange={e => updateLine(i, "condition_notes", e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-50" style={{ background: "var(--ziva-primary, #2563EB)" }}>
            {submitting ? "Creating…" : "Create GRN (DRAFT)"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </PageContainer>
  );
}
