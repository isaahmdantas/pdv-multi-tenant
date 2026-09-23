'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircleIcon, CheckCircle2Icon, EraserIcon, PauseIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { formatBRL } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PdvHeader } from '@/components/pdv/pdv-header'
import { ProductSearch } from '@/components/pdv/product-search'
import { Cart } from '@/components/pdv/cart'
import { CustomerSelector } from '@/components/pdv/customer-selector'
import { PaymentPanel } from '@/components/pdv/payment-panel'
import { SuspendedSales } from '@/components/pdv/suspended-sales'
import {
  resolvePayments,
  round2,
  type CartItem,
  type PaymentMethodCode,
  type PdvCustomer,
  type PdvProduct,
  type SuspendedSale,
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
  const [payments, setPayments] = useState<Record<PaymentMethodCode, string>>({
    CASH: '',
    PIX: '',
    CREDIT: '',
    DEBIT: '',
    VOUCHER: '',
  })
  const [discountInput, setDiscountInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<{ id: string; total: number; change: number } | null>(null)
  const [suspended, setSuspended] = useState<SuspendedSale[]>([])
  const [suspending, setSuspending] = useState(false)
  const [busySuspendedId, setBusySuspendedId] = useState<string | null>(null)

  const cartRef = useRef<CartItem[]>(cart)
  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  async function refreshSuspended() {
    try {
      const res = await fetch('/api/v1/sales/suspended')
      if (!res.ok) return
      const data = await res.json()
      setSuspended((data.sales as SuspendedSale[]) ?? [])
    } catch {
      // painel apenas de conveniência: falha silenciosa
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/v1/sales/suspended')
        if (!res.ok || cancelled) return
        const data = await res.json()
        setSuspended((data.sales as SuspendedSale[]) ?? [])
      } catch {
        // painel apenas de conveniência: falha silenciosa
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const subtotal = round2(cart.reduce((acc, item) => acc + item.total, 0))
  const discount = round2(Math.max(0, Number(discountInput.replace(',', '.')) || 0))
  const total = round2(Math.max(0, subtotal - discount))
  const resolved = resolvePayments(total, payments)
  const setPayment = (code: PaymentMethodCode, value: string) =>
    setPayments((prev) => ({ ...prev, [code]: value }))
  const clearPayments = () => setPayments({ CASH: '', PIX: '', CREDIT: '', DEBIT: '', VOUCHER: '' })

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
          payments: resolved.allocs.map((alloc) => ({
            methodCode: alloc.methodCode,
            amount: String(alloc.amount),
          })),
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
        change: resolved.change,
      })
      setCart([])
      setCustomerId(null)
      setDiscountInput('')
      clearPayments()
      router.refresh()
    } catch {
      setError('Erro de conexão ao finalizar venda.')
    } finally {
      setSubmitting(false)
    }
  }

  async function suspendSale() {
    const items = cartRef.current
    if (items.length === 0 || suspending) return
    setSuspending(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/sales/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: store?.id,
          customerId: customerId ?? undefined,
          discount: discount > 0 ? String(discount) : '0',
          items: items.map((item) => ({
            productId: item.productId,
            quantity: String(item.quantity),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? 'Erro ao suspender a venda.')
        return
      }
      setCart([])
      setCustomerId(null)
      setDiscountInput('')
      clearPayments()
      void refreshSuspended()
    } catch {
      setError('Erro de conexão ao suspender a venda.')
    } finally {
      setSuspending(false)
    }
  }

  async function recoverSuspended(id: string) {
    if (busySuspendedId !== null) return
    if (cartRef.current.length > 0) {
      setError('Esvazie ou finalize o carrinho atual antes de retomar uma venda suspensa.')
      return
    }
    setBusySuspendedId(id)
    setError(null)
    try {
      const res = await fetch(`/api/v1/sales/${id}/recover`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? 'Erro ao retomar a venda suspensa.')
        return
      }
      const sale = data.sale as {
        customerId: string | null
        discount: string
        items: Array<{
          productId: string
          name: string
          sku: string | null
          quantity: string
          unitPrice: string
          discount: string
          total: string
          priceTableId: string | null
          promotionId: string | null
        }>
      }
      const nextCart: CartItem[] = sale.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        sku: it.sku,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        itemDiscount: Number(it.discount),
        total: Number(it.total),
        priceTableId: it.priceTableId,
        promotionId: it.promotionId,
        appliedRule: null,
        resolving: true,
      }))
      setCustomerId(sale.customerId ?? null)
      setDiscountInput(Number(sale.discount) > 0 ? String(Number(sale.discount)) : '')
      setCart(nextCart)
      for (const item of nextCart) {
        void syncPrice(item.productId, item.quantity, sale.customerId ?? null)
      }
      void refreshSuspended()
    } catch {
      setError('Erro de conexão ao retomar a venda suspensa.')
    } finally {
      setBusySuspendedId(null)
    }
  }

  async function discardSuspended(id: string) {
    if (busySuspendedId !== null) return
    setBusySuspendedId(id)
    setError(null)
    try {
      const res = await fetch(`/api/v1/sales/${id}/discard`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? 'Erro ao descartar a venda suspensa.')
        return
      }
      void refreshSuspended()
    } catch {
      setError('Erro de conexão ao descartar a venda suspensa.')
    } finally {
      setBusySuspendedId(null)
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

          {cart.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={suspendSale}
                disabled={suspending}
              >
                <PauseIcon className="mr-1.5 size-4" aria-hidden="true" />
                {suspending ? 'Suspender…' : 'Suspender venda'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCart([])
                  setCustomerId(null)
                  setDiscountInput('')
                  clearPayments()
                }}
              >
                <EraserIcon className="mr-1.5 size-4" aria-hidden="true" />
                Esvaziar
              </Button>
            </div>
          ) : null}

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
          <SuspendedSales
            sales={suspended}
            busyId={busySuspendedId}
            onRecover={recoverSuspended}
            onDiscard={discardSuspended}
          />
          <CustomerSelector customers={customers} value={customerId} onSelect={selectCustomer} />
          <PaymentPanel
            totals={{ subtotal, discount, total }}
            discountInput={discountInput}
            onDiscountChange={setDiscountInput}
            payments={payments}
            onPaymentChange={setPayment}
            resolved={resolved}
            canFinalize={resolved.complete && cart.length > 0 && total > 0 && !!openSession}
            submitting={submitting}
            onFinalize={finalize}
            onClearPayments={clearPayments}
          />
        </div>
      </div>
    </div>
  )
}