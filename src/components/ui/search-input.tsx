"use client"

import * as React from "react"
import { cn } from "cn"
import { SearchIcon, XIcon } from "lucide-react"

import { Input } from "@/components/ui/input"

function SearchInput({
  value,
  defaultValue,
  onValueChange,
  onClear,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onClear?: () => void
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const currentValue = value !== undefined ? value : internalValue

  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={props["aria-label"] ?? "Buscar"}
        className="h-9 pr-9 pl-9"
        value={currentValue}
        onChange={(event) => {
          setInternalValue(event.target.value)
          onValueChange?.(event.target.value)
        }}
        {...props}
      />
      {currentValue ? (
        <button
          type="button"
          aria-label="Limpar busca"
          className="absolute top-1/2 right-2 size-6 -translate-y-1/2 rounded-full grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            setInternalValue("")
            onValueChange?.("")
            onClear?.()
          }}
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export { SearchInput }