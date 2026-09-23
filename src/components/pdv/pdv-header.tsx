'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { formatTime } from '@/lib/format'

interface PdvHeaderProps {
  storeName: string | null
  storeCode: string | null
  cashRegisterName: string | null
  operatorName: string
}

export function PdvHeader({
  storeName,
  storeCode,
  cashRegisterName,
  operatorName,
}: PdvHeaderProps) {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Voltar ao painel"
          className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight">
            PDV{storeName ? ` — ${storeName}` : ''}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {storeCode ? `${storeCode} · ` : ''}
            {cashRegisterName ?? 'Nenhuma sessão de caixa'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-right">
        <div>
          <p className="text-xs text-muted-foreground">Operador</p>
          <p className="max-w-40 truncate text-sm font-medium">{operatorName}</p>
        </div>
        <div className="hidden min-w-16 sm:block">
          <p className="text-xs text-muted-foreground">Relógio</p>
          <p className="text-sm font-semibold tabular-nums">{formatTime(now)}</p>
        </div>
      </div>
    </header>
  )
}