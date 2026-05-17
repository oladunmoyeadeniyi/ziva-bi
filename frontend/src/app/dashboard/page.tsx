"use client";

/**
 * Dashboard root — ZivaBI.
 *
 * Reads the user's account_type and redirects to the appropriate portal.
 * This keeps the /dashboard URL clean while routing individuals to /dashboard/personal
 * and business users to /dashboard/business.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    if (user.account_type === "individual") {
      router.replace("/dashboard/personal");
    } else {
      router.replace("/dashboard/business");
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-500">Redirecting…</div>
    </div>
  );
}
