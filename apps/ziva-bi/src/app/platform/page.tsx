"use client";

/**
 * Platform Overview — /platform
 *
 * Metrics computed from GET /api/platform/tenants?environment=all.
 * Only live-environment tenants are counted (test shadows excluded).
 * No dedicated metrics endpoint exists — all counts are client-side.
 * Recent activity: omitted (no audit API endpoint yet).
 */

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  environment: string;
  lifecycle_status: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlatformOverviewPage() {
  const { accessToken } = useAuth();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TenantListItem[]>(
        "/api/platform/tenants?environment=all",
        { token: accessToken }
      );
      setTenants(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  // Only count live-environment tenants (exclude test shadows)
  const live = tenants.filter((t) => t.environment === "live");

  const total         = live.length;
  const countLive     = live.filter((t) => t.lifecycle_status === "live").length;
  const countImpl     = live.filter((t) => t.lifecycle_status === "in_implementation").length;
  const countTrial    = live.filter((t) => t.lifecycle_status === "trial").length;
  const countSuspended = live.filter((t) => t.lifecycle_status === "suspended").length;

  // Needs attention: trials + suspended
  const attentionItems: Array<{ text: string; href: string }> = [];
  if (countTrial > 0)
    attentionItems.push({
      text: `${countTrial} trial account${countTrial > 1 ? "s" : ""} awaiting conversion`,
      href: "/platform/tenants",
    });
  if (countSuspended > 0)
    attentionItems.push({
      text: `${countSuspended} suspended account${countSuspended > 1 ? "s" : ""}`,
      href: "/platform/tenants",
    });

  return (
    <PageContainer maxWidth="5xl">
      <PageHeading title="Overview" />
      <p className="text-sm text-gray-500 mb-8">
        Platform-wide snapshot across all live tenants.
      </p>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-8 w-12 bg-gray-100 rounded mb-2" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <MetricCard label="Total tenants"    value={total}          accent="text-gray-800" />
          <MetricCard label="Live"             value={countLive}      accent="text-green-600" sub="lifecycle: live" />
          <MetricCard label="In implementation" value={countImpl}     accent="text-blue-600"  sub="being configured" />
          <MetricCard label="Trials"           value={countTrial}     accent="text-gray-600"  sub="trial status" />
          <MetricCard label="Suspended"        value={countSuspended} accent="text-red-500"   sub="login blocked" />
        </div>
      )}

      {/* Needs attention */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Needs attention
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : attentionItems.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nothing needs attention right now.</p>
        ) : (
          <ul className="space-y-2">
            {attentionItems.map((item) => (
              <li key={item.text} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <Link
                  href={item.href}
                  className="text-sm text-gray-700 hover:text-blue-600 hover:underline"
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/platform/tenants"
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          View all tenants
        </Link>
        <Link
          href="/platform/tenants?lifecycle_status=trial"
          className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          View trials
        </Link>
      </div>
    </PageContainer>
  );
}
