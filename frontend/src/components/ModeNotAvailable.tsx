"use client";

/**
 * ModeNotAvailable — shown when a user navigates directly to an implementation
 * page that is hidden for their current posting_mode (e.g. Chart of Accounts in Lite).
 *
 * Renders a neutral informational block — not an error state. Provides a clear
 * explanation and a single action: return to the setup dashboard.
 *
 * Connected to: Three-Mode Architecture (MASTER_CONTEXT §4.2). Rendered by any
 * setup/settings page that is gated behind Connected or Full ERP mode.
 */

import { useRouter } from "next/navigation";

const MODE_LABELS: Record<string, string> = {
  lite: "Lite",
  connected: "Connected",
  full_erp: "Full ERP",
};

interface ModeNotAvailableProps {
  /** Display name of the page/feature, e.g. "Chart of Accounts" */
  pageName: string;
  /** Which modes this feature is available in, e.g. ["Connected", "Full ERP"] */
  availableIn: string[];
  /** The tenant's current posting_mode value, e.g. "lite" */
  currentMode: string;
}

/**
 * Full-page mode gate — replaces normal page content when the tenant's
 * posting_mode doesn't support the requested feature.
 *
 * @param pageName      - Human-readable name of the locked page
 * @param availableIn   - Array of mode labels where this feature is available
 * @param currentMode   - The raw posting_mode value ('lite' | 'connected' | 'full_erp')
 */
export default function ModeNotAvailable({
  pageName,
  availableIn,
  currentMode,
}: ModeNotAvailableProps) {
  const router = useRouter();
  const modeLabel = MODE_LABELS[currentMode] ?? currentMode;
  const availableList = availableIn.join(" or ");

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-8 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <i className="ti ti-lock text-gray-400" style={{ fontSize: 22 }} />
      </div>

      <h2 className="text-[15px] font-semibold text-gray-800 mb-2">
        {pageName} is not available in {modeLabel} mode
      </h2>

      <p className="text-[13px] text-gray-500 max-w-md leading-relaxed mb-6">
        This section is available in {availableList} mode. Your posting mode is
        configured by your Ziva BI consultant in the system configuration.
      </p>

      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="px-4 py-2 rounded-md bg-gray-800 text-white text-[13px] font-medium hover:bg-gray-700 transition-colors"
      >
        Back to setup dashboard
      </button>
    </div>
  );
}
