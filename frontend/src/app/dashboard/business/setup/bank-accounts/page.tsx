"use client";

/**
 * Bank Accounts register — /dashboard/business/setup/bank-accounts
 *
 * Lists accounts grouped by currency. Add/Edit inline form with searchable
 * GL picker (BS/SOFP-filtered, same combobox pattern as account-mapping).
 * Default badge per currency. Active toggle. Admin-gated via layout.
 *
 * Currency list: GET /api/setup/currencies → enabled_currencies (single source
 *   of truth; all codes come from tenant_org_config.enabled_currencies).
 * GL list: GET /api/config/coa?active_only=true, filtered to BS/SOFP.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { getCurrencyLabel } from "@/lib/currencies";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  gl_account_id: string;
  gl_number: string;
  gl_name: string;
  gl_account_type: string;
  is_default: boolean;
  is_active: boolean;
}

interface GLAccount {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  is_active: boolean;
}

interface CurrenciesResponse {
  /** Sorted ISO code list — single source of truth from tenant_org_config. */
  enabled_currencies: string[] | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BS_TYPES = new Set(["BS", "SOFP"]);

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const emptyForm = {
  bank_name: "",
  account_name: "",
  account_number: "",
  currency: "",
  gl_account_id: "",
  is_default: false,
};

// ── GL Picker (BS-filtered) ───────────────────────────────────────────────────
// Same pattern as account-mapping; no overflow-hidden on container; z-[200] on dropdown.

