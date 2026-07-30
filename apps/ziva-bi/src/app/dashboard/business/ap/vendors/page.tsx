"use client";

/**
 * AP Vendors — /dashboard/business/ap/vendors
 *
 * Lists vendor master records. Supports search, create, inline activation toggle.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string;
  code: string;
  name: string;
  vendor_type: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  is_active: boolean;
  created_at: string;
}

const VENDOR_TYPES: Record<string, string> = {
  standard:             "Standard",
  event_agency:         "Event Agency",
  clearing_agent:       "Clearing Agent",
  three_pl:             "3PL",
  professional_service: "Professional Service",
  insurance:            "Insurance",
  non_resident:         "Non-Resident",
  one_time:             "One-Time",
};

// ── Create Vendor Modal ───────────────────────────────────────────────────────

interface CreateVendorModalProps {
  onClose: () => void;
  onCreated: () => void;
  accessToken: string;
}

function CreateVendorModal({ onClose, onCreated, accessToken }: CreateVendorModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vendorType, setVendorType] = useState("standard");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Vendor name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/ap/vendors", {
        token: accessToken,
        method: "POST",
        body: {
          name: name.trim(),
          code: code.trim() || undefined,
          vendor_type: vendorType,
          tax_id: taxId || undefined,
          email: email || undefined,
          phone: phone || undefined,
          bank_name: bankName || undefined,
          bank_account_number: bankAccount || undefined,
          bank_sort_code: bankSortCode || undefined,
          address: address || undefined,
        },
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create vendor.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold">New Vendor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code (auto if blank)</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. V-0001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Type</label>
              <select value={vendorType} onChange={e => setVendorType(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {Object.entries(VENDOR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TIN / RC Number</label>
              <input type="text" value={taxId} onChange={e => setTaxId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
              <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
              <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" rows={2} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50"
              style={{ background: "var(--ziva-primary, #4F46E5)" }}
            >
              {saving ? "Saving…" : "Create Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApVendorsPage() {
  const { accessToken } = useAuth();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchVendors = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set("include_inactive", "true");
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch<Vendor[]>(`/api/ap/vendors?${params.toString()}`, { token: accessToken });
      setVendors(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, showInactive, search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const toggleActive = async (vendor: Vendor) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/ap/vendors/${vendor.id}`, {
        token: accessToken,
        method: "PATCH",
        body: { is_active: !vendor.is_active },
      });
      fetchVendors();
    } catch {
      alert("Failed to update vendor.");
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <PageHeading title="Vendors" />
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-1.5 text-sm font-medium text-white rounded-md flex items-center gap-1"
          style={{ background: "var(--ziva-primary, #4F46E5)" }}
        >
          <i className="ti ti-plus" /> New Vendor
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
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No vendors yet.{" "}
                  <button onClick={() => setShowCreate(true)} className="text-indigo-600 hover:underline">
                    Add the first vendor.
                  </button>
                </td>
              </tr>
            ) : vendors.map(v => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{v.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                    {VENDOR_TYPES[v.vendor_type] ?? v.vendor_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{v.tax_id ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{v.email ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{v.bank_name ? `${v.bank_name} · ${v.bank_account_number}` : "—"}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(v)}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${v.is_active ? "bg-indigo-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${v.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && accessToken && (
        <CreateVendorModal
          accessToken={accessToken}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchVendors(); }}
        />
      )}
    </PageContainer>
  );
}
