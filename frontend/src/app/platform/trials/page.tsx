"use client";

/**
 * Platform — Trials & signups placeholder.
 * Real content: M9.4 (self-serve trial provisioning + conversion tracking).
 */

export default function PlatformTrialsPage() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Trials &amp; signups</h1>
      <p className="text-sm text-gray-500 mb-8">
        Track and manage inbound trial accounts and conversion to paid subscriptions.
      </p>

      {/* Coming-soon card */}
      <section className="border border-gray-200 rounded-xl bg-white p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <i className="ti ti-rocket text-blue-500" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Coming in milestone M9.4</p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Self-serve signup flow with automatic trial tenant provisioning</li>
              <li>Trial duration, expiry, and extension controls</li>
              <li>Conversion pipeline — trial → in implementation → live</li>
              <li>Cohort view: new signups per week, days remaining on trial</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Faded layout preview */}
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
                {["Company", "Country", "Signed up", "Trial expires", "Status", "Owner"].map((h) => (
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
