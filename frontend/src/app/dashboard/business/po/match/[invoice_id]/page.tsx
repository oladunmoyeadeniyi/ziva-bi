"use client";

/**
 * Match Invoice — /dashboard/business/po/match/[invoice_id]
 *
 * Finance tool for recording 3-way match between an AP invoice's lines
 * and GRN lines. Displays invoice lines, lets finance select which GRN line
 * each maps to, enters matched quantity, and previews variance.
 *
 * Posts to POST /api/po/matches and redirects to match report on success.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface InvoiceLine {
  id: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_price: string;
  amount_base: string;
}

interface Invoice {
  id: string;
  reference: string;
  vendor_id: string;
  vendor_name: string;
  invoice_date: string;
  total_amount_base: string;
  status: string;
  lines: InvoiceLine[];
}

interface GrnOption {
  grn_id: string;
  grn_line_id: string;
  grn_number: string;
  receipt_date: string;
  po_number: string;
  description: string;
  quantity_received: string;
  unit_price_on_po: string;
}

interface MatchLineForm {
  invoice_line_id: string;
  grn_line_id: string;
  matched_quantity: string;
}

export default function MatchInvoicePage() {
  const { accessToken } = useAuth();
  const { invoice_id } = useParams<{ invoice_id: string }>();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [grnOptions, setGrnOptions] = useState<GrnOption[]>([]);
  const [matchForms, setMatchForms] = useState<MatchLineForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !invoice_id) return;
    Promise.all([
      apiFetch<Invoice>(`/api/ap/invoices/${invoice_id}`, { token: accessToken }),
      // Load all confirmed GRN lines by fetching GRNs via POs
      // In practice, finance will know which POs the invoice relates to.
      // We load recent confirmed GRN lines via a summary approach.
    ])
      .then(([inv]) => {
        setInvoice(inv);
        setMatchForms(inv.lines.map(ln => ({
          invoice_line_id: ln.id,
          grn_line_id: "",
          matched_quantity: ln.quantity,
        })));
      })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load invoice."))
      .finally(() => setLoading(false));
  }, [accessToken, invoice_id]);

  const updateMatch = (i: number, field: keyof MatchLineForm, value: string) => {
    setMatchForms(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !invoice_id) return;
    const valid = matchForms.filter(m => m.grn_line_id && parseFloat(m.matched_quantity) > 0);
    if (valid.length === 0) {
      setError("Select at least one GRN line to match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/po/matches", {
        token: accessToken,
        method: "POST",
        body: JSON.stringify({
          invoice_id,
          matches: valid.map(m => ({
            invoice_line_id: m.invoice_line_id,
            grn_line_id: m.grn_line_id,
            matched_quantity: parseFloat(m.matched_quantity),
          })),
        }),
      });
      router.push("/dashboard/business/po/match-report");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Match failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";

  if (loading) return <PageContainer><p className="text-sm text-gray-500">Loading…</p></PageContainer>;
  if (!invoice) return <PageContainer><p className="text-sm text-red-600">{error ?? "Invoice not found."}</p></PageContainer>;

  return (
    <PageContainer>
      <PageHeading title={`3-Way Match — ${invoice.reference}`} />
      <p className="text-sm text-gray-600 mb-1">{invoice.vendor_name} · {invoice.invoice_date}</p>
      <p className="text-sm text-gray-700 mb-5">Invoice Total: <strong>{formatMoney(parseFloat(invoice.total_amount_base))}</strong></p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-5xl">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>How to match:</strong> For each invoice line below, paste the GRN Line ID from the confirmed GRN and enter the quantity being matched. The system will compute price and qty variance automatically.
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Invoice Lines → GRN Line Mapping</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  {["#","Description","Inv Qty","Inv Unit Price","Inv Amount","GRN Line ID","Matched Qty"].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.lines.map((ln, i) => (
                  <tr key={ln.id}>
                    <td className="px-4 py-2 text-gray-400">{ln.line_number}</td>
                    <td className="px-4 py-2 text-gray-800">{ln.description}</td>
                    <td className="px-4 py-2">{ln.quantity}</td>
                    <td className="px-4 py-2">{formatMoney(parseFloat(ln.unit_price))}</td>
                    <td className="px-4 py-2 font-medium">{formatMoney(parseFloat(ln.amount_base))}</td>
                    <td className="px-4 py-2 min-w-[260px]">
                      <input
                        className={inputCls}
                        placeholder="Paste GRN line UUID…"
                        value={matchForms[i]?.grn_line_id ?? ""}
                        onChange={e => updateMatch(i, "grn_line_id", e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 w-28">
                      <input
                        type="number"
                        className={inputCls}
                        min="0"
                        step="0.0001"
                        value={matchForms[i]?.matched_quantity ?? ""}
                        onChange={e => updateMatch(i, "matched_quantity", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-2">Finding GRN Line IDs</p>
          <p>Navigate to <strong>Purchase Orders → [PO] → GRNs → [GRN]</strong> and copy the GRN line IDs. A future update will add a dropdown picker here.</p>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-50" style={{ background: "var(--ziva-primary, #2563EB)" }}>
            {submitting ? "Recording…" : "Record 3-Way Match"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </PageContainer>
  );
}
