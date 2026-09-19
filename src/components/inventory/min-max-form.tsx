"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function MinMaxForm({ products }: { products: Option[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/inventory/min-max", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          minStock: minStock || "0",
          maxStock: maxStock || "0",
        }),
      });
      if (res.ok) {
        setProductId("");
        setMinStock("");
        setMaxStock("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao definir mínimo/máximo.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="minmax-product" className="text-sm font-medium">
            Produto *
          </label>
          <select
            id="minmax-product"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione um produto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="minmax-min" className="text-sm font-medium">
              Mínimo
            </label>
            <input
              id="minmax-min"
              type="text"
              inputMode="decimal"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="minmax-max" className="text-sm font-medium">
              Máximo
            </label>
            <input
              id="minmax-max"
              type="text"
              inputMode="decimal"
              value={maxStock}
              onChange={(e) => setMaxStock(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Definir mínimo/máximo"}
      </Button>
    </form>
  );
}