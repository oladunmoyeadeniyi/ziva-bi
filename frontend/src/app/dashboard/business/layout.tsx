"use client";

/**
 * Business dashboard layout — shared shell for all /dashboard/business/* pages.
 *
 * M8.2 Fixes: 6-group sidebar with Tabler outline icons.
 * Groups: COMMON DATA | FINANCIALS | PEOPLE | WORKFLOW & ACCESS | MODULE SETUP | GO-LIVE
 * Implementation Mode banner for consultant role (36px, amber).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

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
  ap:               "/dashboard/business/setup/modules/ap",
  ar:               "/dashboard/business/setup/modules/ar",
  payroll:          "/dashboard/business/setup/modules/payroll",
  inventory:        "/dashboard/business/setup/modules/inventory",
  fixed_assets:     "/dashboard/business/setup/modules/fixed-assets",
  posm:             "/dashboard/business/setup/modules/posm",
  vendor_portal:    "/dashboard/business/setup/modules/vendor-portal",
  customer_portal:  "/dashboard/business/setup/modules/customer-portal",
  warehouse:        "/dashboard/business/setup/modules/warehouse",
  bank_recon:       "/dashboard/business/setup/modules/bank",
  budget:           "/dashboard/business/setup/modules/budget",
  tax_engine:       "/dashboard/business/setup/modules/tax-engine",
  reporting:        "/dashboard/business/setup/modules/reporting",
};


export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, accessToken } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeModules, setActiveModules] = useState<ModuleState[] | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.is_tenant_admin || user?.is_super_admin;
  const isConsultant = user?.role_tier === "consultant";

  // Fetch pending approval badge
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ApprovalQueueItem[]>("/api/approvals/queue", { token: accessToken })
      .then((queue) => setPendingCount(queue.length))
      .catch(() => {});
  }, [accessToken, pathname]);

  // Fetch activated modules for MODULE SETUP section
  const fetchModules = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    try {
      const data = await apiFetch<{ modules: ModuleState[] }>("/api/setup/modules", {
        token: accessToken,
      });
      setActiveModules(data.modules.filter((m) => m.is_active));
    } catch {
      setActiveModules([]);
    }
  }, [accessToken, isAdmin]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Fetch company name from org config for profile dropdown
  const fetchCompanyName = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    try {
      const data = await apiFetch<{ legal_name?: string }>("/api/setup/org", {
        token: accessToken,
      });
      if (data.legal_name) setCompanyName(data.legal_name);
    } catch {
      // silently fail — fall back to tenant name
    }
  }, [accessToken, isAdmin]);

  useEffect(() => {
    fetchCompanyName();
  }, [fetchCompanyName]);

  // Close dropdown on click-away
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

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
  }: {
    href: string;
    label: string;
    icon: string;
    exact?: boolean;
    badge?: number | null;
  }) => {
    const active = isActive(href, exact);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors ${
          active
            ? "bg-white text-gray-900 font-[500] border border-gray-200 shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <Icon name={icon} size={14} />
        <span className="flex-1 truncate">{label}</span>
        {badge !== null && badge > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest select-none">
      {label}
    </p>
  );

  const isExclusivelyAdmin = user?.is_tenant_admin && !user?.has_non_admin_role;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Implementation Mode banner — 36px, amber, consultant only */}
      {isConsultant && (
        <div
          className="flex items-center gap-2 px-4 shrink-0"
          style={{
            height: 36,
            background: "var(--color-background-warning, #fffbeb)",
            borderBottom: "0.5px solid var(--color-border-warning, #fcd34d)",
          }}
        >
          <Icon name="shield-check" size={13} />
          <span style={{ fontSize: 11, color: "var(--color-text-warning, #92400e)" }}>
            Implementation mode — you have full override access. All changes are logged against your consultant account.
          </span>
        </div>
      )}

      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-lg font-bold text-gray-900">ZivaBI</span>

        {/* User + company menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <span className="font-medium">{user?.full_name}</span>
            {companyName && (
              <span className="text-gray-400 text-xs hidden sm:inline">— {companyName}</span>
            )}
            <Icon name="chevron-down" size={13} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
              {/* Close button */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500 truncate max-w-[140px]">
                  {companyName || user?.full_name}
                </span>
                <button
                  type="button"
                  onClick={() => setShowUserMenu(false)}
                  className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
              <Link
                href="/dashboard/profile"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Icon name="user" size={13} />
                Profile
              </Link>
              <hr className="my-1 border-gray-100" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Icon name="logout" size={13} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — 240px, scrolls independently */}
        <nav className="w-60 shrink-0 bg-gray-50 border-r border-gray-200 py-2 flex flex-col overflow-y-auto">

          {/* User-facing items */}
          {!isExclusivelyAdmin && (
            <div className="px-2">
              <NavLink href="/dashboard/business" label="Overview" icon="home" exact />
              <NavLink href="/dashboard/business/expenses" label="Expenses" icon="receipt" />
              <NavLink
                href="/dashboard/business/approvals"
                label="Approvals"
                icon="checks"
                badge={pendingCount}
              />
            </div>
          )}

          {/* Admin setup sections */}
          {isAdmin && (
            <>
              {/* COMMON DATA */}
              <div className="px-2">
                <SectionLabel label="Common Data" />
                <NavLink href="/dashboard/business/setup" label="Setup dashboard" icon="layout-dashboard" exact />
                <NavLink href="/dashboard/business/setup/organisation" label="Organisation" icon="building" />
                <NavLink href="/dashboard/business/setup/modules" label="Module activation" icon="puzzle" />
              </div>

              {/* FINANCIALS */}
              <div className="px-2">
                <SectionLabel label="Financials" />
                <NavLink href="/dashboard/business/settings/dimensions" label="Dimensions" icon="vector" />
                <NavLink href="/dashboard/business/settings/chart-of-accounts" label="Chart of accounts" icon="file-spreadsheet" />
                <NavLink href="/dashboard/business/settings/expense-categories" label="Expense categories" icon="sitemap" />
                <NavLink href="/dashboard/business/setup/currencies" label="Currencies & FX" icon="currency-dollar" />
                <NavLink href="/dashboard/business/setup/tax" label="Tax & statutory" icon="receipt-tax" />
              </div>

              {/* PEOPLE */}
              <div className="px-2">
                <SectionLabel label="People" />
                <NavLink href="/dashboard/business/settings/employees" label="Employees" icon="users" />
                <NavLink href="/dashboard/business/settings/cost-centers" label="Cost centers" icon="building-community" />
              </div>

              {/* WORKFLOW & ACCESS */}
              <div className="px-2">
                <SectionLabel label="Workflow &amp; Access" />
                <NavLink href="/dashboard/business/setup/roles" label="Roles & permissions" icon="key" />
                <NavLink href="/dashboard/business/settings/approval-matrix" label="Approval workflows" icon="git-merge" />
                <NavLink href="/dashboard/business/setup/documents" label="Document rules" icon="file-check" />
                <NavLink href="/dashboard/business/admin/users" label="Team" icon="user-plus" />
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
