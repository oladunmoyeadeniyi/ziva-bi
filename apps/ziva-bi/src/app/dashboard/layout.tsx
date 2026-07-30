"use client";

/**
 * Dashboard layout — ZivaBI.
 *
 * Guards all /dashboard/* routes. If the user is not authenticated,
 * redirects to /auth/login. Shows a loading state while the auth
 * context restores the session from the stored refresh token.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // redirect in progress
  }

  return <>{children}</>;
}
