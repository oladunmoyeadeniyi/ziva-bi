"use client";

/**
 * New Purchase Order — /dashboard/business/po/new
 *
 * Multi-line form: header fields + dynamic line table.
 * Posts to POST /api/po/ and redirects to PO detail on success.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface Vendor { id: string; name: string; currency: string; }
interface GlAccount { id: string; code: string; name: string; }

interface LineForm {
  line_number: number;
  description: string;
  unit_of_measure: string;
  quantity_ordered: string;
  unit_price: string;
  gl_account_id: string;
  vat_applicable: boolean;
  vat_rate: string;
  wht_applicable: boolean;
  wht_rate: string;
  category_hint: string;
}

const emptyLine = (n: number): LineForm => ({
  line_number: n,
  description: "",
  unit_of_measure: "units",
  quantity_ordered: "1",
  unit_price: "0",
  gl_account_id: "",
  vat_applicable: false,
  vat_rate: "0.075",
  wht_applicable: false,
  wht_rate: "0.05",
  category_hint: "",
});

export default function NewPoPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [header, setHeader] = useState({
    vendor_id: "",
    title: "",
    delivery_date: "",
    delivery_address: "",
    currency: "NGN",
    exchange_rate: "1",
    notes: "",
  });
  const [lines, setLines] = useState<LineForm[]>([emptyLine(1)]);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      apiFetch<Vendor[]>("/api/ap/vendors", { token: accessToken }).catch(() => []),
      apiFetch<GlAccount[]>("/api/config/coa", { token: accessToken }).catch(() => []),
    ]).then(([v, g]) => {
      setVendors(v);
      setGlAccounts(g);
    });
  }, [accessToken]);

  const lineTotal = (l: LineForm) =>
    (parseFloat(l.quantity_ordered || "0") * parseFloat(l.unit_price || "0")).toFixed(2);

  const grandTotal = lines.reduce(
    (s, l) => s + parseFloat(lineTotal(l)) * parseFloat(header.exchange_rate || "1"),
    0
  ).toFixed(2);

  const updateLine = (i: number, field: keyof LineForm, value: string | boolean) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (i: number) =>
    setLines(prev => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, line_number: idx + 1 })));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        ...header,
        exchange_rate: parseFloat(header.exchange_rate),
        lines: lines.map(l => ({
          line_number: l.line_number,
          description: l.description,
          unit_of_measure: l.unit_of_measure,
          quantity_ordered: parseFloat(l.quantity_ordered),
          unit_price: parseFloat(l.unit_price),
          gl_account_id: l.gl_account_id || null,
          vat_applicable: l.vat_applicable,
          vat_rate: parseFloat(l.vat_rate),
          wht_applicable: l.wht_applicable,
          wht_rate: parseFloat(l.wht_rate),
          category_hint: l.category_hint || null,
        })),
      };
      const po = await apiFetch<{ id: string }>("/api/po/", {
        token: accessToken,
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/dashboard/business/po/${po.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create PO.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-700 mb-1";

  return (
    <PageContainer>
      <PageHeading title="New Purchase Order" />
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

        {/* Header fields */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">PO Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Vendor *</label>
              <select className={inputCls} value={header.vendor_id} onChange={e => setHeader(h => ({ ...h, vendor_id: e.target.value }))} required>
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Title *</label>
              <input className={inputCls} placeholder="e.g. Office supplies Q3" value={header.title} onChange={e => setHeader(h => ({ ...h, title: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input className={inputCls} value={header.currency} onChange={e => setHeader(h => ({ ...h, currency: e.target.value.toUpperCase() }))} maxLength={3} />
            </div>
            <div>
              <label className={labelCls}>Exchange Rate</label>
              <input type="number" className={inputCls} step="0.000001" min="0" value={header.exchange_rate} onChange={e => setHeader(h => ({ ...h, exchange_rate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Delivery Date</label>
              <input type="date" className={inputCls} value={header.delivery_date} onChange={e => setHeader(h => ({ ...h, delivery_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Delivery Address</label>
              <input className={inputCls} placeholder="e.g. 25 Marina Street, Lagos" value={header.delivery_address} onChange={e => setHeader(h => ({ ...h, delivery_address: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea className={inputCls} rows={2} value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">Line Items</p>
            <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:underline">+ Add line</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  {["#","Description","UOM","Qty","Unit Price","Amount","GL Account","VAT","WHT",""].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 text-gray-400 w-8">{line.line_number}</td>
                    <td className="px-2 py-2 min-w-[160px]">
                      <input className={inputCls} placeholder="Description" value={line.description} onChange={e => updateLine(i, "description", e.target.value)} required />
                    </td>
                    <td className="px-2 py-2 w-24">
                      <input className={inputCls} placeholder="units" value={line.unit_of_measure} onChange={e => updateLine(i, "unit_of_measure", e.target.value)} />
                    </td>
                    <td className="px-2 py-2 w-24">
                      <input type="number" className={inputCls} min="0" step="0.0001" value={line.quantity_ordered} onChange={e => updateLine(i, "quantity_ordered", e.target.value)} />
                    </td>
                    <td className="px-2 py-2 w-28">
                      <input type="number" className={inputCls} min="0" step="0.01" value={line.unit_price} onChange={e => updateLine(i, "unit_price", e.target.value)} />
                    </td>
                    <td className="px-2 py-2 w-28 font-medium text-gray-700">
                      {parseFloat(header.currency === "NGN" ? lineTotal(line) : lineTotal(line)).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 min-w-[140px]">
                      <select className={inputCls} value={line.gl_account_id} onChange={e => updateLine(i, "gl_account_id", e.target.value)}>
                        <option value="">No GL</option>
                        {glAccounts.map(g => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 w-16 text-center">
                      <input type="checkbox" checked={line.vat_applicable} onChange={e => updateLine(i, "vat_applicable", e.target.checked)} />
                    </td>
                    <td className="px-2 py-2 w-16 text-center">
                      <input type="checkbox" checked={line.wht_applicable} onChange={e => updateLine(i, "wht_applicable", e.target.checked)} />
                    </td>
                    <td className="px-2 py-2 w-8">
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Grand Total (Base):</td>
                  <td className="px-2 py-2 font-bold text-gray-900">{parseFloat(grandTotal).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-50"
            style={{ background: "var(--ziva-primary, #2563EB)" }}
          >
            {submitting ? "Creating…" : "Create PO"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
