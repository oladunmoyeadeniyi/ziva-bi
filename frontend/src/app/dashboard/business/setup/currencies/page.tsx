"use client";

/**
 * Currencies & FX page — M8.3 rebuild.
 *
 * 3 tabs: Currencies | FX rates | Revaluation rules
 * ISO 4217 currency dropdown, multiple rate types, per-balance-type revaluation GLs.
 *
 * Route: /dashboard/business/setup/currencies
 */

import { useEffect, useState, useRef } from "react";
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
  { key: "translation",     label: "Translation difference",          desc: "Net investment in foreign operation (IAS 21 OCI)" },
  { key: "wht_payable_fcy", label: "WHT payable — foreign currency",  desc: "WHT deducted from FCY invoices, remittable to tax authority in FCY. Recognised at payment. Revalued independently until FIRS remittance." },
];

type Tab = "currencies" | "fx_rates" | "revaluation" | "bdc_register";

interface BdcEntry {
  id: string;
  name: string;
  rc_number?: string;
  cbn_licence?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  wht_category?: string;
  is_active: boolean;
}

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
  bs_gl?: string;
  bs_gl_name?: string;
  realized_gain?: string;
  realized_gain_name?: string;
  realized_loss?: string;
  realized_loss_name?: string;
  unrealized_gain?: string;
  unrealized_gain_name?: string;
  unrealized_loss?: string;
  unrealized_loss_name?: string;
}

interface RevalRules {
  method?: "directional_netting" | "cumulative" | "reverse_restate";
  reverse_restate_mode?: "separate_entries" | "net_journal";
  year_end_crossing?: "net_journal" | "separate_jan1" | "cumulative_crossover";
  settlement_rate_basis?: "original_transaction" | "prior_period_closing" | "current_carrying";
  partial_settlement_method?: "fifo" | "specific_id" | "weighted_average";
  reversal_gl_preference?: "same_gl" | "opposite_gl";
  rate_source?: string;
  frequency?: "monthly" | "quarterly" | "yearly" | "at_period_close";
  scope?: "all" | "selected";
  by_balance_type?: Record<string, RevalGL>;
  custom_balance_types?: { key: string; label: string; desc: string }[];
}

interface FxConfig {
  functional_currency?: string;
  reporting_currency?: string;
  additional_currencies?: AdditionalCurrency[];
  fx_rates?: FxRateEntry[];
  revaluation_rules?: RevalRules;
}

interface GLOption {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type?: string;
  account_classification?: string;
}

interface GLSearchInputProps {
  value: string;
  onChange: (glNumber: string, glName: string) => void;
  placeholder?: string;
  accountType?: string;
  classification?: string;
  disabled?: boolean;
}

