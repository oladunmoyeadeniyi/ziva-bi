"use client";

/**
 * AI Insights page — M20.
 * Lists AI-generated anomaly, spending pattern, and cash flow forecast insights.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface Insight {
  id: string;
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  ANOMALY: "bg-red-50 text-red-700",
  SPENDING_PATTERN: "bg-blue-50 text-blue-700",
  CASH_FLOW_FORECAST: "bg-green-50 text-green-700",
  CATEGORY_SUGGESTION: "bg-purple-50 text-purple-700",
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-gray-100 text-gray-600",
  WARNING: "bg-yellow-50 text-yellow-700",
  CRITICAL: "bg-red-50 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  REVIEWED: "bg-blue-50 text-blue-700",
  DISMISSED: "bg-gray-100 text-gray-500",
  ACTIONED: "bg-green-50 text-green-700",
};

export default function AiInsightsPage() {
  const { accessToken } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("PENDING");

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const qs = [filterType ? `insight_type=${filterType}` : "", filterStatus ? `status=${filterStatus}` : ""].filter(Boolean).join("&");
      const data = await apiFetch<Insight[]>(`/api/ai/insights?${qs}&limit=100`, { token: accessToken });
      setInsights(data);
    } catch { setError("Failed to load insights."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [accessToken, filterType, filterStatus]);

  const handleAction = async (id: string, action: "review" | "dismiss") => {
    try {
      await apiFetch(`/api/ai/insights/${id}/${action}`, { token: accessToken!, method: "POST" });
      setInsights(prev => prev.map(i => i.id === id ? { ...i, status: action === "review" ? "REVIEWED" : "DISMISSED" } : i));
    } catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
  };

  return (
    <PageContainer>
      <PageHeading
        title="AI Insights"
        actions={
          <a href="/dashboard/business/ai-insights/anomalies"
            className="text-sm px-4 py-2 rounded-md text-white"
            style={{ background: "var(--ziva-primary, #2563EB)" }}>
            Run Anomaly Scan
          </a>
        }
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {["", "ANOMALY", "SPENDING_PATTERN", "CASH_FLOW_FORECAST"].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`text-xs px-3 py-1 rounded-md border ${filterType === t ? "bg-blue-50 border-blue-300 text-blue-700 font-medium" : "text-gray-500"}`}>
            {t || "All Types"}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {["", "PENDING", "REVIEWED", "DISMISSED"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded-md border ${filterStatus === s ? "bg-purple-50 border-purple-300 text-purple-700 font-medium" : "text-gray-500"}`}>
            {s || "All Statuses"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
          : insights.length === 0 ? <p className="text-gray-400 text-sm py-8 text-center">No insights found. Run an anomaly scan or generate a spending analysis.</p>
          : insights.map(ins => (
            <div key={ins.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[ins.insight_type] ?? ""}`}>{ins.insight_type.replace("_", " ")}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[ins.severity] ?? ""}`}>{ins.severity}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ins.status] ?? ""}`}>{ins.status}</span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">{ins.title}</h3>
                  <p className="text-sm text-gray-600">{ins.summary}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(ins.created_at).toLocaleString()}</p>
                </div>
                {ins.status === "PENDING" && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleAction(ins.id, "review")} className="text-xs text-blue-600 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50">
                      Mark Reviewed
                    </button>
                    <button onClick={() => handleAction(ins.id, "dismiss")} className="text-xs text-gray-500 border rounded px-3 py-1 hover:bg-gray-50">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </PageContainer>
  );
}
