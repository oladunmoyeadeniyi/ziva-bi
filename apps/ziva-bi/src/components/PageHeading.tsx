import React from "react"

interface PageHeadingProps {
  title: string
  subtitle?: string
  /** Optional action buttons rendered flush-right (e.g. a "New X" button). */
  actions?: React.ReactNode
}

export default function PageHeading({ title, subtitle, actions }: PageHeadingProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 mt-0.5">{actions}</div>}
    </div>
  )
}
