'use client'

import { BadgeCheckIcon, EraserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format'
import {
  PAYMENT_METHODS,
  paymentLabel,
  round2,
  type PaymentMethodCode,
  type PdvTotals,
  type ResolvedPayments,
} from '@/components/pdv/types'

interface PaymentPanelProps {
  totals: PdvTotals
  discountInput: string
  onDiscountChange: (value: string) => void
  payments: Record<PaymentMethodCode, string>
  onPaymentChange: (code: PaymentMethodCode, value: string) => void
  resolved: ResolvedPayments
  canFinalize: boolean
  submitting: boolean
  onFinalize: () => void
  onClearPayments: () => void
}

export function PaymentPanel({
  totals,
  discountInput,
  onDiscountChange,
  payments,
  onPaymentChange,
  resolved,
  canFinalize,
  submitting,
  onFinalize,
  onClearPayments,
}: PaymentPanelProps) {
  const { allocs, paid, remaining, change, complete } = resolved
  const fillRemaining = (code: PaymentMethodCode) => {
    if (remaining > 0.005) onPaymentChange(code, String(round2(remaining)))
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div>
        <label htmlFor="pdv-discount" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Desconto na venda (R$)
        </label>
        <Input
          id="pdv-discount"
          type="number"
          min={0}
          step="0.01"
          value={discountInput}
          placeholder="0,00"
          onChange={(e) => onDiscountChange(e.target.value)}
          className="h-10 text-right tabular-nums"
          disabled={totals.total <= 0}
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Rateio do pagamento</legend>
        <div className="flex flex-col gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <div key={m.code} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm font-medium">{m.label}</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={payments[m.code]}
                placeholder="0,00"
                onChange={(e) => onPaymentChange(m.code, e.target.value)}
                className="h-9 text-right tabular-nums"
                disabled={totals.total <= 0}
              />
              {remaining > 0.005 ? (
                <button
                  type="button"
                  onClick={() => fillRemaining(m.code)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Restante
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {change > 0 ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-success">
            <BadgeCheckIcon className="size-4" aria-hidden="true" />
            Troco: {formatBRL(change)}
          </p>
        ) : null}

        {!complete ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {paid > totals.total ? (
              <span className="text-destructive">
                Pagamento excede o total em {formatBRL(round2(paid - totals.total))}
              </span>
            ) : remaining > 0 ? (
              `Falta ${formatBRL(remaining)}`
            ) : (
              'Defina o valor pago em ao menos uma forma'
            )}
          </p>
        ) : null}
      </fieldset>

      <div className="rounded-md bg-muted/60 px-3 py-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatBRL(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Desconto</span>
          <span className="tabular-nums">{formatBRL(totals.discount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t pt-1.5 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatBRL(totals.total)}</span>
        </div>
        <p className="mt-0.5 text-right text-xs text-muted-foreground">
          {allocs.length > 0
            ? allocs.map((a) => `${paymentLabel(a.methodCode)} ${formatBRL(a.amount)}`).join(' · ')
            : 'Nenhum pagamento definido'}
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full text-base"
        disabled={!canFinalize || submitting}
        onClick={onFinalize}
      >
        {submitting ? 'Finalizando…' : `Finalizar venda · ${formatBRL(totals.total)}`}
      </Button>

      {paid > 0 ? (
        <button
          type="button"
          onClick={onClearPayments}
          className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <EraserIcon className="size-3.5" aria-hidden="true" />
          Limpar rateio
        </button>
      ) : null}
    </div>
  )
}