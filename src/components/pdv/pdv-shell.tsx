'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircleIcon, CheckCircle2Icon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { formatBRL } from '@/lib/format'
import { PdvHeader } from '@/components/pdv/pdv-header'
import { ProductSearch } from '@/components/pdv/product-search'
import { Cart } from '@/components/pdv/cart'
import { CustomerSelector } from '@/components/pdv/customer-selector'
import { PaymentPanel } from '@/components/pdv/payment-panel'
import {
  round2,
  type CartItem,
  type PaymentMethodCode,
  type PdvCustomer,
  type PdvProduct,
} from '@/components/pdv/types'

interface PdvShellProps {
  store: { id: string; name: string; code: string | null } | null
  operatorName: string
  openSession: { id: string; cashRegisterName: string } | null
  products: PdvProduct[]
  customers: PdvCustomer[]
}

interface ResolvedPrice {
  unitPrice: number
  priceTableId: string | null
  promotionId: string | null
  appliedRule: string | null
}

export function PdvShell({ store, operatorName, openSession, products, customers }: PdvShellProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [methodCode, setMethodCode] = useState<PaymentMethodCode>('CASH')
  const [discountInput, setDiscountInput] = useState('')
  const [receivedInput, setReceivedInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<{ id: string; total: number; change: number } | null>(null)

  const cartRef = useRef<CartItem[]>(cart)
  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  const subtotal = round2(cart.reduce((acc, item) => acc + item.total, 0))
  const discount = round2(Math.max(0, Number(discountInput.replace(',', '.')) || 0))
  const total = round2(Math.max(0, subtotal - discount))
  const received = Number(receivedInput.replace(',', '.')) || 0
  const change = methodCode === 'CASH' && received > total ? round2(received - total) : 0

  async function fetchPrice(productId: string, quantity: number, customerId: string | null): Promise<ResolvedPrice> {
    const res = await fetch('/api/v1/pricing/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: store?.id,
        productId,
        quantity: String(quantity),
        customerId: customerId ?? undefined,
      }),
    })
    if (!res.ok) throw new Error('price_error')
    const data = await res.json()
    const price = data.price as {
      unitPrice: string
      priceTableId?: string | null
      promotionId?: string | null
      appliedRule?: string | null
    }
    return {
      unitPrice: Number(price.unitPrice),
      priceTableId: price.priceTableId ?? null,
      promotionId: price.promotionId ?? null,
      appliedRule: price.appliedRule ?? null,
    }
  }

  async function syncPrice(productId: string, quantity: number, customerId: string | null) {
    setCart((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, resolving: true } : it)),
    )
    try {
      const price = await fetchPrice(productId, quantity, customerId)
      setCart((prev) =>
        prev.map((it) =>
          it.productId === productId
            ? {
                ...it,
                resolving: false,
                unitPrice: price.unitPrice,
                priceTableId: price.priceTableId,
                promotionId: price.promotionId,
                appliedRule: price.appliedRule,
                total: round2(price.unitPrice * quantity - it.itemDiscount),
              }
            : it,
        ),
      )
    } catch {
      setCart((prev) =>
        prev.map((it) => (it.productId === productId ? { ...it, resolving: false } : it)),
      )
      setError('Não foi possível calcular o preço de um item.')
    }
  }

  function addProduct(product: PdvProduct) {
    setError(null)
    const existing = cartRef.current.find((it) => it.productId === product.id)
    if (existing) {
      setQuantity(existing.productId, existing.quantity + 1)
      return
    }
    setCart((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: 0,
        itemDiscount: 0,
        total: 0,
        priceTableId: null,
        promotionId: null,
        appliedRule: null,
        resolving: true,
      },
    ])
    void syncPrice(product.id, 1, customerId)
  }

  function setQuantity(productId: string, quantity: number) {
    if (quantity < 1) return
    const item = cartRef.current.find((it) => it.productId === productId)
    if (!item) return
    setCart((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? { ...it, quantity, total: round2(it.unitPrice * quantity - it.itemDiscount), resolving: true }
          : it,
      ),
    )
    void syncPrice(productId, quantity, customerId)
  }

  function setItemDiscount(productId: string, value: number) {
    setCart((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? {
              ...it,
              itemDiscount: round2(value),
              total: round2(Math.max(0, it.unitPrice * it.quantity - value)),
            }
          : it,
      ),
    )
  }

  function selectCustomer(id: string | null) {
    setCustomerId(id)
    if (id === null) {
      for (const item of cartRef.current) void syncPrice(item.productId, item.quantity, null)
      return
    }
    for (const item of cartRef.current) void syncPrice(item.productId, item.quantity, id)
  }

  async function finalize() {
    if (!openSession || total <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const amount = round2(total)
      const res = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: store?.id,
          cashSessionId: openSession.id,
          customerId: customerId ?? undefined,
          discount: discount > 0 ? String(discount) : '0',
          clientOperationId: crypto.randomUUID(),
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: String(item.quantity),
          })),
          payments: [{ methodCode, amount: String(amount) }],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? 'Erro ao finalizar venda.')
        return
      }
      setCompleted({
        id: (data.sale?.id ?? '') as string,
        total: amount,
        change: methodCode === 'CASH' ? change : 0,
      })
      setCart([])
      setCustomerId(null)
      setDiscountInput('')
      setReceivedInput('')
      router.refresh()
    } catch {
      setError('Erro de conexão ao finalizar venda.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <PdvHeader
        storeName={store?.name ?? null}
        storeCode={store?.code ?? null}
        cashRegisterName={openSession?.cashRegisterName ?? null}
        operatorName={operatorName}
      />

      {!openSession ? (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          Não há sessão de caixa aberta.
          <Link href="/caixa" className="ml-1 underline underline-offset-2">
            Abrir sessão em Caixa
          </Link>{' '}
          para poder finalizar vendas.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-h-0 flex-col gap-4">
          <ProductSearch products={products} onAdd={addProduct} />

          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{error}</span>
            </div>
          ) : null}

          {completed ? (
            <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
              <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden="true" />
              <div className="flex-1 text-sm">
                <p className="font-medium">Venda finalizada</p>
                <p className="text-xs text-muted-foreground">
                  Venda {completed.id.slice(-6)} · {formatBRL(completed.total)}
                  {completed.change > 0 ? ` · Troco ${formatBRL(completed.change)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompleted(null)}
                aria-label="Dispensar aviso"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            <Cart
              items={cart}
              onQuantityChange={setQuantity}
              onDiscountChange={setItemDiscount}
              onRemove={(productId) => setCart((prev) => prev.filter((it) => it.productId !== productId))}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <CustomerSelector customers={customers} value={customerId} onSelect={selectCustomer} />
          <PaymentPanel
            totals={{ subtotal, discount, total }}
            discountInput={discountInput}
            onDiscountChange={setDiscountInput}
            methodCode={methodCode}
            onMethodChange={setMethodCode}
            receivedInput={receivedInput}
            onReceivedChange={setReceivedInput}
            change={change}
            canFinalize={cart.length > 0 && total > 0 && !!openSession}
            submitting={submitting}
            onFinalize={finalize}
          />
        </div>
      </div>
    </div>
  )
}