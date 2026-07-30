"use client";

/**
 * Platform (owner portal) layout.
 *
 * Guard: super-admin only → redirect to /dashboard.
 * Shell: AppHeader (top) + left section nav (~190px) + main content.
 */

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Overview",          href: "/platform",         icon: "layout-dashboard", exact: true  },
  { label: "Tenants",           href: "/platform/tenants", icon: "building",         exact: false },
  { label: "Team & delegation", href: "/platform/team",    icon: "users-group",      exact: false },
  { label: "Trials & signups",  href: "/platform/trials",  icon: "rocket",           exact: false },
  { label: "Billing",           href: "/platform/billing", icon: "credit-card",      exact: false },
  { label: "Support",           href: "/platform/support", icon: "lifebuoy",         exact: false },
  { label: "Audit log",         href: "/platform/audit",   icon: "history",          exact: false },
];

const SYSTEM_ITEMS = [
  { label: "Platform settings", href: "/platform/settings", icon: "settings" },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user?.is_super_admin) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!user?.is_super_admin) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-red-600">Not authorised. Redirecting…</p>
      </div>
    );
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const NavLink = ({ href, icon, label, exact = false }: { href: string; icon: string; label: string; exact?: boolean }) => {
    const active = isActive(href, exact);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
          active
            ? "bg-purple-50 text-purple-800 font-medium"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <i className={`ti ti-${icon}`} style={{ fontSize: 15, lineHeight: 1 }} />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <AppHeader context="platform" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left section nav */}
        <nav className="w-48 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto py-3">
          <div className="px-2 space-y-0.5 flex-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          {/* SYSTEM group */}
          <div className="px-2 pt-3 mt-3 border-t border-gray-100 space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest select-none">
              System
            </p>
            {SYSTEM_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
