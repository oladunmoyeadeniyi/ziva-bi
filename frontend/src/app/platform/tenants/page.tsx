"use client";

/**
 * Platform tenant list — /platform/tenants
 *
 * Moved from /platform (was the root page). All functionality preserved.
 * Lists all tenants with search, lifecycle, and environment filters.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

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
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${map[value] ?? "bg-gray-100 text-gray-600"}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

const inputCls =
  "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlatformTenantsPage() {
  const { accessToken } = useAuth();

  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [envFilter, setEnvFilter] = useState("live");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer maxWidth="5xl">
      <PageHeading title="Tenants" />
      <p className="text-sm text-gray-500 mb-6">
        All tenants on the Ziva BI platform. Default view shows live tenants.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputCls + " w-56"}
        />
        <select
          value={lifecycleFilter}
          onChange={(e) => setLifecycleFilter(e.target.value)}
          className={inputCls}
        >
          <option value="">All lifecycle states</option>
          <option value="trial">Trial</option>
          <option value="in_implementation">In implementation</option>
          <option value="live">Live</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className={inputCls}
        >
          <option value="live">Live tenants</option>
          <option value="test">Test tenants</option>
          <option value="all">All environments</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
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
                  <th key={h} className="text-left py-2.5 px-3 font-medium text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-3">
                    <Link
                      href={`/platform/tenants/${t.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500 font-mono">{t.slug}</td>
                  <td className="py-2.5 px-3 text-gray-500">{t.country}</td>
                  <td className="py-2.5 px-3">
                    <Badge value={t.environment} map={ENV_CLS} />
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge value={t.lifecycle_status} map={LIFECYCLE_CLS} />
                  </td>
                  <td className="py-2.5 px-3 text-gray-600">{t.user_count}</td>
                  <td className="py-2.5 px-3 text-gray-400">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* State-count summary — live-environment tenants only (excludes test shadows) */}
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
        return parts.length > 0 ? (
          <p className="mt-2 text-xs text-gray-500">{parts.join(" · ")}</p>
        ) : null;
      })()}
      <p className="mt-1 text-xs text-gray-400">
        {!loading && `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} shown`}
      </p>
    </PageContainer>
  );
}
