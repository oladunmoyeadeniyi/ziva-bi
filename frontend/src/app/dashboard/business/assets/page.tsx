"use client";

/**
 * Fixed Asset Register page — M18.
 * Lists all assets with current book values and depreciation status.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  category_name: string | null;
  acquisition_date: string;
  acquisition_cost: number;
  accumulated_depreciation: number;
  current_book_value: number;
  depreciation_method: string;
  status: string;
  currency: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  FULLY_DEPRECIATED: "bg-gray-100 text-gray-600",
  DISPOSED: "bg-red-50 text-red-600",
  IMPAIRED: "bg-yellow-50 text-yellow-700",
};

export default function AssetsPage() {
  const { accessToken } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<Asset[]>("/api/assets", { token: accessToken })
      .then(setAssets)
      .catch(() => setError("Failed to load assets."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const totalCost = assets.reduce((s, a) => s + a.acquisition_cost, 0);
  const totalNetBook = assets.reduce((s, a) => s + a.current_book_value, 0);
  const fmt = (n: number) => n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading
        title="Fixed Asset Register"
        actions={
          <Link href="/dashboard/business/assets/categories"
            className="text-sm px-3 py-1.5 border rounded-md text-gray-600">
            Categories
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Assets</p>
          <p className="text-2xl font-bold">{assets.length}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Cost</p>
          <p className="text-2xl font-bold">₦{fmt(totalCost)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Net Book Value</p>
          <p className="text-2xl font-bold text-blue-700">₦{fmt(totalNetBook)}</p>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Asset</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Acc. Dep.</th>
              <th className="px-4 py-3 text-right">Net Book Value</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No assets registered.</td></tr>
            ) : assets.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{a.asset_code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  <Link href={`/dashboard/business/assets/${a.id}`} className="hover:underline">{a.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{a.category_name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{a.acquisition_date}</td>
                <td className="px-4 py-3 text-right font-mono">₦{fmt(a.acquisition_cost)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-600">₦{fmt(a.accumulated_depreciation)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">₦{fmt(a.current_book_value)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{a.depreciation_method}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {a.status.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
