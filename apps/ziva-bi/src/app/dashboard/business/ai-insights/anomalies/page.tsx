"use client";

/**
 * Anomaly Detection page — M20.
 * Triggers a statistical anomaly scan and shows the count of findings created.
 */

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

export default function AnomalyDetectionPage() {
  const { accessToken } = useAuth();
  const [lookback, setLookback] = useState(90);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ findings_created: number; lookback_days: number } | null>(null);
  const [error, setError] = useState("");

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const data = await apiFetch<{ findings_created: number; lookback_days: number }>(
        `/api/ai/detect-anomalies?lookback_days=${lookback}`,
        { token: accessToken!, method: "POST" }
      );
      setResult(data);
    } catch {
      setError("Anomaly scan failed. Please try again later.");
    } finally { setRunning(false); }
  };

  return (
    <PageContainer>
      <PageHeading
        title="Run Anomaly Detection Scan"
        actions={<Link href="/dashboard/business/ai-insights" className="text-sm text-gray-500 hover:underline">← Back to Insights</Link>}
      />

      <div className="max-w-xl">
        <p className="text-sm text-gray-600 mb-6">
          Scans your expense lines and AP invoices for statistical outliers (amounts ≥ 3σ above
          historical mean) and potential duplicate transactions (same vendor + amount within 7 days).
          Each finding is saved as an AI insight for your finance team to review.
        </p>

        <div className="bg-white border rounded-lg p-5 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Lookback Period</label>
          <select value={lookback} onChange={e => setLookback(parseInt(e.target.value))}
            className="w-full border rounded px-3 py-2 text-sm mb-4">
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 12 months</option>
          </select>

          <button onClick={handleRun} disabled={running}
            className="w-full py-2 text-sm text-white rounded-md font-medium"
            style={{ background: running ? "#9CA3AF" : "var(--ziva-primary, #2563EB)" }}>
            {running ? "Scanning… this may take a moment" : "Run Anomaly Scan"}
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}

        {result && (
          <div className={`border rounded-lg p-5 ${result.findings_created > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
            {result.findings_created > 0 ? (
              <>
                <p className="font-semibold text-yellow-800 mb-1">
                  {result.findings_created} anomal{result.findings_created === 1 ? "y" : "ies"} detected
                </p>
                <p className="text-sm text-yellow-700 mb-3">
                  Found over the last {result.lookback_days} days. Each has been saved as an AI insight.
                </p>
                <Link href="/dashboard/business/ai-insights?status=PENDING"
                  className="text-sm font-medium text-yellow-800 underline">
                  Review insights →
                </Link>
              </>
            ) : (
              <>
                <p className="font-semibold text-green-800 mb-1">No anomalies detected</p>
                <p className="text-sm text-green-700">
                  No statistical outliers or duplicate transactions found in the last {result.lookback_days} days.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
