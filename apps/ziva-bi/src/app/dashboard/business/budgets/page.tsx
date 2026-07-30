"use client";

/**
 * Budget Periods list page — M16 Budget & Planning.
 *
 * Displays all budget periods for the tenant with status badges, line count,
 * and total budget.  Allows filtering by fiscal year and status.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface BudgetPeriodListItem {
  id: string;
  name: string;
  fiscal_year: number;
  period_start: string;
  period_end: string;
  status: "DRAFT" | "ACTIVE" | "LOCKED";
  line_count: number;
  total_budget: string;
  created_at: string;
}

const STATUS_COLOURS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-100 text-green-700",
  LOCKED: "bg-blue-100 text-blue-700",
};

export default function BudgetsPage() {
  const [periods, setPeriods] = useState<BudgetPeriodListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set("fiscal_year", yearFilter);
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<BudgetPeriodListItem[]>(`/api/budgets?${params}`);
      setPeriods(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [yearFilter, statusFilter]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeading title="Budget & Planning" subtitle="Manage budget periods and track variance vs actuals" />
        <Link href="/dashboard/business/budgets/new">
          <Button>New Budget</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Years</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="LOCKED">Locked</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-400 mb-2">No budget periods found.</div>
          <Link href="/dashboard/business/budgets/new">
            <Button>Create your first budget</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">FY</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Lines</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total Budget</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/dashboard/business/budgets/${p.id}`} className="hover:text-[var(--ziva-primary)]">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.fiscal_year}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(p.period_start).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    {" – "}
                    {new Date(p.period_end).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.line_count}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {formatMoney(parseFloat(p.total_budget))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/business/budgets/${p.id}/variance`}
                      className="text-xs text-[var(--ziva-primary)] hover:underline"
                    >
                      Variance →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
