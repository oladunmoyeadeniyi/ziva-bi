"use client";

/** WHT Certificates page — M19. */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface WhtCertificate {
  id: string;
  certificate_number: string;
  certificate_type: string;
  gross_amount: number;
  wht_rate: number;
  wht_amount: number;
  transaction_date: string;
  issue_date: string | null;
}

export default function WhtCertificatesPage() {
  const { accessToken } = useAuth();
  const [certs, setCerts] = useState<WhtCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<WhtCertificate[]>("/api/tax/wht-certificates", { token: accessToken })
      .then(setCerts).catch(() => setError("Failed to load WHT certificates.")).finally(() => setLoading(false));
  }, [accessToken]);

  const fmt = (n: number) => n.toLocaleString("en-NG", { minimumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading title="WHT Certificates" />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Certificate No.</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Gross Amount</th>
              <th className="px-4 py-3 text-right">WHT Rate</th>
              <th className="px-4 py-3 text-right">WHT Amount</th>
              <th className="px-4 py-3 text-left">Transaction Date</th>
              <th className="px-4 py-3 text-left">Issue Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : certs.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No WHT certificates.</td></tr>
              : certs.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{c.certificate_number}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.certificate_type === "VENDOR" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>{c.certificate_type}</span></td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(c.gross_amount)}</td>
                  <td className="px-4 py-3 text-right">{(c.wht_rate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">₦{fmt(c.wht_amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{c.transaction_date}</td>
                  <td className="px-4 py-3 text-gray-500">{c.issue_date ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
