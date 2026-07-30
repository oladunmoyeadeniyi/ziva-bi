"use client";

/**
 * AR Invoice detail — /dashboard/business/ar/invoices/[id]
 *
 * Shows full invoice detail: header, lines, approval trail.
 * Actions depend on invoice status and current user:
 *   DRAFT     → Submit, Delete, Cancel
 *   SUBMITTED → Approve / Reject (if current user is the pending approver)
 *   APPROVED  → Record Receipt
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Banner } from "@/components/Banner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArLine {
  id: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_price: string;
  amount_foreign: string;
  amount_base: string;
  gl_account_id: string | null;
  vat_applicable: boolean;
  vat_rate: string;
  vat_amount: string;
  wht_applicable: boolean;
  wht_rate: string;
  wht_amount: string;
  net_receivable_line: string;
}

interface ArApproval {
  id: string;
  step_order: number;
  approver_id: string | null;
  status: string;
  is_advisory: boolean;
  action_at: string | null;
  comment: string | null;
}

interface ArInvoiceDetail {
  id: string;
  reference: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  invoice_date: string;
  due_date: string | null;
  service_period_start: string | null;
  service_period_end: string | null;
  currency: string;
  exchange_rate: string;
  total_amount_foreign: string;
  total_amount_base: string;
  total_vat: string;
  total_wht: string;
  net_receivable: string;
  description: string | null;
  status: string;
  posting_mode: string | null;
  duplicate_flag: boolean;
  rejection_reason: string | null;
  received_at: string | null;
  receipt_reference: string | null;
  journal_entry_id: string | null;
  receipt_journal_entry_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  lines: ArLine[];
  approvals: ArApproval[];
}

interface BankAccount { id: string; name: string; account_number: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  DRAFT:     "bg-gray-100 text-gray-600 border-gray-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVED:  "bg-green-50 text-green-700 border-green-200",
  REJECTED:  "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
  RECEIVED:  "bg-purple-50 text-purple-700 border-purple-200",
};

const APPROVAL_STATUS_COLOURS: Record<string, string> = {
  PENDING:  "text-yellow-600",
  APPROVED: "text-green-600",
  REJECTED: "text-red-600",
  SKIPPED:  "text-gray-400",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ArInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const [invoice, setInvoice] = useState<ArInvoiceDetail | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Submit modal
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState("");

  // Reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Receipt modal
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptBankId, setReceiptBankId] = useState("");

  const fetchInvoice = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<ArInvoiceDetail>(`/api/ar/invoices/${id}`, { token: accessToken });
      setInvoice(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
    if (accessToken) {
      apiFetch<BankAccount[]>("/api/bank-accounts", { token: accessToken }).then(setBankAccounts).catch(() => {});
    }
  }, [id, accessToken]);

  const doAction = async (endpoint: string, body?: object) => {
    if (!accessToken) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/api/ar/invoices/${id}/${endpoint}`, {
        token: accessToken,
        method: "POST",
        body: body ?? {},
      });
      await fetchInvoice();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <PageContainer><p className="text-gray-400 text-sm py-8">Loading…</p></PageContainer>;
  if (error) return <PageContainer><Banner variant="error">{error}</Banner></PageContainer>;
  if (!invoice) return null;

  const pendingStep = invoice.approvals.find(a => a.status === "PENDING");
  const isCurrentApprover = pendingStep?.approver_id === user?.id;
  const statusColour = STATUS_COLOURS[invoice.status] ?? "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.push("/dashboard/business/ar/invoices")} className="text-gray-500 hover:text-gray-700">
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <div className="flex-1">
          <PageHeading title={invoice.reference} />
          <p className="text-xs text-gray-500 mt-0.5">{invoice.customer_name} ({invoice.customer_code}) · Invoice #{invoice.invoice_number}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusColour}`}>
          {invoice.status}
          {invoice.duplicate_flag && <span className="ml-2 text-yellow-600">⚠ DUP</span>}
        </span>
      </div>

      {actionError && <Banner variant="error" className="mb-4">{actionError}</Banner>}

      {invoice.status === "REJECTED" && invoice.rejection_reason && (
        <Banner variant="error" className="mb-4">
          Rejected: {invoice.rejection_reason}
        </Banner>
      )}

      {invoice.duplicate_flag && (
        <Banner variant="warning" className="mb-4">
          Duplicate detected — another invoice with the same customer and invoice number already exists.
        </Banner>
      )}

      {/* Action bar */}
      <div className="flex gap-2 mb-6">
        {invoice.status === "DRAFT" && (
          <>
            <button
              onClick={() => setShowSubmit(true)}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-md"
              style={{ background: "var(--ziva-primary, #4F46E5)" }}
            >
              Submit for Approval
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete this invoice?")) return;
                await apiFetch(`/api/ar/invoices/${id}`, { token: accessToken!, method: "DELETE" });
                router.push("/dashboard/business/ar/invoices");
              }}
              className="px-4 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
            >
              Delete
            </button>
          </>
        )}
        {invoice.status === "SUBMITTED" && isCurrentApprover && (
          <>
            <button
              onClick={() => doAction("approve", {})}
              disabled={actionLoading}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={actionLoading}
              className="px-4 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {invoice.status === "APPROVED" && (
          <button
            onClick={() => setShowReceipt(true)}
            className="px-4 py-1.5 text-sm font-medium text-white rounded-md bg-purple-600 hover:bg-purple-700"
          >
            Record Receipt
          </button>
        )}
        {["DRAFT", "SUBMITTED"].includes(invoice.status) && (
          <button
            onClick={() => doAction("cancel")}
            disabled={actionLoading}
            className="px-4 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel Invoice
          </button>
        )}
      </div>

      {/* Invoice detail grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Info</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer" value={`${invoice.customer_name} (${invoice.customer_code})`} />
            <Field label="Invoice Number" value={invoice.invoice_number} />
            <Field label="Invoice Date" value={invoice.invoice_date} />
            <Field label="Due Date" value={invoice.due_date ?? "—"} />
            {invoice.service_period_start && (
              <Field label="Service Period" value={`${invoice.service_period_start} → ${invoice.service_period_end ?? "?"}`} />
            )}
            <Field label="Currency" value={`${invoice.currency} @ ${invoice.exchange_rate}`} />
            {invoice.description && <Field label="Description" value={invoice.description} />}
            {invoice.posting_mode && <Field label="Posting Mode" value={invoice.posting_mode} />}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amounts</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Gross Amount</span><span className="font-medium">{formatMoney(parseFloat(invoice.total_amount_base))}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">VAT</span><span className="font-medium text-green-700">+{formatMoney(parseFloat(invoice.total_vat))}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">WHT (customer deducts)</span><span className="font-medium text-red-600">({formatMoney(parseFloat(invoice.total_wht))})</span></div>
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <span className="font-semibold">Net Receivable</span>
              <span className="font-bold text-indigo-700">{formatMoney(parseFloat(invoice.net_receivable))}</span>
            </div>
          </div>
          {invoice.status === "RECEIVED" && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
              <p>Received: {invoice.received_at?.split("T")[0]}</p>
              {invoice.receipt_reference && <p>Ref: {invoice.receipt_reference}</p>}
            </div>
          )}
          {invoice.journal_entry_id && (
            <p className="text-xs text-gray-400 mt-2">GL Journal: {invoice.journal_entry_id.slice(0, 8)}…</p>
          )}
          {invoice.receipt_journal_entry_id && (
            <p className="text-xs text-gray-400">Receipt Journal: {invoice.receipt_journal_entry_id.slice(0, 8)}…</p>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Invoice Lines</h3>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Description</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Gross (NGN)</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">VAT</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">WHT</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Net Receivable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoice.lines.map(ln => (
              <tr key={ln.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-400">{ln.line_number}</td>
                <td className="px-4 py-2 text-gray-700">{ln.description}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(parseFloat(ln.amount_base))}</td>
                <td className="px-4 py-2 text-right tabular-nums text-green-600">{ln.vat_applicable ? `+${formatMoney(parseFloat(ln.vat_amount))}` : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-500">{ln.wht_applicable ? `(${formatMoney(parseFloat(ln.wht_amount))})` : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMoney(parseFloat(ln.net_receivable_line))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approvals */}
      {invoice.approvals.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Approval Trail</h3>
          <div className="space-y-2">
            {invoice.approvals.map(a => (
              <div key={a.id} className="flex items-center gap-4 text-sm">
                <span className="w-16 text-gray-400 text-xs">Step {a.step_order}</span>
                <span className={`font-medium ${APPROVAL_STATUS_COLOURS[a.status] ?? "text-gray-600"}`}>{a.status}</span>
                {a.is_advisory && <span className="text-xs text-gray-400">(advisory)</span>}
                {a.comment && <span className="text-gray-500 text-xs">{a.comment}</span>}
                {a.action_at && <span className="text-gray-400 text-xs ml-auto">{a.action_at.split("T")[0]}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit modal */}
      {showSubmit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-4">Submit for Approval</h3>
            <p className="text-sm text-gray-500 mb-4">
              If your organisation has a receivables approval policy, the approver will be assigned automatically.
              Otherwise, enter an approver ID manually.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Approver User ID (optional)</label>
              <input
                type="text"
                value={selectedApprover}
                onChange={e => setSelectedApprover(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Leave blank to use policy"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSubmit(false)} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md">Cancel</button>
              <button
                onClick={async () => {
                  setShowSubmit(false);
                  await doAction("submit", { selected_approver_id: selectedApprover || null });
                }}
                disabled={actionLoading}
                className="px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50"
                style={{ background: "var(--ziva-primary, #4F46E5)" }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-4">Reject Invoice</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={3}
                placeholder="Explain why this invoice is being rejected"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReject(false)} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md">Cancel</button>
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) { alert("Reason is required."); return; }
                  setShowReject(false);
                  await doAction("reject", { reason: rejectReason });
                }}
                disabled={actionLoading}
                className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-2">Record Receipt</h3>
            <p className="text-sm text-gray-500 mb-4">Net receivable: <strong>{formatMoney(parseFloat(invoice.net_receivable))}</strong></p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Receipt Date *</label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={e => setReceiptDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Reference</label>
                <input
                  type="text"
                  value={receiptRef}
                  onChange={e => setReceiptRef(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. TRF-20260728-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bank Account (received into)</label>
                <select
                  value={receiptBankId}
                  onChange={e => setReceiptBankId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">— select bank account —</option>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.name} · {b.account_number}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReceipt(false)} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md">Cancel</button>
              <button
                onClick={async () => {
                  if (!receiptDate) { alert("Receipt date is required."); return; }
                  setShowReceipt(false);
                  await doAction("receive", {
                    receipt_date: receiptDate,
                    receipt_reference: receiptRef || undefined,
                    bank_account_id: receiptBankId || undefined,
                  });
                }}
                disabled={actionLoading}
                className="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                Mark as Received
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
