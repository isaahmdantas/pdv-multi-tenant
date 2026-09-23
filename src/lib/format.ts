type MoneyLike = number | string | null | undefined | { toNumber(): number }
type DateLike = Date | string | null | undefined

function isDecimalLike(value: MoneyLike): value is { toNumber(): number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  );
}

function toNumber(value: MoneyLike): number | null {
  if (value == null) return null
  if (isDecimalLike(value)) {
    const n = value.toNumber()
    return Number.isFinite(n) ? n : null
  }
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return null
  return n
}

function toDate(value: DateLike): Date | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatBRL(value: MoneyLike, fallback = '—'): string {
  const n = toNumber(value)
  if (n == null) return fallback
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

export function formatNumber(value: MoneyLike, digits = 2, fallback = '—'): string {
  const n = toNumber(value)
  if (n == null) return fallback
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

export function formatDateTime(value: DateLike, fallback = '—'): string {
  const d = toDate(value)
  if (!d) return fallback
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatDate(value: DateLike, fallback = '—'): string {
  const d = toDate(value)
  if (!d) return fallback
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatTime(value: DateLike, fallback = '—'): string {
  const d = toDate(value)
  if (!d) return fallback
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function isToday(value: DateLike): boolean {
  const d = toDate(value)
  if (!d) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function formatRelativeDate(value: DateLike, fallback = '—'): string {
  const d = toDate(value)
  if (!d) return fallback
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays === 0) return `Hoje, ${formatTime(d)}`
  if (diffDays === 1) return `Ontem, ${formatTime(d)}`
  return formatDateTime(d)
}

export function formatMoneyInput(value: MoneyLike): string {
  const n = toNumber(value)
  if (n == null) return ''
  return n.toFixed(2).replace('.', ',')
}