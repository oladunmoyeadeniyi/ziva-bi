"use client";

/**
 * Setup Dashboard — M8.2 Fixes.
 *
 * Fixed: Tabler outline icons, correct completion/locked logic from backend,
 * green border for complete, amber dot for in_progress, greyed + cursor-not-allowed for locked.
 *
 * Route: /dashboard/business/setup
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

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

// Tabler outline icon names per section key
const SECTION_ICONS: Record<string, string> = {
  organisation:  "building",
  modules:       "puzzle",
  coa:           "file-spreadsheet",
  dimensions:    "vector",
  employees:     "users",
  currencies:    "currency-dollar",
  tax:           "receipt-tax",
  roles:         "key",
  workflows:     "git-merge",
  documents:     "file-check",
  module_setup:  "settings",
  golive:        "rocket",
};

function SectionIcon({ sectionKey }: { sectionKey: string }) {
  const name = SECTION_ICONS[sectionKey] ?? "layout-dashboard";
  return <i className={`ti ti-${name}`} style={{ fontSize: 20, lineHeight: 1 }} />;
}

export default function SetupDashboardPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ProgressResponse>("/api/setup/progress", { token: accessToken })
      .then(setProgress)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading setup status…</div>;
  }
  if (error) {
    return <div className="p-8 text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <PageContainer maxWidth="5xl">
      <PageHeading title="Setup dashboard" />
      <p className="text-sm text-gray-500 mb-6">
        Complete all sections to go live. Required sections must be done before go-live.
      </p>

      {/* Progress bar */}
      {progress && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-700">Setup completeness</span>
            <span className="text-sm text-gray-500">
              {progress.completed} of {progress.total} sections complete — {progress.percentage}%
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
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
          {progress.sections.map((section) => {
            const locked    = section.status === "locked";
            const complete  = section.status === "complete";
            const inProgress = section.status === "in_progress";

            return (
              <div
                key={section.key}
                onClick={() => !locked && router.push(section.route)}
                className={[
                  "relative flex flex-col gap-1.5 p-4 rounded-xl border transition-all",
                  locked
                    ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                    : complete
                    ? "border-green-200 bg-white cursor-pointer hover:border-green-300 hover:shadow-sm"
                    : "border-gray-200 bg-white cursor-pointer hover:border-gray-300 hover:shadow-sm",
                ].join(" ")}
                style={complete ? { borderColor: "var(--color-border-success, #86efac)" } : undefined}
              >
                {/* Icon + status indicator */}
                <div className="flex items-start justify-between">
                  <span className={locked ? "text-gray-400" : complete ? "text-green-600" : "text-gray-700"}>
                    <SectionIcon sectionKey={section.key} />
                  </span>
                  <div className="flex items-center gap-1">
                    {inProgress && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="In progress" />
                    )}
                    {complete && (
                      <i className="ti ti-circle-check text-green-500" style={{ fontSize: 14 }} />
                    )}
                    {locked && (
                      <i className="ti ti-lock text-gray-400" style={{ fontSize: 14 }} />
                    )}
                  </div>
                </div>

                <p className="text-sm font-semibold text-gray-800 leading-tight mt-0.5">
                  {section.label}
                </p>
                <p className="text-xs text-gray-500 leading-snug">
                  {section.subtitle}
                </p>
                {section.blocking && !complete && !locked && (
                  <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide mt-0.5">
                    Required
                  </span>
                )}
                {!section.blocking && !locked && (
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
                    Optional
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Click any section to configure it. Locked sections unlock automatically when prerequisites are complete.
      </p>
    </PageContainer>
  );
}
