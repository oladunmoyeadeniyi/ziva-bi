"use client";

/**
 * Currencies & FX page — M8.3 rebuild.
 *
 * 3 tabs: Currencies | FX rates | Revaluation rules
 * ISO 4217 currency dropdown, multiple rate types, per-balance-type revaluation GLs.
 *
 * Route: /dashboard/business/setup/currencies
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

const ISO_CURRENCIES = [
  { code: "USD", name: "US Dollar",              symbol: "$"   },
  { code: "EUR", name: "Euro",                   symbol: "€"   },
  { code: "GBP", name: "British Pound",          symbol: "£"   },
  { code: "NGN", name: "Nigerian Naira",         symbol: "₦"   },
  { code: "GHS", name: "Ghanaian Cedi",          symbol: "₵"   },
  { code: "KES", name: "Kenyan Shilling",        symbol: "KSh" },
  { code: "ZAR", name: "South African Rand",     symbol: "R"   },
  { code: "AED", name: "UAE Dirham",             symbol: "د.إ" },
  { code: "CAD", name: "Canadian Dollar",        symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar",      symbol: "A$"  },
  { code: "CHF", name: "Swiss Franc",            symbol: "Fr"  },
  { code: "JPY", name: "Japanese Yen",           symbol: "¥"   },
  { code: "CNY", name: "Chinese Yuan",           symbol: "¥"   },
  { code: "INR", name: "Indian Rupee",           symbol: "₹"   },
  { code: "XOF", name: "CFA Franc BCEAO",       symbol: "Fr"  },
  { code: "XAF", name: "CFA Franc BEAC",        symbol: "Fr"  },
  { code: "EGP", name: "Egyptian Pound",         symbol: "E£"  },
  { code: "TZS", name: "Tanzanian Shilling",     symbol: "TSh" },
  { code: "UGX", name: "Ugandan Shilling",       symbol: "USh" },
  { code: "RWF", name: "Rwandan Franc",          symbol: "Fr"  },
  { code: "ETB", name: "Ethiopian Birr",         symbol: "Br"  },
  { code: "MAD", name: "Moroccan Dirham",        symbol: "MAD" },
  { code: "OTHER", name: "Other (enter manually)", symbol: ""  },
];

const RATE_TYPES = [
  { value: "cbn",       label: "CBN official rate",     desc: "Central Bank statutory rate" },
  { value: "bank_buy",  label: "Bank buying rate",       desc: "Rate bank pays when buying FX from you" },
  { value: "bank_sell", label: "Bank selling rate",      desc: "Rate bank charges when selling FX to you" },
  { value: "mid",       label: "Mid rate",               desc: "Average of buy and sell" },
  { value: "average",   label: "Period average rate",    desc: "Average of daily rates for the period (IAS 21 P&L)" },
  { value: "closing",   label: "Closing rate",           desc: "Rate at last day of period (IAS 21 Balance Sheet)" },
  { value: "budget",    label: "Budget rate",            desc: "Fixed rate set at year start (management reporting only)" },
  { value: "nafem",     label: "NAFEM/I&E window rate",  desc: "Market rate — closer to IAS 21 spot" },
  { value: "manual",    label: "Manual override",         desc: "Entered manually — proof of rate required" },
];

const RATE_SOURCES = [
  { value: "cbn_api",   label: "CBN API (auto-fetch)" },
  { value: "xe",        label: "XE.com (auto-fetch)" },
  { value: "bloomberg", label: "Bloomberg/Reuters" },
  { value: "bank",      label: "Bank confirmation" },
  { value: "bdc",       label: "Bureau de Change receipt" },
  { value: "manual",    label: "Manual entry" },
];

const BALANCE_TYPES = [
  { key: "ap_third_party",  label: "AP — Third party",      desc: "Vendor payables to external parties" },
  { key: "ap_intercompany", label: "AP — Intercompany",     desc: "Payables to related/group entities" },
  { key: "ar_third_party",  label: "AR — Third party",      desc: "Receivables from external customers" },
  { key: "ar_intercompany", label: "AR — Intercompany",     desc: "Receivables from related/group entities" },
  { key: "bank",            label: "Bank balances",          desc: "Foreign currency bank accounts" },
  { key: "ic_loans",        label: "IC loans",               desc: "Intercompany loan balances" },
  { key: "fx_loans",        label: "External FX loans",      desc: "Borrowings in foreign currency" },
  { key: "translation",     label: "Translation difference", desc: "Net investment in foreign operation (IAS 21 OCI)" },
];

type Tab = "currencies" | "fx_rates" | "revaluation";

interface AdditionalCurrency {
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  rate_source?: string;
  effective_from?: string;
}

interface FxRateEntry {
  id: string;
  from_currency: string;
  to_currency: string;
  rate_type: string;
  rate: number;
  source: string;
  effective_date: string;
  period?: string;
  entered_by?: string;
  entered_at?: string;
  proof_required?: boolean;
  proof_reference?: string;
}

interface RevalGL {
  realized_gain?: string;
  realized_loss?: string;
  unrealized_gain?: string;
  unrealized_loss?: string;
}

interface RevalRules {
  method?: "cumulative" | "reverse_restate";
  rate_source?: string;
  frequency?: "monthly" | "quarterly" | "yearly" | "at_period_close";
  scope?: "all" | "selected";
  by_balance_type?: Record<string, RevalGL>;
  translation_diff_gl?: string;
}

interface FxConfig {
  functional_currency?: string;
  reporting_currency?: string;
  additional_currencies?: AdditionalCurrency[];
  fx_rates?: FxRateEntry[];
  revaluation_rules?: RevalRules;
}

export default function CurrenciesPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("currencies");
  const [config, setConfig] = useState<FxConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add currency form
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [newCurrCode, setNewCurrCode] = useState("");
  const [newCurrCustomCode, setNewCurrCustomCode] = useState("");
  const [newCurrSource, setNewCurrSource] = useState("manual");
  const [newCurrFrom, setNewCurrFrom] = useState("");

  // Add FX rate form
  const [showAddRate, setShowAddRate] = useState(false);
  const [newRateCurrency, setNewRateCurrency] = useState("");
  const [newRateType, setNewRateType] = useState("cbn");
  const [newRateValue, setNewRateValue] = useState("");
  const [newRateSource, setNewRateSource] = useState("manual");
  const [newRateDate, setNewRateDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newRatePeriod, setNewRatePeriod] = useState("");
  const [newRateProof, setNewRateProof] = useState("");
  const [addingRate, setAddingRate] = useState(false);

  // Revaluation — shared GL toggle
  const [useSharedGL, setUseSharedGL] = useState(false);
  const [sharedGainGL, setSharedGainGL] = useState("");
  const [sharedLossGL, setSharedLossGL] = useState("");

  // Revaluation filter
  const [rateFilterCurrency, setRateFilterCurrency] = useState("");
  const [rateFilterType, setRateFilterType] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<FxConfig>("/api/setup/currencies", { token: accessToken })
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, [accessToken]);

  const getCurrencyInfo = (code: string) =>
    ISO_CURRENCIES.find((c) => c.code === code);

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
    const code =
      newCurrCode === "OTHER" ? newCurrCustomCode.toUpperCase() : newCurrCode;
    if (!code) return;
    const info = getCurrencyInfo(code);
    const updated: AdditionalCurrency[] = [
      ...(config.additional_currencies ?? []),
      {
        code,
        name: info?.name ?? code,
        symbol: info?.symbol ?? "",
        is_active: true,
        rate_source: newCurrSource,
        effective_from:
          newCurrFrom || new Date().toISOString().split("T")[0],
      },
    ];
    setConfig((c) => ({ ...c, additional_currencies: updated }));
    save({ additional_currencies: updated });
    setNewCurrCode("");
    setNewCurrCustomCode("");
    setNewCurrSource("manual");
    setNewCurrFrom("");
    setShowAddCurrency(false);
  };

  const addFxRate = async () => {
    if (!accessToken || !newRateCurrency || !newRateValue) return;
    setAddingRate(true);
    try {
      const result = await apiFetch<FxRateEntry>(
        "/api/setup/currencies/fx-rates",
        {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            from_currency: newRateCurrency,
            to_currency: config.functional_currency ?? "NGN",
            rate_type: newRateType,
            rate: parseFloat(newRateValue),
            source: newRateSource,
            effective_date: newRateDate,
            period: newRatePeriod || undefined,
            proof_required: ["manual", "bdc", "bank"].includes(newRateSource),
            proof_reference: newRateProof || undefined,
          }),
        }
      );
      setConfig((c) => ({ ...c, fx_rates: [...(c.fx_rates ?? []), result] }));
      setShowAddRate(false);
      setNewRateCurrency("");
      setNewRateValue("");
      setNewRatePeriod("");
      setNewRateProof("");
      setNewRateType("cbn");
      setNewRateSource("manual");
      setNewRateDate(new Date().toISOString().split("T")[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add rate");
    } finally {
      setAddingRate(false);
    }
  };

  const setRevalGL = (
    balanceType: string,
    field: keyof RevalGL,
    value: string
  ) => {
    setConfig((c) => ({
      ...c,
      revaluation_rules: {
        ...(c.revaluation_rules ?? {}),
        by_balance_type: {
          ...(c.revaluation_rules?.by_balance_type ?? {}),
          [balanceType]: {
            ...(c.revaluation_rules?.by_balance_type?.[balanceType] ?? {}),
            [field]: value,
          },
        },
      },
    }));
  };

  const setRevalField = (field: keyof RevalRules, value: unknown) =>
    setConfig((c) => ({
      ...c,
      revaluation_rules: { ...(c.revaluation_rules ?? {}), [field]: value },
    }));

  const applySharedGL = () => {
    const shared: Record<string, RevalGL> = {};
    BALANCE_TYPES.forEach((bt) => {
      shared[bt.key] = {
        realized_gain: sharedGainGL,
        realized_loss: sharedLossGL,
        unrealized_gain: sharedGainGL,
        unrealized_loss: sharedLossGL,
      };
    });
    setConfig((c) => ({
      ...c,
      revaluation_rules: {
        ...(c.revaluation_rules ?? {}),
        by_balance_type: shared,
      },
    }));
  };

  const filteredRates = (config.fx_rates ?? [])
    .filter((r) => {
      if (rateFilterCurrency && r.from_currency !== rateFilterCurrency)
        return false;
      if (rateFilterType && r.rate_type !== rateFilterType) return false;
      return true;
    })
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  return (
    <div className="p-8 max-w-4xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">
        Currencies &amp; FX
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure functional currency, additional currencies, FX rates, and
        revaluation rules.
      </p>

      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {(["currencies", "fx_rates", "revaluation"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "currencies"
              ? "Currencies"
              : t === "fx_rates"
              ? "FX rates"
              : "Revaluation rules"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* ── CURRENCIES TAB ── */}
      {tab === "currencies" && (
        <div className="space-y-5 max-w-2xl">
          {/* Functional currency */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">
              Functional currency (set in Organisation)
            </p>
            <p className="text-sm font-semibold text-gray-800">
              {config.functional_currency
                ? `${config.functional_currency} — ${
                    getCurrencyInfo(config.functional_currency)?.name ?? ""
                  }`
                : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              All transactions are recorded in this currency. Cannot be changed
              after go-live.
            </p>
          </div>

          {/* Reporting currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reporting currency
            </label>
            <select
              value={config.reporting_currency ?? ""}
              onChange={(e) =>
                setConfig((c) => ({ ...c, reporting_currency: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                — Select reporting currency (optional) —
              </option>
              {ISO_CURRENCIES.filter(
                (c) =>
                  c.code !== config.functional_currency && c.code !== "OTHER"
              ).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Used when generating consolidated reports in a currency different
              from the functional currency (e.g. subsidiary reporting to parent
              in EUR).
            </p>
          </div>

          {/* Additional currencies */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">
                Additional currencies
              </p>
              <button
                type="button"
                onClick={() => setShowAddCurrency(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add
                currency
              </button>
            </div>

            {showAddCurrency && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <p className="text-xs font-medium text-gray-700">
                  Add currency
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Currency *
                    </label>
                    <select
                      value={newCurrCode}
                      onChange={(e) => setNewCurrCode(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select currency —</option>
                      {ISO_CURRENCIES.filter(
                        (c) =>
                          c.code !== config.functional_currency &&
                          !(config.additional_currencies ?? []).some(
                            (a) => a.code === c.code
                          )
                      ).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code !== "OTHER"
                            ? `${c.code} — ${c.name}`
                            : c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {newCurrCode === "OTHER" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Currency code *
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={newCurrCustomCode}
                        onChange={(e) =>
                          setNewCurrCustomCode(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. SGD"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Rate source
                    </label>
                    <select
                      value={newCurrSource}
                      onChange={(e) => setNewCurrSource(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {RATE_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Effective from
                    </label>
                    <input
                      type="date"
                      value={newCurrFrom}
                      onChange={(e) => setNewCurrFrom(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addCurrency}
                    disabled={
                      !newCurrCode ||
                      (newCurrCode === "OTHER" && !newCurrCustomCode)
                    }
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCurrency(false)}
                    className="px-4 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(config.additional_currencies ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No additional currencies added.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Symbol</th>
                      <th className="px-3 py-2 text-left">Rate source</th>
                      <th className="px-3 py-2 text-left">From</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(config.additional_currencies ?? []).map((c, i) => (
                      <tr key={c.code}>
                        <td className="px-3 py-2 font-mono font-medium">
                          {c.code}
                        </td>
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2">{c.symbol}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {RATE_SOURCES.find((s) => s.value === c.rate_source)
                            ?.label ??
                            c.rate_source ??
                            "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {c.effective_from ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              c.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (
                                config.additional_currencies ?? []
                              ).map((cur, idx) =>
                                idx === i
                                  ? { ...cur, is_active: !cur.is_active }
                                  : cur
                              );
                              setConfig((c) => ({
                                ...c,
                                additional_currencies: updated,
                              }));
                              save({ additional_currencies: updated });
                            }}
                            className="text-xs text-gray-500 hover:text-gray-800"
                          >
                            {c.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rate policy note */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <i
              className="ti ti-info-circle text-blue-600 flex-shrink-0 mt-0.5"
              style={{ fontSize: 13 }}
            />
            <p className="text-xs text-blue-700">
              <strong className="font-medium">IAS 21 note:</strong> The CBN
              official rate is the default for Nigerian entities and is
              acceptable where exchange rates do not fluctuate significantly
              (IAS 21.26). For material transactions, the actual transaction
              rate (bank/NAFEM rate) is more appropriate. The rate used must be
              disclosed in the notes to the financial statements.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                save({
                  reporting_currency: config.reporting_currency,
                  additional_currencies: config.additional_currencies,
                })
              }
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save currencies"}
            </button>
            {saved && <span className="text-sm text-green-600">✓ Saved</span>}
          </div>
        </div>
      )}

      {/* ── FX RATES TAB ── */}
      {tab === "fx_rates" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-gray-500 max-w-lg">
              Maintain FX rate history per currency and rate type. Rates are
              used for transaction recording, period-end revaluation, and
              financial statement translation. Employee expense retirements use
              the actual rate paid (BDC/bank rate) entered at the time of
              retirement.
            </p>
            <button
              type="button"
              onClick={() => setShowAddRate(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 flex-shrink-0"
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add rate
            </button>
          </div>

          {showAddRate && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-medium text-gray-700 mb-3">
                New FX rate entry
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Currency *
                  </label>
                  <select
                    value={newRateCurrency}
                    onChange={(e) => setNewRateCurrency(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select —</option>
                    {(config.additional_currencies ?? [])
                      .filter((c) => c.is_active)
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Rate type *
                  </label>
                  <select
                    value={newRateType}
                    onChange={(e) => setNewRateType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {RATE_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {RATE_TYPES.find((rt) => rt.value === newRateType)?.desc}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Rate (1 {newRateCurrency || "FCY"} ={" "}
                    {config.functional_currency ?? "NGN"}) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={newRateValue}
                    onChange={(e) => setNewRateValue(e.target.value)}
                    placeholder="e.g. 1650.00"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Effective date *
                  </label>
                  <input
                    type="date"
                    value={newRateDate}
                    onChange={(e) => setNewRateDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Source *
                  </label>
                  <select
                    value={newRateSource}
                    onChange={(e) => setNewRateSource(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {RATE_SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Period (optional)
                  </label>
                  <input
                    type="text"
                    value={newRatePeriod}
                    onChange={(e) => setNewRatePeriod(e.target.value)}
                    placeholder="e.g. Jan 2025, Q1 2025"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {["manual", "bdc", "bank"].includes(newRateSource) && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Proof of rate reference
                    <span className="text-amber-600 ml-1">
                      (required for non-standard sources)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={newRateProof}
                    onChange={(e) => setNewRateProof(e.target.value)}
                    placeholder="e.g. BDC receipt no. / Bank advice ref. / Document ID"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">
                    Upload the supporting document in Document Management and
                    reference the document ID here.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addFxRate}
                  disabled={addingRate || !newRateCurrency || !newRateValue}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingRate ? "Saving…" : "Save rate"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRate(false)}
                  className="px-4 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={rateFilterCurrency}
              onChange={(e) => setRateFilterCurrency(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All currencies</option>
              {(config.additional_currencies ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
            <select
              value={rateFilterType}
              onChange={(e) => setRateFilterType(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All rate types</option>
              {RATE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
            {(rateFilterCurrency || rateFilterType) && (
              <button
                type="button"
                onClick={() => {
                  setRateFilterCurrency("");
                  setRateFilterType("");
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Rates table */}
          {filteredRates.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4">
              No FX rates configured yet.
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Currency</th>
                    <th className="px-3 py-2 text-left">Rate type</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-left">Effective date</th>
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRates.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-medium">
                        {r.from_currency}/{r.to_currency}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {RATE_TYPES.find((rt) => rt.value === r.rate_type)
                            ?.label ?? r.rate_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r.rate?.toLocaleString("en-NG", {
                          minimumFractionDigits: 4,
                        })}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {r.effective_date}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {r.period ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {RATE_SOURCES.find((s) => s.value === r.source)
                          ?.label ?? r.source}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.proof_required ? (
                          r.proof_reference ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <i
                                className="ti ti-check"
                                style={{ fontSize: 11 }}
                              />{" "}
                              {r.proof_reference}
                            </span>
                          ) : (
                            <span className="text-amber-600 flex items-center gap-1">
                              <i
                                className="ti ti-alert-triangle"
                                style={{ fontSize: 11 }}
                              />{" "}
                              Required
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── REVALUATION RULES TAB ── */}
      {tab === "revaluation" && (
        <div className="space-y-5 max-w-3xl">
          {/* Method */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Revaluation method
            </p>
            <div className="space-y-2">
              {[
                {
                  value: "cumulative",
                  label: "Cumulative",
                  desc: "Post only the movement each period. Prior entries remain. Most common in practice.",
                },
                {
                  value: "reverse_restate",
                  label: "Reverse and restate",
                  desc: "Reverse prior period unrealized entry at period start, post fresh revaluation. Cleaner per-period P&L.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                    (config.revaluation_rules?.method ?? "cumulative") ===
                    opt.value
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="reval_method"
                    checked={
                      (config.revaluation_rules?.method ?? "cumulative") ===
                      opt.value
                    }
                    onChange={() => setRevalField("method", opt.value)}
                    className="accent-blue-600 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-900">
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Revaluation settings
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Rate source for revaluation
                </label>
                <select
                  value={config.revaluation_rules?.rate_source ?? "cbn_api"}
                  onChange={(e) => setRevalField("rate_source", e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {RATE_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-0.5">
                  CBN closing rate is standard for Nigerian entities.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Revaluation frequency
                </label>
                <select
                  value={config.revaluation_rules?.frequency ?? "monthly"}
                  onChange={(e) => setRevalField("frequency", e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="at_period_close">
                    At period close (follows fiscal year settings)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* GL accounts per balance type */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                FX gain/loss GL accounts by balance type
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSharedGL}
                  onChange={(e) => setUseSharedGL(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-xs text-gray-600">
                  Use shared GLs for all types
                </span>
              </label>
            </div>

            {useSharedGL && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Shared GL accounts (applied to all balance types)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      FX gain GL
                    </label>
                    <input
                      type="text"
                      value={sharedGainGL}
                      onChange={(e) => setSharedGainGL(e.target.value)}
                      placeholder="e.g. 8001"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      FX loss GL
                    </label>
                    <input
                      type="text"
                      value={sharedLossGL}
                      onChange={(e) => setSharedLossGL(e.target.value)}
                      placeholder="e.g. 8002"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applySharedGL}
                  disabled={!sharedGainGL || !sharedLossGL}
                  className="mt-2 text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply to all balance types
                </button>
              </div>
            )}

            <div className="space-y-3">
              {BALANCE_TYPES.map((bt) => {
                const gl =
                  config.revaluation_rules?.by_balance_type?.[bt.key] ?? {};
                return (
                  <div
                    key={bt.key}
                    className="border border-gray-100 rounded-lg p-3 bg-gray-50"
                  >
                    <p className="text-xs font-medium text-gray-800 mb-0.5">
                      {bt.label}
                    </p>
                    <p className="text-xs text-gray-400 mb-2">{bt.desc}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(
                        [
                          {
                            field: "realized_gain" as const,
                            label: "Realized gain",
                          },
                          {
                            field: "realized_loss" as const,
                            label: "Realized loss",
                          },
                          {
                            field: "unrealized_gain" as const,
                            label: "Unrealized gain",
                          },
                          {
                            field: "unrealized_loss" as const,
                            label: "Unrealized loss",
                          },
                        ] as { field: keyof RevalGL; label: string }[]
                      ).map((f) => (
                        <div key={f.field}>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">
                            {f.label}
                          </label>
                          <input
                            type="text"
                            value={gl[f.field] ?? ""}
                            onChange={(e) =>
                              setRevalGL(bt.key, f.field, e.target.value)
                            }
                            placeholder="GL no."
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
              <i
                className="ti ti-info-circle text-amber-600 flex-shrink-0 mt-0.5"
                style={{ fontSize: 13 }}
              />
              <p className="text-xs text-amber-700">
                GL numbers must exist in your Chart of Accounts. Realized
                gain/loss GLs are used when FX balances are settled. Unrealized
                GLs are used for period-end revaluation movements. Gain and loss
                can point to the same GL if you prefer a net FX position.
              </p>
            </div>
          </div>

          {/* Settlement handling note */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              NGN settlement of FX liability
            </p>
            <p className="text-xs text-gray-600">
              When a foreign currency liability (AP, loan) is settled by paying
              NGN directly to the bank for conversion, the system will
              automatically compute the realized FX difference:
            </p>
            <div className="mt-2 p-2 bg-gray-50 rounded font-mono text-xs text-gray-700">
              Realized gain/loss = (FCY balance × carrying rate) − actual NGN
              paid
            </div>
            <p className="text-xs text-gray-500 mt-2">
              The settlement rate (actual NGN ÷ FCY) is captured on the payment
              transaction. Bank advice upload is recommended for audit purposes.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                save({ revaluation_rules: config.revaluation_rules })
              }
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save revaluation rules"}
            </button>
            {saved && <span className="text-sm text-green-600">✓ Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
