'use client'

import { UserIcon, XIcon } from 'lucide-react'
import { Combobox } from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import type { PdvCustomer } from '@/components/pdv/types'

interface CustomerSelectorProps {
  customers: PdvCustomer[]
  value: string | null
  onSelect: (customerId: string | null) => void
}

export function CustomerSelector({ customers, value, onSelect }: CustomerSelectorProps) {
  const items = customers.map((c) => ({
    value: c.id,
    label: c.document
      ? `${c.name} · ${c.document}`
      : c.categoryName
        ? `${c.name} · ${c.categoryName}`
        : c.name,
  }))

  const selected = items.find((item) => item.value === value) ?? null

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <UserIcon className="size-3.5" aria-hidden="true" />
        Cliente da venda
      </p>
      {selected ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selected.label}</p>
            {(() => {
              const customer = customers.find((c) => c.id === value)
              return customer?.categoryName ? (
                <p className="text-xs text-muted-foreground">{customer.categoryName}</p>
              ) : null
            })()}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onSelect(null)}
            aria-label="Remover cliente"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Combobox
          items={items}
          value={value}
          onValueChange={onSelect}
          placeholder={customers.length > 0 ? 'Selecionar cliente (opcional)…' : 'Nenhum cliente'}
          searchPlaceholder="Buscar cliente…"
          emptyText="Nenhum cliente encontrado"
          disabled={customers.length === 0}
        />
      )}
    </div>
  )
}