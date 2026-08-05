"use client";

/**
 * Expense Payment Queue
 *
 * Finance managers use this page to:
 *   1. See all approved expense reports awaiting payment (Queue tab)
 *   2. Initiate payment (MANUAL: mark as paid; PAYSTACK: auto-transfer)
 *   3. Cancel queued payments
 *   4. View payment history (History tab)
 *
 * Payment mode (MANUAL / PAYSTACK) comes from /api/payments/config.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatMoney } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueableReport {
  id: string;
  report_number: string;
  report_date: string;
  total_amount: number;
  currency: string;
  employee_name?: string;
  employee_id: string;
  bank_account_id?: string;
  bank_name?: string;
  account_number?: string;
}

interface Payment {
  id: string;
  expense_report_id: string;
  employee_name?: string;
  amount: number;
  currency: string;
  status: "QUEUED" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";
  bank_name?: string;
  account_number?: string;
  payment_date?: string;
  payment_reference?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

interface PaymentConfig {
  payment_mode: "MANUAL" | "PAYSTACK";
  has_paystack_key: boolean;
}

type Tab = "queue" | "history";

const STATUS_COLORS: Record<string, string> = {
  QUEUED:     "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  PAID:       "bg-green-100 text-green-700",
  FAILED:     "bg-red-100 text-red-700",
  CANCELLED:  "bg-gray-100 text-gray-500",
};

// ─── AddToQueueModal ─────────────────────────────────────────────────────────

function AddToQueueModal({
  onClose,
  onDone,
  token,
}: {
  onClose: () => void;
  onDone: () => void;
  token: string | undefined;
}) {
  const { toast } = useToast();
  const [reports, setReports] = useState<QueueableReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/payments/queueable", { token })
      .then((d: any) => setReports(d))
      .catch(() => toast.error("Failed to load approved reports"))
      .finally(() => setLoading(false));
  }, []);

  const addToQueue = async (r: QueueableReport) => {
    setSubmitting(r.id);
    try {
      await apiFetch("/api/payments/queue", {
        token, method: "POST",
        body: {
          expense_report_id: r.id,
          employee_id: r.employee_id,
          bank_account_id: r.bank_account_id ?? null,
          amount: r.total_amount,
          currency: r.currency,
        },
      });
      toast.success(`${r.report_number} added to queue`);
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to queue report");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Add approved report to queue</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 py-4">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No approved reports are awaiting payment.</p>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Report</th>
                  <th className="text-left px-3 py-2">Employee</th>
                  <th className="text-left px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Bank account</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-medium">{r.report_number}</p>
                      <p className="text-xs text-gray-400">{r.report_date}</p>
                    </td>
                    <td className="px-3 py-2">{r.employee_name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{r.currency} {formatMoney(r.total_amount)}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.bank_name ? (
                        <><p>{r.bank_name}</p><p className="text-xs">{r.account_number}</p></>
                      ) : (
                        <span className="text-amber-600 text-xs">No bank account</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => addToQueue(r)}
                        disabled={submitting === r.id}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submitting === r.id ? "Adding…" : "Add"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── ManualPaymentModal ───────────────────────────────────────────────────────

function ManualPaymentModal({
  payment,
  onClose,
  onDone,
}: {
  payment: Payment;
  onClose: () => void;
  onDone: () => void;
}) {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    payment_reference: "",
    payment_notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/api/payments/${payment.id}/initiate`, {
        token: accessToken ?? undefined, method: "POST", body: form,
      });
      toast.success("Payment marked as paid");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="font-semibold text-lg mb-4">Record Manual Payment</h3>
        <p className="text-sm text-gray-600 mb-4">
          Amount: <span className="font-bold">{payment.currency} {formatMoney(payment.amount)}</span>
          {payment.employee_name && <> · {payment.employee_name}</>}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Payment date *</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reference (cheque no., transfer ref, etc.)</label>
            <input className="w-full border rounded px-3 py-2" value={form.payment_reference} onChange={e => setForm(p => ({ ...p, payment_reference: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.payment_notes} onChange={e => setForm(p => ({ ...p, payment_notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm">
            {submitting ? "Saving…" : "Mark as paid"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PaymentQueuePage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [tab, setTab] = useState<Tab>("queue");
  const [queue, setQueue] = useState<Payment[]>([]);
  const [history, setHistory] = useState<Payment[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualTarget, setManualTarget] = useState<Payment | null>(null);
  const [showAddToQueue, setShowAddToQueue] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [q, h, cfg] = await Promise.all([
        apiFetch("/api/payments/queue", { token: accessToken ?? undefined }),
        apiFetch("/api/payments/history", { token: accessToken ?? undefined }),
        apiFetch("/api/payments/config", { token: accessToken ?? undefined }),
      ]);
      setQueue(q as Payment[]);
      setHistory(h as Payment[]);
      setConfig(cfg as PaymentConfig);
    } catch {
      toast.error("Failed to load payment data");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const initiatePaystack = async (p: Payment) => {
    const ok = await confirm({
      title: "Initiate Transfer",
      message: `Send ${p.currency} ${formatMoney(p.amount)} to ${p.employee_name ?? "employee"}?`,
      confirmLabel: "Initiate transfer",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/payments/${p.id}/initiate`, {
        token: accessToken ?? undefined, method: "POST",
        body: { payment_date: new Date().toISOString().slice(0, 10) },
      });
      toast.success("Transfer initiated — awaiting bank confirmation");
      await fetchAll();
    } catch (e: any) {
      toast.error(e.message ?? "Transfer failed. Please try again.");
    }
  };

  const cancelPayment = async (p: Payment) => {
    const ok = await confirm({
      title: "Cancel Payment",
      message: `Cancel the payment for ${p.employee_name ?? "this employee"}?`,
      confirmLabel: "Cancel payment",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/payments/${p.id}/cancel`, { token: accessToken ?? undefined, method: "POST" });
      toast.success("Payment cancelled");
      await fetchAll();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to cancel");
    }
  };

  const isPaystack = config?.payment_mode === "PAYSTACK";

  return (
    <PageContainer>
      <PageHeading
        title="Payment Queue"
        subtitle={`Mode: ${config?.payment_mode ?? "…"}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddToQueue(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              + Add to queue
            </button>
            <a href="/dashboard/business/settings/payment-config" className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">
              Payment settings
            </a>
          </div>
        }
      />

      {/* Tabs */}
      <div className="border-b mb-6 flex gap-6">
        {(["queue", "history"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t === "queue" ? `Queue (${queue.length})` : "History"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : tab === "queue" ? (
        queue.length === 0 ? (
          <EmptyState icon="wallet" title="Payment queue is empty" description="Approved expense reports will appear here when added to the queue." />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2">Employee</th>
                  <th className="text-left px-4 py-2">Amount</th>
                  <th className="text-left px-4 py-2">Bank account</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Queued</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p>{p.employee_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{p.expense_report_id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{p.currency} {formatMoney(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.bank_name ? <><p>{p.bank_name}</p><p className="text-xs">{p.account_number}</p></> : <span className="text-red-500 text-xs">No bank account</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "QUEUED" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => isPaystack ? initiatePaystack(p) : setManualTarget(p)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            {isPaystack ? "Transfer" : "Mark paid"}
                          </button>
                          <button onClick={() => cancelPayment(p)} className="px-3 py-1 border rounded text-xs hover:bg-gray-50 text-red-600">
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        history.length === 0 ? (
          <EmptyState icon="history" title="No payment history yet" description="Completed and cancelled payments will appear here." />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2">Employee</th>
                  <th className="text-left px-4 py-2">Amount</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Payment date</th>
                  <th className="text-left px-4 py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{p.employee_name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{p.currency} {formatMoney(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                      {p.failure_reason && <p className="text-xs text-red-500 mt-0.5">{p.failure_reason}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.payment_date ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{p.payment_reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {showAddToQueue && (
        <AddToQueueModal
          token={accessToken ?? undefined}
          onClose={() => setShowAddToQueue(false)}
          onDone={async () => { setShowAddToQueue(false); await fetchAll(); }}
        />
      )}

      {manualTarget && (
        <ManualPaymentModal
          payment={manualTarget}
          onClose={() => setManualTarget(null)}
          onDone={async () => { setManualTarget(null); await fetchAll(); }}
        />
      )}
    </PageContainer>
  );
}
