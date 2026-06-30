"use client";

/**
 * Period Management page — M8.3 Brief 4 Part B.
 *
 * Route: /dashboard/business/setup/periods
 * Title: "Period management"
 * Subtitle: "Fiscal year, periods, grace controls, and close."
 *
 * Tab 1 — Fiscal year & periods:
 *   • Fiscal year settings (4 FY fields only — does NOT send org_configuration)
 *   • Generate periods (POST /api/setup/periods/generate)
 *   • Period grid with status badges and hard-close action
 *   • Year-end strip: management close → audit-pending + countdown → statutory close
 *
 * Tab 2 — Grace overrides:
 *   • Grace override table CRUD
 *   • Manual-journal block toggle
 *
 * Tab 3 — Close checklist:
 *   • Checklist template CRUD
 *   • Per-period prepare/approve view
 *
 * Matches Tax page visual language: same tab bar, card/section style, save button style.
 */

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "periods" | "grace" | "checklist";

interface OrgSettings {
  fiscal_year_start_month?: number;
  fiscal_year_start_day?: number;
  fiscal_year_name_format?: string;
  period_closing_frequency?: string;
  date_of_registration?: string;
  first_fiscal_year_end?: string;
}

interface AccountingPeriod {
  id: string;
  fiscal_year: string;
  period_no: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
  hard_closed_at?: string | null;
  soft_closed_at?: string | null;
  grace_expires_at?: string | null;
  reopened_count: number;
}

interface FiscalYearState {
  id?: string;
  fiscal_year: string;
  status: string;
  management_closed_at?: string | null;
  management_closed_by?: string | null;
  audit_grace_months: number;
  audit_grace_expires_at?: string | null;
  statutory_closed_at?: string | null;
  retained_earnings_rolled: boolean;
}

interface GraceOverride {
  id: string;
  module: string;
  applies_to_type: string;
  applies_to_role?: string | null;
  applies_to_user_id?: string | null;
  period_type: string;
  grace_value: number;
  grace_unit: string;
  is_default: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  description?: string | null;
  applies_to: string;
  sort_order: number;
  is_active: boolean;
}

