"use client";

/**
 * Asset Issuances page — /dashboard/business/assets/issuances
 *
 * Lists all asset issuances across the tenant with status filter.
 * From here you can:
 *  - Issue a new asset (link to /assets/issuances/new)
 *  - Return an active issuance (inline action)
 *  - View history for a specific asset
 *
 * Tabs: Active | All
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import Button from "@/components/Button";

interface Issuance {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  employee_id: string | null;
  employee_name: string | null;
  location_name: string | null;
  issue_date: string;
  expected_return_date: string | null;
  returned_at: string | null;
  status: string;
  condition_at_issue: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    RETURNED: "bg-gray-50 text-gray-600 border-gray-200",
    TRANSFERRED: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

export default function AssetIssuancesPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<"active" | "all">("active");
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = tab === "active" ? "?status=ACTIVE" : "";
      const data = await apiFetch<Issuance[]>(`/api/assets/issuances${params}`, { token: accessToken });
      setIssuances(data);
    } catch { setError("Failed to load issuances."); }
    finally { setLoading(false); }
  }, [accessToken, tab]);

  useEffect(() => { fetch(); }, [fetch]);

  async function returnAsset(id: string) {
    if (!accessToken || !confirm("Mark this asset as returned?")) return;
    setReturning(id);
    try {
      const today = new Date().toISOString().split("T")[0];
      await apiFetch(`/api/assets/issuances/${id}/return`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ returned_at: today }),
      });
      await fetch();
    } catch { setError("Failed to record return."); }
    finally { setReturning(null); }
  }

  const assigneeLabel = (i: Issuance) => i.employee_name ?? i.location_name ?? "—";

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageHeading>Asset Issuances</PageHeading>
          <p className="text-sm text-gray-500 mt-1">Track which assets are assigned to staff or locations.</p>
        </div>
        <Link href="/dashboard/business/assets/issuances/new">
          <Button variant="primary" size="sm">
            <i className="ti ti-plus" style={{ fontSize: 14 }} />
            Issue asset
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">
          {error}
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        {(["active", "all"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-blue-500 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "active" ? "Active" : "All history"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : issuances.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {tab === "active" ? "No assets currently issued." : "No issuance records yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Asset</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Assigned to</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Issue date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Expected return</th>
                {tab === "all" && <th className="text-left px-4 py-3 font-semibold text-gray-600">Returned</th>}
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {issuances.map((i, idx) => (
                <tr key={i.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/business/assets/${i.asset_id}`} className="font-medium text-gray-800 hover:text-blue-600">
                      {i.asset_name}
                    </Link>
                    <p className="text-xs text-gray-400">{i.asset_code}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {i.employee_name ? (
                      <span className="flex items-center gap-1">
                        <i className="ti ti-user text-gray-400" style={{ fontSize: 12 }} />
                        {i.employee_name}
                      </span>
                    ) : i.location_name ? (
                      <span className="flex items-center gap-1">
                        <i className="ti ti-map-pin text-gray-400" style={{ fontSize: 12 }} />
                        {i.location_name}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{i.issue_date}</td>
                  <td className="px-4 py-3 text-gray-500">{i.expected_return_date ?? "—"}</td>
                  {tab === "all" && <td className="px-4 py-3 text-gray-500">{i.returned_at ?? "—"}</td>}
                  <td className="px-4 py-3 text-center"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {i.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => returnAsset(i.id)}
                        disabled={returning === i.id}
                        className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-2 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        Return
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
