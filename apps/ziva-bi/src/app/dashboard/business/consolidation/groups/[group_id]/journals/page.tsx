"use client";

/**
 * Elimination Journals page — list and post group-level elimination entries.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface EliminationLine {
  id: string;
  member_tenant_id: string;
  gl_account_id: string;
  debit: number;
  credit: number;
  narrative: string | null;
}

interface EliminationJournal {
  id: string;
  reference: string;
  description: string;
  period_id: string;
  total_dr: number;
  total_cr: number;
  status: "POSTED" | "REVERSED";
  posted_at: string;
  lines: EliminationLine[];
}

export default function EliminationJournalsPage() {
  const { group_id } = useParams<{ group_id: string }>();
  const { accessToken } = useAuth();
  const [journals, setJournals] = useState<EliminationJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadJournals = () => {
    if (!accessToken) return;
    apiFetch<EliminationJournal[]>(`/api/consolidation/groups/${group_id}/elimination-journals`, { token: accessToken })
      .then(setJournals)
      .catch(() => setError("Failed to load elimination journals."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadJournals(); }, [accessToken, group_id]);

  const handleReverse = async (journalId: string, reference: string) => {
    if (!accessToken || !confirm(`Reverse ${reference}?`)) return;
    try {
      await apiFetch(
        `/api/consolidation/groups/${group_id}/elimination-journals/${journalId}/reverse`,
        { token: accessToken, method: "POST" }
      );
      loadJournals();
    } catch {
      alert("Failed to reverse journal.");
    }
  };

  return (
    <PageContainer>
      <PageHeading
        title="Elimination Journals"
        subtitle="Immutable group-level elimination entries"
        backHref={`/dashboard/business/consolidation/groups/${group_id}/matches`}
        actions={
          <a
            href={`/dashboard/business/consolidation/groups/${group_id}/trial-balance`}
            className="btn-primary text-sm"
          >
            View Consolidated TB
          </a>
        }
      />

      {loading && <p className="text-gray-500 py-8 text-center">Loading…</p>}
      {error && <p className="text-red-600 py-4">{error}</p>}

      {!loading && journals.length === 0 && (
        <p className="text-gray-500 py-8 text-center">No elimination journals posted yet.</p>
      )}

      {!loading && journals.length > 0 && (
        <div className="space-y-3">
          {journals.map((j) => (
            <div key={j.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50"
                onClick={() => setExpanded(expanded === j.id ? null : j.id)}
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-gray-900">{j.reference}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.status === "POSTED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {j.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{j.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Posted {new Date(j.posted_at).toLocaleDateString()} ·
                    DR {Number(j.total_dr).toLocaleString()} / CR {Number(j.total_cr).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {j.status === "POSTED" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReverse(j.id, j.reference); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Reverse
                    </button>
                  )}
                  <span className="text-gray-400">{expanded === j.id ? "▲" : "▼"}</span>
                </div>
              </button>

              {expanded === j.id && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">Entity</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">GL Account</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">Debit</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-500">Credit</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">Narrative</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {j.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-2 font-mono">{line.member_tenant_id.slice(0, 8)}…</td>
                          <td className="px-4 py-2 font-mono">{line.gl_account_id.slice(0, 8)}…</td>
                          <td className="px-4 py-2 text-right">{Number(line.debit) > 0 ? Number(line.debit).toLocaleString() : "—"}</td>
                          <td className="px-4 py-2 text-right">{Number(line.credit) > 0 ? Number(line.credit).toLocaleString() : "—"}</td>
                          <td className="px-4 py-2 text-gray-500">{line.narrative || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
