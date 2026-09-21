import * as React from "react"
import { cn } from "cn"
import { AlertCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function ErrorState({
  title = "Não foi possível carregar",
  description,
  retryLabel = "Tentar novamente",
  onRetry,
  className,
}: {
  title?: string
  description?: string
  retryLabel?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-6 py-10 text-center",
        className
      )}
    >
      <AlertCircleIcon
        className="size-9 text-destructive"
        aria-hidden="true"
      />
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <div className="mt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export { ErrorState }