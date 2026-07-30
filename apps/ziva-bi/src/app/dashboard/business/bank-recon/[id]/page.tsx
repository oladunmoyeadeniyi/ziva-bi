"use client";

/**
 * Bank Reconciliation workspace — /dashboard/business/bank-recon/[id]
 *
 * Split-pane interface:
 *   Left  — statement lines (with UNMATCHED / MATCHED / PARTIAL / EXCLUDED badges)
 *   Right — GL journal lines (Full ERP) or posting batches (Connected) available to match
 *
 * Actions:
 *   - Click a statement line to select it
 *   - Click a GL/batch candidate → creates a match
 *   - Auto-match button → triggers auto-match engine
 *   - Exclude / Unexclude button per line
 *   - Close statement button (when all lines are MATCHED or EXCLUDED)
 *   - Link to reconciliation report
 *
 * Mode detection: if candidates endpoint returns 403 / empty + mode hint from
 * statement detail, Lite mode shows a manual-notes-only match form instead.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatementLine {
  id: string;
  line_number: number;
  transaction_date: string;
  description: string;
  reference: string | null;
  debit: string;
  credit: string;
  running_balance: string | null;
  match_status: string;
  matches: MatchRecord[];
}

interface MatchRecord {
  id: string;
  match_type: string;
  matched_journal_line_id: string | null;
  matched_posting_batch_id: string | null;
  matched_amount: string;
  notes: string | null;
  matched_at: string;
}

interface StatementDetail {
  id: string;
  statement_ref: string;
  bank_account_id: string;
  statement_date: string;
  opening_balance: string;
  closing_balance: string;
  currency: string;
  status: string;
  total_lines: number;
  matched_lines: number;
  unmatched_lines: number;
  lines: StatementLine[];
}

interface GlCandidate {
  id: string;
  entry_date: string;
  reference_number: string;
  description: string;
  gl_account_code: string | null;
  gl_account_name: string | null;
  debit: string;
  credit: string;
  bank_amount: string;
}

interface BatchCandidate {
  id: string;
  batch_ref: string;
  module: string;
  status: string;
  created_at: string;
  total_amount: string | null;
}

// ── Colour maps ────────────────────────────────────────────────────────────────

const LINE_STATUS_COLOURS: Record<string, string> = {
  UNMATCHED:   "bg-gray-100 text-gray-600",
  MATCHED:     "bg-green-100 text-green-700",
  PARTIAL:     "bg-amber-100 text-amber-700",
  EXCLUDED:    "bg-purple-100 text-purple-600",
};

function LineBadge({ status }: { status: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${LINE_STATUS_COLOURS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BankReconWorkspacePage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const stmtId = params.id as string;

  const [statement, setStatement] = useState<StatementDetail | null>(null);
  const [glCandidates, setGlCandidates] = useState<GlCandidate[]>([]);
  const [batchCandidates, setBatchCandidates] = useState<BatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selection
  const [selectedLine, setSelectedLine] = useState<StatementLine | null>(null);

  // Actions
  const [autoMatching, setAutoMatching] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState("");

  // Lite-mode manual match form
  const [manualNotes, setManualNotes] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const loadStatement = useCallback(async () => {
    if (!accessToken) return;
    const data = await apiFetch(`/api/bank-recon/statements/${stmtId}`, { token: accessToken });
    setStatement(data as StatementDetail);
  }, [accessToken, stmtId]);

  const loadCandidates = useCallback(async () => {
    if (!accessToken) return;
    try {
      const gl = await apiFetch(`/api/bank-recon/statements/${stmtId}/candidates/gl`, { token: accessToken });
      setGlCandidates(Array.isArray(gl) ? gl : []);
    } catch { setGlCandidates([]); }
    try {
      const batches = await apiFetch(`/api/bank-recon/statements/${stmtId}/candidates/batches`, { token: accessToken });
      setBatchCandidates(Array.isArray(batches) ? batches : []);
    } catch { setBatchCandidates([]); }
  }, [accessToken, stmtId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadStatement(), loadCandidates()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [loadStatement, loadCandidates]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // When selected line changes, reset manual form
  useEffect(() => {
    setManualNotes("");
    setManualAmount("");
    setActionError("");
  }, [selectedLine?.id]);

  // ── Match a GL candidate ────────────────────────────────────────────────────
  async function matchGl(candidate: GlCandidate) {
    if (!selectedLine || !accessToken) return;
    setMatching(true);
    setActionError("");
    try {
      await apiFetch("/api/bank-recon/matches", {
        method: "POST",
        token: accessToken,
        body: {
          statement_line_id: selectedLine.id,
          match_type: "journal_line",
          matched_journal_line_id: candidate.id,
          matched_amount: parseFloat(candidate.bank_amount),
        },
      });
      await loadAll();
      setSelectedLine(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Match failed.");
    } finally {
      setMatching(false);
    }
  }

  // ── Match a batch candidate ─────────────────────────────────────────────────
  async function matchBatch(candidate: BatchCandidate) {
    if (!selectedLine || !accessToken) return;
    setMatching(true);
    setActionError("");
    try {
      await apiFetch("/api/bank-recon/matches", {
        method: "POST",
        token: accessToken,
        body: {
          statement_line_id: selectedLine.id,
          match_type: "posting_batch",
          matched_posting_batch_id: candidate.id,
          matched_amount: parseFloat(candidate.total_amount ?? "0"),
        },
      });
      await loadAll();
      setSelectedLine(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Match failed.");
    } finally {
      setMatching(false);
    }
  }

  // ── Manual / Lite match ─────────────────────────────────────────────────────
  async function matchManual() {
    if (!selectedLine || !accessToken) return;
    setMatching(true);
    setActionError("");
    try {
      await apiFetch("/api/bank-recon/matches", {
        method: "POST",
        token: accessToken,
        body: {
          statement_line_id: selectedLine.id,
          match_type: "manual",
          matched_amount: parseFloat(manualAmount) || 0,
          notes: manualNotes || "Manual match",
        },
      });
      await loadAll();
      setSelectedLine(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Match failed.");
    } finally {
      setMatching(false);
    }
  }

  // ── Remove a match ──────────────────────────────────────────────────────────
  async function removeMatch(matchId: string) {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/bank-recon/matches/${matchId}`, { method: "DELETE", token: accessToken });
      await loadAll();
    } catch { /* ignore */ }
  }

  // ── Exclude / Unexclude ─────────────────────────────────────────────────────
  async function toggleExclude(line: StatementLine) {
    if (!accessToken) return;
    const endpoint = line.match_status === "EXCLUDED"
      ? `/api/bank-recon/lines/${line.id}/unexclude`
      : `/api/bank-recon/lines/${line.id}/exclude`;
    try {
      await apiFetch(endpoint, { method: "PUT", token: accessToken });
      await loadAll();
      if (selectedLine?.id === line.id) setSelectedLine(null);
    } catch { /* ignore */ }
  }

  // ── Auto-match ──────────────────────────────────────────────────────────────
  async function runAutoMatch() {
    if (!accessToken) return;
    setAutoMatching(true);
    setAutoMatchResult(null);
    try {
      const result = await apiFetch<{ matched_count: number; unmatched_count: number }>(`/api/bank-recon/statements/${stmtId}/auto-match`, {
        method: "POST",
        token: accessToken,
      });
      setAutoMatchResult(`Auto-matched ${result.matched_count} line(s). ${result.unmatched_count} still unmatched.`);
      await loadAll();
    } catch (e: unknown) {
      setAutoMatchResult(e instanceof Error ? e.message : "Auto-match failed.");
    } finally {
      setAutoMatching(false);
    }
  }

  // ── Close statement ─────────────────────────────────────────────────────────
  async function closeStatement() {
    if (!accessToken) return;
    setClosing(true);
    setActionError("");
    try {
      await apiFetch(`/api/bank-recon/statements/${stmtId}/close`, {
        method: "POST",
        token: accessToken,
      });
      router.push("/dashboard/business/bank-recon");
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Close failed.");
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="h-96 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      </PageContainer>
    );
  }

  if (error || !statement) {
    return (
      <PageContainer>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error || "Statement not found."}</div>
      </PageContainer>
    );
  }

  const isReconciled = statement.status === "RECONCILED";
  const canClose = !isReconciled && statement.lines.every(l => ["MATCHED", "EXCLUDED"].includes(l.match_status));
  const candidateCount = glCandidates.length + batchCandidates.length;
  const isLiteMode = glCandidates.length === 0 && batchCandidates.length === 0;

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/business/bank-recon" className="text-sm text-gray-400 hover:text-gray-600">
              ← Bank Reconciliation
            </Link>
          </div>
          <PageHeading
            title={`${statement.statement_ref} — ${new Date(statement.statement_date).toLocaleDateString()}`}
            subtitle={`${statement.currency} · Closing: ${formatMoney(parseFloat(statement.closing_balance))} · ${statement.matched_lines}/${statement.total_lines} lines matched`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/business/bank-recon/${stmtId}/report`}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Report
          </Link>
          {!isReconciled && (
            <button
              onClick={runAutoMatch}
              disabled={autoMatching || isLiteMode}
              title={isLiteMode ? "Auto-match not available in Lite mode" : ""}
              className="px-3 py-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-40"
            >
              {autoMatching ? "Matching…" : "Auto-match"}
            </button>
          )}
          {canClose && (
            <button
              onClick={closeStatement}
              disabled={closing}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {closing ? "Closing…" : "Mark Reconciled"}
            </button>
          )}
        </div>
      </div>

      {autoMatchResult && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2 text-sm mb-3">
          {autoMatchResult}
        </div>
      )}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm mb-3">
          {actionError}
        </div>
      )}

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left — Statement lines */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Statement lines</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[68vh] overflow-y-auto">
            {statement.lines.map(line => {
              const isSelected = selectedLine?.id === line.id;
              const amount = parseFloat(line.credit) > 0 ? parseFloat(line.credit) : parseFloat(line.debit);
              const isInflow = parseFloat(line.credit) > 0;
              return (
                <div
                  key={line.id}
                  onClick={() => !isReconciled && setSelectedLine(isSelected ? null : line)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-l-2 border-blue-500"
                      : "hover:bg-gray-50 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{line.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(line.transaction_date).toLocaleDateString()}
                        {line.reference && ` · ${line.reference}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${isInflow ? "text-green-700" : "text-red-700"}`}>
                        {isInflow ? "+" : "-"}{formatMoney(amount)}
                      </p>
                      <LineBadge status={line.match_status} />
                    </div>
                  </div>

                  {/* Existing matches */}
                  {line.matches.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {line.matches.map(m => (
                        <div key={m.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-2 py-1">
                          <span className="text-[10px] text-green-700">
                            {m.match_type === "manual" ? `Manual: ${m.notes ?? ""}` : `Matched ${formatMoney(parseFloat(m.matched_amount))}`}
                          </span>
                          {!isReconciled && (
                            <button
                              onClick={ev => { ev.stopPropagation(); removeMatch(m.id); }}
                              className="text-red-400 hover:text-red-600 ml-2"
                            >
                              <i className="ti ti-x" style={{ fontSize: 11 }} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Exclude toggle */}
                  {!isReconciled && isSelected && (
                    <button
                      onClick={ev => { ev.stopPropagation(); toggleExclude(line); }}
                      className="mt-1.5 text-[10px] text-purple-600 hover:underline"
                    >
                      {line.match_status === "EXCLUDED" ? "Unexclude" : "Exclude this line"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Candidates / Manual match */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {selectedLine
                ? `Matching "${selectedLine.description.slice(0, 40)}…"`
                : "Select a line to match"}
            </p>
          </div>

          <div className="p-4 max-h-[68vh] overflow-y-auto space-y-3">
            {!selectedLine ? (
              <p className="text-sm text-gray-400 text-center py-8">Click a statement line on the left to see matching options.</p>
            ) : (
              <>
                {/* GL candidates (Full ERP) */}
                {glCandidates.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">GL Journal Lines</p>
                    <div className="space-y-2">
                      {glCandidates.map(c => (
                        <div
                          key={c.id}
                          onClick={() => matchGl(c)}
                          className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{c.description}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(c.entry_date).toLocaleDateString()} · {c.reference_number}
                              </p>
                              {c.gl_account_name && (
                                <p className="text-[10px] text-gray-400">{c.gl_account_code} — {c.gl_account_name}</p>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-gray-700 shrink-0">
                              {formatMoney(parseFloat(c.bank_amount))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Batch candidates (Connected) */}
                {batchCandidates.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Posting Batches</p>
                    <div className="space-y-2">
                      {batchCandidates.map(c => (
                        <div
                          key={c.id}
                          onClick={() => matchBatch(c)}
                          className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{c.batch_ref}</p>
                              <p className="text-xs text-gray-400">{c.module} · {c.status}</p>
                            </div>
                            {c.total_amount && (
                              <p className="text-sm font-semibold text-gray-700 shrink-0">
                                {formatMoney(parseFloat(c.total_amount))}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual match (always available) */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Manual / notes-only match</p>
                  <div className="space-y-2">
                    <input
                      type="number"
                      placeholder="Amount matched"
                      value={manualAmount}
                      onChange={e => setManualAmount(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      rows={2}
                      placeholder="Notes (e.g. 'Bank charge posted via JE-2026-000012')"
                      value={manualNotes}
                      onChange={e => setManualNotes(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={matchManual}
                      disabled={matching || !manualAmount}
                      className="w-full py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 disabled:opacity-50"
                    >
                      {matching ? "Saving…" : "Save manual match"}
                    </button>
                  </div>
                </div>

                {candidateCount === 0 && (
                  <p className="text-xs text-gray-400 text-center pt-2">
                    No GL / batch candidates found for this tenant.
                    {isLiteMode && " (Lite mode — manual matching only.)"}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
