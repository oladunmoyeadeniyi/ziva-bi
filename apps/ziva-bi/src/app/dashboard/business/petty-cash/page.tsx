"use client";

/**
 * Petty Cash Funds page
 *
 * Lists all petty cash funds and lets finance managers:
 *   - Create a new fund
 *   - Click into a fund to view transactions + take actions (disburse / retire / replenish / adjust)
 *
 * State: fund list view vs selected-fund detail view (no separate route, SPA-style).
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/contexts/ToastContext";
import { formatMoney } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Fund {
  id: string;
  name: string;
  description?: string;
  custodian_name?: string;
  currency_code: string;
  float_amount: number;
  current_balance: number;
  is_active: boolean;
  gl_account_name?: string;
}

interface Transaction {
  id: string;
  transaction_type: "DISBURSEMENT" | "RETIREMENT" | "REPLENISHMENT" | "ADJUSTMENT";
  employee_name?: string;
  amount: number;
  description: string;
  reference?: string;
  transaction_date: string;
  balance_after: number;
  notes?: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface CoaAccount {
  id: string;
  account_code: string;
  account_name: string;
}

type ActionKind = "disburse" | "retire" | "replenish" | "adjust";
type ShowAction = ActionKind | "new_fund";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TXN_COLORS: Record<string, string> = {
  DISBURSEMENT:  "bg-red-100 text-red-700",
  RETIREMENT:    "bg-blue-100 text-blue-700",
  REPLENISHMENT: "bg-green-100 text-green-700",
  ADJUSTMENT:    "bg-yellow-100 text-yellow-700",
};

const TXN_SIGN: Record<string, string> = {
  DISBURSEMENT:  "−",
  RETIREMENT:    "=",
  REPLENISHMENT: "+",
  ADJUSTMENT:    "±",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PettyCashPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<CoaAccount[]>([]);
  const [showAction, setShowAction] = useState<ShowAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New fund form
  const [newFund, setNewFund] = useState({
    name: "", description: "", currency_code: "NGN",
    float_amount: "", opening_balance: "",
    gl_account_id: "", expense_gl_account_id: "", custodian_id: "",
  });

  // Action form
  const [actionForm, setActionForm] = useState({
    employee_id: "", amount: "", description: "",
    reference: "", transaction_date: today(),
    expense_report_id: "", notes: "",
  });

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/petty-cash/funds", { token: accessToken ?? undefined });
      setFunds(data as Fund[]);
    } catch {
      toast.error("Failed to load petty cash funds");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchTransactions = useCallback(async (fundId: string) => {
    setTxnLoading(true);
    try {
      const data = await apiFetch(`/api/petty-cash/funds/${fundId}/transactions`, { token: accessToken ?? undefined });
      setTransactions(data as Transaction[]);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setTxnLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchFunds();
    apiFetch("/api/employees?limit=500", { token: accessToken ?? undefined }).then((d: any) => setEmployees(d)).catch(() => {});
    apiFetch("/api/config/coa?limit=500", { token: accessToken ?? undefined }).then((d: any) => setCoaAccounts(d.accounts ?? d)).catch(() => {});
  }, [fetchFunds, accessToken]);

  const openFund = (fund: Fund) => {
    setSelectedFund(fund);
    fetchTransactions(fund.id);
    setShowAction(null);
  };

  // ─── Submit handlers ───────────────────────────────────────────────────────

  const submitNewFund = async () => {
    if (!newFund.name.trim()) { toast.error("Fund name is required"); return; }
    setSubmitting(true);
    try {
      await apiFetch("/api/petty-cash/funds", {
        token: accessToken ?? undefined, method: "POST",
        body: {
          name: newFund.name,
          description: newFund.description || undefined,
          currency_code: newFund.currency_code,
          float_amount: parseFloat(newFund.float_amount) || 0,
          opening_balance: parseFloat(newFund.opening_balance) || 0,
          gl_account_id: newFund.gl_account_id || undefined,
          expense_gl_account_id: newFund.expense_gl_account_id || undefined,
          custodian_id: newFund.custodian_id || undefined,
        },
      });
      toast.success("Fund created");
      setShowAction(null);
      setNewFund({ name: "", description: "", currency_code: "NGN", float_amount: "", opening_balance: "", gl_account_id: "", expense_gl_account_id: "", custodian_id: "" });
      await fetchFunds();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create fund");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAction = async (kind: ActionKind) => {
    if (!selectedFund) return;
    if (!actionForm.amount || parseFloat(actionForm.amount) <= 0) { toast.error("Enter a positive amount"); return; }
    if (!actionForm.description.trim()) { toast.error("Description is required"); return; }
    setSubmitting(true);
    const endpointMap: Record<string, string> = {
      disburse: "disburse", retire: "retire",
      replenish: "replenish", adjust: "adjust",
    };
    const endpoint = endpointMap[kind];
    const body: Record<string, any> = {
      amount: parseFloat(actionForm.amount),
      description: actionForm.description,
      transaction_date: actionForm.transaction_date,
      reference: actionForm.reference || undefined,
      notes: actionForm.notes || undefined,
    };
    if (kind === "disburse" || kind === "retire") {
      body.employee_id = actionForm.employee_id || undefined;
    }
    if (kind === "retire") {
      body.expense_report_id = actionForm.expense_report_id || undefined;
    }
    if (kind === "adjust") {
      // amount can be negative for downward adjustment
      body.amount = parseFloat(actionForm.amount);
    }
    try {
      await apiFetch(`/api/petty-cash/funds/${selectedFund.id}/${endpoint}`, {
        token: accessToken ?? undefined, method: "POST", body,
      });
      toast.success("Transaction recorded");
      setShowAction(null);
      setActionForm({ employee_id: "", amount: "", description: "", reference: "", transaction_date: today(), expense_report_id: "", notes: "" });
      // Refresh both fund balance and transaction list
      const refreshed = await apiFetch(`/api/petty-cash/funds/${selectedFund.id}`, { token: accessToken ?? undefined });
      setSelectedFund(refreshed as Fund);
      await fetchFunds();
      await fetchTransactions(selectedFund.id);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to record transaction");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── New Fund Form ─────────────────────────────────────────────────────────

  if (showAction === "new_fund") {
    return (
      <PageContainer>
        <div className="mb-4">
          <button onClick={() => setShowAction(null)} className="text-sm text-blue-600 hover:underline">← Back to funds</button>
        </div>
        <PageHeading title="New Petty Cash Fund" />
        <div className="max-w-xl space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fund name *</label>
            <input className="w-full border rounded px-3 py-2" value={newFund.name} onChange={e => setNewFund(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Head Office Petty Cash" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={newFund.description} onChange={e => setNewFund(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <input className="w-full border rounded px-3 py-2" value={newFund.currency_code} onChange={e => setNewFund(p => ({ ...p, currency_code: e.target.value.toUpperCase() }))} maxLength={3} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Authorised float</label>
              <input type="number" className="w-full border rounded px-3 py-2" value={newFund.float_amount} onChange={e => setNewFund(p => ({ ...p, float_amount: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Opening balance</label>
            <input type="number" className="w-full border rounded px-3 py-2" value={newFund.opening_balance} onChange={e => setNewFund(p => ({ ...p, opening_balance: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Custodian (employee)</label>
            <select className="w-full border rounded px-3 py-2" value={newFund.custodian_id} onChange={e => setNewFund(p => ({ ...p, custodian_id: e.target.value }))}>
              <option value="">— none —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cash GL account</label>
            <select className="w-full border rounded px-3 py-2" value={newFund.gl_account_id} onChange={e => setNewFund(p => ({ ...p, gl_account_id: e.target.value }))}>
              <option value="">— select —</option>
              {coaAccounts.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default expense GL account</label>
            <select className="w-full border rounded px-3 py-2" value={newFund.expense_gl_account_id} onChange={e => setNewFund(p => ({ ...p, expense_gl_account_id: e.target.value }))}>
              <option value="">— select —</option>
              {coaAccounts.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={submitNewFund} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Creating…" : "Create fund"}
            </button>
            <button onClick={() => setShowAction(null)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // ─── Fund Detail ───────────────────────────────────────────────────────────

  if (selectedFund) {
    const balancePct = selectedFund.float_amount > 0
      ? Math.min(100, (selectedFund.current_balance / selectedFund.float_amount) * 100)
      : 100;
    const balanceLow = selectedFund.current_balance < selectedFund.float_amount * 0.2;

    return (
      <PageContainer>
        <div className="mb-4">
          <button onClick={() => setSelectedFund(null)} className="text-sm text-blue-600 hover:underline">← All funds</button>
        </div>
        <PageHeading title={selectedFund.name} subtitle={selectedFund.description ?? undefined} />

        {/* Balance card */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Current balance</p>
            <p className={`text-2xl font-bold ${balanceLow ? "text-red-600" : "text-green-600"}`}>
              {selectedFund.currency_code} {formatMoney(selectedFund.current_balance)}
            </p>
            {selectedFund.float_amount > 0 && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${balanceLow ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${balancePct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{balancePct.toFixed(0)}% of authorised float</p>
              </div>
            )}
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Authorised float</p>
            <p className="text-2xl font-bold">{selectedFund.currency_code} {formatMoney(selectedFund.float_amount)}</p>
            {selectedFund.custodian_name && <p className="text-xs text-gray-500 mt-1">Custodian: {selectedFund.custodian_name}</p>}
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${selectedFund.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {selectedFund.is_active ? "Active" : "Inactive"}
            </span>
            {selectedFund.gl_account_name && <p className="text-xs text-gray-500 mt-1">GL: {selectedFund.gl_account_name}</p>}
          </div>
        </div>

        {/* Action buttons */}
        {selectedFund.is_active && !showAction && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setShowAction("disburse")} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">Disburse cash</button>
            <button onClick={() => setShowAction("retire")} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Record retirement</button>
            <button onClick={() => setShowAction("replenish")} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">Replenish fund</button>
            <button onClick={() => setShowAction("adjust")} className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50">Manual adjustment</button>
          </div>
        )}

        {/* Action inline form — showAction is ActionKind here (early return handles "new_fund") */}
        {showAction && (
          <div className="border rounded-lg p-4 mb-6 bg-gray-50">
            <h3 className="font-semibold mb-3 capitalize">{showAction === "disburse" ? "Disburse Cash" : showAction === "retire" ? "Record Retirement" : showAction === "replenish" ? "Replenish Fund" : "Manual Adjustment"}</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount ({selectedFund.currency_code}) *
                  {showAction === "adjust" && <span className="text-gray-400 font-normal"> (negative to reduce)</span>}
                </label>
                <input type="number" className="w-full border rounded px-3 py-2 bg-white" value={actionForm.amount} onChange={e => setActionForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input type="date" className="w-full border rounded px-3 py-2 bg-white" value={actionForm.transaction_date} onChange={e => setActionForm(p => ({ ...p, transaction_date: e.target.value }))} />
              </div>
            </div>
            {(showAction === "disburse" || showAction === "retire") && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Employee</label>
                <select className="w-full border rounded px-3 py-2 bg-white" value={actionForm.employee_id} onChange={e => setActionForm(p => ({ ...p, employee_id: e.target.value }))}>
                  <option value="">— none —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
            )}
            {showAction === "retire" && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Expense report ID (optional)</label>
                <input className="w-full border rounded px-3 py-2 bg-white" value={actionForm.expense_report_id} onChange={e => setActionForm(p => ({ ...p, expense_report_id: e.target.value }))} placeholder="Link to expense report" />
              </div>
            )}
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Description *</label>
              <input className="w-full border rounded px-3 py-2 bg-white" value={actionForm.description} onChange={e => setActionForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">Reference</label>
                <input className="w-full border rounded px-3 py-2 bg-white" value={actionForm.reference} onChange={e => setActionForm(p => ({ ...p, reference: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input className="w-full border rounded px-3 py-2 bg-white" value={actionForm.notes} onChange={e => setActionForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => submitAction(showAction as ActionKind)} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
                {submitting ? "Saving…" : "Confirm"}
              </button>
              <button onClick={() => setShowAction(null)} className="px-4 py-2 border rounded hover:bg-gray-50 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Transaction history */}
        <h3 className="font-semibold mb-3">Transaction history</h3>
        {txnLoading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : transactions.length === 0 ? (
          <EmptyState icon="cash" title="No transactions yet" description="Disburse, replenish, or adjust this fund to record the first transaction." />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Description</th>
                  <th className="text-left px-4 py-2">Employee</th>
                  <th className="text-right px-4 py-2">Amount</th>
                  <th className="text-right px-4 py-2">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => (
                  <tr key={txn.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{txn.transaction_date}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TXN_COLORS[txn.transaction_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {TXN_SIGN[txn.transaction_type]} {txn.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <p>{txn.description}</p>
                      {txn.reference && <p className="text-xs text-gray-400">{txn.reference}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{txn.employee_name ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatMoney(txn.amount)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">{formatMoney(txn.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    );
  }

  // ─── Fund List ─────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <PageHeading
        title="Petty Cash"
        actions={
          <button onClick={() => setShowAction("new_fund")} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            New fund
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-4 animate-pulse h-32 bg-gray-100" />
          ))}
        </div>
      ) : funds.length === 0 ? (
        <EmptyState
          icon="cash"
          title="No petty cash funds"
          description="Create a fund to start tracking petty cash disbursements and replenishments."
          action={{ label: "New fund", onClick: () => setShowAction("new_fund") }}
        />
      ) : (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {funds.map(fund => {
            const pct = fund.float_amount > 0 ? Math.min(100, (fund.current_balance / fund.float_amount) * 100) : 100;
            const low = fund.current_balance < fund.float_amount * 0.2;
            return (
              <button
                key={fund.id}
                onClick={() => openFund(fund)}
                className="border rounded-lg p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-sm">{fund.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${fund.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {fund.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                {fund.custodian_name && <p className="text-xs text-gray-500 mb-2">{fund.custodian_name}</p>}
                <p className={`text-xl font-bold ${low ? "text-red-600" : "text-gray-900"}`}>
                  {fund.currency_code} {formatMoney(fund.current_balance)}
                </p>
                {fund.float_amount > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(0)}% of {formatMoney(fund.float_amount)} float</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
