"use client";

/**
 * Audit trail — /dashboard/business/expenses/{report_id}/audit
 *
 * Chronological timeline of all approval events for an expense report.
 * Shows snapshot version on submission events with a "View snapshot" link.
 * Restricted to Tenant Admins (enforced on the backend; link hidden for others).
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface AuditLogEntry {
  id: string;
  event_type: string;
  user_id: string | null;
  actor_name: string;
  log_metadata: Record<string, unknown>;
  created_at: string;
}

const EVENT_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  EXPENSE_SUBMITTED:    { label: "Submitted",    color: "text-blue-700",   dot: "bg-blue-500" },
  EXPENSE_RESUBMITTED:  { label: "Resubmitted",  color: "text-blue-700",   dot: "bg-blue-400" },
  EXPENSE_APPROVED:     { label: "Approved",     color: "text-green-700",  dot: "bg-green-500" },
  EXPENSE_REJECTED:     { label: "Rejected",     color: "text-red-700",    dot: "bg-red-500" },
  EXPENSE_REFERRED_BACK:{ label: "Referred Back",color: "text-orange-700", dot: "bg-orange-500" },
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function levelLabel(level: number | undefined): string {
  if (!level) return "";
  return ` (Level ${level})`;
}

function EventDetail({ entry }: { entry: AuditLogEntry }) {
  const m = entry.log_metadata;

  switch (entry.event_type) {
    case "EXPENSE_SUBMITTED":
    case "EXPENSE_RESUBMITTED":
      return (
        <div className="text-sm text-gray-700 space-y-0.5">
          {entry.event_type === "EXPENSE_RESUBMITTED" && (
            <p>Resumed from Level {String(m.resumed_from_level)}</p>
          )}
          {m.snapshot_version != null && (
            <p className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Snapshot v{String(m.snapshot_version)}</span>
              <Link
                href={`/dashboard/business/expenses/${String(m.report_id)}/snapshot/${String(m.snapshot_version)}`}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                View snapshot
              </Link>
            </p>
          )}
          <p className="text-xs text-gray-500">
            Total: ₦{parseFloat(m.total_amount as string).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </p>
        </div>
      );

    case "EXPENSE_APPROVED": {
      const comment = m.comment ? String(m.comment) : null;
      const responseComment = m.response_comment ? String(m.response_comment) : null;
      return (
        <div className="text-sm text-gray-700 space-y-0.5">
          <p>Approved at Level {String(m.level)}</p>
          {comment && <p className="text-xs text-gray-500 italic">&ldquo;{comment}&rdquo;</p>}
          {responseComment && (
            <p className="text-xs text-blue-600 italic">Response: &ldquo;{responseComment}&rdquo;</p>
          )}
        </div>
      );
    }

    case "EXPENSE_REJECTED": {
      const comment = m.comment ? String(m.comment) : null;
      return (
        <div className="text-sm text-gray-700 space-y-0.5">
          <p>Rejected at Level {String(m.level)}</p>
          {comment && <p className="text-xs text-gray-500 italic">&ldquo;{comment}&rdquo;</p>}
        </div>
      );
    }

    case "EXPENSE_REFERRED_BACK": {
      const comment = m.comment ? String(m.comment) : null;
      const visibleToRequestor = Boolean(m.visible_to_requestor);
      const targetLevels = Array.isArray(m.target_levels) ? (m.target_levels as number[]).join(", ") : "";
      return (
        <div className="text-sm text-gray-700 space-y-0.5">
          {m.target_type === "requestor" ? (
            <p>Referred back to requestor from Level {String(m.level)}</p>
          ) : (
            <p>Referred from Level {String(m.level)} to Level {targetLevels}</p>
          )}
          {comment && <p className="text-xs text-gray-500 italic">&ldquo;{comment}&rdquo;</p>}
          {visibleToRequestor && (
            <p className="text-xs text-orange-600">Visible to requestor</p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

export default function AuditTrailPage() {
  const { report_id } = useParams<{ report_id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [reportNumber, setReportNumber] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !report_id) return;
    const fetchAll = async () => {
      try {
        const [auditData, reportData] = await Promise.all([
          apiFetch<AuditLogEntry[]>(`/api/approvals/reports/${report_id}/audit-log`, { token: accessToken }),
          apiFetch<{ report_number: string }>(`/api/expenses/reports/${report_id}`, { token: accessToken }),
        ]);
        setEntries(auditData);
        setReportNumber(reportData.report_number);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load audit trail.";
        setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [accessToken, report_id]);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">Audit Trail</h1>
        {reportNumber && (
          <p className="mt-0.5 text-sm text-gray-500">{reportNumber}</p>
        )}
      </div>

      {isLoading && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-3 h-3 mt-1 rounded-full bg-gray-200 shrink-0 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">No audit events recorded for this report yet.</p>
        </div>
      )}

      {!isLoading && !error && entries.length > 0 && (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-gray-200" />

          <div className="space-y-8">
            {entries.map((entry) => {
              const meta = EVENT_LABELS[entry.event_type] ?? {
                label: entry.event_type,
                color: "text-gray-700",
                dot: "bg-gray-400",
              };
              return (
                <div key={entry.id} className="flex gap-5 relative">
                  {/* Dot */}
                  <div className={`w-3 h-3 rounded-full ${meta.dot} shrink-0 mt-1 z-10 ring-2 ring-white`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                      <span className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">by {entry.actor_name}</p>
                    <EventDetail entry={entry} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
