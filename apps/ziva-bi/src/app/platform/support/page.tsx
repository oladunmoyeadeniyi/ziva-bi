"use client";

/**
 * Platform Support — /platform/support
 *
 * Shows open customer portal messages across all tenants as support items.
 * SA can see which tenants have unresolved customer messages and enter
 * the tenant (via existing impersonation) to investigate.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface SupportItem {
  id: string;
  tenant_name: string;
  customer_name: string;
  message_type: string;
  subject: string;
  status: string;
  created_at: string;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    DISPUTE: "bg-red-50 text-red-700 border-red-200",
    REMITTANCE_NOTICE: "bg-blue-50 text-blue-700 border-blue-200",
    QUERY: "bg-amber-50 text-amber-700 border-amber-200",
    PAYMENT_CONFIRMATION: "bg-green-50 text-green-700 border-green-200",
    OTHER: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colors[type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {type.replace("_", " ")}
    </span>
  );
}

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

export default function PlatformSupportPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<SupportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<SupportItem[]>("/api/platform/support", { token: accessToken })
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const disputes = items.filter(i => i.message_type === "DISPUTE");
  const stale = items.filter(i => daysSince(i.created_at) >= 2);

  return (
    <PageContainer maxWidth="5xl">
      <div className="mb-6">
        <PageHeading>Support</PageHeading>
        <p className="text-sm text-gray-500 mt-1">
          Open customer portal messages across all tenants — {items.length} open items.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Open</p>
          <p className="text-2xl font-bold text-gray-800">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Disputes</p>
          <p className={`text-2xl font-bold ${disputes.length > 0 ? "text-red-600" : "text-gray-800"}`}>{disputes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Stale (48h+)</p>
          <p className={`text-2xl font-bold ${stale.length > 0 ? "text-amber-600" : "text-gray-800"}`}>{stale.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            <i className="ti ti-circle-check text-green-400" style={{ fontSize: 32 }} />
            <p className="mt-2">No open support items.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tenant</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Subject</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Age</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const age = daysSince(item.created_at);
                return (
                  <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.tenant_name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.customer_name}</td>
                    <td className="px-4 py-3"><TypeBadge type={item.message_type} /></td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{item.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${age >= 2 ? "text-amber-600" : "text-gray-500"}`}>
                        {age === 0 ? "Today" : age === 1 ? "Yesterday" : `${age}d ago`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        To resolve a message, enter the tenant via the Tenants page and navigate to Customer Portal → Messages.
      </p>
    </PageContainer>
  );
}
