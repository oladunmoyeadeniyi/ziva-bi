"use client";

/**
 * Tax Returns page — M19.
 * Lists and manages VAT, WHT, PAYE tax returns.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface TaxReturn {
  id: string;
  tax_type: string;
  period_start: string;
  period_end: string;
  filing_deadline: string | null;
  status: string;
  total_tax_collected: number;
  total_tax_paid: number;
  net_payable: number;
  filing_reference: string | null;
  filed_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  FILED: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
};

const TAX_COLORS: Record<string, string> = {
  VAT: "bg-purple-50 text-purple-700",
  WHT: "bg-orange-50 text-orange-700",
  PAYE: "bg-blue-50 text-blue-700",
  LEVY: "bg-yellow-50 text-yellow-700",
};

export default function TaxReturnsPage() {
  const { accessToken } = useAuth();
  const [returns, setReturns] = useState<TaxReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<TaxReturn[]>("/api/tax/returns", { token: accessToken })
      .then(setReturns)
      .catch(() => setError("Failed to load tax returns."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const fmt = (n: number) => n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading
        title="Tax Returns"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/business/tax/vat-summary" className="text-sm px-3 py-1.5 border rounded-md text-gray-600">VAT Summary</Link>
            <Link href="/dashboard/business/tax/wht-certificates" className="text-sm px-3 py-1.5 border rounded-md text-gray-600">WHT Certificates</Link>
          </div>
        }
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Tax Type</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Deadline</th>
              <th className="px-4 py-3 text-right">Collected</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Net Payable</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : returns.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No tax returns filed yet.</td></tr>
              : returns.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAX_COLORS[r.tax_type] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.tax_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.period_start} → {r.period_end}</td>
                  <td className="px-4 py-3 text-gray-500">{r.filing_deadline ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(r.total_tax_collected)}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(r.total_tax_paid)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">₦{fmt(r.net_payable)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{r.filing_reference ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
