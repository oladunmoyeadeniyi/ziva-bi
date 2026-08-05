"use client";

/**
 * Saved Reports management page — /dashboard/business/reporting/saved
 *
 * Lists all saved report definitions visible to the current user.
 * Allows running, sharing, and deleting saved reports.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  module: string;
  filters: Record<string, unknown>;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  last_run_at: string | null;
}

interface ReportResult {
  report_type: string;
  filters: Record<string, unknown>;
  row_count: number;
  rows: Record<string, unknown>[];
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function SavedReportsPage() {
  const { accessToken, user } = useAuth();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ id: string; result: ReportResult } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<SavedReport[]>("/api/reporting/saved", { token: accessToken });
      setReports(data);
    } catch {
      setError("Failed to load saved reports.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  async function handleRun(id: string) {
    if (!accessToken) return;
    setRunningId(id);
    setRunResult(null);
    try {
      const data = await apiFetch<ReportResult>(`/api/reporting/saved/${id}`, { token: accessToken });
      setRunResult({ id, result: data });
    } catch {
      setError("Failed to run report.");
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    if (!confirm("Delete this saved report definition? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/reporting/saved/${id}`, { method: "DELETE", token: accessToken });
      setReports(prev => prev.filter(r => r.id !== id));
      if (runResult?.id === id) setRunResult(null);
    } catch {
      setError("Failed to delete report.");
    } finally {
      setDeletingId(null);
    }
  }

  const activeResult = runResult?.result;
  const activeColumns = activeResult && activeResult.rows.length > 0 ? Object.keys(activeResult.rows[0]) : [];

  return (
    <PageContainer>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/business/reporting"
          className="text-gray-400 hover:text-gray-600"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 18 }} />
        </Link>
        <PageHeading>Saved Reports</PageHeading>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <i className="ti ti-bookmark block mb-3" style={{ fontSize: 40 }} />
          <p className="text-sm font-medium text-gray-500 mb-1">No saved reports yet</p>
          <p className="text-xs text-gray-400 mb-4">Run a report from the analytics dashboard and save it for quick re-use.</p>
          <Link
            href="/dashboard/business/reporting"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <i className="ti ti-chart-dots" style={{ fontSize: 14 }} />
            Go to reports
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Report row */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <i className="ti ti-report-analytics text-blue-600" style={{ fontSize: 17 }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.report_type.replace(/_/g, " ")}
                      {" · "}Module: {r.module}
                      {r.last_run_at && ` · Last run ${new Date(r.last_run_at).toLocaleDateString()}`}
                    </p>
                    {r.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{r.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {r.is_shared && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRun(r.id)}
                    disabled={runningId === r.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {runningId === r.id
                      ? <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 12 }} />
                      : <i className="ti ti-player-play" style={{ fontSize: 12 }} />
                    }
                    {runningId === r.id ? "Running…" : "Run"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    {deletingId === r.id
                      ? <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} />
                      : <i className="ti ti-trash" style={{ fontSize: 14 }} />
                    }
                  </button>
                </div>
              </div>

              {/* Inline result panel */}
              {runResult?.id === r.id && activeResult && (
                <div className="border-t border-gray-100">
                  <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      {activeResult.row_count} rows returned
                    </span>
                    <button
                      type="button"
                      onClick={() => setRunResult(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Close ✕
                    </button>
                  </div>
                  {activeResult.rows.length === 0 ? (
                    <p className="p-4 text-xs text-gray-400 text-center">No data for the saved filters.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                          <tr>
                            {activeColumns.map(col => (
                              <th key={col} className="text-left px-4 py-2 font-semibold text-gray-600 capitalize whitespace-nowrap">
                                {col.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeResult.rows.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                              {activeColumns.map(col => {
                                const val = row[col];
                                const isNum = typeof val === "number";
                                return (
                                  <td key={col} className={`px-4 py-2 text-gray-700 ${isNum ? "text-right tabular-nums" : ""}`}>
                                    {isNum ? fmt(val as number) : String(val ?? "—")}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
