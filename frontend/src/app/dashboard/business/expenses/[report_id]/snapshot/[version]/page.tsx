"use client";

/**
 * Snapshot viewer — /dashboard/business/expenses/{report_id}/snapshot/{version}
 *
 * Shows the exact expense lines and header that were submitted at a specific version.
 * Linked from the audit trail page.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface SnapshotLine {
  line_number: number;
  gl_account: string;
  pl_group: string | null;
  io_dimension: string | null;
  cost_center: string | null;
  location: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  description: string;
  amount: string;
}

interface SnapshotData {
  report_number: string;
  employee_id: string;
  report_date: string;
  currency: string;
  total_amount: string;
  lines: SnapshotLine[];
}

interface SnapshotResponse {
  id: string;
  report_id: string;
  version: number;
  submitted_at: string;
  snapshot_data: SnapshotData;
  created_at: string;
}

function formatNGN(amount: string): string {
  return "₦" + parseFloat(amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB");
}
function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function SnapshotPage() {
  const { report_id, version } = useParams<{ report_id: string; version: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !report_id || !version) return;
    apiFetch<SnapshotResponse>(
      `/api/approvals/reports/${report_id}/snapshot/${version}`,
      { token: accessToken }
    )
      .then(setSnapshot)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load snapshot.";
        setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
      })
      .finally(() => setIsLoading(false));
  }, [accessToken, report_id, version]);

  if (isLoading) {
    return (
      <PageContainer maxWidth="5xl" className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </PageContainer>
    );
  }
  if (error || !snapshot) {
    return (
      <PageContainer maxWidth="5xl">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Snapshot not found."}
        </div>
      </PageContainer>
    );
  }

  const data = snapshot.snapshot_data;
  const grandTotal = data.lines.reduce((sum, l) => sum + parseFloat(l.amount), 0);

  return (
    <PageContainer maxWidth="5xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">← Back</button>
        <div className="flex items-center gap-3">
          <PageHeading title="Submission Snapshot" />
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            Version {snapshot.version}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-gray-500">
          {data.report_number} — submitted {formatDateTime(snapshot.submitted_at)}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report No.</p>
            <p className="mt-0.5 text-sm text-gray-900">{data.report_number}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Date</p>
            <p className="mt-0.5 text-sm text-gray-900">{formatDate(data.report_date)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Currency</p>
            <p className="mt-0.5 text-sm text-gray-900">{data.currency}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</p>
            <p className="mt-0.5 text-sm font-bold text-gray-900">{formatNGN(data.total_amount)}</p>
          </div>
        </div>

        <div className="px-6 py-6 overflow-x-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Expense Lines at Submission
          </h2>
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {["#", "GL Account", "P/L Group", "IO / Dimension", "Cost Center", "Location",
                  "Inv. Date", "Inv. No.", "Description", "Amount (NGN)"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.lines.map((line) => (
                <tr key={line.line_number} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{line.line_number}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium">{line.gl_account}</td>
                  <td className="px-3 py-2 text-gray-600">{line.pl_group ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{line.io_dimension ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{line.cost_center ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{line.location ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(line.invoice_date)}</td>
                  <td className="px-3 py-2 text-gray-600">{line.invoice_number ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900">{line.description}</td>
                  <td className="px-3 py-2 text-gray-900 font-semibold text-right whitespace-nowrap">{formatNGN(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={9} className="px-3 py-3 text-right text-sm font-bold text-gray-800 uppercase tracking-wider">Grand Total</td>
                <td className="px-3 py-3 text-right text-base font-bold text-gray-900 whitespace-nowrap">
                  {"₦" + grandTotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
