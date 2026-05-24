"use client";

/**
 * Settings sub-layout — shared shell for all /dashboard/business/settings/* pages.
 *
 * Renders a two-column layout: a narrow settings sub-navigation on the left
 * and the page content on the right. Active link is highlighted based on
 * the current pathname.
 *
 * M8 additions: Master Data collapsible group containing Dimensions,
 * Chart of Accounts, and Expense Categories.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

const MASTER_DATA_LINKS = [
  { href: "/dashboard/business/settings/dimensions",        label: "Dimensions" },
  { href: "/dashboard/business/settings/chart-of-accounts", label: "Chart of Accounts" },
  { href: "/dashboard/business/settings/expense-categories", label: "Expense Categories" },
  { href: "/dashboard/business/settings/employees",          label: "Employees" },
  { href: "/dashboard/business/settings/cost-centers",       label: "Cost Centers" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isMasterDataActive = MASTER_DATA_LINKS.some(
    (l) => pathname === l.href || pathname.startsWith(l.href + "/")
  );
  const [masterDataOpen, setMasterDataOpen] = useState(isMasterDataActive);

  if (!user?.is_tenant_admin && !user?.is_super_admin) {
    return <>{children}</>;
  }

  const TOP_LINKS = [
    { href: "/dashboard/business/settings/approval-matrix", label: "Approval Matrix" },
    { href: "/dashboard/business/settings/expense-config",  label: "Expense Config"  },
    { href: "/dashboard/business/settings/finance-review",  label: "Finance Review"  },
  ];

  return (
    <div className="flex h-full min-h-0">
      {/* Settings sub-nav */}
      <nav className="w-52 shrink-0 border-r border-gray-200 bg-white px-2 py-5 flex flex-col gap-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Settings
        </p>

        {TOP_LINKS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Master Data collapsible group */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setMasterDataOpen((v) => !v)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isMasterDataActive
                ? "text-blue-700 bg-blue-50"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <span>Master Data</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${masterDataOpen ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {masterDataOpen && (
            <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-gray-200 pl-2">
              {MASTER_DATA_LINKS.map((link) => {
                const active = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
