'use client'

import { useMemo, useState } from 'react'
import { BarcodeIcon, PlusIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { PdvProduct } from '@/components/pdv/types'

interface ProductSearchProps {
  products: PdvProduct[]
  onAdd: (product: PdvProduct) => void
}

const MAX_RESULTS = 8

export function ProductSearch({ products, onAdd }: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [barcode, setBarcode] = useState('')
  const [feed, setFeed] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcodes.some((b) => b.includes(q)),
      )
      .slice(0, MAX_RESULTS)
  }, [products, query])

  const findBarcodeProduct = (value: string) =>
    products.find((p) => p.barcodes.some((b) => b === value)) ?? null

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const value = barcode.trim()
    if (!value) return
    const product = findBarcodeProduct(value)
    if (product) {
      onAdd(product)
      setBarcode('')
      setFeed(null)
    } else {
      setFeed(`Nenhum produto com o código "${value}"`)
      setBarcode('')
    }
  }

  const select = (product: PdvProduct) => {
    onAdd(product)
    setQuery('')
    setFeed(null)
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <label
        htmlFor="pdv-barcode"
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <BarcodeIcon className="size-3.5" aria-hidden="true" />
        Código de barras
      </label>
      <Input
        id="pdv-barcode"
        value={barcode}
        onChange={(e) => {
          setBarcode(e.target.value)
          setFeed(null)
        }}
        onKeyDown={handleBarcodeKeyDown}
        placeholder="Digite ou escaneie o código e pressione Enter"
        className="h-10 font-mono"
        autoFocus
      />
      {feed ? <p className="mt-1 text-xs text-destructive">{feed}</p> : null}

      <div className="relative mt-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto por nome, SKU ou código…"
          className="h-10"
        />
        {matches.length > 0 ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => select(p)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {p.sku ?? '—'}
                    </span>
                  </span>
                  <PlusIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() ? (
          <p className="mt-1 text-xs text-muted-foreground">Nenhum produto encontrado.</p>
        ) : null}
      </div>
    </div>
  )
}