function GLSearchInput({
  value,
  onChange,
  placeholder = "Search GL number or name…",
  accountType,
  classification,
  disabled,
}: GLSearchInputProps) {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<GLOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!accessToken || query.length < 1) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search: query, limit: "20" });
        if (accountType) params.set("account_type", accountType);
        if (classification) params.set("classification", classification);
        const results = await apiFetch<GLOption[]>(
          `/api/config/coa?${params}`,
          { token: accessToken }
        );
        setOptions(results);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, accessToken, accountType, classification]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) onChange("", "");
          }}
          onFocus={() => { if (options.length > 0) setOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm pr-7 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        {loading && (
          <i
            className="ti ti-loader-2 animate-spin absolute right-2 top-2 text-gray-400"
            style={{ fontSize: 13 }}
          />
        )}
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(`${opt.gl_number} — ${opt.gl_name}`);
                onChange(opt.gl_number, opt.gl_name);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs border-b border-gray-50 last:border-0"
            >
              <span className="font-mono text-gray-700 mr-2">{opt.gl_number}</span>
              <span className="text-gray-800">{opt.gl_name}</span>
              {opt.account_classification && (
                <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1 rounded">
                  {opt.account_classification}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && query.length > 0 && options.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-400">
          No GL accounts found. Check your Chart of Accounts.
        </div>
      )}
    </div>
  );
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
  const [sharedGainGLName, setSharedGainGLName] = useState("");
  const [sharedLossGL, setSharedLossGL] = useState("");
  const [sharedLossGLName, setSharedLossGLName] = useState("");

  // Custom balance type form
  const [showAddBalanceType, setShowAddBalanceType] = useState(false);
  const [newBTKey, setNewBTKey] = useState("");
  const [newBTLabel, setNewBTLabel] = useState("");
  const [newBTDesc, setNewBTDesc] = useState("");

  // BDC register
  const [showAddBdc, setShowAddBdc] = useState(false);
  const [newBdcName, setNewBdcName] = useState("");
  const [newBdcRc, setNewBdcRc] = useState("");
  const [newBdcCbn, setNewBdcCbn] = useState("");
  const [newBdcContact, setNewBdcContact] = useState("");
  const [newBdcPhone, setNewBdcPhone] = useState("");
  const [newBdcEmail, setNewBdcEmail] = useState("");
  const [newBdcWht, setNewBdcWht] = useState("5");
  const [addingBdc, setAddingBdc] = useState(false);

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
    value: string,
    nameField?: keyof RevalGL,
    name?: string
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
            ...(nameField && name ? { [nameField]: name } : {}),
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
    const allTypes = [
      ...BALANCE_TYPES,
      ...(config.revaluation_rules?.custom_balance_types ?? []),
    ];
    allTypes.forEach((bt) => {
      shared[bt.key] = {
        realized_gain: sharedGainGL,
        realized_gain_name: sharedGainGLName,
        realized_loss: sharedLossGL,
        realized_loss_name: sharedLossGLName,
        unrealized_gain: sharedGainGL,
        unrealized_gain_name: sharedGainGLName,
        unrealized_loss: sharedLossGL,
        unrealized_loss_name: sharedLossGLName,
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

  const addBdc = async () => {
    if (!newBdcName.trim()) return;
    setAddingBdc(true);
    const existing = (config as any).bdc_register ?? [];
    const newEntry: BdcEntry = {
      id: crypto.randomUUID(),
      name: newBdcName.trim(),
      rc_number: newBdcRc.trim() || undefined,
      cbn_licence: newBdcCbn.trim() || undefined,
      contact_name: newBdcContact.trim() || undefined,
      contact_phone: newBdcPhone.trim() || undefined,
      contact_email: newBdcEmail.trim() || undefined,
      wht_category: newBdcWht || "5",
      is_active: true,
    };
    const updated = [...existing, newEntry];
    try {
      await save({ bdc_register: updated } as any);
      setConfig((c) => ({ ...c, bdc_register: updated } as any));
      setNewBdcName(""); setNewBdcRc(""); setNewBdcCbn("");
      setNewBdcContact(""); setNewBdcPhone(""); setNewBdcEmail("");
      setNewBdcWht("5"); setShowAddBdc(false);
    } finally {
      setAddingBdc(false);
    }
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
        {(["currencies", "fx_rates", "revaluation", "bdc_register"] as Tab[]).map((t) => (
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
              : t === "revaluation"
              ? "Revaluation rules"
              : "BDC register"}
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

          {/* ── METHOD ── */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Revaluation method
            </p>
            <div className="space-y-2 mb-3">
              {[
                {
                  value: "directional_netting",
                  label: "Directional netting (recommended — best practice)",
                  desc: "Each period, computes net unrealised position from original booking rate. If direction changes (loss → gain or gain → loss), fully reverses prior GL balance then posts net remainder to opposite GL. At any time, exactly one unrealised GL has a balance per invoice. IAS 21 compliant. Used by SAP FI and Oracle.",
                },
                {
                  value: "cumulative",
                  label: "Cumulative",
                  desc: "Post only the incremental movement each period. Prior entries remain on the books. Both gain and loss GLs may be populated simultaneously for the same invoice.",
                },
                {
                  value: "reverse_restate",
                  label: "Reverse and restate",
                  desc: "Reverse prior period unrealised entry, then post fresh revaluation. Cleaner per-period P&L view.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                    (config.revaluation_rules?.method ?? "directional_netting") === opt.value
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="reval_method"
                    checked={(config.revaluation_rules?.method ?? "directional_netting") === opt.value}
                    onChange={() => setRevalField("method", opt.value)}
                    className="accent-blue-600 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Directional netting info box */}
            {(config.revaluation_rules?.method ?? "directional_netting") === "directional_netting" && (
              <div className="ml-4 mt-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                <p className="text-xs font-medium text-green-800 mb-1">How directional netting works</p>
                <ul className="text-xs text-green-700 space-y-1 list-none">
                  <li>• Jan unrealised loss ₦300k → FX loss GL: ₦300k</li>
                  <li>• Feb net position ₦150k gain → Reverse ₦300k loss, post ₦150k gain → FX loss GL: zero, FX gain GL: ₦150k</li>
                  <li>• Mar net position ₦450k loss → Reverse ₦150k gain, post ₦450k loss → FX gain GL: zero, FX loss GL: ₦450k</li>
                </ul>
                <p className="text-xs text-green-600 mt-1.5">
                  Settlement always compares actual rate vs original booking rate. All outstanding
                  unrealised on the invoice auto-reverses at settlement.
                </p>
              </div>
            )}

            {/* Cumulative — reversal GL preference */}
            {config.revaluation_rules?.method === "cumulative" && (
              <div className="ml-4 mt-3 space-y-2 border-l-2 border-gray-200 pl-4">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Reversal GL preference
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  When reversing a prior unrealised entry, which GL should the reversal post to?
                </p>
                {[
                  {
                    value: "same_gl",
                    label: "Same GL as original (default)",
                    desc: "Reversal credits/debits the same GL the original entry was posted to. Reduces the balance in that GL.",
                  },
                  {
                    value: "opposite_gl",
                    label: "Cross to opposite GL",
                    desc: "Reversal posts to the gain/loss opposite GL. Both GLs may show balances simultaneously.",
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer ${
                      (config.revaluation_rules?.reversal_gl_preference ?? "same_gl") === opt.value
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reversal_gl_pref"
                      checked={(config.revaluation_rules?.reversal_gl_preference ?? "same_gl") === opt.value}
                      onChange={() => setRevalField("reversal_gl_preference", opt.value)}
                      className="accent-blue-600 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Reverse and restate sub-options */}
            {config.revaluation_rules?.method === "reverse_restate" && (
              <div className="ml-4 mt-3 space-y-2 border-l-2 border-blue-100 pl-4">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Reverse and restate — posting mode
                </p>
                {[
                  {
                    value: "net_journal",
                    label: "Net journal at period end (recommended)",
                    desc: "Reversal and fresh revaluation posted as a single net entry on period-end date.",
                  },
                  {
                    value: "separate_entries",
                    label: "Separate entries",
                    desc: "Reversal posted at period start, fresh revaluation posted at period end. Two journal entries per period.",
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer ${
                      (config.revaluation_rules?.reverse_restate_mode ?? "net_journal") === opt.value
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="restate_mode"
                      checked={(config.revaluation_rules?.reverse_restate_mode ?? "net_journal") === opt.value}
                      onChange={() => setRevalField("reverse_restate_mode", opt.value)}
                      className="accent-blue-600 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── YEAR-END CROSSING (reverse_restate only) ── */}
          {config.revaluation_rules?.method === "reverse_restate" && (
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Year-end crossing behaviour
              </p>
              <p className="text-xs text-gray-500 mb-3">
                How should the system handle the transition from December (year-end) into January (new year)?
              </p>
              <div className="space-y-2">
                {[
                  {
                    value: "net_journal",
                    label: "Net journal approach (recommended)",
                    desc: "December closing rate preserved as comparison base. January revaluation posts as single net entry from Dec rate to Jan rate. No settlement anomaly.",
                  },
                  {
                    value: "separate_jan1",
                    label: "Reverse on January 1, revalue on January 31 separately",
                    desc: "Reversal posts on January 1. Note: settlements between Jan 1–31 compare against pre-December-reval rate. System will flag this as a known limitation on affected transactions.",
                  },
                  {
                    value: "cumulative_crossover",
                    label: "Switch to cumulative for year-end crossing only",
                    desc: "December → January transition uses cumulative method. Reverse-and-restate resumes from January 31 onwards. Clean year-end, consistent intra-year behaviour.",
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                      (config.revaluation_rules?.year_end_crossing ?? "net_journal") === opt.value
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="year_end_crossing"
                      checked={(config.revaluation_rules?.year_end_crossing ?? "net_journal") === opt.value}
                      onChange={() => setRevalField("year_end_crossing", opt.value)}
                      className="accent-blue-600 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── SETTLEMENT RATE BASIS ── */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Settlement rate basis
            </p>
            {(config.revaluation_rules?.method ?? "directional_netting") === "directional_netting" ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                <i className="ti ti-lock text-green-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                <div>
                  <p className="text-xs font-medium text-green-800">
                    Original transaction rate (fixed for directional netting)
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Under directional netting, the realised difference is always computed as:
                    settlement rate vs original booking rate. All outstanding unrealised on
                    the invoice auto-reverses at settlement. This is not configurable — it
                    is the correct IAS 21 treatment and ensures the net P&L equals the actual
                    cash difference from the original booking.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  When a foreign currency balance is settled, what rate does the system compare
                  against to compute the realised FX difference?
                </p>
                <div className="space-y-2">
                  {[
                    {
                      value: "original_transaction",
                      label: "Original transaction rate",
                      desc: "Realised = settlement rate vs original booking rate. Combined with auto-reversal of all outstanding unrealised on the invoice.",
                    },
                    {
                      value: "prior_period_closing",
                      label: "Prior period closing rate (IAS 21)",
                      desc: "Realised = settlement rate vs last period-end closing rate. Simpler journals but less transparent.",
                    },
                    {
                      value: "current_carrying",
                      label: "Current carrying rate",
                      desc: "Realised = settlement rate vs current NGN carrying value ÷ FCY balance. Equivalent to prior period closing in most cases.",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                        (config.revaluation_rules?.settlement_rate_basis ?? "original_transaction") === opt.value
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="settlement_basis"
                        checked={(config.revaluation_rules?.settlement_rate_basis ?? "original_transaction") === opt.value}
                        onChange={() => setRevalField("settlement_rate_basis", opt.value)}
                        className="accent-blue-600 mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── PARTIAL SETTLEMENT METHOD ── */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Partial settlement method
            </p>
            <p className="text-xs text-gray-500 mb-3">
              When a payment partially settles multiple outstanding foreign currency invoices,
              which invoices are considered settled first?
            </p>
            <div className="space-y-2">
              {[
                {
                  value: "fifo",
                  label: "FIFO — oldest invoice first",
                  desc: "The oldest outstanding invoice is settled first. Common and straightforward.",
                },
                {
                  value: "specific_id",
                  label: "Specific identification",
                  desc: "User selects which invoice(s) are being settled at payment time. Maximum control and accuracy.",
                },
                {
                  value: "weighted_average",
                  label: "Weighted average carrying rate",
                  desc: "The carrying rate for all outstanding invoices is averaged. Simpler but less precise.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                    (config.revaluation_rules?.partial_settlement_method ?? "fifo") === opt.value
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="partial_settlement"
                    checked={(config.revaluation_rules?.partial_settlement_method ?? "fifo") === opt.value}
                    onChange={() => setRevalField("partial_settlement_method", opt.value)}
                    className="accent-blue-600 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── REVALUATION SETTINGS ── */}
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
                    <option key={s.value} value={s.value}>{s.label}</option>
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
                  <option value="at_period_close">At period close (follows Organisation settings)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── GL ACCOUNTS PER BALANCE TYPE ── */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                GL accounts by balance type
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSharedGL}
                  onChange={(e) => setUseSharedGL(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-xs text-gray-600">Use shared GLs for all types</span>
              </label>
            </div>

            {useSharedGL && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Shared FX gain/loss GL accounts (applied to all balance types)
                </p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">
                      FX gain GL (realised + unrealised)
                    </label>
                    <GLSearchInput
                      value={sharedGainGL}
                      onChange={(gl, name) => { setSharedGainGL(gl); setSharedGainGLName(name); }}
                      placeholder="Search GL…"
                      accountType="SOCI"
                      classification="Finance income"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">
                      FX loss GL (realised + unrealised)
                    </label>
                    <GLSearchInput
                      value={sharedLossGL}
                      onChange={(gl, name) => { setSharedLossGL(gl); setSharedLossGLName(name); }}
                      placeholder="Search GL…"
                      accountType="SOCI"
                      classification="Finance cost"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applySharedGL}
                  disabled={!sharedGainGL || !sharedLossGL}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply to all balance types
                </button>
              </div>
            )}

            <div className="space-y-4">
              {[
                ...BALANCE_TYPES,
                ...(config.revaluation_rules?.custom_balance_types ?? []),
              ].map((bt) => {
                const gl = config.revaluation_rules?.by_balance_type?.[bt.key] ?? {};
                return (
                  <div key={bt.key} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{bt.label}</p>
                        <p className="text-xs text-gray-400">{bt.desc}</p>
                      </div>
                    </div>

                    {/* Balance sheet control account */}
                    <div className="mb-3">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">
                        Balance sheet control account
                      </label>
                      <GLSearchInput
                        value={gl.bs_gl ?? ""}
                        onChange={(glNum, glName) => setRevalGL(bt.key, "bs_gl", glNum, "bs_gl_name", glName)}
                        placeholder="Search SOFP GL…"
                        accountType="SOFP"
                      />
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Must match the control account configured in the relevant module (AP, AR, Bank etc.)
                      </p>
                    </div>

                    {/* FX gain/loss GLs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        {
                          field: "realized_gain" as const,
                          nameField: "realized_gain_name" as const,
                          label: "Realised gain",
                          classification: "Finance income",
                        },
                        {
                          field: "realized_loss" as const,
                          nameField: "realized_loss_name" as const,
                          label: "Realised loss",
                          classification: "Finance cost",
                        },
                        {
                          field: "unrealized_gain" as const,
                          nameField: "unrealized_gain_name" as const,
                          label: "Unrealised gain",
                          classification: "Finance income",
                        },
                        {
                          field: "unrealized_loss" as const,
                          nameField: "unrealized_loss_name" as const,
                          label: "Unrealised loss",
                          classification: "Finance cost",
                        },
                      ].map((f) => (
                        <div key={f.field}>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">
                            {f.label}
                          </label>
                          <GLSearchInput
                            value={gl[f.field] ?? ""}
                            onChange={(glNum, glName) =>
                              setRevalGL(bt.key, f.field, glNum, f.nameField, glName)
                            }
                            placeholder="GL…"
                            accountType="SOCI"
                            classification={f.classification}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add custom balance type */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {!showAddBalanceType ? (
                <button
                  type="button"
                  onClick={() => setShowAddBalanceType(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <i className="ti ti-plus" style={{ fontSize: 12 }} />
                  Add custom balance type
                </button>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-gray-700">New balance type</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">
                        Internal key (no spaces) *
                      </label>
                      <input
                        type="text"
                        value={newBTKey}
                        onChange={(e) => setNewBTKey(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                        placeholder="e.g. prepayments_fx"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">
                        Display label *
                      </label>
                      <input
                        type="text"
                        value={newBTLabel}
                        onChange={(e) => setNewBTLabel(e.target.value)}
                        placeholder="e.g. FX Prepayments"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newBTDesc}
                        onChange={(e) => setNewBTDesc(e.target.value)}
                        placeholder="e.g. Advance payments to vendors in foreign currency"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!newBTKey.trim() || !newBTLabel.trim()}
                      onClick={() => {
                        const existing = config.revaluation_rules?.custom_balance_types ?? [];
                        const newCustom = [
                          ...existing,
                          { key: newBTKey.trim(), label: newBTLabel.trim(), desc: newBTDesc.trim() },
                        ];
                        setRevalField("custom_balance_types", newCustom);
                        setNewBTKey("");
                        setNewBTLabel("");
                        setNewBTDesc("");
                        setShowAddBalanceType(false);
                      }}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddBalanceType(false)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
              <i
                className="ti ti-info-circle text-amber-600 flex-shrink-0 mt-0.5"
                style={{ fontSize: 13 }}
              />
              <p className="text-xs text-amber-700">
                GL accounts are searched from your Chart of Accounts.
                Balance sheet control accounts must match those configured in the relevant modules
                (AP, AR, Bank). Gain and loss can point to the same GL for a net FX position.
              </p>
            </div>
          </div>

          {/* Settlement handling note */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              NGN settlement of FX liability
            </p>
            <p className="text-xs text-gray-600 mb-2">
              At settlement, the system automatically posts two entries:
            </p>
            <div className="space-y-2 mb-2">
              <div className="p-2 bg-gray-50 rounded text-xs text-gray-700">
                <p className="font-medium mb-0.5">Entry 1 — Realised FX difference:</p>
                <p className="font-mono">Realised gain/loss = (settlement rate − original booking rate) × FCY amount</p>
                <p className="text-gray-500 mt-0.5">Posted to realised FX gain/loss GL for this balance type.</p>
              </div>
              <div className="p-2 bg-gray-50 rounded text-xs text-gray-700">
                <p className="font-medium mb-0.5">Entry 2 — Auto-reverse outstanding unrealised:</p>
                <p className="font-mono">All prior unrealised entries on this invoice → reversed to zero</p>
                <p className="text-gray-500 mt-0.5">Posted back to the same GL the unrealised was originally posted to.</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Net P&amp;L impact always equals actual NGN paid minus original NGN booked.
              The settlement rate (actual NGN ÷ FCY) is captured on the payment transaction.
              Bank advice upload is recommended for audit trail purposes.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => save({ revaluation_rules: config.revaluation_rules })}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save revaluation rules"}
            </button>
            {saved && <span className="text-sm text-green-600">✓ Saved</span>}
          </div>
        </div>
      )}

      {/* ── BDC REGISTER TAB ── */}
      {tab === "bdc_register" && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">
                Maintain a register of approved Bureau de Change (BDC) and FX dealers
                used to source and remit foreign currency on your behalf.
              </p>
              <p className="text-xs text-gray-400">
                BDC entries are referenced when processing FX payments through intermediaries
                in the Accounts Payable module. Each BDC is a special entity type —
                separate from regular vendors.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddBdc(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 flex-shrink-0"
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add BDC
            </button>
          </div>

          {showAddBdc && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-medium text-gray-700 mb-3">New BDC / FX dealer</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">BDC name *</label>
                  <input
                    type="text"
                    value={newBdcName}
                    onChange={(e) => setNewBdcName(e.target.value)}
                    placeholder="e.g. Rubicon BDC Limited"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">RC number</label>
                  <input
                    type="text"
                    value={newBdcRc}
                    onChange={(e) => setNewBdcRc(e.target.value)}
                    placeholder="e.g. RC1234567"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CBN licence number</label>
                  <input
                    type="text"
                    value={newBdcCbn}
                    onChange={(e) => setNewBdcCbn(e.target.value)}
                    placeholder="CBN BDC licence"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact name</label>
                  <input
                    type="text"
                    value={newBdcContact}
                    onChange={(e) => setNewBdcContact(e.target.value)}
                    placeholder="Primary contact"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact phone</label>
                  <input
                    type="text"
                    value={newBdcPhone}
                    onChange={(e) => setNewBdcPhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact email</label>
                  <input
                    type="email"
                    value={newBdcEmail}
                    onChange={(e) => setNewBdcEmail(e.target.value)}
                    placeholder="email@bdc.com"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">WHT rate on service fee (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={newBdcWht}
                    onChange={(e) => setNewBdcWht(e.target.value)}
                    placeholder="5"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied to BDC service fee only — not the FX principal.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addBdc}
                  disabled={addingBdc || !newBdcName.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingBdc ? "Saving…" : "Add BDC"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBdc(false)}
                  className="px-4 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {((config as any).bdc_register ?? []).length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <i className="ti ti-building-bank text-gray-300" style={{ fontSize: 32 }} />
              <p className="text-sm text-gray-500 mt-2">No BDCs registered yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Add the BDCs and FX dealers your organisation uses to source foreign currency.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">RC Number</th>
                    <th className="px-3 py-2 text-left">CBN Licence</th>
                    <th className="px-3 py-2 text-left">Contact</th>
                    <th className="px-3 py-2 text-left">WHT on fee</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {((config as any).bdc_register ?? []).map((bdc: BdcEntry) => (
                    <tr key={bdc.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{bdc.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{bdc.rc_number ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{bdc.cbn_licence ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {bdc.contact_name ?? "—"}
                        {bdc.contact_phone && (
                          <span className="block text-gray-400">{bdc.contact_phone}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{bdc.wht_category ?? "5"}%</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            bdc.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {bdc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = ((config as any).bdc_register ?? []).map(
                              (b: BdcEntry) =>
                                b.id === bdc.id ? { ...b, is_active: !b.is_active } : b
                            );
                            save({ bdc_register: updated } as any);
                            setConfig((c) => ({ ...c, bdc_register: updated } as any));
                          }}
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          {bdc.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <i
              className="ti ti-info-circle text-blue-600 flex-shrink-0 mt-0.5"
              style={{ fontSize: 13 }}
            />
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-0.5">BDC payment flow</p>
              <p>When paying a foreign currency AP invoice through a BDC:</p>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li>A BDC clearing account is used — nets to zero per transaction</li>
                <li>The BDC rate (from receipt) is the settlement rate for realised FX</li>
                <li>BDC service fee and bank charges are expensed separately per receipt lines</li>
                <li>WHT on service fee deducted at the rate configured above</li>
                <li>WHT on the original FCY invoice recognised at payment (per your WHT policy)</li>
                <li>FCY WHT payable to FIRS tracked independently until remittance</li>
              </ul>
              <p className="mt-1">Full BDC payment workflow is configured in Accounts Payable (M11).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
