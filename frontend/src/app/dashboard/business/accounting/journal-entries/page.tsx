"use client";

/**
 * Journal Entries list — /dashboard/business/accounting/journal-entries
 *
 * Displays all GL journal entries for the tenant. Accessible in Connected
 * and Full ERP modes. Lite mode: ModeNotAvailable.
 *
 * Features:
 *  - Table of entries (reference, date, description, source, status, total DR)
 *  - Date range + status filters
 *  - "New Journal Entry" button (admin only) → /new
 *  - Click a row to expand inline detail view
 *
 * Mode gating:
 *  - Lite   → ModeNotAvailable (no in-app GL)
 *  - Connected + Full ERP → full access
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";
import ModeNotAvailable from "@/components/ModeNotAvailable";

interface JournalEntryListItem {
  id: string;
  reference_number: string;
  entry_date: string;
  description: string;
  source: string;
  status: string;
  total_debit: string;
  created_at: string;
}

const STATUS_COLOURS: Record<string, string> = {
  POSTED: "bg-green-100 text-green-700",
  DRAFT: "bg-yellow-100 text-yellow-700",
  REVERSED: "bg-gray-100 text-gray-500",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  expense: "Expense",
  ap: "AP",
  ar: "AR",
  payroll: "Payroll",
};

export default function JournalEntriesPage() {
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const [postingMode, setPostingMode] = useState<string | null>(null);
  const [entries, setEntries] = useState<JournalEntryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load posting mode
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<{ posting_mode?: string }>("/api/setup/org", { token: accessToken })
      .then((d) => setPostingMode(d.posting_mode ?? "full_erp"))
      .catch(() => setPostingMode("full_erp"));
  }, [accessToken]);

  // Load entries
  const loadEntries = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString();
      const data = await apiFetch<JournalEntryListItem[]>(
        `/api/gl/journal-entries${qs ? `?${qs}` : ""}`,
        { token: accessToken }
      );
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken && postingMode && postingMode !== "lite") loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, postingMode]);

  const handleRowClick = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const detail = await apiFetch<Record<string, unknown>>(
        `/api/gl/journal-entries/${id}`,
        { token: accessToken! }
      );
      setExpandedDetail(detail);
    } catch {
      setExpandedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Mode guard
  if (postingMode === "lite") {
    return (
      <PageContainer>
        <PageHeading title="Journal Entries" subtitle="Manual GL entries and adjustments" />
        <ModeNotAvailable
          pageName="Journal Entries"
          availableIn={["Connected", "Full ERP"]}
          currentMode="lite"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeading
        title="Journal Entries"
        subtitle="Manual GL entries and adjustments"
        actions={
          user?.is_tenant_admin ? (
            <Button onClick={() => router.push("/dashboard/business/accounting/journal-entries/new")}>
              + New Journal Entry
            </Button>
          ) : undefined
        }
      />

      {postingMode === "connected" && (
        <Banner variant="info" className="mb-4">
          You are in <strong>Connected mode</strong>. Manual journals post to your in-app GL only,
          not to your external ERP. Use these for adjustments and accruals that do not originate
          from your external system.
        </Banner>
      )}

      {error && <Banner variant="error" className="mb-4">{error}</Banner>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            defaultValue={dateFrom}
            onBlur={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            defaultValue={dateTo}
            onBlur={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="POSTED">Posted</option>
            <option value="DRAFT">Draft</option>
            <option value="REVERSED">Reversed</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button variant="secondary" onClick={loadEntries}>
            Filter
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="ti ti-file-text" style={{ fontSize: 36 }} />
          <p className="mt-2 text-sm">No journal entries found.</p>
          {user?.is_tenant_admin && (
            <p className="text-xs mt-1">
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => router.push("/dashboard/business/accounting/journal-entries/new")}
              >
                Create the first one
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Reference</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Description</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Source</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">Total DR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <>
                  <tr
                    key={e.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(e.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{e.reference_number}</td>
                    <td className="px-4 py-3 text-gray-700">{e.entry_date}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{e.description}</td>
                    <td className="px-4 py-3 text-gray-500">{SOURCE_LABELS[e.source] ?? e.source}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[e.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {formatMoney(Number(e.total_debit))}
                    </td>
                  </tr>
                  {expandedId === e.id && (
                    <tr key={`${e.id}-detail`}>
                      <td colSpan={6} className="px-4 pb-4 pt-0 bg-gray-50">
                        {detailLoading ? (
                          <p className="text-xs text-gray-400 py-2">Loading lines…</p>
                        ) : expandedDetail ? (
                          <DetailLines entry={expandedDetail} />
                        ) : (
                          <p className="text-xs text-red-500 py-2">Could not load line detail.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}

interface EntryLine {
  line_number: number;
  gl_number: string;
  gl_name: string;
  debit: string;
  credit: string;
  description?: string;
}

function DetailLines({ entry }: { entry: Record<string, unknown> }) {
  const lines = (entry.lines ?? []) as EntryLine[];
  return (
    <div className="mt-2">
      <table className="min-w-full text-xs border border-gray-200 rounded">
        <thead className="bg-white border-b border-gray-200">
          <tr>
            <th className="text-left px-3 py-2 text-gray-500">#</th>
            <th className="text-left px-3 py-2 text-gray-500">GL Account</th>
            <th className="text-left px-3 py-2 text-gray-500">Description</th>
            <th className="text-right px-3 py-2 text-gray-500">Debit</th>
            <th className="text-right px-3 py-2 text-gray-500">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {lines.map((ln) => (
            <tr key={ln.line_number}>
              <td className="px-3 py-1.5 text-gray-400">{ln.line_number}</td>
              <td className="px-3 py-1.5 font-mono">{ln.gl_number} <span className="text-gray-500 font-sans">{ln.gl_name}</span></td>
              <td className="px-3 py-1.5 text-gray-500">{ln.description ?? "—"}</td>
              <td className="px-3 py-1.5 text-right">{Number(ln.debit) > 0 ? formatMoney(Number(ln.debit)) : "—"}</td>
              <td className="px-3 py-1.5 text-right">{Number(ln.credit) > 0 ? formatMoney(Number(ln.credit)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
