"use client";

/**
 * EmptyState — shared zero-state component for list pages.
 *
 * Usage:
 *   <EmptyState
 *     icon="receipt"
 *     title="No expense reports yet"
 *     description="Submit your first expense report to get started."
 *     action={{ label: "New report", href: "/dashboard/business/expenses/new" }}
 *   />
 *
 *   or with onClick:
 *   <EmptyState icon="users" title="No vendors" action={{ label: "Add vendor", onClick: () => setShowForm(true) }} />
 */

import Link from "next/link";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  /** Tabler icon name (e.g. "receipt", "users", "package") */
  icon?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** Override default vertical padding */
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-10" : "py-16"}`}>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <i className={`ti ti-${icon} text-gray-400`} style={{ fontSize: 22 }} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-gray-400 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <i className="ti ti-plus" style={{ fontSize: 14 }} />
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <i className="ti ti-plus" style={{ fontSize: 14 }} />
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
