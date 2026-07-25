"use client";

/**
 * New AP Invoice form — /dashboard/business/ap/invoices/new
 *
 * Creates a DRAFT AP invoice with multi-line support.
 * Computes line amounts client-side for immediate feedback.
 * Validates vendor selection, at least 1 line, invoice number.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vendor { id: string; code: string; name: string; vendor_type: string; }

interface LineInput {
  description: string;
  quantity: string;
  unit_price: string;
  amount_foreign: string;
  gl_account_id: string;
  vat_applicable: boolean;
  vat_rate: string;
  wht_applicable: boolean;
  wht_rate: string;
  category_hint: string;
}

interface GlAccount { id: string; gl_number: string; gl_name: string; account_type?: string; }

function emptyLine(): LineInput {
  return {
    description: "",
    quantity: "1",
    unit_price: "0",
    amount_foreign: "0",
    gl_account_id: "",
    vat_applicable: false,
    vat_rate: "0.075",
    wht_applicable: false,
    wht_rate: "0.05",
    category_hint: "",
  };
}

function computeLine(line: LineInput, exchangeRate: number) {
  const amountForeign = parseFloat(line.amount_foreign) || 0;
  const amountBase = amountForeign * exchangeRate;
  const vatAmount = line.vat_applicable ? amountBase * (parseFloat(line.vat_rate) || 0) : 0;
  const whtAmount = line.wht_applicable ? amountBase * (parseFloat(line.wht_rate) || 0) : 0;
  const netPayable = amountBase - whtAmount;
  return { amountBase, vatAmount, whtAmount, netPayable };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewApInvoicePage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);

  // Header fields
  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [description, setDescription] = useState("");

  // Lines
  const [lines, setLines] = useState<LineInput[]>([emptyLine()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      apiFetch<Vendor[]>("/api/ap/vendors", { token: accessToken }),
      apiFetch<GlAccount[]>("/api/config/coa", { token: accessToken }).catch(() => []),
    ]).then(([v, g]) => {
      setVendors(v);
      setGlAccounts(g);
    }).catch(() => {});
  }, [accessToken]);

  const er = parseFloat(exchangeRate) || 1;
  const totals = lines.reduce(
    (acc, ln) => {
      const c = computeLine(ln, er);
      return {
        amountBase: acc.amountBase + c.amountBase,
        vatAmount: acc.vatAmount + c.vatAmount,
        whtAmount: acc.whtAmount + c.whtAmount,
        netPayable: acc.netPayable + c.netPayable,
      };
    },
    { amountBase: 0, vatAmount: 0, whtAmount: 0, netPayable: 0 }
  );

  const updateLine = (i: number, key: keyof LineInput, value: string | boolean) => {
    setLines(prev => prev.map((ln, idx) => idx === i ? { ...ln, [key]: value } : ln));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { setError("Select a vendor."); return; }
    if (!invoiceNumber.trim()) { setError("Invoice number is required."); return; }
    if (lines.length === 0) { setError("Add at least one invoice line."); return; }
    if (lines.some(ln => !ln.description.trim())) { setError("All lines must have a description."); return; }

    setSaving(true);
    setError(null);

    const payload = {
      vendor_id: vendorId,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      received_date: receivedDate || undefined,
      due_date: dueDate || undefined,
      currency,
      exchange_rate: parseFloat(exchangeRate) || 1,
      description: description || undefined,
      lines: lines.map((ln, i) => ({
        line_number: i + 1,
        description: ln.description,
        quantity: parseFloat(ln.quantity) || 1,
        unit_price: parseFloat(ln.unit_price) || 0,
        amount_foreign: parseFloat(ln.amount_foreign) || 0,
        gl_account_id: ln.gl_account_id || undefined,
        dimension_values: null,
        vat_applicable: ln.vat_applicable,
        vat_rate: ln.vat_applicable ? parseFloat(ln.vat_rate) || 0 : 0,
        wht_applicable: ln.wht_applicable,
        wht_rate: ln.wht_applicable ? parseFloat(ln.wht_rate) || 0 : 0,
        category_hint: ln.category_hint || undefined,
      })),
    };

    try {
      const created = await apiFetch<{ id: string }>("/api/ap/invoices", {
        token: accessToken!,
        method: "POST",
        body: payload,
      });
      router.push(`/dashboard/business/ap/invoices/${created.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create invoice.");
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
        >
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <PageHeading title="New AP Invoice" />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor *</label>
              <select
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="">Select vendor…</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Invoice Number *</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. INV-2026-001"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Date *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Received Date</label>
              <input
                type="date"
                value={receivedDate}
                onChange={e => setReceivedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option>NGN</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
                <div className="flex-1">
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={e => setExchangeRate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Exchange rate"
                    step="0.000001"
                    min="0.000001"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description / Narration</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Optional narration"
              />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Invoice Lines</h3>
            <button
              type="button"
              onClick={addLine}
              className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
            >
              <i className="ti ti-plus text-xs" /> Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 w-8">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 min-w-[200px]">Description *</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 w-24">Amount ({currency})</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 min-w-[160px]">GL Account</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500 w-16">VAT 7.5%</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500 w-16">WHT 5%</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 w-28">Net Payable (NGN)</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map((ln, i) => {
                  const c = computeLine(ln, er);
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={ln.description}
                          onChange={e => updateLine(i, "description", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
                          placeholder="Line description"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={ln.amount_foreign}
                          onChange={e => updateLine(i, "amount_foreign", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-indigo-400"
                          step="0.01"
                          min="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={ln.gl_account_id}
                          onChange={e => updateLine(i, "gl_account_id", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
                        >
                          <option value="">No GL</option>
                          {glAccounts.map(g => (
                            <option key={g.id} value={g.id}>{g.gl_number} — {g.gl_name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={ln.vat_applicable}
                          onChange={e => updateLine(i, "vat_applicable", e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={ln.wht_applicable}
                          onChange={e => updateLine(i, "wht_applicable", e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-700">
                        {formatMoney(c.netPayable)}
                      </td>
                      <td className="px-3 py-2">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <i className="ti ti-x text-xs" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals footer */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex justify-end gap-8 text-xs">
              <div className="text-gray-500">Gross Amount: <span className="font-medium text-gray-700">{formatMoney(totals.amountBase)}</span></div>
              <div className="text-gray-500">VAT: <span className="font-medium text-gray-700">{formatMoney(totals.vatAmount)}</span></div>
              <div className="text-gray-500">WHT: <span className="font-medium text-red-600">({formatMoney(totals.whtAmount)})</span></div>
              <div className="text-gray-700 font-semibold">Net Payable: <span className="text-indigo-700">{formatMoney(totals.netPayable)}</span></div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
            style={{ background: "var(--ziva-primary, #4F46E5)" }}
          >
            {saving ? "Saving…" : "Save as Draft"}
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
