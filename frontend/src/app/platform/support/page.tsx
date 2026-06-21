"use client";

/**
 * Platform — Support placeholder.
 * Real content: future milestone (tenant support tickets + impersonation for troubleshooting).
 */

export default function PlatformSupportPage() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Support</h1>
      <p className="text-sm text-gray-500 mb-8">
        Tenant support tickets, troubleshooting access, and escalation management.
      </p>

      {/* Coming-soon card */}
      <section className="border border-gray-200 rounded-xl bg-white p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <i className="ti ti-lifebuoy text-amber-500" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Coming in a future milestone</p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Incoming support requests linked to specific tenants</li>
              <li>One-click tenant entry for troubleshooting (uses existing impersonation)</li>
              <li>Escalation tracking and SLA visibility</li>
              <li>Support notes and internal handoff log per tenant</li>
            </ul>
            <p className="text-xs text-gray-400 mt-3 italic">
              Tenant entry for support already works via the Tenants section. This page will surface it as a ticket-driven workflow.
            </p>
          </div>
        </div>
      </section>

      {/* Faded ticket list preview */}
      <section className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Preview — not yet functional
          </p>
        </div>
        <div className="opacity-30 pointer-events-none select-none">
          <table className="w-full text-xs">
            <thead className="bg-white border-b border-gray-100">
              <tr>
                {["Tenant", "Subject", "Priority", "Status", "Opened", "Assignee"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-gray-400 italic text-sm">
                  No data — section not yet built.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
