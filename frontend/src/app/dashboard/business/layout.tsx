"use client";

/**
 * Business dashboard layout — shared shell for all /dashboard/business/* pages.
 *
 * M8.2: Full sidebar restructure into four groups:
 *   COMMON DATA | WORKFLOW & ACCESS | MODULE SETUP | GO-LIVE
 * Implementation Mode banner for consultant role.
 * Module Setup items dynamically rendered based on activated modules.
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
}

// ── Nav structure for admin users ──────────────────────────────────────────────

const COMMON_DATA = [
  { href: "/dashboard/business/setup",               label: "Setup dashboard",   exact: true },
  { href: "/dashboard/business/setup/organisation",  label: "Organisation" },
  { href: "/dashboard/business/setup/modules",       label: "Module activation" },
  { href: "/dashboard/business/settings/chart-of-accounts", label: "Chart of accounts" },
  { href: "/dashboard/business/settings/dimensions", label: "Dimensions" },
  { href: "/dashboard/business/settings/employees",  label: "Employees" },
  { href: "/dashboard/business/setup/currencies",    label: "Currencies & FX" },
  { href: "/dashboard/business/setup/tax",           label: "Tax & statutory" },
];

const WORKFLOW_ACCESS = [
  { href: "/dashboard/business/setup/roles",                 label: "Roles & permissions" },
  { href: "/dashboard/business/settings/approval-matrix",    label: "Approval workflows" },
  { href: "/dashboard/business/setup/documents",             label: "Document rules" },
  { href: "/dashboard/business/admin/users",                 label: "Team" },
];

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
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.is_tenant_admin || user?.is_super_admin;
  const isConsultant = user?.role_tier === "consultant";

  // Fetch pending approval badge count on every navigation
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ApprovalQueueItem[]>("/api/approvals/queue", { token: accessToken })
      .then((queue) => setPendingCount(queue.length))
      .catch(() => {});
  }, [accessToken, pathname]);

  // Fetch activated modules for the MODULE SETUP section (admin only)
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

  // Close the dropdown when clicking outside
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

  const NavLink = ({
    href,
    label,
    exact = false,
    badge = null,
  }: {
    href: string;
    label: string;
    exact?: boolean;
    badge?: number | null;
  }) => {
    const active = isActive(href, exact);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
          active
            ? "bg-white text-gray-900 font-medium border border-gray-200 shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
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
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
      {label}
    </p>
  );

  // Exclusively-admin users (config-only, no operational role) skip user-facing items
  const isExclusivelyAdmin = user?.is_tenant_admin && !user?.has_non_admin_role;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Implementation Mode banner (consultant only) */}
      {isConsultant && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-xs font-medium text-amber-800">
            Implementation mode — you have full override access. All changes are logged.
          </span>
        </div>
      )}

      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-lg font-bold text-gray-900">ZivaBI</span>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <span className="font-medium">{user?.full_name}</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
              <Link
                href="/dashboard/profile"
                onClick={() => setShowUserMenu(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Profile
              </Link>
              <hr className="my-1 border-gray-100" />
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-60 shrink-0 bg-gray-50 border-r border-gray-200 py-2 flex flex-col overflow-y-auto">

          {/* User-facing items (shown if user has non-admin roles, or is non-admin) */}
          {!isExclusivelyAdmin && (
            <div className="px-2">
              <NavLink href="/dashboard/business" label="Overview" exact />
              <NavLink href="/dashboard/business/expenses" label="Expenses" />
              <NavLink
                href="/dashboard/business/approvals"
                label="Approvals"
                badge={pendingCount}
              />
            </div>
          )}

          {/* Admin setup sections */}
          {isAdmin && (
            <>
              <div className="px-2">
                <SectionLabel label="Common Data" />
                {COMMON_DATA.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    exact={"exact" in item ? item.exact : false}
                  />
                ))}
              </div>

              <div className="px-2">
                <SectionLabel label="Workflow & Access" />
                {WORKFLOW_ACCESS.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} />
                ))}
              </div>

              <div className="px-2">
                <SectionLabel label="Module Setup" />
                {activeModules === null ? (
                  <p className="px-3 py-1.5 text-xs text-gray-400">Loading…</p>
                ) : activeModules.length === 0 ? (
                  <p className="px-3 py-1.5 text-xs text-gray-400 italic">Activate modules first</p>
                ) : (
                  activeModules.map((mod) => {
                    const href = MODULE_ROUTES[mod.module_key] ?? `/dashboard/business/setup/modules/${mod.module_key}`;
                    return (
                      <NavLink key={mod.module_key} href={href} label={mod.label} />
                    );
                  })
                )}
              </div>

              <div className="px-2">
                <SectionLabel label="Go-live" />
                <NavLink href="/dashboard/business/setup/go-live" label="Readiness & go-live" />
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
