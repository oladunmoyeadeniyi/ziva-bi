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


export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, accessToken, isLoading, impersonation, exitImpersonation, exitUserImpersonation } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeModules, setActiveModules] = useState<ModuleState[] | null>(null);
  const [orgConfig, setOrgConfig] = useState<{ use_dimensions?: boolean; use_multi_currency?: boolean } | null>(null);

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
  }, [accessToken, isAdmin, pathname]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Fetch org configuration to conditionally show/hide sidebar links
  const fetchOrgConfig = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    try {
      const data = await apiFetch<{ org_configuration?: { use_dimensions?: boolean; use_multi_currency?: boolean } }>(
        "/api/setup/org", { token: accessToken }
      );
      if (data.org_configuration) setOrgConfig(data.org_configuration);
    } catch {
      // silently fail
    }
  }, [accessToken, isAdmin, pathname]);

  useEffect(() => {
    fetchOrgConfig();
  }, [fetchOrgConfig]);

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
          onExit={() => { exitImpersonation(); router.push("/platform"); }}
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
        <nav className="w-60 shrink-0 bg-gray-50 border-r border-gray-200 py-2 flex flex-col overflow-y-auto h-full">

          {/* WORKSPACE — hidden when SA is in tenant-context mode (not user impersonation) */}
          {!hideWorkspace && (
            <div className="px-2">
              <SectionLabel label="Workspace" />
              <NavLink href="/dashboard/business" label="Home" icon="home" exact />
              <NavLink href="/dashboard/business/expenses" label="Expenses" icon="receipt" />
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
                <NavLink href="/dashboard/business/setup/organisation" label="Organisation" icon="building" />
                <NavLink href="/dashboard/business/setup/modules" label="Module activation" icon="puzzle" />
              </div>

              {/* FINANCIALS */}
              <div className="px-2">
                <SectionLabel label="Financials" />
                {orgConfig?.use_dimensions && (
                  <NavLink href="/dashboard/business/settings/dimensions" label="Dimensions" icon="vector" />
                )}
                <NavLink href="/dashboard/business/settings/chart-of-accounts" label="Chart of accounts" icon="file-spreadsheet" />
                <NavLink href="/dashboard/business/setup/bank-accounts" label="Bank accounts" icon="building-bank" />
                <NavLink href="/dashboard/business/setup/account-mapping" label="Account mapping" icon="arrows-transfer-up" />
                <NavLink href="/dashboard/business/setup/periods" label="Period management" icon="calendar" />
                {orgConfig?.use_multi_currency && (
                  <NavLink href="/dashboard/business/setup/currencies" label="Currencies & FX" icon="currency-dollar" />
                )}
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
