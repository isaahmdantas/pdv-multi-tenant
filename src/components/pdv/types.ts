export interface PdvProduct {
  id: string
  name: string
  sku: string | null
  barcodes: string[]
}

export interface PdvCustomer {
  id: string
  name: string
  document: string | null
  categoryName: string | null
}

export interface CartItem {
  productId: string
  name: string
  sku: string | null
  quantity: number
  unitPrice: number
  itemDiscount: number
  total: number
  priceTableId: string | null
  promotionId: string | null
  appliedRule: string | null
  resolving: boolean
}

export interface PdvTotals {
  subtotal: number
  discount: number
  total: number
}

export interface SuspendedSale {
  id: string
  createdAt: string
  total: number
  discount: number
  customerId: string | null
  customerName: string | null
  items: {
    id: string
    productId: string
    name: string
    sku: string | null
    quantity: number
    unitPrice: number
    discount: number
    total: number
    priceTableId: string | null
    promotionId: string | null
  }[]
}

export const PAYMENT_METHODS = [
  { code: 'CASH', label: 'Dinheiro' },
  { code: 'PIX', label: 'Pix' },
  { code: 'CREDIT', label: 'Crédito' },
  { code: 'DEBIT', label: 'Débito' },
  { code: 'VOUCHER', label: 'Vale' },
] as const

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]['code']

export function paymentLabel(code: string): string {
  return PAYMENT_METHODS.find((m) => m.code === code)?.label ?? code
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface PaymentAlloc {
  methodCode: PaymentMethodCode
  amount: number
}

export interface ResolvedPayments {
  allocs: PaymentAlloc[]
  paid: number
  remaining: number
  change: number
  complete: boolean
}

export function resolvePayments(
  total: number,
  inputs: Partial<Record<PaymentMethodCode, string>>,
): ResolvedPayments {
  const entries = PAYMENT_METHODS.map((m) => ({
    code: m.code,
    amount: round2(Number(inputs[m.code]?.replace(',', '.')) || 0),
  }))
  const paid = round2(entries.reduce((acc, e) => acc + e.amount, 0))
  const otherPaid = round2(entries.filter((e) => e.code !== 'CASH').reduce((acc, e) => acc + e.amount, 0))
  const cash = entries.find((e) => e.code === 'CASH')?.amount ?? 0
  const cashDue = round2(Math.max(0, total - otherPaid))
  const change = round2(Math.max(0, cash - cashDue))
  const cashRecorded = round2(cash - change)
  const allocs: PaymentAlloc[] = entries
    .filter((e) => (e.code === 'CASH' ? cashRecorded > 0 : e.amount > 0))
    .map((e) => ({ methodCode: e.code, amount: e.code === 'CASH' ? cashRecorded : e.amount }))
  const allocSum = round2(allocs.reduce((acc, a) => acc + a.amount, 0))
  const complete = allocs.length > 0 && Math.abs(allocSum - total) < 0.01
  return { allocs, paid, remaining: round2(total - paid), change, complete }
}