interface ChecklistEntry {
  checklist_item_id: string;
  label: string;
  applies_to: string;
  sort_order: number;
  completion_id?: string | null;
  status: string;
  prepared_by?: string | null;
  approved_by?: string | null;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function TabBtn({
  id,
  active,
  onClick,
  label,
}: {
  id: Tab;
  active: boolean;
  onClick: (t: Tab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const YEAR_FORMAT_OPTIONS = [
  { label: "YYYY",                value: "YYYY",                description: "e.g. 2025" },
  { label: "FYYYYY",              value: "FYYYYY",              description: "e.g. FY2025" },
  { label: "YYYY/YYYY",           value: "YYYY/YYYY",           description: "e.g. 2025/2026" },
  { label: "YYYY-YYYY",           value: "YYYY-YYYY",           description: "e.g. 2025-2026" },
  { label: "MMM YYYY - MMM YYYY", value: "MMM YYYY - MMM YYYY", description: "e.g. Jan 2025 - Dec 2025" },
];

/**
 * Apply a fiscal year name format template to a specific year.
 *
 * Handles new format codes (YYYY, FYYYYY, YYYY/YYYY, YYYY-YYYY,
 * MMM YYYY - MMM YYYY) and legacy codes ({year}, {nextyear}, MMM)
 * for backward compatibility.
 *
 * @param fmt        Format string from YEAR_FORMAT_OPTIONS or orgSettings.
 * @param year       The FY start year (defaults to current calendar year).
 * @param startMonth The FY start month 1–12 (defaults to 1 = January),
 *                   used for the MMM YYYY - MMM YYYY format end-month.
 */
const previewYearFormat = (fmt: string, year?: number, startMonth?: number): string => {
  const y = year ?? new Date().getFullYear();
  const nextY = y + 1;
  const sm = startMonth ?? 1;

  // Start month abbreviation
  const startMon = new Date(y, sm - 1, 1).toLocaleString("en", { month: "short" });
  // End month = month immediately before start month
  const endMonNum = ((sm - 2 + 12) % 12) + 1;  // 1-based
  const endMon = new Date(y, endMonNum - 1, 1).toLocaleString("en", { month: "short" });
  // End year: same as start year when the end month falls later in the calendar;
  // next year when the end month wraps around (e.g. Apr→Mar crosses a year boundary).
  const endYear = endMonNum >= sm ? y : nextY;

  return fmt
    // New format codes — FYYYYY before YYYY to avoid partial match
    .replace("FYYYYY", `FY${y}`)
    .replace("YYYY/YYYY", `${y}/${nextY}`)
    .replace("YYYY-YYYY", `${y}-${nextY}`)
    .replace("MMM YYYY - MMM YYYY", `${startMon} ${y} - ${endMon} ${endYear}`)
    .replace("YYYY", `${y}`)
    // Legacy template codes (backward compat)
    .replace("{year}", `${y}`)
    .replace("{nextyear}", `${nextY}`)
    .replace(/MMM/g, startMon);
};

/** Extract the first 4-digit year from a stored fiscal_year label (e.g. "FY2026" → 2026). */
const parseFYYear = (fy: string): number | null => {
  const m = fy.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
};

/**
 * Re-format a stored fiscal_year label using the tenant's current name format.
 *
 * For the "MMM YYYY - MMM YYYY" format, derives the displayed month range from
 * the ACTUAL period start/end dates in `fyPeriodsForLabel` when provided, not
 * from the tenant's currently configured start month. This matters for a
 * registration-truncated stub first year (e.g. periods running Aug-Dec): using
 * the configured start month would always render "Jan YYYY - Dec YYYY" even
 * though no period before the registration month exists. Other formats
 * (YYYY, FYYYYY, etc.) don't encode months, so they always use the generic
 * preview regardless.
 *
 * Falls back to the raw stored value if no year can be parsed.
 */
const formatFY = (
  fy: string,
  fmt: string,
  startMonth?: number,
  fyPeriodsForLabel?: AccountingPeriod[],
): string => {
  const year = parseFYYear(fy);
  if (year === null) return fy;

  if (fmt === "MMM YYYY - MMM YYYY" && fyPeriodsForLabel && fyPeriodsForLabel.length > 0) {
    const sorted = [...fyPeriodsForLabel].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startMon = new Date(first.start_date).toLocaleString("en", { month: "short", timeZone: "UTC" });
    const endMon = new Date(last.end_date).toLocaleString("en", { month: "short", timeZone: "UTC" });
    const startY = new Date(first.start_date).getUTCFullYear();
    const endY = new Date(last.end_date).getUTCFullYear();
    return `${startMon} ${startY} - ${endMon} ${endY}`;
  }

  return previewYearFormat(fmt, year, startMonth);
};

const STATUS_COLORS: Record<string, string> = {
  FUTURE: "bg-gray-100 text-gray-600",
  OPEN: "bg-blue-100 text-blue-700",
  SOFT_CLOSED: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-orange-100 text-orange-700",
  HARD_CLOSED: "bg-green-100 text-green-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PeriodsContent() {
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "periods");

  const handleTabChange = (t: Tab) => {
    setTab(t);
    router.replace(`?tab=${t}`, { scroll: false });
  };
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fiscal year & periods state ───────────────────────────────────────────
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({});
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [selectedFY, setSelectedFY] = useState<string>("");
  const [fyState, setFyState] = useState<FiscalYearState | null>(null);
  const [loadingFyState, setLoadingFyState] = useState(false);
  const [closingMgmt, setClosingMgmt] = useState(false);
  const [closingStat, setClosingStat] = useState(false);
  const [hardClosing, setHardClosing] = useState<string | null>(null);
  const [hardCloseMsg, setHardCloseMsg] = useState<string | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);

  // ── Grace overrides state ─────────────────────────────────────────────────
  const [graceRows, setGraceRows] = useState<GraceOverride[]>([]);
  const [journalBlock, setJournalBlock] = useState(true);
  const [newGrace, setNewGrace] = useState({
    module: "default",
    applies_to_type: "all",
    applies_to_role: "",
    applies_to_user_id: "",
    period_type: "regular",
    grace_value: 5,
    grace_unit: "workdays",
  });
  const [addingGrace, setAddingGrace] = useState(false);
  const [togglingBlock, setTogglingBlock] = useState(false);

  // ── Checklist state ───────────────────────────────────────────────────────
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemAppliesTo, setNewItemAppliesTo] = useState<"every_close" | "year_end_only">("every_close");
  const [addingItem, setAddingItem] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [checklistEntries, setChecklistEntries] = useState<ChecklistEntry[]>([]);
  const [entryAction, setEntryAction] = useState<string | null>(null);

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadOrg = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<OrgSettings>("/api/setup/org", { token: accessToken });
      setOrgSettings(data);
    } catch {
      /* silently fail */
    }
  }, [accessToken]);

  const loadPeriods = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<AccountingPeriod[]>("/api/setup/periods", { token: accessToken });
      setPeriods(data);
      if (data.length > 0 && !selectedFY) {
        const fys = [...new Set(data.map((p) => p.fiscal_year))].sort();
        setSelectedFY(fys[fys.length - 1]);
      }
    } catch {
      /* silently fail */
    }
  }, [accessToken, selectedFY]);

  const loadFyState = useCallback(async (fy: string) => {
    if (!accessToken || !fy) return;
    setLoadingFyState(true);
    try {
      const data = await apiFetch<FiscalYearState>(
        `/api/setup/periods/year-state?fiscal_year=${encodeURIComponent(fy)}`,
        { token: accessToken }
      );
      setFyState(data);
    } catch {
      /* silently fail */
    } finally {
      setLoadingFyState(false);
    }
  }, [accessToken]);

  const loadGrace = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [rows, block] = await Promise.all([
        apiFetch<GraceOverride[]>("/api/setup/periods/grace", { token: accessToken }),
        apiFetch<{ enabled: boolean }>("/api/setup/periods/journal-block", { token: accessToken }),
      ]);
      setGraceRows(rows);
      setJournalBlock(block.enabled);
    } catch {
      /* silently fail */
    }
  }, [accessToken]);

  const loadChecklist = useCallback(async () => {
    if (!accessToken) return;
    try {
      const items = await apiFetch<ChecklistItem[]>("/api/setup/periods/checklist", { token: accessToken });
      setChecklistItems(items);
    } catch {
      /* silently fail */
    }
  }, [accessToken]);

  const loadPeriodChecklist = useCallback(async (pid: string) => {
    if (!accessToken || !pid) return;
    try {
      const entries = await apiFetch<ChecklistEntry[]>(
        `/api/setup/periods/${pid}/checklist`,
        { token: accessToken }
      );
      setChecklistEntries(entries);
    } catch {
      /* silently fail */
    }
  }, [accessToken]);

  useEffect(() => {
    Promise.all([loadOrg(), loadPeriods()]).finally(() => setIsLoading(false));
  }, [loadOrg, loadPeriods]);

  useEffect(() => {
    if (selectedFY) loadFyState(selectedFY);
  }, [selectedFY, loadFyState]);

  useEffect(() => {
    if (tab === "grace") loadGrace();
    if (tab === "checklist") loadChecklist();
  }, [tab, loadGrace, loadChecklist]);

  useEffect(() => {
    if (selectedPeriodId) loadPeriodChecklist(selectedPeriodId);
  }, [selectedPeriodId, loadPeriodChecklist]);

  // Current fiscal year name format — used throughout to display all FY labels.
  // Declared before actions so closures (e.g. doStatutoryClose) can reference it.
  const fmt = orgSettings.fiscal_year_name_format ?? "FY{year}";

  // ── Actions ───────────────────────────────────────────────────────────────

  const saveOrg = async () => {
    if (!accessToken) return;
    setSavingOrg(true);
    setError(null);
    try {
      await apiFetch("/api/setup/org", {
        method: "PATCH",
        token: accessToken,
        body: {
          fiscal_year_name_format: orgSettings.fiscal_year_name_format ?? null,
          period_closing_frequency: orgSettings.period_closing_frequency ?? null,
        },
      });
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingOrg(false);
    }
  };

  const hardClosePeriod = async (periodId: string) => {
    if (!accessToken) return;
    setHardClosing(periodId);
    setHardCloseMsg(null);
    try {
      await apiFetch(`/api/setup/periods/${periodId}/hard-close`, {
        method: "POST",
        token: accessToken,
      });
      await loadPeriods();
      await loadFyState(selectedFY);
    } catch (e) {
      setHardCloseMsg(e instanceof Error ? e.message : "Hard close failed");
    } finally {
      setHardClosing(null);
    }
  };

  const requestReopen = async (periodId: string) => {
    if (!accessToken) return;
    setReopening(periodId);
    setHardCloseMsg(null);
    try {
      await apiFetch(`/api/setup/periods/${periodId}/reopen`, {
        method: "POST",
        token: accessToken,
      });
      await loadPeriods();
      await loadFyState(selectedFY);
    } catch (e) {
      setHardCloseMsg(e instanceof Error ? e.message : "Reopen request failed");
    } finally {
      setReopening(null);
    }
  };

  const doManagementClose = async () => {
    if (!accessToken || !selectedFY) return;
    setClosingMgmt(true);
    setError(null);
    try {
      const data = await apiFetch<FiscalYearState>("/api/setup/periods/management-close", {
        method: "POST",
        token: accessToken,
        body: { fiscal_year_label: selectedFY },
      });
      setFyState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Management close failed");
    } finally {
      setClosingMgmt(false);
    }
  };

  const doStatutoryClose = async () => {
    if (!accessToken || !selectedFY) return;
    if (!window.confirm(`Permanently lock ${formatFY(selectedFY, fmt, orgSettings.fiscal_year_start_month, fyPeriods)}? This is irreversible.`)) return;
    setClosingStat(true);
    setError(null);
    try {
      const data = await apiFetch<FiscalYearState>("/api/setup/periods/statutory-close", {
        method: "POST",
        token: accessToken,
        body: { fiscal_year_label: selectedFY },
      });
      setFyState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Statutory close failed");
    } finally {
      setClosingStat(false);
    }
  };

  const addGraceRow = async () => {
    if (!accessToken) return;
    setAddingGrace(true);
    try {
      const body: Record<string, unknown> = {
        module: newGrace.module,
        applies_to_type: newGrace.applies_to_type,
        period_type: newGrace.period_type,
        grace_value: newGrace.grace_value,
        grace_unit: newGrace.grace_unit,
      };
      if (newGrace.applies_to_type === "role" && newGrace.applies_to_role)
        body.applies_to_role = newGrace.applies_to_role;
      if (newGrace.applies_to_type === "user" && newGrace.applies_to_user_id)
        body.applies_to_user_id = newGrace.applies_to_user_id;

      await apiFetch("/api/setup/periods/grace", { method: "POST", token: accessToken, body });
      await loadGrace();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add grace failed");
    } finally {
      setAddingGrace(false);
    }
  };

  const deleteGraceRow = async (id: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/setup/periods/grace/${id}`, { method: "DELETE", token: accessToken });
      await loadGrace();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleJournalBlock = async () => {
    if (!accessToken) return;
    setTogglingBlock(true);
    try {
      const res = await apiFetch<{ enabled: boolean }>("/api/setup/periods/journal-block", {
        method: "PATCH",
        token: accessToken,
        body: { enabled: !journalBlock },
      });
      setJournalBlock(res.enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setTogglingBlock(false);
    }
  };

  const addChecklistItem = async () => {
    if (!accessToken || !newItemLabel.trim()) return;
    setAddingItem(true);
    try {
      await apiFetch("/api/setup/periods/checklist", {
        method: "POST",
        token: accessToken,
        body: { label: newItemLabel.trim(), applies_to: newItemAppliesTo, sort_order: checklistItems.length },
      });
      setNewItemLabel("");
      await loadChecklist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAddingItem(false);
    }
  };

  const toggleChecklistItem = async (item: ChecklistItem) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/setup/periods/checklist/${item.id}`, {
        method: "PATCH",
        token: accessToken,
        body: { is_active: !item.is_active },
      });
      await loadChecklist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const prepareEntry = async (periodId: string, itemId: string) => {
    if (!accessToken) return;
    setEntryAction(itemId + ":prepare");
    try {
      await apiFetch(`/api/setup/periods/${periodId}/checklist/${itemId}/prepare`, {
        method: "POST",
        token: accessToken,
      });
      await loadPeriodChecklist(periodId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setEntryAction(null);
    }
  };

  const approveEntry = async (periodId: string, itemId: string) => {
    if (!accessToken) return;
    setEntryAction(itemId + ":approve");
    try {
      await apiFetch(`/api/setup/periods/${periodId}/checklist/${itemId}/approve`, {
        method: "POST",
        token: accessToken,
      });
      await loadPeriodChecklist(periodId);
    } catch (e) {
      setError(e instanceof Error ? e.message : e instanceof Error ? e.message : "Approve failed — ensure a different user approves (segregation of duties)");
    } finally {
      setEntryAction(null);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const uniqueFYs = [...new Set(periods.map((p) => p.fiscal_year))].sort();
  const fyPeriods = periods.filter((p) => p.fiscal_year === selectedFY);
  // The FY's final period -- highest period_no, NOT a hardcoded 12. A
  // registration-truncated stub first year can have fewer than 12 periods
  // (e.g. Aug-Dec = 5), and a hardcoded 12 would never match, permanently
  // hiding the Year-end close section for that year.
  const decPeriod = fyPeriods.length > 0
    ? fyPeriods.reduce((latest, p) => (p.period_no > latest.period_no ? p : latest))
    : undefined;

  // Earliest non-hard-closed period across all FYs (sequential close gate)
  const earliestOpen = [...periods]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .find((p) => p.status !== "HARD_CLOSED");

  const canManagementClose =
    fyState?.status === "OPEN" && decPeriod?.status === "HARD_CLOSED";
  const canStatutoryClose =
    fyState?.status === "AUDIT_PENDING" || fyState?.status === "AUDIT_OVERDUE";


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer maxWidth="4xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <PageHeading title="Period management" />
      <p className="text-sm text-gray-500 mb-6">
        Fiscal year, periods, grace controls, and close.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="periods" active={tab === "periods"} onClick={handleTabChange} label="Fiscal year & periods" />
        <TabBtn id="grace" active={tab === "grace"} onClick={handleTabChange} label="Grace overrides" />
        <TabBtn id="checklist" active={tab === "checklist"} onClick={handleTabChange} label="Close checklist" />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Tab 1: Fiscal year & periods ── */}
      {tab === "periods" && (
        <div className="space-y-6">

          {/* Fiscal year settings */}
          <section className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Fiscal year settings</h2>
            {orgSettings.date_of_registration && (
              <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md">
                <i className="ti ti-info-circle text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                <p className="text-xs text-blue-700">
                  Period generation cannot create periods before your registration date:{" "}
                  <strong>{orgSettings.date_of_registration}</strong>.
                </p>
              </div>
            )}
            {!orgSettings.first_fiscal_year_end && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-md">
                <i className="ti ti-alert-triangle text-amber-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
                <p className="text-xs text-amber-700">
                  First fiscal year end is not set yet. Set it on the{" "}
                  <a href="/dashboard/business/setup/organisation" className="underline font-medium">
                    Organisation → Identity
                  </a>{" "}
                  tab — start month/day below are derived from it automatically.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Year name format</label>
                <select
                  value={orgSettings.fiscal_year_name_format ?? "FYYYYY"}
                  onChange={(e) =>
                    setOrgSettings((s) => ({ ...s, fiscal_year_name_format: e.target.value }))
                  }
                  className={inputCls}
                >
                  {YEAR_FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Preview: {previewYearFormat(
                    orgSettings.fiscal_year_name_format ?? "FYYYYY",
                    undefined,
                    orgSettings.fiscal_year_start_month,
                  )}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Closing frequency</label>
                <select
                  value={orgSettings.period_closing_frequency ?? ""}
                  onChange={(e) =>
                    setOrgSettings((s) => ({ ...s, period_closing_frequency: e.target.value || undefined }))
                  }
                  className={inputCls}
                >
                  <option value="">— select —</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="primary"
                onClick={saveOrg}
                disabled={savingOrg}
                loading={savingOrg}
              >
                {savingOrg ? "Saving…" : "Save settings"}
              </Button>
              {orgSaved && <span className="text-sm text-green-600">Saved</span>}
            </div>
            <p className="text-xs text-gray-400">
              Saving these settings will automatically generate periods for the current fiscal year if not already created.
            </p>
          </section>

          {/* Period grid */}
          {uniqueFYs.length > 0 && (
            <section className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Period grid</h2>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Fiscal year:</label>
                  <select
                    value={selectedFY}
                    onChange={(e) => setSelectedFY(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {uniqueFYs.map((fy) => (
                      <option key={fy} value={fy}>{formatFY(fy, fmt, orgSettings.fiscal_year_start_month, periods.filter((p) => p.fiscal_year === fy))}</option>
                    ))}
                  </select>
                </div>
              </div>

              {hardCloseMsg && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {hardCloseMsg}
                  <button type="button" onClick={() => setHardCloseMsg(null)} className="ml-2 text-red-400">✕</button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-2 font-medium text-gray-500 w-6">#</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Period</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Dates</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Status</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Grace ends</th>
                      <th className="py-2 px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {fyPeriods.map((p) => {
                      const isEarliestOpen = earliestOpen?.id === p.id;
                      const canClose = isEarliestOpen && p.status !== "HARD_CLOSED";
                      const graceLeft = p.grace_expires_at ? daysUntil(p.grace_expires_at) : null;
                      return (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-400">{p.period_no}</td>
                          <td className="py-2 px-2 font-medium text-gray-800">{p.period_name}</td>
                          <td className="py-2 px-2 text-gray-500">
                            {p.start_date} – {p.end_date}
                          </td>
                          <td className="py-2 px-2">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-2 px-2 text-gray-500">
                            {graceLeft !== null && p.status === "SOFT_CLOSED" ? (
                              <span className={graceLeft <= 0 ? "text-red-600" : "text-amber-600"}>
                                {graceLeft > 0 ? `${graceLeft}d` : "Expired"}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {p.status !== "HARD_CLOSED" && (
                              <button
                                type="button"
                                onClick={() => canClose ? hardClosePeriod(p.id) : undefined}
                                disabled={!canClose || hardClosing === p.id}
                                title={!canClose ? "Close earlier periods first" : "Hard-close this period"}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                  canClose
                                    ? "bg-gray-800 text-white hover:bg-gray-900"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                              >
                                {hardClosing === p.id ? "Closing…" : "Hard close"}
                              </button>
                            )}
                            {p.status === "HARD_CLOSED" &&
                              user?.is_super_admin &&
                              fyState?.status !== "STATUTORY_CLOSED" && (
                                <button
                                  type="button"
                                  onClick={() => requestReopen(p.id)}
                                  disabled={reopening === p.id}
                                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                                >
                                  {reopening === p.id ? "Requesting…" : "Request reopen"}
                                </button>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Year-end strip */}
          {selectedFY && decPeriod && (
            <section className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Year-end close — {formatFY(selectedFY, fmt, orgSettings.fiscal_year_start_month, fyPeriods)}</h2>
                {loadingFyState && <span className="text-xs text-gray-400">Loading…</span>}
              </div>

              {fyState && (
                <>
                  {/* Current year status */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">Year status:</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        fyState.status === "STATUTORY_CLOSED"
                          ? "bg-green-100 text-green-700"
                          : fyState.status === "AUDIT_OVERDUE"
                          ? "bg-red-100 text-red-700"
                          : fyState.status === "AUDIT_PENDING"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {fyState.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Stage 1 — management close */}
                  {fyState.status === "OPEN" && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">
                        <strong>Stage 1 — Management close:</strong> hard-close {decPeriod?.period_name ?? "the final period"} first, then click to roll the year.
                        The new fiscal year remains open and runs normally while audit proceeds.
                      </p>
                      <Button
                        variant="primary"
                        onClick={doManagementClose}
                        disabled={!canManagementClose || closingMgmt}
                        loading={closingMgmt}
                        title={!canManagementClose ? "December must be hard-closed first" : undefined}
                      >
                        {closingMgmt ? "Processing…" : "Management close"}
                      </Button>
                      {!canManagementClose && (
                        <p className="text-xs text-amber-600">{decPeriod?.period_name ?? "The final period"} must be hard-closed before management close.</p>
                      )}
                    </div>
                  )}

                  {/* Audit pending / overdue panel */}
                  {(fyState.status === "AUDIT_PENDING" || fyState.status === "AUDIT_OVERDUE") && (
                    <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <i className="ti ti-clock text-amber-600 flex-shrink-0 mt-0.5" style={{ fontSize: 14 }} />
                        <div>
                          <p className="text-xs font-medium text-amber-800">Audit in progress</p>
                          <p className="text-xs text-amber-700">
                            Management closed{" "}
                            {fyState.management_closed_at
                              ? new Date(fyState.management_closed_at).toLocaleDateString()
                              : ""}
                            . Grace window: {fyState.audit_grace_months} months.
                          </p>
                          {fyState.audit_grace_expires_at && (
                            <p className="text-xs text-amber-700 mt-0.5">
                              Grace expires:{" "}
                              {new Date(fyState.audit_grace_expires_at).toLocaleDateString()}{" "}
                              {daysUntil(fyState.audit_grace_expires_at) > 0
                                ? `(${daysUntil(fyState.audit_grace_expires_at)} days remaining)`
                                : "(expired)"}
                            </p>
                          )}
                          {fyState.status === "AUDIT_OVERDUE" && (
                            <p className="text-xs text-red-700 mt-1 font-medium">
                              Audit grace expired — statutory close overdue. The new fiscal year continues normally.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stage 2 — statutory close */}
                      <div className="pt-1 border-t border-amber-200">
                        <p className="text-xs text-gray-600 mb-2">
                          <strong>Stage 2 — Statutory close (permanent):</strong> permanently locks this fiscal year.
                          All periods in {formatFY(selectedFY, fmt, orgSettings.fiscal_year_start_month, fyPeriods)} will be locked for posting and reopen. This cannot be undone.
                        </p>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="danger"
                            onClick={doStatutoryClose}
                            disabled={!canStatutoryClose || closingStat}
                            loading={closingStat}
                          >
                            {closingStat ? "Locking…" : "Statutory close (permanent)"}
                          </Button>
                          <span className="text-xs text-gray-400 italic">
                            Audit artifacts &amp; CFO sign-off — coming in M8.4
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Statutory closed badge */}
                  {fyState.status === "STATUTORY_CLOSED" && (
                    <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <i className="ti ti-lock text-green-600 flex-shrink-0 mt-0.5" style={{ fontSize: 14 }} />
                      <div>
                        <p className="text-xs font-medium text-green-800">Fiscal year permanently locked</p>
                        <p className="text-xs text-green-700">
                          Statutory close completed{" "}
                          {fyState.statutory_closed_at
                            ? new Date(fyState.statutory_closed_at).toLocaleDateString()
                            : ""}
                          . All periods in {formatFY(selectedFY, fmt, orgSettings.fiscal_year_start_month, fyPeriods)} are locked for posting and reopen.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── Tab 2: Grace overrides ── */}
      {tab === "grace" && (
        <div className="space-y-6">

          {/* Journal-block toggle */}
          <section className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Manual-journal block</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  When on (default), manual journal entries into a period are blocked while any earlier period is not yet hard-closed.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleJournalBlock}
                disabled={togglingBlock}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  journalBlock ? "bg-blue-600" : "bg-gray-300"
                } disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    journalBlock ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Grace rows */}
          <section className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Grace override rows</h2>
            <p className="text-xs text-gray-500">
              Define how many days after soft-close posting is still allowed. The default row seeds all tenants (3 workdays).
              Add rows for specific modules, roles, or users to override.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Module", "Applies to", "Period type", "Grace", "Unit", "Default", ""].map((h) => (
                      <th key={h} className="text-left py-2 px-2 font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {graceRows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2">{r.module}</td>
                      <td className="py-2 px-2">
                        {r.applies_to_type}
                        {r.applies_to_role ? ` (${r.applies_to_role})` : ""}
                        {r.applies_to_user_id ? ` (user)` : ""}
                      </td>
                      <td className="py-2 px-2">{r.period_type}</td>
                      <td className="py-2 px-2 font-medium">{r.grace_value}</td>
                      <td className="py-2 px-2">{r.grace_unit}</td>
                      <td className="py-2 px-2">{r.is_default ? "Yes" : "—"}</td>
                      <td className="py-2 px-2 text-right">
                        {!r.is_default && (
                          <button
                            type="button"
                            onClick={() => deleteGraceRow(r.id)}
                            className="text-red-400 hover:text-red-600 text-[11px]"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row */}
            <div className="border border-dashed border-gray-300 rounded-md p-3 space-y-3">
              <p className="text-xs font-medium text-gray-600">Add grace override row</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Module</label>
                  <select
                    value={newGrace.module}
                    onChange={(e) => setNewGrace((g) => ({ ...g, module: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  >
                    {["default", "expense", "manual_journal", "future_exception"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Applies to</label>
                  <select
                    value={newGrace.applies_to_type}
                    onChange={(e) => setNewGrace((g) => ({ ...g, applies_to_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  >
                    <option value="all">All</option>
                    <option value="role">Role</option>
                    <option value="user">User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Period type</label>
                  <select
                    value={newGrace.period_type}
                    onChange={(e) => setNewGrace((g) => ({ ...g, period_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  >
                    <option value="regular">Regular</option>
                    <option value="year_end">Year-end</option>
                  </select>
                </div>
                {newGrace.applies_to_type === "role" && (
                  <div className="col-span-2">
                    <label className="block text-[11px] text-gray-500 mb-1">Role tier</label>
                    <input
                      type="text"
                      placeholder="e.g. consultant"
                      value={newGrace.applies_to_role}
                      onChange={(e) => setNewGrace((g) => ({ ...g, applies_to_role: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                )}
                {newGrace.applies_to_type === "user" && (
                  <div className="col-span-2">
                    <label className="block text-[11px] text-gray-500 mb-1">User ID (UUID)</label>
                    <input
                      type="text"
                      placeholder="uuid"
                      value={newGrace.applies_to_user_id}
                      onChange={(e) => setNewGrace((g) => ({ ...g, applies_to_user_id: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Grace value</label>
                  <input
                    type="number"
                    min={1}
                    value={newGrace.grace_value}
                    onChange={(e) => setNewGrace((g) => ({ ...g, grace_value: +e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Unit</label>
                  <select
                    value={newGrace.grace_unit}
                    onChange={(e) => setNewGrace((g) => ({ ...g, grace_unit: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  >
                    <option value="workdays">Workdays</option>
                    <option value="calendar_days">Calendar days</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={addGraceRow}
                disabled={addingGrace}
                className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {addingGrace ? "Adding…" : "+ Add row"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Tab 3: Close checklist ── */}
      {tab === "checklist" && (
        <div className="space-y-6">

          {/* Template */}
          <section className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Checklist template</h2>
            <p className="text-xs text-gray-500">
              Define items that must be prepared and approved before a period can be hard-closed.
              &ldquo;Every close&rdquo; items apply to all periods; &ldquo;year-end only&rdquo; items apply only to December (period 12).
              Empty checklist = hard-close is ungated.
            </p>

            <div className="space-y-1">
              {checklistItems.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">No checklist items yet.</p>
              )}
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-3 py-2 rounded border ${
                    item.is_active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-800">{item.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {item.applies_to === "every_close" ? "Every close" : "Year-end only"}
                    </span>
                    {!item.is_active && (
                      <span className="text-[10px] text-gray-400">Inactive</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleChecklistItem(item)}
                    className="text-xs text-gray-400 hover:text-gray-700"
                  >
                    {item.is_active ? "Deactivate" : "Restore"}
                  </button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="border border-dashed border-gray-300 rounded-md p-3 space-y-2">
              <p className="text-xs font-medium text-gray-600">Add item</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Label (e.g. Bank reconciliation completed)"
                  value={newItemLabel}
                  onChange={(e) => setNewItemLabel(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                />
                <select
                  value={newItemAppliesTo}
                  onChange={(e) => setNewItemAppliesTo(e.target.value as "every_close" | "year_end_only")}
                  className="border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="every_close">Every close</option>
                  <option value="year_end_only">Year-end only</option>
                </select>
                <button
                  type="button"
                  onClick={addChecklistItem}
                  disabled={addingItem || !newItemLabel.trim()}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {addingItem ? "Adding…" : "+ Add"}
                </button>
              </div>
            </div>
          </section>

          {/* Per-period completion */}
          <section className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Per-period sign-off</h2>
            <p className="text-xs text-gray-500">
              Select a period to prepare and approve applicable checklist items.
              Preparer ≠ approver is enforced server-side.
            </p>

            <div className="flex items-center gap-2 max-w-xs">
              <label className="text-xs text-gray-500 whitespace-nowrap">Period:</label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="">— select —</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({formatFY(p.fiscal_year, fmt, orgSettings.fiscal_year_start_month, periods.filter((pp) => pp.fiscal_year === p.fiscal_year))})
                  </option>
                ))}
              </select>
            </div>

            {selectedPeriodId && (
              <div className="space-y-2">
                {checklistEntries.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No applicable items for this period.</p>
                )}
                {checklistEntries.map((entry) => (
                  <div
                    key={entry.checklist_item_id}
                    className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-800">{entry.label}</p>
                      <p className="text-[11px] text-gray-500">{entry.applies_to.replace("_", " ")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          entry.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : entry.status === "prepared"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {entry.status}
                      </span>
                      {entry.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => prepareEntry(selectedPeriodId, entry.checklist_item_id)}
                          disabled={entryAction === entry.checklist_item_id + ":prepare"}
                          className="px-2 py-0.5 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Prepare
                        </button>
                      )}
                      {entry.status === "prepared" && (
                        <button
                          type="button"
                          onClick={() => approveEntry(selectedPeriodId, entry.checklist_item_id)}
                          disabled={entryAction === entry.checklist_item_id + ":approve"}
                          className="px-2 py-0.5 text-[11px] bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  );
}

export default function PeriodsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <PeriodsContent />
    </Suspense>
  );
}
