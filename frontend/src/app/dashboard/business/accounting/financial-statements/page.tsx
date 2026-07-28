"use client";

/**
 * Financial Statements — /dashboard/business/accounting/financial-statements
 *
 * Three-tab view: Profit & Loss | Balance Sheet | Cash Flow (Q1b).
 * Full ERP mode only — ModeNotAvailable for Lite and Connected.
 *
 * P&L:
 *   - Date range (period) filters
 *   - Sections grouped by fs_head → fs_note
 *   - Amount = credit − debit (positive = income, negative = expense)
 *   - Shows absolute value for display; labels section type by sign
 *   - Net Income / (Loss) footer
 *
 * Balance Sheet:
 *   - "As at" date filter (cumulative from inception)
 *   - Sections grouped by fs_head → fs_note
 *   - Asset sections: abs(amount) shown as positive asset value
 *   - Liability / Equity sections: positive amounts shown as-is
 *   - Note displayed explaining in-year BS footing behaviour
 *
 * Cash Flow (Q1b — indirect method):
 *   - Period date range filters (same as P&L)
 *   - Three sections: Operating, Investing, Financing
 *   - Starts with net income; adjusts for non-cash items and working capital
 *   - Opening / closing cash reconciliation footer
 *   - Warning banner when BS accounts are untagged (cf_category missing)
 *   - Negative amounts displayed with parentheses (accounting convention)
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Banner } from "@/components/Banner";
import ModeNotAvailable from "@/components/ModeNotAvailable";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FSLineItem {
  gl_number: string;
  gl_name: string;
  total_debit: string;
  total_credit: string;
  amount: string; // credit − debit
}

interface FSGroup {
  label: string;
  items: FSLineItem[];
  subtotal: string;
}

interface FSSection {
  label: string;
  groups: FSGroup[];
  total: string;
}

interface PLData {
  sections: FSSection[];
  net_income: string;
  has_unmapped: boolean;
  date_from: string | null;
  date_to: string | null;
}

interface BSData {
  sections: FSSection[];
  has_unmapped: boolean;
  as_at_date: string | null;
}

// ── Cash Flow types (Q1b) ─────────────────────────────────────────────────────

interface CFLineItem {
  gl_number: string;
  gl_name: string;
  amount: string; // positive = inflow, negative = outflow
}

interface CFGroup {
  label: string;
  items: CFLineItem[];
  subtotal: string;
}

interface CFSection {
  label: string;
  net_income: string | null; // only set on Operating section
  groups: CFGroup[];
  total: string;
}

interface CFData {
  sections: CFSection[];
  net_income: string;
  net_change_in_cash: string;
  opening_cash: string;
  closing_cash: string;
  gl_closing_cash: string;
  has_unmapped: boolean;
  has_untagged_bs: boolean;
  date_from: string | null;
  date_to: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const amt = (v: string | number) => parseFloat(String(v)) || 0;

/** Display amount: always positive, caller decides label/sign. */
const displayAmt = (v: string | number) => formatMoney(Math.abs(amt(v)));

