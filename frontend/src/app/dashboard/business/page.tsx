"use client";

/**
 * Business dashboard overview — ZivaBI.
 * Header/nav is provided by business/layout.tsx.
 */

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const MODULES = [
  { icon: "🧾", title: "Expense Retirement", desc: "Submit and track expense reports", href: "/dashboard/business/expenses", active: true },
  { icon: "📥", title: "Accounts Payable", desc: "Coming soon", href: null, active: false },
  { icon: "📤", title: "Accounts Receivable", desc: "Coming soon", href: null, active: false },
  { icon: "✅", title: "Approvals", desc: "Review and action expense reports", href: "/dashboard/business/approvals", active: true },
  { icon: "💼", title: "Payroll", desc: "Coming soon", href: null, active: false },
];

export default function BusinessDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.first_name || user?.full_name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Business finance platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) =>
          m.active && m.href ? (
            <Link
              key={m.title}
              href={m.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="text-2xl mb-2">{m.icon}</div>
              <h3 className="text-sm font-semibold text-gray-800">{m.title}</h3>
              <p className="mt-1 text-xs text-blue-600">{m.desc}</p>
            </Link>
          ) : (
            <div
              key={m.title}
              className="bg-white rounded-xl border border-gray-200 p-5 opacity-50 cursor-not-allowed"
            >
              <div className="text-2xl mb-2">{m.icon}</div>
              <h3 className="text-sm font-semibold text-gray-800">{m.title}</h3>
              <p className="mt-1 text-xs text-gray-400">{m.desc}</p>
            </div>
          )
        )}
      </div>

      <div className="mt-10 rounded-xl bg-blue-50 border border-blue-100 px-6 py-5">
        <p className="text-sm text-blue-800 font-medium">Milestone 4 — Approval Workflow is now active.</p>
        <p className="mt-1 text-xs text-blue-600">
          Account: {user?.email} · Tenant: {user?.tenant_id ?? "—"}
        </p>
      </div>
    </div>
  );
}
