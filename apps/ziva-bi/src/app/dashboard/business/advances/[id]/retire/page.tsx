"use client";

/**
 * Retire Advance — /dashboard/business/advances/[id]/retire
 *
 * Employee creates a retirement submission for an issued advance.
 * Adds expense lines (description, amount, receipt date, GL code).
 * Shows advance amount vs. total claimed + balance (over/underspend).
 * On submit, retirement goes for approval.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface Advance {
  id: string;
  advance_number: string;
  amount: string;
  currency: string;
  status: string;
  purpose: string;
}

interface Retirement {
  id: string;
  retirement_number: string;
  retirement_date: string;
  advance_amount: string;
  total_claimed: string;
  balance: string;
  status: string;
}

interface RetirementLine {
  id: string;
  description: string;
  amount: string;
  currency: string;
  receipt_date: string | null;
}

export default function RetireAdvancePage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [advance, setAdvance] = useState<Advance | null>(null);
  const [retirement, setRetirement] = useState<Retirement | null>(null);
  const [lines, setLines] = useState<RetirementLine[]>([]);
  const [loading, setLoading] = useState(true);

  // New line form
  const [newLine, setNewLine] = useState({ description: "", amount: "", receipt_date: "" });
  const [addingLine, setAddingLine] = useState(false);

  // Retirement creation form
  const [retirementDate, setRetirementDate] = useState(new Date().toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!accessToken) return;
    try {
      const adv = await apiFetch<Advance>(`/api/advances/${id}`, { token: accessToken });
      setAdvance(adv);

      const rets = await apiFetch<Retirement[]>(`/api/advances/${id}/retirements`, { token: accessToken });
      const draftRet = rets.find((r) => r.status === "DRAFT");
      if (draftRet) {
        setRetirement(draftRet);
        const detail = await apiFetch<{ lines: RetirementLine[] }>(`/api/advances/retirements/${draftRet.id}`, { token: accessToken });
        setLines(detail.lines || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, accessToken]);

  const createRetirement = async () => {
    if (!accessToken) return;
    setCreating(true);
    setError("");
    try {
      const ret = await apiFetch<Retirement>(`/api/advances/${id}/retirements`, {
        method: "POST",
        token: accessToken,
        body: { retirement_date: retirementDate },
      });
      setRetirement(ret);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create retirement.");
    } finally {
      setCreating(false);
    }
  };

  const addLine = async () => {
    if (!accessToken || !retirement) return;
    if (!newLine.description.trim() || !newLine.amount) { setError("Description and amount are required."); return; }
    setAddingLine(true);
    setError("");
    try {
      const line = await apiFetch<RetirementLine>(`/api/advances/retirements/${retirement.id}/lines`, {
        method: "POST",
        token: accessToken,
        body: {
          description:  newLine.description.trim(),
          amount:       parseFloat(newLine.amount),
          currency:     advance?.currency || "NGN",
          receipt_date: newLine.receipt_date || undefined,
        },
      });
      setLines((prev) => [...prev, line]);
      setNewLine({ description: "", amount: "", receipt_date: "" });
      // Refresh retirement totals
      const rets = await apiFetch<Retirement[]>(`/api/advances/${id}/retirements`, { token: accessToken });
      const updated = rets.find((r) => r.id === retirement.id);
      if (updated) setRetirement(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add line.");
    } finally {
      setAddingLine(false);
    }
  };

  const removeLine = async (lineId: string) => {
    if (!accessToken || !retirement) return;
    try {
      await apiFetch(`/api/advances/retirements/${retirement.id}/lines/${lineId}`, {
        method: "DELETE",
        token: accessToken,
      });
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      const rets = await apiFetch<Retirement[]>(`/api/advances/${id}/retirements`, { token: accessToken });
      const updated = rets.find((r) => r.id === retirement.id);
      if (updated) setRetirement(updated);
    } catch { /* ignore */ }
  };

  const submitRetirement = async () => {
    if (!accessToken || !retirement) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/api/advances/retirements/${retirement.id}/submit`, {
        method: "POST",
        token: accessToken,
      });
      router.push(`/dashboard/business/advances/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit retirement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageContainer><p className="text-sm text-gray-400 py-8 text-center">Loading…</p></PageContainer>;
  if (!advance) return <PageContainer><p className="text-sm text-red-500 py-8 text-center">Advance not found.</p></PageContainer>;
  if (!["ISSUED", "PARTIALLY_RETIRED"].includes(advance.status)) {
    return <PageContainer><p className="text-sm text-gray-500 py-8 text-center">This advance cannot be retired in its current status.</p></PageContainer>;
  }

  const advanceAmount = parseFloat(advance.amount);
  const totalClaimed = retirement ? parseFloat(retirement.total_claimed) : 0;
  const balance = totalClaimed - advanceAmount;

  return (
    <PageContainer>
      <PageHeading
        title={`Retire ${advance.advance_number}`}
        subtitle={advance.purpose}
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {/* Advance summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Advance amount</p>
          <p className="text-lg font-bold text-gray-900">{formatMoney(advanceAmount, advance.currency)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Total claimed</p>
          <p className="text-lg font-bold text-indigo-700">{formatMoney(totalClaimed, advance.currency)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${balance > 0 ? "bg-green-50 border-green-200" : balance < 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
          <p className="text-xs text-gray-400 mb-1">{balance > 0 ? "Overspend (co. owes you)" : balance < 0 ? "Underspend (you owe co.)" : "Balance"}</p>
          <p className={`text-lg font-bold ${balance > 0 ? "text-green-700" : balance < 0 ? "text-amber-700" : "text-gray-500"}`}>
            {formatMoney(Math.abs(balance), advance.currency)}
          </p>
        </div>
      </div>

      {/* Create retirement if none */}
      {!retirement && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Start retirement</h3>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Retirement date *</label>
              <input
                type="date"
                value={retirementDate}
                onChange={(e) => setRetirementDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <Button size="sm" onClick={createRetirement} disabled={creating}>
              {creating ? "Creating…" : "Start retirement"}
            </Button>
          </div>
        </div>
      )}

      {/* Expense lines */}
      {retirement && (
        <>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Expense lines</h3>

            {lines.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 mb-3">
                {lines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{line.description}</p>
                      {line.receipt_date && <p className="text-xs text-gray-400">{line.receipt_date}</p>}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-medium text-gray-900">{formatMoney(parseFloat(line.amount), line.currency)}</span>
                      <button
                        onClick={() => removeLine(line.id)}
                        className="text-red-400 hover:text-red-600"
                        title="Remove line"
                      >
                        <i className="ti ti-trash text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add line */}
            <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">Add expense line</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Description *"
                    value={newLine.description}
                    onChange={(e) => setNewLine((f) => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Amount *"
                    value={newLine.amount}
                    min="0"
                    step="0.01"
                    onChange={(e) => setNewLine((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newLine.receipt_date}
                  onChange={(e) => setNewLine((f) => ({ ...f, receipt_date: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <Button size="sm" onClick={addLine} disabled={addingLine}>
                  {addingLine ? "Adding…" : "Add line"}
                </Button>
              </div>
            </div>
          </div>

          {/* Submit */}
          {retirement.status === "DRAFT" && (
            <div className="flex gap-3 mt-4">
              <Button
                onClick={submitRetirement}
                disabled={submitting || lines.length === 0}
              >
                {submitting ? "Submitting…" : "Submit for approval"}
              </Button>
              <Button variant="secondary" onClick={() => router.back()}>Back</Button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
