"use client";

/**
 * Vendor Portal admin page — /dashboard/business/vendor-portal
 *
 * Finance team can enable/disable portal access per vendor,
 * view portal links, review vendor-submitted invoices.
 *
 * Tabs:
 *   Vendors    — list + enable/disable portal + copy link
 *   Submissions — vendor invoice submissions awaiting review
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface VendorPortalStatus {
  id: string;
  code: string;
  name: string;
  email: string | null;
  portal_enabled: boolean;
  portal_token: string | null;
  portal_url: string | null;
}

interface Submission {
  id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  currency_code: string;
  status: string;
  submitted_at: string;
}

type Tab = "vendors" | "submissions";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    REVIEWED: "bg-blue-50 text-blue-700 border-blue-200",
    CONVERTED: "bg-green-50 text-green-700 border-green-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

export default function VendorPortalPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("vendors");
  const [vendors, setVendors] = useState<VendorPortalStatus[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<VendorPortalStatus[]>("/api/vendor-portal/vendors", { token: accessToken });
      setVendors(data);
    } catch { setError("Failed to load vendors."); }
  }, [accessToken]);

  const fetchSubmissions = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<Submission[]>("/api/vendor-portal/submissions", { token: accessToken });
      setSubmissions(data);
    } catch { /* silently fail */ }
  }, [accessToken]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchVendors(), fetchSubmissions()]).finally(() => setLoading(false));
  }, [fetchVendors, fetchSubmissions]);

  async function togglePortal(vendor: VendorPortalStatus) {
    if (!accessToken) return;
    setToggling(vendor.id);
    try {
      const action = vendor.portal_enabled ? "disable" : "enable";
      await apiFetch(`/api/vendor-portal/vendors/${vendor.id}/${action}`, {
        method: "POST",
        token: accessToken,
      });
      await fetchVendors();
    } catch { setError("Failed to update portal access."); }
    finally { setToggling(null); }
  }

  async function resetToken(vendorId: string) {
    if (!accessToken || !confirm("Reset portal link? The old link will stop working immediately.")) return;
    setToggling(vendorId);
    try {
      await apiFetch(`/api/vendor-portal/vendors/${vendorId}/reset-token`, { method: "POST", token: accessToken });
      await fetchVendors();
    } catch { setError("Failed to reset token."); }
    finally { setToggling(null); }
  }

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function reviewSubmission(id: string, action: "CONVERTED" | "REJECTED", reason?: string) {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/vendor-portal/submissions/${id}/review`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ action, rejection_reason: reason }),
      });
      await fetchSubmissions();
    } catch { setError("Failed to review submission."); }
  }

  const pendingCount = submissions.filter(s => s.status === "PENDING").length;

  return (
    <PageContainer>
      <div className="mb-6">
        <PageHeading>Vendor Portal</PageHeading>
        <p className="text-sm text-gray-500 mt-1">
          Enable self-service portal access for your vendors to view invoices, payment status, and submit new invoices.
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
        {(["vendors", "submissions"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-blue-500 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "submissions" ? `Submissions${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "Vendors"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : tab === "vendors" ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {vendors.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No vendors found. Add vendors in AP → Vendors first.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Portal status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Portal link</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => (
                  <tr key={v.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{v.name}</p>
                      <p className="text-xs text-gray-400">{v.code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.email ?? <span className="text-gray-300 italic">no email</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => togglePortal(v)}
                        disabled={toggling === v.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          v.portal_enabled ? "bg-blue-600" : "bg-gray-200"
                        } disabled:opacity-50`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          v.portal_enabled ? "translate-x-4.5" : "translate-x-0.5"
                        }`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {v.portal_url ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 truncate max-w-48 font-mono">{v.portal_url}</span>
                          <button
                            type="button"
                            onClick={() => copyLink(v.portal_url!, v.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Copy link"
                          >
                            <i className={`ti ti-${copied === v.id ? "check" : "copy"}`} style={{ fontSize: 14 }} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.portal_enabled && (
                        <button
                          type="button"
                          onClick={() => resetToken(v.id)}
                          disabled={toggling === v.id}
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
        /* Submissions tab */
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {submissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No vendor submissions yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600">{s.invoice_date}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.currency_code} {fmt(s.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      {s.status === "PENDING" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => reviewSubmission(s.id, "CONVERTED")}
                            className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const reason = prompt("Rejection reason (optional):");
                              reviewSubmission(s.id, "REJECTED", reason ?? undefined);
                            }}
                            className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
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
