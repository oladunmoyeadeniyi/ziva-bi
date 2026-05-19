"use client";

/**
 * Business dashboard layout — shared shell for all /dashboard/business/* pages.
 *
 * Provides the top header and left sidebar so every business page inherits the
 * same chrome without duplicating markup. The auth guard is handled by the
 * parent /dashboard/layout.tsx so this layout can assume the user is logged in.
 *
 * M4 additions:
 *   - "Approvals" nav item with live pending-count badge
 *   - "Settings" nav item visible only to Tenant Admins
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ApprovalQueueItem {
  approval_id: string;
}

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, accessToken } = useAuth();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Fetch pending approval count for the badge
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ApprovalQueueItem[]>("/api/approvals/queue", { token: accessToken })
      .then((queue) => setPendingCount(queue.length))
      .catch(() => {/* non-fatal — badge stays at 0 */});
  }, [accessToken]);

  const isTenantAdmin = user?.is_tenant_admin ?? false;

  const NAV_ITEMS = [
    { href: "/dashboard/business", label: "Overview", icon: "🏠", exact: true, badge: null },
    { href: "/dashboard/business/expenses", label: "Expenses", icon: "🧾", exact: false, badge: null },
    { href: "/dashboard/business/approvals", label: "Approvals", icon: "✅", exact: false, badge: pendingCount > 0 ? pendingCount : null },
    ...(isTenantAdmin
      ? [{ href: "/dashboard/business/settings/approval-matrix", label: "Settings", icon: "⚙️", exact: false, badge: null }]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-lg font-bold text-gray-900">ZivaBI</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.full_name}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 shrink-0 bg-white border-r border-gray-200 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Business
          </p>
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge !== null && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
