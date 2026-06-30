"use client";

/**
 * Platform — Team & delegation placeholder.
 * Real content: M9.1b (Ziva internal staff accounts + tenant delegation).
 */

import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

export default function PlatformTeamPage() {
  return (
    <PageContainer maxWidth="4xl">
      <PageHeading title="Team & delegation" />
      <p className="text-sm text-gray-500 mb-8">
        Manage Ziva BI internal staff accounts and assign delegation rights over tenants.
      </p>

      {/* Coming-soon card */}
      <section className="border border-gray-200 rounded-xl bg-white p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <i className="ti ti-users-group text-purple-500" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Coming in milestone M9.1b</p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Invite and manage Ziva BI internal staff (account managers, support agents)</li>
              <li>Assign staff as delegates over specific tenants</li>
              <li>Scope what each delegate can view and action</li>
              <li>Audit trail of delegated actions</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Faded layout preview — clearly disabled, no fake rows */}
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
                {["Name", "Email", "Role", "Tenants assigned", "Last active"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-gray-400 italic text-sm">
                  No data — section not yet built.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </PageContainer>
  );
}
