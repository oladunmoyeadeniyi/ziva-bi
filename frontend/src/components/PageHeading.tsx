interface PageHeadingProps {
  title: string
  subtitle?: string
}

export default function PageHeading({ title, subtitle }: PageHeadingProps) {
  return (
    <div className="mb-1">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}
