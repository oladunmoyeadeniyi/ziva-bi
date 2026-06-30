"use client";

/**
 * Platform — Settings placeholder.
 * Platform-wide configuration (feature flags, limits, defaults) — future milestone.
 */

import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

export default function PlatformSettingsPage() {
  return (
    <PageContainer maxWidth="4xl">
      <PageHeading title="Platform settings" />
      <p className="text-sm text-gray-500 mb-8">
        Platform-wide configuration — feature flags, global defaults, and system limits.
      </p>

      <section className="border border-gray-200 rounded-xl bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <i className="ti ti-settings text-gray-500" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Coming in a future milestone</p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Default trial duration for new signups</li>
              <li>Feature flags per lifecycle status</li>
              <li>Global module availability switches</li>
              <li>Platform maintenance mode toggle</li>
            </ul>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
