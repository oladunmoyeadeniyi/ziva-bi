"use client";

/**
 * Root landing page — ZivaBI.
 *
 * Redirects authenticated users to their dashboard and unauthenticated
 * users to the login page. The AuthContext handles session restoration
 * on mount, so we wait for isLoading to settle before redirecting.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace("/dashboard");
    } else {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Loading…</div>
    </div>
  );
}
