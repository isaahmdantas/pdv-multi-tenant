"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function StockAdjustForm({ products }: { products: Option[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          delta,
          reason: reason || null,
        }),
      });
      if (res.ok) {
        setProductId("");
        setDelta("");
        setReason("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao ajustar estoque.");
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
          <label htmlFor="adjust-product" className="text-sm font-medium">
            Produto *
          </label>
          <select
            id="adjust-product"
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
          <label htmlFor="adjust-delta" className="text-sm font-medium">
            Variação *
          </label>
          <input
            id="adjust-delta"
            required
            type="text"
            inputMode="decimal"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className={inputClass}
            placeholder="+6 ou -4"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="adjust-reason" className="text-sm font-medium">
            Motivo
          </label>
          <input
            id="adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
            placeholder="Quebra de mercadoria"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Aplicar ajuste"}
      </Button>
    </form>
  );
}