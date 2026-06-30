"use client";

/**
 * Business dashboard home — /dashboard/business
 *
 * Admin branch: checks setup progress → redirect to /setup if incomplete, else admin overview.
 * Staff branch: real home dashboard — greeting, metric cards, tasks, modules.
 *   Metrics derived client-side from GET /api/expenses/reports and GET /api/approvals/queue.
 *   No fake modules — only links to pages that actually exist.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProgressResponse {
  completed: number;
  total: number;
  percentage: number;
}

interface ExpenseReport {
  id: string;
  status: string;
}

interface ApprovalQueueItem {
  approval_id: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  href,
  accent,
  loading,
}: {
  label: string;
  value: number;
  href: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <p className={`text-2xl font-bold ${accent} ${loading ? "opacity-30" : ""}`}>
        {loading ? "–" : value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Link>
  );
}

// ── Staff home ────────────────────────────────────────────────────────────────

function StaffHome({
  accessToken,
  firstName,
  subLine,
  rolePillLabel,
}: {
  accessToken: string;
  firstName: string;
  subLine: string;
  rolePillLabel: string;
}) {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<ExpenseReport[]>("/api/expenses/reports", { token: accessToken }),
      apiFetch<ApprovalQueueItem[]>("/api/approvals/queue", { token: accessToken }),
    ])
      .then(([reps, queue]) => {
        setReports(reps);
        setPendingApprovals(queue.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Derived metrics
  const drafts = reports.filter((r) => r.status === "DRAFT").length;
  const inReview = reports.filter((r) =>
    ["SUBMITTED", "PENDING_APPROVAL", "REFERRED_TO_REQUESTOR"].includes(r.status)
  ).length;
  const approved = reports.filter((r) => r.status === "APPROVED").length;

  // Tasks
  const tasks: Array<{ text: string; href: string }> = [];
  if (drafts > 0)
    tasks.push({ text: `${drafts} draft report${drafts > 1 ? "s" : ""} ready to submit`, href: "/dashboard/business/expenses" });
  if (pendingApprovals > 0)
    tasks.push({ text: `${pendingApprovals} report${pendingApprovals > 1 ? "s" : ""} awaiting your approval`, href: "/dashboard/business/approvals" });

  return (
    <PageContainer maxWidth="4xl">

      {/* Greeting row — left: name + subline; right: role pill + notification bell */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <PageHeading title={`Welcome, ${firstName}`} subtitle={subLine} />
        </div>

        <div className="flex items-center gap-2.5 shrink-0 mt-0.5">
          {/* Role pill */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 select-none">
            {rolePillLabel}
          </span>

          {/* Notification bell — count from approvals queue for now */}
          {/* notifications: real notification feed is future; count derives from approvals for now */}
          <Link
            href="/dashboard/business/approvals"
            className="relative text-gray-500 hover:text-gray-800 transition-colors"
            title={pendingApprovals > 0 ? `${pendingApprovals} pending approval${pendingApprovals > 1 ? "s" : ""}` : "Approvals"}
          >
            <i className="ti ti-bell" style={{ fontSize: 18 }} />
            {pendingApprovals > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                {pendingApprovals > 9 ? "9+" : pendingApprovals}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Metric cards — To approve only shown if the user has pending approvals */}
      <div className={`grid grid-cols-2 ${pendingApprovals > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4 mb-8`}>
        <MetricCard
          label="My drafts"
          value={drafts}
          href="/dashboard/business/expenses"
          accent="text-gray-700"
          loading={loading}
        />
        <MetricCard
          label="In review"
          value={inReview}
          href="/dashboard/business/expenses"
          accent="text-blue-600"
          loading={loading}
        />
        <MetricCard
          label="Approved"
          value={approved}
          href="/dashboard/business/expenses"
          accent="text-green-600"
          loading={loading}
        />
        {pendingApprovals > 0 && (
          <MetricCard
            label="To approve"
            value={pendingApprovals}
            href="/dashboard/business/approvals"
            accent="text-amber-600"
            loading={loading}
          />
        )}
      </div>

      {/* My tasks */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">My Tasks</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No pending tasks. You&apos;re all caught up.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.href + t.text} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <Link href={t.href} className="text-sm text-gray-700 hover:text-blue-600 hover:underline">
                  {t.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* My modules — real pages only; structure for future modules to plug into */}
      {/* RBAC + modules: show modules the user is granted access to once RBAC is wired */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">My Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/business/expenses"
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <i className="ti ti-receipt text-blue-600" style={{ fontSize: 18 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Expense retirement</h3>
              <p className="mt-0.5 text-xs text-gray-500">Submit and track expense reports</p>
            </div>
          </Link>

          {/* RBAC: gate Approvals to approvers once RBAC is available */}
          <Link
            href="/dashboard/business/approvals"
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:border-green-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <i className="ti ti-checks text-green-600" style={{ fontSize: 18 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Approvals</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {pendingApprovals > 0
                  ? `${pendingApprovals} pending action${pendingApprovals > 1 ? "s" : ""}`
                  : "Review and action pending requests"}
              </p>
            </div>
          </Link>
        </div>
      </div>

    </PageContainer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BusinessDashboard() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  // M9.3c: config admin = super admin (incl. impersonating) or power_admin tier.
  // is_tenant_admin alone no longer grants config access — plain staff use the non-admin path.
  const isAdmin = user?.is_super_admin || user?.role_tier === "power_admin";

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

  // ── Non-admin / staff path ────────────────────────────────────────────────
  if (!isAdmin) {
    const firstName = user?.first_name || user?.full_name?.split(" ")[0] || "";

    // Context subline: real fields only — department and/or job_title; generic fallback.
    const subLine = user?.department
      ? `${user.department}${user.job_title ? " · " + user.job_title : ""}`
      : user?.job_title
      ? user.job_title
      : "Your workspace";

    // Role pill label: plain-English label from real user fields.
    const rolePillLabel = user?.is_super_admin
      ? "Super admin"
      : user?.role_tier === "power_admin"
      ? "Power admin"
      : user?.role_tier === "functional_admin"
      ? "Functional admin"
      : "Staff";

    return (
      <StaffHome
        accessToken={accessToken ?? ""}
        firstName={firstName}
        subLine={subLine}
        rolePillLabel={rolePillLabel}
      />
    );
  }

  // ── Admin loading / checking state ────────────────────────────────────────
  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  // ── Admin with setup complete — operational overview ──────────────────────
  return (
    <PageContainer maxWidth="5xl">
      <div className="mb-8">
        <PageHeading title={`Welcome, ${user?.first_name || user?.full_name?.split(" ")[0] || ""}`} subtitle="Business finance platform" />
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
    </PageContainer>
  );
}
