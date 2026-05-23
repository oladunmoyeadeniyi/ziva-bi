"use client";

/**
 * Settings sub-layout — shared shell for all /dashboard/business/settings/* pages.
 *
 * Renders a two-column layout: a narrow settings sub-navigation on the left
 * and the page content on the right.  Active link is highlighted based on
 * the current pathname.
 *
 * Nav items:
 *   - Approval Matrix   /settings/approval-matrix
 *   - Expense Config    /settings/expense-config
 *   - Master Data       placeholder for M8
 *   - Team              /admin/users
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const SETTINGS_NAV = [
  { href: "/dashboard/business/settings/approval-matrix", label: "Approval Matrix" },
  { href: "/dashboard/business/settings/expense-config",  label: "Expense Config"  },
  { href: null,                                            label: "Master Data"     }, // M8 placeholder
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user?.is_tenant_admin && !user?.is_super_admin) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Settings sub-nav */}
      <nav className="w-44 shrink-0 border-r border-gray-200 bg-white px-2 py-5 flex flex-col gap-0.5">
        <p className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Settings
        </p>
        {SETTINGS_NAV.map((item) => {
          if (item.href === null) {
            return (
              <span
                key={item.label}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 cursor-default"
              >
                {item.label}
                <span className="ml-auto text-xs text-gray-300 font-medium">soon</span>
              </span>
            );
          }
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
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
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
