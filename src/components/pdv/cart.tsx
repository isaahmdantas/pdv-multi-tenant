'use client'

import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format'
import type { CartItem } from '@/components/pdv/types'

interface CartProps {
  items: CartItem[]
  onQuantityChange: (productId: string, quantity: number) => void
  onDiscountChange: (productId: string, discount: number) => void
  onRemove: (productId: string) => void
}

export function Cart({ items, onQuantityChange, onDiscountChange, onRemove }: CartProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card p-6 text-center">
        <p className="text-sm font-medium">Carrinho vazio</p>
        <p className="text-xs text-muted-foreground">
          Busque ou escaneie um produto para começar a venda.
        </p>
      </div>
    )
  }

  const subtotal = items.reduce((acc, item) => acc + item.total, 0)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-lg border bg-card">
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {items.map((item) => (
          <li key={item.productId} className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {item.sku ?? '—'}
                  {item.promotionId ? ' · promoção' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.productId)}
                aria-label={`Remover ${item.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={() => onQuantityChange(item.productId, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  aria-label="Diminuir quantidade"
                >
                  <MinusIcon className="size-3" aria-hidden="true" />
                </Button>
                <span className="w-12 text-center text-sm font-semibold tabular-nums">
                  {item.quantity}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={() => onQuantityChange(item.productId, item.quantity + 1)}
                  aria-label="Aumentar quantidade"
                >
                  <PlusIcon className="size-3" aria-hidden="true" />
                </Button>
              </div>

              <div className="text-right">
                {item.unitPrice > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(item.unitPrice)} un
                  </p>
                ) : null}
                <p className="text-sm font-semibold tabular-nums">{formatBRL(item.total)}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <label htmlFor={`discount-${item.productId}`} className="text-xs text-muted-foreground">
                Desconto
              </label>
              <Input
                id={`discount-${item.productId}`}
                type="number"
                min={0}
                step="0.01"
                value={item.itemDiscount > 0 ? item.itemDiscount : ''}
                placeholder="R$ 0,00"
                onChange={(e) =>
                  onDiscountChange(item.productId, Math.max(0, Number(e.target.value) || 0))
                }
                className="h-7 w-24 text-right tabular-nums"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
        <span className="text-lg font-semibold tabular-nums">{formatBRL(subtotal)}</span>
      </div>
    </div>
  )
}