"use client";

/**
 * Readiness & Go-live page — M8.2 Implementation Portal, updated for M9.0.1.
 *
 * Shows a checklist of all setup sections with blocking/non-blocking status.
 * Under the test-first model every tenant viewed here IS the test tenant
 * (no live counterpart exists until first promotion). Going live is no
 * longer a direct action on this page -- it routes to the platform
 * promotion review (/platform/tenants/[id]), which creates or updates the
 * live tenant via the unified promotion engine. The old direct
 * POST /api/setup/go-live call is gone from this page because the backend
 * now rejects it for any non-live tenant.
 *
 * Route: /dashboard/business/setup/go-live
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface SectionStatus {
  key: string;
  label: string;
  status: "complete" | "in_progress" | "not_started" | "locked";
  subtitle: string;
  route: string;
  blocking: boolean;
}

interface ProgressResponse {
  sections: SectionStatus[];
  total: number;
  completed: number;
  percentage: number;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Complete
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
      <span className="w-2 h-2 rounded-full bg-gray-300" />
      Not started
    </span>
  );
}

export default function GoLivePage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isConsultant = user?.is_super_admin;

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ProgressResponse>("/api/setup/progress", { token: accessToken })
      .then(setProgress)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const blockingIncomplete = progress?.sections.filter(
    (s) => s.blocking && s.status !== "complete"
  ) ?? [];

  const allBlockingComplete = blockingIncomplete.length === 0;

  // M9.0.1: live environments are now created/updated exclusively via the
  // platform promotion engine (super-admin only), not by flipping this
  // tenant's own is_active/lifecycle_status in place. Navigate there instead
  // of calling the old /api/setup/go-live endpoint directly -- that endpoint
  // now 400s for any tenant that isn't already live.
  const goToPromotionReview = () => {
    if (user?.tenant_id) router.push(`/platform/tenants/${user.tenant_id}`);
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading readiness checklist…</div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Readiness checklist</h1>
      <p className="text-sm text-gray-500 mb-6">
        Complete all blocking items before marking this tenant as live.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {progress && (
        <>
          {/* Progress summary */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {progress.completed} of {progress.total} sections complete
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {blockingIncomplete.length} blocking item{blockingIncomplete.length !== 1 ? "s" : ""} remaining
              </p>
            </div>
            <div className="text-2xl font-bold text-gray-800">{progress.percentage}%</div>
          </div>

          {/* Checklist table */}
          <div className="overflow-hidden border border-gray-200 rounded-lg mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">Section</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Blocking?</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {progress.sections.map((s) => (
                  <tr key={s.key} className={s.status === "complete" ? "bg-green-50/30" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.label}</p>
                      <p className="text-xs text-gray-500">{s.subtitle}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.blocking ? (
                        <span className="text-xs font-semibold text-red-600">Yes</span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status !== "complete" && (
                        <button
                          type="button"
                          onClick={() => router.push(s.route)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Go to section →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Go live -- routes to the platform promotion review (M9.0.1) */}
          {isConsultant && (
            <div className="relative inline-block">
              <button
                type="button"
                disabled={!allBlockingComplete}
                onClick={goToPromotionReview}
                title={
                  !allBlockingComplete
                    ? `${blockingIncomplete.length} blocking item${blockingIncomplete.length !== 1 ? "s" : ""} still incomplete`
                    : "Review and promote this tenant's configuration to live"
                }
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  allBlockingComplete
                    ? "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Review &amp; go live →
              </button>
              {!allBlockingComplete && (
                <p className="mt-1.5 text-xs text-gray-500">
                  {blockingIncomplete.length} blocking item{blockingIncomplete.length !== 1 ? "s" : ""} still incomplete
                </p>
              )}
              {allBlockingComplete && (
                <p className="mt-1.5 text-xs text-gray-400">
                  Opens the platform promotion review, where a super admin creates or updates
                  this tenant&apos;s live environment.
                </p>
              )}
            </div>
          )}

          {!isConsultant && (
            <p className="text-sm text-gray-500">
              Only Ziva BI consultants and super admins can mark a tenant as live.
            </p>
          )}
        </>
      )}
    </div>
  );
}
