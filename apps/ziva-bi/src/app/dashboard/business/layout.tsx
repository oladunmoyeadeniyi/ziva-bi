"use client";

/**
 * Business dashboard layout — shared shell for all /dashboard/business/* pages.
 *
 * M8.2 Fixes: 6-group sidebar with Tabler outline icons.
 * Groups: COMMON DATA | FINANCIALS | PEOPLE | WORKFLOW & ACCESS | MODULE SETUP | GO-LIVE
 * Implementation Mode banner for consultant role (36px, amber).
 */

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import type { ImpersonationState } from "@/contexts/AuthContext";
import ImpersonationUserBanner from "@/components/ImpersonationUserBanner";
import { apiFetch } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import { ConsultantLocksProvider, useConsultantLocks } from "@/contexts/ConsultantLocksContext";

// ── Branding ──────────────────────────────────────────────────────────────────
interface BrandingThemeMin { primary: string; sidebar: string; }

function isDark(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

interface ApprovalQueueItem {
  approval_id: string;
}

interface ModuleState {
  module_key: string;
  label: string;
  is_active: boolean;
  is_licensed: boolean;
}

// ── Tabler icon component (inline SVG via CSS class) ──────────────────────────
// Uses the @tabler/icons-webfont CDN included in globals or loaded via layout.
// ti-* class names render the correct outline icon.

const Icon = ({ name, size = 15 }: { name: string; size?: number }) => (
  <i className={`ti ti-${name}`} style={{ fontSize: size, lineHeight: 1 }} />
);

// ── Module icon map ────────────────────────────────────────────────────────────
const MODULE_ICONS: Record<string, string> = {
  expense:          "receipt",
  ap:               "invoice",
  ar:               "credit-card",
  payroll:          "wallet",
  inventory:        "package",
  fixed_assets:     "chart-pie",
  posm:             "tags",
  vendor_portal:    "truck",
  customer_portal:  "user-check",
  warehouse:        "building-warehouse",
  bank_recon:       "building-bank",
  budget:           "chart-bar",
  tax_engine:       "calculator",
  reporting:        "chart-dots",
};

// Map module_key to sidebar route
const MODULE_ROUTES: Record<string, string> = {
  expense:          "/dashboard/business/settings/expense-config",
  ap:               "/dashboard/business/ap/invoices",
  ar:               "/dashboard/business/ar/invoices",
  payroll:          "/dashboard/business/payroll",
  inventory:        "/dashboard/business/inventory",
  fixed_assets:     "/dashboard/business/assets",
  posm:             "/dashboard/business/setup/modules/posm",
  vendor_portal:    "/dashboard/business/vendor-portal",
  customer_portal:  "/dashboard/business/customer-portal",
  warehouse:        "/dashboard/business/setup/modules/warehouse",
  bank_recon:       "/dashboard/business/setup/modules/bank",
  budget:           "/dashboard/business/budgets",
  tax_engine:       "/dashboard/business/tax",
  reporting:        "/dashboard/business/reporting",
};

// ── Impersonation banner ──────────────────────────────────────────────────────

function ImpersonationBanner({
  impersonation,
  onExit,
}: {
  impersonation: ImpersonationState;
  onExit: () => void;
}) {
  const isSupport = impersonation.mode === "support";
  const bg = isSupport ? "#fffbeb" : "#eff6ff";
  const border = isSupport ? "#fcd34d" : "#93c5fd";
  const color = isSupport ? "#92400e" : "#1e40af";
  const label = isSupport
    ? `Support · read-only (live)`
    : `Implementation · edit${impersonation.environment === "test" ? " · TEST" : ""}`;

  return (
    <div
      className="flex items-center justify-between gap-2 px-4 shrink-0"
      style={{ height: 36, background: bg, borderBottom: `0.5px solid ${border}` }}
    >
      <div className="flex items-center gap-2">
        <i
          className={`ti ti-${isSupport ? "eye" : "shield-check"}`}
          style={{ fontSize: 13, color }}
        />
        <span style={{ fontSize: 11, color }}>
          Viewing <strong>{impersonation.tenantName}</strong> — {label}
        </span>
      </div>
      <button
        type="button"
        onClick={onExit}
        style={{ fontSize: 11, color, border: `1px solid ${border}` }}
        className="px-2 py-0.5 rounded bg-white bg-opacity-60 hover:bg-opacity-100 font-medium transition-colors"
      >
        Exit to platform
      </button>
    </div>
  );
}

function BusinessLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, accessToken, isLoading, impersonation, exitImpersonation, exitUserImpersonation } = useAuth();
  const { isLocked } = useConsultantLocks();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeModules, setActiveModules] = useState<ModuleState[] | null>(null);
  const [orgConfig, setOrgConfig] = useState<{ use_dimensions?: boolean; use_multi_currency?: boolean } | null>(null);
  const [postingMode, setPostingMode] = useState<'lite' | 'connected' | 'full_erp' | null>(null);
  const [activeTheme, setActiveTheme] = useState<BrandingThemeMin | null>(null);

  // Admin sections require an active tenant context.
  //
  // Non-user-impersonation mode: `!!impersonation` means a SA has entered a tenant
  // (implementation or support). Regular tenant admins (is_tenant_admin) and power_admin
  // role tier also qualify. is_super_admin is intentionally NOT included here — without
  // impersonation the SA's base token carries no tenant_id, so every tenant-scoped API
  // call would fail. The redirect guard below catches that case and sends them to /platform.
  //
  // User-impersonation mode (mode === "user"): `user` has been swapped to the target user's
  // profile (M9.3b AuthContext fix), so we check the target user's own roles directly.
  const isAdmin = impersonation?.mode === "user"
    ? (user?.is_super_admin || user?.is_tenant_admin || user?.role_tier === "power_admin")
    : (!!impersonation || user?.is_tenant_admin || user?.role_tier === "power_admin");

  // Guard: a super admin with no active impersonation has no tenant context and cannot
  // call any tenant-scoped API — send them to the platform portal immediately.
  // Note: `!user.tenant_id` is intentionally absent. A SA whose DB profile has a
  // tenant_id (e.g. the platform owner who is also a tenant member) still cannot use
  // their BASE token for tenant API calls — only the impersonation token carries the
  // necessary tenant_id JWT claim. Without impersonation they must go to /platform.
  useEffect(() => {
    if (!isLoading && user?.is_super_admin && !impersonation) {
      router.push("/platform");
    }
  }, [isLoading, user, impersonation, router]);

  // Fetch pending approval badge
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ApprovalQueueItem[]>("/api/approvals/queue", { token: accessToken })
      .then((queue) => setPendingCount(queue.length))
      .catch(() => {});
  }, [accessToken, pathname]);

  // Fetch activated modules — needed by ALL authenticated users so the sidebar
  // shows the correct operational links (AR, AP, Payroll, etc.).
  // The Module Setup admin section is gated separately by {isAdmin && ...}.
  const fetchModules = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<{ modules: ModuleState[] }>("/api/setup/modules", {
        token: accessToken,
      });
      setActiveModules(data.modules.filter((m) => m.is_active));
    } catch {
      setActiveModules([]);
    }
  }, [accessToken, pathname]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Fetch org configuration to conditionally show/hide sidebar links.
  // Needed by all users — posting_mode gates the GL/accounting sidebar section
  // and branding applies to everyone. Only the Setup sub-sections use isAdmin gating.
  const fetchOrgConfig = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<{
        org_configuration?: { use_dimensions?: boolean; use_multi_currency?: boolean };
        posting_mode?: string;
        branding?: { active_theme_id?: string; themes?: Array<{ id: string; primary: string; sidebar: string }> };
      }>("/api/setup/org", { token: accessToken });
      if (data.org_configuration) setOrgConfig(data.org_configuration);
      if (data.posting_mode) setPostingMode(data.posting_mode as 'lite' | 'connected' | 'full_erp');
      if (data.branding?.active_theme_id && data.branding?.themes) {
        const t = data.branding.themes.find(th => th.id === data.branding!.active_theme_id);
        if (t) setActiveTheme({ primary: t.primary, sidebar: t.sidebar });
      }
    } catch {
      // silently fail
    }
  }, [accessToken, pathname]);

  useEffect(() => {
    fetchOrgConfig();
  }, [fetchOrgConfig]);

  // Apply branding CSS variables to :root whenever the active theme changes
  useEffect(() => {
    const t = activeTheme;
    const root = document.documentElement;
    const dark = t ? isDark(t.sidebar) : false;
    root.style.setProperty("--ziva-primary",            t?.primary ?? "#2563EB");
    root.style.setProperty("--ziva-sidebar-bg",         t?.sidebar ?? "#F9FAFB");
    root.style.setProperty("--ziva-sidebar-text",       dark ? "rgba(255,255,255,0.85)" : "#374151");
    root.style.setProperty("--ziva-sidebar-muted",      dark ? "rgba(255,255,255,0.40)" : "#9CA3AF");
    root.style.setProperty("--ziva-sidebar-active-bg",  dark ? "rgba(255,255,255,0.12)" : "#FFFFFF");
    root.style.setProperty("--ziva-sidebar-active-text",dark ? "#FFFFFF" : "#111827");
    root.style.setProperty("--ziva-sidebar-hover-bg",   dark ? "rgba(255,255,255,0.07)" : "#F3F4F6");
    root.style.setProperty("--ziva-sidebar-border",     dark ? "rgba(255,255,255,0.10)" : "#E5E7EB");
  }, [activeTheme]);

  const isActive = (href: string, exact = false) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  // Nav link with icon
  const NavLink = ({
    href,
    label,
    icon,
    exact = false,
    badge = null,
    lockKey,
  }: {
    href: string;
    label: string;
    icon: string;
    exact?: boolean;
    badge?: number | null;
    lockKey?: string;
  }) => {
    const active = isActive(href, exact);
    const sectionLocked = lockKey ? isLocked(lockKey) : false;
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors ${
          active ? "" : "hover:bg-[var(--ziva-sidebar-hover-bg,#F3F4F6)]"
        }`}
        style={active ? {
          background: "var(--ziva-sidebar-active-bg, #FFFFFF)",
          color: "var(--ziva-sidebar-active-text, #111827)",
          fontWeight: 500,
          border: "1px solid var(--ziva-sidebar-border, #E5E7EB)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        } : {
          color: "var(--ziva-sidebar-text, #4B5563)",
        }}
      >
        <Icon name={icon} size={14} />
        <span className="flex-1 truncate">{label}</span>
        {sectionLocked && (
          <i className="ti ti-lock text-amber-500" style={{ fontSize: 11 }} title="Locked by consultant" />
        )}
        {badge !== null && badge > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <p
      className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest select-none"
      style={{ color: "var(--ziva-sidebar-muted, #9CA3AF)" }}
    >
      {label}
    </p>
  );

  // isExclusivelyAdmin was previously used to gate the staff nav — this was a bug:
  // tenant founders with only the system tenant_admin role (no operational roles) got
  // is_tenant_admin=true and has_non_admin_role=false, making isExclusivelyAdmin=true
  // and hiding WORKSPACE + ACCOUNT entirely. Fix: WORKSPACE + ACCOUNT always render
  // for any authenticated business user regardless of role composition.
  const isExclusivelyAdmin = user?.is_tenant_admin && !user?.has_non_admin_role; // kept for future RBAC use; no longer gates the sidebar

  // Fix A + K (M9.3b): in tenant-context mode (SA entered a tenant) but NOT in
  // user-level impersonation, hide WORKSPACE + ACCOUNT — the SA is doing admin/
  // diagnostic work, not acting as a normal employee. When mode === "user", the SA
  // is seeing exactly what the target user sees, so WORKSPACE + ACCOUNT must show.
  const hideWorkspace = !!impersonation && impersonation.mode !== "user";

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* Tenant-context banner — visible when SA is inside a tenant, but NOT during
          user-level impersonation. During mode === "user", only the indigo user banner
          below is shown — hiding this prevents the SA from bypassing exitUserImpersonation
          (which handles EP1/EP2 correctly) by clicking "Exit to platform" here first. */}
      {impersonation && impersonation.mode !== "user" && (
        <ImpersonationBanner
          impersonation={impersonation}
          onExit={() => {
            let returnUrl = "/platform";
            try {
              const stored = sessionStorage.getItem("ziva_impl_return_url");
              if (stored) { returnUrl = stored; sessionStorage.removeItem("ziva_impl_return_url"); }
            } catch {}
            exitImpersonation();
            // Use location.replace (not router.push) so the SA guard effect
            // that fires on impersonation clear cannot race and override the URL.
            window.location.replace(returnUrl);
          }}
        />
      )}

      {/* User-level impersonation banner (M9.3b) — stacked below the tenant banner */}
      {impersonation?.mode === "user" && impersonation.targetUser && (
        <ImpersonationUserBanner
          fullName={impersonation.targetUser.fullName}
          role={impersonation.targetUser.role}
          onExit={async () => {
            // Capture returnUrl BEFORE exit clears impersonation state.
            // EP1: returnUrl = "/platform/tenants/{id}" (wherever the SA launched from)
            // EP2: returnUrl = "/dashboard/business/settings/employees" (or cost-centers)
            // exitUserImpersonation writes the restored implementation token to sessionStorage
            // (EP2) or clears it (EP1) BEFORE we navigate, so restore() always reads the
            // right state on the new page regardless of which entry point was used.
            const returnUrl = impersonation?.returnUrl ?? "/platform";
            await exitUserImpersonation();
            window.location.replace(returnUrl);
          }}
        />
      )}

      <AppHeader context="business" />

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — 240px, scrolls independently */}
        <nav
          className="w-60 shrink-0 py-2 flex flex-col overflow-y-auto h-full"
          style={{ background: "var(--ziva-sidebar-bg, #F9FAFB)", borderRight: "1px solid var(--ziva-sidebar-border, #E5E7EB)" }}
        >

          {/* WORKSPACE — hidden when SA is in tenant-context mode (not user impersonation) */}
          {!hideWorkspace && (
            <div className="px-2">
              <SectionLabel label="Workspace" />
              <NavLink href="/dashboard/business" label="Home" icon="home" exact />
              <NavLink href="/dashboard/business/expenses" label="Expenses" icon="receipt" />
              <NavLink href="/dashboard/business/advances" label="Advances" icon="cash-banknote" />
              <NavLink href="/dashboard/business/expenses/payments" label="Payment queue" icon="wallet" />
              {/* RBAC: gate Approvals to approvers once RBAC is available */}
              <NavLink
                href="/dashboard/business/approvals"
                label="Approvals"
                icon="checks"
                badge={pendingCount}
              />
            </div>
          )}

          {/* ACCOUNT — hidden when SA is in tenant-context mode (not user impersonation) */}
          {!hideWorkspace && (
            <div className="px-2">
              <SectionLabel label="Account" />
              <NavLink href="/dashboard/profile" label="Profile" icon="user" />
            </div>
          )}

          {/* Admin setup sections */}
          {isAdmin && (
            <>
              {/* COMMON DATA */}
              <div className="px-2">
                <SectionLabel label="Common Data" />
                <NavLink href="/dashboard/business/setup" label="Setup dashboard" icon="layout-dashboard" exact />
                <NavLink href="/dashboard/business/setup/organisation" label="Organisation" icon="building" lockKey="organisation" />
                <NavLink href="/dashboard/business/setup/modules" label="Module activation" icon="puzzle" lockKey="module_activation" />
              </div>

              {/* FINANCIALS */}
              <div className="px-2">
                <SectionLabel label="Financials" />
                {/* Chart of Accounts — hidden in Lite mode */}
                {postingMode !== 'lite' && (
                  <NavLink href="/dashboard/business/settings/chart-of-accounts" label="Chart of accounts" icon="file-spreadsheet" lockKey="chart_of_accounts" />
                )}
                {/* Dimensions — hidden in Lite mode; use_dimensions gate still applies */}
                {postingMode !== 'lite' && orgConfig?.use_dimensions && (
                  <NavLink href="/dashboard/business/settings/dimensions" label="Dimensions" icon="vector" lockKey="dimensions" />
                )}
                <NavLink href="/dashboard/business/setup/bank-accounts" label="Bank accounts" icon="building-bank" lockKey="bank_accounts" />
                <NavLink href="/dashboard/business/petty-cash" label="Petty cash" icon="cash" />
                <NavLink href="/dashboard/business/advances/aging" label="Advance aging" icon="clock-dollar" />
                <NavLink href="/dashboard/business/settings/payment-config" label="Payment settings" icon="credit-card" />
                {/* Account Mapping — hidden in Lite mode */}
                {postingMode !== 'lite' && (
                  <NavLink href="/dashboard/business/setup/account-mapping" label="Account mapping" icon="arrows-transfer-up" lockKey="account_mapping" />
                )}
                <NavLink href="/dashboard/business/setup/periods" label="Period management" icon="calendar" lockKey="periods" />
                {/* Currencies & FX — hidden in Lite mode; use_multi_currency gate still applies */}
                {postingMode !== 'lite' && orgConfig?.use_multi_currency && (
                  <NavLink href="/dashboard/business/setup/currencies" label="Currencies & FX" icon="currency-dollar" lockKey="currencies" />
                )}
                {/* Tax & Statutory — hidden in Lite mode */}
                {postingMode !== 'lite' && (
                  <NavLink href="/dashboard/business/setup/tax" label="Tax & statutory" icon="receipt-tax" lockKey="tax" />
                )}
              </div>

              {/* ACCOUNTING — hidden in Lite mode (no in-app GL) */}
              {postingMode !== 'lite' && (
                <div className="px-2">
                  <SectionLabel label="Accounting" />
                  <NavLink href="/dashboard/business/accounting/journal-entries" label="Journal entries" icon="notebook" />
                  <NavLink href="/dashboard/business/accounting/trial-balance" label="Trial balance" icon="table-column" />
                  {/* Financial Statements: Full ERP only */}
                  {postingMode === 'full_erp' && (
                    <NavLink href="/dashboard/business/accounting/financial-statements" label="Financial statements" icon="report-analytics" />
                  )}
                </div>
              )}

              {/* ACCOUNTS PAYABLE — shown only when ap module is active */}
              {activeModules?.some(m => m.module_key === 'ap') && (
                <div className="px-2">
                  <SectionLabel label="Accounts Payable" />
                  <NavLink href="/dashboard/business/ap/invoices" label="Invoices" icon="invoice" />
                  <NavLink href="/dashboard/business/ap/vendors" label="Vendors" icon="truck" />
                  <NavLink href="/dashboard/business/ap/aging" label="AP Aging" icon="chart-bar" />
                  <NavLink href="/dashboard/business/po" label="Purchase Orders" icon="shopping-cart" />
                  <NavLink href="/dashboard/business/po/match-report" label="Match Report" icon="git-compare" />
                  <NavLink href="/dashboard/business/bank-recon" label="Bank Reconciliation" icon="building-bank" />
                </div>
              )}

              {/* ACCOUNTS RECEIVABLE — shown only when ar module is active */}
              {activeModules?.some(m => m.module_key === 'ar') && (
                <div className="px-2">
                  <SectionLabel label="Accounts Receivable" />
                  <NavLink href="/dashboard/business/ar/invoices" label="Invoices" icon="invoice" />
                  <NavLink href="/dashboard/business/ar/customers" label="Customers" icon="users" />
                  <NavLink href="/dashboard/business/ar/aging" label="AR Aging" icon="chart-bar" />
                </div>
              )}

              {/* BUDGET & PLANNING */}
              {activeModules?.some(m => m.module_key === 'budget') && (
                <div className="px-2">
                  <SectionLabel label="Budget &amp; Planning" />
                  <NavLink href="/dashboard/business/budgets" label="Budgets" icon="chart-bar" />
                </div>
              )}

              {/* PAYROLL */}
              {activeModules?.some(m => m.module_key === 'payroll') && (
                <div className="px-2">
                  <SectionLabel label="Payroll" />
                  <NavLink href="/dashboard/business/payroll" label="Payroll runs" icon="wallet" />
                  <NavLink href="/dashboard/business/payroll/salary-structures" label="Salary structures" icon="file-dollar" />
                  <NavLink href="/dashboard/business/payroll/leave" label="Leave management" icon="calendar-off" />
                </div>
              )}

              {/* INVENTORY */}
              {activeModules?.some(m => m.module_key === 'inventory') && (
                <div className="px-2">
                  <SectionLabel label="Inventory" />
                  <NavLink href="/dashboard/business/inventory" label="Items" icon="package" />
                  <NavLink href="/dashboard/business/inventory/movements" label="Stock movements" icon="arrows-transfer-up" />
                  <NavLink href="/dashboard/business/inventory/valuation" label="Valuation report" icon="report-money" />
                  <NavLink href="/dashboard/business/inventory/locations" label="Locations" icon="building-warehouse" />
                  <NavLink href="/dashboard/business/stores" label="Store issues" icon="hand-move" />
                </div>
              )}

              {/* FIXED ASSETS */}
              {activeModules?.some(m => m.module_key === 'fixed_assets') && (
                <div className="px-2">
                  <SectionLabel label="Fixed Assets" />
                  <NavLink href="/dashboard/business/assets" label="Asset register" icon="chart-pie" />
                  <NavLink href="/dashboard/business/assets/categories" label="Categories" icon="tag" />
                  <NavLink href="/dashboard/business/assets/issuances" label="Asset issuances" icon="arrow-bar-right" />
                  <NavLink href="/dashboard/business/assets/maintenance" label="Maintenance costs" icon="tool" />
                </div>
              )}

              {/* TAX ENGINE */}
              {activeModules?.some(m => m.module_key === 'tax_engine') && (
                <div className="px-2">
                  <SectionLabel label="Tax &amp; Compliance" />
                  <NavLink href="/dashboard/business/tax" label="Tax returns" icon="calculator" />
                  <NavLink href="/dashboard/business/tax/wht-certificates" label="WHT certificates" icon="certificate" />
                  <NavLink href="/dashboard/business/tax/vat-summary" label="VAT summary" icon="receipt-tax" />
                </div>
              )}

              {/* AI INSIGHTS — Full ERP only */}
              {postingMode === 'full_erp' && (
                <div className="px-2">
                  <SectionLabel label="Insights" />
                  <NavLink href="/dashboard/business/ai-insights" label="Insights" icon="brain" />
                  <NavLink href="/dashboard/business/ai-insights/anomalies" label="Run anomaly scan" icon="alert-triangle" />
                </div>
              )}

              {/* CONSOLIDATION — Full ERP only */}
              {postingMode === 'full_erp' && (
                <div className="px-2">
                  <SectionLabel label="Consolidation" />
                  <NavLink href="/dashboard/business/consolidation" label="Groups" icon="building-community" />
                </div>
              )}

              {/* UNIFIED APPROVALS INBOX */}
              <div className="px-2">
                <SectionLabel label="Approvals Inbox" />
                <NavLink href="/dashboard/business/approvals/inbox" label="My inbox" icon="inbox" />
              </div>

              {/* PEOPLE */}
              <div className="px-2">
                <SectionLabel label="People" />
                <NavLink href="/dashboard/business/settings/employees" label="Employees" icon="users" lockKey="employees" />
                <NavLink href="/dashboard/business/settings/positions" label="Positions" icon="hierarchy" lockKey="roles" />
              </div>

              {/* WORKFLOW & ACCESS */}
              <div className="px-2">
                <SectionLabel label="Workflow &amp; Access" />
                <NavLink href="/dashboard/business/setup/roles" label="Roles & permissions" icon="key" lockKey="roles" />
                <NavLink href="/dashboard/business/settings/approval-matrix" label="Approval workflows" icon="git-merge" lockKey="approval_workflows" />
                <NavLink href="/dashboard/business/setup/documents" label="Document rules" icon="file-check" lockKey="document_rules" />
                <NavLink href="/dashboard/business/admin/users" label="Team" icon="user-plus" />
              </div>

              {/* PORTALS */}
              <div className="px-2">
                <SectionLabel label="Portals" />
                <NavLink href="/dashboard/business/vendor-portal" label="Vendor portal" icon="truck" />
                <NavLink href="/dashboard/business/customer-portal" label="Customer portal" icon="user-check" />
              </div>

              {/* REPORTING & ANALYTICS */}
              <div className="px-2">
                <SectionLabel label="Reporting" />
                <NavLink href="/dashboard/business/reporting" label="Analytics dashboard" icon="chart-dots" />
                <NavLink href="/dashboard/business/reporting/saved" label="Saved reports" icon="bookmark" />
              </div>

              {/* AI CONFIGURATION */}
              <div className="px-2">
                <SectionLabel label="Intelligence" />
                <NavLink href="/dashboard/business/settings/ai-config" label="Smart categorisation" icon="brain" />
                <NavLink href="/dashboard/business/ai-insights" label="Insights" icon="sparkles" />
              </div>

              {/* MODULE SETUP */}
              <div className="px-2">
                <SectionLabel label="Module Setup" />
                {activeModules === null ? (
                  <p className="px-3 py-1.5 text-xs text-gray-400">Loading…</p>
                ) : activeModules.length === 0 ? (
                  <p className="px-3 py-1.5 text-xs text-gray-400 italic">Activate modules first</p>
                ) : (
                  activeModules.map((mod) => {
                    const href = MODULE_ROUTES[mod.module_key] ?? `/dashboard/business/setup/modules/${mod.module_key}`;
                    const icon = MODULE_ICONS[mod.module_key] ?? "puzzle";
                    return (
                      <NavLink key={mod.module_key} href={href} label={mod.label} icon={icon} />
                    );
                  })
                )}
              </div>

              {/* GO-LIVE */}
              <div className="px-2">
                <SectionLabel label="Go-live" />
                <NavLink href="/dashboard/business/setup/go-live" label="Readiness & go-live" icon="rocket" />
              </div>
            </>
          )}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

// Outer component — wraps the layout with the ConsultantLocksProvider so all
// child pages can read lock state without extra network requests.
export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accessToken } = useAuth();
  return (
    <ConsultantLocksProvider accessToken={accessToken}>
      <BusinessLayoutInner>{children}</BusinessLayoutInner>
    </ConsultantLocksProvider>
  );
}
