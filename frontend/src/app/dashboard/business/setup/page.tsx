"use client";

/**
 * Setup Dashboard — M8.2 Implementation Portal.
 *
 * Shows a progress bar and checklist grid of all 12 setup sections.
 * Each card shows status (complete/in_progress/not_started/locked),
 * a subtitle, and navigates to the section on click.
 * Locked cards are greyed out and not clickable.
 *
 * Route: /dashboard/business/setup
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

const STATUS_ICONS: Record<string, string> = {
  organisation:   "🏢",
  modules:        "🧩",
  coa:            "📊",
  dimensions:     "📐",
  employees:      "👥",
  currencies:     "💱",
  tax:            "📋",
  roles:          "🔐",
  workflows:      "✅",
  documents:      "📎",
  module_setup:   "⚙️",
  golive:         "🚀",
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "complete"    ? "bg-green-500" :
    status === "in_progress" ? "bg-amber-400" :
    status === "locked"      ? "bg-gray-300"  :
                               "bg-gray-300";
  return <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
}

export default function SetupDashboardPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isConsultant = user?.role_tier === "consultant";

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ProgressResponse>("/api/setup/progress", { token: accessToken })
      .then(setProgress)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return (
      <div className="p-8 text-sm text-gray-500">Loading setup status…</div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-red-600">Error: {error}</div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Consultant info banner */}
      {isConsultant && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Implementation mode — you have full override access. Changes are logged against your consultant account.
        </div>
      )}

      {/* Heading */}
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Setup dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        Complete all sections to onboard this tenant end-to-end.
      </p>

      {/* Progress bar */}
      {progress && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-700">Setup completeness</span>
            <span className="text-sm text-gray-500">
              {progress.completed} of {progress.total} sections complete
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist grid */}
      {progress && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {progress.sections.map((section) => {
            const locked = section.status === "locked";
            const complete = section.status === "complete";

            return (
              <div
                key={section.key}
                onClick={() => !locked && router.push(section.route)}
                className={`relative flex flex-col gap-1.5 p-4 rounded-xl border transition-all ${
                  locked
                    ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                    : complete
                    ? "border-green-200 bg-white cursor-pointer hover:border-green-300 hover:shadow-sm"
                    : "border-gray-200 bg-white cursor-pointer hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl leading-none">
                    {STATUS_ICONS[section.key] ?? "📌"}
                  </span>
                  <StatusDot status={section.status} />
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">
                  {section.label}
                </p>
                <p className="text-xs text-gray-500 leading-tight">
                  {section.subtitle}
                </p>
                {section.blocking && section.status !== "complete" && (
                  <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">
                    Required
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Click any section to jump to it. Locked sections unlock automatically when prerequisites are met.
      </p>
    </div>
  );
}
