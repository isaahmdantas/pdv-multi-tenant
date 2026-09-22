'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface UnitSwitcherStore {
  storeId: string
  name: string
  code: string
}

export function UnitSwitcher({
  stores,
  currentStoreId,
}: {
  stores: UnitSwitcherStore[]
  currentStoreId: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (stores.length === 0) return null

  const current = stores.find((s) => s.storeId === currentStoreId) ?? null

  async function onSwitch(storeId: string) {
    if (storeId === currentStoreId) return
    setError(null)
    setLoadingId(storeId)
    try {
      const res = await fetch('/api/v1/session/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      })
      if (res.ok) {
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string }
      } | null
      setError(body?.error?.message ?? 'Não foi possível trocar de unidade.')
    } catch {
      setError('Falha de conexão.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label="Trocar unidade ativa"
              className="h-8 max-w-56 justify-between gap-2 px-2.5"
            >
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
                {current ? `${current.name} (${current.code})` : 'Selecionar unidade'}
              </span>
              {loadingId ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Unidades de trabalho</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stores.map((s) => {
              const active = s.storeId === currentStoreId
              return (
                <DropdownMenuItem
                  key={s.storeId}
                  disabled={active || loadingId !== null}
                  onClick={() => onSwitch(s.storeId)}
                  className={active ? 'font-medium text-foreground' : ''}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {s.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">({s.code})</span>
                  </span>
                  {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
          {error ? (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 pb-1.5 text-xs text-destructive">{error}</p>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}