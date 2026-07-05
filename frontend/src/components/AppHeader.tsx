"use client";

/**
 * AppHeader — shared top header used by both the platform and business layouts.
 *
 * Adapts by context:
 *   platform  — wordmark + "· Platform" tag; context line = "Platform owner".
 *   business  — wordmark only; context line = companyName | "Viewing {tenant}" while impersonating.
 *
 * Dropdown items (context-aware, no duplicates):
 *   Profile         → /dashboard/profile    (business, not impersonating)
 *   Platform        → /platform             (super admin in business context, not impersonating)
 *   Exit to platform → exitImpersonation()  (while impersonating — also on the banner)
 *   Sign out        → logout() → /          (always)
 *
 * The company-name fetch lives here so the context line is self-contained.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

// ── Icon helper (mirrors the one in business/layout.tsx) ─────────────────────
const Icon = ({ name, size = 15 }: { name: string; size?: number }) => (
  <i className={`ti ti-${name}`} style={{ fontSize: size, lineHeight: 1 }} />
);

// ── Component ─────────────────────────────────────────────────────────────────

interface AppHeaderProps {
  context: "platform" | "business";
}

export default function AppHeader({ context }: AppHeaderProps) {
  const { user, accessToken, logout, impersonation, exitImpersonation, exitUserImpersonation } = useAuth();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Fetch company name (business + admin only) ────────────────────────────

  const fetchCompanyName = useCallback(async () => {
    if (context !== "business" || !accessToken) return;
    const canFetch =
      user?.is_super_admin || !!impersonation || user?.role_tier === "power_admin";
    if (!canFetch) return;
    try {
      const data = await apiFetch<{ legal_name?: string }>("/api/setup/org", {
        token: accessToken,
      });
      if (data.legal_name) setCompanyName(data.legal_name);
    } catch {
      // silently fail — fall back to no context line
    }
  }, [context, accessToken, user, impersonation]);

  useEffect(() => {
    fetchCompanyName();
  }, [fetchCompanyName]);

  // ── Click-away to close menu ──────────────────────────────────────────────

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleExit = async () => {
    setShowMenu(false);
    if (impersonation?.mode === "user") {
      // User-level impersonation: restore implementation token and go back to entry point.
      const returnUrl = impersonation.returnUrl ?? "/platform";
      await exitUserImpersonation();
      window.location.replace(returnUrl);
    } else {
      // Tenant-context impersonation: read the saved return URL (set when entering tenant).
      let returnUrl = "/platform";
      try {
        const stored = sessionStorage.getItem("ziva_impl_return_url");
        if (stored) { returnUrl = stored; sessionStorage.removeItem("ziva_impl_return_url"); }
      } catch {}
      exitImpersonation();
      window.location.replace(returnUrl);
    }
  };

  // ── Context line (shown after the name in the trigger button) ─────────────

  let contextLine: string | null = null;
  if (context === "platform" && !impersonation) {
    contextLine = "Platform owner";
  } else if (impersonation) {
    contextLine = `Viewing ${impersonation.tenantName}`;
  } else if (context === "business" && companyName) {
    contextLine = companyName;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">

      {/* Left — wordmark */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-gray-900">ZivaBI</span>
        {context === "platform" && (
          <>
            <span className="text-xs text-gray-300 select-none">·</span>
            <span className="text-sm font-semibold text-purple-700 tracking-wide uppercase">
              Platform
            </span>
          </>
        )}
      </div>

      {/* Right — user menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
        >
          <span className="font-medium">{user?.full_name}</span>
          {contextLine && (
            <span className="text-gray-400 text-xs hidden sm:inline">
              — {contextLine}
            </span>
          )}
          <Icon name="chevron-down" size={13} />
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">

            {/* Identity row */}
            <div className="flex items-start justify-between px-4 py-2 border-b border-gray-100">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {user?.full_name}
                </p>
                <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMenu(false)}
                className="text-gray-400 hover:text-gray-600 mt-0.5 flex-shrink-0"
              >
                <Icon name="x" size={13} />
              </button>
            </div>

            {/* Profile — business, not impersonating */}
            {context === "business" && !impersonation && (
              <Link
                href="/dashboard/profile"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Icon name="user" size={13} />
                Profile
              </Link>
            )}

            {/* Platform — super admin in business context, not impersonating */}
            {user?.is_super_admin && context === "business" && !impersonation && (
              <Link
                href="/platform"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50"
              >
                <Icon name="building-skyscraper" size={13} />
                Platform
              </Link>
            )}

            {/* Exit to platform — while impersonating */}
            {impersonation && (
              <button
                type="button"
                onClick={handleExit}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
              >
                <Icon name="arrow-back-up" size={13} />
                Exit to platform
              </button>
            )}

            <hr className="my-1 border-gray-100" />

            {/* Sign out — always */}
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
  );
}
