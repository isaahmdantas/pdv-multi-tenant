'use client'

import { BadgeCheckIcon, EraserIcon } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format'
import {
  PAYMENT_METHODS,
  paymentLabel,
  round2,
  type PaymentMethodCode,
  type PdvTotals,
} from '@/components/pdv/types'

interface PaymentPanelProps {
  totals: PdvTotals
  discountInput: string
  onDiscountChange: (value: string) => void
  methodCode: PaymentMethodCode
  onMethodChange: (code: PaymentMethodCode) => void
  receivedInput: string
  onReceivedChange: (value: string) => void
  change: number
  canFinalize: boolean
  submitting: boolean
  onFinalize: () => void
}

export function PaymentPanel({
  totals,
  discountInput,
  onDiscountChange,
  methodCode,
  onMethodChange,
  receivedInput,
  onReceivedChange,
  change,
  canFinalize,
  submitting,
  onFinalize,
}: PaymentPanelProps) {
  const isCash = methodCode === 'CASH'
  const received = Number(receivedInput.replace(',', '.')) || 0

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
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
          Forma de pagamento
        </legend>
        <RadioGroup value={methodCode} onValueChange={(v) => onMethodChange(v as PaymentMethodCode)}>
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.code}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              <RadioGroupItem value={m.code} />
              <span className="font-medium">{m.label}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>

      {isCash ? (
        <div>
          <label htmlFor="pdv-received" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Valor recebido (R$)
          </label>
          <Input
            id="pdv-received"
            type="number"
            min={0}
            step="0.01"
            value={receivedInput}
            placeholder="0,00"
            onChange={(e) => onReceivedChange(e.target.value)}
            className="h-10 text-right tabular-nums"
          />
          {received >= totals.total && totals.total > 0 ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-success">
              <BadgeCheckIcon className="size-4" aria-hidden="true" />
              Troco: {formatBRL(change)}
            </p>
          ) : null}
        </div>
      ) : null}

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
          Pagamento em {paymentLabel(methodCode)}
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

      {change > 0 && isCash ? (
        <button
          type="button"
          onClick={() => onReceivedChange(String(round2(0)))}
          className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <EraserIcon className="size-3.5" aria-hidden="true" />
          Limpar valor recebido
        </button>
      ) : null}
    </div>
  )
}