"use client";

/**
 * Platform tenant list — /platform/tenants
 *
 * Lists all tenants with search, lifecycle, and environment filters.
 * SA can create a new company via the "Create Company" slide-over.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { MODULE_CATALOGUE } from "@/lib/modules";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  country: string;
  environment: string;
  parent_tenant_id: string | null;
  lifecycle_status: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

interface CreateTenantResponse {
  id: string;
  name: string;
  slug: string;
  country: string;
  environment: string;
  lifecycle_status: string;
  created_at: string;
  admin_user_id: string;
  admin_email: string;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const LIFECYCLE_CLS: Record<string, string> = {
  trial:             "bg-gray-100 text-gray-600",
  in_implementation: "bg-blue-100 text-blue-700",
  live:              "bg-green-100 text-green-700",
  suspended:         "bg-red-100 text-red-700",
};

const ENV_CLS: Record<string, string> = {
  live: "bg-blue-50 text-blue-600",
  test: "bg-amber-100 text-amber-700",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${map[value] ?? "bg-gray-100 text-gray-600"}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const COUNTRIES = [
  { code: "NG", name: "Nigeria" }, { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" }, { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" }, { code: "ZA", name: "South Africa" },
  { code: "GH", name: "Ghana" }, { code: "KE", name: "Kenya" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" }, { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" }, { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" }, { code: "JP", name: "Japan" },
  { code: "CN", name: "China" }, { code: "EG", name: "Egypt" },
  { code: "ET", name: "Ethiopia" }, { code: "RW", name: "Rwanda" },
].sort((a, b) => a.name.localeCompare(b.name));

const POSTING_MODES = [
  { value: "full_erp",   label: "Full ERP",   desc: "Complete double-entry GL and reporting" },
  { value: "connected",  label: "Connected",   desc: "Syncs with existing accounting software" },
  { value: "lite",       label: "Lite",        desc: "Approval and cost tracking only" },
];

// ── Create Company Modal ───────────────────────────────────────────────────────

function CreateCompanyModal({
  open,
  onClose,
  onCreated,
  token,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: CreateTenantResponse) => void;
  token: string | null;
}) {
  const [companyName,    setCompanyName]    = useState("");
  const [country,        setCountry]        = useState("NG");
  const [adminName,      setAdminName]      = useState("");
  const [adminEmail,     setAdminEmail]     = useState("");
  const [adminPassword,  setAdminPassword]  = useState("");
  const [postingMode,    setPostingMode]    = useState("full_erp");
  const [companySize,    setCompanySize]    = useState("");
  const [selModules,     setSelModules]     = useState<string[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");

  function toggleModule(key: string) {
    setSelModules((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  }

  function reset() {
    setCompanyName(""); setCountry("NG"); setAdminName(""); setAdminEmail("");
    setAdminPassword(""); setPostingMode("full_erp"); setCompanySize("");
    setSelModules([]); setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const result = await apiFetch<CreateTenantResponse>("/api/platform/tenants", {
        method: "POST",
        token: token ?? undefined,
        body: {
          company_name: companyName,
          company_country: country,
          admin_full_name: adminName,
          admin_email: adminEmail,
          admin_password: adminPassword,
          posting_mode: postingMode,
          company_size: companySize || undefined,
          initial_modules: selModules.length > 0 ? selModules : undefined,
        },
      });
      reset();
      onCreated(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create company.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Slide-over panel */}
      <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Create company</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Company</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company name *</label>
                <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  className={inputCls} placeholder="Acme Corporation" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <select required value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company size</label>
                <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} className={inputCls}>
                  <option value="">— optional —</option>
                  <option value="1-10">1–10 employees</option>
                  <option value="11-50">11–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="200+">200+ employees</option>
                </select>
              </div>
            </div>
          </div>

          {/* Admin account */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Admin account</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                <input required value={adminName} onChange={(e) => setAdminName(e.target.value)}
                  className={inputCls} placeholder="Jane Adeyemi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input required type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                  className={inputCls} placeholder="jane@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password *</label>
                <input required type="password" minLength={8} value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className={inputCls} placeholder="At least 8 characters" />
                <p className="text-xs text-gray-400 mt-1">Share this with the client — they should change it on first login.</p>
              </div>
            </div>
          </div>

          {/* Posting mode */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Posting mode *</p>
            <div className="space-y-2">
              {POSTING_MODES.map((m) => (
                <label key={m.value} className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  postingMode === m.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input type="radio" name="posting_mode" value={m.value} checked={postingMode === m.value}
                    onChange={() => setPostingMode(m.value)} className="mt-0.5" />
                  <div>
                    <p className={`text-sm font-medium ${postingMode === m.value ? "text-blue-800" : "text-gray-800"}`}>{m.label}</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Modules */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">License modules <span className="font-normal normal-case text-gray-400">(optional — can be added later)</span></p>
            <div className="grid grid-cols-2 gap-1.5">
              {MODULE_CATALOGUE.map((m) => {
                const on = selModules.includes(m.key);
                return (
                  <label key={m.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-xs transition-colors ${
                    on ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleModule(m.key)} />
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${on ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                      {on && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    {m.label}
                  </label>
                );
              })}
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button form="" type="submit" onClick={handleSubmit} disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating…" : "Create company"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlatformTenantsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const _lsT = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const _lsW = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

  const [search, _setSearch]               = useState(() => _lsT("zt_search", ""));
  const [lifecycleFilter, _setLifecycle]   = useState(() => _lsT("zt_lifecycle", ""));
  const [envFilter, _setEnv]               = useState(() => _lsT("zt_env", "live"));

  const setSearch          = (v: string) => { _setSearch(v);    _lsW("zt_search",   v); };
  const setLifecycleFilter = (v: string) => { _setLifecycle(v); _lsW("zt_lifecycle", v); };
  const setEnvFilter       = (v: string) => { _setEnv(v);       _lsW("zt_env",      v); };

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (envFilter) params.set("environment", envFilter);
      if (lifecycleFilter) params.set("lifecycle_status", lifecycleFilter);
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch<TenantListItem[]>(
        `/api/platform/tenants?${params.toString()}`,
        { token: accessToken }
      );
      setTenants(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, lifecycleFilter, envFilter]);

  useEffect(() => { load(); }, [load]);

  function handleCreated(result: CreateTenantResponse) {
    setShowCreate(false);
    router.push(`/platform/tenants/${result.id}`);
  }

  return (
    <PageContainer maxWidth="5xl">
      <PageHeading
        title="Tenants"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <i className="ti ti-plus text-sm" />
            Create company
          </button>
        }
      />
      <p className="text-sm text-gray-500 mb-6">
        All tenants on the Ziva BI platform. Default view shows live tenants.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input type="text" placeholder="Search name or slug…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {[
            { value: "", label: "All" },
            { value: "trial", label: "Trial" },
            { value: "in_implementation", label: "In implementation" },
            { value: "live", label: "Live" },
            { value: "suspended", label: "Suspended" },
          ].map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setLifecycleFilter(value)}
              className={`px-4 py-2 font-medium transition-colors ${
                lifecycleFilter === value ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              } ${value !== "" ? "border-l border-gray-300" : ""}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {[{ value: "all", label: "All" }, { value: "live", label: "Live" }, { value: "test", label: "Test" }].map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setEnvFilter(value)}
              className={`px-4 py-2 font-medium transition-colors ${
                envFilter === value ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              } ${value !== "all" ? "border-l border-gray-300" : ""}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
      )}

      <section className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading…</p>
        ) : tenants.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 italic">No tenants match the current filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name", "Slug", "Country", "Environment", "Lifecycle", "Users", "Created"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-3 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-3">
                    <Link href={`/platform/tenants/${t.id}`} className="font-medium text-blue-700 hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500 font-mono">{t.slug}</td>
                  <td className="py-2.5 px-3 text-gray-500">{t.country}</td>
                  <td className="py-2.5 px-3"><Badge value={t.environment} map={ENV_CLS} /></td>
                  <td className="py-2.5 px-3"><Badge value={t.lifecycle_status} map={LIFECYCLE_CLS} /></td>
                  <td className="py-2.5 px-3 text-gray-600">{t.user_count}</td>
                  <td className="py-2.5 px-3 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!loading && tenants.length > 0 && (() => {
        const live = tenants.filter((t) => t.environment === "live");
        const parts: string[] = [];
        const liveCount  = live.filter((t) => t.lifecycle_status === "live").length;
        const implCount  = live.filter((t) => t.lifecycle_status === "in_implementation").length;
        const trialCount = live.filter((t) => t.lifecycle_status === "trial").length;
        const suspCount  = live.filter((t) => t.lifecycle_status === "suspended").length;
        if (liveCount  > 0) parts.push(`${liveCount} live`);
        if (implCount  > 0) parts.push(`${implCount} in implementation`);
        if (trialCount > 0) parts.push(`${trialCount} trial`);
        if (suspCount  > 0) parts.push(`${suspCount} suspended`);
        return parts.length > 0 ? <p className="mt-2 text-xs text-gray-500">{parts.join(" · ")}</p> : null;
      })()}
      <p className="mt-1 text-xs text-gray-400">
        {!loading && `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} shown`}
      </p>

      <CreateCompanyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        token={accessToken}
      />
    </PageContainer>
  );
}
