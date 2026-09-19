"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function StockMovementForm({
  type,
  products,
  units,
}: {
  type: "IN" | "OUT";
  products: Option[];
  units: Option[];
}) {
  const router = useRouter();
  const isIn = type === "IN";
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitOfMeasureId, setUnitOfMeasureId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/${isIn ? "stock-in" : "stock-out"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity,
          unitOfMeasureId: unitOfMeasureId || null,
          reason: reason || null,
        }),
      });
      if (res.ok) {
        setProductId("");
        setQuantity("");
        setUnitOfMeasureId("");
        setReason("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? `Falha ao registrar ${isIn ? "entrada" : "saída"}.`);
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
          <label htmlFor={`stock-${type}-product`} className="text-sm font-medium">
            Produto *
          </label>
          <select
            id={`stock-${type}-product`}
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
        <div className="space-y-1.5">
          <label htmlFor={`stock-${type}-qty`} className="text-sm font-medium">
            Quantidade *
          </label>
          <input
            id={`stock-${type}-qty`}
            required
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
            placeholder="10"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`stock-${type}-unit`} className="text-sm font-medium">
            Unidade de medida
          </label>
          <select
            id={`stock-${type}-unit`}
            value={unitOfMeasureId}
            onChange={(e) => setUnitOfMeasureId(e.target.value)}
            className={inputClass}
          >
            <option value="">Unidade base do produto</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`stock-${type}-reason`} className="text-sm font-medium">
            Motivo
          </label>
          <input
            id={`stock-${type}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
            placeholder="Compra de mercadoria"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : isIn ? "Registrar entrada" : "Registrar saída"}
      </Button>
    </form>
  );
}