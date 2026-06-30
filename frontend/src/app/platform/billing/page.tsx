"use client";

/**
 * Platform — Billing placeholder.
 * Real content: post-v1 (subscription plans, MRR tracking, invoicing).
 */

import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

export default function PlatformBillingPage() {
  return (
    <PageContainer maxWidth="4xl">
      <PageHeading title="Billing" />
      <p className="text-sm text-gray-500 mb-8">
        Subscription plans, MRR tracking, and invoicing per tenant.
      </p>

      {/* Coming-soon card */}
      <section className="border border-gray-200 rounded-xl bg-white p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
            <i className="ti ti-credit-card text-green-500" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Coming post-v1</p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Subscription plan assignment per tenant (module-based or flat)</li>
              <li>MRR / ARR dashboard aggregated across all tenants</li>
              <li>Invoice generation and payment status</li>
              <li>Dunning and overdue account management</li>
            </ul>
            <p className="text-xs text-gray-400 mt-3 italic">
              Note: no billing data is stored yet — this section depends on a payment provider integration.
            </p>
          </div>
        </div>
      </section>

      {/* Faded metrics preview */}
      <section className="border border-gray-100 rounded-xl p-5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Preview — not yet functional
        </p>
        <div className="opacity-30 pointer-events-none select-none grid grid-cols-3 gap-4">
          {[
            { label: "MRR",        value: "—" },
            { label: "ARR",        value: "—" },
            { label: "Paying tenants", value: "—" },
          ].map((m) => (
            <div key={m.label} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <p className="text-2xl font-bold text-gray-700">{m.value}</p>
              <p className="text-xs text-gray-500 mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
