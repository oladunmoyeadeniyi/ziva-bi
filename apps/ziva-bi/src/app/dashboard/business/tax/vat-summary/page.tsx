"use client";

/** VAT Summary page — M19. */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface VatSummary {
  period_start: string;
  period_end: string;
  output_vat: number;
  input_vat: number;
  net_vat_payable: number;
}

export default function VatSummaryPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<VatSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const handleRun = async () => {
    if (!start || !end) return;
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<VatSummary>(
        `/api/tax/vat-summary?period_start=${start}&period_end=${end}`,
        { token: accessToken! }
      );
      setData(result);
    } catch {
      setError("Failed to load VAT summary.");
    } finally { setLoading(false); }
  };

  const fmt = (n: number) => n.toLocaleString("en-NG", { minimumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading title="VAT Summary" />

      <div className="bg-white border rounded-lg p-5 mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Period Start</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Period End</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          </div>
          <button onClick={handleRun} disabled={loading} className="px-4 py-2 text-sm text-white rounded-md"
            style={{ background: "var(--ziva-primary, #2563EB)" }}>
            {loading ? "Running…" : "Run Report"}
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border rounded-lg p-5">
            <p className="text-xs text-gray-500 mb-2">Output VAT (Collected from Customers)</p>
            <p className="text-2xl font-bold text-green-700">₦{fmt(data.output_vat)}</p>
          </div>
          <div className="bg-white border rounded-lg p-5">
            <p className="text-xs text-gray-500 mb-2">Input VAT (Paid to Vendors)</p>
            <p className="text-2xl font-bold text-red-600">₦{fmt(data.input_vat)}</p>
          </div>
          <div className="bg-white border rounded-lg p-5">
            <p className="text-xs text-gray-500 mb-2">Net VAT Payable to FIRS</p>
            <p className={`text-2xl font-bold ${data.net_vat_payable >= 0 ? "text-red-700" : "text-green-700"}`}>
              ₦{fmt(data.net_vat_payable)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{data.net_vat_payable >= 0 ? "Payable to FIRS" : "Refund claimable"}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
