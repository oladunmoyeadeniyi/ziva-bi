"use client";

/**
 * Customer Portal admin page — /dashboard/business/customer-portal
 *
 * Finance team can enable/disable portal access per customer,
 * view portal links, and review customer messages/disputes.
 *
 * Tabs:
 *   Customers — list + enable/disable portal + copy link
 *   Messages  — customer messages/disputes awaiting resolution
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface CustomerPortalStatus {
  id: string;
  code: string;
  name: string;
  email: string | null;
  portal_enabled: boolean;
  portal_url: string | null;
}

interface PortalMessage {
  id: string;
  customer_name: string;
  message_type: string;
  subject: string;
  amount: number | null;
  status: string;
  created_at: string;
}

type Tab = "customers" | "messages";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "bg-amber-50 text-amber-700 border-amber-200",
    RESOLVED: "bg-green-50 text-green-700 border-green-200",
    CLOSED: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] ?? "bg-blue-50 text-blue-700 border-blue-200"}`}>
      {status}
    </span>
  );
}

export default function CustomerPortalPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("customers");
  const [customers, setCustomers] = useState<CustomerPortalStatus[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<CustomerPortalStatus[]>("/api/customer-portal/customers", { token: accessToken });
      setCustomers(data);
    } catch { setError("Failed to load customers."); }
  }, [accessToken]);

  const fetchMessages = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<PortalMessage[]>("/api/customer-portal/messages", { token: accessToken });
      setMessages(data);
    } catch { /* silently fail */ }
  }, [accessToken]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCustomers(), fetchMessages()]).finally(() => setLoading(false));
  }, [fetchCustomers, fetchMessages]);

  async function togglePortal(customer: CustomerPortalStatus) {
    if (!accessToken) return;
    setToggling(customer.id);
    try {
      const action = customer.portal_enabled ? "disable" : "enable";
      await apiFetch(`/api/customer-portal/customers/${customer.id}/${action}`, {
        method: "POST",
        token: accessToken,
      });
      await fetchCustomers();
    } catch { setError("Failed to update portal access."); }
    finally { setToggling(null); }
  }

  async function resetToken(customerId: string) {
    if (!accessToken || !confirm("Reset portal link? The old link will stop working immediately.")) return;
    setToggling(customerId);
    try {
      await apiFetch(`/api/customer-portal/customers/${customerId}/reset-token`, { method: "POST", token: accessToken });
      await fetchCustomers();
    } catch { setError("Failed to reset token."); }
    finally { setToggling(null); }
  }

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function resolveMessage(id: string) {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/customer-portal/messages/${id}/resolve`, { method: "PUT", token: accessToken });
      await fetchMessages();
    } catch { setError("Failed to resolve message."); }
  }

  const openCount = messages.filter(m => m.status === "OPEN").length;

  return (
    <PageContainer>
      <div className="mb-6">
        <PageHeading>Customer Portal</PageHeading>
        <p className="text-sm text-gray-500 mt-1">
          Enable self-service portal access for your customers to view invoices, payment status, and send messages.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">
          {error}
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {(["customers", "messages"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-blue-500 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "messages" ? `Messages${openCount > 0 ? ` (${openCount})` : ""}` : "Customers"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : tab === "customers" ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {customers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No customers found. Add customers in AR → Customers first.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Portal status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Portal link</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email ?? <span className="text-gray-300 italic">no email</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => togglePortal(c)}
                        disabled={toggling === c.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          c.portal_enabled ? "bg-blue-600" : "bg-gray-200"
                        } disabled:opacity-50`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          c.portal_enabled ? "translate-x-4.5" : "translate-x-0.5"
                        }`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {c.portal_url ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 truncate max-w-48 font-mono">{c.portal_url}</span>
                          <button
                            type="button"
                            onClick={() => copyLink(c.portal_url!, c.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Copy link"
                          >
                            <i className={`ti ti-${copied === c.id ? "check" : "copy"}`} style={{ fontSize: 14 }} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.portal_enabled && (
                        <button
                          type="button"
                          onClick={() => resetToken(c.id)}
                          disabled={toggling === c.id}
                          className="text-xs text-gray-400 hover:text-orange-600 transition-colors"
                          title="Reset portal link"
                        >
                          <i className="ti ti-refresh" style={{ fontSize: 14 }} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Messages tab */
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No customer messages yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Subject</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {messages.map((m, i) => (
                  <tr key={m.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.customer_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{m.message_type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{m.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3">
                      {m.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() => resolveMessage(m.id)}
                          className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </PageContainer>
  );
}
