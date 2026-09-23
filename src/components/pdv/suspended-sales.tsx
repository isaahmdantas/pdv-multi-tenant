"use client"

import * as React from "react"
import { PauseIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatBRL, formatDateTime } from "@/lib/format"
import type { SuspendedSale } from "@/components/pdv/types"

export function SuspendedSales({
  sales,
  busyId,
  onRecover,
  onDiscard,
}: {
  sales: SuspendedSale[]
  busyId: string | null
  onRecover: (id: string) => void
  onDiscard: (id: string) => void
}) {
  const [discardId, setDiscardId] = React.useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)

  if (sales.length === 0) return null

  const toDiscard = sales.find((s) => s.id === discardId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <PauseIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Vendas suspensas ({sales.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {sales.map((sale) => {
          const itemCount = sale.items.reduce((acc, it) => acc + Number(it.quantity), 0)
          return (
            <div
              key={sale.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium tabular-nums">#{sale.id.slice(-6)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(sale.createdAt)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {itemCount} item{itemCount === 1 ? "" : "s"} ·{" "}
                  <span className="tabular-nums">{formatBRL(sale.total)}</span>
                  {sale.customerName ? ` · ${sale.customerName}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRecover(sale.id)}
                  disabled={busyId !== null}
                >
                  Retomar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDiscardId(sale.id)
                    setConfirmDiscard(true)
                  }}
                  disabled={busyId !== null}
                >
                  Descartar
                </Button>
              </div>
            </div>
          )
        })}

        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={(open) => {
            if (!open) setDiscardId(null)
            setConfirmDiscard(open)
          }}
          title="Descartar venda suspensa?"
          description={
            toDiscard
              ? `A venda #${toDiscard.id.slice(-6)} será descartada. Os itens voltam para a busca de produtos.`
              : "A venda suspensa será descartada."
          }
          confirmLabel={busyId ? "Descartando…" : "Descartar"}
          loading={busyId !== null}
          onConfirm={() => {
            if (discardId) onDiscard(discardId)
          }}
        />
      </CardContent>
    </Card>
  )
}