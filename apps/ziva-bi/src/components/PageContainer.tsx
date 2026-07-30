import { cn } from "@/lib/utils"

const maxWidthMap = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const

type MaxWidth = keyof typeof maxWidthMap

interface PageContainerProps {
  maxWidth?: MaxWidth
  className?: string
  children: React.ReactNode
}

export default function PageContainer({
  maxWidth = "5xl",
  className,
  children,
}: PageContainerProps) {
  return (
    <div className={cn("px-4 sm:px-6 py-8 mx-auto", maxWidthMap[maxWidth], className)}>
      {children}
    </div>
  )
}
