"use client";

/**
 * Unified Approvals Inbox — PWA Phase 4.
 * Aggregates pending expense reports, AP invoices, and purchase orders
 * waiting for the current user's approval action.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

type ItemType = "EXPENSE" | "AP_INVOICE" | "PURCHASE_ORDER";

interface InboxItem {
  id: string;
  type: ItemType;
  reference: string;
  description: string;
  amount: number;
  currency: string;
  submitted_by: string;
  submitted_at: string;
  tenant_id: string;
  days_pending: number;
}

interface InboxResponse {
  items: InboxItem[];
  total: number;
  expense_count: number;
  ap_count: number;
  po_count: number;
}

const TYPE_LABELS: Record<ItemType, string> = {
  EXPENSE: "Expense Report",
  AP_INVOICE: "AP Invoice",
  PURCHASE_ORDER: "Purchase Order",
};

const TYPE_COLORS: Record<ItemType, string> = {
  EXPENSE: "bg-blue-50 text-blue-700",
  AP_INVOICE: "bg-orange-50 text-orange-700",
  PURCHASE_ORDER: "bg-purple-50 text-purple-700",
};

const ITEM_HREF: Record<ItemType, (id: string) => string> = {
  EXPENSE: (id) => `/dashboard/business/expenses/${id}`,
  AP_INVOICE: (id) => `/dashboard/business/ap/invoices/${id}`,
  PURCHASE_ORDER: (id) => `/dashboard/business/po/${id}`,
};

type Filter = "all" | ItemType;

export default function ApprovalsInboxPage() {
  const { accessToken } = useAuth();
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<InboxResponse>("/api/approvals/inbox", { token: accessToken })
      .then(setInbox)
      .catch(() => setError("Failed to load approvals inbox."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);

  const filteredItems = inbox?.items.filter(
    (item) => filter === "all" || item.type === filter
  ) ?? [];

  return (
    <PageContainer>
      <PageHeading
        title="Approvals Inbox"
        subtitle="All items waiting for your approval across all modules"
        actions={
          inbox && (
            <div className="flex gap-2 text-sm text-gray-500">
              <span>{inbox.expense_count} expense{inbox.expense_count !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{inbox.ap_count} AP</span>
              <span>·</span>
              <span>{inbox.po_count} PO</span>
              <span>·</span>
              <span className="font-semibold text-gray-700">{inbox.total} total</span>
            </div>
          )
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {(["all", "EXPENSE", "AP_INVOICE", "PURCHASE_ORDER"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium transition ${filter === f ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            {f === "all" ? "All" : TYPE_LABELS[f as ItemType]}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 py-12 text-center">Loading inbox…</p>}
      {error && <p className="text-red-600 py-4">{error}</p>}

      {!loading && filteredItems.length === 0 && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-lg font-medium text-gray-700">All clear!</p>
          <p className="text-sm text-gray-500">No pending approvals{filter !== "all" ? ` for ${TYPE_LABELS[filter as ItemType]}` : ""}.</p>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              href={ITEM_HREF[item.type](item.id)}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm hover:border-indigo-200 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type]}`}>
                      {TYPE_LABELS[item.type]}
                    </span>
                    <span className="font-semibold text-gray-900 text-sm">{item.reference}</span>
                    {item.days_pending > 3 && (
                      <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                        {item.days_pending}d overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{item.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Submitted {new Date(item.submitted_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 text-sm">
                    {fmt(item.amount, item.currency)}
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">Review →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
