"use client";

/**
 * Shared Banner/Alert component — Build G of UI Polish Phase 2.
 *
 * Four variants matching the dominant class combination already in use across
 * dashboard pages. Accepts an optional onDismiss callback which renders a
 * close button; extra layout or spacing classes go in className.
 */

import { cn } from "@/lib/utils";

type BannerVariant = "success" | "error" | "warning" | "info";

const variantMap: Record<BannerVariant, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  error:   "bg-red-50 border-red-200 text-red-700",
  warning: "bg-orange-50 border-orange-200 text-orange-800",
  info:    "bg-blue-50 border-blue-200 text-blue-700",
};

interface BannerProps {
  variant: BannerVariant;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Banner({ variant, children, onDismiss, className }: BannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variantMap[variant],
        className
      )}
    >
      {onDismiss ? (
        <div className="flex items-start justify-between gap-3">
          <span>{children}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
