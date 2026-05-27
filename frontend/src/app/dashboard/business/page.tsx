"use client";

/**
 * Business dashboard overview — ZivaBI.
 *
 * Behaviour:
 * - Tenant admins with incomplete setup → redirect to /dashboard/business/setup
 * - Tenant admins with complete setup → show operational overview
 * - Non-admin users → show module shortcuts
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ProgressResponse {
  completed: number;
  total: number;
  percentage: number;
}

export default function BusinessDashboard() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  const isAdmin = user?.is_tenant_admin || user?.is_super_admin;

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      setChecking(false);
      return;
    }

    apiFetch<ProgressResponse>("/api/setup/progress", { token: accessToken })
      .then(data => {
        if (data.percentage < 100) {
          // Setup incomplete — redirect to setup dashboard
          router.replace("/dashboard/business/setup");
        } else {
          setSetupComplete(true);
          setChecking(false);
        }
      })
      .catch(() => {
        // On error, go to setup dashboard as safe fallback
        router.replace("/dashboard/business/setup");
      });
  }, [accessToken, isAdmin, router]);

  // Non-admin users see module shortcuts directly
  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">
            Welcome, {user?.first_name || user?.full_name?.split(" ")[0] || ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500">What would you like to do today?</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/dashboard/business/expenses"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
            <i className="ti ti-receipt text-blue-500" style={{ fontSize: 24 }} />
            <h3 className="text-sm font-semibold text-gray-800 mt-2">Expense retirement</h3>
            <p className="mt-1 text-xs text-blue-600">Submit and track expense reports</p>
          </Link>
          <Link href="/dashboard/business/approvals"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
            <i className="ti ti-checks text-green-500" style={{ fontSize: 24 }} />
            <h3 className="text-sm font-semibold text-gray-800 mt-2">Approvals</h3>
            <p className="mt-1 text-xs text-blue-600">Review and action pending requests</p>
          </Link>
        </div>
      </div>
    );
  }

  // Admin loading / checking state
  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  // Admin with setup complete — operational overview
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">
          Welcome, {user?.first_name || user?.full_name?.split(" ")[0] || ""}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Business finance platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/dashboard/business/expenses"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
          <i className="ti ti-receipt text-blue-500" style={{ fontSize: 24 }} />
          <h3 className="text-sm font-semibold text-gray-800 mt-2">Expense retirement</h3>
          <p className="mt-1 text-xs text-blue-600">Submit and track expense reports</p>
        </Link>
        <Link href="/dashboard/business/approvals"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
          <i className="ti ti-checks text-green-500" style={{ fontSize: 24 }} />
          <h3 className="text-sm font-semibold text-gray-800 mt-2">Approvals</h3>
          <p className="mt-1 text-xs text-blue-600">Review and action pending requests</p>
        </Link>
        <Link href="/dashboard/business/setup"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
          <i className="ti ti-settings text-gray-500" style={{ fontSize: 24 }} />
          <h3 className="text-sm font-semibold text-gray-800 mt-2">System setup</h3>
          <p className="mt-1 text-xs text-blue-600">Configure and manage settings</p>
        </Link>
      </div>
    </div>
  );
}
