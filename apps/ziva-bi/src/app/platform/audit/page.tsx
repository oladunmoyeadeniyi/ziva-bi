"use client";

/**
 * Platform Audit Log — /platform/audit
 *
 * SA-only. Shows all platform-level audit events from audit_logs table.
 * Filters: event_type substring, user email substring.
 * Paginated (100/page, load more).
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface AuditEntry {
  id: string;
  event_type: string;
  user_email: string | null;
  user_name: string | null;
  tenant_name: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function EventTypeBadge({ type }: { type: string }) {
  const cat = type.split(".")[0];
  const colors: Record<string, string> = {
    auth: "bg-blue-50 text-blue-700 border-blue-200",
    platform: "bg-purple-50 text-purple-700 border-purple-200",
    tenant: "bg-green-50 text-green-700 border-green-200",
    user: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded border ${colors[cat] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {type}
    </span>
  );
}

export default function PlatformAuditPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ event_type: "", user_email: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const LIMIT = 100;

  const doFetch = useCallback(async (off = 0) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (filter.event_type) params.set("event_type", filter.event_type);
      if (filter.user_email) params.set("user_email", filter.user_email);
      const data = await apiFetch<{ total: number; items: AuditEntry[] }>(
        `/api/platform/audit?${params}`, { token: accessToken }
      );
      setEntries(off === 0 ? data.items : prev => [...prev, ...data.items]);
      setTotal(data.total);
      setCurrentOffset(off);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [accessToken, filter]);

  useEffect(() => { doFetch(0); }, [doFetch]);

  return (
    <PageContainer maxWidth="6xl">
      <div className="mb-6">
        <PageHeading>Audit Log</PageHeading>
        <p className="text-sm text-gray-500 mt-1">
          Immutable record of all platform actions — {total.toLocaleString()} entries.
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={filter.event_type}
          onChange={e => setFilter(f => ({ ...f, event_type: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && doFetch(0)}
          placeholder="Filter by event type…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        <input
          value={filter.user_email}
          onChange={e => setFilter(f => ({ ...f, user_email: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && doFetch(0)}
          placeholder="Filter by user email…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        <button type="button" onClick={() => doFetch(0)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          Search
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="p-8 space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No audit entries found.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Timestamp</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Event</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tenant</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">IP</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <>
                    <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5"><EventTypeBadge type={e.event_type} /></td>
                      <td className="px-4 py-2.5 text-gray-600">
                        <p className="text-xs">{e.user_email ?? "—"}</p>
                        {e.user_name && <p className="text-xs text-gray-400">{e.user_name}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{e.tenant_name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{e.ip_address ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {e.metadata && Object.keys(e.metadata).length > 0 && (
                          <button type="button"
                            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                            className="text-xs text-blue-500 hover:text-blue-700">
                            {expanded === e.id ? "hide" : "details"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === e.id && e.metadata && (
                      <tr key={`${e.id}-meta`} className="bg-blue-50">
                        <td colSpan={6} className="px-4 py-2">
                          <pre className="text-xs text-blue-800 font-mono whitespace-pre-wrap">
                            {JSON.stringify(e.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {entries.length < total && (
              <div className="p-4 text-center border-t border-gray-100">
                <button type="button" onClick={() => doFetch(currentOffset + LIMIT)} disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50">
                  {loading ? "Loading…" : `Load more (${total - entries.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
