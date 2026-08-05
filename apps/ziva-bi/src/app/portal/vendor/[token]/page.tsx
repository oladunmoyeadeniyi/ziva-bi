"use client";

/**
 * Public vendor portal page — /portal/vendor/[token]
 *
 * Vendors access this URL via their unique portal link.
 * No PRAD account needed — the token in the URL authenticates them.
 *
 * Flow:
 *  1. Mount → POST /api/vendor-portal/auth/{token} → receive JWT
 *  2. Use JWT as Bearer token for subsequent API calls
 *  3. Vendor sees their AP invoices + can submit new invoices
 *
 * Tabs:
 *   My Invoices  — AP invoices from PRAD side
 *   Submit Invoice — new invoice submission form
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface VendorInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: number;
  currency_code: string;
  status: string;
}

type Tab = "invoices" | "submit";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-50 text-gray-600 border-gray-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    PAID: "bg-blue-50 text-blue-700 border-blue-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function VendorPortalPage() {
  const params = useParams<{ token: string }>();
  const [jwt, setJwt] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [authError, setAuthError] = useState(false);
  const [tab, setTab] = useState<Tab>("invoices");

  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Submit form state
  const [form, setForm] = useState({
    invoice_number: "",
    invoice_date: "",
    due_date: "",
    currency_code: "NGN",
    total_amount: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Authenticate on mount
  useEffect(() => {
    if (!params.token) return;
    fetch(`${API_URL}/api/vendor-portal/auth/${params.token}`, { method: "POST" })
      .then(res => {
        if (!res.ok) throw new Error("invalid");
        return res.json();
      })
      .then(data => {
        setJwt(data.jwt);
        setVendorName(data.vendor_name ?? "");
      })
      .catch(() => setAuthError(true));
  }, [params.token]);

  // Fetch invoices once JWT is available
  useEffect(() => {
    if (!jwt) return;
    setInvoicesLoading(true);
    fetch(`${API_URL}/api/vendor-portal/portal/invoices`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then(r => r.json())
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setInvoicesLoading(false));
  }, [jwt]);

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!jwt) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_URL}/api/vendor-portal/portal/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          ...form,
          total_amount: parseFloat(form.total_amount),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Submission failed");
      }
      setSubmitSuccess(true);
      setForm({ invoice_number: "", invoice_date: "", due_date: "", currency_code: "NGN", total_amount: "", description: "" });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-link-off text-red-400" style={{ fontSize: 24 }} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Portal link invalid</h2>
          <p className="text-sm text-gray-500">This portal link is no longer active. Please contact your account manager for a new link.</p>
        </div>
      </div>
    );
  }

  if (!jwt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading your portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Vendor Portal</p>
            <h1 className="text-lg font-semibold text-gray-800">{vendorName}</h1>
          </div>
          <div className="text-xs text-gray-400">Powered by PRAD</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {(["invoices", "submit"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? "border-blue-500 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "invoices" ? "My Invoices" : "Submit New Invoice"}
            </button>
          ))}
        </div>

        {tab === "invoices" ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {invoicesLoading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No invoices found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Due</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.invoice_date ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.due_date ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {inv.currency_code} {fmt(inv.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={inv.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Submit invoice form */
          <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-xl">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Submit an Invoice</h2>

            {submitSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Invoice submitted successfully. Your account manager will review it.
                <button type="button" className="ml-3 underline" onClick={() => setSubmitSuccess(false)}>Submit another</button>
              </div>
            )}

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{submitError}</div>
            )}

            {!submitSuccess && (
              <form onSubmit={submitInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Invoice number *</label>
                    <input
                      required
                      value={form.invoice_number}
                      onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      placeholder="INV-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Currency *</label>
                    <select
                      value={form.currency_code}
                      onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      {["NGN", "USD", "GBP", "EUR"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Invoice date *</label>
                    <input
                      required type="date"
                      value={form.invoice_date}
                      onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Due date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total amount *</label>
                  <input
                    required type="number" min="0" step="0.01"
                    value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description / note</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                    placeholder="Optional description of goods / services"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
                >
                  {submitting ? "Submitting…" : "Submit Invoice"}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
