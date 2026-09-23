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