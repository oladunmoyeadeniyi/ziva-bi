"use client";

/**
 * Employee Advances list — /dashboard/business/advances
 *
 * Employees see their own advances only.
 * Finance / admin roles see all advances with employee filter.
 *
 * Tabs: All | Draft | Submitted | Approved | Issued | Partially Retired | Fully Retired | Rejected
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface Advance {
  id: string;
  advance_number: string;
  advance_type: string;
  purpose: string;
  amount: string;
  currency: string;
  status: string;
  request_date: string;
  issued_at: string | null;
  due_retirement_date: string | null;
  total_retired: string;
}

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "APPROVED", label: "Approved" },
  { key: "ISSUED", label: "Issued" },
  { key: "PARTIALLY_RETIRED", label: "Part. Retired" },
  { key: "FULLY_RETIRED", label: "Fully Retired" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT:              "bg-gray-100 text-gray-600",
  SUBMITTED:          "bg-blue-50 text-blue-700",
  APPROVED:           "bg-emerald-50 text-emerald-700",
  ISSUED:             "bg-indigo-50 text-indigo-700",
  PARTIALLY_RETIRED:  "bg-yellow-50 text-yellow-700",
  FULLY_RETIRED:      "bg-green-100 text-green-800",
  REJECTED:           "bg-red-50 text-red-700",
  CANCELLED:          "bg-gray-50 text-gray-500",
};

export default function AdvancesPage() {
  const { accessToken } = useAuth();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    const qs = activeTab ? `?status=${activeTab}` : "";
    apiFetch<Advance[]>(`/api/advances${qs}`, { token: accessToken })
      .then(setAdvances)
      .catch(() => setAdvances([]))
      .finally(() => setLoading(false));
  }, [accessToken, activeTab]);

  return (
    <PageContainer>
      <PageHeading
        title="Advances"
        subtitle="Request and manage employee cash advances"
        actions={
          <Link href="/dashboard/business/advances/new">
            <Button size="sm">+ New advance</Button>
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-blue-600 text-blue-700 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : advances.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="ti ti-cash-banknote text-4xl block mb-2" />
          <p className="text-sm">No advances found.</p>
          <Link href="/dashboard/business/advances/new">
            <Button size="sm" className="mt-3">Request an advance</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {advances.map((adv) => {
            const outstanding = parseFloat(adv.amount) - parseFloat(adv.total_retired || "0");
            return (
              <Link
                key={adv.id}
                href={`/dashboard/business/advances/${adv.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{adv.advance_number}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[adv.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {adv.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {adv.advance_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{adv.purpose}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Requested: {adv.request_date}
                    {adv.due_retirement_date && ` · Due: ${adv.due_retirement_date}`}
                  </p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatMoney(parseFloat(adv.amount), adv.currency)}
                  </p>
                  {["ISSUED", "PARTIALLY_RETIRED"].includes(adv.status) && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Outstanding: {formatMoney(outstanding, adv.currency)}
                    </p>
                  )}
                </div>
                <i className="ti ti-chevron-right text-gray-300 ml-3" />
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