function SectionTable({
  section,
  flipSign,
  indent = false,
}: {
  section: FSSection;
  flipSign: boolean; // true → treat debit-normal (assets, expenses): show |amount|
  indent?: boolean;
}) {
  const sectionAmt = amt(section.total);
  const displayTotal = formatMoney(flipSign ? Math.abs(sectionAmt) : sectionAmt);

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 rounded-t-md border border-gray-200">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
          {section.label}
        </span>
        <span className="font-mono text-sm font-bold text-gray-800">{displayTotal}</span>
      </div>

      <div className="border-l border-r border-b border-gray-200 rounded-b-md overflow-hidden">
        {section.groups.map((group) => (
          <div key={group.label}>
            {/* Group sub-header */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 italic">{group.label}</span>
              <span className="font-mono text-xs text-gray-500">
                {formatMoney(flipSign ? Math.abs(amt(group.subtotal)) : amt(group.subtotal))}
              </span>
            </div>

            {/* Account rows */}
            {group.items.map((item) => (
              <div
                key={item.gl_number}
                className="flex items-center justify-between px-4 py-1.5 border-b border-gray-50 hover:bg-blue-50/30"
              >
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="font-mono text-xs text-blue-600 shrink-0">{item.gl_number}</span>
                  {item.gl_name}
                </span>
                <span className="font-mono text-sm text-gray-700">
                  {displayAmt(item.amount)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── P&L Tab ───────────────────────────────────────────────────────────────────

function PLTab({
  data,
  loading,
  error,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  onLoad,
}: {
  data: PLData | null;
  loading: boolean;
  error: string | null;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  onLoad: () => void;
}) {
  const netIncome = data ? amt(data.net_income) : 0;
  const isProfit = netIncome >= 0;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Period from</label>
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
        <button
          type="button"
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          onClick={onLoad}
        >
          Run
        </button>
        {data && (
          <span className="text-xs text-gray-400 self-end pb-1">
            {data.date_from ? `${data.date_from} — ${data.date_to ?? "present"}` : "All time"}
          </span>
        )}
      </div>

      {error && <Banner variant="error" className="mb-4">{error}</Banner>}

      {loading && <p className="text-sm text-gray-400 py-12 text-center">Loading…</p>}

      {!loading && !data && !error && (
        <p className="text-sm text-gray-400 py-12 text-center">Set a period and click Run.</p>
      )}

      {data && !loading && (
        <>
          {data.has_unmapped && (
            <Banner variant="warning" className="mb-4">
              Some P&amp;L accounts have no <strong>FS Head</strong> assigned — they appear under
              Unclassified. Map them on the Chart of Accounts page for proper grouping.
            </Banner>
          )}

          {data.sections.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">
              No posted transactions found for this period.
            </p>
          ) : (
            <>
              {data.sections.map((section) => {
                // Revenue / income sections have positive section total (credit > debit)
                // Expense sections have negative section total (debit > credit)
                // For display: show absolute amounts throughout; section header labels type
                const sectionNet = amt(section.total);
                const isIncome = sectionNet >= 0;
                return (
                  <SectionTable
                    key={section.label}
                    section={section}
                    flipSign={!isIncome} // expense sections: flip sign for positive display
                  />
                );
              })}

              {/* Net income footer */}
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 mt-2 ${
                  isProfit
                    ? "border-green-300 bg-green-50"
                    : "border-red-300 bg-red-50"
                }`}
              >
                <span className={`text-sm font-bold ${isProfit ? "text-green-800" : "text-red-800"}`}>
                  {isProfit ? "Net Profit" : "Net Loss"}
                </span>
                <span className={`font-mono text-base font-bold ${isProfit ? "text-green-700" : "text-red-700"}`}>
                  {formatMoney(Math.abs(netIncome))}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── BS Tab ────────────────────────────────────────────────────────────────────

/**
 * Asset-section heuristic: the first GL number in the section is < 2000
 * (assets are typically 1xxx in the standard CoA templates).
 * This allows us to display assets as positive values without hardcoding fs_head strings.
 */
function isAssetSection(section: FSSection): boolean {
  const firstGl = section.groups[0]?.items[0]?.gl_number ?? "";
  const firstNum = parseInt(firstGl.replace(/\D/g, ""), 10);
  if (!isNaN(firstNum) && firstNum < 2000) return true;
  // Fallback: section total is negative (assets have debit > credit → amount = CR-DR < 0)
  return amt(section.total) < 0;
}

function BSTab({
  data,
  loading,
  error,
  asAtDate,
  setAsAtDate,
  onLoad,
}: {
  data: BSData | null;
  loading: boolean;
  error: string | null;
  asAtDate: string;
  setAsAtDate: (v: string) => void;
  onLoad: () => void;
}) {
  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">As at date</label>
          <input
            type="date"
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            defaultValue={asAtDate}
            onBlur={(e) => setAsAtDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          onClick={onLoad}
        >
          Run
        </button>
        {data && (
          <span className="text-xs text-gray-400 self-end pb-1">
            {data.as_at_date ? `As at ${data.as_at_date}` : "All time (cumulative)"}
          </span>
        )}
      </div>

      {error && <Banner variant="error" className="mb-4">{error}</Banner>}

      {loading && <p className="text-sm text-gray-400 py-12 text-center">Loading…</p>}

      {!loading && !data && !error && (
        <p className="text-sm text-gray-400 py-12 text-center">Set a date and click Run.</p>
      )}

      {data && !loading && (
        <>
          {data.has_unmapped && (
            <Banner variant="warning" className="mb-4">
              Some balance sheet accounts have no <strong>FS Head</strong> assigned — they appear
              under Unclassified. Map them on the Chart of Accounts page.
            </Banner>
          )}

          <Banner variant="info" className="mb-4">
            The balance sheet will not foot to zero until a year-end closing entry transfers
            net profit into retained earnings. This is expected during the financial year.
          </Banner>

          {data.sections.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">
              No posted transactions found.
            </p>
          ) : (
            data.sections.map((section) => (
              <SectionTable
                key={section.label}
                section={section}
                flipSign={isAssetSection(section)}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}

// ── Cash Flow helpers (Q1b) ───────────────────────────────────────────────────

/**
 * Display a cash flow amount in accounting convention:
 *   positive → ₦1,234,567 (inflow)
 *   negative → (₦1,234,567) (outflow — parentheses instead of minus sign)
 */
function cfDisplay(v: string | number): string {
  const n = parseFloat(String(v)) || 0;
  const formatted = formatMoney(Math.abs(n));
  return n < 0 ? `(${formatted})` : formatted;
}

function CFSectionBlock({ section }: { section: CFSection }) {
  const sectionTotal = parseFloat(String(section.total)) || 0;
  const hasNetIncome = section.net_income !== null;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 rounded-t-md border border-gray-200">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
          {section.label}
        </span>
      </div>
      <div className="border-l border-r border-b border-gray-200 rounded-b-md overflow-hidden">

        {/* Net income line (Operating section only) */}
        {hasNetIncome && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
            <span className="text-sm font-semibold text-blue-800">Net Profit / (Loss)</span>
            <span className="font-mono text-sm font-bold text-blue-800">
              {cfDisplay(section.net_income!)}
            </span>
          </div>
        )}

        {/* Groups */}
        {section.groups.map((group) => (
          <div key={group.label}>
            {/* Group sub-header */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 italic">{group.label}</span>
              <span className="font-mono text-xs text-gray-500">{cfDisplay(group.subtotal)}</span>
            </div>
            {/* Account rows */}
            {group.items.map((item) => (
              <div
                key={item.gl_number}
                className="flex items-center justify-between px-4 py-1.5 border-b border-gray-50 hover:bg-blue-50/30"
              >
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="font-mono text-xs text-blue-600 shrink-0">{item.gl_number}</span>
                  {item.gl_name}
                </span>
                <span className={`font-mono text-sm ${parseFloat(String(item.amount)) < 0 ? "text-red-600" : "text-gray-700"}`}>
                  {cfDisplay(item.amount)}
                </span>
              </div>
            ))}
          </div>
        ))}

        {/* Section total footer */}
        <div className={`flex items-center justify-between px-4 py-2 border-t-2 ${
          sectionTotal >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        }`}>
          <span className={`text-sm font-bold ${sectionTotal >= 0 ? "text-green-800" : "text-red-800"}`}>
            Net cash {sectionTotal >= 0 ? "from" : "used in"} {section.label.toLowerCase()}
          </span>
          <span className={`font-mono text-sm font-bold ${sectionTotal >= 0 ? "text-green-700" : "text-red-700"}`}>
            {cfDisplay(sectionTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function CFTab({
  data,
  loading,
  error,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  onLoad,
}: {
  data: CFData | null;
  loading: boolean;
  error: string | null;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  onLoad: () => void;
}) {
  const netChange = data ? parseFloat(String(data.net_change_in_cash)) || 0 : 0;
  const glClosing = data ? parseFloat(String(data.gl_closing_cash)) || 0 : 0;
  const computedClosing = data ? parseFloat(String(data.closing_cash)) || 0 : 0;
  // Flag if computed closing ≠ GL closing (rounding tolerance of 1)
  const doesNotReconcile = data ? Math.abs(glClosing - computedClosing) > 1 : false;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Period from</label>
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
        <button
          type="button"
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          onClick={onLoad}
        >
          Run
        </button>
        {data && (
          <span className="text-xs text-gray-400 self-end pb-1">
            {data.date_from ? `${data.date_from} — ${data.date_to ?? "present"}` : "All time"}
          </span>
        )}
      </div>

      {error && <Banner variant="error" className="mb-4">{error}</Banner>}
      {loading && <p className="text-sm text-gray-400 py-12 text-center">Loading…</p>}
      {!loading && !data && !error && (
        <p className="text-sm text-gray-400 py-12 text-center">Set a period and click Run.</p>
      )}

      {data && !loading && (
        <>
          {data.has_untagged_bs && (
            <Banner variant="warning" className="mb-4">
              Some balance sheet accounts are not mapped to a cash flow category — the statement
              may be incomplete. Tag accounts via{" "}
              <strong>Settings → Chart of Accounts → CF Category</strong>.
            </Banner>
          )}

          {doesNotReconcile && (
            <Banner variant="warning" className="mb-4">
              Cash flow statement does not fully reconcile. Check for untagged GL accounts or
              posting gaps. (Computed closing: {cfDisplay(computedClosing)}, GL closing:{" "}
              {cfDisplay(glClosing)})
            </Banner>
          )}

          <Banner variant="info" className="mb-6 text-xs">
            Indirect method — starts with net profit/loss and adjusts to arrive at net cash.
            Tag GL accounts via Chart of Accounts (CF Category field) to populate this statement.
          </Banner>

          {/* Three sections */}
          {data.sections.map((section) => (
            <CFSectionBlock key={section.label} section={section} />
          ))}

          {/* Net change + cash reconciliation footer */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 mt-2 ${
            netChange >= 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
          }`}>
            <span className={`text-sm font-bold ${netChange >= 0 ? "text-green-800" : "text-red-800"}`}>
              NET CHANGE IN CASH
            </span>
            <span className={`font-mono text-base font-bold ${netChange >= 0 ? "text-green-700" : "text-red-700"}`}>
              {cfDisplay(netChange)}
            </span>
          </div>

          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-sm text-gray-600">Opening cash balance</span>
              <span className="font-mono text-sm text-gray-700">{cfDisplay(data.opening_cash)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100">
              <span className="text-sm font-bold text-gray-800">CLOSING CASH BALANCE</span>
              <span className="font-mono text-sm font-bold text-gray-900">{cfDisplay(data.closing_cash)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancialStatementsPage() {
  const { accessToken } = useAuth();

  const [postingMode, setPostingMode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pl" | "bs" | "cf">("pl");

  // P&L state
  const [plDateFrom, setPlDateFrom] = useState("");
  const [plDateTo, setPlDateTo] = useState("");
  const [plData, setPlData] = useState<PLData | null>(null);
  const [plLoading, setPlLoading] = useState(false);
  const [plError, setPlError] = useState<string | null>(null);

  // BS state
  const [bsAsAtDate, setBsAsAtDate] = useState("");
  const [bsData, setBsData] = useState<BSData | null>(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [bsError, setBsError] = useState<string | null>(null);

  // CF state (Q1b)
  const [cfDateFrom, setCfDateFrom] = useState("");
  const [cfDateTo, setCfDateTo] = useState("");
  const [cfData, setCfData] = useState<CFData | null>(null);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<{ posting_mode?: string }>("/api/setup/org", { token: accessToken })
      .then((d) => setPostingMode(d.posting_mode ?? "full_erp"))
      .catch(() => setPostingMode("full_erp"));
  }, [accessToken]);

  const loadPL = async () => {
    if (!accessToken) return;
    setPlLoading(true);
    setPlError(null);
    try {
      const params = new URLSearchParams();
      if (plDateFrom) params.set("date_from", plDateFrom);
      if (plDateTo) params.set("date_to", plDateTo);
      const qs = params.toString();
      const data = await apiFetch<PLData>(
        `/api/gl/financial-statements/pl${qs ? `?${qs}` : ""}`,
        { token: accessToken }
      );
      setPlData(data);
    } catch (e) {
      setPlError(e instanceof Error ? e.message : "Failed to load P&L.");
    } finally {
      setPlLoading(false);
    }
  };

  const loadBS = async () => {
    if (!accessToken) return;
    setBsLoading(true);
    setBsError(null);
    try {
      const params = new URLSearchParams();
      if (bsAsAtDate) params.set("as_at_date", bsAsAtDate);
      const qs = params.toString();
      const data = await apiFetch<BSData>(
        `/api/gl/financial-statements/bs${qs ? `?${qs}` : ""}`,
        { token: accessToken }
      );
      setBsData(data);
    } catch (e) {
      setBsError(e instanceof Error ? e.message : "Failed to load Balance Sheet.");
    } finally {
      setBsLoading(false);
    }
  };

  // Q1b: Cash Flow Statement loader
  const loadCF = async () => {
    if (!accessToken) return;
    setCfLoading(true);
    setCfError(null);
    try {
      const params = new URLSearchParams();
      if (cfDateFrom) params.set("date_from", cfDateFrom);
      if (cfDateTo) params.set("date_to", cfDateTo);
      const qs = params.toString();
      const data = await apiFetch<CFData>(
        `/api/gl/financial-statements/cf${qs ? `?${qs}` : ""}`,
        { token: accessToken }
      );
      setCfData(data);
    } catch (e) {
      setCfError(e instanceof Error ? e.message : "Failed to load Cash Flow Statement.");
    } finally {
      setCfLoading(false);
    }
  };

  // Mode guard — Full ERP only
  if (postingMode !== null && postingMode !== "full_erp") {
    return (
      <PageContainer>
        <PageHeading title="Financial Statements" subtitle="P&L and Balance Sheet" />
        <ModeNotAvailable
          pageName="Financial Statements"
          availableIn={["Full ERP"]}
          currentMode={postingMode}
        />
      </PageContainer>
    );
  }

  const tabs: { key: "pl" | "bs" | "cf"; label: string }[] = [
    { key: "pl", label: "Profit & Loss" },
    { key: "bs", label: "Balance Sheet" },
    { key: "cf", label: "Cash Flow" },
  ];

  return (
    <PageContainer>
      <PageHeading
        title="Financial Statements"
        subtitle="Profit & Loss and Statement of Financial Position"
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pl" && (
        <PLTab
          data={plData}
          loading={plLoading}
          error={plError}
          dateFrom={plDateFrom}
          dateTo={plDateTo}
          setDateFrom={setPlDateFrom}
          setDateTo={setPlDateTo}
          onLoad={loadPL}
        />
      )}

      {activeTab === "bs" && (
        <BSTab
          data={bsData}
          loading={bsLoading}
          error={bsError}
          asAtDate={bsAsAtDate}
          setAsAtDate={setBsAsAtDate}
          onLoad={loadBS}
        />
      )}

      {activeTab === "cf" && (
        <CFTab
          data={cfData}
          loading={cfLoading}
          error={cfError}
          dateFrom={cfDateFrom}
          dateTo={cfDateTo}
          setDateFrom={setCfDateFrom}
          setDateTo={setCfDateTo}
          onLoad={loadCF}
        />
      )}
    </PageContainer>
  );
}
