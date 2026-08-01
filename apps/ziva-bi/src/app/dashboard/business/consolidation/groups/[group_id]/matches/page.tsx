"use client";

/**
 * IC Matches page — shows proposed/confirmed/disputed inter-company matches
 * and allows the group controller to confirm or dispute them.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface IcMatch {
  id: string;
  period_id: string;
  debit_tenant_id: string;
  credit_tenant_id: string;
  matched_amount: number;
  status: "PROPOSED" | "CONFIRMED" | "DISPUTED";
  match_type: "AUTO" | "MANUAL";
  matched_at: string;
  confirmed_at: string | null;
  disputed_reason: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PROPOSED: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-green-50 text-green-700",
  DISPUTED: "bg-red-50 text-red-600",
};

export default function IcMatchesPage() {
  const { group_id } = useParams<{ group_id: string }>();
  const { accessToken } = useAuth();
  const [matches, setMatches] = useState<IcMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [disputing, setDisputing] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const loadMatches = () => {
    if (!accessToken) return;
    apiFetch<IcMatch[]>(`/api/consolidation/groups/${group_id}/matches`, { token: accessToken })
      .then(setMatches)
      .catch(() => setError("Failed to load matches."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMatches(); }, [accessToken, group_id]);

  const runAutoMatch = async () => {
    if (!accessToken || !periodId.trim()) return alert("Enter a Period ID first.");
    setRunning(true);
    try {
      const newMatches = await apiFetch<IcMatch[]>(
        `/api/consolidation/groups/${group_id}/periods/${periodId}/auto-match`,
        { token: accessToken, method: "POST" }
      );
      alert(`${newMatches.length} new match(es) proposed.`);
      loadMatches();
    } catch {
      alert("Auto-match failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleAction = async (matchId: string, action: "CONFIRM" | "DISPUTE", reason?: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/consolidation/groups/${group_id}/matches/${matchId}`, {
        token: accessToken,
        method: "PATCH",
        body: { action, disputed_reason: reason || null },
      });
      setDisputing(null);
      setDisputeReason("");
      loadMatches();
    } catch {
      alert("Action failed.");
    }
  };

  return (
    <PageContainer>
      <PageHeading
        title="IC Matches"
        subtitle="Proposed and confirmed inter-company position matches"
        backHref={`/dashboard/business/consolidation/groups/${group_id}/members`}
        actions={
          <div className="flex gap-2 items-center">
            <input
              className="input text-sm w-52"
              placeholder="Period ID (UUID)"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            />
            <button onClick={runAutoMatch} disabled={running} className="btn-primary text-sm">
              {running ? "Running…" : "Run Auto-Match"}
            </button>
          </div>
        }
      />

      {loading && <p className="text-gray-500 py-8 text-center">Loading…</p>}
      {error && <p className="text-red-600 py-4">{error}</p>}

      {!loading && matches.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No IC matches yet. Enter a Period ID and run auto-match to begin.</p>
        </div>
      )}

      {!loading && matches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Debit Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Credit Entity</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matches.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.match_type === "AUTO" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                      {m.match_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{m.debit_tenant_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.credit_tenant_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(m.matched_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.status === "PROPOSED" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(m.id, "CONFIRM")}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Confirm
                        </button>
                        {disputing === m.id ? (
                          <div className="flex gap-1 items-center">
                            <input
                              className="input text-xs py-0.5 w-36"
                              placeholder="Reason…"
                              value={disputeReason}
                              onChange={(e) => setDisputeReason(e.target.value)}
                            />
                            <button
                              onClick={() => handleAction(m.id, "DISPUTE", disputeReason)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Submit
                            </button>
                            <button onClick={() => setDisputing(null)} className="text-xs text-gray-400">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDisputing(m.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Dispute
                          </button>
                        )}
                      </div>
                    )}
                    {m.status === "DISPUTED" && m.disputed_reason && (
                      <span className="text-xs text-gray-400" title={m.disputed_reason}>⚠️ {m.disputed_reason.slice(0, 20)}…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