function GLPicker({
  accounts,
  value,
  onChange,
  disabled,
}: {
  accounts: GLAccount[];
  value: string;       // selected gl id
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery]   = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find selected account for display
  const selected = accounts.find(a => a.id === value);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isOpen]);

  const typeFiltered = showAll ? accounts : accounts.filter(a => BS_TYPES.has(a.account_type));
  const filtered = typeFiltered
    .filter(a => {
      if (!query) return true;
      const q = query.toLowerCase();
      return a.gl_number.toLowerCase().includes(q) || a.gl_name.toLowerCase().includes(q);
    })
    .slice(0, 50);

  const displayVal = isOpen
    ? query
    : selected ? `${selected.gl_number} — ${selected.gl_name}` : "";

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={displayVal}
        placeholder="Search Balance Sheet accounts…"
        disabled={disabled}
        className={inputCls + (disabled ? " opacity-50 cursor-not-allowed" : "")}
        onFocus={() => { setIsOpen(true); setQuery(""); }}
        onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
      />
      {isOpen && (
        <div className="absolute z-[200] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100 rounded-t-lg">
            <span className="text-[10px] text-gray-400">
              {showAll ? "Showing all accounts" : "Filtered to Balance Sheet / SOFP"}
            </span>
            <button type="button" onMouseDown={e => { e.preventDefault(); setShowAll(v => !v); }}
              className="text-[10px] text-blue-500 hover:text-blue-700">
              {showAll ? "Filter BS only" : "Show all"}
            </button>
          </div>
          {filtered.length === 0
            ? <p className="px-3 py-2 text-xs text-gray-400 italic">No accounts match.</p>
            : <ul className="max-h-44 overflow-y-auto divide-y divide-gray-50">
                {filtered.map(a => (
                  <li key={a.id}>
                    <button type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                      onMouseDown={e => { e.preventDefault(); onChange(a.id); setIsOpen(false); setQuery(""); }}>
                      <span className="truncate">
                        <span className="font-mono font-medium text-gray-800">{a.gl_number}</span>
                        <span className="text-gray-500"> — {a.gl_name}</span>
                      </span>
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                        {a.account_type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
          }
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BankAccountsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  // Each entry is an ISO code; labels are rendered via getCurrencyLabel().
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState({ ...emptyForm });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  // Per-row UI
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setPageError(null);
    try {
      const [accts, coa, currRes] = await Promise.all([
        apiFetch<BankAccount[]>("/api/setup/bank-accounts", { token: accessToken }),
        apiFetch<GLAccount[]>("/api/config/coa?active_only=true&limit=10000", { token: accessToken }),
        // Single canonical source for the enabled currency list.
        apiFetch<CurrenciesResponse>("/api/setup/currencies", { token: accessToken }),
      ]);
      setAccounts(accts);
      setGlAccounts(coa.filter(a => a.is_active));
      setCurrencies(currRes.enabled_currencies ?? []);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, currency: currencies[0] ?? "" });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (a: BankAccount) => {
    setEditId(a.id);
    setForm({
      bank_name: a.bank_name,
      account_name: a.account_name,
      account_number: a.account_number,
      currency: a.currency,
      gl_account_id: a.gl_account_id,
      is_default: a.is_default,
    });
    setFormError(null);
    setShowForm(true);
  };

  const saveForm = async () => {
    if (!accessToken) return;
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim() || !form.currency || !form.gl_account_id) {
      setFormError("All fields are required."); return;
    }
    setFormSaving(true); setFormError(null);
    try {
      const body = {
        bank_name: form.bank_name.trim(),
        account_name: form.account_name.trim(),
        account_number: form.account_number.trim(),
        currency: form.currency,
        gl_account_id: form.gl_account_id,
        is_default: form.is_default,
      };
      if (editId) {
        await apiFetch(`/api/setup/bank-accounts/${editId}`, { method: "PUT", token: accessToken, body });
      } else {
        await apiFetch("/api/setup/bank-accounts", { method: "POST", token: accessToken, body });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setFormSaving(false);
    }
  };

  const toggleActive = async (a: BankAccount) => {
    if (!accessToken) return;
    setTogglingId(a.id);
    try {
      await apiFetch(`/api/setup/bank-accounts/${a.id}`, {
        method: "PUT", token: accessToken, body: { is_active: !a.is_active },
      });
      await load();
    } catch {
      /* silently fail */
    } finally { setTogglingId(null); }
  };

  const deleteAccount = async (a: BankAccount) => {
    if (!accessToken) return;
    if (!window.confirm(`Delete "${a.account_name}"? This cannot be undone if the account has no journal line references.`)) return;
    setDeletingId(a.id);
    try {
      await apiFetch(`/api/setup/bank-accounts/${a.id}`, { method: "DELETE", token: accessToken });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    } finally { setDeletingId(null); }
  };

  // Group by currency
  const byCurrency: Record<string, BankAccount[]> = {};
  for (const a of accounts) {
    if (!byCurrency[a.currency]) byCurrency[a.currency] = [];
    byCurrency[a.currency].push(a);
  }
  const sortedCurrencies = Object.keys(byCurrency).sort();

  return (
    <PageContainer maxWidth="4xl">
      {/* Back */}
      <button type="button" onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <PageHeading title="Bank accounts" />
          <p className="text-sm text-gray-500">
            Register your bank and cash accounts. Each links to a GL account for posting.
            Multiple accounts may share a GL (e.g. all NGN accounts post to one bank GL).
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          + Add account
        </Button>
      </div>

      {pageError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{pageError}</div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="mb-6 border border-blue-200 rounded-xl bg-blue-50/30 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">{editId ? "Edit bank account" : "Add bank account"}</h2>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bank name</label>
              <input type="text" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                className={inputCls} placeholder="e.g. Zenith Bank" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account name</label>
              <input type="text" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                className={inputCls} placeholder="e.g. Zenith — Operations NGN" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account number</label>
              <input type="text" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                className={inputCls} placeholder="0123456789" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className={inputCls}
              >
                <option value="">— select currency —</option>
                {currencies.map(c => (
                  <option key={c} value={c}>{getCurrencyLabel(c)}</option>
                ))}
                {/* Allow entering an unlisted currency if the dropdown is empty */}
                {currencies.length === 0 && (
                  <option value="" disabled>No currencies configured — set up Currencies &amp; FX first</option>
                )}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                GL account <span className="text-gray-400 font-normal">(Balance Sheet / SOFP only)</span>
              </label>
              <GLPicker
                accounts={glAccounts}
                value={form.gl_account_id}
                onChange={id => setForm(f => ({ ...f, gl_account_id: id }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_default" checked={form.is_default}
                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                className="w-4 h-4 accent-blue-600" />
              <label htmlFor="is_default" className="text-sm text-gray-700">
                Default account for this currency
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" onClick={saveForm} disabled={formSaving} loading={formSaving}>
              {formSaving ? "Saving…" : editId ? "Update account" : "Create account"}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <i className="ti ti-building-bank text-gray-300" style={{ fontSize: 32 }} />
          <p className="mt-3 text-sm text-gray-500">No bank accounts yet. Click "Add account" to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedCurrencies.map(currency => {
            const accts = byCurrency[currency].sort((a, b) => a.bank_name.localeCompare(b.bank_name));
            return (
              <section key={currency} className="border border-gray-200 rounded-xl bg-white">
                {/* Currency header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 rounded-t-xl border-b border-gray-100">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{currency}</h2>
                  <span className="text-[10px] text-gray-400">{accts.length} account{accts.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Accounts */}
                <div className="divide-y divide-gray-50">
                  {accts.map(a => (
                    <div key={a.id} className={`px-5 py-3.5 flex items-start gap-4 ${!a.is_active ? "opacity-50" : ""}`}>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{a.account_name}</span>
                          {a.is_default && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Default</span>
                          )}
                          {!a.is_active && (
                            <span className="text-[10px] text-gray-400">Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{a.bank_name} · {a.account_number}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{a.gl_number} — {a.gl_name}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <button type="button" onClick={() => openEdit(a)}
                          className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => toggleActive(a)} disabled={togglingId === a.id}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            a.is_active
                              ? "text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600"
                              : "text-green-600 border-green-200 hover:bg-green-50"
                          } disabled:opacity-50`}>
                          {togglingId === a.id ? "…" : a.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button type="button" onClick={() => deleteAccount(a)} disabled={deletingId === a.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 px-1">
                          {deletingId === a.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
