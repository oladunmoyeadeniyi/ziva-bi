"use client";

/**
 * Business dashboard — ZivaBI (Business tier).
 *
 * Milestone 2 placeholder. Full business modules (expense retirement,
 * AP/AR, payroll, approvals, etc.) are built in subsequent milestones.
 */

import { useAuth } from "@/contexts/AuthContext";

export default function BusinessDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900">ZivaBI</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.full_name}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.full_name?.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">Business finance platform</p>
        </div>

        {/* Module placeholders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: "🧾", title: "Expense Retirement", desc: "Coming in Milestone 5" },
            { icon: "📥", title: "Accounts Payable", desc: "Coming soon" },
            { icon: "📤", title: "Accounts Receivable", desc: "Coming soon" },
            { icon: "✅", title: "Approvals", desc: "Coming soon" },
            { icon: "💼", title: "Payroll", desc: "Coming soon" },
            { icon: "⚙️", title: "Tenant Admin", desc: "Coming soon" },
          ].map((m) => (
            <div
              key={m.title}
              className="bg-white rounded-xl border border-gray-200 p-5 opacity-60"
            >
              <div className="text-2xl mb-2">{m.icon}</div>
              <h3 className="text-sm font-semibold text-gray-800">{m.title}</h3>
              <p className="mt-1 text-xs text-gray-400">{m.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl bg-blue-50 border border-blue-100 px-6 py-5">
          <p className="text-sm text-blue-800 font-medium">
            Milestone 2 complete — authentication is working.
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Account: {user?.email} · Type: Business · Tenant: {user?.tenant_id ?? "—"}
          </p>
        </div>
      </main>
    </div>
  );
}
