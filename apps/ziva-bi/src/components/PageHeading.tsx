import React from "react"
import Link from "next/link"

interface PageHeadingProps {
  title: string
  subtitle?: string
  /** Optional action buttons rendered flush-right (e.g. a "New X" button). */
  actions?: React.ReactNode
  /** Optional back-navigation link rendered above the title as a breadcrumb arrow. */
  backHref?: string
  /** Label for the back link (defaults to "Back"). */
  backLabel?: string
}

export default function PageHeading({ title, subtitle, actions, backHref, backLabel = "Back" }: PageHeadingProps) {
  return (
    <div className="mb-4">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0 mt-0.5">{actions}</div>}
      </div>
    </div>
  )
}
