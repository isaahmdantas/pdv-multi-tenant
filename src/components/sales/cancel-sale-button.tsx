"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export function CancelSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/sales/${saleId}/cancel`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? "Não foi possível cancelar a venda.")
        setSubmitting(false)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("Erro de conexão. Tente novamente.")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cancelar
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancelar venda?"
        description="O estoque dos itens será devolvido e a venda ficará marcada como cancelada. Essa ação não pode ser desfeita."
        confirmLabel={submitting ? "Cancelando…" : "Cancelar venda"}
        loading={submitting}
        onConfirm={handleConfirm}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}