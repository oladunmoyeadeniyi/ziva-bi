"use client";

/**
 * Tax & Statutory page — M8.2 Implementation Portal.
 *
 * 4 tabs: VAT | WHT | PAYE | Other statutory
 *
 * Route: /dashboard/business/setup/tax
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

type Tab = "vat" | "wht" | "paye" | "other";

interface VatConfig {
  vat_registered?: boolean;
  standard_rate?: number;
  vat_gl?: string;
  input_vat_gl?: string;
  reverse_vat?: boolean;
  self_account_vat?: boolean;
  categories?: { name: string; rate: number; applies_to: string; effective_from: string; status: string }[];
}

interface WhtConfig {
  categories?: { vendor_category: string; rate: number; gl_account: string; applies_to: string; effective_from: string }[];
  non_resident_rate?: number;
  wht_gl?: string;
}

interface PayeConfig {
  bands?: { income_from: number; income_to: number; rate: number; effective_from: string }[];
  employee_pension_rate?: number;
  employer_pension_rate?: number;
  employee_pension_gl?: string;
  employer_pension_gl?: string;
  nhf_rate?: number;
  nsitf_rate?: number;
}

interface OtherStatutory {
  levies?: { name: string; rate: number; base: string; gl_account: string; effective_from: string }[];
}

interface TaxConfig {
  vat_config?: VatConfig;
  wht_config?: WhtConfig;
  paye_config?: PayeConfig;
  other_statutory?: OtherStatutory;
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

export default function TaxPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("vat");
  const [config, setConfig] = useState<TaxConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<TaxConfig>("/api/setup/tax", { token: accessToken })
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, [accessToken]);

  const save = async (patch: Partial<TaxConfig>) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<TaxConfig>("/api/setup/tax", {
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

  const setVat = (key: keyof VatConfig, val: unknown) =>
    setConfig((c) => ({ ...c, vat_config: { ...(c.vat_config ?? {}), [key]: val } }));

  const setWht = (key: keyof WhtConfig, val: unknown) =>
    setConfig((c) => ({ ...c, wht_config: { ...(c.wht_config ?? {}), [key]: val } }));

  const setPaye = (key: keyof PayeConfig, val: unknown) =>
    setConfig((c) => ({ ...c, paye_config: { ...(c.paye_config ?? {}), [key]: val } }));

  const SaveBtn = ({ patch }: { patch: Partial<TaxConfig> }) => (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={() => save(patch)}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {saved && <span className="text-sm text-green-600">Saved</span>}
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Tax & statutory</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure VAT, WHT, PAYE, and other statutory levies for this tenant.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="vat"   active={tab === "vat"}   onClick={setTab} label="VAT" />
        <TabBtn id="wht"   active={tab === "wht"}   onClick={setTab} label="WHT" />
        <TabBtn id="paye"  active={tab === "paye"}  onClick={setTab} label="PAYE" />
        <TabBtn id="other" active={tab === "other"} onClick={setTab} label="Other statutory" />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* ── VAT tab ── */}
      {tab === "vat" && (
        <div className="space-y-4 max-w-md">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="vat_reg"
              checked={config.vat_config?.vat_registered ?? false}
              onChange={(e) => setVat("vat_registered", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="vat_reg" className="text-sm font-medium text-gray-700">
              VAT registered
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Standard VAT rate (%)</label>
            <input
              type="number"
              className={inputCls}
              min={0}
              max={100}
              step={0.01}
              value={config.vat_config?.standard_rate ?? ""}
              onChange={(e) => setVat("standard_rate", parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT GL account</label>
            <input
              className={inputCls}
              placeholder="GL number"
              value={config.vat_config?.vat_gl ?? ""}
              onChange={(e) => setVat("vat_gl", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Input VAT GL account</label>
            <input
              className={inputCls}
              placeholder="GL number"
              value={config.vat_config?.input_vat_gl ?? ""}
              onChange={(e) => setVat("input_vat_gl", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="reverse_vat"
              checked={config.vat_config?.reverse_vat ?? false}
              onChange={(e) => setVat("reverse_vat", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="reverse_vat" className="text-sm text-gray-700">Reverse VAT (applicable vendors)</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="self_vat"
              checked={config.vat_config?.self_account_vat ?? false}
              onChange={(e) => setVat("self_account_vat", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="self_vat" className="text-sm text-gray-700">Self-account VAT</label>
          </div>
          <SaveBtn patch={{ vat_config: config.vat_config }} />
        </div>
      )}

      {/* ── WHT tab ── */}
      {tab === "wht" && (
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Non-resident WHT rate (%)</label>
            <input
              type="number"
              className={inputCls}
              min={0}
              max={100}
              step={0.01}
              value={config.wht_config?.non_resident_rate ?? ""}
              onChange={(e) => setWht("non_resident_rate", parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WHT GL account</label>
            <input
              className={inputCls}
              placeholder="GL number"
              value={config.wht_config?.wht_gl ?? ""}
              onChange={(e) => setWht("wht_gl", e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">WHT categories</p>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => {
                  const updated = [
                    ...(config.wht_config?.categories ?? []),
                    { vendor_category: "", rate: 0, gl_account: "", applies_to: "", effective_from: "" },
                  ];
                  setWht("categories", updated);
                }}
              >
                + Add WHT rule
              </button>
            </div>
            {(config.wht_config?.categories ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">No WHT rules configured.</p>
            ) : (
              <div className="space-y-2">
                {(config.wht_config?.categories ?? []).map((cat, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <input
                      className={inputCls}
                      placeholder="Vendor category"
                      value={cat.vendor_category}
                      onChange={(e) => {
                        const cats = [...(config.wht_config?.categories ?? [])];
                        cats[i] = { ...cats[i], vendor_category: e.target.value };
                        setWht("categories", cats);
                      }}
                    />
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="Rate %"
                      value={cat.rate}
                      onChange={(e) => {
                        const cats = [...(config.wht_config?.categories ?? [])];
                        cats[i] = { ...cats[i], rate: parseFloat(e.target.value) };
                        setWht("categories", cats);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <SaveBtn patch={{ wht_config: config.wht_config }} />
        </div>
      )}

      {/* ── PAYE tab ── */}
      {tab === "paye" && (
        <div className="space-y-4 max-w-md">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee pension rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.employee_pension_rate ?? ""}
                onChange={(e) => setPaye("employee_pension_rate", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employer pension rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.employer_pension_rate ?? ""}
                onChange={(e) => setPaye("employer_pension_rate", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee pension GL</label>
              <input
                className={inputCls}
                placeholder="GL number"
                value={config.paye_config?.employee_pension_gl ?? ""}
                onChange={(e) => setPaye("employee_pension_gl", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employer pension GL</label>
              <input
                className={inputCls}
                placeholder="GL number"
                value={config.paye_config?.employer_pension_gl ?? ""}
                onChange={(e) => setPaye("employer_pension_gl", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NHF rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.nhf_rate ?? ""}
                onChange={(e) => setPaye("nhf_rate", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NSITF rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.nsitf_rate ?? ""}
                onChange={(e) => setPaye("nsitf_rate", parseFloat(e.target.value))}
              />
            </div>
          </div>
          <SaveBtn patch={{ paye_config: config.paye_config }} />
        </div>
      )}

      {/* ── Other statutory tab ── */}
      {tab === "other" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Configure other statutory levies (Education tax, Police levy, NITDA levy, etc.)
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Statutory levies</p>
            <button
              type="button"
              onClick={() => {
                const levies = [
                  ...(config.other_statutory?.levies ?? []),
                  { name: "", rate: 0, base: "", gl_account: "", effective_from: "" },
                ];
                setConfig((c) => ({
                  ...c,
                  other_statutory: { levies },
                }));
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add levy
            </button>
          </div>
          {(config.other_statutory?.levies ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 italic">No levies configured.</p>
          ) : (
            <div className="space-y-2">
              {(config.other_statutory?.levies ?? []).map((levy, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <input
                    className={inputCls}
                    placeholder="Levy name"
                    value={levy.name}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], name: e.target.value };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="Rate %"
                    value={levy.rate}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], rate: parseFloat(e.target.value) };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                  <input
                    className={inputCls}
                    placeholder="Base"
                    value={levy.base}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], base: e.target.value };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                  <input
                    className={inputCls}
                    placeholder="GL account"
                    value={levy.gl_account}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], gl_account: e.target.value };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <SaveBtn patch={{ other_statutory: config.other_statutory }} />
        </div>
      )}
    </div>
  );
}
