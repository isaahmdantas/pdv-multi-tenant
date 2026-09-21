import * as React from "react"
import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"

function LoadingState({
  rows = 3,
  label,
  className,
}: {
  rows?: number
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-label={label ?? "Carregando"}
    >
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : null}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
      <span className="sr-only">{label ?? "Carregando…"}</span>
    </div>
  )
}

export { LoadingState }