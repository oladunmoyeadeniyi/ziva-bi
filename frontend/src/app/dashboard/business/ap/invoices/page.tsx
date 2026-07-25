"use client";

/**
 * AP Invoices list — /dashboard/business/ap/invoices
 *
 * Lists all AP invoices for the tenant with status filter.
 * Shows duplicate_flag warning badge, quick stats bar, and links to detail page.
 * Export button downloads CSV for all modes.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApInvoice {
  id: string;
  vendor_id: string;
  vendor_name: string;
  reference: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  total_amount_base: string;
  total_vat: string;
  total_wht: string;
  net_payable: string;
  status: string;
  duplicate_flag: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  DRAFT:     "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED:  "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  PAID:      "bg-purple-100 text-purple-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const STATUSES = ["", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID", "CANCELLED"];

export default function ApInvoicesPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<ApInvoice[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const data = await apiFetch<ApInvoice[]>(`/api/ap/invoices${params}`, { token: accessToken });
      setInvoices(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleExport = async (fmt: "csv" | "xlsx") => {
    if (!accessToken) return;
    const params = statusFilter ? `?status=${statusFilter}&format=${fmt}` : `?format=${fmt}`;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ap/invoices/export${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ap_invoices.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed.");
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <PageHeading title="AP Invoices" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <i className="ti ti-download mr-1" />CSV
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <i className="ti ti-download mr-1" />Excel
          </button>
          <Link
            href="/dashboard/business/ap/invoices/new"
            className="px-4 py-1.5 text-sm font-medium text-white rounded-md"
            style={{ background: "var(--ziva-primary, #4F46E5)" }}
          >
            <i className="ti ti-plus mr-1" />New Invoice
          </Link>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              statusFilter === s
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Payable</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No invoices found.{" "}
                  <Link href="/dashboard/business/ap/invoices/new" className="text-indigo-600 hover:underline">
                    Create the first one.
                  </Link>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/dashboard/business/ap/invoices/${inv.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-indigo-600">
                    {inv.reference}
                    {inv.duplicate_flag && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">DUP</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{inv.vendor_name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.invoice_date}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.due_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoney(parseFloat(inv.net_payable))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
