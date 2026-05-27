"use client";

/**
 * Readiness & Go-live page — M8.2 Implementation Portal.
 *
 * Shows a checklist of all setup sections with blocking/non-blocking status.
 * "Mark tenant as live" button is enabled only when all blocking items are complete.
 * Requires consultant or super admin role to trigger go-live.
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [liveSuccess, setLiveSuccess] = useState(false);

  const isConsultant = user?.role_tier === "consultant" || user?.is_super_admin;

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

  const handleGoLive = async () => {
    if (!accessToken) return;
    setGoingLive(true);
    try {
      await apiFetch("/api/setup/go-live", {
        method: "POST",
        token: accessToken,
      });
      setLiveSuccess(true);
      setShowConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Go-live failed");
    } finally {
      setGoingLive(false);
    }
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

      {liveSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          🚀 Tenant is now live! Welcome emails have been sent to all Power Admins.
        </div>
      )}

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

          {/* Go-live button */}
          {isConsultant && !liveSuccess && (
            <div className="relative inline-block">
              <button
                type="button"
                disabled={!allBlockingComplete}
                onClick={() => setShowConfirm(true)}
                title={
                  !allBlockingComplete
                    ? `${blockingIncomplete.length} blocking item${blockingIncomplete.length !== 1 ? "s" : ""} still incomplete`
                    : "Mark this tenant as live"
                }
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  allBlockingComplete
                    ? "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Mark tenant as live
              </button>
              {!allBlockingComplete && (
                <p className="mt-1.5 text-xs text-gray-500">
                  {blockingIncomplete.length} blocking item{blockingIncomplete.length !== 1 ? "s" : ""} still incomplete
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

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Confirm go-live</h2>
            <p className="text-sm text-gray-600 mb-6">
              This will activate the tenant for all users. Welcome emails will be sent to all Power
              Admins. Are you sure?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGoLive}
                disabled={goingLive}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {goingLive ? "Activating…" : "Yes, mark as live"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
