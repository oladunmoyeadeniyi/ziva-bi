"use client";

/**
 * Currencies & FX page — M8.2 Implementation Portal.
 *
 * 3 tabs: Currencies | FX rates | Revaluation rules
 *
 * Route: /dashboard/business/setup/currencies
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

type Tab = "currencies" | "fx_rates" | "revaluation";

interface Currency {
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
}

interface FxRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  effective_date: string;
  updated_by?: string;
}

interface RevalRules {
  realized_gl?: string;
  unrealized_gl?: string;
  month_end_revaluation?: boolean;
  revaluation_date_type?: string;
  fx_application_rule?: string;
}

interface FxConfig {
  functional_currency?: string;
  reporting_currency?: string;
  additional_currencies?: Currency[];
  fx_rates?: FxRate[];
  revaluation_rules?: RevalRules;
}

function TabBtn({
  id,
  active,
  onClick,
  label,
}: {
  id: Tab;
  active: boolean;
  onClick: (t: Tab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const selectCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function CurrenciesPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("currencies");
  const [config, setConfig] = useState<FxConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCurrency, setNewCurrency] = useState({ code: "", name: "", symbol: "" });
  const [showAddCurrency, setShowAddCurrency] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<FxConfig>("/api/setup/currencies", { token: accessToken })
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, [accessToken]);

  const save = async (patch: Partial<FxConfig>) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<FxConfig>("/api/setup/currencies", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify(patch),
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addCurrency = () => {
    if (!newCurrency.code || !newCurrency.name) return;
    const updated = [
      ...(config.additional_currencies ?? []),
      { ...newCurrency, is_active: true },
    ];
    setConfig((c) => ({ ...c, additional_currencies: updated }));
    save({ additional_currencies: updated });
    setNewCurrency({ code: "", name: "", symbol: "" });
    setShowAddCurrency(false);
  };

  const setReval = (key: keyof RevalRules, value: unknown) =>
    setConfig((c) => ({
      ...c,
      revaluation_rules: { ...(c.revaluation_rules ?? {}), [key]: value },
    }));

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Currencies & FX</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure functional currency, additional currencies, FX rates, and revaluation rules.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="currencies"   active={tab === "currencies"}   onClick={setTab} label="Currencies" />
        <TabBtn id="fx_rates"     active={tab === "fx_rates"}     onClick={setTab} label="FX rates" />
        <TabBtn id="revaluation"  active={tab === "revaluation"}  onClick={setTab} label="Revaluation rules" />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* ── Currencies tab ── */}
      {tab === "currencies" && (
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Functional currency (set in Organisation)</p>
            <p className="text-sm font-semibold text-gray-800">
              {config.functional_currency ?? "—"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reporting currency</label>
            <input
              className={inputCls}
              placeholder="e.g. USD"
              maxLength={3}
              value={config.reporting_currency ?? ""}
              onChange={(e) =>
                setConfig((c) => ({ ...c, reporting_currency: e.target.value.toUpperCase() }))
              }
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Additional currencies</p>
              <button
                type="button"
                onClick={() => setShowAddCurrency(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add currency
              </button>
            </div>

            {showAddCurrency && (
              <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50 grid grid-cols-3 gap-2">
                <input
                  className={inputCls}
                  placeholder="Code (e.g. EUR)"
                  maxLength={3}
                  value={newCurrency.code}
                  onChange={(e) =>
                    setNewCurrency((n) => ({ ...n, code: e.target.value.toUpperCase() }))
                  }
                />
                <input
                  className={inputCls}
                  placeholder="Name"
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency((n) => ({ ...n, name: e.target.value }))}
                />
                <input
                  className={inputCls}
                  placeholder="Symbol (e.g. €)"
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency((n) => ({ ...n, symbol: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={addCurrency}
                  className="col-span-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCurrency(false)}
                  className="px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}

            {(config.additional_currencies ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">No additional currencies added.</p>
            ) : (
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(config.additional_currencies ?? []).map((c) => (
                    <tr key={c.code} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono font-medium">{c.code}</td>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2">{c.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <button
            type="button"
            onClick={() => save({ reporting_currency: config.reporting_currency })}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="ml-3 text-sm text-green-600">Saved</span>}
        </div>
      )}

      {/* ── FX Rates tab ── */}
      {tab === "fx_rates" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Note: automated rate feeds from CBN/XE are planned for a future milestone. Enter rates manually below.
          </p>
          {(config.fx_rates ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 italic">No FX rates configured.</p>
          ) : (
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Pair</th>
                  <th className="px-3 py-2 text-left">Rate</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Effective date</th>
                </tr>
              </thead>
              <tbody>
                {(config.fx_rates ?? []).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono">{r.from_currency}/{r.to_currency}</td>
                    <td className="px-3 py-2">{r.rate?.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="px-3 py-2">{r.effective_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            type="button"
            className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            + Update rates
          </button>
        </div>
      )}

      {/* ── Revaluation rules tab ── */}
      {tab === "revaluation" && (
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Realized gain/loss GL account</label>
            <input
              className={inputCls}
              placeholder="GL account number"
              value={config.revaluation_rules?.realized_gl ?? ""}
              onChange={(e) => setReval("realized_gl", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unrealized gain/loss GL account</label>
            <input
              className={inputCls}
              placeholder="GL account number"
              value={config.revaluation_rules?.unrealized_gl ?? ""}
              onChange={(e) => setReval("unrealized_gl", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="month_end"
              checked={config.revaluation_rules?.month_end_revaluation ?? false}
              onChange={(e) => setReval("month_end_revaluation", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="month_end" className="text-sm text-gray-700">
              Enable month-end revaluation
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">FX application rule</label>
            <select
              className={selectCls}
              value={config.revaluation_rules?.fx_application_rule ?? ""}
              onChange={(e) => setReval("fx_application_rule", e.target.value)}
            >
              <option value="">Select rule</option>
              <option value="invoice_date">Invoice date</option>
              <option value="approval_date">Approval date</option>
              <option value="payment_date">Payment date</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => save({ revaluation_rules: config.revaluation_rules })}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="ml-3 text-sm text-green-600">Saved</span>}
        </div>
      )}
    </div>
  );
}
