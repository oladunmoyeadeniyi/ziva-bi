"use client";

/**
 * LockedField — M8.2 Implementation Portal component.
 *
 * Renders a locked field indicator for non-consultant users when a field
 * has been locked by the Ziva BI implementation team.
 *
 * Consultant users (role_tier === 'consultant') see the normal editable field
 * passed as children — no lock UI is shown to them.
 *
 * Usage:
 *   <LockedField isConsultant={user.role_tier === 'consultant'} locked={field.locked_by_implementation}>
 *     <input ... />
 *   </LockedField>
 */

import { useAppConfig } from "@/contexts/AppConfigContext";

interface LockedFieldProps {
  /** If true, the field is editable regardless of locked state (consultant view) */
  isConsultant: boolean;
  /** Whether this specific field is locked by implementation */
  locked: boolean;
  /** The editable field to render when not locked (or when consultant) */
  children: React.ReactNode;
  /** Optional label shown above the locked placeholder */
  label?: string;
}

export default function LockedField({
  isConsultant,
  locked,
  children,
  label,
}: LockedFieldProps) {
  const { appName } = useAppConfig();
  // Consultants always see the editable field
  if (isConsultant || !locked) {
    return (
      <div className="relative">
        {children}
        {isConsultant && locked && (
          <span className="absolute top-0 right-0 translate-y-[-50%] bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-300">
            Override
          </span>
        )}
      </div>
    );
  }

  // Non-consultant users see the locked placeholder
  return (
    <div className="w-full">
      {label && (
        <p className="block text-sm font-medium text-gray-700 mb-1">{label}</p>
      )}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
        <svg
          className="w-4 h-4 text-gray-400 mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>
          Locked by implementation. Contact your {appName} consultant to modify.
        </span>
      </div>
    </div>
  );
}
