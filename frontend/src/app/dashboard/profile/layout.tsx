"use client";

/**
 * Profile page layout.
 *
 * Provides the shared AppHeader (no sidebar — profile is user-level, not tenant-admin).
 * Auth is already guaranteed by the parent /dashboard/layout.tsx, so no second guard needed.
 */

import AppHeader from "@/components/AppHeader";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <AppHeader context="business" />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
