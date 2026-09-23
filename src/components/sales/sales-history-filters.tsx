"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SaleStatus } from "@/modules/sales/constants"

type StatusFilter = SaleStatus | ""

interface SalesHistoryFiltersProps {
  status: StatusFilter
  from: string
  to: string
}

function buildQuery(status: StatusFilter, from: string, to: string): string {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const qs = params.toString()
  return qs ? `/vendas?${qs}` : "/vendas"
}

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function SalesHistoryFilters({ status, from, to }: SalesHistoryFiltersProps) {
  const router = useRouter()

  const apply = (next: { status?: StatusFilter; from?: string; to?: string }) => {
    router.push(
      buildQuery(next.status ?? status, next.from ?? from, next.to ?? to),
    )
  }

  const today = toISODate(new Date())
  const sevenDaysAgo = toISODate(
    new Date(new Date().getTime() - 6 * 24 * 3600 * 1000),
  )

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select
          value={status || "ALL"}
          onValueChange={(v) =>
            apply({ status: v === "ALL" ? "" : (v as SaleStatus) })
          }
        >
          <SelectTrigger id="status" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="COMPLETED">Concluídas</SelectItem>
            <SelectItem value="CANCELLED">Canceladas</SelectItem>
            <SelectItem value="SUSPENDED">Suspensas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="from">De</Label>
        <Input
          id="from"
          type="date"
          value={from}
          onChange={(e) => apply({ from: e.target.value || undefined })}
          className="w-auto"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="to">Até</Label>
        <Input
          id="to"
          type="date"
          value={to}
          onChange={(e) => apply({ to: e.target.value || undefined })}
          className="w-auto"
        />
      </div>

      <div className="flex items-center gap-1 pb-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => apply({ from: today, to: today })}
        >
          Hoje
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => apply({ from: sevenDaysAgo, to: today })}
        >
          7 dias
        </Button>
        {status || from || to ? (
          <Button variant="ghost" size="sm" onClick={() => router.push("/vendas")}>
            Limpar
          </Button>
        ) : null}
      </div>
    </div>
  )
}