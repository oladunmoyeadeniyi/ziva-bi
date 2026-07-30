"use client";

/**
 * Dashboard root — ZivaBI.
 *
 * Dispatches authenticated users to the correct portal:
 *   super admin  → /platform
 *   business     → /dashboard/business
 *   individual   → /auth/login  (personal dashboard removed; no frontend destination)
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    if (user.is_super_admin) {
      router.replace("/platform");
    } else if (user.account_type === "business") {
      router.replace("/dashboard/business");
    } else {
      // Individual accounts have no frontend destination — send to login.
      router.replace("/auth/login");
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-500">Redirecting…</div>
    </div>
  );
}
