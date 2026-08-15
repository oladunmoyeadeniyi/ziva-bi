"use client";

/**
 * Advance Aging Report — /dashboard/business/advances/aging
 *
 * Finance view of all outstanding advances grouped by age bucket.
 * Shows: employee, advance number, purpose, amount, outstanding, days, due date, bucket.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import Link from "next/link";

interface AgingRow {
  id: string;
  advance_number: string;
  employee_id: string;
  advance_type: string;
  purpose: string;
  amount: string;
  total_retired: string;
  outstanding: string;
  currency: string;
  status: string;
  issued_at: string | null;
  due_retirement_date: string | null;
  days_outstanding: number | null;
  age_bucket: string;
}

const BUCKET_COLORS: Record<string, string> = {
  "0-30 days":   "bg-green-50 text-green-700",
  "31-60 days":  "bg-yellow-50 text-yellow-700",
  "61-90 days":  "bg-orange-50 text-orange-700",
  "Over 90 days":"bg-red-50 text-red-700",
};

export default function AdvanceAgingPage() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<AgingRow[]>("/api/advances/aging", { token: accessToken })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const totalOutstanding = rows.reduce((s, r) => s + parseFloat(r.outstanding || "0"), 0);

  return (
    <PageContainer>
      <PageHeading
        title="Advance Aging Report"
        subtitle="Outstanding advances by age — ISSUED and partially retired"
      />

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="ti ti-checks text-4xl block mb-2" />
          <p className="text-sm">No outstanding advances. All cleared!</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {["0-30 days", "31-60 days", "61-90 days", "Over 90 days"].map((bucket) => {
              const bucketRows = rows.filter((r) => r.age_bucket === bucket);
              const bucketTotal = bucketRows.reduce((s, r) => s + parseFloat(r.outstanding || "0"), 0);
              return (
                <div key={bucket} className={`rounded-lg border p-4 ${BUCKET_COLORS[bucket] ?? "bg-gray-50 border-gray-200"}`}>
                  <p className="text-xs font-semibold mb-1">{bucket}</p>
                  <p className="text-lg font-bold">{bucketRows.length} advance{bucketRows.length !== 1 ? "s" : ""}</p>
                  <p className="text-sm">{formatMoney(bucketTotal, "NGN")}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Advance #", "Type", "Purpose", "Amount", "Outstanding", "Issued", "Due date", "Days", "Bucket"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/business/advances/${row.id}`} className="text-blue-600 hover:underline font-medium">
                        {row.advance_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.advance_type}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={row.purpose}>{row.purpose}</td>
                    <td className="px-3 py-2 font-medium">{formatMoney(parseFloat(row.amount), row.currency)}</td>
                    <td className="px-3 py-2 font-semibold text-amber-700">{formatMoney(parseFloat(row.outstanding), row.currency)}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{row.issued_at ? new Date(row.issued_at).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-xs">{row.due_retirement_date ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{row.days_outstanding ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_COLORS[row.age_bucket] ?? "bg-gray-100"}`}>
                        {row.age_bucket}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={5} className="px-3 py-2 text-right font-semibold text-sm text-gray-700">Total outstanding</td>
                  <td colSpan={4} className="px-3 py-2 font-bold text-amber-700">{formatMoney(totalOutstanding, "NGN")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
