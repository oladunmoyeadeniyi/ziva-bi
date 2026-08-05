"use client";

/**
 * Payment Configuration page
 *
 * Finance admins configure the payment rail (MANUAL | PAYSTACK) and manage
 * employee bank accounts for reimbursement.
 *
 * Tabs:
 *   Config     — switch mode, enter Paystack keys
 *   Bank accounts — list/add/delete employee bank accounts
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentConfig {
  payment_mode: "MANUAL" | "PAYSTACK";
  has_paystack_key: boolean;
  paystack_subaccount?: string;
}

interface BankAccount {
  id: string;
  employee_id: string;
  employee_name: string;
  bank_name: string;
  bank_code?: string;
  account_number: string;
  account_name: string;
  currency: string;
  is_primary: boolean;
  is_verified: boolean;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface Bank {
  name: string;
  code: string;
}

type Tab = "config" | "bank-accounts";

export default function PaymentConfigPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [tab, setTab] = useState<Tab>("config");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paystackBanks, setPaystackBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  // Config form
  const [mode, setMode] = useState<"MANUAL" | "PAYSTACK">("MANUAL");
  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // New bank account form
  const [showBaForm, setShowBaForm] = useState(false);
  const [baForm, setBaForm] = useState({
    employee_id: "", bank_name: "", bank_code: "",
    account_number: "", account_name: "", currency: "NGN", is_primary: true,
  });
  const [savingBa, setSavingBa] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, bas, emps] = await Promise.all([
        apiFetch("/api/payments/config", { token: accessToken ?? undefined }),
        apiFetch("/api/payments/bank-accounts", { token: accessToken ?? undefined }),
        apiFetch("/api/employees?limit=500", { token: accessToken ?? undefined }),
      ]);
      setConfig(cfg as PaymentConfig);
      setMode((cfg as PaymentConfig).payment_mode);
      setBankAccounts(bas as BankAccount[]);
      setEmployees(emps as Employee[]);
    } catch {
      toast.error("Failed to load payment configuration");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Load Paystack bank list when mode is PAYSTACK
  useEffect(() => {
    if (mode === "PAYSTACK" && paystackBanks.length === 0) {
      apiFetch("/api/payments/banks", { token: accessToken ?? undefined })
        .then((d: any) => setPaystackBanks(d))
        .catch(() => {});
    }
  }, [mode, accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await apiFetch("/api/payments/config", {
        token: accessToken ?? undefined, method: "POST",
        body: {
          payment_mode: mode,
          paystack_secret_key: secretKey || undefined,
          paystack_public_key: publicKey || undefined,
        },
      });
      toast.success("Payment configuration saved");
      setSecretKey("");
      setPublicKey("");
      await fetchData();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSavingConfig(false);
    }
  };

  const saveBankAccount = async () => {
    if (!baForm.employee_id) { toast.error("Select an employee"); return; }
    if (!baForm.bank_name.trim()) { toast.error("Bank name is required"); return; }
    if (!baForm.account_number.trim()) { toast.error("Account number is required"); return; }
    if (!baForm.account_name.trim()) { toast.error("Account name is required"); return; }
    setSavingBa(true);
    try {
      await apiFetch("/api/payments/bank-accounts", {
        token: accessToken ?? undefined, method: "POST",
        body: {
          ...baForm,
          bank_code: baForm.bank_code || undefined,
        },
      });
      toast.success("Bank account saved");
      setShowBaForm(false);
      setBaForm({ employee_id: "", bank_name: "", bank_code: "", account_number: "", account_name: "", currency: "NGN", is_primary: true });
      await fetchData();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save bank account");
    } finally {
      setSavingBa(false);
    }
  };

  const deleteBankAccount = async (ba: BankAccount) => {
    const ok = await confirm({
      title: "Remove Bank Account",
      message: `Remove ${ba.bank_name} account ending ${ba.account_number.slice(-4)} for ${ba.employee_name}?`,
      danger: true,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/payments/bank-accounts/${ba.id}`, { token: accessToken ?? undefined, method: "DELETE" });
      toast.success("Bank account removed");
      await fetchData();
    } catch {
      toast.error("Failed to remove bank account");
    }
  };

  // Auto-fill bank name when code is selected from Paystack list
  const handleBankCodeChange = (code: string) => {
    const bank = paystackBanks.find(b => b.code === code);
    setBaForm(p => ({ ...p, bank_code: code, bank_name: bank?.name ?? p.bank_name }));
  };

  return (
    <PageContainer>
      <PageHeading title="Payment Configuration" />

      {/* Tabs */}
      <div className="border-b mb-6 flex gap-6">
        {(["config", "bank-accounts"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t === "config" ? "Payment mode" : `Bank accounts (${bankAccounts.length})`}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : tab === "config" ? (
        <div className="max-w-lg space-y-6">
          {/* Mode toggle */}
          <div>
            <p className="text-sm font-medium mb-3">Payment method</p>
            <div className="flex gap-3">
              {(["MANUAL", "PAYSTACK"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 border rounded-lg p-3 text-sm text-left transition-colors ${mode === m ? "border-blue-600 bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`}
                >
                  <p className="font-semibold">{m === "MANUAL" ? "Manual" : "Automated"}</p>
                  <p className="text-xs mt-1 text-gray-500">
                    {m === "MANUAL"
                      ? "Finance team marks payments as paid outside the system"
                      : "Direct bank transfers via payment gateway"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {mode === "PAYSTACK" && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <p className="text-sm font-medium text-gray-700">API Credentials</p>
              {config?.has_paystack_key && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  API keys are configured. Enter new keys below only if you want to update them.
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Secret key {!config?.has_paystack_key && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2 bg-white font-mono text-sm"
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                  placeholder={config?.has_paystack_key ? "Leave blank to keep existing" : "sk_live_…"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Public key (optional)</label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2 bg-white font-mono text-sm"
                  value={publicKey}
                  onChange={e => setPublicKey(e.target.value)}
                  placeholder={config?.has_paystack_key ? "Leave blank to keep existing" : "pk_live_…"}
                />
              </div>
              <p className="text-xs text-gray-500">
                Keys are encrypted before being stored. They are never visible after saving.
                Configure your payment gateway webhook URL in your payment gateway dashboard as:
                <code className="ml-1 bg-gray-200 px-1 rounded">{typeof window !== "undefined" ? window.location.origin : ""}/api/payments/webhook</code>
              </p>
            </div>
          )}

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {savingConfig ? "Saving…" : "Save configuration"}
          </button>
        </div>
      ) : (
        // Bank accounts tab
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Register bank accounts for employee reimbursements.</p>
            <button onClick={() => setShowBaForm(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              Add bank account
            </button>
          </div>

          {showBaForm && (
            <div className="border rounded-lg p-4 bg-gray-50 mb-6">
              <h3 className="font-semibold mb-3">New Bank Account</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Employee *</label>
                  <select className="w-full border rounded px-3 py-2 bg-white" value={baForm.employee_id} onChange={e => setBaForm(p => ({ ...p, employee_id: e.target.value }))}>
                    <option value="">— select —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Currency</label>
                  <input className="w-full border rounded px-3 py-2 bg-white" value={baForm.currency} onChange={e => setBaForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} maxLength={3} />
                </div>
                {paystackBanks.length > 0 ? (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Bank *</label>
                    <select className="w-full border rounded px-3 py-2 bg-white" value={baForm.bank_code} onChange={e => handleBankCodeChange(e.target.value)}>
                      <option value="">— select bank —</option>
                      {paystackBanks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Bank name *</label>
                    <input className="w-full border rounded px-3 py-2 bg-white" value={baForm.bank_name} onChange={e => setBaForm(p => ({ ...p, bank_name: e.target.value }))} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Account number *</label>
                  <input className="w-full border rounded px-3 py-2 bg-white" value={baForm.account_number} onChange={e => setBaForm(p => ({ ...p, account_number: e.target.value }))} maxLength={10} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Account name *</label>
                  <input className="w-full border rounded px-3 py-2 bg-white" value={baForm.account_name} onChange={e => setBaForm(p => ({ ...p, account_name: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={baForm.is_primary} onChange={e => setBaForm(p => ({ ...p, is_primary: e.target.checked }))} />
                    Set as primary account for this employee
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={saveBankAccount} disabled={savingBa} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {savingBa ? "Saving…" : "Save account"}
                </button>
                <button onClick={() => setShowBaForm(false)} className="px-4 py-2 border rounded hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </div>
          )}

          {bankAccounts.length === 0 ? (
            <EmptyState
              icon="building-bank"
              title="No bank accounts registered"
              description="Add employee bank accounts to enable payment tracking and transfers."
              action={{ label: "Add bank account", onClick: () => setShowBaForm(true) }}
            />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-2">Employee</th>
                    <th className="text-left px-4 py-2">Bank</th>
                    <th className="text-left px-4 py-2">Account number</th>
                    <th className="text-left px-4 py-2">Account name</th>
                    <th className="text-left px-4 py-2">Primary</th>
                    <th className="text-right px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map(ba => (
                    <tr key={ba.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">{ba.employee_name}</td>
                      <td className="px-4 py-3">{ba.bank_name}</td>
                      <td className="px-4 py-3 font-mono">{ba.account_number}</td>
                      <td className="px-4 py-3">{ba.account_name}</td>
                      <td className="px-4 py-3">
                        {ba.is_primary && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">Primary</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteBankAccount(ba)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
