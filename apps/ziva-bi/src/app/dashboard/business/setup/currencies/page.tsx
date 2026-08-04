"use client";

/**
 * Currencies & FX Rates — dedicated tables version (FX milestone + FX-b).
 * Tabs: Enabled Currencies | FX Rates | Rate Lookup | Revaluation Rules | BDC Register
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

type Tab = "currencies" | "rates" | "lookup" | "revaluation" | "bdc";

interface TenantCurrency {
  id: string;
  currency: string;
  is_functional: boolean;
  is_reporting: boolean;
  is_enabled: boolean;
  created_at: string;
}

interface FxRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_type: string;
  effective_date: string;
  source: string;
}

interface LookupResult {
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_type: string;
  effective_date: string;
  is_inverse: boolean;
}

interface RevRule {
  id: string;
  account_type: string;
  rate_type: string;
  gain_account_id: string | null;
  loss_account_id: string | null;
  is_active: boolean;
  updated_at: string;
}

interface BdcEntry {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  quote_date: string;
  bdc_name: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

const RATE_TYPES = ["SPOT", "CLOSING", "AVERAGE", "BUDGET"];

const ACCOUNT_TYPES = [
  "MONETARY_ASSET",
  "MONETARY_LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

const TAB_LABELS: Record<Tab, string> = {
  currencies: "Enabled Currencies",
  rates: "FX Rates",
  lookup: "Rate Lookup",
  revaluation: "Revaluation Rules",
  bdc: "BDC Register",
};

export default function CurrenciesPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("currencies");

  // ── Currencies ──────────────────────────────────────────────────────────────
  const [currencies, setCurrencies] = useState<TenantCurrency[]>([]);
  const [currLoading, setCurrLoading] = useState(true);
  const [currForm, setCurrForm] = useState({ currency: "", is_functional: false, is_reporting: false });
  const [currSaving, setCurrSaving] = useState(false);
  const [currError, setCurrError] = useState("");

  // ── FX Rates ────────────────────────────────────────────────────────────────
  const [rates, setRates] = useState<FxRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateForm, setRateForm] = useState({
    from_currency: "", to_currency: "", rate: "", rate_type: "SPOT",
    effective_date: new Date().toISOString().slice(0, 10),
  });
  const [rateSaving, setRateSaving] = useState(false);

  // ── Lookup ──────────────────────────────────────────────────────────────────
  const [lookup, setLookup] = useState({ from: "", to: "", date: new Date().toISOString().slice(0, 10), rate_type: "SPOT" });
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // ── Revaluation Rules ───────────────────────────────────────────────────────
  const [revRules, setRevRules] = useState<RevRule[]>([]);
  const [revLoading, setRevLoading] = useState(false);
  const [revForm, setRevForm] = useState({
    account_type: ACCOUNT_TYPES[0],
    rate_type: "CLOSING",
    gain_account_id: "",
    loss_account_id: "",
    is_active: true,
  });
  const [revSaving, setRevSaving] = useState(false);
  const [revError, setRevError] = useState("");

  // ── BDC Register ────────────────────────────────────────────────────────────
  const [bdcEntries, setBdcEntries] = useState<BdcEntry[]>([]);
  const [bdcLoading, setBdcLoading] = useState(false);
  const [bdcForm, setBdcForm] = useState({
    from_currency: "", to_currency: "", rate: "",
    quote_date: new Date().toISOString().slice(0, 10),
    bdc_name: "", reference: "", notes: "",
  });
  const [bdcSaving, setBdcSaving] = useState(false);
  const [bdcError, setBdcError] = useState("");

  // ── Data fetches ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<TenantCurrency[]>("/api/fx/currencies", { token: accessToken })
      .then(setCurrencies)
      .finally(() => setCurrLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || tab !== "rates") return;
    setRatesLoading(true);
    apiFetch<FxRate[]>("/api/fx/rates", { token: accessToken })
      .then(setRates)
      .finally(() => setRatesLoading(false));
  }, [accessToken, tab]);

  useEffect(() => {
    if (!accessToken || tab !== "revaluation") return;
    setRevLoading(true);
    apiFetch<RevRule[]>("/api/fx/revaluation-rules", { token: accessToken })
      .then(setRevRules)
      .finally(() => setRevLoading(false));
  }, [accessToken, tab]);

  useEffect(() => {
    if (!accessToken || tab !== "bdc") return;
    setBdcLoading(true);
    apiFetch<BdcEntry[]>("/api/fx/bdc", { token: accessToken })
      .then(setBdcEntries)
      .finally(() => setBdcLoading(false));
  }, [accessToken, tab]);

  // ── Currencies handlers ───────────────────────────────────────────────────
  const addCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setCurrSaving(true);
    setCurrError("");
    try {
      const created = await apiFetch<TenantCurrency>("/api/fx/currencies", {
        token: accessToken,
        method: "POST",
        body: { ...currForm, currency: currForm.currency.toUpperCase(), is_enabled: true },
      });
      setCurrencies([...currencies, created]);
      setCurrForm({ currency: "", is_functional: false, is_reporting: false });
    } catch (err: unknown) {
      setCurrError((err as Error).message || "Failed to add currency.");
    } finally {
      setCurrSaving(false);
    }
  };

  const deleteCurrency = async (id: string) => {
    if (!accessToken || !confirm("Remove this currency?")) return;
    try {
      await apiFetch(`/api/fx/currencies/${id}`, { token: accessToken, method: "DELETE" });
      setCurrencies(currencies.filter((c) => c.id !== id));
    } catch (err: unknown) {
      alert((err as Error).message || "Cannot delete functional or reporting currency.");
    }
  };

  // ── Rate handlers ──────────────────────────────────────────────────────────
  const upsertRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setRateSaving(true);
    try {
      const created = await apiFetch<FxRate>("/api/fx/rates", {
        token: accessToken,
        method: "POST",
        body: {
          ...rateForm,
          from_currency: rateForm.from_currency.toUpperCase(),
          to_currency: rateForm.to_currency.toUpperCase(),
          rate: parseFloat(rateForm.rate),
        },
      });
      setRates((prev) => {
        const others = prev.filter((r) =>
          !(r.from_currency === created.from_currency && r.to_currency === created.to_currency &&
            r.effective_date === created.effective_date && r.rate_type === created.rate_type)
        );
        return [created, ...others];
      });
      setRateForm({ ...rateForm, rate: "" });
    } catch {
      alert("Failed to save rate.");
    } finally {
      setRateSaving(false);
    }
  };

  const deleteRate = async (id: string) => {
    if (!accessToken || !confirm("Delete this rate?")) return;
    try {
      await apiFetch(`/api/fx/rates/${id}`, { token: accessToken, method: "DELETE" });
      setRates(rates.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete rate.");
    }
  };

  // ── Lookup handler ────────────────────────────────────────────────────────
  const lookupRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const params = new URLSearchParams({
        from_currency: lookup.from.toUpperCase(),
        to_currency: lookup.to.toUpperCase(),
        effective_date: lookup.date,
        rate_type: lookup.rate_type,
      });
      const result = await apiFetch<LookupResult>(`/api/fx/rates/lookup?${params}`, { token: accessToken });
      setLookupResult(result);
    } catch {
      setLookupError("No rate found for this currency pair on or before this date.");
    } finally {
      setLookupLoading(false);
    }
  };

  // ── Revaluation handlers ──────────────────────────────────────────────────
  const createRevRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setRevSaving(true);
    setRevError("");
    try {
      const body: Record<string, unknown> = {
        account_type: revForm.account_type,
        rate_type: revForm.rate_type,
        is_active: revForm.is_active,
      };
      if (revForm.gain_account_id.trim()) body.gain_account_id = revForm.gain_account_id.trim();
      if (revForm.loss_account_id.trim()) body.loss_account_id = revForm.loss_account_id.trim();

      const created = await apiFetch<RevRule>("/api/fx/revaluation-rules", {
        token: accessToken,
        method: "POST",
        body,
      });
      setRevRules([...revRules, created]);
      setRevForm({ account_type: ACCOUNT_TYPES[0], rate_type: "CLOSING", gain_account_id: "", loss_account_id: "", is_active: true });
    } catch (err: unknown) {
      setRevError((err as Error).message || "Failed to create revaluation rule.");
    } finally {
      setRevSaving(false);
    }
  };

  const toggleRevRule = async (rule: RevRule) => {
    if (!accessToken) return;
    try {
      const updated = await apiFetch<RevRule>(`/api/fx/revaluation-rules/${rule.id}`, {
        token: accessToken,
        method: "PATCH",
        body: { is_active: !rule.is_active },
      });
      setRevRules(revRules.map((r) => (r.id === rule.id ? updated : r)));
    } catch {
      alert("Failed to update rule.");
    }
  };

  const deleteRevRule = async (id: string) => {
    if (!accessToken || !confirm("Delete this revaluation rule?")) return;
    try {
      await apiFetch(`/api/fx/revaluation-rules/${id}`, { token: accessToken, method: "DELETE" });
      setRevRules(revRules.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete rule.");
    }
  };

  // ── BDC handlers ──────────────────────────────────────────────────────────
  const createBdcEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setBdcSaving(true);
    setBdcError("");
    try {
      const body: Record<string, unknown> = {
        from_currency: bdcForm.from_currency.toUpperCase(),
        to_currency: bdcForm.to_currency.toUpperCase(),
        rate: parseFloat(bdcForm.rate),
        quote_date: bdcForm.quote_date,
      };
      if (bdcForm.bdc_name.trim()) body.bdc_name = bdcForm.bdc_name.trim();
      if (bdcForm.reference.trim()) body.reference = bdcForm.reference.trim();
      if (bdcForm.notes.trim()) body.notes = bdcForm.notes.trim();

      const created = await apiFetch<BdcEntry>("/api/fx/bdc", {
        token: accessToken,
        method: "POST",
        body,
      });
      setBdcEntries([created, ...bdcEntries]);
      setBdcForm({ from_currency: "", to_currency: "", rate: "", quote_date: new Date().toISOString().slice(0, 10), bdc_name: "", reference: "", notes: "" });
    } catch (err: unknown) {
      setBdcError((err as Error).message || "Failed to record BDC entry.");
    } finally {
      setBdcSaving(false);
    }
  };

  const deleteBdcEntry = async (id: string) => {
    if (!accessToken || !confirm("Delete this BDC entry?")) return;
    try {
      await apiFetch(`/api/fx/bdc/${id}`, { token: accessToken, method: "DELETE" });
      setBdcEntries(bdcEntries.filter((e) => e.id !== id));
    } catch {
      alert("Failed to delete BDC entry.");
    }
  };

  return (
    <PageContainer>
      <PageHeading
        title="Currencies & FX Rates"
        subtitle="Manage enabled currencies, exchange rates, revaluation rules, and BDC quotes"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {(["currencies", "rates", "lookup", "revaluation", "bdc"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition ${tab === t ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Currencies Tab ── */}
      {tab === "currencies" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-medium text-gray-800 mb-3">Enable Currency</h3>
            {currError && <p className="text-red-600 text-sm mb-3">{currError}</p>}
            <form onSubmit={addCurrency} className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="label">Currency Code *</label>
                <input
                  className="input w-24"
                  value={currForm.currency}
                  onChange={(e) => setCurrForm({ ...currForm, currency: e.target.value })}
                  required maxLength={3} placeholder="USD"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={currForm.is_functional} onChange={(e) => setCurrForm({ ...currForm, is_functional: e.target.checked })} />
                Functional
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={currForm.is_reporting} onChange={(e) => setCurrForm({ ...currForm, is_reporting: e.target.checked })} />
                Reporting
              </label>
              <button type="submit" disabled={currSaving} className="btn-primary">
                {currSaving ? "Saving…" : "Enable"}
              </button>
            </form>
          </div>

          {currLoading && <p className="text-gray-400 py-4 text-center">Loading…</p>}
          {!currLoading && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Currency</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Functional</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Reporting</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currencies.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-bold text-lg">{c.currency}</td>
                      <td className="px-4 py-3 text-center">{c.is_functional ? "✓" : "—"}</td>
                      <td className="px-4 py-3 text-center">{c.is_reporting ? "✓" : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_enabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {c.is_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!c.is_functional && !c.is_reporting && (
                          <button onClick={() => deleteCurrency(c.id)} className="text-xs text-red-500 hover:underline">Remove</button>
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

      {/* ── Rates Tab ── */}
      {tab === "rates" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-medium text-gray-800 mb-3">Add / Update Rate</h3>
            <form onSubmit={upsertRate} className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">From *</label>
                <input className="input" value={rateForm.from_currency} onChange={(e) => setRateForm({ ...rateForm, from_currency: e.target.value })} required maxLength={3} placeholder="NGN" />
              </div>
              <div>
                <label className="label">To *</label>
                <input className="input" value={rateForm.to_currency} onChange={(e) => setRateForm({ ...rateForm, to_currency: e.target.value })} required maxLength={3} placeholder="USD" />
              </div>
              <div>
                <label className="label">Rate *</label>
                <input type="number" step="any" min="0.000001" className="input" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} required placeholder="1550.00" />
              </div>
              <div>
                <label className="label">Rate Type</label>
                <select className="input" value={rateForm.rate_type} onChange={(e) => setRateForm({ ...rateForm, rate_type: e.target.value })}>
                  {RATE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Effective Date *</label>
                <input type="date" className="input" value={rateForm.effective_date} onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })} required />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={rateSaving} className="btn-primary w-full">
                  {rateSaving ? "Saving…" : "Save Rate"}
                </button>
              </div>
            </form>
          </div>

          {ratesLoading && <p className="text-gray-400 py-4 text-center">Loading…</p>}
          {!ratesLoading && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">From</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">To</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Rate</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 font-bold text-xs">{r.from_currency}</td>
                      <td className="px-4 py-2.5 font-bold text-xs">{r.to_currency}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{Number(r.rate).toFixed(6)}</td>
                      <td className="px-4 py-2.5"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{r.rate_type}</span></td>
                      <td className="px-4 py-2.5 text-gray-500">{r.effective_date}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{r.source}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => deleteRate(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Lookup Tab ── */}
      {tab === "lookup" && (
        <div className="max-w-lg space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-medium text-gray-800 mb-3">Rate Lookup</h3>
            <form onSubmit={lookupRate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">From *</label>
                  <input className="input" value={lookup.from} onChange={(e) => setLookup({ ...lookup, from: e.target.value })} maxLength={3} placeholder="NGN" required />
                </div>
                <div>
                  <label className="label">To *</label>
                  <input className="input" value={lookup.to} onChange={(e) => setLookup({ ...lookup, to: e.target.value })} maxLength={3} placeholder="USD" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" value={lookup.date} onChange={(e) => setLookup({ ...lookup, date: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Rate Type</label>
                  <select className="input" value={lookup.rate_type} onChange={(e) => setLookup({ ...lookup, rate_type: e.target.value })}>
                    {RATE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={lookupLoading} className="btn-primary w-full">
                {lookupLoading ? "Looking up…" : "Look Up Rate"}
              </button>
            </form>
          </div>

          {lookupError && <p className="text-red-600 text-sm">{lookupError}</p>}

          {lookupResult && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
              {lookupResult.is_inverse && (
                <p className="text-xs text-orange-600 mb-2">⚠ Inverse rate applied (direct rate not found)</p>
              )}
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{lookupResult.from_currency} → {lookupResult.to_currency}</p>
                  <p className="text-3xl font-bold text-indigo-700">{Number(lookupResult.rate).toFixed(6)}</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p>{lookupResult.rate_type}</p>
                  <p>{lookupResult.effective_date}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Revaluation Rules Tab ── */}
      {tab === "revaluation" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-medium text-gray-800 mb-1">Add Revaluation Rule</h3>
            <p className="text-xs text-gray-500 mb-4">
              Define which FX rate to use when revaluing monetary items at period-end, and which GL accounts to use for gains and losses.
            </p>
            {revError && <p className="text-red-600 text-sm mb-3">{revError}</p>}
            <form onSubmit={createRevRule} className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Account Type *</label>
                <select className="input" value={revForm.account_type} onChange={(e) => setRevForm({ ...revForm, account_type: e.target.value })}>
                  {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Rate Type</label>
                <select className="input" value={revForm.rate_type} onChange={(e) => setRevForm({ ...revForm, rate_type: e.target.value })}>
                  {RATE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Gain Account ID (optional)</label>
                <input className="input font-mono text-xs" value={revForm.gain_account_id} onChange={(e) => setRevForm({ ...revForm, gain_account_id: e.target.value })} placeholder="UUID of FX gain GL account" />
              </div>
              <div>
                <label className="label">Loss Account ID (optional)</label>
                <input className="input font-mono text-xs" value={revForm.loss_account_id} onChange={(e) => setRevForm({ ...revForm, loss_account_id: e.target.value })} placeholder="UUID of FX loss GL account" />
              </div>
              <div className="flex items-end gap-3 col-span-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={revForm.is_active} onChange={(e) => setRevForm({ ...revForm, is_active: e.target.checked })} />
                  Active
                </label>
                <button type="submit" disabled={revSaving} className="btn-primary">
                  {revSaving ? "Saving…" : "Add Rule"}
                </button>
              </div>
            </form>
          </div>

          {revLoading && <p className="text-gray-400 py-4 text-center">Loading…</p>}
          {!revLoading && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Account Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Rate Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Gain Account</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Loss Account</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revRules.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">No revaluation rules yet</td></tr>
                  )}
                  {revRules.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-sm">{r.account_type}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{r.rate_type}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.gain_account_id ? r.gain_account_id.slice(0, 8) + "…" : "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.loss_account_id ? r.loss_account_id.slice(0, 8) + "…" : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleRevRule(r)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition ${r.is_active ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                        >
                          {r.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteRevRule(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BDC Register Tab ── */}
      {tab === "bdc" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-medium text-gray-800 mb-1">Record BDC Rate</h3>
            <p className="text-xs text-gray-500 mb-4">
              Log parallel-market or Bureau de Change rate quotes for disclosure and reconciliation against official rates.
            </p>
            {bdcError && <p className="text-red-600 text-sm mb-3">{bdcError}</p>}
            <form onSubmit={createBdcEntry} className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">From *</label>
                <input className="input" value={bdcForm.from_currency} onChange={(e) => setBdcForm({ ...bdcForm, from_currency: e.target.value })} required maxLength={3} placeholder="NGN" />
              </div>
              <div>
                <label className="label">To *</label>
                <input className="input" value={bdcForm.to_currency} onChange={(e) => setBdcForm({ ...bdcForm, to_currency: e.target.value })} required maxLength={3} placeholder="USD" />
              </div>
              <div>
                <label className="label">BDC Rate *</label>
                <input type="number" step="any" min="0.000001" className="input" value={bdcForm.rate} onChange={(e) => setBdcForm({ ...bdcForm, rate: e.target.value })} required placeholder="1600.00" />
              </div>
              <div>
                <label className="label">Quote Date *</label>
                <input type="date" className="input" value={bdcForm.quote_date} onChange={(e) => setBdcForm({ ...bdcForm, quote_date: e.target.value })} required />
              </div>
              <div>
                <label className="label">BDC Name</label>
                <input className="input" value={bdcForm.bdc_name} onChange={(e) => setBdcForm({ ...bdcForm, bdc_name: e.target.value })} placeholder="e.g. ABC Bureau de Change" />
              </div>
              <div>
                <label className="label">Reference</label>
                <input className="input" value={bdcForm.reference} onChange={(e) => setBdcForm({ ...bdcForm, reference: e.target.value })} placeholder="Internal ref or receipt no." />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <input className="input" value={bdcForm.notes} onChange={(e) => setBdcForm({ ...bdcForm, notes: e.target.value })} placeholder="Optional notes" />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={bdcSaving} className="btn-primary w-full">
                  {bdcSaving ? "Saving…" : "Record"}
                </button>
              </div>
            </form>
          </div>

          {bdcLoading && <p className="text-gray-400 py-4 text-center">Loading…</p>}
          {!bdcLoading && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Pair</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Rate</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">BDC</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bdcEntries.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No BDC entries yet</td></tr>
                  )}
                  {bdcEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2.5 font-bold text-xs">{e.from_currency}/{e.to_currency}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{Number(e.rate).toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{e.quote_date}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.bdc_name || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{e.reference || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 max-w-xs truncate">{e.notes || "—"}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => deleteBdcEntry(e.id)} className="text-xs text-red-500 hover:underline">Delete</button>
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
