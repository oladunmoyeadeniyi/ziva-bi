"use client";

/**
 * Public customer portal page — /portal/customer/[token]
 *
 * Customers access this URL via their unique portal link.
 * No PRAD account needed — the token in the URL authenticates them.
 *
 * Flow:
 *  1. Mount → POST /api/customer-portal/auth/{token} → receive JWT
 *  2. Use JWT as Bearer token for subsequent API calls
 *  3. Customer sees their AR invoices + can send messages/disputes
 *
 * Tabs:
 *   My Invoices — AR invoices from PRAD side
 *   Message Us  — dispute / remittance notice form
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ArInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: number;
  balance_due: number;
  currency_code: string;
  status: string;
}

type Tab = "invoices" | "message";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-50 text-gray-600 border-gray-200",
    SENT: "bg-blue-50 text-blue-700 border-blue-200",
    PARTIALLY_PAID: "bg-amber-50 text-amber-700 border-amber-200",
    PAID: "bg-green-50 text-green-700 border-green-200",
    OVERDUE: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESSAGE_TYPES = ["DISPUTE", "REMITTANCE_NOTICE", "QUERY", "PAYMENT_CONFIRMATION", "OTHER"];

export default function CustomerPortalPage() {
  const params = useParams<{ token: string }>();
  const [jwt, setJwt] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [authError, setAuthError] = useState(false);
  const [tab, setTab] = useState<Tab>("invoices");

  const [invoices, setInvoices] = useState<ArInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Message form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [form, setForm] = useState({
    message_type: "QUERY",
    subject: "",
    body: "",
    amount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Authenticate on mount
  useEffect(() => {
    if (!params.token) return;
    fetch(`${API_URL}/api/customer-portal/auth/${params.token}`, { method: "POST" })
      .then(res => {
        if (!res.ok) throw new Error("invalid");
        return res.json();
      })
      .then(data => {
        setJwt(data.jwt);
        setCustomerName(data.customer_name ?? "");
      })
      .catch(() => setAuthError(true));
  }, [params.token]);

  // Fetch invoices once JWT is available
  useEffect(() => {
    if (!jwt) return;
    setInvoicesLoading(true);
    fetch(`${API_URL}/api/customer-portal/portal/invoices`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then(r => r.json())
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setInvoicesLoading(false));
  }, [jwt]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!jwt) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_URL}/api/customer-portal/portal/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          message_type: form.message_type,
          subject: form.subject,
          body: form.body || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          ar_invoice_id: selectedInvoiceId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Failed to send message");
      }
      setSubmitSuccess(true);
      setForm({ message_type: "QUERY", subject: "", body: "", amount: "" });
      setSelectedInvoiceId("");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to send message");
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

  // Summary stats
  const totalOutstanding = invoices
    .filter(inv => inv.status !== "PAID")
    .reduce((sum, inv) => sum + (inv.balance_due ?? inv.total_amount), 0);
  const overdueCount = invoices.filter(inv => inv.status === "OVERDUE").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Customer Portal</p>
            <h1 className="text-lg font-semibold text-gray-800">{customerName}</h1>
          </div>
          <div className="text-xs text-gray-400">Powered by PRAD</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Outstanding balance</p>
            <p className="text-xl font-bold text-gray-800">{fmt(totalOutstanding)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Overdue invoices</p>
            <p className={`text-xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-gray-800"}`}>{overdueCount}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {(["invoices", "message"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? "border-blue-500 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "invoices" ? "My Invoices" : "Message Us"}
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
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance due</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.invoice_date ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.due_date ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{inv.currency_code} {fmt(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{inv.currency_code} {fmt(inv.balance_due ?? inv.total_amount)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={inv.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Message form */
          <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-xl">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Send us a message</h2>

            {submitSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Your message has been sent. Our team will get back to you.
                <button type="button" className="ml-3 underline" onClick={() => setSubmitSuccess(false)}>Send another</button>
              </div>
            )}

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{submitError}</div>
            )}

            {!submitSuccess && (
              <form onSubmit={sendMessage} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message type *</label>
                  <select
                    value={form.message_type}
                    onChange={e => setForm(f => ({ ...f, message_type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  >
                    {MESSAGE_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                {invoices.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Related invoice (optional)</label>
                    <select
                      value={selectedInvoiceId}
                      onChange={e => setSelectedInvoiceId(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      <option value="">— Select invoice —</option>
                      {invoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} · {inv.currency_code} {fmt(inv.total_amount)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label>
                  <input
                    required
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    placeholder="Brief summary of your message"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Details</label>
                  <textarea
                    rows={4}
                    value={form.body}
                    onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                    placeholder="Describe your query, dispute, or notice in detail"
                  />
                </div>
                {(form.message_type === "DISPUTE" || form.message_type === "REMITTANCE_NOTICE" || form.message_type === "PAYMENT_CONFIRMATION") && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount (if applicable)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      placeholder="0.00"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
                >
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
