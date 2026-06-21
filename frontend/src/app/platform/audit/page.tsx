"use client";

/**
 * Platform — Audit log placeholder.
 *
 * No GET /api/platform/audit endpoint exists yet. The AuditLog table is being
 * written to by platform actions (tenant entry, suspend, reactivate, lifecycle
 * transitions) but no read endpoint has been built. Audit viewer is future.
 */

export default function PlatformAuditPage() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Audit log</h1>
      <p className="text-sm text-gray-500 mb-8">
        Immutable record of all platform actions — tenant entries, lifecycle changes, suspensions.
      </p>

      {/* Coming-soon card */}
      <section className="border border-gray-200 rounded-xl bg-white p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <i className="ti ti-history text-gray-500" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Audit viewer coming soon</p>
            <p className="text-sm text-gray-500 mb-3">
              The audit log is already being recorded — every tenant entry, suspension, reactivation,
              and lifecycle transition is written to the <code className="text-xs bg-gray-100 px-1 rounded">audit_logs</code> table.
              A read endpoint and viewer will be built in a future milestone.
            </p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>When: timestamp of each action</li>
              <li>Who: the super admin who acted (impersonator ID preserved)</li>
              <li>What: event type (e.g. platform.tenant.entered, platform.tenant.suspended)</li>
              <li>Target: the tenant affected</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Faded log preview */}
      <section className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Preview — read endpoint not yet built
          </p>
        </div>
        <div className="opacity-30 pointer-events-none select-none">
          <table className="w-full text-xs">
            <thead className="bg-white border-b border-gray-100">
              <tr>
                {["When", "Actor", "Event", "Tenant", "Detail"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-gray-400 italic text-sm">
                  No data — read endpoint not yet built.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
