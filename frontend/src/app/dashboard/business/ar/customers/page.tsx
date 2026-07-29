"use client";

/**
 * AR Customers — /dashboard/business/ar/customers
 *
 * Lists customer master records. Supports search, create modal,
 * inline active/inactive toggle, outstanding balance display.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  code: string;
  name: string;
  customer_type: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  outstanding_balance: string;
  credit_limit: string | null;
}

const CUSTOMER_TYPES: Record<string, string> = {
  standard:    "Standard",
  government:  "Government",
  ngo:         "NGO",
  corporate:   "Corporate",
  individual:  "Individual",
  non_resident: "Non-Resident",
};

const CREDIT_TERMS_LABELS: Record<string, string> = {
  immediate: "Immediate",
  net_30:    "Net 30",
  net_60:    "Net 60",
  net_90:    "Net 90",
  custom:    "Custom",
};

// ── Create Customer Modal ─────────────────────────────────────────────────────

interface CreateCustomerModalProps {
  onClose: () => void;
  onCreated: () => void;
  accessToken: string;
}

function CreateCustomerModal({ onClose, onCreated, accessToken }: CreateCustomerModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [customerType, setCustomerType] = useState("standard");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [creditTerms, setCreditTerms] = useState("");
  const [creditTermsDays, setCreditTermsDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Customer name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/ar/customers", {
        token: accessToken,
        method: "POST",
        body: {
          name: name.trim(),
          code: code.trim() || undefined,
          customer_type: customerType,
          tax_id: taxId || undefined,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          credit_limit: creditLimit ? parseFloat(creditLimit) : undefined,
          credit_terms: creditTerms || undefined,
          credit_terms_days: creditTermsDays ? parseInt(creditTermsDays) : undefined,
        },
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create customer.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold">New Customer</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code (auto if blank)</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. C-0001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer Type</label>
              <select
                value={customerType}
                onChange={e => setCustomerType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {Object.entries(CUSTOMER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TIN / RC Number</label>
              <input
                type="text"
                value={taxId}
                onChange={e => setTaxId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Credit Limit</label>
              <input
                type="number"
                value={creditLimit}
                onChange={e => setCreditLimit(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="No limit if blank"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Credit Terms</label>
              <select
                value={creditTerms}
                onChange={e => setCreditTerms(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">— none —</option>
                {Object.entries(CREDIT_TERMS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {creditTerms === "custom" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
                <input
                  type="number"
                  value={creditTermsDays}
                  onChange={e => setCreditTermsDays(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  min="1"
                />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50"
              style={{ background: "var(--ziva-primary, #4F46E5)" }}
            >
              {saving ? "Saving…" : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ArCustomersPage() {
  const { accessToken } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCustomers = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set("include_inactive", "true");
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch<Customer[]>(`/api/ar/customers?${params.toString()}`, { token: accessToken });
      setCustomers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, showInactive, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const toggleActive = async (customer: Customer) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/ar/customers/${customer.id}`, {
        token: accessToken,
        method: "PATCH",
        body: { is_active: !customer.is_active },
      });
      fetchCustomers();
    } catch {
      alert("Failed to update customer.");
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <PageHeading title="Customers" />
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-1.5 text-sm font-medium text-white rounded-md flex items-center gap-1"
          style={{ background: "var(--ziva-primary, #4F46E5)" }}
        >
          <i className="ti ti-plus" /> New Customer
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-indigo-400"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Include inactive
        </label>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">TIN</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Outstanding</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No customers yet.{" "}
                  <button onClick={() => setShowCreate(true)} className="text-indigo-600 hover:underline">
                    Add the first customer.
                  </button>
                </td>
              </tr>
            ) : customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded">
                    {CUSTOMER_TYPES[c.customer_type] ?? c.customer_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.tax_id ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-sm">
                  {formatMoney(parseFloat(c.outstanding_balance) || 0)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${c.is_active ? "bg-indigo-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${c.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && accessToken && (
        <CreateCustomerModal
          accessToken={accessToken}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchCustomers(); }}
        />
      )}
    </PageContainer>
  );
}
