"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatBRL } from "@/lib/format"
import { PAYMENT_METHODS } from "@/components/pdv/types"
import type { PaymentMethodCode } from "@/components/pdv/types"

interface RefundableItem {
  id: string
  productName: string
  quantity: number
  refundedQuantity: number
}

export function RefundSaleButton({
  saleId,
  total,
  refundedTotal,
  items,
}: {
  saleId: string
  total: number
  refundedTotal: number
  items: RefundableItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"TOTAL" | "PARCIAL">("TOTAL")
  const [methodCode, setMethodCode] = React.useState<PaymentMethodCode>("CASH")
  const [qtys, setQtys] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const remainingTotal = Math.max(0, round2Local(total - refundedTotal))

  const reset = () => {
    setMode("TOTAL")
    setMethodCode("CASH")
    setQtys({})
    setError(null)
    setSubmitting(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    setOpen(next)
  }

  const parseNum = (v: string) => {
    const n = Number(v.replace(",", "."))
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  const partialItems = items
    .map((it) => {
      const max = Math.max(0, round2Local(it.quantity - it.refundedQuantity))
      const entered = parseNum(qtys[it.id] ?? "")
      const qty = Math.min(entered, max)
      return { ...it, max, qty }
    })
    .filter((it) => it.max > 0)

  const partialTotal = partialItems.reduce((s, it) => s + it.qty, 0)

  const canSubmit =
    remainingTotal > 0 &&
    !submitting &&
    (mode === "TOTAL" || partialTotal > 0)

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { methodCode }
      if (mode === "PARCIAL") {
        body.items = partialItems
          .filter((it) => it.qty > 0)
          .map((it) => ({ saleItemId: it.id, quantity: String(it.qty) }))
      }
      const res = await fetch(`/api/v1/sales/${saleId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(
          data?.error?.message ?? "Não foi possível estornar a venda.",
        )
        setSubmitting(false)
        return
      }
      handleOpenChange(false)
      router.refresh()
    } catch {
      setError("Erro de conexão. Tente novamente.")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={remainingTotal <= 0}
      >
        Estornar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Estornar venda</DialogTitle>
            <DialogDescription>
              Venda #{saleId.slice(-6)} · saldo estornável{" "}
              <span className="tabular-nums">{formatBRL(remainingTotal)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Tipo de estorno</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "TOTAL" | "PARCIAL")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOTAL">Total</SelectItem>
                  <SelectItem value="PARCIAL">Parcial por item</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "PARCIAL" ? (
              <div className="grid gap-2">
                <Label>Itens a estornar</Label>
                {partialItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item com saldo restante.
                  </p>
                ) : (
                  partialItems.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{it.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          disponível {it.max} de {it.quantity}
                        </div>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={it.max}
                        step="any"
                        value={qtys[it.id] ?? ""}
                        onChange={(e) =>
                          setQtys((prev) => ({
                            ...prev,
                            [it.id]: e.target.value,
                          }))
                        }
                        className="h-8 w-20 text-right tabular-nums"
                        placeholder="0"
                      />
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Será estornado o valor total restante da venda.
              </p>
            )}

            <div className="grid gap-1.5">
              <Label>Forma de estorno</Label>
              <Select
                value={methodCode}
                onValueChange={(v) => setMethodCode(v as PaymentMethodCode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? "Estornando…" : "Confirmar estorno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function round2Local(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
