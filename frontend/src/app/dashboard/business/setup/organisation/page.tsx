"use client";

/**
 * Organisation page — M8.2 Implementation Portal.
 *
 * 4 tabs: Identity | Structure | Branding | Fiscal year
 * Editable by consultant (full override) and Power Admin (unlocked fields).
 *
 * Route: /dashboard/business/setup/organisation
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

type Tab = "identity" | "structure" | "branding" | "fiscal";

interface OrgConfig {
  tenant_id: string;
  legal_name?: string;
  rc_number?: string;
  industry?: string;
  functional_currency?: string;
  reporting_currency?: string;
  country?: string;
  group_structure?: string;
  parent_company_name?: string;
  tin?: string;
  vat_reg_number?: string;
  fiscal_year_start_month?: number;
  fiscal_year_start_day?: number;
  period_frequency?: string;
  org_structure?: Record<string, unknown>;
  branding?: { logo_url?: string; primary_colour?: string; button_style?: string };
}

const INDUSTRIES = [
  "FMCG/Consumer Goods", "Manufacturing", "Logistics/3PL", "Professional Services",
  "Healthcare", "Telecommunications", "Banking/Finance", "NGO/Public Sector",
  "Technology", "Construction/Engineering", "Hospitality", "Multinational", "Other",
];

const GROUP_STRUCTURES = ["Standalone", "Subsidiary", "Parent/Holding", "Branch"];
const PERIOD_FREQS = ["Monthly", "Quarterly", "Annual"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function TabBtn({
  tab,
  active,
  onClick,
  label,
}: {
  tab: Tab;
  active: boolean;
  onClick: (t: Tab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const selectCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function OrganisationPage() {
  const { user, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("identity");
  const [config, setConfig] = useState<OrgConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<OrgConfig>("/api/setup/org", { token: accessToken })
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, [accessToken]);

  const set = (field: keyof OrgConfig, value: unknown) =>
    setConfig((prev) => (prev ? { ...prev, [field]: value } : prev));

  const setBranding = (key: string, value: string) =>
    setConfig((prev) =>
      prev ? { ...prev, branding: { ...(prev.branding ?? {}), [key]: value } } : prev
    );

  const save = async () => {
    if (!accessToken || !config) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<OrgConfig>("/api/setup/org", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify(config),
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="p-8 text-sm text-gray-500">
        {error ? `Error: ${error}` : "Loading…"}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Organisation</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure your company identity, structure, branding, and fiscal year.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn tab="identity"  active={activeTab === "identity"}  onClick={setActiveTab} label="Identity" />
        <TabBtn tab="structure" active={activeTab === "structure"} onClick={setActiveTab} label="Structure" />
        <TabBtn tab="branding"  active={activeTab === "branding"}  onClick={setActiveTab} label="Branding" />
        <TabBtn tab="fiscal"    active={activeTab === "fiscal"}    onClick={setActiveTab} label="Fiscal year" />
      </div>

      {/* ── Identity tab ── */}
      {activeTab === "identity" && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Legal name *">
            <input
              className={inputCls}
              value={config.legal_name ?? ""}
              onChange={(e) => set("legal_name", e.target.value)}
            />
          </Field>
          <Field label="RC / Company registration number">
            <input
              className={inputCls}
              value={config.rc_number ?? ""}
              onChange={(e) => set("rc_number", e.target.value)}
            />
          </Field>
          <Field label="Industry">
            <select
              className={selectCls}
              value={config.industry ?? ""}
              onChange={(e) => set("industry", e.target.value)}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Functional currency *">
            <input
              className={inputCls}
              placeholder="e.g. NGN, USD, GBP"
              value={config.functional_currency ?? ""}
              onChange={(e) => set("functional_currency", e.target.value.toUpperCase())}
              maxLength={3}
            />
          </Field>
          <Field label="Reporting currency (optional)">
            <input
              className={inputCls}
              placeholder="e.g. USD"
              value={config.reporting_currency ?? ""}
              onChange={(e) => set("reporting_currency", e.target.value.toUpperCase())}
              maxLength={3}
            />
          </Field>
          <Field label="Country / Jurisdiction">
            <input
              className={inputCls}
              value={config.country ?? ""}
              onChange={(e) => set("country", e.target.value)}
            />
          </Field>
          <Field label="Group structure">
            <select
              className={selectCls}
              value={config.group_structure ?? ""}
              onChange={(e) => set("group_structure", e.target.value)}
            >
              <option value="">Select structure</option>
              {GROUP_STRUCTURES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          {(config.group_structure === "Subsidiary" || config.group_structure === "Branch") && (
            <Field label="Parent company name">
              <input
                className={inputCls}
                value={config.parent_company_name ?? ""}
                onChange={(e) => set("parent_company_name", e.target.value)}
              />
            </Field>
          )}
          <Field label="Tax identification number (TIN)">
            <input
              className={inputCls}
              value={config.tin ?? ""}
              onChange={(e) => set("tin", e.target.value)}
            />
          </Field>
          <Field label="VAT registration number (optional)">
            <input
              className={inputCls}
              value={config.vat_reg_number ?? ""}
              onChange={(e) => set("vat_reg_number", e.target.value)}
            />
          </Field>
        </div>
      )}

      {/* ── Structure tab ── */}
      {activeTab === "structure" && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Org structure is locked after go-live. Contact your Ziva BI consultant to restructure.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              + Add node
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Download template
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Upload structure
            </button>
          </div>
          {config.org_structure ? (
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-64">
              {JSON.stringify(config.org_structure, null, 2)}
            </pre>
          ) : (
            <div className="p-8 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
              No org structure uploaded yet. Download the template to get started.
            </div>
          )}
        </div>
      )}

      {/* ── Branding tab ── */}
      {activeTab === "branding" && (
        <div className="space-y-4 max-w-md">
          <Field label="Company logo">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500">
              <p className="mb-2">Drag and drop PNG, SVG, or JPG (max 2 MB)</p>
              <button
                type="button"
                className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium hover:bg-gray-50"
              >
                Browse file
              </button>
              {config.branding?.logo_url && (
                <p className="mt-2 text-xs text-blue-600 truncate">{config.branding.logo_url}</p>
              )}
            </div>
          </Field>
          <Field label="Primary colour">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-9 border border-gray-300 rounded cursor-pointer"
                value={config.branding?.primary_colour ?? "#1d4ed8"}
                onChange={(e) => setBranding("primary_colour", e.target.value)}
              />
              <input
                className={`${inputCls} flex-1`}
                value={config.branding?.primary_colour ?? ""}
                onChange={(e) => setBranding("primary_colour", e.target.value)}
                placeholder="#1d4ed8"
              />
            </div>
          </Field>
          <Field label="Button style">
            <select
              className={selectCls}
              value={config.branding?.button_style ?? "Rounded"}
              onChange={(e) => setBranding("button_style", e.target.value)}
            >
              <option>Rounded</option>
              <option>Square</option>
            </select>
          </Field>
          {/* Preview */}
          <div className="p-4 border border-gray-200 rounded-lg bg-white">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Preview</p>
            <div
              className="px-4 py-2 text-sm text-white font-medium inline-block"
              style={{
                backgroundColor: config.branding?.primary_colour ?? "#1d4ed8",
                borderRadius: config.branding?.button_style === "Square" ? "4px" : "8px",
              }}
            >
              {config.legal_name || "Company Name"}
            </div>
          </div>
        </div>
      )}

      {/* ── Fiscal year tab ── */}
      {activeTab === "fiscal" && (
        <div className="space-y-4 max-w-md">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fiscal year start month">
              <select
                className={selectCls}
                value={config.fiscal_year_start_month ?? ""}
                onChange={(e) => set("fiscal_year_start_month", parseInt(e.target.value))}
              >
                <option value="">Select month</option>
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Fiscal year start day">
              <input
                type="number"
                min={1}
                max={31}
                className={inputCls}
                value={config.fiscal_year_start_day ?? ""}
                onChange={(e) => set("fiscal_year_start_day", parseInt(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Period closing frequency">
            <select
              className={selectCls}
              value={config.period_frequency ?? ""}
              onChange={(e) => set("period_frequency", e.target.value)}
            >
              <option value="">Select frequency</option>
              {PERIOD_FREQS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </Field>
          {config.fiscal_year_start_month && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              Fiscal year: {MONTHS[(config.fiscal_year_start_month - 1)]} {config.fiscal_year_start_day ?? 1} →{" "}
              {MONTHS[(config.fiscal_year_start_month - 2 + 12) % 12]}{" "}
              {config.fiscal_year_start_day
                ? new Date(2025, config.fiscal_year_start_month - 1, config.fiscal_year_start_day - 1).getDate()
                : 31}
            </div>
          )}
        </div>
      )}

      {/* Save controls */}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
