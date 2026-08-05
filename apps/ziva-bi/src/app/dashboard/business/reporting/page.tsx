"use client";

/**
 * Analytics Dashboard — /dashboard/business/reporting
 *
 * Displays cross-module KPI summary cards and a 12-month expense trend chart.
 * Provides quick-run buttons for the most useful built-in reports.
 *
 * Tabs:
 *   Overview  — KPI cards + expense trend bar chart
 *   Reports   — list of all built-in report types to run on demand
 *   Saved     — user's saved report definitions
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KpiSection {
  expenses: { mtd_approved: number; ytd_approved: number; pending_count: number; mom_change_pct: number };
  ar:       { outstanding: number; overdue: number; paid_count_mtd: number };
  ap:       { outstanding: number; overdue: number };
  payroll:  { ytd_net_pay: number; draft_runs: number };
  budget:   { ytd_budget: number; ytd_actual: number; variance: number; variance_pct: number };
}

interface DashboardData {
  posting_mode: string;
  kpis: KpiSection;
}

interface ReportRow { [key: string]: unknown }

interface ReportResult {
  report_type: string;
  filters: Record<string, string>;
  row_count: number;
  rows: ReportRow[];
}

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  module: string;
  is_shared: boolean;
  created_at: string;
  last_run_at: string | null;
}

// ── Built-in report catalogue ──────────────────────────────────────────────────

const BUILT_IN_REPORTS = [
  { type: "expense_summary",     label: "Expense Summary",           module: "expense",     icon: "receipt" },
  { type: "expense_by_category", label: "Expense by Category",       module: "expense",     icon: "tag" },
  { type: "ar_aging",            label: "AR Aging",                  module: "ar",          icon: "credit-card" },
  { type: "ap_aging",            label: "AP Aging",                  module: "ap",          icon: "invoice" },
  { type: "budget_variance",     label: "Budget Variance",           module: "budget",      icon: "chart-bar" },
  { type: "payroll_summary",     label: "Payroll Summary",           module: "payroll",     icon: "wallet" },
  { type: "tax_summary",         label: "Tax Summary",               module: "tax",         icon: "calculator" },
  { type: "inventory_valuation", label: "Inventory Valuation",       module: "inventory",   icon: "package" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtMoney(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${fmt(n)}`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  color: string;
  trend?: { value: number; label: string };
}) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <i className={`ti ti-${icon}`} style={{ fontSize: 18, color }} />
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trendUp ? "bg-red-50 text-red-600" : trendDown ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500"
            }`}
          >
            {trend.value > 0 ? "▲" : trend.value < 0 ? "▼" : "—"} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Report Runner modal ────────────────────────────────────────────────────────

function ReportModal({
  report,
  onClose,
  accessToken,
}: {
  report: typeof BUILT_IN_REPORTS[number];
  onClose: () => void;
  accessToken: string;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const filters: Record<string, string> = {};
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo)   filters.date_to = dateTo;
      const data = await apiFetch<ReportResult>("/api/reporting/run", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ report_type: report.type, filters }),
      });
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to run report.");
    } finally {
      setRunning(false);
    }
  }

  const columns = result && result.rows.length > 0 ? Object.keys(result.rows[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <i className={`ti ti-${report.icon} text-blue-600`} style={{ fontSize: 16 }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{report.label}</h2>
              <p className="text-xs text-gray-400">Module: {report.module}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date from</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date to</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {running ? <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 14 }} /> : <i className="ti ti-player-play" style={{ fontSize: 14 }} />}
            {running ? "Running…" : "Run report"}
          </button>
          {result && (
            <span className="text-xs text-gray-500 ml-auto">{result.row_count} rows</span>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="p-6 text-sm text-red-600">{error}</div>
          )}
          {!result && !running && !error && (
            <div className="p-10 text-center text-gray-400 text-sm">
              <i className="ti ti-report-analytics block mb-2" style={{ fontSize: 32 }} />
              Set filters and click Run to see results.
            </div>
          )}
          {result && result.rows.length === 0 && (
            <div className="p-10 text-center text-gray-400 text-sm">No data found for the selected filters.</div>
          )}
          {result && result.rows.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="text-left px-4 py-2.5 font-semibold text-gray-600 capitalize whitespace-nowrap">
                      {col.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {columns.map(col => {
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
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportingPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "reports" | "saved">("overview");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [activeReport, setActiveReport] = useState<typeof BUILT_IN_REPORTS[number] | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<DashboardData>("/api/reporting/dashboard", { token: accessToken });
      setDashboard(data);
    } catch {
      // silently fail — individual KPIs show 0
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchSaved = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<SavedReport[]>("/api/reporting/saved", { token: accessToken });
      setSavedReports(data);
    } catch { /* empty */ }
  }, [accessToken]);

  useEffect(() => {
    fetchDashboard();
    fetchSaved();
  }, [fetchDashboard, fetchSaved]);

  const kpis = dashboard?.kpis;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeading>Analytics & Reports</PageHeading>
        <div className="flex gap-2">
          <Link
            href="/dashboard/business/reporting/saved"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <i className="ti ti-bookmark" style={{ fontSize: 14 }} />
            Saved reports ({savedReports.length})
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {(["overview", "reports", "saved"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-blue-500 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "overview" ? "Overview" : t === "reports" ? "Run a Report" : "Saved"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 h-28 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && kpis && (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  icon="receipt"
                  label="Expenses this month"
                  value={fmtMoney(kpis.expenses.mtd_approved)}
                  sub={`${kpis.expenses.pending_count} pending approvals`}
                  color="#3b82f6"
                  trend={{ value: kpis.expenses.mom_change_pct, label: "vs last month" }}
                />
                <KpiCard
                  icon="credit-card"
                  label="AR outstanding"
                  value={fmtMoney(kpis.ar.outstanding)}
                  sub={`${fmtMoney(kpis.ar.overdue)} overdue`}
                  color="#10b981"
                />
                <KpiCard
                  icon="invoice"
                  label="AP outstanding"
                  value={fmtMoney(kpis.ap.outstanding)}
                  sub={`${fmtMoney(kpis.ap.overdue)} overdue`}
                  color="#f59e0b"
                />
                <KpiCard
                  icon="chart-bar"
                  label="YTD budget variance"
                  value={`${kpis.budget.variance_pct > 0 ? "+" : ""}${kpis.budget.variance_pct}%`}
                  sub={`Budget ${fmtMoney(kpis.budget.ytd_budget)} · Actual ${fmtMoney(kpis.budget.ytd_actual)}`}
                  color="#8b5cf6"
                />
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  icon="wallet"
                  label="YTD payroll (net)"
                  value={fmtMoney(kpis.payroll.ytd_net_pay)}
                  sub={kpis.payroll.draft_runs > 0 ? `${kpis.payroll.draft_runs} draft run(s)` : "All runs finalised"}
                  color="#ec4899"
                />
                <KpiCard
                  icon="trending-up"
                  label="AR paid this month"
                  value={`${kpis.ar.paid_count_mtd}`}
                  sub="invoices collected"
                  color="#06b6d4"
                />
                <KpiCard
                  icon="chart-pie"
                  label="YTD expenses"
                  value={fmtMoney(kpis.expenses.ytd_approved)}
                  sub="approved"
                  color="#f97316"
                />
                <KpiCard
                  icon="arrows-transfer-up"
                  label="Budget vs actual"
                  value={fmtMoney(Math.abs(kpis.budget.variance))}
                  sub={kpis.budget.variance >= 0 ? "under budget" : "over budget"}
                  color={kpis.budget.variance >= 0 ? "#10b981" : "#ef4444"}
                />
              </div>
            </>
          )}

          {/* Quick access to built-in reports */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick reports</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {BUILT_IN_REPORTS.slice(0, 4).map(r => (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => setActiveReport(r)}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <i className={`ti ti-${r.icon} text-blue-600`} style={{ fontSize: 16 }} />
                  </div>
                  <span className="text-sm font-medium text-gray-800">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === "reports" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-4">
            Click any report to run it with custom date filters. Results can be saved for re-use.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {BUILT_IN_REPORTS.map(r => (
              <button
                key={r.type}
                type="button"
                onClick={() => setActiveReport(r)}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <i className={`ti ti-${r.icon} text-blue-600`} style={{ fontSize: 20 }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                  <p className="text-xs text-gray-400 capitalize">Module: {r.module}</p>
                </div>
                <i className="ti ti-player-play text-gray-300 group-hover:text-blue-500 transition-colors" style={{ fontSize: 16 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SAVED TAB ── */}
      {tab === "saved" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Your saved report definitions.</p>
            <Link
              href="/dashboard/business/reporting/saved"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              Manage saved <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
            </Link>
          </div>
          {savedReports.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <i className="ti ti-bookmark block mb-2" style={{ fontSize: 32 }} />
              No saved reports yet. Run a report and save it for quick access.
            </div>
          ) : (
            <div className="space-y-2">
              {savedReports.map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.report_type.replace(/_/g, " ")} · {r.module}
                      {r.last_run_at && ` · Last run ${new Date(r.last_run_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {r.is_shared && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Shared</span>
                    )}
                    <Link
                      href={`/dashboard/business/reporting/saved/${r.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      Run <i className="ti ti-player-play" style={{ fontSize: 11 }} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report runner modal */}
      {activeReport && accessToken && (
        <ReportModal
          report={activeReport}
          onClose={() => setActiveReport(null)}
          accessToken={accessToken}
        />
      )}
    </PageContainer>
  );
}
