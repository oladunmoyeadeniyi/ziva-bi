"use client";

/**
 * New Journal Entry — /dashboard/business/accounting/journal-entries/new
 *
 * Allows tenant admins to create a manual GL journal entry.
 * Wraps POST /api/gl/journal-entries which calls the existing post_journal() engine.
 *
 * Features:
 *  - Entry date + description header
 *  - Dynamic DR/CR line table (minimum 2 lines)
 *  - Inline GL account search (type to filter, click to select)
 *  - Running DR/CR totals with balance indicator
 *  - "Save as Draft" (skips period date check) + "Post" buttons
 *  - Mode guard: Lite → ModeNotAvailable; Connected → info banner
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney, fmtCommaInput, stripCommas } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";
import ModeNotAvailable from "@/components/ModeNotAvailable";

interface GlAccount {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  is_active: boolean;
}

interface JournalLine {
  localId: string;
  gl_id: string | null;
  gl_number: string;
  gl_name: string;
  debit: string;
  credit: string;
  description: string;
}

let _nextId = 1;
function mkLine(): JournalLine {
  return {
    localId: String(_nextId++),
    gl_id: null, gl_number: "", gl_name: "",
    debit: "", credit: "", description: "",
  };
}

export default function NewJournalEntryPage() {
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const [postingMode, setPostingMode] = useState<string | null>(null);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);

  const [entryDate, setEntryDate] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([mkLine(), mkLine()]);

  // GL picker state
  const [pickerLineId, setPickerLineId] = useState<string | null>(null);
  const [glSearch, setGlSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load posting mode + GL accounts
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<{ posting_mode?: string }>("/api/setup/org", { token: accessToken })
      .then((d) => setPostingMode(d.posting_mode ?? "full_erp"))
      .catch(() => setPostingMode("full_erp"));

    apiFetch<GlAccount[]>("/api/config/coa", { token: accessToken })
      .then((d) => setGlAccounts(d.filter((a) => a.is_active)))
      .catch(() => {});
  }, [accessToken]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerLineId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredGl = glSearch.trim().length >= 1
    ? glAccounts.filter((a) =>
        a.gl_number.toLowerCase().includes(glSearch.toLowerCase()) ||
        a.gl_name.toLowerCase().includes(glSearch.toLowerCase())
      ).slice(0, 30)
    : glAccounts.slice(0, 30);

  const updateLine = (localId: string, patch: Partial<JournalLine>) => {
    setLines((prev) => prev.map((l) => l.localId === localId ? { ...l, ...patch } : l));
  };

  const pickGl = (lineId: string, account: GlAccount) => {
    updateLine(lineId, { gl_id: account.id, gl_number: account.gl_number, gl_name: account.gl_name });
    setPickerLineId(null);
    setGlSearch("");
  };

  const addLine = () => setLines((prev) => [...prev, mkLine()]);

  const removeLine = (localId: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((l) => l.localId !== localId));
  };

  // Totals
  const totalDr = lines.reduce((s, l) => s + (parseFloat(stripCommas(l.debit)) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(stripCommas(l.credit)) || 0), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.005 && totalDr > 0;

  const validate = (): string | null => {
    if (!entryDate) return "Entry date is required.";
    if (!description.trim()) return "Description is required.";
    const nonEmpty = lines.filter((l) => parseFloat(stripCommas(l.debit)) > 0 || parseFloat(stripCommas(l.credit)) > 0);
    if (nonEmpty.length < 2) return "At least 2 lines with amounts are required.";
    for (const l of lines) {
      const dr = parseFloat(stripCommas(l.debit)) || 0;
      const cr = parseFloat(stripCommas(l.credit)) || 0;
      if ((dr > 0 || cr > 0) && !l.gl_id) return "All lines with amounts must have a GL account selected.";
      if (dr > 0 && cr > 0) return "A line cannot have both a debit and a credit.";
    }
    if (!isBalanced) return "Journal does not balance — total debits must equal total credits.";
    return null;
  };

  const submit = async (entryStatus: "DRAFT" | "POSTED") => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        entry_date: entryDate,
        description: description.trim(),
        status: entryStatus,
        lines: lines
          .filter((l) => parseFloat(stripCommas(l.debit)) > 0 || parseFloat(stripCommas(l.credit)) > 0)
          .map((l) => ({
            gl_account_id: l.gl_id,
            debit: parseFloat(stripCommas(l.debit)) || 0,
            credit: parseFloat(stripCommas(l.credit)) || 0,
            description: l.description.trim() || null,
          })),
      };
      await apiFetch("/api/gl/journal-entries", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify(payload),
      });
      router.push("/dashboard/business/accounting/journal-entries");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create journal entry.");
    } finally {
      setSubmitting(false);
    }
  };

  // Mode guard
  if (postingMode === "lite") {
    return (
      <PageContainer>
        <PageHeading title="New Journal Entry" subtitle="Manual GL entry" />
        <ModeNotAvailable
          pageName="Manual Journal Entry"
          availableIn={["Connected", "Full ERP"]}
          currentMode="lite"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeading
        title="New Journal Entry"
        subtitle="Create a balanced GL entry"
        actions={
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => router.push("/dashboard/business/accounting/journal-entries")}
          >
            ← Back
          </button>
        }
      />

      {postingMode === "connected" && (
        <Banner variant="info" className="mb-4">
          <strong>Connected mode:</strong> This journal posts to your in-app GL only, not to your
          external ERP. Use for in-app adjustments and accruals.
        </Banner>
      )}

      {error && <Banner variant="error" className="mb-4">{error}</Banner>}

      {/* Header fields */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Entry date <span className="text-red-500">*</span></label>
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue={entryDate}
            onBlur={(e) => setEntryDate(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-64">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description / narration <span className="text-red-500">*</span></label>
          <input
            type="text"
            placeholder="e.g. Accruals for July 2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Lines table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 w-8">#</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 w-64">GL Account</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Line description</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-32">Debit (DR)</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-32">Credit (CR)</th>
              <th className="px-3 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, idx) => (
              <tr key={line.localId} className="bg-white">
                <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>

                {/* GL picker cell */}
                <td className="px-3 py-2 relative">
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded border text-xs truncate ${
                      line.gl_id
                        ? "border-gray-200 bg-blue-50 text-blue-700 font-mono"
                        : "border-dashed border-gray-300 text-gray-400"
                    }`}
                    onClick={() => {
                      setPickerLineId(pickerLineId === line.localId ? null : line.localId);
                      setGlSearch("");
                    }}
                  >
                    {line.gl_id
                      ? `${line.gl_number} — ${line.gl_name}`
                      : "Select GL account…"}
                  </button>

                  {pickerLineId === line.localId && (
                    <div
                      ref={pickerRef}
                      className="absolute z-50 left-3 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg"
                    >
                      <div className="p-2 border-b border-gray-100">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search GL…"
                          value={glSearch}
                          onChange={(e) => setGlSearch(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredGl.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-400">No accounts found.</p>
                        ) : (
                          filteredGl.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center gap-2"
                              onClick={() => pickGl(line.localId, a)}
                            >
                              <span className="font-mono text-blue-600 shrink-0">{a.gl_number}</span>
                              <span className="text-gray-700 truncate">{a.gl_name}</span>
                              <span className="ml-auto text-gray-400 text-[10px] shrink-0">{a.account_type}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </td>

                {/* Line description */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="Optional"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={line.description}
                    onChange={(e) => updateLine(line.localId, { description: e.target.value })}
                  />
                </td>

                {/* Debit */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={fmtCommaInput(line.debit)}
                    onChange={(e) => {
                      const raw = stripCommas(e.target.value.replace(/[^0-9.,]/g, ""));
                      updateLine(line.localId, { debit: raw, credit: raw ? "" : line.credit });
                    }}
                  />
                </td>

                {/* Credit */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={fmtCommaInput(line.credit)}
                    onChange={(e) => {
                      const raw = stripCommas(e.target.value.replace(/[^0-9.,]/g, ""));
                      updateLine(line.localId, { credit: raw, debit: raw ? "" : line.debit });
                    }}
                  />
                </td>

                {/* Remove */}
                <td className="px-3 py-2 text-center">
                  {lines.length > 2 && (
                    <button
                      type="button"
                      className="text-gray-300 hover:text-red-400 text-sm"
                      onClick={() => removeLine(line.localId)}
                      title="Remove line"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totals footer */}
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-xs text-right font-semibold text-gray-600">Totals</td>
              <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-gray-800">
                {formatMoney(totalDr)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-gray-800">
                {formatMoney(totalCr)}
              </td>
              <td className="px-3 py-2 text-center">
                {totalDr > 0 && (
                  isBalanced
                    ? <span className="text-green-500 text-sm" title="Balanced">✓</span>
                    : <span className="text-red-400 text-sm" title="Unbalanced">!</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add line */}
      <button
        type="button"
        className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-6"
        onClick={addLine}
      >
        + Add line
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => submit("POSTED")}
          disabled={submitting}
        >
          {submitting ? "Posting…" : "Post Entry"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => submit("DRAFT")}
          disabled={submitting}
        >
          Save as Draft
        </Button>
        <button
          type="button"
          className="text-sm text-gray-500 hover:text-gray-700"
          onClick={() => router.push("/dashboard/business/accounting/journal-entries")}
        >
          Cancel
        </button>
      </div>
    </PageContainer>
  );
}
