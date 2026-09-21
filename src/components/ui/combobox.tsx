"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { cn } from "cn"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ComboboxOption = {
  value: string
  label: string
}

function Combobox({
  items,
  value,
  onValueChange,
  open,
  onOpenChange,
  placeholder = "Selecionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nenhum resultado encontrado",
  disabled = false,
  className,
}: {
  items: ComboboxOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const setOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  const selected = items.find((item) => item.value === value)

  return (
    <ComboboxPrimitive.Root
      items={items}
      value={selected ?? null}
      onValueChange={(item) => onValueChange(item ? item.value : null)}
      open={isOpen}
      onOpenChange={setOpen}
      filter={(item, query) =>
        item.label.toLowerCase().includes(query.trim().toLowerCase())
      }
    >
      <ComboboxPrimitive.Trigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDownIcon
          className="size-4 shrink-0 opacity-50"
          aria-hidden="true"
        />
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          sideOffset={4}
          className="z-50"
        >
          <ComboboxPrimitive.Popup className="w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
            <ComboboxPrimitive.Input
              render={
                <Input
                  className="h-9 rounded-none border-0 border-b shadow-none focus-visible:ring-0"
                  aria-label={searchPlaceholder}
                />
              }
              placeholder={searchPlaceholder}
            />
            <ComboboxPrimitive.List className="max-h-64 overflow-y-auto p-1">
              {items.map((item) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className="flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  <ComboboxPrimitive.ItemIndicator>
                    <CheckIcon className="size-4" aria-hidden="true" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              ))}
              <ComboboxPrimitive.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </ComboboxPrimitive.Empty>
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox, type ComboboxOption }