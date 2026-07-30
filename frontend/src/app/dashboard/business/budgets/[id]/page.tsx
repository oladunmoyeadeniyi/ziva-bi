"use client";

/**
 * Budget Period detail page — M16 Budget & Planning.
 *
 * Shows period metadata, status lifecycle actions (Activate / Lock),
 * and the line-level budget allocations table with an inline add-line form.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface GlAccount { id: string; gl_number: string; gl_name: string; }

interface BudgetLine {
  id: string;
  gl_account_id: string | null;
  gl_code: string | null;
  gl_name: string | null;
  description: string | null;
  annual_amount: string;
  monthly_allocations: Record<string, string> | null;
  notes: string | null;
}

interface BudgetPeriod {
  id: string;
  name: string;
  fiscal_year: number;
  period_start: string;
  period_end: string;
  status: "DRAFT" | "ACTIVE" | "LOCKED";
  description: string | null;
  lines: BudgetLine[];
}

const STATUS_COLOURS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-100 text-green-700",
  LOCKED: "bg-blue-100 text-blue-700",
};

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [period, setPeriod] = useState<BudgetPeriod | null>(null);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // New line form state
  const [showAddLine, setShowAddLine] = useState(false);
  const [lineGl, setLineGl] = useState("");
  const [lineAnnual, setLineAnnual] = useState("");
  const [lineDesc, setLineDesc] = useState("");
  const [addingLine, setAddingLine] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pData, glData] = await Promise.all([
        apiFetch<BudgetPeriod>(`/api/budgets/${id}`),
        apiFetch<{ accounts?: GlAccount[] } | GlAccount[]>("/api/config/coa?limit=500"),
      ]);
      setPeriod(pData);
      setGlAccounts(Array.isArray(glData) ? glData : (glData.accounts ?? []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleActivate = async () => {
    setActionLoading(true);
    setError("");
    try {
      const data = await apiFetch<BudgetPeriod>(`/api/budgets/${id}/activate`, { method: "POST" });
      setPeriod(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = async () => {
    if (!confirm("Lock this budget? No further changes will be allowed.")) return;
    setActionLoading(true);
    setError("");
    try {
      const data = await apiFetch<BudgetPeriod>(`/api/budgets/${id}/lock`, { method: "POST" });
      setPeriod(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to lock.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingLine(true);
    setError("");
    try {
      await apiFetch(`/api/budgets/${id}/lines`, {
        method: "POST",
        body: JSON.stringify([{
          gl_account_id: lineGl || null,
          description: lineDesc || null,
          annual_amount: parseFloat(lineAnnual) || 0,
          monthly_allocations: null,
          notes: null,
        }]),
      });
      setShowAddLine(false);
      setLineGl(""); setLineAnnual(""); setLineDesc("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add line.");
    } finally {
      setAddingLine(false);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm("Remove this budget line?")) return;
    try {
      await apiFetch(`/api/budgets/${id}/lines/${lineId}`, { method: "DELETE" });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete line.");
    }
  };

  if (loading) return <PageContainer><div className="text-center py-12 text-gray-400">Loading…</div></PageContainer>;
  if (!period) return <PageContainer><div className="text-center py-12 text-red-500">Budget not found.</div></PageContainer>;

  const totalBudget = period.lines.reduce((s, ln) => s + parseFloat(ln.annual_amount), 0);
  const isEditable = period.status !== "LOCKED";

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <PageHeading title={period.name} subtitle={`FY ${period.fiscal_year} · ${new Date(period.period_start).toLocaleDateString("en-GB")} – ${new Date(period.period_end).toLocaleDateString("en-GB")}`} />
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[period.status]}`}>{period.status}</span>
          </div>
          {period.description && <p className="text-sm text-gray-500 mt-1">{period.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/business/budgets/${id}/variance`}>
            <Button variant="secondary">View Variance</Button>
          </Link>
          {period.status === "DRAFT" && (
            <Button onClick={handleActivate} disabled={actionLoading}>Activate</Button>
          )}
          {period.status === "ACTIVE" && (
            <Button onClick={handleLock} disabled={actionLoading} variant="secondary">Lock</Button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Total Budget</div>
          <div className="text-xl font-semibold">{formatMoney(totalBudget)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Budget Lines</div>
          <div className="text-xl font-semibold">{period.lines.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Status</div>
          <div className="text-xl font-semibold capitalize">{period.status.toLowerCase()}</div>
        </div>
      </div>

      {/* Lines table */}
      <div className="bg-white rounded-xl border overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <span className="font-medium text-sm">Budget Lines</span>
          {isEditable && (
            <Button size="sm" onClick={() => setShowAddLine(true)}>+ Add Line</Button>
          )}
        </div>

        {/* Add line form */}
        {showAddLine && (
          <form onSubmit={handleAddLine} className="px-4 py-3 border-b bg-blue-50">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">GL Account</label>
                <select
                  value={lineGl}
                  onChange={(e) => setLineGl(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— Select GL —</option>
                  {glAccounts.map((g) => (
                    <option key={g.id} value={g.id}>{g.gl_number} — {g.gl_name}</option>
                  ))}
                </select>
              </div>
              <div className="w-48">
                <label className="block text-xs text-gray-600 mb-1">Annual Amount *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={lineAnnual}
                  onChange={(e) => setLineAnnual(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Description</label>
                <input
                  value={lineDesc}
                  onChange={(e) => setLineDesc(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Optional"
                />
              </div>
              <Button type="submit" disabled={addingLine} size="sm">
                {addingLine ? "Adding…" : "Add"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddLine(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">GL Account</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Annual Budget</th>
              {isEditable && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {period.lines.length === 0 ? (
              <tr>
                <td colSpan={isEditable ? 4 : 3} className="text-center px-4 py-8 text-gray-400 text-sm">
                  No budget lines yet.{isEditable ? " Click '+ Add Line' to start." : ""}
                </td>
              </tr>
            ) : (
              period.lines.map((ln) => (
                <tr key={ln.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">
                    {ln.gl_code ? <span>{ln.gl_code} — {ln.gl_name}</span> : <span className="text-gray-400">No GL</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{ln.description || "—"}</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">{formatMoney(parseFloat(ln.annual_amount))}</td>
                  {isEditable && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeleteLine(ln.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {period.lines.length > 0 && (
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td colSpan={isEditable ? 2 : 2} className="px-4 py-2 font-medium text-right text-sm">Total</td>
                <td className="px-4 py-2 text-right font-mono font-bold">{formatMoney(totalBudget)}</td>
                {isEditable && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </PageContainer>
  );
}
