"use client";

/**
 * Purchase Orders list — /dashboard/business/po
 *
 * Lists all POs for the tenant with status filter and quick stats.
 * Links to PO detail, new PO, GRN list, and match report.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface PurchaseOrder {
  id: string;
  vendor_id: string;
  po_number: string;
  title: string;
  status: string;
  currency: string;
  total_amount_base: string;
  amount_received: string;
  amount_invoiced: string;
  delivery_date: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
}

const STATUS_COLOURS: Record<string, string> = {
  DRAFT:              "bg-gray-100 text-gray-600",
  SUBMITTED:          "bg-blue-100 text-blue-700",
  APPROVED:           "bg-green-100 text-green-700",
  REJECTED:           "bg-red-100 text-red-700",
  SENT:               "bg-indigo-100 text-indigo-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  FULLY_RECEIVED:     "bg-teal-100 text-teal-700",
  CLOSED:             "bg-gray-200 text-gray-600",
  CANCELLED:          "bg-gray-100 text-gray-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const STATUSES = ["", "DRAFT", "SUBMITTED", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED", "REJECTED"];

export default function PoListPage() {
  const { accessToken } = useAuth();

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const data = await apiFetch<PurchaseOrder[]>(`/api/po/${params}`, { token: accessToken });
      setPos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load purchase orders.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalOpen = pos.filter(p => !["CLOSED", "CANCELLED", "REJECTED"].includes(p.status))
    .reduce((s, p) => s + parseFloat(p.total_amount_base || "0"), 0);

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <PageHeading title="Purchase Orders" />
        <div className="flex gap-2">
          <Link
            href="/dashboard/business/po/match-report"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-gray-700"
          >
            Match Report
          </Link>
          <Link
            href="/dashboard/business/po/new"
            className="px-3 py-1.5 text-sm rounded-md text-white transition-colors"
            style={{ background: "var(--ziva-primary, #2563EB)" }}
          >
            + New PO
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total POs", value: pos.length },
          { label: "Open POs", value: pos.filter(p => ["SUBMITTED","APPROVED","SENT","PARTIALLY_RECEIVED"].includes(p.status)).length },
          { label: "Open Value", value: formatMoney(totalOpen) },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <select
          className="border border-gray-300 rounded-md text-sm px-2 py-1.5 bg-white"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["PO #","Title","Status","Total","Received","Delivery Date","Created"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No purchase orders found.{" "}
                    <Link href="/dashboard/business/po/new" className="text-blue-600 hover:underline">Create one</Link>
                  </td>
                </tr>
              ) : pos.map(po => (
                <tr key={po.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600">
                    <Link href={`/dashboard/business/po/${po.id}`}>{po.po_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                    <Link href={`/dashboard/business/po/${po.id}`}>{po.title}</Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatMoney(parseFloat(po.total_amount_base))}</td>
                  <td className="px-4 py-3 text-gray-600">{formatMoney(parseFloat(po.amount_received))}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{po.delivery_date ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(po.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
