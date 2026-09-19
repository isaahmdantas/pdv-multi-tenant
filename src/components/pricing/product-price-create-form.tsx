"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function ProductPriceCreateForm({
  priceTableId,
  products,
}: {
  priceTableId: string;
  products: Option[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("");
  const [maximumQuantity, setMaximumQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/price-tables/${priceTableId}/products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            unitPrice,
            minimumQuantity: minimumQuantity || null,
            maximumQuantity: maximumQuantity || null,
          }),
        },
      );
      if (res.ok) {
        setProductId("");
        setUnitPrice("");
        setMinimumQuantity("");
        setMaximumQuantity("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao adicionar preço.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 rounded-lg border bg-muted/30 p-4"
    >
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Novo preço de produto nesta tabela
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`price-product-${priceTableId}`} className="text-sm font-medium">
            Produto *
          </label>
          <select
            id={`price-product-${priceTableId}`}
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`price-unit-${priceTableId}`} className="text-sm font-medium">
            Preço unitário (R$) *
          </label>
          <input
            id={`price-unit-${priceTableId}`}
            type="text"
            inputMode="decimal"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className={inputClass}
            placeholder="9.90"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`price-min-${priceTableId}`} className="text-sm font-medium">
            Quantidade mínima
          </label>
          <input
            id={`price-min-${priceTableId}`}
            type="text"
            inputMode="decimal"
            value={minimumQuantity}
            onChange={(e) => setMinimumQuantity(e.target.value)}
            className={inputClass}
            placeholder="10"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`price-max-${priceTableId}`} className="text-sm font-medium">
            Quantidade máxima
          </label>
          <input
            id={`price-max-${priceTableId}`}
            type="text"
            inputMode="decimal"
            value={maximumQuantity}
            onChange={(e) => setMaximumQuantity(e.target.value)}
            className={inputClass}
            placeholder="49"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Adicionando..." : "Adicionar preço"}
      </Button>
    </form>
  );
}